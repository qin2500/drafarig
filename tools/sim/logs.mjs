// Annotated game logs for review: the battle protocol turn by turn, with each heuristic player's reasoning (team preview
// scores, the opponent plans it expected, its equilibrium mix, what it chose and why, and its own model of the turn).
//   node tools/sim/logs.mjs [ours=a01] [theirs=z01,z04,z07,z03,z09] [seed=1]  → tools/sim/logs/<ours>-vs-<theirs>-s<seed>.md
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { playGame } from './game.mjs';

const CAND = JSON.parse(readFileSync(new URL('./candidates/zhuzi.json', import.meta.url), 'utf8'));
const byId = (id) => [...CAND.ours.teams, ...CAND.opponent.teams].find((t) => t.id === id);
const KEEP = /^\|(switch|drag|move|-damage|-heal|faint|-mega|-weather|-fieldstart|-fieldend|-sidestart|-sideend|-status|-boost|-unboost|-activate|-crit|-supereffective|-resisted|-immune|-miss|-fail|cant|-enditem|-formechange|win|tie|-singleturn)\|/;

function render(t, ours, theirs, seed, r) {
  const turns = r.log.split(/\n(?=\|turn\|)/);
  const notes = (side, turn) => r.notes[side].filter((n) => (n.turn ?? 0) === turn);
  const fmt = (n) => {
    if (n.preview) return `- **Preview** (${n.preview.why}): bring ${n.preview.bring.join(', ')}; lead ${n.preview.leads.join(' + ')}. Top fours: ${n.preview.top.map((x) => `${x.four.join('/')} ${x.score}`).join('; ')}`;
    if (n.replace !== undefined) return `- **Replace** slot ${n.replace + 1}: ${n.chose} (scores ${n.options.join(', ')})`;
    if (n.error || n.crash) return `- **Error**: ${n.error ?? n.crash}`;
    return [`- **Expected from them** (plans if we idle): ${n.guess.join(' · ')}`,
      `- **Equilibrium mix**: ${n.mix.join(' · ')}`, `- **Their predicted mix**: ${n.expect.join(' · ')}`,
      `- **Chose**: ${n.chose}`, `- **Own model of the turn** (vs their likeliest play): ${n.model.join(' · ') || '—'}`].join('\n');
  };
  let md = `# ${t} · seed ${seed}\n\nOurs (p1, ${ours.id} "${ours.label}") vs theirs (p2, ${theirs.id} "${theirs.label}"). Both heuristic (skill 0.85, noise 0.07, balanced).\n` +
    `**Winner: ${r.winner === 'p1' ? 'ours' : r.winner === 'p2' ? 'theirs' : 'tie'}** in ${r.turns} turns. Brought: ours ${r.summary.p1.brought.join(', ')}; theirs ${r.summary.p2.brought.join(', ')}.\n\n` +
    `Reasoning lines are the AI's own (values are its position estimate: + good for that side). The "own model" is its approximate one-turn resolver, not Showdown.\n`;
  for (const chunk of turns) {
    const m = chunk.match(/^\|turn\|(\d+)/);
    const turn = m ? Number(m[1]) : 0;
    md += `\n## ${turn ? `Turn ${turn}` : 'Team preview and leads'}\n`;
    for (const side of ['p1', 'p2']) { const ns = notes(side, turn); if (ns.length) md += `\n**${side === 'p1' ? 'Ours' : 'Theirs'} (${side}) reasoning**\n${ns.map(fmt).join('\n')}\n`; }
    const lines = chunk.split('\n').filter((l) => KEEP.test(l));
    if (lines.length) md += `\n\`\`\`\n${lines.join('\n')}\n\`\`\`\n`;
  }
  return md;
}
const [oursId = 'a01', theirsList = 'z01,z04,z07,z03,z09', seed0 = '1'] = process.argv.slice(2);
mkdirSync(new URL('./logs/', import.meta.url), { recursive: true });
for (const [k, theirsId] of theirsList.split(',').entries()) {
  const ours = byId(oursId), theirs = byId(theirsId), seed = Number(seed0) + k;
  const r = await playGame({ text: ours.team, ai: 'heuristic', name: 'Ours' }, { text: theirs.team, ai: 'heuristic', name: 'Theirs' }, seed, { keepLog: true, notes: true });
  const file = new URL(`./logs/${oursId}-vs-${theirsId}-s${seed}.md`, import.meta.url);
  writeFileSync(file, render(`${oursId} vs ${theirsId}`, ours, theirs, seed, r));
  console.log(file.pathname, r.winner, r.turns, 'errors', r.errors);
}

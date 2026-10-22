// One headless Champions Reg M-C doubles game between two players (heuristic or Showdown's random), deterministic per seed.
import { PS, RandomPlayerAI, packTeam, FORMAT, toID, setsFromText, moveOf, PROTECTS, SPREAD } from './ai/data.mjs';
import { HeuristicPlayer } from './ai/player.mjs';
import { calcStats, clearDamageCache } from './ai/engine.mjs';

const spreadUsers = (sets) => new Set(sets.filter((s) => s.moves.some((id) => SPREAD.has(moveOf(id).target) && moveOf(id).category !== 'Status')).map((s) => s.species));
const rockUsers = (sets) => sets.some((s) => s.moves.some((id) => moveOf(id).type === 'Rock' && SPREAD.has(moveOf(id).target) && moveOf(id).category !== 'Status'));

/**
 * side: { text, ai: 'heuristic'|'random', name, ...heuristic options }. Returns { winner: 'p1'|'p2'|'tie', turns, summary,
 * errors, log?, notes? }. seed: an integer; the battle and both players derive their seeds from it (common random numbers).
 * summary per side: brought, leads, Trick Rooms / Tailwinds set, Megas and the turn of the first, faints, and the review
 * metrics (ai-review.md): turns with two movers and double-Protect turns, moves and failed moves, Wide Guard uses and
 * turns it was available against an active spread threat, Charizard led into a spread-Rock team.
 */
export async function playGame(p1, p2, seed, { keepLog = false, notes = false, maxTurns = 60 } = {}) {
  const refusals0 = { ...calcStats.refusals }; // games run one at a time per worker, so the difference is this game's
  clearDamageCache(); // no cached damage may leak between games (different teams reuse the same slot keys)
  const streams = PS.getPlayerStreams(new PS.BattleStream());
  const mk = (side, other, stream, k) => (side.ai === 'random'
    ? new RandomPlayerAI(stream, { seed: [seed, k, 7, 11], mega: 0.8 })
    : new HeuristicPlayer(stream, { ...side, mine: side.text, theirs: side.belief ?? other.text, seed: [seed, k, 13, 17], notes }));
  const a = mk(p1, p2, streams.p1, 1), b = mk(p2, p1, streams.p2, 2);
  void a.start().catch(() => {}); void b.start().catch(() => {});
  const sets = { p1: setsFromText(p1.text), p2: setsFromText(p2.text) };
  const spread = { p1: spreadUsers(sets.p1), p2: spreadUsers(sets.p2) };
  const wgUsers = { p1: new Set(sets.p1.filter((s) => s.moves.includes('wideguard')).map((s) => s.species)), p2: new Set(sets.p2.filter((s) => s.moves.includes('wideguard')).map((s) => s.species)) };
  const blank = () => ({ brought: [], leads: [], tr: 0, mega: [], megaTurn: null, fainted: 0, tailwind: 0, movers2: 0, doubleProtect: 0, moves: 0, failed: 0, wideGuard: 0, wgChances: 0, chilly: 0 });
  const sum = { p1: blank(), p2: blank() };
  const active = { p1: ['', ''], p2: ['', ''] };
  let winner = null, turns = 0, log = '', lastMover = null, lastMove = null;
  let moved = { p1: [], p2: [] };
  const endTurn = () => {
    for (const s of ['p1', 'p2']) {
      if (moved[s].length >= 2) { sum[s].movers2++; if (moved[s].every((m) => PROTECTS.has(m) || m === 'wideguard')) sum[s].doubleProtect++; }
      const o = s === 'p1' ? 'p2' : 'p1';
      if (turns > 0 && active[s].some((sp) => wgUsers[s].has(sp)) && active[o].some((sp) => spread[o].has(sp))) sum[s].wgChances++;
    }
    moved = { p1: [], p2: [] };
  };
  const done = (async () => {
    for await (const chunk of streams.omniscient) {
      if (keepLog) log += chunk + '\n';
      for (const line of chunk.split('\n')) {
        const p = line.split('|');
        if (p[1] === 'switch' || p[1] === 'drag') {
          const side = p[2].slice(0, 2), sp = toID(p[3].split(',')[0].replace(/-Mega.*$/, ''));
          active[side][p[2][2] === 'b' ? 1 : 0] = sp;
          if (!sum[side].brought.includes(sp)) sum[side].brought.push(sp);
          if (turns === 0 && sum[side].leads.length < 2 && !sum[side].leads.includes(sp)) sum[side].leads.push(sp);
        } else if (p[1] === 'move') {
          const side = p[2].slice(0, 2), id = toID(p[3]);
          lastMover = side; lastMove = p[2];
          if (!p.slice(4).some((x) => x.startsWith('[from]'))) { sum[side].moves++; moved[side].push(id); if (id === 'wideguard') sum[side].wideGuard++; if (id === 'chillyreception') sum[side].chilly++; }
        } else if (p[1] === '-fail' && p[2] === lastMove && !p.some((x) => x.startsWith('[from]'))) sum[p[2].slice(0, 2)].failed++;
        else if (p[1] === '-fieldstart' && /Trick Room/.test(p[2])) { const of = p.find((x) => x.startsWith('[of] ')); sum[of ? of.slice(5, 7) : lastMover].tr++; }
        else if (p[1] === '-sidestart' && /Tailwind/.test(p[3] ?? '')) sum[p[2].slice(0, 2)].tailwind++;
        else if (p[1] === '-mega') { const s = p[2].slice(0, 2); sum[s].mega.push(toID(p[3])); sum[s].megaTurn ??= turns + 1; }
        else if (p[1] === 'faint') sum[p[2].slice(0, 2)].fainted++;
        else if (p[1] === 'win') { endTurn(); winner = p[2] === (p1.name ?? 'P1') ? 'p1' : 'p2'; }
        else if (p[1] === 'tie') winner = 'tie';
        else if (p[1] === 'turn') { endTurn(); turns = +p[2]; if (turns > maxTurns) void streams.omniscient.write('>forcetie'); }
      }
    }
  })();
  void streams.omniscient.write(`>start ${JSON.stringify({ formatid: FORMAT, seed: [seed, 1, 2, 3] })}\n>player p1 ${JSON.stringify({ name: p1.name ?? 'P1', team: packTeam(p1.text) })}\n>player p2 ${JSON.stringify({ name: p2.name ?? 'P2', team: packTeam(p2.text) })}`);
  await done;
  // Charizard led into a team with a spread Rock move; "uncovered" = its partner has neither Wide Guard nor Fake Out
  for (const s of ['p1', 'p2']) {
    const into = sum[s].leads.includes('charizard') && rockUsers(sets[s === 'p1' ? 'p2' : 'p1']);
    const partner = sets[s].find((x) => sum[s].leads.includes(x.species) && x.species !== 'charizard');
    sum[s].zardIntoRock = into;
    sum[s].zardIntoRockUncovered = into && !(partner?.moves.includes('wideguard') || partner?.moves.includes('fakeout'));
  }
  sum.p1.pick = a.previewPick ?? null; sum.p2.pick = b.previewPick ?? null; // the team-preview choice (bring 4, leads)
  const errors = (a.crashes ?? 0) + (b.crashes ?? 0);
  const refusals = Object.fromEntries(Object.entries(calcStats.refusals).map(([k, n]) => [k, n - (refusals0[k] ?? 0)]).filter(([, n]) => n > 0));
  return { winner: winner ?? 'tie', turns, summary: sum, errors, refusals, ...(keepLog ? { log } : {}), ...(notes ? { notes: { p1: a.notes ?? [], p2: b.notes ?? [] } } : {}) };
}

// One headless Champions Reg M-C doubles game between two players (heuristic or Showdown's random), deterministic per seed.
import { PS, RandomPlayerAI, packTeam, FORMAT, toID } from './ai/data.mjs';
import { HeuristicPlayer } from './ai/player.mjs';

/**
 * side: { text, ai: 'heuristic'|'random', name, ...heuristic options }. Returns { winner: 'p1'|'p2'|'tie', turns, summary,
 * log?, notes? }. summary: per side the Pokémon brought (in order seen), the leads, Trick Rooms set, Megas, faints.
 * seed: an integer; the battle and both players derive their seeds from it (common random numbers across options).
 */
export async function playGame(p1, p2, seed, { keepLog = false, notes = false, maxTurns = 60 } = {}) {
  const streams = PS.getPlayerStreams(new PS.BattleStream());
  const mk = (side, other, stream, k) => (side.ai === 'random'
    ? new RandomPlayerAI(stream, { seed: [seed, k, 7, 11], mega: 0.8 })
    : new HeuristicPlayer(stream, { ...side, mine: side.text, theirs: other.text, seed: [seed, k, 13, 17], notes }));
  const a = mk(p1, p2, streams.p1, 1), b = mk(p2, p1, streams.p2, 2);
  void a.start().catch(() => {}); void b.start().catch(() => {});
  let winner = null, turns = 0, log = '';
  const sum = { p1: { brought: [], leads: [], tr: 0, mega: [], fainted: 0, tailwind: 0 }, p2: { brought: [], leads: [], tr: 0, mega: [], fainted: 0, tailwind: 0 } };
  let lastMover = null;
  const done = (async () => {
    for await (const chunk of streams.omniscient) {
      if (keepLog) log += chunk + '\n';
      for (const line of chunk.split('\n')) {
        const p = line.split('|');
        if (p[1] === 'switch' || p[1] === 'drag') {
          const side = p[2].slice(0, 2), sp = toID(p[3].split(',')[0].replace(/-Mega.*$/, ''));
          if (!sum[side].brought.includes(sp)) sum[side].brought.push(sp);
          if (turns === 0 && sum[side].leads.length < 2 && !sum[side].leads.includes(sp)) sum[side].leads.push(sp);
        } else if (p[1] === 'move') lastMover = p[2].slice(0, 2);
        else if (p[1] === '-fieldstart' && /Trick Room/.test(p[2])) { const of = p.find((x) => x.startsWith('[of] ')); sum[of ? of.slice(5, 7) : lastMover].tr++; }
        else if (p[1] === '-sidestart' && /Tailwind/.test(p[3] ?? '')) sum[p[2].slice(0, 2)].tailwind++;
        else if (p[1] === '-mega') sum[p[2].slice(0, 2)].mega.push(toID(p[3]));
        else if (p[1] === 'faint') sum[p[2].slice(0, 2)].fainted++;
        else if (p[1] === 'win') winner = p[2] === (p1.name ?? 'P1') ? 'p1' : 'p2';
        else if (p[1] === 'tie') winner = 'tie';
        else if (p[1] === 'turn') { turns = +p[2]; if (turns > maxTurns) void streams.omniscient.write('>forcetie'); }
      }
    }
  })();
  void streams.omniscient.write(`>start ${JSON.stringify({ formatid: FORMAT, seed: [seed, 1, 2, 3] })}\n>player p1 ${JSON.stringify({ name: p1.name ?? 'P1', team: packTeam(p1.text) })}\n>player p2 ${JSON.stringify({ name: p2.name ?? 'P2', team: packTeam(p2.text) })}`);
  await done;
  const errors = (a.crashes ?? 0) + (b.crashes ?? 0);
  return { winner: winner ?? 'tie', turns, summary: sum, errors, ...(keepLog ? { log } : {}), ...(notes ? { notes: { p1: a.notes ?? [], p2: b.notes ?? [] } } : {}) };
}

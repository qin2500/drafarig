// Per-ZhuZi-team breakdown (persona, their bring / lead, our lead / bring, Trick Room) for one of our teams:
//   node docs/research/strategy/sim/scripts/team-breakdown.mjs a17 z01,z03,z08 tools/sim/results/r3/a17.jsonl tools/sim/results/r4/a17.jsonl
import { readFileSync } from 'node:fs';
const [ours, ids, ...files] = process.argv.slice(2);
const all = files.flatMap((f) => readFileSync(f, 'utf8').trim().split('\n').map((l) => JSON.parse(l))).filter((r) => r.ours === ours && r.winner);
for (const id of ids.split(',')) {
  const T = all.filter((r) => r.theirs === id);
  const w = T.filter((r) => r.winner === 'ours').length;
  const cnt = (f, k = 4) => { const o = {}; for (const r of T) { const key = f(r); o[key] ??= [0, 0]; o[key][0]++; o[key][1] += r.winner === 'ours'; } return Object.entries(o).sort((a, b) => b[1][0] - a[1][0]).slice(0, k).map(([key, [n, x]]) => `${key} ${x}/${n}`).join(' · '); };
  const avg = (f) => (T.reduce((t, r) => t + f(r), 0) / T.length).toFixed(2);
  console.log(`\n=== ${id}: ${w}/${T.length} = ${(100 * w / T.length).toFixed(0)}%`);
  console.log('  persona: ' + cnt((r) => r.persona ?? 'calc'));
  console.log('  their bring: ' + cnt((r) => [...r.their.brought].sort().join('/')));
  console.log('  their lead: ' + cnt((r) => r.their.leads.join('+')));
  console.log('  our lead: ' + cnt((r) => r.our.leads.join('+')));
  console.log('  our bring: ' + cnt((r) => [...r.our.brought].sort().join('/'), 3));
  console.log(`  turns ${avg((r) => r.turns)}, their TR ${avg((r) => r.their.tr)}, our TR ${avg((r) => r.our.tr)}, our mega turn ${avg((r) => r.our.megaTurn ?? 0)}, zard into rock ${avg((r) => +!!r.our.zardIntoRock)}, their chilly ${avg((r) => r.their.chilly ?? 0)}`);
  console.log(`  lost games: their TR ${(T.filter((r) => r.winner !== 'ours').reduce((t, r) => t + r.their.tr, 0) / Math.max(1, T.length - w)).toFixed(2)}, won games: their TR ${(T.filter((r) => r.winner === 'ours').reduce((t, r) => t + r.their.tr, 0) / Math.max(1, w)).toFixed(2)}`);
}

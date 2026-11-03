// Our best response: each six's Hex-weighted win rate vs h01-h20 (screen dir) and its average / worst vs Hex's counters
// (br dir). Both heuristic, closed. node docs/research/strategy/sim/scripts/hex-br.mjs <screenDir> <brDir> [top=20]
import { readFileSync, readdirSync, existsSync } from 'node:fs';
const [sDir, bDir] = process.argv.slice(2, 4), TOP = Number(process.argv[4] ?? 20);
const C = JSON.parse(readFileSync('tools/sim/candidates/hexpov.json', 'utf8'));
const W = Object.fromEntries(JSON.parse(readFileSync('tools/sim/candidates/hex.json', 'utf8')).opponent.teams.map((t) => [t.id, t.weight]));
const label = Object.fromEntries(C.ours.teams.map((t) => [t.id, t.label]));
const read = (f) => (existsSync(f) ? readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const byTeam = (recs) => { const m = {}; for (const r of recs) { const e = (m[r.theirs] ??= [0, 0]); e[0] += r.winner === 'ours' ? 1 : r.winner === 'tie' ? 0.5 : 0; e[1]++; } return m; };
const rows = [];
for (const f of readdirSync(bDir).filter((x) => x.endsWith('.jsonl'))) {
  const id = f.replace('.jsonl', '');
  const b = byTeam(read(`${bDir}/${f}`)), s = byTeam(read(`${sDir}/${f}`));
  const bv = Object.values(b).map(([w, n]) => w / n);
  const sw = Object.entries(s).reduce((t, [h, [w, n]]) => t + (W[h] ?? 0) * (w / n), 0) / (Object.keys(s).reduce((t, h) => t + (W[h] ?? 0), 0) || 1);
  if (bv.length < 7 || !Object.keys(s).length) continue;
  const avg = bv.reduce((a, x) => a + x, 0) / bv.length;
  rows.push({ id, likely: sw, counters: avg, worst: Math.min(...bv), worstVs: Object.keys(b)[bv.indexOf(Math.min(...bv))], score: (sw + avg) / 2 });
}
rows.sort((a, b) => b.score - a.score);
const p = (x) => `${(100 * x).toFixed(0)}%`.padStart(5);
console.log(`${rows.length} sixes. likely = weighted vs h01-h20; counters = average vs Hex's 7 counters; score = mean of the two\n`);
for (const r of rows.slice(0, TOP)) console.log(`${r.id} score${p(r.score)}  likely${p(r.likely)}  counters${p(r.counters)}  worst${p(r.worst)} (${r.worstVs})  ${label[r.id]}`);
for (const id of ['s119', 's117', 's110', 's001', 'k001', 'k009']) { const r = rows.find((x) => x.id === id); if (r) console.log(`#${rows.indexOf(r) + 1} ${id} score${p(r.score)}  likely${p(r.likely)}  counters${p(r.counters)}  worst${p(r.worst)} (${r.worstVs})`); }

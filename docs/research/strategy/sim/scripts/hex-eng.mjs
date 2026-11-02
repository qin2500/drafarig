// Hex engine runs: Hex-weighted win rate per six (±95%), paired difference vs a reference six, errors / timeouts.
//   node docs/research/strategy/sim/scripts/hex-eng.mjs <results dir> [reference six id]
import { readFileSync, readdirSync } from 'node:fs';
const ROOT = new URL('../../../../../', import.meta.url).pathname;
const [DIR, REF] = process.argv.slice(2);
const C = JSON.parse(readFileSync(`${ROOT}tools/sim/candidates/hex.json`, 'utf8'));
const wt = Object.fromEntries(C.opponent.teams.map((t) => [t.id, t.weight]));
const label = Object.fromEntries(C.ours.teams.map((t) => [t.id, t.label]));
const D = {};
for (const f of readdirSync(DIR).filter((f) => f.endsWith('.jsonl'))) D[f.replace('.jsonl', '')] = readFileSync(`${DIR}/${f}`, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
const rate = (g) => { const by = {}; for (const r of g.filter((r) => r.winner)) { (by[r.theirs] ??= { w: 0, n: 0 }).n++; if (r.winner === 'ours') by[r.theirs].w++; } let e = 0, s = 0, v = 0; for (const [k, x] of Object.entries(by)) { const p = x.w / x.n; e += wt[k] * p; s += wt[k]; v += wt[k] ** 2 * p * (1 - p) / x.n; } return { r: 100 * e / s, ci: 196 * Math.sqrt(v) / s, by }; };
// paired: same seed = same Hex team, persona and dice; weight each pair by its team's weight / that team's pair count
const pair = (g, b) => {
  const B = new Map(b.filter((r) => r.winner).map((r) => [r.seed, r])), P = g.filter((r) => r.winner && B.has(r.seed));
  const n = {}; for (const r of P) n[r.theirs] = (n[r.theirs] ?? 0) + 1;
  let m = 0, ws = 0; const d = P.map((r) => { const w = wt[r.theirs] / n[r.theirs], x = (r.winner === 'ours') - (B.get(r.seed).winner === 'ours'); m += w * x; ws += w; return [w, x]; });
  m /= ws; const v = d.reduce((t, [w, x]) => t + (w / ws) ** 2 * (x - m) ** 2, 0);
  return `${m >= 0 ? '+' : ''}${(100 * m).toFixed(1)} ±${(196 * Math.sqrt(v)).toFixed(1)} (n=${P.length})`;
};
const rows = Object.entries(D).map(([id, g]) => ({ id, g, ...rate(g) })).sort((a, b) => b.r - a.r);
for (const x of rows) console.log(`${x.id} ${x.r.toFixed(1).padStart(5)}% ±${x.ci.toFixed(1)}  n=${x.g.filter((r) => r.winner).length}/${x.g.length}  errors ${x.g.reduce((t, r) => t + (r.errors ?? 0), 0)}${REF && D[REF] && x.id !== REF ? `  vs ${REF} ${pair(x.g, D[REF])}` : ''}  ${label[x.id]}`);

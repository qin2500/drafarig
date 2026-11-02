// Week 4 screen: every six of Anthony's 10 (s001-s210) vs Hex h01-h20, 100 paired games each (closed sheets, AI preview).
//   node docs/research/strategy/sim/scripts/hex-screen.mjs [results dir]
// Prints: the top sixes by Hex-weighted win rate, and each Pokémon's marginal value (linear probability model over every
// game: win ~ intercept + one indicator per Pokémon (Charizard's Mega vs Kangaskhan's goes with Charizard) + per-team
// fixed effects; least squares by normal equations). Weighted rate = sum over Hex teams of weight × that team's win rate.
import { readFileSync, readdirSync } from 'node:fs';
const ROOT = new URL('../../../../../', import.meta.url).pathname;
const DIR = process.argv[2] ?? `${ROOT}tools/sim/results/hex/screen`;
const C = JSON.parse(readFileSync(`${ROOT}tools/sim/candidates/hex.json`, 'utf8'));
const wt = Object.fromEntries(C.opponent.teams.map((t) => [t.id, t.weight]));
const ours = Object.fromEntries(C.ours.teams.map((t) => [t.id, t]));
const MONS = ['zardY', 'aegis', 'kanga', 'morpeko', 'sinis', 'conk', 'rotom', 'stunfisk', 'pelipper', 'simipour'];
const has = (id, k) => ours[id].sets.some((s) => s === k || (k === 'kanga' && s === 'kangaM'));
const rows = [];
for (const f of readdirSync(DIR).filter((f) => f.endsWith('.jsonl'))) {
  for (const l of readFileSync(`${DIR}/${f}`, 'utf8').trim().split('\n')) { if (!l) continue; const r = JSON.parse(l); if (r.winner) rows.push(r); }
}
// per six
const by = {};
for (const r of rows) { const s = (by[r.ours] ??= {}); const t = (s[r.theirs] ??= { w: 0, n: 0 }); t.n++; if (r.winner === 'ours') t.w++; }
const rate = (s) => { let e = 0, ws = 0, v = 0, n = 0; for (const [k, x] of Object.entries(s)) { const p = x.w / x.n; e += wt[k] * p; ws += wt[k]; v += wt[k] ** 2 * p * (1 - p) / x.n; n += x.n; } return { r: 100 * e / ws, ci: 196 * Math.sqrt(v) / ws, n }; };
const table = Object.entries(by).map(([id, s]) => ({ id, label: ours[id].label, ...rate(s) })).sort((a, b) => b.r - a.r);
console.log(`${rows.length} games, ${table.length} sixes\n\nTop 25 (Hex-weighted win rate, ±95%):`);
for (const t of table.slice(0, 25)) console.log(`${t.id} ${t.r.toFixed(1).padStart(5)}% ±${t.ci.toFixed(1)}  n=${t.n}  ${t.label}`);
console.log('\nBottom 5:'); for (const t of table.slice(-5)) console.log(`${t.id} ${t.r.toFixed(1).padStart(5)}%  ${t.label}`);
// linear probability model with team fixed effects, weighted by Hex team weight / team game count
const teams = Object.keys(wt), P = MONS.length - 1 + teams.length; // drop one mon (collinear: always 6 of 10) → simipour baseline
const X = (r) => [...MONS.slice(0, -1).map((k) => (has(r.ours, k) ? 1 : 0)), ...teams.map((t) => (r.theirs === t ? 1 : 0))];
const nT = {}; for (const r of rows) nT[r.theirs] = (nT[r.theirs] ?? 0) + 1;
const A = Array.from({ length: P }, () => new Float64Array(P)), b = new Float64Array(P);
for (const r of rows) { const x = X(r), w = wt[r.theirs] / nT[r.theirs], y = r.winner === 'ours' ? 1 : 0; for (let i = 0; i < P; i++) { if (!x[i]) continue; b[i] += w * x[i] * y; for (let j = 0; j < P; j++) if (x[j]) A[i][j] += w * x[i] * x[j]; } }
// solve A beta = b (Gauss-Jordan)
const M = A.map((row, i) => [...row, b[i]]);
for (let c = 0; c < P; c++) { let p = c; for (let r = c + 1; r < P; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r; [M[c], M[p]] = [M[p], M[c]]; const d = M[c][c]; for (let j = c; j <= P; j++) M[c][j] /= d; for (let r = 0; r < P; r++) if (r !== c && M[r][c]) { const f = M[r][c]; for (let j = c; j <= P; j++) M[r][j] -= f * M[c][j]; } }
const beta = M.map((r) => r[P]);
// marginal value in points relative to the mean of the ten (sum-to-zero view): beta_k - mean(beta incl. baseline 0)
const raw = [...MONS.slice(0, -1).map((_, i) => beta[i]), 0], mean = raw.reduce((s, x) => s + x, 0) / raw.length;
console.log('\nMarginal value of each Pokémon (points of weighted win rate vs the average member; 6-of-10 regression, team fixed effects):');
for (const [k, v] of MONS.map((k, i) => [k, raw[i] - mean]).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(9)} ${(100 * v >= 0 ? '+' : '') + (100 * v).toFixed(1)}`);
// per Hex team: the best six's rate and the average
console.log('\nPer Hex team (average over all sixes / best six):');
for (const t of teams) { const xs = table.map((s) => by[s.id][t]).filter(Boolean).map((x) => x.w / x.n); console.log(`  ${t} w ${(100 * wt[t]).toFixed(1)}%  avg ${(100 * xs.reduce((a, c) => a + c, 0) / xs.length).toFixed(0)}%  ${C.opponent.teams.find((x) => x.id === t).label}`); }

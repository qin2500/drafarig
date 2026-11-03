// Solve a zero-sum team-choice game from engine results: rows = our sixes, columns = their sixes, cell = our win rate.
// Reads <dir>/<ours>.jsonl files (each vs several of their teams). Prints the matrix, each side's equilibrium mix
// (fictitious play, 200k iterations), the game value, and each pure six's worst case.
// node docs/research/strategy/sim/scripts/matrix-game.mjs <dir>
import { readFileSync, readdirSync } from 'node:fs';
const dir = process.argv[2];
const ours = readdirSync(dir).filter((f) => f.endsWith('.jsonl')).map((f) => f.replace('.jsonl', '')).sort();
const cell = {};
const theirSet = new Set();
for (const o of ours) for (const l of readFileSync(`${dir}/${o}.jsonl`, 'utf8').trim().split('\n')) {
  if (!l) continue;
  const r = JSON.parse(l); theirSet.add(r.theirs);
  const e = ((cell[o] ??= {})[r.theirs] ??= [0, 0]);
  e[0] += r.winner === 'ours' ? 1 : r.winner === 'tie' ? 0.5 : 0; e[1]++;
}
const theirs = [...theirSet].sort();
const M = ours.map((o) => theirs.map((t) => { const e = cell[o]?.[t]; return e && e[1] ? e[0] / e[1] : NaN; }));
const n = ours.map((o) => theirs.map((t) => cell[o]?.[t]?.[1] ?? 0));
console.log('our win % (games)'.padEnd(18) + theirs.map((t) => t.padStart(9)).join(''));
ours.forEach((o, i) => console.log(o.padEnd(18) + theirs.map((_, j) => `${(100 * M[i][j]).toFixed(0)}(${n[i][j]})`.padStart(9)).join('')));
if (M.flat().some(Number.isNaN)) { console.log('missing cells; not solving'); process.exit(0); }
// fictitious play
const R = ours.length, Cn = theirs.length, cr = new Array(R).fill(0), cc = new Array(Cn).fill(0);
const rowPay = new Array(R).fill(0), colPay = new Array(Cn).fill(0);
let r = 0, c = 0;
const IT = 200000;
for (let k = 0; k < IT; k++) {
  cr[r]++; cc[c]++;
  for (let i = 0; i < R; i++) rowPay[i] += M[i][c];
  for (let j = 0; j < Cn; j++) colPay[j] += M[r][j];
  r = rowPay.indexOf(Math.max(...rowPay)); c = colPay.indexOf(Math.min(...colPay));
}
const x = cr.map((v) => v / IT), y = cc.map((v) => v / IT);
const lo = Math.min(...theirs.map((_, j) => x.reduce((t, xi, i) => t + xi * M[i][j], 0)));
const hi = Math.max(...ours.map((_, i) => y.reduce((t, yj, j) => t + yj * M[i][j], 0)));
console.log(`\ngame value (our win %): ${(100 * lo).toFixed(1)}–${(100 * hi).toFixed(1)}`);
console.log('our mix:   ' + ours.map((o, i) => [o, x[i]]).filter(([, v]) => v > 0.01).map(([o, v]) => `${o} ${(100 * v).toFixed(0)}%`).join(', '));
console.log('their mix: ' + theirs.map((t, j) => [t, y[j]]).filter(([, v]) => v > 0.01).map(([t, v]) => `${t} ${(100 * v).toFixed(0)}%`).join(', '));
console.log('\neach of ours: worst case (their best reply) / vs their mix');
ours.forEach((o, i) => { const w = Math.min(...M[i]); console.log(`  ${o.padEnd(8)} ${(100 * w).toFixed(0)}% (vs ${theirs[M[i].indexOf(w)]}) / ${(100 * y.reduce((t, yj, j) => t + yj * M[i][j], 0)).toFixed(0)}%`); });

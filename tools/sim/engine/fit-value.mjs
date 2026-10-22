// Fit the engine's value function from its own games (the learning half of the engine).
//   node tools/sim/engine/fit-value.mjs out.json results/a.jsonl [results/b.jsonl …]
// Data: every decision an engine player recorded (run.mjs --record): the position's features from that side's point
// of view, labelled 1 if that side went on to win. Model: logistic regression with an L2 penalty (Newton's method), no
// intercept (features are "mine − theirs", so the model is symmetric between the sides). Games with an even seed are
// held out to report out-of-sample log loss and accuracy against the baseline: the heuristic's own value as the only
// feature. actionScale (the heuristic value → logit factor) converts the action costs the leaf keeps.
import { readFileSync, writeFileSync } from 'node:fs';
import { LEARNED_PARTS, FEATURES } from './value.mjs';

const [out, ...files] = process.argv.slice(2);
const rows = [];
for (const f of files) for (const line of readFileSync(f, 'utf8').trim().split('\n')) {
  const r = JSON.parse(line);
  if (!r.engine || r.winner === 'tie') continue;
  for (const [side, won] of [['ours', r.winner === 'ours'], ['theirs', r.winner === 'theirs']]) {
    for (const d of r.engine[side]?.record ?? []) rows.push({ x: [...d.parts, ...d.ps], y: won ? 1 : 0, hold: r.seed % 2 === 0, h: heur(d.parts) });
  }
}
// the heuristic value (balanced style) from its parts: own − opp + field terms + threat
function heur(p) { const P = Object.fromEntries(LEARNED_PARTS.map((k, i) => [k, p[i]])); return P.own - P.opp + P.trickRoom + P.tailwind + P.screens + P.sun + P.threat; }

const sig = (z) => 1 / (1 + Math.exp(-z));
function fit(X, y, lambda = 1) {
  const d = X[0].length;
  let w = new Array(d).fill(0);
  for (let it = 0; it < 30; it++) {
    const g = new Array(d).fill(0), H = Array.from({ length: d }, () => new Array(d).fill(0));
    for (let n = 0; n < X.length; n++) {
      const x = X[n]; let z = 0; for (let i = 0; i < d; i++) z += w[i] * x[i];
      const p = sig(z), r = p - y[n], s = p * (1 - p);
      for (let i = 0; i < d; i++) { g[i] += r * x[i]; for (let j = 0; j < d; j++) H[i][j] += s * x[i] * x[j]; }
    }
    for (let i = 0; i < d; i++) { g[i] += lambda * w[i]; H[i][i] += lambda; }
    const step = solve(H, g);
    w = w.map((v, i) => v - step[i]);
    if (Math.max(...step.map(Math.abs)) < 1e-6) break;
  }
  return w;
}
function solve(A, b) { // Gaussian elimination with partial pivoting
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let r = 0; r < n; r++) { if (r === c || !M[c][c]) continue; const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((r, i) => r[n] / (r[i] || 1));
}
const evalSet = (X, y, w) => {
  let ll = 0, acc = 0;
  for (let n = 0; n < X.length; n++) { let z = 0; for (let i = 0; i < w.length; i++) z += w[i] * X[n][i]; const p = Math.min(1 - 1e-9, Math.max(1e-9, sig(z))); ll -= y[n] ? Math.log(p) : Math.log(1 - p); acc += (p > 0.5) === !!y[n] ? 1 : 0; }
  return { logloss: +(ll / X.length).toFixed(4), accuracy: +(acc / X.length).toFixed(4) };
};
const train = rows.filter((r) => !r.hold), test = rows.filter((r) => r.hold);
const w = fit(train.map((r) => r.x), train.map((r) => r.y));
const wh = fit(train.map((r) => [r.h]), train.map((r) => r.y), 0.01);
const res = {
  written: new Date().toISOString(), files, n: { train: train.length, test: test.length },
  parts: Object.fromEntries(LEARNED_PARTS.map((k, i) => [k, +w[i].toFixed(4)])),
  ps: Object.fromEntries(FEATURES.map((k, i) => [k, +w[LEARNED_PARTS.length + i].toFixed(4)])),
  actionScale: +wh[0].toFixed(4),
  test: { learned: evalSet(test.map((r) => r.x), test.map((r) => r.y), w), heuristic: evalSet(test.map((r) => [r.h]), test.map((r) => r.y), wh) },
  train: { learned: evalSet(train.map((r) => r.x), train.map((r) => r.y), w) },
};
writeFileSync(out, JSON.stringify(res, null, 1));
console.log(JSON.stringify({ n: res.n, test: res.test, actionScale: res.actionScale, parts: res.parts, ps: res.ps }, null, 1));

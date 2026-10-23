// Train the value network on the engine's self-play games (run.mjs --record, engine players).
//   node tools/sim/engine/train-value.mjs out.json [--hidden 64,32] [--epochs 30] results/a.jsonl …
// Every recorded decision is one example: the position's encoding (encode.mjs) from that side, labelled 1 if that side
// won. Games with seed % 5 === 0 are held out. Reported against the baseline the network must beat: a logistic fit of the
// result on the heuristic value alone (its fitted slope also becomes actionScale, the logit per heuristic unit for the
// action costs the leaf keeps).
import { readFileSync, writeFileSync } from 'node:fs';
import { MLP } from './net.mjs';
import { ENC_SIZE } from './encode.mjs';
import { LEARNED_PARTS } from './value.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const hidden = opt('hidden', '64,32').split(',').map(Number), epochs = Number(opt('epochs', 30)), lr = Number(opt('lr', 1e-3));
const [out, ...files] = args;
const X = [], y = [], Xv = [], yv = [], hv = [], h = [];
const heur = (p) => { const P = Object.fromEntries(LEARNED_PARTS.map((k, i) => [k, p[i]])); return P.own - P.opp + P.trickRoom + P.tailwind + P.screens + P.sun + P.threat; };
let games = 0;
for (const f of files) for (const line of readFileSync(f, 'utf8').trim().split('\n')) {
  const r = JSON.parse(line);
  if (!r.engine || r.winner === 'tie') continue;
  games++;
  const hold = r.seed % 5 === 0;
  for (const [side, won] of [['ours', r.winner === 'ours'], ['theirs', r.winner === 'theirs']]) {
    for (const d of r.engine[side]?.record ?? []) {
      if (!d.enc || d.enc.length !== ENC_SIZE) continue;
      (hold ? Xv : X).push(Float32Array.from(d.enc)); (hold ? yv : y).push(won ? 1 : 0); (hold ? hv : h).push(heur(d.parts));
    }
  }
}
console.log(`games ${games}, examples train ${X.length} / held out ${Xv.length}, inputs ${ENC_SIZE}, layers ${[ENC_SIZE, ...hidden, 1].join('-')}`);
// baseline: 1-feature logistic on the heuristic value (gradient descent)
let a = 0;
for (let it = 0; it < 300; it++) { let g = 0; for (let i = 0; i < h.length; i++) g += (1 / (1 + Math.exp(-a * h[i])) - y[i]) * h[i]; a -= 0.5 * g / h.length; }
const ll = (z, t) => { const p = 1 / (1 + Math.exp(-z)); return -(t ? Math.log(p + 1e-9) : Math.log(1 - p + 1e-9)); };
const base = hv.reduce((s, v, i) => s + ll(a * v, yv[i]), 0) / hv.length;
const baseAcc = hv.reduce((s, v, i) => s + ((a * v > 0) === !!yv[i] ? 1 : 0), 0) / hv.length;
const net = new MLP([ENC_SIZE, ...hidden, 1], 11);
const t0 = performance.now();
const res = net.train(X, y, Xv, yv, { epochs, lr, log: (e) => console.log(`  epoch ${e.epoch}: train ${e.train} held-out ${e.val}`) });
const acc = net.accuracy(Xv, yv);
const report = { games, train: X.length, test: Xv.length, net: { logloss: res.best.val, accuracy: +acc.toFixed(4), epoch: res.best.epoch }, heuristic: { logloss: +base.toFixed(4), accuracy: +baseAcc.toFixed(4) }, actionScale: +a.toFixed(4), minutes: +((performance.now() - t0) / 60000).toFixed(1) };
writeFileSync(out, JSON.stringify(net.toJSON({ ...report, files, hidden, written: new Date().toISOString(), actionScale: report.actionScale })));
console.log(JSON.stringify(report, null, 1));

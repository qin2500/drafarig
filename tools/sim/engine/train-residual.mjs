// Train a residual value network: the leaf's logit is actionScale × (the heuristic value) + net(position), so the network
// learns only what the hand-made value gets wrong, and a fresh network (output layer zeroed) plays exactly like the
// original engine. Built to generalize, after net1–3 memorized their training teams (best epoch 1 of 30):
//   - held out by TEAM, not by seed: a game is a validation game when either six is in the held-out ninth of teams, so
//     the validation score measures play on teams the network has never seen;
//   - at most --per decisions per side per game (default 8): decisions in one game share one result, so taking every
//     one of them overweights long games and lets the network memorize them;
//   - early stopping (--patience epochs without a better validation loss) and L2.
//   node tools/sim/engine/train-residual.mjs out.json [--hidden 64,32] [--epochs 40] [--per 8] [--patience 3] files.jsonl…
import { readFileSync, writeFileSync } from 'node:fs';
import { MLP } from './net.mjs';
import { ENC_SIZE } from './encode.mjs';
import { LEARNED_PARTS } from './value.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const hidden = opt('hidden', '64,32').split(',').map(Number), epochs = Number(opt('epochs', 40)), lr = Number(opt('lr', 1e-3));
const per = Number(opt('per', 8)), patience = Number(opt('patience', 3)), l2 = Number(opt('l2', 3e-4));
const [out, ...files] = args;

// the heuristic value at a recorded position, in its own units (balanced style: what the engine's leaf uses)
const heur = (p) => { const P = Object.fromEntries(LEARNED_PARTS.map((k, i) => [k, p[i]])); return P.own - P.opp + P.trickRoom + P.tailwind + P.screens + P.sun + P.threat; };
const hash = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const heldTeam = (ref) => hash(ref) % 9 === 0;
const pickEvenly = (list, k, seed) => {
  if (list.length <= k) return list;
  const step = list.length / k, off = (seed % 1000) / 1000 * step;
  return Array.from({ length: k }, (_, i) => list[Math.min(list.length - 1, Math.floor(off + i * step))]);
};

const T = { X: [], y: [], h: [] }, V = { X: [], y: [], h: [] };
let games = 0, gamesV = 0;
for (const f of files) for (const line of readFileSync(f, 'utf8').trim().split('\n')) {
  if (!line) continue;
  const r = JSON.parse(line);
  if (!r.engine || r.winner === 'tie' || r.errors > 0) continue;
  const val = heldTeam(r.ours) || heldTeam(r.theirs);
  const D = val ? V : T;
  val ? gamesV++ : games++;
  for (const [side, won] of [['ours', r.winner === 'ours'], ['theirs', r.winner === 'theirs']]) {
    const recs = (r.engine[side]?.record ?? []).filter((d) => d.enc?.length === ENC_SIZE);
    for (const d of pickEvenly(recs, per, r.seed)) { D.X.push(Float32Array.from(d.enc)); D.y.push(won ? 1 : 0); D.h.push(heur(d.parts)); }
  }
}
console.log(`games train ${games} / held-out teams ${gamesV}; examples ${T.X.length} / ${V.X.length}; layers ${[ENC_SIZE, ...hidden, 1].join('-')}`);
if (!T.X.length || !V.X.length) { console.log('not enough data'); process.exit(2); }

// the base: logistic fit of the result on the heuristic value (slope a = logits per heuristic unit)
let a = 0;
for (let it = 0; it < 300; it++) { let g = 0; for (let i = 0; i < T.h.length; i++) g += (1 / (1 + Math.exp(-a * T.h[i])) - T.y[i]) * T.h[i]; a -= 0.5 * g / T.h.length; }
const off = T.h.map((v) => a * v), offv = V.h.map((v) => a * v);
const net = new MLP([ENC_SIZE, ...hidden, 1], 11).zeroOutput();
const base = { logloss: +net.loss(V.X, V.y, offv).toFixed(4), accuracy: +net.accuracy(V.X, V.y, offv).toFixed(4) };
const t0 = performance.now();
const res = net.train(T.X, T.y, V.X, V.y, { epochs, lr, l2, off, offv, patience, log: (e) => console.log(`  epoch ${e.epoch}: train ${e.train} held-out ${e.val}`) });
const report = { games, gamesHeldOut: gamesV, train: T.X.length, test: V.X.length, net: { logloss: res.best.val, accuracy: +net.accuracy(V.X, V.y, offv).toFixed(4), epoch: res.best.epoch },
  heuristic: base, gain: +(base.logloss - res.best.val).toFixed(4), actionScale: +a.toFixed(4), minutes: +((performance.now() - t0) / 60000).toFixed(1) };
writeFileSync(out, JSON.stringify(net.toJSON({ ...report, residual: true, files, hidden, per, written: new Date().toISOString() })));
console.log(JSON.stringify(report, null, 1));

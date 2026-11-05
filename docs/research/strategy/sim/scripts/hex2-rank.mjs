// Hex round 2: rank our sixes from a results dir of <id>.jsonl (vs h01..h20). Three views, none favoured over the others:
//   weighted  = win rate weighted by Hex's six weights (hex.json h01-h20)
//   KR        = vs his sixes with Kleavor + Rotom-Heat (what beat the mock)
//   psy       = vs his Indeedee-F + Armarouge sixes (Psychic spam, still his strongest plan)
//   min       = the worst of the three (a six must hold up against both plans)
// node docs/research/strategy/sim/scripts/hex2-rank.mjs tools/sim/results/hex2/screen [top]
import { readFileSync, readdirSync } from 'node:fs';
const ROOT = new URL('../../../../../', import.meta.url).pathname;
const dir = process.argv[2], top = Number(process.argv[3] ?? 25);
const C = JSON.parse(readFileSync(`${ROOT}tools/sim/candidates/hex2.json`, 'utf8'));
const H = Object.fromEntries(C.opponent.teams.filter((t) => /^h\d\d$/.test(t.id)).map((t) => [t.id, t]));
const has = (t, s) => new RegExp(`^${s}`, 'm').test(t.team);
const KR = new Set(Object.keys(H).filter((id) => has(H[id], 'Kleavor') && has(H[id], 'Rotom-Heat')));
const PSY = new Set(Object.keys(H).filter((id) => has(H[id], 'Indeedee') && has(H[id], 'Armarouge')));
const label = Object.fromEntries(C.ours.teams.map((t) => [t.id, t.label]));
const rows = [];
for (const f of readdirSync(`${ROOT}${dir}`).filter((x) => x.endsWith('.jsonl'))) {
  const recs = readFileSync(`${ROOT}${dir}/${f}`, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  if (!recs.length) continue;
  const by = {};
  for (const r of recs) { const b = (by[r.theirs] ??= [0, 0]); b[1]++; if (r.winner === 'ours') b[0]++; else if (r.winner === 'tie') b[0] += 0.5; }
  const rate = (ids, w) => { let s = 0, n = 0; for (const id of ids) if (by[id]) { const k = w ? H[id].weight : 1; s += k * by[id][0] / by[id][1]; n += k; } return n ? s / n : NaN; };
  const ids = Object.keys(by).filter((id) => H[id]);
  const r = { id: f.replace('.jsonl', ''), n: recs.length, w: rate(ids, true), kr: rate(ids.filter((i) => KR.has(i))), psy: rate(ids.filter((i) => PSY.has(i))) };
  r.min = Math.min(r.w, r.kr, r.psy);
  rows.push(r);
}
rows.sort((a, b) => b.min - a.min || b.w - a.w);
const pc = (x) => (100 * x).toFixed(1).padStart(5);
console.log(`KR sixes: ${[...KR].join(' ')} | psy sixes: ${[...PSY].join(' ')}`);
console.log('id     n   weighted   KR   psy   min  six');
for (const r of rows.slice(0, top)) console.log(`${r.id.padEnd(5)} ${String(r.n).padStart(4)} ${pc(r.w)}  ${pc(r.kr)} ${pc(r.psy)} ${pc(r.min)}  ${label[r.id] ?? ''}`);

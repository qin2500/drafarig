// weighted win % per team file in a results dir, per-ZhuZi-team win %, and paired weighted deltas vs a base file
// usage (repo root): node docs/research/strategy/sim/scripts/sim-tables.mjs tools/sim/results/r5 a17 [ids...]   (PER=id,id prints per-team win %)
// "weighted" = ZhuZi team weights (tools/sim/candidates/zhuzi.json); "unweighted" = plain paired mean over games (same seed)
import { readFileSync, readdirSync, existsSync } from 'node:fs';
const ROOT = new URL('../../../../../', import.meta.url).pathname;
const C = JSON.parse(readFileSync(ROOT + 'tools/sim/candidates/zhuzi.json', 'utf8'));
const W = Object.fromEntries(C.opponent.teams.map((t) => [t.id, t.weight]));
const [dir, baseId, ...only] = process.argv.slice(2);
const load = (f) => readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((r) => r.winner);
const files = readdirSync(dir).filter((f) => f.endsWith('.jsonl')).map((f) => f.replace('.jsonl', '')).filter((f) => !only.length || only.includes(f) || f === baseId);
const base = existsSync(`${dir}/${baseId}.jsonl`) ? new Map(load(`${dir}/${baseId}.jsonl`).map((r) => [r.seed, r])) : null;
const win = (r) => (r.winner === 'ours' ? 1 : r.winner === 'tie' ? 0.5 : 0);
const out = [];
for (const id of files) {
  const R = load(`${dir}/${id}.jsonl`);
  const per = {};
  for (const r of R) { per[r.theirs] ??= { n: 0, w: 0, d: [] }; per[r.theirs].n++; per[r.theirs].w += win(r); const b = base?.get(r.seed); if (b && b.theirs === r.theirs) per[r.theirs].d.push(win(r) - win(b)); }
  let ws = 0, wsum = 0, dm = 0, dv = 0;
  for (const [z, p] of Object.entries(per)) {
    ws += W[z] * p.w / p.n; wsum += W[z];
    if (p.d.length > 1) { const m = p.d.reduce((t, x) => t + x, 0) / p.d.length; const v = p.d.reduce((t, x) => t + (x - m) ** 2, 0) / (p.d.length - 1); dm += W[z] * m; dv += W[z] ** 2 * v / p.d.length; }
  }
  const all = Object.values(per).flatMap((p) => p.d);
  const um = all.length ? all.reduce((t, x) => t + x, 0) / all.length : 0, uv = all.length > 1 ? all.reduce((t, x) => t + (x - um) ** 2, 0) / (all.length - 1) : 0;
  out.push({ id, n: R.length, ud: 100 * um, uci: all.length > 1 ? 196 * Math.sqrt(uv / all.length) : 0, wwin: 100 * ws / wsum, raw: 100 * R.reduce((t, r) => t + win(r), 0) / R.length, d: 100 * dm / wsum, ci: 196 * Math.sqrt(dv) / wsum, per: Object.fromEntries(Object.entries(per).map(([z, p]) => [z, Math.round(100 * p.w / p.n)])) });
}
out.sort((a, b) => b.wwin - a.wwin);
for (const o of out) console.log(`${o.id}\tn=${o.n}\tweighted ${o.wwin.toFixed(1)}\traw ${o.raw.toFixed(1)}\tvs ${baseId} ${o.id === baseId ? '—' : `weighted ${o.d >= 0 ? '+' : ''}${o.d.toFixed(1)} ±${o.ci.toFixed(1)} | unweighted ${o.ud >= 0 ? '+' : ''}${o.ud.toFixed(1)} ±${o.uci.toFixed(1)}`}`);
if (process.env.PER) for (const o of out.filter((o) => process.env.PER.split(',').includes(o.id))) console.log(o.id, JSON.stringify(o.per));

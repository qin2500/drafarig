// Our lead / bring win rates per guide-preview row (which of his sixes each row covers), pooled over result files:
//   node docs/research/strategy/sim/scripts/preview-clusters.mjs tools/sim/results/r4/a17x27.jsonl
import { readFileSync } from 'node:fs';
const C = JSON.parse(readFileSync(new URL('../../../../../tools/sim/candidates/zhuzi.json', import.meta.url), 'utf8'));
const six = Object.fromEntries(C.opponent.teams.map((t) => [t.id, t.sets.map((k) => k.replace(/_.*/, ''))]));
const has = (z, ...ks) => ks.every((k) => six[z].includes(k));
const cluster = (z) => has(z, 'meta', 'krook', 'nape') ? 'R1 Metagross+Krookodile+Infernape' : has(z, 'oran', 'tox') ? 'R2 Oranguru+Toxtricity' : has(z, 'king') ? 'R3 Slowking-G' : has(z, 'pult', 'umb') ? 'R4 Dragapult+Umbreon' : 'none';
const all = process.argv.slice(2).flatMap((f) => readFileSync(f, 'utf8').trim().split('\n').map((l) => JSON.parse(l))).filter((r) => r.winner);
const by = {};
for (const r of all) { const c = cluster(r.theirs); by[c] ??= []; by[c].push(r); }
for (const [c, R] of Object.entries(by)) {
  const w = R.filter((r) => r.winner === 'ours').length;
  console.log(`\n=== ${c} (${[...new Set(R.map((r) => r.theirs))].sort().join(',')}): ${w}/${R.length} = ${(100 * w / R.length).toFixed(0)}%`);
  const cnt = (f, min = 15) => { const o = {}; for (const r of R) { const k = f(r); o[k] ??= [0, 0]; o[k][0]++; o[k][1] += r.winner === 'ours'; } return Object.entries(o).filter(([, [n]]) => n >= min).sort((a, b) => b[1][0] - a[1][0]).slice(0, 7).map(([k, [n, x]]) => `${k} ${(100 * x / n).toFixed(0)}% (n=${n})`).join(' · '); };
  console.log('  lead: ' + cnt((r) => [...r.our.leads].sort().join('+')));
  console.log('  bring: ' + cnt((r) => [...r.our.brought].sort().join('/')));
  console.log('  lead|back: ' + cnt((r) => `${[...r.our.leads].sort().join('+')} | ${r.our.brought.filter((s) => !r.our.leads.includes(s)).sort().join('/')}`, 20));
}

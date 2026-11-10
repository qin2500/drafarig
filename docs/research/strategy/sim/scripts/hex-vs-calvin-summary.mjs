// Summarise a directory of hex-vs-calvin runs: per Hex six, wins / n, Wilson 95% CI, per-Calvin-six win rate; sorted.
//   node docs/research/strategy/sim/scripts/hex-vs-calvin-summary.mjs <dir> [top N] [--paired <baseId>]
// --paired: for every six, the paired difference vs <baseId> on the same game indices (mean ± 1.96 SE).
import { readdirSync, readFileSync } from 'node:fs';
const [dir, topArg] = process.argv.slice(2);
const pIx = process.argv.indexOf('--paired'), base = pIx > 0 ? process.argv[pIx + 1] : null;
const C = JSON.parse(readFileSync('tools/sim/candidates/hex-vs-calvin.json', 'utf8'));
const label = Object.fromEntries(C.ours.teams.map((t) => [t.id, t.label]));
const wilson = (k, n, z = 1.96) => { const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), r = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)); return [(c - r) / d, (c + r) / d]; };
const runs = {};
for (const f of readdirSync(dir).filter((f) => f.endsWith('.jsonl'))) {
  const games = readFileSync(`${dir}/${f}`, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
  runs[f.replace('.jsonl', '')] = new Map(games.map((g) => [g.i, g]));
}
const rows = Object.entries(runs).map(([id, m]) => {
  const g = [...m.values()], k = g.filter((x) => x.winner === 'ours').length, n = g.length;
  const by = {};
  for (const x of g) { const t = x.theirs; by[t] ??= [0, 0]; by[t][1]++; if (x.winner === 'ours') by[t][0]++; }
  const errors = g.reduce((a, x) => a + (x.errors || 0), 0);
  let paired = '';
  if (base && runs[base] && id !== base) {
    const d = g.filter((x) => runs[base].has(x.i)).map((x) => (x.winner === 'ours') - (runs[base].get(x.i).winner === 'ours'));
    const mu = d.reduce((a, b) => a + b, 0) / d.length, sd = Math.sqrt(d.reduce((a, b) => a + (b - mu) ** 2, 0) / (d.length - 1));
    paired = `  vs ${base}: ${(100 * mu).toFixed(1)} ±${(196 * sd / Math.sqrt(d.length)).toFixed(1)} (n=${d.length})`;
  }
  return { id, k, n, p: k / n, ci: wilson(k, n), by, errors, paired };
}).sort((a, b) => b.p - a.p);
for (const r of rows.slice(0, Number(topArg) || rows.length)) {
  const by = Object.entries(r.by).sort().map(([t, [k, n]]) => `${t} ${k}/${n}`).join(' ');
  console.log(`${r.id}\t${(100 * r.p).toFixed(1)}%\t(${r.k}/${r.n}, ${(100 * r.ci[0]).toFixed(0)}–${(100 * r.ci[1]).toFixed(0)})${r.errors ? ` ERR ${r.errors}` : ''}${r.paired}\t${label[r.id] ?? ''}\n\t\t${by}`);
}

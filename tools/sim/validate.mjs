// Validation summary from the runner's JSONL files (tools/sim/results/): (b) heuristic vs RandomPlayerAI, (c) mirror
// matches, (d) Trick Room teams set Trick Room, the review metrics (ai-review.md) per batch, and the pilot (a01 vs
// z01..z24 under the AI and the guide preview policies, paired by seed). Run the games first: sh tools/sim/validate.sh [pilot]
import { readFileSync, existsSync } from 'node:fs';
import { wilson, metrics } from './run.mjs';

const load = (f) => (existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const pct = (x) => `${(100 * x).toFixed(1)}%`;
const wins = (recs) => recs.filter((r) => r.winner === 'ours').length + 0.5 * recs.filter((r) => r.winner === 'tie').length;
const rate = (recs, label) => {
  if (!recs.length) return;
  const n = recs.length, k = wins(recs);
  const [lo, hi] = wilson(k, n);
  console.log(`\n${label}: ours ${k}/${n} = ${pct(k / n)} (95% CI ${pct(lo)}–${pct(hi)}); avg ${(recs.reduce((t, r) => t + r.turns, 0) / n).toFixed(1)} turns; errors ${recs.reduce((t, r) => t + (r.errors ?? 0), 0)}; ${(recs.reduce((t, r) => t + r.ms, 0) / n / 1000).toFixed(2)} s/game in a worker`);
  for (const l of metrics(recs)) console.log(`  ${l}`);
};
const R = 'tools/sim/results/';
rate(load(`${R}validate-vs-random.jsonl`), '(b) heuristic vs random');
rate(load(`${R}validate-mirror-a01.jsonl`), '(c) mirror a01 vs a01');
rate(load(`${R}validate-mirror-z01.jsonl`), '(c) mirror z01 vs z01');
rate(load(`${R}validate-tr-style.jsonl`), '(d) a01 vs the Trick Room teams z04, z15, z23 (personas at their shares)');
const fast = load(`${R}validate-tr-vs-fast.jsonl`);
if (fast.length) {
  const SETTERS = ['oranguru', 'slowkinggalar', 'sinistcha'];
  const fw = fast.filter((r) => r.our.brought.some((s) => SETTERS.includes(s))), fs = fw.filter((r) => r.our.tr > 0);
  const [flo, fhi] = wilson(fs.length, fw.length);
  console.log(`\n(d) Trick Room teams (calc policy) vs the fast team z24: set Trick Room in ${fs.length}/${fw.length} = ${pct(fs.length / (fw.length || 1))} (95% CI ${pct(flo)}–${pct(fhi)})`);
}
// pilot: both preview policies on the same seeds, overall and per opponent team
const pa = load(`${R}pilot-ai.jsonl`), pg = load(`${R}pilot-guide.jsonl`);
if (pa.length || pg.length) {
  rate(pa, 'PILOT a01 vs z01..z24, AI preview (lead lookahead)');
  rate(pg, 'PILOT a01 vs z01..z24, guide preview (lib/guides/5v3.mjs table; AI where the table has no row)');
  const byI = new Map(pg.map((r) => [r.i, r]));
  const paired = pa.filter((r) => byI.has(r.i));
  const diff = paired.map((r) => (r.winner === 'ours' ? 1 : r.winner === 'tie' ? 0.5 : 0) - (byI.get(r.i).winner === 'ours' ? 1 : byI.get(r.i).winner === 'tie' ? 0.5 : 0));
  const mean = diff.reduce((t, x) => t + x, 0) / (diff.length || 1);
  const sd = Math.sqrt(diff.reduce((t, x) => t + (x - mean) ** 2, 0) / Math.max(1, diff.length - 1));
  console.log(`\nAI − guide preview, paired by seed (${diff.length} games): ${(100 * mean).toFixed(1)} points (95% CI ±${(196 * sd / Math.sqrt(diff.length || 1)).toFixed(1)})`);
  const ids = [...new Set(pa.map((r) => r.theirs))].sort();
  console.log('per opponent team (ours win %, AI preview / guide preview, 40 games each):');
  for (const id of ids) {
    const a = pa.filter((r) => r.theirs === id), g = pg.filter((r) => r.theirs === id);
    console.log(`  ${id}: ${pct(wins(a) / (a.length || 1))} / ${pct(wins(g) / (g.length || 1))}`);
  }
}

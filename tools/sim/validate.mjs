// Step 2 validation summary from the runner's JSONL files (tools/sim/results/validate-*.jsonl):
//   (b) heuristic vs RandomPlayerAI, (c) mirror matches, (d) Trick Room teams set Trick Room.
// Run the games first (see NOTES.md), then: node tools/sim/validate.mjs
import { readFileSync, existsSync } from 'node:fs';
import { wilson } from './run.mjs';

const load = (f) => (existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const pct = (x) => `${(100 * x).toFixed(1)}%`;
const rate = (recs, label) => {
  const n = recs.length, k = recs.filter((r) => r.winner === 'ours').length + 0.5 * recs.filter((r) => r.winner === 'tie').length;
  const [lo, hi] = wilson(k, n);
  console.log(`${label}: ours ${k}/${n} = ${pct(k / n)} (95% CI ${pct(lo)}–${pct(hi)}); avg ${(recs.reduce((t, r) => t + r.turns, 0) / (n || 1)).toFixed(1)} turns; errors ${recs.reduce((t, r) => t + (r.errors ?? 0), 0)}; ${(recs.reduce((t, r) => t + r.ms, 0) / (n || 1) / 1000).toFixed(2)} s/game in a worker`);
};
const R = 'tools/sim/results/';
rate(load(`${R}validate-vs-random.jsonl`), '(b) heuristic vs random');
rate(load(`${R}validate-mirror-a01.jsonl`), '(c) mirror a01 vs a01');
rate(load(`${R}validate-mirror-z01.jsonl`), '(c) mirror z01 vs z01');
const SETTERS = ['oranguru', 'slowkinggalar', 'sinistcha'];
for (const [file, style] of [['validate-tr-style', 'balanced'], ['validate-tr-setup', 'setup']]) {
const tr = load(`${R}${file}.jsonl`);
const withSetter = tr.filter((r) => r.their.brought.some((s) => SETTERS.includes(s)));
const set = withSetter.filter((r) => r.their.tr > 0);
const [lo, hi] = wilson(set.length, withSetter.length);
console.log(`(d) [${style} style] Trick Room teams (z04, z15, z23) set Trick Room in ${set.length}/${withSetter.length} games where a setter came out = ${pct(set.length / (withSetter.length || 1))} (95% CI ${pct(lo)}–${pct(hi)}); brought a setter in ${withSetter.length}/${tr.length}`);
const ourTR = tr.filter((r) => r.our.brought.includes('sinistcha'));
console.log(`    (Anthony's Sinistcha set Trick Room in ${ourTR.filter((r) => r.our.tr > 0).length}/${ourTR.length} games it came out)`);
rate(tr, '    a01 vs the Trick Room teams');
}
// the same Trick Room teams against a fast team (z24): Trick Room pays there, so they should set it most games
const fast = load(`${R}validate-tr-vs-fast.jsonl`);
const fw = fast.filter((r) => r.our.brought.some((s) => SETTERS.includes(s))), fs = fw.filter((r) => r.our.tr > 0);
const [flo, fhi] = wilson(fs.length, fw.length);
console.log(`(d) Trick Room teams vs the fast team z24: set Trick Room in ${fs.length}/${fw.length} = ${pct(fs.length / (fw.length || 1))} (95% CI ${pct(flo)}–${pct(fhi)})`);
rate(fast, '    Trick Room teams vs z24');

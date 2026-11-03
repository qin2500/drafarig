// Hex-side ranking: which of Hex's sixes does best against our sixes? Reads <dir>/<ours>.jsonl (one file per six of ours,
// each against the same Hex teams with paired seeds). Prints Hex's win rate per six: average over our sixes, and against
// each. node docs/research/strategy/sim/scripts/hex-pov.mjs tools/sim/results/hex/pov [top=25]
import { readFileSync, readdirSync } from 'node:fs';
const dir = process.argv[2], TOP = Number(process.argv[3] ?? 25);
const C = JSON.parse(readFileSync('tools/sim/candidates/hexpov.json', 'utf8'));
const label = Object.fromEntries(C.opponent.teams.map((t) => [t.id, t.label]));
const ours = readdirSync(dir).filter((f) => f.endsWith('.jsonl')).map((f) => f.replace('.jsonl', ''));
const T = {}; // T[hex][ours] = [hexWins, n]
for (const o of ours) {
  for (const l of readFileSync(`${dir}/${o}.jsonl`, 'utf8').trim().split('\n')) {
    if (!l) continue;
    const r = JSON.parse(l);
    const e = ((T[r.theirs] ??= {})[o] ??= [0, 0]);
    e[0] += r.winner === 'theirs' ? 1 : r.winner === 'tie' ? 0.5 : 0; e[1]++;
  }
}
const pct = (e) => (e && e[1] ? (100 * e[0]) / e[1] : NaN);
const rows = Object.entries(T).map(([h, by]) => {
  const vals = ours.map((o) => pct(by[o])).filter((x) => !Number.isNaN(x));
  return { h, avg: vals.reduce((a, b) => a + b, 0) / vals.length, n: Object.values(by).reduce((t, e) => t + e[1], 0), by };
}).sort((a, b) => b.avg - a.avg);
console.log(`${rows.length} Hex sixes x ${ours.length} of ours (${ours.join(', ')}); Hex win %\n`);
console.log(`${'hex'.padEnd(5)} ${'avg'.padStart(5)} ${ours.map((o) => o.padStart(5)).join(' ')}  six`);
const line = (r) => `${r.h.padEnd(5)} ${r.avg.toFixed(0).padStart(5)} ${ours.map((o) => pct(r.by[o]).toFixed(0).padStart(5)).join(' ')}  ${label[r.h]}`;
rows.slice(0, TOP).forEach((r) => console.log(line(r)));
console.log('\nhand-modelled h01-h20:');
rows.filter((r) => r.h.startsWith('h')).forEach((r) => console.log(`#${rows.indexOf(r) + 1} ` + line(r)));
// species marginal for Hex (average Hex win% of sixes containing X minus not containing X)
console.log('\nHex species value (avg win% with - without):');
const sp = ['Garchomp', 'Indeedee-F', 'Armarouge', 'Corviknight', 'Rotom-Heat', 'Drampa', 'Kleavor', 'Banette', 'Ditto', 'Forretress'];
const P = rows.filter((r) => r.h.startsWith('p'));
for (const s of sp) {
  const w = P.filter((r) => label[r.h].split(' (')[0].split('+').includes(s)), wo = P.filter((r) => !label[r.h].split(' (')[0].split('+').includes(s));
  const m = (a) => a.reduce((t, r) => t + r.avg, 0) / a.length;
  console.log(`  ${s.padEnd(12)} ${(m(w) - m(wo)).toFixed(1).padStart(6)}`);
}
// best response to each of ours
console.log('\nHex best response to each of our sixes (top 3, among p-sixes with all games played):');
for (const o of ours) console.log(`  ${o}: ${P.filter((r) => r.by[o]).sort((a, b) => pct(b.by[o]) - pct(a.by[o])).slice(0, 3).map((r) => `${r.h} ${pct(r.by[o]).toFixed(0)}%`).join(', ')}`);

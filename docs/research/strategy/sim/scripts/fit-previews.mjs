// Fit a preview table (guide-shaped rows) from `--preview explore` results: for each of the guide's row conditions (first
// match wins, as in the guide), the bring-4 + lead pair with the best shrunk win rate. Write it as JSON for --preview <file>.
//   node docs/research/strategy/sim/scripts/fit-previews.mjs tools/sim/results/r7/a17-explore.jsonl > a17-previews.json
// Shrinkage: (wins + K × row mean) / (games + K), K = 10, options with fewer than MIN games are skipped. Teams that match no
// row keep the AI's preview. Report on stderr.
import { readFileSync } from 'node:fs';
const C = JSON.parse(readFileSync(new URL('../../../../../tools/sim/candidates/zhuzi.json', import.meta.url), 'utf8'));
const SPECIES = { meta: 'metagross', pult: 'dragapult', rotomw: 'rotomwash', krook: 'krookodile', nape: 'infernape', tox: 'toxtricity', oran: 'oranguru', king: 'slowkinggalar', umb: 'umbreon', florges: 'florges' };
const six = Object.fromEntries(C.opponent.teams.map((t) => [t.id, t.sets.map((k) => SPECIES[k.replace(/_.*/, '')])]));
const ROWS = [
  { if: 'their 6 includes Mega Metagross + Krookodile + Infernape', need: ['metagross', 'krookodile', 'infernape'] },
  { if: 'their 6 includes Oranguru + Toxtricity', need: ['oranguru', 'toxtricity'] },
  { if: 'their 6 includes Galarian Slowking + Umbreon', need: ['slowkinggalar', 'umbreon'] },
  { if: 'their 6 includes Galarian Slowking', need: ['slowkinggalar'] },
  { if: 'their 6 includes Dragapult + Umbreon', need: ['dragapult', 'umbreon'] },
];
const K = 10, MIN = 15;
// a team given as a file (not one of his candidate ids): its species from the Showdown text
const speciesOf = (z) => six[z] ??= readFileSync(new URL(`../../../../../${z}`, import.meta.url), 'utf8').trim().split(/\n\n+/)
  .map((b) => b.split('\n')[0].split(' @ ')[0].replace(/\s*\(.*\)\s*$/, '').toLowerCase().replace(/[^a-z0-9]/g, ''));
const rowOf = (z) => ROWS.findIndex((r) => r.need.every((s) => speciesOf(z).includes(s)));
const games = process.argv.slice(2).flatMap((f) => readFileSync(f, 'utf8').trim().split('\n').map((l) => JSON.parse(l))).filter((r) => r.winner);
const out = [];
ROWS.forEach((row, i) => {
  const R = games.filter((g) => rowOf(g.theirs) === i);
  if (!R.length) return;
  const mean = R.filter((g) => g.winner === 'ours').length / R.length;
  const opt = {};
  for (const g of R) {
    const p = g.our.pick; // the preview choice (recorded since round 7)
    if (!p) continue;
    const k = `${[...p.leads].sort().join('+')}|${p.bring.filter((s) => !p.leads.includes(s)).sort().join('/')}`;
    (opt[k] ??= { w: 0, n: 0 }).n++; if (g.winner === 'ours') opt[k].w++;
  }
  const ranked = Object.entries(opt).filter(([, o]) => o.n >= MIN).map(([k, o]) => ({ k, ...o, s: (o.w + K * mean) / (o.n + K) })).sort((a, b) => b.s - a.s);
  console.error(`${row.if}: ${[...new Set(R.map((g) => g.theirs))].sort().join(',')} n=${R.length} mean ${(100 * mean).toFixed(0)}%`);
  for (const o of ranked.slice(0, 4)) console.error(`  ${o.k}  ${o.w}/${o.n} = ${(100 * o.w / o.n).toFixed(0)}%  shrunk ${(100 * o.s).toFixed(0)}%`);
  if (!ranked.length) return;
  const [lead, back] = ranked[0].k.split('|').map((x) => x.split(/[+/]/));
  out.push({ if: row.if, bring4: [...lead, ...back], lead, note: `fitted: ${ranked[0].w}/${ranked[0].n} in explore games` });
});
console.error(`unmatched (AI preview): ${Object.keys(six).filter((z) => rowOf(z) < 0).join(',') || 'none'}`);
console.log(JSON.stringify(out, null, 1));

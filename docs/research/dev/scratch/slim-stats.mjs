// Slim a Smogon chaos JSON (16 MB) to a compact per-species usage table (~tens of KB).
// Usage: node slim-stats.mjs smogon/regmc-1760.json > smogon/regmc-1760.slim.json
import { readFileSync } from 'node:fs';
const toID = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
export function slim(chaos, topN = 8) {
  const top = (obj, total) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, topN)
    .map(([k, w]) => [k, +(100 * w / total).toFixed(1)]);
  const out = {};
  for (const [name, d] of Object.entries(chaos.data)) {
    const total = Object.values(d.Abilities).reduce((a, b) => a + b, 0) || 1;
    out[toID(name)] = { name, usage: +(100 * d.usage).toFixed(2), raw: d['Raw count'],
      abilities: top(d.Abilities, total), items: top(d.Items, total), moves: top(d.Moves, total),
      spreads: top(d.Spreads, total).slice(0, 4), teammates: top(d.Teammates, total) };
  }
  return { info: chaos.info, species: out };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(JSON.stringify(slim(JSON.parse(readFileSync(process.argv[2], 'utf8')))));
}

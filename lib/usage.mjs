// Slim a Smogon "chaos" usage JSON (~16 MB) to a compact per-species table (~200 KB).
import { toID } from './names.mjs';

export function slimChaos(chaos, topN = 8) {
  const top = (obj, total) => Object.entries(obj || {}).sort((a, b) => b[1] - a[1]).slice(0, topN)
    .map(([k, w]) => [k, +(100 * w / total).toFixed(1)]);
  const species = {};
  for (const [name, d] of Object.entries(chaos.data || {})) {
    const total = Object.values(d.Abilities || {}).reduce((a, b) => a + b, 0) || 1;
    species[toID(name)] = {
      name, usage: +(100 * d.usage).toFixed(2), abilities: top(d.Abilities, total), items: top(d.Items, total),
      moves: top(d.Moves, total), spreads: top(d.Spreads, total).slice(0, 4), teammates: top(d.Teammates, total),
    };
  }
  return { info: chaos.info, species };
}

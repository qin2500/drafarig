// Checks Showdown sprite coverage for every board species + its Champions Megas. Writes ../sprite-coverage.json
import { readFileSync, writeFileSync } from 'node:fs';
const toID = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
const dex = JSON.parse(readFileSync('psclient/pokedex.json', 'utf8'));
const sm = JSON.parse(readFileSync('../species-megas.json', 'utf8')).species;
export const spriteId = (id) => { const s = dex[id]; return toID(s.baseSpecies || s.name) + (s.forme ? '-' + toID(s.forme) : ''); };
const SETS = [['gen5', 'png'], ['home-centered', 'png'], ['dex', 'png'], ['ani', 'gif']];
const ids = Object.values(sm).flatMap((v) => [v.base.id, ...v.megas.map((m) => m.id)]);
const res = {};
async function head(u) { for (let i = 0; i < 3; i++) { try { return (await fetch(u, { method: 'HEAD' })).status; } catch { } } return 0; }
const q = [...ids];
await Promise.all(Array.from({ length: 12 }, async () => { while (q.length) { const id = q.shift(); const sid = spriteId(id); res[id] = { sid };
  for (const [d, e] of SETS) res[id][d] = await head(`https://play.pokemonshowdown.com/sprites/${d}/${sid}.${e}`); } }));
const summary = Object.fromEntries(SETS.map(([d]) => [d, ids.filter((i) => res[i][d] === 200).length]));
const noneOk = ids.filter((i) => SETS.every(([d]) => res[i][d] !== 200));
const gen5Missing = ids.filter((i) => res[i].gen5 !== 200).map((i) => ({ id: i, sid: res[i].sid, ok: SETS.filter(([d]) => res[i][d] === 200).map(([d]) => d) }));
writeFileSync('../sprite-coverage.json', JSON.stringify({ checkedAt: new Date().toISOString(), total: ids.length, summary, noneOk, gen5Missing, res }, null, 1));
console.log(ids.length, summary, 'noneOk', noneOk, 'gen5Missing', JSON.stringify(gen5Missing));

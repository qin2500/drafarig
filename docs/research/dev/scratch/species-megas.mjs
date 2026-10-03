// Builds ../species-megas.json: for every board species id -> base form + all Champions-legal Mega forms.
// League rule: drafting a species includes all of its Mega forms.
// Sources: psclient/pokedex.json (play.pokemonshowdown.com/data, stats/types/abilities; Champions mod has no pokedex
// overrides, verified: data/mods/champions has no pokedex.ts and teambuilder overrideSpeciesData only toggles isNonstandard)
// + ps/champions-formats-data.ts (legality/tier, Showdown master = Reg M-C).
import { readFileSync, writeFileSync } from 'node:fs';
import { loadTsTable } from './load-ps-ts.mjs';
const toID = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
const dex = JSON.parse(readFileSync('psclient/pokedex.json', 'utf8'));
const fd = loadTsTable('ps/champions-formats-data.ts');
const nm = JSON.parse(readFileSync('../name-map.json', 'utf8'));
const fdOf = (id) => fd[id] ?? fd[toID(dex[id]?.baseSpecies)];
const legal = (id) => { const e = fdOf(id); return !!e && !e.isNonstandard; };
const form = (id) => { const s = dex[id]; return { id, name: s.name, num: s.num, types: s.types, baseStats: s.baseStats,
  bst: Object.values(s.baseStats).reduce((a, b) => a + b, 0), abilities: s.abilities, weightkg: s.weightkg,
  tier: fdOf(id)?.tier ?? null, ...(s.requiredItem ? { megaStone: s.requiredItem } : {}) }; };
const megaIds = Object.keys(dex).filter((f) => /(^|-)Mega(-|$)/.test(dex[f].forme || '') && legal(f));
const out = {};
const boardIds = new Set(Object.values(nm.map).filter(Boolean));
for (const id of [...new Set(Object.values(nm.map).filter(Boolean))].sort()) {
  const megas = megaIds.filter((f) => toID(dex[f].battleOnly || dex[f].baseSpecies) === id);
  // Non-Mega legal formes of the same base species that are NOT separately listed on the board
  // (e.g. Gourgeist sizes). Whether drafting the base includes them is a league ruling -> flagged, not assumed.
  const base = toID(dex[id].baseSpecies || dex[id].name);
  const altFormes = id !== base ? [] : (dex[id].otherFormes || []).map(toID)
    .filter((f) => dex[f] && !megas.includes(f) && !/(^|-)Mega(-|$)/.test(dex[f].forme || '') && legal(f) && !boardIds.has(f) && !dex[f].battleOnly);
  out[id] = { base: form(id), megas: megas.map(form), ...(altFormes.length ? { altFormes: altFormes.map(form) } : {}) };
}
const allLegalMegas = new Set(megaIds), covered = new Set(Object.values(out).flatMap((v) => v.megas.map((m) => m.id)));
writeFileSync('../species-megas.json', JSON.stringify({ generatedAt: new Date().toISOString(), format: 'gen9championsvgc2026regmc',
  rule: 'Drafting a species includes all of its Champions-legal Mega forms.',
  megaOwnerRule: 'A Mega belongs to toID(mega.battleOnly || mega.baseSpecies); e.g. Floette-Mega <- floetteeternal, Raichu-Mega-X/Y <- raichu (not raichualola), Slowbro-Mega <- slowbro (not slowbrogalar).',
  species: out, legalMegasNotOnBoard: [...allLegalMegas].filter((m) => !covered.has(m)) }, null, 1));
console.log('species', Object.keys(out).length, 'withMegas', Object.values(out).filter((v) => v.megas.length).length,
  'megaForms', covered.size, '/', allLegalMegas.size, 'multi:', Object.entries(out).filter(([, v]) => v.megas.length > 1).map(([k, v]) => k + '=' + v.megas.map((m) => m.name).join('|')).join(' '));

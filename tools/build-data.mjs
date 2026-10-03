// Builds data/dex.json from the research outputs + Showdown's type chart.
// Run once (or when the regulation changes):  node tools/build-data.mjs
// Inputs:  docs/research/dev/species-megas.json   (forms, stats, types, abilities, Megas; Showdown Champions M-C data)
//          docs/research/strategy/pokemon.json    (tier, roles, key moves, notes, Chinese names, Pikalytics usage)
//          https://play.pokemonshowdown.com/data/typechart.js and pokedex.json (sprite file names)
import { readFileSync, writeFileSync } from 'node:fs';
import { toID } from '../lib/names.mjs';

const root = new URL('..', import.meta.url).pathname;
const sm = JSON.parse(readFileSync(root + 'docs/research/dev/species-megas.json', 'utf8')).species;
const strat = JSON.parse(readFileSync(root + 'docs/research/strategy/pokemon.json', 'utf8'));

const ps = await (await fetch('https://play.pokemonshowdown.com/data/pokedex.json')).json();
// Showdown sprite file name: base species id + '-' + forme id (e.g. charizard-megax, tauros-paldeaaqua)
const spriteId = (id) => { const d = ps[id]; return toID(d.baseSpecies || d.name) + (d.forme ? '-' + toID(d.forme) : ''); };
const form = (f, isMega) => ({
  id: f.id, name: f.name, sprite: spriteId(f.id), types: f.types, baseStats: f.baseStats,
  abilities: Object.values(f.abilities), ...(isMega ? { mega: true, stone: f.megaStone } : {}),
});

const species = {};
for (const p of strat) {
  const id = toID(p.name), s = sm[id];
  if (!s) throw new Error('no species-megas entry for ' + p.name);
  const roles = new Set(p.roles);
  if (s.megas.length) roles.add('mega'); // Meowstic-M/F Megas were missing from the strategy file
  species[id] = {
    id, name: s.base.name, zh: p.zhName, num: s.base.num, tier: p.tier, roles: [...roles],
    keyMoves: p.keyMoves || [], archetypes: p.archetypes || [], notes: p.notes || '', valueNote: p.valueNote || '',
    pika: p.usage ? { pct: p.usage.pct, rank: p.usage.rank, winrate: p.usage.winrate } : null,
    forms: [form(s.base, false), ...s.megas.map((m) => form(m, true))],
    ...(s.altFormes ? { altFormes: s.altFormes.map((f) => f.name) } : {}),
  };
}

// Type chart as attacker -> defender -> multiplier
const src = await (await fetch('https://play.pokemonshowdown.com/data/typechart.js')).text();
const BattleTypeChart = new Function('exports', src + '; return exports.BattleTypeChart;')({});
const TYPES = Object.values(BattleTypeChart).length && Object.keys(BattleTypeChart)
  .map((k) => k[0].toUpperCase() + k.slice(1)).filter((t) => t !== 'Stellar');
const CODE = { 0: 1, 1: 2, 2: 0.5, 3: 0 };
const typechart = {};
for (const atk of TYPES) {
  typechart[atk] = {};
  for (const def of TYPES) typechart[atk][def] = CODE[BattleTypeChart[toID(def)].damageTaken[atk]];
}

writeFileSync(root + 'data/dex.json', JSON.stringify({
  generatedAt: new Date().toISOString(), format: 'gen9championsvgc2026regmc', types: TYPES, typechart, species,
}));
console.log(`data/dex.json: ${Object.keys(species).length} species, ${Object.values(species).reduce((a, s) => a + s.forms.length, 0)} forms, ${TYPES.length} types`);

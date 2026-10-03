import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { matchName, suggest, toID } from '../lib/names.mjs';
import { parseBoardCsv, parseDraftsCsv } from '../lib/sheet.mjs';

const fx = (n) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');
const dex = JSON.parse(readFileSync(new URL('../data/dex.json', import.meta.url), 'utf8'));
const has = (id) => !!dex.species[id];
// Reviewed mapping from the research phase (copied from docs/research/dev/name-map.json)
const expected = JSON.parse(readFileSync(new URL('./fixtures/name-map.json', import.meta.url), 'utf8'));

test('every name in both tabs matches the reviewed map', () => {
  const names = new Set([...parseBoardCsv(fx('board.csv')).map((b) => b.en), ...parseDraftsCsv(fx('drafts.csv')).flatMap((c) => c.picks.map((p) => p.en))]);
  assert.equal(names.size, 259);
  for (const n of names) assert.equal(matchName(n, has).id, expected[n], n);
});

test('typos, regional prefixes, forms and gender suffixes', () => {
  const cases = {
    'Huisuian Zoroark': 'zoroarkhisui', 'Alalan-Persian': 'persianalola', Typhilosion: 'typhlosion', Squawkability: 'squawkabilly',
    Watchdog: 'watchog', 'Hisuian Samorott': 'samurotthisui', Manecri: 'manectric', Spritomb: 'spiritomb', Politoad: 'politoed',
    Forrestress: 'forretress', 'Mr.Rime': 'mrrime', pikachu: 'pikachu', 'Gholdengo ': 'gholdengo', Prismarina: 'primarina',
    'Paldean tauros-water': 'taurospaldeaaqua', 'Paldean tauros-fire': 'taurospaldeablaze', 'Paldean tauros-fighting': 'taurospaldeacombat',
    'Indeedee-female': 'indeedeef', 'Indeedee-male': 'indeedee', 'Basculegion-male': 'basculegion', 'Rotom-Wash': 'rotomwash',
    'Lycanroc-midday': 'lycanroc', 'Lycanroc-dusk': 'lycanrocdusk', 'Meowstic-female': 'meowsticf', Floette: 'floetteeternal',
    "Sirfetch'd": 'sirfetchd', 'Kommo-o': 'kommoo',
  };
  for (const [raw, id] of Object.entries(cases)) assert.equal(matchName(raw, has).id, id, raw);
});

test('unknown names are reported, never guessed; aliases and suggestions resolve them', () => {
  assert.deepEqual(matchName('Garchompp', has), { id: null, how: 'unmatched' });
  assert.equal(suggest('Garchompp', Object.keys(dex.species))[0].id, 'garchomp');
  assert.deepEqual(matchName('Garchompp', has, { Garchompp: 'garchomp' }), { id: 'garchomp', how: 'alias' });
  assert.equal(toID("Farfetch'd"), 'farfetchd');
});

test('every board species carries all its Champions Megas (league rule)', () => {
  const megas = (id) => dex.species[id].forms.filter((f) => f.mega).map((f) => f.name);
  assert.deepEqual(megas('charizard'), ['Charizard-Mega-X', 'Charizard-Mega-Y']);
  assert.deepEqual(megas('floetteeternal'), ['Floette-Mega']);
  assert.deepEqual(megas('raichualola'), []);
  assert.deepEqual(megas('meowsticf'), ['Meowstic-F-Mega']);
  assert.equal(Object.values(dex.species).reduce((a, s) => a + megas(s.id).length, 0), 82);
});

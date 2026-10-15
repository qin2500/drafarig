// Board name -> Showdown species id normalizer + verification.
// Inputs (all fetched into scratch/): board.csv, drafts.csv, psclient/pokedex.json, psclient/aliases.js,
//   ps/champions-formats-data.ts, pokeapi/pokemon_species_names.csv (for Chinese cross-check).
// Output: ../name-map.json
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { parseBoardCsv, parseDraftsCsv } from './sheet.mjs';
import { loadTsTable } from './load-ps-ts.mjs';
const require = createRequire(import.meta.url);

export const toID = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');

// Known sheet typos (lowercased, after trim). Keep this list small and explicit.
export const TYPOS = {
  'huisuian': 'hisuian', 'alalan': 'alolan', 'typhilosion': 'typhlosion', 'squawkability': 'squawkabilly',
  'watchdog': 'watchog', 'samorott': 'samurott', 'manecri': 'manectric', 'spritomb': 'spiritomb',
  'politoad': 'politoed', 'forrestress': 'forretress', 'prismarina': 'primarina',
};
const REGION = { alolan: 'alola', galarian: 'galar', hisuian: 'hisui', paldean: 'paldea' };
const TAUROS = { water: 'aqua', aqua: 'aqua', fire: 'blaze', blaze: 'blaze', fighting: 'combat', combat: 'combat' };

export function makeNormalizer(dex, aliases = {}) {
  return function normalize(raw) {
    let s = raw.trim().toLowerCase().replace(/\s+/g, ' ');
    s = s.replace(/[a-z]+/g, (w) => TYPOS[w] ?? w);            // word-level typo fixes
    s = s.replace(/^(alolan|galarian|hisuian|paldean)[\s-]+(.+)$/, (_, r, rest) => `${rest}-${REGION[r]}`);
    // "tauros-water-paldea" -> tauros-paldea-aqua
    s = s.replace(/^tauros-(water|aqua|fire|blaze|fighting|combat)-paldea$/, (_, t) => `tauros-paldea-${TAUROS[t]}`);
    s = s.replace(/-female$/, '-f').replace(/-male$/, '');      // Indeedee/Basculegion/Meowstic: base forme = male
    let id = toID(s);
    if (id === 'floette') id = 'floetteeternal';                 // only Eternal Flower Floette is in Champions (has Mega)
    if (dex[id]) return { id, how: id === toID(raw) ? 'exact' : 'rule' };
    const a = aliases[id]; if (a && dex[toID(a)]) return { id: toID(a), how: 'alias' };
    return { id: null, how: 'unmatched' };
  };
}

function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dex = JSON.parse(readFileSync('psclient/pokedex.json', 'utf8'));
  const aliases = require('./psclient/aliases.js').BattleAliases || {};
  const fd = loadTsTable('ps/champions-formats-data.ts');
  const legal = (id) => {
    const e = fd[id] ?? fd[toID(dex[id]?.baseSpecies)];       // cosmetic formes inherit base data
    return !!e && !e.isNonstandard;
  };
  // zh-Hans species names (PokeAPI language 12)
  const zh = {};
  for (const line of readFileSync('pokeapi/pokemon_species_names.csv', 'utf8').split('\n').slice(1)) {
    const [sid, lang, name] = line.split(',');
    if (lang === '12') zh[+sid] = name;
  }
  const board = parseBoardCsv(readFileSync('board.csv', 'utf8'));
  const coaches = parseDraftsCsv(readFileSync('drafts.csv', 'utf8'));
  const entries = [...board.map((b) => ({ en: b.en, zh: b.zh, src: 'board', points: b.points })),
    ...coaches.flatMap((c) => c.picks.map((p) => ({ en: p.en, zh: p.zh, src: 'drafts:' + c.name, points: p.points })))];
  const normalize = makeNormalizer(dex, aliases);
  const map = {}, unmatched = [], notes = [];
  const legalIds = Object.keys(dex).filter(legal);
  for (const e of entries) {
    if (e.en in map) continue;
    let { id, how } = normalize(e.en);
    if (!id) { // fuzzy fallback among Champions-legal ids, reported for review
      const t = toID(e.en); const best = legalIds.map((x) => [x, lev(t, x)]).sort((a, b) => a[1] - b[1])[0];
      if (best && best[1] <= 2) { id = best[0]; how = `fuzzy(d=${best[1]})`; }
    }
    if (!id) { unmatched.push(e.en); map[e.en] = null; continue; }
    const sp = dex[id];
    // Chinese cross-check: strip regional/forme prefixes and gender/forme words, compare to PokeAPI species name.
    const zhSpecies = zh[sp.num];
    const zhOk = !!zhSpecies && e.zh.includes(zhSpecies);
    map[e.en] = id;
    notes.push({ board: e.en, id, name: sp.name, how, legalInChampions: legal(id), zh: e.zh, zhSpecies, zhOk });
  }
  const out = {
    generatedAt: new Date().toISOString(),
    showdownFormat: 'gen9championsvgc2026regmc',
    count: Object.keys(map).length, unmatched,
    map,
    nonExact: notes.filter((n) => n.how !== 'exact').map(({ board, id, name, how }) => ({ board, id, name, how })),
    notLegalInChampions: notes.filter((n) => !n.legalInChampions).map(({ board, id }) => ({ board, id })),
    // Champions-legal Mega formes available to each mapped board species (id -> [{id, item}])
    megas: Object.fromEntries([...new Set(Object.values(map).filter(Boolean))].map((id) => [id,
      // a Mega belongs to the species named in battleOnly (e.g. Floette-Mega <- Floette-Eternal) else its baseSpecies
      Object.keys(dex).filter((f) => /(^|-)Mega(-|$)/.test(dex[f].forme || '') && legal(f) && toID(dex[f].battleOnly || dex[f].baseSpecies) === id)
        .map((f) => ({ id: f, item: dex[f].requiredItem, types: dex[f].types, ability: dex[f].abilities[0] }))]).filter(([, v]) => v.length)),
    chineseMismatch: notes.filter((n) => !n.zhOk).map(({ board, id, zh, zhSpecies }) => ({ board, id, zh, zhSpecies })),
  };
  writeFileSync('../name-map.json', JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ count: out.count, unmatched, nonExact: out.nonExact.length, notLegal: out.notLegalInChampions, zhMismatch: out.chineseMismatch.length, boardSpeciesWithMega: Object.keys(out.megas).length, megaIds: Object.values(out.megas).flat().map((m) => m.id).join(' ') }, null, 1));
}

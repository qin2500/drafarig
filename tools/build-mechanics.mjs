// Dev-only (never shipped: tools/ is not embedded by scripts/build.mjs). Builds data/mechanics.json, the public
// game-data projection the Prep calculator and set checks use, from the deterministic projection generated from the pinned
// Pokémon Showdown simulator and its Reg M-C team validator (schema drafarig.mechanics/1). No network access.
//
//   node tools/build-mechanics.mjs --from <path to mechanics-projection.json>
//
// The input is pinned by file sha256 and by its own projectionHash (recomputed here), and must have been generated from
// this repo's data/dex.json. The output keeps only allowlisted, data-only fields (no prose, no file paths), encodes
// learnsets as indexes into one sorted move list, and is byte-identical for the same input.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const PIN = Object.freeze({
  fileSha256: '167e768f3a24ffe70b03e4ddc02b887fbf9a3cee826c704d1578dfdfbad57d02',
  projectionHash: '48dafc7a14a2ac971a533989ccaf07c0117452b5f60bc813e8c6de7963838e08',
  schema: 'drafarig.mechanics/1',
  simulator: 'smogon/pokemon-showdown',
  commit: '9fb3a5b99f1a0bea17f495c5cc1bfe04fdd19c3e',
  engine: { name: '@smogon/calc', version: '0.12.0' },
});
export const OUT_SCHEMA = 'drafarig.mechanics-app/1';

const sha256 = (s) => createHash('sha256').update(s).digest('hex');
export function canon(x) {
  if (Array.isArray(x)) return x.map(canon);
  if (x && typeof x === 'object') return Object.fromEntries(Object.keys(x).sort().map((k) => [k, canon(x[k])]));
  return x;
}

// Allowlisted fields per entity (anything else in the input is dropped; a missing field fails the build).
export const FIELDS = Object.freeze({
  species: ['name', 'num', 'baseSpecies', 'forme', 'types', 'baseStats', 'weightkg', 'abilities', 'legal', 'outOfBattle', 'mega', 'calc', 'hash'],
  moves: ['name', 'type', 'category', 'basePower', 'accuracy', 'priority', 'target', 'basePP', 'battlePP', 'flags', 'multihit', 'hasSecondary', 'calc', 'hash'],
  items: ['name', 'megaStone', 'calc', 'hash'],
  abilities: ['name', 'calc', 'hash'],
  natures: ['name', 'plus', 'minus'],
  regulation: ['formatId', 'formatName', 'gameType', 'mod', 'ruleset', 'bo3FormatId', 'bo3Ruleset', 'adjustLevel', 'evLimit', 'spPerStatMax',
    'minTeamSize', 'maxTeamSize', 'pickedTeamSize', 'itemClause', 'speciesClause', 'nicknameClause', 'teamPreview', 'openTeamSheets',
    'forceOpenTeamSheets', 'bannedTags'],
});

function pick(obj, fields, where) {
  const out = {};
  for (const f of fields) {
    if (!(f in obj)) throw new Error(`build-mechanics: ${where} lacks ${f}`);
    out[f] = obj[f];
  }
  return out;
}

/** Pure transform: verified projection object -> app projection object (no meta.hash yet). */
export function transform(p, { dexSha256 }) {
  if (p.schema !== PIN.schema) throw new Error(`build-mechanics: schema ${p.schema}`);
  if (p.source?.commit !== PIN.commit) throw new Error('build-mechanics: simulator commit differs from the pin');
  if (p.source?.engine?.name !== PIN.engine.name || p.source?.engine?.version !== PIN.engine.version) throw new Error('build-mechanics: engine pin differs');
  if (p.source?.inputs?.['app/dex.json'] !== dexSha256) throw new Error('build-mechanics: the projection was generated from a different data/dex.json; regenerate it first');
  const table = (name) => Object.fromEntries(Object.keys(p[name]).sort().map((id) => [id, pick(p[name][id], FIELDS[name], `${name}.${id}`)]));
  const moveIds = Object.keys(p.moves).sort();
  const index = new Map(moveIds.map((id, i) => [id, i]));
  const learnsets = {};
  for (const sp of Object.keys(p.learnsets).sort()) {
    learnsets[sp] = p.learnsets[sp].map((m) => {
      if (!index.has(m)) throw new Error(`build-mechanics: learnset ${sp} has ${m}, which is not in moves`);
      return index.get(m);
    }).sort((a, b) => a - b);
  }
  for (const [id, s] of Object.entries(p.species)) {
    if (s.legal && !learnsets[s.outOfBattle]) throw new Error(`build-mechanics: legal species ${id} has no learnset`);
    if (s.mega && !p.items[s.mega.item]?.megaStone) throw new Error(`build-mechanics: ${id} Mega stone ${s.mega.item} is not a legal stone`);
    for (const a of s.abilities) if (!p.abilities[a.toLowerCase().replace(/[^a-z0-9]+/g, '')]) throw new Error(`build-mechanics: ${id} ability ${a} missing`);
  }
  return {
    meta: {
      schema: OUT_SCHEMA,
      source: { simulator: PIN.simulator, commit: PIN.commit, engine: PIN.engine, projectionSchema: PIN.schema, projectionHash: PIN.projectionHash, projectionSha256: PIN.fileSha256, appDexSha256: dexSha256 },
      wrapperRules: [...p.wrapperRules].sort(),
    },
    regulation: pick(p.regulation, FIELDS.regulation, 'regulation'),
    species: table('species'),
    moves: table('moves'),
    items: table('items'),
    abilities: table('abilities'),
    natures: table('natures'),
    learnsetMoves: moveIds,
    learnsets,
  };
}

/** Serializes with sorted keys and a content hash over everything else (a dataset label; staleness uses entity hashes). */
export function serialize(app) {
  const body = canon(app);
  const hash = sha256(JSON.stringify(body));
  return JSON.stringify({ ...body, meta: { ...body.meta, hash } }) + '\n';
}

export async function verifyInput(text) {
  if (sha256(text) !== PIN.fileSha256) throw new Error('build-mechanics: input file sha256 does not match the pin (update PIN after reviewing a new projection)');
  const p = JSON.parse(text);
  const claimed = p.projectionHash;
  delete p.projectionHash;
  if (claimed !== PIN.projectionHash || sha256(JSON.stringify(canon(p))) !== claimed) throw new Error('build-mechanics: projectionHash does not verify');
  return p;
}

async function main() {
  const i = process.argv.indexOf('--from');
  if (i < 0 || !process.argv[i + 1]) throw new Error('usage: node tools/build-mechanics.mjs --from <path to mechanics-projection.json>');
  const p = await verifyInput(await readFile(process.argv[i + 1], 'utf8'));
  const dexSha256 = sha256(await readFile(join(ROOT, 'data/dex.json')));
  const out = serialize(transform(p, { dexSha256 }));
  await writeFile(join(ROOT, 'data/mechanics.json'), out);
  console.log(`Wrote data/mechanics.json (${Buffer.byteLength(out)} bytes)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();

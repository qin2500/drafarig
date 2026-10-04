// Saved-calc fingerprints and staleness. A saved calc stores the canonical scenario it was checked with, the pins (wrapper,
// rule codes, engine, regulation, simulator commit) and the per-entity hashes of every projection entry it touched.
// Staleness is a comparison against the current pins, entity hashes and set versions, so it needs no hashing in render
// loops; the SHA-256 keys (computed on save, async Web Crypto) identify a result exactly.
import { normalizeScenario } from './scenario.mjs';
import { battleForme, toID } from './mech.mjs';
import { WRAPPER_VERSION } from './rules.mjs';

export function canon(x) {
  if (Array.isArray(x)) return x.map(canon);
  if (x && typeof x === 'object') return Object.fromEntries(Object.keys(x).sort().map((k) => [k, canon(x[k])]));
  return x;
}
export const canonJSON = (x) => JSON.stringify(canon(x));

export async function sha256Hex(text, subtle = globalThis.crypto?.subtle) {
  if (!subtle) throw new Error('Web Crypto is not available');
  const buf = await subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** The scenario in key form: every field present, moves sorted (their order doesn't change a calc). */
export function keyScenario(sc) {
  const n = normalizeScenario(sc);
  for (const s of ['attacker', 'defender']) n[s].set.moves = [...n[s].set.moves].sort();
  return n;
}

export function pinsOf(mech, engineInfo) {
  return {
    wrapper: WRAPPER_VERSION, wrapperRules: [...(mech.meta.wrapperRules ?? [])].sort(),
    engine: `${engineInfo.name}@${engineInfo.version}#${engineInfo.sha256 ?? ''}`,
    regulation: mech.regulation.formatId, commit: mech.meta.source.commit, data: mech.meta.hash,
  };
}

/** An entry's content hash (natures carry none in the projection: their canonical JSON stands in). */
export const entityHash = (mech, kind, id) => (mech[kind]?.[id] ? mech[kind][id].hash ?? canonJSON(mech[kind][id]) : null);

/** Projection entries a scenario reads, as 'kind:id' -> entity hash (null when the entry no longer exists). */
export function entityHashes(sc, mech) {
  const n = normalizeScenario(sc);
  const out = {};
  const put = (kind, id) => { if (id) out[`${kind}:${id}`] = entityHash(mech, kind, id); };
  for (const s of ['attacker', 'defender']) {
    const set = n[s].set;
    put('species', set.species);
    const f = battleForme(mech, set.species, set.item, { megaEvolved: n[s].state.mega });
    if (!f.error && f.id !== set.species) { put('species', f.id); for (const a of mech.species[f.id].abilities) put('abilities', toID(a)); }
    put('items', set.item);
    put('abilities', set.ability);
    put('abilities', n[s].state.tracedAbility);
    put('natures', set.nature);
  }
  put('moves', n.move.id);
  return canon(out);
}

/** Keys for a scenario (async). */
export async function calcKeys(sc, mech, engineInfo, subtle) {
  const pins = pinsOf(mech, engineInfo);
  const inputKey = await sha256Hex(canonJSON({ pins, scenario: keyScenario(sc) }), subtle);
  const entities = entityHashes(sc, mech);
  const entityKey = await sha256Hex(canonJSON(entities), subtle);
  const resultKey = await sha256Hex(`${inputKey}|${entityKey}`, subtle);
  return { inputKey, entityKey, resultKey, pins, entities };
}

/**
 * Why a saved calc is out of date (empty array = current). saved = { pins, entities, refs:{attacker:{setId,v}, defender:{…}} };
 * versionOf(setId) -> current version number, or null if the set was deleted (the calc is then "frozen", not stale).
 * Reasons: set-edited (with side and versions), engine-changed, data-changed, legality-changed, regulation-changed.
 */
export function staleReasons(saved, mech, engineInfo, versionOf = () => undefined) {
  const out = [];
  const cur = pinsOf(mech, engineInfo);
  if (!saved?.pins) return [{ code: 'unknown-pins' }];
  if (saved.pins.regulation !== cur.regulation) out.push({ code: 'regulation-changed' });
  if (saved.pins.engine !== cur.engine || saved.pins.wrapper !== cur.wrapper || canonJSON(saved.pins.wrapperRules) !== canonJSON(cur.wrapperRules)) out.push({ code: 'engine-changed' });
  let legality = false, data = false;
  for (const [k, h] of Object.entries(saved.entities ?? {})) {
    const [kind, id] = k.split(':');
    if (!mech[kind] || !(id in mech[kind]) || (kind === 'species' && !mech.species[id].legal)) { legality = true; continue; }
    if (entityHash(mech, kind, id) !== h) data = true;
  }
  if (legality) out.push({ code: 'legality-changed' });
  else if (data) out.push({ code: 'data-changed' });
  for (const side of ['attacker', 'defender']) {
    const r = saved.refs?.[side];
    if (!r?.setId) continue;
    const v = versionOf(r.setId);
    if (v === null) out.push({ code: 'set-deleted', side });
    else if (v !== undefined && v !== r.v) out.push({ code: 'set-edited', side, from: r.v, to: v });
  }
  return out;
}

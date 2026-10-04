// Prep domain operations on documents (pure; callers save). Sets are lineages of immutable versions: an edit adds v+1 and
// moves `currentV`; a revert moves `currentV` back, so calcs and mocks that point at {setId, v} become current again
// exactly, with no recomputation. Opposing set fields carry a source; their Stat Points stay "unknown" (shown as a range)
// until the user enters a guess.
import { toID, canLearn, legalAbilities, settableSpecies } from './calc/mech.mjs';
import { STAT_IDS, SP_PER_STAT, SP_TOTAL } from './calc/stats.mjs';
import { SOURCES } from './prep-schema.mjs';

export const MAX_VERSIONS_KEPT = 10;
export const SOURCE_RANK = Object.freeze({ 'sheet-open': 5, 'seen-vs-me': 5, fixed: 5, 'seen-vs-others': 4, ladder: 2, 'my-guess': 1, 'counterprep-guess': 1 });

export const emptyCosmetic = () => ({ nickname: '', gender: '', shiny: false, happiness: null, pokeball: '' });
export function cleanSetData(d) {
  return {
    item: d.item ?? '', ability: d.ability ?? '', nature: d.nature ?? '', moves: (d.moves ?? []).filter(Boolean).slice(0, 4),
    sp: d.sp === 'unknown' ? 'unknown' : Object.fromEntries(STAT_IDS.map((s) => [s, d.sp?.[s] ?? 0])),
    cosmetic: { ...emptyCosmetic(), ...(d.cosmetic ?? {}) },
  };
}

/** The calc/paste view of a version: {species, item, ability, nature, moves, sp, cosmetic}. */
export const asSet = (lineage, version) => ({ species: lineage.speciesId, ...version.data });

export function newLineage({ id, side, coach = null, speciesId, name, data, provenance = null, now, reason = 'created' }) {
  const version = { v: 1, at: now, reason, data: cleanSetData(data), ...(provenance ? { provenance } : {}) };
  return { id, side, ...(side === 'theirs' ? { coach } : {}), speciesId, name: name || '', currentV: 1, createdAt: now, updatedAt: now, versions: [version], ...(side === 'mine' ? { revealedTo: [] } : {}) };
}
export const currentVersion = (l) => l.versions.find((v) => v.v === l.currentV) ?? l.versions.at(-1);
export const versionOf = (l, v) => l.versions.find((x) => x.v === v) ?? null;
export const latestV = (l) => Math.max(...l.versions.map((v) => v.v));

/** A new version (never edits one in place). Equal data is a no-op. */
export function addVersion(l, data, { now, reason = 'edited', revisionId = null, provenance = undefined }) {
  const cur = currentVersion(l);
  const next = cleanSetData(data);
  const prov = provenance === undefined ? cur.provenance : provenance;
  if (JSON.stringify(next) === JSON.stringify(cur.data) && JSON.stringify(prov ?? null) === JSON.stringify(cur.provenance ?? null)) return l;
  const v = latestV(l) + 1;
  return { ...l, currentV: v, updatedAt: now, versions: [...l.versions, { v, at: now, reason, ...(revisionId ? { revisionId } : {}), data: next, ...(prov ? { provenance: prov } : {}) }] };
}
export const setCurrent = (l, v, now) => (versionOf(l, v) ? { ...l, currentV: v, updatedAt: now } : l);

/** Keep every referenced version, the current one and the newest `keep`; drop the rest. */
export function pruneVersions(l, referenced = new Set(), keep = MAX_VERSIONS_KEPT) {
  const newest = new Set([...l.versions].sort((a, b) => b.v - a.v).slice(0, keep).map((v) => v.v));
  return { ...l, versions: l.versions.filter((v) => newest.has(v.v) || referenced.has(v.v) || v.v === l.currentV) };
}

/** Versions referenced anywhere in a workspace (calcs, mocks, matches, revisions), per set id. */
export function referencedVersions(ws) {
  const m = new Map();
  const add = (id, v) => { if (!id || !Number.isInteger(v)) return; if (!m.has(id)) m.set(id, new Set()); m.get(id).add(v); };
  for (const c of ws.calcs ?? []) for (const s of ['attacker', 'defender', 'second']) add(c.refs?.[s]?.setId, c.refs?.[s]?.v);
  for (const ms of ws.mockSets ?? []) for (const x of ms.mySets ?? []) add(x.setId, x.v);
  for (const mt of ws.matches ?? []) for (const x of mt.my6 ?? []) add(x.setId, x.v);
  for (const r of ws.revisions ?? []) for (const c of r.changes ?? []) if (c.setId) { add(c.setId, c.fromV); add(c.setId, c.toV); }
  return m;
}

// ---------- provenance ----------
export const fieldSource = (prov, field, i) => (field === 'moves' ? prov?.moves?.[i]?.source : prov?.[field]?.source) ?? null;
/** The weakest source among a set's filled fields (shown on set rows); null for your own sets. */
export function weakestSource(prov, data) {
  if (!prov) return null;
  const list = [];
  for (const f of ['item', 'ability', 'nature']) if (data[f] && prov[f]?.source) list.push(prov[f].source);
  (data.moves ?? []).forEach((m, i) => { if (m && prov.moves?.[i]?.source) list.push(prov.moves[i].source); });
  if (data.sp !== 'unknown' && prov.sp?.source) list.push(prov.sp.source);
  if (!list.length) return null;
  return list.sort((a, b) => (SOURCE_RANK[a] ?? 0) - (SOURCE_RANK[b] ?? 0))[0];
}
/** Uniform provenance for every filled field (paste imports, guesses). OTS never shows Stat Points, so 'sheet-open' isn't used for SP. */
export function provenanceAll(data, source, asOf, note = '') {
  if (!SOURCES.includes(source)) throw new Error(`bad source ${source}`);
  const p = { source, asOf, ...(note ? { note } : {}) };
  const spSource = source === 'sheet-open' ? 'my-guess' : source;
  return {
    item: data.item ? p : null, ability: data.ability ? p : null, nature: data.nature ? p : null,
    moves: (data.moves ?? []).map((m) => (m ? p : null)), sp: data.sp === 'unknown' ? null : { ...p, source: spSource },
  };
}

// ---------- labelled guesses from ladder data ----------
/**
 * A starting set for one opposing mon from public ladder data, every filled field labelled "ladder", Stat Points unknown.
 * Moves come from the app's key-move list (Pikalytics) or Smogon usage, filtered to what the species can learn in Reg M-C.
 * usage: the slimmed Smogon table (or null when offline). Returns { data, provenance, missing:[fields] }.
 */
export function guessSet(mech, dexSpecies, speciesId, usage, asOf) {
  const u = usage?.species?.[speciesId] ?? usage?.species?.[toID(mech.species[speciesId]?.name)] ?? null;
  const learnable = (m) => canLearn(mech, speciesId, m);
  const moveIds = [];
  for (const [name] of u?.moves ?? []) { const id = toID(name); if (mech.moves[id] && learnable(id) && !moveIds.includes(id)) moveIds.push(id); if (moveIds.length === 4) break; }
  for (const name of dexSpecies?.keyMoves ?? []) { if (moveIds.length === 4) break; const id = toID(name); if (mech.moves[id] && learnable(id) && !moveIds.includes(id)) moveIds.push(id); }
  const abilities = legalAbilities(mech, speciesId);
  let ability = abilities.length === 1 ? abilities[0] : '';
  for (const [name] of u?.abilities ?? []) { const id = toID(name); if (abilities.includes(id)) { ability = id; break; } }
  let item = '';
  for (const [name] of u?.items ?? []) { const id = toID(name); if (mech.items[id] && (!mech.items[id].megaStone || mech.items[id].megaStone[speciesId])) { item = id; break; } }
  let nature = '';
  const spread = commonSpread(mech, u);
  if (spread) nature = spread.nature;
  const data = { item, ability, nature, moves: moveIds, sp: 'unknown', cosmetic: emptyCosmetic() };
  const p = { source: 'ladder', asOf };
  const provenance = { item: item ? p : null, ability: ability ? (abilities.length === 1 ? { source: 'fixed', asOf } : p) : null, nature: nature ? p : null, moves: moveIds.map(() => p), sp: null };
  const missing = ['item', 'ability', 'nature'].filter((f) => !data[f]).concat(moveIds.length < 4 ? ['moves'] : []);
  return { data, provenance, missing };
}

/** The top usage spread when it is a legal Stat Point spread ("Nature:hp/atk/def/spa/spd/spe"); otherwise null. */
export function commonSpread(mech, u) {
  for (const [s] of u?.spreads ?? []) {
    const m = /^([A-Za-z]+):(\d+)\/(\d+)\/(\d+)\/(\d+)\/(\d+)\/(\d+)$/.exec(s);
    if (!m || !mech.natures[toID(m[1])]) continue;
    const vals = m.slice(2).map(Number);
    if (vals.some((v) => v > SP_PER_STAT) || vals.reduce((a, b) => a + b, 0) > SP_TOTAL) continue;
    return { nature: toID(m[1]), sp: Object.fromEntries(STAT_IDS.map((k, i) => [k, vals[i]])) };
  }
  return null;
}

// ---------- roster ----------
/** Out-of-battle species a coach can field from their roster (dex ids; split formes like Meowstic-F are separate dex species). */
export function rosterSpecies(mech, rosterIds) {
  const set = new Set();
  for (const id of rosterIds) if (mech.species[id] && !mech.species[id].mega) set.add(id);
  return set;
}
/** Roster changes between a workspace snapshot and the sheet now. */
export function rosterDiff(snapshotIds, nowIds) {
  const a = new Set(snapshotIds), b = new Set(nowIds);
  return { added: [...b].filter((x) => !a.has(x)), removed: [...a].filter((x) => !b.has(x)) };
}

// ---------- variants ----------
/** The set chosen for a species in a variant, else the newest set for that species. */
export function setForSpecies(ws, variant, speciesId) {
  const id = variant?.setIds?.[speciesId];
  const l = (ws.theirSets ?? []).find((s) => s.id === id) ?? (ws.theirSets ?? []).filter((s) => s.speciesId === speciesId).sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))[0];
  return l ?? null;
}
/** The variant calcs and briefs use by default: Worst for me when it exists, else Likely, else the first. */
export function defaultVariant(ws) {
  return ws.variants.find((v) => v.role === 'worst-plausible') ?? ws.variants.find((v) => v.role === 'likely') ?? ws.variants[0] ?? null;
}

// ---------- reveals into their sets ----------
const STRONG = new Set(['sheet-open', 'seen-vs-me', 'fixed']);
/**
 * Put a move/item/ability they showed against you into their set as a new version (source 'seen-vs-me').
 * A move fills an empty slot, else replaces the weakest-sourced guessed move; if all four are already confirmed it
 * returns { conflict: 'moves-full' } instead of guessing which to drop. Already there and confirmed: { same: true }.
 */
export function applyReveal(lineage, reveal, { now }) {
  const cur = currentVersion(lineage);
  const data = structuredClone(cur.data);
  const prov = structuredClone(cur.provenance ?? { item: null, ability: null, nature: null, moves: [], sp: null });
  const seen = { source: 'seen-vs-me', asOf: now.slice(0, 10) };
  if (reveal.kind === 'item' || reveal.kind === 'ability') {
    if (data[reveal.kind] === reveal.value && prov[reveal.kind]?.source === 'seen-vs-me') return { same: true };
    data[reveal.kind] = reveal.value;
    prov[reveal.kind] = seen;
  } else if (reveal.kind === 'move') {
    const moves = [...(data.moves ?? [])];
    prov.moves = [...(prov.moves ?? [])];
    let i = moves.indexOf(reveal.value);
    if (i >= 0 && prov.moves[i]?.source === 'seen-vs-me') return { same: true };
    if (i < 0) i = moves.length < 4 ? moves.length : moves.findIndex((m) => !m);
    if (i < 0) {
      const weak = moves.map((m, j) => ({ j, r: SOURCE_RANK[prov.moves[j]?.source] ?? 0, strong: STRONG.has(prov.moves[j]?.source) })).filter((x) => !x.strong).sort((a, b) => a.r - b.r || b.j - a.j)[0];
      if (!weak) return { conflict: 'moves-full' };
      i = weak.j;
    }
    moves[i] = reveal.value;
    prov.moves[i] = seen;
    data.moves = moves;
  } else return { unsupported: true };
  return { lineage: addVersion(lineage, data, { now, reason: 'reveal', provenance: prov }) };
}

// ---------- your sets and who has seen them ----------
export function addRevealed(lineage, entry) {
  const list = lineage.revealedTo ?? [];
  const key = (e) => `${e.who}|${e.where}|${(e.what ?? []).join(',')}`;
  if (list.some((e) => key(e) === key(entry))) return lineage;
  return { ...lineage, revealedTo: [...list, entry] };
}
export const seenByWho = (lineage) => [...new Set((lineage.revealedTo ?? []).map((e) => e.who))];

export const allSettable = settableSpecies;

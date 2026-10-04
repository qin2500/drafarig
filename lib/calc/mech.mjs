// Reg M-C mechanics data (data/mechanics.json, projected from the pinned Pokémon Showdown simulator and its team validator)
// and the set gate every layer uses: the paste importer, the set store/editor and the calc wrapper each call checkSet()
// independently, so a set that bypassed one layer (e.g. a hand-edited backup) is still refused by the next.
// Legality = species.legal + learnsets[outOfBattle] + items + species.abilities. Calculator data never decides legality.
import { spProblems, computeStats, STAT_IDS } from './stats.mjs';

export const toID = (s) => {
  const a = String(s ?? '').toLowerCase();
  return a === 'flabébé' ? 'flabebe' : a.replace(/[^a-z0-9]+/g, '');
};

/** Index the projection once. Returns the same object with lookup helpers attached under `ix`. */
export function loadMechanics(raw) {
  if (!raw || raw.meta?.schema !== 'drafarig.mechanics-app/1') throw new Error('Unsupported mechanics data');
  const learn = new Map();
  for (const [sp, idxs] of Object.entries(raw.learnsets)) learn.set(sp, new Set(idxs.map((i) => raw.learnsetMoves[i])));
  const byName = (table) => new Map(Object.entries(table).map(([id, e]) => [toID(e.name), id]));
  const megaOf = new Map(); // out-of-battle species id -> [{stone, forme}]
  for (const [stone, it] of Object.entries(raw.items)) {
    if (!it.megaStone) continue;
    for (const [base, forme] of Object.entries(it.megaStone)) {
      if (!megaOf.has(base)) megaOf.set(base, []);
      megaOf.get(base).push({ stone, forme });
    }
  }
  const outOfBattle = new Map(); // forme id (incl. Megas) -> out-of-battle id
  for (const [id, s] of Object.entries(raw.species)) outOfBattle.set(id, s.outOfBattle);
  const ix = { learn, megaOf, outOfBattle, speciesByName: byName(raw.species), movesByName: byName(raw.moves), itemsByName: byName(raw.items),
    abilitiesByName: byName(raw.abilities), naturesByName: byName(raw.natures) };
  return Object.assign(Object.create(null), raw, { ix });
}

export const species = (m, id) => m.species[id] ?? null;
export const move = (m, id) => m.moves[id] ?? null;
export const item = (m, id) => m.items[id] ?? null;
export const ability = (m, id) => m.abilities[id] ?? null;
export const nature = (m, id) => m.natures[id] ?? null;
export const isMegaStone = (m, id) => !!m.items[id]?.megaStone;
export const canLearn = (m, speciesId, moveId) => !!m.ix.learn.get(m.species[speciesId]?.outOfBattle ?? speciesId)?.has(moveId);
export const learnset = (m, speciesId) => [...(m.ix.learn.get(m.species[speciesId]?.outOfBattle ?? speciesId) ?? [])].sort();

/** Out-of-battle species that are draftable/settable (not Mega formes). */
export const settableSpecies = (m) => Object.keys(m.species).filter((id) => m.species[id].legal && !m.species[id].mega && m.species[id].outOfBattle === id);

/**
 * The battle forme for a set: its out-of-battle species, or the Mega forme its stone maps to (projection maps only;
 * the calculator's own getForme is wrong for 8 stones). Returns { id, mega, stone } or { error } when the stone is for
 * another species.
 */
export function battleForme(m, speciesId, itemId, { megaEvolved = true } = {}) {
  const sp = m.species[speciesId];
  if (!sp) return { error: 'species-unknown' };
  const st = m.items[itemId];
  if (!st?.megaStone) return { id: speciesId, mega: false, stone: null };
  const forme = st.megaStone[sp.outOfBattle];
  if (!forme) return { error: 'mega-stone-mismatch' };
  return megaEvolved ? { id: forme, mega: true, stone: itemId } : { id: speciesId, mega: false, stone: itemId };
}

/** Abilities a set may have: the out-of-battle species' validator-legal abilities. A Mega forme's ability is forced in battle. */
export const legalAbilities = (m, speciesId) => (m.species[speciesId]?.abilities ?? []).map(toID);

/**
 * The shared set gate. set = { species, item, ability, nature, moves[], sp } with ids (toID).
 * side 'theirs' allows sp:'unknown'. Returns [{code, severity:'error'|'warning', ...detail}].
 */
export function checkSet(m, set, { side = 'mine' } = {}) {
  const out = [];
  const err = (code, d = {}) => out.push({ code, severity: 'error', ...d });
  const warn = (code, d = {}) => out.push({ code, severity: 'warning', ...d });
  if (!set || typeof set !== 'object') { err('set-missing'); return out; }
  const sp = m.species[set.species];
  if (!sp) err('species-unknown', { value: set.species });
  else if (!sp.legal) err('species-not-in-regulation', { value: set.species });
  else if (sp.mega || sp.outOfBattle !== set.species) err('species-is-battle-forme', { value: set.species, base: sp.outOfBattle });
  if (set.item) {
    if (!m.items[set.item]) err('item-not-in-regulation', { value: set.item });
    else if (sp && m.items[set.item].megaStone && !m.items[set.item].megaStone[sp.outOfBattle]) err('mega-stone-mismatch', { value: set.item });
  }
  if (!set.ability) err('ability-missing');
  else if (sp && sp.legal && !legalAbilities(m, set.species).includes(set.ability)) err('ability-not-legal', { value: set.ability });
  if (!set.nature) err('nature-missing');
  else if (!m.natures[set.nature]) err('nature-unknown', { value: set.nature });
  const moves = Array.isArray(set.moves) ? set.moves.filter(Boolean) : null;
  if (!moves) err('moves-missing');
  else {
    if (!moves.length) err('moves-empty');
    if (moves.length > 4) err('moves-too-many', { count: moves.length });
    const seen = new Set();
    for (const mv of moves) {
      if (seen.has(mv)) err('move-duplicate', { value: mv });
      seen.add(mv);
      if (!m.moves[mv]) err('move-not-in-regulation', { value: mv });
      else if (sp && sp.legal && !canLearn(m, set.species, mv)) err('move-not-learnable', { value: mv });
    }
  }
  if (set.sp === 'unknown') { if (side !== 'theirs') err('sp-unknown-not-allowed'); }
  else for (const p of spProblems(set.sp)) err(p.code, p);
  if (set.sp !== 'unknown' && set.sp && STAT_IDS.every((s) => !set.sp[s]) && (!set.nature || set.nature === 'serious')) {
    warn('sp-zero-serious'); // Showdown's validator rejects 0 SP with Serious / no nature; export switches to Hardy
  }
  return out;
}
export const setErrors = (m, set, opts) => checkSet(m, set, opts).filter((p) => p.severity === 'error');
export const isUsable = (m, set, opts) => setErrors(m, set, opts).length === 0;

/** Stats of a set (its battle forme when it Mega Evolves). sp 'unknown' -> null. */
export function setStats(m, set, { megaEvolved = true } = {}) {
  if (!set || set.sp === 'unknown') return null;
  const f = battleForme(m, set.species, set.item, { megaEvolved });
  if (f.error) return null;
  return computeStats(m.species[f.id].baseStats, set.sp, m.natures[set.nature] ?? null);
}

export const displayName = (m, kind, id) => (kind === 'species' ? m.species : kind === 'moves' ? m.moves : kind === 'items' ? m.items : kind === 'abilities' ? m.abilities : m.natures)[id]?.name ?? id;

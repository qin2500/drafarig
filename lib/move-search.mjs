// Move search (Battle Prep › Move search): which mons in a pool can LEARN a move matching a query, from the full legal
// learnsets in data/mechanics.json (never ladder usage: a drafted mon with no usage data is searched like any other), with
// their abilities and the ability-move synergies that make a move hit harder (Sheer Force + a secondary effect, Technician
// + ≤ 60 BP, …). Pure; the screen is public/prep-moves.js.
import { toID, legalAbilities } from './calc/mech.mjs';

export const SPREAD_TARGETS = Object.freeze(['allAdjacentFoes', 'allAdjacent']);
const damaging = (m) => m.category !== 'Status';
/**
 * Abilities that power up (or change) a move, with the test. stab: the move's type is one of the mon's types.
 * label: what the screen says beside the ability.
 */
export const SYNERGY = Object.freeze({
  sheerforce: { label: '×1.3, no secondary effect (Life Orb recoil off too)', test: (m) => damaging(m) && m.hasSecondary },
  technician: { label: '×1.5 for moves ≤ 60 BP', test: (m) => damaging(m) && m.basePower > 0 && m.basePower <= 60 },
  toughclaws: { label: '×1.3 contact', test: (m) => damaging(m) && m.flags.includes('contact') },
  ironfist: { label: '×1.2 punches', test: (m) => damaging(m) && m.flags.includes('punch') },
  strongjaw: { label: '×1.5 bites', test: (m) => damaging(m) && m.flags.includes('bite') },
  megalauncher: { label: '×1.5 pulses', test: (m) => damaging(m) && m.flags.includes('pulse') },
  sharpness: { label: '×1.5 slicing', test: (m) => damaging(m) && m.flags.includes('slicing') },
  punkrock: { label: '×1.3 sound', test: (m) => damaging(m) && m.flags.includes('sound') },
  liquidvoice: { label: 'sound moves become Water', test: (m) => damaging(m) && m.flags.includes('sound') },
  skilllink: { label: 'multi-hit always max hits', test: (m) => damaging(m) && !!m.multihit },
  aerilate: { label: 'Normal → Flying ×1.2', test: (m) => damaging(m) && m.type === 'Normal' },
  pixilate: { label: 'Normal → Fairy ×1.2', test: (m) => damaging(m) && m.type === 'Normal' },
  refrigerate: { label: 'Normal → Ice ×1.2', test: (m) => damaging(m) && m.type === 'Normal' },
  adaptability: { label: 'STAB ×2', test: (m, sp) => damaging(m) && sp.types.includes(m.type) },
  hugepower: { label: 'Attack ×2', test: (m) => m.category === 'Physical' },
  purepower: { label: 'Attack ×2', test: (m) => m.category === 'Physical' },
});
export const FLAGS = Object.freeze({
  spread: (m) => SPREAD_TARGETS.includes(m.target),
  priority: (m) => m.priority > 0,
  contact: (m) => m.flags.includes('contact'),
  sound: (m) => m.flags.includes('sound'),
  secondary: (m) => !!m.hasSecondary && damaging(m),
});

/** Does a move match the query? q: { text, type, category ('Physical'|'Special'|'Status'|'damaging'), minBP, flags: [..] }. */
export function moveMatches(m, q = {}) {
  if (!m) return false;
  const t = toID(q.text ?? '');
  if (t && !toID(m.name).includes(t)) return false;
  if (q.type && m.type !== q.type) return false;
  if (q.category === 'damaging' ? !damaging(m) : q.category && m.category !== q.category) return false;
  if (q.minBP && !(m.basePower >= q.minBP)) return false;
  for (const f of q.flags ?? []) if (FLAGS[f] && !FLAGS[f](m)) return false;
  return true;
}
/** Every forme a pool entry can battle as: the species and its Megas (each Mega keeps the base learnset). */
const formesOf = (mech, sp) => [sp, ...(mech.ix.megaOf.get(sp) ?? []).map((x) => x.forme)];
/** Abilities across formes: [{id, forme, synergy: [moveIds]}]. */
function abilitiesOf(mech, sp) {
  const out = [];
  for (const f of formesOf(mech, sp)) {
    const ids = f === sp ? legalAbilities(mech, sp) : (mech.species[f].abilities ?? []).map(toID);
    for (const id of ids) if (!out.some((a) => a.id === id)) out.push({ id, forme: f });
  }
  return out;
}

/**
 * Search a pool. pool: [{ species, coach? }] (out-of-battle ids). q as moveMatches plus ability (id: the mon must be able to
 * have it in some forme). Returns [{ species, coach, formes, abilities:[{id, forme, synergy:[moveIds], label}], moves:
 * [{id, synergy:[abilityIds]}], best (the highest-BP match) }], mons with a synergy first, then by the best match's BP.
 */
export function searchMoves(mech, pool, q = {}) {
  const want = mech.learnsetMoves.filter((id) => moveMatches(mech.moves[id], q));
  if (!want.length) return [];
  const wantAbility = q.ability ? toID(q.ability) : '';
  const out = [];
  for (const { species: sp, coach = null } of pool) {
    const s = mech.species[sp];
    if (!s || s.mega) continue;
    const learn = mech.ix.learn.get(s.outOfBattle ?? sp);
    if (!learn) continue;
    const ids = want.filter((id) => learn.has(id));
    if (!ids.length) continue;
    const abil = abilitiesOf(mech, sp);
    if (wantAbility && !abil.some((a) => a.id === wantAbility)) continue;
    const moves = ids.map((id) => ({ id, synergy: abil.filter((a) => SYNERGY[a.id]?.test(mech.moves[id], mech.species[a.forme])).map((a) => a.id) }));
    const abilities = abil.map((a) => ({ ...a, synergy: moves.filter((m) => m.synergy.includes(a.id)).map((m) => m.id), label: SYNERGY[a.id]?.label ?? null }));
    moves.sort((a, b) => b.synergy.length - a.synergy.length || (mech.moves[b.id].basePower ?? 0) - (mech.moves[a.id].basePower ?? 0) || a.id.localeCompare(b.id));
    out.push({ species: sp, coach, formes: formesOf(mech, sp), abilities, moves, best: moves[0].id, synergy: moves.some((m) => m.synergy.length) });
  }
  const bp = (r) => mech.moves[r.best].basePower ?? 0;
  return out.sort((a, b) => b.synergy - a.synergy || bp(b) - bp(a) || a.species.localeCompare(b.species));
}

/**
 * The worst case of one of their moves into one of your sets: a max-attack set (+ nature on the move's stat, 32 SP in it),
 * the synergy ability when there is one (else its first), Life Orb, the forme that has that ability. For the result chip.
 */
export function worstCaseAttacker(mech, result, moveId) {
  const mv = mech.moves[moveId];
  const syn = result.abilities.find((a) => a.synergy.includes(moveId));
  const ab = syn ?? result.abilities[0];
  const forme = ab.forme;
  const stat = mv.category === 'Special' ? 'spa' : 'atk';
  const nature = stat === 'spa' ? 'modest' : 'adamant';
  const mega = forme !== result.species;
  const item = mega ? (mech.ix.megaOf.get(result.species) ?? []).find((x) => x.forme === forme)?.stone : 'lifeorb';
  // a Mega's set keeps a base ability (the calc applies the Mega's own)
  return { set: { species: result.species, item, ability: mega ? legalAbilities(mech, result.species)[0] : ab.id, nature, moves: [moveId], sp: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, [stat]: 32 } }, mega, forme, ability: ab.id };
}

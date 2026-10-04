// The calc scenario (drafarig.calc-scenario/1): everything one damage calc depends on, with every field present.
// normalizeScenario() is used before keys are computed and before the engine sees anything, so two scenarios that mean
// the same thing always produce the same key, and a missing field can't silently take an engine default.
import { STAT_IDS } from './stats.mjs';

export const SCENARIO_SCHEMA = 'drafarig.calc-scenario/1';
export const WEATHERS = Object.freeze(['', 'Sun', 'Rain', 'Sand', 'Snow']);
export const TERRAINS = Object.freeze(['', 'Electric', 'Grassy', 'Psychic', 'Misty']);
export const STATUSES = Object.freeze(['', 'brn', 'par', 'psn', 'tox', 'slp', 'frz']);
export const BOOST_STATS = Object.freeze(['atk', 'def', 'spa', 'spd', 'spe']);
export const FORMS = Object.freeze(['', 'shield', 'blade', 'zero', 'hero', 'fullbelly', 'hangry']);

const bool = (v, d = false) => (typeof v === 'boolean' ? v : d);
const int = (v, lo, hi, d) => (Number.isInteger(v) && v >= lo && v <= hi ? v : d);
const oneOf = (v, list, d) => (list.includes(v) ? v : d);
const str = (v) => (typeof v === 'string' ? v : '');
const nullableInt = (v, lo, hi) => (Number.isInteger(v) && v >= lo && v <= hi ? v : null);

export function normalizeSet(set = {}) {
  const plain = set.sp !== null && typeof set.sp === 'object' && !Array.isArray(set.sp) && Object.keys(set.sp).every((k) => STAT_IDS.includes(k));
  // invalid shapes pass through unchanged so the set gate refuses them (never silently 0 Stat Points)
  const sp = set.sp === 'unknown' ? 'unknown' : plain ? Object.fromEntries(STAT_IDS.map((s) => [s, set.sp[s] ?? 0])) : set.sp ?? null;
  return {
    species: str(set.species), item: str(set.item), ability: str(set.ability), nature: str(set.nature),
    moves: (Array.isArray(set.moves) ? set.moves.filter((x) => typeof x === 'string' && x) : []).slice(), sp,
    gender: oneOf(set.gender ?? set.cosmetic?.gender ?? '', ['', 'M', 'F'], ''),
  };
}

export function normalizeSideState(s = {}) {
  return {
    mega: bool(s.mega, true),
    boosts: Object.fromEntries(BOOST_STATS.map((k) => [k, int(s.boosts?.[k], -6, 6, 0)])),
    status: oneOf(s.status, STATUSES, ''),
    hpPct: int(s.hpPct, 1, 100, 100),
    intimidated: int(s.intimidated, 0, 2, 0),
    itemConsumed: bool(s.itemConsumed),
    abilityOn: bool(s.abilityOn),
    faintedAllies: nullableInt(s.faintedAllies, 0, 3),
    timesHit: nullableInt(s.timesHit, 0, 6),
    tracedAbility: str(s.tracedAbility),
    proteanActive: bool(s.proteanActive, true),
    form: oneOf(s.form, FORMS, ''),
    disguiseIntact: bool(s.disguiseIntact, true),
  };
}

export function normalizeScenario(sc = {}) {
  const f = sc.field ?? {}, a = f.attackerSide ?? {}, d = f.defenderSide ?? {}, m = sc.move ?? {}, ms = m.state ?? {};
  return {
    schema: SCENARIO_SCHEMA,
    attacker: { set: normalizeSet(sc.attacker?.set), state: normalizeSideState(sc.attacker?.state) },
    defender: { set: normalizeSet(sc.defender?.set), state: normalizeSideState(sc.defender?.state) },
    move: {
      id: str(m.id), crit: bool(m.crit), hits: int(m.hits, 0, 10, 0), firstHitOnly: bool(m.firstHitOnly),
      state: {
        movesLast: bool(ms.movesLast), hitFirstThisTurn: bool(ms.hitFirstThisTurn), lastMoveFailed: bool(ms.lastMoveFailed),
        fickleDouble: bool(ms.fickleDouble), targetAlreadyHit: bool(ms.targetAlreadyHit),
      },
    },
    field: {
      weather: oneOf(f.weather, WEATHERS, ''), terrain: oneOf(f.terrain, TERRAINS, ''),
      gravity: bool(f.gravity), magicRoom: bool(f.magicRoom), wonderRoom: bool(f.wonderRoom), otherFairyAura: bool(f.otherFairyAura),
      attackerSide: { helpingHand: bool(a.helpingHand), tailwind: bool(a.tailwind), steelySpirit: bool(a.steelySpirit), charge: bool(a.charge), allyPresent: bool(a.allyPresent, true), unnerve: bool(a.unnerve), flowerVeil: bool(a.flowerVeil) },
      defenderSide: {
        reflect: bool(d.reflect), lightScreen: bool(d.lightScreen), auroraVeil: bool(d.auroraVeil), friendGuard: bool(d.friendGuard),
        protect: bool(d.protect), tailwind: bool(d.tailwind), partnerPresent: bool(d.partnerPresent, true), priorityBlock: bool(d.priorityBlock), flowerVeil: bool(d.flowerVeil),
      },
    },
  };
}

/** A scenario with the two sides swapped (their hit on you <-> your hit on them), moves reset. */
export function swapSides(sc) {
  const n = normalizeScenario(sc);
  return normalizeScenario({
    ...n, attacker: n.defender, defender: n.attacker, move: { id: '' },
    field: { ...n.field, attackerSide: { tailwind: n.field.defenderSide.tailwind, allyPresent: n.field.defenderSide.partnerPresent }, defenderSide: { tailwind: n.field.attackerSide.tailwind, partnerPresent: n.field.attackerSide.allyPresent } },
  });
}

// Worst-case threat scan (docs/research/strategy/threat-scan.md §2): for every form of every drafted opponent mon, its
// full legal learnset × legal abilities × realistic items × a max-offence spread, into each of your sets, under every
// weather / terrain their roster can set (and your own sun when the target is Mega Charizard Y). Ranked by
// severity = OHKO odds × plausibility (× 1.25 spread, × 1.25 priority). Forms with no ladder data are NOT down-weighted.
// Pure: calc (lib/calc/wrapper), mech, and the ladder usage table (or null) come in.
import { toID, legalAbilities, battleForme } from './calc/mech.mjs';
import { normalizeScenario } from './calc/scenario.mjs';
import { SYNERGY, SPREAD_TARGETS } from './move-search.mjs';
import { WEATHER_ABILITY } from './prep-build.mjs';

export const TERRAIN_ABILITY = Object.freeze({ electricsurge: 'Electric', grassysurge: 'Grassy', psychicsurge: 'Psychic', mistysurge: 'Misty' });
/** Abilities whose damage differs from "no ability": each is scanned on its own; the rest collapse into one row. */
const DAMAGE_ABILITIES = new Set([...Object.keys(SYNERGY), 'reckless', 'waterbubble', 'protean', 'libero', 'guts', 'sniper', 'tintedlens', 'solarpower', 'sandforce',
  'analytic', 'steelworker', 'transistor', 'dragonsmaw', 'rockypayload', 'galvanize', 'normalize', 'hustle', 'gorillatactics', 'parentalbond', 'neuroforce',
  'supremeoverlord', 'stakeout', 'flareboost', 'toxicboost', 'darkaura', 'fairyaura', 'scrappy', 'moldbreaker', 'teravolt', 'turboblaze', 'mindseye', 'infiltrator']);
const SKIP_MOVES = new Set(['tripleaxel', 'populationbomb']);
const OUR_SUN = Object.freeze({ weather: 'Sun', terrain: '', by: { mine: true } });
// the move type's boosting item (×4915/4096): only where it's in the regulation's item pool
const TYPE_ITEM = { Normal: 'silkscarf', Fire: 'charcoal', Water: 'mysticwater', Electric: 'magnet', Grass: 'miracleseed', Ice: 'nevermeltice', Fighting: 'blackbelt',
  Poison: 'poisonbarb', Ground: 'softsand', Flying: 'sharpbeak', Psychic: 'twistedspoon', Bug: 'silverpowder', Rock: 'hardstone', Ghost: 'spelltag', Dragon: 'dragonfang',
  Dark: 'blackglasses', Steel: 'metalcoat', Fairy: 'fairyfeather' };
const RECOIL = new Set(['bravebird', 'doubleedge', 'flareblitz', 'woodhammer', 'headsmash', 'wildcharge', 'volttackle', 'takedown', 'headlongrush', 'wavecrash', 'submission', 'highjumpkick', 'jumpkick']);

/** A usage entry's percentage for an id, from either the slimmed [[name, pct]] lists or {id: pct} objects. */
const pctOf = (table, id) => { if (!table) return 0; if (Array.isArray(table)) { const x = table.find(([n]) => toID(n) === id); return x ? x[1] : 0; } return table[id] ?? 0; };
const topOf = (table) => { if (!table) return null; const list = Array.isArray(table) ? table : Object.entries(table).sort((a, b) => b[1] - a[1]); return list.length ? toID(list[0][0]) : null; };
const synergyOf = (mech, ability, mv, forme) => (ability === 'reckless' ? RECOIL.has(mv.id ?? '') : ability === 'waterbubble' ? mv.type === 'Water' : ability === 'protean' || ability === 'libero' ? true : SYNERGY[ability]?.test(mv, mech.species[forme]) ?? false);

/** §2 plausibility = move × ability × item. u: that form's ladder usage, or null (no data: no penalty). */
export function plausibility(mech, { forme, moveId, ability, item, mega, superEffective, u }) {
  const mv = { ...mech.moves[moveId], id: moveId };
  const stab = mech.species[forme].types.includes(mv.type);
  const syn = synergyOf(mech, ability, mv, forme);
  if (u) {
    const pm = pctOf(u.moves, moveId) >= 5 ? 1 : stab || syn ? 0.7 : 0.5;
    const pa = mega || topOf(u.abilities) === ability ? 1 : syn ? 0.8 : 0.3;
    const pi = mega ? 1 : item && pctOf(u.items, item) >= 5 ? 1 : !item || item === 'lifeorb' ? 0.9 : 0.8;
    return pm * pa * pi;
  }
  const pm = stab || syn || superEffective ? 0.9 : 0.7;
  const pa = mega || syn ? 1 : 0.8;
  const pi = mega || !item || item === 'lifeorb' ? 1 : 0.9;
  return pm * pa * pi;
}

/** Fields to scan: none, plus every weather / terrain their roster can set (any forme). [{weather, terrain, by}] */
export function rosterFields(mech, pool) {
  const out = [{ weather: '', terrain: '', by: null }];
  for (const { species: sp } of pool) {
    const formes = [sp, ...(mech.ix.megaOf.get(sp) ?? []).map((x) => x.forme)];
    for (const f of formes) {
      const abil = f === sp ? legalAbilities(mech, sp) : (mech.species[f]?.abilities ?? []).map(toID);
      for (const a of abil) {
        if (WEATHER_ABILITY[a] && !out.some((x) => x.weather === WEATHER_ABILITY[a] && !x.terrain)) out.push({ weather: WEATHER_ABILITY[a], terrain: '', by: { species: f, ability: a } });
        if (TERRAIN_ABILITY[a] && !out.some((x) => x.terrain === TERRAIN_ABILITY[a] && !x.weather)) out.push({ weather: '', terrain: TERRAIN_ABILITY[a], by: { species: f, ability: a } });
      }
    }
  }
  return out;
}

/** The attacker variants of one drafted mon: [{forme, mega, ability, items:[...]}]; neutral abilities collapse into one. */
function variantsOf(mech, sp, u) {
  const out = [];
  const abil = legalAbilities(mech, sp);
  const dmg = abil.filter((a) => DAMAGE_ABILITIES.has(a) || WEATHER_ABILITY[a] || TERRAIN_ABILITY[a]);
  const neutral = abil.filter((a) => !dmg.includes(a));
  const rep = neutral.length ? (neutral.includes(topOf(u?.abilities)) ? topOf(u.abilities) : neutral[0]) : null;
  const ladderItem = topOf(u?.items);
  const extra = ladderItem && ladderItem !== 'lifeorb' && mech.items[ladderItem] && !mech.items[ladderItem].megaStone ? [ladderItem] : [];
  for (const a of [...dmg, ...(rep ? [rep] : [])]) out.push({ forme: sp, mega: false, ability: a, setAbility: a, items: ['lifeorb', ...extra] });
  // a Mega: its stone; the set keeps a base ability (the calc applies the Mega's own), the row names the Mega's
  for (const { stone, forme } of mech.ix.megaOf.get(sp) ?? []) out.push({ forme, mega: true, ability: toID(mech.species[forme].abilities[0] ?? ''), setAbility: abil[0], items: [stone] });
  return out;
}

/**
 * The scan. pool: [{species, coach}] (their drafted mons); targets: [{key, label, set, mega}] (your sets as calc data);
 * opts: { usage (ladder table or null), typeEff(type, types) -> multiplier, zardSun (default true) }.
 * Returns rows [{coach, species, forme, mega, ability, item, move, field, target, lo, hi, min, max, hp, odds, sash,
 * plausibility, severity, spread, priority, ladderSet}], highest severity first. A Sash row ("Sash holds") has odds 0.
 */
export function scanThreats(calc, mech, pool, targets, { usage = null, typeEff = null, zardSun = true } = {}) {
  const fields = rosterFields(mech, pool);
  const withZard = zardSun && targets.some((t) => battleForme(mech, t.set.species, t.set.item)?.id === 'charizardmegay');
  const rows = [];
  for (const { species: sp, coach = null } of pool) {
    if (!mech.species[sp] || mech.species[sp].mega) continue;
    const learn = [...(mech.ix.learn.get(mech.species[sp].outOfBattle ?? sp) ?? [])].filter((id) => {
      const m = mech.moves[id];
      return m && m.category !== 'Status' && !SKIP_MOVES.has(id) && (m.basePower > 0 || id === 'finalgambit');
    });
    for (const v of variantsOf(mech, sp, usage?.species?.[sp] ?? null)) {
      const u = usage?.species?.[v.forme] ?? (v.mega ? null : usage?.species?.[sp]) ?? null;
      for (const moveId of learn) {
        const mv = mech.moves[moveId];
        const stat = mv.category === 'Special' ? 'spa' : 'atk';
        const spread = SPREAD_TARGETS.includes(mv.target), priority = mv.priority > 0;
        for (const t of targets) {
          const tForme = battleForme(mech, t.set.species, t.set.item)?.id ?? t.set.species;
          const tTypes = mech.species[tForme]?.types ?? [];
          // Mega Charizard Y brings its own sun (Drought): it replaces "no weather" for it, and its partners are hit in that
          // sun too (so a spread move's two targets share a field); their own weathers still apply
          const myFields = zardSun && tForme === 'charizardmegay' ? [OUR_SUN, ...fields.filter((f) => f.weather && f.weather !== 'Sun' || f.terrain)]
            : withZard && !fields.some((f) => f.weather === 'Sun') ? [...fields, OUR_SUN] : fields;
          // Life Orb (the strongest legal booster), the move type's item (×1.2, sometimes the realistic one), the ladder item
          const items = v.mega ? v.items : [...new Set([...v.items, ...(TYPE_ITEM[mv.type] && mech.items[TYPE_ITEM[mv.type]] ? [TYPE_ITEM[mv.type]] : [])])];
          for (const item of items) {
            for (const f of myFields) {
              const sc = normalizeScenario({
                attacker: { set: { species: sp, item, ability: v.setAbility, nature: stat === 'spa' ? 'modest' : 'adamant', moves: [moveId], sp: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, [stat]: 32 } }, state: { mega: v.mega } },
                defender: { set: { ...t.set, gender: '' }, state: { mega: t.mega !== false } }, move: { id: moveId },
                field: { ...(f.weather ? { weather: f.weather } : {}), ...(f.terrain ? { terrain: f.terrain } : {}) },
              });
              const r = calc.run(sc, { lite: true });
              if (r.class !== 'exact') continue;
              const one = r.ko.one;
              const sash = t.set.item === 'focussash' && one.num === '0' && r.range.max >= r.maxHP;
              const odds = one.refused !== undefined ? 0 : Number(one.num) / Number(one.den);
              if (r.range.max / r.maxHP < 0.5 && odds === 0) continue; // nothing to rank: under half, no KO
              const se = typeEff ? typeEff(mv.type, tTypes) >= 2 : false;
              const plaus = plausibility(mech, { forme: v.forme, moveId, ability: v.ability, item: v.mega ? item : item, mega: v.mega, superEffective: se, u });
              const severity = odds * plaus * (spread ? 1.25 : 1) * (priority ? 1.25 : 1);
              rows.push({ coach, species: sp, forme: v.forme, mega: v.mega, ability: v.ability, item, move: moveId, field: f, target: t.key, targetForme: tForme,
                lo: Math.floor((1000 * r.range.min) / r.maxHP) / 10, hi: Math.floor((1000 * r.range.max) / r.maxHP) / 10, min: r.range.min, max: r.range.max, hp: r.maxHP,
                odds, sash, plausibility: Math.round(plaus * 1000) / 1000, severity: Math.round(severity * 1000) / 1000, spread, priority, ladderSet: !!u && pctOf(u.moves, moveId) >= 5 && (v.mega || topOf(u.abilities) === v.ability) });
            }
          }
        }
      }
    }
  }
  return rows.sort((a, b) => b.severity - a.severity || b.lo - a.lo);
}

// ---------- what to show (§2) ----------
const same = (a, b) => a.forme === b.forme && a.ability === b.ability && a.item === b.item && a.move === b.move && a.field.weather === b.field.weather && a.field.terrain === b.field.terrain;
/** 1. Every row that OHKOs Mega Charizard Y (≥ 50%) with plausibility ≥ 0.6: the best row per (form, move). */
export const zardKOs = (rows) => dedupe(rows.filter((r) => r.targetForme === 'charizardmegay' && r.odds >= 0.5 && r.plausibility >= 0.6), (r) => `${r.forme}|${r.move}`);
/** 2. Spread moves that OHKO two of your mons at once (≥ 50% each): [{row, targets:[rows]}]. */
export function spreadDoubles(rows) {
  const groups = new Map();
  for (const r of rows.filter((x) => x.spread && x.odds >= 0.5)) {
    const k = `${r.forme}|${r.ability}|${r.item}|${r.move}|${r.field.weather}|${r.field.terrain}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const out = [...groups.values()].map((g) => dedupe(g, (r) => r.target)).filter((g) => g.length >= 2).map((g) => ({ row: g[0], targets: g }));
  return dedupe(out.sort((a, b) => b.targets.length - a.targets.length || b.row.severity - a.row.severity), (x) => `${x.row.forme}|${x.row.move}|${x.targets.map((t) => t.target).sort().join(',')}`);
}
/** 3. Priority moves that OHKO (≥ 50%). */
export const priorityKOs = (rows) => dedupe(rows.filter((r) => r.priority && r.odds >= 0.5), (r) => `${r.forme}|${r.move}|${r.target}`);
/** 4. Per opponent mon (all its formes): its top n rows by severity, one per (move, target). */
export function topPerMon(rows, n = 3) {
  const by = new Map();
  for (const r of rows) {
    const list = by.get(r.species) ?? [];
    if (list.length < n && !list.some((x) => x.move === r.move && x.target === r.target) && r.severity > 0) list.push(r);
    by.set(r.species, list);
  }
  return by;
}
/** The rows threatening one of your sets (the teambuilder's "Threats to this mon"), best per (attacker form, move). */
export const threatsTo = (rows, targetKey, n = 6) => dedupe(rows.filter((r) => r.target === targetKey && (r.odds > 0 || r.sash)), (r) => `${r.forme}|${r.move}`).slice(0, n);
function dedupe(list, key) { const seen = new Set(); return list.filter((x) => { const k = key(x); if (seen.has(k)) return false; seen.add(k); return true; }); }
/** A type-effectiveness function from the vendored engine module (gen 9 chart). */
export function typeEffFrom(engine) {
  const gen = engine.Generations.get(9);
  return (type, types) => types.reduce((e, t) => e * (gen.types.get(toID(type))?.effectiveness?.[t] ?? 1), 1);
}
export { same as sameAttack };

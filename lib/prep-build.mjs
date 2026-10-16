// Build: the per-mon dashboard's pure logic (docs/research/ux/builder-dashboard.md v2, docs/research/dev/builder-plan.md).
// It only orchestrates what exists: targets come from their pool (their saved set, else a labelled ladder guess), KO
// benchmarks are lib/calc/threshold.mjs koSearch at a chosen stage (one or two uses), creep targets are outspeedSearch per
// target Speed, and trade-offs move the SP a setup move frees into bulk. The calc is injected; no engine import, no storage.
import { koSearch, surviveSearch, outspeedSearch, natureTradeoff, plusNatureFor } from './calc/threshold.mjs';
import { speedOf, statValue, natureSign, speedRange, compareSpeed, outspeedSP, SP_PER_STAT, SP_TOTAL, STAT_IDS } from './calc/stats.mjs';
import { battleForme, canLearn, legalAbilities, toID } from './calc/mech.mjs';
import { normalizeScenario } from './calc/scenario.mjs';
import { guessSet, commonSpread } from './prep-model.mjs';

// ---------- stat-stage moves (Showdown data/moves.ts: `boosts` on self-target moves, `self.boosts` on attacks) ----------
/** Status moves that raise the user's own stats. */
export const SELF_BOOST = Object.freeze({
  nastyplot: { spa: 2 }, swordsdance: { atk: 2 }, calmmind: { spa: 1, spd: 1 }, bulkup: { atk: 1, def: 1 }, dragondance: { atk: 1, spe: 1 },
  irondefense: { def: 2 }, acidarmor: { def: 2 }, amnesia: { spd: 2 }, cosmicpower: { def: 1, spd: 1 }, quiverdance: { spa: 1, spd: 1, spe: 1 },
  takeheart: { spa: 1, spd: 1 }, victorydance: { atk: 1, def: 1, spe: 1 }, tidyup: { atk: 1, spe: 1 }, workup: { atk: 1, spa: 1 },
  growth: { atk: 1, spa: 1 }, coil: { atk: 1, def: 1 }, howl: { atk: 1 }, honeclaws: { atk: 1 }, agility: { spe: 2 },
  shellsmash: { atk: 2, spa: 2, spe: 2, def: -1, spd: -1 }, curse: { atk: 1, def: 1, spe: -1 },
});
/** Damaging moves that change the user's own stats after hitting (Contrary reverses them). */
export const SELF_AFTER_HIT = Object.freeze({
  closecombat: { def: -1, spd: -1 }, superpower: { atk: -1, def: -1 }, armorcannon: { def: -1, spd: -1 }, headlongrush: { def: -1, spd: -1 },
  dragonascent: { def: -1, spd: -1 }, clangingscales: { def: -1 }, overheat: { spa: -2 }, dracometeor: { spa: -2 }, leafstorm: { spa: -2 },
  fleurcannon: { spa: -2 }, psychoboost: { spa: -2 }, makeitrain: { spa: -1 }, hammerarm: { spe: -1 }, icehammer: { spe: -1 }, spinout: { spe: -2 },
});
/** Your setup moves for an attacking stat, biggest first. */
const SETUP_ORDER = { spa: ['nastyplot', 'shellsmash', 'calmmind', 'quiverdance', 'takeheart', 'workup', 'growth'], atk: ['swordsdance', 'shellsmash', 'dragondance', 'bulkup', 'victorydance', 'tidyup', 'coil', 'howl', 'honeclaws', 'workup', 'curse'] };
/** Moves and abilities that work against a setup turn (the "tools against setup" list). */
export const SETUP_TOOLS = Object.freeze({
  moves: { encore: 'encore', ragepowder: 'redirect', followme: 'redirect', clearsmog: 'reset', haze: 'reset', spiritbreak: 'drop', snarl: 'drop', lightscreen: 'screen', reflect: 'screen', auroraveil: 'screen', roar: 'phaze', whirlwind: 'phaze', taunt: 'taunt', fakeout: 'flinch' },
  abilities: { unaware: 'unaware', imposter: 'copy' },
});
const PIVOTS = new Set(['uturn', 'voltswitch', 'flipturn', 'partingshot', 'teleport']);

/** The stat a damaging move attacks with on your side, and the defence it hits on theirs. */
export function moveStats(mech, moveId) {
  const mv = mech.moves[moveId];
  if (!mv || mv.category === 'Status') return null;
  const atk = moveId === 'bodypress' ? 'def' : mv.category === 'Physical' ? 'atk' : 'spa';
  const def = mv.category === 'Physical' || ['psyshock', 'psystrike', 'secretsword'].includes(moveId) ? 'def' : 'spd';
  return { atk, def };
}

/** The biggest learnable setup move for an attacking stat: { move, stage } or null. */
export function setupMoveFor(mech, speciesId, stat) {
  for (const m of SETUP_ORDER[stat] ?? []) if (canLearn(mech, speciesId, m) && SELF_BOOST[m][stat] > 0) return { move: m, stage: SELF_BOOST[m][stat] };
  return null;
}
/** The setup move a set already has for a stat (the biggest one), or null. */
export function setupIn(set, stat) {
  const has = (SETUP_ORDER[stat] ?? []).filter((m) => set.moves?.includes(m));
  return has.length ? { move: has[0], stage: SELF_BOOST[has[0]][stat] } : null;
}

/**
 * Their likely moves that raise the defence your move hits, before your hit lands: e.g. Contrary Close Combat (+1 Def, +1 SpD).
 * set: their set (moves + ability; a Mega's ability comes from its forme). Returns [{move, stage}] with stage > 0.
 */
export function afterTheirMoves(mech, set, formeId, defStat) {
  const ability = mech.species[formeId]?.mega ? toID(mech.species[formeId].abilities[0] ?? '') : set.ability;
  const flip = ability === 'contrary' ? -1 : 1;
  const out = [];
  for (const m of set.moves ?? []) {
    const raw = SELF_BOOST[m]?.[defStat] ?? SELF_AFTER_HIT[m]?.[defStat] ?? 0;
    const stage = raw * flip * (ability === 'simple' ? 2 : 1);
    if (stage > 0) out.push({ move: m, stage });
  }
  return out;
}

// ---------- weather from abilities (Drought, Drizzle, Sand Stream, Snow Warning) ----------
export const WEATHER_ABILITY = Object.freeze({ drought: 'Sun', orichalcumpulse: 'Sun', drizzle: 'Rain', sandstream: 'Sand', snowwarning: 'Snow' });
/** The ability a side fights with: a Mega's own ability when the set holds its stone, else the set's (or the only legal one). */
export function sideAbility(mech, set, formeId) {
  const f = mech.species[formeId];
  if (f?.mega) return toID(f.abilities[0] ?? '');
  if (set.ability) return set.ability;
  const legal = legalAbilities(mech, set.species);
  return legal.length === 1 ? legal[0] : '';
}
/**
 * The weather on the field when your set meets a target row (both on the field from the start, turn 1 after Mega Evolution),
 * from the abilities that set it. A Mega setter beats a switch-in setter (it activates later); otherwise abilities activate
 * fastest first, so the slower side's weather stays, and when that order depends on their unknown Speed yours is used and
 * `contested` says theirs can replace it. Switching later changes it: this is the lead case only. Returns { weather, by: 'mine'|'theirs'|null, mine, theirs,
 * contested } where mine/theirs = { weather, ability } or null.
 */
export function autoWeather(mech, mySet, row) {
  const myF = myForme(mech, mySet);
  const ma = sideAbility(mech, mySet, myF), ta = row ? sideAbility(mech, row.set, row.forme) : '';
  const mine = WEATHER_ABILITY[ma] ? { weather: WEATHER_ABILITY[ma], ability: ma } : null;
  const theirs = WEATHER_ABILITY[ta] ? { weather: WEATHER_ABILITY[ta], ability: ta } : null;
  if (!mine && !theirs) return { weather: '', by: null, mine, theirs, contested: false };
  if (!theirs || (mine && mine.weather === theirs.weather)) return { weather: mine.weather, by: 'mine', mine, theirs, contested: false };
  if (!mine) return { weather: theirs.weather, by: 'theirs', mine, theirs, contested: false };
  // a Mega's ability activates when it Mega Evolves at the start of turn 1, after both leads' switch-in abilities
  // (Showdown sim/battle-queue.ts: megaEvo before moves), so a Mega setter replaces a switch-in setter's weather
  const myMega = !!mech.species[myF]?.mega, theirMega = !!row.mega;
  if (myMega !== theirMega) return myMega ? { weather: mine.weather, by: 'mine', mine, theirs, contested: false } : { weather: theirs.weather, by: 'theirs', mine, theirs, contested: false };
  const me = mySpeed(mech, mySet, myF), rg = targetSpeed(mech, row);
  const v = me === null ? 'depends' : speedVerdict(me, rg.ladder !== undefined ? { min: rg.ladder, max: rg.ladder, exact: true } : rg);
  if (v === 'faster') return { weather: theirs.weather, by: 'theirs', mine, theirs, contested: false }; // you go first, theirs overwrites
  return { weather: mine.weather, by: 'mine', mine, theirs, contested: v !== 'slower' };
}

// ---------- targets: their pool, every Mega as its own row ----------
/**
 * One row per out-of-battle species in their pool, plus one per Mega forme it can reach. set: their saved set when one exists
 * (a saved Mega Stone set belongs to the Mega row), else a ladder guess from that forme's usage (Megas fall back to the base
 * species' usage, labelled), SP unknown. common: the top legal ladder spread for the unknown-SP envelope, or null.
 * opts: { usage (slimmed Smogon table or null), dexSpecies(id), savedSet(speciesId) -> set data or null, asOf }
 */
export function targetsOf(mech, pool, { usage = null, dexSpecies = () => null, savedSet = () => null, asOf = null } = {}) {
  const rows = [];
  for (const sp of pool) {
    if (!mech.species[sp] || mech.species[sp].mega) continue;
    const stones = Object.keys(mech.items).filter((i) => mech.items[i].megaStone?.[sp]).sort();
    const saved = savedSet(sp);
    const formes = [{ forme: sp, item: null }, ...stones.map((i) => ({ forme: mech.items[i].megaStone[sp], item: i }))];
    for (const { forme, item } of formes) {
      if (!mech.species[forme]) continue;
      const savedHere = saved && (item ? saved.item === item : !mech.items[saved.item]?.megaStone);
      let set, source, uKey = null;
      if (savedHere) { set = { species: sp, ...saved }; source = 'set'; }
      else {
        uKey = usage?.species?.[forme] ? forme : usage?.species?.[sp] ? sp : null;
        const u = uKey ? usage.species[uKey] : null;
        const g = guessSet(mech, dexSpecies(sp), sp, u ? { species: { [sp]: u } } : null, asOf).data;
        set = { species: sp, ...g };
        if (item) set.item = item;
        else if (set.item && mech.items[set.item]?.megaStone) set.item = '';
        if (!set.ability) set.ability = legalAbilities(mech, sp)[0] ?? '';
        if (!set.nature) set.nature = '';
        // no usage table (offline): the dex's key moves (Pikalytics, also ladder data) still make a labelled guess
        source = u || set.moves.length ? 'ladder' : 'none';
      }
      const u = uKey ? usage.species[uKey] : null;
      rows.push({
        key: forme, species: sp, forme, mega: !!item, item, set, source,
        usageFrom: source === 'ladder' ? (!uKey ? 'keymoves' : uKey === forme ? 'forme' : 'base') : null,
        common: set.sp === 'unknown' ? commonSpread(mech, u) : null, usagePct: u?.usage ?? null,
      });
    }
  }
  return rows;
}
/** Default pins: the most used rows (ladder usage, then pool order), at most n. */
export const defaultPins = (rows, n = 2) => [...rows].map((r, i) => ({ r, i })).sort((a, b) => (b.r.usagePct ?? -1) - (a.r.usagePct ?? -1) || a.i - b.i).slice(0, n).map((x) => x.r.key);

// ---------- speed ----------
/** Your Speed for a set in a forme (no field effects beyond cond). */
export function mySpeed(mech, set, formeId, cond = {}) {
  if (set.sp === 'unknown' || !mech.natures[set.nature]) return null;
  return speedOf(statValue('spe', mech.species[formeId].baseStats.spe, set.sp.spe ?? 0, natureSign(mech.natures[set.nature], 'spe')), { scarf: set.item === 'choicescarf', ironBall: set.item === 'ironball', ...cond }).speed;
}
/** Their Speed range for a target row: exact when their set has SP and a nature, else 0 SP −Spe .. 32 SP +Spe. */
export function targetSpeed(mech, row, cond = {}) {
  const set = row.set;
  const known = set.sp !== 'unknown' && mech.natures[set.nature] ? { sp: set.sp.spe ?? 0, sign: natureSign(mech.natures[set.nature], 'spe') } : null;
  const c = { scarf: set.item === 'choicescarf' && !row.mega, ...cond };
  const base = mech.species[row.forme].baseStats.spe;
  const r = speedRange(base, c, known);
  // unknown SP but a ladder spread for this forme: its Speed is the "common" one (e.g. Jolly 32 Spe → 178), labelled
  const k = !known && row.common && mech.natures[row.common.nature] ? row.common : null;
  if (k) {
    r.ladder = speedOf(statValue('spe', base, k.sp.spe ?? 0, natureSign(mech.natures[k.nature], 'spe')), c).speed;
    r.ladderLabel = `${mech.natures[k.nature].name ?? k.nature} ${k.sp.spe ?? 0}`;
  }
  return r;
}
/** 'faster' | 'slower' | 'tie' | 'depends' for your exact Speed against their range (a tie never counts as faster). */
export function speedVerdict(mine, range, { trickRoom = false } = {}) {
  if (mine === null || mine === undefined) return 'unknown';
  if (range.exact) { const c = compareSpeed(mine, range.max, { trickRoom }); return c === 'first' ? 'faster' : c === 'second' ? 'slower' : 'tie'; }
  const c = compareSpeed(mine, range, { trickRoom });
  return c === 'first' ? 'faster' : c === 'second' ? 'slower' : 'depends'; // inside their range: a tie is one of the cases
}
/**
 * Creep targets: for each target row, its ladder Speed (the row's common spread, e.g. Jolly 32) or, without one, its
 * "common max" (neutral 32 SP), plus the "worst case" (+Spe 32 SP) when different; or its exact Speed when known, with the cheapest Speed SP for your set to move first (outspeedSearch) and where a tie lands.
 * cond: { mine: {...}, theirs: {...} } speed conditions; trickRoom flips to ceilings. Sorted by the SP needed.
 */
export function creepTargets(mech, set, formeId, rows, { mine = {}, theirs = {}, trickRoom = false } = {}) {
  const out = [];
  const myCond = { scarf: set.item === 'choicescarf', ironBall: set.item === 'ironball', ...mine };
  const me = mySpeed(mech, set, formeId, mine);
  for (const row of rows) {
    const r = targetSpeed(mech, row, theirs);
    const worst = { key: 'worst', speed: trickRoom ? r.min : r.max };
    const marks = r.exact ? [{ key: 'set', speed: r.max }]
      : r.ladder !== undefined ? [{ key: 'ladder', speed: r.ladder, label: r.ladderLabel }, ...(r.ladder !== worst.speed ? [worst] : [])]
      : [{ key: 'common-max', speed: r.neutralMax }, worst];
    for (const m of marks) {
      const s = outspeedSearch(mech, set, formeId, m.speed, myCond, { trickRoom });
      const cur = s.options.find((o) => o.nature === set.nature) ?? s.options[0];
      const alt = s.options.find((o) => o.nature !== set.nature) ?? null;
      const verdict = me === null ? 'unknown' : me === m.speed ? 'tie' : (me > m.speed) !== trickRoom ? 'faster' : 'slower';
      out.push({ key: row.key, forme: row.forme, mega: row.mega, mark: m.key, label: m.label ?? null, speed: m.speed, verdict, current: me, keep: cur, alt, budget: s.budget });
    }
  }
  const need = (x) => (x.keep.impossible ? 99 : x.keep.sp);
  return out.sort((a, b) => need(a) - need(b) || b.speed - a.speed);
}

// ---------- KO benchmarks ----------
/** Their side's SP for an unknown set: 'frail' | 'common' | 'max' (the envelope rows), via the calc's spreadFor. */
export function withSpread(calc, sc, side, row, key) {
  const set = sc[side].set;
  if (set.sp !== 'unknown') return { sc, label: 'their set', key: 'set' };
  let k = key;
  if (k === 'common' && !row?.common) k = 'max';
  const s = calc.spreadFor(sc, side, k, { common: row?.common ? { ...row.common, label: 'ladder' } : null });
  if (!s) return { sc, label: null, key: k };
  const out = structuredClone(sc);
  out[side].set.sp = s.sp; out[side].set.nature = s.nature;
  return { sc: out, label: k, key: k, fellBack: k !== key };
}
/** The scenario for your set hitting a target row with one move, at your stage and their defensive stage. */
export function hitScenario(mech, mySet, row, move, { boost = 0, stage = 0, field = {}, aState = {}, dState = {} } = {}) {
  const st = moveStats(mech, move);
  const aB = { ...(aState.boosts ?? {}) }, dB = { ...(dState.boosts ?? {}) };
  if (st) { aB[st.atk] = boost; dB[st.def] = stage; }
  return normalizeScenario({
    attacker: { set: { ...mySet, gender: '' }, state: { ...aState, boosts: aB } },
    defender: { set: { ...row.set, gender: '' }, state: { ...dState, boosts: dB, mega: row.mega } },
    move: { id: move }, field,
  });
}
/**
 * One KO benchmark: the cheapest attacking SP (koSearch levels, breakpoints) for your set to KO a target row at your stage
 * `boost` and their defensive `stage`, in one or two uses, against their `spread` (frail | common | max; their set's SP when
 * known). Adds slack per level: your SP minus what the level needs (current nature only; null when it can't).
 */
export function koBenchmark(calc, mech, mySet, row, move, { boost = 0, stage = 0, uses = 1, spread = 'common', field = {} } = {}) {
  const base = hitScenario(mech, mySet, row, move, { boost, stage, field });
  const w = withSpread(calc, base, 'defender', row, spread);
  const res = koSearch(calc, mech, w.sc, { uses });
  if (res.refused) return { ...res, boost, stage, uses, spread: w.key };
  const have = mySet.sp === 'unknown' ? null : mySet.sp[res.stat] ?? 0;
  const levels = res.levels.map((l) => ({ ...l, slack: have !== null && l.keep ? have - l.keep.a : null }));
  return { ...res, levels, boost, stage, uses, spread: w.key, spreadFellBack: !!w.fellBack, theirSp: w.sc.defender.set.sp, theirNature: w.sc.defender.set.nature, have };
}
/** One damage run of your set into a target row (their SP from `spread` when unknown). */
export function hitResult(calc, mech, mySet, row, move, opts = {}) {
  const base = hitScenario(mech, mySet, row, move, opts);
  const w = withSpread(calc, base, 'defender', row, opts.spread ?? 'common');
  return { result: calc.run(w.sc), spread: w.key, sc: w.sc };
}
/** Their hit on your set (their SP from `spread` when unknown: 'max' = worst case for you). */
export function theirHit(calc, mech, mySet, row, move, { spread = 'max', field = {}, myMega = true } = {}) {
  const sc = normalizeScenario({
    attacker: { set: { ...row.set, gender: '' }, state: { mega: row.mega } },
    defender: { set: { ...mySet, gender: '' }, state: { mega: myMega } }, move: { id: move }, field,
  });
  const w = withSpread(calc, sc, 'attacker', row, spread);
  return { result: calc.run(w.sc), spread: w.key, sc: w.sc };
}
/**
 * Survive benchmark: the cheapest HP + Def/SpD (surviveSearch levels) for your set to take a target row's hit, at their
 * `spread` (default max: the worst case for you). Your other stats stay as they are, so the budget is what they leave.
 */
export function surviveBenchmark(calc, mech, mySet, row, move, { spread = 'max', field = {}, crit = false, withGrid = false } = {}) {
  const sc = normalizeScenario({
    attacker: { set: { ...row.set, gender: '' }, state: { mega: row.mega } },
    defender: { set: { ...mySet, gender: '' }, state: {} }, move: { id: move }, field,
  });
  const w = withSpread(calc, sc, 'attacker', row, spread);
  const res = surviveSearch(calc, mech, w.sc, { includeCrit: crit, withGrid });
  if (res.refused) return { ...res, spread: w.key };
  const have = mySet.sp === 'unknown' ? null : { hp: mySet.sp.hp ?? 0, def: mySet.sp[res.stat] ?? 0 };
  return { ...res, spread: w.key, have };
}
/** Their damaging moves from the row's set (saved or ladder), strongest base power first. */
export const theirAttacks = (mech, row) => (row.set.moves ?? []).filter((m) => mech.moves[m] && mech.moves[m].category !== 'Status').sort((a, b) => (mech.moves[b].basePower ?? 0) - (mech.moves[a].basePower ?? 0));
/** Your damaging moves, in set order. */
export const myAttacks = (mech, set) => (set.moves ?? []).filter((m) => mech.moves[m] && mech.moves[m].category !== 'Status');

// ---------- bulk score: expected OHKOs from their common hits (dashboard-goldens.md §2) ----------
export const BULK_MIN_MOVE = 15; // a move is "common" at ≥ 15% of that form's sets
const SPREAD_RE = /^([A-Za-z]+):(\d+)\/(\d+)\/(\d+)\/(\d+)\/(\d+)\/(\d+)$/;
/**
 * The common hits of one form from ladder usage (the slimmed Smogon table): its top-3 spreads (weights renormalised), top
 * item and top ability, and its damaging moves used by ≥ 15% of its sets (base power > 0, or Final Gambit). null when the
 * form has no usage data. A Mega form keeps its stone; its ability comes from the forme in the calc.
 */
export function commonHits(mech, sp, forme, u) {
  if (!u) return null;
  const spreads = [];
  for (const [s, w] of u.spreads ?? []) {
    const m = SPREAD_RE.exec(s);
    if (!m || !mech.natures[toID(m[1])]) continue;
    const v = m.slice(2).map(Number);
    if (v.some((x) => x > SP_PER_STAT) || v.reduce((a, b) => a + b, 0) > SP_TOTAL) continue;
    spreads.push({ nature: toID(m[1]), sp: Object.fromEntries(STAT_IDS.map((k, i) => [k, v[i]])), w });
    if (spreads.length === 3) break;
  }
  const tot = spreads.reduce((t, x) => t + x.w, 0);
  if (!tot) return null;
  const mega = !!mech.species[forme]?.mega;
  const top = (list) => toID(list?.[0]?.[0] ?? '');
  let item = top(u.items);
  if (mega) item = Object.keys(mech.items).find((i) => mech.items[i].megaStone?.[sp] === forme) ?? item;
  else if (!mech.items[item] || mech.items[item].megaStone) item = '';
  const legal = legalAbilities(mech, sp);
  const ability = legal.includes(top(u.abilities)) ? top(u.abilities) : legal[0] ?? '';
  const moves = (u.moves ?? []).filter(([, p]) => p >= BULK_MIN_MOVE).map(([m]) => toID(m))
    .filter((m) => mech.moves[m] && mech.moves[m].category !== 'Status' && (mech.moves[m].basePower > 0 || m === 'finalgambit'));
  return { spreads: spreads.map((x) => ({ ...x, w: x.w / tot })), item, ability, moves, mega };
}
/**
 * Bulk score for your set against a pool: for every form (each Mega its own) with usage data, every common hit's OHKO odds
 * = Σ spreads weight × the calc's exact KO odds (16 rolls, the 2–5-hit mixture, a roll equal to your HP counts), with spread
 * moves at ×0.75 (both foes present), no weather, terrain, screens, Intimidate or crits, you at full HP. score = the plain
 * sum. Returns { score, hits: [{species, forme, move, p}], strong (hits with p ≥ 0.5), skipped (forms without usage),
 * notCounted ([{forme, move, code}]: the calc gave no KO number) }.
 */
export function bulkScore(calc, mech, mySet, pool, usage) {
  const hits = [], skipped = [], notCounted = [];
  for (const sp of pool) {
    if (!mech.species[sp] || mech.species[sp].mega) continue;
    const formes = [sp, ...Object.keys(mech.items).map((i) => mech.items[i].megaStone?.[sp]).filter(Boolean).sort()];
    for (const forme of formes) {
      const c = commonHits(mech, sp, forme, usage?.species?.[forme]);
      if (!c) { skipped.push(forme); continue; }
      for (const move of c.moves) {
        let p = 0, bad = null;
        for (const s of c.spreads) {
          const r = calc.run(normalizeScenario({
            attacker: { set: { species: sp, item: c.item, ability: c.ability, nature: s.nature, moves: [move], sp: s.sp }, state: { mega: c.mega } },
            defender: { set: { ...mySet, gender: '' }, state: {} }, move: { id: move },
          }), { lite: true });
          if (r.class === 'no-damage') continue; // immune (Levitate vs Earthquake…): a hit with 0 KO odds
          const k = r.class === 'exact' ? r.ko.one : null;
          if (!k || k.refused !== undefined) { bad = r.code ?? k?.refused ?? r.class; break; }
          p += s.w * (Number(k.num) / Number(k.den));
        }
        if (bad) notCounted.push({ forme, move, code: bad });
        else hits.push({ species: sp, forme, move, p });
      }
    }
  }
  const score = hits.reduce((t, h) => t + h.p, 0);
  return { score, hits, strong: hits.filter((h) => h.p >= 0.5).length, skipped, notCounted };
}

// ---------- trade-offs ----------
/**
 * A copy of the set with `stat` at `need` SP and the SP it frees (plus any unspent SP) put into bulk: HP first, then the
 * lower of Def / SpD, each to at most 32 and 66 in total. Returns { set, freed, moved: {hp, def, spd} }.
 */
export function freeIntoBulk(set, stat, need) {
  const sp = { ...set.sp };
  const freed = Math.max(0, (sp[stat] ?? 0) - need);
  sp[stat] = Math.min(sp[stat] ?? 0, need);
  let spare = SP_TOTAL - STAT_IDS.reduce((t, s) => t + (sp[s] ?? 0), 0);
  const moved = { hp: 0, def: 0, spd: 0 };
  const put = (s) => { const n = Math.max(0, Math.min(SP_PER_STAT - (sp[s] ?? 0), spare)); sp[s] = (sp[s] ?? 0) + n; spare -= n; moved[s] += n; };
  put('hp');
  const lower = (sp.def ?? 0) <= (sp.spd ?? 0) ? ['def', 'spd'] : ['spd', 'def'];
  for (const s of lower) put(s);
  return { set: { ...set, sp }, freed, moved };
}
/** Swap one move for another: the slot of the weakest damaging move that isn't your strongest attack or a pivot. */
export function swapInMove(mech, set, move) {
  if (set.moves.includes(move)) return { set, dropped: null };
  const dmg = set.moves.map((m, i) => ({ m, i, bp: mech.moves[m]?.category === 'Status' ? -1 : mech.moves[m]?.basePower ?? 0 }));
  const best = dmg.filter((x) => x.bp > 0).sort((a, b) => b.bp - a.bp)[0];
  const cand = dmg.filter((x) => x.bp > 0 && x !== best && !PIVOTS.has(x.m)).sort((a, b) => a.bp - b.bp)[0]
    ?? (set.moves.length < 4 ? null : dmg.filter((x) => x !== best && x.m !== 'protect').sort((a, b) => a.bp - b.bp)[0]);
  const moves = set.moves.slice();
  if (!cand) { moves.push(move); return { set: { ...set, moves }, dropped: null }; }
  moves[cand.i] = move;
  return { set: { ...set, moves }, dropped: cand.m };
}
/**
 * Suggested trial options (seeds) for a set. Each is { key, set, changes: [codes], cost: [codes] }; nothing is saved.
 * opts.setupNeed: SP of the attacking stat a setup option needs at its stage (from koBenchmark), so its spare SP go to bulk.
 */
export function seedOptions(mech, set, { stat = 'spa', setupNeed = null, damageItem = 'lifeorb' } = {}) {
  if (set.sp === 'unknown') return [];
  const out = [];
  if ((set.sp.spe ?? 0) > 0) {
    const sp = { ...set.sp, spe: 0 };
    const moved = freeIntoBulk({ ...set, sp }, 'spe', 0);
    out.push({ key: 'speed-to-bulk', set: moved.set, changes: [{ code: 'speed-to-bulk', n: set.sp.spe, moved: moved.moved }], cost: [{ code: 'speed-lost', n: set.sp.spe }] });
  }
  if (damageItem && set.item !== damageItem && mech.items[damageItem] && !mech.items[set.item]?.megaStone) {
    out.push({ key: 'damage-item', set: { ...set, item: damageItem }, changes: [{ code: 'item', item: damageItem, was: set.item }], cost: [{ code: `item-cost:${damageItem}` }, ...(set.item ? [{ code: 'item-dropped', item: set.item }] : [])] });
  }
  const setup = setupMoveFor(mech, set.species, stat);
  if (setup && !set.moves.includes(setup.move)) {
    const sw = swapInMove(mech, set, setup.move);
    const bulk = setupNeed !== null && setupNeed < (set.sp[stat] ?? 0) ? freeIntoBulk(sw.set, stat, setupNeed) : { set: sw.set, freed: 0, moved: { hp: 0, def: 0, spd: 0 } };
    out.push({ key: 'setup', set: bulk.set, setup, changes: [{ code: 'setup', move: setup.move, stage: setup.stage, dropped: sw.dropped, freed: bulk.freed, moved: bulk.moved }], cost: [{ code: 'move-slot', dropped: sw.dropped }, { code: 'setup-turn' }] });
  }
  const other = plusNatureFor(mech, set, mech.natures[set.nature]?.plus === stat ? 'spe' : stat);
  if (other && other !== set.nature) {
    out.push({ key: 'nature', set: { ...set, nature: other }, changes: [{ code: 'nature', nature: other, was: set.nature }], cost: [{ code: 'nature', tradeoff: natureTradeoff(mech, set, other) }] });
  }
  return out;
}

// ---------- tools against setup in their pool ----------
/**
 * What in their pool works against a setup turn: per row, the tool moves in its likely set (evidence 'ladder' or 'set') and,
 * separately, the ones it only could learn ('could'); abilities (Unaware, Imposter) from the forme. Facts, not a verdict.
 */
export function setupTools(mech, rows) {
  const out = [];
  const seen = new Set();
  for (const row of rows) {
    const ab = row.mega ? [toID(mech.species[row.forme].abilities[0] ?? '')] : legalAbilities(mech, row.species);
    for (const a of ab) if (SETUP_TOOLS.abilities[a] && !seen.has(`${row.species}|${a}`)) { seen.add(`${row.species}|${a}`); out.push({ species: row.species, forme: row.forme, kind: 'ability', id: a, tool: SETUP_TOOLS.abilities[a], evidence: row.set.ability === a || row.mega ? (row.source === 'set' ? 'set' : 'ladder') : 'could' }); }
    for (const [m, tool] of Object.entries(SETUP_TOOLS.moves)) {
      const k = `${row.species}|${m}`;
      if (seen.has(k)) continue;
      const inSet = row.set.moves?.includes(m);
      if (!inSet && !canLearn(mech, row.species, m)) continue;
      seen.add(k);
      out.push({ species: row.species, forme: row.forme, kind: 'move', id: m, tool, evidence: inSet ? (row.source === 'set' ? 'set' : 'ladder') : 'could' });
    }
  }
  return out;
}

/** The forme your set fights in (its Mega when it holds the stone). */
export function myForme(mech, set, mega = true) {
  const f = battleForme(mech, set.species, set.item, { megaEvolved: mega });
  return f.error ? set.species : f.id;
}

// ---------- teambuilder slider marks (docs/research/ux/teambuilder-redesign.md) ----------
// Every mark is "the least SP on this stat for this outcome", from the same searches as above. Damage and survive marks are
// computed once per set *shape* (species, item, ability, nature, moves; every SP at 0, so the search covers the whole 0–32
// range) and then compared with the sliders: dragging never needs the engine.
export const ZERO_SP = Object.freeze({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });
/** The part of a set the damage and survive marks depend on (Stat Points left out). */
export const shapeOf = (set) => ({ species: set.species, item: set.item, ability: set.ability, nature: set.nature, moves: [...(set.moves ?? [])], sp: { ...ZERO_SP } });

/**
 * Speed marks for the current nature: per target Speed (their exact Speed, else their ladder spread's, else 32 SP neutral),
 * the least Speed SP that moves strictly first, and the SP that ties. A tie gets its own mark only where it matters: you
 * sit on it, or a tie is the best you can reach. Targets with the same Speed share one mark. Returns { marks:[{stat:'spe',
 * sp, kind:'outspeed'|'tie', speed, who:[{key, forme, mark, label, coach}]}], cant:[{speed, who, best}], faster, ties, of, me }.
 */
export function speedMarks(mech, set, formeId, rows, { mine = {}, theirs = {} } = {}) {
  const base = mech.species[formeId].baseStats.spe, sign = natureSign(mech.natures[set.nature], 'spe');
  const myCond = { scarf: set.item === 'choicescarf', ironBall: set.item === 'ironball', ...mine };
  const me = mySpeed(mech, set, formeId, mine);
  const bySpeed = new Map();
  for (const row of rows) {
    const r = targetSpeed(mech, row, theirs);
    const t = r.exact ? { speed: r.max, mark: 'set' } : r.ladder !== undefined ? { speed: r.ladder, mark: 'ladder', label: r.ladderLabel } : { speed: r.neutralMax, mark: 'common-max' };
    const g = bySpeed.get(t.speed) ?? [];
    g.push({ key: row.key, forme: row.forme, mark: t.mark, label: t.label ?? null, coach: row.coach ?? null });
    bySpeed.set(t.speed, g);
  }
  const marks = [], cant = [];
  let faster = 0, ties = 0, of = 0;
  const cur = set.sp === 'unknown' ? null : set.sp.spe ?? 0;
  for (const [speed, who] of [...bySpeed].sort((a, b) => a[0] - b[0])) {
    of += who.length;
    if (me !== null && me > speed) faster += who.length;
    if (me === speed) ties += who.length;
    const o = outspeedSP(base, sign, speed, myCond);
    if (!o.impossible) marks.push({ stat: 'spe', sp: o.sp, kind: 'outspeed', speed, who, reach: o.speed, tieAt: o.tieAt });
    if (o.tieAt !== null && (o.impossible || cur === o.tieAt)) marks.push({ stat: 'spe', sp: o.tieAt, kind: 'tie', speed, who });
    if (o.impossible && o.tieAt === null) cant.push({ speed, who, best: o.best.speed });
  }
  return { marks, cant, faster, ties, of, me };
}

/**
 * Damage marks for one (target row, move): the least attacking SP for "KO every roll" in one use, in two uses (2HKO), at the
 * set's setup stage when it has a setup move, and with Life Orb when it isn't holding one (dashed: needs Life Orb). A level
 * only another nature reaches is dashed (needs that nature). Returns { marks:[{stat, sp, kind:'ko', uses, boost, nature,
 * item, need, key, forme, move, spread}], cant:[{… best}] } (cant: no OHKO at +0 even at 32).
 */
export function koMarks(calc, mech, set, row, move, { field = {}, spread = 'common' } = {}) {
  const st = moveStats(mech, move);
  if (!st) return { marks: [], cant: [] };
  const shape = shapeOf(set);
  const setup = setupIn(set, st.atk);
  const runs = [{ uses: 1, boost: 0 }, { uses: 2, boost: 0 }];
  if (setup) runs.push({ uses: 1, boost: setup.stage });
  if (set.item !== 'lifeorb' && !mech.items[set.item]?.megaStone && mech.items.lifeorb) runs.push({ uses: 1, boost: 0, item: 'lifeorb' });
  const marks = [], cant = [];
  for (const r of runs) {
    const b = koBenchmark(calc, mech, r.item ? { ...shape, item: r.item } : shape, row, move, { boost: r.boost, uses: r.uses, field, spread });
    if (b.refused) continue;
    const lv = b.levels.find((l) => l.key === 'every-roll');
    const base = { stat: b.stat, kind: 'ko', uses: r.uses, boost: r.boost, key: row.key, forme: row.forme, move, spread: b.spread, item: r.item ?? set.item };
    if (lv?.keep) marks.push({ ...base, sp: lv.keep.a, nature: lv.keep.nature, need: r.item ? { item: r.item } : null });
    if (lv?.change && !r.item) marks.push({ ...base, sp: lv.change.a, nature: lv.change.nature, need: { nature: lv.change.nature } }); // cheaper with another nature
    else if (!lv?.keep && lv?.change) marks.push({ ...base, sp: lv.change.a, nature: lv.change.nature, need: { nature: lv.change.nature, ...(r.item ? { item: r.item } : {}) } });
    else if (r.uses === 1 && !r.item && r.boost === 0) cant.push({ ...base, best: b.breakpoints.find((x) => x.nature === set.nature)?.steps.at(-1)?.ko ?? null });
  }
  return { marks, cant };
}

/**
 * Survive marks for their hit on you: the cheapest HP + Def/SpD pair that survives every roll, on both sliders (paired), and
 * the frontier (for each defence value the least HP that survives), so another split that also survives counts as reached.
 * A pair only another nature reaches is dashed (needs it). Returns { marks:[{stat, sp, pair, kind:'survive', defStat, nature,
 * need, frontier, key, forme, move, spread}], cant:[{… best}] } (cant: no HP / defence spread survives).
 */
export function surviveMarks(calc, mech, set, row, move, { field = {}, spread = 'common' } = {}) {
  const b = surviveBenchmark(calc, mech, shapeOf(set), row, move, { field, spread, withGrid: true });
  if (b.refused) return { marks: [], cant: [] };
  const lv = b.levels.find((l) => l.key === 'every-roll');
  const base = { kind: 'survive', key: row.key, forme: row.forme, move, defStat: b.stat, spread: b.spread };
  if (!lv?.keep && !lv?.change) return { marks: [], cant: [{ ...base, best: b.best?.ko ?? null }] };
  if (lv.keep && lv.keep.h === 0 && lv.keep.d === 0) return { marks: [], cant: [], already: true }; // survived with no investment: no mark
  const frontier = {};
  for (const g of b.grid) if (g.ko.num === '0') { const f = (frontier[g.nature] ??= {}); f[g.d] = Math.min(f[g.d] ?? 99, g.h); }
  // the cheapest pair with your nature, and (dashed: needs it) the cheaper one with another nature when there is one
  const pairs = [lv.keep, lv.change].filter(Boolean);
  return { marks: pairs.flatMap((p) => {
    const need = p.nature === set.nature ? null : { nature: p.nature };
    return [
      { ...base, stat: 'hp', sp: p.h, pair: { stat: b.stat, sp: p.d }, nature: p.nature, need, frontier },
      ...(p.d > 0 ? [{ ...base, stat: b.stat, sp: p.d, pair: { stat: 'hp', sp: p.h }, nature: p.nature, need, frontier }] : []),
    ];
  }), cant: [] };
}

/** Whether a mark holds for a set with these Stat Points (its nature and item conditions included). */
export function markMet(m, set) {
  if (set.sp === 'unknown') return false;
  if (m.kind === 'outspeed') return (set.sp.spe ?? 0) >= m.sp;
  if (m.kind === 'tie') return (set.sp.spe ?? 0) === m.sp;
  if (m.need && Object.entries(m.need).some(([k, v]) => set[k] !== v)) return false;
  if (m.kind === 'ko') return set.nature === m.nature && (set.sp[m.stat] ?? 0) >= m.sp;
  if (m.kind === 'survive') {
    if (set.nature !== m.nature) return false;
    const f = m.frontier?.[m.nature] ?? {}, d = set.sp[m.defStat] ?? 0, h = set.sp.hp ?? 0;
    return Object.entries(f).some(([dd, hh]) => Number(dd) <= d && hh <= h);
  }
  return false;
}

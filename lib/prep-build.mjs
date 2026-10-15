// Build: the per-mon dashboard's pure logic (docs/research/ux/builder-dashboard.md v2, docs/research/dev/builder-plan.md).
// It only orchestrates what exists: targets come from their pool (their saved set, else a labelled ladder guess), KO
// benchmarks are lib/calc/threshold.mjs koSearch at a chosen stage (one or two uses), creep targets are outspeedSearch per
// target Speed, and trade-offs move the SP a setup move frees into bulk. The calc is injected; no engine import, no storage.
import { koSearch, surviveSearch, outspeedSearch, natureTradeoff, plusNatureFor } from './calc/threshold.mjs';
import { speedOf, statValue, natureSign, speedRange, compareSpeed, SP_PER_STAT, SP_TOTAL, STAT_IDS } from './calc/stats.mjs';
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
  return speedRange(mech.species[row.forme].baseStats.spe, { scarf: set.item === 'choicescarf' && !row.mega, ...cond }, known);
}
/** 'faster' | 'slower' | 'tie' | 'depends' for your exact Speed against their range (a tie never counts as faster). */
export function speedVerdict(mine, range, { trickRoom = false } = {}) {
  if (mine === null || mine === undefined) return 'unknown';
  if (range.exact) { const c = compareSpeed(mine, range.max, { trickRoom }); return c === 'first' ? 'faster' : c === 'second' ? 'slower' : 'tie'; }
  const c = compareSpeed(mine, range, { trickRoom });
  return c === 'first' ? 'faster' : c === 'second' ? 'slower' : 'depends'; // inside their range: a tie is one of the cases
}
/**
 * Creep targets: for each target row, its "common max" (neutral 32 SP) and "worst case" (+Spe 32 SP) Speeds, or its exact
 * Speed when known, with the cheapest Speed SP for your set to move first (outspeedSearch) and where a tie lands.
 * cond: { mine: {...}, theirs: {...} } speed conditions; trickRoom flips to ceilings. Sorted by the SP needed.
 */
export function creepTargets(mech, set, formeId, rows, { mine = {}, theirs = {}, trickRoom = false } = {}) {
  const out = [];
  const myCond = { scarf: set.item === 'choicescarf', ironBall: set.item === 'ironball', ...mine };
  const me = mySpeed(mech, set, formeId, mine);
  for (const row of rows) {
    const r = targetSpeed(mech, row, theirs);
    const marks = r.exact ? [{ key: 'set', speed: r.max }] : [{ key: 'common-max', speed: r.neutralMax }, { key: 'worst', speed: trickRoom ? r.min : r.max }];
    for (const m of marks) {
      const s = outspeedSearch(mech, set, formeId, m.speed, myCond, { trickRoom });
      const cur = s.options.find((o) => o.nature === set.nature) ?? s.options[0];
      const alt = s.options.find((o) => o.nature !== set.nature) ?? null;
      const verdict = me === null ? 'unknown' : me === m.speed ? 'tie' : (me > m.speed) !== trickRoom ? 'faster' : 'slower';
      out.push({ key: row.key, forme: row.forme, mega: row.mega, mark: m.key, speed: m.speed, verdict, current: me, keep: cur, alt, budget: s.budget });
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
export function surviveBenchmark(calc, mech, mySet, row, move, { spread = 'max', field = {}, crit = false } = {}) {
  const sc = normalizeScenario({
    attacker: { set: { ...row.set, gender: '' }, state: { mega: row.mega } },
    defender: { set: { ...mySet, gender: '' }, state: {} }, move: { id: move }, field,
  });
  const w = withSpread(calc, sc, 'attacker', row, spread);
  const res = surviveSearch(calc, mech, w.sc, { includeCrit: crit });
  if (res.refused) return { ...res, spread: w.key };
  const have = mySet.sp === 'unknown' ? null : { hp: mySet.sp.hp ?? 0, def: mySet.sp[res.stat] ?? 0 };
  return { ...res, spread: w.key, have };
}
/** Their damaging moves from the row's set (saved or ladder), strongest base power first. */
export const theirAttacks = (mech, row) => (row.set.moves ?? []).filter((m) => mech.moves[m] && mech.moves[m].category !== 'Status').sort((a, b) => (mech.moves[b].basePower ?? 0) - (mech.moves[a].basePower ?? 0));
/** Your damaging moves, in set order. */
export const myAttacks = (mech, set) => (set.moves ?? []).filter((m) => mech.moves[m] && mech.moves[m].category !== 'Status');

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

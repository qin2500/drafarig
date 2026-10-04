// Champions stats and Speed: the one stat function for the set editor, speed ladders, brief check numbers and calcs.
// Pure and engine-free (no damage engine import), so editing a set never loads the calculator.
// Formula (Pokémon Showdown champions mod statModify, level 50): HP = base + SP + 75; other stats = base + SP + 20, then
// the nature (×1.1 / ×0.9, integer). test/calc-engine.test.mjs asserts equality with the vendored engine.
// Speed: stat → stage → chained modifiers (Tailwind, weather/terrain abilities, Choice Scarf, Iron Ball, Quick Feet,
// Unburden) → paralysis ×½ last (not with Quick Feet). No 999 cap (the engine's cap is a known calculator bug).

export const STAT_IDS = Object.freeze(['hp', 'atk', 'def', 'spa', 'spd', 'spe']);
export const STAT_LABEL = Object.freeze({ hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' });
export const STAT_NAME = Object.freeze({ hp: 'HP', atk: 'Attack', def: 'Defense', spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed' });
export const SP_PER_STAT = 32;
export const SP_TOTAL = 66;
export const ZERO_SP = Object.freeze({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });

/** '+', '-' or '' for this stat under a nature entry {plus, minus} (null plus/minus = neutral). */
export function natureSign(nature, stat) {
  if (!nature || !nature.plus || nature.plus === nature.minus) return '';
  return nature.plus === stat ? '+' : nature.minus === stat ? '-' : '';
}

/** One stat at level 50. sign: '+', '-' or ''. */
export function statValue(stat, base, sp, sign = '') {
  if (stat === 'hp') return base + sp + 75;
  const s = base + sp + 20;
  return sign === '+' ? Math.floor((s * 110) / 100) : sign === '-' ? Math.floor((s * 90) / 100) : s;
}

/** All six stats for base stats + SP + nature entry. */
export function computeStats(baseStats, sp, nature) {
  const out = {};
  for (const s of STAT_IDS) out[s] = statValue(s, baseStats[s], sp[s] ?? 0, natureSign(nature, s));
  return out;
}

/** Validation of a Stat Point spread: problems as stable codes; never clamps. 'unknown' is valid (opposing sets). */
export function spProblems(sp) {
  if (sp === 'unknown') return [];
  if (!sp || typeof sp !== 'object' || Array.isArray(sp)) return [{ code: 'sp-missing' }];
  const out = [];
  let total = 0;
  for (const s of STAT_IDS) {
    const v = sp[s];
    if (v === undefined || v === null || v === '') { total += 0; continue; }
    if (typeof v !== 'number' || !Number.isInteger(v)) { out.push({ code: 'sp-not-integer', stat: s }); continue; }
    if (v < 0) out.push({ code: 'sp-negative', stat: s });
    else if (v > SP_PER_STAT) out.push({ code: 'sp-over-stat', stat: s, value: v });
    total += v;
  }
  for (const k of Object.keys(sp)) if (!STAT_IDS.includes(k)) out.push({ code: 'sp-unknown-stat', stat: k });
  if (!out.some((p) => p.code === 'sp-not-integer') && total > SP_TOTAL) out.push({ code: 'sp-over-total', total });
  return out;
}

export const spTotal = (sp) => (sp && sp !== 'unknown' ? STAT_IDS.reduce((t, s) => t + (Number.isInteger(sp[s]) ? sp[s] : 0), 0) : 0);
export const normalizeSp = (sp) => Object.fromEntries(STAT_IDS.map((s) => [s, sp?.[s] ?? 0]));

// ---------- stages and Speed ----------
const BOOST = [1, 1.5, 2, 2.5, 3, 3.5, 4];
export function boostStat(stat, stage) {
  const st = Math.max(-6, Math.min(6, stage | 0));
  return st >= 0 ? Math.floor(stat * BOOST[st]) : Math.floor(stat / BOOST[-st]);
}
// Showdown's modify(): tr((tr(v*m) + 2047) / 4096) with a 4096-based modifier; chain: ((a*b + 2048) >> 12).
export const modify = (v, mod4096) => Math.trunc((Math.trunc(v * mod4096) + 2047) / 4096);
export const chainMods = (mods) => mods.reduce((m, x) => (m * x + 2048) >> 12, 4096);

export const WEATHER_SPEED = Object.freeze({ swiftswim: 'Rain', chlorophyll: 'Sun', sandrush: 'Sand', slushrush: 'Snow' });

/**
 * Final Speed. cond: { stage, tailwind, scarf (holding Choice Scarf), ironBall, para, status ('' or a status), ability (id),
 * weather, terrain, unburdenActive }. Returns { speed, mods: [codes applied] }.
 */
export function speedOf(spe, cond = {}) {
  const applied = [];
  let s = boostStat(spe, cond.stage ?? 0);
  if (cond.stage) applied.push(`stage:${cond.stage > 0 ? '+' : ''}${cond.stage}`);
  const mods = [];
  if (cond.tailwind) { mods.push(8192); applied.push('tailwind'); }
  const ab = cond.ability || '';
  if (WEATHER_SPEED[ab] && cond.weather === WEATHER_SPEED[ab]) { mods.push(8192); applied.push(ab); }
  if (ab === 'surgesurfer' && cond.terrain === 'Electric') { mods.push(8192); applied.push(ab); }
  if (ab === 'unburden' && cond.unburdenActive) { mods.push(8192); applied.push(ab); }
  const statused = !!(cond.status || cond.para);
  if (ab === 'quickfeet' && statused) { mods.push(6144); applied.push(ab); }
  if (cond.scarf && !(ab === 'unburden' && cond.unburdenActive)) { mods.push(6144); applied.push('choicescarf'); }
  if (cond.ironBall) { mods.push(2048); applied.push('ironball'); }
  if (mods.length) s = modify(s, chainMods(mods));
  if (cond.para && ab !== 'quickfeet') { s = Math.floor((s * 50) / 100); applied.push('paralysis'); }
  return { speed: Math.min(s, 10000), applied };
}

/** Speed for one form at given SP and nature sign (no other modifiers). */
export const rawSpeed = (baseSpe, sp, sign) => statValue('spe', baseSpe, sp, sign);

/** Their Speed range when SP/nature are unknown: 0 SP with a −Speed nature up to 32 SP with +Speed, under cond. */
export function speedRange(baseSpe, cond = {}, known = null) {
  if (known && Number.isInteger(known.sp) && known.sign !== undefined) {
    const v = speedOf(rawSpeed(baseSpe, known.sp, known.sign), cond).speed;
    return { min: v, max: v, neutralMax: v, exact: true };
  }
  return {
    min: speedOf(rawSpeed(baseSpe, 0, '-'), cond).speed,
    neutralMax: speedOf(rawSpeed(baseSpe, SP_PER_STAT, ''), cond).speed,
    max: speedOf(rawSpeed(baseSpe, SP_PER_STAT, '+'), cond).speed,
    exact: false,
  };
}

/**
 * Compare two Speeds (or ranges) for move order within one priority bracket. Returns
 * 'first' | 'second' | 'tie' | 'depends'. Under Trick Room slower moves first.
 */
export function compareSpeed(a, b, { trickRoom = false } = {}) {
  const lo = (x) => (typeof x === 'number' ? x : x.min), hi = (x) => (typeof x === 'number' ? x : x.max);
  if (typeof a === 'number' && typeof b === 'number' && a === b) return 'tie';
  const aFaster = lo(a) > hi(b), bFaster = lo(b) > hi(a);
  if (!aFaster && !bFaster) return 'depends';
  return (aFaster !== trickRoom) ? 'first' : 'second';
}

/**
 * Cheapest Speed SP (0..32) for a form so it moves before a target Speed (strictly faster), or, under Trick Room,
 * the most SP that keeps it strictly slower. Closed form: 33 evaluations per nature, no engine call.
 * Returns {sp, speed, margin, tieAt} or {impossible:true, best:{sp, speed}}.
 */
export function outspeedSP(baseSpe, sign, target, cond = {}, { trickRoom = false } = {}) {
  const at = (sp) => speedOf(rawSpeed(baseSpe, sp, sign), cond).speed;
  let tieAt = null;
  for (let sp = 0; sp <= SP_PER_STAT; sp++) if (at(sp) === target) { tieAt = sp; break; }
  if (!trickRoom) {
    for (let sp = 0; sp <= SP_PER_STAT; sp++) if (at(sp) > target) return { sp, speed: at(sp), margin: at(sp) - target, tieAt };
    return { impossible: true, best: { sp: SP_PER_STAT, speed: at(SP_PER_STAT) }, tieAt };
  }
  for (let sp = SP_PER_STAT; sp >= 0; sp--) if (at(sp) < target) return { sp, speed: at(sp), margin: target - at(sp), tieAt };
  return { impossible: true, best: { sp: 0, speed: at(0) }, tieAt };
}

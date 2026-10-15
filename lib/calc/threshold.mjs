// "What would it take?" searches: the cheapest Stat Points (and nature) for one of your sets to outspeed, survive a hit
// or KO, as a breakpoint table with the price of each safety level. Pure; the calc is injected (createCalc result).
// Budgets: survive and KO searches use at most 2 natures × 33 values = 66 engine runs (132 with the crit level; twice
// that when a shown HP band needs its bottom corner); outspeed uses no engine call. The results equal a brute-force
// sweep (test/calc-threshold.test.mjs).
// A nature change is never presented as free: each level has the cheapest option keeping the current nature and, when
// it is cheaper, one with the other nature plus what that nature gives up (natureTradeoff).
import { normalizeScenario } from './scenario.mjs';
import { STAT_IDS, SP_PER_STAT, SP_TOTAL, natureSign, outspeedSP, speedOf, statValue } from './stats.mjs';
import { TARGET_HP_MOVES } from './rules.mjs';

/** The stats a set's damaging moves read: Atk / SpA, Def for Body Press; Foul Play reads the target's Attack. */
export function attackStats(mech, set) {
  const used = new Set();
  for (const m of set.moves) {
    const mv = mech.moves[m];
    if (!mv || mv.category === 'Status' || m === 'foulplay') continue;
    used.add(m === 'bodypress' ? 'def' : mv.category === 'Physical' ? 'atk' : 'spa');
  }
  return used;
}

/**
 * A nature raising `stat` that lowers a stat this set doesn't attack with: Atk or SpA first, then (tuning Speed) the less
 * invested defence, else Speed. null when the current nature already raises `stat` (nothing cheaper to find). Not
 * covered: for Gyro Ball / Electro Ball the Speed side of a nature also changes power (e.g. Brave over Adamant); the
 * search doesn't offer that trade, and the calc shows it if you try the nature yourself.
 */
export function plusNatureFor(mech, set, stat) {
  const cur = mech.natures[set.nature];
  if (cur && cur.plus === stat && cur.minus !== stat) return null;
  const used = attackStats(mech, set);
  const sp = set.sp === 'unknown' ? {} : set.sp ?? {};
  const defs = (sp.def ?? 0) <= (sp.spd ?? 0) ? ['def', 'spd'] : ['spd', 'def'];
  const order = ['atk', 'spa', ...(stat === 'spe' ? defs : ['spe', ...defs])].filter((s) => s !== stat);
  const lowered = order.find((s) => !used.has(s)) ?? order[0];
  return Object.keys(mech.natures).sort().find((n) => mech.natures[n].plus === stat && mech.natures[n].minus === lowered) ?? null;
}

/**
 * What switching nature costs: { gains, loses, givesUp (the current nature's raised stat), losesUsed: true when it lowers
 * or gives up a stat this set attacks with, or Speed }.
 */
export function natureTradeoff(mech, set, to) {
  const from = mech.natures[set.nature], next = mech.natures[to];
  if (!next || set.nature === to) return null;
  const used = attackStats(mech, set);
  const matters = (s) => !!s && (used.has(s) || s === 'spe');
  const givesUp = from?.plus && from.plus !== from.minus && from.plus !== next.plus ? from.plus : null;
  const loses = next.minus !== next.plus ? next.minus : null;
  return { gains: next.plus !== next.minus ? next.plus : null, loses, givesUp, losesUsed: matters(loses) || matters(givesUp) };
}

const MINUS_SPEED = { atk: 'brave', spa: 'quiet', def: 'relaxed', spd: 'sassy' };

/** A −Speed nature for Trick Room: keep the current nature's raised stat, else raise the stat the set attacks with. */
export function minusSpeedNatureFor(mech, set) {
  const plus = mech.natures[set.nature]?.plus;
  if (MINUS_SPEED[plus]) return MINUS_SPEED[plus];
  const used = attackStats(mech, set);
  return used.has('spa') && !used.has('atk') ? 'quiet' : used.has('atk') ? 'brave' : 'relaxed';
}

const frac = (k) => (k ? Number(k.num) / Number(k.den) : null);
const higherOdds = (a, b) => (!b ? a : !a ? b : frac(a) >= frac(b) ? a : b); // the worse corner for a defender
const lowerOdds = (a, b) => (!b ? a : !a ? b : frac(a) <= frac(b) ? a : b); // the worse corner for an attacker

/** SP already committed to stats the search doesn't touch. */
const committed = (sp, free) => STAT_IDS.filter((s) => !free.includes(s)).reduce((t, s) => t + (sp[s] ?? 0), 0);

/** A run that isn't an exact number: carry what the screen needs to explain it. */
const refusedBy = (r) => ({ refused: r.code, class: r.class, question: r.question ?? null, reason: r.reason ?? null });

/** Per level: the cheapest option with the current nature (keep) and, when cheaper, with the other one (change). */
function levelsOf(levels, grid, set, order) {
  return levels.map((l) => {
    const pick = (n) => grid.filter((g) => g.nature === n && l.ok(g)).sort(order)[0] ?? null;
    const keep = pick(set.nature);
    const others = [...new Set(grid.map((g) => g.nature))].filter((n) => n !== set.nature);
    const change = others.map(pick).filter(Boolean).sort(order)[0] ?? null;
    const changeShown = change && (!keep || change.total < keep.total) ? change : null;
    return { key: l.key, option: keep ?? changeShown, keep, change: changeShown };
  });
}

/**
 * Survive search: my set is the defender. levels: survive every roll (KO odds 0), at least 15 of 16, at least half; with
 * includeCrit, also "survive a crit too" (crit KO odds 0). When the attacker's HP is a shown band, each point uses the
 * worse corner of the band. Returns { stat, natures:[…], levels:[{key, option, keep, change}], current, budget, calls }
 * or { refused, class?, question? }.
 */
export function surviveSearch(calc, mech, scIn, { includeCrit = false } = {}) {
  const sc = normalizeScenario(scIn);
  const before = calc.engineCalls();
  const mv = mech.moves[sc.move.id];
  if (!mv || mv.category === 'Status') return { refused: 'no-damage-move' };
  if (TARGET_HP_MOVES.includes(sc.move.id)) return { refused: 'target-hp-move' };
  if (sc.defender.set.species === 'mimikyu') return { refused: 'disguise-hp' };
  const stat = (mv.category === 'Physical' || ['psyshock', 'psystrike', 'secretsword'].includes(sc.move.id)) ? 'def' : 'spd';
  const set = sc.defender.set;
  if (set.sp === 'unknown') return { refused: 'sp-unknown' };
  const budget = SP_TOTAL - committed(set.sp, ['hp', stat]);
  const natures = [...new Set([set.nature, plusNatureFor(mech, set, stat)].filter(Boolean))];
  const baseHP = mech.species[set.species].baseStats.hp;
  const grid = []; // {nature, d, h, total, ko, koCrit}
  const koAt = (r, hp) => { const top = r.koForHP(hp); const low = r.hpLow?.koForHP?.(hp); return top && (low ?? null) ? higherOdds(top, low) : top; };
  for (const nature of natures) {
    for (let d = 0; d <= Math.min(SP_PER_STAT, budget); d++) {
      const s = structuredClone(sc);
      s.defender.set.nature = nature;
      s.defender.set.sp = { ...set.sp, hp: 0, [stat]: d };
      s.defender.state.hpPct = 100;
      const r = calc.run(s, { lite: true });
      if (r.class !== 'exact') return refusedBy(r);
      let rc = null;
      if (includeCrit) {
        const sCrit = structuredClone(s); sCrit.move.crit = true;
        rc = calc.run(sCrit, { lite: true });
        if (rc.class !== 'exact') return refusedBy(rc);
      }
      for (let h = 0; h <= Math.min(SP_PER_STAT, budget - d); h++) {
        const hp = baseHP + h + 75;
        const k = koAt(r, hp);
        if (!k) return { refused: r.ko.one.refused ?? 'ko-unavailable' };
        const kc = rc ? koAt(rc, hp) : null;
        grid.push({ nature, d, h, total: d + h, ko: { num: k.num, den: k.den }, koCrit: kc ? { num: kc.num, den: kc.den } : null });
      }
    }
  }
  const levels = [
    { key: 'every-roll', ok: (g) => g.ko.num === '0' },
    { key: 'fifteen-of-sixteen', ok: (g) => frac(g.ko) <= 1 / 16 },
    { key: 'half', ok: (g) => frac(g.ko) <= 1 / 2 },
  ];
  if (includeCrit) levels.unshift({ key: 'crit-too', ok: (g) => g.ko.num === '0' && g.koCrit?.num === '0' });
  const order = (a, b) => a.total - b.total || b.h - a.h;
  const best = [...grid].sort((a, b) => frac(a.ko) - frac(b.ko) || a.total - b.total)[0] ?? null;
  const cur = calc.run({ ...sc, defender: { ...sc.defender, state: { ...sc.defender.state, hpPct: 100 } } }, { lite: true });
  return {
    stat, natures, budget, levels: levelsOf(levels, grid, set, order), best,
    current: cur.class === 'exact' ? higherOdds(cur.ko.one, cur.hpLow?.ko.one) : null, currentResult: cur.class === 'exact' ? cur : null,
    hits: cur.class === 'exact' ? Math.max(...cur.move.dist.map((x) => x.n)) : 1,
    calls: calc.engineCalls() - before,
  };
}

/**
 * KO search: my set is the attacker; tune its attacking stat. levels: KO every roll, at least 15 of 16, at least half.
 * uses: 1 (default) searches one use; 2 searches the two-use line (a 2HKO: the calc's own `ko.two`, full runs, so between-turn
 * effects it can't model are refused exactly as on the calc). A shown HP band uses its better corner for the target (the KO
 * must hold across the band); both sides on a band are refused, and a two-use search needs both at full HP.
 */
export function koSearch(calc, mech, scIn, { uses = 1 } = {}) {
  const sc = normalizeScenario(scIn);
  const before = calc.engineCalls();
  const mv = mech.moves[sc.move.id];
  if (!mv || mv.category === 'Status') return { refused: 'no-damage-move' };
  if (sc.move.id === 'foulplay') return { refused: 'foul-play' };
  if (sc.attacker.state.hpPct < 100 && sc.defender.state.hpPct < 100) return { refused: 'hp-band-both' };
  if (uses === 2 && (sc.attacker.state.hpPct < 100 || sc.defender.state.hpPct < 100)) return { refused: 'hp-band-two' };
  const stat = sc.move.id === 'bodypress' ? 'def' : mv.category === 'Physical' ? 'atk' : 'spa';
  const set = sc.attacker.set;
  if (set.sp === 'unknown') return { refused: 'sp-unknown' };
  const budget = SP_TOTAL - committed(set.sp, [stat]);
  const natures = [...new Set([set.nature, plusNatureFor(mech, set, stat)].filter(Boolean))];
  const grid = [];
  let hits = 1;
  for (const nature of natures) {
    for (let a = 0; a <= Math.min(SP_PER_STAT, budget); a++) {
      const s = structuredClone(sc);
      s.attacker.set.nature = nature;
      s.attacker.set.sp = { ...set.sp, [stat]: a };
      const r = calc.run(s, { lite: uses === 1 });
      if (r.class !== 'exact') return refusedBy(r);
      const k = uses === 2 ? r.ko.two : r.ko.one;
      if (k.refused) return { refused: k.refused };
      hits = Math.max(...r.move.dist.map((x) => x.n));
      grid.push({ nature, a, total: a, ko: uses === 2 ? { num: k.num, den: k.den } : lowerOdds(r.ko.one, r.hpLow?.ko.one), range: r.range, maxHP: r.maxHP });
    }
  }
  const levels = [
    { key: 'every-roll', ok: (g) => g.ko.num === g.ko.den },
    { key: 'fifteen-of-sixteen', ok: (g) => frac(g.ko) >= 15 / 16 },
    { key: 'half', ok: (g) => frac(g.ko) >= 1 / 2 },
  ];
  // Breakpoints: per nature, the SP values where the KO odds change.
  const breakpoints = natures.map((n) => {
    const rows = grid.filter((g) => g.nature === n);
    const out = [];
    for (const g of rows) if (!out.length || out.at(-1).ko.num !== g.ko.num || out.at(-1).ko.den !== g.ko.den) out.push({ a: g.a, ko: g.ko });
    return { nature: n, steps: out };
  });
  const cur = grid.find((g) => g.nature === set.nature && g.a === (set.sp[stat] ?? 0));
  return { stat, natures, budget, uses, levels: levelsOf(levels, grid, set, (x, y) => x.total - y.total), breakpoints, hits, current: cur?.ko ?? null, calls: calc.engineCalls() - before };
}

/**
 * Outspeed: the cheapest Speed SP (per nature sign available: current nature and a +Speed one) to move before a target
 * Speed. Under Trick Room the answer is a ceiling: any Speed SP up to `sp` stays slower, so it is always within budget and
 * `keep` is what to set (your current Speed SP if it already works, else the ceiling). cond: speed conditions of my side.
 * No engine calls.
 */
export function outspeedSearch(mech, set, formeId, target, cond = {}, { trickRoom = false } = {}) {
  const base = mech.species[formeId].baseStats.spe;
  const curSign = natureSign(mech.natures[set.nature], 'spe');
  const curSpe = set.sp === 'unknown' ? null : set.sp.spe ?? 0;
  const budget = SP_TOTAL - committed(set.sp === 'unknown' ? {} : set.sp, ['spe']);
  const options = [];
  const signs = trickRoom ? [...new Set([curSign, '-'])] : [...new Set([curSign, '+'])];
  for (const sign of signs) {
    const r = outspeedSP(base, sign, target, cond, { trickRoom });
    const nature = sign === curSign ? set.nature : trickRoom ? minusSpeedNatureFor(mech, set) : plusNatureFor(mech, set, 'spe');
    if (!nature) continue;
    const keep = r.impossible ? null : trickRoom ? Math.min(curSpe ?? r.sp, r.sp) : r.sp;
    options.push({ sign, nature, ...r, keep, withinBudget: !r.impossible && (trickRoom || r.sp <= budget), tradeoff: natureTradeoff(mech, set, nature) });
  }
  const current = set.sp === 'unknown' ? null : speedOf(statValue('spe', base, set.sp.spe ?? 0, curSign), cond).speed;
  return { target, trickRoom, budget, options, current };
}

// "What would it take?" searches (lib/calc/threshold.mjs) against a brute-force sweep of full calc runs: the shortcut
// (one engine run per Def/SpD value, HP varied through koForHP) must give the same odds and the same cheapest options.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mech, newCalc, set, CHOMP, INCIN, sc } from './calc-helpers.mjs';
import { surviveSearch, koSearch, outspeedSearch, plusNatureFor, minusSpeedNatureFor, natureTradeoff, attackStats } from '../lib/calc/threshold.mjs';
import { statValue, speedOf, natureSign, SP_TOTAL } from '../lib/calc/stats.mjs';

const frac = (k) => Number(k.num) / Number(k.den);
const CHOMP_LO = { ...CHOMP, item: 'lifeorb' }; // Earthquake KOs an uninvested Incineroar and fails into a full Def + HP one
const cheapestOf = (grid, ok) => grid.filter(ok).sort((a, b) => a.total - b.total || b.h - a.h)[0] ?? null;
/** keep: cheapest with the current nature; change: cheapest with another nature, shown only when it is cheaper. */
const keepChange = (grid, ok, cur) => {
  const keep = cheapestOf(grid.filter((g) => g.nature === cur), ok), other = cheapestOf(grid.filter((g) => g.nature !== cur), ok);
  return { keep, change: other && (!keep || other.total < keep.total) ? other : null };
};
const pos = (o) => o && [o.nature, o.d ?? o.a, o.h ?? null];

test('survive search equals a brute-force sweep of full runs (every HP × Def value, both natures) within its engine budget', () => {
  const calc = newCalc();
  const me = set('incineroar', 'intimidate', 'careful', { hp: 0, def: 0, spd: 32, atk: 2 }, ['fakeout', 'flareblitz', 'partingshot']);
  const scen = sc(CHOMP_LO, me, 'earthquake', { a: {}, d: {} });
  const res = surviveSearch(calc, mech, scen, { includeCrit: false });
  assert.equal(res.stat, 'def');
  assert.deepEqual(res.natures, ['careful', 'impish']);
  assert.equal(res.budget, SP_TOTAL - 34);
  assert.ok(res.calls <= 2 * 33 + 1, `engine runs ${res.calls}`);
  const grid = [];
  for (const nature of res.natures) for (let d = 0; d <= 32; d++) for (let h = 0; h <= Math.min(32, res.budget - d); h++) {
    if ((d * 33 + h) % 3 && h !== 0 && h !== 32) continue; // full runs for a third of the grid plus every edge; the levels below need all
    const s = structuredClone(scen);
    s.defender.set.nature = nature;
    s.defender.set.sp = { ...me.sp, def: d, hp: h };
    const r = calc.run(s);
    assert.equal(r.class, 'exact');
    grid.push({ nature, d, h, total: d + h, ko: r.ko.one });
  }
  // the shortcut's odds at those points are the full run's odds
  const shortcut = new Map();
  for (const lvl of res.levels) if (lvl.option) shortcut.set(`${lvl.option.nature}/${lvl.option.d}/${lvl.option.h}`, lvl.option.ko);
  for (const g of grid) {
    const k = shortcut.get(`${g.nature}/${g.d}/${g.h}`);
    if (k) assert.deepEqual(k, { num: g.ko.num, den: g.ko.den });
  }
  // the levels: brute-force cheapest over the full grid (all points; koForHP checked against full runs above)
  const full = [];
  for (const nature of res.natures) for (let d = 0; d <= 32; d++) {
    const s = structuredClone(scen); s.defender.set.nature = nature; s.defender.set.sp = { ...me.sp, def: d, hp: 0 };
    const r = calc.run(s);
    for (let h = 0; h <= Math.min(32, res.budget - d); h++) {
      const hp = mech.species.incineroar.baseStats.hp + h + 75;
      const k = r.koForHP(hp);
      const sampled = grid.find((g) => g.nature === nature && g.d === d && g.h === h);
      if (sampled) assert.deepEqual({ num: k.num, den: k.den }, { num: sampled.ko.num, den: sampled.ko.den }, `${nature} ${d}/${h}`);
      full.push({ nature, d, h, total: d + h, ko: k });
    }
  }
  const expect = {
    'every-roll': keepChange(full, (g) => g.ko.num === '0', 'careful'),
    'fifteen-of-sixteen': keepChange(full, (g) => frac(g.ko) <= 1 / 16, 'careful'),
    half: keepChange(full, (g) => frac(g.ko) <= 1 / 2, 'careful'),
  };
  for (const l of res.levels) {
    const e = expect[l.key];
    assert.ok(e.keep && e.keep.total > 0, `${l.key}: the scenario needs investment`);
    assert.deepEqual([pos(l.keep), pos(l.change)], [pos(e.keep), pos(e.change)], l.key);
    assert.deepEqual(pos(l.option), pos(e.keep), 'the headline option keeps your nature when it can');
  }
  assert.ok(res.levels.some((l) => l.change), 'a nature change is offered where it is cheaper');
  assert.ok(full.some((g) => g.ko.num !== '0' && g.ko.num !== g.ko.den), 'some spreads sit between "always" and "never"');
});

test('survive search with the crit level, Sitrus Berry and refusals', () => {
  const calc = newCalc();
  const me = set('incineroar', 'intimidate', 'careful', { atk: 2 }, ['fakeout', 'flareblitz'], 'sitrusberry');
  const res = surviveSearch(calc, mech, sc(CHOMP, me, 'earthquake'), { includeCrit: true });
  assert.equal(res.levels[0].key, 'crit-too');
  assert.ok(res.calls <= 2 * 2 * 33 + 1);
  const opt = res.levels[0].option;
  assert.ok(opt && opt.total > 0, 'surviving the crit costs Stat Points here');
  assert.equal(res.levels[1].option.total, 0, 'the normal hit is survived with none');
  const s = sc(CHOMP, { ...me, nature: opt.nature, sp: { ...me.sp, def: opt.d, hp: opt.h } }, 'earthquake', { move: { crit: true } });
  assert.equal(calc.run(s).ko.one.num, '0', 'the crit-too option survives the crit');
  assert.equal(calc.run({ ...s, move: { id: 'earthquake' } }).ko.one.num, '0');
  const cheaper = opt.d > 0 ? { def: opt.d - 1, hp: opt.h } : { def: opt.d, hp: opt.h - 1 };
  assert.notEqual(calc.run(sc(CHOMP, { ...me, nature: opt.nature, sp: { ...me.sp, ...cheaper } }, 'earthquake', { move: { crit: true } })).ko.one.num, '0', 'one point less and the crit can KO');
  assert.equal(surviveSearch(calc, mech, sc(CHOMP, { ...me, sp: 'unknown' }, 'earthquake')).refused, 'sp-unknown');
  assert.equal(surviveSearch(calc, mech, sc(CHOMP, me, 'protect')).refused, 'no-damage-move');
  assert.equal(surviveSearch(calc, mech, sc(INCIN, set('mimikyu', 'disguise', 'jolly', { atk: 32 }, ['playrough']), 'flareblitz')).refused, 'disguise-hp');
});

test('KO search equals brute force over the attacking stat, with breakpoints where the odds change', () => {
  const calc = newCalc();
  const me = set('garchomp', 'roughskin', 'jolly', { spe: 32, hp: 2 }, ['earthquake', 'dragonclaw'], 'lifeorb');
  const res = koSearch(calc, mech, sc(me, INCIN, 'earthquake'));
  assert.equal(res.stat, 'atk');
  assert.deepEqual(res.natures, ['jolly', 'adamant']);
  assert.ok(res.calls <= 2 * 33);
  const full = [];
  for (const nature of res.natures) for (let a = 0; a <= Math.min(32, res.budget); a++) {
    const r = calc.run(sc({ ...me, nature, sp: { ...me.sp, atk: a } }, INCIN, 'earthquake'));
    full.push({ nature, a, total: a, ko: r.ko.one });
  }
  assert.ok(full.some((g) => g.ko.num === '0') && full.some((g) => g.ko.num !== '0'), 'the KO line is crossed inside the grid');
  assert.ok(res.breakpoints.every((b) => b.steps.length > 1));
  for (const [key, ok] of [['every-roll', (g) => g.ko.num === g.ko.den], ['fifteen-of-sixteen', (g) => frac(g.ko) >= 15 / 16], ['half', (g) => frac(g.ko) >= 1 / 2]]) {
    const e = keepChange(full, ok, 'jolly');
    const got = res.levels.find((l) => l.key === key);
    assert.deepEqual([pos(got.keep), pos(got.change)], [pos(e.keep), pos(e.change)], key);
  }
  for (const bp of res.breakpoints) {
    const rows = full.filter((g) => g.nature === bp.nature);
    for (const g of rows) {
      const step = bp.steps.filter((s) => s.a <= g.a).at(-1);
      assert.deepEqual({ num: step.ko.num, den: step.ko.den }, { num: g.ko.num, den: g.ko.den }, `${bp.nature} ${g.a}`);
    }
  }
  assert.equal(koSearch(calc, mech, sc(me, INCIN, 'foulplay')).refused, 'foul-play');
});

test('outspeed search: smallest Speed SP that moves first, per nature sign, under every speed condition (no engine runs)', () => {
  const me = set('incineroar', 'intimidate', 'careful', { hp: 32, spd: 32 }, ['fakeout', 'flareblitz']);
  const base = mech.species.incineroar.baseStats.spe;
  for (const cond of [{}, { tailwind: true }, { stage: 1 }, { stage: -1 }, { scarf: true }, { para: true }]) {
    for (const target of [50, 80, 100, 121, 150]) {
      const res = outspeedSearch(mech, me, 'incineroar', target, cond);
      for (const o of res.options) {
        let brute = null;
        for (let sp = 0; sp <= 32 && brute === null; sp++) if (speedOf(statValue('spe', base, sp, o.sign), cond).speed > target) brute = sp;
        assert.equal(o.impossible ? null : o.sp, brute, `${JSON.stringify(cond)} → ${target} (${o.sign || 'neutral'})`);
        assert.equal(o.withinBudget, brute !== null && brute <= res.budget);
      }
    }
  }
  const tr = outspeedSearch(mech, me, 'incineroar', 60, {}, { trickRoom: true });
  assert.deepEqual(tr.options.map((o) => [o.sign, o.nature]), [['', 'careful'], ['-', 'sassy']], 'Trick Room keeps the raised stat');
  assert.equal(minusSpeedNatureFor(mech, CHOMP), 'brave');
  assert.equal(minusSpeedNatureFor(mech, set('gholdengo', 'goodasgold', 'timid', {}, ['makeitrain', 'shadowball'])), 'quiet');
  assert.equal(plusNatureFor(mech, CHOMP, 'spe'), null, 'already +Speed: nothing cheaper to try');
  assert.equal(plusNatureFor(mech, me, 'spe'), 'jolly', 'a physical attacker gives up SpA');
  const mixed = set('garchomp', 'roughskin', 'hardy', { atk: 32, spe: 32, def: 2 }, ['earthquake', 'dracometeor']);
  assert.deepEqual([...attackStats(mech, mixed)].sort(), ['atk', 'spa']);
  assert.equal(mech.natures[plusNatureFor(mech, mixed, 'spe')].minus, 'spd', 'a mixed attacker gives up its less invested defence, not an attacking stat');
  assert.equal(plusNatureFor(mech, { ...mixed, nature: 'naive' }, 'spe'), null, 'Naive already raises Speed: no alternative to offer');
  assert.equal(plusNatureFor(mech, set('corviknight', 'pressure', 'careful', {}, ['bodypress']), 'def'), 'bold', 'Body Press uses Def, not Atk: lowering Atk is free');
  assert.deepEqual(natureTradeoff(mech, set('kingambit', 'defiant', 'adamant', {}, ['kowtowcleave']), 'impish'), { gains: 'def', loses: 'spa', givesUp: 'atk', losesUsed: true }, 'Kingambit gives up the +Atk it attacks with');
  assert.equal(natureTradeoff(mech, CHOMP, 'adamant').losesUsed, true, 'Jolly → Adamant loses Speed');
  // Trick Room: the answer is a ceiling, never "over budget", and Save keeps your current Speed when it already works
  const slow = set('incineroar', 'intimidate', 'adamant', { hp: 32, atk: 32, spe: 0 }, ['fakeout', 'flareblitz']);
  const trr = outspeedSearch(mech, slow, 'incineroar', 120, {}, { trickRoom: true });
  assert.ok(trr.options.every((o) => o.impossible || o.withinBudget));
  assert.ok(trr.options.every((o) => o.impossible || o.keep === 0), 'already slower with 0 Speed SP: keep 0');
  assert.equal(natureSign(mech.natures.jolly, 'spe'), '+');
});

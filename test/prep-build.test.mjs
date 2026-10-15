// Build dashboard logic (lib/prep-build.mjs) and the two-use KO search (lib/calc/threshold.mjs koSearch {uses: 2}).
// The six reference vectors come from VGC Strategy's Rotom-Fan case (docs/research/strategy/sp-assist/rotom-fan-case.md §9),
// computed there by an independent calculator; here they must come out of the app's own engine and searches.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mech, newCalc, set, sc } from './calc-helpers.mjs';
import { koSearch, surviveSearch } from '../lib/calc/threshold.mjs';
import { statValue, speedOf, natureSign } from '../lib/calc/stats.mjs';
import * as B from '../lib/prep-build.mjs';

const frac = (k) => Number(k.num) / Number(k.den);
const MOVES = ['thunderbolt', 'airslash', 'voltswitch', 'protect'];
const rotom = (nature, sp, item = '', moves = MOVES) => ({ ...set('rotomfan', 'levitate', nature, sp, moves, item), species: 'rotomfan' });
const MODAL = { hp: 29, atk: 1, spd: 4, spe: 32 }; // Jolly 29/1/0/0/4/32, the top ladder spread (Smogon Reg M-C ≥1760, Sept 2026)
const rap = (sp = MODAL, nature = 'jolly') => set('staraptor', 'intimidate', nature, sp, ['closecombat', 'bravebird', 'protect', 'tailwind'], 'staraptite');
// the slimmed usage shape (lib/usage.mjs slimChaos) for the Mega row, from the same ladder month
const USAGE = { month: '2026-09', species: { staraptormega: { usage: 6.26, abilities: [['Contrary', 100]], items: [['Staraptite', 100]],
  moves: [['Close Combat', 99.98], ['Protect', 98.39], ['Brave Bird', 93.12], ['Tailwind', 69.4]], spreads: [['Jolly:29/1/0/0/4/32', 11.82], ['Jolly:2/32/0/0/0/32', 8.14]] } } };
const rows = () => B.targetsOf(mech, ['staraptor'], { usage: USAGE, asOf: '2026-10-15' });
const megaRow = () => rows().find((r) => r.key === 'staraptormega');

test('reference 1: Rotom-Fan Modest 32 SpA = 172; 0/0 Jolly Mega Staraptor HP 160, SpD 110', () => {
  assert.equal(statValue('spa', mech.species.rotomfan.baseStats.spa, 32, '+'), 172);
  assert.equal(statValue('hp', mech.species.staraptormega.baseStats.hp, 0), 160);
  assert.equal(statValue('spd', mech.species.staraptormega.baseStats.spd, 0, natureSign(mech.natures.jolly, 'spd')), 110);
});

test('reference 2: neutral 32 SpA Thunderbolt into 0/0 Jolly Mega Staraptor rolls 146–174', () => {
  const r = newCalc().run(sc(rotom('hardy', { spa: 32 }), rap({ spe: 32 }), 'thunderbolt'));
  assert.equal(r.class, 'exact');
  assert.deepEqual([r.range.min, r.range.max, r.maxHP], [146, 174, 160]);
});

test('reference 3: Modest 32 Life Orb +0 into the common spread 198–237 (16/16); at SpD +1 133–159 (0/16)', () => {
  const calc = newCalc();
  const a = calc.run(sc(rotom('modest', { spa: 32 }, 'lifeorb'), rap(), 'thunderbolt'));
  assert.deepEqual([a.range.min, a.range.max, a.maxHP, a.ko.one.num, a.ko.one.den], [198, 237, 189, '1', '1']);
  const b = calc.run(sc(rotom('modest', { spa: 32 }, 'lifeorb'), rap(), 'thunderbolt', { d: { boosts: { spd: 1 } } }));
  assert.deepEqual([b.range.min, b.range.max, b.ko.one.num], [133, 159, '0']);
  // the dashboard's own path: the ladder row's common spread, their stage from "after their Close Combat"
  const row = megaRow();
  const after = B.afterTheirMoves(mech, row.set, row.forme, 'spd');
  assert.deepEqual(after, [{ move: 'closecombat', stage: 1 }], 'Contrary Close Combat raises SpD by 1');
  const h = B.hitResult(calc, mech, rotom('modest', { spa: 32 }, 'lifeorb'), row, 'thunderbolt', { stage: after[0].stage });
  assert.equal(h.spread, 'common');
  assert.deepEqual([h.result.range.min, h.result.range.max, h.result.ko.one.num], [133, 159, '0']);
});

test('reference 4: Modest 16 SpA at +2 into the common spread at SpD +1: 186–218, 13 of 16', () => {
  const calc = newCalc();
  const h = B.hitResult(calc, mech, rotom('modest', { spa: 16 }, '', ['thunderbolt', 'nastyplot', 'voltswitch', 'protect']), megaRow(), 'thunderbolt', { boost: 2, stage: 1 });
  assert.deepEqual([h.result.range.min, h.result.range.max, h.result.ko.one.num, h.result.ko.one.den], [186, 218, '13', '16']);
  assert.ok(h.result.chips.some((c) => /stage|boost/.test(c.code)), 'the stages show as assumption chips');
});

test('reference 5: KO benchmark: Modest no item +2 → 15/16 at 0 SpA; Life Orb +0 → 23 SpA for every roll', () => {
  const calc = newCalc();
  const np = B.koBenchmark(calc, mech, rotom('modest', { spa: 32 }, '', ['thunderbolt', 'nastyplot', 'voltswitch', 'protect']), megaRow(), 'thunderbolt', { boost: 2 });
  assert.equal(np.spread, 'common');
  assert.equal(np.levels.find((l) => l.key === 'fifteen-of-sixteen').keep.a, 0);
  assert.equal(np.levels.find((l) => l.key === 'fifteen-of-sixteen').slack, 32, 'slack: 32 SpA held, 0 needed');
  const lo = B.koBenchmark(calc, mech, rotom('modest', { spa: 32 }, 'lifeorb'), megaRow(), 'thunderbolt');
  assert.equal(lo.levels.find((l) => l.key === 'every-roll').keep.a, 23);
  assert.equal(lo.levels.find((l) => l.key === 'every-roll').slack, 9);
  // no item at +0: no level reachable even with 32 (the reference: 0/16 with Modest 32)
  const none = B.koBenchmark(calc, mech, rotom('modest', { spa: 32 }), megaRow(), 'thunderbolt');
  assert.ok(none.levels.every((l) => !l.keep), 'no +0 OHKO without an item');
});

test('reference 6: Final Gambit (Scarf Staraptor, 32 HP) = 192 > Rotom-Fan max HP 157: no survive option', () => {
  const calc = newCalc();
  const me = rotom('modest', { spa: 32, hp: 32, spd: 2 });
  const gam = set('staraptor', 'intimidate', 'jolly', { hp: 32, atk: 2, spe: 32 }, ['finalgambit', 'closecombat', 'bravebird', 'uturn'], 'choicescarf');
  const r = calc.run(sc(gam, me, 'finalgambit'));
  assert.deepEqual([r.range.min, r.range.max, r.maxHP], [192, 192, 157]);
  const s = surviveSearch(calc, mech, sc(gam, me, 'finalgambit'));
  assert.ok(s.levels.every((l) => !l.keep && !l.change), 'no HP / SpD spread survives');
});

test('survive benchmark from a target row: Final Gambit has no answer; Mega Staraptor\'s Brave Bird is already survived at 32 HP', () => {
  const calc = newCalc();
  const me = rotom('modest', { spa: 32, hp: 32, spd: 2 });
  const gambit = { key: 'staraptor', species: 'staraptor', forme: 'staraptor', mega: false, source: 'set', common: null,
    set: set('staraptor', 'intimidate', 'jolly', { hp: 32, atk: 2, spe: 32 }, ['finalgambit', 'closecombat', 'bravebird', 'uturn'], 'choicescarf') };
  const g = B.surviveBenchmark(calc, mech, me, gambit, 'finalgambit');
  assert.ok(g.levels.every((l) => !l.keep && !l.change));
  const bb = B.surviveBenchmark(calc, mech, me, megaRow(), 'bravebird');
  assert.equal(bb.spread, 'max', 'their worst case by default');
  assert.equal(bb.stat, 'def');
  const every = bb.levels.find((l) => l.key === 'every-roll').keep;
  assert.ok(every && every.h <= 32 && every.d <= 0, `Brave Bird (resisted) needs no Def: ${JSON.stringify(every)}`);
});

test('two-use KO search equals brute force over full runs (ko.two), and never needs more than one use', () => {
  const calc = newCalc();
  for (const [me, target, move, opts] of [
    [rotom('modest', { spe: 32, hp: 2 }), rap(), 'thunderbolt', {}],
    [rotom('timid', { spe: 32, hp: 2 }), rap(), 'airslash', { d: { boosts: { spd: 1 } } }],
    [rotom('modest', { spe: 32, hp: 2 }), rap({ hp: 32, spd: 32, spe: 2 }, 'careful'), 'thunderbolt', { d: { boosts: { spd: 2 } } }],
  ]) {
    const scen = sc(me, target, move, opts);
    const two = koSearch(calc, mech, scen, { uses: 2 });
    const one = koSearch(calc, mech, scen);
    assert.equal(two.uses, 2);
    const full = [];
    for (const nature of two.natures) for (let a = 0; a <= Math.min(32, two.budget); a++) {
      const r = calc.run(sc({ ...me, nature, sp: { ...me.sp, spa: a } }, target, move, opts));
      full.push({ nature, a, ko: r.ko.two });
    }
    for (const [key, ok] of [['every-roll', (g) => g.ko.num === g.ko.den], ['fifteen-of-sixteen', (g) => frac(g.ko) >= 15 / 16], ['half', (g) => frac(g.ko) >= 1 / 2]]) {
      const keep = full.filter((g) => g.nature === me.nature && ok(g)).sort((x, y) => x.a - y.a)[0] ?? null;
      const lv = two.levels.find((l) => l.key === key);
      assert.equal(lv.keep?.a ?? null, keep?.a ?? null, `${move} ${key}`);
      const oneLv = one.levels.find((l) => l.key === key);
      if (oneLv.keep && lv.keep) assert.ok(lv.keep.a <= oneLv.keep.a, 'two uses never need more SP than one');
    }
  }
  assert.equal(koSearch(calc, mech, sc(rotom('modest', { spa: 32 }), rap(), 'thunderbolt', { d: { hpPct: 50 } }), { uses: 2 }).refused, 'hp-band-two');
});

test('KO benchmark at +0 / +1 / +2 equals brute force, and a higher stage never needs more SP', () => {
  const calc = newCalc();
  const me = rotom('modest', { spe: 32, hp: 2 });
  let prev = null;
  for (const boost of [0, 1, 2]) {
    const b = B.koBenchmark(calc, mech, me, megaRow(), 'thunderbolt', { boost, stage: 1 });
    for (const l of b.levels) {
      const ok = { 'every-roll': (k) => k.num === k.den, 'fifteen-of-sixteen': (k) => frac(k) >= 15 / 16, half: (k) => frac(k) >= 0.5 }[l.key];
      let brute = null;
      for (let a = 0; a <= 32 && brute === null; a++) {
        const r = calc.run(sc({ ...me, sp: { ...me.sp, spa: a } }, { ...rap(), sp: { hp: 29, atk: 1, def: 0, spa: 0, spd: 4, spe: 32 } }, 'thunderbolt', { a: { boosts: { spa: boost } }, d: { boosts: { spd: 1 } } }));
        if (ok(r.ko.one)) brute = a;
      }
      assert.equal(l.keep?.a ?? null, brute, `+${boost} ${l.key}`);
      if (prev) { const p = prev.levels.find((x) => x.key === l.key); if (p.keep) assert.ok(l.keep && l.keep.a <= p.keep.a); }
    }
    prev = b;
  }
});

test('speed: Rotom-Fan 138 (Modest 32) and 151 (Timid 32) never pass Mega Staraptor 178; exact ties are kept apart', () => {
  const row = { ...megaRow(), set: { ...rap(), species: 'staraptor' } };
  const sp = (set) => B.mySpeed(mech, set, 'rotomfan');
  assert.equal(sp(rotom('modest', { spa: 32, spe: 32 })), 138);
  assert.equal(sp(rotom('timid', { spa: 32, spe: 32 })), 151);
  assert.equal(B.targetSpeed(mech, row).max, 178);
  for (const n of ['modest', 'timid']) {
    const c = B.creepTargets(mech, rotom(n, { spa: 32, spe: 32 }), 'rotomfan', [row]);
    assert.equal(c.length, 1);
    assert.equal(c[0].verdict, 'slower');
    assert.ok(c[0].keep.impossible && (!c[0].alt || c[0].alt.impossible), 'no Speed SP or nature gets there');
  }
  // under your Tailwind a 0-Speed Modest Rotom-Fan reaches 212 > 178
  assert.equal(B.mySpeed(mech, rotom('modest', { spa: 32 }), 'rotomfan', { tailwind: true }), 212);
  const tw = B.creepTargets(mech, rotom('modest', { spa: 32 }), 'rotomfan', [row], { mine: { tailwind: true } });
  assert.equal(tw[0].verdict, 'faster');
  assert.equal(tw[0].keep.sp, 0);
  // an exact tie: their 138 vs your 138 is "tie", never "faster"; the cheapest SP to pass is one more than the tie point
  const twin = { key: 'rotomfan', forme: 'rotomfan', mega: false, set: rotom('hardy', { spe: 32 }) };
  const t = B.creepTargets(mech, rotom('modest', { spa: 32, spe: 32 }), 'rotomfan', [twin]);
  assert.equal(t[0].verdict, 'tie');
  assert.equal(t[0].keep.tieAt, 32);
  assert.ok(t[0].keep.impossible, 'Modest can only tie 138');
  assert.equal(t[0].alt.nature, 'timid');
  const brute = [...Array(33).keys()].find((x) => speedOf(statValue('spe', 86, x, '+')).speed > 138);
  assert.equal(t[0].alt.sp, brute);
  // a range that contains your Speed is "depends", never "faster"
  assert.equal(B.speedVerdict(138, { min: 100, max: 160, exact: false }), 'depends');
  assert.equal(B.speedVerdict(138, { min: 138, max: 138, exact: true }), 'tie');
});

test('speed: an unknown-SP target with a ladder spread uses it as the common Speed (Mega Staraptor Jolly 32 → 178), labelled', () => {
  const row = megaRow(); // SP unknown, ladder common spread Jolly 29/1/0/0/4/32
  const rg = B.targetSpeed(mech, row);
  assert.equal(rg.exact, false);
  assert.deepEqual([rg.min, rg.neutralMax, rg.max, rg.ladder, rg.ladderLabel], [117, 162, 178, 178, 'Jolly 32']);
  const c = B.creepTargets(mech, rotom('modest', { spa: 32, spe: 32 }), 'rotomfan', [row]);
  assert.deepEqual(c.map((x) => [x.mark, x.label, x.speed, x.verdict]), [['ladder', 'Jolly 32', 178, 'slower']], 'no 162 "common max"; the worst case equals the ladder Speed, so one row');
  assert.ok(c[0].keep.impossible);
  assert.equal(B.speedVerdict(138, { min: rg.ladder, max: rg.ladder, exact: true }), 'slower');
  assert.equal(B.speedVerdict(138, rg), 'depends', 'against any spread it would only be "depends"');
  // without a ladder spread: the neutral common max and the worst case, as before
  const bare = B.creepTargets(mech, rotom('modest', { spa: 32, spe: 32 }), 'rotomfan', [{ ...row, common: null }]);
  assert.deepEqual(bare.map((x) => [x.mark, x.speed]).sort(), [['common-max', 162], ['worst', 178]]);
});

test('targets: every Mega is its own row; ladder rows are labelled, the Mega keeps its stone and the forme usage', () => {
  const r = rows();
  assert.deepEqual(r.map((x) => [x.key, x.mega, x.source]), [['staraptor', false, 'none'], ['staraptormega', true, 'ladder']]);
  const m = r[1];
  assert.equal(m.set.item, 'staraptite');
  assert.equal(m.usageFrom, 'forme');
  assert.deepEqual(m.set.moves, ['closecombat', 'protect', 'bravebird', 'tailwind']);
  assert.deepEqual(m.common, { nature: 'jolly', sp: { hp: 29, atk: 1, def: 0, spa: 0, spd: 4, spe: 32 } });
  assert.equal(m.set.sp, 'unknown');
  assert.deepEqual(B.defaultPins(r, 1), ['staraptormega']);
  // a saved set wins over the guess, on the row its item belongs to
  const saved = B.targetsOf(mech, ['staraptor'], { usage: USAGE, savedSet: () => ({ item: 'choicescarf', ability: 'intimidate', nature: 'jolly', moves: ['finalgambit'], sp: 'unknown' }) });
  assert.equal(saved[0].source, 'set');
  assert.equal(saved[1].source, 'ladder');
});

test('trade-offs: freed SP go to HP then the lower defence, within 32 per stat and 66 in total; seeds never touch the set', () => {
  const cur = rotom('modest', { hp: 2, spa: 32, spe: 32 });
  const before = JSON.stringify(cur);
  const f = B.freeIntoBulk(cur, 'spa', 16);
  assert.equal(f.freed, 16);
  assert.deepEqual(f.set.sp, { hp: 18, atk: 0, def: 0, spa: 16, spd: 0, spe: 32 });
  const all = B.freeIntoBulk({ ...cur, sp: { ...cur.sp, spe: 0 } }, 'spa', 8);
  assert.deepEqual(all.set.sp, { hp: 32, atk: 0, def: 26, spa: 8, spd: 0, spe: 0 });
  const seeds = B.seedOptions(mech, cur, { stat: 'spa', setupNeed: 16 });
  assert.deepEqual(seeds.map((s) => s.key), ['speed-to-bulk', 'damage-item', 'setup', 'nature']);
  const total = (sp) => Object.values(sp).reduce((a, b) => a + b, 0);
  for (const s of seeds) { assert.ok(total(s.set.sp) <= 66 && Object.values(s.set.sp).every((v) => v >= 0 && v <= 32), s.key); }
  const setup = seeds.find((s) => s.key === 'setup');
  assert.deepEqual(setup.set.moves, ['thunderbolt', 'nastyplot', 'voltswitch', 'protect'], 'Nasty Plot takes Air Slash\'s slot');
  assert.equal(setup.changes[0].dropped, 'airslash');
  assert.equal(seeds.find((s) => s.key === 'speed-to-bulk').set.sp.hp, 32);
  assert.equal(seeds.find((s) => s.key === 'nature').set.nature, 'timid');
  assert.equal(JSON.stringify(cur), before, 'the current set is unchanged');
});

test('setup moves and tools against setup come from the learnset and likely sets, labelled by evidence', () => {
  assert.deepEqual(B.setupMoveFor(mech, 'rotomfan', 'spa'), { move: 'nastyplot', stage: 2 });
  assert.equal(B.setupIn(rotom('modest', { spa: 32 }), 'spa'), null);
  const enc = { key: 'whimsicott', species: 'whimsicott', forme: 'whimsicott', mega: false, source: 'ladder', set: { ability: 'prankster', moves: ['encore', 'tailwind', 'moonblast', 'protect'] } };
  const tools = B.setupTools(mech, [enc]);
  assert.ok(tools.some((t) => t.id === 'encore' && t.evidence === 'ladder'));
  assert.ok(tools.every((t) => t.evidence === 'ladder' ? enc.set.moves.includes(t.id) : true));
  assert.deepEqual(B.afterTheirMoves(mech, { ability: 'intimidate', moves: ['closecombat'] }, 'staraptor', 'spd'), [], 'without Contrary, Close Combat lowers SpD');
});

// Build dashboard logic (lib/prep-build.mjs) and the two-use KO search (lib/calc/threshold.mjs koSearch {uses: 2}).
// The six reference vectors come from VGC Strategy's Rotom-Fan case (docs/research/strategy/sp-assist/rotom-fan-case.md §9),
// computed there by an independent calculator; here they must come out of the app's own engine and searches.
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { mech, newCalc, set, sc } from './calc-helpers.mjs';
import { koSearch, surviveSearch } from '../lib/calc/threshold.mjs';
import { statValue, speedOf, natureSign } from '../lib/calc/stats.mjs';
import { setStats } from '../lib/calc/mech.mjs';
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

// VGC Strategy goldens G1–G5 (docs/research/strategy/sp-assist/dashboard-goldens.md §1): Mega Charizard Y Modest 2/0/0/32/0/32
const ZARD = { ...set('charizard', 'blaze', 'modest', { hp: 2, spa: 32, spe: 32 }, ['heatwave', 'solarbeam', 'protect', 'weatherball'], 'charizarditey'), species: 'charizard' };
const sp6 = (s) => { const [hp, atk, def, spa, spd, spe] = s.split('/').map(Number); return { hp, atk, def, spa, spd, spe }; };
const row = (species, ability, nature, spread, item, moves = []) => ({ key: species, species, forme: species, mega: false, source: 'set', common: null, set: { ...set(species, ability, nature, sp6(spread), moves, item), species } });
const G = {
  grimmsnarl: row('grimmsnarl', 'prankster', 'careful', '32/0/19/0/15/0', 'lightclay', ['spiritbreak']),
  staraptormega: { ...row('staraptor', 'intimidate', 'jolly', '29/1/0/0/4/32', 'staraptite', ['closecombat']), key: 'staraptormega', forme: 'staraptormega', mega: true },
  tsareena: row('tsareena', 'queenlymajesty', 'jolly', '2/32/0/0/0/32', 'widelens', ['tropkick']),
  basculegionf: row('basculegionf', 'swiftswim', 'modest', '0/0/1/32/1/32', 'lifeorb', ['wavecrash']),
  volcarona: row('volcarona', 'flamebody', 'bold', '32/0/32/0/2/0', '', ['quiverdance']),
};
const rng = (r) => [r.range.min, r.range.max];

test('Mega Charizard Y uses the Mega (SpA 232, Spe 152) and Auto weather is its Drought sun: goldens G1–G5', () => {
  const calc = newCalc();
  assert.equal(B.myForme(mech, ZARD), 'charizardmegay');
  assert.equal(setStats(mech, ZARD, { megaEvolved: true }).spa, 232);
  assert.equal(B.mySpeed(mech, ZARD, 'charizardmegay'), 152);
  for (const t of Object.values(G)) assert.deepEqual([B.autoWeather(mech, ZARD, t).weather, B.autoWeather(mech, ZARD, t).by], ['Sun', 'mine'], t.key);
  const at = (t, move, auto = true) => B.hitResult(calc, mech, ZARD, t, move, { field: auto ? { weather: B.autoWeather(mech, ZARD, t).weather } : {} }).result;
  const g1 = at(G.grimmsnarl, 'heatwave');
  assert.deepEqual([rng(g1), g1.maxHP], [[115, 136], 202], 'G1 sun');
  assert.deepEqual(g1.hitRows[0], [115, 117, 118, 120, 120, 121, 123, 124, 126, 127, 129, 130, 132, 133, 135, 136]);
  assert.deepEqual(at(G.grimmsnarl, 'heatwave', false).hitRows[0], [76, 78, 79, 79, 81, 81, 82, 84, 84, 85, 85, 87, 88, 88, 90, 91], 'G1 no sun');
  assert.ok(g1.chips.some((c) => c.code === 'weather' && c.value === 'Sun') && g1.chips.some((c) => c.code === 'spread'), 'sun and ×0.75 are chips');
  assert.deepEqual(rng(at(G.staraptormega, 'heatwave')), [123, 145], 'G2 sun');
  assert.deepEqual(rng(at(G.staraptormega, 'heatwave', false)), [82, 97], 'G2 no sun');
  const g3 = at(G.tsareena, 'weatherball');
  assert.deepEqual(g3.hitRows[0], [336, 338, 342, 348, 350, 354, 360, 362, 366, 372, 374, 378, 384, 386, 390, 396], 'G3 sun: Fire 100 BP');
  assert.deepEqual([g3.ko.one.num, g3.ko.one.den], ['1', '1']);
  assert.deepEqual(rng(at(G.tsareena, 'weatherball', false)), [38, 45], 'G3 no sun: Normal 50 BP');
  const g4 = at(G.basculegionf, 'solarbeam');
  assert.deepEqual([rng(g4), g4.maxHP, g4.ko.one.num], [[218, 258], 195, '1'], 'G4: sun removes the charge turn, not a boost');
  assert.deepEqual(rng(at(G.basculegionf, 'solarbeam', false)), [218, 258]);
  const g5 = at(G.volcarona, 'heatwave');
  assert.deepEqual([rng(g5), g5.maxHP], [[109, 130], 192], 'G5 sun');
  assert.deepEqual(rng(at(G.volcarona, 'heatwave', false)), [73, 87], 'G5 no sun (the bug the dashboard showed)');
  // the Mega's 159 SpA, not base Charizard's 109; and no stone = no Drought
  assert.ok(calc.run(sc(ZARD, G.volcarona.set, 'heatwave', { a: { mega: false }, field: { weather: 'Sun' } })).range.max < g5.range.max);
  assert.equal(B.autoWeather(mech, { ...ZARD, item: 'lifeorb' }, G.volcarona).weather, '');
});

test('bulk score vs Calvin\'s pool (dashboard-goldens.md §2): 42 hits; matches the goldens except the engine\'s exact Triple Axel', () => {
  const D = new URL('../docs/research/strategy/sp-assist/', import.meta.url);
  const raw = JSON.parse(readFileSync(new URL('usage-regmc-2026-09-league.json', D), 'utf8')).species;
  const arr = (o) => Object.entries(o ?? {}).sort((a, b) => b[1] - a[1]); // the slimmed table's [name, %] shape (lib/usage.mjs)
  const usage = { species: Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, { usage: v.usage, abilities: arr(v.abilities), items: arr(v.items), moves: arr(v.moves), spreads: arr(v.spreads) }])) };
  const pool = JSON.parse(readFileSync(new URL('league-2026-10-15.json', D), 'utf8')).coaches.find((c) => c.name === 'Calvin').picks.map((p) => p.id);
  const calc = newCalc();
  const fan = (sp) => ({ ...set('rotomfan', 'levitate', 'modest', sp, ['thunderbolt']), species: 'rotomfan' });
  const cases = [[{ hp: 2, spa: 32, spe: 32 }, 2.5235, 3], [{ hp: 32, spa: 32, spd: 2 }, 1.5031, 2], [{ hp: 32, def: 14, spa: 16, spd: 4 }, 1.1266, 1]];
  for (const [sp, golden] of cases) {
    const b = B.bulkScore(calc, mech, fan(sp), pool, usage);
    assert.equal(b.hits.length, 42, '42 common hits');
    assert.deepEqual(b.skipped, ['tauros'], 'forms without usage data are skipped and reported');
    assert.equal(b.notCounted.length, 0);
    assert.ok(Math.abs(b.hits.find((h) => h.move === 'finalgambit').p - 1) < 1e-9, 'Final Gambit: 192 fixed damage, more than any Rotom-Fan HP');
    assert.ok(b.hits.some((h) => h.forme === 'mamoswine' && h.move === 'earthquake' && h.p === 0), 'a Levitate immunity is a hit with 0 odds');
    // The research calculator takes Triple Axel at its listed 20 BP per hit; the engine escalates it (20/40/60, Showdown
    // data/moves.ts basePowerCallback), so that one hit differs. Everything else equals the golden.
    const ta = b.hits.find((h) => h.forme === 'tsareena' && h.move === 'tripleaxel').p;
    assert.ok(Math.abs(b.score - ta - golden) < 5e-4, `${b.score} − Triple Axel ${ta} vs golden ${golden}`);
  }
  const o1 = B.bulkScore(calc, mech, fan(cases[0][0]), pool, usage), o2 = B.bulkScore(calc, mech, fan(cases[1][0]), pool, usage);
  assert.ok(o2.score < o1.score, 'Speed SP → HP is bulkier');
  assert.equal(o1.strong, 4);
  assert.ok(B.bulkScore(calc, mech, fan(cases[0][0]), pool, null).skipped.length >= 10, 'no usage table: every form skipped, score 0');
});

test('Auto weather from their setters: their Drizzle is used against a non-setter; a Mega setter overrides a switch-in one', () => {
  const peli = { key: 'pelipper', species: 'pelipper', forme: 'pelipper', mega: false, source: 'ladder', common: null, set: { species: 'pelipper', item: '', ability: 'drizzle', nature: '', moves: ['hurricane'], sp: 'unknown' } };
  const me = rotom('modest', { spa: 32, spe: 32 });
  const w = B.autoWeather(mech, me, peli);
  assert.deepEqual([w.weather, w.by, w.theirs.ability], ['Rain', 'theirs', 'drizzle']);
  const zard = { ...set('charizard', 'blaze', 'modest', { spa: 32, spe: 32 }, ['heatwave'], 'charizarditey'), species: 'charizard' };
  assert.equal(B.autoWeather(mech, zard, peli).weather, 'Sun', 'Drought on Mega Evolution comes after Drizzle on switch-in');
  // two switch-in setters: the slower one's weather stays; unknown order is flagged
  const tyra = { key: 'tyranitar', species: 'tyranitar', forme: 'tyranitar', mega: false, source: 'ladder', common: null, set: { species: 'tyranitar', item: '', ability: 'sandstream', nature: '', moves: [], sp: 'unknown' } };
  const pelMine = { ...set('pelipper', 'drizzle', 'modest', { spa: 32, spe: 32 }, ['hurricane']), species: 'pelipper' };
  const x = B.autoWeather(mech, pelMine, tyra);
  assert.ok(['Rain', 'Sand'].includes(x.weather));
  assert.equal(x.contested, x.by === 'mine' && B.speedVerdict(B.mySpeed(mech, pelMine, 'pelipper'), B.targetSpeed(mech, tyra)) !== 'slower');
});

test('two-use KO search equals brute force over full runs (ko.two), and never needs more than one use', () => {
  const calc = newCalc();
  for (const [me, target, move, opts] of [
    [rotom('modest', { spe: 32, hp: 2 }), rap(), 'thunderbolt', {}],
    [rotom('timid', { spe: 32, hp: 2 }), rap(), 'airslash', { d: { boosts: { spd: 1 } } }],
    [rotom('modest', { spe: 32, hp: 2 }), rap({ hp: 32, spd: 32, spe: 2 }, 'careful'), 'thunderbolt', { d: { boosts: { spd: 2 } } }],
    [rotom('modest', { spe: 32, hp: 2 }), rap({ hp: 32, spd: 32, spe: 2 }, 'careful'), 'thunderbolt', { a: { boosts: { spa: 1 } }, d: { boosts: { spd: 2 } } }],
    [rotom('timid', { spe: 32, hp: 2 }), rap(), 'voltswitch', { a: { boosts: { spa: 2 } }, d: { boosts: { spd: 1 } } }],
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

test('2HKO benchmark at +0 / +1 / +2 and their SpD +1 equals brute force over full runs (ko.two)', () => {
  const calc = newCalc();
  const me = rotom('modest', { spe: 32, hp: 2 });
  const tough = { ...megaRow(), set: { ...megaRow().set, nature: 'careful', sp: { hp: 32, atk: 0, def: 0, spa: 0, spd: 32, spe: 2 } } };
  for (const stage of [0, 1]) for (const boost of [0, 1, 2]) {
    const b = B.koBenchmark(calc, mech, me, tough, 'airslash', { boost, stage, uses: 2 });
    assert.equal(b.uses, 2);
    for (const l of b.levels) {
      const ok = { 'every-roll': (k) => k.num === k.den, 'fifteen-of-sixteen': (k) => frac(k) >= 15 / 16, half: (k) => frac(k) >= 0.5 }[l.key];
      let brute = null;
      for (let a = 0; a <= 32 && brute === null; a++) {
        const r = calc.run(sc({ ...me, sp: { ...me.sp, spa: a } }, { ...tough.set, species: 'staraptor' }, 'airslash', { a: { boosts: { spa: boost } }, d: { boosts: { spd: stage } } }));
        if (ok(r.ko.two)) brute = a;
      }
      assert.equal(l.keep?.a ?? null, brute, `2HKO +${boost} SpD +${stage} ${l.key}`);
    }
  }
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

// ---------- teambuilder slider marks (lib/prep-build.mjs speedMarks / koMarks / surviveMarks / markMet) ----------
test('marks: Speed marks equal a brute-force sweep; ties are their own mark only where they matter; Mega Staraptor 178 is out of reach', () => {
  const twin = { key: 'twin', forme: 'rotomfan', mega: false, set: rotom('hardy', { spe: 32 }) }; // exactly 138
  const slow = { key: 'slow', forme: 'mamoswine', mega: false, set: { ...set('mamoswine', 'oblivious', 'adamant', { spe: 0 }, ['iciclecrash']), species: 'mamoswine' } };
  const targets = [megaRow(), twin, slow];
  const slowSpe = B.targetSpeed(mech, slow).max;
  for (const nature of ['modest', 'timid']) for (const spe of [0, 20, 32]) {
    const me = rotom(nature, { spa: 32, spe });
    const s = B.speedMarks(mech, me, 'rotomfan', targets);
    const at = (sp) => statValue('spe', 86, sp, natureSign(mech.natures[nature], 'spe'));
    for (const speed of [178, 138, slowSpe]) {
      const brute = [...Array(33).keys()].find((sp) => at(sp) > speed) ?? null;
      const mk = s.marks.find((m) => m.kind === 'outspeed' && m.speed === speed);
      assert.equal(mk?.sp ?? null, brute, `${nature} outspeed ${speed}`);
      const tie = [...Array(33).keys()].find((sp) => at(sp) === speed) ?? null;
      const tm = s.marks.find((m) => m.kind === 'tie' && m.speed === speed);
      assert.equal(!!tm, tie !== null && (brute === null || spe === tie), `${nature} ${spe}: tie mark at ${speed} only where it matters`);
    }
    assert.ok(s.cant.some((c) => c.speed === 178), '178 is never reachable for Rotom-Fan');
    assert.equal(s.faster, [178, 138, slowSpe].filter((v) => at(spe) > v).length);
  }
  const m = B.speedMarks(mech, rotom('modest', { spa: 32, spe: 32 }), 'rotomfan', [twin]);
  assert.deepEqual(m.marks.map((x) => [x.kind, x.sp]), [['tie', 32]], 'Modest 32 = 138 ties; nothing beats it');
  assert.ok(B.markMet(m.marks[0], rotom('modest', { spa: 32, spe: 32 })) && !B.markMet(m.marks[0], rotom('modest', { spa: 32, spe: 31 })));
});

test('marks: KO marks are the koSearch levels for the set shape (Rotom-Fan goldens: Life Orb every roll at 23, +2 Nasty Plot at 0)', () => {
  const calc = newCalc();
  const row = megaRow();
  const plain = rotom('modest', { hp: 2, spa: 32, spe: 32 });
  const k = B.koMarks(calc, mech, plain, row, 'thunderbolt');
  const lo = k.marks.find((m) => m.need?.item === 'lifeorb');
  assert.deepEqual([lo.sp, lo.uses, lo.nature], [23, 1, 'modest'], 'reference 5: Life Orb +0 every roll at 23 (dashed: needs Life Orb)');
  assert.ok(!B.markMet(lo, plain) && B.markMet(lo, { ...plain, item: 'lifeorb' }) && !B.markMet(lo, { ...plain, item: 'lifeorb', sp: { ...plain.sp, spa: 22 } }));
  assert.ok(!k.marks.some((m) => m.uses === 1 && !m.need), 'no +0 OHKO without an item');
  assert.equal(k.cant.length, 1, 'said as a chip instead');
  const two = k.marks.find((m) => m.uses === 2 && !m.need);
  let brute = null;
  for (let a = 0; a <= 32 && brute === null; a++) { const r = calc.run(sc({ ...plain, sp: { ...B.ZERO_SP, spa: a } }, { ...rap(), species: 'staraptor' }, 'thunderbolt')); if (r.ko.two.num === r.ko.two.den) brute = a; }
  assert.equal(two.sp, brute, 'the 2HKO mark equals brute force over full runs');
  const np = B.koMarks(calc, mech, rotom('modest', { hp: 2, spa: 32, spe: 32 }, '', ['thunderbolt', 'nastyplot', 'voltswitch', 'protect']), row, 'thunderbolt');
  assert.deepEqual(np.marks.filter((m) => m.boost === 2).map((m) => [m.sp, m.need]), [[0, null]], 'reference 5: +2 every roll from 0 SpA');
  assert.deepEqual(B.koMarks(calc, mech, rotom('modest', { hp: 32, spa: 2, def: 32 }), row, 'thunderbolt').marks, k.marks, 'marks depend on the shape, not on the Stat Points');
});

test('marks: survive marks equal brute force — the frontier calls a split safe exactly when it survives every roll', () => {
  const calc = newCalc();
  const mam = { key: 'mam', species: 'mamoswine', forme: 'mamoswine', mega: false, source: 'set', common: null,
    set: { ...set('mamoswine', 'oblivious', 'adamant', { hp: 2, atk: 8, spe: 32 }, ['iciclecrash']), species: 'mamoswine' } };
  const me = rotom('modest', { spa: 32 });
  const s = B.surviveMarks(calc, mech, me, mam, 'iciclecrash');
  const mk = s.marks.find((m) => m.stat === 'hp');
  assert.ok(mk, 'a pair exists (with your nature, or dashed with the one that needs it)');
  const seen = new Set();
  for (let h = 0; h <= 32; h += 2) for (let d = 0; d <= 32; d += 2) {
    if (h + d + 32 > 66) continue;
    const at = { ...me, nature: mk.nature, sp: { ...B.ZERO_SP, spa: 32, hp: h, def: d } };
    const r = calc.run(sc(mam.set, at, 'iciclecrash'));
    assert.equal(B.markMet(mk, at), r.ko.one.num === '0', `HP ${h} / Def ${d}`);
    seen.add(r.ko.one.num === '0');
  }
  assert.equal(seen.size, 2, 'the sweep crosses the line');
  const fg = { key: 'fg', species: 'staraptor', forme: 'staraptor', mega: false, source: 'set', common: null, set: { ...set('staraptor', 'intimidate', 'jolly', { hp: 32, atk: 2, spe: 32 }, ['finalgambit'], 'choicescarf'), species: 'staraptor' } };
  const g = B.surviveMarks(calc, mech, me, fg, 'finalgambit');
  assert.deepEqual([g.marks.length, g.cant.length], [0, 1], 'Final Gambit: no spread survives, a chip and no mark');
});

test('marks: Mega Charizard Y in its own sun (G5 Volcarona): KO marks follow the Auto weather', () => {
  const calc = newCalc();
  const sun = B.koMarks(calc, mech, ZARD, G.volcarona, 'heatwave', { field: { weather: 'Sun' } });
  const none = B.koMarks(calc, mech, ZARD, G.volcarona, 'heatwave');
  let brute = null;
  for (let a = 0; a <= 32 && brute === null; a++) { const r = calc.run(sc({ ...ZARD, sp: { ...B.ZERO_SP, spa: a } }, G.volcarona.set, 'heatwave', { field: { weather: 'Sun' } })); if (r.ko.two.num === r.ko.two.den) brute = a; }
  assert.equal(sun.marks.find((m) => m.uses === 2 && !m.need)?.sp ?? null, brute, 'the 2HKO mark in sun equals brute force');
  assert.notDeepEqual(sun.marks, none.marks, 'sun changes the marks');
});

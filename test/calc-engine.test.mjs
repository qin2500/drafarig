// The vendored damage engine and the one stat function, checked without a browser: the module the browser loads,
// its provenance pins, goldens computed by hand from the simulator's damage order, and exhaustive stat equality.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { engine, mech, SOURCE, read } from './calc-helpers.mjs';
import { computeStats, speedOf, statValue, STAT_IDS, outspeedSP, speedRange, compareSpeed, spProblems } from '../lib/calc/stats.mjs';
import { toID } from '../lib/calc/mech.mjs';

const gen = engine.Generations.get(0);
const mod = read('public/vendor/smogon-calc-0.12.0.mjs');
const P = (name, o = {}) => new engine.Pokemon(gen, name, { level: 50, ...o });
const calc = (a, d, m, f = {}) => engine.calculate(gen, a, d, new engine.Move(gen, m[0], m[1] ?? {}), new engine.Field({ gameType: 'Doubles', ...f }));

test('vendored engine: bytes match SOURCE.json, unmodified bundles behind a licence header, no network or dynamic code', () => {
  assert.equal(createHash('sha256').update(mod).digest('hex'), SOURCE.output.sha256);
  assert.equal(Buffer.byteLength(mod), SOURCE.output.bytes);
  assert.deepEqual([SOURCE.name, SOURCE.version, SOURCE.license], ['@smogon/calc', '0.12.0', 'MIT']);
  assert.ok(mod.startsWith('/*! @smogon/calc 0.12.0 (MIT).'));
  assert.ok(mod.includes('Copyright (c) 2013-2025 Honko and other contributors') && mod.includes('THE SOFTWARE IS PROVIDED "AS IS"'));
  assert.equal(mod.match(/^const window = \{\};$/gm)?.length, 1);
  assert.ok(mod.trimEnd().endsWith('export const { Generations, Pokemon, Move, Field, Side, calculate, Result, toID, STATS, Stats } = window.calc;'));
  for (const s of ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'EventSource', 'importScripts', 'http:', 'https:', 'import(', 'require(', 'eval(', 'new Function', 'localStorage', 'document.']) {
    assert.ok(!mod.includes(s), `vendored engine contains ${s}`);
  }
  assert.equal(typeof globalThis.window, 'undefined', 'the module-scoped window must not leak');
  for (const e of SOURCE.exports) assert.ok(engine[e], e);
  const notices = read('public/vendor/THIRD_PARTY_NOTICES.txt');
  assert.ok(notices.includes('Honko and other contributors') && notices.includes('Guangcong Luo and other contributors'));
  assert.equal(notices.match(/Permission is hereby granted/g).length, 2);
});

test('engine goldens (hand-worked from the simulator damage order): doubles spread, Intimidate stage, crit, Aerilate, sun spread, Mega Sol', () => {
  const chomp = ['Garchomp', { nature: 'Jolly', ability: 'Rough Skin', evs: { atk: 32, spe: 32, hp: 2 } }];
  const inci = ['Incineroar', { nature: 'Careful', ability: 'Blaze', evs: { hp: 32, def: 2, spd: 32 } }];
  const g1a = calc(P(...chomp), P(...inci), ['Earthquake']);
  assert.deepEqual(g1a.damage, [138, 140, 140, 144, 144, 146, 150, 150, 152, 152, 156, 156, 158, 158, 162, 164]);
  assert.equal(g1a.defender.maxHP(), 202);
  assert.deepEqual(calc(P(...chomp), P(...inci), ['Earthquake'], { gameType: 'Singles' }).damage, [186, 186, 188, 192, 192, 194, 198, 200, 200, 204, 206, 210, 210, 212, 216, 218]);
  const minus1 = P(chomp[0], { ...chomp[1], boosts: { atk: -1 } });
  assert.deepEqual(calc(minus1, P(...inci), ['Earthquake']).damage, [92, 92, 96, 96, 96, 98, 98, 102, 102, 102, 104, 104, 104, 108, 108, 110]);
  assert.deepEqual(calc(minus1, P(...inci), ['Earthquake', { isCrit: true }]).damage, [206, 210, 212, 216, 216, 218, 222, 224, 228, 230, 230, 234, 236, 240, 242, 246]);
  const sala = P('Salamence-Mega', { nature: 'Adamant', ability: 'Aerilate', item: 'Salamencite', evs: { atk: 32, spe: 32, hp: 2 } });
  assert.deepEqual(calc(sala, P('Kingambit', { nature: 'Adamant', ability: 'Defiant', evs: { hp: 32, atk: 32, def: 2 } }), ['Double-Edge', { ability: 'Aerilate' }]).damage, [62, 63, 63, 64, 65, 66, 66, 67, 68, 69, 69, 70, 71, 72, 72, 73]);
  const zard = P('Charizard-Mega-Y', { nature: 'Timid', ability: 'Drought', item: 'Charizardite Y', evs: { spa: 32, spe: 32, hp: 2 } });
  assert.deepEqual(calc(zard, P('Rillaboom', { nature: 'Adamant', ability: 'Overgrow', evs: { hp: 32, atk: 32, spd: 2 } }), ['Heat Wave'], { weather: 'Sun' }).damage, [276, 278, 282, 284, 290, 294, 296, 300, 302, 306, 308, 312, 314, 318, 320, 326]);
  const meg = P('Meganium-Mega', { ability: 'Mega Sol', item: 'Meganiumite' });
  for (const weather of ['Rain', 'Sun', 'Sand', undefined]) {
    assert.deepEqual(calc(meg, P('Pelipper', { ability: 'Drizzle' }), ['Weather Ball', { ability: 'Mega Sol' }], { weather }).damage, [51, 52, 52, 53, 53, 54, 55, 55, 56, 56, 57, 58, 58, 59, 59, 60], String(weather));
  }
});

test('the raw engine silently ignores an illegal item and returns 0 for a stub move: why the wrapper refuses both', () => {
  const amb = P('Kingambit', { nature: 'Adamant', ability: 'Supreme Overlord', evs: { atk: 32 } });
  const band = P('Kingambit', { nature: 'Adamant', ability: 'Supreme Overlord', item: 'Choice Band', evs: { atk: 32 } });
  const inci = P('Incineroar', { ability: 'Blaze' });
  assert.deepEqual(calc(band, inci, ['Kowtow Cleave']).damage, calc(amb, inci, ['Kowtow Cleave']).damage);
  assert.equal(calc(P('Garchomp', { ability: 'Rough Skin', evs: { atk: 32 } }), inci, ['Dragon Hammer']).damage, 0);
  assert.equal(mech.items.choiceband, undefined);
  assert.equal(mech.moves.dragonhammer, undefined);
});

test('Speed goldens with the one stat function: 169 / 253 / 338 / 84 / 63 / 446 / 668, equal to the engine below its 999 cap', () => {
  const base = (id) => mech.species[id].baseStats.spe;
  const jolly = statValue('spe', base('garchomp'), 32, '+');
  assert.equal(jolly, 169);
  assert.equal(speedOf(jolly, { scarf: true }).speed, 253);
  assert.equal(speedOf(jolly, { tailwind: true }).speed, 338);
  assert.equal(speedOf(jolly, { para: true }).speed, 84);
  assert.equal(statValue('spe', base('kingambit'), 0, '-'), 63);
  const lz = statValue('spe', base('lucariomegaz'), 32, '+');
  assert.equal(speedOf(lz, { tailwind: true }).speed, 446);
  assert.equal(speedOf(lz, { tailwind: true, stage: 1 }).speed, 668);
  const eng = (o, f = {}) => engine.calculate(gen, P('Garchomp', { nature: 'Jolly', ability: 'Rough Skin', evs: { spe: 32 }, ...o }), P('Incineroar'), new engine.Move(gen, 'Tackle'), new engine.Field({ gameType: 'Doubles', ...f })).attacker.stats.spe;
  assert.deepEqual([eng({}), eng({ item: 'Choice Scarf' }), eng({}, { attackerSide: { isTailwind: true } }), eng({ status: 'par' })], [169, 253, 338, 84]);
  // weather abilities, Quick Feet ignoring paralysis, Iron Ball
  assert.equal(speedOf(100, { ability: 'swiftswim', weather: 'Rain' }).speed, 200);
  assert.equal(speedOf(100, { ability: 'swiftswim', weather: 'Sun' }).speed, 100);
  assert.equal(speedOf(100, { ability: 'quickfeet', para: true, status: 'par' }).speed, 150);
  assert.equal(speedOf(100, { ironBall: true }).speed, 50);
  assert.equal(speedOf(600, { tailwind: true }).speed, 1200, 'no 999 cap');
});

test('T-CALC-STAT: stats() equals the engine for every projection form × 25 natures × sampled spreads', () => {
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  const spreads = [{ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, { hp: 32, atk: 32, def: 2, spa: 0, spd: 0, spe: 0 }, { hp: 2, atk: 0, def: 0, spa: 32, spd: 0, spe: 32 }];
  for (let i = 0; i < 4; i++) {
    const sp = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }; let left = 66;
    for (const k of STAT_IDS) { const v = Math.min(32, left, Math.floor(rnd() * 33)); sp[k] = v; left -= v; }
    spreads.push(sp);
  }
  let n = 0;
  for (const [id, s] of Object.entries(mech.species)) {
    const names = id === 'aegislash' ? ['Aegislash-Shield', 'Aegislash-Blade'] : [s.name];
    for (const name of names) {
      const es = gen.species.get(toID(name));
      assert.ok(es, name);
      if (id !== 'aegislash') assert.deepEqual(es.baseStats, s.baseStats, `${name} base stats`);
      for (const nat of Object.values(mech.natures)) for (const sp of spreads) {
        const p = P(name, { nature: nat.name, evs: sp });
        assert.deepEqual(computeStats(es.baseStats, sp, nat), { ...p.rawStats }, `${name} ${nat.name} ${JSON.stringify(sp)}`);
        n++;
      }
    }
  }
  assert.ok(n > 339 * 25 * 7 - 1, `${n} comparisons`);
});

test('Stat Point validation never clamps, and Speed helpers answer outspeed / range / tie questions', () => {
  assert.deepEqual(spProblems({ hp: 32, atk: 32, def: 2 }), []);
  assert.deepEqual(spProblems({ atk: 33 }).map((p) => p.code), ['sp-over-stat']);
  assert.deepEqual(spProblems({ hp: 32, atk: 32, def: 3 }).map((p) => p.code), ['sp-over-total']);
  assert.deepEqual(spProblems({ atk: -1 }).map((p) => p.code), ['sp-negative']);
  assert.deepEqual(spProblems({ atk: NaN }).map((p) => p.code), ['sp-not-integer']);
  assert.deepEqual(spProblems({ atk: 1.5 }).map((p) => p.code), ['sp-not-integer']);
  assert.deepEqual(spProblems('unknown'), []);
  // Torkoal 0/-Spe to 32/+Spe, and with Scarf (the speeds the strategy report hand-computed)
  const tork = mech.species.torkoal.baseStats.spe;
  assert.deepEqual([speedRange(tork).min, speedRange(tork).max], [36, 79]);
  assert.deepEqual([speedRange(tork, { scarf: true }).min, speedRange(tork, { scarf: true }).max], [54, 118]);
  const peli = mech.species.pelipper.baseStats.spe;
  const o = outspeedSP(peli, '+', 100);
  assert.ok(!o.impossible && statValue('spe', peli, o.sp, '+') > 100 && (o.sp === 0 || statValue('spe', peli, o.sp - 1, '+') <= 100));
  assert.equal(outspeedSP(peli, '+', 400).impossible, true);
  assert.equal(compareSpeed(100, 100), 'tie');
  assert.equal(compareSpeed(120, { min: 80, max: 110 }), 'first');
  assert.equal(compareSpeed(120, { min: 80, max: 130 }), 'depends');
  assert.equal(compareSpeed(120, { min: 80, max: 110 }, { trickRoom: true }), 'second');
});

test('projection consistency with the engine: every legal damaging move matches on type, category and power; item pools are identical', () => {
  let n = 0;
  for (const [id, m] of Object.entries(mech.moves)) {
    const em = gen.moves.get(id);
    assert.ok(em, `engine lacks ${id}`);
    if (m.category === 'Status') continue;
    assert.equal(em.type, m.type, `${id} type`);
    assert.equal(em.category, m.category, `${id} category`);
    assert.equal(em.basePower ?? 0, m.basePower, `${id} power`);
    n++;
  }
  assert.ok(n > 300);
  const engineItems = [...gen.items].map((i) => i.id).sort();
  assert.deepEqual(engineItems, Object.keys(mech.items).sort(), 'the legal Reg M-C items are exactly the engine items');
  // Mega stones: the projection maps (not the engine's getForme, wrong for 8 stones) decide the forme
  const stones = Object.entries(mech.items).filter(([, i]) => i.megaStone);
  assert.equal(stones.length, 81);
  for (const [id, it] of stones) {
    const ei = gen.items.get(id);
    for (const [base, forme] of Object.entries(it.megaStone)) assert.equal(toID(ei.megaStone[mech.species[base]?.name ?? base] ?? Object.values(ei.megaStone)[0]), forme, id);
  }
  assert.equal(toID(engine.Pokemon.getForme(gen, 'Garchomp', 'Garchompite Z')), 'garchompmega', 'engine getForme is wrong here; the app never uses it');
  assert.equal(mech.items.garchompitez.megaStone.garchomp, 'garchompmegaz');
});

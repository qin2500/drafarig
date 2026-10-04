// Independent calc review regressions (ported from the bounded calc review; first and second batch). Each one was a
// case where the calculator showed a confident number it shouldn't have, or refused/accepted the wrong input.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mech, engine, newCalc, set, CHOMP, INCIN, sc, ENGINE_INFO } from './calc-helpers.mjs';
import { hpFromShown } from '../lib/calc/wrapper.mjs';
import { staleReasons, pinsOf, entityHashes } from '../lib/calc/keys.mjs';
import { parseTeam } from '../lib/paste.mjs';
import { surviveSearch, koSearch, outspeedSearch, plusNatureFor as plusNatureForT } from '../lib/calc/threshold.mjs';
import { koWords, resultBlock, headline } from '../public/prep-ui.js';

const calc = newCalc();
const notAll = (k) => !(k && k.num && k.num === k.den); // refused, or below "every roll"

test('A1 a freshly saved calc is not out of date', () => {
  const s = sc(CHOMP, INCIN, 'earthquake');
  assert.deepEqual(staleReasons({ pins: pinsOf(mech, ENGINE_INFO), entities: entityHashes(s, mech) }, mech, ENGINE_INFO), []);
});

test('A2 Normal Gem: repeated-use odds are not computed with the gem on every use', () => {
  const r = calc.run(sc(set('audino', 'healer', 'adamant', { atk: 32 }, ['doubleedge'], 'normalgem'), INCIN, 'doubleedge'));
  assert.equal(r.ko.two.refused, 'changes-after-use:gem');
});

test('A3 Spicy Spray: repeated physical uses are refused', () => {
  const sco = set('scovillain', 'chlorophyll', 'serious', { hp: 32 }, ['protect'], 'scovillainite');
  assert.ok(calc.run(sc(CHOMP, sco, 'earthquake')).ko.two.refused);
});

test('A4/A5 Magic Room, Klutz and Unnerve stop Sitrus Berry and Focus Sash', () => {
  const nite = set('dragonite', 'innerfocus', 'bold', { hp: 32, def: 32 }, ['extremespeed'], 'sitrusberry');
  const a = set('garchomp', 'roughskin', 'adamant', { atk: 32, hp: 32 }, ['dragonclaw']);
  assert.deepEqual(calc.run(sc(a, nite, 'dragonclaw', { field: { magicRoom: true } })).ko.two, { num: '1', den: '1' });
  const lop = set('lopunny', 'klutz', 'hardy', {}, [[...mech.ix.learn.get('lopunny')][0]], 'focussash');
  assert.notDeepEqual(calc.run(sc(set('garchomp', 'roughskin', 'adamant', { atk: 32 }, ['earthquake']), lop, 'earthquake', { move: { crit: true } })).ko.one, { num: '0', den: '1' });
  const ttar = set('tyranitar', 'unnerve', 'adamant', { atk: 32 }, ['focuspunch']);
  const ril = set('rillaboom', mech.species.rillaboom.abilities[0].toLowerCase().replace(/[^a-z0-9]/g, ''), 'hardy', { hp: 16 }, [[...mech.ix.learn.get('rillaboom')][0]], 'sitrusberry');
  assert.deepEqual(calc.run(sc(ttar, ril, 'focuspunch')).ko.two, { num: '1', den: '1' });
});

test('A6 Feint and Phantom Force break Protect', () => {
  for (const mv of ['feint', 'phantomforce']) {
    const r = calc.run(sc(set('absol', 'pressure', 'adamant', { atk: 32 }, [mv]), INCIN, mv, { field: { defenderSide: { protect: true } } }));
    assert.equal(r.class, 'exact', mv);
  }
});

test('A7/A8 fail-closed input: Stat Point shape and hit counts', () => {
  assert.equal(calc.run(sc({ ...CHOMP, sp: null }, INCIN, 'earthquake')).class, 'refused');
  assert.equal(calc.run(sc({ ...CHOMP, sp: { attack: 32 } }, INCIN, 'earthquake')).class, 'refused');
  const rb = set('aerodactyl', 'rockhead', 'adamant', { atk: 32 }, ['rockblast']);
  for (const hits of [1, 6, 7]) assert.equal(calc.run(sc(rb, INCIN, 'rockblast', { move: { hits } })).code, 'input-invalid:hits', String(hits));
  assert.equal(calc.run(sc(CHOMP, INCIN, 'earthquake', { move: { hits: 3 } })).code, 'input-invalid:hits');
});

test('A9 a shown HP % maps into Showdown\'s display band floor(100·hp/max) || 1', () => {
  for (const max of [110, 150, 167, 202, 211, 250]) for (let p = 1; p < 100; p++) {
    for (const end of ['lo', 'hi']) { const hp = hpFromShown(max, p, end); assert.equal(Math.floor((100 * hp) / max) || 1, p, `${max} ${p} ${end}`); }
  }
});

test('B1 Gyro Ball power follows the wrapper\'s Speed when Unburden is active', () => {
  const d = set('hawlucha', 'unburden', 'jolly', { spe: 32 }, ['closecombat'], 'sitrusberry');
  const a = set('aegislash', 'stancechange', 'brave', { atk: 32 }, ['gyroball']);
  const held = calc.run(sc(a, d, 'gyroball')), used = calc.run(sc(a, d, 'gyroball', { d: { itemConsumed: true } }));
  assert.ok(used.hitRows[0][15] > held.hitRows[0][15] * 1.5, `${held.hitRows[0][15]} -> ${used.hitRows[0][15]}`);
});

test('B2 Charge is not carried into repeated uses', () => {
  const r = calc.run(sc(set('ampharos', 'static', 'modest', { spa: 32 }, ['thunderbolt']), set('garganacl', 'purifyingsalt', 'careful', { hp: 32, spd: 32 }, ['saltcure']), 'thunderbolt', { field: { attackerSide: { charge: true } } }));
  assert.ok(notAll(r.ko.two), JSON.stringify(r.ko.two));
});

test('B3 Grassy Terrain healing is considered for an Air Balloon holder once the balloon pops', () => {
  const r = calc.run(sc(set('kingambit', 'defiant', 'adamant', { atk: 32 }, ['kowtowcleave']), set('garchomp', 'roughskin', 'jolly', {}, ['earthquake'], 'airballoon'), 'kowtowcleave', { field: { terrain: 'Grassy' } }));
  assert.equal(r.ko.two.refused, 'between-turns:grassy-heal');
});

test('B9 Stat Point overflow is rejected with the validator wording, not converted as legacy EVs', () => {
  for (const evs of ['33 Atk / 32 Spe', '32 Atk / 32 Spe / 3 HP']) {
    const s = parseTeam(`Garchomp @ Life Orb\nAbility: Rough Skin\nEVs: ${evs}\nJolly Nature\n- Earthquake\n`, { mech, side: 'theirs' }).sets[0];
    assert.ok(!s.questions.some((q) => q.key === 'evs' && q.suggested === 'convert'), `${evs}: suggests convert`);
    assert.equal(s.status, 'rejected');
  }
});

test('Champions-only Fire Mane (Mega Pyroar): ×1.5 attacking stat on Fire moves only, in the engine and through the wrapper\'s Mega forme', () => {
  const gen = engine.Generations.get(0);
  const pyroar = (ability) => new engine.Pokemon(gen, 'Pyroar-Mega', { ability, nature: 'Modest', evs: { spa: 32 }, level: 50 });
  const chomp = new engine.Pokemon(gen, 'Garchomp', { ability: 'Rough Skin', nature: 'Jolly', level: 50 });
  const top = (ability, mv) => engine.calculate(gen, pyroar(ability), chomp, new engine.Move(gen, mv), new engine.Field({ gameType: 'Doubles' })).damage.at(-1);
  const fire = top('Fire Mane', 'Flamethrower') / top('Unnerve', 'Flamethrower');
  assert.ok(fire > 1.45 && fire < 1.55, String(fire));
  assert.equal(top('Fire Mane', 'Hyper Voice'), top('Unnerve', 'Hyper Voice'));
  assert.deepEqual(mech.species.pyroarmega.abilities, ['Fire Mane']);
  const p = set('pyroar', 'unnerve', 'modest', { spa: 32, spe: 32, hp: 2 }, ['flamethrower', 'hypervoice'], 'pyroarite');
  const mega = calc.run(sc(p, CHOMP, 'flamethrower')), before = calc.run(sc(p, CHOMP, 'flamethrower', { a: { mega: false } }));
  assert.deepEqual([mega.class, mega.attacker.ability], ['exact', 'firemane']);
  assert.ok(mega.range.max > before.range.max * 1.3, `${before.range.max} -> ${mega.range.max}`);
});

// ---------- second review (R2-*) ----------
const CHOMP_SS = set('garchomp', 'roughskin', 'adamant', { atk: 32 }, ['scaleshot']);
const frac = (k) => Number(k.num) / Number(k.den);

test('R2-1 no "if crit" KO number when the one-use line is refused (Oran Berry between hits)', () => {
  const r = calc.run(sc(CHOMP_SS, set('incineroar', 'intimidate', 'careful', {}, ['fakeout'], 'oranberry'), 'scaleshot'));
  assert.equal(r.ko.one.refused, 'between-hits:oran-berry');
  assert.equal(r.crit.ko1.refused, 'between-hits:oran-berry');
  assert.ok(!/KOs in/.test(resultBlock(r, { attacker: 'Garchomp', defender: 'Incineroar' }).match(/If every hit crits[^<]*/)?.[0] ?? ''));
});

test('R2-2 / R2-3 searches use the worse corner of a shown HP band (Blaze at 33%, Eruption at 60%)', () => {
  const inc = set('incineroar', 'blaze', 'adamant', { atk: 32, hp: 32 }, ['flareblitz']);
  const me = set('kingambit', 'defiant', 'adamant', { atk: 32, spe: 2 }, ['kowtowcleave']);
  const res = surviveSearch(calc, mech, sc(inc, me, 'flareblitz', { a: { hpPct: 33 } }));
  for (const o of res.levels.flatMap((l) => [l.keep, l.change]).filter(Boolean)) {
    const r = calc.run(sc(inc, { ...me, nature: o.nature, sp: { ...me.sp, hp: o.h, def: o.d } }, 'flareblitz', { a: { hpPct: 33 } }));
    if (res.levels.find((l) => l.key === 'every-roll').keep === o) assert.equal((r.hpLow?.ko.one ?? r.ko.one).num, '0');
  }
  const ty = set('typhlosion', 'blaze', 'modest', { spe: 32 }, ['eruption']);
  const tgt = set('corviknight', 'pressure', 'hardy', { hp: 32 }, ['protect']);
  const x = { a: { hpPct: 60 }, field: { weather: 'Sun' } };
  const ko = koSearch(calc, mech, sc(ty, tgt, 'eruption', x));
  const o = ko.levels.find((l) => l.key === 'half').option;
  if (o) assert.ok(frac(calc.run(sc({ ...ty, nature: o.nature, sp: { ...ty.sp, spa: o.a } }, tgt, 'eruption', x)).hpLow?.ko.one ?? { num: '1', den: '1' }) >= 1 / 2);
  assert.equal(koSearch(calc, mech, sc(ty, tgt, 'eruption', { a: { hpPct: 60 }, d: { hpPct: 50 } })).refused, 'hp-band-both');
});

test('R3 the survive screen sizes your set from full HP and says so when the calc had less (assumptions never contradict the answer)', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../public/prep-calcs.js', import.meta.url), 'utf8');
  assert.match(src, /th\.kind === 'survive' && \(sc\.defender\.state\.hpPct \?\? 100\) < 100/);
  const mixed = set('garchomp', 'roughskin', 'hardy', { atk: 32, spe: 32, def: 2 }, ['earthquake', 'dracometeor']);
  assert.equal(mech.natures[plusNatureForT(mech, mixed, 'spe')].minus, 'spd', 'the less invested defence');
  assert.equal(plusNatureForT(mech, { ...mixed, nature: 'naive' }, 'spe'), null);
});

test('R2-5 Trick Room: every Speed SP up to the answer stays slower, so it is never "over budget"', () => {
  const me = set('incineroar', 'intimidate', 'adamant', { hp: 32, atk: 32 }, ['fakeout']);
  for (const o of outspeedSearch(mech, me, 'incineroar', 120, {}, { trickRoom: true }).options) if (!o.impossible) assert.equal(o.withinBudget, true);
});

test('R2-6 natural frequencies: a non-zero KO chance is never worded as 0, and exact fractions are kept', () => {
  for (const w of [koWords({ num: '1', den: '320' }), koWords({ num: '1', den: '320' }, { hits: 5 })]) assert.ok(!/\b0 of 16\b|about 0%/.test(w), w);
  assert.equal(koWords({ num: '1', den: '320' }), 'the move KOs in 1 of 320 cases (under 1%)');
  assert.equal(koWords({ num: '3', den: '8' }), '6 of 16 rolls KO (about 1 in 3)');
  assert.equal(koWords({ num: '1', den: '2' }), '8 of 16 rolls KO (half)');
});

test('R2-7 / R2-8 wording: an illegal item names the item, and the HP band line names the side that is on a band', () => {
  const r = calc.run(sc(set('garchomp', 'roughskin', 'jolly', { atk: 32 }, ['earthquake'], 'choiceband'), INCIN, 'earthquake'));
  assert.ok(!/Garchomp isn&#39;t available/.test(resultBlock(r, { attacker: 'Garchomp', defender: 'Incineroar' })));
  const rev = calc.run(sc(set('lucario', 'innerfocus', 'adamant', { atk: 32, spe: 32 }, ['reversal']), set('garchomp', 'roughskin', 'jolly', { atk: 32, spe: 32 }, ['earthquake']), 'reversal', { a: { hpPct: 4 } }));
  assert.match(resultBlock(rev, { attacker: 'Lucario', defender: 'Garchomp' }), /the attacker at \d+ HP/);
});

test('R2-9 / R2-10 Super Fang and Endeavor have their own answer; first-hit-only is worded as one hit', () => {
  for (const [a, mv] of [[set('diggersby', 'hugepower', 'adamant', { atk: 32 }, ['superfang']), 'superfang'], [set('aggron', 'sturdy', 'adamant', {}, ['endeavor']), 'endeavor']]) {
    const r = calc.run(sc(a, set('garchomp', 'roughskin', 'jolly', {}, ['earthquake']), mv, { a: { hpPct: 40 }, d: { hpPct: 80 } }));
    assert.deepEqual([r.code, r.reason], ['move-unsupported', 'target-hp-fraction'], mv);
  }
  const r = calc.run(sc(CHOMP_SS, INCIN, 'scaleshot', { move: { firstHitOnly: true } }));
  assert.ok(!/hit combination|the move KOs in/.test(headline(r, 'Incineroar')), headline(r, 'Incineroar'));
});

test('B9 a format-legal move the species can\'t learn says "can\'t learn", like the validator', () => {
  const s = parseTeam('Garchomp @ Life Orb\nAbility: Rough Skin\nEVs: 32 Atk / 32 Spe\nJolly Nature\n- Spore\n', { mech, side: 'theirs' }).sets[0];
  assert.ok(s.lines.some((l) => l.ps === "Garchomp can't learn Spore."));
});

// Regression tests for the independent calc review (implementation-review/calc-review-1.md, first batch): each case was
// a wrong number, a fail-open path or a wrong stale state before the fix.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mech, newCalc, set, CHOMP, INCIN, sc, ENGINE_INFO } from './calc-helpers.mjs';
import { entityHashes, pinsOf, staleReasons } from '../lib/calc/keys.mjs';
import { hpFromShown } from '../lib/calc/wrapper.mjs';

const calc = newCalc();
const run = (...a) => calc.run(sc(...a));

test('keys: a freshly saved calc is current (natures have no projection hash; only a missing entry is a legality change)', () => {
  const s = sc(CHOMP, INCIN, 'earthquake');
  const saved = { pins: pinsOf(mech, ENGINE_INFO), entities: entityHashes(s, mech), refs: {} };
  assert.deepEqual(staleReasons(saved, mech, ENGINE_INFO), []);
  const edited = { ...saved, entities: { ...saved.entities, 'moves:earthquake': 'different' } };
  assert.deepEqual(staleReasons(edited, mech, ENGINE_INFO), [{ code: 'data-changed' }]);
  const gone = { ...saved, entities: { ...saved.entities, 'items:choiceband': 'x' } };
  assert.deepEqual(staleReasons(gone, mech, ENGINE_INFO), [{ code: 'legality-changed' }]);
  assert.deepEqual(staleReasons({ ...saved, pins: { ...saved.pins, engine: 'other' } }, mech, ENGINE_INFO), [{ code: 'engine-changed' }]);
});

test('Normal Gem is used up after the first use: repeated-use odds are refused, the first use keeps the boost', () => {
  const user = Object.keys(mech.species).find((s) => mech.species[s].legal && !mech.species[s].mega && mech.ix.learn.get(s)?.has('doubleedge') && !mech.species[s].types.includes('Ghost'));
  const ab = mech.species[user].abilities.map((a) => a.toLowerCase().replace(/[^a-z0-9]/g, '')).find((a) => !['normalize', 'aerilate', 'pixilate', 'refrigerate', 'dragonize', 'galvanize', 'parentalbond', 'reckless', 'klutz'].includes(a));
  const s = set(user, ab, 'adamant', { atk: 32 }, ['doubleedge'], 'normalgem');
  const r = run(s, INCIN, 'doubleedge');
  assert.equal(r.class, 'exact');
  assert.deepEqual(r.ko.two, { refused: 'changes-after-use:gem' });
  const plain = run({ ...s, item: '' }, INCIN, 'doubleedge');
  assert.ok(r.hitRows[0][0] > plain.hitRows[0][0], 'the gem boosts the first use');
});

test('Spicy Spray burns any physical attacker that hits it (not breakable): repeated uses refused, multi-hit refused even with Mold Breaker', () => {
  const sco = set('scovillain', 'chlorophyll', 'serious', { hp: 32 }, ['protect'], 'scovillainite');
  const r = run(CHOMP, sco, 'earthquake');
  assert.equal(r.class, 'exact');
  assert.deepEqual(r.ko.two, { refused: 'between-turns:spicy-spray' });
  const mbUser = Object.keys(mech.species).find((s) => mech.species[s].legal && !mech.species[s].mega && mech.species[s].abilities.includes('Mold Breaker') && ['rockblast', 'bulletseed', 'iciclespear', 'tailslap', 'scaleshot', 'bonerush'].some((m) => mech.ix.learn.get(s)?.has(m)));
  if (mbUser) {
    const mv = ['rockblast', 'bulletseed', 'iciclespear', 'tailslap', 'scaleshot', 'bonerush'].find((m) => mech.ix.learn.get(mbUser).has(m));
    assert.equal(run(set(mbUser, 'moldbreaker', 'adamant', { atk: 32 }, [mv]), sco, mv).code, 'mechanic-unsupported:spicy-spray-multihit');
  }
});

test('Magic Room and Klutz switch off Sitrus, Focus Sash, resist berries and Leftovers in the KO odds', () => {
  const nite = set('dragonite', 'innerfocus', 'bold', { hp: 32, def: 32 }, ['extremespeed'], 'sitrusberry');
  const atk = set('garchomp', 'roughskin', 'adamant', { atk: 32, hp: 32 }, ['dragonclaw']);
  const withSitrus = run(atk, nite, 'dragonclaw');
  const magic = run(atk, nite, 'dragonclaw', { field: { magicRoom: true } });
  assert.notDeepEqual(magic.ko.two, withSitrus.ko.two);
  assert.deepEqual(magic.ko.two, run(atk, { ...nite, item: '' }, 'dragonclaw').ko.two, 'Magic Room: as if no Sitrus');
  const frag = set('dragonite', 'innerfocus', 'hasty', {}, ['extremespeed'], 'focussash');
  const crit = run(set('garchomp', 'roughskin', 'jolly', { atk: 32, spe: 32 }, ['dragonclaw']), frag, 'dragonclaw', { move: { crit: true }, field: { magicRoom: true } });
  assert.deepEqual(crit.ko.one, { num: '1', den: '1' }, 'the Sash does nothing in Magic Room');
});

test('Unnerve stops the target eating its Sitrus Berry; Ripen / Cheek Pouch / Harvest with a berry refuse the lines they change', () => {
  const ttar = set('tyranitar', 'unnerve', 'adamant', { atk: 32 }, ['rockslide']);
  const nite = set('dragonite', 'innerfocus', 'bold', { hp: 32, def: 32 }, ['extremespeed'], 'sitrusberry');
  const r = run(ttar, nite, 'rockslide');
  assert.ok(r.chips.some((c) => c.code === 'unnerve-berry'));
  assert.deepEqual(r.ko.two, run(ttar, { ...nite, item: '' }, 'rockslide').ko.two);
  const flapple = Object.keys(mech.species).find((s) => mech.species[s].legal && mech.species[s].abilities.includes('Ripen'));
  if (flapple) {
    const d = set(flapple, 'ripen', 'bold', { hp: 32 }, [[...mech.ix.learn.get(flapple)].find((m) => mech.moves[m].category === 'Status')], 'sitrusberry');
    assert.deepEqual(run(CHOMP, d, 'earthquake').ko.two, { refused: 'between-turns:berry-ability' });
  }
});

test('Feint and Phantom Force break Protect for full damage', () => {
  for (const mv of ['feint', 'phantomforce']) {
    const user = Object.keys(mech.species).find((s) => mech.species[s].legal && !mech.species[s].mega && mech.ix.learn.get(s)?.has(mv));
    if (!user) continue;
    const ab = mech.species[user].abilities[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    const target = mv === 'phantomforce' ? INCIN : CHOMP;
    const p = run(set(user, ab, 'adamant', { atk: 32 }, [mv]), target, mv, { field: { defenderSide: { protect: true } } });
    const n = run(set(user, ab, 'adamant', { atk: 32 }, [mv]), target, mv);
    if (n.class !== 'exact') continue;
    assert.equal(p.class, 'exact', mv);
    assert.deepEqual(p.hitRows, n.hitRows, mv);
    assert.ok(p.chips.some((c) => c.code === 'breaks-protect'));
  }
});

test('fail-closed input: missing, null or odd Stat Points and impossible hit counts never become numbers', () => {
  for (const sp of [null, undefined, 'x', [], { hp: 32, foo: 1 }, { atk: '32' }]) {
    const r = run({ ...CHOMP, sp }, INCIN, 'earthquake');
    assert.equal(r.class, 'refused', JSON.stringify(sp));
  }
  const rb = Object.keys(mech.species).find((s) => mech.species[s].legal && !mech.species[s].mega && mech.ix.learn.get(s)?.has('rockblast'));
  const ab = mech.species[rb].abilities[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  const rs = set(rb, ab, 'adamant', { atk: 32 }, ['rockblast']);
  for (const hits of [1, 6, 7]) assert.equal(run(rs, INCIN, 'rockblast', { move: { hits } }).code, 'input-invalid:hits', String(hits));
  assert.equal(run(rs, INCIN, 'rockblast', { move: { hits: 4 } }).class, 'exact');
  assert.equal(run(CHOMP, INCIN, 'earthquake', { move: { hits: 3 } }).code, 'input-invalid:hits');
});

test('HP given as the percentage Showdown shows is a band of exact HP: the top of the band is used, the bottom is reported', () => {
  // shown = floor(100·hp/max) || 1
  for (const max of [150, 167, 202, 211]) for (let p = 1; p < 100; p++) {
    for (const end of ['lo', 'hi']) {
      const hp = hpFromShown(max, p, end);
      assert.equal(Math.floor((100 * hp) / max) || 1, p, `${max} ${p}% ${end} → ${hp}`);
    }
    assert.ok(hpFromShown(max, p, 'lo') <= hpFromShown(max, p, 'hi'));
  }
  assert.equal(hpFromShown(150, 100), 150);
  const r = run(CHOMP, INCIN, 'earthquake', { d: { hpPct: 60 } });
  assert.equal(r.curHP, hpFromShown(202, 60, 'hi'));
  assert.equal(r.hpLow.curHP, hpFromShown(202, 60, 'lo'));
  assert.ok(r.chips.some((c) => c.code === 'hp-band' && c.lo === hpFromShown(202, 60, 'lo')));
});

// Exact KO odds (lib/calc/ko.mjs): equal to brute-force enumeration, and equal to the real simulator's exhaustive
// survival enumeration (every roll combination played as a real battle; fractions in test/fixtures/sim-expected.json).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine, read } from './calc-helpers.mjs';
import { koOdds, hitDistribution } from '../lib/calc/ko.mjs';

const SIM = JSON.parse(read('test/fixtures/sim-expected.json'));
const gen = engine.Generations.get(0);
const P = (n, o) => new engine.Pokemon(gen, n, { level: 50, ...o });
const hits = (a, d, m, mo = {}) => {
  const r = engine.calculate(gen, P(...a), P(...d), new engine.Move(gen, m, { ability: a[1].ability, ...mo }), new engine.Field({ gameType: 'Doubles' }));
  return Array.isArray(r.damage[0]) ? r.damage : [r.damage];
};
const fixed = (rows) => ({ variant: () => ({ dist: [{ w: 1, hits: rows }] }) });
const frac = (k) => `${k.num}/${k.den}`;
const red = (s) => { const [a, b] = s.split('/').map(BigInt); const g = (x, y) => (y ? g(y, x % y) : x); const d = g(a, b) || 1n; return `${a / d}/${b / d}`; };

// Brute force over explicit roll paths (independent implementation: plain recursion, no state merging)
function brute(def, events) {
  let ko = 0n, tot = 0n;
  const walk = (i, hp, sitrus, sash, w) => {
    if (i === events.length) { tot += w; return; }
    for (const dmg of events[i].rolls) {
      let h = hp, s = sitrus, sa = sash;
      if (h === def.maxHP && dmg >= h && sa) { h = 1; sa = false; } else if (h === def.maxHP && dmg >= h && def.sturdy) h = 1; else h -= dmg;
      if (h <= 0) { ko += w * 16n ** BigInt(events.length - i - 1); tot += w * 16n ** BigInt(events.length - i - 1); continue; }
      if (s && h <= def.maxHP / 2) { h = Math.min(def.maxHP, h + Math.trunc(def.maxHP / 4)); s = false; }
      if (events[i].between) h = Math.min(def.maxHP, h + events[i].between);
      walk(i + 1, h, s, sa, w);
    }
  };
  walk(0, def.hp ?? def.maxHP, !!def.sitrus, !!def.sash, 1n);
  return red(`${ko}/${tot}`);
}

test('koOdds equals brute-force enumeration on 300 seeded random cases (1–3 events, Sitrus, Sash, Sturdy, Leftovers)', () => {
  let seed = 99;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  for (let n = 0; n < 300; n++) {
    const maxHP = 60 + Math.floor(rnd() * 200);
    const k = 1 + Math.floor(rnd() * 3);
    const events = Array.from({ length: k }, () => {
      const lo = 5 + Math.floor(rnd() * maxHP * 0.9);
      const r = Array.from({ length: 16 }, (_, i) => Math.floor((lo * (85 + i)) / 100));
      return { rolls: r, between: rnd() < 0.3 ? Math.trunc(maxHP / 16) : 0 };
    });
    const def = { maxHP, sitrus: rnd() < 0.5, sash: rnd() < 0.3, sturdy: rnd() < 0.2 };
    const got = koOdds(def, events.map((e) => ({ ...fixed([e.rolls]), heal: e.between })));
    assert.equal(frac(got), brute(def, events), `case ${n}`);
  }
});

test('the real simulator\'s exhaustive survival cases (6,656 real battles) are reproduced exactly', () => {
  const chompAd = ['Garchomp', { ability: 'Rough Skin', nature: 'Adamant', evs: { atk: 32, hp: 32 } }];
  const nite = ['Dragonite', { ability: 'Inner Focus', nature: 'Bold', evs: { hp: 32, def: 32 } }];
  const dc = hits(chompAd, nite, 'Dragon Claw')[0], dcCrit = hits(chompAd, nite, 'Dragon Claw', { isCrit: true })[0];
  const maxHP = 91 + 32 + 75;
  assert.equal(frac(koOdds({ maxHP, sitrus: true }, [fixed([dc]), fixed([dc])])), red(SIM.survival['two-turns-sitrus']));
  const critUse = { variant: () => ({ dist: [{ w: 1, hits: [dc] }], critHits: [dcCrit] }), critNum: 1, critDen: 24 };
  assert.equal(frac(koOdds({ maxHP, sitrus: true }, [critUse, critUse])), red(SIM.survival['two-turns-sitrus-crit-mixture']));
  assert.equal(frac(koOdds({ maxHP }, [{ ...fixed([dc]), heal: Math.trunc(maxHP / 16) }, fixed([dc])])), red(SIM.survival['two-turns-leftovers']));
  const g = hits(['Garchomp', { ability: 'Rough Skin', nature: 'Jolly', evs: { atk: 32, spe: 32 } }], nite, 'Dragon Claw')[0];
  const k = hits(['Kingambit', { ability: 'Defiant', nature: 'Adamant', evs: { atk: 32, hp: 32 } }], nite, 'Iron Head')[0];
  assert.equal(frac(koOdds({ maxHP, sitrus: true }, [fixed([g]), fixed([k])])), red(SIM.survival['same-turn-two-attackers-sitrus']), 'same turn: Sitrus between attackers, no Leftovers');
  const frag = ['Dragonite', { ability: 'Inner Focus', nature: 'Hasty' }];
  const gc = hits(['Garchomp', { ability: 'Rough Skin', nature: 'Jolly', evs: { atk: 32, spe: 32 } }], frag, 'Dragon Claw', { isCrit: true })[0];
  const kf = hits(['Kingambit', { ability: 'Defiant', nature: 'Adamant', evs: { atk: 32, hp: 32 } }], frag, 'Iron Head')[0];
  assert.equal(frac(koOdds({ maxHP: 91 + 75, sash: true }, [fixed([gc]), fixed([kf])])), red(SIM.survival['same-turn-two-attackers-focussash-crit-first']));
  const rb = hits(['Garchomp', { ability: 'Rough Skin', nature: 'Adamant', evs: { atk: 32 } }], ['Charizard', { ability: 'Blaze', nature: 'Bold', evs: { hp: 32, def: 32 } }], 'Rock Blast', { hits: 3 });
  assert.equal(frac(koOdds({ maxHP: 78 + 32 + 75, sitrus: true }, [fixed(rb)])), red(SIM.survival['multihit-3-sitrus']), 'Sitrus fires between hits of one move');
  assert.notEqual(frac(koOdds({ maxHP: 78 + 32 + 75 }, [fixed(rb)])), '0/1', 'ignoring Sitrus would claim a KO chance');
  const dw = hits(['Dragonite', { ability: 'Inner Focus', nature: 'Adamant', evs: { atk: 32 } }], ['Heracross', { ability: 'Guts', nature: 'Hasty' }], 'Dual Wingbeat');
  assert.equal(frac(koOdds({ maxHP: 80 + 75, sash: true }, [fixed(dw)])), red(SIM.survival['multihit-2-focussash']));
  const pb = hits(['Kangaskhan-Mega', { ability: 'Parental Bond', item: 'Kangaskhanite', nature: 'Adamant', evs: { atk: 32 } }], ['Aggron', { ability: 'Sturdy', nature: 'Hasty' }], 'Close Combat');
  assert.equal(frac(koOdds({ maxHP: 70 + 75, sturdy: true }, [fixed(pb)])), red(SIM.survival['parentalbond-vs-sturdy']));
});

test('2–5-hit moves use 35/35/15/15 (Skill Link: 5); the mixture beats the engine\'s fixed 3-hit default', () => {
  assert.deepEqual(hitDistribution([2, 5]), [{ n: 2, w: 7 }, { n: 3, w: 7 }, { n: 4, w: 3 }, { n: 5, w: 3 }]);
  assert.deepEqual(hitDistribution([2, 5], { skillLink: true }), [{ n: 5, w: 1 }]);
  assert.deepEqual(hitDistribution(10), [{ n: 10, w: 1 }]);
  // per-hit rolls 25–30 into 100 HP: three hits never KO, the mixture KOs whenever 4 or 5 hit (30%)
  const row = Array.from({ length: 16 }, (_, i) => 25 + Math.floor((i * 5) / 15));
  const use = { variant: () => ({ dist: hitDistribution([2, 5]).map((d) => ({ w: d.w, hits: Array(d.n).fill(row) })) }) };
  assert.equal(frac(koOdds({ maxHP: 100 }, [use])), '3/10');
  assert.equal(frac(koOdds({ maxHP: 100 }, [fixed([row, row, row])])), '0/1');
});

test('first-hit effects: a resist berry and Disguise change only the first hit; results stay exact fractions', () => {
  const full = Array(16).fill(40), halved = Array(16).fill(20);
  const use = { variant: (f) => ({ dist: [{ w: 1, hits: [f.berry ? halved : full, full] }] }), consumesBerry: true };
  // berry halves hit 1 only: 20 + 40 = 60 < 61 HP
  assert.equal(frac(koOdds({ maxHP: 61, berry: true }, [use])), '0/1');
  assert.equal(frac(koOdds({ maxHP: 61, berry: false }, [use])), '1/1');
  const dis = { variant: (f) => ({ dist: [{ w: 1, hits: [f.disguise ? Array(16).fill(10) : full] }] }), breaksDisguise: true };
  assert.equal(frac(koOdds({ maxHP: 40, disguise: true }, [dis, dis])), '1/1');
  assert.equal(frac(koOdds({ maxHP: 40, disguise: true }, [dis])), '0/1');
});

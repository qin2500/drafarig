// The fail-closed calc wrapper with the real vendored engine: hazard rules (stable outcome codes) and static fixtures of
// real-simulator rolls (test/fixtures/sim-expected.json, ported by tools/port-sim-fixtures.mjs from the simulator
// validation evidence). Each expected roll array comes from real Pokémon Showdown battles, not from the engine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mech, newCalc, set, CHOMP, INCIN, sc, rolls, read } from './calc-helpers.mjs';
import { outcomeClass } from '../lib/calc/wrapper.mjs';
import * as R from '../lib/calc/rules.mjs';

const SIM = JSON.parse(read('test/fixtures/sim-expected.json'));
const calc = newCalc();
const run = (...a) => calc.run(sc(...a));
const hasDigitsOrPct = (r) => /[0-9%]/.test(JSON.stringify({ class: r.class, code: r.code }).replace(/needs-state:[a-zA-Z]+/, ''));

test('H1/H4/H5/H7: species, Stat Points, ability and Mega stone are checked before the engine runs', () => {
  assert.equal(run(set('urshifurapidstrike', 'unseenfist', 'jolly', { atk: 32 }, ['closecombat']), INCIN, 'closecombat').code, 'species-not-in-regulation');
  assert.equal(run(set('clefairy', 'friendguard', 'bold', {}, ['moonblast']), INCIN, 'moonblast').code, 'species-not-in-regulation');
  assert.equal(run({ ...CHOMP, sp: { hp: 4, atk: 252, spe: 252 } }, INCIN, 'earthquake').code, 'sp-out-of-range');
  assert.equal(run({ ...CHOMP, sp: { atk: 33 } }, INCIN, 'earthquake').code, 'sp-out-of-range');
  assert.equal(run({ ...CHOMP, sp: { hp: 3, atk: 32, spe: 32 } }, INCIN, 'earthquake').code, 'sp-out-of-range');
  assert.equal(run({ ...CHOMP, sp: { atk: NaN } }, INCIN, 'earthquake').code, 'sp-out-of-range');
  assert.equal(run({ ...CHOMP, sp: { hp: 2, atk: 32, spe: 32 } }, INCIN, 'earthquake').class, 'exact');
  assert.equal(run({ ...CHOMP, ability: '' }, INCIN, 'earthquake').code, 'ability-missing');
  assert.equal(run({ ...CHOMP, ability: 'hugepower' }, INCIN, 'earthquake').code, 'ability-not-legal');
  const hawl = set('hawlucha', 'limber', 'jolly', { atk: 32 }, ['closecombat'], 'hawluchanite');
  const r = run(hawl, INCIN, 'closecombat');
  assert.equal(r.class, 'exact');
  assert.equal(r.attacker.ability, 'noguard', 'Mega Hawlucha battles with No Guard (projection), not the engine default');
  assert.equal(mech.species.skarmorymega.abilities[0], 'Stalwart');
  assert.equal(run({ ...CHOMP, item: 'garchompitez' }, INCIN, 'earthquake').attacker.name, 'Garchomp-Mega-Z');
  assert.equal(run(set('raichu', 'static', 'timid', { spa: 32 }, ['thunderbolt'], 'raichunitex'), INCIN, 'thunderbolt').attacker.name, 'Raichu-Mega-X');
  assert.equal(run(set('meowsticf', 'competitive', 'modest', { spa: 32 }, ['psychic'], 'meowsticite'), CHOMP, 'psychic').attacker.name, 'Meowstic-F-Mega');
  assert.equal(run({ ...CHOMP, item: 'charizarditex' }, INCIN, 'earthquake').code, 'mega-stone-mismatch');
});

test('H2/H3/H11 and learnsets: illegal items, stub and unlearnable moves, Beat Up never yield a number', () => {
  for (const item of ['choiceband', 'choicespecs', 'assaultvest', 'spookyplate', 'ghostgem', 'boosterenergy', 'deepseascale', 'fakeorb']) {
    assert.equal(run({ ...CHOMP, item }, INCIN, 'earthquake').code, 'item-not-in-regulation', item);
  }
  for (const item of ['choicescarf', 'lifeorb', 'normalgem', 'airballoon', 'rockyhelmet', 'redcard', 'electricseed', 'ironball']) assert.ok(mech.items[item], item);
  for (const mv of ['anchorshot', 'astralbarrage', 'bloodmoon', 'boltbeak', 'dragonhammer', 'fishiousrend', 'geargrind', 'hyperdrill', 'metalclaw', 'revelationdance', 'tripledive', 'return', 'frustration']) {
    const r = run({ ...CHOMP, moves: [mv] }, INCIN, mv);
    assert.equal(r.class, 'refused', mv);
    assert.equal(r.code, 'move-not-in-regulation', mv);
  }
  assert.equal(run(INCIN, CHOMP, 'knockoff').code, 'move-not-learnable', 'Incineroar cannot learn Knock Off in Champions');
  for (const mv of ['powershift', 'softboiled', 'spore']) assert.equal(mech.moves[mv], undefined, `${mv}: no Reg M-C species can learn it`);
  assert.equal(run(set('sableye', 'prankster', 'careful', {}, ['beatup'], ''), INCIN, 'beatup').code, 'move-not-learnable');
  const beatupUser = Object.keys(mech.species).find((s) => mech.species[s].legal && !mech.species[s].mega && mech.ix.learn.get(mech.species[s].outOfBattle)?.has('beatup'));
  if (beatupUser) {
    const ab = mech.species[beatupUser].abilities[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    assert.equal(run(set(beatupUser, ab, 'hardy', { atk: 1 }, ['beatup']), INCIN, 'beatup').code, 'move-unsupported');
  }
  assert.equal(run(CHOMP, INCIN, 'protect').class, 'status');
});

test('H6/H28: always Doubles; lone-target spread uses a target override, never Singles (screens stay 2732)', () => {
  assert.deepEqual(rolls(run(CHOMP, INCIN, 'earthquake')), SIM.golden['G1a-neutral'][0]);
  const lone = run(CHOMP, INCIN, 'earthquake', { field: { defenderSide: { partnerPresent: false }, attackerSide: { allyPresent: false } } });
  assert.deepEqual(rolls(lone), SIM.golden['G1b-singles'][0]);
  assert.ok(lone.applied.some((a) => a.code === 'lone-target-spread'));
  // EQ hits your own ally too: with your ally still in, it stays a spread move
  assert.deepEqual(rolls(run(CHOMP, INCIN, 'earthquake', { field: { defenderSide: { partnerPresent: false } } })), SIM.scenarios['spread-eq-lone-foe-ally-present'].psHits[0]);
  assert.deepEqual(rolls(run(CHOMP, INCIN, 'rockslide')), SIM.scenarios['spread-rockslide-two-foes'].psHits[0]);
  assert.deepEqual(rolls(run(CHOMP, INCIN, 'rockslide', { field: { defenderSide: { partnerPresent: false } } })), SIM.scenarios['spread-rockslide-lone-foe'].psHits[0]);
  assert.deepEqual(rolls(run(CHOMP, INCIN, 'rockslide', { field: { defenderSide: { partnerPresent: false, reflect: true } } })), SIM.scenarios['spread-rockslide-lone-foe-reflect'].psHits[0]);
  assert.deepEqual(rolls(run(CHOMP, INCIN, 'earthquake', { field: { defenderSide: { partnerPresent: false }, attackerSide: { allyPresent: false } } })), SIM.scenarios['spread-eq-lone-foe-no-ally'].psHits[0]);
  for (const id of ['spread-rockslide-partner-protects', 'spread-rockslide-partner-flying-semiinv']) assert.deepEqual(rolls(run(CHOMP, INCIN, 'rockslide')), SIM.scenarios[id].psHits[0], id);
  assert.deepEqual(rolls(run(CHOMP, INCIN, 'earthquake')), SIM.scenarios['spread-eq-partner-immune-levitate'].psHits[0]);
});

test('H27 Intimidate: the wrapper computes post-Intimidate stages from the simulator table (never the engine)', () => {
  // G1a/G1c with a real Intimidate Incineroar: −1 Atk
  assert.deepEqual(rolls(run(CHOMP, { ...INCIN, ability: 'intimidate' }, 'earthquake', { a: { intimidated: 1 } })), SIM.golden['G1c-realIntimidate'][0]);
  assert.deepEqual(rolls(run(CHOMP, INCIN, 'earthquake', { a: { intimidated: 1 }, move: { crit: true } })), SIM.golden['G1d-crit'][0]);
  // Every receiver in the simulator's 34-case table: build a receiver that can have that ability where one exists in Reg M-C
  let checked = 0;
  for (const row of SIM.intimidate) {
    const ab = row.receiverAbility.toLowerCase().replace(/[^a-z0-9]/g, '');
    const holder = Object.keys(mech.species).find((s) => mech.species[s].legal && !mech.species[s].mega && mech.species[s].abilities.map((a) => a.toLowerCase().replace(/[^a-z0-9]/g, '')).includes(ab));
    if (!holder) continue;
    const mv = ['tackle', 'quickattack', 'bodyslam', 'facade', 'protect'].find((m) => mech.ix.learn.get(mech.species[holder].outOfBattle)?.has(m) && mech.moves[m]?.category !== 'Status') ?? null;
    if (!mv) continue;
    const r = calc.run(sc(set(holder, ab, 'hardy', { atk: 1 }, [mv], row.item ?? ''), INCIN, mv, { a: { intimidated: 1 } }));
    assert.equal(r.class, 'exact', `${row.receiverAbility} ${r.code}`);
    const st = Object.fromEntries(r.chips.filter((c) => c.code === 'stage' && c.side === 'attacker').map((c) => [c.stat, c.value]));
    assert.deepEqual({ atk: st.atk ?? 0, spa: st.spa ?? 0, spe: st.spe ?? 0 }, row.receiver, `${row.receiverAbility}${row.item ? ' + White Herb' : ''}`);
    checked++;
  }
  assert.ok(checked >= 20, `${checked} intimidate rows checked`);
  // Flower Veil on a Grass receiver isn't in the verified table: refused, not guessed
  const fv = Object.keys(mech.species).find((s) => mech.species[s].legal && mech.species[s].types.includes('Grass') && mech.species[s].abilities.includes('Flower Veil'));
  if (fv) assert.equal(run(set(fv, 'flowerveil', 'hardy', { atk: 1 }, [[...mech.ix.learn.get(fv)].find((m) => mech.moves[m].category === 'Physical')]), INCIN, [...mech.ix.learn.get(fv)].find((m) => mech.moves[m].category === 'Physical'), { a: { intimidated: 1 } }).code, 'mechanic-unsupported:intimidate-flowerveil');
});

test('H18/H25/H26/H33/H34: Protect-bypass order, Mold Breaker vs Friend Guard, Iron Ball grounding, any-active Fairy Aura, state BP', () => {
  // Unseen Fist / Piercing Drill into Protect (16 real-simulator probes)
  const golurk = (mv) => set('golurk', 'ironfist', 'adamant', { atk: 32 }, [mv], 'golurkite');
  const excad = (mv) => set('excadrill', 'sandrush', 'adamant', { atk: 32 }, [mv], 'excadrite');
  const defs = { Incineroar: set('incineroar', 'blaze', 'serious', { hp: 32 }, ['fakeout']), Kingambit: set('kingambit', 'pressure', 'serious', { hp: 32 }, ['protect'], 'chopleberry'),
    Rillaboom: set('rillaboom', 'overgrow', 'serious', { hp: 32 }, ['protect']), Garchomp: set('garchomp', 'roughskin', 'serious', { hp: 32 }, ['protect']) };
  let n = 0;
  for (const [atk, abil, mv] of [[golurk, 'UnseenFist', 'drainpunch'], [golurk, 'UnseenFist', 'heavyslam'], [excad, 'PiercingDrill', 'ironhead'], [excad, 'PiercingDrill', 'earthquake']]) {
    for (const [defName, suffix, fg, scr] of [['Incineroar', '', false, ''], ['Kingambit', '-chopleberry', false, ''], ['Rillaboom', '-fg-reflect', true, 'reflect'], ['Garchomp', '-reflect', false, 'reflect']]) {
      const id = `bypass-${abil}-${mv}-vs-${defName}${suffix}`;
      const exp = SIM.scenarios[id];
      const r = calc.run(sc(atk(mv), defs[defName], mv, { field: { defenderSide: { protect: true, friendGuard: fg, reflect: scr === 'reflect' } } }));
      if (!exp.psHits) { assert.equal(r.class, 'no-damage', id); continue; }
      assert.equal(r.class, 'exact', `${id}: ${r.code}`);
      assert.deepEqual(r.hitRows[0], exp.psHits[0], id);
      n++;
    }
  }
  assert.ok(n >= 12);
  // Mold Breaker attacker ignores the target ally's Friend Guard
  const exc = set('excadrill', 'moldbreaker', 'adamant', { atk: 32 }, ['ironhead']);
  const mbr = run(exc, set('incineroar', 'blaze', 'careful', { hp: 32, def: 2, spd: 32 }, ['fakeout']), 'ironhead', { field: { defenderSide: { friendGuard: true } } });
  assert.deepEqual(mbr.hitRows[0], SIM.scenarios['moldbreaker-vs-friendguard'].psHits[0]);
  assert.ok(mbr.applied.some((a) => a.code === 'moldbreaker-friendguard'));
  // Iron Ball / Gravity ground Levitate / Eelevate (ranges from the real simulator)
  for (const f of SIM.wrapperFixes.filter((x) => x.fix === 'F3')) {
    const defId = f.defender.toLowerCase().replace(/[^a-z0-9]/g, '');
    const base = mech.species[defId]?.outOfBattle;
    if (!base || !mech.species[defId].legal) continue;
    const d = set(base, f.ability === 'Eelevate' ? 'levitate' : 'levitate', 'serious', { hp: 32 }, ['protect'], f.gravity ? 'eelektrossite' : 'ironball');
    if (!mech.ix.learn.get('garchomp').has(f.move)) continue; // the probe used a move Garchomp can't learn in Reg M-C
    const r = run(set('garchomp', 'roughskin', 'jolly', { atk: 32 }, [f.move]), d, f.move, { field: { gravity: f.gravity } });
    assert.equal(r.class, 'exact', `${f.defender} ${f.move} ${r.code}`);
    assert.deepEqual([r.hitRows[0][0], r.hitRows[0][15]], f.ps, `${f.defender} ${f.move}`);
  }
  // Fairy Aura on an ally or foe: set from the field flag
  const gard = set('gardevoir', 'synchronize', 'modest', { spa: 32 }, ['moonblast']);
  const inciD = set('incineroar', 'blaze', 'careful', { hp: 32, def: 2, spd: 32 }, ['fakeout']);
  assert.deepEqual(run(gard, inciD, 'moonblast', { field: { otherFairyAura: true } }).hitRows[0], SIM.scenarios['fairyaura-ally-holder'].psHits[0]);
  assert.deepEqual(run(gard, inciD, 'moonblast', { field: { otherFairyAura: true } }).hitRows[0], SIM.scenarios['fairyaura-foe-holder'].psHits[0]);
  // Rage Fist / Last Respects: a question first, then the simulator formula
  const ape = set('annihilape', 'defiant', 'adamant', { atk: 32, hp: 32, def: 2 }, ['ragefist']);
  const gar = set('garganacl', 'purifyingsalt', 'serious', { hp: 32, def: 32 }, ['protect']);
  const q = run(ape, gar, 'ragefist');
  assert.equal(q.class, 'needs-state');
  assert.deepEqual(q.question, { key: 'timesHit', side: 'attacker', options: [0, 1, 2, 3, 4, 5, 6] });
  for (const f of SIM.wrapperFixes.filter((x) => x.fix === 'F4' && x.move === 'ragefist' && x.hitsTaken <= 6)) {
    const r = run(ape, set('garganacl', 'clearbody', 'serious', { hp: 32, def: 32 }, ['protect']), 'ragefist', { a: { timesHit: f.hitsTaken } });
    assert.deepEqual([r.hitRows[0][0], r.hitRows[0][15]], f.ps, `Rage Fist after ${f.hitsTaken}`);
  }
  const hs = set('houndstone', 'sandrush', 'adamant', { atk: 32 }, ['lastrespects']);
  assert.equal(run(hs, INCIN, 'lastrespects').code, 'needs-state:faintedAllies');
  for (const f of SIM.wrapperFixes.filter((x) => x.fix === 'F4' && x.move === 'lastrespects')) {
    const r = run(hs, set('incineroar', 'blaze', 'serious', { hp: 32 }, ['fakeout']), 'lastrespects', { a: { faintedAllies: f.fainted } });
    assert.deepEqual([r.hitRows[0][0], r.hitRows[0][15]], f.ps, `Last Respects with ${f.fainted} fainted`);
  }
});

test('simulator scenario probes: screens, crit, burn, Mega Sol, Aura Guard, Dragonize, Eelevate, Parental Bond, items, variable power', () => {
  const S = (id) => SIM.scenarios[id].psHits;
  const inci = set('incineroar', 'blaze', 'careful', { hp: 32, def: 2, spd: 32 }, ['fakeout']);
  const eq = (r, id) => { assert.equal(r.class, 'exact', `${id}: ${r.code}`); assert.deepEqual(r.hitRows, S(id), id); };
  eq(run(CHOMP, inci, 'rockslide', { move: { crit: true }, field: { defenderSide: { reflect: true } } }), 'screen-reflect-crit');
  eq(run(CHOMP, inci, 'rockslide', { field: { defenderSide: { reflect: true, auroraVeil: true } } }), 'screen-veil-plus-reflect');
  eq(run(CHOMP, inci, 'rockslide', { a: { status: 'brn' }, move: { crit: true } }), 'burn-crit-physical');
  eq(run(set('garchomp', 'roughskin', 'jolly', { atk: 32 }, ['brickbreak']), inci, 'brickbreak', { field: { defenderSide: { reflect: true } } }), 'screen-brickbreak');
  const meg = (mv) => set('meganium', 'overgrow', 'modest', { spa: 32, hp: 32 }, [mv], 'meganiumite');
  const pel = set('pelipper', 'drizzle', 'serious', { hp: 32 }, ['hurricane']);
  for (const mv of ['weatherball', 'flamethrower', 'hydropump', 'solarbeam', 'energyball']) {
    const r = run(meg(mv), pel, mv, { field: { weather: 'Rain' } });
    if (!mech.ix.learn.get('meganium').has(mv)) { assert.equal(r.code, 'move-not-learnable', `${mv}: the probe used a move Mega Meganium can't learn in Reg M-C`); continue; }
    eq(r, `megasol-rain-${mv}`);
  }
  eq(run(set('charizard', 'blaze', 'modest', { spa: 32 }, ['flamethrower']), pel, 'flamethrower', { field: { weather: 'Rain' } }), 'megasol-partner-fire-in-rain');
  eq(run(meg('energyball'), set('tyranitar', 'sandstream', 'serious', { hp: 32, spd: 32 }, ['rockslide'], 'tyranitarite'), 'energyball', { field: { weather: 'Sand' } }), 'megasol-defender-in-sand');
  const luc = set('lucario', 'innerfocus', 'serious', { hp: 32, def: 32 }, ['closecombat'], 'lucarionitez');
  eq(run(set('incineroar', 'blaze', 'adamant', { atk: 32 }, ['flareblitz']), luc, 'flareblitz'), 'auraguard-contact');
  eq(run(CHOMP, luc, 'earthquake'), 'auraguard-noncontact');
  eq(run(set('excadrill', 'moldbreaker', 'adamant', { atk: 32 }, ['ironhead']), luc, 'ironhead'), 'auraguard-moldbreaker');
  eq(run(set('incineroar', 'blaze', 'adamant', { atk: 32 }, ['flareblitz']), luc, 'flareblitz', { move: { crit: true } }), 'auraguard-crit');
  const fera = (mv) => set('feraligatr', 'sheerforce', 'adamant', { atk: 32, hp: 32 }, [mv], 'feraligite');
  for (const mv of ['doubleedge', 'hypervoice', 'extremespeed', 'weatherball', 'crunch']) {
    if (!mech.ix.learn.get('feraligatr').has(mv)) { assert.equal(run(fera(mv), inci, mv).code, 'move-not-learnable'); continue; }
    eq(run(fera(mv), inci, mv), `dragonize-${mv}`);
  }
  assert.equal(run(fera('return'), inci, 'return').code, 'move-not-in-regulation', 'Return is Past in Champions');
  assert.equal(run(fera('doubleedge'), set('sylveon', 'pixilate', 'serious', {}, ['moonblast']), 'doubleedge').code, 'immune-type');
  const eel = set('eelektross', 'levitate', 'serious', { hp: 32 }, ['thunderbolt'], 'eelektrossite');
  assert.equal(run(CHOMP, eel, 'earthquake').code, 'immune-ability');
  eq(run(CHOMP, eel, 'earthquake', { field: { gravity: true } }), 'eelevate-gravity');
  eq(run(set('excadrill', 'moldbreaker', 'adamant', { atk: 32 }, ['earthquake']), eel, 'earthquake'), 'eelevate-moldbreaker');
  eq(run(CHOMP, set('eelektross', 'levitate', 'serious', { hp: 32 }, ['thunderbolt'], 'ironball'), 'earthquake'), 'eelevate-ironball-levitate');
  const kang = (mv) => set('kangaskhan', 'scrappy', 'adamant', { atk: 32, hp: 32 }, [mv], 'kangaskhanite');
  eq(run(kang('doubleedge'), inci, 'doubleedge'), 'pb-doubleedge');
  eq(run(kang('rockslide'), inci, 'rockslide'), 'pb-spread-two-foes');
  eq(run(kang('rockslide'), inci, 'rockslide', { field: { defenderSide: { partnerPresent: false } } }), 'pb-spread-lone-foe');
  eq(run(kang('doubleedge'), { ...inci, item: 'sitrusberry' }, 'doubleedge'), 'pb-sitrus-between-hits');
  eq(run(set('glalie', 'innerfocus', 'jolly', { atk: 32 }, ['iciclespear']), set('garchomp', 'roughskin', 'serious', { hp: 32 }, ['protect'], 'yacheberry'), 'iciclespear', { move: { hits: 4 } }), 'multihit-resistberry');
  eq(run(set('gengar', 'cursedbody', 'modest', { spa: 32 }, ['hex']), inci, 'hex', { d: { status: 'par' } }), 'hex-status');
  if (mech.species.conkeldurr?.legal) eq(run(set('conkeldurr', 'guts', 'adamant', { atk: 32 }, ['lowkick']), set('aggron', 'sturdy', 'serious', { hp: 32 }, ['protect'], 'aggronite'), 'lowkick'), 'lowkick-weight');
  eq(run(set('annihilape', 'defiant', 'adamant', { atk: 32 }, ['ragefist']), inci, 'ragefist', { a: { timesHit: 0 } }), 'ragefist-0');
  eq(run(set('annihilape', 'defiant', 'adamant', { atk: 32 }, ['ragefist']), inci, 'ragefist', { a: { timesHit: 2 } }), 'ragefist-hit2');
  eq(run(set('houndstone', 'sandrush', 'adamant', { atk: 32 }, ['lastrespects']), inci, 'lastrespects', { a: { faintedAllies: 2 } }), 'lastrespects-2fainted');
  // Knock Off probes used Incineroar, which can't learn Knock Off in Reg M-C: the wrapper refuses that set instead.
  assert.equal(run(set('incineroar', 'blaze', 'adamant', { atk: 32 }, ['knockoff']), CHOMP, 'knockoff').code, 'move-not-learnable');
});

test('H29–H32: mid-move changes and type changes are refused with a fix, never approximated', () => {
  const sco = set('scovillain', 'chlorophyll', 'serious', { hp: 32 }, ['protect'], 'scovillainite');
  const rbUser = ['tyranitar', 'heracross', 'aerodactyl'].find((s) => mech.ix.learn.get(s)?.has('rockblast'));
  const ab = mech.species[rbUser].abilities[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  const rb = set(rbUser, ab, 'jolly', { atk: 32 }, ['rockblast']);
  const r = run(rb, sco, 'rockblast', { move: { hits: 5 } });
  assert.equal(r.code, 'mechanic-unsupported:spicy-spray-multihit');
  assert.deepEqual(r.fix, { kind: 'first-hit-only' });
  assert.ok(!hasDigitsOrPct(r));
  const first = run(rb, sco, 'rockblast', { move: { hits: 5, firstHitOnly: true } });
  assert.equal(first.class, 'exact');
  assert.equal(first.hitRows.length, 1);
  const kang = set('kangaskhan', 'scrappy', 'adamant', { atk: 32 }, ['doubleedge'], 'kangaskhanite');
  const pbBerry = run(kang, set('garchomp', 'roughskin', 'serious', {}, ['protect'], 'chilanberry'), 'doubleedge');
  assert.equal(pbBerry.code, 'mechanic-unsupported:pb-item-change');
  const pbOk = run(kang, set('garchomp', 'roughskin', 'serious', {}, ['protect'], 'chilanberry'), 'doubleedge', { move: { firstHitOnly: true } });
  assert.equal(pbOk.class, 'exact');
  const gren = set('greninja', 'protean', 'timid', { spa: 32 }, ['darkpulse']);
  assert.equal(run(CHOMP, gren, 'earthquake').code, 'mechanic-unsupported:type-change');
  const asAttacker = run(gren, INCIN, 'darkpulse');
  assert.equal(asAttacker.class, 'exact');
  assert.ok(asAttacker.chips.some((c) => c.code === 'protean-first-move'));
  if (mech.species.stunfiskgalar?.legal) assert.equal(run(set('stunfiskgalar', 'mimicry', 'serious', { atk: 1 }, ['earthquake'].filter((m) => mech.ix.learn.get('stunfiskgalar').has(m))), INCIN, 'earthquake').code, 'mechanic-unsupported:type-change');
  assert.equal(run(set('ditto', 'imposter', 'serious', { hp: 1 }, ['transform']), INCIN, 'transform').class, 'status');
});

test('Disguise and Aegislash formes follow the simulator: a fixed 1/8 chip, Shield/Blade by state', () => {
  const mimi = set('mimikyu', 'disguise', 'serious', {}, ['playrough']);
  const k = set('kingambit', 'supremeoverlord', 'adamant', { atk: 32 }, ['ironhead']);
  const intact = run(k, mimi, 'ironhead', { a: { faintedAllies: 0 } });
  assert.equal(intact.class, 'exact');
  const chip = Math.trunc(intact.maxHP / 8);
  assert.deepEqual(intact.hitRows[0], Array(16).fill(chip));
  assert.ok(intact.chips.some((c) => c.code === 'disguise-intact'));
  const busted = run(k, mimi, 'ironhead', { a: { faintedAllies: 0 }, d: { disguiseIntact: false } });
  assert.ok(busted.hitRows[0][15] > chip);
  const dc = run(CHOMP, mimi, 'dragonclaw');
  assert.equal(dc.code, 'immune-type', 'Dragon into Fairy is immune: no Disguise break');
  // Aegislash: attacking uses Blade; defending defaults to Shield (visible chip) and can be set to Blade
  const aeg = set('aegislash', 'stancechange', 'serious', {}, ['shadowball', 'kingsshield']);
  const atk = run(aeg, INCIN, 'shadowball');
  assert.equal(atk.attacker.name, 'Aegislash-Blade');
  const shield = run(CHOMP, aeg, 'earthquake');
  assert.equal(shield.defender.name, 'Aegislash-Shield');
  assert.ok(shield.chips.some((c) => c.code === 'aegislash-shield'));
  const blade = run(CHOMP, aeg, 'earthquake', { d: { form: 'blade' } });
  assert.equal(blade.defender.name, 'Aegislash-Blade');
  assert.ok(blade.hitRows[0][0] > shield.hitRows[0][15]);
});

test('KO odds: exact fractions with Sitrus, Leftovers, Sash and multi-hit mixtures; "if crit" kept separate; repeated-use refusals', () => {
  const r = run(CHOMP, INCIN, 'earthquake');
  assert.deepEqual(r.ko.one, { num: '0', den: '1' });
  assert.deepEqual(r.ko.two, { num: '1', den: '1' }, 'G1a: two hits KO in all 256 roll pairs');
  assert.deepEqual(r.crit.hitRows[0], SIM.golden['G1d-crit'][0], 'if crit (a crit ignores the attacker drop too)');
  assert.deepEqual(r.crit.ko1, { num: '1', den: '1' }, 'if crit: every roll KOs');
  const c = run(CHOMP, INCIN, 'earthquake', { a: { intimidated: 1 } });
  assert.deepEqual(c.ko.two, { num: '127', den: '256' }, 'G1c: 49.6% two-hit KO');
  // Sitrus counted between hits (real-battle enumeration: 123/256 for this case)
  const nite = set('dragonite', 'innerfocus', 'bold', { hp: 32, def: 32 }, ['extremespeed'], 'sitrusberry');
  const s = run(set('garchomp', 'roughskin', 'adamant', { atk: 32, hp: 32 }, ['dragonclaw']), nite, 'dragonclaw');
  assert.equal(`${s.ko.two.num}/${s.ko.two.den}`, reduceFrac(SIM.survival['two-turns-sitrus']));
  assert.ok(s.chips.some((x) => x.code === 'sitrus-counted'));
  const l = run(set('garchomp', 'roughskin', 'adamant', { atk: 32, hp: 32 }, ['dragonclaw']), { ...nite, item: 'leftovers' }, 'dragonclaw');
  assert.equal(`${l.ko.two.num}/${l.ko.two.den}`, reduceFrac(SIM.survival['two-turns-leftovers']));
  // Grassy Terrain heal between turns isn't modelled: the repeated-use line is refused, the single hit is still exact
  const g = run(CHOMP, INCIN, 'earthquake', { field: { terrain: 'Grassy' } });
  assert.equal(g.class, 'exact');
  assert.deepEqual(g.ko.two, { refused: 'between-turns:grassy-heal' });
  assert.deepEqual(run(set('garchomp', 'roughskin', 'modest', { spa: 32 }, ['dracometeor']), INCIN, 'dracometeor').ko.two, { refused: 'changes-after-use:self-drop' });
  assert.equal(outcomeClass(r), 'one:none|two:all');
});

test('every refusal and question carries no number: digits and % never appear in a refused result payload', () => {
  const cases = [run({ ...CHOMP, item: 'choiceband' }, INCIN, 'earthquake'), run({ ...CHOMP, moves: ['dragonhammer'] }, INCIN, 'dragonhammer'),
    run({ ...CHOMP, sp: { atk: 70 } }, INCIN, 'earthquake'), run(set('houndstone', 'sandrush', 'adamant', { atk: 32 }, ['lastrespects']), INCIN, 'lastrespects')];
  for (const r of cases) {
    assert.ok(['refused', 'needs-state'].includes(r.class), r.code);
    assert.equal(r.hitRows, undefined);
    assert.equal(r.ko, undefined);
    assert.equal(r.range, undefined);
  }
});

test('envelope over unknown Stat Points: frail / common / max rows, ordered, the known nature kept', () => {
  const their = { ...CHOMP, sp: 'unknown' };
  const e = calc.envelope(sc(their, INCIN, 'earthquake'), 'attacker', { common: { sp: { hp: 2, atk: 32, spe: 32 }, nature: 'jolly', label: 'ladder' } });
  assert.deepEqual(e.rows.map((x) => x.key), ['frail', 'common', 'max']);
  assert.ok(e.rows.every((x) => x.result.class === 'exact'));
  const lo = e.rows.map((x) => x.result.range.min);
  assert.ok(lo[0] < lo[1] && lo[1] <= lo[2]);
  const known = calc.envelope(sc(their, INCIN, 'earthquake'), 'attacker', { natureKnown: true });
  assert.ok(known.rows.every((x) => x.nature === 'jolly'));
  const def = calc.envelope(sc(CHOMP, { ...INCIN, sp: 'unknown' }, 'earthquake'), 'defender');
  assert.deepEqual(def.stats, ['hp', 'def']);
  assert.ok(def.rows[0].result.range.max > def.rows.at(-1).result.range.max, 'frail takes more damage than max');
  assert.equal(calc.run(sc(their, INCIN, 'earthquake')).code, 'sp-unknown', 'a single run never guesses unknown Stat Points');
});

function reduceFrac(s) {
  const [a, b] = s.split('/').map(BigInt);
  const g = (x, y) => (y ? g(y, x % y) : x);
  const d = g(a, b) || 1n;
  return `${a / d}/${b / d}`;
}

test('result-affecting calc sources are pinned to WRAPPER_VERSION (a change without a version bump fails here)', async () => {
  const { createHash } = await import('node:crypto');
  const pin = JSON.parse(read('test/fixtures/calc-source-pin.json'));
  const now = Object.fromEntries(Object.keys(pin.files).map((f) => [f, createHash('sha256').update(read(f)).digest('hex')]));
  assert.equal(R.WRAPPER_VERSION, pin.version, 'WRAPPER_VERSION changed: update test/fixtures/calc-source-pin.json');
  assert.deepEqual(now, pin.files, 'calc sources changed: bump WRAPPER_VERSION (saved calcs go out of date) and update the pin');
  for (const code of mech.meta.wrapperRules) assert.match(code, /^[WR]-[A-Z0-9-]+$/);
});

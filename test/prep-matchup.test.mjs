// The Battle Prep briefing model (lib/prep-matchup.mjs) on inlined rosters: the domain contract's fixture assertions
// (look-first threats, Mega attribution, non-answers as reassurances only, guarded blunts, Speed bands and flips, honest
// quick-check moves, POV symmetry, lead ideas with costs) plus determinism, layers and missing-data behaviour.
// Rosters: a 2026-10-03 league snapshot (6–7 picks each) and one synthetic league; nothing is fetched.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mech, read } from './calc-helpers.mjs';
import { coreContext } from '../lib/cores.mjs';
import { buildBriefing, resolvePov, ownerOf, workspacesFor, unassignedVs, legacyEvidence, relevantSpeedIds } from '../lib/prep-matchup.mjs';
import { speedRange, compareSpeed } from '../lib/calc/stats.mjs';
import { canLearn } from '../lib/calc/mech.mjs';

const DEX = JSON.parse(read('data/dex.json')), SPEC = JSON.parse(read('data/cores.json'));
const CX = coreContext(DEX, SPEC);
export const ROSTERS = {
  Anthony: ['charizard', 'sinistcha', 'pelipper', 'kangaskhan', 'aegislash', 'morpeko'],
  Taro: ['salamence', 'tyranitar', 'excadrill', 'sneasler', 'serperior', 'tinkaton'],
  Jacky: ['incineroar', 'golisopod', 'farigiraf', 'rotommow', 'torkoal', 'mimikyu'],
  Hex: ['garchomp', 'indeedeef', 'corviknight', 'rotomheat', 'armarouge', 'kleavor', 'banette'],
  Ning: ['rillaboom', 'gholdengo', 'milotic', 'lucario', 'ninetalesalola', 'ceruledge'],
  Me: ['hatterene', 'torkoal', 'kingambit', 'indeedeef'],
  Them: ['whimsicott', 'incineroar', 'talonflame', 'rillaboom'],
};
const side = (name, order = 1) => ({ name, order, ids: ROSTERS[name], slotsLeft: 0, pointsLeft: 0 });
const brief = (pov, opp, extra = {}) => buildBriefing({ cx: CX, dex: DEX, mech, usage: null, mine: side(pov, 1), theirs: side(opp, 2), available: [], ...extra });
const T = brief('Anthony', 'Taro'), J = brief('Anthony', 'Jacky'), N = brief('Anthony', 'Ning'), S = brief('Me', 'Them'), R = brief('Taro', 'Anthony');
const cp = (F, core) => F.myCores.find((c) => c.coreId === core);
const fact = (F, mineId, theirForm) => F.speed.deciding.find((l) => l[0].aId === mineId && l[0].bForm === theirForm);

test('fixture rosters exist in the dex (the assertions below mean something)', () => {
  for (const ids of Object.values(ROSTERS)) for (const id of ids) assert.ok(DEX.species[id], id);
});

test('B1–B4 look-first threats: ordered by checkable reasons; Mega-only offense names its form; Stance Change counts as attacking', () => {
  assert.deepEqual(T.key, ['tyranitar', 'salamence', 'excadrill'], 'B1');
  assert.deepEqual(T.threats[0].reasons.map((x) => x.code), ['stab-se-many', 'no-wall', 'plan-tell', 'mega-option'], 'B2');
  assert.deepEqual(T.threats[0].reasons[0].ids, ['charizard', 'sinistcha', 'pelipper', 'aegislash'], 'B2 victims');
  const h = T.myMons.find((m) => m.id === 'charizard').pros.find((p) => p.code === 'hits-key-se').hits.find((x) => x.id === 'salamence');
  assert.deepEqual([h.form, h.megaOnly], ['Charizard-Mega-X', true], 'B3');
  assert.ok(T.myMons.find((m) => m.id === 'aegislash').pros.some((p) => p.code === 'hits-key-se'), 'B4');
  assert.deepEqual(T.threats.filter((t) => t.ring === 'look-first').map((t) => t.rank), [1, 2, 3]);
  for (const t of T.threats) for (const r of t.reasons) assert.ok(['known', 'prior', 'possible'].includes(r.layer), `${t.id} ${r.code} has a layer`);
});

test('C1–C3 the spec\'s non-answers are never their counter-prep; they stay only as conditional reassurances; real answers stay', () => {
  for (const c of S.myCores) for (const e of [...c.couldPrep, ...c.visible]) assert.ok(!['tr-tailwind', 'pt-fakeout'].includes(e.answer), `${e.mon}:${e.answer}`);
  assert.deepEqual(cp(S, 'trick-room').reassure.map((e) => `${e.mon}:${e.answer}`), ['whimsicott:tr-tailwind', 'talonflame:tr-tailwind'], 'C2');
  assert.deepEqual(cp(S, 'psychic-terrain').reassure.map((e) => `${e.mon}:${e.answer}`), ['incineroar:pt-fakeout', 'rillaboom:pt-fakeout'], 'C2');
  assert.ok(cp(S, 'trick-room').couldPrep.some((e) => e.mon === 'whimsicott' && e.answer === 'tr-taunt'), 'C3');
  assert.ok(cp(S, 'trick-room').couldPrep.some((e) => e.mon === 'incineroar' && e.answer === 'tr-fakeout'), 'C3');
  // guard: the set of non-answers the spec has (a spec change must revisit these cases)
  assert.deepEqual(SPEC.cores.flatMap((c) => (c.answers ?? []).filter((a) => a.counts === false).map((a) => a.id)).sort(), ['pt-fakeout', 'tr-tailwind']);
  // property: across every pair of fixture rosters, no non-answer is ever could-prep or visible
  for (const a of Object.keys(ROSTERS)) for (const b of Object.keys(ROSTERS)) {
    if (a === b) continue;
    for (const c of brief(a, b).myCores) for (const e of [...c.couldPrep, ...c.visible]) assert.ok(!['tr-tailwind', 'pt-fakeout'].includes(e.answer), `${a} vs ${b}: ${e.answer}`);
  }
});

test('C4–C6 blunts are guarded: Rage Powder never blunts a Grass attacker; Taunt blunts say "unless Mental Herb"; terrain blunts carry their condition; visibility splits by sheet rule', () => {
  const ser = cp(T, 'tailwind').couldPrep.find((e) => e.mon === 'serperior' && e.answer === 'tw-taunt');
  assert.equal(ser.bluntedBy.length, 0);
  assert.equal(ser.notBlunted[0].reason, 'attacker-grass-powder-immune');
  for (const a of ['tw-fakeout', 'tw-taunt']) assert.equal(cp(N, 'tailwind').couldPrep.find((x) => x.mon === 'rillaboom' && x.answer === a).bluntedBy.length, 0, a);
  assert.equal(cp(T, 'tailwind').couldPrep.find((e) => e.mon === 'sneasler' && e.answer === 'tw-taunt').bluntedBy[0].id, 'sinistcha', 'control: still redirectable');
  assert.deepEqual(cp(J, 'tailwind').couldPrep.find((x) => x.mon === 'farigiraf' && x.answer === 'tw-tr').bluntedBy.find((b) => b.id === 'morpeko').unless, [{ item: 'mentalherb' }]);
  assert.deepEqual(cp(S, 'trick-room').couldPrep.find((x) => x.mon === 'incineroar' && x.answer === 'tr-fakeout').bluntedBy[0].unless, [{ condition: 'terrain-up-and-target-grounded' }]);
  assert.deepEqual(cp(T, 'tailwind').couldPrep.find((x) => x.mon === 'sneasler' && x.answer === 'tw-fakeout').visibility, { closed: 'until-used', open: 'preview' });
});

test('S1–S3 Speed: bands are the stats.mjs ranges; Tailwind and Trick Room flips; weather-speed rows need a setter (cross-side by ability only)', () => {
  const l = fact(T, 'charizard', 'Tyranitar');
  const none = l.find((p) => p.scenario === 'none'), tw = l.find((p) => p.scenario === 'tw-mine');
  assert.equal(none.result, 'depends');
  assert.deepEqual([none.mineNeeds.sp, none.mineNeeds.speed], [0, 132], 'S1: any +Spe Charizard clears their max');
  assert.equal(tw.result, 'first');
  const a = fact(T, 'aegislash', 'Salamence-Mega');
  assert.equal(a.find((p) => p.scenario === 'none').result, 'second', 'S2');
  assert.equal(a.find((p) => p.scenario === 'tr').result, 'first', 'S2');
  assert.ok(T.speed.weatherSpeed.some((w) => w.id === 'excadrill' && w.ability === 'sandrush' && w.setBy.every((s) => s.side === 'theirs')), 'S3');
  const wh = S.speed.weatherSpeed.find((w) => w.id === 'whimsicott' && w.ability === 'chlorophyll');
  assert.ok(wh.setBy.some((s) => s.side === 'mine' && s.id === 'torkoal' && s.via === 'drought' && s.crossSide), 'S3 cross-side by ability');
  assert.ok(!wh.setBy.some((s) => s.side === 'mine' && !s.crossSide), 'S3 no move-based cross-side setter');
  // every row is exactly speedRange under its scenario; Trick Room sorts slowest first; conditions never widen the band
  for (const sc of ['none', 'tw-mine', 'tw-theirs', 'tr']) {
    const rows = T.speed.rows(sc);
    for (const r of rows) {
      const tw = (sc === 'tw-mine' && r.side === 'mine') || (sc === 'tw-theirs' && r.side === 'theirs');
      const x = speedRange(r.base, { tailwind: tw });
      assert.deepEqual([r.min, r.neutralMax, r.max], [x.min, x.neutralMax, x.max], `${sc} ${r.key}`);
      for (const e of r.extensions) assert.ok(e.max > r.max, 'a weather-ability extension sits beyond the band, never merged into it');
    }
    const order = rows.map((r) => (sc === 'tr' ? r.min : r.max));
    assert.deepEqual(order, [...order].sort((p, q) => (sc === 'tr' ? p - q : q - p)), `${sc} order`);
  }
  assert.deepEqual(T.speed.scenarios.map((s) => [s.key, s.enabled]), [['none', true], ['tw-mine', true], ['tw-theirs', true], ['tr', true]]);
  for (const f of T.speed.facts) for (const p of f) if (p.result === 'tie') assert.ok(false, 'a tie needs exact values on both sides');
});

test('Q1–Q2 quick checks: a Mega -ate move uses the converted type and says so; every calc move is legal and labelled ladder or learnable', () => {
  const c = T.threats.find((x) => x.id === 'salamence').checks.find((x) => x.attacker?.ifMega);
  assert.deepEqual([c.attacker.form, c.viaAbility, c.moveType], ['Salamence-Mega', 'aerilate', 'Flying']);
  for (const F of [T, J, N, S]) for (const th of F.threats) for (const k of th.checks ?? []) if (k.kind === 'calc') {
    assert.ok(['prior', 'possible'].includes(k.moveLayer), k.move);
    assert.ok(canLearn(mech, k.attacker.species, k.move), `${k.attacker.species} learns ${k.move}`);
  }
});

test('P1 and L1: from Taro\'s side Charizard is looked at first; lead ideas always show pros and their costs', () => {
  assert.equal(R.key[0], 'charizard');
  for (const F of [T, J, N]) for (const p of F.leadIdeas) { assert.ok(p.pros.length > 0); assert.ok(Array.isArray(p.cons)); }
  assert.ok(J.leadIdeas.some((p) => p.cons.some((c) => c.code === 'pair-shared-weakness')));
});

test('deterministic and complete without optional data: no Reg M-C data, no Cores spec, an empty roster', () => {
  assert.deepEqual(JSON.stringify(brief('Anthony', 'Taro')), JSON.stringify(T));
  const noMech = buildBriefing({ cx: CX, dex: DEX, mech: null, usage: null, mine: side('Anthony'), theirs: side('Taro', 2) });
  assert.equal(noMech.layers.mech, 'loading');
  assert.deepEqual(noMech.speed.scenarios.filter((s) => s.enabled).map((s) => s.key), ['none'], 'no learnsets: only the plain order is offered');
  assert.ok(noMech.threats.every((t) => !t.checks?.some((c) => c.kind === 'calc')), 'no calc move is guessed without the move data');
  assert.equal(noMech.speed.weatherSpeed.length, 0, 'ability conditions need the legal-ability data');
  assert.ok(noMech.threats.every((t) => t.tools.every((x) => x.layer === 'known-if-mega')), 'without the learnsets only a Mega\'s forced ability (dex data) is shown');
  const noCx = buildBriefing({ cx: null, dex: DEX, mech, usage: null, mine: side('Anthony'), theirs: side('Taro', 2) });
  assert.equal(noCx.layers.cores, 'unavailable');
  assert.deepEqual([noCx.theirPlans.length, noCx.myCores.length], [0, 0]);
  assert.ok(noCx.key.length > 0, 'type and Speed pressure still work');
  const empty = buildBriefing({ cx: CX, dex: DEX, mech, usage: null, mine: side('Anthony'), theirs: { name: 'X', order: 2, ids: [], slotsLeft: 10, pointsLeft: 100 }, available: [{ id: 'garchomp', cost: 19 }] });
  assert.deepEqual([empty.threats.length, empty.key.length, empty.theirPlans.length], [0, 0, 0]);
  assert.equal(empty.rosterState.theirSlotsLeft, 10);
  assert.ok(empty.unknowns.includes('their-roster-open'));
  const unknownIds = buildBriefing({ cx: CX, dex: DEX, mech, usage: null, mine: { ...side('Anthony'), ids: ['charizard', 'notamon'] }, theirs: side('Taro', 2) });
  assert.deepEqual(unknownIds.poolMine, ['charizard'], 'an id the dex lacks is left out, not guessed');
});

test('saved sets make a band exact only for the form the set is in; ladder data only adds the "prior" layer', () => {
  const saved = { mine: { charizard: { sp: 32, sign: '+', mega: false } } };
  const B = brief('Anthony', 'Taro', { saved });
  const rows = B.speed.rows('none');
  const zard = rows.find((r) => r.side === 'mine' && r.form === 'Charizard');
  assert.deepEqual([zard.exact, zard.min, zard.max, zard.layer], [true, 167, 167, 'saved']);
  assert.equal(rows.find((r) => r.form === 'Charizard-Mega-Y').exact, false, 'the Mega form is not the saved form');
  const taunt = (F) => F.threats.find((t) => t.id === 'tyranitar').tools.find((x) => x.via === 'taunt')?.layer;
  assert.equal(taunt(T), 'possible', 'learnable, not a ladder key move: "could"');
  const U = brief('Anthony', 'Taro', { usage: { month: '2026-09', species: { tyranitar: { moves: [['Taunt', 40]] } } } });
  assert.equal(taunt(U), 'prior', 'on the ladder this month: "ladder", still not known');
  assert.equal(U.layers.usage, 'ready');
});

test('relevant Speed rows: look-first threats, their shown plans, your useful mons and your 6', () => {
  const ids = relevantSpeedIds(T, { shortlist: ['morpeko'] });
  for (const id of [...T.key, 'morpeko', ...T.promising.map((x) => x.id)]) assert.ok(ids.has(id), id);
});

test('perspective: URL seat, then confirmed identity, then the Draft setting only if that exact name is on the sheet; never a seat fallback', () => {
  const coaches = [{ name: 'Hex', order: 1 }, { name: 'Ning', order: 2 }, { name: 'Anthony', order: 5 }];
  assert.deepEqual(resolvePov({ coaches, urlSeat: 2 }), { name: 'Ning', seat: 2, source: 'url' });
  assert.equal(resolvePov({ coaches, urlSeat: 9 }).name, null);
  assert.deepEqual(resolvePov({ coaches, meta: { myCoach: 'Ning', myCoachConfirmed: true }, hint: { name: 'Anthony', source: 'setting' } }), { name: 'Ning', seat: 2, source: 'identity' });
  assert.deepEqual(resolvePov({ coaches, hint: { name: 'Anthony', source: 'default' } }), { name: 'Anthony', seat: 5, source: 'default' });
  assert.deepEqual(resolvePov({ coaches, hint: { name: 'Anthony', source: 'setting' } }).source, 'setting');
  assert.deepEqual(resolvePov({ coaches, hint: { name: 'Zed', source: 'setting' } }), { name: null, reason: 'no-default' }, 'not on the sheet: no POV (no seat-5 fallback)');
  assert.equal(resolvePov({ coaches, meta: { myCoach: 'Gone', myCoachConfirmed: true }, hint: { name: 'Anthony' } }).reason, 'identity-not-on-sheet');
  assert.equal(resolvePov({ coaches: null, hint: { name: 'Anthony' } }).reason, 'no-sheet');
  assert.equal(resolvePov({ coaches, meta: { myCoach: 'Ning', myCoachConfirmed: false }, hint: { name: 'Anthony', source: 'setting' } }).name, 'Anthony', 'an unconfirmed name is not an identity');
});

test('ownership: a workspace is a perspective\'s only when its pov says so; unassigned ones are listed apart; evidence for a review', () => {
  const W = (id, coach, pov, updatedAt) => ({ id, coach, ...(pov ? { pov } : {}), updatedAt, my6: [], roster: { speciesIds: ROSTERS.Taro.slice(0, 4) } });
  const list = [W('ws_aaaaaaaaaaaa', 'Taro', 'Anthony', '2026-10-01'), W('ws_bbbbbbbbbbbb', 'Taro', 'Anthony', '2026-10-03'), W('ws_cccccccccccc', 'Taro', 'Jacky', '2026-10-04'), W('ws_dddddddddddd', 'Taro', null, '2026-10-02')];
  assert.deepEqual(workspacesFor(list, 'Anthony', 'Taro').map((w) => w.id), ['ws_bbbbbbbbbbbb', 'ws_aaaaaaaaaaaa'], 'newest first; never Jacky\'s or unassigned');
  assert.deepEqual(workspacesFor(list, 'Jacky', 'Taro').map((w) => w.id), ['ws_cccccccccccc']);
  assert.deepEqual(unassignedVs(list, 'Taro').map((w) => w.id), ['ws_dddddddddddd']);
  assert.equal(ownerOf(list[3]), null);
  const mysets = { sets: [{ id: 'set_aaaaaaaaaaaa', speciesId: 'charizard' }, { id: 'set_bbbbbbbbbbbb', speciesId: 'salamence' }] };
  const whoHas = (sp) => Object.keys(ROSTERS).find((n) => ROSTERS[n].includes(sp)) ?? null;
  const ev = legacyEvidence({ ...list[3], my6: [{ setId: 'set_aaaaaaaaaaaa' }], cards: [{ bring4: ['set_bbbbbbbbbbbb'] }], calcs: [{ refs: { attacker: { side: 'mine', setId: 'set_cccccccccccc' } }, scenario: { attacker: { set: { species: 'pelipper' } } } }], theirSets: [{}, {}] },
    { pov: 'Anthony', rosterOf: (n) => ROSTERS[n] ?? [], mysets, whoHas });
  assert.deepEqual(ev.six, ['charizard']);
  assert.deepEqual(ev.yours, ['charizard', 'salamence', 'pelipper'], 'its 6, plan cards and calcs all count as "yours"');
  assert.deepEqual([ev.yoursOnPov, ev.yoursElsewhere], [['charizard', 'pelipper'], [{ id: 'salamence', coach: 'Taro' }]], 'and says whose roster the others are on now');
  assert.deepEqual([ev.counts.calcs, ev.counts.theirSets, ev.snapshotMatches, ev.snapshotSize], [1, 2, 4, 4]);
});

test('speed: a tie is reported only between exact values', () => {
  assert.equal(compareSpeed(100, 100), 'tie');
  assert.equal(compareSpeed({ min: 90, max: 110 }, 100), 'depends');
});

test('S4: "at any investment" holds with your Megas included, and a result a Choice Scarf could change says so (computed, not asserted)', async () => {
  // base Metagross tops out under Aerodactyl's minimum, but Mega Metagross reaches past it: no "faster at any investment"
  const M = buildBriefing({ cx: CX, dex: DEX, mech, usage: null, mine: { name: 'M', ids: ['metagross'] }, theirs: { name: 'A', order: 2, ids: ['aerodactyl'] } });
  const aero = M.threats.find((t) => t.id === 'aerodactyl');
  assert.ok(speedRange(DEX.species.metagross.forms[0].baseStats.spe, {}).max < speedRange(DEX.species.aerodactyl.forms[0].baseStats.spe, {}).min, 'the base forms alone would say "faster"');
  assert.ok(!aero.reasons.some((r) => r.code === 'faster-whatever-spreads'), 'your Mega form is counted');
  // every Scarf caveat is exactly the case where their Scarf range overlaps and flips the comparison
  let caveats = 0;
  for (const F of [T, J, N, R]) for (const list of F.speed.deciding) for (const p of list) {
    if (!p.scarfCaveat) continue;
    caveats++;
    const b = { min: p.bBand[0], max: p.scarfCaveat };
    assert.notEqual(compareSpeed({ min: p.aBand[0], max: p.aBand[2] }, b, { trickRoom: p.trickRoom }), p.result);
    assert.ok(p.result === 'first' || p.result === 'second');
  }
  assert.ok(caveats > 0, 'the fixtures contain such a case');
  const C = await import('../public/prep-copy.js');
  assert.match(C.BRIEF.mechTrickRoom, /takes effect as soon as it's used/);
  assert.match(C.BRIEF.mechTrickRoom, /next 4 turns/);
  assert.match(C.BRIEF.mechTrickRoom, /Priority moves still go first/);
  assert.match(C.BRIEF.reassureText['tr-tailwind'], /move later, not sooner/);
  assert.match(C.BRIEF.verdict.first('A', 'B'), /with no Speed item/);
});

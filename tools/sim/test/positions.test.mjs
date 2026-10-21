// Position tests for the heuristic player (skill 1, no noise): each builds one doubles position by hand and checks the
// choice. Run: node --test tools/sim/test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { position, team } from './helpers.mjs';
import { moveOf } from '../ai/data.mjs';

const A = team('a01'), Z1 = team('z01'), Z3 = team('z03'), Z4 = team('z04');
const why = (r) => `\nchoice: ${r.choice}\n${JSON.stringify(r.note, null, 1)}`;

test('takes a KO when one is available (Dragapult at 20%, just Protected: something hits it)', () => {
  const r = position({ mine: A, theirs: Z1, us: ['charizard', 'kangaskhan'], them: ['metagross', 'dragapult'], mega: ['p1:charizard', 'p2:metagross'], hp: { 'p2:dragapult': 0.2 },
    field: { weather: 'Sun' }, used: { 'p1:kangaskhan': ['fakeout'], 'p2:dragapult': ['protect'] }, bench: ['aegislash', 'sinistcha'] });
  const hitsPult = (a) => !!a.move && moveOf(a.move).category !== 'Status' && (['allAdjacentFoes', 'allAdjacent'].includes(moveOf(a.move).target) || a.target === 2);
  const pr = (r.player.last.final).filter((x) => [0, 1].some((pos) => { const a = x.j[pos]; return a.kind === 'move' && hitsPult({ move: a.move, target: typeof a.target === 'number' ? a.target + 1 : null }); })).reduce((t, x) => t + x.p, 0);
  assert.ok(pr >= 0.6, `p(hits Dragapult) ${pr.toFixed(2)}${why(r)}`);
});

test('Fake Out on turn 1 when legal, never into the Ghost (Morpeko: Metagross, not Dragapult)', () => {
  const r = position({ mine: A, theirs: Z1, us: ['morpeko', 'charizard'], them: ['metagross', 'dragapult'], turn: 1, firstTurn: true, bench: ['aegislash', 'sinistcha'] });
  // a simultaneous-move turn: the player mixes; Fake Out must be its most likely Morpeko play, and only into Metagross
  const fo = r.pOf(0, (a) => a.move === 'fakeout');
  const others = ['aurawheel', 'taunt', 'protect'].map((m) => r.pOf(0, (a) => a.move === m)).concat([r.pOf(0, (a) => !!a.switch)]);
  assert.ok(fo > Math.max(...others), `Fake Out p ${fo.toFixed(2)} vs ${others.map((x) => x.toFixed(2))}${why(r)}`);
  assert.equal(r.pOf(0, (a) => a.move === 'fakeout' && a.target === 2), 0, why(r));
});

test('no Fake Out into Inner Focus or a Ghost (Oranguru + Dragapult)', () => {
  const r = position({ mine: A, theirs: team('z05'), us: ['morpeko', 'charizard'], them: ['oranguru', 'dragapult'], turn: 1, firstTurn: true, bench: ['aegislash', 'sinistcha'] });
  assert.equal(r.pOf(0, (a) => a.move === 'fakeout'), 0, why(r));
});

test('no spread move into its own partner (Toxtricity next to Metagross: no Boomburst)', () => {
  const r = position({ mine: Z1, theirs: A, us: ['toxtricity', 'metagross'], them: ['charizard', 'kangaskhan'], mega: ['p1:metagross', 'p2:charizard'], field: { weather: 'Sun' }, used: { 'p2:kangaskhan': ['fakeout'] }, bench: ['dragapult', 'krookodile'] });
  assert.ok(r.pOf(0, (a) => a.move === 'boomburst') < 0.05, why(r));
});

test('Wide Guard against a known Rock Slide into Mega Charizard Y (Aegislash)', () => {
  const r = position({ mine: A, theirs: Z3, us: ['aegislash', 'charizard'], them: ['krookodile', 'metagross'], mega: ['p1:charizard', 'p2:metagross'], field: { weather: 'Sun' }, bench: ['kangaskhan', 'sinistcha'] });
  const p = r.pOf(0, (a) => a.move === 'wideguard');
  assert.ok(p >= 0.5, `Wide Guard p ${p.toFixed(2)}${why(r)}`);
});

test('Protect beats attacking for the Pokémon about to be KO\'d that can\'t move first (Morpeko at 15%, no Sash, targeted)', () => {
  const r = position({ mine: A, theirs: Z1, us: ['morpeko', 'charizard'], them: ['metagross', 'dragapult'], mega: ['p2:metagross', 'p1:charizard'], hp: { 'p1:morpeko': 0.15 }, gone: ['p1:morpeko'],
    field: { weather: 'Sun' }, used: { 'p1:morpeko': ['aurawheel'] }, bench: ['kangaskhan', 'sinistcha'] });
  const S = snapshot(r.player.T);
  const mv = (side, pos, move, target = null) => ({ kind: 'move', side, pos, move, target });
  const theirs = [mv('p2', 0, 'ironhead', 0), mv('p2', 1, 'shadowball', 1)];
  const v = (m0) => value(resolve(S, [mv('p1', 0, m0, 1), mv('p1', 1, 'heatwave'), ...theirs]), 'p1');
  assert.ok(v('protect') > v('aurawheel'), `protect ${v('protect').toFixed(3)} vs Aura Wheel ${v('aurawheel').toFixed(3)}`);
});

test('never re-sets its own Trick Room', () => {
  const r = position({ mine: A, theirs: Z4, us: ['sinistcha', 'kangaskhan'], them: ['metagross', 'toxtricity'], mega: ['p2:metagross'], field: { tr: 3, trBy: 'p1' }, used: { 'p1:kangaskhan': ['fakeout'] }, bench: ['charizard', 'aegislash'] });
  assert.equal(r.pOf(0, (a) => a.move === 'trickroom'), 0, why(r));
});

test('sets Trick Room when the opposing side is faster and its partner covers it (Sinistcha + Fake Out Kangaskhan)', () => {
  const r = position({ mine: A, theirs: Z1, us: ['sinistcha', 'kangaskhan'], them: ['metagross', 'dragapult'], mega: ['p2:metagross'], bench: ['aegislash', 'charizard'], turn: 1, firstTurn: true });
  const p = r.pOf(0, (a) => a.move === 'trickroom');
  assert.ok(p >= 0.5, `Trick Room p ${p.toFixed(2)}${why(r)}`);
});

test('Last Resort only after Fake Out has been used', () => {
  const r = position({ mine: A, theirs: Z1, us: ['kangaskhan', 'charizard'], them: ['metagross', 'rotomwash'], turn: 2, bench: ['aegislash', 'sinistcha'] });
  assert.equal(r.pOf(0, (a) => a.move === 'lastresort'), 0, why(r));
});

// ---------- VGC Strategy's ZhuZi behaviours (docs/research/strategy/sim/zhuzi-candidates.md §3) ----------
import { snapshot, optionsFor, damage, resolve, value, threat } from '../ai/engine.mjs';

test('Choice lock: a Scarf Krookodile locked into Rock Slide has only Rock Slide (or a switch)', () => {
  const r = position({ mine: A, theirs: Z1, us: ['charizard', 'kangaskhan'], them: ['krookodile', 'metagross'], theirBench: ['dragapult'], locked: { 'p2:krookodile': 'rockslide' }, used: { 'p1:kangaskhan': ['fakeout'] }, bench: ['aegislash', 'sinistcha'] });
  const opts = optionsFor(snapshot(r.player.T), 'p2', 0);
  assert.deepEqual([...new Set(opts.map((o) => o.move ?? o.kind))].sort(), ['rockslide', 'switch']);
});

test('Instruct repeats the partner\'s Overdrive when Oranguru moves after it (and is worth more than Psychic there)', () => {
  const r = position({ mine: Z4, theirs: A, us: ['oranguru', 'toxtricity'], them: ['charizard', 'sinistcha'], mega: ['p2:charizard'], hp: { 'p2:charizard': 0.7, 'p2:sinistcha': 0.6 }, bench: ['metagross', 'slowkinggalar'] });
  const S = snapshot(r.player.T);
  const mv = (side, pos, move, target = null) => ({ kind: 'move', side, pos, move, target });
  const theirs = [mv('p2', 0, 'protect'), mv('p2', 1, 'ragepowder')];
  const R = resolve(S, [mv('p1', 0, 'instruct', 'ally'), mv('p1', 1, 'overdrive'), ...theirs]);
  assert.equal(R.log.filter((l) => /Toxtricity Overdrive → Sinistcha/.test(l)).length, 2, R.log.join('\n'));
  // a second Overdrive KOs both Mega Charizard and a chipped Kangaskhan; Psychic doesn't
  const r2 = position({ mine: Z4, theirs: A, us: ['oranguru', 'toxtricity'], them: ['charizard', 'kangaskhan'], mega: ['p2:charizard'], hp: { 'p2:kangaskhan': 0.6 }, bench: ['metagross', 'slowkinggalar'] });
  const S2 = snapshot(r2.player.T);
  const idle = [{ kind: 'pass', side: 'p2', pos: 0 }, { kind: 'pass', side: 'p2', pos: 1 }];
  const v = (m0, t) => value(resolve(S2, [mv('p1', 0, m0, t), mv('p1', 1, 'overdrive'), ...idle]), 'p1');
  assert.ok(v('instruct', 'ally') > v('psychic', 1), `Instruct ${v('instruct', 'ally').toFixed(3)} vs Psychic ${v('psychic', 1).toFixed(3)}`);
});

test('Chilly Reception sets snow, pivots out, and cuts the sun team\'s threat', () => {
  const r = position({ mine: team('z07'), theirs: A, us: ['slowkinggalar', 'metagross'], them: ['charizard', 'sinistcha'], mega: ['p2:charizard', 'p1:metagross'], field: { weather: 'Sun', weatherTurns: 4 }, bench: ['dragapult', 'krookodile'] });
  const S = snapshot(r.player.T);
  const mv = (side, pos, move, target = null) => ({ kind: 'move', side, pos, move, target });
  const R = resolve(S, [mv('p1', 0, 'chillyreception'), mv('p1', 1, 'protect'), mv('p2', 0, 'protect'), mv('p2', 1, 'protect')]);
  assert.equal(R.field.weather, 'Snow');
  assert.notEqual(R.mons[R.active.p1[0]].set.species, 'slowkinggalar');
  assert.ok(threat(R, 'p2') < threat(resolve(S, [mv('p1', 0, 'protect'), mv('p1', 1, 'protect'), mv('p2', 0, 'protect'), mv('p2', 1, 'protect')]), 'p2'));
});

test('Stance Change: Aegislash takes far more from Foul Play in Blade form than in Shield form', () => {
  const r = position({ mine: A, theirs: team('z09'), us: ['aegislash', 'charizard'], them: ['umbreon', 'metagross'], bench: ['kangaskhan', 'sinistcha'] });
  const S = snapshot(r.player.T);
  const ae = S.mons[S.active.p1[0]], um = S.mons[S.active.p2[0]];
  const shield = damage(S, um, { ...ae, form: 'shield' }, 'foulplay'), blade = damage(S, um, { ...ae, form: 'blade', key: 'x' }, 'foulplay');
  assert.ok(blade.max > 1.5 * shield.max, `${JSON.stringify({ shield, blade })}`);
});

test('Foul Play avoidance: Aegislash mostly shields or stays out of Umbreon\'s Foul Play range', () => {
  const r = position({ mine: A, theirs: team('z09'), us: ['aegislash', 'charizard'], them: ['umbreon', 'metagross'], mega: ['p1:charizard', 'p2:metagross'], field: { weather: 'Sun' }, bench: ['kangaskhan', 'sinistcha'] });
  const attacks = r.pOf(0, (a) => !!a.move && moveOf(a.move).category !== 'Status');
  assert.ok(attacks <= 0.6, `Aegislash attacks p ${attacks.toFixed(2)}${why(r)}`);
});

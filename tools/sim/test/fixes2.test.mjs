// VGC Strategy's second round (sim bug + misplays): Mimicry refusals, semi-invulnerable turns, Mega switching, Sucker Punch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { position, team } from './helpers.mjs';
import { snapshot, damage, resolve, value, optionsFor, calcStats } from '../ai/engine.mjs';

const mv = (side, pos, move, target = null) => ({ kind: 'move', side, pos, move, target });
const pass = (side, pos) => ({ kind: 'pass', side, pos });
const why = (r) => `\nchoice: ${r.choice}\n${JSON.stringify(r.note, null, 1)}`;

test('Mimicry (lib/calc refuses it): Stunfisk-Galar takes and deals real damage, and the refusal is counted', () => {
  const before = calcStats.refusals['mechanic-unsupported:type-change'] ?? 0;
  const r = position({ mine: team('a02'), theirs: team('z01'), us: ['stunfiskgalar', 'charizard'], them: ['metagross', 'krookodile'], mega: ['p1:charizard', 'p2:metagross'], bench: ['aegislash', 'kangaskhan'] });
  const S = snapshot(r.player.T);
  const st = S.mons[S.active.p1[0]], mg = S.mons[S.active.p2[0]], kr = S.mons[S.active.p2[1]];
  const hh = damage(S, kr, st, 'highhorsepower'), pf = damage(S, mg, st, 'psychicfangs'), out = damage(S, st, mg, 'stompingtantrum');
  assert.ok(hh.min > 0.6, `Krookodile High Horsepower → Stunfisk ${JSON.stringify(hh)} (super effective on Ground/Steel)`);
  assert.ok(pf.max > 0.1 && pf.max < hh.min, `Psychic Fangs is resisted: ${JSON.stringify(pf)}`);
  assert.ok(out.min > 0.3, `Stunfisk Stomping Tantrum → Mega Metagross ${JSON.stringify(out)}`);
  assert.ok((calcStats.refusals['mechanic-unsupported:type-change'] ?? 0) > before);
});

test('semi-invulnerable: attacks into a charging Phantom Force miss until it hits; the hit breaks Protect / King\'s Shield', () => {
  // Trick Room up, so Charizard (146) moves before Dragapult finishes its Phantom Force
  const r = position({ mine: team('a01'), theirs: team('z12'), us: ['charizard', 'aegislash'], them: ['dragapult', 'metagross'], mega: ['p1:charizard', 'p2:metagross'], field: { weather: 'Sun', tr: 3, trBy: 'p1' }, bench: ['kangaskhan', 'sinistcha'] });
  const T = r.player.T;
  T.mons.p2.find((m) => m.set.species === 'dragapult').charging = 'phantomforce';
  const S = snapshot(T);
  assert.deepEqual([...new Set(optionsFor(S, 'p2', 0).filter((o) => o.kind === 'move').map((o) => o.move))], ['phantomforce'], 'it can only finish the move');
  // Charizard Weather Balls the charging Dragapult first: misses; Aegislash King's Shields: Phantom Force goes through
  const R = resolve(S, [mv('p1', 0, 'weatherball', 0), mv('p1', 1, 'kingsshield'), mv('p2', 0, 'phantomforce', 1), pass('p2', 1)]);
  assert.ok(R.log.some((l) => /misses \(semi-invulnerable\)/.test(l)), R.log.join('\n'));
  assert.ok(R.log.some((l) => /breaks Aegislash's protection/.test(l)), R.log.join('\n'));
  assert.ok(R.mons[S.active.p1[1]].hp < 1, 'Aegislash took the Phantom Force');
  assert.ok(R.mons[S.active.p2[0]].hp >= 0.89, 'Dragapult untouched (only its own Life Orb recoil)');
});

test('the first turn of Phantom Force only charges (no damage) and makes the user untargetable for the rest of the turn', () => {
  const r = position({ mine: team('a01'), theirs: team('z12'), us: ['charizard', 'aegislash'], them: ['dragapult', 'metagross'], mega: ['p1:charizard', 'p2:metagross'], field: { weather: 'Sun' }, bench: ['kangaskhan', 'sinistcha'] });
  const S = snapshot(r.player.T);
  const R = resolve(S, [pass('p1', 0), mv('p1', 1, 'poltergeist', 0), mv('p2', 0, 'phantomforce', 1), pass('p2', 1)]);
  assert.equal(R.mons[S.active.p1[1]].hp, 1, R.log.join('\n'));
  assert.ok(R.log.some((l) => /charges Phantom Force/.test(l)) && R.log.some((l) => /misses/.test(l)), R.log.join('\n'));
});

test('Mega switching: a 33% Kangaskhan isn\'t switched for the evolved Charizard into Psychic Fangs + Close Combat', () => {
  const r = position({ mine: team('a01'), theirs: team('z01'), us: ['kangaskhan', 'aegislash'], them: ['metagross', 'infernape'], mega: ['p1:charizard', 'p2:metagross'],
    hp: { 'p1:kangaskhan': 0.33, 'p1:charizard': 0.6 }, used: { 'p1:kangaskhan': ['fakeout'], 'p2:infernape': ['fakeout'] }, bench: ['charizard', 'sinistcha'] });
  const p = r.pOf(0, (a) => a.switch === 'charizard');
  assert.ok(p < 0.1, `switch to Charizard p ${p.toFixed(2)}${why(r)}`);
  // the model charges a switch-in for the hits its slot faces, and an evolved Mega switched out costs extra
  const S = snapshot(r.player.T);
  const toZard = { kind: 'switch', side: 'p1', pos: 0, to: Object.values(S.mons).find((m) => m.side === 'p1' && m.set.species === 'charizard').key };
  const theirs = [mv('p2', 0, 'psychicfangs', 0), mv('p2', 1, 'closecombat', 0)];
  const stay = value(resolve(S, [mv('p1', 0, 'protect'), mv('p1', 1, 'kingsshield'), ...theirs]), 'p1');
  const swap = value(resolve(S, [toZard, mv('p1', 1, 'kingsshield'), ...theirs]), 'p1');
  assert.ok(swap < stay, `switching Charizard into the double target ${swap.toFixed(3)} vs Protect ${stay.toFixed(3)}`);
});

test('Sucker Punch: fails into Protect or a status move, hits an attacker that hasn\'t moved', () => {
  const r = position({ mine: team('a05'), theirs: team('z04'), us: ['kangaskhan', 'charizard'], them: ['oranguru', 'toxtricity'], used: { 'p1:kangaskhan': ['fakeout'] }, bench: ['aegislash', 'sinistcha'] });
  const S = snapshot(r.player.T);
  const run = (theirMove) => resolve(S, [mv('p1', 0, 'suckerpunch', 0), pass('p1', 1), theirMove, pass('p2', 1)]);
  assert.ok(run(mv('p2', 0, 'trickroom')).log.some((l) => /Sucker Punch fails/.test(l)), 'status move: fails');
  assert.ok(run(mv('p2', 0, 'protect')).log.some((l) => /Sucker Punch fails/.test(l)), 'Protect: fails');
  assert.ok(run(mv('p2', 0, 'psychic', 0)).log.some((l) => /Sucker Punch → Oranguru/.test(l)), 'an attack: hits');
});

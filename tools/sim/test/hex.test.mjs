// Week 4 (Hex) rules: Psychic Terrain blocks priority into grounded targets; Expanding Force is a boosted spread move from a
// grounded user in the terrain. Run: node --test tools/sim/test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { position } from './helpers.mjs';
import { setsFromText } from '../ai/data.mjs';
import { damage, spreadMove, grounded } from '../ai/engine.mjs';

const require = createRequire(import.meta.url);
const HEX = require('../candidates/hex.json');
const team = (id) => [...HEX.ours.teams, ...HEX.opponent.teams].find((t) => t.id === id).team;
const why = (r) => `\nchoice: ${r.choice}\n${JSON.stringify(r.note, null, 1)}`;
const mon = (text, species, side) => ({ set: setsFromText(text).find((s) => s.species === species), side, key: `${side}:${species}`, mega: false, boosts: {}, status: '', hp: 1, form: '', itemGone: false });

test('Psychic Terrain: no Fake Out / Sucker Punch into grounded Indeedee-F', () => {
  const r = position({ mine: team('o01'), theirs: team('h01'), us: ['kangaskhan', 'aegislash'], them: ['indeedeef', 'rotomheat'], turn: 1, firstTurn: true,
    field: { terrain: 'Psychic' }, bench: ['charizard', 'sinistcha'] });
  assert.equal(r.pOf(0, (a) => ['fakeout', 'suckerpunch'].includes(a.move) && a.target === 1), 0, why(r));
  assert.equal(r.pOf(1, (a) => a.move === 'shadowsneak' && a.target === 1), 0, why(r));
});

test('grounded: Levitate Rotom-Heat and Flying Corviknight are not; Indeedee-F and Armarouge are', () => {
  const t = team('h01');
  assert.equal(grounded(mon(t, 'rotomheat', 'p2')), false);
  assert.equal(grounded(mon(t, 'corviknight', 'p2')), false);
  assert.equal(grounded(mon(t, 'indeedeef', 'p2')), true);
  assert.equal(grounded(mon(t, 'armarouge', 'p2')), true);
});

test('Expanding Force: spread in Psychic Terrain, and a real calc (not an estimate) into a lone target', () => {
  const S = { field: { weather: '', terrain: 'Psychic' }, side: { p1: {}, p2: {} } };
  const arma = mon(team('h01'), 'armarouge', 'p2'), kanga = mon(team('o01'), 'kangaskhan', 'p1');
  assert.equal(spreadMove(S, arma, 'expandingforce'), true);
  assert.equal(spreadMove({ ...S, field: { weather: '', terrain: '' } }, arma, 'expandingforce'), false);
  const lone = damage(S, arma, kanga, 'expandingforce', { spread: false }), both = damage(S, arma, kanga, 'expandingforce', { spread: true });
  assert.equal(lone.approx, undefined, JSON.stringify(lone));
  assert.ok(lone.min > 0.3, `lone ${JSON.stringify(lone)}`);
  assert.ok(Math.abs(both.min / lone.min - 0.75) < 0.02, `spread ${both.min} vs lone ${lone.min}`);
});

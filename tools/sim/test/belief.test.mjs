// Closed-sheet beliefs from a pool (sheets.pool + player.revise): before anything shows, his Pokémon is its most likely
// set; once the game reveals an item, a Mega, a move or a non-locked second move, the belief moves to a set that fits.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HeuristicPlayer } from '../ai/player.mjs';
import { Tracker } from '../ai/tracker.mjs';
import { pool } from '../sheets.mjs';

const chomp = (item, nature, ev, moves) => `Garchomp @ ${item}\nAbility: Rough Skin\nLevel: 50\nEVs: 2 HP / 32 ${ev} / 32 Spe\n${nature} Nature\n${moves.map((m) => `- ${m}`).join('\n')}`;
const MEGA = chomp('Garchompite Z', 'Modest', 'SpA', ['Draco Meteor', 'Earth Power', 'Power Gem', 'Protect']);
const LO = chomp('Life Orb', 'Jolly', 'Atk', ['Dragon Claw', 'Rock Slide', 'Earthquake', 'Protect']);
const SCARF = chomp('Choice Scarf', 'Jolly', 'Atk', ['Dragon Claw', 'Rock Slide', 'Earthquake', 'Stomping Tantrum']);
const MINE = 'Incineroar @ Sitrus Berry\nAbility: Intimidate\nLevel: 50\nEVs: 32 HP\nCareful Nature\n- Fake Out\n- Flare Blitz\n- Parting Shot\n- Protect';
const dummy = { write() {}, async *[Symbol.asyncIterator]() {} };

function game(lines) {
  const p = new HeuristicPlayer(dummy, { mine: MINE, theirs: MEGA, seed: 1,
    beliefPool: pool([{ text: MEGA, weight: 0.6 }, { text: SCARF, weight: 0.25 }, { text: LO, weight: 0.15 }]) });
  p.me = 'p1'; p.T = new Tracker({ p1: p.mine, p2: p.theirs });
  for (const l of ['|switch|p1a: Incineroar|Incineroar, L50|100/100', '|switch|p2a: Garchomp|Garchomp, L50|100/100', ...lines]) p.T.line(l);
  p.revise();
  return p.T.mons.p2[0].set;
}

test('nothing shown: the most likely set (here the Mega)', () => { assert.equal(game([]).item, 'garchompitez'); });
test('a Life Orb hit shows the item: the Life Orb set', () => {
  assert.equal(game(['|move|p2a: Garchomp|Rock Slide|p1a: Incineroar|[spread] p1a', '|-damage|p2a: Garchomp|90/100|[from] item: Life Orb']).item, 'lifeorb');
});
test('a physical move the Mega set lacks: the most likely set that has it (Scarf)', () => {
  assert.equal(game(['|move|p2a: Garchomp|Earthquake|p1a: Incineroar|[spread] p1a']).item, 'choicescarf');
});
test('two different moves in one stint rule out a Choice item', () => {
  assert.equal(game(['|move|p2a: Garchomp|Earthquake|p1a: Incineroar', '|turn|2', '|move|p2a: Garchomp|Dragon Claw|p1a: Incineroar']).item, 'lifeorb');
});
test('Mega Evolving keeps the Mega set even against a physical-only reveal', () => {
  assert.equal(game(['|detailschange|p2a: Garchomp|Garchomp-Mega-Z, L50', '|-mega|p2a: Garchomp|Garchomp|Garchompite Z']).item, 'garchompitez');
});

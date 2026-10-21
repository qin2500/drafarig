// Whole games: deterministic per seed, no invalid choices, and the summary the runner records.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playGame } from '../game.mjs';
import { team } from './helpers.mjs';

const strip = (log) => log.replace(/\|t:\|\d+/g, '');
const A = { text: team('a01'), ai: 'heuristic', name: 'Ours' }, Z = { text: team('z04'), ai: 'heuristic', name: 'Theirs' };

test('the same seed plays the same game, move for move; another seed differs', async () => {
  const [x, y, z] = [await playGame(A, Z, 5, { keepLog: true }), await playGame(A, Z, 5, { keepLog: true }), await playGame(A, Z, 6, { keepLog: true })];
  assert.equal(strip(x.log), strip(y.log));
  assert.notEqual(strip(x.log), strip(z.log));
});

test('heuristic games finish with no invalid choices; the summary has both sides\' four and leads', async () => {
  for (const seed of [1, 2, 3]) {
    const r = await playGame(A, Z, seed);
    assert.ok(['p1', 'p2', 'tie'].includes(r.winner));
    assert.equal(r.errors, 0, `seed ${seed}`);
    for (const s of ['p1', 'p2']) { assert.ok(r.summary[s].brought.length >= 2 && r.summary[s].brought.length <= 4); assert.equal(r.summary[s].leads.length, 2); }
  }
});

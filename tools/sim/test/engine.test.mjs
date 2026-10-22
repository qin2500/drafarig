// The search engine: full games run clean (no crashes, no choice the forward model rejects), and determinization
// hides what a closed team sheet hides.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { playGame } from '../game.mjs';
import { team } from './helpers.mjs';
import { PS, FORMAT, packTeam } from '../ai/data.mjs';
import { EnginePlayer } from '../engine/player.mjs';
import { beliefText, library } from '../sheets.mjs';

const C1 = readFileSync(new URL('../candidates/r5/c1.txt', import.meta.url), 'utf8');

test('engine vs engine, closed sheets: games finish with no errors or rejected choices', async () => {
  for (const [z, seed] of [['z01', 3], ['z08', 4]]) {
    const r = await playGame({ text: C1, ai: 'engine', name: 'Ours', sheets: 'closed', samples: 1 }, { text: team(z), ai: 'engine', name: 'Theirs', sheets: 'closed', samples: 1 }, seed);
    assert.ok(['p1', 'p2', 'tie'].includes(r.winner));
    assert.equal(r.errors, 0, `errors in ${z}`);
    for (const s of ['p1', 'p2']) { assert.ok(r.engine[s].decisions > 0); assert.equal(r.engine[s].fallbacks, 0, `${s} fallbacks in ${z}`); }
  }
});

test('determinize: his unrevealed back is resampled from his six; revealed sets take our beliefs, not his real ones', () => {
  const Z = team('z03'); // Life Orb Adamant Krookodile (rock set); the closed-sheet belief is the Scarf set
  const b = new PS.Battle({ formatid: FORMAT, seed: [1, 2, 3, 4] });
  b.setPlayer('p1', { name: 'Ours', team: packTeam(C1) }); b.setPlayer('p2', { name: 'Theirs', team: packTeam(Z) });
  b.choose('p1', 'team 1234'); b.choose('p2', 'team 4123'); // his Krookodile leads
  const lib = library(JSON.parse(readFileSync(new URL('../candidates/zhuzi.json', import.meta.url), 'utf8')).opponent.teams.map((t) => ({ text: t.team, weight: t.weight })));
  const p = new EnginePlayer({ write() {}, async *[Symbol.asyncIterator]() {} }, { mine: C1, theirs: beliefText(Z, 'closed', lib), seed: 1, sheets: 'closed', battle: () => b });
  p.me = 'p1';
  const d = PS.Battle.fromJSON(p.determinize(b));
  const krook = d.sides[1].pokemon.find((x) => x.species.id === 'krookodile');
  assert.equal(krook.item, 'choicescarf', 'belief item, not his real Life Orb');
  const real = b.sides[1].pokemon.find((x) => x.species.id === 'krookodile');
  assert.equal(real.item, 'lifeorb', 'the live battle is untouched');
  assert.equal(d.sides[1].pokemon.length, 4);
});

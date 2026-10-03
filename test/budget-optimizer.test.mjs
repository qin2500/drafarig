import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cheapestSum, budgetSummary, affordability } from '../lib/budget.mjs';
import { topRosters, buildPlans, checkPick, whyChips } from '../lib/optimizer.mjs';
import { buildLeague } from '../lib/league.mjs';
import { rosterScore, roleCredit, weaknessMatrix, effectiveness, speedStat, synergies } from '../lib/analysis.mjs';

const fx = (n) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');
const dex = JSON.parse(readFileSync(new URL('../data/dex.json', import.meta.url), 'utf8'));
const L = buildLeague({ boardCsv: fx('board.csv'), draftsCsv: fx('drafts.csv'), boardHtml: fx('board.html') }, dex);
const avail = L.board.filter((b) => !b.taken && b.id).map((b) => ({ id: b.id, cost: b.points }));
const anthony = L.coaches.find((c) => c.name === 'Anthony');

test('cheapestSum skips the candidate and reports impossibility', () => {
  assert.equal(cheapestSum(2, [1, 1, 2, 5]), 2);
  assert.equal(cheapestSum(2, [1, 1, 2, 5], 0), 3);
  assert.equal(cheapestSum(5, [1, 1]), Infinity);
  assert.equal(cheapestSum(0, []), 0);
});

test('budget summary for Anthony: 29 pts, 6 slots, max 24 this pick', () => {
  const b = budgetSummary(29, 6, avail.map((a) => a.cost));
  assert.deepEqual([b.pointsLeft, b.slotsLeft, b.avgPerSlot, b.reserve, b.maxThisPick, b.feasible], [29, 6, 4.8, 5, 24, true]);
});

test('feasibility rule: pick allowed iff pointsLeft − cost ≥ cheapest (slots − 1) others', () => {
  const pool = [{ id: 'a', cost: 1 }, { id: 'b', cost: 1 }, { id: 'c', cost: 3 }, { id: 'd', cost: 8 }, { id: 'e', cost: 9 }];
  const r = Object.fromEntries(affordability(pool, 10, 3).map((x) => [x.id, x.status]));
  // 3 slots, 10 pts: taking d (8) leaves 2 for 2 slots (a+b = 2) -> allowed but tight; e (9) leaves 1 < 2 -> breaks
  assert.deepEqual(r, { a: 'ok', b: 'ok', c: 'ok', d: 'tight', e: 'breaks' });
  // when the 1-pt mons run out, the reserve rises
  // 2 slots, 10 pts, cheapest other mon costs 3 -> max this pick is 7, not 9
  const r2 = Object.fromEntries(affordability([{ id: 'c', cost: 3 }, { id: 'd', cost: 3 }, { id: 'e', cost: 8 }], 10, 2).map((x) => [x.id, x.status]));
  assert.deepEqual(r2, { c: 'ok', d: 'ok', e: 'breaks' });
  assert.equal(budgetSummary(10, 2, [3, 3, 8]).maxThisPick, 7);
  // not enough mons left at all
  assert.equal(affordability([{ id: 'x', cost: 1 }], 50, 3)[0].status, 'breaks');
  // full roster -> nothing allowed
  assert.equal(affordability([{ id: 'x', cost: 1 }], 50, 0)[0].status, 'breaks');
});

test('live board: Anthony can afford every tier up to 20, and the breaks message has the math', () => {
  const a = affordability(avail, 29, 6);
  assert.equal(a.filter((x) => x.status === 'breaks').length, 0);
  const tight = affordability(avail, 8, 6).filter((x) => x.status === 'breaks');
  assert.ok(tight.length > 0);
  assert.match(tight[0].reason, /you can spend at most 3/);
});

test('topRosters matches brute force (exact count, budget cap, each item once)', () => {
  const items = Array.from({ length: 14 }, (_, i) => ({ cost: 1 + ((i * 7) % 9), score: (i * 13) % 11 }));
  const bf = [];
  const rec = (s, k, c, sc) => { if (k === 0) { bf.push(sc); return; } for (let i = s; i < items.length; i++) if (c + items[i].cost <= 20) rec(i + 1, k - 1, c + items[i].cost, sc + items[i].score); };
  rec(0, 4, 0, 0);
  bf.sort((a, b) => b - a);
  const dp = topRosters(items, 4, 20, 5).slice(0, 5);
  assert.deepEqual(dp.map((r) => r.score), bf.slice(0, 5));
  for (const r of dp) { assert.equal(r.picks.length, 4); assert.equal(new Set(r.picks).size, 4); assert.ok(r.cost <= 20); }
});

test('plans for Anthony: complete, affordable, available-only, diverse, explained', () => {
  const opponents = L.coaches.filter((c) => c.name !== 'Anthony').map((c) => ({ coach: c.name, ids: c.picks.map((p) => p.id) }));
  const t0 = performance.now();
  const P = buildPlans(dex, anthony.picks.map((p) => p.id), avail, 6, 29, { opponents });
  assert.ok(performance.now() - t0 < 5000);
  assert.equal(P.plans.length, 3);
  const free = new Set(avail.map((a) => a.id));
  const firsts = new Set();
  for (const p of P.plans) {
    assert.equal(p.picks.length, 6);
    assert.ok(p.cost <= 29);
    assert.ok(p.picks.every((x) => free.has(x.id)));
    assert.equal(new Set(p.picks.map((x) => dex.species[x.id].num)).size, 6, 'no species-clause duplicates in a plan');
    assert.ok(p.picks.every((x) => x.why.length > 0));
    firsts.add(p.picks[0].id);
  }
  assert.equal(firsts.size, 3, 'each plan starts with a different pick');
});

test('scoring: species-clause duplicates and redundant roles are penalised', () => {
  const base = ['charizard', 'sinistcha', 'pelipper', 'kangaskhan'];
  const one = rosterScore(dex, [...base, 'tauros']).total;
  const two = rosterScore(dex, [...base, 'tauros', 'taurospaldeacombat']).total;
  assert.ok(two < one + 1, 'second Tauros should add almost nothing');
  assert.ok(roleCredit(4, 1, 5) <= 5 * 1.5);
  assert.ok(roleCredit(4, 1, 5) - roleCredit(3, 1, 5) < 0.2, '4th holder adds ~nothing');
});

test('type matchups include Mega forms and single-ability immunities', () => {
  const row = weaknessMatrix(dex, ['charizard']).find((r) => r.type === 'Rock');
  assert.deepEqual(row.cells[0].forms.map((f) => f.mult), [4, 2, 4]); // base, Mega X, Mega Y
  assert.equal(effectiveness(dex, 'Ground', dex.species.rotomwash.forms[0]), 0); // Levitate
  assert.equal(speedStat(102, 'max'), 169); // Garchomp, matches @smogon/calc Champions
  assert.equal(speedStat(30, 'min'), 45);
});

test('check a pick: compares the best roster built around it with the best plan', () => {
  const ids = anthony.picks.map((p) => p.id);
  const opponents = L.coaches.filter((c) => c !== anthony).map((c) => ({ coach: c.name, ids: c.picks.map((p) => p.id).filter(Boolean) }));
  const rosterCosts = Object.fromEntries(anthony.picks.map((p) => [p.id, p.points]));
  const best = buildPlans(dex, ids, avail, 6, 29, { opponents, rosterCosts });
  const check = (id) => checkPick(dex, ids, avail, 6, 29, id, { best, opponents, rosterCosts });
  // Each plan's first pick is, by construction, about as good as the best plan.
  assert.equal(check(best.plans[0].picks[0].id).verdict, 'great');
  const r = check('kingambit');
  assert.equal(r.rest.length, 5);
  assert.ok(r.cost + r.rest.reduce((s, p) => s + p.cost, 0) <= 29);
  assert.ok(!r.rest.some((p) => p.id === 'kingambit'));
  assert.ok(r.why.length > 0 && r.rank >= 1);
  assert.equal(check('garchomp').verdict, 'unavailable'); // drafted by Hex
  assert.equal(checkPick(dex, ids, [{ id: 'kingambit', cost: 18 }, { id: 'pikachu', cost: 1 }], 2, 18, 'kingambit').verdict, 'breaks');
});

test('synergy: setters need partners; built-for-it abilities count as strong partners', () => {
  const base = ['charizard', 'sinistcha', 'pelipper', 'kangaskhan'];
  const s = Object.fromEntries(synergies(dex, base).map((x) => [x.key, x]));
  assert.deepEqual([s.sun.status, s.rain.status, s.tr.status, s.sand.status], ['none', 'none', 'none', 'off']);
  const rain = synergies(dex, ['pelipper', 'basculegion']).find((x) => x.key === 'rain');
  assert.deepEqual([rain.partners[0].why, rain.partners[0].strength], ['Swift Swim', 1]);
  assert.equal(synergies(dex, ['sinistcha', 'snorlax']).find((x) => x.key === 'tr').partners[0].strength, 1); // base Speed 30
  // A partner without its setter is worth nothing; with it, the roster score goes up.
  assert.equal(synergies(dex, ['basculegion']).find((x) => x.key === 'rain').credit, 0);
  assert.ok(rosterScore(dex, [...base, 'basculegion']).synergy > rosterScore(dex, base).synergy);
  assert.match(whyChips(dex, base, 'basculegion').join(' '), /Uses your rain \(Swift Swim\)/);
});

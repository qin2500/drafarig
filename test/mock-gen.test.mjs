// The mock generator (lib/mock-gen.mjs): its best six is the true maximum of scoreSix over every legal six (checked by a
// naive brute force over all 6-subsets of the candidates), and every variant keeps the species clause (Rotom forms share a
// dex number), at most one Mega, the item clause, and a label on every set.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mech, newCalc } from './calc-helpers.mjs';
import { generateMock, scoreSix, legalSix, setsOf, cohere } from '../lib/mock-gen.mjs';
import { buildLeague } from '../lib/league.mjs';
import jacky from '../lib/mocks/4v8.mjs';

const raw = JSON.parse(readFileSync(new URL('../docs/research/strategy/sp-assist/usage-regmc-2026-09-league.json', import.meta.url), 'utf8')).species;
const sorted = (o) => Object.entries(o ?? {}).sort((a, b) => b[1] - a[1]);
const usage = { month: 'test', species: Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, { spreads: sorted(v.spreads), items: sorted(v.items), abilities: sorted(v.abilities), moves: sorted(v.moves) }])) };

function* combos(arr, k, start = 0, pick = []) {
  if (pick.length === k) { yield pick; return; }
  for (let i = start; i <= arr.length - (k - pick.length); i++) yield* combos(arr, k, i + 1, [...pick, arr[i]]);
}

test('generator: best six = brute-force max; species clause (Rotom forms), one Mega, item clause, labels', () => {
  const xPool = jacky.rosters.x, yPool = jacky.rosters.y;
  assert.ok(xPool.includes('rotom') && xPool.includes('rotommow'), 'the fixture has two Rotom forms');
  const r = generateMock(newCalc(), mech, { xPool, yPool, usage });
  const a = r.analysis;
  let best = -Infinity;
  for (const six of combos(a.cands, 6)) {
    const nums = six.map((c) => mech.species[mech.species[c.forme]?.mega?.from ?? c.forme].num);
    if (new Set(nums).size !== 6 || six.filter((c) => c.mega).length > 1) continue;
    assert.ok(legalSix(mech, six));
    best = Math.max(best, scoreSix(a, six));
  }
  assert.ok(Number.isFinite(best));
  assert.ok(Math.abs(r.variants[0].score - best) < 1e-9, `generator ${r.variants[0].score} vs brute force ${best}`);
  assert.ok(r.variants.length >= 2);
  for (const v of r.variants) {
    const sets = setsOf(v.six);
    assert.equal(sets.length, 6);
    const nums = v.six.map((c) => mech.species[c.species].num);
    assert.equal(new Set(nums).size, 6, `${v.name}: species clause`);
    assert.ok(!(v.six.some((c) => c.species === 'rotom') && v.six.some((c) => c.species === 'rotommow')), 'never both Rotoms');
    assert.ok(v.six.filter((c) => c.mega).length <= 1, `${v.name}: one Mega`);
    const items = sets.map((s) => s.set.item).filter(Boolean);
    assert.equal(new Set(items).size, items.length, `${v.name}: item clause`);
    for (const s of sets) {
      assert.ok(['ladder', 'tuned', 'worst', 'yours'].includes(s.label), s.label);
      assert.ok(s.set.moves.length >= 1, `${s.set.species} has moves`);
      assert.ok(Object.values(s.set.sp).reduce((t, n) => t + n, 0) <= 66, `${s.set.species} SP ≤ 66`);
    }
  }
  // no drafted mon is dropped from consideration for lacking ladder data
  for (const id of xPool) assert.ok(a.cands.some((c) => c.species === id || mech.species[c.species]?.num === mech.species[id]?.num), id);
});

test('generator: your own guess replaces the ladder set and is labelled "yours"', () => {
  const xPool = jacky.rosters.x, yPool = jacky.rosters.y;
  const g = { species: 'farigiraf', item: 'sitrusberry', ability: 'armortail', nature: 'relaxed', moves: ['trickroom', 'psychic', 'protect', 'helpinghand'], sp: { hp: 32, atk: 0, def: 32, spa: 2, spd: 0, spe: 0 } };
  const r = generateMock(newCalc(), mech, { xPool, yPool, usage, guesses: new Map([['farigiraf', g]]) });
  const c = r.analysis.cands.find((x) => x.species === 'farigiraf');
  assert.equal(c.label, 'yours');
  assert.equal(c.set.nature, 'relaxed');
});

const SPREAD = ['allAdjacent', 'allAdjacentFoes'];
/** The coherence rules, as problems: Choice + a status move; two damaging moves of one type without a clear spread / single-target split. */
function incoherent(set) {
  const bad = [];
  const mv = set.moves.map((m) => ({ id: m, ...mech.moves[m] }));
  if (/^choice/.test(set.item)) for (const m of mv) if (m.category === 'Status') bad.push(`${set.species}: ${set.item} with ${m.id}`);
  const dmg = mv.filter((m) => m.category !== 'Status');
  for (let i = 0; i < dmg.length; i++) for (let j = i + 1; j < dmg.length; j++) {
    const a = dmg[i], b = dmg[j];
    if (a.type !== b.type) continue;
    const [sp, st] = SPREAD.includes(a.target) ? [a, b] : [b, a];
    if (!(SPREAD.includes(sp.target) && !SPREAD.includes(st.target) && st.basePower >= 1.125 * sp.basePower)) bad.push(`${set.species}: ${a.id} + ${b.id} (both ${a.type})`);
  }
  return bad;
}

test('coherent sets: Choice Scarf drops Protect for the next damaging move; same-type pairs only as a strong spread / single split', () => {
  const krook = { species: 'krookodile', item: 'choicescarf', moves: ['knockoff', 'highhorsepower', 'protect', 'earthquake'] };
  const m = cohere(mech, krook, ['closecombat', 'gunkshot', 'stoneedge']);
  assert.ok(!m.includes('protect'), m.join());
  assert.ok(!(m.includes('highhorsepower') && m.includes('earthquake')), m.join());
  assert.equal(m.length, 4);
  assert.deepEqual(incoherent({ ...krook, moves: m }), []);
  // non-Choice: Protect stays when the ladder runs it, even if a 4th damaging move came first
  const life = cohere(mech, { ...krook, item: 'lifeorb', moves: ['knockoff', 'highhorsepower', 'gunkshot', 'stoneedge'] }, [], { ladderProtect: true });
  assert.ok(life.includes('protect'), life.join());
  // Rock Slide (spread) + Stone Edge (much stronger into one) may share a type
  assert.deepEqual(cohere(mech, { species: 'tyranitar', item: 'lifeorb', moves: ['rockslide', 'stoneedge'] }), ['rockslide', 'stoneedge']);
});

test('every generated set for W4 ZhuZi and W5 Hex (vs Calvin, fixture sheet, research usage) is coherent', () => {
  const fx = (n) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');
  const dex = JSON.parse(readFileSync(new URL('../data/dex.json', import.meta.url), 'utf8'));
  const L = buildLeague({ boardCsv: fx('board.csv'), draftsCsv: fx('drafts.csv'), boardHtml: fx('board.html') }, dex);
  const roster = (re) => L.coaches.find((c) => re.test(c.name)).picks.map((p) => p.id).filter(Boolean);
  const calvin = roster(/^Calvin/);
  const bad = [];
  let sets = 0;
  for (const re of [/^ZhuZi/, /^Hex/]) {
    const r = generateMock(newCalc(), mech, { xPool: roster(re), yPool: calvin, usage });
    assert.ok(r.variants.length, String(re));
    for (const v of r.variants) for (const { set } of setsOf(v.six)) { sets++; bad.push(...incoherent(set)); }
  }
  assert.ok(sets >= 10, `sets checked: ${sets}`);
  assert.deepEqual(bad, [], `\n${bad.join('\n')}`);
});

// League pairings (lib/schedule.mjs): the sheet's "Paring" tab read as it is (weeks, groups, pairs, byes) and nothing more.
// The fixture is the live tab as published on 2026-10-07 (it spells "Goup A" and writes names differently from Drafts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parsePairings, scheduleFor, weeksAgainst, groupOf, matchCoach, nameKey } from '../lib/schedule.mjs';

const CSV = readFileSync(new URL('./fixtures/pairing.csv', import.meta.url), 'utf8');
const COACHES = ['Hex(法拉)', 'Ning', 'ZhuZi', 'Jacky', 'Anthony', 'Taro', '17', 'Calvin', 'DIngDIng', 'Data'].map((name) => ({ name }));

test('the live tab: 5 weeks, Group A and Group B, two pairs and a bye each, every name matched to its Drafts coach', () => {
  const p = parsePairings(CSV, COACHES);
  assert.deepEqual(p.weeks.map((w) => w.week), [1, 2, 3, 4, 5]);
  for (const w of p.weeks) {
    assert.deepEqual(w.groups.map((g) => g.label), ['Group A', 'Group B']);
    for (const g of w.groups) { assert.equal(g.pairs.length, 2); assert.equal(g.byes.length, 1); }
  }
  assert.equal(p.weeks[0].groups[0].raw, 'Goup A'); // the sheet's own spelling is kept beside the label
  assert.deepEqual(p.unmatched, []);
  assert.deepEqual(p.warnings, []);
  assert.deepEqual(scheduleFor(p, 'Anthony'), [
    { week: 1, group: 'Group A', opponent: 'Calvin', raw: 'Calvin', bye: false },
    { week: 2, group: 'Group A', opponent: null, raw: '', bye: true },
    { week: 3, group: 'Group A', opponent: 'ZhuZi', raw: 'Zhuzi', bye: false },
    { week: 4, group: 'Group A', opponent: 'Hex(法拉)', raw: 'Hex', bye: false },
    { week: 5, group: 'Group A', opponent: 'Jacky', raw: 'Jacky', bye: false },
  ]);
  assert.deepEqual(weeksAgainst(p, 'Anthony', 'Calvin'), [1]);
  assert.deepEqual(weeksAgainst(p, 'Anthony', 'Ning'), []);
  assert.equal(groupOf(p, 'DIngDIng'), 'Group B');
  assert.equal(groupOf(p, 'Nobody'), '');
  // every coach plays 4 and sits out 1
  for (const { name } of COACHES) {
    const s = scheduleFor(p, name);
    assert.equal(s.length, 5, name);
    assert.equal(s.filter((x) => x.bye).length, 1, name);
  }
});

test('it says only what the tab says: no dates, results, current week or "next" anywhere in the output', () => {
  const p = parsePairings(CSV, COACHES);
  const keys = new Set();
  const walk = (v) => { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { keys.add(k); walk(x); } };
  walk(p); walk(scheduleFor(p, 'Anthony'));
  assert.deepEqual([...keys].filter((k) => /date|time|result|score|current|next|win|standing/i.test(k)), []);
});

test('name rule: case, spaces (NBSP too), zero-width characters and one trailing parenthetical (ASCII or full-width) are ignored', () => {
  assert.equal(nameKey('Hex(法拉)'), 'hex');
  assert.equal(nameKey('Hex（法拉）'), 'hex');
  assert.equal(nameKey('\u00A0Ding\u00A0DIng '), 'dingding');
  assert.equal(nameKey('Cal\u200Bvin\uFEFF'), 'calvin');
  assert.equal(nameKey('NIng'), 'ning');
  assert.equal(nameKey('(only a note)'), '');
  assert.equal(nameKey(null), '');
  assert.equal(matchCoach('Hex', COACHES), 'Hex(法拉)');
  assert.equal(matchCoach('Zhuzi', COACHES), 'ZhuZi');
  // never guessed: near misses, empty names and anything matching two coaches stay unmatched
  assert.equal(matchCoach('Calv', COACHES), null);
  assert.equal(matchCoach('Calvinn', COACHES), null);
  assert.equal(matchCoach('', COACHES), null);
  assert.equal(matchCoach('(x)', COACHES), null);
  assert.equal(matchCoach('sam', [{ name: 'Sam' }, { name: 'SAM (alt)' }]), null);
  assert.equal(matchCoach('Hex', []), null);
});

test('an unmatched name is kept exactly as written and listed; its pair still shows, with no opponent claimed', () => {
  const csv = CSV.replace('Anthony,vs,Calvin', 'Anthony,vs,Calvinn').replace('Zhuzi,vs,Jacky', '<b>x</b>,vs,Jacky');
  const p = parsePairings(csv, COACHES);
  assert.deepEqual(p.unmatched, ['Calvinn', '<b>x</b>']);
  assert.deepEqual(scheduleFor(p, 'Anthony')[0], { week: 1, group: 'Group A', opponent: null, raw: 'Calvinn', bye: false });
  // with an unmatched name a "not listed" fact would be a guess, so none is reported
  assert.equal(p.warnings.some((w) => w.code === 'not-listed'), false);
});

test('before the Drafts tab loads (no coaches) nothing matches, and the structure is still read', () => {
  const p = parsePairings(CSV, []);
  assert.equal(p.weeks.length, 5);
  // every distinct spelling is listed as written (the sheet spells some names two ways)
  assert.deepEqual([...p.unmatched].sort(), ['17', 'Anthony', 'Calvin', 'Data', 'DingDIng', 'DingDing', 'Hex', 'Jacky', 'NIng', 'Ning', 'Taro', 'Zhuzi']);
  assert.deepEqual(scheduleFor(p, 'Anthony'), []);
});

test('malformed tabs give no weeks and say why; nothing is invented', () => {
  assert.deepEqual(parsePairings('', COACHES), { weeks: [], unmatched: [], warnings: [{ code: 'empty' }] });
  assert.deepEqual(parsePairings(null, COACHES).warnings, [{ code: 'empty' }]);
  assert.deepEqual(parsePairings('a,b,c\n1,2,3\n', COACHES).warnings, [{ code: 'no-week-header' }]);
  assert.deepEqual(parsePairings('<!DOCTYPE html><html><body>Sign in</body></html>', COACHES).warnings, [{ code: 'no-week-header' }]);
  const headerOnly = parsePairings('Week 1,,\n', COACHES);
  assert.deepEqual(headerOnly.weeks, []);
  assert.deepEqual(headerOnly.warnings, [{ code: 'no-pairings' }]);
});

test('odd rows are reported, not repaired: unknown rows, a repeated week, a coach twice in a week, a coach missing from a week', () => {
  const odd = parsePairings('Week 1,,,Week 1,,\nGroup A,,,Group A,,\nAnthony,vs,Calvin,Ning,vs,Taro\nsomething odd,here,x,,,\n', COACHES);
  assert.deepEqual(odd.weeks.map((w) => w.week), [1]);
  assert.ok(odd.warnings.some((w) => w.code === 'duplicate-week' && w.week === 1));
  assert.ok(odd.warnings.some((w) => w.code === 'unrecognised-row' && w.week === 1 && w.row === 4));
  assert.ok(odd.warnings.some((w) => w.code === 'not-listed' && w.coaches.includes('Ning')));
  const twice = parsePairings('Week 1,,\nGroup A,,\nAnthony,vs,Calvin\nCalvin,vs,Jacky\n', COACHES);
  assert.deepEqual(twice.warnings.find((w) => w.code === 'listed-twice'), { code: 'listed-twice', week: 1, coaches: ['Calvin'] });
  // both pairs are still shown as the sheet has them
  assert.equal(twice.weeks[0].groups[0].pairs.length, 2);
});

test('layout variations: a bye in the middle column, "vs." and pairs before any group label', () => {
  const p = parsePairings('Week 2,,\nAnthony,vs.,Calvin\nJacky,Bye,\n', COACHES);
  assert.deepEqual(p.weeks[0].groups.map((g) => g.label), ['']);
  assert.deepEqual(scheduleFor(p, 'Jacky'), [{ week: 2, group: '', opponent: null, raw: '', bye: true }]);
  assert.deepEqual(weeksAgainst(p, 'Calvin', 'Anthony'), [2]);
});

// The Plan board engine (lib/prep-board.mjs) on the 2026-10-07 league rosters (inlined; nothing is fetched): the VGC
// domain contract's fixtures for targets and seeds (PB1), lead-pair ranking (PB2–PB5) and "fill a gap" (FG1–FG3), plus the
// honesty rules: saved plans replace their suggestions, nothing claims damage or odds. The test 6 is a test input, not advice.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mech, read } from './calc-helpers.mjs';
import { coreContext } from '../lib/cores.mjs';
import { buildBriefing, typeRules } from '../lib/prep-matchup.mjs';
import { boardTargets, boardContext, coverage, fillGap, rankLeadPairs, rankBackPairs, pairEvidence, boardSpeedMode } from '../lib/prep-board.mjs';
import * as C from '../public/prep-copy.js';

const DEX = JSON.parse(read('data/dex.json')), CX = coreContext(DEX, JSON.parse(read('data/cores.json')));
const R = {
  Anthony: ['charizard', 'sinistcha', 'pelipper', 'kangaskhan', 'aegislash', 'morpeko', 'conkeldurr', 'rotomfan', 'stunfiskgalar', 'simipour'],
  Hex: ['garchomp', 'indeedeef', 'corviknight', 'rotomheat', 'armarouge', 'kleavor', 'banette', 'ditto', 'forretress', 'drampa'],
  ZhuZi: ['metagross', 'rotomwash', 'dragapult', 'krookodile', 'infernape', 'slowkinggalar', 'florges', 'oranguru', 'toxtricity', 'umbreon'],
  Jacky: ['incineroar', 'golisopod', 'farigiraf', 'rotommow', 'torkoal', 'mimikyu', 'appletun', 'rotom', 'mrrime', 'lycanrocmidnight'],
  Calvin: ['staraptor', 'grimmsnarl', 'empoleon', 'basculegionf', 'jolteon', 'volcarona', 'tsareena', 'mamoswine', 'tauros', 'swalot'],
};
const SIX = ['charizard', 'sinistcha', 'pelipper', 'kangaskhan', 'aegislash', 'conkeldurr'];
const side = (n, o) => ({ name: n, order: o, ids: R[n], slotsLeft: 0, pointsLeft: 0 });
const setup = (opp, plans = []) => {
  const b = buildBriefing({ cx: CX, dex: DEX, mech, usage: null, mine: side('Anthony', 5), theirs: side(opp, 2), available: [] });
  const { targets, couldAlso } = boardTargets(b, plans);
  return { b, targets, couldAlso, ctx: boardContext({ dex: DEX, cx: CX, b, roster: R.Anthony, theirIds: R[opp] }) };
};
const top = (ctx, t, six = SIX) => rankLeadPairs(ctx, six, t).slice(0, 2).map((x) => [x.pair.join('+'), x.key]);
const byKey = (targets, k) => targets.find((t) => t.key === k);

test('fixture rosters exist in the dex', () => { for (const ids of Object.values(R)) for (const id of ids) assert.ok(DEX.species[id], id); });

test('PB1 targets: no Cores plan for ZhuZi, so a Trick Room seed from their ladder setters, then their look-first mons; no Tailwind seed', () => {
  const { targets } = setup('ZhuZi');
  assert.deepEqual(targets.map((t) => [t.key, t.source, t.focus]), [
    ['seed-trick-room', 'seed', ['slowkinggalar', 'oranguru']],
    ['look-first', 'look-first', ['krookodile', 'dragapult', 'rotomwash']],
  ]);
  assert.equal(byKey(targets, 'seed-trick-room').speedMode, 'trick-room');
  // with 3 detected plans, no seed column at all (seeds are only for thin pools)
  assert.deepEqual(setup('Jacky').targets.map((t) => t.key), ['core:trick-room:', 'core:sun:', 'core:screens:', 'look-first']);
});

test('PB2–PB5 lead pairs inside the 6 rank by the fixed key; headline words follow the evidence; ties go by position in the 6', () => {
  const J = setup('Jacky');
  assert.deepEqual(top(J.ctx, byKey(J.targets, 'core:trick-room:'))[0], ['sinistcha+conkeldurr', [1, 2, 0, 0, 1, 0, 0]]);
  assert.equal(rankLeadPairs(J.ctx, SIX, byKey(J.targets, 'core:trick-room:'))[0].evidence.headline, 'has');
  assert.deepEqual(top(J.ctx, byKey(J.targets, 'core:sun:'))[0], ['charizard+conkeldurr', [2, 2, 0, 0, 1, 1, 0]]);
  assert.deepEqual(top(J.ctx, byKey(J.targets, 'look-first'))[0], ['charizard+conkeldurr', [0, 0, 3, 0, 3, 1, 0]]);
  const Cv = setup('Calvin');
  assert.deepEqual(top(Cv.ctx, byKey(Cv.targets, 'core:tailwind:'))[0], ['pelipper+aegislash', [1, 2, 0, 1, 1, 0, 0]]);
  assert.deepEqual(top(Cv.ctx, byKey(Cv.targets, 'core:support-shell:'))[0], ['charizard+aegislash', [2, 2, 1, 1, 2, 0, 0]]);
  const H = setup('Hex');
  assert.deepEqual(top(H.ctx, byKey(H.targets, 'core:psychic-terrain:'))[0], ['pelipper+aegislash', [2, 2, 0, 0, 1, 0, 0]]);
  const Z = setup('ZhuZi');
  assert.deepEqual(top(Z.ctx, byKey(Z.targets, 'seed-trick-room')), [['charizard+aegislash', [0, 0, 1, 1, 1, 0, 0]], ['sinistcha+aegislash', [0, 0, 1, 1, 1, 0, 0]]], 'PB5 tie by position');
  assert.deepEqual(top(Z.ctx, byKey(Z.targets, 'look-first'))[0], ['charizard+sinistcha', [0, 0, 3, 1, 3, 0, 0]]);
  // the same pairs with the 6 reordered: the tie flips with the positions (never a hidden preference)
  assert.deepEqual(top(Z.ctx, byKey(Z.targets, 'seed-trick-room'), ['sinistcha', 'aegislash', 'charizard', 'pelipper'])[0][0], 'sinistcha+aegislash');
});

test('FG1–FG3 fill a gap: one gap at a time, candidates by strength; a type-uncoverable mon says "check it with a calc"', () => {
  const J = setup('Jacky');
  const g1 = fillGap(J.ctx, J.targets, []);
  assert.equal(g1.gap.key, 'core:trick-room:');
  assert.deepEqual(g1.candidates.slice(0, 3).map((c) => [c.id, c.strength]), [['sinistcha', 4], ['morpeko', 4], ['conkeldurr', 3]]);
  const Cv = setup('Calvin');
  const g2 = fillGap(Cv.ctx, Cv.targets, ['charizard', 'sinistcha']);
  assert.equal(g2.gap.key, 'mon:grimmsnarl');
  assert.equal(g2.candidates[0].id, 'aegislash');
  const H = setup('Hex');
  const g3 = fillGap(H.ctx, H.targets, SIX);
  assert.equal(g3.gap.key, 'mon:rotomheat');
  assert.equal(g3.fallback, true, 'nothing reaches strength 1');
  assert.deepEqual(g3.candidates.map((c) => [c.id, c.strength]), [['simipour', 0.5]], 'Levitate rules out Galarian Stunfisk; Pelipper is already in the 6');
  assert.ok(g3.freeToSwap.length > 0 && g3.freeToSwap.every((m) => SIX.includes(m)));
  // a covered 6 has no gap; a tapped item is used as the gap
  assert.equal(fillGap(J.ctx, J.targets, SIX).gap?.key ?? null, null);
  assert.equal(fillGap(H.ctx, H.targets, [], { gapKey: 'mon:garchomp' }).gap.key, 'mon:garchomp');
});

test('coverage: listed answers solid or weaker; seeds by the Cores status; look-first mons by hit or wall (Mega-only is weaker)', () => {
  const H = setup('Hex');
  const items = coverage(H.ctx, H.targets, SIX);
  assert.deepEqual(items.map((i) => [i.key, i.covered]), [['core:tailwind:', 'solid'], ['core:psychic-terrain:', 'solid'], ['mon:garchomp', 'outline'], ['mon:rotomheat', null], ['mon:armarouge', 'solid']]);
  assert.deepEqual(items.find((i) => i.key === 'mon:garchomp').hitBy, [{ mon: 'charizard', mult: 2, mega: true }], 'only Mega Charizard X hits it hard');
  const Z = setup('ZhuZi');
  assert.equal(coverage(Z.ctx, Z.targets, []).find((i) => i.kind === 'seed').covered, null);
  assert.ok(coverage(Z.ctx, Z.targets, ['sinistcha']).find((i) => i.kind === 'seed').covered, 'Sinistcha\'s own Trick Room is a listed answer');
});

test('back pairs: what the lead leaves open, then flexibility for the other plans; a lead that handles everything says so', () => {
  const J = setup('Jacky');
  const t = byKey(J.targets, 'core:trick-room:');
  const bk = rankBackPairs(J.ctx, SIX, ['sinistcha', 'conkeldurr'], t, J.targets);
  assert.deepEqual(bk.open, ['farigiraf', 'golisopod']);
  assert.deepEqual([bk.pairs[0].pair, bk.pairs[0].key], [['charizard', 'aegislash'], [2, 2, 0, 1]]);
  const Cv = setup('Calvin');
  const sup = byKey(Cv.targets, 'core:support-shell:');
  assert.deepEqual(rankBackPairs(Cv.ctx, SIX, ['charizard', 'aegislash'], sup, Cv.targets).open, []);
});

test('saved plans replace their suggestions; saved seeds and a saved look-first are not repeated; ideas are not targets', () => {
  const plan = (id, basis, extra = {}) => ({ id, kind: 'alt', label: 'Mine', members: ['farigiraf'], megaUser: null, speedMode: 'trick-room', basis, falsifiers: { atPreview: ['farigiraf'] }, ...extra });
  const J = setup('Jacky', [plan('plan_aaaaaaaaaaaa', ['trick-room']), plan('plan_bbbbbbbbbbbb', ['look-first'], { members: ['incineroar'] }), plan('plan_cccccccccccc', [], { kind: 'idea' })]);
  assert.deepEqual(J.targets.map((t) => [t.key, t.source]), [['plan:plan_aaaaaaaaaaaa', 'saved'], ['plan:plan_bbbbbbbbbbbb', 'saved'], ['core:sun:', 'suggested'], ['core:screens:', 'suggested']]);
  assert.equal(J.targets[0].counted.length > 0, true, 'a saved detected plan keeps its listed answers');
  assert.equal(J.targets[1].seed, 'look-first');
  const Z = setup('ZhuZi', [plan('plan_dddddddddddd', ['seed-trick-room'], { members: ['slowkinggalar', 'oranguru'] })]);
  assert.deepEqual(Z.targets.map((t) => t.key), ['plan:plan_dddddddddddd', 'look-first']);
  assert.equal(boardSpeedMode('unknown'), 'none');
  assert.equal(boardSpeedMode('priority'), 'none');
});

test('one type rule for the briefing and the board: hits, walls and exposure agree with the briefing\'s own reasons', () => {
  const J = setup('Jacky');
  const T = typeRules(DEX, CX);
  for (const m of J.b.myMons) {
    const hits = m.pros.find((p) => p.code === 'hits-key-se')?.hits ?? [];
    for (const t of J.b.key) {
      const h = T.hitsHard(m.id, t), fromBrief = hits.find((x) => x.id === t);
      assert.equal(!!h, !!fromBrief, `${m.id} → ${t}`);
      if (h) assert.equal(h.mega, fromBrief.megaOnly, `${m.id} → ${t} Mega-only`);
    }
  }
  const ev = pairEvidence(J.ctx, ['sinistcha', 'conkeldurr'], byKey(J.targets, 'core:trick-room:'));
  assert.ok(ev.answers.some((a) => a.mon === 'sinistcha' && a.anchor));
  assert.ok(ev.speed.every((s) => ['first', 'second', 'depends', 'tie'].includes(s.result)));
});

test('G1 the board\'s words never claim damage, wins or odds', () => {
  const words = [];
  const walk = (v) => { if (typeof v === 'string') words.push(v); else if (typeof v === 'function') { try { words.push(String(v('A', 'B', 2, false))); } catch { /* shape varies */ } } else if (v && typeof v === 'object') Object.values(v).forEach(walk); };
  walk(C.BOARD);
  const all = words.join(' | ');
  for (const re of [/\bcounters?\b/i, /\bbeats?\b/i, /\bwins\b/i, /favou?red/i, /\bsafe\b/i, /guaranteed/i, /win chance/i, /%/, /odds/i]) assert.doesNotMatch(all, re);
  assert.match(all, /not damage-checked/);
});

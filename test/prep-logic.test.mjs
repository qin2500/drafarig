// Prep's pure logic: honest coverage (rungs, flags, "Start here"), finding confidence, records as counts, revision guards,
// what reveals tell you (with their conditions), Bo3/format facts, the mock brief (never your team) and reveals into sets.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mech, read, set, CHOMP, INCIN } from './calc-helpers.mjs';
import { flags, startHere, planRung, findingConfidence, recordText, revisionGuards, formatInfo, MAX_FLAGS, FLAG_PRIORITY } from '../lib/prep-coverage.mjs';
import { itemClauseExclusions, speedBound, boundVsRange, ledgerThem, surprises } from '../lib/prep-infer.mjs';
import { composeBrief, parseBrief, setupFor, checkNumbers, BRIEF_HEADER, TEAM_SIZE, PICKED } from '../lib/prep-brief.mjs';
import { closestPlans, couldBringAgainst } from '../lib/prep-plans.mjs';
import { newLineage, addVersion, applyReveal, currentVersion, guessSet, provenanceAll, weakestSource } from '../lib/prep-model.mjs';
import { newWorkspace, emptyRules } from '../lib/prep-schema.mjs';
import { parseTeam } from '../lib/paste.mjs';
import { setStats, canLearn } from '../lib/calc/mech.mjs';
import { coreContext, detect } from '../lib/cores.mjs';
import { buildLeague } from '../lib/league.mjs';
import { RAW } from './ui-harness.mjs';

const NOW = '2026-10-04T10:00:00.000Z';
const ws0 = (extra = {}) => ({ ...newWorkspace({ id: 'ws_aaaaaaaaaaaa', coach: 'Ning', roster: { fetchedAt: NOW, speciesIds: ['rillaboom', 'gholdengo'], points: {} }, now: NOW }), ...extra });
const rules = (o = {}) => { const r = emptyRules(NOW); for (const [k, v] of Object.entries(o)) r.rules[k] = { value: v, source: 'user', setAt: NOW, note: '' }; return r; };
const mock = (id, games, extra = {}) => ({ id, date: '2026-10-03', partner: 'A', fidelity: 2, variantIds: ['var_1'], simulatedDisclosure: 'closed', formatString: 'gen9champions4v4doublesdraft@@@Best of = 3', games, ...extra });
const game = (id, extra = {}) => ({ id, index: 0, result: 'L', theirLead: ['rillaboom', 'gholdengo'], tag: 'structural', planId: 'plan_1', partnerFidelity: 2, ...extra });

test('flags: fixed priority, at most three shown, dismissals respected, never a score', () => {
  const ws = ws0({ plans: [{ id: 'plan_1', kind: 'likely', members: ['rillaboom'] }], cards: [{ id: 'card_1', kind: 'plan', vsPlanIds: ['plan_1'] }],
    mockSets: [mock('mock_1', [game('g1'), game('g2')], { briefText: 'Drafarig mock brief v1\n…' })] });
  assert.ok(!flags({ ...ws, mockSets: [mock('mock_1', [game('g1'), game('g2')])] }, { rules: rules() }).some((f) => f.code === 'F20'), 'no brief: no check numbers to confirm');
  assert.ok(!flags(ws0({ eyesAnswer: 'Their Kingambit into my Sinistcha' }), { rules: rules() }).some((f) => f.code === 'F14'), 'answering "Through their eyes" counts');
  const all = flags(ws, { rules: rules(), staleCalcIds: ['calc_1'], rosterDiff: { added: ['milotic'], removed: [] }, megaSpecies: ['gholdengo'] });
  const order = FLAG_PRIORITY.flat();
  assert.deepEqual(all.map((f) => f.code), [...all.map((f) => f.code)].sort((a, b) => order.indexOf(a) - order.indexOf(b)), 'priority order');
  assert.deepEqual(all.slice(0, 3).map((f) => f.code), ['F16', 'F20', 'F11'], 'unconfirmed rule, unchecked paste, out-of-date calcs first');
  assert.ok(all.length > MAX_FLAGS, 'more exist; the screen shows three');
  for (const code of ['F14', 'F15', 'F1', 'F2']) assert.ok(all.some((f) => f.code === code), code);
  const dismissed = flags({ ...ws, dismissedFlags: ['F16', 'F14'] }, { rules: rules() });
  assert.ok(!dismissed.some((f) => f.code === 'F16' || f.code === 'F14'));
  assert.ok(!flags(ws0(), { rules: rules({ disclosure: 'closed', itemClause: 'on', sixPerMatch: 'yes' }) }).some((f) => f.code === 'F16'));
  // F19: the mock's format shows different information than the condition it claims
  const lie = ws0({ mockSets: [mock('mock_2', [], { formatString: 'gen9championsvgc2026regmcbo3', simulatedDisclosure: 'closed' })] });
  assert.ok(flags(lie, { rules: rules() }).some((f) => f.code === 'F19'));
});

test('"Start here" follows the fixed order, and the prep path is guidance only (null when everything is done)', () => {
  const p1 = { id: 'plan_1', kind: 'likely', members: ['rillaboom'] };
  const cp = { id: 'plan_2', kind: 'counterprep', members: ['gholdengo'] };
  assert.deepEqual(startHere(ws0()), { step: 1 });
  assert.deepEqual(startHere(ws0({ plans: [p1] })), { step: 2 });
  assert.deepEqual(startHere(ws0({ plans: [p1, cp] })), { step: 3 });
  assert.deepEqual(startHere(ws0({ plans: [p1], eyesAnswer: 'Rillaboom up to stop my lead' })), { step: 3 }, 'the eyes answer completes step 2');
  assert.deepEqual(startHere(ws0({ plans: [p1, { id: 'plan_3', kind: 'counterprep', members: [], needs: 'Fake Out pressure' }] })), { step: 3 });
  const six = Array.from({ length: 6 }, (_, i) => ({ setId: `set_${'a'.repeat(11)}${i}` }));
  assert.deepEqual(startHere(ws0({ plans: [p1, cp], my6: six })), { step: 4 });
  assert.deepEqual(startHere(ws0({ plans: [p1, cp] }), { pickSix: false }), { step: 4 }, 'no team choice to make: skip step 3');
  const cards = [{ id: 'card_1', kind: 'plan', vsPlanIds: ['plan_1', 'plan_2'] }];
  const ws = ws0({ plans: [p1, cp], my6: six, cards });
  assert.deepEqual(startHere(ws, { speedUnchecked: true }), { step: 5 });
  assert.deepEqual(startHere(ws, {}), { step: 6 });
  assert.deepEqual(startHere(ws, { keyCalcsRun: true, staleCount: 2 }), { step: 'recheck' });
  assert.deepEqual(startHere(ws, { keyCalcsRun: true }), { step: 7 });
  assert.equal(startHere(ws, { keyCalcsRun: true, mockPlanned: true }), null);
});

test('plan rungs in words: card → checked (calc + speed) → rehearsed → rehearsed broadly; off-script games never count', () => {
  const p = { id: 'plan_1', kind: 'likely', members: ['rillaboom'] };
  const card = { id: 'card_1', kind: 'plan', vsPlanIds: ['plan_1'] };
  assert.equal(planRung(ws0({ plans: [p] }), 'plan_1'), 'not-yet');
  assert.equal(planRung(ws0({ plans: [p], cards: [card] }), 'plan_1'), 'thought-through');
  const facts = { calcsByCard: { card_1: ['calc_1'] }, speedCheckedCards: new Set(['card_1']) };
  assert.equal(planRung(ws0({ plans: [p], cards: [card] }), 'plan_1', facts), 'checked');
  const off = ws0({ plans: [p], cards: [card], mockSets: [mock('m', [game('g1', { tag: 'partner-off-script' }), game('g2', { partnerFidelity: 1 })])] });
  assert.equal(planRung(off, 'plan_1', facts), 'checked');
  const one = ws0({ plans: [p], cards: [card], mockSets: [mock('m', [game('g1')])] });
  assert.equal(planRung(one, 'plan_1'), 'rehearsed');
  const broad = ws0({ plans: [p], cards: [card], mockSets: [mock('m1', [game('g1')]), mock('m2', [game('g2', { theirLead: ['rillaboom', 'milotic'] })], { partner: 'B' })] });
  assert.equal(planRung(broad, 'plan_1'), 'rehearsed-broadly');
});

test('finding confidence follows the stated rules; records are counts, never rates', () => {
  const f = { mechanism: 'their Tailwind outspeeds my lead' };
  assert.deepEqual(findingConfidence({}, []), { level: 'low', rule: 'no-games' });
  assert.equal(findingConfidence(f, [{ tag: 'structural' }]).level, 'low');
  assert.equal(findingConfidence(f, [{ tag: 'structural' }], true).level, 'high', 'once, with a mechanism confirmed by a calc');
  assert.equal(findingConfidence(f, [{ tag: 'partner-off-script' }]).level, 'none');
  assert.equal(findingConfidence(f, [{ tag: 'structural', variantId: 'a', partner: 'A' }, { tag: 'structural', variantId: 'a', partner: 'A' }]).level, 'medium');
  assert.equal(findingConfidence(f, [{ tag: 'structural', variantId: 'a', partner: 'A' }, { tag: 'structural', variantId: 'b', partner: 'A' }]).level, 'high');
  assert.equal(findingConfidence({}, [{ tag: 'structural', variantId: 'a' }, { tag: 'structural', variantId: 'b' }]).level, 'medium', 'no mechanism: not high');
  const recs = recordText([mock('m1', [game('a', { result: 'W' }), game('b', { result: 'L' }), game('c', { result: 'W' })]), mock('m2', [])]);
  assert.deepEqual(recs, ['2–1']);
  assert.ok(recs.every((r) => !/%|rate|win/i.test(r)));
});

test('revision guards are gentle codes, never blocks', () => {
  const fs = [{ id: 'fnd_1', severity: 'critical' }];
  assert.deepEqual(revisionGuards({ reasonFindingIds: [] }), ['hunch']);
  assert.deepEqual(revisionGuards({ reasonFindingIds: ['fnd_1'], structural: true }, { findings: fs, structuralInDraft: 2 }), ['split-structural', 'one-unclear-game']);
  assert.deepEqual(revisionGuards({ reasonFindingIds: ['fnd_1'] }, { findings: fs, matchDate: '2026-10-04T20:00:00Z', now: NOW }), ['late-change']);
  assert.deepEqual(revisionGuards({ reasonFindingIds: ['fnd_1'] }, { findings: fs, matchDate: '2026-10-04T20:00:00Z', now: NOW, confidenceOf: () => 'high' }), []);
});

test('reveals: item-clause exclusions are conditional until the rule is confirmed; Speed bounds list what breaks them', () => {
  const rv = [{ speciesId: 'rillaboom', kind: 'item', value: 'choiceband' }, { speciesId: 'gholdengo', kind: 'item', value: 'choiceband' }];
  assert.deepEqual(itemClauseExclusions(rv, rules()), [{ item: 'choiceband', holder: 'rillaboom', conditional: true }]);
  assert.deepEqual(itemClauseExclusions(rv, rules({ itemClause: 'on' })), [{ item: 'choiceband', holder: 'rillaboom', conditional: false }]);
  assert.deepEqual(itemClauseExclusions(rv, rules({ itemClause: 'off' })), []);
  assert.deepEqual(speedBound({ kind: 'moved-before' }, { priority: 'unknown', myStat: 150 }), { none: 'priority-unknown' });
  assert.deepEqual(speedBound({ kind: 'moved-before' }, { priority: 'same' }), { none: 'your-speed-unknown' });
  const b = speedBound({ kind: 'moved-before' }, { priority: 'same', myStat: 150, tailwindThem: true });
  assert.deepEqual([b.bound, b.value, b.tiePossible], ['min', 150, true]);
  assert.ok(b.breaks.includes('choicescarf') && b.breaks.includes('tailwind-applied'));
  assert.equal(speedBound({ kind: 'moved-before' }, { priority: 'same', myStat: 150, trickRoom: true }).bound, 'max', 'Trick Room flips it');
  assert.equal(boundVsRange({ bound: 'min', value: 150 }, { min: 100, max: 180 }), 'not-minimum');
  assert.equal(boundVsRange({ bound: 'min', value: 190 }, { min: 100, max: 180 }), 'contradicts');
  assert.equal(boundVsRange({ bound: 'max', value: 120 }, { min: 100, max: 180 }), 'not-maximum');
  assert.deepEqual([...ledgerThem([{ side: 'theirs', speciesId: 'a' }, { side: 'mine', speciesId: 'b' }]).keys()], ['a']);
  const ws = ws0({ plans: [{ id: 'plan_1', members: ['rillaboom'] }] });
  assert.deepEqual(surprises([{ kind: 'move', speciesId: 'rillaboom', value: 'highhorsepower' }, { kind: 'bring', speciesId: 'milotic' }], ws, () => [{ moves: ['fakeout'] }]).map((r) => r.kind), ['move', 'bring']);
});

test('formats: closed or unknown → 4v4 Doubles Draft with Bo3 as a challenge option; open sheets → Reg M-C Bo3 (forces OTS)', () => {
  const closed = setupFor('closed');
  assert.deepEqual([closed.id, closed.ots, closed.formatString, closed.bestOfOption], ['gen9champions4v4doublesdraft', false, 'gen9champions4v4doublesdraft@@@Best of = 3', true]);
  assert.equal(setupFor('unknown').id, 'gen9champions4v4doublesdraft');
  for (const c of ['open-at-preview', 'exchanged-in-advance']) assert.deepEqual([setupFor(c).id, setupFor(c).ots], ['gen9championsvgc2026regmcbo3', true]);
  assert.deepEqual(formatInfo('gen9champions4v4doublesdraft@@@Best of = 3'), { ots: false, bo3: true });
  assert.deepEqual(formatInfo('gen9championsvgc2026regmcbo3'), { ots: true, bo3: true });
  assert.equal(formatInfo('gen9championsvgc2026regmcbo3@@@!Force Open Team Sheets').ots, false);
  assert.equal(formatInfo('gen9championsvgc2026regmc').ots, null, 'Bo1 Reg M-C only offers sheets');
});

test('mock brief: their team only (never yours), check numbers equal the real stats, the paste re-imports, and it reads back', () => {
  const theirs = [set('garchomp', 'roughskin', 'jolly', { hp: 2, atk: 32, spe: 32 }, ['earthquake', 'dragonclaw'], 'lifeorb'),
    { ...set('incineroar', 'intimidate', 'careful', {}, ['fakeout', 'flareblitz'], 'sitrusberry'), sp: 'unknown' }];
  const out = composeBrief({ mech, teamName: "Ning's team (as you guess it)", purpose: 'Rehearse their Tailwind lead', condition: 'closed', fidelity: 2,
    howToPlay: ['Lead Garchomp + Incineroar'], dontUse: ["Don't open my team."], sets: theirs.map((s) => ({ set: s })), spChoice: () => ({ hp: 32, atk: 0, def: 2, spa: 0, spd: 32, spe: 0 }), conditionUnknown: true });
  assert.ok(out.text.startsWith(`${BRIEF_HEADER}\n`));
  assert.ok(out.text.includes('/challenge NAME, gen9champions4v4doublesdraft@@@Best of = 3'));
  assert.ok(out.text.includes("isn't confirmed"));
  const st = setStats(mech, theirs[0], { megaEvolved: false });
  assert.ok(out.text.includes(`- Garchomp: Speed ${st.spe} · Atk ${st.atk}`));
  assert.deepEqual(checkNumbers(mech, { ...theirs[1], sp: { hp: 32, atk: 0, def: 2, spa: 0, spd: 32, spe: 0 } }).stat, 'atk');
  assert.deepEqual(out.warnings.map((w) => w.code), ['spread-chosen', 'team-size'], 'two sets: the brief says Showdown needs 6');
  assert.match(out.text, /The paste has 2 Pokémon but Showdown needs exactly 6/);
  // nothing of "mine" can appear: the brief has no input for it
  for (const leak of ['charizard', 'Charizard', 'Sinistcha', 'plan card', 'premortem']) assert.ok(!out.text.includes(leak), leak);
  const back = parseBrief(out.text);
  assert.deepEqual([back.isBrief, back.purpose, back.howToPlay, back.dontUse], [true, 'Rehearse their Tailwind lead', ['Lead Garchomp + Incineroar'], ["Don't open my team."]]);
  const re = parseTeam(back.paste, { mech, side: 'theirs' });
  assert.deepEqual(re.sets.map((s) => s.status), ['ready', 'ready'], 'the partner can paste it straight into Showdown');
  assert.deepEqual(parseBrief('Garchomp @ Life Orb'), { isBrief: false, paste: 'Garchomp @ Life Orb' });
});

test('mock setup facts checked against the pinned Showdown (final-mock-preset): exactly 6 Pokémon, 4 picked, typed best-of-3 challenge', () => {
  // [Gen 9 Champions] 4v4 Doubles Draft: Flat Rules + VGC Timer → min = max team size 6, picked 4, team preview, no
  // team sheets; "gen9champions4v4doublesdraft@@@Best of = 3" validates and starts a best-of-3 game. The Reg M-C (Bo3)
  // format has the same sizes and forces open team sheets. Whether the client shows a best-of-3 tick box isn't checked.
  assert.deepEqual([TEAM_SIZE, PICKED], [6, 4]);
  const mk = (n) => composeBrief({ mech, teamName: 'Their team (my guess)', purpose: '', condition: 'closed', fidelity: 1, howToPlay: [], dontUse: [],
    sets: Array.from({ length: n }, () => ({ set: set('garchomp', 'roughskin', 'jolly', { atk: 32, spe: 32 }, ['earthquake']) })) });
  const six = mk(6);
  assert.match(six.text, /Team: exactly 6 \(Showdown checks it\); each game you pick 4 at team preview\./);
  assert.ok(!six.warnings.some((w) => w.code === 'team-size'));
  assert.match(mk(4).text, /The paste has 4 Pokémon but Showdown needs exactly 6: add 2 more from their roster before you start\./);
  assert.match(mk(7).text, /The paste has 7 Pokémon but Showdown needs exactly 6: keep 6 and delete the rest before you start\./);
  assert.deepEqual(mk(7).warnings.find((w) => w.code === 'team-size'), { code: 'team-size', count: 7 });
  assert.match(six.text, /best of 3 \(pick best-of-3 in the challenge if it is offered, or use the typed challenge below\)/);
  assert.ok(!/tick "Best-of-3"/.test(six.text), 'no unverified client instruction stated as fact');
  assert.match(six.text, /\/challenge NAME, gen9champions4v4doublesdraft@@@Best of = 3/);
  assert.ok(!/Team: exactly/.test(composeBrief({ mech, teamName: 'x', condition: 'open-at-preview', fidelity: 1, sets: [] }).text));
});

test('Game day: the closest plan needs every preview tell; reveals go into their set as a new version, never overwriting a confirmed move', () => {
  const plans = [{ id: 'p1', members: ['rillaboom', 'gholdengo'], falsifiers: { atPreview: ['rillaboom'] } }, { id: 'p2', members: ['milotic', 'lucario'] }];
  const c = closestPlans(plans, ['rillaboom', 'milotic', 'kingambit', 'a', 'b', 'c']);
  assert.deepEqual(c.map((x) => [x.planId, x.alive, x.missingTells]), [['p1', true, []], ['p2', false, ['lucario']]]);
  const g = guessSet(mech, null, 'garchomp', null, '2026-10-04');
  let l = newLineage({ id: 'set_aaaaaaaaaaaa', side: 'theirs', coach: 'Ning', speciesId: 'garchomp', name: 'Ladder guess', data: { ...g.data, moves: ['earthquake', 'dragonclaw', 'rockslide', 'protect'] }, provenance: provenanceAll({ ...g.data, moves: ['earthquake', 'dragonclaw', 'rockslide', 'protect'] }, 'ladder', '2026-10-04'), now: NOW });
  const r1 = applyReveal(l, { kind: 'move', value: 'stompingtantrum' }, { now: NOW });
  const v2 = currentVersion(r1.lineage);
  assert.equal(v2.v, 2);
  assert.ok(v2.data.moves.includes('stompingtantrum'));
  assert.equal(v2.provenance.moves[v2.data.moves.indexOf('stompingtantrum')].source, 'seen-vs-me');
  assert.equal(l.versions.length, 1, 'the old version is untouched');
  l = r1.lineage;
  for (const m of ['earthquake', 'dragonclaw', 'rockslide']) l = applyReveal(l, { kind: 'move', value: m }, { now: NOW }).lineage;
  assert.deepEqual(applyReveal(l, { kind: 'move', value: 'protect' }, { now: NOW }), { conflict: 'moves-full' }, 'four confirmed moves: the user chooses');
  assert.deepEqual(applyReveal(l, { kind: 'move', value: 'earthquake' }, { now: NOW }), { same: true });
  const it = applyReveal(l, { kind: 'item', value: 'choicescarf' }, { now: NOW }).lineage;
  assert.equal(weakestSource(currentVersion(it).provenance, currentVersion(it).data), 'seen-vs-me', 'every filled field is now confirmed (offline guess left ability and nature empty)');
  assert.equal(weakestSource(currentVersion(r1.lineage).provenance, currentVersion(r1.lineage).data), 'ladder', 'one reveal: the other guessed moves still label the set');
  assert.equal(currentVersion(it).provenance.item.source, 'seen-vs-me');
  assert.equal(addVersion(it, currentVersion(it).data, { now: NOW }), it, 'equal data is not a new version');
  void CHOMP; void INCIN;
});

// "Through their eyes" on the fixture league's rosters (test/fixtures/drafts.csv): Jacky fields Trick Room (Farigiraf,
// Golisopod, Torkoal), Hex fields Psychic Terrain (Indeedee-F, Armarouge). The spec marks "Tailwind doesn't help" (vs
// Trick Room) and "Fake Out doesn't work here" (vs Psychic Terrain) counts:false: its non-answers for that core, so they
// aren't counter-prep. Leaving them out says nothing about Tailwind or Fake Out mattering elsewhere in the game.
const DEX = JSON.parse(read('data/dex.json')), SPEC = JSON.parse(read('data/cores.json'));
const CX = coreContext(DEX, SPEC);
const LEAGUE = buildLeague(RAW, DEX, {});
const roster = (name) => LEAGUE.coaches.find((c) => c.name === name).picks.map((p) => p.id).filter(Boolean);
const could = (mine, theirs) => couldBringAgainst(CX, mech, mine, theirs, null, { keyMoves: (id) => DEX.species[id]?.keyMoves ?? [] });
const answerIds = (r, coreId) => r.find((c) => c.coreId === coreId)?.answers.map((a) => a.id) ?? [];
const answerMons = (r, coreId, id) => r.find((c) => c.coreId === coreId)?.answers.find((a) => a.id === id)?.mons.map((m) => m.id) ?? [];
const flat = (r) => r.map((c) => [c.coreId, c.answers.map((a) => [a.id, a.mons.map((m) => `${m.id} ${m.via.map((v) => `${v.kind}:${v.id}:${v.ladder}`).join(' ')}`)])]);
const NON_ANSWERS = SPEC.cores.flatMap((c) => (c.answers ?? []).filter((a) => a.counts === false).map((a) => a.id)).sort();

test('Through their eyes: the spec\'s non-answers (counts:false) are never offered as their counter-prep; real answers stay', () => {
  assert.deepEqual(NON_ANSWERS, ['pt-fakeout', 'tr-tailwind'], 'the spec\'s non-answers (extend these cases if it adds more)');
  const core = (id) => SPEC.cores.find((c) => c.id === id);
  const [jacky, ding, hex, ning] = ['Jacky', 'DIngDIng', 'Hex(法拉)', 'Ning'].map(roster);
  // the inputs really reach both entries: your core is fielded and their mon learns the move
  assert.ok(detect(CX, core('trick-room'), jacky), 'Jacky fields Trick Room');
  assert.ok(detect(CX, core('psychic-terrain'), hex), 'Hex fields Psychic Terrain');
  assert.ok(ding.includes('whimsicott') && canLearn(mech, 'whimsicott', 'tailwind'));
  assert.ok(ning.includes('rillaboom') && canLearn(mech, 'rillaboom', 'fakeout'));
  const tr = could(jacky, ding), pt = could(hex, ning);
  for (const c of [...tr, ...pt]) for (const a of c.answers) assert.ok(!NON_ANSWERS.includes(a.id), `${c.coreId}/${a.id} is listed`);
  assert.ok(!answerIds(tr, 'trick-room').includes('tr-tailwind'));
  assert.ok(!answerIds(pt, 'psychic-terrain').includes('pt-fakeout'));
  // positive controls: Taunt against your Trick Room setter, Fake Out where the spec counts it
  assert.deepEqual(answerMons(tr, 'trick-room', 'tr-taunt'), ['whimsicott', 'sableye', 'overqwil']);
  assert.deepEqual(answerMons(tr, 'trick-room', 'tr-fakeout'), ['sableye']);
  assert.deepEqual(answerMons(pt, 'tailwind', 'tw-fakeout'), ['rillaboom'], 'Rillaboom\'s Fake Out still answers your Tailwind');
  assert.deepEqual(answerIds(pt, 'psychic-terrain'), ['pt-terrain', 'pt-terrainmove'], 'your Psychic Terrain keeps its real answers');
});

test('Through their eyes: everything else is listed exactly as before (cores, answers, mons, tools, ladder words)', () => {
  const tr = could(roster('Jacky'), roster('DIngDIng')), pt = could(roster('Hex(法拉)'), roster('Ning'));
  assert.deepEqual(flat(tr), [['trick-room', [
    ['tr-own', ['whimsicott move:trickroom:unknown', 'audino move:trickroom:yes']],
    ['tr-taunt', ['whimsicott move:taunt:unknown', 'sableye move:taunt:unknown', 'overqwil move:taunt:unknown']],
    ['tr-fakeout', ['sableye move:fakeout:yes']]]]]);
  assert.deepEqual(flat(pt), [
    ['tailwind', [
      ['tw-speeddrop', ['milotic move:icywind:yes', 'ninetalesalola move:icywind:unknown']],
      ['tw-priority', ['rillaboom move:fakeout:yes move:grassyglide:yes', 'lucario move:extremespeed:unknown move:bulletpunch:unknown move:quickattack:unknown move:vacuumwave:unknown', 'ninetalesalola move:iceshard:unknown']],
      ['tw-fakeout', ['rillaboom move:fakeout:yes']],
      ['tw-taunt', ['rillaboom move:taunt:unknown']]]],
    ['psychic-terrain', [
      ['pt-terrain', ['rillaboom ability:grassysurge:unknown']],
      ['pt-terrainmove', ['rillaboom move:grassyterrain:unknown', 'ninetalesalola move:mistyterrain:unknown']]]]]);
  assert.deepEqual([...tr, ...pt].map((c) => [c.label, c.answers.map((a) => a.label)]), [
    ['Trick Room + slow hitters', ['Own Trick Room', 'Taunt the setter', 'Fake Out the setter']],
    ['Tailwind + strong attackers', ['Icy Wind / Electroweb', 'Priority attacks', 'Fake Out the setter', 'Taunt the setter']],
    ['Psychic Terrain spam', ['Own terrain setter', 'Own terrain move']]]);
  for (const c of [...tr, ...pt]) for (const a of c.answers) for (const m of a.mons) for (const v of m.via) assert.equal(v.onLadder, v.ladder === 'yes' || v.ladder === 'only');
});

test('Through their eyes: when their only listed tools were non-answers, nothing is offered', () => {
  const tailwindOnly = ['altaria', 'pidgeot', 'kleavor', 'scizor'];
  for (const id of tailwindOnly) assert.ok(canLearn(mech, id, 'tailwind'), `${id} learns Tailwind`);
  assert.deepEqual(could(roster('Jacky'), tailwindOnly), []);
  assert.deepEqual(answerMons(could(roster('Jacky'), [...tailwindOnly, 'whimsicott']), 'trick-room', 'tr-taunt'), ['whimsicott'], 'one real answer brings the list back');
});

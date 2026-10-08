// Battle Prep › Plan, the game-plan board (public/prep-board.js) on the stub DOM: markup, taps and what each tap saves.
// Contract (UX-VISUAL-TOOLS.md §2, §10; VGC-PLAN-TOOLS.md §3, §5):
// - Nothing is saved until a tap. Picks are species (card.species, document version 3). A set is attached only when it's
//   your only one for that species.
// - Every v4 card field is kept.
// - Earlier prep, other coaches' libraries and read-only states are refused.
// - Words never claim damage, wins or odds.
// Not a rendering: no pixels are measured here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootApp, parseHtml, findAll, find, text, hasClass } from './ui-harness.mjs';
import { T, btns, flushSaves, device, isPortrait, WS, SET_MINE, NOW } from './prep-helpers.mjs';
import { wsKey } from '../lib/prep-schema.mjs';
import * as C from '../public/prep-copy.js';

const ready = (app) => app.waitFor(() => !/Checking what they can learn/.test(app.html()), 'the Reg M-C data', 20000);
async function open(mode, opts = {}) { const app = await bootApp({ mode, ...opts }); await ready(app); return app; }
const root = (app) => parseHtml(app.html());
const doc = (s, id = WS) => JSON.parse(s.getItem(wsKey(id)));
const snap = (s) => JSON.stringify([...s.map].filter(([k]) => k.startsWith('drafarig.prep.') && !k.startsWith('drafarig.prep.hint.')).sort());
const slots = (app) => findAll(root(app), (n) => n.tag === 'button' && n.attrs['data-pa'] === 'pb-slot');
const pills = (app) => findAll(root(app), (n) => n.tag === 'button' && n.attrs['data-pa'] === 'pb-target');
const card = (s, id = WS) => doc(s, id).cards.find((c) => c.kind === 'plan');
async function buildSix(app, s) { for (const sp of ['sinistcha', 'pelipper', 'kangaskhan']) await app.click({ pa: 'pb-six', species: sp }); await flushSaves(app); assert.deepEqual(doc(s).shortlist, ['sinistcha', 'pelipper', 'kangaskhan']); }

test('a new matchup: their plans as pills (suggested ones marked), four empty slots with one "next", and nothing saved until a pick', async (t) => {
  const s = device();
  const app = await open('prep/5v2/plan', { storage: s });
  t.after(() => app.restore());
  assert.deepEqual(pills(app).map((n) => [n.attrs['data-key'], hasClass(n, 'unsaved'), n.attrs['aria-pressed']]), [['core:snow-veil:', true, 'true'], ['look-first', true, 'false']]);
  assert.deepEqual(slots(app).map((n) => [n.attrs['data-role'], n.attrs['data-i'], hasClass(n, 'empty'), hasClass(n, 'next')]),
    [['lead', '0', true, true], ['lead', '1', true, false], ['back', '0', true, false], ['back', '1', true, false]]);
  assert.match(T(app), /Not saved yet: your first pick below saves it\./);
  assert.ok(findAll(find(root(app), (n) => hasClass(n, 'pb-side') && hasClass(n, 'them')), isPortrait).length >= 1, 'their side as portraits');
  const before = snap(s);
  for (const a of [{ pa: 'pb-target', key: 'look-first' }, { pa: 'pb-light-calcs' }, { pa: 'pb-gap' }, { pa: 'pb-six-edit' }, { pa: 'pb-six-edit' }, { pa: 'pb-gap' }, { pa: 'pb-target', key: 'core:snow-veil:' }]) await app.click(a);
  await flushSaves(app);
  assert.equal(snap(s), before, 'looking around saves nothing');
});

test('1 + 3 + 4 taps: pick a plan, build your 6, fill Lead and Back; species are saved (version 3), your only set is attached', async (t) => {
  const s = device();
  const app = await open('prep/5v2/plan', { storage: s });
  t.after(() => app.restore());
  await app.click({ pa: 'pb-target', key: 'look-first' });
  await buildSix(app, s);
  for (const sp of ['charizard', 'sinistcha', 'pelipper', 'kangaskhan']) await app.click({ pa: 'pb-pick', species: sp });
  await flushSaves(app);
  const d = doc(s), c = card(s);
  assert.equal(d.schemaVersion, 3);
  assert.deepEqual(c.species, { bring4: ['charizard', 'sinistcha', 'pelipper', 'kangaskhan'], lead: ['charizard', 'sinistcha'], mega: '', megaForm: '' });
  assert.deepEqual([c.bring4, c.lead, c.back], [[SET_MINE], [SET_MINE], []], 'only Charizard has a set (your only one): nothing else is attached or created');
  const plan = d.plans.find((p) => c.vsPlanIds.includes(p.id));
  assert.deepEqual([plan.label, plan.basis, plan.kind], ['Their look-first mons', ['look-first'], 'alt']);
  assert.match(T(app), /✓ Card ready: 2 lead, 2 back/);
  assert.deepEqual(slots(app).map((n) => n.attrs['data-species']), ['charizard', 'sinistcha', 'pelipper', 'kangaskhan']);
  assert.match(slots(app)[0].attrs['aria-label'], /^Lead 1: Charizard, set attached\. Change$/);
  assert.match(slots(app)[2].attrs['aria-label'], /^Back 1: Pelipper, no set yet\. Change$/);
  // a fifth pick is refused (Lead and Back are full); a placed one taps off; a slot's menu moves it
  await app.click({ pa: 'pb-pick', species: 'kangaskhan' });
  await flushSaves(app);
  assert.deepEqual(card(s).species.bring4, ['charizard', 'sinistcha', 'pelipper']);
  await app.click({ pa: 'pb-slot', species: 'sinistcha' });
  assert.ok(btns(app, 'pb-move').some((b) => b.to === 'back'));
  await app.click({ pa: 'pb-move', species: 'sinistcha', to: 'back' });
  await flushSaves(app);
  assert.deepEqual([card(s).species.lead, card(s).species.bring4], [['charizard'], ['charizard', 'sinistcha', 'pelipper']]);
});

test('Mega: one chip per Mega form; the attached set keeps its Mega link only when its stone matches the form', async (t) => {
  const s = device();
  const app = await open('prep/5v2/plan', { storage: s });
  t.after(() => app.restore());
  await app.click({ pa: 'pb-target', key: 'look-first' });
  await app.click({ pa: 'pb-pick', species: 'charizard' });
  assert.deepEqual(btns(app, 'pb-mega').map((b) => b.form), ['', 'charizardmegax', 'charizardmegay']);
  await app.click({ pa: 'pb-mega', species: 'charizard', form: 'charizardmegay' });
  await flushSaves(app);
  assert.deepEqual([card(s).species.mega, card(s).species.megaForm, card(s).mega], ['charizard', 'charizardmegay', SET_MINE], 'Sun Zard holds Charizardite Y');
  await app.click({ pa: 'pb-mega', species: 'charizard', form: 'charizardmegax' });
  await flushSaves(app);
  assert.deepEqual([card(s).species.megaForm, card(s).mega], ['charizardmegax', null], 'its set holds the Y stone, not X');
  await app.click({ pa: 'pb-mega', species: '', form: '' });
  await flushSaves(app);
  assert.deepEqual([card(s).species.mega, card(s).mega], ['', null]);
  assert.match(T(app), /One Mega per battle\./);
});

test('ideas from your 6 come with reasons and "not damage-checked"; using one fills the lead (an explicit tap)', async (t) => {
  const s = device();
  const app = await open('prep/5v2/plan', { storage: s });
  t.after(() => app.restore());
  await app.click({ pa: 'pb-target', key: 'look-first' });
  await buildSix(app, s);
  const tries = btns(app, 'pb-try');
  assert.equal(tries.length, 2);
  assert.match(T(app), /Lead ideas from your 6/);
  assert.match(T(app), /type and Speed, not damage-checked/);
  assert.equal(card(s), undefined, 'nothing until a tap');
  await app.click(tries[0]);
  await flushSaves(app);
  assert.deepEqual(card(s).species.lead, [tries[0].a, tries[0].b]);
  const verdict = find(root(app), (n) => hasClass(n, 'pb-verdict'));
  assert.ok(verdict, 'the chosen lead gets its headline and reasons');
  assert.ok(Object.values(C.BOARD.headline).some((h) => text(verdict).includes(h)), text(verdict));
  assert.match(text(verdict), /Your lead [A-Za-z-]+ \+ [A-Za-z-]+:/);
});

test('lights: Speed opens the Speed tool on the lead and their first mon; Calcs lists the key calcs and prefills one (asks first); Practised suggests a mock purpose', async (t) => {
  const s = device();
  const app = await open('prep/5v2/plan', { storage: s });
  t.after(() => app.restore());
  await app.click({ pa: 'pb-target', key: 'look-first' });
  await app.click({ pa: 'pb-pick', species: 'charizard' });
  await flushSaves(app);
  assert.deepEqual(findAll(root(app), (n) => hasClass(n, 'light')).map((n) => n.attrs['aria-label']),
    ['Speed: 0 of 2 looked at', 'Calcs: 0 of 2 run', 'Practised: 0 games (thought through)']);
  await app.click({ pa: 'pb-light-speed' });
  assert.match(app.location.hash, /^#prep\/w\/ws_[a-z2-7]{12}\/speed$|\/speed$/);
  assert.match(T(app), /Speed/);
  app.history.back(); await app.waitFor(() => /\/plan$/.test(app.location.hash), 'back to the board');
  await app.click({ pa: 'pb-light-calcs' });
  const runs = btns(app, 'pb-calc');
  assert.deepEqual(runs.map((b) => [b.mine, b.theirs]), [['charizard', 'gholdengo'], ['charizard', 'ninetalesalola']]);
  await app.click(runs[0]);
  await app.waitFor(() => /calcs\/new$/.test(app.location.hash), 'the quick check');
  assert.match(T(app), /Gholdengo/);
  app.history.back(); await app.waitFor(() => /\/plan$/.test(app.location.hash), 'back to the board');
  await app.click({ pa: 'pb-light-practised' });
  await app.waitFor(() => /\/brief$/.test(app.location.hash), 'the mock brief');
  assert.match(T(app), /Their look-first mons/);
});

test('fill a gap: one suggestion with its reason; your 6 changes only on Add; a covered 6 says there is no gap', async (t) => {
  const s = device({ ws: { my6: [] } });
  const app = await open('prep/5v2/plan', { storage: s });
  t.after(() => app.restore());
  await app.click({ pa: 'pb-gap' });
  const box = find(root(app), (n) => hasClass(n, 'gapbox'));
  assert.ok(box, 'the gap box');
  assert.match(text(box), /^Gap: /);
  const add = find(box, (n) => n.attrs['data-pa'] === 'pb-six' && hasClass(n, 'primary'));
  assert.ok(add, 'one suggestion, as an Add button');
  assert.ok(Object.values(C.BOARD.gapWhy).some((w) => text(box).includes(w)), 'with its reason in words');
  await app.click({ pa: 'pb-gap-next' });
  await flushSaves(app);
  assert.equal(doc(s).shortlist, undefined, 'looking at ideas saves nothing');
  await app.click({ pa: 'pb-six', species: add.attrs['data-species'] });
  await flushSaves(app);
  assert.deepEqual(doc(s).shortlist, [add.attrs['data-species']]);
  const full = device();
  const app2 = await open('prep/5v2/plan', { storage: full });
  t.after(() => app2.restore());
  await app2.click({ pa: 'pb-gap' });
  assert.ok(T(app2).includes(C.BOARD.gapNone), 'Charizard covers this small pool');
});

test('a v4 card (sets only) shows as species; the first board edit adds card.species and keeps every v4 field', async (t) => {
  const plan = { id: 'plan_aaaaaaaaaaaa', label: 'Their sun', kind: 'likely', members: ['gholdengo', 'ninetalesalola'], megaUser: null, speedMode: 'none', field: '', needs: '', basis: [], falsifiers: { atPreview: [], inGame: [] }, updatedAt: NOW };
  const old = { id: 'card_aaaaaaaaaaaa', kind: 'plan', vsPlanIds: [plan.id], bring4: [SET_MINE], lead: [SET_MINE], back: [], mega: SET_MINE, turn1Intent: 'Heat Wave turn 1', winCondition: 'sun up late', ifThen: [{ trigger: { theirLead: ['gholdengo'] }, response: 'protect' }], infoPlan: [], updatedAt: NOW };
  const s = device({ ws: { plans: [plan], cards: [old] } });
  assert.equal(doc(s).schemaVersion, 2, 'a v4 document');
  const app = await open('prep/5v2/plan', { storage: s });
  t.after(() => app.restore());
  assert.deepEqual(slots(app).map((n) => n.attrs['data-species'] ?? null), ['charizard', null, null, null]);
  assert.ok(btns(app, 'pb-mega').some((b) => b.form === 'charizardmegay' && find(root(app), (n) => n.attrs['data-form'] === 'charizardmegay' && n.attrs['aria-pressed'] === 'true')), 'its Mega read from the set\'s stone');
  await app.click({ pa: 'pb-pick', species: 'sinistcha' });
  await flushSaves(app);
  const c = card(s);
  assert.deepEqual(c.species, { bring4: ['charizard', 'sinistcha'], lead: ['charizard', 'sinistcha'], mega: 'charizard', megaForm: 'charizardmegay' });
  assert.deepEqual([c.bring4, c.lead, c.mega, c.turn1Intent, c.winCondition, c.ifThen, c.id], [[SET_MINE], [SET_MINE], SET_MINE, 'Heat Wave turn 1', 'sun up late', old.ifThen, old.id]);
  assert.equal(doc(s).schemaVersion, 3);
  // Game day reads the card's species
  await app.click({ pa: 'go-gameday' });
  await app.click({ pa: 'match-start' });
  for (const sp of ['gholdengo', 'ninetalesalola']) await app.click({ pa: 'gd-their6', species: sp });
  assert.match(T(app), /Their sun card: lead Charizard \+ Sinistcha\. Turn 1: Heat Wave turn 1/);
});

test('earlier prep (not yet assigned) shows its saved plans read-only: no board picks are written', async (t) => {
  const s = device({ legacy: true });
  const app = await open(`prep/w/${WS}/plan`, { storage: s });
  t.after(() => app.restore());
  assert.ok(T(app).includes(C.BOARD.locked.earlier));
  assert.equal(slots(app).length, 0);
  const before = snap(s);
  await app.click({ pa: 'pb-pick', species: 'charizard' });
  await app.click({ pa: 'pb-six', species: 'sinistcha' });
  await flushSaves(app);
  assert.equal(snap(s), before);
});

test('preparing as another coach: species picks go to that perspective\'s prep; your library is never attached or offered', async (t) => {
  const s = device();
  const app = await open('prep/2v5/plan', { storage: s });
  t.after(() => app.restore());
  await app.click({ pa: 'match-start-ws', tab: 'plan' });
  await app.waitFor(() => slots(app).length === 4, 'the board for Ning vs Anthony');
  await app.click({ pa: 'pb-six', species: 'rillaboom' });
  await app.click({ pa: 'pb-pick', species: 'rillaboom' });
  await flushSaves(app);
  const ws = [...s.map.keys()].filter((k) => k.startsWith('drafarig.prep.ws.')).map((k) => JSON.parse(s.getItem(k))).find((w) => w.pov === 'Ning');
  const c = ws.cards.find((x) => x.kind === 'plan');
  assert.deepEqual([c.species.bring4, c.bring4], [['rillaboom'], []]);
  await app.click({ pa: 'pb-slot', species: 'rillaboom' });
  assert.equal(btns(app, 'brief-set').length, 0, 'no "Start a set" from your library while preparing as Ning');
  assert.deepEqual(doc(s).cards, [], 'your own prep vs Ning is untouched');
});

test('a document saved by a newer Drafarig makes the board read-only: every slot and tile is disabled and taps write nothing', async (t) => {
  const s = device();
  s.setItem(wsKey(WS), JSON.stringify({ ...doc(s), schemaVersion: 9 }));
  const app = await open('prep/5v2/plan', { storage: s });
  t.after(() => app.restore());
  assert.ok(T(app).includes(C.SAVE.newer));
  assert.ok(slots(app).length === 4 && slots(app).every((n) => n.attrs.disabled !== undefined));
  assert.ok(findAll(root(app), (n) => n.attrs['data-pa'] === 'pb-pick').every((n) => n.attrs.disabled !== undefined));
  const before = snap(s);
  await app.click({ pa: 'pb-pick', species: 'charizard' });
  await app.click({ pa: 'pb-try', a: 'charizard', b: 'sinistcha' });
  await flushSaves(app);
  assert.equal(snap(s), before);
});

test('accessibility and honesty: unique names for slots, tiles and lights; portraits only from the sprite helper; plan names escaped; no damage, win or odds words', async (t) => {
  const plan = { id: 'plan_bbbbbbbbbbbb', label: '<img src=x onerror=alert(1)>', kind: 'likely', members: ['gholdengo'], megaUser: null, speedMode: 'trick-room', field: '', needs: '', basis: [], falsifiers: { atPreview: ['gholdengo'], inGame: [] }, updatedAt: NOW };
  const s = device({ ws: { plans: [plan], shortlist: ['sinistcha', 'pelipper'] } });
  const app = await open('prep/5v2/plan', { storage: s });
  t.after(() => app.restore());
  await app.click({ pa: 'pb-pick', species: 'charizard' });
  const r = root(app);
  assert.ok(!app.html().includes('<img src=x'), 'escaped');
  const named = findAll(r, (n) => n.tag === 'button' && ['pb-slot', 'pb-pick', 'pb-target'].includes(n.attrs['data-pa']) || hasClass(n, 'light'));
  const names = named.map((n) => n.attrs['aria-label']);
  assert.ok(names.every(Boolean), 'every one has a name');
  assert.equal(new Set(names).size, names.length, `unique names: ${names.join(' | ')}`);
  for (const img of findAll(find(r, (n) => hasClass(n, 'pboard')), (n) => n.tag === 'img')) assert.ok(isPortrait(img), img.attrs.src);
  assert.equal(findAll(r, (n) => n.attrs['aria-live'] !== undefined).length, 0, 'no live region inside #main (the app\'s #live speaks)');
  const words = text(find(r, (n) => hasClass(n, 'pboard')));
  for (const re of [/\bcounters?\b/i, /\bbeats?\b/i, /\bwins\b/i, /favou?red/i, /\bsafe\b/i, /guaranteed/i, /%/, /odds/i]) assert.doesNotMatch(words, re);
  assert.match(words, /\(Trick Room\)|not damage-checked/);
});

test('two cards against one plan (as v4 allowed): the board edits the first and lists the other, which still opens', async (t) => {
  const plan = { id: 'plan_aaaaaaaaaaaa', label: 'Their sun', kind: 'likely', members: ['gholdengo'], megaUser: null, speedMode: 'none', field: '', needs: '', basis: [], falsifiers: { atPreview: [], inGame: [] }, updatedAt: NOW };
  const mk = (id, lead) => ({ id, kind: 'plan', vsPlanIds: [plan.id], bring4: lead, lead, back: [], mega: null, turn1Intent: '', winCondition: '', ifThen: [], infoPlan: [], updatedAt: NOW });
  const s = device({ ws: { plans: [plan], cards: [mk('card_aaaaaaaaaaaa', [SET_MINE]), mk('card_bbbbbbbbbbbb', [])] } });
  const app = await open('prep/5v2/plan', { storage: s });
  t.after(() => app.restore());
  assert.match(T(app), /Other cards vs this plan: Card 2/);
  const other = btns(app, 'open-card').find((b) => b.card === 'card_bbbbbbbbbbbb');
  assert.ok(other);
  await app.click({ pa: 'pb-pick', species: 'sinistcha' });
  await flushSaves(app);
  const cards = doc(s).cards;
  assert.deepEqual([cards[0].species?.bring4, cards[1].species], [['charizard', 'sinistcha'], undefined], 'only the first card changed');
  await app.click(other);
  assert.match(app.location.hash, /\/card\/card_bbbbbbbbbbbb$/);
});

test('review fixes on the board: first use with no 6 opens your 10 right away and an empty slot is never a dead tap; Trick Room words; an unchosen Mega form is not shown as chosen', async (t) => {
  const fresh = device({ ws: { my6: [] } });
  const app = await open('prep/5v2/plan', { storage: fresh });
  t.after(() => app.restore());
  assert.ok(T(app).includes(C.BOARD.pickSix));
  assert.ok(findAll(root(app), (n) => n.attrs['data-pa'] === 'pb-six').length >= 4, 'your 10 to pick from, without a tap');
  assert.ok(T(app).includes(C.BOARD.tapHintNoSix));
  const before = snap(fresh);
  await app.click({ pa: 'pb-slot', role: 'lead', i: '0' });
  assert.ok(findAll(root(app), (n) => n.attrs['data-pa'] === 'pb-six').length >= 4, 'still right there');
  await flushSaves(app);
  assert.equal(snap(fresh), before);
  // Trick Room: Charizard and Sinistcha are faster than Torkoal at any investment, so under Trick Room they move after it
  const plan = { id: 'plan_aaaaaaaaaaaa', label: 'Their Trick Room', kind: 'likely', members: ['torkoal'], megaUser: null, speedMode: 'trick-room', field: '', needs: '', basis: [], falsifiers: { atPreview: ['torkoal'], inGame: [] }, updatedAt: NOW };
  const s = device({ coach: 'Jacky', ws: { plans: [plan], shortlist: ['sinistcha'] } });
  const tr = await open('prep/5v4/plan', { storage: s });
  t.after(() => tr.restore());
  await tr.click({ pa: 'pb-pick', species: 'charizard' });
  await tr.click({ pa: 'pb-pick', species: 'sinistcha' });
  const verdict = text(find(root(tr), (n) => hasClass(n, 'pb-verdict')));
  assert.match(verdict, /Charizard moves after Torkoal \(Trick Room: slower moves first\)/);
  assert.doesNotMatch(text(find(root(tr), (n) => hasClass(n, 'pboard'))), /faster than|slower than/);
  // a v4 card whose Mega set holds no stone: Charizard has two Mega forms and none was chosen
  const noStone = device({ mine: { item: 'heavydutyboots' }, ws: { plans: [plan], cards: [{ id: 'card_aaaaaaaaaaaa', kind: 'plan', vsPlanIds: [plan.id], bring4: [SET_MINE], lead: [SET_MINE], back: [], mega: SET_MINE, turn1Intent: '', winCondition: '', ifThen: [], infoPlan: [], updatedAt: NOW }] } });
  const m = await open('prep/5v2/plan', { storage: noStone });
  t.after(() => m.restore());
  const chips = findAll(root(m), (n) => n.attrs['data-pa'] === 'pb-mega' && n.attrs['data-species'] === 'charizard');
  assert.equal(chips.length, 2);
  assert.ok(chips.every((n) => n.attrs['aria-pressed'] === 'false'), 'neither form is shown as chosen');
  assert.match(T(m), /Pick Charizard Mega-X or Charizard Mega-Y/);
});

test('a matchup with no prep yet opens straight on the board: looking saves nothing; the first pick creates the prep and keeps the plan you selected', async (t) => {
  const s = device();
  const app = await open('prep/5v8/plan', { storage: s });
  t.after(() => app.restore());
  assert.equal(slots(app).length, 4, 'the board, not a "Start" panel');
  assert.equal(btns(app, 'match-start-ws').length, 0);
  assert.match(T(app), /Nothing is saved for Anthony vs Calvin yet: your first pick starts the prep/);
  const before = snap(s);
  const keys = pills(app).map((n) => n.attrs['data-key']);
  await app.click({ pa: 'pb-target', key: keys[keys.length - 1] });
  await app.click({ pa: 'pb-gap' });
  await app.click({ pa: 'pb-slot', role: 'lead', i: '0' });
  await flushSaves(app);
  assert.equal(snap(s), before, 'looking around saves nothing');
  await app.click({ pa: 'pb-pick', species: 'charizard' });
  await flushSaves(app);
  const made = [...s.map.keys()].filter((k) => k.startsWith('drafarig.prep.ws.')).map((k) => JSON.parse(s.getItem(k))).find((w) => w.coach === 'Calvin');
  assert.ok(made, 'the prep exists now');
  assert.equal(made.pov, 'Anthony');
  const plan = made.plans.find((p) => made.cards[0].vsPlanIds.includes(p.id));
  assert.equal(plan.basis[0], keys[keys.length - 1].startsWith('core:') ? keys[keys.length - 1].split(':')[1] : keys[keys.length - 1], 'the plan you had selected');
  assert.deepEqual(made.cards[0].species.lead, ['charizard']);
  assert.match(app.location.hash, /^#prep\/5v8\/plan$/);
  assert.match(T(app), /Game 2 cards/, 'the rest of Plan appears once the prep exists');
});

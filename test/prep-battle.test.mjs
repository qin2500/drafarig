// Battle Prep as an app of its own (public/app.js + public/prep*.js) in the stub DOM of test/ui-harness.mjs: routes and
// history, perspective and ownership, earlier (unassigned) prep, unsaved drafts across every kind of navigation, the visual
// briefing's markup and honesty, its routes into Sets / Calcs / Practice, and missing data. Markup and behaviour only: no
// pixels, layout, touch or screen-reader output are checked here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bootApp, memoryStorage, parseHtml, parseCss, findAll, find, text, hasClass } from './ui-harness.mjs';
import { T, btns, flushSaves, device, isPortrait, WS, SET_MINE, NOW } from './prep-helpers.mjs';
import { createStore } from '../lib/prep-store.mjs';
import { KEYS, wsKey } from '../lib/prep-schema.mjs';
import * as C from '../public/prep-copy.js';

const ROOT = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');
const NAMES = /hex|ning|zhuzi|jacky|anthony|taro|calvin|dingding|data\b|charizard|tyranitar|salamence|rillaboom/i;
const HASH_OK = /^#prep(\/(rules|backup|pilot|my-sets(\/(import|[a-z]+_[a-z2-7]{12}))?|[1-9][0-9]?(v[1-9][0-9]?(\/(brief|plan|sets|calcs|practice|(their|your)\/[1-9][0-9]?|core\/[a-z][a-z0-9-]*))?)?|w\/[a-z]+_[a-z2-7]{12}(\/[a-z]+(\/([a-z]+_[a-z2-7]{12}|new))?)?))?$/;
const ready = (app) => app.waitFor(() => !/Checking what they can learn/.test(app.html()), 'the Reg M-C data', 20000);
async function open(mode, opts = {}) { const app = await bootApp({ mode, ...opts }); await ready(app); return app; }
const root = (app) => parseHtml(app.html());
const wsKeys = (s) => [...s.map.keys()].filter((k) => k.startsWith('drafarig.prep.ws.'));
const docs = (s) => wsKeys(s).map((k) => JSON.parse(s.getItem(k)));
const prepSnapshot = (s) => JSON.stringify([...s.map].filter(([k]) => k.startsWith('drafarig.prep.') && !k.startsWith('drafarig.prep.hint.')).sort());
const parseCssFile = () => parseCss(read('public/styles.css'));
const go = async (app, hash) => { app.location.hash = hash; await app.fire('popstate'); await ready(app); };

// ---------- routes, history, many opponents ----------
test('history: overview → opponent pushes; another opponent and section tabs replace; sheets and tools push; Back goes up; no names in any address', async (t) => {
  const app = await open('prep');
  t.after(() => app.restore());
  assert.equal(app.location.hash, '#prep/5', '#prep is spelled as the default perspective\'s overview (replace)');
  assert.equal(app.history.length, 1);
  await app.click({ pa: 'go-opp', opp: '4' });
  assert.deepEqual([app.location.hash, app.history.length], ['#prep/5v4', 2], 'overview → opponent pushes');
  await app.click({ pa: 'go-opp', opp: '2' });
  assert.deepEqual([app.location.hash, app.history.length], ['#prep/5v2', 2], 'opponent → opponent replaces');
  await app.click({ pa: 'tab', tab: 'brief' });
  assert.equal(app.history.length, 2);
  await app.click({ pa: 'brief-open', side: 'their', n: '1' });
  assert.deepEqual([app.location.hash, app.history.length], ['#prep/5v2/their/1', 3], 'a detail sheet pushes');
  assert.match(T(app), /Rillaboom: against your pool/);
  await app.key('Escape');
  await app.waitFor(() => app.location.hash === '#prep/5v2', 'Escape closes the sheet');
  await app.click({ pa: 'flip' });
  assert.equal(app.location.hash, '#prep/2v5', '"See it from their side" pushes the swapped seats');
  assert.match(T(app), /Preparing as Ning/);
  app.history.back();
  await app.waitFor(() => app.location.hash === '#prep/5v2' && /Preparing as Anthony/.test(T(app)), 'Back un-flips');
  app.history.back();
  await app.waitFor(() => app.location.hash === '#prep/5', 'Back goes up to the overview, not to the other opponent');
  for (const h of app.history.entries()) { assert.match(h, HASH_OK, h); assert.ok(!NAMES.test(h), h); }
});

test('nine opponents: one row in seat order without the perspective, exactly one current, a jump list, and arrows move between them', async (t) => {
  const app = await open('prep/5v6');
  t.after(() => app.restore());
  const strip = find(root(app), (n) => n.tag === 'nav' && n.attrs['aria-label'] === 'Opponents');
  const links = findAll(strip, (n) => n.tag === 'a');
  assert.deepEqual(links.map((a) => a.attrs.href), ['#prep/5', '#prep/5v1', '#prep/5v2', '#prep/5v3', '#prep/5v4', '#prep/5v6', '#prep/5v7', '#prep/5v8', '#prep/5v9', '#prep/5v10']);
  assert.deepEqual(links.filter((a) => a.attrs['aria-current'] === 'page').map((a) => a.attrs.href), ['#prep/5v6']);
  assert.ok(links.slice(1).every((a) => a.attrs['aria-label'] && findAll(a, isPortrait).length + findAll(a, (n) => hasClass(n, 'noimg')).length >= 1), 'every opponent tab has a face and a name');
  const jump = find(strip, (n) => n.tag === 'select');
  assert.equal(jump.attrs['aria-label'], C.BRIEF.jumpLabel);
  assert.equal(findAll(jump, (n) => n.tag === 'option').length, 10);
  await app.changeData({ pc: 'opp-jump' }, { value: '9' });
  assert.equal(app.location.hash, '#prep/5v9');
  // arrow keys in the row (stub elements: the handler moves focus to the neighbouring link)
  const focused = [];
  const mk = (i) => ({ i, focus() { focused.push(i); }, scrollIntoView() {}, closest(sel) { return sel === '.oppstrip a' ? this : sel === 'ol' ? ol : null; } });
  const items = [0, 1, 2, 3].map(mk);
  const ol = { querySelectorAll: () => items };
  await app.key('ArrowRight', items[1]);
  await app.key('ArrowLeft', items[1]);
  await app.key('End', items[0]);
  await app.key('Home', items[3]);
  assert.deepEqual(focused, [2, 0, 3, 0]);
});

test('malformed and unknown addresses land somewhere safe, never throw, never create', async (t) => {
  const storage = device();
  const app = await open('prep', { storage });
  t.after(() => app.restore());
  const before = prepSnapshot(storage);
  for (const [h, re, hash] of [['#prep/5v5', /Battle Prep as Anthony/, '#prep/5'], ['#prep/99v1', /That seat isn't on the league sheet/, null], ['#prep/5v', /Battle Prep as Anthony/, '#prep/5'],
    ['#prep/5v4/their/11', /vs Jacky/, '#prep/5v4'], ['#prep/5v4/core/%3Cscript%3E', /vs Jacky/, '#prep/5v4'], ['#prep/5v4/nonsense/1', /vs Jacky/, '#prep/5v4'], ['#prep/0v4', /Battle Prep as Anthony/, '#prep/5'],
    ['#prep/5v4/their/7', /Not drafted/, '#prep/5v4/their/7'], ['#prep/5v4/core/sun', /Not in this matchup|Their plan/, '#prep/5v4/core/sun']]) {
    await go(app, h);
    assert.match(T(app), re, h);
    assert.ok(!/couldn't be shown|Not on this device/.test(T(app)), h);
    if (hash) assert.equal(app.location.hash, hash, h);
  }
  await flushSaves(app);
  assert.equal(prepSnapshot(storage), before, 'no address creates or changes a document');
});

test('app switch: Battle Prep ↔ Draft keeps the matchup, adds no history, and lands pending edits first', async (t) => {
  const storage = device();
  const app = await open(`prep/w/${WS}/plan`, { storage });
  t.after(() => app.restore());
  await app.input('ws-premortem', 'their Fake Out pressure');
  assert.ok(!storage.getItem(wsKey(WS)).includes('their Fake Out pressure'), 'still waiting for the autosave');
  const n = app.history.length;
  await app.click({ appLink: 'draft' });
  assert.ok(storage.getItem(wsKey(WS)).includes('their Fake Out pressure'), 'written before Draft rendered');
  assert.equal(app.body.dataset.app, 'draft');
  await app.click({ appLink: 'prep' });
  assert.equal(app.location.hash, `#prep/w/${WS}/plan`);
  assert.equal(app.history.length, n);
});

// ---------- perspective ----------
test('perspective: a Draft setting that isn\'t on the sheet gives a picker and no default (never seat 5)', async (t) => {
  const storage = memoryStorage({ 'drafarig.coach': '"Zed"' });
  const app = await open('prep', { storage });
  t.after(() => app.restore());
  assert.equal(app.location.hash, '#prep');
  assert.match(T(app), /Who are you preparing as\?/);
  assert.ok(!/Preparing as/.test(T(app)));
  const pick = find(root(app), (n) => n.tag === 'select' && n.attrs['data-pc'] === 'pov-pick');
  assert.ok(!findAll(pick, (o) => o.tag === 'option' && 'selected' in o.attrs && o.attrs.value).length, 'no coach preselected');
  await app.changeData({ pc: 'pov-pick' }, { value: '7' });
  assert.equal(app.location.hash, '#prep/7');
  assert.match(T(app), /Preparing as 17 chosen here/);
  await app.click({ appLink: 'draft' });
  assert.equal(storage.getItem('drafarig.coach'), '"Zed"', 'Draft\'s stand-in coach is never saved over the setting');
});

test('perspective: a confirmed identity wins; another coach is "viewing as" with a way back; switching never writes ownership', async (t) => {
  const storage = device();
  storage.setItem('drafarig.coach', '"Ning"');
  const app = await open('prep', { storage });
  t.after(() => app.restore());
  assert.equal(app.location.hash, '#prep/5', 'the confirmed identity (Anthony) beats the Draft setting (Ning)');
  assert.match(T(app), /Preparing as Anthony ✓ you/);
  const before = prepSnapshot(storage);
  await app.click({ pa: 'go-opp', opp: '6' });
  await app.changeData({ pc: 'pov-pick' }, { value: '4' });
  assert.equal(app.location.hash, '#prep/4v6', 'same opponent, new perspective (replace)');
  assert.match(T(app), /Viewing as Jacky: not your side\./);
  assert.ok(!btns(app, 'confirm-me').length, 'no "Is this you?" for a perspective you chose');
  await app.changeData({ pc: 'pov-pick' }, { value: '6' });
  assert.equal(app.location.hash, '#prep/6', 'the opponent becomes the perspective: its overview');
  await app.click({ pa: 'pov-back' });
  assert.equal(app.location.hash, '#prep/5');
  await flushSaves(app);
  assert.equal(prepSnapshot(storage), before, 'perspective changes write nothing');
});

test('"Is this you? Yes" confirms only the exact name it showed, only while it is the default; it assigns no saved prep', async (t) => {
  const storage = device({ legacy: true });
  const st = createStore(storage);
  const m = st.load(KEYS.meta).doc;
  st.save(KEYS.meta, { ...m, myCoach: null, myCoachConfirmed: false }, m.rev);
  const wsBefore = storage.getItem(wsKey(WS));
  const app = await open('prep', { storage });
  t.after(() => app.restore());
  assert.match(T(app), /Is this you\?/);
  await app.click({ pa: 'confirm-me', coach: 'Jacky' });
  await flushSaves(app);
  assert.equal(JSON.parse(storage.getItem(KEYS.meta)).myCoachConfirmed, false, 'a name that isn\'t the one shown is ignored');
  await app.click({ pa: 'confirm-me', coach: 'Anthony' });
  await flushSaves(app);
  const meta = JSON.parse(storage.getItem(KEYS.meta));
  assert.deepEqual([meta.myCoach, meta.myCoachConfirmed], ['Anthony', true]);
  assert.equal(storage.getItem(wsKey(WS)), wsBefore, 'the earlier workspace is untouched: still nobody\'s');
  assert.equal(JSON.parse(wsBefore).pov, undefined);
});

// ---------- ownership and isolation ----------
test('saved prep is per perspective × opponent: looking creates nothing; a section tap creates a version-2 workspace for that perspective only', async (t) => {
  const storage = memoryStorage();
  const app = await open('prep', { storage });
  t.after(() => app.restore());
  for (const seat of [1, 2, 3, 4, 6, 7, 8, 9, 10]) { await app.click({ pa: 'go-opp', opp: String(seat) }); assert.match(T(app), /Look at these first|Their likely game plans/); }
  assert.equal(wsKeys(storage).length, 0, 'nine briefings, no saved document');
  await app.click({ pa: 'go-opp', opp: '6' });
  await app.click({ pa: 'tab', tab: 'sets' });
  await flushSaves(app);
  assert.equal(app.location.hash, '#prep/5v6/sets');
  const [w] = docs(storage);
  assert.deepEqual([w.pov, w.coach, w.schemaVersion, w.povFrom], ['Anthony', 'Taro', 2, 'created']);
  // as Jacky, against the same Taro: a different workspace; Anthony's isn't shown or used
  await app.changeData({ pc: 'pov-pick' }, { value: '4' });
  assert.equal(app.location.hash, '#prep/4v6/sets');
  assert.match(T(app), /Start Jacky's prep vs Taro/, 'nothing saved for Jacky yet: it asks, nothing is reused');
  await app.click({ pa: 'match-start-ws', tab: 'sets' });
  await flushSaves(app);
  assert.deepEqual(docs(storage).map((d) => `${d.pov}|${d.coach}`).sort(), ['Anthony|Taro', 'Jacky|Taro']);
  await app.click({ pa: 'go-home' });
  assert.match(T(app), /Saved as other coaches \(1\)/, 'Jacky\'s overview lists Anthony\'s prep apart');
});

test('viewing as another coach never writes your own library (My sets), and your sets aren\'t shown as theirs', async (t) => {
  const storage = device();
  const app = await open('prep/4v6/sets', { storage });
  t.after(() => app.restore());
  await app.click({ pa: 'match-start-ws', tab: 'sets' });
  const mysets = storage.getItem(KEYS.mysets);
  assert.match(T(app), /Viewing as Jacky: your own sets \(My sets\) aren't listed or changed here/);
  await app.click({ pa: 'my-create', species: 'incineroar' });
  await flushSaves(app);
  assert.equal(storage.getItem(KEYS.mysets), mysets);
  assert.match(app.toast.textContent, /My sets is your own library/);
  await app.click({ pa: 'pov-back' });
  await app.click({ pa: 'tab', tab: 'sets' });
  assert.ok(btns(app, 'toggle-six').some((b) => b.set === SET_MINE), 'as yourself your sets are there');
});

test('"Next match" is one per perspective: marking one never clears another coach\'s mark', async (t) => {
  const storage = memoryStorage();
  const app = await open('prep/4v6', { storage });
  t.after(() => app.restore());
  await app.click({ pa: 'brief-next' });
  await app.changeData({ pc: 'pov-pick' }, { value: '5' });
  await app.click({ pa: 'go-opp', opp: '2' });
  await app.click({ pa: 'brief-next' });
  await app.click({ pa: 'go-opp', opp: '6' });
  await app.click({ pa: 'brief-next' });
  await flushSaves(app);
  const next = Object.fromEntries(docs(storage).map((d) => [`${d.pov}|${d.coach}`, d.isNext]));
  assert.deepEqual(next, { 'Jacky|Taro': true, 'Anthony|Ning': false, 'Anthony|Taro': true });
});

// ---------- earlier (unassigned) prep ----------
test('earlier prep: never anyone\'s by default, reviewed one at a time with its facts, assigned explicitly, undoable and unassignable', async (t) => {
  const storage = device({ legacy: true });
  const app = await open('prep/5v2', { storage });
  t.after(() => app.restore());
  assert.match(T(app), /You also have earlier prep vs Ning that isn't tied to a coach yet/);
  assert.match(T(app), /Not started/, 'the briefing doesn\'t treat it as Anthony\'s');
  await app.click({ pa: 'tab', tab: 'plan' });
  assert.equal(wsKeys(storage).length, 1, 'a section tap asks instead of creating a second workspace');
  assert.match(T(app), /Start Anthony's prep vs Ning/);
  await app.click({ pa: 'go-owner', ws: WS });
  assert.equal(app.location.hash, `#prep/w/${WS}/owner`);
  const s = T(app);
  for (const re of [/Whose prep vs Ning is this\?/, /Its 6: Charizard\./, /1 of their sets/, /Its saved copy of their roster shares 5 of its 5 Pokémon/, /Its 6: Charizard\./, /The Pokémon it uses as "yours" \(Charizard\) are all on Anthony's roster now/]) assert.match(s, re);
  await app.changeData({ pc: 'owner-pick', ws: WS }, { value: 'Jacky' });
  assert.match(T(app), /Not on Jacky's roster now: Charizard \(Anthony's now\)\. This may be another coach's prep\./);
  await app.changeData({ pc: 'owner-pick', ws: WS }, { value: 'Anthony' });
  await app.click({ pa: 'owner-assign', ws: WS, owner: 'Anthony' });
  await flushSaves(app);
  let w = JSON.parse(storage.getItem(wsKey(WS)));
  assert.deepEqual([w.pov, w.povFrom, w.schemaVersion], ['Anthony', 'legacy-confirm', 2]);
  assert.equal(app.location.hash, '#prep/5v2/plan', 'it is now Anthony\'s prep vs Ning');
  assert.match(T(app), /Earlier prep assigned\. Undo/);
  await app.click({ pa: 'undo-delete' });
  await flushSaves(app);
  w = JSON.parse(storage.getItem(wsKey(WS)));
  assert.deepEqual([w.pov, w.schemaVersion], [undefined, 1], 'Undo puts it back exactly (readable by older apps again)');
  // assign again, then unassign later from its review screen
  await go(app, `#prep/w/${WS}/owner`);
  await app.click({ pa: 'owner-assign', ws: WS, owner: 'Anthony' });
  await app.click({ pa: 'go-home' });
  await go(app, `#prep/w/${WS}/owner`);
  assert.match(T(app), /This is Anthony's prep vs Ning\. You assigned it from earlier prep on/);
  await app.click({ pa: 'owner-unassign', ws: WS });
  await flushSaves(app);
  w = JSON.parse(storage.getItem(wsKey(WS)));
  assert.deepEqual([w.pov, w.povFrom, w.schemaVersion], [undefined, undefined, 1]);
  assert.equal(JSON.parse(storage.getItem(wsKey(WS))).theirSets.length, 1, 'nothing else changed');
});

test('earlier prep can\'t be assigned to its own opponent or to a name off the sheet, and a created workspace can\'t be "unassigned"', async (t) => {
  const storage = device({ legacy: true });
  const app = await open(`prep/w/${WS}/owner`, { storage });
  t.after(() => app.restore());
  const before = storage.getItem(wsKey(WS));
  await app.click({ pa: 'owner-assign', ws: WS, owner: 'Ning' });
  await app.click({ pa: 'owner-assign', ws: WS, owner: 'Somebody' });
  await flushSaves(app);
  assert.equal(storage.getItem(wsKey(WS)), before);
  await go(app, '#prep/5v6');
  await app.click({ pa: 'tab', tab: 'plan' });
  const created = docs(storage).find((d) => d.coach === 'Taro');
  await app.click({ pa: 'owner-unassign', ws: created.id });
  await flushSaves(app);
  assert.equal(JSON.parse(storage.getItem(wsKey(created.id))).pov, 'Anthony');
});

// ---------- unsaved drafts ----------
test('an unsaved quick check survives opponent, perspective and app switches and a reload; its tab shows a dot; a briefing check asks before replacing it', async (t) => {
  const storage = memoryStorage(), session = memoryStorage();
  const app = await open('prep/5v6', { storage, session });
  t.after(() => app.restore());
  const checks = btns(app, 'brief-calc');
  assert.ok(checks.length >= 2, 'the briefing offers prefilled checks');
  await app.click({ pa: 'brief-calc', ...checks[0] });
  assert.match(app.location.hash, /^#prep\/w\/ws_[a-z2-7]{12}\/calcs\/new$/, 'a prefilled check opens the quick check');
  const wsId = app.location.hash.split('/')[2];
  const cd = () => JSON.parse(session.getItem('drafarig.prep.ui') ?? '{}').ws?.[wsId]?.cd;
  app.history.back();
  await app.waitFor(() => app.location.hash === '#prep/5v6', 'Back to the briefing');
  assert.equal(cd()?.move, checks[0].move, 'kept for this tab');
  const tab = findAll(root(app), (n) => n.attrs['data-tab'] === 'calcs')[0];
  assert.match(tab.attrs['aria-label'], /Calcs, unsaved quick check/);
  // a different check: asks first
  const other = checks.find((c) => c.move !== checks[0].move || c.dspecies !== checks[0].dspecies);
  await app.click({ pa: 'brief-calc', ...other });
  assert.equal(app.location.hash, '#prep/5v6', 'nothing replaced, nothing opened yet');
  assert.match(T(app), /You have an unsaved quick check/);
  await app.click({ pa: 'draft-cancel' });
  assert.equal(cd().move, checks[0].move);
  await app.click({ pa: 'go-opp', opp: '2' });
  await app.changeData({ pc: 'pov-pick' }, { value: '4' });
  await app.click({ appLink: 'draft' });
  await app.click({ appLink: 'prep' });
  assert.equal(cd().move, checks[0].move, 'survives opponent, perspective and app switches');
  const again = await open('prep/5v6', { storage, session });
  t.after(() => again.restore());
  await again.click({ pa: 'brief-calc', ...other });
  assert.match(T(again), /You have an unsaved quick check/, 'after a reload it is still there, and still protected');
  await again.click({ pa: 'draft-replace' });
  assert.match(again.location.hash, /\/calcs\/new$/);
  const cd2 = JSON.parse(session.getItem('drafarig.prep.ui')).ws[wsId].cd;
  assert.deepEqual([cd2.a.species, cd2.d.species, cd2.move], [other.aspecies, other.dspecies, other.move]);
});

test('briefing view state (scenario, compared rows, lens) is kept per matchup across a reload; Escape closes a pending question', async (t) => {
  const storage = memoryStorage(), session = memoryStorage();
  const app = await open('prep/5v6', { storage, session });
  t.after(() => app.restore());
  await app.changeData({ pc: 'brief-scenario' }, { value: 'tr' });
  const rows = findAll(root(app), (n) => n.attrs['data-pa'] === 'brief-sel').map((n) => n.attrs['data-key']);
  await app.click({ pa: 'brief-sel', key: rows[0] });
  await app.click({ pa: 'brief-sel', key: rows[1] });
  await flushSaves(app);
  const again = await open('prep/5v6', { storage, session });
  t.after(() => again.restore());
  const r = root(again);
  assert.ok(find(r, (n) => n.tag === 'input' && n.attrs.value === 'tr' && 'checked' in n.attrs), 'Trick Room still chosen');
  assert.equal(findAll(r, (n) => n.attrs['data-pa'] === 'brief-sel' && n.attrs['aria-pressed'] === 'true').length, 2);
  assert.ok(find(r, (n) => hasClass(n, 'verdict')), 'the comparison sentence is back');
});

// ---------- the briefing ----------
test('the briefing leads with portraits: their pool rings what to look at first; every image is a verified portrait beside its name', async (t) => {
  const app = await open('prep/5v6', { narrow: false });
  t.after(() => app.restore());
  const r = root(app);
  const pool = find(r, (n) => n.tag === 'section' && n.attrs.id === 'bs-pool');
  const cards = findAll(pool, (n) => n.attrs['data-pa'] === 'brief-open' && n.attrs['data-side'] === 'their');
  assert.equal(cards.length, 4, 'Taro\'s 4 drafted');
  assert.equal(findAll(pool, (n) => hasClass(n, 'pcard') && hasClass(n, 'open')).length, 6, '6 open picks shown as open, never guessed');
  const ringed = cards.filter((c) => hasClass(c, 'ring-look-first'));
  assert.deepEqual(ringed.map((c) => c.attrs['aria-label'].split(',')[0]), ['Tyranitar', 'Salamence', 'Sneasler']);
  assert.ok(ringed.every((c) => /look first, \d of 3/.test(c.attrs['aria-label'])), 'the ring is said in words');
  assert.ok(cards.every((c) => findAll(c, isPortrait).length === 1 && find(c, (n) => hasClass(n, 'pname'))), 'portrait + written name');
  const imgs = findAll(r, (n) => n.tag === 'img');
  assert.ok(imgs.length >= 20 && imgs.every(isPortrait), 'only verified portraits');
  assert.ok(!imgs.some((i) => /\/ani\//.test(i.attrs.src)), 'no animated sprites in Battle Prep');
  const big = imgs.filter((i) => Number(i.attrs.width) >= 64);
  assert.ok(big.some((i) => /home-centered\/tyranitar\.png$/.test(i.attrs.src) && /gen5\/tyranitar\.png$/.test(i.attrs['data-fb'])), 'large base forms: HOME art, gen5 fallback');
  for (const sec of ['pool', 'threats', 'plans', 'speed', 'useful', 'myplans', 'checks']) assert.ok(find(r, (n) => n.tag === 'section' && n.attrs.id === `bs-${sec}` && find(n, (h) => h.tag === 'h3')), sec);
});

test('Speed: assumptions always written, ranges in words, bands hidden from screen readers; Trick Room reorders and states its −7 priority', async (t) => {
  const app = await open('prep/5v6');
  t.after(() => app.restore());
  const fs = find(root(app), (n) => n.tag === 'fieldset' && hasClass(n, 'scen'));
  assert.equal(text(find(fs, (n) => n.tag === 'legend')), 'Scenario');
  assert.deepEqual(findAll(fs, (n) => n.tag === 'input').map((i) => [i.attrs.type, i.attrs.value]), [['radio', 'none'], ['radio', 'tw-mine'], ['radio', 'tw-theirs'], ['radio', 'tr']]);
  assert.ok(T(app).includes(C.BRIEF.assumptions));
  const rows = findAll(root(app), (n) => hasClass(n, 'srow'));
  assert.ok(rows.length >= 8);
  for (const li of rows) {
    const b = find(li, (n) => n.tag === 'button');
    assert.match(b.attrs['aria-label'], /(yours|theirs), \d+( to \d+)?/, 'both bounds in words');
    assert.equal(find(li, (n) => hasClass(n, 'strack')).attrs['aria-hidden'], 'true');
  }
  const tyr = rows.find((li) => /^Tyranitar, theirs/.test(find(li, (n) => n.tag === 'button').attrs['aria-label']));
  assert.match(find(tyr, (n) => n.tag === 'button').attrs['aria-label'], /theirs, 72 to 124/, 'exactly the Lv 50 range');
  const order = () => findAll(root(app), (n) => hasClass(n, 'srow')).map((li) => +/(\d+)(?: to (\d+))?/.exec(find(li, (n) => n.tag === 'button').attrs['aria-label'].split(', ').slice(2).join(', '))[1]);
  await app.changeData({ pc: 'brief-scenario' }, { value: 'tr' });
  const mins = order();
  assert.deepEqual(mins, [...mins].sort((a, b) => a - b), 'Trick Room: slowest first');
  assert.ok(T(app).includes(C.BRIEF.mechTrickRoom));
  assert.match(C.BRIEF.mechTrickRoom, /−7 priority/);
  assert.ok(!/starts next turn|takes effect next turn/i.test(T(app)), 'no delayed-effect claim');
  await app.changeData({ pc: 'brief-scenario' }, { value: 'tw-theirs' });
  assert.match(T(app), /Their Tailwind doubles theirs\./);
  assert.match(T(app), /Salamence \(if it Mega Evolves\)|Salamence-Mega \(if it Mega Evolves\)/);
});

test('the briefing never states damage, odds or outcomes; "could" content sits under "could, not will"; spec non-answers are reassurances, not threats', async (t) => {
  const app = await open('prep/4v9'); // Jacky (fields Trick Room) vs DIngDIng (Tailwind users)
  t.after(() => app.restore());
  const s = T(app);
  const bad = [/%/, /\bwin\b/i, /\bwins\b/i, /guarantee/i, /\bbeats\b/i, /\bcounters?\b/i, /\bwill (bring|lead|use|run)\b/i, /best pick/i, /known set/i, /win rate/i, /\bKO\b/];
  for (const re of bad) assert.ok(!re.test(s), `${re} in the briefing`);
  const my = find(root(app), (n) => n.attrs.id === 'bs-myplans');
  assert.match(text(my), /could, not will/);
  const tr = findAll(my, (n) => hasClass(n, 'mycore')).find((c) => /Trick Room/.test(text(c)));
  assert.ok(tr, 'Jacky\'s Trick Room plan');
  const could = findAll(tr, (n) => hasClass(n, 'cp')).map(text).join(' | ');
  assert.ok(!/Tailwind doesn't help/.test(could), could);
  assert.match(text(tr), new RegExp(C.BRIEF.reassureText['tr-tailwind'].slice(0, 40).replace(/[()]/g, '.')));
  assert.match(could, /Taunt/, 'a real answer (their Taunt) is still shown');
  for (const f of ['public/prep-matchup.js', 'lib/prep-matchup.mjs']) {
    const src = read(f).replace(/\/\/.*$/gm, '');
    assert.ok(!/couldBringAgainst/.test(src), `${f} doesn't use the old counter-prep list`);
    assert.ok(!/winrate|pika\b/.test(src), `${f} never reads ladder win rates`);
  }
});

test('routes from the briefing: Calc, Speed, What would it take?, Practice and Sets open the existing tools prefilled; Back returns to the briefing', async (t) => {
  const storage = memoryStorage(), session = memoryStorage();
  const app = await open('prep/5v6', { storage, session });
  t.after(() => app.restore());
  await app.click({ pa: 'brief-speed', a: 'tyranitar', b: 'charizard' });
  assert.match(app.location.hash, /^#prep\/w\/ws_[a-z2-7]{12}\/speed$/);
  assert.match(T(app), /Speed vs Taro/);
  const wsId = app.location.hash.split('/')[2];
  const ui = () => JSON.parse(session.getItem('drafarig.prep.ui') ?? '{}').ws?.[wsId] ?? {};
  await flushSaves(app);
  assert.deepEqual(ui().sp.sel, ['t:tyranitar', 'm:charizard']);
  app.history.back();
  await app.waitFor(() => app.location.hash === '#prep/5v6', 'Back');
  await app.changeData({ pc: 'brief-scenario' }, { value: 'tw-mine' });
  await app.click({ pa: 'brief-threshold', a: 'tyranitar', b: 'charizard' });
  assert.match(app.location.hash, /\/threshold$/);
  await flushSaves(app);
  assert.deepEqual([ui().th.kind, ui().th.theirSpecies, ui().th.tailwindMine, ui().th.trickRoom], ['outspeed', 'tyranitar', true, false]);
  app.history.back();
  await app.waitFor(() => app.location.hash === '#prep/5v6', 'Back');
  await app.click({ pa: 'brief-practice', purpose: 'Practise against their Tailwind + strong attackers plan' });
  assert.match(app.location.hash, /\/brief$/);
  assert.ok(btns(app, 'br-purpose').some((b) => b.value === 'Practise against their Tailwind + strong attackers plan'), 'offered as a suggestion to tap');
  assert.equal(find(root(app), (n) => n.attrs.id === 'br-purpose').attrs.value, '', 'the purpose stays yours to fill');
  app.history.back();
  await app.waitFor(() => app.location.hash === '#prep/5v6', 'Back');
  await app.click({ pa: 'brief-set', side: 'their', species: 'tyranitar' });
  assert.equal(app.location.hash, '#prep/5v6/sets');
  assert.match(T(app), /Their team/);
  await flushSaves(app);
  assert.equal(docs(storage).length, 1, 'one workspace for the matchup, reused by every route');
  assert.equal(docs(storage)[0].pov, 'Anthony');
});

test('+ My 6 shortlists for this matchup (saved with its prep) and the lens recomputes the briefing for your 6', async (t) => {
  const storage = memoryStorage();
  const app = await open('prep/5v6', { storage });
  t.after(() => app.restore());
  await app.click({ pa: 'brief-six', species: 'pelipper' });
  await app.click({ pa: 'brief-six', species: 'sinistcha' });
  await flushSaves(app);
  assert.deepEqual(docs(storage)[0].shortlist, ['pelipper', 'sinistcha']);
  assert.match(T(app), /My 6 2\/6/);
  await app.click({ pa: 'brief-lens', lens: '6' });
  const useful = find(root(app), (n) => n.attrs.id === 'bs-useful');
  const names = findAll(useful, (n) => hasClass(n, 'ucard')).map((c) => text(find(c, (x) => x.tag === 'b')));
  assert.ok(names.length && names.every((x) => ['Pelipper', 'Sinistcha'].includes(x)), names.join());
  assert.equal(find(root(app), (n) => hasClass(n, 'brief')).attrs['data-lens'], '6');
});

// ---------- missing data ----------
test('missing data: no Reg M-C data, no Cores spec, no ladder data, no league sheet — the briefing degrades by section and says why', async (t) => {
  const noMech = await bootApp({ mode: 'prep/5v6', files: { '/data/mechanics.json': JSON.stringify({ meta: { schema: 'not-it' } }) } });
  t.after(() => noMech.restore());
  await noMech.waitFor(() => /Look at these first/.test(T(noMech)), 'the brief');
  assert.ok(!/couldn't be shown/.test(T(noMech)));
  assert.ok(find(root(noMech), (n) => n.attrs.id === 'bs-pool'), 'portraits still render');
  assert.ok(findAll(root(noMech), (n) => n.tag === 'input' && n.attrs.name === 'brief-scenario' && 'disabled' in n.attrs).length === 3, 'only plain order without learnsets');
  const noCores = await open('prep/5v6', { files: { '/data/cores.json': '{"version": 99}' } });
  t.after(() => noCores.restore());
  assert.match(T(noCores), /Game plan detection isn't available right now/);
  assert.ok(find(root(noCores), (n) => n.attrs.id === 'bs-threats'), 'threats and Speed still work');
  assert.match(T(noCores), /Ladder data: the app's key moves list/);
  const storage = device();
  const noSheet = await bootApp({ mode: 'prep/5v6', sheet: false, storage });
  t.after(() => noSheet.restore());
  await noSheet.waitFor(() => /class="prep"/.test(noSheet.html()), 'prep');
  assert.match(T(noSheet), /league sheet hasn't loaded, so this seat is unknown/);
  assert.ok(!/Not on this device/.test(T(noSheet)));
  assert.equal(wsKeys(storage).length, 1, 'nothing created while seats are unknown');
});

test('a sprite that fails tries its fallback once, then becomes the initials disc (no broken image)', async (t) => {
  const app = await bootApp({ mode: 'draft' });
  t.after(() => app.restore());
  const cls = new Set(['spr']), parentCls = new Set();
  let removed = false;
  const img = { tagName: 'IMG', dataset: { fb: 'https://play.pokemonshowdown.com/sprites/gen5/x.png' }, src: 'a', classList: { contains: (c) => cls.has(c) }, parentElement: { classList: { add: (c) => parentCls.add(c) } }, remove() { removed = true; } };
  await app.fireDoc('error', { target: img });
  assert.equal(img.src, 'https://play.pokemonshowdown.com/sprites/gen5/x.png');
  assert.equal(img.dataset.fb, undefined);
  await app.fireDoc('error', { target: img });
  assert.ok(parentCls.has('noimg') && removed);
  const other = { tagName: 'IMG', dataset: {}, classList: { contains: () => false }, remove() { throw new Error('not ours'); } };
  await app.fireDoc('error', { target: other });
});

test('Draft links into Battle Prep: League coach cards open that matchup from your perspective; a finished roster offers Battle Prep', async (t) => {
  const app = await bootApp({ mode: 'league' });
  t.after(() => app.restore());
  const links = findAll(root(app), (n) => n.attrs['data-prep-vs']);
  const inCards = links.filter((n) => { for (let x = n.parent; x; x = x.parent) if (hasClass(x, 'coach-card')) return true; return false; });
  assert.equal(inCards.length, 9);
  // plus one per scheduled match of yours in the League schedule (Anthony: weeks 1, 3, 4, 5; week 2 is a bye)
  assert.deepEqual(links.filter((n) => !inCards.includes(n)).map((n) => n.attrs['data-prep-vs']), ['8', '3', '1', '4']);
  await app.click({ prepVs: '6' });
  await app.waitFor(() => app.location.hash === '#prep/5v6', 'the matchup');
  assert.equal(app.body.dataset.app, 'prep');
  assert.match(T(app), /vs Taro/);
});

// ---------- safety review regressions (B1–B4, S5, S6) ----------
import { RAW } from './ui-harness.mjs';
import { newWorkspace } from '../lib/prep-schema.mjs';
const swapSeats23 = () => ({ ...RAW, draftsCsv: RAW.draftsCsv.replace('2.Ning', '#SWAP#').replace('3.ZhuZi', '2.ZhuZi').replace('#SWAP#', '3.Ning') });

test('B1: earlier (unassigned) prep is read-only and nothing is inferred as "your side" until you say whose it is', async (t) => {
  const storage = device({ legacy: true });
  const app = await open(`prep/w/${WS}/plan`, { storage });
  t.after(() => app.restore());
  const before = storage.getItem(wsKey(WS)), mysets = storage.getItem(KEYS.mysets);
  assert.match(T(app), /Saved before perspectives and not tied to a coach yet, so it is read-only here/);
  await app.input('ws-premortem', 'typed into earlier prep');
  await app.click({ pa: 'ws-next' });
  await app.click({ pa: 'tab', tab: 'sets' });
  assert.ok(!btns(app, 'toggle-six').length, 'no "your 6" choices inferred for it');
  await app.click({ pa: 'toggle-six', set: SET_MINE });
  await app.click({ pa: 'my-create', species: 'charizard' });
  await flushSaves(app);
  assert.equal(storage.getItem(wsKey(WS)), before, 'not one byte changed');
  assert.equal(storage.getItem(KEYS.mysets), mysets, 'and nothing added to My sets from it');
  assert.match(app.toast.textContent, /say whose it is first/);
});

test('B3: a matchup stays on the workspace it opened, whatever the sheet\'s seats do (columns swapped mid-edit), and the address follows the coaches', async (t) => {
  const storage = device();
  const app = await open('prep/5v2/plan', { storage });
  t.after(() => app.restore());
  assert.match(T(app), /vs Ning · Plan/);
  app.setSheet(swapSeats23()); // the commissioner swaps seats 2 and 3 while the page is open
  await app.visibility(false); // the tab comes back into view: the sheet is re-read
  await app.input('ws-date', '2026-10-09');
  await flushSaves(app);
  const docsNow = docs(storage);
  assert.deepEqual(docsNow.map((d) => [d.coach, d.matchDate]), [['Ning', '2026-10-09']], 'the edit went to Ning\'s workspace; nothing was created for ZhuZi');
  await app.click({ pa: 'tab', tab: 'brief' });
  assert.equal(app.location.hash, '#prep/5v3', 'Ning is seat 3 now: the address is re-spelled for the same two coaches');
  assert.match(T(app), /vs Ning/);
});

test('B3: a newer copy saved in another tab never takes over the open matchup; the older copy opened by id stays the one edited', async (t) => {
  const storage = device();
  const app = await open('prep/5v2/plan', { storage });
  t.after(() => app.restore());
  const copy = { ...newWorkspace({ id: 'ws_bbbbbbbbbbbb', coach: 'Ning', roster: { speciesIds: [] }, now: '2026-10-05T00:00:00.000Z', pov: 'Anthony' }), updatedAt: '2026-10-05T00:00:00.000Z' };
  assert.ok(createStore(storage).save(wsKey(copy.id), copy, null).ok);
  await app.fire('storage', { key: wsKey(copy.id), newValue: storage.getItem(wsKey(copy.id)), oldValue: null });
  await app.input('ws-premortem', 'still the first one');
  await flushSaves(app);
  assert.equal(JSON.parse(storage.getItem(wsKey(WS))).premortem, 'still the first one');
  assert.equal(JSON.parse(storage.getItem(wsKey(copy.id))).premortem, '');
  // the older copy opened by its id (e.g. from a list): edits land there, and its sections stay on it
  await go(app, `#prep/w/${WS}/plan`);
  await app.click({ pa: 'tab', tab: 'sets' });
  assert.equal(app.location.hash, `#prep/w/${WS}/sets`);
  await app.click({ pa: 'tab', tab: 'plan' });
  await app.input('ws-premortem', 'edited by id');
  await flushSaves(app);
  assert.equal(JSON.parse(storage.getItem(wsKey(WS))).premortem, 'edited by id');
  // the brief from there is pinned to that copy too (Back/Forward entries remember it)
  await app.click({ pa: 'tab', tab: 'brief' });
  assert.equal(app.location.hash, '#prep/5v2');
  assert.equal(app.history.state.wsId, WS);
  assert.match(T(app), /2 copies|Most recent|Other copy/, 'two copies: a choice is offered, not a silent switch');
});

test('B3: Back and Forward return to the same two coaches even after the sheet\'s seats change', async (t) => {
  const storage = device();
  const app = await open('prep/5', { storage });
  t.after(() => app.restore());
  await app.click({ pa: 'go-opp', opp: '2' });
  assert.equal(app.history.state.names.opp, 'Ning');
  app.history.back();
  await app.waitFor(() => app.location.hash === '#prep/5', 'Back');
  app.setSheet(swapSeats23());
  await app.visibility(false);
  // Forward to the entry that showed Ning: still Ning (now seat 3), not whoever sits in seat 2 now
  app.history.forward();
  await app.waitFor(() => /vs Ning/.test(T(app)), 'Forward shows the same two coaches');
  assert.ok(!/vs ZhuZi/.test(T(app)));
  assert.equal(app.location.hash, '#prep/5v3', 'and the address is re-spelled with their seats now');
});

test('S5: Archive and Restore name whose prep each copy is (and when it changed), so the right one is removed or replaced', async (t) => {
  const storage = device();
  const st = createStore(storage);
  const legacy = { ...newWorkspace({ id: 'ws_cccccccccccc', coach: 'Ning', roster: { speciesIds: [] }, now: NOW }) };
  assert.ok(st.save(wsKey(legacy.id), legacy, null).ok);
  const app = await open('prep/backup', { storage });
  t.after(() => app.restore());
  const s = T(app);
  assert.match(s, /Anthony's prep vs Ning, changed 2026-10-04/);
  assert.match(s, /Earlier prep \(not tied to a coach\) vs Ning, changed 2026-10-04/);
  assert.ok(findAll(root(app), (n) => n.attrs['data-pa'] === 'ws-archive').every((b) => /^Archive (Anthony's prep|Earlier prep)/.test(b.attrs['aria-label'])));
});

test('S6: a file\'s workspace whose perspective is its own opponent is nobody\'s (listed for review, read-only), never a matchup', async (t) => {
  const storage = device();
  const self = newWorkspace({ id: 'ws_eeeeeeeeeeee', coach: 'Taro', roster: { speciesIds: [] }, now: NOW, pov: 'Taro' });
  assert.ok(createStore(storage).save(wsKey(self.id), self, null).ok);
  const app = await open('prep', { storage });
  t.after(() => app.restore());
  assert.match(T(app), /Saved before perspectives \(1\)/);
  await go(app, '#prep/6v6');
  assert.equal(app.location.hash, '#prep/6', 'a self-matchup address is the overview');
  await go(app, `#prep/w/${self.id}/plan`);
  await app.input('ws-premortem', 'x');
  await flushSaves(app);
  assert.equal(JSON.parse(storage.getItem(wsKey(self.id))).premortem, '');
});

// ---------- UX implementation review regressions ----------
test('U1: on a phone the opponent\'s portraits come before any other control: one facts line, Next match, the rest folded', async (t) => {
  const app = await open('prep/5v6', { narrow: true });
  t.after(() => app.restore());
  const r = root(app);
  const all = findAll(r, () => true);
  const grid = all.findIndex((n) => hasClass(n, 'poolgrid'));
  const selects = all.map((n, i) => [n, i]).filter(([n]) => n.tag === 'select').filter(([n]) => !['pov-pick', 'opp-jump'].includes(n.attrs['data-pc']));
  assert.ok(grid > 0 && selects.every(([, i]) => i > grid), 'no other select above their portraits');
  const acts = find(r, (n) => hasClass(n, 'heroacts'));
  const visibleButtons = findAll(acts, (n) => n.tag === 'button' && !findAll(acts, (d) => d.tag === 'details').some((d) => findAll(d, (x) => x === n).length));
  assert.deepEqual(visibleButtons.map((b) => b.attrs['data-pa']), ['brief-next'], 'only Next match before the fold');
  assert.ok(find(r, (n) => n.tag === 'details' && hasClass(n, 'povchange')), 'the perspective picker is behind "Change"');
  assert.ok(!/sheet note/.test(app.banners.innerHTML), 'Draft\'s sheet notes stay in Draft');
  const css = parseCssFile();
  const phone = (sel) => Object.assign({}, ...css.filter((x) => x.media === '(max-width: 767px)' && x.selectors.includes(sel)).map((x) => x.decls));
  assert.equal(phone('.oppstrip .oppjump').flex, '0 0 auto', 'the jump list sits beside the row');
  assert.equal(phone('.sync .sync-short').display, 'inline');
});

test('U2: the opponent row keeps its scroll on re-renders of the same row and centres the current tab when it changes', async (t) => {
  const app = await open('prep/5v6');
  t.after(() => app.restore());
  const ol = app.el('.oppstrip ol');
  ol.current = { offsetLeft: 900, offsetWidth: 80 };
  await app.click({ pa: 'go-opp', opp: '10' });
  assert.equal(ol.scrollLeft, 900 - (300 - 80) / 2, 'a new opponent is centred');
  ol.scrollLeft = 123; // the user scrolls the row
  await app.changeData({ pc: 'brief-scenario' }, { value: 'tr' });
  await app.click({ pa: 'brief-six', species: 'pelipper' });
  assert.equal(ol.scrollLeft, 123, 'same row: kept');
});

test('U3 and U12: each scenario radio has its own id (focus returns to the chosen one); rows carry a side cue and the track a scale', async (t) => {
  const app = await open('prep/5v6');
  t.after(() => app.restore());
  await app.changeData({ pc: 'brief-scenario' }, { value: 'tr' });
  const radios = findAll(root(app), (n) => n.tag === 'input' && n.attrs.name === 'brief-scenario');
  assert.deepEqual(radios.map((i) => i.attrs.id), ['brief-scen-none', 'brief-scen-tw-mine', 'brief-scen-tw-theirs', 'brief-scen-tr']);
  assert.ok('checked' in radios[3].attrs);
  const axis = find(root(app), (n) => hasClass(n, 'saxis'));
  assert.ok(axis && /^\d+\d+$/.test(text(find(axis, (n) => hasClass(n, 'axis')))));
  const css = parseCssFile();
  const decl = (sel) => Object.assign({}, ...css.filter((x) => !x.media && x.selectors.includes(sel)).map((x) => x.decls));
  assert.match(decl('.srow.mine .srowbtn')['border-left'], /solid var\(--you\)/);
  assert.match(decl('.srow.theirs .srowbtn')['border-left'], /dashed var\(--them\)/);
  assert.match(decl('.srow.sel .srowbtn')['box-shadow'], /inset/, 'selection is not the focus outline');
});

test('U4: "your plans" shows at most three faces per plan at a glance; the full lists are folded', async (t) => {
  const app = await open('prep/5v6');
  t.after(() => app.restore());
  const cores = findAll(find(root(app), (n) => n.attrs.id === 'bs-myplans'), (n) => hasClass(n, 'mycore'));
  assert.ok(cores.length > 0);
  for (const c of cores) {
    const line = find(c, (n) => hasClass(n, 'cpline'));
    assert.ok(findAll(line, (n) => hasClass(n, 'cpmini')).length <= 3);
    const outside = findAll(c, (n) => hasClass(n, 'cp') && !findAll(c, (d) => d.tag === 'details').some((d) => findAll(d, (x) => x === n).length));
    assert.equal(outside.length, 0, 'no long rows at a glance');
  }
});

test('U8: contrast of the new fills (WCAG ratio from the stylesheet colours) meets the stated thresholds', () => {
  const lum = (hex) => { const c = hex.replace('#', '').match(/../g).map((h) => parseInt(h, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const css = read('public/styles.css');
  assert.match(css, /\.rank \{ background: #b34f0d; \}/);
  for (const [fg, bg, min, what] of [['#ffffff', '#b34f0d', 4.5, 'rank number (light)'], ['#1d2330', '#b48cff', 4.5, 'Mega badge (dark)'], ['#1d2330', '#ff8a80', 4.5, '×4 badge (dark)'],
    ['#1d2330', '#7d9bff', 4.5, 'app switch (dark)'], ['#ffffff', '#3157d5', 4.5, 'app switch (light)'], ['#ffffff', '#6a3fb5', 4.5, 'Mega badge (light)'], ['#1d2330', '#ffae6b', 4.5, 'rank number (dark)'],
    ['#ffffff', '#D42020', 4.5, 'Fire pill'], ['#ffffff', '#1F6FD6', 4.5, 'Water pill'], ['#ffffff', '#D6336C', 4.5, 'Psychic pill'], ['#1d2330', '#3FA129', 4.5, 'Grass pill'], ['#c4570f', '#ffffff', 3, 'their band and ring (non-text)'], ['#3157d5', '#ffffff', 3, 'your band (non-text)']]) {
    assert.ok(ratio(fg, bg) >= min, `${what}: ${ratio(fg, bg).toFixed(2)}`);
  }
});

test('U10 and U11: the "My 6" tray sticks only when it holds something; on phones "useful" comes right after "look first"', () => {
  const css = parseCssFile();
  const phone = (sel, m = '(max-width: 767px)') => Object.assign({}, ...css.filter((x) => x.media === m && x.selectors.includes(sel)).map((x) => x.decls));
  assert.equal(phone('.tray').position, 'static');
  assert.equal(phone('.tray.has-six').position, 'sticky');
  const tab = '(max-width: 1023px)';
  assert.equal(phone('.brief .bcol', tab).display, 'contents');
  const order = ['#bs-pool', '#bs-threats', '#bs-useful', '#bs-plans', '#bs-speed', '#bs-leads', '#bs-myplans', '#bs-checks'].map((s) => Number(phone(s, tab).order));
  assert.deepEqual(order, [1, 2, 3, 4, 5, 6, 7, 8]);
});

// ---------- follow-up review: N2 revisions from another coach's side, N5 Re-check vs an unsaved quick check, R1 ----------
import { addVersion } from '../lib/prep-model.mjs';
/** device() plus a second version of your Charizard set (v2 current), and a workspace that is Jacky's prep vs Ning. */
function revisionDevice() {
  const storage = device();
  const st = createStore(storage);
  const lib = st.load(KEYS.mysets).doc;
  const sets = lib.sets.map((s) => (s.id === SET_MINE ? addVersion(s, { ...s.versions[0].data, nature: 'modest' }, { now: NOW }) : s));
  assert.ok(st.save(KEYS.mysets, { ...lib, sets }, lib.rev).ok);
  const jw = newWorkspace({ id: 'ws_jjjjjjjjjjjj', coach: 'Ning', roster: { speciesIds: ['rillaboom'] }, now: NOW, pov: 'Jacky' });
  assert.ok(st.save(wsKey(jw.id), jw, null).ok);
  return storage;
}
async function makeRevision(app, wsId) {
  await go(app, `#prep/w/${wsId}/practice`);
  await app.click({ pa: 'rv-new' });
  return find(root(app), (n) => n.tag === 'select' && n.attrs['data-pc'] === 'rv-set');
}

test('N2: as yourself a revision moves your set\'s version and is recorded (control)', async (t) => {
  const storage = revisionDevice();
  const app = await open('prep', { storage });
  t.after(() => app.restore());
  const sel = await makeRevision(app, WS);
  assert.ok(findAll(sel, (o) => o.tag === 'option' && o.attrs.value === SET_MINE).length, 'your set is offered');
  await app.changeData({ pc: 'rv-set' }, { value: SET_MINE });
  await app.changeData({ pc: 'rv-ver' }, { value: '1' });
  await app.click({ pa: 'rv-add-set' });
  await app.click({ pa: 'rv-save' });
  await flushSaves(app);
  assert.equal(JSON.parse(storage.getItem(KEYS.mysets)).sets.find((s) => s.id === SET_MINE).currentV, 1);
  assert.equal(JSON.parse(storage.getItem(wsKey(WS))).revisions.length, 1);
  assert.match(app.toast.textContent, /Revision saved/);
});

test('N2: in another coach\'s prep the revision form offers none of your sets, and a set change is refused without a phantom revision', async (t) => {
  const storage = revisionDevice();
  const app = await open('prep', { storage });
  t.after(() => app.restore());
  const sel = await makeRevision(app, 'ws_jjjjjjjjjjjj');
  assert.deepEqual(findAll(sel, (o) => o.tag === 'option').map((o) => o.attrs.value), [''], 'no library sets listed');
  // even if a set change is put in the draft (a stale form), saving refuses it and records nothing
  const lib = storage.getItem(KEYS.mysets);
  await app.changeData({ pc: 'rv-set' }, { value: SET_MINE });
  await app.changeData({ pc: 'rv-ver' }, { value: '1' });
  await app.click({ pa: 'rv-add-set' });
  await app.click({ pa: 'rv-save' });
  await flushSaves(app);
  assert.equal(storage.getItem(KEYS.mysets), lib, 'your library is unchanged');
  assert.equal(JSON.parse(storage.getItem(wsKey('ws_jjjjjjjjjjjj'))).revisions.length, 0, 'no revision recorded in Jacky\'s prep');
  assert.match(app.toast.textContent, /My sets is your own library/);
  assert.ok(!/Revision saved/.test(app.toast.textContent));
});

test('N5: Re-check on the Calcs list asks before it drops an unsaved quick check; Cancel keeps it; Replace re-checks; with no draft it just re-checks', async (t) => {
  const storage = device(), session = memoryStorage();
  const app = await open(`prep/w/${WS}/calcs`, { storage, session });
  t.after(() => app.restore());
  await app.waitFor(() => true);
  // a saved calc to go out of date
  await app.click({ pa: 'calc-new' });
  await app.waitFor(() => !/Loading the calculator/.test(T(app)), 'the engine', 20000);
  await app.click({ pa: 'calc-pick', which: 'a', side: 'theirs', species: 'rillaboom', set: 'set_tttttttttttt' });
  await app.click({ pa: 'calc-pick', which: 'd', side: 'mine', species: 'charizard', set: SET_MINE });
  await app.click({ pa: 'calc-move', move: 'woodhammer' });
  await app.click({ pa: 'calc-save' });
  await flushSaves(app);
  const calcId = JSON.parse(storage.getItem(wsKey(WS))).calcs[0].id;
  const checkedAt = () => JSON.parse(storage.getItem(wsKey(WS))).calcs[0].checkedAt;
  // an unsaved quick check
  await go(app, `#prep/w/${WS}/calcs`);
  await app.click({ pa: 'calc-new' });
  await app.click({ pa: 'calc-pick', which: 'a', side: 'mine', species: 'charizard', set: SET_MINE });
  await app.click({ pa: 'calc-pick', which: 'd', side: 'theirs', species: 'rillaboom', set: 'set_tttttttttttt' });
  await app.click({ pa: 'calc-move', move: 'heatwave' });
  await go(app, `#prep/w/${WS}/calcs`);
  const draft = () => JSON.parse(session.getItem('drafarig.prep.ui') ?? '{}').ws?.[WS]?.cd ?? null;
  await flushSaves(app);
  assert.equal(draft()?.move, 'heatwave');
  const t0 = checkedAt();
  await app.click({ pa: 'calc-recheck', calc: calcId });
  assert.match(T(app), /You have an unsaved quick check/);
  await app.click({ pa: 'draft-cancel' });
  await flushSaves(app);
  assert.equal(draft()?.move, 'heatwave', 'Cancel keeps the quick check');
  assert.equal(checkedAt(), t0, 'and re-checks nothing');
  await app.click({ pa: 'calc-recheck', calc: calcId });
  await app.click({ pa: 'draft-replace' });
  await flushSaves(app);
  assert.equal(draft(), null, 'Replace: the draft is cleared for the reloaded calc');
  assert.match(app.toast.textContent, /Re-checked/);
  // no unsaved quick check: Re-check runs straight away (no question)
  await app.click({ pa: 'calc-recheck', calc: calcId });
  assert.ok(!/You have an unsaved quick check/.test(T(app)));
  assert.match(app.toast.textContent, /Re-checked/);
});

test('R1: the opponent row is the offset parent of its tabs (centring by offsetLeft is exact)', () => {
  const decl = Object.assign({}, ...parseCssFile().filter((x) => !x.media && x.selectors.includes('.oppstrip ol')).map((x) => x.decls));
  assert.equal(decl.position, 'relative');
});

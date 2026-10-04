// Acceptance checks from the Prep UX review (phone-first, nonexpert). Markup / routing / storage checks on the stub DOM,
// not a rendering: nothing here measures pixels, touch or screen-reader output.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bootApp, parseHtml, parseCss, findAll, find, text, hasClass } from './ui-harness.mjs';
import { wsKey, KEYS } from '../lib/prep-schema.mjs';
import { NOW, WS, SET_MINE, SET_THEIRS, T, btns, flushSaves, device, theirSet } from './prep-helpers.mjs';
import { newLineage } from '../lib/prep-model.mjs';

const ROOT = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');
const ready = (app) => app.waitFor(() => !/Loading the calculator/.test(T(app)), 'the engine', 20000);

test('Quick check: once attacker, target and move are chosen the answer comes first, with at most 3 buttons before it', async (t) => {
  const app = await bootApp({ mode: `prep/w/${WS}/calcs/new`, storage: device() });
  t.after(() => app.restore());
  await ready(app);
  await app.click({ pa: 'calc-pick', which: 'a', side: 'theirs', species: 'rillaboom', set: SET_THEIRS });
  await app.click({ pa: 'calc-pick', which: 'd', side: 'mine', species: 'charizard', set: SET_MINE });
  await app.click({ pa: 'calc-move', move: 'woodhammer' });
  const html = app.html();
  const at = html.indexOf('class="calcresult"');
  assert.ok(at > 0 && at < html.indexOf('class="fieldctl"'), 'the result comes before the controls');
  assert.ok((html.slice(html.indexOf('id="prep-h"'), at).match(/<button/g) ?? []).length <= 3, 'below the screen heading, at most Change (and a re-check) before it');
  assert.match(T(app), /Rillaboom → Charizard · Wood Hammer/);
  // the field suggestions: their Grassy Surge, one tap to apply
  const sug = btns(app, 'calc-set').find((b) => b.key === 'terrain' && b.value === 'Grassy');
  assert.ok(sug, 'Rillaboom sets Grassy Terrain is suggested');
  await app.click(sug);
  assert.match(T(app), /Grassy Terrain/);
  await app.click({ pa: 'calc-change-picks' });
  assert.ok(btns(app, 'calc-pick').length > 2 && btns(app, 'calc-picks-done').length === 1);
});

test('a missing set is started right in the calc: the route stays and both picks stay chosen', async (t) => {
  const app = await bootApp({ mode: `prep/w/${WS}/calcs/new`, storage: device() });
  t.after(() => app.restore());
  await ready(app);
  const hash = app.location.hash;
  await app.click({ pa: 'calc-pick', which: 'a', side: 'theirs', species: 'gholdengo', set: '' });
  await app.click({ pa: 'calc-pick', which: 'd', side: 'mine', species: 'charizard', set: SET_MINE });
  await app.click({ pa: 'calc-fill', which: 'a' });
  assert.equal(app.location.hash, hash);
  const picked = findAll(parseHtml(app.html()), (n) => n.attrs['data-pa'] === 'calc-pick' && n.attrs['aria-pressed'] === 'true').map((n) => n.attrs['data-species']);
  assert.deepEqual(picked.sort(), ['charizard', 'gholdengo']);
  await flushSaves(app);
  assert.equal(JSON.parse(app.storage.getItem(wsKey(WS))).theirSets.filter((s) => s.speciesId === 'gholdengo').length, 1);
});

test('Speed: their Mega forms get a row unless their item is known and isn\'t the stone', async (t) => {
  const seenLife = theirSet('set_llllllllllll', 'lucario', { item: 'lifeorb', ability: 'innerfocus', moves: ['closecombat'] }, 'seen-vs-others');
  const a = await bootApp({ mode: `prep/w/${WS}/speed`, storage: device() });
  t.after(() => a.restore());
  assert.match(T(a), /Lucario-Mega \(if it Mega Evolves\)/);
  const s = device({ ws: { theirSets: [seenLife], variants: [{ id: 'var_aaaaaaaaaaaa', role: 'likely', name: '', setIds: { lucario: 'set_llllllllllll' }, whyBuilt: '', planId: null, updatedAt: NOW }] } });
  const b = await bootApp({ mode: `prep/w/${WS}/speed`, storage: s });
  t.after(() => b.restore());
  assert.ok(!/Lucario-Mega/.test(T(b)), 'seen holding Life Orb: no Mega row');
});

test('paste import keeps the sets that still need a choice, and EV questions say what they do', async (t) => {
  const app = await bootApp({ mode: 'prep/my-sets/import', storage: device() });
  t.after(() => app.restore());
  await app.input('paste-text', 'Charizard @ Charizardite Y\nAbility: Blaze\nEVs: 2 HP / 32 SpA / 32 Spe\nTimid Nature\n- Heat Wave\n\nPelipper @ Focus Sash\nAbility: Drizzle\nEVs: 4 HP / 252 SpA / 252 Spe\nModest Nature\n- Hurricane\n');
  await app.click({ pa: 'paste-check' });
  assert.ok(!/brackets/.test(T(app)));
  assert.match(T(app), /Convert to Stat Points/);
  await app.click({ pa: 'paste-import' });
  assert.equal(app.location.hash, '#prep/my-sets/import', 'stays on the import screen');
  assert.match(T(app), /Pelipper/);
  assert.match(app.toast.textContent, /still needs a choice/);
});

test('mock brief: their 6 for this mock, so the paste has 6 sets; the opponent isn\'t named to a league partner', async (t) => {
  const extra = ['gholdengo', 'milotic', 'lucario', 'ninetalesalola', 'garchomp', 'kingambit'].map((sp, i) => theirSet(`set_${'abcdef'[i].repeat(12)}`, sp, { ability: '', moves: [] }));
  const s = device({ ws: { roster: { fetchedAt: NOW, speciesIds: ['rillaboom', 'gholdengo', 'milotic', 'lucario', 'ninetalesalola', 'garchomp', 'kingambit'], points: {} },
    theirSets: [theirSet(SET_THEIRS, 'rillaboom', { item: 'miracleseed', ability: 'grassysurge', nature: 'adamant', moves: ['woodhammer'] }), ...extra],
    variants: [{ id: 'var_aaaaaaaaaaaa', role: 'likely', name: '', setIds: Object.fromEntries([[SET_THEIRS, 'rillaboom'], ...extra.map((l) => [l.id, l.speciesId])].map(([id, sp]) => [sp, id])), whyBuilt: '', planId: null, updatedAt: NOW }] } });
  const app = await bootApp({ mode: `prep/w/${WS}/brief`, storage: s });
  t.after(() => app.restore());
  assert.equal(findAll(parseHtml(app.html()), (n) => n.attrs['data-pa'] === 'br-six' && n.attrs['aria-pressed'] === 'true').length, 6);
  await app.click({ pa: 'br-copy' });
  const brief = app.clipboard.at(-1);
  assert.equal((brief.split('Paste:')[1].match(/^Level: 50/gm) ?? []).length, 6, 'six sets in the paste');
  assert.match(brief, /Team: Their team \(my guess\)/);
  assert.ok(!/Ning/.test(brief));
});

test('Game day: game 3 never shows the game-2 card; a new match mid-set asks first; earlier matches stay reachable', async (t) => {
  const s = device({ ws: { cards: [{ id: 'card_bbbbbbbbbbbb', kind: 'bo3-won-g1', turn1Intent: 'Same lead' }] } });
  const app = await bootApp({ mode: `prep/w/${WS}/gameday`, storage: s });
  t.after(() => app.restore());
  await app.click({ pa: 'match-start' });
  const holder = btns(app, 'log-save')[0].holder;
  for (const [i, res] of [['0', 'W'], ['1', 'L']]) {
    await app.click({ pa: 'log-set', kind: 'match', holder, index: i, key: 'result', value: res });
    await app.click({ pa: 'log-save', kind: 'match', holder, index: i });
  }
  assert.match(T(app), /Set 1–1/);
  assert.ok(!/Your card for game/.test(T(app)), 'game 3: no "if I won game 1" card');
  assert.match(T(app), /Game 3\./);
  await new Promise((r) => setTimeout(r, 450)); // a second, deliberate tap (not a double tap)
  await app.click({ pa: 'match-start' });
  assert.match(T(app), /not decided\. Start a new match anyway\?/);
  await app.click({ pa: 'match-start-cancel' });
  assert.match(T(app), /Set 1–1/);
  await app.click({ pa: 'match-start', confirmed: 'yes' });
  assert.match(T(app), /Set 0–0/);
  const open = btns(app, 'match-open')[0];
  assert.ok(open);
  await app.click(open);
  assert.match(T(app), /Set 1–1/);
});

test('Plan tab: on a new opponent the only primary action is the "Start here" step, and it goes to its section', async (t) => {
  const app = await bootApp({ mode: `prep/w/${WS}/plan`, storage: device() });
  t.after(() => app.restore());
  const primaries = findAll(parseHtml(app.html()), (n) => n.tag === 'button' && hasClass(n, 'primary'));
  assert.deepEqual(primaries.map((n) => n.attrs['data-pa']), ['plan-step1']);
  assert.ok(find(parseHtml(app.html()), (n) => n.attrs.id === 'plan-plans' && n.attrs.tabindex === '-1'));
  assert.equal(find(parseHtml(app.html()), (n) => n.attrs.id === 'ws-date').attrs.type, 'date');
});

test('practice loop: sending the brief records the mock; a set saved while a finding is open can become a revision', async (t) => {
  const s = device({ ws: { findings: [{ id: 'fnd_aaaaaaaaaaaa', statement: 'Their Rillaboom outspeeds my lead', mechanism: '', kind: 'structural', severity: 'major', evidence: { gameIds: [], calcIds: [] }, status: 'open', statusAt: NOW, createdAt: NOW, sourceId: null }] } });
  const app = await bootApp({ mode: `prep/w/${WS}/brief`, storage: s });
  t.after(() => app.restore());
  await app.click({ pa: 'br-copy' });
  await app.click({ pa: 'go-log' });
  assert.ok(btns(app, 'log-save').length === 1, 'the copied brief\'s mock is ready to log');
  await flushSaves(app);
  assert.equal(JSON.parse(s.getItem(wsKey(WS))).mockSets.length, 1);
  await app.click({ pa: 'tab', tab: 'sets' });
  await app.click({ pa: 'open-my-set', set: SET_MINE });
  await app.click({ pa: 'sp-step', set: SET_MINE, stat: 'hp', d: '1' });
  await app.click({ pa: 'set-save', set: SET_MINE });
  assert.match(T(app), /Why did you change it\?/);
  await app.click(btns(app, 'set-why').find((b) => b.finding === 'fnd_aaaaaaaaaaaa'));
  await flushSaves(app);
  const rv = JSON.parse(s.getItem(wsKey(WS))).revisions[0];
  assert.deepEqual([rv.reasonFindingIds, rv.changes[0].fromV, rv.changes[0].toV], [['fnd_aaaaaaaaaaaa'], 1, 2]);
});

test('what they\'ve seen of you: open team sheets mark your 6 at the start of a match; a logged Mega is listed', async (t) => {
  const s = device();
  const rules = JSON.parse(s.getItem(KEYS.rules)); rules.rules.disclosure = { value: 'open-at-preview', source: 'user', setAt: NOW, note: '' }; rules.rev = rules.rev; s.setItem(KEYS.rules, JSON.stringify(rules));
  const app = await bootApp({ mode: `prep/w/${WS}/gameday`, storage: s });
  t.after(() => app.restore());
  await app.click({ pa: 'match-start' });
  await flushSaves(app);
  const seen = JSON.parse(s.getItem(KEYS.mysets)).sets[0].revealedTo;
  assert.ok(seen.some((e) => e.who === 'Ning' && e.what.includes('moves')));
  const holder = btns(app, 'log-save')[0].holder;
  await app.click({ pa: 'log-set', kind: 'match', holder, index: '0', key: 'myMega', value: SET_MINE });
  await app.click({ pa: 'log-save', kind: 'match', holder, index: '0' });
  assert.match(T(app), /Your Mega: Charizard/);
  await flushSaves(app);
  assert.ok(!/isn't valid|Couldn't save/.test(T(app)), 'the save went through');
  assert.equal(JSON.parse(s.getItem(wsKey(WS))).matches[0].games[0].myMega, SET_MINE, 'stored, not just on screen');
  // and in a mock log
  await app.click({ pa: 'tab', tab: 'practice' });
  await app.click({ pa: 'go-log' });
  await app.click({ pa: 'mock-quick' });
  const mh = btns(app, 'log-save')[0].holder;
  await app.click({ pa: 'log-set', kind: 'mock', holder: mh, index: '0', key: 'myMega', value: SET_MINE });
  await app.click({ pa: 'log-save', kind: 'mock', holder: mh, index: '0' });
  await flushSaves(app);
  assert.equal(JSON.parse(s.getItem(wsKey(WS))).mockSets[0].games[0].myMega, SET_MINE);
});

test('debrief: one game at a time (at most 4 text fields before a tap); "Through their eyes" claims nothing without ladder data', async (t) => {
  const games = [0, 1, 2].map((i) => ({ id: `game_${'abc'[i].repeat(12)}`, index: i, result: i ? 'L' : 'W', theirLead: [], myLead: [], tag: 'structural', draft: false }));
  const s = device({ ws: { mockSets: [{ id: 'mock_aaaaaaaaaaaa', date: '2026-10-03', partner: 'A', fidelity: 2, variantIds: [], simulatedDisclosure: 'closed', formatString: 'gen9champions4v4doublesdraft', games }] } });
  const app = await bootApp({ mode: `prep/w/${WS}/mock/mock_aaaaaaaaaaaa`, storage: s });
  t.after(() => app.restore());
  const debrief = app.html().slice(app.html().indexOf('<h3>Debrief</h3>'));
  const open = findAll(parseHtml(debrief), (n) => n.tag === 'input' && !findAll(parseHtml(debrief), () => false).length && !n.parent?.attrs?.open).filter((n) => !(function inClosed(x) { for (let p = x.parent; p; p = p.parent) if (p.tag === 'details' && !('open' in p.attrs)) return true; return false; })(n));
  assert.ok(open.length <= 4, `${open.length} text fields before a tap`);
  await app.click(btns(app, 'db-pick')[1]);
  assert.equal(findAll(parseHtml(app.html()), (n) => n.attrs['data-pi'] === 'db-turn').length, 3);
  await app.click({ pa: 'go-eyes' });
  assert.ok(!/learnable only/.test(T(app)), 'usage is offline in the harness: no "learnable only" claims');
});

test('"What would it take?" from a calc keeps its conditions and never states an HP the answer doesn\'t use', async (t) => {
  const app = await bootApp({ mode: `prep/w/${WS}/calcs/new`, storage: device() });
  t.after(() => app.restore());
  await ready(app);
  await app.click({ pa: 'calc-pick', which: 'a', side: 'theirs', species: 'rillaboom', set: SET_THEIRS });
  await app.click({ pa: 'calc-pick', which: 'd', side: 'mine', species: 'charizard', set: SET_MINE });
  await app.click({ pa: 'calc-move', move: 'woodhammer' });
  await app.click({ pa: 'calc-set', scope: 'field', key: 'weather', value: 'Rain' });
  await app.changeData({ pc: 'calc-hp', scope: 'dState' }, { value: '40' });
  await app.click({ pa: 'go-threshold-from' });
  await app.click({ pa: 'th-run' });
  const txt = T(app);
  assert.match(txt, /Assumes: [^.]*Rain/);
  assert.match(txt, /Your Charizard at full HP \(the calc had 40%\)/);
  assert.ok(!/shows 40% HP/.test(txt));
});

test('Undo after a delete is withdrawn by any later edit, here or from another tab, so it never wipes newer work', async (t) => {
  const plan = { id: 'plan_aaaaaaaaaaaa', kind: 'likely', label: 'Grassy', members: ['rillaboom'], megaUser: '', speedMode: 'unknown', needs: '' };
  const s = device({ ws: { plans: [plan] } });
  const app = await bootApp({ mode: `prep/w/${WS}/theirplan/${plan.id}`, storage: s });
  t.after(() => app.restore());
  await app.click({ pa: 'plan-delete', plan: plan.id });
  assert.match(T(app), /Plan deleted\. Undo/);
  await app.input('ws-premortem', 'typed after the delete');
  assert.ok(!/Plan deleted\. Undo/.test(T(app)), 'typing withdraws the Undo');
  await flushSaves(app);
  assert.equal(JSON.parse(s.getItem(wsKey(WS))).premortem, 'typed after the delete');
  // another tab's change withdraws it too
  await app.click({ pa: 'card-new', kind: 'plan' });
  await app.click({ pa: 'card-delete', card: btns(app, 'card-delete')[0]?.card ?? JSON.parse(s.getItem(wsKey(WS))).cards[0]?.id });
  await flushSaves(app);
  const other = JSON.parse(s.getItem(wsKey(WS))); other.rev += 1; other.saveId = 'othertab9'; other.notes = 'from the other tab';
  s.setItem(wsKey(WS), JSON.stringify(other));
  await app.fire('storage', { key: wsKey(WS), newValue: JSON.stringify(other) });
  assert.ok(!/deleted\. Undo/.test(T(app)));
});

test('a double tap creates one record; a newer app\'s data can only be downloaded, not removed', async (t) => {
  const app = await bootApp({ mode: `prep/w/${WS}/gameday`, storage: device() });
  t.after(() => app.restore());
  await app.click({ pa: 'match-start' });
  await app.click({ pa: 'match-start' });
  await flushSaves(app);
  assert.equal(JSON.parse(app.storage.getItem(wsKey(WS))).matches.length, 1);
  const s = device();
  const w = JSON.parse(s.getItem(wsKey(WS))); w.schemaVersion = 99; s.setItem(wsKey(WS), JSON.stringify(w));
  const b = await bootApp({ mode: 'prep/backup', storage: s });
  t.after(() => b.restore());
  await b.click({ pa: 'ws-archive', ws: WS });
  await b.click({ pa: 'delete-all' });
  assert.equal(b.downloads.length, 0);
  assert.ok(s.getItem(wsKey(WS)));
  assert.ok(!btns(b, 'delete-all-confirm').length);
});

test('phone and accessibility: 44px link buttons, no aria-live inside the screen, every select named, a status region outside it', async (t) => {
  const css = parseCss(read('public/styles.css'));
  const decl = (sel, media = null) => Object.assign({}, ...css.filter((r) => r.media === media && r.selectors.includes(sel)).map((r) => r.decls));
  assert.equal(decl('.prep button.linkish', '(max-width: 767px)')['min-height'], '44px');
  assert.match(read('public/index.html'), /<div id="live" class="vh" role="status" aria-live="polite"><\/div>/);
  const app = await bootApp({ mode: `prep/w/${WS}/plan`, storage: device() });
  t.after(() => app.restore());
  for (const h of ['plan', 'sets', 'calcs', 'practice'].map((x) => `#prep/w/${WS}/${x}`).concat([`#prep/w/${WS}/sets/${SET_THEIRS}`, `#prep/w/${WS}/sets/${SET_MINE}`, `#prep/w/${WS}/calcs/new`, `#prep/w/${WS}/brief`, `#prep/w/${WS}/gameday`, `#prep/w/${WS}/threshold`, '#prep/backup', '#prep/rules'])) {
    app.location.hash = h; await app.fire('popstate');
    const root = parseHtml(app.html());
    assert.equal(findAll(root, (n) => 'aria-live' in n.attrs).length, 0, `${h}: aria-live inside #main`);
    for (const s of findAll(root, (n) => n.tag === 'select')) {
      const labelled = s.attrs['aria-label'] || findAll(root, (n) => n.tag === 'label' && (n.attrs.for === s.attrs.id || findAll(n, (x) => x === s).length)).length;
      assert.ok(labelled, `${h}: select ${s.attrs.id ?? ''} has no name`);
    }
  }
});

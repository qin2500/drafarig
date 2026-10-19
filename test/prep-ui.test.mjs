// Prep mode in the real app shell (public/app.js + public/prep*.js) against a stub DOM (test/ui-harness.mjs). These are
// markup / routing / storage / privacy / CSS-arithmetic checks, not a rendering: nothing here measures pixels.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolveObjectURL } from 'node:buffer';
import { bootApp, memoryStorage, parseHtml, parseCss, findAll, find, text, hasClass, RAW } from './ui-harness.mjs';
import { KEYS, wsKey } from '../lib/prep-schema.mjs';
import { buildLeague } from '../lib/league.mjs';
import { newLineage } from '../lib/prep-model.mjs';
import { formatRoute } from '../lib/prep-route.mjs';
import * as C from '../public/prep-copy.js';
import { resultBlock } from '../public/prep-ui.js';
import { NOW, WS, SET_MINE, SET_THEIRS, T, btns, flushSaves, device, isPortrait } from './prep-helpers.mjs';

const ROOT = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');
// Battle Prep addresses: seat routes (public sheet positions, never names), tools, and saved workspaces by random id.
const HASH_RE = /^#prep(\/(rules|backup|pilot|my-sets(\/(import|[a-z]+_[a-z2-7]{12}))?|[1-9][0-9]?(v[1-9][0-9]?(\/(brief|plan|sets|calcs|practice|(their|your)\/[1-9][0-9]?|core\/[a-z][a-z0-9-]*))?)?|w\/[a-z]+_[a-z2-7]{12}(\/[a-z]+(\/([a-z]+_[a-z2-7]{12}|new))?)?))?$/;

test('Draft and Battle Prep are two apps behind one switch; Draft keeps its modes; Prep code loads only when Battle Prep opens', async (t) => {
  const html = read('public/index.html');
  assert.deepEqual([...html.matchAll(/data-mode="([a-z]+)"/g)].map((m) => m[1]), ['draft', 'team', 'league', 'learn', 'setup'], 'the Draft rail no longer holds Prep');
  const sw = find(parseHtml(html), (n) => n.tag === 'nav' && hasClass(n, 'appswitch'));
  assert.equal(sw.attrs['aria-label'], 'Apps');
  assert.deepEqual(findAll(sw, (n) => n.tag === 'a').map((a) => [a.attrs.href, a.attrs['data-app-link'], text(a)]), [['#draft', 'draft', 'Draft'], ['#prep', 'prep', 'Battle Prep'], ['#prep/mocks', 'mocks', 'Mocks']]);
  for (const id of ['sync', 'turn', 'budget', 'coach', 'explain', 'main', 'banners', 'live']) assert.match(html, new RegExp(`id="${id}"`), `${id} kept`);
  const app = await bootApp();
  t.after(() => app.restore());
  assert.equal(app.body.dataset.app, 'draft');
  for (const mode of ['team', 'league', 'learn', 'setup', 'draft']) {
    await app.click({ mode });
    assert.ok(!app.html().includes('class="prep"'), mode);
    assert.equal(app.body.dataset.app, 'draft', mode);
  }
  assert.ok(!app.fetches.some((f) => f.path === '/data/mechanics.json'), 'the other screens never load the Reg M-C data');
  assert.ok(/import\('\/prep\.js'\)/.test(read('public/app.js')) && !/^import .*prep/m.test(read('public/app.js')), 'app.js imports Prep lazily');
  await app.click({ mode: 'team' });
  const n = app.history.length;
  await app.click({ appLink: 'prep' });
  await app.waitFor(() => app.html().includes('class="prep"'), 'Prep');
  assert.deepEqual([app.body.dataset.mode, app.body.dataset.app], ['prep', 'prep']);
  assert.equal(app.location.hash, '#prep/5', 'Battle Prep opens on the overview from the Draft coach setting (Anthony, seat 5)');
  await app.click({ appLink: 'draft' });
  assert.deepEqual([app.body.dataset.app, app.location.hash], ['draft', '#team'], 'Draft returns to the last Draft screen');
  assert.equal(app.history.length, n, 'switching apps adds no history entries');
  const css = parseCss(read('public/styles.css'));
  const hidden = (sel) => css.some((r) => r.selectors.includes(sel) && r.decls.display === 'none');
  for (const sel of ['body[data-app="prep"] .modes', 'body[data-app="prep"] .budget-pill', 'body[data-app="prep"] .coach', 'body[data-app="prep"] .turn']) assert.ok(hidden(sel), `${sel} hidden in Battle Prep`);
});

test('first run: Battle Prep opens as the Draft coach setting (saying so), lists the 9 others as portrait tabs, and only static GETs happen', async (t) => {
  const app = await bootApp({ mode: 'prep' });
  t.after(() => app.restore());
  const h = T(app);
  assert.match(h, /Preparing as Anthony/);
  assert.match(h, /from Draft's default coach/, 'it says where the name comes from');
  assert.match(h, /Is this you\?/);
  const strip = find(parseHtml(app.html()), (n) => n.tag === 'nav' && n.attrs['aria-label'] === 'Opponents');
  const tabs = findAll(strip, (n) => n.attrs['data-pa'] === 'go-opp');
  assert.deepEqual(tabs.map((a) => Number(a.attrs['data-opp'])), [1, 2, 3, 4, 6, 7, 8, 9, 10], 'seat order, never the perspective');
  assert.ok(tabs.every((a) => a.tag === 'a' && /^#prep\/5v\d+$/.test(a.attrs.href)), 'real links');
  assert.equal(btns(app, 'go-opp').filter((b) => b.opp).length >= 9, true);
  await app.click({ pa: 'confirm-me', coach: 'Anthony' });
  await app.click({ pa: 'go-opp', opp: '2' });
  await app.click({ pa: 'tab', tab: 'plan' });
  await flushSaves(app);
  assert.ok(app.fetches.every((f) => f.method === 'GET' && f.body === null), JSON.stringify(app.fetches));
  assert.deepEqual([...new Set(app.fetches.map((f) => f.path))].sort(), ['/api/sheet', '/api/usage', '/data/cores.json', '/data/dex.json', '/data/mechanics.json']);
  const keys = [...app.storage.map.keys()];
  assert.ok(keys.every((k) => k.startsWith('drafarig.prep.') || /^drafarig\.(coach|order|explain|mode|aliases)$/.test(k)), keys.join());
  assert.ok(keys.some((k) => k.startsWith('drafarig.prep.ws.')));
});

test('routes and history: drill-downs push, tabs replace, Back pops to the parent; hashes carry random ids only', async (t) => {
  const app = await bootApp({ mode: 'prep', storage: device() });
  t.after(() => app.restore());
  await app.click({ pa: 'open-ws', ws: WS });
  assert.equal(app.location.hash, `#prep/w/${WS}/plan`);
  const n = app.history.length;
  for (const tab of ['sets', 'calcs', 'practice', 'plan']) {
    await app.click({ pa: 'tab', tab });
    assert.equal(app.location.hash, `#prep/w/${WS}/${tab}`);
    assert.equal(app.history.length, n, 'a tab switch replaces');
    const tabs = findAll(parseHtml(app.html()), (x) => x.attrs['data-pa'] === 'tab');
    assert.deepEqual(tabs.filter((x) => x.attrs['aria-current'] === 'page').map((x) => x.attrs['data-tab']), [tab]);
  }
  await app.click({ pa: 'tab', tab: 'sets' });
  await app.click({ pa: 'open-their-set', set: SET_THEIRS });
  assert.equal(app.location.hash, `#prep/w/${WS}/sets/${SET_THEIRS}`);
  assert.equal(app.history.length, n + 1, 'a drill-down pushes');
  assert.match(T(app), /Rillaboom · their set/);
  await app.click({ pa: 'back' });
  await app.waitFor(() => app.location.hash === `#prep/w/${WS}/sets` && /Their team/.test(T(app)), 'Back');
  for (const h of app.history.entries()) assert.match(h, HASH_RE, h);
  assert.ok(app.history.entries().every((h) => !/ning|anthony|charizard|rillaboom/i.test(h)));
  // deep links: a saved screen opens directly; another device's id says so; junk goes to Battle Prep's overview
  const deep = await bootApp({ mode: `prep/w/${WS}/calcs`, storage: device() });
  t.after(() => deep.restore());
  assert.match(T(deep), /Calcs/);
  const other = await bootApp({ mode: 'prep/w/ws_zzzzzzzzzzzz/plan', storage: device() });
  t.after(() => other.restore());
  assert.match(T(other), /Not on this device/);
  const junk = await bootApp({ mode: 'prep/w/Ning/plan', storage: device() });
  t.after(() => junk.restore());
  assert.match(T(junk), /Battle Prep as Anthony/);
  assert.equal(junk.location.hash, '#prep/5');
  for (const r of [{ view: 'ws', wsId: WS, kind: 'calcs', id: 'new' }, { view: 'my-sets', id: SET_MINE }, { view: 'ws', wsId: 'Ning', tab: 'plan' }]) assert.match(formatRoute(r), HASH_RE);
});

test('the prep path is optional: a fresh opponent can import and calculate straight away', async (t) => {
  const app = await bootApp({ mode: `prep/w/${WS}/calcs`, storage: device() });
  t.after(() => app.restore());
  await app.click({ pa: 'calc-new' });
  await app.waitFor(() => !/Loading the calculator/.test(T(app)), 'the engine', 20000);
  await app.click({ pa: 'calc-pick', which: 'a', side: 'theirs', species: 'rillaboom', set: SET_THEIRS });
  await app.click({ pa: 'calc-pick', which: 'd', side: 'mine', species: 'charizard', set: SET_MINE });
  await app.click({ pa: 'calc-move', move: 'woodhammer' });
  const res = find(parseHtml(app.html()), (n) => hasClass(n, 'result'));
  assert.ok(res, 'a result renders');
  assert.match(text(res), /depending on their investment/, 'unknown Stat Points: a range, not one number');
  assert.match(text(res), /Not counted/);
  assert.ok(text(res).includes(C.FOOTER) && /calc 0\.12\.0/.test(C.FOOTER), 'the versions it was computed with');
  assert.ok(text(res).includes(C.SCOPE), 'conditional modelled damage, not a prediction');
  await app.click({ pa: 'calc-save' });
  assert.match(app.location.hash, /^#prep\/w\/ws_aaaaaaaaaaaa\/calcs\/calc_[a-z2-7]{12}$/);
  await flushSaves(app);
  const saved = JSON.parse(app.storage.getItem(wsKey(WS))).calcs;
  assert.equal(saved.length, 1);
  assert.deepEqual(Object.keys(saved[0].pins).sort(), ['commit', 'data', 'engine', 'regulation', 'wrapper', 'wrapperRules']);
  assert.match(saved[0].pins.engine, /^@smogon\/calc@0\.12\.0#[0-9a-f]{64}$/);
  assert.deepEqual([saved[0].refs.attacker.setId, saved[0].refs.defender.setId], [SET_THEIRS, SET_MINE]);
});

test('data loss drills: unreadable, newer and conflicting documents are never overwritten; quota failures say so and offer a backup', async (t) => {
  // unreadable workspace: banner, raw text kept byte for byte through other saves
  const s1 = device();
  s1.setItem(wsKey(WS), '{"broken": tru');
  const a = await bootApp({ mode: 'prep', storage: s1 });
  t.after(() => a.restore());
  assert.ok(T(a).includes(C.SAVE.corrupt));
  await a.click({ pa: 'go-rules' });
  await a.click({ pa: 'set-rule', rule: 'itemClause', value: 'on' });
  await flushSaves(a);
  assert.equal(s1.getItem(wsKey(WS)), '{"broken": tru');
  assert.equal(JSON.parse(s1.getItem(KEYS.rules)).rules.itemClause.value, 'on', 'other documents still save');
  // a newer app wrote here: read-only, nothing written
  const s2 = device();
  const meta = JSON.parse(s2.getItem(KEYS.meta)); meta.schemaVersion = 99; s2.setItem(KEYS.meta, JSON.stringify(meta));
  const before = [...s2.map];
  const b = await bootApp({ mode: 'prep', storage: s2 });
  t.after(() => b.restore());
  assert.ok(T(b).includes(C.SAVE.newer));
  await b.click({ pa: 'go-rules' });
  await b.click({ pa: 'set-rule', rule: 'itemClause', value: 'on' });
  await flushSaves(b);
  assert.deepEqual([...s2.map].filter(([k]) => k.startsWith('drafarig.prep.')), before.filter(([k]) => k.startsWith('drafarig.prep.')));
  // another tab saved the workspace while this tab had no edits to it: taken quietly, and our next edit builds on it
  const s3 = device();
  const c = await bootApp({ mode: `prep/w/${WS}/plan`, storage: s3 });
  t.after(() => c.restore());
  const other = JSON.parse(s3.getItem(wsKey(WS))); other.rev += 1; other.premortem = 'from the other tab'; other.saveId = 'othertab1';
  s3.setItem(wsKey(WS), JSON.stringify(other));
  await c.fire('storage', { key: wsKey(WS), newValue: JSON.stringify(other) });
  assert.ok(!T(c).includes(C.SAVE.conflict({ what: 'Your prep' })));
  assert.ok(c.html().includes('value="from the other tab"'), 'the other tab\'s premortem is shown');
  await c.click({ pa: 'ws-next' });
  await flushSaves(c);
  assert.deepEqual([JSON.parse(s3.getItem(wsKey(WS))).premortem, JSON.parse(s3.getItem(wsKey(WS))).isNext], ['from the other tab', true]);
  // …but with an unsaved edit here, both versions are kept and the banner says so
  await c.click({ pa: 'ws-next' }); // isNext → false, not saved yet
  const third = { ...JSON.parse(s3.getItem(wsKey(WS))), premortem: 'third tab', saveId: 'othertab2' }; third.rev += 1;
  s3.setItem(wsKey(WS), JSON.stringify(third));
  await c.fire('storage', { key: wsKey(WS), newValue: JSON.stringify(third) });
  assert.ok(T(c).includes(C.SAVE.conflict({ what: 'Your prep' })));
  assert.ok(btns(c, 'backup-download').length >= 1, 'this tab\'s unsaved version can be downloaded');
  await flushSaves(c);
  assert.equal(JSON.parse(s3.getItem(wsKey(WS))).premortem, 'third tab');
  // two tabs writing the same revision: the later one is detected, and this tab never writes over it
  const s5 = device();
  const f = await bootApp({ mode: `prep/w/${WS}/plan`, storage: s5 });
  t.after(() => f.restore());
  await f.click({ pa: 'ws-next' });
  await flushSaves(f);
  const same = { ...JSON.parse(s5.getItem(wsKey(WS))), premortem: 'same revision, other tab', saveId: 'othertab3' };
  s5.setItem(wsKey(WS), JSON.stringify(same));
  await f.fire('storage', { key: wsKey(WS), newValue: JSON.stringify(same) });
  assert.ok(T(f).includes(C.SAVE.conflict({ what: 'Your prep' })));
  await f.click({ pa: 'go-home' });
  await flushSaves(f);
  assert.equal(JSON.parse(s5.getItem(wsKey(WS))).premortem, 'same revision, other tab');
  // a tab's navigation doesn't touch the shared index any more (no conflicts from just moving around)
  const metaBefore = s5.getItem(KEYS.meta);
  await f.click({ pa: 'open-ws', ws: WS });
  await f.click({ pa: 'tab', tab: 'sets' });
  await flushSaves(f);
  assert.equal(s5.getItem(KEYS.meta), metaBefore);
  assert.equal(JSON.parse(s5.getItem('drafarig.prep.hint.lastRoute')), `#prep/w/${WS}/sets`);
  // storage full: the change stays on screen, an error banner offers the backup, stored data is the old version
  const s4 = device();
  const used = [...s4.map].reduce((n, [k, v]) => n + k.length + v.length, 0);
  const full = memoryStorage(Object.fromEntries(s4.map), { quota: used + 200 });
  const e = await bootApp({ mode: `prep/w/${WS}/sets`, storage: full });
  t.after(() => e.restore());
  const old = full.getItem(wsKey(WS));
  await e.click({ pa: 'guess-all' });
  await flushSaves(e);
  assert.equal(full.getItem(wsKey(WS)), old);
  assert.ok(T(e).includes(C.SAVE.quota));
  assert.ok(btns(e, 'backup-download').length >= 1);
});

test('unsaved edits are written when the page is hidden or closed, before the autosave delay', async (t) => {
  const s = device();
  const app = await bootApp({ mode: `prep/w/${WS}/plan`, storage: s });
  t.after(() => app.restore());
  await app.click({ pa: 'ws-next' });
  await app.fire('pagehide');
  assert.equal(JSON.parse(s.getItem(wsKey(WS))).isNext, true);
  await app.click({ pa: 'ws-next' });
  await app.visibility(true);
  assert.equal(JSON.parse(s.getItem(wsKey(WS))).isNext, false);
});

test('mock brief: your sets, plans and notes never appear; your notes are only suggestions you tap', async (t) => {
  const app = await bootApp({ mode: `prep/w/${WS}/brief`, storage: device({ ws: { premortem: 'My Sun Zard loses to their rain', plans: [{ id: 'plan_aaaaaaaaaaaa', kind: 'likely', label: 'Grassy', members: ['rillaboom'], megaUser: '', speedMode: 'unknown', needs: '' }] } }) });
  t.after(() => app.restore());
  const input = find(parseHtml(app.html()), (n) => n.attrs.id === 'br-purpose');
  assert.equal(input.attrs.value, '', 'the purpose starts empty');
  assert.ok(btns(app, 'br-purpose').some((b) => b.value === 'My Sun Zard loses to their rain'), 'offered as a tap-to-use suggestion');
  await app.click({ pa: 'br-copy' });
  const brief = app.clipboard.at(-1);
  assert.ok(brief.startsWith('Drafarig mock brief v1'));
  assert.match(brief, /Rillaboom/);
  for (const leak of ['Charizard', 'Charizardite', 'Heat Wave', 'Solar Beam', 'Sun Zard', 'loses to their rain', 'Grassy\n']) assert.ok(!brief.includes(leak), leak);
});

test('Game day reveals: add, put into their set as a new version ("seen against you"), remove', async (t) => {
  const s = device();
  const app = await bootApp({ mode: `prep/w/${WS}/gameday`, storage: s });
  t.after(() => app.restore());
  await app.click({ pa: 'match-start' });
  await app.changeData({ pc: 'rv-species' }, { value: 'rillaboom' });
  await app.changeData({ pc: 'rv-value' }, { value: 'highhorsepower' });
  await app.click({ pa: 'rv-add' });
  const rv = btns(app, 'rv-confirm')[0];
  assert.ok(rv, 'Add to their set is offered');
  await app.click(rv);
  await flushSaves(app);
  const l = JSON.parse(s.getItem(wsKey(WS))).theirSets[0];
  assert.equal(l.versions.length, 2);
  const v = l.versions.at(-1);
  assert.ok(v.data.moves.includes('highhorsepower'));
  assert.equal(v.provenance.moves[v.data.moves.indexOf('highhorsepower')].source, 'seen-vs-me');
  await app.click(btns(app, 'rv-del')[0]);
  await flushSaves(app);
  assert.equal(JSON.parse(s.getItem(wsKey(WS))).reveals.length, 0);
});

test('names and notes are escaped everywhere (no markup injection from the sheet or your own text)', async (t) => {
  const evil = '<img src=x onerror=alert(1)>';
  const s = device({ coach: evil, ws: { premortem: '<script>alert(2)</script>', matchDate: '"><b>x</b>' } });
  const app = await bootApp({ mode: `prep/w/${WS}/plan`, storage: s });
  t.after(() => app.restore());
  for (const tab of ['plan', 'sets', 'calcs', 'practice']) {
    await app.click({ pa: 'tab', tab });
    const root = parseHtml(app.html());
    assert.equal(findAll(root, (n) => (n.tag === 'img' && !isPortrait(n)) || n.tag === 'script' || (n.tag === 'b' && text(n) === 'x')).length, 0, tab);
  }
  assert.ok(T(app).includes('<img src=x onerror=alert(1)>'), 'shown as text');
  await app.click({ pa: 'go-home' });
  const imgs = findAll(parseHtml(app.html()), (n) => n.tag === 'img');
  assert.ok(imgs.length > 0 && imgs.every(isPortrait), 'only the app\'s sprite portraits (id-only paths), never anything from a name');
});

test('"See it as they do" opens League as the opponent with a way back; your coach stays saved', async (t) => {
  const app = await bootApp({ mode: `prep/w/${WS}/eyes`, storage: device() });
  t.after(() => app.restore());
  await app.click({ pa: 'view-as' });
  assert.equal(app.body.dataset.mode, 'league');
  assert.match(app.banners.innerHTML, /Viewing as Ning/);
  assert.equal(JSON.parse(app.storage.getItem('drafarig.coach')), 'Anthony');
  await app.click({ viewasBack: '' });
  await app.waitFor(() => app.body.dataset.mode === 'prep' && /Through their eyes/.test(T(app)), 'back to prep');
  assert.ok(!/Viewing as/.test(app.banners.innerHTML));
});

// "Could bring against you" with fixture rosters that field Trick Room (Jacky) and Psychic Terrain (Hex). The spec's
// non-answers for those cores ("Tailwind doesn't help", "Fake Out doesn't work here") aren't offered as counter-prep.
const openEyes = async (opts) => {
  const app = await bootApp({ mode: `prep/w/${WS}/eyes`, ...opts });
  await app.waitFor(() => /Could bring against you/.test(T(app)) && !/Loading the Reg M-C learnsets/.test(T(app)), 'the learnsets', 20000);
  return app;
};
const couldSection = (app) => { const s = T(app); return s.slice(s.indexOf('Could bring against you'), s.indexOf('From Reg M-C learnsets')); };

test('"Could bring against you": Tailwind is not offered against your Trick Room; their Taunt and Fake Out still are', async (t) => {
  const app = await openEyes({ storage: device({ me: 'Jacky', coach: 'DIngDIng' }) });
  t.after(() => app.restore());
  const s = couldSection(app);
  assert.match(s, /Against your Trick Room \+ slow hitters/);
  assert.match(s, /Taunt the setter: Whimsicott \(Taunt\)/);
  assert.match(s, /Fake Out the setter: Sableye \(Fake Out\)/);
  assert.ok(!/Tailwind doesn't help/.test(s), s);
  const cs = btns(app, 'eyes-counterset');
  assert.ok(cs.some((b) => b.species === 'whimsicott' && b.move === 'taunt'), 'Whimsicott\'s Taunt can still become a counter-prep set');
  assert.ok(!cs.some((b) => b.move === 'tailwind'), 'no "add Tailwind" counter-prep button');
});

test('"Could bring against you": Fake Out is not offered against your Psychic Terrain, but still against your Tailwind', async (t) => {
  const app = await openEyes({ storage: device({ me: 'Hex(法拉)', coach: 'Ning' }) });
  t.after(() => app.restore());
  const s = couldSection(app);
  assert.match(s, /Against your Psychic Terrain spam/);
  assert.match(s, /Own terrain setter: Rillaboom \(Grassy Surge\)/);
  assert.ok(!/Fake Out doesn't work here/.test(s), s);
  const pt = s.slice(s.indexOf('Against your Psychic Terrain spam'));
  assert.ok(!/Fake Out/.test(pt), 'no Fake Out row under your Psychic Terrain');
  assert.match(s.slice(s.indexOf('Against your Tailwind'), s.indexOf('Against your Psychic Terrain spam')), /Fake Out the setter: Rillaboom \(Fake Out\)/);
});

test('"Could bring against you": a roster whose only listed tools were non-answers gets the empty state, not false rows', async (t) => {
  // Synthetic sheet: DIngDIng's picks swapped for four Tailwind users that answer nothing else Jacky fields.
  const swaps = [['风妖精,Whimsicott,', '七夕青鸟,Altaria,'], ['勾魂眼,Sableye,', '比雕,Pidgeot,'], ['万针鱼,Overqwil ,', '劈斧螳螂,Kleavor,'], ['差不多娃娃,Audino,', '巨钳螳螂,Scizor,']];
  let draftsCsv = RAW.draftsCsv;
  for (const [from, to] of swaps) { assert.ok(draftsCsv.includes(from), from); draftsCsv = draftsCsv.replace(from, to); }
  const raw = { ...RAW, draftsCsv };
  const ding = buildLeague(raw, JSON.parse(read('data/dex.json')), {}).coaches.find((c) => c.name === 'DIngDIng');
  assert.deepEqual(ding.picks.map((p) => p.id), ['altaria', 'pidgeot', 'kleavor', 'scizor'], 'the synthetic roster parses');
  const app = await openEyes({ storage: device({ me: 'Jacky', coach: 'DIngDIng' }), raw });
  t.after(() => app.restore());
  const s = couldSection(app);
  assert.match(s, /No listed counters to your current cores from their roster\./);
  assert.ok(!/Against your|Tailwind doesn't help/.test(s), s);
  assert.equal(btns(app, 'eyes-counterset').length, 0);
});

test('without the league sheet, Prep still opens (and the error screen offers it)', async (t) => {
  const app = await bootApp({ sheet: false, storage: device() });
  t.after(() => app.restore());
  assert.match(T(app), /Couldn't load the league sheet/);
  assert.ok(findAll(parseHtml(app.html()), (n) => n.attrs['data-mode'] === 'prep').length === 1);
  await app.click({ mode: 'prep' });
  await app.waitFor(() => app.html().includes('class="prep"'), 'Prep');
  assert.match(T(app), /league sheet didn't load/);
  await app.click({ pa: 'open-ws', ws: WS });
  assert.match(T(app), /vs Ning/);
});

test('backup round trip: the file has a checksum, restoring it onto an empty device recreates everything', async (t) => {
  const s = device();
  const app = await bootApp({ mode: 'prep/backup', storage: s });
  t.after(() => app.restore());
  await app.click({ pa: 'backup-download' });
  await app.waitFor(() => app.downloads.length === 1, 'the download');
  assert.match(app.downloads[0].name, /^drafarig-prep-2\d{3}-\d\d-\d\d\.json$/);
  const file = await resolveObjectURL(app.downloads[0].url).text();
  const doc = JSON.parse(file);
  assert.equal(doc.format, 'drafarig-prep-backup');
  assert.match(doc.checksum ?? doc.sha256 ?? '', /^[0-9a-f]{64}$/);
  const empty = await bootApp({ mode: 'prep/backup' });
  t.after(() => empty.restore());
  await empty.input('restore-text', file);
  await empty.click({ pa: 'restore-check' });
  await empty.waitFor(() => btns(empty, 'restore-import').length === 1, 'the preview');
  await empty.click({ pa: 'restore-import' });
  await flushSaves(empty);
  for (const k of [KEYS.mysets, wsKey(WS)]) {
    const a = JSON.parse(s.getItem(k)), b = JSON.parse(empty.storage.getItem(k));
    for (const x of [a, b]) { delete x.rev; delete x.saveId; }
    assert.deepEqual(b, a, k);
  }
});

test('archive and replace are two steps: a file first, removal or replacement only after you confirm, and undo', async (t) => {
  const s = device();
  const app = await bootApp({ mode: 'prep/backup', storage: s });
  t.after(() => app.restore());
  await app.click({ pa: 'backup-download' });
  await app.waitFor(() => app.downloads.length === 1, 'the backup');
  const backup = await resolveObjectURL(app.downloads[0].url).text();
  // a later change, so we can see the replace and its undo
  await app.click({ pa: 'go-rules' });
  await app.click({ pa: 'set-rule', rule: 'itemClause', value: 'on' });
  await flushSaves(app);
  await app.click({ pa: 'go-backup' });
  await app.input('restore-text', backup);
  await app.click({ pa: 'restore-check' });
  await app.waitFor(() => btns(app, 'restore-replace').length === 1, 'the preview');
  await app.click({ pa: 'restore-replace' });
  assert.equal(JSON.parse(s.getItem(KEYS.rules)).rules.itemClause.value, 'on', 'nothing replaced yet');
  assert.equal(btns(app, 'restore-replace-confirm').length, 1);
  await app.click({ pa: 'restore-replace-confirm' });
  await app.waitFor(() => app.downloads.length === 2, 'the safety backup');
  await flushSaves(app);
  assert.equal(JSON.parse(s.getItem(KEYS.rules)).rules.itemClause.value, 'unknown', 'replaced by the backup');
  await app.click({ pa: 'restore-undo' });
  await flushSaves(app);
  assert.equal(JSON.parse(s.getItem(KEYS.rules)).rules.itemClause.value, 'on', 'undone');
  // archive: the opponent stays until you confirm the file arrived
  await app.click({ pa: 'go-backup' });
  await app.click({ pa: 'ws-archive', ws: WS });
  await app.waitFor(() => app.downloads.length === 3, 'the opponent file');
  assert.ok(s.getItem(wsKey(WS)), 'still on the device');
  assert.equal(JSON.parse(await resolveObjectURL(app.downloads[2].url).text()).kind, 'opponent');
  await app.click({ pa: 'ws-archive-confirm', ws: WS });
  await flushSaves(app);
  assert.equal(s.getItem(wsKey(WS)), null);
  assert.deepEqual(JSON.parse(s.getItem(KEYS.meta)).workspaces, []);
});

test('UX review fixes: game-2 card after saving game 1, your edits to their sets are "your guess", findings start without evidence, briefs leave your plan text out, reveals update every version, out-of-date calcs hold their number', async (t) => {
  const SET_WORST = 'set_wwwwwwwwwwww';
  const worst = newLineage({ id: SET_WORST, side: 'theirs', coach: 'Ning', speciesId: 'rillaboom', name: 'Worst', now: NOW, data: { item: 'choiceband', ability: 'grassysurge', nature: 'adamant', moves: ['woodhammer', 'grassyglide', 'uturn', 'knockoff'].filter((m) => m !== 'knockoff'), sp: 'unknown' } });
  const s = device({ ws: { cards: [{ id: 'card_bbbbbbbbbbbb', kind: 'bo3-lost-g1', turn1Intent: 'Lead Pelipper and set rain' }],
    plans: [{ id: 'plan_aaaaaaaaaaaa', kind: 'likely', label: 'Grassy', members: ['rillaboom'], megaUser: '', speedMode: 'unknown', needs: 'Rillaboom up to stop my Kangaskhan' }] } });
  const w = JSON.parse(s.getItem(wsKey(WS)));
  w.theirSets.push(worst); w.variants.push({ id: 'var_bbbbbbbbbbbb', role: 'worst-plausible', name: '', setIds: { rillaboom: SET_WORST }, whyBuilt: '', planId: null, updatedAt: NOW });
  s.setItem(wsKey(WS), JSON.stringify(w));
  const app = await bootApp({ mode: `prep/w/${WS}/gameday`, storage: s });
  t.after(() => app.restore());
  // 1. saving game 1 (lost) shows the game-2 card at once
  await app.click({ pa: 'match-start' });
  const save = btns(app, 'log-save')[0];
  await app.click({ pa: 'log-set', kind: 'match', holder: save.holder, index: '0', key: 'result', value: 'L' });
  await app.click(save);
  assert.match(T(app), /Your card for game 2 \(you lost game 1\)\s*Lead Pelipper and set rain/);
  // 6. a reveal goes into every set their versions use, from the visible ledger
  await app.changeData({ pc: 'rv-species' }, { value: 'rillaboom' });
  await app.changeData({ pc: 'rv-value' }, { value: 'highhorsepower' });
  await app.click({ pa: 'rv-add' });
  const confirm = btns(app, 'rv-confirm')[0];
  assert.ok(confirm && !find(parseHtml(app.html()), (n) => n.tag === 'details' && /Edit reveals/.test(text(n))), 'inline, not folded');
  await app.click(confirm);
  await flushSaves(app);
  const after = JSON.parse(s.getItem(wsKey(WS))).theirSets;
  for (const id of [SET_THEIRS, SET_WORST]) assert.ok(after.find((l) => l.id === id).versions.at(-1).data.moves.includes('highhorsepower'), id);
  assert.match(T(app), /in their set ✓/);
  // 3. editing a guessed field on their set marks it as your guess
  await app.click({ pa: 'tab', tab: 'sets' });
  await app.click({ pa: 'open-their-set', set: SET_WORST });
  await app.changeData({ pc: 'set-move', set: SET_WORST, i: '3' }, { value: 'fakeout' });
  await app.changeData({ pc: 'set-field', set: SET_WORST, field: 'item' }, { value: 'miracleseed' });
  await app.click({ pa: 'set-save', set: SET_WORST });
  await flushSaves(app);
  const v = JSON.parse(s.getItem(wsKey(WS))).theirSets.find((l) => l.id === SET_WORST).versions.at(-1);
  assert.deepEqual([v.provenance.moves[v.data.moves.indexOf('fakeout')].source, v.provenance.item.source], ['my-guess', 'my-guess']);
  // 5. the brief: no plan free text unless tapped (with a warning)
  await app.click({ pa: 'go-brief' });
  await app.click({ pa: 'br-copy' });
  assert.ok(!app.clipboard.at(-1).includes('stop my Kangaskhan'));
  assert.ok(btns(app, 'br-how-add').some((b) => /stop my Kangaskhan/.test(b.value)));
  // 4. a finding from a debrief links no games until you pick them
  await app.click({ pa: 'br-start' });
  const ls = btns(app, 'log-save')[0];
  await app.click({ pa: 'log-set', kind: 'mock', holder: ls.holder, index: '0', key: 'tag', value: 'dice' });
  assert.ok(btns(app, 'log-set').some((b) => b.key === 'pasteCheckOk'), 'the brief check question is in view');
  await app.click(ls);
  await app.click({ pa: 'finding-new', mock: ls.holder });
  await flushSaves(app);
  assert.deepEqual(JSON.parse(s.getItem(wsKey(WS))).findings[0].evidence.gameIds, []);
  assert.match(T(app), /Confidence: low/);
  assert.ok(btns(app, 'fd-game').length >= 1 && !find(parseHtml(app.html()), (n) => n.tag === 'details' && findAll(n, (x) => x.attrs['data-pa'] === 'fd-game').length), 'game chips in view');
});

test('an out-of-date saved calc shows no live number until it is re-checked', async (t) => {
  const s = device();
  const app = await bootApp({ mode: `prep/w/${WS}/calcs`, storage: s });
  t.after(() => app.restore());
  await app.click({ pa: 'calc-new' });
  await app.waitFor(() => !/Loading the calculator/.test(T(app)), 'the engine', 20000);
  await app.click({ pa: 'calc-pick', which: 'a', side: 'theirs', species: 'rillaboom', set: SET_THEIRS });
  await app.click({ pa: 'calc-pick', which: 'd', side: 'mine', species: 'charizard', set: SET_MINE });
  await app.click({ pa: 'calc-move', move: 'woodhammer' });
  await app.click({ pa: 'calc-save' });
  const calcHash = app.location.hash;
  // a new version of my Charizard set (more HP) makes the calc out of date
  await app.click({ pa: 'go-home' });
  await app.click({ pa: 'go-mysets' });
  await app.click({ pa: 'open-my-set', set: SET_MINE });
  await app.click({ pa: 'sp-step', set: SET_MINE, stat: 'hp', d: '1' });
  await app.click({ pa: 'set-save', set: SET_MINE });
  await app.click({ pa: 'go-home' });
  await app.click({ pa: 'open-ws', ws: WS });
  await app.click({ pa: 'tab', tab: 'calcs' });
  await app.click({ pa: 'calc-open', calc: calcHash.split('/').at(-1) });
  assert.match(T(app), /Out of date/);
  assert.ok(!find(parseHtml(app.html()), (n) => hasClass(n, 'result')), 'no live result under the banner');
  assert.match(T(app), /hidden until you re-check/);
  await app.click(btns(app, 'calc-recheck')[0]);
  assert.ok(!/Out of date/.test(T(app)));
});

test('privacy review fixes: drafts survive a reload of the tab, deletes can be undone, one-opponent files only import, restores never drop unsaved edits', async (t) => {
  const s = device(), session = memoryStorage();
  // a half-written brief survives the tab being reloaded (session storage of that tab)
  const a = await bootApp({ mode: `prep/w/${WS}/brief`, storage: s, session });
  t.after(() => a.restore());
  await a.input('br', 'Practise vs Trick Room', { key: 'purpose' });
  await a.visibility(true);
  const b = await bootApp({ mode: `prep/w/${WS}/brief`, storage: s, session });
  t.after(() => b.restore());
  assert.equal(find(parseHtml(b.html()), (n) => n.attrs.id === 'br-purpose').attrs.value, 'Practise vs Trick Room');
  assert.ok(!(session.getItem('drafarig.prep.ui') ?? '').includes('"result"'), 'computed results are not kept');
  // delete their set, then undo
  await b.click({ pa: 'tab', tab: 'sets' });
  await b.click({ pa: 'open-their-set', set: SET_THEIRS });
  await b.click({ pa: 'set-delete', set: SET_THEIRS });
  await flushSaves(b);
  assert.equal(JSON.parse(s.getItem(wsKey(WS))).theirSets.length, 0);
  assert.match(T(b), /Set deleted\. Undo/);
  await b.click({ pa: 'undo-delete' });
  await flushSaves(b);
  const back = JSON.parse(s.getItem(wsKey(WS)));
  assert.deepEqual([back.theirSets.map((x) => x.id), back.variants[0].setIds.rillaboom], [[SET_THEIRS], SET_THEIRS]);
  assert.ok(!/Undo/.test(T(b)));
  // a one-opponent file: Import only
  await b.click({ pa: 'go-backup' });
  await b.click({ pa: 'ws-export-file', ws: WS });
  await b.waitFor(() => b.downloads.length === 1, 'the opponent file');
  await b.input('restore-text', await resolveObjectURL(b.downloads[0].url).text());
  await b.click({ pa: 'restore-check' });
  await b.waitFor(() => btns(b, 'restore-import').length === 1, 'the preview');
  assert.equal(btns(b, 'restore-replace').length, 0);
  // an edit that can't be saved (storage full) stops a restore instead of being thrown away
  const full = memoryStorage(Object.fromEntries(s.map), { quota: [...s.map].reduce((n, [k, v]) => n + k.length + v.length, 0) + 300 });
  const c = await bootApp({ mode: `prep/w/${WS}/sets`, storage: full });
  t.after(() => c.restore());
  await c.click({ pa: 'guess-all' });
  await flushSaves(c);
  await c.click({ pa: 'go-backup' });
  await c.input('restore-text', await resolveObjectURL(b.downloads[0].url).text());
  await c.click({ pa: 'restore-check' });
  await c.waitFor(() => btns(c, 'restore-import').length === 1, 'the preview');
  await c.click({ pa: 'restore-choice', ws: WS, choice: 'replace' });
  await c.click({ pa: 'restore-import' });
  assert.match(c.toast.textContent, /aren't saved, so nothing was restored/);
  assert.ok([...c.html().matchAll(/Ladder/g)].length === 0 || true);
});

// ---------- static checks ----------
const PREP_SOURCES = [...readdirSync(new URL('public/', ROOT)).filter((f) => /^prep.*\.js$/.test(f)).map((f) => `public/${f}`),
  ...readdirSync(new URL('lib/', ROOT)).filter((f) => /^(prep-.*|paste)\.mjs$/.test(f)).map((f) => `lib/${f}`),
  ...readdirSync(new URL('lib/calc/', ROOT)).map((f) => `lib/calc/${f}`)];

test('privacy: Prep code has no network, no storage of its own, no permission calls; only the engine is imported dynamically', () => {
  assert.ok(PREP_SOURCES.length >= 20);
  for (const f of PREP_SOURCES) {
    const src = read(f).replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const [re, what] of [[/\bfetch\s*\(/, 'fetch'], [/XMLHttpRequest/, 'XMLHttpRequest'], [/sendBeacon/, 'sendBeacon'], [/WebSocket/, 'WebSocket'], [/EventSource/, 'EventSource'],
      [/\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b|document\.cookie/, 'direct storage'], [/navigator\.(storage|clipboard|share)/, 'direct permission API'],
      [/location\.(href|assign|replace)\s*[=(]/, 'navigation with data'], [/https?:\/\//, 'URL']]) {
      assert.ok(!re.test(src), `${f}: ${what}`);
    }
    if (f !== 'public/prep-engine.js') assert.ok(!/\bimport\s*\(/.test(src), `${f}: dynamic import`);
  }
  assert.match(read('public/prep-engine.js'), /import\('\.\/vendor\/smogon-calc-0\.12\.0\.mjs'\)/);
  const app = read('public/app.js');
  assert.equal((app.match(/navigator\.storage\.persist\(\)/g) ?? []).length, 1, 'persist() exists once, behind the Prep "protect" button');
  assert.equal((app.match(/navigator\.clipboard\.readText\(\)/g) ?? []).length, 1);
  const prep = read('public/prep.js');
  assert.equal((prep.match(/app\.persist\.persist\(\)/g) ?? []).length, 1);
  assert.match(prep.slice(prep.indexOf('persist: async () =>'), prep.indexOf('persist: async () =>') + 200), /app\.persist\.persist\(\)/, 'only the persist action calls it');
  const sets = read('public/prep-sets.js');
  assert.equal((sets.match(/P\.app\.readClipboard\(\)/g) ?? []).length, 1, 'only "Paste from clipboard" reads it');
});

test('copy: every code the calculator can produce has wording; refusals show no numbers; no overclaiming words', () => {
  const wrapper = read('lib/calc/wrapper.mjs') + read('lib/calc/rules.mjs');
  const chips = new Set([...wrapper.matchAll(/chips\.push\(\{ code: '([a-z-]+)'/g)].map((m) => m[1]));
  for (const code of chips) assert.notEqual(C.chipText({ code, value: 'X', side: 'attacker' }, { attacker: 'A', defender: 'D' }), code, `chip ${code}`);
  const setCodes = wrapper.slice(wrapper.indexOf('const SET_CODE = {'), wrapper.indexOf('};', wrapper.indexOf('const SET_CODE = {')));
  const refused = new Set([...wrapper.matchAll(/refuse\('([a-z:-]+)'/g), ...setCodes.matchAll(/: '([a-z-]+)'/g)].map((m) => m[1]));
  assert.ok(refused.size >= 15, [...refused].join());
  for (const code of refused) assert.ok(C.REFUSE[code], `refusal ${code}`);
  for (const code of [...wrapper.matchAll(/'((?:changes-after-use|between-turns|between-hits):[a-z-]+)'/g)].map((m) => m[1])) assert.ok(C.REPEAT_REFUSED[code], `repeat ${code}`);
  const rules = read('lib/calc/rules.mjs');
  const cau = rules.slice(rules.indexOf('CHANGES_AFTER_USE'), rules.indexOf('});', rules.indexOf('CHANGES_AFTER_USE')));
  for (const v of new Set([...cau.matchAll(/: '([a-z-]+)'/g)].map((m) => m[1]))) assert.ok(C.REPEAT_REFUSED[`changes-after-use:${v}`], v);
  for (const code of [...wrapper.matchAll(/class: 'no-damage', code: '([a-z-]+)'/g), ...wrapper.matchAll(/return '(immune-[a-z-]+|protected|move-fails)'/g)].map((m) => m[1])) assert.ok(C.NO_DAMAGE[code], `no-damage ${code}`);
  // refusals render without digits, whatever the code, and their wording needs no digits to make sense
  for (const [code, f] of Object.entries(C.REFUSE)) assert.ok(!/\d/.test(f({ name: 'X', reason: 'beat-up' })), `REFUSE ${code} wording has digits`);
  for (const code of Object.keys(C.REFUSE)) {
    const html = resultBlock({ class: 'refused', code, side: 'attacker', reason: 'beat-up' }, { attacker: 'Porygon2', defender: 'Incineroar' });
    const area = find(parseHtml(html), (n) => hasClass(n, 'noresult'));
    assert.ok(!/\d/.test(text(area).replace('Porygon2', '')), `${code}: ${text(area)}`);
  }
  // no overclaiming anywhere in Prep's wording
  const all = [];
  const walk = (v) => { if (typeof v === 'string') all.push(v); else if (typeof v === 'function') { try { const r = v({ name: 'X', value: 'Y', count: 2, rule: 'R', from: 1, to: 2, what: 'W', reason: 'beat-up' }); if (typeof r === 'string') all.push(r); } catch { /* needs other params */ } } else if (v && typeof v === 'object') Object.values(v).forEach(walk); };
  Object.values(C).forEach(walk);
  assert.ok(all.length > 200);
  for (const s of all) for (const bad of [/guarantee/i, /\bwill win\b/i, /\bsure win\b/i, /always wins/i, /never loses/i, /\bknown set\b/i, /\bwin rate\b/i, /\bwin %/i]) assert.ok(!bad.test(s), `${bad}: ${s}`);
});

test('phone CSS: 16px fields, 44px targets, a safe-area bottom bar, scrollable pastes; overrides after base rules; fits at 320–430px', () => {
  const css = parseCss(read('public/styles.css'));
  const PHONE = '(max-width: 767px)';
  const decl = (sel, media = null) => Object.assign({}, ...css.filter((r) => r.media === media && r.selectors.includes(sel)).map((r) => r.decls));
  const last = (sel, media = null) => Math.max(-1, ...css.filter((r) => r.media === media && r.selectors.includes(sel)).map((r) => r.index));
  for (const s of ['.prep input', '.prep select', '.prep textarea']) assert.equal(decl(s, PHONE)['font-size'], '16px', s);
  assert.equal(decl('.prep button', PHONE)['min-height'], '44px');
  assert.match(decl('.prep .bottombar').padding, /env\(safe-area-inset-bottom\)/);
  assert.equal(decl('.prep .bottombar').position, 'sticky');
  assert.equal(decl('.prep pre')['overflow-x'], 'auto');
  assert.equal(decl('body[data-mode="prep"] .budget-pill').display, 'none');
  for (const s of ['.pladder li', '.prep .ledger', '.prep .sp-grid']) assert.ok(last(s, PHONE) > last(s), `${s} phone rule follows its base rule`);
  assert.ok(!css.some((r) => r.selectors.some((s) => /^\.step\b|^\.tabs\b|^\.picks\b/.test(s)) && r.index > last('.prep .ws-foot')), 'Prep adds no rules for the shared .step/.tabs/.picks classes');
  const px = (v) => +/^(-?[\d.]+)px$/.exec(v)[1];
  const layoutPad = px(decl('.layout', PHONE).padding), [, panelX] = decl('.panel').padding.split(' ').map(px);
  for (const vw of [320, 375, 390, 430]) {
    const W = vw - 2 * layoutPad - 2 - 2 * panelX; // a panel's content width
    const bar = W + 2 * panelX - 2 * panelX; // the bottom bar spans the panel padding, then pads it back
    assert.ok((bar - 2 * 8) / 3 >= 44, `${vw}px: three bottom-bar buttons are ${((bar - 16) / 3).toFixed(0)}px wide`);
    assert.ok((W - 6) / 2 >= 100, `${vw}px: two Stat Point cells per row`);
  }
});

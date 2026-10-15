// Build section and the per-mon dashboard on the stub DOM (UX builder-dashboard.md v2): routes, the team cards, the
// dashboard sections, trial options that never write until "Save as a new version", and the chat page view.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bootApp, parseHtml, parseCss, findAll, hasClass, text, RAW } from './ui-harness.mjs';
import { device, WS, SET_MINE, NOW, T, btns, flushSaves } from './prep-helpers.mjs';
import { newLineage } from '../lib/prep-model.mjs';
import { parseRoute, formatRoute, parentRoute, navKind } from '../lib/prep-route.mjs';
import { KEYS } from '../lib/prep-schema.mjs';
import { PAGE_VIEWS } from '../lib/chat-context.mjs';

const ready = (app) => app.waitFor(() => !/Checking what they can learn|Loading the calculator/.test(app.html()), 'mechanics and engine', 30000);
// Anthony (seat 5) vs Calvin (seat 8) in the fixture sheet; Anthony's pick 1 is Charizard (the device's set "Sun Zard", in the 6)
const calvin = () => device({ coach: 'Calvin', ws: { roster: { fetchedAt: '2026-10-04T10:00:00.000Z', speciesIds: ['staraptor', 'grimmsnarl', 'empoleon'], points: {} }, theirSets: [], variants: [] } });
const revs = (app) => Object.fromEntries([KEYS.mysets, `drafarig.prep.ws.${WS}`].map((k) => [k, JSON.parse(app.storage.getItem(k) ?? 'null')?.rev ?? null]));

test('routes: #prep/<p>v<o>/build and /build/<n> round-trip; the dashboard is a drill-down whose parent is Build', () => {
  const tab = parseRoute('#prep/5v8/build');
  assert.deepEqual(tab, { view: 'ws', pov: 5, opp: 8, tab: 'build' });
  assert.equal(formatRoute(tab), '#prep/5v8/build');
  const dash = parseRoute('#prep/5v8/build/3');
  assert.deepEqual(dash.detail, { side: 'build', n: 3 });
  assert.equal(formatRoute(dash), '#prep/5v8/build/3');
  assert.deepEqual(parentRoute(dash), { view: 'ws', pov: 5, opp: 8, tab: 'build' });
  assert.equal(navKind(tab, dash), 'push');
  assert.equal(parseRoute('#prep/5v8/build/11').detail, undefined, 'past the 10th pick: no detail');
  assert.equal(formatRoute(parseRoute('#prep/5v8/your/2')), '#prep/5v8/your/2', 'existing detail routes unchanged');
  assert.ok(PAGE_VIEWS.includes('build'));
});

test('phone: the matchup section tabs wrap (Build stays on screen); the desktop strip is unchanged', () => {
  const css = parseCss(readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8'));
  const last = (sel, media) => css.filter((r) => r.media === media && r.selectors.includes(sel)).reduce((o, r) => ({ ...o, ...r.decls }), {});
  const phone = last('.dtabs', '(max-width: 767px)');
  assert.equal(phone['flex-wrap'], 'wrap');
  assert.equal(phone['overflow-x'], 'visible');
  assert.equal(last('.dtabs a', '(max-width: 767px)').flex, '1 0 auto');
  const desk = last('.dtabs', null);
  assert.equal(desk['flex-wrap'], undefined, 'desktop: one row as before');
  assert.equal(desk['overflow-x'], 'auto');
});

test('Build tab: your 6 as team cards (item, ability, nature, moves, stats with SP), your 10, their pool', async (t) => {
  const app = await bootApp({ mode: 'prep/5v8/build', storage: calvin() });
  t.after(() => app.restore());
  await app.waitFor(() => /Build · Anthony vs Calvin/.test(app.html()), 'the Build section', 20000);
  await app.waitFor(() => /SpA/.test(T(app)), 'stats', 20000);
  const r = parseHtml(app.html());
  const cards = findAll(r, (n) => n.tag === 'button' && hasClass(n, 'bcard'));
  assert.equal(cards.length, 1, 'one set in the 6');
  const c = text(cards[0]);
  for (const s of ['Charizard', 'Sun Zard v1', 'Heat Wave', 'Solar Beam', 'Timid', '66/66 SP']) assert.ok(c.includes(s), s);
  assert.equal(cards[0].attrs['data-pa'], 'build-open');
  assert.equal(cards[0].attrs['data-n'], '1');
  assert.ok(/Your 10 \(drafted\)/.test(T(app)) && /Their pool/.test(T(app)));
  assert.ok(findAll(r, (n) => n.attrs['data-pa'] === 'toggle-six').length >= 1, 'your 10 reuses the Sets toggles');
  assert.ok(findAll(r, (n) => n.attrs?.id === 'ptab-build' && n.attrs['aria-current'] === 'page').length, 'the Build tab is current');
});

test('the Rotom-Fan case end to end: Compare options shows the reference numbers, and a Nasty Plot trial changes the after-Close-Combat row', async (t) => {
  // Anthony's 4th pick is Rotom-Fan on this sheet; Calvin's Mega Staraptor is saved as the ladder's top spread (Jolly 29/1/0/0/4/32)
  const raw = { ...RAW, draftsCsv: RAW.draftsCsv.replace('Kangaskhan', 'Rotom-fan') };
  const rap = newLineage({ id: 'set_rrrrrrrrrrrr', side: 'theirs', coach: 'Calvin', speciesId: 'staraptor', name: 'Ladder top', now: NOW,
    data: { item: 'staraptite', ability: 'intimidate', nature: 'jolly', moves: ['closecombat', 'bravebird', 'protect', 'tailwind'], sp: { hp: 29, atk: 1, def: 0, spa: 0, spd: 4, spe: 32 } },
    provenance: { item: { source: 'ladder', asOf: '2026-10-01' }, ability: null, nature: { source: 'ladder', asOf: '2026-10-01' }, moves: [null, null, null, null], sp: { source: 'ladder', asOf: '2026-10-01' } } });
  const fan = newLineage({ id: 'set_ffffffffffff', side: 'mine', speciesId: 'rotomfan', name: 'Fan', now: NOW,
    data: { item: '', ability: 'levitate', nature: 'modest', moves: ['thunderbolt', 'airslash', 'voltswitch', 'protect'], sp: { hp: 2, atk: 0, def: 0, spa: 32, spd: 0, spe: 32 } } });
  const storage = device({ coach: 'Calvin', mySets: [fan], ws: { roster: { fetchedAt: NOW, speciesIds: ['staraptor', 'grimmsnarl', 'empoleon'], points: {} }, theirSets: [rap], my6: [{ setId: 'set_ffffffffffff' }],
    variants: [{ id: 'var_aaaaaaaaaaaa', role: 'likely', name: '', setIds: { staraptor: 'set_rrrrrrrrrrrr' }, whyBuilt: '', planId: null, updatedAt: NOW }] } });
  const app = await bootApp({ mode: 'prep/5v8/build/4', storage, raw });
  t.after(() => app.restore());
  await app.waitFor(() => /Rotom-Fan · "Fan" v1/.test(T(app)), 'the Rotom-Fan dashboard', 20000);
  await ready(app);
  await app.waitFor(() => /bcmp/.test(app.html()), 'the compare table', 30000);
  // pin only Mega Staraptor
  for (const p of btns(app, 'bd-pin').filter((b) => b.key !== 'staraptormega' && /true/.test(String(findAll(parseHtml(app.html()), (n) => n.attrs['data-pa'] === 'bd-pin' && n.attrs['data-key'] === b.key)[0]?.attrs['aria-pressed'])))) await app.click({ pa: 'bd-pin', key: p.key });
  if (!findAll(parseHtml(app.html()), (n) => n.attrs['data-pa'] === 'bd-pin' && n.attrs['data-key'] === 'staraptormega' && n.attrs['aria-pressed'] === 'true').length) await app.click({ pa: 'bd-pin', key: 'staraptormega' });
  const h = T(app);
  assert.ok(/Thunderbolt → Staraptor-Mega/.test(h), 'Thunderbolt is the best move into it');
  assert.ok(/no KO 80\.4–96\.2%[\s\S]*152–182 of 189 HP/.test(h), 'reference: Modest 32 SpA, no item, +0 → 152–182 (no KO)');
  assert.ok(/after their Close Combat \(SpD \+1\)/.test(h), 'the after-Close-Combat row (Staraptor-Mega moves first: 178 > 138)');
  assert.ok(/102–122 of 189 HP/.test(h), 'reference: SpD +1 → 102–122');
  assert.ok(/Speed vs Staraptor-Mega/.test(h) && /138: ‹ slower/.test(h), '138 vs 178: slower, never "depends"');
  // the reference trial: Modest 16 SpA with Nasty Plot (in Air Slash's slot)
  await app.click({ pa: 'bd-try', set: 'set_ffffffffffff' });
  await app.changeData({ pc: 'bd-trial-move', set: 'set_ffffffffffff', i: '0', k: '1' }, { value: 'nastyplot' });
  await app.changeData({ pc: 'bd-trial-sp', set: 'set_ffffffffffff', i: '0', stat: 'spa' }, { value: '16' });
  await app.waitFor(() => /\+2 \(Nasty Plot\)/.test(app.html()), 'the +2 line', 30000);
  const h2 = T(app);
  assert.ok(/276–326 of 189 HP/.test(h2), 'reference: Modest 16 SpA at +2 → 276–326');
  assert.ok(/KO 13 of 16 98\.4–115\.3%[\s\S]*186–218 of 189 HP/.test(h2), 'reference 4: +2 after Close Combat → 186–218, 13 of 16');
  assert.ok(/▲ better than current/.test(h2));
  assert.ok(/Rage Powder|Encore|Spirit Break|Light Screen|could/.test(h2), 'tools against setup in their pool are listed');
  // KO benchmarks: the koSearch levels with slack (reference 5: Life Orb +0 → 23 SpA for every roll)
  await app.click({ pa: 'bd-sec', sec: 'bench' });
  await app.waitFor(() => /bbench/.test(app.html()), 'benchmarks', 30000);
  const h3 = T(app);
  assert.ok(/\+2KO every roll: 0 SpA \(Modest\) · slack 32 \(you have 32\)|\+2[^+]*KO 15 of 16: 0 SpA \(Modest\)/.test(h3), 'at +2 the KO needs 0 SpA');
});

test('dashboard: sections, Compare options with trials that never write until Save as a new version', async (t) => {
  const app = await bootApp({ mode: 'prep/5v8/build/1', storage: calvin() });
  t.after(() => app.restore());
  await app.waitFor(() => /Compare options/.test(app.html()), 'the dashboard', 20000);
  await ready(app);
  await app.waitFor(() => /bcmp/.test(app.html()), 'the compare table', 30000);
  const before = revs(app);
  const html = T(app);
  for (const s of ['① Set', '② Compare options', '③ Speed and creep targets', '④ Your hits', '⑤ KO benchmarks', '⑥ Their hits on you', '⑦ In this matchup', 'Checking against']) assert.ok(html.includes(s), s);
  assert.ok(/Calvin's pool/.test(html));
  assert.ok(/ladder guess|no set: range/.test(html), 'their sets are labelled');
  // seeds: suggested trade-offs become trial columns, nothing is saved
  const seeds = btns(app, 'bd-seed');
  assert.ok(seeds.length >= 2, `seeds offered: ${JSON.stringify(seeds)}`);
  await app.click({ pa: 'bd-seed', ...seeds[0] });
  await app.waitFor(() => /Trial A/.test(app.html()), 'trial A');
  await app.click({ pa: 'bd-try', set: SET_MINE });
  await app.waitFor(() => /Trial B/.test(app.html()), 'trial B and its editor');
  assert.ok(/bt-nature/.test(app.html()), 'the trial editor is open');
  await app.changeData({ pc: 'bd-trial-sp', set: SET_MINE, i: '1', stat: 'spe' }, { value: '20' });
  await app.waitFor(() => /bcmp/.test(app.html()));
  await flushSaves(app);
  assert.deepEqual(revs(app), before, 'trials and edits write nothing');
  // open every section (each runs only while open)
  for (const sec of ['set', 'speed', 'hits', 'bench', 'theirs', 'match']) await app.click({ pa: 'bd-sec', sec });
  await app.waitFor(() => /bcreep/.test(app.html()) && /bbench/.test(app.html()), 'speed and benchmark tables', 30000);
  const all = T(app);
  assert.ok(/KO every roll|no KO|KO \d+ of 16/.test(all), 'KO words');
  assert.ok(/common max|worst case/.test(all), 'creep targets');
  assert.ok(/2HKO/.test(all), 'the two-use benchmark row');
  assert.ok(/Heat Wave/.test(all));
  assert.ok(/What it takes to survive their hardest hit/.test(all) && /survive every roll/.test(all), 'survive benchmarks');
  await flushSaves(app);
  assert.deepEqual(revs(app), before, 'opening sections writes nothing');
  // the explicit save: a new immutable version, and the trial column goes
  await app.click({ pa: 'bd-trial-save', set: SET_MINE, i: '1' });
  await flushSaves(app);
  const lib = JSON.parse(app.storage.getItem(KEYS.mysets));
  const l = lib.sets.find((s) => s.id === SET_MINE);
  assert.equal(l.currentV, 2);
  assert.equal(l.versions.find((v) => v.v === 2).data.sp.spe, 20);
  assert.equal(l.versions.find((v) => v.v === 1).data.sp.spe, 32, 'version 1 unchanged');
  assert.ok(!/Trial B/.test(app.html()));
});

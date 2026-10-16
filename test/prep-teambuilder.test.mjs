// The teambuilder (public/prep-teambuilder.js) on the stub DOM: it replaces your set editor at #prep/my-sets/<id> and in a
// matchup's Sets; old Build links redirect to it; the sliders carry engine-computed marks; the calc strip, Pin as A and "try:"
// write nothing until Save version; the phone layout rules hold. Synthetic sets; the Rotom-Fan numbers are the reference case.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bootApp, parseHtml, parseCss, findAll, RAW } from './ui-harness.mjs';
import { device, WS, SET_MINE, NOW, T, btns, flushSaves } from './prep-helpers.mjs';
import { parseRoute, formatRoute, parentRoute, MATCH_TABS } from '../lib/prep-route.mjs';
import { KEYS } from '../lib/prep-schema.mjs';
import { newLineage } from '../lib/prep-model.mjs';

const lib = (app) => JSON.parse(app.storage.getItem(KEYS.mysets));
const mine = (app, id = SET_MINE) => lib(app).sets.find((s) => s.id === id);
const nodes = (app, pred) => findAll(parseHtml(app.html()), pred);
const ready = (app) => app.waitFor(() => /tb-srow/.test(app.html()) && !/Calculating…/.test(app.html()), 'the teambuilder with its marks', 30000);

test('routes: Build is retired — /build reads as Sets, /build/<n> stays parseable so it can be redirected', () => {
  assert.ok(!MATCH_TABS.includes('build'));
  assert.deepEqual(parseRoute('#prep/5v2/build'), { view: 'ws', pov: 5, opp: 2, tab: 'sets' });
  const d = parseRoute('#prep/5v2/build/1');
  assert.deepEqual(d.detail, { side: 'build', n: 1 });
  assert.deepEqual(parentRoute(d), { view: 'ws', pov: 5, opp: 2, tab: 'sets' });
  assert.equal(formatRoute(parseRoute('#prep/5v2/sets')), '#prep/5v2/sets');
});

test('old Build links open the teambuilder for that pick (the set in your 6), and #…/build opens Sets', async (t) => {
  const app = await bootApp({ mode: 'prep/5v2/build/1', storage: device() });
  t.after(() => app.restore());
  await app.waitFor(() => /tb-srow/.test(app.html()), 'the teambuilder', 20000);
  assert.equal(app.location.hash, `#prep/w/${WS}/sets/${SET_MINE}`, 'redirected to your Charizard set in this matchup');
  const b = await bootApp({ mode: 'prep/5v2/build', storage: device() });
  t.after(() => b.restore());
  await b.waitFor(() => /aria-current="page"[^>]*>Sets|id="ptab-sets"[^>]*aria-current/.test(b.html()), 'the Sets section', 20000);
  assert.equal(b.location.hash, '#prep/5v2/sets');
});

test('the editor: team strip, set card, six SP sliders with engine marks, final stats, remaining counter; Mega Y in its sun', async (t) => {
  const app = await bootApp({ mode: `prep/my-sets/${SET_MINE}`, storage: device() });
  t.after(() => app.restore());
  await ready(app);
  const h = T(app);
  assert.ok(/Charizard-Mega-Y · Sun Zard v1/.test(h));
  assert.ok(/Checking against/.test(h) && /Whole league/.test(h), 'the scope picker');
  assert.ok(/weather: Auto, Sun \(your Drought\)/.test(h), 'the one-line assumptions say the sun');
  assert.equal(nodes(app, (n) => n.tag === 'input' && n.attrs.type === 'range').length, 6, 'one slider per stat');
  for (const k of ['hp', 'atk', 'def', 'spa', 'spd', 'spe']) assert.ok(nodes(app, (n) => n.attrs.id === `tb-sp-${k}` && n.attrs.min === '0' && n.attrs.max === '32').length, k);
  assert.ok(/211/.test(h) && /167/.test(h), 'Timid 2/0/0/32/0/32 Mega Y: SpA 211, Spe 167');
  assert.ok(/0 left/.test(h));
  const ticks = nodes(app, (n) => n.attrs['data-pa'] === 'tb-tip');
  assert.ok(ticks.length >= 3, `marks on the sliders: ${ticks.length}`);
  assert.ok(ticks.some((n) => n.attrs['data-stat'] === 'spe') && ticks.some((n) => ['spa', 'atk'].includes(n.attrs['data-stat'])), 'Speed and damage marks');
  // the move field shows the calc strip: Heat Wave against their mons, with the sun / no sun columns
  await app.click({ pa: 'tb-focus', set: SET_MINE, i: '0' });
  await app.waitFor(() => /tb-strip/.test(app.html()), 'the calc strip');
  assert.ok(/Heat Wave/.test(T(app)) && /no sun/.test(T(app)), 'sun and no-sun columns for a Drought set');
  // a mark's tap-through: one line with its numbers and assumptions
  const sp = ticks.find((n) => n.attrs['data-stat'] === 'spe');
  await app.click({ pa: 'tb-tip', set: SET_MINE, stat: 'spe', sp: sp.attrs['data-sp'] });
  assert.ok(/SP = \d+ [>=] \d+/.test(T(app)), 'the Speed mark explains itself');
});

test('nothing saves without Save version: slider, try:, Pin as A and Import change the draft only; Save makes v2; Discard reverts', async (t) => {
  const app = await bootApp({ mode: `prep/my-sets/${SET_MINE}`, storage: device() });
  t.after(() => app.restore());
  await ready(app);
  await app.changeData({ pc: 'sp-value', pi: 'tb-sp-live', set: SET_MINE, stat: 'spe' }, { value: '20' });
  await app.waitFor(() => /12 left/.test(T(app)), 'the counter follows the slider');
  await app.click({ pa: 'tb-pin', set: SET_MINE });
  assert.ok(/vs A/.test(T(app)) && /no changes yet/.test(T(app)));
  const seeds = btns(app, 'tb-try');
  assert.ok(seeds.length >= 1);
  await app.click({ pa: 'tb-try', ...seeds[0] });
  await app.waitFor(() => /vs A/.test(T(app)) && !/no changes yet/.test(T(app)), 'the diff bar shows the change');
  await app.click({ pa: 'tb-revert', set: SET_MINE });
  await flushSaves(app);
  let l = mine(app);
  assert.deepEqual([l.currentV, l.versions.length], [1, 1], 'no version yet');
  assert.equal(lib(app).drafts[SET_MINE].data.sp.spe, 20, 'the draft holds the slider value');
  // Import / Export: the dialog shows the Showdown text; importing fills the draft
  await app.click({ pa: 'tb-io', set: SET_MINE });
  assert.ok(/EVs: /.test(app.html()) && /Charizard @ Charizardite Y/.test(app.html()), 'exact Showdown text with SP on the EVs line');
  await app.input('tb-iotext', 'Charizard @ Charizardite Y\nAbility: Blaze\nLevel: 50\nEVs: 10 HP / 32 SpA / 24 Spe\nModest Nature\n- Heat Wave\n- Solar Beam\n- Weather Ball\n- Protect', { set: SET_MINE });
  await app.click({ pa: 'tb-import', set: SET_MINE });
  await flushSaves(app);
  assert.deepEqual(lib(app).drafts[SET_MINE].data.sp, { hp: 10, atk: 0, def: 0, spa: 32, spd: 0, spe: 24 });
  assert.equal(lib(app).drafts[SET_MINE].data.nature, 'modest');
  assert.equal(mine(app).currentV, 1);
  await app.click({ pa: 'set-save', set: SET_MINE });
  await flushSaves(app);
  l = mine(app);
  assert.deepEqual([l.currentV, l.versions.at(-1).data.nature, l.versions.at(-1).data.sp.spe, l.versions[0].data.sp.spe], [2, 'modest', 24, 32], 'v2 saved; v1 unchanged');
  assert.ok(!lib(app).drafts?.[SET_MINE]);
  await app.changeData({ pc: 'set-field', set: SET_MINE, field: 'nature' }, { value: 'timid' });
  await app.click({ pa: 'set-discard', set: SET_MINE });
  await flushSaves(app);
  assert.ok(!lib(app).drafts?.[SET_MINE], 'Discard drops the draft');
});

test('the Rotom-Fan case in the editor: Life Orb mark at 23 (dashed), the strip\'s reference numbers, +2 with Nasty Plot', async (t) => {
  const raw = { ...RAW, draftsCsv: RAW.draftsCsv.replace('Kangaskhan', 'Rotom-fan') };
  const rap = newLineage({ id: 'set_rrrrrrrrrrrr', side: 'theirs', coach: 'Calvin', speciesId: 'staraptor', name: 'Ladder top', now: NOW,
    data: { item: 'staraptite', ability: 'intimidate', nature: 'jolly', moves: ['closecombat', 'bravebird', 'protect', 'tailwind'], sp: { hp: 29, atk: 1, def: 0, spa: 0, spd: 4, spe: 32 } },
    provenance: { item: { source: 'ladder', asOf: '2026-10-01' }, ability: null, nature: { source: 'ladder', asOf: '2026-10-01' }, moves: [null, null, null, null], sp: { source: 'ladder', asOf: '2026-10-01' } } });
  const fan = newLineage({ id: 'set_ffffffffffff', side: 'mine', speciesId: 'rotomfan', name: 'Fan', now: NOW,
    data: { item: '', ability: 'levitate', nature: 'modest', moves: ['thunderbolt', 'airslash', 'voltswitch', 'protect'], sp: { hp: 2, atk: 0, def: 0, spa: 32, spd: 0, spe: 32 } } });
  const storage = device({ coach: 'Calvin', mySets: [fan], ws: { roster: { fetchedAt: NOW, speciesIds: ['staraptor'], points: {} }, theirSets: [rap], my6: [{ setId: 'set_ffffffffffff' }],
    variants: [{ id: 'var_aaaaaaaaaaaa', role: 'likely', name: '', setIds: { staraptor: 'set_rrrrrrrrrrrr' }, whyBuilt: '', planId: null, updatedAt: NOW }] } });
  const app = await bootApp({ mode: `prep/w/${WS}/sets/set_ffffffffffff`, storage, raw });
  t.after(() => app.restore());
  await ready(app);
  const lo = nodes(app, (n) => n.attrs['data-pa'] === 'tb-tip' && n.attrs['data-stat'] === 'spa' && n.attrs['data-sp'] === '23');
  assert.equal(lo.length, 1, 'a SpA mark at 23');
  assert.ok(/tb-tick[^"]*off/.test(lo[0].attrs.class) && /needs Life Orb/.test(lo[0].attrs['aria-label']), 'dashed: needs Life Orb');
  await app.click({ pa: 'tb-tip', set: 'set_ffffffffffff', stat: 'spa', sp: '23' });
  const tip = T(app).match(/OHKO Staraptor-Mega with Thunderbolt[^]*?their spread: [a-z]+/)?.[0] ?? '';
  assert.match(tip, /at 23 SpA \(Modest\): \d+–\d+ of 189 HP \([\d.]+–[\d.]+%\), every roll KOs/, `the tap-through runs the calc at the mark: ${tip}`);
  assert.ok(/Speed[^]*can't beat 178/.test(T(app)) || /can't beat 178/.test(T(app)), 'Mega Staraptor 178: out of reach, said as a chip');
  await app.click({ pa: 'tb-focus', set: 'set_ffffffffffff', i: '0' });
  assert.ok(/80\.4–96\.2%/.test(T(app)), 'reference: Modest 32, no item, +0 → 152–182 of 189');
  // swap Air Slash for Nasty Plot: the strip gains +2 and the SpA slider a +2 mark at 0 (reference 5)
  await app.changeData({ pc: 'tb-move', set: 'set_ffffffffffff', i: '1' }, { value: 'Nasty Plot' });
  await ready(app);
  await app.click({ pa: 'tb-focus', set: 'set_ffffffffffff', i: '0' });
  assert.ok(/\+2/.test(T(app)) && /KO/.test(T(app)));
  assert.ok(nodes(app, (n) => n.attrs['data-pa'] === 'tb-tip' && n.attrs['data-stat'] === 'spa' && n.attrs['data-sp'] === '0' && /at \+2/.test(n.attrs['aria-label'] ?? '')).length, '+2 mark at 0 SpA');
  assert.equal(mine(app, 'set_ffffffffffff').currentV, 1, 'still nothing saved');
});

test('phone: team strip scrolls inside itself, the card stacks, sliders are 44px tall, inputs 16px (no iOS zoom)', () => {
  const css = parseCss(readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8'));
  const at = (sel, media) => css.filter((r) => r.media === media && r.selectors.includes(sel)).reduce((o, r) => ({ ...o, ...r.decls }), {});
  const P = '(max-width: 767px)';
  assert.equal(at('.prep .tb-team', P)['overflow-x'], 'auto');
  assert.equal(at('.prep .tb-team', P)['flex-wrap'], 'nowrap');
  assert.equal(at('.prep .tb-setrow', P)['grid-template-columns'], 'minmax(0, 1fr)');
  assert.equal(at('.prep .tb-slidew input[type=range]', P).height, '44px');
  assert.equal(at('.prep .tb-fields input', P)['font-size'], '16px');
  assert.equal(at('.dtabs', P)['flex-wrap'], 'wrap');
});

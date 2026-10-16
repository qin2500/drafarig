// The calc workbench (public/prep-workbench.js) on the stub DOM: reached from the teambuilder's strip values, a mark's
// tap-through, the "no OHKO" chip and the compare diff; it reproduces the Rotom-Fan and Mega Charizard Y goldens; edits
// write nothing; × / Esc close it; Apply writes the draft only; Save as calc files it under that opponent's Calcs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bootApp, parseHtml, parseCss, findAll, RAW } from './ui-harness.mjs';
import { device, WS, NOW, T, btns, flushSaves } from './prep-helpers.mjs';
import { KEYS, wsKey } from '../lib/prep-schema.mjs';
import { newLineage } from '../lib/prep-model.mjs';

const ready = (app) => app.waitFor(() => /tb-srow/.test(app.html()) && !/Calculating…/.test(app.html()), 'the teambuilder with its marks', 30000);
const textOf = (n) => (n.text ?? '') + (n.children ?? []).map(textOf).join('');
const sheet = (app) => { const n = findAll(parseHtml(app.html()), (x) => (x.attrs.class ?? '').split(' ').includes('wb'))[0]; return n ? textOf(n).replace(/\s+/g, ' ') : ''; };
const FAN = 'set_ffffffffffff';

function fanDevice() {
  const rap = newLineage({ id: 'set_rrrrrrrrrrrr', side: 'theirs', coach: 'Calvin', speciesId: 'staraptor', name: 'Ladder top', now: NOW,
    data: { item: 'staraptite', ability: 'intimidate', nature: 'jolly', moves: ['closecombat', 'bravebird', 'protect', 'tailwind'], sp: { hp: 29, atk: 1, def: 0, spa: 0, spd: 4, spe: 32 } },
    provenance: { item: { source: 'ladder', asOf: '2026-10-01' }, ability: null, nature: { source: 'ladder', asOf: '2026-10-01' }, moves: [null, null, null, null], sp: { source: 'ladder', asOf: '2026-10-01' } } });
  const fan = newLineage({ id: FAN, side: 'mine', speciesId: 'rotomfan', name: 'Fan', now: NOW,
    data: { item: '', ability: 'levitate', nature: 'modest', moves: ['thunderbolt', 'airslash', 'voltswitch', 'protect'], sp: { hp: 2, atk: 0, def: 0, spa: 32, spd: 0, spe: 32 } } });
  return device({ coach: 'Calvin', mySets: [fan], ws: { roster: { fetchedAt: NOW, speciesIds: ['staraptor'], points: {} }, theirSets: [rap], my6: [{ setId: FAN }],
    variants: [{ id: 'var_aaaaaaaaaaaa', role: 'likely', name: '', setIds: { staraptor: 'set_rrrrrrrrrrrr' }, whyBuilt: '', planId: null, updatedAt: NOW }] } });
}
const fanRaw = { ...RAW, draftsCsv: RAW.draftsCsv.replace('Kangaskhan', 'Rotom-fan') };

test('Rotom-Fan: a strip value opens the workbench at that calc (reference 152–182 of 189); edits write nothing; × and Esc close', async (t) => {
  const storage = fanDevice();
  const app = await bootApp({ mode: `prep/w/${WS}/sets/${FAN}`, storage, raw: fanRaw });
  t.after(() => app.restore());
  await ready(app);
  await app.click({ pa: 'tb-focus', set: FAN, i: '0' });
  const cell = btns(app, 'tb-wb').find((b) => b.move === 'thunderbolt' && !b.boost && b.key === 'Calvin|staraptormega');
  assert.ok(cell, 'the strip value is a button into the workbench');
  const before = [...storage.map].filter(([k]) => k.startsWith('drafarig.prep.')).map(([k, v]) => `${k}=${v}`).sort().join('\n');
  await app.click({ pa: 'tb-wb', ...cell });
  await app.waitFor(() => /role="dialog"/.test(app.html()) && /of 189 HP/.test(sheet(app)), 'the workbench with its result');
  assert.match(sheet(app), /Thunderbolt: Rotom-Fan → Calvin's Staraptor-Mega/);
  assert.match(sheet(app), /152–182 of 189 HP/, 'reference: Modest 32, no item, +0');
  // (behind the sheet) the editor's audit fixes: assumption chips + ⓘ, each strip card names its set, next/passed labels,
  // "no sure OHKO" with the best odds, the plain Speed line
  const ed = T(app);
  assert.match(ed, /Lv 50 doubles/); assert.match(ed, /ⓘ All assumptions/);
  assert.match(ed, /Jolly 29\/1\/0\/0\/4\/32 · Staraptite · their saved set/);
  assert.match(app.html(), /class="tb-next small">(next|passed): /);
  assert.match(ed, /no sure OHKO at \+0 even at 32 on/);
  assert.ok(!/tap the move field again/.test(ed));
  // edits recalculate and write nothing
  await app.changeData({ pc: 'wb-field-set', side: 'mine', key: 'item' }, { value: 'lifeorb' });
  assert.ok(!/152–182 of 189 HP/.test(sheet(app)), 'Life Orb changes the numbers');
  await app.changeData({ pc: 'wb-sp', side: 'mine', stat: 'spa' }, { value: '23' });
  await app.click({ pa: 'wb-set', scope: 'field', key: 'weather', value: 'Rain' });
  await app.click({ pa: 'wb-tab', tab: 'field' });
  assert.match(app.html(), /class="wb"[^>]*data-tab="field"/);
  await flushSaves(app);
  const after = [...storage.map].filter(([k]) => k.startsWith('drafarig.prep.')).map(([k, v]) => `${k}=${v}`).sort().join('\n');
  assert.equal(after, before, 'no stored document changed');
  await app.click({ pa: 'wb-close' });
  assert.ok(!/role="dialog"/.test(app.html()), '× closes');
  await app.click({ pa: 'tb-wb', ...cell });
  assert.ok(/role="dialog"/.test(app.html()));
  await app.key('Escape');
  assert.ok(!/role="dialog"/.test(app.html()), 'Esc closes');
  assert.equal(app.location.hash, `#prep/w/${WS}/sets/${FAN}`, 'still on the set');
});

test('Rotom-Fan: the 23 SpA Life Orb mark opens at its values; Apply writes the draft only; Save as calc lands in Calvin\'s Calcs', async (t) => {
  const storage = fanDevice();
  const app = await bootApp({ mode: `prep/w/${WS}/sets/${FAN}`, storage, raw: fanRaw });
  t.after(() => app.restore());
  await ready(app);
  await app.click({ pa: 'tb-tip', set: FAN, stat: 'spa', sp: '23' });
  const open = btns(app, 'tb-wb').find((b) => b.stat === 'spa' && b.sp === '23');
  assert.ok(open, 'the tip has "Open in the workbench"');
  assert.match(T(app), /Open in the workbench/);
  await app.click({ pa: 'tb-wb', ...open });
  await app.waitFor(() => /of 189 HP/.test(sheet(app)), 'the workbench');
  assert.match(app.html(), /id="wb-mine-spa"[^>]*value="23"/, 'SpA at the mark');
  assert.match(app.html(), /<option value="lifeorb" selected>/, 'with the Life Orb the mark needs');
  assert.match(sheet(app), /Rotom-Fan → Calvin's Staraptor-Mega/);
  assert.match(sheet(app), /every roll KOs|guaranteed OHKO|OHKO/i, 'the mark\'s OHKO');
  assert.match(sheet(app), /Apply[^]*Item[^]*SpA|Apply[^]*SpA/, 'Apply names what it changes');
  await app.click({ pa: 'wb-apply' });
  await flushSaves(app);
  const lib = JSON.parse(storage.getItem(KEYS.mysets));
  assert.deepEqual([lib.drafts[FAN].data.item, lib.drafts[FAN].data.sp.spa], ['lifeorb', 23], 'into the draft');
  assert.equal(lib.sets.find((s) => s.id === FAN).currentV, 1, 'no new version');
  assert.match(app.toast.textContent, /draft/i);
  const calcs = () => JSON.parse(storage.getItem(wsKey(WS))).calcs;
  const n = calcs().length;
  await app.click({ pa: 'wb-save-calc' });
  await flushSaves(app);
  assert.equal(calcs().length, n + 1, 'filed under Calvin\'s Calcs');
  const c = calcs().at(-1);
  assert.equal(c.scenario.move.id, 'thunderbolt');
  assert.equal(c.scenario.attacker.set.sp.spa, 23);
  assert.match(sheet(app), /Saved to Calcs vs Calvin|vs Calvin/);
});

test('Mega Charizard Y vs Grimmsnarl (golden G1): the sun / no-sun strip values open the workbench at 115–136 and 76–91 of 202', async (t) => {
  const zard = 'set_zzzzzzzzzzzz';
  const grimm = newLineage({ id: 'set_vvvvvvvvvvvv', side: 'theirs', coach: 'Calvin', speciesId: 'grimmsnarl', name: 'Screens', now: NOW,
    data: { item: 'lightclay', ability: 'prankster', nature: 'careful', moves: ['spiritbreak'], sp: { hp: 32, atk: 0, def: 19, spa: 0, spd: 15, spe: 0 } } });
  const z = newLineage({ id: zard, side: 'mine', speciesId: 'charizard', name: 'Y', now: NOW,
    data: { item: 'charizarditey', ability: 'blaze', nature: 'modest', moves: ['heatwave', 'solarbeam', 'protect', 'weatherball'], sp: { hp: 2, atk: 0, def: 0, spa: 32, spd: 0, spe: 32 } } });
  const storage = device({ coach: 'Calvin', mySets: [z], ws: { roster: { fetchedAt: NOW, speciesIds: ['grimmsnarl'], points: {} }, theirSets: [grimm], my6: [{ setId: zard }],
    variants: [{ id: 'var_aaaaaaaaaaaa', role: 'likely', name: '', setIds: { grimmsnarl: 'set_vvvvvvvvvvvv' }, whyBuilt: '', planId: null, updatedAt: NOW }] } });
  const app = await bootApp({ mode: `prep/w/${WS}/sets/${zard}`, storage });
  t.after(() => app.restore());
  await ready(app);
  await app.click({ pa: 'tb-focus', set: zard, i: '0' });
  const cells = btns(app, 'tb-wb').filter((b) => b.move === 'heatwave' && b.key === 'Calvin|grimmsnarl');
  const sun = cells.find((b) => !b.noweather), dry = cells.find((b) => b.noweather);
  assert.ok(sun && dry, 'sun and no-sun values');
  await app.click({ pa: 'tb-wb', ...sun });
  await app.waitFor(() => /of 202 HP/.test(sheet(app)), 'the workbench');
  assert.match(sheet(app), /Heat Wave: Charizard-Mega-Y → Calvin's Grimmsnarl/);
  assert.match(sheet(app), /115–136 of 202 HP/, 'G1 sun');
  // the field panel's weather: no weather gives the no-sun number
  await app.click({ pa: 'wb-set', scope: 'field', key: 'weather', value: '' });
  assert.match(sheet(app), /76–91 of 202 HP/, 'G1 no sun');
  await app.click({ pa: 'wb-close' });
  await app.click({ pa: 'tb-wb', ...dry });
  assert.match(sheet(app), /76–91 of 202 HP/, 'the no-sun column opens without weather');
});

test('the "no OHKO" chip and the compare diff open the workbench too', async (t) => {
  const storage = fanDevice();
  const app = await bootApp({ mode: `prep/w/${WS}/sets/${FAN}`, storage, raw: fanRaw });
  t.after(() => app.restore());
  await ready(app);
  // Air Slash can't OHKO Mega Staraptor at +0 even at 32 SpA: the chip's target opens at 32
  const chip = btns(app, 'tb-wb').find((b) => b.sp === '32' && b.stat === 'spa');
  assert.ok(chip, 'a no-OHKO target is a button into the workbench');
  await app.click({ pa: 'tb-wb', ...chip });
  assert.match(app.html(), /id="wb-mine-spa"[^>]*value="32"/);
  await app.click({ pa: 'wb-close' });
  // Pin as A, then drop SpA: the lost OHKO is a button into the workbench
  await app.click({ pa: 'tb-pin', set: FAN });
  await app.changeData({ pc: 'sp-value', pi: 'tb-sp-live', set: FAN, stat: 'spa' }, { value: '0' });
  await ready(app);
  const lost = findAll(parseHtml(app.html()), (n) => n.attrs['data-pa'] === 'tb-wb' && /tb-d down/.test(n.attrs.class ?? ''));
  assert.ok(lost.length, 'a lost KO mark in the diff is a button into the workbench');
  const d = Object.fromEntries(Object.entries(lost[0].attrs).filter(([k]) => k.startsWith('data-')).map(([k, v]) => [k.slice(5), v]));
  await app.click(d);
  assert.ok(/role="dialog"/.test(app.html()));
  assert.match(app.html(), /id="wb-mine-spa"[^>]*value="0"/, 'with your current draft');
});

test('phone: the workbench is a full-screen sheet with You / Them / Field tabs and 44px targets', () => {
  const css = parseCss(readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8'));
  const at = (sel, media) => css.filter((r) => r.media === media && r.selectors.includes(sel)).reduce((o, r) => ({ ...o, ...r.decls }), {});
  const P = '(max-width: 767px)';
  assert.equal(at('.wb', P).height, '100dvh');
  assert.equal(at('.wb-tabs', P).display, 'flex');
  assert.equal(at('.wb-tabs', null).display ?? at('.wb-tabs', undefined).display, 'none');
  assert.equal(at('.wb[data-tab="you"] .wb-them', P).display, 'none');
  assert.equal(at('.wb[data-tab="field"] .wb-cols', P).display, 'none');
  assert.equal(at('.wb-tabs button', P)['min-height'], '44px');
  assert.equal(at('.wb select', P)['font-size'], '16px');
  assert.equal(at('.wb-result', null).position ?? at('.wb-result', undefined).position, 'sticky');
  // the editor on a phone (audit #5/#6/#8): slider full width under its stat line, Speed options 2×2, strip cards 2 across
  assert.equal(at('.prep .tb-slidew', P)['grid-column'], '1 / -1');
  assert.equal(at('.prep .tb-spdopts', P)['grid-template-columns'], 'repeat(2, minmax(0, 1fr))');
  assert.equal(at('.prep .tb-hits', P)['grid-template-columns'], 'repeat(2, minmax(0, 1fr))');
  assert.equal(at('.prep .tb-tick', P).height, '44px');
});

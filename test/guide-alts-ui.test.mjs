// Guide alternatives in the UI: chips, selection persisted, Copy / Import follow the selected alternative.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootApp, parseHtml, findAll, memoryStorage } from './ui-harness.mjs';
import { device, T, btns, flushSaves } from './prep-helpers.mjs';
import { KEYS } from '../lib/prep-schema.mjs';
import { registerGuide } from '../lib/guides/index.mjs';

const SINI = 'Sinistcha @ Sitrus Berry\nAbility: Hospitality\nLevel: 50\nEVs: 32 HP / 32 SpD\nCalm Nature\n- Rage Powder\n- Matcha Gotcha\n- Life Dew\n- Protect\n';
const SETS = (nature, second) => `Charizard @ Charizardite Y\nAbility: Blaze\nLevel: 50\nEVs: 2 HP / 32 SpA / 32 Spe\n${nature} Nature\n- Heat Wave\n- Solar Beam\n- Protect\n- Weather Ball\n\n${second ?? 'Kangaskhan @ Kangaskhanite\nAbility: Scrappy\nLevel: 50\nEVs: 32 HP / 32 Atk / 2 Def\nAdamant Nature\n- Fake Out\n- Double-Edge\n- Protect\n- Sucker Punch\n'}`;
const BASE = {
  version: 1, pov: 5, opp: 2, coach: 'Ning', week: 2, written: '2026-10-19',
  rosters: { ours: ['charizard', 'sinistcha', 'pelipper', 'kangaskhan'], theirs: ['rillaboom', 'gholdengo', 'milotic', 'lucario', 'ninetalesalola'] },
  assumptions: ['Fixture guide for tests'], remember: ['Lead Charizard + Kangaskhan.'],
  bring: { six: ['charizard', 'kangaskhan', 'pelipper', 'sinistcha'], bench: [] },
  previews: [{ if: 'Pelipper one', bring4: ['charizard', 'kangaskhan', 'pelipper', 'sinistcha'], lead: ['charizard', 'pelipper'], note: '' }], leads: [], tells: [], lose: [], endgame: [], combos: { theirs: [], ours: [] }, calcs: [], perMon: {},
  sets: SETS('Modest'),
};
const ALT = { ...BASE, mainName: 'Sun six', mainNote: 'Main note.', alternatives: [{ key: 'rain', name: 'Rain six', note: 'Rain note.', sets: SETS('Timid', SINI), bring: { six: ['charizard', 'kangaskhan', 'sinistcha'], bench: [] } }] };

async function boot(t, guide, storage = device(), session = memoryStorage()) {
  t.after(registerGuide(guide));
  const app = await bootApp({ mode: 'prep/5v2', storage, session });
  t.after(() => app.restore());
  await app.waitFor(() => /Import as team|Update from guide/.test(T(app)), 'the guide buttons', 20000);
  return app;
}
const chips = (app) => findAll(parseHtml(app.html()), (n) => n.attrs['data-pa'] === 'guide-alt');
const faces = (app) => findAll(parseHtml(app.html()), (n) => /gd-face/.test(n.attrs.class ?? '')).length;

test('no chips without alternatives', async (t) => {
  const app = await boot(t, BASE);
  assert.equal(chips(app).length, 0);
});

test('chips switch the alternative; Copy and Import follow it; main keeps the old team name; selection persists', async (t) => {
  const storage = device(), session = memoryStorage();
  const app = await boot(t, ALT, storage, session);
  assert.equal(chips(app).length, 2);
  assert.match(T(app), /Main note\./);
  const mainFaces = faces(app);
  await app.click({ pa: 'guide-copy', ...btns(app, 'guide-copy')[0] });
  await app.waitFor(() => app.clipboard.length > 0, 'copied', 5000);
  assert.match(app.clipboard.at(-1), /Modest Nature/);

  await app.click({ pa: 'guide-alt', coach: 'Ning', k: 'rain' });
  await app.waitFor(() => /Rain note\./.test(T(app)), 'alternative note', 5000);
  assert.ok(!/Main note\./.test(T(app)));
  assert.equal(faces(app), mainFaces - 1, 'the six changed');
  assert.match(session.getItem('drafarig.prep.ui'), /"guideAlt":\{"Ning":"rain"\}/, 'selection saved');
  await app.click({ pa: 'guide-copy', ...btns(app, 'guide-copy')[0] });
  await app.waitFor(() => /Timid Nature/.test(app.clipboard.at(-1)), 'copied alternative', 5000);
  await app.click({ pa: 'guide-import', ...btns(app, 'guide-import')[0] });
  await flushSaves(app);
  let names = JSON.parse(storage.getItem(KEYS.teams)).teams.map((x) => x.name);
  assert.ok(names.includes('vs Ning (guide: Rain six)'));
  assert.ok(!names.includes('vs Ning (guide)'));

  // a fresh boot keeps the saved choice; back on main, Import uses the old name
  const b = await boot(t, ALT, storage, session);
  assert.match(T(b), /Rain note\./);
  await b.click({ pa: 'guide-alt', coach: 'Ning', k: 'main' });
  await b.waitFor(() => /Main note\./.test(T(b)), 'main note', 5000);
  await b.click({ pa: 'guide-import', ...btns(b, 'guide-import')[0] });
  await flushSaves(b);
  names = JSON.parse(storage.getItem(KEYS.teams)).teams.map((x) => x.name);
  assert.ok(names.includes('vs Ning (guide)') && names.includes('vs Ning (guide: Rain six)'));
});

test('switching alternative drops a bring-4 that names a mon outside the new six', async (t) => {
  const app = await boot(t, ALT);
  await app.click({ pa: 'guide-preview', i: '0' });
  assert.match(app.html(), /class="brief" data-lens="4"/);
  await app.click({ pa: 'guide-alt', coach: 'Ning', k: 'rain' });
  await app.waitFor(() => /Rain note\./.test(T(app)), 'rain', 5000);
  assert.ok(!/data-lens="4"/.test(app.html()), 'no stale four under the other alternative');
  assert.ok(!btns(app, 'brief-lens').some((b) => b.lens === '4'));
  await app.click({ pa: 'guide-alt', coach: 'Ning', k: 'main' });
  await app.waitFor(() => /Main note\./.test(T(app)), 'main', 5000);
  assert.ok(btns(app, 'guide-preview').length === 1, 'main rows are back');
  await app.click({ pa: 'guide-preview', i: '0' });
  assert.match(app.html(), /class="brief" data-lens="4"/);
});

test('importing two alternatives: two teams with their own sets; an edited set is never overwritten', async (t) => {
  const storage = device(), session = memoryStorage();
  const app = await boot(t, ALT, storage, session);
  await app.click({ pa: 'guide-import', ...btns(app, 'guide-import')[0] });
  await flushSaves(app);
  const read = () => {
    const teams = JSON.parse(storage.getItem(KEYS.teams)).teams, sets = JSON.parse(storage.getItem(KEYS.mysets)).sets;
    const of = (name) => teams.find((x) => x.name === name)?.slots.map((id) => sets.find((s) => s.id === id));
    return { teams, sets, main: of('vs Ning (guide)'), rain: of('vs Ning (guide: Rain six)') };
  };
  let r = read();
  assert.deepEqual(r.main.map((l) => l.speciesId).sort(), ['charizard', 'kangaskhan']);
  const zard = r.main.find((l) => l.speciesId === 'charizard');
  const b = await bootApp({ mode: `prep/teams/${r.teams.find((x) => x.name === 'vs Ning (guide)').id}`, storage, session });
  t.after(() => b.restore());
  await b.waitFor(() => /tm-slot/.test(b.html()), 'the team', 20000);
  await b.changeData({ pc: 'set-field', set: zard.id, field: 'nature' }, { value: 'jolly' });
  await b.click({ pa: 'set-save', set: zard.id }); await flushSaves(b);

  const c = await boot(t, ALT, storage, session);
  await c.click({ pa: 'guide-alt', coach: 'Ning', k: 'rain' });
  await c.waitFor(() => /Rain note\./.test(T(c)), 'rain', 5000);
  await c.click({ pa: 'guide-import', ...btns(c, 'guide-import')[0] });
  await flushSaves(c);
  r = read();
  assert.deepEqual(r.rain.map((l) => l.speciesId).sort(), ['charizard', 'sinistcha']);
  assert.equal(r.rain.find((l) => l.speciesId === 'sinistcha').versions.at(-1).data.item, 'sitrusberry');
  assert.equal(r.sets.find((l) => l.id === zard.id).versions.at(-1).data.nature, 'jolly', 'the edited main set is untouched');
  assert.equal(r.rain.find((l) => l.speciesId === 'charizard').versions.at(-1).data.nature, 'timid', 'rain has its own Charizard');
  assert.deepEqual(r.main.map((l) => l.id), r.teams.find((x) => x.name === 'vs Ning (guide)').slots, 'main team slots unchanged');

  // Update from guide on each team: its own alternative's sets, edits kept
  const d = await boot(t, ALT, storage, session);
  await d.click({ pa: 'guide-update', ...btns(d, 'guide-update')[0] });
  await flushSaves(d);
  r = read();
  assert.equal(r.rain.length, 2);
  assert.equal(r.sets.find((l) => l.id === zard.id).versions.at(-1).data.nature, 'jolly');
  const e = await boot(t, ALT, storage, session);
  await e.click({ pa: 'guide-alt', coach: 'Ning', k: 'main' });
  await e.waitFor(() => /Main note\./.test(T(e)), 'main', 5000);
  await e.click({ pa: 'guide-update', ...btns(e, 'guide-update')[0] });
  await flushSaves(e);
  r = read();
  assert.deepEqual(r.main.map((l) => l.speciesId).sort(), ['charizard', 'kangaskhan'], 'main team did not gain Sinistcha');
  assert.equal(r.sets.find((l) => l.id === zard.id).versions.at(-1).data.nature, 'jolly');
});

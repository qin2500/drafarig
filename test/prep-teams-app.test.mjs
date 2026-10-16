// Teams setup in the app (public/prep.js + lib/prep-teams.mjs) on the stub DOM: the backup first, the migration on load,
// lossless references, idempotence across reloads, an older tab's edit of a 6 adopted, Undo, and the no-space path.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { bootApp, memoryStorage } from './ui-harness.mjs';
import { device, WS, SET_MINE, NOW, T, btns, flushSaves } from './prep-helpers.mjs';
import { KEYS, wsKey, newWorkspace } from '../lib/prep-schema.mjs';
import { readBackup } from '../lib/prep-backup.mjs';
import { newLineage } from '../lib/prep-model.mjs';
import * as TM from '../lib/prep-teams.mjs';

const WS2 = 'ws_bbbbbbbbbbbb', SET_TWO = 'set_pppppppppppp', SET_LOOSE = 'set_llllllllllll';
const get = (s, k) => JSON.parse(s.getItem(k) ?? 'null');
const content = (d) => (d ? JSON.stringify({ ...d, rev: 0, saveId: null, updatedAt: null, changesSinceBackup: 0 }) : null);
/** Anthony vs Ning (Charizard in the 6) and, made later, vs Calvin with Charizard and Pelipper in its 6 and every kind of reference. */
function twoMatchups(extra = {}) {
  const peli = newLineage({ id: SET_TWO, side: 'mine', speciesId: 'pelipper', name: 'Rain', now: NOW, data: { item: 'focussash', ability: 'drizzle', nature: 'modest', moves: ['hurricane'], sp: { hp: 32, atk: 0, def: 0, spa: 32, spd: 2, spe: 0 } } });
  const loose = newLineage({ id: SET_LOOSE, side: 'mine', speciesId: 'sinistcha', name: 'TR', now: NOW, data: { item: '', ability: 'hospitality', nature: 'quiet', moves: ['trickroom'], sp: { hp: 32, atk: 0, def: 32, spa: 2, spd: 0, spe: 0 } } });
  const w2 = { ...newWorkspace({ id: WS2, coach: 'Calvin', roster: { fetchedAt: NOW, speciesIds: ['staraptor'], points: {} }, now: '2026-10-09T00:00:00.000Z', pov: 'Anthony' }),
    my6: [{ setId: SET_MINE }, { setId: SET_TWO }],
    cards: [{ id: 'card_aaaaaaaaaaaa', kind: 'plan', bring4: [SET_MINE, SET_TWO], lead: [SET_MINE], back: [SET_TWO], mega: SET_MINE }],
    mockSets: [{ id: 'mock_aaaaaaaaaaaa', mySets: [{ setId: SET_MINE, v: 1 }], games: [] }],
    matches: [{ id: 'match_aaaaaaaaaaaa', my6: [{ setId: SET_MINE, v: 1 }], games: [] }] };
  return device({ mySets: [peli, loose], extra: { [wsKey(WS2)]: w2 }, ws: { createdAt: '2026-10-04T00:00:00.000Z' }, ...extra });
}
const migrated = (app) => app.waitFor(() => app.storage.getItem(KEYS.teams) !== null, 'the teams setup', 20000);

test('on load: a backup first, then one team per matchup; the later matchup gets its own copy and every reference still resolves the same', async (t) => {
  const storage = twoMatchups();
  const before = Object.fromEntries([...storage.map].filter(([k]) => k.startsWith('drafarig.prep.')));
  const app = await bootApp({ mode: 'prep', storage });
  t.after(() => app.restore());
  await migrated(app);
  await flushSaves(app);
  // the backup: a valid file of exactly what was there
  const b = await readBackup(storage.getItem(TM.PREMIGRATION_KEY), webcrypto.subtle);
  assert.ok(b.ok, JSON.stringify(b));
  for (const k of [KEYS.mysets, wsKey(WS), wsKey(WS2)]) assert.equal(content(b.backup.docs[k]), content(JSON.parse(before[k])), k);
  // teams: Ning (older) keeps Charizard; Calvin's team has its own copy and Pelipper; Sinistcha waits in Imported sets
  const teams = get(storage, KEYS.teams);
  const tN = teams.teams.find((x) => x.id === TM.teamIdForWs(WS)), tC = teams.teams.find((x) => x.id === TM.teamIdForWs(WS2));
  const copy = TM.copyIdFor(tC.id, SET_MINE);
  assert.deepEqual(tN.slots, [SET_MINE]);
  assert.deepEqual(tC.slots, [copy, SET_TWO]);
  assert.deepEqual(teams.teams.find((x) => x.id === TM.HOLDING_ID).slots, [SET_LOOSE]);
  const sets = get(storage, KEYS.mysets).sets;
  assert.deepEqual(sets.find((s) => s.id === copy).versions, sets.find((s) => s.id === SET_MINE).versions, 'identical history');
  const w2 = get(storage, wsKey(WS2));
  assert.deepEqual([w2.teamId, w2.my6.map((m) => m.setId), w2.cards[0].bring4, w2.cards[0].mega, w2.mockSets[0].mySets[0].setId, w2.matches[0].my6[0].setId],
    [tC.id, [copy, SET_TWO], [copy, SET_TWO], copy, copy, copy], "Calvin's references point at Calvin's copy");
  assert.equal(get(storage, wsKey(WS)).teamId, tN.id);
  assert.equal(get(storage, wsKey(WS2)).schemaVersion, 2, 'no new document version: older builds keep working');
  // a reload changes nothing (idempotent)
  const after = [...storage.map].filter(([k]) => k.startsWith('drafarig.prep.')).sort();
  const again = await bootApp({ mode: 'prep', storage });
  await flushSaves(again);
  again.restore();
  assert.deepEqual([...storage.map].filter(([k]) => k.startsWith('drafarig.prep.')).sort(), after);
});

test('a 6 changed by an older tab after the setup is taken into the team on the next load (never lost, never shared)', async (t) => {
  const storage = twoMatchups();
  const app = await bootApp({ mode: 'prep', storage });
  await migrated(app); await flushSaves(app); app.restore();
  // what a v9 tab does: saves the workspace with a new my6 (Sinistcha from Imported sets, and Ning's Charizard)
  const w = get(storage, wsKey(WS2));
  storage.setItem(wsKey(WS2), JSON.stringify({ ...w, rev: w.rev + 1, updatedAt: '2099-01-01T00:00:00.000Z', my6: [...w.my6, { setId: SET_LOOSE }] }));
  const b = await bootApp({ mode: 'prep', storage });
  t.after(() => b.restore());
  await flushSaves(b);
  const teams = get(storage, KEYS.teams);
  const tC = teams.teams.find((x) => x.id === TM.teamIdForWs(WS2));
  assert.ok(tC.slots.includes(SET_LOOSE), 'Sinistcha joined the team');
  assert.ok(!teams.teams.find((x) => x.id === TM.HOLDING_ID)?.slots.includes(SET_LOOSE), 'and left Imported sets');
  const all = teams.teams.flatMap((x) => x.slots);
  assert.equal(new Set(all).size, all.length, 'every set in exactly one team');
});

test('Undo teams setup: shows what goes, then puts every matchup and My sets back exactly as before; no re-setup on reload', async (t) => {
  const storage = twoMatchups();
  const pre = Object.fromEntries([...storage.map].filter(([k]) => k.startsWith('drafarig.prep.')));
  const app = await bootApp({ mode: 'prep/backup', storage });
  t.after(() => app.restore());
  await migrated(app);
  await app.waitFor(() => /Undo teams setup/.test(T(app)), 'the Teams section');
  await app.click({ pa: 'teams-undo' });
  assert.match(T(app), /the 1 copy made for them is removed/);
  await app.click({ pa: 'teams-undo-confirm' });
  await flushSaves(app);
  assert.equal(storage.getItem(KEYS.teams), null);
  for (const k of [KEYS.mysets, wsKey(WS), wsKey(WS2)]) assert.equal(content(get(storage, k)), content(JSON.parse(pre[k])), `${k} back to before`);
  assert.equal(get(storage, KEYS.meta).teamsUndone, true);
  const again = await bootApp({ mode: 'prep/backup', storage });
  await flushSaves(again);
  assert.equal(storage.getItem(KEYS.teams), null, 'not set up again on its own');
  assert.match(T(again), /Set up teams again/);
  again.restore();
});

test('no room for the backup: nothing moves; the banner downloads one, then teams are set up', async (t) => {
  const base = twoMatchups();
  const used = [...base.map].reduce((n, [k, v]) => n + k.length + v.length, 0);
  let room = used + 4000; // enough for the setup's own documents, not for a full backup beside them
  const storage = memoryStorage(Object.fromEntries(base.map), { quota: () => room });
  const app = await bootApp({ mode: 'prep', storage });
  t.after(() => app.restore());
  await app.waitFor(() => /isn't room on this device to keep a backup/.test(T(app)), 'the banner', 20000);
  assert.equal(storage.getItem(KEYS.teams), null, 'nothing moved');
  assert.equal(storage.getItem(TM.PREMIGRATION_KEY), null);
  await app.click({ pa: 'teams-backup' });
  await migrated(app);
  assert.equal(app.downloads.length, 1, 'a backup file was downloaded first');
  assert.equal(get(storage, KEYS.teams).migration.backupKey, null);
  room = Infinity;
});

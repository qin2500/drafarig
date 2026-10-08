// The published v4 (commit 3591a02) and this version on one device. v4 is materialised from git into a temp folder and run
// for real: its store against a workspace whose plan cards hold species picks (version 3), its whole app booted on that
// storage, and this Prep loaded lazily inside v4's page. The rule under test: v4 never edits set-based card fields that
// disagree with the species picks. It turns its Prep read-only instead, and nothing is lost.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { bootApp } from './ui-harness.mjs';
import { T, flushSaves, device, WS, SET_MINE, NOW } from './prep-helpers.mjs';
import { wsKey, KEYS } from '../lib/prep-schema.mjs';

const V4 = '3591a02aeea08ea7dff99833efca64bff13dfe0b';
const REPO = fileURLToPath(new URL('../', import.meta.url));
let V4_ROOT = null, V4_WHY = '';
try {
  const dir = mkdtempSync(join(tmpdir(), 'drafarig-v4-'));
  writeFileSync(join(dir, 'v4.tar'), execFileSync('git', ['-C', REPO, 'archive', '--format=tar', V4, 'public', 'lib'], { maxBuffer: 64 << 20 }));
  execFileSync('tar', ['-xf', join(dir, 'v4.tar'), '-C', dir]);
  V4_ROOT = pathToFileURL(`${dir}/`);
} catch (e) { V4_WHY = `the published v4 (${V4}) isn't available from git here: ${String(e.message).split('\n')[0]}`; }
const v4 = (t) => { if (!V4_ROOT) { t.skip(V4_WHY); return false; } return true; };
const v4Import = (p) => import(new URL(p, V4_ROOT).href);
const snapshot = (s) => JSON.stringify([...s.map].filter(([k]) => k.startsWith('drafarig.prep.') && !k.startsWith('drafarig.prep.hint.')).sort());

/** Anthony's prep vs Ning with a board card (species picks; Charizard's set attached), as this version saves it. */
function boardDevice() {
  const plan = { id: 'plan_aaaaaaaaaaaa', label: 'Their sun', kind: 'likely', members: ['gholdengo'], megaUser: null, speedMode: 'none', field: '', needs: '', basis: [], falsifiers: { atPreview: [], inGame: [] }, updatedAt: NOW };
  const card = { id: 'card_aaaaaaaaaaaa', kind: 'plan', vsPlanIds: [plan.id], bring4: [SET_MINE], lead: [SET_MINE], back: [], mega: null, turn1Intent: '', winCondition: '', ifThen: [], infoPlan: [], updatedAt: NOW,
    species: { bring4: ['charizard', 'sinistcha', 'pelipper', 'kangaskhan'], lead: ['charizard', 'sinistcha'], mega: '', megaForm: '' } };
  return device({ ws: { plans: [plan], cards: [card] } });
}

test('this version saves a workspace with board picks as version 3; the v4 store reads it as newer and refuses to write it', async (t) => {
  if (!v4(t)) return;
  const storage = boardDevice();
  const key = wsKey(WS), before = storage.getItem(key);
  assert.equal(JSON.parse(before).schemaVersion, 3);
  const { createStore } = await v4Import('lib/prep-store.mjs');
  const old = createStore(storage);
  const r = old.load(key);
  assert.equal(r.status, 'newer');
  assert.deepEqual([old.save(key, { ...r.doc, cards: [] }, r.doc.rev).code, old.save(key, { ...r.doc, cards: [] }, null).code], ['newer', 'newer']);
  assert.equal(storage.getItem(key), before, 'byte-identical after v4 tried to write it');
  for (const k of [KEYS.meta, KEYS.rules, KEYS.mysets]) assert.equal(old.load(k).status, 'ok', k);
});

test('a v4 app booted on that device is read-only: it says so, and no tap changes a stored document', async (t) => {
  if (!v4(t)) return;
  const C4 = await v4Import('public/prep-copy.js');
  const storage = boardDevice();
  const before = snapshot(storage);
  const app = await bootApp({ root: V4_ROOT, mode: `prep/w/${WS}/plan`, storage });
  t.after(() => app.restore());
  assert.ok(T(app).includes(C4.SAVE.newer), 'the read-only banner');
  await app.click({ pa: 'card-new', kind: 'plan' });
  await app.click({ pa: 'ws-next' });
  await app.input('ws-premortem', 'v4 typing');
  await app.click({ pa: 'plans-suggest' });
  await flushSaves(app);
  assert.equal(snapshot(storage), before, 'no document changed');
});

test('this Prep loaded inside v4\'s page (a tab opened before the update) shows "Reload" and writes nothing', async (t) => {
  if (!v4(t)) return;
  const storage = device();
  const before = [...storage.map].sort();
  const app = await bootApp({ source: readFileSync(new URL('public/app.js', V4_ROOT), 'utf8'), mode: 'prep', storage });
  t.after(() => app.restore());
  assert.match(T(app), /Drafarig was updated while this page was open\. Reload the page/);
  await app.click({ pa: 'go-opp', opp: '2' });
  await app.click({ pa: 'pb-pick', species: 'charizard' });
  await flushSaves(app);
  assert.deepEqual([...storage.map].sort(), before);
});

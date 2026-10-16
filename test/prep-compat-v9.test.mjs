// The live v9 (commit 67e226c) and this version on one device, after this version set up teams. v9 is materialised from
// git into a temp folder and run for real. Teams add no document version, so v9 keeps working (nothing turns read-only);
// what v9 changes in a matchup's 6 is taken into the team on this version's next load; and the backup kept before the
// setup restores in v9 to exactly the pre-teams state.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { webcrypto } from 'node:crypto';
import { bootApp } from './ui-harness.mjs';
import { device, WS, SET_MINE, NOW, T, flushSaves } from './prep-helpers.mjs';
import { KEYS, wsKey } from '../lib/prep-schema.mjs';
import { newLineage } from '../lib/prep-model.mjs';
import * as TM from '../lib/prep-teams.mjs';

const V9 = '67e226c';
const REPO = fileURLToPath(new URL('../', import.meta.url));
let V9_ROOT = null, V9_WHY = '';
try {
  const dir = mkdtempSync(join(tmpdir(), 'drafarig-v9-'));
  writeFileSync(join(dir, 'v9.tar'), execFileSync('git', ['-C', REPO, 'archive', '--format=tar', V9, 'public', 'lib', 'data'], { maxBuffer: 256 << 20 }));
  execFileSync('tar', ['-xf', join(dir, 'v9.tar'), '-C', dir]);
  V9_ROOT = pathToFileURL(`${dir}/`);
} catch (e) { V9_WHY = `v9 (${V9}) isn't available from git here: ${String(e.message).split('\n')[0]}`; }
const v9 = (t) => { if (!V9_ROOT) { t.skip(V9_WHY); return false; } return true; };
const v9Import = (p) => import(new URL(p, V9_ROOT).href);
const get = (s, k) => JSON.parse(s.getItem(k) ?? 'null');
const content = (d) => (d ? JSON.stringify({ ...d, rev: 0, saveId: null, updatedAt: null, changesSinceBackup: 0 }) : null);
const SET_LOOSE = 'set_llllllllllll';
const deviceWithLoose = () => device({ mySets: [newLineage({ id: SET_LOOSE, side: 'mine', speciesId: 'sinistcha', name: 'TR', now: NOW, data: { item: '', ability: 'hospitality', nature: 'quiet', moves: ['trickroom'], sp: { hp: 32, atk: 0, def: 32, spa: 2, spd: 0, spe: 0 } } })] });
async function setUp(storage) {
  const app = await bootApp({ mode: 'prep', storage });
  await app.waitFor(() => storage.getItem(KEYS.teams) !== null, 'the teams setup', 20000);
  await flushSaves(app);
  app.restore();
}

test('after the teams setup, v9\'s store still reads and writes every document it knows (nothing is "newer" to it)', async (t) => {
  if (!v9(t)) return;
  const storage = deviceWithLoose();
  await setUp(storage);
  const { createStore } = await v9Import('lib/prep-store.mjs');
  const old = createStore(storage);
  for (const k of [KEYS.meta, KEYS.rules, KEYS.mysets, wsKey(WS)]) assert.equal(old.load(k).status, 'ok', k);
  const w = old.load(wsKey(WS)).doc;
  assert.equal(w.teamId, TM.teamIdForWs(WS), 'v9 keeps the field it does not know');
  const saved = old.save(wsKey(WS), { ...w, notes: 'v9 note' }, w.rev);
  assert.ok(saved.ok, JSON.stringify(saved));
  assert.equal(get(storage, wsKey(WS)).teamId, TM.teamIdForWs(WS), 'and writes it back');
});

test('a v9 app on that device is not read-only; a 6 it changes is taken into the team on this version\'s next load', async (t) => {
  if (!v9(t)) return;
  const storage = deviceWithLoose();
  await setUp(storage);
  const old = await bootApp({ root: V9_ROOT, mode: `prep/w/${WS}/sets`, storage });
  const C9 = await v9Import('public/prep-copy.js');
  assert.ok(!T(old).includes(C9.SAVE.newer), 'no read-only banner');
  assert.match(T(old), /Your sets for this match/, 'v9 shows its Sets tab');
  await old.click({ pa: 'toggle-six', set: SET_LOOSE });
  await flushSaves(old);
  old.restore();
  assert.deepEqual(get(storage, wsKey(WS)).my6.map((m) => m.setId), [SET_MINE, SET_LOOSE], 'v9 saved its edit');
  const app = await bootApp({ mode: 'prep', storage });
  t.after(() => app.restore());
  await flushSaves(app);
  const teams = get(storage, KEYS.teams);
  assert.deepEqual(teams.teams.find((x) => x.id === TM.teamIdForWs(WS)).slots, [SET_MINE, SET_LOOSE]);
  assert.ok(!teams.teams.find((x) => x.id === TM.HOLDING_ID)?.slots.includes(SET_LOOSE));
});

test('rollback: the backup kept before the setup restores in v9 ("Replace everything") to exactly the pre-teams documents', async (t) => {
  if (!v9(t)) return;
  const storage = deviceWithLoose();
  const pre = Object.fromEntries([...storage.map].filter(([k]) => k.startsWith('drafarig.prep.')));
  await setUp(storage);
  const { readBackup, planRestore } = await v9Import('lib/prep-backup.mjs');
  const { createStore } = await v9Import('lib/prep-store.mjs');
  const b = await readBackup(storage.getItem(TM.PREMIGRATION_KEY), webcrypto.subtle);
  assert.ok(b.ok, `v9 reads the pre-teams backup: ${JSON.stringify(b)}`);
  const old = createStore(storage);
  const current = Object.fromEntries(old.keys().map((k) => [k, old.load(k).doc]).filter(([, d]) => d));
  const plan = planRestore(current, b.backup, 'replace', { now: NOW });
  for (const k of plan.removes) old.remove(k);
  for (const [k, d] of Object.entries(plan.writes)) { const cur = old.load(k); const r = old.save(k, d, cur.status === 'ok' ? cur.doc.rev : null); assert.ok(r.ok, `${k}: ${JSON.stringify(r)}`); }
  for (const k of [KEYS.mysets, wsKey(WS)]) assert.equal(content(get(storage, k)), content(JSON.parse(pre[k])), k);
});

// Old and new clients on one device. The published v3 (commit 41c8112) is materialised from git into a temp folder and run
// for real: its store against documents this version wrote, and its whole app (stub DOM) booted on that storage, both on
// its own and as an already-open tab that sees this version's writes arrive. The rule under test: v3 never edits or
// re-attributes a perspective's workspace (version 2); it turns its Prep read-only instead, and nothing is lost. Also: this
// Prep refuses to run inside an older app shell (a v3 page that loads it lazily) and writes nothing there.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { webcrypto } from 'node:crypto';
import { bootApp, memoryStorage } from './ui-harness.mjs';
import { T, btns, flushSaves, device, WS, NOW } from './prep-helpers.mjs';
import { createStore } from '../lib/prep-store.mjs';
import { KEYS, wsKey, newWorkspace, emptyMeta } from '../lib/prep-schema.mjs';
import { makeBackup } from '../lib/prep-backup.mjs';

const V3 = '41c811241de9172a6957b65a1edc6e6d6a21ecbd';
const REPO = fileURLToPath(new URL('../', import.meta.url));
let V3_ROOT = null, V3_WHY = '';
try {
  const dir = mkdtempSync(join(tmpdir(), 'drafarig-v3-'));
  const tar = execFileSync('git', ['-C', REPO, 'archive', '--format=tar', V3, 'public', 'lib'], { maxBuffer: 64 << 20 });
  writeFileSync(join(dir, 'v3.tar'), tar);
  execFileSync('tar', ['-xf', join(dir, 'v3.tar'), '-C', dir]);
  V3_ROOT = pathToFileURL(`${dir}/`);
} catch (e) { V3_WHY = `the published v3 (${V3}) isn't available from git here: ${String(e.message).split('\n')[0]}`; }
const v3 = (t) => { if (!V3_ROOT) { t.skip(V3_WHY); return false; } return true; };
const v3Import = (p) => import(new URL(p, V3_ROOT).href);
const v3Copy = async () => (await v3Import('public/prep-copy.js'));
const snapshot = (s) => JSON.stringify([...s.map].filter(([k]) => k.startsWith('drafarig.prep.') && !k.startsWith('drafarig.prep.hint.')).sort());
const subtle = webcrypto.subtle;

/** A device as this version leaves it: Anthony's legacy workspace vs Ning (unassigned) plus Anthony's prep vs Jacky (pov). */
function mixedDevice() {
  const storage = device({ legacy: true });
  const st = createStore(storage);
  const w = newWorkspace({ id: 'ws_bbbbbbbbbbbb', coach: 'Jacky', roster: { fetchedAt: NOW, speciesIds: ['incineroar', 'golisopod'], points: {} }, now: NOW, pov: 'Anthony' });
  assert.ok(st.save(wsKey(w.id), { ...w, premortem: 'their Torkoal sun' }, null).ok);
  const meta = st.load(KEYS.meta).doc;
  assert.ok(st.save(KEYS.meta, { ...meta, workspaces: [...meta.workspaces, { id: w.id, coach: 'Jacky', pov: 'Anthony', updatedAt: NOW, archived: false }] }, meta.rev).ok);
  return storage;
}

test('the v3 store reads a perspective\'s workspace as "newer" and refuses to write it; everything else stays v3-readable and writable', async (t) => {
  if (!v3(t)) return;
  const { createStore: createV3 } = await v3Import('lib/prep-store.mjs');
  const storage = mixedDevice();
  const old = createV3(storage);
  const pov = wsKey('ws_bbbbbbbbbbbb'), before = storage.getItem(pov);
  assert.equal(JSON.parse(before).schemaVersion, 2);
  const r = old.load(pov);
  assert.equal(r.status, 'newer');
  assert.deepEqual([old.save(pov, { ...r.doc, coach: 'Ning' }, r.doc.rev).code, old.save(pov, { ...r.doc, coach: 'Ning' }, null).code], ['newer', 'newer']);
  assert.equal(storage.getItem(pov), before, 'byte-identical after v3 tried to write it');
  // the legacy workspace, meta, rules and My sets are version 1: v3 keeps working with them, and so does this version after
  for (const k of [wsKey(WS), KEYS.meta, KEYS.rules, KEYS.mysets]) assert.equal(old.load(k).status, 'ok', k);
  const leg = old.load(wsKey(WS));
  assert.ok(old.save(wsKey(WS), { ...leg.doc, premortem: 'edited in v3' }, leg.doc.rev).ok);
  const now = createStore(storage).load(wsKey(WS));
  assert.deepEqual([now.status, now.doc.premortem, now.doc.pov], ['ok', 'edited in v3', undefined]);
  // backups: a file is as new as its newest document, so a backup without perspective workspaces still restores in v3
  const { readBackup: readV3 } = await v3Import('lib/prep-backup.mjs');
  const legacyOnly = await makeBackup({ [wsKey(WS)]: now.doc, [KEYS.meta]: createStore(storage).load(KEYS.meta).doc }, { exportedAt: NOW }, subtle);
  assert.equal(legacyOnly.schemaVersion, 1);
  assert.equal((await readV3(JSON.stringify(legacyOnly), subtle)).ok, true);
  const withPov = await makeBackup({ [pov]: JSON.parse(before) }, { exportedAt: NOW }, subtle);
  assert.equal(withPov.schemaVersion, 2);
  assert.equal((await readV3(JSON.stringify(withPov), subtle)).code, 'newer-schema', 'v3 refuses the file instead of mis-reading it');
});

test('a v3 app booted on this version\'s storage is read-only: its Prep says so, and no tap changes a stored document', async (t) => {
  if (!v3(t)) return;
  const C3 = await v3Copy();
  const storage = mixedDevice();
  const before = snapshot(storage);
  const app = await bootApp({ root: V3_ROOT, mode: 'prep', storage });
  t.after(() => app.restore());
  assert.ok(T(app).includes(C3.SAVE.newer), 'the read-only banner');
  // the perspective's workspace, opened in v3: every edit is refused (the whole Prep is read-only)
  for (const h of ['#prep/w/ws_bbbbbbbbbbbb/plan', `#prep/w/${WS}/plan`]) {
    app.location.hash = h; await app.fire('popstate');
    await app.click({ pa: 'ws-next' });
    await app.input('ws-premortem', 'v3 typing');
    await app.click({ pa: 'plans-suggest' });
    await app.click({ pa: 'confirm-me' });
  }
  app.location.hash = '#prep/backup'; await app.fire('popstate');
  await app.click({ pa: 'delete-all' });
  await flushSaves(app);
  assert.equal(snapshot(storage), before, 'no document changed');
  assert.ok(btns(app, 'backup-download').length > 0, 'a backup can still be downloaded');
});

test('an already-open v3 tab: this version\'s writes make it read-only, and its unsaved edit is never written over a perspective\'s workspace', async (t) => {
  if (!v3(t)) return;
  const C3 = await v3Copy();
  const storage = device({ legacy: true });
  const app = await bootApp({ root: V3_ROOT, mode: `prep/w/${WS}/plan`, storage });
  t.after(() => app.restore());
  assert.ok(!T(app).includes(C3.SAVE.newer));
  // v3 types into the legacy workspace and doesn't save yet
  await app.input('ws-premortem', 'typed in the old tab');
  // meanwhile this version (another tab) assigns that workspace to Anthony after its review: it becomes version 2
  const st = createStore(storage), cur = st.load(wsKey(WS)).doc;
  const res = st.save(wsKey(WS), { ...cur, pov: 'Anthony', povFrom: 'legacy-confirm', povAssignedAt: NOW, premortem: 'from the new tab' }, cur.rev);
  assert.ok(res.ok);
  const written = storage.getItem(wsKey(WS));
  await app.fire('storage', { key: wsKey(WS), newValue: written, oldValue: null });
  await flushSaves(app);
  assert.equal(storage.getItem(wsKey(WS)), written, 'the old tab never wrote over it');
  assert.equal(JSON.parse(written).premortem, 'from the new tab');
  assert.match(T(app), /changed in another tab|newer version/, 'the old tab says why it stops');
  // and once it sees a version-2 document it is read-only for everything
  await app.click({ pa: 'go-home' });
  const snap = snapshot(storage);
  await app.click({ pa: 'open-ws', ws: WS });
  await app.input('ws-premortem', 'more typing');
  await flushSaves(app);
  assert.equal(storage.getItem(wsKey(WS)), written);
  assert.equal(snapshot(storage), snap);
});

test('this Prep inside an older app shell (a v3 page loading it lazily) shows "Reload" and writes nothing', async (t) => {
  if (!v3(t)) return;
  const storage = device({ legacy: true });
  const before = [...storage.map].sort();
  const app = await bootApp({ source: readFileSync(new URL('public/app.js', V3_ROOT), 'utf8'), mode: 'prep', storage });
  t.after(() => app.restore());
  assert.match(T(app), /Drafarig was updated while this page was open\. Reload the page/);
  await app.click({ pa: 'open-coach', coach: 'Ning' });
  await app.click({ pa: 'confirm-me' });
  await flushSaves(app);
  assert.deepEqual([...storage.map].sort(), before);
});

test('a v3 app on a device that only has older prep keeps working exactly as before (no version-2 document, no read-only)', async (t) => {
  if (!v3(t)) return;
  const C3 = await v3Copy();
  const storage = memoryStorage();
  createStore(storage).save(KEYS.meta, emptyMeta(NOW), null);
  const app = await bootApp({ root: V3_ROOT, mode: 'prep', storage });
  t.after(() => app.restore());
  assert.ok(!T(app).includes(C3.SAVE.newer));
  await app.click({ pa: 'open-coach', coach: 'Ning' });
  await flushSaves(app);
  assert.ok([...storage.map.keys()].some((k) => k.startsWith('drafarig.prep.ws.')), 'v3 still saves its own (unassigned) prep');
});

test('E1: a stale v3 tab that missed the storage event archives an assigned workspace; v3 removes it, the recovery copy survives, this version puts it back', async (t) => {
  if (!v3(t)) return;
  const storage = device({ legacy: true });
  const v3app = await bootApp({ root: V3_ROOT, mode: `prep/w/${WS}/plan`, storage });
  t.after(() => v3app.restore());
  // meanwhile this version (another tab) assigns it after its review and keeps working in it; v3 never hears about it
  const st = createStore(storage), cur = st.load(wsKey(WS)).doc;
  const saved = st.save(wsKey(WS), { ...cur, pov: 'Anthony', povFrom: 'legacy-confirm', povAssignedAt: NOW, premortem: 'written in the new version' }, cur.rev);
  assert.ok(saved.ok && !saved.vaultFailed);
  assert.ok(storage.getItem(`drafarig.prep.vault.${WS}`), 'the recovery copy is written with the save');
  // the stale tab archives it (two steps: file, then remove)
  v3app.location.hash = '#prep/backup'; await v3app.fire('popstate');
  await v3app.click({ pa: 'ws-archive', ws: WS });
  await v3app.waitFor(() => /was downloaded\. Check it is in your downloads/.test(T(v3app)), 'v3 archive step 1 (the file)');
  await v3app.click({ pa: 'ws-archive-confirm', ws: WS });
  await flushSaves(v3app);
  assert.equal(storage.getItem(wsKey(WS)), null, 'v3 really removed the document (its check only covers readable version-1 data)');
  assert.ok(v3app.downloads.length >= 1, 'v3 saved its own (older) copy to a file first');
  const vault = JSON.parse(storage.getItem(`drafarig.prep.vault.${WS}`));
  assert.deepEqual([vault.pov, vault.premortem, vault.schemaVersion], ['Anthony', 'written in the new version', 2], 'v3 cannot remove the recovery copy');
  v3app.restore();
  // this version opens: it says what happened and puts it back on one tap
  const app = await bootApp({ mode: 'prep', storage });
  t.after(() => app.restore());
  assert.match(T(app), /An older Drafarig tab removed Anthony's prep vs Ning/);
  await app.click({ pa: 'vault-recover', ws: WS });
  await flushSaves(app);
  const back = JSON.parse(storage.getItem(wsKey(WS)));
  assert.deepEqual([back.pov, back.povFrom, back.premortem, back.schemaVersion, back.theirSets.length], ['Anthony', 'legacy-confirm', 'written in the new version', 2, 1]);
  assert.ok(!/An older Drafarig tab removed/.test(T(app)), 'nothing left to recover');
  assert.ok(JSON.parse(storage.getItem(KEYS.meta)).workspaces.some((w) => w.id === WS), 'listed again');
});

test('E1 (replace): a stale v3 "Replace everything" with an older file swaps in the unassigned copy; the assigned one comes back beside it, nothing overwritten', async (t) => {
  if (!v3(t)) return;
  const storage = device({ legacy: true });
  const st = createStore(storage), cur = st.load(wsKey(WS)).doc;
  assert.ok(st.save(wsKey(WS), { ...cur, pov: 'Anthony', povFrom: 'legacy-confirm', povAssignedAt: NOW, premortem: 'assigned copy' }, cur.rev).ok);
  // what an older tab's restore leaves: the same id, an unassigned version-1 copy (written by v3's own store over a removal)
  const { createStore: createV3 } = await v3Import('lib/prep-store.mjs');
  storage.removeItem(wsKey(WS));
  assert.ok(createV3(storage).save(wsKey(WS), { ...cur, premortem: 'old file copy' }, null).ok);
  const app = await bootApp({ mode: 'prep', storage });
  t.after(() => app.restore());
  assert.match(T(app), /An older Drafarig tab replaced Anthony's prep vs Ning/);
  await app.click({ pa: 'vault-recover', ws: WS });
  await flushSaves(app);
  const all = [...storage.map.keys()].filter((k) => k.startsWith('drafarig.prep.ws.')).map((k) => JSON.parse(storage.getItem(k)));
  assert.deepEqual(all.map((w) => [w.premortem, w.pov ?? null]).sort(), [['assigned copy', 'Anthony'], ['old file copy', null]]);
});

test('recovery copies: only for assigned earlier workspaces; dropped on unassign and on this version\'s own removals; unreadable to v3\'s store', async (t) => {
  const storage = memoryStorage();
  const st = createStore(storage);
  const w = newWorkspace({ id: 'ws_cccccccccccc', coach: 'Ning', roster: { speciesIds: [] }, now: NOW });
  assert.ok(st.save(wsKey(w.id), w, null).ok);
  assert.equal(st.vault.list().length, 0, 'unassigned: no copy');
  const created = newWorkspace({ id: 'ws_dddddddddddd', coach: 'Ning', roster: { speciesIds: [] }, now: NOW, pov: 'Anthony' });
  assert.ok(st.save(wsKey(created.id), created, null).ok);
  assert.equal(st.vault.list().length, 0, 'created as a perspective\'s: no older tab can hold it as version 1, no copy needed');
  const a = st.save(wsKey(w.id), { ...w, pov: 'Anthony', povFrom: 'legacy-confirm', povAssignedAt: NOW }, 1);
  assert.deepEqual(st.vault.list().map((x) => [x.id, x.doc.rev]), [[w.id, a.doc.rev]]);
  const u = st.save(wsKey(w.id), { ...a.doc, pov: undefined, povFrom: undefined }, a.doc.rev);
  assert.ok(u.ok && st.vault.list().length === 0, 'unassigned again: the copy goes');
  const b = st.save(wsKey(w.id), { ...u.doc, pov: 'Anthony', povFrom: 'legacy-confirm' }, u.doc.rev);
  assert.equal(st.vault.list().length, 1);
  assert.ok(st.remove(wsKey(w.id)).ok);
  assert.equal(st.vault.list().length, 0, 'this version\'s own removal (archive, delete) takes the copy too');
  void b;
  if (!V3_ROOT) return;
  const { createStore: createV3 } = await v3Import('lib/prep-store.mjs');
  storage.setItem(`drafarig.prep.vault.${w.id}`, JSON.stringify(b.doc));
  const old = createV3(storage);
  assert.equal(old.remove(`drafarig.prep.vault.${w.id}`).ok, false, 'v3 refuses to remove a key it does not know');
  assert.equal(old.load(`drafarig.prep.vault.${w.id}`).status, 'error');
  assert.ok(storage.getItem(`drafarig.prep.vault.${w.id}`));
});

// ---------- V1: a recovery copy that doesn't fit is never silent; an older copy is offered as older ----------
const usedChars = (s) => [...s.map].reduce((t, [k, v]) => t + k.length + v.length, 0);
/** An earlier workspace vs Ning assigned to Anthony by this version's store (its recovery copy written), with `extra` fields. */
function assignedDevice(extra = {}) {
  const storage = device({ legacy: true });
  const st = createStore(storage), cur = st.load(wsKey(WS)).doc;
  const r = st.save(wsKey(WS), { ...cur, pov: 'Anthony', povFrom: 'legacy-confirm', povAssignedAt: NOW, ...extra }, cur.rev);
  assert.ok(r.ok && !r.vaultFailed);
  return storage;
}
const COPY_WARN = /Couldn't keep a recovery copy of Anthony's prep vs Ning: this device's storage is nearly full/;

test('V1: a later save that fits while its recovery copy does not shows a lasting warning with a backup route; it clears once a copy is written', async (t) => {
  const base = assignedDevice({ notes: 'v1 notes' });
  let room = usedChars(base) + 220; // room for the workspace to grow by ~155 characters once, not for its copy to grow too
  const storage = memoryStorage(Object.fromEntries(base.map), { quota: () => room });
  const app = await bootApp({ mode: `prep/w/${WS}/plan`, storage });
  t.after(() => app.restore());
  assert.ok(!COPY_WARN.test(T(app)), 'no warning while the copy is current');
  const grow = 'x'.repeat(150);
  await app.input('ws-premortem', `edit ${grow}`);
  await flushSaves(app);
  const saved = JSON.parse(storage.getItem(wsKey(WS))), copy = JSON.parse(storage.getItem(`drafarig.prep.vault.${WS}`));
  assert.ok(saved.premortem.startsWith('edit'), 'the prep itself is saved');
  assert.ok(copy.rev < saved.rev && copy.premortem === '', 'its copy is the older one');
  assert.match(T(app), COPY_WARN);
  assert.ok(btns(app, 'backup-download').length && btns(app, 'go-backup').length && btns(app, 'vault-retry').length, 'backup, free-space and retry routes');
  // still there after a reload (worked out from what is stored, not remembered in memory)
  const again = await bootApp({ mode: 'prep', storage });
  assert.match(T(again), COPY_WARN);
  again.restore();
  // space freed: "Try the copy again" writes it and the warning goes
  room = Infinity;
  await app.click({ pa: 'vault-retry', ws: WS });
  await flushSaves(app);
  const copy2 = JSON.parse(storage.getItem(`drafarig.prep.vault.${WS}`));
  assert.deepEqual([copy2.rev, copy2.premortem.startsWith('edit')], [JSON.parse(storage.getItem(wsKey(WS))).rev, true]);
  assert.ok(!COPY_WARN.test(T(app)), 'cleared once a copy is written');
});

test('V1: an ordinary later save also clears the warning once space allows', async (t) => {
  const base = assignedDevice({ notes: 'v1 notes' });
  let room = usedChars(base) + 220;
  const storage = memoryStorage(Object.fromEntries(base.map), { quota: () => room });
  const app = await bootApp({ mode: `prep/w/${WS}/plan`, storage });
  t.after(() => app.restore());
  await app.input('ws-premortem', `edit ${'y'.repeat(150)}`);
  await flushSaves(app);
  assert.match(T(app), COPY_WARN);
  room = Infinity;
  await app.input('ws-premortem', 'short');
  await flushSaves(app);
  assert.ok(!COPY_WARN.test(T(app)));
  assert.equal(JSON.parse(storage.getItem(`drafarig.prep.vault.${WS}`)).premortem, 'short');
});

test('V1: assigning earlier prep when even its first recovery copy does not fit says so (the assignment itself is saved)', async (t) => {
  const seed = device({ legacy: true });
  const st = createStore(seed), cur = st.load(wsKey(WS)).doc;
  assert.ok(st.save(wsKey(WS), { ...cur, notes: 'n'.repeat(20000) }, cur.rev).ok);
  const storage = memoryStorage(Object.fromEntries(seed.map), { quota: usedChars(seed) + 2000 });
  const app = await bootApp({ mode: `prep/w/${WS}/owner`, storage });
  t.after(() => app.restore());
  await app.click({ pa: 'owner-assign', ws: WS, owner: 'Anthony' });
  await flushSaves(app);
  assert.equal(JSON.parse(storage.getItem(wsKey(WS))).pov, 'Anthony');
  assert.equal(storage.getItem(`drafarig.prep.vault.${WS}`), null, 'no copy could be written');
  assert.match(T(app), COPY_WARN);
});

test('V1: the recovery banner gives the copy\'s own saved time and says later changes aren\'t in it; Recover brings back exactly that copy', async (t) => {
  const base = assignedDevice({ notes: 'v1 notes', updatedAt: '2026-10-04T11:30:00.000Z' });
  const storage = memoryStorage(Object.fromEntries(base.map), { quota: usedChars(base) + 400 });
  // a later edit fits but its copy does not; then a stale v3 tab archives the workspace
  const st = createStore(storage), cur = st.load(wsKey(WS)).doc;
  const later = st.save(wsKey(WS), { ...cur, notes: `v2 notes ${'z'.repeat(300)}`, updatedAt: '2026-10-05T09:00:00.000Z' }, cur.rev);
  assert.ok(later.ok && later.vaultFailed);
  storage.removeItem(wsKey(WS));
  const app = await bootApp({ mode: 'prep', storage });
  t.after(() => app.restore());
  const s = T(app);
  assert.match(s, /An older Drafarig tab removed Anthony's prep vs Ning\. A copy saved at 2026-10-04 11:30 UTC was kept on this device\. Changes made after that aren't in it\. If you have a newer backup file, restore that instead\./);
  await app.click({ pa: 'vault-recover', ws: WS });
  await flushSaves(app);
  assert.equal(JSON.parse(storage.getItem(wsKey(WS))).notes, 'v1 notes', 'exactly the copy, as the banner said');
});

// ---------- N3: a self-matchup (only from an edited file) never gets a recovery copy or a recovery loop ----------
test('N3: a self-matchup marked as assigned gets no recovery copy; one already there is neither offered nor deleted', async (t) => {
  const storage = device();
  const st = createStore(storage);
  const self = { ...newWorkspace({ id: 'ws_ffffffffffff', coach: 'Ning', roster: { speciesIds: [] }, now: NOW }), pov: 'Ning', povFrom: 'legacy-confirm', povAssignedAt: NOW };
  assert.ok(st.save(wsKey(self.id), self, null).ok);
  assert.equal(storage.getItem(`drafarig.prep.vault.${self.id}`), null, 'no copy written for it');
  // a copy left by an earlier build or a hand-edited device, plus the workspace gone: nothing is offered, nothing deleted
  storage.setItem(`drafarig.prep.vault.${self.id}`, JSON.stringify({ ...self, schemaVersion: 2, rev: 3 }));
  storage.removeItem(wsKey(self.id));
  const before = storage.getItem(`drafarig.prep.vault.${self.id}`);
  const app = await bootApp({ mode: 'prep', storage });
  t.after(() => app.restore());
  assert.ok(!/An older Drafarig tab/.test(T(app)));
  assert.ok(!btns(app, 'vault-recover').length);
  assert.equal(storage.getItem(`drafarig.prep.vault.${self.id}`), before);
  // saving such a document again (e.g. restored from that file) leaves the leftover copy alone too
  assert.ok(st.save(wsKey(self.id), self, null).ok);
  assert.equal(storage.getItem(`drafarig.prep.vault.${self.id}`), before);
  // and a real assignment still gets its copy (positive control)
  const real = st.load(wsKey(WS)).doc;
  assert.ok(st.save(wsKey(WS), { ...real, povFrom: 'legacy-confirm' }, real.rev).ok);
  assert.ok(storage.getItem(`drafarig.prep.vault.${WS}`));
});

// Device-local prep persistence without a browser: routes, schema validation and migrations, the storage adapter
// (revision conflicts, quota errors, corrupt and newer data), backups (checksum, forbidden keys, newer schema) and the
// restore planner. Synthetic coach names only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { parseRoute, formatRoute, parentRoute, navKind, TABS, WS_KINDS } from '../lib/prep-route.mjs';
import { SCHEMA_VERSION, KEYS, wsKey, newId, validate, migrate, emptyMeta, emptyRules, emptyMySets, newWorkspace, forbiddenKey, typeOfKey } from '../lib/prep-schema.mjs';
import { createStore } from '../lib/prep-store.mjs';
import { makeBackup, readBackup, planRestore, mergeMySets, opponentDocs, summarize } from '../lib/prep-backup.mjs';
import { newLineage, addVersion, setCurrent, currentVersion, pruneVersions, referencedVersions, provenanceAll, weakestSource } from '../lib/prep-model.mjs';

const subtle = webcrypto.subtle;
const NOW = '2026-10-04T12:00:00.000Z';
let ctr = 0;
const rand = (a) => { for (let i = 0; i < a.length; i++) a[i] = (ctr * 7 + i * 13) & 255; ctr++; return a; };
const id = (p) => newId(p, rand);

/** A Storage-like map with an optional quota (in characters). */
export function memoryStorage({ quota = Infinity } = {}) {
  const m = new Map();
  const used = () => [...m].reduce((t, [k, v]) => t + k.length + v.length, 0);
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { const prev = m.get(k); m.set(k, String(v)); if (used() > quota) { if (prev === undefined) m.delete(k); else m.set(k, prev); const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; } },
    removeItem: (k) => m.delete(k),
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
    _map: m,
  };
}

test('routes: every route round-trips; ids are opaque; malformed or unknown hashes fall back to Prep home', () => {
  const ws = id('ws'), set = id('set'), calc = id('calc');
  const hashes = ['#prep', '#prep/rules', '#prep/backup', '#prep/pilot', '#prep/my-sets', `#prep/my-sets/${set}`, '#prep/my-sets/import',
    ...TABS.map((t) => `#prep/w/${ws}/${t}`),
    ...Object.entries(WS_KINDS).map(([k, takesId]) => (takesId ? `#prep/w/${ws}/${k}/${k === 'calcs' ? calc : set}` : `#prep/w/${ws}/${k}`)), `#prep/w/${ws}/calcs/new`];
  for (const h of hashes) assert.equal(formatRoute(parseRoute(h)), h, h);
  for (const bad of ['#prep/w/Jacky/plan', '#prep/w/ws_abc/plan', '#prep/w/ws_ABCDEFGHIJKL/plan', '#prep/nonsense', '#prep/rules/x', `#prep/w/${ws}/calcs/<img>`, '#prep/my-sets/Garchomp']) {
    const r = parseRoute(bad);
    assert.ok(r && (r.view === 'home' || (r.view === 'ws' && r.tab === 'plan') || r.view === 'my-sets'), bad);
    assert.match(formatRoute(r), /^#prep(\/(my-sets|w\/[a-z]+_[a-z2-7]{12}\/plan))?$/);
  }
  assert.equal(parseRoute('#draft'), null);
  assert.equal(parseRoute(''), null);
  for (const h of hashes) assert.match(h, /^#prep(\/[a-z-]+|\/[a-z]+_[a-z2-7]{12}|\/new)*$/, 'hashes carry no names or spaces');
  assert.deepEqual(parentRoute(parseRoute(`#prep/w/${ws}/calcs/${calc}`)), { view: 'ws', wsId: ws, tab: 'calcs' });
  assert.equal(navKind(parseRoute(`#prep/w/${ws}/plan`), parseRoute(`#prep/w/${ws}/sets`)), 'replace', 'tabs are peers');
  assert.equal(navKind(parseRoute('#prep'), parseRoute(`#prep/w/${ws}/plan`)), 'push');
  assert.equal(navKind(parseRoute(`#prep/w/${ws}/calcs`), parseRoute(`#prep/w/${ws}/calcs/new`)), 'push');
});

test('ids: <prefix>_<12 base32>, random source injected; unknown prefixes refused', () => {
  const real = newId('ws');
  assert.match(real, /^ws_[a-z2-7]{12}$/);
  assert.notEqual(newId('ws'), real);
  assert.throws(() => newId('nope'));
});

test('schema: valid empty documents; broken fields rejected; forbidden keys found anywhere; migrations idempotent and keep unknown fields', () => {
  const ws = newWorkspace({ id: id('ws'), coach: 'Coach Alpha', roster: { fetchedAt: NOW, speciesIds: ['garchomp', 'incineroar'], points: { garchomp: 18 } }, now: NOW });
  for (const [t, d] of [['meta', emptyMeta(NOW)], ['rules', emptyRules(NOW)], ['mysets', emptyMySets()], ['ws', ws]]) assert.deepEqual(validate(t, d), [], t);
  assert.deepEqual(emptyRules(NOW).rules.matchLength, { value: 'bo3', source: 'user', setAt: NOW, note: '' });
  assert.equal(emptyRules(NOW).rules.itemClause.value, 'unknown');
  assert.ok(validate('ws', { ...ws, coach: '' }).includes('coach'));
  assert.ok(validate('ws', { ...ws, plans: [{ id: 'x', kind: 'likely', members: [] }] }).some((e) => e.startsWith('plans')));
  assert.ok(validate('rules', { ...emptyRules(NOW), rules: { ...emptyRules(NOW).rules, itemClause: { value: 'maybe', source: 'user' } } }).includes('rules.itemClause'));
  const evil = JSON.parse('{"a":[{"b":{"__proto__":{"x":1}}}]}');
  assert.equal(forbiddenKey(evil), '$.a[0].b.__proto__');
  assert.ok(validate('ws', { ...ws, notes: '', extra: JSON.parse('{"constructor":1}') }).some((e) => e.startsWith('forbidden key')));
  const v0 = { rules: { itemClause: { value: 'on', source: 'user', setAt: NOW } }, futureField: 7 };
  const once = migrate('rules', v0);
  assert.equal(once.doc.schemaVersion, SCHEMA_VERSION);
  assert.equal(once.doc.futureField, 7, 'unknown fields are kept');
  assert.equal(once.doc.rules.itemClause.value, 'on');
  assert.equal(once.doc.rules.disclosure.value, 'unknown');
  const twice = migrate('rules', once.doc);
  assert.deepEqual(twice.doc, once.doc);
  assert.equal(twice.changed, false);
  assert.equal(migrate('ws', { ...ws, schemaVersion: SCHEMA_VERSION + 1 }).newer, true);
  assert.equal(typeOfKey(wsKey(ws.id)), 'ws');
  assert.equal(typeOfKey('drafarig.coach'), null);
});

test('store: loud results for missing, corrupt, newer and conflicting documents; quota errors keep stored data; only drafarig.prep.* keys', () => {
  const storage = memoryStorage();
  storage.setItem('drafarig.coach', '"Coach Alpha"');
  const store = createStore(storage);
  assert.deepEqual(store.load(KEYS.meta), { status: 'missing' });
  const a = store.save(KEYS.meta, emptyMeta(NOW), null);
  assert.equal(a.ok, true);
  assert.equal(a.doc.rev, 1);
  assert.equal(store.load(KEYS.meta).doc.rev, 1);
  // another tab saved in between: the stale save is refused, nothing overwritten
  const b = store.save(KEYS.meta, { ...a.doc, myCoach: 'Coach Beta' }, 1);
  assert.equal(b.ok, true);
  const stale = store.save(KEYS.meta, { ...a.doc, myCoach: 'Coach Gamma' }, 1);
  assert.deepEqual([stale.ok, stale.code], [false, 'conflict']);
  assert.equal(store.load(KEYS.meta).doc.myCoach, 'Coach Beta');
  assert.equal(store.save(KEYS.meta, emptyMeta(NOW), null).code, 'conflict', 'creating over an existing document is a conflict');
  // invalid documents are never written
  assert.equal(store.save(KEYS.meta, { ...b.doc, workspaces: 'x' }, 2).code, 'invalid');
  // corrupt and newer data are reported, never deleted
  storage.setItem(KEYS.rules, '{not json');
  assert.equal(store.load(KEYS.rules).status, 'corrupt');
  assert.equal(storage.getItem(KEYS.rules), '{not json');
  storage.setItem(KEYS.mysets, JSON.stringify({ ...emptyMySets(), schemaVersion: 99, rev: 3 }));
  assert.equal(store.load(KEYS.mysets).status, 'newer');
  assert.equal(store.save(KEYS.mysets, emptyMySets(), 3).code, 'newer', 'never write over a newer schema');
  // quota
  const small = memoryStorage({ quota: 400 });
  const s2 = createStore(small);
  const ok = s2.save(KEYS.meta, emptyMeta(NOW), null);
  assert.equal(ok.ok, true);
  const big = { ...ok.doc, deviceLabel: 'x'.repeat(500) };
  const q = s2.save(KEYS.meta, big, ok.doc.rev);
  assert.deepEqual([q.ok, q.code], [false, 'quota']);
  assert.equal(s2.load(KEYS.meta).doc.deviceLabel, '', 'the previous document survives a failed save');
  assert.deepEqual(store.keys(), [KEYS.meta, KEYS.mysets, KEYS.rules]);
  assert.equal(store.remove('drafarig.coach').ok, false, 'never touches settings keys');
  assert.ok(store.usage() > 0);
});

test('set lineages: immutable versions, revert moves the pointer, pruning keeps referenced versions', () => {
  let l = newLineage({ id: id('set'), side: 'mine', speciesId: 'pelipper', name: 'Rain Tailwind', data: { item: 'damprock', ability: 'drizzle', nature: 'timid', moves: ['hurricane', 'tailwind'], sp: { hp: 32, spe: 32 } }, now: NOW });
  const v1 = currentVersion(l);
  l = addVersion(l, { ...v1.data, sp: { hp: 32, def: 2, spe: 32 } }, { now: NOW, reason: 'edited' });
  assert.equal(l.currentV, 2);
  assert.equal(l.versions[0].data.sp.def, 0, 'v1 unchanged');
  assert.equal(addVersion(l, currentVersion(l).data, { now: NOW }), l, 'saving equal data is a no-op');
  l = setCurrent(l, 1, NOW);
  assert.equal(currentVersion(l).v, 1);
  for (let i = 0; i < 14; i++) l = addVersion(l, { ...v1.data, sp: { hp: 32, spe: 32 - (i % 30) - 1 } }, { now: NOW });
  const pruned = pruneVersions(l, new Set([2]));
  assert.ok(pruned.versions.some((v) => v.v === 2), 'referenced version kept');
  assert.ok(pruned.versions.length <= 11 + 1);
  assert.equal(pruned.currentV, l.currentV);
  const ws = { calcs: [{ refs: { attacker: { setId: l.id, v: 3 } } }], mockSets: [{ mySets: [{ setId: l.id, v: 4 }] }], matches: [], revisions: [] };
  assert.deepEqual([...referencedVersions(ws).get(l.id)].sort(), [3, 4]);
  const prov = provenanceAll({ item: 'choicescarf', ability: 'drought', nature: '', moves: ['eruption'], sp: { spa: 32 } }, 'sheet-open', NOW);
  assert.equal(prov.sp.source, 'my-guess', 'open team sheets never show Stat Points');
  assert.equal(weakestSource({ item: { source: 'seen-vs-me' }, moves: [{ source: 'ladder' }] }, { item: 'x', moves: ['y'], sp: 'unknown' }), 'ladder');
});

test('backup: checksum detects a one-character edit; forbidden keys, wrong marker, newer schema, oversize and stray fields rejected', async () => {
  const ws = newWorkspace({ id: id('ws'), coach: 'Coach Alpha', roster: { fetchedAt: NOW, speciesIds: ['garchomp'] }, now: NOW });
  const docs = { [KEYS.meta]: { ...emptyMeta(NOW), rev: 1 }, [wsKey(ws.id)]: { ...ws, rev: 1 } };
  const b = await makeBackup(docs, { exportedAt: NOW, appBuild: 'test', deviceLabel: 'phone' }, subtle);
  const text = JSON.stringify(b);
  const ok = await readBackup(text, subtle);
  assert.equal(ok.ok, true);
  assert.deepEqual(summarize(ok.backup.docs).coaches, ['Coach Alpha']);
  const edited = text.replace('Coach Alpha', 'Coach Alphb');
  assert.equal((await readBackup(edited, subtle)).code, 'checksum');
  assert.equal((await readBackup(text.slice(0, -10), subtle)).code, 'not-json');
  assert.equal((await readBackup(JSON.stringify({ ...b, format: 'other' }), subtle)).code, 'not-backup');
  assert.equal((await readBackup(JSON.stringify({ ...b, schemaVersion: SCHEMA_VERSION + 1 }), subtle)).code, 'newer-schema');
  assert.equal((await readBackup(JSON.stringify({ ...b, extra: 1 }), subtle)).code, 'unexpected-field');
  assert.equal((await readBackup(text.replace('"docs":{', '"docs":{"__proto__":{},'), subtle)).code, 'forbidden-key');
  assert.equal((await readBackup('x'.repeat(10 * 1024 * 1024 + 1), subtle)).code, 'too-large');
  const badDoc = await makeBackup({ [wsKey(ws.id)]: { ...ws, coach: '' } }, { exportedAt: NOW }, subtle);
  assert.equal((await readBackup(JSON.stringify(badDoc), subtle)).code, 'invalid-doc');
});

test('restore plans: replace removes what the backup lacks; import adds, replaces or keeps both; My sets merge as a version union', async () => {
  const wsA = { ...newWorkspace({ id: id('ws'), coach: 'Coach Alpha', roster: { speciesIds: ['garchomp'] }, now: NOW }), rev: 2 };
  const wsB = { ...newWorkspace({ id: id('ws'), coach: 'Coach Beta', roster: { speciesIds: ['kingambit'] }, now: NOW }), rev: 1 };
  const setId = id('set');
  const lin = newLineage({ id: setId, side: 'mine', speciesId: 'garchomp', name: 'Chomp', data: { item: '', ability: 'roughskin', nature: 'jolly', moves: ['earthquake'], sp: { atk: 32 } }, now: NOW });
  const here = { [wsKey(wsA.id)]: wsA, [KEYS.mysets]: { ...emptyMySets(), sets: [lin] } };
  const lin2 = addVersion(lin, { ...lin.versions[0].data, sp: { atk: 32, spe: 32 } }, { now: '2026-10-05T00:00:00.000Z' });
  const backup = (await readBackup(JSON.stringify(await makeBackup({ [wsKey(wsA.id)]: { ...wsA, notes: 'from laptop' }, [wsKey(wsB.id)]: wsB, [KEYS.mysets]: { ...emptyMySets(), sets: [lin2] } }, { exportedAt: NOW }, subtle)), subtle)).backup;
  const rep = planRestore({ ...here, [KEYS.rules]: emptyRules(NOW) }, backup, 'replace');
  assert.deepEqual(rep.removes, [KEYS.rules]);
  assert.equal(Object.keys(rep.writes).length, 3);
  const imp = planRestore(here, backup, 'import', { newWsId: () => id('ws'), newSetId: () => id('set') });
  assert.ok(imp.notes.some((n) => n.id === wsA.id && n.kind === 'needs-choice'), 'an existing opponent needs an explicit choice');
  assert.ok(imp.writes[wsKey(wsB.id)], 'a new opponent is added');
  const both = planRestore(here, backup, 'import', { choices: { [wsA.id]: 'keep-both' }, newWsId: () => id('ws'), newSetId: () => id('set') });
  const copy = Object.values(both.writes).find((d) => d.coach === 'Coach Alpha');
  assert.ok(copy && copy.id !== wsA.id, 'keep both: a copy with a new id, never an overwrite');
  const merged = both.writes[KEYS.mysets].sets.find((s) => s.id === setId);
  assert.deepEqual(merged.versions.map((v) => v.v), [1, 2]);
  assert.equal(merged.currentV, 2, 'the newer updatedAt decides the current version');
  // clashing version data is never merged into one lineage
  const clash = { ...lin, versions: [{ ...lin.versions[0], data: { ...lin.versions[0].data, nature: 'adamant' } }] };
  const m = mergeMySets({ ...emptyMySets(), sets: [lin] }, { ...emptyMySets(), sets: [clash] }, () => id('set'));
  assert.equal(m.doc.sets.length, 2);
  assert.equal(m.changes[0].kind, 'kept-both');
  const od = opponentDocs({ ...wsA, my6: [{ setId }] }, { sets: [lin, newLineage({ id: id('set'), side: 'mine', speciesId: 'kingambit', name: 'x', data: { ability: 'defiant', nature: 'adamant', moves: ['ironhead'], sp: {} }, now: NOW })] });
  assert.deepEqual(od[KEYS.mysets].sets.map((s) => s.id), [setId], 'archive keeps only the sets that opponent uses');
});

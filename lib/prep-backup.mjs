// Portable backups of device-local prep: a JSON file (or text) the user moves themselves. Pure apart from injected hashing.
// Format: {format:'drafarig-prep-backup', schemaVersion, exportedAt, appBuild, deviceLabel, kind:'full'|'opponent', checksum, docs}
// checksum = SHA-256 of the canonical docs JSON, so a truncated or edited file is detected. Restore never touches current
// data until the user confirms a plan, and "replace everything" first hands back a backup of what is here.
import { SCHEMA_VERSION, BASE_VERSION, KEYS, wsKey, validate, migrate, forbiddenKey, typeOfKey } from './prep-schema.mjs';
import { canonJSON, sha256Hex } from './calc/keys.mjs';

export const FORMAT = 'drafarig-prep-backup';
export const MAX_BACKUP_CHARS = 10 * 1024 * 1024;
const TOP_KEYS = ['format', 'schemaVersion', 'exportedAt', 'appBuild', 'deviceLabel', 'kind', 'checksum', 'docs'];

/** docs: {storageKey: document}. Returns the backup object (call JSON.stringify for the file). */
export async function makeBackup(docs, { exportedAt, appBuild = '', deviceLabel = '', kind = 'full' }, subtle) {
  const clean = Object.fromEntries(Object.keys(docs).sort().map((k) => [k, docs[k]]));
  // The file's version is the newest document in it, so a backup with no perspective workspaces still restores in an older app.
  const version = Math.max(BASE_VERSION, ...Object.values(clean).map((d) => (Number.isInteger(d?.schemaVersion) ? d.schemaVersion : BASE_VERSION)));
  return { format: FORMAT, schemaVersion: version, exportedAt, appBuild, deviceLabel, kind, checksum: await sha256Hex(canonJSON(clean), subtle), docs: clean };
}

/** Workspace + the My sets it references (for archiving or moving one opponent), and the teams it brings when teams are set up. */
export function opponentDocs(ws, mysets, teams = null) {
  const used = new Set((ws.my6 ?? []).map((m) => m.setId));
  for (const c of ws.calcs ?? []) for (const s of ['attacker', 'defender']) if (c.refs?.[s]?.setId) used.add(c.refs[s].setId);
  for (const m of ws.mockSets ?? []) for (const x of m.mySets ?? []) used.add(x.setId);
  for (const c of ws.cards ?? []) for (const id of [...(c.bring4 ?? []), ...(c.lead ?? []), ...(c.back ?? [])]) used.add(id);
  const own = (teams?.teams ?? []).filter((t) => t.kind !== 'holding' && (t.id === ws.teamId || t.origin?.wsId === ws.id));
  for (const t of own) for (const id of t.slots) used.add(id);
  const sets = (mysets?.sets ?? []).filter((s) => used.has(s.id));
  return { [wsKey(ws.id)]: ws, [KEYS.mysets]: { schemaVersion: BASE_VERSION, rev: 0, sets }, ...(own.length ? { [KEYS.teams]: { schemaVersion: BASE_VERSION, rev: 0, teams: own, order: own.map((t) => t.id) } } : {}) };
}

/**
 * Parse and verify a backup text. -> {ok:true, backup, summary} | {ok:false, code}. Codes: too-large, not-json, not-backup,
 * unexpected-field, forbidden-key, newer-schema, checksum, invalid-doc (with key and errors).
 */
export async function readBackup(text, subtle) {
  if (typeof text !== 'string' || text.length > MAX_BACKUP_CHARS) return { ok: false, code: 'too-large' };
  let b;
  try { b = JSON.parse(text); } catch { return { ok: false, code: 'not-json' }; }
  if (!b || typeof b !== 'object' || Array.isArray(b) || b.format !== FORMAT) return { ok: false, code: 'not-backup' };
  const fk = forbiddenKey(b);
  if (fk) return { ok: false, code: 'forbidden-key', path: fk };
  const extra = Object.keys(b).filter((k) => !TOP_KEYS.includes(k));
  if (extra.length) return { ok: false, code: 'unexpected-field', fields: extra };
  if (!Number.isInteger(b.schemaVersion)) return { ok: false, code: 'not-backup' };
  if (b.schemaVersion > SCHEMA_VERSION) return { ok: false, code: 'newer-schema' };
  if (!b.docs || typeof b.docs !== 'object' || Array.isArray(b.docs)) return { ok: false, code: 'not-backup' };
  if (b.checksum !== await sha256Hex(canonJSON(b.docs), subtle)) return { ok: false, code: 'checksum' };
  const docs = {};
  for (const [key, doc] of Object.entries(b.docs)) {
    const type = typeOfKey(key);
    if (!type) return { ok: false, code: 'invalid-doc', key, errors: ['unknown key'] };
    const m = migrate(type, doc);
    if (m.newer) return { ok: false, code: 'newer-schema' };
    const errors = validate(type, m.doc);
    if (errors.length) return { ok: false, code: 'invalid-doc', key, errors };
    if (type === 'ws' && key !== wsKey(m.doc.id)) return { ok: false, code: 'invalid-doc', key, errors: ['key does not match id'] };
    docs[key] = m.doc;
  }
  return { ok: true, backup: { ...b, docs }, summary: summarize(docs) };
}

export function summarize(docs) {
  const ws = Object.entries(docs).filter(([k]) => typeOfKey(k) === 'ws').map(([, d]) => d);
  const mine = docs[KEYS.mysets]?.sets ?? [];
  return {
    opponents: ws.length, coaches: ws.map((w) => w.coach),
    sets: mine.length + ws.reduce((t, w) => t + w.theirSets.length, 0),
    calcs: ws.reduce((t, w) => t + w.calcs.length, 0),
    mockGames: ws.reduce((t, w) => t + w.mockSets.reduce((g, m) => g + m.games.length, 0), 0),
  };
}

/**
 * Union of two My sets libraries: lineages by id; versions by number (immutable, so equal numbers must be equal data —
 * otherwise the incoming lineage is kept as a copy with a new id from newSetId); currentV follows the newer updatedAt.
 * Returns {doc, changes:[{id, name, kind}]}.
 */
export function mergeMySets(here, incoming, newSetId) {
  const out = structuredClone(here ?? { schemaVersion: BASE_VERSION, rev: 0, sets: [] });
  const changes = [];
  for (const inc of incoming?.sets ?? []) {
    const cur = out.sets.find((s) => s.id === inc.id);
    if (!cur) { out.sets.push(structuredClone(inc)); changes.push({ id: inc.id, name: inc.name, kind: 'added' }); continue; }
    const clash = inc.versions.some((v) => { const h = cur.versions.find((x) => x.v === v.v); return h && canonJSON(h.data) !== canonJSON(v.data); });
    if (clash) {
      const copy = { ...structuredClone(inc), id: newSetId(), name: `${inc.name} (from backup)` };
      out.sets.push(copy); changes.push({ id: copy.id, name: copy.name, kind: 'kept-both' }); continue;
    }
    let added = 0;
    for (const v of inc.versions) if (!cur.versions.some((x) => x.v === v.v)) { cur.versions.push(structuredClone(v)); added++; }
    cur.versions.sort((a, b) => a.v - b.v);
    if ((inc.updatedAt ?? '') > (cur.updatedAt ?? '') && inc.currentV !== cur.currentV) { cur.currentV = inc.currentV; cur.updatedAt = inc.updatedAt; changes.push({ id: cur.id, name: cur.name, kind: 'current-changed' }); }
    else if (added) changes.push({ id: cur.id, name: cur.name, kind: 'versions-added', count: added });
  }
  return { doc: out, changes };
}

/**
 * Plan a restore without writing anything. mode 'replace': the backup's docs replace all prep. mode 'import': per
 * workspace choice ('add' | 'replace' | 'keep-both' | 'skip'); My sets merge as a version union.
 * Returns { writes: {key: doc}, removes: [key], workspacesAfter, notes }.
 */
export function planRestore(current, backup, mode, { choices = {}, newWsId, newSetId, now } = {}) {
  const writes = {}, removes = [], notes = [];
  const curWs = Object.entries(current).filter(([k]) => typeOfKey(k) === 'ws');
  const incWs = Object.entries(backup.docs).filter(([k]) => typeOfKey(k) === 'ws');
  if (mode === 'replace') {
    for (const [k] of Object.entries(current)) if (!(k in backup.docs)) removes.push(k);
    for (const [k, d] of Object.entries(backup.docs)) writes[k] = d;
    return { writes, removes, notes };
  }
  for (const [k, d] of incWs) {
    const exists = curWs.some(([ck]) => ck === k);
    const choice = choices[d.id] ?? (exists ? null : 'add');
    if (!choice || choice === 'skip') { notes.push({ id: d.id, coach: d.coach, kind: choice ? 'skipped' : 'needs-choice' }); continue; }
    if (choice === 'add' || choice === 'replace') { writes[k] = d; notes.push({ id: d.id, coach: d.coach, kind: exists ? 'replaced' : 'added' }); }
    else if (choice === 'keep-both') {
      const id = newWsId();
      writes[wsKey(id)] = { ...structuredClone(d), id, coach: d.coach, createdAt: now ?? d.createdAt, notes: d.notes };
      notes.push({ id, coach: d.coach, kind: 'kept-both' });
    }
  }
  // teams from the file that aren't here are added; ones already here are kept as they are (the app's load-time reconcile
  // then gives every set exactly one team)
  if (backup.docs[KEYS.teams]) {
    const here = structuredClone(current[KEYS.teams] ?? { schemaVersion: BASE_VERSION, rev: 0, teams: [], order: [] });
    for (const t of backup.docs[KEYS.teams].teams ?? []) if (!here.teams.some((x) => x.id === t.id)) { here.teams.push(structuredClone(t)); here.order = [...(here.order ?? []), t.id]; notes.push({ id: t.id, name: t.name, kind: 'team-added', scope: 'teams' }); }
    writes[KEYS.teams] = here;
  }
  if (backup.docs[KEYS.mysets]) {
    const m = mergeMySets(current[KEYS.mysets], backup.docs[KEYS.mysets], newSetId);
    writes[KEYS.mysets] = m.doc;
    for (const c of m.changes) notes.push({ ...c, scope: 'my-sets' });
  }
  return { writes, removes, notes };
}

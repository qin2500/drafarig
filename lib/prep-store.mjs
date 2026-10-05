// Device-local storage adapter for prep (localStorage today; the interface is small so an IndexedDB adapter can replace it).
// One JSON document per key, so every save of one document is atomic. Every save checks the stored `rev` first: if
// another tab changed the document, the save is refused (no silent overwrite). Errors are returned, never swallowed;
// unreadable documents are reported, never deleted. Only keys under drafarig.prep.* are touched.
import { PREFIX, SCHEMA_VERSION, docVersion, validate, migrate, typeOfKey } from './prep-schema.mjs';

export const USAGE_BUDGET_CHARS = 2_500_000; // conservative share of the ~5 MiB origin quota (UTF-16 units)
/**
 * Recovery copies ("vault"): a workspace saved before perspectives and later assigned to a coach is the one kind of
 * document an older Drafarig tab (v3) can still hold in memory as version 1, and v3's Archive / "Replace everything" remove
 * it without seeing it changed. So every save of such a workspace also writes its copy under drafarig.prep.vault.<id>: a key
 * v3's store can't remove (it refuses keys it doesn't know) and never reads. This version offers that copy back if the
 * workspace disappears or is replaced by an unassigned copy, and drops it when this version itself removes the workspace.
 */
export const VAULT_PREFIX = `${PREFIX}vault.`;
const saveId = () => { const a = new Uint32Array(2); globalThis.crypto.getRandomValues(a); return `${a[0].toString(36)}${a[1].toString(36)}`; };

/** storage: a Storage-like object (getItem, setItem, removeItem, key, length). */
export function createStore(storage) {
  const read = (key) => { try { return { ok: true, raw: storage.getItem(key) }; } catch (e) { return { ok: false, error: e }; } };
  /**
   * Keep the recovery copy in step with a saved workspace: written while it is an assigned earlier workspace (a real owner:
   * pov set and not its own opponent), dropped once it is unassigned again. A self-matchup (pov === coach, only possible from
   * an edited file) is nobody's: it gets no copy, and any copy already there is left alone (never deleted silently here).
   */
  const vaultSync = (doc) => {
    const key = VAULT_PREFIX + doc.id;
    const owned = typeof doc.pov === 'string' && doc.pov && doc.pov !== doc.coach;
    try {
      if (doc.povFrom === 'legacy-confirm' && owned) { storage.setItem(key, JSON.stringify(doc)); return true; }
      if (typeof doc.pov === 'string' && doc.pov && !owned) return null;
      if (storage.getItem(key) !== null) storage.removeItem(key);
      return null;
    } catch { return false; }
  };
  return {
    /** -> {status:'ok', doc, migrated} | {status:'missing'} | {status:'corrupt', raw, errors} | {status:'newer', doc} | {status:'error', error} */
    load(key) {
      const type = typeOfKey(key);
      if (!type) return { status: 'error', error: new Error('not a prep key') };
      const r = read(key);
      if (!r.ok) return { status: 'error', error: r.error };
      if (r.raw === null) return { status: 'missing' };
      let doc;
      try { doc = JSON.parse(r.raw); } catch { return { status: 'corrupt', raw: r.raw, errors: ['not valid JSON'] }; }
      let m;
      try { m = migrate(type, doc); } catch (e) { return { status: 'corrupt', raw: r.raw, errors: [String(e.message || e)] }; }
      if (m.newer) return { status: 'newer', doc };
      const errors = validate(type, m.doc);
      if (errors.length) return { status: 'corrupt', raw: r.raw, errors };
      return { status: 'ok', doc: m.doc, migrated: m.changed };
    },
    /**
     * Save with an optimistic revision check. expectedRev = the rev the caller loaded (null for a new document).
     * -> {ok:true, doc} (doc.rev incremented) | {ok:false, code:'conflict'|'quota'|'invalid'|'newer'|'error', error?}
     */
    save(key, doc, expectedRev) {
      const type = typeOfKey(key);
      if (!type) return { ok: false, code: 'error', error: new Error('not a prep key') };
      const cur = read(key);
      if (!cur.ok) return { ok: false, code: 'error', error: cur.error };
      if (cur.raw !== null) {
        let stored;
        try { stored = JSON.parse(cur.raw); } catch { stored = null; }
        if (stored && Number.isInteger(stored.schemaVersion) && stored.schemaVersion > SCHEMA_VERSION) return { ok: false, code: 'newer' };
        const storedRev = stored && Number.isInteger(stored.rev) ? stored.rev : null;
        if (expectedRev === null || expectedRev === undefined) { if (stored) return { ok: false, code: 'conflict' }; }
        else if (storedRev !== expectedRev) return { ok: false, code: 'conflict' };
      } else if (expectedRev !== null && expectedRev !== undefined && expectedRev !== 0) {
        return { ok: false, code: 'conflict' }; // it was deleted elsewhere
      }
      // saveId tells this tab's own writes from another tab's write of the same revision (browsers can let two tabs
      // both write revision n+1 before either sees the other's storage event).
      // Each document keeps the lowest version that holds it (docVersion): a perspective's workspace is version 2, so an
      // older app can't write over it; everything else stays readable and writable by older apps.
      const next = { ...doc, schemaVersion: docVersion(type, doc), rev: (Number.isInteger(expectedRev) ? expectedRev : 0) + 1, saveId: saveId() };
      const errors = validate(type, next);
      if (errors.length) return { ok: false, code: 'invalid', errors };
      try { storage.setItem(key, JSON.stringify(next)); } catch (e) {
        const quota = e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014);
        return { ok: false, code: quota ? 'quota' : 'error', error: e };
      }
      const vaulted = type === 'ws' ? vaultSync(next) : null;
      return { ok: true, doc: next, ...(vaulted === false ? { vaultFailed: true } : {}) };
    },
    /** Remove a document (this version's own deliberate removal: its recovery copy goes too). */
    remove(key) {
      const type = typeOfKey(key);
      if (!type) return { ok: false, code: 'error' };
      try { storage.removeItem(key); } catch (e) { return { ok: false, code: 'error', error: e }; }
      if (type === 'ws') try { storage.removeItem(VAULT_PREFIX + key.slice(`${PREFIX}ws.`.length)); } catch { /* best effort */ }
      return { ok: true };
    },
    vault: {
      /** Recovery copies: [{id, doc}] (unreadable ones are skipped, never deleted here). */
      list() {
        const out = [];
        try {
          for (let i = 0; i < storage.length; i++) {
            const k = storage.key(i);
            if (!k?.startsWith(VAULT_PREFIX)) continue;
            try { const doc = JSON.parse(storage.getItem(k)); if (doc && typeof doc === 'object' && doc.id === k.slice(VAULT_PREFIX.length)) out.push({ id: doc.id, doc }); } catch { /* unreadable */ }
          }
        } catch { /* storage unavailable */ }
        return out.sort((a, b) => a.id.localeCompare(b.id));
      },
      get(id) { try { const raw = storage.getItem(VAULT_PREFIX + id); return raw === null ? null : JSON.parse(raw); } catch { return null; } },
      remove(id) { try { storage.removeItem(VAULT_PREFIX + id); return true; } catch { return false; } },
      clear() { for (const { id } of this.list()) this.remove(id); },
    },
    /** All prep keys present (sorted). */
    keys() {
      const out = [];
      try { for (let i = 0; i < storage.length; i++) { const k = storage.key(i); if (k && k.startsWith(PREFIX)) out.push(k); } } catch { /* storage unavailable */ }
      return out.sort();
    },
    /** Approximate characters used by prep (key + value lengths). */
    usage() {
      let n = 0;
      for (const k of this.keys()) { const r = read(k); if (r.ok && r.raw) n += k.length + r.raw.length; }
      return n;
    },
    raw(key) { const r = read(key); return r.ok ? r.raw : null; },
    /** Put back exactly what was stored before (undo of a restore); only drafarig.prep.* keys. */
    writeRaw(key, raw) {
      if (!isPrepKey(key)) return { ok: false, code: 'error' };
      try { storage.setItem(key, raw); return { ok: true }; } catch (e) { return { ok: false, code: 'error', error: e }; }
    },
    /**
     * Small per-device hints that aren't prep documents (the last screen, for "Continue"). Last writer wins: they are
     * never revision-checked, so two tabs navigating can't conflict. Only drafarig.prep.hint.<name>, at most 200 chars.
     */
    hint(name, value) {
      const key = `${PREFIX}hint.${name}`;
      if (value === undefined) {
        const r = read(key);
        try { const v = r.ok && r.raw !== null ? JSON.parse(r.raw) : null; return typeof v === 'string' ? v.slice(0, 200) : null; } catch { return null; }
      }
      try { if (value === null) storage.removeItem(key); else storage.setItem(key, JSON.stringify(String(value).slice(0, 200))); return true; } catch { return false; }
    },
  };
}

export const isPrepKey = (k) => typeof k === 'string' && k.startsWith(PREFIX);

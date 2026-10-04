// Device-local storage adapter for prep (localStorage today; the interface is small so an IndexedDB adapter can replace it).
// One JSON document per key, so every save of one document is atomic. Every save checks the stored `rev` first: if
// another tab changed the document, the save is refused (no silent overwrite). Errors are returned, never swallowed;
// unreadable documents are reported, never deleted. Only keys under drafarig.prep.* are touched.
import { PREFIX, SCHEMA_VERSION, validate, migrate, typeOfKey } from './prep-schema.mjs';

export const USAGE_BUDGET_CHARS = 2_500_000; // conservative share of the ~5 MiB origin quota (UTF-16 units)
const saveId = () => { const a = new Uint32Array(2); globalThis.crypto.getRandomValues(a); return `${a[0].toString(36)}${a[1].toString(36)}`; };

/** storage: a Storage-like object (getItem, setItem, removeItem, key, length). */
export function createStore(storage) {
  const read = (key) => { try { return { ok: true, raw: storage.getItem(key) }; } catch (e) { return { ok: false, error: e }; } };
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
      const next = { ...doc, schemaVersion: SCHEMA_VERSION, rev: (Number.isInteger(expectedRev) ? expectedRev : 0) + 1, saveId: saveId() };
      const errors = validate(type, next);
      if (errors.length) return { ok: false, code: 'invalid', errors };
      try { storage.setItem(key, JSON.stringify(next)); } catch (e) {
        const quota = e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014);
        return { ok: false, code: quota ? 'quota' : 'error', error: e };
      }
      return { ok: true, doc: next };
    },
    remove(key) {
      if (!typeOfKey(key)) return { ok: false, code: 'error' };
      try { storage.removeItem(key); return { ok: true }; } catch (e) { return { ok: false, code: 'error', error: e }; }
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

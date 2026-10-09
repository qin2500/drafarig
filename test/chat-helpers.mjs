// Test-only fixtures for chat: an R2 bucket that honours conditional writes as Cloudflare documents them (`onlyIf` with a
// Headers object carrying `If-None-Match: *` / `If-Match`, or an R2Conditional; put() returns null when a precondition
// fails; quoted etags in an R2Conditional throw), env builders and request helpers. Nothing here talks to a network or a
// model: the "relay" in tests uses a stub provider.
import { webcrypto } from 'node:crypto';

const tick = () => new Promise((r) => setImmediate(r));
export async function sha256Hex(text) {
  const d = await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** honour: false simulates a runtime that ignores R2 conditions (the relay's self-test must catch it). */
export class CondR2 {
  objects = new Map(); ops = []; seq = 0; failAll = false;
  constructor({ honour = true } = {}) { this.honour = honour; }
  #obj(key, o) { return { key, etag: o.etag, httpEtag: `"${o.etag}"`, uploaded: new Date(o.uploaded), size: o.body.length, text: async () => o.body, json: async () => JSON.parse(o.body) }; }
  async get(key) { this.ops.push(`get ${key}`); await tick(); if (this.failAll) throw new Error('R2 down'); const o = this.objects.get(key); return o ? this.#obj(key, o) : null; }
  async head(key) { await tick(); const o = this.objects.get(key); return o ? this.#obj(key, o) : null; }
  async put(key, value, opts = {}) {
    this.ops.push(`put ${key}`);
    if (typeof value !== 'string') throw new TypeError('CondR2 expects a string body');
    await tick();
    if (this.failAll) throw new Error('R2 down');
    const cur = this.objects.get(key);
    const c = opts.onlyIf;
    if (c && this.honour) {
      if (c instanceof Headers) {
        const none = c.get('if-none-match'), match = c.get('if-match');
        if (none === '*' && cur) return null;
        if (match !== null && (!cur || match.replace(/^"|"$/g, '') !== cur.etag)) return null;
      } else {
        for (const k of ['etagMatches', 'etagDoesNotMatch']) if (typeof c[k] === 'string' && /^".*"$/.test(c[k])) throw new TypeError('Conditional ETag should not be wrapped in quotes');
        if (c.etagMatches !== undefined && (!cur || cur.etag !== c.etagMatches)) return null;
        if (c.etagDoesNotMatch !== undefined && cur && cur.etag === c.etagDoesNotMatch) return null;
      }
    }
    const o = { body: value, etag: `e${++this.seq}${Math.random().toString(36).slice(2, 8)}`, uploaded: Date.now() };
    this.objects.set(key, o);
    return this.#obj(key, o);
  }
  async delete(keys) { await tick(); for (const k of [keys].flat()) this.objects.delete(k); }
  async list({ prefix = '', cursor, limit = 1000 } = {}) {
    await tick();
    const all = [...this.objects.keys()].filter((k) => k.startsWith(prefix)).sort();
    const start = cursor ? Number(cursor) : 0, page = all.slice(start, start + Math.min(limit, 1000));
    const end = start + page.length;
    return { objects: page.map((k) => this.#obj(k, this.objects.get(k))), truncated: end < all.length, cursor: end < all.length ? String(end) : undefined };
  }
  keys(prefix = '') { return [...this.objects.keys()].filter((k) => k.startsWith(prefix)).sort(); }
  value(key) { return JSON.parse(this.objects.get(key).body); }
  dump() { return [...this.objects.values()].map((o) => o.body).join('\n'); }
}

export const OWNER = 'user_owner_9f3c';
export const OTHER = 'user_someone_else';
export const RELAY_TOKEN = 'test-relay-token-not-a-real-credential-0123456789';
export const RUN = 'abcdefghijklmnop';
export async function chatEnv(extra = {}) { return { CHAT_OWNER_ID: OWNER, CHAT_RELAY_SHA256: await sha256Hex(RELAY_TOKEN), BUCKET: new CondR2(), ...extra }; }

export const ORIGIN = 'https://drafarig.example';
/** An owner-route request as the app sends it (signed in, from its own page). */
export function ownerReq(path, { method = 'GET', body, user = OWNER, headers = {} } = {}) {
  const h = { 'x-drafarig-chat': '1', 'sec-fetch-site': 'same-origin', ...(user ? { 'oai-authenticated-user-id': user, 'oai-authenticated-user-email': `${user}@example.com` } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers };
  for (const k of Object.keys(h)) if (h[k] === null) delete h[k];
  return new Request(`${ORIGIN}/api/chat/${path}`, { method, headers: h, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
}
export function relayReq(path, { method = 'GET', body, token = RELAY_TOKEN, run = RUN } = {}) {
  const h = { ...(token ? { 'x-drafarig-relay-token': token } : {}), ...(run ? { 'x-drafarig-relay-run': run } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) };
  return new Request(`${ORIGIN}/api/chat/relay/${path}`, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
}
/** A valid page context (ChatContext/1). */
export const CONTEXT = Object.freeze({ v: 1, page: { area: 'prep', view: 'plan' }, pov: { coach: 'Anthony', seat: 5, you: true }, opponent: { coach: 'Calvin', seat: 8, weeks: [1], group: 'Group A' },
  rosters: { mine: ['charizard', 'sinistcha'], theirs: ['staraptor', 'grimmsnarl'] }, six: ['charizard'], plan: { name: 'Their Tailwind', members: ['staraptor'], speed: 'tailwind', lead: ['charizard'], back: [], mega: '' } });
let n = 0;
export const clientId = () => `m_${String(++n).padStart(16, 'a').replace(/[0-9]/g, (d) => 'abcdefghij'[d]).slice(-16)}`;
export const CONV = 'c_aaaaaaaaaaaaaaaa';

// Drafarig chat, Worker side: a private mailbox between the Site's owner (signed in with ChatGPT) and one relay on the
// owner's VM. The relay runs the VGC agent (Claude Code, no tools); nothing here calls a model.
//
// Fail-closed: without both Site settings (CHAT_OWNER_ID, CHAT_RELAY_SHA256), every route answers 503 "chat not set up",
// except whoami, which only echoes a signed-in caller's own Site-scoped id (how the owner finds the id to configure).
//
// Who may call what:
// - Owner routes need the trusted `oai-authenticated-user-id` header equal to CHAT_OWNER_ID: anonymous → 401, anyone else → 403.
// - Owner calls also need `x-drafarig-chat: 1` (posts: a JSON body): a custom header no cross-site form can send, and a
//   cross-origin fetch can't send it without a CORS preflight, which this Worker never grants. The browser's
//   Sec-Fetch-Site/Origin must say same-origin when present.
// - Relay routes need a bearer (`x-drafarig-relay-token`) whose SHA-256 equals the CHAT_RELAY_SHA256 secret (constant-time
//   compare) and a run id. The raw token never reaches the Site.
//
// Storage: the existing R2 binding BUCKET, only under chat/v1/<owner hash>/ (never the sheet cache keys).
// - R2 has no multi-object transactions. Every invariant that matters is one object written with a documented condition:
//   - create-only (`If-None-Match: *`): claims, replies, cancels, idempotency keys, rate tickets;
//   - compare-and-swap (`etagMatches`): the single pending-message lock.
//   So one pending message, first claim wins and N tickets per hour/day hold across isolates, as long as the runtime honours
//   R2 conditions. The relay checks that at startup (relay/selftest) and refuses to run if not.
// - A crash between two writes can leave a used ticket or a lock with no message. Locks are recovered by age (see `stale`);
//   tickets are never returned, which errs toward fewer turns, never more.
import { checkContext, CHAT_LIMITS, CONV_RE, CLIENT_RE, MSG_RE, newMessageId, randomB32 } from '../lib/chat-context.mjs';

export const CHAT = Object.freeze({
  onlineMs: 45_000, // relay seen this recently = online
  heartbeatMs: 15_000, // the relay's last-seen time is rewritten at most this often
  unclaimedMs: 10 * 60_000, // a message nobody picked up expires ("not delivered")
  replyDeadlineMs: 240_000, // a claimed message must be answered within this (the relay itself stops at 180 s)
  orphanMs: 30_000, // a lock whose message never got written is freed after this
  hourCap: 30, dayCap: 100,
  retentionMs: 14 * 864e5,
  history: 20,
});
const REPLY_KINDS = ['reply', 'error', 'timeout', 'rate-limited', 'declined'];
const RUN_RE = /^[a-z2-7]{16}$/;
const SIGN_IN = `/signin-with-chatgpt?return_to=${encodeURIComponent('/#prep')}`;

class HttpError extends Error { constructor(status, code, extra = {}) { super(code); this.status = status; this.code = code; this.extra = extra; } }
const reply = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });

const enc = new TextEncoder();
async function sha256Hex(text) {
  const d = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
/** Compare two strings without an early exit (lengths may differ: that only says the length is wrong). */
function same(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
export const chatConfigured = (env) => typeof env.CHAT_OWNER_ID === 'string' && env.CHAT_OWNER_ID.length > 0 && env.CHAT_OWNER_ID.length <= 200
  && typeof env.CHAT_RELAY_SHA256 === 'string' && /^[0-9a-f]{64}$/.test(env.CHAT_RELAY_SHA256) && !!env.BUCKET;

// ---------- R2 with conditions ----------
function storage(bucket) {
  const parse = async (obj) => { try { return JSON.parse(await obj.text()); } catch { return null; } };
  return {
    async get(key) { const o = await bucket.get(key); return o ? { value: await parse(o), etag: o.etag } : null; },
    /** Write only if the key doesn't exist yet: true when written. */
    async create(key, value) { return (await bucket.put(key, JSON.stringify(value), { onlyIf: new Headers({ 'if-none-match': '*' }) })) !== null; },
    /** Write only if the object is still the version read (etag): true when written. */
    async swap(key, value, etag) { return (await bucket.put(key, JSON.stringify(value), { onlyIf: { etagMatches: etag } })) !== null; },
    async put(key, value) { await bucket.put(key, JSON.stringify(value)); },
    async keys(prefix, max = 1000) {
      const out = []; let cursor;
      do { const r = await bucket.list({ prefix, cursor, limit: Math.min(1000, max - out.length) }); out.push(...r.objects.map((o) => o.key)); cursor = r.truncated ? r.cursor : undefined; } while (cursor && out.length < max);
      return out;
    },
    async remove(keys) { for (let i = 0; i < keys.length; i += 1000) await bucket.delete(keys.slice(i, i + 1000)); },
  };
}

// ---------- requests ----------
async function body(request) {
  if (Number(request.headers.get('content-length') ?? 0) > CHAT_LIMITS.body) throw new HttpError(413, 'too-large');
  const text = await request.text();
  if (enc.encode(text).length > CHAT_LIMITS.body) throw new HttpError(413, 'too-large');
  try { return JSON.parse(text); } catch { throw new HttpError(400, 'bad-json'); }
}
/** Every owner call comes from the app's own page (whoami excepted: the owner may open it directly to read their id). */
function ownerRequestGuard(request, url) {
  if (request.headers.get('x-drafarig-chat') !== '1') throw new HttpError(403, 'not-from-the-app');
  if (request.method === 'POST' && !(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) throw new HttpError(415, 'json-only');
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin') throw new HttpError(403, 'cross-site');
  const origin = request.headers.get('origin');
  if (!site && origin) { let host = ''; try { host = new URL(origin).host; } catch { /* unreadable */ } if (host !== url.host) throw new HttpError(403, 'cross-site'); }
}
function ownerOf(request, env) {
  const id = request.headers.get('oai-authenticated-user-id');
  if (!id) throw new HttpError(401, 'sign-in', { signIn: SIGN_IN });
  if (!same(id, env.CHAT_OWNER_ID)) throw new HttpError(403, 'not-the-owner');
}
async function relayOf(request, env) {
  const token = request.headers.get('x-drafarig-relay-token');
  if (!token || token.length > 200 || !same(await sha256Hex(token), env.CHAT_RELAY_SHA256)) throw new HttpError(401, 'relay-unauthorised');
  const run = request.headers.get('x-drafarig-relay-run') ?? '';
  if (!RUN_RE.test(run)) throw new HttpError(400, 'relay-run');
  return run;
}

// ---------- the mailbox ----------
export function mailbox(env, now) {
  const s = storage(env.BUCKET);
  let prefix = null;
  const P = async () => (prefix ??= `chat/v1/${(await sha256Hex(env.CHAT_OWNER_ID)).slice(0, 16)}/`);
  const k = {
    relay: async () => `${await P()}relay.json`,
    pending: async () => `${await P()}pending.json`,
    idem: async (c) => `${await P()}idem/${c}.json`,
    conv: async (conv) => `${await P()}conv/${conv}/`,
    convIndex: async (conv) => `${await P()}convs/${conv}.json`,
    part: async (conv, id, part) => `${await P()}conv/${conv}/${id}/${part}.json`,
    hour: async (t) => `${await P()}rate/h/${new Date(t).toISOString().slice(0, 13)}/`,
    day: async (t) => `${await P()}rate/d/${new Date(t).toISOString().slice(0, 10)}/`,
  };
  const parts = async (conv, id) => {
    const [msg, claim, rep, cancel] = await Promise.all(['msg', 'claim', 'reply', 'cancel'].map(async (p) => (await s.get(await k.part(conv, id, p)))?.value ?? null));
    return { msg, claim, reply: rep, cancel };
  };
  /** A message's state, worked out from its parts (never written by reading). */
  const stateOf = ({ msg, claim, reply: rep, cancel }) => {
    if (!msg) return 'missing';
    if (rep) return rep.kind === 'reply' ? 'answered' : rep.kind;
    if (cancel) return 'cancelled';
    if (claim) return now - claim.at > CHAT.replyDeadlineMs ? 'timeout' : 'working';
    return now - msg.at > CHAT.unclaimedMs ? 'expired' : 'queued';
  };
  const view = (p) => ({ id: p.msg.id, conv: p.msg.conv, clientId: p.msg.clientId, text: p.msg.text, at: p.msg.at, state: stateOf(p), ...(p.reply ? { reply: { kind: p.reply.kind, text: p.reply.text, at: p.reply.at } } : {}) });
  /** Is the pending lock still holding a live message? (Its message may be done, cancelled, abandoned or never written.) */
  const live = async (lock) => {
    if (!lock || lock.state !== 'held') return false;
    const p = await parts(lock.conv, lock.id);
    if (!p.msg) return now - lock.at <= CHAT.orphanMs;
    const st = stateOf(p);
    return st === 'queued' || st === 'working';
  };
  /** Settle a lock's dead message: an unanswered one gets its final state written (create-only, so never over a real reply). */
  const settle = async (lock) => {
    const p = await parts(lock.conv, lock.id);
    if (!p.msg || p.reply || p.cancel) return;
    const st = stateOf(p);
    if (st === 'expired' || st === 'timeout') await s.create(await k.part(lock.conv, lock.id, 'reply'), { kind: st, text: '', at: now });
  };
  /** Free the lock if it still names this message (compare-and-swap: never frees someone else's newer lock). */
  const release = async (id) => {
    for (let i = 0; i < 3; i++) {
      const cur = await s.get(await k.pending());
      if (!cur || cur.value?.state !== 'held' || cur.value.id !== id) return;
      if (await s.swap(await k.pending(), { state: 'free', at: now }, cur.etag)) return;
    }
  };
  /** Take the single pending slot for a new message, or say which message holds it. */
  const acquire = async (conv, id) => {
    const held = { state: 'held', conv, id, at: now };
    for (let i = 0; i < 4; i++) {
      const cur = await s.get(await k.pending());
      if (!cur) { if (await s.create(await k.pending(), held)) return { ok: true }; continue; }
      if (await live(cur.value)) return { busy: { conv: cur.value.conv, id: cur.value.id } };
      if (await s.swap(await k.pending(), held, cur.etag)) { if (cur.value?.state === 'held') await settle(cur.value); return { ok: true }; }
    }
    return { busy: null };
  };
  /** One rate ticket from a bucket of `cap` create-only keys: at most `cap` can ever exist, whatever the concurrency. */
  const ticket = async (prefix, cap) => {
    const used = (await s.keys(prefix, cap + 1)).length;
    for (let n = used; n < cap; n++) if (await s.create(`${prefix}${String(n).padStart(3, '0')}`, { at: now })) return true;
    return false;
  };
  const relaySeen = async () => (await s.get(await k.relay()))?.value ?? null;
  const online = (seen) => !!seen && now - seen.seenAt <= CHAT.onlineMs;
  return { s, k, P, parts, stateOf, view, live, settle, release, acquire, ticket, relaySeen, online };
}

// ---------- owner routes ----------
const OWNER = {
  async 'GET status'({ m, now }) {
    const seen = await m.relaySeen();
    const lock = (await m.s.get(await m.k.pending()))?.value;
    const pending = (await m.live(lock)) ? { conv: lock.conv, id: lock.id } : null;
    const [h, d] = await Promise.all([m.s.keys(await m.k.hour(now), CHAT.hourCap + 1), m.s.keys(await m.k.day(now), CHAT.dayCap + 1)]);
    return { configured: true, relay: { online: m.online(seen), seenAt: seen?.seenAt ?? null }, pending, limits: { hour: { used: h.length, cap: CHAT.hourCap }, day: { used: d.length, cap: CHAT.dayCap } } };
  },
  async 'POST send'({ m, now, request }) {
    const b = await body(request);
    if (!b || typeof b !== 'object' || Array.isArray(b)) throw new HttpError(400, 'bad-request');
    for (const key of Object.keys(b)) if (!['conv', 'clientId', 'text', 'context'].includes(key)) throw new HttpError(400, 'bad-request', { field: key });
    if (!CONV_RE.test(b.conv ?? '') || !CLIENT_RE.test(b.clientId ?? '')) throw new HttpError(400, 'bad-ids');
    const text = typeof b.text === 'string' ? b.text.trim() : '';
    if (!text || text.length > CHAT_LIMITS.text) throw new HttpError(400, 'bad-text');
    const errors = checkContext(b.context);
    if (errors.length) throw new HttpError(400, 'bad-context', { errors: errors.slice(0, 5) });
    // the same message sent twice (a retry) is the same message
    const known = await m.s.get(await m.k.idem(b.clientId));
    if (known?.value) {
      const p = await m.parts(known.value.conv, known.value.id);
      if (p.msg) return { id: p.msg.id, conv: p.msg.conv, state: m.stateOf(p), repeat: true };
    }
    const seen = await m.relaySeen();
    if (!m.online(seen)) throw new HttpError(503, 'relay-offline', { seenAt: seen?.seenAt ?? null });
    const id = newMessageId(now);
    const slot = await m.acquire(b.conv, id);
    if (!slot.ok) throw new HttpError(409, 'busy', { pending: slot.busy });
    const hour = await m.k.hour(now), day = await m.k.day(now);
    if (!(await m.ticket(hour, CHAT.hourCap)) || !(await m.ticket(day, CHAT.dayCap))) {
      await m.release(id);
      throw new HttpError(429, 'rate-limited', { retryAfter: 'later' });
    }
    try {
      await m.s.create(await m.k.part(b.conv, id, 'msg'), { id, conv: b.conv, clientId: b.clientId, text, context: b.context, at: now });
      await m.s.create(await m.k.idem(b.clientId), { conv: b.conv, id, at: now });
      await m.s.put(await m.k.convIndex(b.conv), { conv: b.conv, lastAt: now });
    } catch (e) { await m.release(id).catch(() => {}); throw e; }
    return { id, conv: b.conv, state: 'queued' };
  },
  async 'GET message'({ m, url }) {
    const conv = url.searchParams.get('conv') ?? '', id = url.searchParams.get('id') ?? '';
    if (!CONV_RE.test(conv) || !MSG_RE.test(id)) throw new HttpError(400, 'bad-ids');
    const p = await m.parts(conv, id);
    if (!p.msg) throw new HttpError(404, 'not-found');
    return m.view(p);
  },
  async 'GET history'({ m, now, url }) {
    const conv = url.searchParams.get('conv') ?? '';
    if (!CONV_RE.test(conv)) throw new HttpError(400, 'bad-ids');
    // retention: a few conversations past their 14 days are deleted on each visit
    const old = [];
    for (const key of await m.s.keys(`${await m.P()}convs/`, 200)) {
      const v = (await m.s.get(key))?.value;
      if (v && now - v.lastAt > CHAT.retentionMs) old.push(v.conv);
      if (old.length >= 3) break;
    }
    for (const c of old) { await m.s.remove(await m.s.keys(await m.k.conv(c))); await m.s.remove([await m.k.convIndex(c)]); }
    const ids = [...new Set((await m.s.keys(await m.k.conv(conv))).map((key) => key.split('/').at(-2)))].filter((x) => MSG_RE.test(x)).sort().slice(-CHAT.history);
    const out = [];
    for (const id of ids) { const p = await m.parts(conv, id); if (p.msg) out.push(m.view(p)); }
    return { conv, messages: out };
  },
  async 'POST cancel'({ m, now, request }) {
    const b = await body(request);
    if (!CONV_RE.test(b?.conv ?? '') || !MSG_RE.test(b?.id ?? '')) throw new HttpError(400, 'bad-ids');
    const p = await m.parts(b.conv, b.id);
    if (!p.msg) throw new HttpError(404, 'not-found');
    if (p.reply) throw new HttpError(409, 'already-answered', { state: m.stateOf(p) });
    await m.s.create(await m.k.part(b.conv, b.id, 'cancel'), { at: now });
    await m.release(b.id);
    return { id: b.id, state: 'cancelled' };
  },
  async 'POST clear'({ m, request }) {
    const b = await body(request);
    if (!CONV_RE.test(b?.conv ?? '')) throw new HttpError(400, 'bad-ids');
    const lock = (await m.s.get(await m.k.pending()))?.value;
    const keys = await m.s.keys(await m.k.conv(b.conv));
    await m.s.remove([...keys, await m.k.convIndex(b.conv)]);
    if (lock?.state === 'held' && lock.conv === b.conv) await m.release(lock.id);
    return { conv: b.conv, cleared: true };
  },
};

// ---------- relay routes ----------
const RELAY = {
  /** The next message to answer, if any (and the relay's heartbeat). */
  async 'GET next'({ m, now, run }) {
    const seen = await m.relaySeen();
    if (!seen || now - seen.seenAt >= CHAT.heartbeatMs || seen.run !== run) await m.s.put(await m.k.relay(), { seenAt: now, run });
    const cur = await m.s.get(await m.k.pending());
    const lock = cur?.value;
    if (!lock || lock.state !== 'held') return { message: null };
    if (!(await m.live(lock))) { await m.settle(lock); await m.release(lock.id); return { message: null }; }
    const p = await m.parts(lock.conv, lock.id);
    if (!p.msg) return { message: null }; // being written: next poll
    const claimKey = await m.k.part(lock.conv, lock.id, 'claim');
    let claim = p.claim;
    if (!claim && await m.s.create(claimKey, { at: now, run })) claim = { at: now, run };
    claim ??= (await m.s.get(claimKey))?.value;
    if (!claim || claim.run !== run) return { message: null, busy: true }; // another relay run holds it until its deadline
    const { id, conv, text, context, at } = p.msg;
    return { message: { id, conv, text, context, at, claimAt: claim.at, deadline: claim.at + CHAT.replyDeadlineMs } };
  },
  /** Whether a message being answered was cancelled (the relay stops the turn early). */
  async 'GET check'({ m, url }) {
    const conv = url.searchParams.get('conv') ?? '', id = url.searchParams.get('id') ?? '';
    if (!CONV_RE.test(conv) || !MSG_RE.test(id)) throw new HttpError(400, 'bad-ids');
    const p = await m.parts(conv, id);
    return { state: m.stateOf(p), cancelled: !!p.cancel };
  },
  async 'POST reply'({ m, now, run, request }) {
    const b = await body(request);
    if (!CONV_RE.test(b?.conv ?? '') || !MSG_RE.test(b?.id ?? '')) throw new HttpError(400, 'bad-ids');
    if (!REPLY_KINDS.includes(b.kind) || typeof b.text !== 'string' || b.text.length > CHAT_LIMITS.reply) throw new HttpError(400, 'bad-reply');
    const p = await m.parts(b.conv, b.id);
    if (!p.msg) throw new HttpError(404, 'not-found');
    if (!p.claim || p.claim.run !== run) throw new HttpError(409, 'not-claimed');
    if (p.cancel) { await m.release(b.id); throw new HttpError(409, 'cancelled'); }
    const key = await m.k.part(b.conv, b.id, 'reply');
    if (p.reply) { if (p.reply.kind === b.kind && p.reply.text === b.text) return { id: b.id, state: m.stateOf(p), repeat: true }; throw new HttpError(409, 'already-answered'); }
    if (now - p.claim.at > CHAT.replyDeadlineMs) { await m.settle({ conv: b.conv, id: b.id }); await m.release(b.id); throw new HttpError(409, 'too-late'); }
    if (!(await m.s.create(key, { kind: b.kind, text: b.text, at: now }))) {
      const again = (await m.s.get(key))?.value;
      if (!(again && again.kind === b.kind && again.text === b.text)) throw new HttpError(409, 'already-answered');
    }
    await m.release(b.id);
    return { id: b.id, state: b.kind === 'reply' ? 'answered' : b.kind };
  },
  /** Does this runtime honour R2 conditions? The relay refuses to run unless both checks pass. */
  async 'POST selftest'({ m, now }) {
    const key = `${await m.P()}selftest/${randomB32(12)}`;
    const first = await m.s.create(key, { at: now });
    const second = await m.s.create(key, { at: now, second: true });
    const cur = await m.s.get(key);
    const wrongEtag = cur ? await m.s.swap(key, { at: now, wrong: true }, `${cur.etag}x`) : true;
    const rightEtag = cur ? await m.s.swap(key, { at: now, swapped: true }, cur.etag) : false;
    await m.s.remove([key]);
    return { createOnly: first && !second, compareAndSwap: !wrongEtag && rightEtag };
  },
};

/** Handle /api/chat/*. Returns a Response; never throws. */
export async function chat(request, env, url, { log = () => {} } = {}) {
  const name = `${request.method} ${url.pathname.slice('/api/chat/'.length)}`;
  const now = Date.now();
  try {
    if (name === 'GET whoami') {
      // the owner's way to find their Site-scoped id: shown only to the signed-in caller, and once chat is set up only to the owner
      const id = request.headers.get('oai-authenticated-user-id');
      if (!id) throw new HttpError(401, 'sign-in', { signIn: SIGN_IN });
      if (env.CHAT_OWNER_ID && !same(id, env.CHAT_OWNER_ID)) throw new HttpError(403, 'not-the-owner');
      return reply({ id, configured: chatConfigured(env) });
    }
    const isRelay = name.startsWith('GET relay/') || name.startsWith('POST relay/');
    const handler = isRelay ? RELAY[name.replace('relay/', '')] : OWNER[name];
    if (!handler) throw new HttpError(404, 'not-found');
    if (!chatConfigured(env)) throw new HttpError(503, 'chat-not-set-up');
    const m = mailbox(env, now);
    if (isRelay) return reply(await handler({ m, now, url, request, run: await relayOf(request, env) }));
    ownerOf(request, env);
    ownerRequestGuard(request, url);
    return reply(await handler({ m, now, url, request }));
  } catch (e) {
    if (e instanceof HttpError) return reply({ error: e.code, ...e.extra }, e.status);
    log(`chat ${name} failed: ${e?.name || 'Error'}`); // never the message, context or a token
    return reply({ error: 'storage-unavailable' }, 503);
  }
}

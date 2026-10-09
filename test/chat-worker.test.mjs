// Chat mailbox in the Worker (worker/chat.mjs), against a fake R2 that honours conditional writes as documented. These are
// local tests of this code's own checks. They don't prove the hosting boundary: whether Sites strips a forged
// oai-authenticated-user-id header can only be checked on the deployed Site.
// Covered: fail-closed defaults, owner and relay authorisation, request limits, the message lifecycle, one pending
// message, strict rate tickets under concurrency, idempotent retries, cancel, expiry, timeouts, stale replies, isolation,
// retention, the conditional-write self-test, and the built artifact's routing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chat, CHAT, mailbox } from '../worker/chat.mjs';
import { CHAT_LIMITS } from '../lib/chat-context.mjs';
import { CondR2, chatEnv, ownerReq, relayReq, OWNER, OTHER, RELAY_TOKEN, RUN, CONTEXT, CONV, clientId, sha256Hex, ORIGIN } from './chat-helpers.mjs';

const call = async (env, req) => { const res = await chat(req, env, new URL(req.url)); return { status: res.status, body: await res.json(), headers: Object.fromEntries(res.headers) }; };
const send = (env, extra = {}) => call(env, ownerReq('send', { method: 'POST', body: { conv: CONV, clientId: clientId(), text: 'What should I lead into their Tailwind?', context: CONTEXT, ...extra } }));
const next = (env, run = RUN) => call(env, relayReq('next', { run }));
const answer = (env, id, { kind = 'reply', text = 'Lead Pelipper + Aegislash.', conv = CONV, run = RUN } = {}) => call(env, relayReq('reply', { method: 'POST', body: { conv, id, kind, text }, run }));
let clock = Date.parse('2026-10-09T15:00:00.000Z');
const at = (t) => { clock = t; };
test.beforeEach((t) => { t.mock.method(Date, 'now', () => clock); });

async function online(env) { const r = await next(env); assert.equal(r.status, 200); return r; }

test('fail-closed: without both settings every chat route says "not set up" and nothing is stored; whoami only echoes a signed-in caller', async () => {
  for (const env of [{ BUCKET: new CondR2() }, { BUCKET: new CondR2(), CHAT_OWNER_ID: OWNER }, { BUCKET: new CondR2(), CHAT_RELAY_SHA256: await sha256Hex(RELAY_TOKEN) },
    { BUCKET: new CondR2(), CHAT_OWNER_ID: OWNER, CHAT_RELAY_SHA256: 'not-a-hash' }, { CHAT_OWNER_ID: OWNER, CHAT_RELAY_SHA256: await sha256Hex(RELAY_TOKEN) }]) {
    for (const req of [ownerReq('status'), ownerReq('send', { method: 'POST', body: { conv: CONV, clientId: clientId(), text: 'hi', context: CONTEXT } }), ownerReq(`history?conv=${CONV}`), relayReq('next'), relayReq('selftest', { method: 'POST', body: {} })]) {
      const r = await call(env, req);
      assert.deepEqual([r.status, r.body.error], [503, 'chat-not-set-up'], req.url);
    }
    if (env.BUCKET) assert.equal(env.BUCKET.objects.size, 0, 'nothing written');
  }
  const env = { BUCKET: new CondR2() };
  const anon = await call(env, ownerReq('whoami', { user: null }));
  assert.deepEqual([anon.status, anon.body.error, anon.body.signIn], [401, 'sign-in', '/signin-with-chatgpt?return_to=%2F%23prep']);
  const me = await call(env, ownerReq('whoami', { user: 'site-scoped-id-123', headers: { 'x-drafarig-chat': null } }));
  assert.deepEqual([me.status, me.body], [200, { id: 'site-scoped-id-123', configured: false }], 'openable directly (no app header) to read your own id');
  assert.equal(me.headers['cache-control'], 'no-store');
});

test('owner routes: anonymous 401 with a same-origin sign-in link; another account 403; only the app\'s own page may call (custom header, same-origin, JSON posts)', async () => {
  const env = await chatEnv();
  assert.deepEqual(await call(env, ownerReq('status', { user: null })).then((r) => [r.status, r.body.signIn]), [401, '/signin-with-chatgpt?return_to=%2F%23prep']);
  assert.equal((await call(env, ownerReq('status', { user: OTHER }))).status, 403);
  assert.equal((await call(env, ownerReq('status', { user: `${OWNER}x` }))).status, 403);
  assert.equal((await call(env, ownerReq('status', { user: OWNER.slice(0, -1) }))).status, 403);
  assert.equal((await call(env, ownerReq('status'))).status, 200);
  assert.equal((await call(env, ownerReq('status', { headers: { 'x-drafarig-chat': null } }))).body.error, 'not-from-the-app');
  assert.equal((await call(env, ownerReq('status', { headers: { 'sec-fetch-site': 'cross-site' } }))).body.error, 'cross-site');
  assert.equal((await call(env, ownerReq('status', { headers: { 'sec-fetch-site': null, origin: 'https://evil.example' } }))).body.error, 'cross-site');
  assert.equal((await call(env, ownerReq('status', { headers: { 'sec-fetch-site': null, origin: ORIGIN } }))).status, 200);
  const form = await call(env, ownerReq('cancel', { method: 'POST', body: `conv=${CONV}`, headers: { 'content-type': 'application/x-www-form-urlencoded' } }));
  assert.equal(form.status, 415);
  // once set up, whoami answers only the owner
  assert.equal((await call(env, ownerReq('whoami', { user: OTHER }))).status, 403);
  assert.deepEqual((await call(env, ownerReq('whoami'))).body, { id: OWNER, configured: true });
});

test('relay routes: the token is checked by its SHA-256 (the raw token is never stored); a run id is required; owner sign-in is no substitute', async () => {
  const env = await chatEnv();
  assert.equal((await call(env, relayReq('next', { token: null }))).status, 401);
  assert.equal((await call(env, relayReq('next', { token: `${RELAY_TOKEN}x` }))).status, 401);
  assert.equal((await call(env, relayReq('next', { token: 'x'.repeat(500) }))).status, 401);
  assert.equal((await call(env, relayReq('next', { run: 'BAD' }))).status, 400);
  const ownerOnRelay = new Request(`${ORIGIN}/api/chat/relay/next`, { headers: { 'oai-authenticated-user-id': OWNER, 'x-drafarig-chat': '1', 'x-drafarig-relay-run': RUN } });
  assert.equal((await call(env, ownerOnRelay)).status, 401);
  assert.equal((await online(env)).body.message, null);
  assert.ok(!env.BUCKET.dump().includes(RELAY_TOKEN), 'the token is not stored');
});

test('send: strict request shape and limits; refused while the relay is offline (no silent queue); accepted once it is seen', async () => {
  const env = await chatEnv();
  assert.deepEqual([(await send(env)).status, (await send(env)).body.error], [503, 'relay-offline']);
  await online(env);
  const bad = [
    [{ extra: 1 }, 'bad-request'], [{ conv: 'x' }, 'bad-ids'], [{ clientId: 'nope' }, 'bad-ids'], [{ text: '   ' }, 'bad-text'], [{ text: 'x'.repeat(CHAT_LIMITS.text + 1) }, 'bad-text'],
    [{ context: { ...CONTEXT, storageDump: '...' } }, 'bad-context'], [{ context: { ...CONTEXT, notes: 'n'.repeat(CHAT_LIMITS.notes + 1) } }, 'bad-context'], [{ context: { ...CONTEXT, page: { area: 'prep', view: 'secret' } } }, 'bad-context'],
  ];
  for (const [extra, code] of bad) assert.equal((await send(env, extra)).body.error, code, JSON.stringify(extra));
  const huge = await call(env, ownerReq('send', { method: 'POST', body: JSON.stringify({ conv: CONV, clientId: clientId(), text: 'x', context: CONTEXT, pad: 'p'.repeat(CHAT_LIMITS.body) }) }));
  assert.deepEqual([huge.status, huge.body.error], [413, 'too-large']);
  assert.equal((await call(env, ownerReq('send', { method: 'POST', body: '{not json' }))).body.error, 'bad-json');
  const ok = await send(env);
  assert.deepEqual([ok.status, ok.body.state, ok.body.conv], [200, 'queued', CONV]);
  const st = await call(env, ownerReq('status'));
  assert.deepEqual([st.body.relay.online, st.body.pending], [true, { conv: CONV, id: ok.body.id }]);
  at(clock + CHAT.onlineMs + 1);
  assert.equal((await call(env, ownerReq('status'))).body.relay.online, false, 'offline once the relay stops polling');
});

test('one round trip: the relay gets the message with its context, answers once; the owner reads the answer; the slot frees for the next', async () => {
  const env = await chatEnv();
  await online(env);
  const s = await send(env, { text: 'Hi <b>there</b>' });
  const n1 = await next(env);
  assert.deepEqual([n1.body.message.id, n1.body.message.text, n1.body.message.context, n1.body.message.deadline - n1.body.message.claimAt], [s.body.id, 'Hi <b>there</b>', CONTEXT, CHAT.replyDeadlineMs]);
  assert.equal((await call(env, ownerReq(`message?conv=${CONV}&id=${s.body.id}`))).body.state, 'working');
  const again = await next(env);
  assert.equal(again.body.message.id, s.body.id, 'the same run gets its claimed message again (a retry), never a second one');
  const r = await answer(env, s.body.id, { text: 'Lead <script>x</script>' });
  assert.deepEqual([r.status, r.body.state], [200, 'answered']);
  const m = await call(env, ownerReq(`message?conv=${CONV}&id=${s.body.id}`));
  assert.deepEqual([m.body.state, m.body.reply.kind, m.body.reply.text], ['answered', 'reply', 'Lead <script>x</script>'], 'stored as text; the app escapes it');
  assert.equal((await answer(env, s.body.id, { text: 'Lead <script>x</script>' })).body.repeat, true, 'a repeated identical reply is accepted once');
  assert.equal((await answer(env, s.body.id, { text: 'something else' })).body.error, 'already-answered');
  assert.equal((await next(env)).body.message, null);
  assert.equal((await send(env)).status, 200, 'the slot is free');
});

test('one pending message, even under concurrent sends; a retry with the same client id is the same message', async () => {
  const env = await chatEnv();
  await online(env);
  const results = await Promise.all(Array.from({ length: 6 }, () => send(env)));
  assert.equal(results.filter((r) => r.status === 200).length, 1, 'exactly one accepted');
  const busy = results.filter((r) => r.status === 409);
  assert.equal(busy.length, 5);
  const won = results.find((r) => r.status === 200).body;
  assert.ok(busy.every((r) => r.body.pending?.id === won.id), 'busy names the pending message');
  const cid = clientId();
  await answer(env, (await next(env)).body.message.id);
  const first = await send(env, { clientId: cid });
  const retry = await send(env, { clientId: cid });
  assert.deepEqual([retry.status, retry.body.id, retry.body.repeat], [200, first.body.id, true]);
  const st = await call(env, ownerReq('status'));
  assert.equal(st.body.limits.hour.used, 2, 'a retry takes no extra ticket');
});

test('rate tickets are strict: at most the cap, whatever the concurrency; a rate-limited send frees the slot it took', async () => {
  const env = await chatEnv();
  const m = mailbox(env, clock);
  const prefix = await m.k.hour(clock);
  const got = await Promise.all(Array.from({ length: 80 }, () => m.ticket(prefix, CHAT.hourCap)));
  assert.equal(got.filter(Boolean).length, CHAT.hourCap);
  assert.equal(env.BUCKET.keys(prefix).length, CHAT.hourCap);
  await online(env);
  const r = await send(env);
  assert.deepEqual([r.status, r.body.error], [429, 'rate-limited']);
  assert.equal((await call(env, ownerReq('status'))).body.pending, null, 'the slot was given back');
  at(clock + 3600e3);
  await online(env);
  assert.equal((await send(env)).status, 200, 'a new hour has new tickets');
});

test('cancel: a queued or working message stops; the relay sees it and its late reply is refused; an answered one can\'t be cancelled', async () => {
  const env = await chatEnv();
  await online(env);
  const q = await send(env);
  const c = await call(env, ownerReq('cancel', { method: 'POST', body: { conv: CONV, id: q.body.id } }));
  assert.deepEqual([c.status, c.body.state], [200, 'cancelled']);
  assert.equal((await next(env)).body.message, null, 'not delivered');
  const w = await send(env);
  await next(env);
  await call(env, ownerReq('cancel', { method: 'POST', body: { conv: CONV, id: w.body.id } }));
  assert.deepEqual((await call(env, relayReq(`check?conv=${CONV}&id=${w.body.id}`))).body, { state: 'cancelled', cancelled: true });
  assert.equal((await answer(env, w.body.id)).body.error, 'cancelled');
  const a = await send(env);
  await next(env);
  await answer(env, a.body.id);
  assert.equal((await call(env, ownerReq('cancel', { method: 'POST', body: { conv: CONV, id: a.body.id } }))).body.error, 'already-answered');
});

test('time limits: an unclaimed message expires ("not delivered"); a claimed one times out; late replies are refused; the slot is recovered', async () => {
  const env = await chatEnv();
  const t0 = clock;
  await online(env);
  const e = await send(env);
  at(t0 + CHAT.unclaimedMs + 1);
  assert.equal((await call(env, ownerReq(`message?conv=${CONV}&id=${e.body.id}`))).body.state, 'expired');
  assert.equal((await next(env)).body.message, null);
  assert.equal(env.BUCKET.value(env.BUCKET.keys('chat/v1/').find((k) => k.endsWith(`${e.body.id}/reply.json`))).kind, 'expired', 'settled');
  const w = await send(env);
  await next(env);
  at(clock + CHAT.replyDeadlineMs + 1);
  assert.equal((await call(env, ownerReq(`message?conv=${CONV}&id=${w.body.id}`))).body.state, 'timeout');
  assert.equal((await answer(env, w.body.id)).body.error, 'too-late');
  await online(env);
  assert.equal((await send(env)).status, 200);
});

test('stale writes: another relay run can\'t answer or take a claimed message; a lock whose message was never written is freed', async () => {
  const env = await chatEnv();
  await online(env);
  const s = await send(env);
  await next(env, RUN);
  const other = await next(env, 'qrstuvwxyzabcdef');
  assert.deepEqual([other.body.message, other.body.busy], [null, true]);
  assert.equal((await answer(env, s.body.id, { run: 'qrstuvwxyzabcdef' })).body.error, 'not-claimed');
  assert.equal((await answer(env, s.body.id)).status, 200);
  // a crash between taking the slot and writing the message
  const m = mailbox(env, clock);
  await env.BUCKET.put(await m.k.pending(), JSON.stringify({ state: 'held', conv: CONV, id: '000000000-aaaaaaaa', at: clock }));
  await online(env);
  assert.equal((await send(env)).body.error, 'busy');
  at(clock + CHAT.orphanMs + 1);
  await online(env);
  assert.equal((await send(env)).status, 200);
});

test('isolation and retention: everything lives under chat/v1/<owner hash>/; another owner sees nothing; clear deletes a conversation; 14-day-old ones go', async () => {
  const env = await chatEnv();
  await env.BUCKET.put('sheet/last-good.json', '{"keep":true}');
  await online(env);
  const s = await send(env);
  const prefix = `chat/v1/${(await sha256Hex(OWNER)).slice(0, 16)}/`;
  assert.ok(env.BUCKET.keys().filter((k) => k !== 'sheet/last-good.json').every((k) => k.startsWith(prefix)));
  const env2 = { ...env, CHAT_OWNER_ID: 'a-new-owner' };
  assert.equal((await call(env2, ownerReq(`message?conv=${CONV}&id=${s.body.id}`, { user: 'a-new-owner' }))).status, 404);
  const cleared = await call(env, ownerReq('clear', { method: 'POST', body: { conv: CONV } }));
  assert.equal(cleared.body.cleared, true);
  assert.deepEqual(env.BUCKET.keys(`${prefix}conv/`), []);
  assert.equal((await call(env, ownerReq('status'))).body.pending, null, 'clearing frees its slot');
  assert.equal(env.BUCKET.value('sheet/last-good.json').keep, true, 'the sheet cache is never touched');
  const old = 'c_bbbbbbbbbbbbbbbb';
  await online(env);
  await call(env, ownerReq('send', { method: 'POST', body: { conv: old, clientId: clientId(), text: 'old', context: CONTEXT } }));
  at(clock + CHAT.retentionMs + 1);
  const h = await call(env, ownerReq(`history?conv=${CONV}`));
  assert.equal(h.status, 200);
  assert.deepEqual(env.BUCKET.keys(`${prefix}conv/${old}/`), [], 'past retention: deleted');
});

test('history: the last messages of a conversation, oldest first, with their states and replies', async () => {
  const env = await chatEnv();
  await online(env);
  const ids = [];
  for (const text of ['one', 'two', 'three']) { const s = await send(env, { text }); ids.push(s.body.id); await next(env); await answer(env, s.body.id, { text: `re ${text}` }); at(clock + 1000); await online(env); }
  const h = await call(env, ownerReq(`history?conv=${CONV}`));
  assert.deepEqual(h.body.messages.map((x) => [x.id, x.text, x.state, x.reply.text]), ids.map((id, i) => [id, ['one', 'two', 'three'][i], 'answered', `re ${['one', 'two', 'three'][i]}`]));
});

test('self-test: an R2 that honours conditions passes; one that ignores them fails (the relay then refuses to run)', async () => {
  const good = await chatEnv();
  assert.deepEqual((await call(good, relayReq('selftest', { method: 'POST', body: {} }))).body, { createOnly: true, compareAndSwap: true });
  const bad = await chatEnv({ BUCKET: new CondR2({ honour: false }) });
  assert.deepEqual((await call(bad, relayReq('selftest', { method: 'POST', body: {} }))).body, { createOnly: false, compareAndSwap: false });
  assert.deepEqual(good.BUCKET.keys('chat/v1/').filter((k) => k.includes('/selftest/')), [], 'cleans up');
});

test('storage failures: 503 without details; the log names only the route, never the message or a token', async (t) => {
  const env = await chatEnv();
  await online(env);
  env.BUCKET.failAll = true;
  const logs = [];
  const req = ownerReq('send', { method: 'POST', body: { conv: CONV, clientId: clientId(), text: 'very private question', context: CONTEXT } });
  const res = await chat(req, env, new URL(req.url), { log: (m) => logs.push(m) });
  assert.deepEqual([res.status, await res.json()], [503, { error: 'storage-unavailable' }]);
  assert.ok(logs.length && logs.every((l) => !/private|Calvin|token/i.test(l)), logs.join());
});

test('the built Worker routes /api/chat/* (POST allowed there only) and is fail-closed without settings', async () => {
  const { default: worker } = await import(`../dist/server/index.js?chat=${Date.now()}`);
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const r = await worker.fetch(ownerReq('status'), { BUCKET: new CondR2() }, ctx);
  assert.deepEqual([r.status, (await r.json()).error], [503, 'chat-not-set-up']);
  const p = await worker.fetch(new Request(`${ORIGIN}/api/sheet`, { method: 'POST' }), {}, ctx);
  assert.equal(p.status, 405, 'other routes stay GET-only');
  const env = await chatEnv();
  const w = await worker.fetch(relayReq('next'), env, ctx);
  assert.deepEqual([w.status, (await w.json()).message], [200, null]);
});

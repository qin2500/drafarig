// Battle Prep's chat panel (public/prep-chat.js + app.chat), on the stub DOM.
// - The "Site" is the real Worker chat code (worker/chat.mjs) over a fake R2, with the harness adding the sign-in header
//   as dispatch would.
// - The "agent" is the real relay logic (tools/chat-relay.mjs) with a stub provider: test-only, never a live chat.
// Covered: no chat traffic until opened; every honest state (not set up, sign in, not yours, offline, unreachable);
// visible, removable context chips and opt-in notes; escaped text; one question at a time; cancel; polling; retries are
// the same message; clearing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootApp, parseHtml, findAll, find, text, hasClass } from './ui-harness.mjs';
import { T, device, flushSaves, NOW } from './prep-helpers.mjs';
import { chat } from '../worker/chat.mjs';
import { createRelay } from '../tools/chat-relay.mjs';
import { checkContext } from '../lib/chat-context.mjs';
import { CondR2, chatEnv, OWNER, OTHER, RELAY_TOKEN, ORIGIN } from './chat-helpers.mjs';
import * as C from '../public/prep-copy.js';

const ready = (app) => app.waitFor(() => !/Checking what they can learn/.test(app.html()), 'the Reg M-C data', 20000);
const root = (app) => parseHtml(app.html());
const panel = (app) => find(root(app), (n) => n.attrs.id === 'chat-panel');
/** The Site as the browser reaches it: same-origin, with dispatch's identity header for the signed-in user (or none). */
const site = (env, user = OWNER, calls = []) => async (path, init) => {
  calls.push(path);
  const headers = new Headers(init.headers);
  headers.set('sec-fetch-site', 'same-origin');
  if (user) headers.set('oai-authenticated-user-id', user);
  const req = new Request(`${ORIGIN}${path}`, { method: init.method ?? 'GET', headers, body: init.body });
  return chat(req, env, new URL(req.url));
};
const relayFetch = (env) => (url, init) => chat(new Request(url, init), env, new URL(url));
const agent = (env, provider) => createRelay({ site: ORIGIN, token: RELAY_TOKEN, fetchImpl: relayFetch(env), provider, check: async () => ({ ok: true }), sleep: () => new Promise((r) => setImmediate(r)), checkEveryMs: 1 });
async function open(mode, opts) { const app = await bootApp({ mode, ...opts }); await ready(app); return app; }
async function openChat(app) { await app.click({ pa: 'chat-open' }); await app.waitFor(() => panel(app) && !/Checking chat/.test(text(panel(app))), 'the chat state'); }
const sentMessages = (env) => [...env.BUCKET.objects.keys()].filter((k) => k.endsWith('/msg.json')).map((k) => env.BUCKET.value(k));

test('no chat traffic until the panel is opened; then "not set up" is said plainly, and the owner can show their own id (or sign in first)', async (t) => {
  const env = { BUCKET: new CondR2() };
  const calls = [];
  const app = await open('prep/5v8', { storage: device(), chat: site(env, 'site-scoped-id-42', calls) });
  t.after(() => app.restore());
  assert.equal(calls.length, 0, 'nothing until opened');
  assert.ok(find(root(app), (n) => n.attrs['data-pa'] === 'chat-open'), 'an entry on the screen');
  await openChat(app);
  assert.ok(text(panel(app)).includes(C.CHATUI.notSetUp));
  assert.equal(findAll(panel(app), (n) => n.tag === 'textarea').length, 0, 'no composer when not set up');
  await app.click({ pa: 'chat-whoami' });
  await app.waitFor(() => /site-scoped-id-42/.test(text(panel(app))), 'the id');
  const signedOut = await open('prep/5v8', { storage: device(), chat: site({ BUCKET: new CondR2() }, null) });
  t.after(() => signedOut.restore());
  await openChat(signedOut);
  await signedOut.click({ pa: 'chat-whoami' });
  await signedOut.waitFor(() => find(panel(signedOut), (n) => n.tag === 'a' && /signin-with-chatgpt/.test(n.attrs.href ?? '')), 'a sign-in link');
  const a = find(panel(signedOut), (n) => n.tag === 'a');
  assert.deepEqual([a.attrs.href, a.attrs.target], ['/signin-with-chatgpt?return_to=%2F%23prep%2F5v8', '_top'], 'a normal top-level link back to this screen (same-origin, relative)');
});

test('signed out → a sign-in link; another account → private; relay offline → "Not connected" with last seen, and nothing can be sent', async (t) => {
  const env = await chatEnv();
  for (const [user, want] of [[null, C.CHATUI.signIn], [OTHER, C.CHATUI.notYours]]) {
    const app = await open('prep/5v8', { storage: device(), chat: site(env, user) });
    t.after(() => app.restore());
    await openChat(app);
    assert.ok(text(panel(app)).includes(want), want);
    assert.equal(findAll(panel(app), (n) => n.tag === 'textarea').length, 0);
  }
  const app = await open('prep/5v8', { storage: device(), chat: site(env) });
  t.after(() => app.restore());
  await openChat(app);
  assert.match(text(panel(app)), /Not connected: the VGC agent is offline\. Nothing can be sent/);
  assert.ok(find(panel(app), (n) => n.tag === 'textarea').attrs.disabled !== undefined);
  assert.ok(find(panel(app), (n) => n.attrs['data-pa'] === 'chat-send').attrs.disabled !== undefined);
  await app.input('chat-draft', 'hello?');
  await app.click({ pa: 'chat-send' });
  await flushSaves(app);
  assert.equal(sentMessages(env).length, 0, 'refused by the Site too: no silent queue');
});

test('a question goes with the visible page context; a removed chip and unticked notes stay out; the reply is shown as plain text, without waiting for a tap', async (t) => {
  const env = await chatEnv();
  const seen = [];
  const relay = agent(env, async ({ prompt }) => { seen.push(prompt); return { text: 'Lead Pelipper <script>alert(1)</script> & Aegislash', session: 's1' }; });
  await relay.start(); await relay.tick();
  const plan = { id: 'plan_aaaaaaaaaaaa', label: 'Their Tailwind', kind: 'likely', members: ['staraptor'], megaUser: null, speedMode: 'tailwind', field: '', needs: '', basis: [], falsifiers: { atPreview: ['staraptor'], inGame: [] }, updatedAt: NOW };
  const storage = device({ coach: 'Calvin', ws: { plans: [plan], premortem: 'my secret premortem', shortlist: ['sinistcha'] } });
  const app = await open('prep/5v8/plan', { storage, chat: site(env) });
  t.after(() => app.restore());
  await openChat(app);
  const chips = findAll(panel(app), (n) => hasClass(n, 'pchip')).map((n) => text(n));
  assert.deepEqual(chips, ['Page: Plan', 'You: Anthony', 'Opponent: Calvin (W1)', 'Both pools', 'Your 6 (2)', 'Plan: Their Tailwind', 'League rules you set']);
  await app.click({ pa: 'chat-chip', key: 'rosters' });
  assert.equal(find(panel(app), (n) => n.attrs['data-key'] === 'rosters').attrs['aria-pressed'], 'false');
  await app.input('chat-draft', 'What leads into <their> Tailwind?');
  await app.click({ pa: 'chat-send' });
  await app.waitFor(() => sentMessages(env).length === 1, 'sent');
  const ctx = sentMessages(env)[0].context;
  assert.deepEqual(checkContext(ctx), [], 'exactly the allowlisted shape');
  assert.deepEqual(Object.keys(ctx).sort(), ['opponent', 'page', 'plan', 'pov', 'rules', 'six', 'v']);
  assert.deepEqual(ctx.rules, { matchLength: 'bo3' }, 'only rules you set (unknown ones aren\'t sent)');
  assert.equal(ctx.notes, undefined, 'notes only when ticked');
  assert.ok(!/ws_|set_|plan_|card_|secret/.test(JSON.stringify(ctx)), 'no storage ids, no notes');
  assert.match(text(panel(app)), /Waiting for the agent/);
  assert.ok(find(panel(app), (n) => n.attrs['data-pa'] === 'chat-send').attrs.disabled !== undefined, 'one question at a time');
  await relay.tick();
  await app.waitFor(() => /Lead Pelipper/.test(text(panel(app))), 'the reply, by polling', 6000);
  const html = panel(app);
  assert.ok(text(html).includes('Lead Pelipper <script>alert(1)</script> & Aegislash'), 'shown as text');
  assert.equal(findAll(html, (n) => ['script', 'a', 'img'].includes(n.tag) && n.parent && findAll(find(html, (x) => hasClass(x, 'chat-log')) ?? html, (y) => y === n).length).length, 0, 'no markup from the reply');
  assert.ok(text(html).includes('What leads into <their> Tailwind?'));
  assert.ok(seen[0].includes('"plan":{"name":"Their Tailwind"'), 'the agent got the page');
  // with notes ticked, the notes go too (and only for that message)
  await app.changeData({ pc: 'chat-notes' }, { checked: true });
  await app.input('chat-draft', 'And with my notes?');
  await app.click({ pa: 'chat-send' });
  await app.waitFor(() => sentMessages(env).length === 2, 'sent');
  assert.match(sentMessages(env).find((m) => m.text === 'And with my notes?').context.notes, /Premortem: my secret premortem/);
});

test('cancel stops a waiting question; a failed send keeps your text and its retry is the same message; clearing asks first', async (t) => {
  const env = await chatEnv();
  const relay = agent(env, () => new Promise(() => {}));
  await relay.start(); await relay.tick();
  let down = false, loseNextReply = false;
  const live = site(env);
  const app = await open('prep/5v8', { storage: device(), chat: async (p, i) => {
    if (down) throw new TypeError('network');
    const r = await live(p, i);
    if (loseNextReply && p === '/api/chat/send') { loseNextReply = false; throw new TypeError('connection reset'); } // stored, but the answer never arrives
    return r;
  } });
  t.after(() => app.restore());
  await openChat(app);
  await app.input('chat-draft', 'first question');
  await app.click({ pa: 'chat-send' });
  await app.waitFor(() => sentMessages(env).length === 1, 'sent');
  const id = sentMessages(env)[0].id;
  await app.click({ pa: 'chat-cancel', msg: id });
  await app.waitFor(() => /Cancelled\./.test(text(panel(app))), 'cancelled');
  const pastDoubleTap = () => new Promise((r) => setTimeout(r, 450)); // the same tap within 400 ms counts once (by design)
  down = true;
  await app.input('chat-draft', 'second question');
  await pastDoubleTap();
  await app.click({ pa: 'chat-send' });
  await app.settle(20);
  assert.equal(app.toast.textContent, C.CHATUI.unreachable);
  assert.match(find(panel(app), (n) => n.tag === 'textarea').children.map(text).join(''), /second question/, 'the text is kept');
  down = false;
  loseNextReply = true;
  await pastDoubleTap();
  await app.click({ pa: 'chat-send' });
  await app.waitFor(() => sentMessages(env).length === 2, 'stored by the Site');
  assert.equal(app.toast.textContent, C.CHATUI.unreachable, 'the phone never heard back');
  await pastDoubleTap();
  await app.click({ pa: 'chat-send' });
  await app.waitFor(() => /second question[^]*Waiting for the agent/.test(text(panel(app))), 'the retry is recognised');
  assert.equal(sentMessages(env).length, 2, 'the same message, not a second copy');
  await pastDoubleTap();
  await app.click({ pa: 'chat-send' });
  await app.settle(20);
  assert.equal(sentMessages(env).length, 2, 'the draft was cleared once sent: no duplicate');
  await app.click({ pa: 'chat-clear' });
  assert.ok(text(panel(app)).includes(C.CHATUI.clearAsk));
  assert.equal(sentMessages(env).length, 2, 'nothing deleted yet');
  await pastDoubleTap();
  await app.click({ pa: 'chat-clear', confirm: 'yes' });
  await app.waitFor(() => sentMessages(env).length === 0, 'deleted');
});

test('an unreachable Site is said as such, with a retry; a broken chat never takes the screen down', async (t) => {
  const app = await open('prep/5v8', { storage: device(), chat: async () => { throw new TypeError('offline'); } });
  t.after(() => app.restore());
  await openChat(app);
  assert.ok(text(panel(app)).includes(C.CHATUI.unreachable));
  assert.ok(find(panel(app), (n) => n.attrs['data-pa'] === 'chat-refresh'));
  assert.match(T(app), /vs Calvin/, 'the screen is still there');
  const env = await chatEnv();
  const weird = await open('prep/5v8', { storage: device(), chat: async () => new Response('<html>oops</html>', { status: 200 }) });
  t.after(() => weird.restore());
  await openChat(weird);
  assert.match(T(weird), /vs Calvin/);
  void env;
});

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
import { T, device, flushSaves, NOW, WS, SET_MINE, SET_THEIRS } from './prep-helpers.mjs';
import { chat } from '../worker/chat.mjs';
import { createRelay } from '../tools/chat-relay.mjs';
import { checkContext } from '../lib/chat-context.mjs';
import { CondR2, chatEnv, OWNER, OTHER, RELAY_TOKEN, ORIGIN } from './chat-helpers.mjs';
import * as C from '../public/prep-copy.js';
import { POLL, when } from '../public/prep-chat.js';

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
  assert.deepEqual(chips, ['Page: Plan', 'You: Anthony', 'Opponent: Calvin (W1)', 'Both pools', 'Your 6 (2)', 'Plan: Likely plan', 'League rules you set']);
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
  assert.ok(!/ws_|set_|plan_|card_|secret|Their Tailwind/.test(JSON.stringify(ctx)), 'no storage ids, no notes, not your own plan name');
  assert.deepEqual(ctx.plan, { name: 'Likely plan', source: 'saved', members: ['staraptor'], tells: ['staraptor'], theirSpeed: 'tailwind', lead: [], back: [], mega: '', myStatus: null });
  assert.match(text(panel(app)), /Waiting for the agent/);
  assert.ok(find(panel(app), (n) => n.attrs['data-pa'] === 'chat-send').attrs.disabled !== undefined, 'one question at a time');
  await relay.tick();
  await app.waitFor(() => /Lead Pelipper/.test(text(panel(app))), 'the reply, by polling', 6000);
  const html = panel(app);
  assert.ok(text(html).includes('Lead Pelipper <script>alert(1)</script> & Aegislash'), 'shown as text');
  assert.equal(findAll(html, (n) => ['script', 'a', 'img'].includes(n.tag) && n.parent && findAll(find(html, (x) => hasClass(x, 'chat-log')) ?? html, (y) => y === n).length).length, 0, 'no markup from the reply');
  assert.ok(text(html).includes('What leads into <their> Tailwind?'));
  assert.ok(seen[0].includes('"plan":{"name":"Likely plan","source":"saved"'), 'the agent got the page');
  // with notes ticked, the notes go too (and only for that message)
  await app.changeData({ pc: 'chat-notes' }, { checked: true });
  await app.input('chat-draft', 'And with my notes?');
  await app.click({ pa: 'chat-send' });
  await app.waitFor(() => sentMessages(env).length === 2, 'sent');
  assert.match(sentMessages(env).find((m) => m.text === 'And with my notes?').context.notes, /^Plan name: Their Tailwind\nPremortem: my secret premortem/);
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

/** One question from a screen (after `before` sets it up): the chips shown and the context the Site stored. */
async function askFrom(t, mode, { storage = device(), before = async () => {}, engine = false } = {}) {
  const env = await chatEnv();
  const relay = agent(env, async () => ({ text: 'ok', session: 's' }));
  await relay.start(); await relay.tick();
  const app = await open(mode, { storage, chat: site(env) });
  t.after(() => app.restore());
  if (engine) await app.waitFor(() => !/Loading the calculator/.test(T(app)), 'the engine', 20000);
  await before(app);
  await openChat(app);
  const chips = findAll(panel(app), (n) => hasClass(n, 'pchip')).map((n) => text(n));
  await app.input('chat-draft', 'What about this screen?');
  await app.click({ pa: 'chat-send' });
  await app.waitFor(() => sentMessages(env).length === 1, 'sent');
  const ctx = sentMessages(env)[0].context;
  assert.deepEqual(checkContext(ctx), [], `${mode}: the allowlisted shape`);
  await relay.tick();
  await app.waitFor(() => !/Waiting for the agent/.test(text(panel(app))), 'answered (so its polling ends)', 6000);
  return { app, chips, ctx };
}

test('screen context: the Brief sends its own reading (look-first codes, plans, Speed facts); the Overview its league weeks', async (t) => {
  const brief = await askFrom(t, 'prep/5v8');
  assert.ok(brief.chips.some((c) => c.startsWith('The brief:')), brief.chips.join(' | '));
  const b = brief.ctx.briefing;
  assert.ok(Array.isArray(b.key) && Array.isArray(b.plans) && Array.isArray(b.speed));
  assert.ok(b.key.every((k) => typeof k.id === 'string' && k.reasons.every((r) => /^[a-z0-9-]+$/.test(r))), 'codes, not prose');
  const over = await askFrom(t, 'prep/5');
  assert.ok(over.chips.some((c) => /^League weeks \(\d+\)/.test(c)), over.chips.join(' | '));
  assert.ok(over.ctx.schedule.weeks.length > 0 && over.ctx.schedule.weeks.every((w) => Number.isInteger(w.week) && typeof w.bye === 'boolean'));
  assert.equal(over.ctx.briefing, undefined);
});

test('screen context: an open set goes as you see it (their sources included); your own set only as yourself; a set list says nothing is open', async (t) => {
  const theirs = await askFrom(t, `prep/w/${WS}/sets/${SET_THEIRS}`);
  assert.ok(theirs.chips.includes('Their set: rillaboom') && theirs.chips.includes('Page: Sets'), theirs.chips.join(' | '));
  assert.deepEqual(theirs.ctx.set, { side: 'theirs', species: 'rillaboom', item: 'miracleseed', ability: 'grassysurge', nature: 'adamant', moves: ['fakeout', 'grassyglide', 'woodhammer', 'uturn'], sp: 'unknown',
    src: { item: 'seen-vs-others', ability: 'seen-vs-others', nature: null, sp: null, moves: [null, null, null, null] } });
  const mine = await askFrom(t, `prep/w/${WS}/sets/${SET_MINE}`);
  assert.deepEqual(mine.ctx.set, { side: 'mine', species: 'charizard', item: 'charizarditey', ability: 'blaze', nature: 'timid', moves: ['heatwave', 'solarbeam', 'weatherball', 'protect'], sp: { hp: 2, atk: 0, def: 0, spa: 32, spd: 0, spe: 32 } });
  assert.ok(!/Sun Zard|Pasted|set_/.test(JSON.stringify(mine.ctx) + JSON.stringify(theirs.ctx)), 'no set names (your text) or storage ids');
  const list = await askFrom(t, 'prep/5v8/sets');
  assert.ok(list.chips.includes('Page: Sets (no set or calc open)'), list.chips.join(' | '));
  assert.equal(list.ctx.set, undefined);
});

test('screen context: the calc being worked on goes with its conditions; with their Stat Points unknown it says the number is max investment, not "the" result', async (t) => {
  const { chips, ctx } = await askFrom(t, `prep/w/${WS}/calcs/new`, { engine: true, before: async (app) => {
    await app.click({ pa: 'calc-pick', which: 'a', side: 'theirs', species: 'rillaboom', set: SET_THEIRS });
    await app.click({ pa: 'calc-pick', which: 'd', side: 'mine', species: 'charizard', set: SET_MINE });
    await app.click({ pa: 'calc-move', move: 'woodhammer' });
    await app.click({ pa: 'calc-set', scope: 'field', key: 'terrain', value: 'Grassy' });
  } });
  assert.ok(chips.includes('Calc: rillaboom → charizard'), chips.join(' | '));
  assert.deepEqual([ctx.calc.attacker, ctx.calc.defender, ctx.calc.move], ['rillaboom', 'charizard', 'woodhammer']);
  assert.match(ctx.calc.result, /^depends on their investment \(Stat Points unknown\); max investment: \d+(\.\d)?–\d+(\.\d)?% of HP · /);
  assert.ok(ctx.calc.chips.includes('terrain=grassy'), ctx.calc.chips.join());
  assert.deepEqual(ctx.calc.envelope.map((e) => e.key).sort(), ctx.calc.envelope.map((e) => e.key).filter((k) => ['frail', 'common', 'max'].includes(k)).sort());
  assert.ok(ctx.calc.envelope.every((e) => e.ko === null || /^\d+\/16$|^\d+(\.\d)?%$/.test(e.ko)));
});

test('honest states: a message the Site never settles stops polling with "No update yet" and Check again; another 403 isn\'t called "not yours"; an old last-seen has its date', async (t) => {
  const env = await chatEnv();
  const relay = agent(env, () => new Promise(() => {}));
  await relay.start(); await relay.tick();
  const saved = { ...POLL };
  Object.assign(POLL, { fastMs: 20, slowMs: 20, fastForMs: 40, forMs: 150 });
  const app = await open('prep/5v8', { storage: device(), chat: site(env) });
  try {
    await openChat(app);
    await app.input('chat-draft', 'still there?');
    await app.click({ pa: 'chat-send' });
    await app.waitFor(() => /No update yet\./.test(text(panel(app))), 'polling gives up honestly', 4000);
    assert.ok(findAll(panel(app), (n) => n.attrs['data-pa'] === 'chat-refresh' && text(n) === C.CHATUI.checkAgain).length >= 1);
    assert.ok(!/Waiting for the agent/.test(text(panel(app))), 'no live "waiting" once it stopped checking');
    await app.click({ pa: 'chat-refresh' });
    await app.waitFor(() => /Waiting for the agent/.test(text(panel(app))), 'checking again resumes it');
    await app.click({ pa: 'chat-cancel', msg: sentMessages(env)[0].id });
    await app.waitFor(() => /Cancelled\./.test(text(panel(app))), 'cancelled');
    await new Promise((r) => setTimeout(r, 100)); // its polling sees the final state and stops
  } finally { Object.assign(POLL, saved); app.restore(); }
  // a 403 that isn't "not the owner" (here: not from the app's own page) is a plain "not available", with a retry
  const crossSite = await open('prep/5v8', { storage: device(), chat: async (path, init) => {
    const headers = new Headers(init.headers);
    headers.set('sec-fetch-site', 'cross-site'); headers.set('oai-authenticated-user-id', OWNER);
    const req = new Request(`${ORIGIN}${path}`, { method: init.method ?? 'GET', headers, body: init.body });
    return chat(req, env, new URL(req.url));
  } });
  t.after(() => crossSite.restore());
  await openChat(crossSite);
  assert.ok(text(panel(crossSite)).includes(C.CHATUI.storage) && !text(panel(crossSite)).includes(C.CHATUI.notYours));
  const now = Date.parse('2026-10-09T15:00:00Z');
  assert.doesNotMatch(when(now - 60_000, now), /Oct/);
  assert.match(when(now - 3 * 864e5, now), /Oct/, 'another day: with its date');
  assert.ok(when(now - 3 * 864e5, now).length > when(now, now).length, 'the same clock time, plus its date');
});

test('the privacy line says where chat text goes and how long each copy is kept; Prep\'s "stays on this device" line names chat as the exception', () => {
  const p = C.CHATUI.privacy;
  assert.doesNotMatch(p, /own machine/);
  for (const must of [/private chat store/, /Drafarig cloud VM/, /Claude \(Anthropic\)/, /personal Claude account/, /clear/, /14 days/, /session history stays on the VM/]) assert.match(p, must);
  assert.match(C.HOME.chooseHelp, /Chat messages you send are the exception/);
  assert.match(C.CHATUI.empty, /only the items listed below/);
});

test('closing the panel returns focus to the "Ask the VGC agent" entry; drill-downs have that entry too', async (t) => {
  const app = await open(`prep/w/${WS}/sets/${SET_THEIRS}`, { storage: device(), chat: site(await chatEnv()) });
  t.after(() => app.restore());
  assert.ok(find(root(app), (n) => n.attrs.id === 'chat-entry'), 'an entry on a set editor');
  await openChat(app);
  assert.equal(find(root(app), (n) => n.attrs.id === 'chat-entry'), null, 'hidden while the panel is open');
  const before = app.lookedUp.length;
  await app.click({ pa: 'chat-close' });
  await app.settle(5);
  assert.ok(app.lookedUp.slice(before).includes('chat-entry'), 'focus goes back to the entry (not the top of the page)');
  assert.ok(find(root(app), (n) => n.attrs.id === 'chat-entry'));
});

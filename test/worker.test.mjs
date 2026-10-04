// The built Sites Worker (dist/server/index.js; `npm test` builds it first) against a fake Google/Smogon upstream
// and an in-memory R2. Each freshWorker() is a new module instance, standing in for a new Worker isolate.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GID, PUB } from '../lib/sheet.mjs';
import { buildLeague } from '../lib/league.mjs';
import { slimChaos } from '../lib/usage.mjs';

const ROOT = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT));
const fx = (n) => read(`test/fixtures/${n}`).toString('utf8');
const dex = JSON.parse(read('data/dex.json'));
const RAW = { boardCsv: fx('board.csv'), draftsCsv: fx('drafts.csv'), boardHtml: fx('board.html') };
const SHEET_KEY = 'sheet-last-good.json';
const USAGE_KEY = 'usage-gen9championsvgc2026regmc.json';
const UPSTREAM_DOWN = { error: 'Upstream data unavailable. Please try again.' };
const NOT_FOUND = { error: 'Not found' };
const CHAOS = {
  info: { metagame: 'gen9championsvgc2026regmc', cutoff: 1760, 'number of battles': 1234 },
  data: {
    Incineroar: { usage: 0.51234, Abilities: { intimidate: 90, blaze: 10 }, Items: { safetygoggles: 60, sitrusberry: 40 }, Moves: { fakeout: 95, partingshot: 80 }, Spreads: { 'Careful:252/4/0/0/252/0': 30 }, Teammates: { 'Flutter Mane': 40 } },
    'Flutter Mane': { usage: 0.4, Abilities: { protosynthesis: 100 }, Items: { boosterenergy: 100 }, Moves: { moonblast: 100 }, Spreads: {}, Teammates: { Incineroar: 50 } },
  },
};
const monthBack = (back) => { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - back); return d.toISOString().slice(0, 7); };
const usageUrl = (back) => `https://www.smogon.com/stats/${monthBack(back)}/chaos/gen9championsvgc2026regmc-1760.json`;

let isolates = 0;
const freshWorker = async () => (await import(new URL(`dist/server/index.js?isolate=${++isolates}`, ROOT))).default;
const ctx = { waitUntil() {}, passThroughOnException() {} };

let seed = 7; // deterministic latencies for the concurrency tests
const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
const pause = (maxMs) => new Promise((r) => (maxMs ? setTimeout(r, Math.floor(rand() * maxMs)) : setImmediate(r)));

// In-memory R2: get() -> null | R2ObjectBody-like { uploaded, json(), text() }; put() commits the whole object at once.
class FakeR2 {
  objects = new Map(); ops = []; failGet = false; failPut = false;
  constructor(latency = 0) { this.latency = latency; }
  async get(key) {
    this.ops.push(`get ${key}`); await pause(this.latency);
    if (this.failGet) throw new Error('R2 get failed: bucket internal-7f3a /var/lib/r2');
    const o = this.objects.get(key);
    return o ? { key, uploaded: new Date(o.uploaded), text: async () => o.body, json: async () => JSON.parse(o.body) } : null;
  }
  async put(key, value) {
    this.ops.push(`put ${key}`);
    if (typeof value !== 'string') throw new TypeError('FakeR2 expects a string body');
    await pause(this.latency);
    if (this.failPut) throw new Error('R2 put failed: bucket internal-7f3a /var/lib/r2');
    this.objects.set(key, { body: value, uploaded: Date.now() });
  }
  value(key) { return JSON.parse(this.objects.get(key).body); }
  age(key, ms) { this.objects.get(key).uploaded -= ms; }
}

const kind = (url) => url.startsWith('https://www.smogon.com/stats/') ? 'usage' : url.includes('/pubhtml/sheet?') ? 'html'
  : url.includes(`gid=${GID.board}&`) ? 'board' : url.includes(`gid=${GID.drafts}&`) ? 'drafts' : 'unknown';
const LIVE = {
  board: () => new Response(RAW.boardCsv),
  drafts: () => new Response(RAW.draftsCsv),
  html: () => new Response(RAW.boardHtml),
  usage: (url) => (url === usageUrl(1) ? Response.json(CHAOS) : new Response('Not Found', { status: 404 })),
};
const leak = () => { throw new TypeError('fetch failed: connect ECONNREFUSED 10.1.2.3:443 (/workspace/secret/token.json)'); };
const DOWN = { board: () => new Response('Internal Server Error', { status: 500 }), drafts: leak, html: leak, usage: () => new Response('Service Unavailable', { status: 503 }) };

// Fake upstream (records every call, rejects the `cache` init field like older Workers runtimes) + captured logs.
function setup(t, routes = {}, latency = 0) {
  const calls = [], logs = [];
  t.mock.method(console, 'log', (m) => logs.push(String(m)));
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    url = String(url);
    const k = kind(url);
    calls.push({ url, init, kind: k });
    if ('cache' in init) throw new TypeError("The 'cache' field on 'RequestInitializerDict' is not implemented.");
    await pause(latency);
    const route = routes[k] ?? LIVE[k];
    if (!route) throw new Error(`unexpected upstream URL ${url}`);
    return route(url, calls.filter((c) => c.kind === k).length);
  });
  return { calls, logs, count: (k) => calls.filter((c) => c.kind === k).length };
}

async function get(worker, path, env, method = 'GET') {
  const res = await worker.fetch(new Request(`https://drafarig.example${path}`, { method }), env, ctx);
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch {}
  return { status: res.status, headers: Object.fromEntries(res.headers), text, body, hasBody: res.body !== null };
}

const SECRETS = ['HTTP ', 'docs.google', '2PACX', 'smogon', 'ECONNREFUSED', '/workspace', '/var/lib', 'internal-7f3a', 'R2 ', 'TypeError', 'URIError', 'offline mode', SHEET_KEY, USAGE_KEY];
function assertSanitized(r, expected) {
  assert.deepEqual(r.body, expected);
  for (const s of SECRETS) assert.ok(!r.text.includes(s), `response leaks ${JSON.stringify(s)}: ${r.text}`);
}

// public/ and lib/ are served recursively (public/vendor/, lib/calc/), like the build embeds them.
const filesUnder = (dir) => readdirSync(new URL(`${dir}/`, ROOT), { recursive: true, withFileTypes: true }).filter((d) => d.isFile())
  .map((d) => relative(fileURLToPath(new URL(`${dir}/`, ROOT)), join(d.parentPath ?? d.path, d.name)).split(sep).join('/')).sort();
const STATIC_FILES = [...filesUnder('public').map((f) => [`/${f}`, `public/${f}`]),
  ...filesUnder('lib').map((f) => [`/lib/${f}`, `lib/${f}`]), ['/data/dex.json', 'data/dex.json'], ['/data/cores.json', 'data/cores.json'],
  ['/data/mechanics.json', 'data/mechanics.json'], ['/', 'public/index.html']];
// Everything the Worker may serve: public/, lib/ and exactly three data files. Anything else embedded would be an exposure.
const ALLOWED_ASSETS = STATIC_FILES.filter(([p]) => p !== '/').map(([, f]) => f).sort();
const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json; charset=utf-8', txt: 'text/plain; charset=utf-8' };

test('static routes serve the embedded files byte-for-byte with the original headers', async (t) => {
  const { calls } = setup(t);
  const worker = await freshWorker();
  for (const [path, file] of [...STATIC_FILES, ['/index.html', 'public/index.html'], ['/app.js?v=2', 'public/app.js']]) {
    const res = await worker.fetch(new Request(`https://drafarig.example${path}`), {}, ctx);
    assert.equal(res.status, 200, path);
    assert.ok(Buffer.from(await res.arrayBuffer()).equals(read(file)), `${path} bytes differ from ${file}`);
    assert.equal(res.headers.get('content-type'), TYPES[file.split('.').pop()], path);
    assert.equal(res.headers.get('cache-control'), 'no-store', path);
  }
  assert.ok(STATIC_FILES.length >= 17);
  for (const p of ['/lib/cores.mjs', '/lib/cores-view.mjs', '/lib/rerender.mjs', '/data/cores.json', '/prep.js', '/lib/calc/wrapper.mjs', '/data/mechanics.json',
    '/vendor/smogon-calc-0.12.0.mjs', '/vendor/THIRD_PARTY_NOTICES.txt', '/vendor/smogon-calc.SOURCE.json']) assert.ok(STATIC_FILES.some(([x]) => x === p), p);
  assert.equal(calls.length, 0);
});

test('Prep adds no server route: no POST, no prep API, no simulator or research inputs served', async (t) => {
  const { calls } = setup(t);
  const worker = await freshWorker();
  for (const path of ['/api/prep', '/api/prep/', '/api/calc', '/api/backup', '/api/telemetry', '/data/mechanics-projection.json', '/data/cache/mechanics.json',
    '/node_modules/@smogon/calc/package.json', '/node_modules/@smogon/calc/dist/production.min.js', '/pokemon-showdown/sim/battle.ts', '/tools/vendor-calc.mjs',
    '/tools/build-mechanics.mjs', '/tools/port-sim-fixtures.mjs', '/test/fixtures/sim-expected.json', '/test/fixtures/pastes.txt', '/test/fixtures/calc-source-pin.json',
    '/research/SIMULATOR-VALIDATION.md', '/research/IMPLEMENTATION-STATUS.md', '/IMPLEMENTATION-STATUS.md', '/scratch/oracle/report.json',
    '/lib/calc/', '/vendor/', '/data/mechanics.json/']) {
    const r = await get(worker, path, {});
    assert.equal(r.status, 404, path);
  }
  for (const path of ['/api/prep', '/data/mechanics.json', '/prep.js']) assert.equal((await get(worker, path, {}, 'POST')).status, 405, path);
  assert.equal(calls.length, 0);
});

test('artifact budget: the Worker bundle stays under 3 MB and the mechanics projection is the pinned, minimal one', () => {
  const size = read('dist/server/index.js').length;
  assert.ok(size < 3 * 1024 * 1024, `dist/server/index.js is ${size} bytes`);
  const mech = JSON.parse(read('data/mechanics.json'));
  assert.equal(mech.meta.schema, 'drafarig.mechanics-app/1');
  assert.deepEqual(Object.keys(mech).sort(), ['abilities', 'items', 'learnsetMoves', 'learnsets', 'meta', 'moves', 'natures', 'regulation', 'species']);
  assert.equal(mech.meta.source.projectionSha256, '167e768f3a24ffe70b03e4ddc02b887fbf9a3cee826c704d1578dfdfbad57d02');
  assert.equal(mech.meta.source.projectionHash, '48dafc7a14a2ac971a533989ccaf07c0117452b5f60bc813e8c6de7963838e08');
  const text = read('data/mechanics.json').toString('utf8');
  for (const s of ['/workspace', 'drafarig-match-prep-research', 'scratch', 'oracle', 'node_modules', 'pokemon-showdown/', 'C:\\']) assert.ok(!text.includes(s), `mechanics.json mentions ${s}`);
});

test('unknown paths, directories, source/config files and the R2 cache blobs are all 404', async (t) => {
  setup(t);
  const bucket = new FakeR2();
  await bucket.put(SHEET_KEY, JSON.stringify({ fetchedAt: 'x', raw: RAW }));
  await bucket.put(USAGE_KEY, JSON.stringify({ species: {} }));
  const worker = await freshWorker();
  for (const path of ['/nope', '/lib', '/lib/', '/lib/nope.mjs', '/data', '/data/', '/data/dex.json/', '/index.html/', '/server.mjs', '/package.json',
    '/.openai/hosting.json', '/worker/app.mjs', '/scripts/build.mjs', '/dist/server/index.js', '/test/fixtures/board.csv', '/api', '/api/', '/api/sheet/',
    `/${SHEET_KEY}`, `/data/cache/${SHEET_KEY}`, `/${USAGE_KEY}`, `/data/cache/${USAGE_KEY}`, '/lib/%00', '/%2e%2e/server.mjs', '/lib/%2e%2e/package.json',
    // the Cores research / verification inputs and repo internals are never served
    '/data/cores.json/', '/data/cores-full.json', '/docs/research/strategy/cores.json', '/docs/research/reviews/research-review-2026-10-03.md',
    '/tools/build-data.mjs', '/tools/cores-report.mjs', '/test/cores.test.mjs', '/test/fixtures/cores-check-2026-10-03.json',
    '/test/fixtures/league-snapshot-2026-10-03.json', '/node_modules/.cache/drafarig-core-source-b09fbab/data/cores.json',
    '/node_modules/.cache/drafarig-core-source-b09fbab/SOURCE-MANIFEST.json', '/.git/config', '/.git/HEAD', '/mobile-carry-forward.patch',
    '/MOBILE-INTEGRATION-HANDOFF.md', '/lib/cores.json', '/data/']) {
    const r = await get(worker, path, { BUCKET: bucket });
    assert.equal(r.status, 404, path);
    assertSanitized(r, NOT_FOUND);
  }
});

test('encoded path traversal is refused like server.mjs (403), and stays inside the served roots', async (t) => {
  setup(t);
  const worker = await freshWorker();
  for (const path of ['/lib/..%2fserver.mjs', '/lib/..%2f..%2f..%2fetc%2fpasswd', '/..%2fpackage.json', '/..%2f.openai%2fhosting.json',
    '/%2e%2e%2fserver.mjs', '/lib/..%2fpublic%2findex.html', '/..%2flib%2fsheet.mjs', '/..%2fdata%2fdex.json', '/..%2fdata%2fcores.json',
    '/lib/..%2fnode_modules%2f.cache%2fdrafarig-core-source-b09fbab%2fdata%2fcores.json', '/..%2f.git%2fconfig']) {
    const r = await get(worker, path, {});
    assert.deepEqual([r.status, r.text], [403, 'Forbidden'], path);
  }
  // Same normalisation as Node's path.join: a detour that ends back inside lib/ is still lib/.
  const r = await get(worker, '/lib/..%2flib%2fsheet.mjs', {});
  assert.deepEqual([r.status, r.text], [200, read('lib/sheet.mjs').toString('utf8')]);
});

test('malformed percent-encoding is a sanitized 500, details only in the server log', async (t) => {
  const { logs } = setup(t);
  const r = await get(await freshWorker(), '/%E0%A4%A', {});
  assert.equal(r.status, 500);
  assertSanitized(r, { error: 'Request could not be completed' });
  assert.ok(logs.some((l) => l.includes('failed (500)') && l.includes('URI')));
});

test('only GET and HEAD are allowed: 405 before any upstream or R2 access', async (t) => {
  const { calls } = setup(t);
  const bucket = new FakeR2();
  const worker = await freshWorker();
  for (const method of ['POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']) for (const path of ['/', '/api/sheet', '/api/usage', '/lib/sheet.mjs', '/nope']) {
    const r = await get(worker, path, { BUCKET: bucket }, method);
    assert.equal(r.status, 405, `${method} ${path}`);
    assert.equal(r.headers.allow, 'GET, HEAD');
    assert.equal(r.headers['content-type'], TYPES.json);
    assertSanitized(r, { error: 'Method not allowed' });
  }
  assert.equal(calls.length, 0);
  assert.deepEqual(bucket.ops, []);
});

test('HEAD returns the GET status and headers with no body', async (t) => {
  const { count } = setup(t);
  const bucket = new FakeR2();
  const worker = await freshWorker();
  for (const [path, status, type] of [['/', 200, TYPES.html], ['/lib/league.mjs', 200, TYPES.mjs], ['/lib/cores.mjs', 200, TYPES.mjs], ['/data/dex.json', 200, TYPES.json],
    ['/data/cores.json', 200, TYPES.json], ['/nope', 404, TYPES.json], ['/api/sheet', 200, TYPES.json]]) {
    const r = await get(worker, path, { BUCKET: bucket }, 'HEAD');
    assert.deepEqual([r.status, r.headers['content-type'], r.hasBody, r.text], [status, type, false, ''], path);
  }
  assert.equal(count('board'), 1); // HEAD /api/sheet still does the live read, like server.mjs
});

test('/api/sheet reads the live sheet with cache-busting and saves only a validated snapshot to R2', async (t) => {
  const { calls } = setup(t);
  const bucket = new FakeR2();
  const r = await get(await freshWorker(), '/api/sheet', { BUCKET: bucket });
  assert.equal(r.status, 200);
  assert.deepEqual([r.headers['content-type'], r.headers['cache-control']], [TYPES.json, 'no-store']);
  assert.deepEqual(calls.map((c) => c.kind).sort(), ['board', 'drafts', 'html']);
  for (const c of calls) {
    assert.ok(c.url.startsWith(`${PUB}/pub`), c.url);
    assert.match(c.url, /&_=\d+$/);
    assert.equal(c.init.redirect, 'follow');
    assert.ok(c.init.signal instanceof AbortSignal);
  }
  const L = buildLeague(RAW, dex);
  assert.equal(r.body.stale, false);
  assert.deepEqual(r.body.raw, RAW);
  assert.deepEqual(r.body.league, { coaches: L.coaches, warnings: L.warnings, unmatched: L.unmatched, taken: 44, boardSize: 257 });
  assert.ok(!Number.isNaN(Date.parse(r.body.fetchedAt)));
  assert.deepEqual([...bucket.objects.keys()], [SHEET_KEY]);
  assert.deepEqual(bucket.value(SHEET_KEY), { fetchedAt: r.body.fetchedAt, raw: RAW });
});

test('a failed sheet read is retried once before falling back', async (t) => {
  const { count } = setup(t, { board: (url, n) => (n === 1 ? leak() : LIVE.board()) });
  const r = await get(await freshWorker(), '/api/sheet', { BUCKET: new FakeR2() });
  assert.deepEqual([r.status, r.body.stale, count('board')], [200, false, 2]);
});

test('board colours are optional: their failure still gives a fresh read', async (t) => {
  setup(t, { html: DOWN.board });
  const bucket = new FakeR2();
  const r = await get(await freshWorker(), '/api/sheet', { BUCKET: bucket });
  assert.deepEqual([r.status, r.body.stale, r.body.raw.boardHtml], [200, false, null]);
  assert.ok(r.body.league.warnings.some((w) => w.startsWith('Board colours were not fetched')));
  assert.equal(bucket.value(SHEET_KEY).raw.boardHtml, null);
});

test('the last good snapshot survives into a new Worker instance and is served when the sheet is down', async (t) => {
  const up = setup(t);
  const bucket = new FakeR2();
  const first = await get(await freshWorker(), '/api/sheet', { BUCKET: bucket });
  t.mock.restoreAll();
  const down = setup(t, DOWN);
  const r = await get(await freshWorker(), '/api/sheet', { BUCKET: bucket });
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.stale, r.body.error, r.body.fetchedAt], [true, 'live sheet unavailable', first.body.fetchedAt]);
  assert.deepEqual(r.body.raw, RAW);
  assert.deepEqual(r.body.league, first.body.league);
  for (const s of ['HTTP 500', 'ECONNREFUSED', '/workspace', 'retry']) assert.ok(!r.text.includes(s), s); // the upstream error stays in the log
  assert.ok(down.logs.some((l) => l.includes('sheet FAILED') && l.includes('HTTP 500')));
  assert.equal(up.calls.length, 3);
});

test('an unrecognisable sheet (e.g. a Google sign-in page) never replaces the last good snapshot', async (t) => {
  setup(t);
  const bucket = new FakeR2();
  await get(await freshWorker(), '/api/sheet', { BUCKET: bucket });
  const saved = bucket.objects.get(SHEET_KEY);
  t.mock.restoreAll();
  setup(t, { board: () => new Response('<html>Sign in</html>') });
  const r = await get(await freshWorker(), '/api/sheet', { BUCKET: bucket });
  assert.deepEqual([r.status, r.body.stale], [200, true]);
  assert.equal(bucket.objects.get(SHEET_KEY), saved);
  assert.deepEqual(bucket.ops.filter((o) => o.startsWith('put')), [`put ${SHEET_KEY}`]);
  // and with nothing saved yet: a sanitized 502, still nothing written
  const empty = new FakeR2();
  const r2 = await get(await freshWorker(), '/api/sheet', { BUCKET: empty });
  assert.equal(r2.status, 502);
  assertSanitized(r2, UPSTREAM_DOWN);
  assert.equal(empty.objects.size, 0);
});

test('no sheet and no saved copy: a sanitized 502 with the details only in the server log', async (t) => {
  const { logs } = setup(t, DOWN);
  const r = await get(await freshWorker(), '/api/sheet', { BUCKET: new FakeR2() });
  assert.equal(r.status, 502);
  assert.equal(r.headers['content-type'], TYPES.json);
  assertSanitized(r, UPSTREAM_DOWN);
  assert.ok(logs.some((l) => l.includes('failed (502)') && l.includes('no saved copy')));
});

test('DRAFARIG_SHEET_URL and DRAFARIG_OFFLINE work as in server.mjs', async (t) => {
  const { calls } = setup(t);
  const bucket = new FakeR2();
  const base = 'https://docs.google.com/spreadsheets/d/e/2PACX-republished';
  const worker = await freshWorker();
  assert.equal((await get(worker, '/api/sheet', { BUCKET: bucket, DRAFARIG_SHEET_URL: base })).body.stale, false);
  assert.ok(calls.length === 3 && calls.every((c) => c.url.startsWith(`${base}/pub`)));
  const r = await get(worker, '/api/sheet', { BUCKET: bucket, DRAFARIG_OFFLINE: '1' });
  assert.deepEqual([r.body.stale, r.body.error, calls.length], [true, 'live sheet unavailable', 3]);
});

test('missing BUCKET binding: live data still works, nothing is cached, failures are a sanitized 502', async (t) => {
  const { logs, count } = setup(t);
  const worker = await freshWorker();
  assert.deepEqual([(await get(worker, '/api/sheet', {})).body.stale, (await get(worker, '/api/sheet', undefined)).body.stale], [false, false]);
  const u1 = await get(worker, '/api/usage', {}), u2 = await get(worker, '/api/usage', {});
  assert.deepEqual([u1.status, u2.status, u1.body.month, count('usage')], [200, 200, monthBack(1), 2]); // no cache -> refetched
  assert.equal(logs.filter((l) => l.includes('BUCKET is missing')).length, 1);
  t.mock.restoreAll();
  setup(t, DOWN);
  for (const path of ['/api/sheet', '/api/usage']) {
    const r = await get(worker, path, {});
    assert.equal(r.status, 502, path);
    assertSanitized(r, UPSTREAM_DOWN);
  }
  assert.equal((await get(worker, '/', {})).status, 200);
});

test('R2 read/write errors are never fatal and never leak', async (t) => {
  const { logs } = setup(t);
  const bucket = new FakeR2();
  bucket.failPut = true;
  const worker = await freshWorker();
  const s = await get(worker, '/api/sheet', { BUCKET: bucket });
  assert.deepEqual([s.status, s.body.stale], [200, false]); // a failed save does not turn fresh data stale
  assert.equal((await get(worker, '/api/usage', { BUCKET: bucket })).status, 200);
  assert.ok(logs.some((l) => l.includes(`cache write ${SHEET_KEY} failed`)));
  bucket.failPut = false; bucket.failGet = true;
  assert.equal((await get(worker, '/api/usage', { BUCKET: bucket })).body.month, monthBack(1)); // unreadable cache = refetch
  t.mock.restoreAll();
  setup(t, DOWN);
  for (const path of ['/api/sheet', '/api/usage']) {
    const r = await get(worker, path, { BUCKET: bucket });
    assert.equal(r.status, 502, path);
    assertSanitized(r, UPSTREAM_DOWN);
  }
});

test('/api/usage is fetched once, then served from R2 for 24 h across instances', async (t) => {
  const { calls, count } = setup(t);
  const bucket = new FakeR2();
  const expected = { month: monthBack(1), source: usageUrl(1), ...slimChaos(CHAOS) };
  const a = await get(await freshWorker(), '/api/usage', { BUCKET: bucket });
  assert.deepEqual([a.status, a.headers['cache-control']], [200, 'no-store']);
  assert.deepEqual(a.body, expected);
  assert.ok(!('cache' in calls[0].init) && calls[0].init.signal instanceof AbortSignal);
  assert.deepEqual([...bucket.objects.keys()], [USAGE_KEY]);
  assert.deepEqual(bucket.value(USAGE_KEY), expected);
  assert.deepEqual((await get(await freshWorker(), '/api/usage', { BUCKET: bucket })).body, expected);
  bucket.age(USAGE_KEY, 23 * 36e5);
  assert.deepEqual((await get(await freshWorker(), '/api/usage', { BUCKET: bucket })).body, expected);
  assert.equal(count('usage'), 1);
  bucket.age(USAGE_KEY, 36e5 + 1); // now just over 24 h old
  assert.deepEqual((await get(await freshWorker(), '/api/usage', { BUCKET: bucket })).body, expected);
  assert.equal(count('usage'), 2);
  assert.ok(Date.now() - bucket.objects.get(USAGE_KEY).uploaded < 1000); // refreshed
});

test('/api/usage falls back to the previous month, then to the stale copy, and never caches a bad result', async (t) => {
  setup(t, { usage: (url) => (url === usageUrl(2) ? Response.json(CHAOS) : new Response('Not Found', { status: 404 })) });
  const bucket = new FakeR2();
  const worker = await freshWorker();
  const prev = await get(worker, '/api/usage', { BUCKET: bucket });
  assert.deepEqual([prev.status, prev.body.month, prev.body.source], [200, monthBack(2), usageUrl(2)]);
  bucket.age(USAGE_KEY, 25 * 36e5);
  const saved = bucket.objects.get(USAGE_KEY);
  for (const bad of [() => new Response('<html>not json'), () => Response.json({}), () => Response.json(null), () => Response.json([1, 2]), DOWN.usage, leak]) {
    t.mock.restoreAll();
    setup(t, { usage: bad });
    const r = await get(worker, '/api/usage', { BUCKET: bucket });
    assert.deepEqual(r.body, { ...prev.body, stale: true });
    assert.equal(bucket.objects.get(USAGE_KEY), saved); // untouched, still expired
    const empty = new FakeR2();
    const e = await get(worker, '/api/usage', { BUCKET: empty });
    assert.equal(e.status, 502);
    assertSanitized(e, UPSTREAM_DOWN);
    assert.equal(empty.objects.size, 0);
  }
});

test('concurrent requests across instances share R2 safely: whole snapshots only, last writer wins', async (t) => {
  // Each live read returns a different (valid) Drafts tab, so every write is distinguishable.
  const variants = Array.from({ length: 12 }, (_, i) => RAW.draftsCsv.replace(',Points Left,29,', `,Points Left,${29 + i},`));
  const { count } = setup(t, { drafts: (url, n) => new Response(variants[(n - 1) % variants.length]) }, 4);
  const bucket = new FakeR2(4);
  const workers = await Promise.all([freshWorker(), freshWorker(), freshWorker()]);
  await get(workers[0], '/api/sheet', { BUCKET: bucket }); // something to fall back to
  const results = await Promise.all(Array.from({ length: 36 }, (_, i) => get(workers[i % 3], '/api/sheet',
    i % 2 ? { BUCKET: bucket, DRAFARIG_OFFLINE: '1' } : { BUCKET: bucket })));
  for (const [i, r] of results.entries()) {
    assert.equal(r.status, 200);
    assert.equal(r.body.stale, i % 2 === 1);
    assert.ok(variants.includes(r.body.raw.draftsCsv), 'a reader saw a partial or mixed snapshot');
    assert.deepEqual(r.body.raw.boardCsv, RAW.boardCsv);
  }
  const final = bucket.value(SHEET_KEY);
  assert.ok(variants.includes(final.raw.draftsCsv));
  assert.deepEqual(Object.keys(final), ['fetchedAt', 'raw']);
  assert.equal(count('drafts'), 19);
  // Cold usage cache hit by many instances at once: every response is complete, the cache ends valid.
  const usage = await Promise.all(Array.from({ length: 12 }, (_, i) => get(workers[i % 3], '/api/usage', { BUCKET: bucket })));
  const expected = { month: monthBack(1), source: usageUrl(1), ...slimChaos(CHAOS) };
  for (const r of usage) assert.deepEqual(r.body, expected);
  assert.deepEqual(bucket.value(USAGE_KEY), expected);
  assert.deepEqual([...bucket.objects.keys()].sort(), [SHEET_KEY, USAGE_KEY]);
  assert.ok(bucket.ops.every((o) => /^(get|put) /.test(o)));
});

test('build artifact: self-contained ESM, deterministic, Worker manifest with the same project id', () => {
  const bundle = read('dist/server/index.js').toString('utf8');
  assert.ok(!/^\s*import\b/m.test(bundle) && !bundle.includes('node:') && !/\brequire\(|\bprocess\./.test(bundle));
  assert.match(bundle, /^export default __worker_app\.createApp\(FILES\);$/m);
  assert.deepEqual(readdirSync(new URL('dist/', ROOT), { recursive: true }).sort(), ['.openai', '.openai/hosting.json', 'server', 'server/index.js']);
  assert.ok(read('dist/.openai/hosting.json').equals(read('.openai/hosting.json')));
  assert.deepEqual(JSON.parse(read('.openai/hosting.json')), { project_id: 'appgprj_6ac16dd56abc8191915b96602b56e117', r2: 'BUCKET' });
  const source = read('worker/app.mjs').toString('utf8');
  assert.deepEqual(source.match(/^import .+$/gm).map((l) => l.match(/'(.+)'/)[1]), ['../lib/sheet.mjs', '../lib/league.mjs', '../lib/usage.mjs']);
  // Safe-asset exposure: the embedded files are exactly public/, lib/, data/dex.json and data/cores.json.
  const files = bundle.slice(bundle.indexOf('\nconst FILES = {\n'), bundle.indexOf('\n};\n', bundle.indexOf('\nconst FILES = {\n')));
  const embedded = [...files.matchAll(/^ {2}("(?:[^"\\]|\\.)*"): /gm)].map((m) => JSON.parse(m[1])).sort();
  assert.deepEqual(embedded, ALLOWED_ASSETS);
  // only app file types ship (a stray report, patch or dotfile would fail here as well as in the build)
  for (const f of embedded) assert.match(f, /^lib\/[\w./-]+\.mjs$|^public\/[\w-]+\.(html|js|css|svg)$|^public\/vendor\/[\w.-]+\.(mjs|txt|json)$|^data\/(dex|cores|mechanics)\.json$/, f);
  const sha = () => createHash('sha256').update(read('dist/server/index.js')).digest('hex');
  const before = sha();
  execFileSync(process.execPath, [new URL('scripts/build.mjs', ROOT).pathname], { stdio: 'pipe' });
  assert.equal(sha(), before);
});

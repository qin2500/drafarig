// Drafarig as a Sites (Cloudflare Workers) app: the Worker version of server.mjs. Zero dependencies.
// scripts/build.mjs inlines this file and the lib/ modules it imports into dist/server/index.js, with the
// static files embedded (Sites Worker builds ship no asset files). Same routes as server.mjs:
//   public/ and lib/ (shared ES modules), data/dex.json, data/cores.json (the public Cores spec), data/mechanics.json
//   (the static Reg M-C projection the Prep calculator reads in the browser), and:
//   GET /api/sheet  live league sheet on every call (cache-busting); falls back to the last good snapshot in R2
//   GET /api/usage  Smogon chaos stats for gen9championsvgc2026regmc, slimmed + cached 24 h in R2
// The R2 binding BUCKET holds only those two JSON blobs and is never served. Without it the API still works,
// just with no fallback copy and no usage cache.
import { csvUrl, htmlUrl, GID, PUB } from '../lib/sheet.mjs';
import { buildLeague } from '../lib/league.mjs';
import { slimChaos } from '../lib/usage.mjs';

const log = (msg) => console.log(`${new Date().toISOString()} ${msg}`);
const FORMAT = 'gen9championsvgc2026regmc';
const SHEET_KEY = 'sheet-last-good.json';
const USAGE_KEY = `usage-${FORMAT}.json`;

// lib/sheet.mjs fetchText minus `cache: 'no-store'`, which Workers rejects on older compatibility dates;
// the per-call `&_=` cache-buster keeps every read live either way.
async function fetchText(url) {
  const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return r.text();
}

// R2 put() replaces an object atomically, so concurrent writers never leave a partial blob (no temp files).
// An unreadable or corrupt object counts as missing.
async function readCache(bucket, key) {
  try {
    const obj = await bucket?.get(key);
    return obj ? { value: await obj.json(), uploaded: obj.uploaded } : null;
  } catch (e) { log(`cache read ${key} failed: ${e.message || e}`); return null; }
}

// Never fatal: a failed save must not turn fresh data into an error or a stale copy.
async function writeCache(bucket, key, value) {
  if (!bucket) return;
  try { await bucket.put(key, JSON.stringify(value)); } catch (e) { log(`cache write ${key} failed: ${e.message || e}`); }
}

// Parsed league (no local aliases) for curl/debugging; the browser re-runs buildLeague with the user's aliases.
function withLeague(snap, dex) {
  const { board, coaches, warnings, unmatched } = buildLeague(snap.raw, dex);
  return { ...snap, league: { coaches, warnings, unmatched, taken: board.filter((b) => b.taken).length, boardSize: board.length } };
}

async function getSheet(env, dex) {
  // Optional override if the league re-publishes the sheet under a new link (the …/2PACX-… part, without /pub…).
  const sheet = env.DRAFARIG_SHEET_URL || PUB;
  const bust = () => `&_=${Date.now()}`;
  // Google occasionally takes 10 s+ to answer; one retry turns most of those into a fresh read instead of the fallback.
  const get = (url) => fetchText(url + bust()).catch((e) => { log(`sheet retry after: ${e.message || e}`); return fetchText(url + bust()); });
  const t0 = Date.now();
  try {
    if (env.DRAFARIG_OFFLINE) throw new Error('offline mode (DRAFARIG_OFFLINE is set)'); // for testing the fallback
    const [boardCsv, draftsCsv, boardHtml, pairingCsv] = await Promise.all([
      get(csvUrl(GID.board, sheet)),
      get(csvUrl(GID.drafts, sheet)),
      get(htmlUrl(GID.board, sheet)).catch(() => null), // colours are a cross-check only
      get(csvUrl(GID.pairing, sheet)).catch(() => null), // pairings are optional: the draft data never waits on them
    ]);
    const raw = { boardCsv, draftsCsv, boardHtml, pairingCsv };
    buildLeague(raw, dex); // throws if the layout is unrecognisable: never save a bad snapshot
    const snap = { fetchedAt: new Date().toISOString(), raw };
    await writeCache(env.BUCKET, SHEET_KEY, snap);
    const out = withLeague({ ...snap, stale: false }, dex);
    log(`sheet ok in ${Date.now() - t0} ms: ${out.league.coaches.reduce((s, c) => s + c.picks.length, 0)} picks${boardHtml ? '' : ' (board colours unavailable)'}`);
    return out;
  } catch (e) {
    log(`sheet FAILED after ${Date.now() - t0} ms, serving last good copy: ${e.message || e}`);
    try {
      const { value } = await readCache(env.BUCKET, SHEET_KEY); // no saved copy (null) throws into the 502 below
      return withLeague({ ...value, stale: true, error: 'live sheet unavailable' }, dex);
    } catch {
      const err = new Error(`Couldn't reach the league sheet and there is no saved copy yet: ${e.message || e}`);
      err.status = 502; throw err;
    }
  }
}

async function getUsage(env) {
  const cached = await readCache(env.BUCKET, USAGE_KEY);
  if (cached && Date.now() - cached.uploaded < 864e5) return cached.value;
  let lastErr;
  for (const back of [1, 2]) { // stats for month M are published early in month M+1
    const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - back);
    const month = d.toISOString().slice(0, 7);
    const url = `https://www.smogon.com/stats/${month}/chaos/${FORMAT}-1760.json`;
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (!r.ok) { lastErr = new Error(`HTTP ${r.status} for ${url}`); continue; }
      const out = { month, source: url, ...slimChaos(await r.json()) };
      if (!Object.keys(out.species).length) throw new Error(`no species in ${url}`); // never cache an empty table
      await writeCache(env.BUCKET, USAGE_KEY, out);
      return out;
    } catch (e) { lastErr = e; }
  }
  // Re-read rather than reuse `cached`: another request may have refreshed it meanwhile.
  const fallback = await readCache(env.BUCKET, USAGE_KEY);
  if (fallback) return { ...fallback.value, stale: true };
  const err = new Error(`Usage stats unavailable: ${lastErr?.message || lastErr}`); err.status = 502; throw err;
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8' };
// URL prefix -> embedded directory (keys of `files` are project-relative paths). lib/ is shared with the browser.
const STATIC = [['/lib/', 'lib'], ['/data/dex.json', 'data/dex.json'], ['/data/cores.json', 'data/cores.json'], ['/data/mechanics.json', 'data/mechanics.json'], ['/', 'public']];

// path.posix.normalize for the relative keys above, so the containment check below matches server.mjs.
function normalize(p) {
  const out = [];
  for (const seg of p.split('/')) {
    if (seg === '..') out.length && out.at(-1) !== '..' ? out.pop() : out.push('..');
    else if (seg && seg !== '.') out.push(seg);
  }
  return out.join('/') + (p.endsWith('/') ? '/' : '');
}

const json = (value, status, headers = {}) => new Response(JSON.stringify(value), { status, headers: { 'content-type': TYPES['.json'], ...headers } });

/** @param {Record<string, string>} files  project-relative path -> file text (public/**, lib/**, data/dex.json, data/cores.json, data/mechanics.json) */
export function createApp(files) {
  const FILES = new Map(Object.entries(files));
  let dex, warned = false;
  const API = {
    '/api/sheet': (env) => getSheet(env, dex ??= JSON.parse(FILES.get('data/dex.json'))),
    '/api/usage': getUsage,
  };

  async function route(request, env) {
    if (request.method !== 'GET' && request.method !== 'HEAD') return json({ error: 'Method not allowed' }, 405, { allow: 'GET, HEAD' });
    const url = new URL(request.url);
    try {
      if (API[url.pathname]) {
        if (!env.BUCKET && !warned) { warned = true; log('R2 binding BUCKET is missing: no last-good sheet fallback and no usage cache'); }
        return json(await API[url.pathname](env), 200, { 'cache-control': 'no-store' });
      }
      const [prefix, dir] = STATIC.find(([p]) => url.pathname === p || (p.endsWith('/') && url.pathname.startsWith(p)));
      const rel = decodeURIComponent(url.pathname.slice(prefix.length)) || (prefix === '/' ? 'index.html' : '');
      const file = rel ? normalize(`${dir}/${rel}`) : dir;
      if (file !== dir && !file.startsWith(dir + '/')) return new Response('Forbidden', { status: 403 });
      if (!FILES.has(file)) return json({ error: 'Not found' }, 404);
      const ext = file.match(/\.[^./]*$/)?.[0];
      return new Response(FILES.get(file), { headers: { 'content-type': TYPES[ext] || 'application/octet-stream', 'cache-control': 'no-store' } });
    } catch (e) {
      const status = e.status || 500;
      if (status >= 500) log(`${request.method} ${url.pathname}${url.search} failed (${status}): ${e.message || e}`);
      const message = status === 502 ? 'Upstream data unavailable. Please try again.' : 'Request could not be completed';
      return json({ error: message }, status);
    }
  }

  return {
    async fetch(request, env = {}) {
      const res = await route(request, env);
      return request.method === 'HEAD' ? new Response(null, { status: res.status, headers: res.headers }) : res;
    },
  };
}

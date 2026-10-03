// Drafarig local server. Zero dependencies. Run:  node server.mjs   (or npm start)
// Serves public/ and lib/ (shared ES modules), data/dex.json, and:
//   GET /api/sheet  live league sheet on every call (no-store + cache-busting); falls back to the last good snapshot
//   GET /api/usage  Smogon chaos stats for gen9championsvgc2026regmc, slimmed + cached 24 h in data/cache/
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, stat, rename } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fetchText, csvUrl, htmlUrl, GID, PUB } from './lib/sheet.mjs';
import { buildLeague } from './lib/league.mjs';
import { slimChaos } from './lib/usage.mjs';

const PORT = +process.env.PORT || 4600;
const HOST = '127.0.0.1';
const ROOT = new URL('.', import.meta.url).pathname;
const CACHE = join(ROOT, 'data', 'cache');
const FORMAT = 'gen9championsvgc2026regmc';
// Optional override if the league re-publishes the sheet under a new link (the …/2PACX-… part, without /pub…).
const SHEET = process.env.DRAFARIG_SHEET_URL || PUB;
const dex = JSON.parse(await readFile(join(ROOT, 'data', 'dex.json'), 'utf8'));

async function writeJson(file, value) { // atomic write
  await mkdir(CACHE, { recursive: true });
  await writeFile(file + '.tmp', JSON.stringify(value));
  await rename(file + '.tmp', file);
}

// Parsed league (no local aliases) for curl/debugging; the browser re-runs buildLeague with the user's aliases.
function withLeague(snap) {
  const { board, coaches, warnings, unmatched } = buildLeague(snap.raw, dex);
  return { ...snap, league: { coaches, warnings, unmatched, taken: board.filter((b) => b.taken).length, boardSize: board.length } };
}

async function getSheet() {
  const snapFile = join(CACHE, 'sheet-last-good.json');
  const bust = () => `&_=${Date.now()}`;
  try {
    if (process.env.DRAFARIG_OFFLINE) throw new Error('offline mode (DRAFARIG_OFFLINE is set)'); // for testing the fallback
    const [boardCsv, draftsCsv, boardHtml] = await Promise.all([
      fetchText(csvUrl(GID.board, SHEET) + bust()),
      fetchText(csvUrl(GID.drafts, SHEET) + bust()),
      fetchText(htmlUrl(GID.board, SHEET) + bust()).catch(() => null), // colours are a cross-check only
    ]);
    const raw = { boardCsv, draftsCsv, boardHtml };
    buildLeague(raw, dex); // throws if the layout is unrecognisable: never save a bad snapshot
    const snap = { fetchedAt: new Date().toISOString(), raw };
    await writeJson(snapFile, snap);
    return withLeague({ ...snap, stale: false });
  } catch (e) {
    try {
      const snap = JSON.parse(await readFile(snapFile, 'utf8'));
      return withLeague({ ...snap, stale: true, error: String(e.message || e) });
    } catch {
      const err = new Error(`Couldn't reach the league sheet and there is no saved copy yet: ${e.message || e}`);
      err.status = 502; throw err;
    }
  }
}

async function getUsage() {
  const file = join(CACHE, `usage-${FORMAT}.json`);
  try { if (Date.now() - (await stat(file)).mtimeMs < 864e5) return JSON.parse(await readFile(file, 'utf8')); } catch {}
  let lastErr;
  for (const back of [1, 2]) { // stats for month M are published early in month M+1
    const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - back);
    const month = d.toISOString().slice(0, 7);
    const url = `https://www.smogon.com/stats/${month}/chaos/${FORMAT}-1760.json`;
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (!r.ok) { lastErr = new Error(`HTTP ${r.status} for ${url}`); continue; }
      const out = { month, source: url, ...slimChaos(await r.json()) };
      await writeJson(file, out);
      return out;
    } catch (e) { lastErr = e; }
  }
  try { return { ...JSON.parse(await readFile(file, 'utf8')), stale: true }; } catch {}
  const err = new Error(`Usage stats unavailable: ${lastErr?.message || lastErr}`); err.status = 502; throw err;
}

const API = { '/api/sheet': getSheet, '/api/usage': getUsage };
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };
// URL prefix -> directory. lib/ is shared with the browser.
const STATIC = [['/lib/', join(ROOT, 'lib')], ['/data/dex.json', join(ROOT, 'data', 'dex.json')], ['/', join(ROOT, 'public')]];

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (API[url.pathname]) {
      const body = JSON.stringify(await API[url.pathname]());
      res.writeHead(200, { 'content-type': TYPES['.json'], 'cache-control': 'no-store' });
      return res.end(body);
    }
    const [prefix, dir] = STATIC.find(([p]) => url.pathname === p || (p.endsWith('/') && url.pathname.startsWith(p)));
    const rel = decodeURIComponent(url.pathname.slice(prefix.length)) || (prefix === '/' ? 'index.html' : '');
    const file = rel ? normalize(join(dir, rel)) : dir;
    if (file !== dir && !file.startsWith(dir + sep)) { res.writeHead(403); return res.end('Forbidden'); }
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(data);
  } catch (e) {
    const status = e.code === 'ENOENT' || e.code === 'EISDIR' ? 404 : e.status || 500;
    res.writeHead(status, { 'content-type': TYPES['.json'] });
    res.end(JSON.stringify({ error: String(e.message || e) }));
  }
}).listen(PORT, HOST, () => console.log(`Drafarig running at http://localhost:${PORT}  (Ctrl+C to stop)`));

// Zero-dependency localhost server prototype: static files + /api proxy.
// Run: node server-proto.mjs  (PORT env, default 5179)
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fetchText, csvUrl, htmlUrl, GID, parseBoardCsv, parseDraftsCsv, redNamesFromBoardHtml } from './sheet.mjs';
import { slim } from './slim-stats.mjs';

const PORT = +process.env.PORT || 5179;
const CACHE = new URL('./cache/', import.meta.url).pathname;
const PUBLIC = new URL('./public/', import.meta.url).pathname;
const FORMAT = 'gen9championsvgc2026regmc';

// Disk cache helper: refetch when older than ttlMs.
async function cached(name, ttlMs, produce) {
  const f = join(CACHE, name);
  try { if (Date.now() - (await stat(f)).mtimeMs < ttlMs) return JSON.parse(await readFile(f, 'utf8')); } catch {}
  const v = await produce(); await mkdir(CACHE, { recursive: true }); await writeFile(f, JSON.stringify(v)); return v;
}

const routes = {
  // Always live: every page load hits Google (requirement: fresh on every reload).
  '/api/sheet': async () => {
    const bust = `&_=${Date.now()}`;
    const [b, d, h] = await Promise.all([fetchText(csvUrl(GID.board) + bust), fetchText(csvUrl(GID.drafts) + bust),
      fetchText(htmlUrl(GID.board) + bust).catch(() => null)]);
    return { fetchedAt: new Date().toISOString(), board: parseBoardCsv(b), coaches: parseDraftsCsv(d), styled: h && redNamesFromBoardHtml(h) };
  },
  // Monthly data: cache 24h on disk. Month = previous calendar month (stats publish ~1st of month).
  '/api/usage': () => cached(`usage-${FORMAT}.json`, 864e5, async () => {
    for (const back of [1, 2]) {
      const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - back);
      const month = d.toISOString().slice(0, 7);
      const r = await fetch(`https://www.smogon.com/stats/${month}/chaos/${FORMAT}-1760.json`);
      if (r.ok) return { month, ...slim(await r.json()) };
    }
    throw new Error('no smogon stats found');
  }),
};

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (routes[url.pathname]) {
      const body = JSON.stringify(await routes[url.pathname]());
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      return res.end(body);
    }
    const p = normalize(join(PUBLIC, url.pathname === '/' ? 'index.html' : url.pathname));
    if (!p.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
    const data = await readFile(p);
    res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(data);
  } catch (e) {
    res.writeHead(e.code === 'ENOENT' ? 404 : 502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: String(e.message || e) }));
  }
}).listen(PORT, '127.0.0.1', () => console.log(`http://localhost:${PORT}`));

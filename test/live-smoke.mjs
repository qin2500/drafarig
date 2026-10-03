// Live read-only smoke test of the built Worker: real Google sheet + Smogon (public GETs only), in-memory R2,
// called in-process (no listener, nothing written to disk). Not part of `npm test`. Run: node test/live-smoke.mjs
const bucket = { objects: new Map(),
  async get(k) { const o = this.objects.get(k); return o ? { uploaded: o.uploaded, json: async () => JSON.parse(o.body) } : null; },
  async put(k, body) { this.objects.set(k, { body, uploaded: new Date() }); } };
const upstream = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if ('cache' in (init ?? {})) throw new TypeError("The 'cache' field on 'RequestInitializerDict' is not implemented.");
  const t0 = Date.now(), r = await realFetch(url, init), bytes = (await r.clone().arrayBuffer()).byteLength;
  upstream.push(`${r.status} ${bytes} B ${Date.now() - t0} ms ${String(url).replace(/2PACX-[\w-]+/, '2PACX-…').replace(/&_=\d+/, '&_=…')}`);
  return r;
};
const load = async (n) => (await import(new URL(`../dist/server/index.js?live=${n}`, import.meta.url))).default;
const call = async (worker, path) => {
  const t0 = Date.now(), res = await worker.fetch(new Request(`https://drafarig.example${path}`), { BUCKET: bucket }, {});
  const text = await res.text();
  return { status: res.status, ms: Date.now() - t0, kb: (text.length / 1024).toFixed(0), body: JSON.parse(text) };
};
console.log = () => {}; // Worker logs off; summary goes to stderr
const out = (...a) => process.stderr.write(a.join(' ') + '\n');

const a = await load(1);
const sheet = await call(a, '/api/sheet');
const L = sheet.body.league;
out(`/api/sheet ${sheet.status} in ${sheet.ms} ms, ${sheet.kb} KB: stale=${sheet.body.stale} coaches=${L?.coaches.length} picks=${L?.coaches.reduce((s, c) => s + c.picks.length, 0)} taken=${L?.taken}/${L?.boardSize} unmatched=${L?.unmatched.length} colours=${!!sheet.body.raw?.boardHtml} saved=${bucket.objects.has('sheet-last-good.json')}`);
const heap0 = process.memoryUsage().heapUsed;
const usage = await call(a, '/api/usage');
out(`/api/usage ${usage.status} in ${usage.ms} ms, ${usage.kb} KB: month=${usage.body.month} species=${Object.keys(usage.body.species ?? {}).length} stale=${!!usage.body.stale} heapΔ≈${((process.memoryUsage().heapUsed - heap0) / 2 ** 20).toFixed(0)} MB rss=${(process.memoryUsage().rss / 2 ** 20).toFixed(0)} MB error=${usage.body.error ?? '-'}`);
const n = upstream.length;
const b = await load(2);
const again = await call(b, '/api/usage');
const offline = await b.fetch(new Request('https://drafarig.example/api/sheet'), { BUCKET: bucket, DRAFARIG_OFFLINE: '1' }, {}).then((r) => r.json());
out(`new instance: /api/usage ${again.status} from R2=${upstream.length === n} same=${JSON.stringify(again.body) === JSON.stringify(usage.body)}; offline /api/sheet stale=${offline.stale} same snapshot=${offline.fetchedAt === sheet.body.fetchedAt}`);
out('upstream:\n  ' + upstream.join('\n  '));

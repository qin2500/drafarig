// Test helpers for the browser UI without a browser. Zero dependencies.
//   bootApp()   loads public/app.js against a stub DOM and the test fixtures, so a test can render a screen into #main
//               and run the real click / change handlers. It checks markup only: no layout, no pixels, no screenshots.
//   parseHtml() a small HTML tree for the markup app.js writes (double-quoted attributes, closed tags).
//   parseCss()  the rules of public/styles.css with their @media condition and source order.
import { readFileSync, existsSync } from 'node:fs';

const ROOT = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT));
const fx = (n) => read(`test/fixtures/${n}`).toString('utf8');
export const RAW = { boardCsv: fx('board.csv'), draftsCsv: fx('drafts.csv'), boardHtml: fx('board.html') };
export const FETCHED_AT = '2026-10-03T12:00:00.000Z';

class El {
  constructor(id = '') {
    const cls = new Set();
    Object.assign(this, { id, textContent: '', innerHTML: '', className: '', title: '', hidden: false, checked: false, value: '', dataset: {} });
    this.style = { setProperty() {} };
    this.classList = { add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c), toggle: (c, on = !cls.has(c)) => (on ? cls.add(c) : cls.delete(c)) };
  }
  focus() {}
  setSelectionRange() {}
  getBoundingClientRect() { return { left: 0, top: 0, bottom: 0, height: 100 }; }
}

let instances = 0;

/**
 * Boots public/app.js (or `source`, the text of another version of it) in this process with stub globals. Resolves once the
 * first screen is rendered and the usage request has settled. Returns { main, drawer, toast, click, change, clipboard, html }.
 * mode: the deep-link hash; narrow: what matchMedia('(max-width: 767px)') reports; files: extra (or replacement) fetchable
 * paths. data/dex.json and, when it exists, data/cores.json are served from the repo.
 */
export async function bootApp({ source = read('public/app.js').toString('utf8'), mode = 'draft', narrow = true, files = {} } = {}) {
  const els = Object.fromEntries(['#sync', '#turn', '#budget', '#coach', '#banners', '#main', '#explain', '#drawer', '#pop', '#toast', '.layout', '.topbar', '#bq']
    .map((s) => [s, new El(s.slice(1))]));
  const listeners = {};
  const clipboard = [];
  const storage = new Map();
  const served = { '/data/dex.json': read('data/dex.json').toString('utf8'), ...files };
  if (!('/data/cores.json' in served) && existsSync(new URL('data/cores.json', ROOT))) served['/data/cores.json'] = read('data/cores.json').toString('utf8');
  const respond = (body, status = 200) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const stubs = {
    document: {
      hidden: false, activeElement: null, body: new El('body'), documentElement: new El('html'),
      querySelector: (s) => els[s] ?? null, querySelectorAll: () => [], getElementById: () => null,
      addEventListener: (type, fn) => (listeners[type] ??= []).push(fn),
    },
    window: { scrollY: 0, scrollTo() {} },
    localStorage: { getItem: (k) => (storage.has(k) ? storage.get(k) : null), setItem: (k, v) => storage.set(k, String(v)) },
    location: { hash: `#${mode}`, reload() {} },
    history: { replaceState() {} },
    navigator: { clipboard: { writeText: async (t) => { clipboard.push(t); } } },
    CSS: { escape: (s) => String(s).replace(/["\\]/g, '\\$&') },
    matchMedia: () => ({ matches: narrow, addEventListener() {} }),
    addEventListener() {},
    innerWidth: 390, innerHeight: 844,
    prompt() {},
    setInterval: () => 0, // the app's 15 s / 45 s refresh timers would keep the test process alive
    fetch: async (url) => {
      const path = String(url);
      if (path === '/api/sheet') return respond({ fetchedAt: FETCHED_AT, stale: false, raw: RAW });
      if (path === '/api/usage') return respond({ error: 'Upstream data unavailable. Please try again.' }, 502);
      return path in served ? respond(served[path]) : respond({ error: 'Not found' }, 404);
    },
  };
  const saved = Object.fromEntries(Object.keys(stubs).map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  for (const [k, value] of Object.entries(stubs)) Object.defineProperty(globalThis, k, { value, configurable: true, writable: true });
  const restore = () => {
    for (const [k, d] of Object.entries(saved)) { if (d) Object.defineProperty(globalThis, k, d); else delete globalThis[k]; }
  };

  // The browser resolves /lib/… and /glossary.js against the site root; here they point at the repo files.
  const src = source.replace(/from '\/lib\/([\w-]+\.mjs)'/g, (_, f) => `from '${new URL(`lib/${f}`, ROOT).href}'`)
    .replace(/from '\/glossary\.js'/g, `from '${new URL('public/glossary.js', ROOT).href}'`);
  if (/from '\//.test(src)) throw new Error('ui-harness: app.js has an import this harness does not map');
  const settle = async (n = 50) => { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); };
  try {
    await import(`data:text/javascript;base64,${Buffer.from(`${src}\n// instance ${++instances}\n`).toString('base64')}`);
    for (let i = 0; i < 2000 && els['#main'].innerHTML.length === 0; i++) await settle(1);
    await settle(); // the usage request re-renders once it settles
  } catch (e) { restore(); throw e; }

  // A fake event target for the delegated handlers: closest() returns the "button" itself.
  const target = ({ id = '', classes = [], ...dataset }) => {
    const t = new El(id);
    t.dataset = dataset;
    for (const c of classes) t.classList.add(c);
    return t;
  };
  return {
    main: els['#main'], drawer: els['#drawer'], toast: els['#toast'], clipboard,
    html: () => els['#main'].innerHTML,
    async click(attrs) { const t = target(attrs); for (const fn of listeners.click ?? []) await fn({ target: { closest: () => t } }); await settle(5); },
    async change(id, props) { const t = Object.assign(new El(id), props); for (const fn of listeners.change ?? []) fn({ target: t }); await settle(5); },
    restore,
  };
}

// ---------- HTML ----------
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" };
export const decode = (s) => s.replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => ENT[e]);

/** Element nodes {tag, attrs, children, parent}; text nodes {text}. Unmatched end tags close up to their opener. */
export function parseHtml(html) {
  const root = { tag: '#root', attrs: {}, children: [], parent: null };
  let cur = root;
  const re = /<!--[\s\S]*?-->|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*\/?>|([^<]+)/g;
  for (const m of html.matchAll(re)) {
    if (m[4] !== undefined) cur.children.push({ text: decode(m[4]), parent: cur });
    else if (m[2]) {
      const attrs = {};
      for (const a of m[3].matchAll(/([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) attrs[a[1]] = decode(a[2] ?? a[3] ?? a[4] ?? '');
      const node = { tag: m[2].toLowerCase(), attrs, children: [], parent: cur };
      cur.children.push(node);
      if (!VOID.has(node.tag)) cur = node;
    } else if (m[1]) {
      const tag = m[1].toLowerCase();
      for (let x = cur; x !== root; x = x.parent) if (x.tag === tag) { cur = x.parent; break; }
    }
  }
  return root;
}
export const classes = (n) => (n.attrs?.class ?? '').split(/\s+/).filter(Boolean);
export const hasClass = (n, c) => classes(n).includes(c);
export function findAll(n, pred, out = []) {
  for (const c of n.children ?? []) { if (c.tag && pred(c)) out.push(c); findAll(c, pred, out); }
  return out;
}
export const find = (n, pred) => findAll(n, pred)[0] ?? null;
export const text = (n) => (n.text ?? (n.children ?? []).map(text).join(''));
export const ancestors = (n) => { const out = []; for (let x = n.parent; x; x = x.parent) out.push(x); return out; };

// ---------- CSS ----------
/** [{media, selectors, decls, index}]: style rules in source order; media is the @media condition (null at top level). */
export function parseCss(css) {
  const rules = [];
  const walk = (body, media) => {
    let i = 0;
    while (i < body.length) {
      const open = body.indexOf('{', i);
      if (open < 0) break;
      let depth = 1, j = open + 1;
      for (; depth && j < body.length; j++) depth += body[j] === '{' ? 1 : body[j] === '}' ? -1 : 0;
      const prelude = body.slice(i, open).trim(), inner = body.slice(open + 1, j - 1);
      if (prelude.startsWith('@media')) walk(inner, prelude.slice(6).trim());
      else if (!prelude.startsWith('@')) {
        const decls = {};
        for (const d of inner.split(';')) { const k = d.indexOf(':'); if (k > 0) decls[d.slice(0, k).trim()] = d.slice(k + 1).trim(); }
        rules.push({ media, selectors: prelude.split(',').map((s) => s.trim().replace(/\s+/g, ' ')), decls, index: rules.length });
      }
      i = j;
    }
  };
  walk(css.replace(/\/\*[\s\S]*?\*\//g, ''), null);
  return rules;
}

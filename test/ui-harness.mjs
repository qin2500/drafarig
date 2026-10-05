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
  click() { El.clicked?.(this); }
  remove() {}
}

/**
 * A Storage with the browser's interface (getItem, setItem, removeItem, key, length). quota: a character budget past
 * which setItem throws a QuotaExceededError, as browsers do. Shared by tests that drive lib/prep-store directly.
 */
export function memoryStorage(seed = {}, { quota = Infinity } = {}) {
  const m = new Map(Object.entries(seed));
  const used = () => [...m].reduce((t, [k, v]) => t + k.length + v.length, 0);
  return {
    map: m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem(k, v) {
      const before = m.get(k);
      m.set(k, String(v));
      if (used() > quota) { if (before === undefined) m.delete(k); else m.set(k, before); const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; }
    },
    removeItem: (k) => { m.delete(k); },
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
    clear: () => m.clear(),
  };
}

let instances = 0;

/**
 * Boots public/app.js (or `source`, the text of another version of it) in this process with stub globals. Resolves once the
 * first screen is rendered and the usage request has settled. Returns { main, drawer, toast, click, change, input, clipboard,
 * html, storage, history, location, fetches, downloads, waitFor, fire }.
 * mode: the deep-link hash (without '#'); narrow: what matchMedia('(max-width: 767px)') reports; files: extra (or
 * replacement) fetchable paths; storage: a memoryStorage to start from (prep documents); sheet: false makes /api/sheet fail;
 * raw: the sheet's {boardCsv, draftsCsv, boardHtml} (default: the fixtures).
 * data/dex.json, data/mechanics.json and, when it exists, data/cores.json are served from the repo.
 */
export async function bootApp({ root = ROOT, source = readFileSync(new URL('public/app.js', root)).toString('utf8'), mode = 'draft', narrow = true, files = {}, storage = memoryStorage(), session = memoryStorage(), sheet = true, raw = RAW, clipboardText = null } = {}) {
  const els = Object.fromEntries(['#sync', '#turn', '#budget', '#coach', '#banners', '#main', '#explain', '#drawer', '#pop', '#toast', '.layout', '.topbar', '#bq', '.oppstrip ol']
    .map((s) => [s, new El(s.slice(1))]));
  // the opponent row's scroller: geometry a test can set (no layout here), and the current tab it finds
  Object.assign(els['.oppstrip ol'], { scrollLeft: 0, clientWidth: 300, current: null, querySelector: (sel) => (sel === '[aria-current="page"]' ? els['.oppstrip ol'].current : null) });
  let sheetRaw = raw;
  const listeners = {}, winListeners = {};
  const clipboard = [], fetches = [], downloads = [];
  const served = { '/data/dex.json': read('data/dex.json').toString('utf8'), '/data/mechanics.json': read('data/mechanics.json').toString('utf8'), ...files };
  if (!('/data/cores.json' in served) && existsSync(new URL('data/cores.json', ROOT))) served['/data/cores.json'] = read('data/cores.json').toString('utf8');
  const respond = (body, status = 200) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const settle = async (n = 50) => { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); };
  const fire = async (type, ev = {}) => { for (const fn of winListeners[type] ?? []) fn({ type, ...ev }); await settle(5); };
  const fireDoc = async (type, ev = {}) => { for (const fn of listeners[type] ?? []) await fn({ type, ...ev }); await settle(5); };
  // history as a stack of {state, hash}; back() moves the hash and fires popstate like a browser.
  const location = { hash: `#${mode}`, reload() {} };
  const stack = [{ state: null, hash: location.hash }];
  let at = 0;
  const history = {
    get state() { return stack[at].state; },
    get length() { return stack.length; },
    entries: () => stack.map((e) => e.hash),
    replaceState(state, _t, url) { stack[at] = { state, hash: url ?? stack[at].hash }; location.hash = stack[at].hash; },
    pushState(state, _t, url) { stack.splice(at + 1); stack.push({ state, hash: url }); at++; location.hash = url; },
    back() { if (at > 0) { at--; location.hash = stack[at].hash; setImmediate(() => fire('popstate', { state: stack[at].state })); } },
    forward() { if (at < stack.length - 1) { at++; location.hash = stack[at].hash; setImmediate(() => fire('popstate', { state: stack[at].state })); } },
  };
  El.clicked = (el) => { if (el.download) downloads.push({ name: el.download, url: el.href }); };
  const body = new El('body');
  body.appendChild = () => {};
  const stubs = {
    document: {
      hidden: false, activeElement: null, body, documentElement: new El('html'),
      querySelector: (s) => els[s] ?? null, querySelectorAll: () => [], getElementById: () => null,
      createElement: () => new El(),
      addEventListener: (type, fn) => (listeners[type] ??= []).push(fn),
    },
    window: { scrollY: 0, scrollTo() {} },
    localStorage: storage, sessionStorage: session,
    location, history,
    navigator: { clipboard: { writeText: async (t) => { clipboard.push(t); }, ...(clipboardText !== null ? { readText: async () => clipboardText } : {}) } },
    CSS: { escape: (s) => String(s).replace(/["\\]/g, '\\$&') },
    matchMedia: () => ({ matches: narrow, addEventListener() {} }),
    addEventListener: (type, fn) => (winListeners[type] ??= []).push(fn),
    innerWidth: 390, innerHeight: 844,
    prompt() {},
    setInterval: () => 0, // the app's 15 s / 45 s refresh timers would keep the test process alive
    fetch: async (url, init) => {
      const path = String(url);
      fetches.push({ path, method: init?.method ?? 'GET', body: init?.body ?? null });
      if (path === '/api/sheet') return sheet ? respond({ fetchedAt: FETCHED_AT, stale: false, raw: sheetRaw }) : respond({ error: 'Sheet unreachable' }, 502);
      if (path === '/api/usage') return respond({ error: 'Upstream data unavailable. Please try again.' }, 502);
      return path in served ? respond(served[path]) : respond({ error: 'Not found' }, 404);
    },
  };
  const saved = Object.fromEntries(Object.keys(stubs).map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  for (const [k, value] of Object.entries(stubs)) Object.defineProperty(globalThis, k, { value, configurable: true, writable: true });
  const restore = () => {
    for (const [k, d] of Object.entries(saved)) { if (d) Object.defineProperty(globalThis, k, d); else delete globalThis[k]; }
  };

  // The browser resolves /lib/…, /glossary.js and the lazily loaded /prep.js against the site root; here they point at
  // the repo files (prep.js's own imports are relative, so they resolve from its file URL).
  // root: another copy of the app's tree (e.g. the published v3, for old-client tests); data files still come from the repo
  const src = source.replace(/from '\/lib\/([\w-]+\.mjs)'/g, (_, f) => `from '${new URL(`lib/${f}`, root).href}'`)
    .replace(/from '\/glossary\.js'/g, `from '${new URL('public/glossary.js', root).href}'`)
    .replace(/import\('\/prep\.js'\)/g, `import('${new URL('public/prep.js', root).href}')`);
  if (/from '\/|import\('\//.test(src)) throw new Error('ui-harness: app.js has an import this harness does not map');
  const waitFor = async (pred, what = 'condition', ms = 10000) => {
    const end = Date.now() + ms;
    while (!pred()) { if (Date.now() > end) throw new Error(`ui-harness: timed out waiting for ${what}`); await new Promise((r) => setTimeout(r, 5)); }
    await settle(5);
  };
  try {
    await import(`data:text/javascript;base64,${Buffer.from(`${src}\n// instance ${++instances}\n`).toString('base64')}`);
    for (let i = 0; i < 2000 && els['#main'].innerHTML.length === 0; i++) await settle(1);
    await settle(); // the usage request re-renders once it settles
    if (mode === 'prep' || mode.startsWith('prep/')) await waitFor(() => /class="prep"|Prep couldn't load/.test(els['#main'].innerHTML), 'Prep to load');
  } catch (e) { restore(); throw e; }

  // A fake event target for the delegated handlers: closest() returns the "button" itself.
  const target = ({ id = '', classes = [], ...dataset }) => {
    const t = new El(id);
    t.dataset = dataset;
    for (const c of classes) t.classList.add(c);
    return t;
  };
  return {
    main: els['#main'], drawer: els['#drawer'], toast: els['#toast'], banners: els['#banners'], body, clipboard, storage, session, history, location, fetches, downloads,
    html: () => els['#main'].innerHTML,
    async click(attrs) { const t = target(attrs); for (const fn of listeners.click ?? []) await fn({ target: { closest: () => t } }); await settle(5); },
    async change(id, props) { const t = Object.assign(new El(id), props); for (const fn of listeners.change ?? []) fn({ target: t }); await settle(5); },
    /** An input event on a prep field: input('paste-text', 'text…', {set: 'set_…'}) → data-pi plus extra data-*. */
    async input(pi, value, data = {}) { const t = Object.assign(new El(), { value }); t.dataset = { pi, ...data }; for (const fn of listeners.input ?? []) fn({ target: t }); await settle(5); },
    /** The same element firing change (a select or a committed field): pc for data-pc, or pi for data-pi. */
    async changeData(data, props = {}) { const t = Object.assign(new El(), props); t.dataset = data; for (const fn of listeners.change ?? []) fn({ target: t }); await settle(5); },
    async visibility(hidden) { stubs.document.hidden = hidden; for (const fn of listeners.visibilitychange ?? []) fn({}); await settle(5); },
    waitFor, fire, fireDoc, settle,
    /** What /api/sheet returns from now on (the league sheet changing while the page is open). */
    setSheet(r) { sheetRaw = r; },
    /** A stub element the app looks up by selector (e.g. '.oppstrip ol'). */
    el: (sel) => els[sel] ?? null,
    /** A keydown on the document (Escape, arrows), with an optional target. */
    async key(key, target = null) { for (const fn of listeners.keydown ?? []) fn({ key, target, preventDefault() {} }); await settle(5); },
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

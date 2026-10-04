// Prep mode controller (browser). Owns device-local prep documents, autosave with revision checks, routes, and the
// screens. Screens live in prep-*.js modules; pure logic lives in /lib. Nothing here sends prep anywhere: no fetch, no
// beacons, no URLs with data. The only dynamic import is the vendored damage engine (prep-engine.js).
import { parseRoute, formatRoute, parentRoute, navKind } from '../lib/prep-route.mjs';
import { KEYS, wsKey, newId, emptyMeta, emptyRules, emptyMySets, emptyPilot, newWorkspace, typeOfKey, forbiddenKey, SCHEMA_VERSION } from '../lib/prep-schema.mjs';
import { createStore, USAGE_BUDGET_CHARS, isPrepKey } from '../lib/prep-store.mjs';
import { makeBackup, readBackup, planRestore, opponentDocs } from '../lib/prep-backup.mjs';
import { loadMechanics } from '../lib/calc/mech.mjs';
import { createCalc } from '../lib/calc/wrapper.mjs';
import { currentVersion, versionOf, rosterDiff } from '../lib/prep-model.mjs';
import { staleReasons } from '../lib/calc/keys.mjs';
import { ENGINE_INFO, importEngine } from './prep-engine.js';
import * as C from './prep-copy.js';
import { esc, btn, h2, select, term } from './prep-ui.js';
import * as Sets from './prep-sets.js';
import * as Calcs from './prep-calcs.js';
import * as Plan from './prep-plan.js';
import * as Practice from './prep-practice.js';

const SAVE_DELAY = 400;
const TAB_LABEL = { plan: 'Plan', sets: 'Sets', calcs: 'Calcs', practice: 'Practice' };
const MODULES = [Sets, Calcs, Plan, Practice];

/**
 * app: { dex, league(), sheet(), usage(), coresCx(), viewingCoach(), setViewingCoach(name), goMode(mode), toast(msg),
 * rerender(), storage, crypto, history, location, now(), loadMechanics() -> Promise<json>, download(name, text, type),
 * copyText(text) -> Promise, readClipboard() -> Promise<string>, persist: {persisted(), persist()} | null, appBuild }
 */
export function createPrep(app) {
  const P = {
    app, store: createStore(app.storage), docs: {}, ws: new Map(), revs: new Map(), saveIds: new Map(), dirty: new Set(), route: { view: 'home' },
    mech: null, mechState: 'idle', calc: null, engineState: 'idle', ui: { ws: {} }, saveState: 'saved', saveError: null,
    conflicts: new Set(), corrupt: new Map(), newer: new Set(), pendingFocus: false, timer: null, persisted: null, lastRestore: null,
  };
  P.now = () => app.now();
  P.id = (prefix) => newId(prefix, (a) => app.crypto.getRandomValues(a));
  P.toast = (m) => app.toast(m);
  P.esc = esc;
  P.C = C;
  P.readOnly = () => P.newer.size > 0;

  // ---------- load ----------
  function loadDoc(key, fallback) {
    const r = P.store.load(key);
    P.saveIds.set(key, r.doc?.saveId ?? null);
    if (r.status === 'ok') { P.revs.set(key, r.doc.rev); if (r.migrated) P.dirty.add(key); return r.doc; }
    if (r.status === 'missing') { P.revs.set(key, null); return fallback(); }
    if (r.status === 'newer') { P.newer.add(key); P.revs.set(key, r.doc.rev); return r.doc; }
    if (r.status === 'corrupt') { P.corrupt.set(key, { raw: r.raw, errors: r.errors }); P.revs.set(key, 'corrupt'); return fallback(); }
    P.saveError = { code: 'error' }; P.revs.set(key, null); return fallback();
  }
  P.init = () => {
    P.ws.clear(); P.revs.clear(); P.saveIds.clear(); P.dirty.clear(); P.corrupt.clear(); P.newer.clear(); P.conflicts.clear();
    const now = P.now();
    P.docs.meta = loadDoc(KEYS.meta, () => emptyMeta(now));
    P.docs.rules = loadDoc(KEYS.rules, () => emptyRules(now));
    P.docs.mysets = loadDoc(KEYS.mysets, emptyMySets);
    P.docs.pilot = loadDoc(KEYS.pilot, emptyPilot);
    for (const key of P.store.keys()) {
      if (typeOfKey(key) !== 'ws') continue;
      const d = loadDoc(key, () => null);
      if (d) P.ws.set(d.id, d);
    }
    // the workspace index follows what is actually stored
    const listed = new Map((P.docs.meta.workspaces ?? []).map((w) => [w.id, w]));
    const idx = [...P.ws.values()].map((w) => ({ id: w.id, coach: w.coach, updatedAt: w.updatedAt, archived: false, ...(listed.get(w.id) ?? {}) }));
    if (JSON.stringify(idx.map((w) => w.id).sort()) !== JSON.stringify([...listed.keys()].sort())) { P.docs.meta = { ...P.docs.meta, workspaces: idx }; P.dirty.add(KEYS.meta); }
    if (P.dirty.size) flush();
  };

  // ---------- save ----------
  const keyOf = (which) => (which.startsWith('ws:') ? wsKey(which.slice(3)) : KEYS[which]);
  const docFor = (key) => (key === KEYS.meta ? P.docs.meta : key === KEYS.rules ? P.docs.rules : key === KEYS.mysets ? P.docs.mysets : key === KEYS.pilot ? P.docs.pilot : P.ws.get(key.slice(wsKey('').length)));
  const setDoc = (key, d) => { if (key === KEYS.meta) P.docs.meta = d; else if (key === KEYS.rules) P.docs.rules = d; else if (key === KEYS.mysets) P.docs.mysets = d; else if (key === KEYS.pilot) P.docs.pilot = d; else P.ws.set(d.id, d); };
  /** Apply a change to a document (on a deep copy) and schedule an autosave. which: meta | rules | mysets | pilot | 'ws:<id>'. */
  P.mutate = (which, fn, { substantive = true, render = true } = {}) => {
    if (P.readOnly()) { P.toast(C.SAVE.newer); return false; }
    const key = keyOf(which);
    if (P.conflicts.has(key)) { P.toast(C.SAVE.conflict({ what: 'This prep' })); return false; }
    const cur = docFor(key);
    if (!cur) return false;
    // "Undo restore" / "Undo" (a delete) would now also undo this change: they are no longer offered
    P.lastRestore = null;
    const hadUndo = !!P.ui.undo && !P.undoing;
    if (hadUndo) P.ui.undo = null;
    const d = structuredClone(cur);
    const out = fn(d) ?? d;
    if (key.startsWith(wsKey(''))) out.updatedAt = P.now();
    setDoc(key, out);
    P.dirty.add(key);
    if (substantive && key !== KEYS.meta) {
      P.docs.meta = { ...P.docs.meta, changesSinceBackup: (P.docs.meta.changesSinceBackup ?? 0) + 1 };
      if (key.startsWith(wsKey(''))) P.docs.meta.workspaces = P.docs.meta.workspaces.map((w) => (w.id === out.id ? { ...w, updatedAt: out.updatedAt } : w));
      P.dirty.add(KEYS.meta);
    }
    schedule();
    if (render || hadUndo) app.rerender(); // the withdrawn Undo banner goes at once (typing keeps its caret)
    return true;
  };
  function schedule() { P.saveState = 'saving'; clearTimeout(P.timer); P.timer = setTimeout(flush, SAVE_DELAY); }
  function flush() {
    clearTimeout(P.timer);
    const keys = [...P.dirty].sort((a, b) => (a === KEYS.meta) - (b === KEYS.meta)); // meta last
    let failed = null;
    for (const key of keys) {
      const doc = docFor(key);
      if (!doc) { P.dirty.delete(key); continue; }
      if (P.revs.get(key) === 'corrupt') { failed = { code: 'corrupt', key }; continue; } // never overwrite unread data
      if (P.conflicts.has(key)) { failed = { code: 'conflict', key }; continue; } // never overwrite the other tab's version
      const res = P.store.save(key, doc, P.revs.get(key) ?? null);
      if (res.ok) { P.revs.set(key, res.doc.rev); P.saveIds.set(key, res.doc.saveId); setDoc(key, res.doc); P.dirty.delete(key); }
      else { failed = { code: res.code, key }; if (res.code === 'conflict') P.conflicts.add(key); if (res.code === 'newer') P.newer.add(key); }
    }
    P.saveState = failed ? 'error' : 'saved';
    const before = P.saveError;
    P.saveError = failed;
    if (failed || before) app.rerender();
  }
  P.flush = flush;
  // Another tab saved a prep document. If this tab has no unsaved edits to it, take that version quietly; if it does,
  // keep both untouched and say so (conflict banner). The shared index (meta) is merged instead, so two tabs working on
  // different opponents never block each other.
  const fallbackFor = (key) => ({ [KEYS.meta]: () => emptyMeta(P.now()), [KEYS.rules]: () => emptyRules(P.now()), [KEYS.mysets]: emptyMySets, [KEYS.pilot]: emptyPilot }[key]);
  function adopt(key) {
    const type = typeOfKey(key);
    const r = P.store.load(key);
    P.corrupt.delete(key); P.newer.delete(key); P.conflicts.delete(key);
    P.saveIds.set(key, r.doc?.saveId ?? null);
    // another tab's change is now part of what's here: undoing a delete or a restore could overwrite it
    P.ui.undo = null; P.lastRestore = null;
    if (r.status === 'missing') {
      if (type === 'ws') P.ws.delete(key.slice(wsKey('').length)); else setDoc(key, fallbackFor(key)());
      P.revs.set(key, null);
    } else if (r.status === 'ok' || r.status === 'newer') {
      if (r.status === 'newer') P.newer.add(key);
      P.revs.set(key, r.doc.rev); setDoc(key, r.doc);
    } else if (r.status === 'corrupt') { P.corrupt.set(key, { raw: r.raw, errors: r.errors }); P.revs.set(key, 'corrupt'); }
  }
  function mergeMeta(theirs, ours) {
    const stored = (id) => P.store.raw(wsKey(id)) !== null;
    const byId = new Map(theirs.workspaces.filter((w) => stored(w.id)).map((w) => [w.id, w]));
    for (const w of ours.workspaces) if (stored(w.id) && (!byId.has(w.id) || (w.updatedAt ?? '') > (byId.get(w.id).updatedAt ?? ''))) byId.set(w.id, w);
    const later = (a, b) => ((a ?? '') > (b ?? '') ? a : b);
    return { ...theirs, workspaces: [...byId.values()], changesSinceBackup: Math.max(theirs.changesSinceBackup ?? 0, ours.changesSinceBackup ?? 0),
      lastBackupAt: later(theirs.lastBackupAt, ours.lastBackupAt), myCoach: ours.myCoachConfirmed ? ours.myCoach : theirs.myCoach, myCoachConfirmed: theirs.myCoachConfirmed || ours.myCoachConfirmed };
  }
  P.onStorage = (e) => {
    // "Delete all" in another tab: this tab's unfinished drafts go too
    if (e && e.key === KEYS.meta && e.newValue === null && !P.dirty.size) { P.ui = { ws: {} }; P.saveUi(); }
    if (!e || !isPrepKey(e.key) || !typeOfKey(e.key)) return;
    const key = e.key;
    let doc = null;
    try { doc = e.newValue ? JSON.parse(e.newValue) : null; } catch { doc = { rev: 'corrupt' }; }
    if (doc?.saveId && doc.saveId === P.saveIds.get(key)) return; // our own write
    if (!doc && P.revs.get(key) === null) return;
    // Same or older revision written by another tab: it saved over (or alongside) this tab's last save.
    const mine = P.revs.get(key);
    const collided = Number.isInteger(doc?.rev) && Number.isInteger(mine) && doc.rev <= mine && !P.dirty.has(key);
    if ((P.dirty.has(key) || collided) && key === KEYS.meta) {
      const r = P.store.load(key);
      if (r.status === 'ok') { P.docs.meta = mergeMeta(r.doc, P.docs.meta); P.revs.set(key, r.doc.rev); P.saveIds.set(key, r.doc.saveId ?? null); P.dirty.add(key); schedule(); return; }
    }
    if (collided) P.dirty.add(key); // keep this tab's version: it can still be downloaded (banner)
    if (P.dirty.has(key)) { P.conflicts.add(key); app.rerender(); return; }
    adopt(key);
    if (P.route.view === 'ws' && key === wsKey(P.route.wsId)) P.toast('Updated from another tab');
    app.rerender();
  };
  // Unfinished screen work (brief, paste text, revision draft, calc setup, pilot text) lives in P.ui. It is kept in this
  // tab's session storage when the page is hidden, so a phone discarding the tab (e.g. while you copy from Showdown)
  // doesn't lose it. Computed results and restore files are left out.
  const UI_KEY = 'drafarig.prep.ui';
  const UI_SKIP = new Set(['result', 'resultFor', 'others', 'preview', 'backup', 'undo']);
  try {
    const saved = JSON.parse(app.session?.getItem(UI_KEY) ?? 'null');
    if (saved && typeof saved === 'object' && saved.ws && typeof saved.ws === 'object' && !forbiddenKey(saved)) P.ui = { ...saved, ws: { ...saved.ws } };
  } catch { /* unreadable: start fresh */ }
  P.saveUi = () => {
    try {
      const text = JSON.stringify(P.ui, (k, v) => (UI_SKIP.has(k) ? undefined : v));
      if (text.length < 400_000) app.session?.setItem(UI_KEY, text); else app.session?.removeItem(UI_KEY);
    } catch { /* session storage unavailable or full: drafts stay in memory */ }
  };
  P.onHidden = () => { if (P.dirty.size) flush(); P.saveUi(); };
  P.reloadFromStorage = () => { P.init(); P.ui = { ws: {} }; app.rerender(); };

  // ---------- mechanics and engine ----------
  P.ensureMech = () => {
    if (P.mech || P.mechState === 'loading') return;
    P.mechState = 'loading';
    app.loadMechanics().then((raw) => { P.mech = loadMechanics(raw); P.mechState = 'ready'; app.rerender(); })
      .catch(() => { P.mechState = 'failed'; app.rerender(); });
  };
  P.ensureEngine = () => {
    P.ensureMech();
    if (P.calc || P.engineState === 'loading') return;
    P.engineState = 'loading';
    (app.importEngine ?? importEngine)().then((engine) => {
      P.engine = engine; P.engineState = 'ready';
      const tryMake = () => { if (P.mech) { P.calc = createCalc(engine, P.mech); app.rerender(); } else if (P.mechState !== 'failed') setTimeout(tryMake, 50); };
      tryMake();
    }).catch(() => { P.engineState = 'failed'; app.rerender(); });
  };
  P.engineInfo = ENGINE_INFO;

  // ---------- league data ----------
  P.league = () => app.league();
  P.myCoach = () => P.docs.meta.myCoach ?? app.viewingCoach();
  P.coachRoster = (coach) => (P.league()?.coaches.find((c) => c.name === coach)?.picks ?? []).map((p) => p.id).filter(Boolean);
  P.dexSp = (id) => app.dex.species[id] ?? Object.values(app.dex.species).find((s) => s.forms.some((f) => f.id === id)) ?? null;
  // Names come from the static Reg M-C data or the dex. An id that isn't there (e.g. from an imported file) is shown
  // reduced to letters and digits, never as stored text, so a name lookup can't carry markup into a screen.
  const safeId = (id) => String(id ?? '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 40);
  P.spName = (id) => P.mech?.species[id]?.name ?? P.dexSp(id)?.name ?? safeId(id);
  P.name = (kind, id) => (id ? P.mech?.[kind]?.[id]?.name ?? safeId(id) : '');
  /** Their out-of-battle species (dex ids are out-of-battle ids; Megas come with the pick). */
  P.rosterSpecies = (ws) => ws.roster.speciesIds.filter((id) => !P.mech || (P.mech.species[id] && !P.mech.species[id].mega));
  P.lineage = (setId, ws = null) => (P.docs.mysets.sets.find((s) => s.id === setId) ?? ws?.theirSets.find((s) => s.id === setId) ?? [...P.ws.values()].flatMap((w) => w.theirSets).find((s) => s.id === setId) ?? null);
  P.versionOf = (setId, ws) => { const l = P.lineage(setId, ws); return l ? l.currentV : null; };
  P.staleOf = (ws, entry) => (P.mech ? staleReasons(entry, P.mech, ENGINE_INFO, (id) => P.versionOf(id, ws)) : []);

  // ---------- navigation ----------
  P.go = (route, { push = null } = {}) => {
    const kind = push === null ? navKind(P.route, route) : push ? 'push' : 'replace';
    const hash = formatRoute(route);
    try { if (kind === 'push') app.history.pushState({ prep: true }, '', hash); else app.history.replaceState(null, '', hash); } catch { /* history unavailable */ }
    P.route = parseRoute(hash) ?? { view: 'home' };
    if (P.route.view === 'ws' && P.ws.has(P.route.wsId)) P.store.hint('lastRoute', hash); // for "Continue"; not a document
    P.pendingFocus = true;
    app.rerender();
  };
  /** Back to the parent: history.back() when the previous entry is ours, else replace with the parent. */
  P.back = () => {
    const st = app.history.state;
    if (st && st.prep) app.history.back(); else P.go(parentRoute(P.route), { push: false });
  };
  P.applyHash = (hash) => {
    const r = parseRoute(hash);
    if (!r) return false;
    P.route = r; P.pendingFocus = true;
    return true;
  };
  /** After the next render, move focus (and the view) to a section of the screen instead of its heading. */
  P.focusOn = (id) => { P.pendingFocus = true; P.pendingFocusId = id; app.rerender(); };
  /** The element id to focus after this render ('prep-h' = the screen heading after a navigation), or null. */
  P.consumeFocus = () => { const f = P.pendingFocus ? P.pendingFocusId ?? 'prep-h' : null; P.pendingFocus = false; P.pendingFocusId = null; return f; };

  // ---------- workspace helpers ----------
  P.openWorkspace = (coach) => {
    const existing = [...P.ws.values()].find((w) => w.coach === coach);
    if (existing) return P.go({ view: 'ws', wsId: existing.id, tab: 'plan' }, { push: true });
    const id = P.id('ws');
    const roster = { fetchedAt: app.sheet()?.fetchedAt ?? null, speciesIds: P.coachRoster(coach), points: Object.fromEntries((P.league()?.coaches.find((c) => c.name === coach)?.picks ?? []).filter((p) => p.id).map((p) => [p.id, p.points])) };
    const ws = newWorkspace({ id, coach, roster, now: P.now() });
    P.ws.set(id, ws); P.revs.set(wsKey(id), null);
    P.dirty.add(wsKey(id));
    P.docs.meta = { ...P.docs.meta, workspaces: [...P.docs.meta.workspaces, { id, coach, updatedAt: ws.updatedAt, archived: false }] };
    P.dirty.add(KEYS.meta);
    flush();
    P.go({ view: 'ws', wsId: id, tab: 'plan' }, { push: true });
  };
  P.wsUi = (id) => (P.ui.ws[id] ??= {});

  // ---------- backup ----------
  P.allDocs = () => {
    const out = { [KEYS.meta]: P.docs.meta, [KEYS.rules]: P.docs.rules, [KEYS.mysets]: P.docs.mysets, [KEYS.pilot]: P.docs.pilot };
    for (const w of P.ws.values()) out[wsKey(w.id)] = w;
    return out;
  };
  P.backupText = async (docs = P.allDocs(), kind = 'full') => JSON.stringify(await makeBackup(docs, { exportedAt: P.now(), appBuild: app.appBuild ?? '', deviceLabel: P.docs.meta.deviceLabel ?? '', kind }, app.crypto.subtle));
  P.downloadBackup = async () => {
    flush();
    const text = await P.backupText();
    app.download(`drafarig-prep-${P.now().slice(0, 10)}${P.docs.meta.deviceLabel ? `-${P.docs.meta.deviceLabel.replace(/[^a-z0-9-]/gi, '').slice(0, 20)}` : ''}.json`, text, 'application/json');
    P.mutate('meta', (m) => { m.lastBackupAt = P.now(); m.changesSinceBackup = 0; }, { substantive: false });
    P.toast('Backup downloaded');
  };

  // ---------- rendering ----------
  P.render = () => {
    if (!P.docs.meta) P.init();
    P.ensureMech();
    const r = P.route;
    let body;
    try {
      if (r.view === 'home') body = home();
      else if (r.view === 'rules') body = rulesScreen();
      else if (r.view === 'backup') body = backupScreen();
      else if (r.view === 'pilot') body = Practice.pilot(P);
      else if (r.view === 'my-sets') body = Sets.mySets(P, r);
      else if (r.view === 'ws') {
        const ws = P.ws.get(r.wsId);
        body = ws ? workspace(ws, r) : notOnDevice();
      } else body = home();
    } catch (e) {
      console.error('Prep screen failed:', e && e.message);
      body = `<section class="panel">${h2('Prep')}<p class="banner bad" role="alert">This screen couldn't be shown. Your prep is unchanged.</p>${btn('Go to Prep home', 'go-home')}</section>`;
    }
    return `<div class="prep" data-prep-view="${esc(r.view)}">${banners()}${body}</div>`;
  };

  function banners() {
    const out = [];
    if (P.ui.undo) out.push(`<div class="banner info" role="status">${esc(P.ui.undo.label)}. ${btn('Undo', 'undo-delete', {}, { primary: true })}</div>`);
    // Banners are announced once when they appear (announceBanners), not as role="alert" re-created on every render.
    if (P.newer.size) out.push(`<div class="banner bad">${esc(C.SAVE.newer)} ${btn('Download a backup', 'backup-download')} ${btn('Reload', 'reload-prep')}</div>`);
    if (P.saveError && P.saveError.code !== 'conflict') {
      out.push(`<div class="banner bad">⚠ ${esc(saveErrorText())} ${btn('Download a backup now', 'backup-download', {}, { primary: true })} ${P.saveError.code === 'quota' ? btn('Free up space…', 'go-backup') : ''}</div>`);
    }
    if (P.conflicts.size) out.push(`<div class="banner warn">${esc(C.SAVE.conflict({ what: 'Your prep' }))} ${btn('Reload it', 'reload-prep', {}, { primary: true })} ${P.dirty.size ? btn('Download my unsaved changes first', 'backup-download') : ''}</div>`);
    if (P.corrupt.size) out.push(`<div class="banner warn">${esc(C.SAVE.corrupt)} ${btn('Save the raw data as a file', 'save-raw')} ${btn('Restore a backup', 'go-backup')}</div>`);
    announceBanners();
    if (P.mechState === 'failed') out.push(`<div class="banner warn">The Reg M-C data couldn't load, so moves and items can't be checked right now. Your prep is saved. ${btn('Retry', 'retry-mech')}</div>`);
    return out.join('');
  }

  function saveErrorText() {
    return P.saveError.code === 'quota' ? C.SAVE.quota : P.saveError.code === 'invalid' ? C.SAVE.invalid : P.saveError.code === 'corrupt' ? C.SAVE.corrupt : C.SAVE.error;
  }
  /** Say each problem banner once, through the app's status region, when it first appears. */
  function announceBanners() {
    const now = [P.newer.size && C.SAVE.newer, P.saveError && P.saveError.code !== 'conflict' && saveErrorText(), P.conflicts.size && C.SAVE.conflict({ what: 'Your prep' }), P.corrupt.size && C.SAVE.corrupt].filter(Boolean);
    const key = now.join('|');
    if (key && key !== P.announcedBanners) app.announce?.(now.join(' '));
    P.announcedBanners = key;
  }
  function notOnDevice() {
    return `<section class="panel">${h2('Not on this device')}<p>${esc(C.NOT_ON_DEVICE)}</p>${btn('Go to Prep', 'go-home', {}, { primary: true })}</section>`;
  }

  // ---------- home ----------
  function home() {
    const L = P.league();
    const meta = P.docs.meta;
    const me = P.myCoach();
    const confirm = !meta.myCoachConfirmed;
    const coaches = (L?.coaches ?? []).filter((c) => c.name !== me);
    // every saved workspace is listed (a restore with "Keep both" leaves two for one coach)
    const byCoach = new Map();
    for (const w of [...P.ws.values()].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))) byCoach.set(w.coach, [...(byCoach.get(w.coach) ?? []), w]);
    const rows = coaches.flatMap((c) => {
      const list = byCoach.get(c.name) ?? [];
      if (!list.length) return [{ c, w: null, sort: 2, html: `<li class="opp">${btn(`${c.name}`, 'open-coach', { coach: c.name }, { cls: 'opp-btn' })} <span class="muted small">${esc(C.HOME.notStarted)}</span></li>` }];
      return list.map((w, i) => row(c, w, i));
    }).sort((a, b) => a.sort - b.sort || (b.at ?? '').localeCompare(a.at ?? ''));
    function row(c, w, copy) {
      const stale = w.calcs.filter((x) => P.staleOf(w, x).length).length;
      const games = w.mockSets.reduce((t, m) => t + m.games.filter((g) => !g.draft).length, 0);
      const played = w.matches.find((m) => m.games?.length);
      const res = played ? `Played: ${played.games.filter((g) => g.result === 'W').length}–${played.games.filter((g) => g.result === 'L').length}` : '';
      return { c, w, sort: w.isNext ? 0 : 1, at: w.updatedAt, html: `<li class="opp started">${btn(`vs ${c.name}${copy ? ` (copy ${copy + 1})` : ''}`, 'open-ws', { ws: w.id }, { cls: 'opp-btn' })}${w.isNext ? ' <span class="chip ok">next</span>' : ''}${w.matchDate ? ` <span class="small">${esc(w.matchDate)}</span>` : ''}
        <div class="small muted">${w.theirSets.length} sets · ${w.calcs.length} calcs${stale ? ` (${stale} out of date)` : ''} · ${games} mock games${res ? ` · ${esc(res)}` : ''}${copy ? ` · changed ${esc((w.updatedAt ?? '').slice(0, 10))}` : ''}</div></li>` };
    }
    const orphan = [...P.ws.values()].filter((w) => !coaches.some((c) => c.name === w.coach) && w.coach !== me);
    const lastHash = P.store.hint('lastRoute') ?? meta.lastRoute;
    const last = lastHash && parseRoute(lastHash);
    const lastWs = last?.wsId && P.ws.get(last.wsId);
    const rules = P.docs.rules.rules;
    const ruleLine = C.RULES_MAIN.map((k) => `${C.RULES[k].q}: ${rules[k]?.value === 'unknown' ? "don't know" : C.RULES[k].options[rules[k]?.value]}`).join(' · ');
    const usage = P.store.usage();
    const backupAge = meta.lastBackupAt ? Math.floor((Date.parse(P.now()) - Date.parse(meta.lastBackupAt)) / 864e5) : null;
    const nag = (backupAge === null || backupAge > 7) && (meta.changesSinceBackup ?? 0) > 0;
    const mineCount = P.docs.mysets.sets.length;
    return `<section class="panel prep-home">${h2(C.HOME.whose(me))}
      ${confirm ? `<p class="confirm">${esc(C.HOME.isThisYou)} <b>${esc(me)}</b> ${btn('Yes', 'confirm-me', {}, { primary: true })} ${select('prep-me', (L?.coaches ?? []).map((c) => [c.name, c.name]), me, { data: { pc: 'pick-me' }, label: 'Pick someone else' })}</p>` : ''}
      ${nag ? `<p class="banner warn">${esc(meta.lastBackupAt ? `Last backup ${backupAge} days ago` : 'No backup yet')}: ${meta.changesSinceBackup} changes since. ${btn('Back up now', 'backup-download', {}, { primary: true })}</p>` : ''}
      ${lastWs ? `<p>${btn(`Continue: vs ${lastWs.coach}${last.tab ? ` · ${TAB_LABEL[last.tab] ?? ''}` : ''}`, 'continue')}</p>` : ''}
      <h3>Rules you know ${btn('Edit', 'go-rules')}</h3><p class="small">${esc(ruleLine)}</p>
      <h3>${esc(C.HOME.choose)}</h3><p class="small">${esc(C.HOME.chooseHelp)}</p>
      ${L ? `<ul class="opps">${rows.map((x) => x.html).join('')}</ul>` : `<p class="small">The league sheet hasn't loaded, so opponents aren't listed yet. Saved prep is below.</p>`}
      ${orphan.length ? `<h3>Other saved prep</h3><ul class="opps">${orphan.map((w) => `<li class="opp started">${btn(`vs ${w.coach}`, 'open-ws', { ws: w.id }, { cls: 'opp-btn' })} <span class="small muted">not on the sheet now</span></li>`).join('')}</ul>` : ''}
      <details class="howto"><summary>How prep works here (1 minute)</summary><ol>${C.HOME.how.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></details>
      <h3>My sets ${btn('Open', 'go-mysets')}</h3><p class="small">${mineCount} set${mineCount === 1 ? '' : 's'} in your library. ${btn('Paste your team', 'go-mysets-import')}</p>
      <h3>Help a friend practise ${btn('Pilot card', 'go-pilot')}</h3>
      <p class="small backup-line">${esc(C.HOME.savedLocal)} Last backup: ${meta.lastBackupAt ? `${backupAge} days ago` : 'never'} (${meta.changesSinceBackup ?? 0} changes since). ${btn('Backup & restore', 'go-backup')}</p>
      ${usage > USAGE_BUDGET_CHARS * 0.85 ? `<p class="banner warn">Prep is using most of the space this browser allows. Archive finished opponents to a file. ${btn('Backup & restore', 'go-backup')}</p>` : ''}
    </section>`;
  }

  // ---------- rules ----------
  function rulesScreen() {
    const rules = P.docs.rules.rules;
    const row = (k) => {
      const r = rules[k] ?? { value: 'unknown', source: 'default' };
      const opts = Object.entries(C.RULES[k].options);
      return `<div class="rule"><p class="rule-q"><b>${esc(C.RULES[k].q)}</b> ${r.source === 'user' ? `<span class="small muted">✓ you said so${r.setAt ? ` (${esc(r.setAt.slice(0, 10))})` : ''}</span>` : '<span class="small muted">default: don\'t know</span>'}</p>
        <div class="choices" role="group" aria-label="${esc(C.RULES[k].q)}">${opts.map(([v, l]) => btn(l, 'set-rule', { rule: k, value: v }, { cls: `pchip${r.value === v ? ' on' : ''}`, pressed: r.value === v })).join('')}</div>
        ${C.RULES[k].help ? `<p class="small">${esc(C.RULES[k].help)}</p>` : ''}</div>`;
    };
    return `<section class="panel prep-rules">${btn('‹ Prep', 'go-home', {}, { cls: 'back', aria: 'Back to Prep home' })}${h2('Rules you know')}
      <p>What your league has told you. Anything left as "Don't know" is shown both ways where it matters.</p>
      ${C.RULES_MAIN.map(row).join('')}
      <details><summary>More rules (optional)</summary>${C.RULES_MORE.map(row).join('')}</details>
      <label class="field" for="prep-rules-notes"><span>Source / notes</span><input id="prep-rules-notes" data-pi="rules-notes" value="${esc(P.docs.rules.notes ?? '')}" placeholder="e.g. league Discord, 1 Oct"></label>
      <p class="small">${esc(C.GAME_RULES)}</p></section>`;
  }

  // ---------- backup ----------
  function backupScreen() {
    const meta = P.docs.meta;
    const usage = P.store.usage();
    const ui = (P.ui.backup ??= {});
    const persisted = P.persisted;
    const restore = ui.preview ? restorePreview(ui) : '';
    const wsList = [...P.ws.values()];
    return `<section class="panel prep-backup">${btn('‹ Prep', 'go-home', {}, { cls: 'back', aria: 'Back to Prep home' })}${h2('Backup & restore')}
      <p>${esc(C.BACKUP.intro)}</p><details class="small"><summary>Why</summary><p>${esc(C.BACKUP.why)}</p></details>
      <p><b>Last backup:</b> ${meta.lastBackupAt ? esc(meta.lastBackupAt.slice(0, 16).replace('T', ' ')) : 'never'} · ${meta.changesSinceBackup ?? 0} changes since</p>
      <p>${btn('Back up now (download a file)', 'backup-download', {}, { primary: true })} ${btn('Copy backup as text', 'backup-copy')}</p>
      ${meta.lastBackupAt && Date.parse(P.now()) - Date.parse(meta.lastBackupAt) < 5 * 60e3 ? '<p class="small">No file in your downloads? Use "Copy backup as text" and paste it somewhere safe.</p>' : ''}
      <p class="small">${esc(C.BACKUP.privateNote)}</p>
      <label class="field" for="prep-device"><span>Name for this device (goes in the file name)</span><input id="prep-device" data-pi="device-label" value="${esc(meta.deviceLabel ?? '')}" maxlength="20"></label>
      <h3>Protection</h3><p>${esc(persisted === true ? C.BACKUP.protected : persisted === false ? C.BACKUP.notProtected : 'Unknown on this browser.')}</p>
      ${app.persist && persisted !== true ? `<p>${btn(C.BACKUP.protectButton, 'persist')} <span class="small">${esc(C.BACKUP.protectHelp)}</span></p>` : ''}
      <h3>Restore</h3>
      <p><label class="field" for="prep-restore-file"><span>Choose a backup file</span><input type="file" id="prep-restore-file" data-pc="restore-file" accept=".json,application/json,text/plain"></label></p>
      <label class="field" for="prep-restore-text"><span>Or paste backup text</span><textarea id="prep-restore-text" data-pi="restore-text" rows="3">${esc(ui.text ?? '')}</textarea></label>
      <p>${btn('Check backup', 'restore-check')}</p>
      ${ui.error ? `<p class="banner bad" role="alert">${esc(C.BACKUP.errors[ui.error] ?? C.BACKUP.errors['not-backup'])}</p>` : ''}
      ${restore}
      ${P.lastRestore ? `<p class="banner info">Restored. ${btn('Undo restore', 'restore-undo')}</p>` : ''}
      <h3>Move to another device</h3><ol class="small"><li>Back up here.</li><li>Send the file to yourself.</li><li>Restore there.</li></ol><p class="small">${esc(C.BACKUP.share)} ${esc(C.BACKUP.ios)}</p>
      <h3>Space</h3><p class="small">Prep is using about ${Math.round(usage / 1000)} thousand characters of roughly ${Math.round(USAGE_BUDGET_CHARS / 1e6 * 10) / 10} million this browser allows${usage > USAGE_BUDGET_CHARS * 0.6 ? '. Archive old opponents to a file to free space' : ''}.</p>
      ${wsList.length ? `<p class="small">An opponent file includes your sets for that match, your cards and notes: it is for your own devices, not for sharing as scouting.</p><ul class="small">${wsList.map((w) => `<li>vs ${esc(w.coach)} · ${btn('Export this opponent', 'ws-export-file', { ws: w.id })} ${btn('Archive (file + remove here)…', 'ws-archive', { ws: w.id })}
        ${ui.archivePending === w.id ? `<p class="banner warn">A file for vs ${esc(w.coach)} was downloaded. Check it is in your downloads, then: ${btn(`Remove vs ${w.coach} from this device`, 'ws-archive-confirm', { ws: w.id })} ${btn('Keep it here', 'ws-archive-cancel')}</p>` : ''}</li>`).join('')}</ul>` : ''}
      <h3>Delete</h3><p class="small">Removes only prep (drafarig.prep.*); your draft settings stay.</p>
      ${ui.confirmDelete ? `<p><label class="field" for="prep-delete-confirm"><span>Type delete to confirm</span><input id="prep-delete-confirm" data-pi="delete-confirm" value=""></label> ${btn('Download a backup first', 'backup-download')} ${btn('Delete all prep on this device', 'delete-all-confirm')}</p>` : btn('Delete all prep on this device…', 'delete-all')}
    </section>`;
  }
  /** What "Replace everything" removes and brings in, in counts. */
  function replaceSummary(backup) {
    const docs = Object.values(backup.docs);
    const theirs = new Set(docs.filter((d) => d?.coach).map((d) => d.id));
    const gone = [...P.ws.values()].filter((w) => !theirs.has(w.id)).length;
    const mySetsHere = P.docs.mysets.sets.length, mySetsThere = docs.find((d) => Array.isArray(d?.sets))?.sets.length ?? 0;
    return `${gone} opponent${gone === 1 ? '' : 's'} here that the file doesn't have will be removed; your rules and ${mySetsHere} set${mySetsHere === 1 ? '' : 's'} of yours are replaced by the file's (${mySetsThere} set${mySetsThere === 1 ? '' : 's'}).`;
  }
  function restorePreview(ui) {
    const s = ui.preview.summary;
    const here = { opponents: P.ws.size };
    const incoming = Object.values(ui.preview.backup.docs).filter((d) => d && d.coach);
    const collide = incoming.filter((d) => P.ws.has(d.id));
    const opponentFile = ui.preview.backup.kind === 'opponent';
    return `<div class="restore-preview"><p>Backup from ${esc(ui.preview.backup.deviceLabel || 'a device')}, ${esc(String(ui.preview.backup.exportedAt).slice(0, 16).replace('T', ' '))}: ${s.opponents} opponents, ${s.sets} sets, ${s.calcs} calcs, ${s.mockGames} mock games. On this device: ${here.opponents} opponents.</p>
      <p>${btn('Import opponents (keeps what is here)', 'restore-import', {}, { primary: true })} ${opponentFile ? '<span class="small">(a file with one opponent can only be imported)</span>' : btn('Replace everything…', 'restore-replace')}</p>
      ${ui.confirmReplace && !opponentFile ? `<p class="banner warn">Replace everything: ${esc(replaceSummary(ui.preview.backup))} A backup of what is here now downloads first; if it doesn't arrive, don't continue. You can undo until your next change. ${btn('Replace now', 'restore-replace-confirm')} ${btn('Cancel', 'restore-replace-cancel')}</p>` : ''}
      ${collide.length ? `<p class="small">Already on this device: ${collide.map((d) => `${esc(d.coach)} ${['add', 'replace', 'keep-both', 'skip'].filter((x) => x !== 'add').map((c) => btn(c === 'keep-both' ? 'Keep both' : c === 'replace' ? 'Replace' : 'Skip', 'restore-choice', { ws: d.id, choice: c }, { cls: `pchip${ui.choices?.[d.id] === c ? ' on' : ''}`, pressed: ui.choices?.[d.id] === c })).join('')}`).join(' · ')}</p>` : ''}</div>`;
  }

  // ---------- workspace shell ----------
  function workspace(ws, r) {
    const tab = r.tab ?? null;
    const head = `<div class="ws-head">${btn('‹ Prep', r.kind ? 'back' : 'go-home', {}, { cls: 'back', aria: r.kind ? 'Back' : 'Back to Prep home' })}
      <span class="ws-title">vs ${esc(ws.coach)}</span>${ws.isNext ? ' <span class="chip ok">next</span>' : ''}</div>`;
    // section buttons (not an ARIA tablist: no arrow-key model to promise); the current one is marked aria-current
    const tabs = `<nav class="ptabs" aria-label="Prep sections">${Object.entries(TAB_LABEL).map(([k, l]) => `<button type="button" id="ptab-${k}" data-pa="tab" data-tab="${k}"${!r.kind && tab === k ? ' aria-current="page" class="active"' : ''}>${l}</button>`).join('')}</nav>`;
    let body;
    if (!r.kind) {
      body = tab === 'sets' ? Sets.tab(P, ws) : tab === 'calcs' ? Calcs.tab(P, ws) : tab === 'practice' ? Practice.tab(P, ws) : Plan.tab(P, ws);
    } else {
      const view = MODULES.map((m) => m.views?.[r.kind]).find(Boolean);
      body = view ? view(P, ws, r) : Plan.tab(P, ws);
    }
    return `<section class="panel prep-ws" data-key="ws">${head}${tabs}<div id="ptab-panel">${body}</div>
      <p class="small muted ws-foot">${esc(C.HOME.savedLocal)} ${P.saveState === 'saving' ? esc(C.SAVE.saving) : P.saveState === 'error' ? '' : esc(C.SAVE.saved)}</p></section>`;
  }
  P.rosterDiffOf = (ws) => (P.league() ? rosterDiff(ws.roster.speciesIds, P.coachRoster(ws.coach)) : { added: [], removed: [] });

  // ---------- actions ----------
  const ACTIONS = {
    'go-home': () => P.go({ view: 'home' }, { push: false }),
    back: () => P.back(),
    'go-rules': () => P.go({ view: 'rules' }, { push: true }),
    'go-backup': () => P.go({ view: 'backup' }, { push: true }),
    'go-pilot': () => P.go({ view: 'pilot' }, { push: true }),
    'go-mysets': () => P.go({ view: 'my-sets' }, { push: true }),
    'go-mysets-import': () => P.go({ view: 'my-sets', kind: 'import' }, { push: true }),
    continue: () => { const r = parseRoute(P.store.hint('lastRoute') ?? P.docs.meta.lastRoute); if (r) P.go(r, { push: true }); },
    'confirm-me': () => P.mutate('meta', (m) => { m.myCoach = P.myCoach(); m.myCoachConfirmed = true; }, { substantive: false }),
    'open-coach': (t) => P.openWorkspace(t.dataset.coach),
    'open-ws': (t) => P.go({ view: 'ws', wsId: t.dataset.ws, tab: 'plan' }, { push: true }),
    tab: (t) => P.go({ view: 'ws', wsId: P.route.wsId, tab: t.dataset.tab }, { push: false }),
    'set-rule': (t) => P.mutate('rules', (d) => { d.rules[t.dataset.rule] = { value: t.dataset.value, source: t.dataset.value === 'unknown' ? 'default' : 'user', setAt: P.now(), note: '' }; d.updatedAt = P.now(); }),
    'reload-prep': () => P.reloadFromStorage(),
    'retry-mech': () => { P.mechState = 'idle'; P.ensureMech(); },
    'backup-download': () => P.downloadBackup(),
    // a clipboard isn't a backup until it's pasted somewhere safe, so this doesn't count as one
    'backup-copy': async () => { flush(); const text = await P.backupText(); try { await app.copyText(text); P.toast('Backup copied as text: paste it somewhere safe now (clipboards that sync may keep a copy)'); } catch { P.toast("Couldn't copy; use the download instead"); } },
    persist: async () => {
      try { await app.persist.persist(); P.persisted = await app.persist.persisted(); } catch { P.persisted = false; }
      P.mutate('meta', (m) => { m.persistAskedAt = P.now(); }, { substantive: false });
    },
    'save-raw': () => { const raw = Object.fromEntries([...P.corrupt].map(([k, v]) => [k, v.raw])); app.download(`drafarig-prep-unreadable-${P.now().slice(0, 10)}.json`, JSON.stringify(raw), 'application/json'); },
    'restore-check': async () => {
      const ui = P.ui.backup ??= {};
      const r = await readBackup(ui.text ?? '', app.crypto.subtle);
      ui.error = r.ok ? null : r.code; ui.preview = r.ok ? r : null; ui.choices = {};
      app.rerender();
    },
    'restore-choice': (t) => { const ui = P.ui.backup; ui.choices[t.dataset.ws] = t.dataset.choice; app.rerender(); },
    'restore-import': () => doRestore('import'),
    'restore-replace': () => { if (P.ui.backup?.preview?.backup.kind === 'opponent') return; P.ui.backup.confirmReplace = true; app.rerender(); },
    'restore-replace-cancel': () => { P.ui.backup.confirmReplace = false; app.rerender(); },
    'restore-replace-confirm': async () => { P.ui.backup.confirmReplace = false; await P.downloadBackup(); await doRestore('replace'); },
    'restore-undo': () => {
      const prev = P.lastRestore;
      if (!prev) return;
      // only while storage is exactly what the restore left (another tab, or anything since, would be overwritten)
      const docsNow = Object.fromEntries(P.store.keys().filter((k) => typeOfKey(k)).map((k) => [k, P.store.raw(k)]));
      if (JSON.stringify(docsNow) !== JSON.stringify(P.lastRestoreAfter)) { P.lastRestore = null; P.toast("Can't undo the restore now: prep changed since."); app.rerender(); return; }
      for (const k of P.store.keys()) if (!(k in prev)) P.store.remove(k);
      const failed = Object.entries(prev).filter(([k, raw]) => !P.store.writeRaw(k, raw).ok).length;
      P.lastRestore = null; P.reloadFromStorage(); P.toast(failed ? "Restore undone, but part of it couldn't be written back. Download a backup now." : 'Restore undone');
    },
    'ws-export-file': async (t) => {
      const ws = P.ws.get(t.dataset.ws);
      flush();
      app.download(`drafarig-prep-opponent-${P.now().slice(0, 10)}.json`, await P.backupText(opponentDocs(ws, P.docs.mysets), 'opponent'), 'application/json');
    },
    // Archive is two steps: the file first, then removal once the user has seen it downloaded (a blocked download must
    // never cost them the prep).
    'ws-archive': async (t) => {
      const ws = P.ws.get(t.dataset.ws);
      flush();
      if (P.conflicts.has(wsKey(ws.id)) || P.dirty.has(wsKey(ws.id))) { P.toast(`vs ${ws.coach} has changes that aren't saved here. Reload it first.`); return; }
      app.download(`drafarig-prep-opponent-${P.now().slice(0, 10)}.json`, await P.backupText(opponentDocs(ws, P.docs.mysets), 'opponent'), 'application/json');
      (P.ui.backup ??= {}).archivePending = ws.id;
      app.rerender();
    },
    'ws-archive-cancel': () => { P.ui.backup.archivePending = null; app.rerender(); },
    'ws-archive-confirm': (t) => {
      const ws = P.ws.get(t.dataset.ws);
      if (!ws || P.ui.backup?.archivePending !== ws.id) return;
      P.ui.backup.archivePending = null;
      // Only remove what the file holds: not if another tab changed this opponent since (its newer version would go).
      const stored = P.store.load(wsKey(ws.id));
      if (P.conflicts.has(wsKey(ws.id)) || P.dirty.has(wsKey(ws.id)) || (stored.status === 'ok' && stored.doc.rev !== P.revs.get(wsKey(ws.id)))) {
        P.toast(`vs ${ws.coach} changed since the file was made, so it was kept here. Reload, then archive again.`); app.rerender(); return;
      }
      P.store.remove(wsKey(ws.id)); P.ws.delete(ws.id);
      P.docs.meta = { ...P.docs.meta, workspaces: P.docs.meta.workspaces.filter((w) => w.id !== ws.id), archived: [...(P.docs.meta.archived ?? []), { coach: ws.coach, at: P.now() }] };
      P.dirty.add(KEYS.meta); flush();
      P.toast(`Archived vs ${ws.coach} to a file`);
      app.rerender();
    },
    'delete-all': () => { (P.ui.backup ??= {}).confirmDelete = true; app.rerender(); },
    'delete-all-confirm': () => {
      if ((P.ui.backup?.deleteText ?? '').trim().toLowerCase() !== 'delete') { P.toast('Type delete to confirm'); return; }
      for (const k of P.store.keys()) P.store.remove(k);
      P.ui = { ws: {} }; P.saveUi(); P.store.hint('lastRoute', null); P.init(); P.go({ view: 'home' }, { push: false }); P.toast('All prep on this device was deleted');
    },
  };
  async function doRestore(mode) {
    const ui = P.ui.backup;
    if (!ui?.preview) return; // a second tap after the restore finished, or before the check did
    if (mode === 'replace' && ui.preview.backup.kind === 'opponent') return;
    // Edits not saved yet would be lost by the reload below: save them first, or stop.
    flush();
    if (P.dirty.size || P.conflicts.size) { P.toast("Some changes here aren't saved, so nothing was restored. Download a backup, then try again."); return; }
    // Undo puts back exactly what was stored, unreadable and newer documents included.
    const before = Object.fromEntries(P.store.keys().map((k) => [k, P.store.raw(k)]).filter(([, v]) => v !== null));
    const plan = planRestore(P.allDocs(), ui.preview.backup, mode, { choices: ui.choices ?? {}, newWsId: () => P.id('ws'), newSetId: () => P.id('set'), now: P.now() });
    if (plan.notes.some((n) => n.kind === 'needs-choice')) { P.toast('Choose Replace, Keep both or Skip for each opponent already here'); return; }
    // Unreadable documents are kept as a file before anything can replace them (undo only covers readable ones).
    if ([...P.corrupt.keys()].some((k) => plan.removes.includes(k) || k in plan.writes)) ACTIONS['save-raw']();
    const failed = [];
    for (const k of plan.removes) if (!P.store.remove(k).ok) failed.push(k);
    for (const [k, d] of Object.entries(plan.writes)) {
      const cur = P.store.load(k);
      let res = P.store.save(k, d, cur.status === 'ok' || cur.status === 'newer' ? cur.doc.rev : null);
      if (!res.ok && res.code === 'conflict') { P.store.remove(k); res = P.store.save(k, d, null); }
      if (!res.ok) failed.push(k);
    }
    P.lastRestore = before;
    P.init();
    // rebuild the index from what is stored
    P.docs.meta = { ...P.docs.meta, workspaces: [...P.ws.values()].map((w) => ({ id: w.id, coach: w.coach, updatedAt: w.updatedAt, archived: false })) };
    P.dirty.add(KEYS.meta); flush();
    P.lastRestoreAfter = Object.fromEntries(P.store.keys().filter((k) => typeOfKey(k)).map((k) => [k, P.store.raw(k)]));
    if (failed.length) { P.saveError = { code: 'error', keys: failed }; P.saveState = 'error'; }
    ui.preview = null; ui.text = '';
    P.toast(failed.length ? `${failed.length} part${failed.length === 1 ? '' : 's'} couldn't be restored. "Undo restore" goes back.`
      : mode === 'replace' ? 'Backup restored (replaced)' : `Imported: ${plan.notes.filter((n) => n.kind !== 'needs-choice').length} changes`);
    app.rerender();
  }

  const CHANGES = {
    'pick-me': (t) => P.mutate('meta', (m) => { m.myCoach = t.value; m.myCoachConfirmed = true; }, { substantive: false }),
    'restore-file': async (t) => {
      const f = t.files?.[0];
      if (!f) return;
      if (f.size > 10 * 1024 * 1024) { (P.ui.backup ??= {}).error = 'too-large'; app.rerender(); return; }
      (P.ui.backup ??= {}).text = await f.text();
      await ACTIONS['restore-check']();
    },
  };
  const INPUTS = {
    'rules-notes': (t) => P.mutate('rules', (d) => { d.notes = t.value.slice(0, 500); }, { render: false }),
    'device-label': (t) => P.mutate('meta', (m) => { m.deviceLabel = t.value.replace(/[^\w -]/g, '').slice(0, 20); }, { substantive: false, render: false }),
    'restore-text': (t) => { (P.ui.backup ??= {}).text = t.value; },
    'delete-confirm': (t) => { (P.ui.backup ??= {}).deleteText = t.value; },
  };
  const allActions = Object.assign({}, ACTIONS, ...MODULES.map((m) => m.actions ?? {}));
  const allChanges = Object.assign({}, CHANGES, ...MODULES.map((m) => m.changes ?? {}));
  const allInputs = Object.assign({}, INPUTS, ...MODULES.map((m) => m.inputs ?? {}));
  P.action = (name, t) => allActions[name]?.(t, P);

  // A failing handler (sync or async) never escapes: mutate() works on a copy, so nothing half-applied was saved.
  const guarded = (h, t, what) => {
    const fail = (e) => { console.error(`Prep ${what} failed:`, e && e.message); P.toast('That action failed; your prep is unchanged.'); app.rerender(); };
    try { Promise.resolve(h(t, P)).catch(fail); } catch (e) { fail(e); }
    return true;
  };
  // Actions that create or remove something run once per tap: a double tap within a moment is the same tap.
  const ONCE = new Set(['open-coach', 'match-start', 'finding-new', 'calc-save', 'calc-dup', 'card-new', 'plan-new', 'variant-new', 'variant-dup', 'br-start', 'mock-quick',
    'guess-all', 'paste-import', 'set-save', 'set-save-copy', 'pilot-save', 'rv-save', 'restore-import', 'restore-replace-confirm', 'backup-download', 'ws-archive', 'ws-archive-confirm', 'delete-all-confirm', 'undo-delete']);
  const recent = new Map();
  const tappedTwice = (t) => {
    if (!ONCE.has(t.dataset.pa)) return false;
    const key = JSON.stringify(t.dataset), now = Date.now();
    if (now - (recent.get(key) ?? 0) < 400) return true;
    recent.set(key, now);
    return false;
  };
  // A document written by a newer app is read-only here: only downloading a backup is offered, nothing removes it.
  const NOT_WHEN_NEWER = new Set(['ws-archive', 'ws-archive-confirm', 'restore-replace', 'restore-replace-confirm', 'restore-import', 'restore-undo', 'delete-all', 'delete-all-confirm']);
  // Deletes take one tap and can be undone until the next action: the documents they change are kept and put back.
  const UNDOABLE = { 'set-delete': 'Set deleted', 'variant-delete': 'Version deleted', 'calc-delete': 'Calc deleted', 'plan-delete': 'Plan deleted', 'card-delete': 'Card deleted',
    'fd-delete': 'Finding deleted', 'pilot-delete': 'Pilot team deleted', 'rv-del': 'Reveal removed', 'ifthen-remove': 'If-then line removed' };
  const docKeys = () => [KEYS.meta, KEYS.rules, KEYS.mysets, KEYS.pilot, ...[...P.ws.keys()].map(wsKey)];
  /** A document's content, without the save bookkeeping autosave changes (rev, saveId, meta's counters). */
  const contentOf = (d) => JSON.stringify(d ? { ...d, rev: 0, saveId: null, changesSinceBackup: 0, updatedAt: null } : null);
  allActions['undo-delete'] = () => {
    const u = P.ui.undo;
    P.ui.undo = null;
    if (!u) return;
    // only while the documents are exactly as the delete left them (any later edit, here or taken from another tab,
    // withdraws the Undo before this point; this is the last check)
    if (Object.keys(u.docs).some((k) => contentOf(docFor(k)) !== u.after[k])) { P.toast("Can't undo now: something changed since."); app.rerender(); return; }
    P.undoing = true;
    try {
      for (const [key, doc] of Object.entries(u.docs)) {
        if (key.startsWith(wsKey(''))) { if (!P.ws.has(doc.id)) { P.ws.set(doc.id, doc); } P.mutate(`ws:${doc.id}`, () => structuredClone(doc), { render: false }); }
        else P.mutate(Object.keys(KEYS).find((k) => KEYS[k] === key), () => structuredClone(doc), { render: false });
      }
    } finally { P.undoing = false; }
    P.toast('Undone');
    app.rerender();
  };
  function clickAction(a, t) {
    const name = t.dataset.pa;
    if (tappedTwice(t)) return true;
    if (P.readOnly() && NOT_WHEN_NEWER.has(name)) { P.toast(C.SAVE.newer); return true; }
    if (name !== 'undo-delete' && P.ui.undo) P.ui.undo = null;
    if (!UNDOABLE[name]) return guarded(a, t, 'action');
    const before = Object.fromEntries(docKeys().map((k) => [k, docFor(k)]).filter(([, d]) => d).map(([k, d]) => [k, structuredClone(d)]));
    return guarded(async () => {
      await a(t, P);
      const changed = Object.fromEntries(Object.entries(before).filter(([k, d]) => JSON.stringify(docFor(k)) !== JSON.stringify(d)));
      if (Object.keys(changed).length) { P.ui.undo = { label: UNDOABLE[name], docs: changed, after: Object.fromEntries(Object.keys(changed).map((k) => [k, contentOf(docFor(k))])) }; app.rerender(); }
    }, t, 'action');
  }
  return {
    P,
    render: () => P.render(),
    click(t) { const a = allActions[t.dataset.pa]; return a ? clickAction(a, t) : false; },
    change(t) { const h = allChanges[t.dataset.pc] ?? allInputs[t.dataset.pi]; return h ? guarded(h, t, 'change') : false; },
    input(t) { const h = allInputs[t.dataset.pi]; return h ? guarded(h, t, 'input') : false; },
    applyHash: (h) => P.applyHash(h),
    hash: () => formatRoute(P.route),
    consumeFocus: () => P.consumeFocus(),
    onStorage: (e) => P.onStorage(e),
    onHidden: () => P.onHidden(),
    init: () => P.init(),
    flush: () => flush(),
    setPersisted: (v) => { P.persisted = v; },
  };
}

export const SCHEMA = SCHEMA_VERSION;
export const GLOSSARY_PREP = C.GLOSSARY_PREP;
export { term, versionOf, currentVersion };

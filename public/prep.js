// Prep mode controller (browser). Owns device-local prep documents, autosave with revision checks, routes, and the
// screens. Screens live in prep-*.js modules; pure logic lives in /lib. Nothing here sends prep anywhere: no fetch, no
// beacons, no URLs with data. The only dynamic import is the vendored damage engine (prep-engine.js).
import { parseRoute, formatRoute, parentRoute, navKind, isMatch, MATCH_TABS } from '../lib/prep-route.mjs';
import { resolvePov, identityOf, ownerOf, workspacesFor, unassignedVs, legacyEvidence } from '../lib/prep-matchup.mjs';
import { KEYS, wsKey, newId, emptyMeta, emptyRules, emptyMySets, emptyPilot, newWorkspace, typeOfKey, forbiddenKey, SCHEMA_VERSION } from '../lib/prep-schema.mjs';
import { createStore, USAGE_BUDGET_CHARS, isPrepKey } from '../lib/prep-store.mjs';
import { makeBackup, readBackup, planRestore, opponentDocs } from '../lib/prep-backup.mjs';
import { loadMechanics } from '../lib/calc/mech.mjs';
import { createCalc } from '../lib/calc/wrapper.mjs';
import { currentVersion, versionOf, rosterDiff } from '../lib/prep-model.mjs';
import { staleReasons } from '../lib/calc/keys.mjs';
import { scheduleFor, groupOf } from '../lib/schedule.mjs';
import { ENGINE_INFO, importEngine } from './prep-engine.js';
import * as C from './prep-copy.js';
import { esc, btn, h2, select, term } from './prep-ui.js';
import * as Sets from './prep-sets.js';
import * as Calcs from './prep-calcs.js';
import * as Plan from './prep-plan.js';
import * as Practice from './prep-practice.js';
import * as Matchup from './prep-matchup.js';
import * as Chat from './prep-chat.js';
import * as TB from './prep-teambuilder.js';

const SAVE_DELAY = 400;
const TAB_LABEL = { brief: 'Brief', plan: 'Plan', sets: 'Sets', calcs: 'Calcs', practice: 'Practice' };
const MODULES = [Sets, Calcs, Plan, Practice, Matchup, Chat, TB];

/**
 * app: { dex, league(), sheet(), usage(), coresCx(), viewingCoach(), setViewingCoach(name), goMode(mode), toast(msg),
 * rerender(), storage, crypto, history, location, now(), loadMechanics() -> Promise<json>, download(name, text, type),
 * copyText(text) -> Promise, readClipboard() -> Promise<string>, persist: {persisted(), persist()} | null, appBuild }
 */
/** The app shell this Prep needs (public/app.js prepApp.shellVersion). An older shell gets a "Reload" screen and no writes. */
export const SHELL_VERSION = 3; // 3: the shell provides schedule() (the league pairings)
function outdatedShell(app) {
  const msg = 'Drafarig was updated while this page was open. Reload the page to open Battle Prep. Nothing was changed.';
  return {
    P: null, render: () => `<div class="prep" data-prep-view="outdated"><section class="panel">${h2('Reload to continue')}<p>${esc(msg)}</p>${btn('Reload', 'reload-page', {}, { primary: true })}</section></div>`,
    click(t) { if (t?.dataset?.pa === 'reload-page') { try { app.location.reload(); } catch { /* no reload here */ } return true; } return false; },
    change: () => false, input: () => false, applyHash: () => true, hash: () => '#prep', consumeFocus: () => null, onStorage() {}, onHidden() {}, init() {}, flush() {}, setPersisted() {}, saveUi() {}, escape() {},
  };
}
export function createPrep(app) {
  if (app.shellVersion !== SHELL_VERSION) return outdatedShell(app);
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
    const idx = [...P.ws.values()].map((w) => ({ id: w.id, coach: w.coach, ...(ownerOf(w) ? { pov: w.pov } : {}), updatedAt: w.updatedAt, archived: false, ...(listed.get(w.id) ?? {}) }));
    if (JSON.stringify(idx.map((w) => w.id).sort()) !== JSON.stringify([...listed.keys()].sort())) { P.docs.meta = { ...P.docs.meta, workspaces: idx }; P.dirty.add(KEYS.meta); }
    if (P.dirty.size) flush();
  };

  // ---------- save ----------
  const keyOf = (which) => (which.startsWith('ws:') ? wsKey(which.slice(3)) : KEYS[which]);
  const docFor = (key) => (key === KEYS.meta ? P.docs.meta : key === KEYS.rules ? P.docs.rules : key === KEYS.mysets ? P.docs.mysets : key === KEYS.pilot ? P.docs.pilot : P.ws.get(key.slice(wsKey('').length)));
  const setDoc = (key, d) => { if (key === KEYS.meta) P.docs.meta = d; else if (key === KEYS.rules) P.docs.rules = d; else if (key === KEYS.mysets) P.docs.mysets = d; else if (key === KEYS.pilot) P.docs.pilot = d; else P.ws.set(d.id, d); };
  /** Apply a change to a document (on a deep copy) and schedule an autosave. which: meta | rules | mysets | pilot | 'ws:<id>'. */
  P.mutate = (which, fn, { substantive = true, render = true, allowUnassigned = false } = {}) => {
    if (P.readOnly()) { P.toast(C.SAVE.newer); return false; }
    // My sets is your own library: viewing as another coach never writes into it (their ideas stay in their prep)
    if (which === 'mysets' && !P.canWriteMine()) { P.toast(P.myCoach() ? C.POV.mineBlocked(P.myCoach()) : C.POV.assignFirst); return false; }
    // A workspace saved before perspectives is read-only until you say whose it is (its own review screen does that)
    if (which.startsWith('ws:') && !allowUnassigned && P.ws.has(which.slice(3)) && !ownerOf(P.ws.get(which.slice(3)))) { P.toast(C.POV.assignFirst); return false; }
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
    let failed = null, copyMissed = false;
    for (const key of keys) {
      const doc = docFor(key);
      if (!doc) { P.dirty.delete(key); continue; }
      if (P.revs.get(key) === 'corrupt') { failed = { code: 'corrupt', key }; continue; } // never overwrite unread data
      if (P.conflicts.has(key)) { failed = { code: 'conflict', key }; continue; } // never overwrite the other tab's version
      const res = P.store.save(key, doc, P.revs.get(key) ?? null);
      if (res.ok) { P.revs.set(key, res.doc.rev); P.saveIds.set(key, res.doc.saveId); setDoc(key, res.doc); P.dirty.delete(key); if (res.vaultFailed) copyMissed = true; }
      else { failed = { code: res.code, key }; if (res.code === 'conflict') P.conflicts.add(key); if (res.code === 'newer') P.newer.add(key); }
    }
    P.saveState = failed ? 'error' : 'saved';
    const before = P.saveError;
    P.saveError = failed;
    // a save whose recovery copy didn't fit shows its warning at once (P.copyBehind), also when the edit itself didn't re-render
    const copyWas = P.copyWasBehind ?? false;
    P.copyWasBehind = copyMissed || P.copyBehind().length > 0;
    if (failed || before || copyMissed || copyWas !== P.copyWasBehind) app.rerender();
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
    // a failed load waits for "Retry" (retry-mech): retrying on every render would fetch and re-render without end
    if (P.mech || P.mechState === 'loading' || P.mechState === 'failed') return;
    P.mechState = 'loading';
    app.loadMechanics().then((raw) => { P.mech = loadMechanics(raw); P.mechState = 'ready'; app.rerender(); })
      .catch(() => { P.mechState = 'failed'; app.rerender(); });
  };
  P.ensureEngine = () => {
    P.ensureMech();
    if (P.calc || P.engineState === 'loading' || P.engineState === 'failed') return; // failed: waits for "Retry" (calc-retry-engine)
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
  // ---------- perspective (whose side) ----------
  P.coaches = () => P.league()?.coaches ?? null;
  P.coachBySeat = (seat) => P.coaches()?.find((c) => c.order === seat) ?? null;
  P.seatOf = (name) => P.coaches()?.find((c) => c.name === name)?.order ?? null;
  P.identity = () => identityOf(P.docs.meta);
  /** The Draft coach setting, as stored (or the shipped default when nothing is stored); never Draft's seat fallback. */
  P.hint = () => app.identityHint?.() ?? null;
  P.resolvePov = (urlSeat = null) => resolvePov({ urlSeat, coaches: P.coaches(), meta: P.docs.meta, hint: P.hint() });
  /** The perspective of the screen being shown (matchup or overview), else the default one; null when none. */
  P.currentPov = () => {
    const r = P.route;
    if (isMatch(r) && r.names?.pov) return r.names.pov;
    if ((r.view === 'overview' || isMatch(r)) && P.coachBySeat(r.pov)) return P.coachBySeat(r.pov).name;
    if (r.view === 'ws' && r.wsId && ownerOf(P.ws.get(r.wsId))) return ownerOf(P.ws.get(r.wsId));
    return P.lastPov ?? P.resolvePov(null).name ?? null;
  };
  /**
   * Your own side, the owner of your library (My sets): the confirmed identity; without one, the Draft coach setting while it is
   * the default perspective offered with "Is this you?" (on the sheet when the sheet is loaded). Never a perspective chosen in
   * the address, a flip, the last one viewed, or Draft's seat fallback.
   */
  P.ownSide = () => {
    const ident = P.identity();
    if (ident) return ident;
    if (!P.coaches()) return P.hint()?.name ?? null;
    const d = P.resolvePov(null);
    return d.name && ['setting', 'default'].includes(d.source) ? d.name : null;
  };
  /**
   * "Your" side on the screen: the open workspace's owner (none for a workspace saved before perspectives: nothing is inferred
   * for it), else the perspective being shown; tools (My sets, rules, backup, pilot) are your own side.
   */
  P.myCoach = () => {
    const r = P.route;
    const ws = r.view === 'ws' && r.wsId ? P.ws.get(r.wsId) : null;
    if (ws) return ownerOf(ws);
    if (r.view === 'overview' || isMatch(r)) return P.currentPov();
    return P.ownSide();
  };
  /** Writes to My sets (your library) only from your own side. */
  P.canWriteMine = () => { const own = P.ownSide(); return !!own && P.myCoach() === own; };
  /** Your library as "your" sets on this screen: empty while viewing as another coach (never shown as their exact sets). */
  P.mineSets = () => (P.canWriteMine() ? P.docs.mysets.sets : []);
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
  /** quiet: the same screen, re-resolved (e.g. its prep was just created): keeps scroll and focus instead of moving them. */
  P.go = (route, { push = null, quiet = false } = {}) => {
    const to = P.resolve(P.canonical(route));
    const kind = push === null ? navKind(P.route, to) : push ? 'push' : 'replace';
    // Unsaved work lands before the screen changes: pending autosaves are written and screen drafts kept for this tab.
    if (P.dirty.size) flush();
    P.saveUi();
    const hash = formatRoute(to);
    const names = isMatch(to) ? to.names ?? null : null, wsId = isMatch(to) ? to.wsId ?? null : null;
    try { if (kind === 'push') app.history.pushState({ prep: true, names, wsId }, '', hash); else app.history.replaceState({ prep: !!app.history.state?.prep, names, wsId }, '', hash); } catch { /* history unavailable */ }
    P.route = P.resolve({ ...(parseRoute(hash) ?? { view: 'home' }), ...(names ? { names, wsId } : {}) });
    if (P.route.view === 'ws' && P.ws.has(P.route.wsId)) P.store.hint('lastRoute', hash); // for "Continue"; not a document
    if (!quiet) P.pendingFocus = true;
    app.rerender();
  };
  /**
   * The address a route should have: Battle Prep home goes to the overview of the default perspective. A saved workspace
   * opened by id keeps its id form (it is pinned to that document); a section change inside a matchup that is showing that
   * same workspace keeps the matchup form (same pinned workspace).
   */
  P.canonical = (r) => {
    if (!r) return { view: 'home' };
    // the retired Build dashboard (#prep/<p>v<o>/build/<n>): the teambuilder for that pick's set, in this matchup's prep
    if (isMatch(r) && r.detail?.side === 'build' && P.coaches()) {
      const pov = r.names?.pov ? P.coaches().find((c) => c.name === r.names.pov) : P.coachBySeat(r.pov);
      const opp = r.names?.opp ? P.coaches().find((c) => c.name === r.names.opp) : P.coachBySeat(r.opp);
      const sp = pov?.picks[r.detail.n - 1]?.id;
      const ws = pov && opp ? workspacesFor([...P.ws.values()], pov.name, opp.name)[0] : null;
      const inSix = new Set((ws?.my6 ?? []).map((x) => x.setId));
      const sets = sp && P.ownSide() === pov?.name ? P.docs.mysets.sets.filter((s) => s.speciesId === sp) : [];
      const l = sets.find((s) => inSix.has(s.id)) ?? sets[0];
      if (l) return ws ? { view: 'ws', wsId: ws.id, kind: 'sets', id: l.id } : { view: 'my-sets', id: l.id };
      return { view: 'ws', pov: r.pov, opp: r.opp, tab: 'sets' };
    }
    if (r.view === 'home') { const pv = P.resolvePov(null); return pv.name ? { view: 'overview', pov: pv.seat } : r; }
    const cur = P.route;
    if (r.view === 'ws' && !r.kind && !isMatch(r) && r.wsId && isMatch(cur) && cur.wsId === r.wsId) {
      return { view: 'ws', pov: cur.pov, opp: cur.opp, names: cur.names, wsId: cur.wsId, tab: MATCH_TABS.includes(r.tab) ? r.tab : 'plan' };
    }
    // a link drawn on this matchup (section tab, detail, Back to the briefing) means these same two coaches and workspace,
    // even if the sheet's seats moved since it was drawn; "their side" swaps the two coaches
    if (isMatch(r) && !r.names && isMatch(cur) && cur.names) {
      if (r.pov === cur.pov && r.opp === cur.opp) return { ...r, names: cur.names, wsId: cur.wsId };
      if (r.pov === cur.opp && r.opp === cur.pov) return { ...r, names: { pov: cur.names.opp, opp: cur.names.pov }, wsId: null };
    }
    return r;
  };
  /**
   * A matchup route is pinned to coach names when it is opened (seats are only how the address spells it): the sheet is
   * re-read every 45 s and seats could move, but the screen and every edit keep pointing at the same two coaches. It gets
   * the id of the workspace saved for (perspective, opponent), or null when there is none yet. While the sheet is loading
   * nothing is resolved (nothing is created, no perspective is defaulted).
   */
  P.resolve = (r) => {
    if (!isMatch(r)) return r;
    if (!P.coaches()) return { ...r, wsId: null };
    const names = r.names ?? { pov: P.coachBySeat(r.pov)?.name ?? null, opp: P.coachBySeat(r.opp)?.name ?? null };
    if (!names.pov || !names.opp) return { ...r, names: null, wsId: null };
    const ps = P.seatOf(names.pov), os = P.seatOf(names.opp);
    const moved = ps !== r.pov || os !== r.opp;
    // the workspace is pinned when the matchup is opened: a pinned one that still belongs to these two coaches is kept, whatever
    // newer copy appears; only a missing one is looked up (newest, or the copy chosen in this tab)
    const pinned = r.wsId ? P.ws.get(r.wsId) : null;
    const keep = pinned && ownerOf(pinned) === names.pov && pinned.coach === names.opp;
    const list = keep ? [] : workspacesFor([...P.ws.values()], names.pov, names.opp);
    const pick = keep ? pinned : list.find((w) => w.id === P.ui.activeWs?.[`${names.pov}|${names.opp}`]) ?? list[0];
    // a pinned coach who is no longer on the sheet: keep the names, offer nothing new (P.match returns null)
    return { ...r, names, wsId: pick?.id ?? null, ...(ps && os && moved ? { pov: ps, opp: os, seatsMoved: true } : {}) };
  };
  /** Bring the route in line with what is stored and loaded now (the sheet may have arrived); the address follows quietly. */
  function settleRoute() {
    const r = P.resolve(P.canonical(P.route));
    // compare with the address itself: a malformed one (#prep/5v5) is re-spelled as the route it was read as
    const before = app.location?.hash ?? formatRoute(P.route), after = formatRoute(r);
    P.route = r;
    if (r.seatsMoved && !P.seatsNoted) { P.seatsNoted = true; P.toast(C.POV.seatsMoved(r.names.pov, r.names.opp)); }
    const st = app.history.state;
    if (after !== before || (isMatch(r) && r.names && (!st?.names || (st.wsId ?? null) !== (r.wsId ?? null)))) {
      try { app.history.replaceState({ prep: !!st?.prep, names: isMatch(r) ? r.names ?? null : null, wsId: isMatch(r) ? r.wsId ?? null : null }, '', after); } catch { /* history unavailable */ }
    }
  }
  /** Back to the parent: history.back() when the previous entry is ours, else replace with the parent. */
  P.back = () => {
    const st = app.history.state;
    if (st && st.prep) app.history.back(); else P.go(parentRoute(P.route), { push: false });
  };
  P.applyHash = (hash) => {
    const r = parseRoute(hash);
    if (!r) return false;
    if (P.docs.meta && P.dirty.size) flush();
    if (P.docs.meta) P.saveUi();
    // Back / Forward: the entry remembers which two coaches it showed
    const st = app.history?.state;
    P.route = isMatch(r) && st?.names?.pov && st.names.opp ? { ...r, names: st.names, wsId: st.wsId ?? null } : r;
    P.seatsNoted = false;
    P.pendingFocus = true;
    return true;
  };
  /** After the next render, move focus (and the view) to a section of the screen instead of its heading. */
  P.focusOn = (id) => { P.pendingFocus = true; P.pendingFocusId = id; app.rerender(); };
  /** The element id to focus after this render ('prep-h' = the screen heading after a navigation), or null. */
  P.consumeFocus = () => { const f = P.pendingFocus ? P.pendingFocusId ?? 'prep-h' : null; P.pendingFocus = false; P.pendingFocusId = null; return f; };

  // ---------- screen drafts a prefill would replace (ask first) ----------
  const DRAFT_SLOTS = {
    cd: { live: (d) => !!(d && d.move && !d.calcId), what: (d) => C.POV.draftCalc(P.spName(d.a?.species ?? ''), P.spName(d.d?.species ?? '')), same: (a, b) => a?.a?.species === b?.a?.species && a?.d?.species === b?.d?.species && a?.move === b?.move },
    th: { live: (d) => !!(d && (d.result || d.mine || d.their || d.theirSpecies)), what: () => C.POV.draftThreshold, same: (a, b) => a?.kind === b?.kind && a?.mine === b?.mine && a?.theirSpecies === b?.theirSpecies },
  };
  /**
   * Put a prefilled draft into a workspace's screen slot ('cd' quick check, 'th' "What would it take?") and open `route`,
   * unless an unsaved draft is there: then nothing is replaced and a banner asks (Open it / Replace it / Cancel).
   */
  P.prefill = (ws, slot, next, route, { then = null } = {}) => {
    const ui = P.wsUi(ws.id), cur = ui[slot], spec = DRAFT_SLOTS[slot];
    if (spec.live(cur) && !spec.same(cur, next)) { P.pendingReplace = { wsId: ws.id, slot, next, route, then, existing: spec.what(cur) }; app.rerender(); return false; }
    ui[slot] = next; P.pendingReplace = null;
    then?.();
    if (route) P.go(route, { push: true }); else { P.saveUi(); app.rerender(); } // P.go keeps screen drafts for this tab itself
  };
  const KIND_OF_SLOT = { cd: { kind: 'calcs', id: 'new' }, th: { kind: 'threshold' } };

  // ---------- workspace helpers ----------
  /**
   * The workspace for (pov, opp): the newest saved one, or a new one with that pov. Only called from an explicit tap (start
   * prep, a section tab, + My 6, Next match, a prefilled check), never from showing a screen or following an address.
   */
  P.ensureWorkspace = (pov, opp) => {
    const key = `${pov}|${opp}`;
    const list = workspacesFor([...P.ws.values()], pov, opp);
    const existing = list.find((w) => w.id === P.ui.activeWs?.[key]) ?? list[0];
    if (existing) return existing;
    if (P.readOnly()) { P.toast(C.SAVE.newer); return null; }
    if (!pov || !opp || pov === opp) return null;
    const id = P.id('ws');
    const roster = { fetchedAt: app.sheet()?.fetchedAt ?? null, speciesIds: P.coachRoster(opp), points: Object.fromEntries((P.league()?.coaches.find((c) => c.name === opp)?.picks ?? []).filter((p) => p.id).map((p) => [p.id, p.points])) };
    const ws = newWorkspace({ id, coach: opp, roster, now: P.now(), pov });
    P.ws.set(id, ws); P.revs.set(wsKey(id), null);
    P.dirty.add(wsKey(id));
    P.docs.meta = { ...P.docs.meta, workspaces: [...P.docs.meta.workspaces, { id, coach: opp, pov, updatedAt: ws.updatedAt, archived: false }] };
    P.dirty.add(KEYS.meta);
    flush();
    return P.ws.get(id);
  };
  /** Open prep vs a coach from the current perspective (creates the workspace: an explicit tap). */
  P.openWorkspace = (coach) => {
    const pov = P.currentPov();
    const ws = pov && P.ensureWorkspace(pov, coach);
    if (ws) P.go({ view: 'ws', wsId: ws.id, tab: 'plan' }, { push: true });
  };
  /** The matchup a seat route names: {pov, opp} coaches (or null while the sheet loads / for an unknown seat). */
  P.match = (r = P.route) => {
    if (!isMatch(r) || !P.coaches()) return null;
    const by = (name, seat) => (name ? P.coaches().find((c) => c.name === name) : P.coachBySeat(seat)) ?? null;
    const pov = by(r.names?.pov, r.pov), opp = by(r.names?.opp, r.opp);
    return pov && opp && pov.name !== opp.name ? { pov, opp, ws: r.wsId ? P.ws.get(r.wsId) ?? null : null } : null;
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
    settleRoute();
    const r = P.route;
    let body;
    try {
      if (r.view === 'home' || r.view === 'overview') body = home(r);
      else if (r.view === 'rules') body = rulesScreen();
      else if (r.view === 'backup') body = backupScreen();
      else if (r.view === 'pilot') body = Practice.pilot(P);
      else if (r.view === 'my-sets') { const l = r.id ? P.docs.mysets.sets.find((s) => s.id === r.id) : null; body = l ? `<section class="panel prep-set">${TB.editor(P, null, l)}</section>` : Sets.mySets(P, r); }
      else if (isMatch(r)) body = matchScreen(r);
      else if (r.view === 'ws') {
        const ws = P.ws.get(r.wsId);
        body = ws ? workspace(ws, r) : notOnDevice();
      } else body = home(r);
    } catch (e) {
      console.error('Prep screen failed:', e && e.message);
      body = `<section class="panel">${h2('Prep')}<p class="banner bad" role="alert">This screen couldn't be shown. Your prep is unchanged.</p>${btn('Go to Prep home', 'go-home')}</section>`;
    }
    // chat sits under the open screen (it talks about that screen); a chat failure never takes the screen with it
    let chat = '';
    try { chat = Chat.panel(P); } catch (e) { console.error('Chat panel failed:', e && e.message); }
    // drill-downs (a set, a calc, a variant…) get the same "ask about this screen" line as the matchup screens
    const drill = ((r.view === 'ws' && r.kind && P.ws.has(r.wsId)) || (r.view === 'my-sets' && r.id)) && !Chat.chatUi(P).open;
    if (drill) chat = `<p class="chat-foot">${Chat.entry(C.CHATUI.openHere)}</p>`;
    return `<div class="prep" data-prep-view="${esc(r.view)}">${banners()}${body}${chat}</div>`;
  };

  /**
   * Recovery copies whose workspace an older Drafarig tab removed, or replaced with an unassigned copy (its Archive or
   * "Replace everything" never saw the assignment). Nothing is put back without a tap.
   */
  P.recoverable = () => [...P.store.vault.list().map((x) => ({ ...x, src: 'vault' })), ...P.store.keep.list().map((x) => ({ ...x, src: 'keep' }))].filter(({ id, doc, src }) => {
    if (!ownerOf(doc)) return false; // a copy with no real owner (a self-matchup from a file) is never offered; it is left as is
    const r = P.store.load(wsKey(id));
    if (r.status === 'missing') return true;
    // an older tab put back a copy without the assignment, or (keep copies) one without the Plan board picks (version < 3)
    return r.status === 'ok' && (ownerOf(r.doc) !== doc.pov || (src === 'keep' && (r.doc.schemaVersion ?? 1) < 3));
  });
  const copyStore = (src) => (src === 'keep' ? P.store.keep : P.store.vault);
  /**
   * Assigned earlier workspaces whose recovery copy is missing or older than what is saved (the copy didn't fit: storage
   * nearly full). Worked out from storage, so it survives a reload and other tabs, and clears by itself once a later save
   * writes the copy.
   */
  P.copyBehind = () => [...P.ws.values()].filter((w) => {
    const keep = (w.schemaVersion ?? 1) >= 3;
    if ((!keep && w.povFrom !== 'legacy-confirm') || !ownerOf(w)) return false;
    const rev = P.revs.get(wsKey(w.id));
    if (!Number.isInteger(rev)) return false;
    const copy = (keep ? P.store.keep : P.store.vault).get(w.id);
    return !copy || !Number.isInteger(copy.rev) || copy.rev < rev;
  });
  const when = (iso) => (typeof iso === 'string' && !Number.isNaN(Date.parse(iso)) ? `${iso.slice(0, 16).replace('T', ' ')} UTC` : 'an unknown time');
  function banners() {
    const out = [];
    for (const { id, doc, src } of P.recoverable()) {
      out.push(`<div class="banner warn" role="group" aria-label="${esc(C.POV.vaultGroup)}">${esc(C.POV.vaultText(doc.pov, doc.coach, when(doc.updatedAt), P.store.load(wsKey(id)).status === 'missing'))} ${btn(C.POV.vaultRecover, 'vault-recover', { ws: id, src }, { primary: true })} ${btn(C.POV.vaultDiscard, 'vault-discard', { ws: id, src })}</div>`);
    }
    for (const w of P.copyBehind()) {
      out.push(`<div class="banner warn" role="group" aria-label="${esc(C.POV.copyGroup)}">⚠ ${esc(C.POV.copyFailed(ownerOf(w), w.coach))} ${btn('Download a backup now', 'backup-download', {}, { primary: true })} ${btn('Free up space…', 'go-backup')} ${btn(C.POV.copyRetry, 'vault-retry', { ws: w.id })}</div>`);
    }
    const pr = P.pendingReplace;
    if (pr && P.ws.has(pr.wsId)) out.push(`<div class="banner warn" role="group" aria-label="${esc(C.POV.draftGroup)}">${esc(pr.existing)} ${esc(C.POV.draftAsk)} ${btn(C.BRIEF.openIt, 'draft-open', {}, { primary: true })} ${btn(C.BRIEF.replaceIt, 'draft-replace')} ${btn(C.BRIEF.cancel, 'draft-cancel', {}, { cls: 'linkish' })}</div>`);
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
    const now = [P.newer.size && C.SAVE.newer, P.saveError && P.saveError.code !== 'conflict' && saveErrorText(), P.conflicts.size && C.SAVE.conflict({ what: 'Your prep' }), P.corrupt.size && C.SAVE.corrupt,
      ...P.copyBehind().map((w) => C.POV.copyFailed(ownerOf(w), w.coach))].filter(Boolean);
    const key = now.join('|');
    if (key && key !== P.announcedBanners) app.announce?.(now.join(' '));
    P.announcedBanners = key;
  }
  function notOnDevice() {
    return `<section class="panel">${h2('Not on this device')}<p>${esc(C.NOT_ON_DEVICE)}</p>${btn('Go to Prep', 'go-home', {}, { primary: true })}</section>`;
  }

  // ---------- perspective row and opponent strip ----------
  /** "Preparing as …" with where that comes from; never says who the user is. */
  function povRow(povName, src) {
    const coaches = P.coaches() ?? [];
    const ident = P.identity();
    const picker = select('prep-pov', [['', 'Prepare as…'], ...coaches.map((c) => [String(c.order), c.name])], '', { data: { pc: 'pov-pick' }, aria: C.POV.choose, cls: 'povpick' });
    if (!povName) return `<div class="povrow" role="group" aria-label="${esc(C.POV.group)}"><p><b>${esc(C.POV.who)}</b></p>${picker}</div>`;
    const viewing = ident && ident !== povName && P.seatOf(ident);
    const source = src === 'identity' || ident === povName ? `<span class="chip ok">${esc(C.POV.you)}</span>` : `<span class="small muted">${esc(C.POV.source[src] ?? C.POV.source.url)}</span>`;
    return `<div class="povrow${viewing ? ' viewing' : ''}" role="group" aria-label="${esc(C.POV.group)}">
      <p class="povline">${esc(C.POV.preparing)} <b>${esc(povName)}</b> ${source}</p>
      ${viewing ? `<p class="ribbon">${esc(C.POV.viewingAs(povName))} ${btn(C.POV.backTo(ident), 'pov-back', {}, { primary: true })}</p>` : ''}
      ${!ident && (src === 'setting' || src === 'default') && P.resolvePov(null).name === povName ? `<p class="confirm">${esc(C.HOME.isThisYou)} ${btn('Yes', 'confirm-me', { coach: povName }, { primary: true })}</p>` : ''}
      <details class="povchange"><summary>${esc(C.POV.change)}</summary>${picker}</details></div>`;
  }
  /** The opponent row: every other coach in sheet seat order, as links; the current one marked. */
  function oppStrip(pov, activeSeat) {
    const coaches = (P.coaches() ?? []).filter((c) => c.name !== pov.name);
    const tab = (c) => {
      const ws = workspacesFor([...P.ws.values()], pov.name, c.name)[0];
      const face = c.picks.find((p) => p.id)?.id;
      const played = ws?.matches.find((m) => (m.games ?? []).some((g) => g.result));
      const wk = P.weeksVs(pov.name, c.name)?.weeks ?? [];
      const marks = [wk.length ? C.SCHED.weeks(wk) : '', ws?.isNext ? C.BRIEF.stripNext : '', played ? C.BRIEF.stripPlayed : ''].filter(Boolean);
      const name = `${c.name}${marks.length ? `, ${marks.join(', ')}` : ''}`;
      return `<li><a href="${esc(formatRoute({ view: 'ws', pov: pov.order, opp: c.order, tab: 'brief' }))}" data-pa="go-opp" data-opp="${c.order}" class="opptab${c.order === activeSeat ? ' active' : ''}"${c.order === activeSeat ? ' aria-current="page"' : ''} aria-label="${esc(name)}" title="${esc(c.name)}">${face ? P.pt(face, { size: 'sm' }) : '<span class="pt pt-sm noimg" data-ini="?"></span>'}<span class="oppname">${esc(c.name)}</span>${wk.length ? `<span class="tabmark wk" aria-hidden="true">${weekBadge(wk)}</span>` : ''}${ws?.isNext ? `<span class="tabmark next" aria-hidden="true">${esc(C.BRIEF.stripNext)}</span>` : ''}${played ? `<span class="tabmark played" aria-hidden="true">✓ ${esc(C.BRIEF.stripPlayed)}</span>` : ''}</a></li>`;
    };
    const jump = select('prep-oppjump', [['', C.BRIEF.allOpponents(coaches.length)], ...coaches.map((c) => [String(c.order), `${c.order}. ${c.name}`])], '', { data: { pc: 'opp-jump' }, aria: C.BRIEF.jumpLabel, cls: 'oppjump' });
    return `<nav class="oppstrip" aria-label="Opponents"><ol><li><a href="${esc(formatRoute({ view: 'overview', pov: pov.order }))}" data-pa="go-overview" class="opptab overview${activeSeat === null ? ' active' : ''}"${activeSeat === null ? ' aria-current="page"' : ''}><span class="oppname">${esc(C.BRIEF.overview)}</span></a></li>${coaches.map(tab).join('')}</ol>${jump}</nav>`;
  }
  P.pt = (id, opts = {}) => app.portrait?.(id, opts) ?? `<span class="pt pt-${esc(opts.size ?? 'sm')} noimg" data-ini="${esc(P.spName(id).slice(0, 2))}"></span>`;

  // ---------- league schedule: read-only facts from the sheet's Paring tab ----------
  // Weeks, groups, pairs and byes only. Nothing here writes prep, identity or "next match", and no week is ever called
  // current: the sheet has no dates, results or current week.
  /** One perspective's weeks: {state, fetchedAt, stale, group, rows: [{week, group, opponent|null, raw, bye}], pairings}. */
  P.weeks = (povName) => {
    const s = app.schedule?.() ?? { state: 'missing' };
    if (s.state !== 'ok' || !s.pairings) return { state: s.state ?? 'missing', rows: [] };
    const rows = scheduleFor(s.pairings, povName);
    return { state: 'ok', fetchedAt: s.fetchedAt, stale: !!s.stale, group: rows[0]?.group ?? '', rows, pairings: s.pairings };
  };
  /** The weeks a perspective plays one opponent, or null when there's no schedule to say it from (or the POV isn't in it). */
  P.weeksVs = (povName, oppName) => {
    const w = P.weeks(povName);
    if (w.state !== 'ok' || !w.rows.length) return null;
    return { weeks: w.rows.filter((x) => x.opponent === oppName).map((x) => x.week), group: w.group, oppGroup: groupOf(w.pairings, oppName), span: C.SCHED.span(w.pairings.weeks.map((x) => x.week)) };
  };
  // the read time in the device's local time, as the top bar and Draft › League say it
  const hhmm = (iso) => (iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');
  /** "W1·W5" for a tab or card badge, or '' */
  const weekBadge = (weeks) => weeks.map((n) => `W${n}`).join('·');
  /** The overview's "Your weeks" strip, or the one line that says why there isn't one. */
  function weeksStrip(pov) {
    const w = P.weeks(pov.name);
    if (w.state !== 'ok') return P.league() ? `<p class="small muted sched-line">${esc(C.SCHED[w.state] ?? C.SCHED.unreadable)}</p>` : '';
    if (!w.rows.length) return `<p class="small muted sched-line">${esc(C.SCHED.notListed(pov.name))}</p>`;
    const tile = (x) => {
      if (x.bye) return `<li><span class="wktile bye"><span class="wkchip" aria-hidden="true">W${x.week}</span><span class="wkname" aria-hidden="true">${esc(C.SCHED.bye)}</span><span class="sr-only">${esc(C.SCHED.tileBye(x.week))}</span></span></li>`;
      const seat = x.opponent && P.seatOf(x.opponent);
      if (!seat) return `<li><span class="wktile raw"><span class="wkchip" aria-hidden="true">W${x.week}</span><i class="wkname" aria-hidden="true">${esc(x.raw)}</i><span class="chip unc" aria-hidden="true">?</span><span class="sr-only">${esc(C.SCHED.tileRaw(x.week, x.raw))}</span></span></li>`;
      const c = P.coachBySeat(seat), face = c.picks.find((p) => p.id)?.id;
      const marked = workspacesFor([...P.ws.values()], pov.name, c.name)[0]?.isNext;
      return `<li><a class="wktile" href="${esc(formatRoute({ view: 'ws', pov: pov.order, opp: seat, tab: 'brief' }))}" data-pa="go-opp" data-opp="${seat}" aria-label="${esc(C.SCHED.tile(x.week, c.name) + (marked ? `, ${C.SCHED.marked}` : ''))}"><span class="wkchip" aria-hidden="true">W${x.week}</span>${face ? P.pt(face, { size: 'sm' }) : '<span class="pt pt-sm noimg" data-ini="?"></span>'}<span class="wkname">${esc(c.name)}</span>${marked ? `<span class="tabmark next" aria-hidden="true">${esc(C.BRIEF.stripNext)}</span>` : ''}</a></li>`;
    };
    return `<div class="weeks"><h3>${esc(C.SCHED.head(w.group))}</h3><ol class="weekstrip">${w.rows.map(tile).join('')}</ol>
      <p class="small muted sched-line">${esc(C.SCHED.source(hhmm(w.fetchedAt)))}${w.stale ? ` <span class="chip tight">${esc(C.SCHED.stale(hhmm(w.fetchedAt)))}</span>` : ''}</p></div>`;
  }

  // ---------- Battle Prep overview (home) ----------
  function savedLists(povName, coaches) {
    const all = [...P.ws.values()].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
    const onSheet = (n) => coaches.some((c) => c.name === n);
    const unassigned = all.filter((w) => !ownerOf(w));
    const other = all.filter((w) => ownerOf(w) && ownerOf(w) !== povName && onSheet(w.coach));
    const orphan = all.filter((w) => coaches.length && (!onSheet(w.coach) || (ownerOf(w) && !onSheet(ownerOf(w)))) && ownerOf(w) !== povName);
    const counts = (w) => `${w.theirSets.length} sets · ${w.calcs.length} calcs · ${w.mockSets.reduce((t, m) => t + m.games.filter((g) => !g.draft).length, 0)} mock games · changed ${esc((w.updatedAt ?? '').slice(0, 10))}`;
    return `${unassigned.length ? `<h3>${esc(C.POV.unassignedHead(unassigned.length))}</h3><p class="small">${esc(C.POV.unassignedHelp)}</p><ul class="opps">${unassigned.map((w) => `<li class="opp started">${btn(`vs ${w.coach}`, 'open-ws', { ws: w.id }, { cls: 'opp-btn' })} ${btn(C.POV.review, 'go-owner', { ws: w.id }, { cls: 'linkish' })}<div class="small muted">${counts(w)}</div></li>`).join('')}</ul>` : ''}
      ${other.length ? `<h3>${esc(C.POV.otherHead(other.length))}</h3><ul class="opps">${other.map((w) => `<li class="opp started">${btn(`${ownerOf(w)} vs ${w.coach}`, 'open-ws', { ws: w.id }, { cls: 'opp-btn' })}<div class="small muted">${counts(w)}</div></li>`).join('')}</ul>` : ''}
      ${orphan.length ? `<h3>Other saved prep</h3><ul class="opps">${orphan.map((w) => `<li class="opp started">${btn(`${ownerOf(w) ? `${ownerOf(w)} ` : ''}vs ${w.coach}`, 'open-ws', { ws: w.id }, { cls: 'opp-btn' })} <span class="small muted">not on the sheet now</span></li>`).join('')}</ul>` : ''}`;
  }
  function tools() {
    const meta = P.docs.meta;
    const lastHash = P.store.hint('lastRoute') ?? meta.lastRoute;
    const last = lastHash && parseRoute(lastHash);
    const lastWs = last && (last.wsId ? P.ws.get(last.wsId) : P.resolve(last).wsId ? P.ws.get(P.resolve(last).wsId) : null);
    const rules = P.docs.rules.rules;
    const known = Object.values(rules).filter((x) => x.value !== 'unknown').length;
    const usage = P.store.usage();
    const backupAge = meta.lastBackupAt ? Math.floor((Date.parse(P.now()) - Date.parse(meta.lastBackupAt)) / 864e5) : null;
    const nag = (backupAge === null || backupAge > 7) && (meta.changesSinceBackup ?? 0) > 0;
    const mineCount = P.docs.mysets.sets.length;
    return `${nag ? `<p class="banner warn">${esc(meta.lastBackupAt ? `Last backup ${backupAge} days ago` : 'No backup yet')}: ${meta.changesSinceBackup} changes since. ${btn('Back up now', 'backup-download', {}, { primary: true })}</p>` : ''}
      ${lastWs ? `<p>${btn(`Continue: ${ownerOf(lastWs) ? `${ownerOf(lastWs)} ` : ''}vs ${lastWs.coach}${last.tab ? ` · ${TAB_LABEL[last.tab] ?? ''}` : ''}`, 'continue')}</p>` : ''}
      <h3>${esc(C.BRIEF.toolsHead)}</h3>
      <ul class="toolrows">
        <li>${btn('Rules you know', 'go-rules', {}, { cls: 'linkish' })} <span class="small muted">${known} known · ${Object.keys(rules).length - known} don't know</span></li>
        <li>${btn('My sets', 'go-mysets', {}, { cls: 'linkish' })} <span class="small muted">${mineCount} set${mineCount === 1 ? '' : 's'} in your library</span> ${btn('Paste your team', 'go-mysets-import', {}, { cls: 'linkish' })}</li>
        <li>${btn('Help a friend practise (pilot card)', 'go-pilot', {}, { cls: 'linkish' })}</li>
        <li>${btn('Backup & restore', 'go-backup', {}, { cls: 'linkish' })} <span class="small muted backup-line">${esc(C.HOME.savedLocal)} Last backup: ${meta.lastBackupAt ? `${backupAge} days ago` : 'never'} (${meta.changesSinceBackup ?? 0} changes since).</span></li>
        <li>${Chat.chatUi(P).open ? btn(C.CHATUI.open, 'chat-open', {}, { cls: 'linkish' }) : Chat.entry(C.CHATUI.open)} <span class="small muted">${esc(C.CHATUI.title)}: it sees the screen you have open</span></li>
      </ul>
      <details class="howto"><summary>How prep works here (1 minute)</summary><ol>${C.HOME.how.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></details>
      ${usage > USAGE_BUDGET_CHARS * 0.85 ? `<p class="banner warn">Prep is using most of the space this browser allows. Archive finished opponents to a file. ${btn('Backup & restore', 'go-backup')}</p>` : ''}`;
  }
  function home(r) {
    const L = P.league();
    const coaches = L?.coaches ?? [];
    const def = P.resolvePov(null);
    // the overview of the default perspective says where that default comes from; another seat is "chosen here"
    const pv = r.view === 'overview' ? (def.name && def.seat === r.pov ? def : P.resolvePov(r.pov)) : def;
    if (pv.name) P.lastPov = pv.name;
    const pov = pv.name ? P.coachBySeat(pv.seat) : null;
    if (!pov) {
      const why = !L ? `<p class="small">${esc(app.sheet?.() === null && P.sheetFailed?.() ? C.BRIEF.sheetFailed : C.BRIEF.sheetLoading)}</p>`
        : pv.reason === 'unknown-seat' ? `<p class="banner warn">${esc(C.POV.unknownSeat)}</p>`
        : pv.reason === 'identity-not-on-sheet' ? `<p class="banner warn">${esc(C.POV.identityGone(pv.identity))}</p>` : '';
      return `<section class="panel prep-home">${h2(C.BRIEF.appName)}${why}${L ? povRow(null) : ''}
        ${savedLists(null, coaches)}${tools()}</section>`;
    }
    const opps = coaches.filter((c) => c.name !== pov.name);
    const next = [...P.ws.values()].find((w) => ownerOf(w) === pov.name && w.isNext && opps.some((c) => c.name === w.coach));
    const card = (c) => {
      const ws = workspacesFor([...P.ws.values()], pov.name, c.name)[0];
      const ids = c.picks.map((p) => p.id).filter(Boolean);
      const started = ws && (ws.theirSets.length || ws.calcs.length || ws.cards.length || ws.mockSets.length || ws.plans.length || ws.matchDate || ws.isNext);
      const status = !ws || !started ? C.HOME.notStarted : `${ws.theirSets.length} sets · ${ws.calcs.length} calcs`;
      const legacy = unassignedVs([...P.ws.values()], c.name).length;
      const vs = P.weeksVs(pov.name, c.name);
      const wk = vs ? (vs.weeks.length ? `<span class="chip wkc">${weekBadge(vs.weeks)}</span>` : `<span class="small muted">${esc(C.SCHED.notScheduled(vs.span))}</span>`) : '';
      return `<li><a class="oppcard" href="${esc(formatRoute({ view: 'ws', pov: pov.order, opp: c.order, tab: 'brief' }))}" data-pa="go-opp" data-opp="${c.order}">
        <span class="oc-head"><b>${esc(c.name)}</b> <span class="small muted">seat ${c.order} · ${ids.length}/10 drafted</span> ${wk}${ws?.isNext ? ` <span class="chip ok">${esc(C.BRIEF.stripNext)}</span>` : ''}</span>
        <span class="minis" aria-hidden="true">${ids.map((id) => P.pt(id, { size: 'xs' })).join('')}</span>
        <span class="small">${esc(status)}${legacy ? ` · ${esc(C.POV.earlierChip)}` : ''}</span></a></li>`;
    };
    return `<section class="panel prep-home">${povRow(pov.name, pv.source)}${oppStrip(pov, null)}
      ${h2(C.BRIEF.overviewHead(pov.name))}
      ${L ? weeksStrip(pov) : ''}
      ${next ? `<div class="nexthero"><p><b>${esc(C.BRIEF.nextMatch)}</b>: vs ${esc(next.coach)}${next.matchDate ? ` · ${esc(next.matchDate)}` : ''}</p><p>${btn(C.BRIEF.openBriefing, 'go-opp', { opp: P.seatOf(next.coach) }, { primary: true })}</p></div>` : ''}
      <h3>${esc(C.HOME.choose)}</h3><p class="small">${esc(C.HOME.chooseHelp)}</p>
      ${L ? `<ul class="oppcards">${opps.map(card).join('')}</ul>` : `<p class="small">${esc(C.BRIEF.sheetLoading)}</p>`}
      ${savedLists(pov.name, coaches)}${tools()}
    </section>`;
  }

  // ---------- matchup (seat routes) ----------
  function matchScreen(r) {
    const L = P.league();
    if (!L) return `<section class="panel prep-home">${h2(C.BRIEF.appName)}<p>${esc(P.sheetFailed?.() ? C.BRIEF.sheetFailedSeat : C.BRIEF.sheetLoading)}</p>${savedLists(null, [])}${tools()}</section>`;
    const m = P.match(r);
    if (!m) return `<section class="panel prep-home">${h2(C.BRIEF.appName)}<p class="banner warn">${esc(C.POV.unknownSeat)}</p>${btn(C.BRIEF.overview, 'go-home', {}, { primary: true })}</section>`;
    return matchView(r, m, false);
  }
  /**
   * The matchup shell (perspective, opponent row, hero, sections) around one section. idRoute: a saved workspace opened by
   * its id (#prep/w/<id>/<tab>): its sections stay pinned to that document; the Brief opens the matchup form pinned to it.
   */
  function matchView(r, m, idRoute) {
    P.lastPov = m.pov.name;
    const ident = P.identity();
    const src = ident === m.pov.name ? 'identity' : P.resolvePov(null).name === m.pov.name ? P.resolvePov(null).source : 'url';
    const ws = m.ws;
    const legacy = unassignedVs([...P.ws.values()], m.opp.name);
    // an old Build link (#…/build/<n>) that couldn't be redirected yet (sheet loading, no set): the Sets section
    const tab = r.detail?.side === 'build' ? 'sets' : MATCH_TABS.includes(r.tab) ? r.tab : idRoute ? 'plan' : 'brief';
    const dots = ws ? draftDots(ws) : {};
    const seatRoute = { view: 'ws', pov: m.pov.order, opp: m.opp.order };
    const hrefOf = (k) => formatRoute(idRoute && k !== 'brief' ? { view: 'ws', wsId: ws.id, tab: k } : { ...seatRoute, tab: k });
    const tabs = `<nav class="dtabs" aria-label="${esc(`Sections for vs ${m.opp.name}`)}">${MATCH_TABS.map((k) => `<a href="${esc(hrefOf(k))}" id="ptab-${k}" data-pa="tab" data-tab="${k}"${tab === k && !r.detail ? ' aria-current="page" class="active"' : ''}${dots[k] ? ` aria-label="${esc(`${TAB_LABEL[k]}, ${C.BRIEF.unsavedDot[k]}`)}"` : ''}>${esc(TAB_LABEL[k])}${dots[k] ? '<span class="dot" aria-hidden="true"></span>' : ''}</a>`).join('')}</nav>`;
    let body;
    if (tab === 'brief') body = Matchup.brief(P, { r, pov: m.pov, opp: m.opp, ws, legacy });
    else if (ws) body = tab === 'sets' ? Sets.tab(P, ws) : tab === 'calcs' ? Calcs.tab(P, ws) : tab === 'practice' ? Practice.tab(P, ws) : Plan.tab(P, ws);
    else body = (tab === 'plan' && !legacy.length && Plan.previewTab(P, m)) || startPanel(m, legacy, tab);
    return `<section class="panel prep-match" data-key="match">${povRow(m.pov.name, src)}${oppStrip(m.pov, m.opp.order)}
      ${Matchup.hero(P, { r, pov: m.pov, opp: m.opp, ws, legacy })}${tabs}<div id="ptab-panel">${body}</div>
      ${Chat.chatUi(P).open ? '' : `<p class="chat-foot">${Chat.entry(C.CHATUI.openHere)}</p>`}
      <p class="small muted ws-foot">${esc(C.HOME.savedLocal)} ${ws ? (P.saveState === 'saving' ? esc(C.SAVE.saving) : P.saveState === 'error' ? '' : esc(C.SAVE.saved)) : esc(C.BRIEF.nothingSaved)}</p></section>`;
  }
  /** A section tab without saved prep for this matchup: nothing is created until the user says so. */
  function startPanel(m, legacy, tab) {
    return `${h2(`vs ${m.opp.name} · ${TAB_LABEL[tab]}`)}<p>${esc(C.BRIEF.startHelp(m.pov.name, m.opp.name))}</p>
      <p>${btn(C.BRIEF.start(m.pov.name, m.opp.name), 'match-start-ws', { tab }, { primary: true })}</p>
      ${legacy.length ? `<p class="small">${esc(C.POV.earlierHere(m.opp.name))} ${legacy.map((w) => btn(`${C.POV.review} (${(w.updatedAt ?? '').slice(0, 10)})`, 'go-owner', { ws: w.id }, { cls: 'linkish' })).join(' ')}</p>` : ''}`;
  }
  /** Section tabs that hold an unsaved screen draft (session) or set-editor draft. */
  function draftDots(ws) {
    const ui = P.ui.ws[ws.id] ?? {};
    return {
      calcs: !!(ui.cd && ui.cd.move && !ui.cd.calcId),
      sets: !!(ui.imp?.text || Object.keys(ws.drafts ?? {}).length),
      practice: !!(ui.br?.purpose || ui.br?.partner || (ws.mockSets ?? []).some((x) => (x.games ?? []).some((g) => g.draft))),
    };
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
      ${wsList.length ? `<p class="small">An opponent file includes your sets for that match, your cards and notes: it is for your own devices, not for sharing as scouting.</p><ul class="small">${wsList.map((w) => `<li>${esc(wsLabel(w))} · ${btn('Export this opponent', 'ws-export-file', { ws: w.id })} ${btn('Archive (file + remove here)…', 'ws-archive', { ws: w.id }, { aria: `Archive ${wsLabel(w)}` })}
        ${ui.archivePending === w.id ? `<p class="banner warn">A file for ${esc(wsLabel(w))} was downloaded. Check it is in your downloads, then: ${btn(`Remove ${ownerOf(w) ? `${ownerOf(w)} ` : ''}vs ${w.coach} from this device`, 'ws-archive-confirm', { ws: w.id })} ${btn('Keep it here', 'ws-archive-cancel')}</p>` : ''}</li>`).join('')}</ul>` : ''}
      <h3>Delete</h3><p class="small">Removes only prep (drafarig.prep.*); your draft settings stay.</p>
      ${ui.confirmDelete ? `<p><label class="field" for="prep-delete-confirm"><span>Type delete to confirm</span><input id="prep-delete-confirm" data-pi="delete-confirm" value=""></label> ${btn('Download a backup first', 'backup-download')} ${btn('Delete all prep on this device', 'delete-all-confirm')}</p>` : btn('Delete all prep on this device…', 'delete-all')}
    </section>`;
  }
  /** One saved workspace in words: whose (or "earlier, not tied to a coach"), against whom, last changed. */
  const wsLabel = (w) => `${ownerOf(w) ? `${ownerOf(w)}'s prep` : 'Earlier prep (not tied to a coach)'} vs ${w?.coach ?? '?'}, changed ${String(w?.updatedAt ?? '').slice(0, 10) || 'unknown'}`;
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
      ${collide.length ? `<p class="small">Already on this device: ${collide.map((d) => `${esc(`${wsLabel(P.ws.get(d.id))} here; the file's copy: ${wsLabel(d)}`)} ${['add', 'replace', 'keep-both', 'skip'].filter((x) => x !== 'add').map((c) => btn(c === 'keep-both' ? 'Keep both' : c === 'replace' ? 'Replace' : 'Skip', 'restore-choice', { ws: d.id, choice: c }, { cls: `pchip${ui.choices?.[d.id] === c ? ' on' : ''}`, pressed: ui.choices?.[d.id] === c })).join('')}`).join(' · ')}</p>` : ''}</div>`;
  }

  // ---------- workspace shell ----------
  function workspace(ws, r) {
    const tab = r.tab ?? null;
    const owner = ownerOf(ws);
    // a perspective's workspace opened by id: the full matchup shell, pinned to this document
    if (!r.kind && owner) {
      const pov = (P.coaches() ?? []).find((c) => c.name === owner), opp = (P.coaches() ?? []).find((c) => c.name === ws.coach);
      if (pov && opp && pov.name !== opp.name) return matchView({ ...r, tab: tab ?? 'plan' }, { pov, opp, ws }, true);
    }
    const head = `<div class="ws-head">${btn('‹ Back', r.kind ? 'back' : 'go-home', {}, { cls: 'back', aria: r.kind ? 'Back' : 'Back to Battle Prep' })}
      <span class="ws-title">${owner ? `${esc(owner)} ` : ''}vs ${esc(ws.coach)}</span>${ws.isNext ? ' <span class="chip ok">next</span>' : ''}</div>
      ${owner ? '' : `<p class="banner warn unassigned">${esc(C.POV.unassignedBanner)} ${btn(C.POV.review, 'go-owner', { ws: ws.id }, { primary: true })}</p>`}`;
    // section buttons (not an ARIA tablist: no arrow-key model to promise); the current one is marked aria-current
    const tabs = `<nav class="ptabs" aria-label="Prep sections">${Object.entries(TAB_LABEL).filter(([k]) => k !== 'brief' || owner).map(([k, l]) => `<button type="button" id="ptab-${k}" data-pa="tab" data-tab="${k}"${!r.kind && tab === k ? ' aria-current="page" class="active"' : ''}>${l}</button>`).join('')}</nav>`;
    if (r.kind === 'owner') return `<section class="panel prep-ws" data-key="ws">${head}${ownerScreen(ws)}</section>`;
    let body;
    if (!r.kind) {
      body = tab === 'sets' ? Sets.tab(P, ws) : tab === 'calcs' ? Calcs.tab(P, ws) : tab === 'practice' ? Practice.tab(P, ws) : Plan.tab(P, ws);
    } else {
      // your own set opens in the teambuilder; their sets keep the source-labelled editor
      const mine = r.kind === 'sets' ? P.docs.mysets.sets.find((s) => s.id === r.id) : null;
      const view = mine ? (P2, w) => TB.editor(P2, w, mine) : MODULES.map((m) => m.views?.[r.kind]).find(Boolean);
      body = view ? view(P, ws, r) : Plan.tab(P, ws);
    }
    return `<section class="panel prep-ws" data-key="ws">${head}${tabs}<div id="ptab-panel">${body}</div>
      <p class="small muted ws-foot">${esc(C.HOME.savedLocal)} ${P.saveState === 'saving' ? esc(C.SAVE.saving) : P.saveState === 'error' ? '' : esc(C.SAVE.saved)}</p></section>`;
  }
  /** Whose prep is this? One workspace saved before perspectives, with the facts to decide, and an explicit answer. */
  function ownerScreen(ws) {
    const owner = ownerOf(ws);
    const coaches = (P.coaches() ?? []).filter((c) => c.name !== ws.coach);
    if (owner) {
      return `${h2(C.POV.ownerHead(ws.coach))}<p>${esc(C.POV.ownedBy(owner, ws.coach))}${ws.povAssignedAt ? ` ${esc(C.POV.assignedOn(ws.povAssignedAt.slice(0, 10)))}` : ''}</p>
        ${ws.povFrom === 'legacy-confirm' ? `<p>${btn(C.POV.unassign, 'owner-unassign', { ws: ws.id })} <span class="small muted">${esc(C.POV.unassignHelp)}</span></p>` : ''}`;
    }
    const pick = P.ui.ownerPick?.[ws.id] ?? (coaches.some((c) => c.name === P.currentPov()) ? P.currentPov() : '');
    const whoHas = (sp) => (P.coaches() ?? []).find((c) => c.picks.some((x) => x.id === sp))?.name ?? null;
    const ev = legacyEvidence(ws, { pov: pick || null, rosterOf: (n) => P.coachRoster(n), mysets: P.docs.mysets, whoHas });
    const nm = (ids) => ids.map((x) => P.spName(x)).join(', ');
    const facts = [
      C.POV.evOpp(ws.coach, ev.snapshotMatches, ev.snapshotSize, ev.oppNowSize),
      C.POV.evDates((ev.createdAt ?? '').slice(0, 10), (ev.updatedAt ?? '').slice(0, 10), ev.matchDate),
      C.POV.evCounts(ev.counts),
      ev.six.length ? C.POV.evSix(nm(ev.six)) : C.POV.evNoSix,
      ev.yours.length ? C.POV.evYours(nm(ev.yours)) : C.POV.evNoYours,
    ];
    const fit = !pick ? '' : !ev.yours.length ? `<p class="small">${esc(C.POV.fitUnknown(pick))}</p>`
      : ev.yoursElsewhere.length ? `<p class="banner warn">${esc(C.POV.fitWarn(pick, ev.yoursElsewhere.map((x) => `${P.spName(x.id)}${x.coach ? ` (${x.coach}'s now)` : ''}`).join(', ')))}</p>`
      : `<p class="small">✓ ${esc(C.POV.fitOk(pick, nm(ev.yoursOnPov)))}</p>`;
    return `${h2(C.POV.ownerHead(ws.coach))}
      <p>${esc(C.POV.ownerIntro)}</p>
      <ul class="small evid">${facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
      ${select('owner-pick', [['', C.POV.ownerChoose], ...coaches.map((c) => [c.name, c.name])], pick, { label: C.POV.ownerQuestion, data: { pc: 'owner-pick', ws: ws.id } })}
      ${fit}
      <p>${pick ? btn(C.POV.assign(pick, ws.coach), 'owner-assign', { ws: ws.id, owner: pick }, { primary: true }) : ''} ${btn(C.POV.notNow, 'back')}</p>
      <p class="small muted">${esc(C.POV.assignHelp)}</p>`;
  }
  P.rosterDiffOf = (ws) => (P.league() ? rosterDiff(ws.roster.speciesIds, P.coachRoster(ws.coach)) : { added: [], removed: [] });

  // ---------- actions ----------
  const povSeat = () => P.seatOf(P.currentPov());
  /** The same screen from another perspective (a setting change: replace). Opponent kept unless it is the new perspective. */
  const toPov = (seat) => {
    const r = P.route;
    if (!P.coachBySeat(seat)) return;
    if (isMatch(r) && r.opp !== seat) P.go({ view: 'ws', pov: seat, opp: r.opp, tab: r.tab ?? 'brief' }, { push: false });
    else P.go({ view: 'overview', pov: seat }, { push: false });
  };
  const toOpp = (seat) => {
    const pov = povSeat();
    if (!pov || !P.coachBySeat(seat) || seat === pov) return;
    const r = P.route;
    P.go({ view: 'ws', pov, opp: seat, tab: isMatch(r) && !r.detail ? r.tab ?? 'brief' : 'brief' });
  };
  P.sheetFailed = () => app.sheetFailed?.() ?? false;
  const ACTIONS = {
    'go-home': () => { const seat = povSeat(); P.go(seat ? { view: 'overview', pov: seat } : { view: 'home' }, { push: false }); },
    'go-overview': () => { const seat = povSeat(); P.go(seat ? { view: 'overview', pov: seat } : { view: 'home' }); },
    'go-opp': (t) => toOpp(Number(t.dataset.opp)),
    'pov-back': () => { const seat = P.seatOf(P.identity()); if (seat) toPov(seat); },
    // Start saved prep for this matchup (an explicit tap): the workspace gets this perspective as its owner.
    'match-start-ws': (t) => {
      const m = P.match();
      if (!m) return;
      const ws = P.ensureWorkspace(m.pov.name, m.opp.name);
      if (ws) P.go({ view: 'ws', pov: m.pov.order, opp: m.opp.order, tab: MATCH_TABS.includes(t.dataset.tab) ? t.dataset.tab : 'plan' }, { push: false });
    },
    // Put an assigned earlier workspace back from its recovery copy: under its own id when it is gone, else as a second copy
    // beside the one that replaced it (nothing is overwritten).
    'vault-recover': (t) => {
      const id = t.dataset.ws, src = t.dataset.src === 'keep' ? 'keep' : 'vault', doc = copyStore(src).get(id);
      if (!doc || !P.recoverable().some((x) => x.id === id && x.src === src)) { app.rerender(); return; }
      if (P.readOnly()) { P.toast(C.SAVE.newer); return; }
      if (P.dirty.size) flush();
      const gone = P.store.load(wsKey(id)).status === 'missing';
      const copyId = gone ? id : P.id('ws');
      const res = P.store.save(wsKey(copyId), { ...doc, id: copyId }, null);
      if (!res.ok) { P.toast(res.code === 'quota' ? C.SAVE.quota : C.SAVE.error); return; }
      // its content now lives in a saved workspace: the old copy goes (if the new copy didn't fit, the copy warning says so;
      // keeping the old one would offer the same recovery again and again)
      if (!gone) copyStore(src).remove(id);
      P.init();
      P.copyWasBehind = P.copyBehind().length > 0;
      P.toast(res.vaultFailed ? C.POV.vaultDoneNoCopy(doc.pov, doc.coach) : C.POV.vaultDone(doc.pov, doc.coach));
      app.rerender();
    },
    // Try writing the recovery copy again (after freeing space): saves the workspace unchanged, which rewrites its copy
    'vault-retry': (t) => {
      const ws = P.ws.get(t.dataset.ws);
      if (!ws || !P.copyBehind().some((w) => w.id === ws.id)) { app.rerender(); return; }
      if (P.mutate(`ws:${ws.id}`, (d) => d, { substantive: false })) flush();
    },
    'vault-discard': (t) => { copyStore(t.dataset.src === 'keep' ? 'keep' : 'vault').remove(t.dataset.ws); P.toast(C.POV.vaultDropped); app.rerender(); },
    'draft-open': () => { const pr = P.pendingReplace; P.pendingReplace = null; if (pr && P.ws.has(pr.wsId)) P.go({ view: 'ws', wsId: pr.wsId, ...KIND_OF_SLOT[pr.slot] }, { push: true }); else app.rerender(); },
    'draft-replace': () => {
      const pr = P.pendingReplace; P.pendingReplace = null;
      if (!pr || !P.ws.has(pr.wsId)) { app.rerender(); return; }
      P.wsUi(pr.wsId)[pr.slot] = pr.next;
      pr.then?.();
      if (pr.route) P.go(pr.route, { push: true }); else { P.saveUi(); app.rerender(); }
    },
    'draft-cancel': () => { P.pendingReplace = null; app.rerender(); },
    'go-owner': (t) => { if (P.ws.has(t.dataset.ws)) P.go({ view: 'ws', wsId: t.dataset.ws, kind: 'owner' }, { push: true }); },
    // Saying whose an earlier workspace is: only from its own review screen, only for an unassigned one, only to a coach on
    // the sheet other than its opponent. Undoable at once (Undo) and later (Unassign).
    'owner-assign': (t) => {
      const ws = P.ws.get(t.dataset.ws), owner = t.dataset.owner;
      if (!ws || ownerOf(ws) || !owner || owner === ws.coach || !P.seatOf(owner)) return;
      const ok = P.mutate(`ws:${ws.id}`, (d) => { d.pov = owner; d.povFrom = 'legacy-confirm'; d.povAssignedAt = P.now(); }, { allowUnassigned: true });
      if (!ok) return;
      P.docs.meta = { ...P.docs.meta, workspaces: P.docs.meta.workspaces.map((w) => (w.id === ws.id ? { ...w, pov: owner } : w)) };
      P.dirty.add(KEYS.meta);
      if (P.ui.ownerPick) delete P.ui.ownerPick[ws.id];
      P.toast(C.POV.assigned(owner, ws.coach));
      const ps = P.seatOf(owner), os = P.seatOf(ws.coach);
      (P.ui.activeWs ??= {})[`${owner}|${ws.coach}`] = ws.id;
      P.go(ps && os ? { view: 'ws', pov: ps, opp: os, names: { pov: owner, opp: ws.coach }, wsId: ws.id, tab: 'plan' } : { view: 'ws', wsId: ws.id, tab: 'plan' }, { push: false });
    },
    'owner-unassign': (t) => {
      const ws = P.ws.get(t.dataset.ws);
      if (!ws || ws.povFrom !== 'legacy-confirm') return;
      const ok = P.mutate(`ws:${ws.id}`, (d) => { delete d.pov; delete d.povFrom; delete d.povAssignedAt; });
      if (!ok) return;
      P.docs.meta = { ...P.docs.meta, workspaces: P.docs.meta.workspaces.map((w) => { if (w.id !== ws.id) return w; const { pov, ...rest } = w; void pov; return rest; }) };
      P.dirty.add(KEYS.meta);
      P.toast(C.POV.unassigned(ws.coach));
      P.go({ view: 'ws', wsId: ws.id, tab: 'plan' }, { push: false });
    },
    back: () => P.back(),
    'go-rules': () => P.go({ view: 'rules' }, { push: true }),
    'go-backup': () => P.go({ view: 'backup' }, { push: true }),
    'go-pilot': () => P.go({ view: 'pilot' }, { push: true }),
    'go-mysets': () => P.go({ view: 'my-sets' }, { push: true }),
    'go-mysets-import': () => P.go({ view: 'my-sets', kind: 'import' }, { push: true }),
    continue: () => { const r = parseRoute(P.store.hint('lastRoute') ?? P.docs.meta.lastRoute); if (r) P.go(r, { push: true }); },
    // "Is this you? Yes" records who you are on this device. It assigns no saved prep (each earlier workspace is reviewed on its own).
    'confirm-me': (t) => {
      // only the name the button showed, and only while it is still the default from your Draft setting
      const name = t.dataset?.coach, d = P.resolvePov(null);
      if (!name || name !== d.name || !['setting', 'default'].includes(d.source) || P.identity()) return;
      P.mutate('meta', (m) => { m.myCoach = name; m.myCoachConfirmed = true; }, { substantive: false });
    },
    'open-coach': (t) => P.openWorkspace(t.dataset.coach),
    'open-ws': (t) => P.go({ view: 'ws', wsId: t.dataset.ws, tab: 'plan' }, { push: true }),
    tab: (t) => {
      const r = P.route, tab = t.dataset.tab;
      const m = P.match(r);
      if (m) {
        // a section tap starts saved prep for this matchup, unless an earlier unassigned one could be it: then the tab asks
        if (tab !== 'brief' && !m.ws && !unassignedVs([...P.ws.values()], m.opp.name).length && !P.ensureWorkspace(m.pov.name, m.opp.name)) return;
        return P.go({ view: 'ws', pov: r.pov, opp: r.opp, tab: MATCH_TABS.includes(tab) ? tab : 'brief' }, { push: false });
      }
      const ws = P.ws.get(r.wsId), owner = ownerOf(ws);
      if (tab === 'brief' && owner && P.seatOf(owner) && P.seatOf(ws.coach)) {
        (P.ui.activeWs ??= {})[`${owner}|${ws.coach}`] = ws.id;
        return P.go({ view: 'ws', pov: P.seatOf(owner), opp: P.seatOf(ws.coach), names: { pov: owner, opp: ws.coach }, wsId: ws.id, tab: 'brief' }, { push: false });
      }
      return P.go({ view: 'ws', wsId: r.wsId, tab: tab === 'brief' ? 'plan' : tab }, { push: false });
    },
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
      P.store.vault.clear(); P.store.keep.clear(); // "delete all" includes the recovery copies
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
    'pov-pick': (t) => { if (t.value) toPov(Number(t.value)); },
    'opp-jump': (t) => { if (t.value) toOpp(Number(t.value)); },
    'owner-pick': (t) => { (P.ui.ownerPick ??= {})[t.dataset.ws] = t.value; app.rerender(); },
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
  const ONCE = new Set(['open-coach', 'match-start-ws', 'pb-plan-new', 'chat-send', 'chat-cancel', 'chat-clear', 'vault-recover', 'vault-retry', 'owner-assign', 'owner-unassign', 'brief-six', 'brief-next', 'brief-calc', 'brief-calc-replace', 'match-start', 'finding-new', 'calc-save', 'calc-dup', 'card-new', 'plan-new', 'variant-new', 'variant-dup', 'br-start', 'mock-quick',
    'guess-all', 'paste-import', 'set-save', 'set-save-copy', 'pilot-save', 'rv-save', 'restore-import', 'restore-replace-confirm', 'backup-download', 'ws-archive', 'ws-archive-confirm', 'delete-all-confirm', 'undo-delete']);
  const recent = new Map();
  const tappedTwice = (t) => {
    if (!ONCE.has(t.dataset.pa)) return false;
    const key = JSON.stringify([t.dataset, formatRoute(P.route)]), now = Date.now(); // the same tap on the same screen
    if (now - (recent.get(key) ?? 0) < 400) return true;
    recent.set(key, now);
    return false;
  };
  // A document written by a newer app is read-only here: only downloading a backup is offered, nothing removes it.
  const NOT_WHEN_NEWER = new Set(['ws-archive', 'ws-archive-confirm', 'restore-replace', 'restore-replace-confirm', 'restore-import', 'restore-undo', 'delete-all', 'delete-all-confirm']);
  // Deletes take one tap and can be undone until the next action: the documents they change are kept and put back.
  const UNDOABLE = { 'set-delete': 'Set deleted', 'variant-delete': 'Version deleted', 'calc-delete': 'Calc deleted', 'plan-delete': 'Plan deleted', 'card-delete': 'Card deleted',
    'fd-delete': 'Finding deleted', 'pilot-delete': 'Pilot team deleted', 'rv-del': 'Reveal removed', 'ifthen-remove': 'If-then line removed',
    'owner-assign': 'Earlier prep assigned', 'owner-unassign': 'Earlier prep unassigned' };
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
    saveUi: () => P.saveUi(),
    /** Escape: close an open detail sheet (Back) or a pending question. Returns whether it did something. */
    escape: () => {
      if (P.pendingReplace) { P.pendingReplace = null; app.rerender(); return true; }
      if (isMatch(P.route) && P.route.detail) { P.back(); return true; }
      return false;
    },
    /** Which opponent row is showing (perspective seat | current opponent or overview), so the app keeps its scroll. */
    stripKey: () => { const r = P.route; return isMatch(r) ? `${r.pov}|${r.opp}` : r.view === 'overview' ? `${r.pov}|-` : null; },
    /** A screen that can be redrawn under the user after a sheet refresh (no typing on it). */
    canRedraw: () => P.route.view === 'home' || P.route.view === 'overview' || (isMatch(P.route) && (P.route.tab ?? 'brief') === 'brief'),
    /** "Battle Prep vs <seat>" from Draft: that matchup from the current perspective (or the overview without one). */
    openVs: (seat) => {
      if (!P.docs.meta) P.init();
      const pov = P.seatOf(P.currentPov());
      if (pov && P.coachBySeat(seat) && seat !== pov) P.go({ view: 'ws', pov, opp: seat, tab: 'brief' }, { push: true });
      else P.go({ view: 'home' }, { push: false });
    },
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

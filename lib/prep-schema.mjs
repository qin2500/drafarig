// Prep documents (device-local, localStorage keys drafarig.prep.*), their validation and migrations. Pure.
// Every document carries schemaVersion and rev. Migrations are pure, idempotent and keep unknown fields; a document from a
// newer schema is never written (read-only mode). Validation checks structure and types; set legality is checked separately
// by lib/calc/mech.mjs checkSet (the same gate the calc wrapper uses).
export const SCHEMA_VERSION = 1;
export const PREFIX = 'drafarig.prep.';
export const KEYS = Object.freeze({ meta: `${PREFIX}meta`, rules: `${PREFIX}rules`, mysets: `${PREFIX}mysets`, pilot: `${PREFIX}pilot` });
export const wsKey = (id) => `${PREFIX}ws.${id}`;
export const ID_PREFIXES = Object.freeze(['ws', 'set', 'var', 'plan', 'card', 'calc', 'mock', 'game', 'rvl', 'fnd', 'rvn', 'match', 'pilot', 'idea']);
const B32 = 'abcdefghijklmnopqrstuvwxyz234567';
export const ID_RE = /^[a-z]+_[a-z2-7]{12}$/;

/** Random opaque id: <prefix>_<12 base32 chars>, from a getRandomValues-like function. */
export function newId(prefix, getRandomValues = (a) => globalThis.crypto.getRandomValues(a)) {
  if (!ID_PREFIXES.includes(prefix)) throw new Error(`unknown id prefix ${prefix}`);
  const bytes = getRandomValues(new Uint8Array(12));
  return `${prefix}_${[...bytes].map((b) => B32[b & 31]).join('')}`;
}

// ---------- enums (closed lists: every displayed value maps to reviewed copy) ----------
export const SOURCES = Object.freeze(['sheet-open', 'seen-vs-me', 'seen-vs-others', 'ladder', 'my-guess', 'counterprep-guess', 'fixed']);
export const RULES = Object.freeze({
  matchLength: ['bo3', 'bo1', 'bo5', 'unknown'],
  disclosure: ['closed', 'open-at-preview', 'exchanged-in-advance', 'partial', 'unknown'],
  sixPerMatch: ['pick-6-each-match', 'six-per-game', 'whole-ten', 'unknown'],
  setLockWithinBo3: ['locked', 'can-change', 'unknown'],
  platform: ['showdown', 'in-game', 'both', 'unknown'],
  itemClause: ['on', 'off', 'unknown'],
  bringPick: ['6-4', 'other', 'unknown'],
  replaysPublic: ['yes', 'no', 'unknown'],
  notesDuringSet: ['allowed', 'between-games', 'not-allowed', 'unknown'],
  rosterChanges: ['none', 'trades', 'free-agency', 'unknown'],
});
export const PLAN_KINDS = Object.freeze(['likely', 'alt', 'counterprep', 'idea']);
export const VARIANT_ROLES = Object.freeze(['likely', 'worst-plausible', 'counterprep', 'idea']);
export const CARD_KINDS = Object.freeze(['plan', 'bo3-won-g1', 'bo3-lost-g1']);
export const GAME_TAGS = Object.freeze(['misplay', 'knowledge-gap', 'structural', 'dice', 'partner-off-script', 'unclear']);
export const MECHANISMS = Object.freeze(['speed', 'unexpected-ko', 'fakeout-redirect', 'setup-mega', 'weather-terrain', 'other']);
export const FIDELITY = Object.freeze([1, 2, 3, 'S']);
export const DISCLOSURE_SIM = Object.freeze(['closed', 'open-at-preview', 'exchanged-in-advance']);
export const FINDING_STATUS = Object.freeze(['open', 'accepted', 'retest', 'fixed', 'rejected']);
export const SEVERITY = Object.freeze(['critical', 'major', 'minor']);
export const REVEAL_KINDS = Object.freeze(['move', 'item', 'ability', 'mega', 'nature-sheet', 'moved-before', 'moved-after', 'hp-after-hit', 'lead', 'bring']);
export const SPEED_MODES = Object.freeze(['tailwind', 'trick-room', 'priority', 'none', 'unknown']);

// ---------- empty documents ----------
const rule = (value, source = 'default', setAt = null) => ({ value, source, setAt, note: '' });
export function emptyRules(now) {
  const rules = Object.fromEntries(Object.keys(RULES).map((k) => [k, rule('unknown')]));
  rules.matchLength = rule('bo3', 'user', now); // the user's stated league fact
  return { schemaVersion: SCHEMA_VERSION, rev: 0, updatedAt: now, rules, notes: '' };
}
export function emptyMeta(now) {
  return { schemaVersion: SCHEMA_VERSION, rev: 0, myCoach: null, myCoachConfirmed: false, deviceLabel: '', createdAt: now, lastBackupAt: null,
    changesSinceBackup: 0, persistAskedAt: null, lastRoute: null, workspaces: [], prefs: { beginnerPrompts: true }, archived: [] };
}
export const emptyMySets = () => ({ schemaVersion: SCHEMA_VERSION, rev: 0, sets: [] });
export const emptyPilot = () => ({ schemaVersion: SCHEMA_VERSION, rev: 0, teams: [] });
export function newWorkspace({ id, coach, roster, now }) {
  return {
    schemaVersion: SCHEMA_VERSION, rev: 0, id, coach, createdAt: now, updatedAt: now, matchDate: '', isNext: false,
    roster: { fetchedAt: roster.fetchedAt ?? null, speciesIds: [...roster.speciesIds], points: { ...(roster.points ?? {}) } },
    theirSets: [], plans: [], variants: [], my6: [], cards: [], premortem: '', eyesAnswer: '', calcs: [], mockSets: [], reveals: [],
    findings: [], revisions: [], matches: [], notes: '', speedChecks: [], dismissedFlags: [],
  };
}

// ---------- validation ----------
const isStr = (v, max = 20000) => typeof v === 'string' && v.length <= max;
const isIso = (v) => v === null || (typeof v === 'string' && v.length <= 40 && !Number.isNaN(Date.parse(v)));
const isInt = (v, lo = -Infinity, hi = Infinity) => Number.isInteger(v) && v >= lo && v <= hi;
const isArr = (v, max = 5000) => Array.isArray(v) && v.length <= max;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isId = (v, prefix) => typeof v === 'string' && ID_RE.test(v) && (!prefix || v.startsWith(`${prefix}_`));

/** First path holding __proto__ / constructor / prototype as a key, or null. */
export function forbiddenKey(x, path = '$') {
  if (Array.isArray(x)) { for (let i = 0; i < x.length; i++) { const p = forbiddenKey(x[i], `${path}[${i}]`); if (p) return p; } return null; }
  if (x && typeof x === 'object') {
    for (const k of Object.keys(x)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') return `${path}.${k}`;
      const p = forbiddenKey(x[k], `${path}.${k}`); if (p) return p;
    }
  }
  return null;
}

// Ids from the game data (species, moves, items, abilities, natures) are lowercase letters and digits. Holding every
// such field to that shape (and counters to bounded integers) means an imported or restored file can't smuggle markup
// or script into a screen through them; free text (names, notes) is always escaped where it is shown.
const ID_LIKE = /^[a-z0-9]{1,40}$/;
const isIdLike = (v) => typeof v === 'string' && ID_LIKE.test(v);
const isIdOrEmpty = (v) => v === '' || v === null || v === undefined || isIdLike(v);
const allIdLike = (a, max) => isArr(a, max) && a.every(isIdLike);
const allIds = (a, prefix, max) => isArr(a, max) && a.every((x) => isId(x, prefix));
const optInt = (v, lo, hi) => v === null || v === undefined || isInt(v, lo, hi);
const optIn = (v, list) => v === null || v === undefined || v === '' || list.includes(v);

function checkGames(gs, e, at) {
  if (!isArr(gs, 20)) return e.push(at);
  gs.forEach((g, i) => {
    const p = `${at}[${i}]`;
    if (!isObj(g)) return e.push(p);
    if (g.id !== undefined && !isId(g.id, 'game')) e.push(`${p}.id`);
    if (!isInt(g.index, 0, 9)) e.push(`${p}.index`);
    if (!optIn(g.result, ['W', 'L'])) e.push(`${p}.result`);
    if (!optIn(g.tag, GAME_TAGS)) e.push(`${p}.tag`);
    if (!optIn(g.mechanism, MECHANISMS)) e.push(`${p}.mechanism`);
    if (!optInt(g.decidingTurn, 1, 30)) e.push(`${p}.decidingTurn`);
    if (!optInt(g.partnerFidelity, 1, 3)) e.push(`${p}.partnerFidelity`);
    for (const k of ['theirLead', 'their4']) if (g[k] !== undefined && !allIdLike(g[k], 6)) e.push(`${p}.${k}`);
    for (const k of ['myLead', 'my4']) if (g[k] !== undefined && !allIds(g[k], 'set', 6)) e.push(`${p}.${k}`);
    // their Mega is a species id; yours is the set you Mega Evolved (a set id)
    if (!isIdOrEmpty(g.theirMega) || !(g.myMega === undefined || g.myMega === null || g.myMega === '' || isId(g.myMega, 'set'))) e.push(`${p}.mega`);
    if (g.planId !== undefined && g.planId !== null && g.planId !== '' && !isId(g.planId, 'plan')) e.push(`${p}.planId`);
    if (g.previewGuess !== undefined && g.previewGuess !== null && g.previewGuess !== '' && !isId(g.previewGuess, 'var')) e.push(`${p}.previewGuess`);
    if (g.pasteCheckOk !== undefined && g.pasteCheckOk !== null && typeof g.pasteCheckOk !== 'boolean') e.push(`${p}.pasteCheckOk`);
  });
}
function checkScenarioSets(sc, e, at) {
  if (!isObj(sc)) return e.push(at);
  for (const s of ['attacker', 'defender']) {
    const set = sc[s]?.set;
    if (!isObj(set) || !isIdLike(set.species) || !['item', 'ability', 'nature'].every((k) => isIdOrEmpty(set[k])) || !isArr(set.moves, 4) || !set.moves.every(isIdOrEmpty)) e.push(`${at}.${s}`);
  }
  if (!isObj(sc.move) || !isIdLike(sc.move.id)) e.push(`${at}.move`);
}

function checkSetData(d, e, at, side) {
  if (!isObj(d)) return e.push(`${at}: set data`);
  for (const k of ['item', 'ability', 'nature']) if (!isIdOrEmpty(d[k])) e.push(`${at}.${k}`);
  if (!isArr(d.moves, 4) || !d.moves.every(isIdOrEmpty)) e.push(`${at}.moves`);
  if (d.sp === 'unknown') { if (side !== 'theirs') e.push(`${at}.sp unknown on your own set`); }
  else if (!isObj(d.sp) || !Object.entries(d.sp).every(([k, v]) => ['hp', 'atk', 'def', 'spa', 'spd', 'spe'].includes(k) && Number.isFinite(v))) e.push(`${at}.sp`);
  if (d.cosmetic !== undefined && !isObj(d.cosmetic)) e.push(`${at}.cosmetic`);
}
export function checkLineage(s, e, at) {
  if (!isObj(s)) return e.push(at);
  if (!isId(s.id, 'set')) e.push(`${at}.id`);
  if (!['mine', 'theirs'].includes(s.side)) e.push(`${at}.side`);
  if (!isIdLike(s.speciesId)) e.push(`${at}.speciesId`);
  if (!isStr(s.name, 80)) e.push(`${at}.name`);
  if (!isInt(s.currentV, 1)) e.push(`${at}.currentV`);
  if (!isArr(s.versions, 500) || !s.versions.length) return e.push(`${at}.versions`);
  const vs = new Set();
  s.versions.forEach((v, i) => {
    if (!isObj(v) || !isInt(v.v, 1) || vs.has(v.v)) e.push(`${at}.versions[${i}].v`);
    vs.add(v?.v);
    if (!isIso(v?.at)) e.push(`${at}.versions[${i}].at`);
    checkSetData(v?.data, e, `${at}.versions[${i}].data`, s.side);
    if (v?.provenance !== undefined && !isObj(v.provenance)) e.push(`${at}.versions[${i}].provenance`);
  });
  if (!vs.has(s.currentV)) e.push(`${at}.currentV not a version`);
  if (s.revealedTo !== undefined && !isArr(s.revealedTo)) e.push(`${at}.revealedTo`);
}

const VALIDATORS = {
  meta(d, e) {
    if (d.myCoach !== null && !isStr(d.myCoach, 80)) e.push('myCoach');
    if (!isArr(d.workspaces, 200) || !d.workspaces.every((w) => isObj(w) && isId(w.id, 'ws') && isStr(w.coach, 80))) e.push('workspaces');
    if (!isInt(d.changesSinceBackup ?? 0, 0)) e.push('changesSinceBackup');
    if (!isIso(d.lastBackupAt ?? null)) e.push('lastBackupAt');
  },
  rules(d, e) {
    if (!isObj(d.rules)) return e.push('rules');
    for (const [k, list] of Object.entries(RULES)) {
      const r = d.rules[k];
      if (r === undefined) continue; // filled from defaults on load
      if (!isObj(r) || !list.includes(r.value) || !['user', 'default'].includes(r.source)) e.push(`rules.${k}`);
    }
  },
  mysets(d, e) {
    if (!isArr(d.sets, 2000)) return e.push('sets');
    d.sets.forEach((s, i) => { checkLineage(s, e, `sets[${i}]`); if (s?.side !== 'mine') e.push(`sets[${i}].side`); });
  },
  pilot(d, e) {
    if (!isArr(d.teams, 200) || !d.teams.every((t) => isObj(t) && isId(t.id, 'pilot') && isStr(t.name ?? '', 200))) e.push('teams');
  },
  ws(d, e) {
    if (!isId(d.id, 'ws')) e.push('id');
    if (!isStr(d.coach, 80) || !d.coach) e.push('coach');
    if (!isObj(d.roster) || !allIdLike(d.roster.speciesIds, 40)) e.push('roster');
    if (!isArr(d.theirSets, 2000)) e.push('theirSets'); else d.theirSets.forEach((s, i) => { checkLineage(s, e, `theirSets[${i}]`); if (s?.side !== 'theirs') e.push(`theirSets[${i}].side`); });
    for (const k of ['plans', 'variants', 'my6', 'cards', 'calcs', 'mockSets', 'reveals', 'findings', 'revisions', 'matches']) if (!isArr(d[k], 5000)) e.push(k);
    if (isArr(d.plans)) d.plans.forEach((p, i) => {
      if (!isObj(p) || !isId(p.id, 'plan') || !PLAN_KINDS.includes(p.kind) || !allIdLike(p.members, 10) || !isIdOrEmpty(p.megaUser) || !optIn(p.speedMode, SPEED_MODES)
        || (p.falsifiers?.atPreview !== undefined && !allIdLike(p.falsifiers.atPreview, 10))) e.push(`plans[${i}]`);
    });
    if (isArr(d.variants)) d.variants.forEach((v, i) => { if (!isObj(v) || !isId(v.id, 'var') || !VARIANT_ROLES.includes(v.role) || !isObj(v.setIds) || !Object.entries(v.setIds).every(([k, x]) => isIdLike(k) && isId(x, 'set'))) e.push(`variants[${i}]`); });
    if (isArr(d.my6)) d.my6.forEach((m, i) => { if (!isObj(m) || !isId(m.setId, 'set') || !optInt(m.v, 1)) e.push(`my6[${i}]`); });
    if (isArr(d.cards)) d.cards.forEach((c, i) => {
      if (!isObj(c) || !isId(c.id, 'card') || !CARD_KINDS.includes(c.kind) || (c.lead !== undefined && !allIds(c.lead, 'set', 6)) || (c.bring4 !== undefined && !allIds(c.bring4, 'set', 10))
        || (c.vsPlanIds !== undefined && !allIds(c.vsPlanIds, 'plan', 20)) || !(c.mega === undefined || c.mega === null || c.mega === '' || isId(c.mega, 'set'))
        || (c.ifThen !== undefined && !(isArr(c.ifThen, 20) && c.ifThen.every((l) => isObj(l) && (l.trigger?.theirLead === undefined || allIdLike(l.trigger.theirLead, 6)))))) e.push(`cards[${i}]`);
    });
    if (isArr(d.calcs)) d.calcs.forEach((c, i) => { if (!isObj(c) || !isId(c.id, 'calc')) e.push(`calcs[${i}]`); else checkScenarioSets(c.scenario, e, `calcs[${i}].scenario`); });
    if (isArr(d.mockSets)) d.mockSets.forEach((m, i) => { if (!isObj(m) || !isId(m.id, 'mock')) e.push(`mockSets[${i}]`); else { checkGames(m.games, e, `mockSets[${i}].games`); if (!optIn(m.fidelity, FIDELITY) || !optIn(m.simulatedDisclosure, DISCLOSURE_SIM)) e.push(`mockSets[${i}]`); } });
    if (isArr(d.matches)) d.matches.forEach((m, i) => { if (!isObj(m) || !isId(m.id, 'match') || (m.their6 !== undefined && !allIdLike(m.their6, 6)) || (m.my6 !== undefined && !(isArr(m.my6, 12) && m.my6.every((x) => isObj(x) && isId(x.setId, 'set'))))) e.push(`matches[${i}]`); else checkGames(m.games, e, `matches[${i}].games`); });
    if (isArr(d.reveals)) d.reveals.forEach((r, i) => {
      if (!isObj(r) || !isId(r.id, 'rvl') || !isIdLike(r.speciesId) || !REVEAL_KINDS.includes(r.kind) || !(isIdOrEmpty(r.value) || isInt(r.value, 0, 9999)) || !['theirs', 'mine', undefined].includes(r.side)
        || !(r.context === null || r.context === undefined || (isObj(r.context) && optInt(r.context.myStat, 0, 9999) && isIdOrEmpty(r.context.mySpecies)))) e.push(`reveals[${i}]`);
    });
    if (isArr(d.findings)) d.findings.forEach((f, i) => { if (!isObj(f) || !isId(f.id, 'fnd') || !FINDING_STATUS.includes(f.status) || !SEVERITY.includes(f.severity)) e.push(`findings[${i}]`); });
    if (isArr(d.revisions)) d.revisions.forEach((r, i) => { if (!isObj(r) || !isId(r.id, 'rvn') || !isArr(r.changes, 20)) e.push(`revisions[${i}]`); });
  },
};

/** Structural validation. type: meta | rules | mysets | pilot | ws. Returns error strings (empty = valid). */
export function validate(type, doc) {
  const e = [];
  if (!isObj(doc)) return ['not an object'];
  const fk = forbiddenKey(doc);
  if (fk) e.push(`forbidden key at ${fk}`);
  if (!isInt(doc.schemaVersion, 1)) e.push('schemaVersion');
  if (!isInt(doc.rev, 0)) e.push('rev');
  const v = VALIDATORS[type];
  if (!v) return [`unknown document type ${type}`];
  if (!e.length) v(doc, e);
  return e;
}

// ---------- migrations ----------
/** migrations[n] turns a version-n document into version n+1. Version 0 = early drafts without schemaVersion/rev. */
export const MIGRATIONS = Object.freeze({
  0: (type, d) => ({ ...d, schemaVersion: 1, rev: Number.isInteger(d.rev) ? d.rev : 0 }),
});

/**
 * Migrate in memory to SCHEMA_VERSION. Returns { doc, changed, newer }. newer = saved by a newer app (read-only; never
 * written). Idempotent: migrate(migrate(x).doc) leaves it unchanged. Unknown fields are kept.
 */
export function migrate(type, doc) {
  if (!isObj(doc)) return { doc, changed: false, newer: false };
  let v = Number.isInteger(doc.schemaVersion) ? doc.schemaVersion : 0;
  if (v > SCHEMA_VERSION) return { doc, changed: false, newer: true };
  let d = doc, changed = false;
  while (v < SCHEMA_VERSION) {
    const step = MIGRATIONS[v];
    if (!step) throw new Error(`no migration from schema ${v}`);
    d = step(type, d); changed = true; v = d.schemaVersion;
  }
  if (type === 'rules' && isObj(d.rules)) { // fill rules added since the document was written, as "don't know"
    const filled = { ...d.rules };
    for (const k of Object.keys(RULES)) if (!filled[k]) { filled[k] = rule(k === 'matchLength' ? 'bo3' : 'unknown', k === 'matchLength' ? 'user' : 'default'); changed = true; }
    if (changed) d = { ...d, rules: filled };
  }
  return { doc: d, changed, newer: false };
}

/** Type of a storage key, or null. */
export function typeOfKey(key) {
  if (key === KEYS.meta) return 'meta';
  if (key === KEYS.rules) return 'rules';
  if (key === KEYS.mysets) return 'mysets';
  if (key === KEYS.pilot) return 'pilot';
  if (key.startsWith(`${PREFIX}ws.`) && ID_RE.test(key.slice(PREFIX.length + 3))) return 'ws';
  return null;
}

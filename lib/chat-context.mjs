// Chat with the VGC agent: the page context a message may carry (VGC-PLAN-TOOLS.md §9), its limits, and ids. Pure; shared
// by the browser (it builds the context and shows it as chips) and the Worker (it rejects anything outside this list).
// The context is an allowlist. Each part is public sheet data or a structured pick from the open page:
// - prep for other opponents, partner names, replay links, backups, storage ids and account details are never included;
// - free-text notes only when the user ticks "include my notes" for that message.

export const CHAT_LIMITS = Object.freeze({
  text: 1000, // characters in a message
  notes: 1000, // characters of opted-in notes
  contextBytes: 8192, // UTF-8 bytes of the context JSON
  reply: 4000, // characters in a reply
  body: 24 * 1024, // bytes in a request body
});
export const CONTEXT_VERSION = 1;
export const PAGE_VIEWS = Object.freeze(['overview', 'brief', 'plan', 'sets', 'calcs', 'practice', 'other']);
export const SPEED = Object.freeze(['tailwind', 'trick-room', 'priority', 'none', 'unknown']);
export const RULE_VALUES = Object.freeze({
  matchLength: ['bo3', 'bo1', 'bo5'], disclosure: ['closed', 'open-at-preview', 'exchanged-in-advance', 'partial'],
  sixPerMatch: ['pick-6-each-match', 'six-per-game', 'whole-ten'], itemClause: ['on', 'off'], platform: ['showdown', 'in-game', 'both'],
  setLockWithinBo3: ['locked', 'can-change'], bringPick: ['6-4', 'other'],
});
const PLAN_SOURCE = ['detected', 'seed', 'saved', 'look-first'];
const STATUS = ['has', 'thin', 'none'];
const SET_SOURCES = ['sheet-open', 'seen-vs-me', 'seen-vs-others', 'ladder', 'my-guess', 'counterprep-guess', 'fixed'];
const ORDER = ['first', 'second', 'depends', 'tie'];
const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
/** The chips a context shows, in order (each removable before sending; notes only when opted in). */
export const CHIP_KEYS = Object.freeze(['page', 'pov', 'opponent', 'schedule', 'rosters', 'six', 'briefing', 'plan', 'set', 'calc', 'rules', 'notes']);

const ID = /^[a-z0-9]{1,40}$/;
const CODE = /^[a-z0-9-]{1,40}$/;
const CALC_CHIP = /^[a-z0-9@:=+.-]{1,48}$/; // a calc condition: code[@side][:stat][=value], all closed values
const codes = (v, max, re = CODE) => Array.isArray(v) && v.length <= max && v.every((x) => typeof x === 'string' && re.test(x));
const idOrEmpty = (v) => v === '' || (typeof v === 'string' && ID.test(v));
const arr = (v, max, each) => Array.isArray(v) && v.length <= max && v.every(each);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v, max) => typeof v === 'string' && v.length <= max && !/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(v);
const ids = (v, max) => Array.isArray(v) && v.length <= max && v.every((x) => typeof x === 'string' && ID.test(x));
const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const only = (o, keys, at, e) => { for (const k of Object.keys(o)) if (!keys.includes(k)) e.push(`${at}.${k}: not allowed`); };

/** Errors in a context (empty = valid). Unknown keys anywhere are errors: the Worker stores only this shape. */
export function checkContext(ctx) {
  const e = [];
  if (!isObj(ctx)) return ['context: not an object'];
  only(ctx, ['v', ...CHIP_KEYS], 'context', e);
  if (ctx.v !== CONTEXT_VERSION) e.push('context.v');
  if (!isObj(ctx.page) || ctx.page.area !== 'prep' || !PAGE_VIEWS.includes(ctx.page.view)) e.push('context.page');
  else only(ctx.page, ['area', 'view'], 'context.page', e);
  if (ctx.pov !== undefined) {
    if (!isObj(ctx.pov) || !str(ctx.pov.coach, 40) || !int(ctx.pov.seat, 1, 20) || typeof ctx.pov.you !== 'boolean') e.push('context.pov');
    else only(ctx.pov, ['coach', 'seat', 'you'], 'context.pov', e);
  }
  if (ctx.opponent !== undefined) {
    const o = ctx.opponent;
    if (!isObj(o) || !str(o.coach, 40) || !int(o.seat, 1, 20) || (o.weeks !== undefined && !(Array.isArray(o.weeks) && o.weeks.length <= 5 && o.weeks.every((w) => int(w, 1, 20))))
      || (o.group !== undefined && !str(o.group, 12))) e.push('context.opponent');
    else only(o, ['coach', 'seat', 'weeks', 'group'], 'context.opponent', e);
  }
  if (ctx.rosters !== undefined) {
    if (!isObj(ctx.rosters) || (ctx.rosters.mine !== undefined && !ids(ctx.rosters.mine, 12)) || (ctx.rosters.theirs !== undefined && !ids(ctx.rosters.theirs, 12))) e.push('context.rosters');
    else only(ctx.rosters, ['mine', 'theirs'], 'context.rosters', e);
  }
  if (ctx.six !== undefined && !ids(ctx.six, 10)) e.push('context.six');
  if (ctx.schedule !== undefined) {
    const sc = ctx.schedule;
    if (!isObj(sc) || !arr(sc.weeks, 10, (w) => isObj(w) && int(w.week, 1, 20) && (w.opponent === null || str(w.opponent, 40)) && typeof w.bye === 'boolean' && Object.keys(w).every((k) => ['week', 'opponent', 'bye'].includes(k)))
      || !(sc.next === undefined || sc.next === null || str(sc.next, 40))) e.push('context.schedule');
    else only(sc, ['weeks', 'next'], 'context.schedule', e);
  }
  if (ctx.briefing !== undefined) {
    const b = ctx.briefing;
    if (!isObj(b) || !arr(b.key ?? [], 3, (x) => isObj(x) && ID.test(x.id ?? '') && codes(x.reasons, 8) && Object.keys(x).length === 2)
      || !arr(b.plans ?? [], 6, (x) => isObj(x) && CODE.test(x.core ?? '') && ids(x.tells, 6) && (x.status === null || STATUS.includes(x.status)) && Object.keys(x).length === 3)
      || !arr(b.speed ?? [], 12, (x) => isObj(x) && ID.test(x.a ?? '') && ID.test(x.b ?? '') && CODE.test(x.scenario ?? '') && ORDER.includes(x.result) && Object.keys(x).length === 4)) e.push('context.briefing');
    else only(b, ['key', 'plans', 'speed'], 'context.briefing', e);
  }
  if (ctx.plan !== undefined) {
    const p = ctx.plan;
    if (!isObj(p) || !str(p.name, 60) || !PLAN_SOURCE.includes(p.source) || !ids(p.members, 10) || !ids(p.tells ?? [], 10) || !SPEED.includes(p.theirSpeed) || !ids(p.lead, 2) || !ids(p.back, 4)
      || !idOrEmpty(p.mega) || !(p.myStatus === undefined || p.myStatus === null || STATUS.includes(p.myStatus))) e.push('context.plan');
    else only(p, ['name', 'source', 'members', 'tells', 'theirSpeed', 'lead', 'back', 'mega', 'myStatus'], 'context.plan', e);
  }
  if (ctx.set !== undefined) {
    const t = ctx.set;
    const spOk = t?.sp === 'unknown' || (isObj(t?.sp) && Object.entries(t.sp).every(([k, v]) => STATS.includes(k) && int(v, 0, 32)));
    const srcOk = t?.src === undefined || (isObj(t.src) && Object.entries(t.src).every(([k, v]) => (k === 'moves' ? arr(v, 4, (x) => x === null || SET_SOURCES.includes(x)) : ['item', 'ability', 'nature', 'sp'].includes(k) && (v === null || SET_SOURCES.includes(v)))));
    if (!isObj(t) || !['mine', 'theirs'].includes(t.side) || !ID.test(t.species ?? '') || !['item', 'ability', 'nature'].every((k) => idOrEmpty(t[k])) || !ids(t.moves, 4) || !spOk || !srcOk) e.push('context.set');
    else only(t, ['side', 'species', 'item', 'ability', 'nature', 'moves', 'sp', 'src'], 'context.set', e);
  }
  if (ctx.calc !== undefined) {
    const c = ctx.calc;
    if (!isObj(c) || ![c.attacker, c.defender, c.move].every((x) => typeof x === 'string' && ID.test(x)) || !str(c.result, 200) || !codes(c.chips ?? [], 16, CALC_CHIP)
      || !(c.ko2 === undefined || c.ko2 === null || str(c.ko2, 24)) || !arr(c.envelope ?? [], 3, (x) => isObj(x) && ['frail', 'common', 'max'].includes(x.key) && (x.ko === null || str(x.ko, 24)) && Object.keys(x).length === 2)) e.push('context.calc');
    else only(c, ['attacker', 'defender', 'move', 'result', 'chips', 'ko2', 'envelope'], 'context.calc', e);
  }
  if (ctx.rules !== undefined) {
    if (!isObj(ctx.rules) || !Object.entries(ctx.rules).every(([k, v]) => RULE_VALUES[k]?.includes(v))) e.push('context.rules');
  }
  if (ctx.notes !== undefined && (!str(ctx.notes, CHAT_LIMITS.notes) || !ctx.notes.trim())) e.push('context.notes');
  if (!e.length && contextBytes(ctx) > CHAT_LIMITS.contextBytes) e.push('context: too large');
  return e;
}
export const contextBytes = (ctx) => new TextEncoder().encode(JSON.stringify(ctx)).length;
/** The context without the chips the user removed (page always stays: it says which screen the question is about). */
export function withoutChips(ctx, removed = []) {
  const out = { ...ctx };
  for (const k of removed) if (k !== 'page' && k !== 'v') delete out[k];
  return out;
}

// ---------- ids (browser and Worker; no randomness in the Worker beyond its own) ----------
export const CONV_RE = /^c_[a-z2-7]{16}$/;
export const CLIENT_RE = /^m_[a-z2-7]{16}$/;
export const MSG_RE = /^[0-9a-z]{9}-[a-z2-7]{8}$/;
const B32 = 'abcdefghijklmnopqrstuvwxyz234567';
export const randomB32 = (n, rnd = (a) => globalThis.crypto.getRandomValues(a)) => [...rnd(new Uint8Array(n))].map((b) => B32[b & 31]).join('');
export const newConvId = (rnd) => `c_${randomB32(16, rnd)}`;
export const newClientId = (rnd) => `m_${randomB32(16, rnd)}`;
/** A message id that sorts by time: 9 base-36 digits of milliseconds, then 8 random characters. */
export const newMessageId = (now, rnd) => `${Math.floor(now).toString(36).padStart(9, '0')}-${randomB32(8, rnd)}`;

// Cores to fear: which team plans ("cores") each opponent can field from their drafted pool, which of my mons are
// candidate answers, an answer status per prep scenario (A = pool only, B = open team sheets), and how concentrated those
// answers are (response concentration). Pure and data-driven: every core, slot, answer, blocker and threshold comes from
// the core spec (data/cores.json, a verbatim copy of docs/research/strategy/cores.json made by tools/build-data.mjs).
// There are no core-specific branches here. Reference implementation: docs/research/strategy/raw/cores-check.py (v3).
// This module mirrors its semantics and tie-breaks; tools/cores-report.mjs prints the same text report and the same
// --json document so the two can be compared byte for byte. Shared by the server, the browser and the tests.
import { toID } from './names.mjs';
import { affordability, budgetSummary } from './budget.mjs';
import { effectiveness } from './analysis.mjs';

/** Versioned contract: the spec version this engine implements and the parity schema of tools/cores-report.mjs --json. */
export const CONTRACT = Object.freeze({ engine: 'cores/2', spec: 3, specRevisions: Object.freeze([2, 3, 4]), statusRule: 'v3', schema: 'drafarig-cores-check/1' });
export const SUPPORTED_SPEC_VERSIONS = Object.freeze([3]);
// Spec revisions this engine reproduces byte for byte (a spec without `revision` is revision 1). Revision 2 of v3 changed
// reference rules (per-mon ranking with the non-partial tie-break, blocker attribution over every entry), so engine
// cores/2 implements revisions 2 and 3 (3 is data-only; both verified byte-identical against cores-check.py --json:
// 22a7fbee… and f933c17a…) and revision 4 (text-only: displayed copy rewritten, evidence moved to non-displayed fields;
// verified byte-identical, same f933c17a… --json hash). Revision 1 data is refused rather than evaluated under revision 2 rules.
// Answer fields the UI never renders: `evidence` (and any other field not read by lib/cores-view.mjs).
export const SUPPORTED_SPEC_REVISIONS = CONTRACT.specRevisions;

/** Evidence strength: usage (the move is in keyMoves; abilities, types and stats count as usage) beats learnset. */
export const USAGE = 2, LEARNSET = 1;
export const evidenceName = (e) => (e === USAGE ? 'usage' : e === LEARNSET ? 'learnset' : null);
export const CLASS_RANK = Object.freeze({ structural: 3, 'standard-move': 2, tech: 1 });
export const STATUS_RANK = Object.freeze({ none: 0, thin: 1, has: 2 });
const STRUCTURAL_KINDS = new Set(['type', 'defense', 'ability', 'stats', 'stab']);
const KINDS = new Set(['move', ...STRUCTURAL_KINDS]);
const COND_KEYS = new Set(['kind', 'minEvidence', 'value', 'spe', 'atkOrSpa', 'spa', 'spaOverAtk', 'attackType', 'maxMult', 'type', 'minStat']);
const STAT_KEYS = ['spe', 'atkOrSpa', 'spa'];
const PREP_LEVELS = ['Low', 'Med', 'High'];
// Weather / terrain setter abilities and the species role that says the species is drafted for them (statusRule.abilityChoice).
const SETTER_ROLE = {
  Drizzle: 'rain-setter', Drought: 'sun-setter', 'Sand Stream': 'sand-setter', 'Sand Spit': 'sand-setter', 'Snow Warning': 'snow-setter',
  'Psychic Surge': 'terrain-setter', 'Electric Surge': 'terrain-setter', 'Grassy Surge': 'terrain-setter', 'Misty Surge': 'terrain-setter',
};
const arr = (v) => (Array.isArray(v) ? v : [v]);
/**
 * Python round(x, 4). toFixed rounds the exact binary value correctly, like Python, except on an exact tie (the exact
 * decimal expansion ends in a 5 at the fifth decimal), where toFixed rounds up and Python rounds half to even
 * (72/256 = 0.28125 -> 0.2812; code review m3). toFixed(30) is exact for any such tie: a tie is a multiple of 2^-5.
 */
export function round4(x) {
  const [int, frac] = Math.abs(x).toFixed(30).split('.');
  if (frac[4] !== '5' || !/^0*$/.test(frac.slice(5))) return Number(x.toFixed(4));
  const down = Number(`${int}.${frac.slice(0, 4)}`);
  const r = Number(frac[3]) % 2 === 0 ? down : Number((down + 1e-4).toFixed(4));
  return x < 0 ? -r : r;
}

// ---------- Spec ----------

/**
 * Refuses (throws on) a spec this engine would read differently from the reference: an unsupported version, or any
 * violation of cores.json conditionLanguage.validation. `types` (dex.types) checks defense / stab type names.
 */
export function validateSpec(spec, types = null, { verifyRevision = true } = {}) {
  const fail = (where, msg) => { throw new Error(`core spec: ${where}: ${msg}`); };
  if (!SUPPORTED_SPEC_VERSIONS.includes(spec?.version)) {
    fail('version', `version ${JSON.stringify(spec?.version)} is not supported by engine ${CONTRACT.engine} (supports ${SUPPORTED_SPEC_VERSIONS.join(', ')})`);
  }
  const revision = spec.revision ?? 1;
  if (verifyRevision && !SUPPORTED_SPEC_REVISIONS.includes(revision)) {
    fail('revision', `v${spec.version} revision ${JSON.stringify(spec.revision)} is not verified against engine ${CONTRACT.engine} (verified: revision ${SUPPORTED_SPEC_REVISIONS.join(', ')}); update lib/cores.mjs and re-run the parity check first`);
  }
  const knownType = (t) => typeof t === 'string' && (!types || types.includes(t));
  const cond = (c, where) => {
    if (!c || typeof c !== 'object' || Array.isArray(c)) fail(where, 'condition must be an object');
    if ('allOf' in c) {
      if (Object.keys(c).some((k) => k !== 'allOf' && k !== 'minEvidence') || !Array.isArray(c.allOf) || !c.allOf.length) {
        fail(where, 'an allOf node may only carry allOf (a non-empty list) and minEvidence');
      }
      c.allOf.forEach((x, i) => cond(x, `${where}.allOf[${i}]`));
    } else {
      if (!KINDS.has(c.kind)) fail(where, `unknown condition kind ${JSON.stringify(c.kind)}`);
      const extra = Object.keys(c).filter((k) => !COND_KEYS.has(k));
      if (extra.length) fail(where, `unknown keys ${extra.sort().join(', ')}`);
      if (c.kind === 'stats') {
        for (const k of STAT_KEYS) {
          if (!(k in c)) continue;
          const ops = c[k] && typeof c[k] === 'object' ? Object.entries(c[k]) : [];
          if (ops.length !== 1 || !['<=', '>='].includes(ops[0][0]) || typeof ops[0][1] !== 'number') fail(where, `stats.${k} must be {"<=": n} or {">=": n}`);
        }
        if (![...STAT_KEYS, 'spaOverAtk'].some((k) => k in c)) fail(where, 'stats condition tests nothing');
      }
      if (['move', 'ability', 'type'].includes(c.kind)) {
        if (!(Array.isArray(c.value) ? c.value.length : c.value)) fail(where, `${c.kind} needs a value`);
        if (c.kind !== 'move' && !Array.isArray(c.value)) fail(where, `${c.kind} value must be a list`);
        if (!arr(c.value).every((v) => typeof v === 'string')) fail(where, `${c.kind} values must be names`);
      }
      if (c.kind === 'defense' && (!knownType(c.attackType) || typeof c.maxMult !== 'number')) fail(where, 'defense needs a known attackType and a numeric maxMult');
      if (c.kind === 'stab' && (!knownType(c.type) || typeof c.minStat !== 'number')) fail(where, 'stab needs a known type and a numeric minStat');
    }
    if ('minEvidence' in c && c.minEvidence !== 'usage') fail(where, 'minEvidence must be "usage"');
  };
  if (!Array.isArray(spec.cores)) fail('root', 'cores[] missing');
  const coreIds = new Set();
  for (const core of spec.cores) {
    const w = `core ${core.id}`;
    if (coreIds.has(core.id)) fail(w, 'duplicate core id');
    coreIds.add(core.id);
    const det = core.detection;
    if (!Array.isArray(det?.slots) || !det.slots.length) fail(w, 'detection.slots missing');
    // code review n1: the effective values detect() uses (defaults 2 and 4); a core must fit in the 4 brought
    const md = det.minDistinct ?? 2, mm = det.maxMembers ?? 4;
    if (!Number.isInteger(md) || !Number.isInteger(mm) || !(md >= 1 && md <= mm && mm <= 4)) {
      fail(w, `need integers 1 <= minDistinct <= maxMembers <= 4 (got ${JSON.stringify(det.minDistinct)}, ${JSON.stringify(det.maxMembers)})`);
    }
    det.slots.forEach((s, i) => {
      if (!Number.isInteger(s.min) || s.min < 1) fail(`${w} slot ${s.name}`, 'min must be a positive integer');
      if (!Array.isArray(s.anyOf) || !s.anyOf.length) fail(`${w} slot ${s.name}`, 'anyOf missing');
      s.anyOf.forEach((c, j) => cond(c, `${w} slots[${i}].anyOf[${j}]`));
    });
    const answerIds = new Set();
    for (const a of core.answers ?? []) {
      if (!a.id || !a.kind) fail(w, 'answer needs id and kind');
      if (answerIds.has(a.id)) fail(w, `duplicate answer id ${a.id}`);
      answerIds.add(a.id);
      // code review n1: a typo such as "abilty" would silently change the answer's class; "false" (a string) is truthy
      if (!KINDS.has(a.kind)) fail(`${w} answer ${a.id}`, `unknown answer kind ${JSON.stringify(a.kind)}`);
      for (const f of ['partial', 'counts']) if (f in a && typeof a[f] !== 'boolean') fail(`${w} answer ${a.id}`, `${f} must be true or false, got ${JSON.stringify(a[f])}`);
      cond(a.test, `${w} answer ${a.id}.test`);
      (a.blockedBy ?? []).forEach((c, j) => cond(c, `${w} answer ${a.id}.blockedBy[${j}]`));
      if ('setterBlockedBy' in a) {
        const sb = a.setterBlockedBy;
        if (!det.slots.some((s) => s.name === sb?.slot) || !Array.isArray(sb.anyOf) || !sb.anyOf.length) {
          fail(`${w} answer ${a.id}`, 'setterBlockedBy needs a slot of this core and a non-empty anyOf');
        }
        sb.anyOf.forEach((c, j) => cond(c, `${w} answer ${a.id}.setterBlockedBy.anyOf[${j}]`));
      }
    }
    for (const sc of ['A', 'B']) if (!PREP_LEVELS.includes(core.prepSensitivity?.[sc])) fail(w, `prepSensitivity.${sc} must be Low, Med or High`);
  }
}

/**
 * Evaluation context: dex + spec + caches. Build once per (dex, spec) and pass to every function below.
 * Group move tags (one tag shared by several moves in dataModel.moveTags: screens, redirection, speed-drop, pivot) are
 * derived from the spec. A group tag is learnset evidence only for a condition listing the whole group (groupTagRule).
 */
export function coreContext(dex, spec, { verifyRevision = true } = {}) {
  // verifyRevision:false is for the parity tools only (checking a new research revision before the engine accepts it)
  validateSpec(spec, dex.types, { verifyRevision });
  const moveTags = spec.dataModel?.moveTags ?? {};
  const groups = new Map();
  for (const [move, tag] of Object.entries(moveTags)) { if (!groups.has(tag)) groups.set(tag, []); groups.get(tag).push(move); }
  const groupTags = new Set([...groups].filter(([, moves]) => moves.length > 1).map(([tag]) => tag));
  const rc = spec.responseConcentration?.coFailure ?? {};
  return {
    dex, spec, moveTags, groups, groupTags, coreById: new Map(spec.cores.map((c) => [c.id, c])),
    cofail: { minMult: rc.minMult ?? 2, minStat: rc.minStat ?? 100 }, _opts: new Map(), _tech: new Map(),
  };
}

/** Roster ids from a league coach ({picks:[{id}]}); unmatched picks (id null) are left out. */
export const rosterIds = (coach) => (coach?.picks ?? []).map((p) => p.id).filter(Boolean);

// ---------- Options and evidence ----------

/** Every (form, ability) option of a species: the form it's in when it does the job, plus the one ability it has. */
export function options(cx, id) {
  let out = cx._opts.get(id);
  if (out) return out;
  const s = cx.dex.species[id];
  out = [];
  if (s) for (const form of s.forms) {
    for (const ability of form.abilities?.length ? form.abilities : [null]) out.push({ id, num: s.num, form, ability, mega: !!form.mega });
  }
  cx._opts.set(id, out);
  return out;
}

function techSet(cx, id) {
  let t = cx._tech.get(id);
  if (!t) cx._tech.set(id, (t = new Set((cx.dex.species[id]?.learnsetTech ?? []).map(toID))));
  return t;
}

/**
 * Evidence that a species can use a move (or one of a list): USAGE if any is in keyMoves; LEARNSET if a single-move role
 * tag or learnsetTech[] covers one, or if the listed moves include every move of a group tag the species has; else null.
 * Moves belong to the species, so this holds for every option (Megas keep the moveset).
 */
export function moveEvidence(cx, id, value) {
  const s = cx.dex.species[id];
  if (!s) return null;
  const vals = arr(value);
  if (vals.some((v) => s.keyMoves.includes(v))) return USAGE;
  const tech = techSet(cx, id);
  for (const v of vals) {
    const tag = cx.moveTags[v];
    if (tag !== undefined && s.roles.includes(tag) && !cx.groupTags.has(tag)) return LEARNSET; // single-move tag: exact
    if (tech.has(toID(v))) return LEARNSET;
  }
  const tags = new Set(vals.map((v) => cx.moveTags[v]));
  if (tags.size === 1 && !tags.has(undefined)) {
    const [tag] = tags;
    if (s.roles.includes(tag) && cx.groups.get(tag).every((m) => vals.includes(m))) return LEARNSET; // whole group listed
  }
  return null;
}

/** The listed moves that produce moveEvidence() (for labels). A group-tag match returns them all. */
export function matchedMoves(cx, id, value) {
  const s = cx.dex.species[id];
  if (!s) return [];
  const vals = arr(value);
  const used = vals.filter((v) => s.keyMoves.includes(v));
  if (used.length) return used;
  const tech = techSet(cx, id);
  const exact = vals.filter((v) => {
    const tag = cx.moveTags[v];
    return (tag !== undefined && s.roles.includes(tag) && !cx.groupTags.has(tag)) || tech.has(toID(v));
  });
  if (exact.length) return exact;
  return moveEvidence(cx, id, vals) ? vals : [];
}

const cmpStat = (v, rule) => { const [[op, n]] = Object.entries(rule); return op === '<=' ? v <= n : v >= n; };

/**
 * Evidence (USAGE / LEARNSET) that option o satisfies a condition, or null. allOf = weakest part; minEvidence:'usage'
 * rejects learnset-only matches, on an allOf node too (v3 allOfMinEvidence). noAbility: ability conditions never match
 * (used to tell whether an ability is what fills a slot).
 */
export function conditionEvidence(cx, cond, o, noAbility = false) {
  if ('allOf' in cond) {
    let min = USAGE;
    for (const c of cond.allOf) {
      const e = conditionEvidence(cx, c, o, noAbility);
      if (!e) return null;
      min = Math.min(min, e);
    }
    return cond.minEvidence === 'usage' && min < USAGE ? null : min;
  }
  if (noAbility && cond.kind === 'ability') return null;
  const e = baseEvidence(cx, cond, o);
  if (e && cond.minEvidence === 'usage' && e < USAGE) return null;
  return e;
}

function baseEvidence(cx, cond, o) {
  const f = o.form, bs = f.baseStats;
  switch (cond.kind) {
    case 'move': return moveEvidence(cx, o.id, cond.value);
    case 'ability': return cond.value.includes(o.ability) ? USAGE : null;
    case 'type': return f.types.some((t) => cond.value.includes(t)) ? USAGE : null;
    case 'stats': {
      let ok = true;
      if ('spe' in cond) ok &&= cmpStat(bs.spe, cond.spe);
      if ('atkOrSpa' in cond) ok &&= cmpStat(Math.max(bs.atk, bs.spa), cond.atkOrSpa);
      if ('spa' in cond) ok &&= cmpStat(bs.spa, cond.spa);
      if (cond.spaOverAtk) ok &&= bs.spa > bs.atk;
      return ok ? USAGE : null;
    }
    case 'defense': {
      let m = 1;
      for (const t of f.types) m *= cx.dex.typechart[cond.attackType][t];
      return m <= cond.maxMult ? USAGE : null;
    }
    case 'stab': return f.types.includes(cond.type) && Math.max(bs.atk, bs.spa) >= cond.minStat ? USAGE : null;
    default: throw new Error(`core spec: unknown condition kind ${cond.kind}`);
  }
}

const involvesAbility = (c) => ('allOf' in c ? c.allOf.some(involvesAbility) : c.kind === 'ability');

/** Best evidence that option o fills a slot (any of its conditions). */
export function slotEvidence(cx, slot, o, noAbility = false) {
  let best = null;
  for (const c of slot.anyOf) {
    const e = conditionEvidence(cx, c, o, noAbility);
    if (e && (best === null || e > best)) best = e;
  }
  return best;
}

/** What made a condition match, for labels: {via, viaKind} = the ability, the moves, or the matching types. */
function matchedVia(cx, cond, o) {
  if ('allOf' in cond) {
    const parts = cond.allOf.map((c) => matchedVia(cx, c, o)).filter((p) => p.via);
    return { via: parts.map((p) => p.via).join(' + ') || null, viaKind: parts.length === 1 ? parts[0].viaKind : parts.length ? 'combo' : null };
  }
  if (cond.kind === 'ability') return { via: o.ability, viaKind: 'ability' };
  if (cond.kind === 'move') return { via: matchedMoves(cx, o.id, cond.value).join(' / ') || null, viaKind: 'move' };
  if (cond.kind === 'type') return { via: o.form.types.filter((t) => cond.value.includes(t)).join(' / '), viaKind: 'type' };
  return { via: null, viaKind: null };
}
/** Answer-entry `via` (UX v3.1 R1): the ability, the moves ('Icy Wind / Electroweb'), parts joined with ' + '; null for
 *  type / defense / stats / stab tests. */
function answerVia(cx, cond, o) {
  if ('allOf' in cond) return cond.allOf.map((c) => answerVia(cx, c, o)).filter(Boolean).join(' + ') || null;
  if (cond.kind === 'ability') return o.ability;
  if (cond.kind === 'move') return matchedMoves(cx, o.id, cond.value).join(' / ') || null;
  return null;
}
const movesOf = (cx, cond, o) => ('allOf' in cond ? cond.allOf.flatMap((c) => movesOf(cx, c, o)) : cond.kind === 'move' ? matchedMoves(cx, o.id, cond.value) : []);

// ---------- Detection (opponent side) ----------

function* combinations(n, k, start = 0, acc = []) {
  if (acc.length === k) { yield acc.slice(); return; }
  for (let i = start; i <= n - (k - acc.length); i++) { acc.push(i); yield* combinations(n, k, i + 1, acc); acc.pop(); }
}
function* product(lists) { // itertools.product order: the last list varies fastest
  const idx = lists.map(() => 0);
  if (lists.some((l) => !l.length)) return;
  while (true) {
    yield idx.map((i, j) => lists[j][i]);
    let j = lists.length - 1;
    while (j >= 0 && ++idx[j] === lists[j].length) idx[j--] = 0;
    if (j < 0) return;
  }
}
const cmpTuple = (a, b) => {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const x = a[i], y = b[i];
    const d = Array.isArray(x) ? cmpTuple(x, y) : x - y;
    if (d) return d;
  }
  return a.length - b.length;
};

/**
 * Best legal assignment of roster mons to the core's slots, or null (cores.json fieldability.algorithm).
 * Each member uses exactly one option; at most `megaLimit` members in a Mega form; distinct dex numbers (species clause);
 * minDistinct <= members <= maxMembers; each slot filled by at least slot.min members (a member may fill several slots).
 * Best = fewest Megas, then strongest evidence, then fewest members, then roster order; the first found wins ties.
 * Member `ability` is the option's ability; `abilityRelevant` says whether that ability is what fills one of its slots
 * (memberAbilityDisplay: show it only then; Torkoal's White Smoke on a Trick Room card is incidental).
 */
export function detect(cx, core, roster, { megaLimit = 1 } = {}) {
  const det = core.detection, slots = det.slots;
  const minDistinct = det.minDistinct ?? 2, maxMembers = det.maxMembers ?? 4;
  const cands = new Map();
  for (const id of roster) {
    const seen = new Map();
    for (const o of options(cx, id)) {
      const sig = slots.map((s) => slotEvidence(cx, s, o));
      if (!sig.some(Boolean)) continue;
      const key = sig.join(',') + '|' + o.mega; // one candidate per (slots it fills with what evidence, Mega or not)
      if (!seen.has(key)) seen.set(key, { o, sig });
    }
    if (seen.size) cands.set(id, [...seen.values()]);
  }
  const ids = [...cands.keys()];
  let best = null;
  for (let n = minDistinct; n <= Math.min(maxMembers, ids.length); n++) {
    for (const S of combinations(ids.length, n)) {
      if (new Set(S.map((i) => cx.dex.species[ids[i]].num)).size < n) continue; // species clause
      for (const pick of product(S.map((i) => cands.get(ids[i])))) {
        const megas = pick.reduce((a, c) => a + (c.o.mega ? 1 : 0), 0);
        if (megas > megaLimit) continue;
        let ok = true, evmin = USAGE;
        for (let j = 0; j < slots.length && ok; j++) {
          const hits = pick.map((c) => c.sig[j]).filter(Boolean).sort((a, b) => b - a);
          if (hits.length < slots[j].min) ok = false;
          else evmin = Math.min(evmin, hits[slots[j].min - 1]);
        }
        if (!ok) continue;
        const score = [megas, -evmin, n, S];
        if (!best || cmpTuple(score, best.score) < 0) best = { score, pick, megas, evmin };
      }
    }
  }
  if (!best) return null;
  const members = best.pick.map(({ o, sig }) => {
    const filled = slots.map((s, j) => (sig[j] ? j : -1)).filter((j) => j >= 0);
    // per slot: the ability is what fills it when the slot evidence drops with ability conditions ignored
    const byAbility = filled.filter((j) => (slotEvidence(cx, slots[j], o, true) ?? 0) < sig[j]);
    return {
      id: o.id, form: o.form.name, mega: o.mega, ability: o.ability,
      abilityRelevant: byAbility.length > 0, abilitySlots: byAbility.map((j) => slots[j].name),
      slots: filled.map((j) => slots[j].name),
      slotEvidence: filled.map((j) => evidenceName(sig[j])),
    };
  });
  return { members, megas: best.megas, evidence: evidenceName(best.evmin), confidence: best.evmin === USAGE ? 'likely' : 'possible' };
}

/** 'fieldable' (legal assignment), 'mega-conflict' (legal only with 2+ Megas), or null. */
export function coreState(cx, core, roster) {
  const a = detect(cx, core, roster);
  if (a) return { state: 'fieldable', assignment: a };
  const b = detect(cx, core, roster, { megaLimit: Infinity });
  return b ? { state: 'mega-conflict', assignment: b } : { state: null, assignment: null };
}

/** For each slot, every roster mon that can fill it with some option (best evidence, non-Mega preferred). No legality check. */
export function slotPool(cx, core, roster) {
  return core.detection.slots.map((slot) => {
    const mons = [];
    for (const id of roster) {
      let best = null;
      for (const o of options(cx, id)) {
        const e = slotEvidence(cx, slot, o);
        if (e && (!best || e > best.e || (e === best.e && !o.mega && best.o.mega))) best = { e, o };
      }
      if (best) mons.push({ id, form: best.o.form.name, mega: best.o.mega, evidence: evidenceName(best.e) });
    }
    return { slot: slot.name, min: slot.min, mons };
  });
}

// ---------- Candidate answers (my side) ----------

/**
 * First opponent pool mon matching one of answer.blockedBy (blockedBy order, then pool order, then option order), or,
 * after that, an opponent option that fills the core's setterBlockedBy.slot with usage evidence and satisfies one of its
 * anyOf (a Ghost-type or Inner Focus Tailwind setter vs 'Fake Out the setter'). Null if none.
 * Deliberately cautious: the whole drafted pool is scanned and their own one-Mega limit is ignored (cores.md §7).
 * Returns {id, name, form, mega, via, viaKind, setter}.
 */
export function contestedBy(cx, answer, oppRoster, core = null) {
  const hit = (id, o, cond, setter) => ({ id, name: cx.dex.species[id].name, form: o.form.name, mega: o.mega, ...matchedVia(cx, cond, o), setter });
  for (const cond of answer.blockedBy ?? []) {
    for (const id of oppRoster) for (const o of options(cx, id)) if (conditionEvidence(cx, cond, o)) return hit(id, o, cond, false);
  }
  const sb = answer.setterBlockedBy;
  if (sb && core) {
    const slot = core.detection.slots.find((s) => s.name === sb.slot);
    for (const id of oppRoster) {
      for (const o of options(cx, id)) {
        if (slotEvidence(cx, slot, o) !== USAGE) continue;
        const cond = sb.anyOf.find((c) => conditionEvidence(cx, c, o));
        if (cond) return hit(id, o, cond, true);
      }
    }
  }
  return null;
}

/**
 * Blockers of one answer against one opponent pool: `first` = contestedBy() (the reference's first-match rule, used for
 * the anchor decision); `all` = every pool mon that matches some blocker, in pool order, each with its first matching form
 * (revision 2 attribution; empty when the answer isn't contested).
 */
export function answerBlockers(cx, answer, oppRoster, core = null) {
  const first = contestedBy(cx, answer, oppRoster, core);
  return { first, all: first ? oppRoster.map((id) => contestedBy(cx, answer, [id], core)).filter(Boolean) : [] };
}
/** answerBlockers() for every answer of a core against one opponent pool: Map answerId -> {first, all}. */
export const blockersFor = (cx, core, oppRoster) => new Map((core.answers ?? []).map((a) => [a.id, answerBlockers(cx, a, oppRoster, core)]));

/** statusRule.abilityChoice: the ability is one of several on that form, and not the setter ability the species is drafted for. */
export function abilityChoice(cx, id, o) {
  if ((o.form.abilities?.length ?? 0) <= 1) return false;
  const role = SETTER_ROLE[o.ability];
  return !(role && cx.dex.species[id].roles.includes(role));
}

/** hiddenInformation.visibility: when the opponent can see this answer, per scenario. */
export const visibility = (a) => ({ A: a.class !== 'structural' || a.megaDependent || a.abilityChoice ? 'until-used' : 'preview', B: 'preview' });

/**
 * Every (answer, my mon) pair where the mon has an option passing the answer's test, at its best option (non-Mega first,
 * then class structural > standard-move > tech). class: structural for type/defense/ability/stats/stab answers; for move
 * answers standard-move if the move is in the mon's keyMoves (ladder top moves), else tech. counts:false entries are kept
 * (non-answers). ability is null unless the test involves an ability. contestedBy = the first matching blocker (it decides
 * the anchor); contestedByAll = every pool mon that can block it. formOk(id, form) limits the options (co-failure);
 * blockers (from blockersFor) skips recomputing them.
 */
export function answersFor(cx, core, roster, oppRoster = [], { formOk = null, blockers = null } = {}) {
  const out = [];
  for (const ans of core.answers ?? []) {
    const b = blockers?.get(ans.id) ?? answerBlockers(cx, ans, oppRoster, core);
    const blocker = b.first;
    const abInvolved = involvesAbility(ans.test);
    for (const id of roster) {
      let best = null;
      for (const o of options(cx, id)) {
        if (formOk && !formOk(id, o.form)) continue;
        const e = conditionEvidence(cx, ans.test, o);
        if (!e) continue;
        const cls = STRUCTURAL_KINDS.has(ans.kind) ? 'structural' : e === USAGE ? 'standard-move' : 'tech';
        const key = [o.mega ? 0 : 1, CLASS_RANK[cls]];
        if (!best || cmpTuple(key, best.key) > 0) best = { key, o, e, cls };
      }
      if (!best) continue;
      const entry = {
        answer: ans.id, label: ans.label, kind: ans.kind, mon: id, form: best.o.form.name,
        ability: abInvolved ? best.o.ability : null, abilityChoice: abInvolved && abilityChoice(cx, id, best.o),
        class: best.cls, evidence: evidenceName(best.e), moves: movesOf(cx, ans.test, best.o), via: answerVia(cx, ans.test, best.o),
        megaDependent: best.o.mega, partial: !!ans.partial, counts: ans.counts ?? true, contestedBy: blocker, contestedByAll: b.all,
      };
      entry.visibility = visibility(entry);
      out.push(entry);
    }
  }
  return out;
}

// Per-mon ranking (revision 2): anchor, then non-partial (S9: a contested Fake Out beats a partial priority answer), then
// class, then non-Mega. The v2 comparison rule keeps its own key.
const prefKey = (a) => [a.anchor ? 1 : 0, a.partial ? 0 : 1, CLASS_RANK[a.class], a.megaDependent ? 0 : 1];
const prefKeyV2 = (a) => [a.anchor ? 1 : 0, CLASS_RANK[a.class], a.megaDependent ? 0 : 1];
const bestBy = (key) => (list) => list.reduce((b, e) => (cmpTuple(key(e), key(b)) > 0 ? e : b)); // first maximal wins
const bestOf = bestBy(prefKey);
const statusKey = (counted) => (!counted.length ? 'none' : counted.length >= 2 && counted.some((v) => v.anchor) ? 'has' : 'thin');

function countingEntries(core, answers, scenario) {
  const high = core.prepSensitivity?.[scenario] === 'High';
  const per = new Map(); // mon -> its counting entries, in answer order (insertion = first appearance)
  for (const a of answers) {
    if (!a.counts) continue;
    const anchor = !a.partial && !a.contestedBy && (a.class !== 'tech' || high);
    // whyNotAnchor (revision 2): every reason it isn't an anchor, in the status line's order
    const whyNotAnchor = anchor ? [] : [a.partial && 'partial', a.contestedBy && 'contested', a.class === 'tech' && 'tech'].filter(Boolean);
    const e = { ...a, anchor, whyNotAnchor };
    if (!per.has(a.mon)) per.set(a.mon, []);
    per.get(a.mon).push(e);
  }
  return per;
}
const statusResult = (cx, counted) => {
  const key = statusKey(counted);
  const names = cx.spec.statusRule?.names ?? { has: 'Has answers', thin: 'Thin', none: 'No answer found' };
  return { key, label: names[key], counted, anchors: counted.filter((v) => v.anchor).map((v) => v.mon) };
};

/**
 * Status of a core's answers in one scenario (statusRule v3 incl. megaRule). Each mon counts once at its best entry by
 * (anchor, class, non-Mega); counts:false never counts; anchor = not partial, not contested, and not tech unless the core's
 * prepSensitivity for the scenario is High. At most one mon (the Mega mon) counts through a Mega-dependent entry; every
 * other mon counts at its best non-Mega entry if it has one. The Mega mon maximises (status, anchors, counted mons, class
 * sum); ties go to "no Mega mon", then to the earliest mon in answer order. Has answers = >= 2 counted and >= 1 anchor;
 * Thin = >= 1 counted; No answer found = 0. Returns {key, label, counted (best first, stable), anchors, megaMon}.
 */
export function answerStatus(cx, core, answers, scenario = 'A') {
  const per = countingEntries(core, answers, scenario);
  const overall = new Map(), nonMega = new Map();
  for (const [m, list] of per) {
    overall.set(m, bestOf(list));
    const nm = list.filter((e) => !e.megaDependent);
    nonMega.set(m, nm.length ? bestOf(nm) : null);
  }
  const build = (megaMon) => {
    const out = [];
    for (const m of per.keys()) {
      const o = overall.get(m);
      if (m === megaMon || !o.megaDependent) out.push(o);
      else if (nonMega.get(m)) out.push(nonMega.get(m)); // fallback
    }
    return out;
  };
  const score = (c) => [STATUS_RANK[statusKey(c)], c.filter((v) => v.anchor).length, c.length, c.reduce((s, v) => s + CLASS_RANK[v.class], 0)];
  let best = build(null), bestScore = score(best), megaMon = null;
  for (const m of per.keys()) {
    if (!overall.get(m).megaDependent) continue;
    const c = build(m), s = score(c);
    if (cmpTuple(s, bestScore) > 0) { best = c; bestScore = s; megaMon = m; }
  }
  const counted = [...best].sort((x, y) => cmpTuple(prefKey(y), prefKey(x))); // stable
  return { ...statusResult(cx, counted), megaMon };
}

/** The v2 status rule (greedy Mega, no fallback). Comparison only: tools/cores-report.mjs --json statusV2vsV3Diffs. */
export function answerStatusV2(cx, core, answers, scenario = 'A') {
  const per = countingEntries(core, answers, scenario);
  const vals = [...per.values()].map(bestBy(prefKeyV2)).sort((x, y) => cmpTuple(prefKeyV2(y), prefKeyV2(x)));
  const counted = [];
  let megaUsed = false;
  for (const v of vals) {
    if (v.megaDependent) { if (megaUsed) continue; megaUsed = true; }
    counted.push(v);
  }
  return statusResult(cx, counted);
}

/**
 * Answer depth (responseConcentration.depth): minimal cut sets = sets of my answering mons whose loss together lowers the
 * card's status, with no proper subset doing so; enumerated by brute force in size, then lexicographic order; depth = the
 * smallest cut size (0 for No answer found). A single point of failure is a size-1 cut on a Has answers card.
 */
export function answerDepth(cx, core, answers, scenario = 'A') {
  const s0 = answerStatus(cx, core, answers, scenario).key;
  if (s0 === 'none') return { depth: 0, cuts: [] };
  const cuts = minimalCuts(cx, core, answers, scenario, STATUS_RANK[s0]);
  return { depth: cuts.length ? Math.min(...cuts.map((c) => c.length)) : 0, cuts };
}

/** Minimal sets of my answering mons whose loss brings the status rank below `below` (size, then lexicographic order). */
function minimalCuts(cx, core, answers, scenario, below) {
  const mons = [...new Set(answers.filter((a) => a.counts).map((a) => a.mon))].sort();
  const cuts = [];
  for (let k = 1; k <= mons.length; k++) {
    for (const idx of combinations(mons.length, k)) {
      const X = idx.map((i) => mons[i]);
      if (cuts.some((c) => c.every((m) => X.includes(m)))) continue;
      const rest = answers.filter((a) => !X.includes(a.mon));
      if (STATUS_RANK[answerStatus(cx, core, rest, scenario).key] < below) cuts.push(X);
    }
  }
  return cuts;
}

/**
 * Revision 2 depth split: depthToThin = fewest mons whose loss drops a Has answers card below Has answers (null for other
 * cards); depthToNone = fewest mons whose loss leaves No answer found (null when already none).
 */
export function answerDepths(cx, core, answers, scenario = 'A') {
  const s0 = answerStatus(cx, core, answers, scenario).key;
  const smallest = (below) => { const c = minimalCuts(cx, core, answers, scenario, below); return c.length ? Math.min(...c.map((x) => x.length)) : null; };
  return { depthToThin: s0 === 'has' ? smallest(STATUS_RANK.has) : null, depthToNone: s0 !== 'none' ? smallest(STATUS_RANK.thin) : null };
}

/** My mons whose loss alone (KO'd or benched) drops a Has answers card below Has answers. */
export function singlePointsOfFailure(cx, core, myRoster, oppRoster = [], scenario = 'A') {
  const answers = answersFor(cx, core, myRoster, oppRoster);
  if (answerStatus(cx, core, answers, scenario).key !== 'has') return [];
  return answerDepth(cx, core, answers, scenario).cuts.filter((c) => c.length === 1).map((c) => c[0]).sort();
}

/**
 * Co-failure events for one card (responseConcentration.coFailure). Event = an attack type T that some opposing pool form
 * has while max(base Atk, SpA) >= minStat ('types'), or one such form with all its types ('forms'). Every one of my
 * answering OPTIONS whose form takes >= minMult (lib/analysis.mjs effectiveness: typechart + single-ability modifiers) is
 * removed; my mons keep other options that still answer (Charizard-Mega-X vs Electric). The event co-fails the card when
 * the status drops. victims = baseline counted mons whose counted form is hit >= minMult; from / to are status KEYS
 * (has / thin / none). Candidate screen only.
 */
export function coFailure(cx, core, myRoster, oppRoster, scenario = 'A', { answers = null, blockers = null } = {}) {
  blockers ??= blockersFor(cx, core, oppRoster);
  answers ??= answersFor(cx, core, myRoster, oppRoster, { blockers });
  const st0 = answerStatus(cx, core, answers, scenario);
  if (st0.key === 'none') return { types: [], forms: [] };
  const { minMult, minStat } = cx.cofail;
  const sp = (id) => cx.dex.species[id];
  const entries = st0.counted;
  const anchors = new Set(entries.filter((e) => e.anchor).map((e) => e.mon));
  const tforms = [];
  for (const id of oppRoster) for (const f of sp(id)?.forms ?? []) if (Math.max(f.baseStats.atk, f.baseStats.spa) >= minStat) tforms.push({ id, form: f });
  const weak = (form, types) => types.some((T) => effectiveness(cx.dex, T, form) >= minMult);
  const formOf = (e) => sp(e.mon).forms.find((f) => f.name === e.form);
  const after = (types) => answerStatus(cx, core, answersFor(cx, core, myRoster, oppRoster, { formOk: (id, f) => !weak(f, types), blockers }), scenario);
  const event = (types) => {
    const victims = [...new Set(entries.filter((e) => weak(formOf(e), types)).map((e) => e.mon))].sort();
    if (!victims.length) return null;
    const st1 = after(types);
    if (STATUS_RANK[st1.key] >= STATUS_RANK[st0.key]) return null;
    return {
      victims, from: st0.key, to: st1.key, // status keys (UX v3.1 U6); tools/cores-report.mjs --json converts them to labels

      anchorVictims: victims.filter((v) => anchors.has(v)), allAnchorsLost: anchors.size > 0 && [...anchors].every((a) => victims.includes(a)),
    };
  };
  const types = [], forms = [];
  for (const T of cx.dex.types) {
    const sources = tforms.filter((x) => x.form.types.includes(T)).map((x) => x.form.name);
    if (!sources.length) continue;
    const ev = event([T]);
    if (!ev) continue;
    const mult = {};
    for (const m of ev.victims) mult[m] = effectiveness(cx.dex, T, formOf(entries.find((e) => e.mon === m)));
    types.push({ type: T, ...ev, mult, sources });
  }
  for (const { id, form } of tforms) {
    const ev = event(form.types);
    if (ev) forms.push({ id, form: form.name, types: form.types, ...ev });
  }
  return { types, forms };
}

// ---------- Budget ----------

/**
 * Ids in `available` ([{id, cost}]) the coach can take next. 'exact' = the app's league rule (lib/budget.mjs: the rest of
 * the roster must still be fillable from the cheapest available mons; cores.json fieldability.budgetRule). 'simple' = the
 * v2 reference shortcut cost <= pointsLeft - (slotsLeft - 1).
 */
export function affordableIds(coach, available, rule = 'exact') {
  if (rule === 'simple') {
    const max = coach.pointsLeft - Math.max(0, coach.slotsLeft - 1);
    return new Set(available.filter((m) => m.cost <= max).map((m) => m.id));
  }
  return new Set(affordability(available, coach.pointsLeft, coach.slotsLeft).filter((a) => a.status !== 'breaks').map((a) => a.id));
}
/** The most the coach can spend on the next pick, under the same two rules. */
export function maxNextPick(coach, available, rule = 'exact') {
  if (rule === 'simple') return coach.pointsLeft - Math.max(0, coach.slotsLeft - 1);
  return budgetSummary(coach.pointsLeft, coach.slotsLeft, available.map((m) => m.cost)).maxThisPick;
}

// ---------- Forming ----------

/**
 * Available mons the coach can afford that would make the core fieldable with 'likely' confidence in one pick, sorted by
 * ladder usage (stable; availIndex keeps the board order). fills = the slots the added mon fills in the best assignment.
 * affordable: the Set of ids the coach can afford (affordableIds); without it nothing is affordable (code review n5).
 */
export function formingAdds(cx, core, roster, available, affordable = new Set()) {
  const out = [];
  available.forEach((m, availIndex) => {
    if (!affordable.has(m.id)) return;
    // A mon that fills no slot can't change detect()'s result, so skip the search for it.
    if (!options(cx, m.id).some((o) => core.detection.slots.some((s) => slotEvidence(cx, s, o)))) return;
    const a = detect(cx, core, [...roster, m.id]);
    if (!a || a.confidence !== 'likely') return;
    out.push({ id: m.id, cost: m.cost, fills: a.members.find((x) => x.id === m.id)?.slots ?? [], assignment: a, availIndex });
  });
  const pct = (id) => cx.dex.species[id]?.pika?.pct ?? 0;
  return out.sort((x, y) => pct(y.id) - pct(x.id));
}

// ---------- League cards ----------

/**
 * One card per (opponent, core) that is fieldable, a mega-conflict, or forming. Forming adds (one affordable pick that
 * makes the core likely) are looked for whenever no likely assignment exists and the opponent has empty slots
 * (fieldability.formingRule); a possible card keeps its state and confidence and carries adds. Cards follow coach order,
 * then spec core order. Answers are checked against the opponent's current pool for blockers.
 * Card: {coach, order, coreId, name, pool, state, confidence, megas, members, slotPool, adds|null, answers, nonAnswers,
 *        status: {A, B}, spof: {A, B}, depth: {A, B}, minimalCuts: {A, B}, cofailure: {A, B}, prepSensitivity}.
 * @param {{me: string[]|{picks}, opponents: Array<{name, order, picks, pointsLeft, slotsLeft}>, available: Array<{id, cost}>,
 *          budgetRule?: 'exact'|'simple', scenarios?: string[], deep?: 'all'|'main'}} args
 *   deep: 'all' (default, as the reference) computes depth, single points of failure and co-failure for every card; 'main'
 *   only for the cards of the main list: likely confidence, fieldable or mega-conflict (code review M1). Forming and possible
 *   cards then get depth / cofailure null and spof []. Response concentration counts likely fieldable cards either way.
 */
export function coreCards(cx, { me, opponents, available = [], budgetRule = 'exact', scenarios = ['A', 'B'], deep = 'all' }) {
  if (deep !== 'all' && deep !== 'main') throw new Error(`coreCards: deep must be 'all' or 'main', not ${JSON.stringify(deep)}`);
  const my = Array.isArray(me) ? me : rosterIds(me);
  const cards = [];
  for (const opp of opponents) {
    const roster = rosterIds(opp);
    const afford = opp.slotsLeft > 0 ? affordableIds(opp, available, budgetRule) : null;
    for (const core of cx.spec.cores) {
      const { state, assignment } = coreState(cx, core, roster);
      let adds = null;
      if ((!state || assignment.confidence !== 'likely') && opp.slotsLeft > 0) {
        const a = formingAdds(cx, core, roster, available, afford);
        adds = a.length ? a : null;
      }
      if (!state && !adds) continue;
      const blockers = blockersFor(cx, core, roster);
      const answers = answersFor(cx, core, my, roster, { blockers });
      const card = {
        coach: opp.name, order: opp.order, coreId: core.id, name: core.name, pool: roster,
        state: state ?? 'forming', confidence: assignment?.confidence ?? null, megas: assignment?.megas ?? null,
        members: assignment?.members ?? [], slotPool: slotPool(cx, core, roster), adds,
        answers, nonAnswers: answers.filter((a) => !a.counts),
        status: {}, spof: {}, depth: {}, depthToThin: {}, depthToNone: {}, minimalCuts: {}, cofailure: {}, prepSensitivity: core.prepSensitivity,
      };
      const full = deep === 'all' || card.confidence === 'likely';
      for (const sc of scenarios) {
        const st = answerStatus(cx, core, answers, sc);
        const { depth, cuts } = full ? answerDepth(cx, core, answers, sc) : { depth: null, cuts: null };
        const split = full ? answerDepths(cx, core, answers, sc) : { depthToThin: null, depthToNone: null };
        card.status[sc] = st;
        card.depth[sc] = depth;
        card.depthToThin[sc] = split.depthToThin;
        card.depthToNone[sc] = split.depthToNone;
        card.minimalCuts[sc] = cuts;
        card.spof[sc] = st.key === 'has' && cuts ? cuts.filter((c) => c.length === 1).map((c) => c[0]).sort() : [];
        card.cofailure[sc] = full ? coFailure(cx, core, my, roster, sc, { answers, blockers }) : null;
      }
      cards.push(card);
    }
  }
  return cards;
}

export const isLikelyFieldable = (c) => c.state === 'fieldable' && c.confidence === 'likely';
/** One key per card, "{coach}:{coreId}" (UX v3.1 R8). */
export const cardRef = (c) => `${c.coach}:${c.coreId}`;

const PREP_RANK = { Low: 0, Med: 1, High: 2 };
/** The weaker of a card's scenario statuses (key), and whether any scenario has a single point of failure. */
export const weakerStatus = (c) => Object.values(c.status).reduce((w, s) => (STATUS_RANK[s.key] < STATUS_RANK[w] ? s.key : w), 'has');
export const hasSpof = (c) => Object.values(c.spof ?? {}).some((l) => l?.length);
/**
 * Main-list order (UX v3.1 §2.8, R9): fieldable before mega-conflict; weaker A/B status none, thin, has with a single point of
 * failure, has; lower prep sensitivity of A/B first; coach order; spec core order (input order; the sort is stable).
 */
export function sortCards(cards) {
  const rank = (c) => {
    const w = weakerStatus(c);
    return [c.state === 'fieldable' ? 0 : 1, w === 'none' ? 0 : w === 'thin' ? 1 : hasSpof(c) ? 2 : 3,
      Math.min(...Object.values(c.prepSensitivity ?? { A: 'Low' }).map((p) => PREP_RANK[p] ?? 0)), c.order ?? 0];
  };
  return cards.map((c, i) => ({ c, i, k: rank(c) })).sort((x, y) => cmpTuple(x.k, y.k) || x.i - y.i).map((x) => x.c);
}
const byCountThenCost = (x, y) => y.cards.length - x.cards.length || x.cost - y.cost;

// ---------- Response concentration ----------

/**
 * responseConcentration over likely fieldable cards in one scenario (cores.json v3 responseConcentration).
 * perMon (every mon of my roster, including ones that anchor nothing): anchors, counted, spof, anchorCards, spofCards,
 *   countedCards, opponents (coaches it anchors against, coach order), opponentWeighted (each opponent with a likely card
 *   weighs 1, split over its cards), anchorBy ([{key, via, labels, answers, count}]: how it anchors, grouped by the move or
 *   ability it anchors with (`via`; typing / stat answers group by label), most first).
 * Also anchorTotal, anchorHHI, cards, opponents, excluded counts, cofailure / cofailureForms summaries and blockers.
 */
export function responseConcentration(cards, myRoster, scenario = 'A') {
  const likely = cards.filter(isLikelyFieldable);
  const rows = new Map(myRoster.map((m) => [m, { mon: m, anchors: 0, counted: 0, spof: 0, anchorCards: [], spofCards: [], countedCards: [], anchorBy: [] }]));
  const perOpp = new Map();
  for (const c of likely) {
    if (!perOpp.has(c.coach)) perOpp.set(c.coach, []);
    perOpp.get(c.coach).push(c);
    for (const e of c.status[scenario].counted) {
      const r = rows.get(e.mon);
      if (!r) continue;
      r.counted++; r.countedCards.push(cardRef(c));
      if (!e.anchor) continue;
      r.anchors++; r.anchorCards.push(cardRef(c));
      // grouped by what anchors (the move or ability, `via`); typing / stat answers have no via and group by label
      const key = e.via ?? e.label;
      const by = r.anchorBy.find((x) => x.key === key) ?? r.anchorBy[r.anchorBy.push({ key, via: e.via ?? null, labels: [], answers: [], count: 0 }) - 1];
      by.count++;
      if (!by.labels.includes(e.label)) by.labels.push(e.label);
      if (!by.answers.includes(e.answer)) by.answers.push(e.answer);
    }
    for (const m of c.spof[scenario]) { const r = rows.get(m); if (r) { r.spof++; r.spofCards.push(cardRef(c)); } }
  }
  const order = new Map(cards.map((c) => [c.coach, c.order]));
  const anchorsOn = (c, m) => c.status[scenario].counted.some((e) => e.mon === m && e.anchor);
  for (const r of rows.values()) {
    r.opponents = [...new Set(likely.filter((c) => anchorsOn(c, r.mon)).map((c) => c.coach))].sort((a, b) => order.get(a) - order.get(b));
    let w = 0;
    for (const cs of perOpp.values()) w += cs.filter((c) => anchorsOn(c, r.mon)).length / cs.length;
    r.opponentWeighted = round4(w);
    r.anchorBy.sort((a, b) => b.count - a.count);
  }
  const total = [...rows.values()].reduce((s, r) => s + r.anchors, 0);
  const hhi = total ? round4([...rows.values()].reduce((s, r) => s + (r.anchors / total) ** 2, 0)) : null;
  const perMon = [...rows.values()].sort((a, b) => b.anchors - a.anchors || b.counted - a.counted || myRoster.indexOf(a.mon) - myRoster.indexOf(b.mon));
  return {
    scenario, perMon, anchorTotal: total, anchorHHI: hhi, cards: likely.length, opponents: perOpp.size,
    excluded: {
      forming: cards.filter((c) => c.state === 'forming').length,
      possible: cards.filter((c) => c.state !== 'forming' && c.confidence === 'possible').length,
      megaConflict: cards.filter((c) => c.state === 'mega-conflict' && c.confidence === 'likely').length,
    },
    cofailure: cofailureSummary(cards, scenario, 'types'),
    cofailureForms: cofailureSummary(cards, scenario, 'forms'),
    blockers: blockersSummary(cards, scenario),
  };
}

/** Co-failures over likely fieldable cards, per (coach, type) or (coach, opposing form): cards, victims, allAnchorsLostOn. */
export function cofailureSummary(cards, scenario = 'A', level = 'types') {
  const agg = new Map();
  for (const c of cards.filter(isLikelyFieldable)) {
    for (const ev of c.cofailure[scenario]?.[level] ?? []) {
      const key = level === 'types' ? ev.type : ev.form;
      const k = JSON.stringify([c.order, c.coach, key]);
      if (!agg.has(k)) agg.set(k, { sort: [c.order, c.coach, key], coach: c.coach, [level === 'types' ? 'type' : 'form']: key, cards: [], victims: new Set(), allAnchorsLostOn: [], events: [] });
      const r = agg.get(k);
      r.cards.push(c.coreId);
      for (const v of ev.victims) r.victims.add(v);
      if (ev.allAnchorsLost) r.allAnchorsLostOn.push(c.coreId);
      r.events.push({ card: cardRef(c), ...ev });
    }
  }
  const str = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  return [...agg.values()]
    .sort((x, y) => x.sort[0] - y.sort[0] || str(x.sort[1], y.sort[1]) || str(x.sort[2], y.sort[2]))
    .map(({ sort, ...r }) => ({ ...r, victims: [...r.victims].sort() }));
}

/**
 * Opposing mons that contest my answer entries on likely fieldable cards, most contests first (revision 2: every counting
 * entry of my answering mons is checked, not only the counted one, and every matching blocker is credited, so the blocker
 * that keeps a mon from anchoring shows even when the mon counts through another entry):
 * {coach, id, name, form, megaOnly, via, contests: [{card, mon, answer, counted, clashesWithCoreMega, via, viaKind}]}.
 * megaOnly = the blocking option is a Mega form; clashesWithCoreMega = megaOnly and the card's assignment uses a Mega of
 * another species (they can't both Mega Evolve). counted = the contested entry is the one the mon counts through.
 */
export function blockersSummary(cards, scenario = 'A') {
  const agg = new Map();
  for (const c of cards.filter(isLikelyFieldable)) {
    const counted = new Set(c.status[scenario].counted.map((e) => `${e.mon}|${e.answer}`));
    for (const e of c.answers) {
      if (!e.counts || !e.contestedBy) continue;
      const isCounted = counted.has(`${e.mon}|${e.answer}`);
      for (const b of e.contestedByAll ?? [e.contestedBy]) {
        const megaOnly = !!b.mega;
        const clash = megaOnly && (c.megas ?? 0) >= 1 && c.members.filter((m) => m.mega).every((m) => m.id !== b.id);
        const k = JSON.stringify([c.order, c.coach, b.id]);
        if (!agg.has(k)) agg.set(k, { order: c.order, coach: c.coach, id: b.id, name: b.name, form: b.form, megaOnly, via: b.via, viaKind: b.viaKind, contests: [] });
        agg.get(k).contests.push({ card: cardRef(c), mon: e.mon, answer: e.answer, counted: isCounted, clashesWithCoreMega: clash, via: b.via, viaKind: b.viaKind, form: b.form, mega: megaOnly });
      }
    }
  }
  const str = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  return [...agg.values()].sort((x, y) => y.contests.length - x.contests.length || x.order - y.order || str(x.id, y.id));
}

// ---------- Research-only aggregates (never shown in the app: lead decision; cores-deep.md Developer handoff) ----------

/** Likely fieldable cards that aren't 'Has answers' in the scenario, or that have a single point of failure. */
export const weakCards = (cards, scenario = 'A') => cards.filter((c) => isLikelyFieldable(c) && (c.status[scenario].key !== 'has' || c.spof[scenario].length));

/** Research only (parity report): available mons that complete a likely core for >= minCards forming cards, cost <= maxCost. */
export function cheapEnablers(cards, maxCost, minCards = 2) {
  const map = new Map();
  for (const c of cards.filter((x) => x.state === 'forming')) {
    for (const a of [...c.adds].sort((x, y) => x.availIndex - y.availIndex)) {
      if (!map.has(a.id)) map.set(a.id, { id: a.id, cost: a.cost, cards: [] });
      map.get(a.id).cards.push(cardRef(c));
    }
  }
  return [...map.values()].filter((e) => e.cards.length >= minCards && e.cost <= maxCost).sort(byCountThenCost);
}

/** Research only (parity report): affordable picks that turn a weak card into Has answers without a single point of failure. */
export function pickFixes(cx, cards, myRoster, available, affordable, scenario = 'A') {
  const weak = weakCards(cards, scenario);
  const out = [];
  for (const m of available) {
    if (affordable && !affordable.has(m.id)) continue;
    const mine = [...myRoster, m.id];
    const fixed = weak.filter((c) => {
      const core = cx.coreById.get(c.coreId);
      if (answerStatus(cx, core, answersFor(cx, core, mine, c.pool), scenario).key !== 'has') return false;
      return c.status[scenario].key !== 'has' || !singlePointsOfFailure(cx, core, mine, c.pool, scenario).length;
    });
    if (fixed.length) out.push({ id: m.id, cost: m.cost, cards: fixed.map(cardRef) });
  }
  return out.sort(byCountThenCost);
}

/** My status against every core with no opponent blockers (the "in the abstract" view). */
export const abstractStatus = (cx, myRoster, scenarios = ['A', 'B']) => cx.spec.cores.map((core) => {
  const answers = answersFor(cx, core, myRoster);
  return { coreId: core.id, answers, status: Object.fromEntries(scenarios.map((sc) => [sc, answerStatus(cx, core, answers, sc)])) };
});

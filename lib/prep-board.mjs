// Battle Prep's Plan board (VGC-PLAN-TOOLS.md §5): their plans as targets, how your 6 covers them, "fill a gap", and lead
// and back pairs ranked inside your 6. Pure and deterministic. Everything is type, Speed and the public Cores spec's listed
// answers: nothing here is damage, odds or a pick. The app never chooses your 6, lead or Mega; these only order what the
// user taps, and every reason is a checkable fact with its condition.
import { typeRules } from './prep-matchup.mjs';
import { speedRange, compareSpeed } from './calc/stats.mjs';
import { answersFor, answerStatus, blockersFor } from './cores.mjs';

/** Seed targets (their setters when no Cores-spec plan fits) and the Cores core each one's coverage is checked against. */
export const SEED_CORE = Object.freeze({ 'seed-trick-room': 'trick-room', 'seed-tailwind': 'tailwind', 'seed-sun': 'sun', 'seed-rain': 'rain', 'seed-sand': 'sand', 'seed-snow': 'snow-veil' });
export const SEEDS = Object.freeze(Object.keys(SEED_CORE));
export const LOOK_FIRST = 'look-first';
const WEATHER_SEED = { Sun: 'seed-sun', Rain: 'seed-rain', Sand: 'seed-sand', Snow: 'seed-snow' };
const SEED_DETECTED = { 'seed-trick-room': 'trick-room', 'seed-tailwind': 'tailwind', 'seed-sun': 'sun', 'seed-rain': 'rain', 'seed-sand': 'sand', 'seed-snow': 'snow-veil' };
const MAX_DETECTED = 3, MAX_SEEDS = 2, SEED_WHILE_UNDER = 2;
const uniq = (a) => [...new Set(a)];
/** A plan's speed mode as the board compares it: Trick Room, their Tailwind, or none ('unknown' and 'priority' compare as none). */
export const boardSpeedMode = (m) => (m === 'trick-room' || m === 'tailwind' ? m : 'none');

/**
 * The board's targets, in order: saved plans (not ideas, as saved), then detected plans not yet saved (3 detected at
 * most in all), then seeds (only while fewer than 2 detected plans show; at most 2), then "look first" (their look-first
 * mons) unless it was saved as a plan. Each target:
 * {key, source: 'saved'|'suggested'|'seed'|'look-first', planId, kind, coreId, seed, label, members, tells, focus,
 *  megaUser, megaForm, speedMode, field, counted (your listed answers, from the briefing), confidence}
 * plus `couldAlso`: Trick Room / Tailwind setters of theirs with learnset-only evidence (never a target).
 */
export function boardTargets(b, plans = []) {
  const saved = plans.filter((p) => p.kind !== 'idea');
  const detectedOf = (p) => {
    const basis = p.basis?.[0];
    if (!basis) return null;
    return b.theirPlans.find((t) => t.coreId === basis && (t.megaUser ?? null) === (p.megaUser ?? null)) ?? b.theirPlans.find((t) => t.coreId === basis) ?? null;
  };
  const targets = saved.map((p) => {
    const d = detectedOf(p);
    const tells = (p.falsifiers?.atPreview ?? []).filter((x) => p.members.includes(x));
    const basis = p.basis?.[0] ?? null;
    return { key: `plan:${p.id}`, source: 'saved', planId: p.id, kind: p.kind, coreId: d?.coreId ?? null, seed: SEEDS.includes(basis) || basis === LOOK_FIRST ? basis : null,
      label: p.label ?? '', members: [...p.members], tells, focus: uniq([...tells, ...p.members]), megaUser: p.megaUser ?? null, megaForm: d?.megaForm ?? null,
      speedMode: boardSpeedMode(p.speedMode), field: p.field ?? '', counted: d?.myCounted ?? [], confidence: d?.confidence ?? null };
  });
  const savedDetected = targets.filter((t) => t.coreId).length;
  const isSaved = (t) => saved.some((p) => (p.basis ?? []).includes(t.coreId) && (p.megaUser ?? null) === (t.megaUser ?? null));
  const suggested = b.theirPlans.filter((t) => !isSaved(t)).slice(0, Math.max(0, MAX_DETECTED - savedDetected));
  for (const t of suggested) {
    targets.push({ key: `core:${t.coreId}:${t.megaUser ?? ''}`, source: 'suggested', planId: null, kind: t.confidence === 'likely' ? 'likely' : 'alt', coreId: t.coreId, seed: null,
      label: t.label, members: [...t.members], tells: [...t.tells], focus: uniq([...t.tells, ...t.members]), megaUser: t.megaUser ?? null, megaForm: t.megaForm ?? null,
      speedMode: boardSpeedMode(t.speedMode), field: t.field ?? '', counted: t.myCounted, confidence: t.confidence });
  }
  // seeds: built from their setters (ladder or forced-ability evidence), only while the detected plans are few
  const couldAlso = [];
  const detectedShown = savedDetected + suggested.length;
  const sc = Object.fromEntries((b.speed?.scenarios ?? []).map((s) => [s.key, s]));
  const savedSeed = (seed) => saved.some((p) => p.basis?.[0] === seed);
  const detectedCore = (core) => b.theirPlans.some((t) => t.coreId === core);
  const seedCands = [
    ['seed-trick-room', sc.tr?.settersTheirs ?? [], ['prior']],
    ['seed-tailwind', sc['tw-theirs']?.setters ?? [], ['prior']],
    ...Object.entries(WEATHER_SEED).map(([w, seed]) => [seed, (b.speed?.weatherSetters?.theirs?.[w] ?? []).filter((x) => x.kind === 'ability'), ['known', 'known-if-mega', 'prior']]),
  ];
  let seeds = 0;
  for (const [seed, setters, layers] of seedCands) {
    if (detectedCore(SEED_DETECTED[seed]) || savedSeed(seed)) continue;
    const focus = uniq(setters.filter((x) => layers.includes(x.layer)).map((x) => x.id));
    const learnOnly = uniq(setters.filter((x) => x.layer === 'possible').map((x) => x.id)).filter((id) => !focus.includes(id));
    if (!focus.length) { if (learnOnly.length && (seed === 'seed-trick-room' || seed === 'seed-tailwind')) couldAlso.push({ seed, ids: learnOnly }); continue; }
    if (detectedShown >= SEED_WHILE_UNDER || seeds >= MAX_SEEDS) continue;
    seeds++;
    targets.push({ key: seed, source: 'seed', planId: null, kind: 'alt', coreId: null, seed, label: '', members: focus, tells: focus, focus,
      megaUser: null, megaForm: null, speedMode: seed === 'seed-trick-room' ? 'trick-room' : seed === 'seed-tailwind' ? 'tailwind' : 'none', field: '', counted: [], confidence: null });
  }
  if (!savedSeed(LOOK_FIRST) && (b.key ?? []).length) {
    targets.push({ key: LOOK_FIRST, source: 'look-first', planId: null, kind: 'alt', coreId: null, seed: LOOK_FIRST, label: '', members: [...b.key], tells: [...b.key], focus: [...b.key],
      megaUser: null, megaForm: null, speedMode: 'none', field: '', counted: [], confidence: null });
  }
  return { targets, couldAlso };
}

/**
 * The board's shared context: type rules, Speed bands and Cores answers for one briefing.
 * input: {dex, cx, b (briefing on your whole pool), roster (your pool, in order), theirIds, savedMine ({id: {sp, sign}} for
 * your exact Speed: only for the confirmed identity)}.
 */
export function boardContext({ dex, cx = null, b, roster, theirIds, savedMine = {} }) {
  const R = typeRules(dex, cx);
  const speedOfMine = (id) => speedRange(R.baseForm(id).baseStats.spe, {}, savedMine[id] && !savedMine[id].megaForm ? savedMine[id] : null);
  const speedOfTheirs = (id, mode) => speedRange(R.baseForm(id).baseStats.spe, { tailwind: mode === 'tailwind' });
  /** first | second | depends | tie: your mon vs their mon under a target's speed mode (non-Mega forms; no Speed items). */
  const speedVs = (m, t, mode) => { const a = speedOfMine(m); return compareSpeed(a.exact ? a.max : a, speedOfTheirs(t, mode), { trickRoom: mode === 'trick-room' }); };
  const myRank = new Map((b.myMons ?? []).map((x, i) => [x.id, i]));
  return { dex, cx, b, R, roster: [...roster], theirIds: [...theirIds], speedVs, myRank };
}

// ---------- your 6: coverage strip and "fill a gap" ----------
const SEED_OF = (t) => (t.source === 'seed' || (t.source === 'saved' && SEEDS.includes(t.seed)) ? t.seed : null);
/** Cores answer status for a seed's core, for a set of your mons: {key, counted, anchors}. */
function seedStatus(ctx, seed, mons) {
  const core = ctx.cx?.coreById.get(SEED_CORE[seed]);
  if (!core || !mons.length) return { key: 'none', counted: [], anchors: [] };
  return answerStatus(ctx.cx, core, answersFor(ctx.cx, core, mons, ctx.theirIds, { blockers: blockersFor(ctx.cx, core, ctx.theirIds) }), 'A');
}
/**
 * Coverage items in order: each detected plan target (covered by a listed answer in your 6: solid when one is an anchor),
 * each seed target (Cores answer status not "none"), then each look-first mon (hit hard by a non-Mega form or walled:
 * solid; Mega-only hit: outline). Each: {key, kind: 'plan'|'seed'|'mon', target, mon, covered: 'solid'|'outline'|null, by}.
 */
export function coverage(ctx, targets, six) {
  const items = [];
  for (const t of targets) {
    if (t.coreId) {
      const by = t.counted.filter((c) => six.includes(c.mon));
      items.push({ key: t.key, kind: 'plan', target: t, mon: null, covered: by.length ? (by.some((c) => c.anchor) ? 'solid' : 'outline') : null, by: uniq(by.map((c) => c.mon)) });
    } else if (SEED_OF(t)) {
      if (t.seed === LOOK_FIRST) continue;
      const st = seedStatus(ctx, t.seed, six);
      items.push({ key: t.key, kind: 'seed', target: t, mon: null, covered: st.key === 'none' ? null : st.anchors.length ? 'solid' : 'outline', by: uniq(st.counted.map((c) => c.mon)) });
    }
  }
  for (const id of ctx.b.key ?? []) {
    const hits = six.map((m) => [m, ctx.R.hitsHard(m, id)]).filter(([, h]) => h);
    const wallers = six.filter((m) => ctx.R.walls(m, id));
    const solid = hits.some(([, h]) => !h.mega) || wallers.length > 0;
    items.push({ key: `mon:${id}`, kind: 'mon', target: null, mon: id, covered: solid ? 'solid' : hits.length ? 'outline' : null, by: uniq([...hits.map(([m]) => m), ...wallers]),
      hitBy: hits.map(([m, h]) => ({ mon: m, mult: h.mult, mega: h.mega })), wallBy: wallers });
  }
  return items;
}
/** How strongly one of your mons answers a coverage item: 4 anchor listed answer, 3 listed, 2 non-Mega hit or wall, 1 Mega-only hit, 0.5 a ×2 type below the attacker line, 0. */
function strength(ctx, item, m) {
  if (item.kind === 'plan') {
    const e = item.target.counted.filter((c) => c.mon === m);
    if (e.some((c) => c.anchor)) return 4;
    if (e.length) return 3;
  } else if (item.kind === 'seed') {
    const st = seedStatus(ctx, item.target.seed, [m]);
    if (st.anchors.includes(m)) return 4;
    if (st.counted.some((c) => c.mon === m)) return 3;
  }
  const focus = item.kind === 'mon' ? [item.mon] : item.target.focus;
  let best = 0;
  for (const t of focus) {
    const h = ctx.R.hitsHard(m, t);
    if ((h && !h.mega) || ctx.R.walls(m, t)) return 2;
    if (h) best = Math.max(best, 1);
    else if (ctx.R.sp(m).forms.some((f) => ctx.R.stabHits(f, ctx.R.baseForm(t)).length)) best = Math.max(best, 0.5);
  }
  return best;
}
/**
 * "Fill a gap": for one uncovered item (the first one, or gapKey), the candidates from the rest of your pool in order:
 * strength, then how many other open items each also helps, then the briefing's order of your mons, then roster order.
 * Only candidates of strength >= 1 are offered; the 0.5 tier ("weaker attacker by stats") only when nothing reaches 1.
 * With a full 6, `freeToSwap` lists members whose removal changes no item's coverage (not even solid to weaker). Never changes anything: the user taps Add.
 * -> {gap: item|null, candidates: [{id, strength, also}], fallback: boolean, freeToSwap: [id]}
 */
export function fillGap(ctx, targets, six, { gapKey = null } = {}) {
  const items = coverage(ctx, targets, six);
  const open = items.filter((i) => !i.covered);
  const gap = (gapKey && items.find((i) => i.key === gapKey)) || open[0] || null;
  if (!gap) return { gap: null, candidates: [], fallback: false, freeToSwap: [] };
  const pool = ctx.roster.filter((m) => !six.includes(m));
  const scored = pool.map((m) => ({ id: m, strength: strength(ctx, gap, m), also: open.filter((i) => i.key !== gap.key && strength(ctx, i, m) >= 1).length }));
  const order = (x, y) => y.strength - x.strength || y.also - x.also || (ctx.myRank.get(x.id) ?? 99) - (ctx.myRank.get(y.id) ?? 99) || ctx.roster.indexOf(x.id) - ctx.roster.indexOf(y.id);
  let candidates = scored.filter((c) => c.strength >= 1).sort(order);
  let fallback = false;
  if (!candidates.length) { candidates = scored.filter((c) => c.strength === 0.5).sort(order); fallback = candidates.length > 0; }
  // free to swap = every item's coverage is exactly the same without it (a listed anchor answer dropping to a weaker one counts as a loss)
  const sig = (list) => coverage(ctx, targets, list).map((i) => `${i.key}=${i.covered ?? ''}`).join('|');
  const base = sig(six);
  const freeToSwap = six.length >= 6 ? six.filter((m) => sig(six.filter((x) => x !== m)) === base) : [];
  return { gap, candidates, fallback, freeToSwap };
}

// ---------- lead and back pairs inside your 6 ----------
const pairsOf = (list) => { const out = []; for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) out.push([list[i], list[j]]); return out; };
const cmpDesc = (x, y) => { for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return y[i] - x[i]; return 0; };
/**
 * The evidence for one pair against one target (glyph rows; every item is a known-layer fact or a listed answer):
 * {answers: [{mon, label, anchor, class, contestedBy, partial}], hits: [{mon, t, mult, mega}], walls: [{mon, t}],
 *  shared: [t] (a focus attacker hits both hard), speed: [{mon, t, result}], needsTwoMegas, headline}
 */
export function pairEvidence(ctx, pair, target) {
  const { R } = ctx;
  const tells = target.tells.length ? target.tells : target.focus;
  const answers = target.counted.filter((c) => pair.includes(c.mon)).map((c) => ({ mon: c.mon, label: c.label, anchor: !!c.anchor, class: c.class, contestedBy: c.contestedBy ?? null }));
  const hits = [], walls = [], speed = [];
  for (const m of pair) for (const t of target.focus) {
    const h = R.hitsHard(m, t);
    if (h) hits.push({ mon: m, t, mult: h.mult, mega: h.mega, formName: h.form });
    if (R.walls(m, t)) walls.push({ mon: m, t });
  }
  for (const m of pair) for (const t of tells) speed.push({ mon: m, t, result: ctx.speedVs(m, t, target.speedMode) });
  const shared = target.focus.filter((t) => pair.every((m) => R.exposedTo(m, t)));
  const megaOnly = (m) => { const hs = hits.filter((h) => h.mon === m); return hs.length > 0 && hs.every((h) => h.mega); };
  const needsTwoMegas = pair.every(megaOnly);
  const tellHit = hits.some((h) => tells.includes(h.t) && !h.mega);
  const headline = answers.some((a) => a.anchor) ? 'has' : answers.length ? 'weaker' : tellHit ? 'pressures' : walls.length && !hits.length ? 'walls' : 'none';
  return { answers, hits, walls, shared, speed, needsTwoMegas, headline };
}
/** Ranking key [A1, A2, P1, R1−X1, P2, S1, −M2] for a pair (VGC §5.3). */
function leadKey(ctx, pair, target, ev) {
  const tells = target.tells.length ? target.tells : target.focus;
  const A1 = pair.filter((m) => ev.answers.some((a) => a.mon === m && a.anchor)).length;
  const A2 = pair.filter((m) => ev.answers.some((a) => a.mon === m)).length;
  const P1 = tells.filter((t) => ev.hits.some((h) => h.t === t && !h.mega)).length;
  const attacking = (t) => ctx.R.attackingForms(t).length > 0;
  const R1 = target.focus.filter((t) => attacking(t) && ev.walls.some((w) => w.t === t)).length;
  const X1 = ev.shared.length;
  const P2 = target.focus.filter((t) => ev.hits.some((h) => h.t === t)).length;
  const S1 = ev.speed.filter((s) => s.result === 'first').length;
  return [A1, A2, P1, R1 - X1, P2, S1, ev.needsTwoMegas ? -1 : 0];
}
/**
 * Every lead pair inside your 6 for one target, best first: [{pair, key, evidence}]. Ties: smaller sum of positions in the
 * 6, then species ids. Show the top 2 as ideas to try; the key's numbers are never shown (the glyph rows are).
 */
export function rankLeadPairs(ctx, six, target) {
  return pairsOf(six).map((pair) => { const evidence = pairEvidence(ctx, pair, target); return { pair, key: leadKey(ctx, pair, target, evidence), evidence }; })
    .sort((x, y) => cmpDesc(x.key, y.key) || (six.indexOf(x.pair[0]) + six.indexOf(x.pair[1])) - (six.indexOf(y.pair[0]) + six.indexOf(y.pair[1])) || x.pair.join().localeCompare(y.pair.join()));
}
/**
 * Back pairs once a lead is chosen (VGC §5.4): the rest of your 6, ranked by [B1 open items handled, B2 other plans with a
 * listed answer, B3 −shared exposure, B4 brings the Mega option the lead lacks]. -> {open: [ids], pairs: [{pair, key}]}
 */
export function rankBackPairs(ctx, six, lead, target, targets) {
  const { R } = ctx;
  const rest = six.filter((m) => !lead.includes(m));
  const all = uniq([...target.focus, ...(ctx.b.key ?? [])]);
  const open = all.filter((t) => !lead.some((m) => R.hitsHard(m, t) || R.walls(m, t)));
  const hasMega = (m) => ctx.dex.species[m]?.forms.some((f) => f.mega);
  const others = targets.filter((t) => t.key !== target.key);
  const pairs = pairsOf(rest).map((pair) => {
    const B1 = open.filter((t) => pair.some((m) => R.hitsHard(m, t) || R.walls(m, t))).length;
    const B2 = others.filter((t) => t.counted.some((c) => pair.includes(c.mon))).length;
    const B3 = 0 - all.filter((t) => R.attackingForms(t).length && pair.every((m) => R.exposedTo(m, t))).length;
    const B4 = !lead.some(hasMega) && pair.some(hasMega) ? 1 : 0;
    return { pair, key: [B1, B2, B3, B4] };
  }).sort((x, y) => cmpDesc(x.key, y.key) || (rest.indexOf(x.pair[0]) + rest.indexOf(x.pair[1])) - (rest.indexOf(y.pair[0]) + rest.indexOf(y.pair[1])) || x.pair.join().localeCompare(y.pair.join()));
  return { open, pairs };
}

// Leaf evaluation for the search engine. Two kinds of features of a position, from one side's point of view:
//   parts: the heuristic value's terms (ai/engine.mjs valueParts: material own / opp, Trick Room, Tailwind, screens, sun,
//          next turn's threat), computed on the position read into the heuristic's snapshot;
//   ps:    features read straight from the Showdown battle (all "mine − theirs" or signed for me).
// Without learned weights the leaf is the heuristic value itself. With weights (fit-value.mjs: logistic regression of
// the game result on the features at every decision of the engine's own games) the leaf is the fitted logit
// log(p / (1 − p)) of winning; the action costs the heuristic charges (Protect, switches, switch-ins) are kept, scaled into
// logit units.
import { readFileSync, existsSync } from 'node:fs';

export const LEARNED_PARTS = ['own', 'opp', 'trickRoom', 'tailwind', 'screens', 'sun', 'threat'];
export const ACTION_PARTS = ['protects', 'protectsFoe', 'switchIns', 'megaOut', 'switches'];
export const FEATURES = ['alive', 'hp', 'activeHp', 'status', 'boosts', 'tailwind', 'screens', 'speedEdge', 'trickRoom', 'weather', 'mega', 'items'];

const foeOf = (s) => (s === 'p1' ? 'p2' : 'p1');
const up = (p) => p && !p.fainted && p.hp > 0;
const WEATHER_SETTER = { sunnyday: ['drought', 'desolateland'], raindance: ['drizzle', 'primordialsea'], sandstorm: ['sandstream'], snowscape: ['snowwarning'] };

function sideStats(s) {
  const alive = s.pokemon.filter(up);
  const act = s.active.filter(up);
  const sc = s.sideConditions;
  return {
    alive: alive.length,
    hp: alive.reduce((t, p) => t + p.hp / p.maxhp, 0),
    activeHp: act.reduce((t, p) => t + p.hp / p.maxhp, 0),
    status: alive.filter((p) => p.status && p.status !== '').length,
    boosts: act.reduce((t, p) => t + Math.max(-2, Math.min(2, (Math.max(p.boosts.atk, p.boosts.spa) + p.boosts.spe) / 2)), 0),
    tailwind: sc.tailwind ? (sc.tailwind.duration ?? 0) : 0,
    screens: ['reflect', 'lightscreen', 'auroraveil'].reduce((t, k) => t + (sc[k] ? (sc[k].duration ?? 0) : 0), 0),
    mega: s.pokemon.some((p) => up(p) && (p.canMegaEvo || p.species.isMega)) ? 1 : 0, // a Mega still to come, or on the field
    items: alive.filter((p) => p.item).length, // berries, Sash, boosting items left
    weatherSetter: (w) => alive.some((p) => (WEATHER_SETTER[w] ?? []).includes(p.baseAbility)),
  };
}
const speedOf = (p) => { try { return p.getActionSpeed(); } catch { return p.storedStats?.spe ?? 0; } };

/** Showdown-side features of battle `b` for side `me` (FEATURES order). */
export function features(b, me) {
  const A = b.getSide(me), B = b.getSide(foeOf(me));
  const a = sideStats(A), o = sideStats(B);
  const tr = b.field.pseudoWeather.trickroom ? (b.field.pseudoWeather.trickroom.duration ?? 0) : 0;
  let edge = 0;
  for (const x of A.active.filter(up)) for (const y of B.active.filter(up)) { const d = speedOf(x) - speedOf(y); if (d) edge += Math.sign(d); }
  const avg = (s) => { const xs = s.active.filter(up).map(speedOf); return xs.length ? xs.reduce((t, x) => t + x, 0) / xs.length : 0; };
  const trSigned = tr ? tr * Math.sign(avg(B) - avg(A)) : 0; // turns left, signed by who it helps
  const w = b.field.weather, wTurns = w ? (b.field.weatherState?.duration ?? 0) : 0;
  const weather = w ? wTurns * ((a.weatherSetter(w) ? 1 : 0) - (o.weatherSetter(w) ? 1 : 0)) : 0;
  return [a.alive - o.alive, a.hp - o.hp, a.activeHp - o.activeHp, a.status - o.status, a.boosts - o.boosts, a.tailwind - o.tailwind,
    a.screens - o.screens, edge, trSigned, weather, a.mega - o.mega, a.items - o.items];
}

/** Learned weights ({ bias, parts: {k: w}, ps: {k: w}, actionScale }) from a fit-value.mjs file, or null. */
export function loadWeights(file) {
  if (!file || !existsSync(file)) return null;
  const j = JSON.parse(readFileSync(file, 'utf8'));
  return { parts: LEARNED_PARTS.map((k) => j.parts[k] ?? 0), ps: FEATURES.map((k) => j.ps[k] ?? 0), actionScale: j.actionScale ?? 1 };
}

/** The learned leaf (a logit): parts (valueParts object) and ps (features array) of the position. */
export function learnedLeaf(W, parts, ps) {
  let z = 0;
  for (let i = 0; i < LEARNED_PARTS.length; i++) z += W.parts[i] * parts[LEARNED_PARTS[i]];
  for (let i = 0; i < FEATURES.length; i++) z += W.ps[i] * ps[i];
  for (const k of ACTION_PARTS) z += W.actionScale * parts[k];
  return z;
}

// The AI's model of one turn (doubles): legal options per active slot, an approximate turn resolver that applies both
// sides' choices in priority / Speed order (Trick Room, Tailwind, Protect, Wide Guard, redirection, Fake Out flinch,
// Instruct, Helping Hand, Intimidate, Sash / Sitrus, Stance Change, weather setters, Chilly Reception, pivots), and a
// value function. Damage comes from lib/calc (cached per state); the result is an expected state (HP and "alive"
// probabilities), not a sampled one.
import { normalizeScenario } from '../../../lib/calc/scenario.mjs';
import { calc, mech, moveOf, statsOf, abilityOf, typesOf, speciesOf, PROTECTS, SPREAD, SINGLE, toID } from './data.mjs';

const SIDES = ['p1', 'p2'];
export const foe = (s) => (s === 'p1' ? 'p2' : 'p1');

// ---------- snapshot ----------
/** An independent copy of what the tracker knows, for resolving hypothetical turns. */
export function snapshot(T) {
  const mons = {};
  for (const s of SIDES) for (const m of T.mons[s]) {
    mons[m.key] = { key: m.key, side: s, set: m.set, mega: m.mega, hp: m.fainted ? 0 : m.hp, alive: m.fainted ? 0 : 1, status: m.status, boosts: { ...m.boosts },
      form: m.form, itemGone: m.itemGone, firstTurn: m.pos >= 0 && T.firstTurn(m), lastMove: m.lastMove, protectStreak: m.protectStreak, movesUsed: [...m.movesUsed],
      locked: m.locked, taunt: m.taunt, seen: m.seen, brought: m.brought, pos: m.pos };
  }
  return { mons, active: { p1: T.active.p1.map((m) => (m && !m.fainted ? m.key : null)), p2: T.active.p2.map((m) => (m && !m.fainted ? m.key : null)) },
    side: structuredClone(T.side), field: { ...T.field }, turn: T.turn };
}
const clone = (S) => ({ mons: Object.fromEntries(Object.entries(S.mons).map(([k, m]) => [k, { ...m, boosts: { ...m.boosts } }])), active: { p1: [...S.active.p1], p2: [...S.active.p2] },
  side: { p1: { ...S.side.p1 }, p2: { ...S.side.p2 } }, field: { ...S.field }, turn: S.turn });

// ---------- damage (lib/calc, cached) ----------
const dmgCache = new Map();
export const calcStats = { calls: 0, hits: 0 };
const bucket = (hp) => (hp > 0.5 ? 100 : hp > 1 / 3 ? 50 : Math.max(1, Math.round(hp * 100)));
/** Damage of one hit as fractions of the defender's max HP: { min, max } (0 when immune / no damage). */
export function damage(S, a, d, moveId, { spread = false, hh = false } = {}) {
  const mv = moveOf(moveId);
  const att = { ...a, form: a.set.species === 'aegislash' && mv.category !== 'Status' ? 'blade' : a.form };
  const ds = S.side[d.side];
  const key = `${a.key}|${att.mega}|${JSON.stringify(att.boosts)}|${att.status}|${att.form}|${att.itemGone}|${bucket(a.hp)}|${d.key}|${d.mega}|${JSON.stringify(d.boosts)}|${d.form}|${d.itemGone}|${d.status}|${bucket(d.hp)}|${moveId}|${S.field.weather}|${S.field.terrain}|${ds.reflect > 0}|${ds.lightScreen > 0}|${ds.auroraVeil > 0}|${spread}|${hh}`;
  calcStats.calls++;
  if (dmgCache.has(key)) { calcStats.hits++; return dmgCache.get(key); }
  const state = (m) => ({ mega: m.mega, boosts: m.boosts, status: ['brn', 'par', 'psn', 'tox', 'slp', 'frz'].includes(m.status) ? m.status : '', hpPct: bucket(m.hp), itemConsumed: m.itemGone, form: m.form ?? '' });
  const sc = { attacker: { set: a.set, state: state(att) }, defender: { set: d.set, state: state(d) }, move: { id: moveId },
    field: { weather: S.field.weather, terrain: S.field.terrain, attackerSide: { helpingHand: hh, allyPresent: spread }, defenderSide: { reflect: ds.reflect > 0, lightScreen: ds.lightScreen > 0, auroraVeil: ds.auroraVeil > 0, partnerPresent: spread } } };
  let r = calc.run(normalizeScenario(sc));
  if (r.class === 'needs-state' && r.question?.key) { sc[r.question.side].state[r.question.key] = r.question.options?.[0] ?? 0; r = calc.run(normalizeScenario(sc)); }
  const out = r.class === 'exact' ? { min: r.range.min / r.maxHP, max: r.range.max / r.maxHP } : { min: 0, max: 0, refused: r.class !== 'no-damage' ? r.code ?? r.class : null };
  if (dmgCache.size > 200000) dmgCache.clear();
  dmgCache.set(key, out);
  return out;
}

// ---------- speed and order ----------
export function speed(S, m) {
  let s = statsOf(m.set, m.mega).spe;
  const b = m.boosts.spe ?? 0;
  s = Math.floor(s * (b >= 0 ? (2 + b) / 2 : 2 / (2 - b)));
  if (m.status === 'par') s = Math.floor(s / 2);
  if (m.set.item === 'choicescarf' && !m.itemGone) s = Math.floor(s * 1.5);
  if (S.side[m.side].tailwind > 0) s *= 2;
  const ab = abilityOf(m.set, m.mega);
  if ((ab === 'chlorophyll' && S.field.weather === 'Sun') || (ab === 'swiftswim' && S.field.weather === 'Rain') || (ab === 'sandrush' && S.field.weather === 'Sand') || (ab === 'slushrush' && S.field.weather === 'Snow')) s *= 2;
  return s;
}
export function priorityOf(m, moveId) {
  const mv = moveOf(moveId);
  let p = mv.priority;
  const ab = abilityOf(m.set, m.mega);
  if (ab === 'prankster' && mv.category === 'Status') p += 1;
  if (ab === 'galewings' && mv.type === 'Flying' && m.hp >= 1) p += 1;
  if (ab === 'triage' && mv.flags?.heal) p += 3;
  if (moveId === 'grassyglide') p += 0; // terrain-dependent; rare here
  return p;
}

// ---------- options ----------
const isGhost = (m) => typesOf(m.set, m.mega).includes('Ghost');
const PRIORITY_BLOCK = new Set(['queenlymajesty', 'dazzling', 'armortail']);
const NO_FLINCH = new Set(['innerfocus', 'shielddust']);
/**
 * Options for one active slot from what's known: moves (with targets), switches to bench members. `legal` (our own
 * request) restricts moves / switches exactly; for the opponent, the tracker's knowledge applies the same rules.
 * Behaviour filters (VGC Strategy's list): Fake Out only on the first turn and never into Ghosts (unless Scrappy), Inner
 * Focus, a priority-blocking side or Psychic Terrain; no Protect / Wide Guard twice in a row; never re-set your own Trick
 * Room; no Tailwind under Trick Room; Last Resort only after the other moves; Choice lock respected.
 */
export function optionsFor(S, side, pos, legal = null) {
  const key = S.active[side][pos];
  if (!key) return [{ kind: 'pass', side, pos }];
  const m = S.mons[key];
  const out = [];
  const foes = S.active[foe(side)].map((k, i) => (k ? i : -1)).filter((i) => i >= 0);
  const ally = S.active[side][1 - pos];
  const moves = legal ? legal.moves.filter((x) => !x.disabled).map((x) => toID(x.id ?? x.move)) : m.set.moves;
  // Mega Evolve on the first turn it can (ours: the request says; theirs: a stone holder while none of theirs is Mega)
  const mega = legal ? !!legal.canMegaEvo : !m.mega && !!mech.items[m.set.item]?.megaStone && !m.itemGone && !Object.values(S.mons).some((x) => x.side === side && x.mega);
  for (const id of moves) {
    const mv = moveOf(id);
    if (!mv.exists) continue;
    if (!legal && m.locked && m.locked !== id && moves.includes(m.locked)) continue;
    if (!legal && m.taunt > 0 && mv.category === 'Status') continue;
    if (id === 'fakeout' || id === 'firstimpression') { if (!m.firstTurn) continue; }
    if (id === 'lastresort' && m.set.moves.some((x) => x !== 'lastresort' && !m.movesUsed.includes(x))) continue;
    // a charge move outside its weather wastes a turn (the resolver doesn't model the charge): only in sun or with Power Herb
    if (['solarbeam', 'solarblade'].includes(id) && S.field.weather !== 'Sun' && !(m.set.item === 'powerherb' && !m.itemGone) && !(mega && abilityOf(m.set, true) === 'drought')) continue;
    if ((PROTECTS.has(id) || id === 'wideguard' || id === 'quickguard') && m.protectStreak > 0) continue;
    if (id === 'trickroom' && S.field.tr > 0 && S.field.trBy === side) continue;
    if (id === 'tailwind' && (S.field.tr > 0 || S.side[side].tailwind > 0)) continue;
    if (id === 'wideguard' && !S.active[foe(side)].some((k) => k && S.mons[k].set.moves.some((x) => SPREAD.has(moveOf(x).target) && moveOf(x).category !== 'Status'))) continue;
    if (['followme', 'ragepowder', 'helpinghand', 'instruct', 'allyswitch'].includes(id) && !ally) continue;
    // partner-only uses of 'normal'-target moves (Instruct: repeat the partner's move)
    if (id === 'instruct') { if (ally) out.push({ kind: 'move', side, pos, move: id, target: 'ally', mega }); continue; }
    if (SINGLE.has(mv.target) && mv.category !== 'Status' || ['normal', 'any', 'adjacentFoe'].includes(mv.target)) {
      for (const t of foes) {
        const d = S.mons[S.active[foe(side)][t]];
        if (id === 'fakeout' && (NO_FLINCH.has(abilityOf(d.set, d.mega)) || (isGhost(d) && abilityOf(m.set, m.mega) !== 'scrappy') || S.active[foe(side)].some((k) => k && PRIORITY_BLOCK.has(abilityOf(S.mons[k].set, S.mons[k].mega))) || (S.field.terrain === 'Psychic' && !typesOf(d.set, d.mega).includes('Flying')))) continue;
        out.push({ kind: 'move', side, pos, move: id, target: t, mega });
      }
    } else if (mv.target === 'adjacentAlly' || mv.target === 'adjacentAllyOrSelf') {
      if (ally) out.push({ kind: 'move', side, pos, move: id, target: 'ally', mega });
      else if (mv.target === 'adjacentAllyOrSelf') out.push({ kind: 'move', side, pos, move: id, target: 'self', mega });
    } else out.push({ kind: 'move', side, pos, move: id, target: null, mega });
  }
  // every move filtered out (Kangaskhan with only Fake Out / Last Resort after a switch): Showdown still needs a move
  if (!out.length && moves.length) { const id = moves[0], t = ['normal', 'any', 'adjacentFoe'].includes(moveOf(id).target) ? foes[0] ?? 0 : null; out.push({ kind: 'move', side, pos, move: id, target: t, mega }); }
  const bench = legal ? legal.switches : Object.values(S.mons).filter((x) => x.side === side && x.alive > 0 && !S.active[side].includes(x.key) && (x.brought || side === legal?.side)).map((x) => x.key);
  if (!legal?.trapped) for (const k of bench) out.push({ kind: 'switch', side, pos, to: k });
  return out.length ? out : [{ kind: 'pass', side, pos }];
}

// ---------- resolve one turn ----------
const SETTERS = { drought: 'Sun', drizzle: 'Rain', sandstream: 'Sand', snowwarning: 'Snow', orichalcumpulse: 'Sun' };
const INTIM_BLOCK = new Set(['clearbody', 'innerfocus', 'oblivious', 'owntempo', 'scrappy', 'hypercutter', 'whitesmoke', 'fullmetalbody', 'mirrorarmor', 'guarddog']);
function enter(S, side, pos, key) {
  const old = S.active[side][pos];
  if (old) { const o = S.mons[old]; o.boosts = {}; o.pos = -1; if (o.set.species === 'aegislash') o.form = 'shield'; }
  S.active[side][pos] = key;
  const m = S.mons[key];
  m.pos = pos; m.brought = true;
  const ab = abilityOf(m.set, m.mega);
  if (ab === 'intimidate') for (const k of S.active[foe(side)]) {
    if (!k) continue;
    const t = S.mons[k], tab = abilityOf(t.set, t.mega);
    if (INTIM_BLOCK.has(tab)) continue;
    t.boosts.atk = Math.max(-6, (t.boosts.atk ?? 0) - 1);
    if (tab === 'defiant') t.boosts.atk = Math.min(6, t.boosts.atk + 3);
    if (tab === 'competitive') t.boosts.spa = Math.min(6, (t.boosts.spa ?? 0) + 2);
  }
  if (SETTERS[ab]) { S.field.weather = SETTERS[ab]; S.field.weatherTurns = 5; }
}
const accOf = (mv, a) => (mv.accuracy === true ? 1 : (mv.accuracy / 100) * (abilityOf(a.set, a.mega) === 'compoundeyes' ? 1.3 : 1));
/** Probability that `amount` (min..max uniform) is at least `hp`. */
const pAtLeast = (min, max, hp) => (min >= hp ? 1 : max < hp ? 0 : max === min ? 1 : (max - hp) / (max - min));

/**
 * One turn, both sides' actions at once: returns the expected next state plus `log` (what happened, for reasoning).
 * acts: [{ kind: 'move'|'switch'|'pass', side, pos, move, target (foe pos | 'ally' | 'self' | null), to, mega }]
 */
export function resolve(S0, acts) {
  const S = clone(S0);
  const log = [];
  const turnFx = { protect: {}, wideGuard: { p1: 0, p2: 0 }, redirect: { p1: null, p2: null }, rp: { p1: false, p2: false }, hh: {}, flinch: {}, moved: {}, act: {} };
  // Mega Evolution happens before anyone moves (and its Speed counts this turn)
  for (const a of acts) if (a.kind === 'move' && a.mega) {
    const m = S.mons[S.active[a.side][a.pos]];
    if (!m || m.mega || !mech.items[m.set.item]?.megaStone) continue;
    m.mega = true;
    const w = SETTERS[abilityOf(m.set, true)];
    if (w) { S.field.weather = w; S.field.weatherTurns = 5; } // Mega Charizard Y's Drought on evolving
  }
  const actor = (a) => S.mons[a.kind === 'switch' || a.kind === 'move' ? S.active[a.side][a.pos] : null];
  const order = acts.filter((a) => a.kind !== 'pass').map((a) => {
    const m = actor(a);
    return { a, key: m?.key, pri: a.kind === 'switch' ? 7 : priorityOf(m, a.move), spe: m ? speed(S, m) : 0 };
  }).filter((x) => x.key);
  const tr = S.field.tr > 0;
  order.sort((x, y) => y.pri - x.pri || (tr && x.pri < 7 ? x.spe - y.spe : y.spe - x.spe) || (x.a.side === 'p1' ? -1 : 1));
  for (const { a, key } of order) {
    const m = S.mons[key];
    const act = (m.alive ?? 0) * (1 - (turnFx.flinch[key] ?? 0));
    if (act <= 0.001) continue;
    if (a.kind === 'switch') { S.switches ??= { p1: 0, p2: 0 }; S.switches[a.side]++; enter(S, a.side, a.pos, a.to); m.movesUsed = []; m.protectStreak = 0; log.push(`${name(m)} → ${name(S.mons[a.to])}`); continue; }
    if (S.active[a.side][a.pos] !== key) continue;
    turnFx.moved[key] = true; turnFx.act[key] = act;
    useMove(S, m, a, act, turnFx, log, acts);
  }
  // end of turn: Sitrus already applied on hit; weather / field countdowns are the tracker's job (next turn)
  if (S.field.tr > 0 && turnFx.trToggled !== 'set') S.field.tr = Math.max(0, S.field.tr - 1);
  S.log = log;
  return S;
}
const name = (m) => m.set.name ?? m.set.species;
function targetsOf(S, m, a) {
  const mv = moveOf(a.move);
  const fs = foe(m.side);
  if (SPREAD.has(mv.target)) {
    const ts = S.active[fs].filter(Boolean);
    if (mv.target === 'allAdjacent' && S.active[m.side][1 - a.pos]) ts.push(S.active[m.side][1 - a.pos]);
    return { list: ts, spread: ts.length > 1 };
  }
  if (a.target === 'ally') return { list: [S.active[m.side][1 - a.pos]].filter(Boolean), spread: false };
  if (a.target === 'self' || a.target === null) return { list: [], spread: false };
  let t = S.active[fs][a.target] ?? S.active[fs][1 - a.target];
  return { list: t ? [t] : [], spread: false };
}
function useMove(S, m, a, act, fx, log, acts) {
  const mv = moveOf(a.move);
  const id = mv.id;
  m.lastMove = id;
  if (!m.movesUsed.includes(id)) m.movesUsed.push(id);
  if (/^choice/.test(m.set.item) && !m.itemGone) m.locked = id;
  const isProt = PROTECTS.has(id);
  m.protectStreak = isProt || id === 'wideguard' ? m.protectStreak + 1 : 0;
  if (m.set.species === 'aegislash') m.form = mv.category === 'Status' ? (id === 'kingsshield' ? 'shield' : m.form) : 'blade';
  if (isProt) { fx.protect[m.key] = act * (m.protectStreak > 1 ? 1 / 3 : 1); S.protects ??= { p1: 0, p2: 0 }; S.protects[m.side] += act; log.push(`${name(m)} protects`); return; }
  if (id === 'wideguard') { fx.wideGuard[m.side] = Math.max(fx.wideGuard[m.side], act); log.push(`${name(m)} Wide Guard`); return; }
  if (id === 'followme' || id === 'ragepowder') { fx.redirect[m.side] = m.key; fx.rp[m.side] = id === 'ragepowder'; log.push(`${name(m)} redirects`); return; }
  if (id === 'helpinghand') { const al = S.active[m.side][1 - a.pos]; if (al) fx.hh[al] = act; return; }
  if (id === 'trickroom') { if (S.field.tr > 0) { S.field.tr = 0; S.field.trBy = null; fx.trToggled = 'unset'; } else { S.field.tr = 5; S.field.trBy = m.side; fx.trToggled = 'set'; } log.push(`${name(m)} Trick Room ${fx.trToggled}`); return; }
  if (mv.sideCondition === 'tailwind') { S.side[m.side].tailwind = 4; log.push(`${name(m)} Tailwind`); return; }
  if (['reflect', 'lightscreen', 'auroraveil'].includes(mv.sideCondition)) { if (mv.sideCondition !== 'auroraveil' || S.field.weather === 'Snow') S.side[m.side][mv.sideCondition === 'lightscreen' ? 'lightScreen' : mv.sideCondition === 'auroraveil' ? 'auroraVeil' : 'reflect'] = 5; return; }
  if (mv.weather) { const w = { SunnyDay: 'Sun', RainDance: 'Rain', Sandstorm: 'Sand', snowscape: 'Snow', Snowscape: 'Snow' }[mv.weather] ?? ''; if (w) { S.field.weather = w; S.field.weatherTurns = 5; } }
  if (id === 'chillyreception') {
    S.field.weather = 'Snow'; S.field.weatherTurns = 5;
    const bench = Object.values(S.mons).find((x) => x.side === m.side && x.alive > 0 && !S.active[m.side].includes(x.key) && x.brought);
    if (bench) enter(S, m.side, a.pos, bench.key);
    log.push(`${name(m)} Chilly Reception`); return;
  }
  if (id === 'instruct') {
    const al = S.active[m.side][1 - a.pos];
    const prev = al && fx.moved[al] && acts.find((x) => x.kind === 'move' && S.active[x.side][x.pos] === al);
    if (prev && moveOf(prev.move).category !== 'Status') { log.push(`${name(m)} Instructs ${name(S.mons[al])}`); useMove(S, S.mons[al], prev, act * (fx.act[al] ?? 1), fx, log, acts); }
    return;
  }
  const { list, spread } = targetsOf(S, m, a);
  let targets = list;
  // redirection (single-target foe moves)
  const fs = foe(m.side);
  const red = fx.redirect[fs];
  if (red && !spread && targets.length === 1 && S.mons[targets[0]].side === fs && targets[0] !== red && S.mons[red].alive > 0) {
    const immune = fx.rp[fs] && (typesOf(m.set, m.mega).includes('Grass') || ['overcoat'].includes(abilityOf(m.set, m.mega)) || m.set.item === 'safetygoggles');
    const ignore = ['stalwart', 'propellertail'].includes(abilityOf(m.set, m.mega)) || id === 'snipeshot';
    if (!immune && !ignore) targets = [red];
  }
  const pri = priorityOf(m, id);
  const blockPri = pri > 0 && S.active[fs].some((k) => k && PRIORITY_BLOCK.has(abilityOf(S.mons[k].set, S.mons[k].mega)));
  if (mv.category === 'Status') { statusMove(S, m, mv, targets, act, fx, log); return; }
  let dealt = 0;
  for (const tk of targets) {
    const t = S.mons[tk];
    if (t.alive <= 0) continue;
    if (blockPri && t.side === fs) continue;
    let p = act * accOf(mv, m);
    p *= 1 - (fx.protect[tk] ?? 0);
    if (spread) p *= 1 - (fx.wideGuard[t.side] ?? 0);
    if (p <= 0) continue;
    const r = damage(S, m, t, id, { spread, hh: !!fx.hh[m.key] });
    if (r.max <= 0) continue;
    let min = r.min, max = r.max;
    const sash = t.set.item === 'focussash' && !t.itemGone && t.hp >= 0.999 && !mv.multihit;
    let pKO = pAtLeast(min, max, t.hp);
    if (sash && pKO > 0) { pKO = 0; t.itemGone = true; }
    const mean = Math.min(t.hp, (min + max) / 2);
    const before = t.hp;
    t.hp = Math.max(0, t.hp - mean * p) ;
    if (sash && t.hp <= 0) t.hp = 0.01;
    t.alive = Math.max(0, t.alive * (1 - pKO * p));
    if (t.alive < 0.02) { t.alive = 0; t.hp = 0; }
    if (t.set.item === 'sitrusberry' && !t.itemGone && t.hp > 0 && t.hp <= 0.5) { t.hp = Math.min(1, t.hp + 0.25); t.itemGone = true; }
    dealt += (before - t.hp);
    // Fake Out flinch: only if the target hasn't moved yet
    if (id === 'fakeout' && !fx.moved[tk] && !NO_FLINCH.has(abilityOf(t.set, t.mega))) fx.flinch[tk] = Math.min(1, (fx.flinch[tk] ?? 0) + p);
    // secondary stat drops / burns (expected)
    const sec = mv.secondary ?? (mv.secondaries?.[0] ?? null);
    if (sec?.boosts && t.alive > 0) for (const [k, v] of Object.entries(sec.boosts)) t.boosts[k] = Math.max(-6, Math.min(6, (t.boosts[k] ?? 0) + v * (sec.chance ?? 100) / 100 * p));
    if (sec?.status === 'brn' && !t.status && !typesOf(t.set, t.mega).includes('Fire')) t.statusP = (t.statusP ?? 0) + (sec.chance ?? 100) / 100 * p * 0.5;
    log.push(`${name(m)} ${mv.name} → ${name(t)} ${Math.round(min * 100)}–${Math.round(max * 100)}% (p ${p.toFixed(2)}, KO ${(pKO * p).toFixed(2)})`);
  }
  // user side effects
  if (dealt > 0 && m.set.item === 'lifeorb' && !m.itemGone && abilityOf(m.set, m.mega) !== 'magicguard' && abilityOf(m.set, m.mega) !== 'sheerforce') m.hp = Math.max(0, m.hp - 0.1 * act);
  if (mv.drain && dealt > 0) m.hp = Math.min(1, m.hp + dealt * mv.drain[0] / mv.drain[1] * 0.5);
  if (mv.recoil && dealt > 0) m.hp = Math.max(0, m.hp - dealt * mv.recoil[0] / mv.recoil[1] * 0.5);
  if (mv.self?.boosts) for (const [k, v] of Object.entries(mv.self.boosts)) m.boosts[k] = Math.max(-6, Math.min(6, (m.boosts[k] ?? 0) + v * act));
  if (mv.selfSwitch && m.alive > 0) {
    const bench = Object.values(S.mons).filter((x) => x.side === m.side && x.alive > 0 && !S.active[m.side].includes(x.key) && x.brought);
    if (bench.length) enter(S, m.side, a.pos, bench[0].key);
  }
}
function statusMove(S, m, mv, targets, act, fx, log) {
  for (const tk of targets) {
    const t = S.mons[tk];
    if (t.alive <= 0) continue;
    const p = act * accOf(mv, m) * (1 - (fx.protect[tk] ?? 0)) * (abilityOf(m.set, m.mega) === 'prankster' && typesOf(t.set, t.mega).includes('Dark') && t.side !== m.side ? 0 : 1);
    if (mv.status && !t.status) {
      const immune = (mv.status === 'brn' && typesOf(t.set, t.mega).includes('Fire')) || (mv.status === 'par' && typesOf(t.set, t.mega).includes('Electric')) || (mv.id === 'thunderwave' && typesOf(t.set, t.mega).includes('Ground'));
      if (!immune) t.statusP = Math.min(1, (t.statusP ?? 0) + p);
      t.statusKind = mv.status;
    }
    if (mv.boosts) for (const [k, v] of Object.entries(mv.boosts)) t.boosts[k] = Math.max(-6, Math.min(6, (t.boosts[k] ?? 0) + v * p));
    if (mv.volatileStatus === 'taunt') t.tauntP = p;
    if (mv.volatileStatus === 'encore' || mv.id === 'yawn') t.disruptP = p;
    log.push(`${name(m)} ${mv.name} → ${name(t)} (p ${p.toFixed(2)})`);
  }
  if (mv.heal && (mv.target === 'self' || !targets.length)) m.hp = Math.min(1, m.hp + (mv.heal[0] / mv.heal[1]) * act * (S.field.weather && mv.id === 'moonlight' ? (S.field.weather === 'Sun' ? 1.33 : 0.5) : 1));
  if (mv.boosts && (mv.target === 'self' || mv.target === 'adjacentAllyOrSelf')) for (const [k, v] of Object.entries(mv.boosts)) m.boosts[k] = Math.max(-6, Math.min(6, (m.boosts[k] ?? 0) + v * act));
  if (mv.self?.boosts) for (const [k, v] of Object.entries(mv.self.boosts)) m.boosts[k] = Math.max(-6, Math.min(6, (m.boosts[k] ?? 0) + v * act));
  if (mv.selfSwitch && m.alive > 0) {
    const bench = Object.values(S.mons).filter((x) => x.side === m.side && x.alive > 0 && !S.active[m.side].includes(x.key) && x.brought);
    if (bench.length) enter(S, m.side, S.active[m.side].indexOf(m.key), bench[0].key);
  }
}

// ---------- value ----------
export const STYLES = {
  balanced: { own: 1, opp: 1, field: 1 },
  aggressive: { own: 0.8, opp: 1.25, field: 0.8 },
  safe: { own: 1.25, opp: 0.9, field: 1 },
  setup: { own: 1, opp: 1, field: 2 },
};
const SUN_USERS = (m) => m.set.ability === 'drought' || m.set.ability === 'chlorophyll' || m.set.ability === 'solarpower' || m.set.moves.some((x) => ['weatherball', 'solarbeam', 'solarblade'].includes(x) || (moveOf(x).type === 'Fire' && moveOf(x).category !== 'Status')) || megaAbility(m) === 'drought';
const megaAbility = (m) => abilityOf(m.set, true);
/**
 * The position's value for `side`: Pokémon kept (HP and survival, unseen opposing ones counted whole) minus the
 * opponent's, plus field terms (speed control for the slower team, Tailwind, screens, sun for sun users, status, boosts).
 */
export function value(S, side, style = STYLES.balanced, brought = 4) {
  let v = 0;
  for (const s of SIDES) {
    const sign = s === side ? style.own : -style.opp;
    const ms = Object.values(S.mons).filter((m) => m.side === s && (m.brought || m.pos >= 0));
    let total = 0;
    for (const m of ms) {
      let w = m.alive * (0.35 + 0.65 * m.hp);
      const phys = statsOf(m.set, m.mega).atk >= statsOf(m.set, m.mega).spa;
      const st = m.status || (m.statusP > 0 ? m.statusKind : '');
      const sp = m.status ? 1 : m.statusP ?? 0;
      if (st === 'brn' && phys) w -= 0.25 * sp * m.alive;
      if (st === 'par') w -= 0.15 * sp * m.alive;
      if (st === 'slp') w -= 0.3 * sp * m.alive;
      if (m.pos >= 0) {
        const off = phys ? m.boosts.atk ?? 0 : m.boosts.spa ?? 0;
        w += m.alive * (0.07 * Math.max(-3, Math.min(3, off)) + 0.04 * Math.max(-2, Math.min(2, m.boosts.spe ?? 0)) + 0.03 * Math.max(-2, Math.min(2, (m.boosts.def ?? 0) + (m.boosts.spd ?? 0))));
        if (m.tauntP) w -= 0.05 * m.tauntP;
        if (m.disruptP) w -= 0.08 * m.disruptP;
      }
      total += w;
    }
    // unseen members of a 4 (opponent's back) count as healthy
    const unseen = Math.max(0, brought - ms.length);
    total += unseen;
    v += sign * total;
  }
  // field: Trick Room favours the slower side (by its live Pokémon's average Speed), Tailwind its side, screens their side
  // Trick Room: by how much of the field it flips in this side's favour (share of live pairings where this side is slower,
  // −1..1), per remaining turn
  const live = (s) => Object.values(S.mons).filter((m) => m.side === s && m.alive > 0 && (m.brought || m.pos >= 0));
  const f = style.field;
  if (S.field.tr > 0) v += f * trShare(S, live(side), live(foe(side))) * 0.15 * Math.min(4, S.field.tr);
  for (const s of SIDES) {
    const sign = s === side ? 1 : -1;
    v += f * sign * 0.08 * Math.min(3, S.side[s].tailwind) * (S.field.tr > 0 ? 0 : 1);
    v += f * sign * 0.04 * (Math.min(4, S.side[s].reflect) + Math.min(4, S.side[s].lightScreen) + Math.min(4, S.side[s].auroraVeil));
    if (S.field.weather === 'Sun') v += f * sign * 0.035 * Object.values(S.mons).filter((m) => m.side === s && m.alive > 0 && (m.brought || m.pos >= 0) && SUN_USERS(m)).length;
  }
  // next turn's initiative: what each side's actives threaten (expected damage, KO chances, who moves first), so a
  // turn that only delays (double Protect) isn't free and speed control pays now
  v += f * 0.35 * (threat(S, side) - threat(S, foe(side)));
  v -= 0.15 * (S.protects?.[side] ?? 0) * (style === STYLES.safe ? 0.5 : 1);
  v += 0.15 * (S.protects?.[foe(side)] ?? 0);
  // a switch gives up the turn's action (the new Pokémon's matchup is already in the value)
  v -= 0.06 * (S.switches?.[side] ?? 0);
  v += 0.06 * (S.switches?.[foe(side)] ?? 0);
  return v;
}
/**
 * How much Trick Room favours `mine` over `theirs` (−1..1): over every pairing, +1 where mine is slower, −1 where faster,
 * each pairing weighted by how hard the two hit each other (so a slow attacker outsped by their fast one counts, two
 * walls don't). Memoised per set of live Pokémon.
 */
const trMemo = new Map();
function trShare(S, mine, theirs) {
  const k = `${mine.map((m) => `${m.key}${m.mega ? 'M' : ''}`).join()}|${theirs.map((m) => `${m.key}${m.mega ? 'M' : ''}`).join()}`;
  if (trMemo.has(k)) return trMemo.get(k);
  const hit = (a, b) => Math.max(0, ...a.set.moves.filter((id) => moveOf(id).category !== 'Status' && id !== 'fakeout').map((id) => { const r = damage({ field: { weather: '', terrain: '' }, side: S.side }, { ...a, boosts: {}, hp: 1, status: '' }, { ...b, boosts: {}, hp: 1, status: '' }, id); return (r.min + r.max) / 2; }));
  let num = 0, den = 0;
  for (const a of mine) for (const b of theirs) {
    const sa = statsOf(a.set, a.mega).spe, sb = statsOf(b.set, b.mega).spe;
    const w = Math.min(1.2, hit(a, b)) + Math.min(1.2, hit(b, a));
    num += w * (sa < sb ? 1 : sa > sb ? -1 : 0); den += w;
  }
  const out = den ? num / den : 0;
  if (trMemo.size > 5000) trMemo.clear();
  trMemo.set(k, out);
  return out;
}
/** Σ over this side's actives of its best hit into a foe active next turn: damage (capped by HP) + half a KO, ×0.7 if slower. */
export function threat(S, side) {
  let t = 0;
  for (const k of S.active[side]) {
    if (!k) continue;
    const a = S.mons[k];
    if (a.alive <= 0) continue;
    let best = 0;
    for (const fk of S.active[foe(side)]) {
      if (!fk) continue;
      const d = S.mons[fk];
      if (d.alive <= 0) continue;
      const first = S.field.tr > 0 ? speed(S, a) < speed(S, d) : speed(S, a) > speed(S, d);
      for (const id of a.set.moves) {
        const mv = moveOf(id);
        if (mv.category === 'Status' || id === 'fakeout' || (id === 'lastresort' && a.set.moves.some((x) => x !== 'lastresort' && !a.movesUsed.includes(x)))) continue;
        const r = damage(S, a, d, id, { spread: SPREAD.has(mv.target) && S.active[foe(side)].filter(Boolean).length > 1 });
        const acc = mv.accuracy === true ? 1 : mv.accuracy / 100;
        const mean = Math.min(d.hp, (r.min + r.max) / 2);
        // a target that can Protect next turn (it didn't just) blunts the threat; one that just Protected can't
        const guard = d.set.moves.some((x) => PROTECTS.has(x)) && !(d.protectStreak > 0) ? 0.75 : 1;
        const sc = (mean + 0.5 * pAtLeast(r.min, r.max, d.hp)) * acc * (first ? 1 : 0.7) * d.alive * guard;
        if (sc > best) best = sc;
      }
    }
    t += best * a.alive;
  }
  return t;
}

// The search engine player ("Stockfish for VGC", tools/sim/engine/README.md). Each turn:
//   1. Candidates: the heuristic player's turn model (ai/player.mjs solve) proposes our best joint actions and the
//      opponent's likely replies, so the search spends its budget on plausible lines.
//   2. Forward model: the live Showdown battle is cloned and determinized from our point of view (his unrevealed bench
//      resampled from his six; his unrevealed sets, spreads and items replaced by our beliefs; dice re-seeded; nothing
//      he has chosen this turn is visible). Every (ours × theirs) pair is played for real in Showdown, several times.
//   3. Leaf: each resulting position is scored: by the heuristic's value function (material, field, next turn's threat
//      both ways), or, with --weights, by the value learned from the engine's own games (value.mjs, fit-value.mjs).
//   4. The payoff matrix is solved as a simultaneous-move game (regret matching) and we play the equilibrium mix.
// Team preview and forced replacements use the heuristic player (preview tables are fitted separately).
import { HeuristicPlayer, solveGame } from '../ai/player.mjs';
import { PS, toID } from '../ai/data.mjs';
import { snapshot, optionsFor, foe, value as heurValue, valueParts } from '../ai/engine.mjs';
import { PROTECTS } from '../ai/data.mjs';
import { features, loadWeights, learnedLeaf, LEARNED_PARTS } from './value.mjs';

const WEATHER = { sunnyday: 'Sun', desolateland: 'Sun', raindance: 'Rain', primordialsea: 'Rain', sandstorm: 'Sand', snowscape: 'Snow', snow: 'Snow', hail: 'Snow' };
const TERRAIN = { electricterrain: 'Electric', grassyterrain: 'Grassy', psychicterrain: 'Psychic', mistyterrain: 'Misty' };
const WIN = 6; // a won / lost game: in the heuristic value's units a full side is ~4-5; as a learned logit, p ~ 0.998

export const ENGINE_DEFAULTS = { samples: 3, maxOurs: 10, maxTheirs: 10, weights: null, wide: false, depth: 1, top2: 3, samples2: 1, width2: 4, dice: 'random' };

/**
 * "Most likely" dice for a clone: the average damage roll, and every chance event (accuracy, crits, secondary effects,
 * Protect streaks) resolved to its likelier outcome. Speed ties stay random. One such simulation stands for the expected
 * outcome the way the heuristic's model does, with Showdown's exact mechanics.
 */
function meanDice(b) {
  b.randomizer = function (baseDamage) { const tr = this.trunc; return tr(tr(baseDamage * 92.5) / 100); };
  b.randomChance = function (numerator, denominator) { return this.forceRandomChance ?? numerator * 2 >= denominator; };
}

export class EnginePlayer extends HeuristicPlayer {
  /** opts: HeuristicPlayer's, plus { battle: () => live PS Battle, samples, maxOurs, maxTheirs, weights (file), record } */
  constructor(stream, opts) {
    super(stream, { ...opts, noise: opts.noise ?? 0, skill: 1 });
    this.e = { ...ENGINE_DEFAULTS, ...Object.fromEntries(Object.entries(opts).filter(([k]) => k in ENGINE_DEFAULTS && opts[k] != null)) };
    this.getBattle = opts.battle;
    this.w = loadWeights(this.e.weights);
    this.belief = PS.Teams.import(opts.theirs); // what we believe his six are (sheets.mjs)
    this.record = opts.record ? [] : null; // [{ parts, ps }] at each of our decisions, for value learning
    this.stats = { decisions: 0, cells: 0, ms: 0, fallbacks: 0 };
  }

  turn(request) {
    const live = this.getBattle?.();
    if (!live) return super.turn(request);
    const t0 = performance.now();
    const T = this.T, me = this.me, them = foe(me);
    const S = snapshot(T);
    const L = this.legalOf(request);
    const ours = request.active.map((act, pos) => {
      const p = request.side.pokemon[pos];
      if (!S.active[me][pos] || p.condition.endsWith(' fnt') || p.commanding) return [{ kind: 'pass', side: me, pos }];
      return optionsFor(S, me, pos, { moves: act.moves, canMegaEvo: act.canMegaEvo, trapped: act.trapped || act.maybeTrapped, switches: L.switches.map((x) => x.key), side: me });
    });
    while (ours.length < 2) ours.push([{ kind: 'pass', side: me, pos: ours.length }]);
    const theirs = [0, 1].map((pos) => optionsFor(S, them, pos));
    if (T.field.trBy === me) this.setTR = true;
    const sol = this.solve(S, me, ours, theirs);
    if (this.record) {
      const R = this.snapshotOf(live, S);
      const parts = valueParts(R, me);
      this.record.push({ turn: T.turn, parts: LEARNED_PARTS.map((k) => +parts[k].toFixed(4)), ps: features(live, me).map((x) => +x.toFixed(4)) });
    }
    // a plan persona (ZhuZi's team habits) still overrides, as for the heuristic player
    const plan = this.planMove(S, ours, sol);
    if (plan) return plan.pick.j.map((a, pos) => this.choiceOf(request, L, a, pos)).join(', ');

    const A = sol.final.slice(0, this.e.maxOurs).map((x) => x.j);
    // wide: also every legal option of each slot beside the best plan's other slot, so a line the heuristic
    // under-rates still gets played out in Showdown
    if (this.e.wide) {
      const seen = new Set(A.map((j) => JSON.stringify(j)));
      const top = A[0];
      for (const pos of [0, 1]) for (const o of ours[pos]) {
        const j = pos === 0 ? [o, top[1]] : [top[0], o];
        if (j[0].kind === 'switch' && j[1].kind === 'switch' && j[0].to === j[1].to) continue;
        if (j[0].mega && j[1].mega) j[1] = { ...j[1], mega: false };
        const k = JSON.stringify(j);
        if (!seen.has(k)) { seen.add(k); A.push(j); }
      }
    }
    const B = sol.qs.slice(0, this.e.maxTheirs).map((x) => x.j);
    // determinized starting positions (one per sample), each played against every cell with the same dice seed
    // (common random numbers: the cells of one sample differ by the choices, not by luck)
    const bases = [];
    for (let d = 0; d < this.e.samples; d++) bases.push(this.determinize(live));
    const M = A.map(() => B.map(() => 0));
    for (let d = 0; d < bases.length; d++) {
      for (let i = 0; i < A.length; i++) for (let k = 0; k < B.length; k++) {
        M[i][k] += this.playCell(bases[d], S, A[i], B[k], [this.seedBase, T.turn, d, 0]) / bases.length;
        this.stats.cells++;
      }
    }
    let { p, q } = solveGame(M);
    // depth 2 on the main lines: our top rows × his top columns are re-scored by a second simulated turn (both sides'
    // best candidates there, solved as its own small game), and the choice is re-solved among those rows
    if (this.e.depth >= 2) {
      const top = (w) => [...w.keys()].sort((a, b) => w[b] - w[a]).filter((x, n) => n === 0 || w[x] > 0.01).slice(0, this.e.top2);
      const R = top(p), Cc = top(q);
      const ns = Math.min(bases.length, this.e.samples2);
      const M2 = R.map((i) => Cc.map((k) => {
        let v = 0;
        for (let d = 0; d < ns; d++) v += this.deepCell(bases[d], S, A[i], B[k], [this.seedBase, T.turn, d, 1]) / ns;
        return v;
      }));
      const s2 = solveGame(M2);
      p = A.map(() => 0); R.forEach((i, n) => { p[i] = s2.p[n]; });
      q = B.map(() => 0); Cc.forEach((k, n) => { q[k] = s2.q[n]; });
      this.stats.deep = (this.stats.deep ?? 0) + R.length * Cc.length * ns;
    }
    // play the equilibrium mix (tiny probabilities pruned)
    const keep = p.map((x) => (x < 0.02 ? 0 : x)); const tot = keep.reduce((t, x) => t + x, 0) || 1;
    let u = this.r() * tot, pick = 0;
    for (let i = 0; i < keep.length; i++) { u -= keep[i]; if (u <= 0) { pick = i; break; } }
    this.stats.decisions++; this.stats.ms += performance.now() - t0;
    if (this.o.notes) this.note({ turn: T.turn, engine: { ours: A.map((j, i) => ({ j: j.map((a) => this.describe(S, a)).join(' + '), p: +p[i].toFixed(3), ev: +(M[i].reduce((t, x, k) => t + x * q[k], 0)).toFixed(3) })),
      theirs: B.map((j, k) => ({ j: j.map((a) => this.describe(S, a)).join(' + '), q: +q[k].toFixed(3) })), chose: A[pick].map((a) => this.describe(S, a)).join(' + ') } });
    return A[pick].map((a, pos) => this.choiceOf(request, L, a, pos)).join(', ');
  }

  get seedBase() { return this._seed ??= Math.floor(this.r() * 2 ** 31); }
  /** Whether sample d uses the most-likely dice (--dice mean: all; mixed: the first sample). */
  meanDiceFor(d) { return this.e.dice === 'mean' || (this.e.dice === 'mixed' && d === 0); }

  /** The live battle as we may know it: a clone with his hidden information replaced by our beliefs (JSON). */
  determinize(live) {
    const b = PS.Battle.fromJSON(JSON.stringify(live.toJSON()));
    for (const s of b.sides) s.clearChoice();
    const side = b.getSide(foe(this.me));
    const base = (p) => toID(p.baseSpecies.baseSpecies);
    const lib = new Map(this.belief.map((s) => [toID(PS.Dex.species.get(s.species).baseSpecies), s]));
    const revealed = (p) => p.isActive || p.previouslySwitchedIn > 0 || p.fainted;
    // 1. his unrevealed bench: any of the six he hasn't shown yet
    const shown = new Set(side.pokemon.filter(revealed).map(base));
    const pool = [...lib.keys()].filter((k) => !shown.has(k));
    side.pokemon.forEach((p, i) => {
      if (revealed(p) || !pool.length) return;
      const k = pool.splice(Math.floor(this.r() * pool.length), 1)[0];
      const set = structuredClone(lib.get(k));
      const np = new p.constructor(set, side);
      np.position = p.position;
      side.pokemon[i] = np;
      side.team[side.team.indexOf(p.set)] = set; // (de)serialization finds each Pokémon through its set in side.team
    });
    // 2. revealed Pokémon: beliefs for what he hasn't shown (moves not yet used, spread, nature, item, ability)
    for (const p of side.pokemon) {
      if (!revealed(p) || p.fainted) continue;
      const bs = lib.get(base(p));
      if (!bs || this.o.sheets === 'open') continue;
      if (!p.transformed) {
        const used = p.baseMoveSlots.filter((m) => m.used);
        const ids = new Set(used.map((m) => m.id));
        const fill = bs.moves.map((m) => b.dex.moves.get(m)).filter((m) => m.exists && !ids.has(m.id));
        const slots = [...used];
        for (const m of fill) { if (slots.length >= 4) break; const pp = b.calculatePP(m, 3); slots.push({ move: m.name, id: m.id, pp, maxpp: pp, target: m.target, disabled: false, disabledSource: '', used: false }); }
        if (slots.length) { p.baseMoveSlots = slots; p.moveSlots = slots.slice(); p.set.moves = slots.map((m) => m.move); }
      }
      const stone = (id) => !!b.dex.items.get(id).megaStone;
      if (p.item && !stone(p.item) && !p.volatiles.choicelock && toID(bs.item) && !stone(toID(bs.item))) { p.item = toID(bs.item); p.set.item = bs.item; p.itemState = b.initEffectState({ id: p.item, target: p }); }
      if (p.ability === p.baseAbility && !p.species.isMega && toID(bs.ability)) { p.baseAbility = p.ability = toID(bs.ability); p.set.ability = bs.ability; p.abilityState = b.initEffectState({ id: p.ability, target: p }); }
      p.set.evs = { ...bs.evs }; p.set.nature = bs.nature;
      const st = b.spreadModify(p.species.baseStats, p.set);
      const frac = p.hp / p.maxhp;
      p.baseMaxhp = p.maxhp = st.hp; p.hp = p.hp > 0 ? Math.max(1, Math.round(frac * st.hp)) : 0;
      p.baseStoredStats = st; for (const k of Object.keys(p.storedStats)) p.storedStats[k] = st[k]; p.speed = p.storedStats.spe;
    }
    return JSON.stringify(b.toJSON());
  }

  /** One cell: our joint vs theirs, played once in Showdown from a determinized position; the leaf value for us. */
  playCell(json, S0, ours, theirs, seed) {
    const b = PS.Battle.fromJSON(json);
    b.prng = new PS.PRNG(seed.map((x) => (x >>> 0) % 65536));
    if (this.meanDiceFor(seed[2])) meanDice(b);
    const me = this.me, them = foe(me);
    const actsBefore = { [me]: b.getSide(me).active.map((p) => p && toID(p.baseSpecies.baseSpecies)), [them]: b.getSide(them).active.map((p) => p && toID(p.baseSpecies.baseSpecies)) };
    const ok1 = b.choose(me, this.cloneChoice(b, me, ours)) || b.choose(me, 'default');
    const ok2 = b.choose(them, this.cloneChoice(b, them, theirs)) || b.choose(them, 'default');
    if (!ok1 || !ok2) this.stats.fallbacks++;
    return this.leaf(b, S0, { [me]: ours, [them]: theirs }, actsBefore);
  }

  /**
   * Depth 2: play the cell's turn, take forced replacements by Showdown's default, then treat the next turn as its own
   * small game: the heuristic's best few joints for both sides there (cheap settings), each pair played in Showdown and
   * scored at the leaf; the value is that game's equilibrium value.
   */
  deepCell(json, S0, ours, theirs, seed) {
    const me = this.me, them = foe(me);
    const b = PS.Battle.fromJSON(json);
    b.prng = new PS.PRNG(seed.map((x) => (x >>> 0) % 65536));
    if (this.meanDiceFor(seed[2])) meanDice(b);
    const actsBefore = {};
    if (!(b.choose(me, this.cloneChoice(b, me, ours)) || b.choose(me, 'default'))) this.stats.fallbacks++;
    if (!(b.choose(them, this.cloneChoice(b, them, theirs)) || b.choose(them, 'default'))) this.stats.fallbacks++;
    for (let n = 0; n < 3 && !b.ended; n++) {
      const pending = b.sides.filter((sd) => sd.activeRequest?.forceSwitch);
      if (!pending.length) break;
      for (const sd of pending) b.choose(sd.id, 'default');
    }
    if (b.ended) return this.leaf(b, S0, { [me]: ours, [them]: theirs }, actsBefore);
    try {
      const S1 = this.snapshotOf(b, S0);
      const optsOf = (sideId) => [0, 1].map((pos) => {
        const k = S1.active[sideId][pos];
        if (!k) return [{ kind: 'pass', side: sideId, pos }];
        if (sideId !== me) return optionsFor(S1, sideId, pos);
        const act = b.getSide(me).activeRequest?.active?.[pos];
        const bench = Object.values(S1.mons).filter((m) => m.side === me && m.brought && m.alive > 0 && m.pos < 0).map((m) => m.key);
        return optionsFor(S1, me, pos, act ? { moves: act.moves, canMegaEvo: act.canMegaEvo, trapped: act.trapped || act.maybeTrapped, switches: bench, side: me } : null);
      });
      const o1 = optsOf(me), t1 = optsOf(them);
      if (o1.some((x) => !x.length) || t1.some((x) => !x.length)) return this.leaf(b, S0, { [me]: ours, [them]: theirs }, actsBefore);
      const sol = this.solve(S1, me, o1, t1, { topM: 3, topN: this.e.width2, topK: 2, iters: 1 });
      const A1 = sol.final.slice(0, this.e.width2).map((x) => x.j), B1 = sol.qs.slice(0, this.e.width2).map((x) => x.j);
      const json1 = JSON.stringify(b.toJSON());
      const M1 = A1.map((a) => B1.map((c) => this.playCell(json1, S1, a, c, [seed[0], seed[1] + 1, seed[2], 2])));
      const { p, q } = solveGame(M1);
      return M1.reduce((t, row, i) => t + p[i] * row.reduce((u, x, k) => u + x * q[k], 0), 0);
    } catch {
      return this.leaf(b, S0, { [me]: ours, [them]: theirs }, actsBefore);
    }
  }

  /**
   * The leaf: Showdown's resulting position, read into the heuristic's snapshot format and scored by its value function
   * (material, field, and next turn's threat both ways), with the same costs it puts on Protect, switching and switch-ins.
   */
  leaf(b, S0, joints, actsBefore) {
    const me = this.me;
    if (b.ended) return !b.winner ? 0 : (b.getSide(me).name === b.winner ? WIN : -WIN);
    const S = this.snapshotOf(b, S0);
    S.protects = {}; S.switches = {}; S.switchIns = [];
    for (const side of [me, foe(me)]) {
      S.protects[side] = joints[side].filter((a) => a.kind === 'move' && PROTECTS.has(a.move)).length;
      S.switches[side] = joints[side].filter((a) => a.kind === 'switch').length;
      for (const a of joints[side]) if (a.kind === 'switch' && S.mons[a.to]) S.switchIns.push({ key: a.to, side, faced: S.active[foe(side)].filter(Boolean) });
    }
    if (this.w) return learnedLeaf(this.w, valueParts(S, me), features(b, me));
    return heurValue(S, me, this.style);
  }

  /** A Showdown battle as the heuristic's snapshot (keys and sets from the tracker's snapshot S0). */
  snapshotOf(b, S0) {
    const S = { mons: {}, active: { p1: [null, null], p2: [null, null] }, side: {}, field: {}, turn: b.turn };
    const base = (p) => toID(p.baseSpecies.baseSpecies);
    for (const sideId of ['p1', 'p2']) {
      const side = b.getSide(sideId);
      const byBase = new Map(side.pokemon.map((p) => [base(p), p]));
      for (const m0 of Object.values(S0.mons).filter((m) => m.side === sideId)) {
        const p = byBase.get(toID(PS.Dex.species.get(m0.set.species).baseSpecies));
        if (!p) { S.mons[m0.key] = { ...m0, boosts: { ...m0.boosts }, brought: false, pos: -1 }; continue; }
        const pos = p.isActive ? side.active.indexOf(p) : -1;
        S.mons[m0.key] = { ...m0, mega: !!p.species.isMega, hp: p.hp / p.maxhp, alive: p.hp > 0 && !p.fainted ? 1 : 0, status: p.status || '',
          boosts: { ...p.boosts }, form: p.species.id === 'aegislashblade' ? 'blade' : m0.set.species === 'aegislash' ? 'shield' : m0.form, itemGone: !p.item,
          brought: true, pos, protectStreak: p.volatiles.stall ? 1 : 0, movesUsed: p.baseMoveSlots.filter((x) => x.used).map((x) => x.id), firstTurn: false, invuln: false, charging: '' };
        if (pos >= 0 && S.mons[m0.key].alive) S.active[sideId][pos] = m0.key;
      }
      const sc = side.sideConditions, dur = (k) => (sc[k] ? (sc[k].duration ?? 0) : 0);
      S.side[sideId] = { ...S0.side[sideId], tailwind: dur('tailwind'), reflect: dur('reflect'), lightScreen: dur('lightscreen'), auroraVeil: dur('auroraveil') };
    }
    const tr = b.field.pseudoWeather.trickroom;
    S.field = { ...S0.field, weather: WEATHER[b.field.weather] ?? '', terrain: TERRAIN[b.field.terrain] ?? '', tr: tr ? (tr.duration ?? 0) : 0 };
    return S;
  }

  /** A joint action (heuristic-player format) as a choice string for `sideId` in the clone `b`. */
  cloneChoice(b, sideId, j) {
    const side = b.getSide(sideId);
    const used = new Set();
    return j.map((a, pos) => {
      const p = side.active[pos];
      if (!p || p.fainted || a.kind === 'pass') return 'pass';
      if (a.kind === 'switch') {
        const want = this.T.mons[sideId][Number(String(a.to).split(':')[1])]?.set.species;
        const bench = side.pokemon.map((x, i) => ({ x, i })).filter(({ x, i }) => !x.isActive && !x.fainted && !used.has(i) && i >= side.active.length);
        const hit = bench.find(({ x }) => toID(x.baseSpecies.baseSpecies) === toID(PS.Dex.species.get(want ?? '').baseSpecies)) ?? bench[0];
        if (!hit) return 'pass';
        used.add(hit.i);
        return `switch ${hit.i + 1}`;
      }
      let n = p.moveSlots.findIndex((m) => m.id === a.move);
      if (n < 0) n = p.moveSlots.findIndex((m) => !m.disabled);
      let s = `move ${n + 1}`;
      if (typeof a.target === 'number') s += ` ${a.target + 1}`;
      else if (a.target === 'ally') s += ` -${(1 - pos) + 1}`;
      else if (a.target === 'self') s += ` -${pos + 1}`;
      if (a.mega && p.canMegaEvo) s += ' mega';
      return s;
    }).join(', ');
  }
}

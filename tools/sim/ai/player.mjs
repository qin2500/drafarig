// The heuristic player (tools/sim/NOTES.md "Step 2"): a Showdown BattlePlayer that reads the protocol into a Tracker,
// scores options with the turn model in engine.mjs (lib/calc damage), looks one ply ahead against the opponent's top
// replies, and picks with skill / temperature / noise. Deterministic per seed. Open team sheets: it knows both teams' sets.
import { BattlePlayer, setsFromText, toID, statsOf, abilityOf, moveOf, typesOf, mech, PROTECTS, SPREAD } from './data.mjs';
import { Tracker } from './tracker.mjs';
import guide5v3 from '../../../lib/guides/5v3.mjs';

// the guide's preview table (Anthony vs ZhuZi), for --preview guide
const GUIDE_PREVIEWS = guide5v3.previews ?? [];
import { snapshot, optionsFor, resolve, value, damage, STYLES, foe, speed, pAtLeast } from './engine.mjs';


/** mulberry32: a small seeded PRNG (deterministic per game seed). */
export function rng(seed) {
  let a = (Array.isArray(seed) ? seed.reduce((h, x) => Math.imul(h ^ x, 2654435761) >>> 0, 0x9e3779b9) : seed) >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const softmaxPick = (items, score, temp, r) => {
  if (temp <= 0) return items[0];
  const top = Math.max(...items.map(score));
  const w = items.map((x) => Math.exp((score(x) - top) / temp));
  let u = r() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < items.length; i++) { u -= w[i]; if (u <= 0) return items[i]; }
  return items.at(-1);
};
/** Zero-sum matrix game (rows: us, maximizing): average strategies of regret matching+ after `iters` rounds. */
export function solveGame(M, iters = 400) {
  const n = M.length, m = M[0].length;
  const rR = new Array(n).fill(0), rC = new Array(m).fill(0), sR = new Array(n).fill(0), sC = new Array(m).fill(0);
  const norm = (r) => { const t = r.reduce((a, b) => a + Math.max(0, b), 0); return t > 0 ? r.map((x) => Math.max(0, x) / t) : r.map(() => 1 / r.length); };
  for (let it = 1; it <= iters; it++) {
    const p = norm(rR), q = norm(rC);
    const u = M.map((row) => row.reduce((t, x, k) => t + x * q[k], 0));
    const v = u.reduce((t, x, i) => t + x * p[i], 0);
    const w = Array.from({ length: m }, (_, k) => M.reduce((t, row, i) => t + row[k] * p[i], 0));
    for (let i = 0; i < n; i++) { rR[i] = Math.max(0, rR[i] + u[i] - v); sR[i] += p[i] * it; }
    for (let k = 0; k < m; k++) { rC[k] = Math.max(0, rC[k] + v - w[k]); sC[k] += q[k] * it; }
  }
  const tot = (a) => a.reduce((x, y) => x + y, 0);
  return { p: sR.map((x) => x / tot(sR)), q: sC.map((x) => x / tot(sC)) };
}
const sampleBy = (items, w, r) => { let u = r() * items.reduce((t, x) => t + w(x), 0); for (const x of items) { u -= w(x); if (u <= 0) return x; } return items[0]; };
export const DEFAULTS = { preview: 'ai', persona: null, skill: 0.85, temperature: 0.04, noise: 0.07, style: 'balanced', topM: 4, topN: 8, topK: 3, usualBring: 0, previewTemp: 0.05 };

export class HeuristicPlayer extends BattlePlayer {
  /** opts: { mine: text, theirs: text, seed, skill, temperature, noise, style, usualBring, notes: bool } */
  constructor(stream, opts) {
    super(stream, false);
    this.o = { ...DEFAULTS, ...opts };
    this.style = STYLES[this.o.style] ?? STYLES.balanced;
    this.mine = setsFromText(opts.mine);
    this.theirs = setsFromText(opts.theirs);
    this.r = rng(opts.seed ?? 1);
    this.notes = [];
    this.T = null;
    this.me = null;
  }
  receiveLine(line) {
    if (this.T && line.startsWith('|') && !line.startsWith('|request|')) this.T.line(line);
    super.receiveLine(line);
  }
  receiveError(e) {
    this.crashes = (this.crashes ?? 0) + 1;
    this.note({ turn: this.T?.turn, error: e.message });
    // an unavailable choice gets a fresh request; an invalid one would wait forever, so take Showdown's default
    if (String(e.message).startsWith('[Unavailable choice]')) return;
    if (String(e.message).startsWith('[Invalid choice]')) { this.choose('default'); return; }
    throw e;
  }
  note(x) { if (this.o.notes) this.notes.push(x); }
  ensure(request) {
    if (this.T) return;
    this.me = request.side.id;
    this.T = new Tracker(this.me === 'p1' ? { p1: this.mine, p2: this.theirs } : { p1: this.theirs, p2: this.mine });
    // replay what was already logged (team preview lines) into the tracker
    for (const l of this.log) this.T.line(l);
  }
  receiveRequest(request) {
    this.ensure(request);
    this.request = request;
    if (request.wait) return;
    let choice;
    try {
      if (request.teamPreview) choice = this.preview(request);
      else if (request.forceSwitch) choice = this.forceSwitch(request);
      else if (request.active) choice = this.turn(request);
    } catch (e) {
      this.crashes = (this.crashes ?? 0) + 1;
      this.note({ turn: this.T.turn, crash: String(e.stack ?? e).slice(0, 400) });
      choice = 'default';
    }
    if (choice) this.choose(choice);
  }

  // ---------- team preview: bring 4 and the 2 leads ----------
  pairHit(a, b) {
    const S = { field: { weather: '', terrain: '' }, side: { p1: { reflect: 0, lightScreen: 0, auroraVeil: 0 }, p2: { reflect: 0, lightScreen: 0, auroraVeil: 0 } } };
    const A = { key: `pv:${a.species}`, side: 'p1', set: a, mega: !!mech.items[a.item]?.megaStone, hp: 1, status: '', boosts: {}, form: a.species === 'aegislash' ? 'blade' : '', itemGone: false };
    const B = { key: `pv:${b.species}`, side: 'p2', set: b, mega: !!mech.items[b.item]?.megaStone, hp: 1, status: '', boosts: {}, form: b.species === 'aegislash' ? 'shield' : '', itemGone: false };
    let best = 0;
    for (const id of a.moves) { const mv = moveOf(id); if (mv.category === 'Status' || id === 'fakeout' || id === 'lastresort') continue; const d = damage(S, A, B, id); best = Math.max(best, (d.min + d.max) / 2 * (mv.accuracy === true ? 1 : mv.accuracy / 100)); }
    if (a.moves.includes('lastresort')) { const d = damage(S, A, B, 'lastresort'); best = Math.max(best, (d.min + d.max) / 2 * 0.8); }
    return Math.min(1.2, best);
  }
  /** 4-mon sets of `mine` scored against `opp`'s six: offence − 0.8 × defence + role bonuses. */
  fours(mine, opp) {
    const avgSpe = (ss) => ss.reduce((t, s) => t + statsOf(s, !!mech.items[s.item]?.megaStone).spe, 0) / ss.length;
    const out = [];
    const n = mine.length;
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) for (let d = c + 1; d < n; d++) {
      const ix = [a, b, c, d], ss = ix.map((i) => mine[i]);
      const off = opp.reduce((t, o) => t + Math.max(...ss.map((s) => this.pairHit(s, o))), 0) / opp.length;
      const def = ss.reduce((t, s) => t + Math.max(...opp.map((o) => this.pairHit(o, s))), 0) / ss.length;
      let bonus = 0;
      if (ss.some((s) => s.moves.includes('fakeout'))) bonus += 0.05;
      if (ss.some((s) => s.moves.includes('trickroom')) && avgSpe(ss) < avgSpe(opp)) bonus += 0.06;
      if (ss.some((s) => s.moves.includes('ragepowder') || s.moves.includes('followme'))) bonus += 0.03;
      if (ss.some((s) => s.ability === 'intimidate')) bonus += 0.03;
      if (ss.some((s) => mech.items[s.item]?.megaStone)) bonus += 0.05;
      if (ss.filter((s) => mech.items[s.item]?.megaStone).length > 1) bonus -= 0.05;
      out.push({ ix, score: off - 0.8 * def + bonus });
    }
    return out.sort((x, y) => y.score - x.score);
  }
  /** Quick lead-pair score (no battle state): offence into their six plus lead roles. */
  pairScore(pr, opp) {
    let sc = opp.reduce((t, o) => t + Math.max(...pr.map((s) => this.pairHit(s, o))), 0) / opp.length;
    if (pr.some((s) => s.moves.includes('fakeout'))) sc += 0.12;
    if (pr.some((s) => abilityOf(s, true) === 'drought')) sc += 0.08;
    if (pr.some((s) => s.ability === 'intimidate')) sc += 0.05;
    if (pr.some((s) => mech.items[s.item]?.megaStone)) sc += 0.05;
    if (pr.every((s) => s.moves.includes('fakeout'))) sc -= 0.05;
    return sc;
  }
  /**
   * The hard lead rule (ai-review.md #3): a lead that takes 4× from Rock (Mega Charizard Y) never goes in front of a visible
   * spread Rock move (Rock Slide) unless its partner has Wide Guard or Fake Out.
   */
  leadAllowed(pr, opp) {
    const rockUser = opp.some((o) => o.moves.some((id) => moveOf(id).type === 'Rock' && SPREAD.has(moveOf(id).target) && moveOf(id).category !== 'Status'));
    if (!rockUser) return true;
    return pr.every((s, i) => {
      const types = typesOf(s, !!mech.items[s.item]?.megaStone);
      const rock4x = types.filter((t) => ['Fire', 'Flying', 'Bug', 'Ice'].includes(t)).length >= 2;
      return !rock4x || pr[1 - i].moves.includes('wideguard') || pr[1 - i].moves.includes('fakeout');
    });
  }
  /** The battle at turn 1 with these leads (indices into the six), our other two in the back: a snapshot for solve(). */
  leadState(mine, ourLead, ourBack, theirs, theirLead) {
    const me = this.me, them = foe(me);
    const T = new Tracker(me === 'p1' ? { p1: mine, p2: theirs } : { p1: theirs, p2: mine });
    T.turn = 1;
    const put = (side, i, pos) => { const m = T.mons[side][i]; m.pos = pos; m.brought = m.seen = true; m.entered = 0; T.active[side][pos] = m; };
    ourLead.forEach((i, pos) => put(me, i, pos));
    theirLead.forEach((i, pos) => put(them, i, pos));
    for (const i of ourBack) T.mons[me][i].brought = true;
    return snapshot(T);
  }
  /** Turn-1 value of a lead pair: the solved turn-1 game against their likely leads (weighted). */
  leadValue(mine, ourLead, ourBack, theirs, theirLeads) {
    let v = 0;
    for (const { pair, w } of theirLeads) {
      const S = this.leadState(mine, ourLead, ourBack, theirs, pair);
      const ours = [0, 1].map((pos) => optionsFor(S, this.me, pos));
      const theirOpts = [0, 1].map((pos) => optionsFor(S, foe(this.me), pos));
      v += w * this.solve(S, this.me, ours, theirOpts, { topM: 3, topN: 4, topK: 2, iters: 1 }).value;
    }
    return v;
  }
  /** The guide's preview table (lib/guides/5v3.mjs `previews`): the first row whose species are all in their six. */
  guidePreview(mine, opp) {
    const base = (name) => { const n = String(name).trim(); const g = /^Galarian /i.test(n); const id = toID(n.replace(/^(Mega|Galarian) /i, '')); return g ? `${id}galar` : id; };
    const theirs = new Set(opp.map((s) => s.species));
    for (const row of GUIDE_PREVIEWS) {
      const need = row.if.replace(/^their 6 includes /i, '').split('+').map(base);
      if (!need.every((id) => theirs.has(id))) continue;
      const ix = row.bring4.map((id) => mine.findIndex((s) => s.species === id));
      const lead = row.lead.map((id) => mine.findIndex((s) => s.species === id));
      if (ix.some((i) => i < 0) || lead.some((i) => i < 0 || !ix.includes(i))) continue;
      return { ix, lead, why: `guide preview: ${row.if}` };
    }
    return null;
  }
  preview(request) {
    const mine = request.side.pokemon.map((p) => this.mine.find((s) => s.species === toID(p.details.split(',')[0])) ?? this.mine.find((s) => toID(p.ident.split(': ')[1]) === toID(s.name)));
    const opp = this.theirs;
    const P = this.o.persona;
    let pick = null;
    // policy: the guide's preview table (when it covers this six), else the AI's
    if (this.o.preview === 'guide') { const g = this.guidePreview(mine, opp); if (g) pick = g; }
    const fours = this.fours(mine, opp);
    const has = (i, move) => mine[i].moves.includes(move);
    if (!pick && this.o.usualBring > 0 && this.r() < this.o.usualBring) pick = { ix: [0, 1, 2, 3], lead: [0, 1], why: 'usual 4 (habit)' };
    // personas: TR leads its setter + its best abuser; rock leads its Rock Slide user
    if (!pick && P === 'tr') {
      const setter = mine.findIndex((s, i) => has(i, 'trickroom'));
      const abuser = mine.map((s, i) => ({ i, off: opp.reduce((t, o) => t + this.pairHit(s, o), 0) / opp.length, spe: statsOf(s, !!mech.items[s.item]?.megaStone).spe })).filter((x) => x.i !== setter).sort((a, b) => (a.spe < 100 ? 0 : 1) - (b.spe < 100 ? 0 : 1) || b.off - a.off)[0]?.i;
      const four = fours.find((f) => f.ix.includes(setter) && f.ix.includes(abuser));
      if (setter >= 0 && four) pick = { ix: four.ix, lead: [setter, abuser], why: 'persona tr: setter + abuser lead' };
    }
    if (!pick && P === 'rock') {
      const rock = mine.findIndex((s) => s.moves.includes('rockslide'));
      const four = fours.find((f) => f.ix.includes(rock));
      if (rock >= 0 && four) { const partner = four.ix.filter((i) => i !== rock).map((i) => ({ i, sc: this.pairScore([mine[rock], mine[i]], opp) })).sort((a, b) => b.sc - a.sc)[0].i; pick = { ix: four.ix, lead: [rock, partner], why: 'persona rock: Rock Slide user leads' }; }
    }
    let leadRank = [];
    if (!pick) {
      // the AI: the best few fours, each lead pair in them scored by its turn-1 outcome against their likely leads
      const theirPairs = [];
      for (let a = 0; a < opp.length; a++) for (let b = a + 1; b < opp.length; b++) theirPairs.push({ pair: [a, b], sc: this.pairScore([opp[a], opp[b]], mine) });
      theirPairs.sort((x, y) => y.sc - x.sc);
      const top2 = theirPairs.slice(0, 2), tw = top2.map((x) => Math.exp(x.sc / 0.05)), tws = tw.reduce((s, x) => s + x, 0);
      const theirLeads = top2.map((x, k) => ({ pair: x.pair, w: tw[k] / tws }));
      const cand = [];
      const seen = new Map();
      // persona chilly brings its Chilly Reception user (the lookahead picks the leads)
      const chillyUser = P === 'chilly' ? mine.findIndex((s) => s.moves.includes('chillyreception')) : -1;
      const pool = chillyUser >= 0 ? fours.filter((f) => f.ix.includes(chillyUser)) : fours;
      for (const f of pool.slice(0, 3)) {
        for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
          const lead = [f.ix[a], f.ix[b]], back = f.ix.filter((i) => !lead.includes(i));
          if (!this.leadAllowed(lead.map((i) => mine[i]), opp)) continue;
          const k = `${lead.join()}|${back.join()}`;
          if (!seen.has(k)) seen.set(k, this.leadValue(mine, lead, back, opp, theirLeads));
          cand.push({ ix: f.ix, lead, score: f.score + seen.get(k) });
        }
      }
      cand.sort((x, y) => y.score - x.score);
      leadRank = cand;
      if (cand.length) pick = this.r() < this.o.skill ? { ...cand[0], why: 'best lead (turn-1 lookahead)' } : { ...softmaxPick(cand, (x) => x.score, this.o.previewTemp, this.r), why: 'softmax' };
      else pick = { ix: fours[0].ix, lead: fours[0].ix.slice(0, 2), why: 'fallback' };
    }
    const order = [...pick.lead, ...pick.ix.filter((i) => !pick.lead.includes(i))].map((i) => i + 1);
    this.note({ preview: { bring: pick.ix.map((i) => mine[i].species), leads: pick.lead.map((i) => mine[i].species), why: pick.why,
      top: (leadRank.length ? leadRank : fours).slice(0, 3).map((x) => ({ four: x.ix.map((i) => mine[i].species), lead: x.lead?.map((i) => mine[i].species), score: +x.score.toFixed(3) })) } });
    return `team ${order.join('')}`;
  }

  // ---------- a move request ----------
  legalOf(request) {
    const side = request.side;
    const keyOf = (p) => { const m = this.T.mons[this.me].find((x) => x.set.species === toID(p.details.split(',')[0]) || toID(x.set.name) === toID(p.ident.split(': ')[1]) || (x.species === toID(p.details.split(',')[0]))); return m?.key; };
    for (const p of side.pokemon) { const k = keyOf(p); if (k) this.T.mons[this.me][Number(k.split(':')[1])].brought = true; }
    const switches = side.pokemon.map((p, i) => ({ p, i })).filter(({ p }) => !p.active && !p.condition.endsWith(' fnt')).map(({ p, i }) => ({ key: keyOf(p), slot: i + 1 })).filter((x) => x.key);
    return { side: this.me, switches, slotOf: new Map(switches.map((x) => [x.key, x.slot])) };
  }
  turn(request) {
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
    const { final, qs, joints } = sol;
    let pick, why;
    const plan = this.planMove(S, ours, sol);
    if (plan) { pick = plan.pick; why = plan.why; }
    else if (this.r() < this.o.noise) { pick = this.humanNoise(S, ours, final, joints); why = 'noise (human-like)'; }
    else if (this.r() < this.o.skill) { pick = sampleBy(final, (x) => x.p, this.r); why = 'equilibrium mix'; }
    else { pick = softmaxPick([...final].sort((a, b) => b.v - a.v), (x) => x.v, this.o.temperature, this.r); why = 'softmax'; }
    this.last = { final, expect: qs };
    if (this.o.notes) {
      const desc = (j) => j.map((a) => this.describe(S, a)).join(' + ');
      const sim = resolve(S, [...pick.j, ...qs[0].j]);
      this.note({ turn: T.turn, field: { weather: S.field.weather, terrain: S.field.terrain, tr: S.field.tr, tailwind: [S.side.p1.tailwind, S.side.p2.tailwind] },
        guess: sol.R0.map((r) => `${desc(r.j)} (w ${r.w.toFixed(2)})`), singles: sol.singles.map((l) => l.slice(0, 5).map((x) => `${this.describe(S, x.o)} ${x.v.toFixed(3)}`)),
        mix: final.filter((x) => x.p > 0.02).map((x) => `${desc(x.j)} (p ${x.p.toFixed(2)}, ev ${x.v.toFixed(3)})`), expect: qs.filter((x) => x.q > 0.02).map((x) => `${desc(x.j)} (q ${x.q.toFixed(2)})`),
        chose: `${desc(pick.j)} [${why}]`, model: sim.log });
    }
    return pick.j.map((a, pos) => this.choiceOf(request, L, a, pos)).join(', ');
  }

  /**
   * One turn as a simultaneous-move game for `me` (options per slot for both sides): their plausible plans, our top
   * options, both sides' candidate joints, solved by regret matching with double-oracle expansion. cfg trims it (preview).
   * Returns { final: [{ j, v (ev vs their mix), p (our mix) }], qs: [{ j, q }], value, R0, singles, joints, ev(j) }.
   */
  solve(S, me, ours, theirs, cfg = {}) {
    const them = foe(me);
    const topM = cfg.topM ?? this.o.topM, topN = cfg.topN ?? this.o.topN, topK = cfg.topK ?? this.o.topK, iters = cfg.iters ?? 4;
    const V = (acts, side) => value(resolve(S, acts), side, side === me ? this.style : STYLES.balanced);
    const pass = (side, pos) => ({ kind: 'pass', side, pos });
    // a spread move that also hits the partner (Earthquake, Boomburst, Discharge) only when the partner is immune or protects
    const hitsAlly = (x, y) => {
      if (x.kind !== 'move' || moveOf(x.move).target !== 'allAdjacent' || moveOf(x.move).category === 'Status') return false;
      const ak = S.active[x.side][x.pos], bk = S.active[x.side][1 - x.pos];
      if (!ak || !bk || (y.kind === 'move' && PROTECTS.has(y.move)) || y.kind === 'switch') return false;
      return damage(S, S.mons[ak], S.mons[bk], x.move, { spread: true }).max > 0;
    };
    // double Protect (both actives Protect / Wide Guard / King's Shield) only when both face a likely KO
    const koRisk = new Map();
    const facesKO = (k) => {
      if (!k) return false;
      if (!koRisk.has(k)) {
        const d = S.mons[k];
        let p = 0;
        for (const fk of S.active[foe(d.side)]) {
          if (!fk) continue;
          const a = S.mons[fk];
          for (const id of a.set.moves) { const mv = moveOf(id); if (mv.category === 'Status') continue; const r = damage(S, a, d, id, { spread: SPREAD.has(mv.target) }); p = Math.max(p, pAtLeast(r.min, r.max, d.hp)); }
        }
        koRisk.set(k, p);
      }
      return koRisk.get(k) >= 0.5;
    };
    const guards = (x) => x.kind === 'move' && (PROTECTS.has(x.move) || x.move === 'wideguard');
    const doubleProtect = (x, y) => guards(x) && guards(y) && !(facesKO(S.active[x.side][x.pos]) && facesKO(S.active[y.side][y.pos]));
    const joints = (a, b) => {
      const out = [];
      for (const x of a) for (const y of b) {
        if (x.kind === 'switch' && y.kind === 'switch' && x.to === y.to) continue;
        if (hitsAlly(x, y) || hitsAlly(y, x) || doubleProtect(x, y)) continue;
        out.push(x.mega && y.mega ? [x, { ...y, mega: false }] : [x, y]);
      }
      if (!out.length) for (const x of a) for (const y of b) if (!(x.kind === 'switch' && y.kind === 'switch' && x.to === y.to)) out.push(x.mega && y.mega ? [x, { ...y, mega: false }] : [x, y]);
      return out;
    };
    const mix = (plans, w) => { const top = Math.max(...plans.map((x) => x.v)); const e = plans.map((x) => Math.exp((x.v - top) / w)); const t = e.reduce((a, b) => a + b, 0); return plans.map((x, k) => ({ ...x, w: e[k] / t })); };
    // 1. their likely plays if we did nothing (a few distinct plans), weighted by how good each is for them
    const tSingles = theirs.map((opts, pos) => opts.map((o) => ({ o, v: V([o, pass(them, 1 - pos)], them) })).sort((a, b) => b.v - a.v).slice(0, topM).map((x) => x.o));
    const R0 = mix(joints(tSingles[0], tSingles[1]).map((j) => ({ j, v: V(j, them) })).sort((a, b) => b.v - a.v).slice(0, topK), 0.08);
    const guessT = R0[0].j;
    const vsR0 = (acts) => R0.reduce((t, r) => t + r.w * V([...acts, ...r.j], me), 0);
    // 2. our top options per slot (against that mix), then the joint ones
    const singles = ours.map((opts, pos) => opts.map((o) => ({ o, v: vsR0([o, pass(me, 1 - pos)]) })).sort((a, b) => b.v - a.v));
    const topOurs = singles.map((l) => l.slice(0, topM).map((x) => x.o));
    const ourJ = joints(topOurs[0], topOurs[1]).map((j) => ({ j, v: vsR0(j) })).sort((a, b) => b.v - a.v).slice(0, topN);
    // 3. their candidate plays: the plans above plus their best replies to our few best candidates
    const ourTop = ourJ.slice(0, 3).map((x) => x.j);
    const topTheirs = theirs.map((opts, pos) => opts.map((o) => ({ o, v: ourTop.reduce((t, oj) => t + V([...oj, o, guessT[1 - pos]], them), 0) })).sort((a, b) => b.v - a.v).slice(0, topM).map((x) => x.o));
    const key = (j) => JSON.stringify(j);
    const A = ourJ.map((x) => x.j), B = R0.map((r) => r.j);
    const seenA = new Set(A.map(key)), seenB = new Set(B.map(key));
    for (const r of joints(topTheirs[0], topTheirs[1]).map((j) => ({ j, v: ourTop.reduce((t, oj) => t + V([...oj, ...j], them), 0) })).sort((a, b) => b.v - a.v).slice(0, topN)) if (!seenB.has(key(r.j))) { seenB.add(key(r.j)); B.push(r.j); }
    // 4. double oracle: solve, add each side's best response to the other's mix, repeat until nothing new
    const cell = new Map();
    const Vc = (a, b) => { const k = `${key(a)}|${key(b)}`; if (!cell.has(k)) cell.set(k, V([...a, ...b], me)); return cell.get(k); };
    const bestResponse = (side, optsBySlot, others, w, top) => {
      const sideV = (j) => others.reduce((t, o, k) => (w[k] > 0.01 ? t + w[k] * (side === me ? Vc(j, o) : -Vc(o, j)) : t), 0);
      const sl = optsBySlot.map((opts, pos) => opts.map((o) => ({ o, v: sideV(pos === 0 ? [o, top[1]] : [top[0], o]) })).sort((a, b) => b.v - a.v).slice(0, topM).map((x) => x.o));
      return joints(sl[0], sl[1]).map((j) => ({ j, v: sideV(j) })).sort((a, b) => b.v - a.v)[0]?.j;
    };
    let p, q, M;
    for (let it = 0; it < iters; it++) {
      M = A.map((a) => B.map((b) => Vc(a, b)));
      ({ p, q } = solveGame(M));
      const topA = A[p.indexOf(Math.max(...p))], topB = B[q.indexOf(Math.max(...q))];
      const brA = bestResponse(me, ours, B, q, topA), brB = bestResponse(them, theirs, A, p, topB);
      let added = false;
      if (brA && !seenA.has(key(brA))) { seenA.add(key(brA)); A.push(brA); added = true; }
      if (brB && !seenB.has(key(brB))) { seenB.add(key(brB)); B.push(brB); added = true; }
      if (!added) break;
    }
    M = A.map((a) => B.map((b) => Vc(a, b)));
    ({ p, q } = solveGame(M));
    const evs = M.map((row) => row.reduce((t, x, k) => t + x * q[k], 0));
    const final = A.map((j, i) => ({ j, v: evs[i], p: p[i] })).sort((a, b) => b.p - a.p || b.v - a.v);
    const qs = B.map((j, k) => ({ j, q: q[k] })).sort((a, b) => b.q - a.q);
    const value0 = final.reduce((t, x) => t + x.p * x.v, 0);
    const ev = (j) => B.reduce((t, b, k) => (q[k] > 0.005 ? t + q[k] * Vc(j, b) : t), 0);
    return { final, qs, value: value0, R0, singles, joints, ev };
  }

  /**
   * Plan-commitment personas (VGC Strategy, ai-review.md): 'tr' sets Trick Room on the first turn its setter can (p 0.8)
   * and re-sets it after it ends (p 0.5), never on top of its own, partner Protecting or Faking Out; 'chilly' uses
   * Chilly Reception while the opponent's sun is up (p 0.8). Returns { pick, why } or null (play the normal policy).
   */
  planMove(S, ours, sol) {
    const P = this.o.persona;
    let move, prob;
    if (P === 'tr' && S.field.tr === 0) { move = 'trickroom'; prob = this.setTR ? 0.5 : 0.8; }
    if (P === 'chilly' && S.field.weather === 'Sun') { move = 'chillyreception'; prob = 0.8; }
    if (!move) return null;
    const pos = [0, 1].find((x) => ours[x].some((o) => o.kind === 'move' && o.move === move));
    if (pos === undefined || this.r() >= prob) return null;
    const mine = ours[pos].filter((o) => o.kind === 'move' && o.move === move);
    const support = ours[1 - pos].filter((o) => o.kind === 'pass' || (o.kind === 'move' && (PROTECTS.has(o.move) || o.move === 'fakeout')));
    const pool = support.length ? support : ours[1 - pos];
    const cands = [];
    for (const a of mine) for (const b of pool) cands.push(pos === 0 ? [a, b] : [b, a]);
    const best = cands.map((j) => ({ j, v: sol.ev(j) })).sort((x, y) => y.v - x.v)[0];
    if (!best) return null;
    if (move === 'trickroom') this.setTR = true;
    return { pick: best, why: `persona ${P}: ${move}` };
  }

  /**
   * Human-like noise: a plausible alternative, not a random action. The second-best joint, one slot swapped to Protect,
   * or one slot's target swapped; a switch only 2% of the time, and never the Mega holder before it Mega Evolves.
   */
  humanNoise(S, ours, final, joints) {
    const base = final[0].j;
    const options = [];
    if (final[1]) options.push(final[1].j);
    for (const pos of [0, 1]) {
      const a = base[pos];
      const prot = ours[pos].find((o) => o.kind === 'move' && PROTECTS.has(o.move));
      if (prot && a.kind === 'move' && !PROTECTS.has(a.move)) options.push(pos === 0 ? [prot, base[1]] : [base[0], prot]);
      if (a.kind === 'move' && typeof a.target === 'number') {
        const swap = ours[pos].find((o) => o.kind === 'move' && o.move === a.move && o.target === 1 - a.target);
        if (swap) options.push(pos === 0 ? [swap, base[1]] : [base[0], swap]);
      }
    }
    if (this.r() < 0.02) {
      const pos = this.r() < 0.5 ? 0 : 1;
      const k = S.active[this.me][pos];
      const holdsStone = k && !S.mons[k].mega && mech.items[S.mons[k].set.item]?.megaStone;
      const sw = ours[pos].filter((o) => o.kind === 'switch');
      if (sw.length && !holdsStone) { const o = sw[Math.floor(this.r() * sw.length)]; return { j: pos === 0 ? [o, base[1]] : [base[0], o] }; }
    }
    const ok = options.filter((j) => j.every((x) => x.kind !== 'switch') && joints([j[0]], [j[1]]).length);
    return { j: ok.length ? ok[Math.floor(this.r() * ok.length)] : base };
  }
  describe(S, a) {
    const m = S.mons[S.active[a.side][a.pos]];
    const nm = (k) => (k ? S.mons[k].set.name ?? S.mons[k].set.species : '?');
    if (a.kind === 'pass') return 'pass';
    if (a.kind === 'switch') return `${nm(m?.key)} → ${nm(a.to)}`;
    const tgt = typeof a.target === 'number' ? ` → ${nm(S.active[foe(a.side)][a.target])}` : a.target === 'ally' ? ' → ally' : '';
    return `${nm(m.key)} ${moveOf(a.move).name}${tgt}${a.mega ? ' (Mega)' : ''}`;
  }
  choiceOf(request, L, a, pos) {
    if (a.kind === 'pass') return 'pass';
    if (a.kind === 'switch') return `switch ${L.slotOf.get(a.to)}`;
    const moves = request.active[pos].moves;
    const n = moves.findIndex((x) => toID(x.id ?? x.move) === a.move) + 1;
    let s = `move ${n}`;
    // a locked move (the second turn of Solar Beam, a charging or rampage move) takes no target
    if (request.active.length > 1 && moves[n - 1]?.target !== undefined) {
      if (typeof a.target === 'number') s += ` ${a.target + 1}`;
      else if (a.target === 'ally') s += ` -${(1 - pos) + 1}`;
      else if (a.target === 'self') s += ` -${pos + 1}`;
    }
    if (a.mega) s += ' mega';
    return s;
  }

  // ---------- replacing a fainted Pokémon ----------
  forceSwitch(request) {
    const S = snapshot(this.T);
    const L = this.legalOf(request);
    const chosen = new Set();
    const me = this.me;
    const out = request.forceSwitch.map((must, pos) => {
      if (!must) return 'pass';
      const cands = L.switches.filter((x) => !chosen.has(x.key));
      if (!cands.length) return 'pass';
      const sc = cands.map((x) => {
        const m = S.mons[x.key];
        let off = 0, thr = 0;
        for (const k of S.active[foe(me)]) {
          if (!k) continue;
          const f = S.mons[k];
          off = Math.max(off, ...m.set.moves.filter((id) => moveOf(id).category !== 'Status').map((id) => { const d = damage(S, m, f, id); return (d.min + d.max) / 2; }), 0);
          thr = Math.max(thr, ...f.set.moves.filter((id) => moveOf(id).category !== 'Status').map((id) => { const d = damage(S, f, m, id); return (d.min + d.max) / 2; }), 0);
        }
        const faster = S.active[foe(me)].filter(Boolean).every((k) => (S.field.tr > 0 ? speed(S, m) < speed(S, S.mons[k]) : speed(S, m) > speed(S, S.mons[k])));
        return { x, v: Math.min(1.2, off) * (faster ? 1.2 : 1) - 0.8 * Math.min(1.2, thr / Math.max(0.1, m.hp)) + 0.3 * m.hp };
      }).sort((a, b) => b.v - a.v);
      const pick = this.r() < this.o.noise ? sc[Math.floor(this.r() * sc.length)] : sc[0];
      chosen.add(pick.x.key);
      this.note({ turn: this.T.turn, replace: pos, options: sc.map((y) => `${S.mons[y.x.key].set.species} ${y.v.toFixed(2)}`), chose: S.mons[pick.x.key].set.species });
      return `switch ${pick.x.slot}`;
    });
    return out.join(', ');
  }
}

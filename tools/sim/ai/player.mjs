// The heuristic player (tools/sim/NOTES.md "Step 2"): a Showdown BattlePlayer that reads the protocol into a Tracker,
// scores options with the turn model in engine.mjs (lib/calc damage), looks one ply ahead against the opponent's top
// replies, and picks with skill / temperature / noise. Deterministic per seed. Open team sheets: it knows both teams' sets.
import { BattlePlayer, setsFromText, toID, statsOf, abilityOf, moveOf, typesOf, mech, PROTECTS } from './data.mjs';
import { Tracker } from './tracker.mjs';
import { snapshot, optionsFor, resolve, value, damage, STYLES, foe, speed } from './engine.mjs';


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
export const DEFAULTS = { skill: 0.85, temperature: 0.04, noise: 0.07, style: 'balanced', topM: 4, topN: 8, topK: 3, usualBring: 0, previewTemp: 0.05 };

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
  preview(request) {
    const mine = request.side.pokemon.map((p) => this.mine.find((s) => s.species === toID(p.details.split(',')[0])) ?? this.mine.find((s) => toID(p.ident.split(': ')[1]) === toID(s.name)));
    const opp = this.theirs;
    const avgSpe = (ss) => ss.reduce((t, s) => t + statsOf(s, !!mech.items[s.item]?.megaStone).spe, 0) / ss.length;
    const sunUsers = (ss) => ss.filter((s) => s.moves.some((x) => ['weatherball', 'solarbeam'].includes(x) || (moveOf(x).type === 'Fire' && moveOf(x).category !== 'Status'))).length;
    const subsets = [];
    const n = mine.length;
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) for (let d = c + 1; d < n; d++) subsets.push([a, b, c, d]);
    const scored = subsets.map((ix) => {
      const ss = ix.map((i) => mine[i]);
      const off = opp.reduce((t, o) => t + Math.max(...ss.map((s) => this.pairHit(s, o))), 0) / opp.length;
      const def = ss.reduce((t, s) => t + Math.max(...opp.map((o) => this.pairHit(o, s))), 0) / ss.length;
      const slower = avgSpe(ss) < avgSpe(opp);
      let bonus = 0;
      if (ss.some((s) => s.moves.includes('fakeout'))) bonus += 0.05;
      if (ss.some((s) => s.moves.includes('trickroom')) && slower) bonus += 0.06;
      if (ss.some((s) => s.moves.includes('ragepowder') || s.moves.includes('followme'))) bonus += 0.03;
      if (ss.some((s) => s.ability === 'intimidate')) bonus += 0.03;
      if (ss.some((s) => mech.items[s.item]?.megaStone)) bonus += 0.05;
      if (ss.filter((s) => mech.items[s.item]?.megaStone).length > 1) bonus -= 0.05;
      return { ix, score: off - 0.8 * def + bonus, off, def };
    }).sort((x, y) => y.score - x.score);
    let pick, why;
    if (this.o.usualBring > 0 && this.r() < this.o.usualBring) { pick = { ix: [0, 1, 2, 3] }; why = 'usual 4 (habit)'; }
    else if (this.r() < this.o.skill) { pick = scored[0]; why = 'best 4'; }
    else { pick = softmaxPick(scored, (x) => x.score, this.o.previewTemp, this.r); why = 'softmax'; }
    // leads: the pair with the best offence into their six plus lead roles
    const ss = pick.ix.map((i) => mine[i]);
    const sunTeam = sunUsers(ss) >= 2;
    const pairs = [];
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
      const pr = [ss[a], ss[b]];
      let sc = opp.reduce((t, o) => t + Math.max(...pr.map((s) => this.pairHit(s, o))), 0) / opp.length;
      if (pr.some((s) => s.moves.includes('fakeout'))) sc += 0.12;
      if (pr.some((s) => s.ability === 'drought' || abilityOf(s, true) === 'drought') && sunTeam) sc += 0.1;
      if (pr.some((s) => s.moves.includes('trickroom')) && avgSpe(ss) < avgSpe(opp)) sc += 0.1;
      if (pr.some((s) => s.ability === 'intimidate')) sc += 0.05;
      if (pr.some((s) => mech.items[s.item]?.megaStone)) sc += 0.05;
      if (pr.every((s) => s.moves.includes('fakeout'))) sc -= 0.05;
      pairs.push({ ab: [a, b], sc });
    }
    pairs.sort((x, y) => y.sc - x.sc);
    const lead = why === 'usual 4 (habit)' ? { ab: [0, 1] } : this.r() < this.o.skill ? pairs[0] : softmaxPick(pairs, (x) => x.sc, this.o.previewTemp, this.r);
    const order = [...lead.ab, ...[0, 1, 2, 3].filter((i) => !lead.ab.includes(i))].map((i) => pick.ix[i] + 1);
    this.note({ preview: { bring: pick.ix.map((i) => mine[i].species), leads: lead.ab.map((i) => ss[i].species), why, top: scored.slice(0, 3).map((x) => ({ four: x.ix.map((i) => mine[i].species), score: +x.score.toFixed(3) })) } });
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
    const V = (acts, side) => value(resolve(S, acts), side, side === me ? this.style : STYLES.balanced);
    const pass = (side, pos) => ({ kind: 'pass', side, pos });
    // a spread move that also hits the partner (Earthquake, Boomburst, Discharge) only when the partner is immune or protects
    const hitsAlly = (x, y) => {
      if (x.kind !== 'move' || moveOf(x.move).target !== 'allAdjacent' || moveOf(x.move).category === 'Status') return false;
      const ak = S.active[x.side][x.pos], bk = S.active[x.side][1 - x.pos];
      if (!ak || !bk || (y.kind === 'move' && PROTECTS.has(y.move)) || y.kind === 'switch') return false;
      return damage(S, S.mons[ak], S.mons[bk], x.move, { spread: true }).max > 0;
    };
    const joints = (a, b) => { const out = []; for (const x of a) for (const y of b) { if (x.kind === 'switch' && y.kind === 'switch' && x.to === y.to) continue; if (hitsAlly(x, y) || hitsAlly(y, x)) continue; out.push(x.mega && y.mega ? [x, { ...y, mega: false }] : [x, y]); } return out; };
    const mix = (plans, w) => { const top = Math.max(...plans.map((x) => x.v)); const e = plans.map((x) => Math.exp((x.v - top) / w)); const t = e.reduce((a, b) => a + b, 0); return plans.map((x, k) => ({ ...x, w: e[k] / t })); };
    // 1. their likely plays if we did nothing (a few distinct plans, not one: e.g. "double the setter" and "spread"),
    // weighted by how good each is for them
    const tSingles = theirs.map((opts, pos) => opts.map((o) => ({ o, v: V([o, pass(them, 1 - pos)], them) })).sort((a, b) => b.v - a.v).slice(0, this.o.topM).map((x) => x.o));
    const R0 = mix(joints(tSingles[0], tSingles[1]).map((j) => ({ j, v: V(j, them) })).sort((a, b) => b.v - a.v).slice(0, this.o.topK), 0.08);
    const guessT = R0[0].j;
    const vsR0 = (acts) => R0.reduce((t, r) => t + r.w * V([...acts, ...r.j], me), 0);
    // 2. our top options per slot (against that mix), then the joint ones
    const singles = ours.map((opts, pos) => opts.map((o) => ({ o, v: vsR0([o, pass(me, 1 - pos)]) })).sort((a, b) => b.v - a.v));
    const topOurs = singles.map((l) => l.slice(0, this.o.topM).map((x) => x.o));
    const ourJ = joints(topOurs[0], topOurs[1]).map((j) => ({ j, v: vsR0(j) })).sort((a, b) => b.v - a.v).slice(0, this.o.topN);
    // 3. their candidate plays: the plans above plus their best replies to our few best candidates
    const ourTop = ourJ.slice(0, 3).map((x) => x.j);
    const topTheirs = theirs.map((opts, pos) => opts.map((o) => ({ o, v: ourTop.reduce((t, oj) => t + V([...oj, o, guessT[1 - pos]], them), 0) })).sort((a, b) => b.v - a.v).slice(0, this.o.topM).map((x) => x.o));
    const key = (j) => JSON.stringify(j);
    const A = ourJ.map((x) => x.j), B = R0.map((r) => r.j);
    const seenA = new Set(A.map(key)), seenB = new Set(B.map(key));
    for (const r of joints(topTheirs[0], topTheirs[1]).map((j) => ({ j, v: ourTop.reduce((t, oj) => t + V([...oj, ...j], them), 0) })).sort((a, b) => b.v - a.v).slice(0, this.o.topN)) if (!seenB.has(key(r.j))) { seenB.add(key(r.j)); B.push(r.j); }
    // 4. the turn as a simultaneous-move game (double oracle): solve our candidates × theirs for both sides' mixed
    // strategies (regret matching), add each side's best response to the other's mix, repeat until nothing new
    const cell = new Map();
    const Vc = (a, b) => { const k = `${key(a)}|${key(b)}`; if (!cell.has(k)) cell.set(k, V([...a, ...b], me)); return cell.get(k); };
    const bestResponse = (side, optsBySlot, others, w, top) => {
      const sideV = (j) => others.reduce((t, o, k) => (w[k] > 0.01 ? t + w[k] * (side === me ? Vc(j, o) : -Vc(o, j)) : t), 0);
      const sl = optsBySlot.map((opts, pos) => opts.map((o) => ({ o, v: sideV(pos === 0 ? [o, top[1]] : [top[0], o]) })).sort((a, b) => b.v - a.v).slice(0, this.o.topM).map((x) => x.o));
      return joints(sl[0], sl[1]).map((j) => ({ j, v: sideV(j) })).sort((a, b) => b.v - a.v)[0]?.j;
    };
    let p, q, M;
    for (let it = 0; it < 4; it++) {
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
    const ourJ2 = A.map((j) => ({ j })), theirJ = B;
    const ev = M.map((row) => row.reduce((t, x, k) => t + x * q[k], 0));
    const final = ourJ2.map((x, i) => ({ j: x.j, v: ev[i], p: p[i] })).sort((a, b) => b.p - a.p || b.v - a.v);
    let pick, why;
    if (this.r() < this.o.noise) { const all = joints(ours[0], ours[1]); pick = { j: all[Math.floor(this.r() * all.length)], v: NaN }; why = 'noise'; }
    else if (this.r() < this.o.skill) { pick = sampleBy(final, (x) => x.p, this.r); why = 'equilibrium mix'; }
    else { pick = softmaxPick([...final].sort((a, b) => b.v - a.v), (x) => x.v, this.o.temperature, this.r); why = 'softmax'; }
    const qs = theirJ.map((j, k) => ({ j, q: q[k] })).sort((a, b) => b.q - a.q);
    this.last = { final, expect: qs };
    if (this.o.notes) {
      const desc = (j) => j.map((a) => this.describe(S, a)).join(' + ');
      const sim = resolve(S, [...pick.j, ...qs[0].j]);
      this.note({ turn: T.turn, field: { weather: S.field.weather, terrain: S.field.terrain, tr: S.field.tr, tailwind: [S.side.p1.tailwind, S.side.p2.tailwind] },
        guess: R0.map((r) => `${desc(r.j)} (w ${r.w.toFixed(2)})`), singles: singles.map((l) => l.slice(0, 5).map((x) => `${this.describe(S, x.o)} ${x.v.toFixed(3)}`)),
        mix: final.filter((x) => x.p > 0.02).map((x) => `${desc(x.j)} (p ${x.p.toFixed(2)}, ev ${x.v.toFixed(3)})`), expect: qs.filter((x) => x.q > 0.02).map((x) => `${desc(x.j)} (q ${x.q.toFixed(2)})`),
        chose: `${desc(pick.j)} [${why}]`, model: sim.log });
    }
    return pick.j.map((a, pos) => this.choiceOf(request, L, a, pos)).join(', ');
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

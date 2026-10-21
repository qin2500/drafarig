// Build a battle position by hand (no Showdown battle) and ask the heuristic player for its choice.
import { createRequire } from 'node:module';
import { HeuristicPlayer } from '../ai/player.mjs';
import { Tracker } from '../ai/tracker.mjs';
import { DEX, mech } from '../ai/data.mjs';

const require = createRequire(import.meta.url);
export const CAND = require('../candidates/zhuzi.json');
export const team = (id) => [...CAND.ours.teams, ...CAND.opponent.teams].find((t) => t.id === id).team;
const dummy = { write() {}, async *[Symbol.asyncIterator]() {} };

/**
 * position({ mine, theirs, us: [sp, sp], them: [sp, sp], bench: [sp…] (ours), theirBench: [sp…] (seen), hp: { 'p1:sp': f },
 * mega: ['p2:metagross'], turn, firstTurn, field: { weather, tr, trBy }, used: { 'p1:sp': [moves] }, gone: ['p1:sp'] (items),
 * opts }) → { choice, slots: [{ move, target, mega } | { switch }], note }
 */
export function position(o) {
  const p = new HeuristicPlayer(dummy, { mine: o.mine, theirs: o.theirs, seed: o.seed ?? 1, skill: 1, noise: 0, notes: true, ...o.opts });
  const T = new Tracker({ p1: p.mine, p2: p.theirs });
  p.T = T; p.me = 'p1';
  T.turn = o.turn ?? 3;
  const find = (side, sp) => T.mons[side].find((x) => x.set.species === sp);
  const place = (side, sp, pos) => {
    const m = find(side, sp);
    if (!m) throw new Error(`no ${sp} on ${side}`);
    T.active[side][pos] = m; m.pos = pos; m.seen = m.brought = true;
    m.entered = o.firstTurn ? T.turn - 1 : T.turn - 3;
    T.byIdent.set(`${side}|${m.set.name}`, m);
    return m;
  };
  o.us.forEach((sp, i) => sp && place('p1', sp, i));
  o.them.forEach((sp, i) => sp && place('p2', sp, i));
  for (const sp of o.bench ?? []) find('p1', sp).brought = true;
  for (const sp of o.theirBench ?? []) Object.assign(find('p2', sp), { brought: true, seen: true });
  for (const [k, f] of Object.entries(o.hp ?? {})) { const [s, sp] = k.split(':'); find(s, sp).hp = f; if (f <= 0) find(s, sp).fainted = true; }
  for (const k of o.mega ?? []) { const [s, sp] = k.split(':'); find(s, sp).mega = true; }
  for (const [k, mv] of Object.entries(o.used ?? {})) { const [s, sp] = k.split(':'); find(s, sp).movesUsed = mv; find(s, sp).lastMove = mv.at(-1); if (mv.at(-1) === 'protect' || mv.at(-1) === 'wideguard') find(s, sp).protectStreak = 1; }
  for (const [k, mv] of Object.entries(o.locked ?? {})) { const [s, sp] = k.split(':'); find(s, sp).locked = mv; }
  for (const k of o.gone ?? []) { const [s, sp] = k.split(':'); find(s, sp).itemGone = true; }
  Object.assign(T.field, o.field ?? {});
  const mons = [...o.us, ...(o.bench ?? [])].filter(Boolean).map((sp) => find('p1', sp));
  const request = {
    active: o.us.map((sp) => { const m = sp && find('p1', sp); return m ? { moves: m.set.moves.map((id) => ({ move: DEX.moves.get(id).name, id, target: DEX.moves.get(id).target, pp: 8, maxpp: 8, disabled: false })), canMegaEvo: !m.mega && !!mech.items[m.set.item]?.megaStone && !mons.some((x) => x.mega) } : { moves: [] }; }),
    side: { id: 'p1', name: 'A', pokemon: mons.map((m, i) => ({ ident: `p1: ${m.set.name}`, details: `${DEX.species.get(m.set.species).name}, L50`, condition: m.hp > 0 ? `${Math.max(1, Math.round(m.hp * 100))}/100` : '0 fnt', active: i < 2 })) },
  };
  const choice = p.turn(request);
  const slots = choice.split(', ').map((c, pos) => {
    const w = c.split(' ');
    if (w[0] === 'switch') return { switch: mons[Number(w[1]) - 1].set.species };
    if (w[0] === 'pass') return { pass: true };
    return { move: request.active[pos].moves[Number(w[1]) - 1].id, target: w[2] && !w[2].startsWith('m') ? Number(w[2]) : null, mega: w.includes('mega') };
  });
  // probability our equilibrium mix gives a slot's option matching `pred` ({ move, target } / { switch })
  const pOf = (pos, pred) => (p.last?.final ?? []).filter((x) => { const a = x.j[pos]; return pred(a.kind === 'switch' ? { switch: p.T.mons.p1[Number(a.to.split(':')[1])].set.species } : a.kind === 'move' ? { move: a.move, target: typeof a.target === 'number' ? a.target + 1 : null } : {}); }).reduce((t, x) => t + x.p, 0);
  return { choice, slots, note: p.notes.at(-1), player: p, pOf };
}

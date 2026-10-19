// The generated mock (docs/research/dev/mocks-plan.md §2; lead decisions 2026-10-19): coach X's best 6 vs coach Y from X's
// drafted 10, when no curated mock exists. Both directions of the worst-case threat scan (lib/threat-scan.mjs), one Mega,
// the species and item clauses, and never dropping a drafted mon for lacking ladder data. Every set is labelled
// 'ladder' (Smogon usage), 'tuned' (changed for this matchup) or 'worst' (full-learnset worst case). Pure: engine, data
// and usage come in. Weights live here (no in-app tuning).
import { legalAbilities, battleForme, canLearn, toID } from './calc/mech.mjs';
import { STAT_IDS } from './calc/stats.mjs';
import { targetsOf } from './prep-build.mjs';
import { scanThreats } from './threat-scan.mjs';

export const WEIGHTS = Object.freeze({ offence: 1, defence: 0.5, sharedSpread: 0.6, role: 0.25, megaBonus: 0.1 });
const ROLE_KEYS = ['fake-out', 'trick-room', 'tailwind', 'intimidate', 'redirection'];
const ITEM_FALLBACKS = ['lifeorb', 'sitrusberry', 'focussash', 'leftovers', 'expertbelt', 'wiseglasses', 'muscleband', 'safetygoggles', 'covertcloak', 'mentalherb', 'quickclaw'];
const ROLE_MOVES = ['fakeout', 'trickroom', 'tailwind', 'followme', 'ragepowder', 'protect'];
// two-turn, recharge or conditional hits: the scan rates their damage, but no real set runs them as its main attack
// ponytail: hand list; a move-flag in the data would replace it
const CLUNKY = new Set(['focuspunch', 'phantomforce', 'shadowforce', 'solarbeam', 'solarblade', 'skyattack', 'meteorbeam', 'electroshot', 'dig', 'dive', 'fly', 'bounce', 'hyperbeam', 'gigaimpact', 'blastburn', 'frenzyplant', 'hydrocannon', 'rockwrecker', 'roaroftime', 'prismaticlaser', 'meteorassault', 'eternabeam', 'shelltrap', 'beakblast', 'futuresight', 'doomdesire', 'dreameater', 'belch', 'lastresort', 'synchronoise', 'steelbeam', 'mindblown', 'selfdestruct', 'explosion', 'mistyexplosion', 'finalgambit', 'memento', 'skydrop']);
const SPREAD = new Set(['allAdjacent', 'allAdjacentFoes']);
const ZERO = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

/** Candidate sets for X's pool: one per out-of-battle species, plus one per Mega forme. */
function candidates(mech, xPool, { usage, dexSpecies, asOf, guesses }) {
  const rows = targetsOf(mech, xPool, { usage, dexSpecies, asOf });
  return rows.map((r) => {
    const guess = guesses?.get(r.species);
    if (guess && (!r.mega || guess.item === r.item)) return { ...r, set: { species: r.species, ...structuredClone(guess) }, label: 'yours' };
    const set = { ...structuredClone(r.set) };
    const phys = (set.moves ?? []).filter((m) => mech.moves[m]?.category === 'Physical').length >= (set.moves ?? []).filter((m) => mech.moves[m]?.category === 'Special').length;
    let label = 'ladder';
    if (set.sp === 'unknown') {
      if (r.common) { set.sp = { ...r.common.sp }; set.nature = r.common.nature; }
      else { const st = phys ? 'atk' : 'spa'; set.sp = { ...ZERO, hp: 2, [st]: 32, spe: 32 }; set.nature = phys ? 'adamant' : 'modest'; label = 'worst'; }
    }
    if (!set.nature) set.nature = phys ? 'adamant' : 'modest';
    if (r.source !== 'ladder' || r.usageFrom === 'keymoves') label = 'worst';
    if (!set.moves?.length) set.moves = [];
    if (!set.ability) { const ab = legalAbilities(mech, r.species); set.ability = ab.includes('intimidate') ? 'intimidate' : ab[0] ?? ''; }
    return { ...r, set, label };
  });
}
/** Y's sets as scan targets: the ladder row, else max bulk (32 HP, 17 / 17 in the defences): a KO claim holds vs the bulkiest. */
function targetsY(mech, yPool, { usage, dexSpecies, asOf }) {
  return targetsOf(mech, yPool, { usage, dexSpecies, asOf }).filter((r) => !r.mega || r.source !== 'none').map((r) => {
    const set = { ...structuredClone(r.set) };
    if (set.sp === 'unknown') { if (r.common) { set.sp = { ...r.common.sp }; set.nature = r.common.nature; } else { set.sp = { ...ZERO, hp: 32, def: 17, spd: 17 }; set.nature = set.nature || 'hardy'; } }
    if (!set.moves?.length) set.moves = [];
    return { key: `y|${r.forme}`, set, mega: r.mega, species: r.species, forme: r.forme };
  });
}
/**
 * A coherent moveset (ladder top moves come from different sets): a Choice item runs no status moves (Protect included);
 * no two damaging moves of one type unless one is spread and the other single-target and clearly stronger into one target
 * (≥ 1.5× the spread move's doubles power); a non-Choice set keeps Protect when its ladder runs it. Gaps fill from `pool`
 * (more ladder moves, then the matchup's best hits). Returns the move ids.
 */
export function cohere(mech, set, pool = [], { ladderProtect = false } = {}) {
  const choice = /^choice/.test(set.item ?? '');
  const out = [];
  const ok = (m) => {
    const mv = mech.moves[m];
    if (!mv || out.includes(m) || !canLearn(mech, set.species, m)) return false;
    if (mv.category === 'Status') return !choice;
    return out.every((o) => {
      const ov = mech.moves[o];
      if (ov.category === 'Status' || ov.type !== mv.type) return true;
      const [sp, st] = SPREAD.has(mv.target) ? [mv, ov] : [ov, mv];
      // ponytail: base-power ratio stands in for "both add value"; a calc-based check would replace it
      return SPREAD.has(sp.target) && !SPREAD.has(st.target) && st.basePower >= 1.5 * 0.75 * sp.basePower;
    });
  };
  for (const m of [...(set.moves ?? []), ...pool]) if (out.length < 4 && ok(m)) out.push(m);
  if (!choice && ladderProtect && !out.includes('protect') && canLearn(mech, set.species, 'protect')) out.splice(Math.min(out.length, 3), 1, 'protect');
  return out;
}
const num = (mech, id) => mech.species[mech.species[id]?.mega?.from ?? id]?.num ?? id;
const keyOf = (c) => c.forme;

/**
 * The analysis behind every six (computed once): per candidate, its best severity into each Y forme (offence), the severity
 * of Y's hits into it (defence), the Y spread KOs it is in (for the shared-spread penalty), its roles; and its matchup moves.
 */
export function analyse(calc, mech, { xPool, yPool, usage = null, typeEff = null, dexSpecies = () => null, asOf = null, guesses = null }) {
  const cands = candidates(mech, xPool, { usage, dexSpecies, asOf, guesses });
  const ys = targetsY(mech, yPool, { usage, dexSpecies, asOf });
  // X into Y (worst-case learnsets): each X form's best severity per Y form, and its best moves (to fill a worst-case set)
  const off = scanThreats(calc, mech, xPool.map((species) => ({ species })), ys, { usage, typeEff, fast: true });
  const offBest = new Map(), bestMoves = new Map();
  for (const r of off) {
    const m = offBest.get(r.forme) ?? new Map();
    if ((m.get(r.target) ?? 0) < r.severity) m.set(r.target, r.severity);
    offBest.set(r.forme, m);
    const bm = bestMoves.get(r.forme) ?? [];
    if (!bm.includes(r.move) && !CLUNKY.has(r.move) && bm.length < 3 && r.severity > 0) bm.push(r.move);
    bestMoves.set(r.forme, bm);
  }
  // a worst-case (no usage) set takes its two strongest matchup moves plus its role moves
  for (const c of cands) {
    if (c.label === 'worst') {
      const moves = [...(bestMoves.get(c.forme) ?? []).slice(0, 2)];
      for (const m of [...ROLE_MOVES, ...(c.set.moves ?? [])]) if (moves.length < 4 && !moves.includes(m) && canLearn(mech, c.species, m)) moves.push(m);
      c.set.moves = moves.slice(0, 4);
      // the spread follows the attacks it ended up with
      const cat = (k) => c.set.moves.filter((m) => mech.moves[m]?.category === k).length;
      if (c.set.sp?.atk === 32 || c.set.sp?.spa === 32) {
        const phys = cat('Physical') >= cat('Special');
        c.set.sp = { ...ZERO, hp: 2, [phys ? 'atk' : 'spa']: 32, spe: 32 }; c.set.nature = phys ? 'adamant' : 'modest';
      }
      if (!c.mega && !c.set.item) c.set.item = 'lifeorb';
    }
    if (!c.set.moves.length) c.set.moves = (bestMoves.get(c.forme) ?? []).slice(0, 4);
    if (c.label === 'yours') continue;
    const u = usage?.species?.[c.forme] ?? usage?.species?.[c.species];
    const ladder = (u?.moves ?? []).map(([m]) => toID(m));
    c.moveSrc = { moves: c.set.moves, pool: [...ladder, ...(bestMoves.get(c.forme) ?? [])], ladderProtect: ladder.slice(0, 6).includes('protect') || c.set.moves.includes('protect') };
    const moves = cohere(mech, c.set, c.moveSrc.pool, c.moveSrc);
    if (c.label === 'ladder' && moves.join() !== c.set.moves.join()) { c.label = 'tuned'; c.tunedWhy = 'coherent set'; }
    c.set.moves = moves;
  }
  // Y into X's candidate sets
  const def = scanThreats(calc, mech, yPool.map((species) => ({ species })), cands.map((c) => ({ key: c.forme, set: c.set, mega: c.mega })), { usage, typeEff, fast: true, zardSun: false });
  const defSum = new Map(), spreadKeys = new Map();
  for (const r of def) {
    defSum.set(r.target, (defSum.get(r.target) ?? 0) + r.severity * 0.1);
    if (r.spread && r.odds >= 0.5) { const s = spreadKeys.get(r.target) ?? new Set(); s.add(`${r.forme}|${r.move}`); spreadKeys.set(r.target, s); }
  }
  const roles = new Map(cands.map((c) => [c.forme, new Set((dexSpecies(c.species)?.roles ?? []).filter((x) => ROLE_KEYS.includes(x)))]));
  return { cands, ys, offBest, defSum, spreadKeys, roles };
}

/** Score one six (an array of candidates). Exported so tests can brute-force every six. */
export function scoreSix(a, six) {
  let offence = 0;
  for (const y of a.ys) offence += Math.min(1.25, Math.max(0, ...six.map((c) => a.offBest.get(c.forme)?.get(y.key) ?? 0)));
  const defence = six.reduce((t, c) => t + (a.defSum.get(c.forme) ?? 0), 0);
  const seen = new Map();
  for (const c of six) for (const k of a.spreadKeys.get(c.forme) ?? []) seen.set(k, (seen.get(k) ?? 0) + 1);
  const shared = [...seen.values()].filter((n) => n >= 2).length;
  const roles = new Set(six.flatMap((c) => [...(a.roles.get(c.forme) ?? [])])).size;
  const mega = six.some((c) => c.mega) ? 1 : 0;
  return WEIGHTS.offence * offence - WEIGHTS.defence * defence - WEIGHTS.sharedSpread * shared + WEIGHTS.role * roles + WEIGHTS.megaBonus * mega;
}
/** Is a six legal? Species clause (dex number, Megas as their base), at most one Mega. */
export function legalSix(mech, six) {
  const nums = six.map((c) => num(mech, c.forme));
  return new Set(nums).size === nums.length && six.filter((c) => c.mega).length <= 1;
}
/** Every legal six (fewer when the roster has fewer than six species): a species once (its base or one Mega forme), at most one Mega. */
export function* allSixes(mech, cands) {
  const bySpecies = new Map();
  for (const c of cands) bySpecies.set(c.species, [...(bySpecies.get(c.species) ?? []), c]);
  const species = [...bySpecies.keys()];
  const size = Math.min(6, new Set(cands.map((c) => num(mech, c.forme))).size);
  const pick = (start, chosen) => (function* inner(s, ch) {
    if (ch.length === size) { yield ch; return; }
    for (let i = s; i < species.length; i++) for (const c of bySpecies.get(species[i])) yield* inner(i + 1, [...ch, c]);
  })(start, chosen);
  for (const six of pick(0, [])) if (legalSix(mech, six)) yield six;
}
/** The item clause for a six: Mega stones fixed, then each set keeps its item unless taken, else its next item. */
export function assignItems(mech, six) {
  const used = new Set(six.filter((c) => c.mega).map((c) => c.set.item));
  return six.map((c) => {
    if (c.mega) return { ...c, set: { ...c.set } };
    const want = [c.set.item, ...ITEM_FALLBACKS].filter((i) => i && mech.items[i] && !mech.items[i].megaStone);
    const item = want.find((i) => !used.has(i)) ?? '';
    used.add(item);
    if (item === c.set.item) return { ...c, set: { ...c.set } };
    // a new item can change what the set runs (off a Choice item, Protect comes back)
    const moves = c.moveSrc ? cohere(mech, { ...c.set, item, moves: c.moveSrc.moves }, c.moveSrc.pool, c.moveSrc) : c.set.moves;
    return { ...c, set: { ...c.set, item, moves }, label: ['ladder', 'tuned'].includes(c.label) ? 'tuned' : c.label, tunedWhy: 'item clause' };
  });
}
/**
 * The generated mock: { best: six, variants: [{ name, six, score }], analysis }. Variants: the best six, the best six
 * with a different Mega (or none), and the next best six differing by at least one mon.
 */
export function generateMock(calc, mech, opts) {
  const a = analyse(calc, mech, opts);
  const scored = [];
  for (const six of allSixes(mech, a.cands)) scored.push({ six, score: scoreSix(a, six) });
  scored.sort((x, y) => y.score - x.score || x.six.map(keyOf).join().localeCompare(y.six.map(keyOf).join()));
  if (!scored.length) return { best: null, variants: [], analysis: a };
  const best = scored[0];
  const megaOf = (s) => s.six.find((c) => c.mega)?.forme ?? '';
  const sameMons = (s, t) => s.six.map((c) => c.species).sort().join() === t.six.map((c) => c.species).sort().join();
  const otherMega = scored.find((s) => megaOf(s) !== megaOf(best));
  const next = scored.find((s) => !sameMons(s, best) && s !== otherMega);
  const variants = [{ name: 'main', s: best }, ...(otherMega ? [{ name: 'mega', s: otherMega }] : []), ...(next ? [{ name: 'alt', s: next }] : [])]
    .map(({ name, s }) => ({ name, score: s.score, six: assignItems(mech, s.six) }));
  return { best: variants[0].six, variants, analysis: a };
}
/** Sets of a six as plain calc sets (species, item, ability, nature, moves, sp) with their labels. */
export const setsOf = (six) => six.map((c) => ({ set: { species: c.species, item: c.set.item ?? '', ability: c.set.ability ?? '', nature: c.set.nature ?? 'hardy', moves: (c.set.moves ?? []).slice(0, 4), sp: { ...ZERO, ...(c.set.sp === 'unknown' ? {} : c.set.sp) } }, label: c.label, forme: c.forme, tunedWhy: c.tunedWhy ?? '' }));
export { STAT_IDS, toID, battleForme };

// Roster plans: complete, affordable sets for every remaining slot.
// Stage 1: exact-count 0/1 knapsack DP keeps the top-K candidates by an additive score.
// Stage 2: re-rank candidates with the full set score (roles, Mega cap, stacked weaknesses).
// Stage 3: pick diverse plans (different first pick, limited overlap).
import { affordability } from './budget.mjs';
import { CHECKS, TIER_VALUE, rosterScore, weaknessMatrix, effectiveness, DEFAULT_WEIGHTS, topThreatForms } from './analysis.mjs';

/** dp[k][p] = top-N partial rosters with exactly k mons costing exactly p. Items: [{cost, score}]. */
export function topRosters(items, slotsLeft, pointsLeft, N = 5) {
  if (slotsLeft <= 0) return [{ score: 0, cost: 0, picks: [] }];
  const dp = Array.from({ length: slotsLeft + 1 }, () => Array.from({ length: pointsLeft + 1 }, () => []));
  dp[0][0] = [{ score: 0, picks: [] }];
  for (let i = 0; i < items.length; i++) {
    const { cost, score } = items[i];
    if (cost > pointsLeft) continue;
    for (let k = slotsLeft; k >= 1; k--) { // descending: each item used at most once
      for (let p = pointsLeft; p >= cost; p--) {
        const from = dp[k - 1][p - cost];
        if (!from.length) continue;
        const merged = dp[k][p].concat(from.map((r) => ({ score: r.score + score, picks: [...r.picks, i] })));
        merged.sort((a, b) => b.score - a.score);
        dp[k][p] = merged.length > N ? merged.slice(0, N) : merged;
      }
    }
  }
  return dp[slotsLeft].flatMap((list, p) => list.map((r) => ({ ...r, cost: p })))
    .sort((a, b) => b.score - a.score || a.cost - b.cost);
}

/** Additive per-mon estimate relative to the current roster (used only to seed the DP). */
function additiveScore(dex, mon, ctx, w) {
  let s = w.value * (TIER_VALUE[mon.tier] ?? 1) + (w.price ?? 0) * (ctx.costs?.get(mon.id) || 0);
  for (const c of ctx.unmet) if (c.test(mon)) s += w.roles * c.weight / c.target;
  for (const t of ctx.weakTypes) {
    const best = Math.min(...mon.forms.map((f) => effectiveness(dex, t, f)));
    if (best <= 0.5) s += w.defense * 1.5;
  }
  for (const t of ctx.stackedish) if (Math.max(...mon.forms.map((f) => effectiveness(dex, t, f))) >= 2) s -= w.defense;
  for (const tf of ctx.uncovered) if (mon.forms.some((mf) => tf.types.every((ty) => effectiveness(dex, ty, mf) <= 0.5))) s += (w.threats ?? 1) * 3 / Math.max(1, ctx.uncovered.length / 2);
  if (ctx.nums.has(mon.num)) s -= 6; // species clause duplicate
  return s;
}

function teamContext(dex, rosterIds, threats = []) {
  const mons = rosterIds.map((id) => dex.species[id]).filter(Boolean);
  const covers = (tf) => mons.some((m) => m.forms.some((mf) => tf.types.every((ty) => effectiveness(dex, ty, mf) <= 0.5)));
  const unmet = CHECKS.filter((c) => mons.filter(c.test).length < c.target);
  const matrix = weaknessMatrix(dex, rosterIds);
  return {
    unmet, nums: new Set(mons.map((m) => m.num)),
    uncovered: threats.flatMap((t) => t.forms).filter((tf) => !covers(tf)),
    weakTypes: matrix.filter((r) => r.weak > r.resist + r.immune).map((r) => r.type),
    stackedish: matrix.filter((r) => r.weak >= 2 && r.resist + r.immune === 0).map((r) => r.type),
  };
}

/** Plain-language reason chips for adding `id` to the roster (max 3 positive, 1 negative). */
export function whyChips(dex, rosterIds, id, threats = []) {
  const mon = dex.species[id], ctx = teamContext(dex, rosterIds, threats);
  const pos = [], neg = [];
  const fills = ctx.unmet.filter((c) => c.test(mon)).sort((a, b) => b.weight - a.weight);
  if (fills.length) pos.push(`+ Fills ${fills.slice(0, 2).map((c) => c.label).join(' and ')}`);
  const resists = ctx.weakTypes.filter((t) => Math.min(...mon.forms.map((f) => effectiveness(dex, t, f))) <= 0.5);
  if (resists.length) pos.push(`+ Resists ${resists.slice(0, 3).join(', ')} (your team is weak to ${resists.length > 1 ? 'them' : 'it'})`);
  const answers = ctx.uncovered.filter((tf) => mon.forms.some((mf) => tf.types.every((ty) => effectiveness(dex, ty, mf) <= 0.5))).map((tf) => tf.name);
  if (answers.length) pos.push(`+ Answers ${[...new Set(answers)].slice(0, 3).join(', ')} (resists its main attacks; nobody on your team does yet)`);
  if (ctx.nums.has(mon.num)) neg.unshift('− Same species as one you own: only one can be on a team (species clause)');
  if ('SA'.includes(mon.tier)) pos.push(`+ ${mon.tier}-tier in the current meta`);
  else if (mon.tier === 'B') pos.push('+ Solid B-tier pick');
  if (mon.roles.includes('mega') && pos.length < 3) pos.push(`+ Comes with ${mon.forms.filter((f) => f.mega).map((f) => f.name).join(' / ')}`);
  const adds = ctx.stackedish.filter((t) => Math.max(...mon.forms.map((f) => effectiveness(dex, t, f))) >= 2);
  if (adds.length) neg.push(`− Also weak to ${adds.slice(0, 2).join(', ')} (already a team problem)`);
  else if (mon.tier === 'D') neg.push('− Low meta value (D-tier): mostly a filler');
  if (!pos.length) {
    const backups = CHECKS.filter((c) => c.weight >= 4 && c.test(mon)).map((c) => c.label);
    pos.push(backups.length ? `+ Backup ${backups.slice(0, 2).join(' and ')}` : '+ Fills a roster slot cheaply');
  }
  return [...pos.slice(0, 3), ...neg.slice(0, 1)];
}

const jaccard = (a, b) => { const A = new Set(a), B = new Set(b); let i = 0; for (const x of A) if (B.has(x)) i++; return i / (A.size + B.size - i); };

/**
 * @param dex           data/dex.json
 * @param rosterIds     ids already on the coach's roster
 * @param available     [{id, cost}] still available on the board
 * @returns {{plans, singles, candidates}}
 */
export function buildPlans(dex, rosterIds, available, slotsLeft, pointsLeft, { nPlans = 3, weights = DEFAULT_WEIGHTS, perCell = 24, anchors = 25, opponents = [], rosterCosts = {} } = {}) {
  const threats = topThreatForms(dex, opponents);
  const ctx = teamContext(dex, rosterIds, threats);
  // Costs of everything the coach owns or could buy (owned picks keep their Drafts price via `rosterCosts`).
  const costs = new Map([...Object.entries(rosterCosts), ...available.map((m) => [m.id, m.cost])]);
  ctx.costs = costs;
  const items = available.filter((m) => dex.species[m.id] && m.cost <= pointsLeft)
    .map((m) => ({ ...m, score: additiveScore(dex, dex.species[m.id], ctx, weights) }));
  const base = rosterScore(dex, rosterIds, weights, { threats, costs });

  const seen = new Set();
  const candidates = [];
  const add = (ids, cost) => {
    const key = [...ids].sort().join(',');
    if (seen.has(key)) return; seen.add(key);
    candidates.push({ ids, cost, score: rosterScore(dex, [...rosterIds, ...ids], weights, { threats, costs }) });
  };
  for (const r of topRosters(items, slotsLeft, pointsLeft, perCell).slice(0, 600)) add(r.picks.map((i) => items[i].id), r.cost);
  // The additive seed misjudges picks whose value depends on the rest of the set, so also search with each
  // top single pick locked in first (seed re-scored against roster + that pick).
  if (slotsLeft > 1 && anchors > 0) {
    const gain = (id) => rosterScore(dex, [...rosterIds, id], weights, { threats, costs }).total;
    for (const a of [...items].sort((x, y) => gain(y.id) - gain(x.id)).slice(0, anchors)) {
      const ctx2 = teamContext(dex, [...rosterIds, a.id], threats);
      ctx2.costs = costs;
      const sub = items.filter((m) => m.id !== a.id && m.cost <= pointsLeft - a.cost)
        .map((m) => ({ ...m, score: additiveScore(dex, dex.species[m.id], ctx2, weights) }));
      for (const r of topRosters(sub, slotsLeft - 1, pointsLeft - a.cost, 8).slice(0, 40)) add([a.id, ...r.picks.map((i) => sub[i].id)], r.cost + a.cost);
    }
  }
  candidates.sort((a, b) => b.score.total - a.score.total || a.cost - b.cost);

  // Diversity: each plan starts with a different first pick and shares at most half its picks with earlier plans.
  const costOf = new Map(items.map((m) => [m.id, m.cost]));
  const order = (ids) => [...ids].sort((a, b) => costOf.get(b) - costOf.get(a) || (TIER_VALUE[dex.species[b].tier] - TIER_VALUE[dex.species[a].tier]));
  const chosen = [];
  for (const maxOverlap of [0.5, 0.67, 1]) {
    for (const c of candidates) {
      if (chosen.length >= nPlans) break;
      if (chosen.includes(c)) continue;
      const first = order(c.ids)[0];
      if (chosen.some((p) => order(p.ids)[0] === first && maxOverlap < 1)) continue;
      if (chosen.some((p) => jaccard(p.ids, c.ids) > maxOverlap)) continue;
      chosen.push(c);
    }
  }

  const finalChecks = (ids) => CHECKS.map((c) => ({ c, n: ids.map((i) => dex.species[i]).filter(c.test).length }));
  const before = finalChecks(rosterIds);
  const plans = chosen.map((c, idx) => {
    const ids = order(c.ids);
    const after = finalChecks([...rosterIds, ...ids]);
    const fixes = after.filter((a, i) => a.n >= a.c.target && before[i].n < a.c.target).map((a) => a.c.label);
    const missing = after.filter((a) => a.n < a.c.target).map((a) => a.c.label);
    const stacked = weaknessMatrix(dex, [...rosterIds, ...ids]).filter((r) => r.stacked).map((r) => r.type);
    return {
      label: String.fromCharCode(65 + idx),
      name: `${dex.species[ids[0]].name} first`,
      // Reasons are relative to the roster plus the plan's earlier picks, so a gap is only "filled" once.
      picks: ids.map((id, i) => ({ id, cost: costOf.get(id), step: i === 0 ? 'Now' : 'Then', why: whyChips(dex, [...rosterIds, ...ids.slice(0, i)], id, threats) })),
      cost: c.cost, left: pointsLeft - c.cost, score: c.score, gain: +(c.score.total - base.total).toFixed(2),
      fixes, missing, stacked,
    };
  });

  // Best single picks: marginal set-score gain now, tagged with the plans they appear in.
  const singles = items.map((m) => {
    const sc = rosterScore(dex, [...rosterIds, m.id], weights, { threats, costs });
    return { id: m.id, cost: m.cost, gain: +(sc.total - base.total).toFixed(2), inPlans: plans.filter((p) => p.picks.some((x) => x.id === m.id)).map((p) => p.label), why: whyChips(dex, rosterIds, m.id, threats) };
  }).sort((a, b) => b.gain - a.gain);

  return { plans, singles, base, candidates: candidates.length };
}

/**
 * Verdict on one pick the coach is considering: the best complete plan that starts with `id`,
 * compared with the best complete plan overall. Pass `best` to reuse an existing buildPlans() result.
 */
export function checkPick(dex, rosterIds, available, slotsLeft, pointsLeft, id, { best, opponents = [], rosterCosts = {}, weights = DEFAULT_WEIGHTS } = {}) {
  const mon = available.find((m) => m.id === id);
  if (!mon) return { id, verdict: 'unavailable' };
  const aff = affordability(available, pointsLeft, slotsLeft).find((a) => a.id === id);
  if (aff.status === 'breaks') return { id, cost: mon.cost, verdict: 'breaks', reason: aff.reason };
  best ??= buildPlans(dex, rosterIds, available, slotsLeft, pointsLeft, { opponents, rosterCosts, weights });
  const threats = topThreatForms(dex, opponents);
  const costs = new Map([...Object.entries(rosterCosts), ...available.map((m) => [m.id, m.cost])]);
  const roster = [...rosterIds, id];
  let rest = [], total;
  if (slotsLeft > 1) {
    const r = buildPlans(dex, roster, available.filter((m) => m.id !== id), slotsLeft - 1, pointsLeft - mon.cost,
      { nPlans: 1, opponents, rosterCosts: { ...rosterCosts, [id]: mon.cost }, weights });
    if (!r.plans.length) return { id, cost: mon.cost, verdict: 'breaks', reason: 'No affordable way to fill the rest of your roster after this pick.' };
    rest = r.plans[0].picks.map((p) => ({ id: p.id, cost: p.cost }));
    total = r.plans[0].score.total;
  } else total = rosterScore(dex, roster, weights, { threats, costs }).total;
  const top = best.plans[0];
  const delta = +(total - (top ? top.score.total : total)).toFixed(2);
  return {
    id, cost: mon.cost, delta, aff, rest,
    verdict: delta >= -1 ? 'great' : delta >= -3 ? 'good' : delta >= -6 ? 'okay' : 'weak',
    rank: best.singles.findIndex((s) => s.id === id) + 1, of: best.singles.length,
    why: whyChips(dex, rosterIds, id, threats),
    left: pointsLeft - mon.cost - rest.reduce((s, p) => s + p.cost, 0),
    bestFirst: top && top.picks[0].id !== id ? top.picks[0].id : null,
    inPlans: best.plans.filter((p) => p.picks.some((x) => x.id === id)).map((p) => p.label),
  };
}

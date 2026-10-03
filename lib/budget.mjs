// Budget feasibility under the league rule: exactly 10 Pokémon on 100 points.
// A pick of cost c is allowed only if  pointsLeft − c ≥ sum of the cheapest (slotsLeft − 1) OTHER available costs.

/** Sum of the n cheapest costs (ascending array), skipping one index. Infinity if there are not enough. */
export function cheapestSum(n, costsAsc, skipIndex = -1) {
  if (n <= 0) return 0;
  let s = 0, k = 0;
  for (let i = 0; i < costsAsc.length && k < n; i++) { if (i === skipIndex) continue; s += costsAsc[i]; k++; }
  return k === n ? s : Infinity;
}

/**
 * Budget summary for one coach.
 * @param {number} pointsLeft @param {number} slotsLeft @param {number[]} availableCosts costs of every mon still available
 */
export function budgetSummary(pointsLeft, slotsLeft, availableCosts) {
  const asc = [...availableCosts].sort((a, b) => a - b);
  const reserve = cheapestSum(slotsLeft - 1, asc);
  const maxThisPick = slotsLeft <= 0 ? 0 : pointsLeft - reserve;
  const feasible = slotsLeft === 0 ? pointsLeft >= 0 : cheapestSum(slotsLeft, asc) <= pointsLeft;
  return {
    pointsLeft, slotsLeft, avgPerSlot: slotsLeft ? +(pointsLeft / slotsLeft).toFixed(1) : 0,
    reserve: Number.isFinite(reserve) ? reserve : null, maxThisPick: Number.isFinite(maxThisPick) ? Math.max(maxThisPick, 0) : 0,
    feasible, enoughMons: asc.length >= slotsLeft,
  };
}

/**
 * Per-mon affordability: 'breaks' (pick makes a full roster impossible), 'tight' (forces the rest down to
 * 1–2 point mons), or 'ok'. `available` = [{id, cost}], all still on the board.
 */
export function affordability(available, pointsLeft, slotsLeft) {
  const sorted = available.map((m, i) => ({ c: m.cost, i })).sort((a, b) => a.c - b.c);
  const asc = sorted.map((x) => x.c);
  const pos = new Map(sorted.map((x, j) => [x.i, j]));
  return available.map((m, i) => {
    if (slotsLeft <= 0) return { ...m, status: 'breaks', leftAfter: pointsLeft - m.cost, reason: 'Roster is full (10 of 10).' };
    const reserve = cheapestSum(slotsLeft - 1, asc, pos.get(i));
    const leftAfter = pointsLeft - m.cost;
    const restSlots = slotsLeft - 1;
    if (!Number.isFinite(reserve)) return { ...m, status: 'breaks', leftAfter, reason: `Not enough Pokémon left on the board to fill ${restSlots} more slots.` };
    if (leftAfter < reserve) {
      return { ...m, status: 'breaks', leftAfter, reason: `Costs ${m.cost}; you can spend at most ${pointsLeft - reserve}. You'd have ${leftAfter} pts for ${restSlots} slots, below the ${reserve}-pt minimum.` };
    }
    const avgAfter = restSlots ? leftAfter / restSlots : Infinity;
    if (restSlots && avgAfter < 2) return { ...m, status: 'tight', leftAfter, reason: `Leaves ${leftAfter} pts for ${restSlots} slots (avg ${avgAfter.toFixed(1)}).` };
    return { ...m, status: 'ok', leftAfter, reason: restSlots ? `Leaves ${leftAfter} pts for ${restSlots} slots (avg ${avgAfter.toFixed(1)}).` : `Leaves ${leftAfter} pts. Roster complete.` };
  });
}

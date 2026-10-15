// Budget feasibility + top-N roster completion (exact-count knapsack). Pure functions, browser-safe.
// League: 10 Pokémon per coach, 100 points. Score is supplied by the caller (e.g. usage%, custom rating).

// A pick is feasible iff pointsLeft - cost >= sum of the cheapest (slotsLeft - 1) OTHER available costs.
export function minCostFor(n, costsSortedAsc, excludeIndex = -1) {
  let s = 0, k = 0;
  for (let i = 0; i < costsSortedAsc.length && k < n; i++) { if (i === excludeIndex) continue; s += costsSortedAsc[i]; k++; }
  return k === n ? s : Infinity; // not enough mons left to fill the roster
}
export function feasiblePicks(available, slotsLeft, pointsLeft) {
  const sorted = available.map((m, i) => ({ c: m.cost, i })).sort((a, b) => a.c - b.c);
  const costs = sorted.map((x) => x.c), pos = new Map(sorted.map((x, j) => [x.i, j]));
  return available.map((m, i) => {
    const reserve = minCostFor(slotsLeft - 1, costs, pos.get(i));
    return { ...m, feasible: slotsLeft > 0 && pointsLeft - m.cost >= reserve, maxAfter: pointsLeft - m.cost - reserve };
  });
}

// dp[k][p] = top-N partial rosters using exactly k mons with total cost exactly p. O(items * slots * points * N).
export function topRosters(available, slotsLeft, pointsLeft, N = 5) {
  const dp = Array.from({ length: slotsLeft + 1 }, () => Array.from({ length: pointsLeft + 1 }, () => []));
  dp[0][0] = [{ score: 0, picks: [] }];
  for (let i = 0; i < available.length; i++) {
    const { cost, score } = available[i];
    for (let k = slotsLeft; k >= 1; k--) {           // descending k: each mon used at most once (0/1 knapsack)
      for (let p = pointsLeft; p >= cost; p--) {
        const from = dp[k - 1][p - cost]; if (!from.length) continue;
        const merged = dp[k][p].concat(from.map((r) => ({ score: r.score + score, picks: [...r.picks, i] })));
        merged.sort((a, b) => b.score - a.score); dp[k][p] = merged.slice(0, N);
      }
    }
  }
  const all = dp[slotsLeft].flatMap((list, p) => list.map((r) => ({ ...r, cost: p })));
  return all.sort((a, b) => b.score - a.score || a.cost - b.cost).slice(0, N)
    .map((r) => ({ score: +r.score.toFixed(2), cost: r.cost, left: pointsLeft - r.cost, picks: r.picks.map((i) => available[i].id) }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // Live test: Anthony's state from the sheet, score = Smogon 1760 usage% of best form (base or any Mega).
  const { readFileSync } = await import('node:fs');
  const { fetchText, csvUrl, GID, parseBoardCsv, parseDraftsCsv } = await import('./sheet.mjs');
  const { makeNormalizer } = await import('./name-map.mjs');
  const dex = JSON.parse(readFileSync('psclient/pokedex.json', 'utf8'));
  const sm = JSON.parse(readFileSync('../species-megas.json', 'utf8')).species;
  const usage = JSON.parse(readFileSync('smogon/regmc-1760.slim.json', 'utf8')).species;
  const norm = makeNormalizer(dex);
  const [b, d] = await Promise.all([fetchText(csvUrl(GID.board)), fetchText(csvUrl(GID.drafts))]);
  const board = parseBoardCsv(b), coaches = parseDraftsCsv(d);
  const taken = new Set(coaches.flatMap((c) => c.picks.map((p) => norm(p.en).id)));
  const me = coaches.find((c) => c.name === 'Anthony');
  const slotsLeft = 10 - me.picks.length, pointsLeft = me.pointsLeft;
  const seen = new Set();
  const available = board.map((x) => ({ id: norm(x.en).id, cost: x.points })).filter((m) => m.id && !taken.has(m.id) && !seen.has(m.id) && seen.add(m.id))
    .map((m) => ({ ...m, score: Math.max(0, ...[m.id, ...(sm[m.id]?.megas || []).map((f) => f.id)].map((f) => usage[f]?.usage || 0)) }));
  console.log({ coach: me.name, have: me.picks.map((p) => p.en), slotsLeft, pointsLeft, available: available.length });
  const f = feasiblePicks(available, slotsLeft, pointsLeft);
  const inf = f.filter((m) => !m.feasible);
  console.log('infeasible picks now:', inf.length, 'max feasible cost:', Math.max(...f.filter((m) => m.feasible).map((m) => m.cost)));
  let t = performance.now(); const top = topRosters(available, slotsLeft, pointsLeft, 5);
  console.log(`topRosters ${(performance.now() - t).toFixed(0)}ms`); console.log(top);
  // Brute-force cross-check on a small random instance
  const small = Array.from({ length: 14 }, (_, i) => ({ id: 'm' + i, cost: 1 + ((i * 7) % 9), score: (i * 13) % 11 }));
  const bf = []; const rec = (s, k, c, sc, ids) => { if (k === 0) { bf.push(sc); return; } for (let i = s; i < small.length; i++) if (c + small[i].cost <= 20) rec(i + 1, k - 1, c + small[i].cost, sc + small[i].score, ids); };
  rec(0, 4, 0, 0, []); bf.sort((a, b) => b - a);
  const dpTop = topRosters(small, 4, 20, 5).map((r) => r.score);
  console.log('brute-force check (top-5 scores equal):', JSON.stringify(bf.slice(0, 5)) === JSON.stringify(dpTop), bf.slice(0, 5), dpTop);
}

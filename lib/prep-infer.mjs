// What reveals tell you, with their conditions. Derived, never typed, never stored. An inference that depends on a league
// rule you haven't confirmed says so ("If item clause: …"); a Speed bound lists what could break it; a single HP
// observation is never turned into a read on their spread.

/**
 * Item-clause exclusions from revealed items. rules.itemClause: 'on' -> plain; 'unknown' -> conditional; 'off' -> none.
 * reveals: [{speciesId, kind:'item', value}]. Returns [{item, holder, conditional}].
 */
export function itemClauseExclusions(reveals, rules) {
  const ic = rules?.rules?.itemClause?.value ?? 'unknown';
  if (ic === 'off') return [];
  const seen = new Map();
  for (const r of reveals ?? []) if (r.kind === 'item' && r.value && !seen.has(r.value)) seen.set(r.value, r.speciesId);
  return [...seen].map(([item, holder]) => ({ item, holder, conditional: ic !== 'on' }));
}

/**
 * A Speed bound from move order within one priority bracket. reveal.kind 'moved-before' (they moved before your mon) or
 * 'moved-after'; context: {myStat (your effective Speed then), priority:'same'|'unknown', trickRoom, tailwindThem, tailwindMe,
 * para (them)}. Returns {bound:'min'|'max', value, tiePossible, breaks:[conditions], onEffectiveSpeed} or {none: reason}.
 */
export function speedBound(reveal, ctx = {}) {
  if (ctx.priority !== 'same') return { none: 'priority-unknown' };
  if (!Number.isInteger(ctx.myStat)) return { none: 'your-speed-unknown' };
  const before = reveal.kind === 'moved-before';
  // Without Trick Room, moving first means at least as fast (a tie can go either way); under Trick Room, at most as fast.
  const bound = before !== !!ctx.trickRoom ? 'min' : 'max';
  const breaks = ['priority', 'choicescarf', 'quickclaw'];
  if (ctx.tailwindThem || ctx.tailwindMe) breaks.push('tailwind-applied');
  if (ctx.para) breaks.push('paralysis-applied');
  return { bound, value: ctx.myStat, tiePossible: true, breaks, onEffectiveSpeed: true };
}

/** How a bound narrows their range: 'not-minimum' / 'not-maximum' / 'inside' / 'contradicts' (check the conditions). */
export function boundVsRange(b, range) {
  if (!b || b.none || !range) return null;
  if (b.bound === 'min') return b.value > range.max ? 'contradicts' : b.value > range.min ? 'not-minimum' : 'inside';
  return b.value < range.min ? 'contradicts' : b.value < range.max ? 'not-maximum' : 'inside';
}

/** Their revealed facts per species (for the two-way ledger). */
export function ledgerThem(reveals) {
  const by = new Map();
  for (const r of reveals ?? []) {
    if (r.side === 'mine') continue;
    if (!by.has(r.speciesId)) by.set(r.speciesId, []);
    by.get(r.speciesId).push(r);
  }
  return by;
}
/** What they have seen of you, from your logged games and reveals. */
export function ledgerMe(reveals) {
  return (reveals ?? []).filter((r) => r.side === 'mine');
}

/** Surprises after a match: reveals that match no variant field and no plan member. */
export function surprises(reveals, ws, setsFor) {
  return (reveals ?? []).filter((r) => {
    if (r.side === 'mine') return false;
    if (r.kind === 'bring' || r.kind === 'lead') return !(ws.plans ?? []).some((p) => (p.members ?? []).includes(r.speciesId));
    const sets = setsFor(r.speciesId);
    if (r.kind === 'move') return !sets.some((s) => s.moves.includes(r.value));
    if (r.kind === 'item') return !sets.some((s) => s.item === r.value);
    if (r.kind === 'ability') return !sets.some((s) => s.ability === r.value);
    return false;
  });
}

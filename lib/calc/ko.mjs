// Exact KO odds over a fixed, fully specified sequence of damage events. Pure; no engine.
// Semantics follow the pinned simulator (verified there by playing every roll combination as real battles):
//   * each hit draws one of 16 equally likely rolls, independently per hit, per target and per attacker;
//   * 2–5-hit moves hit 2/3/4/5 times with weights 7/7/3/3 (out of 20);
//   * Focus Sash: at full HP, a hit that would KO leaves 1 HP, then the Sash is gone;
//   * Sturdy: the same without being used up, ignored by Mold Breaker;
//   * Sitrus Berry: right after a hit leaves the holder at or below half HP, it heals ⌊max/4⌋ once (before the next hit or
//     attacker, and not if the hit KOs);
//   * Leftovers-style healing happens only between turns (`heal` after a use), never between same-turn hits;
//   * a resist berry or Multiscale only changes the first hit; Disguise turns the first damaging hit into a fixed chip.
// Weights are exact BigInt integers over a common denominator; results are reduced fractions (strings), never floats.

const gcd = (a, b) => { while (b) [a, b] = [b, a % b]; return a; };
const keyOf = (s) => `${s.hp}|${+s.sitrus}|${+s.sash}|${+s.berry}|${+s.disguise}`;
const parse = (k) => { const [hp, a, b, c, d] = k.split('|'); return { hp: +hp, sitrus: a === '1', sash: b === '1', berry: c === '1', disguise: d === '1' }; };

/**
 * defender: { maxHP, hp?, sitrus?, sash?, sturdy?, berry?, disguise? }
 * uses: [{ variant(flags) -> { dist: [{ w, hits: [[16 rolls] per hit] }], critHits?: [[16]...] },
 *          critNum?, critDen?, moldBreaker?, consumesBerry?, breaksDisguise?, heal? }]
 *   flags = { full, berry, disguise } at the start of the use. heal = HP restored after the use if still standing.
 * Returns { num, den, ko (float, for display only), afterEach: [{num, den}], survivors: [[hp, num/den float]] }.
 */
export function koOdds(defender, uses) {
  const max = defender.maxHP;
  if (!Number.isInteger(max) || max < 1) throw new Error('koOdds: maxHP must be a positive integer');
  let states = new Map([[keyOf({ hp: defender.hp ?? max, sitrus: !!defender.sitrus, sash: !!defender.sash, berry: !!defender.berry, disguise: !!defender.disguise }), 1n]]);
  let den = 1n, fainted = 0n;
  const afterEach = [];
  for (const use of uses) {
    if (!states.size) { afterEach.push(afterEach.at(-1) ?? { num: '1', den: '1' }); continue; } // already KO'd on every path
    const cn = BigInt(use.critNum ?? 0), cd = BigInt(use.critDen ?? 1);
    const perHit = 16n * cd;
    const variants = new Map();
    const variantFor = (s) => {
      const k = `${s.hp === max}|${s.berry}|${s.disguise}`;
      if (!variants.has(k)) variants.set(k, use.variant({ full: s.hp === max, berry: s.berry, disguise: s.disguise }));
      return variants.get(k);
    };
    // Common denominator for this use: (sum of hit-count weights) × perHit^(most hits).
    let maxN = 0, W = 0n;
    for (const s of states.keys()) {
      const v = variantFor(parse(s));
      const w = v.dist.reduce((t, d) => t + BigInt(d.w), 0n);
      W = W > w ? W : w;
      for (const d of v.dist) maxN = Math.max(maxN, d.hits.length);
    }
    for (const s of states.keys()) {
      const v = variantFor(parse(s));
      if (v.dist.reduce((t, d) => t + BigInt(d.w), 0n) !== W) throw new Error('koOdds: hit-count weights must share one total per use');
    }
    const useDen = W * perHit ** BigInt(maxN);
    const next = new Map();
    fainted *= useDen;
    for (const [k, w0] of states) {
      const start = parse(k);
      const v = variantFor(start);
      for (const d of v.dist) {
        // Walk the hits of this hit count; paths: [state, weight]
        let paths = [[{ ...start }, w0 * BigInt(d.w)]];
        for (let h = 0; h < d.hits.length; h++) {
          const outcomes = d.hits[h].map((dmg) => [dmg, cd - cn]);
          if (cn > 0n) {
            if (!v.critHits?.[h]) throw new Error('koOdds: crit odds need crit rolls');
            for (const dmg of v.critHits[h]) outcomes.push([dmg, cn]);
          }
          const stepped = [];
          for (const [s, w] of paths) {
            for (const [dmg, ow] of outcomes) {
              const t = { ...s };
              const full = t.hp === max;
              if (full && dmg >= t.hp && t.sash) { t.hp = 1; t.sash = false; }
              else if (full && dmg >= t.hp && defender.sturdy && !use.moldBreaker) t.hp = 1;
              else t.hp -= dmg;
              if (h === 0) { // first hit of the move: one-time effects
                if (use.consumesBerry && t.berry) t.berry = false;
                if (use.breaksDisguise && t.disguise) t.disguise = false;
              }
              const remaining = BigInt(d.hits.length - h - 1);
              if (t.hp <= 0) { fainted += w * ow * perHit ** (BigInt(maxN - d.hits.length) + remaining); continue; }
              if (t.sitrus && t.hp <= max / 2) { t.hp = Math.min(max, t.hp + Math.trunc(max / 4)); t.sitrus = false; }
              stepped.push([t, w * ow]);
            }
          }
          paths = merge(stepped);
        }
        const pad = perHit ** BigInt(maxN - d.hits.length);
        for (const [s, w] of paths) {
          if (use.heal) s.hp = Math.min(max, s.hp + use.heal);
          const nk = keyOf(s);
          next.set(nk, (next.get(nk) ?? 0n) + w * pad);
        }
      }
    }
    states = next;
    den *= useDen;
    const g = gcd(fainted, den) || 1n;
    afterEach.push({ num: String(fainted / g), den: String(den / g) });
  }
  const g = gcd(fainted, den) || 1n;
  const num = fainted / g, d = den / g;
  return {
    num: String(num), den: String(d), ko: Number(num) / Number(d), afterEach,
    survivors: [...states].map(([k, w]) => [parse(k).hp, Number(w) / Number(den)]).sort((a, b) => a[0] - b[0]),
  };
}

function merge(paths) {
  const m = new Map();
  for (const [s, w] of paths) {
    const k = keyOf(s);
    const cur = m.get(k);
    if (cur) cur[1] += w; else m.set(k, [s, w]);
  }
  return [...m.values()];
}

/** Hit-count weights for a move's multihit field (Champions: 2–5 → 7/7/3/3 of 20). */
export function hitDistribution(multihit, { skillLink = false, fixedHits = null } = {}) {
  if (fixedHits) return [{ n: fixedHits, w: 1 }];
  if (!multihit) return [{ n: 1, w: 1 }];
  if (typeof multihit === 'number') return [{ n: multihit, w: 1 }];
  const [lo, hi] = multihit;
  if (skillLink) return [{ n: hi, w: 1 }];
  if (lo === 2 && hi === 5) return [{ n: 2, w: 7 }, { n: 3, w: 7 }, { n: 4, w: 3 }, { n: 5, w: 3 }];
  return [{ n: hi, w: 1 }];
}

/** "k of n" helpers for display. */
export const countAtLeast = (rolls, hp) => rolls.filter((r) => r >= hp).length;
export function reduce(num, den) {
  const a = BigInt(num), b = BigInt(den), g = gcd(a, b) || 1n;
  return { num: String(a / g), den: String(b / g) };
}

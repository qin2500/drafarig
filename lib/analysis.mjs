// Team analysis: type matchups (all forms), role checklist, speed, threats, and the roster score used by plans.
// Pure functions over data/dex.json. Heuristics are labelled as estimates in the UI.

export const TIER_VALUE = { S: 10, A: 8, B: 5, C: 3, D: 1 };

// Abilities that change type matchups. Applied only when the form has exactly one possible ability
// (e.g. Rotom forms, every Mega), because otherwise the set may not run it.
export const ABILITY_MODS = {
  Levitate: { immune: ['Ground'] }, 'Earth Eater': { immune: ['Ground'] },
  'Flash Fire': { immune: ['Fire'] }, 'Well-Baked Body': { immune: ['Fire'] },
  'Water Absorb': { immune: ['Water'] }, 'Storm Drain': { immune: ['Water'] }, 'Dry Skin': { immune: ['Water'] },
  'Volt Absorb': { immune: ['Electric'] }, 'Lightning Rod': { immune: ['Electric'] }, 'Motor Drive': { immune: ['Electric'] },
  'Sap Sipper': { immune: ['Grass'] },
  'Thick Fat': { halve: ['Fire', 'Ice'] }, Heatproof: { halve: ['Fire'] }, 'Water Bubble': { halve: ['Fire'] },
  'Purifying Salt': { halve: ['Ghost'] }, Fluffy: { double: ['Fire'] },
};

export function formAbility(form) { return form.abilities.length === 1 ? form.abilities[0] : null; }

/** Damage multiplier of an attacking type against a form (type chart + single-ability modifiers). */
export function effectiveness(dex, atk, form) {
  let m = 1;
  for (const t of form.types) m *= dex.typechart[atk][t];
  const mod = ABILITY_MODS[formAbility(form)];
  if (mod?.immune?.includes(atk)) m = 0;
  if (mod?.halve?.includes(atk)) m /= 2;
  if (mod?.double?.includes(atk)) m *= 2;
  return m;
}

// ---------- Speed (Champions, Lv 50, Stat Points) ----------
export const speedStat = (base, mode = 'max') =>
  mode === 'max' ? Math.floor((base + 52) * 1.1) : mode === 'neutral' ? base + 52 : Math.floor((base + 20) * 0.9);
export const isSlow = (mon, form) => mon.roles.includes('tr-abuser') || form.baseStats.spe <= 55;

/** Speed ladder rows for a list of species ids. */
export function speedRows(dex, ids, { tailwind = false, trickRoom = false, side = 'mine' } = {}) {
  const rows = [];
  for (const id of ids) {
    const mon = dex.species[id]; if (!mon) continue;
    for (const f of mon.forms) {
      const slow = isSlow(mon, f);
      let v = slow && trickRoom ? speedStat(f.baseStats.spe, 'min') : speedStat(f.baseStats.spe, 'max');
      if (tailwind) v *= 2;
      rows.push({ id, form: f.name, mega: !!f.mega, base: f.baseStats.spe, speed: v, invest: slow && trickRoom ? 'min Speed' : 'max Speed', side });
    }
  }
  rows.sort((a, b) => (trickRoom ? a.speed - b.speed : b.speed - a.speed));
  for (let i = 0; i < rows.length; i++) rows[i].tie = rows.some((r, j) => j !== i && r.speed === rows[i].speed && r.id !== rows[i].id);
  return rows;
}

// ---------- Weakness matrix ----------
export function weaknessMatrix(dex, ids) {
  const mons = ids.map((id) => dex.species[id]).filter(Boolean);
  return dex.types.map((atk) => {
    const cells = mons.map((m) => {
      const forms = m.forms.map((f) => ({ form: f.name, mult: effectiveness(dex, atk, f) }));
      const worst = Math.max(...forms.map((x) => x.mult)), best = Math.min(...forms.map((x) => x.mult));
      return { id: m.id, forms, worst, best, varies: worst !== best };
    });
    const weak = cells.filter((c) => c.worst >= 2).length;
    const resist = cells.filter((c) => c.best > 0 && c.best <= 0.5).length;
    const immune = cells.filter((c) => c.best === 0).length;
    return { type: atk, cells, weak, resist, immune, net: resist + immune - weak, stacked: weak >= 3 && resist + immune === 0 };
  });
}

// ---------- Role checklist (from draft-strategy.md §3, automatable rows) ----------
const anyForm = (m, fn) => m.forms.some(fn);
export const CHECKS = [
  { key: 'mega', label: 'Primary Mega', term: 'Mega Evolution', target: 1, weight: 6, test: (m) => m.roles.includes('mega') && 'SA'.includes(m.tier), note: 'A Mega on an S/A-tier mon. Only one Mega per battle, so a second is a backup.' },
  { key: 'speed', label: 'Speed control', term: 'Speed control', target: 3, weight: 6, test: (m) => ['tailwind', 'trick-room', 'speed-drop', 'prankster'].some((r) => m.roles.includes(r)) },
  { key: 'fakeout', label: 'Fake Out', term: 'Fake Out', target: 2, weight: 6, test: (m) => m.roles.includes('fake-out') },
  { key: 'intimidate', label: 'Intimidate', term: 'Intimidate', target: 1, ideal: 2, weight: 5, test: (m) => m.roles.includes('intimidate') },
  { key: 'redirect', label: 'Redirection or Wide Guard', term: 'Redirection', target: 1, weight: 4, test: (m) => m.roles.includes('redirection') || m.roles.includes('wide-guard') },
  { key: 'antitr', label: 'Answer to Trick Room', term: 'Trick Room', target: 2, weight: 4, test: (m) => ['trick-room', 'tr-abuser', 'prankster'].some((r) => m.roles.includes(r)) || (m.roles.includes('disruption') && m.keyMoves.some((k) => /Taunt|Imprison|Encore/.test(k))), note: 'Trick Room of your own, Prankster, a slow hitter, or Taunt / Imprison / Encore.' },
  { key: 'antifast', label: 'Answer to Tailwind / fast teams', term: 'Tailwind', target: 2, weight: 4, test: (m) => ['tailwind', 'trick-room', 'priority', 'speed-drop'].some((r) => m.roles.includes(r)) },
  { key: 'weather', label: 'Own weather setter', term: 'Weather (rain / sun / sand / snow)', target: 1, weight: 4, test: (m) => m.roles.some((r) => /-setter$/.test(r) && r !== 'terrain-setter') },
  { key: 'terrain', label: 'Terrain setter', term: 'Weather (rain / sun / sand / snow)', target: 1, weight: 1, test: (m) => m.roles.includes('terrain-setter') },
  { key: 'spread', label: 'Spread damage', term: 'Spread move', target: 3, weight: 4, test: (m) => m.roles.includes('spread-attacker') },
  { key: 'physical', label: 'Physical attackers', term: 'STAB', target: 2, weight: 2, test: (m) => m.roles.includes('physical-attacker') },
  { key: 'special', label: 'Special attackers', term: 'STAB', target: 2, weight: 2, test: (m) => m.roles.includes('special-attacker') },
  { key: 'priority', label: 'Priority attack', term: 'Priority', target: 1, weight: 2, test: (m) => m.roles.includes('priority') },
  { key: 'antifakeout', label: 'Ghost-type or Inner Focus (Fake Out immune)', term: 'Fake Out', target: 1, weight: 1, test: (m) => anyForm(m, (f) => f.types.includes('Ghost') || f.abilities.includes('Inner Focus')) },
];

export function roleChecklist(dex, ids) {
  const mons = ids.map((id) => dex.species[id]).filter(Boolean);
  return CHECKS.map((c) => {
    const holders = mons.filter(c.test).map((m) => m.name);
    return { key: c.key, label: c.label, term: c.term, target: c.target, ideal: c.ideal, weight: c.weight, note: c.note, count: holders.length, holders, met: holders.length >= c.target };
  });
}

// Attacking types that matter most in M-C (draft-strategy.md check 12).
export const META_TYPES = ['Grass', 'Fighting', 'Poison', 'Fire', 'Water', 'Dragon', 'Flying', 'Dark', 'Steel', 'Ghost', 'Fairy', 'Electric', 'Ground', 'Rock', 'Normal'];

// ---------- Roster score (set function used to rank plans) ----------
// Weights reviewed by the strategy agent (2026-10-02): diminishing role credit, species clause, bring-6 value,
// per-mon Mega discount, form-aware weaknesses, and coverage of opponents' A/S-tier threats.
// price: the board price is the league's own value estimate, and unspent points are worth nothing at the end.
export const DEFAULT_WEIGHTS = { value: 1, roles: 1, defense: 1, threats: 1, price: 0.5 };

const geo = (n) => { let s = 0; for (let i = 0; i < n; i++) s += 0.5 ** i; return s; };
/** Role credit with diminishing returns; holders past max(target, 2) add only 0.1× of their share. */
export function roleCredit(n, target, weight) {
  let s = 0;
  for (let i = 0; i < n; i++) s += 0.5 ** i * (i >= Math.max(target, 2) ? 0.1 : 1);
  return weight * Math.min(1.5, s / geo(target));
}

/** One mon per dex number (species clause): keep the best-tier mon, the rest are duplicates. */
export function speciesClauseSplit(mons) {
  const best = new Map();
  for (const m of mons) { const b = best.get(m.num); if (!b || TIER_VALUE[m.tier] > TIER_VALUE[b.tier]) best.set(m.num, m); }
  const kept = [...best.values()];
  return { kept, dups: mons.filter((m) => !kept.includes(m)) };
}

/** Opponent A/S-tier forms, for the threat-coverage term. opponents = [{coach, ids}] */
export function topThreatForms(dex, opponents = []) {
  return opponents.flatMap((o) => o.ids).map((id) => dex.species[id]).filter((m) => m && 'SA'.includes(m.tier));
}

/** Breakdown of a roster's score. Higher is better. ctx.threats = topThreatForms(...), ctx.costs = Map(id -> board points) (both optional). */
export function rosterScore(dex, ids, w = DEFAULT_WEIGHTS, ctx = {}) {
  const all = ids.map((id) => dex.species[id]).filter(Boolean);
  const { kept: mons, dups } = speciesClauseSplit(all);
  // Value: only 6 are brought each week -> top 6 at full value, the rest at 0.35x.
  // Megas count per mon (Charizard's X and Y are one pick): 2nd Mega mon x0.75, 3rd+ x0.6.
  let megas = 0;
  const vals = [...mons].sort((a, b) => TIER_VALUE[b.tier] - TIER_VALUE[a.tier]).map((m) => {
    let v = TIER_VALUE[m.tier] ?? 1;
    if (m.roles.includes('mega') && 'SA'.includes(m.tier)) { megas++; if (megas === 2) v *= 0.75; if (megas > 2) v *= 0.6; }
    return v;
  }).sort((a, b) => b - a);
  let value = vals.reduce((a, v, i) => a + (i < 6 ? v : 0.35 * v), 0);
  value -= dups.length * 3; // a second Tauros/Rotom/... can never share a team with the first
  let roles = 0;
  for (const c of CHECKS) {
    const n = mons.filter(c.test).length;
    roles += roleCredit(n, c.target, c.weight);
    if (c.ideal && n >= c.ideal) roles += c.weight * 0.1;
  }
  const weathers = new Set(mons.flatMap((m) => m.roles.filter((r) => /-setter$/.test(r) && r !== 'terrain-setter')));
  if (weathers.size >= 2) roles += 0.5 * CHECKS.find((c) => c.key === 'weather').weight * 0.5;
  // Defense: a mon is fully weak if every form is weak, half-weak if only some forms are (you pick the form).
  let defense = 0;
  for (const atk of dex.types) {
    let weak = 0, cover = 0, quad = 0;
    for (const m of mons) {
      const ms = m.forms.map((f) => effectiveness(dex, atk, f));
      const worst = Math.max(...ms), best = Math.min(...ms);
      if (best >= 2) weak += 1; else if (worst >= 2) weak += 0.5;
      if (best <= 0.5) cover += 1;
      if (ms[0] >= 4) quad += 1;
    }
    defense -= Math.max(0, weak - cover - 1) * 1.5 + quad;
    if (weak >= 3 && cover === 0) defense -= 4;
    if (META_TYPES.includes(atk) && cover >= 2) defense += 1;
  }
  // Threat coverage: each opponent A/S mon should have at least one of my mons resisting/immune to all its STABs.
  let threats = 0;
  for (const t of ctx.threats || []) {
    const covered = t.forms.every((tf) => mons.some((m) => m.forms.some((mf) => tf.types.every((ty) => effectiveness(dex, ty, mf) <= 0.5))));
    if (!covered) threats -= 3;
  }
  const price = ctx.costs ? mons.reduce((a, m) => a + (ctx.costs.get(m.id) || 0), 0) : 0;
  const total = w.value * value + w.roles * roles + w.defense * defense + (w.threats ?? 1) * threats + (w.price ?? 0) * price;
  return { total: +total.toFixed(2), value: +value.toFixed(1), roles: +roles.toFixed(1), defense: +defense.toFixed(1), threats, price };
}

// ---------- Threats ----------
const stabTypes = (f) => f.types;
const hitsSE = (dex, attacker, defender) => stabTypes(attacker).some((t) => effectiveness(dex, t, defender) >= 2);
const resistsAll = (dex, defender, attacker) => stabTypes(attacker).every((t) => effectiveness(dex, t, defender) <= 0.5);

/**
 * Opponent threats against my roster. A mon of mine "answers" a threat form if one of its forms either
 * outspeeds it (both at max Speed) and hits it super-effectively with STAB, or resists all its STAB types.
 * Status per threat = worst over the threat's forms: Answered (≥2 answers), Thin (1), Unchecked (0).
 */
export function threatList(dex, myIds, opponents /* [{coach, ids}] */) {
  const mine = myIds.map((id) => dex.species[id]).filter(Boolean);
  const out = [];
  for (const { coach, ids } of opponents) for (const id of ids) {
    const t = dex.species[id]; if (!t) continue;
    let worst = null;
    for (const tf of t.forms) {
      const tSpe = speedStat(tf.baseStats.spe);
      const answers = [], victims = [];
      for (const m of mine) {
        const ans = m.forms.some((mf) => (speedStat(mf.baseStats.spe) > tSpe && hitsSE(dex, mf, tf)) || resistsAll(dex, mf, tf));
        if (ans) answers.push(m.name);
        if (m.forms.every((mf) => hitsSE(dex, tf, mf))) victims.push(m.name);
      }
      const outspeeds = mine.filter((m) => m.forms.every((mf) => speedStat(mf.baseStats.spe) < tSpe)).length;
      const cand = { form: tf.name, answers, victims, outspeeds };
      if (!worst || answers.length < worst.answers.length || (answers.length === worst.answers.length && victims.length > worst.victims.length)) worst = cand;
    }
    const n = worst.answers.length;
    const status = n >= 2 ? 'Answered' : n === 1 ? 'Thin' : 'Unchecked';
    const danger = (TIER_VALUE[t.tier] ?? 1) + worst.victims.length * 2 + (status === 'Unchecked' ? 4 : status === 'Thin' ? 2 : 0);
    const why = `${worst.form}: ${t.forms.find((f) => f.name === worst.form).types.join('/')} STAB hits ${worst.victims.length} of your mons super-effectively` +
      (worst.outspeeds ? `; outspeeds ${worst.outspeeds} of them` : '') + '.';
    out.push({ id, coach, name: t.name, tier: t.tier, form: worst.form, status, answers: worst.answers, victims: worst.victims, why, danger });
  }
  return out.sort((a, b) => b.danger - a.danger);
}

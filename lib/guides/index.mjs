// Matchup guides (docs/research/strategy/guide-schema.md v1): curated, matchup-specific advice injected into the app's own
// screens. One file per matchup, lib/guides/<pov>v<opp>.mjs, imported here statically (no build step: lib/ is served and
// inlined as is). Validation is tolerant: a malformed section is dropped and reported, the rest still renders.
import { toID } from '../calc/mech.mjs';
import g5v3 from './5v3.mjs'; // Week 3: Anthony vs ZhuZi

// Add a guide: import it and list it. Tests add fixtures with registerGuide (the same module instance the app imports).
export const GUIDES = [g5v3];
export const registerGuide = (g) => { GUIDES.push(g); return () => { const i = GUIDES.indexOf(g); if (i >= 0) GUIDES.splice(i, 1); }; };

const str = (x) => typeof x === 'string' && x.trim() !== '';
const strs = (x) => (Array.isArray(x) ? x.filter(str) : []);
const ids = (x) => (Array.isArray(x) ? x.map((v) => toID(v)).filter(Boolean) : []);
const RANGE = /^\d+(\.\d+)?–\d+(\.\d+)?%$/;

/**
 * Validate and normalise a guide. mech (optional) checks species and move ids. Returns { guide, problems:[text] }; guide is
 * null only when the header (version 1, pov, opp, coach) is unusable. Unknown or malformed entries are dropped, not fatal.
 */
export function validateGuide(raw, mech = null) {
  const problems = [];
  const g = raw && typeof raw === 'object' ? raw : null;
  if (!g || g.version !== 1 || !Number.isInteger(g.pov) || !Number.isInteger(g.opp) || !str(g.coach)) return { guide: null, problems: ['header: needs version 1, pov, opp and coach'] };
  const sp = (id) => !mech || !!mech.species[id];
  const mv = (id) => !mech || !!mech.moves[id];
  const keep = (section, list, ok) => list.filter((x, i) => { const good = ok(x); if (!good) problems.push(`${section}[${i}] dropped`); return good; });
  const out = { version: 1, pov: g.pov, opp: g.opp, coach: g.coach.trim(), week: Number.isInteger(g.week) ? g.week : null, written: str(g.written) ? g.written : null,
    assumptions: strs(g.assumptions), remember: strs(g.remember).slice(0, 6), endgame: strs(g.endgame) };
  if (g.bring && typeof g.bring === 'object') {
    const six = ids(g.bring.six).filter(sp);
    out.bring = { six, bench: keep('bring.bench', Array.isArray(g.bring.bench) ? g.bring.bench : [], (b) => sp(toID(b?.id))).map((b) => ({ id: toID(b.id), why: str(b.why) ? b.why : '' })),
      mega: g.bring.mega && sp(toID(g.bring.mega.id)) ? { id: toID(g.bring.mega.id), why: str(g.bring.mega.why) ? g.bring.mega.why : '' } : null };
  }
  out.previews = keep('previews', Array.isArray(g.previews) ? g.previews : [], (p) => str(p?.if)).map((p) => ({ if: p.if, bring4: ids(p.bring4).filter(sp), lead: ids(p.lead).filter(sp), note: str(p.note) ? p.note : '' }));
  out.leads = keep('leads', Array.isArray(g.leads) ? g.leads : [], (l) => ids(l?.ours).length === 2 && ids(l.ours).every(sp)).map((l) => ({ ours: ids(l.ours), vs: ids(l.vs).filter(sp), t1: str(l.t1) ? l.t1 : '', t2: str(l.t2) ? l.t2 : '', t3: str(l.t3) ? l.t3 : '', ifs: strs(l.ifs) }));
  out.tells = keep('tells', Array.isArray(g.tells) ? g.tells : [], (t) => str(t?.see) && str(t.do)).map((t) => ({ see: t.see, means: str(t.means) ? t.means : '', do: t.do }));
  out.lose = keep('lose', Array.isArray(g.lose) ? g.lose : [], (l) => str(l?.how)).map((l) => ({ how: l.how, fix: str(l.fix) ? l.fix : '' }));
  const combo = (c) => Array.isArray(c?.attackers) && c.attackers.length >= 2 && c.attackers.every((a) => Array.isArray(a) && sp(toID(a[0])) && mv(toID(a[1]))) && sp(toID(c.into));
  const normCombo = (c) => ({ attackers: c.attackers.map(([s, m]) => [toID(s), toID(m)]), into: toID(c.into), range: str(c.range) ? c.range : '', answer: str(c.answer) ? c.answer : '', verdict: str(c.verdict) ? c.verdict : '' });
  out.combos = { theirs: keep('combos.theirs', Array.isArray(g.combos?.theirs) ? g.combos.theirs : [], combo).map(normCombo), ours: keep('combos.ours', Array.isArray(g.combos?.ours) ? g.combos.ours : [], combo).map(normCombo) };
  const side = (x) => x && sp(toID(x.id)) && ['ours', 'ladder', 'worst'].includes(x.set);
  out.calcs = keep('calcs', Array.isArray(g.calcs) ? g.calcs : [], (c) => side(c?.attacker) && side(c.defender) && mv(toID(c.move)) && (c.attacker.set === 'ours') !== (c.defender.set === 'ours'))
    .map((c) => ({ attacker: { ...c.attacker, id: toID(c.attacker.id) }, defender: { ...c.defender, id: toID(c.defender.id) }, move: toID(c.move), field: c.field && typeof c.field === 'object' ? c.field : {},
      range: str(c.range) && RANGE.test(c.range.trim()) ? c.range.trim() : str(c.range) ? c.range : '', verdict: str(c.verdict) ? c.verdict : '', why: str(c.why) ? c.why : '' }));
  out.perMon = {};
  for (const [k, v] of Object.entries(g.perMon && typeof g.perMon === 'object' ? g.perMon : {})) {
    const id = toID(k);
    if (!sp(id) || !v || typeof v !== 'object') { problems.push(`perMon.${k} dropped`); continue; }
    out.perMon[id] = Object.fromEntries(['role', 'worstCase', 'answer', 'job', 'avoid'].filter((f) => str(v[f])).map((f) => [f, v[f]]));
    out.perMon[id].notes = strs(v.notes);
  }
  out.sets = str(g.sets) ? g.sets : '';
  out.rosters = g.rosters && typeof g.rosters === 'object' ? { ours: ids(g.rosters.ours).filter(sp), theirs: ids(g.rosters.theirs).filter(sp) } : null;
  return { guide: out, problems };
}

/** The mons of THEIRS a guide was written about: its leads' "vs", their combos' attackers and perMon keys that aren't ours. */
export function guideTheirMons(guide, ourIds) {
  const ours = new Set([...(ourIds ?? []), ...(guide.bring?.six ?? []), ...(guide.bring?.bench ?? []).map((b) => b.id), ...guide.leads.flatMap((l) => l.ours)]);
  const out = new Set([...guide.leads.flatMap((l) => l.vs), ...guide.combos.theirs.flatMap((c) => c.attackers.map((a) => a[0])), ...guide.combos.ours.map((c) => c.into),
    ...Object.keys(guide.perMon).filter((id) => !ours.has(id))]);
  for (const id of ours) out.delete(id);
  return [...out];
}
/** Your mons a guide refers to: bring (six, bench, Mega), leads' ours, previews, our combos' attackers, perMon keys on your roster, calcs' ours. */
export function guideOurMons(guide, ourIds = []) {
  const roster = new Set(ourIds);
  return [...new Set([...(guide.bring?.six ?? []), ...(guide.bring?.bench ?? []).map((b) => b.id), ...(guide.bring?.mega ? [guide.bring.mega.id] : []), ...guide.leads.flatMap((l) => l.ours),
    ...guide.previews.flatMap((p) => [...p.bring4, ...p.lead]), ...guide.combos.ours.flatMap((c) => c.attackers.map((a) => a[0])), ...guide.combos.theirs.map((c) => c.into),
    ...guide.calcs.flatMap((c) => [c.attacker, c.defender]).filter((x) => x.set === 'ours').map((x) => x.id), ...Object.keys(guide.perMon).filter((id) => roster.has(id))])];
}
/**
 * Have the rosters changed since the guide was written? With guide.rosters (the sheet snapshot) the comparison is exact;
 * without it, the species the guide mentions stand in. Mega forme ids count as their base species (base(id)).
 * Returns { stale, added, removed, ours: { added, removed } } (added = on the sheet now, not in the guide).
 */
export function staleness(guide, rosterIds, ourIds = [], base = (id) => id) {
  const norm = (list) => new Set(list.map(base));
  const cmp = (written, now, inferred) => {
    const w = norm(written), n = norm(now);
    return { added: inferred && !written.length ? [] : [...n].filter((id) => !w.has(id)), removed: [...w].filter((id) => !n.has(id)) };
  };
  const them = guide.rosters?.theirs?.length ? cmp(guide.rosters.theirs, rosterIds, false)
    : (() => { const c = cmp(guideTheirMons(guide, ourIds), rosterIds, true); return Object.keys(guide.perMon).length ? c : { ...c, added: [] }; })();
  const oursNow = new Set(ourIds.map(base));
  const us = guide.rosters?.ours?.length ? cmp(guide.rosters.ours, ourIds, false) : { added: [], removed: [...norm(guideOurMons(guide, ourIds))].filter((id) => ourIds.length && !oursNow.has(id)) };
  return { stale: !!(them.added.length || them.removed.length || us.added.length || us.removed.length), added: them.added, removed: them.removed, ours: us };
}
/** The guide calc for (attacker, defender, move), by species or forme id; or null. */
export function matchCalc(guide, attacker, defender, move, base = (id) => id) {
  return guide.calcs.find((c) => base(c.attacker.id) === base(attacker) && base(c.defender.id) === base(defender) && c.move === move) ?? null;
}
/**
 * "Can wreck you" + the guide: for scan rows (lib/threat-scan) whose (their species, move, our target species) a guide
 * combo part or a calc with you defending matches, the guide's answer and stated range. targetSpecies(row) maps a row's
 * target key to your species. Returns Map(row → { answer, range }).
 */
export function mergeWreck(rows, guide, targetSpecies, base = (id) => id) {
  const notes = [];
  for (const c of guide.combos.theirs) for (const [a, m] of c.attackers) notes.push({ a: base(a), m, d: base(c.into), answer: c.answer, range: c.range });
  for (const c of guide.calcs) if (c.defender.set === 'ours') notes.push({ a: base(c.attacker.id), m: c.move, d: base(c.defender.id), answer: c.why || c.verdict, range: c.range });
  const out = new Map();
  for (const r of rows) {
    const n = notes.find((x) => x.a === base(r.species) && x.m === r.move && x.d === base(targetSpecies(r)));
    if (n) out.set(r, { answer: n.answer, range: n.range });
  }
  return out;
}
/** "a–b%" → [a, b], or null. */
export const parseRange = (s) => { const m = /^(\d+(?:\.\d+)?)–(\d+(?:\.\d+)?)%$/.exec(String(s ?? '').trim()); return m ? [Number(m[1]), Number(m[2])] : null; };
/**
 * The guide for a matchup, or null: by seats, and only when the opponent at that seat is still the guide's coach.
 * guides: the list to search (default GUIDES; tests pass fixtures). Returns { guide, problems }.
 */
export function guideFor(pov, opp, oppName, { guides = GUIDES, mech = null } = {}) {
  // matched by the opponent's NAME (seats can move); the pov seat stays as written
  const raw = guides.find((g) => g?.pov === pov && oppName && g.coach === oppName) ?? (oppName ? null : guides.find((g) => g?.pov === pov && g?.opp === opp));
  if (!raw) return null;
  const v = validateGuide(raw, mech);
  return v.guide ? v : null;
}
/** A guide written for this seat whose coach isn't on the sheet any more (the "seats moved" note), or null. */
export function orphanAt(pov, opp, coachNames, { guides = GUIDES } = {}) {
  return guides.find((g) => g?.pov === pov && g?.opp === opp && !coachNames.includes(g.coach)) ?? null;
}

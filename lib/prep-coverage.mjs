// Honest prep coverage (never a score): plan rungs in words, safeguard flags (at most three shown, fixed priority),
// the single "Start here" step, finding confidence and mock records as counts. Pure functions over a workspace, the
// league-rules profile and derived facts; everything here is recomputed on render, never stored.

export const RUNGS = Object.freeze(['not-yet', 'thought-through', 'checked', 'rehearsed', 'rehearsed-broadly']);
export const FLAG_PRIORITY = Object.freeze([['F16', 'F19', 'F20'], ['F11', 'F12'], ['F4', 'F5', 'F6', 'F7'], ['F14', 'F15'], ['F1', 'F2', 'F9']]);
export const MAX_FLAGS = 3;

const ruleUnknown = (rules, k) => !rules?.rules?.[k] || rules.rules[k].value === 'unknown';
/** You have thought about their counter-prep: answered "Through their eyes", or wrote a counter-prep plan or version. */
export const counterprepDone = (ws) => !!(ws.eyesAnswer ?? '').trim()
  || (ws.plans ?? []).some((p) => p.kind === 'counterprep' && (p.members?.length || (p.needs ?? '').trim() || (p.label ?? '').trim()))
  || (ws.variants ?? []).some((v) => v.role === 'counterprep');
const games = (ws) => (ws.mockSets ?? []).flatMap((m) => (m.games ?? []).filter((g) => !g.draft).map((g) => ({ ...g, mock: m })));

/** Rung of one of their plans. facts = { calcsByCard:{cardId:[calc ids checked vs worst]}, speedCheckedCards:Set } */
export function planRung(ws, planId, facts = {}) {
  const cards = (ws.cards ?? []).filter((c) => c.kind === 'plan' && (c.vsPlanIds ?? []).includes(planId));
  if (!cards.length) return 'not-yet';
  const checked = cards.some((c) => (facts.calcsByCard?.[c.id]?.length ?? 0) > 0 && facts.speedCheckedCards?.has?.(c.id));
  const gs = games(ws).filter((g) => g.planId === planId && g.partnerFidelity !== 1 && g.tag !== 'partner-off-script' && (g.mock.fidelity === 2 || g.mock.fidelity === 3 || g.mock.fidelity === 'S' || g.partnerFidelity >= 2));
  if (!gs.length) return checked ? 'checked' : 'thought-through';
  const variants = new Set(gs.flatMap((g) => g.mock.variantIds ?? [])), partners = new Set(gs.map((g) => g.mock.partner));
  const leads = new Set(gs.map((g) => (g.theirLead ?? []).slice().sort().join('+')));
  return (variants.size >= 2 || partners.size >= 2) && leads.size >= 2 ? 'rehearsed-broadly' : 'rehearsed';
}

/**
 * Safeguard flags. ctx = { rules, rosterDiff:{added,removed}, staleCalcIds:[], megaSpecies:[their species with a Mega],
 *   intimidateSpecies:[their species that can have Intimidate], calcFacts:[{id, physical, mineAttacking, intimidated, mark,
 *   attackerVariantRole, worstExists, cardPlanField, weather}] }.
 * Returns [{code, ...detail}] in priority order (all of them; render the first MAX_FLAGS).
 */
export function flags(ws, ctx = {}) {
  const out = [];
  const add = (code, d = {}) => { if (!(ws.dismissedFlags ?? []).includes(code + (d.ref ? `:${d.ref}` : ''))) out.push({ code, ...d }); };
  const rules = ctx.rules;
  // F16: plans or inferences depend on an unconfirmed rule
  const unknownRules = ['disclosure', 'itemClause', 'sixPerMatch'].filter((k) => ruleUnknown(rules, k));
  if (unknownRules.length && ((ws.cards ?? []).length || (ws.reveals ?? []).length || (ws.plans ?? []).length)) add('F16', { rule: unknownRules[0], count: unknownRules.length });
  // F19: a mock's format shows different team info than the condition it claims (or than a confirmed league rule)
  for (const m of ws.mockSets ?? []) {
    const f = formatInfo(m.formatString);
    const disc = rules?.rules?.disclosure?.value;
    const mismatch = (f && f.ots !== null && (f.ots ? m.simulatedDisclosure === 'closed' : m.simulatedDisclosure !== 'closed'))
      || (disc && disc !== 'unknown' && disc !== 'partial' && m.simulatedDisclosure && disc !== m.simulatedDisclosure);
    if (mismatch) { add('F19', { ref: m.id }); break; }
  }
  // F20: a mock played from a brief whose check numbers weren't confirmed (no brief: nothing to check)
  for (const m of ws.mockSets ?? []) if (m.briefText && (m.games ?? []).some((g) => !g.draft) && !(m.games ?? []).some((g) => g.pasteCheckOk === true)) { add('F20', { ref: m.id }); break; }
  if ((ctx.staleCalcIds ?? []).length) add('F11', { count: ctx.staleCalcIds.length });
  if (ctx.rosterDiff && (ctx.rosterDiff.added.length || ctx.rosterDiff.removed.length)) add('F12', { ...ctx.rosterDiff });
  for (const c of ctx.calcFacts ?? []) {
    if (c.physical && c.mineAttacking && !c.intimidated && c.defenderSideHasIntimidate) { add('F4', { ref: c.id }); break; }
  }
  for (const c of ctx.calcFacts ?? []) if (c.mark === 'fine' && !c.mineAttacking && c.attackerVariantRole === 'likely' && c.worstExists) { add('F5', { ref: c.id }); break; }
  for (const c of ctx.calcFacts ?? []) if (c.cardPlanField && ['sun', 'rain', 'sand', 'snow'].includes(c.cardPlanField) && weatherOf(c.cardPlanField) !== c.weather) { add('F6', { ref: c.id }); break; }
  if (ctx.guessedSpeedPairs) add('F7', { count: ctx.guessedSpeedPairs });
  if (!counterprepDone(ws)) add('F14');
  for (const sp of ctx.megaSpecies ?? []) if (!(ws.plans ?? []).some((p) => p.megaUser === sp)) { add('F15', { species: sp, ref: sp }); break; }
  const gs = games(ws);
  if (gs.length >= 2) {
    const vars = new Set(gs.flatMap((g) => g.mock.variantIds ?? []));
    if (vars.size < 2 && !gs.some((g) => g.mock.blind)) add('F1');
    const leads = new Set(gs.map((g) => (g.theirLead ?? []).slice().sort().join('+')).filter(Boolean));
    if (leads.size === 1) add('F2');
    if (gs.filter((g) => g.partnerFidelity === 1 || g.tag === 'partner-off-script').length * 2 >= gs.length) add('F9');
  }
  const order = FLAG_PRIORITY.flat();
  return out.sort((a, b) => order.indexOf(a.code) - order.indexOf(b.code));
}
const weatherOf = (field) => ({ sun: 'Sun', rain: 'Rain', sand: 'Sand', snow: 'Snow' }[field] ?? '');

/** Showdown format facts for the mock-condition check. ots: true (forces open sheets), false (none), null (unknown format). */
export function formatInfo(formatString) {
  const id = String(formatString ?? '').toLowerCase().split('@@@')[0].replace(/[^a-z0-9]/g, '');
  const custom = String(formatString ?? '').toLowerCase();
  if (!id) return null;
  if (id === 'gen9championsvgc2026regmcbo3') return { ots: !custom.includes('!force open team sheets'), bo3: true };
  if (id === 'gen9championsvgc2026regmc') return { ots: null, bo3: custom.includes('best of = 3') }; // offers OTS; both players accept or not
  if (id === 'gen9champions4v4doublesdraft') return { ots: false, bo3: custom.includes('best of = 3') };
  return { ots: null, bo3: null };
}

/**
 * "Start here": one step, by fixed rules in order (UX §5.4). facts = { pickSix (rule says you pick a 6, or unknown),
 * speedUnchecked, keyCalcsRun, staleCount, mockPlanned, openFindingUnretested }.
 */
export function startHere(ws, facts = {}) {
  const plans = (ws.plans ?? []).filter((p) => p.kind !== 'idea');
  if (!plans.some((p) => p.kind !== 'counterprep')) return { step: 1 };
  if (!counterprepDone(ws)) return { step: 2 };
  if (facts.pickSix !== false && (ws.my6 ?? []).length < 6) return { step: 3 };
  if (plans.some((p) => !(ws.cards ?? []).some((c) => c.kind === 'plan' && (c.vsPlanIds ?? []).includes(p.id)))) return { step: 4 };
  if (facts.speedUnchecked) return { step: 5 };
  if (!facts.keyCalcsRun) return { step: 6 };
  if (facts.staleCount) return { step: 'recheck' };
  if (!facts.mockPlanned || facts.openFindingUnretested) return { step: 7 };
  return null;
}

/**
 * Finding confidence (strategist W3 rules; computed, never stored). evidenceGames: [{tag, variantId, partner}] (mock or
 * match games), calcConfirmed: a calc or speed check confirms it. Returns {level:'none'|'low'|'medium'|'high', rule}.
 */
export function findingConfidence(finding, evidenceGames = [], calcConfirmed = false) {
  const mech = !!(finding.mechanism && String(finding.mechanism).trim());
  const real = evidenceGames.filter((g) => g.tag !== 'partner-off-script');
  if (evidenceGames.length && !real.length) return { level: 'none', rule: 'off-script-only' };
  if (real.length <= 1) {
    if (mech && calcConfirmed) return { level: 'high', rule: 'once-confirmed' };
    return { level: 'low', rule: real.length ? 'once' : 'no-games' };
  }
  const vars = new Set(real.map((g) => g.variantId ?? '')), partners = new Set(real.map((g) => g.partner ?? ''));
  if ((vars.size >= 2 || partners.size >= 2) && mech) return { level: 'high', rule: 'repeated-varied' };
  if (calcConfirmed && mech) return { level: 'high', rule: 'once-confirmed' };
  return { level: 'medium', rule: mech ? 'repeated-same-setup' : 'repeated-unclear' };
}

/** Mock records as counts ("2–1, 2–0"), never a rate. */
export function recordText(mockSets) {
  const recs = (mockSets ?? []).filter((m) => (m.games ?? []).some((g) => g.result)).map((m) => {
    const w = m.games.filter((g) => g.result === 'W').length, l = m.games.filter((g) => g.result === 'L').length;
    return `${w}–${l}`;
  });
  return recs;
}

/** Revision guards (gentle sentences, never blocks): returns codes. */
export function revisionGuards(revision, { findings = [], matchDate = null, now = null, structuralInDraft = 0, confidenceOf = () => 'low' } = {}) {
  const out = [];
  if (structuralInDraft > 1) out.push('split-structural');
  const linked = findings.filter((f) => (revision.reasonFindingIds ?? []).includes(f.id));
  if (revision.structural && linked.length === 1 && confidenceOf(linked[0]) === 'low') out.push('one-unclear-game');
  if (!linked.length) out.push('hunch');
  if (matchDate && now) {
    const ms = Date.parse(matchDate) - Date.parse(now);
    if (ms >= 0 && ms < 24 * 3600e3 && !linked.some((f) => f.severity === 'critical' && confidenceOf(f) === 'high')) out.push('late-change');
  }
  return out;
}

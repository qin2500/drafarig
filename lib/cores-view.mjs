// Cores to fear + Who carries your answers: pure HTML builders (UX spec docs/research/ux/cores-ux.md v3.5).
// No DOM access, so node --test can render and check the strings. The app (public/app.js) only caches the view, inserts
// the strings and handles clicks. The lib returns data; every sentence here is UI copy, except "research copy" (core name,
// oneLineWhy, answer label / note / failsTo, prepReasoning) which is shown verbatim inside <span class="rc">.
// Honesty rules (UX §5, cores.json v3 responseConcentration.mustNotClaim): conditional verbs only, no percentages or scores,
// unknown league rules stay unknown, no pick suggestions (pickFixes / cheapEnablers are never imported here).
import {
  CONTRACT, coreCards, responseConcentration, sortCards, cardRef, isLikelyFieldable, weakerStatus, hasSpof, rosterIds, CLASS_RANK, STATUS_RANK,
} from './cores.mjs';

export const SCENARIO_LABEL = Object.freeze({ A: 'Pool only', B: 'Open team sheets' });
/** The oldest research revision whose copy is display-safe (revision 4 moved evidence notes out of displayed fields). */
export const DISPLAY_MIN_REVISION = 4;
const DEFAULT_NAMES = { has: 'Has answers', thin: 'Thin', none: 'No answer found' };
const STATUS_CLASS = { has: 'ans', thin: 'thin', none: 'unc' };
const SOURCE_BY_KIND = { type: 'from typing', defense: 'from typing', ability: 'from ability', stats: 'from base stats', stab: 'from typing + stats' };
const LANES = [
  ['structural', 'Structural answer', 'Structural', ' · typing, ability or Speed'],
  ['standard-move', 'Common on the ladder', 'Common on the ladder', ''],
  ['tech', 'Tech', 'Tech', ' · only if you bring it'],
];
const PREP_GENERIC = {
  Low: "It keeps working even when you've prepared, so the answers you drafted matter most.",
  Med: 'Cheap tech chosen for this match tends to cut it a lot, if you bring it.',
  High: 'A prepared opponent usually has a way out, and their pool is public, so you can see it coming.',
};
const CARDS_SHOWN = 8, ROWS_SHOWN = 3, FORMING_ADDS_SHOWN = 3, FORMING_ROWS_UNFOLDED = 5;

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const term = (label, key = label) => `<span class="term" tabindex="0" data-term="${esc(key)}">${esc(label)}</span>`;
const rc = (s) => `<span class="rc">${esc(s)}</span>`; // research copy, verbatim
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const andList = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const cap = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);
const mult = (m) => `×${m}<span class="vh"> (${m} times damage)</span>`;
/** One value when pool only (A) and open team sheets (B) agree; both, labelled, when they differ (§2.7). */
const dual = (a, b, fmt) => (a === b ? fmt(a) : `${fmt(a)} pool only / ${fmt(b)} open team sheets`);
const utc = (iso) => { const d = new Date(iso); return Number.isNaN(+d) ? null : `${d.toISOString().slice(0, 16).replace('T', ' ')} UTC`; };

// ---------- View model + cache ----------

/**
 * Everything the panels need for one selected coach, computed once (UX §11.1: cache per sheet data and coach).
 * me / opponents are league coach objects ({name, order, picks:[{id}], pointsLeft, slotsLeft}); available = [{id, cost}].
 * fetchedAt is optional and only a fallback for renderCoresPanel: the app leaves it out of the cached view and passes the
 * current sheet read time at render time, so an unchanged re-read still updates the Sources line (QA S6).
 */
export function buildCoresView(cx, { me, opponents, available = [], fetchedAt = null }) {
  // Display-safe copy starts at research revision 4 (evidence moved out of the displayed fields). The engine still accepts
  // revisions 2-4 for the parity tools, but the panels refuse older copy; the app then shows the error panel (code review n6).
  const revision = cx.spec.revision ?? 1;
  if (!(revision >= DISPLAY_MIN_REVISION)) throw new Error(`core spec: revision ${revision} has no display-safe copy; the Cores panels need revision ${DISPLAY_MIN_REVISION} or later`);
  const my = rosterIds(me);
  const cards = coreCards(cx, { me: my, opponents, available, deep: 'main' }); // depth / spof / co-failure for main-list cards only
  return {
    cx, dex: cx.dex, spec: cx.spec, fetchedAt,
    me: { name: me.name, ids: my },
    opponents: opponents.map((o) => ({ name: o.name, order: o.order, slotsLeft: o.slotsLeft, unmatched: (o.picks ?? []).filter((p) => !p.id).length })),
    cards,
    conc: { A: responseConcentration(cards, my, 'A'), B: responseConcentration(cards, my, 'B') },
    techMissing: !Object.values(cx.dex.species).some((s) => Array.isArray(s.learnsetTech)),
    usageSource: cx.dex.sources?.keyMoves ?? null,
  };
}

/** A one-slot cache: compute(...args) runs only when the key changes or after reset(). `calls` counts computations. */
export function createCoresCache(compute) {
  let key, value, has = false, calls = 0;
  return {
    get(k, ...args) { if (!has || k !== key) { value = compute(...args); key = k; has = true; calls++; } return value; },
    reset() { has = false; value = undefined; },
    get calls() { return calls; },
  };
}

// ---------- Shared helpers ----------

const name = (v, id) => v.dex.species[id]?.name ?? id;
const baseForm = (v, id) => v.dex.species[id]?.forms?.[0]?.name;
const coreOf = (v, c) => v.cx.coreById.get(c.coreId);
const ansSpec = (v, c, id) => coreOf(v, c)?.answers.find((a) => a.id === id) ?? {};
const label = (v, key) => v.spec.statusRule?.names?.[key] ?? DEFAULT_NAMES[key];
const monBtn = (v, id, text = name(v, id)) => `<button type="button" class="linkish" data-mon="${esc(id)}">${esc(text)}</button>`;
const inScope = (c, scope) => scope === 'all' || c.coach === scope;
const coachOrder = (v, coach) => v.opponents.find((o) => o.name === coach)?.order ?? 0;
// withVh: a visually hidden "Status: " for screen readers, except where visible text already introduces it (forming rows).
const statusChip = (v, key, prefix = '', withVh = true) => `<span class="chip ${STATUS_CLASS[key]}">${withVh ? '<span class="vh">Status: </span>' : ''}${prefix ? esc(prefix) + ': ' : ''}${esc(label(v, key))}</span>`;
/** Per-card glossary terms: only the first occurrence of each term is a focusable .term; later ones are plain text (UI review F5). */
const termOnce = () => { const seen = new Set(); return (lbl, key = lbl) => (seen.has(key) ? esc(lbl) : (seen.add(key), term(lbl, key))); };
function statusChips(v, c) {
  if (c.status.A.key === c.status.B.key) return statusChip(v, c.status.A.key);
  return ['A', 'B'].map((sc) => statusChip(v, c.status[sc].key, SCENARIO_LABEL[sc])).join(' ');
}
/** Main list: likely cores (fieldable, then mega-conflict). Verdicts and concentration count likely fieldable cards only. */
const mainCards = (v, scope) => sortCards(v.cards.filter((c) => inScope(c, scope) && c.state !== 'forming' && c.confidence === 'likely' && !c.adds));
const formingRows = (v, scope) => v.cards.filter((c) => inScope(c, scope) && c.adds?.length && (v.opponents.find((o) => o.name === c.coach)?.slotsLeft ?? 0) > 0);
const possibleRows = (v, scope) => v.cards.filter((c) => inScope(c, scope) && c.state !== 'forming' && c.confidence === 'possible' && !c.adds?.length);
/** "{f} cores 1 pick away": the rows League shows under "Close to forming", across all opponents. One count for every panel. */
const formingTotal = (v) => formingRows(v, 'all').length;
/** The N = 0 add-on shared by "Cores with thin or no answers" and "Who carries your answers" (UX §4.9, §7.7). */
const pickAway = (f) => (f ? ` ${plural(f, 'core')} ${f === 1 ? 'is' : 'are'} 1 pick away: see League.` : '');
const differs = (c) => c.status.A.key !== c.status.B.key;

// ---------- Card ----------

function prepChip(c) {
  const p = c.prepSensitivity;
  return p.A === p.B ? `Prep: ${esc(p.A)}` : `Prep: ${esc(p.A)} pool only · ${esc(p.B)} open sheets`;
}
function prepNote(v, c, T = term) {
  const core = coreOf(v, c), p = c.prepSensitivity, safe = core?.prepReasoningDisplaySafe ?? {};
  const prep = T('Prep', 'Prep sensitivity');
  if (p.A === p.B) return `<p class="explainer">${prep}: ${esc(p.A)}. ${esc(PREP_GENERIC[p.A] ?? '')}</p>`;
  const reason = (sc) => (safe[sc] === true && core?.prepReasoning?.[sc] ? rc(core.prepReasoning[sc]) : esc(PREP_GENERIC[p[sc]] ?? ''));
  return `<p class="explainer">${prep} differs by case. Pool only: ${esc(p.A)}. ${reason('A')} Open team sheets: ${esc(p.B)}. ${reason('B')}</p>`;
}

function poolLine(v, c) {
  // A member's ability shows only in the slots it fills (memberAbilityDisplay; UI review F7: Torkoal's Drought fills the setter slot, not the abuser slot).
  const abilityIn = (m, slot) => c.members.find((x) => x.id === m.id && x.form === m.form && (x.abilitySlots ?? []).includes(slot))?.ability;
  const segs = c.slotPool.map((s) => `${esc(cap(s.slot))}: ${s.mons.map((m) => { const a = abilityIn(m, s.slot); return monBtn(v, m.id, m.form)
    + (a ? ` (${esc(a)})` : '') + (m.evidence === 'learnset' ? ' (learnable only)' : ''); }).join(', ') || 'none'}`);
  return `<p class="small pool">${segs.join(' · ')}${c.megas > 0 ? ' · uses their Mega' : ''}</p>`;
}

function statusSentence(v, c, sc) {
  const st = c.status[sc], n = st.counted.length;
  if (st.key === 'has') return `${plural(n, 'candidate answer')}, ${plural(st.anchors.length, 'anchor')}. Worth a damage calc before you rely on them.`;
  if (st.key === 'none') return 'No candidate answer found on typing, ability, Speed or moves.';
  if (n === 1) return `Only ${esc(name(v, st.counted[0].mon))} looks like an answer.`;
  const parts = { partial: 0, contested: 0, tech: 0 };
  for (const e of st.counted) parts[e.partial ? 'partial' : e.contestedBy ? 'contested' : 'tech']++;
  const txt = [parts.partial && `${parts.partial} partial`, parts.contested && `${parts.contested} contested`, parts.tech && `${parts.tech} tech you'd have to bring`].filter(Boolean);
  return `${n} candidate answers, but none is an anchor: ${txt.join(', ')}.`;
}
function statusLines(v, c) {
  if (!differs(c)) return `<p class="small status-line">${statusSentence(v, c, 'A')}</p>`;
  return ['A', 'B'].map((sc) => `<p class="small status-line">${SCENARIO_LABEL[sc]}: ${statusSentence(v, c, sc)}</p>`).join('');
}

function restsSentence(v, c, sc, T = term) {
  const mons = c.spof[sc] ?? [];
  if (!mons.length) return '';
  const names = mons.map((m) => esc(name(v, m)));
  const rests = T('Rests on');
  if (mons.length === 1) {
    const only = c.status[sc].anchors.length === 1 && c.status[sc].anchors[0] === mons[0];
    return `${rests} ${names[0]}${only ? ', the only anchor' : ''}: without it, this drops to Thin.`;
  }
  return `${rests} ${andList(names)}: losing ${mons.length === 2 ? 'either' : 'any one of them'} drops it to Thin.`;
}
function restsLines(v, c, T = term) {
  const same = JSON.stringify(c.spof.A) === JSON.stringify(c.spof.B);
  const lines = same ? [restsSentence(v, c, 'A', T)] : ['A', 'B'].map((sc) => (c.spof[sc]?.length ? `${SCENARIO_LABEL[sc]}: ${restsSentence(v, c, sc, T)}` : ''));
  return lines.filter(Boolean).map((l) => `<p class="small rests-on">${l}</p>`).join('');
}

function contestedPhrase(b, T = term) {
  const who = esc(b.mega ? b.form : b.name);
  const what = !b.via ? '' : b.viaKind === 'type' ? ` can be ${esc(b.via)}-type` : ` can have ${esc(b.via)}`;
  return `${T('contested', 'Contested')}: ${who}${what}${b.mega ? ' (uses their Mega)' : ''}`;
}
function sourcePhrase(e) {
  if (e.class === 'structural') return SOURCE_BY_KIND[e.kind] ?? 'from typing';
  const via = esc(e.via ?? (e.moves?.join(' / ') || e.label));
  return e.class === 'standard-move' ? `${via}: common on the ladder` : `if you run ${via}: learnset only`;
}
// Pikalytics reports whole percentages, so "1" may be anything under 1.5: <= 1 (or no data) is a small sample (UI review F2).
const smallSample = (v, id) => !(v.dex.species[id]?.pika?.pct > 1);

/** One chip per mon: its counted entry (scenario A), plus mons left out only by the one-Mega rule. */
function chipEntries(v, c) {
  const counted = c.status.A.counted;
  const seen = new Set(counted.map((e) => e.mon));
  const extra = new Map();
  for (const a of c.answers) {
    if (!a.counts || seen.has(a.mon)) continue;
    const cur = extra.get(a.mon);
    const k = (x) => CLASS_RANK[x.class] * 2 + (x.megaDependent ? 0 : 1);
    if (!cur || k(a) > k(cur)) extra.set(a.mon, a);
  }
  return [...counted, ...[...extra.values()].map((e) => ({ ...e, anchor: false, notCounted: true }))];
}
function chipTokens(v, c, e, T = term) {
  const t = [];
  if (!e.notCounted) {
    const b = c.status.B.counted.find((x) => x.mon === e.mon);
    const aA = !!e.anchor, aB = !!b?.anchor;
    if (aA && aB) t.push(T('anchor', 'Anchor'));
    else if (aA) t.push(`${T('anchor', 'Anchor')} (pool only)`);
    else if (aB) t.push(`${T('anchor', 'Anchor')} (open team sheets)`);
    else if (e.partial) t.push(T('partial', 'Partial answer'));
  }
  if (e.contestedBy) t.push(contestedPhrase(e.contestedBy, T));
  t.push(sourcePhrase(e));
  if (e.abilityChoice && e.ability) t.push(`if it has ${esc(e.ability)}`);
  if (e.megaDependent) t.push('uses your Mega');
  if (e.class === 'structural' && e.visibility?.A === 'until-used') t.push(T('hidden until used (pool only)', 'Hidden until used'));
  if (e.class === 'standard-move' && smallSample(v, e.mon)) t.push('small ladder sample');
  if (e.notCounted) t.push('not counted: only one Mega per battle');
  return t.join(' · ');
}
function lanes(v, c, id, T = term) {
  const entries = chipEntries(v, c);
  const order = (e) => [e.anchor ? 0 : 1, e.partial ? 1 : 0, e.contestedBy ? 1 : 0, v.me.ids.indexOf(e.mon)];
  const cmp = (x, y) => { const a = order(x), b = order(y); for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };
  return LANES.map(([cls, termKey, head, rest]) => {
    const list = entries.filter((e) => e.class === cls).sort(cmp);
    const lid = `${id}-${cls}`;
    const heading = `${T(head, termKey)}${esc(rest)}`; // lane heading first, so it takes the term before the lane note
    const note = cls !== 'structural' && list.length ? ` <span class="small muted lane-note">· ${T('hidden until used (pool only)', 'Hidden until used')}</span>` : '';
    const items = list.map((e) => {
      const note2 = ansSpec(v, c, e.answer).note;
      return `<li><span class="chip${e.anchor ? ' ok' : ''}"${note2 ? ` title="${esc(note2)}"` : ''}>${monBtn(v, e.mon)}${e.megaDependent ? ` as ${esc(e.form)}` : ''} · ${rc(e.label)}</span> <span class="q small muted">${chipTokens(v, c, e, T)}</span></li>`;
    }).join('');
    return `<p class="lane-h" id="${lid}">${heading}${note}</p>${list.length ? `<ul class="lane" aria-labelledby="${lid}">${items}</ul>` : '<p class="small muted lane-empty">none found</p>'}`;
  }).join('');
}

function failDetails(v, c, key, state) {
  const counted = c.status.A.counted;
  const countedKey = new Set(counted.map((e) => e.mon + '|' + e.answer));
  const countedMons = new Set(counted.map((e) => e.mon));
  const rows = [...counted, ...c.answers.filter((a) => a.counts && !countedKey.has(a.mon + '|' + a.answer))].map((e) => {
    const s = ansSpec(v, c, e.answer);
    const suffix = countedKey.has(e.mon + '|' + e.answer) ? '' : countedMons.has(e.mon) ? ` (not counted: ${esc(name(v, e.mon))} already counts once)` : ' (not counted: only one Mega per battle)';
    return `<li>${esc(name(v, e.mon))} · ${rc(e.label)}: ${s.note ? rc(s.note) : ''}${s.failsTo ? ` Can fail to: ${rc(s.failsTo)}` : ''}${suffix}</li>`;
  });
  if (!rows.length) return '';
  const k = `${key}|fails`;
  return `<details class="small fails" data-key="${esc(k)}"${state.open?.[k] ? ' open' : ''}><summary>How these answers can fail</summary><ul>${rows.join('')}</ul></details>`;
}

function cardHtml(v, c, { scope, idx, state }) {
  const key = cardRef(c), core = coreOf(v, c), T = termOnce();
  const title = `${rc(core?.name ?? c.coreId)}${scope === 'all' ? ` · ${esc(c.coach)}` : ''}`;
  const chips = `${statusChips(v, c)} <span class="chip">${prepChip(c)}</span> <span class="chip">${c.state === 'fieldable' ? 'In their pool' : 'Needs 2 Megas'}</span>`;
  const body = [
    poolLine(v, c),
    c.state === 'mega-conflict' ? `<p class="small">Only one Mega per battle, so they can't run this exactly as listed.</p>` : '',
    statusLines(v, c),
    restsLines(v, c, T),
    `<div class="core-ans"><p class="small"><b>Candidate answers</b></p>${lanes(v, c, `core${idx}`, T)}</div>`,
    c.nonAnswers.map((a) => `<p class="small nonans">Not an answer: ${esc(name(v, a.mon))}: ${rc(a.label)}. ${rc(ansSpec(v, c, a.answer).note ?? '')}</p>`).join(''),
    failDetails(v, c, key, state),
    prepNote(v, c, T),
    core?.oneLineWhy ? `<p class="explainer">${rc(core.oneLineWhy)}</p>` : '',
    '<p class="small muted footer">Type-and-speed screen, not a matchup verdict. No damage calc.</p>',
  ].join('');
  // UX §3: only fieldable Has-answers cards without a single point of failure collapse; mega-conflict cards stay open (M1).
  const collapsed = c.state === 'fieldable' && weakerStatus(c) === 'has' && !hasSpof(c);
  if (collapsed) {
    return `<details class="plan core" data-key="${esc(key)}"${state.open?.[key] ? ' open' : ''}><summary class="plan-head"><h3>${title}</h3> <span class="chips">${chips}</span></summary>${body}</details>`;
  }
  return `<div class="plan core" data-key="${esc(key)}"><div class="plan-head"><h3>${title}</h3><span class="chips">${chips}</span></div>${body}</div>`;
}

// ---------- League panel ----------

function leagueVerdict(v, cards, scope) {
  const verdictCards = cards.filter(isLikelyFieldable);
  // Only mega-conflict cards in scope: they show below, so "no pool contains any core" would be false (lead decision).
  const megaOnly = cards.filter((c) => c.state === 'mega-conflict').length;
  if (!verdictCards.length && megaOnly) {
    return `${scope === 'all' ? 'No opponent can' : `${esc(scope)} can't`} field one of the ${v.spec.cores.length} cores as listed yet. ${megaOnly} ${megaOnly === 1 ? 'core needs' : 'cores need'} two Megas at once, so ${megaOnly === 1 ? "it can't" : "they can't"} be run exactly as shown below.`;
  }
  if (!verdictCards.length) {
    const who = scope === 'all' ? "No opponent's pool contains any" : `${esc(scope)}'s pool contains none`;
    const picksLeft = v.opponents.some((o) => inScope({ coach: o.name }, scope) && o.slotsLeft > 0);
    return `${who} of the ${v.spec.cores.length} cores the app screens for yet.${picksLeft ? ' Cores appear here as coaches draft setters and partners.' : ''}`;
  }
  const w = verdictCards.map((c) => [c, weakerStatus(c)]);
  const u = w.filter(([, k]) => k === 'none'), t = w.filter(([, k]) => k === 'thin'), a = w.filter(([, k]) => k === 'has');
  const f = a.filter(([c]) => hasSpof(c)).length;
  const d = verdictCards.filter(differs).length;
  const ref = (c) => `${rc(coreOf(v, c)?.name ?? c.coreId)} (${esc(c.coach)})`;
  let s = `${u.length} with no answer found, ${t.length} thin, ${a.length} with candidate answers.`;
  if (f) s += ` ${f} of those rest${f === 1 ? 's' : ''} on one mon.`;
  if (u.length) s += ` Biggest gap: ${ref(u[0][0])}.`;
  else if (t.length) s += ` Thinnest: ${ref(t[0][0])}.`;
  if (d) s += ` Where pool-only and open-team-sheet results differ (${d}), the weaker one is counted.`;
  if (!u.length && !t.length) s += ' Still a type-and-speed screen, not a matchup verdict.';
  return s;
}

/** Concentration rows sorted for display (UX §4.4 / U9): anchors, then opponentWeighted (never shown), then roster order. */
const sortedRows = (v, conc) => [...conc.perMon].sort((a, b) => b.anchors - a.anchors || b.opponentWeighted - a.opponentWeighted || v.me.ids.indexOf(a.mon) - v.me.ids.indexOf(b.mon));

function summaryLine(v, scope) {
  if (scope === 'all') {
    const conc = v.conc.A;
    if (!conc.cards) return '';
    const top = sortedRows(v, conc)[0];
    if (!top?.anchors) return `<p class="small">None of your mons anchors a likely core yet. ${goButton()}</p>`;
    const k = top.opponents.length, K = conc.opponents;
    const r = v.cards.filter((c) => isLikelyFieldable(c) && c.spof.A.length).length;
    const who = K === 1 ? 'the only opponent' : k === K ? `all ${K} opponents` : `${k} of the ${K} opponents`; // K = 1: lead decision
    return `<p class="small concentration-line">Your answers rest most on ${esc(name(v, top.mon))}: an anchor against ${who} with a likely core (${top.anchors} of ${conc.cards} cards).${r ? ` ${r} ${r === 1 ? 'card rests' : 'cards rest'} on one mon.` : ''} ${goButton()}</p>`;
  }
  const cards = v.cards.filter((c) => c.coach === scope && isLikelyFieldable(c));
  if (!cards.length) return '';
  const conc = responseConcentration(cards, v.me.ids, 'A');
  const anchors = sortedRows(v, conc).filter((r) => r.anchors);
  let s = anchors.length ? `Against ${esc(scope)}, your anchors: ${anchors.map((r) => `${esc(name(v, r.mon))} (${r.anchors})`).join(', ')}.` : `Against ${esc(scope)}, none of your mons anchors a card yet.`;
  for (const c of cards) if (c.spof.A.length) s += ` ${rc(coreOf(v, c).name)} rests on ${andList(c.spof.A.map((m) => esc(name(v, m))))}.`;
  const ev = cards.flatMap((c) => c.cofailure.A?.types ?? [])[0];
  if (ev) s += ` Shared weak point: ${esc(ev.type)} hits ${andList(Object.entries(ev.mult).sort((a, b) => b[1] - a[1]).map(([m, x]) => `${esc(name(v, m))} ${mult(x)}`))}.`;
  return `<p class="small concentration-line">${s} ${goButton()}</p>`;
}
const goButton = () => '<button type="button" data-goto="team" data-focus="carries">Who carries your answers</button>';

/**
 * "Close to forming" (UX §3.4, §9). All opponents: one closed <details> per opponent at every width. One opponent: the
 * rows show directly, except on narrow screens (the app's `narrow` flag, viewport under 768 px) with more than 5 rows,
 * where they go in one <details>. The builder never reads the viewport.
 */
function formingFold(v, scope, state, narrow) {
  const rows = formingRows(v, scope);
  if (!rows.length) return '';
  const row = (c) => {
    const missing = c.slotPool.filter((s) => s.mons.length < s.min).map((s) => esc(s.slot));
    const adds = c.adds.slice(0, FORMING_ADDS_SHOWN).map((a) => `${monBtn(v, a.id)} (${a.cost} pts)`).join(', ');
    const more = c.adds.length > FORMING_ADDS_SHOWN ? ` +${c.adds.length - FORMING_ADDS_SHOWN} more` : '';
    return `<li>${rc(coreOf(v, c)?.name ?? c.coreId)} · ${missing.length ? `missing ${andList(missing)}` : 'one more member'} · Affordable for them now: ${adds}${more} · <span class="muted">your answers today:</span> ${statusChip(v, weakerStatus(c), '', false)}</li>`;
  };
  const sortRows = (list) => [...list].sort((x, y) => STATUS_RANK[weakerStatus(x)] - STATUS_RANK[weakerStatus(y)]); // stable: spec order
  const explainer = '<p class="explainer">One affordable pick would complete these. They show what could form, not a forecast of their picks.</p>';
  const coaches = [...new Set(rows.map((c) => c.coach))];
  const block = (coach, list, folded) => {
    const o = v.opponents.find((x) => x.name === coach);
    const k = `forming|${coach}`;
    const ul = `<ul class="forming">${sortRows(list).map(row).join('')}</ul>`;
    return folded ? `<details data-key="${esc(k)}"${state.open?.[k] ? ' open' : ''}><summary>${esc(coach)}: ${plural(list.length, 'core')} 1 pick away (${plural(o?.slotsLeft ?? 0, 'pick')} left)</summary>${ul}</details>` : ul;
  };
  const body = scope === 'all' ? coaches.map((coach) => block(coach, rows.filter((c) => c.coach === coach), true)).join('')
    : block(scope, rows, narrow === true && rows.length > FORMING_ROWS_UNFOLDED);
  return `<h3 class="fold-h">Close to forming</h3>${explainer}${body}`;
}

function possibleFold(v, scope, state) {
  const rows = possibleRows(v, scope);
  if (!rows.length) return '';
  const row = (c) => {
    const m = c.members.find((x) => x.slotEvidence.includes('learnset'));
    const slot = m ? m.slots[m.slotEvidence.indexOf('learnset')] : '';
    return `<li>${rc(coreOf(v, c)?.name ?? c.coreId)} · ${esc(c.coach)}: ${m ? `${esc(m.form)} fills ${esc(slot)} only with a move it can learn but rarely runs on the ladder.` : ''}</li>`;
  };
  const k = 'possible';
  return `<details data-key="${k}"${state.open?.[k] ? ' open' : ''}><summary>Possible from learnsets only (${rows.length})</summary><p class="explainer">Folded because many learnable moves are never run.</p><ul>${rows.map(row).join('')}</ul></details>`;
}

/**
 * The "Drafted pools" read-time phrase of the Sources line. Plain text (digits, '-', ':' and words only). The app also
 * writes it into `p.sources .sheet-read` after a re-read with unchanged picks, which doesn't redraw the page (QA S6).
 */
export const sheetReadText = (fetchedAt) => (fetchedAt && utc(fetchedAt) ? `league sheet read ${utc(fetchedAt)}` : 'league sheet (read time not recorded)');

function sourcesLine(v, fetchedAt) {
  const usage = v.usageSource ? esc(v.usageSource) : 'date not recorded';
  return `<p class="small muted sources">Sources: typing, abilities and base stats from the app's Pokédex data. “Common on the ladder” and the cores listed here come from ladder usage (${usage}), not this league's sets. “If you run” means the mon can learn the move. Core rules: cores.json v${esc(v.spec.version)}${v.spec.revision !== undefined ? ` revision ${esc(v.spec.revision)}` : ''}${v.spec.generated ? ` (${esc(v.spec.generated)})` : ''}, engine ${esc(CONTRACT.engine)}. Drafted pools: <span class="sheet-read">${esc(sheetReadText(fetchedAt))}</span>.</p>`;
}

/**
 * League screen: "Cores to fear" (UX §3, §7.1). scope = 'all' or a coach name; state = {open, more}.
 * narrow: true when the viewport is under 768 px (the app passes it; UX §3.4 D1). fetchedAt: the sheet read time, passed at
 * render time so it follows re-reads that leave the cached view alone (QA S6); it falls back to the view's own fetchedAt.
 */
export function renderCoresPanel(v, { scope = 'all', state = {}, narrow = false, fetchedAt = v.fetchedAt } = {}) {
  const cards = mainCards(v, scope);
  const inScopeOpp = v.opponents.filter((o) => inScope({ coach: o.name }, scope));
  const lines = [];
  const open = inScopeOpp.filter((o) => o.slotsLeft > 0);
  if (open.length) {
    lines.push(scope === 'all' ? `The draft isn't finished: ${plural(open.length, 'opponent')} still ${open.length === 1 ? 'has' : 'have'} picks, so new cores can still appear.`
      : `The draft isn't finished: ${esc(scope)} has ${plural(open[0].slotsLeft, 'pick')} left, so new cores can still appear.`);
  }
  const unmatched = inScopeOpp.reduce((s, o) => s + o.unmatched, 0);
  if (unmatched) lines.push(`${unmatched} unmatched pick(s) left out. A core may be missing. <button type="button" data-goto="setup">Fix names</button>`);
  if (v.techMissing) lines.push("Tech answers are incomplete: single moves like Taunt, Imprison and Brick Break aren't in the app's data yet, so some “if you run” answers are missing.");
  if (!v.me.ids.length) lines.push("You haven't drafted yet, so there are no candidate answers. Use this to see what to draft against.");
  const expanded = !!state.more;
  const shown = cards.slice(0, CARDS_SHOWN), rest = cards.slice(CARDS_SHOWN);
  const html = (list) => list.map((c) => cardHtml(v, c, { scope, idx: v.cards.indexOf(c), state })).join('');
  const more = rest.length ? `<div id="cores-more"${expanded ? '' : ' hidden'}>${html(rest)}</div><button type="button" data-cores-more aria-expanded="${expanded}" aria-controls="cores-more">${expanded ? 'Show fewer' : `Show ${rest.length} more cores`}</button>` : '';
  return `<section class="panel cores" aria-labelledby="cores-h"><h2 id="cores-h" tabindex="-1">Cores to fear</h2>
    <p class="verdict">${leagueVerdict(v, cards, scope)}</p>
    ${summaryLine(v, scope)}
    <div class="filters"><label>Scope (also applies to Threats) <select id="coreScope"><option value="all">All ${v.opponents.length} opponents</option>${v.opponents.map((o) => `<option value="${esc(o.name)}"${scope === o.name ? ' selected' : ''}>${esc(o.name)}</option>`).join('')}</select></label></div>
    <p class="small scope-line">Type-and-speed screen, not a matchup verdict. Cores are spotted from typing, abilities, base stats and ladder-common moves, so they show what each pool could build, not what they bring to a match. Candidate answers check the same things, not damage, items, partners or positioning.</p>
    ${sourcesLine(v, fetchedAt)}
    <p class="small muted assumes">Assumes: drafted pools as listed on the league sheet. Not known for this league: whether team sheets are shared, Bo1 or Bo3, how far ahead you know your opponent, and whether rosters can change. Results are the same with or without open team sheets unless a card shows both.</p>
    ${lines.map((l) => `<p class="small info-line">${l}</p>`).join('')}
    <p class="explainer">A core is two or more mons in their pool that make a plan together, like a Trick Room setter plus slow hitters. Candidate answers come in three kinds. <b>Structural</b> comes from typing, ability or Speed, and doesn't depend on a move. <b>Common on the ladder</b> is a move among that mon's top ladder moves; that's ladder data, not this coach's set. <b>Tech</b> is a move it can learn that you'd choose for this match. An <b>anchor</b> is a structural or common-on-the-ladder answer that isn't partial or contested; where a core's prep sensitivity is High, tech you'd bring can also anchor. Has answers = at least 2 candidates and at least 1 anchor. You build your 6 knowing only their pool either way. Without open team sheets your tech stays hidden until used. With them, they see it at preview and may play around it. If matches are Bo3, game 1 shows only what was used, which sits between the two.</p>
    ${html(shown)}${more}
    ${formingFold(v, scope, state, narrow)}
    ${possibleFold(v, scope, state)}
  </section>`;
}

/** Shown in place of the League panel when the core spec can't be loaded or fails validateSpec (UX §7.6). */
export const renderCoresError = () => '<section class="panel cores" aria-labelledby="cores-h"><h2 id="cores-h" tabindex="-1">Cores to fear</h2><p class="banner warn">Core data isn\'t available right now. The single-mon Threats list below still works.</p></section>';

// ---------- My team: Cores with thin or no answers ----------

/** UX §7.7 verdict, in this order: no likely core at all (N = 0; an empty set isn't "answered"), none thin, the counts. */
export function renderThinPanel(v) {
  const cards = mainCards(v, 'all').filter(isLikelyFieldable);
  const weak = cards.filter((c) => weakerStatus(c) !== 'has');
  const u = weak.filter((c) => weakerStatus(c) === 'none').length, t = weak.length - u;
  const coaches = new Set(weak.map((c) => c.coach)).size;
  const verdict = !cards.length ? `No opponent can field a likely core yet. Still a screen, not a verdict.${pickAway(formingTotal(v))}`
    : weak.length ? `${u} with no answer found and ${t} thin, across ${plural(coaches, 'opponent')}.`
      : 'Every core your opponents can field has candidate answers. Still a screen, not a verdict.';
  const row = (c) => {
    const w = weakerStatus(c), st = c.status[c.status.A.key === w ? 'A' : 'B'];
    const why = w === 'thin' ? ` <span class="small muted">${st.counted.length === 1 ? 'one candidate' : 'no anchor'}</span>` : '';
    return `<li>${rc(coreOf(v, c)?.name ?? c.coreId)} · ${esc(c.coach)} ${statusChip(v, w)}${why}</li>`;
  };
  return `<section class="panel cores-thin" aria-labelledby="thin-h"><h2 id="thin-h">Cores with thin or no answers</h2>
    <p class="verdict">${verdict}</p>${weak.length ? `<ul>${weak.slice(0, 5).map(row).join('')}</ul>` : ''}
    <button type="button" data-goto="league" data-focus="cores-h">See all on League</button></section>`;
}

// ---------- My team: Who carries your answers ----------

function monRow(v, r, rB, first, N, state) {
  const likely = v.cards.filter(isLikelyFieldable);
  const byRef = new Map(likely.map((c) => [cardRef(c), c]));
  const anchoring = likely.flatMap((c) => c.status.A.counted.filter((e) => e.mon === r.mon && e.anchor).map((e) => ({ c, e })));
  const forms = new Set(anchoring.map((x) => x.e.form));
  const varies = forms.size > 1;
  // §2.7 scenario rule (UI review F3): a count that differs between the cases shows both, labelled.
  const b = rB ?? r;
  const k = r.opponents.length, kB = b.opponents.length;
  const c = r.counted - r.anchors, cB = b.counted - b.anchors;
  const clauses = [];
  if (r.anchors || b.anchors) {
    const cards = (n) => (first ? `${n} of ${N} cards` : plural(n, 'card'));
    clauses.push(`anchor vs ${dual(k, kB, (n) => plural(n, 'opponent'))} (${dual(r.anchors, b.anchors, cards)})`);
  } else clauses.push('anchors nothing yet');
  if (c || cB) clauses.push(`also a candidate on ${dual(c, cB, String)}`);
  if (r.spof || b.spof) clauses.push(dual(r.spof, b.spof, (n) => `${n} ${n === 1 ? 'rests' : 'rest'} on it`));
  if (varies) clauses.push('forms vary');
  const groups = [];
  // How it anchors, grouped by the move or ability it anchors with (UI review F6), its answer labels in brackets.
  if (r.anchorBy?.length) {
    groups.push(`How it anchors: ${r.anchorBy.map((x, i) => {
      const keyText = x.via ? esc(x.key) : rc(x.key);
      const labels = x.via && !(x.labels.length === 1 && x.labels[0] === x.key) ? `: ${x.labels.map(rc).join(', ')}` : '';
      return `${keyText} (${i === 0 ? plural(x.count, 'card') : x.count}${labels})`;
    }).join(', ')}`);
  }
  if (r.spofCards.length) {
    const byCore = new Map();
    for (const ref of r.spofCards) { const cd = byRef.get(ref); if (!cd) continue; const n = coreOf(v, cd).name; byCore.set(n, [...(byCore.get(n) ?? []), cd.coach]); }
    groups.push(`Rests on it: ${[...byCore].map(([n, cs]) => `${rc(n)} (${cs.map(esc).join(', ')})`).join(', ')}`);
  }
  if (anchoring.length) {
    const byCoach = new Map();
    for (const { c: cd, e } of anchoring) byCoach.set(cd.coach, [...(byCoach.get(cd.coach) ?? []), `${rc(coreOf(v, cd).name)}${varies || e.form !== baseForm(v, e.mon) ? ` as ${esc(e.form)}` : ''}`]);
    groups.push(`Anchor on: ${[...byCoach].map(([coach, list]) => `${esc(coach)}: ${list.join(', ')}`).join(' · ')}`);
  }
  const cand = [];
  for (const cd of likely) {
    const e = cd.status.A.counted.find((x) => x.mon === r.mon);
    if (e && !e.anchor) cand.push(`${rc(coreOf(v, cd).name)} (${esc(cd.coach)}): ${e.partial ? 'partial' : e.contestedBy ? `contested by ${esc(e.contestedBy.mega ? e.contestedBy.form : e.contestedBy.name)}` : "tech you'd have to bring"}`);
    if (!e && cd.answers.some((a) => a.mon === r.mon && a.counts)) cand.push(`${rc(coreOf(v, cd).name)} (${esc(cd.coach)}): not counted: only one Mega per battle`);
  }
  if (cand.length) groups.push(`Candidate on: ${cand.join('; ')}`);
  const key = `mon|${r.mon}`;
  return `<details class="mon-row" data-key="${esc(key)}"${state.open?.[key] ? ' open' : ''}><summary>${esc(name(v, r.mon))} — ${clauses.join(' · ')}</summary>
    ${groups.length ? `<ul class="small">${groups.map((g) => `<li>${g}</li>`).join('')}</ul>` : '<p class="small muted">No card counts it yet.</p>'}
    <p class="small">${monBtn(v, r.mon, `Open ${name(v, r.mon)}`)}</p></details>`;
}

function restsSection(v) {
  const likely = v.cards.filter((c) => isLikelyFieldable(c) && c.spof.A.length);
  if (!likely.length) return '';
  const byMon = new Map();
  for (const c of likely) for (const m of c.spof.A) byMon.set(m, [...(byMon.get(m) ?? []), c]);
  const rows = [...byMon].map(([m, cs]) => {
    const byCore = new Map();
    for (const c of cs) byCore.set(c.coreId, [...(byCore.get(c.coreId) ?? []), c]);
    const txt = [...byCore.values()].map((list) => `${rc(coreOf(v, list[0]).name)} (${list.map((c) => esc(c.coach)).join(', ')})`).join(', ');
    const only = cs.every((c) => c.status.A.anchors.length === 1 && c.status.A.anchors[0] === m);
    const on = cs.length === 1 ? 'it' : cs.length === 2 ? 'both' : `all ${cs.length}`;
    return `<li>${esc(name(v, m))}: ${txt}.${only ? ` ${esc(name(v, m))} is the only anchor on ${on}.` : ''}</li>`;
  });
  return `<h3>Cards that rest on one mon</h3><ul class="small">${rows.join('')}</ul>`;
}

function showAllBtn(list, key, state) {
  if (list.length <= ROWS_SHOWN) return '';
  const on = !!state.showAll?.[key];
  return `<button type="button" data-cores-all="${key}" aria-expanded="${on}" aria-controls="cores-${key}">${on ? 'Show fewer' : `Show all (${list.length})`}</button>`;
}
const listBlock = (rows, key, state) => {
  const on = !!state.showAll?.[key];
  return `<ul class="small" id="cores-${key}">${rows.map((r, i) => `<li${!on && i >= ROWS_SHOWN ? ' hidden' : ''}>${r}</li>`).join('')}</ul>${showAllBtn(rows, key, state)}`;
};

function weakPointsSection(v, state) {
  const likely = v.cards.filter(isLikelyFieldable);
  const coreName = (c) => coreOf(v, c)?.name ?? c.coreId;
  // (a) one attack type: one row per type
  const typeEvents = likely.flatMap((c) => (c.cofailure.A?.types ?? []).map((e) => ({ c, e })));
  const types = [...new Set(typeEvents.map((x) => x.e.type))].map((T) => {
    const evs = typeEvents.filter((x) => x.e.type === T);
    const groups = new Map();
    for (const x of evs) { const k = [x.c.coreId, x.e.from, x.e.to].join('|'); groups.set(k, [...(groups.get(k) ?? []), x]); }
    const parts = [...groups.values()].map((g) => `${rc(coreName(g[0].c))} (${g.map((x) => esc(x.c.coach)).join(', ')}) would drop from ${esc(label(v, g[0].e.from))} to ${esc(label(v, g[0].e.to))}${g.every((x) => x.e.allAnchorsLost) ? ', and every anchor is hit' : ''}`);
    const victims = new Map();
    for (const { c, e } of evs) for (const [m, x] of Object.entries(e.mult)) {
      const form = c.status.A.counted.find((y) => y.mon === m)?.form;
      if (!victims.has(m) || victims.get(m).x < x) victims.set(m, { x, form });
    }
    const vic = [...victims].sort((a, b) => b[1].x - a[1].x).map(([m, { x, form }]) => `${esc(name(v, m))} ${mult(x)}${form && form !== baseForm(v, m) ? ` (as ${esc(form)})` : ''}`);
    const srcs = [...new Set(evs.flatMap((x) => x.e.sources.map((s) => `${esc(s)} (${esc(x.c.coach)})`)))];
    const attackers = srcs.slice(0, 4).join(', ') + (srcs.length > 4 ? ` +${srcs.length - 4} more` : '');
    return { T, none: evs.some((x) => x.e.to === 'none'), n: evs.length,
      html: `${esc(T)}: ${parts.join('; ')}.<br>Super-effective on ${vic.join(', ')}.<br>Same-type attackers: ${attackers}.` };
  }).sort((a, b) => (b.none - a.none) || (b.n - a.n) || (a.T < b.T ? -1 : a.T > b.T ? 1 : 0));
  // (b) one of their mons, all its types; hidden where a type event of the same coach already co-fails that card (U3)
  const covered = new Set(typeEvents.map((x) => `${x.c.coach}|${x.c.coreId}`));
  const formEvents = likely.flatMap((c) => (c.cofailure.A?.forms ?? []).filter(() => !covered.has(`${c.coach}|${c.coreId}`)).map((e) => ({ c, e })));
  const bySpecies = new Map();
  for (const x of formEvents) { const k = `${x.c.coach}|${x.e.id}`; bySpecies.set(k, [...(bySpecies.get(k) ?? []), x]); }
  const forms = [...bySpecies.values()].map((list) => {
    const formNames = [...new Set(list.map((x) => x.e.form))];
    const typeSets = [...new Set(list.map((x) => x.e.types.join('/')))];
    const perCard = new Map();
    for (const x of list) if (!perCard.has(x.c.coreId)) perCard.set(x.c.coreId, x);
    const sentences = [...perCard.values()].map(({ c, e }) => {
      const counted = c.status.A.counted.map((y) => y.mon);
      const vic = v.me.ids.filter((m) => e.victims.includes(m)).map((m) => esc(name(v, m)));
      const amount = e.victims.length === counted.length ? `all ${e.victims.length} of` : `${e.victims.length} of`;
      return `super-effective on ${amount} your answers to ${rc(coreName(c))}: ${vic.join(', ')}. If those answers were lost, ${rc(coreName(c))} would drop from ${esc(label(v, e.from))} to ${esc(label(v, e.to))}.`;
    });
    const coach = list[0].c.coach;
    return { none: list.some((x) => x.e.to === 'none'), n: perCard.size, order: coachOrder(v, coach),
      html: `${formNames.map(esc).join(' / ')} (${typeSets.map(esc).join(' or ')}) · ${esc(coach)}: ${sentences.join(' Also ')}` };
  }).sort((a, b) => (b.none - a.none) || (b.n - a.n) || (a.order - b.order));
  const limits = '<p class="small muted limits">Same-type attackers only (Attack or Sp. Atk 100+); coverage moves such as Electro Shot aren\'t seen. Super-effective isn\'t a KO: no damage calc, Speed, items or targeting.</p>';
  const body = !types.length && !forms.length
    ? "<p class=\"small\">No single attack type or opposing mon here is super-effective on enough of your answers to lower a card's status.</p>"
    : `${types.length ? `<h4>One attack type</h4>${listBlock(types.map((x) => x.html), 'types', state)}` : ''}${forms.length ? `<h4>One of their mons, all its types</h4>${listBlock(forms.map((x) => x.html), 'forms', state)}` : ''}${limits}`;
  return `<h3>${term('Shared weak points', 'Shared weak point')}</h3>${body}`;
}

function blockersSection(v, state) {
  const rows = v.conc.A.blockers.map((b) => {
    const segs = [];
    for (const x of b.contests) {
      const seg = segs.find((s) => s.via === x.via && s.viaKind === x.viaKind && s.form === x.form) ?? segs[segs.push({ via: x.via, viaKind: x.viaKind, form: x.form, mega: x.mega, groups: [] }) - 1];
      const c = v.cards.find((cd) => cardRef(cd) === x.card);
      const lbl = ansSpec(v, c, x.answer).label ?? x.answer;
      const g = seg.groups.find((y) => y.card === x.card && y.lbl === lbl) ?? seg.groups[seg.groups.push({ card: x.card, lbl, c, mons: [], clash: false }) - 1];
      g.mons.push(name(v, x.mon));
      g.clash ||= x.clashesWithCoreMega;
    }
    // A segment that needs a different (Mega) form than the row's first one says so: Sableye's Magic Bounce is Sableye-Mega's.
    const asForm = (s) => (s.form !== b.form ? ` (as ${esc(s.form)}${s.mega ? ', uses their Mega' : ''})` : '');
    // "contests {answer label} ({Mon}, {Mon}) on {core}" (UI review F8: no possessive on the answer label). A blocker
    // condition with no via (stats / defense / stab) names no ability or type (code review n4).
    const lead = (s) => (s.via ? `${s.viaKind === 'type' ? `can be ${esc(s.via)}-type` : `can have ${esc(s.via)}`}${asForm(s)}: ` : asForm(s) ? `${asForm(s).trim()}: ` : '');
    const text = segs.map((s) => `${lead(s)}contests ${s.groups.map((g) => `${rc(g.lbl)} (${g.mons.map(esc).join(', ')}) on ${rc(coreOf(v, g.c)?.name ?? g.c.coreId)}${g.clash ? ' (only in a game where they skip the Mega that core uses)' : ''}`).join('; ')}`);
    return `${esc(b.form)} (${esc(b.coach)}) ${text.join('; ')}.${b.megaOnly ? ' Uses their Mega.' : ''}`;
  });
  const body = rows.length
    ? `${listBlock(rows, 'blockers', state)}<p class="small muted limits">Checked against their whole pool, so it may not be in their 6. Contested answers still count as candidates; they just can't anchor.</p>`
    : '<p class="small">None of your counted answers is contested by an opposing mon.</p>';
  return `<h3>${term('Contested by one of their mons', 'Contested')}</h3>${body}`;
}

/** My team screen: "Who carries your answers" (UX §4, §7.4, §7.5). Always all opponents. state = {open, showAll}. */
export function renderCarriesPanel(v, { state = {} } = {}) {
  const head = '<h2 id="carries" tabindex="-1">Who carries your answers</h2>';
  const wrap = (inner) => `<section class="panel carries" aria-labelledby="carries">${head}${inner}</section>`;
  if (!v.me.ids.length) return wrap('<p>No picks yet, so nothing carries answers. This fills in as you draft.</p>');
  const conc = v.conc.A, N = conc.cards;
  const forming = formingTotal(v);
  if (!N) return wrap(`<p>No opponent can field a likely core yet, so there's nothing to carry.${pickAway(forming)}</p>`);
  const rows = sortedRows(v, conc);
  const rowsB = new Map(v.conc.B.perMon.map((x) => [x.mon, x]));
  const likely = v.cards.filter(isLikelyFieldable);
  // The verdict for one case: its own top mon, or the no-anchor sentence (UX §4.4 v3.4, final check N1).
  const verdictFor = (sc) => {
    const top = sortedRows(v, v.conc[sc])[0];
    if (!top.anchors) return "None of your mons anchors a card yet: every candidate is partial, contested or tech you'd have to bring.";
    const K = v.conc[sc].opponents; // the same in both cases: detection doesn't depend on the scenario
    const k = top.opponents.length;
    const rests = likely.filter((c) => c.spof[sc].length), r = rests.length;
    const one = r && rests.every((c) => c.spof[sc].length === 1 && c.spof[sc][0] === rests[0].spof[sc][0]) ? rests[0].spof[sc][0] : null;
    const tail = !r ? ' No Has-answers card rests on a single mon.' : one ? ` ${r} ${r === 1 ? 'card rests' : 'cards rest'} on ${esc(name(v, one))} alone.` : ` ${r} ${r === 1 ? 'card rests' : 'cards rest'} on a single mon.`;
    const who = K === 1 ? 'the only opponent that has' : `${k === K ? `all ${K}` : `${k} of the ${K}`} opponents that have`; // K = 1: lead decision
    return `${esc(name(v, top.mon))} carries the most: an anchor against ${who} a likely core (${top.anchors} of ${N} cards).${tail}`;
  };
  const [vA, vB] = [verdictFor('A'), verdictFor('B')];
  // One sentence when the cases agree; otherwise one per case, labelled, pool only first (§2.7).
  const verdict = vA === vB ? vA : `${SCENARIO_LABEL.A}: ${vA} ${SCENARIO_LABEL.B}: ${vB}`;
  // When any card differs between the cases, say which sections show pool only (UI review F3).
  const sig = (c, sc) => JSON.stringify([c.status[sc].key, c.status[sc].anchors, c.spof[sc], c.cofailure[sc]]);
  const differing = likely.filter((c) => sig(c, 'A') !== sig(c, 'B'));
  const scenarioLine = differing.length
    ? `<p class="small scenario-line">Pool only and open team sheets differ on ${plural(differing.length, 'card')} (${differing.map((c) => `${rc(coreOf(v, c)?.name ?? c.coreId)} (${esc(c.coach)})`).join(', ')}). Counts above show both where they differ; the sections below show pool only.</p>`
    : '';
  let scopeLine = `Counts the ${N} likely cores your opponents can field now.${forming ? ` ${plural(forming, 'core')} 1 pick away ${forming === 1 ? "isn't" : "aren't"} counted.` : ''}`;
  const unmatched = v.opponents.reduce((s, o) => s + o.unmatched, 0);
  if (unmatched) scopeLine += ` ${unmatched} unmatched pick(s) left out, so a core may be missing.`;
  if (v.opponents.some((o) => o.slotsLeft > 0)) scopeLine += " Rosters aren't complete, so these counts can change.";
  return wrap(`<p class="verdict">${verdict}</p>
    <p class="small scope-line">${scopeLine}</p>
    <p class="small honesty">Candidate answers, not results. An anchor doesn't depend on choosing tech for the match, except on High-prep cores. Losing a mon here means KO'd or benched (a Fake Out costs it one turn).</p>
    ${scenarioLine}
    <div class="mon-rows">${rows.map((x, i) => monRow(v, x, rowsB.get(x.mon), i === 0, N, state)).join('')}</div>
    ${restsSection(v)}
    ${weakPointsSection(v, state)}
    ${blockersSection(v, state)}
    <p class="explainer">Each card counts once for each mon that anchors it. A mon that anchors many cards is one your 6 can least afford to leave out or lose early. A card that rests on one mon drops to Thin without it. This is about where your answers are concentrated, not a matchup result.</p>`);
}

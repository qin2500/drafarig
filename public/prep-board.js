// Battle Prep › Plan: the game-plan board (UX-VISUAL-TOOLS.md §2, VGC-PLAN-TOOLS.md §5).
// - Their plans are pills.
// - For the selected plan: their side faces your Lead / Back / Mega slots, filled by tapping your 6.
// - Lead and back ideas come with checkable reasons; three status lights.
// - Your 6 shows what it covers, with "fill a gap".
// Picks are species (card.species); a set is attached only when it's your only set for that species. Nothing is saved
// until a tap, and the app never picks for you.
import { boardTargets, boardContext, coverage, fillGap, rankLeadPairs, rankBackPairs, SEEDS, LOOK_FIRST } from '../lib/prep-board.mjs';
import { ownerOf, workspacesFor } from '../lib/prep-matchup.mjs';
import { newWorkspace } from '../lib/prep-schema.mjs';
import { currentVersion, defaultVariant } from '../lib/prep-model.mjs';
import { planRung } from '../lib/prep-coverage.mjs';
import * as C from './prep-copy.js';
import { esc, attrs, btn, chipBtn } from './prep-ui.js';
import { modelFor, sixOf, savedSpeeds } from './prep-matchup.js';
import { variantOf, theirSetFor } from './prep-sets.js';

const MODE_ICON = { 'trick-room': 'i-tr', tailwind: 'i-tw', sun: 'i-sun', rain: 'i-rain', sand: 'i-sand', 'snow-veil': 'i-snow', 'seed-trick-room': 'i-tr', 'seed-tailwind': 'i-tw', 'seed-sun': 'i-sun', 'seed-rain': 'i-rain', 'seed-sand': 'i-sand', 'seed-snow': 'i-snow' };
const icon = (key) => (MODE_ICON[key] ? `<svg class="ic" aria-hidden="true" focusable="false"><use href="#${MODE_ICON[key]}"></use></svg>` : '');
const uniq = (a) => [...new Set(a)];
const ROLES = [['lead', 0], ['lead', 1], ['back', 0], ['back', 1]];

// ---------- model ----------
/** The board's state for a workspace: null when the matchup can't be read (no owner yet, or the sheet hasn't loaded). */
export function boardModel(P, ws) {
  const owner = ownerOf(ws);
  const coaches = P.coaches() ?? [];
  const pov = owner ? coaches.find((c) => c.name === owner) : null, opp = coaches.find((c) => c.name === ws.coach);
  if (!pov || !opp || pov.name === opp.name) return null;
  const { b } = modelFor(P, pov, opp, ws, { lens: '10' });
  const roster = pov.picks.map((p) => p.id).filter(Boolean);
  const six = sixOf(P, ws).filter((id) => roster.includes(id));
  const { targets, couldAlso } = boardTargets(b, ws.plans);
  const exact = P.identity() === pov.name ? savedSpeeds(P, pov, ws).mine : {};
  const ctx = boardContext({ dex: P.app.dex, cx: P.app.coresCx?.() ?? null, b, roster, theirIds: opp.picks.map((p) => p.id).filter(Boolean), savedMine: exact });
  const ui = boardUi(P, ws);
  const target = targets.find((t) => t.key === ui.sel) ?? targets[0] ?? null;
  return { pov, opp, b, roster, six, targets, couldAlso, ctx, target, ui };
}
export const boardUi = (P, ws) => (P.wsUi(ws.id).pb ??= { sel: null, slot: null, gap: null, gapSkip: [], gapIdx: 0, edit6: false, calcs: false });
/** The plan card answering a saved plan (the first one). */
export const cardFor = (ws, planId) => (planId ? ws.cards.find((c) => c.kind === 'plan' && (c.vsPlanIds ?? []).includes(planId)) ?? null : null);
/** A card's picks as species: from card.species, else from the sets a v4 card holds. */
export function cardPicks(P, card) {
  if (!card) return { bring: [], lead: [], back: [], mega: '', megaForm: '' };
  const spOf = (id) => P.lineage(id)?.speciesId ?? null;
  if (card.species) {
    const bring = uniq(card.species.bring4 ?? []), lead = uniq(card.species.lead ?? []).filter((x) => bring.includes(x));
    return { bring, lead, back: bring.filter((x) => !lead.includes(x)), mega: card.species.mega || '', megaForm: card.species.megaForm || '' };
  }
  const bring = uniq((card.bring4 ?? []).map(spOf).filter(Boolean)), lead = uniq((card.lead ?? []).map(spOf).filter(Boolean)).filter((x) => bring.includes(x));
  const megaSp = card.mega ? spOf(card.mega) : '';
  const stone = megaSp ? P.mech?.items[currentVersion(P.lineage(card.mega)).data.item]?.megaStone?.[megaSp] : null;
  return { bring, lead, back: bring.filter((x) => !lead.includes(x)), mega: megaSp || '', megaForm: stone || '' };
}
/** The set attached for a species on a card (set ids kept from before), if any. */
const attachedSet = (P, card, sp) => (card?.bring4 ?? []).find((id) => P.lineage(id)?.speciesId === sp) ?? null;
const megaForms = (P, sp) => (P.app.dex.species[sp]?.forms ?? []).filter((f) => f.mega);
const speciesOfKey = (P, k) => { const id = String(k ?? '').replace(/^[mt]:/, ''); return P.app.dex.species[id] ? id : P.dexSp(id)?.id ?? null; };

// ---------- writes (explicit taps only) ----------
/**
 * Write picks to a card: card.species is the source; the set-based fields keep any set still matching a species and
 * attach a set only when it's your only one for that species (your own side only; never created here).
 */
function writePicks(P, d, card, picks) {
  const lead = uniq(picks.lead).filter((x) => picks.bring.includes(x)).slice(0, 2);
  const mega = picks.mega && picks.bring.includes(picks.mega) ? picks.mega : '';
  const megaForm = mega && megaForms(P, mega).some((f) => f.id === picks.megaForm) ? picks.megaForm : mega && megaForms(P, mega).length === 1 ? megaForms(P, mega)[0].id : '';
  card.species = { bring4: uniq(picks.bring).slice(0, 10), lead, mega, megaForm, ...(card.species?.speed ? { speed: card.species.speed } : {}) };
  const spOf = (id) => P.lineage(id)?.speciesId ?? null;
  const setFor = (sp) => {
    const kept = (card.bring4 ?? []).find((id) => spOf(id) === sp);
    if (kept) return kept;
    if (!P.canWriteMine()) return null;
    const inSix = d.my6.map((m) => m.setId).filter((id) => spOf(id) === sp);
    if (inSix.length) return inSix.length === 1 ? inSix[0] : null;
    const lib = P.mineSets().filter((s) => s.speciesId === sp);
    return lib.length === 1 ? lib[0].id : null;
  };
  const ids = Object.fromEntries(card.species.bring4.map((sp) => [sp, setFor(sp)]));
  card.bring4 = card.species.bring4.map((sp) => ids[sp]).filter(Boolean);
  card.lead = lead.map((sp) => ids[sp]).filter(Boolean);
  card.back = card.bring4.filter((id) => !card.lead.includes(id));
  const megaSet = mega ? ids[mega] : null;
  const stoneOf = (id) => P.mech?.items[currentVersion(P.lineage(id)).data.item]?.megaStone?.[mega] ?? null;
  card.mega = megaSet && stoneOf(megaSet) && (!megaForm || stoneOf(megaSet) === megaForm) ? megaSet : null;
  card.updatedAt = P.now();
}
/** Save an unsaved target as a plan (its first pick is the explicit tap); returns the plan id. */
function savePlan(P, d, t) {
  const megaName = t.megaUser ? P.spName(t.megaUser) : '';
  const label = t.source === 'suggested' ? `${t.label}${megaName ? ` (Mega ${megaName})` : ''}` : C.BOARD.seed[t.seed] ?? '';
  const id = P.id('plan');
  d.plans.push({ id, label: label.slice(0, 60), kind: t.source === 'suggested' && t.confidence === 'likely' && !d.plans.some((p) => p.kind === 'likely') ? 'likely' : 'alt',
    members: [...t.members].slice(0, 10), megaUser: t.megaUser, speedMode: t.speedMode, field: t.field ?? '', needs: '', basis: [t.coreId ?? t.seed], falsifiers: { atPreview: [...t.tells].slice(0, 10), inGame: [] }, updatedAt: P.now() });
  return id;
}
function newCard(P, planId) {
  return { id: P.id('card'), kind: 'plan', vsPlanIds: [planId], bring4: [], lead: [], back: [], mega: null, turn1Intent: '', winCondition: '', ifThen: [], infoPlan: [], updatedAt: P.now() };
}
/**
 * Change the selected target's card: `fn(picks)` returns the new picks. Saves the plan and creates the card on the first
 * pick (both explicit). Returns false when nothing could be written (read-only, earlier prep, …).
 */
function editPicks(P, ws, fn, say = null) {
  const m = boardModel(P, ws);
  const t = m?.target;
  if (!t) return false;
  const ui = m.ui;
  let selKey = t.key;
  const ok = P.mutate(`ws:${ws.id}`, (d) => {
    let planId = t.planId;
    if (!planId) { planId = savePlan(P, d, t); selKey = `plan:${planId}`; }
    let card = cardFor(d, planId);
    if (!card) { card = newCard(P, planId); d.cards.push(card); }
    writePicks(P, d, card, fn(cardPicks(P, card)));
  });
  if (ok) { ui.sel = selKey; ui.slot = null; P.saveUi?.(); if (say) P.app.announce?.(say); }
  return ok;
}

// ---------- pieces ----------
const pt = (P, id, size = 'sm') => P.pt(id, { size });
const name = (P) => (id) => P.spName(id);
function pill(P, t, on, rung) {
  const label = t.source === 'saved' ? (t.label || C.PLAN_KIND[t.kind]) : t.source === 'suggested' ? `${t.label}${t.megaUser ? ` (Mega ${P.spName(t.megaUser)})` : ''}` : C.BOARD.seed[t.seed];
  const word = t.source === 'saved' ? C.BOARD.kind[t.kind] : t.source === 'suggested' ? C.BOARD.suggested : t.source === 'seed' ? C.BOARD.seedWord : '';
  const minis = t.focus.slice(0, 4).map((id) => pt(P, id, 'xs')).join('');
  return `<button${attrs({ type: 'button', class: `ppill${on ? ' on' : ''}${t.source === 'saved' ? '' : ' unsaved'}`, 'data-pa': 'pb-target', 'data-key': t.key, 'aria-pressed': String(on),
    'aria-label': `${label}${word ? `, ${word}` : ''}${rung ? `, ${rung}` : ''}` })}><span class="pp-top">${icon(t.coreId ?? t.seed)}<span class="pp-label">${esc(label)}</span></span><span class="pp-minis" aria-hidden="true">${minis}</span><span class="pp-word" aria-hidden="true">${esc([word, rung].filter(Boolean).join(' · '))}</span></button>`;
}
/** A slot: a 64 px portrait button (filled) or a dashed "+" (empty); the next empty slot is ringed with the word "next". */
function slot(P, role, i, sp, { next, card, locked, open = null }) {
  const label = role === 'lead' ? C.BOARD.lead : C.BOARD.back;
  if (!sp) {
    return `<button${attrs({ type: 'button', class: `pslot empty${next ? ' next' : ''}`, 'data-pa': 'pb-slot', 'data-role': role, 'data-i': i, disabled: locked, 'aria-label': C.BOARD.slotEmpty(label, i + 1) })}><span class="ps-plus" aria-hidden="true">+</span>${next ? `<span class="ps-next">${esc(C.BOARD.next)}</span>` : ''}</button>`;
  }
  const set = attachedSet(P, card, sp);
  return `<button${attrs({ type: 'button', class: 'pslot', 'data-pa': 'pb-slot', 'data-role': role, 'data-i': i, 'data-species': sp, disabled: locked, 'aria-expanded': String(open === sp), 'aria-label': C.BOARD.slotFilled(label, i + 1, P.spName(sp), !!set) })}>${pt(P, sp, 'md')}<span class="ps-name">${esc(P.spName(sp))}</span><span class="ps-dot ${set ? 'set' : 'noset'}" aria-hidden="true" title="${esc(set ? C.BOARD.setAttached : C.BOARD.noSet)}"></span></button>`;
}
/**
 * Glyph chips for a pair's evidence (each a fact with its words; colour always beside a glyph and a word; glyphs are hidden
 * from screen readers, the words say it). picks: the card's Mega pick, so a hit that needs another Mega form says so.
 */
function glyphs(P, ev, mode, { max = 6, picks = null } = {}) {
  const n = name(P), G = C.BOARD.glyph, out = [];
  const gl = (glyph, words) => `<span aria-hidden="true">${esc(glyph)}</span> ${esc(words)}`;
  const formId = (sp, formName) => (P.app.dex.species[sp]?.forms ?? []).find((f) => f.name === formName)?.id ?? null;
  for (const a of ev.answers) out.push(`<li class="gl ok${a.anchor ? '' : ' weak'}">${gl('✓', G.answer(a.label, a.anchor))} <span class="small muted">(${esc(n(a.mon))}${a.contestedBy ? `, ${esc(G.contested(n(a.contestedBy)))}` : ''})</span></li>`);
  for (const h of ev.hits) {
    const form = h.mega ? h.formName : null;
    const other = form && picks?.mega === h.mon && picks.megaForm && picks.megaForm !== formId(h.mon, form) ? (P.app.dex.species[h.mon]?.forms ?? []).find((f) => f.id === picks.megaForm)?.name : null;
    out.push(`<li class="gl ok${h.mega ? ' weak' : ''}">${gl(`×${h.mult}`, G.hitSay(n(h.mon), n(h.t), form))}${other ? ` <span class="small">${esc(G.megaMismatch(form, other))}</span>` : ''}</li>`);
  }
  for (const w of ev.walls) out.push(`<li class="gl ok">${gl('🛡', G.wallSay(n(w.mon), n(w.t)))}</li>`);
  for (const sp of ev.speed.filter((x) => x.result === 'first' || x.result === 'second' || x.result === 'tie')) out.push(`<li class="gl ${sp.result === 'first' ? 'ok' : sp.result === 'second' ? 'bad' : 'mute'}">${gl(G.speed[sp.result], G.speedSay[sp.result](n(sp.mon), n(sp.t), G.mode[mode] ?? ''))}</li>`);
  // Speed that depends on spreads: one grey chip per mon of yours (not hidden: it's a fact too)
  const dep = new Map();
  for (const sp of ev.speed.filter((x) => x.result === 'depends')) dep.set(sp.mon, [...(dep.get(sp.mon) ?? []), sp.t]);
  for (const [m, ts] of dep) out.push(`<li class="gl mute">${gl(G.speed.depends, G.speedDepends(n(m), ts.map(n).join(', '), G.mode[mode] ?? ''))}</li>`);
  for (const t of ev.shared) out.push(`<li class="gl bad">${gl('⚠', G.shared(n(t)))}</li>`);
  if (ev.needsTwoMegas) out.push(`<li class="gl warn">${gl('⚠', G.twoMegas)}</li>`);
  const shown = out.slice(0, max), rest = out.slice(max);
  return `<ul class="glyphs">${shown.join('')}</ul>${rest.length ? `<details class="small"><summary>${esc(C.BOARD.more)} (${rest.length})</summary><ul class="glyphs">${rest.join('')}</ul></details>` : ''}`;
}
/** Calc and Speed checks for a lead against a target: lead × the first 2 of its focus (tells first). */
function checksFor(P, ws, m, lead) {
  const focus = m.target.focus.slice(0, 2);
  const calcs = [], speeds = [];
  for (const L of lead) for (const t of focus) {
    const c = ws.calcs.filter((x) => { const a = x.scenario?.attacker?.set?.species, d = x.scenario?.defender?.set?.species; return (a === t && d === L) || (a === L && d === t); });
    const fresh = c.find((x) => !P.staleOf(ws, x).length);
    calcs.push({ L, t, calc: fresh ?? c[0] ?? null, stale: !fresh && c.length > 0 });
    const done = ws.speedChecks.some((s) => { const a = speciesOfKey(P, s.a), b = speciesOfKey(P, s.b); return (a === L && b === t) || (a === t && b === L); });
    speeds.push({ L, t, done });
  }
  return { calcs, speeds };
}
function lights(P, ws, m, card, lead) {
  const t = m.target;
  if (!lead.length) return `<div class="lights"><span class="small muted">${esc(C.BOARD.lightNone)}</span></div>`;
  const { calcs, speeds } = checksFor(P, ws, m, lead);
  const sDone = speeds.filter((s) => s.done).length, cDone = calcs.filter((c) => c.calc && !c.stale).length, cStale = calcs.filter((c) => c.stale).length;
  const games = t.planId ? [...ws.mockSets.flatMap((x) => x.games ?? []), ...ws.matches.flatMap((x) => x.games ?? [])].filter((g) => g.planId === t.planId && g.result).length : 0;
  const rung = t.planId ? C.RUNG[planRung(ws, t.planId, m.facts)] : C.RUNG['not-yet'];
  const state = (n, of, warn) => (warn ? 'warn' : n === 0 ? 'none' : n >= of ? 'done' : 'some');
  const glyph = { none: '○', some: '◐', done: '●', warn: '⚠' };
  const light = (key, st, say, data = {}) => `<button${attrs({ type: 'button', class: `light l-${st}`, 'data-pa': `pb-light-${key}`, ...Object.fromEntries(Object.entries(data).map(([k, v]) => [`data-${k}`, v])), 'aria-label': say })}><span class="lg" aria-hidden="true">${glyph[st]}</span> <span>${esc(C.BOARD.lights[key])}</span> <span class="small">${esc(say.replace(/^[^:]+: /, ''))}</span></button>`;
  const ui = m.ui;
  const list = ui.calcs ? `<ul class="pcalcs">${calcs.map((c) => `<li>${pt(P, c.t, 'xs')} → ${pt(P, c.L, 'xs')} <span>${esc(C.BOARD.calcAsk(P.spName(c.L), P.spName(c.t)))}</span> ${c.stale ? `<span class="chip tight">⟳ ${esc(C.BOARD.calcStale)}</span>` : ''}${btn(c.calc ? C.BOARD.calcOpen : C.BOARD.calcRun, 'pb-calc', { mine: c.L, theirs: c.t, card: card?.id ?? '' }, { cls: 'linkish' })}</li>`).join('')}</ul>` : '';
  return `<div class="lights" role="group" aria-label="${esc(C.BOARD.lights.speed)}, ${esc(C.BOARD.lights.calcs)}, ${esc(C.BOARD.lights.practised)}">
    ${light('speed', state(sDone, speeds.length), C.BOARD.lightSay.speed(sDone, speeds.length))}
    ${light('calcs', state(cDone, calcs.length, cStale > 0), C.BOARD.lightSay.calcs(cDone, calcs.length, cStale))}
    ${light('practised', games ? (['rehearsed', 'rehearsed broadly'].includes(rung) ? 'done' : 'some') : 'none', C.BOARD.lightSay.practised(games, rung))}</div>${list}`;
}

// ---------- the board ----------
/** The Plan board, or null when it can't be read (the caller shows the saved plans without suggestions). */
export function board(P, ws, facts) {
  const m = boardModel(P, ws);
  if (!m) return null;
  m.facts = facts;
  const { targets, target, ui, six } = m;
  const locked = P.readOnly() || !ownerOf(ws);
  const ideas = ws.plans.filter((p) => p.kind === 'idea');
  const rungOf = (t) => (t.planId ? C.RUNG[planRung(ws, t.planId, facts)] : '');
  const pills = `<div class="ppills" role="group" aria-label="${esc(C.BOARD.theirPlans)}">${targets.map((t) => pill(P, t, t === target, rungOf(t))).join('')}${btn(C.BOARD.addPlan, 'plan-new', {}, { cls: 'ppill add', disabled: locked })}</div>
    ${ideas.length ? `<p class="small">${esc(C.BOARD.ideas)}: ${ideas.map((p) => btn(p.label || C.PLAN_KIND.idea, 'open-plan', { plan: p.id }, { cls: 'linkish' })).join(' · ')}</p>` : ''}
    ${m.couldAlso.map((c) => `<p class="small muted">${esc(C.BOARD.couldAlso(C.BOARD.couldWhat[c.seed], c.ids.map(name(P)).join(', ')))}</p>`).join('')}`;
  const head = `<section class="pb-plans" aria-labelledby="pb-plans-h"><h3 id="pb-plans-h">${esc(C.BOARD.theirPlans)} <span class="small muted">${esc(C.BOARD.pick)}</span></h3>${pills}</section>`;
  if (!target) { const tr = sixTray(P, ws, m, null, locked); return `${head}<p class="small">${esc(C.BOARD.noTargets(ws.coach))}</p>${tr.tiles}${tr.cover}`; }

  const card = cardFor(ws, target.planId);
  const picks = cardPicks(P, card);
  const lead = picks.lead, back = picks.back;
  const filled = { lead, back };
  const nextSlot = ROLES.find(([r, i]) => !filled[r][i]);
  const slotRow = (role) => [0, 1].map((i) => slot(P, role, i, filled[role][i], { next: !locked && nextSlot && nextSlot[0] === role && nextSlot[1] === i, card, locked, open: ui.slot })).join('');
  // the tapped slot's actions (move, remove, its set)
  const open = ui.slot && picks.bring.includes(ui.slot) ? ui.slot : null;
  const slotMenu = open ? `<div class="slotmenu" role="group" aria-label="${esc(P.spName(open))}">${lead.includes(open) ? btn(C.BOARD.moveBack, 'pb-move', { species: open, to: 'back' }, { disabled: back.length >= 2 }) : btn(C.BOARD.moveLead, 'pb-move', { species: open, to: 'lead' })}
    ${btn(C.BOARD.remove, 'pb-remove', { species: open })} ${attachedSet(P, card, open) ? btn(C.BOARD.openSet, 'brief-set', { side: 'mine', species: open }, { cls: 'linkish' }) : P.canWriteMine() ? btn(C.BOARD.startSet, 'brief-set', { side: 'mine', species: open }, { cls: 'linkish' }) : ''}</div>` : '';
  const megaOpts = picks.bring.flatMap((sp) => megaForms(P, sp).map((f) => ({ sp, f })));
  const megaRow = megaOpts.length ? `<div class="pb-row"><span class="pb-lab">${esc(C.BOARD.mega)}</span><span class="choices" role="group" aria-label="${esc(C.BOARD.mega)}">${chipBtn(C.BOARD.noMega, 'pb-mega', { species: '', form: '' }, !picks.mega, { disabled: locked })}${megaOpts.map(({ sp, f }) => chipBtn(`◆ ${f.name.replace(/-Mega/, ' Mega')}`, 'pb-mega', { species: sp, form: f.id }, picks.mega === sp && (picks.megaForm === f.id || (!picks.megaForm && megaForms(P, sp).length === 1)), { disabled: locked })).join('')}</span> <span class="small muted">${esc(C.BOARD.megaOne)}</span>${picks.mega && !picks.megaForm && megaForms(P, picks.mega).length > 1 ? ` <span class="chip tight">${esc(C.BOARD.megaWhich(megaForms(P, picks.mega).map((f) => f.name.replace(/-Mega/, ' Mega')).join(' or ')))}</span>` : ''}</div>` : '';
  const ready = lead.length === 2 && back.length >= 2;
  // their side: focus portraits (tells marked ◎, their Mega ◆)
  const them = target.focus.map((id) => `<span class="pb-mon${target.tells.includes(id) && target.tells.length < target.focus.length ? ' tell' : ''}">${pt(P, id, 'sm')}<span class="ps-name">${esc(P.spName(id))}</span>${target.megaUser === id ? `<span class="megad inline" title="${esc(C.BOARD.theirMega)}">◆</span>` : ''}${target.tells.includes(id) && target.tells.length < target.focus.length ? `<span class="small muted">◎ ${esc(C.BOARD.tell)}</span>` : ''}</span>`).join('');
  // the verdict line for the chosen lead, and ideas to try
  const ranked = six.length >= 2 ? rankLeadPairs(m.ctx, six, target) : [];
  const leadEv = lead.length === 2 ? (ranked.find((r) => r.pair.every((x) => lead.includes(x)))?.evidence ?? rankLeadPairs(m.ctx, lead, target)[0]?.evidence) : null;
  const calcExists = lead.length === 2 && checksFor(P, ws, m, lead).calcs.some((c) => c.calc && !c.stale);
  const verdict = leadEv ? `<div class="pb-verdict"><p><b>${esc(C.BOARD.headFor(lead.map(name(P)).join(' + ')))}</b> <span class="hl hl-${leadEv.headline}">${esc(C.BOARD.headline[leadEv.headline])}</span> <span class="small muted">· ${esc(calcExists ? C.BOARD.checked : C.BOARD.notChecked)}</span></p>${glyphs(P, leadEv, target.speedMode, { picks })}</div>` : '';
  const tries = ranked.filter((r) => !(lead.length === 2 && r.pair.every((x) => lead.includes(x)))).slice(0, 2);
  const tryBlock = six.length < 2 ? `<p class="small muted">${esc(C.BOARD.needSix)}</p>`
    : `<div class="pb-try"><h4>${esc(C.BOARD.tryHead)}</h4><ul class="tries">${tries.map((r) => `<li class="try"><span class="tpair">${r.pair.map((id) => pt(P, id, 'sm')).join('')}<b>${esc(r.pair.map(name(P)).join(' + '))}</b> <span class="hl hl-${r.evidence.headline}">${esc(C.BOARD.headline[r.evidence.headline])}</span></span>${glyphs(P, r.evidence, target.speedMode, { max: 4, picks })}${btn(C.BOARD.tryBtn, 'pb-try', { a: r.pair[0], b: r.pair[1] }, { disabled: locked })}</li>`).join('')}</ul>
      <p class="small muted">${esc(C.BOARD.notChecked)}</p></div>`;
  let backBlock = '';
  if (lead.length === 2 && six.length >= 4) {
    const bk = rankBackPairs(m.ctx, six, lead, target, targets);
    const best = bk.pairs.filter((x) => !x.pair.every((id) => back.includes(id))).slice(0, 2);
    backBlock = `<div class="pb-try"><h4>${esc(C.BOARD.backHead)}</h4><p class="small">${esc(bk.open.length ? C.BOARD.backOpen(bk.open.map(name(P)).join(', ')) : C.BOARD.backAllDone)}</p>
      <ul class="tries">${best.map((x) => `<li class="try"><span class="tpair">${x.pair.map((id) => pt(P, id, 'sm')).join('')}<b>${esc(x.pair.map(name(P)).join(' + '))}</b></span>${btn(C.BOARD.backBtn, 'pb-back', { a: x.pair[0], b: x.pair[1] }, { disabled: locked })}</li>`).join('')}</ul></div>`;
  }
  const lines = (card?.ifThen ?? []).filter((l) => l.response);
  const notes = card ? `<details class="pb-notes"><summary>${esc(C.BOARD.notes)}</summary>
      <label class="field" for="card-t1"><span>What your lead does turn 1</span><input id="card-t1" data-pi="card-t1" data-card="${esc(card.id)}" value="${esc(card.turn1Intent ?? '')}" maxlength="160"${locked ? ' disabled' : ''}></label>
      <label class="field" for="card-win"><span>Win condition: what has to be true at the end?</span><input id="card-win" data-pi="card-win" data-card="${esc(card.id)}" value="${esc(card.winCondition ?? '')}" maxlength="160"${locked ? ' disabled' : ''}></label>
      ${lines.map((l) => `<p class="small">${esc(C.BOARD.ifThen((l.trigger?.theirLead ?? []).map(name(P)).join(' + ') || '…', l.response))}</p>`).join('')}
      <p>${btn(C.BOARD.editLines, 'open-card', { card: card.id }, { cls: 'linkish' })}</p></details>` : '';
  // more than one card against this plan (made in v4 or with "+ Plan card against this"): the board edits the first; the rest stay listed
  const otherCards = target.planId ? ws.cards.filter((c) => c.kind === 'plan' && c !== card && (c.vsPlanIds ?? []).includes(target.planId)) : [];
  const others = otherCards.length ? `<p class="small">${esc(C.BOARD.otherCards)} ${otherCards.map((c, i) => btn(C.BOARD.cardN(i + 2, cardPicks(P, c).lead.map(name(P)).join(' + ')), 'open-card', { card: c.id }, { cls: 'linkish' })).join(' · ')}</p>` : '';
  const note = target.source === 'seed' ? C.BOARD.seedNote : target.source === 'look-first' ? C.BOARD.lookFirstNote : target.source === 'suggested' ? C.BOARD.unsavedNote : '';
  const why = target.coreId ? m.b.theirPlans.find((p) => p.coreId === target.coreId)?.oneLineWhy : '';
  const tray = sixTray(P, ws, m, card, locked);
  const cardHtml = `<section class="pb-card${ready ? ' ready' : ''}" aria-labelledby="pb-card-h">
    <div class="pb-head"><h3 id="pb-card-h">${icon(target.coreId ?? target.seed)} vs ${esc(target.source === 'saved' ? (target.label || C.PLAN_KIND[target.kind]) : target.source === 'suggested' ? target.label : C.BOARD.seed[target.seed])}</h3>${target.planId ? btn(`⋯ ${C.BOARD.edit}`, 'open-plan', { plan: target.planId }, { cls: 'linkish' }) : ''}</div>
    ${why ? `<p class="small">${esc(why)}</p>` : ''}${note ? `<p class="small muted">${esc(note)}</p>` : ''}
    <div class="pb-side them"><span class="pb-lab">${esc(C.BOARD.theirSide)}</span><div class="pb-mons">${them}</div></div>
    <div class="pb-vs" aria-hidden="true">${esc(C.BOARD.vs)}</div>
    <div class="pb-side you"><span class="pb-lab">${esc(C.BOARD.yourSide)}</span>
      ${locked && !P.readOnly() ? `<p class="small">🔒 ${esc(C.BOARD.locked.earlier)}</p>` : ''}
      <div class="pb-row"><span class="pb-lab">${esc(C.BOARD.lead)}</span>${slotRow('lead')}</div>
      <div class="pb-row"><span class="pb-lab">${esc(C.BOARD.back)}</span>${slotRow('back')}</div>
      ${slotMenu}${megaRow}
      ${!picks.bring.length ? `<p class="small muted">${esc(six.length ? C.BOARD.tapHint : C.BOARD.tapHintNoSix)}</p>` : ''}
      ${tray.tiles}
      ${ready ? `<p class="small ready-line">✓ ${esc(C.BOARD.ready)} <span class="muted">(${esc(C.BOARD.readyHelp)})</span></p>` : ''}</div>
    ${lights(P, ws, m, card, lead)}
    ${verdict}${tryBlock}${backBlock}
    ${notes}${others}</section>`;
  return `${head}${cardHtml}${tray.cover}`;
}

/** Your 6 (tap = place in the next slot, or take it off this plan), what it covers, and "fill a gap". */
function sixTray(P, ws, m, card, locked) {
  const { six, roster, ui, target } = m;
  const picks = cardPicks(P, card);
  const fromSets = new Set((ws.my6 ?? []).map((x) => P.lineage(x.setId)?.speciesId).filter(Boolean));
  const tile = (id) => {
    const on = picks.bring.includes(id);
    return `<button${attrs({ type: 'button', class: `tslot btn${on ? ' on' : ''}`, 'data-pa': 'pb-pick', 'data-species': id, 'aria-pressed': String(on), disabled: locked || !target,
      'aria-label': `${P.spName(id)}${on ? `, ${picks.lead.includes(id) ? C.BOARD.lead : C.BOARD.back}` : ''}` })}>${pt(P, id, 'sm')}<span class="ps-name">${esc(P.spName(id))}</span>${on ? `<span class="tmark" aria-hidden="true">${picks.lead.includes(id) ? 'L' : 'B'}</span>` : ''}</button>`;
  };
  // with no 6 yet, the picker is open from the start (the slots ask for your 6, so it must be right there)
  const editing = ui.edit6 || !six.length;
  const edit = editing ? `${!six.length ? `<p class="small"><b>${esc(C.BOARD.pickSix)}</b></p>` : ''}<div class="six-edit" role="group" aria-label="${esc(C.BOARD.sixEdit)}">${roster.map((id) => {
    const inSix = six.includes(id), locked6 = fromSets.has(id);
    return `<button${attrs({ type: 'button', class: `tslot btn${inSix ? ' on' : ''}`, 'data-pa': 'pb-six', 'data-species': id, 'aria-pressed': String(inSix), disabled: locked || locked6,
      'aria-label': locked6 ? `${P.spName(id)}, ${C.BOARD.sixFromSets}` : inSix ? C.BOARD.sixRemove(P.spName(id)) : C.BOARD.sixAdd(P.spName(id)) })}>${pt(P, id, 'sm')}<span class="ps-name">${esc(P.spName(id))}</span>${inSix ? '<span class="tmark" aria-hidden="true">✓</span>' : ''}</button>`;
  }).join('')}${six.length ? btn(C.BOARD.sixDone, 'pb-six-edit', {}, { primary: true }) : ''}</div>` : '';
  // what your 6 covers
  const items = coverage(m.ctx, m.targets, six);
  const covTile = (i) => {
    const st = i.covered ?? 'gap';
    const label = i.kind === 'mon' ? P.spName(i.mon) : i.target.source === 'saved' ? (i.target.label || C.PLAN_KIND[i.target.kind]) : i.target.source === 'suggested' ? i.target.label : C.BOARD.seed[i.target.seed];
    const say = `${label}: ${C.BOARD.covSay[st]}${i.by.length ? ` (${i.by.map(name(P)).join(', ')})` : ''}`;
    return `<li class="cov c-${st}" title="${esc(say)}"><span class="cg" aria-hidden="true">${st === 'gap' ? '○' : st === 'outline' ? '◐' : '●'}</span>${i.kind === 'mon' ? pt(P, i.mon, 'xs') : icon(i.target.coreId ?? i.target.seed)}<span class="vh">${esc(say)}</span><span class="cov-n" aria-hidden="true">${esc(label)}</span></li>`;
  };
  let gap = '';
  if (ui.gap) {
    const g = fillGap(m.ctx, m.targets, six, { gapKey: ui.gap === true ? null : ui.gap });
    if (!g.gap) gap = `<p class="small">✓ ${esc(C.BOARD.gapNone)}</p>`;
    else {
      const what = g.gap.kind === 'mon' ? P.spName(g.gap.mon) : g.gap.target.source === 'saved' ? (g.gap.target.label || C.PLAN_KIND[g.gap.target.kind]) : g.gap.target.source === 'suggested' ? g.gap.target.label : C.BOARD.seed[g.gap.target.seed];
      const c = g.candidates[ui.gapIdx % Math.max(1, g.candidates.length)];
      gap = `<div class="gapbox"><p><b>${esc(C.BOARD.gapFor(what))}</b></p>
        ${c ? `<p>${pt(P, c.id, 'sm')} <b>${esc(P.spName(c.id))}</b>: ${esc(C.BOARD.gapWhy[c.strength])}</p><p>${six.length < 6 ? btn(C.BOARD.gapAdd(P.spName(c.id)), 'pb-six', { species: c.id }, { primary: true, disabled: locked }) : ''} ${g.candidates.length > 1 ? btn(C.BOARD.another, 'pb-gap-next') : ''} ${btn(C.BOARD.skip, 'pb-gap-close')}</p>
          ${g.fallback && g.gap.kind === 'mon' ? `<p class="small">${esc(C.BOARD.noCandidate(what))}</p>` : ''}`
        : `<p class="small">${esc(C.BOARD.noCandidate(what))}</p><p>${btn(C.BOARD.skip, 'pb-gap-close')}</p>`}
        ${g.freeToSwap.length ? `<p class="small">${esc(C.BOARD.freeSwap(g.freeToSwap.map(name(P)).join(', ')))}</p>` : ''}</div>`;
    }
  }
  const tiles = `<div class="pb-tray${six.length ? ' has-six' : ''}" id="pb-tray" tabindex="-1"><p class="pb-trayh"><b>${esc(C.BOARD.six)}</b> <span class="small muted">${esc(C.BOARD.sixSay(six.length))}</span> ${six.length ? btn(ui.edit6 ? C.BOARD.sixDone : C.BOARD.sixEdit, 'pb-six-edit', {}, { cls: 'linkish', disabled: locked, pressed: !!ui.edit6 }) : ''}</p>
    ${six.length ? `<div class="tray-tiles" role="group" aria-label="${esc(C.BOARD.six)}">${six.map(tile).join('')}</div>` : ''}${six.length > 6 ? `<p class="small">${esc(C.BOARD.sixMore)}</p>` : ''}${edit}</div>`;
  const cover = `<section class="pb-six" aria-labelledby="pb-six-h"><h3 id="pb-six-h">${esc(C.BOARD.coverage)}</h3>
    ${items.length ? `<ul class="covstrip">${items.map(covTile).join('')}</ul>` : ''}
    ${btn(C.BOARD.fillGap, 'pb-gap', {}, { cls: ui.gap ? 'on' : '', pressed: !!ui.gap })}${gap}</section>`;
  return { tiles, cover };
}

// ---------- the board before anything is saved ----------
// A matchup with no prep yet shows the board itself, built on an unsaved preview of its workspace: looking around saves
// nothing, and the first tap that writes (a pick, your 6, a light, a calc) creates the workspace, then writes.
// Its UI state (selected plan, picker, gap) is kept per matchup and moves to the prep when that is created.
const previewKey = (m) => `ws_preview:${m.pov.name}|${m.opp.name}`;
/** The unsaved preview for the open matchup (no workspace yet), or null. */
export function previewWs(P) {
  const m = P.match?.();
  if (!m || m.ws || workspacesFor([...P.ws.values()], m.pov.name, m.opp.name).length) return null;
  return newWorkspace({ id: previewKey(m), coach: m.opp.name, roster: { fetchedAt: null, speciesIds: m.opp.picks.map((x) => x.id).filter(Boolean) }, now: P.now(), pov: m.pov.name });
}

// ---------- actions ----------
/** The board's workspace for reading: the open one, else the unsaved preview. */
const W = (P) => P.ws.get(P.route.wsId) ?? previewWs(P);
/** The workspace to write to: the open one, or this matchup's, created now (the tap itself is the explicit action). */
function Wc(P) {
  const open = P.ws.get(P.route.wsId);
  if (open) return open;
  const m = P.match?.();
  if (!m) return null;
  const made = P.ensureWorkspace(m.pov.name, m.opp.name);
  if (!made) return null;
  const key = previewKey(m);
  if (P.ui.ws[key]) { P.ui.ws[made.id] = { ...(P.ui.ws[made.id] ?? {}), ...P.ui.ws[key] }; delete P.ui.ws[key]; }
  // the same screen, now with its prep: re-resolved quietly, so the tap that created it doesn't move scroll or focus
  P.go({ view: 'ws', pov: m.pov.order, opp: m.opp.order, tab: 'plan' }, { push: false, quiet: true });
  return P.ws.get(made.id) ?? made;
}
export const actions = {
  'pb-target': (t, P) => { const ui = boardUi(P, W(P)); ui.sel = t.dataset.key; ui.slot = null; ui.calcs = false; P.saveUi?.(); P.app.rerender(); },
  'pb-pick': (t, P) => {
    const ws = Wc(P), sp = t.dataset.species;
    const m = ws && boardModel(P, ws);
    if (!m?.target) return;
    const cur = cardPicks(P, cardFor(ws, m.target.planId));
    if (cur.bring.includes(sp)) { editPicks(P, ws, (p) => ({ ...p, bring: p.bring.filter((x) => x !== sp), lead: p.lead.filter((x) => x !== sp), mega: p.mega === sp ? '' : p.mega }), C.BOARD.removed(P.spName(sp))); return; }
    if (cur.lead.length >= 2 && cur.back.length >= 2) { P.toast(C.BOARD.full); return; }
    const toLead = cur.lead.length < 2;
    editPicks(P, ws, (p) => ({ ...p, bring: [...p.bring, sp], lead: toLead ? [...p.lead, sp] : p.lead }), C.BOARD.placed(P.spName(sp), toLead ? C.BOARD.lead : C.BOARD.back));
  },
  // a filled slot opens its menu; an empty one points at where its Pokémon come from (never a dead tap)
  'pb-slot': (t, P) => {
    const ws = W(P), ui = boardUi(P, ws), sp = t.dataset.species ?? null;
    if (sp) { ui.slot = ui.slot !== sp ? sp : null; P.app.rerender(); return; }
    ui.slot = null;
    const six = boardModel(P, ws)?.six ?? [];
    P.app.announce?.(six.length ? C.BOARD.pickFromSix : C.BOARD.pickSix);
    P.focusOn('pb-tray');
  },
  'pb-move': (t, P) => {
    const sp = t.dataset.species, toLead = t.dataset.to === 'lead';
    editPicks(P, Wc(P), (p) => ({ ...p, lead: toLead ? [...p.lead.filter((x) => x !== sp), sp].slice(-2) : p.lead.filter((x) => x !== sp) }), C.BOARD.placed(P.spName(sp), toLead ? C.BOARD.lead : C.BOARD.back));
  },
  'pb-remove': (t, P) => { const sp = t.dataset.species; editPicks(P, Wc(P), (p) => ({ ...p, bring: p.bring.filter((x) => x !== sp), lead: p.lead.filter((x) => x !== sp), mega: p.mega === sp ? '' : p.mega }), C.BOARD.removed(P.spName(sp))); },
  'pb-mega': (t, P) => editPicks(P, Wc(P), (p) => ({ ...p, mega: t.dataset.species || '', megaForm: t.dataset.form || '' })),
  // an idea to try becomes your lead (the back keeps whoever isn't in the new lead)
  'pb-try': (t, P) => { const pair = [t.dataset.a, t.dataset.b]; editPicks(P, Wc(P), (p) => ({ ...p, bring: uniq([...pair, ...p.bring.filter((x) => !pair.includes(x))]).slice(0, 4), lead: pair }), C.BOARD.placed(pair.map((x) => P.spName(x)).join(' + '), C.BOARD.lead)); },
  'pb-back': (t, P) => { const pair = [t.dataset.a, t.dataset.b]; editPicks(P, Wc(P), (p) => ({ ...p, bring: uniq([...p.lead, ...pair]), lead: p.lead }), C.BOARD.placed(pair.map((x) => P.spName(x)).join(' + '), C.BOARD.back)); },
  'pb-six': (t, P) => {
    const ws = Wc(P), sp = t.dataset.species;
    if (!ws) return;
    // the picker opened by itself for an empty 6 stays open until Done (picking a 6 is several taps)
    if (!sixOf(P, ws).length) boardUi(P, ws).edit6 = true;
    const ok = P.mutate(`ws:${ws.id}`, (d) => { const a = d.shortlist ?? []; d.shortlist = a.includes(sp) ? a.filter((x) => x !== sp) : [...a, sp].slice(0, 10); });
    if (ok) { const ui = boardUi(P, ws); ui.gapIdx = 0; P.app.announce?.(((P.ws.get(ws.id)?.shortlist ?? []).includes(sp) ? C.BOARD.sixAdded : C.BOARD.sixRemoved)(P.spName(sp))); }
  },
  'pb-six-edit': (t, P) => { const ui = boardUi(P, W(P)); ui.edit6 = !ui.edit6; P.app.rerender(); },
  'pb-gap': (t, P) => { const ui = boardUi(P, W(P)); ui.gap = ui.gap ? null : true; ui.gapIdx = 0; P.app.rerender(); },
  'pb-gap-next': (t, P) => { const ui = boardUi(P, W(P)); ui.gapIdx += 1; P.app.rerender(); },
  'pb-gap-close': (t, P) => { const ui = boardUi(P, W(P)); ui.gap = null; ui.gapIdx = 0; P.app.rerender(); },
  'pb-light-calcs': (t, P) => { const ui = boardUi(P, W(P)); ui.calcs = !ui.calcs; P.app.rerender(); },
  // Speed: the Speed tool with the lead and their first focus mon selected, under this plan's speed mode
  'pb-light-speed': (t, P) => {
    const ws = Wc(P), m = ws && boardModel(P, ws);
    if (!m?.target) return;
    const lead = cardPicks(P, cardFor(ws, m.target.planId)).lead;
    const mode = m.target.speedMode;
    P.wsUi(ws.id).sp = { tailwindMine: false, tailwindTheirs: mode === 'tailwind', trickRoom: mode === 'trick-room', icyWind: false, paraThem: false, sel: [m.target.focus[0] ? `t:${m.target.focus[0]}` : null, lead[0] ? `m:${lead[0]}` : null].filter(Boolean) };
    P.go({ view: 'ws', wsId: ws.id, kind: 'speed' }, { push: true });
  },
  // Practised: a mock brief with a purpose suggestion for this plan (a suggestion only: the purpose stays yours)
  'pb-light-practised': (t, P) => {
    const ws = Wc(P), m = ws && boardModel(P, ws);
    if (!m?.target) return;
    const label = m.target.source === 'saved' ? (m.target.label || C.PLAN_KIND[m.target.kind]) : m.target.label || C.BOARD.seed[m.target.seed];
    P.wsUi(ws.id).brPurposeHint = C.BRIEF.q.practice(label).slice(0, 160);
    P.go({ view: 'ws', wsId: ws.id, kind: 'brief' }, { push: true });
  },
  // a key calc for this lead: the saved one, or a quick check prefilled (ask-first) with their hit into your mon
  'pb-calc': (t, P) => {
    const ws = Wc(P), mine = t.dataset.mine, theirs = t.dataset.theirs;
    if (!ws) return;
    const existing = ws.calcs.filter((x) => { const a = x.scenario?.attacker?.set?.species, d = x.scenario?.defender?.set?.species; return (a === theirs && d === mine) || (a === mine && d === theirs); });
    const fresh = existing.find((x) => !P.staleOf(ws, x).length) ?? existing[0];
    if (fresh) return P.go({ view: 'ws', wsId: ws.id, kind: 'calcs', id: fresh.id }, { push: true });
    if (!P.mech) { P.toast(C.BOARD.calcLoading); return; }
    const card = ws.cards.find((c) => c.id === t.dataset.card) ?? null;
    const v = defaultVariant(ws) ?? variantOf(P, ws);
    const theirL = theirSetFor(ws, v, theirs);
    const mv = theirL ? currentVersion(theirL).data.moves.filter((x) => P.mech.moves[x] && P.mech.moves[x].category !== 'Status').sort((a, b) => P.mech.moves[b].basePower - P.mech.moves[a].basePower)[0] ?? '' : '';
    const mineSet = attachedSet(P, card, mine);
    P.prefill(ws, 'cd', { a: { side: 'theirs', species: theirs, setId: theirL?.id ?? null }, d: { side: 'mine', species: mine, setId: mineSet }, move: mv, crit: false, hits: 0, firstHitOnly: false,
      moveState: {}, field: {}, aState: {}, dState: {}, calcId: null, ...(card ? { slotFromCardId: card.id, slotKey: `${card.id}|${theirs}|${mine}` } : {}) }, { view: 'ws', wsId: ws.id, kind: 'calcs', id: 'new' });
  },
};
export { SEEDS, LOOK_FIRST };

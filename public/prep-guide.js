// Matchup guides in the app's own screens (docs/research/ux/matchup-guide.md; data: lib/guides, guide-schema.md). A guide
// is not a page: each field lands where Anthony already makes that decision — the Brief's "Game plan" card, notes on the
// pool cards and detail sheets, the teambuilder, workbench links for every guide number, "Can wreck you", Teams, the Plan
// board, Move search. Only for your own side (P.ownSide() is the guide's pov coach). Everything it adds wears a "Guide" pill.
import { guideFor, staleness, matchCalc, orphanAt, GUIDES, validateGuide } from '../lib/guides/index.mjs';
import { parseTeamQuick } from '../lib/paste.mjs';
import { legalAbilities, toID, learnset } from '../lib/calc/mech.mjs';
import { currentVersion, addVersion, newLineage, cleanSetData } from '../lib/prep-model.mjs';
import { targetsOf } from '../lib/prep-build.mjs';
import { STAT_IDS } from '../lib/calc/stats.mjs';
import * as TM from '../lib/prep-teams.mjs';
import * as C from './prep-copy.js';
import { esc, btn, chipBtn } from './prep-ui.js';
import * as WB from './prep-workbench.js';
import { importTeamText, bringTeam } from './prep-teams.js';
import * as MockPov from './prep-mockpov.js';

const G = C.GUIDE;
const base = (P) => (id) => P.mech?.species[id]?.mega?.from ?? id;
/** The guide for (your perspective, opponent), validated, with staleness; null unless you view your own side. */
export function guideOf(P, povName, oppName) {
  // in a mock (public/prep-mockpov.js) its notes are the game plan, and no real guide applies
  const mock = MockPov.guideFor(P, povName, oppName);
  if (mock !== undefined) return mock;
  if (!P.mech || !povName || !oppName || povName !== P.ownSide()) return null;
  const found = guideFor(P.seatOf(povName), P.seatOf(oppName), oppName, { mech: P.mech });
  if (!found) return null;
  return { ...found, ...staleness(found.guide, P.coachRoster(oppName), P.coachRoster(povName), base(P)) };
}
const pill = (g) => `<span class="gpill" title="${esc(G.pillTip(g.written ?? ''))}">${esc(g.pillText ?? G.pill)}</span>`;
const nm = (P, id) => P.spName(id);
const list = (items, tag = 'ul', cls = '') => (items.length ? `<${tag} class="gd-list ${cls}">${items.map((x) => `<li>${x}</li>`).join('')}</${tag}>` : '');
const goneSet = (P, found) => new Set([...found.removed, ...(found.ours?.removed ?? [])].map(base(P)));
const goneTag = (P, found, ids) => (ids.some((id) => goneSet(P, found).has(base(P)(id))) ? ` <span class="small muted">${esc(G.gone)}</span>` : '');
const short = (s) => (s.length > 32 ? `${s.slice(0, 30)}…` : s);
// a preview row's condition as a chip label: rows all start "their 6 includes", so drop that before shortening
const rowLabel = (s) => short(s.replace(/^their 6 includes\s+/i, ''));

// ---------- workbench links ----------
/** A guide calc as a link that shows the guide's stated range. */
function calcLink(P, g, i, { label = null, draft = null } = {}) {
  const c = g.calcs[i];
  const text = label ?? G.calc(nm(P, c.attacker.id), P.name('moves', c.move), nm(P, c.defender.id), c.range, c.verdict);
  return `<button type="button" class="linkish gd-calc" data-pa="guide-calc" data-pov="${g.pov}" data-opp="${g.opp}" data-coach="${esc(g.coach)}" data-i="${i}"${draft ? ` data-draft="${esc(draft)}"` : ''}>${esc(text)} ›</button>`;
}
/** One attack (a mon, a move, a target) as a workbench link, for combo parts; their side at the ladder set. */
function hitLink(P, g, a, move, d, oursAttack, label) {
  return `<button type="button" class="linkish gd-calc" data-pa="guide-hit" data-coach="${esc(g.coach)}" data-pov="${g.pov}" data-opp="${g.opp}" data-a="${esc(a)}" data-m="${esc(move)}" data-d="${esc(d)}" data-ours="${oursAttack ? 1 : 0}">${esc(label)} ›</button>`;
}
/** Text with its "a–b%" numbers as workbench links where a guide calc states that range; the others marked unchecked. */
function linkify(P, g, text) {
  const parts = String(text).split(/(\d+(?:\.\d+)?–\d+(?:\.\d+)?%)/);
  return parts.map((x, k) => {
    if (k % 2 === 0) return esc(x);
    const i = g.calcs.findIndex((c) => c.range === x);
    return i >= 0 ? calcLink(P, g, i, { label: x }) : `<span class="gd-unchecked" title="${esc(G.unchecked)}">${esc(x)}</span>`;
  }).join('');
}

// ---------- the Brief card ----------
/** The Brief's "Game plan" section parts: { title, body }, or null without a guide (the Brief stays exactly as it is). */
export function card(P, ctx, st) {
  const found = guideOf(P, ctx.pov.name, ctx.opp.name);
  if (!found) {
    const orphan = ctx.pov.name === P.ownSide() ? orphanAt(ctx.pov.order, ctx.opp.order, (P.coaches() ?? []).map((c) => c.name)) : null;
    return orphan ? { title: G.head(orphan.coach), body: `<p class="small muted">${esc(G.seatMoved(orphan.opp, orphan.coach))}</p>` } : null;
  }
  const g = found.guide;
  const head = `${pill(g)} <span class="small muted">${esc(G.written(g.written, g.assumptions.slice(0, 2).join(' · ')))}</span>${g.assumptions.length > 2 ? ` <details class="gd-more"><summary>${esc(G.moreShort)}</summary>${list(g.assumptions.map(esc), 'ul', 'small')}</details>` : ''}`;
  const staleThem = found.added.length || found.removed.length ? `<p class="banner warn small">${esc(G.staleThem(g.coach, [...found.added.map((id) => `+ ${nm(P, id)}`), ...found.removed.map((id) => `− ${nm(P, id)}`)].join(', '), found.removed.map((id) => nm(P, id)).join(', ')))}</p>` : '';
  const staleUs = found.ours.added.length || found.ours.removed.length ? `<p class="banner warn small">${esc(G.staleUs([...found.ours.added.map((id) => `+ ${nm(P, id)}`), ...found.ours.removed.map((id) => `− ${nm(P, id)}`)].join(', ')))}</p>` : '';
  const rem = g.remember.length ? `<h4>${esc(G.remember)}</h4><ol class="rsns gd-remember">${g.remember.slice(0, 3).map((x) => `<li>${linkify(P, g, x)}</li>`).join('')}</ol>${g.remember.length > 3 ? `<details class="gd-more"><summary>${esc(G.more(g.remember.length - 3))}</summary><ol class="rsns gd-remember" start="4">${g.remember.slice(3).map((x) => `<li>${linkify(P, g, x)}</li>`).join('')}</ol></details>` : ''}` : '';
  const slot = (id) => ctx.pov.picks.findIndex((p) => p.id === base(P)(id)) + 1;
  const face = (id, { bench = false, mega = false } = {}) => {
    const inner = `${P.pt(base(P)(id), { size: 'sm' })}${mega ? '<span class="megad" aria-hidden="true">M</span>' : ''}`;
    return slot(id) ? `<button type="button" class="gd-face${bench ? ' bench' : ''}" data-pa="brief-open" data-side="your" data-n="${slot(id)}" aria-label="${esc(`${nm(P, id)}${mega ? ', Mega' : ''}${bench ? `, ${G.bench}` : ''}`)}">${inner}</button>` : `<span class="gd-face${bench ? ' bench' : ''}">${inner}</span>`;
  };
  const team = P.docs.teams?.teams.find((t) => t.name === G.teamName(g.coach) && t.kind !== 'holding');
  const bring = g.bring ? `<h4>${esc(G.bring)}</h4><p class="gd-faces">${g.bring.six.map((id) => face(id, { mega: !!g.bring.mega && base(P)(g.bring.mega.id) === base(P)(id) })).join('')}${g.bring.bench.length ? ` <span class="small muted">${esc(G.bench)}:</span> ${g.bring.bench.map((b) => face(b.id, { bench: true })).join('')}` : ''}</p>
    ${g.bring.mega || g.bring.bench.some((b) => b.why) ? `<details class="gd-more"><summary>${esc(g.bring.mega ? G.megaWhy(nm(P, g.bring.mega.id)) : G.benchWhy)} ›</summary>${g.bring.mega?.why ? `<p class="small">${linkify(P, g, g.bring.mega.why)}</p>` : ''}${list(g.bring.bench.filter((b) => b.why).map((b) => `${esc(nm(P, b.id))}: ${linkify(P, g, b.why)}`), 'ul', 'small')}</details>` : ''}
    <p>${g.sets ? btn(team ? G.updateTeam : G.importTeam, team ? 'guide-update' : 'guide-import', { pov: g.pov, opp: g.opp, coach: g.coach }) : ''} ${team && ctx.ws ? btn(G.bringIt(g.coach), 'guide-bring', { team: team.id, ws: ctx.ws.id }, { cls: 'linkish' }) : ''}</p>` : '';
  // His preview shows…: a chip per preview; choosing one switches the whole Brief's lens to those 4
  const sel = Math.min(st.preview ?? 0, Math.max(0, g.previews.length - 1));
  const p = g.previews[sel];
  const pLead = p ? g.leads.find((l) => l.ours.length === p.lead.length && l.ours.every((id) => p.lead.includes(id))) : null;
  const pOff = p ? goneTag(P, found, [...p.bring4, ...p.lead]) : '';
  const previews = g.previews.length ? `<h4>${esc(G.previews)}</h4><div class="choices" role="group" aria-label="${esc(G.previews)}">${g.previews.map((x, i) => chipBtn(rowLabel(x.if), 'guide-preview', { i }, i === sel && st.lens === '4')).join('')}</div>
    ${p ? `<div class="gd-preview${pOff ? ' gd-gone' : ''}"><p class="small"><b>${esc(G.bring4)}</b> ${p.bring4.map((id) => esc(nm(P, id))).join(' · ')} &nbsp; <b>${esc(G.lead)}</b> ${p.lead.map((id) => esc(nm(P, id))).join(' + ')}${pOff}</p>
      ${p.note ? `<p class="small">${linkify(P, g, p.note)}</p>` : ''}${pLead?.t1 ? `<p class="small">T1 ${linkify(P, g, pLead.t1)}</p>` : ''}</div>` : ''}` : '';
  const fold = (title, n, body) => (body ? `<details class="gd-fold"><summary>${esc(title)}${n ? ` (${n})` : ''}</summary>${body}</details>` : '');
  const leads = g.leads.map((l, i) => {
    const off = goneTag(P, found, [...l.ours, ...l.vs]);
    return `<div class="gd-lead${off ? ' gd-gone' : ''}"><p class="gd-pair">${l.ours.map((id) => P.pt(base(P)(id), { size: 'sm' })).join('')} <b>${l.ours.map((id) => esc(nm(P, id))).join(' + ')}</b>${l.vs.length ? ` <span class="muted">${esc(G.vs)}</span> ${l.vs.map((id) => P.pt(base(P)(id), { size: 'sm' })).join('')} ${l.vs.map((id) => esc(nm(P, id))).join(' + ')}` : ''}${off}</p>
    ${['t1', 't2', 't3'].filter((k) => l[k]).map((k) => `<p class="small">${k.toUpperCase()} ${linkify(P, g, l[k])}</p>`).join('')}${l.ifs.map((x) => `<p class="small muted">${linkify(P, g, x)}</p>`).join('')}
    <p>${btn(G.usePlan, 'guide-use-plan', { i, coach: g.coach, pov: g.pov, opp: g.opp }, { cls: 'linkish' })}</p></div>`;
  }).join('');
  const tells = list(g.tells.map((t) => `<span class="small muted">${esc(G.see)}</span> ${linkify(P, g, t.see)}${t.means ? ` → <span class="small muted">${esc(G.means)}</span> ${linkify(P, g, t.means)}` : ''} → <b>${linkify(P, g, t.do)}</b>`));
  const lose = list(g.lose.map((l) => `${linkify(P, g, l.how)}${l.fix ? `<br><span class="small">${esc(G.fix)} ${linkify(P, g, l.fix)}</span>` : ''}`), 'ol');
  const ours = g.combos.ours.length ? list(g.combos.ours.map((c) => `<span class="${goneTag(P, found, [...c.attackers.map((a) => a[0]), c.into]) ? 'gd-gone' : ''}">${c.attackers.map(([a, m]) => hitLink(P, g, a, m, c.into, true, `${nm(P, a)} ${P.name('moves', m)}`)).join(' + ')} → ${esc(nm(P, c.into))}${c.range ? ` <b>${esc(c.range)}</b>` : ''}${c.verdict ? ` · ${esc(c.verdict)}` : ''}</span>`)) + `<p class="small muted">${esc(G.comboNote)}</p>` : '';
  const body = `<p class="gd-head">${head}</p>${staleThem}${staleUs}${rem}${bring}${previews}
    ${fold(G.leads, g.leads.length, leads)}${fold(G.tells, g.tells.length, tells)}${fold(G.lose, g.lose.length, lose)}${fold(G.endgame, 0, list(g.endgame.map((x) => linkify(P, g, x))))}${fold(G.ours, g.combos.ours.length, ours)}
    ${g.combos.theirs.length ? `<p class="small">${esc(G.wreckPointer(g.combos.theirs.length))}</p>` : ''}${found.problems.length ? `<p class="small muted">${esc(G.problems(found.problems.length))}</p>` : ''}`;
  return { title: found.title ?? G.head(g.coach) + (g.week ? ` · W${g.week}` : ''), body: body + (found.extra ? found.extra() : '') };
}

/** Pool card: the "G" dot, or null. */
export function poolDot(P, ctx, id) {
  const g = guideOf(P, ctx.pov.name, ctx.opp.name)?.guide;
  return g?.perMon[id] ? { html: '<span class="gdot" aria-hidden="true">G</span>', label: G.guideNote } : null;
}
/** The Guide block for a detail sheet or the teambuilder: one mon's notes and every guide calc with it. ids: species / forme ids. */
export function monBlock(P, povName, oppName, ids, { draftSetId = null, maxNotes = 99 } = {}) {
  const found = guideOf(P, povName, oppName);
  if (!found) return '';
  const g = found.guide;
  const idList = [...new Set([ids].flat().filter(Boolean))];
  const has = (id) => idList.includes(id) || idList.includes(base(P)(id));
  const n = idList.map((id) => g.perMon[id]).find(Boolean);
  const calcs = g.calcs.map((c, i) => [c, i]).filter(([c]) => has(c.attacker.id) || has(c.defender.id));
  if (!n && !calcs.length) return '';
  const worstCalc = calcs.find(([c]) => has(c.attacker.id) && c.defender.set === 'ours');
  const field = (k, label, extra = '') => (n?.[k] ? `<p class="small"><b>${esc(label)}</b> ${linkify(P, g, n[k])}${extra}</p>` : '');
  const notes = n?.notes ?? [];
  return `<div class="gd-mon-block"><p class="small rowlab">${pill(g)} ${esc(G.monHead(g.coach))}</p>
    ${field('role', G.roleLabel)}${field('worstCase', G.worstLabel, worstCalc ? ` ${calcLink(P, g, worstCalc[1], { label: worstCalc[0].range || G.check, draft: draftSetId })}` : '')}${field('answer', G.answerLabel)}${field('job', G.jobLabel)}${field('avoid', G.avoidLabel)}
    ${list(notes.slice(0, maxNotes).map((x) => linkify(P, g, x)), 'ul', 'small')}${notes.length > maxNotes ? `<details class="gd-more"><summary>${esc(G.more(notes.length - maxNotes))}</summary>${list(notes.slice(maxNotes).map((x) => linkify(P, g, x)), 'ul', 'small')}</details>` : ''}
    ${calcs.length ? `<p class="small rowlab">${esc(G.calcsHead)}</p>${list(calcs.map(([, i]) => calcLink(P, g, i, { draft: draftSetId })))}` : ''}</div>`;
}

// ---------- the guide's sets ----------
/** The guide's set (parsed from `sets`) for a species, or null; all of them for species ''. */
export function guideSetFor(P, g, species) {
  if (!g.sets) return species ? null : [];
  P.guideSets ??= new Map();
  if (!P.guideSets.has(g.sets)) P.guideSets.set(g.sets, parseTeamQuick(g.sets, { mech: P.mech, side: 'mine' }).sets.filter((s) => s.set).map((s) => s.set));
  const all = P.guideSets.get(g.sets);
  return species ? all.find((s) => s.species === species) ?? null : all;
}
const shape = (a) => JSON.stringify([a.item ?? '', a.ability ?? '', a.nature ?? '', STAT_IDS.map((k) => (a.sp === 'unknown' ? -1 : a.sp?.[k] ?? 0)), [...(a.moves ?? [])].filter(Boolean).sort()]);
/** What differs between your set and the guide's, in words ("Modest 26 Spe"), or ''. */
export function setDiff(P, mine, theirs) {
  if (!theirs || shape(mine) === shape(theirs)) return '';
  const out = [];
  if (mine.nature !== theirs.nature) out.push(P.name('natures', theirs.nature));
  for (const k of STAT_IDS) if ((mine.sp?.[k] ?? 0) !== (theirs.sp?.[k] ?? 0)) out.push(`${theirs.sp[k] ?? 0} ${C.STAT_SHORT[k]}`);
  if ((mine.item ?? '') !== (theirs.item ?? '')) out.push(P.name('items', theirs.item) || G.noItem);
  if ((mine.ability ?? '') !== (theirs.ability ?? '')) out.push(P.name('abilities', theirs.ability));
  const add = (theirs.moves ?? []).filter((m) => !(mine.moves ?? []).includes(m));
  if (add.length) out.push(add.map((m) => P.name('moves', m)).join(', '));
  return out.join(' ') || G.otherMoves;
}
/** The guide whose team this is ("vs <coach> (guide)"), validated, or null. */
export function guideOfTeam(P, team) {
  if (!team || !P.mech) return null;
  for (const raw of GUIDES) { const v = validateGuide(raw, P.mech).guide; if (v && team.name === G.teamName(v.coach)) return v; }
  return null;
}
/** A slot of the guide's team whose set differs from the guide's: "Guide differs · Use guide version", or ''. */
export function slotDiffers(P, team, l) {
  const g = guideOfTeam(P, team);
  if (!g) return '';
  const theirs = guideSetFor(P, g, l.speciesId);
  const what = theirs ? setDiff(P, currentVersion(l).data, theirs) : '';
  return what ? `<p class="small gd-differs">${pill(g)} ${esc(G.slotDiffers(what))} ${btn(G.useGuideVersion, 'guide-use-version', { set: l.id, team: team.id })}</p>` : '';
}
/** The teambuilder's "Guide's set" line for your draft: what differs, and Try it. */
export function guideSetLine(P, povName, oppName, l, set) {
  const g = guideOf(P, povName, oppName)?.guide;
  if (!g) return '';
  const what = setDiff(P, set, guideSetFor(P, g, l.speciesId));
  return what ? `<p class="small">${pill(g)} ${esc(G.guideSet(what))} ${btn(G.tryIt, 'tb-guide-try', { set: l.id, pov: g.pov, opp: g.opp, coach: g.coach })}</p>` : '';
}

// ---------- calc seeds (workbench) ----------
const ZERO = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
export const battleOf = (mech, id) => { const s = mech.species[id]; return s?.mega ? { species: s.mega.from, item: s.mega.item, mega: true, forme: id } : { species: id, item: null, mega: false, forme: id }; };
export function over(set, side, mega = false) {
  const out = { ...set };
  // a Mega keeps its base ability in the set (the calc applies the Mega's own); a stated Mega ability is that, not an override
  for (const k of ['ability', 'item', 'nature']) if (typeof side[k] === 'string' && side[k] && !(mega && k === 'ability')) out[k] = toID(side[k]);
  if (side.sp && typeof side.sp === 'object') out.sp = { ...ZERO, ...side.sp };
  return out;
}
/** Your side: the set in the team you bring vs this coach, else your first set of it, else the guide's (not saved). */
function oursSide(P, g, side, draftSetId) {
  const b = battleOf(P.mech, side.id);
  const ws = [...P.ws.values()].find((w) => w.pov === P.ownSide() && w.coach === g.coach);
  const team = ws?.teamId ? P.docs.teams?.teams.find((t) => t.id === ws.teamId) : null;
  const inTeam = team?.slots.map((id) => P.lineage(id)).find((x) => x?.speciesId === b.species);
  const l = (draftSetId && P.lineage(draftSetId)) || inTeam || P.mineSets().find((x) => x.speciesId === b.species && currentVersion(x).data.sp !== 'unknown');
  const data = l ? (P.docs.mysets.drafts?.[l.id]?.data ?? currentVersion(l).data) : null;
  let set = data && data.sp !== 'unknown' ? { species: b.species, ...structuredClone(data), moves: (data.moves ?? []).filter(Boolean) } : null;
  let fromGuide = false;
  if (!set) { const s = guideSetFor(P, g, b.species); if (s) { set = structuredClone(s); fromGuide = true; } }
  set ??= { species: b.species, item: b.item ?? '', ability: legalAbilities(P.mech, b.species)[0], nature: 'hardy', moves: [], sp: { ...ZERO, hp: 32 } };
  if (b.item) set.item = b.item;
  return { set: over(set, side, b.mega), setId: !fromGuide && data ? l?.id ?? null : null, fromGuide };
}
/** Their side: the ladder row (as the Brief uses it), or the worst case for this move; the guide's overrides on top. */
export function theirSide(P, g, side, move, attacking) {
  const b = battleOf(P.mech, side.id);
  const usage = P.app.usage?.() ?? null;
  const row = targetsOf(P.mech, [b.species], { usage, dexSpecies: (id) => P.dexSp(id), asOf: P.now().slice(0, 10) }).find((r) => r.forme === b.forme) ?? null;
  const r = row ? { ...row, coach: g.coach, key: `guide|${g.coach}|${row.key}` }
    : { key: `guide|${b.forme}`, coach: g.coach, species: b.species, forme: b.forme, mega: b.mega, set: { species: b.species, item: b.item ?? '', ability: legalAbilities(P.mech, b.species)[0], nature: 'hardy', moves: [move], sp: 'unknown' }, source: 'none', common: null };
  if (side.set === 'worst' && attacking) return { ...r, set: over(WB.worstCaseOf(P, r, move), side, b.mega), source: 'search' };
  if (side.set === 'worst') { const stat = P.mech.moves[move]?.category === 'Special' ? 'spd' : 'def'; return { ...r, set: over({ ...r.set, nature: stat === 'spd' ? 'calm' : 'bold', sp: { ...ZERO, hp: 32, [stat]: 32 } }, side, b.mega), source: 'bulk' }; }
  return { ...r, set: over({ ...r.set }, side, b.mega) };
}
/** A guide calc → a WB.open seed (matchup-guide.md §4.1). */
export function calcSeed(P, g, c, { draftSetId = null } = {}) {
  const oursAttacks = c.attacker.set === 'ours';
  const mine = oursSide(P, g, oursAttacks ? c.attacker : c.defender, draftSetId);
  const row = theirSide(P, g, oursAttacks ? c.defender : c.attacker, c.move, !oursAttacks);
  const f = c.field ?? {};
  const screen = f.screens === true ? (P.mech.moves[c.move]?.category === 'Special' ? 'lightScreen' : 'reflect') : f.screens === 'reflect' ? 'reflect' : f.screens === 'light' ? 'lightScreen' : null;
  return { setId: mine.setId, mine: { ...mine.set, moves: [...new Set([c.move, ...(mine.set.moves ?? [])])].slice(0, 4) }, mineRole: oursAttacks ? 'attacker' : 'defender', move: c.move,
    // their side attacks with the guide's move; defending, it keeps its own (learnable) moves
    row: { ...row, set: { ...row.set, moves: !oursAttacks ? [c.move] : (row.set.moves ?? []).filter((m) => P.mech.moves[m]).slice(0, 4).length ? row.set.moves.filter((m) => P.mech.moves[m]).slice(0, 4) : learnset(P.mech, row.species).slice(0, 1) } },
    field: { ...(f.weather ? { weather: f.weather } : {}), ...(f.terrain ? { terrain: f.terrain } : {}), ...(screen ? { defenderSide: { [screen]: true } } : {}) },
    guide: { range: c.range, coach: g.coach, pov: g.pov, opp: g.opp, fromGuide: mine.fromGuide }, intimidate: Number(f.intimidate) || 0,
    forms: { mine: (oursAttacks ? c.attacker : c.defender).form ?? '', theirs: (oursAttacks ? c.defender : c.attacker).form ?? '' } };
}
function openSeed(P, seed) {
  WB.open(P, seed);
  if (seed.intimidate && P.ui.wb) { P.ui.wb.intimidated = seed.intimidate; P.app.rerender(); }
}
const guideFromData = (P, t) => guideOf(P, P.coachBySeat(Number(t.dataset.pov))?.name, t.dataset.coach || P.coachBySeat(Number(t.dataset.opp))?.name)?.guide;

// ---------- "Can wreck you" + the guide (§5), for public/prep-threats.js ----------
/** The guide-only rows ("Double-target KOs (from the guide)"). */
export function wreckGuideRows(P, g) {
  return g.combos.theirs.map((c) => `<li class="tw-row ko">${pill(g)} ${c.attackers.map(([a, m]) => hitLink(P, g, a, m, c.into, false, `${nm(P, a)} ${P.name('moves', m)}`)).join(' + ')} → ${esc(G.your(nm(P, c.into)))}${c.range ? ` <b>${esc(c.range)}</b>` : ''}
    ${c.answer ? `<br><span class="small"><b>${esc(G.answerLabel)} ${esc(c.answer)}</b></span>` : ''}<br><span class="small muted">${esc(G.comboNote)}</span></li>`).join('');
}
export { pill as guidePill };

// ---------- the match-day sheet (tray button on Brief, Plan, Sets) ----------
export function trayButton(P, m) {
  const found = guideOf(P, m.pov.name, m.opp.name);
  if (!found) return '';
  const key = `${m.pov.name}|${m.opp.name}`;
  const open = P.ui.guideSheet === key;
  const g = found.guide;
  const st = (P.ui.brief ??= {})[key] ?? {};
  const p = g.previews[Math.min(st.preview ?? 0, Math.max(0, g.previews.length - 1))];
  const sheet = open ? `<div class="gd-sheet" role="dialog" aria-modal="false" aria-labelledby="gd-sheet-h"><div class="gd-sheet-in"><p class="gd-sheet-top"><b id="gd-sheet-h">${esc(G.head(g.coach))}</b> ${btn('×', 'guide-sheet', { key: '' }, { cls: 'wb-x', aria: G.close })}</p>
    ${g.remember.length ? `<ol class="rsns gd-remember">${g.remember.map((x) => `<li>${linkify(P, g, x)}</li>`).join('')}</ol>` : ''}
    ${p ? `<p class="small"><b>${esc(rowLabel(p.if))}</b>: ${esc(G.bring4)} ${p.bring4.map((id) => esc(nm(P, id))).join(' · ')}; ${esc(G.lead)} ${p.lead.map((id) => esc(nm(P, id))).join(' + ')}</p>${p.note ? `<p class="small">${linkify(P, g, p.note)}</p>` : ''}` : ''}</div></div>` : '';
  return `<button type="button" class="gd-fab" data-pa="guide-sheet" data-key="${esc(key)}" aria-expanded="${open}">${esc(G.trayBtn)}</button>${sheet}`;
}

// ---------- actions ----------
export const actions = {
  'guide-calc': (t, P) => {
    const g = guideFromData(P, t);
    const c = g?.calcs[Number(t.dataset.i)];
    if (c && P.mech) openSeed(P, calcSeed(P, g, c, { draftSetId: t.dataset.draft || null }));
  },
  'guide-hit': (t, P) => {
    const g = guideFromData(P, t);
    if (!g || !P.mech) return;
    const ours = t.dataset.ours === '1';
    const c = { attacker: { id: t.dataset.a, set: ours ? 'ours' : 'ladder' }, defender: { id: t.dataset.d, set: ours ? 'ladder' : 'ours' }, move: t.dataset.m, field: {}, range: '' };
    openSeed(P, calcSeed(P, g, matchCalc(g, c.attacker.id, c.defender.id, c.move, base(P)) ?? c));
  },
  'guide-preview': (t, P) => {
    const m = P.match?.();
    const g = m ? guideOf(P, m.pov.name, m.opp.name)?.guide : null;
    if (!g) return;
    const st = ((P.ui.brief ??= {})[`${m.pov.name}|${m.opp.name}`] ??= { scenario: 'none', sel: [], showAll: false, lens: '10' });
    const i = Number(t.dataset.i);
    st.preview = i;
    st.four = g.previews[i].bring4.map(base(P)).filter((id) => m.pov.picks.some((p) => p.id === id));
    if (st.four.length) st.lens = '4';
    P.saveUi(); P.app.rerender();
  },
  'guide-import': (t, P) => {
    const g = guideFromData(P, t);
    if (!g?.sets) return;
    importTeamText(P, `=== [gen9championsvgc2026regmc] ${G.teamName(g.coach)} ===\n\n${g.sets}`, null, { reason: G.reason(g.coach, g.written), bringFor: g.coach });
  },
  // Update from guide (lead decision 2): adds the missing species; a set you have is never overwritten (its slot offers
  // "Use guide version", which adds a version)
  'guide-update': (t, P) => {
    const g = guideFromData(P, t);
    const team = g ? P.docs.teams?.teams.find((x) => x.name === G.teamName(g.coach) && x.kind !== 'holding') : null;
    if (!g || !team) return;
    const sets = guideSetFor(P, g, '');
    const inTeam = team.slots.map((id) => P.lineage(id)).filter(Boolean);
    const roster = new Set(P.coachRoster(P.ownSide()));
    const missing = sets.filter((s) => !inTeam.some((l) => l.speciesId === s.species) && roster.has(s.species));
    const differs = inTeam.filter((l) => slotDiffers(P, team, l)).length;
    if (missing.length) {
      const made = missing.map((s) => newLineage({ id: P.id('set'), side: 'mine', speciesId: s.species, name: 'Guide', data: cleanSetData(s), now: P.now(), reason: G.reason(g.coach, g.written) }));
      if (P.mutate('mysets', (d) => { d.sets.push(...made); }, { render: false })) {
        let tt = TM.reconcileTeams(P.docs.teams, P.docs.mysets, { now: P.now() }).teams;
        for (const l of made) tt = TM.moveSet(tt, l.id, team.id, { now: P.now() }) || tt;
        P.mutate('teams', () => tt);
      }
    }
    P.toast(G.updated(missing.map((s) => P.spName(s.species)), differs));
    P.go({ view: 'teams', teamId: team.id }, { push: true });
  },
  'guide-use-version': (t, P) => {
    const team = P.docs.teams?.teams.find((x) => x.id === t.dataset.team);
    const g = guideOfTeam(P, team);
    const l = P.lineage(t.dataset.set);
    const s = g && l ? guideSetFor(P, g, l.speciesId) : null;
    if (!s) return;
    P.mutate('mysets', (d) => { const i = d.sets.findIndex((x) => x.id === l.id); if (i >= 0) d.sets[i] = addVersion(d.sets[i], cleanSetData(s), { now: P.now(), reason: G.reason(g.coach, g.written) }); });
    P.toast(G.versionAdded(P.spName(l.speciesId)));
  },
  'guide-bring': (t, P) => {
    const ws = P.ws.get(t.dataset.ws) ?? (t.dataset.coach && P.ensureWorkspace(P.ownSide(), t.dataset.coach));
    if (ws) { bringTeam(P, ws, t.dataset.team); P.toast(G.brought(ws.coach)); P.app.rerender(); }
  },
  'guide-use-plan': (t, P) => {
    const m = P.match?.();
    const g = m ? guideOf(P, m.pov.name, m.opp.name)?.guide : null;
    const lead = g?.leads[Number(t.dataset.i)];
    if (!lead) return;
    P.ui.guidePlan = { coach: g.coach, vs: lead.vs };
    P.go({ view: 'ws', pov: m.pov.order, opp: m.opp.order, tab: 'plan' }, { push: true });
  },
  'guide-sheet': (t, P) => { P.ui.guideSheet = !t.dataset.key || P.ui.guideSheet === t.dataset.key ? null : t.dataset.key; P.app.rerender(); },
};

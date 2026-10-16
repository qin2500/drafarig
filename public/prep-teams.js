// Teams (docs/research/ux/calc-workbench-teams.md §C, lead overrides 2026-10-16): your sets live in teams of up to 6, like
// Showdown's teambuilder; "Imported sets" is the one box. Screens: the Teams list, a team (6 slot rows), the set editor
// inside a team (public/prep-teambuilder.js), and the matchup's "Bring: [team]" picker. Every operation is a pure function
// in lib/prep-teams.mjs; writes go through P.mutate (Undo toasts for the destructive ones, via prep.js UNDOABLE).
// Species clause, 2+ Megas and a repeated item are warnings, never blocks; only your 10 drafted mons can join a team.
import { setStats } from '../lib/calc/mech.mjs';
import { STAT_IDS } from '../lib/calc/stats.mjs';
import { currentVersion, asSet, newLineage, cleanSetData } from '../lib/prep-model.mjs';
import { parseTeamQuick, exportSet, exportTeam } from '../lib/paste.mjs';
import * as TM from '../lib/prep-teams.mjs';
import * as C from './prep-copy.js';
import { esc, btn, h2, select } from './prep-ui.js';
import { createMySet, spForUnknown } from './prep-sets.js';
import * as TB from './prep-teambuilder.js';

const T = C.TEAMS;
const teamsDoc = (P) => P.docs.teams;
const teamById = (P, id) => teamsDoc(P).teams.find((x) => x.id === id) ?? null;
const ordered = (P) => { const t = teamsDoc(P); return [...t.teams].sort((a, b) => (a.kind === 'holding') - (b.kind === 'holding') || (t.order ?? []).indexOf(a.id) - (t.order ?? []).indexOf(b.id)); };
const myRoster = (P) => P.coachRoster(P.ownSide()).filter((id) => P.mech?.species[id] && !P.mech.species[id].mega);
/** The matchups (your own) that bring a team: [{ws, coach, week}]. */
function usedBy(P, teamId) {
  const me = P.ownSide();
  return [...P.ws.values()].filter((w) => w.pov === me && w.teamId === teamId).map((w) => ({ ws: w, coach: w.coach, week: P.weeksVs?.(me, w.coach)?.weeks?.[0] ?? null }));
}
const usedText = (P, teamId) => usedBy(P, teamId).map((u) => `${u.coach}${u.week ? ` (W${u.week})` : ''}`).join(', ');
function warningLines(P, team) {
  return TM.teamWarnings(team, P.docs.mysets, P.mech).filter((w) => w.code !== 'count').map((w) => (T.warn[w.code] ?? (() => w.code))(w, (sp) => P.spName(sp), (it) => P.name('items', it)));
}
const pt = (P, sp, size = 'sm') => P.pt(sp, { size });

// ---------- screens ----------
export function screen(P, r) {
  // Teams not stored yet: undone (offer to set up again), being set up right now, or simply nothing to move (a fresh device):
  // then the list shows the empty teams document, and the first New team / Import team writes it (an explicit tap).
  // Your existing sets move in first (after their backup), so a team made here can't skip that.
  const pending = !P.teamsStored?.() && !P.docs.meta.teamsUndone && ((P.docs.mysets.sets ?? []).length > 0 || [...P.ws.values()].some(TM.needsTeam));
  if (pending && !P.teamsBusy && !P.teamsBlocked) Promise.resolve().then(() => P.teamsStep()).catch(() => {});
  if (!P.teamsStored?.() && (P.docs.meta.teamsUndone || pending)) {
    return `<section class="panel prep-teams">${btn('‹ Prep', 'go-home', {}, { cls: 'back', aria: 'Back to Prep home' })}${h2(T.head)}<p>${esc(P.docs.meta.teamsUndone ? T.offNow : P.teamsBlocked ? T.blocked : T.settingUp)}</p>
      ${P.docs.meta.teamsUndone ? btn(T.redo, 'teams-redo') : P.teamsBlocked ? btn(T.blockedBtn, 'teams-backup', {}, { primary: true }) : ''}</section>`;
  }
  if (r.teamId) {
    const team = teamById(P, r.teamId);
    if (!team) return `<section class="panel">${h2(T.notFound)}<p>${btn(T.list, 'teams-list')}</p></section>`;
    if (r.slot) {
      const l = P.lineage(team.slots[r.slot - 1]);
      if (!l) return `<section class="panel">${btn(`‹ ${team.name}`, 'back', {}, { cls: 'back' })}${h2(T.emptySlot)}</section>`;
      return `<section class="panel prep-set">${TB.editor(P, null, l, { team })}</section>`;
    }
    return `<section class="panel prep-team">${builder(P, team)}</section>`;
  }
  return `<section class="panel prep-teams">${list(P)}</section>`;
}

function list(P) {
  const ui = (P.ui.teams ??= {});
  const cards = ordered(P).map((t) => {
    const sets = t.slots.map((id) => P.lineage(id)).filter(Boolean);
    const box = t.kind === 'holding';
    const faces = box ? sets.slice(0, 12).map((s) => pt(P, s.speciesId, 'xs')).join('') + (sets.length > 12 ? `<span class="small muted">+${sets.length - 12}</span>` : '')
      : [...sets.map((s) => pt(P, s.speciesId)), ...(t.planned ?? []).map((sp) => `<span class="tm-ghost">${pt(P, sp)}</span>`), ...Array.from({ length: Math.max(0, 6 - sets.length - (t.planned?.length ?? 0)) }, () => '<span class="tm-empty" aria-hidden="true"></span>')].join('');
    const warns = box ? [] : warningLines(P, t);
    const used = box ? '' : usedText(P, t.id);
    return `<li class="tm-card${box ? ' box' : ''}"><button type="button" class="tm-open" data-pa="team-open" data-team="${esc(t.id)}" aria-label="${esc(`${t.name}: ${sets.length} ${box ? 'sets' : 'of 6'}${warns.length ? `, ${warns.length} warning${warns.length === 1 ? '' : 's'}` : ''}`)}">
      <span class="tm-name">${box ? '📦 ' : ''}${esc(t.name)}${warns.length ? ' <span class="tm-dot" aria-hidden="true">●</span>' : ''}</span>
      <span class="tm-faces" aria-hidden="true">${faces}</span>
      <span class="small muted">${esc(box ? T.boxCount(sets.length) : `${sets.length} of 6${used ? ` · ${T.usedVs(used)}` : ''}`)}</span></button></li>`;
  }).join('');
  const imp = ui.importOpen ? `<div class="card tm-import"><label class="field" for="tm-import-text"><span>${esc(T.importHelp)}</span><textarea id="tm-import-text" rows="8" spellcheck="false" data-pi="team-import-text">${esc(ui.importText ?? '')}</textarea></label>
      <p>${btn(T.importIt, 'team-import', {}, { primary: true })} ${btn(T.cancel, 'team-import-toggle')}</p></div>` : '';
  return `${btn('‹ Prep', 'go-home', {}, { cls: 'back', aria: 'Back to Prep home' })}${h2(T.head)}
    <p class="small">${esc(T.intro)}</p>
    <p>${btn(T.newTeam, 'team-new', {}, { primary: true })} ${btn(T.importTeam, 'team-import-toggle', {}, { pressed: !!ui.importOpen })}</p>${report(P)}${imp}
    <ul class="tm-list">${cards}</ul>`;
}

function slotRow(P, team, l, i) {
  const d = currentVersion(l).data;
  const st = P.mech ? setStats(P.mech, asSet(l, currentVersion(l)), { megaEvolved: true }) : null;
  const box = team.kind === 'holding';
  const others = ordered(P).filter((x) => x.id !== team.id && (x.kind === 'holding' || x.slots.length < 6));
  const opts = (label) => [['', label], ...others.map((x) => [x.id, x.kind === 'holding' ? T.box : x.name]), ['__new', T.newTeamOpt]];
  const offRoster = !myRoster(P).includes(l.speciesId);
  return `<li class="tm-slot">
    <button type="button" class="tm-slot-open" data-pa="team-slot" data-team="${esc(team.id)}" data-slot="${i + 1}" aria-label="${esc(`${P.spName(l.speciesId)}: ${T.editSet}`)}">
      <span class="tm-s-who">${pt(P, l.speciesId, 'md')}<span><b>${esc(d.cosmetic?.nickname || P.spName(l.speciesId))}</b><br><span class="small">${esc(`${l.name || 'Set'} v${l.currentV}`)}</span>${offRoster ? `<br><span class="small warnline">${esc(T.offRoster)}</span>` : ''}</span></span>
      <span class="tm-s-det small"><span>${esc(P.name('items', d.item) || T.noItem)}</span><span>${esc(P.name('abilities', d.ability) || '—')}</span><span>${esc(P.name('natures', d.nature) || '—')}</span></span>
      <span class="tm-s-moves small">${(d.moves ?? []).map((m) => `<span>${esc(P.name('moves', m))}</span>`).join('')}</span>
      <span class="tm-s-stats small">${st ? STAT_IDS.map((k) => `<span>${C.STAT_SHORT[k]} ${st[k]}</span>`).join('') : esc(T.noSp)}</span></button>
    <details class="tm-more"><summary aria-label="${esc(T.moreFor(P.spName(l.speciesId)))}">⋯</summary><div class="tm-acts">
      ${box ? '' : `${btn('↑', 'team-up', { team: team.id, i }, { aria: T.up, disabled: i === 0 })} ${btn('↓', 'team-down', { team: team.id, i }, { aria: T.down, disabled: i === team.slots.length - 1 })}`}
      ${select(`tm-copy-${i}`, opts(T.copyTo), '', { data: { pc: 'team-copy-to', set: l.id }, aria: T.copyTo })}
      ${select(`tm-move-${i}`, opts(T.moveTo), '', { data: { pc: 'team-move-to', set: l.id }, aria: T.moveTo })}
      ${btn(T.exportSet, 'team-export-set', { set: l.id })}
      ${box ? btn(T.deleteSet, 'team-set-delete', { set: l.id }) : btn(T.remove, 'team-remove', { set: l.id })}</div></details></li>`;
}

function builder(P, team) {
  const ui = (P.ui.teams ??= {});
  const box = team.kind === 'holding';
  const sets = team.slots.map((id) => P.lineage(id));
  const rows = sets.map((l, i) => (l ? slotRow(P, team, l, i) : '')).join('');
  const planned = (team.planned ?? []).map((sp) => `<li class="tm-slot planned"><span class="tm-s-who">${pt(P, sp, 'md')}<span><b>${esc(P.spName(sp))}</b><br><span class="small muted">${esc(T.noSetYet)}</span></span></span> ${btn(T.createSet, 'team-add', { team: team.id, species: sp })} ${btn(T.dropPlanned, 'team-unplan', { team: team.id, species: sp }, { cls: 'linkish' })}</li>`).join('');
  const inTeam = new Set(sets.filter(Boolean).map((l) => l.speciesId));
  const canAdd = !box && sets.length + (team.planned?.length ?? 0) < 6;
  const add = canAdd ? select('tm-add', [['', T.addMon], ...myRoster(P).map((sp) => [sp, `${P.spName(sp)}${inTeam.has(sp) ? ` (${T.inTeam})` : ''}`, inTeam.has(sp)])], '', { data: { pc: 'team-add-species', team: team.id }, aria: T.addMon }) : '';
  const warns = warningLines(P, team);
  const used = usedText(P, team.id);
  const me = P.ownSide();
  const coaches = (P.coaches() ?? []).filter((c) => c.name !== me);
  const exportText = ui.exportFor === team.id ? teamText(P, team) : null;
  return `${btn(`‹ ${T.head}`, 'back', {}, { cls: 'back', aria: 'Back to Teams' })}
    ${box ? h2(team.name) : `<label class="field tm-namefield" for="tm-name"><span>${esc(T.name)}</span><input id="tm-name" data-pc="team-rename" data-team="${esc(team.id)}" value="${esc(team.name)}" maxlength="60"></label>`}
    <p class="small">${esc(box ? T.boxHelp : `${sets.filter(Boolean).length} of 6${used ? ` · ${T.usedVs(used)}. ${T.sharedNote}` : ''}`)}</p>
    ${report(P)}${warns.map((w) => `<p class="banner warn">${esc(w)}</p>`).join('')}
    <ul class="tm-slots">${rows}${planned}</ul>
    ${add ? `<p>${add}</p>` : ''}
    ${box ? '' : `<div class="tm-bar">${select('tm-bring', [['', T.bringVs], ...coaches.map((c) => [c.name, c.name])], '', { data: { pc: 'team-bring', team: team.id }, aria: T.bringVs })}
      ${btn(T.exportTeam, 'team-export', { team: team.id }, { pressed: ui.exportFor === team.id })} ${btn(T.importInto, 'team-import-into-toggle', { team: team.id }, { pressed: ui.importInto === team.id })}
      ${btn(T.duplicate, 'team-duplicate', { team: team.id })} ${btn(T.del, 'team-delete', { team: team.id })}</div>`}
    ${ui.deleteAsk === team.id ? `<p class="banner warn">${esc(T.deleteAsk(team.name, sets.filter(Boolean).length, used))} ${btn(T.deleteYes, 'team-delete-confirm', { team: team.id }, { primary: true })} ${btn(T.cancel, 'team-delete-cancel')}</p>` : ''}
    ${exportText !== null ? `<label class="field" for="tm-export"><span>${esc(T.exportHelp)}</span><textarea id="tm-export" rows="10" readonly spellcheck="false">${esc(exportText)}</textarea></label><p>${btn(T.copy, 'team-export-copy', { team: team.id })}</p>` : ''}
    ${ui.importInto === team.id ? `<label class="field" for="tm-into-text"><span>${esc(T.importIntoHelp)}</span><textarea id="tm-into-text" rows="8" spellcheck="false" data-pi="team-import-text">${esc(ui.importText ?? '')}</textarea></label><p>${btn(T.importIt, 'team-import', { team: team.id }, { primary: true })}</p>` : ''}`;
}

/** Showdown text for a team, with the team header so it pastes back into Showdown's teambuilder. */
function teamText(P, team) {
  const sets = team.slots.map((id) => P.lineage(id)).filter(Boolean).map((l) => asSet(l, currentVersion(l)));
  try { return `=== [gen9championsvgc2026regmc] ${team.name} ===\n\n${exportTeam(sets, P.mech, { spFor: (s) => (s.sp === 'unknown' ? spForUnknown(P, s, 'common') : null) }).text}`; } catch { return ''; }
}

/** Matchup Sets tab: which team this matchup brings (replaces "Your sets for this match" once teams are set up). */
export function bring(P, ws) {
  const me = P.ownSide();
  if (!P.teamsStored?.() || ws.pov !== me) return null;
  const { main } = TM.teamsOfWs(teamsDoc(P), ws);
  const teams = ordered(P).filter((t) => t.kind !== 'holding');
  const sets = (main?.slots ?? []).map((id) => P.lineage(id)).filter(Boolean);
  const warns = main ? warningLines(P, main) : [];
  return `<div class="tm-bring">${select('tm-bring-ws', [['', T.noTeam], ...teams.map((t) => [t.id, t.name])], main?.id ?? '', { label: T.bring, data: { pc: 'ws-bring', ws: ws.id } })}
    ${main ? `<p class="tm-faces">${sets.map((l) => `<button type="button" class="tm-face" data-pa="team-slot" data-team="${esc(main.id)}" data-slot="${main.slots.indexOf(l.id) + 1}" aria-label="${esc(`${P.spName(l.speciesId)}: ${T.editSet}`)}">${pt(P, l.speciesId)}</button>`).join('')}${(main.planned ?? []).map((sp) => `<span class="tm-ghost">${pt(P, sp)}</span>`).join('')}</p>
      ${warns.map((w) => `<p class="small warnline">⚠ ${esc(w)}</p>`).join('')}<p>${btn(T.editTeam, 'team-open', { team: main.id })} ${btn(T.newFromMatch, 'ws-new-team', { ws: ws.id }, { cls: 'linkish' })}</p>`
    : `<p class="small">${esc(T.pickTeam)} ${btn(T.newFromMatch, 'ws-new-team', { ws: ws.id }, { cls: 'linkish' })}</p>`}</div>`;
}

// ---------- actions ----------
const ui = (P) => (P.ui.teams ??= {});
const writeTeams = (P, next) => (next ? P.mutate('teams', () => next) : (P.toast(T.refused), false));
/** Point a matchup at a team (my6 mirrors it) and remember it as the last team used. */
export function bringTeam(P, ws, teamId) {
  const team = teamId ? teamById(P, teamId) : null;
  P.mutate(`ws:${ws.id}`, (d) => {
    if (team) { d.teamId = team.id; d.my6 = team.slots.map((id) => d.my6.find((m) => m.setId === id) ?? { setId: id }); } else { delete d.teamId; d.my6 = []; }
  });
  if (team) P.mutate('meta', (m) => { m.lastTeamId = team.id; }, { substantive: false });
}
/** After an import: what came in, each EV line converted to Stat Points (with a Review link), and each set held back, by name. */
function report(P) {
  const r = ui(P).report;
  if (!r) return '';
  const conv = r.converted.map((c) => `<li>${esc(T.evsConverted(c.name, c.text))} ${c.team ? btn(T.review, 'team-slot', { team: c.team, slot: c.slot }, { cls: 'linkish' }) : ''}</li>`).join('');
  const held = r.held.map((h) => `<li>${esc(T.heldBack(h.name, h.why))}</li>`).join('');
  return `<div class="banner ${r.held.length ? 'warn' : 'info'} tm-report" role="status"><p>${esc(r.summary)} ${btn('✕', 'team-import-dismiss', {}, { cls: 'linkish', aria: T.dismiss })}</p>
    ${conv ? `<ul class="small">${conv}</ul>` : ''}${held ? `<ul class="small">${held}</ul><p class="small">${btn(T.fullImport, 'go-mysets-import', {}, { cls: 'linkish' })}</p>` : ''}</div>`;
}
/** Why a parsed set was held back: its first problem line (a set that can't import, or a question with no safe answer). */
function whyHeld(s) {
  const l = s.lines.find((x) => x.tier === 1) ?? s.lines.find((x) => x.question && x.question.answer === undefined) ?? s.lines.find((x) => x.tier);
  const f = l && C.PASTE[l.code];
  return typeof f === 'function' ? f(l) : '';
}
function importText(P, text, team) {
  const r = parseTeamQuick(text ?? '', { mech: P.mech, side: 'mine' });
  const u = ui(P);
  if (r.rejected) { u.report = { summary: T.importRejected, converted: [], held: [] }; P.app.rerender(); return; }
  const roster = new Set(myRoster(P));
  const ready = r.sets.filter((s) => s.set);
  const held = r.sets.filter((s) => !s.set).map((s) => ({ name: s.draft?.species ? P.spName(s.draft.species) : s.header.split(' @ ')[0], why: whyHeld(s) }));
  const made = ready.map((s) => newLineage({ id: P.id('set'), side: 'mine', speciesId: s.set.species, name: s.set.cosmetic?.nickname || 'Set', data: cleanSetData(s.set), now: P.now(), reason: 'imported' }));
  if (!made.length) { u.report = { summary: T.importNone(held.length), converted: [], held }; P.app.rerender(); return; }
  if (!P.mutate('mysets', (d) => { d.sets.push(...made); }, { render: false })) return;
  let t = teamsDoc(P);
  const onRoster = made.filter((l) => roster.has(l.speciesId)), off = made.length - onRoster.length;
  let into = team ? teamById(P, team) : null, placed = 0, boxed = off;
  const chunks = [];
  if (into) chunks.push({ id: into.id, sets: onRoster });
  else for (let i = 0; i < onRoster.length; i += 6) chunks.push({ id: null, sets: onRoster.slice(i, i + 6) });
  t = TM.reconcileTeams(t, P.docs.mysets, { now: P.now() }).teams; // every new set first lands in the box
  const created = [];
  for (const [n, c] of chunks.entries()) {
    let id = c.id;
    if (!id) { id = P.id('team'); created.push(id); t = TM.createTeam(t, { id, name: `${r.teamName || T.importedTeam}${n ? ` (${n + 1})` : ''}`, now: P.now() }); }
    for (const l of c.sets) {
      const target = t.teams.find((x) => x.id === id);
      const clash = target.slots.some((sid) => P.lineage(sid)?.speciesId === l.speciesId);
      const next = !clash && TM.moveSet(t, l.id, id, { now: P.now() });
      if (next) { t = next; placed++; } else boxed++;
    }
  }
  writeTeams(P, t);
  const where = (id) => { const tm = teamsDoc(P).teams.find((x) => x.slots.includes(id)); return tm ? { team: tm.id, slot: tm.slots.indexOf(id) + 1 } : {}; };
  const converted = ready.map((s, i) => (s.converted ? { name: P.spName(s.set.species), text: C.evsConverted(s.converted.from, s.converted.to), ...where(made[i].id) } : null)).filter(Boolean);
  Object.assign(u, { importText: '', importOpen: false, importInto: null, report: { summary: T.imported(placed, boxed, held.length), converted, held } });
  // one new team: open it (Back returns to the list)
  if (created.length === 1 && !team) { P.go({ view: 'teams', teamId: created[0] }, { push: true }); return; }
  P.app.rerender();
}
export const actions = {
  'teams-list': (t, P) => P.go({ view: 'teams' }, { push: false }),
  'team-open': (t, P) => P.go({ view: 'teams', teamId: t.dataset.team }, { push: true }),
  'team-slot': (t, P) => P.go({ view: 'teams', teamId: t.dataset.team, slot: Number(t.dataset.slot) }, { push: P.route.view !== 'teams' || !P.route.slot }),
  'team-new': (t, P) => { const id = P.id('team'); if (writeTeams(P, TM.createTeam(teamsDoc(P), { id, now: P.now() }))) P.go({ view: 'teams', teamId: id }, { push: true }); },
  'team-duplicate': (t, P) => {
    const id = P.id('team');
    const r = TM.duplicateTeam({ teams: teamsDoc(P), mysets: P.docs.mysets }, t.dataset.team, { newTeamId: id, newSetId: () => P.id('set'), now: P.now() });
    if (!r) return P.toast(T.refused);
    if (P.mutate('mysets', () => r.mysets, { render: false }) && writeTeams(P, r.teams)) { P.toast(T.duplicated); P.go({ view: 'teams', teamId: id }, { push: false }); }
  },
  'team-delete': (t, P) => { ui(P).deleteAsk = t.dataset.team; P.app.rerender(); },
  'team-delete-cancel': (t, P) => { ui(P).deleteAsk = null; P.app.rerender(); },
  'team-delete-confirm': (t, P) => {
    const id = t.dataset.team;
    ui(P).deleteAsk = null;
    for (const u of usedBy(P, id)) P.mutate(`ws:${u.ws.id}`, (d) => { delete d.teamId; d.my6 = []; }, { render: false });
    if (writeTeams(P, TM.deleteTeam(teamsDoc(P), P.docs.mysets, id, { now: P.now() }))) P.go({ view: 'teams' }, { push: false });
  },
  'team-up': (t, P) => writeTeams(P, TM.reorderSlot(teamsDoc(P), t.dataset.team, Number(t.dataset.i), Number(t.dataset.i) - 1, { now: P.now() })),
  'team-down': (t, P) => writeTeams(P, TM.reorderSlot(teamsDoc(P), t.dataset.team, Number(t.dataset.i), Number(t.dataset.i) + 1, { now: P.now() })),
  // out of the team, into the box (never deleted)
  'team-remove': (t, P) => {
    const out = structuredClone(teamsDoc(P));
    for (const x of out.teams) if (x.kind !== 'holding' && x.slots.includes(t.dataset.set)) { x.slots = x.slots.filter((s) => s !== t.dataset.set); x.updatedAt = P.now(); }
    if (writeTeams(P, TM.reconcileTeams(out, P.docs.mysets, { now: P.now() }).teams)) P.toast(T.removed);
  },
  'team-set-delete': (t, P) => P.mutate('mysets', (d) => { d.sets = d.sets.filter((s) => s.id !== t.dataset.set); if (d.drafts) delete d.drafts[t.dataset.set]; }),
  'team-unplan': (t, P) => writeTeams(P, TM.dropPlanned(teamsDoc(P), t.dataset.team, t.dataset.species, { now: P.now() })),
  // a mon of your 10 for this team: its set from the box when there is one, else a new set from ladder data
  'team-add': (t, P) => addSpecies(P, t.dataset.team, t.dataset.species),
  'team-export': (t, P) => { ui(P).exportFor = ui(P).exportFor === t.dataset.team ? null : t.dataset.team; P.app.rerender(); },
  'team-export-copy': async (t, P) => { try { await P.app.copyText(teamText(P, teamById(P, t.dataset.team))); P.toast(T.copied); } catch { P.toast(T.copyFailed); } },
  'team-export-set': async (t, P) => {
    const l = P.lineage(t.dataset.set); const s = asSet(l, currentVersion(l));
    try { await P.app.copyText(exportSet(s, P.mech, { sp: s.sp === 'unknown' ? spForUnknown(P, s, 'common') : null }).text); P.toast(T.copied); } catch { P.toast(T.copyFailed); }
  },
  'team-import-toggle': (t, P) => { const u = ui(P); u.importOpen = !u.importOpen; u.report = null; P.app.rerender(); },
  'team-import-into-toggle': (t, P) => { const u = ui(P); u.importInto = u.importInto === t.dataset.team ? null : t.dataset.team; u.report = null; P.app.rerender(); },
  'team-import-dismiss': (t, P) => { ui(P).report = null; P.app.rerender(); },
  'team-import': (t, P) => importText(P, ui(P).importText, t.dataset.team || null),
  // "+ New team from this matchup": a copy of the team it brings (independent sets), named for the opponent, else an empty one
  'ws-new-team': (t, P) => {
    const ws = P.ws.get(t.dataset.ws); if (!ws) return;
    const id = P.id('team'), cur = TM.teamsOfWs(teamsDoc(P), ws).main;
    let next;
    if (cur) {
      const r = TM.duplicateTeam({ teams: teamsDoc(P), mysets: P.docs.mysets }, cur.id, { newTeamId: id, newSetId: () => P.id('set'), now: P.now() });
      if (!r || !P.mutate('mysets', () => r.mysets, { render: false })) return;
      next = TM.renameTeam(r.teams, id, `vs ${ws.coach}`, { now: P.now() });
    } else next = TM.createTeam(teamsDoc(P), { id, name: `vs ${ws.coach}`, now: P.now() });
    if (writeTeams(P, next)) { bringTeam(P, P.ws.get(ws.id), id); P.go({ view: 'teams', teamId: id }, { push: true }); }
  },
};
function addSpecies(P, teamId, sp) {
  const box = teamById(P, TM.HOLDING_ID);
  let setId = box?.slots.find((id) => P.lineage(id)?.speciesId === sp) ?? null;
  if (!setId) { setId = createMySet(P, sp); if (!setId) return; P.toast(C.TB.started); }
  let t = TM.reconcileTeams(teamsDoc(P), P.docs.mysets, { now: P.now() }).teams;
  t = TM.moveSet(t, setId, teamId, { now: P.now() });
  if (!t) return P.toast(T.full);
  t = TM.dropPlanned(t, teamId, sp, { now: P.now() }) ?? t;
  if (writeTeams(P, t)) P.go({ view: 'teams', teamId, slot: t.teams.find((x) => x.id === teamId).slots.indexOf(setId) + 1 }, { push: true });
}
export const changes = {
  'team-rename': (t, P) => writeTeams(P, TM.renameTeam(teamsDoc(P), t.dataset.team, t.value, { now: P.now() })),
  'team-add-species': (t, P) => { if (t.value) addSpecies(P, t.dataset.team, t.value); },
  'team-copy-to': (t, P) => {
    if (!t.value) return;
    let teams = teamsDoc(P), to = t.value;
    if (to === '__new') { to = P.id('team'); teams = TM.createTeam(teams, { id: to, now: P.now() }); }
    const r = TM.copySet({ teams, mysets: P.docs.mysets }, t.dataset.set, to, { newId: P.id('set'), now: P.now() });
    if (!r) return P.toast(T.full);
    if (P.mutate('mysets', () => r.mysets, { render: false }) && writeTeams(P, r.teams)) P.toast(T.copiedTo(teamById(P, to)?.name ?? ''));
  },
  'team-move-to': (t, P) => {
    if (!t.value) return;
    let teams = teamsDoc(P), to = t.value;
    if (to === '__new') { to = P.id('team'); teams = TM.createTeam(teams, { id: to, now: P.now() }); }
    if (writeTeams(P, TM.moveSet(teams, t.dataset.set, to, { now: P.now() }))) P.toast(T.movedTo(teamById(P, to)?.name ?? ''));
  },
  'team-bring': (t, P) => {
    if (!t.value) return;
    const ws = P.ensureWorkspace(P.ownSide(), t.value);
    if (ws) { bringTeam(P, ws, t.dataset.team); P.toast(T.bringing(teamById(P, t.dataset.team)?.name ?? '', t.value)); }
  },
  'ws-bring': (t, P) => { const ws = P.ws.get(t.dataset.ws); if (ws) bringTeam(P, ws, t.value || null); },
};
export const inputs = {
  'team-import-text': (t, P) => { ui(P).importText = t.value.slice(0, 20000); },
};

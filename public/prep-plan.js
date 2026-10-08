// Plan: the optional prep path (steps 0–7, one "Start here"), their plans (suggested from the public Cores spec; add as
// many ideas as you like), through their eyes ("could, not will", from Reg M-C learnsets), plan cards with if-then lines
// and two Bo3 cards, key-calc slots, coverage in words with at most three flags, and Game day for the real best of three.
import { suggestPlans, couldBringAgainst, closestPlans } from '../lib/prep-plans.mjs';
import { ownerOf } from '../lib/prep-matchup.mjs';
import { flags as computeFlags, MAX_FLAGS, recordText } from '../lib/prep-coverage.mjs';
import { itemClauseExclusions, speedBound, boundVsRange, ledgerThem } from '../lib/prep-infer.mjs';
import { currentVersion, asSet, addVersion, newLineage, defaultVariant, applyReveal, setForSpecies, addRevealed } from '../lib/prep-model.mjs';
import { speedRange, statValue, natureSign, speedOf } from '../lib/calc/stats.mjs';
import { battleForme, legalAbilities, learnset } from '../lib/calc/mech.mjs';
import * as C from './prep-copy.js';
import { esc, btn, chipBtn, h2, select, term } from './prep-ui.js';
import * as Board from './prep-board.js';
import { variantOf, theirSetFor } from './prep-sets.js';
import { logForm, logActions, logChanges, logInputs } from './prep-practice.js';

const RULE_NAME = { disclosure: 'team sheets', itemClause: 'item clause', sixPerMatch: 'your 6 per match' };

// ---------- facts used by the path, flags and coverage ----------
export function facts(P, ws) {
  const rules = P.docs.rules;
  const stale = ws.calcs.filter((c) => P.staleOf(ws, c).length).map((c) => c.id);
  const megaSpecies = P.mech ? P.rosterSpecies(ws).filter((sp) => Object.values(P.mech.items).some((i) => i.megaStone?.[sp])) : [];
  const calcFacts = ws.calcs.map((c) => ({
    id: c.id, physical: P.mech?.moves[c.scenario.move.id]?.category === 'Physical', mineAttacking: c.refs?.attacker?.side === 'mine',
    intimidated: (c.scenario.attacker.state.intimidated ?? 0) > 0, mark: c.mark, attackerVariantRole: c.variantRole,
    worstExists: ws.variants.some((v) => v.role === 'worst-plausible'),
    defenderSideHasIntimidate: P.mech ? P.rosterSpecies(ws).some((sp) => P.mech.species[sp]?.abilities.includes('Intimidate')) : false,
    cardPlanField: c.slotFromCardId ? ws.plans.find((p) => ws.cards.find((k) => k.id === c.slotFromCardId)?.vsPlanIds?.includes(p.id))?.field : null,
    weather: c.scenario.field.weather,
  }));
  const calcsByCard = {};
  for (const c of ws.calcs) if (c.slotFromCardId && !P.staleOf(ws, c).length) (calcsByCard[c.slotFromCardId] ??= []).push(c.id);
  const speedCheckedCards = new Set(ws.cards.filter((k) => ws.speedChecks.length).map((k) => k.id));
  const sixRule = rules.rules.sixPerMatch?.value;
  return {
    stale, megaSpecies, calcFacts, calcsByCard, speedCheckedCards,
    flagCtx: { rules, rosterDiff: P.rosterDiffOf(ws), staleCalcIds: stale, megaSpecies, calcFacts },
    start: { pickSix: sixRule === 'whole-ten' ? false : true, speedUnchecked: ws.speedChecks.length === 0, keyCalcsRun: ws.calcs.length > 0, staleCount: stale.length,
      mockPlanned: ws.mockSets.length > 0, openFindingUnretested: ws.findings.some((f) => f.status === 'accepted' || f.status === 'open' && ws.revisions.some((r) => (r.reasonFindingIds ?? []).includes?.(f.id) && !r.retest)) },
  };
}
function flagText(P, f) {
  const p = { ...f, name: f.species ? P.spName(f.species) : '', rule: RULE_NAME[f.rule] ?? f.rule };
  return C.FLAG[f.code]?.(p) ?? f.code;
}

// ---------- Plan tab: the game-plan board ----------
// The board (public/prep-board.js) replaces the old step list: their plans as pills, your Lead / Back / Mega slots, lead
// ideas with reasons, the Speed / Calcs / Practised lights and your 6 with what it covers. Around it: game 2 cards, at most
// three flags, "Before the match" (date, next, premortem, mocks) and Game day. The steps' tools stay reachable from these.
export function tab(P, ws) {
  const F = facts(P, ws);
  const diff = P.rosterDiffOf(ws);
  const plans = ws.plans.filter((p) => p.kind !== 'idea');
  const bo3 = ws.cards.filter((c) => c.kind !== 'plan');
  const matchOn = ws.matches.some((m) => (m.games ?? []).length || (m.their6 ?? []).length);
  const allFlags = computeFlags(ws, F.flagCtx);
  const shown = allFlags.slice(0, MAX_FLAGS), rest = allFlags.slice(MAX_FLAGS);
  const flagLi = (f) => `<li>⚠ ${esc(flagText(P, f))} ${C.FLAG_ACTION[f.code] ? btn(C.FLAG_ACTION[f.code], 'flag-go', { code: f.code, ref: f.ref ?? '' }, { cls: 'linkish' }) : ''} ${btn('Dismiss', 'flag-dismiss', { code: f.code, ref: f.ref ?? '' }, { cls: 'linkish', aria: `Dismiss: ${flagText(P, f)}` })}</li>`;
  const recs = recordText(ws.mockSets);
  const boardHtml = Board.board(P, ws, F) ?? savedOnly(P, ws, plans);
  // plan cards linked to no current plan (their plan was deleted, or from an older file): kept and reachable, never hidden
  const orphans = ws.cards.filter((c) => c.kind === 'plan' && !(c.vsPlanIds ?? []).some((id) => ws.plans.some((p) => p.id === id)));
  const g2 = (kind, text) => {
    const c = bo3.find((x) => x.kind === kind);
    return c ? `<li>${btn(`${kind === 'bo3-won-g1' ? '🏆' : '↺'} ${C.CARD_KIND[kind]}`, 'open-card', { card: c.id }, { cls: 'g2card' })}${c.turn1Intent ? `<span class="small"> ${esc(c.turn1Intent.slice(0, 80))}</span>` : ''}</li>`
      : `<li>${btn(`+ ${text}`, 'card-new', { kind }, { cls: 'g2card empty' })}</li>`;
  };
  return `${h2(`vs ${ws.coach} · Plan`)}
    ${diff.added.length || diff.removed.length ? `<p class="banner warn">${esc(ws.coach)}'s roster on the sheet changed since you started: ${diff.added.map((x) => `+ ${esc(P.spName(x))}`).join(', ')}${diff.added.length && diff.removed.length ? ', ' : ''}${diff.removed.map((x) => `− ${esc(P.spName(x))}`).join(', ')}. ${btn('Update prep', 'roster-update', {}, { primary: true })} ${btn('Keep old roster', 'roster-keep')}</p>` : ''}
    ${ws.roster.speciesIds.length < 10 ? `<p class="small">${esc(ws.coach)} has ${ws.roster.speciesIds.length} Pokémon so far; plans use what is drafted.</p>` : ''}
    <div class="pboard" id="plan-plans" data-key="plans" tabindex="-1">${boardHtml}</div>
    ${orphans.length ? `<p class="small">${esc(C.BOARD.orphanCards)} ${orphans.map((c) => btn(C.BOARD.orphanCard(Board.cardPicks(P, c).lead.map((x) => P.spName(x)).join(' + ')), 'open-card', { card: c.id }, { cls: 'linkish' })).join(' · ')}</p>` : ''}
    ${shown.length ? `<ul class="flags">${shown.map(flagLi).join('')}</ul>${rest.length ? `<details class="small"><summary>${rest.length} more</summary><ul class="flags">${rest.map(flagLi).join('')}</ul></details>` : ''}` : ''}
    <section class="pb-g2" id="plan-cards" data-key="cards" tabindex="-1" aria-labelledby="pb-g2-h"><h3 id="pb-g2-h">${esc(C.BOARD.game2)} ${term('If-then line')}</h3>
      <ul class="g2cards">${g2('bo3-won-g1', 'If I win game 1')}${g2('bo3-lost-g1', 'If I lose game 1')}</ul></section>
    <p>${btn('⚔ Game day', 'go-gameday', {}, { primary: matchOn })}${matchOn ? '' : ' <span class="small muted">for the real best of three</span>'}</p>
    <details class="pb-before" id="plan-premortem" data-key="premortem"><summary>${esc(C.BOARD.before)}</summary>
      <div class="frow"><label class="field" for="ws-date"><span>Match date (yours)</span><input id="ws-date" type="date" data-pi="ws-date" value="${esc(/^\d{4}-\d\d-\d\d$/.test(ws.matchDate ?? '') ? ws.matchDate : '')}"></label> ${chipBtn('Next opponent', 'ws-next', {}, ws.isNext)}</div>
      <label class="field" for="ws-premortem"><span>${esc(C.PREMORTEM_Q)}</span><input id="ws-premortem" data-pi="ws-premortem" value="${esc(ws.premortem ?? '')}" maxlength="200"></label>
      <p>${btn('Make a mock brief', 'go-brief')} ${btn('Through their eyes', 'go-eyes', {}, { cls: 'linkish' })} ${btn('Rules you know', 'go-rules', {}, { cls: 'linkish' })} ${recs.length ? `<span class="small">Mock sets: ${esc(recs.join(', '))}. ${esc(C.RECORD_NOTE)}</span>` : ''}</p></details>
    <p class="cantknow">${esc(C.CANT_KNOW)}</p>`;
}
/**
 * Plan for a matchup with nothing saved yet: the board itself (it saves nothing until the first tap that writes, which
 * creates the prep). Game 2 cards, notes and "Before the match" appear once the prep exists. null when there's no preview.
 */
export function previewTab(P, m) {
  const ws = Board.previewWs(P);
  const html = ws && Board.board(P, ws, {});
  if (!html) return null;
  return `${h2(`vs ${m.opp.name} · Plan`)}<div class="pboard" id="plan-plans" data-key="plans" tabindex="-1">${html}</div>
    <p class="small muted">${esc(C.BOARD.previewNote(m.pov.name, m.opp.name))}</p>`;
}
/** Without a readable matchup (earlier prep, or the sheet not loaded): the saved plans and cards, as saved. */
function savedOnly(P, ws, plans) {
  const owner = ownerOf(ws);
  return `<p class="small muted">${esc(owner ? C.BOARD.sheetWait : C.BOARD.locked.earlier)}</p>
    <ul class="plans">${[...plans, ...ws.plans.filter((p) => p.kind === 'idea')].map((p) => {
      const card = Board.cardFor(ws, p.id), picks = Board.cardPicks(P, card);
      return `<li>${btn(p.label || C.PLAN_KIND[p.kind], 'open-plan', { plan: p.id }, { cls: 'linkish' })} <span class="small muted">${esc(C.PLAN_KIND[p.kind])}${p.members?.length ? ` · ${esc(p.members.map((m) => P.spName(m)).join(', '))}` : ''}</span>${picks.bring.length ? `<div class="small">${esc(C.BOARD.lead)}: ${esc(picks.lead.map((x) => P.spName(x)).join(' + ') || '—')} · ${esc(C.BOARD.back)}: ${esc(picks.back.map((x) => P.spName(x)).join(' + ') || '—')}</div>` : ''}</li>`;
    }).join('') || '<li class="small">No plans yet.</li>'}</ul>
    ${owner ? `<p>${btn('+ Plan', 'plan-new')}</p>` : ''}`;
}

// ---------- their plan editor ----------
function planEditor(P, ws, r) {
  const p = ws.plans.find((x) => x.id === r.id);
  if (!p) return `${h2('Not found')}<p>${esc(C.NOT_ON_DEVICE)}</p>`;
  const roster = P.rosterSpecies(ws);
  const megaOptions = P.mech ? p.members.filter((m) => Object.values(P.mech.items).some((i) => i.megaStone?.[m])) : [];
  return `${btn('‹ Plan', 'back', {}, { cls: 'back', aria: 'Back to Plan' })}${h2(p.label || C.PLAN_KIND[p.kind])}
    <label class="field" for="plan-label"><span>Name in plain words</span><input id="plan-label" data-pi="plan-label" data-plan="${esc(p.id)}" value="${esc(p.label ?? '')}" maxlength="60"></label>
    <div class="choices" role="group" aria-label="Kind">${Object.keys(C.PLAN_KIND).map((k) => chipBtn(C.PLAN_KIND[k], 'plan-set', { plan: p.id, key: 'kind', value: k }, p.kind === k)).join('')}</div>
    <p class="small">Who (tap from their roster)</p><div class="choices" role="group" aria-label="Members">${roster.map((sp) => chipBtn(P.spName(sp), 'plan-member', { plan: p.id, species: sp }, p.members.includes(sp))).join('')}</div>
    ${p.members.length > 6 ? '<p class="small">More than 6: they can only bring 6.</p>' : ''}
    <p class="small">Their Mega in this plan</p><div class="choices" role="group" aria-label="Mega">${chipBtn('No Mega', 'plan-set', { plan: p.id, key: 'megaUser', value: '' }, !p.megaUser)}${megaOptions.map((m) => chipBtn(P.spName(m), 'plan-set', { plan: p.id, key: 'megaUser', value: m }, p.megaUser === m)).join('')}</div>
    <p class="small">How it controls Speed</p><div class="choices" role="group" aria-label="Speed control">${Object.keys(C.SPEED_MODE).map((k) => chipBtn(C.SPEED_MODE[k], 'plan-set', { plan: p.id, key: 'speedMode', value: k }, p.speedMode === k)).join('')}</div>
    ${select('plan-field', Object.entries(C.FIELD).map(([k, l]) => [k, l]), p.field ?? '', { label: 'Weather or terrain', data: { pc: 'plan-field', plan: p.id } })}
    <label class="field" for="plan-needs"><span>What it needs to work</span><input id="plan-needs" data-pi="plan-needs" data-plan="${esc(p.id)}" value="${esc(p.needs ?? '')}" maxlength="120" placeholder="e.g. their setter on the field turn 1"></label>
    <p class="small">Preview tells: members this plan can't run without (team preview can confirm or rule it out)</p><div class="choices" role="group" aria-label="Preview tells">${p.members.map((sp) => chipBtn(P.spName(sp), 'plan-tell', { plan: p.id, species: sp }, (p.falsifiers?.atPreview ?? []).includes(sp))).join('')}</div>
    <label class="field" for="plan-ingame"><span>Signs in game (optional)</span><input id="plan-ingame" data-pi="plan-ingame" data-plan="${esc(p.id)}" value="${esc((p.falsifiers?.inGame ?? []).join('; '))}" maxlength="200"></label>
    ${p.basis?.length ? `<p class="small muted">Suggested from: ${esc(p.basis.join(', '))} (a guess from the public Cores rules)</p>` : ''}
    <p>${btn('+ Plan card against this', 'card-new', { kind: 'plan', plan: p.id })} ${btn('Delete this plan', 'plan-delete', { plan: p.id })}</p>`;
}

// ---------- through their eyes ----------
function eyes(P, ws) {
  const me = P.myCoach();
  const mine = P.coachRoster(me), theirs = P.coachRoster(ws.coach);
  const cx = P.app.coresCx();
  const could = P.mech ? couldBringAgainst(cx, P.mech, mine, theirs, P.app.usage(), { keyMoves: (id) => P.dexSp(id)?.keyMoves ?? [] }) : [];
  const LADDER = { yes: '', no: ', learnable only', only: ', its only ability', unknown: '' };
  const unknownLadder = could.some((c) => c.answers.some((a) => a.mons.some((m) => m.via.some((v) => v.ladder === 'unknown'))));
  return `${btn('‹ Plan', 'back', {}, { cls: 'back', aria: 'Back to Plan' })}${h2('Through their eyes')}
    <p>${btn(`See your 10 as ${ws.coach} sees it`, 'view-as', {}, { primary: true })} <span class="small">Opens League with ${esc(ws.coach)} selected; a banner brings you back. Your prep doesn't change.</span></p>
    <h3>Could bring against you <span class="small muted">(${esc(C.COULD_NOT_WILL)})</span> ${term('Counter-prep')}</h3>
    ${could.length ? could.map((c) => `<div class="could"><p><b>Against your ${esc(c.label)}</b></p><ul class="small">${c.answers.map((a) => `<li>${esc(a.label)}: ${a.mons.map((m) => `${esc(P.spName(m.id))} (${m.via.map((v) => `${esc(v.kind === 'move' ? P.name('moves', v.id) : P.name('abilities', v.id))}${LADDER[v.ladder] ?? ''}`).join(', ')}) ${m.via.some((v) => v.kind === 'move') ? btn('Add to a counter-prep set', 'eyes-counterset', { species: m.id, move: m.via.find((v) => v.kind === 'move').id }, { cls: 'linkish' }) : ''}`).join('; ')}</li>`).join('')}</ul></div>`).join('')
      : `<p class="small">${P.mech ? 'No listed counters to your current cores from their roster.' : 'Loading the Reg M-C learnsets…'}</p>`}
    <p class="small">From Reg M-C learnsets checked against Showdown's team validator, and the public Cores rules. "Learnable only" means ladder data shows it isn't common: a tech they could add.${unknownLadder ? ' Ladder data is unavailable right now, so how common the rest are is unknown.' : ''}</p>
    <label class="field" for="eyes-answer"><span>${esc(C.EYES_Q)}</span><textarea id="eyes-answer" rows="2" data-pi="eyes-answer">${esc(ws.eyesAnswer ?? '')}</textarea></label>
    <p>${btn('Use this for the "They prepped against me" plan', 'eyes-to-plan')}</p>`;
}

// ---------- plan card editor ----------
function cardEditor(P, ws, r) {
  const c = ws.cards.find((x) => x.id === r.id);
  if (!c) return `${h2('Not found')}<p>${esc(C.NOT_ON_DEVICE)}</p>`;
  const theirRoster = P.rosterSpecies(ws);
  if (c.kind !== 'plan') {
    return `${btn('‹ Plan', 'back', {}, { cls: 'back', aria: 'Back to Plan' })}${h2(C.CARD_KIND[c.kind])}
      <p class="small">Written now, read between games (Showdown starts game 2 about 40 seconds after game 1). One change is usually all there is time for.</p>
      <label class="field" for="card-text"><span>${c.kind === 'bo3-won-g1' ? 'If I win game 1, in game 2 I…' : 'If I lose game 1, in game 2 I…'}</span><textarea id="card-text" rows="3" data-pi="card-text" data-card="${esc(c.id)}">${esc(c.turn1Intent ?? '')}</textarea></label>
      <p class="small">${esc(C.TENDENCY)}</p>${btn('Delete this card', 'card-delete', { card: c.id })}`;
  }
  const lines = c.ifThen ?? [];
  const picks = Board.cardPicks(P, c);
  // Lead / Back / Mega are picked on the Plan board (species; sets attach there); this screen keeps the rest of the card
  return `${btn('‹ Plan', 'back', {}, { cls: 'back', aria: 'Back to Plan' })}${h2('Plan card')}
    <p class="small">Against</p><div class="choices" role="group" aria-label="Against their plans">${ws.plans.map((p) => chipBtn(p.label || C.PLAN_KIND[p.kind], 'card-vs', { card: c.id, plan: p.id }, (c.vsPlanIds ?? []).includes(p.id))).join('')}</div>
    <p class="small">${esc(C.BOARD.lead)}: ${esc(picks.lead.map((x) => P.spName(x)).join(' + ') || '—')} · ${esc(C.BOARD.back)}: ${esc(picks.back.map((x) => P.spName(x)).join(' + ') || '—')}${picks.mega ? ` · ${esc(C.BOARD.mega)}: ${esc(P.spName(picks.megaForm || picks.mega))}` : ''} ${btn('Change on the board', 'back', {}, { cls: 'linkish' })}</p>
    <label class="field" for="card-t1"><span>What your lead does turn 1</span><input id="card-t1" data-pi="card-t1" data-card="${esc(c.id)}" value="${esc(c.turn1Intent ?? '')}" maxlength="160"></label>
    <label class="field" for="card-win"><span>Win condition: what has to be true at the end?${P.docs.meta.prefs?.beginnerPrompts !== false ? '' : ' (optional)'}</span><input id="card-win" data-pi="card-win" data-card="${esc(c.id)}" value="${esc(c.winCondition ?? '')}" maxlength="160"></label>
    <h3>If-then lines ${term('If-then line')}</h3>
    ${lines.map((l, i) => `<div class="ifthen"><p class="small">If they lead</p><div class="choices" role="group" aria-label="Their lead">${theirRoster.map((sp) => chipBtn(P.spName(sp), 'ifthen-lead', { card: c.id, i, species: sp }, (l.trigger?.theirLead ?? []).includes(sp))).join('')}</div>
      <label class="field" for="ifthen-${i}"><span>then</span><input id="ifthen-${i}" data-pi="ifthen-resp" data-card="${esc(c.id)}" data-i="${i}" value="${esc(l.response ?? '')}" maxlength="160"></label>${btn('Remove', 'ifthen-remove', { card: c.id, i }, { cls: 'linkish' })}</div>`).join('')}
    <p>${btn('+ If-then line', 'ifthen-add', { card: c.id })}${lines.length >= 3 ? ' <span class="small muted">Three lines cover most leads; more is fine.</span>' : ''}</p>
    <p>${btn('Delete this card', 'card-delete', { card: c.id })}</p>`;
}

// ---------- Game day ----------
/** The match Game day shows: the one you opened, else the newest. */
function currentMatch(ws, ui = {}) { return ws.matches.find((x) => x.id === ui.matchId) ?? ws.matches.at(-1) ?? null; }
const setScore = (m) => [m.games.filter((g) => g.result === 'W').length, m.games.filter((g) => g.result === 'L').length];
const decided = (m) => Math.max(...setScore(m)) >= 2;
function gameday(P, ws) {
  const m = currentMatch(ws, P.wsUi(ws.id));
  if (!m) return `${btn('‹ Plan', 'back', {}, { cls: 'back', aria: 'Back to Plan' })}${h2('Game day')}<p>For the real best of three: their 6 at preview, the closest plan and its card, a short log between games, and what each side has revealed.</p>${btn('Start the match', 'match-start', {}, { primary: true })}`;
  const ui = P.wsUi(ws.id);
  const gi = Math.min(ui.game ?? m.games.length, 2);
  const rules = P.docs.rules.rules;
  const wins = m.games.filter((g) => g.result === 'W').length, losses = m.games.filter((g) => g.result === 'L').length;
  const six = m.their6 ?? [];
  const close = closestPlans(ws.plans, six);
  const best = six.length ? close.find((c) => c.alive) : null;
  const plan = best ? ws.plans.find((p) => p.id === best.planId) : null;
  const card = plan ? ws.cards.find((c) => c.kind === 'plan' && c.vsPlanIds?.includes(plan.id)) : null;
  const g1 = m.games[0];
  const branch = g1?.result ? ws.cards.find((c) => c.kind === (g1.result === 'W' ? 'bo3-won-g1' : 'bo3-lost-g1')) : null;
  const sheets = rules.disclosure?.value ?? 'unknown';
  const reveals = ws.reveals.filter((r) => r.gameRef?.type === 'match' && r.gameRef.setId === m.id);
  const them = ledgerThem(reveals);
  const excl = itemClauseExclusions(reveals, P.docs.rules);
  const bounds = reveals.filter((r) => r.kind === 'moved-before' || r.kind === 'moved-after').map((r) => ({ r, b: speedBound(r, r.context ?? {}) }));
  const v = defaultVariant(ws) ?? variantOf(P, ws);
  const theirMega = m.games.map((g) => g.theirMega).find(Boolean);
  const meSeen = [...new Set(m.games.flatMap((g) => [...(g.myLead ?? []), ...(g.my4 ?? [])]).filter(Boolean))].map((id) => P.spName(P.lineage(id)?.speciesId ?? id));
  const myMega = m.games.map((g) => g.myMega).find(Boolean);
  return `${btn('‹ Plan', 'back', {}, { cls: 'back', aria: 'Back to Plan' })}${h2(`vs ${ws.coach} · Game day`)}
    <p><b>Set ${wins}–${losses}</b></p>
    <div class="choices" role="group" aria-label="Game">${[0, 1, 2].map((i) => chipBtn(`Game ${i + 1}${m.games[i]?.result ? ` ${m.games[i].result === 'W' ? '✓ won' : '✗ lost'}` : ''}`, 'gd-game', { i }, gi === i)).join('')}</div>
    <p class="small">Your 6: ${m.my6.map((x) => esc(P.spName(P.lineage(x.setId)?.speciesId ?? ''))).join(' · ') || 'not set'} ${btn('Use your current 6', 'match-six')}</p>
    ${sheets === 'unknown' ? `<p class="small">Team sheets: don't know. With open sheets they see your moves, items, abilities and natures at preview; with closed sheets only species.</p>` : sheets === 'open-at-preview' ? '<p class="small">Open team sheets: they see your moves, items, abilities and natures at preview. Focus on leads, Mega timing and play.</p>' : ''}
    <p class="small">Their 6 at team preview (tap ${Math.max(0, 6 - six.length)} more)</p>
    <div class="choices" role="group" aria-label="Their 6">${P.rosterSpecies(ws).map((sp) => chipBtn(P.spName(sp), 'gd-their6', { species: sp }, six.includes(sp))).join('')}</div>
    ${six.length ? `<p>${plan ? `Closest plan: <b>${esc(plan.label || C.PLAN_KIND[plan.kind])}</b> (${best.matched} of ${best.of} match)` : 'No plan fits their preview: think about the lead from scratch.'}</p>${close.filter((c) => !c.alive && c.missingTells.length).slice(0, 2).map((c) => `<p class="small">No ${c.missingTells.map((t) => esc(P.spName(t))).join(', ')} in their 6: "${esc(ws.plans.find((p) => p.id === c.planId)?.label ?? '')}" is off.</p>`).join('')}` : ''}
    ${gi === 1 && g1?.result ? (branch ? `<div class="card branch"><p><b>Your card for game 2 (you ${g1.result === 'W' ? 'won' : 'lost'} game 1)</b></p><p>${esc(branch.turn1Intent ?? '')}</p></div>`
      : `<div class="card branch"><p><b>No card for game 2 after a ${g1.result === 'W' ? 'win' : 'loss'}.</b> One question: ${esc(C.BETWEEN_GAMES_Q[0])}</p></div>`) : ''}
    ${gi === 2 ? `<div class="card branch"><p><b>Game 3.</b> What did game 2 show? ${esc(C.BETWEEN_GAMES_Q[0])}</p></div>` : ''}
    ${card ? `<div class="card"><p><b>${esc(plan.label || '')} card</b>: lead ${Board.cardPicks(P, card).lead.map((id) => esc(P.spName(id))).join(' + ')}${card.turn1Intent ? `. Turn 1: ${esc(card.turn1Intent)}` : ''}</p>${(card.ifThen ?? []).filter((l) => l.response).map((l) => `<p class="small">IF they lead ${(l.trigger?.theirLead ?? []).map((s) => esc(P.spName(s))).join(' + ')} THEN ${esc(l.response)}</p>`).join('')}</div>` : ''}
    <h3>After game ${gi + 1}</h3>${logForm(P, ws, { kind: 'match', id: m.id, index: gi })}
    <h3>Reveals</h3>${revealForm(P, ws, m)}
    <div class="ledger"><div><h4>What you know about them</h4><ul class="small reveal-list">${[...them].map(([sp, rs]) => `<li><b>${esc(P.spName(sp))}</b><ul>${rs.map((x) => revealRow(P, ws, x)).join('')}</ul></li>`).join('') || '<li>Nothing yet.</li>'}${theirMega ? `<li>Mega: ${esc(P.spName(theirMega))}</li>` : ''}</ul></div>
      <div><h4>What they've seen of you</h4><ul class="small">${meSeen.length ? `<li>Brought or led: ${esc(meSeen.join(', '))}</li>` : '<li>Nothing logged yet.</li>'}${myMega ? `<li>Your Mega: ${esc(P.spName(P.lineage(myMega)?.speciesId ?? ''))}</li>` : ''}${sheets !== 'closed' ? `<li>${sheets === 'open-at-preview' ? 'Your 6\'s moves, items, abilities and natures (open team sheets)' : 'If sheets are open: your 6\'s moves, items, abilities and natures'}</li>` : ''}</ul></div></div>
    <h3>What that tells you (with conditions)</h3><ul class="small">${excl.map((e) => `<li>${e.conditional ? 'If item clause: ' : ''}no other Pokémon of theirs holds ${esc(P.name('items', e.item))} (${esc(P.spName(e.holder))} has it).</li>`).join('')}
      ${bounds.map(({ r, b }) => { if (b.none) return `<li>${esc(P.spName(r.speciesId))}: no Speed bound (${esc(b.none === 'priority-unknown' ? 'priority not confirmed' : 'your Speed unknown')}).</li>`; const l = theirSetFor(ws, v, r.speciesId); const rng = speedRange(P.mech?.species[r.speciesId]?.baseStats.spe ?? 0, { scarf: l && currentVersion(l).data.item === 'choicescarf' }); const rel = boundVsRange(b, rng); return `<li>${esc(P.spName(r.speciesId))}: Speed ${b.bound === 'min' ? 'at least' : 'at most'} ${b.value} (a tie is possible)${rel === 'not-minimum' ? ', so it isn\'t minimum Speed' : rel === 'not-maximum' ? ', so it isn\'t maximum Speed' : rel === 'contradicts' ? '; that doesn\'t fit its normal range: check the conditions' : ''}. Breaks if: priority, Choice Scarf, Quick Claw${b.breaks.includes('tailwind-applied') ? ', Tailwind' : ''}${b.breaks.includes('paralysis-applied') ? ', paralysis' : ''}.</li>`; }).join('')}
      ${!excl.length && !bounds.length ? '<li>Nothing yet. A single HP reading is consistent with many spreads, so it isn\'t used as a read on theirs.</li>' : ''}</ul>
    <h3>Before the next game</h3><ul class="small">${C.BETWEEN_GAMES_Q.map((q) => `<li>${esc(q)}</li>`).join('')}</ul><p class="small">${esc(C.TENDENCY)}</p>
    <p>${btn('Debrief this match', 'match-debrief')} ${btn('Start a new match', 'match-start')}</p>
    ${ui.confirmNewMatch ? `<p class="banner warn">This set is ${wins}–${losses} and not decided. Start a new match anyway? This one stays under "Earlier matches". ${btn('Start a new match', 'match-start', { confirmed: 'yes' })} ${btn('Cancel', 'match-start-cancel')}</p>` : ''}
    ${ws.matches.length > 1 ? `<h3>Earlier matches</h3><ul class="small">${ws.matches.filter((x) => x !== m).slice().reverse().map((x) => `<li>${esc(x.date)} · ${setScore(x).join('–')} ${btn('Open', 'match-open', { match: x.id }, { cls: 'linkish' })}</li>`).join('')}</ul>` : ''}
    <div class="bottombar">${btn('Quick check', 'calc-new')}${btn('Speed', 'go-speed')}</div>`;
}
function revealText(P, r) {
  if (r.kind === 'move') return P.name('moves', r.value);
  if (r.kind === 'item') return P.name('items', r.value);
  if (r.kind === 'ability') return P.name('abilities', r.value);
  if (r.kind === 'mega') return 'Mega Evolved';
  if (r.kind === 'moved-before' || r.kind === 'moved-after') return `${r.kind === 'moved-before' ? 'moved before' : 'moved after'} your ${P.spName(r.context?.mySpecies ?? '')}`;
  return r.kind;
}
/** Their sets for a species that a reveal should update: every set any version of their team uses, else the newest. */
function revealTargets(ws, speciesId) {
  const used = [...new Set(ws.variants.map((v) => v.setIds?.[speciesId]).filter(Boolean))].map((id) => ws.theirSets.find((s) => s.id === id)).filter(Boolean);
  return used.length ? used : [setForSpecies(ws, null, speciesId)].filter(Boolean);
}
const seenIn = (l, r) => { const v = currentVersion(l); const i = r.kind === 'move' ? v.data.moves.indexOf(r.value) : -1;
  return r.kind === 'move' ? i >= 0 && v.provenance?.moves?.[i]?.source === 'seen-vs-me' : v.data[r.kind] === r.value && v.provenance?.[r.kind]?.source === 'seen-vs-me'; };
/** One reveal with its tap actions: put it into their sets (as "seen against you") and remove a mistaken entry. */
function revealRow(P, ws, r) {
  const settable = ['move', 'item', 'ability'].includes(r.kind) && r.value;
  const targets = settable ? revealTargets(ws, r.speciesId) : [];
  const done = targets.length && targets.every((l) => seenIn(l, r));
  const confirm = !settable ? '' : !targets.length ? '<span class="muted">no set for it yet</span>' : done ? '<span class="muted">in their set ✓</span>'
    : btn(targets.length > 1 ? `Add to their ${targets.length} sets` : 'Add to their set', 'rv-confirm', { reveal: r.id }, { cls: 'linkish' });
  return `<li>${esc(revealText(P, r))} ${confirm} ${btn('Remove', 'rv-del', { reveal: r.id }, { cls: 'linkish', aria: `Remove reveal: ${P.spName(r.speciesId)} ${revealText(P, r)}` })}</li>`;
}
function revealForm(P, ws, m) {
  const ui = P.wsUi(ws.id);
  const rf = (ui.rf ??= { species: '', kind: 'move', value: '' });
  const sp = rf.species;
  let values = [];
  if (sp && P.mech) {
    if (rf.kind === 'move') values = learnset(P.mech, sp).map((x) => [x, P.name('moves', x)]);
    else if (rf.kind === 'item') values = Object.keys(P.mech.items).filter((i) => !P.mech.items[i].megaStone || P.mech.items[i].megaStone[sp]).map((x) => [x, P.name('items', x)]);
    else if (rf.kind === 'ability') values = legalAbilities(P.mech, sp).map((x) => [x, P.name('abilities', x)]);
  }
  const mine = m.my6.map((x) => P.lineage(x.setId)).filter(Boolean);
  return `<div class="reveal">${select('rv-species', [['', 'Their Pokémon…'], ...P.rosterSpecies(ws).map((x) => [x, P.spName(x)])], sp, { data: { pc: 'rv-species' }, label: 'Pokémon' })}
    <div class="choices" role="group" aria-label="What was revealed">${['move', 'item', 'ability', 'moved-before', 'moved-after'].map((k) => chipBtn({ move: 'Move', item: 'Item', ability: 'Ability', 'moved-before': 'Moved before', 'moved-after': 'Moved after' }[k], 'rv-kind', { kind: k }, rf.kind === k)).join('')}</div>
    ${['move', 'item', 'ability'].includes(rf.kind) ? select('rv-value', [['', 'Choose…'], ...values], rf.value, { data: { pc: 'rv-value' }, label: 'Value' }) : `${select('rv-mine', [['', 'Your Pokémon…'], ...mine.map((l) => [l.id, P.spName(l.speciesId)])], rf.mine ?? '', { data: { pc: 'rv-mine' }, label: 'than your' })} ${chipBtn('Same priority', 'rv-flag', { key: 'samePriority' }, rf.samePriority)}${chipBtn('Trick Room up', 'rv-flag', { key: 'trickRoom' }, rf.trickRoom)}${chipBtn('Their Tailwind', 'rv-flag', { key: 'tailwindThem' }, rf.tailwindThem)}${chipBtn('Your Tailwind', 'rv-flag', { key: 'tailwindMe' }, rf.tailwindMe)}`}
    ${btn('Add reveal', 'rv-add', {}, { disabled: !sp })}</div>`;
}

export const views = { theirplan: planEditor, eyes: (P, ws) => eyes(P, ws), card: cardEditor, gameday: (P, ws) => gameday(P, ws) };

// ---------- actions ----------
const W = (P) => P.ws.get(P.route.wsId);
const mut = (P, fn, o) => P.mutate(`ws:${P.route.wsId}`, fn, o);
export const actions = {
  'go-eyes': (t, P) => P.go({ view: 'ws', wsId: P.route.wsId, kind: 'eyes' }, { push: true }),
  'go-gameday': (t, P) => P.go({ view: 'ws', wsId: P.route.wsId, kind: 'gameday' }, { push: true }),
  'go-sets-tab': (t, P) => P.go({ view: 'ws', wsId: P.route.wsId, tab: 'sets' }, { push: false }),
  'go-brief': (t, P) => P.go({ view: 'ws', wsId: P.route.wsId, kind: 'brief' }, { push: true }),
  // "Next opponent" is one per owner: only this workspace's owner's other workspaces are cleared (never another coach's
  // perspective, and an unassigned workspace only clears other unassigned ones)
  'ws-next': (t, P) => {
    const me = ownerOf(W(P));
    for (const w of P.ws.values()) if (w.id !== P.route.wsId && w.isNext && ownerOf(w) === me) P.mutate(`ws:${w.id}`, (d) => { d.isNext = false; }, { render: false });
    mut(P, (d) => { d.isNext = !d.isNext; });
  },
  'roster-update': (t, P) => mut(P, (d) => { d.roster = { ...d.roster, speciesIds: P.coachRoster(d.coach), fetchedAt: P.app.sheet()?.fetchedAt ?? null }; }),
  'roster-keep': (t, P) => mut(P, (d) => { d.roster = { ...d.roster, keptOld: P.now() }; d.dismissedFlags = [...(d.dismissedFlags ?? []), 'F12']; }),
  'flag-dismiss': (t, P) => mut(P, (d) => { d.dismissedFlags = [...(d.dismissedFlags ?? []), t.dataset.code + (t.dataset.ref ? `:${t.dataset.ref}` : '')]; }, { substantive: false }),
  'flag-go': (t, P) => {
    const c = t.dataset.code, ws = P.route.wsId;
    if (['F4', 'F5', 'F6'].includes(c) && t.dataset.ref) P.go({ view: 'ws', wsId: ws, kind: 'calcs', id: t.dataset.ref }, { push: true });
    else if (c === 'F11') P.go({ view: 'ws', wsId: ws, tab: 'calcs' }, { push: false });
    else if (c === 'F16') P.go({ view: 'rules' }, { push: true });
    else if (c === 'F14') P.go({ view: 'ws', wsId: ws, kind: 'eyes' }, { push: true });
    else if (c === 'F15') actions['plan-new']({ dataset: { mega: t.dataset.ref } }, P);
    else if (c === 'F7') P.go({ view: 'ws', wsId: ws, kind: 'speed' }, { push: true });
    else if ((c === 'F19' || c === 'F20') && t.dataset.ref) P.go({ view: 'ws', wsId: ws, kind: 'mock', id: t.dataset.ref }, { push: true });
    else P.go({ view: 'ws', wsId: ws, tab: 'practice' }, { push: false });
  },
  'plans-suggest': (t, P) => {
    const ws = W(P);
    const sugg = suggestPlans(P.app.coresCx(), P.app.dex, P.coachRoster(ws.coach));
    if (!sugg.length && !ws.plans.some((p) => p.kind === 'counterprep')) { P.toast('No core suggestions for this roster; add your own plan'); }
    mut(P, (d) => {
      let added = 0;
      for (const s of sugg) {
        if (d.plans.some((p) => p.basis?.includes(s.coreId) && (p.megaUser ?? null) === s.megaUser)) continue;
        if (added >= 2) break;
        d.plans.push({ id: P.id('plan'), label: `${s.label}${s.megaUser ? ` (Mega ${P.spName(s.megaUser)})` : ''}`, kind: d.plans.some((p) => p.kind === 'likely') ? 'alt' : 'likely', members: s.members, megaUser: s.megaUser, speedMode: s.speedMode, field: s.field, needs: '', basis: [s.coreId], falsifiers: { atPreview: s.tells, inGame: [] }, updatedAt: P.now() });
        added++;
      }
      if (!d.plans.some((p) => p.kind === 'counterprep')) d.plans.push({ id: P.id('plan'), label: '', kind: 'counterprep', members: [], megaUser: null, speedMode: 'unknown', field: '', needs: '', basis: [], falsifiers: { atPreview: [], inGame: [] }, updatedAt: P.now() });
    });
  },
  'plan-new': (t, P) => {
    const id = P.id('plan');
    mut(P, (d) => { d.plans.push({ id, label: '', kind: d.plans.some((p) => p.kind === 'likely') ? 'alt' : 'likely', members: t.dataset.mega ? [t.dataset.mega] : [], megaUser: t.dataset.mega || null, speedMode: 'unknown', field: '', needs: '', basis: [], falsifiers: { atPreview: [], inGame: [] }, updatedAt: P.now() }); });
    P.go({ view: 'ws', wsId: P.route.wsId, kind: 'theirplan', id }, { push: true });
  },
  'open-plan': (t, P) => P.go({ view: 'ws', wsId: P.route.wsId, kind: 'theirplan', id: t.dataset.plan }, { push: true }),
  'plan-set': (t, P) => mut(P, (d) => { const p = d.plans.find((x) => x.id === t.dataset.plan); p[t.dataset.key] = t.dataset.value || null; if (t.dataset.key === 'kind') p.kind = t.dataset.value; }),
  'plan-member': (t, P) => mut(P, (d) => { const p = d.plans.find((x) => x.id === t.dataset.plan); const s = t.dataset.species; p.members = p.members.includes(s) ? p.members.filter((x) => x !== s) : [...p.members, s]; if (!p.members.includes(p.megaUser)) p.megaUser = null; p.falsifiers.atPreview = (p.falsifiers.atPreview ?? []).filter((x) => p.members.includes(x)); }),
  'plan-tell': (t, P) => mut(P, (d) => { const p = d.plans.find((x) => x.id === t.dataset.plan); const s = t.dataset.species; const a = p.falsifiers.atPreview ?? []; p.falsifiers.atPreview = a.includes(s) ? a.filter((x) => x !== s) : [...a, s]; }),
  'plan-delete': (t, P) => { mut(P, (d) => { d.plans = d.plans.filter((p) => p.id !== t.dataset.plan); for (const c of d.cards) c.vsPlanIds = (c.vsPlanIds ?? []).filter((id) => id !== t.dataset.plan); }); P.back(); },
  'view-as': (t, P) => P.app.viewAs(W(P).coach, () => P.go({ view: 'ws', wsId: P.route.wsId, kind: 'eyes' }, { push: false })),
  'eyes-to-plan': (t, P) => mut(P, (d) => {
    let p = d.plans.find((x) => x.kind === 'counterprep');
    if (!p) { p = { id: P.id('plan'), label: '', kind: 'counterprep', members: [], megaUser: null, speedMode: 'unknown', field: '', needs: '', basis: [], falsifiers: { atPreview: [], inGame: [] }, updatedAt: P.now() }; d.plans.push(p); }
    p.needs = (d.eyesAnswer ?? '').slice(0, 120); if (!p.label) p.label = 'They prepped against me';
  }),
  'eyes-counterset': (t, P) => {
    const ws = W(P);
    if (!P.mech) return;
    const sp = t.dataset.species, mv = t.dataset.move;
    mut(P, (d) => {
      let v = d.variants.find((x) => x.role === 'counterprep');
      const base = d.variants.find((x) => x.role === 'likely');
      if (!v) { v = { id: P.id('var'), role: 'counterprep', name: '', setIds: { ...(base?.setIds ?? {}) }, whyBuilt: 'What they could add after studying your 10', planId: null, updatedAt: P.now() }; d.variants.push(v); }
      const src = d.theirSets.find((s) => s.id === v.setIds[sp]) ?? d.theirSets.find((s) => s.speciesId === sp);
      const data = src ? structuredClone(currentVersion(src).data) : { item: '', ability: legalAbilities(P.mech, sp)[0] ?? '', nature: '', moves: [], sp: 'unknown' };
      const prov = src ? structuredClone(currentVersion(src).provenance ?? {}) : { moves: [] };
      if (!data.moves.includes(mv)) {
        const i = Math.min(data.moves.length, 3);
        data.moves[i] = mv; prov.moves ??= []; prov.moves[i] = { source: 'counterprep-guess', asOf: P.now().slice(0, 10) };
      }
      const l = newLineage({ id: P.id('set'), side: 'theirs', coach: d.coach, speciesId: sp, name: `Counter-prep: ${P.name('moves', mv)}`, data, provenance: prov, now: P.now(), reason: 'counter-prep idea (learnable, could not will)' });
      d.theirSets.push(l);
      v.setIds[sp] = l.id;
    });
    P.toast(`Counter-prep set added for ${P.spName(sp)} (could, not will)`);
  },
  'card-new': (t, P) => {
    const id = P.id('card');
    mut(P, (d) => { d.cards.push({ id, kind: t.dataset.kind, vsPlanIds: t.dataset.plan ? [t.dataset.plan] : [], bring4: [], lead: [], back: [], mega: null, turn1Intent: '', winCondition: '', ifThen: t.dataset.kind === 'plan' ? [{ trigger: { theirLead: [] }, response: '' }] : [], infoPlan: [], updatedAt: P.now() }); });
    P.go({ view: 'ws', wsId: P.route.wsId, kind: 'card', id }, { push: true });
  },
  'open-card': (t, P) => P.go({ view: 'ws', wsId: P.route.wsId, kind: 'card', id: t.dataset.card }, { push: true }),
  'card-vs': (t, P) => mut(P, (d) => { const c = d.cards.find((x) => x.id === t.dataset.card); const a = c.vsPlanIds ?? []; c.vsPlanIds = a.includes(t.dataset.plan) ? a.filter((x) => x !== t.dataset.plan) : [...a, t.dataset.plan]; }),
  'card-delete': (t, P) => { mut(P, (d) => { d.cards = d.cards.filter((c) => c.id !== t.dataset.card); }); P.back(); },
  'ifthen-add': (t, P) => mut(P, (d) => { d.cards.find((x) => x.id === t.dataset.card).ifThen.push({ trigger: { theirLead: [] }, response: '' }); }),
  'ifthen-remove': (t, P) => mut(P, (d) => { d.cards.find((x) => x.id === t.dataset.card).ifThen.splice(Number(t.dataset.i), 1); }),
  'ifthen-lead': (t, P) => mut(P, (d) => { const l = d.cards.find((x) => x.id === t.dataset.card).ifThen[Number(t.dataset.i)]; const a = l.trigger.theirLead ?? []; l.trigger.theirLead = a.includes(t.dataset.species) ? a.filter((x) => x !== t.dataset.species) : [...a, t.dataset.species].slice(-2); }),
  'match-start': (t, P) => {
    const ws = W(P), ui = P.wsUi(ws.id), cur = currentMatch(ws, ui);
    // mid-set, a stray tap must not bury the match in progress
    if (cur && (cur.games.length || cur.their6?.length) && !decided(cur) && t.dataset.confirmed !== 'yes') { ui.confirmNewMatch = true; P.app.rerender(); return; }
    ui.confirmNewMatch = false;
    const id = P.id('match'), date = P.now().slice(0, 10);
    ui.matchId = id; ui.game = 0; // before the save renders, so the screen switches to the new match
    mut(P, (d) => { d.matches.push({ id, date, rulesAsPlayed: structuredClone(P.docs.rules.rules), my6: d.my6.map((m) => ({ setId: m.setId, v: P.lineage(m.setId)?.currentV ?? null })), their6: [], games: [], debrief: null }); });
    // with open team sheets, your whole 6 (moves, item, ability, nature; never Stat Points) is seen at preview
    const sheets = P.docs.rules.rules.disclosure?.value;
    if (sheets === 'open-at-preview' || sheets === 'exchanged-in-advance') {
      for (const m of ws.my6) P.mutate('mysets', (d) => { const i = d.sets.findIndex((s) => s.id === m.setId); if (i >= 0) d.sets[i] = addRevealed(d.sets[i], { who: ws.coach, what: ['species', 'moves', 'item', 'ability', 'nature'], when: date, where: `match ${date} team sheet` }); }, { render: false });
    }
  },
  'match-start-cancel': (t, P) => { P.wsUi(P.route.wsId).confirmNewMatch = false; P.app.rerender(); },
  'match-open': (t, P) => { const ui = P.wsUi(P.route.wsId); ui.matchId = t.dataset.match; ui.game = undefined; ui.confirmNewMatch = false; P.app.rerender(); },
  'match-six': (t, P) => mut(P, (d) => { const m = currentMatch(d, P.wsUi(d.id)); m.my6 = d.my6.map((x) => ({ setId: x.setId, v: P.lineage(x.setId)?.currentV ?? null })); }),
  'gd-game': (t, P) => { P.wsUi(P.route.wsId).game = Number(t.dataset.i); P.app.rerender(); },
  'gd-their6': (t, P) => mut(P, (d) => { const m = currentMatch(d, P.wsUi(d.id)); const a = m.their6 ?? []; m.their6 = a.includes(t.dataset.species) ? a.filter((x) => x !== t.dataset.species) : [...a, t.dataset.species].slice(0, 6); }),
  'match-debrief': (t, P) => P.go({ view: 'ws', wsId: P.route.wsId, kind: 'mock', id: currentMatch(W(P), P.wsUi(P.route.wsId)).id }, { push: true }),
  'rv-kind': (t, P) => { const rf = P.wsUi(P.route.wsId).rf; rf.kind = t.dataset.kind; rf.value = ''; P.app.rerender(); },
  'rv-flag': (t, P) => { const rf = P.wsUi(P.route.wsId).rf; rf[t.dataset.key] = !rf[t.dataset.key]; P.app.rerender(); },
  'rv-add': (t, P) => {
    const ws = W(P), m = currentMatch(ws, P.wsUi(ws.id)), rf = P.wsUi(ws.id).rf;
    if (!rf.species) return;
    let context = null;
    if (rf.kind === 'moved-before' || rf.kind === 'moved-after') {
      const l = rf.mine ? P.lineage(rf.mine) : null;
      const data = l ? currentVersion(l).data : null;
      let myStat = null;
      if (data && data.sp !== 'unknown' && P.mech) {
        const f = battleForme(P.mech, l.speciesId, data.item);
        myStat = speedOf(statValue('spe', P.mech.species[f.error ? l.speciesId : f.id].baseStats.spe, data.sp.spe ?? 0, natureSign(P.mech.natures[data.nature], 'spe')), { tailwind: rf.tailwindMe, scarf: data.item === 'choicescarf' }).speed;
      }
      context = { priority: rf.samePriority ? 'same' : 'unknown', trickRoom: !!rf.trickRoom, tailwindThem: !!rf.tailwindThem, tailwindMe: !!rf.tailwindMe, myStat, mySpecies: l?.speciesId ?? null };
    } else if (!rf.value) { P.toast('Choose what was revealed'); return; }
    mut(P, (d) => { d.reveals.push({ id: P.id('rvl'), side: 'theirs', gameRef: { type: 'match', setId: m.id, game: P.wsUi(ws.id).game ?? 0 }, speciesId: rf.species, kind: rf.kind, value: rf.value || null, context, at: P.now() }); });
    P.wsUi(ws.id).rf = { species: '', kind: 'move', value: '' };
    P.toast(['move', 'item', 'ability'].includes(rf.kind) ? 'Reveal saved. "Add to their set" (below) puts it into their set.' : 'Reveal saved');
  },
  'rv-confirm': (t, P) => {
    const ws = W(P), r = ws.reveals.find((x) => x.id === t.dataset.reveal);
    if (!r) return;
    const outs = revealTargets(ws, r.speciesId).map((l) => ({ l, out: applyReveal(l, r, { now: P.now() }) }));
    const changed = outs.filter((x) => x.out.lineage);
    const full = outs.filter((x) => x.out.conflict);
    if (changed.length) mut(P, (d) => { for (const { l, out } of changed) { const i = d.theirSets.findIndex((s) => s.id === l.id); d.theirSets[i] = out.lineage; } });
    P.toast(changed.length ? `Their ${P.spName(r.speciesId)} ${changed.length > 1 ? `${changed.length} sets` : 'set'} updated (new version)${full.length ? `; ${full.length} already had 4 confirmed moves: edit to choose` : ''}`
      : full.length ? 'Their set already has 4 confirmed moves. Edit the set to choose which one to replace.' : 'Already in their set as seen against you');
  },
  'rv-del': (t, P) => { mut(P, (d) => { d.reveals = d.reveals.filter((x) => x.id !== t.dataset.reveal); }); P.toast('Reveal removed'); },
  ...logActions,
  ...Board.actions,
};
export const changes = {
  'plan-field': (t, P) => mut(P, (d) => { d.plans.find((x) => x.id === t.dataset.plan).field = t.value; }),
  'rv-species': (t, P) => { P.wsUi(P.route.wsId).rf.species = t.value; P.app.rerender(); },
  'rv-value': (t, P) => { P.wsUi(P.route.wsId).rf.value = t.value; },
  'rv-mine': (t, P) => { P.wsUi(P.route.wsId).rf.mine = t.value; },
  ...logChanges,
};
export const inputs = {
  'ws-date': (t, P) => mut(P, (d) => { d.matchDate = t.value.slice(0, 40); }, { render: false }),
  'ws-premortem': (t, P) => mut(P, (d) => { d.premortem = t.value.slice(0, 200); }, { render: false }),
  'eyes-answer': (t, P) => mut(P, (d) => { d.eyesAnswer = t.value.slice(0, 400); }, { render: false }),
  'plan-label': (t, P) => mut(P, (d) => { d.plans.find((x) => x.id === t.dataset.plan).label = t.value.slice(0, 60); }, { render: false }),
  'plan-needs': (t, P) => mut(P, (d) => { d.plans.find((x) => x.id === t.dataset.plan).needs = t.value.slice(0, 120); }, { render: false }),
  'plan-ingame': (t, P) => mut(P, (d) => { d.plans.find((x) => x.id === t.dataset.plan).falsifiers.inGame = t.value.split(';').map((s) => s.trim()).filter(Boolean).slice(0, 6); }, { render: false }),
  'card-t1': (t, P) => mut(P, (d) => { d.cards.find((x) => x.id === t.dataset.card).turn1Intent = t.value.slice(0, 160); }, { render: false }),
  'card-text': (t, P) => mut(P, (d) => { d.cards.find((x) => x.id === t.dataset.card).turn1Intent = t.value.slice(0, 400); }, { render: false }),
  'card-win': (t, P) => mut(P, (d) => { d.cards.find((x) => x.id === t.dataset.card).winCondition = t.value.slice(0, 160); }, { render: false }),
  'ifthen-resp': (t, P) => mut(P, (d) => { d.cards.find((x) => x.id === t.dataset.card).ifThen[Number(t.dataset.i)].response = t.value.slice(0, 160); }, { render: false }),
  ...logInputs,
};

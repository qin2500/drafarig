// Practice: mock briefs (nothing about your team; the Showdown setup matches the information you want to rehearse),
// a 7-tap game log, debriefs that turn games into findings with computed confidence, one-change revisions with retest and
// revert, and the pilot card for playing a friend's opponent. Records are counts, never rates.
import { composeBrief, setupFor, parseBrief, checkNumbers, BRIEF_HEADER, FIDELITY_TEXT } from '../lib/prep-brief.mjs';
import { findingConfidence, recordText, revisionGuards, formatInfo } from '../lib/prep-coverage.mjs';
import { suggestPlans } from '../lib/prep-plans.mjs';
import { parseTeam, exportTeam } from '../lib/paste.mjs';
import { currentVersion, asSet, setCurrent, addRevealed, defaultVariant } from '../lib/prep-model.mjs';
import { setStats, battleForme } from '../lib/calc/mech.mjs';
import { speedOf, statValue, natureSign } from '../lib/calc/stats.mjs';
import { GAME_TAGS, MECHANISMS } from '../lib/prep-schema.mjs';
import * as C from './prep-copy.js';
import { esc, btn, chipBtn, h2, select, term } from './prep-ui.js';
import { variantOf, theirSetFor, spForUnknown } from './prep-sets.js';

const W = (P) => P.ws.get(P.route.wsId);
const mut = (P, fn, o) => P.mutate(`ws:${P.route.wsId}`, fn, o);
const games = (m) => (m.games ?? []).filter((g) => !g.draft);
const rec = (m) => `${games(m).filter((g) => g.result === 'W').length}–${games(m).filter((g) => g.result === 'L').length}`;

// ---------- Practice tab ----------
export function tab(P, ws) {
  const recs = recordText(ws.mockSets);
  const open = ws.findings.filter((f) => !['fixed', 'rejected'].includes(f.status));
  const unretested = ws.revisions.filter((r) => !r.retest && !r.revertedBy);
  return `${h2('Practice')}
    ${ws.mockSets.length ? '' : `<p>Mocks are practice games against a friend playing ${esc(ws.coach)}'s team. Send them a brief, then log each game in under a minute. ${term('Mock')}</p>`}
    <ul class="mocks">${ws.mockSets.slice().reverse().map((m) => `<li>${btn(`${m.date} · ${m.partner || 'partner'}`, 'open-mock', { mock: m.id }, { cls: 'linkish' })} <span class="small">${esc(m.purpose || 'no purpose')} · ${rec(m)} · ${esc(C.FIDELITY[m.fidelity] ?? '')} · ${esc(C.CONDITION[m.simulatedDisclosure] ?? '')}</span></li>`).join('')}</ul>
    ${recs.length ? `<p class="small">Records: ${esc(recs.join(', '))}. ${esc(C.RECORD_NOTE)}</p>` : ''}
    <h3>Findings ${term('Finding')}</h3>
    ${open.length ? `<ul class="findings">${open.map((f) => findingRow(P, ws, f)).join('')}</ul>` : '<p class="small">No open findings. Debrief a mock to turn its games into findings.</p>'}
    <p>${btn('+ Finding', 'finding-new', {}, { cls: 'linkish' })}</p>
    ${unretested.length ? `<p class="small">${unretested.length} change${unretested.length === 1 ? '' : 's'} not retested yet.</p>` : ''}
    <p>${btn('Revision log', 'go-revisions')} ${btn('Help a friend practise (pilot card)', 'go-pilot')} ${term('What is a pilot card?', 'Pilot card')}</p>
    <div class="bottombar">${btn('Make a mock brief', 'go-brief', {}, { primary: true })}${btn('Log a game', 'go-log')}</div>`;
}
function findingRow(P, ws, f) {
  const conf = confidenceOf(ws, f);
  return `<li>${btn(f.statement || 'Finding', 'open-finding', { finding: f.id }, { cls: 'linkish' })} <span class="small">${esc(C.SEVERITY[f.severity])} · confidence ${esc(C.CONFIDENCE[conf.level])} · ${esc(C.FINDING_STATUS[f.status])}</span></li>`;
}
export function confidenceOf(ws, f) {
  const all = [...ws.mockSets.flatMap((m) => games(m).map((g) => ({ ...g, variantId: m.blind ? `blind:${m.id}` : (m.variantIds ?? []).join(','), partner: m.partner }))), ...ws.matches.flatMap((m) => games(m).map((g) => ({ ...g, variantId: 'match', partner: 'match' })))];
  const ev = all.filter((g) => (f.evidence?.gameIds ?? []).includes(g.id));
  return findingConfidence(f, ev, (f.evidence?.calcIds ?? []).length > 0 || !!f.evidence?.speedChecked);
}

// ---------- brief ----------
function brief(P, ws) {
  const ui = P.wsUi(ws.id);
  const rules = P.docs.rules.rules;
  const disc = rules.disclosure?.value;
  const lastRev = ws.revisions.filter((r) => !r.retest && !r.revertedBy).at(-1);
  // Prefill from their likely plan's structured fields only (members, Speed mode, Mega). Free text ("needs") is your
  // writing and the counter-prep plan is built from your own team, so they are never prefilled.
  const likelyPlan = ws.plans.find((p) => p.kind === 'likely') ?? ws.plans.find((p) => p.kind === 'alt');
  const howIdeas = ws.plans.filter((p) => p.kind === 'likely' || p.kind === 'alt').map((p) => (p.needs ?? '').trim()).filter(Boolean).map((s) => `Needs: ${s}`);
  // The purpose starts empty: your premortem, revisions and findings are your notes and can name your team, so they are
  // only offered as suggestions you tap (and check) before anything of yours goes into text you send.
  // (a purpose from the Battle Prep briefing joins them, on the same terms: a suggestion to tap, never filled in for you)
  const purposeIdeas = [ui.brPurposeHint, lastRev?.expectedEffect, ws.premortem, ws.findings.find((f) => f.status === 'open')?.statement].map((s) => (s ?? '').trim()).filter(Boolean);
  ui.br ??= {
    purpose: '',
    partner: '', inLeague: 'unsure', variantId: (defaultVariant(ws) ?? variantOf(P, ws))?.id ?? null, rotate: false, blind: false, fidelity: 1,
    condition: disc === 'open-at-preview' || disc === 'exchanged-in-advance' ? disc : 'closed', spChoice: 'common', retestOf: lastRev?.id ?? null,
    how: likelyPlan ? [likelyPlan.members.length ? `Usually brings ${likelyPlan.members.map((m) => P.spName(m)).join(', ')} (your guess)` : '', likelyPlan.speedMode && likelyPlan.speedMode !== 'unknown' ? `Speed: ${C.SPEED_MODE[likelyPlan.speedMode]}` : '', likelyPlan.megaUser ? `Mega: ${P.spName(likelyPlan.megaUser)}` : ''].filter(Boolean).join('\n') : '',
    dont: "Anything from earlier mocks that they couldn't know.\nDon't open my team.",
  };
  const b = ui.br;
  const v = ws.variants.find((x) => x.id === b.variantId);
  // Their 6 for this mock (teams are 6; the open-sheet format rejects more): the likely plan's members, then the rest
  const withSets = P.rosterSpecies(ws).filter((sp) => theirSetFor(ws, v, sp));
  b.six ??= [...new Set([...(likelyPlan?.members ?? []).filter((sp) => withSets.includes(sp)), ...withSets])].slice(0, 6);
  const six = b.six.filter((sp) => withSets.includes(sp));
  const sets = six.map((sp) => ({ set: asSet(theirSetFor(ws, v, sp), currentVersion(theirSetFor(ws, v, sp))) }));
  const how = b.how.split('\n');
  // a partner in the league (or maybe) isn't told whose team this is
  const teamName = b.inLeague === 'no' ? `${ws.coach}'s team (my guess)` : 'Their team (my guess)';
  const out = P.mech ? composeBrief({ mech: P.mech, teamName, purpose: b.purpose, condition: b.condition, fidelity: b.fidelity, blind: b.blind,
    howToPlay: how, dontUse: b.dont.split('\n'), sets, spChoice: (s) => spForUnknown(P, s, b.spChoice), conditionUnknown: !disc || disc === 'unknown' }) : null;
  const sixChips = withSets.map((sp) => chipBtn(P.spName(sp), 'br-six', { species: sp }, six.includes(sp))).join('');
  ui.br.text = out?.text ?? '';
  const mismatch = disc && disc !== 'unknown' && disc !== 'partial' && disc !== b.condition;
  return `${btn('‹ Practice', 'back', {}, { cls: 'back', aria: 'Back to Practice' })}${h2('Brief for your mock partner')}
    <label class="field" for="br-purpose"><span>Purpose (one)</span><input id="br-purpose" data-pi="br" data-key="purpose" value="${esc(b.purpose)}" maxlength="160" placeholder="e.g. practise against their Trick Room mode"></label>
    ${purposeIdeas.length && !b.purpose ? `<p class="small">From your notes (your partner will see it, so check it doesn't give away your team): ${[...new Set(purposeIdeas)].slice(0, 3).map((s) => btn(s.length > 60 ? `${s.slice(0, 57)}…` : s, 'br-purpose', { value: s }, { cls: 'linkish' })).join(' ')}</p>` : ''}
    <label class="field" for="br-partner"><span>Partner (a label only)</span><input id="br-partner" data-pi="br" data-key="partner" value="${esc(b.partner)}" maxlength="40"></label>
    <p class="small">Is your partner in your league?</p><div class="choices" role="group" aria-label="Partner in league">${Object.entries(C.PARTNER_IN_LEAGUE).map(([k, l]) => chipBtn(l, 'br-set', { key: 'inLeague', value: k }, b.inLeague === k)).join('')}</div>
    <p class="small">Your team, plan cards and notes are never included. If they are in the league (or you're not sure), this mock counts as them seeing your sets.</p>
    <p class="small">Their team</p><div class="choices" role="group" aria-label="Their team version">${ws.variants.map((x) => chipBtn(C.VARIANT_ROLE[x.role] + (x.name ? `: ${x.name}` : ''), 'br-set', { key: 'variantId', value: x.id }, b.variantId === x.id && !b.blind)).join('')}${ws.variants.length > 1 ? chipBtn('Blind: partner picks', 'br-set', { key: 'blind', value: !b.blind }, b.blind) : ''}</div>
    ${!ws.variants.length ? `<p class="small">No sets for their team yet. ${btn('Go to Sets', 'go-sets-tab')}</p>` : ''}
    ${withSets.length ? `<p class="small">Their 6 for this mock (${six.length} chosen)${six.length !== 6 ? ` · ⚠ Showdown needs exactly 6: ${six.length < 6 ? `${withSets.length < 6 ? 'add sets for more of their Pokémon in Sets, or ' : ''}choose ${6 - six.length} more` : `remove ${six.length - 6}`} (the brief tells your partner too)` : ''}</p><div class="choices" role="group" aria-label="Their 6 for this mock">${sixChips}</div>` : ''}
    <p class="small">How closely ${term('How closely (mock)')}</p><div class="choices" role="group" aria-label="How closely">${Object.entries(C.FIDELITY).map(([k, l]) => chipBtn(l, 'br-set', { key: 'fidelity', value: k }, String(b.fidelity) === k)).join('')}</div>
    <p class="small">Information to rehearse</p><div class="choices" role="group" aria-label="Information condition">${Object.entries(C.CONDITION).map(([k, l]) => chipBtn(l, 'br-set', { key: 'condition', value: k }, b.condition === k)).join('')}</div>
    ${mismatch ? `<p class="small">⚠ Your rules say team sheets are "${esc(C.RULES.disclosure.options[disc])}": this rehearses something else.</p>` : ''}
    <p class="small">Showdown setup: ${esc(setupFor(b.condition).name)}. Closest setup for this mock, not your league's rules.</p>
    ${sets.some((s) => s.set.sp === 'unknown') ? `<p class="small">Unknown Stat Points: ${chipBtn('Ladder spread', 'br-set', { key: 'spChoice', value: 'common' }, b.spChoice === 'common')}${chipBtn('Max attack + Speed (stress)', 'br-set', { key: 'spChoice', value: 'max' }, b.spChoice === 'max')}</p>` : ''}
    <label class="field" for="br-how"><span>How to play it (one per line; edit freely)</span><textarea id="br-how" rows="3" data-pi="br" data-key="how">${esc(b.how)}</textarea></label>
    ${howIdeas.filter((s) => !b.how.includes(s)).length ? `<p class="small">From your plans (your partner will see it, so check it doesn't give away your team): ${[...new Set(howIdeas)].filter((s) => !b.how.includes(s)).slice(0, 3).map((s) => btn(s.length > 60 ? `${s.slice(0, 57)}…` : s, 'br-how-add', { value: s }, { cls: 'linkish' })).join(' ')}</p>` : ''}
    <label class="field" for="br-dont"><span>Don't use</span><textarea id="br-dont" rows="2" data-pi="br" data-key="dont">${esc(b.dont)}</textarea></label>
    <details><summary>What this mock can't copy</summary><p class="small">Showdown's Champions formats enforce item clause and Level 50 whatever your league does. Showdown best-of-3 keeps the same team for all games. If your league plays in-game, timers and screens differ. Your partner plays their team, not them.</p></details>
    <h3>Preview (exactly what your partner receives)</h3><pre class="paste-out" tabindex="0">${esc(ui.br.text)}</pre>
    ${(out?.warnings ?? []).some((w) => w.code === 'spread-chosen') ? '<p class="small">Sets with unknown Stat Points use the spread chosen above; the check numbers tell your partner what to expect.</p>' : ''}
    <p>${btn('Copy brief', 'br-copy', {}, { primary: true })} ${P.app.share ? btn('Share…', 'br-share') : ''} ${btn('Save as .txt', 'br-save')}</p>
    <p>${btn(b.mockId ? 'Log the first game' : 'Start this mock set (save it)', 'br-start')} ${b.mockId ? '<span class="small muted">Recorded when you sent the brief.</span>' : '<span class="small muted">Copying, sharing or saving the brief also records it.</span>'}</p>`;
}

// ---------- log (shared by mocks and the real match) ----------
/** target: {kind:'mock'|'match', id, index?}. Minimum path: result, their lead (2), your lead (2), why, Save = 7 taps. */
export function logForm(P, ws, target) {
  const holder = target.kind === 'match' ? ws.matches.find((m) => m.id === target.id) : ws.mockSets.find((m) => m.id === target.id);
  if (!holder) return '';
  const idx = target.index ?? games(holder).length;
  const g = holder.games.find((x) => x.index === idx) ?? { index: idx, draft: true };
  const theirs = target.kind === 'match' && holder.their6?.length ? holder.their6 : P.rosterSpecies(ws);
  const chosen = (target.kind === 'match' ? holder.my6 : (holder.mySets?.length ? holder.mySets : ws.my6)).map((x) => P.lineage(x.setId)).filter(Boolean);
  // no 6 chosen yet: offer your sets for the Pokémon on your roster (one per Pokémon), so the log can still be finished
  const roster = new Set(P.coachRoster(P.myCoach()));
  const mine = chosen.length ? chosen : [...new Map(P.mineSets().filter((s) => !roster.size || roster.has(s.speciesId)).map((s) => [s.speciesId, s])).values()];
  const prev = holder.games.find((x) => x.index === idx - 1);
  const d = { kind: target.kind, holder: holder.id, index: idx };
  // Played from a brief: ask once per mock set, in view, whether the partner's teambuilder showed the brief's numbers.
  const answered = holder.games.find((x) => x.pasteCheckOk === true || x.pasteCheckOk === false);
  const pasteCheck = target.kind === 'mock' && holder.briefText && (!answered || answered.index === idx) ? `<div class="choices" role="group" aria-label="Paste check"><span class="small">Did your partner's teambuilder show the brief's check numbers?</span> ${chipBtn('Yes', 'log-set', { ...d, key: 'pasteCheckOk', value: 'yes' }, g.pasteCheckOk === true)}${chipBtn('No', 'log-set', { ...d, key: 'pasteCheckOk', value: 'no' }, g.pasteCheckOk === false)}</div>` : '';
  const lead = (key, list, label) => `<div class="choices" role="group" aria-label="${esc(label)}"><span class="small">${esc(label)}</span> ${list.map((x) => chipBtn(x.label, 'log-pick', { ...d, key, value: x.id }, (g[key] ?? []).includes(x.id))).join('')}${prev?.[key]?.length ? btn('Same as last game', 'log-same', { ...d, key }, { cls: 'linkish' }) : ''}</div>`;
  return `<div class="log" data-key="log-${esc(holder.id)}-${idx}"><p class="small">Game ${idx + 1}${g.draft && g.loggedAt ? ' · draft saved' : ''}</p>
    <div class="choices" role="group" aria-label="Result">${chipBtn('Won', 'log-set', { ...d, key: 'result', value: 'W' }, g.result === 'W')}${chipBtn('Lost', 'log-set', { ...d, key: 'result', value: 'L' }, g.result === 'L')}</div>
    ${lead('theirLead', theirs.map((sp) => ({ id: sp, label: P.spName(sp) })), 'They led')}
    ${lead('myLead', mine.map((l) => ({ id: l.id, label: P.spName(l.speciesId) })), 'You led')}${!chosen.length && mine.length ? '<p class="small muted">Choose your 6 (Sets) to shorten this list.</p>' : ''}
    <div class="choices" role="group" aria-label="Why it went that way"><span class="small">Why it went that way</span> ${GAME_TAGS.map((tg) => chipBtn(C.TAG[tg], 'log-set', { ...d, key: 'tag', value: tg }, g.tag === tg)).join('')}</div>
    ${pasteCheck}
    <details><summary>Optional detail</summary>
      <p class="small">Deciding turn ${btn('−', 'log-turn', { ...d, delta: -1 }, { aria: 'Deciding turn minus one', cls: 'spstep' })} <b>${esc(g.decidingTurn ?? '–')}</b> ${btn('+', 'log-turn', { ...d, delta: 1 }, { aria: 'Deciding turn plus one', cls: 'spstep' })}</p>
      <div class="choices" role="group" aria-label="What decided it">${MECHANISMS.map((m) => chipBtn(C.MECHANISM[m], 'log-set', { ...d, key: 'mechanism', value: m }, g.mechanism === m)).join('')}</div>
      ${lead('their4', theirs.map((sp) => ({ id: sp, label: P.spName(sp) })), 'Their 4')}
      ${lead('my4', mine.map((l) => ({ id: l.id, label: P.spName(l.speciesId) })), 'Your 4')}
      ${mine.some((l) => P.mech?.items[currentVersion(l).data.item]?.megaStone) ? `<div class="choices" role="group" aria-label="Your Mega"><span class="small">Your Mega</span> ${chipBtn('none', 'log-set', { ...d, key: 'myMega', value: '' }, !g.myMega)}${mine.filter((l) => P.mech?.items[currentVersion(l).data.item]?.megaStone).map((l) => chipBtn(P.spName(l.speciesId), 'log-set', { ...d, key: 'myMega', value: l.id }, g.myMega === l.id)).join('')}</div>` : ''}
      <div class="choices" role="group" aria-label="Their Mega"><span class="small">Their Mega</span> ${chipBtn('none', 'log-set', { ...d, key: 'theirMega', value: '' }, !g.theirMega)}${theirs.filter((sp) => P.mech && Object.values(P.mech.items).some((i) => i.megaStone?.[sp])).map((sp) => chipBtn(P.spName(sp), 'log-set', { ...d, key: 'theirMega', value: sp }, g.theirMega === sp)).join('')}</div>
      ${target.kind === 'mock' ? `<div class="choices" role="group" aria-label="Partner played it"><span class="small">Partner played it</span> ${[1, 2, 3].map((n) => chipBtn({ 1: '1 own style', 2: '2', 3: '3 the brief' }[n], 'log-set', { ...d, key: 'partnerFidelity', value: n }, g.partnerFidelity === n)).join('')}</div>
      ${holder.blind ? `<div class="choices" role="group" aria-label="Your preview guess"><span class="small">Your preview guess</span> ${ws.variants.map((v) => chipBtn(C.VARIANT_ROLE[v.role], 'log-set', { ...d, key: 'previewGuess', value: v.id }, g.previewGuess === v.id)).join('')}</div>` : ''}` : ''}
      ${select(`log-plan-${idx}`, [['', 'Which of their plans was it?'], ...ws.plans.map((p) => [p.id, p.label || C.PLAN_KIND[p.kind]])], g.planId ?? '', { data: { pc: 'log-plan', ...Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v])) } })}
      <label class="field" for="log-line-${idx}"><span>One line</span><input id="log-line-${idx}" data-pi="log-text" data-kind="${d.kind}" data-holder="${esc(d.holder)}" data-index="${idx}" data-key="line" value="${esc(g.line ?? '')}" maxlength="200"></label>
      <label class="field" for="log-replay-${idx}"><span>Replay link (private links let anyone with the link watch)</span><input id="log-replay-${idx}" data-pi="log-text" data-kind="${d.kind}" data-holder="${esc(d.holder)}" data-index="${idx}" data-key="replay" value="${esc(g.replay ?? '')}" maxlength="200"></label>
    </details>
    ${btn('Save', 'log-save', d, { primary: true })}</div>`;
}
function logScreen(P, ws) {
  const ui = P.wsUi(ws.id);
  let m = ws.mockSets.find((x) => x.id === ui.logMock) ?? ws.mockSets.at(-1);
  if (!m) return `${btn('‹ Practice', 'back', {}, { cls: 'back', aria: 'Back to Practice' })}${h2('Log a game')}<p>Start a mock set first (from a brief), or log straight away.</p>${btn('Log without a brief', 'mock-quick', {}, { primary: true })}`;
  return `${btn('‹ Practice', 'back', {}, { cls: 'back', aria: 'Back to Practice' })}${h2(`Log a game · ${m.partner || 'mock'} ${m.date}`)}
    ${ws.mockSets.length > 1 ? select('log-mock', ws.mockSets.map((x) => [x.id, `${x.date} · ${x.partner || 'mock'}`]), m.id, { label: 'Mock set', data: { pc: 'log-mock' } }) : ''}
    ${logForm(P, ws, { kind: 'mock', id: m.id })}
    <p class="small">Records: ${esc(rec(m))}. ${esc(C.RECORD_NOTE)}</p>`;
}

// ---------- mock set / match: games and debrief ----------
function mockDetail(P, ws, r) {
  const m = ws.mockSets.find((x) => x.id === r.id) ?? ws.matches.find((x) => x.id === r.id);
  if (!m) return `${h2('Not found')}<p>${esc(C.NOT_ON_DEVICE)}</p>`;
  const isMatch = ws.matches.includes(m);
  const gs = games(m);
  const f19 = !isMatch && (() => { const f = formatInfo(m.formatString); return f && f.ots !== null && (f.ots ? m.simulatedDisclosure === 'closed' : m.simulatedDisclosure !== 'closed'); })();
  const lowFid = !isMatch && gs.length && gs.filter((g) => g.partnerFidelity === 1 || g.tag === 'partner-off-script').length * 2 >= gs.length;
  const db = m.debrief ?? {};
  const linked = ws.findings.filter((f) => (f.evidence?.gameIds ?? []).some((id) => gs.some((g) => g.id === id)) || f.sourceId === m.id);
  // the debrief asks about one game at a time: the one you pick, else one you already wrote about
  const picked = P.wsUi(ws.id).dbGame?.[m.id];
  const dbGame = gs.find((g) => g.id === picked) ?? gs.find((g) => Object.values(db.turns?.[g.id] ?? {}).some(Boolean)) ?? null;
  return `${btn('‹ Practice', 'back', {}, { cls: 'back', aria: 'Back to Practice' })}${h2(isMatch ? `Debrief · match ${m.date} (${rec(m)})` : `Debrief · mock ${m.date} (${rec(m)})`)}
    ${!isMatch ? `<p class="small">Purpose: ${esc(m.purpose || 'none')} · ${esc(C.FIDELITY[m.fidelity] ?? '')} · ${esc(C.CONDITION[m.simulatedDisclosure] ?? '')} · ${esc(m.formatString ?? '')}${m.blind ? ' · blind' : ''}</p>` : ''}
    ${f19 ? `<p class="banner warn">⚠ ${esc(C.FLAG.F19())}</p>` : ''}
    ${!isMatch && m.briefText && gs.length && !gs.some((g) => g.pasteCheckOk === true) ? `<p class="small">⚠ ${esc(C.FLAG.F20())}</p>` : ''}
    <ol class="small">${gs.map((g) => `<li>${g.result === 'W' ? 'Won' : g.result === 'L' ? 'Lost' : '—'} · they led ${(g.theirLead ?? []).map((s) => esc(P.spName(s))).join(' + ') || '?'} · you led ${(g.myLead ?? []).map((s) => esc(P.spName(P.lineage(s)?.speciesId))).join(' + ') || '?'} · ${esc(C.TAG[g.tag] ?? '')}${g.line ? ` · ${esc(g.line)}` : ''}</li>`).join('')}</ol>
    ${!isMatch ? `<details class="more"${gs.length ? '' : ' open'}><summary>${gs.length ? 'Log another game' : 'Log a game'}</summary>${logForm(P, ws, { kind: 'mock', id: m.id })}</details>` : ''}
    <h3>Debrief</h3>
    <p class="small">1 · ${esc(C.DEBRIEF_Q.purpose)}</p><div class="choices" role="group" aria-label="${esc(C.DEBRIEF_Q.purpose)}">${['yes', 'partly', 'no'].map((k) => chipBtn({ yes: 'Yes', partly: 'Partly', no: 'No' }[k], 'db-set', { mock: m.id, key: 'purposeMet', value: k }, db.purposeMet === k)).join('')}</div>
    ${gs.length ? `<p class="small">2 · Which game turned on something you can change?</p><div class="choices" role="group" aria-label="Deciding game">${gs.map((g) => chipBtn(`Game ${Number(g.index) + 1}${g.result ? ` ${g.result === 'W' ? 'won' : 'lost'}` : ''}`, 'db-pick', { mock: m.id, game: g.id }, dbGame?.id === g.id)).join('')}</div>` : ''}
    ${dbGame ? `<div class="deciding"><p class="small">${esc(C.DEBRIEF_Q.deciding)}${dbGame.decidingTurn ? ` (turn ${esc(dbGame.decidingTurn)})` : ''}</p>${['expected', 'happened', 'why'].map((k) => `<label class="field" for="db-${k}-turn"><span>${{ expected: 'Expected', happened: 'Happened', why: 'Why' }[k]}</span><input id="db-${k}-turn" data-pi="db-turn" data-mock="${esc(m.id)}" data-game="${esc(dbGame.id)}" data-key="${k}" value="${esc(db.turns?.[dbGame.id]?.[k] ?? '')}" maxlength="160"></label>`).join('')}</div>` : ''}
    ${!isMatch ? `<details class="more"><summary>3 · ${esc(C.DEBRIEF_Q.partner)}</summary>${['scared', 'change'].map((k) => `<label class="field" for="db-${k}"><span>${esc(C.DEBRIEF_Q[k])}</span><input id="db-${k}" data-pi="db-field" data-mock="${esc(m.id)}" data-key="${k}" value="${esc(db[k] ?? '')}" maxlength="160"></label>`).join('')}</details>` : ''}
    <p class="small">4 · Findings (one to three is plenty)</p>
    <ul class="findings">${linked.map((f) => findingRow(P, ws, f)).join('')}</ul>
    ${!linked.length && gs.length ? `<p class="small">⚠ ${esc(C.DEBRIEF_Q.f13)}</p>` : ''}
    ${lowFid ? `<p class="small">⚠ ${esc(C.FLAG.F9())}</p>` : ''}
    <p>${btn('+ Finding from these games', 'finding-new', { mock: m.id }, { primary: true })}</p>
    <p class="small">${esc(C.BETWEEN_GAMES_Q.join(' '))}</p>`;
}

// ---------- finding ----------
function findingDetail(P, ws, r) {
  const f = ws.findings.find((x) => x.id === r.id);
  if (!f) return `${h2('Not found')}<p>${esc(C.NOT_ON_DEVICE)}</p>`;
  const conf = confidenceOf(ws, f);
  const label = (kind, m, g) => `${kind} ${m.date}${m.partner ? ` ${m.partner}` : ''} G${g.index + 1}${g.result ? ` ${g.result === 'W' ? 'won' : 'lost'}` : ''}${g.tag ? ` · ${C.TAG[g.tag] ?? ''}` : ''}`;
  const source = [...ws.mockSets, ...ws.matches].find((m) => m.id === f.sourceId);
  const allGames = [...ws.mockSets.flatMap((m) => games(m).map((g) => ({ g, m, label: label('Mock', m, g) }))), ...ws.matches.flatMap((m) => games(m).map((g) => ({ g, m, label: label('Match', m, g) })))]
    .sort((a, b) => Number(b.m === source) - Number(a.m === source));
  return `${btn('‹ Back', 'back', {}, { cls: 'back', aria: 'Back' })}${h2('Finding')}
    <label class="field" for="fd-statement"><span>Statement</span><input id="fd-statement" data-pi="fd" data-finding="${esc(f.id)}" data-key="statement" value="${esc(f.statement ?? '')}" maxlength="160"></label>
    <label class="field" for="fd-mechanism"><span>Mechanism (why it happens)</span><input id="fd-mechanism" data-pi="fd" data-finding="${esc(f.id)}" data-key="mechanism" value="${esc(f.mechanism ?? '')}" maxlength="200"></label>
    <div class="choices" role="group" aria-label="Kind">${GAME_TAGS.filter((t) => t !== 'unclear').map((k) => chipBtn(C.TAG[k], 'fd-set', { finding: f.id, key: 'kind', value: k }, f.kind === k)).join('')}</div>
    <div class="choices" role="group" aria-label="Severity">${Object.entries(C.SEVERITY).map(([k, l]) => chipBtn(l, 'fd-set', { finding: f.id, key: 'severity', value: k }, f.severity === k)).join('')}</div><p class="small">${esc(C.SEVERITY_HELP)}</p>
    <p>Confidence: <b>${esc(C.CONFIDENCE[conf.level])}</b> <span class="small">(${esc(C.CONFIDENCE_RULE[conf.rule] ?? '')})</span></p>
    <p class="small">Which games showed this? ${allGames.length ? '' : 'No logged games yet.'}</p><div class="choices" role="group" aria-label="Which games showed this">${allGames.map(({ g, label: l }) => chipBtn(l, 'fd-game', { finding: f.id, game: g.id }, (f.evidence?.gameIds ?? []).includes(g.id))).join('')}</div>
    <details><summary>Calcs or a Speed check that confirm it</summary>
      <div class="choices" role="group" aria-label="Calcs">${ws.calcs.map((c) => chipBtn(c.title || 'calc', 'fd-calc', { finding: f.id, calc: c.id }, (f.evidence?.calcIds ?? []).includes(c.id))).join('')}${chipBtn('A Speed check confirms it', 'fd-speed', { finding: f.id }, !!f.evidence?.speedChecked)}</div></details>
    <label class="field" for="fd-opposite"><span>${esc(C.DEBRIEF_Q.opposite)}</span><input id="fd-opposite" data-pi="fd" data-finding="${esc(f.id)}" data-key="considerOpposite" value="${esc(f.considerOpposite ?? '')}" maxlength="200"></label>
    <div class="choices" role="group" aria-label="Status">${Object.entries(C.FINDING_STATUS).map(([k, l]) => chipBtn(l, 'fd-set', { finding: f.id, key: 'status', value: k }, f.status === k)).join('')}</div>
    <p class="small">Next action</p><p>${btn('Run a calc', 'calc-new')} ${btn('Try a version of their team', 'go-sets-tab')} ${btn('Edit a plan card', 'fd-cards')} ${btn('Propose a change', 'rv-new', { finding: f.id }, { primary: true })}</p>
    <p>${btn('Delete finding', 'fd-delete', { finding: f.id })}</p>`;
}

// ---------- revisions ----------
function revisions(P, ws) {
  const ui = P.wsUi(ws.id);
  const draft = ui.rv;
  const mine = ws.my6.map((m) => P.lineage(m.setId)).filter(Boolean);
  const all = P.mineSets(); // your own library only: viewing as another coach offers none of it
  let form = '';
  if (draft) {
    const f = ws.findings.filter((x) => draft.findings.includes(x.id));
    const structural = draft.changes.filter((c) => c.structural).length;
    const guards = revisionGuards({ structural: structural > 0, reasonFindingIds: draft.findings }, { findings: ws.findings, matchDate: parseDate(ws.matchDate), now: P.now(), structuralInDraft: structural, confidenceOf: (x) => confidenceOf(ws, x).level });
    form = `<div class="rvform"><h3>New revision</h3><p class="small">One structural change plus one set tweak keeps cause and effect readable. ${f.length ? `For: ${f.map((x) => esc(x.statement)).join('; ')}` : ''}</p>
      <ul class="small">${draft.changes.map((c, i) => `<li>${esc(c.what)} ${btn('Remove', 'rv-remove', { i }, { cls: 'linkish' })}</li>`).join('')}</ul>
      <p class="small">Set change: pick the set and the version to use (edit the set first to create the new version).</p>
      ${select('rv-set', [['', 'Your set…'], ...all.map((l) => [l.id, `${P.spName(l.speciesId)} · ${l.name || 'Set'} (now v${l.currentV})`])], draft.setId ?? '', { data: { pc: 'rv-set' } })}
      ${draft.setId ? `${select('rv-ver', P.lineage(draft.setId).versions.map((v) => [String(v.v), `v${v.v} · ${v.reason ?? ''}`]), String(draft.toV ?? P.lineage(draft.setId).currentV), { data: { pc: 'rv-ver' }, label: 'Use version' })} ${btn('Add set change', 'rv-add-set')}` : ''}
      <p class="small">Your 6: swap one (structural)</p>${select('rv-out', [['', 'Take out…'], ...mine.map((l) => [l.id, P.spName(l.speciesId)])], draft.out ?? '', { data: { pc: 'rv-out' } })} ${select('rv-in', [['', 'Put in…'], ...all.filter((l) => !ws.my6.some((m) => m.setId === l.id)).map((l) => [l.id, `${P.spName(l.speciesId)} · ${l.name || 'Set'}`])], draft.in ?? '', { data: { pc: 'rv-in' } })} ${btn('Add swap', 'rv-add-swap')}
      <label class="field" for="rv-other"><span>Other change (plan card, Mega, plan) in words</span><input id="rv-other" data-pi="rv" data-key="other" value="${esc(draft.other ?? '')}" maxlength="160"></label>${btn('Add', 'rv-add-other')}
      <label class="field" for="rv-expected"><span>Expected effect (becomes the retest's purpose)</span><input id="rv-expected" data-pi="rv" data-key="expectedEffect" value="${esc(draft.expectedEffect ?? '')}" maxlength="160"></label>
      ${guards.map((g) => `<p class="small">⚠ ${esc(C.GUARD[g])}</p>`).join('')}
      <p>${btn('Save revision', 'rv-save', {}, { primary: true, disabled: !draft.changes.length })} ${btn('Cancel', 'rv-cancel')}</p></div>`;
  }
  const rows = ws.revisions.slice().reverse().map((r) => {
    const why = r.reasonFindingIds === 'hunch' || !(r.reasonFindingIds ?? []).length ? 'Hunch (no finding)' : ws.findings.filter((f) => r.reasonFindingIds.includes(f.id)).map((f) => `Finding: "${f.statement}"`).join('; ');
    const retest = r.retest ? `Retest: ${ws.mockSets.find((m) => m.id === r.retest.mockSetId)?.date ?? 'mock'} · ${r.retest.outcome}` : 'Retest: none yet';
    return `<li><b>${esc(r.date)}</b> ${esc(r.changes.map((c) => c.what).join('; '))}<div class="small">${esc(why)} · Expected: ${esc(r.expectedEffect || '—')} · ${esc(retest)}${r.revertedBy ? ' · reverted' : ''}</div>
      ${!r.retest ? `<div class="choices" role="group" aria-label="Retest outcome">${ws.mockSets.filter((m) => m.retestOf === r.id || m.date >= r.date).slice(-1).map((m) => ['confirmed', 'failed', 'mixed'].map((o) => chipBtn(`${o} (mock ${m.date})`, 'rv-retest', { rv: r.id, mock: m.id, outcome: o }, false)).join('')).join('')}</div>` : ''}
      ${!r.revertedBy ? btn('Revert', 'rv-revert', { rv: r.id }) : ''}</li>`;
  }).join('');
  return `${btn('‹ Practice', 'back', {}, { cls: 'back', aria: 'Back to Practice' })}${h2(`Revisions vs ${ws.coach}`)}
    ${form || btn('+ Revision (hunch)', 'rv-new', {}, { primary: !ws.revisions.length })}
    <ul class="revs">${rows || '<li class="small">No revisions yet.</li>'}</ul>
    <p>${btn('Copy as text', 'rv-copy')}</p>`;
}
// A match date (YYYY-MM-DD) means the whole day: its end, local time, so "right before the match" includes match day.
const parseDate = (s) => { const t = Date.parse(/^\d{4}-\d\d-\d\d$/.test(s ?? '') ? `${s}T23:59:59` : s); return Number.isNaN(t) ? null : new Date(t).toISOString(); };

// ---------- pilot card ----------
export function pilot(P) {
  const ui = (P.ui.pilot ??= { text: '', answers: {} });
  const saved = P.docs.pilot.teams;
  let card = '';
  if (ui.parsed && P.mech) {
    const b = ui.parsed.brief;
    const res = ui.parsed.team;
    const sets = res.sets.filter((s) => s.set).map((s) => s.set);
    const ids = sets.map((s) => s.species);
    const plans = suggestPlans(P.app.coresCx(), P.app.dex, ids.filter((id) => P.app.dex.species[id]));
    const rows = sets.map((s) => {
      const st = setStats(P.mech, s, { megaEvolved: false });
      const f = battleForme(P.mech, s.species, s.item);
      const megaSpe = f.mega ? speedOf(statValue('spe', P.mech.species[f.id].baseStats.spe, s.sp.spe ?? 0, natureSign(P.mech.natures[s.nature], 'spe'))).speed : null;
      const roles = P.dexSp(s.species)?.roles?.filter((r) => !['setup', 'status', 'disruption'].includes(r)).slice(0, 3) ?? [];
      return { s, st, megaSpe, roles };
    });
    const order = [...rows].sort((a, b) => (b.st?.spe ?? 0) - (a.st?.spe ?? 0));
    card = `<div class="pilotcard"><h3>Pilot card${b?.team ? `: ${esc(b.team)}` : ''}</h3>
      ${b?.purpose ? `<p>Purpose: ${esc(b.purpose)}</p>` : ''}${b?.setup ? `<p class="small">Setup: ${esc(b.setup)}</p>` : ''}${b?.fidelity ? `<p class="small">How closely: ${esc(b.fidelity)}</p>` : ''}
      ${b?.howToPlay?.length ? `<p><b>How to play it</b></p><ul>${b.howToPlay.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}
      ${b?.dontUse?.length ? `<p><b>Don't use</b></p><ul class="small">${b.dontUse.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}
      <ul class="pilotrows">${rows.map((x) => `<li><b>${esc(P.spName(x.s.species))}</b> ${x.s.item ? `@ ${esc(P.name('items', x.s.item))}` : ''} · ${esc(P.name('abilities', x.s.ability))} · ${esc(x.s.moves.map((m) => P.name('moves', m)).join(', '))} <span class="small">Speed ${x.st?.spe ?? '?'}${x.megaSpe ? ` (Mega ${x.megaSpe})` : ''}${x.s.item === 'choicescarf' ? ` (Scarf ${speedOf(x.st.spe, { scarf: true }).speed})` : ''}${x.roles.length ? ` · ${esc(x.roles.join(', '))}` : ''}</span></li>`).join('')}</ul>
      <p class="small">Plans this team has (from the public Cores rules): ${plans.length ? esc(plans.slice(0, 4).map((p) => p.label).join('; ')) : 'none detected'}</p>
      <p class="small">Speed order: ${esc(order.map((x) => P.spName(x.s.species)).join(' > '))}; under Trick Room the reverse.</p>
      ${res.sets.some((s) => !s.set) ? `<p class="small">⚠ ${res.sets.filter((s) => !s.set).length} set(s) need attention: check the paste in your teambuilder.</p>` : ''}
      <ul class="small">${C.ETIQUETTE.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>
      <p>${btn('Copy the team for Showdown', 'pilot-copy', {}, { primary: true })} ${btn('Save for later', 'pilot-save')}</p></div>`;
  }
  return `<section class="panel prep-pilot">${btn('‹ Prep', 'go-home', {}, { cls: 'back', aria: 'Back to Prep home' })}${h2('Help a friend practise')}
    <p class="small">You play someone else's opponent for them. Paste the team or their Drafarig brief. This card isn't linked to your league prep.</p>
    <label class="field" for="pilot-text"><span>Team or brief</span><textarea id="pilot-text" class="paste" rows="8" data-pi="pilot-text" spellcheck="false">${esc(ui.text)}</textarea></label>
    <p>${btn('Make the pilot card', 'pilot-parse', {}, { primary: true })}</p>${card}
    ${saved.length ? `<h3>Saved pilot teams</h3><ul>${saved.map((t) => `<li>${btn(t.name || 'Team', 'pilot-open', { pilot: t.id }, { cls: 'linkish' })} <span class="small">${esc(t.savedAt.slice(0, 10))}</span> ${btn('Delete', 'pilot-delete', { pilot: t.id }, { cls: 'linkish' })}</li>`).join('')}</ul>` : ''}</section>`;
}

export const views = { brief: (P, ws) => brief(P, ws), log: (P, ws) => logScreen(P, ws), mock: mockDetail, finding: findingDetail, revisions: (P, ws) => revisions(P, ws) };

/** The mock set this brief describes: created on first send (copy/share/save/start), then kept in step with the brief. */
function recordMock(P, ws) {
  const b = P.wsUi(ws.id).br;
  const setup = setupFor(b.condition);
  const fields = { partner: b.partner, partnerInLeague: b.inLeague, purpose: b.purpose, fidelity: b.fidelity, simulatedDisclosure: b.condition, formatString: setup.formatString,
    variantIds: b.blind ? ws.variants.map((v) => v.id) : [b.variantId].filter(Boolean), blind: b.blind, briefText: b.text, retestOf: b.retestOf };
  if (b.mockId && ws.mockSets.some((m) => m.id === b.mockId)) {
    mut(P, (d) => { Object.assign(d.mockSets.find((m) => m.id === b.mockId), fields); }, { render: false });
    return b.mockId;
  }
  const id = P.id('mock');
  mut(P, (d) => { d.mockSets.push({ id, date: P.now().slice(0, 10), ...fields, teamLocked: true, mySets: d.my6.map((m) => ({ setId: m.setId, v: P.lineage(m.setId)?.currentV ?? null })), games: [], debrief: null }); });
  if (b.inLeague !== 'no') for (const m of ws.my6) P.mutate('mysets', (d) => { const i = d.sets.findIndex((s) => s.id === m.setId); if (i >= 0) d.sets[i] = addRevealed(d.sets[i], { who: `partner:${b.partner || 'mock partner'}`, what: ['moves', 'item', 'ability', 'spread'], when: P.now().slice(0, 10), where: 'mock' }); }, { render: false });
  b.mockId = id;
  P.wsUi(ws.id).logMock = id;
  return id;
}

// ---------- actions ----------
function holderOf(d, t) { return t.dataset.kind === 'match' ? d.matches.find((m) => m.id === t.dataset.holder) : d.mockSets.find((m) => m.id === t.dataset.holder); }
function gameIn(P, h, idx) {
  let g = h.games.find((x) => x.index === idx);
  if (!g) { g = { id: P.id('game'), index: idx, result: null, theirLead: [], myLead: [], their4: [], my4: [], theirMega: null, myMega: null, tag: null, decidingTurn: null, mechanism: null, partnerFidelity: null, previewGuess: null, pasteCheckOk: null, line: '', replay: '', loggedAt: null, draft: true }; h.games.push(g); }
  return g;
}
export const logActions = {
  'log-set': (t, P) => mut(P, (d) => { const g = gameIn(P, holderOf(d, t), Number(t.dataset.index)); let v = t.dataset.value; if (t.dataset.key === 'partnerFidelity') v = Number(v); if (t.dataset.key === 'pasteCheckOk') v = v === 'yes'; g[t.dataset.key] = g[t.dataset.key] === v && t.dataset.key !== 'result' ? null : v; g.loggedAt = P.now(); }, { substantive: false }),
  'log-pick': (t, P) => mut(P, (d) => { const g = gameIn(P, holderOf(d, t), Number(t.dataset.index)); const k = t.dataset.key; const a = g[k] ?? []; const max = k === 'their4' || k === 'my4' ? 4 : 2; g[k] = a.includes(t.dataset.value) ? a.filter((x) => x !== t.dataset.value) : [...a, t.dataset.value].slice(-max); g.loggedAt = P.now(); }, { substantive: false }),
  'log-same': (t, P) => mut(P, (d) => { const h = holderOf(d, t); const idx = Number(t.dataset.index); const prev = h.games.find((x) => x.index === idx - 1); const g = gameIn(P, h, idx); g[t.dataset.key] = [...(prev?.[t.dataset.key] ?? [])]; }, { substantive: false }),
  'log-turn': (t, P) => mut(P, (d) => { const g = gameIn(P, holderOf(d, t), Number(t.dataset.index)); g.decidingTurn = Math.max(1, Math.min(30, (g.decidingTurn ?? 0) + Number(t.dataset.delta))); }, { substantive: false }),
  'log-save': (t, P) => {
    const ws = W(P);
    // Game day moves on to the next game (and its "if I won / lost game 1" card) in the same render as the save.
    if (t.dataset.kind === 'match') P.wsUi(ws.id).game = Math.min(2, Number(t.dataset.index) + 1);
    mut(P, (d) => {
      const h = holderOf(d, t);
      const g = gameIn(P, h, Number(t.dataset.index));
      g.draft = false; g.loggedAt = P.now();
      // your leads and 4 count as revealed to the opponent (match) or to a league partner (mock)
      if (t.dataset.kind === 'match') {
        for (const id of new Set([...(g.myLead ?? []), ...(g.my4 ?? []), ...(g.myMega ? [g.myMega] : [])])) {
          const i = P.docs.mysets.sets.findIndex((s) => s.id === id);
          if (i >= 0) P.mutate('mysets', (m) => { m.sets[i] = addRevealed(m.sets[i], { who: d.coach, what: id === g.myMega ? ['species', 'mega'] : ['species'], when: P.now().slice(0, 10), where: `match ${h.date}` }); }, { render: false });
        }
      }
    });
    P.toast(`Game ${Number(t.dataset.index) + 1} saved`);
  },
};
export const logChanges = {
  'log-plan': (t, P) => mut(P, (d) => { const g = gameIn(P, holderOf(d, t), Number(t.dataset.index)); g.planId = t.value || null; }, { substantive: false }),
};
export const logInputs = {
  'log-text': (t, P) => mut(P, (d) => { const g = gameIn(P, holderOf(d, t), Number(t.dataset.index)); g[t.dataset.key] = t.value.slice(0, 200); }, { substantive: false, render: false }),
};
export const actions = {
  'go-log': (t, P) => P.go({ view: 'ws', wsId: P.route.wsId, kind: 'log' }, { push: true }),
  'go-revisions': (t, P) => P.go({ view: 'ws', wsId: P.route.wsId, kind: 'revisions' }, { push: true }),
  'open-mock': (t, P) => P.go({ view: 'ws', wsId: P.route.wsId, kind: 'mock', id: t.dataset.mock }, { push: true }),
  'open-finding': (t, P) => P.go({ view: 'ws', wsId: P.route.wsId, kind: 'finding', id: t.dataset.finding }, { push: true }),
  'mock-quick': (t, P) => { const id = P.id('mock'); mut(P, (d) => { d.mockSets.push({ id, date: P.now().slice(0, 10), partner: '', partnerInLeague: 'unsure', purpose: '', fidelity: 1, simulatedDisclosure: 'closed', formatString: '', teamLocked: true, variantIds: [], blind: false, mySets: d.my6.map((m) => ({ setId: m.setId, v: P.lineage(m.setId)?.currentV ?? null })), briefText: '', games: [], debrief: null }); }); P.wsUi(P.route.wsId).logMock = id; },
  'br-purpose': (t, P) => { P.wsUi(P.route.wsId).br.purpose = t.dataset.value.slice(0, 160); P.app.rerender(); },
  'br-six': (t, P) => { const b = P.wsUi(P.route.wsId).br; const sp = t.dataset.species; b.six = b.six?.includes(sp) ? b.six.filter((x) => x !== sp) : [...(b.six ?? []), sp]; P.app.rerender(); },
  'br-how-add': (t, P) => { const b = P.wsUi(P.route.wsId).br; b.how = [b.how.trim(), t.dataset.value].filter(Boolean).join('\n').slice(0, 2000); P.app.rerender(); },
  'br-set': (t, P) => { const b = P.wsUi(P.route.wsId).br; let v = t.dataset.value; if (t.dataset.key === 'blind') v = v === 'true'; if (t.dataset.key === 'fidelity') v = v === 'S' ? 'S' : Number(v); b[t.dataset.key] = v; if (t.dataset.key === 'variantId') b.blind = false; P.app.rerender(); },
  // Sending the brief (copy, share, save) records the mock set once, with this brief's settings: nothing to remember later
  'br-copy': async (t, P) => { try { await P.app.copyText(P.wsUi(P.route.wsId).br.text); recordMock(P, W(P)); P.toast('Brief copied · mock set recorded'); } catch { P.toast("Couldn't copy; select the preview instead"); } },
  'br-share': async (t, P) => { try { await P.app.share({ text: P.wsUi(P.route.wsId).br.text }); recordMock(P, W(P)); } catch { /* closed */ } },
  'br-save': (t, P) => { P.app.download(`mock-brief-${P.now().slice(0, 10)}.txt`, P.wsUi(P.route.wsId).br.text, 'text/plain'); recordMock(P, W(P)); },
  'br-start': (t, P) => {
    const ws = W(P);
    const id = recordMock(P, ws);
    P.wsUi(ws.id).logMock = id; P.wsUi(ws.id).br = null;
    P.toast('Mock set started: log each game after it ends');
    P.go({ view: 'ws', wsId: ws.id, kind: 'log' }, { push: false });
  },
  'db-pick': (t, P) => { const ui = P.wsUi(P.route.wsId); (ui.dbGame ??= {})[t.dataset.mock] = t.dataset.game; P.app.rerender(); },
  'db-set': (t, P) => mut(P, (d) => { const m = d.mockSets.find((x) => x.id === t.dataset.mock) ?? d.matches.find((x) => x.id === t.dataset.mock); m.debrief = { ...(m.debrief ?? {}), [t.dataset.key]: t.dataset.value, at: P.now() }; }),
  'finding-new': (t, P) => {
    // From a mock or match debrief (its games become the evidence), or a plain one from the Practice tab.
    const ws = W(P), m = t.dataset.mock ? ws.mockSets.find((x) => x.id === t.dataset.mock) ?? ws.matches.find((x) => x.id === t.dataset.mock) : null;
    const gs = m ? games(m) : [];
    const tag = gs.map((g) => g.tag).find((x) => x && x !== 'unclear') ?? 'knowledge-gap';
    const id = P.id('fnd');
    // No games are linked for you: confidence counts only the games you say showed this finding.
    mut(P, (d) => { d.findings.push({ id, statement: '', mechanism: '', kind: tag === 'partner-off-script' ? 'knowledge-gap' : tag, severity: 'major', evidence: { gameIds: [], calcIds: [] }, status: 'open', statusAt: P.now(), considerOpposite: '', proposedChange: '', createdAt: P.now(), sourceId: m?.id ?? null }); });
    P.go({ view: 'ws', wsId: ws.id, kind: 'finding', id }, { push: true });
  },
  'fd-set': (t, P) => mut(P, (d) => { const f = d.findings.find((x) => x.id === t.dataset.finding); f[t.dataset.key] = t.dataset.value; if (t.dataset.key === 'status') f.statusAt = P.now(); }),
  'fd-game': (t, P) => mut(P, (d) => { const f = d.findings.find((x) => x.id === t.dataset.finding); const a = f.evidence.gameIds ?? []; f.evidence.gameIds = a.includes(t.dataset.game) ? a.filter((x) => x !== t.dataset.game) : [...a, t.dataset.game]; }),
  'fd-calc': (t, P) => mut(P, (d) => { const f = d.findings.find((x) => x.id === t.dataset.finding); const a = f.evidence.calcIds ?? []; f.evidence.calcIds = a.includes(t.dataset.calc) ? a.filter((x) => x !== t.dataset.calc) : [...a, t.dataset.calc]; }),
  'fd-speed': (t, P) => mut(P, (d) => { const f = d.findings.find((x) => x.id === t.dataset.finding); f.evidence.speedChecked = !f.evidence.speedChecked; }),
  'fd-cards': (t, P) => P.go({ view: 'ws', wsId: P.route.wsId, tab: 'plan' }, { push: false }),
  'fd-delete': (t, P) => { mut(P, (d) => { d.findings = d.findings.filter((f) => f.id !== t.dataset.finding); }); P.back(); },
  'rv-new': (t, P) => { P.wsUi(P.route.wsId).rv = { findings: t.dataset.finding ? [t.dataset.finding] : [], changes: [], expectedEffect: '', other: '' }; P.go({ view: 'ws', wsId: P.route.wsId, kind: 'revisions' }, { push: true }); },
  'rv-cancel': (t, P) => { P.wsUi(P.route.wsId).rv = null; P.app.rerender(); },
  'rv-remove': (t, P) => { P.wsUi(P.route.wsId).rv.changes.splice(Number(t.dataset.i), 1); P.app.rerender(); },
  'rv-add-set': (t, P) => {
    const rv = P.wsUi(P.route.wsId).rv, l = P.lineage(rv.setId);
    const toV = Number(rv.toV ?? l.currentV);
    const fromV = rv.fromV ?? (toV === l.currentV ? (l.versions.filter((v) => v.v < toV).at(-1)?.v ?? toV) : l.currentV);
    rv.changes.push({ kind: 'set', setId: l.id, fromV, toV, structural: false, what: `${P.spName(l.speciesId)} ${l.name || 'Set'} v${fromV} → v${toV}` });
    if (rv.changes.filter((c) => !c.structural).length > 1) P.toast(C.GUARD['split-structural'].replace('structural', 'set'));
    P.app.rerender();
  },
  'rv-add-swap': (t, P) => {
    const rv = P.wsUi(P.route.wsId).rv;
    if (!rv.out || !rv.in) return;
    rv.changes.push({ kind: 'six', out: rv.out, in: rv.in, structural: true, what: `Your 6: ${P.spName(P.lineage(rv.out).speciesId)} out, ${P.spName(P.lineage(rv.in).speciesId)} in` });
    P.app.rerender();
  },
  'rv-add-other': (t, P) => { const rv = P.wsUi(P.route.wsId).rv; if (!rv.other?.trim()) return; rv.changes.push({ kind: 'other', structural: true, what: rv.other.trim() }); rv.other = ''; P.app.rerender(); },
  'rv-save': (t, P) => {
    const ws = W(P), rv = P.wsUi(ws.id).rv;
    const id = P.id('rvn');
    const setChanges = rv.changes.filter((x) => x.kind === 'set');
    // a set change moves your library's version: refused there (viewing as another coach, read-only data) means no revision
    if (setChanges.length && !P.canWriteMine()) { P.toast(C.POV.mineBlocked(P.myCoach() ?? '')); return; }
    for (const c of setChanges) if (!P.mutate('mysets', (d) => { const i = d.sets.findIndex((s) => s.id === c.setId); d.sets[i] = setCurrent(d.sets[i], c.toV, P.now()); }, { render: false })) return;
    const invalid = ws.calcs.filter((c) => rv.changes.some((x) => x.kind === 'set' && (c.refs?.attacker?.setId === x.setId || c.refs?.defender?.setId === x.setId))).map((c) => c.id);
    const saved = mut(P, (d) => {
      for (const c of rv.changes.filter((x) => x.kind === 'six')) d.my6 = d.my6.map((m) => (m.setId === c.out ? { setId: c.in } : m));
      d.revisions.push({ id, date: P.now().slice(0, 10), changes: rv.changes, reasonFindingIds: rv.findings.length ? rv.findings : 'hunch', structural: rv.changes.some((c) => c.structural), expectedEffect: rv.expectedEffect, invalidates: { calcIds: invalid, cardIds: [] }, retest: null, revertedBy: null });
      for (const f of d.findings) if (rv.findings.includes(f.id) && f.status === 'open') { f.status = 'accepted'; f.statusAt = P.now(); }
    });
    if (!saved) return; // refused (its toast says why): the draft stays
    P.wsUi(ws.id).rv = null;
    P.toast(`Revision saved${invalid.length ? ` · ${invalid.length} calc${invalid.length === 1 ? ' is' : 's are'} now out of date` : ''}. Next mock's purpose: the expected effect.`);
  },
  'rv-retest': (t, P) => mut(P, (d) => { const r = d.revisions.find((x) => x.id === t.dataset.rv); r.retest = { mockSetId: t.dataset.mock, outcome: t.dataset.outcome }; for (const f of d.findings) if ((r.reasonFindingIds ?? []).includes?.(f.id)) { f.status = t.dataset.outcome === 'confirmed' ? 'fixed' : 'retest'; f.statusAt = P.now(); } }),
  'rv-revert': (t, P) => {
    const ws = W(P), r = ws.revisions.find((x) => x.id === t.dataset.rv);
    for (const c of r.changes.filter((x) => x.kind === 'set')) P.mutate('mysets', (d) => { const i = d.sets.findIndex((s) => s.id === c.setId); if (i >= 0) d.sets[i] = setCurrent(d.sets[i], c.fromV, P.now()); }, { render: false });
    const id = P.id('rvn');
    mut(P, (d) => {
      for (const c of r.changes.filter((x) => x.kind === 'six')) d.my6 = d.my6.map((m) => (m.setId === c.in ? { setId: c.out } : m));
      d.revisions.find((x) => x.id === r.id).revertedBy = id;
      d.revisions.push({ id, date: P.now().slice(0, 10), changes: r.changes.map((c) => ({ ...c, what: `Revert: ${c.what}`, fromV: c.toV, toV: c.fromV })), reasonFindingIds: r.reasonFindingIds, structural: r.structural, expectedEffect: 'Back to how it was', invalidates: { calcIds: [], cardIds: [] }, retest: null, revertedBy: null, revertOf: r.id });
      for (const f of d.findings) if ((r.reasonFindingIds ?? []).includes?.(f.id)) { f.status = 'open'; f.statusAt = P.now(); }
    });
    P.toast('Reverted: calcs checked with the earlier versions are current again');
  },
  'rv-copy': async (t, P) => { const ws = W(P); const text = ws.revisions.map((r) => `${r.date} ${r.changes.map((c) => c.what).join('; ')} | expected: ${r.expectedEffect || '-'} | retest: ${r.retest ? r.retest.outcome : 'none'}${r.revertedBy ? ' | reverted' : ''}`).join('\n'); try { await P.app.copyText(text); P.toast('Copied'); } catch { P.toast("Couldn't copy"); } },
  'pilot-parse': (t, P) => {
    const ui = P.ui.pilot;
    if (!P.mech) { P.toast('The Reg M-C data is still loading'); return; }
    const b = parseBrief(ui.text);
    const team = parseTeam(b.paste ?? ui.text, { mech: P.mech, side: 'theirs', answers: autoAnswers(P, b.paste ?? ui.text) });
    ui.parsed = { brief: b.isBrief ? b : null, team };
    P.app.rerender();
  },
  'pilot-copy': async (t, P) => { const sets = P.ui.pilot.parsed.team.sets.filter((s) => s.set).map((s) => s.set); try { await P.app.copyText(exportTeam(sets, P.mech).text); P.toast('Team copied for Showdown'); } catch { P.toast("Couldn't copy"); } },
  'pilot-save': (t, P) => { const ui = P.ui.pilot; P.mutate('pilot', (d) => { d.teams.push({ id: P.id('pilot'), name: ui.parsed.brief?.team || 'Pilot team', text: ui.text.slice(0, 20000), savedAt: P.now() }); }); P.toast('Saved on this device'); },
  'pilot-open': (t, P) => { const team = P.docs.pilot.teams.find((x) => x.id === t.dataset.pilot); P.ui.pilot = { text: team.text, answers: {} }; actions['pilot-parse'](t, P); },
  'pilot-delete': (t, P) => P.mutate('pilot', (d) => { d.teams = d.teams.filter((x) => x.id !== t.dataset.pilot); }),
};
/** For the pilot card, safe defaults for questions (the friend's paste was made for Showdown already). */
function autoAnswers(P, text) {
  const first = parseTeam(text, { mech: P.mech, side: 'theirs' });
  const answers = {};
  first.sets.forEach((s) => { for (const q of s.questions) if (q.suggested !== undefined) (answers[s.index] ??= {})[q.key] = q.suggested; });
  return answers;
}
export const changes = {
  'log-mock': (t, P) => { P.wsUi(P.route.wsId).logMock = t.value; P.app.rerender(); },
  'rv-set': (t, P) => { const rv = P.wsUi(P.route.wsId).rv; rv.setId = t.value || null; rv.toV = null; P.app.rerender(); },
  'rv-ver': (t, P) => { P.wsUi(P.route.wsId).rv.toV = Number(t.value); },
  'rv-out': (t, P) => { P.wsUi(P.route.wsId).rv.out = t.value; },
  'rv-in': (t, P) => { P.wsUi(P.route.wsId).rv.in = t.value; },
  ...logChanges,
};
export const inputs = {
  br: (t, P) => { P.wsUi(P.route.wsId).br[t.dataset.key] = t.value.slice(0, 2000); },
  'db-turn': (t, P) => mut(P, (d) => { const m = d.mockSets.find((x) => x.id === t.dataset.mock) ?? d.matches.find((x) => x.id === t.dataset.mock); m.debrief = { ...(m.debrief ?? {}), turns: { ...(m.debrief?.turns ?? {}), [t.dataset.game]: { ...(m.debrief?.turns?.[t.dataset.game] ?? {}), [t.dataset.key]: t.value.slice(0, 160) } } }; }, { render: false }),
  'db-field': (t, P) => mut(P, (d) => { const m = d.mockSets.find((x) => x.id === t.dataset.mock); m.debrief = { ...(m.debrief ?? {}), [t.dataset.key]: t.value.slice(0, 160) }; }, { render: false }),
  fd: (t, P) => mut(P, (d) => { d.findings.find((x) => x.id === t.dataset.finding)[t.dataset.key] = t.value.slice(0, 200); }, { render: false }),
  rv: (t, P) => { P.wsUi(P.route.wsId).rv[t.dataset.key] = t.value.slice(0, 160); },
  'pilot-text': (t, P) => { P.ui.pilot.text = t.value.slice(0, 50000); },
  ...logInputs,
};
export { checkNumbers, BRIEF_HEADER, FIDELITY_TEXT };

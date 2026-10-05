// Calcs: the notebook (search, filters, pinned, out of date), quick check / full doubles scenario with the trust anatomy,
// envelopes for unknown Stat Points, re-check with old → new, duplicate & change, try their other sets, compare grid,
// "What would it take?" (outspeed / survive / KO) and the Speed ladder with ranges. Calcs are snapshots with keys.
import { normalizeScenario } from '../lib/calc/scenario.mjs';
import { outcomeClass } from '../lib/calc/wrapper.mjs';
import { pinsOf, entityHashes, calcKeys } from '../lib/calc/keys.mjs';
import { surviveSearch, koSearch, outspeedSearch, natureTradeoff } from '../lib/calc/threshold.mjs';
import { battleForme, setStats, checkSet, toID } from '../lib/calc/mech.mjs';
import { speedOf, statValue, natureSign, speedRange, compareSpeed, STAT_IDS } from '../lib/calc/stats.mjs';
import { currentVersion, versionOf, asSet, addVersion, defaultVariant, commonSpread } from '../lib/prep-model.mjs';
import * as C from './prep-copy.js';
import { esc, btn, chipBtn, h2, select, resultBlock, rollsDetail, howCalculated, ladder, koWords, headline, term, noDigits } from './prep-ui.js';
import { variantOf, theirSetFor, addGuess, createMySet } from './prep-sets.js';

const MAX_GRID = 3;

// ---------- picking sides ----------
/** Candidate attackers/defenders: their roster (set from the chosen version) and your 6 (or your roster). */
function sides(P, ws) {
  const v = calcVariant(P, ws);
  const theirs = P.rosterSpecies(ws).map((sp) => ({ side: 'theirs', species: sp, l: theirSetFor(ws, v, sp) ?? ws.theirSets.find((s) => s.speciesId === sp) ?? null }));
  const mineIds = ws.my6.length ? ws.my6.map((m) => m.setId) : null;
  const myRoster = P.coachRoster(P.myCoach());
  const mine = mineIds ? mineIds.map((id) => P.lineage(id)).filter(Boolean).map((l) => ({ side: 'mine', species: l.speciesId, l }))
    : myRoster.filter((sp) => !P.mech || (P.mech.species[sp] && !P.mech.species[sp].mega)).map((sp) => ({ side: 'mine', species: sp, l: P.mineSets().find((s) => s.speciesId === sp) ?? null }));
  return { theirs, mine, variant: v };
}
/** Calcs use "Worst for me" when it exists, else the chosen version (strategist F5). */
function calcVariant(P, ws) { return P.wsUi(ws.id).calcVariantId ? ws.variants.find((x) => x.id === P.wsUi(ws.id).calcVariantId) : defaultVariant(ws) ?? variantOf(P, ws); }

function draftOf(P, ws) {
  const ui = P.wsUi(ws.id);
  ui.cd ??= { a: null, d: null, move: '', crit: false, hits: 0, firstHitOnly: false, moveState: {}, field: {}, aState: {}, dState: {}, calcId: null, title: '' };
  return ui.cd;
}
function lineageFor(P, ws, ref) { return ref ? P.lineage(ref.setId, ws) : null; }

/** Build the scenario for a draft from current set versions (or a saved calc's snapshot when its set is gone). */
function buildScenario(P, ws, cd) {
  const la = lineageFor(P, ws, cd.a), ld = lineageFor(P, ws, cd.d);
  const setOf = (ref, l) => (l ? asSet(l, currentVersion(l)) : ref?.snapshot ?? null);
  const a = setOf(cd.a, la), d = setOf(cd.d, ld);
  if (!a || !d) return null;
  return normalizeScenario({
    attacker: { set: { ...a, gender: a.cosmetic?.gender ?? '' }, state: cd.aState }, defender: { set: { ...d, gender: d.cosmetic?.gender ?? '' }, state: cd.dState },
    move: { id: cd.move, crit: cd.crit, hits: cd.hits, firstHitOnly: cd.firstHitOnly, state: cd.moveState }, field: cd.field,
  });
}
const unknownSide = (sc) => (sc.attacker.set.sp === 'unknown' ? 'attacker' : sc.defender.set.sp === 'unknown' ? 'defender' : null);
function natureKnown(P, ws, ref) {
  const l = lineageFor(P, ws, ref);
  const src = l ? currentVersion(l).provenance?.nature?.source : null;
  return ['sheet-open', 'seen-vs-me', 'seen-vs-others'].includes(src);
}
/** Run (or envelope) a scenario. Returns {result, envelope, side}. */
export function compute(P, ws, sc, refs) {
  if (!P.calc || !sc) return null;
  const side = unknownSide(sc);
  if (side) {
    if (sc.attacker.set.sp === 'unknown' && sc.defender.set.sp === 'unknown') return { result: { class: 'refused', code: 'sp-unknown' } };
    const s = sc[side].set;
    const cs = commonSpread(P.mech, P.app.usage()?.species?.[s.species]);
    const env = P.calc.envelope(sc, side, { natureKnown: natureKnown(P, ws, refs?.[side]), common: cs ? { ...cs, label: `ladder ${P.app.usage()?.month ?? ''}`.trim() } : null });
    const main = env.rows.find((r) => r.key === 'max')?.result ?? env.rows[0].result;
    return { result: main, envelope: env.rows, side };
  }
  return { result: P.calc.run(sc) };
}
function names(P, ws, cd, sc) {
  const la = lineageFor(P, ws, cd.a), ld = lineageFor(P, ws, cd.d);
  const role = (ref) => (ref?.side === 'theirs' ? C.VARIANT_ROLE[calcVariant(P, ws)?.role] : null);
  return {
    attacker: P.spName(sc?.attacker.set.species ?? la?.speciesId), defender: P.spName(sc?.defender.set.species ?? ld?.speciesId),
    attackerSet: la ? `${la.name || 'Set'}${la.side === 'mine' ? ` v${la.currentV}` : ''}${role(cd.a) ? ` · ${role(cd.a)}` : ''}` : 'saved inputs',
    defenderSet: ld ? `${ld.name || 'Set'}${ld.side === 'mine' ? ` v${ld.currentV}` : ''}${role(cd.d) ? ` · ${role(cd.d)}` : ''}` : 'saved inputs',
  };
}

// ---------- notebook ----------
export function tab(P, ws) {
  const ui = P.wsUi(ws.id);
  ui.cf ??= { q: '', pinned: false, stale: false, refused: false, theirs: false, mine: false };
  const f = ui.cf;
  const q = f.q.trim().toLowerCase();
  const entries = ws.calcs.map((c) => ({ c, stale: P.staleOf(ws, c) })).filter(({ c, stale }) => {
    if (f.pinned && !c.pinned) return false;
    if (f.stale && !stale.length) return false;
    if (f.refused && c.summary?.class !== 'refused' && c.summary?.class !== 'needs-state') return false;
    if (f.theirs && c.refs?.attacker?.side !== 'theirs') return false;
    if (f.mine && c.refs?.attacker?.side !== 'mine') return false;
    if (q) {
      const hay = [c.title, c.notes, ...['attacker', 'defender'].flatMap((s) => [P.spName(c.scenario[s].set.species), P.dexSp(c.scenario[s].set.species)?.zh ?? '']), P.name('moves', c.scenario.move.id), ...(c.tags ?? [])].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => Number(b.c.pinned) - Number(a.c.pinned) || (b.c.updatedAt ?? '').localeCompare(a.c.updatedAt ?? ''));
  const nStale = ws.calcs.filter((c) => P.staleOf(ws, c).length).length;
  const nRef = ws.calcs.filter((c) => ['refused', 'needs-state'].includes(c.summary?.class)).length;
  const cards = entries.map(({ c, stale }) => calcCard(P, ws, c, stale)).join('');
  const empty = !ws.calcs.length ? `<p>Save the few numbers that decide this match: who moves first, what survives, what KOs. Start with a quick check.</p>` : !entries.length ? `<p>No calcs match. ${btn('Clear search', 'calc-filter-clear')}</p>` : '';
  return `${h2('Calcs')}
    <label class="field" for="calc-search"><span class="vh">Search calcs</span><input id="calc-search" type="search" data-pi="calc-search" value="${esc(f.q)}" placeholder="Search calcs, Pokémon, moves, notes…"></label>
    <div class="choices" role="group" aria-label="Filters">${chipBtn('Pinned', 'calc-filter', { f: 'pinned' }, f.pinned)}${chipBtn(`Out of date · ${nStale}`, 'calc-filter', { f: 'stale' }, f.stale)}${chipBtn(`No number · ${nRef}`, 'calc-filter', { f: 'refused' }, f.refused)}${chipBtn('Their hits on you', 'calc-filter', { f: 'theirs' }, f.theirs)}${chipBtn('Your hits on them', 'calc-filter', { f: 'mine' }, f.mine)}</div>
    ${f.stale && nStale ? `<p>${btn('Re-check all', 'calc-recheck-all', {}, { primary: true })}</p>` : ''}
    ${empty}<div class="calccards">${cards}</div>
    <p>${btn('What would it take?', 'go-threshold', {}, { cls: 'linkish' })} <span class="small muted">the cheapest Stat Points to outspeed, survive or KO</span></p>
    <div class="bottombar">${btn('Quick check', 'calc-new', {}, { primary: true })}${btn('Speed', 'go-speed')}</div>`;
}
function calcCard(P, ws, c, stale) {
  const sc = c.scenario;
  const who = `${P.spName(sc.attacker.set.species)} ${P.name('moves', sc.move.id)} → ${P.spName(sc.defender.set.species)}`;
  const reason = stale[0];
  let body;
  if (reason) {
    const nm = reason.side ? P.spName(sc[reason.side].set.species) : '';
    body = `<p class="stale">⚠ ${esc((C.STALE[reason.code] ?? C.STALE['engine-changed'])({ ...reason, name: `your ${nm} set` }))}</p>`;
  } else if (c.summary?.class === 'exact') {
    const s = c.summary;
    body = `<p class="headline">${s.envelope?.length ? `${esc(envRange(s))} ${esc(C.ENVELOPE_HEAD)}` : esc(headline({ range: s.range, maxHP: s.maxHP, move: { dist: s.dist ?? [{ n: 1 }] }, ko: s.ko }, P.spName(sc.defender.set.species)))}</p><p class="small">${(s.chips ?? []).slice(0, 3).map((x) => esc(C.chipText(x, { attacker: P.spName(sc.attacker.set.species), defender: P.spName(sc.defender.set.species) }))).join(' · ')}</p>`;
  } else body = `<p class="noresult">${esc(C.CLASS[c.summary?.class] ?? '')}</p>`;
  return `<div class="calccard${c.pinned ? ' pinned' : ''}">${c.title ? `<p class="q"><b>${esc(c.title)}</b></p>` : ''}<p class="small">${btn(who, 'calc-open', { calc: c.id }, { cls: 'linkish' })}</p>${body}${reason && reason.code !== 'set-deleted' ? btn('Re-check', 'calc-recheck', { calc: c.id }) : ''}${c.mark ? ` <span class="chip">${esc({ fine: 'Fine', 'not-fine': 'Not fine', unsure: 'Unsure' }[c.mark])}</span>` : ''}</div>`;
}
const envRange = (s) => { const ex = s.envelope.filter((e) => e.class === 'exact'); return ex.length ? `${Math.min(...ex.map((e) => Math.floor((1000 * e.range.min) / e.maxHP) / 10))}–${Math.max(...ex.map((e) => Math.floor((1000 * e.range.max) / e.maxHP) / 10))}% of HP,` : ''; };

// ---------- calc editor / detail ----------
function editor(P, ws, r) {
  P.ensureEngine();
  const cd = draftOf(P, ws);
  const saved = r.id !== 'new' ? ws.calcs.find((c) => c.id === r.id) : null;
  if (r.id !== 'new' && !saved) return `${h2('Not found')}<p>${esc(C.NOT_ON_DEVICE)}</p>`;
  if (saved && cd.calcId !== saved.id) loadDraft(P, ws, saved);
  if (!saved && cd.calcId) Object.assign(cd, { calcId: null, title: '' });
  const { theirs, mine } = sides(P, ws);
  const pick = (which) => {
    const cur = cd[which];
    const chip = (x) => chipBtn(P.spName(x.species), 'calc-pick', { which, side: x.side, species: x.species, set: x.l?.id ?? '' }, cur?.setId && cur.setId === x.l?.id || (!x.l && cur?.species === x.species && cur?.side === x.side), { cls: x.side });
    return `<div class="choices" role="group" aria-label="${which === 'a' ? 'Attacker' : 'Target'}"><span class="small">${which === 'a' ? 'Attacker' : 'Target'}</span> ${theirs.map(chip).join('')}<span class="sep" aria-hidden="true">|</span>${mine.map(chip).join('')}</div>`;
  };
  const la = lineageFor(P, ws, cd.a);
  const moves = la ? currentVersion(la).data.moves.filter((m) => P.mech?.moves[m] && P.mech.moves[m].category !== 'Status') : cd.a?.snapshot?.moves ?? [];
  // a missing set is started right here (labelled, to check later), so the calc keeps its picks
  const missing = (which) => { const x = cd[which]; return x && !x.setId && !x.snapshot ? `<p class="small">${esc(P.spName(x.species))} has no set yet. ${btn(x.side === 'theirs' ? 'Start from a ladder guess' : 'Start a set from ladder data', 'calc-fill', { which })}</p>` : ''; };
  const sc = buildScenario(P, ws, cd);
  const stale = saved ? P.staleOf(ws, saved) : [];
  // An out-of-date saved calc shows no live number until it is re-checked (or you change an input: then it's a new check).
  const holdNumber = saved && stale.length && !cd.touched;
  let res = null;
  if (sc && cd.move && !holdNumber) res = cd.result && cd.resultFor === JSON.stringify(sc) ? cd.result : null;
  if (sc && cd.move && !res && !holdNumber && P.calc) {
    res = compute(P, ws, sc, { attacker: cd.a, defender: cd.d }); cd.result = res; cd.resultFor = JSON.stringify(sc);
    // a new number is announced once (the result area itself is rebuilt on every render)
    const r = res?.result;
    if (r) P.app.announce?.(r.class === 'exact' ? (res.envelope?.length ? `${P.spName(sc.defender.set.species)}: ${envRange(summarize(res))} ${C.ENVELOPE_HEAD}` : headline(r, P.spName(sc.defender.set.species))) : C.CLASS[r.class] ?? '');
  }
  const nm = names(P, ws, cd, sc);
  const engineNote = P.engineState === 'failed' ? `<p class="banner warn">The calculator couldn't load, so new results and re-checks aren't available right now. Saved results are shown as they were checked. ${btn('Retry', 'calc-retry-engine')}</p>`
    : !P.calc ? '<p class="small muted">Loading the calculator…</p>' : '';
  const savedView = saved && !res ? savedResult(P, ws, saved) : '';
  const diff = saved?.lastDiff ? `<p class="diff">${esc(`Was ${saved.lastDiff.was} → now ${saved.lastDiff.now}`)}${saved.lastDiff.outcomeChanged ? ` <b>${esc(C.OUTCOME_CHANGED)}</b>` : ''} ${btn('Dismiss', 'calc-diff-dismiss', { calc: saved.id }, { cls: 'linkish' })}</p>` : '';
  const parent = saved?.parentId ? ws.calcs.find((x) => x.id === saved.parentId) : null;
  const result = res ? resultBlock(res.result, nm, { envelope: res.envelope?.map((e) => ({ key: e.key, label: e.label, result: e.result })) }) + rollsDetail(res.result, { maxRow: !!res.envelope?.length }) + howCalculated(res.result, { dataHash: P.mech?.meta.hash, nameOf: (id) => P.name('abilities', id) }) : savedView;
  const flags = res?.result?.class === 'exact' ? calcFlags(P, ws, sc, cd) : [];
  // A set that is missing a field (or has one Reg M-C doesn't allow) gets a direct way to fix it.
  const bad = res?.result?.class === 'refused' && SET_FIX.includes(res.result.code) ? cd[res.result.side === 'defender' ? 'd' : 'a'] : null;
  const setFix = bad?.setId ? `<p>${btn(`Open the ${P.spName(bad.species)} set`, bad.side === 'mine' ? 'open-my-set' : 'open-their-set', { set: bad.setId }, { primary: true })}</p>` : '';
  // With attacker, target and move chosen, the pickers fold into one line so the answer comes first on a phone.
  const chosen = !!(sc && cd.move && !cd.picking);
  const pickers = `${pick('a')}${missing('a')}${pick('d')}${missing('d')}
    <div class="choices" role="group" aria-label="Move"><span class="small">Move</span> ${moves.map((m) => chipBtn(P.name('moves', m), 'calc-move', { move: m }, cd.move === m)).join('')}
      ${la && P.mech ? select('calc-other-move', [['', 'Another move it can learn…'], ...[...(P.mech.ix.learn.get(P.mech.species[la.speciesId].outOfBattle) ?? [])].filter((m) => P.mech.moves[m].category !== 'Status' && !moves.includes(m)).sort().map((m) => [m, P.name('moves', m)])], moves.includes(cd.move) ? '' : cd.move, { data: { pc: 'calc-other-move' }, aria: 'Another move it can learn' }) : ''}</div>
    ${cd.picking && sc && cd.move ? `<p>${btn('Done', 'calc-picks-done', {}, { primary: true })}</p>` : ''}`;
  return `${btn('‹ Calcs', 'back', {}, { cls: 'back', aria: 'Back to Calcs' })}${h2(saved ? 'Calc' : 'Quick check')}
    ${saved ? `<label class="field" for="calc-title"><span>What are you checking?</span><input id="calc-title" data-pi="calc-title" value="${esc(saved.title ?? '')}" maxlength="120"></label>` : ''}
    ${stale.length ? `<p class="stale">⚠ ${esc((C.STALE[stale[0].code] ?? C.STALE['engine-changed'])({ ...stale[0], name: `the ${P.spName(saved.scenario[stale[0].side ?? 'attacker'].set.species)} set` }))} ${stale[0].code !== 'set-deleted' ? btn('Re-check', 'calc-recheck', { calc: saved.id }, { primary: true }) : ''}</p>` : ''}
    ${diff}${parent ? `<p class="small">Compared with: ${esc(parent.title || 'an earlier calc')}${parent.summary?.class === 'exact' ? ` (${esc(summaryLine(P, parent))})` : ''}</p>` : ''}`
    + (chosen ? `<p class="picked"><b>${esc(P.spName(cd.a.species))} → ${esc(P.spName(cd.d.species))} · ${esc(P.name('moves', cd.move))}</b> ${btn('Change', 'calc-change-picks', {}, { cls: 'linkish', aria: 'Change attacker, target or move' })}</p>` : pickers)
    + `${engineNote}
    <div class="calcresult">${result}</div>${setFix}
    ${flags.length ? `<ul class="flags">${flags.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
    ${res?.result?.class === 'exact' || saved ? actionsRow(P, ws, cd, saved, res) : ''}
    ${sc && cd.move ? `<h3>Change the situation</h3>${fieldSuggestions(P, ws, cd, sc)}${fieldControls(P, ws, cd, sc)}` : ''}`;
}
const SET_FIX = ['ability-missing', 'nature-missing', 'ability-not-legal', 'item-not-in-regulation', 'mega-stone-mismatch', 'move-not-learnable', 'move-not-in-regulation', 'set-invalid', 'sp-out-of-range'];
function summaryLine(P, c) {
  const s = c.summary;
  if (s.envelope?.length) return envRange(s);
  return `${Math.floor((1000 * s.range.min) / s.maxHP) / 10}–${Math.floor((1000 * s.range.max) / s.maxHP) / 10}%`;
}
function savedResult(P, ws, c) {
  const s = c.summary;
  if (!s) return '';
  const stale = P.staleOf(ws, c);
  if (stale.length) return '<p class="small">The saved number is hidden until you re-check.</p>';
  if (s.class !== 'exact') return `<p class="noresult">${esc(C.CLASS[s.class] ?? '')}</p>`;
  return `<p class="headline">${esc(s.envelope?.length ? `${envRange(s)} ${C.ENVELOPE_HEAD}` : `${summaryLine(P, c)} of HP · ${koWords(s.ko.one, { hits: hitsOf(s.dist) }) ?? ''}`)}</p><p class="small muted">${esc(C.FOOTER)} · checked ${esc((c.checkedAt ?? '').slice(0, 16).replace('T', ' '))}</p>`;
}
function calcFlags(P, ws, sc, cd) {
  const out = [];
  const mv = P.mech?.moves[sc.move.id];
  if (mv?.category === 'Physical' && cd.a?.side === 'mine' && !sc.attacker.state.intimidated) {
    const intim = P.rosterSpecies(ws).some((sp) => P.mech.species[sp]?.abilities.includes('Intimidate'));
    if (intim) out.push(C.FLAG.F4({ here: true }));
  }
  if (cd.a?.side === 'theirs' && ws.variants.some((v) => v.role === 'worst-plausible') && calcVariant(P, ws)?.role !== 'worst-plausible') out.push(C.FLAG.F5());
  return out;
}
const SETTERS = { drizzle: ['weather', 'Rain', 'rain'], drought: ['weather', 'Sun', 'sun'], sandstream: ['weather', 'Sand', 'a sandstorm'], snowwarning: ['weather', 'Snow', 'snow'],
  electricsurge: ['terrain', 'Electric', 'Electric Terrain'], grassysurge: ['terrain', 'Grassy', 'Grassy Terrain'], psychicsurge: ['terrain', 'Psychic', 'Psychic Terrain'], mistysurge: ['terrain', 'Misty', 'Misty Terrain'] };
/**
 * "Probably on the field": what the two Pokémon (or their team) bring by themselves: weather and terrain from their
 * abilities (Mega forms included) and Intimidate on your physical attacker. One tap applies one; nothing is applied silently.
 */
function fieldSuggestions(P, ws, cd, sc) {
  const out = [];
  for (const which of ['attacker', 'defender']) {
    const s = sc[which].set;
    const f = battleForme(P.mech, s.species, s.item, { megaEvolved: cd[which === 'attacker' ? 'aState' : 'dState']?.mega !== false });
    const ab = !f.error && f.mega ? toID(P.mech.species[f.id].abilities[0] ?? '') : s.ability;
    const st = SETTERS[ab];
    if (st && (cd.field?.[st[0]] ?? '') !== st[1]) out.push(chipBtn(`${P.spName(s.species)} sets ${st[2]}: apply`, 'calc-set', { scope: 'field', key: st[0], value: st[1] }, false));
  }
  const mv = P.mech.moves[cd.move];
  if (mv?.category === 'Physical' && cd.a?.side === 'mine' && !(cd.aState?.intimidated) && P.rosterSpecies(ws).some((sp) => P.mech.species[sp]?.abilities.includes('Intimidate'))) {
    out.push(chipBtn('They may have Intimidate: apply −1', 'calc-set', { scope: 'aState', key: 'intimidated', value: 1 }, false));
  }
  return out.length ? `<div class="choices" role="group" aria-label="Probably on the field"><span class="small">Probably on the field</span> ${out.join('')}</div>` : '';
}
function fieldControls(P, ws, cd, sc) {
  const f = cd.field ?? {}, a = cd.aState ?? {}, d = cd.dState ?? {};
  const mv = P.mech?.moves[cd.move];
  const spread = mv && ['allAdjacent', 'allAdjacentFoes'].includes(mv.target);
  // the priority the move really has here (Gale Wings at full HP, Grassy Glide in Grassy Terrain), as the calculator reads it
  const effPriority = (mv?.priority ?? 0) + (sc?.attacker.set.ability === 'galewings' && mv?.type === 'Flying' && (cd.aState?.hpPct ?? 100) === 100 ? 1 : 0) + (cd.move === 'grassyglide' && f.terrain === 'Grassy' ? 1 : 0);
  const t = (label, key, on, scope = 'field') => chipBtn(label, 'calc-toggle', { scope, key }, on);
  const weather = ['', 'Sun', 'Rain', 'Sand', 'Snow'].map((w) => chipBtn(w || 'No weather', 'calc-set', { scope: 'field', key: 'weather', value: w }, (f.weather ?? '') === w)).join('');
  const terrain = ['', 'Electric', 'Grassy', 'Psychic', 'Misty'].map((w) => chipBtn(w ? `${w}` : 'No terrain', 'calc-set', { scope: 'field', key: 'terrain', value: w }, (f.terrain ?? '') === w)).join('');
  const intim = [0, 1, 2].map((n) => chipBtn(n ? `Intimidate −${n}` : 'No Intimidate', 'calc-set', { scope: 'aState', key: 'intimidated', value: n }, (a.intimidated ?? 0) === n)).join('');
  const hp = (scope, label) => `<label class="field small" for="hp-${scope}"><span>${esc(label)} HP %</span><input id="hp-${scope}" type="number" inputmode="numeric" min="1" max="100" value="${esc((scope === 'aState' ? a : d).hpPct ?? 100)}" data-pc="calc-hp" data-scope="${scope}"></label>`;
  const stage = (scope, stat) => select(`st-${scope}-${stat}`, [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6].map((n) => [String(n), n > 0 ? `+${n}` : String(n)]), String((scope === 'aState' ? a : d).boosts?.[stat] ?? 0), { label: `${scope === 'aState' ? 'Attacker' : 'Target'} ${C.STAT_SHORT[stat]}`, data: { pc: 'calc-stage', scope, stat } });
  const status = (scope) => select(`stat-${scope}`, [['', 'No status'], ['brn', 'Burned'], ['par', 'Paralysed'], ['psn', 'Poisoned'], ['tox', 'Badly poisoned'], ['slp', 'Asleep'], ['frz', 'Frozen']], (scope === 'aState' ? a : d).status ?? '', { label: `${scope === 'aState' ? 'Attacker' : 'Target'} status`, data: { pc: 'calc-status', scope } });
  const forms = [];
  if (sc?.defender.set.species === 'aegislash') forms.push(chipBtn('Aegislash Shield', 'calc-set', { scope: 'dState', key: 'form', value: '' }, (d.form ?? '') !== 'blade'), chipBtn('Aegislash Blade (attacked earlier)', 'calc-set', { scope: 'dState', key: 'form', value: 'blade' }, d.form === 'blade'));
  if (sc?.defender.set.species === 'mimikyu') forms.push(t('Disguise already broken', 'disguiseBroken', d.disguiseIntact === false, 'dState'));
  if (sc?.attacker.set.species === 'morpeko' && cd.move === 'aurawheel') forms.push(chipBtn('Hangry Mode', 'calc-set', { scope: 'aState', key: 'form', value: a.form === 'hangry' ? '' : 'hangry' }, a.form === 'hangry'));
  const megaA = sc && P.mech?.items[sc.attacker.set.item]?.megaStone, megaD = sc && P.mech?.items[sc.defender.set.item]?.megaStone;
  if (megaA) forms.push(chipBtn('Attacker before Mega Evolving', 'calc-set', { scope: 'aState', key: 'mega', value: a.mega === false ? 'true' : 'false' }, a.mega === false));
  if (megaD) forms.push(chipBtn('Target before Mega Evolving', 'calc-set', { scope: 'dState', key: 'mega', value: d.mega === false ? 'true' : 'false' }, d.mega === false));
  const act = sc && P.mech && ['flashfire', 'stakeout', 'plus', 'minus', 'electromorphosis'].includes(sc.attacker.set.ability) ? t(C.chipText({ code: `activation-${sc.attacker.set.ability}`, value: true }), 'abilityOn', a.abilityOn, 'aState') : '';
  const cond = { payback: 'movesLast', avalanche: 'hitFirstThisTurn', temperflare: 'lastMoveFailed', stompingtantrum: 'lastMoveFailed', ficklebeam: 'fickleDouble', assurance: 'targetAlreadyHit' }[cd.move];
  const condChip = cond || sc?.attacker.set.ability === 'analytic' ? t(C.chipText({ code: `cond-${cond ?? 'movesLast'}`, value: true }), cond ?? 'movesLast', cd.moveState?.[cond ?? 'movesLast'], 'moveState') : '';
  return `<div class="fieldctl">
    <div class="choices" role="group" aria-label="Weather">${weather}</div>
    <div class="choices" role="group" aria-label="Common">${spread ? chipBtn('Only one target left', 'calc-toggle', { scope: 'field', key: 'loneTarget' }, f.defenderSide?.partnerPresent === false) : ''}${t('Helping Hand', 'helpingHand', f.attackerSide?.helpingHand, 'attackerSide')}${t('Reflect', 'reflect', f.defenderSide?.reflect, 'defenderSide')}${t('Light Screen', 'lightScreen', f.defenderSide?.lightScreen, 'defenderSide')}${t('Aurora Veil', 'auroraVeil', f.defenderSide?.auroraVeil, 'defenderSide')}${chipBtn('Critical hit', 'calc-toggle-crit', {}, cd.crit)}${condChip}${act}${forms.join('')}</div>
    <div class="choices" role="group" aria-label="Intimidate on the attacker">${intim}</div>
    <details class="more"><summary>More: terrain, HP, stat changes, status, partners</summary>
      <div class="choices" role="group" aria-label="Terrain">${terrain}</div>
      <div class="choices" role="group" aria-label="More field">${t('Ally Friend Guard (target side)', 'friendGuard', f.defenderSide?.friendGuard, 'defenderSide')}${t('Target Protects', 'protect', f.defenderSide?.protect, 'defenderSide')}${t('Ally Steely Spirit', 'steelySpirit', f.attackerSide?.steelySpirit, 'attackerSide')}${t('Charged', 'charge', f.attackerSide?.charge, 'attackerSide')}${t('Attacker ally has Unnerve', 'unnerve', f.attackerSide?.unnerve, 'attackerSide')}${effPriority > 0 || f.defenderSide?.priorityBlock ? t('Target ally blocks priority (Armor Tail, Dazzling, Queenly Majesty)', 'priorityBlock', f.defenderSide?.priorityBlock, 'defenderSide') : ''}${a.intimidated ? t('Attacker ally has Flower Veil', 'flowerVeil', f.attackerSide?.flowerVeil, 'attackerSide') : ''}${t('Fairy Aura from another Pokémon', 'otherFairyAura', f.otherFairyAura)}${t('Gravity', 'gravity', f.gravity)}${t('Magic Room', 'magicRoom', f.magicRoom)}${t('Wonder Room', 'wonderRoom', f.wonderRoom)}${spread && mv.target === 'allAdjacent' ? t('Your ally is not on the field', 'noAlly', f.attackerSide?.allyPresent === false, 'attackerSide') : ''}${t("Target's item already used", 'itemConsumed', d.itemConsumed, 'dState')}${t("Attacker's item already used", 'itemConsumed', a.itemConsumed, 'aState')}</div>
      ${hp('aState', 'Attacker')}${hp('dState', 'Target')}
      ${['atk', 'spa'].map((s) => stage('aState', s)).join('')}${['def', 'spd'].map((s) => stage('dState', s)).join('')}
      ${status('aState')}${status('dState')}
      ${mv?.multihit && Array.isArray(mv.multihit) ? select('calc-hits', [['0', 'Hits: 35/35/15/15 mix'], ['2', '2 hits'], ['3', '3 hits'], ['4', '4 hits'], ['5', '5 hits']], String(cd.hits ?? 0), { label: 'Number of hits', data: { pc: 'calc-hits' } }) : ''}
    </details></div>`;
}
function actionsRow(P, ws, cd, saved, res) {
  const other = cd.a?.side === 'theirs' || cd.d?.side === 'theirs';
  return `<div class="actions">${saved ? `${btn(saved.pinned ? 'Unpin' : 'Pin', 'calc-pin', { calc: saved.id })} ${btn('Save changes', 'calc-update', { calc: saved.id })} ${btn('Duplicate & change', 'calc-dup', { calc: saved.id })}` : btn('Save to notebook', 'calc-save', {}, { primary: true })}
    ${btn('Copy as text', 'calc-copy')} ${other ? btn('Try their other sets', 'calc-others') : ''} ${btn('Compare', 'calc-compare')} ${btn('What would it take?', 'go-threshold-from')}</div>
    ${saved ? `<div class="choices" role="group" aria-label="Mark">${['fine', 'not-fine', 'unsure'].map((m) => chipBtn({ fine: 'Fine', 'not-fine': 'Not fine', unsure: 'Unsure' }[m], 'calc-mark', { calc: saved.id, mark: m }, saved.mark === m)).join('')} ${btn('Delete', 'calc-delete', { calc: saved.id })}</div>` : ''}
    ${P.wsUi(ws.id).others ? othersBlock(P, ws) : ''}`;
}
function othersBlock(P, ws) {
  const rows = P.wsUi(ws.id).others;
  return `<div class="others"><h3>Their other sets</h3><ul>${rows.map((x) => `<li>${esc(x.label)}: ${x.result.class === 'exact' ? esc(headline(x.result, x.defName)) : `<span class="noresult">${esc(C.CLASS[x.result.class] ?? '')}</span>`}</li>`).join('')}</ul></div>`;
}

function loadDraft(P, ws, saved) {
  const ui = P.wsUi(ws.id);
  const sc = saved.scenario;
  ui.cd = {
    calcId: saved.id, title: saved.title ?? '',
    a: { ...saved.refs.attacker, snapshot: sc.attacker.set }, d: { ...saved.refs.defender, snapshot: sc.defender.set },
    move: sc.move.id, crit: sc.move.crit, hits: sc.move.hits, firstHitOnly: sc.move.firstHitOnly, moveState: { ...sc.move.state },
    field: structuredClone(sc.field), aState: structuredClone(sc.attacker.state), dState: structuredClone(sc.defender.state),
    touched: false, // an out-of-date saved calc shows no number until re-checked or changed (editor)
  };
}

/** The stored summary of a computed result (no engine needed to show it later). */
function summarize(res) {
  const r = res.result;
  const base = { class: r.class, code: r.code };
  if (r.class !== 'exact') return base;
  return {
    ...base, range: r.range, maxHP: r.maxHP, curHP: r.curHP, ko: r.ko, dist: r.move.dist, hitRows: r.hitRows, chips: r.chips, notCounted: r.notCounted, flags: r.flags,
    crit: r.crit?.range ? { range: r.crit.range, ko1: r.crit.ko1 } : r.crit?.immune ? { immune: true } : null,
    envelope: res.envelope?.map((e) => ({ key: e.key, label: e.label ?? null, class: e.result.class, range: e.result.range ?? null, maxHP: e.result.maxHP ?? null, ko: e.result.ko ?? null })) ?? null,
  };
}
/** The most hits a result's distribution has (1 for single-hit moves). */
const hitsOf = (dist) => Math.max(1, ...(dist ?? []).map((x) => x.n));
const shortSummary = (P, s) => (s?.class === 'exact' ? `${s.envelope?.length ? envRange(s) : `${Math.floor((1000 * s.range.min) / s.maxHP) / 10}–${Math.floor((1000 * s.range.max) / s.maxHP) / 10}%`} (${s.envelope?.length ? 'max investment: ' : ''}${koWords(s.envelope?.length ? s.envelope.at(-1).ko.one : s.ko.one, { hits: hitsOf(s.dist) }) ?? ''})` : C.CLASS[s?.class] ?? '—');

function entryFrom(P, ws, cd, res, sc, existing = null) {
  const now = P.now();
  const ref = (x) => { const l = lineageFor(P, ws, x); return { setId: x.setId ?? null, v: l ? l.currentV : x.v ?? null, side: x.side }; };
  return {
    ...(existing ?? { id: P.id('calc'), createdAt: now, pinned: false, mark: null, parentId: null, notes: '', tags: [], kind: 'damage', title: '' }),
    scenario: sc, refs: { attacker: ref(cd.a), defender: ref(cd.d) }, summary: summarize(res), pins: pinsOf(P.mech, P.engineInfo), entities: entityHashes(sc, P.mech),
    checkedAt: now, updatedAt: now, variantRole: cd.a?.side === 'theirs' || cd.d?.side === 'theirs' ? calcVariant(P, ws)?.role ?? null : null,
  };
}
async function attachKeys(P, wsId, calcId) {
  const ws = P.ws.get(wsId);
  const c = ws?.calcs.find((x) => x.id === calcId);
  if (!c || !P.app.crypto?.subtle) return;
  try {
    const k = await calcKeys(c.scenario, P.mech, P.engineInfo, P.app.crypto.subtle);
    P.mutate(`ws:${wsId}`, (d) => { const x = d.calcs.find((y) => y.id === calcId); if (x) x.keys = { inputKey: k.inputKey, entityKey: k.entityKey, resultKey: k.resultKey }; }, { substantive: false, render: false });
  } catch { /* keys are an integrity extra; staleness uses pins and entity hashes */ }
}
/** Re-check one saved calc against current set versions; records old → new. Returns true when recomputed. */
function recheck(P, ws, c) {
  if (!P.calc) { P.ensureEngine(); P.toast('Loading the calculator… try again in a moment'); return false; }
  const ref = (x) => { const l = P.lineage(x.setId, ws); return l ? { ...x, v: l.currentV } : x; };
  const cd = { a: ref(c.refs.attacker), d: ref(c.refs.defender), move: c.scenario.move.id, crit: c.scenario.move.crit, hits: c.scenario.move.hits, firstHitOnly: c.scenario.move.firstHitOnly, moveState: c.scenario.move.state, field: c.scenario.field, aState: c.scenario.attacker.state, dState: c.scenario.defender.state };
  for (const s of ['a', 'd']) if (!P.lineage(cd[s].setId, ws)) cd[s].snapshot = c.scenario[s === 'a' ? 'attacker' : 'defender'].set;
  const sc = buildScenario(P, ws, cd);
  const res = compute(P, ws, sc, { attacker: cd.a, defender: cd.d });
  const next = entryFrom(P, ws, cd, res, sc, c);
  next.lastDiff = { was: shortSummary(P, c.summary), now: shortSummary(P, next.summary), outcomeChanged: outcomeClass(c.summary?.class === 'exact' ? { class: 'exact', ko: c.summary.ko } : c.summary) !== outcomeClass(next.summary.class === 'exact' ? { class: 'exact', ko: next.summary.ko } : next.summary), at: P.now() };
  P.mutate(`ws:${ws.id}`, (d) => { const i = d.calcs.findIndex((x) => x.id === c.id); d.calcs[i] = next; });
  attachKeys(P, ws.id, c.id);
  return true;
}

// ---------- compare grid ----------
function compare(P, ws) {
  P.ensureEngine();
  const ui = P.wsUi(ws.id);
  const cd = draftOf(P, ws);
  const sc = buildScenario(P, ws, cd);
  if (!sc || !cd.move) return `${btn('‹ Back', 'back', {}, { cls: 'back', aria: 'Back' })}${h2('Compare')}<p>Open a calc first, then Compare.</p>`;
  const mineSide = cd.a?.side === 'mine' ? 'a' : cd.d?.side === 'mine' ? 'd' : null;
  const theirSide = mineSide === 'a' ? 'd' : mineSide === 'd' ? 'a' : null;
  const myL = mineSide ? lineageFor(P, ws, cd[mineSide]) : null;
  ui.cmp ??= { extra: [] };
  const mineCols = myL ? [...new Set([myL.currentV, ...myL.versions.map((v) => v.v).sort((a, b) => b - a)])].slice(0, MAX_GRID).map((v) => ({ label: `${myL.name || 'Set'} v${v}${v === myL.currentV ? ' (current)' : ''}`, set: asSet(myL, versionOf(myL, v)) }))
    : [{ label: 'as set', set: null }];
  // spreads you are trying come on top of the saved versions (gently capped: three of each)
  for (const x of ui.cmp.extra.filter((e) => !myL || e.setId === myL.id)) mineCols.push(x);
  const sp = theirSide ? (cd[theirSide].species ?? lineageFor(P, ws, cd[theirSide])?.speciesId) : null;
  const theirRows = theirSide ? ws.variants.slice(0, MAX_GRID).map((v) => ({ label: C.VARIANT_ROLE[v.role] + (v.name ? `: ${v.name}` : ''), l: theirSetFor(ws, v, sp) })).filter((x) => x.l) : [];
  if (!theirRows.length && theirSide) { const l = lineageFor(P, ws, cd[theirSide]); if (l) theirRows.push({ label: 'their set', l }); }
  const cell = (mc, tr) => {
    const s = structuredClone(sc);
    if (mineSide && mc.set) s[mineSide === 'a' ? 'attacker' : 'defender'].set = { ...mc.set, gender: mc.set.cosmetic?.gender ?? '' };
    if (theirSide && tr?.l) s[theirSide === 'a' ? 'attacker' : 'defender'].set = { ...asSet(tr.l, currentVersion(tr.l)), gender: '' };
    const res = compute(P, ws, normalizeScenario(s), {});
    if (!res) return '<td class="muted">…</td>';
    const r = res.result;
    if (res.envelope) { const ex = res.envelope.filter((e) => e.result.class === 'exact'); return ex.length ? `<td>${esc(ex.map((e) => `${C.ENVELOPE_ROW[e.key]} ${koWords(e.result.ko.one, { hits: hitsOf(e.result.move?.dist) }) ?? ''}`).join(' · '))}</td>` : `<td class="noresult">${esc(C.CLASS[res.envelope[0].result.class] ?? '')}</td>`; }
    return r.class === 'exact' ? `<td>${esc(headline(r, P.spName(s.defender.set.species)))}</td>` : `<td class="noresult">${esc(C.CLASS[r.class] ?? '')}</td>`;
  };
  const head = `<tr><th scope="col">Their version ↓ · your set →</th>${mineCols.map((m, i) => `<th scope="col">${esc(m.label)}${m.candidate ? ` ${btn('Save as a new version', 'cmp-promote', { label: m.label })}` : ''}</th>`).join('')}</tr>`;
  const body = (theirRows.length ? theirRows : [null]).map((tr) => `<tr><th scope="row">${esc(tr?.label ?? '')}</th>${P.calc ? mineCols.map((mc) => cell(mc, tr)).join('') : '<td>Loading the calculator…</td>'}</tr>`).join('');
  return `${btn('‹ Back', 'back', {}, { cls: 'back', aria: 'Back' })}${h2('Compare')}
    <p class="small">${esc(P.spName(sc.attacker.set.species))} ${esc(P.name('moves', sc.move.id))} → ${esc(P.spName(sc.defender.set.species))}. Same field and assumptions in every cell; change them on the calc and come back.</p>
    <div class="scroll"><table class="cmpgrid">${head}${body}</table></div>
    <p class="small">Your three newest versions${ui.cmp.extra.length ? ' plus the spreads you are trying' : ''}, against up to three versions of their team. A cell without a number shows why on the calc itself.</p>`;
}

// ---------- thresholds ----------
function threshold(P, ws) {
  P.ensureEngine();
  const ui = P.wsUi(ws.id);
  ui.th ??= { kind: 'outspeed', mine: null, their: null, move: '', investment: 'max', crit: false, result: null, trickRoom: false, tailwindMine: false, tailwindTheirs: false };
  const th = ui.th;
  const { theirs, mine } = sides(P, ws);
  const myChips = mine.filter((x) => x.l).map((x) => chipBtn(P.spName(x.species), 'th-pick', { which: 'mine', set: x.l.id }, th.mine === x.l.id)).join('');
  const theirChips = theirs.map((x) => chipBtn(P.spName(x.species), 'th-pick', { which: 'their', set: x.l?.id ?? '', species: x.species }, th.theirSpecies === x.species)).join('');
  const myL = th.mine ? P.lineage(th.mine) : null, theirL = th.their ? P.lineage(th.their, ws) : null;
  const moveSrc = th.kind === 'ko' ? myL : theirL;
  const moves = moveSrc ? currentVersion(moveSrc).data.moves.filter((m) => P.mech?.moves[m]?.category !== 'Status') : [];
  const kinds = { outspeed: 'Outspeed', survive: 'Survive a hit', ko: 'KO' };
  return `${btn('‹ Calcs', 'back', {}, { cls: 'back', aria: 'Back to Calcs' })}${h2('What would it take?')}
    <div class="choices" role="group" aria-label="Question">${Object.entries(kinds).map(([k, l]) => chipBtn(l, 'th-kind', { kind: k }, th.kind === k)).join('')}</div>
    <div class="choices" role="group" aria-label="Your set"><span class="small">Your</span> ${myChips || '<span class="small">No sets yet: add your sets first.</span>'}</div>
    <div class="choices" role="group" aria-label="Their Pokémon"><span class="small">${th.kind === 'outspeed' ? 'moves before' : th.kind === 'survive' ? 'survives' : 'KOs'}</span> ${theirChips}</div>
    ${th.kind !== 'outspeed' ? `<div class="choices" role="group" aria-label="Move">${moves.map((m) => chipBtn(P.name('moves', m), 'th-move', { move: m }, th.move === m)).join('')}</div>` : ''}
    <div class="choices" role="group" aria-label="Their investment"><span class="small">Their investment</span> ${['frail', 'common', 'max'].map((k) => chipBtn(k === 'max' ? 'max: worst case' : k, 'th-inv', { inv: k }, th.investment === k)).join('')}</div>
    ${th.kind === 'outspeed' ? `<div class="choices" role="group" aria-label="Speed field">${chipBtn('Trick Room', 'th-flag', { key: 'trickRoom' }, th.trickRoom)}${chipBtn('Your Tailwind', 'th-flag', { key: 'tailwindMine' }, th.tailwindMine)}${chipBtn('Their Tailwind', 'th-flag', { key: 'tailwindTheirs' }, th.tailwindTheirs)}</div>` : ''}
    ${th.kind === 'survive' ? chipBtn('Survive a crit too', 'th-flag', { key: 'crit' }, th.crit) : ''}
    <p>${btn('Find the cheapest Stat Points', 'th-run', {}, { primary: true, disabled: !(myL && (theirL || th.theirSpecies) && (th.kind === 'outspeed' || th.move)) })}</p>
    <div class="thresult">${th.result ? thresholdResult(P, ws, th, myL) : ''}</div>`;
}
const TH_REFUSE = {
  'sp-unknown': "Fill in your set's Stat Points first.", 'their-set-missing': 'They have no set for that Pokémon yet: start one from a ladder guess or a paste (Sets).',
  'target-hp-move': "This move's damage depends on the target's HP, so there is no single answer.", 'disguise-hp': 'Disguise makes the first hit a fixed chip; there is no Stat Point answer.',
  'foul-play': "Foul Play uses the target's Attack, so your investment doesn't change it.", 'no-damage-move': 'Pick a damaging move.',
  'hp-band-both': 'Both Pokémon are below full HP here; pick one side at full HP for a Stat Point answer.',
};
/** A threshold refusal in words: no-damage, a question to answer on a calc, a between-hits limit, or a refusal. */
function thresholdRefusal(P, r) {
  if (r.class === 'no-damage' || r.class === 'status') return `<p>${esc(C.NO_DAMAGE[r.refused] ?? C.CLASS['no-damage'])} No investment needed.</p>`;
  if (r.class === 'needs-state') return `<p class="noresult">${esc(noDigits((C.QUESTION[r.question?.key] ?? (() => ''))(r)))} Answer it on a calc first (Quick check), then come back.</p>`;
  const text = TH_REFUSE[r.refused] ?? C.REPEAT_REFUSED[r.refused] ?? (C.REFUSE[r.refused] ?? C.REFUSE['engine-error'])({ name: '', reason: r.reason });
  return `<p class="noresult">${esc(C.CLASS.refused)}: ${esc(noDigits(text))}</p>`;
}
/** "Impish (+Def −SpA; gives up Adamant's +Atk)" — and a warning when it costs a stat the set uses. */
function natureCost(P, set, nature, tradeoff) {
  const n = P.mech.natures[nature];
  const signs = n && n.plus !== n.minus ? ` (+${C.STAT_SHORT[n.plus]} −${C.STAT_SHORT[n.minus]}${tradeoff?.givesUp ? `; gives up ${P.name('natures', set.nature)}'s +${C.STAT_SHORT[tradeoff.givesUp]}` : ''})` : '';
  return `${esc(P.name('natures', nature))}${esc(signs)}${tradeoff?.losesUsed ? ' <span class="chip unc">costs a stat this set uses</span>' : ''}`;
}
function thresholdResult(P, ws, th, myL) {
  const r = th.result;
  if (r.refused) return thresholdRefusal(P, r);
  const mySet = myL ? asSet(myL, currentVersion(myL)) : null;
  const assumed = `<p class="small">${r.assumed?.length ? `Assumes: ${esc(r.assumed.join('; '))}` : 'Assumes: no field effects; both at full HP.'}${r.note ? ` ${esc(r.note)}` : ''}</p>`;
  if (th.kind === 'outspeed') {
    const rows = r.options.map((o) => {
      const what = o.impossible ? `even ${o.best.sp} SP (${o.best.speed}) isn't enough`
        : th.trickRoom ? `slower with up to ${o.sp} Speed SP (${o.speed} at ${o.sp})${r.currentSp !== null && o.nature === mySet?.nature ? ` · you have ${r.currentSp}` : ''}`
          : `${o.sp} SP → ${o.speed} (faster by ${o.margin})${o.withinBudget ? '' : ' · over your free Stat Points'}`;
      const cost = o.nature === mySet?.nature ? esc(P.name('natures', o.nature)) : natureCost(P, mySet, o.nature, o.tradeoff);
      return `<tr><th scope="row">${cost}</th><td>${what}</td><td>${o.tieAt !== null ? `ties at ${o.tieAt} SP (coin flip)` : ''}</td><td>${o.impossible || (o.keep === r.currentSp && o.nature === mySet?.nature) ? '' : btn('Save as a new version', 'th-apply', { sp: o.keep, nature: o.nature, stat: 'spe' })}</td></tr>`;
    }).join('');
    return `${assumed}<p>Target Speed: ${r.target} (${esc(r.targetLabel)})${r.current !== null ? ` · your set now: ${r.current}` : ''}</p><div class="scroll"><table>${rows}</table></div>
      ${r.options.every((o) => o.impossible) ? '<p>Options beyond Stat Points: Tailwind, Trick Room, Choice Scarf or a Speed drop on them (Icy Wind, Electroweb).</p>' : ''}`;
  }
  const label = { 'every-roll': th.kind === 'survive' ? 'survive every roll' : 'KO every roll', 'fifteen-of-sixteen': th.kind === 'survive' ? 'survive 15 of 16' : 'KO 15 of 16', half: th.kind === 'survive' ? 'survive 8 of 16' : 'KO 8 of 16', 'crit-too': 'survive a crit too' };
  const spText = (o) => (th.kind === 'survive' ? `${o.h} HP / ${o.d} ${C.STAT_SHORT[r.stat]}` : `${o.a} ${C.STAT_SHORT[r.stat]}`);
  const dataOf = (o) => (th.kind === 'survive' ? { hp: o.h, def: o.d, nature: o.nature, stat: r.stat } : { sp: o.a, nature: o.nature, stat: r.stat });
  const apply = (o) => `${btn('Save as a new version', 'th-apply', dataOf(o))} ${btn('Try in Compare', 'th-compare', { ...dataOf(o), label: `${P.name('natures', o.nature)} ${spText(o)}` }, { cls: 'linkish' })}`;
  // Your set may already reach a level: say so (and why, when Focus Sash or Sturdy at full HP is the reason) instead of a save
  const ok = { 'every-roll': (k) => (th.kind === 'survive' ? k.num === '0' : k.num === k.den), 'fifteen-of-sixteen': (k) => (th.kind === 'survive' ? 16n * BigInt(k.num) <= BigInt(k.den) : 16n * BigInt(k.num) >= 15n * BigInt(k.den)),
    half: (k) => (th.kind === 'survive' ? 2n * BigInt(k.num) <= BigInt(k.den) : 2n * BigInt(k.num) >= BigInt(k.den)) };
  const why = r.currentResult?.chips?.some((c) => c.code === 'sash-counted') ? ' (only at full HP: Focus Sash)' : r.currentResult?.chips?.some((c) => c.code === 'sturdy-counted') ? ' (only at full HP: Sturdy)' : '';
  const rows = r.levels.map((lv) => {
    if (r.current && ok[lv.key]?.(r.current)) return `<tr><th scope="row">${esc(label[lv.key])}</th><td colspan="2">Already, with your set as it is${esc(why)}</td></tr>`;
    const keep = lv.keep ? `${lv.keep.total} SP · ${esc(spText(lv.keep))} (${esc(P.name('natures', lv.keep.nature))})` : `can't with ${esc(P.name('natures', mySet?.nature))}, even with every free Stat Point`;
    const change = lv.change ? `<div class="small">or ${lv.change.total} SP · ${esc(spText(lv.change))} as ${natureCost(P, mySet, lv.change.nature, natureTradeoff(P.mech, mySet, lv.change.nature))} ${apply(lv.change)}</div>` : '';
    if (!lv.keep && !lv.change) return `<tr><th scope="row">${esc(label[lv.key])}</th><td colspan="2">can't, even with every free Stat Point</td></tr>`;
    return `<tr><th scope="row">${esc(label[lv.key])}</th><td>${keep}${change}</td><td>${lv.keep ? apply(lv.keep) : ''}</td></tr>`;
  }).join('');
  const hits = r.hits ?? 1;
  const bp = th.kind === 'ko' ? r.breakpoints.map((b) => `<p class="small">${esc(P.name('natures', b.nature))}: ${b.steps.map((s) => `${s.a} SP → ${koWords(s.ko, { hits }) ?? ''}`).join(' · ')}</p>`).join('') : '';
  return `${assumed}<p class="small">Free Stat Points to spend: ${r.budget}. Checked ${r.calls} spreads.${r.theirLabel ? ` Their side: ${esc(r.theirLabel)}.` : ''}</p>
    <div class="scroll"><table><tr><th>Safety</th><th>Cheapest</th><th></th></tr>${rows}</table></div>${bp}
    ${r.current ? `<p class="small">Your set now: ${esc(koWords(r.current, { hits }) ?? '')}.</p>` : ''}`;
}
function runThreshold(P, ws) {
  const th = P.wsUi(ws.id).th;
  const myL = P.lineage(th.mine);
  const theirL = th.their ? P.lineage(th.their, ws) : null;
  const mySet = asSet(myL, currentVersion(myL));
  const cond = th.cond ?? {};
  if (th.kind === 'outspeed') {
    const sp = theirL?.speciesId ?? th.theirSpecies;
    const data = theirL ? currentVersion(theirL).data : { sp: 'unknown', item: '' };
    const f = battleForme(P.mech, sp, data.item);
    const base = P.mech.species[f.error ? sp : f.id].baseStats.spe;
    const theirCond = { scarf: data.item === 'choicescarf', ironBall: data.item === 'ironball', tailwind: th.tailwindTheirs };
    let target, targetLabel;
    if (data.sp !== 'unknown' && data.nature) { target = speedOf(statValue('spe', base, data.sp.spe ?? 0, natureSign(P.mech.natures[data.nature], 'spe')), theirCond).speed; targetLabel = 'their set'; }
    else {
      // The worst case is their fastest legal Speed, or under Trick Room their slowest (you need to be slower still).
      const r = speedRange(base, theirCond);
      const worst = th.trickRoom ? r.min : r.max, easiest = th.trickRoom ? r.max : r.min;
      target = th.investment === 'frail' ? easiest : th.investment === 'common' ? r.neutralMax : worst;
      targetLabel = th.investment === 'max' ? (th.trickRoom ? 'slowest legal Speed (worst case under Trick Room)' : 'fastest legal Speed (worst case)') : th.investment === 'frail' ? (th.trickRoom ? 'fastest legal Speed' : 'slowest legal Speed') : 'neutral max';
    }
    const mf = battleForme(P.mech, myL.speciesId, mySet.item);
    const res = outspeedSearch(P.mech, mySet, mf.error ? myL.speciesId : mf.id, target, { scarf: mySet.item === 'choicescarf', ironBall: mySet.item === 'ironball', tailwind: th.tailwindMine }, { trickRoom: th.trickRoom });
    const assumed = [th.trickRoom && 'Trick Room', th.tailwindMine && 'your Tailwind', th.tailwindTheirs && 'their Tailwind', theirCond.scarf && 'their Choice Scarf', theirCond.ironBall && 'their Iron Ball'].filter(Boolean);
    th.result = { ...res, targetLabel, assumed, currentSp: mySet.sp === 'unknown' ? null : mySet.sp.spe ?? 0 };
    P.mutate(`ws:${ws.id}`, (d) => { d.speedChecks.push({ a: myL.speciesId, b: sp, at: P.now(), via: 'threshold' }); }, { substantive: false, render: false });
    return;
  }
  if (!P.calc) { P.toast('Loading the calculator…'); return; }
  if (!theirL) { th.result = { refused: 'their-set-missing' }; return; }
  const their = asSet(theirL, currentVersion(theirL));
  const g = (s) => ({ ...s, gender: s.cosmetic?.gender ?? '' });
  // the calc's conditions come along (both orientations match the calc they came from)
  const move = { id: th.move, state: cond.moveState ?? {}, hits: cond.hits ?? 0, firstHitOnly: !!cond.firstHitOnly };
  const sc = th.kind === 'survive'
    ? { attacker: { set: g(their), state: cond.aState ?? {} }, defender: { set: g(mySet), state: cond.dState ?? {} }, move, field: cond.field ?? {} }
    : { attacker: { set: g(mySet), state: cond.aState ?? {} }, defender: { set: g(their), state: cond.dState ?? {} }, move, field: cond.field ?? {} };
  const theirSide = th.kind === 'survive' ? 'attacker' : 'defender';
  let note = null, theirLabel = null;
  if (their.sp === 'unknown') {
    // the same spreads as the range view (shared with the calculator), so "max: worst case" means the same everywhere
    const cs = commonSpread(P.mech, P.app.usage()?.species?.[their.species]);
    let key = th.investment;
    if (key === 'common' && !cs) { key = 'max'; note = 'No ladder data for a common spread: showing max.'; }
    const spread = P.calc.spreadFor(sc, theirSide, key, { natureKnown: natureKnown(P, ws, { setId: theirL.id }), common: cs ? { ...cs, label: 'ladder' } : null });
    sc[theirSide].set.sp = spread.sp; sc[theirSide].set.nature = spread.nature;
    theirLabel = `${key === 'max' ? 'most invested legal spread (worst case)' : key === 'frail' ? 'no investment' : 'ladder spread'}, ${P.name('natures', spread.nature)}`;
  }
  // the survive search sizes your set from full HP, so its stated assumptions do too (and say what the calc had)
  if (th.kind === 'survive' && (sc.defender.state.hpPct ?? 100) < 100) {
    note = [note, `Your ${P.spName(sc.defender.set.species)} at full HP (the calc had ${sc.defender.state.hpPct}%).`].filter(Boolean).join(' ');
    sc.defender.state = { ...sc.defender.state, hpPct: 100 };
  }
  const now = P.calc.run(sc);
  const names = { attacker: P.spName(sc.attacker.set.species), defender: P.spName(sc.defender.set.species) };
  const assumed = now.class === 'exact' ? now.chips.filter((c) => !['move-not-in-set'].includes(c.code)).map((c) => C.chipText(c, names)) : [];
  const res = th.kind === 'survive' ? surviveSearch(P.calc, P.mech, sc, { includeCrit: th.crit }) : koSearch(P.calc, P.mech, sc);
  th.result = { ...res, assumed, note, theirLabel };
}

// ---------- speed ladder ----------
function speed(P, ws) {
  const ui = P.wsUi(ws.id);
  ui.sp ??= { tailwindMine: false, tailwindTheirs: false, trickRoom: false, icyWind: false, paraThem: false, sel: [] };
  const s = ui.sp;
  if (!P.mech) return `${h2('Speed')}<p>Calculating speeds…</p>`;
  const v = calcVariant(P, ws);
  const rows = [];
  const { mine } = sides(P, ws);
  for (const x of mine) {
    if (!x.l) continue;
    const set = asSet(x.l, currentVersion(x.l));
    if (set.sp === 'unknown' || !P.mech.natures[set.nature]) continue;
    for (const mega of [false, true]) {
      const f = battleForme(P.mech, x.species, set.item, { megaEvolved: mega });
      if (f.error || (mega && !f.mega)) continue;
      const raw = statValue('spe', P.mech.species[f.id].baseStats.spe, set.sp.spe ?? 0, natureSign(P.mech.natures[set.nature], 'spe'));
      const val = speedOf(raw, { tailwind: s.tailwindMine, scarf: set.item === 'choicescarf' && !mega, ironBall: set.item === 'ironball', ability: P.mech.species[f.id].abilities[0] && mega ? P.mech.species[f.id].abilities[0].toLowerCase().replace(/[^a-z0-9]/g, '') : set.ability }).speed;
      rows.push({ key: `m:${f.id}`, label: `${P.spName(f.id)}${mega ? ' (Mega)' : ''}`, side: 'mine', min: val, max: val, exact: true });
    }
  }
  for (const sp of P.rosterSpecies(ws)) {
    const l = theirSetFor(ws, v, sp);
    const data = l ? currentVersion(l).data : { item: '', sp: 'unknown', nature: '' };
    const src = l ? currentVersion(l).provenance?.sp?.source : null;
    // Their Mega is the hidden variable: unless their item is known (seen, on a sheet) and isn't a stone, every Mega form
    // they could have gets its own row.
    const itemSrc = l ? currentVersion(l).provenance?.item?.source : null;
    const itemSeen = ['sheet-open', 'seen-vs-me', 'seen-vs-others', 'fixed'].includes(itemSrc);
    const stones = Object.keys(P.mech.items).filter((i) => P.mech.items[i].megaStone?.[sp]);
    const megaItems = data.item && P.mech.items[data.item]?.megaStone ? [data.item] : itemSeen && data.item ? [] : stones;
    for (const { mega, item } of [{ mega: false, item: data.item }, ...megaItems.map((it) => ({ mega: true, item: it }))]) {
      const f = battleForme(P.mech, sp, item, { megaEvolved: mega });
      if (f.error || (mega && !f.mega)) continue;
      const base = P.mech.species[f.id].baseStats.spe;
      const cond = { tailwind: s.tailwindTheirs, scarf: item === 'choicescarf' && !mega, stage: s.icyWind ? -1 : 0, para: s.paraThem, ironBall: item === 'ironball' };
      const known = data.sp !== 'unknown' && data.nature && P.mech.natures[data.nature] ? { sp: data.sp.spe ?? 0, sign: natureSign(P.mech.natures[data.nature], 'spe') } : null;
      const r = speedRange(base, cond, known);
      rows.push({ key: `t:${f.id}`, label: `${P.spName(f.id)}${mega ? (item === data.item ? ' (Mega)' : ' (if it Mega Evolves)') : ''}${item === 'choicescarf' && !mega ? ' (Scarf)' : ''}`, side: 'theirs', min: r.min, max: r.max, exact: r.exact, note: r.exact ? `${C.SOURCE[src] ?? 'set'}` : 'range' });
    }
  }
  rows.sort((a, b) => (s.trickRoom ? a.max - b.max : b.max - a.max));
  const sel = s.sel.map((k) => rows.find((r) => r.key === k)).filter(Boolean);
  let sentence = '';
  if (sel.length === 2) {
    const [a, b] = sel;
    const c = compareSpeed(a.exact ? a.max : a, b.exact ? b.max : b, { trickRoom: s.trickRoom });
    sentence = c === 'tie' ? `${a.label} and ${b.label} tie: coin flip each turn.` : c === 'depends' ? `${a.label} vs ${b.label}: depends on Speed investment.` : `${c === 'first' ? a.label : b.label} moves before ${c === 'first' ? b.label : a.label} whatever the investment${s.trickRoom ? ' (Trick Room)' : ''}.`;
  }
  if (sentence && sentence !== s.lastSentence) { s.lastSentence = sentence; P.app.announce?.(sentence); }
  const guessed = rows.filter((r) => r.side === 'theirs' && r.exact && r.note === C.SOURCE['my-guess']).length;
  return `${btn('‹ Calcs', 'back', {}, { cls: 'back', aria: 'Back to Calcs' })}${h2(`Speed vs ${ws.coach}`)}
    <div class="choices" role="group" aria-label="Speed conditions">${chipBtn('Your Tailwind', 'sp-flag', { key: 'tailwindMine' }, s.tailwindMine)}${chipBtn('Their Tailwind', 'sp-flag', { key: 'tailwindTheirs' }, s.tailwindTheirs)}${chipBtn('Trick Room', 'sp-flag', { key: 'trickRoom' }, s.trickRoom)}${chipBtn('Icy Wind on them (−1)', 'sp-flag', { key: 'icyWind' }, s.icyWind)}${chipBtn('Paralysis on them', 'sp-flag', { key: 'paraThem' }, s.paraThem)}</div>
    ${ladder(rows, { trickRoom: s.trickRoom })}
    <p class="small">Tap two rows to compare: ${rows.map((r) => chipBtn(r.label, 'sp-sel', { key: r.key }, s.sel.includes(r.key))).join('')}</p>
    ${sentence ? `<p class="verdict">${esc(sentence)}</p>` : ''}
    ${guessed ? `<p class="small">⚠ ${esc(C.FLAG.F7({ count: guessed }))}</p>` : ''}
    <p class="small">Their rows are ranges from 0 Stat Points with a −Speed nature to 32 with +Speed unless their set has Stat Points. Mega Speed applies from the turn it Mega Evolves (Showdown behaviour). Priority, Quick Claw and Speed changes during the turn aren't included.</p>`;
}

export const views = { calcs: editor, compare: (P, ws) => compare(P, ws), threshold: (P, ws) => threshold(P, ws), speed: (P, ws) => speed(P, ws) };

// ---------- actions ----------
const ws_ = (P) => P.ws.get(P.route.wsId);
const cdOf = (P) => draftOf(P, ws_(P));
const touch = (P) => { const cd = cdOf(P); cd.result = null; cd.touched = true; P.wsUi(P.route.wsId).others = null; P.app.rerender(); };
export const actions = {
  // a new quick check starts empty; an unsaved one is never dropped silently (P.prefill asks first)
  'calc-new': (t, P) => { const ws = ws_(P); P.prefill(ws, 'cd', { a: null, d: null, move: '', crit: false, hits: 0, firstHitOnly: false, moveState: {}, field: {}, aState: {}, dState: {}, calcId: null, title: '' }, { view: 'ws', wsId: ws.id, kind: 'calcs', id: 'new' }); },
  'calc-open': (t, P) => P.go({ view: 'ws', wsId: P.route.wsId, kind: 'calcs', id: t.dataset.calc }, { push: true }),
  'calc-pick': (t, P) => { const cd = cdOf(P); cd[t.dataset.which] = { side: t.dataset.side, species: t.dataset.species, setId: t.dataset.set || null }; if (t.dataset.which === 'a') cd.move = ''; touch(P); },
  'calc-move': (t, P) => { cdOf(P).move = t.dataset.move; cdOf(P).hits = 0; cdOf(P).firstHitOnly = false; touch(P); },
  'calc-change-picks': (t, P) => { cdOf(P).picking = true; P.app.rerender(); },
  'calc-picks-done': (t, P) => { cdOf(P).picking = false; P.app.rerender(); },
  'calc-fill': (t, P) => {
    const ws = ws_(P), cd = cdOf(P), x = cd[t.dataset.which];
    if (!x) return;
    const id = x.side === 'theirs' ? addGuess(P, ws, x.species) : createMySet(P, x.species);
    if (!id) { if (!P.mech) P.toast('The Reg M-C data is still loading'); return; } // else the refusal already said why
    x.setId = id;
    P.toast(`${P.spName(x.species)}: started from ladder data. Check it in Sets when you can.`);
    touch(P);
  },
  'calc-toggle': (t, P) => {
    const cd = cdOf(P), { scope, key } = t.dataset;
    if (scope === 'field' && key === 'loneTarget') { cd.field.defenderSide ??= {}; cd.field.defenderSide.partnerPresent = cd.field.defenderSide.partnerPresent === false; }
    else if (scope === 'attackerSide' && key === 'noAlly') { cd.field.attackerSide ??= {}; cd.field.attackerSide.allyPresent = cd.field.attackerSide.allyPresent === false; }
    else if (scope === 'attackerSide' || scope === 'defenderSide') { cd.field[scope] ??= {}; cd.field[scope][key] = !cd.field[scope][key]; }
    else if (scope === 'field') cd.field[key] = !cd.field[key];
    else if (scope === 'dState' && key === 'disguiseBroken') cd.dState.disguiseIntact = cd.dState.disguiseIntact === false;
    else if (scope === 'moveState') cd.moveState[key] = !cd.moveState[key];
    else cd[scope][key] = !cd[scope][key];
    touch(P);
  },
  'calc-set': (t, P) => { const cd = cdOf(P), { scope, key } = t.dataset; let v = t.dataset.value; if (key === 'intimidated') v = Number(v); if (v === 'true' || v === 'false') v = v === 'true'; if (scope === 'field') cd.field[key] = v; else cd[scope][key] = v; touch(P); },
  'calc-toggle-crit': (t, P) => { cdOf(P).crit = !cdOf(P).crit; touch(P); },
  'calc-state': (t, P) => { const cd = cdOf(P); const v = t.dataset.value; const key = t.dataset.key; if (key === 'form') cd[t.dataset.side === 'attacker' ? 'aState' : 'dState'].form = v; else cd[t.dataset.side === 'defender' ? 'dState' : 'aState'][key] = Number(v); touch(P); },
  'calc-first-hit': (t, P) => { cdOf(P).firstHitOnly = true; touch(P); },
  'calc-retry-engine': (t, P) => { P.engineState = 'idle'; P.ensureEngine(); },
  'calc-save': (t, P) => {
    const ws = ws_(P), cd = cdOf(P);
    const sc = buildScenario(P, ws, cd);
    const res = cd.result ?? compute(P, ws, sc, { attacker: cd.a, defender: cd.d });
    if (!res) return;
    const e = entryFrom(P, ws, cd, res, sc);
    e.title = `${P.spName(sc.attacker.set.species)} ${P.name('moves', sc.move.id)} into ${P.spName(sc.defender.set.species)}`;
    e.parentId = cd.parentId ?? null;
    if (cd.slotFromCardId) e.slotFromCardId = cd.slotFromCardId;
    if (cd.slotKey) e.slotKey = cd.slotKey;
    P.mutate(`ws:${ws.id}`, (d) => { d.calcs.push(e); });
    attachKeys(P, ws.id, e.id);
    P.toast('Saved to the notebook');
    P.go({ view: 'ws', wsId: ws.id, kind: 'calcs', id: e.id }, { push: false });
  },
  'calc-update': (t, P) => {
    const ws = ws_(P), cd = cdOf(P), c = ws.calcs.find((x) => x.id === t.dataset.calc);
    const sc = buildScenario(P, ws, cd);
    const res = cd.result ?? compute(P, ws, sc, { attacker: cd.a, defender: cd.d });
    if (!res) return;
    const next = entryFrom(P, ws, cd, res, sc, c);
    next.lastDiff = { was: shortSummary(P, c.summary), now: shortSummary(P, next.summary), outcomeChanged: outcomeClass({ class: c.summary?.class, ko: c.summary?.ko }) !== outcomeClass({ class: next.summary.class, ko: next.summary.ko }), at: P.now() };
    P.mutate(`ws:${ws.id}`, (d) => { const i = d.calcs.findIndex((x) => x.id === c.id); d.calcs[i] = next; });
    attachKeys(P, ws.id, c.id);
    P.toast('Calc updated');
  },
  'calc-dup': (t, P) => { const cd = cdOf(P); const parent = cd.calcId; cd.calcId = null; cd.parentId = parent; cd.result = null; P.go({ view: 'ws', wsId: P.route.wsId, kind: 'calcs', id: 'new' }, { push: true }); P.toast('Copy: change one thing, then save'); },
  'calc-pin': (t, P) => P.mutate(`ws:${P.route.wsId}`, (d) => { const c = d.calcs.find((x) => x.id === t.dataset.calc); c.pinned = !c.pinned; }),
  'calc-mark': (t, P) => P.mutate(`ws:${P.route.wsId}`, (d) => { const c = d.calcs.find((x) => x.id === t.dataset.calc); c.mark = c.mark === t.dataset.mark ? null : t.dataset.mark; }),
  'calc-delete': (t, P) => { P.mutate(`ws:${P.route.wsId}`, (d) => { d.calcs = d.calcs.filter((x) => x.id !== t.dataset.calc); }); P.wsUi(P.route.wsId).cd = null; P.back(); P.toast('Calc deleted'); },
  'calc-diff-dismiss': (t, P) => P.mutate(`ws:${P.route.wsId}`, (d) => { d.calcs.find((x) => x.id === t.dataset.calc).lastDiff = null; }, { substantive: false }),
  'calc-recheck': (t, P) => { const ws = ws_(P); const c = ws.calcs.find((x) => x.id === t.dataset.calc); if (recheck(P, ws, c)) { P.wsUi(ws.id).cd = null; P.toast('Re-checked'); } },
  'calc-recheck-all': (t, P) => { const ws = ws_(P); let n = 0; for (const c of ws.calcs.filter((x) => P.staleOf(ws, x).length && !P.staleOf(ws, x).some((r) => r.code === 'set-deleted'))) if (recheck(P, P.ws.get(ws.id), c)) n++; if (n) P.toast(`Re-checked ${n} calc${n === 1 ? '' : 's'}`); },
  'calc-filter': (t, P) => { const f = P.wsUi(P.route.wsId).cf; f[t.dataset.f] = !f[t.dataset.f]; P.app.rerender(); },
  'calc-filter-clear': (t, P) => { P.wsUi(P.route.wsId).cf = null; P.app.rerender(); },
  'calc-copy': async (t, P) => {
    const ws = ws_(P), cd = cdOf(P), sc = buildScenario(P, ws, cd), res = cd.result;
    if (!sc || !res) return;
    const nm = names(P, ws, cd, sc);
    const r = res.result;
    const lines = [`${nm.attacker} (${nm.attackerSet}) ${P.name('moves', sc.move.id)} → ${nm.defender} (${nm.defenderSet})`];
    if (res.envelope) for (const e of res.envelope) lines.push(`${C.ENVELOPE_ROW[e.key]}: ${e.result.class === 'exact' ? `${e.result.range.min}–${e.result.range.max} of ${e.result.maxHP} HP, ${koWords(e.result.ko.one, { hits: hitsOf(e.result.move.dist) }) ?? C.CLASS.refused}` : C.CLASS[e.result.class]}`);
    else if (r.class === 'exact') lines.push(`${r.range.min}–${r.range.max} of ${r.maxHP} HP · ${koWords(r.ko.one, { hits: hitsOf(r.move.dist) }) ?? C.CLASS.refused}`);
    else lines.push(C.CLASS[r.class] ?? '');
    if (r.class === 'exact') lines.push(`Assumptions: ${r.chips.map((c) => C.chipText(c, nm)).join('; ')}`);
    lines.push(C.FOOTER);
    try { await P.app.copyText(lines.join('\n')); P.toast('Copied this calc as text'); } catch { P.toast("Couldn't copy"); }
  },
  'calc-others': (t, P) => {
    const ws = ws_(P), cd = cdOf(P);
    const which = cd.a?.side === 'theirs' ? 'a' : 'd';
    const sp = lineageFor(P, ws, cd[which])?.speciesId ?? cd[which]?.species;
    const out = [];
    for (const l of ws.theirSets.filter((s) => s.speciesId === sp)) {
      const alt = { ...cd, [which]: { side: 'theirs', species: sp, setId: l.id } };
      const sc = buildScenario(P, ws, alt);
      const res = compute(P, ws, sc, { attacker: alt.a, defender: alt.d });
      if (!res) continue;
      const roles = ws.variants.filter((v) => v.setIds[sp] === l.id).map((v) => C.VARIANT_ROLE[v.role]).join(', ');
      out.push({ label: `${l.name || 'Set'}${roles ? ` (${roles})` : ''}${res.envelope ? ', max investment' : ''}`, result: res.result, defName: P.spName(sc.defender.set.species) });
    }
    P.wsUi(ws.id).others = out;
    P.app.rerender();
  },
  'calc-compare': (t, P) => P.go({ view: 'ws', wsId: P.route.wsId, kind: 'compare' }, { push: true }),
  'cmp-promote': (t, P) => {
    const ws = ws_(P), x = P.wsUi(ws.id).cmp.extra.find((e) => e.label === t.dataset.label) ?? null;
    if (!x) return;
    const { species, ...data } = x.set;
    promote(P, ws, x.setId, data, 'from a compare candidate');
  },
  'go-speed': (t, P) => P.go({ view: 'ws', wsId: P.route.wsId, kind: 'speed' }, { push: true }),
  'go-threshold': (t, P) => P.go({ view: 'ws', wsId: P.route.wsId, kind: 'threshold' }, { push: true }),
  'go-threshold-from': (t, P) => {
    const ws = ws_(P), cd = cdOf(P);
    const mineA = cd.a?.side === 'mine';
    // the calc's field and states come along, so the answer is for the same situation (and says so)
    const cond = { field: structuredClone(cd.field ?? {}), aState: structuredClone(cd.aState ?? {}), dState: structuredClone(cd.dState ?? {}), moveState: structuredClone(cd.moveState ?? {}), hits: cd.hits ?? 0, firstHitOnly: !!cd.firstHitOnly };
    P.prefill(ws, 'th', { kind: mineA ? 'ko' : 'survive', mine: (mineA ? cd.a : cd.d)?.setId ?? null, their: (mineA ? cd.d : cd.a)?.setId ?? null, theirSpecies: (mineA ? cd.d : cd.a)?.species, move: cd.move, investment: 'max', crit: false, result: null, cond },
      { view: 'ws', wsId: ws.id, kind: 'threshold' });
  },
  'th-kind': (t, P) => { const th = P.wsUi(P.route.wsId).th; th.kind = t.dataset.kind; th.result = null; th.move = ''; P.app.rerender(); },
  'th-pick': (t, P) => { const th = P.wsUi(P.route.wsId).th; if (t.dataset.which === 'mine') th.mine = t.dataset.set; else { th.their = t.dataset.set || null; th.theirSpecies = t.dataset.species; } th.result = null; P.app.rerender(); },
  'th-move': (t, P) => { const th = P.wsUi(P.route.wsId).th; th.move = t.dataset.move; th.result = null; P.app.rerender(); },
  'th-inv': (t, P) => { const th = P.wsUi(P.route.wsId).th; th.investment = t.dataset.inv; th.result = null; P.app.rerender(); },
  'th-flag': (t, P) => { const th = P.wsUi(P.route.wsId).th; th[t.dataset.key] = !th[t.dataset.key]; th.result = null; P.app.rerender(); },
  'th-run': (t, P) => { runThreshold(P, ws_(P)); P.app.announce?.('What would it take: the answer is below'); P.app.rerender(); },
  'th-apply': (t, P) => {
    const ws = ws_(P), th = P.wsUi(ws.id).th, l = P.lineage(th.mine);
    promote(P, ws, l.id, thresholdData(P, l, t.dataset), `from "What would it take?" (${th.kind})`);
  },
  // Try a spread before saving: it becomes a candidate column in Compare, against every version of their team
  'th-compare': (t, P) => {
    const ws = ws_(P), ui = P.wsUi(ws.id), th = ui.th, l = P.lineage(th.mine);
    const mine = { side: 'mine', species: l.speciesId, setId: l.id };
    const theirs = { side: 'theirs', species: th.theirSpecies ?? P.lineage(th.their, ws)?.speciesId, setId: th.their };
    const c = th.cond ?? {};
    ui.cmp ??= { extra: [] };
    const label = `Try: ${t.dataset.label}`;
    if (!ui.cmp.extra.some((x) => x.label === label)) ui.cmp.extra = [...ui.cmp.extra, { label, set: { species: l.speciesId, ...thresholdData(P, l, t.dataset) }, setId: l.id, candidate: true }].slice(-3);
    // the comparison needs its own quick check; an unsaved one is never replaced silently (P.prefill asks first)
    P.prefill(ws, 'cd', { a: th.kind === 'survive' ? theirs : mine, d: th.kind === 'survive' ? mine : theirs, move: th.move, crit: false, hits: c.hits ?? 0, firstHitOnly: !!c.firstHitOnly,
      moveState: structuredClone(c.moveState ?? {}), field: structuredClone(c.field ?? {}), aState: structuredClone(c.aState ?? {}), dState: structuredClone(c.dState ?? {}), calcId: null }, { view: 'ws', wsId: ws.id, kind: 'compare' });
  },
  'sp-flag': (t, P) => { const s = P.wsUi(P.route.wsId).sp; s[t.dataset.key] = !s[t.dataset.key]; P.app.rerender(); },
  'sp-sel': (t, P) => {
    const s = P.wsUi(P.route.wsId).sp;
    s.sel = s.sel.includes(t.dataset.key) ? s.sel.filter((k) => k !== t.dataset.key) : [...s.sel, t.dataset.key].slice(-2);
    if (s.sel.length === 2) P.mutate(`ws:${P.route.wsId}`, (d) => { d.speedChecks.push({ a: s.sel[0], b: s.sel[1], at: P.now(), toggles: { tailwindMine: s.tailwindMine, tailwindTheirs: s.tailwindTheirs, trickRoom: s.trickRoom } }); }, { substantive: false });
    else P.app.rerender();
  },
};
/** Your set's data with a threshold option's Stat Points and nature applied. */
function thresholdData(P, l, d) {
  const cur = currentVersion(l).data;
  const sp = { ...cur.sp };
  if (d.hp !== undefined) { sp.hp = Number(d.hp); sp[d.stat] = Number(d.def); } else sp[d.stat] = Number(d.sp);
  return { ...cur, sp, nature: d.nature };
}
/** A new version of one of your sets (never an in-place edit); lists what goes out of date. */
function promote(P, ws, setId, data, reason) {
  const errs = checkSet(P.mech, { species: P.lineage(setId).speciesId, ...data }, { side: 'mine' }).filter((p) => p.severity === 'error');
  if (errs.length) { P.toast("That spread breaks the Stat Point limits with the rest of the set; adjust it in the set editor"); return; }
  P.mutate('mysets', (d) => { const i = d.sets.findIndex((s) => s.id === setId); d.sets[i] = addVersion(d.sets[i], data, { now: P.now(), reason }); });
  const n = [...P.ws.values()].reduce((t, w) => t + w.calcs.filter((c) => c.refs?.attacker?.setId === setId || c.refs?.defender?.setId === setId).length, 0);
  P.toast(`Saved v${P.lineage(setId).currentV}${n ? ` · ${n} calc${n === 1 ? ' uses' : 's use'} this set and ${n === 1 ? 'is' : 'are'} now out of date` : ''}`);
}
export const changes = {
  'calc-other-move': (t, P) => { if (t.value) { cdOf(P).move = t.value; touch(P); } },
  'calc-hp': (t, P) => { const v = Math.max(1, Math.min(100, Math.trunc(Number(t.value) || 100))); cdOf(P)[t.dataset.scope].hpPct = v; touch(P); },
  'calc-stage': (t, P) => { const cd = cdOf(P); cd[t.dataset.scope].boosts ??= {}; cd[t.dataset.scope].boosts[t.dataset.stat] = Number(t.value); touch(P); },
  'calc-status': (t, P) => { cdOf(P)[t.dataset.scope].status = t.value; touch(P); },
  'calc-hits': (t, P) => { cdOf(P).hits = Number(t.value); touch(P); },
};
export const inputs = {
  'calc-search': (t, P) => { (P.wsUi(P.route.wsId).cf ??= {}).q = t.value.slice(0, 80); P.app.rerender(); },
  'calc-title': (t, P) => P.mutate(`ws:${P.route.wsId}`, (d) => { const c = d.calcs.find((x) => x.id === P.route.id); if (c) c.title = t.value.slice(0, 120); }, { render: false }),
};
export { compute as computeScenario, buildScenario, summarize };

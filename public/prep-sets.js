// Sets: their sets (per-field sources, Stat Points as a range until you guess), versions of their team (Likely / Worst for
// me / Counter-prep / ideas), your library of sets, the set editor (immutable versions, drafts survive a reload), Showdown
// paste import (four tiers, every decision visible) and exact export.
import { checkSet, setStats, legalAbilities, learnset, battleForme, toID } from '../lib/calc/mech.mjs';
import { STAT_IDS, SP_PER_STAT, SP_TOTAL, spTotal, speedRange, natureSign, statValue } from '../lib/calc/stats.mjs';
import { parseTeam, exportSet, setKey } from '../lib/paste.mjs';
import { newLineage, addVersion, setCurrent, currentVersion, versionOf, asSet, provenanceAll, weakestSource, guessSet, commonSpread, cleanSetData, emptyCosmetic, seenByWho, pruneVersions, referencedVersions, SOURCE_RANK } from '../lib/prep-model.mjs';
import { SOURCES } from '../lib/prep-schema.mjs';
import * as C from './prep-copy.js';
import * as Teams from './prep-teams.js';
import { esc, attrs, btn, chipBtn, h2, select, sourceChip, term } from './prep-ui.js';

const THEIR_SOURCES = ['sheet-open', 'seen-vs-me', 'seen-vs-others', 'ladder', 'my-guess', 'counterprep-guess'];
const SP_SOURCES = ['seen-vs-me', 'seen-vs-others', 'ladder', 'my-guess', 'counterprep-guess'];

// ---------- helpers ----------
export function variantOf(P, ws) {
  const ui = P.wsUi(ws.id);
  return ws.variants.find((v) => v.id === ui.variantId) ?? ws.variants.find((v) => v.role === 'likely') ?? ws.variants[0] ?? null;
}
export function theirSetFor(ws, variant, speciesId) {
  const id = variant?.setIds?.[speciesId];
  return ws.theirSets.find((s) => s.id === id) ?? null;
}
const setLabel = (P, l) => (l ? `${l.name || 'Set'}${l.side === 'mine' ? ` v${l.currentV}` : ''}` : 'no set yet');
function problemsText(P, probs) {
  const errs = probs.filter((p) => p.severity === 'error');
  return errs.map((p) => ({
    'sp-over-stat': `${C.STAT_LONG[p.stat]}: 32 is the most one stat can take.`, 'sp-over-total': `${p.total} of 66 Stat Points: ${p.total - 66} too many.`,
    'sp-negative': 'Stat Points can\'t be below zero.', 'sp-not-integer': 'Stat Points must be whole numbers.',
    'item-not-in-regulation': `${P.name('items', p.value) || p.value} isn't available in Champions.`, 'mega-stone-mismatch': 'That Mega Stone belongs to another Pokémon.',
    'ability-missing': 'Choose an ability.', 'ability-not-legal': "That ability isn't available to this Pokémon.", 'nature-missing': 'Choose a nature.',
    'move-not-in-regulation': `${p.value} isn't available in Champions.`, 'move-not-learnable': `Can't learn ${P.name('moves', p.value)} in Champions.`,
    'move-duplicate': 'The same move twice.', 'moves-empty': 'Add at least one move.', 'species-not-in-regulation': "Not in the Reg M-C list.",
  }[p.code] ?? p.code));
}
/** Stats line from the one stat function (no engine). */
function statsLine(P, data, speciesId) {
  if (!P.mech) return '<p class="small muted">Calculating stats…</p>';
  // a Pokémon missing from this regulation's data (an older file, a rule change) still opens, so it can be fixed or deleted
  if (!P.mech.species[speciesId]) return '<p class="small">Not in this regulation\'s data: no stats. Delete this set or keep it for reference.</p>';
  if (data.sp === 'unknown') {
    const f = battleForme(P.mech, speciesId, data.item);
    const base = P.mech.species[f.error ? speciesId : f.id].baseStats.spe;
    const r = speedRange(base, { scarf: data.item === 'choicescarf' }, data.nature && P.mech.natures[data.nature] ? null : null);
    return `<p class="small">Stat Points unknown: shown as a range. Speed ${r.min}–${r.max}${data.item === 'choicescarf' ? ' (with Scarf)' : ''}.</p>`;
  }
  const st = setStats(P.mech, { species: speciesId, ...data }, { megaEvolved: false });
  if (!st) return '';
  const mega = setStats(P.mech, { species: speciesId, ...data }, { megaEvolved: true });
  const line = (s) => STAT_IDS.map((k) => `${C.STAT_SHORT[k]} ${s[k]}`).join(' · ');
  return `<p class="small">Stats at Lv 50: ${line(st)}</p>${mega && JSON.stringify(mega) !== JSON.stringify(st) ? `<p class="small">After Mega Evolution: ${line(mega)}</p>` : ''}`;
}
export function spMeter(sp) {
  if (sp === 'unknown') return '';
  const t = spTotal(sp);
  const over = t > SP_TOTAL;
  return `<p class="spmeter${over ? ' over' : ''}">${t} of ${SP_TOTAL} used${over ? `: ${t - SP_TOTAL} too many. Calcs and export are off for this set until it's fixed.` : ` · ${SP_TOTAL - t} left`}</p>`;
}

// ---------- Sets tab ----------
// ---------- the team grid (UX §3): portraits with a set ring, the source in words underneath ----------
const RING_STYLE = { mine: 'solid', 'sheet-open': 'solid', 'seen-vs-me': 'solid', 'seen-vs-others': 'solid', fixed: 'solid', ladder: 'dashed', 'my-guess': 'dotted', 'counterprep-guess': 'dotted' };
const RING_FIELDS = ['item', 'ability', 'moves', 'sp'];
/** Each field's source on a set version: {item, ability, moves (the weakest of its moves), sp}; null = unknown. */
export function fieldSources(cur, side = 'theirs') {
  if (!cur) return { item: null, ability: null, moves: null, sp: null };
  const prov = cur.provenance ?? {}, data = cur.data;
  // your own set is yours: every filled field is known (shown solid, said "yours")
  if (side === 'mine') return { item: data.item ? 'mine' : null, ability: data.ability ? 'mine' : null, moves: (data.moves ?? []).some(Boolean) ? 'mine' : null, sp: data.sp === 'unknown' ? null : 'mine' };
  const one = (f) => (data[f] ? prov[f]?.source ?? null : null);
  const moves = (data.moves ?? []).map((m, i) => (m ? prov.moves?.[i]?.source ?? null : null)).filter(Boolean);
  return { item: one('item'), ability: one('ability'), moves: moves.length ? moves.sort((x, y) => (SOURCE_RANK[x] ?? 0) - (SOURCE_RANK[y] ?? 0))[0] : null,
    sp: data.sp === 'unknown' ? null : prov.sp?.source ?? null };
}
/** A portrait inside its set ring: each quarter is one field, styled by its source (gap = unknown). Words carry the meaning. */
export function setRing(P, sp, cur, side, size = 'md') {
  const src = fieldSources(cur, side);
  const cls = RING_FIELDS.map((f) => `r-${f}-${src[f] ? RING_STYLE[src[f]] ?? 'dotted' : 'gap'}`).join(' ');
  return `<span class="sring ${side} ${cls}" aria-hidden="true">${P.pt(sp, { size })}</span>`;
}
const ringSay = (cur, side = 'theirs') => { const src = fieldSources(cur, side); return RING_FIELDS.map((f) => `${C.SETGRID.field[f]}: ${src[f] ? (src[f] === 'mine' ? C.SETGRID.yours : C.SOURCE[src[f]]) : C.SETGRID.unknown}`).join('; '); };

export function tab(P, ws) {
  const v = variantOf(P, ws);
  const roster = P.rosterSpecies(ws);
  const diff = P.rosterDiffOf(ws);
  const tiles = roster.map((sp) => {
    const l = theirSetFor(ws, v, sp);
    const others = ws.theirSets.filter((s) => s.speciesId === sp && s.id !== l?.id).length;
    const cur = l ? currentVersion(l) : null;
    const weak = cur ? weakestSource(cur.provenance, cur.data) : null;
    const word = l ? (weak ? C.SOURCE[weak] : C.SETGRID.unknown) : C.SETGRID.noSet;
    const label = `${P.spName(sp)}: ${l ? `${setLabel(P, l)}. ${ringSay(cur)}` : C.SETGRID.noSetSay}`;
    return `<li class="settile${l ? '' : ' none'}${diff.removed.includes(sp) ? ' removed' : ''}"><button${attrs({ type: 'button', class: 'st-btn', 'data-pa': l ? 'open-their-set' : 'guess-one', 'data-set': l?.id ?? '', 'data-species': sp, 'aria-label': label })}>${setRing(P, sp, cur, 'theirs')}<span class="st-name">${esc(P.spName(sp))}</span></button>
      <span class="st-src small">${weak ? sourceChip(weak) : `<span class="chip">${esc(word)}</span>`}</span>${others ? `<span class="small muted">+${others} other set${others === 1 ? '' : 's'}</span>` : ''}${diff.removed.includes(sp) ? '<span class="chip unc">No longer on their roster</span>' : ''}</li>`;
  }).join('');
  const removedSets = ws.theirSets.filter((s) => !roster.includes(s.speciesId));
  const vchips = ws.variants.map((x) => chipBtn(`${C.SETGRID.roleIcon[x.role] ?? ''} ${C.VARIANT_ROLE[x.role]}${x.name ? `: ${x.name}` : ''}`.trim(), 'pick-variant', { variant: x.id }, x.id === v?.id)).join('');
  // with teams: which team it brings is the primary control; your 10 one by one (ticking one puts it in that team) folds away
  const bringHtml = Teams.bring(P, ws);
  const my6 = bringHtml ? `${bringHtml}<details class="tm-onebyone"><summary>${esc(C.TEAMS.oneByOne)}</summary>${myTeamRows(P, ws)}</details>` : myTeamRows(P, ws);
  const mega = roster.filter((sp) => P.mech && Object.values(P.mech.items).some((i) => i.megaStone?.[sp]));
  return `${h2('Sets')}
    <h3>Their team</h3><p class="small">One ${term('set', 'Set')} per Pokémon in each version of their team.</p>
    ${roster.length ? '' : '<p>No roster for this coach yet.</p>'}
    <div class="choices" role="group" aria-label="Versions of their team">${vchips}${btn('+ New version', 'variant-new')}</div>
    ${v ? `<p class="small">${esc(C.VARIANT_ROLE_HELP[v.role])}${v.whyBuilt ? ` Why: ${esc(v.whyBuilt)}` : ''} ${btn('Edit', 'open-variant', { variant: v.id })}</p>` : '<p class="small">Start from labelled ladder guesses or paste a team you have seen. Guesses are labelled "Ladder", never shown as their set.</p>'}
    ${ws.variants.length > 3 ? `<p class="small muted">You have ${ws.variants.length} versions. Keep the ones that change one of your decisions.</p>` : ''}
    ${roster.length ? `<p class="small muted ringkey">${esc(C.SETGRID.key)}</p>` : ''}
    <ul class="setgrid">${tiles}</ul>
    ${removedSets.length ? `<p class="small">Kept for Pokémon no longer on their roster: ${removedSets.map((s) => esc(P.spName(s.speciesId))).join(', ')}.</p>` : ''}
    ${mega.length > 1 ? `<p class="small">${mega.length} of their Pokémon can Mega Evolve; only one can per battle.</p>` : ''}
    <div class="actions">${btn('Start from guesses', 'guess-all', {}, { primary: !ws.theirSets.length })} ${btn('Paste a team', 'go-import')} ${btn('Export…', 'go-export')}</div>
    <h3>Your sets for this match</h3>${my6}
    <p>${btn('Paste your team', 'go-import', { side: 'mine' }, { cls: 'linkish' })}</p>
    <div class="bottombar">${btn('Paste a team', 'go-import')}${btn('Export…', 'go-export')}</div>`;
}
function myTeamRows(P, ws) {
  const me = P.myCoach();
  const myRoster = P.coachRoster(me).filter((id) => !P.mech || (P.mech.species[id] && !P.mech.species[id].mega));
  const lib = P.mineSets();
  const inSix = new Set(ws.my6.map((m) => m.setId));
  if (!P.canWriteMine()) return `<p class="small">🔒 ${esc(C.POV.mineViewing(me))}</p>`;
  const rule = P.docs.rules.rules.sixPerMatch?.value;
  const tiles = myRoster.map((sp) => {
    const sets = lib.filter((s) => s.speciesId === sp);
    if (!sets.length) return `<li class="settile none mine"><span class="st-btn static">${setRing(P, sp, null, 'mine')}<span class="st-name">${esc(P.spName(sp))}</span></span><span class="small muted">${esc(C.SETGRID.noSet)}</span> ${btn('Create set', 'my-create', { species: sp })}</li>`;
    const chosen = sets.find((s) => inSix.has(s.id)) ?? sets[0];
    const cur = currentVersion(chosen);
    return `<li class="settile mine${sets.some((s) => inSix.has(s.id)) ? ' in6' : ''}"><span class="st-btn static" role="img" aria-label="${esc(`${P.spName(sp)}: ${ringSay(cur, 'mine')}`)}">${setRing(P, sp, cur, 'mine')}<span class="st-name">${esc(P.spName(sp))}</span>${sets.some((s) => inSix.has(s.id)) ? `<span class="st-six" aria-hidden="true">✓</span>` : ''}</span>
      <span class="st-sets">${sets.map((s) => chipBtn(`${s.name || 'Set'} v${s.currentV}${seenByWho(s).length ? ` · 👁 seen by ${seenByWho(s).length}` : ''}`, 'toggle-six', { set: s.id }, inSix.has(s.id))).join('')}</span> ${btn('Edit', 'open-my-set', { set: chosen.id }, { cls: 'linkish' })}</li>`;
  }).join('');
  const items = ws.my6.map((m) => P.lineage(m.setId)).filter(Boolean).map((l) => currentVersion(l).data.item).filter(Boolean);
  const dupItem = items.find((it, i) => items.indexOf(it) !== i);
  return `<p class="small">${ws.my6.length} of 6 chosen${rule === 'unknown' || !rule ? ' (your 6 for the whole set while that rule is "don\'t know")' : ''}.${ws.my6.length > 6 ? ' Showdown teams have 6; keep the extra ones as alternatives.' : ''}</p>
    ${dupItem ? `<p class="banner warn">${esc(C.TEAM_WARNING['item-clause']({ name: P.name('items', dupItem) }))}</p>` : ''}
    <ul class="setgrid">${tiles || '<li>No roster found for you on the sheet.</li>'}</ul>`;
}

// ---------- set editor (theirs and mine) ----------
function draftOf(P, ws, l) {
  const store = ws ? ws.drafts : P.docs.mysets.drafts;
  const d = store?.[l.id];
  const cur = currentVersion(l);
  return d ? { ...d, restored: true } : { name: l.name, data: structuredClone(cur.data), provenance: structuredClone(cur.provenance ?? null), restored: false };
}
function editor(P, ws, l) {
  const mine = l.side === 'mine';
  const d = draftOf(P, ws, l);
  (P.ui.editorOpenedAt ??= {})[l.id] ??= P.now(); // a draft older than this is "restored", a newer one is just unsaved
  const data = d.data, prov = d.provenance ?? {};
  const sp = l.speciesId;
  const probs = P.mech ? checkSet(P.mech, { species: sp, ...data }, { side: l.side }) : [];
  const errs = problemsText(P, probs);
  const learn = P.mech ? learnset(P.mech, sp) : data.moves;
  const items = P.mech ? Object.keys(P.mech.items).filter((i) => !P.mech.items[i].megaStone || P.mech.items[i].megaStone[sp]).sort((a, b) => P.name('items', a).localeCompare(P.name('items', b))) : [data.item];
  const abil = P.mech ? legalAbilities(P.mech, sp) : [data.ability];
  const natures = P.mech ? Object.keys(P.mech.natures).sort() : [data.nature];
  const srcSel = (field, i, list = THEIR_SOURCES) => (mine ? '' : select(`src-${field}${i ?? ''}`, [['', 'Source…'], ...list.map((s) => [s, C.SOURCE[s]])], field === 'moves' ? prov.moves?.[i]?.source ?? '' : prov[field]?.source ?? '', { data: { pc: 'set-source', set: l.id, field, i: i ?? '' }, cls: 'srcsel', aria: `Source of ${field === 'moves' ? `move ${i + 1}` : field === 'sp' ? 'Stat Points' : field}` }));
  const fieldRow = (label, id, opts, value, field) => `<div class="frow">${select(id, opts, value, { label, data: { pc: 'set-field', set: l.id, field } })}${srcSel(field)}${!mine && prov[field]?.source ? sourceChip(prov[field].source) : ''}</div>`;
  const moveRows = [0, 1, 2, 3].map((i) => `<div class="frow">${select(`mv-${i}`, [['', '—'], ...learn.map((m) => [m, P.name('moves', m)])], data.moves[i] ?? '', { label: `Move ${i + 1}`, data: { pc: 'set-move', set: l.id, i } })}${srcSel('moves', i)}${!mine && prov.moves?.[i]?.source ? sourceChip(prov.moves[i].source) : ''}</div>`).join('');
  const spBlock = data.sp === 'unknown'
    ? `<p>Stat Points: unknown, shown as a range ${term('Range (their investment)')}</p>${btn('Enter a guess', 'sp-guess', { set: l.id })}`
    : `<div class="sp-grid">${STAT_IDS.map((s) => `<div class="sp-cell"><label for="sp-${s}">${C.STAT_SHORT[s]}</label>${btn('−', 'sp-step', { set: l.id, stat: s, d: -1 }, { aria: `${C.STAT_LONG[s]} minus one`, cls: 'spstep' })}<input id="sp-${s}" type="number" inputmode="numeric" min="0" max="32" step="1" value="${esc(data.sp[s])}" data-pc="sp-value" data-set="${esc(l.id)}" data-stat="${s}">${btn('+', 'sp-step', { set: l.id, stat: s, d: 1 }, { aria: `${C.STAT_LONG[s]} plus one`, cls: 'spstep' })}${data.sp[s] > SP_PER_STAT ? `<span class="ferr">${esc(`32 is the most one stat can take`)}</span>` : ''}</div>`).join('')}</div>
       ${spMeter(data.sp)}${!mine ? `<div class="frow">${srcSel('sp', undefined, SP_SOURCES)}${prov.sp?.source ? sourceChip(prov.sp.source) : ''} ${btn('Back to unknown', 'sp-unknown', { set: l.id })}</div>` : ''}`;
  const uses = ws ? ws.calcs.filter((c) => c.refs?.attacker?.setId === l.id || c.refs?.defender?.setId === l.id).length : [...P.ws.values()].reduce((t, w) => t + w.calcs.filter((c) => c.refs?.attacker?.setId === l.id || c.refs?.defender?.setId === l.id).length, 0);
  const otherWs = mine ? [...P.ws.values()].filter((w) => w.my6.some((m) => m.setId === l.id)) : [];
  const history = l.versions.slice().reverse().map((v) => `<li>v${v.v} · ${esc(v.at.slice(0, 10))} · ${esc(v.reason ?? '')}${v.v === l.currentV ? ' <b>current</b>' : ` ${btn('Use this version', 'set-revert', { set: l.id, v: v.v }, { cls: 'linkish' })}`}</li>`).join('');
  const dirty = d.restored;
  const seen = mine ? (l.revealedTo ?? []) : [];
  return `${btn(mine && !ws ? '‹ My sets' : '‹ Sets', 'back', {}, { cls: 'back', aria: 'Back' })}${h2(`${P.spName(sp)} · ${mine ? 'your set' : 'their set'}`)}
    ${mine ? revisionPrompt(P, l) : ''}
    ${dirty ? `<p class="banner info">${d.at && d.at < (P.ui.editorOpenedAt?.[l.id] ?? '') ? 'Restored unsaved changes from earlier.' : 'Unsaved changes.'} ${btn('Save version', 'set-save', { set: l.id }, { primary: true })} ${btn('Discard', 'set-discard', { set: l.id })}</p>` : ''}
    <label class="field" for="set-name"><span>Name</span><input id="set-name" data-pi="set-name" data-set="${esc(l.id)}" value="${esc(d.name ?? '')}" maxlength="60"></label>
    ${fieldRow('Item', 'set-item', [['', 'No item'], ...items.map((i) => [i, P.name('items', i)])], data.item, 'item')}
    ${fieldRow('Ability', 'set-ability', [['', 'Choose…'], ...abil.map((a) => [a, P.name('abilities', a)])], data.ability, 'ability')}
    ${fieldRow('Nature', 'set-nature', [['', 'Choose…'], ...natures.map((n) => { const x = P.mech?.natures[n]; return [n, x ? `${x.name}${x.plus && x.plus !== x.minus ? ` (+${C.STAT_SHORT[x.plus]} −${C.STAT_SHORT[x.minus]})` : ''}` : n]; })], data.nature, 'nature')}
    ${moveRows}
    <h3>Stat Points</h3>${spBlock}
    ${statsLine(P, data, sp)}
    ${errs.length ? `<ul class="ferrs" role="alert">${errs.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}
    ${probs.some((p) => p.code === 'sp-zero-serious') ? '<p class="small">0 Stat Points with Serious nature: Showdown rejects that; export uses Hardy.</p>' : ''}
    <label class="field" for="set-notes"><span>Notes</span><textarea id="set-notes" rows="2" data-pi="set-notes" data-set="${esc(l.id)}">${esc(d.notes ?? l.notes ?? '')}</textarea></label>
    <p class="small">Used by: ${uses} calc${uses === 1 ? '' : 's'}${otherWs.length ? ` · your 6 vs ${otherWs.map((w) => esc(w.coach)).join(', ')}` : ''}</p>
    ${mine && seen.length ? `<p class="small">Seen by: ${seen.map((e) => `${esc(e.who.replace(/^partner:/, 'partner '))} (${esc(e.where ?? '')})`).join('; ')}</p>` : ''}
    <div class="actions">${btn('Save version', 'set-save', { set: l.id }, { primary: true })} ${mine ? btn('Save as a new set', 'set-save-copy', { set: l.id }) : ''} ${btn('Discard changes', 'set-discard', { set: l.id })}</div>
    ${otherWs.length > 1 ? `<p class="small">Saving changes this set everywhere it is used (${otherWs.length} opponents); dependent calcs go out of date. Save as a new set to change it for one opponent only.</p>` : ''}
    <details><summary>History (${l.versions.length})</summary><ul class="small">${history}</ul></details>
    <p>${btn('Copy as Showdown text', 'set-copy', { set: l.id })} ${btn(mine ? 'Delete this set' : 'Delete this set', 'set-delete', { set: l.id })}</p>`;
}

// ---------- my sets ----------
export function mySets(P, r) {
  if (r.kind === 'import') return importScreen(P, null);
  if (r.id) {
    const l = P.docs.mysets.sets.find((s) => s.id === r.id);
    if (!l) return `<section class="panel">${h2('Not on this device')}<p>${esc(C.NOT_ON_DEVICE)}</p>${btn('My sets', 'go-mysets')}</section>`;
    return `<section class="panel prep-set">${editor(P, null, l)}</section>`;
  }
  const me = P.myCoach();
  const roster = P.coachRoster(me);
  const bySp = new Map();
  for (const s of P.docs.mysets.sets) bySp.set(s.speciesId, [...(bySp.get(s.speciesId) ?? []), s]);
  const species = [...new Set([...roster.filter((id) => !P.mech || (P.mech.species[id] && !P.mech.species[id].mega)), ...bySp.keys()])];
  return `<section class="panel prep-mysets">${btn('‹ Prep', 'go-home', {}, { cls: 'back', aria: 'Back to Prep home' })}${h2('My sets')}
    <p class="small">Your sets are shared by every opponent's prep. Changing one creates a new version; calcs that used the old one show as out of date.</p>
    <p>${btn('Paste your team', 'go-mysets-import', {}, { primary: !P.docs.mysets.sets.length })}</p>
    <ul class="setrows">${species.map((sp) => `<li class="setrow"><b>${esc(P.spName(sp))}</b> ${(bySp.get(sp) ?? []).map((s) => btn(`${s.name || 'Set'} v${s.currentV}`, 'open-my-set', { set: s.id }, { cls: 'linkish' })).join(' ')} ${btn('+ Set', 'my-create', { species: sp })}${roster.includes(sp) ? '' : ' <span class="small muted">not on your roster</span>'}</li>`).join('')}</ul></section>`;
}

// ---------- variant editor ----------
function variantEditor(P, ws, r) {
  const v = ws.variants.find((x) => x.id === r.id);
  if (!v) return `${h2('Not found')}<p>${esc(C.NOT_ON_DEVICE)}</p>`;
  const roster = P.rosterSpecies(ws);
  return `${btn('‹ Sets', 'back', {}, { cls: 'back', aria: 'Back' })}${h2(`${C.VARIANT_ROLE[v.role]} version`)}
    <div class="choices" role="group" aria-label="Role">${Object.keys(C.VARIANT_ROLE).map((k) => chipBtn(C.VARIANT_ROLE[k], 'variant-role', { variant: v.id, role: k }, v.role === k)).join('')}</div>
    <p class="small">${esc(C.VARIANT_ROLE_HELP[v.role])}</p>
    <label class="field" for="var-name"><span>Name (optional)</span><input id="var-name" data-pi="variant-name" data-variant="${esc(v.id)}" value="${esc(v.name ?? '')}" maxlength="40"></label>
    <label class="field" for="var-why"><span>Which of your decisions changes if they run this?</span><input id="var-why" data-pi="variant-why" data-variant="${esc(v.id)}" value="${esc(v.whyBuilt ?? '')}" maxlength="200"></label>
    <ul class="setrows">${roster.map((sp) => {
      const sets = ws.theirSets.filter((s) => s.speciesId === sp);
      return `<li class="setrow">${esc(P.spName(sp))} ${select(`var-${sp}`, [['', 'no set'], ...sets.map((s) => [s.id, s.name || 'Set'])], v.setIds[sp] ?? '', { data: { pc: 'variant-set', variant: v.id, species: sp } })} ${btn('+ New set', 'guess-one', { species: sp, variant: v.id, fresh: '1' }, { cls: 'linkish' })}</li>`;
    }).join('')}</ul>
    <p>${btn('Duplicate this version', 'variant-dup', { variant: v.id })} ${btn('Delete this version', 'variant-delete', { variant: v.id })}</p>`;
}

// ---------- import ----------
function importScreen(P, ws) {
  const ui = ws ? P.wsUi(ws.id) : (P.ui.mineImport ??= {});
  ui.imp ??= { text: '', side: ws ? 'theirs' : 'mine', source: 'my-guess', note: '', answers: {}, result: null, dup: {} };
  const imp = ui.imp;
  const canRead = !!P.app.readClipboard;
  const head = `${btn(ws ? '‹ Sets' : '‹ My sets', 'back', {}, { cls: 'back', aria: 'Back' })}${h2('Paste a team')}
    <p class="small">Paste text from Showdown (Import/Export) or a team page. Links aren't fetched: open the link, copy the team text and paste it here.</p>
    <label class="field" for="paste-text"><span>Team text</span><textarea id="paste-text" class="paste" rows="8" data-pi="paste-text" spellcheck="false" autocapitalize="off">${esc(imp.text)}</textarea></label>
    <p>${canRead ? btn('Paste from clipboard', 'paste-clipboard') : ''} ${ws ? `<span class="small">Whose sets?</span> ${chipBtn(`${ws.coach}'s`, 'paste-side', { side: 'theirs' }, imp.side === 'theirs')}${P.canWriteMine() ? chipBtn('Mine', 'paste-side', { side: 'mine' }, imp.side === 'mine') : ''}` : ''} ${btn('Check paste', 'paste-check', {}, { primary: true })}</p>`;
  if (!imp.result) return `<section class="panel">${head}</section>`;
  const res = imp.result;
  if (res.rejected) return `<section class="panel">${head}<p class="banner bad" role="alert">${esc(C.PASTE_REJECT[res.rejected.code] ?? C.PASTE_REJECT['paste-empty'])}</p></section>`;
  const counts = { ready: 0, 'needs-answer': 0, rejected: 0 };
  for (const s of res.sets) counts[s.status]++;
  const sets = res.sets.map((s) => {
    const lines = s.lines.map((l) => {
      const msg = typeof C.PASTE[l.code] === 'function' ? C.PASTE[l.code](l) : '';
      const q = l.question;
      const qhtml = q ? `<div class="choices" role="group" aria-label="${esc(msg || 'Choose')}">${q.options.map((o) => chipBtn(`${C.PASTE_OPTION_FOR[q.key]?.[o] ?? C.PASTE_OPTION[o] ??(P.mech?.species[o] ? P.spName(o) : P.mech?.abilities[o] ? P.name('abilities', o) : o)}${o === q.suggested ? ' (suggested)' : ''}`, 'paste-answer', { set: s.index, key: q.key, value: o }, q.answer === o)).join('')}</div>` : '';
      return `<li class="tier${l.tier}"><code>${esc(l.text)}</code>${l.tier ? ` <span class="tierword">${esc(l.code === 'skipped' ? 'skipped (your choice)' : C.PASTE_TIER[l.tier])}</span>` : ''}${msg ? ` <span class="small">${esc(msg)}</span>` : ''}${qhtml}</li>`;
    });
    const existing = s.draft?.species ? (imp.side === 'mine' ? P.docs.mysets.sets : ws?.theirSets ?? []).filter((x) => x.speciesId === s.draft.species) : [];
    const dup = existing.length ? `<p class="small">Same Pokémon already has a set: ${chipBtn('New set', 'paste-dup', { set: s.index, value: 'new' }, (imp.dup[s.index] ?? 'new') === 'new')}${existing.map((x) => chipBtn(`New version of ${x.name || 'Set'}`, 'paste-dup', { set: s.index, value: x.id }, imp.dup[s.index] === x.id)).join('')}</p>` : '';
    const skipped = s.lines.some((l) => l.code === 'skipped');
    return `<div class="pset ${s.status}"><p class="pset-head"><b>${esc(s.header)}</b> <span class="small">${esc(skipped ? 'skipped' : { ready: 'ready', 'needs-answer': 'needs a choice', rejected: "can't import" }[s.status])}</span></p>${s.status === 'ready' ? `<ul class="plines">${lines.filter((x, k) => s.lines[k].tier).join('')}</ul><details class="small"><summary>Show lines</summary><ul class="plines">${lines.join('')}</ul></details>` : `<ul class="plines">${lines.join('')}</ul>`}${s.status !== 'rejected' ? dup : ''}</div>`;
  }).join('');
  const tw = res.teamWarnings.map((w) => `<p class="small warnline">${esc((C.TEAM_WARNING[w.code] ?? (() => w.code))({ ...w, name: P.name('items', w.value) || w.value }))}</p>`).join('');
  const srcs = imp.side === 'theirs' ? `<p><span class="small">Where are these from?</span> ${['seen-vs-me', 'seen-vs-others', 'sheet-open', 'my-guess'].map((s) => chipBtn(C.SOURCE[s], 'paste-source', { source: s }, imp.source === s)).join('')}</p>
    <label class="field" for="paste-note"><span>Details (optional)</span><input id="paste-note" data-pi="paste-note" value="${esc(imp.note)}" maxlength="120"></label>` : '';
  return `<section class="panel prep-import">${head}<p><b>${res.sets.length} sets found: ${counts.ready} ready · ${counts['needs-answer']} need a choice · ${counts.rejected} can't import</b></p>${tw}${sets}${srcs}
    <p>${btn(`Import ${counts.ready} set${counts.ready === 1 ? '' : 's'}`, 'paste-import', {}, { primary: true, disabled: !counts.ready })}</p></section>`;
}

// ---------- export ----------
function exportScreen(P, ws) {
  const ui = P.wsUi(ws.id);
  ui.exp ??= { what: 'variant', spChoice: 'common' };
  const v = variantOf(P, ws);
  let sets = [];
  if (ui.exp.what === 'variant') sets = P.rosterSpecies(ws).map((sp) => ({ sp, l: theirSetFor(ws, v, sp) }));
  else sets = ws.my6.map((m) => ({ l: P.lineage(m.setId), sp: P.lineage(m.setId)?.speciesId }));
  const warns = [];
  const usable = [];
  for (const { sp, l } of sets) {
    if (!l) { warns.push(C.EXPORT_WARN['no-set']({ name: P.spName(sp) })); continue; }
    const s = asSet(l, currentVersion(l));
    const errs = P.mech ? checkSet(P.mech, s, { side: l.side }).filter((p) => p.severity === 'error') : [];
    if (errs.length) {
      const missing = errs.every((p) => /-missing$/.test(p.code)) ? errs.map((p) => ({ 'ability-missing': 'an ability', 'nature-missing': 'a nature' }[p.code] ?? 'a field')).join(' and ') : null;
      warns.push(C.EXPORT_WARN.invalid({ name: P.spName(sp), missing }));
      continue;
    }
    usable.push({ l, s });
  }
  const unknown = usable.filter((u) => u.s.sp === 'unknown').length;
  const guessed = usable.filter((u) => u.l.side === 'theirs' && ['ladder', 'my-guess', 'counterprep-guess'].includes(weakestSource(currentVersion(u.l).provenance, u.s))).length;
  if (unknown) warns.unshift(C.EXPORT_WARN['unknown-sp']({ count: unknown }));
  if (guessed) warns.push(C.EXPORT_WARN['guessed-fields']({ count: guessed }));
  let text = '';
  if (P.mech) {
    for (const u of usable) {
      const spFor = u.s.sp === 'unknown' ? spForUnknown(P, u.s, ui.exp.spChoice) : null;
      const e = exportSet(u.s, P.mech, { sp: spFor });
      if (e.warnings.includes('serious-to-hardy')) warns.push(C.EXPORT_WARN['serious-to-hardy']());
      text += `${e.text}\n`;
    }
  }
  ui.exp.text = text;
  return `${btn('‹ Sets', 'back', {}, { cls: 'back', aria: 'Back' })}${h2('Export')}
    <div class="choices" role="group" aria-label="What to export">${chipBtn(`Their version: ${C.VARIANT_ROLE[v?.role] ?? '—'}`, 'export-what', { what: 'variant' }, ui.exp.what === 'variant')}${chipBtn('Your 6 for this match', 'export-what', { what: 'mine' }, ui.exp.what === 'mine')}</div>
    ${unknown ? `<p><span class="small">Unknown Stat Points:</span> ${chipBtn('Ladder spread', 'export-sp', { sp: 'common' }, ui.exp.spChoice === 'common')}${chipBtn('Max attack + Speed', 'export-sp', { sp: 'max' }, ui.exp.spChoice === 'max')}</p>` : ''}
    ${warns.map((w) => `<p class="small warnline">⚠ ${esc(w)}</p>`).join('')}
    <pre class="paste-out" tabindex="0">${esc(text)}</pre>
    <p>${btn('Copy', 'export-copy', {}, { primary: true })} ${P.app.share ? btn('Share…', 'export-share') : ''} ${btn('Save as .txt', 'export-save')}</p>
    <p class="small">Labels, notes and sources are never written into the paste.</p>`;
}
/** A concrete spread for unknown SP: the ladder's top legal spread, else max attack + Speed. */
export function spForUnknown(P, s, choice) {
  if (choice === 'common') { const c = commonSpread(P.mech, P.app.usage()?.species?.[s.species]); if (c) return c.sp; }
  const phys = s.moves.filter((m) => P.mech.moves[m]?.category === 'Physical').length, spec = s.moves.filter((m) => P.mech.moves[m]?.category === 'Special').length;
  return { hp: 2, atk: phys >= spec ? 32 : 0, def: 0, spa: phys >= spec ? 0 : 32, spd: 0, spe: 32 };
}

export const views = {
  sets: (P, ws, r) => { const l = ws.theirSets.find((s) => s.id === r.id) ?? P.docs.mysets.sets.find((s) => s.id === r.id); return l ? editor(P, l.side === 'mine' ? null : ws, l) : `${h2('Not found')}<p>${esc(C.NOT_ON_DEVICE)}</p>`; },
  import: (P, ws) => importScreen(P, ws),
  export: (P, ws) => exportScreen(P, ws),
  variant: variantEditor,
};

// ---------- actions ----------
const wsOf = (P) => (P.route.view === 'ws' ? P.ws.get(P.route.wsId) : null);
function findLineage(P, id) {
  const ws = wsOf(P);
  const t = ws?.theirSets.find((s) => s.id === id);
  if (t) return { l: t, which: `ws:${ws.id}`, ws };
  const m = P.docs.mysets.sets.find((s) => s.id === id);
  return m ? { l: m, which: 'mysets', ws: null } : null;
}
export function updateDraft(P, id, fn, opts) {
  const f = findLineage(P, id);
  if (!f) return;
  P.mutate(f.which, (d) => {
    d.drafts ??= {};
    const lin = (f.ws ? d.theirSets : d.sets).find((s) => s.id === id);
    const cur = d.drafts[id] ?? { name: lin.name, data: structuredClone(currentVersion(lin).data), provenance: structuredClone(currentVersion(lin).provenance ?? null), notes: lin.notes ?? '' };
    fn(cur, lin);
    cur.at = P.now();
    d.drafts[id] = cur;
  }, { substantive: false, ...opts });
}
function ensureVariant(P, ws, role = 'likely') {
  let v = ws.variants.find((x) => x.role === role);
  if (v) return v;
  v = { id: P.id('var'), role, name: '', setIds: {}, whyBuilt: '', planId: null, updatedAt: P.now() };
  ws.variants.push(v);
  return v;
}
function guessInto(P, d, sp, variant) {
  const g = guessSet(P.mech, P.dexSp(sp), sp, P.app.usage(), P.now().slice(0, 10));
  const l = newLineage({ id: P.id('set'), side: 'theirs', coach: d.coach, speciesId: sp, name: 'Ladder guess', data: g.data, provenance: g.provenance, now: P.now(), reason: 'from ladder data' });
  d.theirSets.push(l);
  if (variant) variant.setIds[sp] = l.id;
  return l;
}

/** Start their set for a species from labelled ladder data (in the chosen or current version of their team). Returns its id. */
export function addGuess(P, ws, species, variantId = null) {
  if (!P.mech || !ws) return null;
  let id = null;
  const ok = P.mutate(`ws:${ws.id}`, (d) => {
    const v = variantId ? d.variants.find((x) => x.id === variantId) : (d.variants.find((x) => x.id === P.wsUi(ws.id).variantId) ?? ensureVariant(P, d, 'likely'));
    id = guessInto(P, d, species, v).id;
  });
  return ok ? id : null;
}
/** Start one of your sets for a species from ladder data (every field to check). Returns its id. */
export function createMySet(P, sp) {
  if (!P.mech) return null;
  const g = guessSet(P.mech, P.dexSp(sp), sp, P.app.usage(), P.now().slice(0, 10));
  const c = commonSpread(P.mech, P.app.usage()?.species?.[sp]);
  const data = { ...g.data, nature: g.data.nature || 'hardy', sp: c?.sp ?? { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 } };
  const id = P.id('set');
  // refused (viewing as another coach, read-only data): no id, so callers don't open or report a set that wasn't saved
  return P.mutate('mysets', (d) => { d.sets.push(newLineage({ id, side: 'mine', speciesId: sp, name: 'Set', data, now: P.now(), reason: 'started from ladder data' })); }) ? id : null;
}

export const actions = {
  'pick-variant':(t, P) => { P.wsUi(P.route.wsId).variantId = t.dataset.variant; P.app.rerender(); },
  'open-variant': (t, P) => P.go({ view: 'ws', wsId: P.route.wsId, kind: 'variant', id: t.dataset.variant }, { push: true }),
  'variant-new': (t, P) => {
    const ws = wsOf(P);
    const roles = ws.variants.map((v) => v.role);
    const role = !roles.includes('likely') ? 'likely' : !roles.includes('worst-plausible') ? 'worst-plausible' : !roles.includes('counterprep') ? 'counterprep' : 'idea';
    const id = P.id('var');
    P.mutate(`ws:${ws.id}`, (d) => { const base = d.variants.find((v) => v.role === 'likely'); d.variants.push({ id, role, name: '', setIds: { ...(base?.setIds ?? {}) }, whyBuilt: '', planId: null, updatedAt: P.now() }); });
    P.wsUi(ws.id).variantId = id;
    P.go({ view: 'ws', wsId: ws.id, kind: 'variant', id }, { push: true });
  },
  'variant-role': (t, P) => P.mutate(`ws:${P.route.wsId}`, (d) => { d.variants.find((v) => v.id === t.dataset.variant).role = t.dataset.role; }),
  'variant-dup': (t, P) => {
    const id = P.id('var');
    P.mutate(`ws:${P.route.wsId}`, (d) => { const v = d.variants.find((x) => x.id === t.dataset.variant); d.variants.push({ ...structuredClone(v), id, role: 'idea', name: `${v.name || C.VARIANT_ROLE[v.role]} (copy)` }); });
    P.go({ view: 'ws', wsId: P.route.wsId, kind: 'variant', id }, { push: false });
  },
  'variant-delete': (t, P) => { P.mutate(`ws:${P.route.wsId}`, (d) => { d.variants = d.variants.filter((v) => v.id !== t.dataset.variant); }); P.back(); P.toast('Version deleted (its sets are kept)'); },
  'guess-all': (t, P) => {
    if (!P.mech) { P.toast('The Reg M-C data is still loading'); return; }
    const ws = wsOf(P);
    let n = 0;
    P.mutate(`ws:${ws.id}`, (d) => {
      const v = ensureVariant(P, d, 'likely');
      for (const sp of P.rosterSpecies(d)) if (!v.setIds[sp] || !d.theirSets.some((s) => s.id === v.setIds[sp])) { guessInto(P, d, sp, v); n++; }
      P.wsUi(ws.id).variantId = v.id;
    });
    P.toast(`${n} labelled guesses added from ladder data${P.app.usage() ? '' : ' (moves only: usage data is offline)'}`);
  },
  'guess-one': (t, P) => {
    const id = addGuess(P, wsOf(P), t.dataset.species, t.dataset.variant);
    if (id) P.go({ view: 'ws', wsId: P.route.wsId, kind: 'sets', id }, { push: true });
  },
  'open-their-set': (t, P) => P.go({ view: 'ws', wsId: P.route.wsId, kind: 'sets', id: t.dataset.set }, { push: true }),
  'set-why': (t, P) => {
    const rp = P.ui.revPrompt;
    P.ui.revPrompt = null;
    if (!rp) return;
    const l = P.lineage(rp.setId);
    const fid = t.dataset.finding;
    P.mutate(`ws:${t.dataset.ws}`, (d) => {
      d.revisions.push({ id: P.id('rvn'), date: P.now().slice(0, 10), changes: [{ kind: 'set', setId: l.id, fromV: rp.fromV, toV: rp.toV, structural: false, what: `${P.spName(l.speciesId)} ${l.name || 'Set'} v${rp.fromV} → v${rp.toV}` }],
        reasonFindingIds: fid ? [fid] : 'hunch', structural: false, expectedEffect: '', invalidates: { calcIds: [], cardIds: [] }, retest: null, revertedBy: null });
      for (const f of d.findings) if (f.id === fid && f.status === 'open') { f.status = 'accepted'; f.statusAt = P.now(); }
    });
    P.toast('Revision recorded: retest it in your next mock (Practice › Revision log)');
  },
  'set-why-skip': (t, P) => { P.ui.revPrompt = null; P.app.rerender(); },
  'open-my-set': (t, P) => (P.route.view === 'ws' ? P.go({ view: 'ws', wsId: P.route.wsId, kind: 'sets', id: t.dataset.set }, { push: true }) : P.go({ view: 'my-sets', id: t.dataset.set }, { push: true })),
  'my-create': (t, P) => {
    const id = createMySet(P, t.dataset.species);
    if (!id) return;
    P.toast('New set started from ladder data: check every field');
    actions['open-my-set']({ dataset: { set: id } }, P);
  },
  'toggle-six': (t, P) => P.mutate(`ws:${P.route.wsId}`, (d) => {
    const id = t.dataset.set;
    if (d.my6.some((m) => m.setId === id)) d.my6 = d.my6.filter((m) => m.setId !== id);
    else {
      const sp = P.lineage(id)?.speciesId;
      d.my6 = d.my6.filter((m) => P.lineage(m.setId)?.speciesId !== sp); // one set per Pokémon
      d.my6.push({ setId: id });
    }
  }),
  'sp-guess': (t, P) => updateDraft(P, t.dataset.set, (c) => { c.data.sp = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }; c.provenance = { ...(c.provenance ?? {}), sp: { source: 'my-guess', asOf: P.now().slice(0, 10) } }; }),
  'sp-unknown': (t, P) => updateDraft(P, t.dataset.set, (c) => { c.data.sp = 'unknown'; if (c.provenance) c.provenance.sp = null; }),
  'sp-step': (t, P) => updateDraft(P, t.dataset.set, (c, lin) => {
    const s = t.dataset.stat; c.data.sp[s] = Math.max(0, Math.min(99, (c.data.sp[s] ?? 0) + Number(t.dataset.d)));
    if (c.provenance?.sp?.source !== 'my-guess') chosenBy(P, c, lin, 'sp', null, true);
    P.app.announce?.(`${C.STAT_LONG[s]} ${c.data.sp[s]}; ${spTotal(c.data.sp)} of ${SP_TOTAL} Stat Points used`);
  }),
  'set-save': (t, P) => saveSet(P, t.dataset.set, false),
  'set-save-copy': (t, P) => saveSet(P, t.dataset.set, true),
  'set-discard': (t, P) => { const f = findLineage(P, t.dataset.set); if (f) P.mutate(f.which, (d) => { if (d.drafts) delete d.drafts[t.dataset.set]; }, { substantive: false }); },
  'set-revert': (t, P) => {
    const f = findLineage(P, t.dataset.set);
    P.mutate(f.which, (d) => { const arr = f.ws ? d.theirSets : d.sets; const i = arr.findIndex((s) => s.id === t.dataset.set); arr[i] = setCurrent(arr[i], Number(t.dataset.v), P.now()); });
    P.toast(`Now using v${t.dataset.v}`);
  },
  'set-copy': async (t, P) => {
    const f = findLineage(P, t.dataset.set);
    const s = asSet(f.l, currentVersion(f.l));
    const text = exportSet(s, P.mech, { sp: s.sp === 'unknown' ? spForUnknown(P, s, 'common') : null }).text;
    try { await P.app.copyText(text); P.toast('Copied'); } catch { P.toast("Couldn't copy"); }
  },
  'set-delete': (t, P) => {
    const f = findLineage(P, t.dataset.set);
    P.mutate(f.which, (d) => {
      if (f.ws) { d.theirSets = d.theirSets.filter((s) => s.id !== t.dataset.set); for (const v of d.variants) for (const [k, id] of Object.entries(v.setIds)) if (id === t.dataset.set) delete v.setIds[k]; }
      else d.sets = d.sets.filter((s) => s.id !== t.dataset.set);
    });
    if (!f.ws) for (const w of P.ws.values()) if (w.my6.some((m) => m.setId === t.dataset.set)) P.mutate(`ws:${w.id}`, (d) => { d.my6 = d.my6.filter((m) => m.setId !== t.dataset.set); });
    P.back(); P.toast('Set deleted; calcs that used it keep their saved inputs');
  },
  'go-import': (t, P) => {
    if (t.dataset.side) { const ui = P.wsUi(P.route.wsId); ui.imp = { text: '', side: t.dataset.side, source: 'my-guess', note: '', answers: {}, result: null, dup: {} }; }
    P.go({ view: 'ws', wsId: P.route.wsId, kind: 'import' }, { push: true });
  },
  'go-export': (t, P) => P.go({ view: 'ws', wsId: P.route.wsId, kind: 'export' }, { push: true }),
  'paste-clipboard': async (t, P) => {
    try { const text = await P.app.readClipboard(); importUi(P).text = text; P.app.rerender(); }
    catch { P.toast("Your browser didn't allow reading the clipboard. Long-press the box and choose Paste."); }
  },
  'paste-side': (t, P) => { importUi(P).side = t.dataset.side; importUi(P).result = null; P.app.rerender(); },
  'paste-check': (t, P) => { const u = importUi(P); u.answers = {}; u.dup = {}; runParse(P); },
  'paste-answer': (t, P) => { const u = importUi(P); (u.answers[t.dataset.set] ??= {})[t.dataset.key] = t.dataset.value; runParse(P); },
  'paste-dup': (t, P) => { importUi(P).dup[t.dataset.set] = t.dataset.value; P.app.rerender(); },
  'paste-source': (t, P) => { importUi(P).source = t.dataset.source; P.app.rerender(); },
  'paste-import': (t, P) => doImport(P),
  'export-what': (t, P) => { P.wsUi(P.route.wsId).exp.what = t.dataset.what; P.app.rerender(); },
  'export-sp': (t, P) => { P.wsUi(P.route.wsId).exp.spChoice = t.dataset.sp; P.app.rerender(); },
  'export-copy': async (t, P) => { try { await P.app.copyText(P.wsUi(P.route.wsId).exp.text); P.toast('Copied'); } catch { P.toast("Couldn't copy; select the text instead"); } },
  'export-share': async (t, P) => { try { await P.app.share({ text: P.wsUi(P.route.wsId).exp.text }); } catch { /* the user closed the share sheet */ } },
  'export-save': (t, P) => P.app.download(`team-${P.now().slice(0, 10)}.txt`, P.wsUi(P.route.wsId).exp.text, 'text/plain'),
};
const importUi = (P) => (P.route.view === 'ws' ? P.wsUi(P.route.wsId).imp : P.ui.mineImport.imp);
function runParse(P) {
  const u = importUi(P);
  if (!P.mech) { P.toast('The Reg M-C data is still loading'); return; }
  const ws = wsOf(P);
  const allowed = u.side === 'theirs' && ws ? new Set(P.rosterSpecies(ws)) : u.side === 'mine' ? new Set([...P.coachRoster(P.myCoach()), ...P.docs.mysets.sets.map((s) => s.speciesId)]) : null;
  u.result = parseTeam(u.text, { mech: P.mech, side: u.side, allowedSpecies: allowed && allowed.size ? allowed : null, answers: u.answers });
  P.app.rerender();
}
function doImport(P) {
  const u = importUi(P);
  const ws = wsOf(P);
  const ready = (u.result?.sets ?? []).filter((s) => s.status === 'ready');
  if (!ready.length) return;
  const now = P.now();
  const reason = u.side === 'theirs' ? `pasted (${C.SOURCE[u.source]})${u.note ? `: ${u.note}` : ''}` : 'pasted';
  if (u.side === 'theirs') {
    P.mutate(`ws:${ws.id}`, (d) => {
      const v = d.variants.find((x) => x.id === P.wsUi(ws.id).variantId) ?? ensureVariant(P, d, 'likely');
      for (const s of ready) {
        const data = cleanSetData({ ...s.set });
        const prov = provenanceAll(data, u.source, now.slice(0, 10), u.note);
        const target = u.dup[s.index] && u.dup[s.index] !== 'new' ? d.theirSets.findIndex((x) => x.id === u.dup[s.index]) : -1;
        if (target >= 0) d.theirSets[target] = addVersion(d.theirSets[target], data, { now, reason, provenance: prov });
        else { const l = newLineage({ id: P.id('set'), side: 'theirs', coach: d.coach, speciesId: s.set.species, name: 'Pasted', data, provenance: prov, now, reason }); d.theirSets.push(l); v.setIds[s.set.species] = l.id; }
      }
    });
  } else {
    P.mutate('mysets', (d) => {
      for (const s of ready) {
        const data = cleanSetData({ ...s.set });
        const target = u.dup[s.index] && u.dup[s.index] !== 'new' ? d.sets.findIndex((x) => x.id === u.dup[s.index]) : -1;
        if (target >= 0) d.sets[target] = addVersion(d.sets[target], data, { now, reason });
        else d.sets.push(newLineage({ id: P.id('set'), side: 'mine', speciesId: s.set.species, name: s.set.cosmetic.nickname || 'Set', data, now, reason }));
      }
    });
  }
  // Sets still waiting for a choice (or with a problem) stay here with their text; only the imported ones leave.
  const left = (u.result?.sets ?? []).filter((s) => s.status !== 'ready');
  if (left.length) {
    u.text = left.map((s) => s.lines.map((l) => l.text).join('\n')).join('\n\n');
    u.answers = {}; u.dup = {};
    P.toast(`Imported ${ready.length} set${ready.length === 1 ? '' : 's'}; ${left.length} still need${left.length === 1 ? 's' : ''} a choice (kept below)`);
    runParse(P);
    return;
  }
  P.toast(`Imported ${ready.length} set${ready.length === 1 ? '' : 's'}`);
  u.result = null; u.text = ''; u.answers = {};
  // Land on the list the sets went into (the import screen is replaced, so Back doesn't reopen it).
  P.go(ws ? { view: 'ws', wsId: ws.id, tab: 'sets' } : { view: 'my-sets' }, { push: false });
}
function saveSet(P, id, asCopy) {
  const f = findLineage(P, id);
  if (!f) return;
  const draft = (f.ws ? f.ws.drafts : P.docs.mysets.drafts)?.[id];
  if (!draft && !asCopy) { P.toast('No changes to save'); return; }
  let data = draft?.data ?? currentVersion(f.l).data;
  let provenance = draft?.provenance;
  if (draft) { // drop empty move slots, keeping each move's source aligned
    const keep = (data.moves ?? []).map((m, i) => (m ? i : -1)).filter((i) => i >= 0);
    data = { ...data, moves: keep.map((i) => data.moves[i]) };
    if (provenance?.moves) provenance = { ...provenance, moves: keep.map((i) => provenance.moves[i] ?? null) };
  }
  const invalid = !!P.mech && checkSet(P.mech, { species: f.l.speciesId, ...data }, { side: f.l.side }).some((p) => p.severity === 'error');
  const fromV = f.l.currentV;
  P.mutate(f.which, (d) => {
    const arr = f.ws ? d.theirSets : d.sets;
    const i = arr.findIndex((s) => s.id === id);
    if (asCopy) {
      const copy = newLineage({ id: P.id('set'), side: arr[i].side, coach: arr[i].coach, speciesId: arr[i].speciesId, name: `${draft?.name ?? arr[i].name} (copy)`, data, provenance: provenance ?? undefined, now: P.now(), reason: 'copied' });
      arr.push(copy);
      if (P.route.view === 'ws' && !f.ws) P.mutate(`ws:${P.route.wsId}`, (w) => { w.my6 = w.my6.map((m) => (m.setId === id ? { setId: copy.id } : m)); }, { render: false });
    } else {
      arr[i] = addVersion(arr[i], data, { now: P.now(), reason: 'edited', provenance: f.ws ? provenance : undefined });
      arr[i].name = draft.name ?? arr[i].name;
      arr[i].notes = draft.notes ?? arr[i].notes;
      const refs = new Set();
      for (const w of P.ws.values()) for (const v of referencedVersions(w).get(id) ?? []) refs.add(v);
      arr[i] = pruneVersions(arr[i], refs);
    }
    if (d.drafts) delete d.drafts[id];
  });
  const stale = [...P.ws.values()].reduce((t, w) => t + w.calcs.filter((c) => c.refs?.attacker?.setId === id || c.refs?.defender?.setId === id).length, 0);
  const toV = findLineage(P, id)?.l.currentV;
  P.toast(`${asCopy ? 'Saved as a new set' : `Saved v${toV ?? ''}`}${!asCopy && stale ? ` · ${stale} calc${stale === 1 ? ' is' : 's are'} now out of date` : ''}${invalid ? ' · fix the marked fields before calcs and export use it' : ''}`);
  // a change to one of your sets while findings are open: one tap ties it to the finding, so it gets retested
  const open = [...P.ws.values()].some((w) => w.findings.some((x) => ['open', 'accepted', 'retest'].includes(x.status)));
  if (!asCopy && f.l.side === 'mine' && toV !== fromV && open) { P.ui.revPrompt = { setId: id, fromV, toV }; P.app.rerender(); }
}
/** "Why did you change it?" after saving one of your sets: tie the new version to an open finding (a revision to retest). */
export function revisionPrompt(P, l) {
  const rp = P.ui.revPrompt;
  if (!rp || rp.setId !== l.id) return '';
  const here = P.route.view === 'ws' ? [P.ws.get(P.route.wsId)].filter(Boolean) : [...P.ws.values()];
  const chips = here.flatMap((w) => w.findings.filter((x) => ['open', 'accepted', 'retest'].includes(x.status)).map((x) => btn(`${here.length > 1 ? `vs ${w.coach}: ` : ''}${x.statement || 'finding'}`, 'set-why', { ws: w.id, finding: x.id }, { cls: 'linkish' })));
  return `<div class="card"><p><b>Why did you change it?</b> <span class="small">Tie v${rp.fromV} → v${rp.toV} to a finding and it shows up to retest in your next mock.</span></p><p>${chips.join(' ')} ${P.route.view === 'ws' ? btn('A hunch', 'set-why', { ws: P.route.wsId, finding: '' }, { cls: 'linkish' }) : ''} ${btn('Skip', 'set-why-skip', {}, { cls: 'linkish' })}</p></div>`;
}

/** On their sets, a value you pick yourself is your guess until you say where it came from (the source menu next to it). */
function chosenBy(P, c, lin, field, i, value) {
  if (lin.side !== 'theirs') return;
  c.provenance ??= {};
  const src = value ? { source: 'my-guess', asOf: P.now().slice(0, 10) } : null;
  if (field === 'moves') { c.provenance.moves ??= []; c.provenance.moves[i] = src; } else c.provenance[field] = src;
}
export const changes = {
  'set-field': (t, P) => updateDraft(P, t.dataset.set, (c, lin) => { c.data[t.dataset.field] = t.value; chosenBy(P, c, lin, t.dataset.field, null, t.value); }),
  'set-move': (t, P) => updateDraft(P, t.dataset.set, (c, lin) => { const i = Number(t.dataset.i); const m = [0, 1, 2, 3].map((j) => c.data.moves[j] ?? ''); m[i] = t.value; while (m.length && !m.at(-1)) m.pop(); c.data.moves = m; chosenBy(P, c, lin, 'moves', i, t.value); }),
  'set-source': (t, P) => updateDraft(P, t.dataset.set, (c) => {
    c.provenance ??= {};
    const val = t.value ? { source: t.value, asOf: P.now().slice(0, 10) } : null;
    if (t.dataset.field === 'moves') { c.provenance.moves ??= []; c.provenance.moves[Number(t.dataset.i)] = val; } else c.provenance[t.dataset.field] = val;
  }),
  'sp-value': (t, P) => updateDraft(P, t.dataset.set, (c, lin) => { c.data.sp[t.dataset.stat] = t.value === '' ? 0 : Number(t.value); if (c.provenance?.sp?.source !== 'my-guess') chosenBy(P, c, lin, 'sp', null, true); }), // never clamped: checkSet reports problems
  'variant-set': (t, P) => P.mutate(`ws:${P.route.wsId}`, (d) => { const v = d.variants.find((x) => x.id === t.dataset.variant); if (t.value) v.setIds[t.dataset.species] = t.value; else delete v.setIds[t.dataset.species]; }),
};
export const inputs = {
  'set-name': (t, P) => updateDraft(P, t.dataset.set, (c) => { c.name = t.value.slice(0, 60); }, { render: false }),
  'set-notes': (t, P) => updateDraft(P, t.dataset.set, (c) => { c.notes = t.value.slice(0, 2000); }, { render: false }),
  // answers are tied to set positions in the checked text: an edit clears them (and the old result) so they can't attach to another set
  'paste-text': (t, P) => { const u = importUi(P); u.text = t.value.slice(0, 60000); if (u.result) { u.result = null; u.answers = {}; u.dup = {}; P.app.rerender(); } },
  'paste-note': (t, P) => { importUi(P).note = t.value.slice(0, 120); },
  'variant-name': (t, P) => P.mutate(`ws:${P.route.wsId}`, (d) => { d.variants.find((v) => v.id === t.dataset.variant).name = t.value.slice(0, 40); }, { render: false }),
  'variant-why': (t, P) => P.mutate(`ws:${P.route.wsId}`, (d) => { d.variants.find((v) => v.id === t.dataset.variant).whyBuilt = t.value.slice(0, 200); }, { render: false }),
};
export { SOURCES };

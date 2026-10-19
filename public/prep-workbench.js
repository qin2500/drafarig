// The calc workbench (docs/research/ux/calc-workbench-teams.md §B, lead overrides 2026-10-16): every automatic number in
// the teambuilder opens this sheet with both sides' full sets editable (SP sliders, nature, item, ability, boosts, field).
// It recalculates live and closes back. Nothing writes anywhere until a button is tapped:
// - "Apply to my set" puts your side's nature / item / ability / Stat Points into the set's DRAFT (Save version keeps it);
// - "Save as calc" files it under that opponent's Calcs (creating that matchup's prep on this explicit tap).
// State is P.ui.wb (this tab's session). The engine run is one calc.run per change (~0.1 ms on a laptop).
import { legalAbilities, toID } from '../lib/calc/mech.mjs';
import { STAT_IDS, SP_PER_STAT, SP_TOTAL, spTotal, statValue, natureSign } from '../lib/calc/stats.mjs';
import { normalizeScenario } from '../lib/calc/scenario.mjs';
import { pinsOf, entityHashes } from '../lib/calc/keys.mjs';
import * as B from '../lib/prep-build.mjs';
import * as C from './prep-copy.js';
import { esc, btn, chipBtn, h2, select, resultBlock, rollsDetail, itemIcon } from './prep-ui.js';
import { updateDraft } from './prep-sets.js';
import { SYNERGY } from '../lib/move-search.mjs';
import { summarize } from './prep-calcs.js';

const W = C.WB;
const WEATHERS = ['', 'Sun', 'Rain', 'Sand', 'Snow'];
const TERRAINS = ['', 'Electric', 'Grassy', 'Psychic', 'Misty'];
const wbOf = (P) => (P.ui.wb?.open ? P.ui.wb : null);

/**
 * Open the workbench. seed: { setId, mine (your set as calc data), row (their target row: key, coach, species, forme, mega,
 * set, source, usageFrom, common), move, mineRole: 'attacker' | 'defender', boost (your stat stage), stage (their defence
 * stage), field, base (your draft when `mine` starts at a mark's values: Apply then offers the difference) }.
 */
export function open(P, seed) {
  const field = structuredClone(seed.field ?? {});
  P.ui.wb = {
    open: true, guide: seed.guide ?? null, pilot: seed.pilot ?? null, forms: seed.forms ?? {}, setId: seed.setId, mine: structuredClone(seed.mine), mineBase: structuredClone(seed.base ?? seed.mine), row: structuredClone(seed.row),
    their: null, spread: seed.row.set.sp === 'unknown' ? (seed.row.common ? 'common' : 'max') : 'set', move: seed.move, mineRole: seed.mineRole ?? 'attacker',
    boosts: { mine: seed.boost ?? 0, theirs: seed.stage ?? 0 }, field, crit: false, intimidated: 0, defHp: 100, tab: 'you', saved: null,
  };
  // their hit on a ladder guess: open at their worst case (the ladder set is one tap away)
  // (a stated set — guide, mock — opens as stated)
  if (P.ui.wb.mineRole === 'defender' && seed.row.source === 'ladder' && P.mech && !seed.guide && !seed.pilot) { P.ui.wb.theirMode = 'worst'; P.ui.wb.their = worstCaseOf(P, P.ui.wb.row, seed.move); }
  try { P.app.history.pushState({ prep: true, wb: true, names: P.app.history.state?.names ?? null, wsId: P.app.history.state?.wsId ?? null, from: P.app.location.hash }, '', P.app.location.hash); } catch { /* no history */ }
  P.ensureEngine();
  P.pendingFocus = true; P.pendingFocusId = 'wb-h';
  P.app.rerender();
}
/** Close (×, Esc, Back): discards everything; nothing was saved. */
export function close(P, { fromHistory = false } = {}) {
  if (!P.ui.wb?.open) return false;
  P.ui.wb = null;
  if (!fromHistory) { try { if (P.app.history.state?.wb) P.app.history.back(); } catch { /* no history */ } }
  P.app.rerender();
  return true;
}

// ---------- the scenario ----------
const theirSet = (wb) => wb.their ?? wb.row.set;
const formOf = (wb, side) => (wb.forms?.[side] ? { form: wb.forms[side] } : {});
/** Your side and theirs as a normalized scenario (their unknown SP filled from the chosen spread). */
export function scenarioOf(P, wb) {
  const mv = B.moveStats(P.mech, wb.move) ?? { atk: 'atk', def: 'def' };
  const mineAtk = wb.mineRole === 'attacker';
  const mineSet = { ...wb.mine, gender: '' }, theirs = { ...theirSet(wb), gender: '' };
  const field = { ...wb.field, attackerSide: { ...(wb.field.attackerSide ?? {}) }, defenderSide: { ...(wb.field.defenderSide ?? {}) } };
  const aBoost = mineAtk ? wb.boosts.mine : wb.boosts.theirs, dBoost = mineAtk ? wb.boosts.theirs : wb.boosts.mine;
  let sc = normalizeScenario({
    attacker: { set: mineAtk ? mineSet : theirs, state: { boosts: { [mv.atk]: aBoost }, intimidated: wb.intimidated, ...(mineAtk ? {} : { mega: wb.row.mega }), ...formOf(wb, mineAtk ? 'mine' : 'theirs') } },
    defender: { set: mineAtk ? theirs : mineSet, state: { boosts: { [mv.def]: dBoost }, hpPct: wb.defHp, ...(mineAtk ? { mega: wb.row.mega } : {}), ...formOf(wb, mineAtk ? 'theirs' : 'mine') } },
    move: { id: wb.move, crit: wb.crit }, field,
  });
  const side = mineAtk ? 'defender' : 'attacker';
  if (sc[side].set.sp === 'unknown' && P.calc) sc = B.withSpread(P.calc, sc, side, wb.row, wb.spread === 'set' ? 'max' : wb.spread).sc;
  return sc;
}
export function result(P, wb) {
  if (!P.calc) return null;
  return P.calc.run(scenarioOf(P, wb));
}
const names = (P, wb) => {
  const mine = P.spName(B.myForme(P.mech, wb.mine)), them = `${wb.row.coach ? `${wb.row.coach}'s ` : ''}${P.spName(wb.row.forme)}`;
  const own = wb.pilot ? W.mockSet(wb.pilot.coach) : W.yourDraft; // a mock: "your" side is the team you pilot, not yours
  return wb.mineRole === 'attacker' ? { attacker: mine, defender: them, attackerSet: own, defenderSet: sourceLine(wb) } : { attacker: them, defender: mine, attackerSet: sourceLine(wb), defenderSet: own };
};
/**
 * §5 (3): their worst case for this move, as an alternative to the ladder / saved set: + nature, 32 SP in the move's stat,
 * the ability that powers the move up (else theirs), Life Orb (a Mega keeps its stone). Other stats as their set has them.
 */
export function worstCaseOf(P, row, move) {
  const mv = P.mech.moves[move];
  const stat = mv?.category === 'Special' ? 'spa' : 'atk';
  const base = row.set;
  const syn = legalAbilities(P.mech, row.species).find((a) => SYNERGY[a]?.test(mv, P.mech.species[row.forme] ?? P.mech.species[row.species]));
  // + nature, 32 SP in the move's stat; the rest of their known spread kept only while it fits in 66
  const sp = base.sp === 'unknown' ? { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 } : { ...base.sp };
  const room = 66 - 32 - Object.entries(sp).filter(([k]) => k !== (mv?.category === 'Special' ? 'spa' : 'atk')).reduce((t, [, v]) => t + (v ?? 0), 0);
  if (room < 0) for (const k of ['spe', 'spd', 'def', 'hp', 'atk', 'spa']) { if (k === (mv?.category === 'Special' ? 'spa' : 'atk')) continue; sp[k] = 0; if (66 - 32 - Object.entries(sp).filter(([x]) => x !== (mv?.category === 'Special' ? 'spa' : 'atk')).reduce((t, [, v]) => t + (v ?? 0), 0) >= 0) break; }
  return { ...structuredClone(base), ability: row.mega ? base.ability : syn ?? base.ability, item: row.mega ? base.item : 'lifeorb', nature: stat === 'spa' ? 'modest' : 'adamant', sp: { ...sp, [stat]: 32 } };
}
function sourceLine(wb) {
  return `${sourceBase(wb)}${wb.guide && !wb.their ? W.asGuide : ''}`;
}
function sourceBase(wb) {
  if (wb.theirMode === 'worst') return W.src.search;
  if (wb.their) return W.edited;
  const r = wb.row;
  if (r.source === 'set') return W.src.set;
  if (r.source === 'search') return W.src.search;
  if (r.source === 'bulk') return W.src.bulk;
  if (r.source === 'ladder') return r.usageFrom === 'base' ? W.src.base : r.usageFrom === 'keymoves' ? W.src.keymoves : W.src.ladder(r.common);
  return W.src.none;
}
function resultHtml(P, wb) {
  if (!P.calc) return `<p class="small">${esc(P.engineState === 'failed' ? C.TB.engineFailed : C.TB.calculating)}</p>`;
  const r = result(P, wb);
  return `${guideCheck(P, wb, r)}${resultBlock(r, names(P, wb), { fixActions: false })}${r.class === 'exact' ? rollsDetail(r) : ''}`;
}
/** "Guide: 65–77% · now 65–77% ✓", or why it differs (your set as it is now). Computed only here, when it's open. */
function guideCheck(P, wb, r) {
  if (!wb.guide?.range || r?.class !== 'exact') return '';
  const p = (n) => Math.floor((1000 * n) / r.maxHP) / 10;
  const now = `${p(r.range.min)}–${p(r.range.max)}%`;
  const m = /^(\d+(?:\.\d+)?)–(\d+(?:\.\d+)?)%$/.exec(wb.guide.range);
  const same = m && Math.abs(Number(m[1]) - p(r.range.min)) <= 0.5 && Math.abs(Number(m[2]) - p(r.range.max)) <= 0.5;
  const s = wb.mine, key = wb.mineRole === 'attacker' ? (P.mech.moves[wb.move]?.category === 'Special' ? 'spa' : 'atk') : (P.mech.moves[wb.move]?.category === 'Special' ? 'spd' : 'def');
  const yours = `${P.spName(B.myForme(P.mech, s))} (${P.name('natures', s.nature)} ${s.sp?.hp ?? 0} HP / ${s.sp?.[key] ?? 0} ${C.STAT_SHORT[key]})`;
  return `<p class="small gd-check${same ? ' same' : ''}">${same ? esc(W.guideSame(wb.guide.range, now)) : esc(W.guideDiffers(wb.guide.range, now, yours))}${wb.guide.fromGuide ? ` <span class="muted">${esc(W.guideSetNote)}</span>` : ''}</p>`;
}

// ---------- the sheet ----------
export function render(P) {
  const wb = wbOf(P);
  if (!wb || !P.mech) return '';
  const head = `${P.name('moves', wb.move)}: ${names(P, wb).attacker} → ${names(P, wb).defender}`;
  const diff = applyDiff(P, wb);
  const tabs = ['you', 'them', 'field'].map((k) => chipBtn(W.tab[k], 'wb-tab', { tab: k }, wb.tab === k)).join('');
  return `<div class="wb-backdrop"><div class="wb" role="dialog" aria-modal="true" aria-labelledby="wb-h" data-tab="${esc(wb.tab)}">
    <div class="wb-head">${h2(head, 'wb-h')}${btn('×', 'wb-close', {}, { cls: 'wb-x', aria: W.close })}</div>
    <div class="wb-result" id="wb-result">${resultHtml(P, wb)}</div>
    <div class="wb-tabs" role="group" aria-label="${esc(W.sections)}">${tabs}</div>
    <div class="wb-cols">
      <section class="wb-side wb-you" aria-label="${esc(W.you)}"><h3>${esc(wb.pilot ? wb.pilot.coach : W.you)} <span class="small muted">(${esc(wb.pilot ? W.mockSet(wb.pilot.coach) : W.yourDraft)})</span></h3>${sidePanel(P, wb, 'mine')}</section>
      <section class="wb-side wb-them" aria-label="${esc(W.them)}"><h3>${esc(W.them)} <span class="small muted">(${esc(sourceLine(wb))})</span></h3>${sidePanel(P, wb, 'theirs')}</section>
    </div>
    <section class="wb-field" aria-label="${esc(W.field)}"><h3>${esc(W.field)}</h3>${fieldPanel(P, wb)}</section>
    <div class="wb-bar">${wb.pilot ? `<span class="small muted">${esc(W.pilotNote)}</span>` : wb.guide?.fromGuide ? btn(C.GUIDE.importTeam, 'guide-import', { pov: wb.guide.pov, opp: wb.guide.opp, coach: wb.guide.coach }, { primary: true }) : btn(diff.length ? W.apply(diff.map((k) => W.fieldName[k] ?? C.STAT_SHORT[k] ?? k)) : W.applyNone, 'wb-apply', {}, { primary: true, disabled: !diff.length })}
      ${wb.pilot ? '' : btn(W.saveCalc, 'wb-save-calc')} <span class="small muted">${esc(wb.saved ? W.savedTo(wb.saved.coach) : W.notSaved)}</span>
      ${wb.saved ? btn(W.openCalcs, 'wb-open-calcs', {}, { cls: 'linkish' }) : ''}</div></div></div>`;
}

function sidePanel(P, wb, side) {
  const mine = side === 'mine';
  const set = mine ? wb.mine : theirSet(wb);
  const sc = scenarioOf(P, wb);
  const scSide = (wb.mineRole === 'attacker') === mine ? 'attacker' : 'defender';
  const shown = sc[scSide].set; // with their spread filled in
  const sp = shown.sp === 'unknown' ? null : shown.sp;
  const forme = mine ? B.myForme(P.mech, set) : wb.row.forme;
  const fm = P.mech.species[forme] ?? P.mech.species[set.species];
  const natureOpts = Object.keys(P.mech.natures).sort().map((n) => { const x = P.mech.natures[n]; return [n, `${x.name}${x.plus && x.plus !== x.minus ? ` (+${C.STAT_SHORT[x.plus]} −${C.STAT_SHORT[x.minus]})` : ''}`]; });
  const items = Object.keys(P.mech.items).filter((i) => !P.mech.items[i].megaStone || P.mech.items[i].megaStone[set.species]).sort((a, b) => P.name('items', a).localeCompare(P.name('items', b)));
  const abil = fm?.mega ? [toID(fm.abilities[0] ?? '')] : legalAbilities(P.mech, set.species);
  const mv = B.moveStats(P.mech, wb.move) ?? { atk: 'atk', def: 'def' };
  const key = (wb.mineRole === 'attacker') === mine ? mv.atk : mv.def; // the stat this side uses in the calc
  const d = { side };
  const row = (k) => {
    const v = sp ? sp[k] ?? 0 : 0;
    const fin = sp ? statValue(k, fm.baseStats[k], v, natureSign(P.mech.natures[shown.nature], k)) : '—';
    return `<div class="wb-srow" data-stat="${k}" data-base="${fm.baseStats[k]}" data-sign="${natureSign(P.mech.natures[shown.nature], k)}"><label for="wb-${side}-${k}">${C.STAT_SHORT[k]}</label>
      <input id="wb-${side}-${k}" type="range" min="0" max="${SP_PER_STAT}" step="1" value="${v}" data-pc="wb-sp" data-pi="wb-sp-live" data-side="${side}" data-stat="${k}">
      <span class="wb-num">${v}</span><span class="wb-fin">${fin}</span></div>`;
  };
  const main = ['hp', key].filter((k, i, a) => a.indexOf(k) === i), rest = STAT_IDS.filter((k) => !main.includes(k));
  const modeSeg = !mine && wb.mineRole === 'defender' && !['worst', 'search'].includes(wb.row.source) ? `<div class="choices" role="group" aria-label="${esc(W.theirMode)}">${chipBtn(W.ladderSet, 'wb-their-mode', { mode: 'ladder' }, wb.theirMode !== 'worst')}${chipBtn(W.worstSet, 'wb-their-mode', { mode: 'worst' }, wb.theirMode === 'worst')}</div>` : '';
  const spreadSeg = !mine && wb.row.set.sp === 'unknown' && !wb.their ? `<div class="choices" role="group" aria-label="${esc(W.spread)}"><span class="small">${esc(W.spread)}:</span> ${['frail', 'common', 'max'].map((k) => chipBtn(C.ENVELOPE_ROW[k], 'wb-spread', { k }, wb.spread === k, { disabled: k === 'common' && !wb.row.common })).join('')}</div>` : '';
  const boost = select(`wb-${side}-boost`, [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6].map((n) => [String(n), n > 0 ? `+${n}` : String(n)]), String(mine ? wb.boosts.mine : wb.boosts.theirs), { label: W.boost(C.STAT_SHORT[key]), data: { pc: 'wb-boost', ...d } });
  return `<p class="small">${P.pt(set.species, { size: 'sm' })} <b>${esc(P.spName(forme))}</b>${fm?.mega ? ` <span class="chip">${esc(W.asMega)}</span>` : ''}</p>
    <div class="frow">${select(`wb-${side}-nature`, natureOpts, shown.nature, { label: W.nature, data: { pc: 'wb-field-set', key: 'nature', ...d } })}
      <span class="wb-item">${itemIcon(set.item)}${select(`wb-${side}-item`, [['', W.noItem], ...items.map((i) => [i, P.name('items', i)])], set.item, { label: W.item, data: { pc: 'wb-field-set', key: 'item', ...d } })}</span>
      ${select(`wb-${side}-ability`, abil.map((a) => [a, P.name('abilities', a)]), fm?.mega ? abil[0] : set.ability, { label: W.ability, data: { pc: 'wb-field-set', key: 'ability', ...d } })}</div>
    ${modeSeg}${spreadSeg}
    <div class="wb-stats">${main.map(row).join('')}<details class="wb-more"><summary>${esc(W.moreStats)}</summary>${rest.map(row).join('')}</details></div>
    <p class="small">${sp ? esc(W.spLeft(SP_TOTAL - spTotal(sp))) : ''}</p>
    ${boost}
    ${!mine && wb.their ? btn(W.backToAssumed, 'wb-reset-their', {}, { cls: 'linkish' }) : ''}
    ${mine && JSON.stringify(wb.mine) !== JSON.stringify(wb.mineBase) ? btn(W.backToDraft, 'wb-reset-mine', {}, { cls: 'linkish' }) : ''}`;
}

function fieldPanel(P, wb) {
  const f = wb.field, a = f.attackerSide ?? {}, d = f.defenderSide ?? {};
  const mv = P.mech.moves[wb.move];
  const spread = mv && ['allAdjacent', 'allAdjacentFoes'].includes(mv.target);
  const t = (label, scope, key, on) => chipBtn(label, 'wb-toggle', { scope, key }, !!on);
  return `<div class="choices" role="group" aria-label="${esc(W.weather)}">${WEATHERS.map((w) => chipBtn(w || W.noWeather, 'wb-set', { scope: 'field', key: 'weather', value: w }, (f.weather ?? '') === w)).join('')}</div>
    <div class="choices" role="group" aria-label="${esc(W.terrain)}">${TERRAINS.map((w) => chipBtn(w || W.noTerrain, 'wb-set', { scope: 'field', key: 'terrain', value: w }, (f.terrain ?? '') === w)).join('')}</div>
    <div class="choices" role="group" aria-label="${esc(W.sides)}">${t(W.lightScreen, 'defenderSide', 'lightScreen', d.lightScreen)}${t(W.reflect, 'defenderSide', 'reflect', d.reflect)}${t(W.veil, 'defenderSide', 'auroraVeil', d.auroraVeil)}${t(W.helpingHand, 'attackerSide', 'helpingHand', a.helpingHand)}
      ${spread ? t(W.lone, 'defenderSide', 'loneTarget', d.partnerPresent === false) : ''}${chipBtn(W.crit, 'wb-crit', {}, wb.crit)}</div>
    ${mv?.category === 'Physical' ? `<div class="choices" role="group" aria-label="Intimidate">${[0, 1, 2].map((n) => chipBtn(n ? `Intimidate −${n}` : W.noIntimidate, 'wb-intim', { n }, wb.intimidated === n)).join('')}</div>` : ''}
    <label class="field small" for="wb-hp"><span>${esc(W.defHp)}</span><input id="wb-hp" type="number" inputmode="numeric" min="1" max="100" value="${esc(wb.defHp)}" data-pc="wb-hp"></label>`;
}

// ---------- apply / save ----------
const APPLY_FIELDS = ['nature', 'item', 'ability'];
/** What "Apply to my set" would change in your draft: field names and stats. */
function applyDiff(P, wb) {
  const a = wb.mine, b = wb.mineBase, out = [];
  for (const k of APPLY_FIELDS) if ((a[k] ?? '') !== (b[k] ?? '')) out.push(k);
  if (a.sp !== 'unknown') for (const k of STAT_IDS) if ((a.sp[k] ?? 0) !== (b.sp?.[k] ?? 0)) out.push(k);
  return out;
}
function saveCalc(P, wb) {
  if (!P.calc) return;
  const coach = wb.row.coach;
  const me = P.ownSide();
  const ws = coach && me ? P.ensureWorkspace(me, coach) : null;
  if (!ws) { P.toast(W.noMatchup); return; }
  const sc = scenarioOf(P, wb);
  const res = { result: P.calc.run(sc) };
  const now = P.now(), id = P.id('calc');
  const l = P.lineage(wb.setId);
  const mineRef = { setId: wb.setId, v: l?.currentV ?? null, side: 'mine' }, theirRef = { setId: null, v: null, side: 'theirs' };
  const mineAtk = wb.mineRole === 'attacker';
  const entry = { id, createdAt: now, pinned: false, mark: null, parentId: null, notes: W.calcNote(sourceLine(wb), JSON.stringify(wb.mine) !== JSON.stringify(wb.mineBase)), tags: [], kind: 'damage', title: '',
    scenario: sc, refs: { attacker: mineAtk ? mineRef : theirRef, defender: mineAtk ? theirRef : mineRef }, summary: summarize(res),
    pins: pinsOf(P.mech, P.engineInfo), entities: entityHashes(sc, P.mech), checkedAt: now, updatedAt: now, variantRole: null };
  if (P.mutate(`ws:${ws.id}`, (d) => { d.calcs.push(entry); })) { wb.saved = { coach, wsId: ws.id, calcId: id }; P.toast(W.savedTo(coach)); }
}

// ---------- actions ----------
const live = (P) => wbOf(P);
const setOf = (wb, side) => {
  if (side === 'mine') return wb.mine;
  if (!wb.their) wb.their = structuredClone(wb.row.set);
  return wb.their;
};
/** Their SP unknown: the spread now in use becomes explicit before an edit. */
function materialize(P, wb, side) {
  if (side !== 'theirs') return;
  const sc = scenarioOf(P, wb);
  const s = sc[wb.mineRole === 'attacker' ? 'defender' : 'attacker'].set;
  const t = setOf(wb, 'theirs');
  if (t.sp === 'unknown') { t.sp = { ...s.sp }; if (!t.nature) t.nature = s.nature; }
}
export const actions = {
  'wb-close': (t, P) => close(P),
  'wb-tab': (t, P) => { const wb = live(P); if (wb) { wb.tab = t.dataset.tab; P.app.rerender(); } },
  'wb-spread': (t, P) => { const wb = live(P); if (wb) { wb.spread = t.dataset.k; P.app.rerender(); } },
  'wb-set': (t, P) => { const wb = live(P); if (!wb) return; if (t.dataset.scope === 'field') wb.field[t.dataset.key] = t.dataset.value; P.app.rerender(); },
  'wb-toggle': (t, P) => {
    const wb = live(P); if (!wb) return;
    const s = (wb.field[t.dataset.scope] ??= {});
    if (t.dataset.key === 'loneTarget') s.partnerPresent = s.partnerPresent === false; else s[t.dataset.key] = !s[t.dataset.key];
    P.app.rerender();
  },
  'wb-crit': (t, P) => { const wb = live(P); if (wb) { wb.crit = !wb.crit; P.app.rerender(); } },
  'wb-intim': (t, P) => { const wb = live(P); if (wb) { wb.intimidated = Number(t.dataset.n) || 0; P.app.rerender(); } },
  'wb-reset-their': (t, P) => { const wb = live(P); if (wb) { wb.their = null; wb.theirMode = null; P.app.rerender(); } },
  'wb-their-mode': (t, P) => { const wb = live(P); if (!wb) return; wb.theirMode = t.dataset.mode === 'worst' ? 'worst' : null; wb.their = wb.theirMode ? worstCaseOf(P, wb.row, wb.move) : null; P.app.rerender(); },
  'wb-reset-mine': (t, P) => { const wb = live(P); if (wb) { wb.mine = structuredClone(wb.mineBase); P.app.rerender(); } },
  // your side into the set's draft (never a version): Save version in the editor keeps it
  'wb-apply': (t, P) => {
    const wb = live(P); if (!wb || !applyDiff(P, wb).length) return;
    const m = wb.mine;
    if (!P.lineage(wb.setId)) return;
    updateDraft(P, wb.setId, (c) => { c.data.nature = m.nature; c.data.item = m.item; c.data.ability = m.ability; if (m.sp !== 'unknown') c.data.sp = { ...m.sp }; }, { render: false });
    wb.mineBase = structuredClone(wb.mine);
    P.toast(W.applied);
    P.app.rerender();
  },
  'wb-save-calc': (t, P) => { const wb = live(P); if (wb) { saveCalc(P, wb); P.app.rerender(); } },
  // the calc replaces the workbench's own history entry (closing with history.back() and then pushing would race: the
  // async back would land after the push and undo it)
  'wb-open-calcs': (t, P) => { const wb = live(P); if (!wb?.saved) return; const s = wb.saved; P.ui.wb = null; P.go({ view: 'ws', wsId: s.wsId, kind: 'calcs', id: s.calcId }, { push: P.app.history.state?.wb ? false : true }); },
};
export const changes = {
  'wb-sp': (t, P) => {
    const wb = live(P); if (!wb) return;
    materialize(P, wb, t.dataset.side);
    const s = setOf(wb, t.dataset.side);
    if (s.sp === 'unknown') return;
    s.sp = { ...s.sp, [t.dataset.stat]: Math.max(0, Math.min(SP_PER_STAT, Number(t.value) || 0)) };
    P.app.rerender();
  },
  'wb-field-set': (t, P) => { const wb = live(P); if (!wb) return; materialize(P, wb, t.dataset.side); setOf(wb, t.dataset.side)[t.dataset.key] = t.value; P.app.rerender(); },
  'wb-boost': (t, P) => { const wb = live(P); if (!wb) return; wb.boosts[t.dataset.side === 'mine' ? 'mine' : 'theirs'] = Number(t.value) || 0; P.app.rerender(); },
  'wb-hp': (t, P) => { const wb = live(P); if (!wb) return; wb.defHp = Math.max(1, Math.min(100, Math.trunc(Number(t.value) || 100))); P.app.rerender(); },
};
export const inputs = {
  // while dragging: the row and the result update in place (one engine run, no re-render); the change event commits
  'wb-sp-live': (t, P) => {
    const wb = live(P); if (!wb) return;
    const row = t.closest?.('.wb-srow');
    const v = Math.max(0, Math.min(SP_PER_STAT, Number(t.value) || 0));
    if (row) {
      const n = row.querySelector('.wb-num'); if (n) n.textContent = String(v);
      const f = row.querySelector('.wb-fin'); if (f) f.textContent = String(statValue(row.dataset.stat, Number(row.dataset.base), v, row.dataset.sign));
    }
    if (live.frame) return;
    const raf = globalThis.requestAnimationFrame ?? ((fn) => setTimeout(fn, 16));
    live.frame = raf(() => {
      live.frame = null;
      const w = live(P); if (!w) return;
      const trial = structuredClone(w);
      materialize(P, trial, t.dataset.side);
      const s = setOf(trial, t.dataset.side);
      if (s.sp !== 'unknown') s.sp = { ...s.sp, [t.dataset.stat]: Number(t.value) || 0 };
      const el = globalThis.document?.getElementById?.('wb-result');
      if (el) el.innerHTML = resultHtml(P, trial);
    });
  },
};

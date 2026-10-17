// "Can wreck you" (the matchup Brief) and "Threats to this mon" (the teambuilder): the worst-case threat scan
// (lib/threat-scan.mjs, docs/research/strategy/threat-scan.md §2) of an opponent's drafted 10 into your saved sets. Every
// row says its conditions ("if Sheer Force + Life Orb", the weather) and whether it is their ladder set or a learnset
// worst case. Computed in idle time, cached per (their pool, your sets, usage month); tap a row → the workbench.
import { scanThreats, zardKOs, spreadDoubles, priorityKOs, topPerMon, threatsTo, typeEffFrom } from '../lib/threat-scan.mjs';
import { worstCaseAttacker } from '../lib/move-search.mjs';
import { currentVersion } from '../lib/prep-model.mjs';
import { myForme } from '../lib/prep-build.mjs';
import * as C from './prep-copy.js';
import { esc } from './prep-ui.js';
import * as WB from './prep-workbench.js';

const T = C.THREATS;
/** Your sets as scan targets: one per species of your 10, Stat Points known. [{key (setId), set}] */
export function myTargets(P) {
  const me = P.myCoach();
  const roster = new Set(P.coachRoster(me));
  const seen = new Set(), out = [];
  for (const l of P.mineSets()) {
    if (!roster.has(l.speciesId) || seen.has(l.speciesId)) continue;
    const d = currentVersion(l).data;
    if (d.sp === 'unknown') continue;
    seen.add(l.speciesId);
    out.push({ key: l.id, set: { species: l.speciesId, ...structuredClone(d), moves: (d.moves ?? []).filter(Boolean) } });
  }
  return out;
}
const poolOf = (P, coach) => (P.league()?.coaches.find((c) => c.name === coach)?.picks ?? []).filter((p) => p.id).map((p) => ({ species: p.id, coach }));

/** The scan rows for (coach, targets), or null while they are computed (one idle job per key). */
export function rowsFor(P, coach, targets) {
  if (!P.calc || !P.mech || !P.engine || !targets.length) return null;
  const pool = poolOf(P, coach);
  const usage = P.app.usage?.() ?? null;
  const key = JSON.stringify(['threats', coach, pool.map((p) => p.species), targets.map((t) => [t.key, t.set]), usage?.month ?? null]);
  P.threatCache ??= new Map();
  if (P.threatCache.has(key)) return P.threatCache.get(key);
  const run = () => {
    let rows = [];
    try { rows = scanThreats(P.calc, P.mech, pool, targets, { usage, typeEff: typeEffFrom(P.engine) }); } catch (e) { console.error('Threat scan failed:', e && e.message); }
    if (P.threatCache.size > 20) P.threatCache.delete(P.threatCache.keys().next().value);
    P.threatCache.set(key, rows);
  };
  const idle = globalThis.requestIdleCallback;
  if (typeof idle !== 'function') { run(); return P.threatCache.get(key); }
  P.threatJobs ??= new Set();
  if (!P.threatJobs.has(key)) { P.threatJobs.add(key); idle(() => { run(); P.threatJobs.delete(key); P.app.rerender(); }, { timeout: 1500 }); }
  return null;
}

// ---------- words ----------
const tname = (P, targets, key) => { const t = targets.find((x) => x.key === key); return t ? P.spName(myForme(P.mech, t.set)) : key; };
/** "if Sheer Force + Life Orb, in sun": what the row assumes. */
function conditions(P, r) {
  const parts = [P.name('abilities', r.ability), r.mega ? '' : r.item ? P.name('items', r.item) : T.noItem].filter(Boolean);
  const f = r.field.weather ? T.weather(r.field.weather, !!r.field.by?.mine) : r.field.terrain ? T.terrain(r.field.terrain) : '';
  return `${T.ifCond(parts.join(' + '))}${f ? `, ${f}` : ''}`;
}
const oddsText = (r) => (r.sash ? T.sash : r.odds >= 1 ? 'OHKO' : r.odds > 0 ? T.odds(Math.round(r.odds * 100)) : T.noKo);
function line(P, r, targets, { who = true } = {}) {
  const label = r.ladderSet ? T.ladder : T.worst;
  const mon = P.spName(r.forme);
  return `<li class="tw-row${r.odds >= 1 ? ' ko' : ''}"><button type="button" class="tw-open linkish" data-pa="tw-wb" data-coach="${esc(r.coach ?? '')}" data-forme="${esc(r.forme)}" data-species="${esc(r.species)}" data-ability="${esc(r.ability)}" data-item="${esc(r.item)}" data-move="${esc(r.move)}" data-target="${esc(r.target)}" data-weather="${esc(r.field.weather)}" data-terrain="${esc(r.field.terrain)}" aria-label="${esc(T.openAria(mon, P.name('moves', r.move), tname(P, targets, r.target)))}">
    ${who ? `<b>${esc(mon)}</b> ` : ''}${esc(P.name('moves', r.move))}${r.spread ? ` <span class="chip">${esc(T.spread)}</span>` : ''}${r.priority ? ` <span class="chip">${esc(T.priority)}</span>` : ''} → ${esc(T.your(tname(P, targets, r.target)))}: <b>${r.lo}–${r.hi}%</b> · ${esc(oddsText(r))}</button>
    <span class="small muted">${esc(conditions(P, r))} · <span class="tw-src">${esc(label)}</span></span></li>`;
}

/**
 * The scan of one opponent's 10 into your saved sets, for the rest of the Brief (pool badges, plan order): rows, or null
 * when it isn't ready / you have no saved sets. The worst case per mon is topPerMon(rows, 1).
 */
export function scanFor(P, coach) {
  const targets = myTargets(P);
  if (!targets.length) return null;
  P.ensureEngine();
  return rowsFor(P, coach, targets);
}
/** The mons of theirs whose worst case OHKOs one of yours (plausibility ≥ 0.6): Map species → that row. */
export function wreckers(rows) {
  const out = new Map();
  for (const r of rows ?? []) if (r.odds >= 0.5 && r.plausibility >= 0.6 && !out.has(r.species)) out.set(r.species, r);
  return out;
}
/** One line for a pool card: "Rock Slide → your Charizard-Mega-Y 153–183%". */
export function worstLine(P, r) {
  const t = myTargets(P).find((x) => x.key === r.target);
  return T.worstLine(P.name('moves', r.move), t ? P.spName(myForme(P.mech, t.set)) : '', r.lo, r.hi, r.odds >= 1);
}

/** The Brief section body for one opponent (their 10 into your sets), or '' when there is nothing to scan into. */
export function briefBody(P, coach) {
  const targets = myTargets(P);
  if (!targets.length) return `<p class="small">${esc(T.noSets)}</p>`;
  P.ensureEngine();
  const rows = rowsFor(P, coach, targets);
  if (rows === null) return `<p class="small muted">${esc(P.engineState === 'failed' ? T.engineFailed : T.working)}</p>`;
  const z = zardKOs(rows).slice(0, 6), d = spreadDoubles(rows).slice(0, 5), pr = priorityKOs(rows).slice(0, 5);
  const per = topPerMon(rows, 3);
  const dl = d.map((x) => `<li class="tw-row ko"><b>${esc(P.spName(x.row.forme))}</b> ${esc(P.name('moves', x.row.move))} <span class="chip">${esc(T.spread)}</span> → ${x.targets.map((t) => `${esc(T.your(tname(P, targets, t.target)))} ${t.lo}–${t.hi}%`).join(' + ')}
    <span class="small muted">${esc(conditions(P, x.row))} · ${esc(x.row.ladderSet ? T.ladder : T.worst)}</span></li>`).join('');
  const mons = [...per].filter(([, list]) => list.length).map(([sp, list]) => `<li class="tw-mon"><p class="tw-h">${P.pt(sp, { size: 'sm' })} <b>${esc(P.spName(sp))}</b></p><ul>${list.map((r) => line(P, r, targets, { who: r.forme !== sp })).join('')}</ul></li>`).join('');
  return `<p class="small">${esc(T.intro)}</p>
    ${z.length ? `<h4>${esc(T.zardHead)}</h4><ul class="tw-list">${z.map((r) => line(P, r, targets)).join('')}</ul>` : ''}
    ${dl ? `<h4>${esc(T.doubleHead)}</h4><ul class="tw-list">${dl}</ul>` : ''}
    ${pr.length ? `<h4>${esc(T.priorityHead)}</h4><ul class="tw-list">${pr.map((r) => line(P, r, targets)).join('')}</ul>` : ''}
    <details class="tw-all"><summary>${esc(T.perMon)}</summary><ul class="tw-mons">${mons || `<li class="small">${esc(T.nothing)}</li>`}</ul></details>`;
}

/** The teambuilder's "Threats to this mon": the scope's opponents (one, or the league) into the set being edited. */
export function editorBody(P, l, set, coaches) {
  P.ensureEngine();
  if (set.sp === 'unknown') return '';
  const target = [{ key: l.id, set: { ...set } }];
  const lists = coaches.map((c) => rowsFor(P, c, target));
  if (lists.some((x) => x === null)) return `<p class="small muted">${esc(P.engineState === 'failed' ? T.engineFailed : T.working)}</p>`;
  const rows = lists.flat().sort((a, b) => b.severity - a.severity || b.lo - a.lo);
  const top = threatsTo(rows, l.id, 6);
  return top.length ? `<ul class="tw-list">${top.map((r) => line(P, { ...r }, target).replace('<b>', `<span class="small muted">${esc(r.coach ?? '')}</span> <b>`)).join('')}</ul>` : `<p class="small">${esc(T.safe)}</p>`;
}

export const actions = {
  'tw-wb': (t, P) => {
    const d = t.dataset;
    const mine = myTargets(P).find((x) => x.key === d.target) ?? (() => { const l = P.docs.mysets.sets.find((s) => s.id === d.target); if (!l) return null; const v = P.docs.mysets.drafts?.[l.id]?.data ?? currentVersion(l).data; return { key: l.id, set: { species: l.speciesId, ...structuredClone(v), moves: (v.moves ?? []).filter(Boolean) } }; })();
    if (!mine || !P.mech) return;
    const mega = d.forme !== d.species;
    const r = { species: d.species, abilities: [{ id: d.ability, forme: d.forme, synergy: [d.move] }] };
    const atk = worstCaseAttacker(P.mech, r, d.move);
    if (!mega) atk.set.item = d.item;
    WB.open(P, { setId: mine.key, mine: mine.set, row: { key: `threat|${d.forme}`, coach: d.coach || null, species: d.species, forme: d.forme, mega, set: atk.set, source: 'search' }, move: d.move, mineRole: 'defender',
      field: { ...(d.weather ? { weather: d.weather } : {}), ...(d.terrain ? { terrain: d.terrain } : {}) } });
  },
};

// Build: your 10 and your 6 as Showdown-style team cards (structure only: no Showdown code, CSS or assets), and the per-mon
// dashboard (docs/research/ux/builder-dashboard.md v2): set editor, Compare options (current + up to 3 trials), speed and
// creep targets, your hits at +0/+1/+2, KO benchmarks with slack, their hits on you and the Brief's facts for this mon.
// Pure logic is lib/prep-build.mjs; this file renders and wires it. Trials live in the screen draft (P.ui, this tab) until
// "Save as a new version" (an explicit tap, the existing promote path). Nothing here writes on view; no schema change.
import { checkSet, legalAbilities, learnset, battleForme } from '../lib/calc/mech.mjs';
import { STAT_IDS, SP_PER_STAT, SP_TOTAL, spTotal, statValue, natureSign } from '../lib/calc/stats.mjs';
import { currentVersion, asSet, defaultVariant, newLineage } from '../lib/prep-model.mjs';
import * as B from '../lib/prep-build.mjs';
import * as C from './prep-copy.js';
import { esc, btn, chipBtn, h2, select, resultBlock, koWords, term } from './prep-ui.js';
import { variantOf, theirSetFor, myTeamRows, editor, spMeter } from './prep-sets.js';
import { promote } from './prep-calcs.js';
import { modelFor } from './prep-matchup.js';

const MAX_TRIALS = 3, MAX_PINS = 4;
const pct = (n, d) => (d ? Math.floor((1000 * n) / d) / 10 : 0);
const WEATHERS = ['auto', '', 'Sun', 'Rain', 'Sand', 'Snow'];

// ---------- state and context ----------
/** Screen draft for the dashboards of one workspace (session only). */
const bui = (P, wsId) => {
  const bd = (P.wsUi(wsId).bd ??= { v: 2, open: {}, pins: {}, trials: {}, editing: null, field: 'auto', hitStage: 0, spread: 'common', tw: { mine: false, theirs: false, tr: false }, phoneOpt: 0 });
  if (bd.v !== 2) { bd.v = 2; bd.field = 'auto'; } // a draft from before Auto weather: '' there meant the default, not a choice
  return bd;
};
/** A small per-session cache of engine results, keyed by the full question (never saved). */
function memo(P, key, fn) {
  P.buildCache ??= new Map();
  if (P.buildCache.has(key)) return P.buildCache.get(key);
  if (P.buildCache.size > 4000) P.buildCache.clear();
  const v = fn();
  P.buildCache.set(key, v);
  return v;
}
const nm = (P) => (id) => P.mech?.moves[id]?.name ?? P.mech?.items[id]?.name ?? P.mech?.natures[id]?.name ?? P.mech?.abilities[id]?.name ?? P.spName(id);
/** The matchup and the mon the route names (your n-th pick), with its set: the one in your 6, else your first set for it. */
function ctxOf(P) {
  const m = P.match();
  const ws = m?.ws ?? (P.route.wsId ? P.ws.get(P.route.wsId) : null);
  if (!m || !ws) return null;
  const n = P.route.detail?.side === 'build' ? P.route.detail.n : null;
  const id = n ? m.pov.picks[n - 1]?.id ?? null : null;
  const inSix = new Set(ws.my6.map((x) => x.setId));
  const sets = id ? P.mineSets().filter((s) => s.speciesId === id) : [];
  const l = sets.find((s) => inSix.has(s.id)) ?? sets[0] ?? null;
  return { m, ws, n, id, l };
}
/** Their pool as target rows (lib/prep-build targetsOf): their saved set (the calcs' version), else a labelled ladder guess. */
function targets(P, ws) {
  if (!P.mech) return [];
  const usage = P.app.usage?.() ?? null;
  const v = defaultVariant(ws) ?? variantOf(P, ws);
  const pool = P.rosterSpecies(ws);
  const saved = (sp) => { const l = theirSetFor(ws, v, sp) ?? ws.theirSets.find((s) => s.speciesId === sp); return l ? currentVersion(l).data : null; };
  const key = JSON.stringify(['t', ws.id, pool, usage?.month ?? null, pool.map((sp) => saved(sp))]);
  return memo(P, key, () => B.targetsOf(P.mech, pool, { usage, dexSpecies: (id) => P.dexSp(id), savedSet: saved, asOf: P.now().slice(0, 10) }));
}
const rowName = (P, row) => P.spName(row.forme);
const rowSource = (row) => (row.source === 'set' ? C.BUILD.evidence.set : row.source === 'ladder' ? `ladder guess${row.usageFrom === 'base' ? ' (base-species usage)' : row.usageFrom === 'keymoves' ? ' (key moves only)' : ''}` : 'no set: range');
/**
 * The field for one of your options against one target: the weather you chose, or on Auto (the default) the weather an
 * ability on the field sets (your Mega's Drought, their Drizzle…; lib/prep-build autoWeather), never silently none.
 */
const fieldOf = (P, bd, set, row) => {
  if (bd.field !== 'auto' && bd.field !== undefined) return bd.field ? { weather: bd.field } : {};
  const w = P.mech ? B.autoWeather(P.mech, set, row) : null;
  return w?.weather ? { weather: w.weather } : {};
};

// ---------- weather words ----------
const abName = (P, id) => P.mech?.abilities[id]?.name ?? id;
/** "Sun (your Drought)" / "none": the Auto weather of your set alone (row null) or against one target. */
function weatherWords(P, set, row) {
  if (!P.mech) return '';
  const w = B.autoWeather(P.mech, set, row);
  if (!w.weather) return C.BUILD.fieldNone;
  const src = w.by === 'mine' ? C.BUILD.yourAbility(abName(P, w.mine.ability)) : C.BUILD.theirAbility(rowName(P, row), abName(P, w.theirs.ability));
  return `${w.weather} (${src})${w.contested ? `; ${C.BUILD.contested(rowName(P, row), abName(P, w.theirs.ability), w.theirs.weather)}` : ''}`;
}
/** Under the field bar on Auto: your weather, and every target in their pool whose ability sets (or replaces) it. */
function weatherNote(P, set, rows) {
  if (!P.mech) return '';
  const lines = rows.map((row) => ({ row, w: B.autoWeather(P.mech, set, row) })).filter((x) => x.w.theirs);
  return `<p class="small">${esc(C.BUILD.autoNote(weatherWords(P, set, null)))}${lines.length ? ` ${esc(C.BUILD.theirSetters(lines.map((x) => `${rowName(P, x.row)}: ${weatherWords(P, set, x.row)}`).join(' · ')))}` : ''}</p>`;
}

// ---------- result words ----------
/** Short KO words for one exact result: "KO every roll 105–125%" / "KO 13 of 16 98–115%" / "no KO 80–96%". */
function koShort(r) {
  if (!r || r.class !== 'exact') return C.CLASS[r?.class] || C.CLASS.refused;
  const k = r.ko.one, lo = pct(r.range.min, r.maxHP), hi = pct(r.range.max, r.maxHP);
  if (k.refused !== undefined) return `${lo}–${hi}%`;
  const n = BigInt(k.num), d = BigInt(k.den);
  const hits = Math.max(...r.move.dist.map((x) => x.n));
  const w = n === d ? 'KO every roll' : n === 0n ? 'no KO' : hits === 1 && 16n % d === 0n ? `KO ${Number((n * 16n) / d)} of 16` : koWords(k, { hits });
  return `${w} ${lo}–${hi}%`;
}
const koFrac = (r) => (r?.class === 'exact' && r.ko.one.refused === undefined ? Number(r.ko.one.num) / Number(r.ko.one.den) : null);
/** A result cell: the words, then the full trust anatomy (every assumption chip) one tap away. */
function cell(P, res, names, delta = '') {
  if (!res) return `<span class="small muted">${esc(C.BUILD.loading)}</span>`;
  const r = res.result;
  return `<details class="bcell"><summary><span class="bword">${esc(koShort(r))}</span>${res.spread && res.spread !== 'set' ? ` <span class="small muted">(${esc(res.spread)})</span>` : ''}${delta}</summary>${resultBlock(r, names)}</details>`;
}
const deltaOf = (cur, x, mine = true) => {
  const a = koFrac(cur), b = koFrac(x);
  if (a === null || b === null || a === b) return '';
  const better = mine ? b > a : b < a;
  return ` <span class="delta ${better ? 'up' : 'down'}">${esc(better ? C.BUILD.better : C.BUILD.worse)}</span>`;
};

// ---------- builder (the Build section) ----------
export function screen(P, ctx) {
  if (ctx.r.detail?.side === 'build') return dashboard(P, ctx);
  return builder(P, ctx);
}
function builder(P, { pov, opp, ws }) {
  const head = `${h2(C.BUILD.head(pov.name, opp.name))}<p>${btn(C.BUILD.paste, 'go-import', { side: 'mine' })} ${btn(C.BUILD.export, 'bd-export')}</p>`;
  if (!P.canWriteMine()) return `${head}<p class="small">🔒 ${esc(C.POV.mineViewing(pov.name))}</p><ul class="minirow">${pov.picks.filter((p) => p.id).map((p) => `<li>${P.pt(p.id, { size: 'sm' })} ${esc(P.spName(p.id))}</li>`).join('')}</ul>`;
  const six = ws.my6.map((x) => P.lineage(x.setId)).filter(Boolean);
  const slot = (sp) => pov.picks.findIndex((p) => p.id === sp) + 1;
  const cards = six.map((l) => teamCard(P, l, slot(l.speciesId))).join('');
  const warn = [];
  if (six.length > 6) warn.push(C.BUILD.overSix);
  if (P.mech) {
    const megas = six.filter((l) => P.mech.items[currentVersion(l).data.item]?.megaStone).length;
    if (megas > 1) warn.push(C.BUILD.oneMega(megas));
    const nums = new Map();
    for (const l of six) { const k = P.mech.species[l.speciesId]?.num; nums.set(k, [...(nums.get(k) ?? []), P.spName(l.speciesId)]); }
    for (const v of nums.values()) if (v.length > 1) warn.push(C.BUILD.speciesClause(v.join(' + ')));
  }
  const dash = pov.picks.filter((p) => p.id && (!P.mech || (P.mech.species[p.id] && !P.mech.species[p.id].mega))).map((p) => btn(P.spName(p.id), 'build-open', { n: slot(p.id) }, { cls: 'linkish' })).join(' ');
  const theirs = P.rosterSpecies(ws).map((sp) => `<li><button type="button" class="pmini" data-pa="brief-open" data-side="their" data-n="${opp.picks.findIndex((p) => p.id === sp) + 1}" aria-label="${esc(`${P.spName(sp)}. Details`)}">${P.pt(sp, { size: 'xs' })}<span class="pname">${esc(P.spName(sp))}</span></button></li>`).join('');
  return `<div class="build">${head}
    <h3>${esc(C.BUILD.six(six.length))}</h3>
    ${warn.map((w) => `<p class="banner warn">${esc(w)}</p>`).join('')}
    ${six.length ? `<ul class="bteam">${cards}</ul>` : `<p class="small">${esc(P.mineSets().length ? C.BUILD.noSix : C.BUILD.noSets)}</p>`}
    <h3>${esc(C.BUILD.ten)}</h3>${myTeamRows(P, ws)}
    <p class="small">${esc(C.BUILD.dashFor)} ${dash}</p>
    <h3>${esc(C.BUILD.theirPool)}</h3><ul class="mystrip">${theirs}</ul></div>`;
}
/** One Showdown-style row: portrait, name/set/types | item, ability, nature | four moves | stats with bars and SP. */
function teamCard(P, l, n) {
  const cur = currentVersion(l), d = cur.data, sp = l.speciesId;
  const f = P.mech ? battleForme(P.mech, sp, d.item) : { error: true };
  const forme = P.mech?.species[f.error ? sp : f.id];
  const types = (forme?.types ?? []).map((t) => `<span class="ty ty-${esc(t.toLowerCase())}">${esc(t)}</span>`).join('');
  const nat = P.mech?.natures[d.nature];
  const natLine = nat ? `${P.name('natures', d.nature)}${nat.plus && nat.plus !== nat.minus ? ` +${C.STAT_SHORT[nat.plus]} −${C.STAT_SHORT[nat.minus]}` : ''}` : d.nature || '—';
  const stats = d.sp !== 'unknown' && forme && nat ? STAT_IDS.map((s) => {
    const v = statValue(s, forme.baseStats[s], d.sp[s] ?? 0, natureSign(nat, s));
    return `<span class="bstat"><span class="bs-l">${C.STAT_SHORT[s]}</span><span class="bs-v">${v}</span><span class="bs-bar" aria-hidden="true"><span style="width:${Math.min(100, v / 2.5)}%"></span></span><span class="bs-sp">${d.sp[s] ?? 0}</span></span>`;
  }).join('') : `<span class="small muted">${esc(C.BUILD.spUnknown)}</span>`;
  const label = `${P.spName(sp)}, ${l.name || 'Set'} v${l.currentV}. ${C.BUILD.dashFor.replace(':', '')}`;
  return `<li><button type="button" class="bcard" data-pa="build-open" data-n="${n}" aria-label="${esc(label)}">
    <span class="bc-who">${P.pt(sp, { size: 'md' })}<span><b>${esc(P.spName(sp))}</b><br><span class="small">${esc(`${l.name || 'Set'} v${l.currentV}`)}</span><br><span class="types">${types}</span></span></span>
    <span class="bc-det small"><span>Item: ${esc(P.name('items', d.item) || 'none')}</span><span>Ability: ${esc(f.mega && forme ? forme.abilities[0] : P.name('abilities', d.ability) || '—')}</span><span>Nature: ${esc(natLine)}</span></span>
    <span class="bc-moves small">${(d.moves ?? []).map((m) => `<span>${esc(P.name('moves', m))}</span>`).join('')}</span>
    <span class="bc-stats small">${stats}${d.sp !== 'unknown' ? `<span class="bs-tot">${spTotal(d.sp)}/${SP_TOTAL} SP</span>` : ''}</span></button></li>`;
}

// ---------- the dashboard ----------
function sectionBtn(id, title, summary, open) {
  return `<div class="bsec-h"><button type="button" class="bsec-t" data-pa="bd-sec" data-sec="${id}" aria-expanded="${open}" aria-controls="bd-${id}"><span class="bsec-name">${esc(title)}</span> <span class="bsec-sum">${esc(summary)}</span> <span aria-hidden="true">${open ? '▾' : '▸'}</span></button></div>`;
}
function dashboard(P, { pov, opp, ws }) {
  const c = ctxOf(P);
  const back = btn(C.BUILD.back, 'back', {}, { cls: 'back', aria: 'Back to Build' });
  if (!c?.id) return `${back}${h2(C.BUILD.notDrafted)}`;
  const name = P.spName(c.id);
  if (!P.canWriteMine()) return `${back}${h2(name)}<p class="small">🔒 ${esc(C.POV.mineViewing(pov.name))}</p>${matchSection(P, pov, opp, ws, c.id, true)}`;
  if (!c.l) return `${back}${h2(name)}<p>${esc(C.BUILD.noSetYet(name))} ${btn(C.BUILD.createSet, 'my-create', { species: c.id }, { primary: true })}</p>${matchSection(P, pov, opp, ws, c.id, true)}`;
  const l = c.l, bd = bui(P, ws.id);
  const set = asSet(l, currentVersion(l));
  const errs = P.mech ? checkSet(P.mech, set, { side: 'mine' }).filter((p) => p.severity === 'error') : [];
  const usable = P.mech && !errs.length && set.sp !== 'unknown';
  if (usable) P.ensureEngine();
  const rows = targets(P, ws);
  const pins = (bd.pins[l.id] ?? B.defaultPins(rows, 2)).filter((k) => rows.some((r) => r.key === k));
  const pinned = pins.map((k) => rows.find((r) => r.key === k));
  const saved = rows.filter((r) => r.source === 'set').length, ladder = rows.filter((r) => r.source === 'ladder').length;
  const engine = P.calc ? '' : P.engineState === 'failed' ? `<p class="banner warn">${esc(C.BUILD.engineFailed)} ${btn(C.BUILD.retry, 'calc-retry-engine')}</p>` : '';
  const bar = `<div class="bbar" role="group" aria-label="${esc(C.BUILD.checking)}"><p class="small"><b>${esc(C.BUILD.checking)}</b> ${esc(C.BUILD.theirSetsLine(opp.name, rows.length, saved, ladder))}</p>
    <div class="choices">${select('bd-field', WEATHERS.map((w) => [w, w === 'auto' ? C.BUILD.autoWeather(weatherWords(P, set, null)) : w || C.BUILD.fieldNone]), bd.field, { data: { pc: 'bd-field' }, aria: 'Weather' })}<span class="small muted">${esc(C.BUILD.single)}</span></div>
    ${bd.field === 'auto' ? weatherNote(P, set, rows) : `<p class="small">${esc(C.BUILD.weatherChosen(bd.field || C.BUILD.fieldNone))}</p>`}
    <div class="choices" role="group" aria-label="${esc(C.BUILD.pins)}"><span class="small">${esc(C.BUILD.pins)}:</span> ${rows.map((r) => chipBtn(rowName(P, r), 'bd-pin', { key: r.key }, pins.includes(r.key), { disabled: !pins.includes(r.key) && pins.length >= MAX_PINS })).join('')}</div>
    <p class="small muted">${esc(C.BUILD.pinHelp)} ${esc(C.SCOPE)}</p></div>`;
  const parts = [];
  // ① Set (no engine)
  const setSum = `${P.name('natures', set.nature)} · ${set.sp === 'unknown' ? '?' : STAT_IDS.map((s) => set.sp[s] ?? 0).join('/')} · ${set.moves.map((m) => P.name('moves', m)).join(', ')}`;
  parts.push(`<section class="bsec bsec-set" id="bd-set">${sectionBtn('set', `① ${C.BUILD.sec.set}`, setSum, !!bd.open.set)}
    ${spareHint(P, set, pinned, bd)}${bd.open.set ? `<div class="bembed">${editor(P, null, l, { embedded: true })}</div>` : ''}</section>`);
  // ② Compare options (always open)
  parts.push(`<section class="bsec bsec-cmp" id="bd-compare"><h3>② ${esc(C.BUILD.sec.compare)} ${term('Trial option')}</h3>${!usable ? `<p class="banner warn">${esc(errs.length ? C.BUILD.fixFirst : C.BUILD.spUnknown)}</p>` : P.calc ? compareSection(P, ws, l, set, pinned, rows, bd) : engine || `<p class="small">${esc(C.BUILD.loading)}</p>`}</section>`);
  // ③ Speed (no engine)
  const spd = usable ? speedSummary(P, set, rows, bd, opp.name) : '';
  parts.push(`<section class="bsec" id="bd-speed">${sectionBtn('speed', `③ ${C.BUILD.sec.speed}`, spd, !!bd.open.speed)}${bd.open.speed && usable ? speedSection(P, set, rows, bd, l) : ''}</section>`);
  // ④–⑥ engine sections, computed only while open
  for (const [id, label, fn] of [['hits', `④ ${C.BUILD.sec.hits}`, hitsSection], ['bench', `⑤ ${C.BUILD.sec.bench}`, benchSection], ['theirs', `⑥ ${C.BUILD.sec.theirs}`, theirSection]]) {
    const open = !!bd.open[id];
    parts.push(`<section class="bsec" id="bd-${id}">${sectionBtn(id, label, id === 'bench' ? pinned.map((r) => rowName(P, r)).join(', ') : '', open)}${open ? (!usable ? '' : P.calc ? fn(P, ws, l, set, pinned, rows, bd) : engine || `<p class="small">${esc(C.BUILD.loading)}</p>`) : ''}</section>`);
  }
  parts.push(`<section class="bsec" id="bd-match">${sectionBtn('match', `⑦ ${C.BUILD.sec.match}`, '', !!bd.open.match)}${bd.open.match ? matchSection(P, pov, opp, ws, c.id, false) : ''}</section>`);
  return `<div class="build dash">${back}${h2(`${name} · "${l.name || 'Set'}" v${l.currentV}`)}
    <p>${btn('Copy as Showdown text', 'set-copy', { set: l.id })}</p>${bar}${parts.join('')}<p class="small muted">${esc(C.BUILD.scope)}</p></div>`;
}

// ---------- ① spare SP hint ----------
function spareHint(P, set, pinned, bd) {
  if (!P.mech || set.sp === 'unknown' || !(set.sp.spe > 0) || !pinned.length) return '';
  const forme = B.myForme(P.mech, set);
  const cond = { tailwind: bd.tw.mine };
  const now = B.mySpeed(P.mech, set, forme, cond), zero = B.mySpeed(P.mech, { ...set, sp: { ...set.sp, spe: 0 } }, forme, cond);
  const same = pinned.every((r) => { const rg = B.targetSpeed(P.mech, r, { tailwind: bd.tw.theirs }); return B.speedVerdict(now, rg, { trickRoom: bd.tw.tr }) === B.speedVerdict(zero, rg, { trickRoom: bd.tw.tr }); });
  return same ? `<p class="small hint">💡 ${esc(C.BUILD.spareHint(set.sp.spe, pinned.length))}</p>` : '';
}

// ---------- ② Compare options ----------
function optionsOf(P, l, set, bd) {
  const trials = (bd.trials[l.id] ?? []).filter((t) => t && t.set);
  return [{ key: 'current', label: C.BUILD.current, set, costs: [] }, ...trials.map((t, i) => ({ key: `t${i}`, i, label: `${C.BUILD.trial(i)}: ${t.label}`, set: { ...t.set, species: set.species }, costs: t.cost ?? [], trial: t }))];
}
/** Your strongest damaging move into a target row (highest max damage at +0, their common spread), cached. */
function bestMove(P, set, row, bd) {
  const atk = B.myAttacks(P.mech, set);
  let best = null, top = -1;
  for (const mv of atk) {
    const r = hit(P, set, row, mv, { field: fieldOf(P, bd, set, row) }).result;
    if (r.class === 'exact' && r.range.max / r.maxHP > top) { top = r.range.max / r.maxHP; best = mv; }
  }
  return best ?? atk[0] ?? null;
}
const hit = (P, set, row, move, opts = {}) => memo(P, JSON.stringify(['h', set, row.key, row.set, row.common, move, opts]), () => B.hitResult(P.calc, P.mech, set, row, move, opts));
const theirHitOn = (P, set, row, move, bd) => memo(P, JSON.stringify(['th', set, row.key, row.set, row.common, move, fieldOf(P, bd, set, row)]), () => B.theirHit(P.calc, P.mech, set, row, move, { field: fieldOf(P, bd, set, row) }));

function compareSection(P, ws, l, set, pinned, rows, bd) {
  const opts = optionsOf(P, l, set, bd);
  const statOf = (mv) => B.moveStats(P.mech, mv)?.atk ?? 'spa';
  const myMain = B.myAttacks(P.mech, set)[0];
  const stat = myMain ? statOf(myMain) : 'spa';
  // seeds: the setup seed keeps the attacking SP its KO benchmark needs (every roll, else 15 of 16) against the first pinned
  // target that raises its own defence before you move (the row a setup turn has to beat), else the first pinned target
  let setupNeed = null;
  const setup = B.setupMoveFor(P.mech, set.species, stat);
  if (setup && pinned[0] && myMain && !set.moves.includes(setup.move)) {
    const swapped = B.swapInMove(P.mech, set, setup.move).set;
    const def = B.moveStats(P.mech, myMain).def;
    const firstOf = (row) => B.speedVerdict(B.mySpeed(P.mech, set, B.myForme(P.mech, set), { tailwind: bd.tw.mine }), B.targetSpeed(P.mech, row, { tailwind: bd.tw.theirs }), { trickRoom: bd.tw.tr }) !== 'faster';
    const after = (row) => (firstOf(row) ? Math.max(0, ...B.afterTheirMoves(P.mech, row.set, row.forme, def).map((a) => a.stage)) : 0);
    const target = pinned.find((row) => after(row) > 0) ?? pinned[0];
    const b = bench(P, swapped, target, myMain, { boost: setup.stage, stage: after(target), field: fieldOf(P, bd, swapped, target) });
    const lv = b.levels?.find((x) => x.key === 'every-roll')?.keep ?? b.levels?.find((x) => x.key === 'fifteen-of-sixteen')?.keep;
    if (lv && lv.nature === set.nature) setupNeed = lv.a;
  }
  const seeds = B.seedOptions(P.mech, set, { stat, setupNeed });
  const trials = bd.trials[l.id] ?? [];
  const full = trials.length >= MAX_TRIALS;
  const seedBtns = seeds.map((s) => btn((C.BUILD.seed[s.key] ?? (() => s.key))(s.changes[0], nm(P)), 'bd-seed', { set: l.id, seed: s.key, need: setupNeed ?? '' }, { cls: 'pchip', disabled: full })).join('');
  const names = (row, mine) => ({ attacker: mine ? P.spName(set.species) : rowName(P, row), defender: mine ? rowName(P, row) : P.spName(set.species) });
  const q = []; // [{label, sub, cells:[html]}]
  for (const row of pinned) {
    const mv = bestMove(P, set, row, bd);
    if (!mv) continue;
    const st = B.moveStats(P.mech, mv);
    const base = opts.map((o) => (o.set.moves.includes(mv) ? hit(P, o.set, row, mv, { field: fieldOf(P, bd, o.set, row) }) : null));
    const stageCells = (stage) => opts.map((o, i) => {
      if (!o.set.moves.includes(mv)) return `<span class="small muted">${esc(C.BUILD.noMove(P.name('moves', mv)))}</span>`;
      const at0 = stage ? hit(P, o.set, row, mv, { stage, field: fieldOf(P, bd, o.set, row) }) : base[i];
      const su = B.setupIn(o.set, st.atk);
      const lines = [`<div><span class="small muted">${esc(C.BUILD.atStage(0))}</span> ${cell(P, at0, names(row, true), i ? deltaOf(stage ? hit(P, opts[0].set, row, mv, { stage, field: fieldOf(P, bd, opts[0].set, row) }).result : base[0]?.result, at0.result) : '')}</div>`];
      if (su) {
        const up = hit(P, o.set, row, mv, { boost: su.stage, stage, field: fieldOf(P, bd, o.set, row) });
        const ref = opts[0].set.moves.includes(mv) ? hit(P, opts[0].set, row, mv, { stage, field: fieldOf(P, bd, opts[0].set, row) }).result : null;
        lines.push(`<div><span class="small muted">${esc(`${C.BUILD.atStage(su.stage)} (${P.name('moves', su.move)})`)}</span> ${cell(P, up, names(row, true), i ? deltaOf(ref, up.result) : '')}</div>`);
      } else if (i && opts.some((x) => B.setupIn(x.set, st.atk))) lines.push(`<div class="small muted">${esc(C.BUILD.noSetup)}</div>`);
      return lines.join('');
    });
    const wx = fieldOf(P, bd, set, row).weather;
    q.push({ label: C.BUILD.koRow(P.name('moves', mv), rowName(P, row)), sub: `${rowSource(row)}${wx ? ` · ${bd.field === 'auto' ? weatherWords(P, set, row) : wx}` : ''}`, cells: stageCells(0) });
    for (const a of B.afterTheirMoves(P.mech, row.set, row.forme, st.def)) {
      const first = B.speedVerdict(B.mySpeed(P.mech, set, B.myForme(P.mech, set), { tailwind: bd.tw.mine }), B.targetSpeed(P.mech, row, { tailwind: bd.tw.theirs }), { trickRoom: bd.tw.tr }) !== 'faster';
      if (first) q.push({ label: C.BUILD.afterRow(P.name('moves', a.move), C.STAT_SHORT[st.def], a.stage), sub: C.BUILD.afterWhy, cells: stageCells(a.stage) });
    }
    const theirs = B.theirAttacks(P.mech, row);
    if (theirs.length) {
      const hardest = theirs.map((m) => ({ m, r: theirHitOn(P, set, row, m, bd).result })).sort((a, b) => (b.r.class === 'exact' ? b.r.range.max / b.r.maxHP : -1) - (a.r.class === 'exact' ? a.r.range.max / a.r.maxHP : -1))[0].m;
      const cur = theirHitOn(P, set, row, hardest, bd);
      q.push({ label: C.BUILD.theirRow(rowName(P, row), P.name('moves', hardest)), sub: rowSource(row), cells: opts.map((o, i) => { const x = i ? theirHitOn(P, o.set, row, hardest, bd) : cur; return cell(P, x, names(row, false), i ? deltaOf(cur.result, x.result, false) : ''); }) });
    }
    const rg = B.targetSpeed(P.mech, row, { tailwind: bd.tw.theirs });
    // a ladder spread gives their common Speed: the verdict against it first, the full range verdict after
    const ladderRg = rg.ladder !== undefined ? { min: rg.ladder, max: rg.ladder, exact: true } : null;
    q.push({ label: C.BUILD.speedRow(rowName(P, row)), sub: rg.exact ? `${rg.max}` : `${ladderRg ? `${rg.ladder} ${C.BUILD.ladderSpeed(rg.ladderLabel)} · ` : ''}${C.BUILD.range} ${rg.min}–${rg.max}`, cells: opts.map((o) => {
      const s = B.mySpeed(P.mech, o.set, B.myForme(P.mech, o.set), { tailwind: bd.tw.mine });
      const all = esc(C.BUILD.speedWord[B.speedVerdict(s, rg, { trickRoom: bd.tw.tr })]);
      return ladderRg ? `${s ?? '?'} vs ${rg.ladder} ${esc(C.BUILD.ladderSpeed(rg.ladderLabel))}: ${esc(C.BUILD.speedWord[B.speedVerdict(s, ladderRg, { trickRoom: bd.tw.tr })])}<div class="small muted">${esc(C.BUILD.range)} ${rg.min}–${rg.max}: ${all}</div>` : `${s ?? '?'}: ${all}`;
    }) });
  }
  q.push(bulkRow(P, ws, opts));
  q.push({ label: C.BUILD.costRow, sub: '', cells: opts.map((o) => (o.costs.length ? o.costs.map((x) => esc((C.BUILD.cost[x.code] ?? (() => x.code))(x, nm(P)))).join('; ') : '—')) });
  if (opts.some((o) => B.setupIn(o.set, stat))) {
    const tools = B.setupTools(P.mech, rows);
    const likely = tools.filter((t) => t.evidence !== 'could'), could = tools.filter((t) => t.evidence === 'could');
    const txt = likely.map((t) => `${P.spName(t.forme)}: ${t.kind === 'move' ? P.name('moves', t.id) : P.name('abilities', t.id)} (${C.BUILD.evidence[t.evidence]})`).join('; ') || C.BUILD.toolsNone;
    q.push({ label: C.BUILD.toolsRow, sub: '', cells: opts.map((o) => (B.setupIn(o.set, stat) ? `${esc(txt)}${could.length ? `<details class="small"><summary>${esc(C.BUILD.toolsCould(could.length))}</summary>${esc(could.map((t) => `${P.spName(t.forme)}: ${t.kind === 'move' ? P.name('moves', t.id) : P.name('abilities', t.id)}`).join('; '))}</details>` : ''}` : '—')) });
  }
  const headCell = (o) => {
    const sp = o.set.sp === 'unknown' ? '?' : STAT_IDS.map((s) => o.set.sp[s] ?? 0).join('/');
    const diffMoves = o.set.moves.map((m) => (set.moves.includes(m) ? esc(P.name('moves', m)) : `<b>${esc(P.name('moves', m))}</b>`)).join(' · ');
    const acts = o.trial ? `<div class="bopt-acts">${btn(C.BUILD.saveVersion, 'bd-trial-save', { set: l.id, i: o.i })} ${btn(C.BUILD.saveSet, 'bd-trial-copy', { set: l.id, i: o.i }, { cls: 'linkish' })} ${btn(bd.editing === `${l.id}:${o.i}` ? C.BUILD.done : C.BUILD.edit, 'bd-trial-edit', { set: l.id, i: o.i }, { cls: 'linkish' })} ${btn(C.BUILD.remove, 'bd-trial-remove', { set: l.id, i: o.i }, { cls: 'linkish' })}</div>` : '';
    const errs = checkSet(P.mech, o.set, { side: 'mine' }).filter((p) => p.severity === 'error');
    return `<b>${esc(o.label)}</b><div class="small">${esc(P.name('natures', o.set.nature))} ${esc(sp)}</div><div class="small">${esc(P.name('items', o.set.item) || 'no item')}</div><div class="small">${diffMoves}</div>${spMeter(o.set.sp)}${errs.length ? `<p class="small banner warn">${esc(C.BUILD.fixFirst)}</p>` : ''}${acts}`;
  };
  const table = `<div class="scroll bcmp-wide"><table class="bcmp"><thead><tr><th scope="col"></th>${opts.map((o) => `<th scope="col">${headCell(o)}</th>`).join('')}</tr></thead>
    <tbody>${q.map((x) => `<tr><th scope="row">${esc(x.label)}${x.sub ? `<div class="small muted">${esc(x.sub)}</div>` : ''}</th>${x.cells.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  // phone: one option at a time, the same questions in the same order (no sideways scrolling)
  const pi = Math.min(bd.phoneOpt ?? 0, opts.length - 1);
  const phone = `<div class="bcmp-phone"><div class="choices" role="group" aria-label="Option">${opts.map((o, i) => chipBtn(i ? C.BUILD.trial(o.i) : C.BUILD.current, 'bd-phone-opt', { i }, i === pi)).join('')}</div>
    <div class="bopt-card">${headCell(opts[pi])}<dl>${q.map((x) => `<dt>${esc(x.label)}</dt><dd>${x.cells[pi]}</dd>`).join('')}</dl></div></div>`;
  const trialEd = bd.editing?.startsWith(`${l.id}:`) ? trialEditor(P, l, set, Number(bd.editing.split(':')[1]), bd) : '';
  return `<p class="small">${esc(C.BUILD.seeds)} ${seedBtns} ${btn(C.BUILD.tryChange, 'bd-try', { set: l.id }, { cls: 'pchip', disabled: full })}${full ? ` <span class="small muted">${esc(C.BUILD.maxTrials)}</span>` : ''}</p>
    ${trialEd}${pinned.length ? '' : `<p class="small">${esc(C.BUILD.pinHelp)}</p>`}${table}${phone}
    <p class="small">${esc(C.BUILD.whatChanges)}</p>`;
}
/**
 * The bulk row: expected OHKOs from the common hits of this opponent's pool (lib/prep-build bulkScore, ladder usage), per
 * option; lower is bulkier. Each cell lists its hits with nonzero odds; forms without usage data are said, not guessed.
 */
function bulkRow(P, ws, opts) {
  const usage = P.app.usage?.() ?? null;
  const label = C.BUILD.bulkRow(ws.coach);
  if (!usage?.species) return { label, sub: C.BUILD.bulkNoUsage, cells: opts.map(() => '—') };
  const pool = P.rosterSpecies(ws);
  const of = (o) => memo(P, JSON.stringify(['bulk', o.set, pool, usage.month ?? null]), () => B.bulkScore(P.calc, P.mech, o.set, pool, usage));
  const cur = of(opts[0]);
  const cells = opts.map((o, i) => {
    const b = i ? of(o) : cur;
    const d = i && Math.abs(b.score - cur.score) >= 0.005 ? ` <span class="delta ${b.score < cur.score ? 'up' : 'down'}">${esc(b.score < cur.score ? C.BUILD.better : C.BUILD.worse)}</span>` : '';
    const list = b.hits.filter((h) => h.p > 0).sort((x, y) => y.p - x.p).map((h) => `<li>${esc(`${P.spName(h.forme)} ${P.name('moves', h.move)}: ${Math.round(1000 * h.p) / 10}%`)}</li>`).join('');
    return `<details class="bcell"><summary><span class="bword">${esc(C.BUILD.bulkScore(b.score, b.strong))}</span>${d}</summary><ul class="small">${list || `<li>${esc(C.BUILD.bulkNone)}</li>`}</ul>
      <p class="small muted">${esc(C.BUILD.bulkCounted(b.hits.length, b.skipped.map((f) => P.spName(f)), b.notCounted.length))}</p></details>`;
  });
  return { label, sub: C.BUILD.bulkSub(usage.month), cells };
}
/** The mini editor for a trial: it writes only to the trial (screen draft), never to the set. */
function trialEditor(P, l, set, i, bd) {
  const t = (bd.trials[l.id] ?? [])[i];
  if (!t) return '';
  const d = t.set, sp = set.species;
  const items = Object.keys(P.mech.items).filter((x) => !P.mech.items[x].megaStone || P.mech.items[x].megaStone[sp]).sort((a, b) => P.name('items', a).localeCompare(P.name('items', b)));
  const learn = learnset(P.mech, sp);
  const data = { set: l.id, i };
  return `<div class="card btrial"><h4>${esc(C.BUILD.trial(i))}: ${esc(t.label)}</h4>
    <div class="frow">${select('bt-nature', Object.keys(P.mech.natures).sort().map((n) => { const x = P.mech.natures[n]; return [n, `${x.name}${x.plus && x.plus !== x.minus ? ` (+${C.STAT_SHORT[x.plus]} −${C.STAT_SHORT[x.minus]})` : ''}`]; }), d.nature, { label: 'Nature', data: { pc: 'bd-trial-field', field: 'nature', ...data } })}
    ${select('bt-item', [['', 'No item'], ...items.map((x) => [x, P.name('items', x)])], d.item, { label: 'Item', data: { pc: 'bd-trial-field', field: 'item', ...data } })}
    ${select('bt-ability', legalAbilities(P.mech, sp).map((a) => [a, P.name('abilities', a)]), d.ability, { label: 'Ability', data: { pc: 'bd-trial-field', field: 'ability', ...data } })}</div>
    <div class="frow">${[0, 1, 2, 3].map((k) => select(`bt-mv-${k}`, [['', '—'], ...learn.map((m) => [m, P.name('moves', m)])], d.moves[k] ?? '', { label: `Move ${k + 1}`, data: { pc: 'bd-trial-move', k, ...data } })).join('')}</div>
    <div class="sp-grid">${STAT_IDS.map((s) => `<div class="sp-cell"><label for="bt-sp-${s}">${C.STAT_SHORT[s]}</label><input id="bt-sp-${s}" type="number" inputmode="numeric" min="0" max="${SP_PER_STAT}" step="1" value="${esc(d.sp[s] ?? 0)}" data-pc="bd-trial-sp" data-stat="${s}" data-set="${esc(l.id)}" data-i="${i}"></div>`).join('')}</div>
    ${spMeter(d.sp)}</div>`;
}

// ---------- ③ Speed ----------
function speedSummary(P, set, rows, bd, oppName) {
  if (!P.mech) return '';
  const forme = B.myForme(P.mech, set);
  const me = B.mySpeed(P.mech, set, forme, { tailwind: bd.tw.mine });
  const c = { faster: 0, slower: 0, depends: 0, tie: 0 };
  for (const r of rows) { const rg = B.targetSpeed(P.mech, r, { tailwind: bd.tw.theirs }); const v = B.speedVerdict(me, rg.ladder !== undefined ? { min: rg.ladder, max: rg.ladder, exact: true } : rg, { trickRoom: bd.tw.tr }); if (c[v] !== undefined) c[v]++; }
  return `${me}: ${C.BUILD.speedVerdict(oppName, c)}`;
}
function speedSection(P, set, rows, bd, l) {
  const forme = B.myForme(P.mech, set);
  const ct = B.creepTargets(P.mech, set, forme, rows, { mine: { tailwind: bd.tw.mine }, theirs: { tailwind: bd.tw.theirs }, trickRoom: bd.tw.tr });
  const need = (o) => (!o ? '—' : o.impossible ? `can't (${o.best.speed} at ${o.best.sp})` : bd.tw.tr ? `≤ ${o.sp} SP → ${o.speed}` : `${o.sp} SP → ${o.speed}${o.tieAt !== null && o.tieAt !== undefined ? ` (ties at ${o.tieAt})` : ''}`);
  const natTxt = (o) => (o ? `${P.name('natures', o.nature)}${o.tradeoff?.losesUsed ? ' · costs a stat this set uses' : o.tradeoff?.givesUp ? ` · gives up +${C.STAT_SHORT[o.tradeoff.givesUp]}` : ''}` : '');
  const tr = ct.map((x) => `<tr><th scope="row">${esc(P.spName(x.forme))}${x.mega ? ' <span class="megad inline">M</span>' : ''}<div class="small muted">${esc(x.mark === 'ladder' ? C.BUILD.ladderSpeed(x.label) : C.BUILD.mark[x.mark])}</div></th><td>${x.speed}</td>
    <td>${esc(need(x.keep))}</td><td>${x.alt ? `${esc(need(x.alt))}<div class="small muted">${esc(natTxt(x.alt))}</div>` : '—'}</td><td>${esc(C.BUILD.speedWord[x.verdict])}</td>
    <td>${!x.keep.impossible && x.keep.sp !== (set.sp.spe ?? 0) ? btn(C.BUILD.tryIt, 'bd-th-try', { set: l.id, stat: 'spe', sp: x.keep.sp, nature: x.keep.nature, label: `${x.keep.sp} Spe` }, { cls: 'linkish' }) : ''}</td></tr>`).join('');
  return `<div class="choices" role="group" aria-label="Speed conditions">${['mine', 'theirs', 'tr'].map((k) => chipBtn(C.BUILD.tw[k], 'bd-tw', { key: k }, bd.tw[k])).join('')}</div>
    <p class="small">${term('Speed creep')} · ${esc(C.BUILD.speedWord.tie)}: never counted as faster.</p>
    <div class="scroll"><table class="bcreep"><thead><tr>${C.BUILD.creepHead.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}<th></th></tr></thead><tbody>${tr}</tbody></table></div>
    <p class="small muted">Their Speed: their set when it has Stat Points; else the ladder's top spread for that form (labelled), or 32 SP neutral (common max) without one; plus 32 SP +Speed (worst case) when it differs. Mega Speed applies from the turn it Mega Evolves; Choice Scarf only when their set holds it.</p>`;
}

// ---------- ④ Your hits ----------
function hitsSection(P, ws, l, set, pinned, rows, bd) {
  const atk = B.myAttacks(P.mech, set);
  if (!atk.length) return `<p>${esc(C.BUILD.noAttacks)}</p>`;
  const stg = bd.hitStage ?? 0;
  const body = rows.map((row) => `<tr><th scope="row">${esc(rowName(P, row))}<div class="small muted">${esc(rowSource(row))}</div></th>${atk.map((mv) => `<td>${cell(P, hit(P, set, row, mv, { boost: stg, field: fieldOf(P, bd, set, row), spread: bd.spread }), { attacker: P.spName(set.species), defender: rowName(P, row) })}</td>`).join('')}</tr>`).join('');
  return `<div class="choices" role="group" aria-label="${esc(C.BUILD.stage)}"><span class="small">${esc(C.BUILD.stage)}:</span> ${[0, 1, 2].map((b) => chipBtn(C.BUILD.atStage(b), 'bd-stage', { b }, stg === b)).join('')}
    <span class="small">${esc(C.BUILD.spread)}:</span> ${['frail', 'common', 'max'].map((k) => chipBtn(C.ENVELOPE_ROW[k], 'bd-spread', { k }, bd.spread === k)).join('')}</div>
    <p class="small muted">${esc(C.BUILD.hitsHelp)}</p>
    <div class="scroll"><table class="bhits"><thead><tr><th></th>${atk.map((m) => `<th scope="col">${esc(P.name('moves', m))}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>`;
}

// ---------- ⑤ KO benchmarks ----------
const bench = (P, set, row, move, opts) => memo(P, JSON.stringify(['b', set, row.key, row.set, row.common, move, opts]), () => B.koBenchmark(P.calc, P.mech, set, row, move, opts));
function benchSection(P, ws, l, set, pinned, rows, bd) {
  if (!pinned.length) return `<p class="small">${esc(C.BUILD.pinHelp)}</p>`;
  const out = [];
  for (const row of pinned) {
    const mv = bestMove(P, set, row, bd);
    if (!mv) continue;
    const st = B.moveStats(P.mech, mv);
    const stages = [0, ...B.afterTheirMoves(P.mech, row.set, row.forme, st.def).map((a) => a.stage)];
    const lines = [];
    // OHKO and 2HKO at the same stages: yours +0/+1/+2, theirs +0 and after their self-boosting move
    for (const stage of [...new Set(stages)]) for (const boost of [0, 1, 2]) for (const uses of [1, 2]) lines.push({ boost, stage, uses });
    const tr = lines.map((ln) => {
      const b = bench(P, set, row, mv, { ...ln, spread: bd.spread, field: fieldOf(P, bd, set, row) });
      const head = `${ln.uses === 2 ? `${C.BUILD.twoUse}, ` : ''}${C.BUILD.benchRow(ln.boost, ln.stage, C.STAT_SHORT[st.def])}`;
      if (b.refused) return `<tr><th scope="row">${esc(head)}</th><td colspan="3" class="noresult">${esc(C.CLASS.refused)}: ${esc(C.REPEAT_REFUSED[b.refused] ?? b.refused)}</td></tr>`;
      const lv = b.levels.map((x) => {
        const keep = x.keep ? `${x.keep.a} ${C.STAT_SHORT[b.stat]} (${P.name('natures', x.keep.nature)})${x.slack !== null ? ` · ${C.BUILD.slack(b.have, x.slack)}` : ''}` : C.BUILD.cant(P.name('natures', set.nature));
        const change = x.change ? ` · or ${x.change.a} as ${P.name('natures', x.change.nature)}` : '';
        const tryBtn = x.keep && x.slack !== 0 ? btn(C.BUILD.tryIt, 'bd-th-try', { set: l.id, stat: b.stat, sp: x.keep.a, nature: x.keep.nature, label: `${x.keep.a} ${C.STAT_SHORT[b.stat]}` }, { cls: 'linkish' }) : '';
        return `<div><b>${esc(C.BUILD.level[x.key])}</b>: ${esc(keep + change)} ${tryBtn}</div>`;
      }).join('');
      const bp = b.breakpoints.map((p) => `${P.name('natures', p.nature)}: ${p.steps.map((s) => `${s.a} → ${koWords(s.ko, { hits: b.hits, uses: ln.uses })}`).join(' · ')}`).join(' | ');
      return `<tr><th scope="row">${esc(head)}<div class="small muted">${esc(b.spreadFellBack ? C.BUILD.spreadFell : C.BUILD.spreadUsed(b.spread))}</div></th><td>${lv}<details class="small"><summary>${esc(C.BUILD.breakpoints)}</summary>${esc(bp)}</details></td></tr>`;
    }).join('');
    out.push(`<h4>${esc(C.BUILD.koRow(P.name('moves', mv), rowName(P, row)))} <span class="small muted">(${esc(rowSource(row))})</span></h4>
      <div class="scroll"><table class="bbench"><tbody>${tr}</tbody></table></div>`);
  }
  return `<div class="choices" role="group" aria-label="${esc(C.BUILD.spread)}"><span class="small">${esc(C.BUILD.spread)}:</span> ${['frail', 'common', 'max'].map((k) => chipBtn(C.ENVELOPE_ROW[k], 'bd-spread', { k }, bd.spread === k)).join('')}</div>
    <p class="small">${term('Benchmark')} · ${term('Slack')} · ${term('Setup move (+1/+2)')}</p>${out.join('')}`;
}

// ---------- ⑥ Their hits on you ----------
function theirSection(P, ws, l, set, pinned, rows, bd) {
  const opts = optionsOf(P, l, set, bd);
  const body = pinned.flatMap((row) => B.theirAttacks(P.mech, row).slice(0, 3).map((mv) => {
    const cur = theirHitOn(P, set, row, mv, bd);
    return `<tr><th scope="row">${esc(`${rowName(P, row)}: ${P.name('moves', mv)}`)}<div class="small muted">${esc(rowSource(row))}</div></th>${opts.map((o, i) => { const x = i ? theirHitOn(P, o.set, row, mv, bd) : cur; return `<td>${cell(P, x, { attacker: rowName(P, row), defender: P.spName(set.species) }, i ? deltaOf(cur.result, x.result, false) : '')}</td>`; }).join('')}</tr>`;
  })).join('');
  // survive benchmarks for your current set: the cheapest HP + defence for its hardest hit from each pinned target
  const surv = pinned.map((row) => {
    const mv = B.theirAttacks(P.mech, row).map((m) => ({ m, r: theirHitOn(P, set, row, m, bd).result })).sort((a, b) => (b.r.class === 'exact' ? b.r.range.max / b.r.maxHP : -1) - (a.r.class === 'exact' ? a.r.range.max / a.r.maxHP : -1))[0]?.m;
    if (!mv) return '';
    const s = memo(P, JSON.stringify(['sv', set, row.key, row.set, row.common, mv, fieldOf(P, bd, set, row)]), () => B.surviveBenchmark(P.calc, P.mech, set, row, mv, { field: fieldOf(P, bd, set, row) }));
    const head = `${rowName(P, row)}: ${P.name('moves', mv)} (${C.BUILD.spreadUsed(s.spread)})`;
    if (s.refused) return `<li>${esc(head)}: <span class="noresult">${esc(C.CLASS.refused)}</span></li>`;
    const lv = s.levels.map((x) => {
      const o = x.keep ?? x.change;
      if (!o) return `<div>${esc(C.BUILD.survive[x.key])}: ${esc(C.BUILD.cantSurvive)}</div>`;
      const now = s.have && o.h <= s.have.hp && o.d <= s.have.def && o.nature === set.nature;
      return `<div>${esc(C.BUILD.survive[x.key])}: ${esc(`${o.h} HP / ${o.d} ${C.STAT_SHORT[s.stat]} (${P.name('natures', o.nature)})`)}${now ? ` · ${esc(C.BUILD.already)}` : ` ${btn(C.BUILD.tryIt, 'bd-sv-try', { set: l.id, stat: s.stat, hp: o.h, d: o.d, nature: o.nature, label: `${o.h} HP / ${o.d} ${C.STAT_SHORT[s.stat]}` }, { cls: 'linkish' })}`}</div>`;
    }).join('');
    return `<li><b>${esc(head)}</b>${lv}<div class="small muted">${esc(C.BUILD.surviveBudget(s.budget))}</div></li>`;
  }).join('');
  return `<p class="small muted">${esc(C.BUILD.theirHelp)}</p><div class="scroll"><table class="bhits"><thead><tr><th></th>${opts.map((o) => `<th scope="col">${esc(o.label)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>
    ${surv ? `<h4>${esc(C.BUILD.surviveHead)}</h4><ul class="small bsurv">${surv}</ul>` : ''}`;
}

// ---------- ⑦ In this matchup (the Brief's own sentences) ----------
function matchSection(P, pov, opp, ws, id, standalone) {
  let mon = null;
  try { mon = modelFor(P, pov, opp, ws, { lens: '10' }).b.myMons.find((x) => x.id === id) ?? null; } catch { mon = null; }
  if (!mon) return `<p class="small muted">${esc(C.BUILD.notInBrief)}</p>`;
  const say = (r) => (C.REASON[r.code] ?? (() => r.code))(r, (x) => P.spName(x));
  return `${standalone ? `<h3>${esc(C.BUILD.sec.match)}</h3>` : ''}<p class="small muted">${esc(C.BUILD.matchHelp)}</p>
    <ul class="rsns">${mon.pros.map((r) => `<li class="rsn pro">✓ ${esc(say(r))}</li>`).join('')}${mon.cons.map((r) => `<li class="rsn con">⚠ ${esc(say(r))}</li>`).join('')}</ul>
    <p class="small muted">${esc(C.CANT_KNOW)}</p>`;
}

// ---------- actions ----------
const wsNow = (P) => P.match()?.ws ?? (P.route.wsId ? P.ws.get(P.route.wsId) : null);
function addTrial(P, setId, trial) {
  const ws = wsNow(P);
  if (!ws) return;
  const bd = bui(P, ws.id);
  const list = (bd.trials[setId] ??= []);
  if (list.length >= MAX_TRIALS) { P.toast(C.BUILD.maxTrials); return; }
  list.push(trial);
  P.saveUi();
  P.app.announce?.(`Compare: ${C.BUILD.trial(list.length - 1)} added`);
  P.app.rerender();
}
const curSet = (P, setId) => { const l = P.lineage(setId); return l ? asSet(l, currentVersion(l)) : null; };
function trialAt(P, t) {
  const ws = wsNow(P);
  return ws ? { ws, list: bui(P, ws.id).trials[t.dataset.set] ?? [], i: Number(t.dataset.i) } : null;
}
function editTrial(P, t, fn) {
  const x = trialAt(P, t);
  const tr = x?.list[x.i];
  if (!tr) return;
  fn(tr.set);
  tr.cost = [];
  P.saveUi();
  P.app.rerender();
}
export const actions = {
  'build-open': (t, P) => { const r = P.route; P.go({ view: 'ws', pov: r.pov, opp: r.opp, detail: { side: 'build', n: Number(t.dataset.n) } }, { push: true }); },
  'bd-export': (t, P) => { const ws = wsNow(P); if (!ws) return; const ui = P.wsUi(ws.id); ui.exp = { ...(ui.exp ?? { spChoice: 'common' }), what: 'mine' }; P.go({ view: 'ws', wsId: ws.id, kind: 'export' }, { push: true }); },
  'bd-sec': (t, P) => { const ws = wsNow(P); if (!ws) return; const bd = bui(P, ws.id); bd.open[t.dataset.sec] = !bd.open[t.dataset.sec]; P.saveUi(); P.app.rerender(); },
  'bd-pin': (t, P) => {
    const ws = wsNow(P), c = ctxOf(P);
    if (!ws || !c?.l) return;
    const bd = bui(P, ws.id), rows = targets(P, ws);
    const cur = bd.pins[c.l.id] ?? B.defaultPins(rows, 2);
    bd.pins[c.l.id] = cur.includes(t.dataset.key) ? cur.filter((k) => k !== t.dataset.key) : [...cur, t.dataset.key].slice(0, MAX_PINS);
    P.saveUi(); P.app.rerender();
  },
  'bd-seed': (t, P) => {
    const set = curSet(P, t.dataset.set);
    if (!set || !P.mech) return;
    const myMain = B.myAttacks(P.mech, set)[0];
    const stat = myMain ? B.moveStats(P.mech, myMain).atk : 'spa';
    const s = B.seedOptions(P.mech, set, { stat, setupNeed: t.dataset.need === '' || t.dataset.need === undefined ? null : Number(t.dataset.need) }).find((x) => x.key === t.dataset.seed);
    if (!s) return;
    // item clause: say so when another set in your 6 already holds the item this seed adds
    const ws = wsNow(P);
    const taken = s.set.item && s.set.item !== set.item && ws?.my6.some((x) => x.setId !== t.dataset.set && P.lineage(x.setId) && currentVersion(P.lineage(x.setId)).data.item === s.set.item);
    addTrial(P, t.dataset.set, { label: (C.BUILD.seed[s.key] ?? (() => s.key))(s.changes[0], nm(P)), set: s.set, cost: [...s.cost, ...(taken ? [{ code: 'item-taken', item: s.set.item }] : [])] });
  },
  'bd-try': (t, P) => { const set = curSet(P, t.dataset.set); if (!set) return; addTrial(P, t.dataset.set, { label: 'your change', set: structuredClone(set), cost: [] }); const ws = wsNow(P); bui(P, ws.id).editing = `${t.dataset.set}:${(bui(P, ws.id).trials[t.dataset.set] ?? []).length - 1}`; P.app.rerender(); },
  'bd-th-try': (t, P) => {
    const set = curSet(P, t.dataset.set);
    if (!set || set.sp === 'unknown') return;
    const sp = { ...set.sp, [t.dataset.stat]: Number(t.dataset.sp) };
    addTrial(P, t.dataset.set, { label: t.dataset.label, set: { ...set, sp, nature: t.dataset.nature || set.nature }, cost: [] });
  },
  'bd-sv-try': (t, P) => {
    const set = curSet(P, t.dataset.set);
    if (!set || set.sp === 'unknown') return;
    const sp = { ...set.sp, hp: Number(t.dataset.hp), [t.dataset.stat]: Number(t.dataset.d) };
    addTrial(P, t.dataset.set, { label: t.dataset.label, set: { ...set, sp, nature: t.dataset.nature || set.nature }, cost: [] });
  },
  'bd-trial-remove': (t, P) => { const x = trialAt(P, t); if (!x) return; x.list.splice(x.i, 1); const bd = bui(P, x.ws.id); bd.editing = null; bd.phoneOpt = 0; P.saveUi(); P.app.rerender(); },
  'bd-trial-edit': (t, P) => { const x = trialAt(P, t); if (!x) return; const bd = bui(P, x.ws.id); const k = `${t.dataset.set}:${x.i}`; bd.editing = bd.editing === k ? null : k; P.app.rerender(); },
  // the only writes: an explicit "Save as a new version" (immutable, via promote) or "Save as a new set"
  'bd-trial-save': (t, P) => {
    const x = trialAt(P, t);
    const tr = x?.list[x.i];
    if (!tr || !P.canWriteMine()) return;
    const { species, ...data } = tr.set;
    const before = P.lineage(t.dataset.set)?.currentV;
    promote(P, x.ws, t.dataset.set, data, `from Build: ${tr.label}`.slice(0, 120));
    // saved: the trial is now the current version, so its column goes (an invalid one stays, with promote's message)
    if (P.lineage(t.dataset.set)?.currentV !== before) { x.list.splice(x.i, 1); bui(P, x.ws.id).editing = null; bui(P, x.ws.id).phoneOpt = 0; P.saveUi(); }
    P.app.rerender();
  },
  'bd-trial-copy': (t, P) => {
    const x = trialAt(P, t);
    const tr = x?.list[x.i], l = P.lineage(t.dataset.set);
    if (!tr || !l || !P.canWriteMine()) return;
    const { species, ...data } = tr.set;
    if (checkSet(P.mech, tr.set, { side: 'mine' }).some((p) => p.severity === 'error')) { P.toast(C.BUILD.fixFirst); return; }
    const id = P.id('set');
    if (P.mutate('mysets', (d) => { d.sets.push(newLineage({ id, side: 'mine', speciesId: l.speciesId, name: `${l.name || 'Set'} (${tr.label})`.slice(0, 60), data, now: P.now(), reason: 'from Build' })); })) P.toast('Saved as a new set');
  },
  'bd-tw': (t, P) => { const ws = wsNow(P); if (!ws) return; const bd = bui(P, ws.id); bd.tw[t.dataset.key] = !bd.tw[t.dataset.key]; P.saveUi(); P.app.rerender(); },
  'bd-stage': (t, P) => { const ws = wsNow(P); if (!ws) return; bui(P, ws.id).hitStage = Number(t.dataset.b); P.app.rerender(); },
  'bd-spread': (t, P) => { const ws = wsNow(P); if (!ws) return; bui(P, ws.id).spread = ['frail', 'common', 'max'].includes(t.dataset.k) ? t.dataset.k : 'common'; P.app.rerender(); },
  'bd-phone-opt': (t, P) => { const ws = wsNow(P); if (!ws) return; bui(P, ws.id).phoneOpt = Number(t.dataset.i) || 0; P.app.rerender(); },
};
export const changes = {
  'bd-field': (t, P) => { const ws = wsNow(P); if (!ws) return; bui(P, ws.id).field = WEATHERS.includes(t.value) ? t.value : 'auto'; P.saveUi(); P.app.rerender(); },
  'bd-trial-field': (t, P) => editTrial(P, t, (s) => { s[t.dataset.field] = t.value; }),
  'bd-trial-move': (t, P) => editTrial(P, t, (s) => { const m = [0, 1, 2, 3].map((k) => s.moves[k] ?? ''); m[Number(t.dataset.k)] = t.value; s.moves = m.filter(Boolean); }),
  'bd-trial-sp': (t, P) => editTrial(P, t, (s) => { if (s.sp === 'unknown') return; s.sp = { ...s.sp, [t.dataset.stat]: Math.max(0, Math.min(SP_PER_STAT, Math.trunc(Number(t.value) || 0))) }; }),
};
export const inputs = {};

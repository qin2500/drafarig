// Teambuilder: your set editor, Showdown-style, with the tools on the controls they are about
// (docs/research/ux/teambuilder-redesign.md, mockup docs/research/ux/mockups/teambuilder.html). Our own markup: no
// Showdown code, CSS or assets; sprites are the app's existing portraits.
// - Team strip: your 6 for the opponent in scope, then the rest of your 10.
// - Set card: nickname, item (type to search), ability, 4 moves (type to search, legal learnset only), mini stats.
// - Stats panel: per stat, base, bar, a 0–32 SP slider with benchmark marks, the number and the final stat; nature colours.
//   Marks: Speed (outspeed / tie) from stat maths; KO / 2HKO / +stage / Life Orb and survive (HP + defence) from the engine,
//   computed once per set shape (lib/prep-build.mjs) in a deferred job, so dragging never runs the engine.
// - Calc strip: the focused move against the scope's mons (+0/+stage with a setup move; sun / no sun for a weather setter).
// - Pin as A + "try:" ideas → a one-line diff bar. A lives in this tab's session; nothing saves without Save version.
// Everything writes through the existing set editor's drafts and Save version / Save as a new set / Discard.
import { checkSet, legalAbilities, learnset, battleForme, toID } from '../lib/calc/mech.mjs';
import { STAT_IDS, SP_PER_STAT, SP_TOTAL, spTotal, statValue, natureSign } from '../lib/calc/stats.mjs';
import { currentVersion, asSet, defaultVariant, cleanSetData } from '../lib/prep-model.mjs';
import { workspacesFor } from '../lib/prep-matchup.mjs';
import { parseTeamQuick, exportSet } from '../lib/paste.mjs';
import * as B from '../lib/prep-build.mjs';
import * as C from './prep-copy.js';
import { esc, btn, chipBtn, h2, select, koWords } from './prep-ui.js';
import { updateDraft, createMySet, theirSetFor, spForUnknown, revisionPrompt } from './prep-sets.js';
import * as WB from './prep-workbench.js';

const LEAGUE = '__league';
const NEAR = 8; // whole-league scope: only marks within this many SP of the current value
const TOP = { match: 4, league: 8 }; // targets for damage and survive marks (by ladder usage)
const STRIP_MAX = 12;
const pct = (n, d) => (d ? Math.floor((1000 * n) / d) / 10 : 0);
const T = C.TB;

// ---------- context ----------
/** Your draft (or current version) of a set, as calc data: {species, item, ability, nature, moves, sp, cosmetic}. */
function draftSet(P, l) {
  const d = P.docs.mysets.drafts?.[l.id];
  const data = d ? d.data : currentVersion(l).data;
  return { species: l.speciesId, ...structuredClone(data), moves: (data.moves ?? []).filter(Boolean) };
}
const isDirty = (P, l) => !!P.docs.mysets.drafts?.[l.id];
/** The opponents you can check against, and the default: your marked next match, this matchup, else your first scheduled week. */
function scopeOf(P, ws) {
  const me = P.myCoach();
  const others = (P.coaches() ?? []).filter((c) => c.name !== me);
  const weeks = me ? P.weeks(me) : { rows: [] };
  const firstWeek = (name) => weeks.rows?.find((x) => x.opponent === name)?.week ?? null;
  const marked = [...P.ws.values()].find((w) => w.pov === me && w.isNext && others.some((c) => c.name === w.coach))?.coach;
  const sched = weeks.rows?.find((x) => x.opponent && others.some((c) => c.name === x.opponent))?.opponent;
  const def = ws?.coach && others.some((c) => c.name === ws.coach) ? ws.coach : marked ?? sched ?? others[0]?.name ?? null;
  const chosen = P.ui.tbScope && (P.ui.tbScope === LEAGUE || others.some((c) => c.name === P.ui.tbScope)) ? P.ui.tbScope : def;
  return { me, others, value: chosen, def, firstWeek, league: chosen === LEAGUE };
}
/** The workspace holding your 6 and their saved sets for (you, coach), if one is saved. */
const wsFor = (P, me, coach) => (me && coach ? workspacesFor([...P.ws.values()], me, coach)[0] ?? null : null);
/** Target rows for the scope (their saved set, else a labelled ladder guess), each tagged with its coach. */
function rowsOf(P, sc) {
  if (!P.mech) return [];
  const usage = P.app.usage?.() ?? null;
  const coaches = sc.league ? sc.others : sc.others.filter((c) => c.name === sc.value);
  const key = JSON.stringify(['tb-rows', sc.value, coaches.map((c) => [c.name, c.picks.map((p) => p.id)]), usage?.month ?? null, [...P.ws.values()].map((w) => [w.id, w.rev])]);
  P.tbCache ??= new Map();
  if (P.tbCache.has(key)) return P.tbCache.get(key);
  const rows = coaches.flatMap((c) => {
    const ws = wsFor(P, sc.me, c.name);
    const v = ws ? defaultVariant(ws) ?? ws.variants[0] ?? null : null;
    const saved = (sp) => { const l = ws ? theirSetFor(ws, v, sp) ?? ws.theirSets.find((s) => s.speciesId === sp) : null; return l ? currentVersion(l).data : null; };
    const pool = c.picks.map((p) => p.id).filter(Boolean);
    return B.targetsOf(P.mech, pool, { usage, dexSpecies: (id) => P.dexSp(id), savedSet: saved, asOf: P.now().slice(0, 10) }).map((r) => ({ ...r, coach: c.name, key: `${c.name}|${r.key}` }));
  });
  if (P.tbCache.size > 200) P.tbCache.clear();
  P.tbCache.set(key, rows);
  return rows;
}
const topRows = (rows, n) => { const keep = new Set(B.defaultPins(rows, n)); return rows.filter((r) => keep.has(r.key)); };
const rowName = (P, r, sc) => `${sc.league ? `${r.coach}'s ` : ''}${P.spName(r.forme)}`;
const fieldFor = (P, set, row) => { const w = B.autoWeather(P.mech, set, row); return w.weather ? { weather: w.weather } : {}; };

// ---------- marks (deferred engine job, cached per set shape + scope) ----------
function markKey(P, set, sc, rows) { return JSON.stringify(['tb-marks', B.shapeOf(set), sc.value, rows.map((r) => [r.key, r.set, r.common])]); }
/** Damage + survive marks for a set shape, or null while they're being computed (a job is started once per key). */
function engineMarks(P, set, sc, rows) {
  if (!P.calc) return null;
  const key = markKey(P, set, sc, rows);
  P.tbMarks ??= new Map();
  if (P.tbMarks.has(key)) return P.tbMarks.get(key);
  const run = () => {
    try { P.tbMarks.set(key, computeMarks(P, set, sc, rows)); } catch (e) { console.error('Teambuilder marks failed:', e && e.message); P.tbMarks.set(key, { marks: [], cant: [], failed: true }); }
    if (P.tbMarks.size > 60) P.tbMarks.delete(P.tbMarks.keys().next().value);
  };
  // In a browser: in idle time after this render (the screen shows "Calculating…" meanwhile), then one re-render. Marks only
  // change with the set's shape (item, nature, moves), never with Stat Points, so dragging a slider never gets here.
  // Without requestIdleCallback (tests, old browsers): now, inside this render.
  const idle = globalThis.requestIdleCallback;
  if (typeof idle !== 'function') { run(); return P.tbMarks.get(key); }
  P.tbJobs ??= new Set();
  if (!P.tbJobs.has(key)) {
    P.tbJobs.add(key);
    idle(() => { run(); P.tbJobs.delete(key); P.app.rerender(); }, { timeout: 400 });
  }
  return null;
}
export function computeMarks(P, set, sc, rows) {
  const shape = B.shapeOf(set);
  const targets = topRows(rows, sc.league ? TOP.league : TOP.match);
  const marks = [], cant = [];
  let setupNeed = null;
  for (const row of targets) {
    const field = fieldFor(P, set, row);
    const mv = bestMove(P, shape, row, field);
    if (mv) {
      const k = B.koMarks(P.calc, P.mech, set, row, mv, { field });
      marks.push(...k.marks); cant.push(...k.cant);
      // the setup idea keeps the SP its +stage OHKO needs on the first target
      const st = B.moveStats(P.mech, mv).atk, su = B.setupMoveFor(P.mech, set.species, st);
      if (setupNeed === null && su && !set.moves.includes(su.move)) {
        const b = B.koBenchmark(P.calc, P.mech, B.swapInMove(P.mech, shape, su.move).set, row, mv, { boost: su.stage, field });
        const lv = b.levels?.find((x) => x.key === 'every-roll')?.keep;
        if (lv && lv.nature === set.nature) setupNeed = lv.a;
      }
    }
    const hard = hardestOn(P, shape, row, field);
    if (hard) { const s = B.surviveMarks(P.calc, P.mech, set, row, hard, { field }); marks.push(...s.marks); cant.push(...s.cant); }
  }
  return { marks, cant, setupNeed };
}
function bestMove(P, set, row, field) {
  let best = null, top = -1;
  for (const mv of B.myAttacks(P.mech, set)) {
    const r = B.hitResult(P.calc, P.mech, set, row, mv, { field }).result;
    if (r.class === 'exact' && r.range.max / r.maxHP > top) { top = r.range.max / r.maxHP; best = mv; }
  }
  return best;
}
function hardestOn(P, set, row, field) {
  let best = null, top = -1;
  for (const mv of B.theirAttacks(P.mech, row)) {
    const r = B.theirHit(P.calc, P.mech, set, row, mv, { spread: 'common', field }).result;
    if (r.class === 'exact' && r.range.max / r.maxHP > top) { top = r.range.max / r.maxHP; best = mv; }
  }
  return best;
}

// ---------- Speed options: off by default, never applied silently ----------
const SPD_KEYS = ['scarf', 'ladder', 'twTheirs', 'twMine'];
const spdUi = (P) => ((P.ui.tb ??= {}).spd ??= {});
/** speedMarks options from the toggles: Choice Scarf users, ladder spreads, their / your Tailwind. */
function spdCond(P) {
  const s = spdUi(P);
  return { scarf: !!s.scarf, ladder: !!s.ladder, theirs: s.twTheirs ? { tailwind: true } : {}, mine: s.twMine ? { tailwind: true } : {} };
}
const spdToggles = (P) => `<div class="choices tb-spdopts" role="group" aria-label="${esc(T.spdOpts)}"><span class="small muted">${esc(T.spdOpts)}:</span> ${SPD_KEYS.map((k) => chipBtn(T.spdOpt[k], 'tb-spd', { key: k }, !!spdUi(P)[k])).join('')}</div>`;

// ---------- words ----------
const nm = (P) => ({ move: (id) => P.name('moves', id), item: (id) => P.name('items', id), nature: (id) => P.name('natures', id), mon: (id) => P.spName(id) });
function markText(P, m, sc, rows) {
  const n = nm(P);
  const who = (key) => { const r = rows.find((x) => x.key === key); return r ? rowName(P, r, sc) : key; };
  if (m.kind === 'outspeed' || m.kind === 'tie') {
    const names = m.who.map((w) => `${sc.league ? `${w.coach}'s ` : ''}${P.spName(w.forme)} (${T.tier[w.mark](w.label)}${w.label === 'Scarf' && w.mark !== 'ladder' ? ' + Scarf' : ''})`).join(', ');
    return m.kind === 'tie' ? T.tieText(names, m.speed) : T.outText(names, m.speed);
  }
  const need = m.need ? ` [${T.needs([m.need.nature && n.nature(m.need.nature), m.need.item && n.item(m.need.item)].filter(Boolean).join(', '))}]` : '';
  if (m.kind === 'ko') return `${T.koText(m.uses, n.move(m.move), who(m.key), m.boost)}${need}`;
  return `${T.surviveText(who(m.key), n.move(m.move), m.pair, C.STAT_SHORT)}${need}`;
}
/** One-line calc for a mark at its own value (the tap-through). */
function markCalc(P, m, set, sc, rows) {
  if (m.kind === 'outspeed' || m.kind === 'tie') {
    const forme = B.myForme(P.mech, set);
    const tiers = [...new Map(m.who.map((w) => [w.forme, w])).values()].map((w) => T.tiers(P.spName(w.forme), w.base, B.speedTiers(w.base))).join(' · ');
    return `${T.speedCalc(P.name('natures', set.nature), m.sp, B.mySpeed(P.mech, { ...set, sp: { ...set.sp, spe: m.sp } }, forme, spdCond(P).mine), m.speed, m.kind === 'tie', m.tieAt)} ${tiers}.`;
  }
  if (!P.calc) return '';
  const row = rows.find((r) => r.key === m.key);
  if (!row) return '';
  const at = { ...set, nature: m.nature, ...(m.need?.item ? { item: m.need.item } : {}), sp: { ...set.sp } };
  if (m.kind === 'ko') {
    at.sp[m.stat] = m.sp;
    const h = B.hitResult(P.calc, P.mech, at, row, m.move, { boost: m.boost, field: fieldFor(P, at, row) });
    const r = h.result;
    if (r.class !== 'exact') return C.CLASS[r.class] ?? '';
    return T.koCalc(P.name('moves', m.move), m.sp, C.STAT_SHORT[m.stat], P.name('natures', m.nature), r, koWords(m.uses === 2 ? r.ko.two : r.ko.one, { uses: m.uses, hits: Math.max(...r.move.dist.map((x) => x.n)) }) ?? '', h.spread, fieldFor(P, at, row).weather);
  }
  const hp = m.stat === 'hp' ? m.sp : m.pair.sp, d = m.stat === 'hp' ? m.pair.sp : m.sp;
  at.sp.hp = hp; at.sp[m.defStat] = d;
  const th = B.theirHit(P.calc, P.mech, at, row, m.move, { spread: 'common', field: fieldFor(P, at, row) });
  const r = th.result;
  return r.class === 'exact' ? T.surviveCalc(hp, d, C.STAT_SHORT[m.defStat], P.name('natures', m.nature), r, koWords(r.ko.one, { hits: Math.max(...r.move.dist.map((x) => x.n)) }) ?? '', th.spread) : C.CLASS[r.class] ?? '';
}

// ---------- the screen ----------
/** opts.team: the set opened inside a team (#prep/teams/<id>/<slot>): the strip is that team, scope its matchup. */
export function editor(P, ws, l, { team = null } = {}) {
  P.ensureEngine();
  const set = draftSet(P, l);
  // inside a team, the default opponent is a matchup that brings it
  const sc = scopeOf(P, ws ?? (team ? [...P.ws.values()].find((w) => w.teamId === team.id && w.pov === P.ownSide()) ?? null : null));
  const rows = rowsOf(P, sc);
  P.tbLast = { setId: l.id, rows }; // what a tap into the workbench (tb-wb) looks its target row up in
  const back = btn(team ? `‹ ${team.name}` : ws ? '‹ Sets' : '‹ Teams', 'back', {}, { cls: 'back', aria: 'Back' });
  if (!P.mech) return `${back}${h2(P.spName(l.speciesId))}<p class="small">${esc(T.loadingData)}</p>`;
  const forme = B.myForme(P.mech, set);
  const fm = P.mech.species[forme] ?? P.mech.species[l.speciesId];
  const usable = set.sp !== 'unknown';
  const probs = checkSet(P.mech, set, { side: 'mine' }).filter((p) => p.severity === 'error');
  const speed = usable && P.mech.natures[set.nature] ? B.speedMarks(P.mech, set, forme, rows, spdCond(P)) : null;
  const em = usable ? engineMarks(P, set, sc, rows) : null;
  const all = [...(speed?.marks ?? []), ...(em?.marks ?? [])];
  const ui = (P.ui.tb ??= {});
  const focus = ui.focus?.[l.id] ?? null;
  const pin = ui.pin?.[l.id] ?? null;
  const seen = l.revealedTo ?? [];
  return `<div class="tb">${back}${h2(`${P.spName(forme)} · ${l.name || 'Set'} v${l.currentV}`)}
    ${revisionPrompt(P, l)}
    ${ctxLine(P, set, sc)}
    ${team ? teamOwnStrip(P, team, l) : teamStrip(P, ws, sc, l)}
    <div class="tb-card">
      ${setRow(P, l, set, fm, forme)}
      ${focus !== null && set.moves[focus] ? strip(P, set, set.moves[focus], rows, sc) : ''}
      ${probs.length ? `<ul class="ferrs" role="alert">${probs.map((p) => `<li>${esc(T.problem(p, nm(P)))}</li>`).join('')}</ul>` : ''}
      ${usable ? compareBar(P, l, set, pin, speed, em, sc, rows) : ''}
      ${usable ? statsPanel(P, l, set, fm, all, speed, em, sc, rows) : `<p class="banner warn">${esc(T.spUnknown)}</p>`}
      ${saveRow(P, l, set)}
      ${seen.length ? `<p class="small">${esc(T.seenBy)} ${seen.map((e) => `${esc(e.who.replace(/^partner:/, 'partner '))} (${esc(e.where ?? '')})`).join('; ')}</p>` : ''}
    </div></div>`;
}
function ctxLine(P, set, sc) {
  const opts = sc.others.map((c) => { const w = sc.firstWeek(c.name); return [c.name, `${c.name}${w ? ` (W${w})` : ''}${c.name === sc.def ? ` · ${T.next}` : ''}`]; });
  const w = P.mech ? B.autoWeather(P.mech, set, null) : null;
  const month = P.app.usage?.()?.month;
  return `<div class="tb-ctx small"><label>${esc(T.checking)} ${select('tb-scope', [...opts, [LEAGUE, T.league]], sc.value, { data: { pc: 'tb-scope' }, aria: T.checking })}</label>
    <span class="tb-asm muted">${esc(T.assumptions(sc.league ? T.allOpp(sc.others.length) : T.oneOpp(sc.value), month, w?.weather ? `${w.weather} (your ${P.name('abilities', w.mine.ability)})` : null))}</span></div>`;
}
/** Inside a team: that team's sets (tap to edit one), its planned species, and "+" to add a mon. */
function teamOwnStrip(P, team, l) {
  const tile = (id, i) => {
    const s = P.lineage(id);
    if (!s) return '';
    const d = currentVersion(s).data;
    const f = B.myForme(P.mech, { species: s.speciesId, item: d.item });
    return `<li><button type="button" class="tb-mon${id === l.id ? ' sel' : ''}" data-pa="team-slot" data-team="${esc(team.id)}" data-slot="${i + 1}" aria-pressed="${id === l.id}">${P.pt(s.speciesId, { size: 'sm' })}<span class="tb-mon-t"><span class="tb-mon-n">${esc(P.spName(f))}</span><span class="tb-mon-i">${esc(P.name('items', d.item) || T.noItem)}</span></span></button></li>`;
  };
  const planned = (team.planned ?? []).map((sp) => `<li><span class="tb-mon ghost">${P.pt(sp, { size: 'sm' })}<span class="tb-mon-t"><span class="tb-mon-n">${esc(P.spName(sp))}</span><span class="tb-mon-i">${esc(T.noSet)}</span></span></span></li>`).join('');
  const add = team.kind !== 'holding' && team.slots.length < 6 ? `<li>${btn('+', 'team-open', { team: team.id }, { cls: 'tb-add', aria: C.TEAMS.addMon })}</li>` : '';
  return `<p class="tb-lbl">${esc(team.name)}</p><ul class="${team.kind === 'holding' ? 'tb-bench' : 'tb-team'}">${team.slots.map(tile).join('')}${planned}${add}</ul>`;
}
function teamStrip(P, ws, sc, l) {
  const me = sc.me;
  const roster = P.coachRoster(me).filter((id) => P.mech.species[id] && !P.mech.species[id].mega);
  const sixWs = ws ?? (sc.league ? null : wsFor(P, me, sc.value));
  const six = (sixWs?.my6 ?? []).map((x) => P.lineage(x.setId)).filter(Boolean);
  const sixSp = new Set(six.map((x) => x.speciesId));
  const tile = (sp, lin) => {
    const s = lin ?? P.mineSets().find((x) => x.speciesId === sp);
    const d = s ? currentVersion(s).data : null;
    const f = s ? B.myForme(P.mech, { species: sp, item: d.item }) : sp;
    return `<li><button type="button" class="tb-mon${sp === l.speciesId ? ' sel' : ''}" data-pa="tb-open" data-species="${esc(sp)}" aria-pressed="${sp === l.speciesId}" aria-label="${esc(`${P.spName(f)}${s ? '' : `: ${T.noSet}`}`)}">${P.pt(sp, { size: 'sm' })}<span class="tb-mon-t"><span class="tb-mon-n">${esc(P.spName(f))}</span><span class="tb-mon-i">${esc(d ? P.name('items', d.item) || T.noItem : T.noSet)}</span></span></button></li>`;
  };
  const rest = roster.filter((sp) => !sixSp.has(sp));
  return `<p class="tb-lbl">${esc(sixWs ? T.yourSix(sixWs.coach) : T.noSixHere)}</p>
    ${six.length ? `<ul class="tb-team">${six.map((s) => tile(s.speciesId, s)).join('')}</ul>` : ''}
    <ul class="tb-bench"><li class="tb-lbl">${esc(six.length ? T.rest : T.yourTen)}</li>${rest.map((sp) => tile(sp, null)).join('')}</ul>`;
}
function setRow(P, l, set, fm, forme) {
  const sp = l.speciesId;
  const mega = !!fm.mega;
  const items = Object.keys(P.mech.items).filter((i) => !P.mech.items[i].megaStone || P.mech.items[i].megaStone[sp]).sort((a, b) => P.name('items', a).localeCompare(P.name('items', b)));
  const learn = learnset(P.mech, sp);
  const abil = mega ? [toID(fm.abilities[0] ?? '')] : legalAbilities(P.mech, sp);
  const stats = set.sp === 'unknown' || !P.mech.natures[set.nature] ? null : Object.fromEntries(STAT_IDS.map((k) => [k, statValue(k, fm.baseStats[k], set.sp[k] ?? 0, natureSign(P.mech.natures[set.nature], k))]));
  const moveSlot = (i) => {
    const mv = set.moves[i] ?? '';
    const ty = P.mech.moves[mv]?.type ?? '';
    return `<div class="field tb-mv"><span>${esc(T.move(i))}</span><span class="tb-mt ty-${esc(ty.toLowerCase())}" aria-hidden="true"></span><input id="tb-mv-${i}" type="text" list="tb-learn" autocomplete="off" value="${esc(mv ? P.name('moves', mv) : '')}" data-pc="tb-move" data-pa="tb-focus" data-set="${esc(l.id)}" data-i="${i}" aria-label="${esc(T.moveAria(i))}"></div>`;
  };
  return `<div class="tb-setrow">
    <div class="tb-who">${P.pt(sp, { size: 'lg' })}<div><span class="types">${(fm.types ?? []).map((t) => `<span class="ty ty-${esc(t.toLowerCase())}">${esc(t)}</span>`).join('')}</span>
      ${mega ? `<div class="small"><b>${esc(P.spName(forme))}</b> · ${esc(P.name('abilities', abil[0]))}</div>` : ''}</div></div>
    <div class="tb-fields">
      <label class="field" for="tb-nick"><span>${esc(T.nick)}</span><input id="tb-nick" type="text" maxlength="18" value="${esc(set.cosmetic?.nickname ?? '')}" placeholder="${esc(P.spName(sp))}" data-pi="tb-nick" data-set="${esc(l.id)}"></label>
      <label class="field" for="tb-item"><span>${esc(T.item)}</span><input id="tb-item" type="text" list="tb-items" autocomplete="off" value="${esc(P.name('items', set.item))}" data-pc="tb-item" data-set="${esc(l.id)}" aria-label="${esc(T.itemAria)}"></label>
      ${select('tb-ability', abil.map((a) => [a, P.name('abilities', a)]), mega ? abil[0] : set.ability, { label: T.ability, data: { pc: 'set-field', set: l.id, field: 'ability' } }).replace('<select', mega ? `<select disabled title="${esc(T.megaAbility(P.spName(forme)))}"` : '<select')}
    </div>
    <div class="tb-moves">${[0, 1, 2, 3].map(moveSlot).join('')}</div>
    <div class="tb-mini">${stats ? `<table>${STAT_IDS.map((k) => `<tr><td>${C.STAT_SHORT[k]}</td><td><span class="tb-mbar" style="width:${Math.min(60, Math.round((60 * stats[k]) / 260))}px"></span></td><td>${stats[k]}</td></tr>`).join('')}</table>` : ''}<div class="small muted">Lv 50 · ${esc(P.name('natures', set.nature) || '—')}</div></div>
    <datalist id="tb-learn">${learn.map((m) => `<option value="${esc(P.name('moves', m))}"></option>`).join('')}</datalist>
    <datalist id="tb-items">${items.map((i) => `<option value="${esc(P.name('items', i))}"></option>`).join('')}</datalist></div>`;
}

// ---------- calc strip: the focused move against the scope's mons ----------
function strip(P, set, move, rows, sc) {
  const mv = P.mech.moves[move];
  if (!mv) return '';
  if (mv.category === 'Status') return `<div class="tb-strip"><b>${esc(P.name('moves', move))}</b> <span class="small muted">${esc(B.SELF_BOOST[move] ? T.setupNote(P.name('moves', move)) : T.statusNote)}</span></div>`;
  if (!P.calc) return `<div class="tb-strip small">${esc(T.calculating)}</div>`;
  const st = B.moveStats(P.mech, move);
  const su = B.setupIn(set, st.atk);
  const w = B.autoWeather(P.mech, set, null);
  const cols = [{ k: '+0', boost: 0 }];
  if (su) cols.push({ k: `+${su.stage}`, boost: su.stage });
  if (w.weather) cols.push({ k: T.noWeather(w.weather), boost: 0, noWeather: true });
  const shown = sc.league ? topRows(rows, STRIP_MAX) : rows.slice(0, STRIP_MAX * 2);
  const cards = shown.map((row) => {
    const vals = cols.map((c) => {
      const field = c.noWeather ? {} : fieldFor(P, set, row);
      const r = memo(P, ['strip', set, row.key, row.set, row.common, move, c.boost, field], () => B.hitResult(P.calc, P.mech, set, row, move, { boost: c.boost, field }).result);
      // each value opens the workbench at exactly this calc
      const open = (inner, text) => `<button type="button" class="tb-v" data-pa="tb-wb" ${wbAttrs({ set: P.tbLast?.setId, key: row.key, move, role: 'attacker', boost: c.boost || undefined, noweather: c.noWeather ? 1 : undefined })} aria-label="${esc(T.wbOpen(`${rowName(P, row, sc)} ${c.k}: ${text}`))}">${inner}</button>`;
      if (r.class !== 'exact') return open(`<span class="k">${esc(c.k)}</span><b class="no">${esc(C.CLASS[r.class] || '—')}</b>`, C.CLASS[r.class] || '—');
      const ko = r.ko.one.num === r.ko.one.den;
      const text = `${pct(r.range.min, r.maxHP)}–${pct(r.range.max, r.maxHP)}%${ko ? ' KO' : r.ko.one.num !== '0' ? ` ${T.someKo(r.ko.one)}` : ''}`;
      return open(`<span class="k">${esc(c.k)}</span><b class="${ko ? 'ko' : 'no'}">${esc(text)}</b>`, text);
    }).join('');
    return `<div class="tb-hit"><div class="tb-hw">${P.pt(row.forme, { size: 'xs' })}<span>${esc(rowName(P, row, sc))}</span></div>${vals}</div>`;
  }).join('');
  const wl = fieldFor(P, set, null);
  return `<div class="tb-strip"><div class="tb-sh"><b>${esc(P.name('moves', move))}</b> <span class="small muted">${esc(T.stripHead(sc.league ? T.league : sc.value, wl.weather))}</span></div><div class="tb-hits">${cards}</div></div>`;
}
function memo(P, keyParts, fn) {
  P.tbCache ??= new Map();
  const key = JSON.stringify(keyParts);
  if (!P.tbCache.has(key)) { if (P.tbCache.size > 3000) P.tbCache.clear(); P.tbCache.set(key, fn()); }
  return P.tbCache.get(key);
}

// ---------- compare: Pin as A, "try:" ideas, the diff bar ----------
function compareBar(P, l, set, pin, speed, em, sc, rows) {
  const atkMove = B.myAttacks(P.mech, set)[0];
  const stat = atkMove ? B.moveStats(P.mech, atkMove).atk : 'spa';
  const seeds = B.seedOptions(P.mech, set, { stat, setupNeed: em?.setupNeed ?? null });
  const ideas = seeds.map((s) => btn((T.seed[s.key] ?? (() => s.key))(s.changes[0], nm(P)), 'tb-try', { set: l.id, seed: s.key, need: em?.setupNeed ?? '' }, { cls: 'pchip tb-idea' })).join('');
  const rank = speed ? T.rank(P.spName(B.myForme(P.mech, set)), speed.me, speed.fasterNeutral, speed.fasterPlus, speed.of, speed.ties) : '';
  return `<div class="tb-cmp">${pin ? '' : btn(T.pin, 'tb-pin', { set: l.id })}<span class="small muted">${esc(T.tryLbl)}</span>${ideas}<span class="small muted tb-rank">${esc(rank)}</span></div>
    ${pin ? diffBar(P, l, set, pin, speed, em, sc, rows) : ''}`;
}
function diffBar(P, l, set, A, speed, em, sc, rows) {
  const a = { species: l.speciesId, ...A, moves: (A.moves ?? []).filter(Boolean) };
  const n = nm(P), ch = [];
  if (a.item !== set.item) ch.push(`${n.item(a.item) || T.noItem} → ${n.item(set.item) || T.noItem}`);
  if (a.nature !== set.nature) ch.push(`${n.nature(a.nature)} → ${n.nature(set.nature)}`);
  for (const k of STAT_IDS) if ((a.sp[k] ?? 0) !== (set.sp[k] ?? 0)) ch.push(`${C.STAT_SHORT[k]} ${a.sp[k] ?? 0}→${set.sp[k] ?? 0}`);
  const add = set.moves.filter((m) => !a.moves.includes(m)), rm = a.moves.filter((m) => !set.moves.includes(m));
  if (add.length || rm.length) ch.push(`${rm.map(n.move).join(', ') || '—'} → ${add.map(n.move).join(', ') || '—'}`);
  const chips = [];
  if (ch.length) chips.push(`<span class="tb-d">${esc(ch.join(' · '))}</span>`);
  else chips.push(`<span class="muted">${esc(T.noChange)}</span>`);
  const fa = B.myForme(P.mech, a), sa = P.mech.natures[a.nature] ? B.speedMarks(P.mech, a, fa, rows, spdCond(P)) : null;
  if (sa && speed && sa.me !== speed.me) chips.push(`<span class="tb-d ${speed.me > sa.me ? 'up' : 'down'}">Spe ${sa.me} → ${speed.me}</span>`);
  if (sa && speed && (sa.fasterNeutral !== speed.fasterNeutral || sa.fasterPlus !== speed.fasterPlus)) {
    const up = speed.fasterNeutral + speed.fasterPlus > sa.fasterNeutral + sa.fasterPlus;
    chips.push(`<span class="tb-d ${up ? 'up' : 'down'}">${esc(T.fasterThan(sa, speed))}</span>`);
  }
  // marks gained / lost: each side judged with its own marks (another item or nature can change what is reachable)
  const emA = engineMarks(P, a, sc, rows);
  if (em && emA) {
    const label = (m) => markText(P, m, sc, rows).replace(/ \[.*\]$/, '');
    const metOf = (marks, s) => { const out = new Map(); for (const m of marks) { if (m.kind === 'tie') continue; const k = label(m); out.set(k, { met: (out.get(k)?.met ?? false) || B.markMet(m, s), m: out.get(k)?.m ?? m }); } return out; };
    const was = metOf([...(sa?.marks ?? []), ...emA.marks], a), now = metOf([...(speed?.marks ?? []), ...em.marks], set);
    // a KO / survive item opens the workbench on that target with your current draft (a Speed item has no calc to open)
    const item = (k, m, cls, sign) => (m.kind === 'ko' || m.kind === 'survive'
      ? `<button type="button" class="tb-d ${cls}" data-pa="tb-wb" ${wbAttrs(markSeed(l.id, m, false))} aria-label="${esc(T.wbOpen(k))}">${sign} ${esc(k)}</button>`
      : `<span class="tb-d ${cls}">${sign} ${esc(k)}</span>`);
    for (const [k, v] of now) if (v.met && !was.get(k)?.met) chips.push(item(k, v.m, 'up', '✓'));
    for (const [k, v] of was) if (v.met && !now.get(k)?.met) chips.push(item(k, v.m, 'down', '✗'));
  } else chips.push(`<span class="small muted">${esc(T.calculating)}</span>`);
  // bulk: expected OHKOs from the scope's common hits (lower is bulkier); only with ladder usage loaded
  const usage = P.app.usage?.() ?? null;
  if (usage?.species && P.calc) {
    const pool = [...new Set(rows.map((r) => r.species))];
    const b = (s) => memo(P, ['bulk', B.shapeOf(s), s.sp, s.item, pool, usage.month ?? null], () => B.bulkScore(P.calc, P.mech, s, pool, usage).score);
    const ba = b(a), bb = b(set);
    if (Math.abs(ba - bb) >= 0.005 || ch.length) chips.push(`<span class="tb-d ${bb < ba - 0.004 ? 'up' : bb > ba + 0.004 ? 'down' : ''}" title="${esc(T.bulkHelp)}">${esc(T.bulk(ba, bb))}</span>`);
  }
  return `<div class="tb-diff"><b>${esc(T.vsA)}</b> ${chips.join(' ')} ${btn(T.backToA, 'tb-revert', { set: l.id }, { cls: 'linkish' })} ${btn(T.unpin, 'tb-unpin', { set: l.id }, { cls: 'linkish' })}</div>`;
}

// ---------- the stats panel: SP sliders with marks ----------
function statsPanel(P, l, set, fm, all, speed, em, sc, rows) {
  const nat = P.mech.natures[set.nature];
  const tip = P.ui.tb?.tip?.[l.id] ?? null;
  const rowsHtml = STAT_IDS.map((k) => {
    const sign = natureSign(nat, k);
    const v = set.sp[k] ?? 0;
    const fin = statValue(k, fm.baseStats[k], v, sign);
    let marks = all.filter((m) => m.stat === k);
    if (sc.league) marks = marks.filter((m) => Math.abs(m.sp - v) <= NEAR);
    const groups = new Map();
    for (const m of marks) groups.set(m.sp, [...(groups.get(m.sp) ?? []), m]);
    const ticks = [...groups].sort((a, b) => a[0] - b[0]).map(([sp, g]) => {
      const met = g.some((m) => B.markMet(m, set)), off = g.every((m) => m.need), tie = g.every((m) => m.kind === 'tie'), ko = g.some((m) => m.kind === 'ko' || m.kind === 'survive');
      const lines = g.map((m) => markText(P, m, sc, rows)).join(' · ');
      const left = `calc(var(--tbthumb) / 2 + (100% - var(--tbthumb)) * ${sp / SP_PER_STAT})`;
      return `<button type="button" class="tb-tick${met ? ' met' : ''}${off ? ' off' : ''}${tie ? ' tie' : ''}${ko ? ' ko' : ''}${tip && tip.stat === k && tip.sp === sp ? ' on' : ''}" style="left:${left}" data-pa="tb-tip" data-set="${esc(l.id)}" data-stat="${k}" data-sp="${sp}" data-need="${off ? 1 : 0}" aria-label="${esc(`${C.STAT_SHORT[k]} ${sp}: ${lines}. ${met ? T.reached : T.notReached}`)}"></button>`;
    }).join('');
    const cants = cantChips(P, k, speed, em, sc, rows);
    const tipHtml = tip && tip.stat === k ? tipLine(P, l, set, all.filter((m) => m.stat === k && m.sp === tip.sp), sc, rows) : '';
    const busy = !em && k !== 'spe' ? `<span class="small muted tb-busy">${esc(P.engineState === 'failed' ? T.engineFailed : T.calculating)}</span>` : '';
    return `<div class="tb-srow" data-stat="${k}" data-base="${fm.baseStats[k]}" data-sign="${sign}">
      <span class="tb-sname${sign === '+' ? ' plus' : sign === '-' ? ' minus' : ''}">${C.STAT_SHORT[k]}${sign ? `<sup>${sign === '+' ? '+' : '−'}</sup>` : ''}</span>
      <span class="tb-sbase" title="${esc(T.base)}">${fm.baseStats[k]}</span>
      <span class="tb-sbarw" aria-hidden="true"><span class="tb-sbar" style="width:${Math.min(100, (100 * fin) / 260)}%"></span></span>
      <div class="tb-slidew"><input id="tb-sp-${k}" type="range" min="0" max="${SP_PER_STAT}" step="1" value="${v}" data-pc="sp-value" data-pi="tb-sp-live" data-set="${esc(l.id)}" data-stat="${k}" aria-label="${esc(T.spAria(C.STAT_LONG[k]))}">
        <div class="tb-ticks">${ticks}</div>${busy}${cants}</div>
      <span class="tb-spn"><input id="tb-spn-${k}" type="number" inputmode="numeric" min="0" max="${SP_PER_STAT}" step="1" value="${v}" data-pc="sp-value" data-set="${esc(l.id)}" data-stat="${k}" aria-label="${esc(T.spNumAria(C.STAT_LONG[k]))}"></span>
      <span class="tb-final">${fin}</span>${tipHtml}${k === 'spe' ? spdToggles(P) : ''}</div>`;
  }).join('');
  const left = SP_TOTAL - spTotal(set.sp);
  const natures = Object.keys(P.mech.natures).sort().map((n) => { const x = P.mech.natures[n]; return [n, `${x.name}${x.plus && x.plus !== x.minus ? ` (+${C.STAT_SHORT[x.plus]} −${C.STAT_SHORT[x.minus]})` : ''}`]; });
  return `<div class="tb-stats">${rowsHtml}</div>
    <div class="tb-foot">${select('tb-nature', natures, set.nature, { label: T.nature, data: { pc: 'set-field', set: l.id, field: 'nature' } })}
      <span class="tb-left${left < 0 ? ' over' : left === 0 ? ' zero' : ''}">${esc(left < 0 ? T.over(-left) : T.left(left))}</span><span class="small muted">${esc(T.ofTotal)}</span>
      <span class="tb-legend small muted"><span><i class="met"></i>${esc(T.reached)}</span><span><i></i>${esc(T.notYet)}</span><span><i class="tie"></i>${esc(T.tie)}</span><span><i class="ko met"></i>${esc(T.koSurvive)}</span><span><i class="off"></i>${esc(T.needsOther)}</span></span></div>`;
}
function cantChips(P, k, speed, em, sc, rows) {
  const out = [];
  if (k === 'spe' && speed?.cant.length) {
    const c = speed.cant;
    const who = (x) => x.who.map((w) => `${sc.league ? `${w.coach}'s ` : ''}${P.spName(w.forme)}`).join(', ');
    out.push(c.length <= 2 ? c.map((x) => `<span class="tb-cant bad">${esc(T.cantBeat(x.speed, x.best, who(x)))}</span>`).join('')
      : `<span class="tb-cant" title="${esc(c.map((x) => `${x.speed}: ${who(x)}`).join('\n'))}">${esc(T.cantBeatN(c.length, c[0].speed, c.at(-1).speed, c[0].best))}</span>`);
  }
  const noKo = new Map(); // one chip per move: "no OHKO at +0 even at 32 on A, B, C"
  for (const c of em?.cant ?? []) {
    const r = rows.find((x) => x.key === c.key);
    if (!r) continue;
    if (c.kind === 'ko' && k === c.stat) noKo.set(c.move, [...(noKo.get(c.move) ?? []), { c, name: rowName(P, r, sc) }]);
    if (c.kind === 'survive' && k === 'hp') out.push(`<button type="button" class="tb-cant bad" data-pa="tb-wb" ${wbAttrs({ set: P.tbLast?.setId, key: c.key, move: c.move, role: 'defender' })} aria-label="${esc(T.wbOpen(T.cantSurvive(rowName(P, r, sc), P.name('moves', c.move))))}">${esc(T.cantSurvive(rowName(P, r, sc), P.name('moves', c.move)))}</button>`);
  }
  // "no OHKO even at 32": each target name opens the workbench with that stat at 32
  for (const [mv, who] of noKo) {
    const names = who.map(({ c, name }) => `<button type="button" class="linkish" data-pa="tb-wb" ${wbAttrs({ set: P.tbLast?.setId, key: c.key, move: mv, role: 'attacker', stat: c.stat, sp: SP_PER_STAT })} aria-label="${esc(T.wbOpen(`${P.name('moves', mv)} on ${name}`))}">${esc(name)}</button>`).join(', ');
    out.push(`<span class="tb-cant">${esc(T.cantKoHead(P.name('moves', mv)))} ${names}</span>`);
  }
  return out.length ? `<div class="tb-cants">${out.join('')}</div>` : '';
}
function tipLine(P, l, set, marks, sc, rows) {
  if (!marks.length) return '';
  const wbBtn = (m) => (m.kind === 'ko' || m.kind === 'survive' ? ` <button type="button" class="linkish" data-pa="tb-wb" ${wbAttrs(markSeed(l.id, m, true))}>${esc(T.wbOpenShort)}</button>` : '');
  return `<div class="tb-tip">${marks.map((m) => `<p><b>${esc(markText(P, m, sc, rows))}</b> <span class="small">${esc(markCalc(P, m, set, sc, rows))}</span>${wbBtn(m)}</p>`).join('')}${btn(T.close, 'tb-tip', { set: l.id, stat: '', sp: '' }, { cls: 'linkish' })}</div>`;
}

// ---------- into the workbench ----------
const wbAttrs = (d) => Object.entries(d).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ');
/** A mark as workbench data: atMark puts your stat(s), nature and item at the mark's values (else your draft as it is). */
function markSeed(setId, m, atMark) {
  const d = { set: setId, key: m.key, move: m.move, role: m.kind === 'survive' ? 'defender' : 'attacker', boost: m.kind === 'ko' && m.boost ? m.boost : undefined };
  if (!atMark) return d;
  if (m.kind === 'ko') return { ...d, stat: m.stat, sp: m.sp, nature: m.nature, item: m.need?.item };
  const hp = m.stat === 'hp' ? m.sp : m.pair.sp, df = m.stat === 'hp' ? m.pair.sp : m.sp;
  return { ...d, stat: 'hp', sp: hp, stat2: m.defStat, sp2: df, nature: m.nature, item: m.need?.item };
}
/** tb-wb: open the workbench for one target row (from P.tbLast, the rows this editor just showed). */
function openWorkbench(t, P) {
  const d = t.dataset, last = P.tbLast;
  const l = lineage(P, d.set);
  if (!l || !last || last.setId !== l.id || !P.mech) return;
  const row = last.rows.find((r) => r.key === d.key);
  if (!row) return;
  const base = draftSet(P, l);
  if (base.sp === 'unknown') return;
  const mine = structuredClone(base);
  if (d.nature) mine.nature = d.nature;
  if (d.item) mine.item = d.item;
  if (d.stat) mine.sp[d.stat] = Number(d.sp);
  if (d.stat2) mine.sp[d.stat2] = Number(d.sp2);
  WB.open(P, { setId: l.id, mine, base, row, move: d.move, mineRole: d.role === 'defender' ? 'defender' : 'attacker', boost: Number(d.boost) || 0, field: d.noweather ? {} : fieldFor(P, mine, row) });
}

// ---------- save, import / export, history ----------
function saveRow(P, l, set) {
  const dirty = isDirty(P, l);
  const io = P.ui.tb?.io?.[l.id];
  let text = '';
  if (io) { try { text = exportSet(set, P.mech, { sp: set.sp === 'unknown' ? spForUnknown(P, set, 'common') : null }).text; } catch { text = ''; } }
  const history = l.versions.slice().reverse().map((v) => `<li>v${v.v} · ${esc(v.at.slice(0, 10))} · ${esc(v.reason ?? '')}${v.v === l.currentV ? ` <b>${esc(T.current)}</b>` : ` ${btn(T.useVersion, 'set-revert', { set: l.id, v: v.v }, { cls: 'linkish' })}`}</li>`).join('');
  return `<div class="tb-actions">${btn(T.save, 'set-save', { set: l.id }, { primary: true, disabled: !dirty })} ${btn(T.saveCopy, 'set-save-copy', { set: l.id })} ${btn(T.discard, 'set-discard', { set: l.id }, { disabled: !dirty })}
      ${dirty ? `<span class="tb-dirty">● ${esc(T.unsaved)}</span>` : `<span class="small muted">${esc(T.saved(l.currentV))}</span>`}
      ${btn(T.io, 'tb-io', { set: l.id }, { cls: 'linkish tb-io-btn', pressed: !!io })}</div>
    ${io ? `<div class="tb-iobox"><label class="field" for="tb-iotext"><span>${esc(T.ioHelp)}</span><textarea id="tb-iotext" rows="8" spellcheck="false" data-pi="tb-iotext" data-set="${esc(l.id)}">${esc(P.ui.tb.ioText?.[l.id] ?? text)}</textarea></label>
      <p>${btn(T.importIt, 'tb-import', { set: l.id }, { primary: true })} ${btn(T.copy, 'set-copy', { set: l.id })} ${btn(T.close, 'tb-io', { set: l.id })}</p></div>` : ''}
    <details class="small"><summary>${esc(T.history(l.versions.length))}</summary><ul>${history}</ul></details>
    <p class="small">${btn(T.delete, 'set-delete', { set: l.id }, { cls: 'linkish' })}</p>`;
}

// ---------- actions ----------
const tbUi = (P) => (P.ui.tb ??= {});
const lineage = (P, id) => P.docs.mysets.sets.find((s) => s.id === id) ?? null;
/** Put calc data into the set's draft (never a version): the existing editor's draft, so Save / Discard work as before. */
function intoDraft(P, id, data) {
  updateDraft(P, id, (c) => { const { species, ...rest } = data; c.data = cleanSetData({ ...c.data, ...rest }); });
}
function openSpecies(P, sp) {
  const r = P.route;
  const ws = r.view === 'ws' && r.wsId ? P.ws.get(r.wsId) : null;
  const inSix = new Set((ws?.my6 ?? []).map((x) => x.setId));
  const sets = P.mineSets().filter((s) => s.speciesId === sp);
  let id = (sets.find((s) => inSix.has(s.id)) ?? sets[0])?.id ?? null;
  if (!id) { id = createMySet(P, sp); if (!id) return; P.toast(T.started); }
  P.go(ws ? { view: 'ws', wsId: ws.id, kind: 'sets', id } : { view: 'my-sets', id }, { push: false });
}
export const actions = {
  'tb-open': (t, P) => openSpecies(P, t.dataset.species),
  'tb-focus': (t, P) => { const u = (tbUi(P).focus ??= {}); const i = Number(t.dataset.i); if (u[t.dataset.set] !== i) { u[t.dataset.set] = i; P.app.rerender(); } },
  'tb-wb': openWorkbench,
  'tb-tip': (t, P) => {
    const u = (tbUi(P).tip ??= {});
    const cur = u[t.dataset.set];
    if (!t.dataset.stat || (cur && cur.stat === t.dataset.stat && cur.sp === Number(t.dataset.sp))) delete u[t.dataset.set];
    else u[t.dataset.set] = { stat: t.dataset.stat, sp: Number(t.dataset.sp) };
    P.app.rerender();
  },
  'tb-spd': (t, P) => { const s = spdUi(P); if (SPD_KEYS.includes(t.dataset.key)) s[t.dataset.key] = !s[t.dataset.key]; P.saveUi(); P.app.rerender(); },
  'tb-pin': (t, P) => { const l = lineage(P, t.dataset.set); if (!l) return; (tbUi(P).pin ??= {})[l.id] = structuredClone(draftSet(P, l)); P.saveUi(); P.toast(T.pinned); P.app.rerender(); },
  'tb-unpin': (t, P) => { delete tbUi(P).pin?.[t.dataset.set]; P.saveUi(); P.app.rerender(); },
  'tb-revert': (t, P) => { const a = tbUi(P).pin?.[t.dataset.set]; if (a) intoDraft(P, t.dataset.set, a); },
  'tb-try': (t, P) => {
    const l = lineage(P, t.dataset.set);
    if (!l || !P.mech) return;
    const set = draftSet(P, l);
    const mv = B.myAttacks(P.mech, set)[0];
    const s = B.seedOptions(P.mech, set, { stat: mv ? B.moveStats(P.mech, mv).atk : 'spa', setupNeed: t.dataset.need === '' || t.dataset.need === undefined ? null : Number(t.dataset.need) }).find((x) => x.key === t.dataset.seed);
    if (!s) return;
    const pins = (tbUi(P).pin ??= {});
    if (!pins[l.id]) pins[l.id] = structuredClone(set);
    P.saveUi();
    intoDraft(P, l.id, s.set);
    P.toast(T.trying);
  },
  'tb-io': (t, P) => { const u = (tbUi(P).io ??= {}); u[t.dataset.set] = !u[t.dataset.set]; delete tbUi(P).ioText?.[t.dataset.set]; P.app.rerender(); },
  'tb-import': (t, P) => {
    const l = lineage(P, t.dataset.set);
    const text = tbUi(P).ioText?.[t.dataset.set];
    if (!l || !P.mech || text === undefined) { P.toast(T.importNothing); return; }
    const r = parseTeamQuick(text, { mech: P.mech, side: 'mine' });
    const s = r.sets?.find((x) => x.set);
    if (!s) { const bad = r.sets?.[0]?.lines.find((x) => x.tier === 1); P.toast(bad && typeof C.PASTE[bad.code] === 'function' ? T.importHeld(C.PASTE[bad.code](bad)) : T.importFailed); return; }
    if (s.set.species !== l.speciesId) { P.toast(T.importOther(P.spName(s.set.species))); return; }
    intoDraft(P, l.id, s.set);
    tbUi(P).io[l.id] = false;
    P.toast(s.converted ? T.importedConverted(C.evsConverted(s.converted.from, s.converted.to)) : T.imported);
  },
};
export const changes = {
  'tb-scope': (t, P) => { tbUi(P); P.ui.tbScope = t.value; P.saveUi(); P.app.rerender(); },
  'tb-item': (t, P) => {
    const l = lineage(P, t.dataset.set);
    if (!l || !P.mech) return;
    const want = t.value.trim().toLowerCase();
    const id = !want ? '' : Object.keys(P.mech.items).find((i) => (P.name('items', i).toLowerCase() === want || i === toID(want)) && (!P.mech.items[i].megaStone || P.mech.items[i].megaStone[l.speciesId]));
    if (id === undefined) { P.toast(T.unknownItem(t.value)); P.app.rerender(); return; }
    updateDraft(P, l.id, (c) => { c.data.item = id; });
  },
  'tb-move': (t, P) => {
    const l = lineage(P, t.dataset.set);
    if (!l || !P.mech) return;
    const want = t.value.trim().toLowerCase();
    const id = !want ? '' : learnset(P.mech, l.speciesId).find((m) => P.name('moves', m).toLowerCase() === want || m === toID(want));
    if (id === undefined) { P.toast(T.unknownMove(t.value, P.spName(l.speciesId))); P.app.rerender(); return; }
    const i = Number(t.dataset.i);
    (tbUi(P).focus ??= {})[l.id] = i;
    updateDraft(P, l.id, (c) => { const m = [0, 1, 2, 3].map((j) => c.data.moves[j] ?? ''); m[i] = id; c.data.moves = m.filter(Boolean); });
  },
};
export const inputs = {
  'tb-nick': (t, P) => updateDraft(P, t.dataset.set, (c) => { c.data.cosmetic = { ...(c.data.cosmetic ?? {}), nickname: t.value.slice(0, 18) }; }, { render: false }),
  'tb-iotext': (t, P) => { (tbUi(P).ioText ??= {})[t.dataset.set] = t.value.slice(0, 4000); },
  // while dragging: this row and the counter update in place (no re-render, no engine); the change event (release) saves
  'tb-sp-live': (t) => {
    const row = t.closest?.('.tb-srow');
    if (!row) return;
    const v = Number(t.value), k = row.dataset.stat, base = Number(row.dataset.base), sign = row.dataset.sign;
    const fin = statValue(k, base, v, sign);
    const num = row.querySelector('.tb-spn input'); if (num) num.value = String(v);
    const f = row.querySelector('.tb-final'); if (f) f.textContent = String(fin);
    const bar = row.querySelector('.tb-sbar'); if (bar) bar.style.width = `${Math.min(100, (100 * fin) / 260)}%`;
    for (const tk of row.querySelectorAll('.tb-tick')) if (tk.dataset.need !== '1' && !tk.classList.contains('tie')) tk.classList.toggle('met', v >= Number(tk.dataset.sp));
    const panel = row.closest('.tb-stats');
    const total = [...(panel?.querySelectorAll('input[type=range]') ?? [])].reduce((s, x) => s + Number(x.value), 0);
    const left = panel?.parentElement?.querySelector('.tb-left');
    if (left) { const n = SP_TOTAL - total; left.textContent = n < 0 ? T.over(-n) : T.left(n); left.className = `tb-left${n < 0 ? ' over' : n === 0 ? ' zero' : ''}`; }
  },
};

// Battle Prep › Move search (#prep/moves): who in a pool can learn a move like this, from full legal learnsets (not
// usage), with the abilities that power it up, the owning coach, ladder usage as context, and a worst-case damage chip
// into your team (tap → the workbench). Query state lives in this tab's session (P.ui.moves).
import { searchMoves, worstCaseAttacker, FLAGS, SYNERGY } from '../lib/move-search.mjs';
import { currentVersion } from '../lib/prep-model.mjs';
import { normalizeScenario } from '../lib/calc/scenario.mjs';
import * as C from './prep-copy.js';
import { esc, btn, chipBtn, h2, select } from './prep-ui.js';
import * as WB from './prep-workbench.js';
import { myForme } from '../lib/prep-build.mjs';

const T = C.MOVES;
const SHOWN = 40;
const ui = (P) => (P.ui.moves ??= { text: '', type: '', category: 'damaging', minBP: '', flags: [], ability: '', scope: '', more: false });
const ALL = '__all', BOARD = '__board', MINE = '__mine';

/** The pool for a scope: one opponent's 10, all opponents, the whole draft board, or your 10. [{species, coach}] */
export function poolOf(P, scope) {
  const L = P.league();
  if (!L) return [];
  const me = P.myCoach();
  const picks = (c) => c.picks.filter((p) => p.id).map((p) => ({ species: p.id, coach: c.name }));
  if (scope === MINE) return L.coaches.filter((c) => c.name === me).flatMap(picks);
  if (scope === ALL) return L.coaches.filter((c) => c.name !== me).flatMap(picks);
  if (scope === BOARD) {
    const owner = new Map(L.coaches.flatMap((c) => c.picks.filter((p) => p.id).map((p) => [p.id, c.name])));
    const ids = [...new Set([...(L.board ?? []).map((b) => b.id).filter(Boolean), ...owner.keys()])];
    return ids.map((id) => ({ species: id, coach: owner.get(id) ?? null }));
  }
  const c = L.coaches.find((x) => x.name === scope);
  return c ? picks(c) : [];
}
const defaultScope = (P) => { const me = P.myCoach(); return (P.coaches() ?? []).find((c) => c.name !== me)?.name ?? ALL; };
/** Your sets to check damage into: one per species of your 10 (its current version), Stat Points known. */
function myTeam(P) {
  const me = P.myCoach();
  const roster = new Set(P.coachRoster(me));
  const seen = new Set(), out = [];
  for (const l of P.mineSets()) {
    if (!roster.has(l.speciesId) || seen.has(l.speciesId)) continue;
    const d = currentVersion(l).data;
    if (d.sp === 'unknown') continue;
    seen.add(l.speciesId);
    out.push({ setId: l.id, set: { species: l.speciesId, ...structuredClone(d), moves: (d.moves ?? []).filter(Boolean) } });
  }
  return out;
}
const query = (u) => ({ text: u.text, type: u.type, category: u.category, minBP: Number(u.minBP) || 0, flags: u.flags, ability: u.ability });

// ---------- worst-case chips (deferred, cached per query) ----------
function chipsFor(P, results, team) {
  if (!P.calc || !team.length) return null;
  const key = JSON.stringify(['mv-chips', results.map((r) => [r.species, r.best]), team.map((t) => [t.setId, t.set])]);
  P.mvCache ??= new Map();
  if (P.mvCache.has(key)) return P.mvCache.get(key);
  const run = () => {
    const out = new Map();
    for (const r of results) {
      const mv = P.mech.moves[r.best];
      if (!mv || mv.category === 'Status') continue;
      const atk = worstCaseAttacker(P.mech, r, r.best);
      let worst = null;
      for (const t of team) {
        const res = P.calc.run(normalizeScenario({ attacker: { set: atk.set, state: { mega: atk.mega } }, defender: { set: { ...t.set, gender: '' }, state: { mega: true } }, move: { id: r.best } }), { lite: true });
        if (res.class !== 'exact') continue;
        const pct = Math.floor((1000 * res.range.max) / res.maxHP) / 10;
        if (!worst || pct > worst.pct) worst = { pct, lo: Math.floor((1000 * res.range.min) / res.maxHP) / 10, target: t, ko: res.ko.one, atk };
      }
      if (worst) out.set(r.species, worst);
    }
    if (P.mvCache.size > 30) P.mvCache.clear();
    P.mvCache.set(key, out);
  };
  const idle = globalThis.requestIdleCallback;
  if (typeof idle !== 'function') { run(); return P.mvCache.get(key); }
  P.mvJobs ??= new Set();
  if (!P.mvJobs.has(key)) { P.mvJobs.add(key); idle(() => { run(); P.mvJobs.delete(key); P.app.rerender(); }, { timeout: 300 }); }
  return null;
}

// ---------- the screen ----------
export function screen(P) {
  const u = ui(P);
  if (!u.scope) u.scope = defaultScope(P);
  P.ensureMech(); P.ensureEngine();
  const back = btn('‹ Prep', 'go-home', {}, { cls: 'back', aria: 'Back to Prep home' });
  if (!P.mech || !P.league()) return `<section class="panel prep-moves">${back}${h2(T.head)}<p class="small">${esc(T.loading)}</p></section>`;
  const me = P.myCoach();
  const coaches = (P.coaches() ?? []).filter((c) => c.name !== me);
  const types = [...new Set(Object.values(P.mech.moves).map((m) => m.type))].sort();
  const abilities = Object.keys(P.mech.abilities).sort((a, b) => P.name('abilities', a).localeCompare(P.name('abilities', b)));
  const pool = poolOf(P, u.scope);
  const q = query(u);
  const active = q.text || q.type || q.minBP || q.flags.length || q.ability || q.category !== 'damaging';
  const results = active ? searchMoves(P.mech, pool, q) : [];
  const shown = u.more ? results : results.slice(0, SHOWN);
  const team = myTeam(P);
  const chips = active ? chipsFor(P, shown, team) : null;
  const usage = P.app.usage?.() ?? null;
  const form = `<div class="mv-form">
    <label class="field mv-text" for="mv-text"><span>${esc(T.move)}</span><input id="mv-text" type="search" autocomplete="off" spellcheck="false" placeholder="${esc(T.movePh)}" value="${esc(u.text)}" data-pi="mv-text"></label>
    ${select('mv-type', [['', T.anyType], ...types.map((t) => [t, t])], u.type, { label: T.type, data: { pc: 'mv-set', key: 'type' } })}
    ${select('mv-cat', [['damaging', T.damaging], ['Physical', 'Physical'], ['Special', 'Special'], ['Status', 'Status'], ['', T.anyCat]], u.category, { label: T.category, data: { pc: 'mv-set', key: 'category' } })}
    <label class="field mv-bp" for="mv-bp"><span>${esc(T.minBP)}</span><input id="mv-bp" type="number" inputmode="numeric" min="0" max="250" step="5" value="${esc(u.minBP)}" data-pc="mv-set" data-key="minBP"></label>
    <label class="field mv-ab" for="mv-ab"><span>${esc(T.ability)}</span><input id="mv-ab" type="text" list="mv-abilities" autocomplete="off" value="${esc(u.ability ? P.name('abilities', u.ability) : '')}" placeholder="${esc(T.anyAbility)}" data-pc="mv-ability"></label>
    <datalist id="mv-abilities">${abilities.map((a) => `<option value="${esc(P.name('abilities', a))}"></option>`).join('')}</datalist>
    ${select('mv-scope', [...coaches.map((c) => [c.name, T.their10(c.name)]), [ALL, T.allOpp], [BOARD, T.board], [MINE, T.mine]], u.scope, { label: T.scope, data: { pc: 'mv-set', key: 'scope' } })}
    </div>
    <div class="choices" role="group" aria-label="${esc(T.flags)}">${Object.keys(FLAGS).map((f) => chipBtn(T.flag[f], 'mv-flag', { flag: f }, u.flags.includes(f))).join('')}${active ? btn(T.clear, 'mv-clear', {}, { cls: 'linkish' }) : ''}</div>`;
  const card = (r) => {
    const sp = P.mech.species[r.species];
    const pct = usage?.species?.[r.species]?.usage;
    const ab = r.abilities.map((a) => `<span class="mv-ab${a.synergy.length ? ' syn' : ''}"${a.synergy.length ? ` title="${esc(a.label ?? '')}"` : ''}>${a.synergy.length ? '★ ' : ''}${esc(P.name('abilities', a.id))}${a.forme !== r.species ? ` (${esc(P.spName(a.forme))})` : ''}${a.synergy.length && a.label ? ` <span class="small">${esc(a.label)}</span>` : ''}</span>`).join(' ');
    const mv = r.moves.slice(0, 8).map((m) => { const x = P.mech.moves[m.id]; return `<span class="mv-move ty-${esc(x.type.toLowerCase())}${m.synergy.length ? ' syn' : ''}">${m.synergy.length ? '★ ' : ''}${esc(x.name)} <span class="small">${x.basePower || '—'}${FLAGS.spread(x) ? ` · ${esc(T.spreadShort)}` : ''}${x.priority > 0 ? ` · +${x.priority}` : ''}</span></span>`; }).join(' ') + (r.moves.length > 8 ? ` <span class="small muted">+${r.moves.length - 8}</span>` : '');
    const w = chips?.get(r.species);
    const dmg = !team.length ? '' : !P.calc ? `<span class="small muted">${esc(T.calculating)}</span>` : chips === null ? `<span class="small muted">${esc(T.calculating)}</span>`
      : w ? `<button type="button" class="mv-dmg${w.ko.num === w.ko.den ? ' ko' : w.ko.num !== '0' ? ' maybe' : ''}" data-pa="mv-wb" data-species="${esc(r.species)}" data-set="${esc(w.target.setId)}" aria-label="${esc(T.dmgAria(P.name('moves', r.best), P.spName(myForme(P.mech, w.target.set)), w.lo, w.pct))}">${esc(T.dmg(P.name('moves', r.best), P.spName(myForme(P.mech, w.target.set)), w.lo, w.pct))}</button>` : '';
    return `<li class="mv-card"><div class="mv-head">${P.pt(r.species, { size: 'sm' })}<span><b>${esc(sp.name)}</b> <span class="small muted">${esc(r.coach ? T.ownedBy(r.coach) : T.undrafted)}${pct !== undefined && pct !== null ? ` · ${esc(T.usage(pct))}` : ` · ${esc(T.noUsage)}`}</span></span></div>
      <p class="small mv-abs">${ab}</p><p class="mv-moves">${mv}</p>${dmg ? `<p class="small">${dmg}</p>` : ''}</li>`;
  };
  const list = !active ? `<p class="small">${esc(T.hint)}</p>` : !results.length ? `<p>${esc(T.none)}</p>`
    : `<p class="small" role="status">${esc(T.count(results.length, pool.length))}${team.length ? ` ${esc(T.dmgNote)}` : ` ${esc(T.noTeam)}`}</p><ul class="mv-list">${shown.map(card).join('')}</ul>${results.length > shown.length ? btn(T.more(results.length - shown.length), 'mv-more') : ''}`;
  return `<section class="panel prep-moves">${back}${h2(T.head)}<p class="small">${esc(T.intro)}</p>${form}${list}</section>`;
}

// ---------- actions ----------
const rerender = (P) => { P.saveUi(); P.app.rerender(); };
export const actions = {
  'go-moves': (t, P) => { if (t.dataset.scope) { ui(P).scope = t.dataset.scope; } P.go({ view: 'moves' }, { push: true }); },
  'mv-flag': (t, P) => { const u = ui(P); const f = t.dataset.flag; u.flags = u.flags.includes(f) ? u.flags.filter((x) => x !== f) : [...u.flags, f]; u.more = false; rerender(P); },
  'mv-clear': (t, P) => { Object.assign(ui(P), { text: '', type: '', category: 'damaging', minBP: '', flags: [], ability: '', more: false }); rerender(P); },
  'mv-more': (t, P) => { ui(P).more = true; rerender(P); },
  // the worst-case chip: that hit into that set of yours, in the workbench (you defending)
  'mv-wb': (t, P) => {
    const u = ui(P);
    const r = searchMoves(P.mech, poolOf(P, u.scope), query(u)).find((x) => x.species === t.dataset.species);
    const mine = myTeam(P).find((x) => x.setId === t.dataset.set);
    if (!r || !mine) return;
    const atk = worstCaseAttacker(P.mech, r, r.best);
    WB.open(P, { setId: mine.setId, mine: mine.set, row: { key: `search|${r.species}`, coach: r.coach, species: r.species, forme: atk.forme, mega: atk.mega, set: atk.set, source: 'search' }, move: r.best, mineRole: 'defender' });
  },
};
export const changes = {
  'mv-set': (t, P) => { const u = ui(P); u[t.dataset.key] = t.value; u.more = false; rerender(P); },
  'mv-ability': (t, P) => {
    const want = t.value.trim().toLowerCase();
    const id = want ? Object.keys(P.mech.abilities).find((a) => P.name('abilities', a).toLowerCase() === want || a === want.replace(/[^a-z0-9]/g, '')) : '';
    if (id === undefined) { P.toast(T.unknownAbility(t.value)); P.app.rerender(); return; }
    ui(P).ability = id; ui(P).more = false; rerender(P);
  },
};
export const inputs = {
  // the results follow the typing after a short pause: a redraw inside the browser's own input event loses the caret
  // (Chrome finishes the keystroke on the replaced field), and a pause also saves a search per keystroke
  'mv-text': (t, P) => { const u = ui(P); u.text = t.value.slice(0, 40); u.more = false; clearTimeout(P.mvTimer); P.mvTimer = setTimeout(() => rerender(P), 150); },
};
export { SYNERGY };

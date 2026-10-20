// Mocks (docs/research/ux/mocks.md, lead decisions 2026-10-19): play a friend's next opponent. Anthony pilots coach X's
// team (curated in lib/mocks, else generated) against his friend Y on Showdown: the team with Copy for Showdown, the notes
// to play it cold, key calcs as workbench links, and a running record per (friend, opponent) with a note for the friend.
// Storage: optional `mocks` on the pilot document (additive). Nothing here touches your sets, Teams or matchup prep, and
// the note never contains them.
import { mockFor, mockStaleness, MOCKS } from '../lib/mocks/index.mjs';
import { parseTeamQuick, exportTeam } from '../lib/paste.mjs';
import { setStats, battleForme } from '../lib/calc/mech.mjs';
import { targetsOf, hitResult, autoWeather } from '../lib/prep-build.mjs';
import { scanThreats, typeEffFrom } from '../lib/threat-scan.mjs';
import { worstCaseAttacker } from '../lib/move-search.mjs';
import { GAME_TAGS } from '../lib/prep-schema.mjs';
import * as C from './prep-copy.js';
import { esc, btn, chipBtn, h2, select, itemIcon } from './prep-ui.js';
import * as WB from './prep-workbench.js';
import { theirSide, over, battleOf } from './prep-guide.js';
import { pilot as pastePilot } from './prep-practice.js';
import { generateMock, setsOf } from '../lib/mock-gen.mjs';
import { suggestPlans } from '../lib/prep-plans.mjs';
import { currentVersion } from '../lib/prep-model.mjs';
import { workspacesFor } from '../lib/prep-matchup.mjs';
import { learnset, legalAbilities, toID } from '../lib/calc/mech.mjs';

const M = C.MOCKS;
const ui = (P) => (P.ui.mocks ??= { week: {}, tab: {}, variant: {}, form: null, includeTeam: {} });
const base = (P) => (id) => P.mech?.species[id]?.mega?.from ?? id;
const pairKey = (friend, pilot) => `${friend}|${pilot}`;
/** The running mock record for (friend, pilot coach), or null. */
export const recordOf = (P, friend, pilot) => (P.docs.pilot.mocks ?? []).find((m) => m.friend === friend && m.pilot === pilot) ?? null;
const counts = (games) => [games.filter((g) => g.result === 'W').length, games.filter((g) => g.result === 'L').length];
const me = (P) => P.ownSide();

// ---------- the mock team (curated or generated) ----------
/** The mock for (friend, pilot): { source, mock (curated, validated), variants: [{key, name, sets, note, labels}], stale } or null. */
const parse = (P, text) => { P.mockSets ??= new Map(); if (!P.mockSets.has(text)) P.mockSets.set(text, parseTeamQuick(text, { mech: P.mech, side: 'theirs' }).sets.filter((s) => s.set).map((s) => s.set)); return P.mockSets.get(text); };
/**
 * The mock for (friend, pilot): { source: 'curated'|'generated', mock, variants: [{key, name, sets, note, labels}], stale },
 * null without data, or { pending: true } while the generator runs. Your edits (stored on the running record) replace the
 * team they edited; their labels say so.
 */
export function mockOf(P, friendName, pilotName) {
  if (!P.mech) return null;
  const rec = recordOf(P, friendName, pilotName);
  const found = mockFor(pilotName, friendName, { mech: P.mech });
  let out;
  if (found) {
    const m = found.mock;
    const tuned = new Set(m.departures.map((d) => base(P)(d.mon)));
    const label = (s) => (tuned.has(s.species) ? 'tuned' : 'ladder');
    const variants = [{ key: 'main', name: M.mainName(m.archetype), sets: parse(P, m.team), note: m.pilotNotes.wins }, ...m.variants.map((v) => ({ key: v.key, name: v.name, sets: parse(P, v.team), note: v.note }))]
      .map((v) => ({ ...v, labels: v.sets.map(label) }));
    out = { source: 'curated', mock: m, problems: found.problems, variants, ...mockStaleness(m, P.coachRoster(pilotName), P.coachRoster(friendName), base(P)) };
  } else {
    const g = rec?.variants?.length ? null : generatedFor(P, friendName, pilotName, !!rec?.useMyGuesses);
    if (!rec?.variants?.length && !g) return g === undefined ? null : { pending: true };
    const variants = rec?.variants?.length ? rec.variants.map((v) => ({ key: v.key, name: v.name, sets: parse(P, v.team), note: v.note ?? '', labels: v.labels ?? [] })) : g.variants;
    const mock = { coach: pilotName, vs: friendName, week: rec?.week ?? null, written: null, archetype: rec?.archetype ?? g?.archetype ?? '', assumptions: [M.genAssumption], departures: [],
      pilotNotes: { wins: rec?.wins ?? g?.wins ?? '', leads: rec?.leads ?? g?.leads ?? [], back: [], theyTry: [], ifThen: [] }, calcs: [], outline: [], rosters: rec?.rosters ?? g?.rosters ?? null };
    out = { source: 'generated', mock, problems: [], variants, ...mockStaleness(mock, P.coachRoster(pilotName), P.coachRoster(friendName), base(P)) };
  }
  // your edits on the running record replace the team they edited (curated mocks too)
  if (found && rec?.variants?.length) for (const v of rec.variants) { const i = out.variants.findIndex((x) => x.key === v.key); if (i >= 0) out.variants[i] = { ...out.variants[i], sets: parse(P, v.team), labels: v.labels ?? out.variants[i].labels }; }
  return out;
}
/**
 * The generated mock (lib/mock-gen.mjs) for (friend, pilot), computed once in idle time and cached: { variants, archetype,
 * wins, leads, rosters }, null while it runs, undefined when it can't (engine failed, no roster).
 */
function generatedFor(P, friendName, pilotName, useGuesses) {
  if (P.engineState === 'failed') return undefined;
  if (!P.calc || !P.engine) { P.ensureEngine(); return null; }
  const xPool = P.coachRoster(pilotName), yPool = P.coachRoster(friendName);
  if (!xPool.length || !yPool.length) return undefined;
  const usage = P.app.usage?.() ?? null;
  const guesses = useGuesses ? myGuessesOf(P, pilotName) : null;
  const key = JSON.stringify(['mk-gen', xPool, yPool, usage?.month ?? null, guesses ? [...guesses] : null]);
  P.mockGen ??= new Map();
  if (P.mockGen.has(key)) return P.mockGen.get(key);
  const run = () => {
    let out;
    try {
      const r = generateMock(P.calc, P.mech, { xPool, yPool, usage, typeEff: typeEffFrom(P.engine), dexSpecies: (id) => P.dexSp(id), asOf: P.now().slice(0, 10), guesses });
      const name = { main: M.genMain, mega: M.genMega, alt: M.genAlt };
      const variants = r.variants.map((v) => { const ss = setsOf(v.six); return { key: v.name, name: name[v.name] ?? v.name, sets: ss.map((x) => x.set), labels: ss.map((x) => x.label), note: '' }; });
      if (!variants.length) throw new Error('no legal team');
      const main = variants[0].sets;
      const plans = suggestPlans(P.app.coresCx?.(), P.app.dex, main.map((s) => s.species).filter((id) => P.app.dex.species[id]));
      const roleOf = (s) => (P.dexSp(s.species)?.roles ?? []);
      const lead = [...main].sort((a, b) => (roleOf(b).some((x) => ['fake-out', 'trick-room', 'tailwind', 'intimidate'].includes(x)) ? 1 : 0) - (roleOf(a).some((x) => ['fake-out', 'trick-room', 'tailwind', 'intimidate'].includes(x)) ? 1 : 0)).slice(0, 2).map((s) => s.species);
      out = { variants, archetype: plans.slice(0, 2).map((p) => p.label).join(' · '), wins: plans[0] ? M.genWins(plans[0].label) : '', leads: lead.length === 2 ? [{ ours: lead, t1: '', t2: '', note: M.genLead }] : [], rosters: { x: xPool, y: yPool } };
    } catch (e) { console.error('Mock generator failed:', e && e.message); out = undefined; }
    if (P.mockGen.size > 10) P.mockGen.clear();
    P.mockGen.set(key, out);
  };
  const idle = globalThis.requestIdleCallback;
  if (typeof idle !== 'function') { run(); return P.mockGen.get(key); }
  P.mockJobs ??= new Set();
  if (!P.mockJobs.has(key)) { P.mockJobs.add(key); idle(() => { run(); P.mockJobs.delete(key); P.app.rerender(); }, { timeout: 1500 }); }
  return null;
}
/** Your own saved guesses of that coach's sets (your matchup prep vs them): only when you opt in. */
function myGuessesOf(P, coach) {
  const ws = workspacesFor([...P.ws.values()], P.ownSide(), coach)[0];
  const out = new Map();
  for (const l of ws?.theirSets ?? []) { const d = currentVersion(l).data; if (d.sp !== 'unknown' && (d.moves ?? []).length) out.set(l.speciesId, { ...structuredClone(d), moves: d.moves.filter(Boolean) }); }
  return out.size ? out : null;
}
/** Team warnings for a six: item clause, one Mega, species clause. */
export function teamChecks(P, sets) {
  const items = sets.map((s) => s.item).filter(Boolean);
  const dupItem = items.find((it, i) => items.indexOf(it) !== i) ?? null;
  const megas = sets.filter((s) => P.mech.items[s.item]?.megaStone);
  const nums = sets.map((s) => P.mech.species[s.species]?.num);
  const dupSpecies = nums.some((n, i) => n !== undefined && nums.indexOf(n) !== i);
  return { dupItem, megas: megas.map((s) => battleForme(P.mech, s.species, s.item)?.id ?? s.species), dupSpecies, ok: !dupItem && megas.length <= 1 && !dupSpecies };
}
const speedOf = (P, s) => setStats(P.mech, s, { megaEvolved: true })?.spe ?? 0;

// ---------- screens ----------
export function screen(P, r) {
  P.ensureMech();
  if (r.paste) return pastePilot(P).replace(btn('‹ Prep', 'go-home', {}, { cls: 'back', aria: 'Back to Prep home' }), btn(`‹ ${M.head}`, 'back', {}, { cls: 'back', aria: M.backToMocks }));
  if (r.friend) return one(P, r);
  return home(P);
}

/** Mocks home: the friend, their weeks (who they play), Play. */
function home(P) {
  const u = ui(P);
  const coaches = (P.coaches() ?? []).filter((c) => c.name !== me(P));
  const back = btn('‹ Prep', 'go-home', {}, { cls: 'back', aria: 'Back to Prep home' });
  if (!coaches.length) return `<section class="panel prep-mocks">${back}${h2(M.head)}<p class="small">${esc(M.loading)}</p></section>`;
  // remembered choice; else the friend a curated mock is written for; else your most recent opponent; else the first coach
  const recent = [...(P.docs.meta.workspaces ?? [])].filter((w) => !w.archived && (!w.pov || w.pov === me(P))).sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
  const named = (n) => coaches.find((c) => c.name === n);
  const friend = named(u.friend ?? P.docs.meta.prefs?.mockFriend) ?? MOCKS.map((m) => named(m.vs)).find(Boolean) ?? recent.map((w) => named(w.coach)).find(Boolean) ?? coaches[0];
  const w = P.weeks(friend.name);
  const rows = w.state === 'ok' ? w.rows : [];
  const tile = (x) => {
    if (x.bye) return `<li><span class="wktile bye"><span class="wkchip">W${x.week}</span><span class="wkname">${esc(M.bye)}</span></span></li>`;
    const opp = x.opponent;
    if (!opp || opp === me(P)) return `<li><span class="wktile bye"><span class="wkchip">W${x.week}</span><span class="wkname">${esc(opp ? M.you(opp) : '—')}</span></span></li>`;
    const rec = recordOf(P, friend.name, opp);
    const [wn, ln] = counts(rec?.games ?? []);
    const curated = P.mech && mockFor(opp, friend.name, { mech: P.mech });
    const on = sel?.week === x.week;
    return `<li><button type="button" class="wktile${on ? ' on' : ''}" data-pa="mk-week" data-friend="${esc(friend.name)}" data-week="${x.week}" aria-pressed="${on}"><span class="wkchip">W${x.week}</span><span class="wkname">${esc(opp)}${x === dflt ? ` <span class="small muted">${esc(M.next)}</span>` : ''}</span>
      <span class="small muted">${esc(curated ? M.guideTile : M.generatedTile)}${rec?.games?.length ? ` · ${wn}–${ln}` : ''}</span></button></li>`;
  };
  const playable = rows.filter((x) => !x.bye && x.opponent && x.opponent !== me(P));
  const mine = rows.find((x) => x.opponent === me(P))?.week ?? 0;
  const dflt = playable.find((x) => x.week > mine && !(recordOf(P, friend.name, x.opponent)?.games?.length)) ?? playable[0] ?? null;
  const sel = playable.find((x) => x.week === u.week[friend.name]) ?? dflt;
  const pick = rows.length ? `<ul class="weeks mk-weeks">${rows.map(tile).join('')}</ul>`
    : `<p class="small">${esc(M.noSchedule)}</p><p>${coaches.filter((c) => c.name !== friend.name).map((c) => btn(c.name, 'mk-play', { friend: friend.order, pilot: c.order }, { cls: 'pchip' })).join(' ')}</p>`;
  const opp = sel ? P.coaches().find((c) => c.name === sel.opponent) : null;
  const pasted = P.docs.pilot.teams.length;
  return `<section class="panel prep-mocks">${back}${h2(M.head)}<p class="small">${esc(M.intro)}</p>
    ${select('mk-friend', coaches.map((c) => [c.name, c.name]), friend.name, { label: M.friend, data: { pc: 'mk-friend' } })}
    ${rows.length ? `<p class="small muted">${esc(M.weeksOf(friend.name, w.group))}</p>` : ''}${pick}
    ${opp ? `<p>${btn(M.openAs(opp.name), 'mk-open', { friend: friend.order, pilot: opp.order }, { primary: true, cls: 'mk-playbtn' })}</p>
      <p class="small">${btn(M.recordNote(friend.name), 'mk-play', { friend: friend.order, pilot: opp.order, week: sel.week }, { cls: 'linkish' })}</p>` : ''}
    <p class="small">${pasted ? `${btn(M.pasted(pasted), 'mk-paste', {}, { cls: 'linkish' })} · ` : ''}${btn(M.pasteInstead, 'mk-paste', {}, { cls: 'linkish' })}</p></section>`;
}

/** One mock: Team · Notes · Log. */
function one(P, r) {
  const friend = P.coachBySeat(r.friend), pilot = P.coachBySeat(r.pilot);
  const back = btn(`‹ ${M.head}`, 'back', {}, { cls: 'back', aria: M.backToMocks });
  if (!friend || !pilot || !P.mech) return `<section class="panel prep-mocks">${back}${h2(M.head)}<p class="small">${esc(M.loading)}</p></section>`;
  const mk = mockOf(P, friend.name, pilot.name);
  const key = pairKey(friend.name, pilot.name);
  const u = ui(P);
  const rec = recordOf(P, friend.name, pilot.name);
  const week = mk?.mock?.week ?? P.weeks(friend.name).rows?.find((x) => x.opponent === pilot.name)?.week ?? null;
  const head = `${back}${h2(M.title(pilot.name, friend.name, week))}`;
  if (mk?.pending) return `<section class="panel prep-mocks">${head}<p class="small muted">${esc(M.building(pilot.name))}</p></section>`;
  if (!mk) return `<section class="panel prep-mocks">${head}<p class="banner info">${esc(M.cantBuild(pilot.name))}</p></section>`;
  const tab = u.tab[key] ?? 'team';
  const v = mk.variants.find((x) => x.key === u.variant[key]) ?? mk.variants[0];
  const badge = `<span class="gpill">${esc(mk.source === 'curated' ? M.guideBadge(mk.mock.written) : M.genBadge(pilot.name))}</span>`;
  const stale = mk.stale ? `<p class="banner warn small">${esc(M.stale([...mk.x.added.map((id) => `+ ${P.spName(id)}`), ...mk.x.removed.map((id) => `− ${P.spName(id)}`)].join(', '), [...mk.y.added.map((id) => `+ ${P.spName(id)}`), ...mk.y.removed.map((id) => `− ${P.spName(id)}`)].join(', '), pilot.name, friend.name))}</p>` : '';
  const tabs = `<div class="mk-tabs" role="tablist">${['team', 'notes', 'log'].map((k) => `<button type="button" role="tab" class="pchip${tab === k ? ' on' : ''}" aria-selected="${tab === k}" data-pa="mk-tab" data-key="${esc(key)}" data-tab="${k}">${esc(M.tabs[k])}</button>`).join('')}</div>`;
  const variants = mk.variants.length > 1 ? `<div class="choices" role="group" aria-label="${esc(M.variant)}">${mk.variants.map((x) => chipBtn(x.name, 'mk-variant', { key, v: x.key }, x.key === v.key)).join('')}</div>` : '';
  const body = tab === 'notes' ? notes(P, mk, v, friend, pilot) : tab === 'log' ? log(P, mk, v, friend, pilot, rec) : team(P, mk, v, friend, pilot, rec);
  return `<section class="panel prep-mocks prep-mock" data-key="mock">${head}
    <p class="small muted">${badge} ${esc(mk.mock.archetype)}</p>${mk.mock.assumptions.length ? `<p class="small muted">${esc(mk.mock.assumptions.join(' · '))}</p>` : ''}${stale}
    ${tabs}${variants}${body}
    <div class="mk-bar">${btn(M.copy, 'mk-copy', { friend: r.friend, pilot: r.pilot, v: v.key }, { primary: true })} ${btn(M.logGame, 'mk-tab', { key, tab: 'log', form: 1 })}</div></section>`;
}

// ---------- Team ----------
function team(P, mk, v, friend, pilot, rec) {
  const u = ui(P);
  const ed = u.edit && u.edit.friend === friend.name && u.edit.pilot === pilot.name && u.edit.v === v.key ? u.edit : null;
  const tr = /trick room/i.test(v.name) || (v.key === 'main' && /trick room/i.test(mk.mock.archetype));
  const order = [...v.sets].map((s) => ({ s, spe: speedOf(P, s) })).sort((a, b) => a.spe - b.spe);
  const card = (s, i) => {
    const f = battleForme(P.mech, s.species, s.item);
    const spe = speedOf(P, s);
    const label = M.label[v.labels[i]] ?? M.ladder;
    const dep = mk.mock.departures.find((d) => base(P)(d.mon) === s.species);
    const pos = tr ? order.findIndex((x) => x.s === s) + 1 : 0;
    return `<li class="tm-slot mk-card"><div class="mk-card-in">
      <p class="tm-s-who">${P.pt(s.species, { size: 'md' })}<span><b>${esc(P.spName(f?.id ?? s.species))}</b> <span class="mk-lbl ${v.labels[i]}">${esc(label)}</span><br>
        <span class="small">${itemIcon(s.item)}${esc(P.name('items', s.item) || M.noItem)} · ${esc(P.name('abilities', s.ability))} · ${esc(P.name('natures', s.nature))} ${['hp', 'atk', 'def', 'spa', 'spd', 'spe'].map((k) => s.sp[k] ?? 0).join('/')}</span></span></p>
      <p class="small">${s.moves.map((m) => esc(P.name('moves', m))).join(' · ')}</p>
      <p class="small muted">${esc(M.speed(spe, pos))}</p>${dep ? `<p class="small">${esc(M.departure(dep.what, dep.why))}</p>` : ''}
      <p>${btn(M.edit, 'mk-edit', { friend: friend.order, pilot: pilot.order, v: v.key, i }, { cls: 'linkish', pressed: ed?.i === i })}</p>${ed?.i === i ? editor(P, ed, friend, pilot) : ''}</div></li>`;
  };
  const chk = teamChecks(P, v.sets);
  return `${v.note && v.key !== 'main' ? `<p class="small">${esc(v.note)}</p>` : ''}<ul class="tm-slots mk-team">${v.sets.map(card).join('')}</ul>
    <p class="small ${chk.ok ? 'muted' : 'warnline'}">${esc(M.checks(chk.dupItem ? P.name('items', chk.dupItem) : null, chk.megas.map((id) => P.spName(id)), chk.dupSpecies))}</p>
    <p class="small muted">${esc(M.format)}</p>
    ${mk.source === 'generated' ? `<div class="mk-gen">
      <p class="small"><label><input type="checkbox" data-pc="mk-guesses" data-friend="${esc(friend.name)}" data-pilot="${esc(pilot.name)}"${rec?.useMyGuesses ? ' checked' : ''}> ${esc(M.myGuesses(pilot.name))}</label>
        <br><span class="small muted">${esc(M.myGuessesWarn(friend.name))}</span></p>
      ${u.regenAsk === `${friend.name}|${pilot.name}` ? `<p class="banner warn small">${esc(M.regenAsk(rec?.variants?.reduce((t, x) => t + (x.labels ?? []).filter((l) => l === 'edited').length, 0) ?? 0))} ${btn(M.regen, 'mk-regen', { friend: friend.name, pilot: pilot.name, sure: 1 }, { primary: true })} ${btn(M.keepMine, 'mk-regen-cancel', {}, { cls: 'linkish' })}</p>`
        : `<p>${btn(M.regen, 'mk-regen', { friend: friend.name, pilot: pilot.name })}</p>`}</div>` : ''}`;
}
/** Pilot mode: edit one mock set (nature, item, ability, moves, Stat Points); saved on the mock, never your sets. */
function editor(P, ed, friend, pilot) {
  const s = ed.set;
  const natures = Object.keys(P.mech.natures).sort().map((n) => [n, P.name('natures', n)]);
  const items = [['', M.noItem], ...Object.keys(P.mech.items).filter((i) => !P.mech.items[i].megaStone || P.mech.items[i].megaStone[s.species]).sort().map((i) => [i, P.name('items', i)])];
  const moves = [['', '—'], ...learnset(P.mech, s.species).map((m) => [m, P.name('moves', m)]).sort((a, b) => a[1].localeCompare(b[1]))];
  const total = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'].reduce((t, k) => t + (s.sp[k] ?? 0), 0);
  return `<div class="mk-editor card"><p class="small"><span class="gpill">${esc(M.mockPill)}</span> ${esc(M.editHeader(pilot.name, P.spName(s.species)))}</p>
    ${select('mk-ed-nature', natures, s.nature, { label: M.nature, data: { pc: 'mk-ed', key: 'nature' } })}
    ${select('mk-ed-item', items, s.item ?? '', { label: M.item, data: { pc: 'mk-ed', key: 'item' } })}
    ${select('mk-ed-ability', legalAbilities(P.mech, s.species).map((a) => [a, P.name('abilities', a)]), s.ability, { label: M.ability, data: { pc: 'mk-ed', key: 'ability' } })}
    ${[0, 1, 2, 3].map((j) => select(`mk-ed-move-${j}`, moves, s.moves[j] ?? '', { aria: `Move ${j + 1}`, data: { pc: 'mk-ed', key: `move${j}` } })).join(' ')}
    <p class="mk-sp">${['hp', 'atk', 'def', 'spa', 'spd', 'spe'].map((k) => `<label class="field"><span>${C.STAT_SHORT[k]}</span><input type="number" inputmode="numeric" min="0" max="32" value="${s.sp[k] ?? 0}" data-pc="mk-ed" data-key="sp-${k}"></label>`).join('')}</p>
    <p class="small ${total > 66 ? 'warnline' : 'muted'}">${esc(M.spTotal(total))}</p>
    <p>${btn(M.save, 'mk-ed-save', { friend: friend.order, pilot: pilot.order }, { primary: true, disabled: total > 66 })} ${btn(M.cancel, 'mk-ed-cancel', {}, { cls: 'linkish' })}</p></div>`;
}

// ---------- Notes ----------
const fold = (title, body, open = false) => (body ? `<details class="gd-fold"${open ? ' open' : ''}><summary>${esc(title)}</summary>${body}</details>` : '');
const list = (items, tag = 'ul') => (items.length ? `<${tag} class="gd-list">${items.map((x) => `<li>${x}</li>`).join('')}</${tag}>` : '');
/** "a–b%" numbers as workbench links where a mock calc states that range. */
function linkify(P, mk, friend, pilot, text) {
  return String(text).split(/(\d+(?:\.\d+)?–\d+(?:\.\d+)?%)/).map((x, k) => {
    if (k % 2 === 0) return esc(x);
    const i = mk.mock.calcs.findIndex((c) => c.range === x || c.range.replace(/\.0(?=[–%])/g, '') === x);
    return i >= 0 ? calcLink(friend, pilot, i, x) : `<span class="gd-unchecked" title="${esc(C.GUIDE.unchecked)}">${esc(x)}</span>`;
  }).join('');
}
const calcLink = (friend, pilot, i, label) => `<button type="button" class="linkish gd-calc" data-pa="mk-calc" data-friend="${friend.order}" data-pilot="${pilot.order}" data-i="${i}">${esc(label)} ›</button>`;
function notes(P, mk, v, friend, pilot) {
  const n = mk.mock.pilotNotes;
  const L = (x) => linkify(P, mk, friend, pilot, x);
  const leads = list(n.leads.map((l) => `<b>${l.ours.map((id) => esc(P.spName(id))).join(' + ')}</b>${l.note ? ` <span class="small muted">(${esc(l.note)})</span>` : ''}${l.t1 ? `<br><span class="small">T1 ${L(l.t1)}</span>` : ''}${l.t2 ? `<br><span class="small">T2 ${L(l.t2)}</span>` : ''}`));
  const calcs = list(mk.mock.calcs.map((c, i) => `${calcLink(friend, pilot, i, M.calc(P.spName(c.attacker.id), P.name('moves', c.move), P.spName(c.defender.id), c.range, c.verdict))}${c.why ? ` <span class="small muted">${esc(c.why)}</span>` : ''}`));
  const order = [...v.sets].map((s) => ({ s, spe: speedOf(P, s) })).sort((a, b) => a.spe - b.spe);
  const speed = `<p class="small">${esc(M.speedOrder(order.map((x) => `${P.spName(battleForme(P.mech, x.s.species, x.s.item)?.id ?? x.s.species)} ${x.spe}`).join(' < ')))}</p>`;
  return `${n.wins && v.key === 'main' ? `<h4>${esc(M.n.wins)}</h4><p>${L(n.wins)}</p>` : v.note ? `<h4>${esc(M.n.wins)}</h4><p>${L(v.note)}</p>` : ''}
    ${v.key === 'main' && n.leads.length ? `<h4>${esc(M.n.lead)}</h4>${leads}${n.back.length ? `<p class="small"><b>${esc(M.back)}</b> ${n.back.map((id) => esc(P.spName(id))).join(', ')}</p>` : ''}` : ''}
    ${fold(M.n.theyTry(friend.name), list(n.theyTry.map(L)), true)}
    ${fold(M.n.ifThen, list(n.ifThen.map((x) => `${esc(M.ifThe(x.if))} → <b>${L(x.do)}</b>`)), true)}
    ${fold(M.n.calcs, calcs)}
    ${fold(M.n.watch, watchOut(P, v, friend, pilot))}
    ${fold(M.n.kos, yourKOs(P, v, friend, pilot))}
    ${fold(M.n.speed, speed)}
    ${mk.mock.departures.length ? fold(M.n.departures, list(mk.mock.departures.map((d) => `<b>${esc(P.spName(d.mon))}</b>: ${esc(d.what)}${d.why ? ` · ${L(d.why)}` : ''}`))) : ''}
    ${mk.mock.outline.length ? fold(M.n.outline, list(mk.mock.outline.map((o) => `${esc(o.coach)}${o.week ? ` (W${o.week})` : ''}: ${esc(o.note)}`))) : ''}
    ${fold(M.n.etiquette, list(C.ETIQUETTE.map(esc)))}`;
}
/** Generated (labelled): the worst-case scan of the friend's 10 into this mock team, top 3, as workbench links. */
export function watchOut(P, v, friend, pilot) {
  if (!P.calc || !P.engine) { P.ensureEngine(); return `<p class="small muted">${esc(M.working)}</p>`; }
  const key = JSON.stringify(['mk-watch', friend.name, P.coachRoster(friend.name), v.sets]);
  P.mockCache ??= new Map();
  if (!P.mockCache.has(key)) {
    const pool = P.coachRoster(friend.name).map((species) => ({ species, coach: friend.name }));
    const rows = scanThreats(P.calc, P.mech, pool, v.sets.map((s, i) => ({ key: `mk${i}`, set: s })), { usage: P.app.usage?.() ?? null, typeEff: typeEffFrom(P.engine), fast: true });
    const seen = new Set(), top = [];
    for (const r of rows) { const k = `${r.forme}|${r.move}`; if (r.severity <= 0 || seen.has(k)) continue; seen.add(k); top.push(r); if (top.length === 3) break; }
    if (P.mockCache.size > 20) P.mockCache.clear();
    P.mockCache.set(key, top);
  }
  const top = P.mockCache.get(key);
  return `<p class="small muted"><span class="gpill">${esc(M.generated)}</span> ${esc(M.watchNote)}</p>${list(top.map((r) => {
    const i = Number(r.target.slice(2));
    return `<button type="button" class="linkish gd-calc" data-pa="mk-hit" data-friend="${friend.order}" data-pilot="${pilot.order}" data-v="${esc(v.key)}" data-i="${i}" data-a="${esc(r.species)}" data-forme="${esc(r.forme)}" data-ability="${esc(r.ability)}" data-item="${esc(r.item)}" data-m="${esc(r.move)}" data-weather="${esc(r.field.weather)}">${esc(M.hitLine(P.spName(r.forme), P.name('moves', r.move), P.spName(v.sets[i].species), r.lo, r.hi))} ›</button>`;
  }))}`;
}
/** Generated (labelled): this team's best KOs into the friend's ladder sets, top 3. */
export function yourKOs(P, v, friend, pilot) {
  if (!P.calc) return `<p class="small muted">${esc(M.working)}</p>`;
  const key = JSON.stringify(['mk-kos', friend.name, P.coachRoster(friend.name), v.sets]);
  P.mockCache ??= new Map();
  if (!P.mockCache.has(key)) {
    const usage = P.app.usage?.() ?? null;
    const rows = targetsOf(P.mech, P.coachRoster(friend.name), { usage, dexSpecies: (id) => P.dexSp(id), asOf: P.now().slice(0, 10) });
    const out = [];
    for (const s of v.sets) for (const m of s.moves) {
      const mv = P.mech.moves[m];
      if (!mv || mv.category === 'Status') continue;
      for (const row of rows) {
        const w = autoWeather(P.mech, s, row);
        const r = hitResult(P.calc, P.mech, s, row, m, { field: w.weather ? { weather: w.weather } : {} }).result;
        if (r.class !== 'exact') continue;
        const odds = Number(r.ko.one.num) / Number(r.ko.one.den);
        if (odds > 0) out.push({ s, m, row, odds, lo: Math.floor((1000 * r.range.min) / r.maxHP) / 10, hi: Math.floor((1000 * r.range.max) / r.maxHP) / 10 });
      }
    }
    const seen = new Set();
    P.mockCache.set(key, out.sort((a, b) => b.odds - a.odds || b.lo - a.lo).filter((x) => { const k = x.row.forme; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 3));
  }
  return `<p class="small muted"><span class="gpill">${esc(M.generated)}</span> ${esc(M.kosNote)}</p>${list(P.mockCache.get(key).map((x) => esc(M.koLine(P.spName(x.s.species), P.name('moves', x.m), P.spName(x.row.forme), x.lo, x.hi, x.odds))))}`;
}

// ---------- Log ----------
function log(P, mk, v, friend, pilot, rec) {
  const u = ui(P);
  const games = rec?.games ?? [];
  const byVariant = mk.variants.map((x) => ({ x, g: games.filter((g) => (g.variant ?? 'main') === x.key) })).filter((y) => y.g.length);
  const record = byVariant.length ? `<p><b>${esc(byVariant.map(({ x, g }) => M.recordFor(...counts(g), friend.name, x.name)).join(' · '))}</b></p>` : `<p class="small">${esc(M.noGames)}</p>`;
  const pips = games.length ? `<p class="pips">${games.map((g) => `<span class="pip pip-${g.result}" title="${esc(g.line ?? '')}">${g.result === 'W' ? '✓' : '✕'}</span>`).join('')}</p>` : '';
  const list2 = games.length ? `<ol class="gd-list">${games.map((g) => `<li>${esc(M.gameLine(g, (id) => P.spName(id), mk.variants.find((x) => x.key === g.variant)?.name ?? ''))}${g.know ? `<br><span class="small">${esc(M.knowLabel(friend.name))} ${esc(g.know)}</span>` : ''} ${btn('✕', 'mk-game-del', { friend: friend.name, pilot: pilot.name, game: g.id }, { cls: 'linkish', aria: M.deleteGame })}</li>`).join('')}</ol>` : '';
  const f = u.form;
  const form = f ? gameForm(P, f, v, friend, pilot) : `<p>${btn(M.logGame, 'mk-form', {}, { primary: true })}</p>`;
  const inc = u.includeTeam[pairKey(friend.name, pilot.name)] ?? false;
  return `${record}${pips}${list2}${form}
    <h4>${esc(M.noteFor(friend.name))}</h4>
    <label class="field" for="mk-note"><span class="sr-only">${esc(M.noteFor(friend.name))}</span><textarea id="mk-note" rows="4" data-pi="mk-note" data-friend="${esc(friend.name)}" data-pilot="${esc(pilot.name)}">${esc(rec?.note ?? '')}</textarea></label>
    <p class="small"><label><input type="checkbox" data-pc="mk-include" data-key="${esc(pairKey(friend.name, pilot.name))}"${inc ? ' checked' : ''}> ${esc(M.includeTeam)}</label></p>
    <p>${btn(M.copyNote, 'mk-copy-note', { friend: friend.order, pilot: pilot.order, v: v.key })} ${P.app.share ? btn(M.share, 'mk-share-note', { friend: friend.order, pilot: pilot.order, v: v.key }) : ''}</p>
    <p class="small muted">${esc(M.nothingSent)}</p>`;
}
function gameForm(P, f, v, friend, pilot) {
  const theirs = P.coachRoster(friend.name), ours = v.sets.map((s) => s.species);
  const pick = (id, opts, val, label) => select(id, [['', '—'], ...opts.map((x) => [x, P.spName(x)])], val ?? '', { aria: label, data: { pc: 'mk-form-set', key: id } });
  return `<div class="card mk-form"><p class="choices" role="group" aria-label="${esc(M.result)}">${chipBtn(M.won, 'mk-form-result', { r: 'W' }, f.result === 'W')}${chipBtn(M.lost, 'mk-form-result', { r: 'L' }, f.result === 'L')}</p>
    <p class="small">${esc(M.theyLed(friend.name))} ${pick('tl0', theirs, f.tl0, M.theyLed(friend.name))} ${pick('tl1', theirs, f.tl1, M.theyLed(friend.name))}</p>
    <p class="small">${esc(M.youLed)} ${pick('ol0', ours, f.ol0, M.youLed)} ${pick('ol1', ours, f.ol1, M.youLed)}</p>
    <p class="choices small" role="group" aria-label="${esc(M.why)}"><span class="muted">${esc(M.why)}</span> ${GAME_TAGS.map((t) => chipBtn(C.TAG[t] ?? t, 'mk-form-tag', { tag: t }, (f.tags ?? []).includes(t))).join('')}</p>
    <label class="field" for="mk-line"><span>${esc(M.line)}</span><input id="mk-line" maxlength="200" value="${esc(f.line ?? '')}" data-pi="mk-form-text" data-key="line"></label>
    <label class="field" for="mk-know"><span>${esc(M.knowLabel(friend.name))}</span><input id="mk-know" maxlength="200" value="${esc(f.know ?? '')}" data-pi="mk-form-text" data-key="know"></label>
    <label class="field" for="mk-replay"><span>${esc(M.replay)}</span><input id="mk-replay" maxlength="200" value="${esc(f.replay ?? '')}" data-pi="mk-form-text" data-key="replay"></label>
    <p>${btn(M.saveGame, 'mk-form-save', { friend: friend.order, pilot: pilot.order, v: v.key }, { primary: true, disabled: !f.result })} ${btn(M.cancel, 'mk-form-cancel', {}, { cls: 'linkish' })}</p></div>`;
}

/** The note for the friend: the variant played (its team only when ticked), the record, one line per game, Anthony's note. Never his own prep. */
export function composeNote(P, mk, v, friend, pilot, rec, includeTeam) {
  const games = rec?.games ?? [];
  const [w, l] = counts(games);
  const lines = [M.noteHead(pilot, friend, rec?.week ?? mk.mock.week), M.noteTeam(v.name), M.noteRecord(w, l)];
  games.forEach((g, i) => lines.push(`${M.noteGame(i + 1, g, (id) => P.spName(id))}${g.know ? ` · ${g.know}` : ''}`));
  if (rec?.note) lines.push('', rec.note);
  if (includeTeam) lines.push('', exportTeam(v.sets, P.mech).text.trimEnd());
  return `${lines.join('\n')}\n`;
}

// ---------- workbench seeds ("mock" side) ----------
/** A curated calc → WB.open seed: the "mock" side is the mock team's set (+ the entry's overrides); the other the friend's. */
export function calcSeed(P, mk, c, friend, pilot) {
  const mockAttacks = c.attacker.set === 'mock';
  const side = mockAttacks ? c.attacker : c.defender;
  const b = battleOf(P.mech, side.id);
  const fromTeam = [...mk.variants.flatMap((v) => v.sets)].find((s) => s.species === b.species);
  let mine = fromTeam ? structuredClone(fromTeam) : { species: b.species, item: b.item ?? '', ability: '', nature: 'hardy', moves: [c.move], sp: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 } };
  if (b.item) mine.item = b.item;
  mine = over(mine, side, b.mega);
  if (mockAttacks) mine.moves = [...new Set([c.move, ...(mine.moves ?? [])])].slice(0, 4); // defending, it keeps its own moves
  const row = theirSide(P, { coach: friend.name }, mockAttacks ? c.defender : c.attacker, c.move, !mockAttacks);
  const f = c.field ?? {};
  const screen = f.screens === true ? (P.mech.moves[c.move]?.category === 'Special' ? 'lightScreen' : 'reflect') : null;
  return { setId: null, mine, mineRole: mockAttacks ? 'attacker' : 'defender', move: c.move,
    row: { ...row, set: { ...row.set, moves: !mockAttacks ? [c.move] : (row.set.moves?.length ? row.set.moves : [c.move]) } },
    field: { ...(f.weather ? { weather: f.weather } : {}), ...(f.terrain ? { terrain: f.terrain } : {}), ...(screen ? { defenderSide: { [screen]: true } } : {}) },
    guide: c.range ? { range: c.range, coach: friend.name } : null, pilot: { coach: pilot.name },
    forms: { mine: side.form ?? '', theirs: (mockAttacks ? c.defender : c.attacker).form ?? '' } };
}
const ctxOf = (P, t) => {
  const friend = P.coachBySeat(Number(t.dataset.friend)), pilot = P.coachBySeat(Number(t.dataset.pilot));
  const mk = friend && pilot ? mockOf(P, friend.name, pilot.name) : null;
  return mk ? { friend, pilot, mk, v: mk.variants.find((x) => x.key === t.dataset.v) ?? mk.variants[0] } : null;
};
/** The generated team as stored on the record (Showdown text per variant, labels, notes, rosters), or null. */
export function generatedSnapshot(P, mk) {
  if (mk?.source !== 'generated') return null;
  return { variants: mk.variants.map((v) => ({ key: v.key, name: v.name, team: exportTeam(v.sets, P.mech).text, labels: v.labels })), archetype: mk.mock.archetype, wins: mk.mock.pilotNotes.wins, leads: mk.mock.pilotNotes.leads, rosters: mk.mock.rosters };
}
export const keep = (m, snap) => { if (snap && !m.variants?.length) Object.assign(m, snap); };
/** Mutate (or create) the running record for (friend, pilot). */
export function withRecord(P, friendName, pilotName, week, source, fn) {
  return P.mutate('pilot', (d) => {
    d.mocks ??= [];
    let m = d.mocks.find((x) => x.friend === friendName && x.pilot === pilotName);
    if (!m) { m = { id: P.id('pilot'), friend: friendName, pilot: pilotName, week: week ?? null, source, games: [], note: '', createdAt: P.now(), updatedAt: P.now() }; d.mocks.push(m); }
    fn(m);
    if (week) m.week = week; // the record continues; the week tag follows the latest play
    m.updatedAt = P.now();
  });
}

export const actions = {
  'go-mocks': (t, P) => P.go({ view: 'mocks' }, { push: true }),
  'mk-week': (t, P) => { ui(P).week[t.dataset.friend] = Number(t.dataset.week); P.saveUi(); P.app.rerender(); },
  'mk-play': (t, P) => P.go({ view: 'mocks', friend: Number(t.dataset.friend), pilot: Number(t.dataset.pilot) }, { push: true }),
  'mk-paste': (t, P) => P.go({ view: 'mocks', paste: true }, { push: true }),
  'mk-tab': (t, P) => { const u = ui(P); u.tab[t.dataset.key] = t.dataset.tab; if (t.dataset.form) u.form ??= { tags: [] }; P.saveUi(); P.app.rerender(); },
  'mk-variant': (t, P) => { ui(P).variant[t.dataset.key] = t.dataset.v; P.saveUi(); P.app.rerender(); },
  // Copy for Showdown: the exact export (no header); never anything of yours
  'mk-copy': async (t, P) => {
    const x = ctxOf(P, t); if (!x) return;
    try { await P.app.copyText(exportTeam(x.v.sets, P.mech).text); P.toast(M.copied); } catch { P.toast(M.copyFailed); return; }
    const snap = generatedSnapshot(P, x.mk);
    if (snap && !recordOf(P, x.friend.name, x.pilot.name)?.variants?.length) withRecord(P, x.friend.name, x.pilot.name, null, 'generated', (m) => keep(m, snap));
  },
  'mk-edit': (t, P) => { const x = ctxOf(P, t); const s = x?.v.sets[Number(t.dataset.i)]; if (!s) return; ui(P).edit = { friend: x.friend.name, pilot: x.pilot.name, v: x.v.key, i: Number(t.dataset.i), set: structuredClone({ ...s, moves: [...s.moves] }) }; P.app.rerender(); },
  'mk-ed-cancel': (t, P) => { ui(P).edit = null; P.app.rerender(); },
  'mk-ed-save': (t, P) => {
    const ed = ui(P).edit; const x = ctxOf(P, { dataset: { ...t.dataset, v: ed?.v } });
    if (!ed || !x) return;
    const sets = x.v.sets.map((s, i) => (i === ed.i ? { ...ed.set, moves: ed.set.moves.filter(Boolean) } : s));
    const labels = x.v.labels.map((l, i) => (i === ed.i ? 'edited' : l));
    const snap = generatedSnapshot(P, x.mk);
    if (withRecord(P, x.friend.name, x.pilot.name, null, x.mk.source, (m) => {
      keep(m, snap);
      m.variants ??= [];
      const entry = { key: x.v.key, name: x.v.name, team: exportTeam(sets, P.mech).text, labels };
      const i = m.variants.findIndex((y) => y.key === x.v.key);
      if (i >= 0) m.variants[i] = { ...m.variants[i], ...entry }; else m.variants.push(entry);
    })) { ui(P).edit = null; P.toast(M.editSaved); }
  },
  'mk-regen': (t, P) => {
    const rec = recordOf(P, t.dataset.friend, t.dataset.pilot);
    const edited = (rec?.variants ?? []).some((v) => (v.labels ?? []).includes('edited'));
    if (edited && !t.dataset.sure) { ui(P).regenAsk = `${t.dataset.friend}|${t.dataset.pilot}`; P.app.rerender(); return; }
    ui(P).regenAsk = null; P.mockGen?.clear();
    if (rec) withRecord(P, t.dataset.friend, t.dataset.pilot, null, 'generated', (m) => { delete m.variants; delete m.archetype; delete m.wins; delete m.leads; delete m.rosters; });
    else P.app.rerender();
    P.toast(M.regenerated);
  },
  'mk-regen-cancel': (t, P) => { ui(P).regenAsk = null; P.app.rerender(); },
  'mk-calc': (t, P) => { const x = ctxOf(P, t); const c = x?.mk.mock.calcs[Number(t.dataset.i)]; if (c) WB.open(P, calcSeed(P, x.mk, c, x.friend, x.pilot)); },
  'mk-hit': (t, P) => {
    const x = ctxOf(P, t); const s = x?.v.sets[Number(t.dataset.i)];
    if (!s) return;
    const atk = worstCaseAttacker(P.mech, { species: t.dataset.a, abilities: [{ id: t.dataset.ability, forme: t.dataset.forme, synergy: [t.dataset.m] }] }, t.dataset.m);
    if (t.dataset.forme === t.dataset.a) { atk.set.item = t.dataset.item; atk.set.ability = t.dataset.ability; }
    WB.open(P, { setId: null, mine: structuredClone(s), mineRole: 'defender', move: t.dataset.m, pilot: { coach: x.pilot.name },
      row: { key: `mk|${t.dataset.forme}`, coach: x.friend.name, species: t.dataset.a, forme: t.dataset.forme, mega: t.dataset.forme !== t.dataset.a, set: atk.set, source: 'search' },
      field: t.dataset.weather ? { weather: t.dataset.weather } : {} });
  },
  'mk-form': (t, P) => { ui(P).form = { tags: [] }; P.app.rerender(); },
  'mk-form-cancel': (t, P) => { ui(P).form = null; P.app.rerender(); },
  'mk-form-result': (t, P) => { ui(P).form.result = t.dataset.r; P.app.rerender(); },
  'mk-form-tag': (t, P) => { const f = ui(P).form; f.tags = f.tags.includes(t.dataset.tag) ? f.tags.filter((x) => x !== t.dataset.tag) : [...f.tags, t.dataset.tag]; P.app.rerender(); },
  'mk-form-save': (t, P) => {
    const x = ctxOf(P, t); const f = ui(P).form;
    if (!x || !f?.result) return;
    const game = { id: P.id('game'), date: P.now().slice(0, 10), result: f.result, variant: x.v.key, theirLead: [f.tl0, f.tl1].filter(Boolean), ourLead: [f.ol0, f.ol1].filter(Boolean), tags: f.tags ?? [],
      line: (f.line ?? '').slice(0, 200), know: (f.know ?? '').slice(0, 200), replay: (f.replay ?? '').slice(0, 200) };
    const snap = generatedSnapshot(P, x.mk);
    if (withRecord(P, x.friend.name, x.pilot.name, x.mk.mock.week ?? P.weeks(x.friend.name).rows?.find((w) => w.opponent === x.pilot.name)?.week ?? null, x.mk.source, (m) => { keep(m, snap); m.games.push(game); })) { ui(P).form = null; P.toast(M.saved); }
  },
  'mk-game-del': (t, P) => { withRecord(P, t.dataset.friend, t.dataset.pilot, null, 'curated', (m) => { m.games = m.games.filter((g) => g.id !== t.dataset.game); }); },
  'mk-copy-note': async (t, P) => { const x = ctxOf(P, t); if (!x) return; const rec = recordOf(P, x.friend.name, x.pilot.name); try { await P.app.copyText(composeNote(P, x.mk, x.v, x.friend.name, x.pilot.name, rec, !!ui(P).includeTeam[pairKey(x.friend.name, x.pilot.name)])); P.toast(M.noteCopied); } catch { P.toast(M.copyFailed); } },
  'mk-share-note': async (t, P) => { const x = ctxOf(P, t); if (!x) return; const rec = recordOf(P, x.friend.name, x.pilot.name); try { await P.app.share({ text: composeNote(P, x.mk, x.v, x.friend.name, x.pilot.name, rec, !!ui(P).includeTeam[pairKey(x.friend.name, x.pilot.name)]) }); } catch { /* closed */ } },
};
export const changes = {
  'mk-friend': (t, P) => { ui(P).friend = t.value; P.mutate('meta', (m) => { m.prefs = { ...(m.prefs ?? {}), mockFriend: t.value }; }, { substantive: false }); P.app.rerender(); },
  'mk-form-set': (t, P) => { ui(P).form[t.dataset.key] = t.value; },
  'mk-include': (t, P) => { ui(P).includeTeam[t.dataset.key] = !!t.checked; P.saveUi(); },
  // opt-in: build the generated team from your own saved guesses of their sets (warned: the friend will see them)
  'mk-guesses': (t, P) => { withRecord(P, t.dataset.friend, t.dataset.pilot, null, 'generated', (m) => { m.useMyGuesses = !!t.checked; delete m.variants; delete m.archetype; delete m.wins; delete m.leads; delete m.rosters; }); },
  'mk-ed': (t, P) => {
    const ed = ui(P).edit; if (!ed) return;
    const k = t.dataset.key, v = t.value;
    if (k.startsWith('sp-')) ed.set.sp = { ...ed.set.sp, [k.slice(3)]: Math.max(0, Math.min(32, Math.trunc(Number(v) || 0))) };
    else if (k.startsWith('move')) { const m = [0, 1, 2, 3].map((j) => ed.set.moves[j] ?? ''); m[Number(k.slice(4))] = v; ed.set.moves = m; }
    else ed.set[k] = toID(v);
    P.app.rerender();
  },
};
export const inputs = {
  'mk-form-text': (t, P) => { if (ui(P).form) ui(P).form[t.dataset.key] = t.value.slice(0, 200); },
  'mk-note': (t, P) => { const v = t.value.slice(0, 4000); clearTimeout(P.mkNoteTimer); P.mkNoteTimer = setTimeout(() => withRecord(P, t.dataset.friend, t.dataset.pilot, null, 'curated', (m) => { m.note = v; }), 400); },
};

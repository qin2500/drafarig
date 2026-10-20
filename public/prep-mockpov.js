// Mock POV (lead spec 2026-10-19): a mock opens as the normal matchup workspace from the mocked coach's perspective
// (Jacky vs Calvin = #prep/4v8), with every tool Anthony uses for his own matches. On a mock workspace's screens (a
// workspace with `mock`: its record id on the pilot document), the mock's team stands in for "your sets" and "your teams":
// public/prep.js reads P.docs.mysets / P.docs.teams through povLib, and writes to them through povWrite, which saves into
// the mock's record (edited sets labelled "edited"). Your own library, teams and matchups are never read or written here.
import { parseTeamQuick, exportTeam } from '../lib/paste.mjs';
import { battleForme } from '../lib/calc/mech.mjs';
import { newLineage, currentVersion } from '../lib/prep-model.mjs';
import { newTeam } from '../lib/prep-teams.mjs';
import * as C from './prep-copy.js';
import { esc, btn } from './prep-ui.js';
import { mockOf, recordOf, withRecord, generatedSnapshot, keep, watchOut, yourKOs } from './prep-mocks.js';

const M = C.MOCKS;
const B32 = 'abcdefghijklmnopqrstuvwxyz234567';
/** A stable id (`<prefix>_` + 12 base-32 letters) from text: the same mock set keeps its id across renders and reloads. */
export function idFrom(prefix, text) {
  let a = 0x811c9dc5, b = 0x9747b28c;
  for (let i = 0; i < text.length; i++) { const c = text.charCodeAt(i); a = Math.imul(a ^ c, 16777619) >>> 0; b = Math.imul(b ^ c, 2246822519) >>> 0; }
  let out = '';
  for (let i = 0; i < 12; i++) { const src = i < 6 ? a : b; out += B32[(src >>> ((i % 6) * 5)) & 31]; }
  return `${prefix}_${out}`;
}

/** The mock on screen: { ws, rec, friend, pilot } when the route shows a mock workspace, else null. Cheap (every doc read). */
export function povCtx(P) {
  const r = P.route;
  if (r?.view !== 'ws' || !r.wsId) return null;
  const ws = P.ws.get(r.wsId);
  if (!ws?.mock) return null;
  const rec = (P.docs.pilot?.mocks ?? []).find((m) => m.id === ws.mock);
  return rec ? { ws, rec, friend: ws.coach, pilot: ws.pov } : null;
}

const asSet = (l) => { const d = currentVersion(l).data; return { species: l.speciesId, ...structuredClone(d), moves: (d.moves ?? []).filter(Boolean) }; };
const parse = (P, text) => parseTeamQuick(text, { mech: P.mech, side: 'mine' }).sets.filter((s) => s.set).map((s) => s.set);

/**
 * The mock as a library and teams: { variants: [{key, name, labels, teamId, ids, sets}], mysets, teams }. One team per
 * variant (Sets › Bring switches between them); sets you add in the mock sit in its bench. The brought team's sets come
 * first (screens that take one set per species take those).
 */
export function povLib(P, ctx) {
  const key = JSON.stringify([ctx.rec.id, ctx.rec.updatedAt, ctx.ws.teamId ?? '', !!P.mech, P.app.usage?.()?.month ?? null]);
  if (P.povLibCache?.key === key) return P.povLibCache.lib;
  const mk = P.mech ? mockOf(P, ctx.friend, ctx.pilot) : null;
  const now = ctx.rec.createdAt ?? P.now();
  const variants = mk && !mk.pending ? mk.variants.map((v) => ({ key: v.key, name: v.name, labels: v.labels, sets: v.sets, teamId: idFrom('team', `${ctx.rec.id}|${v.key}`),
    ids: v.sets.map((s, i) => idFrom('set', `${ctx.rec.id}|${v.key}|${i}|${s.species}`)) })) : [];
  const lin = (id, s, name) => newLineage({ id, side: 'mine', speciesId: s.species, name, data: s, now, reason: 'mock' });
  const brought = variants.find((v) => v.teamId === ctx.ws.teamId) ?? variants[0];
  const ordered = brought ? [brought, ...variants.filter((v) => v !== brought)] : [];
  const sets = ordered.flatMap((v) => v.sets.map((s, i) => lin(v.ids[i], s, `${v.name} · ${M.label[v.labels[i]] ?? M.ladder}`)));
  const bench = ctx.rec.bench && P.mech ? parse(P, ctx.rec.bench) : [];
  const benchIds = bench.map((s, i) => idFrom('set', `${ctx.rec.id}|bench|${i}|${s.species}`));
  sets.push(...bench.map((s, i) => lin(benchIds[i], s, M.label.edited)));
  P.mockDrafts ??= new Map();
  const lib = { variants, benchIds,
    mysets: { schemaVersion: 1, rev: 0, sets, drafts: P.mockDrafts.get(ctx.rec.id) ?? {} },
    teams: { schemaVersion: 1, rev: 0, teams: variants.map((v) => newTeam({ id: v.teamId, name: v.name, slots: v.ids, now })), order: variants.map((v) => v.teamId) } };
  P.povLibCache = { key, lib };
  return lib;
}

/** A write to "your" library in a mock: applied to the mock's library, then saved into its record. Teams are fixed. */
export function povWrite(P, ctx, which, fn, { render = true } = {}) {
  if (which === 'teams') { P.toast(M.povTeamFixed); return false; }
  const lib = povLib(P, ctx);
  const before = new Map(lib.mysets.sets.map((l) => [l.id, JSON.stringify(currentVersion(l).data)]));
  const d = structuredClone(lib.mysets);
  const out = fn(d) ?? d;
  // unsaved teambuilder drafts: this tab only, like your own drafts
  P.mockDrafts.set(ctx.rec.id, out.drafts ?? {});
  lib.mysets.drafts = out.drafts ?? {};
  const byId = new Map(out.sets.map((l) => [l.id, l]));
  const now = (l) => JSON.stringify(currentVersion(l).data);
  const changed = [];
  for (const v of lib.variants) {
    const ls = v.ids.map((id) => byId.get(id));
    if (!ls.some((l, i) => !l || now(l) !== before.get(v.ids[i]))) continue;
    const kept = ls.map((l, i) => [l, i]).filter(([l]) => l);
    changed.push({ key: v.key, name: v.name, team: exportTeam(kept.map(([l]) => asSet(l)), P.mech).text, labels: kept.map(([l, i]) => (now(l) !== before.get(v.ids[i]) ? 'edited' : v.labels[i] ?? 'ladder')) });
  }
  const known = new Set(lib.variants.flatMap((v) => v.ids));
  const benchLs = out.sets.filter((l) => !known.has(l.id));
  const benchText = benchLs.length ? exportTeam(benchLs.map(asSet), P.mech).text : '';
  const benchChanged = benchText !== (ctx.rec.bench ?? '');
  if (!changed.length && !benchChanged) { if (render) P.app.rerender(); return true; }
  const ok = withRecord(P, ctx.friend, ctx.pilot, null, ctx.rec.source, (m) => {
    m.variants ??= [];
    for (const c of changed) { const i = m.variants.findIndex((x) => x.key === c.key); if (i >= 0) m.variants[i] = { ...m.variants[i], ...c }; else m.variants.push(c); }
    if (benchText) m.bench = benchText; else delete m.bench;
  });
  // a set new to the mock gets its stable bench id: the 6 that brings it follows
  const remap = new Map(benchLs.map((l, i) => [l.id, idFrom('set', `${ctx.rec.id}|bench|${i}|${l.speciesId}`)]).filter(([a, b]) => a !== b));
  if (ok && remap.size && ctx.ws.my6.some((x) => remap.has(x.setId))) P.mutate(`ws:${ctx.ws.id}`, (w) => { w.my6 = w.my6.map((x) => ({ ...x, setId: remap.get(x.setId) ?? x.setId })); }, { render });
  return ok;
}

/**
 * The mock as a matchup guide (lib/guides shape) for prep-guide.js: undefined outside a mock (your own guides apply),
 * null for any other pair inside one, else { guide, problems, added, removed, ours, title, pill, extra() }.
 */
export function guideFor(P, povName, oppName) {
  const ctx = povCtx(P);
  if (!ctx) return undefined;
  if (povName !== ctx.pilot || oppName !== ctx.friend || !P.mech) return null;
  const lib = povLib(P, ctx);
  if (P.povGuideCache?.lib === lib) return P.povGuideCache.found;
  const mk = mockOf(P, ctx.friend, ctx.pilot);
  if (!mk || mk.pending) return null;
  const m = mk.mock;
  const bv = lib.variants.find((x) => x.teamId === ctx.ws.teamId) ?? lib.variants[0];
  const v = mk.variants.find((x) => x.key === bv?.key) ?? mk.variants[0];
  const megaSet = v.sets.find((s) => P.mech.items[s.item]?.megaStone);
  const side = (x) => ({ ...x, set: x.set === 'mock' ? 'ours' : x.set });
  const guide = {
    version: 1, coach: ctx.friend, pov: P.seatOf(ctx.pilot), opp: P.seatOf(ctx.friend), week: m.week ?? ctx.rec.week ?? null, written: m.written, assumptions: m.assumptions,
    remember: [m.pilotNotes.wins, m.pilotNotes.back.length ? `${M.back} ${m.pilotNotes.back.map((id) => P.spName(id)).join(' · ')}` : ''].filter(Boolean),
    bring: { six: v.sets.map((s) => s.species), mega: megaSet ? { id: battleForme(P.mech, megaSet.species, megaSet.item).id ?? megaSet.species, why: '' } : null, bench: [] },
    sets: null, previews: [],
    leads: m.pilotNotes.leads.map((l) => ({ ours: l.ours, vs: [], t1: l.t1, t2: l.t2, t3: '', ifs: l.note ? [l.note] : [] })),
    tells: m.pilotNotes.ifThen.map((x) => ({ see: x.if, means: '', do: x.do })),
    lose: m.pilotNotes.theyTry.map((x) => ({ how: x, fix: '' })),
    endgame: [], combos: { ours: [], theirs: [] },
    calcs: m.calcs.map((c) => ({ ...c, attacker: side(c.attacker), defender: side(c.defender) })),
    pillText: M.planPill,
    perMon: Object.fromEntries(m.departures.map((d) => [d.mon, { notes: [`${M.departure(d.what, d.why)}`] }])),
  };
  const friend = P.coaches()?.find((c) => c.name === ctx.friend), pilot = P.coaches()?.find((c) => c.name === ctx.pilot);
  const extra = () => {
    const gen = mk.source === 'generated' && friend && pilot;
    const fold = (title, body) => `<details class="gd-fold"><summary>${esc(title)}</summary>${body}</details>`;
    // every mock calc as a workbench link (the guide renderer's guide-calc: your side = the mock set)
    const calcs = guide.calcs.map((c, i) => `<li><button type="button" class="linkish gd-calc" data-pa="guide-calc" data-pov="${guide.pov}" data-opp="${guide.opp}" data-coach="${esc(guide.coach)}" data-i="${i}">${esc(M.calc(P.spName(c.attacker.id), P.name('moves', c.move), P.spName(c.defender.id), c.range, c.verdict))} ›</button></li>`).join('');
    return `${calcs ? fold(M.n.calcs, `<ul class="gd-list">${calcs}</ul>`) : ''}<p class="small">${esc(M.povTeam(v.name))}</p>
      <p>${btn(M.copy, 'mkp-copy', {}, { primary: true })} ${friend && pilot ? btn(M.recordNote(ctx.friend), 'mk-play', { friend: friend.order, pilot: pilot.order }, { cls: 'linkish' }) : ''}</p>
      ${gen ? `${fold(M.n.watch, watchOut(P, v, friend, pilot))}${fold(M.n.kos, yourKOs(P, v, friend, pilot))}` : ''}`;
  };
  const found = { guide, problems: mk.problems ?? [], added: mk.y?.added ?? [], removed: mk.y?.removed ?? [], ours: { added: mk.x?.added ?? [], removed: mk.x?.removed ?? [] },
    title: M.planHead(ctx.pilot) + (guide.week ? ` · W${guide.week}` : ''), extra };
  P.povGuideCache = { lib, found };
  return found;
}

/** The banner on every screen of a mock: who you play, Copy for Showdown, Exit. */
export function banner(P) {
  const ctx = povCtx(P);
  if (!ctx) return '';
  return `<div class="banner info mk-pov" role="status"><p><b>${esc(M.povBanner(ctx.pilot, ctx.friend))}</b></p>
    <p class="small">${esc(M.povHelp(ctx.pilot, ctx.friend))}</p><p>${btn(M.copy, 'mkp-copy', {}, { primary: true })} ${btn(M.exit, 'mkp-exit')}</p></div>`;
}

export const actions = {
  // Mocks home: open the mock as the matchup from the mocked coach's side (its record and workspace are made on this tap)
  'mk-open': (t, P) => {
    const friend = P.coachBySeat(Number(t.dataset.friend)), pilot = P.coachBySeat(Number(t.dataset.pilot));
    const mk = friend && pilot ? mockOf(P, friend.name, pilot.name) : null;
    if (!mk || mk.pending) { P.toast(M.building2); return; }
    const week = mk.mock.week ?? P.weeks(friend.name).rows?.find((w) => w.opponent === pilot.name)?.week ?? null;
    const snap = generatedSnapshot(P, mk);
    if (!withRecord(P, friend.name, pilot.name, week, mk.source, (m) => keep(m, snap))) return;
    const rec = recordOf(P, friend.name, pilot.name);
    const ws = rec && P.ensureMockWorkspace(pilot.name, friend.name, rec.id);
    if (!ws) return;
    const lib = povLib(P, { ws, rec, friend: friend.name, pilot: pilot.name });
    const first = lib.variants[0];
    if (first && !lib.variants.some((v) => v.teamId === ws.teamId)) P.mutate(`ws:${ws.id}`, (d) => { d.teamId = first.teamId; d.my6 = first.ids.map((setId) => ({ setId })); }, { render: false });
    P.ui.mock = { wsId: ws.id };
    P.go({ view: 'ws', pov: pilot.order, opp: friend.order, tab: 'brief' }, { push: true });
  },
  'mkp-exit': (t, P) => { P.ui.mock = null; P.go({ view: 'home' }, { push: true }); },
  'mkp-copy': async (t, P) => {
    const ctx = povCtx(P);
    if (!ctx || !P.mech) return;
    const sets = ctx.ws.my6.map((x) => P.lineage(x.setId)).filter(Boolean).map(asSet);
    try { await P.app.copyText(exportTeam(sets, P.mech).text); P.toast(M.copied); } catch { P.toast(M.copyFailed); }
  },
};

// Teams of your sets, Showdown-style (docs/research/dev/teams-and-workbench-plan.md, lead decisions 2026-10-16). Pure.
// - The `teams` document (drafarig.prep.teams) lists teams; a team lists its sets by id (`slots`). The set lineages stay in
//   My sets (drafarig.prep.mysets), unchanged, so every {setId, v} reference keeps resolving.
// - A set belongs to exactly one team. "Imported sets" (kind 'holding', no 6-limit) holds every set no other team holds.
// - A matchup brings one team: workspace.teamId. Its `my6` is kept as a mirror of that team's slots (so every screen that
//   reads my6 keeps working); the team is the source of truth on load, and an edit of my6 is synced into the team.
// - Migration from per-matchup my6: one team per matchup; a set in several matchups' 6 stays with the first team (by
//   workspace createdAt, then id) and every later team gets an independent copy (same versions, new deterministic id),
//   with that workspace's references remapped to its copy. Deterministic ids make it idempotent and resumable; the
//   remap record makes it undoable.
import { BASE_VERSION, wsKey } from './prep-schema.mjs';

const B32 = 'abcdefghijklmnopqrstuvwxyz234567';
/** A deterministic opaque id <prefix>_<12 base32> from the given parts (FNV-1a 64-bit; same parts, same id, every tab). */
export function detId(prefix, ...parts) {
  let h = 0xcbf29ce484222325n;
  for (const ch of new TextEncoder().encode(parts.join('\u0000'))) { h ^= BigInt(ch); h = (h * 0x100000001b3n) & 0xffffffffffffffffn; }
  let out = '';
  for (let i = 0; i < 12; i++) { out += B32[Number(h & 31n)]; h = (h >> 5n) | ((h & 31n) << 59n); }
  return `${prefix}_${out}`;
}
export const teamIdForWs = (wsId) => detId('team', 'ws', wsId);
export const copyIdFor = (teamId, setId) => detId('set', 'copy', teamId, setId);
export const HOLDING_ID = detId('team', 'holding');
export const TEAM_MAX = 6;

export const emptyTeams = () => ({ schemaVersion: BASE_VERSION, rev: 0, teams: [], order: [] });
export const isOwnedWs = (ws) => typeof ws?.pov === 'string' && !!ws.pov && ws.pov !== ws.coach;
const sortWs = (list) => [...list].sort((a, b) => String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')) || String(a.id).localeCompare(String(b.id)));

/** The team holding a set (any kind), or null. */
export const teamOf = (teams, setId) => (teams?.teams ?? []).find((t) => t.slots.includes(setId)) ?? null;
/** The team a workspace brings, or null. */
export const teamForWs = (teams, ws) => (ws?.teamId ? (teams?.teams ?? []).find((t) => t.id === ws.teamId) ?? null : null);

/** An independent copy of one of your sets: same versions (same v numbers), a new id, and where it came from. */
export function copyLineage(l, id, { now = null } = {}) {
  const c = structuredClone(l);
  return { ...c, id, copiedFrom: { setId: l.id, v: l.currentV }, ...(now ? { updatedAt: now } : {}) };
}

/** Every set reference in a workspace, mapped through `map` (old id -> new id). Unmapped ids are kept. */
export function remapWs(ws, map) {
  if (!map || !Object.keys(map).length) return ws;
  const m = (id) => (typeof id === 'string' && map[id] ? map[id] : id);
  const d = structuredClone(ws);
  d.my6 = (d.my6 ?? []).map((x) => ({ ...x, setId: m(x.setId) }));
  for (const c of d.calcs ?? []) for (const s of ['attacker', 'defender', 'second']) if (c.refs?.[s]?.setId) c.refs[s].setId = m(c.refs[s].setId);
  for (const c of d.cards ?? []) {
    for (const k of ['bring4', 'lead', 'back']) if (Array.isArray(c[k])) c[k] = c[k].map(m);
    if (c.mega) c.mega = m(c.mega);
  }
  for (const ms of d.mockSets ?? []) if (Array.isArray(ms.mySets)) ms.mySets = ms.mySets.map((x) => ({ ...x, setId: m(x.setId) }));
  for (const mt of d.matches ?? []) if (Array.isArray(mt.my6)) mt.my6 = mt.my6.map((x) => ({ ...x, setId: m(x.setId) }));
  for (const r of d.revisions ?? []) for (const c of r.changes ?? []) for (const k of ['setId', 'in', 'out']) if (c[k]) c[k] = m(c[k]);
  return d;
}
const invert = (map) => Object.fromEntries(Object.entries(map ?? {}).map(([a, b]) => [b, a]));

/** A team document entry. */
export const newTeam = ({ id, name, kind = 'team', slots = [], origin = { kind: 'created' }, now }) => ({ id, name, kind, slots: [...slots], origin, createdAt: now, updatedAt: now });

/**
 * Put sets into the holding team ("Imported sets") when no team holds them, and drop slots whose set no longer exists.
 * Pure; returns { teams, changed, dropped:[{teamId, setId}] }.
 */
export function reconcileTeams(teamsDoc, mysets, { now }) {
  const t = structuredClone(teamsDoc ?? emptyTeams());
  const ids = new Set((mysets?.sets ?? []).map((s) => s.id));
  let changed = false;
  const dropped = [];
  for (const team of t.teams) {
    const keep = [];
    for (const s of team.slots) { if (ids.has(s) && !keep.includes(s)) keep.push(s); else { dropped.push({ teamId: team.id, setId: s }); changed = true; } }
    team.slots = keep;
  }
  // a set in two teams (only from an older tab or a file): the first team in order keeps it
  const seen = new Set();
  for (const team of orderOf(t)) { const keep = team.slots.filter((s) => !seen.has(s)); if (keep.length !== team.slots.length) { team.slots = keep; changed = true; } keep.forEach((s) => seen.add(s)); }
  const loose = (mysets?.sets ?? []).map((s) => s.id).filter((id) => !seen.has(id));
  if (loose.length) {
    let h = t.teams.find((x) => x.id === HOLDING_ID);
    if (!h) { h = newTeam({ id: HOLDING_ID, name: 'Imported sets', kind: 'holding', origin: { kind: 'holding' }, now }); t.teams.push(h); }
    h.slots.push(...loose); h.updatedAt = now; changed = true;
  }
  const order = [...t.order.filter((id) => t.teams.some((x) => x.id === id)), ...t.teams.map((x) => x.id).filter((id) => !t.order.includes(id))];
  if (JSON.stringify(order) !== JSON.stringify(t.order)) { t.order = order; changed = true; }
  return { teams: t, changed, dropped };
}
const orderOf = (t) => [...t.teams].sort((a, b) => (a.kind === 'holding') - (b.kind === 'holding') || t.order.indexOf(a.id) - t.order.indexOf(b.id));

/** Workspaces that need a team: owned by a coach, with a 6 chosen, and no team yet. */
export const needsTeam = (ws) => isOwnedWs(ws) && !ws.teamId && (ws.my6 ?? []).length > 0;

/** The teams a matchup brings: its team (`teamId`) and, when its 6 had more than 6 picks, "vs <coach>: alternatives". */
export function teamsOfWs(teams, ws) {
  const all = teams?.teams ?? [];
  const main = ws?.teamId ? all.find((x) => x.id === ws.teamId) ?? null : null;
  const alt = ws?.id ? all.find((x) => x.id === altIdForWs(ws.id)) ?? null : null;
  return { main, alt };
}
export const altIdForWs = (wsId) => detId('team', 'alt', wsId);
const lineageSpecies = (ms, id) => ms.sets.find((s) => s.id === id)?.speciesId ?? null;

/**
 * Migration from per-matchup my6 to teams. docs: { mysets, teams (or null), wss: [workspace] }. Pure, deterministic,
 * idempotent and resumable: run it again on its own output and nothing changes; run it on a half-written result and it
 * completes it the same way. Per matchup (oldest createdAt first): its first 6 picks make "vs <coach>", picks beyond 6
 * make "vs <coach>: alternatives", and shortlisted species with no set become planned (empty) slots while there is room.
 * A set another matchup's team already holds is copied (same versions, deterministic id) and that matchup's references
 * point at its copy. Returns { mysets, teams, wss: Map(id -> ws) (only changed ones), copies:[ids], changed }.
 */
export function migrateTeams({ mysets, teams, wss }, { now }) {
  const ms = structuredClone(mysets ?? { schemaVersion: BASE_VERSION, rev: 0, sets: [] });
  const t = structuredClone(teams ?? emptyTeams());
  t.migration ??= { at: now, remaps: {}, copies: [] };
  const byId = new Map(ms.sets.map((s) => [s.id, s]));
  const out = new Map();
  const copies = [];
  let changed = !teams;
  const ensure = (id, name, origin) => {
    let x = t.teams.find((y) => y.id === id);
    if (!x) { x = newTeam({ id, name, origin, now }); t.teams.push(x); t.order.push(id); }
    return x;
  };
  for (const ws of sortWs(wss)) {
    if (!needsTeam(ws)) continue;
    const mineIds = [teamIdForWs(ws.id), altIdForWs(ws.id)];
    const main = ensure(mineIds[0], `vs ${ws.coach}`, { kind: 'migrated-ws', wsId: ws.id });
    const map = { ...(t.migration.remaps[ws.id] ?? {}) };
    const picks = ws.my6.map((m) => m.setId).filter((id) => byId.has(id)); // a deleted set: nothing to bring
    picks.forEach((setId, i) => {
      const team = i < TEAM_MAX ? main : ensure(mineIds[1], `vs ${ws.coach}: alternatives`, { kind: 'migrated-ws-alt', wsId: ws.id });
      const owner = t.teams.find((x) => x.kind !== 'holding' && x.slots.includes(setId)) ?? null;
      if (!owner || mineIds.includes(owner.id)) {
        if (!owner) team.slots.push(setId);
        for (const h of t.teams) if (h.kind === 'holding') h.slots = h.slots.filter((s) => s !== setId);
        return;
      }
      const cid = copyIdFor(team.id, setId);
      if (!byId.has(cid)) { const c = copyLineage(byId.get(setId), cid); ms.sets.push(c); byId.set(cid, c); copies.push(cid); }
      if (!t.migration.copies.includes(cid)) t.migration.copies.push(cid);
      if (!t.teams.some((x) => x.slots.includes(cid))) team.slots.push(cid);
      map[setId] = cid;
    });
    // shortlisted species with no set among the picks: planned (empty) slots, while the team has room
    const have = new Set(main.slots.map((id) => lineageSpecies(ms, id)));
    const planned = [...new Set([...(main.planned ?? []), ...(ws.shortlist ?? []).filter((sp) => !have.has(sp))])].slice(0, Math.max(0, TEAM_MAX - main.slots.length));
    if (planned.length) main.planned = planned;
    if (Object.keys(map).length) t.migration.remaps[ws.id] = map;
    out.set(ws.id, { ...remapWs(ws, map), teamId: main.id });
    changed = true;
  }
  const r = reconcileTeams(t, ms, { now });
  return { mysets: ms, teams: r.teams, wss: out, copies, changed: changed || r.changed || copies.length > 0 };
}

/** The set ids a matchup's my6 should hold: its team's slots, then its alternatives. */
const sixIds = (main, alt) => [...(main?.slots ?? []), ...(alt?.slots ?? [])];
/**
 * Which side wins when a matchup's my6 and its teams differ on load: 'equal' (nothing to do), 'adopt' (the workspace was
 * saved after the teams, so an older tab edited its 6: take that edit into the teams with syncSix), or 'mirror' (write the
 * teams' slots into my6). my6 is kept as this mirror so older builds and a rollback still read the matchup's picks.
 */
export function reconcileSix(ws, main, alt = null) {
  const ids = (ws.my6 ?? []).map((m) => m.setId);
  if (JSON.stringify(ids) === JSON.stringify(sixIds(main, alt))) return 'equal';
  const newest = [main?.updatedAt, alt?.updatedAt].map((x) => String(x ?? '')).sort().at(-1);
  return String(ws.updatedAt ?? '') > newest ? 'adopt' : 'mirror';
}
/** The teams' slots written into a workspace's my6 (the mirror), keeping any {v} on entries that stay. */
export function mirrorSix(ws, main, alt = null) {
  const had = new Map((ws.my6 ?? []).map((m) => [m.setId, m]));
  const my6 = sixIds(main, alt).map((id) => had.get(id) ?? { setId: id });
  return JSON.stringify(my6) === JSON.stringify(ws.my6 ?? []) ? null : { ...ws, my6 };
}

/**
 * An edit of a workspace's my6, synced into its teams: the first 6 into its team, any beyond into its alternatives. A set
 * held by another (non-holding) team is never shared: it gets an independent copy and the workspace's my6 points at the
 * copy. A set from "Imported sets" moves; a set taken out of the 6 goes back there. newId(): a fresh set id.
 * Returns { teams, mysets, ws } (each the input when unchanged).
 */
export function syncSix({ teams, mysets, ws }, { now, newId }) {
  if (!ws.teamId) return { teams, mysets, ws };
  const t = structuredClone(teams);
  const ensure = (id, name, kind) => { let x = t.teams.find((y) => y.id === id); if (!x) { x = newTeam({ id, name, origin: { kind }, now }); t.teams.push(x); t.order.push(id); } return x; };
  const main = ensure(ws.teamId, `vs ${ws.coach}`, 'created');
  const mine = [ws.teamId, altIdForWs(ws.id)];
  let ms = mysets, w = ws;
  const ids = [];
  for (const { setId } of ws.my6 ?? []) {
    const owner = t.teams.find((x) => x.kind !== 'holding' && !mine.includes(x.id) && x.slots.includes(setId));
    if (!owner) { ids.push(setId); continue; }
    const src = ms.sets.find((s) => s.id === setId);
    if (!src) continue;
    const cid = newId();
    ms = { ...ms, sets: [...ms.sets, copyLineage(src, cid, { now })] };
    w = { ...w, my6: w.my6.map((m) => (m.setId === setId ? { setId: cid } : m)) };
    ids.push(cid);
  }
  const head = ids.slice(0, TEAM_MAX), rest = ids.slice(TEAM_MAX);
  const before = JSON.stringify(t);
  for (const x of t.teams) if (!mine.includes(x.id)) x.slots = x.slots.filter((s) => !ids.includes(s));
  if (JSON.stringify(main.slots) !== JSON.stringify(head)) { main.slots = head; main.updatedAt = now; }
  const alt = t.teams.find((x) => x.id === mine[1]);
  if (rest.length || alt) { const a = alt ?? ensure(mine[1], `vs ${ws.coach}: alternatives`, 'created'); if (JSON.stringify(a.slots) !== JSON.stringify(rest)) { a.slots = rest; a.updatedAt = now; } }
  const have = new Set(head.map((id) => lineageSpecies(ms, id)));
  if (main.planned?.length) main.planned = main.planned.filter((sp) => !have.has(sp)).slice(0, Math.max(0, TEAM_MAX - head.length));
  if (JSON.stringify(t) === before && ms === mysets && w === ws) return { teams, mysets, ws };
  return { teams: reconcileTeams(t, ms, { now }).teams, mysets: ms, ws: w };
}

/**
 * Undo the teams setup: every migrated workspace's references go back to the original sets, every workspace loses its
 * teamId, the migration's copies leave My sets, and the teams document goes. Returns { mysets, wss: Map, removeTeams: true,
 * lost: { teamsCreatedLater, copyVersionsAdded } } so the screen can say what would be lost first.
 */
export function undoTeams({ mysets, teams, wss }) {
  const rec = teams?.migration ?? { remaps: {}, copies: [] };
  const out = new Map();
  for (const ws of wss) {
    if (!ws.teamId && !rec.remaps[ws.id]) continue;
    const { teamId, ...rest } = remapWs(ws, invert(rec.remaps[ws.id]));
    out.set(ws.id, rest);
  }
  const copies = new Set(rec.copies);
  const later = (teams?.teams ?? []).filter((x) => x.kind !== 'holding' && x.origin?.kind !== 'migrated-ws').length;
  // versions saved on a migration copy after it was made (they go with the copy)
  const added = (mysets?.sets ?? []).filter((s) => copies.has(s.id)).reduce((n, s) => n + s.versions.filter((v) => v.v > (s.copiedFrom?.v ?? Infinity)).length, 0);
  return { mysets: { ...mysets, sets: (mysets?.sets ?? []).filter((s) => !copies.has(s.id)) }, wss: out, removeTeams: true, lost: { teamsCreatedLater: later, copyVersionsAdded: added } };
}

export const PREMIGRATION_KEY = 'drafarig.prep.backup.teams-v4';
export { wsKey };

// Teams (lib/prep-teams.mjs): the teams document, the migration from per-matchup my6 (lossless, deterministic,
// idempotent, resumable, undoable), the my6 → team sync, and the schema version that keeps older apps read-only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newLineage, addVersion } from '../lib/prep-model.mjs';
import { newWorkspace, validate, docVersion, SCHEMA_VERSION, KEYS, typeOfKey, ID_RE } from '../lib/prep-schema.mjs';
import * as TM from '../lib/prep-teams.mjs';

const NOW = '2026-10-16T09:00:00.000Z';
const data = (spa) => ({ item: '', ability: 'levitate', nature: 'modest', moves: ['thunderbolt'], sp: { hp: 0, atk: 0, def: 0, spa, spd: 0, spe: 0 } });
const lin = (id, sp, versions = 1) => { let l = newLineage({ id, side: 'mine', speciesId: sp, name: id.slice(4, 8), data: data(1), now: '2026-10-01T00:00:00.000Z' }); for (let v = 2; v <= versions; v++) l = addVersion(l, data(v), { now: `2026-10-0${v}T00:00:00.000Z` }); return l; };
const A = 'set_aaaaaaaaaaaa', B = 'set_bbbbbbbbbbbb', C = 'set_cccccccccccc', D = 'set_dddddddddddd';
const W1 = 'ws_wwwwwwwwwww1'.replace('1', 'a'), W2 = 'ws_wwwwwwwwwwwb';
function ws(id, coach, created, my6, extra = {}) {
  return { ...newWorkspace({ id, coach, roster: { fetchedAt: NOW, speciesIds: [], points: {} }, now: created, pov: 'Anthony' }), my6: my6.map((setId) => ({ setId })), ...extra };
}
/** Two matchups sharing set B, with every kind of reference to it in the second. */
function fixture() {
  const mysets = { schemaVersion: 1, rev: 3, sets: [lin(A, 'rotomfan'), lin(B, 'charizard', 3), lin(C, 'pelipper'), lin(D, 'sinistcha')] };
  const w1 = ws(W1, 'Calvin', '2026-10-02T00:00:00.000Z', [A, B], { calcs: [{ id: 'calc_aaaaaaaaaaaa', refs: { attacker: { setId: B, v: 1, side: 'mine' }, defender: { setId: null, side: 'theirs' } }, scenario: {} }] });
  const w2 = ws(W2, 'Ning', '2026-10-05T00:00:00.000Z', [B, C], {
    calcs: [{ id: 'calc_bbbbbbbbbbbb', refs: { attacker: { setId: B, v: 2, side: 'mine' }, defender: { setId: C, v: 1, side: 'mine' } }, scenario: {} }],
    cards: [{ id: 'card_aaaaaaaaaaaa', kind: 'plan', bring4: [B, C], lead: [B], back: [C], mega: B }],
    mockSets: [{ id: 'mock_aaaaaaaaaaaa', mySets: [{ setId: B, v: 3 }], games: [] }],
    matches: [{ id: 'match_aaaaaaaaaaaa', my6: [{ setId: B, v: 2 }, { setId: C, v: 1 }], games: [] }],
    revisions: [{ id: 'rvn_aaaaaaaaaaaa', changes: [{ kind: 'set', setId: B, fromV: 2, toV: 3 }, { kind: 'six', out: C, in: B }] }],
  });
  return { mysets, teams: null, wss: [w2, w1] }; // deliberately out of order: the migration orders by createdAt
}
/** Every set reference in a workspace with the version data it resolves to (null = a set that doesn't exist). */
function resolved(ws, mysets) {
  const find = (id, v) => { const l = mysets.sets.find((s) => s.id === id); if (!l) return null; const ver = v ? l.versions.find((x) => x.v === v) : l.versions.find((x) => x.v === l.currentV); return JSON.stringify(ver?.data ?? null); };
  const out = [];
  for (const m of ws.my6) out.push(['my6', find(m.setId, m.v)]);
  for (const c of ws.calcs) for (const s of ['attacker', 'defender']) if (c.refs[s]?.setId) out.push([`calc.${s}`, find(c.refs[s].setId, c.refs[s].v)]);
  for (const c of ws.cards) for (const k of ['bring4', 'lead', 'back']) for (const id of c[k] ?? []) out.push([`card.${k}`, find(id)]);
  for (const c of ws.cards) if (c.mega) out.push(['card.mega', find(c.mega)]);
  for (const m of ws.mockSets) for (const x of m.mySets) out.push(['mock', find(x.setId, x.v)]);
  for (const m of ws.matches) for (const x of m.my6) out.push(['match', find(x.setId, x.v)]);
  for (const r of ws.revisions) for (const c of r.changes) { if (c.setId) out.push(['rev.from', find(c.setId, c.fromV)], ['rev.to', find(c.setId, c.toV)]); for (const k of ['in', 'out']) if (c[k]) out.push([`rev.${k}`, find(c[k])]); }
  return out;
}
const run = (f) => TM.migrateTeams(f, { now: NOW });
const apply = (f, r) => ({ mysets: r.mysets, teams: r.teams, wss: f.wss.map((w) => r.wss.get(w.id) ?? w) });

test('ids are deterministic and valid: same inputs, same ids, in any tab', () => {
  assert.equal(TM.teamIdForWs(W1), TM.teamIdForWs(W1));
  assert.notEqual(TM.teamIdForWs(W1), TM.teamIdForWs(W2));
  for (const id of [TM.teamIdForWs(W1), TM.copyIdFor(TM.teamIdForWs(W2), B), TM.HOLDING_ID]) assert.match(id, ID_RE);
  assert.ok(TM.copyIdFor(TM.teamIdForWs(W2), B).startsWith('set_'));
});

test('migration: one team per matchup, the first keeps the original, later ones get an independent copy; Imported sets holds the rest', () => {
  const f = fixture();
  const r = run(f);
  const t1 = TM.teamIdForWs(W1), t2 = TM.teamIdForWs(W2), copyB = TM.copyIdFor(t2, B);
  const team = (id) => r.teams.teams.find((x) => x.id === id);
  assert.deepEqual(team(t1).slots, [A, B], 'Calvin (created first) keeps A and the original B');
  assert.deepEqual(team(t2).slots, [copyB, C], 'Ning gets its own copy of B');
  assert.deepEqual(team(TM.HOLDING_ID).slots, [D], 'D was in no 6');
  assert.equal(team(TM.HOLDING_ID).kind, 'holding');
  assert.deepEqual([r.wss.get(W1).teamId, r.wss.get(W2).teamId], [t1, t2]);
  const copy = r.mysets.sets.find((s) => s.id === copyB), orig = f.mysets.sets.find((s) => s.id === B);
  assert.deepEqual(copy.versions, orig.versions, 'identical version history (same v numbers)');
  assert.deepEqual([copy.currentV, copy.copiedFrom], [orig.currentV, { setId: B, v: 3 }]);
  // every set is in exactly one team
  const all = r.teams.teams.flatMap((t) => t.slots);
  assert.equal(new Set(all).size, all.length);
  assert.deepEqual(new Set(all), new Set(r.mysets.sets.map((s) => s.id)));
  assert.equal(validate('teams', { ...r.teams, schemaVersion: 1, rev: 0 }).length, 0);
  for (const w of r.wss.values()) assert.deepEqual(validate('ws', { ...w, schemaVersion: docVersion('ws', w) }).filter((e) => !e.startsWith('calcs[')), [], 'valid (the fixture calcs have no scenario)');
  assert.equal(docVersion('ws', r.wss.get(W2)), 2, 'no new document version: older apps keep working (see reconcileSix)');
  assert.equal(SCHEMA_VERSION, 3);
  assert.equal(typeOfKey(KEYS.teams), 'teams');
});

test('migration is lossless: every reference in every matchup resolves to byte-identical set data before and after', () => {
  const f = fixture();
  const r = run(f);
  for (const w of f.wss) {
    const after = r.wss.get(w.id);
    assert.deepEqual(resolved(after, r.mysets), resolved(w, f.mysets), w.id);
    assert.ok(resolved(w, f.mysets).every(([, d]) => d !== null), 'the fixture references only sets that exist');
  }
  // the second matchup now points only at its own copy of B
  const ids = JSON.stringify(r.wss.get(W2));
  assert.ok(!ids.includes(B) && ids.includes(TM.copyIdFor(TM.teamIdForWs(W2), B)));
  // My sets: the originals untouched; only copies added
  for (const s of f.mysets.sets) assert.deepEqual(r.mysets.sets.find((x) => x.id === s.id), s);
  // apart from the remapped ids and teamId, the workspaces are unchanged
  const strip = (w) => JSON.parse(JSON.stringify(w).split(TM.copyIdFor(TM.teamIdForWs(W2), B)).join(B));
  for (const w of f.wss) { const { teamId, ...rest } = strip(r.wss.get(w.id)); assert.deepEqual(rest, w); }
});

test('migration is idempotent and resumable: again on its output changes nothing; a half-written result completes the same way', () => {
  const f = fixture();
  const r1 = run(f);
  const done = apply(f, r1);
  const r2 = run(done);
  assert.equal(r2.changed, false);
  assert.equal(r2.wss.size, 0);
  assert.deepEqual(r2.mysets, r1.mysets);
  assert.deepEqual(r2.teams, r1.teams);
  // interrupted after My sets and teams were written, before either workspace was
  const half = run({ mysets: r1.mysets, teams: r1.teams, wss: f.wss });
  const finished = apply({ ...f }, half);
  assert.deepEqual(finished.mysets, r1.mysets, 'no second copy');
  assert.deepEqual(finished.teams, r1.teams);
  for (const w of f.wss) assert.deepEqual(finished.wss.find((x) => x.id === w.id), r1.wss.get(w.id));
  // interrupted after the first workspace only
  const part = run({ mysets: r1.mysets, teams: r1.teams, wss: [r1.wss.get(W1), f.wss.find((w) => w.id === W2)] });
  assert.deepEqual(part.wss.get(W2), r1.wss.get(W2));
});

test('migration skips what it must not touch: unassigned matchups, empty 6s, deleted sets; a two-tab race gives the same result', () => {
  const f = fixture();
  const legacy = { ...ws('ws_llllllllllll', 'Taro', '2026-10-01T00:00:00.000Z', [C]), pov: undefined };
  delete legacy.pov;
  const empty = ws('ws_eeeeeeeeeeee', 'Data', '2026-10-01T00:00:00.000Z', []);
  const gone = ws('ws_gggggggggggg', 'Hex', '2026-10-09T00:00:00.000Z', ['set_zzzzzzzzzzzz', A]);
  const r = run({ ...f, wss: [...f.wss, legacy, empty, gone] });
  assert.ok(!r.wss.has('ws_llllllllllll') && !r.wss.has('ws_eeeeeeeeeeee'), 'no team for an unassigned matchup or an empty 6');
  const tg = r.teams.teams.find((t) => t.id === TM.teamIdForWs('ws_gggggggggggg'));
  assert.deepEqual(tg.slots, [TM.copyIdFor(tg.id, A)], 'a deleted set is dropped; A is Calvin\'s, so Hex gets a copy');
  assert.deepEqual(run({ ...f, wss: [...f.wss].reverse() }).teams, run(f).teams, 'input order doesn\'t matter');
});

test('migration extras: picks beyond 6 make "vs <coach>: alternatives"; shortlisted species with no set become planned slots', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((c) => `set_${c.repeat(12)}`);
  const mysets = { schemaVersion: 1, rev: 0, sets: ids.map((id, i) => lin(id, `mon${i}`)) };
  const w = ws('ws_xxxxxxxxxxxx', 'ZhuZi', '2026-10-02T00:00:00.000Z', ids, { shortlist: ['mon0', 'rotomfan'] });
  const r = run({ mysets, teams: null, wss: [w] });
  const main = r.teams.teams.find((t) => t.id === TM.teamIdForWs(w.id)), alt = r.teams.teams.find((t) => t.id === TM.altIdForWs(w.id));
  assert.deepEqual(main.slots, ids.slice(0, 6));
  assert.deepEqual([alt.name, alt.slots], ['vs ZhuZi: alternatives', ids.slice(6)]);
  assert.equal(main.planned, undefined, 'a full team has no room for planned slots');
  assert.equal(TM.mirrorSix(r.wss.get(w.id), main, alt), null, 'my6 still lists all 8 (the mirror covers both teams)');
  const small = ws('ws_yyyyyyyyyyyy', 'Taro', '2026-10-02T00:00:00.000Z', [ids[0]], { shortlist: ['mon0', 'rotomfan', 'pelipper'] });
  const r2 = run({ mysets, teams: null, wss: [small] });
  assert.deepEqual(r2.teams.teams.find((t) => t.id === TM.teamIdForWs(small.id)).planned, ['rotomfan', 'pelipper'], 'Rotom-Fan and Pelipper: no set yet');
  assert.equal(run({ mysets: r2.mysets, teams: r2.teams, wss: [r2.wss.get(small.id)] }).changed, false, 'idempotent');
});

test('undo: references go back to the originals, the migration copies and the teams document go, nothing else changes', () => {
  const f = fixture();
  const r = run(f);
  const done = apply(f, r);
  const u = TM.undoTeams(done);
  assert.equal(u.removeTeams, true);
  assert.deepEqual(u.mysets, f.mysets);
  for (const w of f.wss) assert.deepEqual(u.wss.get(w.id), w);
  assert.deepEqual(u.lost, { teamsCreatedLater: 0, copyVersionsAdded: 0 });
  // a version saved on a copy after the migration is reported before undoing
  const ms = { ...done.mysets, sets: done.mysets.sets.map((s) => (s.id === TM.copyIdFor(TM.teamIdForWs(W2), B) ? addVersion(s, data(9), { now: NOW }) : s)) };
  assert.equal(TM.undoTeams({ ...done, mysets: ms }).lost.copyVersionsAdded, 1);
});

test('reconcile: a set no team holds joins Imported sets; a slot whose set is gone is dropped and reported; a set in two teams stays with the first', () => {
  const f = fixture();
  const done = apply(f, run(f));
  const extra = lin('set_eeeeeeeeeeee', 'kangaskhan');
  const ms = { ...done.mysets, sets: [...done.mysets.sets.filter((s) => s.id !== C), extra] };
  const t = structuredClone(done.teams);
  t.teams.find((x) => x.id === TM.teamIdForWs(W2)).slots.push(A); // A also in Ning's team (an older tab or a file)
  const r = TM.reconcileTeams(t, ms, { now: NOW });
  assert.ok(r.changed);
  assert.deepEqual(r.dropped, [{ teamId: TM.teamIdForWs(W2), setId: C }]);
  assert.ok(r.teams.teams.find((x) => x.id === TM.HOLDING_ID).slots.includes('set_eeeeeeeeeeee'));
  assert.ok(!r.teams.teams.find((x) => x.id === TM.teamIdForWs(W2)).slots.includes(A), 'A stays with Calvin\'s team (first in order)');
  assert.equal(TM.reconcileTeams(r.teams, ms, { now: NOW }).changed, false, 'idempotent');
});

test('an edit of a matchup\'s 6 syncs into its team: a set from another team becomes an independent copy; one from Imported sets moves', () => {
  const f = fixture();
  const done = apply(f, run(f));
  const w2 = done.wss.find((w) => w.id === W2);
  let n = 0;
  const newId = () => `set_new${'abcdefghi'[n++]}aaaaaaa`.slice(0, 16);
  // add A (Calvin's) and D (Imported) to Ning's 6
  const edited = { ...w2, my6: [...w2.my6, { setId: A }, { setId: D }] };
  const r = TM.syncSix({ teams: done.teams, mysets: done.mysets, ws: edited }, { now: NOW, newId });
  const team = r.teams.teams.find((x) => x.id === TM.teamIdForWs(W2));
  const copyA = r.ws.my6.find((m) => m.setId !== A && !w2.my6.some((x) => x.setId === m.setId) && m.setId !== D).setId;
  assert.ok(team.slots.includes(copyA) && !team.slots.includes(A), 'A is copied, never shared');
  assert.ok(team.slots.includes(D) && !r.teams.teams.find((x) => x.id === TM.HOLDING_ID).slots.includes(D), 'D moves out of Imported sets');
  assert.deepEqual(r.mysets.sets.find((s) => s.id === copyA).versions, done.mysets.sets.find((s) => s.id === A).versions);
  assert.ok(r.teams.teams.find((x) => x.id === TM.teamIdForWs(W1)).slots.includes(A), "Calvin's team keeps its A");
  const all = r.teams.teams.flatMap((t) => t.slots);
  assert.equal(new Set(all).size, all.length, 'every set still in exactly one team');
  // removing one from the 6: it leaves the team and goes to Imported sets (never deleted)
  const r2 = TM.syncSix({ teams: r.teams, mysets: r.mysets, ws: { ...r.ws, my6: r.ws.my6.filter((m) => m.setId !== C) } }, { now: NOW, newId });
  assert.ok(r2.teams.teams.find((x) => x.id === TM.HOLDING_ID).slots.includes(C));
  // the mirror: the team's slots written back into my6, keeping {v}
  assert.equal(TM.mirrorSix({ my6: [{ setId: B, v: 2 }] }, { slots: [B] }), null);
  // which side wins on load when they differ: the later save (an older tab's edit of my6 is adopted, not lost)
  assert.equal(TM.reconcileSix({ my6: [{ setId: B }], updatedAt: '2026-10-17' }, { slots: [B], updatedAt: '2026-10-16' }), 'equal');
  assert.equal(TM.reconcileSix({ my6: [{ setId: C }], updatedAt: '2026-10-17' }, { slots: [B], updatedAt: '2026-10-16' }), 'adopt');
  assert.equal(TM.reconcileSix({ my6: [{ setId: C }], updatedAt: '2026-10-15' }, { slots: [B], updatedAt: '2026-10-16' }), 'mirror');
  assert.deepEqual(TM.mirrorSix({ my6: [{ setId: B, v: 2 }] }, { slots: [B, C] }).my6, [{ setId: B, v: 2 }, { setId: C }]);
});

test('backups: one opponent\'s file carries the team(s) it brings and their sets; importing adds teams that aren\'t here', async () => {
  const { opponentDocs, planRestore } = await import('../lib/prep-backup.mjs');
  const f = fixture();
  const r = run(f);
  const done = apply(f, r);
  const w2 = done.wss.find((w) => w.id === W2);
  const docs = opponentDocs(w2, done.mysets, done.teams);
  assert.deepEqual(docs[KEYS.teams].teams.map((t) => t.id), [TM.teamIdForWs(W2)]);
  assert.deepEqual(new Set(docs[KEYS.mysets].sets.map((s) => s.id)), new Set([TM.copyIdFor(TM.teamIdForWs(W2), B), C]));
  const here = { [KEYS.teams]: { schemaVersion: 1, rev: 4, teams: [done.teams.teams.find((t) => t.id === TM.teamIdForWs(W1))], order: [TM.teamIdForWs(W1)] } };
  const plan = planRestore(here, { docs }, 'import', { choices: { [W2]: 'add' }, newSetId: () => 'set_zzzzzzzzzzzz', now: NOW });
  assert.deepEqual(plan.writes[KEYS.teams].teams.map((t) => t.id), [TM.teamIdForWs(W1), TM.teamIdForWs(W2)]);
  assert.ok(plan.notes.some((n) => n.kind === 'team-added'));
});

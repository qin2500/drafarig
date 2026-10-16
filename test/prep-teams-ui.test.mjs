// The Teams screens (public/prep-teams.js) on the stub DOM: list, builder, add / move / copy / remove / delete with Undo,
// Bring on a matchup, the new-matchup default, the My sets redirect, export and import, and team warnings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootApp, parseHtml, findAll, memoryStorage, RAW } from './ui-harness.mjs';
import { device, WS, SET_MINE, NOW, T, btns, flushSaves } from './prep-helpers.mjs';
import { KEYS, wsKey } from '../lib/prep-schema.mjs';
import { parseTeam, setKey } from '../lib/paste.mjs';
import { mech } from './calc-helpers.mjs';
import { newLineage } from '../lib/prep-model.mjs';
import * as TM from '../lib/prep-teams.mjs';

const get = (s, k) => JSON.parse(s.getItem(k) ?? 'null');
const SET_PELI = 'set_pppppppppppp', SET_X = 'set_xxxxxxxxxxxx';
const peli = () => newLineage({ id: SET_PELI, side: 'mine', speciesId: 'pelipper', name: 'Rain', now: NOW, data: { item: 'focussash', ability: 'drizzle', nature: 'modest', moves: ['hurricane', 'protect'], sp: { hp: 32, atk: 0, def: 0, spa: 32, spd: 2, spe: 0 } } });
const kanga = () => newLineage({ id: SET_X, side: 'mine', speciesId: 'kangaskhan', name: 'Mega', now: NOW, data: { item: 'kangaskhanite', ability: 'scrappy', nature: 'jolly', moves: ['fakeout'], sp: { hp: 32, atk: 32, def: 0, spa: 0, spd: 0, spe: 2 } } });
async function ready(mode, storage) {
  const app = await bootApp({ mode, storage });
  await app.waitFor(() => storage.getItem(KEYS.teams) !== null, 'teams set up', 20000);
  await flushSaves(app);
  return app;
}
const team = (s, id) => get(s, KEYS.teams).teams.find((x) => x.id === id);
const tN = TM.teamIdForWs(WS);

test('a fresh device (no sets, no matchups): the Teams list is ready at once, writes nothing until New team, and needs no backup', async (t) => {
  const storage = memoryStorage();
  const app = await bootApp({ mode: 'prep/teams', storage });
  t.after(() => app.restore());
  await app.waitFor(() => /New team/.test(T(app)), 'the empty Teams list', 20000);
  assert.ok(!/Setting up/.test(T(app)));
  assert.ok(btns(app, 'team-import-toggle').length === 1);
  await flushSaves(app);
  assert.equal(storage.getItem(KEYS.teams), null, 'looking writes nothing');
  // after visiting a matchup too (a workspace with an empty 6: still nothing to move)
  await app.click({ pa: 'team-new' });
  await flushSaves(app);
  assert.deepEqual(get(storage, KEYS.teams).teams.map((x) => [x.name, x.slots.length]), [['Team 1', 0]]);
  assert.equal(storage.getItem(TM.PREMIGRATION_KEY), null, 'no backup: there was nothing to move');
  assert.match(app.location.hash, /^#prep\/teams\/team_/);
  await app.click({ pa: 'team-import-into-toggle', team: get(storage, KEYS.teams).teams[0].id });
  assert.match(T(app), /Import into this team/);
});

test('a fresh device that started a matchup (empty 6) still gets the Teams list, not "Setting up"', async (t) => {
  const storage = memoryStorage();
  const a = await bootApp({ mode: 'prep/5v8/sets', storage });
  await a.waitFor(() => /Saved on this device/.test(T(a)), 'the Sets tab', 20000);
  // your own matchup's Sets tab starts the prep by itself: its content, not a "Start prep" gate
  assert.ok(!/Start Anthony's prep vs Calvin/.test(T(a)));
  assert.match(T(a), /Their team/);
  await flushSaves(a);
  assert.equal([...storage.map.keys()].filter((k) => k.startsWith(wsKey(''))).length, 1, 'one workspace');
  a.restore();
  const app = await bootApp({ mode: 'prep/teams', storage });
  t.after(() => app.restore());
  await app.waitFor(() => /New team/.test(T(app)), 'the Teams list', 20000);
  assert.ok(!/Setting up/.test(T(app)));
});

test('Teams list: the matchup\'s team with its sprites and "brought vs", the box last; New team opens the builder', async (t) => {
  const storage = device({ mySets: [peli()] });
  const app = await ready('prep/teams', storage);
  t.after(() => app.restore());
  await app.waitFor(() => /vs Ning/.test(T(app)), 'the list');
  const h = T(app);
  assert.match(h, /vs Ning[^]*1 of 6 · brought vs Ning/);
  assert.match(h, /📦 Imported sets[^]*1 set not in a team/);
  assert.ok(h.indexOf('vs Ning') < h.indexOf('Imported sets'), 'the box sits last');
  await app.click({ pa: 'team-new' });
  await flushSaves(app);
  assert.match(app.location.hash, /^#prep\/teams\/team_[a-z2-7]{12}$/);
  assert.ok(get(storage, KEYS.teams).teams.some((x) => x.name === 'Team 1' && x.slots.length === 0));
});

test('builder: add from your 10 (the box\'s set moves in), copy is independent, move keeps the id, remove → box; delete team with Undo', async (t) => {
  const storage = device({ mySets: [peli(), kanga()] });
  const app = await ready(`prep/teams/${tN}`, storage);
  t.after(() => app.restore());
  // add Pelipper: its set is in the box, so it moves into the team (and the set editor for it opens)
  await app.changeData({ pc: 'team-add-species', team: tN }, { value: 'pelipper' });
  await flushSaves(app);
  assert.deepEqual(team(storage, tN).slots, [SET_MINE, SET_PELI]);
  assert.equal(app.location.hash, `#prep/teams/${tN}/2`);
  assert.ok(get(storage, wsKey(WS)).my6.some((m) => m.setId === SET_PELI), 'the matchup bringing it follows');
  // a second team; copy Charizard there (independent), move Pelipper there (same id)
  await app.click({ pa: 'team-new' }); await flushSaves(app);
  const t2 = get(storage, KEYS.teams).teams.find((x) => x.name === 'Team 1').id;
  await app.changeData({ pc: 'team-copy-to', set: SET_MINE }, { value: t2 });
  await app.changeData({ pc: 'team-move-to', set: SET_PELI }, { value: t2 });
  await flushSaves(app);
  const sets = get(storage, KEYS.mysets).sets;
  const copyId = team(storage, t2).slots.find((id) => id !== SET_PELI);
  assert.notEqual(copyId, SET_MINE);
  assert.deepEqual(sets.find((s) => s.id === copyId).versions, sets.find((s) => s.id === SET_MINE).versions, 'identical history');
  assert.deepEqual(sets.find((s) => s.id === copyId).copiedFrom, { setId: SET_MINE, v: 1 });
  assert.deepEqual(team(storage, tN).slots, [SET_MINE], 'move keeps the id, out of the first team');
  assert.ok(team(storage, t2).slots.includes(SET_PELI));
  // remove → box
  await app.click({ pa: 'team-remove', set: SET_PELI }); await flushSaves(app);
  assert.ok(team(storage, TM.HOLDING_ID).slots.includes(SET_PELI));
  // delete the matchup's team: its set goes to the box, the matchup brings no team; Undo puts it all back
  const before = get(storage, KEYS.teams);
  await app.click({ pa: 'team-open', team: tN });
  await app.click({ pa: 'team-delete', team: tN });
  assert.match(T(app), /Delete vs Ning\? Its 1 set moves to Imported sets[^]*Matchups bringing it \(vs Ning\) will bring no team/);
  await app.click({ pa: 'team-delete-confirm', team: tN }); await flushSaves(app);
  assert.equal(team(storage, tN), undefined);
  assert.ok(team(storage, TM.HOLDING_ID).slots.includes(SET_MINE));
  assert.equal(get(storage, wsKey(WS)).teamId, undefined);
  await app.click({ pa: 'undo-delete' }); await flushSaves(app);
  assert.deepEqual(team(storage, tN).slots, before.teams.find((x) => x.id === tN).slots, 'Undo restores the team');
  assert.equal(get(storage, wsKey(WS)).teamId, tN);
  const all = get(storage, KEYS.teams).teams.flatMap((x) => x.slots);
  assert.equal(new Set(all).size, all.length, 'every set in exactly one team throughout');
});

test('warnings, never blocks: two Mega Stones and a repeated item are said; species clause too', async (t) => {
  const zard2 = newLineage({ id: 'set_zzzzzzzzzzzz', side: 'mine', speciesId: 'charizard', name: 'X', now: NOW, data: { item: 'charizarditex', ability: 'blaze', nature: 'jolly', moves: ['flareblitz'], sp: { hp: 0, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 } } });
  const storage = device({ mySets: [kanga(), zard2] });
  const app = await ready(`prep/teams/${tN}`, storage);
  t.after(() => app.restore());
  await app.changeData({ pc: 'team-move-to', set: SET_X }, { value: tN });
  await app.changeData({ pc: 'team-move-to', set: 'set_zzzzzzzzzzzz' }, { value: tN });
  await flushSaves(app);
  await app.click({ pa: 'team-open', team: tN });
  const h = T(app);
  assert.match(h, /3 Mega Stones \(Charizard, Kangaskhan, Charizard\): only one can Mega Evolve per battle/);
  assert.match(h, /Species clause: Charizard \+ Charizard: only one can be brought/);
  assert.equal(team(storage, tN).slots.length, 3, 'all three joined anyway');
});

test('Bring on a matchup: the Sets tab picks the team, my6 follows; a new matchup brings the last team used', async (t) => {
  const storage = device({ mySets: [peli()] });
  const app = await ready(`prep/w/${WS}/sets`, storage);
  t.after(() => app.restore());
  assert.ok(findAll(parseHtml(app.html()), (n) => n.attrs.id === 'tm-bring-ws').length, 'the Bring picker');
  await app.click({ pa: 'team-new' }); await flushSaves(app);
  const t2 = get(storage, KEYS.teams).teams.find((x) => x.name === 'Team 1').id;
  await app.changeData({ pc: 'team-move-to', set: SET_PELI }, { value: t2 }); await flushSaves(app);
  await app.click({ pa: 'back' });
  const b = await bootApp({ mode: `prep/w/${WS}/sets`, storage });
  t.after(() => b.restore());
  await b.changeData({ pc: 'ws-bring', ws: WS }, { value: t2 }); await flushSaves(b);
  assert.deepEqual([get(storage, wsKey(WS)).teamId, get(storage, wsKey(WS)).my6.map((m) => m.setId)], [t2, [SET_PELI]]);
  assert.equal(get(storage, KEYS.meta).lastTeamId, t2);
  // with a team brought, Bring is the primary control; your 10 one by one folds away below it
  assert.match(b.html(), /class="tm-bring"[^]*<details class="tm-onebyone">/);
  // a new matchup (vs Taro) brings that team by default
  const c = await bootApp({ mode: 'prep/5v6/sets', storage });
  t.after(() => c.restore());
  await c.click({ pa: 'match-start-ws', tab: 'sets' }); await flushSaves(c);
  const taro = Object.values(Object.fromEntries([...storage.map].filter(([k]) => k.startsWith('drafarig.prep.ws.')).map(([k, v]) => [k, JSON.parse(v)]))).find((w) => w.coach === 'Taro');
  assert.deepEqual([taro.teamId, taro.my6.map((m) => m.setId)], [t2, [SET_PELI]]);
});

test('old My sets links open the set in its team; export has the Showdown header; import makes a team (off-roster to the box)', async (t) => {
  const storage = device();
  const app = await ready(`prep/my-sets/${SET_MINE}`, storage);
  t.after(() => app.restore());
  await app.waitFor(() => app.location.hash === `#prep/teams/${tN}/1`, 'the redirect');
  assert.match(T(app), /Charizard-Mega-Y · Sun Zard/);
  const l = await bootApp({ mode: 'prep/my-sets', storage });
  t.after(() => l.restore());
  await l.waitFor(() => l.location.hash === '#prep/teams', 'the list redirect');
  await l.click({ pa: 'team-open', team: tN });
  await l.click({ pa: 'team-export', team: tN });
  assert.ok(!/===/.test(l.html()), 'no backup header in an ordinary team export');
  assert.match(l.html(), /Charizard @ Charizardite Y/);
  await l.click({ pa: 'back' });
  await l.click({ pa: 'team-import-toggle' });
  await l.input('team-import-text', '=== [gen9championsvgc2026regmc] Rain ===\n\nPelipper @ Focus Sash\nAbility: Drizzle\nLevel: 50\nEVs: 32 HP / 32 SpA / 2 SpD\nModest Nature\n- Hurricane\n- Protect\n\nGarchomp @ Life Orb\nAbility: Rough Skin\nLevel: 50\nEVs: 32 Atk / 32 Spe / 2 HP\nJolly Nature\n- Earthquake\n');
  await l.click({ pa: 'team-import' }); await flushSaves(l);
  const rain = get(storage, KEYS.teams).teams.find((x) => x.name === 'Rain');
  assert.ok(rain, 'a team named from the header');
  const sp = (id) => get(storage, KEYS.mysets).sets.find((s) => s.id === id).speciesId;
  assert.deepEqual(rain.slots.map(sp), ['pelipper']);
  assert.ok(team(storage, TM.HOLDING_ID).slots.map(sp).includes('garchomp'), 'Garchomp isn\'t one of your 10: the box');
  assert.match(T(l), /Imported 1 set into the team; 1 went to Imported sets/);
});

// A normal Showdown export always carries EVs: one tap imports it, converting each EV line to Stat Points with a note.
const CALVIN = `=== [gen9championsvgc2026regmc] Calvin plan ===

Charizard @ Charizardite Y
Ability: Solar Power
Level: 50
EVs: 252 SpA / 252 Spe
Modest Nature
- Heat Wave
- Solar Beam
- Protect
- Weather Ball

Rotom-Fan @ Sitrus Berry
Ability: Levitate
Level: 50
EVs: 252 SpA / 252 Spe
Modest Nature
- Thunderbolt
- Air Slash
- Protect
- Nasty Plot

Pelipper @ Focus Sash
Ability: Drizzle
Level: 50
EVs: 252 HP / 252 SpA
Modest Nature
- Hurricane
- Weather Ball
- Tailwind
- Protect
`;
// The fixture draft gives Anthony 4 picks; add Rotom-Fan as a 5th so all three are his (only drafted mons join a team).
const withRotom = () => {
  const rows = RAW.draftsCsv.split('\n').map((r) => r.split(','));
  rows[6].splice(12, 3, '洛托姆', 'Rotom-Fan', '10');
  return { ...RAW, draftsCsv: rows.map((r) => r.join(',')).join('\n') };
};
test('Import team with Showdown EVs: one tap makes "Calvin plan" with 3 sets, EVs converted (noted, with Review)', async (t) => {
  const storage = memoryStorage();
  const app = await bootApp({ mode: 'prep/teams', storage, raw: withRotom() });
  t.after(() => app.restore());
  await app.waitFor(() => /New team/.test(T(app)), 'the Teams list', 20000);
  await app.click({ pa: 'team-import-toggle' });
  await app.input('team-import-text', CALVIN);
  await app.click({ pa: 'team-import' }); await flushSaves(app);
  const plan = get(storage, KEYS.teams).teams.find((x) => x.name === 'Calvin plan');
  assert.ok(plan, 'a team named from the header');
  const sets = get(storage, KEYS.mysets).sets;
  const of = (id) => sets.find((s) => s.id === id);
  assert.deepEqual(plan.slots.map((id) => of(id).speciesId), ['charizard', 'rotomfan', 'pelipper']);
  assert.deepEqual(of(plan.slots[2]).versions.at(-1).data.sp, { hp: 32, atk: 0, def: 0, spa: 32, spd: 0, spe: 0 });
  assert.equal(app.location.hash, `#prep/teams/${plan.id}`, 'the new team opens');
  assert.match(app.html(), /<h2[^>]*>Calvin plan<\/h2>/, 'the team name is the title');
  const h = T(app);
  assert.match(h, /Imported 3 sets into the team\./);
  assert.match(h, /Pelipper: EVs converted to Stat Points, 252 HP \/ 252 SpA → 32 HP \/ 32 SpA\. Review/);
  assert.ok(!/held back|need a check/.test(h));
  await app.click({ pa: 'team-import-dismiss' });
  assert.ok(!/EVs converted/.test(T(app)), 'the note dismisses');
});

test('Import team: only truly invalid sets are held back, by name; the rest import', async (t) => {
  const storage = memoryStorage();
  const app = await bootApp({ mode: 'prep/teams', storage });
  t.after(() => app.restore());
  await app.waitFor(() => /New team/.test(T(app)), 'the Teams list', 20000);
  await app.click({ pa: 'team-import-toggle' });
  await app.input('team-import-text', CALVIN.replace('- Nasty Plot', '- Spore').replace('Pelipper @', 'Pelipperr @'));
  await app.click({ pa: 'team-import' }); await flushSaves(app);
  const plan = get(storage, KEYS.teams).teams.find((x) => x.name === 'Calvin plan');
  assert.equal(plan.slots.length, 1);
  const h = T(app);
  assert.match(h, /Imported 1 set into the team; 2 held back\./);
  assert.match(h, /Rotom-Fan held back: Rotom-Fan can't learn Spore\./);
  assert.match(h, /Pelipperr held back/);
  // the note goes once you go elsewhere (and it is never stored: a reload starts without it)
  await app.click({ pa: 'team-slot', team: plan.id, slot: '1' });
  await app.click({ pa: 'back' });
  assert.ok(!/held back/.test(T(app)), 'gone after opening a slot');
});

test('Battle Prep: the unmatched-name line is quiet and dismissible for the session', async (t) => {
  const raw = { ...RAW, draftsCsv: RAW.draftsCsv.replace(',Kangaskhan,', ',Kangaskhann,') };
  const app = await bootApp({ mode: 'prep/teams', raw });
  t.after(() => app.restore());
  await app.waitFor(() => /not matched/.test(app.banners.innerHTML), 'the quiet line');
  assert.ok(!/banner warn/.test(app.banners.innerHTML), 'not an orange banner in Prep');
  await app.click({ dismissUnmatched: '1' });
  assert.ok(!/not matched/.test(app.banners.innerHTML), 'dismissed');
});

// ---------- export: plain Showdown set text (live v12 P0: "a weird prefix/suffix that imports badly") ----------
// The expected text is what Showdown's own teambuilder writes for one team (play.pokemonshowdown.com
// js/oldclient/storage.js, Storage.exportTeam): every line ends "  \n", each set ends with a blank line, Champions Stat
// Points sit on the EVs line (the client keeps them in set.evs, max 32, column "Points"), Level only when not 100.
const CALVIN_EXPORT = [
  'Charizard @ Charizardite Y  ', 'Ability: Solar Power  ', 'Level: 50  ', 'EVs: 32 SpA / 32 Spe  ', 'Modest Nature  ', '- Heat Wave  ', '- Solar Beam  ', '- Protect  ', '- Weather Ball  ', '',
  'Rotom-Fan @ Sitrus Berry  ', 'Ability: Levitate  ', 'Level: 50  ', 'EVs: 32 SpA / 32 Spe  ', 'Modest Nature  ', '- Thunderbolt  ', '- Air Slash  ', '- Protect  ', '- Nasty Plot  ', '',
  'Pelipper @ Focus Sash  ', 'Ability: Drizzle  ', 'Level: 50  ', 'EVs: 32 HP / 32 SpA  ', 'Modest Nature  ', '- Hurricane  ', '- Weather Ball  ', '- Tailwind  ', '- Protect  ', '', '',
].join('\n');
/**
 * A minimal port of Showdown's single-team import (Storage.importTeam(buffer) with no `teams` argument, storage.js
 * L1199–1330): blank line ends a set; any other line with no set open STARTS one ("=== …" included: only the backup import
 * skips it); "Nick (Species) (F) @ Item"; Ability / Level / EVs / Nature / "- Move".
 */
function showdownImport(text) {
  const team = [];
  let cur = null;
  for (const raw of text.split('\n')) {
    let line = raw.trim();
    if (line === '' || line === '---') { cur = null; continue; }
    if (!cur) {
      cur = { name: '', species: '', gender: '', item: '', ability: '', level: 100, evs: {}, nature: '', moves: [] };
      team.push(cur);
      const at = line.lastIndexOf(' @ ');
      if (at !== -1) { cur.item = line.slice(at + 3); line = line.slice(0, at); }
      if (line.endsWith(' (M)')) { cur.gender = 'M'; line = line.slice(0, -4); }
      if (line.endsWith(' (F)')) { cur.gender = 'F'; line = line.slice(0, -4); }
      const p = line.lastIndexOf(' (');
      if (line.endsWith(')') && p !== -1) { cur.species = line.slice(p + 2, -1); cur.name = line.slice(0, p); } else cur.species = line;
    } else if (line.startsWith('Ability: ')) cur.ability = line.slice(9);
    else if (line.startsWith('Level: ')) cur.level = +line.slice(7);
    else if (line.startsWith('EVs: ')) for (const e of line.slice(5).split('/')) { const [v, k] = e.trim().split(' '); cur.evs[k] = parseInt(v, 10); }
    else if (/^[A-Za-z]+ (N|n)ature/.test(line)) cur.nature = line.slice(0, line.indexOf(' Nature'));
    else if (line.startsWith('- ')) cur.moves.push(line.slice(2));
  }
  return team;
}

test('Export team is plain Showdown text: no header, Showdown\'s own line endings; Showdown\'s single-team import reads exactly the 3 sets', async (t) => {
  const storage = memoryStorage();
  const app = await bootApp({ mode: 'prep/teams', storage, raw: withRotom() });
  t.after(() => app.restore());
  await app.waitFor(() => /New team/.test(T(app)), 'the Teams list', 20000);
  await app.click({ pa: 'team-import-toggle' });
  await app.input('team-import-text', CALVIN);
  await app.click({ pa: 'team-import' }); await flushSaves(app);
  const plan = get(storage, KEYS.teams).teams.find((x) => x.name === 'Calvin plan');
  await app.click({ pa: 'team-export', team: plan.id });
  const area = findAll(parseHtml(app.html()), (n) => n.attrs.id === 'tm-export')[0];
  const text = area.children.map((c) => c.text ?? '').join('');
  assert.equal(text, CALVIN_EXPORT, 'exact text');
  await app.click({ pa: 'team-export-copy', team: plan.id });
  assert.equal(app.clipboard.at(-1), CALVIN_EXPORT, 'Copy gives the same text');
  // Showdown's single-team import: 3 sets, the right fields (the old "=== [format] Name ===" line made a 4th, junk set)
  const sd = showdownImport(text);
  assert.deepEqual(sd.map((s) => [s.species, s.item, s.ability, s.level, s.nature, s.moves.length]), [
    ['Charizard', 'Charizardite Y', 'Solar Power', 50, 'Modest', 4], ['Rotom-Fan', 'Sitrus Berry', 'Levitate', 50, 'Modest', 4], ['Pelipper', 'Focus Sash', 'Drizzle', 50, 'Modest', 4]]);
  assert.deepEqual(sd[2].evs, { HP: 32, SpA: 32 });
  assert.equal(showdownImport(`=== [gen9championsvgc2026regmc] Calvin plan ===\n\n${text}`)[0].species, '=== [gen9championsvgc2026regmc] Calvin plan ===', 'the cause: the header became a Pokémon');
  // Pokepaste (felixphew/pokepaste syntax.go): sets split on blank lines; a first line must match its species/item pattern
  for (const block of text.trim().split('\n\n')) assert.match(block.split('\n')[0], /^[A-Z][A-Za-z0-9:'. -]+( @ [A-Z][A-Za-z0-9:' -]+)? *$/);
  // round trip through our own import: identical sets
  const again = parseTeam(text, { mech, side: 'mine' });
  const lib = get(storage, KEYS.mysets).sets;
  assert.deepEqual(again.sets.map((s) => s.status), ['ready', 'ready', 'ready']);
  assert.deepEqual(again.sets.map((s) => setKey(s.set)), plan.slots.map((id) => { const l = lib.find((x) => x.id === id); return setKey({ ...l.versions.at(-1).data, species: l.speciesId }); }));
});

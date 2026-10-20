// Mocks (lib/mocks + public/prep-mocks.js): the curated Jacky-vs-Calvin mock (lib/mocks/4v8.mjs) validated and rendered,
// Copy for Showdown (exact export, no header), the workbench "mock" side, the running record and the note for the friend
// (never your own prep), the pilot document's additive storage, and #prep/pilot redirecting.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mech } from './calc-helpers.mjs';
import { bootApp } from './ui-harness.mjs';
import { device, T, btns, flushSaves } from './prep-helpers.mjs';
import { KEYS, validate } from '../lib/prep-schema.mjs';
import { validateMock, mockFor, mockStaleness, MOCKS } from '../lib/mocks/index.mjs';
import { parseTeamQuick, exportTeam } from '../lib/paste.mjs';
import jacky from '../lib/mocks/4v8.mjs';

test('the curated Jacky mock validates cleanly; a broken entry is dropped and reported; matched by names', () => {
  const { mock, problems } = validateMock(jacky, mech);
  assert.deepEqual(problems, []);
  assert.deepEqual([mock.coach, mock.vs, mock.week, mock.variants.length, mock.calcs.length, mock.pilotNotes.leads.length, mock.pilotNotes.ifThen.length], ['Jacky', 'Calvin', 2, 1, 12, 2, 6]);
  assert.equal(parseTeamQuick(mock.team, { mech, side: 'theirs' }).sets.filter((s) => s.set).length, 6, 'the six parse');
  const bad = validateMock({ ...jacky, calcs: [...jacky.calcs, { attacker: { id: 'nosuchmon', set: 'mock' }, defender: { id: 'grimmsnarl', set: 'ladder' }, move: 'tackle' }] }, mech);
  assert.equal(bad.mock.calcs.length, 12);
  assert.ok(bad.problems.some((p) => p.startsWith('calcs[12]')));
  assert.equal(validateMock({ ...jacky, team: '' }).mock, null);
  assert.ok(MOCKS.includes(jacky) && mockFor('Jacky', 'Calvin', { mech }) && !mockFor('Calvin', 'Jacky', { mech }));
  const st = mockStaleness(validateMock(jacky).mock, jacky.rosters.x, ['staraptor', 'grimmsnarl'], (id) => id);
  assert.equal(st.stale, true);
  assert.equal(mockStaleness(validateMock(jacky).mock, jacky.rosters.x, jacky.rosters.y).stale, false);
});

async function mocks(t, mode, storage = device()) {
  const app = await bootApp({ mode, storage });
  t.after(() => app.restore());
  await app.waitFor(() => /Mocks|Play Jacky/.test(T(app)) && !/Loading the league/.test(T(app)), 'Mocks', 20000);
  return app;
}

test('Mocks home: friend, their weeks (W2 Jacky, curated ✓; W3 bye; your week greyed), Play; #prep/pilot redirects here', async (t) => {
  const app = await mocks(t, 'prep/pilot');
  assert.equal(app.location.hash, '#prep/mocks');
  // a fresh device defaults to the friend a curated mock is written for (4v8: Calvin), not the first coach
  assert.match(app.html(), /<option value="Calvin" selected>/);
  const h = T(app);
  assert.match(h, /W1Anthony \(you\)/);
  assert.match(h, /W2Jacky next\? ?Curated ✓/);
  assert.match(h, /W3bye/);
  assert.match(h, /W4ZhuZi ?Generated/);
  assert.match(h, /Open as Jacky ›/);
  assert.match(h, /Record & note for Calvin ›/);
  const play = btns(app, 'mk-play')[0];
  await app.click({ pa: 'mk-play', ...play });
  assert.equal(app.location.hash, '#prep/mocks/8v4');
  // a remembered choice still wins
  await app.click({ pa: 'back' });
  await app.changeData({ pc: 'mk-friend' }, { value: 'ZhuZi' });
  assert.match(app.html(), /<option value="ZhuZi" selected>/);
});

test('the Jacky mock: Team (labels, clauses), variant B, Copy for Showdown is the exact export with no header', async (t) => {
  const app = await mocks(t, 'prep/mocks/8v4');
  const h = T(app);
  assert.match(h, /Play Jacky vs Calvin · W2/);
  assert.match(h, /Curated \(19 Oct\)/);
  for (const m of ['Farigiraf', 'Torkoal', 'Incineroar', 'Golisopod-Mega', 'Mr. Rime', 'Lycanroc-Midnight']) assert.ok(h.includes(m), m);
  assert.match(h, /Incineroar ?matchup-tuned/);
  assert.match(h, /Farigiraf ?ladder/);
  assert.match(h, /Item clause ok · 1 Mega: Golisopod-Mega/);
  assert.match(h, /Rosters changed since this mock was written/, 'the fixture sheet has fewer picks than the mock was written for');
  await app.click({ pa: 'mk-copy', ...btns(app, 'mk-copy')[0] });
  const text = app.clipboard.at(-1);
  const sets = parseTeamQuick(jacky.team, { mech, side: 'theirs' }).sets.map((s) => s.set);
  assert.equal(text, exportTeam(sets, mech).text);
  assert.ok(text.startsWith('Farigiraf @ Sitrus Berry  \nAbility: Armor Tail  \nLevel: 50  \nEVs: 32 HP / 2 SpA / 32 SpD  \nSassy Nature  \n- Trick Room  \n'));
  assert.ok(!/===/.test(text), 'no header');
  // variant B
  const b = btns(app, 'mk-variant').find((x) => x.v === 'v1');
  await app.click({ pa: 'mk-variant', ...b });
  assert.match(T(app), /Rotom-Mow/);
  await app.click({ pa: 'mk-copy', ...btns(app, 'mk-copy')[0] });
  assert.ok(app.clipboard.at(-1).startsWith('Incineroar @ Chople Berry'));
});

test('Notes: how it wins, leads, what Calvin will try, if/then; a key calc opens the workbench with the "mock" side (no Apply, no Save as calc)', async (t) => {
  const app = await mocks(t, 'prep/mocks/8v4');
  await app.click({ pa: 'mk-tab', key: 'Calvin|Jacky', tab: 'notes' });
  const h = T(app);
  for (const s of ['How it wins', 'Set Trick Room', 'Lead and turn 1', 'Farigiraf + Incineroar', 'What Calvin will try', 'Tailwind + screens', 'If / then', 'If he leads Grimmsnarl', 'Key calcs', 'Speed order', 'Mock etiquette'])
    assert.ok(h.includes(s), s);
  const calc = btns(app, 'mk-calc').find((c) => c.i === '0');
  await app.click({ pa: 'mk-calc', ...calc });
  const w = app.html();
  assert.match(w, /Eruption: Torkoal → Calvin&#39;s Staraptor-Mega/);
  assert.match(w, /Jacky&#39;s mock set/);
  assert.match(w, /data-value="Sun"[^>]*aria-pressed="true"|aria-pressed="true"[^>]*data-value="Sun"/);
  assert.ok(!/data-pa="wb-apply"/.test(w) && !/data-pa="wb-save-calc"/.test(w), 'pilot mode: nothing saves to your prep');
  await app.waitFor(() => /Guide: [\d.]+–[\d.]+% · now/.test(T(app)), 'the stated number vs now', 20000);
  assert.match(T(app), /Guide: [\d.–%]+ · now [\d.–%]+ ✓/, 'the curated number reproduces');
  // a calc with the mock defending: Mega Staraptor Close Combat into Incineroar (Chople Berry)
  await app.click({ pa: 'wb-close' });
  await app.click({ pa: 'mk-calc', ...btns(app, 'mk-calc').find((c) => c.i === '7') });
  assert.match(app.html(), /Close Combat: Calvin&#39;s Staraptor-Mega → Incineroar/);
  assert.match(app.html(), /<option value="chopleberry" selected>/);
});

test('Log: a game goes into the pilot document (one running record per friend × opponent); the note never carries your own prep', async (t) => {
  const storage = device();
  const app = await mocks(t, 'prep/mocks/8v4', storage);
  await app.click({ pa: 'mk-tab', key: 'Calvin|Jacky', tab: 'log', form: '1' });
  await app.click({ pa: 'mk-form-result', r: 'W' });
  await app.changeData({ pc: 'mk-form-set', key: 'ol0' }, { value: 'farigiraf' });
  await app.changeData({ pc: 'mk-form-set', key: 'ol1' }, { value: 'incineroar' });
  await app.input('mk-form-text', 'TR went up T1', { key: 'line' });
  await app.input('mk-form-text', 'Fake Out Farigiraf first', { key: 'know' });
  await app.click({ pa: 'mk-form-save', friend: '8', pilot: '4', v: 'main' }); await flushSaves(app);
  const doc = JSON.parse(storage.getItem(KEYS.pilot));
  assert.equal(doc.mocks.length, 1);
  const m = doc.mocks[0];
  assert.deepEqual([m.friend, m.pilot, m.week, m.source, m.games.length, m.games[0].result, m.games[0].ourLead], ['Calvin', 'Jacky', 2, 'curated', 1, 'W', ['farigiraf', 'incineroar']]);
  assert.deepEqual(validate('pilot', doc), [], 'the pilot document stays valid');
  assert.match(T(app), /1–0 vs Calvin, A: main/);
  // a second game continues the same record
  await app.click({ pa: 'mk-form' }); await app.click({ pa: 'mk-form-result', r: 'L' });
  await app.click({ pa: 'mk-form-save', friend: '8', pilot: '4', v: 'main' }); await flushSaves(app);
  assert.equal(JSON.parse(storage.getItem(KEYS.pilot)).mocks[0].games.length, 2);
  // the note: record and games; no team unless ticked; never your own sets (the device has your "Sun Zard" Charizard)
  await app.click({ pa: 'mk-copy-note', friend: '8', pilot: '4', v: 'main' });
  const note = app.clipboard.at(-1);
  assert.match(note, /Mock: Jacky's team vs Calvin \(W2\)/);
  assert.match(note, /Record: 1–1/);
  assert.match(note, /Game 1: won, led Farigiraf \+ Incineroar, TR went up T1 · Fake Out Farigiraf first/);
  assert.ok(!/Sun Zard|EVs:/.test(note));
  await app.changeData({ pc: 'mk-include', key: 'Calvin|Jacky' }, { checked: true });
  await app.click({ pa: 'mk-copy-note', friend: '8', pilot: '4', v: 'main' });
  assert.match(app.clipboard.at(-1), /Farigiraf @ Sitrus Berry/);
  assert.ok(!/Sun Zard/.test(app.clipboard.at(-1)));
});

test('storage: the pilot document with mocks validates; without them (older builds) too; a malformed mock is refused', () => {
  const base = { schemaVersion: 2, rev: 1, teams: [] };
  assert.deepEqual(validate('pilot', base), []);
  const ok = { ...base, mocks: [{ id: 'pilot_aaaaaaaaaaaa', friend: 'Calvin', pilot: 'Jacky', week: 2, source: 'curated', games: [{ id: 'game_aaaaaaaaaaaa', result: 'W', line: '', know: '' }], note: '' }] };
  assert.deepEqual(validate('pilot', ok), []);
  assert.ok(validate('pilot', { ...base, mocks: [{ ...ok.mocks[0], source: 'nope' }] }).length);
  assert.ok(validate('pilot', { ...base, mocks: [{ ...ok.mocks[0], games: [{ id: 'x', result: 'D' }] }] }).length);
  assert.ok(validate('pilot', { ...base, mocks: [{ ...ok.mocks[0], variants: [{ key: 'main', name: 'A', team: 'x', labels: ['nope'] }] }] }).length, 'unknown set label');
  assert.ok(validate('pilot', { ...base, mocks: [{ ...ok.mocks[0], useMyGuesses: 'yes' }] }).length);
});

test('a generated mock (W4 ZhuZi): built from his 10, labelled sets, copy keeps it on the record; Edit saves on the mock; Regenerate asks first; own guesses opt-in', async (t) => {
  const storage = device();
  const app = await mocks(t, 'prep/mocks', storage);
  await app.changeData({ pc: 'mk-friend' }, { value: 'Calvin' });
  await app.click({ pa: 'mk-week', friend: 'Calvin', week: '4' });
  await app.click({ pa: 'mk-play', ...btns(app, 'mk-play')[0] });
  await app.waitFor(() => /Generated from ZhuZi/.test(T(app)), 'the generated team', 30000);
  const h = T(app);
  for (const s of ['Play ZhuZi vs Calvin', 'A: best six', 'Item clause ok', 'Regenerate', "Use my saved guesses of ZhuZi's sets", 'Calvin will see these sets']) assert.ok(h.includes(s), s);
  assert.match(h, /ladder|worst case|matchup-tuned/);
  // Copy for Showdown: exact export, no header; the generated team is kept on the running record
  await app.click({ pa: 'mk-copy', ...btns(app, 'mk-copy')[0] }); await flushSaves(app);
  assert.ok(!/===/.test(app.clipboard.at(-1)));
  const rec = () => { const d = JSON.parse(storage.getItem(KEYS.pilot)); assert.deepEqual(validate('pilot', d), [], 'the pilot document stays valid'); return d.mocks.find((x) => x.pilot === 'ZhuZi'); };
  let m = rec();
  assert.equal(m.source, 'generated');
  assert.equal(m.variants[0].team, app.clipboard.at(-1), 'the record keeps what was copied');
  assert.ok(Array.isArray(m.rosters.x) && Array.isArray(m.rosters.y));
  // Edit › the first set: nature and an over-cap SP (clamped to 32); saved on the mock only, labelled "edited"
  const e = btns(app, 'mk-edit')[0];
  await app.click({ pa: 'mk-edit', ...e });
  assert.match(T(app), /Editing ZhuZi's .+ for a mock · nothing here touches your teams/);
  await app.changeData({ pc: 'mk-ed', key: 'nature' }, { value: 'timid' });
  await app.changeData({ pc: 'mk-ed', key: 'sp-spe' }, { value: '99' });
  assert.match(app.html(), /value="32" data-pc="mk-ed" data-key="sp-spe"/);
  await app.click({ pa: 'mk-ed-save', ...btns(app, 'mk-ed-save')[0] }); await flushSaves(app);
  m = rec();
  assert.equal(m.variants[0].labels[Number(e.i)], 'edited');
  assert.match(m.variants[0].team, /Timid Nature/);
  assert.match(T(app), /edited/);
  // Regenerate asks first (your edit would go); Keep mine keeps it; confirmed, it rebuilds
  await app.click({ pa: 'mk-regen', ...btns(app, 'mk-regen')[0] });
  assert.match(T(app), /Regenerate replaces your 1 change\./);
  await app.click({ pa: 'mk-regen-cancel' });
  assert.equal(rec().variants[0].labels[Number(e.i)], 'edited');
  await app.click({ pa: 'mk-regen', ...btns(app, 'mk-regen')[0] });
  await app.click({ pa: 'mk-regen', ...btns(app, 'mk-regen').find((b) => b.sure) }); await flushSaves(app);
  assert.equal(rec().variants, undefined);
  await app.waitFor(() => /Generated from ZhuZi/.test(T(app)) && !/edited/.test(T(app)), 'rebuilt', 30000);
  // the guesses toggle is opt-in and stored on the record
  await app.changeData({ pc: 'mk-guesses', friend: 'Calvin', pilot: 'ZhuZi' }, { checked: true }); await flushSaves(app);
  assert.equal(rec().useMyGuesses, true);
  await app.waitFor(() => /Generated from ZhuZi/.test(T(app)), 'rebuilt with guesses', 30000);
});

test('W5 Hex: a generated mock too, with the clauses checked and nothing saved until you use it', async (t) => {
  const storage = device();
  const app = await mocks(t, 'prep/mocks', storage);
  await app.changeData({ pc: 'mk-friend' }, { value: 'Calvin' });
  await app.click({ pa: 'mk-week', friend: 'Calvin', week: '5' });
  await app.click({ pa: 'mk-play', ...btns(app, 'mk-play')[0] });
  await app.waitFor(() => /Generated from Hex/.test(T(app)), 'the generated team', 30000);
  assert.match(T(app), /Play Hex\(法拉\) vs Calvin · W5/);
  assert.match(T(app), /Item clause ok/);
  assert.equal(JSON.parse(storage.getItem(KEYS.pilot) ?? '{}').mocks, undefined, 'viewing saves nothing');
});

test('the header has a Mocks tab: from Draft, the Prep overview, a matchup Brief and the teambuilder it opens #prep/mocks; active state follows', async (t) => {
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(html, /<nav class="appswitch"[^>]*>.*<a href="#prep\/mocks" data-app-link="mocks">Mocks<\/a><\/nav>/, 'one header for every screen');
  for (const mode of ['draft', 'prep/5', 'prep/5v3', 'prep/5v2/build/1']) {
    const app = await bootApp({ mode, storage: device() });
    t.after(() => app.restore());
    if (mode !== 'draft') await app.waitFor(() => /class="prep"/.test(app.html()) && !/Loading the league/.test(T(app)), mode, 20000);
    assert.equal(app.currentApp(), mode === 'draft' ? 'draft' : 'prep', `${mode}: active tab before`);
    await app.click({ appLink: 'mocks' });
    await app.waitFor(() => /Play your friend's next opponent/.test(T(app)), `${mode} → Mocks`, 20000);
    assert.equal(app.location.hash, '#prep/mocks', mode);
    assert.equal(app.currentApp(), 'mocks', `${mode}: Mocks is the active tab`);
    if (mode === 'prep/5v3') {
      // Back returns to the Brief; Battle Prep from Mocks goes to Prep home
      app.history.back();
      await app.waitFor(() => app.location.hash === '#prep/5v3' && app.currentApp() === 'prep', 'back to the Brief', 20000);
      await app.click({ appLink: 'mocks' });
      await app.click({ appLink: 'prep' });
      await app.waitFor(() => !/^#prep\/mocks/.test(app.location.hash), 'Battle Prep from Mocks', 20000);
      assert.equal(app.currentApp(), 'prep');
    }
  }
});

test('mock POV: "Open as Jacky" opens #prep/4v8 as Jacky with a banner; the mock team is "your sets" (Brief, Can wreck you, Sets Bring, teambuilder, workbench); your own prep is untouched', async (t) => {
  const storage = device();
  // your own documents (library, teams, rules, your matchups, backups), as stored once the app has loaded; meta and the pilot
  // document are shared (the mock's record and the workspace index live there), navigation hints aren't prep
  const own = () => Object.fromEntries([...storage.map].filter(([k, v]) => k !== KEYS.pilot && k !== KEYS.meta && !k.includes('.hint.') && !/"mock":"pilot_/.test(v)));
  const app = await mocks(t, 'prep/mocks', storage);
  await flushSaves(app);
  const before = own();
  await app.click({ pa: 'mk-open', ...btns(app, 'mk-open')[0] }); await flushSaves(app);
  assert.equal(app.location.hash, '#prep/4v8');
  let h = T(app);
  assert.match(h, /Mock · playing as Jacky vs Calvin · nothing here touches your own prep/);
  assert.ok(!/Viewing as Jacky: not your side/.test(h), 'the banner replaces the view-as ribbon');
  // the curated notes as the Brief's Game plan card
  for (const s of ['Game plan · Jacky (mock) · W2', 'Set Trick Room', 'Farigiraf + Incineroar', 'Read his tells', 'How we lose', 'Team: A: main', 'Record & note for Calvin']) assert.ok(h.includes(s), s);
  assert.ok(btns(app, 'guide-calc').length >= 10, 'every mock calc is a workbench link');
  assert.match(h, /Your pool ?Incineroar ?Golisopod ?Farigiraf/);
  // Can wreck you: their worst case into the mock team
  await app.waitFor(() => /worst case: [A-Za-z ]+ → (Farigiraf|Torkoal|Incineroar|Golisopod|Rotom-Mow)/.test(T(app)), 'Can wreck you into the mock team', 30000);
  // Copy for Showdown: the brought team, exactly the curated export
  await app.click({ pa: 'mkp-copy' });
  assert.equal(app.clipboard.at(-1), exportTeam(parseTeamQuick(jacky.team, { mech, side: 'theirs' }).sets.map((s) => s.set), mech).text);
  // storage: the record and a workspace keyed to (Jacky, Calvin), flagged as the mock's
  const ws = [...storage.map.values()].map((v) => JSON.parse(v)).find((d) => d?.mock);
  assert.ok(ws && ws.pov === 'Jacky' && ws.coach === 'Calvin' && ws.my6.length === 6 && ws.teamId);
  assert.deepEqual(validate('ws', ws), []);
  // Sets: Bring offers the mock's variants
  await app.click({ pa: 'tab', tab: 'sets' });
  assert.match(app.html(), /data-pc="ws-bring"/);
  assert.match(app.html(), new RegExp(`<option value="${ws.teamId}" selected>A: main</option>`));
  assert.match(T(app), /6 of 6 chosen/);
  // the teambuilder: a face in Bring opens the mock's set in the mock's workspace; Save goes to the mock record ("edited")
  await app.click({ pa: 'team-slot', team: ws.teamId, slot: '1' });
  assert.equal(app.location.hash, `#prep/w/${ws.id}/sets/${ws.my6[0].setId}`);
  assert.match(T(app), /Mock · playing as Jacky/);
  await app.changeData({ pc: 'set-field', set: ws.my6[0].setId, field: 'nature' }, { value: 'relaxed' });
  await app.click({ pa: 'set-save', set: ws.my6[0].setId }); await flushSaves(app);
  const rec = JSON.parse(storage.getItem(KEYS.pilot)).mocks.find((m) => m.pilot === 'Jacky');
  assert.equal(rec.variants.find((v) => v.key === 'main').labels[0], 'edited');
  assert.match(rec.variants.find((v) => v.key === 'main').team, /^Farigiraf @ Sitrus Berry[\s\S]*?Relaxed Nature/);
  assert.deepEqual(validate('pilot', JSON.parse(storage.getItem(KEYS.pilot))), []);
  // the workbench: your side is the mock's set
  await app.click({ pa: 'back' });
  await app.click({ pa: 'tab', tab: 'brief' });
  await app.click({ pa: 'guide-calc', ...btns(app, 'guide-calc')[0] });
  assert.match(app.html(), /Eruption: Torkoal → Calvin&#39;s Staraptor-Mega/);
  await app.waitFor(() => /Guide: [\d.]+–[\d.]+% · now [\d.]+–[\d.]+% ✓/.test(T(app)), 'the mock calc reproduces with the mock set', 20000);
  await app.click({ pa: 'wb-close' });
  // exit: back to your own side; the mock isn't in your saved lists, and your Brief vs Calvin shows nothing of it
  await app.click({ pa: 'mkp-exit' });
  assert.ok(!/Mock · playing as/.test(T(app)));
  assert.ok(!/Jacky vs Calvin/.test(T(app)), 'the mock workspace is not in your saved lists');
  app.history.pushState(null, '', '#prep/5v8'); app.fire('popstate', {}); await app.settle(20);
  assert.equal(app.location.hash, '#prep/5v8');
  assert.ok(!/Game plan · Jacky|Mock · playing/.test(T(app)), 'your own Brief shows nothing of the mock');
  assert.deepEqual(own(), before, 'your own prep documents are byte-identical');
});

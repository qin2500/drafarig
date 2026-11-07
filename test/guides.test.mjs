// Matchup guides (lib/guides + public/prep-guide.js, docs/research/ux/matchup-guide.md) with a small FIXTURE guide
// (Anthony vs Ning; not a real guide): validation, staleness, every placement, the workbench links and their "now" line,
// "Can wreck you" merging (no duplicate rows), Import / Update from guide, the Plan board Fill, Move search, and
// "no guide = today's Brief".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mech } from './calc-helpers.mjs';
import { bootApp, parseHtml, findAll } from './ui-harness.mjs';
import { device, T, btns, flushSaves, SET_MINE, WS } from './prep-helpers.mjs';
import { KEYS } from '../lib/prep-schema.mjs';
import { parseRoute, formatRoute, MATCH_TABS, READ_TABS } from '../lib/prep-route.mjs';
import { validateGuide, staleness, guideFor, registerGuide, mergeWreck, matchCalc, GUIDES } from '../lib/guides/index.mjs';

const FIXTURE = {
  version: 1, pov: 5, opp: 2, coach: 'Ning', week: 2, written: '2026-10-19',
  rosters: { ours: ['charizard', 'sinistcha', 'pelipper', 'kangaskhan'], theirs: ['rillaboom', 'gholdengo', 'milotic', 'lucario', 'ninetalesalola'] },
  assumptions: ['Fixture guide for tests', 'numbers are illustrative', 'third assumption'],
  remember: ['Lead Charizard + Kangaskhan.', 'Save Protect for Rillaboom Fake Out.', 'Gholdengo walls Fake Out.', 'Heat Wave Gholdengo: 80–95%.'],
  bring: { six: ['charizard', 'kangaskhan', 'pelipper', 'sinistcha'], bench: [{ id: 'pelipper', why: 'no rain needed' }], mega: { id: 'charizard', why: 'sun beats Milotic' } },
  previews: [{ if: 'Rillaboom + Gholdengo', bring4: ['charizard', 'kangaskhan', 'sinistcha', 'pelipper'], lead: ['charizard', 'kangaskhan'], note: 'Solar Beam for Milotic' },
    { if: 'Lucario', bring4: ['charizard', 'sinistcha', 'pelipper', 'kangaskhan'], lead: ['sinistcha', 'pelipper'], note: '' }],
  leads: [{ ours: ['charizard', 'kangaskhan'], vs: ['ninetalesalola', 'rillaboom'], t1: 'Heat Wave 80–95% + Fake Out Rillaboom', t2: 'Heat Wave 50–60%', t3: '', ifs: ['if he Protects Gholdengo → double Rillaboom'] }],
  tells: [{ see: 'Gholdengo leads', means: 'Make It Rain spam', do: 'Heat Wave it turn 1' }],
  lose: [{ how: 'Lucario Rock Slide on Charizard 200–240%', fix: 'Protect turn 1' }],
  endgame: ['Keep Sinistcha for the end.'],
  combos: { theirs: [{ attackers: [['rillaboom', 'woodhammer'], ['gholdengo', 'makeitrain']], into: 'kangaskhan', range: '90–110%', answer: 'Protect Kangaskhan' }],
    ours: [{ attackers: [['charizard', 'heatwave'], ['kangaskhan', 'doubleedge']], into: 'gholdengo', range: '100–120%', verdict: 'KO' }, { attackers: [['nosuchmon', 'tackle'], ['charizard', 'heatwave']], into: 'milotic' }] },
  calcs: [{ attacker: { id: 'charizardmegay', set: 'ours' }, defender: { id: 'gholdengo', set: 'worst' }, move: 'heatwave', field: { weather: 'Sun', screens: true }, range: '80–95%', verdict: '2HKO', why: 'through Light Screen' },
    { attacker: { id: 'lucario', set: 'worst' }, defender: { id: 'charizardmegay', set: 'ours' }, move: 'rockslide', field: { intimidate: 1 }, range: '200–240%', verdict: 'OHKO', why: 'Protect or switch' }],
  perMon: { rillaboom: { role: 'Fake Out + Grassy Glide', worstCase: 'Wood Hammer 35% on Charizard', answer: 'Charizard', notes: ['Fake Out every game'] },
    lucario: { role: 'Rock coverage', worstCase: 'Rock Slide OHKOs Charizard', answer: 'Protect' },
    charizard: { job: 'Sun sweeper', avoid: 'staying in vs Rock moves', notes: ['Mega turn 1', 'two', 'three', 'four', 'five'] } },
  sets: 'Charizard @ Charizardite Y\nAbility: Blaze\nLevel: 50\nEVs: 2 HP / 32 SpA / 32 Spe\nModest Nature\n- Heat Wave\n- Solar Beam\n- Protect\n- Weather Ball\n\nKangaskhan @ Kangaskhanite\nAbility: Scrappy\nLevel: 50\nEVs: 32 HP / 32 Atk / 2 Def\nAdamant Nature\n- Fake Out\n- Double-Edge\n- Protect\n- Sucker Punch\n',
};
const base = (id) => mech.species[id]?.mega?.from ?? id;

test('validation: tolerant — a malformed entry is dropped and reported, the rest kept; a bad header is refused', () => {
  const { guide, problems } = validateGuide(FIXTURE, mech);
  assert.equal(guide.combos.ours.length, 1, 'the combo with an unknown mon is dropped');
  assert.ok(problems.some((p) => p.startsWith('combos.ours[1]')));
  assert.deepEqual(guide.rosters.theirs.length, 5);
  assert.equal(validateGuide({ ...FIXTURE, version: 3 }).guide, null);
  assert.deepEqual([guide.overview, guide.threats, guide.team], [null, [], null], 'a v1 guide: no long-form fields');
  const partial = validateGuide({ version: 1, pov: 5, opp: 2, coach: 'Ning', remember: ['one'] }, mech).guide;
  assert.deepEqual([partial.remember, partial.leads, partial.calcs, partial.sets, partial.rosters], [['one'], [], [], '', null]);
  assert.equal(guideFor(5, 2, 'Calvin', { guides: [FIXTURE] }), null, 'matched by the coach NAME');
  assert.ok(guideFor(5, 7, 'Ning', { guides: [FIXTURE] }), 'seats moved: still found by name');
  assert.equal(matchCalc(guide, 'lucario', 'charizard', 'rockslide', base)?.range, '200–240%', 'Mega forme ids match their base');
});

test('staleness: exact with rosters (both sides), inferred without', () => {
  const g = validateGuide(FIXTURE, mech).guide;
  const now = ['rillaboom', 'gholdengo', 'milotic', 'lucario', 'ninetalesalola'];
  assert.equal(staleness(g, now, ['charizard', 'sinistcha', 'pelipper', 'kangaskhan'], base).stale, false);
  const s = staleness(g, ['rillaboom', 'gholdengo', 'milotic', 'lucario', 'krookodile'], ['charizard', 'sinistcha', 'pelipper'], base);
  assert.deepEqual([s.added, s.removed, s.ours.removed], [['krookodile'], ['ninetalesalola'], ['kangaskhan']]);
  const inferred = staleness({ ...g, rosters: null }, ['gholdengo', 'lucario'], [], base);
  assert.deepEqual(inferred.removed, ['ninetalesalola', 'rillaboom'], 'without rosters: the mons the guide mentions');
});

async function brief(t, mode = 'prep/5v2', storage = device()) {
  const app = await bootApp({ mode, storage });
  t.after(() => app.restore());
  await app.waitFor(() => /bs-pool|Ning&#39;s pool|pool/.test(app.html()) && !/Opening your prep/.test(app.html()), 'the Brief', 20000);
  return app;
}

test('no guide for the matchup: the Brief is exactly as before', async (t) => {
  const a = await brief(t, 'prep/5v1');
  const without = a.html();
  const off = registerGuide(FIXTURE); t.after(off);
  a.app ?? null;
  const b = await brief(t, 'prep/5v1');
  assert.equal(b.html(), without);
});

test('the Brief: Game plan card (header, remember, bring, preview → lens 4, Read the full guide), pool dot, both sheets', async (t) => {
  t.after(registerGuide(FIXTURE));
  const app = await brief(t);
  await app.waitFor(() => /Game plan vs Ning · W2/.test(T(app)), 'the card', 20000);
  const h = T(app);
  assert.ok(!h.includes('Fixture guide for tests'), 'the assumptions are on the Guide tab, not the card');
  for (const s of ['Guide', 'Written 19 Oct', 'Remember', 'Lead Charizard + Kangaskhan.', '+ 1 more',
    'Bring', 'Mega: Charizard', 'Import as team', 'His preview shows…', 'Rillaboom + Gholdengo', 'Bring 4', 'T1 Heat Wave', 'Read the full guide ›',
    'His double-target KOs are in Can wreck you (1 from the guide).'])
    assert.ok(h.includes(s), s);
  // the short version: the in-game folds live on the Guide tab now
  for (const s of ['Leads and turn 1 (1)', 'Read his tells (1)', 'How we lose (1)', 'Our double KOs (1)']) assert.ok(!h.includes(s), `not on the card: ${s}`);
  assert.ok(btns(app, 'tab').some((b) => b.tab === 'guide'), 'the Read link and the Guide tab');
  assert.match(app.html(), /<a href="#prep\/5v2\/guide" class="gd-read-link" data-pa="tab" data-tab="guide"/);
  assert.ok(h.indexOf('Game plan vs Ning') < h.indexOf("Ning's pool"), 'first in the Brief');
  // numbers: a guide calc's range is a workbench link (a number without one is marked unchecked: see the Guide tab test)
  assert.ok(btns(app, 'guide-calc').some((b) => b.i === '0'), '80–95% links to its calc');
  // the pool card's G dot
  assert.match(app.html(), /aria-label="Rillaboom[^"]*guide note[^"]*"/);
  assert.match(app.html(), /class="gdot"/);
  // preview chip → the whole Brief's lens is those 4
  await app.click({ pa: 'guide-preview', i: '1' });
  assert.match(app.html(), /class="brief" data-lens="4"/);
  assert.ok(btns(app, 'brief-lens').some((b) => b.lens === '4'), 'the tray offers "Your 4"');
  // their sheet; our sheet
  await app.click({ pa: 'brief-open', side: 'their', n: '4' });
  assert.match(T(app), /Guide vs Ning ?Role: Rock coverage ?Worst case: Rock Slide OHKOs Charizard 200–240% › ?Answer: Protect/);
  await app.click({ pa: 'back' });
  await app.click({ pa: 'brief-open', side: 'your', n: '1' });
  assert.match(T(app), /Job: Sun sweeper ?Avoid: staying in vs Rock moves/);
  assert.match(T(app), /Calcs from the guide/);
});

test('"Can wreck you": the scan row the guide names gets the pill and answer (no duplicate); the guide-only double target comes first', async (t) => {
  t.after(registerGuide(FIXTURE));
  const app = await brief(t);
  await app.waitFor(() => /OHKO threat/.test(T(app)), 'the scan', 30000);
  const h = T(app);
  assert.match(h, /\d+ OHKO threats? · 1 double-target combo from the guide · tap any row to open it/);
  assert.ok(h.indexOf('Double-target KOs (from the guide)') < h.indexOf('OHKOs your Mega Charizard Y'), 'guide-only rows first');
  assert.match(h, /Rillaboom Wood Hammer › \+ Gholdengo Make It Rain › → your Kangaskhan 90–110%/);
  const guideOnly = h.slice(h.indexOf('Double-target KOs (from the guide)'), h.indexOf('OHKOs your Mega Charizard Y'));
  assert.ok(!/Lucario/.test(guideOnly), 'the matched calc is not repeated as a guide-only row');
  assert.match(h, /Lucario-Mega Rock Slide spread → your Charizard-Mega-Y[^]*?Guide Answer: Protect or switch/);
  // the lib merge, directly
  const g = validateGuide(FIXTURE, mech).guide;
  const rows = [{ species: 'lucario', move: 'rockslide', target: 'z', lo: 210, hi: 250 }, { species: 'lucario', move: 'closecombat', target: 'z', lo: 10, hi: 12 }];
  const m = mergeWreck(rows, g, () => 'charizard', base);
  assert.deepEqual([...m.values()].map((x) => x.answer), ['Protect or switch']);
});

test('workbench links: stated sets and field, the "now" line, Intimidate; a combo part opens its own hit', async (t) => {
  t.after(registerGuide(FIXTURE));
  const app = await brief(t);
  await app.waitFor(() => btns(app, 'guide-calc').length, 'links', 20000);
  await app.click({ pa: 'guide-calc', ...btns(app, 'guide-calc').find((c) => c.i === '0') });
  let h = app.html();
  assert.match(h, /Heat Wave: Charizard-Mega-Y → Ning&#39;s Gholdengo/);
  assert.match(h, /data-value="Sun"[^>]*aria-pressed="true"|aria-pressed="true"[^>]*data-value="Sun"/);
  assert.match(h, /data-key="lightScreen"[^>]*aria-pressed="true"|aria-pressed="true"[^>]*data-key="lightScreen"/);
  assert.match(h, /id="wb-theirs-spd"[^>]*value="32"/, 'their worst case as a defender: 32 SpD');
  await app.waitFor(() => /Guide: 80–95% · now/.test(T(app)) || /wb-result/.test(app.html()) && !/Calculating/.test(app.html().slice(app.html().indexOf('wb-result'), app.html().indexOf('wb-result') + 400)), 'the engine result', 20000);
  assert.match(T(app), /Guide: 80–95% · now [\d.]+–[\d.]+%( ✓| with your current Charizard-Mega-Y \(Timid 2 HP \/ 32 SpA\))/);
  assert.match(T(app), /as the guide assumed/);
  await app.click({ pa: 'wb-close' });
  // calc 1 (in "How we lose") is on the Guide tab
  await app.click({ pa: 'tab', tab: 'guide' });
  await app.waitFor(() => /Guide vs Ning/.test(T(app)), 'the Guide tab', 20000);
  await app.click({ pa: 'guide-calc', ...btns(app, 'guide-calc').find((c) => c.i === '1') });
  h = app.html();
  assert.match(h, /Rock Slide: Ning&#39;s Lucario → Charizard-Mega-Y/);
  assert.match(h, /data-n="1"[^>]*aria-pressed="true"|aria-pressed="true"[^>]*data-n="1"/, 'Intimidate −1');
  await app.click({ pa: 'wb-close' });
  const part = btns(app, 'guide-hit').find((b) => b.a === 'charizard' && b.m === 'heatwave');
  await app.click({ pa: 'guide-hit', ...part });
  assert.match(app.html(), /Heat Wave: Charizard-Mega-Y → Ning&#39;s Gholdengo/);
});

test('Import as team, then Update from guide: adds what is missing, never overwrites; "Use guide version" adds a version', async (t) => {
  t.after(registerGuide(FIXTURE));
  const storage = device();
  const app = await brief(t, 'prep/5v2', storage);
  await app.waitFor(() => /Import as team/.test(T(app)), 'the button', 20000);
  await app.click({ pa: 'guide-import', pov: '5', opp: '2', coach: 'Ning' });
  await flushSaves(app);
  let teams = JSON.parse(storage.getItem(KEYS.teams)).teams;
  const team = teams.find((x) => x.name === 'vs Ning (guide)');
  assert.equal(team.slots.length, 2);
  const sets = JSON.parse(storage.getItem(KEYS.mysets)).sets;
  assert.match(sets.find((s) => s.id === team.slots[0]).versions[0].reason, /from the Ning guide \(19 Oct\)/);
  assert.match(T(app), /Bring it vs Ning\?/);
  // edit one set (another nature): Update keeps it, the slot offers the guide's version
  const zard = team.slots[0];
  const lib = JSON.parse(storage.getItem(KEYS.mysets));
  // remove Kangaskhan from the team, change Charizard's nature: then Update
  await app.click({ pa: 'team-remove', set: team.slots[1] }); await flushSaves(app);
  const b = await bootApp({ mode: `prep/teams/${team.id}`, storage });
  t.after(() => b.restore());
  await b.waitFor(() => /tm-slot/.test(b.html()), 'the team', 20000);
  await b.changeData({ pc: 'set-field', set: zard, field: 'nature' }, { value: 'timid' });
  await b.click({ pa: 'set-save', set: zard }); await flushSaves(b);
  const c = await brief(t, 'prep/5v2', storage);
  await c.waitFor(() => /Update from guide/.test(T(c)), 'Update', 20000);
  const before = JSON.parse(storage.getItem(KEYS.mysets)).sets.length;
  await c.click({ pa: 'guide-update', pov: '5', opp: '2', coach: 'Ning' }); await flushSaves(c);
  teams = JSON.parse(storage.getItem(KEYS.teams)).teams;
  const t2 = teams.find((x) => x.id === team.id);
  assert.equal(t2.slots.length, 2, 'Kangaskhan added back');
  assert.ok(JSON.parse(storage.getItem(KEYS.mysets)).sets.length >= before, 'nothing deleted');
  const zl = JSON.parse(storage.getItem(KEYS.mysets)).sets.find((s) => s.id === zard);
  assert.equal(zl.versions.at(-1).data.nature, 'timid', 'your edit is not overwritten');
  assert.match(c.toast.textContent, /1 set differs from the guide/);
  await c.waitFor(() => /Guide differs/.test(c.html()), 'the team screen', 20000);
  assert.match(c.html(), /Guide differs: Modest/);
  await c.click({ pa: 'guide-use-version', set: zard, team: team.id }); await flushSaves(c);
  const z2 = JSON.parse(storage.getItem(KEYS.mysets)).sets.find((s) => s.id === zard);
  assert.deepEqual([z2.versions.at(-1).data.nature, z2.versions.at(-2).data.nature], ['modest', 'timid'], 'a new version; yours in history');
  void lib;
});

test('Plan board: "Guide lead for this · Fill" writes the picks; a board with picks shows "Guide differs" instead', async (t) => {
  t.after(registerGuide(FIXTURE));
  const app = await bootApp({ mode: 'prep/5v2/plan', storage: device() });
  t.after(() => app.restore());
  await app.waitFor(() => btns(app, 'pb-guide-fill').length || /pb-plans/.test(app.html()), 'the board', 20000);
  const fill = btns(app, 'pb-guide-fill');
  assert.ok(fill.length, 'the Fill row on the board');
  assert.match(T(app), /Guide lead for this: Charizard \+ Kangaskhan/);
  await app.click({ pa: 'pb-guide-fill', ...fill[0] }); await flushSaves(app);
  const ws = JSON.parse(app.storage.getItem(Object.keys(Object.fromEntries(app.storage.map)).find((k) => k.includes(WS))));
  const card = ws.cards.at(-1);
  assert.deepEqual(card.species.lead.sort(), ['charizard', 'kangaskhan']);
  assert.ok(!btns(app, 'pb-guide-fill').length, 'filled with the guide lead: nothing more to offer');
  // a board with other picks isn't overwritten: it offers "Guide differs · Use"
  await app.click({ pa: 'pb-remove', species: 'kangaskhan' }); await flushSaves(app);
  await app.click({ pa: 'pb-pick', species: 'sinistcha' }); await flushSaves(app);
  assert.match(T(app), /Guide differs: Charizard \+ Kangaskhan/);
});

test('teambuilder (Ning in scope): Guide box with notes (4 + more), calcs from your draft, "Guide runs …" and Try it; Move search sub-line', async (t) => {
  t.after(registerGuide(FIXTURE));
  const storage = device();
  const tb = await bootApp({ mode: `prep/my-sets/${SET_MINE}`, storage });
  t.after(() => tb.restore());
  await tb.waitFor(() => /tb-srow/.test(tb.html()), 'the editor', 20000);
  await tb.changeData({ pc: 'tb-scope' }, { value: 'Ning' });
  const h = T(tb);
  assert.match(h, /Guide vs Ning ?Job: Sun sweeper/);
  assert.match(h, /\+ 1 more/);
  assert.match(h, /Guide runs Modest/);
  assert.ok(btns(tb, 'guide-calc').some((b) => b.draft === SET_MINE), 'calcs use your draft');
  await tb.click({ pa: 'tb-guide-try', ...btns(tb, 'tb-guide-try')[0] }); await flushSaves(tb);
  const lib = JSON.parse(storage.getItem(KEYS.mysets));
  assert.equal(lib.drafts[SET_MINE].data.nature, 'modest', 'into the draft');
  assert.equal(lib.sets.find((s) => s.id === SET_MINE).currentV, 1, 'nothing saved');
  assert.match(T(tb), /vs A/, 'your set pinned as A');
  // Move search scoped to Ning: the guide sub-line and the strip
  const ms = await bootApp({ mode: 'prep/moves', storage });
  t.after(() => ms.restore());
  await ms.waitFor(() => /mv-text/.test(ms.html()), 'move search', 20000);
  await ms.changeData({ pc: 'mv-set', key: 'scope' }, { value: 'Ning' });
  await ms.input('mv-text', 'rock slide');
  await ms.waitFor(() => /Lucario/.test(T(ms)), 'results');
  assert.match(T(ms), /Guide: Rock Slide OHKOs Charizard/);
  assert.match(T(ms), /From the guide: Lucario Rock Slide → Charizard-Mega-Y 200–240%/);
});

test('Deep dive: a tab only when the guide has one; ranking, every six with paste, copy and import; ZhuZi\'s real deep dive validates', async (t) => {
  // the real Week 3 data: every six keeps its paste and leads, every calc survives validation
  const real = (await import('../lib/guides/5v3.mjs')).default;
  const { guide: rg } = validateGuide(real, mech);
  assert.equal(rg.deep.sixes.length, real.deep.sixes.length);
  assert.ok(rg.deep.sixes.every((s) => s.paste.includes('@')));
  assert.equal(rg.deep.calcs.length, real.deep.calcs.length);
  // the fixture has no deep dive: no tab
  t.after(registerGuide({ ...FIXTURE, deep: undefined }));
  const plain = await brief(t);
  assert.ok(!/id="ptab-deep"/.test(plain.html()), 'no Deep dive tab without data');
  plain.restore();
});

test('Deep dive tab renders with the fixture\'s deep data', async (t) => {
  const deep = {
    written: '2026-10-29', method: ['Fixture method'], caveats: ['Fixture caveat'],
    sixes: [
      { id: 'a', name: 'Your six', tag: 'yours', change: 'Mine.', paste: FIXTURE.sets, leads: [{ if: 'their 6 includes Rillaboom', bring4: ['charizard', 'kangaskhan', 'sinistcha', 'pelipper'], lead: ['charizard', 'kangaskhan'], fit: 'fitted: 3/4' }],
        results: { n: 960, zhuzi: 70, anti: { pct: 60, n: 300 }, rock: { pct: 55, n: 100 }, vsYours: null, vsYoursAnti: null } },
      { id: 'b', name: 'Other six', change: 'Other.', paste: FIXTURE.sets, leads: [],
        results: { n: 960, zhuzi: 75, anti: { pct: 50, n: 300 }, rock: null, vsYours: { d: 5, ci: 3, n: 960 }, vsYoursAnti: { d: -10, ci: 6, n: 300 } } },
    ],
    opponents: [{ id: 'z1', label: 'His goodstuffs', weight: 0.5, why: 'likely', anti: true, paste: FIXTURE.sets }],
    calcs: [{ attacker: { id: 'charizardmegay', set: 'ours' }, defender: { id: 'gholdengo', set: 'worst' }, move: 'heatwave', field: {}, range: '80–95%', verdict: '2HKO', why: '' }],
  };
  t.after(registerGuide({ ...FIXTURE, deep }));
  const storage = device();
  const app = await bootApp({ mode: 'prep/5v2/deep', storage });
  t.after(() => app.restore());
  await app.waitFor(() => /Deep dive vs Ning/.test(T(app)), 'the tab', 20000);
  const h = T(app);
  for (const s of ['Deep dive', 'The short version', 'Your six: 70.0% vs his likely sixes', 'Best vs his likely sixes: Other six (75.0%)', 'Ranking', '+5.0 ±3.0',
    'Leads (fitted in the sims)', 'Charizard + Kangaskhan', 'Copy paste', 'Import as team', "Ning's modelled sixes", 'His goodstuffs', '50% likely', 'Calcs for your six', '80–95%', 'How these numbers were made'])
    assert.ok(h.includes(s), s);
  assert.match(app.html(), /id="ptab-deep"[^>]*aria-current="page"/);
  assert.ok(btns(app, 'dd-copy').some((b) => b.kind === 'six' && b.six === 'b'));
  await app.click({ pa: 'dd-import', six: 'b' });
  await flushSaves(app);
  const all = JSON.parse(storage.getItem(KEYS.teams) ?? '{"teams":[]}').teams;
  const team = all.find((x) => x.name === 'Other six (vs Ning)');
  assert.equal(team?.slots.length, 2, 'imported as a team');
});

// ---------- schema v2: the long-form guide (overview, threats, team) and the Guide tab ----------
const V2 = {
  ...FIXTURE, version: 2,
  overview: {
    archetype: 'Grassy Terrain balance with Gholdengo',
    summary: ['Ning plays Rillaboom Fake Out into Gholdengo Make It Rain.', 'Milotic punishes our Intimidate.'],
    roster: [{ id: 'rillaboom', role: 'Fake Out + Grassy Glide', tier: 'core' }, { id: 'gholdengo', role: 'Make It Rain spam', tier: 'core' },
      { id: 'lucario', role: 'Rock coverage', tier: 'fringe' }, { id: 'milotic', role: 'Competitive', tier: 'sometimes' }, { id: 'nosuchmon', role: 'x', tier: 'core' }],
    likely: [{ label: 'Rillaboom balance', ids: ['rillaboom', 'gholdengo', 'milotic', 'lucario'], share: 'about 60%', note: 'Lead Charizard + Kangaskhan.' }, { label: 'empty', ids: ['nosuchmon'] }],
  },
  // calc 1 points at the Lucario calc; a dropped calc before it must not shift the index
  calcs: [{ attacker: { id: 'nosuchmon', set: 'ours' }, defender: { id: 'gholdengo', set: 'worst' }, move: 'heatwave', range: '1–2%' }, ...FIXTURE.calcs],
  threats: [{ id: 'lucario', title: 'Lucario: Rock Slide', why: 'Rock Slide OHKOs Charizard (200–240%).', answer: 'Protect turn 1.', calc: 2 },
    { id: 'rillaboom', title: 'Rillaboom: Fake Out', why: 'Fake Out every game.', calc: 0 }, { id: 'gholdengo', title: '', why: 'no title' }],
  team: {
    summary: ['Sun Charizard with Kangaskhan Fake Out.'], evidence: '70% of 400 engine games.',
    members: [{ id: 'charizard', role: 'Sun sweeper', why: 'Heat Wave 80–95% into Gholdengo.', spread: 'Modest 32 SpA / 32 Spe: outspeeds Rillaboom' },
      { id: 'kangaskhan', role: 'Fake Out', why: 'Parental Bond.' }, { id: 'nosuchmon', role: 'x' }],
  },
};

test('validation v2: overview, threats and team are normalised; bad entries dropped; threat calcs follow dropped calcs', () => {
  const { guide, problems } = validateGuide(V2, mech);
  assert.equal(guide.version, 2);
  assert.equal(guide.overview.archetype, 'Grassy Terrain balance with Gholdengo');
  assert.deepEqual(guide.overview.roster.map((r) => [r.id, r.tier]), [['rillaboom', 'core'], ['gholdengo', 'core'], ['lucario', 'fringe'], ['milotic', 'likely']], 'unknown tier → likely; unknown mon dropped');
  assert.deepEqual(guide.overview.likely.map((l) => l.label), ['Rillaboom balance']);
  assert.equal(guide.overview.likely[0].share, 'about 60%');
  assert.equal(guide.calcs.length, 2, 'the calc with an unknown mon is dropped');
  assert.deepEqual(guide.threats.map((t) => [t.id, t.calc]), [['lucario', 1], ['rillaboom', null]], 'raw calc 2 → 1; raw calc 0 was dropped → null; no title → dropped');
  assert.equal(guide.calcs[guide.threats[0].calc].attacker.id, 'lucario');
  assert.deepEqual(guide.team.members.map((m) => m.id), ['charizard', 'kangaskhan']);
  assert.equal(guide.team.evidence, '70% of 400 engine games.');
  for (const p of ['overview.roster[4] dropped', 'overview.likely[1] dropped', 'threats[2] dropped', 'threats calc 0 dropped', 'team.members[2] dropped']) assert.ok(problems.includes(p), p);
  // empty v2 blocks read as absent
  const bare = validateGuide({ version: 2, pov: 5, opp: 2, coach: 'Ning', overview: {}, team: { members: [] }, threats: 'no' }, mech).guide;
  assert.deepEqual([bare.overview, bare.team, bare.threats], [null, null, []]);
  // every real guide still validates
  for (const g of GUIDES) assert.ok(validateGuide(g, mech).guide, g.coach);
});

test('the Guide tab: every section in order with a table of contents; threats link their calcs; our six with sets; the Brief card is the short version', async (t) => {
  t.after(registerGuide(V2));
  const app = await bootApp({ mode: 'prep/5v2/guide', storage: device() });
  t.after(() => app.restore());
  await app.waitFor(() => /Guide vs Ning · W2/.test(T(app)), 'the Guide tab', 20000);
  const h = T(app), html = app.html();
  assert.match(html, /id="ptab-guide" data-pa="tab" data-tab="guide" aria-current="page"/);
  // sections in reading order, each in the table of contents
  const heads = ['Ning&#39;s team', 'Threats', 'Our team and why', 'Team preview and leads', 'Matchup notes', 'In the game', 'Assumptions and evidence'];
  const at = heads.map((x) => html.indexOf(`>${x}</h3>`));
  assert.ok(at.every((i) => i > 0), 'every section heading');
  assert.deepEqual([...at].sort((a, b) => a - b), at, 'in order');
  assert.deepEqual(btns(app, 'gp-jump').map((b) => b.to).slice(0, 7), ['gp-his', 'gp-threats', 'gp-team', 'gp-preview', 'gp-notes', 'gp-game', 'gp-evidence']);
  // 1) his team: archetype, summary, roster by tier, likely sixes
  for (const s of ['Grassy Terrain balance with Gholdengo', 'Ning plays Rillaboom Fake Out into Gholdengo Make It Rain.', 'Core: in almost every six', 'Fringe: watch for it',
    'Make It Rain spam', 'His likely sixes', 'Rillaboom balance', 'about 60%']) assert.ok(h.includes(s), s);
  // 2) threats ranked, the first one's calc is the Lucario calc
  assert.ok(h.indexOf('Lucario: Rock Slide') < h.indexOf('Rillaboom: Fake Out'), 'ranked');
  assert.ok(h.includes('Answer: Protect turn 1.'));
  const threatCalc = html.slice(html.indexOf('Lucario: Rock Slide'), html.indexOf('Rillaboom: Fake Out'));
  assert.match(threatCalc, /The calc: <button type="button" class="linkish gd-calc" data-pa="guide-calc"[^>]*data-i="1">Lucario Rock Slide → Charizard-Mega-Y 200–240% · OHKO ›/);
  // 3) our team: summary, evidence, members (role, why, spread, Showdown set), the Mega, the bench, Import
  for (const s of ['Sun Charizard with Kangaskhan Fake Out.', '70% of 400 engine games.', 'Sun sweeper', 'Spread: Modest 32 SpA / 32 Spe: outspeeds Rillaboom', 'Showdown set',
    'The Mega: Charizard sun beats Milotic', 'Left at home', 'no rain needed', 'Import as team']) assert.ok(h.includes(s), s);
  assert.match(html, /<pre tabindex="0">Charizard @ Charizardite Y\nAbility: Blaze/);
  assert.match(html, /<pre tabindex="0">Kangaskhan @ Kangaskhanite/);
  assert.match(html, /<h4>Charizard <span class="chip">Mega<\/span><\/h4>/);
  // 4) preview plans and leads; 5) their mons only; 6) in-game; 7) assumptions
  for (const s of ['Preview plans', 'If his preview shows Rillaboom + Gholdengo', 'Leads and turn 1', 'Use on Plan board', 'Worst case: Wood Hammer 35% on Charizard',
    'Read his tells', 'Heat Wave it turn 1', 'How we lose', 'Fix: Protect turn 1', 'Endgame', 'Keep Sinistcha for the end.', 'Our double KOs', 'His double KOs', 'third assumption'])
    assert.ok(h.includes(s), s);
  const notes = html.slice(html.indexOf('id="gp-notes"'), html.indexOf('id="gp-game"'));
  assert.ok(notes.includes('Rillaboom') && notes.includes('Lucario') && !notes.includes('Sun sweeper'), 'per-mon notes: theirs, not ours');
  assert.match(html, /class="gd-unchecked"[^>]*>50–60%/, 'a number without a calc is marked unchecked');
  // TOC jump, then the workbench from a threat
  await app.click({ pa: 'gp-jump', to: 'gp-threats' });
  await app.click({ pa: 'guide-calc', ...btns(app, 'guide-calc').find((c) => c.i === '1') });
  assert.match(app.html(), /Rock Slide: Ning&#39;s Lucario → Charizard-Mega-Y/);
  await app.click({ pa: 'wb-close' });
  // the Brief card: archetype, top threats, our six, remember, previews, Read the full guide
  await app.click({ pa: 'tab', tab: 'brief' });
  await app.waitFor(() => /Game plan vs Ning · W2/.test(T(app)), 'the card', 20000);
  const all = T(app);
  const card = all.slice(all.indexOf('Game plan vs Ning'), all.indexOf('His double-target KOs are in Can wreck you'));
  for (const s of ['Grassy Terrain balance with Gholdengo', 'Top threats', 'Lucario: Rock Slide', 'Rillaboom: Fake Out', 'Bring', 'Remember', 'His preview shows…', 'Read the full guide ›']) assert.ok(card.includes(s), s);
  assert.ok(card.indexOf('Top threats') < card.indexOf('Bring') && card.indexOf('Bring') < card.indexOf('Remember'), 'leads with archetype + threats + our six');
  await app.click({ pa: 'tab', tab: 'guide' });
  await app.waitFor(() => /Guide vs Ning · W2/.test(T(app)), 'back on the Guide tab', 20000);
});

test('the Guide tab: a v1 guide renders from its own fields; no Guide tab without a guide; #…/guide without one opens the Brief', async (t) => {
  const off = registerGuide(FIXTURE);
  const app = await bootApp({ mode: 'prep/5v2/guide', storage: device() });
  t.after(() => app.restore());
  await app.waitFor(() => /Guide vs Ning · W2/.test(T(app)), 'the Guide tab', 20000);
  const h = T(app);
  assert.ok(!h.includes('Ning\'s team') && !h.includes('Top threats'), 'no overview / threats sections for a v1 guide');
  for (const s of ['Our team and why', 'Sun sweeper', 'Avoid: staying in vs Rock moves', 'Team preview and leads', 'Matchup notes', 'In the game']) assert.ok(h.includes(s), s);
  off();
  const plain = await bootApp({ mode: 'prep/5v2/guide', storage: device() });
  t.after(() => plain.restore());
  await plain.waitFor(() => /Ning&#39;s pool|bs-pool/.test(plain.html()) && !/Opening your prep/.test(plain.html()), 'the Brief', 20000);
  assert.ok(!/id="ptab-guide"/.test(plain.html()), 'no Guide tab without a guide');
  assert.match(plain.html(), /id="ptab-brief"[^>]*aria-current="page"/);
});

test('the Guide tab renders the real Hex guide (5v1)', async (t) => {
  const raw = GUIDES.find((g) => g.pov === 5 && g.opp === 1);
  const g = validateGuide(raw, mech).guide;
  const app = await bootApp({ mode: 'prep/5v1/guide', storage: device() });
  t.after(() => app.restore());
  await app.waitFor(() => /Guide vs Hex/.test(T(app)), 'the Guide tab', 20000);
  const h = T(app);
  if (g.overview?.archetype) assert.ok(h.includes(g.overview.archetype), 'archetype');
  for (const x of g.threats) assert.ok(h.includes(x.title.slice(0, 20)), x.title);
  for (const x of g.team?.members ?? []) assert.ok(h.includes(x.role.slice(0, 20)), x.role);
  assert.ok(h.includes('Team preview and leads') && h.includes('Assumptions and evidence'));
  // Copy for Showdown: the guide's six as Showdown export text, straight to the clipboard
  await app.click({ pa: 'guide-copy', ...btns(app, 'guide-copy')[0] });
  await app.waitFor(() => app.clipboard.length > 0, 'copied', 5000);
  assert.equal(app.clipboard.at(-1), g.sets.trim() + '\n');
  assert.match(app.clipboard.at(-1), /^Charizard @ Charizardite Y[\s\S]*Conkeldurr @ Life Orb\nAbility: Guts/);
});

test('route: #prep/<p>v<o>/guide round-trips; guide is a read-only tab', () => {
  assert.deepEqual(parseRoute('#prep/5v1/guide'), { view: 'ws', pov: 5, opp: 1, tab: 'guide' });
  assert.equal(formatRoute({ view: 'ws', pov: 5, opp: 1, tab: 'guide' }), '#prep/5v1/guide');
  assert.ok(MATCH_TABS.indexOf('guide') === 1 && READ_TABS.includes('guide'));
});

test('guide prose ranges link to a calc when they state its range, rounded to the prose precision', async () => {
  const { sameRange } = await import('../public/prep-guide.js');
  assert.ok(sameRange('124.1–148.9%', '124.1–148.9%'));
  assert.ok(sameRange('124.1–148.9%', '124–149%'));
  assert.ok(!sameRange('124.1–148.9%', '124–150%'));
  assert.ok(!sameRange('70.3–83.2%', '70–84%'));
  assert.ok(!sameRange(undefined, '70–83%'));
});

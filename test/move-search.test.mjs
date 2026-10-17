// Move search (lib/move-search.mjs + public/prep-moves.js): full learnsets, not usage (the G2 lesson: Calvin's Tauros,
// Sheer Force Rock Slide, had no usage data); filters, ability synergy, scope, speed; the screen, its chip and workbench.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mech } from './calc-helpers.mjs';
import { bootApp, parseHtml, findAll, RAW } from './ui-harness.mjs';
import { device, T, btns } from './prep-helpers.mjs';
import { searchMoves, moveMatches, worstCaseAttacker } from '../lib/move-search.mjs';

const CALVIN = ['staraptor', 'grimmsnarl', 'empoleon', 'basculegionf', 'jolteon', 'volcarona', 'tsareena', 'mamoswine', 'tauros', 'swalot'].map((species) => ({ species, coach: 'Calvin' }));
const ALL = Object.keys(mech.species).filter((s) => mech.species[s].legal && !mech.species[s].mega).map((species) => ({ species }));

test('Rock Slide in Calvin\'s 10: Tauros (no usage data) is found, first, with Sheer Force flagged as the synergy', () => {
  const r = searchMoves(mech, CALVIN, { text: 'rock slide' });
  assert.deepEqual(r.map((x) => x.species), ['tauros', 'empoleon', 'mamoswine']);
  const tauros = r[0];
  assert.equal(tauros.synergy, true);
  assert.deepEqual(tauros.abilities.filter((a) => a.synergy.length).map((a) => a.id), ['sheerforce']);
  assert.deepEqual(tauros.moves.map((m) => [m.id, m.synergy]), [['rockslide', ['sheerforce']]]);
  // the worst case it would be calced at: Adamant 32 Atk, Sheer Force, Life Orb
  const w = worstCaseAttacker(mech, tauros, 'rockslide');
  assert.deepEqual([w.set.ability, w.set.item, w.set.nature, w.set.sp.atk], ['sheerforce', 'lifeorb', 'adamant', 32]);
});

test('filters: type, category, min power, spread / priority / contact / sound / secondary, ability; Megas keep the base learnset', () => {
  const rs = mech.moves.rockslide, fo = mech.moves.fakeout;
  assert.ok(moveMatches(rs, { type: 'Rock', flags: ['spread', 'secondary'] }) && !moveMatches(rs, { flags: ['contact'] }) && !moveMatches(rs, { minBP: 80 }));
  assert.ok(moveMatches(fo, { flags: ['priority', 'contact'] }) && moveMatches(fo, { category: 'Physical' }) && !moveMatches(fo, { category: 'Special' }));
  assert.ok(!moveMatches(mech.moves.protect, { category: 'damaging' }));
  assert.ok(moveMatches(mech.moves.hypervoice, { flags: ['sound', 'spread'] }));
  const sheer = searchMoves(mech, ALL, { text: 'rock slide', ability: 'Sheer Force' });
  assert.ok(sheer.length >= 3 && sheer.every((x) => x.abilities.some((a) => a.id === 'sheerforce')), 'only mons that can have Sheer Force');
  assert.ok(sheer.some((x) => x.species === 'tauros'));
  const tech = searchMoves(mech, ALL, { category: 'damaging', ability: 'technician' });
  assert.ok(tech.length && tech.every((x) => x.moves.filter((m) => m.synergy.includes('technician')).every((m) => mech.moves[m.id].basePower <= 60)), 'Technician synergy only on ≤ 60 BP');
  // Mega Charizard Y (Drought) is reachable through Charizard: its forms and abilities are listed
  const zard = searchMoves(mech, [{ species: 'charizard' }], { text: 'heat wave' })[0];
  assert.ok(zard.formes.includes('charizardmegay') && zard.abilities.some((a) => a.id === 'drought' && a.forme === 'charizardmegay'));
});

test('performance: a broad query over the whole regulation stays well under a frame', () => {
  const t0 = performance.now();
  for (let i = 0; i < 20; i++) searchMoves(mech, ALL, { type: 'Rock', category: 'damaging', flags: ['spread'] });
  assert.ok((performance.now() - t0) / 20 < 16, 'under 16 ms per query');
});

test('the screen: #prep/moves from Prep home and a matchup; type-to-search; scope; Tauros ★ Sheer Force; chip into your set → the workbench', async (t) => {
  const rows = RAW.draftsCsv.split('\n').map((r) => r.split(','));
  rows[6].splice(21, 3, '肯泰罗', 'Tauros', '2'); // Calvin drafts Tauros (as in the live league)
  const raw = { ...RAW, draftsCsv: rows.map((r) => r.join(',')).join('\n') };
  const app = await bootApp({ mode: 'prep/5', storage: device(), raw });
  t.after(() => app.restore());
  await app.waitFor(() => btns(app, 'go-moves').length > 0, 'the Prep home link', 20000);
  await app.click({ pa: 'go-moves' });
  assert.equal(app.location.hash, '#prep/moves');
  await app.waitFor(() => /Move search/.test(T(app)) && /mv-text/.test(app.html()), 'the screen', 20000);
  await app.changeData({ pc: 'mv-set', key: 'scope' }, { value: 'Calvin' });
  await app.input('mv-text', 'rock slide');
  await app.waitFor(() => /Tauros/.test(T(app)), 'results');
  const h = T(app);
  assert.match(h, /2 of 5 mons can learn it/, 'the fixture Calvin: Staraptor, Grimmsnarl, Empoleon, Basculegion-F + Tauros');
  assert.match(h, /Tauros Calvin · no usage data/);
  assert.match(h, /★ Sheer Force ×1\.3/);
  await app.waitFor(() => btns(app, 'mv-wb').length > 0, 'the worst-case chip', 20000);
  assert.match(T(app), /Rock Slide → your Charizard-Mega-Y: up to [\d.]+–[\d.]+%/);
  const chip = btns(app, 'mv-wb').find((b) => b.species === 'tauros');
  await app.click({ pa: 'mv-wb', ...chip });
  assert.ok(/role="dialog"/.test(app.html()), 'the workbench opens');
  assert.match(app.html(), /worst case: \+ nature, 32 SP, Life Orb/);
  await app.click({ pa: 'wb-close' });
  // scope: my 10 has no Tauros
  await app.changeData({ pc: 'mv-set', key: 'scope' }, { value: '__mine' });
  assert.ok(!/Tauros/.test(T(app)));
  // the matchup link opens it scoped to that opponent
  await app.click({ pa: 'go-home' });
  const b = await bootApp({ mode: 'prep/5v8', storage: device(), raw });
  t.after(() => b.restore());
  await b.waitFor(() => btns(b, 'go-moves').some((x) => x.scope === 'Calvin'), 'the matchup link', 20000);
  await b.click({ pa: 'go-moves', scope: 'Calvin' });
  assert.equal(findAll(parseHtml(b.html()), (n) => n.attrs.id === 'mv-scope')[0].children.find((o) => o.attrs?.selected !== undefined)?.attrs.value, 'Calvin');
});

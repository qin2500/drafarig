// Worst-case threat scan (lib/threat-scan.mjs) against VGC Strategy's goldens G1–G7 (docs/research/strategy/threat-scan.md
// §3): full learnsets × abilities × items × max offence, Anthony's match-plan sets (§1), the league's real pools.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mech, newCalc, set, engine } from './calc-helpers.mjs';
import { scanThreats, spreadDoubles, zardKOs, priorityKOs, topPerMon, threatsTo, plausibility, rosterFields, typeEffFrom } from '../lib/threat-scan.mjs';
import { bootApp, RAW } from './ui-harness.mjs';
import { device, T as TXT, btns, SET_MINE } from './prep-helpers.mjs';

const calc = newCalc();
const usage = JSON.parse(readFileSync(new URL('../docs/research/strategy/sp-assist/usage-regmc-2026-09-league.json', import.meta.url), 'utf8'));
const typeEff = typeEffFrom(engine);
const T = {
  zard: { key: 'zard', set: set('charizard', 'blaze', 'modest', { hp: 6, spa: 32, spd: 2, spe: 26 }, ['heatwave', 'weatherball', 'solarbeam', 'protect'], 'charizarditey') },
  rotom: { key: 'rotom', set: set('rotomfan', 'levitate', 'modest', { hp: 32, spa: 32, spd: 2 }, ['thunderbolt', 'airslash', 'willowisp', 'protect'], 'sitrusberry') },
  aegis: { key: 'aegis', set: set('aegislash', 'stancechange', 'brave', { hp: 32, atk: 32, def: 2 }, ['ironhead', 'poltergeist', 'kingsshield', 'wideguard'], 'metalcoat') },
  sinis: { key: 'sinis', set: set('sinistcha', 'hospitality', 'calm', { hp: 32, def: 2, spd: 32 }, ['matchagotcha', 'ragepowder', 'trickroom', 'protect'], 'cobaberry') },
};
const pool = (coach, ids) => ids.map((species) => ({ species, coach }));
const scan = (p, targets) => scanThreats(calc, mech, p, targets, { usage, typeEff });
const row = (rows, q) => rows.find((r) => Object.entries(q).every(([k, v]) => (k === 'weather' ? r.field.weather === v : r[k] === v)));

test('G1 / G2 / G7: Calvin — Tauros Sheer Force Life Orb Rock Slide OHKOs Mega Charizard Y, not a 32-HP Rotom-Fan; Mamoswine Icicle Crash OHKOs Rotom-Fan', () => {
  const rows = scan(pool('Calvin', ['tauros', 'mamoswine']), [T.zard, T.rotom]);
  const g1 = row(rows, { species: 'tauros', ability: 'sheerforce', item: 'lifeorb', move: 'rockslide', target: 'zard' });
  assert.deepEqual([g1.min, g1.max, g1.hp, g1.odds, g1.spread], [244, 291, 159, 1, true], 'G1');
  const g2 = row(rows, { species: 'tauros', ability: 'sheerforce', item: 'lifeorb', move: 'rockslide', target: 'rotom' });
  assert.deepEqual([g2.min, g2.max, g2.hp, g2.odds], [94, 112, 157, 0], 'G2');
  const g7 = row(rows, { species: 'mamoswine', item: 'lifeorb', move: 'iciclecrash', target: 'rotom' });
  assert.deepEqual([g7.min, g7.max, g7.hp, g7.odds], [198, 234, 157, 1], 'G7');
  // no usage data is no penalty: Tauros' Sheer Force Rock Slide is plausible enough to be shown, and ranks at the top
  assert.ok(g1.plausibility >= 0.6 && zardKOs(rows).some((r) => r.species === 'tauros' && r.move === 'rockslide'));
  assert.equal(topPerMon(rows).get('tauros')[0].target, 'zard');
});

test('G3: Hex — Kleavor Sheer Force Life Orb Rock Slide double-OHKOs Mega Charizard Y + Rotom-Fan', () => {
  const rows = scan(pool('Hex', ['kleavor']), [T.zard, T.rotom]);
  const z = row(rows, { species: 'kleavor', ability: 'sheerforce', item: 'lifeorb', move: 'rockslide', target: 'zard' });
  const r = row(rows, { species: 'kleavor', ability: 'sheerforce', item: 'lifeorb', move: 'rockslide', target: 'rotom' });
  assert.ok(z.lo >= 284 && z.hi <= 338 && z.odds === 1, `G3 Charizard ${z.lo}–${z.hi}`);
  assert.ok(Math.abs(r.lo - 110.8) < 0.15 && Math.abs(r.hi - 130.6) < 0.15 && r.odds === 1, `G3 Rotom ${r.lo}–${r.hi}`);
  const d = spreadDoubles(rows).find((x) => x.row.species === 'kleavor' && x.row.move === 'rockslide');
  assert.ok(d && ['rotom', 'zard'].every((k) => d.targets.some((t) => t.target === k)), 'flagged as a spread double KO');
});

test('G4: Jacky — Torkoal Drought Charcoal Modest Eruption in sun OHKOs Aegislash (Shield) and Sinistcha (Calm, Coba)', () => {
  const p = pool('Jacky', ['torkoal']);
  assert.ok(rosterFields(mech, p).some((f) => f.weather === 'Sun'), 'Drought on his roster: sun is scanned');
  const rows = scan(p, [T.aegis, T.sinis]);
  const a = row(rows, { species: 'torkoal', ability: 'drought', item: 'charcoal', move: 'eruption', target: 'aegis', weather: 'Sun' });
  const s = row(rows, { species: 'torkoal', ability: 'drought', item: 'charcoal', move: 'eruption', target: 'sinis', weather: 'Sun' });
  assert.deepEqual([a.min, a.max, a.hp, a.odds], [216, 254, 167, 1], 'G4 Aegislash');
  assert.deepEqual([s.min, s.max, s.hp, s.odds], [236, 278, 178, 1], 'G4 Sinistcha');
});

test('G5: Data — Mega Starmie Huge Power Aqua Jet in rain (Politoed) OHKOs Mega Charizard Y: a priority KO', () => {
  const rows = scan(pool('Data', ['starmie', 'politoed']), [T.zard]);
  const g = row(rows, { forme: 'starmiemega', move: 'aquajet', target: 'zard', weather: 'Rain' });
  assert.deepEqual([g.min, g.max, g.hp, g.odds, g.priority], [230, 272, 159, 1, true], 'G5');
  assert.ok(priorityKOs(rows).some((r) => r.forme === 'starmiemega' && r.move === 'aquajet'));
});

test('G6: Ning — Toucannon Skill Link Life Orb Rock Blast (5 hits) OHKOs Rotom-Fan; the teambuilder list for Rotom-Fan has it', () => {
  const rows = scan(pool('Ning', ['toucannon']), [T.rotom]);
  const g = row(rows, { species: 'toucannon', ability: 'skilllink', item: 'lifeorb', move: 'rockblast', target: 'rotom' });
  assert.deepEqual([g.min, g.max, g.hp], [195, 235, 157], 'G6');
  assert.ok(g.odds > 0.99, 'OHKO (the engine counts Sitrus between hits: a sliver under 1)');
  assert.ok(threatsTo(rows, 'rotom').some((r) => r.move === 'rockblast'));
});

test('plausibility (§2): ladder data vs none; no penalty for missing data', () => {
  // no data, STAB or synergy: 0.9 move × 1.0 synergy ability × 1.0 Life Orb
  assert.equal(plausibility(mech, { forme: 'tauros', moveId: 'rockslide', ability: 'sheerforce', item: 'lifeorb', mega: false, superEffective: true, u: null }), 0.9);
  assert.equal(Math.round(plausibility(mech, { forme: 'tauros', moveId: 'rockslide', ability: 'intimidate', item: 'lifeorb', mega: false, superEffective: false, u: null }) * 100) / 100, 0.56);
  // with data: a move used ≥ 5%, the top ability, an item used ≥ 5% = 1
  assert.equal(plausibility(mech, { forme: 'mamoswine', moveId: 'iciclecrash', ability: 'oblivious', item: 'focussash', mega: false, u: usage.species.mamoswine }), 1);
});

// ---------- the surfaces: the Brief's "Can wreck you" and the teambuilder's "Threats to this mon" ----------
const withTauros = () => { const rows = RAW.draftsCsv.split('\n').map((r) => r.split(',')); rows[6].splice(21, 3, '肯泰罗', 'Tauros', '2'); return { ...RAW, draftsCsv: rows.map((r) => r.join(',')).join('\n') }; };

test('Brief: "Can wreck you" lists Calvin\'s Tauros Rock Slide OHKOing your Mega Charizard Y, conditions labelled, worst case; tap → workbench', async (t) => {
  const app = await bootApp({ mode: 'prep/5v8', storage: device({ coach: 'Calvin' }), raw: withTauros() });
  t.after(() => app.restore());
  await app.waitFor(() => /OHKOs your Mega Charizard Y/.test(TXT(app)), 'the section', 30000);
  const h = TXT(app);
  assert.match(h, /Can wreck you/);
  assert.match(h, /Tauros Rock Slide spread → your Charizard-Mega-Y: [\d.]+–[\d.]+% · OHKO/);
  assert.match(h, /if Sheer Force \+ Life Orb, in sun \(yours\) · Worst case \(learnset\)/);
  const b = btns(app, 'tw-wb').find((x) => x.forme === 'tauros' && x.move === 'rockslide');
  await app.click({ pa: 'tw-wb', ...b });
  assert.ok(/role="dialog"/.test(app.html()), 'the workbench');
});

test('teambuilder: "Threats to this mon" for your Charizard set includes the Tauros Rock Slide, scoped to Calvin', async (t) => {
  const app = await bootApp({ mode: `prep/my-sets/${SET_MINE}`, storage: device({ coach: 'Calvin' }), raw: withTauros() });
  t.after(() => app.restore());
  await app.waitFor(() => /Threats to this mon/.test(TXT(app)), 'the list', 30000);
  await app.changeData({ pc: 'tb-scope' }, { value: 'Calvin' });
  await app.waitFor(() => /Threats to this mon \(Calvin/.test(TXT(app)) && /Rock Slide/.test(TXT(app)), 'Calvin', 30000);
  assert.match(TXT(app), /Calvin Tauros Rock Slide spread → your Charizard-Mega-Y/);
});

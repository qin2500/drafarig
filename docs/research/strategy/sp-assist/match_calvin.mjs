// Match prep, Anthony vs Calvin: damage, survive and Speed numbers from the app's own engine (lib/calc + lib/prep-build,
// the vendored @smogon/calc 0.12.0 with the Champions projection). Writes ../match-calvin-calcs.md and .json.
//
//   node docs/research/strategy/sp-assist/match_calvin.mjs
//
// Calvin: ladder usage sets (usage-regmc-2026-09-league.json: top spread, top item and ability, moves ≥ 15%); Tauros has no
// usage data, so its moves are a guess and its SP is a frail / max range. Anthony: the sets in benchmarks-league.md
// (ASSUMED there), moves from his forms' usage or a stated guess. Field: doubles, spread moves ×0.75 (both foes in), the
// app's Auto weather (Mega Charizard Y's Drought sun, Pelipper's Drizzle rain), no screens, crits, Intimidate or items
// beyond the ones listed.
import { readFileSync, writeFileSync } from 'node:fs';
import * as engine from '../../../../public/vendor/smogon-calc-0.12.0.mjs';
import { loadMechanics, toID } from '../../../../lib/calc/mech.mjs';
import { createCalc } from '../../../../lib/calc/wrapper.mjs';
import { normalizeScenario } from '../../../../lib/calc/scenario.mjs';
import { surviveSearch } from '../../../../lib/calc/threshold.mjs';
import { STAT_IDS, statValue, natureSign } from '../../../../lib/calc/stats.mjs';
import * as B from '../../../../lib/prep-build.mjs';

const HERE = new URL('./', import.meta.url);
const ROOT = new URL('../../../../', import.meta.url);
const raw = JSON.parse(readFileSync(new URL('data/mechanics.json', ROOT), 'utf8'));
// Stunfisk-Galar's only ability, Mimicry, only changes its type under a terrain (none here), and the app's calc refuses
// it outright. For THIS script only it is calced with Run Away (no battle effect), which is the same numbers without terrain.
raw.species.stunfiskgalar = { ...raw.species.stunfiskgalar, abilities: ['Run Away'] };
const mech = loadMechanics(raw);
const calc = createCalc(engine, mech);
const usageRaw = JSON.parse(readFileSync(new URL('usage-regmc-2026-09-league.json', HERE), 'utf8')).species;
// the slimmed table as lib/prep-build's commonHits reads it: [[name, pct]] lists, highest first
const sorted = (o) => Object.entries(o ?? {}).sort((a, b) => b[1] - a[1]);
const usage = (f) => (usageRaw[f] ? { spreads: sorted(usageRaw[f].spreads), items: sorted(usageRaw[f].items), abilities: sorted(usageRaw[f].abilities), moves: sorted(usageRaw[f].moves) } : null);
const sp6 = (s) => { const v = s.split('/').map(Number); return Object.fromEntries(STAT_IDS.map((k, i) => [k, v[i]])); };
const nm = { mon: (id) => mech.species[id]?.name ?? id, move: (id) => mech.moves[id]?.name ?? id, item: (id) => mech.items[id]?.name ?? id, nature: (id) => mech.natures[id]?.name ?? id };

// ---------- Anthony (benchmarks-league.md sets; moves: usage ≥ 15% damaging + setup, or a guess) ----------
const mine = [
  { key: 'charizard', label: 'Mega Charizard Y', set: { species: 'charizard', item: 'charizarditey', ability: 'blaze', nature: 'timid', sp: sp6('2/0/0/32/0/32'), moves: ['heatwave', 'weatherball', 'solarbeam', 'protect'] }, mega: true, basis: 'modal usage spread; moves from usage' },
  { key: 'sinistcha', label: 'Sinistcha', set: { species: 'sinistcha', item: 'sitrusberry', ability: 'hospitality', nature: 'bold', sp: sp6('32/0/14/0/20/0'), moves: ['matchagotcha', 'shadowball', 'ragepowder', 'trickroom'] }, basis: 'modal usage spread; moves from usage' },
  { key: 'pelipper', label: 'Pelipper', set: { species: 'pelipper', item: 'focussash', ability: 'drizzle', nature: 'modest', sp: sp6('2/0/0/32/0/32'), moves: ['hurricane', 'weatherball', 'tailwind', 'wideguard'] }, basis: 'top usage spread (Focus Sash: survives any one full-HP hit)' },
  { key: 'kangaskhan', label: 'Mega Kangaskhan', set: { species: 'kangaskhan', item: 'kangaskhanite', ability: 'scrappy', nature: 'brave', sp: sp6('32/32/1/0/1/0'), moves: ['fakeout', 'doubleedge', 'icepunch', 'suckerpunch', 'hammerarm'] }, mega: true, basis: 'modal usage spread; moves from usage (5 listed)' },
  { key: 'aegislash', label: 'Aegislash', set: { species: 'aegislash', item: 'lifeorb', ability: 'stancechange', nature: 'adamant', sp: sp6('2/32/0/0/0/32'), moves: ['ironhead', 'poltergeist', 'shadowsneak', 'kingsshield'] }, basis: 'modal usage spread; Blade forme when attacking' },
  { key: 'morpeko', label: 'Morpeko', set: { species: 'morpeko', item: 'focussash', ability: 'hungerswitch', nature: 'jolly', sp: sp6('2/32/0/0/0/32'), moves: ['aurawheel', 'fakeout', 'partingshot', 'protect'] }, basis: 'modal usage spread (Full Belly Aura Wheel: Electric)' },
  { key: 'conkeldurr', label: 'Conkeldurr', set: { species: 'conkeldurr', item: 'lifeorb', ability: 'ironfist', nature: 'brave', sp: sp6('32/32/0/0/2/0'), moves: ['drainpunch', 'machpunch', 'thunderpunch', 'knockoff', 'icepunch'] }, basis: 'modal usage spread; moves from usage (5 listed)' },
  { key: 'rotomfan', label: 'Rotom-Fan', set: { species: 'rotomfan', item: 'lifeorb', ability: 'levitate', nature: 'modest', sp: sp6('32/0/0/32/2/0'), moves: ['thunderbolt', 'airslash', 'voltswitch', 'nastyplot'] }, basis: 'GUESS: the O2 build in rotom-fan-case.md (no usage data)' },
  { key: 'stunfiskgalar', label: 'Stunfisk-Galar', set: { species: 'stunfiskgalar', item: 'sitrusberry', ability: 'runaway', nature: 'brave', sp: sp6('32/32/2/0/0/0'), moves: ['stompingtantrum', 'earthquake', 'rockslide', 'protect'] }, basis: 'GUESS: Trick Room tank (no usage data). Mimicry calced as no effect (no terrain; the app refuses Mimicry, so this script uses Run Away)' },
  { key: 'simipour', label: 'Simipour', set: { species: 'simipour', item: 'mysticwater', ability: 'torrent', nature: 'modest', sp: sp6('2/0/0/32/0/32'), moves: ['hydropump', 'scald', 'icebeam', 'nastyplot'] }, basis: 'GUESS: no usage data' },
];

// ---------- Calvin (ladder usage per form; Mega Staraptor its own row) ----------
const calvinForms = [['staraptor', 'staraptor'], ['staraptor', 'staraptormega'], ['grimmsnarl', 'grimmsnarl'], ['empoleon', 'empoleon'], ['basculegionf', 'basculegionf'], ['jolteon', 'jolteon'],
  ['volcarona', 'volcarona'], ['tsareena', 'tsareena'], ['mamoswine', 'mamoswine'], ['tauros', 'tauros'], ['swalot', 'swalot']];
const theirs = calvinForms.map(([sp, forme]) => {
  const c = B.commonHits(mech, sp, forme, usage(forme));
  if (c) {
    const s = c.spreads[0];
    return { key: forme, species: sp, forme, mega: c.mega, label: `${nm.mon(forme)}${forme === 'staraptor' ? ' (Scarf)' : ''}`,
      set: { species: sp, item: c.item, ability: c.ability, nature: s.nature, sp: s.sp, moves: c.moves }, spreads: c.spreads, unknown: false,
      basis: `ladder: ${nm.nature(s.nature)} ${STAT_IDS.map((k) => s.sp[k]).join('/')} (${Math.round(s.w * 100)}% of its top 3), ${nm.item(c.item) || 'no item'}, usage ${usageRaw[forme].usage}%` };
  }
  // no usage data: Tauros (base). A guess, with their SP as a range (frail … max)
  return { key: forme, species: sp, forme, mega: false, label: nm.mon(forme), unknown: true,
    set: { species: sp, item: 'lifeorb', ability: 'intimidate', nature: 'adamant', sp: 'unknown', moves: ['doubleedge', 'closecombat', 'rockslide', 'highhorsepower'] },
    basis: 'GUESS: no usage data; Adamant Life Orb Intimidate, Double-Edge / Close Combat / Rock Slide / High Horsepower; SP unknown → frail…max range' };
});

// ---------- runs ----------
const row = (t) => ({ key: t.key, species: t.species, forme: t.forme, mega: t.mega, set: t.set, common: null });
const weatherFor = (m, t) => B.autoWeather(mech, m.set, row(t)).weather || '';
const pct = (n, d) => Math.floor((1000 * n) / d) / 10;
const odds = (k) => { if (String(k.den) === '16') return `${k.num}/16`; const p = (100 * Number(k.num)) / Number(k.den); return p < 1 ? '<1%' : `${Math.round(p)}%`; };
function verdict(r, sash) {
  const one = r.ko.one, two = r.ko.two;
  if (one.num === one.den) return 'OHKO';
  if (one.num !== '0') return `${odds(one)} OHKO`;
  const held = sash && r.range.max >= r.maxHP ? ' (Focus Sash holds)' : '';
  if (!two || two.refused !== undefined) return held ? held.trim() : 'no KO in 2';
  if (two.num === two.den) return `2HKO${held}`;
  if (two.num !== '0') return `${odds(two)} 2HKO${held}`;
  return `3HKO+${held}`;
}
/** One hit; with an unknown-SP side, the frail and max ends (a range). */
function hit(attacker, defender, move, { field = {}, aBoost = 0, aMega = false, dMega = false } = {}) {
  const st = B.moveStats(mech, move);
  const sc = normalizeScenario({
    // a usage form can list more than 4 common moves: each side carries at most 4 (the attacker: this move)
    attacker: { set: { ...attacker, moves: [move], gender: '' }, state: { mega: aMega, boosts: st && aBoost ? { [st.atk]: aBoost } : {} } },
    defender: { set: { ...defender, moves: defender.moves.slice(0, 4), gender: '' }, state: { mega: dMega } }, move: { id: move }, field,
  });
  const ends = [];
  const side = attacker.sp === 'unknown' ? 'attacker' : defender.sp === 'unknown' ? 'defender' : null;
  for (const k of side ? ['frail', 'max'] : [null]) {
    const s = side ? calc.spreadFor(sc, side, k, {}) : null;
    const x = structuredClone(sc);
    if (s) { x[side].set.sp = s.sp; x[side].set.nature = s.nature; }
    const r = calc.run(x);
    if (r.class === 'no-damage') return { immune: true };
    if (r.class !== 'exact') return { refused: r.code ?? r.class };
    ends.push({ end: k, lo: pct(r.range.min, r.maxHP), hi: pct(r.range.max, r.maxHP), min: r.range.min, max: r.range.max, hp: r.maxHP, v: verdict(r, defender.item === 'focussash'), r, sc: x });
  }
  const lo = Math.min(...ends.map((e) => e.lo)), hi = Math.max(...ends.map((e) => e.hi));
  // the verdict for a range: the worse end for the defender (max-attack / frail-defence) is the headline
  const worst = side === 'attacker' ? ends.at(-1) : side === 'defender' ? ends[0] : ends[0];
  const v = side ? `frail: ${ends[0].v}, max: ${ends[1].v}` : ends[0].v;
  return { lo, hi, v, range: !!side, ends, sc: worst.sc };
}
const cell = (h) => (h.immune ? 'immune' : h.refused ? `n/a (${h.refused})` : `${h.lo}–${h.hi}%${h.range ? ' (frail…max)' : ''} · ${h.v}`);

// OFFENSE: each of Anthony's damaging moves into each Calvin form (+0, and at the setup stage when the set has one)
const offense = mine.map((m) => {
  const atks = B.myAttacks(mech, m.set);
  const targets = theirs.map((t) => {
    const field = weatherFor(m, t) ? { weather: weatherFor(m, t) } : {};
    const moves = atks.map((mv) => {
      const h = hit(m.set, t.set, mv, { field, aMega: !!m.mega, dMega: t.mega });
      const su = B.setupIn(m.set, B.moveStats(mech, mv)?.atk);
      const boosted = su ? hit(m.set, t.set, mv, { field, aBoost: su.stage, aMega: !!m.mega, dMega: t.mega }) : null;
      return { move: mv, ...strip(h), boosted: boosted ? { stage: su.stage, by: su.move, ...strip(boosted) } : null };
    }).sort((a, b) => (b.hi ?? -1) - (a.hi ?? -1));
    return { target: t.key, label: t.label, weather: field.weather ?? '', moves, best: moves[0]?.hi ?? 0 };
  }).sort((a, b) => b.best - a.best);
  return { mon: m.key, label: m.label, targets };
});
function strip(h) { const { sc, ends, ...rest } = h; return rest; }

// DEFENSE: each Calvin form's strongest 1–2 hits into each of Anthony's mons; SP to survive every roll (current nature,
// within the SP the set's other stats leave; else with the defence-raising nature; else can't)
const defense = mine.map((m) => {
  const rows = theirs.map((t) => {
    const field = weatherFor(m, t) ? { weather: weatherFor(m, t) } : {};
    const hits = B.theirAttacks(mech, row(t)).map((mv) => ({ mv, h: hit(t.set, m.set, mv, { field, aMega: t.mega, dMega: !!m.mega }) }))
      .filter((x) => !x.h.refused).sort((a, b) => (b.h.hi ?? -1) - (a.h.hi ?? -1)).slice(0, 2);
    return { attacker: t.key, label: t.label, weather: field.weather ?? '', hits: hits.map(({ mv, h }) => ({ move: mv, ...strip(h), survive: h.immune ? null : surviveNeed(m, h) })), top: hits[0]?.h.hi ?? 0 };
  }).sort((a, b) => b.top - a.top);
  return { mon: m.key, label: m.label, rows };
});
function surviveNeed(m, h) {
  if (h.immune || h.refused) return null;
  const res = surviveSearch(calc, mech, h.sc);
  if (res.refused) return { refused: res.refused };
  const lv = res.levels.find((l) => l.key === 'every-roll');
  const pick = lv.keep ?? lv.change;
  const survivesNow = h.ends.every((e) => e.r.ko.one.num === '0');
  if (!pick) return { stat: res.stat, cant: true, survivesNow, budget: res.budget };
  return { stat: res.stat, hp: pick.h, def: pick.d, nature: pick.nature, natureChange: pick.nature !== m.set.nature, survivesNow, budget: res.budget, already: survivesNow };
}
const surviveText = (s, m) => {
  if (!s) return '';
  if (s.refused) return `n/a (${s.refused})`;
  const S = { def: 'Def', spd: 'SpD' }[s.stat] ?? s.stat;
  if (s.cant) return `can't survive within ${s.budget} free SP`;
  if (s.already) return s.hp + s.def > 0 ? `survives as is (least: ${s.natureChange ? `${nm.nature(s.nature)} ` : ''}${s.hp} HP / ${s.def} ${S})` : 'survives as is';
  return `${s.natureChange ? `${nm.nature(s.nature)} ` : ''}${s.hp} HP / ${s.def} ${S}`;
};

// SPEED: Lv 50 tiers and the sets' own Speeds
const speedOf = (set, forme, mega) => { const f = mega ? B.myForme(mech, set) : forme; return set.sp === 'unknown' ? null : statValue('spe', mech.species[f].baseStats.spe, set.sp.spe ?? 0, natureSign(mech.natures[set.nature], 'spe')); };
const speed = [
  ...mine.map((m) => { const f = B.myForme(mech, m.set); const s = speedOf(m.set, f, true); return { side: 'Anthony', mon: m.key, label: m.label, base: mech.species[f].baseStats.spe, set: s, setNote: `${nm.nature(m.set.nature)} ${m.set.sp.spe} Spe`, tiers: B.speedTiers(mech.species[f].baseStats.spe) }; }),
  ...theirs.map((t) => { const s = speedOf(t.set, t.forme, false); const scarf = t.set.item === 'choicescarf'; return { side: 'Calvin', mon: t.key, label: t.label, base: mech.species[t.forme].baseStats.spe, set: s === null ? null : scarf ? Math.floor(s * 1.5) : s, setNote: s === null ? 'unknown' : `${nm.nature(t.set.nature)} ${t.set.sp.spe} Spe${scarf ? ' + Scarf' : ''}`, tiers: B.speedTiers(mech.species[t.forme].baseStats.spe) }; }),
].sort((a, b) => (b.set ?? b.tiers.maxNeutral) - (a.set ?? a.tiers.maxNeutral));

// ---------- write ----------
const date = new Date().toISOString().slice(0, 10);
const json = { generated: date, engine: '@smogon/calc 0.12.0 via lib/calc (Champions projection data/mechanics.json)', assumptions: {
  field: 'doubles; spread moves ×0.75; Auto weather (Mega Charizard Y sun, Pelipper rain); no screens, crits, Intimidate, Helping Hand',
  anthony: mine.map((m) => ({ mon: m.key, set: m.set, basis: m.basis })), calvin: theirs.map((t) => ({ form: t.key, set: t.set, basis: t.basis })) }, offense, defense, speed };
writeFileSync(new URL('../match-calvin-calcs.json', HERE), `${JSON.stringify(json, null, 1)}\n`);

const L = [];
L.push(`# Anthony vs Calvin: calcs`, '', `Generated ${date} by \`sp-assist/match_calvin.mjs\` with the app's own engine (@smogon/calc 0.12.0 via lib/calc). Data: \`match-calvin-calcs.json\`.`, '');
L.push('**Assumptions (read first)**', '');
L.push('- **Calvin:** ladder usage sets (Sept 2026, ≥ 1760): top spread, top item and ability, moves used by ≥ 15%. Not his real sets. Tauros has no usage data: guessed moves, SP as a frail…max range.');
L.push('- **Anthony:** the sets in `benchmarks-league.md` (assumed there). Rotom-Fan, Stunfisk-Galar and Simipour are guesses. Re-run with your real sets if they differ.');
L.push('- **Field:** doubles, spread moves ×0.75. Mega Charizard Y\'s sun and Pelipper\'s rain apply to their own rows. No screens (Grimmsnarl sets them), crits, Intimidate (Staraptor/Tauros have it), Helping Hand or Tailwind unless stated.');
L.push('- **Verdict:** OHKO / n/16 OHKO / 2HKO over the 16 rolls. "Survive" = the HP + Def/SpD SP that takes the hit every roll, within the SP the set\'s other stats leave free.', '');
L.push('## Speed (Lv 50)', '', '| Mon | Side | Set Speed | Tiers: max+ / neutral / 0 SP |', '|---|---|---|---|');
for (const s of speed) L.push(`| ${s.label} | ${s.side} | ${s.set ?? '?'} (${s.setNote}) | ${s.tiers.maxPlus} / ${s.tiers.maxNeutral} / ${s.tiers.uninvested} |`);
L.push('', '- **Tailwind** doubles Speed for 4 turns: Calvin\'s Mega Staraptor (69% run it) and Volcarona (36%); Anthony\'s Pelipper. Scarf Staraptor is listed with Scarf.', '- **Trick Room** (Sinistcha): slowest first. Calvin\'s slow side is Mamoswine / Swalot / Grimmsnarl; Anthony\'s is Conkeldurr, Stunfisk-Galar, Brave Kangaskhan.', '');
L.push('## Offense: Anthony into Calvin', '', 'Best two moves per target, sorted by the best hit. Setup stage in brackets where the set has one.', '');
for (const o of offense) {
  L.push(`### ${o.label}`, '', '| Target | Best hits |', '|---|---|');
  for (const t of o.targets) L.push(`| ${t.label}${t.weather ? ` (${t.weather.toLowerCase()})` : ''} | ${t.moves.slice(0, 2).map((x) => `${nm.move(x.move)} ${cell(x)}${x.boosted ? ` [+${x.boosted.stage}: ${cell(x.boosted)}]` : ''}`).join('<br>')} |`);
  L.push('');
}
L.push('## Defense: Calvin into Anthony', '', 'Each Calvin mon\'s strongest 1–2 hits, worst first. "Survive" is what Anthony\'s mon needs to take it every roll.', '');
for (const d of defense) {
  const m = mine.find((x) => x.key === d.mon);
  L.push(`### ${d.label}${m.set.item === 'focussash' ? ' (Focus Sash: survives any one hit from full HP)' : ''}`, '', '| Attacker | Hit | Survive |', '|---|---|---|');
  for (const r of d.rows) for (const [i, h] of r.hits.entries()) L.push(`| ${i ? '' : `${r.label}${r.weather ? ` (${r.weather.toLowerCase()})` : ''}`} | ${nm.move(h.move)} ${cell(h)} | ${surviveText(h.survive, m)} |`);
  L.push('');
}
L.push('## Sets used', '', '| Mon | Set | Basis |', '|---|---|---|');
for (const m of mine) L.push(`| ${m.label} | ${nm.nature(m.set.nature)} ${STAT_IDS.map((k) => m.set.sp[k]).join('/')} @ ${nm.item(m.set.item)}; ${m.set.moves.map(nm.move).join(', ')} | ${m.basis} |`);
for (const t of theirs) L.push(`| Calvin's ${t.label} | ${t.set.sp === 'unknown' ? 'SP unknown' : `${nm.nature(t.set.nature)} ${STAT_IDS.map((k) => t.set.sp[k]).join('/')}`} @ ${nm.item(t.set.item) || 'no item'}; ${t.set.moves.map(nm.move).join(', ')} | ${t.basis} |`);
writeFileSync(new URL('../match-calvin-calcs.md', HERE), `${L.join('\n')}\n`);
console.log('wrote match-calvin-calcs.md / .json');

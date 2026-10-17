// Anthony vs Calvin, part 2: screens / Intimidate, Volcarona after Quiver Dance, and double-target totals, with the app's
// engine and Anthony's MATCH sets (match-calvin.md §5). Writes ../match-calvin-calcs2.md.
//   node docs/research/strategy/sp-assist/match_calvin2.mjs
// Calvin: ladder usage sets for his likely 6 (as in match_calvin.mjs). Doubles; spread moves ×0.75 (both targets in).
import { readFileSync, writeFileSync } from 'node:fs';
import * as engine from '../../../../public/vendor/smogon-calc-0.12.0.mjs';
import { loadMechanics } from '../../../../lib/calc/mech.mjs';
import { createCalc } from '../../../../lib/calc/wrapper.mjs';
import { normalizeScenario } from '../../../../lib/calc/scenario.mjs';
import { STAT_IDS } from '../../../../lib/calc/stats.mjs';
import * as B from '../../../../lib/prep-build.mjs';

const HERE = new URL('./', import.meta.url), ROOT = new URL('../../../../', import.meta.url);
const mech = loadMechanics(JSON.parse(readFileSync(new URL('data/mechanics.json', ROOT), 'utf8')));
const calc = createCalc(engine, mech);
const U = JSON.parse(readFileSync(new URL('usage-regmc-2026-09-league.json', HERE), 'utf8')).species;
const sorted = (o) => Object.entries(o ?? {}).sort((a, b) => b[1] - a[1]);
const usage = (f) => (U[f] ? { spreads: sorted(U[f].spreads), items: sorted(U[f].items), abilities: sorted(U[f].abilities), moves: sorted(U[f].moves) } : null);
const sp6 = (s) => { const v = s.split('/').map(Number); return Object.fromEntries(STAT_IDS.map((k, i) => [k, v[i]])); };
const N = (id) => mech.species[id]?.name ?? mech.moves[id]?.name ?? id;

// Anthony's match sets (match-calvin.md §5)
const A = {
  zard: { set: { species: 'charizard', item: 'charizarditey', ability: 'blaze', nature: 'modest', sp: sp6('6/0/0/32/2/26'), moves: ['heatwave', 'weatherball', 'solarbeam', 'protect'] }, mega: true, label: 'Mega Charizard Y' },
  morpeko: { set: { species: 'morpeko', item: 'focussash', ability: 'hungerswitch', nature: 'jolly', sp: sp6('2/32/0/0/0/32'), moves: ['fakeout', 'aurawheel', 'taunt', 'protect'] }, label: 'Morpeko' },
  aegis: { set: { species: 'aegislash', item: 'metalcoat', ability: 'stancechange', nature: 'brave', sp: sp6('32/32/2/0/0/0'), moves: ['ironhead', 'poltergeist', 'kingsshield', 'wideguard'] }, label: 'Aegislash' },
  rotom: { set: { species: 'rotomfan', item: 'sitrusberry', ability: 'levitate', nature: 'modest', sp: sp6('32/0/0/32/2/0'), moves: ['thunderbolt', 'airslash', 'willowisp', 'protect'] }, label: 'Rotom-Fan' },
  sinis: { set: { species: 'sinistcha', item: 'cobaberry', ability: 'hospitality', nature: 'calm', sp: sp6('32/0/2/0/32/0'), moves: ['matchagotcha', 'ragepowder', 'trickroom', 'protect'] }, label: 'Sinistcha' },
  conk: { set: { species: 'conkeldurr', item: 'lifeorb', ability: 'ironfist', nature: 'brave', sp: sp6('32/32/0/0/2/0'), moves: ['drainpunch', 'machpunch', 'thunderpunch', 'protect'] }, label: 'Conkeldurr' },
};
// Calvin's likely 6 (ladder sets)
const C = Object.fromEntries([['rap', 'staraptor', 'staraptormega'], ['grimm', 'grimmsnarl', 'grimmsnarl'], ['volc', 'volcarona', 'volcarona'], ['basc', 'basculegionf', 'basculegionf'], ['mamo', 'mamoswine', 'mamoswine'], ['tsar', 'tsareena', 'tsareena']].map(([k, sp, f]) => {
  const c = B.commonHits(mech, sp, f, usage(f)); const s = c.spreads[0];
  return [k, { set: { species: sp, item: c.item, ability: c.ability, nature: s.nature, sp: s.sp, moves: c.moves.slice(0, 4) }, mega: c.mega, label: N(f), basis: `${s.nature} ${STAT_IDS.map((x) => s.sp[x]).join('/')} @ ${N(c.item) || c.item}` }];
}));

/** One hit: {lo, hi (% of max HP), min, max, hp, one (OHKO odds), v}. o: {weather, screen: 'light'|'reflect', intim, boost, crit} */
function hit(a, d, move, o = {}) {
  const st = B.moveStats(mech, move);
  const r = calc.run(normalizeScenario({
    attacker: { set: { ...a.set, moves: [move] }, state: { mega: !!a.mega, intimidated: o.intim ?? 0, boosts: o.boost && st ? { [st.atk]: o.boost } : {} } },
    defender: { set: { ...d.set, moves: d.set.moves.slice(0, 4) }, state: { mega: !!d.mega } }, move: { id: move },
    field: { ...(o.weather ? { weather: o.weather } : {}), defenderSide: { ...(o.screen === 'light' ? { lightScreen: true } : {}), ...(o.screen === 'reflect' ? { reflect: true } : {}) } },
  }));
  if (r.class === 'no-damage') return { immune: true, lo: 0, hi: 0, min: 0, max: 0, hp: 1 };
  if (r.class !== 'exact') return { refused: r.code ?? r.class, lo: 0, hi: 0, min: 0, max: 0, hp: 1 };
  const p = (n) => Math.floor((1000 * n) / r.maxHP) / 10, one = r.ko.one;
  const v = one.num === one.den ? 'OHKO' : one.num !== '0' ? `${String(one.den) === '16' ? `${one.num}/16` : `${Math.round((100 * one.num) / one.den)}%`} OHKO` : 'no OHKO';
  return { lo: p(r.range.min), hi: p(r.range.max), min: r.range.min, max: r.range.max, hp: r.maxHP, v: d.set.item === 'focussash' && one.num === '0' && r.range.max >= r.maxHP ? 'Sash holds' : v };
}
const f = (h) => (h.immune ? 'immune' : h.refused ? `n/a (${h.refused})` : `${h.lo}–${h.hi}% ${h.v}`);
const zardSun = (atk) => (atk === A.zard ? 'Sun' : '');
const L = [];
const date = new Date().toISOString().slice(0, 10);
L.push('# Anthony vs Calvin: calcs, part 2', '', `Generated ${date} by \`sp-assist/match_calvin2.mjs\` (app engine, @smogon/calc 0.12.0). Anthony: the MATCH sets in \`match-calvin.md\` §5. Calvin: ladder sets for his likely 6 (${Object.values(C).map((c) => `${c.label} ${c.basis}`).join('; ')}). Doubles: spread moves ×0.75, screens at the doubles ×2732/4096. Sun only where Mega Charizard Y is the attacker or stated. No crits.`, '');

// (a) our key hits: plain / with the matching screen / Intimidate −1 (physical)
const keys = [['zard', 'heatwave', 'rap'], ['zard', 'heatwave', 'grimm'], ['zard', 'weatherball', 'rap'], ['zard', 'weatherball', 'volc'], ['zard', 'solarbeam', 'basc'], ['zard', 'heatwave', 'mamo'], ['zard', 'heatwave', 'tsar'],
  ['rotom', 'thunderbolt', 'rap'], ['rotom', 'thunderbolt', 'volc'], ['rotom', 'thunderbolt', 'basc'], ['rotom', 'airslash', 'tsar'],
  ['morpeko', 'aurawheel', 'rap'], ['morpeko', 'aurawheel', 'basc'], ['aegis', 'ironhead', 'grimm'], ['aegis', 'ironhead', 'mamo'], ['aegis', 'poltergeist', 'basc'], ['aegis', 'ironhead', 'tsar'],
  ['conk', 'drainpunch', 'mamo'], ['conk', 'drainpunch', 'grimm'], ['conk', 'machpunch', 'rap'], ['conk', 'thunderpunch', 'rap'], ['sinis', 'matchagotcha', 'basc'], ['sinis', 'matchagotcha', 'mamo']];
L.push('## (a) Our key hits through screens and Intimidate', '', '| Hit | Plain | Screen up | Intimidate −1 |', '|---|---|---|---|');
const outA = [];
for (const [a, mv, d] of keys) {
  const atk = A[a], def = C[d], phys = mech.moves[mv].category === 'Physical', w = zardSun(atk);
  const plain = hit(atk, def, mv, { weather: w }), scr = hit(atk, def, mv, { weather: w, screen: phys ? 'reflect' : 'light' });
  const intim = phys ? hit(atk, def, mv, { weather: w, intim: 1 }) : null, both = phys ? hit(atk, def, mv, { weather: w, intim: 1, screen: 'reflect' }) : null;
  outA.push({ attacker: a, move: mv, target: d, plain, screen: scr, intimidate: intim, both });
  L.push(`| ${atk.label} ${N(mv)} → ${def.label}${w ? ' (sun)' : ''} | ${f(plain)} | ${phys ? 'Reflect' : 'Light Screen'}: ${f(scr)} | ${phys ? `${f(intim)}; + Reflect: ${f(both)}` : '—'} |`);
}

// (b) Volcarona after Quiver Dance (+1 / +2 SpA), sun and no weather
L.push('', '## (b) Volcarona after Quiver Dance into our 6', '', 'Quiver Dance also raises its SpD and Speed; only the SpA stage is in these numbers.', '', '| Target | Move | +1 no weather | +1 sun | +2 no weather | +2 sun |', '|---|---|---|---|---|---|');
const outB = [];
for (const k of Object.keys(A)) for (const mv of ['heatwave', 'overheat', 'bugbuzz']) {
  const cells = [[1, ''], [1, 'Sun'], [2, ''], [2, 'Sun']].map(([b, w]) => hit(C.volc, A[k], mv, { boost: b, weather: w }));
  outB.push({ target: k, move: mv, cells });
  L.push(`| ${A[k].label} | ${N(mv)} | ${cells.map(f).join(' | ')} |`);
}

// (c) their double targets into each of our 6 (both hits land; no Sitrus / Coba between them)
const pairsC = [['Rap Brave Bird + Volcarona Heat Wave', ['rap', 'bravebird'], ['volc', 'heatwave']], ['Rap Close Combat + Mamoswine Icicle Crash', ['rap', 'closecombat'], ['mamo', 'iciclecrash']],
  ['Mamoswine Rock Slide + Ice Shard (two Mamoswine moves: two turns, or two Mamoswine)', ['mamo', 'rockslide'], ['mamo', 'iceshard']], ['Basculegion Shadow Ball + Grimmsnarl Spirit Break', ['basc', 'shadowball'], ['grimm', 'spiritbreak']]];
const total = (h1, h2) => { const lo = Math.round((h1.lo + h2.lo) * 10) / 10, hi = Math.round((h1.hi + h2.hi) * 10) / 10; const hp = [h1, h2].find((h) => !h.immune && !h.refused)?.hp; const ko = !hp ? 'no damage' : h1.min + h2.min >= hp ? 'always KOs' : h1.max + h2.max >= hp ? 'can KO' : 'never KOs'; return { lo, hi, ko }; };
L.push('', '## (c) Their double targets into each of our 6', '', 'Sum of both hits (rolls added; berries and Sash not counted between hits: Sash breaks on the first). Mamoswine has Rock Slide in 18% of sets.', '');
const outC = [];
for (const [name, [a1, m1], [a2, m2]] of pairsC) {
  L.push(`**${name}**`, '', '| Target | Hit 1 | Hit 2 | Total | KO? |', '|---|---|---|---|---|');
  for (const k of Object.keys(A)) {
    const h1 = hit(C[a1], A[k], m1), h2 = hit(C[a2], A[k], m2), t = total(h1, h2);
    outC.push({ pair: name, target: k, h1, h2, total: t });
    L.push(`| ${A[k].label} | ${f(h1)} | ${f(h2)} | ${t.lo}–${t.hi}% | ${t.ko} |`);
  }
  L.push('');
}

// (d) our double targets
const pairsD = [['Charizard Heat Wave + Rotom Thunderbolt', ['zard', 'heatwave'], ['rotom', 'thunderbolt']], ['Charizard Heat Wave + Morpeko Aura Wheel', ['zard', 'heatwave'], ['morpeko', 'aurawheel']],
  ['Charizard Weather Ball + Rotom Thunderbolt', ['zard', 'weatherball'], ['rotom', 'thunderbolt']], ['Charizard Heat Wave + Aegislash Iron Head', ['zard', 'heatwave'], ['aegis', 'ironhead']],
  ['Rotom Thunderbolt + Morpeko Aura Wheel', ['rotom', 'thunderbolt'], ['morpeko', 'aurawheel']], ['Conkeldurr Drain Punch + Aegislash Iron Head', ['conk', 'drainpunch'], ['aegis', 'ironhead']]];
L.push('## (d) Our double targets into Calvin\'s 6', '', 'Charizard\'s hits in sun (Drought); the partner\'s too (sun stays up). Spread Heat Wave ×0.75.', '');
const outD = [];
for (const [name, [a1, m1], [a2, m2]] of pairsD) {
  L.push(`**${name}**`, '', '| Target | Hit 1 | Hit 2 | Total | KO? |', '|---|---|---|---|---|');
  for (const k of Object.keys(C)) {
    const w = a1 === 'zard' || a2 === 'zard' ? 'Sun' : '';
    const h1 = hit(A[a1], C[k], m1, { weather: w }), h2 = hit(A[a2], C[k], m2, { weather: w }), t = total(h1, h2);
    outD.push({ pair: name, target: k, h1, h2, total: t });
    L.push(`| ${C[k].label} | ${f(h1)} | ${f(h2)} | ${t.lo}–${t.hi}% | ${t.ko} |`);
  }
  L.push('');
}
writeFileSync(new URL('../match-calvin-calcs2.md', HERE), `${L.join('\n')}\n`);
writeFileSync(new URL('../match-calvin-calcs2.json', HERE), `${JSON.stringify({ generated: date, anthony: A, calvin: C, screensIntimidate: outA, quiverDance: outB, theirDoubles: outC, ourDoubles: outD }, null, 1)}\n`);
console.log('wrote match-calvin-calcs2.md / .json');

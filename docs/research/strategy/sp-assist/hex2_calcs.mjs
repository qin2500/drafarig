// Hex round 2: every allowed mon of ours (hex2.json sets) vs Kleavor and Rotom-Heat (hex.json sets), both directions,
// in the app engine. Writes ../hex2-calcs.md.   node docs/research/strategy/sp-assist/hex2_calcs.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import * as engine from '../../../../public/vendor/smogon-calc-0.12.0.mjs';
import { loadMechanics } from '../../../../lib/calc/mech.mjs';
import { createCalc } from '../../../../lib/calc/wrapper.mjs';
import { normalizeScenario } from '../../../../lib/calc/scenario.mjs';
import { setsFromText, statsOf } from '../../../../tools/sim/ai/data.mjs';

const ROOT = new URL('../../../../', import.meta.url);
const mech = loadMechanics(JSON.parse(readFileSync(new URL('data/mechanics.json', ROOT), 'utf8')));
const calc = createCalc(engine, mech);
const C = JSON.parse(readFileSync(new URL('tools/sim/candidates/hex2.json', ROOT), 'utf8'));
const N = (id) => mech.species[id]?.name ?? mech.moves[id]?.name ?? mech.items[id]?.name ?? id;
const teamSets = (id) => setsFromText([...C.ours.teams, ...C.opponent.teams].find((t) => t.id === id).team);

// our sets: package A (nA01 has Charizard..Morpeko; nA28 has Sinistcha..Rotom-Fan), B (classic), C (Scarf Pelipper)
const OURS = new Map();
for (const id of ['nA01', 'nA28', 'nB01', 'nB28', 'nC01']) for (const s of teamSets(id)) {
  const k = `${N(s.species)} (${N(s.item)}${s.ability === 'guts' ? ', Guts' : ''}: ${s.moves.map(N).join(' / ')})`;
  if (!OURS.has(k)) OURS.set(k, s);
}
const THEIRS = {};
for (const [id, sp] of [['h02', 'kleavor'], ['h04', 'kleavor'], ['h14', 'kleavor'], ['h05', 'kleavor'], ['h01', 'rotomheat'], ['h13', 'rotomheat']]) {
  const s = teamSets(id).find((x) => x.species === sp);
  THEIRS[`${N(sp)} (${N(s.item)}, ${s.ability}: ${s.moves.map(N).join(' / ')})`] = s;
}
const MEGA = (s) => !!mech.items[s.item]?.megaStone;
function hit(a, d, move, weather = '') {
  const r = calc.run(normalizeScenario({ attacker: { set: { ...a, moves: [move] }, state: { mega: MEGA(a) } }, defender: { set: { ...d, moves: d.moves.slice(0, 4) }, state: { mega: MEGA(d) } }, move: { id: move }, field: { weather } }));
  if (r.class === 'no-damage') return 'immune';
  if (r.class !== 'exact') return null;
  const p = (n) => Math.floor((1000 * n) / r.maxHP) / 10, one = r.ko.one, two = r.ko.two;
  const sash = d.item === 'focussash' && r.range.max >= r.maxHP;
  const odds = (k) => (String(k.den) === '16' ? `${k.num}/16` : `${Math.round((100 * k.num) / k.den)}%`);
  let v = one.num === one.den ? 'OHKO' : one.num !== '0' ? `${odds(one)} OHKO` : two && two.refused === undefined ? (two.num === two.den ? '2HKO' : two.num !== '0' ? `${odds(two)} 2HKO` : '3HKO+') : '';
  if (sash && r.range.min >= r.maxHP) v = 'KO, but Sash holds from full';
  else if (sash) v += ' (Sash holds from full)';
  return `${p(r.range.min)}–${p(r.range.max)}% ${v}`.trim();
}
const dmg = (s) => s.moves.filter((m) => mech.moves[m]?.category !== 'Status' && !['fakeout'].includes(m));
const wx = (a) => (a.species === 'pelipper' ? ['Rain'] : a.species === 'charizard' ? ['Sun'] : ['', 'Rain']);
const spe = (s) => statsOf(s, MEGA(s)).spe;

const L = ['# Hex round 2: our allowed mons vs Kleavor and Rotom-Heat', '',
  `Generated ${new Date().toISOString().slice(0, 10)} by \`sp-assist/hex2_calcs.mjs\` (app engine, Level 50, single target, no crits or screens). Our sets: \`gen_hex2.py\`; his: \`gen_hex.py\` (ladder sets). Mega Kangaskhan and Mega Charizard Y as Megas; Charizard's hits in sun, Pelipper's in rain. Speeds are without Tailwind / Scarf boosts unless the item is Scarf.`, ''];
L.push('## Speed', '', '| Pokémon | Speed |', '|---|---|');
for (const [k, s] of [...OURS, ...Object.entries(THEIRS)]) L.push(`| ${k} | ${spe(s)}${s.item === 'choicescarf' ? ` (${Math.floor(spe(s) * 1.5)} scarfed)` : ''} |`);
for (const [tk, t] of Object.entries(THEIRS)) {
  L.push('', `## Into ${tk}`, '', '| Ours | Move | Weather | Damage |', '|---|---|---|---|');
  for (const [ok, o] of OURS) for (const m of dmg(o)) for (const w of wx(o)) { const r = hit(o, t, m, w); if (r) L.push(`| ${ok.split(' (')[0]} | ${N(m)} | ${w || '—'} | ${r} |`); }
  L.push('', `## ${tk.split(' (')[0]} into us`, '', '| His move | Into | Weather | Damage |', '|---|---|---|---|');
  for (const m of dmg(t)) for (const [ok, o] of OURS) for (const w of ['', 'Rain', 'Sun']) {
    if (w && !((w === 'Rain' && /overheat|flamethrower|heatwave/.test(m)) || (w === 'Sun' && /overheat/.test(m)))) continue;
    const r = hit(t, o, m, w); if (r) L.push(`| ${N(m)} | ${ok} | ${w || '—'} | ${r} |`);
  }
}
writeFileSync(new URL('../hex2-calcs.md', import.meta.url), L.join('\n') + '\n');
console.log(L.length, 'lines');

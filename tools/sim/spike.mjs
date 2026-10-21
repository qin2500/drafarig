// Step 1 spike: validate both teams in the Champions Reg M-C format, play one full random-vs-random doubles game through
// BattleStream, and compare stats and one damage roll with the app engine. Run: node tools/sim/spike.mjs
import { createRequire } from 'node:module';
import { anthonyTeam, zhuziTeams } from './teams.mjs';
import { mech, newCalc } from '../../test/calc-helpers.mjs';
import { setStats } from '../../lib/calc/mech.mjs';
import { normalizeScenario } from '../../lib/calc/scenario.mjs';

const require = createRequire(import.meta.url);
const PS = new URL('./vendor/pokemon-showdown/dist/sim/', import.meta.url).pathname;
const { BattleStream, getPlayerStreams, Teams, TeamValidator, Dex, Battle } = require(`${PS}index.js`);
const { RandomPlayerAI } = require(`${PS}tools/random-player-ai.js`);
export const FORMAT = 'gen9championsvgc2026regmc';

const us = anthonyTeam(), them = zhuziTeams()[0].text;
console.log('ZhuZi team (generated A):\n' + them + '\n');

// 1. format + validation
const format = Dex.formats.get(FORMAT);
console.log('format', format.id, format.exists, 'mod', format.mod, 'gameType', format.gameType);
const v = TeamValidator.get(FORMAT);
for (const [who, text] of [['Anthony', us], ['ZhuZi', them]]) console.log(`validate ${who}:`, v.validateTeam(Teams.import(text)) ?? 'OK');

// 2. one battle, random vs random
async function game(p1team, p2team, seed) {
  const streams = getPlayerStreams(new BattleStream());
  const p1 = new RandomPlayerAI(streams.p1, { seed: [seed, 1, 2, 3], mega: 0.7 }), p2 = new RandomPlayerAI(streams.p2, { seed: [seed, 4, 5, 6], mega: 0.7 });
  void p1.start(); void p2.start();
  let log = '', winner = null, turns = 0;
  const done = (async () => { for await (const chunk of streams.omniscient) { log += chunk + '\n'; const w = chunk.match(/\|win\|(.+)/); if (w) winner = w[1]; if (/\|tie/.test(chunk)) winner = 'tie'; const t = [...chunk.matchAll(/\|turn\|(\d+)/g)].at(-1); if (t) turns = +t[1]; } })();
  void streams.omniscient.write(`>start ${JSON.stringify({ formatid: FORMAT, seed: [seed, 7, 8, 9] })}\n>player p1 ${JSON.stringify({ name: 'Anthony', team: Teams.pack(Teams.import(p1team)) })}\n>player p2 ${JSON.stringify({ name: 'ZhuZi', team: Teams.pack(Teams.import(p2team)) })}`);
  await done;
  return { winner, turns, log };
}
const g = await game(us, them, 11);
console.log('\nbattle: winner', g.winner, 'turns', g.turns);
console.log('brought:', [...g.log.matchAll(/\|switch\|(p[12][ab]): [^|]+\|([^|,]+)/g)].map((m) => `${m[1]} ${m[2]}`).filter((x, i, a) => a.indexOf(x) === i).join(', '));
console.log('megas:', [...g.log.matchAll(/\|-mega\|([^|]+)\|([^|]+)/g)].map((m) => m[1]).join(', ') || 'none');
console.log('errors:', [...g.log.matchAll(/\|error\|(.+)/g)].map((m) => m[1]).slice(0, 5).join(' / ') || 'none');

// 3. parity: stats and a damage roll (Mega Charizard Y Heat Wave → Mega Metagross, sun, spread)
const zard = Teams.import(us)[0];
const gross = { name: 'Metagross', species: 'Metagross', item: 'Metagrossite', ability: 'Clear Body', moves: ['Psychic Fangs', 'Protect'], nature: 'Jolly', evs: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 }, ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 50 };
const filler = Teams.import(us).slice(1, 4);
const b = new Battle({ formatid: FORMAT, seed: [1, 2, 3, 4] });
b.setPlayer('p1', { team: [zard, ...filler] });
b.setPlayer('p2', { team: [gross, ...Teams.import(them).filter((s) => !/metagross/i.test(s.species)).slice(0, 3)] });
b.makeChoices('team 1234', 'team 1234');
const [cz] = b.p1.active, [mg] = b.p2.active;
b.actions.runMegaEvo(cz); b.actions.runMegaEvo(mg);
const psStats = (p) => ({ hp: p.maxhp, ...p.storedStats });
const ours = (set) => setStats(mech, set, { megaEvolved: true });
const zSet = { species: 'charizard', item: 'charizarditey', ability: 'blaze', nature: 'modest', moves: ['heatwave'], sp: { hp: 6, atk: 0, def: 0, spa: 32, spd: 2, spe: 26 } };
const mSet = { species: 'metagross', item: 'metagrossite', ability: 'clearbody', nature: 'jolly', moves: ['psychicfangs'], sp: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 } };
console.log('\nstats PS  Mega Zard Y', psStats(cz), '\nstats app Mega Zard Y', ours(zSet));
console.log('stats PS  Mega Metagross', psStats(mg), '\nstats app Mega Metagross', ours(mSet));
b.field.setWeather('sunnyday');
const rolls = [];
for (let i = 0; i < 4000; i++) { const mv = b.dex.getActiveMove('heatwave'); mv.spreadHit = true; mv.willCrit = false; b.sentLogPos = b.log.length; const d = b.actions.getDamage(cz, mg, mv); if (typeof d === 'number') rolls.push(d); }
const pct = (n) => Math.floor((1000 * n) / mg.maxhp) / 10;
console.log(`PS  Heat Wave → Mega Metagross (sun, spread): ${Math.min(...rolls)}–${Math.max(...rolls)} HP = ${pct(Math.min(...rolls))}–${pct(Math.max(...rolls))}% (no crits, 4000 samples)`);
const r = newCalc().run(normalizeScenario({ attacker: { set: zSet, state: { mega: true } }, defender: { set: mSet, state: { mega: true } }, move: { id: 'heatwave' }, field: { weather: 'Sun' } }));
console.log(`app Heat Wave → Mega Metagross: ${r.range?.min}–${r.range?.max} HP of ${r.maxHP} = ${pct(r.range?.min)}–${pct(r.range?.max)}% (${r.class})`);

// more cases, each in a fresh battle: [attacker set, defender set, move, { mega: [a, d], weather, spread }]
const toPS = (s) => ({ name: s.species, species: s.species, item: s.item, ability: s.ability, nature: s.nature, moves: s.moves, evs: s.sp, ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 50 });
function psRange(a, d, move, { mega = [false, false], weather = null, spread = false } = {}) {
  const bb = new Battle({ formatid: FORMAT, seed: [5, 6, 7, 8] });
  const pad = Teams.import(us).filter((s) => ![a.species, d.species].includes(s.species.toLowerCase())).slice(0, 3);
  const pad2 = Teams.import(them).filter((s) => ![a.species, d.species].includes(s.species.toLowerCase().replace(/[^a-z]/g, ''))).slice(0, 3);
  bb.setPlayer('p1', { team: [toPS(a), ...pad] }); bb.setPlayer('p2', { team: [toPS(d), ...pad2] });
  bb.makeChoices('team 1234', 'team 1234');
  const [x] = bb.p1.active, [y] = bb.p2.active;
  if (mega[0]) bb.actions.runMegaEvo(x);
  if (mega[1]) bb.actions.runMegaEvo(y);
  if (weather) bb.field.setWeather(weather);
  const rs = [];
  for (let i = 0; i < 3000; i++) { const mv = bb.dex.getActiveMove(move); mv.spreadHit = spread; mv.willCrit = false; bb.sentLogPos = bb.log.length; const dmg = bb.actions.getDamage(x, y, mv); if (typeof dmg === 'number') rs.push(dmg); }
  return [Math.min(...rs), Math.max(...rs), y.maxhp];
}
const S = (species, item, ability, nature, sp, moves) => ({ species, item, ability, nature, moves, sp: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, ...sp } });
const kanga = S('kangaskhan', 'lifeorb', 'scrappy', 'adamant', { hp: 32, atk: 32 }, ['lastresort']);
const krook = S('krookodile', 'choicescarf', 'intimidate', 'adamant', { hp: 2, atk: 32, spe: 32 }, ['rockslide']);
const ape = S('infernape', 'focussash', 'blaze', 'hasty', { hp: 0, spa: 32, spe: 32 }, ['heatwave']);
const aegis = S('aegislash', 'metalcoat', 'stancechange', 'brave', { hp: 32, atk: 32, def: 2 }, ['poltergeist']);
const pult = S('dragapult', 'lifeorb', 'clearbody', 'modest', { hp: 2, spa: 32, spe: 32 }, ['shadowball']);
const cases = [
  ['Kangaskhan Last Resort → Infernape', kanga, ape, 'lastresort', {}],
  ['Krookodile Rock Slide (spread) → Mega Charizard Y', krook, zSet, 'rockslide', { mega: [false, true], spread: true }],
  ['Mega Metagross Psychic Fangs → Kangaskhan', { ...mSet, moves: ['psychicfangs'] }, kanga, 'psychicfangs', { mega: [true, false] }],
  ['Dragapult Shadow Ball → Aegislash (Shield)', pult, aegis, 'shadowball', {}],
];
for (const [label, a, d, move, o] of cases) {
  const [lo, hi, hp] = psRange(a, d, move, o);
  const rr = newCalc().run(normalizeScenario({ attacker: { set: a, state: { mega: !!o.mega?.[0] } }, defender: { set: d, state: { mega: !!o.mega?.[1] } }, move: { id: move }, field: o.weather ? { weather: o.weather } : {} }));
  const same = rr.class === 'exact' && rr.range.min === lo && rr.range.max === hi && rr.maxHP === hp;
  console.log(`${same ? 'MATCH' : 'DIFF '} ${label}: PS ${lo}–${hi}/${hp}, app ${rr.range?.min}–${rr.range?.max}/${rr.maxHP} (${rr.class}${rr.code ? ` ${rr.code}` : ''})`);
}

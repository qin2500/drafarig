// ZhuZi sixes aimed at Calvin, for the Week 4 mock (Anthony pilots ZhuZi vs Calvin). Built only from ZhuZi's drafted 10 and
// the sets of his candidate library (zhuzi.json teams, built by gen_candidates.py: every set checked for legality), so the
// mock stays faithful to his roster. The 24 existing candidates (built vs Anthony) are screened too; these add the
// Calvin-specific ideas: bulky Intimidate vs his physical attackers, Rock moves vs Volcarona / Staraptor, Electric vs
// Basculegion / Staraptor, Taunt vs Grimmsnarl, Trick Room vs his Tailwind.
//   node tools/sim/candidates/zhuzi-vs-calvin/build.mjs  → zc-*.txt + index.json
import { readFileSync, writeFileSync } from 'node:fs';
import { PS, FORMAT } from '../../ai/data.mjs';

const C = JSON.parse(readFileSync(new URL('../zhuzi.json', import.meta.url), 'utf8'));
// set key -> set object, from the candidate teams (each team lists its set keys in team order)
const LIB = new Map();
for (const t of C.opponent.teams) PS.Teams.import(t.team).forEach((s, i) => LIB.set(t.sets[i], s));
const TEAMS = [
  ['zc-1', 'Bulky offense: Intimidate Krookodile + Rotom-Wash Will-O-Wisp vs his physical attackers', ['meta_mega', 'rotomw', 'krook_bulk', 'tox_scarf', 'nape', 'pult']],
  ['zc-2', 'Rock-heavy: Life Orb Krookodile Rock Slide / Stone Edge vs Volcarona and Staraptor, Oranguru Trick Room vs Tailwind', ['meta_mega', 'rotomw', 'krook_lo', 'tox_scarf', 'nape', 'oran']],
  ['zc-3', 'Anti-screens: Umbreon Taunt + Scarf Rotom-Wash', ['meta_mega', 'rotomw_scarf', 'krook_bulk', 'tox', 'nape', 'umb_supp']],
  ['zc-4', 'Fairy check: Florges for Grimmsnarl / Mamoswine', ['meta_mega', 'rotomw', 'krook_scarf', 'tox', 'florges', 'nape']],
  ['zc-5', 'Rock Slide Metagross + Trick Room mode', ['meta_mega_rock', 'rotomw', 'krook_bulk', 'tox_scarf', 'pult', 'oran']],
];
const v = PS.TeamValidator.get(FORMAT);
const dir = new URL('./', import.meta.url);
const index = [];
for (const [id, label, keys] of TEAMS) {
  const team = keys.map((k) => { const s = LIB.get(k); if (!s) throw new Error(`${id}: no set ${k}`); return structuredClone(s); });
  const probs = v.validateTeam(team);
  if (probs?.length) throw new Error(`${id}: ${probs.join(' | ')}`);
  writeFileSync(new URL(`${id}.txt`, dir), PS.Teams.export(team));
  index.push({ id, label, sets: keys });
}
writeFileSync(new URL('index.json', dir), JSON.stringify({ written: new Date().toISOString(), teams: index }, null, 1));
console.log(`${index.length} ZhuZi-vs-Calvin sixes (validated); screened together with z01..z24`);

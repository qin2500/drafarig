// Calvin's plausible sixes (seat 8), for mocks where Anthony pilots Calvin's next opponent. Sets: the format's ladder usage
// (sheets.mjs usageLibrary), except Mega Staraptor (the Mega's own ladder set: Calvin's Week 1 Mega) and Tauros (no ladder
// data: worst case, Sheer Force + Life Orb Rock Slide, which beat Anthony in Week 1 game 2). Swalot (1 pt) is left out.
//   node tools/sim/candidates/calvin/build.mjs  → cal-*.txt (curated) + index.json
import { writeFileSync } from 'node:fs';
import { PS } from '../../ai/data.mjs';
import { usageLibrary } from '../../sheets.mjs';

const U = usageLibrary();
const set = (k) => ({ ...structuredClone(U.get(k)), level: 50 });
const MEGA_RAP = { name: 'Staraptor', species: 'Staraptor', item: 'Staraptite', ability: 'Intimidate', nature: 'Jolly', evs: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 },
  moves: ['Close Combat', 'Brave Bird', 'Tailwind', 'Protect'], level: 50 };
const TAUROS = { name: 'Tauros', species: 'Tauros', item: 'Life Orb', ability: 'Sheer Force', nature: 'Adamant', evs: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 },
  moves: ['Rock Slide', 'Body Slam', 'Close Combat', 'Protect'], level: 50 };
const S = { rapM: MEGA_RAP, rapS: set('staraptor'), grimm: set('grimmsnarl'), volc: set('volcarona'), basc: set('basculegionf'), mamo: set('mamoswine'),
  tsa: set('tsareena'), emp: set('empoleon'), jolt: set('jolteon'), tauros: TAUROS };
// one item each (item clause): Tauros and Basculegion both want Life Orb on the ladder; Basculegion takes its next item
const fixItems = (sets) => { const used = new Set(); for (const s of sets) { if (used.has(s.item)) s.item = s.species === 'Basculegion-F' ? 'Mystic Water' : s.species === 'Mamoswine' ? 'Never-Melt Ice' : 'Sitrus Berry'; used.add(s.item); } return sets; };
const TEAMS = [
  ['cal-1', 'Week 1 core: Mega Staraptor Tailwind, Grimmsnarl screens, Volcarona, Basculegion-F, Mamoswine, Tauros', 0.25, ['rapM', 'grimm', 'volc', 'basc', 'mamo', 'tauros']],
  ['cal-2', 'Week 1 core with Tsareena for Tauros', 0.15, ['rapM', 'grimm', 'volc', 'basc', 'mamo', 'tsa']],
  ['cal-3', 'Empoleon instead of Basculegion-F', 0.12, ['rapM', 'grimm', 'volc', 'emp', 'mamo', 'tauros']],
  ['cal-4', 'Fast: Jolteon + Tsareena, no Mamoswine', 0.12, ['rapM', 'grimm', 'volc', 'basc', 'jolt', 'tsa']],
  ['cal-5', 'Scarf Staraptor (ladder Final Gambit set) instead of the Mega', 0.12, ['rapS', 'grimm', 'volc', 'basc', 'mamo', 'tauros']],
  ['cal-6', 'Anti-Steel / anti-Trick-Room: Empoleon + Jolteon + Tauros', 0.08, ['rapM', 'grimm', 'emp', 'jolt', 'mamo', 'tauros']],
];
const dir = new URL('./', import.meta.url);
const index = [];
for (const [id, label, weight, keys] of TEAMS) {
  const team = fixItems(keys.map((k) => structuredClone(S[k])));
  const probs = PS.TeamValidator.get('gen9championsvgc2026regmc').validateTeam(team);
  if (probs?.length) throw new Error(`${id}: ${probs.join(' | ')}`);
  writeFileSync(new URL(`${id}.txt`, dir), PS.Teams.export(team));
  index.push({ id, label, weight, sets: keys });
}
writeFileSync(new URL('index.json', dir), JSON.stringify({ coach: 'Calvin', seat: 8, written: new Date().toISOString(), note: 'Plus league/8-*.txt (usage-random sixes from his roster) for breadth.', teams: index }, null, 1));
console.log(`${index.length} Calvin sixes written (all pass the format validator)`);

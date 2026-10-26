// Mock opponent: ZhuZi's (seat 3) teams vs Calvin (seat 8), Week 4, for Anthony to pilot in friendly mocks.
// Format: docs/research/strategy/mock-method.md §4. Chosen by simulation, not judgement (mock-method.md §5): 29 ZhuZi sixes
// (his 24 candidates + 5 Calvin-targeted) screened vs 12 Calvin sixes with the heuristic AI, the top 6 confirmed with the
// depth-2 search engine on both sides (closed sheets, usage-based beliefs). Results: tools/sim/results/mock-calvin/.
// Calcs: the app engine (node docs/research/strategy/sp-assist/verify_curated.mjs).

// ZhuZi's sets (from his candidate library, tools/sim/candidates/zhuzi.json)
const META = { id: 'metagrossmega', set: 'mock', ability: 'toughclaws', item: 'metagrossite', nature: 'Jolly', sp: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 } };
const PULT = { id: 'dragapult', set: 'mock', ability: 'clearbody', item: 'lifeorb', nature: 'Modest', sp: { hp: 2, atk: 0, def: 0, spa: 32, spd: 0, spe: 32 } };
const ROTOMW = { id: 'rotomwash', set: 'mock', ability: 'levitate', item: 'sitrusberry', nature: 'Modest', sp: { hp: 32, atk: 0, def: 4, spa: 8, spd: 16, spe: 6 } };
const NAPE = { id: 'infernape', set: 'mock', ability: 'blaze', item: 'focussash', nature: 'Hasty', sp: { hp: 0, atk: 2, def: 0, spa: 32, spd: 0, spe: 32 } };
const TOX = { id: 'toxtricity', set: 'mock', ability: 'punkrock', item: 'choicescarf', nature: 'Timid', sp: { hp: 1, atk: 0, def: 0, spa: 32, spd: 1, spe: 32 } };
const FLORGES = { id: 'florges', set: 'mock', ability: 'flowerveil', item: 'leftovers', nature: 'Modest', sp: { hp: 32, atk: 0, def: 0, spa: 32, spd: 2, spe: 0 } };
const KROOK = { id: 'krookodile', set: 'mock', ability: 'intimidate', item: 'choicescarf', nature: 'Jolly', sp: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 } };
const TOX_TR = { id: 'toxtricity', set: 'mock', ability: 'punkrock', item: 'lifeorb', nature: 'Quiet', sp: { hp: 32, atk: 0, def: 0, spa: 32, spd: 2, spe: 0 } };
// Calvin's sets: ladder (>= 1760); his Week 1 Mega Staraptor; Tauros worst case (no ladder data)
const RAP = { id: 'staraptormega', set: 'ladder', ability: 'contrary', item: 'staraptite', nature: 'Jolly', sp: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 } };
const GRIMM = { id: 'grimmsnarl', set: 'ladder', ability: 'prankster', item: 'lightclay', nature: 'Careful', sp: { hp: 32, atk: 0, def: 19, spa: 0, spd: 15, spe: 0 } };
const VOLC = { id: 'volcarona', set: 'ladder', ability: 'flamebody', item: 'grassyseed', nature: 'Bold', sp: { hp: 32, atk: 0, def: 32, spa: 0, spd: 2, spe: 0 } };
const BASC = { id: 'basculegionf', set: 'ladder', ability: 'swiftswim', item: 'lifeorb', nature: 'Modest', sp: { hp: 0, atk: 0, def: 1, spa: 32, spd: 1, spe: 32 } };
const MAMO = { id: 'mamoswine', set: 'ladder', ability: 'oblivious', item: 'focussash', nature: 'Adamant', sp: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 } };
const TSA = { id: 'tsareena', set: 'ladder', ability: 'queenlymajesty', item: 'widelens', nature: 'Jolly', sp: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 } };
const TAUROS = { id: 'tauros', set: 'worst', ability: 'sheerforce', item: 'lifeorb', nature: 'Adamant', sp: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 } };

export default {
  version: 1, coach: 'ZhuZi', seat: 3, vs: 'Calvin', vsSeat: 8, week: 4, written: '2026-10-26',
  rosters: {
    x: ['metagross', 'rotomwash', 'dragapult', 'krookodile', 'infernape', 'slowkinggalar', 'florges', 'oranguru', 'toxtricity', 'umbreon'],
    y: ['staraptor', 'grimmsnarl', 'empoleon', 'basculegionf', 'jolteon', 'volcarona', 'tsareena', 'mamoswine', 'tauros', 'swalot'],
  },
  archetype: 'Three of ZhuZi\'s real plans, picked by simulation: A fast Mega Metagross offense with Fake Out Infernape and Scarf Toxtricity (strongest); B Rock-spam (Rock Slide Metagross + Scarf Krookodile); C Trick Room + Instruct (Oranguru / Slowking-G), the plan Calvin most needs to practise against',
  assumptions: [
    "ZhuZi's sets: his candidate library (Smogon ladder >= 1760, Sept); Calvin's: ladder, plus his Week 1 Mega Staraptor (Tailwind) and a worst-case Tauros (Sheer Force, Life Orb).",
    'Sim: engine vs engine, closed team sheets (each side assumes the other runs ladder sets), 12 Calvin sixes. Team A won 86.5% (±3.9), B 84.0% (±3.9), C 62.7% (±5.1) of 384 games each. Mocks are practice for Calvin: expect him to do better than the sim\'s Calvin.',
    'Doubles, spread x0.75, no crits or accuracy.',
  ],
  team: `Metagross @ Metagrossite
Ability: Clear Body
Level: 50
EVs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Psychic Fangs
- Iron Head
- Stomping Tantrum
- Protect

Infernape @ Focus Sash
Ability: Blaze
Level: 50
EVs: 2 Atk / 32 SpA / 32 Spe
Hasty Nature
- Fake Out
- Heat Wave
- Close Combat
- Protect

Toxtricity @ Choice Scarf
Ability: Punk Rock
Level: 50
EVs: 1 HP / 32 SpA / 1 SpD / 32 Spe
Timid Nature
- Overdrive
- Boomburst
- Sludge Bomb
- Volt Switch

Dragapult @ Life Orb
Ability: Clear Body
Level: 50
EVs: 2 HP / 32 SpA / 32 Spe
Modest Nature
- Draco Meteor
- Shadow Ball
- Will-O-Wisp
- Protect

Florges @ Leftovers
Ability: Flower Veil
Level: 50
EVs: 32 HP / 32 SpA / 2 SpD
Modest Nature
- Moonblast
- Dazzling Gleam
- Calm Mind
- Protect

Rotom-Wash @ Sitrus Berry
Ability: Levitate
Level: 50
EVs: 32 HP / 4 Def / 8 SpA / 16 SpD / 6 Spe
Modest Nature
- Hydro Pump
- Will-O-Wisp
- Thunderbolt
- Protect
`,
  departures: [
    { mon: 'oranguru', what: 'Team C: Protect instead of Imprison', why: "Imprison was aimed at Anthony's Trick Room; Calvin has no move it would block" },
  ],
  variants: [{
    name: 'B: Rock spam (Rock Slide Metagross + Scarf Krookodile)',
    note: 'Sim: 84% (±4). Lead Krookodile + Infernape (88% in the sim) or Dragapult + Infernape (95%): Intimidate / Will-O-Wisp + Fake Out, then Rock Slide flinches. Rock Slide from Metagross and Krookodile hits Volcarona super-effectively (58–71% each from Scarf Krookodile, so two Rock Slides KO it); it is neutral on Mega Staraptor (Fighting resists Rock), so Psychic Fangs it instead. Slowking-G (Power Gem, Trick Room) is the back-up plan if he Tailwinds.',
    team: `Krookodile @ Choice Scarf
Ability: Intimidate
Level: 50
EVs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- High Horsepower
- Knock Off
- Rock Slide
- Close Combat

Infernape @ Focus Sash
Ability: Blaze
Level: 50
EVs: 2 Atk / 32 SpA / 32 Spe
Hasty Nature
- Fake Out
- Heat Wave
- Close Combat
- Protect

Metagross @ Metagrossite
Ability: Clear Body
Level: 50
EVs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Psychic Fangs
- Iron Head
- Rock Slide
- Protect

Toxtricity @ Expert Belt
Ability: Punk Rock
Level: 50
EVs: 1 HP / 32 SpA / 1 SpD / 32 Spe
Timid Nature
- Overdrive
- Boomburst
- Sludge Bomb
- Volt Switch

Dragapult @ Life Orb
Ability: Clear Body
Level: 50
EVs: 2 HP / 32 SpA / 32 Spe
Modest Nature
- Draco Meteor
- Shadow Ball
- Will-O-Wisp
- Protect

Slowking-Galar @ Sitrus Berry
Ability: Regenerator
Level: 50
EVs: 32 HP / 2 Def / 32 SpA
Quiet Nature
- Trick Room
- Psychic
- Sludge Bomb
- Power Gem
`,
  }, {
    name: 'C: Trick Room + Instruct (Oranguru / Slowking-G)',
    note: 'Sim: 63% (±5): the hardest version for us to win with, and the best practice for Calvin, because it beats his Tailwind plan by flipping speed. Lead Metagross + Oranguru (79% in the sim): Trick Room T1 while Metagross threatens; then bulky Toxtricity Overdrives first, and Oranguru Instructs it. Back: Slowking-G (second Trick Room) + Toxtricity.',
    team: `Oranguru @ Sitrus Berry
Ability: Inner Focus
Level: 50
EVs: 32 HP / 2 Def / 32 SpD
Sassy Nature
- Trick Room
- Instruct
- Foul Play
- Protect

Metagross @ Metagrossite
Ability: Clear Body
Level: 50
EVs: 24 HP / 15 Atk / 27 Spe
Adamant Nature
- Psychic Fangs
- Iron Head
- Bullet Punch
- Protect

Toxtricity @ Life Orb
Ability: Punk Rock
Level: 50
EVs: 32 HP / 32 SpA / 2 SpD
Quiet Nature
- Overdrive
- Boomburst
- Sludge Bomb
- Protect

Slowking-Galar @ Colbur Berry
Ability: Regenerator
Level: 50
EVs: 32 HP / 5 Def / 19 SpA / 10 SpD
Sassy Nature
- Trick Room
- Chilly Reception
- Sludge Bomb
- Protect

Krookodile @ Passho Berry
Ability: Intimidate
Level: 50
EVs: 32 HP / 3 Def / 25 SpD / 6 Spe
Impish Nature
- Knock Off
- High Horsepower
- Rock Slide
- Protect

Dragapult @ Focus Sash
Ability: Clear Body
Level: 50
EVs: 2 HP / 32 SpA / 32 Spe
Timid Nature
- Draco Meteor
- Shadow Ball
- Will-O-Wisp
- Protect
`,
  }],
  pilotNotes: {
    wins: 'Team A: out-speed and out-damage. Fake Out with Infernape, Mega Metagross (178 Speed after Mega) hits first, Scarf Toxtricity Overdrive spreads. Take out Mega Staraptor before his Tailwind matters; Will-O-Wisp (Rotom-Wash / Dragapult) cripples his physical attackers.',
    leads: [
      { ours: ['infernape', 'metagross'], t1: 'Infernape Fake Out his biggest attacker (Mega Staraptor if it leads); Metagross Mega + Psychic Fangs into Staraptor (OHKO, 127–152%).', t2: 'Heat Wave + Iron Head (Grimmsnarl) / Psychic Fangs. Infernape Close Combat if Tauros or Mamoswine are in.', note: 'default (95% in the sim)' },
      { ours: ['infernape', 'dragapult'], t1: 'Fake Out + Will-O-Wisp his physical threat (Staraptor / Mamoswine / Tauros).', t2: 'Dragapult Draco Meteor / Shadow Ball (Basculegion-F); Metagross from the back.', note: 'vs physical leads (93%)' },
      { ours: ['infernape', 'toxtricity'], t1: 'Fake Out + Scarf Overdrive (spread): hits Staraptor and Basculegion-F super-effectively.', t2: 'Toxtricity is locked: Volt Switch out if he brings Mamoswine.', note: 'most-used lead (89%)' },
    ],
    back: ['toxtricity', 'florges', 'dragapult'],
    theyTry: [
      'Mega Staraptor Tailwind T1, then Brave Bird / Close Combat with doubled Speed',
      'Grimmsnarl Light Screen / Reflect (Prankster): fewer OHKOs for 8 turns (Light Clay)',
      'Mamoswine High Horsepower: Toxtricity takes 4x Ground damage, Metagross 2x',
      'Volcarona Rage Powder + Quiver Dance (ladder support set), redirecting single-target hits',
      'Tauros (Sheer Force) Rock Slide',
    ],
    ifThen: [
      { if: 'he leads Mega Staraptor', do: 'Fake Out it T1 so it can\'t Tailwind, and Psychic Fangs it with Metagross' },
      { if: 'he sets Tailwind', do: 'Protect the threatened slot and stall the 4 turns, or (team C) set Trick Room: under Tailwind his side moves last' },
      { if: 'Grimmsnarl sets screens', do: 'Iron Head Grimmsnarl first: an OHKO (110–131%) only without Reflect, so hit it before the screens go up; Will-O-Wisp is unaffected by screens' },
      { if: 'Mamoswine is in', do: 'Keep Toxtricity out of High Horsepower range (Ground 4x, 313–374%); Mamoswine has Focus Sash, so chip it (Heat Wave, Overdrive) before Infernape Close Combat (91–109%)' },
      { if: 'Volcarona uses Rage Powder', do: 'Use spread moves (Overdrive, Dazzling Gleam, Rock Slide) that ignore redirection; Rotom-Wash Hydro Pump does 75–89% to it' },
    ],
  },
  calcs: [
    { attacker: META, defender: RAP, move: 'psychicfangs', field: {}, range: '127.2–151.9%', verdict: 'OHKO', why: '' },
    { attacker: META, defender: GRIMM, move: 'ironhead', field: {}, range: '109.9–130.7%', verdict: 'OHKO', why: 'not through Reflect' },
    { attacker: TOX, defender: RAP, move: 'overdrive', field: { spread: true }, range: '82.7–97.5%', verdict: '2HKO', why: 'spread; any chip first makes it a KO' },
    { attacker: TOX, defender: BASC, move: 'overdrive', field: { spread: true }, range: '77.9–93.3%', verdict: '2HKO', why: 'spread' },
    { attacker: NAPE, defender: TSA, move: 'heatwave', field: { spread: true }, range: '72.5–85.9%', verdict: '2HKO', why: 'spread, no sun' },
    { attacker: NAPE, defender: MAMO, move: 'closecombat', field: {}, range: '90.9–109.1%', verdict: 'Sash holds', why: 'Focus Sash at full HP: needs chip or a second hit' },
    { attacker: ROTOMW, defender: VOLC, move: 'hydropump', field: {}, range: '75.0–88.5%', verdict: '2HKO', why: '' },
    { attacker: FLORGES, defender: GRIMM, move: 'moonblast', field: {}, range: '80.2–95.0%', verdict: '2HKO', why: '' },
    { attacker: PULT, defender: BASC, move: 'shadowball', field: {}, range: '105.1–125.1%', verdict: 'OHKO', why: '' },
    { attacker: KROOK, defender: VOLC, move: 'rockslide', field: { spread: true }, range: '58.3–70.8%', verdict: '2HKO', why: 'team B; bulky Bold ladder Volcarona' },
    { attacker: TOX_TR, defender: RAP, move: 'overdrive', field: { spread: true }, range: '117.3–139.5%', verdict: 'OHKO', why: 'team C (Life Orb, Quiet): under Trick Room it moves first' },
    { attacker: RAP, defender: META, move: 'closecombat', field: {}, range: '48.4–58.0%', verdict: 'survives', why: '' },
    { attacker: RAP, defender: NAPE, move: 'bravebird', field: {}, range: '211.9–251.7%', verdict: 'Sash holds', why: 'Focus Sash: survives at 1 HP from full; Fake Out first' },
    { attacker: MAMO, defender: TOX, move: 'highhorsepower', field: {}, range: '312.6–373.5%', verdict: 'OHKO', why: 'Ground 4x on Toxtricity' },
    { attacker: MAMO, defender: META, move: 'highhorsepower', field: {}, range: '81.5–96.8%', verdict: 'survives', why: '' },
    { attacker: BASC, defender: META, move: 'shadowball', field: {}, range: '96.2–115.9%', verdict: 'likely OHKO', why: 'Ghost on Psychic; Life Orb Modest' },
    { attacker: TAUROS, defender: TOX, move: 'rockslide', field: { spread: true }, range: '43.7–52.3%', verdict: '2HKO', why: '' },
    { attacker: TSA, defender: ROTOMW, move: 'powerwhip', field: {}, range: '114.6–135.0%', verdict: 'OHKO', why: '' },
  ],
  outline: [{ coach: 'Hex', week: 5, note: 'Next mock after this one: Hex vs Calvin (Week 5).' }],
};

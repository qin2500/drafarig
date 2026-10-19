// Mock opponent: Jacky's (seat 4) strongest realistic team vs Calvin (seat 8), for Anthony to pilot in friendly mocks.
// Format: docs/research/strategy/mock-method.md §4. Numbers: sp-assist/spcalc.py (sp-assist/mock_jacky_calvin.py).

const FARI = { id: 'farigiraf', set: 'mock', ability: 'armortail', item: 'sitrusberry', nature: 'Sassy', sp: { hp: 32, atk: 0, def: 0, spa: 2, spd: 32, spe: 0 } };
const TORK = { id: 'torkoal', set: 'mock', ability: 'drought', item: 'charcoal', nature: 'Quiet', sp: { hp: 32, atk: 0, def: 0, spa: 32, spd: 2, spe: 0 } };
const INCIN = { id: 'incineroar', set: 'mock', ability: 'intimidate', item: 'chopleberry', nature: 'Careful', sp: { hp: 32, atk: 0, def: 14, spa: 0, spd: 20, spe: 0 } };
const GOLI = { id: 'golisopodmega', set: 'mock', ability: 'toughclaws', item: 'golisopite', nature: 'Brave', sp: { hp: 32, atk: 32, def: 0, spa: 0, spd: 2, spe: 0 } };
const RIME = { id: 'mrrime', set: 'mock', ability: 'screencleaner', item: 'twistedspoon', nature: 'Quiet', sp: { hp: 32, atk: 0, def: 2, spa: 32, spd: 0, spe: 0 } };
const LYC = { id: 'lycanrocmidnight', set: 'mock', ability: 'noguard', item: 'lifeorb', nature: 'Brave', sp: { hp: 32, atk: 32, def: 2, spa: 0, spd: 0, spe: 0 } };
const RAP = { id: 'staraptormega', set: 'ladder', ability: 'contrary', item: 'staraptite', nature: 'Jolly', sp: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 } };
const RAP_T = { id: 'staraptormega', set: 'ladder', ability: 'contrary', item: 'staraptite', nature: 'Jolly', sp: { hp: 29, atk: 1, def: 0, spa: 0, spd: 4, spe: 32 } };
const GRIMM = { id: 'grimmsnarl', set: 'ladder', ability: 'prankster', item: 'lightclay', nature: 'Careful', sp: { hp: 32, atk: 0, def: 19, spa: 0, spd: 15, spe: 0 } };
const VOLC = { id: 'volcarona', set: 'ladder', ability: 'flamebody', item: 'grassyseed', nature: 'Bold', sp: { hp: 32, atk: 0, def: 32, spa: 0, spd: 2, spe: 0 } };
const VOLC_M = { id: 'volcarona', set: 'ladder', ability: 'flamebody', item: 'grassyseed', nature: 'Modest', sp: { hp: 21, atk: 0, def: 15, spa: 5, spd: 1, spe: 24 } };
const MAMO = { id: 'mamoswine', set: 'ladder', ability: 'oblivious', item: 'lifeorb', nature: 'Adamant', sp: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 } };
const TSA = { id: 'tsareena', set: 'ladder', ability: 'queenlymajesty', item: 'widelens', nature: 'Jolly', sp: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 } };
const TAUROS = { id: 'tauros', set: 'worst', ability: 'sheerforce', item: 'lifeorb', nature: 'Adamant', sp: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 } };
const SUN = { weather: 'Sun' };

export default {
  version: 1, coach: 'Jacky', seat: 4, vs: 'Calvin', vsSeat: 8, week: 2, written: '2026-10-19',
  rosters: {
    x: ['incineroar', 'golisopod', 'farigiraf', 'rotommow', 'torkoal', 'mimikyu', 'appletun', 'rotom', 'mrrime', 'lycanrocmidnight'],
    y: ['staraptor', 'grimmsnarl', 'empoleon', 'basculegionf', 'jolteon', 'volcarona', 'tsareena', 'mamoswine', 'tauros', 'swalot'],
  },
  archetype: 'Trick Room (Farigiraf / Mr. Rime) + Torkoal sun Eruption + Mega Golisopod, with Incineroar Fake Out / Intimidate',
  assumptions: [
    "Calvin's sets: Smogon ladder (>= 1760, Sept); Tauros: worst case (Sheer Force, Life Orb).",
    'Doubles, spread x0.75, no crits or accuracy.',
  ],
  team: `Farigiraf @ Sitrus Berry
Ability: Armor Tail
Level: 50
EVs: 32 HP / 2 SpA / 32 SpD
Sassy Nature
- Trick Room
- Helping Hand
- Psychic
- Protect

Torkoal @ Charcoal
Ability: Drought
Level: 50
EVs: 32 HP / 32 SpA / 2 SpD
Quiet Nature
- Eruption
- Weather Ball
- Earth Power
- Protect

Incineroar @ Chople Berry
Ability: Intimidate
Level: 50
EVs: 32 HP / 14 Def / 20 SpD
Careful Nature
- Fake Out
- Parting Shot
- Flare Blitz
- Throat Chop

Golisopod @ Golisopite
Ability: Emergency Exit
Level: 50
EVs: 32 HP / 32 Atk / 2 SpD
Brave Nature
- Iron Head
- Liquidation
- First Impression
- Protect

Mr. Rime @ Twisted Spoon
Ability: Screen Cleaner
Level: 50
EVs: 32 HP / 2 Def / 32 SpA
Quiet Nature
- Fake Out
- Psychic
- Freeze-Dry
- Trick Room

Lycanroc-Midnight @ Life Orb
Ability: No Guard
Level: 50
EVs: 32 HP / 32 Atk / 2 Def
Brave Nature
- Rock Slide
- Stone Edge
- Close Combat
- Protect
`,
  departures: [
    { mon: 'incineroar', what: 'Chople Berry (ladder Sitrus)', why: 'Mega Staraptor Close Combat 52–61%' },
    { mon: 'mrrime', what: 'Screen Cleaner + Psychic, Quiet 0 Spe', why: "Wipes Grimmsnarl's screens; Psychic OHKOs Mega Staraptor (101.6–120.6%)" },
    { mon: 'lycanrocmidnight', what: 'Brave 0 Spe, Life Orb', why: 'Trick Room speed; Rock Slide OHKOs Volcarona (124–149%)' },
    { mon: 'golisopod', what: 'Brave 0 Spe (ladder Adamant)', why: 'Trick Room speed' },
  ],
  variants: [{
    name: 'B: no Trick Room (fast sun offense)',
    note: 'Lead Incineroar + Rotom-Mow. Scarf Leaf Storm OHKOs Basculegion-F / Mamoswine; Mimikyu Play Rough does 92–109% to Mega Staraptor (50% OHKO): add any chip first.',
    team: `Incineroar @ Chople Berry
Ability: Intimidate
Level: 50
EVs: 32 HP / 14 Def / 20 SpD
Careful Nature
- Fake Out
- Parting Shot
- Flare Blitz
- Throat Chop

Torkoal @ Charcoal
Ability: Drought
Level: 50
EVs: 32 HP / 32 SpA / 2 SpD
Quiet Nature
- Eruption
- Weather Ball
- Earth Power
- Protect

Rotom-Mow @ Choice Scarf
Ability: Levitate
Level: 50
EVs: 2 HP / 32 SpA / 32 Spe
Timid Nature
- Leaf Storm
- Thunderbolt
- Volt Switch
- Electroweb

Lycanroc-Midnight @ Focus Sash
Ability: No Guard
Level: 50
EVs: 2 HP / 32 Atk / 32 Spe
Adamant Nature
- Rock Slide
- Stone Edge
- Close Combat
- Protect

Mimikyu @ Life Orb
Ability: Disguise
Level: 50
EVs: 2 HP / 32 Atk / 32 Spe
Adamant Nature
- Play Rough
- Shadow Sneak
- Trick Room
- Protect

Golisopod @ Golisopite
Ability: Emergency Exit
Level: 50
EVs: 32 HP / 32 Atk / 2 SpD
Brave Nature
- Iron Head
- Liquidation
- First Impression
- Protect
`,
  }],
  pilotNotes: {
    wins: 'Set Trick Room, then Torkoal Eruption in sun plus Golisopod / Lycanroc hit first for 4 turns; his fast team moves last.',
    leads: [
      { ours: ['farigiraf', 'incineroar'], t1: 'Incineroar Fake Out his biggest threat (or Grimmsnarl); Farigiraf Trick Room (Armor Tail blocks his Fake Out / Prankster).', t2: 'Torkoal / Golisopod in; Eruption and Iron Head.', note: 'default' },
      { ours: ['mrrime', 'torkoal'], t1: 'Screen Cleaner wipes screens on entry; Mr. Rime Fake Out, Torkoal Protect.', t2: 'Mr. Rime Trick Room, then Eruption.', note: 'vs Grimmsnarl leads' },
    ],
    back: ['torkoal', 'golisopod', 'lycanrocmidnight'],
    theyTry: [
      'Tailwind + screens + Mega Staraptor',
      'Volcarona Heat Wave / Overheat in OUR sun: Overheat OHKOs Mega Golisopod (Fire 4x) and Mr. Rime',
      'Mamoswine High Horsepower on Torkoal (98–119%) / Incineroar (112–133%)',
      'Tauros (Sheer Force) Rock Slide',
    ],
    ifThen: [
      { if: 'he leads Grimmsnarl', do: 'Fake Out Grimmsnarl T1, or bring Mr. Rime (Screen Cleaner)' },
      { if: 'he Tailwinds T1', do: 'Trick Room the same turn' },
      { if: 'Volcarona is in', do: "Don't Mega Golisopod in front of it while sun is up; Lycanroc Rock Slide it first" },
      { if: 'Farigiraf gets Taunted (non-Prankster)', do: 'Mr. Rime is the back-up Trick Room' },
      { if: "his Staraptor doesn't Mega and moves first (Scarf)", do: 'Final Gambit: Protect the target, or keep Farigiraf / Incineroar in front (they survive 192)' },
      { if: 'Mamoswine is in', do: 'Torkoal Eruption OHKOs it (228–270%)' },
    ],
  },
  calcs: [
    { attacker: TORK, defender: RAP_T, move: 'eruption', field: { ...SUN, spread: true }, range: '79.4–93.7%', verdict: '2HKO (no OHKO)', why: 'needs a second hit (Psychic / Iron Head / Flare Blitz); vs the 2-HP Jolly 2/32 spread it is 96.3–113.6%' },
    { attacker: TORK, defender: MAMO, move: 'eruption', field: { ...SUN, spread: true }, range: '227.8–269.5%', verdict: 'OHKO', why: '' },
    { attacker: TORK, defender: TSA, move: 'eruption', field: { ...SUN, spread: true }, range: '193.3–229.5%', verdict: 'OHKO', why: '' },
    { attacker: TORK, defender: TAUROS, move: 'eruption', field: { ...SUN, spread: true }, range: '125.0–148.0%', verdict: 'OHKO', why: '' },
    { attacker: LYC, defender: VOLC, move: 'rockslide', field: { spread: true }, range: '124.5–149.0%', verdict: 'OHKO', why: 'No Guard' },
    { attacker: GOLI, defender: GRIMM, move: 'ironhead', field: {}, range: '124.8–146.5%', verdict: 'OHKO', why: '83.2–97.5% into Reflect' },
    { attacker: RIME, defender: RAP_T, move: 'psychic', field: {}, range: '101.6–120.6%', verdict: 'OHKO', why: '' },
    { attacker: RAP, defender: INCIN, move: 'closecombat', field: {}, range: '52.0–61.4%', verdict: 'survives', why: 'Chople Berry' },
    { attacker: RAP, defender: FARI, move: 'closecombat', field: {}, range: '63.4–75.3%', verdict: 'survives', why: '' },
    { attacker: VOLC_M, defender: GOLI, move: 'overheat', field: SUN, range: '298.9–356.0%', verdict: 'OHKO', why: 'Fire 4x, our sun' },
    { attacker: MAMO, defender: TORK, move: 'highhorsepower', field: {}, range: '98.3–119.2%', verdict: '94% OHKO', why: '' },
    { attacker: TAUROS, defender: INCIN, move: 'rockslide', field: { spread: true }, range: '49.0–57.9%', verdict: '2HKO', why: '' },
  ],
  outline: [{ coach: 'ZhuZi', week: 4, note: 'Mega Metagross, Rotom-Wash (Will-O-Wisp), Krookodile (Intimidate / Rock Slide), Toxtricity, Dragapult, Oranguru (Trick Room vs his Tailwind). Compute steps 2–5 next.' }],
};

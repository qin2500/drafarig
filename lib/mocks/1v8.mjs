// Mock opponent: Hex's (seat 1) teams vs Calvin (seat 8), Week 5, for Anthony to pilot in friendly mocks.
// Format: docs/research/strategy/mock-method.md §4. Chosen by simulation (mock-method.md §5): 242 Hex sixes (every six of
// his 10 plus hand-built ones, docs/research/strategy/sp-assist/gen_hex_vs_calvin.py -> tools/sim/candidates/hex-vs-calvin.json)
// screened vs Calvin's 12 modelled sixes with the heuristic AI (24 games each), the top 37 extended to 96 games, then the
// best fast and Psychic Spam sixes played by the depth-2 search engine on both sides (closed sheets, 96 games each, seed
// 7200000). Results: tools/sim/results/hex-vs-calvin/ (not tracked). Calcs: the app engine
// (docs/research/strategy/sim/scripts/hex-vs-calvin-calcs.mjs, hex-vs-calvin-psy-calcs.mjs; verify_curated.mjs re-runs them).

const SP = (hp, atk, def, spa, spd, spe) => ({ hp, atk, def, spa, spd, spe });
// Hex's sets (gen_hex_vs_calvin.py HX library)
const INDEE = { id: 'indeedeef', set: 'mock', ability: 'psychicsurge', item: 'rockyhelmet', nature: 'Relaxed', sp: SP(32, 0, 32, 0, 2, 0) };
const ARMA = { id: 'armarouge', set: 'mock', ability: 'flashfire', item: 'lifeorb', nature: 'Quiet', sp: SP(32, 0, 0, 32, 2, 0) };
const ARMA_HW = { id: 'armarouge', set: 'mock', ability: 'flashfire', item: 'lifeorb', nature: 'Modest', sp: SP(2, 0, 0, 32, 0, 32) };
const CORV = { id: 'corviknight', set: 'mock', ability: 'mirrorarmor', item: 'leftovers', nature: 'Careful', sp: SP(32, 2, 0, 0, 32, 0) };
const BANETTE = { id: 'banettemega', set: 'mock', ability: 'prankster', item: 'banettite', nature: 'Adamant', sp: SP(32, 32, 0, 0, 2, 0) };
const CHOMPZ = { id: 'garchompmegaz', set: 'mock', ability: 'roughskin', item: 'garchompitez', nature: 'Modest', sp: SP(2, 0, 0, 32, 0, 32) };
const CHOMP_LO = { id: 'garchomp', set: 'mock', ability: 'roughskin', item: 'lifeorb', nature: 'Jolly', sp: SP(2, 32, 0, 0, 0, 32) };
const ROTOMH = { id: 'rotomheat', set: 'mock', ability: 'levitate', item: 'sitrusberry', nature: 'Modest', sp: SP(32, 0, 0, 32, 2, 0) };
// Calvin's sets (its K library: ladder; Tauros worst case)
const RAP = { id: 'staraptormega', set: 'ladder', ability: 'contrary', item: 'staraptite', nature: 'Jolly', sp: SP(2, 32, 0, 0, 0, 32) };
const RAPS = { id: 'staraptor', set: 'ladder', ability: 'intimidate', item: 'choicescarf', nature: 'Jolly', sp: SP(32, 2, 0, 0, 0, 32) };
const GRIMM = { id: 'grimmsnarl', set: 'ladder', ability: 'prankster', item: 'lightclay', nature: 'Careful', sp: SP(32, 0, 19, 0, 15, 0) };
const VOLC = { id: 'volcarona', set: 'ladder', ability: 'flamebody', item: 'rockyhelmet', nature: 'Bold', sp: SP(32, 0, 32, 0, 2, 0) };
const BASC = { id: 'basculegionf', set: 'ladder', ability: 'swiftswim', item: 'focussash', nature: 'Modest', sp: SP(0, 0, 1, 32, 1, 32) };
const MAMO = { id: 'mamoswine', set: 'ladder', ability: 'oblivious', item: 'lifeorb', nature: 'Adamant', sp: SP(2, 32, 0, 0, 0, 32) };
const TSA = { id: 'tsareena', set: 'ladder', ability: 'queenlymajesty', item: 'widelens', nature: 'Jolly', sp: SP(2, 32, 0, 0, 0, 32) };
const EMP = { id: 'empoleon', set: 'ladder', ability: 'competitive', item: 'chopleberry', nature: 'Modest', sp: SP(32, 0, 0, 19, 0, 15) };
const JOLT = { id: 'jolteon', set: 'ladder', ability: 'voltabsorb', item: 'lifeorb', nature: 'Timid', sp: SP(1, 0, 1, 32, 0, 32) };
const TAUROS = { id: 'tauros', set: 'worst', ability: 'sheerforce', item: 'lifeorb', nature: 'Adamant', sp: SP(2, 32, 0, 0, 0, 32) };
const PSY = { terrain: 'Psychic' };

export default {
  version: 1, coach: 'Hex(法拉)', seat: 1, vs: 'Calvin', vsSeat: 8, week: 5, written: '2026-11-10',
  rosters: {
    x: ['garchomp', 'indeedeef', 'corviknight', 'rotomheat', 'armarouge', 'kleavor', 'banette', 'ditto', 'forretress', 'drampa'],
    y: ['staraptor', 'grimmsnarl', 'empoleon', 'basculegionf', 'jolteon', 'volcarona', 'tsareena', 'mamoswine', 'tauros', 'swalot'],
  },
  archetype: 'Two of Hex\'s plans, picked by simulation: A Psychic Spam (Indeedee-F + Armarouge Expanding Force, Mega Banette, Corviknight; strongest); B fast Tailwind offense (Mega Garchomp Z, Rotom-Heat, Armarouge, Corviknight; no Indeedee-F); C regular Life Orb Garchomp + Rotom-Heat + Corviknight with Mega Banette',
  assumptions: [
    'Sim (engine vs engine, closed sheets, 96 games each vs Calvin\'s 12 modelled sixes): team A won 79.2% (CI 70–86); team B 67.7% (58–76). Paired on the same games, A beat B by 11.5 ±12.6 and the fast leader without Rock Slide Kleavor (c08) by 15.6 ±12.8.',
    'Team C (regular Life Orb Garchomp, Mega Banette) won 76.0% (CI 67–83), +8.3 ±11.8 over B on the same games; the engine brought Garchomp, Rotom-Heat, Corviknight and Mega Banette in all 96. A similar six with Indeedee-F and Forretress for Rotom-Heat / Ditto scored 78.1% but often left Garchomp home.',
    'Team A\'s Ditto and Forretress are preview filler: the engine brought Indeedee-F, Armarouge, Corviknight and Mega Banette in 92 of 96 games. Team B\'s Kleavor is the same: Garchomp, Rotom-Heat, Armarouge and Corviknight were brought in 92 of 96.',
    'Other Psychic Spam sixes closer to Hex\'s usual core were 10–15 points worse in the engine: Psychic Seed Imprison Indeedee-F + Armarouge + Cloud Nine Drampa + Mega-Z Garchomp + Rotom-Heat + Corviknight 67.7%; with Drampa / Mega Banette / Forretress 68.8%; with Garchomp / Kleavor / Electroweb Rotom-Heat 64.6%.',
    'The heuristic screen overrated the fast team (87.5% there, 63.5% under the engine). Kleavor looked negative in the screen: Calvin\'s Empoleon Hydro Pump (155–184%) and Basculegion-F Muddy Water (95–114%) remove it.',
    'Calvin\'s sets are ladder sets (Week 1 Mega Staraptor with Tailwind, Light Clay Grimmsnarl) plus a worst-case Sheer Force Tauros. The real Calvin will be less predictable than the sim\'s.',
    'Doubles, spread x0.75, no crits. Psychic Terrain is on for Indeedee-F / Armarouge Psychic moves.',
  ],
  team: `Indeedee-F @ Rocky Helmet
Ability: Psychic Surge
Level: 50
EVs: 32 HP / 32 Def / 2 SpD
Relaxed Nature
- Follow Me
- Helping Hand
- Trick Room
- Psychic

Armarouge @ Life Orb
Ability: Flash Fire
Level: 50
EVs: 32 HP / 32 SpA / 2 SpD
Quiet Nature
- Expanding Force
- Armor Cannon
- Trick Room
- Protect

Corviknight @ Leftovers
Ability: Mirror Armor
Level: 50
EVs: 32 HP / 2 Atk / 32 SpD
Careful Nature
- Brave Bird
- Tailwind
- Roost
- Bulk Up

Banette @ Banettite
Ability: Insomnia
Level: 50
EVs: 32 HP / 32 Atk / 2 SpD
Adamant Nature
- Poltergeist
- Trick Room
- Will-O-Wisp
- Protect

Ditto @ Choice Scarf
Ability: Imposter
Level: 50
EVs: 32 HP / 32 Def / 2 SpD
Bold Nature
- Transform

Forretress @ Sitrus Berry
Ability: Sturdy
Level: 50
EVs: 32 HP / 32 Def / 2 SpD
Relaxed Nature
- Gyro Ball
- Rock Slide
- Body Press
- Protect
`,
  departures: [
    { mon: 'ditto', what: 'Team A: in the six for preview only', why: 'The engine almost never brought Ditto or Forretress; they make Calvin guess at preview' },
  ],
  variants: [{
    name: 'B: fast Tailwind offense (Mega Garchomp Z + Rotom-Heat, no Indeedee-F)',
    note: 'Sim: 67.7% (CI 58–76). Bring Garchomp, Rotom-Heat, Armarouge, Corviknight; lead Mega Garchomp Z + Rotom-Heat (68% of 92 games). Corviknight Tailwind from the back, then Draco Meteor / Thunderbolt / Overheat. Weak into Basculegion-F + Mega Staraptor leads (27% of 11 games) and his Jolteon + Tsareena six (25%).',
    team: `Garchomp @ Garchompite Z
Ability: Rough Skin
Level: 50
EVs: 2 HP / 32 SpA / 32 Spe
Modest Nature
- Draco Meteor
- Earth Power
- Power Gem
- Protect

Corviknight @ Leftovers
Ability: Mirror Armor
Level: 50
EVs: 32 HP / 2 Atk / 32 SpD
Careful Nature
- Brave Bird
- Tailwind
- Roost
- Bulk Up

Rotom-Heat @ Sitrus Berry
Ability: Levitate
Level: 50
EVs: 32 HP / 32 SpA / 2 SpD
Modest Nature
- Overheat
- Thunderbolt
- Will-O-Wisp
- Protect

Armarouge @ Life Orb
Ability: Flash Fire
Level: 50
EVs: 2 HP / 32 SpA / 32 Spe
Modest Nature
- Expanding Force
- Heat Wave
- Aura Sphere
- Protect

Kleavor @ Focus Sash
Ability: Sharpness
Level: 50
EVs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Stone Axe
- Rock Slide
- Close Combat
- Protect

Drampa @ Expert Belt
Ability: Berserk
Level: 50
EVs: 32 HP / 32 SpA / 2 SpD
Quiet Nature
- Hyper Voice
- Draco Meteor
- Thunderbolt
- Protect
`,
  }, {
    name: 'C: regular Garchomp (Life Orb) + Mega Banette',
    note: 'Sim: 76.0% (CI 67–83), +8.3 ±11.8 over B. Bring Garchomp, Rotom-Heat, Corviknight, Banette (all 96 games). Lead Corviknight + Rotom-Heat (88% of 52 games: Tailwind, then Garchomp in) or Garchomp + Rotom-Heat (61% of 44). Rock Slide hits Volcarona (81–97%) and Mega Staraptor; Earthquake one-shots Empoleon most rolls (98–116%). Mamoswine Ice Shard one-shots it (112–135%). Weak into Basculegion-F + Mega Staraptor leads (18% of 11) and his no-Volcarona / no-Grimmsnarl sixes (0–25%).',
    team: `Garchomp @ Life Orb
Ability: Rough Skin
Level: 50
EVs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Dragon Claw
- Rock Slide
- Earthquake
- Protect

Corviknight @ Leftovers
Ability: Mirror Armor
Level: 50
EVs: 32 HP / 2 Atk / 32 SpD
Careful Nature
- Brave Bird
- Tailwind
- Roost
- Bulk Up

Rotom-Heat @ Sitrus Berry
Ability: Levitate
Level: 50
EVs: 32 HP / 32 SpA / 2 SpD
Modest Nature
- Overheat
- Thunderbolt
- Will-O-Wisp
- Protect

Drampa @ Expert Belt
Ability: Berserk
Level: 50
EVs: 32 HP / 32 SpA / 2 SpD
Quiet Nature
- Hyper Voice
- Draco Meteor
- Thunderbolt
- Protect

Banette @ Banettite
Ability: Insomnia
Level: 50
EVs: 32 HP / 32 Atk / 2 SpD
Adamant Nature
- Poltergeist
- Trick Room
- Will-O-Wisp
- Protect

Ditto @ Choice Scarf
Ability: Imposter
Level: 50
EVs: 32 HP / 32 Def / 2 SpD
Bold Nature
- Transform
`,
  }],
  pilotNotes: {
    wins: 'Team A: Psychic Terrain + Expanding Force. Indeedee-F sets terrain on entry (blocks his priority: Mamoswine Ice Shard, Prankster moves into your grounded mons) and Follow Mes; Armarouge\'s Expanding Force hits both of his at boosted power (Mega Staraptor 188–222%, Tauros 122–143%, Mamoswine 111–132%). Mega Banette is the Prankster Trick Room / Will-O-Wisp back line; Corviknight Tailwinds or Bulk Ups. Grimmsnarl is Dark: immune to every Psychic move, so Armor Cannon (70–83%) or Poltergeist it.',
    leads: [
      { ours: ['indeedeef', 'corviknight'], t1: 'Indeedee-F Follow Me (terrain up); Corviknight Tailwind.', t2: 'Armarouge in; Expanding Force both under Tailwind, Indeedee-F Helping Hand or Psychic.', note: 'most-used lead (78% of 60 games)' },
      { ours: ['indeedeef', 'armarouge'], t1: 'Follow Me + Expanding Force: Mega Staraptor 188–222%, Tauros 122–143%, Mamoswine 111–132%.', t2: 'Trick Room with Armarouge only if he has Tailwind up; Corviknight / Banette from the back.', note: 'direct pressure (79% of 24)' },
      { ours: ['indeedeef', 'banette'], t1: 'Mega Banette; Prankster Will-O-Wisp his physical attacker (Staraptor / Mamoswine / Tauros) or Prankster Trick Room; Indeedee-F Follow Me.', t2: 'Poltergeist Basculegion-F (175–207%); Armarouge in under Trick Room.', note: '88% of 8 games' },
    ],
    back: ['armarouge', 'banette', 'corviknight'],
    theyTry: [
      'Mega Staraptor Tailwind T1, then Brave Bird / Close Combat (Close Combat does 58–68% to Indeedee-F)',
      'Grimmsnarl Light Screen / Reflect (Prankster), and it is immune to Psychic: Expanding Force does nothing to it',
      'Mamoswine High Horsepower: 122–144% to Armarouge, 62–73% to Indeedee-F',
      'Empoleon Hydro Pump (106–125% to Armarouge) and Basculegion-F Shadow Ball (78–92% to Armarouge, 84–99% to Mega Banette)',
      'Scarf Staraptor Final Gambit: takes Armarouge or Indeedee-F with it',
    ],
    ifThen: [
      { if: 'Grimmsnarl is on the field', do: 'Expanding Force only hits its partner: Armor Cannon (70–83%) or Mega Banette Poltergeist; Corviknight Brave Bird' },
      { if: 'he sets Tailwind', do: 'Trick Room with Armarouge or Prankster Mega Banette: under his Tailwind his side moves last' },
      { if: 'Mamoswine is in', do: 'Armarouge Protect or switch from High Horsepower (122–144%); Expanding Force one-shots it back (111–132%)' },
      { if: 'Empoleon or Basculegion-F is in', do: 'Keep Armarouge out of Hydro Pump / Shadow Ball; Mega Banette Poltergeist Basculegion-F (175–207%)' },
      { if: 'team B: Mamoswine leads into Mega Garchomp Z', do: 'Icicle Crash one-shots Garchomp (131–153%): Protect or switch it' },
    ],
  },
  calcs: [
    { attacker: ARMA, defender: RAP, move: 'expandingforce', field: PSY, range: '187.7–221.6%', verdict: 'OHKO', why: 'Psychic Terrain' },
    { attacker: ARMA, defender: TAUROS, move: 'expandingforce', field: PSY, range: '121.7–143.4%', verdict: 'OHKO', why: '' },
    { attacker: ARMA, defender: MAMO, move: 'expandingforce', field: PSY, range: '111.2–131.6%', verdict: 'OHKO', why: '' },
    { attacker: ARMA, defender: BASC, move: 'expandingforce', field: PSY, range: '88.7–104.6%', verdict: 'Sash holds', why: 'Focus Sash' },
    { attacker: ARMA, defender: VOLC, move: 'expandingforce', field: PSY, range: '67.7–79.7%', verdict: '2HKO', why: '' },
    { attacker: ARMA, defender: GRIMM, move: 'armorcannon', field: {}, range: '70.3–83.2%', verdict: '2HKO', why: 'Grimmsnarl is immune to Psychic' },
    { attacker: INDEE, defender: RAP, move: 'psychic', field: PSY, range: '85.2–101.2%', verdict: 'Rarely OHKO', why: '' },
    { attacker: BANETTE, defender: BASC, move: 'poltergeist', field: {}, range: '175.4–207.2%', verdict: 'Sash holds', why: 'Focus Sash' },
    { attacker: BANETTE, defender: RAP, move: 'poltergeist', field: {}, range: '75.9–89.5%', verdict: '2HKO', why: '' },
    { attacker: CORV, defender: TSA, move: 'bravebird', field: {}, range: '84.6–100.7%', verdict: 'Rarely OHKO', why: '' },
    { attacker: MAMO, defender: ARMA, move: 'highhorsepower', field: {}, range: '121.9–143.8%', verdict: 'OHKO', why: '' },
    { attacker: MAMO, defender: INDEE, move: 'highhorsepower', field: {}, range: '61.6–73.4%', verdict: '2HKO', why: '' },
    { attacker: EMP, defender: ARMA, move: 'hydropump', field: {}, range: '106.3–125.0%', verdict: 'OHKO', why: '' },
    { attacker: BASC, defender: ARMA, move: 'shadowball', field: {}, range: '78.1–91.7%', verdict: '2HKO', why: '' },
    { attacker: BASC, defender: BANETTE, move: 'shadowball', field: {}, range: '84.2–99.4%', verdict: '2HKO', why: '' },
    { attacker: RAP, defender: INDEE, move: 'closecombat', field: {}, range: '57.6–68.4%', verdict: '2HKO', why: 'Rocky Helmet hits back' },
    { attacker: RAPS, defender: ARMA, move: 'finalgambit', field: {}, range: '100.0–100.0%', verdict: 'KO', why: 'Scarf Staraptor trades itself' },
    { attacker: CHOMPZ, defender: RAP, move: 'dracometeor', field: {}, range: '87.7–103.7%', verdict: 'Rarely OHKO', why: 'team B' },
    { attacker: CHOMPZ, defender: VOLC, move: 'powergem', field: {}, range: '106.3–125.0%', verdict: 'OHKO', why: 'team B' },
    { attacker: ROTOMH, defender: RAP, move: 'thunderbolt', field: {}, range: '97.5–116.0%', verdict: 'Likely OHKO', why: 'team B' },
    { attacker: ROTOMH, defender: BASC, move: 'thunderbolt', field: {}, range: '93.3–110.8%', verdict: 'Sash holds', why: 'team B' },
    { attacker: ROTOMH, defender: MAMO, move: 'overheat', field: {}, range: '167.9–198.9%', verdict: 'OHKO', why: 'team B' },
    { attacker: ARMA_HW, defender: TSA, move: 'heatwave', field: {}, range: '115.4–136.2%', verdict: 'OHKO', why: 'team B' },
    { attacker: MAMO, defender: CHOMPZ, move: 'iciclecrash', field: {}, range: '130.8–153.0%', verdict: 'OHKO', why: 'team B' },
    { attacker: EMP, defender: ROTOMH, move: 'hydropump', field: {}, range: '100.6–119.7%', verdict: 'OHKO', why: 'team B' },
    { attacker: TSA, defender: CHOMPZ, move: 'tripleaxel', field: {}, range: '82.2–98.4%', verdict: '2HKO', why: 'team B' },
    { attacker: CHOMP_LO, defender: VOLC, move: 'rockslide', field: {}, range: '81.3–97.4%', verdict: '2HKO', why: 'team C' },
    { attacker: CHOMP_LO, defender: EMP, move: 'earthquake', field: {}, range: '97.9–115.7%', verdict: 'Likely OHKO', why: 'team C' },
    { attacker: MAMO, defender: CHOMP_LO, move: 'iceshard', field: {}, range: '112.4–135.1%', verdict: 'OHKO', why: 'team C: priority' },
  ],
  outline: [],
};

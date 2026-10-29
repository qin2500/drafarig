// Anthony's revised Week 3 six (2026-10-29, after mocks): Mega Kangaskhan as the usual Mega, Mega Charizard X as the
// surprise (Adamant, max Attack and Speed: 152, just over max-Speed Rotom-Wash), Modest special Aegislash without Wide
// Guard, Sheer Force Conkeldurr (Fire Punch in place of Mach Punch), Pelipper (max Speed / SpA, Focus Sash) for Morpeko;
// plus one-change variants and two Rock-heavy ZhuZi sixes like his mock partner's (three Rock Slide users).
//   node tools/sim/candidates/w3fix/build-new.mjs → n1..n5.txt, zr1.txt, zr2.txt
import { writeFileSync } from 'node:fs';
import { PS } from '../../ai/data.mjs';
const S = {
  kanga: `Kangaskhan @ Kangaskhanite\nAbility: Scrappy\nLevel: 50\nEVs: 32 HP / 32 Atk / 2 Def\nAdamant Nature\n- Fake Out\n- Double-Edge\n- Sucker Punch\n- Protect`,
  zardX: `Charizard @ Charizardite X\nAbility: Blaze\nLevel: 50\nEVs: 2 HP / 32 Atk / 32 Spe\nAdamant Nature\n- Flare Blitz\n- Dragon Claw\n- Dragon Dance\n- Protect`,
  zardY: `Charizard @ Charizardite Y\nAbility: Blaze\nLevel: 50\nEVs: 32 HP / 32 SpA / 2 SpD\nModest Nature\n- Heat Wave\n- Weather Ball\n- Solar Beam\n- Protect`,
  aegisSp: `Aegislash @ Kasib Berry\nAbility: Stance Change\nLevel: 50\nEVs: 32 HP / 32 SpA / 2 Def\nModest Nature\n- Shadow Ball\n- Flash Cannon\n- Shadow Sneak\n- King's Shield`,
  aegisWG: `Aegislash @ Kasib Berry\nAbility: Stance Change\nLevel: 50\nEVs: 32 HP / 32 Atk / 2 Def\nBrave Nature\n- Poltergeist\n- Shadow Sneak\n- King's Shield\n- Wide Guard`,
  sin: `Sinistcha @ Sitrus Berry\nAbility: Hospitality\nLevel: 50\nEVs: 32 HP / 14 Def / 20 SpD\nBold Nature\n- Matcha Gotcha\n- Rage Powder\n- Trick Room\n- Life Dew`,
  conkSF: `Conkeldurr @ Life Orb\nAbility: Sheer Force\nLevel: 50\nEVs: 32 HP / 32 Atk / 2 SpD\nBrave Nature\n- Drain Punch\n- Ice Punch\n- Fire Punch\n- Protect`,
  conkIF: `Conkeldurr @ Life Orb\nAbility: Iron Fist\nLevel: 50\nEVs: 32 HP / 32 Atk / 2 SpD\nBrave Nature\n- Drain Punch\n- Mach Punch\n- Ice Punch\n- Protect`,
  peli: `Pelipper @ Focus Sash\nAbility: Drizzle\nLevel: 50\nEVs: 2 HP / 32 SpA / 32 Spe\nTimid Nature\n- Hurricane\n- Weather Ball\n- Tailwind\n- Wide Guard`,
  morpeko: `Morpeko @ Focus Sash\nAbility: Hunger Switch\nLevel: 50\nEVs: 2 HP / 32 Atk / 32 Spe\nJolly Nature\n- Aura Wheel\n- Fake Out\n- Parting Shot\n- Protect`,
  rotomfan: `Rotom-Fan @ Expert Belt\nAbility: Levitate\nLevel: 50\nEVs: 32 HP / 32 SpA / 2 SpD\nModest Nature\n- Thunderbolt\n- Air Slash\n- Will-O-Wisp\n- Protect`,
  stunfisk: `Stunfisk-Galar @ Leftovers\nAbility: Mimicry\nLevel: 50\nEVs: 32 HP / 32 Atk / 2 Def\nBrave Nature\n- Stomping Tantrum\n- Snap Trap\n- Yawn\n- Protect`,
  simipour: `Simipour @ Focus Sash\nAbility: Torrent\nLevel: 50\nEVs: 2 HP / 32 SpA / 32 Spe\nTimid Nature\n- Fake Out\n- Scald\n- Icy Wind\n- Protect`,
  // ZhuZi, Rock-heavy (sets from his candidate library; Infernape gets Rock Slide, mixed)
  meta: `Metagross @ Metagrossite\nAbility: Clear Body\nLevel: 50\nEVs: 2 HP / 32 Atk / 32 Spe\nJolly Nature\n- Psychic Fangs\n- Iron Head\n- Rock Slide\n- Protect`,
  krookLO: `Krookodile @ Life Orb\nAbility: Intimidate\nLevel: 50\nEVs: 2 HP / 32 Atk / 32 Spe\nAdamant Nature\n- Rock Slide\n- Stone Edge\n- High Horsepower\n- Protect`,
  krookS: `Krookodile @ Choice Scarf\nAbility: Intimidate\nLevel: 50\nEVs: 2 HP / 32 Atk / 32 Spe\nJolly Nature\n- High Horsepower\n- Knock Off\n- Rock Slide\n- Close Combat`,
  napeR: `Infernape @ Focus Sash\nAbility: Blaze\nLevel: 50\nEVs: 16 Atk / 18 SpA / 32 Spe\nHasty Nature\n- Fake Out\n- Heat Wave\n- Close Combat\n- Rock Slide`,
  pult: `Dragapult @ Expert Belt\nAbility: Clear Body\nLevel: 50\nEVs: 2 HP / 32 SpA / 32 Spe\nModest Nature\n- Draco Meteor\n- Shadow Ball\n- Will-O-Wisp\n- Protect`,
  rotomw: `Rotom-Wash @ Sitrus Berry\nAbility: Levitate\nLevel: 50\nEVs: 32 HP / 4 Def / 8 SpA / 16 SpD / 6 Spe\nModest Nature\n- Hydro Pump\n- Will-O-Wisp\n- Thunderbolt\n- Protect`,
  slowk: `Slowking-Galar @ Colbur Berry\nAbility: Regenerator\nLevel: 50\nEVs: 32 HP / 2 Def / 32 SpA\nQuiet Nature\n- Trick Room\n- Psychic\n- Sludge Bomb\n- Power Gem`,
  tox: `Toxtricity @ Choice Scarf\nAbility: Punk Rock\nLevel: 50\nEVs: 1 HP / 32 SpA / 1 SpD / 32 Spe\nTimid Nature\n- Overdrive\n- Boomburst\n- Sludge Bomb\n- Volt Switch`,
  toxLO: `Toxtricity @ Life Orb\nAbility: Punk Rock\nLevel: 50\nEVs: 1 HP / 32 SpA / 1 SpD / 32 Spe\nTimid Nature\n- Overdrive\n- Boomburst\n- Sludge Bomb\n- Protect`,
  umb: `Umbreon @ Leftovers\nAbility: Inner Focus\nLevel: 50\nEVs: 30 HP / 16 Def / 20 SpD\nBold Nature\n- Foul Play\n- Snarl\n- Taunt\n- Protect`,
};
const T = {
  n1: ['kanga', 'zardX', 'aegisSp', 'sin', 'conkSF', 'peli'],
  n2: ['kanga', 'zardX', 'aegisSp', 'sin', 'conkSF', 'morpeko'],
  n3: ['kanga', 'zardX', 'aegisSp', 'sin', 'conkIF', 'peli'],
  n4: ['kanga', 'zardX', 'aegisWG', 'sin', 'conkSF', 'peli'],
  n5: ['kanga', 'zardY', 'aegisSp', 'sin', 'conkSF', 'peli'],
  // sixth-slot options (Pelipper in n1) and a six without Charizard (Anthony: "mostly window dressing")
  n6: ['kanga', 'zardX', 'aegisSp', 'sin', 'conkSF', 'rotomfan'],
  n7: ['kanga', 'zardX', 'aegisSp', 'sin', 'conkSF', 'stunfisk'],
  n8: ['kanga', 'zardX', 'aegisSp', 'sin', 'conkSF', 'simipour'],
  n9: ['kanga', 'rotomfan', 'aegisSp', 'sin', 'conkSF', 'peli'],
  zr1: ['meta', 'krookLO', 'napeR', 'pult', 'rotomw', 'tox'],
  zr2: ['meta', 'krookS', 'napeR', 'slowk', 'umb', 'toxLO'],
};
const v = PS.TeamValidator.get('gen9championsvgc2026regmc');
for (const [id, keys] of Object.entries(T)) {
  const text = keys.map((k) => S[k]).join('\n\n') + '\n';
  const p = v.validateTeam(PS.Teams.import(text));
  if (p?.length) throw new Error(`${id}: ${p.join(' | ')}`);
  writeFileSync(new URL(`${id}.txt`, import.meta.url), text);
}
console.log(`${Object.keys(T).length} sixes written (all pass the validator)`);

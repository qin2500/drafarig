// Matchup guide: Anthony (seat 5) vs Jacky (seat 4), Week 5 (written 2026-11-10). Schema: docs/research/strategy/guide-schema.md (v2).
// Evidence: docs/research/strategy/sim/jacky-report.md (56-six screen, engine confirm, his best response, determinism,
// blind game-1 leads); pool docs/research/strategy/sp-assist/gen_jacky.py -> tools/sim/candidates/jacky.json; calcs
// docs/research/strategy/sim/scripts/jacky-guide-calcs.mjs (app engine; node docs/research/strategy/sp-assist/verify_curated.mjs
// re-runs every one). 'ladder' = Smogon Reg M-C modal set; 'worst' = full learnset, max offence.

const SP = (hp, atk, def, spa, spd, spe) => ({ hp, atk, def, spa, spd, spe });
// Our sets (six yJ10)
const ZARD = { id: 'charizardmegay', set: 'ours', ability: 'drought', item: 'charizarditey', nature: 'Modest', sp: SP(32, 0, 0, 32, 2, 0) };
const SINIS = { id: 'sinistcha', set: 'ours', ability: 'hospitality', item: 'sitrusberry', nature: 'Bold', sp: SP(32, 0, 14, 0, 20, 0) };
const PEL = { id: 'pelipper', set: 'ours', ability: 'drizzle', item: 'focussash', nature: 'Modest', sp: SP(2, 0, 0, 32, 0, 32) };
const MORPEKO = { id: 'morpeko', set: 'ours', ability: 'hungerswitch', item: 'lifeorb', nature: 'Jolly', sp: SP(2, 32, 0, 0, 0, 32) };
const MORPEKO_HANGRY = { ...MORPEKO, form: 'hangry' };
const CONK = { id: 'conkeldurr', set: 'ours', ability: 'ironfist', item: 'expertbelt', nature: 'Brave', sp: SP(32, 32, 0, 0, 2, 0) };
const ROTOMF = { id: 'rotomfan', set: 'ours', ability: 'levitate', item: 'leftovers', nature: 'Modest', sp: SP(32, 0, 0, 32, 2, 0) };

// Jacky's sets
const GOLI = { id: 'golisopodmega', set: 'ladder', ability: 'emergencyexit', item: 'golisopite', nature: 'Adamant', sp: SP(32, 32, 0, 0, 2, 0) };
const GOLI_CC = { ...GOLI, set: 'worst' };
const INCIN = { id: 'incineroar', set: 'ladder', ability: 'intimidate', item: 'sitrusberry', nature: 'Careful', sp: SP(32, 0, 14, 0, 20, 0) };
const FARI = { id: 'farigiraf', set: 'ladder', ability: 'armortail', item: 'focussash', nature: 'Bold', sp: SP(27, 0, 20, 0, 19, 0) };
const TORK = { id: 'torkoal', set: 'ladder', ability: 'drought', item: 'charcoal', nature: 'Quiet', sp: SP(32, 0, 0, 32, 2, 0) };
const MOW = { id: 'rotommow', set: 'ladder', ability: 'levitate', item: 'choicescarf', nature: 'Timid', sp: SP(2, 0, 0, 32, 0, 32) };
const MIMI = { id: 'mimikyu', set: 'ladder', ability: 'disguise', item: 'mentalherb', nature: 'Brave', sp: SP(32, 32, 2, 0, 0, 0) };
const RIME = { id: 'mrrime', set: 'ladder', ability: 'screencleaner', item: 'twistedspoon', nature: 'Quiet', sp: SP(32, 0, 2, 32, 0, 0) };
const LYC = { id: 'lycanrocmidnight', set: 'worst', ability: 'noguard', item: 'focussash', nature: 'Jolly', sp: SP(2, 32, 0, 0, 0, 32) };
const LYC_TR = { id: 'lycanrocmidnight', set: 'worst', ability: 'noguard', item: 'lifeorb', nature: 'Brave', sp: SP(32, 32, 2, 0, 0, 0) };
const ROTOM = { id: 'rotom', set: 'ladder', ability: 'levitate', item: 'leftovers', nature: 'Modest', sp: SP(32, 0, 0, 32, 2, 0) };
const APPLE = { id: 'appletun', set: 'ladder', ability: 'thickfat', item: 'sitrusberry', nature: 'Quiet', sp: SP(32, 0, 0, 32, 2, 0) };
const RAIN = { weather: 'Rain' };
const SUN = { weather: 'Sun' };
const INTIM = { intimidate: 1 };

export default {
  version: 2, pov: 5, opp: 4, coach: 'Jacky', week: 5, written: '2026-11-10',
  rosters: {
    ours: ['charizard', 'sinistcha', 'pelipper', 'kangaskhan', 'aegislash', 'morpeko', 'conkeldurr', 'rotomfan', 'stunfiskgalar', 'simipour'],
    theirs: ['golisopod', 'incineroar', 'farigiraf', 'torkoal', 'rotommow', 'mimikyu', 'mrrime', 'rotom', 'appletun', 'lycanrocmidnight'],
  },
  overview: {
    archetype: 'Trick Room + Torkoal sun: Farigiraf / Mimikyu / Mr. Rime set Trick Room, Torkoal fires sun Eruption, Mega Golisopod and Incineroar support',
    summary: [
      'Jacky spent 93 of his 100 points on six Pokémon: Golisopod (his only Mega), Incineroar, Farigiraf, Torkoal, Rotom-Mow and Mimikyu. The plan is the classic slow one: set Trick Room with Farigiraf, Mimikyu or Mr. Rime, then let Torkoal (36 Speed, the slowest thing on the field) fire sun-boosted Eruption into both of ours before we move. Incineroar Fake Outs and Intimidates to protect the setter; Mega Golisopod hits hard with Leech Life and Iron Head.',
      'Our answer is to fight his weather and his Trick Room at the same time. Mega Charizard Y\'s sun Heat Wave one-shots Mega Golisopod (218–257%), Rotom-Mow and Mr. Rime. Pelipper\'s rain halves Torkoal\'s Fire and Weather Ball one-shots Torkoal (170–200%), and Wide Guard blocks Eruption, Heat Wave and Rock Slide for a turn. Sinistcha can set Trick Room back to undo his.',
      'Three things can surprise you. (1) Lycanroc-Midnight: No Guard Rock Slide one-shots Charizard (117–138%, the slow Life Orb set 163–197%), and its lead with Torkoal is our worst lead matchup in every test (35–55%). (2) His best plan against this exact six: Incineroar Fake Out on our best attacker while Mimikyu or Mr. Rime sets Trick Room (we won 52–54% of those games). (3) Farigiraf\'s Armor Tail stops all our priority, Fake Out and Mach Punch included, into BOTH of his Pokémon while it is on the field.',
    ],
    roster: [
      { id: 'torkoal', role: 'Drought sun Eruption: the win condition under Trick Room (36 Speed)', tier: 'core' },
      { id: 'farigiraf', role: 'Trick Room; Armor Tail blocks our priority into his whole side; often Focus Sash', tier: 'core' },
      { id: 'golisopod', role: 'His Mega (Bug/Steel, Tough Claws): Leech Life, Iron Head, Sucker Punch; Close Combat possible', tier: 'core' },
      { id: 'incineroar', role: 'Fake Out, Intimidate, Parting Shot, Flare Blitz', tier: 'core' },
      { id: 'mimikyu', role: 'Trick Room setter (Disguise + Mental Herb: Taunt and Fake Out do not stop it)', tier: 'core' },
      { id: 'rotommow', role: 'Choice Scarf Leaf Storm / Volt Switch / Trick (226 Speed, faster than all of us)', tier: 'core' },
      { id: 'mrrime', role: 'Fake Out + Trick Room; Freeze-Dry one-shots Pelipper', tier: 'likely' },
      { id: 'lycanrocmidnight', role: 'No Guard Rock Slide: the anti-Charizard pick', tier: 'likely' },
      { id: 'rotom', role: 'Will-O-Wisp + Thunderbolt (one-shots Pelipper)', tier: 'fringe' },
      { id: 'appletun', role: 'Thick Fat: halves our Fire', tier: 'fringe' },
    ],
    likely: [
      { label: 'Core six (his six biggest picks)', ids: ['golisopod', 'incineroar', 'farigiraf', 'torkoal', 'rotommow', 'mimikyu'], note: 'His most likely single six. Default lead: Charizard + Rotom-Fan.' },
      { label: 'Core, Mr. Rime in (two Trick Rooms, two Fake Outs)', ids: ['golisopod', 'incineroar', 'farigiraf', 'torkoal', 'rotommow', 'mrrime'], note: 'Charizard + Rotom-Fan won 84% of 108 games vs his Mr. Rime sixes.' },
      { label: 'Lycanroc anti-Charizard builds', ids: ['golisopod', 'incineroar', 'farigiraf', 'torkoal', 'mimikyu', 'lycanrocmidnight'], note: 'Our weakest sixes: 64–69% with any lead. Watch for the Lycanroc + Torkoal lead.' },
    ],
  },
  threats: [
    { id: 'torkoal', title: 'Torkoal: sun Eruption under Trick Room', why: 'Under Trick Room, Torkoal (36 Speed) moves first and Eruption hits both of ours: 92–109% to Conkeldurr, 85–100% to Rotom-Fan, 162–192% to Sinistcha. Eruption loses power as Torkoal loses HP.', answer: 'Rain: Pelipper switching in turns sun to rain, which halves Eruption (Conkeldurr 30–36%, Pelipper 23–27%), and rain Weather Ball one-shots Torkoal (170–200%). Wide Guard blocks Eruption for a turn. Charizard resists it (34–40%).', calc: 0 },
    { id: 'lycanrocmidnight', title: 'Don\'t get surprised: Lycanroc-Midnight + Torkoal lead', why: 'No Guard Rock Slide one-shots Charizard (117–138% from the fast Sash set, which also outspeeds Charizard; 163–197% from the slow Life Orb set). Led beside Torkoal, it is our worst lead matchup with every lead we tested: 35–55% across 20 games each.', answer: 'Do not leave Charizard in front of it. Switch Charizard to Pelipper (rain halves Eruption; Rock Slide does 63–76% to Pelipper) and Electroweb with Rotom-Fan to break Lycanroc\'s Sash and slow both. Then Weather Ball Torkoal (170–200%) or Lycanroc (178–211%), or Wide Guard if both are going to spread-attack. Conkeldurr resists Rock: Drain Punch one-shots Lycanroc (166–197%) once its Sash is gone.', calc: 7 },
    { id: 'incineroar', title: 'Don\'t get surprised: Fake Out + Trick Room lead', why: 'His best answer to this six in the engine: Incineroar Fake Outs our attacker while Mimikyu or Mr. Rime sets Trick Room, then Torkoal and Golisopod come in behind it. We won 52–54% of his best sixes built this way (35% of the games where Trick Room went up).', answer: 'Do not try to stop the setter with Taunt (Mimikyu\'s Mental Herb cures it, and Morpeko + Sinistcha leads won 43% overall). Play through it: Charizard + Rotom-Fan was our steadiest lead under Trick Room (77%). Heat Wave the setter side, Protect the Fake Out target, and bring in Pelipper / Conkeldurr, which move early in Trick Room (Conkeldurr 58 Speed). Sinistcha in the back can set Trick Room again to end his.', calc: 18 },
    { id: 'golisopod', title: 'Mega Golisopod (Close Combat set possible)', why: 'Bug/Steel, Tough Claws. The ladder set (Leech Life / Iron Head / Sucker Punch) does about half to Sinistcha (47–56%) and Pelipper (39–47%). The worst-case Close Combat set one-shots Morpeko (247–292%).', answer: 'Charizard sun Heat Wave one-shots it (218–257%): it is the reason Charizard leads. Conkeldurr only chips it (Drain Punch 30–36%, 20–25% after Intimidate).', calc: 12 },
    { id: 'mrrime', title: 'Mr. Rime and Farigiraf: the other Trick Room setters', why: 'Mr. Rime has Fake Out, Trick Room, Freeze-Dry (228–272% to Pelipper) and Psychic (119–140% to Conkeldurr). Farigiraf\'s Armor Tail blocks Fake Out and Mach Punch into his whole side, and it often holds a Focus Sash.', answer: 'Heat Wave one-shots Mr. Rime (123–146%) and does 57–68% to Farigiraf. Hangry Morpeko Aura Wheel one-shots Mr. Rime (131–156%) and nearly Farigiraf (89–105%). Two hits break Farigiraf\'s Sash.', calc: 28 },
    { id: 'rotommow', title: 'Scarf Rotom-Mow and the anti-Anthony six', why: 'Scarf Rotom-Mow (226 Speed) outspeeds all of us: Leaf Storm does 93–110% to Pelipper in rain. Our worst modelled six of his (17%): Chople Incineroar, Will-O-Wisp Rotom-Mow, Thunderbolt Farigiraf (146–172% to Pelipper) and Sash Lycanroc. It answers Charizard, Pelipper and Conkeldurr at once.', answer: 'Heat Wave one-shots Rotom-Mow (172–205%) and Conkeldurr Ice Punch one-shots it (106–127%). If his preview shows Lycanroc and Rotom-Mow together, expect a hard game and keep Charizard safe from Rock Slide.', calc: 22 },
  ],
  team: {
    summary: [
      'Mega Charizard Y and Pelipper give us both weathers. Sun Heat Wave one-shots Mega Golisopod, Rotom-Mow and Mr. Rime, and Charizard resists Eruption. Rain halves Torkoal\'s Fire, Weather Ball one-shots Torkoal and Lycanroc, and Wide Guard blocks his spread moves for a turn. Rotom-Fan floats, adds Electroweb speed control and Thunderbolt, and leads with Charizard. Iron Fist Conkeldurr is the bulky back line: 58 Speed makes it early under Trick Room, Drain Punch one-shots Incineroar and Lycanroc, and Ice Punch one-shots Rotom-Mow.',
      'Sinistcha and Morpeko are mostly preview pressure. Sinistcha\'s Trick Room undoes his, and Taunt Morpeko threatens his setters. The engine rarely brings them, but the six with them beat every alternative we tested.',
    ],
    evidence: '79.6% ±5.1 of 240 engine-vs-engine games with closed sheets against his 20 modelled sixes. It was the only six that did not drop when his Trick Room went up (80% with Trick Room, 79% without). Paired against the same seeds: +3.8 over Aegislash for Sinistcha, +6.3 over Aegislash for Morpeko, and +18 to +19 over the Mega Kangaskhan sixes. Against his best response (his eight best sixes built against this one, 48 engine games each) we win 76%.',
    members: [
      { id: 'charizard', role: 'The Mega: sun Heat Wave', why: 'Heat Wave one-shots Mega Golisopod (218–257%), Rotom-Mow (172–205%) and Mr. Rime (123–146%), and does 57–68% to Farigiraf. It resists Eruption (34–40%) and Leech Life (18–21%). Its weakness is Rock: Lycanroc Rock Slide one-shots it.', spread: 'Modest 32 HP / 32 SpA: 120 Speed (slower than Sash Lycanroc at 147).' },
      { id: 'rotomfan', role: 'Lead partner: Electroweb, Thunderbolt', why: 'Levitate and Flying typing ignore Torkoal\'s Earth Power. Electroweb breaks Sashes and slows his side outside Trick Room; Thunderbolt does 54–64% to Torkoal. Leftovers.', spread: 'Modest 32 HP / 32 SpA: 106 Speed.' },
      { id: 'pelipper', role: 'Rain + Wide Guard', why: 'Switching in turns his sun to rain: Eruption halves (Pelipper takes 23–27%), and Weather Ball one-shots Torkoal (170–200%) and Lycanroc (178–211%) and nearly Incineroar (95–113%). Wide Guard blocks Eruption / Heat Wave / Rock Slide for a turn. Focus Sash, because Freeze-Dry (Mr. Rime) and Thunderbolt (Farigiraf, Rotom) one-shot it.', spread: 'Modest 2 HP / 32 SpA / 32 Spe: 117 Speed.' },
      { id: 'conkeldurr', role: 'Back line: Drain Punch, Mach Punch, Ice Punch', why: 'Drain Punch one-shots Incineroar (104–122%; 69–82% after Intimidate) and Lycanroc (166–197%). Ice Punch one-shots Rotom-Mow (106–127%). It moves before Adamant Golisopod (60) under Trick Room. Mach Punch fails while Farigiraf is in (Armor Tail). Expert Belt.', spread: 'Brave 32 HP / 32 Atk: 58 Speed.' },
      { id: 'sinistcha', role: 'Back-up Trick Room; Rage Powder', why: 'Its own Trick Room ends his. It is weak to his Fire: Flare Blitz in sun does 102–121%, and Eruption 162–192%. Bring it only when his Torkoal is gone or it is raining.', spread: 'Bold 32 HP / 14 Def / 20 SpD, Sitrus Berry: 90 Speed.' },
      { id: 'morpeko', role: 'Preview pressure: Fake Out, Taunt, Aura Wheel', why: 'Hangry Aura Wheel one-shots Mr. Rime (131–156%) and nearly Farigiraf (89–105%). Taunt does nothing to Mimikyu (Mental Herb), and Close Combat Golisopod and Mimikyu Play Rough (151–179%) one-shot it.', spread: 'Jolly 32 Atk / 32 Spe, Life Orb: 163 Speed.' },
    ],
  },
  assumptions: [
    'Round 1 (2026-11-09). Every six of our eight allowed Pokémon (no Simipour / Stunfisk-Galar) was screened with two set packages (100 games each). The best six were then played by the search engine on both sides with closed sheets, 240 games each, against his 20 modelled sixes (weighted by how likely each looks from his draft points and ladder sets).',
    'Then his side: every six of his ten (210, default sets) was played against this one, and his best eight were re-run in the engine. His best plan (Incineroar + a Trick Room setter, Torkoal behind) holds us to 52–54%; overall we win 76% against his best response.',
    'Blind game-1 leads were tested by fixing one bring-4 and lead against all his sixes (240 games each). Charizard + Rotom-Fan with Pelipper + Conkeldurr behind scored 78%, level with the engine choosing per six (80%, paired −2 ±7).',
    'Items are as simmed: Life Orb Morpeko, Expert Belt Conkeldurr, Leftovers Rotom-Fan, Sitrus Sinistcha and Focus Sash Pelipper. They were not tested against alternatives.',
    'His sets come from the ladder modal set plus the worst cases from a full learnset scan: Close Combat Golisopod, Will-O-Wisp / Snarl Incineroar, Yawn Torkoal, Icy Wind Mr. Rime, Aqua Jet Golisopod and Sash Lycanroc. His real sets are unknown (closed sheets).',
    'Doubles, spread x0.75, full HP, no crits. Sun is on for Charizard\'s and Torkoal\'s hits and rain for Pelipper\'s. "After Intimidate" means our attacker is at −1 Attack.',
  ],
  remember: [
    'Blind game 1: lead Charizard + Rotom-Fan, with Pelipper + Conkeldurr behind (78% in the sim, our steadiest lead when his Trick Room goes up).',
    'Mega Charizard turn 1. Sun Heat Wave one-shots Mega Golisopod (218–257%), Rotom-Mow and Mr. Rime.',
    'Lycanroc-Midnight\'s Rock Slide one-shots Charizard (117–138%), and the Sash set is faster. If it leads, Charizard switches out to Pelipper.',
    'Torkoal Eruption in sun does 92–109% to Conkeldurr and 85–100% to Rotom-Fan. Pelipper\'s rain halves it, and rain Weather Ball one-shots Torkoal (170–200%).',
    'Farigiraf\'s Armor Tail: no Fake Out or Mach Punch into either of his Pokémon while it is on the field.',
    'Under his Trick Room the order is Torkoal (36), then Golisopod (54–60) and Conkeldurr (58), then Incineroar / Farigiraf (80). Protect into Eruption, or Wide Guard it.',
  ],
  bring: {
    six: ['charizard', 'sinistcha', 'pelipper', 'morpeko', 'conkeldurr', 'rotomfan'],
    bench: [
      { id: 'kangaskhan', why: 'Mega Kangaskhan sixes scored 18–19 points lower in the engine. His Intimidate, Will-O-Wisp and Close Combat Golisopod (101–119% to it) all hit Kangaskhan, and it would take the Mega slot from Charizard, our only answer to Golisopod.' },
      { id: 'aegislash', why: 'Tested in place of Sinistcha and in place of Morpeko: 3.8 and 6.3 points worse over the same 240 games. It is weak to Fire, and Fire is his whole plan.' },
      { id: 'simipour', why: 'Out (Anthony\'s rule: stats too low).' },
      { id: 'stunfiskgalar', why: 'Out (Anthony\'s rule: stats too low).' },
    ],
    mega: { id: 'charizard', why: 'Charizard Y is the only Mega here. Sun Heat Wave one-shots his Mega Golisopod, Rotom-Mow and Mr. Rime, and it resists his Fire and Bug moves.' },
  },
  previews: [
    { if: 'their 6 includes Lycanroc-Midnight', bring4: ['charizard', 'rotomfan', 'pelipper', 'conkeldurr'], lead: ['charizard', 'rotomfan'],
      note: 'Still the best blind lead (69% of 72 games vs his Lycanroc sixes; other leads 54–68%). If Lycanroc leads beside Torkoal (our worst lead matchup, 35–55% for every lead), switch Charizard to Pelipper on turn 1 and Electroweb with Rotom-Fan.' },
    { if: 'their 6 includes Mr. Rime', bring4: ['charizard', 'rotomfan', 'pelipper', 'conkeldurr'], lead: ['charizard', 'rotomfan'],
      note: '84% of 108 games vs his Mr. Rime sixes. Heat Wave one-shots Mr. Rime (123–146%). Expect two Fake Outs.' },
    { if: 'their 6 includes Torkoal', bring4: ['charizard', 'rotomfan', 'pelipper', 'conkeldurr'], lead: ['charizard', 'rotomfan'],
      note: 'Default game-1 plan: 78% of 240 games vs all his sixes, 77% when his Trick Room went up. Charizard + Conkeldurr with Pelipper + Rotom-Fan behind also scored 78%, but only 68% under Trick Room.' },
    { if: 'their 6 includes Golisopod', bring4: ['charizard', 'rotomfan', 'pelipper', 'conkeldurr'], lead: ['charizard', 'rotomfan'],
      note: 'No Torkoal (rare: 12 games) is better for us: his sun is gone and Charizard sets its own. Same bring.' },
  ],
  leads: [
    { ours: ['charizard', 'rotomfan'], vs: ['farigiraf', 'torkoal'],
      t1: 'Mega Evolve; Heat Wave (Farigiraf 57–68%, Torkoal resists) or Protect Charizard if you expect his Trick Room + Eruption turn. Rotom-Fan Thunderbolt Torkoal (54–64%). No Fake Out: Armor Tail.',
      t2: 'If Trick Room went up, Torkoal moves first: Eruption does 85–100% to Rotom-Fan. Switch Rotom-Fan to Pelipper (rain, Eruption 23–27%) and Weather Ball Torkoal next turn (170–200%).',
      t3: 'Conkeldurr cleans up under Trick Room (Drain Punch Farigiraf 41–48%, Torkoal 38–46%).',
      ifs: ['Sim: 89% of 55 games (his most common lead)'] },
    { ours: ['charizard', 'rotomfan'], vs: ['incineroar', 'mimikyu'],
      t1: 'His Fake Out + Trick Room lead. Mega Evolve. Mimikyu\'s Disguise eats the first hit, and Mental Herb stops Taunt. Heat Wave (breaks Disguise and chips Incineroar 24–29%) and Electroweb with Rotom-Fan, or Protect the Fake Out target.',
      t2: 'Trick Room up: our slow back line is Conkeldurr (58), and Pelipper\'s rain cuts Eruption. Bring them in on his Trick Room turns.',
      t3: 'Conkeldurr Drain Punch Incineroar (104–122%, 69–82% after Intimidate); Mimikyu Play Rough does 65–77% to Conkeldurr.',
      ifs: ['Sim: 73% of 52 games (AI preview 83%)'] },
    { ours: ['charizard', 'rotomfan'], vs: ['farigiraf', 'lycanrocmidnight'],
      t1: 'Lycanroc outspeeds Charizard and Rock Slide one-shots it: Protect Charizard or switch it to Conkeldurr (resists Rock, Close Combat 31–37%). Rotom-Fan Electroweb to break the Sash.',
      t2: 'Conkeldurr Drain Punch Lycanroc (166–197%; the Sash holds only if it was at full HP). Drain Punch is not priority, so Armor Tail does not stop it; Mach Punch it does.',
      t3: 'Charizard back in once Lycanroc is gone.',
      ifs: ['Sim: 82% of 28 games'] },
    { ours: ['charizard', 'rotomfan'], vs: ['lycanrocmidnight', 'torkoal'],
      t1: 'Our worst lead matchup (45% of 20 games with this lead, 35–55% with any lead). Switch Charizard to Pelipper: rain halves Eruption, and Rock Slide does 63–76% to Pelipper. Rotom-Fan Electroweb (breaks Lycanroc\'s Sash, slows both).',
      t2: 'Pelipper Weather Ball Torkoal (170–200%) or Lycanroc (178–211%); Wide Guard if both will spread-attack.',
      t3: 'Conkeldurr for Lycanroc (Drain Punch 166–197%; Mach Punch 89–107% once the Sash is broken).',
      ifs: ['This turn-by-turn line is reasoned from the calcs; the sim only tested the fixed leads, not this switch'] },
  ],
  tells: [
    { see: 'Lycanroc-Midnight on the field', means: 'Rock Slide one-shots Charizard; the Sash set is faster (147 vs 120)', do: 'Charizard out (Pelipper or Conkeldurr in); Electroweb to break the Sash' },
    { see: 'Farigiraf on the field', means: 'Armor Tail: our Fake Out and Mach Punch fail into both his Pokémon', do: 'Use real attacks; Heat Wave + Aura Wheel KO Farigiraf through the Sash' },
    { see: 'Trick Room goes up', means: 'Torkoal moves first: Eruption hits both of ours', do: 'Pelipper in (rain halves Eruption) or Wide Guard; Conkeldurr is fast under Trick Room; Sinistcha can reset it' },
    { see: 'Rotom-Mow locked into one move', means: 'Choice Scarf: 226 Speed, outspeeds all of us', do: 'Protect or switch the target; Heat Wave or Ice Punch one-shots it' },
    { see: 'Golisopod Mega Evolves', means: 'Bug/Steel, Tough Claws: Leech Life heals it', do: 'Heat Wave in sun one-shots it (218–257%). Keep Morpeko away from it (Close Combat set possible)' },
    { see: 'Mimikyu takes a hit without damage', means: 'Disguise is broken; Mental Herb may still block one Taunt', do: 'Hit it again; do not rely on Taunt' },
  ],
  lose: [
    { how: 'Lycanroc Rock Slide removes Charizard, then sun Eruption under Trick Room', fix: 'Charizard never stays in front of Lycanroc; Pelipper\'s rain + Weather Ball for Torkoal and Lycanroc.' },
    { how: 'Fake Out + Trick Room, then Eruption into Rotom-Fan / Conkeldurr', fix: 'Protect into the Eruption turn, or bring Pelipper for rain / Wide Guard; Sinistcha resets Trick Room.' },
    { how: 'Mega Golisopod sweeps once Charizard is gone', fix: 'Keep Charizard healthy for Golisopod: only Heat Wave one-shots it.' },
    { how: 'His anti-Anthony six (Chople Incineroar, Wisp Rotom-Mow, Thunderbolt Farigiraf, Sash Lycanroc)', fix: '17% in the sim. If his preview shows Lycanroc + Rotom-Mow + Farigiraf, expect it: keep Charizard safe and win the weather.' },
  ],
  endgame: [
    'Charizard is the only Golisopod answer: keep it for the Mega.',
    'Pelipper takes the last Torkoal or Lycanroc (one rain Weather Ball each).',
    'Conkeldurr is the late Trick Room attacker: Drain Punch Incineroar / Lycanroc, Ice Punch Rotom-Mow.',
    'Eruption weakens as Torkoal is hit: chip Torkoal early (Thunderbolt 54–64%) even if it does not KO.',
  ],
  combos: {
    theirs: [
      { attackers: [['torkoal', 'eruption'], ['golisopodmega', 'leechlife']], into: 'sinistcha', range: '209–248%', answer: 'Sinistcha only comes in once Torkoal is gone or it is raining.' },
      { attackers: [['lycanrocmidnight', 'rockslide'], ['torkoal', 'eruption']], into: 'rotomfan', range: '138–165%', answer: 'Both are spread moves: Pelipper Wide Guard blocks both for a turn.' },
    ],
    ours: [
      { attackers: [['charizardmegay', 'heatwave'], ['morpeko', 'aurawheel']], into: 'farigiraf', range: '146–173%', verdict: 'KO (two hits break the Sash; Hangry Aura Wheel)' },
      { attackers: [['conkeldurr', 'drainpunch'], ['rotomfan', 'thunderbolt']], into: 'incineroar', range: '99–118%', verdict: 'KO after Intimidate on most rolls' },
    ],
  },
  calcs: [
    { attacker: TORK, defender: CONK, move: 'eruption', field: SUN, range: '92.0–109.0%', verdict: 'Likely OHKO', why: 'Full-HP Eruption in sun under Trick Room' },
    { attacker: TORK, defender: ROTOMF, move: 'eruption', field: SUN, range: '84.7–100.0%', verdict: 'Rarely OHKO', why: 'Rotom-Fan takes it; Leftovers back' },
    { attacker: TORK, defender: SINIS, move: 'eruption', field: SUN, range: '161.8–192.1%', verdict: 'OHKO', why: 'Sinistcha never in front of Torkoal in sun' },
    { attacker: TORK, defender: ZARD, move: 'eruption', field: SUN, range: '34.1–40.0%', verdict: '3HKO', why: 'Charizard resists Fire' },
    { attacker: TORK, defender: PEL, move: 'eruption', field: RAIN, range: '22.6–27.0%', verdict: '4HKO', why: 'Rain halves his Fire' },
    { attacker: TORK, defender: CONK, move: 'eruption', field: RAIN, range: '30.2–35.8%', verdict: '3HKO', why: 'Conkeldurr is safe from Eruption in rain' },
    { attacker: TORK, defender: PEL, move: 'weatherball', field: RAIN, range: '34.3–40.9%', verdict: '3HKO', why: 'In rain his Weather Ball turns Water' },
    { attacker: LYC, defender: ZARD, move: 'rockslide', field: SUN, range: '116.8–138.4%', verdict: 'OHKO', why: 'Sash Lycanroc (147) outspeeds Charizard (120); No Guard never misses' },
    { attacker: LYC_TR, defender: ZARD, move: 'rockslide', field: SUN, range: '163.2–196.8%', verdict: 'OHKO', why: 'Life Orb Trick Room set' },
    { attacker: LYC, defender: ROTOMF, move: 'rockslide', field: {}, range: '53.5–65.0%', verdict: '2HKO', why: '' },
    { attacker: LYC, defender: PEL, move: 'rockslide', field: RAIN, range: '62.8–75.9%', verdict: '2HKO', why: 'Pelipper survives a switch-in' },
    { attacker: LYC, defender: CONK, move: 'closecombat', field: {}, range: '31.1–36.8%', verdict: '3HKO', why: 'Conkeldurr resists Rock too' },
    { attacker: GOLI_CC, defender: MORPEKO, move: 'closecombat', field: {}, range: '247.4–291.9%', verdict: 'OHKO', why: 'Worst-case set' },
    { attacker: GOLI, defender: SINIS, move: 'leechlife', field: {}, range: '47.2–56.2%', verdict: '2HKO', why: '' },
    { attacker: GOLI, defender: PEL, move: 'leechlife', field: {}, range: '39.4–46.7%', verdict: '3HKO', why: '' },
    { attacker: GOLI, defender: CONK, move: 'leechlife', field: {}, range: '26.9–31.6%', verdict: '4HKO', why: '' },
    { attacker: GOLI, defender: ROTOMF, move: 'ironhead', field: {}, range: '32.5–38.2%', verdict: '3HKO', why: '' },
    { attacker: GOLI, defender: ZARD, move: 'leechlife', field: {}, range: '17.8–21.1%', verdict: '5HKO', why: 'Charizard resists Bug 4x' },
    { attacker: INCIN, defender: SINIS, move: 'flareblitz', field: SUN, range: '102.2–121.3%', verdict: 'OHKO', why: 'Fire in sun' },
    { attacker: INCIN, defender: SINIS, move: 'darkestlariat', field: {}, range: '47.2–57.3%', verdict: '2HKO', why: '' },
    { attacker: INCIN, defender: CONK, move: 'flareblitz', field: SUN, range: '55.7–66.5%', verdict: '2HKO', why: '' },
    { attacker: FARI, defender: PEL, move: 'thunderbolt', field: RAIN, range: '146.0–172.3%', verdict: 'OHKO (Sash holds at full HP)', why: '' },
    { attacker: MOW, defender: PEL, move: 'leafstorm', field: RAIN, range: '92.7–110.2%', verdict: 'Likely OHKO (Sash holds)', why: 'Scarf: 226 Speed' },
    { attacker: MOW, defender: CONK, move: 'leafstorm', field: {}, range: '62.7–74.1%', verdict: '2HKO', why: '' },
    { attacker: MIMI, defender: CONK, move: 'playrough', field: {}, range: '65.1–77.4%', verdict: '2HKO', why: '' },
    { attacker: MIMI, defender: MORPEKO, move: 'playrough', field: {}, range: '151.1–179.3%', verdict: 'OHKO', why: '' },
    { attacker: RIME, defender: PEL, move: 'freezedry', field: RAIN, range: '227.7–271.5%', verdict: 'OHKO (Sash holds at full HP)', why: '' },
    { attacker: RIME, defender: ROTOMF, move: 'freezedry', field: {}, range: '70.1–84.1%', verdict: '2HKO', why: '' },
    { attacker: RIME, defender: CONK, move: 'psychic', field: {}, range: '118.9–139.6%', verdict: 'OHKO', why: 'Kill Mr. Rime before Conkeldurr comes in' },
    { attacker: ROTOM, defender: PEL, move: 'thunderbolt', field: RAIN, range: '265.7–315.3%', verdict: 'OHKO (Sash holds at full HP)', why: '' },
    { attacker: ZARD, defender: GOLI, move: 'heatwave', field: SUN, range: '217.6–257.1%', verdict: 'OHKO', why: 'Our only one-shot on his Mega' },
    { attacker: ZARD, defender: FARI, move: 'heatwave', field: SUN, range: '57.2–67.6%', verdict: '2HKO', why: '' },
    { attacker: ZARD, defender: RIME, move: 'heatwave', field: SUN, range: '123.0–145.5%', verdict: 'OHKO', why: '' },
    { attacker: ZARD, defender: MOW, move: 'heatwave', field: SUN, range: '171.7–204.7%', verdict: 'OHKO', why: '' },
    { attacker: ZARD, defender: INCIN, move: 'heatwave', field: SUN, range: '24.3–28.7%', verdict: '4HKO', why: 'Incineroar resists Fire' },
    { attacker: ZARD, defender: APPLE, move: 'heatwave', field: SUN, range: '31.8–37.8%', verdict: '3HKO', why: 'Thick Fat' },
    { attacker: ZARD, defender: TORK, move: 'solarbeam', field: SUN, range: '32.2–37.9%', verdict: '3HKO', why: '' },
    { attacker: ZARD, defender: LYC, move: 'solarbeam', field: SUN, range: '135.8–160.5%', verdict: 'OHKO (not through Sash)', why: '' },
    { attacker: PEL, defender: TORK, move: 'weatherball', field: RAIN, range: '169.5–200.0%', verdict: 'OHKO', why: 'Pelipper (117) outspeeds Torkoal outside Trick Room' },
    { attacker: PEL, defender: INCIN, move: 'weatherball', field: RAIN, range: '95.0–112.9%', verdict: 'Likely OHKO', why: '' },
    { attacker: PEL, defender: LYC, move: 'weatherball', field: RAIN, range: '177.8–211.1%', verdict: 'OHKO (not through Sash)', why: '' },
    { attacker: PEL, defender: GOLI, move: 'hurricane', field: RAIN, range: '38.5–46.2%', verdict: '3HKO', why: '' },
    { attacker: PEL, defender: FARI, move: 'weatherball', field: RAIN, range: '56.8–66.7%', verdict: '2HKO', why: '' },
    { attacker: CONK, defender: INCIN, move: 'drainpunch', field: {}, range: '103.5–122.3%', verdict: 'OHKO', why: 'Without Intimidate' },
    { attacker: CONK, defender: INCIN, move: 'drainpunch', field: INTIM, range: '68.8–82.2%', verdict: '2HKO', why: 'After Intimidate' },
    { attacker: CONK, defender: GOLI, move: 'drainpunch', field: {}, range: '30.2–36.3%', verdict: '3HKO', why: '' },
    { attacker: CONK, defender: GOLI, move: 'drainpunch', field: INTIM, range: '20.3–24.7%', verdict: '5HKO', why: 'After Intimidate' },
    { attacker: CONK, defender: LYC, move: 'drainpunch', field: {}, range: '166.0–196.9%', verdict: 'OHKO (not through Sash)', why: '' },
    { attacker: CONK, defender: FARI, move: 'drainpunch', field: {}, range: '40.5–47.7%', verdict: '3HKO', why: '' },
    { attacker: CONK, defender: TORK, move: 'drainpunch', field: {}, range: '37.9–45.8%', verdict: '3HKO', why: '' },
    { attacker: CONK, defender: MOW, move: 'icepunch', field: {}, range: '105.5–126.8%', verdict: 'OHKO', why: '' },
    { attacker: CONK, defender: APPLE, move: 'icepunch', field: {}, range: '79.7–94.9%', verdict: '2HKO', why: '' },
    { attacker: CONK, defender: LYC, move: 'machpunch', field: {}, range: '88.9–106.8%', verdict: 'Possible OHKO', why: 'Only once the Sash is gone; fails while Farigiraf is in' },
    { attacker: ROTOMF, defender: GOLI, move: 'airslash', field: {}, range: '28.0–33.5%', verdict: '4HKO', why: '' },
    { attacker: ROTOMF, defender: TORK, move: 'thunderbolt', field: {}, range: '54.2–64.4%', verdict: '2HKO', why: 'Weakens his Eruption' },
    { attacker: ROTOMF, defender: INCIN, move: 'thunderbolt', field: {}, range: '30.2–36.1%', verdict: '3HKO', why: '' },
    { attacker: MORPEKO_HANGRY, defender: FARI, move: 'aurawheel', field: {}, range: '89.2–105.4%', verdict: 'Possible OHKO', why: 'Hangry (Dark)' },
    { attacker: MORPEKO_HANGRY, defender: RIME, move: 'aurawheel', field: {}, range: '130.5–155.6%', verdict: 'OHKO', why: 'Hangry (Dark)' },
    { attacker: MORPEKO, defender: TORK, move: 'aurawheel', field: {}, range: '42.4–50.8%', verdict: '2HKO', why: 'Full Belly (Electric)' },
    { attacker: SINIS, defender: LYC, move: 'matchagotcha', field: {}, range: '63.0–74.1%', verdict: '2HKO', why: '' },
    { attacker: SINIS, defender: TORK, move: 'matchagotcha', field: {}, range: '14.1–16.9%', verdict: 'Weak', why: '' },
  ],
  perMon: {
    torkoal: { role: 'Drought sun Eruption; 36 Speed (first under Trick Room)', worstCase: 'Eruption 92–109% Conkeldurr, 162–192% Sinistcha in sun', answer: 'Rain: Pelipper Weather Ball 170–200%; Wide Guard; Rotom-Fan Thunderbolt 54–64% weakens Eruption' },
    golisopod: { role: 'Mega (Bug/Steel, Tough Claws): Leech Life / Iron Head / Sucker Punch', worstCase: 'Close Combat set: Morpeko 247–292%', answer: 'Charizard sun Heat Wave 218–257%' },
    incineroar: { role: 'Fake Out, Intimidate, Parting Shot; Will-O-Wisp / Chople sets possible', worstCase: 'Flare Blitz in sun on Sinistcha 102–121%', answer: 'Conkeldurr Drain Punch 104–122% (69–82% after Intimidate); Pelipper Weather Ball 95–113%' },
    farigiraf: { role: 'Trick Room; Armor Tail blocks our priority into his side; Focus Sash or Sitrus', worstCase: 'Thunderbolt set: Pelipper 146–172%', answer: 'Heat Wave 57–68% + Hangry Aura Wheel 89–105%' },
    mimikyu: { role: 'Trick Room setter; Disguise; Mental Herb (Taunt fails once)', worstCase: 'Play Rough Morpeko 151–179%, Conkeldurr 65–77%', answer: 'Break Disguise with a spread move (Heat Wave), then hit it again' },
    mrrime: { role: 'Fake Out + Trick Room; Freeze-Dry', worstCase: 'Freeze-Dry Pelipper 228–272%; Psychic Conkeldurr 119–140%', answer: 'Heat Wave 123–146%; Hangry Aura Wheel 131–156%' },
    rotommow: { role: 'Choice Scarf (226): Leaf Storm / Volt Switch / Trick', worstCase: 'Leaf Storm Pelipper 93–110%', answer: 'Heat Wave 172–205%; Conkeldurr Ice Punch 106–127%' },
    lycanrocmidnight: { role: 'No Guard Rock Slide; Sash (147 Speed) or Life Orb Trick Room set', worstCase: 'Rock Slide Charizard 117–197%', answer: 'Pelipper Weather Ball 178–211% / Conkeldurr Drain Punch 166–197% after the Sash breaks' },
    charizard: { job: 'Mega: sun Heat Wave one-shots Golisopod, Rotom-Mow, Mr. Rime', avoid: 'Lycanroc-Midnight on the field' },
    rotomfan: { job: 'Lead partner: Electroweb (breaks Sashes, slows), Thunderbolt Torkoal 54–64%', avoid: 'Sun Eruption under Trick Room (85–100%)' },
    pelipper: { job: 'Rain + Wide Guard; Weather Ball Torkoal / Lycanroc', avoid: 'Mr. Rime Freeze-Dry, Farigiraf / Rotom Thunderbolt (Sash only)' },
    conkeldurr: { job: 'Trick Room-speed back line: Drain Punch Incineroar / Lycanroc, Ice Punch Rotom-Mow', avoid: 'Sun Eruption (92–109%), Mr. Rime Psychic (119–140%)' },
    sinistcha: { job: 'Reset his Trick Room; Rage Powder', avoid: 'Torkoal in sun, Incineroar Flare Blitz in sun' },
    morpeko: { job: 'Preview pressure; Hangry Aura Wheel Mr. Rime / Farigiraf', avoid: 'Golisopod Close Combat, Mimikyu Play Rough; Taunt into Mimikyu (Mental Herb)' },
  },
  sets: `Charizard @ Charizardite Y
Ability: Blaze
Level: 50
EVs: 32 HP / 32 SpA / 2 SpD
Modest Nature
- Heat Wave
- Weather Ball
- Solar Beam
- Protect

Sinistcha @ Sitrus Berry
Ability: Hospitality
Level: 50
EVs: 32 HP / 14 Def / 20 SpD
Bold Nature
- Matcha Gotcha
- Rage Powder
- Trick Room
- Life Dew

Pelipper @ Focus Sash
Ability: Drizzle
Level: 50
EVs: 2 HP / 32 SpA / 32 Spe
Modest Nature
- Hurricane
- Weather Ball
- Tailwind
- Wide Guard

Morpeko @ Life Orb
Ability: Hunger Switch
Level: 50
EVs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Fake Out
- Aura Wheel
- Taunt
- Protect

Conkeldurr @ Expert Belt
Ability: Iron Fist
Level: 50
EVs: 32 HP / 32 Atk / 2 SpD
Brave Nature
- Drain Punch
- Mach Punch
- Ice Punch
- Protect

Rotom-Fan @ Leftovers
Ability: Levitate
Level: 50
EVs: 32 HP / 32 SpA / 2 SpD
Modest Nature
- Electroweb
- Thunderbolt
- Air Slash
- Protect
`,
};

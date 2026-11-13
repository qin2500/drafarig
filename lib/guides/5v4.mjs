// Guide: Anthony (seat 5) vs Jacky (seat 4), Week 5. Evidence: docs/research/strategy/sim/jacky-report.md; calcs: sim/scripts/jacky-guide-calcs.mjs.

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

const K = (attacker, defender, move, range, verdict, why = '', field = {}) => ({ attacker, defender, move, field, range, verdict, ...(why ? { why } : {}) });
const G = {
  version: 2, pov: 5, opp: 4, coach: 'Jacky', week: 5, written: '2026-11-10', updated: '2026-11-10',
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
    { id: 'lycanrocmidnight', title: 'Don\'t get surprised: Lycanroc-Midnight + Torkoal lead', why: 'No Guard Rock Slide one-shots Charizard (117–138% from the fast Sash set, which also outspeeds Charizard; 163–197% from the slow Life Orb set). Led beside Torkoal, it is our worst lead matchup with every lead we tested: 35–55% across 20 games each.', answer: 'When Lycanroc is in his six, bring only two Flying types: lead Sinistcha + Conkeldurr, with Pelipper + Charizard behind (78% of 96 games vs his Lycanroc sixes, +9 ±10 over the default lead; 84% when his Trick Room went up). Rock Slide does 11–13% to Conkeldurr and 19–24% to Sinistcha. Mach Punch (priority) breaks the Sash (89–107%), then Drain Punch (166–197%). Do not pivot Charizard into Pelipper in front of it: Rock Slide + rain Eruption do 86–103% to Pelipper and 81–98% to Rotom-Fan on that turn.', calc: 7 },
    { id: 'incineroar', title: 'Don\'t get surprised: Fake Out + Trick Room lead', why: 'His best answer to this six in the engine: Incineroar Fake Outs our attacker while Mimikyu or Mr. Rime sets Trick Room, then Torkoal and Golisopod come in behind it. We won 52–54% of his best sixes built this way (35% of the games where Trick Room went up).', answer: 'Do not try to stop the setter with Taunt (Mimikyu\'s Mental Herb cures it, and Morpeko + Sinistcha leads won 43% overall). Play through it: Charizard + Rotom-Fan was our steadiest lead under Trick Room (77%). Heat Wave the setter side, Protect the Fake Out target, and bring in Pelipper / Conkeldurr, which move early in Trick Room (Conkeldurr 58 Speed). Sinistcha in the back can set Trick Room again to end his.', calc: 18 },
    { id: 'golisopod', title: 'Mega Golisopod (Close Combat set possible)', why: 'Bug/Steel, Tough Claws. The ladder set (Leech Life / Iron Head / Sucker Punch) does about half to Sinistcha (47–56%) and Pelipper (39–47%). The worst-case Close Combat set one-shots Morpeko (247–292%).', answer: 'Charizard sun Heat Wave one-shots it (218–257%): it is the reason Charizard leads. Conkeldurr only chips it (Drain Punch 30–36%, 20–25% after Intimidate).', calc: 12 },
    { id: 'mrrime', title: 'Mr. Rime and Farigiraf: the other Trick Room setters', why: 'Mr. Rime has Fake Out, Trick Room, Freeze-Dry (228–272% to Pelipper) and Psychic (119–140% to Conkeldurr). Farigiraf\'s Armor Tail blocks Fake Out and Mach Punch into his whole side, and it often holds a Focus Sash.', answer: 'Heat Wave one-shots Mr. Rime (123–146%) and does 57–68% to Farigiraf. Hangry Morpeko Aura Wheel one-shots Mr. Rime (131–156%) and nearly Farigiraf (89–105%). Two hits break Farigiraf\'s Sash.', calc: 28 },
    { id: 'rotommow', title: 'Scarf Rotom-Mow and the anti-Anthony six', why: 'Scarf Rotom-Mow (226 Speed) outspeeds all of us: Leaf Storm does 93–110% to Pelipper in rain. Our worst modelled six of his (17%): Chople Incineroar, Will-O-Wisp Rotom-Mow, Thunderbolt Farigiraf (146–172% to Pelipper) and Sash Lycanroc. It answers Charizard, Pelipper and Conkeldurr at once.', answer: 'Heat Wave one-shots Rotom-Mow (172–205%) and Conkeldurr Ice Punch one-shots it (106–127%). If his preview shows Lycanroc and Rotom-Mow together, leave Charizard home (see Preview).', calc: 22 },
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
    'Items are as simmed: Life Orb Morpeko, Expert Belt Conkeldurr, Leftovers Rotom-Fan, Sitrus Sinistcha and Focus Sash Pelipper. They were not tested against alternatives. Fire Punch for Ice Punch on Conkeldurr was tested (240 paired engine games): −2.1 ±4.4, a tie. Fire Punch one-shots Mega Golisopod in sun even after Intimidate (100–119%), but the sim\'s Jacky brought Golisopod in only 22 of 240 games; Ice Punch\'s only exclusive target is Appletun.',
    'His sets come from the ladder modal set plus the worst cases from a full learnset scan: Close Combat Golisopod, Will-O-Wisp / Snarl Incineroar, Yawn Torkoal, Icy Wind Mr. Rime, Aqua Jet Golisopod and Sash Lycanroc. His real sets are unknown (closed sheets).',
    'Doubles, spread x0.75, full HP, no crits. Sun is on for Charizard\'s and Torkoal\'s hits and rain for Pelipper\'s. "After Intimidate" means our attacker is at −1 Attack.',
  ],
  remember: [
    'Blind game 1: lead Charizard + Rotom-Fan, with Pelipper + Conkeldurr behind (78% in the sim, our steadiest lead when his Trick Room goes up).',
    'Mega Charizard turn 1. Sun Heat Wave one-shots Mega Golisopod (218–257%), Rotom-Mow and Mr. Rime.',
    'Lycanroc-Midnight in his six: bring Sinistcha, Conkeldurr, Pelipper, Charizard and lead Sinistcha + Conkeldurr (only two Flying types). Rock Slide one-shots Charizard (117–138%), and the Sash set is faster.',
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
    { if: 'their 6 includes Lycanroc-Midnight+Rotom-Mow', bring4: ['sinistcha', 'conkeldurr', 'pelipper', 'rotomfan'], lead: ['sinistcha', 'conkeldurr'],
      note: 'His anti-Charizard six: leave Charizard home. 80% vs 70% with Charizard (288 paired games, +10 ±7); vs his tuned sets 64% vs 50%. Never bring a four without Pelipper here (19–23%).' },
    { if: 'their 6 includes Lycanroc-Midnight', bring4: ['sinistcha', 'conkeldurr', 'pelipper', 'charizard'], lead: ['sinistcha', 'conkeldurr'],
      note: 'Two Flying types, not three. 78% of 96 games (Charizard + Rotom-Fan lead 69%); 84% under his Trick Room. Into Lycanroc + Torkoal 52%, his best lead into us.' },
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
    { ours: ['sinistcha', 'conkeldurr'], vs: ['lycanrocmidnight', 'torkoal'],
      t1: 'Our worst lead matchup in every test. Conkeldurr Mach Punch Lycanroc (priority, 89–107%: breaks the Sash or KOs); Sinistcha Rage Powder or Matcha Gotcha Lycanroc (63–74%). Rock Slide does only 11–13% to Conkeldurr and 19–24% to Sinistcha; sun Eruption is the danger (Conkeldurr 92–109%, Sinistcha 162–192%), so Protect the one he targets if you can read it.',
      t2: 'Pelipper in for rain (Eruption drops to 30–36% on Conkeldurr) and Weather Ball Torkoal (170–200%).',
      t3: 'Charizard last, once Lycanroc is gone.',
      ifs: ['Sim: 52% of 21 games with this lead (Pelipper + Conkeldurr lead 62%, Charizard + Rotom-Fan 43%)', 'Do NOT pivot Charizard into Pelipper here: Rock Slide + rain Eruption do 86–103% to Pelipper and 81–98% to Rotom-Fan that turn'] },
  ],
  tells: [
    { see: 'Lycanroc-Midnight on the field', means: 'Rock Slide one-shots Charizard; the Sash set is faster (147 vs 120)', do: 'Charizard out (Conkeldurr or Sinistcha in: Rock Slide does 11–13% / 19–24%); Mach Punch breaks the Sash' },
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
    { how: 'His anti-Anthony six (Chople Incineroar, Wisp Rotom-Mow, Thunderbolt Farigiraf, Sash Lycanroc)', fix: 'Lycanroc + Rotom-Mow in his preview: leave Charizard home and bring Sinistcha, Conkeldurr, Pelipper, Rotom-Fan (64% vs 50%).' },
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
    K(TORK, CONK, 'eruption', '92.0–109.0%', 'Likely OHKO', 'Full-HP Eruption in sun under Trick Room', SUN),
    K(TORK, ROTOMF, 'eruption', '84.7–100.0%', 'Rarely OHKO', 'Rotom-Fan takes it; Leftovers back', SUN),
    K(TORK, SINIS, 'eruption', '161.8–192.1%', 'OHKO', 'Sinistcha never in front of Torkoal in sun', SUN),
    K(TORK, ZARD, 'eruption', '34.1–40.0%', '3HKO', 'Charizard resists Fire', SUN),
    K(TORK, PEL, 'eruption', '22.6–27.0%', '4HKO', 'Rain halves his Fire', RAIN),
    K(TORK, CONK, 'eruption', '30.2–35.8%', '3HKO', 'Conkeldurr is safe from Eruption in rain', RAIN),
    K(TORK, PEL, 'weatherball', '34.3–40.9%', '3HKO', 'In rain his Weather Ball turns Water', RAIN),
    K(LYC, ZARD, 'rockslide', '116.8–138.4%', 'OHKO', 'Sash Lycanroc (147) outspeeds Charizard (120); No Guard never misses', SUN),
    K(LYC_TR, ZARD, 'rockslide', '163.2–196.8%', 'OHKO', 'Life Orb Trick Room set', SUN),
    K(LYC, ROTOMF, 'rockslide', '53.5–65.0%', '2HKO'),
    K(LYC, PEL, 'rockslide', '62.8–75.9%', '2HKO', 'Pelipper survives a switch-in', RAIN),
    K(LYC, CONK, 'closecombat', '31.1–36.8%', '3HKO', 'Conkeldurr resists Rock too'),
    K(GOLI_CC, MORPEKO, 'closecombat', '247.4–291.9%', 'OHKO', 'Worst-case set'),
    K(GOLI, SINIS, 'leechlife', '47.2–56.2%', '2HKO'),
    K(GOLI, PEL, 'leechlife', '39.4–46.7%', '3HKO'),
    K(GOLI, CONK, 'leechlife', '26.9–31.6%', '4HKO'),
    K(GOLI, ROTOMF, 'ironhead', '32.5–38.2%', '3HKO'),
    K(GOLI, ZARD, 'leechlife', '17.8–21.1%', '5HKO', 'Charizard resists Bug 4x'),
    K(INCIN, SINIS, 'flareblitz', '102.2–121.3%', 'OHKO', 'Fire in sun', SUN),
    K(INCIN, SINIS, 'darkestlariat', '47.2–57.3%', '2HKO'),
    K(INCIN, CONK, 'flareblitz', '55.7–66.5%', '2HKO', '', SUN),
    K(FARI, PEL, 'thunderbolt', '146.0–172.3%', 'OHKO (Sash holds at full HP)', '', RAIN),
    K(MOW, PEL, 'leafstorm', '92.7–110.2%', 'Likely OHKO (Sash holds)', 'Scarf: 226 Speed', RAIN),
    K(MOW, CONK, 'leafstorm', '62.7–74.1%', '2HKO'),
    K(MIMI, CONK, 'playrough', '65.1–77.4%', '2HKO'),
    K(MIMI, MORPEKO, 'playrough', '151.1–179.3%', 'OHKO'),
    K(RIME, PEL, 'freezedry', '227.7–271.5%', 'OHKO (Sash holds at full HP)', '', RAIN),
    K(RIME, ROTOMF, 'freezedry', '70.1–84.1%', '2HKO'),
    K(RIME, CONK, 'psychic', '118.9–139.6%', 'OHKO', 'Kill Mr. Rime before Conkeldurr comes in'),
    K(ROTOM, PEL, 'thunderbolt', '265.7–315.3%', 'OHKO (Sash holds at full HP)', '', RAIN),
    K(ZARD, GOLI, 'heatwave', '217.6–257.1%', 'OHKO', 'Our only one-shot on his Mega', SUN),
    K(ZARD, FARI, 'heatwave', '57.2–67.6%', '2HKO', '', SUN),
    K(ZARD, RIME, 'heatwave', '123.0–145.5%', 'OHKO', '', SUN),
    K(ZARD, MOW, 'heatwave', '171.7–204.7%', 'OHKO', '', SUN),
    K(ZARD, INCIN, 'heatwave', '24.3–28.7%', '4HKO', 'Incineroar resists Fire', SUN),
    K(ZARD, APPLE, 'heatwave', '31.8–37.8%', '3HKO', 'Thick Fat', SUN),
    K(ZARD, TORK, 'solarbeam', '32.2–37.9%', '3HKO', '', SUN),
    K(ZARD, LYC, 'solarbeam', '135.8–160.5%', 'OHKO (not through Sash)', '', SUN),
    K(PEL, TORK, 'weatherball', '169.5–200.0%', 'OHKO', 'Pelipper (117) outspeeds Torkoal outside Trick Room', RAIN),
    K(PEL, INCIN, 'weatherball', '95.0–112.9%', 'Likely OHKO', '', RAIN),
    K(PEL, LYC, 'weatherball', '177.8–211.1%', 'OHKO (not through Sash)', '', RAIN),
    K(PEL, GOLI, 'hurricane', '38.5–46.2%', '3HKO', '', RAIN),
    K(PEL, FARI, 'weatherball', '56.8–66.7%', '2HKO', '', RAIN),
    K(CONK, INCIN, 'drainpunch', '103.5–122.3%', 'OHKO', 'Without Intimidate'),
    K(CONK, INCIN, 'drainpunch', '68.8–82.2%', '2HKO', 'After Intimidate', INTIM),
    K(CONK, GOLI, 'drainpunch', '30.2–36.3%', '3HKO'),
    K(CONK, GOLI, 'drainpunch', '20.3–24.7%', '5HKO', 'After Intimidate', INTIM),
    K(CONK, LYC, 'drainpunch', '166.0–196.9%', 'OHKO (not through Sash)'),
    K(CONK, FARI, 'drainpunch', '40.5–47.7%', '3HKO'),
    K(CONK, TORK, 'drainpunch', '37.9–45.8%', '3HKO'),
    K(CONK, MOW, 'icepunch', '105.5–126.8%', 'OHKO'),
    K(CONK, APPLE, 'icepunch', '79.7–94.9%', '2HKO'),
    K(CONK, LYC, 'machpunch', '88.9–106.8%', 'Possible OHKO', 'Only once the Sash is gone; fails while Farigiraf is in'),
    K(ROTOMF, GOLI, 'airslash', '28.0–33.5%', '4HKO'),
    K(ROTOMF, TORK, 'thunderbolt', '54.2–64.4%', '2HKO', 'Weakens his Eruption'),
    K(ROTOMF, INCIN, 'thunderbolt', '30.2–36.1%', '3HKO'),
    K(MORPEKO_HANGRY, FARI, 'aurawheel', '89.2–105.4%', 'Possible OHKO', 'Hangry (Dark)'),
    K(MORPEKO_HANGRY, RIME, 'aurawheel', '130.5–155.6%', 'OHKO', 'Hangry (Dark)'),
    K(MORPEKO, TORK, 'aurawheel', '42.4–50.8%', '2HKO', 'Full Belly (Electric)'),
    K(SINIS, LYC, 'matchagotcha', '63.0–74.1%', '2HKO'),
    K(SINIS, TORK, 'matchagotcha', '14.1–16.9%', 'Weak'),
    K(LYC, CONK, 'rockslide', '10.8–12.7%', 'Minimal', 'Conkeldurr resists Rock'),
    K(LYC, SINIS, 'rockslide', '19.1–23.6%', '5HKO'),
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

// Alternatives (index.mjs applyAlt), jacky-report.md §7. Aegislash for Morpeko, Life Orb Conkeldurr (as simmed); main-six sim numbers dropped.
const CONK_LO = { ...CONK, item: 'lifeorb' };
const AEGI = { id: 'aegislash', set: 'ours', ability: 'stancechange', item: 'kasibberry', nature: 'Brave', sp: SP(32, 32, 2, 0, 0, 0) };
const AEGIB = { ...AEGI, form: 'blade' };
const KANGA = { id: 'kangaskhan', set: 'ours', ability: 'scrappy', item: 'silkscarf', nature: 'Adamant', sp: SP(32, 32, 2, 0, 0, 0) };
const GOLI_W = { ...GOLI, set: 'worst' };
const LO = { '103.5–122.3%': '111.9–132.7%', '68.8–82.2%': '74.8–88.6%', '30.2–36.3%': '39.0–47.3%', '20.3–24.7%': '26.4–31.9%', '166.0–196.9%': '179.6–213.6%',
  '40.5–47.7%': '52.7–62.2%', '37.9–45.8%': '49.2–59.3%', '105.5–126.8%': '115.0–137.0%', '79.7–94.9%': '86.2–103.2%', '88.9–106.8%': '96.3–115.4%' };
const swap = (pairs) => { const f = (x) => (typeof x === 'string' ? pairs.reduce((s, [a, b]) => s.split(a).join(b), x) : Array.isArray(x) ? x.map(f) : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, f(v)])) : x); return f; };
const lo = swap([['104–122%', '112–133%'], ['69–82%', '75–89%'], ['166–197%', '180–214%'], ['106–127%', '115–137%'], ['41–48%', '53–62%'], ['38–46%', '49–59%'],
  ['89–107%', '96–115%'], ['Drain Punch 30–36%, 20–25%', 'Drain Punch 39–47%, 26–32%'],
  [' (64% vs 50%)', ''], [' (17%)', ''], [' with every lead we tested: 35–55% across 20 games each', ' in the main six\'s tests'], [' in every test (35–55%)', ''],
  ['against this exact six', 'against the main six'], [' (we won 52–54% of those games)', ''], ['to this six in the engine', 'to the main six in the engine'],
  [' We won 52–54% of his best sixes built this way (35% of the games where Trick Room went up).', ''], ['Our worst lead matchup in every test.', 'The main six\'s worst lead matchup.']]);
const toKanga = swap([['85–100% to Rotom-Fan', '81–95% to Kangaskhan'], ['Rotom-Fan Thunderbolt 54–64% weakens Eruption', 'Kangaskhan Double-Edge 46–55%'],
  ['(Thunderbolt 54–64%)', '(Kangaskhan Double-Edge 46–55%)'], ['Rotom-Fan', 'Kangaskhan']]);
const AEGI_CALCS = [
  K(AEGIB, GOLI, 'poltergeist', '36.8–44.5%', '3HKO', 'Blade Forme'),
  K(AEGIB, RIME, 'poltergeist', '144.4–171.1%', 'OHKO'),
  K(AEGIB, TORK, 'poltergeist', '46.3–54.8%', '2HKO'),
  K(GOLI, AEGI, 'leechlife', '12.0–14.4%', 'Minimal', 'Close Combat cannot touch it (Ghost)'),
  K(GOLI, AEGI, 'ironhead', '24.0–28.7%', '4HKO'),
  K(TORK, AEGI, 'eruption', '129.3–152.1%', 'OHKO', 'Why the plan keeps it away from Torkoal', SUN),
  K(INCIN, AEGI, 'flareblitz', '104.2–123.4%', 'OHKO', '', SUN),
  K(GOLI_W, ZARD, 'rockslide', '103.8–123.2%', 'Likely OHKO', 'Rock Slide set (legal; not seen on ladder)', SUN),
];
const KANGA_CALCS = [
  K(KANGA, MIMI, 'fakeout', '12.3–12.3%', 'Breaks Disguise', 'Scrappy: Normal moves hit Ghost; flinches the Trick Room turn'),
  K(KANGA, TORK, 'doubleedge', '46.3–54.8%', '2HKO'),
  K(KANGA, INCIN, 'doubleedge', '52.5–62.4%', '2HKO', 'Scrappy ignores Intimidate'),
  K(KANGA, FARI, 'doubleedge', '49.1–58.1%', '2HKO'),
  K(KANGA, RIME, 'doubleedge', '72.2–85.6%', '2HKO'),
  K(KANGA, LYC, 'doubleedge', '42.6–50.0%', '3HKO', 'Breaks the Sash for a partner'),
  K(GOLI_W, KANGA, 'closecombat', '120.8–142.5%', 'OHKO', 'Never leave it facing Mega Golisopod'),
  K(TORK, KANGA, 'eruption', '80.7–95.3%', '2HKO', '', SUN),
  K(MIMI, KANGA, 'playrough', '36.8–43.9%', '3HKO'),
  K(LYC, KANGA, 'closecombat', '69.8–83.0%', '2HKO'),
  K(INCIN, KANGA, 'flareblitz', '63.7–75.0%', '2HKO', '', SUN),
  K(MOW, KANGA, 'leafstorm', '54.2–64.2%', '2HKO'),
];
const SETS_HEAD = G.sets.split(/\n\s*\n/).filter((b) => /^(Charizard|Sinistcha|Pelipper) /.test(b)).join('\n\n');
const SET = (head, ...rest) => `${head}\nLevel: 50\n${rest.join('\n')}`;
const SETS = (last) => [SETS_HEAD,
  SET('Aegislash @ Kasib Berry\nAbility: Stance Change', 'EVs: 32 HP / 32 Atk / 2 Def', 'Brave Nature', '- Poltergeist', '- Iron Head', '- King\'s Shield', '- Wide Guard'),
  SET('Conkeldurr @ Life Orb\nAbility: Iron Fist', 'EVs: 32 HP / 32 Atk / 2 SpD', 'Brave Nature', '- Drain Punch', '- Mach Punch', '- Ice Punch', '- Protect'), last].join('\n\n') + '\n';
const MEMBERS = [
  { id: 'conkeldurr', role: 'Back line: Drain Punch, Mach Punch, Ice Punch', why: 'Drain Punch one-shots Incineroar (112–133%; 75–89% after Intimidate) and Lycanroc (180–214%). Ice Punch one-shots Rotom-Mow (115–137%). It moves before Adamant Golisopod (60) under Trick Room. Mach Punch fails while Farigiraf is in (Armor Tail). Life Orb.', spread: 'Brave 32 HP / 32 Atk: 58 Speed.' },
  { id: 'aegislash', role: 'Preview pressure: Poltergeist, Iron Head, King\'s Shield, Wide Guard', why: 'Steel/Ghost walls Golisopod (Leech Life 12–14%; Close Combat can\'t hit it), and Poltergeist one-shots Mr. Rime (144–171%). Fire is the problem: sun Eruption 129–152%, Flare Blitz 104–123%. Bringing it over the default four lost 9–22 points vs his hard Trick Room teams, so the plan keeps it in the back.', spread: 'Brave 32 HP / 32 Atk, Kasib Berry.' },
];
const PREVIEW_NOTE = ['Leave Charizard home. Never bring a four without Pelipper here.', 'Two Flying types, not three. Watch for the Lycanroc + Torkoal lead.', 'Heat Wave one-shots Mr. Rime (123–146%). Expect two Fake Outs.', 'Default game-1 plan.', 'Same bring.'];
const altCommon = (k, fan) => {
  const kg = k === 'kanga' ? toKanga : (x) => x;
  const g = kg(lo({ threats: G.threats, leads: G.leads.map((l) => ({ ...l, ifs: [] })), tells: G.tells, perMon: G.perMon, lose: G.lose, endgame: G.endgame, remember: G.remember, summary: G.overview.summary }));
  const ANS = {
    lycanrocmidnight: 'Bring only two Flying types: lead Sinistcha + Conkeldurr, with Pelipper + Charizard behind. Rock Slide does 11–13% to Conkeldurr and 19–24% to Sinistcha. Mach Punch (priority) breaks the Sash (96–115%), then Drain Punch (180–214%). Do not pivot Charizard into Pelipper in front of it.',
    incineroar: `Play through it: Heat Wave the setter side, Protect the Fake Out target, and bring in Pelipper / Conkeldurr, which move early in Trick Room.${k === 'kanga' ? ' Scrappy Kangaskhan Fake Outs Mimikyu through its Ghost type: his Trick Room went up in 208 of 480 games, against 347 for the main six.' : ''} Sinistcha in the back can set Trick Room again to end his.`,
    mrrime: 'Heat Wave one-shots Mr. Rime (123–146%) and does 57–68% to Farigiraf; Aegislash Poltergeist one-shots Mr. Rime (144–171%). Two hits break Farigiraf\'s Sash.',
  };
  // Golisopod's threat calc was Close Combat Morpeko: now Rock Slide Charizard (AEGI_CALCS[7]) or Close Combat Kangaskhan (KANGA_CALCS[6])
  g.threats = g.threats.map((t) => ({ ...t, answer: ANS[t.id] ?? t.answer, ...(t.id === 'golisopod' ? { calc: G.calcs.length + (k === 'kanga' ? AEGI_CALCS.length + 6 : 7) } : {}),
    why: t.id === 'golisopod' ? `Bug/Steel, Tough Claws. The ladder set does about half to Sinistcha (47–56%) and Pelipper (39–47%). A Rock Slide set (legal) one-shots Charizard in sun.${k === 'kanga' ? ' Close Combat one-shots Kangaskhan (121–143%).' : ''}` : t.why }));
  g.tells = g.tells.map((t) => (/Golisopod/.test(t.see) ? { ...t, do: `Heat Wave in sun one-shots it (218–257%); Aegislash walls it (Leech Life 12–14%)${k === 'kanga' ? '. Kangaskhan out of its way' : ''}` } : /Farigiraf/.test(t.see) ? { ...t, do: 'Use real attacks; two hits break the Sash' } : t));
  const pm = g.perMon;
  g.perMon = { ...pm, golisopod: { ...pm.golisopod, worstCase: k === 'kanga' ? 'Close Combat Kangaskhan 121–143%; Rock Slide set one-shots Charizard' : 'Rock Slide set one-shots Charizard in sun' },
    farigiraf: { ...pm.farigiraf, answer: 'Heat Wave 57–68%, then a second hit through the Sash' }, mimikyu: { ...pm.mimikyu, worstCase: 'Play Rough Conkeldurr 65–77%' },
    mrrime: { ...pm.mrrime, answer: 'Heat Wave 123–146%; Aegislash Poltergeist 144–171%' }, aegislash: { job: 'Preview pressure; walls Golisopod; Poltergeist Mr. Rime', avoid: 'Torkoal in sun, Incineroar Flare Blitz' } };
  g.remember = [k === 'kanga' ? 'Blind game 1: lead Charizard + Kangaskhan, with Pelipper + Conkeldurr behind. Fake Out Mimikyu: Scrappy hits Ghost and breaks the Disguise.' : 'Blind game 1: lead Charizard + Rotom-Fan, with Pelipper + Conkeldurr behind.', ...g.remember.slice(1)];
  const { summary, ...rest } = g;
  return { ...rest,
    previews: G.previews.map((p, i) => ({ ...p, bring4: p.bring4.map((x) => (x === 'rotomfan' ? fan : x)), lead: p.lead.map((x) => (x === 'rotomfan' ? fan : x)), note: PREVIEW_NOTE[i] ?? '' })),
    combos: { ours: k === 'kanga' ? [] : [{ attackers: [['conkeldurr', 'drainpunch'], ['rotomfan', 'thunderbolt']], into: 'incineroar', range: '105–125%', verdict: 'KO after Intimidate' }] },
    overview: { summary, likely: G.overview.likely.map((l, i) => ({ ...l, note: ['His most likely single six.', 'Two Trick Rooms, two Fake Outs.', 'Watch for the Lycanroc + Torkoal lead.'][i] })) },
    assumptions: [`${TEST}.`, `Items are as simmed: Life Orb Conkeldurr, Kasib Berry Aegislash, ${k === 'kanga' ? 'Silk Scarf Kangaskhan' : 'Expert Belt Rotom-Fan'}, Sitrus Sinistcha and Focus Sash Pelipper. This six was tested as a whole: the preview rows and leads are the main six's, with no per-row numbers of its own.`, ...G.assumptions.slice(4)],
    calcs: G.calcs.map((c) => (c.attacker === CONK ? { ...c, attacker: CONK_LO, range: LO[c.range], ...(c.move === 'machpunch' ? { verdict: 'Likely OHKO' } : c.defender === APPLE ? { verdict: 'Possible OHKO' } : {}) } : c.defender === ROTOMF && c.move === 'eruption' ? { ...c, why: 'Rotom-Fan takes it' } : c)),
    addCalcs: [...AEGI_CALCS, ...(k === 'kanga' ? KANGA_CALCS : [])],
  };
};
const TEST = 'Last-two-slots test (2026-11-12): 480 engine games per six with closed sheets and the guide\'s preview, vs ten of his teams (his two best responses, three Rock Slide Golisopod, two Aqua Jet Golisopod, three hard Trick Room), paired by seed. Main six 62%';
const MORPEKO_BENCH = { id: 'morpeko', why: 'Out for Aegislash. When the engine brought Morpeko we won 34%, against 65% without it.' };
G.mainName = 'Main: Morpeko + Rotom-Fan';
G.mainNote = 'The six this guide was built on (79.6% of 240 games vs his 20 modelled sixes). In the last-two-slots test vs ten of his worst, hard Trick Room and Rock Slide Golisopod teams it won 62% of 480.';
G.alternatives = [
  { key: 'wisp', name: 'Aegislash + Will-O-Wisp Rotom-Fan',
    note: 'Aegislash for Morpeko; Will-O-Wisp for Air Slash on Rotom-Fan. 71% of 480 games vs the ten teams, +9.0 ±5.2 over the main six (Aegislash alone, Air Slash kept: 66%, +3.5 ±4.9). Same bring-4s and leads; Aegislash stays in the back.',
    bring: { six: ['charizard', 'sinistcha', 'pelipper', 'aegislash', 'conkeldurr', 'rotomfan'], bench: [MORPEKO_BENCH, { id: 'kangaskhan', why: 'Mega Kangaskhan sixes scored 18–19 points lower (it takes the Mega from Charizard). Scrappy Silk Scarf Kangaskhan for Rotom-Fan is the other alternative (78%).' }] },
    team: { evidence: `${TEST}; this six 71%, +9.0 ±5.2. It was not re-run against his 20 modelled sixes.`,
      summary: [G.team.summary[0].replace('adds Electroweb speed control and Thunderbolt', 'adds Electroweb speed control, Thunderbolt and Will-O-Wisp (halves a physical attacker; Torkoal and Incineroar are immune as Fire types)'), 'Sinistcha and Aegislash are mostly preview pressure. Sinistcha\'s Trick Room undoes his; Aegislash walls Golisopod and threatens Wide Guard into Eruption.'],
      members: [{ id: 'rotomfan', role: 'Lead partner: Electroweb, Thunderbolt, Will-O-Wisp', why: 'Levitate and Flying typing ignore Torkoal\'s Earth Power. Electroweb breaks Sashes and slows his side; Thunderbolt does 54–64% to Torkoal; Will-O-Wisp burns Golisopod, Lycanroc or Mimikyu. Expert Belt.' }, ...MEMBERS] },
    sets: SETS(SET('Rotom-Fan @ Expert Belt\nAbility: Levitate', 'EVs: 32 HP / 32 SpA / 2 SpD', 'Modest Nature', '- Electroweb', '- Thunderbolt', '- Will-O-Wisp', '- Protect')),
    ...((a) => ({ ...a, perMon: { ...a.perMon, rotomfan: { job: 'Lead partner: Electroweb, Thunderbolt Torkoal 54–64%, Will-O-Wisp Golisopod / Lycanroc / Mimikyu', avoid: 'Sun Eruption under Trick Room (85–100%)' } } }))(altCommon('wisp', 'rotomfan')),
  },
  { key: 'kanga', name: 'Aegislash + Scrappy Kangaskhan',
    note: 'Aegislash for Morpeko; Scrappy Silk Scarf Kangaskhan (not Mega) for Rotom-Fan, in every Rotom-Fan slot of the plan. 78% of 480 games vs the ten teams, +15.8 ±5.2 over the main six and +6.9 ±5.0 over Will-O-Wisp Rotom-Fan. Scrappy Fake Out hits Mimikyu, so his Trick Room goes up less. Never leave it facing Mega Golisopod.',
    bring: { six: ['charizard', 'sinistcha', 'pelipper', 'aegislash', 'conkeldurr', 'kangaskhan'], bench: [MORPEKO_BENCH, { id: 'rotomfan', why: 'Out for Kangaskhan: Will-O-Wisp Rotom-Fan in this six scored 71%, Scrappy Kangaskhan 78% (+6.9 ±5.0). Vs the Rock Slide Golisopod + Mimikyu + Mr. Rime team: 92% vs 23%.' }] },
    team: { evidence: `${TEST}; this six 78%, +15.8 ±5.2 (Inner Focus Kangaskhan 74%); vs his hard Trick Room sixes 85–92% (Will-O-Wisp Rotom-Fan 88–98%). It was not re-run against his 20 modelled sixes.`,
      summary: ['Mega Charizard Y and Pelipper give us both weathers. Sun Heat Wave one-shots Mega Golisopod, Rotom-Mow and Mr. Rime; rain halves Torkoal\'s Fire and Weather Ball one-shots Torkoal and Lycanroc. Scrappy Kangaskhan leads with Charizard: Fake Out hits Mimikyu, Intimidate does not lower it, and Silk Scarf Double-Edge does about half to Torkoal, Incineroar and Farigiraf. Iron Fist Conkeldurr is the bulky back line.', 'Sinistcha and Aegislash are mostly preview pressure. Sinistcha\'s Trick Room undoes his; Aegislash walls Golisopod and threatens Wide Guard into Eruption.'],
      members: [{ id: 'kangaskhan', role: 'Lead partner: Fake Out, Double-Edge, Drain Punch', why: 'Scrappy: Fake Out and Double-Edge hit Mimikyu, and Intimidate does nothing. Double-Edge does 46–55% to Torkoal, 53–62% to Incineroar and 72–86% to Mr. Rime. Fake Out fails into Farigiraf\'s side (Armor Tail). Close Combat Golisopod one-shots it (121–143%). Silk Scarf.', spread: 'Adamant 32 HP / 32 Atk.' }, ...MEMBERS] },
    sets: SETS(SET('Kangaskhan @ Silk Scarf\nAbility: Scrappy', 'EVs: 32 HP / 32 Atk / 2 Def', 'Adamant Nature', '- Fake Out', '- Double-Edge', '- Drain Punch', '- Protect')),
    ...((a) => ({ ...a,
      leads: [
        { ours: ['charizard', 'kangaskhan'], vs: ['farigiraf', 'torkoal'], t1: 'Mega Evolve; Heat Wave (Farigiraf 57–68%) or Protect Charizard if you expect Trick Room + Eruption. No Fake Out (Armor Tail): Kangaskhan Double-Edge Torkoal (46–55%).', t2: 'If Trick Room went up, Torkoal moves first: Eruption does 81–95% to Kangaskhan. Switch it to Pelipper (rain) and Weather Ball Torkoal next turn (170–200%).', t3: 'Conkeldurr cleans up under Trick Room (Drain Punch Farigiraf 53–62%, Torkoal 49–59%).', ifs: [] },
        { ours: ['charizard', 'kangaskhan'], vs: ['incineroar', 'mimikyu'], t1: 'His Fake Out + Trick Room lead. Mega Evolve. Fake Out Mimikyu (Scrappy hits Ghost; it breaks the Disguise and stops Trick Room this turn). Heat Wave chips Incineroar (24–29%); his Intimidate does nothing to Kangaskhan.', t2: 'Double-Edge Incineroar (53–62%) or Mimikyu; Play Rough does only 37–44% to Kangaskhan. If Trick Room goes up, bring in Pelipper / Conkeldurr.', t3: 'Conkeldurr Drain Punch Incineroar (112–133%, 75–89% after Intimidate).', ifs: [] },
        { ours: ['charizard', 'kangaskhan'], vs: ['farigiraf', 'lycanrocmidnight'], t1: 'Lycanroc outspeeds Charizard and Rock Slide one-shots it: Protect Charizard or switch it to Conkeldurr. No Fake Out (Armor Tail): Double-Edge Lycanroc to break the Sash (43–50%).', t2: 'Conkeldurr Drain Punch Lycanroc (180–214%). Lycanroc Close Combat does 70–83% to Kangaskhan.', t3: 'Charizard back in once Lycanroc is gone.', ifs: [] },
        ...a.leads],
      perMon: { ...a.perMon, kangaskhan: { job: 'Lead partner: Scrappy Fake Out (hits Mimikyu), Double-Edge Torkoal / Incineroar / Mr. Rime', avoid: 'Mega Golisopod (Close Combat 121–143%); Fake Out into Farigiraf (Armor Tail)' } } }))(altCommon('kanga', 'kangaskhan')),
  },
];
export default G;

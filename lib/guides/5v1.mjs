// Matchup guide: Anthony (seat 5) vs Hex (seat 1), Week 4 — round 2 (2026-11-05), rebuilt after the mock with Calvin,
// where Kleavor + Rotom-Heat beat the round-1 six (Simipour, Stunfisk-Galar). Schema: docs/research/strategy/guide-schema.md (v1).
// Evidence: docs/research/strategy/sim/hex2-report.md (84-six screen, engine runs, Hex-side counters, preview tests);
// pool docs/research/strategy/sp-assist/gen_hex2.py -> tools/sim/candidates/hex2.json; calcs
// docs/research/strategy/sim/scripts/hex2-guide-calcs.mjs (app engine; node docs/research/strategy/sp-assist/verify_curated.mjs
// re-runs every one). 'ladder' = Smogon Reg M-C >= 1760, Sept 2026, modal set; 'worst' = full learnset, max offence.

const SP = (hp, atk, def, spa, spd, spe) => ({ hp, atk, def, spa, spd, spe });
// Our sets
const ZARD = { id: 'charizardmegay', set: 'ours', ability: 'drought', item: 'charizarditey', nature: 'Modest', sp: SP(32, 0, 0, 32, 2, 0) };
const PEL = { id: 'pelipper', set: 'ours', ability: 'drizzle', item: 'choicescarf', nature: 'Modest', sp: SP(2, 0, 0, 32, 0, 32) };
const KANGA = { id: 'kangaskhanmega', set: 'ours', ability: 'parentalbond', item: 'kangaskhanite', nature: 'Adamant', sp: SP(32, 32, 2, 0, 0, 0) };
const CONK = { id: 'conkeldurr', set: 'ours', ability: 'guts', item: 'lifeorb', nature: 'Brave', sp: SP(32, 32, 0, 0, 2, 0) };
const ROTOMF = { id: 'rotomfan', set: 'ours', ability: 'levitate', item: 'expertbelt', nature: 'Modest', sp: SP(32, 0, 0, 32, 2, 0) };
const MORPEKO = { id: 'morpeko', set: 'ours', ability: 'hungerswitch', item: 'focussash', nature: 'Jolly', sp: SP(2, 32, 0, 0, 0, 32) };
const MORPEKO_HANGRY = { ...MORPEKO, form: 'hangry' };

// Hex's sets
const INDEE = { id: 'indeedeef', set: 'ladder', ability: 'psychicsurge', item: 'rockyhelmet', nature: 'Relaxed', sp: SP(32, 0, 32, 0, 2, 0) };
const ARMA = { id: 'armarouge', set: 'ladder', ability: 'flashfire', item: 'lifeorb', nature: 'Quiet', sp: SP(32, 0, 0, 32, 2, 0) };
const ARMA_FAST = { id: 'armarouge', set: 'ladder', ability: 'flashfire', item: 'focussash', nature: 'Modest', sp: SP(2, 0, 0, 32, 0, 32) };
const DRAMPA = { id: 'drampa', set: 'ladder', ability: 'cloudnine', item: 'lifeorb', nature: 'Quiet', sp: SP(32, 0, 0, 32, 2, 0) };
const DRAMPA_MEGA = { id: 'drampamega', set: 'ladder', ability: 'berserk', item: 'drampanite', nature: 'Quiet', sp: SP(32, 0, 2, 32, 0, 0) };
const CHOMPZ = { id: 'garchompmegaz', set: 'ladder', ability: 'roughskin', item: 'garchompitez', nature: 'Modest', sp: SP(2, 0, 0, 32, 0, 32) };
const CHOMP_LO = { id: 'garchomp', set: 'ladder', ability: 'roughskin', item: 'lifeorb', nature: 'Jolly', sp: SP(2, 32, 0, 0, 0, 32) };
const CORV = { id: 'corviknight', set: 'ladder', ability: 'mirrorarmor', item: 'leftovers', nature: 'Careful', sp: SP(32, 2, 0, 0, 32, 0) };
const ROTOMH = { id: 'rotomheat', set: 'ladder', ability: 'levitate', item: 'sitrusberry', nature: 'Modest', sp: SP(32, 0, 0, 32, 2, 0) };
const ROTOMH_SCARF = { id: 'rotomheat', set: 'ladder', ability: 'levitate', item: 'choicescarf', nature: 'Timid', sp: SP(2, 0, 0, 32, 0, 32) };
const KLEAVOR = { id: 'kleavor', set: 'ladder', ability: 'sharpness', item: 'focussash', nature: 'Jolly', sp: SP(2, 32, 0, 0, 0, 32) };
const KLEAVOR_RS = { id: 'kleavor', set: 'worst', ability: 'sharpness', item: 'choicescarf', nature: 'Jolly', sp: SP(2, 32, 0, 0, 0, 32) };
const BANETTE = { id: 'banettemega', set: 'ladder', ability: 'prankster', item: 'banettite', nature: 'Adamant', sp: SP(32, 32, 0, 0, 2, 0) };
const RAIN = { weather: 'Rain' };
const SUN = { weather: 'Sun' };
const PSY = { terrain: 'Psychic' };

export default {
  version: 1, pov: 5, opp: 1, coach: 'Hex(法拉)', week: 4, written: '2026-11-05',
  rosters: {
    ours: ['charizard', 'sinistcha', 'pelipper', 'kangaskhan', 'aegislash', 'morpeko', 'conkeldurr', 'rotomfan', 'stunfiskgalar', 'simipour'],
    theirs: ['garchomp', 'indeedeef', 'corviknight', 'rotomheat', 'armarouge', 'kleavor', 'banette', 'ditto', 'forretress', 'drampa'],
  },
  overview: {
    archetype: 'Psychic Spam + Trick Room (Indeedee-F + Armarouge), with a fast Kleavor / Rotom-Heat / Garchomp rock-and-hazard plan behind it',
    summary: [
      'Hex spent 76 of his 100 points on five Pokémon: Garchomp, Indeedee-F, Armarouge, Corviknight and Rotom-Heat. His headline plan is the classic Psychic Spam pair. Indeedee-F sets Psychic Terrain, which blocks every priority move we have (Fake Out, Mach Punch, Sucker Punch) into his grounded Pokémon, and Armarouge fires Expanding Force into both of ours at boosted power. Either one can set Trick Room, and Drampa\'s Cloud Nine switches off our rain and sun while it is in.',
      'The plan that actually beat us in the mock with Calvin was the other one: fast Kleavor and Rotom-Heat. Kleavor\'s Stone Axe one-shots Pelipper and Rotom-Fan and leaves Stealth Rock, which locks 4x-Rock Charizard out of the game. Rotom-Heat\'s Thunderbolt one-shots Pelipper, and Will-O-Wisp cripples our physical attackers. Garchomp adds Rock Slide and Earthquake or, as Mega Garchomp Z, a special Draco Meteor from 203 Speed.',
      'So he has two ways to win, and his preview tells you which one he brought. Indeedee-F + Armarouge + Drampa means Psychic Spam with our weather turned off. Kleavor without Drampa means the fast rock plan. Forretress means he built specifically against our Charizard.',
    ],
    roster: [
      { id: 'indeedeef', role: 'Psychic Terrain (blocks our priority), Follow Me, Trick Room', tier: 'core' },
      { id: 'armarouge', role: 'Expanding Force spam, Trick Room, Flash Fire (eats our Fire moves)', tier: 'core' },
      { id: 'garchomp', role: 'Mega-Z (special, 203 Speed, Levitate) or physical Rock Slide / Earthquake', tier: 'core' },
      { id: 'rotomheat', role: 'Thunderbolt one-shots Pelipper; Will-O-Wisp; Scarf set outspeeds us all', tier: 'core' },
      { id: 'corviknight', role: 'Tailwind or Bulk Up wall', tier: 'core' },
      { id: 'drampa', role: 'Cloud Nine: no rain, no sun; Trick Room attacker; Mega option', tier: 'likely' },
      { id: 'kleavor', role: 'Stone Axe one-shots Pelipper / Rotom-Fan and sets rocks', tier: 'likely' },
      { id: 'banette', role: 'Mega Prankster Trick Room / Will-O-Wisp; immune to Kangaskhan\'s Normal moves', tier: 'fringe' },
      { id: 'ditto', role: 'Scarf Imposter copies our Mega', tier: 'fringe' },
      { id: 'forretress', role: 'Sturdy, Rocky Helmet, Rock Slide: an anti-Charizard pick', tier: 'fringe' },
    ],
    likely: [
      { label: 'Core + Drampa (Psychic Spam, weather off)', ids: ['garchomp', 'indeedeef', 'armarouge', 'corviknight', 'rotomheat', 'drampa'], note: 'His most likely single six. Lead Kangaskhan + Rotom-Fan.' },
      { label: 'Core + Kleavor (fast rock plan)', ids: ['garchomp', 'indeedeef', 'armarouge', 'corviknight', 'rotomheat', 'kleavor'], note: 'What beat the round-1 six in the mock. Lead Pelipper + Morpeko.' },
      { label: 'Anti-Charizard Rock Slide build', ids: ['garchomp', 'kleavor', 'drampa', 'indeedeef', 'rotomheat', 'armarouge'], note: 'Physical Garchomp + Scarf / Sheer Force Kleavor Rock Slide. Our worst likely matchup (about 40%).' },
    ],
  },
  threats: [
    { id: 'kleavor', title: 'Kleavor: Stone Axe and rocks', why: 'Stone Axe one-shots Pelipper (124–149%) and Rotom-Fan (103–122%) and sets Stealth Rock, so Charizard can never switch in afterwards. This is what beat us in the mock.', answer: 'Kleavor dies first: Morpeko Fake Out + Pelipper Weather Ball (Sash holds at 1), then any hit. Conkeldurr takes Stone Axe for 21–25%.', calc: 24 },
    { id: 'rotomheat', title: 'Rotom-Heat: Thunderbolt and Will-O-Wisp', why: 'Thunderbolt one-shots Pelipper (283%+), and Will-O-Wisp halves Kangaskhan\'s damage. The Scarf set (226 Speed) outspeeds everything we have.', answer: 'Scarf Pelipper (175) moves first against the Sitrus set: rain Weather Ball one-shots it. Against Scarf, Fake Out it first. Kangaskhan Double-Edge one-shots the Scarf set.', calc: 30 },
    { id: 'armarouge', title: 'Expanding Force in Psychic Terrain', why: 'A spread hit at boosted power: 180–213% to Conkeldurr, 135–159% to Pelipper, 83–98% to Rotom-Fan. Our priority cannot touch it while the terrain is up.', answer: 'Armarouge dies first in those games: Kangaskhan Double-Edge (71–85%) plus Rotom-Fan Thunderbolt. Conkeldurr never stands in front of a healthy Armarouge in terrain.', calc: 33 },
    { id: 'garchomp', title: 'Garchomp: both Megas and the physical set', why: 'Mega Garchomp Z\'s Draco Meteor one-shots Pelipper (126–149%) from 203 Speed. The non-Mega physical set (Rock Slide + Earthquake) is our worst blind spot: we won 26% of the engine games where he brought it and Mega Evolved something else.', answer: 'Mega-Z (203 Speed, faster than Scarf Pelipper): Fake Out it (Levitate, so terrain does not block it) and hit it twice in one turn; Kangaskhan Double-Edge alone leaves it at a sliver and the recoil leaves Kangaskhan in range. Physical set (169 Speed, Rough Skin): Scarf Pelipper moves first, and rain Weather Ball (70–83%) plus Kangaskhan Fake Out (26–31%) or Double-Edge (77–92%) KOs it. Do not Fake Out it with Morpeko: Rough Skin takes Morpeko off full HP, so its Sash no longer saves it from Earthquake (190–225%). Scarf Garchomp (253) outspeeds everything we have: Rock Slide does 63–74% to Pelipper.', calc: 37 },
    { id: 'drampa', title: 'Drampa: Cloud Nine and Trick Room', why: 'Cloud Nine turns off both our rain and our sun. Under his Trick Room, Draco Meteor one-shots Conkeldurr (106–125%).', answer: 'Do not lead Pelipper into it. Conkeldurr Drain Punch one-shots it (120–143%) outside Trick Room.', calc: 39 },
  ],
  team: {
    summary: [
      'Mega Kangaskhan is the engine of this team. Fake Out buys turns, Parental Bond breaks Focus Sashes, and Double-Edge 2HKOs most of his roster. Scarf Pelipper is the fast answer to his fast plan: at 175 Speed it moves before non-Scarf Kleavor (150), physical Garchomp (169) and Sitrus Rotom-Heat (106), though not Scarf Kleavor (225) or Mega Garchomp Z (203), and rain Weather Ball one-shots Rotom-Heat and Armarouge. Morpeko and Rotom-Fan bring Fake Out and Electroweb speed control, and Conkeldurr is the bulky back line that takes Stone Axe and Rock Slide.',
      'Charizard is mostly a preview threat. It holds Charizardite Y, so he has to bring his Rock Slide and Cloud Nine answers, and it comes in for real against Forretress (Fire 4x). Every six without it scored about 15 points worse, even though the engine brought it in only about 3% of games.',
    ],
    evidence: '65.5% of 640 engine-vs-engine games with closed sheets, against his 20 modelled sixes (+6.6 ±4.4 over the same six with Sinistcha). No Mega Kangaskhan: about 43%. No Charizard in the six: about 40%.',
    members: [
      { id: 'kangaskhan', role: 'The Mega: Fake Out, Double-Edge, Rock Slide', why: 'Mega in 97% of engine games. Parental Bond breaks Kleavor\'s Sash, and Rock Slide hits Rotom-Heat 2x. Double-Edge recoil costs 20–29% per use, so do not trade it alone into Mega Garchomp Z or into Rocky Helmet.', spread: 'Adamant 32 HP / 32 Atk: 212 HP, 194 Atk, 120 Speed.' },
      { id: 'pelipper', role: 'Scarf rain attacker', why: 'Fast without a setup turn: Scarf and Tailwind Pelipper tie in the engine (58 vs 60%). Water hits Rotom-Heat, Kleavor and Armarouge 2x, and rain halves his Fire.', spread: 'Modest 32 SpA / 32 Spe with Scarf: 175 Speed. Faster than non-Scarf Kleavor (150), non-Mega Garchomp (169), Armarouge (127) and Sitrus Rotom-Heat (106); slower than Mega Garchomp Z (203), Scarf Kleavor (225) and Scarf Garchomp (253).' },
      { id: 'morpeko', role: 'Fake Out + Electroweb', why: 'A second Fake Out for Kleavor or Mega Garchomp Z (not base Garchomp: Rough Skin breaks the Sash\'s full-HP condition), Electroweb for speed control, and Hangry Aura Wheel one-shots Mega Banette.', spread: 'Jolly 32 Atk / 32 Spe, Focus Sash.' },
      { id: 'rotomfan', role: 'Electroweb + Thunderbolt', why: 'Leads with Kangaskhan into Psychic Spam (72% of 185 games): it floats above the terrain and slows his side down.', spread: 'Modest 32 HP / 32 SpA, Expert Belt.' },
      { id: 'conkeldurr', role: 'Bulky back line: Drain Punch, Mach Punch, Rock Slide', why: 'Takes Stone Axe for 21–25% and one-shots Drampa. Guts turns a Will-O-Wisp into a 1.5x boost (nobody expects Guts without Flame Orb); Guts and Iron Fist tied in game 1.', spread: 'Brave 32 HP / 32 Atk, Life Orb.' },
      { id: 'charizard', role: 'Preview threat; Forretress answer', why: 'He has to respect it at preview. Bring it only against Forretress or once his Rock Slide users are gone. Never switch it in after Stone Axe.', spread: 'Modest 32 HP / 32 SpA.' },
    ],
  },
  assumptions: [
    'Round 2 (2026-11-05). The round-1 six (Simipour, Stunfisk-Galar) lost the mock to Kleavor + Rotom-Heat alone; those two are out unless we cannot win without them. Every six of the other eight (28 sixes x 3 set packages) was screened, the best eight were played by the search engine on both sides with closed sheets, and the top two re-run on fresh seeds.',
    'This six won 65.5% of 640 engine games (closed sheets) against his 20 modelled sixes; on the 480 fresh-seed games, 66% vs his Kleavor + Rotom-Heat sixes and 67% vs his Indeedee-F + Armarouge Psychic Spam. Same six with Sinistcha for Rotom-Fan: -6.6 ±4.4. Without Mega Kangaskhan, or without Charizard in the six: about 40%.',
    'The new sets carry it: on the same six, Rock Slide Mega Kangaskhan + Guts Rock Slide Conkeldurr + Electroweb Morpeko / Rotom-Fan beat the Week 3 sets by 5.5–7 points overall and 12.5 vs Kleavor + Rotom-Heat (160 engine games each). Scarf Pelipper and Tailwind Pelipper tie (58.1 vs 59.6%); Scarf needs no setup turn.',
    'Charizard is mostly a preview threat: the engine brought it in ~3% of games against his usual sixes (and those went badly), yet every six without it lost ~15 points, because he has to bring his Rock Slide / Cloud Nine answers. It does come against Forretress (Fire is 4x): the engine brought it in ~90% of those games.',
    'Built from his side too: all 210 sixes of his 10 were played against this six. His best counters are Garchomp + Forretress + Armarouge sixes (often Mega Banette / Ditto): 25–45% for us in engine games. None of those is a likely Hex six (Forretress was his last-priority pick), but if you see Forretress, expect a hard game.',
    'The engine now charges entry hazards (Kleavor\'s Stone Axe sets Stealth Rock): before, it ignored them, which is part of why round 1 looked better on paper than in your mock.',
    'Doubles, spread x0.75, full HP, no crits. Rain is on for Pelipper\'s hits, sun for Charizard\'s, Psychic Terrain when Indeedee-F is in.',
  ],
  remember: [
    'Mega Kangaskhan is the Mega (97% of engine games). Charizard holds its stone too so he has to guess, but it only comes vs Forretress or once his Rock users are gone.',
    'Drampa\'s Cloud Nine turns off rain AND sun while it is on the field: Pelipper\'s Weather Ball drops to a weak Normal hit. Into Indeedee-F + Armarouge + Drampa sixes, lead Mega Kangaskhan + Rotom-Fan, not Pelipper.',
    'Scarf Pelipper (175 Speed) outspeeds non-Scarf Kleavor (150), non-Mega Garchomp (169), Sitrus Rotom-Heat (106) and Armarouge, but not Mega Garchomp Z (203) or a Scarf Kleavor (225); rain Weather Ball OHKOs Rotom-Heat (135–161%) and Armarouge (141–166%), and takes Kleavor to its Sash (208–245%). It is Choice-locked: pick the target, then switch to re-choose.',
    'Kleavor\'s Stone Axe OHKOs Pelipper (124–149%) and Rotom-Fan (103–122%) and sets Stealth Rock: once rocks are up, Charizard (4x Rock) cannot switch in. Kleavor dies first; Morpeko Fake Out it (it is grounded: only if no Psychic Terrain).',
    'Rotom-Heat Thunderbolt OHKOs Pelipper (283%+). Rotom-Heat dies to Pelipper first (it is slower) or Mega Kangaskhan Double-Edge (82–98%).',
    'Psychic Terrain (Indeedee-F) blocks Fake Out and Mach Punch into grounded targets (Indeedee-F, Armarouge, Drampa, Kleavor, Banette, Forretress). Mega Kangaskhan loses Scrappy: Double-Edge does nothing to Mega Banette.',
  ],
  bring: {
    six: ['charizard', 'pelipper', 'kangaskhan', 'morpeko', 'conkeldurr', 'rotomfan'],
    bench: [
      { id: 'sinistcha', why: 'Rage Powder + Trick Room beside Pelipper was tested: the same six with Sinistcha for Rotom-Fan scored 6.6 ±4.4 points lower over 640 paired engine games (better vs Kleavor + Rotom-Heat, worse vs Psychic Spam).' },
      { id: 'aegislash', why: 'It walls Kleavor (Stone Axe 19–23%, Close Combat immune), but Rotom-Heat, Armarouge and Garchomp all hit it hard; every Aegislash six scored 40–48% under the engine.' },
      { id: 'simipour', why: 'Out by Anthony\'s call after the mock: typing fine, stats too low to hold up in real games.' },
      { id: 'stunfiskgalar', why: 'Out by Anthony\'s call after the mock, same reason.' },
    ],
    mega: { id: 'kangaskhan', why: 'Mega Kangaskhan was the Mega in 97% of engine games, and the six we tested without it scored 43%. Parental Bond breaks Kleavor\'s and Morpeko-style Sashes and Double-Edge 2HKOs most of his team. Charizard keeps Charizardite Y so his preview has to respect both.' },
  },
  previews: [
    { if: 'their 6 includes Forretress', bring4: ['pelipper', 'kangaskhan', 'charizard', 'conkeldurr'], lead: ['pelipper', 'kangaskhan'],
      note: 'His best counter shape to this six (Garchomp + Forretress + Armarouge): 38–45% in engine games whatever we led. Charizard comes for Forretress (Fire 4x); Mega Kangaskhan Double-Edge into Rocky Helmet costs it twice (Parental Bond).' },
    { if: 'their 6 includes Indeedee-F + Armarouge + Drampa', bring4: ['kangaskhan', 'rotomfan', 'conkeldurr', 'morpeko'], lead: ['kangaskhan', 'rotomfan'],
      note: 'His most common shape. Cloud Nine kills our rain, so no Pelipper lead: Mega Kangaskhan + Rotom-Fan won 72% of 185 engine games; Pelipper + Morpeko only 39% of 109. Conkeldurr is the Drampa answer (Drain Punch 120–143%). If the six is Garchomp + Indeedee-F + Armarouge + Rotom-Heat + Kleavor + Drampa (no Corviknight), it may be his Rock Slide anti-Charizard build: there a Kangaskhan + Conkeldurr lead won 43% vs 33–34% (80 paired games), but on similar sixes it lost 6 points (62 vs 68%, 160 games), so it is a read, not a rule.' },
    { if: 'their 6 includes Kleavor', bring4: ['pelipper', 'morpeko', 'kangaskhan', 'conkeldurr'], lead: ['pelipper', 'morpeko'],
      note: 'Kleavor without the Drampa + Psychic Spam core: Pelipper + Morpeko won 82% of 118 engine games (73% of 84 vs his no-Indeedee Tailwind sixes). Morpeko Fake Outs Kleavor, Pelipper Weather Balls Rotom-Heat / Armarouge.' },
    { if: 'their 6 includes Indeedee-F + Armarouge', bring4: ['kangaskhan', 'rotomfan', 'conkeldurr', 'morpeko'], lead: ['kangaskhan', 'rotomfan'],
      note: 'No Drampa, no Kleavor: 76% of 58 engine games with this lead.' },
    { if: 'their 6 includes Armarouge', bring4: ['pelipper', 'morpeko', 'kangaskhan', 'conkeldurr'], lead: ['pelipper', 'morpeko'],
      note: 'Default: rain + Fake Out.' },
  ],
  leads: [
    { ours: ['kangaskhan', 'rotomfan'], vs: ['indeedeef', 'armarouge'],
      t1: 'Terrain is up: no Fake Out into either (both grounded). Mega Evolve; Kangaskhan Double-Edge Armarouge (71–85%, recoil 21–25% of Kangaskhan), not Indeedee-F: its Rocky Helmet hits twice, so recoil + Helmet cost Kangaskhan 53–57% for 72–86% (Follow Me drags it there anyway); Rotom-Fan Thunderbolt Armarouge (44–53%) or Electroweb for speed.',
      t2: 'Finish Armarouge before a free Expanding Force: it does 65–77% to Kangaskhan and 83–98% to Rotom-Fan in terrain, 180–213% to Conkeldurr.',
      t3: 'Conkeldurr in only once Armarouge is down (Drain Punch Indeedee-F 51–62%, Drampa 120–143%).',
      ifs: ['Sim: Kangaskhan + Rotom-Fan into Indeedee-F + Armarouge sixes won 72% of 185 games', 'if Trick Room goes up → Conkeldurr (58) moves before Armarouge and Indeedee-F; stall with Protect or bring Conkeldurr'] },
    { ours: ['pelipper', 'morpeko'], vs: ['garchomp', 'armarouge'],
      t1: 'Morpeko Fake Out Garchomp (Mega-Z has Levitate, so terrain does not block it; if it did not Mega Evolve, Rough Skin took Morpeko off full HP and the Sash is gone); Pelipper Weather Ball Armarouge (141–166%, Sash set 168–200% but the Sash holds).',
      t2: 'Garchomp: Mega-Z Draco Meteor OHKOs Pelipper (126–149%) and Morpeko (147–174%). Electroweb + Kangaskhan in. Double-Edge Mega-Z is 85–100% and KOs alone only 0.4% of rolls; he moves first, and after his Draco (61–73%) the recoil leaves Kangaskhan at 0–30 HP (2.4% it faints). Double-Edge it only beside a second hit (Hurricane, Drain Punch) or after Fake Out.',
      t3: 'Conkeldurr for Drampa / Indeedee-F; Charizard only if Garchomp and Kleavor are both gone.',
      ifs: ['Sim: 87% of 45 games vs his Kleavor sixes'] },
    { ours: ['pelipper', 'morpeko'], vs: ['kleavor', 'armarouge'],
      t1: 'Morpeko Fake Out Kleavor (no terrain without Indeedee-F); Pelipper Weather Ball Kleavor (208–245%: Sash holds at 1) or Armarouge (141–166%).',
      t2: 'Finish Kleavor (Morpeko Aura Wheel / Electroweb breaks the Sash); never let Stone Axe through: it OHKOs Pelipper (124–149%) and sets rocks.',
      t3: 'Mega Kangaskhan + Conkeldurr in the back; Charizard stays home once rocks are up.',
      ifs: ['Sim: 78% of 32 games'] },
    { ours: ['pelipper', 'morpeko'], vs: ['armarouge', 'rotomheat'],
      t1: 'Morpeko Fake Out Rotom-Heat (Levitate: not blocked); Pelipper Weather Ball Rotom-Heat (135–161%) or Armarouge (141–166%).',
      t2: 'Rotom-Heat Thunderbolt OHKOs Pelipper: it must be gone or Fake Outed before it moves. Scarf Rotom-Heat (226) outspeeds everything we have.',
      t3: 'Kangaskhan + Conkeldurr clean up (Guts: Will-O-Wisp powers Conkeldurr up).',
      ifs: ['Sim: 100% of 32 games (our best lead matchup)'] },
    { ours: ['kangaskhan', 'conkeldurr'], vs: ['garchomp', 'kleavor'],
      t1: 'His Rock Slide lead (Life Orb Garchomp, Scarf / Sheer Force Kleavor). Fake Out Garchomp (if Mega-Z: Levitate) or Kleavor (no terrain); Conkeldurr Drain Punch Kleavor (69–82%) — Conkeldurr resists Rock.',
      t2: 'Kangaskhan Double-Edge Kleavor (48–58% x Parental Bond breaks the Sash) or Garchomp (Drain Punch Life Orb Garchomp 55–65%).',
      t3: 'Pelipper only after both Rock Slide users are gone (Garchomp Rock Slide 63–74%, Kleavor 75–88% in rain).',
      ifs: ['Sim vs his "full anti-Anthony" and "anti-Charizard rocks" sixes: this lead 43% of 80, Pelipper + Morpeko 34% (paired); still a losing matchup'] },
  ],
  tells: [
    { see: 'Drampa on the field', means: 'Cloud Nine: no rain and no sun while it is in', do: 'Pelipper\'s Weather Ball is weak: Conkeldurr Drain Punch OHKOs Drampa (120–143%). Kangaskhan Double-Edge 85–100% only outside Trick Room: if his Draco Meteor (77–91%) lands first, the recoil always KOs Kangaskhan' },
    { see: 'Kleavor uses Stone Axe', means: 'Stealth Rock is on our side: Charizard (4x Rock) loses half its HP switching in', do: 'Charizard stays home for the game; Pelipper / Rotom-Fan in only if Kleavor is down or Fake Outed' },
    { see: 'Psychic Terrain goes up (Indeedee-F switches in)', means: 'No Fake Out / Mach Punch into grounded targets for 5 turns', do: 'Fake Out only Garchomp-Z, Rotom-Heat, Corviknight; spend turn 1 on Double-Edge / Thunderbolt instead' },
    { see: 'Forretress in his six', means: 'He built against this team (Rocky Helmet, Sturdy, Trick Room)', do: 'Charizard comes (Fire 4x on Forretress); avoid Kangaskhan Double-Edge into Rocky Helmet unless it KOs' },
    { see: 'Rotom-Heat locks into one move (Scarf)', means: 'Choice Scarf: 226 Speed, outspeeds all of us', do: 'Protect or switch the target of its locked move; Kangaskhan Double-Edge OHKOs the Scarf set (101–120%, 2 HP)' },
    { see: 'Banette Megas (Prankster)', means: 'Priority Trick Room / Will-O-Wisp; Ghost: Mega Kangaskhan\'s Normal moves miss it', do: 'Hangry Morpeko Aura Wheel OHKOs it (112–133%)' },
  ],
  lose: [
    { how: 'Kleavor Stone Axe + Rock Slide: Pelipper / Rotom-Fan / Charizard each one-shot, rocks up', fix: 'Kleavor dies first: Fake Out + Weather Ball, or Conkeldurr lead into his Rock Slide leads.' },
    { how: 'Rotom-Heat Thunderbolt on Pelipper', fix: 'Pelipper (175) moves first vs Sitrus Rotom-Heat: Weather Ball it; vs Scarf Rotom-Heat, Fake Out it first.' },
    { how: 'Expanding Force under terrain (Armarouge + Indeedee-F)', fix: 'Armarouge dies first; Conkeldurr never in front of it with terrain up (180–213%).' },
    { how: 'Drampa turns off our weather and sets Trick Room', fix: 'Lead Kangaskhan + Rotom-Fan; Conkeldurr in for Drampa (moves before it unless Trick Room is up).' },
    { how: 'His Forretress counter sixes (Rocky Helmet, Trick Room)', fix: 'Charizard for Forretress; 38–45% in the sim whatever we did.' },
  ],
  endgame: [
    'Keep Conkeldurr for Drampa / Indeedee-F / Garchomp; Guts means a Will-O-Wisp makes it stronger.',
    'Keep Pelipper healthy for the last Rotom-Heat / Armarouge / Kleavor: one Weather Ball each in rain.',
    'Charizard is the Forretress / Corviknight answer in sun (Weather Ball Corviknight 130–153%) once his Rock users are gone and Drampa is out.',
    'Psychic Terrain lasts 5 turns from Indeedee-F\'s entry; Morpeko alternates Full Belly (Electric) / Hangry (Dark) every turn end.',
  ],
  combos: {
    theirs: [
      { attackers: [['kleavor', 'stoneaxe'], ['rotomheat', 'thunderbolt']], into: 'pelipper', range: '407–485%', answer: 'Pelipper only leads beside Morpeko Fake Out; Weather Ball the faster threat first.' },
      { attackers: [['armarouge', 'expandingforce'], ['indeedeef', 'psychic']], into: 'conkeldurr', range: '263–312%', answer: 'Conkeldurr never in front of both with terrain up.' },
    ],
    ours: [
      { attackers: [['kangaskhanmega', 'doubleedge'], ['rotomfan', 'thunderbolt']], into: 'armarouge', range: '115–138%', verdict: 'KO' },
      { attackers: [['pelipper', 'weatherball'], ['kangaskhanmega', 'doubleedge']], into: 'kleavor', range: '257–303%', verdict: 'KO (two attackers break the Sash)' },
    ],
  },
  calcs: [
    { attacker: PEL, defender: ROTOMH, move: 'weatherball', field: RAIN, range: '135.0–160.5%', verdict: 'OHKO', why: 'Pelipper (175 scarfed) outspeeds Sitrus Rotom-Heat (106)' },
    { attacker: PEL, defender: ROTOMH_SCARF, move: 'weatherball', field: RAIN, range: '170.1–200.0%', verdict: 'OHKO', why: 'But Scarf Rotom-Heat (226) moves first' },
    { attacker: PEL, defender: KLEAVOR, move: 'weatherball', field: RAIN, range: '208.2–244.9%', verdict: 'Sash holds', why: 'Pelipper outspeeds non-Scarf Kleavor (150), not Scarf (225); Fake Out / Electroweb breaks the Sash' },
    { attacker: PEL, defender: ARMA, move: 'weatherball', field: RAIN, range: '140.6–165.6%', verdict: 'OHKO', why: 'Life Orb Trick Room set' },
    { attacker: PEL, defender: ARMA_FAST, move: 'weatherball', field: RAIN, range: '167.9–200.0%', verdict: 'Sash holds', why: 'Fast Sash set' },
    { attacker: PEL, defender: CHOMP_LO, move: 'weatherball', field: RAIN, range: '70.3–83.2%', verdict: '2HKO', why: 'Non-Mega Garchomp' },
    { attacker: PEL, defender: INDEE, move: 'weatherball', field: RAIN, range: '61.0–71.8%', verdict: '2HKO', why: 'Indeedee-F' },
    { attacker: KANGA, defender: ROTOMH, move: 'doubleedge', range: '81.5–97.5%', verdict: '2HKO', why: 'Parental Bond, both hits' },
    { attacker: KANGA, defender: ARMA, move: 'doubleedge', range: '70.8–84.9%', verdict: '2HKO', why: 'Armarouge' },
    { attacker: KANGA, defender: INDEE, move: 'doubleedge', field: PSY, range: '72.3–86.4%', verdict: '2HKO', why: 'Indeedee-F: Rocky Helmet twice + recoil cost Kangaskhan 53–57%' },
    { attacker: KANGA, defender: CHOMPZ, move: 'doubleedge', range: '84.9–100.0%', verdict: 'nearly', why: 'Mega-Z Garchomp: KOs 0.4%; recoil 25–29% of Kangaskhan' },
    { attacker: KANGA, defender: DRAMPA, move: 'doubleedge', range: '84.9–100.0%', verdict: 'nearly', why: 'Drampa (no Scrappy needed): recoil 25–29% of Kangaskhan' },
    { attacker: KANGA, defender: KLEAVOR, move: 'doubleedge', range: '48.3–57.8%', verdict: 'breaks Sash', why: 'Two hits: the first breaks the Sash' },
    { attacker: CONK, defender: DRAMPA, move: 'drainpunch', range: '119.5–143.2%', verdict: 'OHKO', why: 'Cloud Nine Drampa' },
    { attacker: CONK, defender: DRAMPA_MEGA, move: 'drainpunch', range: '94.1–114.1%', verdict: 'likely OHKO', why: 'Mega Drampa' },
    { attacker: CONK, defender: KLEAVOR, move: 'drainpunch', range: '68.7–82.3%', verdict: '2HKO', why: 'Conkeldurr takes Stone Axe for 21–25%' },
    { attacker: CONK, defender: ROTOMH, move: 'rockslide', range: '58.0–69.4%', verdict: '2HKO', why: 'Guts (no burn yet)' },
    { attacker: CONK, defender: INDEE, move: 'drainpunch', range: '51.4–61.6%', verdict: '2HKO', why: 'Indeedee-F' },
    { attacker: MORPEKO_HANGRY, defender: ARMA, move: 'aurawheel', range: '79.2–94.8%', verdict: '2HKO', why: 'Hangry (Dark) form' },
    { attacker: MORPEKO_HANGRY, defender: BANETTE, move: 'aurawheel', range: '112.3–133.3%', verdict: 'OHKO', why: 'Mega Banette' },
    { attacker: ROTOMF, defender: CORV, move: 'thunderbolt', range: '67.8–82.0%', verdict: '2HKO', why: 'Expert Belt' },
    { attacker: ROTOMF, defender: KLEAVOR, move: 'thunderbolt', range: '66.0–78.2%', verdict: '2HKO', why: 'Kleavor' },
    { attacker: ROTOMF, defender: ARMA, move: 'thunderbolt', range: '44.3–53.1%', verdict: '2HKO', why: 'Armarouge' },
    { attacker: ZARD, defender: CORV, move: 'weatherball', field: SUN, range: '129.8–153.2%', verdict: 'OHKO', why: 'Sun up (no Drampa in)' },
    { attacker: KLEAVOR, defender: PEL, move: 'stoneaxe', field: RAIN, range: '124.1–148.9%', verdict: 'OHKO', why: 'And sets Stealth Rock' },
    { attacker: KLEAVOR, defender: ROTOMF, move: 'stoneaxe', range: '103.2–122.3%', verdict: 'OHKO', why: 'Rotom-Fan' },
    { attacker: KLEAVOR, defender: ZARD, move: 'stoneaxe', field: SUN, range: '227.0–268.1%', verdict: 'OHKO', why: 'Charizard stays home vs Kleavor' },
    { attacker: KLEAVOR, defender: CONK, move: 'stoneaxe', range: '21.2–25.0%', verdict: 'chip', why: 'Conkeldurr is the Kleavor sponge' },
    { attacker: KLEAVOR_RS, defender: PEL, move: 'rockslide', field: RAIN, range: '74.5–87.6%', verdict: '2HKO', why: 'Worst case: Scarf Rock Slide' },
    { attacker: CHOMP_LO, defender: PEL, move: 'rockslide', field: RAIN, range: '62.8–73.7%', verdict: '2HKO', why: 'Life Orb Garchomp' },
    { attacker: ROTOMH, defender: PEL, move: 'thunderbolt', field: RAIN, range: '283.2–335.8%', verdict: 'OHKO', why: 'Rotom-Heat' },
    { attacker: ROTOMH, defender: KANGA, move: 'overheat', field: RAIN, range: '24.1–28.8%', verdict: 'chip', why: 'Rain halves Fire' },
    { attacker: ROTOMH, defender: CONK, move: 'overheat', range: '68.4–81.1%', verdict: '2HKO', why: 'No rain (34–40% in rain)' },
    { attacker: ARMA, defender: CONK, move: 'expandingforce', field: PSY, range: '180.2–213.2%', verdict: 'OHKO', why: 'Spread in terrain' },
    { attacker: ARMA, defender: PEL, move: 'expandingforce', field: PSY, range: '135.0–159.1%', verdict: 'OHKO', why: 'Spread in terrain' },
    { attacker: ARMA, defender: KANGA, move: 'expandingforce', field: PSY, range: '65.1–77.4%', verdict: '2HKO', why: 'Spread in terrain' },
    { attacker: ARMA, defender: ROTOMF, move: 'expandingforce', field: PSY, range: '82.8–97.5%', verdict: 'nearly', why: 'Spread in terrain' },
    { attacker: CHOMPZ, defender: PEL, move: 'dracometeor', range: '125.5–148.9%', verdict: 'OHKO', why: 'Mega-Z Garchomp' },
    { attacker: CHOMPZ, defender: MORPEKO, move: 'dracometeor', range: '147.4–174.1%', verdict: 'Sash holds', why: 'Mega-Z Garchomp' },
    { attacker: DRAMPA, defender: CONK, move: 'dracometeor', range: '105.7–125.0%', verdict: 'OHKO', why: 'If Drampa moves first (his Trick Room)' },
  ],
  perMon: {
    kleavor: { role: 'Sharpness Stone Axe (sets Stealth Rock), often Focus Sash or Scarf Rock Slide', worstCase: 'Stone Axe OHKOs Pelipper (124–149%), Rotom-Fan (103–122%), Charizard (227–268%)', answer: 'Fake Out + Pelipper Weather Ball (208–245%); Conkeldurr Drain Punch 69–82% (takes Stone Axe for 21–25%)' },
    rotomheat: { role: 'Thunderbolt / Overheat / Will-O-Wisp; Scarf set possible (226 Speed)', worstCase: 'Thunderbolt 283%+ on Pelipper', answer: 'Pelipper Weather Ball first (135–161%), Kangaskhan Double-Edge 82–98%; Guts Conkeldurr likes Will-O-Wisp' },
    armarouge: { role: 'Psychic Spam attacker and Trick Room setter; Flash Fire', worstCase: 'Expanding Force in terrain: 180–213% Conkeldurr, 135–159% Pelipper', answer: 'Pelipper Weather Ball 141–166%; Kangaskhan Double-Edge 71–85%; Hangry Aura Wheel 79–95%' },
    indeedeef: { role: 'Psychic Surge (blocks our priority), Follow Me, Trick Room', worstCase: 'Psychic 83–99% on Conkeldurr', answer: 'Pelipper Weather Ball 61–72%; Drain Punch 51–62%. Not Kangaskhan Double-Edge (72–86%): Rocky Helmet + recoil cost it 53–57%' },
    drampa: { role: 'Cloud Nine (no rain, no sun) Trick Room attacker; Mega option', worstCase: 'Draco Meteor 106–125% on Conkeldurr under his Trick Room', answer: 'Conkeldurr Drain Punch OHKO (120–143%, Mega 94–114%); Kangaskhan Double-Edge 85–100% outside Trick Room (after his Draco, recoil KOs Kangaskhan)' },
    garchomp: { role: 'Mega-Z (Levitate, special) or Life Orb Rock Slide', worstCase: 'Draco Meteor OHKOs Pelipper (126–149%); Rock Slide 63–74% Pelipper', answer: 'Mega-Z: Fake Out (Levitate), then Kangaskhan Double-Edge (85–100%) beside a second hit; alone it leaves him at a sliver and the recoil leaves Kangaskhan in range. Physical: Scarf Pelipper outspeeds it (175 vs 169); Weather Ball 70–83% + Fake Out 26–31% or Double-Edge 77–92%. Base Garchomp has Rough Skin: Double-Edge costs Kangaskhan 47–51%, and a Morpeko Fake Out loses Morpeko its Sash' },
    forretress: { role: 'Sturdy, Rocky Helmet, Trick Room: his counter piece to this six', worstCase: 'Rocky Helmet punishes Parental Bond twice', answer: 'Charizard (Fire 4x)' },
    banette: { role: 'Mega Prankster: priority Trick Room, Will-O-Wisp', worstCase: 'Ghost: Mega Kangaskhan cannot touch it', answer: 'Hangry Aura Wheel OHKO (112–133%)' },
    pelipper: { job: 'Rain attacker: Weather Ball Rotom-Heat / Armarouge / Kleavor; Choice-locked, switch to re-choose', avoid: 'Leading into Drampa (no rain) or into a Rock Slide lead; Rotom-Heat free to Thunderbolt' },
    kangaskhan: { job: 'The Mega: Fake Out, Double-Edge 2HKOs most of his team, Parental Bond breaks Sashes', avoid: 'Mega Banette (Normal immune); Double-Edge into Rocky Helmet (Indeedee-F, Forretress) or Rough Skin (base Garchomp): two contact hits plus 33% recoil. Double-Edge recoil is 20–29% of Kangaskhan per use' },
    conkeldurr: { job: 'Drampa / Kleavor / Indeedee-F answer; resists Rock; Guts turns Will-O-Wisp into power', avoid: 'A healthy Armarouge with terrain up (180–213%)' },
    rotomfan: { job: 'Lead with Kangaskhan into Indeedee-F + Armarouge + Drampa: Thunderbolt, Electroweb for speed', avoid: 'Kleavor (Stone Axe OHKO)' },
    morpeko: { job: 'Fake Out (non-grounded targets only in terrain), Electroweb, Hangry Aura Wheel into Armarouge / Banette', avoid: 'Garchomp-Z Draco Meteor (Sash only)' },
    charizard: { job: 'Preview threat; comes vs Forretress (Fire 4x) or late once Rock users are gone and Drampa is out', avoid: 'Kleavor (Stone Axe and rocks), Garchomp Rock Slide, Drampa on the field' },
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

Pelipper @ Choice Scarf
Ability: Drizzle
Level: 50
EVs: 2 HP / 32 SpA / 32 Spe
Modest Nature
- Hurricane
- Weather Ball
- Hydro Pump
- U-turn

Kangaskhan @ Kangaskhanite
Ability: Scrappy
Level: 50
EVs: 32 HP / 32 Atk / 2 Def
Adamant Nature
- Fake Out
- Double-Edge
- Rock Slide
- Protect

Morpeko @ Focus Sash
Ability: Hunger Switch
Level: 50
EVs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Fake Out
- Aura Wheel
- Electroweb
- Protect

Conkeldurr @ Life Orb
Ability: Guts
Level: 50
EVs: 32 HP / 32 Atk / 2 SpD
Brave Nature
- Drain Punch
- Mach Punch
- Rock Slide
- Protect

Rotom-Fan @ Expert Belt
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

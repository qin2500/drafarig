// Matchup guide: Anthony (seat 5) vs ZhuZi (seat 3), Week 3. Schema: docs/research/strategy/guide-schema.md (v1).
// Readable version with sources: docs/research/strategy/match-zhuzi.md. Every number from sp-assist/spcalc.py (reproduces the
// app engine's goldens); scripts: sp-assist/match_zhuzi.py, sp-assist/zhuzi_scan.py.
// 'ladder' = Smogon Reg M-C >= 1760, Sept 2026, modal spread / top item / top ability. 'worst' = full learnset, max offence.

// Our sets (Week 1 six). sp = Champions Stat Points.
const ZARD = { id: 'charizardmegay', set: 'ours', ability: 'drought', item: 'charizarditey', nature: 'Modest', sp: { hp: 6, atk: 0, def: 0, spa: 32, spd: 2, spe: 26 } };
const AEGIS = { id: 'aegislash', set: 'ours', ability: 'stancechange', item: 'metalcoat', nature: 'Brave', sp: { hp: 32, atk: 32, def: 2, spa: 0, spd: 0, spe: 0 } };
const AEGIS_BLADE = { ...AEGIS, form: 'blade' };
const AEGIS_SHIELD = { ...AEGIS, form: 'shield' };
const KANGA = { id: 'kangaskhan', set: 'ours', ability: 'scrappy', item: 'lifeorb', nature: 'Adamant', sp: { hp: 32, atk: 32, def: 0, spa: 0, spd: 0, spe: 0 } };
const MORPEKO = { id: 'morpeko', set: 'ours', ability: 'hungerswitch', item: 'focussash', nature: 'Jolly', sp: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 } };
const MORPEKO_HANGRY = { ...MORPEKO, form: 'hangry' };
const SINISTCHA = { id: 'sinistcha', set: 'ours', ability: 'hospitality', item: 'cobaberry', nature: 'Calm', sp: { hp: 32, atk: 0, def: 2, spa: 0, spd: 32, spe: 0 } };
const ROTOM = { id: 'rotomfan', set: 'ours', ability: 'levitate', item: 'sitrusberry', nature: 'Modest', sp: { hp: 32, atk: 0, def: 0, spa: 32, spd: 2, spe: 0 } };

// ZhuZi's sets
const META = { id: 'metagrossmega', set: 'ladder', ability: 'toughclaws', item: 'metagrossite', nature: 'Jolly', sp: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 } };
const META_BASE = { id: 'metagross', set: 'ladder', ability: 'clearbody', item: 'choicescarf', nature: 'Jolly', sp: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 } };
const ROTOMW = { id: 'rotomwash', set: 'ladder', ability: 'levitate', item: 'sitrusberry', nature: 'Modest', sp: { hp: 32, atk: 0, def: 4, spa: 8, spd: 16, spe: 6 } };
const PULT = { id: 'dragapult', set: 'ladder', ability: 'clearbody', item: 'lifeorb', nature: 'Modest', sp: { hp: 2, atk: 0, def: 0, spa: 32, spd: 0, spe: 32 } };
const KROOK_IMPISH = { id: 'krookodile', set: 'ladder', ability: 'intimidate', item: 'choicescarf', nature: 'Impish', sp: { hp: 32, atk: 0, def: 3, spa: 0, spd: 25, spe: 6 } };
const KROOK = { id: 'krookodile', set: 'worst', ability: 'intimidate', item: 'lifeorb', nature: 'Adamant', sp: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 } };
const KROOK_SCARF = { id: 'krookodile', set: 'ladder', ability: 'intimidate', item: 'choicescarf', nature: 'Jolly', sp: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 } };
const NAPE = { id: 'infernape', set: 'ladder', ability: 'blaze', item: 'focussash', nature: 'Hasty', sp: { hp: 0, atk: 2, def: 0, spa: 32, spd: 0, spe: 32 } };
const SLOWKING = { id: 'slowkinggalar', set: 'ladder', ability: 'regenerator', item: 'colburberry', nature: 'Sassy', sp: { hp: 32, atk: 0, def: 5, spa: 19, spd: 10, spe: 0 } };
const SLOWKING_WORST = { id: 'slowkinggalar', set: 'worst', ability: 'regenerator', item: 'lifeorb', nature: 'Modest', sp: { hp: 32, atk: 0, def: 0, spa: 32, spd: 0, spe: 0 } };
const FLORGES = { id: 'florges', set: 'ladder', ability: 'flowerveil', item: 'grassyseed', nature: 'Modest', sp: { hp: 32, atk: 0, def: 0, spa: 32, spd: 2, spe: 0 } };
const ORANGURU = { id: 'oranguru', set: 'ladder', ability: 'innerfocus', item: 'mentalherb', nature: 'Relaxed', sp: { hp: 32, atk: 0, def: 32, spa: 0, spd: 2, spe: 0 } };
const TOX = { id: 'toxtricity', set: 'ladder', ability: 'punkrock', item: 'lifeorb', nature: 'Modest', sp: { hp: 1, atk: 0, def: 0, spa: 32, spd: 1, spe: 32 } };
const UMBREON = { id: 'umbreon', set: 'ladder', ability: 'innerfocus', item: 'leftovers', nature: 'Bold', sp: { hp: 30, atk: 0, def: 16, spa: 0, spd: 20, spe: 0 } };
const SUN = { weather: 'Sun' };

export default {
  version: 1, pov: 5, opp: 3, coach: 'ZhuZi', week: 3, written: '2026-10-19',
  rosters: {
    ours: ['charizard', 'sinistcha', 'pelipper', 'kangaskhan', 'aegislash', 'morpeko', 'conkeldurr', 'rotomfan', 'stunfiskgalar', 'simipour'],
    theirs: ['metagross', 'rotomwash', 'dragapult', 'krookodile', 'infernape', 'slowkinggalar', 'florges', 'oranguru', 'toxtricity', 'umbreon'],
  },
  assumptions: [
    'His sets are unknown: "ladder" = Smogon Reg M-C ladder (>= 1760, Sept), "worst" = full learnset at max offence. Both shown where they differ.',
    'Our sets are the Week 1 six (Kangaskhan = Scrappy, Life Orb, Fake Out / Last Resort).',
    'Doubles, spread x0.75, full HP, no crits or accuracy. Sun is on for hits into or by Mega Charizard Y unless noted.',
    'Likely 6 = draft cost x threat to our team; no drafted mon is ruled out.',
  ],
  remember: [
    'Charizard dies to Rock: Krookodile Rock Slide 131–157% (33% of ladder sets) / Stone Edge 235–278%. Metagross, Infernape and Oranguru can learn Rock moves. Lead Charizard only with Wide Guard (Aegislash) or Fake Out cover.',
    'Mega Charizard Y Heat Wave OHKOs Mega Metagross (138–162%) and Toxtricity (101–120%). Save Charizard for them.',
    'Toxtricity Overdrive does 95–113% to Charizard; with Oranguru Instruct it fires twice. Kill Toxtricity first. Oranguru has Inner Focus (no Fake Out) and often Mental Herb (Taunt fails).',
    'Galarian Slowking Chilly Reception sets snow: our sun is gone until Charizard re-enters.',
    "Don't attack with Aegislash into Umbreon / Oranguru: Foul Play uses our Attack (Blade form takes 188–223% / 126–149%).",
  ],
  bring: {
    six: ['charizard', 'aegislash', 'kangaskhan', 'morpeko', 'sinistcha', 'rotomfan'],
    bench: [
      { id: 'stunfiskgalar', why: 'Swap in for Rotom-Fan if he shows Toxtricity + Rotom-Wash without Krookodile: immune to both Electric attackers; Stomping Tantrum OHKOs Toxtricity / Infernape.' },
      { id: 'pelipper', why: 'Toxtricity Overdrive is 4x; rain powers Rotom-Wash.' },
      { id: 'conkeldurr', why: 'Psychic everywhere (Mega Metagross Psychic Fangs OHKOs it; Florges Moonblast too).' },
      { id: 'simipour', why: 'Little impact here.' },
    ],
    mega: { id: 'charizard', why: 'Heat Wave OHKOs Mega Metagross and Toxtricity; sun halves Rotom-Wash Hydro Pump. Kangaskhan is the Scrappy base form, so no conflict.' },
  },
  previews: [
    { if: 'their 6 includes Mega Metagross + Krookodile + Infernape', bring4: ['charizard', 'aegislash', 'kangaskhan', 'rotomfan'], lead: ['aegislash', 'kangaskhan'], note: 'Wide Guard + Fake Out first; Charizard comes in once Krookodile is handled.' },
    { if: 'their 6 includes Oranguru + Toxtricity', bring4: ['charizard', 'morpeko', 'kangaskhan', 'aegislash'], lead: ['morpeko', 'charizard'], note: 'Fake Out Toxtricity (not Oranguru: Inner Focus), Heat Wave OHKOs Toxtricity.' },
    { if: 'their 6 includes Galarian Slowking', bring4: ['charizard', 'morpeko', 'sinistcha', 'aegislash'], lead: ['morpeko', 'charizard'], note: 'Morpeko Taunts Slowking (no Mental Herb on ladder); Sinistcha re-sets Trick Room to cancel his.' },
    { if: 'their 6 includes Dragapult + Umbreon', bring4: ['charizard', 'kangaskhan', 'morpeko', 'sinistcha'], lead: ['charizard', 'kangaskhan'], note: 'Scrappy Fake Out hits Dragapult; keep Aegislash away from Foul Play.' },
  ],
  leads: [
    { ours: ['aegislash', 'kangaskhan'], vs: ['metagross', 'krookodile'],
      t1: 'Kangaskhan Fake Out Krookodile (Scrappy ignores Intimidate); Aegislash Poltergeist Mega Metagross (99–119%, 94% OHKO).',
      t2: 'Kangaskhan Last Resort Krookodile (96–114% vs Adamant, 72–86% vs Impish); Aegislash King\'s Shield (High Horsepower incoming).',
      t3: 'Charizard in on a free switch; Heat Wave cleans Metagross / Toxtricity.',
      ifs: ['if Metagross Protects T1 → repeat Poltergeist T2', 'if Krookodile moves before Charizard → Choice Scarf, locked: Shield / Protect its target', 'if Infernape comes in → its Fake Out goes to Kangaskhan (Aegislash is immune)'] },
    { ours: ['morpeko', 'charizard'], vs: ['oranguru', 'toxtricity'],
      t1: 'Morpeko Fake Out Toxtricity; Charizard Megas + Heat Wave (Toxtricity OHKO, Oranguru 54–64%).',
      t2: 'Charizard Weather Ball Oranguru (76–90%) + Morpeko Hangry Aura Wheel Oranguru (65–77%) → KO.',
      t3: 'Morpeko Taunt / Fake Out the next Trick Room setter.',
      ifs: ['if Oranguru sets Trick Room anyway → Charizard Protects, Sinistcha comes in and re-sets TR to cancel', 'if Toxtricity Protects T1 → it is setting up Instruct: hit Oranguru'] },
    { ours: ['charizard', 'kangaskhan'], vs: ['dragapult', 'metagross'],
      t1: 'Kangaskhan Fake Out Dragapult (Scrappy hits Ghost); Charizard Heat Wave (Metagross OHKO, Dragapult 45–53%).',
      t2: 'Kangaskhan Last Resort Dragapult; Charizard Heat Wave, or Protect if Draco (74–87%) is coming.',
      t3: 'Aegislash in for Poltergeist cleanup.',
      ifs: ['if Dragapult Will-O-Wisps Kangaskhan → burnt Last Resort halves: switch to Charizard / Aegislash damage'] },
  ],
  tells: [
    { see: 'Metagross Megas T1 (Tough Claws)', means: '178 Speed, faster than Morpeko', do: 'Heat Wave it (OHKO) or Poltergeist' },
    { see: 'Krookodile moves before Charizard (146)', means: 'Choice Scarf (42% of ladder sets), locked', do: 'Shield / Protect its target; Scarf Rock Slide does 91–108% to Charizard' },
    { see: 'Infernape Fake Outs T1', means: 'Fake Out set, likely Focus Sash', do: 'Needs two hits: Air Slash / Last Resort + anything' },
    { see: 'Oranguru keeps acting through Taunt', means: 'Mental Herb', do: 'Re-set our Trick Room to cancel; focus Toxtricity' },
    { see: 'Slowking-G uses Chilly Reception', means: 'Snow, our sun is gone', do: 'Switch Charizard out and back for Drought, or play non-Fire for 5 turns' },
    { see: 'Dragapult uses Will-O-Wisp', means: 'Our physical damage halves on the target', do: 'Lean on Charizard / Rotom-Fan; Sinistcha Hospitality heals on entry' },
  ],
  lose: [
    { how: 'Rock Slide / Stone Edge on Charizard T1', fix: 'Charizard leads only with Aegislash (Wide Guard) or a Fake Out on the Rock user; keep it in back vs Krookodile leads.' },
    { how: 'Trick Room + Instruct Overdrive sweeps', fix: 'Fake Out / KO Toxtricity first; Sinistcha re-sets TR to cancel; Wide Guard.' },
    { how: 'Foul Play KOs Blade Aegislash', fix: "Don't attack with Aegislash when Umbreon / Oranguru can target it; King's Shield." },
    { how: 'Snow removes sun, then Hydro Pump hits Charizard for 84–99%', fix: 'Re-enter Charizard for Drought; respect Rotom-Wash without sun.' },
    { how: 'Will-O-Wisp cripples Kangaskhan / Aegislash', fix: 'Fake Out Dragapult T1; keep special damage in the back.' },
  ],
  endgame: [
    'Preserve Charizard for Mega Metagross + Toxtricity (our only OHKO on both).',
    'Preserve Aegislash for Dragapult / Slowking-G (Poltergeist OHKO).',
    'Kangaskhan: Fake Out only on its first turn out; Last Resort only after Fake Out has been used. Don\'t bring it in late without a Fake Out turn.',
    'Trick Room lasts 5 turns including the set turn; his TR + our re-set = cancelled. Charizard is slow under TR.',
    'Sun lasts 5 turns from the Mega turn; Chilly Reception snow replaces it.',
  ],
  combos: {
    theirs: [
      { attackers: [['toxtricity', 'overdrive'], ['oranguru', 'instruct']], into: 'charizard', range: '190–225%', answer: 'KO / Fake Out Toxtricity first; Aegislash Wide Guard blocks both Overdrives.' },
      { attackers: [['toxtricity', 'overdrive'], ['krookodile', 'rockslide']], into: 'charizard', range: '226–270%', answer: 'Wide Guard blocks both spreads.' },
      { attackers: [['metagross', 'psychicfangs'], ['dragapult', 'dracometeor']], into: 'kangaskhan', range: '134–158%', answer: 'Fake Out one of them.' },
      { attackers: [['krookodile', 'highhorsepower'], ['toxtricity', 'overdrive']], into: 'aegislash', range: '135–160%', answer: 'Wide Guard stops only Overdrive; switch Aegislash.' },
      { attackers: [['infernape', 'heatwave'], ['krookodile', 'highhorsepower']], into: 'aegislash', range: '165–196%', answer: "Our sun boosts Infernape's Heat Wave: don't keep Aegislash beside sun vs Infernape." },
      { attackers: [['dragapult', 'dracometeor'], ['toxtricity', 'overdrive']], into: 'rotomfan', range: '130–155%', answer: 'Protect.' },
      { attackers: [['metagross', 'psychicfangs'], ['dragapult', 'shadowball']], into: 'sinistcha', range: '130–157%', answer: 'Rage Powder only when Sinistcha can take one hit.' },
    ],
    ours: [
      { attackers: [['charizard', 'heatwave'], ['kangaskhan', 'lastresort']], into: 'krookodile', range: '132–157%', verdict: 'KO' },
      { attackers: [['charizard', 'heatwave'], ['kangaskhan', 'lastresort']], into: 'oranguru', range: '112–133%', verdict: 'KO' },
      { attackers: [['charizard', 'weatherball'], ['kangaskhan', 'lastresort']], into: 'oranguru', range: '134–159%', verdict: 'KO' },
      { attackers: [['charizard', 'heatwave'], ['kangaskhan', 'lastresort']], into: 'rotomwash', range: '111–132%', verdict: 'KO' },
      { attackers: [['charizard', 'heatwave'], ['kangaskhan', 'lastresort']], into: 'slowkinggalar', range: '123–146%', verdict: 'KO' },
      { attackers: [['charizard', 'heatwave'], ['kangaskhan', 'lastresort']], into: 'umbreon', range: '94–110%', verdict: 'maybe' },
      { attackers: [['aegislash', 'closecombat'], ['kangaskhan', 'lastresort']], into: 'umbreon', range: '112–132%', verdict: 'KO' },
      { attackers: [['charizard', 'heatwave'], ['aegislash', 'poltergeist']], into: 'dragapult', range: '212–250%', verdict: 'KO' },
    ],
  },
  calcs: [
    // theirs -> ours
    { attacker: KROOK, defender: ZARD, move: 'rockslide', field: { ...SUN, spread: true }, range: '130.8–157.2%', verdict: 'OHKO', why: 'Rock 4x; Wide Guard blocks it' },
    { attacker: KROOK_SCARF, defender: ZARD, move: 'rockslide', field: { ...SUN, spread: true }, range: '90.6–108.2%', verdict: '44% OHKO', why: 'Scarf ladder set' },
    { attacker: KROOK, defender: ZARD, move: 'stoneedge', field: SUN, range: '235.2–278.0%', verdict: 'OHKO', why: 'single target: not Wide-Guardable' },
    { attacker: TOX, defender: ZARD, move: 'overdrive', field: { ...SUN, spread: true }, range: '95.0–112.6%', verdict: '69% OHKO', why: 'Punk Rock; Instruct doubles it' },
    { attacker: TOX, defender: ROTOM, move: 'overdrive', field: { spread: true }, range: '50.3–60.5%', verdict: '2HKO', why: '' },
    { attacker: SLOWKING, defender: ZARD, move: 'powergem', field: SUN, range: '85.5–100.6%', verdict: '6% OHKO', why: 'ladder (11% run it)' },
    { attacker: SLOWKING_WORST, defender: ZARD, move: 'powergem', field: SUN, range: '127.7–153.5%', verdict: 'OHKO', why: 'worst case: Life Orb Modest' },
    { attacker: META, defender: ZARD, move: 'psychicfangs', field: SUN, range: '79.9–94.3%', verdict: 'survives', why: '' },
    { attacker: META, defender: AEGIS_BLADE, move: 'stompingtantrum', field: {}, range: '121.0–142.5%', verdict: 'OHKO', why: 'Blade form after attacking' },
    { attacker: PULT, defender: AEGIS_BLADE, move: 'shadowball', field: {}, range: '168.3–197.6%', verdict: 'OHKO', why: 'Shield form takes 74.9–88.6%' },
    { attacker: PULT, defender: KANGA, move: 'dracometeor', field: {}, range: '75.5–88.7%', verdict: 'survives', why: '' },
    { attacker: NAPE, defender: AEGIS_SHIELD, move: 'overheat', field: SUN, range: '129.3–152.1%', verdict: 'OHKO', why: 'our sun boosts his Fire; 86.2–101.8% without sun' },
    { attacker: NAPE, defender: SINISTCHA, move: 'overheat', field: SUN, range: '132.6–158.4%', verdict: 'OHKO', why: '' },
    { attacker: KROOK, defender: AEGIS_SHIELD, move: 'highhorsepower', field: {}, range: '95.2–113.8%', verdict: '69% OHKO', why: '' },
    { attacker: UMBREON, defender: AEGIS_BLADE, move: 'foulplay', field: {}, range: '188.0–222.8%', verdict: 'OHKO', why: 'Foul Play uses our Blade Attack' },
    { attacker: ORANGURU, defender: AEGIS_BLADE, move: 'foulplay', field: {}, range: '125.7–148.5%', verdict: 'OHKO', why: '' },
    { attacker: ROTOMW, defender: ZARD, move: 'hydropump', field: SUN, range: '41.5–49.1%', verdict: 'survives', why: '84.3–99.4% without sun' },
    // ours -> theirs
    { attacker: ZARD, defender: META, move: 'heatwave', field: { ...SUN, spread: true }, range: '137.6–161.8%', verdict: 'OHKO', why: '91.7–107.6% through Light Screen' },
    { attacker: ZARD, defender: TOX, move: 'heatwave', field: { ...SUN, spread: true }, range: '101.3–119.9%', verdict: 'OHKO', why: '' },
    { attacker: ZARD, defender: KROOK, move: 'weatherball', field: SUN, range: '127.3–150.0%', verdict: 'OHKO', why: 'Impish set: 84.7–100%' },
    { attacker: ZARD, defender: ROTOMW, move: 'solarbeam', field: SUN, range: '93.0–110.8%', verdict: '63% OHKO', why: '' },
    { attacker: AEGIS_BLADE, defender: META, move: 'poltergeist', field: {}, range: '99.4–118.5%', verdict: '94% OHKO', why: '' },
    { attacker: AEGIS_BLADE, defender: PULT, move: 'poltergeist', field: {}, range: '167.3–197.6%', verdict: 'OHKO', why: 'still 112.7–132.1% at −1' },
    { attacker: AEGIS_BLADE, defender: SLOWKING, move: 'poltergeist', field: {}, range: '124.8–146.5%', verdict: 'OHKO', why: '' },
    { attacker: AEGIS_BLADE, defender: FLORGES, move: 'ironhead', field: {}, range: '140.5–166.5%', verdict: 'OHKO', why: '' },
    { attacker: KANGA, defender: NAPE, move: 'lastresort', field: {}, range: '135.1–160.3%', verdict: 'OHKO', why: 'Focus Sash on ladder' },
    { attacker: KANGA, defender: TOX, move: 'lastresort', field: {}, range: '122.5–144.4%', verdict: 'OHKO', why: '' },
    { attacker: KANGA, defender: KROOK, move: 'lastresort', field: {}, range: '95.9–114.0%', verdict: '81% OHKO', why: 'Scrappy ignores Intimidate' },
    { attacker: MORPEKO_HANGRY, defender: PULT, move: 'aurawheel', field: {}, range: '116.4–138.2%', verdict: 'OHKO', why: 'Hangry form: Dark' },
    { attacker: ROTOM, defender: NAPE, move: 'airslash', field: {}, range: '107.3–127.2%', verdict: 'OHKO', why: 'Sash holds' },
  ],
  perMon: {
    metagross: { role: 'Mega (Tough Claws), 178 Speed physical attacker', worstCase: 'Stone Edge (learnable) 209–247% on Charizard; Stomping Tantrum OHKOs Blade Aegislash / Morpeko', answer: 'Charizard Heat Wave OHKO; Aegislash Poltergeist 94% OHKO', notes: ['Base form on ladder is Choice Scarf (201 Speed) with Explosion 18%'] },
    dragapult: { role: 'Fast special attacker / Will-O-Wisp support (194–213 Speed)', worstCase: 'Shadow Ball OHKOs Blade Aegislash; Draco OHKOs Morpeko', answer: 'Aegislash Poltergeist OHKO; Hangry Aura Wheel OHKO; Scrappy Fake Out / Last Resort', notes: ['Will-O-Wisp 66%: burns our physical attackers'] },
    rotomwash: { role: 'Bulky pivot: Hydro Pump / Will-O-Wisp / Thunderbolt', worstCase: 'Thunderbolt (Life Orb) 104–125% on Charizard; Hydro Pump 84–99% without sun', answer: 'Sun halves Hydro Pump; Solar Beam 93–111%; Heat Wave + Last Resort', notes: [] },
    oranguru: { role: 'Trick Room + Instruct support; Inner Focus, Mental Herb', worstCase: 'Foul Play OHKOs Blade Aegislash; Imprison can block our Trick Room', answer: 'Heat Wave + Last Resort / Weather Ball + Last Resort; not Fake Out', notes: ['Instruct + Toxtricity Overdrive = two Overdrives'] },
    krookodile: { role: 'Intimidate physical attacker; Choice Scarf 42%', worstCase: 'Rock Slide 131–157% / Stone Edge 235–278% on Charizard; High Horsepower 95–114% Shield Aegislash', answer: 'Kangaskhan Fake Out + Last Resort (Scrappy ignores Intimidate); Weather Ball / Solar Beam', notes: ['Rock Slide is 33% of ladder sets: assume it'] },
    infernape: { role: 'Fake Out + special Fire / Fighting (176 Speed), Focus Sash', worstCase: 'Overheat in our sun OHKOs Shield Aegislash and Sinistcha', answer: 'Kangaskhan Last Resort / Rotom-Fan Air Slash / Aegislash Poltergeist (Sash needs two hits)', notes: [] },
    florges: { role: 'Special Fairy (Moonblast / Dazzling Gleam / Calm Mind)', worstCase: 'Moonblast OHKOs Morpeko and Conkeldurr', answer: 'Aegislash Iron Head OHKO; Kangaskhan Last Resort OHKO', notes: ['Least likely of his 10 to matter vs our six'] },
    toxtricity: { role: 'Punk Rock spread attacker (Overdrive / Boomburst)', worstCase: 'Overdrive 95–113% on Charizard; with Instruct twice', answer: 'Charizard Heat Wave OHKO; Kangaskhan Last Resort OHKO; Wide Guard', notes: ['Boomburst can\'t touch Aegislash / Sinistcha (Ghost)'] },
    slowkinggalar: { role: 'Trick Room / Chilly Reception (snow) pivot, Regenerator', worstCase: 'Power Gem 128–154% on Charizard (Life Orb Modest); snow removes our sun', answer: 'Aegislash Poltergeist OHKO; Morpeko Taunt (no Mental Herb on ladder)', notes: [] },
    umbreon: { role: 'Bulky support: Foul Play / Snarl / Taunt; Inner Focus', worstCase: 'Foul Play OHKOs Blade Aegislash (188–223%)', answer: 'Aegislash Close Combat + Last Resort; Heat Wave + Last Resort (maybe)', notes: ['Inner Focus: no Fake Out flinch'] },
    charizard: { job: 'OHKO Mega Metagross / Toxtricity with Heat Wave; sun halves Rotom-Wash', avoid: 'Krookodile Rock Slide / Stone Edge, Slowking Power Gem, Toxtricity Overdrive', notes: ['146 Speed beats Krookodile Adamant 144 and Toxtricity 127'] },
    aegislash: { job: 'Wide Guard for Charizard; Poltergeist OHKOs Metagross / Dragapult / Slowking / Infernape; Iron Head OHKOs Florges', avoid: 'Attacking into Foul Play (Umbreon / Oranguru); Infernape Overheat in sun; Krookodile High Horsepower', notes: ['Immune to Boomburst, Fake Out and Close Combat'] },
    kangaskhan: { job: 'Scrappy Fake Out (hits Dragapult) and Last Resort: OHKOs Infernape / Toxtricity / Florges', avoid: 'Psychic Fangs + Draco double target; Will-O-Wisp', notes: ['Immune to Krookodile Intimidate (Scrappy)', 'No Fake Out flinch on Oranguru / Umbreon (Inner Focus)'] },
    morpeko: { job: 'Fake Out / Taunt Trick Room setters; Hangry Aura Wheel OHKOs Dragapult', avoid: 'Krookodile Earthquake, Florges Moonblast, Infernape (all OHKO; Sash once)', notes: ['Dark: immune to Psychic Fangs / Psychic'] },
    sinistcha: { job: 'Re-set Trick Room to cancel his; Rage Powder for Charizard', avoid: 'Infernape Overheat in sun; Psychic Fangs + Shadow Ball', notes: [] },
    rotomfan: { job: 'Will-O-Wisp Mega Metagross / Krookodile; Air Slash OHKOs Infernape', avoid: 'Draco + Overdrive double target', notes: ['Swap for Stunfisk-Galar vs Toxtricity + Rotom-Wash'] },
  },
  sets: `Charizard @ Charizardite Y
Ability: Blaze
Level: 50
EVs: 6 HP / 32 SpA / 2 SpD / 26 Spe
Modest Nature
- Heat Wave
- Weather Ball
- Solar Beam
- Protect

Aegislash @ Metal Coat
Ability: Stance Change
Level: 50
EVs: 32 HP / 32 Atk / 2 Def
Brave Nature
- Poltergeist
- Iron Head
- King's Shield
- Wide Guard

Kangaskhan @ Life Orb
Ability: Scrappy
Level: 50
EVs: 32 HP / 32 Atk
Adamant Nature
- Fake Out
- Last Resort

Morpeko @ Focus Sash
Ability: Hunger Switch
Level: 50
EVs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Fake Out
- Aura Wheel
- Taunt
- Protect

Sinistcha @ Coba Berry
Ability: Hospitality
Level: 50
EVs: 32 HP / 2 Def / 32 SpD
Calm Nature
- Matcha Gotcha
- Rage Powder
- Trick Room
- Protect

Rotom-Fan @ Sitrus Berry
Ability: Levitate
Level: 50
EVs: 32 HP / 32 SpA / 2 SpD
Modest Nature
- Thunderbolt
- Air Slash
- Will-O-Wisp
- Protect
`,
};

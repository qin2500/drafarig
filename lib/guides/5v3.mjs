// Matchup guide: Anthony (seat 5) vs ZhuZi (seat 3), Week 3. Schema: docs/research/strategy/guide-schema.md (v1).
// Readable versions with sources: docs/research/strategy/match-zhuzi.md (the plan) and
// docs/research/strategy/sim/zhuzi-sim-report.md (the Showdown simulation that chose this six, "c1", and this preview table:
// round 7, each candidate six with its own fitted preview, validated on fresh games).
// Every calc reproduces in the app engine (node docs/research/strategy/sp-assist/verify_curated.mjs).
// 'ladder' = Smogon Reg M-C >= 1760, Sept 2026, modal spread / top item / top ability. 'worst' = full learnset, max offence.
// Revised 2026-10-22 for the sim's six (c1): 32 HP / 0 Speed Charizard, Kasib / Shadow Sneak Aegislash, Silk Scarf
// Double-Edge Kangaskhan, Bold Sitrus Sinistcha, Conkeldurr in Rotom-Fan's slot.

// Our sets (sp = Champions Stat Points).
const ZARD = { id: 'charizardmegay', set: 'ours', ability: 'drought', item: 'charizarditey', nature: 'Modest', sp: { hp: 32, atk: 0, def: 0, spa: 32, spd: 2, spe: 0 } };
const AEGIS = { id: 'aegislash', set: 'ours', ability: 'stancechange', item: 'kasibberry', nature: 'Brave', sp: { hp: 32, atk: 32, def: 2, spa: 0, spd: 0, spe: 0 } };
const AEGIS_BLADE = { ...AEGIS, form: 'blade' };
const AEGIS_SHIELD = { ...AEGIS, form: 'shield' };
const KANGA = { id: 'kangaskhan', set: 'ours', ability: 'scrappy', item: 'silkscarf', nature: 'Adamant', sp: { hp: 32, atk: 32, def: 2, spa: 0, spd: 0, spe: 0 } };
const MORPEKO_HANGRY = { id: 'morpeko', set: 'ours', ability: 'hungerswitch', item: 'focussash', nature: 'Jolly', sp: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 }, form: 'hangry' };
const SINISTCHA = { id: 'sinistcha', set: 'ours', ability: 'hospitality', item: 'sitrusberry', nature: 'Bold', sp: { hp: 32, atk: 0, def: 14, spa: 0, spd: 20, spe: 0 } };
const CONK = { id: 'conkeldurr', set: 'ours', ability: 'ironfist', item: 'lifeorb', nature: 'Brave', sp: { hp: 32, atk: 32, def: 0, spa: 0, spd: 2, spe: 0 } };

// ZhuZi's sets
const META = { id: 'metagrossmega', set: 'ladder', ability: 'toughclaws', item: 'metagrossite', nature: 'Jolly', sp: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 } };
const ROTOMW = { id: 'rotomwash', set: 'ladder', ability: 'levitate', item: 'sitrusberry', nature: 'Modest', sp: { hp: 32, atk: 0, def: 4, spa: 8, spd: 16, spe: 6 } };
const PULT = { id: 'dragapult', set: 'ladder', ability: 'clearbody', item: 'lifeorb', nature: 'Modest', sp: { hp: 2, atk: 0, def: 0, spa: 32, spd: 0, spe: 32 } };
const KROOK_IMPISH = { id: 'krookodile', set: 'ladder', ability: 'intimidate', item: 'passhoberry', nature: 'Impish', sp: { hp: 32, atk: 0, def: 3, spa: 0, spd: 25, spe: 6 } };
const KROOK = { id: 'krookodile', set: 'worst', ability: 'intimidate', item: 'lifeorb', nature: 'Adamant', sp: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 } };
const KROOK_SCARF = { id: 'krookodile', set: 'ladder', ability: 'intimidate', item: 'choicescarf', nature: 'Jolly', sp: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 } };
const NAPE = { id: 'infernape', set: 'ladder', ability: 'blaze', item: 'focussash', nature: 'Hasty', sp: { hp: 0, atk: 2, def: 0, spa: 32, spd: 0, spe: 32 } };
const SLOWKING = { id: 'slowkinggalar', set: 'ladder', ability: 'regenerator', item: 'colburberry', nature: 'Sassy', sp: { hp: 32, atk: 0, def: 5, spa: 19, spd: 10, spe: 0 } };
const SLOWKING_WORST = { id: 'slowkinggalar', set: 'worst', ability: 'regenerator', item: 'lifeorb', nature: 'Modest', sp: { hp: 32, atk: 0, def: 0, spa: 32, spd: 0, spe: 0 } };
const FLORGES = { id: 'florges', set: 'ladder', ability: 'flowerveil', item: 'leftovers', nature: 'Modest', sp: { hp: 32, atk: 0, def: 0, spa: 32, spd: 2, spe: 0 } };
const ORANGURU = { id: 'oranguru', set: 'ladder', ability: 'innerfocus', item: 'mentalherb', nature: 'Relaxed', sp: { hp: 32, atk: 0, def: 32, spa: 0, spd: 2, spe: 0 } };
const TOX = { id: 'toxtricity', set: 'ladder', ability: 'punkrock', item: 'lifeorb', nature: 'Modest', sp: { hp: 1, atk: 0, def: 0, spa: 32, spd: 1, spe: 32 } };
const UMBREON = { id: 'umbreon', set: 'ladder', ability: 'innerfocus', item: 'leftovers', nature: 'Bold', sp: { hp: 30, atk: 0, def: 16, spa: 0, spd: 20, spe: 0 } };
const SUN = { weather: 'Sun' };

export default {
  version: 1, pov: 5, opp: 3, coach: 'ZhuZi', week: 3, written: '2026-10-22',
  rosters: {
    ours: ['charizard', 'sinistcha', 'pelipper', 'kangaskhan', 'aegislash', 'morpeko', 'conkeldurr', 'rotomfan', 'stunfiskgalar', 'simipour'],
    theirs: ['metagross', 'rotomwash', 'dragapult', 'krookodile', 'infernape', 'slowkinggalar', 'florges', 'oranguru', 'toxtricity', 'umbreon'],
  },
  assumptions: [
    'His sets are unknown: "ladder" = Smogon Reg M-C ladder (>= 1760, Sept), "worst" = full learnset at max offence. Both shown where they differ.',
    'Our six is the Showdown simulation\'s pick (zhuzi-sim-report.md): 78% weighted win rate over 24 plausible ZhuZi teams with closed team sheets (our league\'s format) and the preview table below, measured on games not used to choose it; +8.6 points over the best alternative six. Re-checked with an expert search engine piloting both sides: 77% and +12.1 over the alternative. Audit (2026-10-28): those margins let our side guess his sets from the same candidate list his teams were built from. With generic ladder guesses instead, c1 still wins about 80%, but its edge shrinks: +1.3 ±2.9 over the Rotom-Fan six (a tie) and +2.9 ±2.8 over a17 (borderline). c1 is the best or tied best six, not clearly ahead.',
    'Not tested by the sim: Rain Dance and Encore (all of his roster can learn Rain Dance; Infernape, Oranguru and Toxtricity Encore). The sim\'s AI almost never chose those moves in test games, so the rain and Encore advice below comes from calcs and mechanics, not sim results.',
    'Doubles, spread x0.75, full HP, no crits or accuracy. Sun is on for hits into or by Mega Charizard Y unless noted.',
    'Likely 6 = draft cost x threat to our team; no drafted mon is ruled out.',
  ],
  remember: [
    "Charizard and Rock: Life Orb Krookodile Rock Slide still OHKOs (112.4–135.1%), Scarf Rock Slide doesn't (77.8–92.9%), Stone Edge always does. Lead Charizard only with Wide Guard (Aegislash) or a Fake Out on the Rock user.",
    'Mega Charizard Y Heat Wave OHKOs Mega Metagross (137.5–161.7%) and Toxtricity (101.3–119.8%). Save Charizard for them.',
    'Trick Room is our answer to his fast core (Krookodile, Infernape, Mega Metagross, Dragapult): under it everything we bring moves first. Sinistcha sets it through Scarf Knock Off (67.4–80.8%).',
    'Toxtricity Overdrive does 81.6–96.7% to Charizard: it survives one, not two (Oranguru Instruct). Kill Toxtricity first.',
    'Galarian Slowking Chilly Reception sets snow: our sun is gone until Charizard re-enters.',
    "Don't attack with Aegislash into Umbreon / Oranguru: Foul Play uses our Attack (Blade form takes 188.0–222.7% / 125.7–148.5%).",
  ],
  bring: {
    six: ['charizard', 'aegislash', 'kangaskhan', 'morpeko', 'sinistcha', 'conkeldurr'],
    bench: [
      { id: 'rotomfan', why: 'An equal alternative for Conkeldurr\'s slot: +6.8 points for Conkeldurr when our side guessed his sets from his candidate list, but a tie (+1.3 ±2.9) with generic ladder guesses. Conkeldurr stays for its calcs: under Trick Room Drain Punch OHKOs Krookodile and Ice Punch OHKOs Dragapult.' },
      { id: 'stunfiskgalar', why: 'An equal alternative for Morpeko\'s slot: the sim scored it +0.8 ±1.6 points (a tie). Electric and Poison immune with a Stomping Tantrum OHKO on Toxtricity; brought in about a quarter of games, where Morpeko is never brought.' },
      { id: 'pelipper', why: 'Drizzle fights our sun; −12.2 points in Morpeko\'s slot in the sim.' },
      { id: 'simipour', why: 'A second Fake Out adds little; −9.3 points in Morpeko\'s slot in the sim.' },
    ],
    mega: { id: 'charizard', why: 'Heat Wave OHKOs Mega Metagross and Toxtricity; sun halves Rotom-Wash Hydro Pump. Kangaskhan is the Scrappy base form, so no conflict.' },
  },
  previews: [
    // The sim's best bring / lead per kind of six, fitted on 2880 games that tried the AI's 8 best previews evenly and checked
    // on 2880 fresh games (zhuzi-sim-report.md §6): 76.9% overall, +3.0 ±1.8 points over the previous rows.
    { if: 'their 6 includes Mega Metagross + Krookodile + Infernape', bring4: ['kangaskhan', 'sinistcha', 'charizard', 'conkeldurr'], lead: ['kangaskhan', 'sinistcha'],
      note: 'Trick Room first: Sinistcha is immune to Fake Out and Close Combat and survives Scarf Knock Off (67.4–80.8%). Conkeldurr in the back, not Aegislash: under Trick Room Drain Punch OHKOs Krookodile (163.3–191.8%) and Ice Punch Dragapult. Sim: 78% vs these sixes; with Aegislash in the back 74%.' },
    { if: 'their 6 includes Oranguru + Toxtricity', bring4: ['charizard', 'kangaskhan', 'sinistcha', 'aegislash'], lead: ['charizard', 'kangaskhan'],
      note: 'Fake Out Toxtricity (not Oranguru: Inner Focus), Heat Wave OHKOs Toxtricity (101.3–119.8%). Sinistcha re-sets Trick Room to cancel his.' },
    // z08-style anti-Anthony six (Rock Slide Metagross + Life Orb Krookodile + Power Gem Slowking + Foul Play Umbreon).
    // The best lead depends on what he knows (zhuzi-sim-report.md §6), 120 fresh games per row:
    //   closed sheets (game 1): this row 81%, Aegislash + Kangaskhan with Charizard home 62%;
    //   full information (games 2-3, our sets seen): Aegislash + Kangaskhan / Conkeldurr + Sinistcha 70%, this row 52%.
    { if: 'their 6 includes Galarian Slowking + Umbreon', bring4: ['aegislash', 'sinistcha', 'charizard', 'kangaskhan'], lead: ['aegislash', 'sinistcha'],
      note: 'Game 1 (he has not seen our sets): Wide Guard + Trick Room first, Charizard in the back (Life Orb Rock Slide 112.4–135.1%). Games 2–3, once he knows our sets: lead Aegislash + Kangaskhan, Conkeldurr + Sinistcha behind, Charizard home. Keep Aegislash in Shield form when Umbreon can Foul Play it.' },
    { if: 'their 6 includes Galarian Slowking', bring4: ['charizard', 'kangaskhan', 'aegislash', 'sinistcha'], lead: ['charizard', 'kangaskhan'],
      note: 'Poltergeist OHKOs Slowking (124.7–146.5%); after Chilly Reception, switch Charizard out and back for Drought.' },
    { if: 'their 6 includes Dragapult + Umbreon', bring4: ['charizard', 'kangaskhan', 'sinistcha', 'conkeldurr'], lead: ['charizard', 'kangaskhan'],
      note: 'Scrappy Fake Out hits Dragapult; Conkeldurr instead of Aegislash (Foul Play): Drain Punch 87.0–105.5% on Umbreon, Ice Punch OHKOs Dragapult (118.1–140.0%).' },
  ],
  leads: [
    { ours: ['kangaskhan', 'sinistcha'], vs: ['krookodile', 'infernape'],
      t1: 'Sinistcha Trick Room: a Ghost (no Fake Out, no Close Combat) that survives Scarf Knock Off (67.4–80.8%). Kangaskhan Fake Out Krookodile; Infernape (176) out-speeds Kangaskhan (110) and usually Fake Outs it first, which is fine: Trick Room is the point.',
      t2: 'Trick Room flips the game: Infernape 176, Mega Metagross 178 and Scarf Krookodile 237 now move after all of ours, Charizard (120) included. Kangaskhan out to Conkeldurr vs Krookodile (Drain Punch 163.3–191.8%) or Charizard vs Mega Metagross; Sinistcha Matcha Gotcha (Krookodile 62.7–74.4%, heals) or Protect.',
      t3: 'Charizard Megas and Heat Wave goes first (Mega Metagross 137.5–161.7%). Kangaskhan returns later with a fresh Fake Out, then Double-Edge (Toxtricity 96.0–113.9%, Krookodile 76.7–90.6%).',
      ifs: ['if Krookodile is locked into Knock Off on Sinistcha → Rage Powder keeps drawing it while our attackers move first',
        'if Infernape is in front under Trick Room → Conkeldurr Mach Punch (62.2–72.8%) after any hit breaks the Sash',
        'Charizard survives Scarf Rock Slide (77.8–92.9%) but not the Life Orb set (112.4–135.1%): bring it in after Trick Room is up'] },
    { ours: ['charizard', 'kangaskhan'], vs: ['oranguru', 'toxtricity'],
      t1: 'Kangaskhan Fake Out Toxtricity (Inner Focus stops Fake Out on Oranguru); Charizard Megas + Heat Wave: Toxtricity OHKO (101.3–119.8%), Oranguru 53.8–63.9%.',
      t2: 'Charizard Weather Ball Oranguru (76.1–89.8%) + Kangaskhan Double-Edge Oranguru (46.1–54.8%) → KO.',
      t3: 'Sinistcha in to re-set Trick Room if his went up (ours cancels his).',
      ifs: ['if Oranguru sets Trick Room anyway → his slow side moves first: Charizard Protects, Sinistcha re-sets to cancel', 'if Toxtricity Protects T1 → it is waiting for Instruct: hit Oranguru',
        'Charizard survives one Overdrive (81.6–96.7%), not two'] },
    { ours: ['charizard', 'kangaskhan'], vs: ['dragapult', 'metagross'],
      t1: 'Kangaskhan Fake Out Dragapult (Scrappy hits Ghost); Charizard Heat Wave (Mega Metagross 137.5–161.7%, Dragapult 44.8–52.7%).',
      t2: 'Kangaskhan Double-Edge Dragapult (83.6–98.7%: KO after Heat Wave) or Sucker Punch (54.5–65.4%) if it is about to attack; Charizard survives Draco (63.2–74.5%).',
      t3: 'Aegislash in: Poltergeist OHKOs Dragapult (167.2–197.5%); with Kasib Berry its Shadow Ball no longer OHKOs Blade (83.8–98.8%).',
      ifs: ['if Dragapult Will-O-Wisps Kangaskhan → burnt Double-Edge halves: switch to Charizard / Aegislash damage'] },
  ],
  tells: [
    { see: 'Metagross Megas T1 (Tough Claws)', means: '178 Speed, faster than all of ours', do: 'Heat Wave it (OHKO), or Poltergeist when Krookodile is not beside it' },
    { see: 'Krookodile moves before Charizard (120)', means: 'Choice Scarf (237) or Adamant / Jolly (144 / 158); the Impish set (118) is slower', do: 'Scarf Rock Slide 77.8–92.9% (survives); Life Orb 112.4–135.1%: Wide Guard or Protect' },
    { see: 'Infernape Fake Outs T1', means: 'Fake Out set, likely Focus Sash', do: 'Needs two hits: Double-Edge / Matcha Gotcha + Shadow Sneak / Mach Punch' },
    { see: 'Oranguru keeps acting through Taunt', means: 'Mental Herb', do: 'Re-set our Trick Room to cancel; focus Toxtricity' },
    { see: 'Slowking-G uses Chilly Reception', means: 'Snow, our sun is gone', do: 'Switch Charizard out and back for Drought, or play non-Fire for 5 turns' },
    { see: 'Rain Dance (any of his roster can learn it)', means: 'Our sun is gone and Hydro Pump OHKOs Charizard (108.1–127.6%, ladder Rotom-Wash)', do: 'Protect or switch Charizard out; re-entering brings the sun back (Drought). Matcha Gotcha is super effective on Rotom-Wash' },
    { see: 'Encore from Infernape / Oranguru / Toxtricity', means: 'The target must repeat its last move for 3 turns: a second Trick Room would end ours', do: 'Switch the Encored Pokémon out; after setting Trick Room, don\'t leave Sinistcha in beside an Encore user' },
    { see: 'Dragapult uses Will-O-Wisp', means: 'Our physical damage halves on the target', do: 'Lean on Charizard; Sinistcha Hospitality heals on entry' },
  ],
  lose: [
    { how: 'Rock Slide / Stone Edge on Charizard T1', fix: 'Charizard leads only with Aegislash (Wide Guard) or a Fake Out on the Rock user; vs Krookodile leads, Trick Room first. Without Wide Guard the sim lost 10.4 points.' },
    { how: 'Trick Room + Instruct Overdrive sweeps', fix: 'Fake Out / KO Toxtricity first; Sinistcha re-sets TR to cancel; Wide Guard.' },
    { how: 'Foul Play KOs Blade Aegislash', fix: "Don't attack with Aegislash when Umbreon / Oranguru can target it; King's Shield; Conkeldurr handles Umbreon." },
    { how: 'Snow removes sun, then Hydro Pump hits Charizard for 72.4–85.4%', fix: 'Re-enter Charizard for Drought; respect Rotom-Wash without sun.' },
    { how: 'Rain Dance, then Hydro Pump OHKOs Charizard (108.1–127.6%)', fix: 'Protect or switch Charizard out and back in; Drought restores the sun.' },
    { how: 'Will-O-Wisp cripples Kangaskhan / Aegislash / Conkeldurr', fix: 'Fake Out Dragapult T1; lean on Charizard.' },
  ],
  endgame: [
    'Preserve Charizard for Mega Metagross + Toxtricity (our only OHKO on both).',
    'Preserve Aegislash for Dragapult / Slowking-G (Poltergeist OHKO).',
    'Kangaskhan: Fake Out only on its first turn out; Sucker Punch only when the target is about to attack (it fails into Protect and status moves).',
    'Trick Room lasts 5 turns including the set turn; his TR + our re-set = cancelled. Conkeldurr (58) and Charizard (120) want it up.',
    'Sun lasts 5 turns from the Mega turn; Chilly Reception snow replaces it.',
  ],
  combos: {
    theirs: [
      { attackers: [['toxtricity', 'overdrive'], ['oranguru', 'instruct']], into: 'charizard', range: '163–193%', answer: 'KO / Fake Out Toxtricity first; Aegislash Wide Guard blocks both Overdrives.' },
      { attackers: [['toxtricity', 'overdrive'], ['krookodile', 'rockslide']], into: 'charizard', range: '194–232%', answer: 'Wide Guard blocks both spreads.' },
      { attackers: [['metagross', 'psychicfangs'], ['dragapult', 'dracometeor']], into: 'kangaskhan', range: '132–157%', answer: 'Fake Out one of them.' },
      { attackers: [['krookodile', 'highhorsepower'], ['toxtricity', 'overdrive']], into: 'aegislash', range: '135–160%', answer: 'Wide Guard stops only Overdrive; switch Aegislash.' },
      { attackers: [['infernape', 'heatwave'], ['krookodile', 'highhorsepower']], into: 'aegislash', range: '165–196%', answer: "Our sun boosts Infernape's Heat Wave: don't keep Aegislash beside sun vs Infernape." },
      { attackers: [['metagross', 'psychicfangs'], ['dragapult', 'shadowball']], into: 'sinistcha', range: '138–163%', answer: 'Rage Powder only when Sinistcha can take one hit.' },
      { attackers: [['krookodile', 'knockoff'], ['metagross', 'psychicfangs']], into: 'sinistcha', range: '113–135%', answer: 'Set Trick Room T1 before both can hit it; Protect if both target it.' },
      { attackers: [['dragapult', 'dracometeor'], ['toxtricity', 'overdrive']], into: 'conkeldurr', range: '143–169%', answer: 'Protect; bring it in under Trick Room.' },
    ],
    ours: [
      { attackers: [['charizard', 'heatwave'], ['kangaskhan', 'doubleedge']], into: 'krookodile', range: '167–198%', verdict: 'KO' },
      { attackers: [['charizard', 'heatwave'], ['kangaskhan', 'doubleedge']], into: 'oranguru', range: '100–119%', verdict: 'KO' },
      { attackers: [['charizard', 'weatherball'], ['kangaskhan', 'doubleedge']], into: 'oranguru', range: '122–145%', verdict: 'KO' },
      { attackers: [['charizard', 'heatwave'], ['kangaskhan', 'doubleedge']], into: 'rotomwash', range: '95–112%', verdict: 'maybe' },
      { attackers: [['charizard', 'heatwave'], ['kangaskhan', 'doubleedge']], into: 'slowkinggalar', range: '107–127%', verdict: 'KO' },
      { attackers: [['charizard', 'heatwave'], ['aegislash', 'poltergeist']], into: 'dragapult', range: '212–250%', verdict: 'KO' },
      { attackers: [['kangaskhan', 'doubleedge'], ['conkeldurr', 'drainpunch']], into: 'umbreon', range: '128–154%', verdict: 'KO' },
    ],
  },
  calcs: [
    // theirs -> ours
    { attacker: ROTOMW, defender: ZARD, move: 'hydropump', field: { weather: 'Rain' }, range: '108.1–127.6%', verdict: 'OHKO', why: 'if he sets Rain Dance (35.7–42.2% in our sun)' },
    { attacker: KROOK, defender: ZARD, move: 'rockslide', field: { ...SUN, spread: true }, range: '112.4–135.1%', verdict: 'OHKO', why: 'Rock 4x; Wide Guard blocks it' },
    { attacker: KROOK_SCARF, defender: ZARD, move: 'rockslide', field: { ...SUN, spread: true }, range: '77.8–92.9%', verdict: 'survives', why: 'Scarf ladder set (the old 6 HP / 26 Speed spread took 90.5–108.1%)' },
    { attacker: KROOK, defender: ZARD, move: 'stoneedge', field: SUN, range: '202.1–238.9%', verdict: 'OHKO', why: 'single target: not Wide-Guardable' },
    { attacker: TOX, defender: ZARD, move: 'overdrive', field: { ...SUN, spread: true }, range: '81.6–96.7%', verdict: 'survives', why: 'Punk Rock; Instruct doubles it' },
    { attacker: SLOWKING, defender: ZARD, move: 'powergem', field: SUN, range: '73.5–86.4%', verdict: 'survives', why: 'ladder (11% run it)' },
    { attacker: SLOWKING_WORST, defender: ZARD, move: 'powergem', field: SUN, range: '109.7–131.8%', verdict: 'OHKO', why: 'worst case: Life Orb Modest' },
    { attacker: META, defender: ZARD, move: 'psychicfangs', field: SUN, range: '68.6–81.0%', verdict: 'survives', why: '' },
    { attacker: PULT, defender: ZARD, move: 'dracometeor', field: SUN, range: '63.2–74.5%', verdict: 'survives', why: '' },
    { attacker: ROTOMW, defender: ZARD, move: 'hydropump', field: {}, range: '72.4–85.4%', verdict: 'survives', why: 'no sun (after snow); 41–49% in sun' },
    { attacker: META, defender: AEGIS_BLADE, move: 'stompingtantrum', field: {}, range: '120.9–142.5%', verdict: 'OHKO', why: 'Blade form after attacking' },
    { attacker: PULT, defender: AEGIS_BLADE, move: 'shadowball', field: {}, range: '83.8–98.8%', verdict: 'survives', why: 'Kasib Berry halves it (Metal Coat Blade took 168–198%)' },
    { attacker: PULT, defender: KANGA, move: 'dracometeor', field: {}, range: '75.4–88.6%', verdict: 'survives', why: '' },
    { attacker: NAPE, defender: AEGIS_SHIELD, move: 'overheat', field: SUN, range: '129.3–152.0%', verdict: 'OHKO', why: 'our sun boosts his Fire' },
    { attacker: NAPE, defender: SINISTCHA, move: 'overheat', field: SUN, range: '161.7–192.1%', verdict: 'OHKO', why: '' },
    { attacker: NAPE, defender: SINISTCHA, move: 'heatwave', field: { ...SUN, spread: true }, range: '88.7–105.6%', verdict: '31% OHKO', why: 'spread, in our sun' },
    { attacker: KROOK, defender: AEGIS_SHIELD, move: 'highhorsepower', field: {}, range: '95.2–113.7%', verdict: '69% OHKO', why: '' },
    { attacker: KROOK_SCARF, defender: AEGIS_SHIELD, move: 'knockoff', field: {}, range: '69.4–82.6%', verdict: 'survives', why: 'Knock Off also removes the berry' },
    { attacker: KROOK_SCARF, defender: SINISTCHA, move: 'knockoff', field: {}, range: '67.4–80.8%', verdict: 'survives', why: 'Bold Sitrus: Trick Room goes up through it' },
    { attacker: META, defender: SINISTCHA, move: 'ironhead', field: {}, range: '42.6–50.5%', verdict: 'survives', why: '' },
    { attacker: UMBREON, defender: AEGIS_BLADE, move: 'foulplay', field: {}, range: '188.0–222.7%', verdict: 'OHKO', why: 'Foul Play uses our Blade Attack' },
    { attacker: ORANGURU, defender: AEGIS_BLADE, move: 'foulplay', field: {}, range: '125.7–148.5%', verdict: 'OHKO', why: '' },
    { attacker: META, defender: CONK, move: 'psychicfangs', field: {}, range: '101.8–119.8%', verdict: 'OHKO', why: 'keep Conkeldurr away from Mega Metagross' },
    { attacker: FLORGES, defender: CONK, move: 'moonblast', field: {}, range: '104.7–124.5%', verdict: 'OHKO', why: '' },
    { attacker: PULT, defender: CONK, move: 'dracometeor', field: {}, range: '86.3–101.8%', verdict: '13% OHKO', why: '' },
    // ours -> theirs
    { attacker: ZARD, defender: META, move: 'heatwave', field: { ...SUN, spread: true }, range: '137.5–161.7%', verdict: 'OHKO', why: '91.7–107.6% through Light Screen' },
    { attacker: ZARD, defender: TOX, move: 'heatwave', field: { ...SUN, spread: true }, range: '101.3–119.8%', verdict: 'OHKO', why: '' },
    { attacker: ZARD, defender: ORANGURU, move: 'heatwave', field: { ...SUN, spread: true }, range: '53.8–63.9%', verdict: '2HKO', why: '' },
    { attacker: ZARD, defender: PULT, move: 'heatwave', field: { ...SUN, spread: true }, range: '44.8–52.7%', verdict: 'no OHKO', why: '' },
    { attacker: ZARD, defender: KROOK, move: 'weatherball', field: SUN, range: '127.3–150.0%', verdict: 'OHKO', why: 'Impish set: 84.6–100.0%' },
    { attacker: ZARD, defender: KROOK_IMPISH, move: 'weatherball', field: SUN, range: '84.6–100.0%', verdict: '6% OHKO', why: '' },
    { attacker: ZARD, defender: ORANGURU, move: 'weatherball', field: SUN, range: '76.1–89.8%', verdict: '2HKO', why: '' },
    { attacker: ZARD, defender: ROTOMW, move: 'solarbeam', field: SUN, range: '92.9–110.8%', verdict: '63% OHKO', why: '' },
    { attacker: AEGIS_BLADE, defender: META, move: 'poltergeist', field: {}, range: '99.3–118.4%', verdict: '94% OHKO', why: '' },
    { attacker: AEGIS_BLADE, defender: META, move: 'poltergeist', field: { intimidate: 1 }, range: '64.9–77.7%', verdict: '2HKO', why: 'after Krookodile Intimidate (−1)' },
    { attacker: AEGIS_BLADE, defender: PULT, move: 'poltergeist', field: {}, range: '167.2–197.5%', verdict: 'OHKO', why: '' },
    { attacker: AEGIS_BLADE, defender: SLOWKING, move: 'poltergeist', field: {}, range: '124.7–146.5%', verdict: 'OHKO', why: '' },
    { attacker: AEGIS_BLADE, defender: FLORGES, move: 'poltergeist', field: {}, range: '81.0–95.6%', verdict: '2HKO', why: '' },
    { attacker: AEGIS_BLADE, defender: PULT, move: 'shadowsneak', field: {}, range: '61.8–73.9%', verdict: '2HKO', why: 'priority' },
    { attacker: AEGIS_BLADE, defender: NAPE, move: 'shadowsneak', field: {}, range: '38.4–46.3%', verdict: 'no OHKO', why: 'priority: finishes a Sash-broken Infernape' },
    { attacker: KANGA, defender: NAPE, move: 'doubleedge', field: {}, range: '105.9–125.8%', verdict: 'Sash holds', why: 'Focus Sash on ladder' },
    { attacker: KANGA, defender: TOX, move: 'doubleedge', field: {}, range: '96.0–113.9%', verdict: '81% OHKO', why: '' },
    { attacker: KANGA, defender: KROOK_SCARF, move: 'doubleedge', field: {}, range: '76.7–90.6%', verdict: '2HKO', why: 'Scrappy ignores Intimidate' },
    { attacker: KANGA, defender: PULT, move: 'doubleedge', field: {}, range: '83.6–98.7%', verdict: '2HKO', why: 'Scrappy: Normal hits Ghost' },
    { attacker: KANGA, defender: PULT, move: 'suckerpunch', field: {}, range: '54.5–65.4%', verdict: '2HKO', why: 'priority; fails into Protect or a status move' },
    { attacker: KANGA, defender: ORANGURU, move: 'doubleedge', field: {}, range: '46.1–54.8%', verdict: 'no OHKO', why: '' },
    { attacker: KANGA, defender: ROTOMW, move: 'doubleedge', field: {}, range: '63.6–75.1%', verdict: '2HKO', why: '' },
    { attacker: KANGA, defender: FLORGES, move: 'doubleedge', field: {}, range: '80.0–94.5%', verdict: '2HKO', why: '' },
    { attacker: SINISTCHA, defender: KROOK_SCARF, move: 'matchagotcha', field: { spread: true }, range: '62.7–74.4%', verdict: '2HKO', why: 'spread; heals Sinistcha' },
    { attacker: CONK, defender: KROOK_SCARF, move: 'drainpunch', field: {}, range: '163.3–191.8%', verdict: 'OHKO', why: '108.7–128.4% after Intimidate' },
    { attacker: CONK, defender: KROOK_SCARF, move: 'drainpunch', field: { intimidate: 1 }, range: '108.7–128.4%', verdict: 'OHKO', why: 'after Intimidate (−1)' },
    { attacker: CONK, defender: UMBREON, move: 'drainpunch', field: {}, range: '87.0–105.5%', verdict: '25% OHKO', why: '' },
    { attacker: CONK, defender: PULT, move: 'icepunch', field: {}, range: '118.1–140.0%', verdict: 'OHKO', why: '' },
    { attacker: CONK, defender: NAPE, move: 'machpunch', field: {}, range: '62.2–72.8%', verdict: '2HKO', why: 'priority' },
    { attacker: MORPEKO_HANGRY, defender: PULT, move: 'aurawheel', field: {}, range: '116.3–138.1%', verdict: 'OHKO', why: 'Hangry form: Dark' },
  ],
  perMon: {
    metagross: { role: 'Mega (Tough Claws), 178 Speed physical attacker', worstCase: 'Stone Edge (learnable) on Charizard; Stomping Tantrum OHKOs Blade Aegislash (120.9–142.5%)', answer: 'Charizard Heat Wave OHKO (137.5–161.7%); Aegislash Poltergeist 94% OHKO (not beside Krookodile)', notes: ['Base form on ladder is Choice Scarf (201 Speed) with Explosion 18%', 'Psychic Fangs OHKOs Conkeldurr (101.8–119.8%)'] },
    dragapult: { role: 'Fast special attacker / Will-O-Wisp support (194–213 Speed)', worstCase: 'Draco Meteor on Kangaskhan (75.4–88.6%); Shadow Ball no longer OHKOs Kasib Aegislash (83.8–98.8%)', answer: 'Aegislash Poltergeist OHKO; Conkeldurr Ice Punch OHKO (118.1–140.0%); Scrappy Fake Out then Double-Edge / Sucker Punch', notes: ['Will-O-Wisp 66%: burns our physical attackers'] },
    rotomwash: { role: 'Bulky pivot: Hydro Pump / Will-O-Wisp / Thunderbolt', worstCase: 'Hydro Pump 72.4–85.4% on Charizard without sun', answer: 'Sun halves Hydro Pump; Solar Beam 92.9–110.8%; Heat Wave + Double-Edge', notes: [] },
    oranguru: { role: 'Trick Room + Instruct support; Inner Focus, Mental Herb', worstCase: 'Foul Play OHKOs Blade Aegislash; Imprison can block our Trick Room', answer: 'Weather Ball + Double-Edge; not Fake Out', notes: ['Instruct + Toxtricity Overdrive = two Overdrives'] },
    krookodile: { role: 'Intimidate physical attacker; Choice Scarf 42%', worstCase: 'Life Orb Rock Slide 112.4–135.1% / Stone Edge 202.1–238.9% on Charizard', answer: 'Trick Room, then Conkeldurr Drain Punch (OHKO even at −1: 108.7–128.4%), Charizard Weather Ball or Matcha Gotcha', notes: ['Rock Slide is 33% of ladder sets: assume it', 'Its Intimidate drops Aegislash and Conkeldurr, not Kangaskhan (Scrappy)'] },
    infernape: { role: 'Fake Out + special Fire / Fighting (176 Speed), Focus Sash', worstCase: 'Overheat in our sun OHKOs Shield Aegislash (129.3–152.0%) and Sinistcha', answer: 'Two hits through the Sash: Double-Edge + Shadow Sneak / Mach Punch', notes: ['Out-speeds and Fake Outs Kangaskhan T1'] },
    florges: { role: 'Special Fairy (Moonblast / Dazzling Gleam / Calm Mind)', worstCase: 'Moonblast OHKOs Morpeko and Conkeldurr (104.7–124.5%)', answer: 'Kangaskhan Double-Edge (80.0–94.5%) + Poltergeist (81.0–95.6%)', notes: ['Least likely of his 10 to matter vs our six'] },
    toxtricity: { role: 'Punk Rock spread attacker (Overdrive / Boomburst)', worstCase: 'Overdrive 81.6–96.7% on Charizard; with Instruct twice', answer: 'Charizard Heat Wave OHKO; Kangaskhan Double-Edge 81% OHKO; Wide Guard', notes: ["Boomburst can't touch Aegislash / Sinistcha (Ghost)"] },
    slowkinggalar: { role: 'Trick Room / Chilly Reception (snow) pivot, Regenerator', worstCase: 'Power Gem 109.7–131.8% on Charizard (Life Orb Modest); snow removes our sun', answer: 'Aegislash Poltergeist OHKO (124.7–146.5%)', notes: [] },
    umbreon: { role: 'Bulky support: Foul Play / Snarl / Taunt; Inner Focus', worstCase: 'Foul Play OHKOs Blade Aegislash (188.0–222.7%)', answer: 'Conkeldurr Drain Punch (87.0–105.5%); Double-Edge + Drain Punch', notes: ['Inner Focus: no Fake Out flinch'] },
    charizard: { job: 'OHKO Mega Metagross / Toxtricity with Heat Wave; sun halves Rotom-Wash', avoid: 'Life Orb Krookodile Rock Slide / Stone Edge, Toxtricity Overdrive + Instruct',
      notes: ['32 HP / 0 Speed (the sim saw no difference from 6 HP / 26 Speed; the bulk is the reason): survives Scarf Rock Slide (77.8–92.9%), Overdrive (81.6–96.7%) and ladder Power Gem (73.5–86.4%)', '120 Speed: slower than his whole fast core, so it moves first under our Trick Room; still faster than Rotom-Wash (112) and Impish Krookodile (118)'] },
    aegislash: { job: 'Wide Guard for Charizard (sim: −10.4 points without it); Poltergeist OHKOs Metagross / Dragapult / Slowking; Shadow Sneak finishes', avoid: 'Attacking into Foul Play (Umbreon / Oranguru); Infernape Overheat in sun; standing beside Krookodile (Intimidate)', notes: ['Kasib Berry: Dragapult Shadow Ball 83.8–98.8% on Blade', 'Immune to Boomburst, Fake Out and Close Combat'] },
    kangaskhan: { job: 'Scrappy Fake Out (hits Dragapult); Double-Edge: Toxtricity 96.0–113.9%, Dragapult 83.6–98.7%; Sucker Punch vs fast attackers', avoid: 'Psychic Fangs + Draco double target; Will-O-Wisp', notes: ['Immune to Intimidate (Scrappy)', 'Brought in every sim game with the preview table; Protect matters (Low Kick in its slot: −8.4 points)'] },
    morpeko: { job: 'Fake Out / Taunt Trick Room setters; Hangry Aura Wheel OHKOs Dragapult (116.3–138.1%)', avoid: 'Krookodile (immune to Aura Wheel), Florges Moonblast, Infernape', notes: ['Not in any preview row: a sixth slot that changes what he brings, not one we use. Pelipper / Simipour there scored 9–12 points lower'] },
    sinistcha: { job: 'Trick Room vs his fast core; Rage Powder; Matcha Gotcha 62.7–74.4% on Krookodile; re-set TR to cancel his', avoid: 'Infernape Overheat in sun (161.7–192.1%); Knock Off + Psychic Fangs double target', notes: ['Bold Sitrus: Scarf Knock Off 67.4–80.8%', 'The most valuable member in the sim: −18.0 points without it'] },
    conkeldurr: { job: 'Trick Room attacker: Drain Punch OHKOs Krookodile (163.3–191.8%), Ice Punch OHKOs Dragapult (118.1–140.0%), Mach Punch finishes Infernape', avoid: 'Mega Metagross Psychic Fangs (101.8–119.8%), Florges Moonblast (104.7–124.5%)', notes: ['58 Speed: moves first under Trick Room', 'Replaced Rotom-Fan (+6.8 points in the sim); brought in 66% of games'] },
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

Aegislash @ Kasib Berry
Ability: Stance Change
Level: 50
EVs: 32 HP / 32 Atk / 2 Def
Brave Nature
- Poltergeist
- Shadow Sneak
- King's Shield
- Wide Guard

Kangaskhan @ Silk Scarf
Ability: Scrappy
Level: 50
EVs: 32 HP / 32 Atk / 2 Def
Adamant Nature
- Fake Out
- Double-Edge
- Sucker Punch
- Protect

Morpeko @ Focus Sash
Ability: Hunger Switch
Level: 50
EVs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Fake Out
- Aura Wheel
- Taunt
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

Conkeldurr @ Life Orb
Ability: Iron Fist
Level: 50
EVs: 32 HP / 32 Atk / 2 SpD
Brave Nature
- Drain Punch
- Mach Punch
- Ice Punch
- Protect
`,
};

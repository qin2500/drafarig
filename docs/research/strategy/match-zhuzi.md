# Anthony vs ZhuZi (Week 3): game plan

2026-10-19.
- **League:** sheet re-read 20:10 UTC. ZhuZi (seat 3): Metagross 20, Dragapult 15, Rotom-Wash 14, Oranguru 10, Krookodile 9, Infernape 7,
  Florges 7, Toxtricity 7, Galarian Slowking 6, Umbreon 5. Anthony: unchanged.
- **Calcs:** `sp-assist/spcalc.py`, which reproduces the app's engine test cases exactly. Scripts: `sp-assist/match_zhuzi.py` (both directions),
  `sp-assist/zhuzi_scan.py` (worst-case scan; rows in `sp-assist/zhuzi-scan.json`).
- **App data:** `lib/guides/5v3.mjs`, the same content in guide-schema form.

**Two kinds of opposing set**, labelled everywhere:
- **Ladder:** Smogon Reg M-C ≥ 1760, Sept: modal spread, top item, top ability. It's what ladder players run, not ZhuZi.
- **Worst:** the full legal learnset × legal abilities × realistic item, at max offence (32 SP + boosting nature).

No drafted mon is called "unlikely" without its worst case (§1).

**Field defaults:** doubles, spread ×0.75, full HP, no crits. **Sun is on for anything hitting or hit by Mega Charizard Y** (Drought), unless noted.

Our sets are §5, the Week 1 six (Kangaskhan is Scrappy, Life Orb, Fake Out / Last Resort):
- Mega Charizard Y: Modest 6/0/0/32/2/26.
- Aegislash: Brave 32/32/2/0/0/0, Metal Coat.
- Morpeko: Jolly 2/32/0/0/0/32, Focus Sash.
- Rotom-Fan: Modest 32/0/0/32/2/0, Sitrus.
- Sinistcha: Calm 32/0/2/0/32/0, Coba.
- Kangaskhan: Adamant 32/32, Life Orb.

---

## 0. Remember (top 5)
1. **Charizard dies to Rock.**
   - Krookodile Rock Slide: ladder Life Orb, Adamant 131–157%; 33% of ladder sets run it.
   - Krookodile Stone Edge: 235–278%.
   - Metagross, Infernape and Oranguru all *learn* Rock Slide / Stone Edge / Rock Tomb.
   - Galarian Slowking Power Gem (worst case): 128–154%.

   **Aegislash's Wide Guard** blocks Rock Slide (not Stone Edge or Power Gem). Lead Charizard only with Wide Guard or Fake Out cover.
2. **Mega Charizard Y's Heat Wave OHKOs Mega Metagross (138–162%) and Toxtricity (101–120%)** in sun. Metagross is his strongest mon.
3. **Toxtricity's Overdrive (Punk Rock) does 95–113% to Charizard** (69% OHKO), even in sun.
   - Oranguru + **Instruct** fires it twice (190–225%).
   - Taunt or Fake Out Oranguru doesn't work: Inner Focus blocks Fake Out, and Mental Herb (40% of ladder sets) shrugs off Taunt.
   - Kill Toxtricity first (Heat Wave or Last Resort OHKO it).
4. **Galarian Slowking's Chilly Reception sets snow** and switches out: **our sun is gone.** Re-set it by switching Charizard out and back in (Drought on entry).
5. **Don't attack with Aegislash into Umbreon / Oranguru.** Foul Play uses *our* Attack: Blade form takes 188–223% (Umbreon) / 126–149% (Oranguru). King's Shield first, or let others handle them.

## 1. ZhuZi's 10: ladder set vs worst case

| Mon (cost) | Ladder (usage %) | Worst case worth fearing (max offence) | Our answer |
|---|---|---|---|
| **Metagross** (20) → **Mega** (Tough Claws) | Mega: Jolly 2/32/0/0/0/32 (178 Spe), Psychic Fangs 94 / Protect 90 / Iron Head 45 / Stomping Tantrum 38 / Body Press 34. Base: Scarf 20% Jolly, Explosion 18% | **Stone Edge** (learnable) 209–247% on Charizard. Stomping Tantrum OHKOs Blade Aegislash (121–143%) and Morpeko. Psychic Fangs OHKOs Conkeldurr | Charizard Heat Wave **OHKO** (138–162%; 92–108% through Light Screen). Weather Ball 195–229%. Aegislash Poltergeist 99–119% (94%) |
| **Dragapult** (15) | Modest / Timid 32 SpA, Life Orb 61%: Draco 69 / Shadow Ball 68 / **Will-O-Wisp 66** / Protect. 194–213 Spe | Draco OHKOs Morpeko; Phantom Force OHKOs Sinistcha (worst); Shadow Ball OHKOs Blade Aegislash (168–198%) | Aegislash Poltergeist OHKO (167–198%; −1 still 113–132%); Morpeko Hangry Aura Wheel OHKO (116–138%); Heat Wave + Poltergeist |
| **Rotom-Wash** (14) | Sitrus 43%, Hydro Pump 96 / Will-O-Wisp 74 / Thunderbolt 69, Modest bulky | Discharge spread (worst) OHKOs Pelipper / Simipour; Thunderbolt Life Orb 104–125% on Charizard | Sun halves Hydro Pump (Charizard 42–49%). Solar Beam 93–111%; Heat Wave + Last Resort 111–132% |
| **Oranguru** (10) | **Inner Focus** 77%, **Mental Herb** 40%: Trick Room 96 / **Instruct 96** / Psychic 55 / Encore 27 / Imprison 16. Relaxed 32/0/32 | Foul Play OHKOs Blade Aegislash (126–149%). Imprison blocks our Trick Room | Heat Wave + Last Resort 112–133%; Weather Ball + Last Resort 134–159%. Not Fake Out (Inner Focus) |
| **Krookodile** (9) | Intimidate 85%, **Scarf 42%** / Passho 29 / Life Orb 13: Knock Off 81 / High Horsepower 80 / EQ 47 / **Rock Slide 33** / Stone Edge 22. Impish 32/0/3/0/25/6 or Adamant / Jolly 32 | **Rock Slide 131–157% / Stone Edge 235–278% on Charizard** (Life Orb Adamant); High Horsepower Shield Aegislash 95–114% | Charizard Weather Ball 127–150% / Solar Beam 136–161% (Adamant set); Kangaskhan Last Resort 96–114% (81%) on it; Scrappy ignores its Intimidate |
| **Infernape** (7) | Focus Sash 53%, **Fake Out 90** / Heat Wave 42 / Aura Sphere 37 / Close Combat 29 / Overheat 24. Hasty / Timid 32 SpA (176 Spe) | **Overheat in our sun OHKOs Shield Aegislash (129–152%) and Sinistcha (133–158%)**; Rock Slide (learnable) on Charizard | Kangaskhan Last Resort OHKO (135–160%); Rotom-Fan Air Slash OHKO (107–127%); Aegislash Poltergeist OHKO. Sash: needs two hits |
| **Florges** (7) | Flower Veil, Grassy Seed / Leftovers: Moonblast / Dazzling Gleam / Calm Mind / Pollen Puff | Moonblast OHKOs Morpeko / Conkeldurr; Dazzling Gleam spread 116–138% Morpeko | **Aegislash Iron Head OHKO (141–167%)**; Kangaskhan Last Resort OHKO (101–120%) |
| **Toxtricity** (7) | **Punk Rock**, Life Orb 50% / Scarf 25%: **Overdrive 93** / Sludge Bomb 80 / **Boomburst 63** / Protect. Modest 32 / 32 (127 Spe) | **Overdrive 95–113% Charizard**; Boomburst OHKOs Morpeko (Sash holds); Overdrive + Instruct = 2 hits | **Charizard Heat Wave OHKO (101–120%)**; Kangaskhan Last Resort OHKO (122–144%); Aegislash Poltergeist 96–114% |
| **Galarian Slowking** (6) | Regenerator, Colbur / Sitrus: **Trick Room 72** / Sludge Bomb 59 / **Chilly Reception 55** / Psychic 31 / Power Gem 11. Sassy 32 HP, 45 Spe | **Power Gem 128–154% on Charizard** (Life Orb Modest; ladder 86–101%); snow cancels our sun | Aegislash Poltergeist OHKO (125–147%); Heat Wave + Last Resort 123–146% |
| **Umbreon** (5) | Inner Focus 89%, Leftovers: **Foul Play 93** / Snarl 78 / Moonlight / Yawn / Taunt 31 | Foul Play on Blade Aegislash 188–223%. Snarl lowers our SpA | Aegislash Close Combat + Last Resort 112–132%; Heat Wave + Last Resort 94–110% |

**Likely 6 (ASSUMPTION; ranked by draft cost × what they do to *our* team):**
Mega Metagross, Dragapult, Rotom-Wash, Krookodile, Toxtricity + Oranguru *or* Infernape.
- Galarian Slowking and Umbreon are real options: snow-reset and Foul Play both target our plan.
- Florges is the least likely (it does little into Aegislash / Charizard).

**His win conditions:**
- Mega Metagross + Krookodile Intimidate / Rock Slide under Infernape's Fake Out.
- Oranguru Trick Room + Instruct Toxtricity Overdrive.
- Dragapult's Will-O-Wisp crippling Kangaskhan / Aegislash.

## 2. Our six and the Mega

**Bring: Mega Charizard Y, Aegislash, Kangaskhan (Scrappy), Morpeko, Sinistcha, Rotom-Fan.** It's the Week 1 six; why each stays:

| Mon | Why it stays |
|---|---|
| Charizard (Mega Y) | OHKOs Mega Metagross and Toxtricity; sun halves Rotom-Wash |
| Aegislash | Immune to Boomburst / Fake Out / Close Combat. Poltergeist OHKOs Metagross / Dragapult / Slowking / Infernape. Wide Guard covers Rock Slide and Overdrive |
| Kangaskhan | Scrappy: Fake Out and Last Resort hit Dragapult, and it's immune to Krookodile's Intimidate. Last Resort OHKOs Infernape / Toxtricity / Florges |
| Morpeko | Fake Out, Taunt the Trick Room setters (Slowking-G has no Mental Herb on ladder); Dark type immune to Psychic Fangs / Psychic. Hangry Aura Wheel OHKOs Dragapult |
| Sinistcha | Our Trick Room reverses his (and flips Dragapult / Metagross / Infernape speed). Rage Powder protects Charizard |
| Rotom-Fan | Will-O-Wisp cripples Mega Metagross and Krookodile; Air Slash OHKOs Infernape; immune to EQ / High Horsepower |

**Swap option:** **Stunfisk-Galar for Rotom-Fan** if his 6 shows Toxtricity *and* Rotom-Wash without Krookodile.
- It's immune to both Electric attackers, and Stomping Tantrum OHKOs Toxtricity (183–217%) and Infernape.
- Brave 0 Spe = 46 for Trick Room.

**Mega:** Charizard Y. Our Kangaskhan is the Scrappy base form (no Mega), so there's no conflict.

**Bench:** Pelipper (Toxtricity's Overdrive 4x; rain helps Rotom-Wash), Conkeldurr (Psychic everywhere: Psychic Fangs OHKOs it), Simipour.

## 3. Preview → bring 4

| His 6 includes… | Bring | Lead |
|---|---|---|
| Mega Metagross + Krookodile + Infernape (offense) | Charizard, Aegislash, Kangaskhan, Rotom-Fan | **Aegislash + Kangaskhan** (Wide Guard + Fake Out), Charizard in back |
| Oranguru + Toxtricity (Trick Room / Instruct) | Charizard, Morpeko, Kangaskhan, Aegislash | **Morpeko + Charizard**: Morpeko Fake Out on Toxtricity (not Oranguru: Inner Focus) or Taunt Oranguru (unless Mental Herb), Charizard Heat Wave |
| Galarian Slowking (snow / Trick Room) | Add Morpeko (Taunt) + Sinistcha (our Trick Room cancels his) | — |
| Dragapult + Umbreon (Will-O-Wisp / Foul Play) | Charizard, Kangaskhan, Morpeko, Sinistcha | Charizard + Kangaskhan |

## 4. Leads (turn by turn)

**A. Aegislash + Kangaskhan vs Mega Metagross + Krookodile**
- **T1:** Kangaskhan **Fake Out Krookodile** (stops Rock Slide; Scrappy ignores the Intimidate). Aegislash **Poltergeist Metagross** (99–119%, 94% OHKO).
  - If Metagross Protects → Poltergeist is wasted; T2 repeat.
- **T2:** Kangaskhan **Last Resort Krookodile** (96–114% vs the Adamant set; 72–86% vs Impish), Aegislash **King's Shield** (High Horsepower is incoming).
- **T3:** Bring Charizard in on a free switch; Heat Wave cleans Metagross / Toxtricity.
- **Ifs:**
  - Krookodile is Scarf (moves before Charizard 146) → it's locked; Shield the target.
  - Infernape comes in → its Fake Out can't touch Aegislash (Ghost), so expect it on Kangaskhan.

**B. Morpeko + Charizard vs Oranguru + Toxtricity**
- **T1:** Morpeko **Fake Out Toxtricity** (Inner Focus stops Fake Out on Oranguru). Charizard Megas + **Heat Wave**: Toxtricity OHKO, Oranguru 54–64%.
  - If Oranguru sets Trick Room anyway → his slow side moves first for 4 turns. Charizard Protects T2. Bring Sinistcha in and re-set
    Trick Room to cancel it.
- **T2:** Weather Ball Oranguru (76–90%) + Morpeko Hangry Aura Wheel Oranguru (65–77%) → KO.
- **T3:** Morpeko Taunt / Fake Out a replacement Trick Room setter.

**C. Charizard + Kangaskhan vs Dragapult + Mega Metagross**
- **T1:** Kangaskhan **Fake Out Dragapult** (Scrappy hits Ghost). Charizard **Heat Wave**: Metagross OHKO, Dragapult 45–53%.
- **T2:** Kangaskhan **Last Resort Dragapult** (Scrappy). Charizard Heat Wave / Protect if Draco is coming (74–87%).
- **T3:** Aegislash in for Poltergeist cleanup.
- **Ifs:**
  - Dragapult Will-O-Wisps Kangaskhan → swap to Charizard / Aegislash damage.
  - Burnt Kangaskhan's Last Resort halves.

## 5. Sets (paste; Champions SP on the EVs line; six different items)
```
Charizard @ Charizardite Y
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
```

**Benchmarks these hit vs ZhuZi:**

| Mon | Benchmarks |
|---|---|
| Charizard | 146 Speed beats Krookodile Adamant 144 / Toxtricity 127; survives Mega Metagross Psychic Fangs (80–94%) and Dragapult Draco (74–87%) |
| Aegislash | Poltergeist OHKOs Mega Metagross (94%) / Dragapult / Slowking / Infernape. Shield form survives Overdrive and ladder Shadow Ball |
| Kangaskhan | Last Resort OHKOs Infernape / Toxtricity / Florges; 212 HP survives Psychic Fangs (59–69%) and Draco (76–89%) |
| Morpeko | 163 beats everything but Dragapult / Mega Metagross / Infernape and any Choice Scarf user (Krookodile, base Metagross) |
| Sinistcha | Survives Psychic Fangs (55–65%) and Dragapult Shadow Ball (76–92%) |
| Rotom-Fan | Survives Draco (80–94%) and Overdrive (50–61%) |

## 6. Key calcs

### ZhuZi → us (do we survive?)

| Hit (set) | Target | Damage | Result |
|---|---|---|---|
| Krookodile Rock Slide (ladder Adamant Life Orb), spread | Charizard | 131–157% | **Dies** (Wide Guard!) |
| Krookodile Rock Slide (Scarf Jolly), spread | Charizard | 91–108% | 44% OHKO |
| Krookodile Stone Edge (Adamant Life Orb) | Charizard | 235–278% | Dies (not Wide-Guardable) |
| Toxtricity Overdrive (ladder Life Orb Modest), spread | Charizard / Rotom-Fan / Kangaskhan / Aegislash Shield | 95–113% (69%) / 50–61% / 50–59% / 40–47% | Charizard is at risk |
| Toxtricity Boomburst, spread | Kangaskhan / Morpeko / Charizard | 57–68% / 115–136% (Sash) / 55–66% | Ghosts immune |
| Galarian Slowking Power Gem (ladder / worst) | Charizard | 86–101% (6%) / 128–154% | — |
| Mega Metagross Psychic Fangs | Charizard / Kangaskhan / Sinistcha / Rotom-Fan | 80–94% / 59–69% / 55–65% / 62–73% | Survive |
| Mega Metagross Stomping Tantrum | Aegislash Blade / Shield / Morpeko | 121–143% / 54–65% / 138–163% | Blade dies |
| Dragapult Draco Meteor (Life Orb) | Charizard / Kangaskhan / Rotom-Fan / Morpeko | 74–87% / 76–89% / 80–94% / 151–179% | — |
| Dragapult Shadow Ball (Life Orb) | Aegislash Blade / Shield / Sinistcha | 168–198% / 75–89% / 76–92% | Blade dies |
| Infernape Overheat (Sash Hasty), sun / no sun | Aegislash Shield | 129–152% / 86–102% | Our sun hurts us here |
| Infernape Overheat, sun | Sinistcha / Rotom-Fan | 133–158% / 86–101% | — |
| Krookodile High Horsepower (Adamant Life Orb) | Aegislash Shield / Kangaskhan | 95–114% (69%) / 61–72% | — |
| Umbreon / Oranguru Foul Play | Aegislash Blade | 188–223% / 126–149% | Dies (uses our Atk) |
| Rotom-Wash Hydro Pump, sun / no sun | Charizard | 42–49% / 84–99% | — |

### Us → ZhuZi (our KOs)

| Hit | Target | Damage | Result |
|---|---|---|---|
| Charizard Heat Wave (sun, spread) | Mega Metagross / Metagross / Toxtricity | 138–162% / 162–191% / 101–120% | **OHKO** |
| Charizard Heat Wave through Light Screen | Mega Metagross | 92–108% | 50% |
| Charizard Weather Ball (sun) | Krookodile Adamant / Impish | 127–150% / 85–100% | — |
| Charizard Solar Beam (sun) | Rotom-Wash / Krookodile Impish | 93–111% (63%) / 90–107% (44%) | — |
| Aegislash Poltergeist (Metal Coat) | Mega Metagross / Dragapult / Galarian Slowking / Infernape / Toxtricity | 99–119% / 167–198% / 125–147% / 107–127% / 96–114% | OHKO (Metagross 94%) |
| Aegislash Iron Head | Florges | 141–167% | OHKO |
| Aegislash Close Combat | Krookodile Adamant / Umbreon | 112–131% / 60–71% | — |
| Kangaskhan Last Resort (Life Orb Scrappy) | Infernape / Toxtricity / Florges | 135–160% / 122–144% / 101–120% | OHKO |
| Kangaskhan Last Resort | Krookodile Adamant / Rotom-Wash / Slowking-G / Oranguru | 96–114% (81%) / 80–95% / 78–93% / 58–69% | — |
| Morpeko Aura Wheel, Hangry (Dark) | Dragapult / Mega Metagross / Oranguru | 116–138% / 69–82% / 65–77% | — |
| Rotom-Fan Air Slash | Infernape | 107–127% | OHKO (Sash holds) |
| Stunfisk-Galar Stomping Tantrum (swap) | Toxtricity / Infernape | 183–217% / 101–121% | OHKO |

**Intimidate (Krookodile) at −1** (Kangaskhan is immune: Scrappy):
- Aegislash Poltergeist on Dragapult still OHKOs (113–132%).
- Aegislash Iron Head on Toxtricity: 28–33%.

**Speed:**

| Speed | Who |
|---|---|
| 194–213 | Dragapult |
| 178 | Mega Metagross |
| 176 | Infernape |
| **163** | **Morpeko** |
| **146** | **Charizard** |
| 144 | Krookodile Adamant (Jolly 158; Scarf faster than all of us) |
| 134 | Metagross base Scarf ×1.5 → 201 |
| 127 | Toxtricity (Timid 139) |
| 112 | Rotom-Wash |
| **110** | **Kangaskhan** |
| **106** | **Rotom-Fan** |
| 95 | Florges |
| **90** | **Sinistcha** |
| 85 | Umbreon |
| **72** | **Aegislash** = Oranguru 72 (Speed tie) |
| 45 | Slowking-G |

**Under Trick Room (his or ours):**
- His move first: Slowking-G 45, Oranguru / our Aegislash 72 (tie).
- Then Umbreon 85, Sinistcha 90, Florges 95, Rotom-Fan, Kangaskhan, Rotom-Wash, Toxtricity, Krookodile, Charizard.
- Mega Metagross / Infernape / Dragapult go last.

## 7. Deep guidance

### Tells
| See | Means | Do |
|---|---|---|
| Metagross Megas T1 (Tough Claws) | 178 Spe: faster than Morpeko | Heat Wave it (OHKO) or Poltergeist |
| Krookodile moves before Charizard (146) | **Choice Scarf** (42% of ladder sets), locked | Shield / Protect the target; Rock Slide Scarf does 91–108% to Charizard |
| Infernape Fake Outs T1 | Fake Out set, likely Sash | Aegislash is immune; double it or Air Slash + anything |
| Oranguru doesn't drop Taunt / sets TR through it | Mental Herb | Re-set our Trick Room (cancel), Fake Out its partner, focus Toxtricity |
| Slowking-G uses Chilly Reception (snow, switches out) | Our sun is gone; Blizzard possible | Switch Charizard out and back for Drought, or play non-Fire for 5 turns |
| Dragapult uses Will-O-Wisp on Kangaskhan / Aegislash | Burn halves our physical damage | Switch to special damage (Charizard / Rotom-Fan); Sinistcha's Hospitality heals on entry |
| Toxtricity Protects while Oranguru moves | Trick Room / Instruct setup | Hit Oranguru; next turn kill Toxtricity |

### Their combos and answers
| Combo | Into | Total | Answer |
|---|---|---|---|
| Oranguru Instruct + Toxtricity Overdrive (×2) | Charizard | 190–225% | Kill / Fake Out Toxtricity first; Aegislash Wide Guard blocks both |
| Overdrive + Krookodile Rock Slide | Charizard | 226–270% | Wide Guard (blocks both spreads) |
| Mega Metagross Psychic Fangs + Dragapult Draco | Kangaskhan | 134–158% | Protect isn't on Kangaskhan: Fake Out one of them |
| Krookodile High Horsepower + Overdrive | Aegislash Shield | 135–160% | Wide Guard blocks only Overdrive; switch Aegislash |
| Infernape Heat Wave (our sun) + High Horsepower | Aegislash Shield | 165–196% | Don't keep Aegislash beside sun vs Infernape |
| Draco + Overdrive | Rotom-Fan | 130–155% | Protect |
| Psychic Fangs + Shadow Ball | Sinistcha | 130–157% | Rage Powder only when Sinistcha can take one hit |

### Our combos
| Combo | Into | Total | Verdict |
|---|---|---|---|
| Heat Wave + Kangaskhan Last Resort | Krookodile Impish / Oranguru / Rotom-Wash / Slowking-G / Florges / Umbreon | 132–157% / 112–133% / 111–132% / 123–146% / 145–172% / 94–110% | KO (Umbreon maybe) |
| Weather Ball + Last Resort | Oranguru | 134–159% | KO |
| Heat Wave + Poltergeist | Dragapult | 212–250% | KO |
| Aegislash Close Combat + Last Resort | Umbreon | 112–132% | KO |

### Ways we lose
| How | Fix |
|---|---|
| Rock Slide / Stone Edge on Charizard T1 (Krookodile, or a surprise from Metagross / Infernape) | Lead Charizard only with Aegislash (Wide Guard) or Kangaskhan's Fake Out on the Rock user; keep Charizard in back vs Krookodile leads |
| Trick Room + Instruct Overdrive sweeps | Fake Out / KO Toxtricity first; our Sinistcha re-sets TR to cancel; Wide Guard |
| Foul Play on Blade Aegislash | Don't attack with Aegislash when Umbreon / Oranguru can target it; King's Shield |
| Snow removes our sun, then Rotom-Wash Hydro Pump hits Charizard at full | Re-enter Charizard; respect Hydro Pump 84–99% without sun |
| Will-O-Wisp cripples Kangaskhan / Aegislash | Fake Out Dragapult T1; special damage backup |

### Endgame and timing
- **Preserve Charizard for Mega Metagross + Toxtricity** (it's our only OHKO on both).
- **Preserve Aegislash for Dragapult / Slowking-G** (Poltergeist).
- Kangaskhan's Fake Out works only on its first turn out. Last Resort needs Fake Out to have been used first, so don't bring Kangaskhan in late without a Fake Out turn.
- **Trick Room:** 5 turns including the set turn. His Trick Room + our re-set = cancelled. Count down before attacking with Charizard (it's slow under TR).
- **Sun:** 5 turns from Charizard's Mega turn (Drought); Chilly Reception's snow replaces it.

**Cross-check:** 5 guide calcs were re-run through the app engine (`createCalc`) and match exactly:
- Heat Wave → Mega Metagross: 216–254.
- Krookodile Rock Slide → Charizard: 208–250.
- Overdrive → Charizard: 151–179.
- Umbreon Foul Play → Blade Aegislash: 314–372.
- Last Resort → Infernape: 204–242.

`lib/guides/5v3.mjs` passes the app's `validateGuide` with 0 problems, and isn't stale against the live rosters.

**Uncertainty:**
- ZhuZi's real sets are unknown (ladder vs worst case shown).
- Abilities verified in `data/mechanics.json`: Oranguru Inner Focus / Telepathy / Symbiosis; Slowking-G Curious Medicine / Own Tempo / Regenerator; Umbreon Inner Focus / Synchronize; Florges Flower Veil / Symbiosis; Toxtricity Plus / Punk Rock / Technician; Krookodile Anger Point / Intimidate / Moxie; Infernape Blaze / Iron Fist.
- Crits and accuracy aren't modelled (Stone Edge 80%, Power Gem 100%, Draco 90%, Hydro Pump 80%).

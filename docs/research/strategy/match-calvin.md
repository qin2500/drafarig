# Anthony vs Calvin: game plan

v1, 2026-10-16. League sheet re-read at 23:29 UTC (both 10s confirmed).

- **Calcs:** `docs/research/strategy/sp-assist/match_calvin.py`. Its formula reproduces the app's damage-engine test cases exactly.
- **Calvin's sets:** ladder usage (Smogon Reg M-C ≥1760, Sept), not his real sets. **ASSUMPTION:** we don't know his items or spreads.
- **Format:** Level 50, doubles, full HP, no crits.
- **Shorthand:** "Rap" = Mega Staraptor (Calvin's Staraptor after Mega Evolving), TW = Tailwind, TR = Trick Room.

---

## 0. The 5 things to remember
1. **Bring Charizard and Mega it (Y), not Kangaskhan.** Sun halves his Water, Heat Wave OHKOs Mamoswine and Tsareena even through Light Screen, and Weather Ball OHKOs Tsareena / Jolteon / Tauros.
2. **His Staraptor:** if it doesn't Mega on turn 1 and outspeeds Morpeko, it's the **Choice Scarf Final Gambit** set. Final Gambit does 192, which OHKOs Charizard, Rotom-Fan and Morpeko. **Ghosts are immune** (Aegislash, Sinistcha), so Protect or King's Shield the target.
3. **Mega Staraptor can't touch Aegislash** (Close Combat 0, Brave Bird only 25–29% on Shield form). It does OHKO Conkeldurr (Brave Bird 108–127%) and badly hurts Sinistcha.
4. **Volcarona is the biggest threat to our Ghosts. Kill it first.** Overheat (37% of sets) OHKOs Aegislash *even in Shield form*
   in our sun (129–152%) and Sinistcha (133–158%). Without sun it's still 86–102% / 89–106%. Quiver Dance makes it worse.
   Morpeko is faster: **Fake Out or Taunt it**, then Weather Ball (81–96%) + anything. Don't leave Sinistcha or Aegislash in front of it.
5. **Don't bring Pelipper.** Rain doubles his Swift Swim Basculegion-F's Speed and powers its Muddy Water (OHKOs Charizard in rain), and Jolteon OHKOs Pelipper.

## 1. Calvin's 10 → likely 6 and sets

Draft cost order: Staraptor 20, Grimmsnarl 17, Volcarona 15, Basculegion-F 13, Mamoswine 12, Tsareena 8, Empoleon 7, Jolteon 5, Tauros 2, Swalot 1.
**Likely 6 (ASSUMPTION):** the first six. Empoleon or Jolteon could replace Tsareena.

| Mon | Likely set (ladder) | Speed | Role |
|---|---|---|---|
| **Staraptor** | **Mega 94% (Pikalytics):** Close Combat / Brave Bird / Tailwind (69%) / Protect, Jolly ~32 Spe. **Or Scarf:** Final Gambit / Close Combat / U-turn. Intimidate on entry (before it Megas) | Mega 178; Scarf 225–250 | Win condition, Tailwind |
| **Grimmsnarl** | Prankster, Light Clay: Light Screen, Reflect, Parting Shot, Spirit Break. Careful/Sassy 32 HP | 72–80 | Screens |
| **Volcarona** | Flame Body; Rage Powder 57%, Quiver Dance 45%, Struggle Bug, Heat Wave / Overheat, Tailwind 36%. Mostly bulky (Bold 32/0/32) | 120–144 | Redirection + setup sweeper |
| **Basculegion-F** | Swift Swim, Life Orb: Shadow Ball / Muddy Water / Ice Beam / Protect. Modest 32 SpA / 32 Spe | 130 (143 Timid) | Special attacker; no rain on his side |
| **Mamoswine** | Oblivious; Sash / Life Orb / Scarf: Ice Shard, High Horsepower, Icicle Crash, Protect, EQ 41%, Rock Slide 18% | 132 / 145 | Answer to Charizard and Rotom |
| **Tsareena** | **Queenly Majesty (blocks our Fake Out and priority)**, Wide Lens: Triple Axel / Power Whip / Low Kick / HJK | 124–136 | Anti-Fake Out |
| Empoleon | Competitive; Hydro Pump / Flash Cannon / Ice Beam / Icy Wind | 80 | — |
| Jolteon | Volt Absorb, Sash / Life Orb; Thunderbolt / Volt Switch / Electroweb | **200** | Fastest; hits Charizard and Pelipper |
| Tauros, Swalot | No real data (Swalot: Clear Smog / Encore) | — | Unlikely |

**His likely leads:**
- Staraptor + Grimmsnarl (Tailwind + screens)
- Volcarona + Staraptor (Rage Powder + Tailwind)
- Grimmsnarl + Basculegion-F

**His win conditions:**
- Tailwind + screens, then Mega Staraptor Close Combat / Brave Bird sweeps.
- Volcarona Quiver Dance behind Rage Powder.
- Mamoswine Ice Shard / Icicle Crash cleaning up Charizard / Rotom.

## 2. Anthony's 6 and the Mega

**Bring: Charizard (Mega Y), Aegislash, Morpeko, Rotom-Fan, Sinistcha, Conkeldurr.**
- **Charizard:** sun nerfs his Water; Heat Wave smashes Mamoswine / Tsareena / Grimmsnarl / Staraptor.
- **Aegislash:** immune to Close Combat and Final Gambit. Iron Head (Metal Coat) OHKOs Grimmsnarl 108–129% and Mamoswine 123–145%. Poltergeist OHKOs Basculegion-F. Wide Guard blocks Heat Wave, Muddy Water, Rock Slide and EQ.
- **Morpeko:** Fake Out. Faster than everything except Staraptor and Jolteon. Aura Wheel OHKOs Basculegion-F and Scarf Staraptor. Taunt stops Quiver Dance. As a Dark type it's immune to Grimmsnarl's Prankster moves.
- **Rotom-Fan:** Thunderbolt does 80–96% to Mega Staraptor and 93–111% to Basculegion-F. Immune to EQ / High Horsepower.
- **Sinistcha + Conkeldurr:** the Trick Room mode against his Tailwind. Under TR, Conkeldurr (58) moves first. Conkeldurr's Drain Punch OHKOs Mamoswine, Empoleon and Tauros.

**Bench:** Pelipper (rain helps him, Jolteon OHKOs it), Kangaskhan (Charizard needs the Mega slot, and Tsareena blocks Fake Out), Stunfisk-Galar, Simipour.

**Mega:** Charizard Y. Kangaskhan's Fake Out is blocked by Tsareena, its Mega is weak into screens, and it doesn't fix Volcarona.

**Which 4 to bring (from his 6 at preview):**

| His 6 includes… | Bring | Lead |
|---|---|---|
| Staraptor + Grimmsnarl + Volcarona (HO) | Charizard, Morpeko, Aegislash, Rotom-Fan | Charizard + Morpeko |
| Mamoswine (anti-Charizard) | Charizard, Aegislash, Conkeldurr, Morpeko | Aegislash + Morpeko, Charizard in back |
| Both Volcarona and Staraptor with Tailwind (expect double Tailwind) | Sinistcha, Conkeldurr, Charizard, Aegislash | Sinistcha + Conkeldurr (TR) or Sinistcha + Charizard |
| Jolteon | Add Aegislash (Poltergeist / Close Combat OHKO it). Keep Charizard's HP up: Jolteon Thunderbolt does 76–91%, a Life Orb one OHKOs | — |

## 3. Leads and turn 1

| Our lead | vs Staraptor + Grimmsnarl | vs Volcarona + Staraptor | vs Grimmsnarl + Basculegion-F |
|---|---|---|---|
| **Charizard + Morpeko** (default) | Morpeko **Fake Out Grimmsnarl** (+3 beats his +1 Prankster screens). Charizard Megas + Heat Wave: Rap 65–77%, Grimmsnarl 57–67%. T2: Aura Wheel finishes Rap | Morpeko Fake Out Volcarona (stops Rage Powder / Quiver Dance); Charizard Heat Wave both (Volcarona 57–68%, Rap 65–77%). T2: Weather Ball Volcarona, or Taunt | Fake Out Grimmsnarl; Charizard **Solar Beam Basculegion-F** (OHKO 112–132% in sun, no charge) |
| **Aegislash + Morpeko** (vs Mamoswine) | Aegislash Iron Head Grimmsnarl (108–129%, or 72–86% after Intimidate / Reflect); Morpeko Fake Out Rap | — | Aegislash Poltergeist Basculegion-F (OHKO) + Fake Out Grimmsnarl |
| **Sinistcha + Conkeldurr** (TR) | Conkeldurr **Protect** (Brave Bird OHKOs it); Sinistcha Trick Room (Coba Berry keeps it alive vs Brave Bird) | Same; Sinistcha is Grass, so **it ignores Volcarona's Rage Powder** | TR; Conkeldurr Protect or Drain Punch Grimmsnarl (66–79%) |

**Rules:**
- **Tsareena on the field means no Fake Out or Mach Punch into its side** (Queenly Majesty).
- **Staraptor's Intimidate on entry drops Morpeko / Aegislash / Conkeldurr to −1.** Aegislash's Iron Head on Grimmsnarl then falls to 72–86%, and Morpeko's Aura Wheel on Rap to 54–65%.
- **Protect read:** Rap runs Protect 98% of the time. Turn 2 after a Heat Wave chip, double into it or spread again.

## 4. Key calcs

### Calvin → Anthony (do we survive?)

| Hit | Target (our set, §5) | Damage | Result |
|---|---|---|---|
| Mega Staraptor Brave Bird (32 Atk) | Charizard | 84–99% | **Survives** |
| Mega Staraptor Brave Bird | Sinistcha (Calm, Coba) | 57–68% | Survives |
| Mega Staraptor Brave Bird | Conkeldurr | 108–127% | **Dies** (88–106% if Rap has only 1 Atk SP) |
| Mega Staraptor Brave Bird / Close Combat | Aegislash Shield / Blade | 25–29% / 56–65%; CC 0 | Walls it |
| Mega Staraptor Close Combat | Morpeko | 246–290% | Dies (Sash saves it once) |
| Scarf Staraptor Final Gambit | Charizard / Rotom-Fan / Morpeko / Conkeldurr | 192 fixed | Dies / dies / dies / **survives (212 HP)**; **0 to Ghosts** |
| Volcarona Heat Wave +0, no sun / sun | Sinistcha (Calm) | 55–65% / ~83–98% | Our sun boosts *his* Fire |
| Volcarona Heat Wave +1, no sun | Sinistcha (Calm) | 82–98% | Barely survives |
| Volcarona Heat Wave +0 | Aegislash Blade / Shield | 122–144% / 52–62% | Blade dies: **King's Shield first** |
| **Volcarona Overheat** (bulky set), no sun / sun | Aegislash Shield | 86–102% / **129–152%** | Dies in sun |
| **Volcarona Overheat**, no sun / sun | Sinistcha (Calm, Coba) | 89–106% / **133–158%** | Dies in sun |
| Basculegion-F Shadow Ball (Life Orb) | Aegislash Blade / Shield | 164–193% / 75–89% | Blade dies |
| Basculegion-F Shadow Ball | Sinistcha (Calm, Coba) | 76–92% | Survives |
| Basculegion-F Muddy Water in sun / rain | Charizard | 36–44% / 113–134% | Sun matters |
| Basculegion-F Ice Beam | Rotom-Fan | 75–88% | Survives |
| Mamoswine Icicle Crash (Adamant) | Rotom-Fan / Morpeko | 97–115% (75% OHKO) / 91–107% | Keep Rotom away from Mamoswine |
| Mamoswine Rock Slide (18% of sets, spread) | Charizard | 111–131% | Dies |
| Mamoswine High Horsepower | Aegislash Blade / Shield | 183–217% / 80–97% | Blade dies |
| Grimmsnarl Spirit Break | Morpeko / Conkeldurr | 113–135% / 49–59% | Morpeko dies without Sash |
| Tsareena Triple Axel (all 3 hits) | Rotom-Fan / Charizard | 80–96% / 51–61% | Survive |
| Jolteon Thunderbolt (no item / Life Orb) | Charizard | 76–91% / 98–118% | — |

### Anthony → Calvin (our KOs)

| Attacker | Hit | Target | Damage | Result |
|---|---|---|---|---|
| Charizard (sun) | Heat Wave (spread) | Mamoswine / Tsareena | 187–221% / 158–189% | **OHKO, even through Light Screen** |
| Charizard | Heat Wave (spread) | Rap / Grimmsnarl / Volcarona / Empoleon | 65–77% / 57–67% / 57–68% / 60–71% | Chip |
| Charizard | Heat Wave, lone target | Rap | 87–103% | 25% OHKO |
| Charizard | Weather Ball | Rap 29-HP spread / Rap 2-HP spread | 91–108% / 110–130% | 50% / 100% OHKO |
| Charizard | Weather Ball | Volcarona (bulky) / Grimmsnarl / Jolteon / Tsareena | 81–96% / 81–96% / OHKO / OHKO | — |
| Charizard | Solar Beam (sun) | Basculegion-F | 112–132% | **OHKO** |
| Rotom-Fan (Modest 32) | Thunderbolt | Rap / Basculegion-F / Empoleon | 80–96% / 93–111% / 75–89% | Finishes after any chip |
| Rotom-Fan | Air Slash | Tsareena / Volcarona | 85–101% / 60–72% | — |
| Aegislash (Metal Coat) | Iron Head | Grimmsnarl / Mamoswine | 108–129% / 123–145% | **OHKO** (72–86% / 81–97% at −1) |
| Aegislash | Poltergeist | Basculegion-F / Jolteon | 157–185% / OHKO | Fails if the target has no item |
| Aegislash | Close Combat | Empoleon / Tauros / Jolteon | OHKO | — |
| Morpeko | Aura Wheel | Basculegion-F / Scarf Staraptor | 109–129% / 106–126% | OHKO |
| Morpeko | Aura Wheel | Rap / Empoleon | 80–96% / 88–105% | — |
| Conkeldurr (Life Orb) | Drain Punch | Mamoswine / Empoleon / Jolteon / Tauros | OHKO (Mamoswine at −1 too) | — |
| Conkeldurr | Thunder Punch / Ice Punch | Rap | 83–98% | — |
| Conkeldurr | Thunder Punch | Basculegion-F | 112–132% | OHKO |

### Speed (our sets; Calvin at ladder spreads)

| Speed | Who | Note |
|---|---|---|
| 225+ | Scarf Staraptor | — |
| 200 | Jolteon | — |
| 178 | Mega Staraptor (Tauros assumed similar) | Faster than all of us without Tailwind |
| **163** | **Morpeko** | Outspeeds everything below |
| **146** | **Charizard (Modest 26 Spe)** | Beats Jolly Mamoswine 145, Modest Volcarona 144, Timid Basculegion 143 |
| 120–144 | Volcarona (+1 after Quiver Dance: 180–216) | — |
| 124–136 | Tsareena | — |
| 132 / 145 | Mamoswine | — |
| 130 / 143 | Basculegion-F | — |
| 106 | Rotom-Fan | — |
| 90 | Sinistcha | — |
| 72–80 | Grimmsnarl, Empoleon | — |
| 72 | Aegislash (Brave) | — |
| 58 | Conkeldurr | — |

- **His Tailwind** (Staraptor 69%, Volcarona 36%) doubles his side, so everything of his outspeeds us. Answer: Trick Room, or Protect / King's Shield to stall its 4 turns.
- **Under Trick Room:** Conkeldurr 58 → Aegislash 72 → Grimmsnarl / Empoleon 72–80 → Sinistcha 90 → Rotom-Fan → … → Rap 178 last.

## 5. Sets (paste into Showdown; Champions SP go in the EVs line)

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

Morpeko @ Focus Sash
Ability: Hunger Switch
Level: 50
EVs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Fake Out
- Aura Wheel
- Taunt
- Protect

Aegislash @ Metal Coat
Ability: Stance Change
Level: 50
EVs: 32 HP / 32 Atk / 2 Def
Brave Nature
- Iron Head
- Poltergeist
- King's Shield
- Wide Guard

Rotom-Fan @ Sitrus Berry
Ability: Levitate
Level: 50
EVs: 32 HP / 32 SpA / 2 SpD
Modest Nature
- Thunderbolt
- Air Slash
- Will-O-Wisp
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

Conkeldurr @ Life Orb
Ability: Iron Fist
Level: 50
EVs: 32 HP / 32 Atk / 2 SpD
Brave Nature
- Drain Punch
- Mach Punch
- Thunder Punch
- Protect
```

What each spread hits:

| Mon | Benchmarks met |
|---|---|
| Charizard | 146 Speed beats Mamoswine 145 / Volcarona 144 / Basculegion 143. Survives Rap Brave Bird (84–99%) and Jolteon Thunderbolt (76–91%). Modest makes Weather Ball OHKO the 2-HP Rap |
| Morpeko | 163 beats everything but Staraptor and Jolteon. Sash survives one Close Combat / Icicle Crash / Spirit Break |
| Aegislash | Brave 72: under TR moves before 80-Speed Grimmsnarl / Empoleon. Metal Coat Iron Head guarantees OHKO on Grimmsnarl / Mamoswine at +0 |
| Rotom-Fan | 32 HP: Basculegion Ice Beam 75–88%, Triple Axel 80–96%. Thunderbolt finishes Rap after any chip. Will-O-Wisp cripples Rap / Mamoswine / Tsareena |
| Sinistcha | Calm + Coba: survives Rap Brave Bird (57–68%), Basculegion Shadow Ball (76–92%) and +1 Volcarona Heat Wave without sun (82–98%) |
| Conkeldurr | Max HP: survives Final Gambit (192 < 212). Drain Punch OHKOs Mamoswine even at −1 |

**Item clause:** six different items. Showdown export uses Level 50; Champions SP = the EV numbers.

## 6. Threats → answers

| Threat | Answer |
|---|---|
| Mega Staraptor + Tailwind | Aegislash walls it. Charizard Heat Wave + Thunderbolt / Aura Wheel KOs it. TR flips the Tailwind. Will-O-Wisp |
| Scarf Final Gambit Staraptor | Protect / King's Shield the target; keep Ghosts in front; Conkeldurr survives it |
| Grimmsnarl screens | Fake Out it on turn 1. Aegislash Iron Head OHKO. Don't waste spread moves into Light Screen; switch target to Mamoswine / Tsareena (still OHKO) |
| Volcarona Quiver Dance / Rage Powder | Morpeko Taunt (faster); Weather Ball 81–96%; Heat Wave spread ignores Rage Powder; Sinistcha ignores Rage Powder |
| Basculegion-F | Solar Beam (sun), Poltergeist, Aura Wheel, Thunderbolt. Never set rain |
| Mamoswine | Charizard Heat Wave OHKO; Aegislash Iron Head; Conkeldurr Drain Punch. Keep Rotom-Fan away |
| Tsareena | Charizard Heat Wave OHKO (also through Light Screen); no Fake Out into it |

**Cross-check:** these numbers agree with the Developer's engine sheet `match-calvin-calcs.md` where the sets match:
- Mamoswine Rock Slide on Charizard: 111–131% here vs 113–134% there (different Charizard spread).
- Brave Bird on Conkeldurr: 31–37% OHKO from a 1-Atk Rap here, 5–6/16 there.
- Volcarona Overheat OHKOs Sinistcha and Aegislash in both.

That sheet uses usage-default sets for Anthony. This plan uses the match sets in §5.

**Uncertainty:** Calvin's real sets and items are unknown (ladder defaults). Tauros and Swalot have no data. Crits, accuracy (Rock Slide 90, Air Slash 95) and Wide Lens aren't modelled.

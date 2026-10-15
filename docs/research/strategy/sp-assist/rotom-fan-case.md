# Rotom-Fan: is Nasty Plot worth it, and what does it buy? (reference case)

Drafarig VGC Strategy, 2026-10-15. Anthony's question: *"How many SP would I need to OHKO common Mega Staraptor sets, to judge
whether Nasty Plot is worth it, since Nasty Plot might let me run a bulkier Rotom-Fan?"* This is the worked answer. It is also the
reference case the per-mon dashboard must reproduce (§9).

Markers: **VERIFIED** = checked in the Showdown source or the league sheet. **DATA** = Smogon usage statistics (a ladder sample,
not this league). **ASSUMPTION** = a modelling choice. **CREATOR CLAIM** = a guide's opinion.

---

## 0. Short answer

1. **At +0, Rotom-Fan needs an item to OHKO Mega Staraptor.** Modest 32 SpA with no boosting item OHKOs only 27% of the
   Mega Staraptor field (152–182 = 80–96% against the most common spread). With Life Orb, 20 SpA (Modest) OHKOs ≥ 94% of the field,
   and 23 SpA guarantees it against the most common spread. Magnet needs Modest 32 SpA for 94%. Timid never reaches 94% at +0.
2. **One Contrary Close Combat removes every +0 OHKO.** Mega Staraptor (178 Speed) always moves before Rotom-Fan (151 at most), and
   each Close Combat gives it +1 SpD. At SpD +1 no +0 build OHKOs (Life Orb Modest 32: 133–159, 3% of the field).
3. **At +2 (after Nasty Plot) the KO is cheap.** With no item: Modest 0 SpA OHKOs ≥ 94% and 8 SpA guarantees it against the
   whole field. Even after one Close Combat, 16 SpA (Modest) gives 94%. With Life Orb or Magnet, 0 SpA is enough against SpD +0 and +1.
4. **The bulk Anthony wants mostly comes from skipping Speed, not from Nasty Plot.** Across 394 common league hits, moving
   32 SP from Speed to HP (keeping 32 SpA) cuts expected OHKOs from 16.0 to 4.0. Nasty Plot's freed SpA (16–24 SP) cuts them further,
   to 2.1–2.5. The hits that change are Kleavor's Stone Axe (Hex), Mamoswine's Icicle Crash (Calvin), Mega Starmie's Ice Spinner (Data)
   and Drampa's Draco Meteor (Hex).
5. **This league punishes Nasty Plot hard.** Calvin, who owns the league's Staraptor, has Volcarona's Rage Powder, Grimmsnarl's Light
   Screen and Spirit Break, and Swalot's Clear Smog and Encore. Prankster Encore (Whimsicott, Sableye, Mega Banette), Unaware Skeledirge
   (Taro) and Imposter Ditto (Hex) are elsewhere. **Verdict (with uncertainty):** Nasty Plot is a *Calvin-specific* tool at best.
   The robust build is Modest 32 SpA / 32 HP with Life Orb, using Pelipper's Tailwind or Helping Hand for the Staraptor KO.

---

## 1. Verified facts about the two Pokémon

| Fact | Value | Source |
|---|---|---|
| Rotom-Fan is legal in Champions Reg M-C | tier "RU", not `isNonstandard` | Showdown `data/mods/champions/formats-data.ts` L2394–2396 (master 3a766f2, 2026-10-13) |
| Rotom-Fan stats / types / ability | 50 / 65 / 107 / **105** / 107 / **86**; Electric/Flying; Levitate | `data/pokedex.ts` L8796–8810; app `data/mechanics.json` (cloud-checkpoint) |
| Rotom-Fan learnset (Champions) | **Nasty Plot**, Thunderbolt, Thunder, Discharge, Volt Switch, Rising Voltage, Air Slash (no Hurricane), Shadow Ball, Dark Pulse, Hex, Hyper Voice, Electroweb, Will-O-Wisp, Light Screen, Reflect, Trick, Protect, Helping Hand… | `data/mods/champions/learnsets.ts` L7721+; same 43 moves in `mechanics.json` learnsets |
| Mega Staraptor | **Fighting/Flying**, **Contrary**, 85 / 140 / 100 / 60 / **90** / **110**, Staraptite | `data/pokedex.ts` L7438–7450; Champions `formats-data.ts` L2156 (tier UU) |
| Matchups | Electric and Flying are both 2x on Mega Staraptor. Its Brave Bird and Close Combat are both resisted by Rotom-Fan | type chart in `data/dex.json` |
| Contrary + Close Combat | each Close Combat gives Mega Staraptor **+1 Def and +1 SpD** | `data/abilities.ts` contrary L678 |
| Champions stats | HP = base + SP + 75; others = base + SP + 20, then nature ×1.1/×0.9 truncated; 32 SP per stat, 66 total | `data/mods/champions/scripts.ts` L10–38; app `lib/calc/stats.mjs` L11–27 |
| Damage formula | base = ⌊⌊⌊22·BP·A/D⌋/50⌋ + 2; then spread 0.75, weather, crit, random 85–100%, STAB, type, burn, final modifiers (Life Orb 5324/4096, screens 2732/4096 in doubles) | `sim/battle-actions.ts` L1709; `data/mods/champions/scripts.ts` L196–311; `sim/battle.ts` L2336–2347 (modify), L2395–2398 (random) |
| Champions Encore | if the target hasn't moved yet, its action this turn **changes** to the encored move unless it holds Mental Herb | `data/mods/champions/moves.ts` L309–338 |

My calculator (`spcalc.py`) reproduces all 6 hand-worked goldens in the app's `test/calc-engine.test.mjs` L33–46 exactly. Those
cover doubles spread, an Intimidate stage, a crit, Aerilate and sun-boosted spread.

## 2. What "common Mega Staraptor sets" are (DATA)

Smogon chaos stats, `gen9championsvgc2026regmc`, ladder ≥ 1760, September 2026 (1,631,943 battles), from
`https://www.smogon.com/stats/2026-09/chaos/gen9championsvgc2026regmc-1760.json`. This is the app's own `/api/usage` source.
An extract is saved in `usage-regmc-2026-09-league.json`.

- **Staraptor-Mega**: 6.26% usage. Contrary 100%, Staraptite 100%. Close Combat 100%, Protect 98%, Brave Bird 93%, **Tailwind 69%**,
  Roost 30%, Dual Wingbeat 7%. Teammates: Gholdengo 54%, Rillaboom 51%, Mega Raichu-Y 46%.
- **Spreads** (159 distinct): the top one is Jolly 29/1/0/0/4/32 (11.8%), then Jolly 2/32/0/0/0/32 (8.1%), Jolly 15/19/0/0/0/32 (7.0%),
  Jolly 25/9/0/0/0/32 (5.6%) and Jolly 32/2/0/0/0/32 (5.3%). HP SP clusters at 32 (17%), 29 (16%), 15 (10%) and 2 (10%). Only **5%** put more
  than 4 SP into SpD. Natures: Jolly, Adamant, Careful, Hardy. HP therefore ranges from 160 to 192 and SpD is usually 110–114.
- **Base Staraptor** (0.97%) is a different threat: Choice Scarf 99%, **Final Gambit 99%**, Intimidate 98%, mostly 32 HP.
- Pikalytics (Reg M-C page, read 2026-10-15) agrees on the shape: Staraptite 94%, Close Combat 57%, Brave Bird 28%, Tailwind 14%. It
  shows no spreads.
- **League:** Calvin drafted Staraptor (live sheet, 2026-10-15 04:02 UTC). Under the pool-only scenario A (cores.md §1) you don't know
  whether he runs Mega or Scarf Final Gambit.

"Field" below means all 159 spreads weighted by usage. "Modal" means Jolly 29/1/0/0/4/32 (HP 189, SpD 114).

## 3. Assumptions for every number below

Level 50, doubles, Thunderbolt (90 BP, single target), no crit, no weather or terrain unless stated, both at full HP, no screens
unless stated. Rotom-Fan has **Levitate, so it is ungrounded and gets no Electric Terrain boost**. Intimidate doesn't matter here
(special attacks). Spread moves take 0.75x (Discharge only). Life Orb recoil (10% per attack) is ignored in damage numbers but noted in
§7. Dynamic effects such as Roost healing, Sitrus Berry, and Contrary boosts beyond the listed stages are not modelled.

## 4. SpA needed to OHKO Mega Staraptor (Thunderbolt)

Least SpA SP for each KO level against the weighted field ("−" = not reachable even at 32 SP; the bracket gives the odds at 32 SP).

| Item | Nature | Rotom stage | Staraptor SpD | 100% | ≥ 94% (15/16) | ≥ 50% |
|---|---|---|---|---|---|---|
| none | Modest | +0 | +0 | − (27%) | − (27%) | − (27%) |
| none | Modest | +2 | +0 | **8** | **0** | 0 |
| none | Modest | +2 | +1 (one CC) | − (99%) | **16** | 0 |
| none | Modest | +2 | +2 (two CC) | − (27%) | − | − |
| none | Timid / Calm (neutral SpA) | +2 | +0 | 21 | 0 | 0 |
| none | Timid / Calm | +2 | +1 | − (96%) | 30 | 12 |
| Life Orb | Modest | +0 | +0 | − (99%) | **20** (modal guaranteed at 23) | 2 |
| Life Orb | Modest | +0 | +1 | − (3%) | − | − |
| Life Orb | Modest | +2 | +1 / +2 | 29 / not computed | **0 / 20** | 0 / 2 |
| Life Orb | Timid | +0 | +0 | − (92%) | − | 14 |
| Magnet | Modest | +0 | +0 | − (94%) | 32 | 14 |
| Magnet | Timid | +0 | +0 | − (66%) | − | 27 |
| Magnet | Modest | +2 | +1 | − (100%) | 0 | 0 |
| Expert Belt | Modest | +0 | +0 | − (94%) | − (94%) | 14 |

Damage ranges against the modal spread (HP 189):

| Build | vs Staraptor SpD +0 | vs SpD +1 (after one CC) |
|---|---|---|
| Modest 32 SpA, no item, +0 | 152–182 (80.4–96.3%), 0/16 | 102–122 (54–65%) |
| Modest 32 SpA, Life Orb, +0 | 198–237 (104.8–125.4%), 16/16 | 133–159 (70.4–84.1%), 0/16 |
| Modest 16 SpA, no item, +0 | 138–164 (73.0–86.8%), 0/16 | — |
| Modest 16 SpA, no item, **+2** | 276–326 (146–172.5%), 16/16 | 186–218 (98.4–115.3%), 13/16 |
| Modest 16 SpA, +2, into Light Screen | 184–217 (97.4–114.8%), 13/16 | — |
| Modest 16 SpA, +2 then Spirit Break (net +1) | 206–246 (109–130%), 16/16 | — |
| Modest 32 SpA, Thunder in rain (Pelipper) | 188–224 (99.5–118.5%), 15/16 (97% of field) | — |
| Modest 32 SpA + Helping Hand (Pelipper) | 230–272 (121.7–143.9%), 16/16 (99.7% of field) | — |

**2HKO at +0:** Modest needs 5 SpA (Timid 17) to guarantee two Thunderbolts against the SpD +0 field. Against SpD +1, Modest 32 gets 99.4%.
Against SpD +2, Modest 32 gets 27%. Roost (30% of sets) undoes 2HKOs, so this line is weak.

**Base (Scarf Final Gambit) Staraptor** is much easier: Modest 16 SpA with no item, or 0 SpA with Magnet, OHKOs 100% at +0.

## 5. Speed decides when the +0 window exists

Speeds (Champions formula): Rotom-Fan is 106 (Modest, 0 Spe), 138 (Modest, 32), or 151 (Timid, 32). Mega Staraptor's spreads are all
Jolly or Adamant with 32 Spe, giving **178**. Scarf base Staraptor is 250. **Rotom-Fan never outspeeds Mega Staraptor without
Tailwind**, so if Staraptor clicks Close Combat on turn N, Rotom's Thunderbolt that turn hits SpD +1. Under Pelipper's Tailwind,
even a 0-Speed Modest Rotom-Fan reaches **212 > 178** (but Staraptor runs Tailwind 69% of the time, so this can mirror). So 32 Speed
SP buys Rotom-Fan nothing against Staraptor. Speed matters only against base 80–95 mons, such as Calvin's Mamoswine (common 100/132/145).

## 6. What the freed SP buys (bulk), against every common league hit

Method: every damaging move used by ≥ 15% of a drafted opponent form's sets (394 hits, from all 9 opponents with usage data). Each is
weighted over that form's top-3 usage spreads with its top item and ability. For 2–5 hit moves I use the 35/35/15/15 hit-count
distribution (`sim/battle-actions.ts` L861–867). For each Nasty Plot build, the HP/Def/SpD split was chosen by search to minimise
expected OHKOs (`rotom_bulk.py`).

| Build | Expected OHKOs (sum of odds) | Hits that OHKO ≥ 50% |
|---|---|---|
| O1 Modest 32 SpA / 32 Spe / 2 HP (no Nasty Plot) | 16.0 | 16 |
| **O2 Modest 32 SpA / 32 HP / 2 SpD** (no Nasty Plot, speed from Tailwind) | **4.0** | 3 |
| N Modest 16 SpA / 32 HP / 14 Def / 4 SpD (Nasty Plot) | 2.5 | 2 |
| N Modest 8 SpA / 32 HP / 22 Def / 4 SpD (Nasty Plot) | 2.1 | 1 |
| N Calm 21 SpA / 32 HP / 12 Def / 1 SpD | 2.4 | 2 |

Hits whose OHKO odds change by ≥ 25 points between O2 and the Nasty Plot builds (O1 / O2 / N16 / N8):

| Opponent | Hit | O1 | O2 | N Modest 16 | N Modest 8 |
|---|---|---|---|---|---|
| Hex | Kleavor Stone Axe (Sharpness, Rock) | 100% | 100% | 75% | 46% |
| Calvin | Mamoswine Icicle Crash | 100% | 50% | 13% | 0% |
| Data | Mega Starmie Ice Spinner (Huge Power) | 91% | 46% | 0% | 0% |
| Hex | Drampa Draco Meteor | 100% | 49% | 45% | 45% |
| 17 | Dragonite Scale Shot (2–5 hits) | 28% | 15% | 0% | 0% |

What no SP fixes: **Final Gambit**. Scarf Staraptor deals 192 fixed damage; Rotom-Fan's maximum HP is 157. Lucario Final Gambit (Ning)
OHKOs 22% of the time even at 32 HP. Against Mega Staraptor's own hits, 32-HP Rotom-Fan takes Brave Bird / Close Combat 51–60 (32–38%),
so Staraptor is not the bulk problem.

## 7. League-specific counterplay to Nasty Plot (from usage data, ≥ 10% of the form's sets)

- **Calvin** (the Staraptor owner): Volcarona's Rage Powder (57%) redirects Thunderbolt, because Rotom-Fan isn't Grass-type.
  Grimmsnarl has Light Screen 97%, Spirit Break 84% (−1 SpA) and Parting Shot 92%. Swalot has Clear Smog (27%) and Encore (20%).
  Jolteon has Volt Absorb.
- **Encore everywhere:** Whimsicott 76% and Sableye 46% (Prankster, DingDing), Mega Banette 33% (Prankster, Hex), Raichu 62%
  (Data), Tinkaton 43% (Taro), Ninetales-Alola 39% (Ning). Champions Encore replaces Rotom's action that turn unless it holds
  Mental Herb (VERIFIED §1).
- **Boost-ignoring or boost-stealing:** Skeledirge's Unaware (Taro) ignores +2. Ditto's Imposter (Hex) copies Rotom's +2.
- **Electric absorbers:** Raichu and Pikachu Lightning Rod (Data), Jolteon Volt Absorb (Calvin). Air Slash (75 BP) is the fallback,
  at 128–152 (68–80%) with Modest 32 against the modal spread.
- Protect (98% of Mega Staraptor sets) and Roost (30%) also waste the boosted turn.

## 8. The trade-off

| | No Nasty Plot (O2: Modest 32 SpA / 32 HP, Life Orb) | Nasty Plot (Modest 16 SpA / 32 HP / 14 Def / 4 SpD, Sitrus or Mental Herb) |
|---|---|---|
| OHKO on Mega Staraptor | 94–99% of the field **only before its first Close Combat** (needs Tailwind, or Staraptor not clicking CC) | 100% at +2 vs SpD +0; 94% vs SpD +1; not vs SpD +2 |
| Turns | Immediate | One setup turn into the faster Staraptor's side, while Rage Powder, Encore, Fake Out and Spirit Break are live |
| Bulk vs league | 4.0 expected OHKOs (Life Orb recoil −10% per attack makes it worse over a game) | 2.5 |
| Robust to scenario A (opponent knows your pool) | Yes: nothing to play around except Protect | No: they can bring Encore, Clear Smog, Unaware or Imposter for the week |

**Judgement (CREATOR CLAIM of mine, not a calc):** Against Calvin specifically, Nasty Plot is a reasonable tech because Mega Staraptor
can't really hurt Rotom-Fan (32–38%). However, Calvin's own roster carries four separate anti-boost tools, so the setup turn is unsafe
with those partners on the field. League-wide, the cheaper and more reliable route to "a bulkier Rotom-Fan" is to **drop Speed and keep
32 SpA plus an item**. Then use **Pelipper's Helping Hand (99.7%) or Tailwind** for the Staraptor KO instead of a setup turn.

**Uncertainty:** usage data is the Smogon ladder ≥ 1760, not Calvin's real set. His Staraptor may be the Scarf Final Gambit set, which
makes Rotom-Fan's bulk irrelevant. Item clause: Life Orb may be taken by another of Anthony's sets. The bulk model ignores Intimidate
from Anthony's side, Sitrus, Protect and positioning, and counts every hit equally regardless of how often it's clicked.

## 9. What the dashboard must reproduce (acceptance vectors)

From `spcalc.py` / `rotom_case.py`:
1. `stat(rotomfan, spa, 32, Modest) = 172`. Mega Staraptor 0 HP / 0 SpD Jolly: HP 160, SpD 110.
2. Thunderbolt, neutral 32 SpA Rotom-Fan into 0/0 Jolly Mega Staraptor: rolls 146 … 174 (min/max).
3. Modest 32 SpA Life Orb +0 into Jolly 29/1/0/0/4/32: 198–237, 16/16 KO. The same at SpD +1: 133–159, 0/16.
4. Modest 16 SpA, +2 into the modal spread at SpD +1: 186–218, 13/16.
5. KO search ("What would it take?", `lib/calc/threshold.mjs` `koSearch` L152): Modest, no item, +2 → 15/16 level reached at 0 SpA
   against the modal spread. Life Orb +0 → 23 SpA for "every roll".
6. Final Gambit (Scarf Staraptor 32 HP) = 192, more than Rotom-Fan's max HP of 157: no survive option exists.

Reproduce: `git show cloud-checkpoint:data/mechanics.json > /tmp/sp/mech.json`, then in this folder run `python3 spcalc.py` (self-checks),
`python3 rotom_case.py`, `python3 rotom_bulk.py`.

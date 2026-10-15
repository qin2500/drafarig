# Benchmark-driven Stat Points: the method, translated to Champions

Drafarig VGC Strategy, 2026-10-15. This is the research basis for the per-mon SP-assist dashboard: how strong VGC players choose
spreads, what changes with Champions Stat Points (32 per stat / 66 total), which benchmarks the dashboard must compute, and how it
picks targets.

Markers: **VERIFIED** (Showdown source / maths), **CREATOR CLAIM** (a named player's guide), **ASSUMPTION** (my modelling choice).

---

## 1. How strong players build spreads (sources)

| Claim | Who / where | Status |
|---|---|---|
| Decide Speed first, then the attacking stat, then put the rest into bulk. "If there's a popular species … around your Pokémon's Speed that can KO it, and your Pokémon can KO back, you probably want to outspeed it." | Aaron Traylor, *How To Make Simple EV Spreads*, vgcguide.com/eving-1 | CREATOR CLAIM |
| Start from benchmarks you are "absolutely not willing to compromise on", then optimise Speed, then distribute the rest by calcs. "EVs in Pokémon have an opportunity cost." Example: a Raichu at 168 Speed instead of max 178, because Fake Out made the extra Speed worth less. Intimidate-adjusted calcs are part of the process. | Wolfe Glick (2016 World Champion), *How To Make Complex EV Spreads*, vgcguide.com/eving-3 | CREATOR CLAIM |
| Put the nature on the stat that is highest after investment. | Glick, ibid. | VERIFIED as maths: the ×1.1 is worth most on the largest stat (§2) |
| Speed creep: tune 1–2 points past a *common* value, not the maximum. A 2025 World Champion's Lunala ran 125 Speed to beat max-Speed Incineroar "by two points" and other Lunala at 124. A Worlds semifinalist used 189 over 188 because 188 "would have been a common Speed". | Victory Road team reports: Giovanni Cischke (2026-08-27, SV format); Federico Camporesi (2023-08-26) | CREATOR CLAIM (spreads are real tournament spreads) |
| Each investment should "pay for a specific outcome": a speed tier, a survival roll, an OHKO. If you can't name it, it doesn't belong there. | pokekipe.com teambuilding guide (search summary; page body not retrievable) | CREATOR CLAIM |
| Trick Room attackers run minimum Speed (0 investment and a −Speed nature). Precise speed benchmarks free SP for bulk. | pokestats.cc VGC EV guide; the Cischke report's Ursaluna uses "minimum Speed" | CREATOR CLAIM |
| "Jump points" (level-50 EVs every 8 after the first 4) | Traylor, Glick; ZemTennar video (description only) | **Does not apply in Champions** (VERIFIED §2) |

## 2. What changes with Champions Stat Points (VERIFIED)

From `data/mods/champions/scripts.ts` L10–38 (Showdown master 3a766f2) and the app's `lib/calc/stats.mjs` L22–27:
`HP = base + SP + 75`, `other = ⌊(base + SP + 20) × nature⌋`, 0–32 SP per stat, 66 total.

1. **1 SP = exactly +1 stat point.** There are no wasted EVs and no "jump points". Every SP counts, so a benchmark is crossed at
   one exact SP value. The dashboard can present spreads as plain integers.
2. **66 = 32 + 32 + 2.** Maxing two stats leaves 2 SP. The SV "252/252/4" maps to "32/32/2" (several guides).
3. **Nature value** = 10% of (base + SP + 20), truncated. It is worth most on the largest stat. Mega Charizard Y gains 21 SpA from
   Modest at 32 SpA (159 + 52 = 211 → 232), but only 15 Speed from Timid (152 → 167). The raw points favour Modest, but whether those
   15 Speed cross a benchmark decides it (benchmarks-league.md §2).
4. **HP vs a defence.** Damage taken as a fraction of HP scales with 1 / (HP × Def) to first order. With S points to split, the
   product (b_h + 75 + h) × (b_d + 20 + d) is maximised when the two factors are about equal. So an SP goes to whichever of HP or the
   relevant defence is *smaller*. Traylor's "you get the most value … the lower a stat is" is the same rule. HP also counts for both
   physical and special hits, so when both kinds of hit matter, HP is the default dump. Integer rolls make the real optimum lumpy,
   which is why the dashboard should search rather than apply the rule (`threshold.mjs` `surviveSearch` L92 already does).
5. **Speed is cheap to reason about.** The Speed formula has no randomness, so outspeed answers are exact (`stats.mjs` `outspeedSP` L126).

## 3. Benchmark types the dashboard must compute

Each benchmark is "the least SP (and nature) on stat X such that outcome Y holds against target Z under conditions C". Levels follow
`lib/calc/threshold.mjs`: KO at **every roll / ≥ 15/16 / ≥ 50%** (L180), survive at **0 / ≤ 1/16 / ≤ 50%** KO odds (L132).

| # | Type | Question | Inputs that must be toggles |
|---|---|---|---|
| B1 | **Outspeed** | Least Speed SP to move first vs the target's common Speeds; ceiling SP to stay slower under Trick Room | Tailwind (×2), Trick Room, Choice Scarf (×1.5, on either side), paralysis, Icy Wind / Electroweb (−1), own +1 (Dragon Dance, Speed Boost), Mega Speed (the new Speed applies from the Mega turn) |
| B2 | **Speed creep** | Share of the target's *usage-weighted Speed distribution* beaten / tied at each SP (not just its max). Show the next "cliff" (a common value one point away) | Same as B1. Ties shown explicitly (50/50 coin flip) |
| B3 | **Survive** | Least HP + Def/SpD (and nature) so a named hit no longer KOs (OHKO and 2HKO; optional crit) | Intimidate on the attacker (−1), screens (2732/4096 in doubles), weather, spread 0.75, Helping Hand, attacker item and ability, Sitrus (2HKO), Multiscale / Disguise |
| B4 | **KO** | Least Atk/SpA (and nature) for OHKO / 2HKO on a named target spread | Own stage **+0 / +1 / +2** (setup), target's boosts (Contrary Close Combat +1 SpD, Defiant, Unaware), Intimidate on self (−1 for physical), weather, terrain (grounded only), Helping Hand, screens, spread 0.75, item (Life Orb 5324/4096, type items 4915/4096 on BP, Expert Belt) |
| B5 | **Setup trade-off** | For a setup move: SP needed at +0 minus SP needed at +2 = SP freed; then re-run B3 with the freed SP to show what bulk it buys | Same as B3 + B4 (the Rotom-Fan case) |
| B6 | **Dead SP ("dump") check** | SP that cross no benchmark in the current target list. Suggest moving them to HP (or the smaller defence) and show what that crosses | — |
| B7 | **Field odds** | For each benchmark, the share of the target's usage spreads it holds against (e.g. "OHKOs 94% of Mega Staraptor sets") | The distribution source and its date |

Notes from the reference case (rotom-fan-case.md): B4 must include the **target's** stage, because Contrary turned a 99% OHKO into 3%.
B1 must include "who moves first in practice" (Mega Staraptor 178 vs Rotom-Fan ≤ 151), because the order decides which stage applies.

## 4. Picking relevant targets

Order (ASSUMPTION, matching the league's prep model in `cores.md` §1):
1. **This week's opponent's drafted 10**, including every Mega form of a drafted species (one Mega per battle, but each is possible).
2. **The other league opponents' drafted mons** (the "league" view).
3. **Meta usage** (Smogon `gen9championsvgc2026regmc` chaos, ≥ 1760) for anything not drafted, only when the user asks for it.

Within a target, the **hits** that count are moves used by ≥ 15% of that form's sets (ASSUMPTION, the same cut as `league_calc.py`).
The **spreads** are the usage distribution. Show "top-3 weighted" by default and "full distribution" for field odds.

### Defaults when the opponent's set is unknown

| Situation | Default | Label in the UI |
|---|---|---|
| Form has usage data | Top-3 spreads by weight (renormalised), top item, top ability, moves ≥ 15% | "Usage default (Smogon, month)" |
| Form has no usage data (e.g. Rotom-Fan, Stunfisk-Galar, Simipour, Tauros) | Speed: the full range, 0 SP with −nature up to 32 SP with +nature (`stats.mjs` `speedRange`). As attacker: 32 SP + boosting nature, no item. As defender: show both 0/0 and 32/32 HP/defence | "Unknown set: range" |
| Open team sheets (scenario B) | Exact moves, item and ability from the sheet. SP are still unknown, so use usage spreads | "Sheet + usage spreads" |
| Bo3 game 2+ | Revealed moves, item and Mega fixed. SP inferred from the observed damage if the user enters it (later) | "Partly revealed" |

**Item clause and one Mega:** a suggestion must not assume an item the user's team already uses, or a second Mega.

## 5. Conditions that must not be silently defaulted

These change answers by more than 20 points in the reference cases. The dashboard should show them as explicit toggles with the
default stated:

- **Doubles spread 0.75x** (Heat Wave, Rock Slide, Discharge, Earthquake): on by default for spread moves.
- **Intimidate:** the league has 5+ Intimidate users (Incineroar, Salamence, Staraptor, Krookodile, Overqwil). Physical KO benchmarks
  should show "at −1" next to "at +0".
- **Screens 2732/4096** (doubles). Calvin, DingDing, Data and 17 run Prankster screens.
- **Weather** (Anthony's own: sun from Mega Charizard Y, rain from Pelipper; opponents' sand / rain / snow), and terrain only for
  grounded attackers.
- **Contrary / Defiant / Competitive** stage changes on targets, and **Unaware / Imposter**, which make setup worthless.
- **Abilities that zero a calc:** Flash Fire, Lightning Rod / Volt Absorb, Sap Sipper, Levitate, Disguise. **Abilities that halve:**
  Thick Fat, Heatproof, Multiscale, Aura Guard (contact). These are all present in the league (`league_calc` ability census).

## 6. YouTube transcript attempts

- "The EV Trick Pros Use to Win in Pokémon VGC – Jump Points Explained", ZemTennar, 2025-05-15,
  https://www.youtube.com/watch?v=2QPdqP3zSGI. I fetched the public watch page and requested the caption track it lists. The
  caption body was **empty** (0 bytes). The suspected cause is that YouTube requires a player token; I didn't establish it.
  **No transcript evidence was used.** The description was readable: it teaches EV "jump points", which don't exist in Champions (§2).
- I didn't try other videos for this file. The written guides above cover the method with quotable text.

## 7. Sources

- Wolfe Glick, *How To Make Complex EV Spreads*, https://www.vgcguide.com/eving-3 (no date; SV era).
- Aaron Traylor, *How To Make Simple EV Spreads*, https://www.vgcguide.com/eving-1-how-to-make-simple-ev-spreads (no date).
- Victory Road, Giovanni Cischke 2025 Worlds report, https://victoryroad.pro/2026/08/27/giovanni-cischke-worlds/ (SV EVs).
- Victory Road, Federico Camporesi Worlds semifinal report, https://victoryroad.pro/2023/08/26/federico-camporesi-worlds-report/ (search summary only).
- pokestats.cc VGC EV guide, https://pokestats.cc/guides/vgc-ev-training-guide (CREATOR CLAIM).
- Pokémon Showdown, master 3a766f2 (2026-10-13): `data/mods/champions/scripts.ts`, `sim/battle-actions.ts`, `sim/battle.ts`.
- Drafarig `cloud-checkpoint` (cda8f0a): `lib/calc/stats.mjs`, `lib/calc/threshold.mjs` (read, not executed).

# ZhuZi (Week 3): what the Showdown simulation says

*2026-10-22. VGC Strategy, the Developer's simulator (`tools/sim`) and the team lead. Sources: `tools/sim/results/r6`, `r6x`,
`r7`, `r7t`, `r7v` (all after the damage-cache fix, §3 #7), `tools/sim/candidates/zhuzi.json` (teams and weights),
`tools/sim/candidates/r5/c1.txt` (the final six), `tools/sim/NOTES.md` (AI design and validation). Rounds 1–5 are kept
in §5 as history only: they ran with the cache bug.*

## 0. Bottom line

- **Bring this six ("c1"):** Charizard (32 HP / 0 Speed), Aegislash (Kasib Berry, Shadow Sneak), Kangaskhan (Silk Scarf:
  Fake Out / Double-Edge / Sucker Punch / Protect), Morpeko, Sinistcha (Bold, Sitrus), and **Conkeldurr in place of
  Rotom-Fan**. Sets in §1.
- **Play it with the guide's preview table** (§6). The sim's estimate with that table, on 2,880 fresh games:
  - **76.9% ± 1.6 weighted win rate** against 24 plausible ZhuZi teams.
  - **+5.6 ± 2.3 points** over the best round-3 six (a17, with Rotom-Fan and the fast Charizard), each six with its own
    best preview.
  - **+6.8 ± 2.2** over the same six with Rotom-Fan (c7): Conkeldurr is the change that matters.
- **Why the preview table matters:** with the AI choosing c1's leads, c1 scored only 59.0% and lost to a17 (−8.3 ± 2.4).
  The AI previews c1 badly; with any reasonable preview c1 is the better six (§3 #8). Follow the table.
- **The game plan:**
  - Against his Mega Metagross + Krookodile + Infernape core: **Trick Room first.** Lead Kangaskhan + Sinistcha, with
    Charizard + Conkeldurr in the back (78%).
  - Against Oranguru + Toxtricity, or Slowking-G: lead Charizard + Kangaskhan.
  - Against his anti-Charizard six (Slowking-G + Umbreon + rocks): **leave Charizard home.** Lead Aegislash + Kangaskhan,
    with Conkeldurr + Sinistcha in the back (70% vs 52% for the old row).
- **Where we are weakest:** Umbreon sixes with Toxtricity or Taunt + Imprison (z09 and z17, 53% each), and the fast
  goodstuffs sixes, where a17 did better (z02 70% vs 82%, z06 73% vs 93%).
- **How much to trust it:**
  - These are heuristic AIs on open team sheets, playing against teams we built for ZhuZi, not his real six.
  - Treat differences under ~3 points as ties.

## 1. The final six (c1)

Brought and win % come from c1 with its preview table, on the validation games (seeds 500000, n = 2,880).

| Slot | Set | Brought | Win % when brought |
|---|---|---|---|
| Charizard | @ Charizardite Y · Blaze · Modest · 32 HP / 32 SpA / 2 SpD · Heat Wave / Weather Ball / Solar Beam / Protect | 96% | 77% |
| Aegislash | @ Kasib Berry · Stance Change · Brave · 32 HP / 32 Atk / 2 Def · Poltergeist / Shadow Sneak / King's Shield / Wide Guard | 38% | 78% |
| Kangaskhan | @ Silk Scarf · Scrappy · Adamant · 32 HP / 32 Atk / 2 Def · Fake Out / Double-Edge / Sucker Punch / Protect | 100% | 77% |
| Morpeko | @ Focus Sash · Hunger Switch · Jolly · 2 HP / 32 Atk / 32 Spe · Fake Out / Aura Wheel / Taunt / Protect | 0% | – |
| Sinistcha | @ Sitrus Berry · Hospitality · Bold · 32 HP / 14 Def / 20 SpD · Matcha Gotcha / Rage Powder / Trick Room / Life Dew | 100% | 77% |
| Conkeldurr | @ Life Orb · Iron Fist · Brave · 32 HP / 32 Atk / 2 SpD · Drain Punch / Mach Punch / Ice Punch / Protect | 66% | 76% |

The paste is in `lib/guides/5v3.mjs` (`sets`) and in `tools/sim/candidates/r5/c1.txt`.

Morpeko is a sixth slot that is never brought. Stunfisk-Galar in its place (c2) scored the same: +0.8 ± 1.6, with its own
fitted preview. Either is fine; the guide keeps Morpeko.

**Speed tiers** (Champions: base + SP + 20, nature):

| | Our side | His side |
|---|---|---|
| Fast | Morpeko 163 | Scarf Krookodile 237, Scarf Rotom-Wash 226, Dragapult 194–213, Mega Metagross 178, Infernape 176, Krookodile (no Scarf) 144–158, Toxtricity 127–139 |
| Middle | Charizard 120, Kangaskhan 110 | Krookodile Impish 118, Rotom-Wash 112 |
| Slow | Sinistcha 90, Aegislash 72, Conkeldurr 58 | Florges 95, Toxtricity (Quiet) 85, Umbreon 85, Oranguru 72, Slowking-G 45 |

Under our Trick Room, everything we bring moves before everything in his fast core.

## 2. Method

**Engine.** Pokémon Showdown at a pinned commit, format `[Gen 9 Champions] VGC 2026 Reg M-C`:
- doubles, bring 6 pick 4, Level 50, Stat Points on the EVs line, open team sheets;
- parity with the app engine (`lib/calc`) checked to the HP point on stats and damage ranges (NOTES.md, step 1).

**Players.** Both sides use the same heuristic AI (`tools/sim/ai`).
- **Preview:** it scores 4-of-6 sets by offence and defence. It then scores every lead pair in the best three sets by a
  solved turn-1 game against the opponent's two likeliest leads.
- **Turns:** each turn is a zero-sum matrix game over both sides' candidate joint actions.
  - Damage comes from `lib/calc`, with a one-turn resolver for priority, Speed, Trick Room, Protect, Wide Guard,
    redirection, Fake Out, Intimidate, Sash, berries, pivots and Stance Change.
  - The game is solved by regret matching with double-oracle expansion.
- **Play:** each AI plays its equilibrium mix 85% of the time and a softmax otherwise, plus 7% "human" noise
  (second-best move, a stray Protect, a target swap).
- **Knowledge:** both AIs know both full sets (open team sheets).

**Opponent personas.** In a share of games, ZhuZi's AI commits to his team's plan, as a human would:
- **tr:** 60% of games for z04 / z05 / z15 / z16 / z23, 30% for z06. Lead the setter and an abuser; Trick Room at p 0.8.
- **rock:** 60% for z03 / z08 / z18. Lead the Rock Slide user.
- **chilly:** 60% for z07. Bring Slowking-G; Chilly Reception while our sun is up.

**His teams.** 24 candidate sixes (z01–z24) built from his 10 drafted Pokémon. Their sets come from the Sept ladder
(≥ 1760) plus worst-case anti-Anthony sets. Weights add up to 1 (`zhuzi.json`; `docs/research/strategy/sim/zhuzi-candidates.md`).
- Highest weight: z01 goodstuffs, 9.2%.
- Next, at 7.1% each: z02 Life Orb Toxtricity, z03 anti-Charizard rocks, z04 Trick Room + Instruct.
- Then z06 hybrid and z08 anti-Anthony, at 6.1% each.

**Our preview, fairly (round 7).** A six is only as good as the preview we play it with, and Anthony will follow the
guide's table, not the AI. So each finalist was compared with its own best table:
1. **Explore:** 2,880 games (seeds 400000) with our preview drawn evenly from the AI's 8 best (bring-4, lead) options
   (`--preview explore`).
2. **Fit:** for each of the guide's five row conditions, the option with the best shrunk win rate
   (`scripts/fit-previews.mjs`: (wins + 10 × row mean) / (games + 10), at least 15 games).
3. **Validate:** 2,880 fresh games (seeds 500000) with that table (`--preview <table.json>`). Sixes that match no row
   (z09, z21) keep the AI's preview.

**Pairing and confidence intervals.**
- Game *i* uses seed `base + i` in every run, so two of our sixes face the same opponent team, persona and random stream,
  game by game.
- Differences are paired. "±" is a 95% interval: 1.96 × the standard error of the paired difference.
- "Weighted" averages per-team win rates by ZhuZi's team weights.

**Validation** (current AI, NOTES.md step 2c):

| Check | Result |
|---|---|
| vs a random player | 390/400 = 97.5% (95.5–98.6%) |
| Mirror a01 vs a01 | 46.7% (42.7–50.7%) |
| Mirror z01 vs z01 | 49.3% (44.4–54.1%) |
| Trick Room teams set Trick Room (tr persona) | 98.9% |
| Trick Room teams set Trick Room (calc AI, no persona) | 83.5% |
| …against a fast team | 87.0% |
| Errors | a recovered player exception in about 0.4% of games (11 of 2,880 in c1's validation run, 5 in a17's); no stalled games |
| Position tests | 32/32 sim tests pass |

The position tests cover:
- Fake Out on turn 1, and no Fake Out into Ghosts or Inner Focus;
- Wide Guard against a known Rock Slide;
- taking a KO when one is available;
- Choice locks, and the Last Resort and Sucker Punch rules;
- Instruct and Chilly Reception;
- Stance Change, and Foul Play avoidance under Trick Room;
- semi-invulnerable turns.

## 3. Bugs found and fixed (and what they changed)

| # | Found in | Problem | Fix | Effect on results |
|---|---|---|---|---|
| 1 | AI review (`ai-review.md`) | Double-Protect overuse; Last Resort chosen while illegal; a preview blind to turn 1; Aegislash form blindness; no plan personas; noise and Instruct targeting | Commit d263db2 | All results from round 1 on use the fixed AI |
| 2 | Pilot (guide preview) | The guide's first preview row (lead Aegislash + Kangaskhan) was bad, not the AI: Infernape outspeeds and Fake Outs Kangaskhan; Krookodile's Intimidate drops Aegislash (Poltergeist on Mega Metagross 99–119% → 64.9–77.7%); Scarf Knock Off does 69.4–82.6% to Shield Aegislash | Guide row → lead Kangaskhan + Sinistcha (Trick Room) | 14.2% → 57.1% against the six teams with that core (n = 240, same seeds) |
| 3 | Round 1 | The sim's `damage()` turned any `lib/calc` refusal into 0. Mimicry is refused (type change), so Stunfisk-Galar was unhittable and harmless to the AI | Refusals retried with a neutral ability (exact for Mimicry without terrain) and counted per batch (1424089) | Round-1 Stunfisk results are void |
| 4 | Round-1 logs | Phantom Force: the AI attacked Dragapult during its charge turn, and used King's Shield into a hit that breaks protection | Semi-invulnerable tracking; `breaksProtect` (1424089) | From round 3 |
| 5 | Round-1 logs | Pointless Mega Charizard switching | Switch-in cost from the foes' best hit, plus a Mega switch-out cost (1424089) | From round 3 |
| 6 | Round-3 metrics | Sucker Punch failed on 3.3% of moves | Sucker Punch fails unless the target is about to attack (1424089) | From round 3 |
| 7 | **Rounds 1–5 (found 2026-10-22)** | The damage cache in `tools/sim/ai/engine.mjs` was module-global and outlived a game. Its keys named Pokémon by slot or species, never by set, so damage computed for one team's Krookodile (Scarf) was reused for another's (Life Orb), across games. | The set is now part of the key, and the cache is cleared at the start of every game (4ba3ea2). One position test had passed only through the leak; it now tests Foul Play avoidance under Trick Room, the only case where Umbreon hits Blade Aegislash. | **It changed the answer.** Re-run with the AI's preview, c1 went from +6.0 over a17 (round 5) to **−8.3 ± 2.4** (round 6). Every rounds 1–5 number is history only. |
| 8 | Round 6 | **The AI's own preview is weak for some sixes.** c1 with the AI preview: 59.0%; c1 with the guide's table on the same seeds: 75.1% (+14.9 ± 2.2). So comparing sixes under the AI preview measures the AI's previewing as much as the six. | Round 7: each finalist compared with its own fitted preview table (§2), validated on fresh games (5d550d0) | c1 is the best six by +5.6 ± 2.3 under fair previews. Under explore (an even spread over the AI's top 8 options) c1 also leads: 63.4% vs a17's 53.5%. |

## 4. ZhuZi's most plausible teams, and how they beat us

c1 and a17 are each played with their own fitted preview table, on the validation games (n = 120 per team, ±8 points).

| Team (weight) | c1 | a17 | How it plays against c1 |
|---|---|---|---|
| **z01** goodstuffs, ladder sets (9.2%): Mega Metagross, Dragapult, Rotom-Wash, Scarf Krookodile, Infernape, Scarf Toxtricity | **79%** | 84% | Leads Infernape + Metagross every game (95/120 for us). Infernape outspeeds and Fake Outs; our Trick Room lead takes the hit and flips Speed. |
| **z02** Life Orb Toxtricity (7.1%) | **70%** | 82% | Leads Infernape + Toxtricity (81/117). Life Orb Overdrive pressures Charizard and Conkeldurr. One of the two teams where a17 (Rotom-Fan, fast Charizard) is clearly better. |
| **z03** anti-Charizard rocks (7.1%): Rock Slide Mega Metagross, Life Orb Krookodile, Scarf Toxtricity | **79%** | 65% | Leads Infernape + Metagross or Infernape + Krookodile. Under our Trick Room the Rock Slides come last. |
| **z04** Trick Room + Instruct (7.1%): Oranguru, Quiet Toxtricity, Slowking-G, Impish Krookodile | **91%** | 71% | Leads Oranguru + Toxtricity (73/79). Heat Wave OHKOs Toxtricity; Sinistcha re-sets Trick Room to cancel his. |
| **z06** hybrid Trick Room / fast (6.1%) | **73%** | 93% | Leads Infernape + Toxtricity (65/84) or Oranguru + Toxtricity (23/36). It matches our Trick Room row, which fits it less well. |
| **z08** anti-Anthony full prep (6.1%): Rock Slide Metagross, Life Orb Krookodile, Scarf Toxtricity, Umbreon, Power Gem Slowking, Sash Dragapult | **70%** | 43% | Leads Krookodile + Metagross (82/117). The longest games (9.3 turns). The new row (no Charizard) is why c1 handles it. |
| z09 bulky Foul Play balance (4.1%) | **53%** | 64% | Toxtricity + Umbreon leads (57/110). No guide row covers it, so the AI previews it. |
| z17 anti-Sinistcha, Taunt + Imprison (3.1%) | **53%** | 38% | Metagross + Umbreon leads (63/120). Taunt stops our Trick Room. |

**Across all 24 teams, c1 ranges from 53% (z09, z17) to 93% (z12).**

| His persona | c1 win rate |
|---|---|
| calc (no persona) | 77% |
| tr | 75% |
| rock | 76% |
| chilly | 92% |

**The common thread:** his offence is faster than all of ours. It wins turn 1 with Infernape's Fake Out, and it threatens
Charizard with Rock moves. c1 wins by not playing that game: Trick Room from a Ghost that Fake Out can't touch, Conkeldurr
to cash it in, and Charizard kept home when the rocks are everywhere. Its weak spots are bulky Umbreon sixes, which stall
Trick Room out (Foul Play, Taunt), and the fast goodstuffs sixes, where a17's Rotom-Fan and faster Charizard did better.

## 5. Round-by-round history

| Round (seed base) | Games each | Cache | Result (weighted win %; Δ = paired ± 95%) |
|---|---|---|---|
| Pilot (1) | 960 | bug | a01, AI preview 53.1% vs guide preview 45.5% → found the guide-row problem (§3 #2) |
| R1–R3 | 480–1,440 | bug | Built a17 = Double-Edge Kangaskhan + Shadow Sneak / Kasib Aegislash + Bold Sitrus Sinistcha (round 3: +8.5 ± 3.5 vs a01) |
| R4 (120000) | 960 | bug | 32 one-change ablations of a17 |
| R5 (200000) | 2,880 | bug | c1 66.8 (+6.0 ± 2.4 vs a17), c6, c7, c5, c2, c3, c4, a17 61.5 |
| **R6 (300000)** | 2,880 | **fixed** | AI preview: a17 68.6, c7 65.1 (−3.4), c6 65.0 (−2.3), c2 63.5 (−4.8), c5 63.0, c3 62.5, c4 60.7, **c1 59.0 (−8.3 ± 2.4)**. c1 with the guide's preview: 75.1. |
| **R6x (320000)** | 960 | fixed | The 32 ablations of a17 again, AI preview (§7) |
| **R7 (400000 / 500000)** | 2,880 + 2,880 | fixed | Each six with its own fitted preview, on fresh games: **c1 76.9 ± 1.6**, c1 with the previous guide rows 74.8 (−3.0 ± 1.8 vs fitted), c7 71.8, a17 71.6, c6 71.3. **c1 vs a17 +5.6 ± 2.3; vs c7 +6.8 ± 2.2.** |
| **R8 (500000)** | 2,880 | fixed | Changes on c1, with c1's table: Life Orb Kangaskhan −0.2 ± 2.0; Body Slam −1.5 ± 2.1; Stunfisk-Galar for Morpeko (c2, with its own table) +0.8 ± 1.6. All ties. |

The combos (all relative to a17): c7 = bulky Charizard; c1 = c7 + Conkeldurr for Rotom-Fan; c6 = c7 + Stunfisk for Morpeko;
c2 = c1 + Stunfisk for Morpeko; c5 = the same six as c2; c3 = c1 + Overheat with the fast Charizard; c4 = c3 + Stunfisk
+ Strength Sap.

## 6. Previews and leads (what the guide now says)

The guide's table is c1's fitted table: fitted on the explore games, then checked on fresh ones (§2). Per row:

| His six includes… | Bring (lead first) | Fitted on (explore) | Validation |
|---|---|---|---|
| Mega Metagross + Krookodile + Infernape (13 teams) | **Kangaskhan + Sinistcha**; Charizard, Conkeldurr | 124/156 = 79%; with Aegislash instead of Conkeldurr 74% (185) | 78.2% (n = 1,560); the previous row (Aegislash in the back) 75.6% |
| Oranguru + Toxtricity (5 teams) | **Charizard + Kangaskhan**; Aegislash, Sinistcha | 45/55 = 82% | unchanged from the previous guide |
| Galarian Slowking + Umbreon (z08) | **Aegislash + Kangaskhan**; Conkeldurr, Sinistcha | 14/20 = 70% | **70.0%** vs 51.7% for the previous row (Aegislash + Sinistcha lead, Charizard in the back), n = 120 each |
| Galarian Slowking (z07, z19) | **Charizard + Kangaskhan**; Aegislash, Sinistcha | 30/33 = 91% | unchanged |
| Dragapult + Umbreon (z20) | **Charizard + Kangaskhan**; Conkeldurr, Sinistcha | 13/16 = 81% | unchanged |

Overall, the fitted table scored 76.9% vs 74.8% for the previous rows (+3.0 ± 1.8 paired). Teams where both tables pick the
same preview still moved by about 2 points between the two runs: that is the noise floor.

Leads used with the table (validation): Kangaskhan + Sinistcha 78% (n = 1,562), Charizard + Kangaskhan 75% (1,080),
Aegislash + Kangaskhan 70% (120), Aegislash + Sinistcha 85% (114: the AI's choice against z09 and z21).

## 7. Per-choice reasoning (c1)

Each line gives:
- **Δ:** the measured change in win rate when that one choice is swapped. Unless marked, this is round 6x: the a17 base
  (Rotom-Fan, fast Charizard), the AI's preview, n = 960 paired, ± 95%. A negative Δ means the alternative is worse, so
  our choice is better. Round 7/8 numbers (fair previews, 2,880 games) are used where they exist and outrank 6x.
- **Calc:** the app-engine number that explains it. Every range below is a guide calc and reproduces in `lib/calc`
  (`verify_curated.mjs`).
- **Verdict:** how much weight the evidence can carry.

Most single set choices measure as **ties** (within ±4 at n = 960). For those, the calc is the reason, not the sim.

### Charizard (Mega Y)

- **Member: Mega Charizard Y.** Not ablated: it is the only Mega and the Week 1 core. Brought in 96% of games.
  - **Calc:** Heat Wave in sun OHKOs Mega Metagross (137.5–161.7%) and Toxtricity (101.3–119.8%). Nothing else we have does both.
- **SP 32 HP / 32 SpA / 2 SpD, 0 Speed (the x27 change).**
  - **Δ:** +0.8 ± 4.1 over 6 HP / 26 Speed; with fair previews, c7 (only this change) vs a17 is −1.3 ± 2.1. **A tie.** Rounds 4–5 had it at +5.9; that was the cache bug.
  - **Calc, bulk:** HP 159 → 185.
    - Scarf Krookodile Rock Slide: 90.5–108.1% (44% OHKO) → **77.8–92.9%** (survives).
    - Life Orb Toxtricity Overdrive: 94.9–112.5% → **81.6–96.7%** (survives one).
    - Ladder Power Gem: 85.5–100.6% → 73.5–86.4%.
  - **Calc, Speed 146 → 120:** it loses outspeeding Adamant Krookodile (144) and Toxtricity (127). It keeps outspeeding Rotom-Wash (112) and Impish Krookodile (118), and under our Trick Room it moves before Toxtricity.
  - **Other spreads:** max Speed (x28) +0.4 ± 3.5.
  - **Verdict: tie in the sim. Kept for the survival calcs**, which matter most in the Trick Room games c1 is built for.
- **Nature Modest, item Charizardite Y, ability Blaze.** Fixed by the Mega (Blaze is irrelevant after Drought); not tested.
- **Heat Wave.** Not ablated (the core move). Calc above.
- **Weather Ball.**
  - **Δ:** Overheat in its place (x18): +1.0 ± 3.8. A tie.
  - **Calc:** in sun, Weather Ball OHKOs Life Orb Krookodile (127.3–150.0%) and does 76.1–89.8% to Oranguru, at no SpA cost. Overheat does 98.9–116.2% to Oranguru, but leaves Charizard at −2 SpA.
  - **Verdict:** keep Weather Ball (repeatable).
- **Solar Beam.**
  - **Δ:** Scorching Sands (x19): −0.7 ± 3.9. A tie.
  - **Calc:** Rotom-Wash 92.9–110.8% (63% OHKO) in sun. Without it, Rotom-Wash walls Charizard.
  - **Verdict:** keep, for Rotom-Wash.
- **Protect.** Not ablated: needed to scout Rock Slide and Overdrive.

### Aegislash

- **Member.** Brought in 38% of games: against Oranguru, Slowking-G and z08 sixes.
- **Wide Guard.**
  - **Δ:** Close Combat in its place (x12): **−10.4 ± 4.1**.
  - **Calc:** it blocks Krookodile's Rock Slide (112.4–135.1% on Charizard) and Toxtricity's Overdrive + Instruct (163–193% combined).
  - **Verdict: strong.** The most valuable single move.
- **Shadow Sneak.**
  - **Δ:** Iron Head (x11): +1.6 ± 3.5. A tie.
  - **Calc:** priority, so it finishes a Sash-broken Infernape (38.4–46.3%) and Dragapult (61.8–73.9%) before they move.
  - **Verdict:** tie; kept for priority.
- **Poltergeist.** Not ablated (the main attack). It OHKOs Dragapult (167.2–197.5%) and Slowking-G (124.7–146.5%), and does 99.3–118.4% to Mega Metagross (64.9–77.7% at −1).
- **King's Shield.** Not ablated: Stance Change needs it to get back to Shield form.
- **Item Kasib Berry.**
  - **Δ:** Metal Coat (x20) +0.4 ± 3.2; Colbur Berry (x21) +0.3 ± 3.6. Ties.
  - **Calc:** Dragapult's Life Orb Shadow Ball on Blade form does 168.2–197.6% with Metal Coat and **83.8–98.8%** with Kasib (survives).
  - **Verdict:** tie; Kasib turns an OHKO into survival.
- **Nature Brave (Speed 72).**
  - **Δ:** Adamant (x32) +0.6 ± 2.9. A tie.
  - **Verdict:** Brave keeps it slower under our Trick Room.

### Kangaskhan

- **Member.** Brought in every game with the table. It is the Fake Out and the Normal damage that hits Ghosts.
- **Fake Out / Double-Edge / Sucker Punch / Protect, Silk Scarf.**
  - **Double-Edge:** Body Slam on c1 (round 8): −1.5 ± 2.1. A tie; Double-Edge hits harder: Toxtricity 96.0–113.9%, Dragapult 83.6–98.7%.
  - **Sucker Punch:** Low Kick (x08) −0.4 ± 3.7. A tie; priority 54.5–65.4% on Dragapult.
  - **Protect:** Low Kick (x09) **−8.4 ± 4.1**. Protect matters: Kangaskhan is the target on turn 1.
  - **Item:** Life Orb on c1 (round 8): −0.2 ± 2.0. A tie; Silk Scarf avoids stacking recoil on top of Double-Edge's.
- **Ability Scrappy.**
  - **Δ:** Inner Focus (x26): −3.5 ± 3.7, leaning Scrappy.
  - **Calc:** Scrappy lets Fake Out and Double-Edge hit Dragapult, and blocks Intimidate.
- **Nature Adamant (Speed 110).** Brave (x30): +0.3 ± 2.8. A tie.

### Morpeko

- **Member.** Never brought with the preview table. Its value is in what **he** brings against our open sheet.
  - **Δ for its slot:** Pelipper (x02) **−12.2 ± 3.7**; Simipour (x03) **−9.3 ± 3.4**; Conkeldurr (x01, a second Conkeldurr-type slot beside Rotom-Fan) −7.8 ± 4.0; Stunfisk-Galar (x04) +2.2 ± 3.3.
  - With fair previews, Stunfisk-Galar for Morpeko in c1 (c2): **+0.8 ± 1.6**. A tie.
  - **Verdict:** Morpeko or Stunfisk-Galar; not Pelipper or Simipour.
- **Its set.** Parting Shot for Taunt (x17): +0.6 ± 2.6. Barely matters; it is not brought.

### Sinistcha

- **Member.**
  - **Δ:** Conkeldurr in its place (x07): **−18.0 ± 4.4**.
  - **Verdict: strongest.** The most valuable member.
  - **Calc:** it is the Trick Room setter that Infernape's Fake Out and Close Combat can't touch, and it survives Scarf Knock Off (67.4–80.8%).
- **Life Dew.** Protect (x15) −0.3 ± 3.4; Strength Sap (x16) +0.6 ± 2.9. Ties.
- **Nature / SP Bold 32 HP / 14 Def / 20 SpD.**
  - **Δ:** Calm 32 SpD (x29): +0.1 ± 3.8. A tie.
  - **Calc:** Bold takes 67.4–80.8% from Scarf Knock Off and 42.6–50.5% from Mega Metagross Iron Head. Bold matches his physical core.
- **Item Sitrus Berry.**
  - **Δ:** Coba Berry (x24) −3.5 ± 3.3; Mental Herb (x25) −3.5 ± 3.4.
  - **Verdict:** leaning Sitrus.

### Conkeldurr (replaces Rotom-Fan)

- **Member.**
  - **Δ:** with fair previews, c1 vs c7 (the same six with Rotom-Fan) is **+6.8 ± 2.2**. This is the change that makes c1.
  - Under the AI's preview, the swap was −3.6 ± 4.2 (x06), because the AI rarely builds the Trick Room bring that Conkeldurr needs. The table does.
  - **Calc:** a Trick Room attacker (Speed 58).
    - Drain Punch OHKOs Scarf Krookodile (163.3–191.8%; 108.7–128.4% after Intimidate).
    - Ice Punch OHKOs Dragapult (118.1–140.0%).
    - Drain Punch does 87.0–105.5% to Umbreon.
    - Mach Punch does 62.2–72.8% to Infernape, after the Sash breaks.
    - **Weak to:** Mega Metagross Psychic Fangs (101.8–119.8%) and Florges Moonblast (104.7–124.5%).
  - Brought in 66% of games, winning 76% of them.
  - **Verdict: strong.**
- **Its set (Life Orb, Iron Fist, Brave 32/32/2; Drain Punch / Mach Punch / Ice Punch / Protect).** Untested alternatives: Guts with Flame Orb, and Knock Off.

## 8. Limits

- **Teams:** his teams are our candidates, not his real six. A team we didn't imagine is not covered.
- **Information:** both AIs see open team sheets. ZhuZi will know our sets the same way.
- **The AI is a heuristic:** it looks one turn deep, plus a threat term. Two-turn plans, Encore, Taunt and Yawn are modelled only roughly. Humans make different mistakes.
- **The preview matters as much as the six** (§3 #8). The 76.9% assumes the guide's table is followed. With the AI's own preview, c1 dropped to 59%.
- **Fitting:** the table was fitted on one set of games and measured on another, but its rows were fitted on the AI's top 8 options only. A better bring the AI never considers would be missed.
- **Noise:** about ±2 points per team-group, even at 2,880 games. Single teams at n = 120 are ±8.
- **Stunfisk-Galar** is simulated without terrain (Mimicry inactive), which matches this matchup.

## 9. Reproduce

```
Z=z01,z02,...,z24   # node -e "console.log(require('./tools/sim/candidates/zhuzi.json').opponent.teams.map(t=>t.id).join(','))"
node tools/sim/run.mjs --ours tools/sim/candidates/r5/c1.txt --theirs $Z --games 2880 --seed 400000 --preview explore --out tools/sim/results/r7/c1.jsonl
node docs/research/strategy/sim/scripts/fit-previews.mjs tools/sim/results/r7/c1.jsonl > tools/sim/results/r7t/c1.json
node tools/sim/run.mjs --ours tools/sim/candidates/r5/c1.txt --theirs $Z --games 2880 --seed 500000 --preview "$PWD/tools/sim/results/r7t/c1.json" --out tools/sim/results/r7v/c1.jsonl
# the same three for a17 (--ours a17), c7, c6, c2; the guide's own rows: --preview guide
node docs/research/strategy/sim/scripts/sim-tables.mjs tools/sim/results/r6x a17          # the ablation table (paired vs a17)
node docs/research/strategy/sp-assist/verify_curated.mjs                                  # every guide / mock calc in the app engine
```

# Hex (Week 4), round 2: rebuilt after the Calvin mock (2026-11-05)

**Why:** in the mock with Calvin, Hex's Kleavor + Rotom-Heat beat the round-1 six (s119: Mega Charizard Y, Morpeko,
Conkeldurr, Simipour, Stunfisk-Galar, Pelipper) without his Psychic Spam ever coming out. Anthony's rules for round 2:
no Simipour / Stunfisk-Galar (stats too low in real play) unless we cannot win without them; Mega Kangaskhan is the main
Mega; Charizard is good but needs speed support and must not switch into Kleavor's Stone Axe rocks; Hex is weak to
offensive Pelipper; don't over-correct (Psychic Spam is still his strongest plan).

**What round 1 missed.** (1) The engine's leaf evaluation ignored entry hazards, so Stone Axe's Stealth Rock cost a
4x-Rock Charizard nothing (fixed: `hazardCost` in `tools/sim/engine/player.mjs`). (2) The heuristic screen already had
s119 at 45.5% vs his Kleavor + Rotom-Heat sixes; we weighted the overall number. (3) Without Simipour / Stunfisk the best
round-1 six scored 42% (heuristic): on paper the other eight are a hard matchup, so sets and leads carry it.

## Method
- Pool: `sp-assist/gen_hex2.py` → `tools/sim/candidates/hex2.json`. All 28 sixes of the eight allowed mons × 3 set
  packages: A = new answers (Mystic Water Tailwind Pelipper, Rock Slide Mega Kangaskhan, Iron Head Aegislash, Guts Life
  Orb Rock Slide Conkeldurr, Electroweb Morpeko / Rotom-Fan), B = Week 3 sets with Mega Kangaskhan, C = A with Choice
  Scarf Pelipper (Champions has no Choice Specs or Flame Orb). Opponent: hexpov's (h01–h20 weighted).
- Calcs: `hex2-calcs.md` (`sp-assist/hex2_calcs.mjs`), guide calcs `sim/scripts/hex2-guide-calcs.mjs`.
- Ranking: `sim/scripts/hex2-rank.mjs` — weighted, vs Kleavor + Rotom-Heat sixes (KR), vs Indeedee-F + Armarouge (psy).

## Results
Heuristic screen (100 games each, seed 3100000): nC19 72.2 / KR 74.5 / psy 63.5; nC04 56.2; everything else ≤ 56.

Engine both sides, closed sheets, 160 games each (seed 5200000):

| six | weighted | KR | psy |
|---|---|---|---|
| nC04 Charizard, Sinistcha, Scarf Pelipper, Mega Kangaskhan, Morpeko, Conkeldurr | 56.5 | 63.6 | 55.9 |
| **nC19** Charizard, Scarf Pelipper, Mega Kangaskhan, Morpeko, Conkeldurr, Rotom-Fan | 58.1 | 54.5 | 58.8 |
| nA19 = nC19 with Tailwind Pelipper | 59.6 | 50.0 | 58.8 |
| nB19 = nC19 with Week 3 sets | 52.6 | 42.0 | 50.0 |
| nA10 (no Kangaskhan) | 42.9 | 39.8 | 51.5 |
| nB25 / nA25 / nA22 (no Charizard) | 39.9–42.8 | 35–42 | 40–44 |

Fresh seeds (480 games, seed 6000000): nC19 67.2 / KR 66.3 / psy 66.9; nC04 55.9. Over all 640 paired games nC19 65.5%,
**nC19 − nC04 = +6.6 ±4.4**. Pick: **nC19**.

Engine behaviour in nC19's games: Mega Kangaskhan in 97%; Charizard brought in ~3% (and those went badly), yet sixes
without it lose ~15 points (preview effect). Charizard is brought in ~90% of games vs Forretress sixes.

Preview (engine's own, 640 games): vs Indeedee-F + Armarouge + Drampa sixes Kangaskhan + Rotom-Fan lead 72% of 185
(Pelipper + Morpeko 39% of 109: Cloud Nine kills rain); vs Kleavor sixes without Drampa Pelipper + Morpeko 82% of 118;
vs Indeedee-F + Armarouge only, Kangaskhan + Rotom-Fan 76% of 58.

Weak: h14 "full anti-Anthony" 16%, h04 "anti-Charizard rocks" 31% (32 games each): Garchomp + Kleavor Rock Slide leads.
Fixed previews vs h14 + h04 (80 paired games, seed 6100000): Kangaskhan + Conkeldurr lead 43%, Morpeko + Conkeldurr 43%,
Pelipper + Morpeko 34%, Kangaskhan + Morpeko 33%, Kangaskhan + Rotom-Fan 33%, engine's own 34%. But Kangaskhan +
Conkeldurr vs h05/h09/h17/h18 (same species shapes, 160 paired, seed 6300000): 61.9% vs engine's own 68.1%. Weighted it
is a wash, and h09 has the same six species as h14 / h04, so the guide keeps the engine's preview and notes the read.

Hex's side (all 210 of his sixes vs nC19, heuristic, 10 each, seed 3700000): nC19 58.9% overall. His best counters are
Garchomp + Forretress + Armarouge sixes (often Mega Banette / Ditto). Engine check of his top eight (40 each, seed
6200000): 42.8% for us overall; p100 25%, p099 30%, p103 38%, p048 40%, h15 45%, p024 53%, p066 55%, p078 58%. None is a
likely Hex six (Forretress was his last-priority pick); no lead fixed them (38–40% each).

Not tested: Heatproof Sinistcha (nC04h, stopped once nC19 was chosen); Sash vs Scarf Pelipper on nC19 beyond the A/C tie.

## Recoil re-check (2026-11-05, after Anthony's note)
The engine games always included recoil, Rocky Helmet and Rough Skin (they run in Showdown's battle code), so the
win rates stand. The hand calcs in the guide did not. Mega Kangaskhan Double-Edge recoil is 33% of the damage dealt,
once over both Parental Bond hits; Rocky Helmet and Rough Skin hit Kangaskhan once per contact hit (twice).
Per use, Kangaskhan loses: Mega-Z / Drampa 25–29%, Armarouge 21–25%, Rotom-Heat 20–24%, Kleavor 11–13%;
**Indeedee-F (Rocky Helmet) 53–57%** for 72–86% damage; Forretress 39–40% for 21–25%; base Garchomp (Rough Skin) 47–51%.
After the foe's hit first: Mega-Z Draco then Double-Edge leaves Kangaskhan 0–30 HP (faints 2.4%; Double-Edge KOs
Mega-Z 0.4%); Drampa Draco (Trick Room) then Double-Edge always faints Kangaskhan; Life Orb Armarouge under Trick
Room 26%. Guide changes: no Double-Edge into Indeedee-F; Mega-Z only beside a second hit or after Fake Out; Drampa only
outside Trick Room. Script: job tmp `hex/recoil2.mjs` (not kept in the repo).

## Re-baseline on the fixed sim (2026-11-06)

After the trShare determinism fix (548ee2f) and pool beliefs (58be550). Engine vs engine, closed sheets, 480 games each,
paired seeds 6000000, h01..h20 (results in tools/sim/results/hex2/rebase/, not tracked).

| Run | Win % | Paired diff vs nC19 | Same-pick games | His Trick Room up / not |
|---|---|---|---|---|
| nC19, Guts Conkeldurr (Hex believes Iron Fist: game 1) | 67.3 | | | 60.7 / 70.8 |
| xIF_rs, Iron Fist, same moves (game 1) | 63.5 | −3.8 ±4.3 | +2.7 ±4.1 (n 336) | 61.9 / 64.4 |
| nC19-g2, Guts, Hex knows it (games 2–3) | 64.4 | −2.9 ±3.9 | same picks (n 480) | 58.9 / 67.3 |

Verdict: Guts and Iron Fist are inside the noise in game 1 (the all-games and same-pick diffs disagree in sign), and
Guts once revealed (64.4) is level with Iron Fist (63.5). The old −4.3 for Guts in games 2–3 does not reproduce.
Roll-level calcs (app engine, items included) for what unburned Guts gives up: Drain Punch + Mach Punch Mega-Z 58% vs
100%, Life Orb Garchomp 1% vs 100%; Mega Drampa Drain Punch OHKO 75% vs 100%; Corviknight 2x Drain Punch 3% vs 100%;
Rotom-Heat (Sitrus) 2x Drain Punch 71% vs 100%. Burned Guts makes all of these 100% and Drain Punch OHKOs Life Orb
Kleavor. Script: job tmp `hex/rolls2.mjs`.

### Rotom-Fan vs the alternatives (fixed sim, 2026-11-07)

Same setup (480 games each, seed 6000000, paired with nC19). Anthony's question: Rotom-Fan only does speed control.

| Six (nC19 with Rotom-Fan replaced by) | Win % | Diff vs nC19 | His Trick Room up / not |
|---|---|---|---|
| nC19 (Rotom-Fan) | 67.3 | | 60.7 / 70.8 |
| nC04 Sinistcha | 57.7 | −9.6 ±5.3 | 39.4 / 67.3 |
| nC16 Iron Head Aegislash | 54.4 | −12.9 ±5.5 | 31.3 / 63.0 |
| nC04h Heatproof Sinistcha | 51.9 | −15.4 ±5.6 | 39.9 / 58.6 |

The loss is concentrated in his Psychic Spam leads: Armarouge + Indeedee-F 59% with Rotom-Fan vs 22–32% without, and
Trick Room games (61% vs 31–40%); also Armarouge + Garchomp (75 vs 55–66). None of the swaps fixes Garchomp + Kleavor
(21% with nC19, 21–33% without, small n). Sinistcha's own Trick Room did not help in the sim; the engine's Trick Room
play is a known weak spot, so a human Sinistcha may do better than this, but not by 10 points on this evidence.

### Blind game-1 leads (fixed sim, 2026-11-07)

nC19 with ONE fixed bring-4 and lead against every Hex six (his AI picks normally), 480 games each, seed 6000000.
Segments by his six: Drampa (312 games) / Kleavor without Drampa (120) / neither (48).

| Lead / back | All | Drampa | Kleavor, no Drampa | Neither |
|---|---|---|---|---|
| AI preview (adapts per six) | 67 | 63 | 77 | 71 |
| **Morpeko + Pelipper / Kangaskhan + Conkeldurr** | **70** | **66** | **84** | 65 |
| Kangaskhan + Rotom-Fan / Conkeldurr + Morpeko | 65 | 61 | 73 | 71 |
| Kangaskhan + Rotom-Fan / Conkeldurr + Pelipper | 49 | 45 | 53 | 60 |
| Kangaskhan + Pelipper / Conkeldurr + Rotom-Fan | 48 | 47 | 50 | 46 |
| Kangaskhan + Conkeldurr / Pelipper + Rotom-Fan | 44 | 45 | 43 | 44 |

Paired, Morpeko + Pelipper − Kangaskhan + Rotom-Fan (Conkeldurr + Morpeko back): +5.2 ±5.2 overall, +4.8 ±6.6 with
Drampa. Every lead loses to his Garchomp + Kleavor lead (6–26%). The AI-preview split by Drampa (Kangaskhan + Rotom-Fan
76% vs Morpeko + Pelipper 52%) was selection by six, not the lead. Caveats against Morpeko + Pelipper: his AI brought
Drampa in only 14% of these games and rarely makes the predictive Indeedee-F switch into Fake Out; a human does both.

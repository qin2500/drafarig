# Week 5 vs Jacky (seat 4): simulation report

Pool: `tools/sim/candidates/jacky.json` from `docs/research/strategy/sp-assist/gen_jacky.py` after the Hex retro fixes
(f351730): ladder-modal sets, worst cases added (Close Combat Mega Golisopod, Wisp / Snarl Incineroar, Yawn Torkoal, Icy
Wind Mr. Rime, Aqua Jet Golisopod), item clause takes ladder second items, beliefRef b01,b02 covers all eight of our
species. Sim: fixed code (trShare determinism 548ee2f, pool beliefs 58be550), closed sheets. Results in
`tools/sim/results/jacky/` (not tracked).

## 1. Screen (heuristic, 2026-11-09)

All 56 of our sixes (8 allowed mons x packages J / K) vs his weighted sixes j01..j20, 100 games each (5 per six), seed
7100000. Weighted by his six weights. Top: yJ06 71, yJ20 70, yJ10 68, yK09 / yJ09 66, yK15 65, yJ14 65. Mega Kangaskhan
sixes fall in the engine (below). Nearly every six loses j07 (anti-Anthony: Chople Incineroar, Wisp Rotom-Mow,
Thunderbolt Farigiraf, Sash Lycanroc).

## 2. Engine confirm (240 games each, seed 7300000, engine both sides)

| Six | Win % | Weighted | His Trick Room up / not | Worst sixes |
|---|---|---|---|---|
| **yJ10 Charizard, Sinistcha, Pelipper, Morpeko, Conkeldurr, Rotom-Fan [J]** | **79.6 ±5.1** | 78.8 | 80 / 79 | j07 17, j03 50, j06 58 |
| yJ20 Charizard, Pelipper, Aegislash, Morpeko, Conkeldurr, Rotom-Fan [J] | 75.8 ±5.4 | 76.3 | 72 / 81 | j07 25, j05 42, j19 42 |
| yJ09 Charizard, Sinistcha, Pelipper, Aegislash, Conkeldurr, Rotom-Fan [J] | 73.3 ±5.6 | 76.0 | 67 / 80 | j07 25, j08 42 |
| yK15 Charizard, Sinistcha, Aegislash, Morpeko, Conkeldurr, Rotom-Fan [K] | 68.3 ±5.9 | 68.5 | 61 / 82 | |
| yJ06 Charizard, Sinistcha, Pelipper, Mega Kangaskhan, Conkeldurr, Rotom-Fan [J] | 61.7 ±6.2 | 63.7 | 56 / 76 | |
| yJ14 Charizard, Sinistcha, Mega Kangaskhan, Morpeko, Conkeldurr, Rotom-Fan [J] | 60.4 ±6.2 | 62.8 | 56 / 76 | |

Paired yJ10 − yJ20 +3.8 ±6.8, − yJ09 +6.3 ±6.6, − yK15 +11.3 ±7.7, − yJ06 +17.9 ±7.6, − yJ14 +19.2 ±8.0. yJ10 is the only
six that does not drop when his Trick Room goes up (Sinistcha's own Trick Room, Taunt Morpeko, rain vs his sun).
Determinism check yJ10 vs j01..j20 (engine, 24 games): 0 differ from a fresh replay (0 of 15 with Trick Room).

yJ10 items as simmed (the generator's item clause, not chosen): Charizardite Y, Sitrus Sinistcha, Focus Sash Pelipper,
Life Orb Morpeko, Expert Belt Conkeldurr, Leftovers Rotom-Fan.

## 3. His best response to yJ10

Every six of his ten with default sets (q001-q210), heuristic, 4 games each, seed 7400000: we win 70.1% overall; his best
sixes share Torkoal + Incineroar + Mimikyu (often base Rotom with Will-O-Wisp). Engine confirm of his best 8 (48 games
each, seed 7500000): we win 76.0% overall; worst q007 Golisopod / Incineroar / Farigiraf / Torkoal / Mimikyu / Rotom 52%
(his Trick Room up in 34 of 48, we win 35% of those) and q052 Golisopod / Incineroar / Torkoal / Mr. Rime / Rotom /
Appletun 54% (Trick Room in 47 of 48). The others 77-92%. His plan to fear: lead Incineroar + a Trick Room setter
(Mimikyu or Mr. Rime), Fake Out our answer, set Trick Room, sun Eruption behind it.

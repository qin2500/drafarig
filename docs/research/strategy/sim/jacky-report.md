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

## 4. Blind game-1 leads (yJ10, 240 games each, seed 7300000, paired with the AI-preview run)

One fixed bring-4 and lead against every Jacky six (his AI picks normally).

| Lead / back | All | His TR up | No TR | Lycanroc in six |
|---|---|---|---|---|
| AI preview (adapts per six) | 80 | 80 | 79 | 64 |
| **Charizard + Rotom-Fan / Pelipper + Conkeldurr** | **78** | **77** | 80 | 69 |
| Charizard + Conkeldurr / Pelipper + Rotom-Fan | 78 | 68 | 89 | 67 |
| Charizard + Morpeko / Pelipper + Conkeldurr | 70 | 68 | 75 | 68 |
| Charizard + Morpeko / Sinistcha + Conkeldurr | 61 | 48 | 82 | 54 |
| Morpeko + Sinistcha / Charizard + Conkeldurr | 43 | 31 | 64 | 58 |

Paired vs AI preview: −2 ±7, −2 ±6, −9 ±8, −19 ±7, −37 ±8. The default blind lead is Charizard + Rotom-Fan with Pelipper
+ Conkeldurr behind: level with the adaptive AI and the steadiest when his Trick Room goes up. The anti-Trick-Room lead
(Taunt Morpeko + Sinistcha) is the worst (31% when Trick Room still goes up; 9% into Farigiraf + Torkoal). Sinistcha and
Morpeko are rarely brought by the best fours; their value in the six is preview pressure and specific sixes. Soft spot
for every lead: his Lycanroc-Midnight + Torkoal lead (35-55%).

## 5. Follow-up tests (2026-11-11, engine, paired vs yJ10 79.6%)

| Change | Paired | Verdict |
|---|---|---|
| Fire Punch for Ice Punch on Conkeldurr | −2.1 ±4.4 | tie, keep Ice Punch |
| Inner Focus Silk Scarf Kangaskhan (no Mega) for Morpeko | −8.8 ±7.6 | worse |
| Same Kangaskhan for Rotom-Fan | −5.8 ±6.7 | worse |
| Aegislash for Rotom-Fan (yJ07) | −20.0 ±7.4 | worse; his Trick Room up 50% to 82% |

Lycanroc sixes (seed 7600000, 96 games each): Charizard + Rotom-Fan / Pelipper + Conkeldurr 69%; **Sinistcha +
Conkeldurr / Pelipper + Charizard 78%** (+9 ±10; 84% when his Trick Room goes up); Pelipper + Conkeldurr / Charizard +
Sinistcha 71%. Into his Lycanroc + Torkoal lead: 43 / 52 / 62%. Pivoting Charizard into Pelipper on turn 1 costs Pelipper
86-103% and Rotom-Fan 81-98% from Rock Slide + Eruption: the guide forbids it.

Trick Room sixes (j01, j02, j05, q007, q052, j20; seed 7700000): default lead 78%; Charizard + Conkeldurr / Sinistcha +
Pelipper 80% (+2 ±11); Sinistcha + Conkeldurr / Pelipper + Charizard 69% (−9). Default kept. Under Trick Room, Torkoal
(36) and Brave Golisopod (54) still move before Conkeldurr (58).

## 6. Adversarial set search: his worst tuned team (2026-11-11)

Sections 2-3 searched his sixes with default sets and weighted the anti-Anthony six (j07) at 6%. Here his three best
sixes vs yJ10 (q007, q052, j07) get every one-set change from his library (`gen_jacky_adv.py`, pool
`tools/sim/candidates/jacky-adv.json`), engine both sides, closed sheets.

- Stage 1 (50 variants x 24 games, our AI preview, seed 7800000): the j07 family is the danger, 21-42% (base 42%); the
  Trick Room bases q007 / q052 stay 54-100% under every set change. Changes did not stack (stage 2).
- Stage 2 (96 games each, guide preview, seed 7900000): **j07 as built is his worst team: 39% ±10** (29% into his
  Farigiraf + Lycanroc lead). Helping Hand Farigiraf 49%; adding Yawn Torkoal / other Golisopod sets 54-59%; his best tuned
  Trick Room sixes 69-79% (Sinistcha's Trick Room and rain hold).
- Stage 3, our four vs j07 + its Helping Hand variant (192 paired games, seed 8000000): Sinistcha + Conkeldurr /
  Pelipper + Rotom-Fan (no Charizard) **64%**, +13.5 ±8.8 over the guide's Lycanroc four (50%); Charizard + Rotom-Fan lead
  39%; every four without Pelipper 19-23%.
- The no-Charizard four is not a general Lycanroc answer: vs his default Lycanroc sixes (seed 7600000) 71% vs 78%
  (−7 ±12), and 44% vs 88% into Lycanroc + Mr. Rime (j03). It is the answer when Lycanroc and Rotom-Mow are both in his
  six: vs three default-set Lycanroc + Rotom-Mow sixes (288 paired games, seed 8100000) 80% vs 70%, +10.4 ±6.7 (Sash
  Lycanroc +19, Life Orb Brave Lycanroc −6 ±10).

Guide change: new first preview row `Lycanroc-Midnight+Rotom-Mow` brings Sinistcha, Conkeldurr, Pelipper, Rotom-Fan
(lead Sinistcha + Conkeldurr). Headline: his worst tuned team is ~40% for the old plan, ~64% with the new row. Rotom-Fan
holds its slot here: it is in the best four against his worst team.

## 7. The last two slots (2026-11-12)

Scouting: Klein (Calvin) says Jacky went hard Trick Room against him. Anthony and Klein judged Morpeko dead weight:
when the engine brought it, we won 34%, vs 65% when not (480 AI-preview games vs his worst teams).
- **Aegislash for Morpeko** is a tie: −1.7 ±5.4 (AI preview, worst teams); +2.1 ±5.4 vs six hard Trick Room teams (guide
  preview, seed 8300000). Bringing it over the default four costs 9-22 points: −10 for Rotom-Fan, −9 for Conkeldurr,
  −22 for Pelipper. The sim AI used Wide Guard 10 times in 411 chances, so Aegislash's Eruption block is undersold.
- **Rock Slide Mega Golisopod** is legal in Champions (9M) and was missing from his library. It does 104-123% to Mega
  Charizard Y and was added as `goliM_rs` in gen_jacky_adv.py. Mega Golisopod is Bug/Steel, so Electric is neutral on it.
- **Rotom-Fan in practice** (40 replayed games): about 3 turns on the field, about 52% damage dealt per game, mostly
  Thunderbolt finishing blows. It fainted in 17 of 40 games. Air Slash is its weakest move (16% per use).
- **Last-two-slots test.** 480 games per six vs 10 of his teams: aj07, sD, three Rock Slide Golisopod sixes (rs07,
  rsTR, rsTR2), aq007, aq052, and the hard Trick Room sixes t01, t05, t06. Guide preview, seed 8400000, paired:

| Six | Win % | Paired vs current | His TR up |
|---|---|---|---|
| Current yJ10 (Morpeko, Rotom-Fan) | 62 | — | 347 |
| Aegislash for Morpeko | 66 | +3.5 ±4.9 | 283 |
| + Will-O-Wisp Rotom-Fan (for Air Slash) | 71 | +9.0 ±5.2 | 285 |
| + Inner Focus Kangaskhan for Rotom-Fan | 74 | +11.7 ±5.4 | 239 |
| **+ Scrappy Kangaskhan for Rotom-Fan** | **78** | **+15.8 ±5.2** | **208** |
| Kangaskhan for Morpeko (keeps Rotom-Fan) | 63 | +1.0 ±5.2 | 318 |

Scrappy Kangaskhan vs Will-O-Wisp Rotom-Fan: +6.9 ±5.0. Scrappy lets Fake Out hit Mimikyu, so his Trick Room goes up
less often. It wins 92% vs the Rock Slide Golisopod + Mimikyu + Mr. Rime team, where Will-O-Wisp Rotom-Fan wins 23%;
vs the hard Trick Room sixes it wins 85-92%, against 88-98% for Will-O-Wisp Rotom-Fan. Kangaskhan's set: Silk Scarf,
Adamant, Fake Out / Double-Edge / Drain Punch / Protect. Never leave it facing Mega Golisopod: Close Combat does 121-143%.

## 8. Standings (league sheet, 2026-11-12)

Before Week 5: Calvin 3-0, Jacky 2-1, Hex 2-1 (beat Anthony 1-2), Anthony 1-2, ZhuZi 0-4. Assuming top 2 per pool
(Anthony is about 80% sure the playoffs are a top 4) and game +/- as the tiebreak, as the sheet's columns order it:
Anthony advances only if he beats Jacky **2-0** and Calvin beats Hex. That gives a three-way 2-2 tie with circular
head-to-head, and game diff Anthony +1, Jacky 0, Hex ≤ 0. A 2-1 win leaves Jacky +1 ahead of Anthony at 0.

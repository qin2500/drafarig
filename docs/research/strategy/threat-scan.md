# Worst-case threat scan (and a usage-bias audit)

Drafarig VGC Strategy, 2026-10-17. Prompted by Week 1 (lost 0–2 to Calvin): in G2, Calvin's **Tauros** Rock Slide took out Mega
Charizard Y and Rotom-Fan in one turn. Our plan had listed Tauros as "unlikely / no usage data".

- Script: `sp-assist/threat_scan.py` (scan) + `sp-assist/threat_report.py` (summaries) → `sp-assist/threat-scan-results.json`.
- Engine: `sp-assist/spcalc.py`. It still reproduces the app's 6 damage-engine test cases, and now models Sheer Force, Strong Jaw,
  Normal Gem, Light Ball and resist berries.
- League: sheet snapshot from 2026-10-15; re-read 2026-10-16, unchanged.

---

## 1. Post-mortem

**What the plan missed:**
- **Usage-only sets.** Calvin's sets were Smogon ladder defaults. Tauros has no ladder data, so it got a guessed set (Intimidate,
  Raging Bull, 178 Speed) and was dropped from every calc list.
- **"Unlikely" without a worst case.** A 2-point drafted mon was dismissed because nobody uses it on ladder. In a draft league the
  opponent chooses from exactly 10. A cheap pick is often there *because* it answers our team.
- **No learnset × ability × item scan.** Nothing checked "best legal attack, with best legal ability and a realistic item". The
  Charizard section listed only Mamoswine's Rock Slide (18% of ladder sets).

**Tauros, verified:**
- Calvin's pick is base **Tauros** (Kanto, Normal), 2 points (league sheet).
- Abilities: **Anger Point / Intimidate / Sheer Force** (`data/mechanics.json`, from Showdown).
- Stats: 75 / 100 / 95 / 40 / 70 / 110. Jolly 32 Spe = **178**, faster than our whole team except a Tailwind side.
- Rock moves in its Champions learnset: **Rock Slide, Rock Tomb, Stone Edge** (plus Sandstorm, Raging Bull, Double-Edge, Body Slam,
  Zen Headbutt, Throat Chop, Wild Charge, Close Combat, Earthquake, High Horsepower).

**Sheer Force mechanics** (Showdown master 3a766f2):
- ×5325/4096 on moves with secondary effects (`data/abilities.ts` L4203–4217).
- Life Orb's recoil is skipped while Sheer Force suppresses secondaries (`sim/battle-actions.ts` L538, `sim/battle.ts` L370–371),
  but Life Orb's ×5324/4096 damage boost stays.
- **Rock Slide qualifies** (30% flinch). Sheer Force removes the flinch, so a Sheer Force Life Orb Tauros gets free power with no drawback.

**Tauros Rock Slide**, 32 Atk, both of our mons targeted (spread ×0.75). Charizard is in sun (its Drought), which doesn't affect Rock.
Charizard: Modest 6/0/0/32/2/26, HP 159. Rotom-Fan: Modest 32/0/0/32/2/0, HP 157 (match-plan sets).

| Tauros | → Mega Charizard Y | → Rotom-Fan (32 HP) |
|---|---|---|
| **Sheer Force, Life Orb, Adamant** | **244–291 (153.5–183.0%), OHKO** | 94–112 (59.9–71.3%) |
| Sheer Force, Life Orb, Jolly | 224–265 (140.9–166.7%), OHKO | 88–104 (56.1–66.2%) |
| Sheer Force, Hard Stone, Adamant | 224–268, OHKO | 88–104 |
| Sheer Force, no item, Jolly | 172–204 (108–128%), OHKO | 68–80 |
| Intimidate, Life Orb, Adamant | 187–224 (118–141%), OHKO | 73–88 |
| Intimidate, no item, Jolly | 136–160 (86–101%), 6% | 52–62 |
| Sheer Force Life Orb, **crit** | — | 140–166 (89–106%), 31% |
| Sheer Force Life Orb vs a 2-HP Rotom-Fan | — | 74–88%; crit 110–131% (OHKO) |

**Reading it:**
- Any Tauros with Sheer Force, or Intimidate plus an item, OHKOs Mega Charizard Y with Rock Slide (4x).
- **Rock Slide alone does not OHKO a full-HP, 32-HP Rotom-Fan** (max 71%). The G2 double KO needed one of:
  - prior chip (Rotom at ≤ 71%),
  - a crit (31%),
  - a less bulky Rotom-Fan set,
  - a second hit from Tauros's partner.
- Unknown which. **Anthony: which Rotom-Fan set and HP?**
- Stone Edge (Sheer Force Life Orb) does 209–248% to Charizard and 83–97% to Rotom-Fan. Rock Tomb does 167–196% to Charizard.

## 2. The worst-case scan: rule set for the app

Run for **every form of every drafted opponent mon**: base forms and each Mega (Megas use the base learnset and their stone). The
targets are Anthony's 10 at his saved sets (else the match-plan defaults).

| Dimension | Rule |
|---|---|
| Moves | **The full legal Champions learnset** (`mechanics.json` learnsets), not usage. Damaging moves only. BP-0 moves (weight-based etc.) are skipped. Final Gambit counts as fixed damage. 2–5 hit moves use the 35/35/15/15 mix (Skill Link: 5). Triple Axel and Population Bomb are skipped for now |
| Abilities | **Every legal ability** of the form, evaluated separately |
| Items | Megas: their stone only. Others: Life Orb, Expert Belt, the move type's boosting item (×4915/4096), Muscle Band / Wise Glasses, none. Take the best per (move, target). **No Choice Band / Specs** (not in the M-C item pool, VERIFIED earlier). Normal Gem and Light Ball are modelled where legal |
| Spread | Max offence: 32 SP in the attacking stat + boosting nature (Adamant / Modest) |
| Field | Doubles. Spread moves ×0.75 (both targets assumed alive). Attack it under: (a) no weather; (b) every weather / terrain the opponent can set (Drought / Drizzle / Sand Stream / Snow Warning / Surge abilities anywhere on his roster); (c) **our own sun when the target is Mega Charizard Y** (Drought is up while it's in), and sun for Fire moves when Charizard is our partner. Terrain boosts grounded attackers only |
| Target state | Full HP. Multiscale / Disguise / Sash respected. Sash rows are shown as "Sash holds" and are not counted as KOs |
| Output per row | attacker form, ability, item, move, field, target, damage range (absolute and %), OHKO odds, plausibility, severity |

### Ranking (severity)
`severity = OHKO odds × plausibility × 1.25 if spread × 1.25 if priority`. Ties are broken by the minimum damage %.

**Plausibility** = move × ability × item:

| Factor | Form has ladder data | Form has **no** ladder data |
|---|---|---|
| Move | 1.0 if used ≥ 5%; 0.7 if STAB or ability synergy; else 0.5 | **0.9** if STAB, ability synergy or super-effective on the target; else 0.7 (no penalty for missing data) |
| Ability | 1.0 top ladder ability; **0.8 if it synergises with the move** (Sheer Force + secondary effect, Technician ≤ 60 BP, Tough Claws + contact, Adaptability + STAB, Sharpness + slicing, Iron Fist + punch, Strong Jaw + bite, Reckless + recoil, Punk Rock + sound, Skill Link + multi-hit, Huge Power, Aerilate, Water Bubble, Protean); else 0.3 | 1.0 with synergy, else 0.8 |
| Item | Stone 1.0; 1.0 if used ≥ 5%; Life Orb / none 0.9; others 0.8 | Life Orb / none 1.0; others 0.9 |

### What to show
1. **Every row that OHKOs Mega Charizard Y (≥ 50%) with plausibility ≥ 0.6.** Charizard is the 4x-Rock, win-condition mon.
2. **Spread moves that OHKO two of our mons at once (≥ 50% each).** These are the "double KO" warnings that cost G2.
3. **Priority moves that OHKO** (Sucker Punch, Aqua Jet, First Impression, Ice Shard…).
4. **Per opponent mon: the top 3 rows** by severity, Aegislash in Shield form by default (Blade only in an "after it attacks" column).
5. Each row: "Ladder set" vs "Worst case (learnset)" labels, and "Sash holds" where relevant.

## 3. Goldens for tests (exact; our sets as in §1; max-offence attackers)

| # | Attacker | Move | Target | Range | Result |
|---|---|---|---|---|---|
| G1 | Calvin's Tauros, Sheer Force, Life Orb, Adamant 32 Atk | Rock Slide (spread) | Mega Charizard Y | 244–291 / 159 | OHKO 16/16 |
| G2 | same | Rock Slide (spread) | Rotom-Fan 32 HP | 94–112 / 157 | 0/16 (crit 140–166: 31%) |
| G3 | Hex's **Kleavor**, Sheer Force, Life Orb | Rock Slide (spread) | Mega Charizard Y / Rotom-Fan | 284–337% / **110.8–130.6%** | **Double OHKO** (the Tauros scenario, done by Kleavor) |
| G4 | Jacky's **Torkoal**, Drought, Charcoal, Modest | Eruption (spread, sun) | Aegislash Shield / Sinistcha (Calm, Coba) | 216–254 / 167; 236–278 / 178 | OHKO both (also Conkeldurr, Stunfisk-Galar, Morpeko) |
| G5 | Data's **Mega Starmie**, Huge Power | Aqua Jet (priority, rain from Politoed) | Mega Charizard Y | 230–272 / 159 | OHKO |
| G6 | Ning's **Toucannon**, Skill Link, Life Orb | Rock Blast (5 hits) | Rotom-Fan | 195–235 / 157 | OHKO |
| G7 | Calvin's Mamoswine, Life Orb, Adamant | Icicle Crash | Rotom-Fan | 198–234 / 157 | OHKO |

## 4. League-wide top threats (worst case; Aegislash Shield; Sash excluded)

| # | Opponent | Threat | Into | Damage |
|---|---|---|---|---|
| 1 | Taro | Tyranitar (Sand Stream, Life Orb) Rock Slide, spread | Mega Charizard Y | 216–255% |
| 2 | Taro | Mega Tyranitar Rock Slide, spread | Mega Charizard Y | 191–229% |
| 3 | ZhuZi | Toxtricity (Punk Rock, Life Orb) Overdrive, spread | Simipour (Charizard 95–113%) | 165–195% |
| 4 | ZhuZi | Metagross (Life Orb) Explosion, spread | Charizard, Simipour (Rotom-Fan 62%) | 120–142% / 149–175% |
| 5 | Taro | Salamence / Excadrill Rock Slide, spread | Mega Charizard Y | 147–174% |
| 6 | Data | Mega Starmie (Huge Power) Aqua Jet, rain, priority | Mega Charizard Y | 145–171% |
| 7 | Hex | Garchomp Rock Slide (spread) / Earthquake (into Aegislash) | Charizard / Aegislash | 144–170% |
| 8 | 17 | Dragonite (Life Orb) Rock Slide, spread | Mega Charizard Y | 144–170% |
| 9 | Calvin | Mamoswine (Life Orb) Rock Slide (spread) / Icicle Crash | Charizard / Rotom-Fan | 144–170% / 126–149% |
| 10 | Jacky | Torkoal (Drought, Charcoal) Eruption, spread | Aegislash, Sinistcha, Conkeldurr, Stunfisk-Galar, Morpeko | 101–156% |

Also flagged:
- Hex's **Kleavor (Sheer Force) Rock Slide double-KOs Charizard + Rotom-Fan** (G3).
- Calvin's Tauros (G1).
- Data's Politoed Muddy Water (rain) OHKOs Charizard and Stunfisk-Galar.
- Data's Araquanid (Water Bubble) Hydro Pump in rain: 250–296% on Charizard, 135–160% on Rotom-Fan.

**Takeaway:** **39 opponent forms, across all 9 coaches, can OHKO Mega Charizard Y with a spread Rock Slide** at max offence. 26 of
them pass the plausibility ≥ 0.6 bar. Calvin alone has Tauros, Mamoswine and Empoleon. Charizard needs Wide Guard support (Aegislash, Pelipper) or Protect in every lead where a Rock-Slider is
possible, not only when ladder data says Rock Slide is common.

## 5. Usage-bias audit (where ladder usage stood in for draft value), ranked by Week-1 impact

| Rank | Where | Bias | Fix |
|---|---|---|---|
| 1 | Match plan "likely 6" and "Tauros, Swalot: unlikely / no data" (`match-calvin.md` §1) | No-data drafted mons dismissed, guessed sets | **Never mark a drafted mon unlikely without its worst-case row** (§2). Likely-6 = matchup value against *our* team (threat scan + what it answers), not draft cost or ladder usage |
| 2 | Teambuilder defence marks (top 4 opponent mons by ladder usage × single highest-BP move; `lib/prep-build.mjs` `defaultPins` sorts by `usagePct`, no-data = −1) | Tauros could never be pinned; Rock Slide (not its highest BP) never chosen | Pins from the worst-case scan ranking (severity), incl. spread and 4x moves; no-data mons ranked like any other |
| 3 | Opposing "ladder guess" sets in calcs / prep (`prep-model.mjs` source `ladder`, rank 2) | Shown as *the* set | Show two labelled scenarios: **Ladder set** and **Worst case (learnset × ability × item)**; default to the worst case for KO / survive warnings |
| 4 | Our research calcs (`league_calc.default_set`, bulk score, `benchmarks-league.md`) | Forms without usage data skipped (16 drafted forms, incl. Tauros); moves < 15% ignored | Include every drafted form with the worst-case rule; move threshold only as a ranking weight |
| 5 | Cores (`cores.json` "likely" requires usage keyMoves; learnset-only = "possible", folded) | Real draft plans hidden | Show "possible" cores when they are the opponent's best answer to our roster; fold only by plausibility, not by usage |
| 6 | Threat lists / danger score (`lib/analysis.mjs` `TIER_VALUE` in the danger formula) | Ladder tier weights the danger | Danger = worst-case KO coverage of our roster (scan severity), tier only as a tie-break |
| 7 | Optimizer value term (`rosterScore` uses `TIER_VALUE`) and `pokemon.json` tiers | Draft value = ladder viability | For picks, weight matchup value against the actual 9 opposing pools (what it KOs or walls among drafted mons) above ladder tier |

## 6. Questions
- Anthony's actual Rotom-Fan set and HP in G2, and whether a crit or Tauros's partner hit Rotom-Fan too. This decides whether the
  bulk numbers need revising.

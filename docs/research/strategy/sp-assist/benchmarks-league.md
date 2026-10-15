# League benchmarks for Anthony's roster

Drafarig VGC Strategy, 2026-10-15. These are the top 3–5 SP benchmarks per Pokémon that matter against the **actual league
opponents**. The method and benchmark types are in `benchmarks-method.md`. The calculator and its checks are `spcalc.py`, and
the full output comes from `bench.py` (rerun to refresh).

**League state:** live sheet read with the repo's `lib/sheet.mjs` + `lib/league.mjs` at **2026-10-15 04:02 UTC**, saved as
`league-2026-10-15.json`. The draft is complete (10 picks each). One sheet typo: 17's "Hisiuan Goodra" didn't match automatically;
I treat it as Goodra-Hisui.

**Anthony:** Charizard, Sinistcha, Pelipper, Kangaskhan, Aegislash, Morpeko, Conkeldurr, Rotom-Fan, Stunfisk-Galar, Simipour.

**Opponent sets:** Smogon usage defaults (`gen9championsvgc2026regmc`, ladder ≥ 1760, Sept 2026). For each form: the top-3 spreads
weighted, the top item and ability, and moves used by ≥ 15%. 16 drafted forms have no usage data (e.g. Banette base, Tauros, Avalugg,
Emolga, Arbok, Dedenne). They are left out of the KO and survive lists below and need the "unknown set: range" default in the app.

**Anthony's sets are ASSUMED** (the app's saved sets aren't readable from here). I used each mon's most common usage set, or a
stated guess where there's no data:

| Mon | Assumed set (Nature: HP/Atk/Def/SpA/SpD/Spe) | Item | Basis |
|---|---|---|---|
| Mega Charizard Y | Timid 2/0/0/32/0/32 | Charizardite Y | modal usage spread (8.5%) |
| Sinistcha | Bold 32/0/14/0/20/0 | Sitrus Berry | modal usage spread |
| Pelipper | Modest 2/0/0/32/0/32 | Focus Sash | top usage spreads |
| Mega Kangaskhan | Brave 32/32/1/0/1/0 | Kangaskhanite | modal usage spread |
| Aegislash (Blade when attacking) | Adamant 2/32/0/0/0/32 | Life Orb | modal usage spread |
| Morpeko | Jolly 2/32/0/0/0/32 | Focus Sash | modal usage spread (70%) |
| Conkeldurr | Brave 32/32/0/0/2/0, Iron Fist | Life Orb | modal usage spread |
| Rotom-Fan | Modest 32/0/0/32/2/0 | Life Orb | the "O2" build from rotom-fan-case.md (no usage data) |
| Stunfisk-Galar | Brave 32/32/2/0/0/0 | Sitrus | guess: Trick Room tank (no usage data) |
| Simipour | Modest 2/0/0/32/0/32 | Mystic Water | guess (no usage data) |

Reading the tables:
- **Speed** benchmarks show the SP needed to be *strictly faster* than a value.
- **KO** means OHKO at ≥ 15/16 over the target's top-3 spreads.
- **Survive** means the hit OHKOs ≤ 1/16 of the time. "Now" is the odds against the assumed set.
- Survive costs are **total SP in HP + that defence**. When the set is already at 64–66 SP, the cost has to come out of Speed or
  attack, and the table says what's given up.
- Focus Sash (Pelipper, Morpeko) already covers full-HP OHKOs, so their survive benchmarks only matter for a non-Sash set or after chip.

---

## 1. Mega Charizard Y: speed creep targets (requested)

Mega Charizard Y is base 100. Champions Speeds: **Timid 32 = 167**, Timid 24 = 158, Timid 20 = 154, **Modest 32 = 152**, Modest 0 = 120.
The new Speed applies from the turn it Mega Evolves. The ladder below lists every league opponent Speed that is common (≥ 3% of
that form's usage spreads) between 119 and 168, and the SP needed to be strictly faster. Choice Scarf is applied where it's the
form's majority item.

| Opponent Speed | Modest SP | Timid SP | Who (coach, share of that form's spreads) |
|---|---|---|---|
| 132 | 13 | 1 | Calvin's Mamoswine (32%), 17's Venusaur (58%) and Blaziken (36%) |
| 137 | 18 | 6 | Hex's Kleavor (22%), Taro's Samurott-H (20%), DingDing's Malamar |
| 140 | 21 | 9 | **Taro's Excadrill (58%)** |
| 143–145 | 24–26 | 11–13 | DingDing's Basculegion (27%), Calvin's Basculegion-F, ZhuZi's Krookodile (26%), Calvin's Mamoswine (31%) |
| 149–151 | 30–32 | 17–19 | Ning's Gholdengo, **Hex's Kleavor (49%)**, Taro's Samurott-H (52%), Data's Archaludon, Rotom-Heat/Wash |
| **152** | **unreachable (Modest 32 ties)** | 20 | **17's Mega Dragonite (41%) and Mega Blaziken (48%)**, Taro's Salamence |
| 154 | − | 21 | **Hex's Garchomp (19%)**, Taro's Excadrill (17%) |
| 156–157 | − | 23–24 | Ning's Lucario (42%), **ZhuZi's Mega Metagross**, Taro's Salamence, 17's Pawmot, Data's Espathra / Mega Starmie |
| 158–162 | − | 25–29 | ZhuZi's Krookodile (20%), Taro's Tinkaton, Jacky's Mimikyu (12%), DingDing's Zoroark-H (12%), Data's Mega Raichu-X |
| 164–166 | − | 30–32 | Ning's Mega Lucario, Taro's Serperior, ZhuZi's Infernape |
| 167 | tie at Timid 32 | tie | Taro's Salamence (19%), 17's Mega Dragonite (5%) / Mega Blaziken (8%), Data's Starmie |

Usage-weighted share of all league-opponent spreads beaten:

| Nature | 0 SP | 8 | 16 | 20 | 24 | 28 | 32 |
|---|---|---|---|---|---|---|---|
| Timid | 57% | 62% | 65% | 70% | 72% | 73% | 73% |
| Modest | 51% | 55% | 59% | 62% | 65% | 65% | 69% |

Under Pelipper's Tailwind even 0-SP Modest (240) beats every listed spread, unless they have Tailwind too.

**Benchmarks:**
1. **Timid 21 SP (155) beats Hex's neutral Garchomp (154) and Taro's Excadrill (154).** That's the cheapest "beat the 154 crowd" point.
2. **Timid 24 SP (158) beats the 157 cluster** (Mega Metagross, Pawmot, Salamence, Espathra, Mega Starmie). After that the curve is flat
   (72% → 73% from 24 to 32 SP). **8 SP can move into HP for almost no Speed loss.** Only the 162 group (Mimikyu, Zoroark-H, Mega Raichu-X)
   and Mega Lucario / Serperior are lost.
3. **Modest 32 SP lands exactly on 152**, the most common Speed of 17's Mega Dragonite and Mega Blaziken: a coin flip. If you run
   Modest, either accept losing to them or stop at 31 SP and spend the rest on bulk.
4. **What Modest buys (KO, sun on):** Heat Wave on Hex's Kleavor goes from 76% to ≥ 94% at Modest 16 SpA. Weather Ball on Data's Espathra
   goes from 92% to ≥ 94% at Modest 18. Mega Raichu-X (Data) goes from 74% to ≥ 94% at Modest 26, and Sableye (DingDing) from 58% at Modest 31.
   Timid 32 already OHKOs Sneasler, Kingambit, Mega Metagross and Pawmot, and those need only 3–11 SpA. Mimikyu's Disguise
   blocks the first hit.
5. **Survive (costs Speed or SpA):** DingDing's Basculegion Wave Crash OHKOs 91% now. 21 Def SP (Timid), or Bold 11, survives it, but
   sun already halves it, so the 91% is with sun up. Spread Rock Slide (4x) from Sneasler, Mamoswine or Excadrill needs 27–30 Def SP. That
   isn't worth it; position around it instead.

## 2. Sinistcha (Bold 32/0/14/0/20/0, Sitrus)

| # | Benchmark | Now | Cost |
|---|---|---|---|
| 1 | Survive Hex's Armarouge Heat Wave (spread, Fire 2x) | 75% OHKO | Calm, 21 HP / 30 SpD: shifts Def into SpD, so you lose the physical benchmarks below |
| 2 | Survive Calvin's Basculegion-F Shadow Ball | 47% | Calm 14 HP / 31 SpD (45 SP) |
| 3 | Survive Calvin's Mega Staraptor Brave Bird | 29% | Bold 31 HP / 28 Def |
| 4 | Survive Taro's Mega Salamence Double-Edge (Aerilate) | 25% | Bold 25 HP / 27 Def |
| 5 | Survive ZhuZi's Dragapult Shadow Ball | 27% | Calm 14 HP / 31 SpD |

Takeaway: Sinistcha can't cover both its Fire/Ghost special threats and its Flying physical threats. Pick the SpD or Def lean per
opponent (Hex/Calvin/ZhuZi: Calm; Taro/Calvin Mega Staraptor: Bold). That's a prep-week decision, not a season-long spread. The
Colbur and Kasib resist berries in Sinistcha's usage data (30% / 12%) exist for the same reason.

## 3. Pelipper (Modest 2/0/0/32/0/32, Focus Sash)

| # | Benchmark | Now (no Sash) | Cost |
|---|---|---|---|
| 1 | Survive Taro's Mega Salamence Draco Meteor | 100% | Calm 2 HP / 10 SpD (12 SP), or 22 SP keeping Modest |
| 2 | Survive Hex's Garchomp-Z Power Gem | 90% | Calm 2 / 10, or Modest 22 SP |
| 3 | Survive 17's Venusaur Leaf Storm | 89% | Calm 2 / 6 |
| 4 | Survive Data's Archaludon Draco Meteor | 66% | Calm 2 / 12 |
| 5 | KO: rain Hurricane on Ning's Rillaboom | 100% | needs only 23 SpA; Weather Ball on Calvin's Volcarona needs only 12 |

Takeaway: about 10–12 SpD SP plus Calm turns four common special OHKOs into survivals, and Pelipper's KO benchmarks need only 12–23
SpA with Modest (Calm loses the 10%, so recheck the KOs). A **Calm or Bold Sitrus Pelipper** frees its item slot from Focus Sash. That matters for item clause, because Rotom-Fan and
Conkeldurr both want Life Orb in these assumptions.

## 4. Mega Kangaskhan (Brave 32/32/1/0/1/0)

| # | Benchmark | Now | Cost |
|---|---|---|---|
| 1 | Survive Calvin's Mega Staraptor Close Combat | 55% OHKO | Bold with the same 33 SP (13 HP / 20 Def), losing Brave's +10% Atk; or keep Brave and add 14 SP (15 HP / 32 Def) |
| 2 | Survive 17's Dragonite Superpower | 62% | Bold 0 HP / 25 Def |
| 3 | Survive Taro's Sneasler Close Combat | 92% | Bold 15 HP / 29 Def (44 SP): probably not worth it |
| 4 | KO Taro's Mega Salamence with Ice Punch | ≥ 94% | needs only 13 Atk (base Salamence after Intimidate: 24 Atk) |
| 5 | KO Mega Raichu-Y / Ninetales-A / Whimsicott with Double-Edge | ≥ 94% | needs only 5–10 Atk |

Takeaway: Parental Bond over-delivers on most KOs. **6–19 Atk SP are free** against this league, depending on which KOs you keep:
Venusaur's Double-Edge needs 26 and Mega Blaziken's needs 23. Those SP buy the Mega Staraptor Close Combat survival (Calvin). Speed: Brave 0 SP = 108 for Trick Room (Sinistcha). Jolly 32 = 167 instead would beat Rillaboom (150)
and Basculegion (143) from 18 / 11 SP.

## 5. Aegislash (Adamant 2/32/0/0/0/32; Blade forme stats when attacking)

| # | Benchmark | Now | Cost / note |
|---|---|---|---|
| 1 | Outspeed Jacky's Incineroar and Farigiraf, and Calvin's Grimmsnarl (common max 80) | yes | needs only 1 Spe SP |
| 2 | Outspeed Hex's Indeedee-F (105) / DingDing's Kingambit (102) / Ning's Milotic (101) | yes (at 32) | 26 / 23 / 22 SP. **6–10 Speed SP are spare** if Indeedee isn't a target |
| 3 | Survive Jacky's Mega Golisopod Liquidation | 81% | 11 Def SP (Adamant), or Bold 1 / 4 |
| 4 | Survive ZhuZi's Mega Metagross Steel Roller | 89% | 12 Def SP |
| 5 | KO Calvin's Grimmsnarl (Iron Head), DingDing's Whimsicott (Poltergeist), ZhuZi's Mega Metagross (Poltergeist) | ≥ 94% | need only 2–4 Atk SP |

Caveat: these survive numbers use Blade forme defences (50/50). With King's Shield up first it's Shield forme. The app's wrapper rule
W-AEGISLASH-FORME handles that. `mechanics.json` has no Aegislash-Blade species, so I added it from Showdown `data/pokedex.ts` L12820–12827.

## 6. Morpeko (Jolly 2/32/0/0/0/32, Focus Sash)

| # | Benchmark | Now | Cost |
|---|---|---|---|
| 1 | Outspeed the 157 cluster (Mega Metagross, Pawmot, Salamence) | 163 beats it | Jolly 27 SP is enough (158) |
| 2 | KO DingDing's Basculegion and Calvin's Basculegion-F with Aura Wheel | ≥ 94% | Jolly 19 Atk / Adamant 7 |
| 3 | KO Calvin's (Scarf) Staraptor with Aura Wheel | ≥ 94% | Jolly 23 Atk |
| 4 | Survive Ning's Rillaboom U-turn (no Sash) | 67% | 13 Def SP |
| 5 | Survive Hex's Garchomp-Z Dragon Pulse (no Sash) | 65% | 13 SpD SP |

## 7. Conkeldurr (Brave 32/32/0/0/2/0, Iron Fist, Life Orb)

| # | Benchmark | Now | Cost |
|---|---|---|---|
| 1 | **Trick Room order:** Brave 0 Spe = 58 | moves before Jacky's Incineroar / Farigiraf (72+), DingDing's Kingambit / Sableye (63+) and Mega Golisopod's modal 60; after Torkoal (36), Slowking-G (45) and Stunfisk-G (46) | keep 0 Spe and −Spe |
| 2 | KO Jacky's Incineroar with Drain Punch | 97% | needs 28 Atk |
| 3 | KO DingDing's Kingambit with Mach Punch (priority) | ≥ 94% | needs 21 Atk |
| 4 | Survive Taro's Mega Salamence Double-Edge | 94% OHKO | Bold 3 HP / 28 Def |
| 5 | Survive Calvin's Mega Staraptor Brave Bird | 73% | Bold 13 HP / 25 Def |

## 8. Rotom-Fan (Modest 32/0/0/32/2/0, Life Orb). See rotom-fan-case.md

| # | Benchmark | Now | Cost |
|---|---|---|---|
| 1 | KO Calvin's Mega Staraptor (Thunderbolt) at +0 before its Close Combat | 99% of field | 20 SpA (Modest + Life Orb) is enough for 94% |
| 2 | Survive Calvin's Mamoswine Icicle Crash | 50% | Bold 28 HP / 7 Def, or freed SpA (Nasty Plot build) |
| 3 | Survive Data's Mega Starmie Ice Spinner | 46% | Bold 26 HP / 3 Def |
| 4 | Survive Hex's Kleavor Stone Axe | 100% | Bold 28 HP / 27 Def (55 SP): unreachable while keeping SpA |
| 5 | Final Gambit (Calvin's Scarf Staraptor) | always KOs | no SP fixes it |

## 9. Stunfisk-Galar (Brave 32/32/2/0/0/0, guessed set)

| # | Benchmark | Now | Cost |
|---|---|---|---|
| 1 | Trick Room order: Brave 0 Spe = 46 | slower than Golisopod-Mega (54) and Kingambit (63); only Torkoal (36) and Slowking-G (45) are slower | — |
| 2 | Survive Calvin's Mega Staraptor Close Combat | 51% | Bold 9 HP / 21 Def |
| 3 | Survive Calvin's Empoleon Hydro Pump | 98% | Calm 0 HP / 26 SpD |
| 4 | Survive Jacky's Torkoal Eruption (sun) | 100% | Calm 0 / 30 SpD |
| 5 | KO Calvin's Jolteon / Data's Raichu with Stomping Tantrum | ≥ 94% | 21 / 9 Atk |

## 10. Simipour (Modest 2/0/0/32/0/32, guessed set)

| # | Benchmark | Now | Cost |
|---|---|---|---|
| 1 | KO Taro's Mega Salamence with Ice Beam | ≥ 94% | needs only 5 SpA |
| 2 | KO Hex's Garchomp with Ice Beam | ≥ 94% | 12 SpA |
| 3 | Survive Taro's Mega Salamence Draco Meteor | 100% | Calm 2 HP / 7 SpD |
| 4 | Survive Data's Archaludon Draco Meteor | 61% | Calm 2 / 8 |
| 5 | Speed: Modest 32 = 153 beats the 150–152 cluster | yes | — |

---

## Cross-roster observations
- **Calvin's Mega Staraptor is the league's most-repeated physical benchmark** for Anthony (Sinistcha, Kangaskhan, Conkeldurr,
  Stunfisk-G). Whether Calvin runs Mega or Scarf Final Gambit is unknown under scenario A, and it changes every one of them.
- **Over-investment is common in default spreads:** Kangaskhan (Atk), Aegislash (Atk and Speed), Pelipper (SpA) and Charizard-Y
  (Timid 24–32 Speed) all reach their league KO and speed targets with SP to spare. The dashboard's "dead SP" check (method B6) should
  surface these first.
- **Item clause:** Life Orb is assumed on Aegislash, Conkeldurr and Rotom-Fan, and only one can hold it.

## Uncertainties
- Opponent sets are ladder usage defaults, not these coaches' sets. Low-usage forms (≤ 0.3%) have small samples.
- Anthony's sets are assumptions. The real numbers come from his saved sets in the app.
- No crits, accuracy, Intimidate on the attacker, Sitrus/Leftovers, or partner support (Helping Hand, screens) in the survive lists
  unless stated. Weather is Anthony's own where it applies (sun for Charizard-Y, rain for Pelipper / Simipour).
- Variable-power moves (Knock Off's item bonus, terrain-boosted Expanding Force, weight-based moves) are at base power or skipped.

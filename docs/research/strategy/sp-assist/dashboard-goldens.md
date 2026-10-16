# Build dashboard: goldens for Mega Charizard Y and the bulk score

Drafarig VGC Strategy, 2026-10-15. These are reference numbers for the Developer's tests. All of them come from `spcalc.py`, which
reproduces the app's 6 engine goldens, using the scripts named in each section. Showdown references are master 3a766f2 (2026-10-13).

## 1. Mega Charizard Y

### Mechanics (VERIFIED)
- **Drought is active on the Mega turn, before any move.**
  - Mega Evolution is a queue action of order 104, while moves are 200 (`sim/battle-queue.ts` L182–186).
  - `runMegaEvo` calls `formeChange(…, isPermanent=true)` (`sim/battle-actions.ts` L1889–1893).
  - For permanent forme changes, that calls `setAbility` (`sim/pokemon.ts` L1480–1487).
  - `setAbility` fires the ability's `Start` event (`sim/pokemon.ts` L1941–1943).
  - Drought's `onStart` sets `sunnyday` (`data/abilities.ts` L1088–1092).
  - **So the first turn's attacks already get sun**, both Charizard's own and its partner's. Exception: an opposing weather that
    starts later that turn (another Mega weather setter acting later in speed order) overrides it.
- **Sun** multiplies Fire damage by 1.5 and Water by 0.5 (`data/conditions.ts` sunnyday L554–566). It lasts 5 turns, or 8 with Heat
  Rock (L547–549).
- **Solar Beam** skips its charge turn in sun (`data/moves.ts` L17224+, `onTryMove`). Its power is halved in rain, sand or snow, and
  sun doesn't boost it. Without sun it does the **same damage, but one turn later**.
- **Solar Power** belongs to base Charizard (×1.5 SpA in sun, −1/8 HP per turn; `data/abilities.ts` L4397–4409). Mega Charizard Y's
  only ability is Drought, so **Solar Power never applies to the Mega**. The app must use Mega stats (SpA 159, SpD 115) and
  ability Drought once Charizardite Y is held and Mega is selected.
- **Weather Ball** in sun is Fire with 100 BP. Without weather it's Normal with 50 BP (no STAB for Charizard).
- **Heat Wave** takes ×0.75 only when it actually hits 2 targets. With a lone target there's no reduction (the app's wrapper rule
  W-LONE-TARGET-SPREAD).

### Goldens
Attacker: Modest 2/0/0/32/0/32, Charizardite Y, Drought → SpA 232, Spe 152. Targets: the modal Smogon ladder spread for each form in
Calvin's pool, with its top item and ability. Full HP, no crit. Script: `zard_goldens.py`.

| # | Target (spread, item) | Move | Sun | No sun |
|---|---|---|---|---|
| G1 | Grimmsnarl Careful 32/0/19/0/15/0, Light Clay, HP 202 | Heat Wave (spread ×0.75) | **115–136** (56.9–67.3%) | **76–91** (37.6–45.0%) |
| G2 | Mega Staraptor Jolly 29/1/0/0/4/32, HP 189 | Heat Wave (spread) | **123–145** (65.1–76.7%) | **82–97** (43.4–51.3%) |
| G3 | Tsareena Jolly 2/32/0/0/0/32, Wide Lens, HP 149 | Weather Ball (single) | **336–396**, OHKO 16/16 (Fire 100 BP, 2x) | **38–45** (Normal 50 BP) |
| G4 | Basculegion-F Modest 0/0/1/32/1/32, Life Orb, HP 195 | Solar Beam | **218–258**, OHKO 16/16, fires at once | same 218–258, but **charges a turn** |
| G5 | Volcarona Bold 32/0/32/0/2/0, HP 192 | Heat Wave (spread, resisted) | 109–130 | 73–87 |

Full 16-roll lists:
- G1 sun: [115,117,118,120,120,121,123,124,126,127,129,130,132,133,135,136]
- G1 no sun: [76,78,79,79,81,81,82,84,84,85,85,87,88,88,90,91]
- G3 sun: [336,338,342,348,350,354,360,362,366,372,374,378,384,386,390,396]

A test that gets the no-sun numbers while Charizardite Y is held and Mega is selected has the Drought bug the dashboard shows now.

### Creep targets for Mega Y
These are already in `benchmarks-league.md` §1.
- **Timid 21 (155)** beats the 154 group: Hex's neutral Garchomp and Taro's Excadrill.
- **Timid 24 (158)** beats the 157 group: Mega Metagross, Pawmot, Salamence, Espathra and Mega Starmie. Past 24 SP the league share
  only moves from 72% to 73%.
- **Modest 32 = 152 ties** 17's Mega Dragonite (41% of its spreads) and Mega Blaziken (48%). Use Modest 31, or Timid.
- Under Pelipper's Tailwind, even Modest 0 (240) beats every listed spread.

## 2. Bulk score: "expected OHKOs from common hits"

**Definition** (implemented in `league_calc.py` `default_set`/`weighted_ko` and `bulk_score.py`):
1. **Attackers:** every drafted species in the scope (one opponent's 10 for "this matchup", or all 9 opponents for "league"), plus
   **every Mega form** of each drafted species, each as a separate attacker. Forms without ladder usage data are skipped and the skip
   count is reported.
2. **Attacker set** (per form, from Smogon chaos `gen9championsvgc2026regmc-1760`, month shown):
   - the top-3 spreads, weights renormalised to 1;
   - the top item and the top ability (as their usage ids);
   - no boosts.
3. **Hits:** moves with ≥ 15% usage for that form that are damaging, with BP > 0 at face value. Final Gambit is included as fixed
   damage equal to the attacker's HP. Weight-based moves (BP 0) are dropped.
4. **Context:**
   - Moves targeting `allAdjacent` / `allAdjacentFoes` take ×0.75.
   - No weather, terrain, screens, Helping Hand, Intimidate or crits. Accuracy is ignored.
   - The defender is at full HP (Multiscale and Disguise apply).
   - 2–5 hit moves use the 35/35/15/15 hit-count mixture (`sim/battle-actions.ts` L861–867).
5. **Per hit:** OHKO odds = Σ over spreads of weight × Σ over hit counts of weight × (rolls ≥ defender HP) / rolls. The rolls are the 16
   equiprobable random factors, convolved across hits for multi-hit moves. A roll exactly equal to the defender's HP counts as a KO
   (≥). Ties in Speed don't matter, because order is ignored.
6. **Score** = Σ of OHKO odds over all hits, unweighted by move or species usage. Show beside it "hits with OHKO odds ≥ 50%" and the
   per-hit list. A 2HKO version (two uses, same hit count, no recovery) is optional.

**Goldens: Calvin only** (42 hits; `python3 bulk_score.py Calvin`):

| Rotom-Fan build | Score | Nonzero hits |
|---|---|---|
| O1 Modest 2/0/0/32/0/32 | **2.5235** | Staraptor Final Gambit 100%, Basculegion-F Ice Beam 52.3%, Mamoswine Icicle Crash 100% |
| O2 Modest 32/0/0/32/2/0 | **1.5031** | Final Gambit 100%, Icicle Crash 50.3% |
| N16 Modest 32/0/14/16/4/0 | **1.1266** | Final Gambit 100%, Icicle Crash 12.7% |

League-wide (all 9 opponents, 394 hits; `rotom_bulk.py`): O1 **16.02**, O2 **3.95**, N16 **2.53**.

# Builder and per-mon dashboard: UX spec

Version 2, 2026-10-15 (Rotom-Fan mockup now uses VGC Strategy's reference numbers). Author: Drafarig UI UX (spec and mockup only, no code). Designed against branch `cloud-checkpoint` (cloud v6, `cda8f0a`), read with `git show`; none of its code was run. The local `public/` in this worktree is older and was **not** used as the base.

**Anthony's request:** a Showdown-style teambuilder with:
- the drafted 10 in one section, and the chosen 6 as Showdown-like team cards;
- one tap on a mon opens a full dashboard for it: set editor, speed tiers and creep targets, damage calcs including +1/+2, KO benchmarks ("how much SpA to guarantee an OHKO on X, with the right nature, at +2"), and matchup facts inline.

**The case that drives the design:** is Nasty Plot worth it on Rotom-Fan? It might let Rotom-Fan OHKO common Mega Staraptor sets while freeing SP for bulk. So the core interaction is **comparing set options as offense-versus-bulk trade-offs**.

Champions rule used throughout: Stat Points (SP), at most 32 per stat and 66 in total. Stats at Lv 50 are base + SP + 20 (HP: base + SP + 75), with nature ×1.1/×0.9 (`lib/calc/stats.mjs statValue`).

---

## 1. Audit: what already exists (reuse, don't rebuild)

Battle Prep (`#prep`) is a full app inside Drafarig. Nearly every engine piece the dashboard needs already exists. What's missing is **one screen that puts them together around one of your mons, plus side-by-side options.**

| Area | What exists (file) | Notes for the builder |
|---|---|---|
| **Routes** | `lib/prep-route.mjs`: `#prep/<p>v<o>[/brief\|plan\|sets\|calcs\|practice]`, detail sheets `/their/<n>`, `/your/<n>`, `/core/<id>`, and `#prep/my-sets[/<setId>\|/import]`; legacy `#prep/w/<wsId>/<kind>/<id>` | Seats in the URL, never names or data. Peers replace and drill-downs push (`navKind`). |
| **Set storage** | `lib/prep-schema.mjs`, `lib/prep-model.mjs`: a set is a **lineage** `{id, side:'mine'\|'theirs', speciesId, name, currentV, versions:[{v, at, reason, data:{item, ability, nature, moves[4], sp}, provenance}]}`. Your sets live in `drafarig.prep.mysets` (shared by all opponents). Their sets, versions of their team, `my6` (set ids), `shortlist` (species) and calcs live per workspace (`drafarig.prep.ws.<id>`, one per *your coach × opponent*). | Versions are **immutable**: every save is a new version. Calcs that used the old version show as out of date. Their SP may be `'unknown'`, which shows as a range. All of it is device-local `localStorage`, with autosave, revision checks, multi-tab conflict banners and read-only mode for a newer schema. |
| **Set editor** | `public/prep-sets.js editor()`: item/ability/nature/moves (legal lists from `lib/calc/mech.mjs`), SP grid with ± steppers, a 66-point meter (`spMeter`), Lv 50 stats with and without Mega, legality errors, a draft that survives reload, Save version / Save as a new set / Discard, history with "Use this version", Copy as Showdown text, "Used by N calcs". | Reuse as the dashboard's first section. Today it is a private function; it needs exporting (or an `editorBody` split). |
| **Team grids** | `prep-sets.js tab()` / `myTeamRows()`: their team and your roster as `setgrid` tiles with a **set ring** (four quarters: item/ability/moves/SP, styled by source). Your roster tiles show set chips; tapping one toggles it into `my6` (✓). The Brief has a **"Your 6" tray** (`prep-matchup.js tray`, built from `sixOf` = shortlist ∪ my6 species). | The builder's roster section and 6 slots should read and write **the same** `my6`/`shortlist`. No new store. |
| **Import/export** | `lib/paste.mjs` + `importScreen`: Showdown paste with four tiers. Every decision is visible, legacy EVs are converted to SP and shown, duplicates offer "new set / new version of…". `exportScreen`: exact Showdown text, warnings for unknown SP or guessed fields, choice of ladder spread or max for unknown SP; labels and notes are never exported. | The builder gets "Paste your team" and "Export your 6" buttons that open these screens. |
| **Calc engine** | `public/vendor/smogon-calc-0.12.0.mjs` (MIT, pinned sha256), loaded only via `prep-engine.js importEngine()` when a calc screen opens. `lib/calc/wrapper.mjs createCalc` → `calc.run(sc)`, `calc.envelope(sc, side)` (**frail / common / max** rows for unknown SP), `calc.spreadFor`. | Rule to keep: **the set editor, Speed and briefs never load the engine.** The dashboard loads it only when a damage section opens. |
| **Trust anatomy** | `prep-ui.js resultBlock()`: headline ("48–56% of X's HP · 6 of 16 rolls KO"), the HP numbers, two-use line, crit line, HP-band line, a knife-edge badge, **assumption chips** (`prep-copy.js chipText`: spread ×0.75, weather, stages, as-Mega, Intimidate, screens…), "Not counted", footer with mechanics/engine version. `rollsDetail`, `howCalculated`. Refusals never show digits. | Every number in the dashboard keeps these chips. |
| **Calcs notebook** | `prep-calcs.js tab/editor`: quick check, the full field (weather, terrain, Intimidate −1/−2, Helping Hand, screens, stages −6..+6, HP %, status, lone target, crit, Mega or not yet…), "Probably on the field" one-tap suggestions (never applied silently), save/pin/mark/duplicate/re-check with old → new diff, "Try their other sets". | The dashboard's damage rows open the full quick check prefilled (`P.prefill`, which asks before replacing an unsaved draft). |
| **Compare grid** | `prep-calcs.js compare()`: one calc across your three newest set versions (plus "spreads you are trying") × up to three versions of their team; the same field in every cell; "Save as a new version" on a candidate column. | The idea behind "Compare options", but limited to **one calc**. The builder generalises it to many questions (§4). |
| **"What would it take?"** | `lib/calc/threshold.mjs`: `outspeedSearch` (no engine; per nature sign; `tieAt` reported; Trick Room ceiling), `surviveSearch` (HP + Def/SpD grid, every roll / 15 of 16 / 8 of 16 / crit too), `koSearch` (attacking stat, same levels, plus **breakpoints** per nature), `natureTradeoff` (never presents a nature change as free; flags "costs a stat this set uses"). Their unknown SP use the same frail/common/max spreads. UI: `prep-calcs.js threshold()` with **Save as a new version** and **Try in Compare**. | This is the KO-benchmark engine. A boost is just `aState.boosts` in the scenario, so **+1/+2 works today** if the state is passed. Gap: `koSearch` only searches **one use**; 2HKO thresholds aren't searched (§8). |
| **Speed** | `prep-calcs.js speed()` ladder (yours exact, theirs as ranges, a Mega row per stone, Scarf; toggles for Tailwind ×2, Trick Room, Icy Wind, paralysis; pick two rows for a sentence). `stats.mjs compareSpeed` returns `first\|second\|tie\|depends`. | Ties are already a distinct result. |
| **Brief** | `prep-matchup.js brief()` over `lib/prep-matchup.mjs buildBriefing`: their pool, threats, their plans (cores), speed section with scenarios (none / Tailwind / Trick Room, weather extensions, Scarf caveat), "Your mons that look useful" (pros/cons), your plans, leads, checks, detail sheets per mon, a "Can't know before the match" line. | The dashboard's "In this matchup" strip reuses `modelFor(...)` → `b.myMons[id].pros/cons`, `b.speed.facts`, `b.threats`. |
| **Plan / Practice / Chat** | `prep-board.js` (plan board: species picks for lead/back/Mega), `prep-plan.js`, `prep-practice.js` (mock briefs, pilot), `prep-chat.js` (chat with the VGC agent; context from an allowlist shown as removable chips; notes only when ticked; `PAGE_VIEWS` = overview/brief/plan/sets/calcs/practice/other). | The builder adds `build` to `PAGE_VIEWS`. Otherwise these are untouched. |
| **Perspective rules** | `P.canWriteMine()`: My sets is written only from your own side. When viewing as another coach, your sets aren't shown as theirs. | The builder obeys this: viewing as someone else shows read-only species info and no editor. |

### Must be preserved (no regressions)
1. Every existing route and deep link, including the legacy `#prep/w/...` forms and Back/Forward behaviour (`navKind`, pinned names when seats move).
2. Immutable set versions, drafts surviving reload, history and revert, "Save as a new set", and calcs going out of date when a set changes (`staleReasons`).
3. Paste import (tiers, questions, EV → SP conversion shown, duplicate choice) and exact export with its warnings.
4. Sets tab: their versions (Likely / Worst for me / Counter-prep / ideas), ring legend, sources per field.
5. Calcs notebook, quick check, field controls, envelope for unknown SP, Compare grid, "What would it take?", Speed ladder, re-check and diff.
6. Brief, Plan board, Practice, Chat with its privacy rules, Backup/Restore, multi-tab conflict handling, read-only mode for newer data, the outdated-shell screen.
7. The engine loads lazily: only on calc sections, never for the editor, Speed or the Brief.
8. No network for prep data: everything stays on the device; the engine is a same-origin import.
9. The Draft app (`#draft`, team, league, learn, setup).

---

## 2. Where it lives

**A new matchup section, `Build`, beside Brief / Plan / Sets / Calcs / Practice**, plus the same screen without an opponent at **My sets**.

| Route (new) | What |
|---|---|
| `#prep/<p>v<o>/build` | Builder for your 10 and your 6 *for this opponent*. The 6 is the workspace's `my6`/`shortlist`, already shared with the Brief tray and Sets. |
| `#prep/<p>v<o>/build/<n>` | Dashboard for your n-th pick (1–10, the same index as `/your/<n>`). It is a drill-down, so it pushes, and Back returns to the builder. |
| `#prep/my-sets` (existing, upgraded) | The same roster layout without the 6 slots ("Choose an opponent to pick a 6"). |
| `#prep/my-sets/<setId>` (existing) | Today the bare set editor; becomes the dashboard with **no default targets**. A "Check against…" picker chooses opponents' pools. |

Why inside a matchup: benchmarks only mean something against someone. In this league the opponent's pool is public on the sheet, so "OHKO common Mega Staraptor" really means "Mega Staraptor *on Calvin's roster*" (Calvin drafted the league's Staraptor). The default opponent is the next scheduled match (`scheduleFor`, already used for "Next match").

Route changes are confined to `lib/prep-route.mjs`: add `'build'` to `MATCH_TABS`, accept `build/<n>` (n ≤ `MAX_SLOT`), map it to the parent `build`, and add it to `TAB_OF_KIND`. The `#prep/w/<wsId>/…` forms need nothing new.

---

## 3. Builder layout (Showdown-recognisable, our own code)

What makes Showdown's teambuilder recognisable is its **structure**, which we copy as structure only: one row per Pokémon with its sprite on the left, then name, item and ability, then four moves, then stats with bars and the spread. We copy no code, CSS, images or icon sheets.

**Licensing.** The Showdown *client* (`smogon/pokemon-showdown-client`) is AGPL-3.0; verify against its LICENSE before reuse. Copying its markup or CSS would pull that licence in, so we don't. The server data (`data/mechanics.json`) and `@smogon/calc` are MIT and already credited in `public/vendor/THIRD_PARTY_NOTICES.txt`. Sprites stay what the app uses today: the existing `P.pt()` portraits hot-linked from the Showdown sprite host, with an initials fallback. **Do not add** item icons, type icon sheets or the Showdown font. Types use the existing `typeBars`; items are text. The fan-tool disclaimer in the notices stays.

```
Desktop ≥1200px
┌ Build · Anthony vs Calvin ───────────────────────────────── [Paste your team] [Export your 6] ┐
│ YOUR 6 for this match  (4 of 6)                     rule "6 per match": don't know (Rules) │
│ ┌──────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ [pt] Rotom-Fan        Item  Sitrus Berry   │ Thunderbolt    │ HP  127 ▇▇▇░░  2       │ │
│ │      Set "Fan NP" v3  Ability Levitate     │ Air Slash      │ Atk  76 ▇▇░░░  0       │ │
│ │      ELE/FLY          Nature Modest +SpA   │ Volt Switch    │ ... SpA 173 ▇▇▇▇▇ 32   │ │
│ │                                            │ Protect        │ 66/66 SP · Spe 138     │ │
│ ├──────────────────────────────────────────────────────────────────────────────────────┤ │
│ │ [pt] Incineroar  …                                                                   │ │
│ │ [ + add from your 10 ]  [ + ]                                                        │ │
│ └──────────────────────────────────────────────────────────────────────────────────────┘ │
│ YOUR 10 (drafted)                                                                           │
│ [ring Rotom-Fan ✓6] [ring Incineroar ✓6] [ring Kingambit] [ring Sinistcha ✓6] … no set: [Create set] │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Your 6** are full **team cards**, one row per set, in the four Showdown-style columns. The whole card is one button that opens the dashboard; the moves column is not separately clickable (one target per card). A mon without a set shows "No set yet · Create set". Over 6 shows "Showdown teams have 6; extras are alternatives" (existing copy). A duplicate item shows the existing item-clause warning.
- **Your 10** is the existing `setgrid` with set rings. Toggling ✓ is the existing `toggle-six`; choosing a set chip picks which set is in the 6. Tapping the name opens the dashboard.
- **Species clause** and **one Mega per battle** use the existing warnings, shown under the 6 when they apply.
- **Their pool** strip (portraits only) sits under your 10 as context, and each portrait opens the existing `/their/<n>` sheet.
- **Viewing as another coach:** your 10 shows species only, with the existing `C.POV.mineViewing` line. No cards, no editor.

---

## 4. The per-mon dashboard

One screen with progressive disclosure, at most two levels. The head and **Compare options** are always open. Every other section is a `<details>` with a **one-line verdict in its summary**, so the collapsed dashboard is already useful. A closed section runs no calcs.

```
‹ Build   Rotom-Fan · "Fan NP" v3                                  [Copy as Showdown text]
CHECKING AGAINST  Calvin's pool ▾  · their sets: Ladder guess (no seen sets) · field: none ▾ · single target ▾
──────────────────────────────────────────────────────────────────────────────────────────
① Set                     Modest · 2 HP / 32 SpA / 32 Spe · Thunderbolt, Air Slash, Volt Switch, Protect  [Edit ▾]
② Compare options         (always open: §4.2)
③ Speed: 138              faster than 4 of Calvin's 10 at any spread; 3 depend on spreads; 1 tie possible ▸
④ Your hits               Thunderbolt OHKOs 2 of Calvin's mons at max bulk; 5 at no bulk ▸
⑤ KO benchmarks           2 pinned: Mega Staraptor, Mamoswine ▸
⑥ Their hits on you       Mega Staraptor's Brave Bird and Close Combat are resisted; hardest pinned hit: Mamoswine Icicle Crash ▸
⑦ In this matchup         looks useful: resists Flying and Fighting; walls Mega Staraptor's STABs ▸
```

### 4.0 Head and the "Checking against" bar (assumptions in one place, repeated on every number)
- **Opponent context:** the opponent whose pool to use (default: this matchup), and **their set source**: "their version: Likely / Worst for me" when sets exist, else "Ladder guess" (`guessSet`), always labelled.
- **Their spreads when unknown:** the three existing envelope rows, `frail · common (ladder <month>) · max`. Every number shows all three, or names the one it uses.
- **Field:** none by default; weather and terrain; a "Probably on the field" chip appears when their pool or yours sets weather or terrain (existing logic, never auto-applied).
- **Targeting:** single target by default. For spread moves, "both foes (×0.75)" is on and the chip says so.
- **Intimidate:** off by default. For your physical attacks, the existing "They may have Intimidate: apply −1" suggestion appears; for special attacks it doesn't apply and isn't shown.
- **Items:** your item from your set. Theirs comes from their set, else "no item counted". A Mega Stone means the Mega form after it Mega Evolves, using the existing `as-mega` / `not-mega-yet` chips. Choice Scarf is mentioned only as a caveat on speed (existing `scarfCaveat`).
- Changing the bar changes **every** section, and every result still shows its own chips. The bar is a shortcut, not a substitute: **no number appears without its assumptions next to it.**

### 4.1 Set (section ①)
The existing editor, embedded. Collapsed, it is a one-line summary (Showdown-style); expanded, it is the editor as it is today. Keep:
- the draft banner, Save version / Save as a new set / Discard, the SP meter "N of 66 used · M left", per-stat ≤32 errors, legality errors and history.

Add one thing:
- **"Where spare SP does most"**: shown when SP are left, or when a benchmark section has slack. Example (VGC reference case §6): "32 Speed SP buy nothing against Mega Staraptor (178 beats your 151 at most). Moved to HP, they cut expected OHKOs from common league hits from 16.0 to 4.0." It comes from the benchmark results (§4.5) and the speed verdicts (§4.3), and is a suggestion only. **Check Speed SP first:** when Speed wins no pinned benchmark, the hint says so, because that is where most of the free bulk usually is.

### 4.2 Compare options (section ②, the centre of the screen)
This answers the Rotom-Fan question at a glance: **columns are set options and rows are the questions that decide the set.** Each cell holds the existing KO words or speed verdict, never a bare number.

**Columns**
- **Current** (the saved version), plus up to **3 trial options**.
- A trial comes from:
  - **Try a change…**: swap a move, change nature, move SP; a mini editor that writes only to the trial, never to the set; or
  - **Suggested trade-offs**: one-tap seeds generated from the set, e.g. "Speed SP → HP", "+ Life Orb (or another damage item)", "+ Nasty Plot, SpA SP → HP/Def", "Timid instead of Modest", "−Speed nature for Trick Room". When a setup seed is offered, the **non-setup alternatives that reach the same KO are offered next to it**: a damage item, a partner's Helping Hand, weather (Thunder in rain). The question is "how do I get this KO", not "should I add Nasty Plot". Each seed is labelled with what it costs, using `natureTradeoff` text such as "gives up Modest's +SpA".
- Trials live in the screen draft (`P.ui`, session only) until you press **Save as a new version** on that column (the existing `promote()` path) or **Save as a new set**.
- A column header shows the nature, the SP spread, the moves that differ (bold) and the SP meter.

**Rows** (the questions), chosen automatically, then editable ("Pin a question", "Remove"):
1. **KO benchmarks:** your best move against each pinned target, at **+0, and also at +1/+2 when the option has a setup move** (Nasty Plot, Calm Mind…), or at the boost you set. If the option *doesn't* have the setup move, its +2 cells say "no setup move" rather than showing a number.
   - **"After their <move>" rows:** when the target's likely moves raise its own defences (Contrary Close Combat: +1 Def and +1 SpD each time; also Calm Mind, Iron Defense, Cosmic Power…) **and it moves before you**, a second row shows the benchmark at that stage, e.g. "after their Close Combat (SpD +1)". This row is what a setup turn has to beat, so it is never hidden behind a toggle.
2. **Their hits on you:** the hardest likely hit from each pinned target (their likely moves: set, else ladder; labelled).
3. **Speed:** your Speed and its verdict against each pinned target ("faster", "slower", "tie possible", "depends on spreads").
4. **Cost lines**, always shown for a setup option:
   - "Uses a move slot (drops Air Slash)".
   - "Needs a free turn: you take <their hit> that turn". The free-turn cost is the row-2 number, linked.
   - **"In their pool: tools against setup"**, listed from the opponent's pool (and, collapsed, the league's): Encore (Champions Encore replaces your action unless you hold Mental Herb), Rage Powder / Follow Me redirection, Unaware, Imposter, Clear Smog / Haze, screens, stat-dropping hits (Spirit Break). Each is labelled with its evidence ("ladder ≥ 10% of its sets" or "could: in its learnset"). This is a list of facts, not a verdict.
   - For an item option: its cost ("Life Orb: −10% HP per attack; item clause: one Life Orb per team").

Cell contents for a KO row: `KO every roll` / `KO 10 of 16` / `no KO (85–101%)`, shown for frail · common · max as three short lines, with the knife-edge badge when it applies. Tap a cell to open the full trust anatomy (resultBlock) in a sheet. A **difference marker** (▲ better / ▼ worse versus Current, plus words) helps scanning. Colour is never the only signal.

**The rule for the row verdicts:** the app states what changes, never "worth it". For example: "Nasty Plot changes the Mega Staraptor answer from no KO to KO 13 of 16 even after its Close Combat. It costs a move slot and a setup turn, and Calvin's pool has 4 tools against setup." The decision stays Anthony's.

**Budget:** each cell is one engine run per envelope row. Four columns × eight rows × three rows of spreads is about 96 runs, cached by scenario JSON as the calc editor does (`cd.resultFor`). It runs only when the section is visible and the engine is ready; until then, "Calculating…" per cell.

### 4.3 Speed (section ③): tiers and creep targets for *this* mon
- **Verdict line**, e.g. "138: faster than 4 of Calvin's 10 at any spread, slower than 2, 3 depend on spreads, 1 can tie."
- **Creep targets table**, sorted by the SP needed. Rows are the opponent's speed benchmarks (pool forms, Megas as their own rows, Scarf caveat). The targets are each opponent's **neutral 32 SP** and **max (+Spe 32 SP)** speeds, labelled "common max" and "worst case". Columns:
  - Target (label + assumption)
  - Their Speed
  - Your SP needed, current nature (`outspeedSearch`)
  - Your SP needed with a +Spe nature, plus what that nature gives up
  - Result word: **Outspeeds by N** / **Ties at N SP (coin flip)** / **Can't, even at 32**
  - Action: "Try in Compare" (adds the SP change as a trial column)
- **Ties are separate from outspeeds:** a row that lands exactly on their Speed says "ties: coin flip each turn" with an `=` glyph. A tie never counts as faster in any count. Ranges that overlap say "depends on spreads", never "faster".
- **Toggles** (existing): Your Tailwind, Their Tailwind, Trick Room (targets become ceilings: "slower with up to N SP"), Icy Wind on them, paralysis. Mega Speed applies from the turn it Mega Evolves (existing copy).
- **League tiers (optional):** "Show league-wide tiers" lists the same benchmarks across all 9 opponents' pools, collapsed by Speed value ("162: neutral-max base 110 · Mega Staraptor (Calvin), …"). This is the Mega Charizard Y use case: what to creep, and how much SP it costs.
- No engine. This section works while the calculator is loading.

### 4.4 Your hits (section ④)
A table with one row per target in their pool and one column per **your damaging move**, showing best-roll KO words. A "+0 / +1 / +2" segmented control (the attacker's SpA or Atk stage; the stage chip shows on every cell) applies to the whole table. Spread moves carry the ×0.75 chip. A cell opens the full quick check prefilled (`P.prefill(ws, 'cd', …)`, which asks before replacing an unsaved check). It can also be saved to the notebook.

### 4.5 KO benchmarks (section ⑤): "What would it take?", pinned per target
For each pinned target (Mega Staraptor, say), **one row per safety level**: KO every roll / 15 of 16 / 8 of 16. Each row shows the cheapest SpA (or Atk) SP **keeping your nature** and, when it's cheaper, **with the other nature** plus what it costs (the existing `natureCost` text with "costs a stat this set uses"). Rows exist for **+0, +1, +2** and for their **frail / common / max** spread. The `koSearch` breakpoints line shows where the odds change ("Modest: 0 SP → 10 of 16 · 8 SP → every roll").
- **Slack:** "you have 32 SpA; every-roll needs 8. 24 SP above what this needs." This feeds "Where spare SP does most".
- **2HKO:** shown from the calc's existing two-use line at the current spread. A searched 2HKO threshold needs the `koSearch` extension (§8); until it lands, the cell says "2HKO threshold: not searched yet (see the calc)".
- Actions per row: **Try in Compare** (adds a trial column) and **Save as a new version** (existing `th-apply`, explicit). Nothing is applied on view.
- **Survive benchmarks** use the same layout for their hits on you (`surviveSearch`, including "survive a crit too").
- **Share of ladder spreads (optional, v1.1):** besides frail / common / max, a cell can say what share of the ladder's usage-weighted spreads it KOs ("KOs 27% of ladder spreads"), as VGC Strategy's reference case does. It needs all the usage spreads (`/api/usage` already has them) and one run per spread. Off by default, and always labelled "ladder, not this league".

### 4.6 Their hits on you (section ⑥)
This mirrors ④ using their likely attacking moves (set → ladder; labelled with the source). It shows the hits-to-KO for **each column of Compare**, so bulk trades are visible here too.

### 4.7 In this matchup (section ⑦)
This is read-only and comes from `modelFor(P, pov, opp, ws)`:
- this mon's pros and cons (`b.myMons`), the speed facts that involve it, their plans it's counted against (`myCounted`), and the threats it walls or is hit by (`b.threats[*].pressure`).
- "Can't know before the match" stays at the bottom.

There are no new claims here, only the Brief's own sentences, so the two screens never disagree.

---

## 5. The Rotom-Fan case (mockup)

> **Numbers come from VGC Strategy's reference case** (`docs/research/strategy/sp-assist/rotom-fan-case.md`, §4–§9). Its calculator reproduces the app's damage goldens in `test/calc-engine.test.mjs`. These are its numbers; none are mine. They are still a mockup until the built screen produces them (see the acceptance list below).
>
> Assumptions for every number: Lv 50, doubles, Thunderbolt (single target), no crit, no weather or terrain, full HP, no screens unless stated.
> - **Rotom-Fan:** Levitate (no Electric Terrain boost).
> - **Mega Staraptor:** the ladder's most common spread, Jolly 29/1/0/0/4/32 (HP 189, SpD 114, Speed 178). Its Close Combat is Contrary: +1 Def and +1 SpD.
> - **"Ladder share":** the share of the 159 usage-weighted ladder spreads (Smogon Reg M-C ≥ 1760, Sept 2026, which is not this league).
> - **Owner:** Calvin owns the league's Staraptor. Under pool-only information it might be the Scarf Final Gambit set instead.

```
‹ Build   Rotom-Fan                                                            (desktop)
CHECKING AGAINST Calvin's pool · their sets: Ladder guess · field: none · single target
② COMPARE OPTIONS                                           [Try a change…] [Suggested trade-offs ▾]
                        │ CURRENT (O1)              │ A: Speed SP → HP, Life Orb   │ B: + Nasty Plot (N16)
                        │ Modest 2/0/0/32/0/32      │ (O2) Modest 32/0/0/32/2/0    │ Modest 32/0/14/16/4/0
                        │ no item                   │ Life Orb                     │ Sitrus or Mental Herb
                        │ TB · Air Slash · VS · Prot│ TB · Air Slash · VS · Prot   │ TB · NASTY PLOT · VS · Prot
────────────────────────┼───────────────────────────┼──────────────────────────────┼─────────────────────────────
Thunderbolt → M-Staraptor│ no KO 80–96%  0/16       │ KO every roll 105–125%  ▲    │ +0: no KO 73–87%       ▼
 before its Close Combat │ (27% of ladder spreads)  │ (99% of ladder spreads)      │ +2: KO every roll 146–173% ▲
After their Close Combat │ no KO 54–65%             │ no KO 70–84%  0/16           │ +2: KO 13 of 16 98–115% ▲
 (Staraptor SpD +1)      │                          │ (3% of ladder spreads)       │ (94% of ladder spreads)
Speed vs M-Staraptor 178 │ 138: slower ‹ always     │ 106: slower ‹ always         │ 106: slower ‹ always
 (Mega Speed, Showdown)  │ your Tailwind: 276 ›     │ your Tailwind: 212 ›         │ your Tailwind: 212 ›
Bulk: common league hits │ 16.0 expected OHKOs      │ 4.0 expected OHKOs ▲         │ 2.5 expected OHKOs ▲
 (394 hits, 9 opponents) │                          │ (most of this is Speed → HP) │
Cost                     │ —                        │ Life Orb −10% HP per attack; │ a move slot; a setup turn
                         │                          │ one Life Orb per team        │ into a faster Staraptor
In Calvin's pool: tools  │                          │                              │ Rage Powder (Volcarona 57%),
 against setup (ladder)  │                          │                              │ Light Screen (Grimmsnarl 97%),
                         │                          │                              │ Spirit Break 84%, Encore and
                         │                          │                              │ Clear Smog (Swalot 20%/27%)
────────────────────────┴───────────────────────────┴──────────────────────────────┴─────────────────────────────
Same KO without a setup turn: Modest 32 SpA + Pelipper's Helping Hand: KO every roll 122–144% (99.7% of ladder
spreads) · Thunder in Pelipper's rain: KO 15 of 16 (97%). Elsewhere in the league: Prankster Encore (Whimsicott,
Sableye, Mega Banette), Unaware Skeledirge (Taro), Imposter Ditto (Hex).
What changes with B: the only option that still OHKOs after Staraptor's Close Combat (13 of 16). It costs a move
slot and a setup turn, and Calvin's pool has 4 tools against setup. A gets most of the bulk without a setup turn.
Not a matchup verdict: no partners' positioning, Protect, Roost or crits counted.
[Save B as a new version] [Save as a new set]
```

- The Speed row shows **"slower ‹ always"**, not "depends", because every common Mega Staraptor spread runs 32 Speed (178), above Rotom-Fan's maximum of 151 (Timid 32). No Speed SP changes that, so the spare-SP hint (§4.1) points those SP at HP.
- "With your Tailwind" is a field toggle. The cell carries the caveat "Staraptor runs Tailwind on 69% of ladder sets: a Tailwind mirror cancels this".
- The bulk row comes from the reference case's 394-hit model. It is a **v1.1 summary row**: v1 shows the hardest pinned hits from §4.6 instead, and links the full model.
- Every cell's tap-through sheet carries its chips: "Rotom-Fan SpA +2", "Staraptor-Mega SpD +1 (after Close Combat)", "their spread: common (ladder Sept)", "Life Orb", "single target".
- ▲▼ always sit with words. A screen reader hears, for example, "better than current: KO every roll versus no KO".
- The Final Gambit row appears only when Calvin's Staraptor is entered as the Scarf set. It shows "192 fixed damage; your max HP is 157: no spread survives it" with no SP suggestion.

KO benchmark rows for the same target (§4.5), as they would appear (reference case §4):

```
Mega Staraptor · Thunderbolt                     least SpA SP (Modest) │ ladder share at 32 SpA
 +0, no item, SpD +0        KO every roll        can't                 │ 27%
 +0, Life Orb, SpD +0       KO 15 of 16          20 (common spread: 23 for every roll) │ 99%
 +0, Life Orb, SpD +1       KO 15 of 16          can't                 │ 3%
 +2, no item, SpD +0        KO every roll        8   (15 of 16 at 0)   │ —
 +2, no item, SpD +1        KO 15 of 16          16  (every roll: can't, 99% at 32) │ —
 Neutral SpA (Timid/Calm), +2, SpD +0: every roll at 21 · gives up Modest's +SpA
 2HKO at +0, SpD +0: 5 SpA (Timid 17); Roost (30% of sets) undoes it.
```

**Acceptance (the built screen must reproduce VGC §9 before this mockup counts as done):**
1. Rotom-Fan Modest 32 SpA = 172. A 0/0 Jolly Mega Staraptor has HP 160 and SpD 110.
2. Neutral 32 SpA Thunderbolt into 0/0 Jolly Mega Staraptor rolls 146 to 174.
3. Modest 32 SpA Life Orb +0 into the common spread: 198–237, KO 16/16. At SpD +1: 133–159, 0/16.
4. Modest 16 SpA at +2 into the common spread at SpD +1: 186–218, KO 13/16.
5. `koSearch`: Modest, no item, +2 → the 15-of-16 level at 0 SpA. Life Orb +0 → 23 SpA for every roll.
6. Final Gambit (Scarf Staraptor, 32 HP) = 192, above Rotom-Fan's max HP of 157: no survive option.

---

## 6. Interaction rules

1. **Suggestions never overwrite.** Seeds, "Try in Compare", spare-SP hints and creep targets only create **trial columns** or open the editor. The only writes are **Save as a new version** (an immutable new version, via `promote()`/`addVersion`, with the toast "N calcs are now out of date") and **Save as a new set**. Both are explicit buttons.
2. **Assumptions are on every number:** opponent spread (frail/common/max, or their set's source), their item, your item, natures (both), weather and terrain, Intimidate stage, spread ×0.75 or single target, stat stages, Mega state, HP if not full. These use the existing chip copy (`chipText`). Column and table headers carry the shared ones; the sheet behind a cell lists all of them.
3. **Ties versus outspeeds:** four words only, "faster", "slower", "tie possible / ties" and "depends on spreads", each with a glyph (› ‹ = ~). A tie never counts as faster in any count or verdict.
4. **Calibrated copy:**
   - Results say "KO every roll", "KO 6 of 16", "no KO (82–97%)", "2 hits".
   - The section summaries and the "What changes" line say what changed and what it costs. They never say "worth it", "best set" or "wins the matchup".
   - The scope line, `C.SCOPE`, is on every result: no partners, Protect, positioning or later turns.
   - Ladder-guessed sets are always labelled as guesses (existing F7 flag), and their moves as "likely (ladder)".
5. **Unknowns stay unknown:** if their SP or nature are unknown, the envelope shows; if their item is unknown, the Scarf caveat shows on speed. If the engine fails, the existing "Retry" banner shows, while Speed and Set still work.
6. **Perspective:** only your own side can edit or save. Viewing as another coach shows the builder with species and the Brief facts, and no sets.

---

## 7. Narrow, mobile, keyboard and touch

- **Breakpoints follow the app:** at <1200 the builder's 6 cards go two-up and the dashboard is one column; at <768 everything is a single column with a 16px gutter and no page-level horizontal scroll.
- **Phone builder:** the 6 become a vertical list of compact cards (sprite, name, item, a one-line spread, four move chips that wrap). Your 10 is the existing grid. The bottom bar (existing `.bottombar`) holds "Paste your team" and "Export".
- **Phone dashboard:**
  - The "Checking against" bar collapses to one line ("vs Calvin · Ladder guess · no field ▾") that opens a sheet.
  - Sections are the `<details>` accordions, with summary rows of at least 44px (the existing phone rule).
  - **Compare options turns from a table into stacked option cards.** Each card lists the same questions in the same order with ▲▼ words versus Current, and a "Current / A / B" segmented switch at the top shows one option at a time. No table scrolls sideways; the KO-benchmark and creep tables scroll *inside* their card with a sticky first column (the existing `.scroll` pattern).
  - A sticky bottom bar shows "Save Trial A as a new version" only while a trial is selected.
- **Keyboard:**
  - Every card, chip and cell is a real `<button>` (existing `btn`/`chipBtn` with `aria-pressed`). Tab order follows the visual order. Enter or Space opens; Escape closes a sheet and returns focus to the cell that opened it (existing `P.focusOn`).
  - Navigation focuses the screen heading (`prep-h`, existing). New results are announced once through `P.app.announce`, e.g. "Compare: Trial A, 3 answers changed".
- **Touch:** steppers stay ± buttons of at least 44px (existing `spstep`); number inputs use 16px text (no iOS zoom). There are no hover-only tooltips: glossary terms open on tap.
- **Reduced motion:** no animation is introduced.

---

## 8. Components: reused versus new

| Component | Module | Status |
|---|---|---|
| Routes `build`, `build/<n>` | `lib/prep-route.mjs` | **modify** (small: `MATCH_TABS`, parse/format, parent, `TAB_OF_KIND`) |
| Section tab and screen dispatch | `public/prep.js` (`matchView`, `TAB_LABEL`, `MODULES`) | **modify** (one branch, register the module) |
| Builder screen, team cards, dashboard shell, Compare options view, creep table view | `public/prep-build.js` | **new** |
| Option seeds (trade-offs, incl. non-setup alternatives), question selection, "after their <move>" stage rows, tools-against-setup list from a pool, compare matrix, slack/spare-SP, creep-target list, optional ladder-share | `lib/prep-build.mjs` (pure; calc injected; unit-testable like `threshold.mjs`) | **new** |
| 2HKO threshold search (`uses: 2` level using `r.ko.two`) | `lib/calc/threshold.mjs koSearch` | **modify** (additive) |
| Set editor body | `public/prep-sets.js editor()` → export `editorBody` | **modify** (export only; behaviour unchanged) |
| Set ring, `myTeamRows`/`toggle-six`, import and export screens | `public/prep-sets.js` | reuse |
| `compute`, `summarize`, `promote` (export), field suggestions | `public/prep-calcs.js` | reuse (+ export `promote`) |
| `koSearch`, `surviveSearch`, `outspeedSearch`, `natureTradeoff`, `plusNatureFor` | `lib/calc/threshold.mjs` | reuse |
| `statValue`, `speedOf`, `speedRange`, `compareSpeed`, `outspeedSP`, `SP_*` | `lib/calc/stats.mjs` | reuse |
| `createCalc` (run, envelope, spreadFor), engine lazy-load | `lib/calc/wrapper.mjs`, `public/prep-engine.js` | reuse |
| `resultBlock`, `koWords`, `headline`, `rollsDetail`, `howCalculated`, `ladder`, `btn`/`chipBtn`/`select`/`term` | `public/prep-ui.js` | reuse |
| Lineage and versions: `addVersion`, `currentVersion`, `asSet`, `guessSet`, `commonSpread` | `lib/prep-model.mjs` | reuse |
| Legality: `checkSet`, `learnset`, `legalAbilities`, `battleForme` | `lib/calc/mech.mjs` | reuse |
| Brief model: `modelFor`, `sixOf`, `savedSpeeds` | `public/prep-matchup.js`, `lib/prep-matchup.mjs` | reuse |
| Copy (`BUILD.*`: headings, verdict templates, seed labels, cost lines, empty states) | `public/prep-copy.js` | **modify** (add keys) |
| Glossary terms: "Speed creep", "Benchmark", "Slack", "Trial option", "Setup move (+1/+2)" | `public/glossary.js` | **modify** (add entries) |
| Chat page view `build` | `lib/chat-context.mjs PAGE_VIEWS`, `public/prep-chat.js` | **modify** (one enum value) |
| Styles: team card grid, option columns and stacked cards, ▲▼ markers | `public/styles.css` | **modify** (scoped `.prep .build*` rules after the base rules) |
| Storage | `lib/prep-schema.mjs` | **unchanged in v1.** Trials and pinned questions live in `P.ui` (session drafts, the existing `saveUi`). Persisting pinned benchmarks per set would need a schema field and version bump; add it only if pins prove useful. |
| Tests | `test/` | **new:** `prep-build` logic (seeds, matrix, slack, tie handling), route parse/format round-trip, phone-CSS arithmetic (as `mobile-ui.test.mjs`), and "no write without a click" (render the dashboard, assert the store revs are unchanged). |

---

## 9. Empty and edge states (copy)

| Situation | Copy |
|---|---|
| No sets yet | "No sets yet. Paste your team from Showdown, or create a set for each mon." [Paste your team] |
| Mon has no set | "No set for Rotom-Fan yet. [Create set] [Start from ladder data]" (the ladder start is labelled as a guess). |
| No opponent (My sets) | "Pick whose pool to check against. Benchmarks only mean something against a team." [Choose…] |
| Opponent pool still filling | Existing `C.BRIEF.openPicks`: "Calvin has N picks left: targets can still change." |
| Their set unknown | "Their sets: Ladder guess (not seen). Numbers show frail / common / max spreads." |
| SP over 66 / invalid set | Existing editor errors; Compare shows "Fix the set first" in that column, and no numbers. |
| Calculator loading or failed | "Loading the calculator…" / the existing failed banner with Retry; Speed and Set still work. |
| A move whose damage depends on HP, or Foul Play | The existing `TH_REFUSE` sentences, no digits. |
| Viewing as another coach | Existing `C.POV.mineViewing(coach)`. |

---

## 10. Open questions (for Anthony via the lead)

1. **Where does "my 6" live outside a matchup?** In v1 it is per opponent (as today). If he wants a standing "main 6", that's a new stored field (schema bump).
2. **Common Mega Staraptor sets:** v1 uses the opponent's saved set, else the Smogon ladder spread (`commonSpread`; for Mega Staraptor that is Jolly 29/1/0/0/4/32), labelled "common (ladder <month>)". If he wants league-specific spreads, someone has to enter them as their sets. Under pool-only information, Calvin's Staraptor could also be the Scarf Final Gambit set, which no SP spread survives (192 fixed damage vs Rotom-Fan's 157 max HP).
3. **Team-sheet rule** is still `unknown` in Rules, so the dashboard keeps all three spreads visible rather than assuming open sheets.

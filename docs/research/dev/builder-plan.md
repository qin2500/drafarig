# Builder plan: teambuilder and per-mon analysis dashboard

Drafarig Developer, 2026-10-15. This is a read-only audit of local branch `cloud-checkpoint` (cda8f0a, cloud v6). Every
citation comes from `git show cloud-checkpoint:<path>`. Nothing was checked out, extracted or run, because executing that
code is blocked until Anthony approves. "Verified" below means I read the code, not that I ran it.

**Feature (Anthony):** a Showdown-style teambuilder (roster of 10, team of 6). You pick a team member and get its analysis
dashboard: a set editor, speed tiers and creep targets, damage at +0/+1/+2, KO benchmarks (the SP needed to OHKO or 2HKO a
target with nature X at boost Y), and a compare view that shows set options as offense-vs-bulk trade-offs.

**Motivating case:** Rotom-Fan with or without Nasty Plot. How much SpA SP does it need to OHKO common Mega Staraptor sets
at +0 and at +2, and how much bulk can the freed SP buy? Champions Stat Points are capped at 32 per stat and 66 in total
(`lib/calc/stats.mjs` `SP_PER_STAT`, `SP_TOTAL`).

---

## 1. What the cloud code already provides

### Calc core (pure, engine injected)

| Piece | Where | What it does |
|---|---|---|
| Scenario | `lib/calc/scenario.mjs` `normalizeScenario`, `normalizeSideState` | Every calc input, always fully present. Per side: **boosts −6..+6** for atk/def/spa/spd/spe, status, hpPct, **intimidated 0–2**, mega on/off, item consumed. Field: **weather** (Sun/Rain/Sand/Snow), **terrain**, Gravity and the rooms. Attacker side: Helping Hand, Tailwind, ally present. Defender side: Reflect, Light Screen, Aurora Veil, Friend Guard, Protect, **partnerPresent** (decides spread) |
| Wrapper | `lib/calc/wrapper.mjs` `createCalc(engine, mech)` → `{run, envelope, spreadFor, engineCalls}` | Fail-closed wrapper around the vendored `@smogon/calc` 0.12.0 (`public/vendor/smogon-calc-0.12.0.mjs`). It always runs Doubles. **Spread** = the move targets more than one Pokémon and the partner is present (`isSpread`, ~l.190–204). **Intimidate** is applied as a table with Defiant, Competitive and White Herb (`intimidate()`, ~l.101). Weather and terrain are passed to the engine. Results have a class (exact / no-damage / status / needs-state / refused) and stable codes |
| KO odds | `lib/calc/ko.mjs` `koOdds` | Exact BigInt KO fractions over 16 rolls × hits. Covers multi-hit 7/7/3/3, Sash, Sturdy, Sitrus, resist berries, Multiscale and Disguise. `run()` returns `ko.one / two / three` (wrapper l.418). In `lite` mode `ko.two` is `not-computed` (l.368) |
| Envelope | wrapper `envelope`, `spreadFor` | For an opponent with unknown SP: rows for **frail** (0 SP, −nature), **common** (a supplied spread, e.g. ladder) and **max** (32 in each stat that matters, +nature) |
| Stats / speed | `lib/calc/stats.mjs` `statValue`, `speedOf`, `speedRange`, `compareSpeed`, `outspeedSP` | Champions L50 formula. Speed accounts for stage, Tailwind, the weather Speed abilities, Scarf, Iron Ball and paralysis. `outspeedSP` returns the cheapest SP **and `tieAt`** (exact-tie boundary) |
| "What would it take?" | `lib/calc/threshold.mjs` | `koSearch` (my set attacks): one nature pair × 33 SpA/Atk values. Returns levels every-roll / 15-of-16 / half, `breakpoints` (where the odds change) and `budget` (SP still free). `surviveSearch` (my set defends): HP × Def/SpD grid, optional crit level. `outspeedSearch`: no engine calls, Trick Room aware. Every nature change is costed with `natureTradeoff` / `plusNatureFor` |
| Tests | `test/calc-threshold.test.mjs` | Each search is checked against a **brute-force sweep** of full runs (survive l.19, KO l.92, outspeed l.121). Also `calc-engine`, `calc-ko`, `calc-wrapper` and `calc-review-*` |

### Prep data, sets and screens

| Piece | Where | What it does |
|---|---|---|
| Schema | `lib/prep-schema.mjs` | `SCHEMA_VERSION = 3`. `docVersion` gives every document version 1, except a workspace with `pov` (2) or species plan cards (3). Keys `drafarig.prep.{meta,rules,mysets,pilot,ws.<id>}`. `newWorkspace` holds `theirSets`, `variants`, **`my6`**, `calcs` and `speedChecks`. `validate`, `MIGRATIONS` and `migrate` refuse newer documents (the store goes read-only) |
| Store | `lib/prep-store.mjs` `createStore` | localStorage-backed, with a usage budget, vault and keep prefixes |
| Set model | `lib/prep-model.mjs` | A set is a lineage with immutable versions: `newLineage`, `addVersion`, `setCurrent`, `pruneVersions` (keeps 10 plus any referenced). Per-field provenance (`SOURCE_RANK`). **`guessSet`** builds an opponent default set from usage plus keyMoves, filtered by the learnset, with SP left `'unknown'`. **`commonSpread`** returns the top legal ladder spread. `setForSpecies` and `defaultVariant` pick sets from a workspace |
| Sets UI | `public/prep-sets.js` | Set editor (`editor`, immutable versions, drafts survive a reload), the my-sets library (`mySets`), their-team variants (`variantEditor`), Showdown paste **import/export** (`importScreen`, `exportScreen`, `lib/paste.mjs`), `spMeter`, `addGuess` and `createMySet` |
| Calcs UI | `public/prep-calcs.js` | `editor`: quick or full doubles calc. The field controls (`fieldControls`, l.268–300) include **attacker Atk/SpA stage selects**, Intimidate −1/−2, weather, terrain, screens, HP% and status. `compare` (l.377): a grid of your 3 newest set versions plus up to 3 "Try:" spreads × their variants, one move. `threshold` / `runThreshold` (l.413–551): the "What would it take?" screen, which **inherits the open calc's states including boosts** (`th.cond`, set at l.734). `speed` (l.553): a speed ladder that gives their side a range, with a row per possible Mega, Tailwind / TR / Icy Wind / paralysis toggles and a two-row compare |
| Brief / chat | `lib/prep-brief.mjs` (mock briefs, pilot cards), `lib/chat-context.mjs` + `public/prep-chat.js` + `worker/chat.mjs` (allowlisted page context, fail-closed) | Not needed by this feature. They must keep working |

### The Rotom-Fan question: what the code can answer today

| Sub-question | Today? | How / why not |
|---|---|---|
| SpA SP for Rotom-Fan to OHKO **one** Mega Staraptor spread at +0 | **Yes** | Calcs: Rotom-Fan → Thunderbolt → Staraptor holding its stone. Then "What would it take?" → KO → `koSearch`. Shows the cheapest SP for every-roll / 15-of-16 / half, plus breakpoints |
| …at +2 | **Yes, manually** | Set Attacker SpA to +2 on the calc first. `th.cond.aState.boosts` carries into `koSearch`, which `structuredClone`s the scenario. The threshold screen itself has no boost control |
| +0 and +2 side by side | **No** | One search per run. You would read two screens and note them down yourself |
| Several Staraptor sets (frail / ladder / max, or several variants) at once | **No** | `runThreshold` picks one investment (`th.investment`) and one their-set. `compare` covers variants but shows KO words, not SP thresholds |
| **2HKO** benchmark | **No** | `koSearch` searches one use only (the comment at threshold.mjs l.~140 says so). Lite runs mark `ko.two` as `not-computed` |
| Freed SP → bulk | **No** | `koSearch` returns `budget` and the per-level cost, so the freed SP (need at +0 minus need at +2) is just arithmetic. Nothing then feeds that SP into `surviveSearch` against a chosen threat |
| Nasty Plot vs another move as *set options* | **Partly** | `compare` takes several of your set versions, but compares one move and one field per grid, with no boost axis and no SP threshold per cell |
| Speed creep targets for Rotom-Fan | **Partly** | `outspeedSearch` handles one target at a time. The `speed` ladder shows every opponent's range but doesn't list "SP needed to pass X" |
| Is Nasty Plot legal on Rotom-Fan? | **Yes (mechanism)** | `checkSet` / `canLearn` (`lib/calc/mech.mjs`) against `data/mechanics.json` learnsets. I didn't decode the indexed learnset in this audit |

Data note: in `data/mechanics.json`, `staraptormega` has **Contrary** (base 85/140/100/60/90/110) and `rotomfan` has
Levitate (50/65/107/105/107/86). So Intimidate is irrelevant to Rotom-Fan's special damage, and spread doesn't apply to
single-target Thunderbolt or Air Slash.

---

## 2. Minimal implementation plan

Approach: reuse the existing searches and loop over them. Add no schema version and no new document type.

### New / changed modules

1. **`lib/calc/benchmarks.mjs` (new, pure, ~120 lines)**. A thin orchestration over `threshold.mjs`:
   - `koTable(calc, mech, mySet, targets, { moves, boosts: [0, 1, 2], uses: [1, 2] })`. For each target × move × boost it
     clones the scenario, sets `attacker.state.boosts[stat] = b` and calls `koSearch`. It returns rows
     `{target, move, boost, uses, everyRoll, fifteen, half, breakpoints}`, where each level comes from `levelsOf` via `koSearch`.
   - `creepTargets(mech, mySet, formeId, targets, cond)`. Calls `outspeedSearch` per target forme (Megas included, as the
     `speed` view already enumerates them) against `speedRange(...).max` and `.neutralMax`, sorted by SP needed. It keeps `tieAt`.
   - `tradeoff(calc, mech, options, targets, threats)`. For each set option (e.g. "Thunderbolt/Air Slash/Volt Switch/Protect,
     modest" vs the same with Nasty Plot) it takes the SpA SP needed at the chosen safety level (from `koTable`) and
     computes `freed = currentSpA − needed`. With SpA fixed at `needed`, it then runs `surviveSearch` for each threat (its
     budget already subtracts committed SP, threshold.mjs `committed`). Returns `{option, spaNeeded, freed, bulk: [{threat, level, hp, def|spd}]}`.
2. **`koSearch` change (small, in `lib/calc/threshold.mjs`)**: add an option `{ uses: 2 }`. It runs non-lite and reads
   `r.ko.two` instead of `r.ko.one`. This is the only change to existing calc code. It doubles the cost per grid point (non-lite).
   Refusals (`repeatBlock`: between-turn effects) pass through as they do today.
3. **`public/prep-builder.js` (new view, ~200 lines)**, registered the way `prep-calcs.js` exports `views` / `actions`:
   - **Team panel:** the roster of 10 comes from the sheet (`P.coachRoster(P.myCoach())`). The team of 6 is the
     workspace's existing `my6`. Outside a workspace, the panel lists the my-sets library (`mysets`). There's no new
     global team document in v1 (see Risks).
   - **Mon dashboard** for one my-set lineage. Tabs: Set (reuses `prep-sets.js` `editor`), Speed (`creepTargets` + the
     existing `ladder` from `prep-ui.js`), Damage (`koTable` with boost columns +0/+1/+2), Compare options (`tradeoff`).
     "Save as a new version" reuses `promote` / `addVersion` exactly like `th-apply`.
4. No change to `prep-schema.mjs`, `prep-store.mjs`, `paste.mjs`, brief or chat.

### Data flow for "compare set options"

```
my lineage (current version) ──► options = [base set, + "Nasty Plot" swapped into one move slot, + nature alt]
                                        │      (each checked with checkSet; illegal options are shown as refused, never run)
targets (below) ──► per option: koTable(boost 0 and +2, uses 1/2) ──► spaNeeded per target and level
                                        │
                         freed = curSpA − spaNeeded ; SP total stays ≤ 66 (budget from koSearch)
                                        │
threats (below) ──► surviveSearch(mySet with spa = spaNeeded) ──► HP/Def or HP/SpD that freed SP buys
                                        ▼
table: option × target → SpA needed at +0 / +2 · freed SP · "survives X 15/16" etc. — derived, not stored
```

### Choosing targets and opponent default sets

- **Relevant targets**: the species on opponents' rosters (league sheet). By default the dashboard uses the next opponent's
  workspace roster (`P.rosterSpecies(ws)`); "all opponents" is a toggle. They are sorted by ladder usage
  (`usage.species[id].usage`, then `pika.pct`). The user can pin any species. Megas get their own rows only when the
  species has a stone, the same rule as `speed()` l.~580.
- **Their set, in order:** the workspace's `theirSets` lineage for the chosen variant (`theirSetFor`). Otherwise
  `guessSet` (usage moves, item, ability, nature; SP `'unknown'`).
- **Unknown SP:** each target gives up to three rows, `spreadFor` frail / common (`commonSpread`) / max. That's the same
  definition the range view and threshold screen use, so "max: worst case" means the same everywhere. With no ladder
  spread there's no common row, and the label says so.
- **Threats for the bulk side**: the same targets reversed (their strongest damaging move from `guessSet` moves, at max
  investment). Assumptions are shown with the chips that `run()` already returns.

### Test plan (all offline, synthetic sets, using `test/calc-helpers.mjs` `newCalc`)

1. **Speed tie boundaries** (`test/builder-speed.test.mjs`). Fixtures where my max Speed equals the target exactly: for
   Rotom-Fan, 86 base + 32 SP + 20 = 138 neutral and ⌊138 × 1.1⌋ = 151 with +Spe. Assert `tieAt` is set, `sp` is the
   first value strictly greater, and Trick Room inverts it. Cross-check `creepTargets` against a brute-force loop of
   `speedOf(statValue(...))`, as the existing test at calc-threshold l.121 does.
2. **KO thresholds vs brute force** (`test/builder-ko.test.mjs`). Rotom-Fan Thunderbolt into Mega Staraptor (frail /
   max) at boosts 0, +1 and +2. Compare `koTable` levels against a full sweep of `calc.run` over SpA 0..32 × both
   natures, reusing the `keepChange` / `frac` pattern from calc-threshold l.92–119. Repeat with `uses: 2` against
   `r.ko.two` from non-lite runs. Assert the `+2` row never needs more SP than `+0`.
3. **Trade-off invariants**: `freed = cur − needed`. The total SP in every suggested spread is ≤ 66 and each stat ≤ 32
   (`spProblems` returns []). Bulk results equal a direct `surviveSearch` on the same set.
4. **Saved-team compatibility**: no new document fields, so `prep-compat.test.mjs` (published v3 41c8112, run from git)
   and `prep-compat-v4.test.mjs` must pass unchanged. Add one assertion that a library saved before the feature opens in
   the dashboard and that "Save as a new version" yields `docVersion` unchanged, with `validate('mysets', …)` returning [].
5. Existing suites stay green: `prep-store`, `paste` (import/export), `prep-chat`, `chat-*`, `worker`, `mobile-ui`, `prep-ui`.

### Risks

- **Engine cost.** One `koSearch` is ≤ 66 runs, or ≤ 132 for `uses: 2` in non-lite mode. 10 targets × 3 rows × 3 boosts × 2
  options × 2 uses comes to roughly 10k runs. Mitigation: compute a row when it's opened or scrolled into view, default to
  boosts {0, +2} and one move, and reuse `calc.engineCalls()` to show the cost. Measure milliseconds per run before deciding.
- **Megas in usage data.** Smogon chaos usually files Mega usage under the base species, with the stone in items. So
  `guessSet('staraptor')` plus a stone gives the Mega forme through `battleForme`, but its spread may be a base-form
  spread. Label it "ladder, base-species stats".
- **+2 is not free.** Nasty Plot costs a turn and a move slot. The view must say "after one Nasty Plot". It must not
  present +2 as Rotom-Fan's normal damage.
- **Team of 6 outside a workspace** would need a new document or field. That means a `docVersion` bump, and the v3/v4
  compat tests turn older apps read-only. It's deferred until Anthony wants a global team. `my6` per workspace already exists.
- **Build inliner**: `scripts/build.mjs` accepts only single-line `import {…} from './x.mjs';` in modules the worker
  imports. New lib modules must follow that syntax.
- **Stale script**: `package.json` `build-data` runs `tools/build-data.mjs`, which isn't in the cloud tree. Don't rely on it.

---

## 3. Build and test commands (for when execution is approved)

From `cloud-checkpoint:package.json` and `scripts/`:

| Command | Runs |
|---|---|
| `npm test` | `node scripts/build.mjs && node --test test/*.test.mjs` (32 test files) |
| `npm run build` | `node scripts/build.mjs`. Deterministic Worker artifact in `dist/` (inlines `worker/app.mjs` + lib, embeds `public/`, `lib/`, `data/{dex,cores,mechanics}.json`) |
| `npm run validate` | `node scripts/validate-artifact.mjs` |
| `npm start` | `node server.mjs` (local) |
| `node test/live-smoke.mjs` | Live read-only smoke against the real sheet and Smogon (network). Not part of `npm test` |
| `node tools/build-mechanics.mjs --from <projection.json>` | Dev-only: regenerate `data/mechanics.json` |
| `node tools/vendor-calc.mjs --from <node_modules/@smogon/calc>` | Dev-only: re-vendor the engine |
| `npm run build-data` | **Broken on this branch**: `tools/build-data.mjs` is missing |

Node: `/Users/anthony/.local/bin/node` (v24). Single-file runs: `node --test test/calc-threshold.test.mjs`.

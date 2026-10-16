# Calc workbench and Teams: spec

Drafarig UI UX, 2026-10-16.

**Built against:** `prep-builder` 67e226c (live v9).

**Mockup:** `docs/research/ux/mockups/teams.html`, one self-contained file. It has:
- the Teams list;
- the team builder with sets inside a team;
- the calc workbench opened from the move strip and from slider marks;
- the matchup "bring" picker;
- the one-time migration notice.

**Audit:** `ux-audit-2026-10-16.md` (#1, #2 and #3 are what this spec fixes).

---

## B. Calc workbench

### B1. What opens it
**Every automatic number becomes a button.** No number is shown without a way to open it.

| Trigger | Attacker / defender | Opens at |
|---|---|---|
| Move strip card (editor), each value (+0, +2, no-sun…) | you → that target | your current **draft**, that boost, that field |
| Slider KO mark, and its "no sure OHKO" chip | you → the mark's target | your draft with **that stat at the mark's SP**, plus the mark's nature/item if it needs another |
| Slider survive mark (HP / Def / SpD), and "can't survive" chip | their mon → you | your draft at the mark's HP/def SP |
| Speed mark | no workbench | (it's stat maths: the tooltip already says "Modest 27 SP = 133 > 132". Tapping it opens the Speed ladder sheet) |
| Compare diff chip ("✓ OHKO Mega Staraptor") | as the mark | the current draft, with an **A / B** switch on your side |
| Brief "Calc" buttons, Calcs notebook cards | as today | today's full Calcs screen is unchanged; the workbench is the quick, throwaway version |

### B2. Layout

```
┌ Thunderbolt → Mega Staraptor ──────────────────────────────── [×] ┐
│  80.4–96.3%  ·  0 of 16 KO   ▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮ (roll strip)          │  ← result, sticky
│  152–182 of 189 HP · 2HKO: always · if crit: KO                   │
│  chips: single target · no weather · Staraptor as Mega             │  ← existing chipText
├ YOU (your draft) ──────────────┬ THEM (assumed) ──────────────────┤
│ Rotom-Fan  Modest ▾  Sitrus ▾  │ Mega Staraptor  Jolly ▾  Staraptite│
│ SpA ━━━━━━━━━━━━━●  32  172    │ "ladder Sept, most used spread"   │  ← source label
│ (all 6 stats, ⌄ more)          │ HP  ━━━━━━━━━━●━  29  189         │
│ Boost  −6 … [+0] … +6          │ SpD ━●━━━━━━━━━━━   4  114         │
│ Ability Levitate               │ Ability Contrary · Boost SpD [+0]  │
│                                │ [frail | common | max] spread      │
│                                │ ↺ back to assumed                  │
├ FIELD ─────────────────────────┴───────────────────────────────────┤
│ Weather [none|sun|rain|sand|snow] Terrain […] · Light Screen ·     │
│ Reflect · Helping Hand · Intimidate −1/−2 (physical only) ·        │
│ Spread (both foes ×0.75) · Crit                                    │
├────────────────────────────────────────────────────────────────────┤
│ [Apply to my set]  [Save as calc]                   Changes here   │
│                                                     aren't saved.  │
└────────────────────────────────────────────────────────────────────┘
```

**Result block (sticky at the top).** It reuses `resultBlock`, `rollsDetail` and `howCalculated` from `public/prep-ui.js` unchanged, so the workbench shows the same trust anatomy as the Calcs screen:
- headline %, HP numbers and the n/16 roll strip;
- 2HKO, crit and HP-band lines;
- assumption chips;
- "Not counted", the knife-edge badge and the footer.

**Each side panel:**
- The species, the forme (an "as Mega / before Mega" chip), nature, item and ability.
- **All six SP sliders**. The relevant attacking or defending stat is open; the rest sit under "⌄ more".
- A boost select from −6 to +6 for the move's stat, plus "more stages" for the others.
- HP %, status, and "item already used".
- These are the same inputs that `fieldControls` in `prep-calcs.js` uses today. Its controls move into a shared `calcControls(P, cd, sc)` so both screens use one implementation.

**Their side carries a source line**, built from the target row (`lib/prep-build.mjs` `targetsOf`):
- `source: 'set'`: "their saved set (Likely)".
- `'ladder'`: "ladder guess, Smogon Sept, most used spread: Jolly 29/1/0/0/4/32".
- `usageFrom: 'base'`: "Mega uses base Staraptor's usage".
- `'keymoves'`: "no usage data: moves from key moves".

When SP are unknown, a **frail / common / max** segment picks the spread (`withSpread`, i.e. the existing envelope rows). Touching a slider relabels the side "edited" and shows **↺ back to assumed**.

**Field:** today's `fieldControls` chips (weather, terrain, screens, Helping Hand, Intimidate, lone target / spread, crit, the More section) and the "Probably on the field" suggestions (`fieldSuggestions`), including the automatic Mega weather from `autoWeather`. Each one is a chip that's visibly on or off.

**Live:** every input change re-runs `calc.run` on the scenario through `B.hitScenario` / `B.theirHit`. That's one engine call per change, and it's cheap. Dragging a slider calls the engine at most once per animation frame. The result block updates in place, so the slider is never re-rendered under the thumb (the same trick `tb-sp-live` uses).

### B3. Rules
1. **Nothing in the workbench writes anywhere** until one of the two buttons is tapped. Closing (× / Esc / swipe down / Back) discards it, with no confirm, because nothing was saved.
2. **Apply to my set** applies only to *your* side, whichever role it plays (the attacker in KO calcs, the defender in survive calcs). It copies nature, item, SP and ability into the editor's **draft** (`updateDraft`), never into a version. The editor then shows "● unsaved changes" as usual, and Save still decides.
   - The button reads "Apply to my set (nature, SpA)" and lists exactly which fields differ. It is disabled when nothing differs.
   - A boost or field state is never applied, because those aren't set fields.
3. **Save as calc** stores the workbench as a normal notebook calc in the workspace for (you, that coach), using today's `entryFrom` / `summarize` / `attachKeys` path in `prep-calcs.js` (to be exported).
   - If no workspace exists yet, the tap creates it (an explicit action, as today).
   - The calc references your set by id and version; their side is a snapshot with `refs.defender.setId = null` and a provenance note ("ladder guess, Sept").
   - A toast offers "Open in Calcs".
4. **Whole-league scope:** the target row carries its coach, so Save as calc goes to that coach's workspace.
5. **A / B** (opened from a diff chip): a two-way switch above your panel swaps your side between pinned A and the current draft, and the result block shows both headlines stacked.

### B4. Phone (<768px)
- A full-screen sheet. The result block stays sticky at the top (2 lines plus the roll strip).
- Below it, a 3-way tab: **You · Them · Field**. Each tab is one column of 44px rows, and the sliders run full width with the number beside the label.
- The bottom bar holds **Apply to my set** and **Save as calc**.
- Close with × (top right, 44px), the system Back gesture (the sheet is a history entry), or Esc.

### B5. Modules

| Piece | Source |
|---|---|
| Scenario from (draft, target row, move, boosts, field) | `lib/prep-build.mjs` `hitScenario`, `theirHit`, `withSpread`, `autoWeather` |
| Running it | `P.calc.run` (`lib/calc/wrapper.mjs`); the envelope via `compute` (`prep-calcs.js`, exported) |
| Result block | `prep-ui.js` `resultBlock`, `rollsDetail`, `howCalculated`, `koWords` |
| Field and side controls | `prep-calcs.js` `fieldControls` / `fieldSuggestions` → extracted to a shared `calcControls` |
| Save as calc | `prep-calcs.js` `entryFrom`, `summarize`, `attachKeys` (to export), `P.ensureWorkspace` |
| Apply to my set | `prep-sets.js` `updateDraft` (via the teambuilder's `intoDraft`) |
| Sheet / modal shell | new: `public/prep-workbench.js` (state in `P.ui.wb`, a history entry for Back, focus trap, Esc) |

---

## C. Teams

### C1. Model (Showdown's, adapted)
- **A team** has a name and up to **6 slots**. Each slot holds one set.
- **A set belongs to exactly one team.** Copying a set to another team makes an independent copy, as in Showdown.
- **A box** is a team without the 6 limit. It's for storage, and it can't be brought to a match. There is one, "Imported sets", created by the migration and by "remove from team". It mirrors Showdown's "Box" format.
- **Only Anthony's 10 drafted species** can be added to a team (from the sheet, as today's roster). An imported set for a species he didn't draft lands in the box, flagged "not on your roster".
- **Rules shown as warnings, never blocks** (Showdown's teambuilder lets you build anything; the validator complains at the challenge):
  - **Species clause:** two of the same Pokédex number (e.g. two Rotom forms) → "Species clause: only one can be brought".
  - **Mega:** more than one Mega Stone is allowed. The note "Only one can Mega Evolve per battle; choose it per game" appears when there are 2 or more.
  - **Item clause:** the existing duplicate-item warning.
  - Fewer than 6: "4 of 6" (fine for building).

### C2. Screens and routes

| Route | Screen |
|---|---|
| `#prep/teams` | **Teams list**: one card per team, with its name, 6 sprite slots, a warnings dot and "used vs Calvin (W1)". Actions: **New team**, **Import team**. Per card under "⋯": Rename, Duplicate, Export, Delete. The box sits last, with a box icon. |
| `#prep/teams/<teamId>` | **Team builder**: Showdown's team view. 6 slot rows (sprite, name/item/ability, moves, stat summary), "+ Add Pokémon" (picker of your 10, already-used species greyed), drag or ↑↓ to reorder. Per slot under "⋯": Copy to…, Move to…, Export set, Remove (→ box). Team bar: Export team, Import into this team, "Bring vs… ▾". |
| `#prep/teams/<teamId>/<slot 1–6>` | **Set editor** (today's teambuilder editor) inside the team. The strip at the top is **this team's 6** (not "your 10"); "+" adds a mon. |
| `#prep/my-sets`, `#prep/my-sets/<setId>` | **Redirect** to `#prep/teams` / the set's team slot. Old links keep working. |

**Matchups.** "Your 6 for this match" becomes **"Bring: [team ▾]"**, set per workspace (`ws.teamId`) and shown in three places:
- the matchup header, next to "Next match";
- the Brief tray, replacing "My 6 0/6", where the lens "Your 6" then means "this team";
- the Plan board's "Your 6" row, which lists the team's mons.

The picker offers every team plus "+ New team from this matchup" (copies the current team as "vs Calvin").

Changing a set inside a team changes it for every matchup that brings that team. The team builder says so once: "Used vs Calvin, ZhuZi". This is the same behaviour as today's shared library, now visible.

### C3. Import and export (Showdown text, `lib/paste.mjs`)
- **Export team:** all 6 sets in `exportSet` format, with a `=== [gen9championsvgc2026regmc] Team name ===` header so it round-trips into Showdown's teambuilder. **Export set:** one set.
- **Import team** (Teams list): paste text → today's tiered import screen (`importScreen`), with EV→SP auto-converted where unambiguous (audit #11) → **a new team** named from the `===` header or "Imported team".
  - More than 6 sets, or several `===` blocks, make one team per block.
  - Species you didn't draft go to the box.
- **Import into this team:** each pasted set fills an empty slot. A pasted species already in the team asks "Replace Rotom-Fan's set / Add to box".
- **Import a single set into a slot** (slot "⋯"): replaces that slot's set. The old set goes to the box, and the version history moves with it.

### C4. Operations (all with Undo toasts, no confirm dialogs, except Delete team)

| Op | Effect |
|---|---|
| New team | Empty team "Team 1" (2, 3…), opened in the builder |
| Rename | Inline edit of the name |
| Duplicate | New team "<name> (copy)". Every set is deep-copied: a new set id, with **versions and history copied** and `copiedFrom: {setId, v}` |
| Delete team | Confirm: "Delete <name> and its 6 sets? Matchups bringing it: vs Calvin." Sets move to the box (not destroyed), and matchups bringing it fall back to "no team". Undo for 10 s |
| Copy set to… | Independent copy in the target team (or a new team), with `copiedFrom` |
| Move set to… | The same set id moves (history and calc references intact) |
| Remove from team | The set moves to the box |
| Delete set | Only from the box. Undo for 10 s, then gone (calcs keep their snapshots, as today) |

### C5. Data model change

`drafarig.prep.mysets` gets one new version. The existing `docVersion` mechanism makes older app builds go read-only instead of mangling it.

```
mysets v2 = {
  schemaVersion: 2, rev,
  sets:  [ lineage + { teamId: 'team_…' } ],          // unchanged lineage shape: id, speciesId, name, currentV, versions[], revealedTo, notes
  teams: [ { id: 'team_…', name, kind: 'team' | 'box', slots: [setId | null] (≤ 6 for 'team'),
             createdAt, updatedAt, from?: { ws: 'ws_…', migratedAt } } ],
  drafts                                               // unchanged, keyed by set id
}
workspace (any version) + { teamId?: 'team_…' }        // replaces my6 for new writes
```

- Add `'team'` to `ID_PREFIXES`.
- **Invariants:**
  - every set's `teamId` exists;
  - every set appears in exactly one team's slots (or in the box's list);
  - a `'team'` has 6 slots or fewer.
- Validation goes in `VALIDATORS.mysets`.

---

## D. Migration (runs once on load; nothing is lost)

**Input:**
- `mysets.sets`: each lineage with every version, `currentV`, drafts and `revealedTo`.
- Every workspace you own: its `my6` (`{setId, v?}`), `shortlist` (species), plan `cards` (set ids in `lead` / `bring4` / `mega`), `matches[].my6` and games (`myLead` / `my4` / `myMega`), and `calcs[].refs` (`{setId, v, side}`).

**Step 0: safety copy.**
- Before writing anything, save a full backup (`makeBackup`) under `drafarig.prep.keep.pre-teams`. The keep prefix is one no store version deletes.
- Backup & restore lists it: "Before teams (date)".

**Step 1: one team per matchup that chose sets.** For each of your workspaces with a non-empty `my6`, oldest `updatedAt` first:
1. Create a team named **"vs <coach>"** (with "(W<n>)" when it's on the schedule), `from: {ws}`.
2. Its slots are the first 6 `my6` entries, in order.
3. `my6` entries beyond 6 (today's "alternatives") go into a second team, **"vs <coach>: alternatives"**.
4. Species in `shortlist` with no set in `my6` become **empty slots** (`null` plus the species, shown as "Rotom-Fan: no set yet") while slots remain, so the team still says who you planned to bring.
5. Set `ws.teamId` to the new team.

**Step 2: give every set one home.** Walk the teams in creation order. For each slot's set id S:
1. **First team to claim S, and its `my6` pin (if any) equals `S.currentV`:** the team takes **S itself**. `S.teamId = team`, and the ids are unchanged.
2. **S is already claimed, or the pin is an older version:** make a **copy** C.
   - A new set id, with **all versions deep-copied** (same v numbers, dates, reasons, provenance).
   - `C.currentV` = the pinned v (or `S.currentV`).
   - `C.copiedFrom = {setId: S.id, v}`, and `C.revealedTo` = a copy of `S.revealedTo`.
   - The slot points to C.
   - S's unsaved draft stays on S only (a draft is one editing session and isn't duplicated). The migration notice says "Rotom-Fan had unsaved changes: they're on the copy in Imported sets / vs Calvin".

**Step 3: everything else goes to the box.** Sets not claimed by any team go into the box **"Imported sets"**, in their current order. That includes sets used only by deleted matchups and sets never put in a 6.

**Step 4: references.**

| Reference | Rule |
|---|---|
| `calcs[].refs.setId` + `v` (all workspaces) | **Unchanged.** Originals keep their ids and versions, and lookups stay global (`P.lineage` searches every set), so every calc still resolves and `staleReasons` works as before. A calc whose set now lives in another team shows "set: Rotom-Fan (Imported sets)". |
| Plan `cards` (`lead`, `bring4`, `mega`) in workspace W | **Remapped** to the copy that W's team now holds (S → C), because cards are W's plan for that team. Cards using `card.species` (Plan board v3) need nothing. |
| `matches[].my6`, games `myLead` / `my4` / `myMega` | **Unchanged.** They are a record of what was brought; history points at the original set and version. |
| `ws.my6`, `ws.shortlist` | **Kept as they are, read-only**, for one release, so an older build or a rollback still reads them. New writes go to `teamId`. The Brief tray reads the team; it falls back to `shortlist` only when `teamId` is null. |
| `variants` / their sets | Not affected (their sets are per workspace, not teams). |

**Step 5: versions.**
- `mysets` becomes v2. Every workspace with a `teamId` is saved with a version bump, so the existing "newer data: read-only" banner appears in older tabs and builds.
- A one-time notice on the Teams list summarises it:
  > We put your sets into teams. vs Calvin: 6 sets · vs ZhuZi: 4 sets (2 copied from vs Calvin) · Imported sets: 3. Nothing was deleted: [See the backup] [Got it]

**Idempotence:** the migration runs only when `mysets.schemaVersion < 2`, and a v2 document is never migrated again. A crash mid-way leaves v1 untouched, because all documents are written in one flush after a successful in-memory build.

**Test vectors (Developer):**
1. A set in no `my6` → box.
2. A set in two `my6` → original in the older team, copy (history equal, `copiedFrom`) in the newer one. That workspace's plan cards point at the copy; its calcs at the original.
3. `my6` with 8 entries → a team of 6 plus an alternatives team of 2.
4. A pinned `v` older than `currentV` → copy with `currentV = v`; the original goes to the box (if unclaimed) with its own `currentV`.
5. Shortlist-only → a team of empty species slots.
6. A round trip through backup/restore at v1 restores the exact pre-teams state.

---

## Mockup notes
- `teams.html`'s damage function follows the standard Gen 9 order. It reproduces the reference goldens exactly:
  - Thunderbolt 152–182, Life Orb 198–237 and 133–159 at SpD +1, +2 16 SpA 186–218 (13/16), Helping Hand 230–272, Air Slash 128–152;
  - Charizard-Y G1–G5 (sun and no sun).
- I checked it in Node with a stubbed page. **It has not been opened in a real browser** (headless Chrome is blocked in this sandbox).
- What it leaves out:
  - the A/B switch;
  - abilities beyond the Mega Charizard Y forme;
  - multi-hit moves.
- What it simplifies:
  - EV→SP import is approximate (the app's `paste.mjs` rule is the real one);
  - "Save" and "Undo" are toasts only.

## E. Decisions needed from Anthony

1. **Sets shared or copied between teams?** The spec copies them (Showdown behaviour, and his words: "sets only exist as a child of a team"). It means editing Rotom-Fan in "vs Calvin" doesn't change it in "vs ZhuZi". Confirm.
2. **The box:** is an "Imported sets" box acceptable as the one exception to "sets only exist in a team"? The alternative is splitting leftovers into teams of 6 named "Imported 1, 2…".
3. **Team per matchup by default?** When a new matchup starts, should it bring the **last team used**, or ask?
4. **Save as calc** files under the opponent's matchup. Is that where he'd look for it, or should there be a global "Saved calcs"?
5. **Workbench "Apply to my set"** goes to the draft, so Save is still needed. Or should it save a version straight away?

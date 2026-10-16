# Teams and the calc workbench: developer plan

Drafarig Developer, 2026-10-16. This is read-only preparation on `prep-builder` at 67e226c (live v9). No app code changed.
Everything below cites the code as it is at that commit.

Anthony's two requests:
- **(a) Calc workbench.** Every automatic number (a move-strip card, a slider-mark tap, a diff-bar item) opens a modal. Both
  sides' full sets are editable there: SP sliders, nature, item, ability, boosts and field. It recalculates live and closes back.
  It never changes a saved set unless he taps **Apply to my set**.
- **(b) Teams.** Your sets are organised like Showdown: teams of up to 6 drawn from your 10 drafted mons, and a set exists
  only inside a team. You can import or export a team or a set, and copy or move sets between teams. A matchup picks which
  team it brings, which replaces today's per-matchup `my6`.

---

## 1. Data model

### 1.1 What is stored today

Storage is device-local `localStorage`, one JSON document per key. Each document has `schemaVersion` and `rev`. Saves are
refused when `rev` moved, so two tabs can't silently overwrite each other. A document written by a newer app is read-only.
- `lib/prep-store.mjs createStore`: the per-key `rev` check, plus the vault and keep recovery copies (`drafarig.prep.vault.*`,
  `drafarig.prep.keep.*`).
- `lib/prep-schema.mjs migrate`: the newer-app check.

| Key | Document | Holds |
|---|---|---|
| `drafarig.prep.mysets` | `{schemaVersion:1, rev, sets:[lineage], drafts?:{setId: draft}}` | **Your sets**, all of them, flat. Shared by every matchup. |
| `drafarig.prep.ws.<wsId>` | workspace (`newWorkspace`, prep-schema.mjs L76) | One coach (`pov`) vs one opponent (`coach`): `theirSets:[lineage]`, `variants`, **`my6:[{setId, v?}]`**, `shortlist:[species]`, `plans`, `cards`, `calcs`, `mockSets`, `matches`, `reveals`, `findings`, `revisions`, `drafts` (their sets) |
| `drafarig.prep.meta` / `.rules` / `.pilot` | index, league rules, pilot teams | `pilot.teams` are *friends'* opponent teams (prefix `pilot`): unrelated to this plan |

- **A lineage** (`lib/prep-model.mjs newLineage`) is `{id: 'set_…', side, speciesId, name, currentV, versions:[{v, at,
  reason, data, provenance?, revisionId?}], revealedTo?}`.
  - Versions are immutable. `addVersion` appends `v+1`, and `setCurrent` moves the pointer.
  - `pruneVersions` keeps the newest 10, plus every **referenced** version and the current one.
- **References to your sets by id.** These are what must keep resolving.
  - In versioned form `{setId, v}` (collected by `referencedVersions`, prep-model.mjs L50):
    - `ws.calcs[].refs.{attacker,defender,second}`;
    - `ws.mockSets[].mySets[]`;
    - `ws.matches[].my6[]`, a historical record of what was brought;
    - `ws.revisions[].changes[]` (`setId`, `fromV`, `toV`; six-swaps use `out`/`in`).
  - As plain set ids: `ws.cards[]` (`bring4`, `lead`, `back`, `mega`), `ws.my6[].setId` and `mysets.drafts` keys.
  - `lib/calc/keys.mjs staleReasons` marks a calc out of date by comparing `refs.*.v` with the set's current `v`.
    `P.lineage(setId)` (prep.js) searches `mysets.sets`, then the workspaces' `theirSets`.
- **Document versions** (`docVersion`, prep-schema.mjs L16):
  - every document is v1, except a workspace with `pov`, which is v2, and one with Plan-board species cards, which is v3;
  - `SCHEMA_VERSION = 3`;
  - older apps treat a higher version as "newer" and turn their Prep read-only. That is the mechanism the v3 and v4
    compatibility tests prove (`test/prep-compat.test.mjs`, `test/prep-compat-v4.test.mjs`, which run the published v3/v4
    from git).
- **`ws.my6` is read in about 30 places**: prep-sets, prep-calcs, prep-board, prep-plan, prep-practice, prep-matchup,
  prep-teambuilder, prep.js (the Build redirect), lib/prep-backup `opponentDocs`, lib/prep-matchup, lib/prep-coverage and
  lib/prep-model. Writers: `toggle-six`, `set-save-copy` (re-points my6), `set-delete`, revisions (six swaps), and
  `match-start` / `match-six`, which copy it into `matches[].my6`.

### 1.2 Proposed schema (minimal)

The design choice that keeps it small: **teams are a new document, and a team only references sets by id. The lineages
stay exactly where and as they are.**
- Nothing that points at a set id has to change.
- `mysets` stays a version-1 document, so the published v3/v4 compatibility tests keep passing unchanged. They assert that
  `mysets` stays writable by v3.
- Lookups (`P.lineage`), staleness, pruning and restore merging keep working as they are.

**New document `drafarig.prep.teams`** (type `teams`, added to `KEYS`, `typeOfKey`, `VALIDATORS` and `docVersion`; new id
prefix `team` in `ID_PREFIXES`):

```js
{ schemaVersion: 1, rev, teams: [
    { id: 'team_xxxxxxxxxxxx', name: 'vs Calvin', kind: 'team' | 'holding',   // holding = "Imported sets", no 6-limit
      slots: ['set_…', …],            // ordered; kind 'team': at most 6, one per species (species clause is a warning)
      createdAt, updatedAt, origin?: { kind: 'migrated-ws', wsId } | { kind: 'import' } | { kind: 'created' } } ],
  order: ['team_…', …] }              // display order
```

**Rules:**
- **Ownership.** A set (`mysets.sets[i].id`) belongs to exactly one team. `copy` makes a new lineage; `move` changes which
  team's `slots` lists it. Move keeps the id, so every calc, mock and match reference keeps resolving.
- **Copy.** A new id, the full `versions` array cloned with the same `v` numbers, plus `copiedFrom: {setId, v}`. A copy is
  not referenced by anything yet, so nothing needs re-pointing.
- **Workspace (additive field).** `teamId?: 'team_…'` is the team this matchup brings. `docVersion('ws', d)` returns 4 when
  `teamId` is set, and `SCHEMA_VERSION` becomes 4.
  - Today's live v9 and older apps read such a workspace as "newer" and go read-only for it. They can't keep editing
    `my6` behind the new app's back.
  - `my6` is **kept untouched** in the document as the pre-teams record (rollback and older-app safety). The new app stops
    writing it, and reads the six from the team.
- **One accessor replaces every `ws.my6` read:** `mySix(P, ws)` returns `team.slots.map((id) => ({setId: id}))` when
  `ws.teamId` resolves, else `ws.my6` (a workspace not migrated yet, or an unknown team). Every writer goes through
  `setTeamSlots(P, teamId, slots)`.
- **`matches[].my6` stays as is.** It is history ("what I brought that day") and should not follow later team edits.

### 1.3 Migration: lossless, idempotent, rollback-safe

Migrations in `migrate()` are per document. This one spans `mysets`, every workspace and the new `teams` document, so it
runs as a **data step in `P.init`**, after all documents are loaded (prep.js L68–87) and before the first render.

**Preconditions** (any one failing means no migration this load, and the app works exactly as v9):
1. `P.readOnly()` is false: no document from a newer app, and no conflicts or corrupt documents.
2. A pre-migration backup exists (§1.3.4).
3. `teams` is missing, or it exists and some owned workspace still has no `teamId` (resume an interrupted run).

**Algorithm** (deterministic, so two tabs or a re-run produce the same result):
1. Take your own workspaces (`ownerOf(ws) === P.ownSide()`) with a non-empty `my6`, oldest `createdAt` first, ties by id.
   Each becomes a team:
   - `id = 'team_' + base32(sha256('ws:' + ws.id)).slice(0, 12)`, deterministic, so a second tab creates the same id;
   - `name = 'vs ' + ws.coach`, `kind: 'team'`, `slots = ws.my6.map((m) => m.setId)`, de-duplicated, existing sets only,
     at most 6;
   - `origin = {kind: 'migrated-ws', wsId}`.
2. **Ownership conflicts.** A set already placed in an earlier team, and present in another workspace's `my6` too (today
   one set can sit in several matchups' 6), is **shared**, not copied: it is listed in both teams' `slots` and marked
   `shared: true` in each team's `sharedSetIds`.
   - This is the one exception to "exactly one team", and it holds only for migrated data. The UI says "also in team X:
     editing changes it there too", which is exactly today's behaviour ("Saving changes this set everywhere it is used",
     prep-sets.js).
   - "Make a separate copy for this team" is an explicit tap: it copies the set and re-points *only that team's* workspace
     references (my6 and card ids; not calcs, which stay on the original version they were checked with).
   - Copying silently during migration would have to rewrite calcs, cards, mocks and revisions in several workspaces. That
     is the riskiest kind of write, and it buys nothing until he actually wants the sets to differ.
3. Every remaining set in `mysets.sets` that is in no team goes into one `kind: 'holding'` team, "Imported sets" (with the
   id `team_imported…`, deterministic). After this, every set is in a team.
4. Write order: first `teams` (one atomic document), then each workspace with `teamId` added. If a run is interrupted
   between writes, the next load sees the precondition-3 case and completes it. Ids are deterministic and slots are
   rebuilt from `my6` (which is never modified), so resuming is idempotent.
5. **Reconcile on every load** (cheap, pure, idempotent):
   - a set in no team (one created by an older app's tab, or a restore) is appended to "Imported sets";
   - a slot whose set no longer exists is dropped and reported once ("1 set in vs Calvin was deleted elsewhere");
   - a workspace `teamId` pointing at a missing team falls back to `my6`, and the matchup asks "Pick a team".

**Lossless.** No lineage, version, provenance, `revealedTo`, calc, card, mock, match or revision is modified or removed.
The migration only adds the `teams` document and one field per workspace. Every `{setId, v}` reference resolves to
byte-identical version data before and after. That is the invariant the tests check (§3.2).

**Rollback.**
1. *Backup.* Before the first write, the app builds `makeBackup(P.allDocs(), {kind: 'full'})` (lib/prep-backup.mjs) and
   stores it under `drafarig.prep.premigration.teams-v4`. A store that doesn't recognise the key never touches it
   (`typeOfKey` returns null). If it doesn't fit the storage budget, nothing is migrated. Teams then show "Set up teams:
   downloads a backup first" (`P.downloadBackup`), and migration runs after that download.
2. *Undo in this app.* Settings → "Undo teams setup" removes `drafarig.prep.teams` and deletes `teamId` from each workspace.
   That is exactly the pre-migration state, because nothing else changed. A team created *after* migration is lost on undo,
   and the button says how many.
3. *Back to an older app.* After migration, v9 sees version-4 workspaces as newer (read-only) and keeps reading/writing
   `mysets` normally. To roll the app back fully, restore the stored backup in the older app ("Replace everything").
   `planRestore` accepts it because its `schemaVersion` is ≤ 3.

**Backup and restore of teams.**
- `opponentDocs(ws, mysets)` also exports the team that workspace brings, plus every set in it.
- `planRestore` gets a `teams` merge: union by team id; on a clash, keep both with " (from backup)". `mergeMySets` already
  unions set versions.
- `readBackup` accepts the new key type.

### 1.4 Teams operations (pure, in `lib/prep-teams.mjs`, unit-tested without a DOM)
- `createTeam`, `renameTeam`, `addToTeam(teamId, setId)` (refused when it would exceed 6 or duplicate a species; a warning,
  not an error, while drafting).
- `moveSet(from, to, setId)` (same id: references keep resolving).
- `copySet(setId, toTeam, newId)` (cloned versions plus `copiedFrom`).
- `deleteTeam` (its sets go to "Imported sets", never deleted with it).
- `importTeam(parseTeam result)` (`lib/paste.mjs`, with the existing tiers and questions).
- `exportTeam` (`lib/paste.mjs exportTeam`).
- `teamOfSet` and `mySix`.

All of them return new documents. `P.mutate('teams', …)` saves them with the usual `rev` check.

---

## 2. The calc workbench

### 2.1 What can be reused

| Piece | Where | Reuse in the workbench |
|---|---|---|
| Scenario model and normalisation | `lib/calc/scenario.mjs normalizeScenario` | As is: the workbench state *is* a scenario (both sets, both side states with boosts, status, HP%, Intimidate, field, move flags) |
| Engine, envelopes for unknown SP | `lib/calc/wrapper.mjs createCalc().run / .envelope / .spreadFor`; `public/prep-calcs.js compute()` | As is. Measured (Node, Apple silicon): `run` costs **0.05 ms lite / 0.09 ms full**. Expect roughly 10× on a mid-range phone (≈1 ms), so recalculating on every slider tick is affordable; rendering is the real cost |
| Result anatomy | `public/prep-ui.js resultBlock, rollsDetail, howCalculated, koWords, headline` | As is |
| Field and side controls | `public/prep-calcs.js fieldControls(P, ws, cd, sc)` (weather, terrain, Intimidate, Helping Hand, screens, stages −6..+6, HP%, status, forms, Mega-not-yet) | **Small refactor:** its actions (`calc-set`, `calc-stage`, `calc-status`, `calc-hp`, …) write to `cdOf(P)`, the matchup's quick-check slot. Add a `data-slot` (`cd` \| `wb`) to every control it renders, and resolve the slot in those handlers: `slotOf(P, t) = t.dataset.slot === 'wb' ? P.ui.wb : cdOf(P)`. The quick check keeps working unchanged |
| Set controls (nature, item, ability, moves, SP sliders with in-place drag updates) | `public/prep-teambuilder.js` (`setRow`, `statsPanel`, the `tb-sp-live` input handler) | Extract a `setPanel(P, side, set, {slot})` helper. In the workbench it edits the local copy, never a draft. The marks are left out in v1 (focus) |
| Weather on Auto, Mega forms | `lib/prep-build.mjs autoWeather, myForme` | Default field when opened from the teambuilder, shown as a chip the user can change |
| Saving a new version | `public/prep-calcs.js promote()` (checkSet gate, `addVersion`, "N calcs now out of date" toast) | **Apply to my set** |

### 2.2 State flow

1. **Open.** A strip card, a mark's tap or a diff-bar item calls `openWorkbench(P, seed)`. The seed is
   `{attacker, defender, move, field, aState, dState, origin}`:
   - your side is `asSet(lineage, currentVersion)`, or the teambuilder **draft** when there is one;
   - their side is the target row's assumed set (saved set, else the labelled ladder guess, with the spread the number used:
     frail / common / max);
   - `origin = {kind, setId, side: 'attacker' | 'defender', fromV}` records which of your sets it came from and at which
     version.
2. **Local state.** `P.ui.wb = structuredClone(seed)`. It is session-only, like the other screen drafts (`P.saveUi`), so a
   phone discarding the tab keeps it. Every control writes only to `P.ui.wb`. The scenario is
   `normalizeScenario({attacker: {set, state}, …})`, and the sets go in as *snapshots*: `buildScenario` already accepts
   `ref.snapshot`, and no lineage is looked up. Nothing in `P.docs` is touched while the workbench is open.
3. **Recalculate.**
   - While dragging (`input`), the row updates in place, as the teambuilder already does. One `calc.run` on the next
     animation frame then patches only the headline numbers.
   - On release (`change`) or any other control: one full render of the modal.
   - Unknown opposing SP keeps the frail / common / max envelope (3 runs).
4. **Close.** The modal goes away with no write, and focus returns to the control that opened it (`P.focusOn`).
5. **Apply to my set** (only on your side, only when it differs from `origin.fromV`). It calls
   `promote(P, ws, origin.setId, data, 'from the calc workbench')`: a new immutable version with the usual toast.
   - If that set's current version moved since opening (another tab, or the teambuilder), it asks first: "Your set changed
     since you opened this: apply anyway as v{n+1}?"
   - Their side gets **"Save as their set"** only inside a matchup (a new version of that `theirSets` lineage, source
     `my-guess`), never automatically.
   - Open question for UI UX: should Apply write a version directly (as above), or put the change in the teambuilder draft
     so that Save version stays the only write? I'd keep it direct and explicit, because the button says what it does.
6. **Modal mechanics.** It is not a route; the URL doesn't change. Opening it does
   `history.pushState({prep: true, wb: true}, '', sameHash)`, so the phone Back gesture closes it (popstate with `wb`
   closes instead of navigating). It renders as `<div role="dialog" aria-modal="true" aria-labelledby>` after the screen in
   `P.render`, with Escape to close (`prep.escape()` already exists) and focus trapped by the existing focus restore.

### 2.3 Phone performance
- **Engine.** It is already lazy-loaded (`P.ensureEngine`) and is certainly loaded when a number exists to tap.
- **Per interaction.** At most 1 run while dragging (rAF-throttled) and 1–3 runs per change, about 1–3 ms on a phone.
  Re-rendering the modal (about 6–10 KB of HTML), not the calc, is the cost. Keep the modal out of the main screen's render
  path: render the modal alone while it is open, keep the screen behind it inert, and re-render the screen once on close.
- **No marks in the workbench** in v1, so no `koSearch` sweeps run while it is open. The teambuilder's marks are still
  computed once per set shape in idle time.
- **Measure before shipping.** In Chrome DevTools with 4× CPU throttling: drag frame time, and change-to-paint time. The
  target is < 16 ms per drag frame and < 100 ms per change.

---

## 3. Risks, tests and order of work

### 3.1 Risks
| Risk | Mitigation |
|---|---|
| Migration interrupted between documents (tab killed, quota) | Write order teams → workspaces; deterministic ids; resume on next load; `my6` never modified |
| Two tabs migrate at once | Same deterministic result; the second tab's save hits a `rev` conflict, and the existing conflict banner and reload adopt the first tab's documents |
| An older tab (v9) open during migration | Its next save of a version-4 workspace is refused ("newer"), and its Prep turns read-only (proven pattern). `mysets` writes from it still succeed, and the reconcile step absorbs new or deleted sets |
| Storage quota (the backup roughly doubles prep size once) | Size check first. If it doesn't fit, nothing is migrated and the user is asked to download a backup instead |
| A shared set (in two migrated teams) edited "for one matchup" | Visible "also in team X" note plus an explicit "Make a separate copy"; no silent copies |
| About 30 `my6` call sites | One accessor (`mySix`) and one writer (`setTeamSlots`); a grep test that `ws.my6` is only read in `lib/prep-teams.mjs` and the migration |
| Workbench edits mistaken for saved changes | A "Not saved: workbench only" line in the modal header; Apply shows the version it creates; an explicit conflict question if the set moved since opening |
| `fieldControls` refactor breaking the quick check | Slot defaults to `cd`; the existing calc notebook tests (`prep-calc-cards`, `prep-ux`, `calc-review-*`) must pass unchanged |

### 3.2 Test plan
1. **Pure teams logic** (`test/prep-teams.test.mjs`): create, add (6-limit, species warning), move (references unchanged),
   copy (versions cloned with the same `v`, `copiedFrom`), delete team (its sets go to Imported), import and export a team
   (round-trip through `parseTeam` / `exportTeam`).
2. **Migration** (`test/prep-migrate-teams.test.mjs`, documents built like `test/prep-helpers.mjs device()`):
   - one team per owned workspace with `my6`, plus "Imported sets" for the rest. Every set is in exactly one team, except
     the shared ones, which are listed;
   - **lossless:** for every `{setId, v}` collected by `referencedVersions` across all workspaces, plus every `my6` and
     `cards` id, the resolved version data is identical before and after. The `mysets` document is byte-identical, and every
     workspace differs only by `teamId`;
   - **idempotent:** migrating a second time leaves everything unchanged (deep equal, same `rev`);
   - **resume:** with `teams` written and workspaces not yet, the next load completes the run with the same team ids;
   - **reconcile:** an orphan set joins Imported, and a dangling slot is dropped and reported once;
   - **no backup space:** no writes, and the "download a backup first" state appears;
   - **undo teams setup:** brings back the exact pre-migration storage snapshot (`snapshot()` as in the compatibility tests).
3. **Compatibility.**
   - The existing `prep-compat.test.mjs` (v3) and `prep-compat-v4.test.mjs` (v4) pass **unchanged**. That is the reason
     `mysets` is not bumped.
   - New `test/prep-compat-v9.test.mjs` materialises the live v9 (67e226c) with `git archive`, as the v4 test does:
     - v9's store reads a `teamId` workspace as newer and refuses to write it;
     - a v9 app booted on migrated storage is read-only for those workspaces and changes nothing;
     - a set v9 adds to `mysets` appears in "Imported sets" on the next load of this version;
     - a v9 "Replace everything" restore of the pre-migration backup leaves a v9-usable device.
4. **Workbench** (UI harness):
   - open it from a strip card, a mark and a diff item;
   - edit both sides (SP, nature, item, boosts, weather): the numbers follow, and **no stored document's `rev` changes**;
   - Close: nothing changed and focus returns;
   - Apply creates exactly one new version with the edited data;
   - the conflict question appears when the set moved since opening;
   - Back (popstate) closes it;
   - golden check: the Rotom-Fan and Mega Charizard Y reference numbers (rotom-fan-case.md §9, dashboard-goldens.md G1–G5)
     reproduce when the workbench is seeded with those sets.
5. **Phone:** CSS rules as in `test/prep-teambuilder.test.mjs` (the modal is full-screen below 768px, 44px targets, no
   horizontal scroll), plus the manual throttled-CPU measurement in §2.3.

### 3.3 Order of work
1. **`lib/prep-teams.mjs` and the `teams` document** (schema, validator, store key type, backup and restore merge), with
   unit tests. No UI change yet.
2. **`mySix` / `setTeamSlots`.** Route every `ws.my6` read and write through them while they still return `ws.my6`. This is
   a pure refactor, and the whole suite must stay at 376/376.
3. **Migration, reconcile, the pre-migration backup and Undo**, with the migration and v9 compatibility tests. At this
   point the accessor switches to teams.
4. **Teams UI** (UI UX spec): the teams list, the team as the teambuilder's team strip, the matchup's "Bring team ▾",
   import/export of a team or a set, copy/move. The teambuilder's team strip already exists; it changes source from `my6`
   to the team.
5. **Workbench**: the `fieldControls` slot refactor (quick-check tests unchanged), then `setPanel` extraction from the
   teambuilder, the modal shell (dialog, Back, Escape), then the entry points (strip cards, mark taps, diff items), then
   Apply.
6. **Phone pass**: throttled measurement, CSS and the harness phone tests. Then hand to the lead for headless-Chrome QA.

Steps 1–3 are invisible to Anthony but carry all of the data risk, so they ship first, and alone, behind their tests.
Step 5 is independent of teams and could go first if he wants the workbench sooner. It only needs the slot refactor.

# Drafarig

A local helper for Anthony's Pokémon Champions VGC draft league (Reg M-C, 10 coaches, 10 picks on 100 points).
It reads the league's published Google Sheet **on every page load** and helps with the next pick, the budget,
team weaknesses, and opponents' threats.

## Run

```sh
node server.mjs        # or: npm start
```

Then open http://localhost:4600. The server binds to 127.0.0.1 only. Change the port with `PORT=4700 node server.mjs`.

- Needs Node 20 or newer (Node 24 is at `~/.local/bin/node`). There are **no dependencies** and no `npm install` step.
- Internet access is needed for the league sheet, Smogon usage stats and sprites. If the sheet can't be reached, the app shows the last good copy (`data/cache/sheet-last-good.json`) with a warning.

## Test

```sh
npm test               # builds the Worker artifact, then node --test: 458 tests (calc engine, searches, Prep UI on a stub DOM, Build, chat, Worker)
```

The tests use a saved copy of the real sheet in `test/fixtures/`, so they run offline.

## What's where

| Path | What |
|---|---|
| `server.mjs` | Static files, `GET /api/sheet` (live sheet, no-store and cache-busted, with a last-good fallback), `GET /api/usage` (Smogon chaos stats, slimmed and cached 24 h in `data/cache/`) |
| `lib/sheet.mjs` | Sheet URLs, CSV parser, board/drafts parsers, red-text detection from the published HTML |
| `lib/league.mjs` | League state: the Drafts tab is the source of truth, board red text is a cross-check, warnings, and turn order |
| `lib/names.mjs` | Sheet name → Showdown id (typos, regional forms, gender forms) and suggestions |
| `lib/budget.mjs` | The 10-mon / 100-point feasibility rule; Affordable / Tight / Breaks budget |
| `lib/analysis.mjs` | Type matchups for every form, role checklist, speed, threats, and the roster score |
| `lib/optimizer.mjs` | Complete-roster plans (exact-count knapsack DP, then re-ranking, then diversity) and reason chips |
| `public/` | The page (`index.html`, `app.js`, `styles.css`, `glossary.js`). Plain ES modules with no build step; it imports `lib/` directly. |
| `data/dex.json` | Generated Pokémon data for the 257 board species and their 82 Champions Megas |
| `tools/build-data.mjs` | Regenerates `data/dex.json` from `docs/research/` plus Showdown's type chart and sprite names (`npm run build-data`) |

`lib/` is shared by the server, the browser and the tests.

## Teams (Battle Prep › Teams, `#prep/teams`)

Your sets live in teams of up to 6 from your 10 drafted Pokémon, like Showdown's teambuilder; "Imported sets" is the one box
for sets in no team. A set belongs to one team: copying it to another team makes an independent copy (same history), moving
it keeps it. Teams can be created, renamed, duplicated, deleted (sets go to the box; Undo), exported and imported as
Showdown text (a Showdown export's EVs convert to Stat Points on import, with a note per set; only sets that can't be legal
are held back, by name). A matchup brings one team ("Bring" on its Sets tab); a new matchup brings the last team used. Species clause,
two Mega Stones and a repeated item are warnings, never blocks. Existing prep moves into teams once, on load, after a backup
is kept on the device (Backup › Teams has Undo). Logic: `lib/prep-teams.mjs`; screens: `public/prep-teams.js`.

## Move search (`#prep/moves`)

Who in a scope (one opponent's 10, all opponents, the whole draft board, your 10) can LEARN a move: by name, type, category,
minimum power, flags (spread, priority, contact, sound, secondary effect) and ability. Full legal learnsets from
`data/mechanics.json`, never usage, so drafted mons with no ladder data are included. Abilities that power the move up are
starred (Sheer Force + a secondary effect, Technician + ≤ 60 BP, …); each result has a worst-case damage chip into your sets
that opens the workbench. Logic: `lib/move-search.mjs`; screen: `public/prep-moves.js`.

## Worst-case threats ("Can wreck you", "Threats to this mon")

`lib/threat-scan.mjs` implements `docs/research/strategy/threat-scan.md` §2: every form of every drafted opponent mon, its full
learnset × each damage-relevant ability × Life Orb / the move type's item / its ladder item (Megas: their stone), max offence,
spread ×0.75, every weather or terrain their roster can set (and your own sun around Mega Charizard Y), into your saved sets.
Ranked by OHKO odds × plausibility (×1.25 spread, ×1.25 priority); no-usage mons are not down-weighted. The Brief's "Can wreck
you" shows what OHKOs Mega Charizard Y, spread double KOs, priority KOs and the top 3 per mon; the teambuilder lists the
threats to the set being edited. Each row names its conditions and whether it's the ladder set or a learnset worst case.
Goldens G1–G7 are in `test/threat-scan.test.mjs`.

## Matchup guides (`lib/guides/`)

A guide is curated advice for one matchup (`docs/research/strategy/guide-schema.md`), one `lib/guides/<pov>v<opp>.mjs` each,
listed statically in `lib/guides/index.mjs` (tolerant validation, matched by the opponent's name, stale detection from
`rosters` or the species it mentions). `public/prep-guide.js` puts it into the existing screens
(`docs/research/ux/matchup-guide.md`): the Brief's "Game plan" card (remember, bring, "His preview shows…" which sets the
Brief to those 4, folded leads / tells / how we lose / endgame / our double KOs), a "G" dot and Guide blocks on the detail
sheets, a Guide box in the teambuilder ("Guide runs …" · Try it), every guide number as a workbench link with a "Guide: … ·
now …" line, its double targets and answers merged into "Can wreck you", "Import as team" / "Update from guide" (never
overwrites; "Use guide version" adds a version), a Fill row on the Plan board, a Move search sub-line, and a "Game plan"
button on Brief, Plan and Sets. Only for your own side; no guide = the screens as before.

Every calc in every guide and curated mock must reproduce in the app's engine within 0.5 points of its stated range
(`test/curated-calcs.test.mjs`, one failure list; known exceptions sit in its `PENDING` list with a reason).

## Mocks (`#prep/mocks`)

Play a friend's next opponent on Showdown (`docs/research/ux/mocks.md`): pick the friend and the week, then **Open as X**
opens the normal matchup workspace from X's side (Jacky vs Calvin = `#prep/4v8`) with a banner ("Mock · playing as Jacky vs
Calvin · nothing here touches your own prep", Copy for Showdown, Exit). There the mock's team IS "your sets" and "your teams"
(`public/prep-mockpov.js`: `P.docs.mysets` / `P.docs.teams` read the mock on its screens, one team per variant in Sets ›
Bring): Brief, Can wreck you, Plan, Sets, the teambuilder, Calcs, the workbench and Practice all work as for your own
matches. The curated notes render as the Brief's Game plan card (guide renderers; every calc a workbench link); a generated
mock adds Watch out / Your KOs there. Edits save to the mock's record (labelled "edited"); the workspace carries `mock`
(its record id) and is never one of your matchups, teams or saved lists. Your own documents are written only through
`R` in `public/prep.js`, so a mock can't reach them (tested byte-identical). "Record & note for Y" keeps the Team / Notes /
Log screen with the running record and the note for the friend (never your own sets). Storage: optional `mocks` entries on
the pilot document and the optional `mock` field on a workspace (no version bump).

- **Curated** (`lib/mocks/<x>v<y>.mjs`, static registry in `lib/mocks/index.mjs`, tolerant validation, stale when either
  roster changes).
- **Generated** (`lib/mock-gen.mjs`, `docs/research/dev/mocks-plan.md` §2) when there's no curated one: both directions of the
  worst-case threat scan over X's drafted 10 vs Y's, scored by offence into Y, Y's hits back, shared spread weaknesses and
  roles (weights in code), then every legal six is enumerated: species clause by dex number, at most one Mega, the item clause
  (a moved item marks the set "matchup-tuned"); every set is made coherent (a Choice item runs no status moves, no two moves of one type unless a spread / stronger single-target split, Protect kept where the ladder runs it). No-usage mons stay in (full-learnset worst case). Variants: best six, best with
  another Mega, next best. Each set is labelled ladder / matchup-tuned / worst case / your guess / edited.
- **Edit ›** changes a mock set (nature, item, ability, moves, Stat Points); saved on the mock's record only. **Regenerate**
  asks first when it would replace your edits. "Use my saved guesses of X's sets" is opt-in, with a warning that the friend
  will see them. The generated team is stored on the record the first time you copy, log or edit it.

## Teambuilder (the set editor: a team's slot, or a matchup's Sets)

Opening one of your sets opens the teambuilder (`#prep/my-sets/<id>`, `#prep/w/<ws>/sets/<id>`), laid out like Showdown's
(our own markup and CSS; sprites are the app's portraits):

- **Checking against** a scope: your marked or first scheduled opponent by default, any other opponent, or the whole league.
- **Team strip**: your 6 for that opponent, then the rest of your 10; tap one to edit its set.
- **Set card**: nickname, item and the 4 moves as type-to-search fields (legal lists only), ability, mini stats.
- **Stats panel**: a 0–32 Stat Point slider per stat (66 in total) with nature colours, base, bar, final stat and the remaining
  count. The sliders carry **marks**: Speed points that outspeed or tie their mons (ladder spread where known), the least
  SpA/Atk for an OHKO / 2HKO / +2 OHKO with a setup move / OHKO with Life Orb (dashed when it needs another nature or item),
  and HP + Def/SpD pairs that survive their strongest common hit. Tap a mark for its one-line calc.
- **Calc strip**: tap a move to see it against their mons (+0, the setup stage, and no-sun for a Drought set).
- **Pin as A**, then drag or tap a **try:** idea: a diff bar shows Speed rank, marks gained or lost and the bulk score.
- **Save version / Save as a new set / Discard**, history, and Showdown **Import / Export**. Nothing saves until you press Save.
- **Workbench** (`public/prep-workbench.js`): a strip value, a mark's "Open in the workbench", a "no OHKO" target or a diff
  item opens that calc with both sides editable (SP, nature, item, ability, stages, their spread) and the field (weather,
  terrain, screens, Helping Hand, crit, Intimidate, target HP). **Apply to my set** writes your side into the draft; **Save as
  calc** files it under that opponent's Calcs. On a phone it is a full-screen sheet with You / Them / Field tabs.

Marks come from `lib/prep-build.mjs` (`speedMarks`, `koMarks`, `surviveMarks`) over `lib/calc/threshold.mjs`. They depend on
the set's item, nature and moves, not its Stat Points, so dragging never runs the damage engine. Old `#…/build` links open Sets,
and `#…/build/<n>` opens that pick's set here. The Rotom-Fan and Mega Charizard Y reference cases are in `test/prep-build.test.mjs`.

## Check a pick

On the Draft screen, choose any available mon in **Check a pick** (or press **Check** in Best single picks or the mon's
detail panel). The app builds the best complete roster that starts with that mon, compares it with your best plan and
gives a verdict: Great (within 1 point), Good (within 3), Okay (within 6), Weak, or Breaks your budget. It also shows the reasons
and the rest of the roster that would go with it.

## League rules built in

- Exactly 10 Pokémon per coach on 100 points. A pick is blocked if `points left − cost` is less than the cheapest
  `(slots left − 1)` mons still on the board.
- Drafting a species includes all its Champions-legal Megas. Only one Mega Evolution per battle.
- Species clause: one of each Pokédex number per team of 6. A coach may still draft several Rotom forms.
- Draft order defaults to snake (1→10, 10→1). Change it in Setup.

## Settings

Per browser (localStorage): selected coach (default Anthony), draft order, explain level, name fixes.
Deep links: `#draft`, `#team`, `#league`, `#learn`, `#setup`.
If the league republishes the sheet under a new link, start the server with
`DRAFARIG_SHEET_URL=https://docs.google.com/spreadsheets/d/e/<new id> node server.mjs`.

## Known limits

- Threats and "answers" use a type-and-speed estimate, not a damage calculator.
- Roles and tiers come from the research snapshot (`docs/research/strategy/pokemon.json`, 2026-10-02).
- Google's published copy can lag about 5 minutes behind edits to the sheet.

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
npm test               # builds the Worker artifact, then node --test: 423 tests (calc engine, searches, Prep UI on a stub DOM, Build, chat, Worker)
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

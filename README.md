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
npm test               # node --test, 22 tests: sheet parsing, name matching, budget feasibility, optimizer, scoring
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

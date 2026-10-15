# Stack recommendation — Drafarig

## Recommendation: one zero-dependency Node server + a static front end, with no build step

```
node server.mjs        # → http://localhost:5179
```
(or `npm start`, which runs the same thing). Node ≥ 18 is required for global `fetch`. Node 24.21 is installed at `~/.local/bin/node`; it is **not on the PATH of non-login shells**, so `npm start` from a login shell works, or use the full path.

**Why this and not Vite/React/Svelte:**
- The only server-side needs are (a) a proxy for Smogon stats, which send no CORS header, (b) a disk cache for the big monthly files, and (c) one-time preprocessing of Showdown data. That is about 80 lines of `node:http` (prototype: `scratch/server-proto.mjs`, tested).
- The Google Sheet and Showdown data are CORS-open, but routing them through the same server keeps one code path, one parser, and one place for cache busting.
- One page, a few views, roughly 340 Pokémon: plain ES modules plus a tiny reactive helper are enough. A bundler adds `node_modules`, config, and a dev server for no real gain. **If the UI grows**, add **Preact + htm via an import map** (no build). Reach for Vite + Svelte only if the UI/UX design calls for many interactive components.
- Runtime dependencies: **one**, `@smogon/calc` (MIT), and only if damage calcs are in scope. Serve its `dist/production.min.js` (or the ESM build) to the browser from `node_modules`, or run calcs server-side.

Tested in the prototype: `/api/sheet` is live on every call (0.57–1.0 s, 39 KB JSON, 257 board entries / 10 coaches / 44 red). `/api/usage` takes 1.7 s cold (downloads 16 MB, slims it to 192 KB) and 15 ms warm (disk cache). Static serving and the path-traversal guard work.

## Folder layout (for the real app; not created yet)

```
drafarig/
  package.json          # "type":"module", "scripts":{"start":"node server.mjs","build-data":"node tools/build-data.mjs"}, dep: @smogon/calc (optional)
  server.mjs            # http server: static /public + /api/* routes + disk cache
  lib/
    sheet.mjs           # fetch + parse both tabs + red-cell HTML  (from scratch/sheet.mjs)
    names.mjs           # normalizer + TYPOS table                  (from scratch/name-map.mjs)
    usage.mjs           # Smogon chaos → slim                       (from scratch/slim-stats.mjs)
    optimizer.mjs       # feasibility + top-N rosters (shared with browser) (from scratch/optimizer.mjs)
  tools/
    build-data.mjs      # download Showdown client data + champions mod → data/dex.json (species+megas+altFormes, moves, learnsets, items, typechart)
  data/                 # generated, git-ignored is fine; small (<2 MB)
    dex.json
  cache/                # runtime cache: usage-<format>-<month>.json, pikalytics/*.md
  public/
    index.html
    app.js              # ES modules, no bundler
    styles.css
```

## Data flow

| Data | Freshness | Where it comes from |
|---|---|---|
| Sheet (board, drafts, red cells) | **every page load**, no cache | `/api/sheet` → Google (`cache: 'no-store'` + `&_=<ts>`) |
| Dex (species, Megas, types, stats, abilities, learnsets, moves, items, type chart) | build-time; rerun `npm run build-data` when the regulation changes (next: early Dec 2026) | Showdown client data + `data/mods/champions/formats-data.ts` |
| Usage (Smogon) | monthly; disk cache 24 h, keyed by month | `/api/usage` → smogon.com/stats (proxy, no CORS) |
| Pikalytics (optional: win rate, top teams) | 24 h cache | `/api/pika/:name` → `/ai/pokedex/...` markdown |
| Sprites | browser HTTP cache (8 days) | `<img>` straight to play.pokemonshowdown.com |

Name mapping happens **server-side** in `/api/sheet`: every board and draft entry carries `id` (Showdown id) and `unknown: true` when unmatched, so the UI never sees raw typos.

## API sketch

```
GET /api/sheet
→ { fetchedAt, stale: false,
    board:   [{ id, en, zh, points, takenBy: "Anthony"|null, red: bool }],
    coaches: [{ order, name, picks:[{round, id, en, points}], spent, pointsLeft, slotsLeft }],
    warnings:[ "Drafts says 'Politoad' (politoed) …", "red but not drafted: X", "unknown name: Y" ],
    nextPicker: "Anthony" }                  // derived from pick counts (snake/linear, see below)

GET /api/dex            → data/dex.json (static, long cache): { species:{id:{base, megas[], altFormes[]}}, moves, items, typechart, learnsets }
GET /api/usage          → { month, info, species:{ id:{usage, abilities, items, moves, spreads, teammates} } }
GET /api/pika/:name     → { usage, winRate, record, moves, items, teammates } (optional, parsed from markdown)
POST /api/calc          → optional, if calcs run server-side: { attacker, defender, move, field } → { range, percent, desc }
```

Errors return a JSON `{error}` with status 502. The UI then keeps the last good sheet copy from `localStorage` and shows "Sheet unreachable, showing data from HH:MM". A fresh sheet is still attempted on every load.

## Domain rules encoded

- **10 Pokémon per coach, 100 points** (confirmed by the coordinator). `slotsLeft = 10 − picks`, `pointsLeft` read from the sheet and recomputed as `100 − Σpoints` (warn if they differ).
- **Drafting a species includes all its Champions-legal Megas** (`species-megas.json`). `altFormes` (Gourgeist sizes, etc.) are shown as "ask league" until ruled.
- Taken = drafted (Drafts tab) ∪ red (board HTML). The Drafts tab is authoritative; red is a cross-check.
- In-battle **Species Clause** treats Rotom-Wash/Heat/Mow/Fan/Frost as one species (same `baseSpecies`). A coach may draft two Rotoms but cannot bring both to one battle; show that as a team-builder warning, not a draft block.
- Draft order observed: round 5 shows coaches 1–4 picked, so it runs 1→10. Whether it is snake or linear can't be told from one partial round; compute `nextPicker` as "the lowest-order coach with the fewest picks", which works for both. Confirm the rule with the league.

## Budget feasibility + plan optimizer (implemented and tested: `scratch/optimizer.mjs`)

**Feasibility check.** A pick of cost `c` is allowed only if
`pointsLeft − c ≥ sum of the cheapest (slotsLeft − 1) costs among the OTHER available mons`.
If fewer than `slotsLeft − 1` other mons remain, the pick is infeasible. Recompute after every sheet load, since other coaches take the cheap mons too. Use it to grey out board cells and to show "max affordable now = X".

```js
// costsSortedAsc = available costs ascending; skip the candidate itself
function feasible(cost, idx, slotsLeft, pointsLeft, costsSortedAsc) {
  let s = 0, k = 0;
  for (let i = 0; i < costsSortedAsc.length && k < slotsLeft - 1; i++) if (i !== idx) { s += costsSortedAsc[i]; k++; }
  return k === slotsLeft - 1 && pointsLeft - cost >= s;
}
```

**Top-N complete rosters.** This is a 0/1 knapsack with an exact item count. `dp[k][p]` holds the top-N partial rosters using exactly `k` mons with total cost exactly `p`. Iterate items, with `k` descending and `p` descending, so each mon is used at most once. The answer is the best N across `dp[slotsLeft][0..pointsLeft]`. Complexity is `items × slots × points × N` ≈ 250 × 6 × 100 × 5, which is trivial in the browser.

```js
function topRosters(avail /*[{id,cost,score}]*/, slotsLeft, pointsLeft, N = 5) {
  const dp = [...Array(slotsLeft + 1)].map(() => [...Array(pointsLeft + 1)].map(() => []));
  dp[0][0] = [{ score: 0, picks: [] }];
  avail.forEach(({ cost, score }, i) => {
    for (let k = slotsLeft; k >= 1; k--) for (let p = pointsLeft; p >= cost; p--) {
      const from = dp[k - 1][p - cost]; if (!from.length) continue;
      dp[k][p] = dp[k][p].concat(from.map(r => ({ score: r.score + score, picks: [...r.picks, i] })))
                        .sort((a, b) => b.score - a.score).slice(0, N);
    }
  });
  return dp[slotsLeft].flatMap((l, p) => l.map(r => ({ ...r, cost: p })))
    .sort((a, b) => b.score - a.score || a.cost - b.cost).slice(0, N);
}
```

Verified results:
- It matches brute-force enumeration on a random 14-mon instance (top-5 scores identical).
- On live data (Anthony: 4 picks, 29 points left, 6 slots, 212 available), it returns the top 5 in **23 ms** in Node. All current picks are feasible; max affordable now is 20.

Notes for the strategy and UI work:
- **Scoring is the strategy agent's call.** Raw usage % is a placeholder; with it, the top-5 rosters are near-ties that differ by one 1-point filler. Feed it a real value (role coverage, type synergy, Mega value, teammates), and add **diversity** (e.g. penalise a second Mega user, cap by role, or require ≥1 Fake Out/speed control). Do the diversity step as a re-rank over the top ~50 rosters, or as a beam search with a set-based score, because a DP needs an additive score.
- For "lock this mon" or "exclude this mon", filter `avail` and adjust `slotsLeft` / `pointsLeft` before calling. For "what if another coach takes X", rerun without X.
- Ties: prefer rosters that leave 0 points, or expose the cost/score trade-off.

## Running and safety

- Bind to `127.0.0.1` only (the prototype does). No auth, keys, telemetry, or deploy.
- `npm start` = `node server.mjs`. Optionally `node --watch server.mjs` during development (built into Node, no nodemon).
- Tests: `node --test` (built-in runner) for the parsers (fixture CSV/HTML in `test/fixtures`, copied from `scratch/`), the normalizer (all 259 names), and the optimizer (the brute-force cross-check).

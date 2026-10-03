# Drafarig: competitive landscape

Researched 2026-10-02 by Drafarig UI UX. All URLs are listed in `sources.md`.

## Summary

- **No existing tool does Anthony's job.** League platforms (DraftLeague.net, Indigo, DraftDex, DraftCenter, DraftZone) want the league to run on their site. Team analyzers (PokeTools, PokeSynergy, Pikalytics, Porygon Labs, ChampTeams) look at a team of six against the global ladder, not at a 10-12-mon roster against nine named opponents in a point budget. Anthony's league runs on a Google Sheet that he does not control, so Drafarig has to read that sheet and do the analysis on top of it.
- **Every serious tool has the same three analysis panels:** a defensive weakness/resistance grid, offensive coverage, and speed tiers. Some add a fourth, roles. These are table stakes.
- **Only one Pokémon tool recommends picks.** PokeTools Draft Assistant gives a numeric score plus one-line reasons ("8 new super-effective targets"). Its prices are generic BST-based tiers, so it cannot use this league's board, and it has no idea of opponents.
- **The best ideas to borrow come from fantasy sports and card-game drafting:**
  - max bid / points per remaining slot (auction calculators)
  - a pick queue with backups (Sleeper, ESPN, Discord bots)
  - "will it still be there at my next pick?" (FantasyPros Pick Predictor, DraftKick, Fantasy Life)
  - tiers and tier drops (value-based drafting)
  - counters for team needs that go red or green (Arena Tracker's 2-drop and removal counters)
  - a "hide scores" practice mode (Arena Tracker)
  - plain-language coach explanations (chess.com Game Review)
- **Complaints repeat across domains.** Users dislike scrolling to find the information that decides a pick, remaining roster slots that are hard to find, a large empty queue box, and recommenders that are trusted blindly and overrate one factor (HearthArena "overrates synergy" and "always wants 2-drops"). Drafarig should show its reasons and let Anthony override them.

---

## 1. Pokémon draft-league platforms (league management)

| Tool | What it does | Notable features | Praise / complaints / gaps for us |
|---|---|---|---|
| **DraftLeague.net** (draftleague.net) | Runs a league "without the spreadsheet" | Live draft board, pick timers, queued picks and auto-pick "for whoever falls asleep", automatic stats from replays, standings with visible tiebreakers, playoffs, trades, Discord posts, and team stats / speed tiers / weakness grids for prep | Recommended in Smogon's resource thread. Our league uses a Google Sheet, so we can't use it directly. **Borrow:** queued picks with auto-fallback; weakness grid plus speed tiers as the prep set. |
| **Indigo Draft** (indigo-draft.com) | Full league platform | Real-time draft room with "clock, pick queues, and full commissioner controls"; imports a tier list from paste, CSV, TSV or JSON; **draftboards and watchlists**; "matchup prep and planning workspaces"; **"Lab what-if workspaces"**; per-Pokémon stats from Showdown replays; Rotom-Draft Discord bot | Premium tier for queue automation and teambuilder. **Borrow:** the watchlist vs queue split and a "Lab / what-if" sandbox. |
| **DraftDex** (draftdex.net) | VGC-style league platform | Snake or linear interactive board with **budget tracking** and timer; **Matchup Planner** that analyzes opponent threats and type coverage before each battle and plans "Bring-6"; Bo3 result tracking; free agents; **Reg M-A Mega Evolution support with form toggles** | The closest VGC match. **Borrow:** a per-opponent matchup planner that ends with a bring-6 / pick-4 plan, and Mega form toggles. |
| **DraftCenter** (draftcentral.gg) | League platform plus tools | Snake and auction drafts, Team Lab ("Pick your six, paste a PokéPaste, print a VGC team sheet, or check the matchup before battle"), team sheet generator, Community Draft Pulse analytics, format presets for **Reg M-A / M-B / M-C** | Confirms that **Reg M-C is the current Champions format (Sep–Dec 2026)**. **Borrow:** PokéPaste import, a printable team sheet, and a "check the matchup before battle" step. |
| **Pokémon DraftZone** (pokemondraftzone.com, open source) | Planner and prep | Archive of current and past drafts, opponent tracking, team comparison, coverage, a **speed chart with nature / Scarf / Tailwind modifiers**, **drag-and-drop speed tiers**, **Markdown matchup notes on every matchup**, shareable matchup links, Champions M-A ruleset | Liked on Smogon; launched May 2024. **Borrow:** free-text matchup notes per opponent, and a speed chart with modifier toggles. |
| **OnlineDraft** (onlinedraft.com/pokemon-draft) | Generic live draft board | Pick timer, snake rounds, custom rules written "as plain sentences" and enforced, works on any device | Only the draft-room part. **Borrow:** say rule violations in plain sentences ("This would leave you 3 pts for 5 slots"). |
| **Fundrafted** (fundrafted.com) | League automation | Coverage grids and speed positions that update after each pick inside the draft room, "flagging gaps while players can still address them"; replay parsing into stat sheets; strategy guides | **Borrow:** analysis that updates after every pick, and gaps flagged while there is still time to fix them. |
| **Discord bots**: Emolga, discord-draft-assist, pkmnDiscordBot, Rotom-Draft (Indigo) | Draft automation in Discord | `!pick`, `!backup [list]` (bot fills the pick automatically if your first choice is gone), timers, Emolga writes picks into a Google Sheet | Shows that leagues like ours often run the draft in Discord and record it in a sheet. **Borrow:** a backup list, so if the top target is sniped the next one is ready. |
| **Smogon spreadsheet templates**: League Spreadsheet Template (Bo1 and Bo3/VGC), Princess Autumn's planning template, Techno's prep doc, BallHaWK's and Autumn's prep docs | Google Sheets for running a league and for prep | Supports 8-20 coaches, team pages coloured per team; prep docs with per-opponent tabs, speed tiers and type charts | Our league sheet is probably adapted from one of these. Prep docs are powerful but have to be copied and filled in by hand. **Gap:** nothing is filled in automatically from the league sheet. |
| **Random Pokémon draft generator** (randompokemon.co) | Pool generator | Fair pool generation, region filters | Not relevant beyond setting up a league. |

## 2. Pokémon team analysis and pick tools

| Tool | Features | Notes for Drafarig |
|---|---|---|
| **PokeTools Draft League Assistant** (poketools.com/draft-assistant) | 100-pt budget, 12 picks; shows points remaining, spent and **average cost per pick**; a **defensive coverage matrix** with weak/resist/immune tallies and a flag for "stacked weakness left unanswered"; **offensive STAB coverage x/18** with gaps listed ("no STAB answer for: normal, fire…"); **role balance** across 6 roles; the **top 5 suggestions** each show cost, score, role and one reason; roster saved in the URL | The **only Pokémon pick recommender** we found. Weaknesses: prices come from generic BST tiers (S=12 … E=2) rather than the league's board; no opponents; doubles roles (Fake Out, redirection, speed control) missing; STAB-only coverage. **Borrow:** the shape of the top-5 list with reasons, average cost per pick, and the "stacked weakness" flag. |
| **PokeTools Team Builder** | Defensive spread, move coverage across 18 types, speed tiers, **threats vs the top 20 in usage, flagging unchecked threats**, a "meta conformity grade", proven cores from usage data | **Borrow:** threat analysis that lists unchecked threats. Ours uses opponents' actual rosters rather than the global top 20. |
| **PokeSynergy** (pokesynergy.app) | Champions team builder, "explainable matchup threats", damage calc, a speed tier page with sprite, type, base speed and **playrate**, explanations of the Tailwind / Icy Wind / Trick Room / Scarf modifiers, MetaDex tournament data | **Borrow:** a speed list that includes usage, and a short explanation next to each modifier toggle. |
| **Pikalytics** (pikalytics.com) | Reg M-C usage (Rillaboom 35.2%, Sneasler 31.8%, Incineroar 25.1% at time of fetch), 2/3/4-mon **cores**, tournament teams, team builder, calc, speed tiers; **public AI/JSON endpoints** (`/ai/pokedex/[format]/[mon]`) with moves, items, abilities, spreads, partners, counters | **Data source** for "common set" and "common moves" (which mon has Fake Out or Tailwind in practice). Confirm the terms before automated use. |
| **Champions Battle Data** (championsbattledata.com) | Free API with no auth and CORS: per-mon ranked data, moves, items, teammates, natures; daily snapshots | A second data source that a browser app can call directly. |
| **ShowdownTier** (showdowntier.com, Reg M-A) | Tier list S–E with usage %, win %, average rating, and archetypes | **Borrow:** usage and win rate shown side by side. |
| **ChampDex** calc and speed guide | Champions-exact damage formula (Stat Points, Lv50, Megas, spread 0.75×), **"shows every modifier so you can trust the KO range"**; speed tiers in 3 columns (max +nature / neutral / Tailwind) | **Borrow:** a transparent breakdown, and the 3-column speed benchmark. Champions facts: **66 Stat Points, max 32 per stat**, Lv50, 1 SP ≈ 8 EVs. |
| **Porygon Labs** | Calc, a speed order that applies weather abilities, a **Pokémon Explorer filtered by role (Trick Room setter, Tailwind user, Redirector)**, saved teams with notes, match history, keyboard shortcuts (S search, T Trick Room) | **Borrow:** role filters on the available-pool list, and keyboard shortcuts for on-the-clock speed. |
| **ChampTeams** (champteams.gg) | Two-way damage matrices vs the meta, **Battle Mode** with suggested picks at team preview and threat callouts (priority, immunities); guides tiered "Great Ball" etc. | **Borrow:** a matchup view that suggests a bring-4 and lists callouts. Their guides model teaching in levels. |
| **MetaVGC calc** | "Team vs Many": your team vs many meta opponents at once with KO ranges and speed context | Fits matchup prep (my 10 vs their 10). Later feature. |
| **Showdown damage calc** (calc.pokemonshowdown.com) | The standard calc; two panels, field toggles, doubles mode | Link out to it; don't rebuild it. |
| **Showdown teambuilder and PokéPaste** | Import/export text format; pokepast.es URLs | Support paste export of a planned 6 so Anthony can test it on Showdown. |
| **Type-matrix tools**: pokestats.cc Team Weakness heatmap, Poketata, devutl synergy checker, MonTeams, favoritepokemonpicker, mlbbquotes, pokemonfusions planner | Up to 6 mons; 18-type heatmap; coverage score; "synergy suggestions". MonTeams: "Coverage is not 'have many types.' Coverage is 'hit the types that wall you'"; red = shared weakness, teal = resist | All are limited to 6 mons and none know opponents. **Borrow:** MonTeams' framing of coverage. Use a colour-blind-safe palette (teal/orange), not red/green. |
| **Limitless VGC / play.limitlesstcg / Victory Road** | Tournament teams with open sheets | Source for common Champions sets. Link only. |

## 3. Fantasy sports draft assistants

| Tool | Features | Praise / complaints | Borrow |
|---|---|---|---|
| **FantasyPros Draft Wizard / Draft Assistant** | Live recommendations from rankings, **roster needs and position scarcity**; syncs with ESPN, Yahoo and Sleeper; **Pick Predictor (% odds a player is still there at your next pick)**; cheat sheets; team grades; "Draft Intel" on league-mates' tendencies; "helps avoid panic picks" | FSTA award winner; sync costs extra | Combine needs with value; **"likely gone before your next pick"**; a grade with feedback after the draft. |
| **DraftKick projected availability** | Availability at your next 2 picks; normal CDF with mean = ADP and sd = ADP/4; "rough approximations"; wait if ≥60–70%, take if ≤20–30% | Openly says it is approximate | A simple, honest availability estimate. In our league there is no ADP, so estimate from **opponents' needs and point budgets** instead. |
| **Fantasy Life Draft Companion** | Overlay with recommendations by team need, queue with availability %, roster view in one panel; "no tab-switching" | — | **Everything on one screen while on the clock.** |
| **Sleeper** | **Queue vs watch list are separate** (the queue is per draft and feeds autopick; the watch list is account-wide); autopick takes from the queue first, then by need; the board shows "position runs" and other teams' needs | Praised for its board view | Separate "Shortlist" (season-long) from "Next-pick queue". Make other coaches' needs visible on the board. |
| **ESPN** | Pick queue (drag to reorder, autopick from the top); 2024 board with **colour coding per position** to "assess each team's roster makeup" | Complaints: disorganized mock lobby; the draft room needs **too much scrolling**, **the information for a pick isn't on screen**, **remaining roster slots are hard to find**, **the empty queue box is too prominent** (GitHub draft-room UX issue #170) | Colour picks by role on the league board; keep remaining slots always visible. |
| **Yahoo (2025 redesign)** | Responsive; Draft Board in its own tab on mobile; inline position filters; compare tables; **Draft Scout** recommendations "clearer and more actionable"; draft grades during the draft | — | Mobile: tabs instead of panes; inline filters. |
| **Auction calculators** (Drafty, DraftWaiver, DraftExpert Pro, LeagueLogs) | **Max bid = budget − (slots left − 1) × min price**; "always keep $1 per remaining roster spot"; Fair / Target / MAX values; Buying Power recalculated after each nomination | Missing this check is the classic mistake: you end up "auto-filling cheap players in final rounds" (Fundrafted) | **Budget meter**: max affordable now, average per remaining slot, and a hard warning when a pick makes the roster impossible to complete. |
| **Value-based drafting / tiers** (VOR, tier drops) | "The distance between tiers is more meaningful than the order within them"; "take the last player in a good tier over the first in a worse one" | — | Show **role tiers** ("only 2 Fake Out users left that you can afford") as a scarcity signal. |
| **DraftSharks War Room, RotoWire, Footballguys Draft Dominator, Fantasy Nerds Draft Buddy** | Live sync, value-based rankings, team analyzer, mock trainers | Paid; Draft Buddy is free with manual pick tracking | Free manual tracking is fine for us; we sync from the sheet. |

## 4. Card-game and esports draft helpers

| Tool | Features | Lessons |
|---|---|---|
| **17lands / MTGA_Draft_17Lands overlay** | Per-card GIH WR, ALSA; configurable columns; a deck-colour filter with "Auto" (All Decks for 15 picks, then the best-matching pair); **ratings shown as %, a 5-point scale, or letter grades**; a draft-stats table (curve by type) | 17lands' own blog: data is "an aid, a starting point", not a verdict; win rates reflect average players, so following them blindly gives average results; **"a needed two-drop beats a theoretically superior four-drop"** later in a draft. → **Early picks lean on power, later picks on needs.** Offer letter grades for beginners and exact numbers on request. |
| **Arena Tracker (Hearthstone)** | Scores from 3 providers side by side; the best pick highlighted; **score background fill shows data confidence**; **"Hide Scores" practice mode**; **mechanics counters** (AOE, removal, draw, heal…); drop counters with **red when short, green when enough** | **The best model for a role checklist**: icon counters such as "Fake Out 0 · Speed control 1 · Intimidate 0 · Redirection 1", red until each minimum is met. "Hide scores" becomes a "Quiz me" learning mode. |
| **HearthArena** | 0–100 score per card, crown on the best, synergy adjustments from ML | Forum complaints: "heavily, heavily overrates synergies", always "we seriously need 2-drops!", too little removal, quality fell after expert curators left; experts outgrow it. → **Make the weights visible and adjustable; never present the score as truth.** |
| **Draftsim** | 0–5 card ratings; the bot gives an on-colour bonus after commitment; a tier-list page by class | A two-phase heuristic (power first, then fit) that maps to our pick stages. |
| **iTero / LoLDraftAI / METAsrc (LoL)** | AI pick coach "explains why"; whole-draft win %, per-pick impact; counterpick-aware vs flex-safe modes; iTero: "non-lane counters are ALSO effective"; damage-type balance (AD/AP 20–80%) | **Two recommendation modes:** "best for my team" vs "deny / counter a rival". Damage-profile balance maps to physical/special balance. |
| **chess.com Game Review** | Move classes (Brilliant … Blunder) with a **coach explanation in plain language** and highlighted squares | The tone and structure for "why this pick": a classification badge plus one coach sentence plus "show me" links that highlight cells in the grid. |

## 5. Main gaps Drafarig fills

1. **Uses this league's board and the live state of the sheet** (prices, taken status, 10 rosters, points left). No other tool knows these.
2. **Recommendations that account for the budget**: the best pick you can afford that still leaves enough to complete the roster.
3. **Threats taken from the opponents' actual rosters**, not the global top 20.
4. **Doubles roles as checklist counters** (Fake Out, speed control, Intimidate, redirection, Protect-users, spread damage, priority, Mega slot) rather than singles roles (hazards, walls).
5. **Teaches while it advises**: every recommendation and every red flag has a plain-English reason and a short glossary popover.
6. **Bilingual names** (中文 / English) and fuzzy matching, because the league sheet has typos ("Politoad", "Huisuian Zoroark", "Alalan-Persian", "Typhilosion", "Samorott", "Squawkability", "Watchdog", "Forrestress", "Manecri").
7. **League rules that no tool models** (both confirmed by Anthony):
   - **Every coach drafts exactly 10 mons on 100 points.** Budget feasibility is therefore a hard constraint for Anthony *and* a way to predict what each opponent can still afford.
   - **Drafting a mon includes all its Mega forms.** Only DraftDex shows Mega form toggles, and it doesn't treat them as one pick that gives several forms.

## 6. What the league data shows (snapshot 2026-10-02)

- The board has **257 mons in 20 point tiers** (1-pt tier: 21 mons; 20-pt tier: 7). The cheapest price is 1, so the minimum cost to fill *k* slots is the sum of the *k* cheapest **available** mons (usually k × 1). Compute it live; don't assume it.
- Name typos on the board: "Manecri", "Huisuian Zoroark", "Alalan-Persian", "Typhilosion", "Samorott", "Squawkability", "Watchdog", "Forrestress", "pikachu", "Mr.Rime".
- Mismatches between the picks tab and the board: "Politoad" (the board has Politoed), trailing spaces ("Gholdengo ", "Farigiraf "), and case differences ("Rotom-Wash"). Name matching therefore needs normalization, a Chinese-name fallback, aliases and a visible resolver.
- Coaches 1–4 have 5 picks; coaches 5–10 have 4. If the draft is a snake, round 5 runs 1→10, which would make **Anthony (#5) next on the clock**.
- **Anthony: 71 spent on 4 mons, 29 left, 6 slots.** That averages 4.8 per slot, and the most he can spend on this pick is 24 (if five 1-pt mons remain for the other slots).
- Opponents' points left after 4–5 picks:

  | Coach | Points left | Slots left | Average per slot |
  |---|---|---|---|
  | Hex | 24 | 5 | 4.8 |
  | Ning | 17 | 5 | 3.4 |
  | ZhuZi | 35 | 5 | 7.0 |
  | Jacky | 18 | 5 | 3.6 |
  | Taro | 31 | 6 | 5.2 |
  | 17 | 46 | 6 | 7.7 |
  | Calvin | 43 | 6 | 7.2 |
  | DingDing | 54 | 6 | 9.0 |
  | Data | 39 | 6 | 6.5 |

  DingDing, 17 and Calvin can still buy 15–20-pt mons. Ning and Jacky effectively can't. This is the input to the snipe-risk estimate.

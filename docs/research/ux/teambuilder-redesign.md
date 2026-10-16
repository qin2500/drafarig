# Teambuilder redesign: the set editor is where you build

Drafarig UI UX, 2026-10-15. Clickable mockup: `docs/research/ux/mockups/teambuilder.html`. It is self-contained, so open it in a browser.

## Why we're redoing it

Anthony's verdict on `prep-builder` (8ff6cfd): *"none of the changes I wanted actually landed. The set editor doesn't look like Showdown's. And I don't see any of the tools I asked for … The features all exist in some way but not in a way that is useful to me."*

Our mistake was in **where** we put things, not in what we built:
- We added a separate **Build** tab holding a dashboard of collapsible tables.
- We left the real set editor (`#prep/my-sets/<id>`) as a stacked form: dropdowns plus SP −/+ boxes.

So the tools sat one screen away from the thing he edits, and they arrived as tables. **The fix is to put the tools inside the editor, on the controls they're about.**

## What replaces what

| Today | Replaced by |
|---|---|
| Set editor as a vertical form (`prep-sets.js editor()`) | **A Showdown-style set card.** Sprite, nickname, item and ability on the left; 4 move slots as type-to-search inputs (`<datalist>` from the legal learnset); a mini stat-bar column. |
| SP −/+ boxes and a "64 of 66 used" line | **The stats panel.** One row per stat: name with nature +/− colour, base, stat bar, a **0–32 SP slider**, a number box and the final stat. The remaining counter sits under it ("2 left", red when over). |
| Build tab ② Compare options (a table of columns) | A **"Pin as A"** button, then a **one-line diff bar** above the sliders. It shows field changes, Spe A → B, "faster than N → M", KO and survive marks gained (✓) or lost (✗), and the bulk score A → B. "Back to A" and "Unpin" sit beside it. Nothing saves without **Save version**. |
| Build ③ Speed and creep targets table | **Tick marks on the Speed slider**, recomputed for the current nature. Each mark is the least SP that outspeeds a target. A tie gets its own ◆ only when you sit on it or a tie is the best you can reach. Unreachable targets become one muted chip, e.g. "can't beat 6 Speeds, 154–178". |
| Build ⑤ KO benchmarks table | **Round ticks on the attacking-stat slider**, e.g. "OHKO Mega Staraptor (Life Orb) at 23", "+2: every roll at 8". A tick whose condition isn't met (nature, item or setup move) is dashed and says what it needs. |
| Build ⑥ survive benchmarks | **Round ticks on HP and Def/SpD.** A paired mark ("HP 28 + Def 7, Bold") only lights when both stats are reached. |
| Build ④ Your hits table | A **calc strip** that opens while a move slot has focus. It shows that move against the opponent's mons as sprite cards with % ranges: +0/+2 columns when the set has a setup move, sun/no-sun for Mega Charizard Y. |
| Build's "Checking against" panel (pins, weather select, long assumptions paragraph) | One **tiny line**: `Checking against [Calvin ▾ / Whole league]`, followed by a one-line assumptions text that is always visible. |
| Build tab and `#prep/<p>v<o>/build[/<n>]` | **Removed.** The editor *is* the builder. The team strip (6 on top, rest of the 10 below) sits above the card on both `#prep/my-sets/<id>` and the matchup Sets tab. Old build links redirect to the editor for that mon. |
| "Suggested trade-offs" chips | Small **"try:"** chips beside Pin. They pin A automatically, then apply the idea (Rotom: "Speed SP → HP + Life Orb (O2)", "Nasty Plot (N16)"; Zard: "Timid 24, 8 into HP", "Modest 31"). |
| Copy as Showdown text / Paste a team | One **Import / Export** button: a Showdown-text dialog in the existing `exportSet` format (SP on the `EVs:` line). |

**What stays:** immutable versions, drafts, history, perspective rules, legality errors, the engine's lazy load, the calc notebook, the Brief, and the full calc screen as the place to go for detail. A tick or a strip card links there ("open in Calcs").

## Which modules feed each piece

| Piece | Source (already on `prep-builder`) |
|---|---|
| Set card, item/ability/move legality, learnset datalist | `prep-sets.js editor()` (state, save/draft/versions); `lib/calc/mech.mjs` `learnset`, `legalAbilities`, `checkSet` |
| Stats panel, final stats, remaining counter | `lib/calc/stats.mjs` `statValue`, `spTotal`, `SP_PER_STAT`/`SP_TOTAL`, `natureSign` |
| Speed ticks, "faster than N of M" | `lib/prep-build.mjs` `creepTargets`, `mySpeed`, `targetSpeed`, `speedVerdict`; `stats.mjs` `outspeedSP` (no engine) |
| KO ticks (+0/+1/+2, 2HKO), "after their Close Combat" | `lib/prep-build.mjs` `koBenchmark`, `afterTheirMoves`, `setupIn`; `lib/calc/threshold.mjs` `koSearch` (now with `uses`) |
| Survive ticks (paired HP + Def/SpD) | `lib/prep-build.mjs` `surviveBenchmark`; `threshold.mjs` `surviveSearch` |
| Calc strip | `lib/prep-build.mjs` `hitResult`, `hitScenario`, `autoWeather` (Drought on the Mega turn); `prep-ui.js` `koWords` |
| Targets for the scope picker | `lib/prep-build.mjs` `targetsOf`, `defaultPins`; `prep-matchup.js` `modelFor` (the opponent pool); the league pool for "Whole league" |
| Bulk score in the diff bar | `lib/prep-build.mjs` `bulkScore`, `commonHits` |
| "try:" ideas | `lib/prep-build.mjs` `seedOptions`, `freeIntoBulk`, `swapInMove` |
| Tools against setup (tick tooltip on +2 marks) | `lib/prep-build.mjs` `setupTools` |
| Save version / A snapshot | `prep-calcs.js` `promote()`, `lib/prep-model.mjs` `addVersion`; A lives in `P.ui` (session) |
| Import / Export | `lib/paste.mjs` `parseTeam`, `exportSet` (existing tiered import screen for anything non-trivial) |
| Team strip (6 + rest of 10) | `prep-sets.js` `myTeamRows` data (`my6`, `shortlist`), `P.pt()` sprites |

Most of `public/prep-build.js` (the dashboard view) is retired. Its pure logic in `lib/prep-build.mjs` stays and feeds the editor. Ticks need **no new engine work**, only a call per benchmark row. Speed marks are pure stat maths, so the editor still renders without the engine. Damage ticks appear once the engine loads, with "Calculating…" until then.

## Rules carried over
- **Nothing writes without Save.** Pin, try and drag are editor drafts only.
- **Every tick's tooltip is a one-line calc with its assumptions.** The panel's one assumptions line covers the shared ones.
- A **tie is never shown as an outspeed**: ◆ means "coin flip".
- Copy says what changes; it never says "worth it".

## What I verified, and what not
- The mockup's stats match `statValue` (Rotom-Fan Modest 32 SpA = 172; Mega Charizard Y Modest 32 = SpA 232 / Spe 152).
- Its ticks reproduce `benchmarks-league.md`: Timid 21 beats 154, Timid 24 beats 157, Modest 32 ties 152.
- Its damage numbers are copied from `rotom-fan-case.md`, `dashboard-goldens.md` and `benchmarks-league.md` (plus two app-engine numbers from the QA screenshot).
- Damage cells follow the reference build; when the sliders move away from it, the strip says so.
- Logic and rendering were checked in Node with a stubbed DOM. **I could not open it in a real browser here** (headless Chrome was blocked in this sandbox), so the visual layout is unverified.

## Open questions (for Anthony via the lead)
1. **Scope default:** next opponent (Calvin), or whole league? The mockup defaults to Calvin, with a one-click switch.
2. **Tick density:** in "Whole league", Speed has about 12 targets. Should we show only the ones within ±8 SP of the current value, with the rest on hover?
3. **Sprites:** the mockup uses type-coloured initials, because it can't load images. The app would use its existing `P.pt()` Showdown sprites. Is that what he wants on the card (he asked for "looks like Showdown")?
4. Should "Pin as A" survive a reload, or stay session-only (today's draft behaviour)?

# Drafarig: UX specification

Version 1, 2026-10-02. Author: Drafarig UI UX (research and design only). Companion files: `competitive-landscape.md` and `sources.md`.

Drafarig is a single-page app on localhost. It reads the league's public Google Sheet on every page load and helps Anthony, a first-time coach (#5 of 10, 100-point Pokémon Champions doubles draft), do four things:

1. Pick the next mon.
2. Stay inside the budget.
3. Check his opponents' threats.
4. Learn while he does it.

Build for desktop first; it must still work on a phone.

---

## 0. Design principles

1. **Answer the question first, then teach.** Each panel opens with a one-line verdict in plain English, for example "You're weak to Ground: 3 of your 4 mons take super-effective damage". The grid, numbers and glossary sit below it. This follows the NN/g progressive-disclosure rule: two levels at most.
2. **Show your work.** Every recommendation lists the reasons behind its score as chips Anthony can read, never one opaque number. HearthArena's opaque score is why experienced players stopped trusting it. ChampDex's calc earns trust by showing every modifier.
3. **Advise, never decide.** Wording is "Suggested" and "Worth a look", never "Pick this". Anthony can always pick anything; the app then says what that pick changes. The 17lands authors call data "an aid, a starting point".
4. **Never hide a hard constraint.** If a pick would make a legal roster impossible, the app blocks it with a red warning and the math. A hint or tooltip is not enough here, because NN/g's rule is that tooltips never carry vital information.
5. **The sheet is the source of truth.** The app never invents picks. Anything it can't read or match is shown openly with a way to fix it, not dropped silently.
6. **Calm under time pressure.** In On-the-Clock mode, the five things that decide a pick fit on one screen without scrolling at 1366×768. Users complain most about "too much scrolling" and "roster slots hard to find" in fantasy draft rooms.
7. **Teach at the moment of need.** Use pull revelations: a dotted-underline term opens a popover, and each empty state explains itself. There is no up-front tutorial, because NN/g found tutorials don't improve task performance.
8. **Don't rely on colour alone.** Weakness grids use an orange (weak) / teal (resist) / grey (immune) palette, and every cell also carries a glyph and number (`×4`, `×2`, `½`, `¼`, `0`). This keeps the grid readable for red-green colour-blind users.

---

## 1. Data the UI depends on (UX-facing contract)

| Source | Used for | UX notes |
|---|---|---|
| Board tab (20→1 point columns; 中文名 + English) | Price list and availability | **Red cell = taken.** CSV export drops cell colours. The developer needs Sheets API `spreadsheets.get` with `effectiveFormat.backgroundColor`, or must derive "taken" from the Drafts tab. Recommendation: use **both and cross-check** (see §8, mismatch state). |
| Drafts tab (10 coaches; picks + points; "Points Left" row) | Rosters, points left, pick order | Gives the pick count per coach, from which the app infers whose turn it is (see the order question in §11). |
| Static Pokémon data (types, base stats, abilities, notable moves, **Mega forms**), plus optional usage data (Pikalytics / championsbattledata) | All analysis | Show a data timestamp, labelled "ladder usage, not this league". |
| League constants | **Roster size = 10 (confirmed league rule)**, budget 100, price range 1–20 | Hard constraints. Kept in Setup, read-only with a note "League rule". |
| Local settings (localStorage) | "I am coach #5", queue, watchlist, notes, learning level, name-match overrides | Survives reloads. Export/import as JSON. |

### 1.1 League rule: a drafted mon includes all its Mega forms

Drafting Charizard gives base Charizard plus Mega Charizard X plus Mega Charizard Y. The UI must handle this in six places:

- **One pick, many forms.** A drafted mon is **one card and one roster slot, at one price**. The card has **form chips**, for example `Base · Mega X · Mega Y`. Tapping a chip switches the stats, types, ability and speed shown on that card. The base form is selected by default.
- **Analysis must count every form an opponent could bring**, using worst-case-for-Anthony logic:
  - *Weakness matrix* (my team): each Mega-capable mon gets a split column, one sub-column per form, visible when "Show forms" is on. The summary row counts a weakness when **any** form of that mon has it, and also reports "fixed in Mega form". Example: "Charizard: weak to Rock ×4 in base and Mega Y; Mega X is only ×1." The copy says "can be" for form-dependent cells.
  - *Threat list* (opponents): a threat counts if **any** of its forms threatens Anthony. Each row gets a form tag, for example "Garchomp (as Mega Garchomp): outspeeds and OHKOs-ish Charizard". Tags name the form so Anthony knows which version to fear.
  - *Speed ladder:* every form is its own tick, connected by a thin bracket to the same mon, with the label `Mega` and the form name. Mega speed applies from the turn after Mega Evolution in modern games; this rule must be verified for Champions. A tooltip says "Mega speed takes effect after it Mega Evolves".
  - *Coverage and roles:* a role counts as filled if **any** form provides it. If it comes only from the Mega form, the chip reads "Intimidate (Mega only)".
- **One Mega per battle.** Champions follows the usual VGC rule of one Mega Evolution per player per battle; the data/strategy agent should confirm this. Matchup Prep shows a banner such as "Data can bring Archaludon + Raichu… but only **one** of their Mega-capable mons can Mega Evolve per game." In the bring-4 builder, Anthony picks which of *his* mons is the Mega and the app greys out the Mega chips on the rest.
- **Board and recommendations:** a mon card on the board shows a small `M` or `M×2` badge, meaning "comes with 1 or 2 Megas". Recommendation reasons can cite a Mega ("Mega Kangaskhan: Parental Bond…"). The badge tooltip reads: "League rule: drafting this mon gives you all its Mega forms."

---

## 2. Information architecture

A single page with a **persistent top bar**, a **left mode switcher** (bottom tabs on a phone), and a **right detail drawer**.

```
┌────────────────────────────────────────────────────────────────────────────┐
│ DRAFARIG  ● Synced 12s ago ⟳ │ Round 5 · Pick 45 │ YOU'RE ON THE CLOCK │ 29 pts · 6 slots · max 24 │
├──────────┬───────────────────────────────────────────────┬─────────────────┤
│ Modes    │  Main view (changes per mode)                 │ Detail drawer   │
│ ▸ Draft  │                                               │ (mon card,      │
│ ▸ My team│                                               │  glossary,      │
│ ▸ League │                                               │  explanation)   │
│ ▸ Matchup│                                               │                 │
│ ▸ Learn  │                                               │                 │
│ ⚙ Setup  │                                               │                 │
└──────────┴───────────────────────────────────────────────┴─────────────────┘
```

| Mode | Sub-views | When it's used |
|---|---|---|
| **Draft** | **On the Clock** (auto when it's Anthony's turn), **Planning** (all other times) | Draft weeks |
| **My Team** | Overview: roster with form chips, role checklist, weakness matrix, coverage, speed ladder | Any time |
| **League** | **Board** (the sheet as a grid: taken greyed out, coloured by owner), **Coaches** (10 roster cards with points left and needs), **Picks log** | Draft and season |
| **Matchup** | Pick an opponent; threats, speed, bring-6 / pick-4 planner, notes | Season weeks |
| **Learn** | Glossary, "Draft 101" cards, Quiz-me toggle | On demand |
| **Setup** | Sheet URL, "I am coach #", league rules (10 mons / 100 pts, locked), draft order, Mega rule (on), name-match fixes, data export | First run, then rarely |

**Top bar** (always visible, sticky on a phone):
- Sync badge (§8).
- Round/pick.
- Turn indicator: "On the clock", "Next pick in 3 picks", or "Draft complete".
- **Budget pill**: points left · slots left · max you can spend now.
- **Learning level** toggle: `Explain everything` / `Just the facts`.

Tapping the budget pill opens the Budget panel.

**Mode default on load:**
- If it's Anthony's turn, open Draft → On the Clock.
- If the draft is in progress but not his turn, open Draft → Planning.
- If the draft is complete, open Matchup with the next opponent picked if a schedule is known; otherwise open My Team.

---

## 3. Screens

### 3.1 Draft → On-the-Clock mode (the most important screen)

Goal: a confident pick in under two minutes, with zero scrolling on desktop.

```
┌ TOP BAR: YOU'RE ON THE CLOCK (pulse) · 29 pts left · 6 slots · Max this pick: 24 ┐
├───────────────────────────────┬──────────────────────────────────────────────────┤
│ PLANS ▸ [A Speed first ✓] [B TR] [C Cheap] │ YOUR TEAM NEEDS              (role checklist)    │
│ ┌───────────────────────────┐ │ Fake Out      ●○  1 of 1 ✓ (Kangaskhan)          │
│ │ Whimsicott? (taken) …     │ │ Speed control ○○  0 of 1 ✗  ← biggest gap        │
│ │ 1. Talonflame  9 pts  A   │ │ Intimidate    ○   0 of 1 ✗                       │
│ │  + Tailwind (fills gap)   │ │ Redirection   ○   0 (nice-to-have)               │
│ │  + Answers Rillaboom ×3   │ │ Trick Room    ●   1 ✓ (Sinistcha)                │
│ │  − Weak to Rock (team has 2) │ Rain          ●   Pelipper ✓                    │
│ │  Leaves 20 pts / 5 slots ✓│ │ Spread damage ○   …                              │
│ │  [Pick] [Queue] [Why?]    │ ├──────────────────────────────────────────────────┤
│ └───────────────────────────┘ │ WEAKNESS SNAPSHOT  (top 3 problems + mini grid)  │
│ 2. …                          │ ⚠ Rock: 2 weak, 0 resist                         │
│ Filters: [≤ max] [role ▾]     │ ⚠ Electric: Pelipper ×4 …                        │
│ [Search all available… /]     ├──────────────────────────────────────────────────┤
│                               │ LIKELY GONE BEFORE YOUR NEXT PICK (8 picks away) │
│ YOUR QUEUE (drag to order)    │ Arcanine, Hisuian Arcanine — 3 coaches lack      │
│ 1. Arcanine 14 ⚠ at risk      │ Intimidate and can afford them                   │
│ 2. Gallade 12                 │                                                  │
└───────────────────────────────┴──────────────────────────────────────────────────┘
```

(Names and points above are illustrative. The developer and strategy agents compute the real values.)

The left column opens on **Plans** (tab "Plans | Best single picks"). The "Now" step of the selected plan is highlighted as the suggested pick.

Components: RosterPlan ×2–3, RecommendationCard ×5 (secondary tab), QueueList, RoleChecklist, WeaknessSnapshot, SnipeRisk, BudgetPill, and the Search command palette (`/` or `Ctrl+K`).

**Interactions**
- **Pick.** Drafarig cannot write to the sheet. "Pick" opens a confirm sheet: "Tell your league: **Talonflame 烈箭鹰 (9 pts)**. [Copy message]". The message is bilingual, ready to paste into the league chat. The pick is then marked *pending* locally until the next sync sees it in the sheet. If the sheet later shows Anthony picked something else, the sheet wins and the pending pick is cleared with a toast.
- **Why?** opens the explanation drawer (§5).
- **Compare.** Select 2–3 cards and press `C`. This opens a side-by-side view: price, roles, type changes to the team grid (cells that flip are highlighted), speed position, and budget after the pick.
- **Keyboard.** `1`–`5` focus a suggestion, `Q` queues, `/` searches, `C` compares, `Esc` closes the drawer.
- **Hard block.** If the price is more than the max for this pick, the Pick button is disabled with the reason inline: "Costs 16; you can spend at most 24 − … You'd have 13 pts for 5 slots, below the 5-pt minimum." Search results over budget sit under a divider: "Can't afford without breaking your roster".

**Turn detection:** see §11 Q2. If the order can't be inferred, the app shows a manual "It's my turn" toggle.

### 3.2 Draft → Planning mode (between picks)

Goal: get ready so the next On-the-Clock moment is fast.

- **Queue.** An ordered next-pick list. Each row shows price, an availability risk chip (`Safe` / `At risk` / `Likely gone`, see §6) and a "fits budget plan" tick. When a queued mon gets taken, it is struck through and the row says "Taken by Calvin: your backup is #2".
- **Watchlist.** Starred mons, unordered, kept all season. This follows Sleeper's queue/watchlist split. Watchlist mons also matter for free-agent pickups if the league allows them.
- **Budget planner.** A row of empty slots, each with a target price band, shown as a stacked bar of 100 points. Anthony can drag "plan" mons into future slots to test a path, for example "Tailwind setter ~9, Intimidate ~8, three 1–3 pt fillers". The planner checks the plan for feasibility and recomputes after each sync.
- **What-if sandbox.** "Add hypothetically" puts a mon on the team at a dashed outline. Every panel (matrix, speed, roles, threats) shows deltas such as `+1 resist Ground` or `fixes Speed control`. "Clear what-ifs" resets. This follows Indigo's Lab and LoLDraftAI's per-pick impact.
- **Opponent needs.** A strip of the nine coaches with their missing roles and points left, for example "Calvin: no Fake Out, 43 pts". Scanning it predicts who takes what before Anthony's next pick.
- **Board runs.** A toast when 3 of the last 5 picks share a role or type, for example "Speed-control run: 3 Tailwind setters gone in 5 picks".

### 3.3 My Team

1. **Roster cards** (drafted plus pending), each with form chips, price, roles, and a "why I have this" note field.
2. **Role checklist** (full version, §4.3).
3. **Weakness matrix** (§4.4).
4. **Offensive coverage:** which types the team hits super-effectively with STAB and with notable coverage moves. Gaps are named ("Nothing hits Water-types super-effectively"), with MonTeams' framing as a tooltip: "Coverage means hitting the types that wall you, not having many types."
5. **Speed ladder** (§4.5).
6. **Team verdict card:** three bullets in plain English ("Strong: Trick Room + rain options. Missing: Intimidate, a Ground answer. Watch out: Rock and Electric.") plus a grade, A–F or "needs work". The grade is optional and can be hidden.

### 3.4 League

- **Affordability is marked, never hidden.** Every available mon on the board, in search and in lists carries one of three states:
  - **Affordable**: normal.
  - **Tight**: affordable, but it forces every remaining slot down to 1–2-pt mons. Amber chip: "Leaves 4 pts for 5 slots".
  - **Breaks your budget**: priced above max-this-pick. Dimmed, with a hatched chip: "Breaks your budget: 31 > 24".
  These mons stay visible, so Anthony learns what is out of reach and why. A filter "Only what I can afford" exists but is **off by default**.
- **Board view.** Mirrors the sheet: 20 columns of point tiers with bilingual names. Taken cells are greyed and tagged with the owner's coach colour plus initials, so ownership never depends on colour alone. Available cells show role icons (Fake Out, Tailwind, TR, Intimidate, redirection) and the Mega badge. Filters: role, type, "only what I can afford" (off by default), "hide taken". A bilingual search box; typing 喷火 or "chariz" both match.
- **Coaches.** Ten cards, each showing:
  - picks with prices;
  - **points left · slots left · average per slot · max-next-pick**, using the same feasibility math as Anthony's meter;
  - "Can still afford: up to 20-pt mons" or "Priced out of everything above 13";
  - needs (missing roles) as "possible snipe" chips;
  - a per-coach role checklist in mini form.

  Feasibility is what makes the snipe prediction honest. A coach who can't afford a mon can't snipe it. Tapping a coach opens their Matchup view.
- **Picks log.** Chronological, from sheet order or inferred. Unmatched names are flagged.

### 3.5 Matchup prep (in season)

Pick an opponent, for example "Week 3 vs Jacky".

1. **Their roster** (all forms visible): a mini card per mon with roles and form chips. Mega-capable mons are highlighted, with the banner "Only one can Mega Evolve per game".
2. **Their threats to you.** A ranked list. Each threat has:
   - a one-line reason ("Torkoal sun + Venusaur-style Chlorophyll? / Golisopod Mega: hits Charizard…");
   - your answers ("Pelipper's rain overrides sun"; "Sinistcha TR outspeeds");
   - a status chip: `Answered` (two or more answers), `Thin` (one answer), or `Unchecked` (none).
3. **Speed comparison.** Both teams on one ladder with their forms. Toggles: Tailwind (yours / theirs), Trick Room, Icy Wind, Scarf.
4. **Type grid both ways:** your attacks vs their types, and their attacks vs your types.
5. **Bring-6 / Pick-4 planner.** Choose 6 of your roster and mark the Mega. The app suggests likely leads ("They probably lead Incineroar + Torkoal (Fake Out + sun)") and gives a counter-lead idea. It is labelled as a guess.
6. **Notes.** Markdown per opponent, saved locally (as in DraftZone).
7. **Export:** a Showdown-paste skeleton (species, plus "Mega stone" placeholders) for testing on Showdown, and a link to the Smogon/ChampDex calc.

### 3.6 Learn

- **Glossary** (§9): searchable, bilingual names where useful.
- **Draft 101 cards**, five short cards that open on first visit only if Anthony asks:
  1. how points work;
  2. why roles matter in doubles;
  3. how to read the grid;
  4. what "check" and "counter" mean;
  5. weekly prep.
- **Quiz-me mode** (from Arena Tracker's "Hide scores"): suggestion scores are hidden as `?`. Anthony picks what he thinks is best, then sees the app's reasoning and the difference from his pick.

### 3.7 Setup (first run)

A three-step wizard. This is staged disclosure, which is fine here because the steps are independent.

1. Sheet URL. Prefilled if the developer hardcodes it; "Test connection" checks it.
2. "Which coach are you?" Auto-suggests "5. Anthony".
3. League rules: roster size **10** and budget **100** (prefilled, locked, labelled "League rule"), draft order (Snake / Linear / Unknown), Mega rule (on, locked note: "League rule").

---

## 4. Key components

### 4.1 BudgetMeter
- A 100-segment bar split into spent (by mon, hover for names), *planned*, and free.
- Text, always in this order: **"29 pts left · 6 slots to fill · Average per slot: 4.8 · Max you can spend on this pick: 24"**.
- Formula: **max this pick = points left − (cost of the (slots left − 1) cheapest mons still available)**. In practice that is usually (slots left − 1) × 1, but it is computed live, because the 1-pt tier can run out. If fewer than (slots left − 1) mons remain at all, the meter says so.
- The rule is a hard one: every coach must end with exactly 10 mons. The meter's tooltip says: "League rule: 10 mons on 100 points. This is the most you can spend now and still afford the cheapest mons for every other empty slot."
- States:
  - Healthy (teal).
  - **Tight**: average below the 25th-percentile price of affordable mons that fill a needed role. Shown in amber: "Most mons that fill your gaps cost 6+; you average 4.8."
  - **Impossible**: red, blocking.
- Tooltip / glossary link: "Why max ≠ points left".

### 4.1b RosterPlan: recommendations as complete remaining-roster plans

Anthony is tight (29 points for 6 slots), so a great single pick can quietly wreck the next five. **The primary recommendation is therefore a complete plan for every remaining slot.** The "pick now" suggestion is the first step of a plan.

```
PLAN A · "Speed first"                         uses 28 of 29 pts ✓
 Now   Talonflame 9   (Speed control: Tailwind)
 Then  ~8  Intimidate user   e.g. <mon> 8   ⚠ at risk
       ~5  Rock/Ground resist e.g. <mon> 5
       ~3  Fake Out backup   e.g. <mon> 3
       ~2, ~1 fillers        e.g. <mon> 2, <mon> 1
 Fixes: Speed control ✓ · Intimidate ✓ · Rock weakness ✗ (still 2 weak)
 [Use this plan] [Swap a slot] [Why?]

PLAN B · "Trick Room core"                     uses 29 of 29 pts ✓
PLAN C · "Cheapest that fixes the most"        uses 22 of 29 pts (7 spare) ✓
```
(Names illustrative; the strategy and developer agents generate the real ones.)

- **2–3 plans**, each a **legal, affordable set** of mons for *all* remaining slots, drawn only from available mons. Each has a short name for its idea, total cost vs points left, and a role/weakness summary ("Fixes … / Still missing …").
- Each later slot shows a **named example plus price band and the role it fills**, and the line "or any similar", because later picks will change as others draft. Each slot has a snipe-risk chip.
- **"Swap a slot"** opens alternatives for that slot at the same or lower price and re-checks the plan's feasibility live.
- **"Use this plan"** loads the plan into the queue (slot 1 first) and the budget planner.
- **Plans recompute on every sync.** If a planned mon is taken, the plan shows "Slot 3 sniped → replaced by …" or "Plan no longer works, here's the closest".
- The **top-5 single-pick list** (4.2) stays as a secondary tab, "Best single picks". Each card shows "Appears in Plan A, C" and "Leaves a feasible plan ✓/✗". A pick that leaves **no** feasible plan carries the label "Breaks your budget".
- **Opponent plans (later):** the same engine, run per opponent, shows what each coach can still realistically build ("Calvin can still afford one 20-pt mon + fillers").

### 4.2 RecommendationCard
- Header: sprite, bilingual name, price, **grade** (A–D; Expert mode shows the raw score), Mega badge.
- **Reason chips**, three positive and one negative at most, each prefixed with `+` or `−` and linked to the panel it changes:
  - `+ Fills Speed control (your biggest gap)`
  - `+ Resists Rock & Ground (you're weak to both)`
  - `+ Answers 3 opponent threats`
  - `− Shares Electric weakness with Pelipper`
- **Budget line:** "Leaves 20 pts for 5 slots (avg 4.0) ✓".
- **Risk line:** "Likely gone before your next pick (2 coaches need this)".
- Buttons: Pick (copy message) · Queue · Why?

### 4.3 RoleChecklist (modelled on Arena Tracker's counters)

Rows are doubles roles. Each row shows: the minimum target, the count, the holders, and a status: ✓ met, ✗ missing, or ○ optional.

**Proposed MVP roles.** The VGC strategy agent owns the final list and targets.

| Role | Target | Notes |
|---|---|---|
| Speed control (Tailwind / Trick Room / Icy Wind / Electroweb / Scarf) | 2, ideally one of each direction | |
| Fake Out | 1–2 | |
| Intimidate | 1 | |
| Redirection (Follow Me / Rage Powder) | optional 1 | |
| Spread damage | 2 | |
| Priority attack | 1 | |
| Protect-capable | most of the team | |
| Wide Guard / anti-spread | optional | |
| Weather / terrain setter | as the plan needs | |
| Physical / special attacker balance | | |
| Mega-capable slot | ≥1 | Only one Mega per battle, so more than two adds little |

Every row label is a GlossaryTerm. A red row offers "Show mons that fill this" (a filtered board).

### 4.4 WeaknessMatrix
- 18 rows (attacking types) × roster columns. Mega-capable mons get a sub-column per form when "Show forms" is on.
- Summary columns: **Weak (#)**, **Resist (#)**, **Immune (#)**, **Net**.
- Cell: glyph + multiplier, colour-blind safe.
- A row with 3+ weak and 0 resist/immune is flagged: "⚠ Stacked weakness (no answer yet)".
- Above the grid, a verdict line lists the top three problems in words.
- Abilities that change matchups (Levitate, Flash Fire, Water Absorb, Thick Fat…) are applied, with a footnote dot.
- Clicking a row filters the board to "available mons that resist this and fit budget".

### 4.5 SpeedLadder
- A vertical ladder at Level 50.
- Each mon is plotted at **max speed (+nature, 32 SP)** with a neutral-speed tick; Trick Room mons are plotted at **min speed**. Mega forms appear as separate ticks.
- Toggles: Tailwind ×2 (mine / theirs), Trick Room (inverts the ladder), Scarf ×1.5, Icy Wind −1.
- Overlay: my team (solid), the selected opponent (outline), and optionally the league's top threats.
- Ties are flagged "speed tie: 50/50 who moves first".
- Rows with 3+ of my mons within 5 points of each other get a "Speed clumping" note (from Fundrafted).
- Explainer line: "Higher moves first. Under Trick Room, lower moves first."

### 4.6 ThreatList
Ranked list of opponent mons (all forms) against my roster.
- Columns: threat, why (≤ 1 sentence), my answers (chips), and status (`Unchecked` / `Thin` / `Answered`).
- Scope selector: `All 9 opponents` (draft time) / `One opponent` (matchup).
- **Definition shown on hover:** "Answered = at least 2 of your mons either outspeed and hit it super-effectively, or resist both its main attacking types."
- MVP uses a type-and-speed heuristic. Damage calcs come later.
- Every row carries the label "Estimate".

### 4.7 MonCard / Detail drawer
- Bilingual name, price, owner/status, types, base stats bar, abilities.
- "Typically used for" role chips (from usage data, labelled "ladder data").
- **Form chips.**
- Speed at the benchmarks.
- What it does for MY team (deltas).
- Who in the league it threatens / is threatened by.
- Glossary links.
- External links: Pikalytics, the calc.

### 4.8 SyncBadge
States: `Syncing…` · `Synced 12s ago` · `Using data from 14:02 (sheet unreachable)` · `Partial: 3 names unmatched`. It also shows a manual ⟳.

### 4.9 GlossaryTerm
- A dotted underline. Popover on hover or focus (desktop) and on tap (mobile, as a popup tip).
- Content: a ≤ 2-sentence definition, a "Why it matters in draft" line, and "Who on the board does this" (a filter link).
- The `Just the facts` level hides the "Why it matters" line. Underlines stay.

### 4.10 NameMatchResolver
For each unmatched name: the raw text (for example "Politoad") and a suggestion ("Did you mean **Politoed** 蚊香蛙皇? 92%"). Actions: Accept / Choose another / Ignore. Accepted fixes are saved as local aliases. Matching order: exact English → normalized (case, spaces, hyphens, regional prefixes "Alolan / Galarian / Hisuian / Paldean") → Chinese name → alias table → fuzzy.

---

## 5. Recommendation explanations (the "Why?" drawer)

The structure follows chess.com's coach format: a label first, then one plain sentence, then evidence Anthony can click.

```
Talonflame — Suggested (A)                                      9 pts
"Your team has no way to make itself fast. Talonflame sets Tailwind with
priority (Gale Wings at full HP), so your Charizard moves first for 4 turns."

What it changes
  Speed control   ✗ → ✓          [show in checklist]
  Ground weakness 2 weak/0 resist → 2 weak/1 immune   [show in grid]
  Rock weakness   2 → 3 weak  (−)                     [show in grid]
  Budget          29/6 slots → 20/5 slots (avg 4.0) ✓

Score breakdown (Expert)
  Fills a missing role        +30
  Fixes a team weakness       +10
  Answers league threats      +12  (Rillaboom ×3 rosters, Sneasler …)
  Value for price             +8
  Adds a shared weakness      −8
  ────────────────────────
  Total                        52   (#1 of 61 you can afford)

Not sure? Alternatives that also fill Speed control: Whimsicott (taken), Murkrow…
```

Rules:
- Use at most one sentence of reasoning, written in the user's language ("moves first"), not the model's ("speed tier delta +34").
- Name the factor that matters most first (iTero's ordering).
- Always include one honest downside.
- Always show the budget consequence.
- Expert mode reveals the weights. A settings panel lets Anthony nudge them (sliders: "How much do I care about the meta vs my gaps"). This guards against the HearthArena problem of one factor drowning the rest.
- Early picks lean on raw power; late picks lean on filling needs. Weights shift with slots left and the UI says so: "Late in the draft, filling gaps counts more." (Advice from 17lands and Draftsim.)

---

## 6. Snipe risk / availability (no ADP in this league)

The fantasy tools use average draft position; this league has none. So the app estimates from the league itself:
- **Picks before my next turn** = N (from the inferred order).
- For each available mon, count the coaches picking before Anthony who (a) **can afford it at their own max-this-pick (same 10-mon feasibility rule)**, and (b) lack a role it fills, or have it on their queue (unknown, so ignored).
- Chip:
  - `Likely gone`: 3+ such coaches, or a top-usage mon.
  - `At risk`: 1–2.
  - `Safe`: 0.
- Tooltip: "Estimate from other coaches' needs and budgets, not a prediction."
- Guidance copy, adapted from DraftKick: "If it's *Likely gone* and you want it, take it now. If it's *Safe*, you can probably wait."

---

## 7. Interaction flows

### 7.1 First run
1. Setup wizard (3 steps).
2. First sync.
3. If names don't match, show the NameMatchResolver banner. Analysis still runs, with unmatched mons shown as "unknown".
4. Land in the mode that fits the draft state.
5. One coach mark only: point at the budget pill with the text "This number is the most you can spend right now and still fill your roster." It is dismissible and never repeats (NN/g: one tip, at the right moment).

### 7.2 On the clock
1. Reload, so a fresh sync runs.
2. The app detects the turn: top bar pulses "You're on the clock"; an optional sound is muted by default.
3. Anthony scans the top 5 and the "Your team needs" panel.
4. Optionally compares two candidates.
5. **Pick** → copy the bilingual message → paste into the league chat. The pick shows as *pending*.
6. The next reload confirms it from the sheet.
7. The app switches to Planning and shows "Next pick in 9 picks".
8. If the queue's #1 was taken during his turn (a stale sheet), a banner says "Talonflame was just taken by Calvin; showing your next best."

### 7.3 Between picks
1. Open Planning.
2. Look at the opponent-needs strip.
3. Reorder the queue (risk chips update).
4. Try what-ifs in the sandbox.
5. Adjust the budget plan.
6. Reload any time to refresh; queue items that got taken show strikethrough and "use backup".

### 7.4 Weekly matchup prep
1. Matchup → choose the opponent.
2. Read the verdict ("Their biggest threats: Torkoal sun, Incineroar Fake Out + Intimidate. Your best answer: rain via Pelipper").
3. Work through threats; mark notes.
4. Build bring-6 and choose the Mega.
5. Check the speed ladder with Tailwind / TR toggles.
6. Export the paste and open the calc for specific checks.
7. Notes persist for the rematch / playoffs.

### 7.5 Fixing an unmatched name
Banner "2 names couldn't be matched" → resolver → accept the suggestion → the analysis recalculates instantly and the alias is saved.

---

## 8. Loading, empty and error states

| State | What the user sees | Behaviour |
|---|---|---|
| Loading (first) | A skeleton of the layout; top bar "Reading league sheet…" | Never a blank page. |
| Loading (reload with cache) | Last data shown instantly; badge "Syncing…" | Swap in fresh data when ready; highlight what changed ("2 new picks since 14:02": Hex took Arcanine, Ning took…). |
| **Sheet fetch failed** | Amber banner: "Couldn't reach the league sheet. Showing data from 14:02 (8 min ago). Picks made since then are missing." [Retry] [Open sheet in new tab] | Analysis still works on the cache. The On-the-Clock top 5 shows a "may be stale" ribbon. With no cache: a full-page message with Retry and "Check the sheet is still public". |
| Sheet structure changed | "The sheet layout changed (couldn't find the 'Points Left' row / the 20-point column)." | Show which parser step failed; keep the cache; offer "Report to developer" (copy debug info). |
| **Name can't be matched** | Yellow chip on the card "Unmatched: 'Politoad'"; banner count | The mon is still counted toward points and roster; it is excluded from type analysis with a note "Analysis ignores 1 unmatched mon". |
| **Board vs picks mismatch** | "Arcanine is red on the board but not in anyone's picks" (or the reverse) | Trust the Drafts tab for ownership; treat red-only as "taken, owner unknown". List mismatches in the Sync drawer. |
| Points mismatch | "Sheet says Anthony has 29 left; picks add up to 71 spent ✓". If they differ: "Sheet says 30; picks add to 71 spent (29 left). Using the sheet's number." | Never silently pick one. |
| No feasible roster | "No combination of available mons fills your 6 slots with 29 pts." (Possible only if cheap tiers run out.) | Red banner; show the cheapest possible completion and the shortfall. |
| Empty queue | Small, muted: "Queue mons to plan your next picks. Press Q on any suggestion." | Not visually loud (fixes the ESPN complaint). |
| No affordable mon fills a role | "No available mon you can afford fills Intimidate. Closest: Arcanine (14, over by 2)." | Suggest the trade-off. |
| Draft complete | Draft mode shows the final team grade and a summary; the default mode becomes Matchup | |
| Usage data unavailable | Usage-based chips are hidden; tooltip "Meta data offline; recommendations use types, stats and roles only" | |
| Offline (no internet) | Same as a failed fetch | |

---

## 9. Jargon tooltip copy (GlossaryTerm content)

Each tooltip is a definition plus *Why it matters in draft*. Keep definitions at two sentences or fewer.

| Term | Tooltip | Why it matters in draft |
|---|---|---|
| **Doubles / VGC** | Two of your Pokémon are on the field at once against two of theirs. VGC is the official doubles format. | Moves that hit both foes, or help your partner, are worth far more than in singles. |
| **Bring 6, pick 4** | You choose 6 from your roster for a match, then see their 6 and pick 4 to play. | Your 10+ mons need to cover many opponents, but each game uses only 4. |
| **Speed / moves first** | Within the same priority, the faster Pokémon acts first. | Moving first often means KO'ing a threat before it acts. |
| **Speed control** | Anything that changes who moves first: Tailwind, Trick Room, Icy Wind, Electroweb, Choice Scarf. | Most strong teams have at least one; it's the role new coaches most often forget. |
| **Tailwind** | Doubles your side's Speed for 4 turns (including the turn it's used). | Lets mid-speed hitters outspeed almost everything. Prankster users set it with priority. |
| **Trick Room** | For 5 turns, slower Pokémon move first. | Turns slow, bulky mons into first movers; Sinistcha is one of yours. |
| **Icy Wind / Electroweb** | Spread attacks that also lower both foes' Speed by one stage. | Cheap speed control that also deals damage. |
| **Priority** | Moves that go before normal moves regardless of Speed (e.g., Fake Out +3, Extreme Speed +2, Sucker Punch +1). | Finishes off weakened fast threats; ignores speed tiers. |
| **Fake Out** | Hits first and makes the target flinch (lose its turn); only works on the user's first turn out. Ghost-types and Inner Focus users are immune. | Buys your partner a free turn to attack, set Tailwind or Mega Evolve safely. |
| **Intimidate** | Ability: lowers both opponents' Attack by one stage when it enters. | Softens physical attackers every time it switches in. |
| **Redirection** | Follow Me / Rage Powder pull single-target attacks onto the user. | Protects your key attacker or setter for a turn. |
| **Protect** | Blocks almost all moves for a turn; fails more often if used repeatedly. | Lets you scout and stall Tailwind/Trick Room turns; nearly every mon carries it. |
| **Wide Guard** | Blocks spread moves aimed at your side this turn. | Hard-counters teams that rely on moves like Rock Slide or Earthquake. |
| **Spread move** | Hits both foes (sometimes your ally too) at 75% power. | Steady damage on two targets: Earthquake, Heat Wave, Rock Slide, Dazzling Gleam. |
| **Helping Hand** | Boosts the ally's move power by 50% this turn, with priority. | Turns near-KOs into KOs. |
| **Weather (rain / sun / sand / snow)** | Field effect lasting 5 turns (more with an item); boosts some types and abilities. | Pelipper sets rain: Water moves ×1.5, Fire moves ×0.5, Swift Swim users double Speed. The last weather set wins. |
| **Mega Evolution** | Once per battle, one Pokémon holding its Mega Stone transforms: higher stats, maybe a new type or ability. | **League rule:** drafting a mon gives you all its Megas, but you can still Mega Evolve only one per game. |
| **STAB** | Same-Type Attack Bonus: moves matching the user's type do ×1.5. | Why a type's attacks matter more on that type of mon. |
| **Super-effective / resist / immune** | ×2 (or ×4) damage / ×½ (or ×¼) / no damage, from the type chart. | Your team's shared weaknesses get exploited by spread moves. |
| **Stacked weakness** | Three or more of your mons are weak to the same type and none resist it. | One good attacker of that type can beat your whole team. |
| **Check / counter** | A check beats a threat in some situations; a counter beats it reliably, even switching in. | The app's "Answered" means at least 2 checks. |
| **Threat** | An opponent mon that can KO or outspeed several of yours. | Draft at least one answer to each common threat. |
| **Role compression** | One mon doing two jobs (e.g., Fake Out + Intimidate). | Saves roster slots and points; prized in drafts. |
| **Speed tier** | A mon's Speed at a common investment (max, neutral, min) at Level 50. | Lets you see exactly who outspeeds whom. |
| **Stat Points (SP)** | Champions' training system: 66 points per mon, max 32 in one stat. | The app assumes max Speed (32 SP + nature) for fast mons and minimum Speed for Trick Room mons. |
| **Snipe** | Another coach takes the mon you wanted just before your turn. | Keep a queue with backups; see "Likely gone". |
| **Run** | Several coaches in a row draft the same role/type. | If a run starts, the last good one goes fast. |
| **Points per remaining slot** | Points left ÷ empty roster slots. | If it's low, you can only afford cheap mons for the rest of the draft. |
| **Max this pick** | Points left minus the cost of the cheapest available mons for each of your other empty slots (usually 1 point each). | Spending more than this means you can't fill your roster. |
| **Tier (points)** | The board's price column (20 = most valuable, 1 = cheapest). | Within a price, mons are often interchangeable; between prices, the gap matters. |
| **Lead** | The two mons you send out first. | Fake Out + Tailwind leads are a common, strong start. |
| **Mega badge (M)** | This mon comes with Mega form(s) by league rule. | Extra options at no extra points; plan which one you'd Mega in each matchup. |

---

## 10. Mobile and responsive behaviour

- Breakpoints: ≥1200 three columns; 768–1199 two columns (the drawer becomes an overlay); <768 a single column with **bottom tabs**: `Pick` (On-the-Clock or Planning), `Team`, `League`, `Matchup`, `More`.
- The top bar condenses to a sticky strip: turn status, points/slots/max, sync dot.
- The weakness matrix on a phone becomes the **problem list**: only flagged rows show, with "Show full grid" scrolling horizontally *inside* its card, never the page. Sticky first column.
- The speed ladder becomes a vertical list, which is already narrow.
- Tooltips become tap popups with a close button (NN/g: hover doesn't exist on touch).
- Touch targets ≥44px. A 16px gutter. No horizontal page scroll.

## 11. Accessibility
- Colour plus glyph plus text everywhere. AA contrast. Full keyboard paths. Focus-visible rings.
- GlossaryTerm opens on focus. Live region announces "You're on the clock".
- Respect `prefers-reduced-motion`; no pulse animation when it is set.
- Bilingual names get `lang="zh"` on the Chinese span.

---

## 12. Prioritised feature list

### MVP (build first)
1. **Sheet sync on every load**: board (with taken status) and drafts tab, cross-checked; SyncBadge; cached fallback with a stale warning.
2. **Name matching**: English + Chinese + normalization + alias table + resolver UI.
3. **Setup**: coach identity, draft order; league rules prefilled (10 mons, 100 pts).
4. **BudgetMeter**: max this pick, average per slot, hard block on impossible picks.
5. **My Team**: roster cards **with Mega form chips**, the WeaknessMatrix (forms aware), the RoleChecklist.
6. **Roster plans (2–3 complete, feasible plans for the remaining slots)** plus a top-5 single-pick tab with reason chips, a budget line and a "Why?" drawer (plain sentence + what-it-changes). Mons are marked Affordable / Tight / Breaks your budget everywhere, not hidden.
7. **League board view**: affordability marking, filters (role, type), bilingual search, owner tags. **Coach cards with points/slots/average/max-next-pick for all 10 coaches.**
8. **Opponent threat list** (all 9 opponents, all forms; type/speed heuristic; Answered/Thin/Unchecked).
9. **Speed ladder** with Tailwind / Trick Room toggles, Mega ticks.
10. **Glossary tooltips** (§9 copy), plus `Explain everything / Just the facts`.
11. **On-the-Clock layout** with auto-detected turn (or a manual toggle), plus a copyable bilingual pick message.
12. Queue (local, ordered, strike-through when taken).

### Next (v1.1)
- Snipe-risk chips and an opponent-needs strip. (Opponent budget feasibility on Coach cards is MVP, because it is cheap and already needed.)
- What-if sandbox with deltas.
- Compare view.
- Matchup mode: one-opponent view, both-ways type grid, bring-6/pick-4 with Mega choice, notes.
- Offensive coverage panel.
- Board run detection toasts.
- Budget planner (slot targets).
- Keyboard shortcuts / command palette.
- Mobile bottom-tab polish.

### Later
- Damage-calc-backed threat checks (KO ranges vs common sets); team-vs-many.
- Usage-data enrichment (typical moves/items) with a timestamp.
- Quiz-me learning mode; Draft 101 cards.
- Showdown paste export; links to Pikalytics and the calc.
- Free-agent / trade evaluator (if the league allows).
- End-of-draft grade and recap; season results tracking (replays → stats).
- Score-weight sliders in Expert mode.
- Discord-friendly share card of the team.

---

## 13. Open questions for Anthony (blocking items marked ★)

1. ~~Roster size~~: **resolved, 10 mons**. Still open: can a coach end *under* 100 points? Is any point carry-over or penalty involved?
2. ★ **Draft order.** Snake (1→10, 10→1…) or the same order every round? Is there a pick timer? The snapshot fits snake with Anthony next in round 5. The app needs this to show "you're on the clock" and "N picks until you".
3. ★ **How do picks reach the sheet**, and how fast? (Commissioner by hand, a Discord bot, coaches themselves?) This sets how much the app should trust a "stale" sheet.
4. **Format confirmation.** Pokémon Champions **Reg M-C** rules (doubles, bring 6 pick 4, Level 50, item clause, one Mega per battle)? Or a custom league ruleset (e.g., all Megas legal)?
5. **Mega rule details.** Can you Mega Evolve only one Pokémon per game, as in standard VGC? Does every board mon with a Mega in Champions get its Megas, including ones not legal in M-C?
6. **Free agency / trades** during the season? If yes, the watchlist and an "upgrade" evaluator become valuable.
7. **Season schedule.** Is there a weekly opponent list, so Matchup mode can preselect the next opponent? Best-of-1 or best-of-3?
8. **Where do you draft?** On a laptop or a phone? This sets which layout gets polish first.
9. **Language.** Show both Chinese and English names everywhere, or English with Chinese on hover?
10. **How much teaching?** Default to `Explain everything`, with the option to switch to `Just the facts` later?

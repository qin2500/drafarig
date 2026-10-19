# Matchup guide inside the app: UX spec

Drafarig UI UX, 2026-10-19.

**Built against:** `prep-builder` fb84780.

**Inputs:**
- `public/vs-calvin.html`, the standalone page Anthony liked.
- `docs/research/strategy/guide-schema.md`, the data format (decided): one `lib/guides/<pov>v<opp>.mjs` per matchup.
- The current screens' modules, cited per section.

**Anthony's ask:** *"incorporated seamlessly into the Drafarig app itself rather than a separate html document. Use all the existing tools already built into Drafarig, and just inject the customized advice into it."*

**The rule this spec follows:** a guide is **not a page**. Every guide field lands on the screen where Anthony already makes that decision, in that screen's own components:
- a guide calc is a workbench link;
- a guide team is a Team;
- a guide lead is a Plan board pick;
- a guide threat is a "Can wreck you" row.

The only new surface is one card at the top of the Brief.

Below, *guide* means the module for the open matchup (pov seat, opp seat). It applies only when you view your own side (`P.ownSide()` = the guide's pov coach). Viewing as another coach shows nothing from it.

---

## 0. Where every schema field goes

| Guide field | Lands in | Module |
|---|---|---|
| `remember`, `bring`, `previews`, `leads` | **Game plan card**, top of the Brief (§1) | `prep-matchup.js` `brief()` (new `planCard` before `bcols`) |
| `tells`, `lose`, `endgame` | Game plan card, folded rows (§1.4) | same |
| `assumptions`, `written` | Card header line (§1.1); every calc sheet's source line | same; `prep-workbench.js` `sourceLine` |
| `perMon[theirId]` | Pool card dot + **their detail sheet** (§2) | `prep-matchup.js` `poolSection`, `detail()` (side `their`) |
| `perMon[ourId]` | **Our detail sheet** + **teambuilder** box (§3) | `prep-matchup.js` `detail()` (side `your`); `prep-teambuilder.js` `editor()` |
| `calcs` | **Workbench links** wherever their mons appear (§4) | `prep-workbench.js` `open` |
| `combos.theirs` | **Merged into "Can wreck you"** (§5) | `prep-threats.js` `briefBody` |
| `combos.ours` | Game plan card, folded "Our double KOs" row (§1.4) | `prep-matchup.js` |
| `sets` + `bring` | **Import recommended team** → Teams (§6) | `prep-teams.js` `importText`, `bringTeam` |
| `leads`, `previews` | **Plan board** pre-fill, opt-in (§7) | `prep-board.js` `editPicks` / `writePicks` |
| `perMon[theirId].worstCase` | **Move search** result sub-line (§8) | `prep-moves.js` `chipsFor` |

A new pure helper, `lib/guide.mjs`, does all the matching:
- `guideFor(povSeat, oppSeat, coaches)`: matches by coach **name**, because seats can move;
- `staleness(guide, rosters)`;
- `calcSeed(P, calc)`: turns a guide calc into a workbench seed;
- `mergeWreck(scanRows, combos, calcs)`.

Strings go into a new `C.GUIDE` block in `prep-copy.js`.

---

## 1. Brief: "Game plan vs ZhuZi" card

### 1.1 Position and header
- It goes first in `brief()`, full width above the two columns (`bcols`). On a phone it's the first thing under the matchup tabs.
- Header row:
  - **Game plan vs ZhuZi** · `W3`.
  - A muted line: "Written 19 Oct · their sets are ladder guesses, not ZhuZi's real ones · calcs at Lv 50, full HP, no crits". This comes from `assumptions[0..1]`, with **"(more)"** expanding the full `assumptions` list.
  - A small **"Guide"** pill marks everything the guide adds anywhere in the app (§9). It's the same pill style as the existing `layerChip`.
- The card is a `section()` like the others (`prep-matchup.js` L91), id `plan`, so the Brief's existing section focus and jump behaviour applies.

### 1.2 What's open by default (phone: about one screen)

```
┌ Game plan vs ZhuZi · W3                         [Guide] ┐
│ Written 19 Oct · ladder-guess sets · Lv 50 (more)         │
│                                                           │
│ REMEMBER                                                  │
│ 1 Mega Charizard Y, not Kangaskhan. Sun halves his Water… │
│ 2 Staraptor that doesn't Mega and outspeeds Morpeko is…   │
│ 3 Aegislash walls Mega Staraptor…                         │
│   + 2 more                                                │
│                                                           │
│ BRING                                                     │
│ [Zard M][Aegi][Morp][Rotom][Sini][Kanga]  bench: Peli Conk… │
│ Mega: Charizard Y · why ›                                 │
│ [Import as team]  [Bring it vs ZhuZi]                     │
│                                                           │
│ HIS PREVIEW SHOWS…                                        │
│ (Staraptor+Grimm+Volc) (Mamoswine) (Double Tailwind) (Jolteon) │
│  → Bring 4: Zard · Morp · Aegi · Rotom   Lead: Zard + Morp│
│    T1 Fake Out Grimmsnarl; Mega + Heat Wave (65–77% ›)    │
│                                                           │
│ ▸ Leads and turn 1 (3)   ▸ Tells (8)   ▸ How we lose (5)  │
│ ▸ Endgame   ▸ Our double KOs (3)                          │
└───────────────────────────────────────────────────────────┘
```

- **Remember:** the first 3 `remember` items in full, then "+ N more". The numbered list uses the app's `.rsns` list style; it's not a new style.
- **Bring:** the six use the app's portraits (`P.pt`, size sm). The Mega gets the existing `megad` badge. Bench mons are greyed portraits with a strike. Tapping any portrait opens the existing `/your/<n>` sheet, now with the guide note (§3). "why ›" expands `bring.mega.why` and `bench[].why` inline.
- **His preview shows…:** one chip per `previews[]` item (the label is `if`, shortened). The first chip is selected by default.
  - The selected chip shows `bring4` as mini portraits, `lead`, and its `note`.
  - When `previews[i].lead` matches a `leads[]` entry, it shows that lead's T1 line with its numbers as **workbench links** (§4).
  - The choice is remembered per matchup in `briefUi(P, pov, opp)` (`P.ui.brief`).
  - It also **sets the Brief's lens**: the tray switches to "Your 4" and the speed track shows those 4 (the existing `lens` mechanism, extended from 10/6 to 10/6/4).
- **Buttons:** "Import as team" (§6) and "Bring it vs ZhuZi" (shown only once the guide team exists).

### 1.3 Leads (folded row → expands in place)
- One card per `leads[]` entry: **our pair** (portraits) **vs their pair** (portraits), then T1 / T2 / T3 as three short lines, then `ifs` as "If he… → …" lines.
- Every number in those lines becomes a link when the guide has a matching calc (matched by attacker, defender and move). A number without a matching calc stays plain text with a dotted underline: "from the guide; not re-checked".
- Each lead card has **"Use on Plan board"** (§7).
- These are cards stacked vertically, never a wide table. That's the main phone difference from `vs-calvin.html`'s 4-column table.

### 1.4 Other folded rows
- **Tells:** each item is "You see → It means → Do", one block per tell, with the "Do" in bold.
- **How we lose:** the `lose[]` list, numbered.
- **Endgame:** the list.
- **Our double KOs** (`combos.ours`): "Charizard Weather Ball + Rotom Thunderbolt → all six (117–139% on Volcarona)", where the two parts are workbench links (§4.3).
- **His combos** are *not* a row here. They live in "Can wreck you" (§5), and the card shows a one-line pointer instead: "His double-target KOs are in Can wreck you ↓ (5 from the guide)".

### 1.5 Phone specifics (he preps on a phone)
- The card is collapsed to §1.2 on first open. Each folded row is a `<details>` with a 44px summary (the existing `.prep details > summary` rule).
- **The Brief tray gets a "Game plan" button** (`tray()`, `prep-matchup.js` L355), visible only when a guide exists. It opens the Remember list plus the selected preview as a bottom sheet, from anywhere in the Brief. That's the match-day glance.
- No horizontal tables: previews are chips, leads and tells are stacked blocks, and combos are lines.
- Text size is the app's (14px), not the standalone page's 16px display fonts. Same tokens, same chips.

---

## 2. Their mons: pool cards and detail sheets

- **Pool card** (`poolSection`): when `perMon[id]` exists, add a small "G" dot in the card's top-left. It's the same slot and style family as the existing `wreckd` "!" badge, using the Guide colour. The card's `aria-label` gains ", guide note".
- **Their detail sheet** (`detail()`, side `their`): a **"Guide"** block is inserted first, under the sheet head and above the automatic reasons:
  - **Role:** `role`;
  - **Worst case:** `worstCase` (a workbench link when a guide calc matches);
  - **Answer:** `answer`;
  - `notes` as bullets.

  Below it, **"Calcs from the guide"** lists every `calcs[]` row that involves this mon, as workbench links (§4).
- The automatic content (pressure, faster/slower, tools, checks) stays below it, unchanged. The guide never replaces automatic facts; it adds above them.

---

## 3. Our mons: detail sheet and teambuilder

- **Our detail sheet** (`detail()`, side `your`): a "Guide" block with **Job**, **Avoid** and `notes`, plus its calcs (attacker or defender = this mon) as workbench links.
- **Teambuilder** (`prep-teambuilder.js` `editor()`), when the scope is this guide's coach (`scopeOf().value === guide.coach`): a box **"Guide vs ZhuZi"**, placed directly above the existing "Threats to this mon" `<details>` (`tb-threats`, L248). It holds:
  - Job / Avoid / notes (2–4 lines, with "more" if longer);
  - this mon's guide calcs as chips (`Heat Wave → Mamoswine 187–221% ›`). Each chip opens the workbench with *your current draft* as your side, so dragging SP in the editor and re-opening shows the new number;
  - **"Guide's set"**: when the guide's `sets` text has this species and its spread, item or nature differs from your draft, a one-liner such as "Guide runs Modest 26 Spe (beats the 145 group) · [Try it]".
    - "Try it" uses the existing `tb-try` path: it pins your current set as A and puts the guide's set into the draft, so the diff bar shows what changes.
    - Nothing saves without Save version.
- In whole-league scope the box doesn't show (a guide is per opponent).

---

## 4. Guide calcs open in the workbench

### 4.1 Mapping (`lib/guide.mjs` `calcSeed`)
Each `calcs[]` row becomes a `WB.open(P, seed)` call (`prep-workbench.js` L28):

| Guide field | Seed |
|---|---|
| side `set: 'ours'` | `mine` = your set for that species: **the set in the team you bring vs this coach**, else your first set of that species. `setId` = that lineage, so "Apply to my set" works. With no set at all, the guide's `sets` text for that species is used (labelled "guide's set, not saved"), and Apply is replaced by "Import as team" |
| side `set: 'ladder'` | `row` = that mon's `targetsOf` row (source `ladder`) |
| side `set: 'worst'` | `row` with `set` = `worstCaseOf(P, row, move)` (source `search`). This is the same as the "Can wreck you" taps |
| `ability`, `item`, `nature`, `sp` overrides | applied onto that side's set |
| `move`, `field.weather/screens/intimidate` | `move`, `field`, `intimidated` |
| mineRole | `'attacker'` when ours attacks, else `'defender'` |

### 4.2 Showing the guide's number honestly
- A guide link renders its **stated `range`** (e.g. `65–77% ›`) so the line reads as the guide wrote it.
- Opening it computes live, and the workbench head adds one line under the result:
  - "Guide: 65–77% · now 65–77% ✓", or
  - "**Guide: 65–77% · now 58–69% with your current Charizard (Modest 20 SpA)**".

  The words say why it differs: your set, or their roster/set source.
- The difference check runs only when the workbench opens (no background engine work). The guide's text is never rewritten.
- The workbench `sourceLine` gains the guide provenance: "Their side: ladder guess (Smogon Sept) · as the guide assumed".

### 4.3 Two-attacker combos
The workbench is one attacker. A combo line ("Rap Brave Bird + Volcarona Heat Wave → Charizard 108–127%") shows:
- the total as stated;
- each part as its own link, opening the workbench for that hit;
- a muted note: "Total from the guide (two hits on the same target). Open each part to check it".

The total isn't recomputed, and the copy says so.

---

## 5. "Can wreck you": the guide merges into the scan

`prep-threats.js` `briefBody` keeps its structure (Charizard KOs, spread doubles, priority, per mon). The guide joins it in two ways.

1. **Matched rows get the guide's answer.** When a guide `combos.theirs` entry or a "dies" calc has the same (their species, move, our species) as a scan row, that scan row gains:
   - a "Guide" pill;
   - an **Answer:** line ("Protect, or Fake Out Volcarona").

   The numbers stay the scan's (live). If the guide's range differs by more than 5 points, the guide's range also shows in muted text: "(guide: 108–127%)". *There is never a duplicate row.*
2. **Guide-only rows go in one new subsection, "Double-target KOs (from the guide)".** These are two-attacker combos the scan can't make, and calcs whose set the scan wouldn't pick. It sits first in the section, because those are the turn-1 dangers.
   - Rows use `tw-row` styling with the Guide pill.
   - Each part is a workbench link (§4.3); the answer is in bold.

**Section summary line:** "6 OHKO threats · 5 double-target combos from the guide · tap any row to open it".

**The pool card "!" badge** (`wreckers`) also counts guide combos. A mon that is only dangerous in a guide combo still gets "!", with the label ", in a guide combo".

---

## 6. "Import recommended team" → Teams

- **Where:**
  - the Game plan card's Bring block (§1.2);
  - the Teams list header, as one line per matchup that has a guide: "ZhuZi (W3) has a game plan · [Import its team]";
  - the matchup's Bring picker (`prep-teams.js` `bring()`), as "[Import the guide's team]" when no team is chosen yet.
- **One tap:**
  - `importText(P, guide.sets, null)` creates a new team named **"vs ZhuZi (guide)"**, with every set's version reason "from the ZhuZi guide (19 Oct)".
  - It then shows the existing import report (EV→SP conversions, held sets) as a toast or summary, followed by **"Bring it vs ZhuZi?"**, which calls `bringTeam`.
- **Already imported** (a team with that name exists): the button becomes **"Update from guide"**.
  - It adds a new **version** to each matching set (species match) when the data differs, and adds missing species.
  - It never deletes. The toast lists what changed: "Updated Charizard (Modest 26 Spe), added Sinistcha".
  - Sets Anthony edited after import get the guide's version as the new current version, with his edit still in history ("Use this version" restores it). Before updating, the button says "2 of these sets were changed since import: the guide's version will be added on top (your edits stay in history)".
- **Species he didn't draft** are held, as the import screen does today.
- **Item clause and species clause** are the existing team warnings.

---

## 7. Plan board pre-fill (opt-in)

- On the Plan board (`prep-board.js` `board`), when a guide exists and the selected card's Lead/Back slots are empty: a row above the slots, **"Guide lead for this: Charizard + Morpeko · [Fill]"**.
  - The lead is chosen by matching `leads[].vs` or `previews[].if` species against the selected plan's members (their core).
  - With several matches, "[Fill ▾]" lists them.
- **Fill** writes through the existing `editPicks` / `writePicks` path:
  - `lead` = `leads[i].ours`;
  - `bring4` = the matching `previews[].bring4`, else lead plus the next two from `bring.six`;
  - `mega` = `bring.mega.id`.

  It's one undoable change (the board's existing Undo toast). The board's status lights then evaluate it like any manual pick.
- **Never automatic:** a board with picks shows "Guide differs: Aegislash + Morpeko · [Use]" instead of overwriting.
- The Game plan card's "Use on Plan board" (§1.3) goes to Plan with that plan card selected and the same Fill offered.

---

## 8. Move search

- When the scope is this coach (`prep-moves.js` `poolOf`), a result for a mon with a `perMon` note gets one muted sub-line, "Guide: <worstCase>", with the Guide pill.
- When the searched move appears in a guide calc, a strip at the top lists "From the guide: Volcarona Overheat → Aegislash 129–152% ›" as workbench links.
- Nothing else changes: Move search stays a learnset tool.

---

## 9. Visual language (native, not pasted)

- **Same tokens and components:** `section()`, `.rsns`, `chipBtn`, `P.pt` portraits, `megad`, `tw-row`, `<details>` and the workbench.
- **No new fonts**, no orange "accent theme" from `vs-calvin.html`, no big tables. Numbers use the app's existing ko/dies colours (`.check-ok` / `.warnline` family).
- **Guide marker:** one small pill, "Guide", in the Brief `layerChip` family with its own hue (a muted amber). It's on every guide-sourced line, so it's always clear what is curated advice and what the app computed. Its tooltip: "From the game plan written for this match (19 Oct). Tap a number to check it live."
- **Order everywhere:** the guide first (decision), the automatic facts after (evidence).

---

## 10. States

| State | What shows |
|---|---|
| **No guide for this matchup** | No card, no pills, no dots. One muted line under the matchup header, "No game plan for this match yet." (no button). Everything else is exactly today's Brief |
| **Guide exists, roster unchanged** | As specified |
| **Stale: opponent's roster changed since `written`** | Amber line in the card header: "**Written before ZhuZi's roster changed** (+ Krookodile, − Infernape). Plans that use Infernape may be wrong." Lines that name a species no longer on his roster get a muted "(no longer on his roster)" tag. Previews, leads and combos that need it are struck through but stay readable |
| **Stale: your roster changed** | The same, for your side: "Written before your roster changed (− Simipour)". Import as team skips missing species and says so |
| **Seats moved** | The guide is matched by coach name (`guideFor`), so nothing is lost. If the names don't match either, the guide is hidden and the header says "Game plan was written for seat 3 (ZhuZi), who isn't on the sheet now" |
| **Guide calc differs from now** | Per link, inside the workbench (§4.2). The Brief doesn't recompute guide numbers in the background |
| **Engine loading or failed** | Guide text and stated numbers still show (they're data). Links open the workbench, which shows its existing loading or failed state |
| **Viewing as another coach** | Nothing from the guide |

**Staleness rule** (`lib/guide.mjs` `staleness`):
- Referenced species: `bring.six`, `bench`, the `previews` / `leads` / `combos` ids, the `perMon` keys and the calc ids.
- These are compared against the current sheet rosters of both coaches.
- *Added* = on his roster but not referenced anywhere in the guide. *Removed* = referenced but not on the roster.
- **Ask of VGC Strategy:** add an optional `rosters: { ours: [...], theirs: [...] }` snapshot to the schema, so "added" is exact rather than inferred.

---

## 11. Copy (`C.GUIDE`)

| Key | Text |
|---|---|
| head | `Game plan vs ${coach}` |
| written | `Written ${date} · their sets are ladder guesses, not ${coach}'s real ones · ${assumption}` |
| more | `+ ${n} more` |
| remember / bring / previews / leads / tells / lose / endgame / ours | `Remember` / `Bring` / `His preview shows…` / `Leads and turn 1` / `Read his tells` / `How we lose` / `Endgame` / `Our double KOs` |
| bench | `Bench` |
| megaWhy | `Mega: ${mon}` |
| importTeam / updateTeam / bringIt | `Import as team` / `Update from guide` / `Bring it vs ${coach}` |
| imported | `Made team "vs ${coach} (guide)" · ${n} sets${conv ? ` · ${conv} converted from EVs` : ''}` |
| usePlan / fill / differs | `Use on Plan board` / `Guide lead for this: ${pair} · Fill` / `Guide differs: ${pair} · Use` |
| pill / pillTip | `Guide` / `From the game plan written for this match (${date}). Tap a number to check it live.` |
| same / differs | `Guide: ${g} · now ${n} ✓` / `Guide: ${g} · now ${n} with your current ${mon}` |
| comboNote | `Total from the guide (two hits on the same target). Open each part to check it.` |
| wreckPointer | `His double-target KOs are in Can wreck you (${n} from the guide).` |
| none | `No game plan for this match yet.` |
| staleThem / staleUs | `Written before ${coach}'s roster changed (${diff}). Plans that use ${gone} may be wrong.` / `Written before your roster changed (${diff}).` |
| gone | `(no longer on his roster)` |
| trayBtn | `Game plan` |
| guideSet | `Guide runs ${what} · Try it` |

---

## 12. Build notes (Developer)

**New:**
- `lib/guides/index.mjs`: a static registry `{ '5v3': () => import('./5v3.mjs') }`. The guide loads lazily the first time a matchup opens, so the Brief draws without it and redraws once it arrives.
- `lib/guide.mjs`: `guideFor`, `staleness`, `calcSeed`, `matchCalc(guide, attacker, defender, move)`, `mergeWreck`.
- `C.GUIDE` copy.
- Styles: `.gpill`, `.gplan`.

**Changed:**
- `prep-matchup.js`: `brief` (card), `poolSection` (dot), `detail` (blocks), `tray` (button), lens 10/6/4.
- `prep-threats.js`: `briefBody` and `wreckers` merge.
- `prep-teambuilder.js` `editor` (guide box).
- `prep-teams.js`: list line, `bring`, import and update.
- `prep-board.js` (Fill row).
- `prep-moves.js` (sub-line, strip).
- `prep-workbench.js`: guide line, `sourceLine`.
- The chat context allowlist (`lib/chat-context.mjs`) may add a `guide` chip, so the agent can see the plan when asked. That chip is off by default, like notes.

**Retire:** `public/vs-calvin.html` once Calvin's guide is converted to `lib/guides/5v8.mjs`. Keep the file until then; it's linked nowhere in the app.

**Tests:**
- A guide with a removed species → stale line and tags.
- A guide calc whose live result differs → the "now …" line.
- A matched scan row → one row with the Guide pill (no duplicate).
- Import twice → "Update from guide" adds versions and deletes nothing.
- Fill → board picks set, with an undo entry; a board with picks isn't overwritten.
- No guide → the Brief HTML is identical to today's.

---

## 13. Decisions for Anthony
1. **Preview → lens:** should choosing "His preview shows…" switch the whole Brief to those 4 (proposed), or only the card?
2. **"Update from guide"** puts the guide's version on top of his own edits (history keeps his). Or should it only add missing sets and leave edited ones alone?
3. **Should the Game plan tray button also be on the Plan and Sets tabs** (match-day access from anywhere), or only on the Brief?

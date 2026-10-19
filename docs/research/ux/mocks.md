# Mocks: pilot a friend's next opponent: UX spec

Drafarig UI UX, 2026-10-19.

**Built against:** `prep-builder` 4732732.

**What Anthony asked for:** he and Calvin run mocks. Anthony has little time, so Drafarig should **build the team Calvin's upcoming opponent would bring** (e.g. W2 Jacky), give Anthony the notes to **pilot it cold on Showdown with his phone open**, and **log the results** with a note he can share with Calvin. Calvin's schedule: W2 Jacky, W3 bye, W4 ZhuZi, W5 Hex.

## 0. What exists, and what this reuses

| Existing | Where | Reused as |
|---|---|---|
| **Pilot card** ("Help a friend practise", `#prep/pilot`): paste a team or a Drafarig brief → team rows with Speed, roles, the plans it has (`suggestPlans`), speed order, the etiquette list, Copy for Showdown, saved pilot teams (`drafarig.prep.pilot`) | `public/prep-practice.js` `pilot()`, actions `pilot-*` | **Upgraded into Mocks.** The paste path stays as "Paste a team instead". The card's rows, speed order, plans line and etiquette list become the generated team's notes |
| **Practice tab**: mock sets as cards with pips, a 7-tap game log, debriefs, findings | `prep-practice.js` `tab`, `logForm`, `mockDetail` | **The log form is reused** (generalised; §5). Practice stays *your* practice vs *your* opponent. Mocks is the opposite role, so they are different screens with the same components |
| Mock briefs (`composeBrief`) with the rule "never contains your sets…" | `lib/prep-brief.mjs` | The share note follows the same rule (§6) |
| Their-side briefing model from any perspective ("see it from their side") | `prep-matchup.js` `modelFor(P, pov, opp)` | **The generator** (§3): `modelFor(P, Jacky, Calvin)` already knows Jacky's plans vs Calvin's pool, his promising mons, the speed order and the threats |
| Teambuilder, calc workbench, threat scan, Plan board lead ranking | `prep-teambuilder.js`, `prep-workbench.js`, `lib/threat-scan.mjs`, `lib/prep-board.mjs` `rankLeadPairs` | Editing mock sets, key calcs, leads (§4) |
| Matchup guides (`lib/guides/<pov>v<opp>.mjs`, `guide-schema.md`) | `lib/guides/index.mjs` | **The curated mock *is* a guide written from the opponent's side** (§7) |
| Schedule (`P.weeks(name)`, `scheduleFor`) | `public/prep.js` | Calvin's weeks and the default opponent |

---

## 1. Entry and routes

- **Prep home › Tools:** "Help a friend practise (pilot card)" becomes **"Mocks: play a friend's opponent"**. The Practice tab's link changes the same way.
- `#prep/mocks`: Mocks home (§2).
- `#prep/mocks/<friendSeat>v<oppSeat>`: one mock matchup, e.g. Calvin (8) vs Jacky (4) = `#prep/mocks/8v4` (§4).
- `#prep/mocks/<f>v<o>/edit/<n>`: the teambuilder in **pilot mode** for set n (§4.4).
- `#prep/pilot` **redirects** to `#prep/mocks`. Saved pilot teams appear under "Pasted teams".

---

## 2. Mocks home: pick the friend and the week

```
‹ Prep
Mocks
Play your friend's next opponent. The team and notes come from that
coach's drafted 10 and ladder sets, not their real team.

Friend  [Calvin ▾]                      (remembered)
Calvin's weeks · Group A (from the sheet)
[W1 Anthony (you)] [W2 Jacky · next?] [W3 bye] [W4 ZhuZi] [W5 Hex]
                     Guide ✓ 1–1        —        Generated     Generated

[ Play Jacky vs Calvin › ]        (primary, the selected week)

Pasted teams (2) ›               Paste a team instead ›
```

- **Friend:** any coach on the sheet except you. Remembered in `meta.prefs` (`mockFriend`).
- **Week tiles** reuse the Overview's `weeksStrip` tile component (`wktile`), built for the friend's schedule (`P.weeks(friend)`):
  - Your own week vs the friend shows as "you", greyed: you don't pilot yourself.
  - A bye is greyed.
  - Each tile's second line: **Guide ✓** (curated mock exists, §7) or **Generated**, plus the mock record so far ("1–1": counts, never rates).
- **Default:** the sheet has no current week (Overview says so already). So the default is **the earliest of the friend's weeks, after your own match with them, that has no logged mock game yet**. It's labelled **"next?"**, and one tap on another tile changes it.
- **Phone:** the tiles scroll sideways inside their row (the existing weeks strip behaviour), and the primary button is full width.

---

## 3. The generated team (no curated mock)

`lib/prep-mock.mjs`, a pure generator with the engine and data injected, built only on existing pieces:

1. **Pool:** the pilot coach's drafted 10 (sheet). Megas come with their base species.
2. **Plans:** `modelFor(P, pilot = Jacky, opp = Calvin).b.myCores`, i.e. Jacky's plans and how well they survive what Calvin's pool could prep. They're ranked by the briefing's confidence, then by how many of Jacky's mons look useful into Calvin (`b.promising`).
3. **Variants:** **one team per top plan, at most 3**, named by the plan, using the existing cores labels: "Trick Room", "Tailwind + attackers", "Sun". If the top plan needs a setter, the second variant is the best plan *without* that setter ("No Trick Room"), so Anthony can practise both looks Calvin might see.
4. **The 6 for a variant:**
   - the plan's members (setter plus abusers), filled with Jacky's most useful mons vs Calvin (`b.promising` order);
   - species clause kept;
   - **one Mega**: the plan's Mega user, else the highest-tier Mega;
   - other Mega-capable mons get their top non-stone ladder item.
5. **Sets:** `guessSet` from ladder usage (the same labelled guesses the app already makes for opponents). Unknown SP get the ladder's most common spread (`commonSpread`), else max attack + Speed, labelled.
   - **Item clause:** the second holder of a duplicate item gets its next most common item.
   - Every set carries the label **"ladder guess (Smogon <month>)"**.
6. **Never uses your private prep:** Anthony's own guesses of Jacky's sets (his W5 workspace) are **not used by default**, because the mock team is copied and shown to Calvin. An opt-in toggle, "Use my saved guesses of Jacky's sets (from my W5 prep)", sits under the team with the warning "Calvin will see these sets when you play them."

**Regenerate:** recomputes from current data. If you've edited the team, it asks first: "Regenerate replaces your 2 changes · Regenerate / Keep mine".

---

## 4. One mock: `#prep/mocks/8v4` (phone-first)

The top has a sticky three-way tab, **Team · Notes · Log**, so on Showdown he flips between them with one thumb. The bottom bar always shows **Copy for Showdown** and **Log a game**.

```
‹ Mocks
Play Jacky vs Calvin · W2              [Generated]
From Jacky's 10 + ladder sets (Sept), not his real team. Lv 50.
[ Team ]  Notes   Log
Variant  (Trick Room ✓) (No Trick Room) (Sun)

┌ Farigiraf @ Sitrus Berry ─────────────── ladder ┐
│ Armor Tail · Relaxed · 32/0/14/0/20/0          │
│ Trick Room · Psychic · Foul Play · Protect     │
│ Spe 62 (TR: moves 2nd-fastest of yours)  [Swap ▾] [Edit ›] │
└────────────────────────────────────────────────┘
┌ Incineroar @ … ┐  ┌ Torkoal @ … ┐  ┌ Golisopod (M) … ┐   × 6, Showdown-card style
…
Item clause ok · 1 Mega: Golisopod
[Use my W5 guesses of Jacky's sets]  (off)
───────────────────────────────────────────────────
[ Copy for Showdown ]            [ Log a game ]     ← sticky bottom bar
```

### 4.1 Team
- **Cards** use the Teams slot row (`prep-teams.js` `slotRow`): portrait, item, ability, nature and SP, 4 moves, and Speed (Mega Speed, and the Trick Room position for TR variants). It's the same Showdown-like shape as Anthony's own teams, with no second card style.
- **Swap ▾** (per card) lists the rest of Jacky's pool. Each option has a one-word fit hint from the plan: "TR abuser", "Fake Out", "off-plan". Picking one re-guesses its set. The team warnings (species clause, one Mega, item clause) update.
- **Edit ›** opens the teambuilder in pilot mode (§4.4).
- **Copy for Showdown:** `exportTeam` for the selected variant, with a `=== [gen9championsvgc2026regmc] Jacky (mock) ===` header so it lands as a Showdown team. A toast confirms: "Copied: paste into Showdown's teambuilder (Import)".
- **Showdown format reminder** (from `setupFor`): one line, "Play it as Champions VGC Reg M-C Bo3" or "4v4 Doubles Draft", matching the league's team-sheet rule.
- **Import into Teams: no.** Teams holds *your* drafted mons (spec: "only your 10"). The mock team lives with the mock (§8). Copy for Showdown is the one-tap path he needs.

### 4.2 Notes: playing it cold (generated)
Each block is short and phone-sized. Calc numbers are **workbench links** (§4.3).

| Block | Content | Source |
|---|---|---|
| **How it wins** | 1–2 lines: the plan's `oneLineWhy` plus its payoff ("Set Trick Room, then Torkoal's Eruption and Mega Golisopod move first") | the cores plan of the variant |
| **Lead** | Up to 2 lead pairs with a reason chip each, e.g. "Farigiraf + Incineroar: Trick Room behind Armor Tail and Fake Out" | `rankLeadPairs(ctx, six, target)` vs Calvin's top plan |
| **Turn 1** | One line per lead: what each mon clicks, and the alternative "if Calvin Fake Outs X" | the plan's setter or abusers, plus Calvin's Fake Out and priority users |
| **What Calvin will try** | Calvin's plans vs this 6 (`b.theirPlans` from Jacky's side), each with "Answer:" from your own counted answers; his look-first mons; his speed control | `modelFor(Jacky, Calvin)` |
| **Watch out** | The top 3 rows of the threat scan *of Calvin's 10 into this mock team*. Each is a workbench link: "Mega Staraptor Close Combat → Farigiraf 62–74%" | `scanThreats(…, pool = Calvin, targets = mock sets)` |
| **Your KOs** | The top 3 KOs of this team into Calvin's likely 6 (best move per pair) | `hitResult` per pair |
| **Speed order** | "Torkoal 36 < Golisopod … under Trick Room the slowest moves first", from the existing pilot card line | `pilot()` |
| **If / then** | Generated from the threats and the plan: "If Calvin leads Grimmsnarl (Prankster screens) → Taunt isn't on this team: go Trick Room anyway; screens end in 8 turns" | rule templates over the plans and threats; at most 4 |
| **Etiquette** | The existing `C.ETIQUETTE` list, folded | `prep-copy.js` |

On a phone, Notes opens with *How it wins*, *Lead* and *Turn 1* expanded and the rest as `<details>` rows (44px summaries). Opened mid-game, it's one screen.

### 4.3 Key calcs (workbench)
- Every number in Notes opens `WB.open` in **pilot mode**:
  - "your side" is the mock set (Jacky's mon), "their side" is Calvin's ladder guess (or worst case for threats);
  - the field is from the plan (Trick Room doesn't change damage; weather does).
- **Apply to my set** applies to the *mock set* (the mock's own draft). **Save as calc** is hidden: calcs belong to Anthony's matchup prep, and this isn't his matchup.

### 4.4 Edit a set (teambuilder, pilot mode)
`prep-teambuilder.js` `editor()` with a context object instead of "my library":
- **roster:** the pilot coach's pool;
- **scope:** fixed to the friend (Calvin), so slider marks, the calc strip and "Threats to this mon" all compute against Calvin's pool;
- **store:** the mock's sets (§8), with Save and Discard on the mock.

It shows a header strip, "Editing Jacky's Farigiraf for a mock · nothing here touches your teams", in the Guide-pill style but labelled **Mock**. Everything else is the same editor, so Anthony doesn't learn a second one.

---

## 5. Log (results per mock)

- **Log tab:** the record ("1–1 vs Calvin, Trick Room variant · 0–1 No Trick Room"), the game list, and **Log a game**.
- **The form is today's `logForm`**, generalised as `logForm(P, holder, { theirs, mine, mutate })`:
  - `theirs` = Calvin's 10 (species);
  - `mine` = the mock set ids;
  - `mutate` writes into the mock (§8).
  - Fields:
    - Won / Lost;
    - They led (Calvin's species) / You led (mock sets);
    - Why it went that way (the existing `GAME_TAGS`);
    - optional deciding turn, mechanism, their 4, your 4, Megas, one line and replay link.
  - The variant played is pre-filled from the selected variant.
- **Practice's debrief and findings are not shown here.** Findings are about Anthony's own play with his own team; a mock he pilots for Calvin isn't evidence about his team. Instead each game has an optional "Calvin should know" line, which feeds the share note.
- **Pips and counts** reuse `mockCard`'s pip markup (`pip-W`, `pip-L`, `pip-draft`): counts in words, never a rate.

---

## 6. Note to share with Calvin

At the bottom of the Log tab:
- A **"Note for Calvin"** text field, saved with the mock.
- **Copy note** composes plain text the way `composeBrief` does. It contains:
  - which team was played (the variant name, and its Showdown text only when "include the team" is ticked: off by default, on when generated);
  - the record and one line per game (leads, result, his "Calvin should know" line);
  - Anthony's note.

  It **never** contains Anthony's own sets, teams, calcs or prep of any coach, and never his saved guesses of Jacky's sets unless he opted into them for this mock (§3.6), in which case the note says "sets based on Anthony's guesses".
- **Share…** uses `app.share` where the device has it (the existing export pattern).
- Copy line: "Nothing is sent from Drafarig: you choose where to paste it."

---

## 7. Curated mocks (VGC Strategy) vs generated

**Format proposal (for VGC Strategy):** a curated mock is **a matchup guide written from the opponent's side**. It's `lib/guides/<oppSeat>v<friendSeat>.mjs` (Jacky 4 vs Calvin 8 = `4v8.mjs`), with the existing guide schema plus one optional block:

```js
mock: { for: 'Calvin',                     // the friend this practice is for
        variants: [{ key: 'tr', name: 'Trick Room', sets: '<Showdown text>', why: '…' }, …],
        calvinWill: [{ see: '…', means: '…', do: '…' }] }   // or reuse `tells`
```

The existing guide fields map straight onto the Notes blocks:

| Guide field | Notes block |
|---|---|
| `remember` | How it wins |
| `leads` (with t1–t3 and ifs) | Lead, Turn 1, If / then |
| `tells` | What Calvin will try |
| `calcs` | Key calcs |
| `combos` | Watch out / Your KOs |
| `perMon` | A line under each team card |

So the guide renderer from `matchup-guide.md` is reused, not rebuilt.

**Precedence, per block:**
- **Curated replaces generated** for the team variants and for every Notes block it fills, with the **Guide** pill and the guide's written date and assumptions in the header.
- **Generated fills the gaps:** speed order, the threat scan and KOs it doesn't cover still show, labelled **Generated**. The two are never mixed in one list.
- **Header badge:** "Guide (19 Oct)" or "Generated from Jacky's 10 and ladder sets".
- **Stale curated mock** (either roster changed): the same amber line and "(no longer on his roster)" tags as `matchup-guide.md` §10. The generated team is offered beside it: "Use the generated team instead".
- **Guide injection rule unchanged:** a guide whose pov isn't you is **only** shown in Mocks. It never appears in your Brief or your teambuilder.

---

## 8. Storage

- **`drafarig.prep.pilot`** (exists: `{teams:[{id, name, text, savedAt}]}`) gains `mocks: [...]`, with the same doc-version mechanism, so older builds go read-only:

```
mock = { id: 'pilot_…', friend: 'Calvin', pilot: 'Jacky', week: 2, source: 'guide' | 'generated',
         variants: [{ key, name, sets: [lineage…] }],        // lineages with side 'pilot' (versions, drafts as usual)
         selected: 'tr', useMyGuesses: false,
         games: [game…],                                     // the existing game shape (GAME_TAGS, leads, line, replay)
         note: '', createdAt, updatedAt }
```

- **One mock per (friend, pilot coach).** Weeks are labels; if they play twice, the record continues.
- Device-local, like the rest of Prep. Backup and restore include it (`allDocs`).
- **Nothing touches** `mysets`, Teams or your workspaces.

---

## 9. States

| State | What shows |
|---|---|
| No schedule on the sheet | The friend picker plus a coach list to choose from instead of week tiles: "The sheet has no pairings: pick who to play" |
| Friend's week is a bye, or vs you | Greyed tile, not selectable |
| Pilot coach's roster incomplete (draft open) | "Jacky has 2 picks left: the team may change", and the team built from what's drafted |
| No ladder data (offline) | Sets from key moves and max spreads, labelled; notes without the usage-based parts ("leads need ladder data") |
| Engine loading or failed | Team, Copy and Log still work; calc links show the workbench's own loading or failed state |
| Curated mock exists | §7 |

---

## 10. Copy (`C.MOCKS`)

| Key | Text |
|---|---|
| tool | `Mocks: play a friend's opponent` |
| intro | `Play your friend's next opponent. The team and notes come from that coach's drafted 10 and ladder sets, not their real team.` |
| head | `Play ${pilot} vs ${friend} · W${week}` |
| next | `next?` |
| generated / guide | `Generated from ${pilot}'s 10 and ladder sets` / `Guide (${date})` |
| copy / copied | `Copy for Showdown` / `Copied: paste into Showdown's teambuilder (Import)` |
| myGuesses / myGuessesWarn | `Use my saved guesses of ${pilot}'s sets` / `${friend} will see these sets when you play them.` |
| regen | `Regenerate replaces your ${n} changes` |
| editHeader | `Editing ${pilot}'s ${mon} for a mock · nothing here touches your teams` |
| tabs | `Team` · `Notes` · `Log` |
| notes | `How it wins` · `Lead` · `Turn 1` · `What ${friend} will try` · `Watch out` · `Your KOs` · `Speed order` · `If / then` |
| shareNote / nothingSent | `Note for ${friend}` / `Nothing is sent from Drafarig: you choose where to paste it.` |
| record | the existing `C.PRACTICE.recordLine(w, l)` |

---

## 11. Decisions for Anthony
1. **Calvin's real sets:** while piloting, he'll see Calvin's team. Should Drafarig offer "save what I saw of Calvin's sets" into his own Calvin prep (as "seen vs me")? The spec says **no by default**: the mock is a favour, and `C.ETIQUETTE` says keep the friend's prep private. Confirm.
2. **Using his own W5 guesses of Jacky** for the mock (off by default, warned), or never offering it?
3. **One mock per friend × opponent** (record continues), or a fresh mock each time they play?

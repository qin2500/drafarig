# Cores to fear: UX spec

Version 2, 2026-10-03. Author: Drafarig UI UX (spec only, no code). It extends `ux-spec.md` §3.4 League, §3.5 Matchup prep and §4.6 ThreatList.

**The question it answers:** "Which team plans could each opponent build from their drafted pool, and which of my mons look like candidate answers on typing, ability and Speed?"

**What it is not.** It does not decide matchups. The model checks only typing, ability, base Speed and role tags. It does not see coverage moves, Protect, partners, items, damage or positioning. Every label and line of copy below is written to stay inside that limit.

**What is confirmed about prep, and what is not.** Confirmed: every coach's drafted 10-mon pool is public on the league sheet. Not known: team-sheet policy, Bo1 or Bo3, and when matchups are announced. Following VGC Strategy, the copy is written against two scenarios:
- **A (pool only):** the opponent knows your 10-mon pool, but not your 6, sets, items or Mega choice.
- **B (open team sheets):** the opponent also sees your 6 with their moves and items.

The spec never assumes how far ahead matchups are announced.

**Inputs:**
- The current UI: `public/app.js` (`renderLeague`, `renderTeam`, `synergyPanel`), `styles.css` and `glossary.js`.
- The untracked work-in-progress `docs/research/strategy/cores.json` (11 cores, a `robust` flag per answer, `prepSensitivity` Low, Med or High per core).
- `cores.md` did not exist yet, so assumptions are marked **[A]**. §9 lists open data issues.

---

## 1. Where it lives

| Surface | What | Why |
|---|---|---|
| **League screen**: a new panel, **"Cores to fear"**, directly **above** "Threats to {coach}" | The full list | Single-mon threats and cores are two zoom levels of the same prep task. Cores come first because they are the bigger picture. |
| **My team screen**: a compact panel, **"Cores with thin or no answers"**, after Team synergies | Verdict line, up to 5 Thin or No-answer-found rows, and a `See all on League` button (`data-goto="league"`) | Keeps the gaps visible while Anthony drafts. |
| Draft screen | **Nothing in v1** | Feeding cores into plan scoring is a separate change that touches the optimizer (§10). |

**Scope reuse.** The panel shares `S.threatScope` with Threats through its own `<select id="coreScope">`, labelled `Scope (also applies to Threats)`. Changing the coach already resets the scope to `all`. There is no new deep link.

---

## 2. Units and states

One **card** stands for one *(opponent, core)* pair.

**Detection state (opponent side)** **[A]**, per `cores.json` `coreRule`. Detection uses roles, types, abilities and common ladder moves. It shows what an opponent *could* build from their pool, not what they will bring.

| State | Rule | Shown |
|---|---|---|
| `fieldable` | Every slot is filled and `minDistinct` is met | Yes, with the chip `In their pool` |
| `forming` | One slot is short by one mon **and the opponent still has empty roster slots** | Yes, with the grey chip `1 pick away`. Only while the draft is ongoing. |
| `mega-conflict` | Works only with two Megas on the field at once | Yes, with the chip `Needs 2 Megas` and the note "Only one Mega per battle, so they can't run this exactly as listed." Sorted after `fieldable`. |
| otherwise | | Hidden |

**Answer status (Anthony's side).** The labels are `Has answers / Thin / No answer found`. They reuse the chip classes `ans`, `thin` and `unc`. The answering mons are always called **candidate answers**. Two candidates are not a won matchup, and a missing candidate may only mean the model can't see the answer (coverage moves, for example). **[A]** Proposed rule, for the Developer to mirror and Strategy to confirm:

- **Has answers**: at least 2 distinct mons give candidate answers, and at least 1 of them is structural.
- **Thin**: exactly 1 candidate. Also Thin: every candidate is prep tech. Tech only matters if you bring it, and under scenario B they can see it and play around it. Exception: if the core's prep sensitivity is **High**, 2 prep-tech candidates count as Has answers. These are the cores where preparation tends to help you most.
- **No answer found**: no candidate in the screen.

Count one candidate per mon. A mon with both kinds counts once, as structural.

**Sort order:**
1. State: `fieldable`, then `mega-conflict`, then `forming`.
2. Status: No answer found, Thin, Has answers.
3. Prep sensitivity, **Low first**. These cores rely least on surprise, so seeing them coming helps least, and drafted answers matter most.
4. Coach draft order.

---

## 3. Card layout

The card reuses `.plan` and `.plan-head`. The only new block is `.core-ans`, which holds the two lanes. The mockup's mons and coach are illustrative, not league data.

```
┌──────────────────────────────────────────────────────────────────────┐
│ Trick Room + slow abusers · Hex   [No answer found] [Prep: Low] [In their pool] │
│ In their pool: Farigiraf (setter) · Ursaluna (abuser) · Mega Camerupt (abuser)
│ No candidate answer found. Tailwind doesn't help here: fast mons move last. │
│ Candidate answers                                                    │
│ ┌ Structural · typing, ability or Speed ───────────────────────────┐ │
│ │ —  none found                                                    │ │
│ ├ Prep tech · only if you bring it ────────────────────────────────┤ │
│ │ [Whimsicott · Taunt the setter]  if it runs Taunt                │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│ Prep: Low. Mostly mechanical, so seeing it coming helps less...      │  ← .explainer
│ Inverts speed order for 5 turns; ...                                 │  ← .explainer
│ Type-and-speed screen, not a matchup verdict. No damage calc.        │  ← .small .muted
└──────────────────────────────────────────────────────────────────────┘
```

Fields, in order:

1. **Head.** `{core name} · {coach}`, then chips: status, `Prep: Low|Med|High` (a `term()` to "Prep sensitivity"), and the state chip. In single-opponent scope, drop `· {coach}`.
2. **Members.** Label: `In their pool:`. Each member is a `<span class="nm" data-mon>`, which opens the drawer, followed by its slot in muted text. A `forming` core adds a dashed chip `missing: {slot}`.
3. **Status line.** Always visible.
   - Has answers: "{n} candidate answers, {k} structural. Worth checking with a damage calc before you rely on them."
   - Thin: "Only {name} looks like an answer." or "Only prep tech shows up: it helps only if you bring it, and they may play around it if they can see your team."
   - No answer found: "No candidate answer found on typing, ability or Speed." If the data has a non-answer, add a clause such as "Tailwind doesn't help here: fast mons move last."
4. **Candidate answers.** A small heading, then two lanes, always in this order.
   - `Structural · typing, ability or Speed`. Chips use `chip ok` and read `{mon} · {short reason}`. The tooltip suffix reads: "Doesn't depend on a specific move. It can still lose to coverage, partners or positioning."
   - `Prep tech · only if you bring it`. Chips use plain `chip`. Answers detected from `keyMoves` add "if it runs {move}", because `keyMoves` is a ladder-usage signal, not a learnset.
   - An empty lane shows `— none found`. Both lanes always render.
5. **Prep note.** One sentence keyed to sensitivity (copy in §6), in `.explainer`.
6. **One-line why.** The core's `oneLineWhy`, in `.explainer`.
7. **Footer.** In `.small .muted`, always shown: "Type-and-speed screen, not a matchup verdict. No damage calc."

A chip's `title` holds the data `note`. **Density:** show 8 cards, then `Show {n} more` (local state). Has-answers cards render as `<details>` with the head as the `<summary>`. Thin and No-answer-found cards stay open.

---

## 4. Showing uncertainty honestly

1. **Panel scope line** (always shown): "Type-and-speed screen, not a matchup verdict. Cores are spotted from roles, types and common ladder moves, so they show what each pool could build, not what they will bring. Candidate answers check typing, ability, base Speed and roles only, not coverage moves, Protect, partners, items or damage."
2. **Assumes line** (always shown, `.small .muted`): "Assumes: drafted pools as listed on the league sheet. Unknown: whether team sheets are open, Bo1 or Bo3, and when matchups are announced. Prep notes describe both cases."
3. **Card footer** (§3.7).
4. **Conditional wording.** Prep tech reads "if it runs Taunt". Statuses read "found" and "candidate", never "beats" or "covered".
5. **Draft in progress** (while any opponent in scope has `slotsLeft > 0`): "The draft isn't finished: {coach} has {n} picks left, so new cores can still appear. `1 pick away` cards show what one more pick would complete."
6. **Inherited.** The stale-sheet banner still applies. Unmatched opponent names add: "{n} unmatched pick(s) left out. A core may be missing. [Fix names]".

Do not show percentages or win-style numbers, and do not use colour-only signals.

---

## 5. Explain level (existing checkbox, `body.facts`)

| Element | Explain on | Just the facts |
|---|---|---|
| Verdict, scope line, Assumes line, draft caveat, card footer | shown | shown (honesty is never optional) |
| Card head, members, status line, both lanes | shown | shown |
| Prep note, one-line why, how-to-read paragraph | shown | hidden (`.explainer`) |
| Glossary popover "Why it matters" | shown | hidden (existing rule) |

No new setting is needed.

---

## 6. Copy

**League panel**
- Heading: `Cores to fear`.
- Verdict: "{u} with no answer found, {t} thin, {a} with candidate answers." If {u} ≥ 1, append " Biggest gap: {core} ({coach})."
- Then the scope and Assumes lines (§4).
- How-to-read (`.explainer`): "A core is two or more mons in their pool that make a plan together, like a Trick Room setter plus slow hitters. **Structural** answers come from typing, ability or Speed. They don't depend on a specific move, but they can still lose to coverage, partners or positioning. **Prep tech** is a move you choose for this match (Taunt, Imprison, Wide Guard, your own weather). Their pool is public, so you can plan tech against it. Whether they can see your tech coming depends on team-sheet rules, which aren't confirmed. Has answers = at least 2 candidate answers, one structural. It's a screen to show where to look, not a result."

**Team panel**
- Heading: `Cores with thin or no answers`.
- Verdict: "{u} with no answer found and {t} thin, across {k} opponents." or "Every core in your opponents' pools has at least one candidate answer. Still a screen, not a verdict."
- Rows: `{core} · {coaches}`, then a status chip. Button: `See all on League`.

**Prep note by sensitivity.** These describe a tendency, which depends on how much each side can see.
- **Low**: "Prep: Low. Mostly mechanical: it relies little on surprise, so seeing it coming helps you less. Drafted structural answers matter most here."
- **Med**: "Prep: Med. Targeted tech tends to blunt it, if you bring the tech. With pool-only info they can't see which tech you bring. With open team sheets they can."
- **High**: "Prep: High. More dependent on surprise. Their pool is public, so you can see it coming, and preparation tends to help you more here."

**Empty and edge states**
| Situation | Copy |
|---|---|
| Nothing fieldable or forming | "{coach's pool / No opponent's pool} contains none of the {N} cores the app screens for yet." While picks remain: "Cores appear here as coaches draft setters and partners." |
| Selected coach has no picks | Cards show, all No answer found. Info line: "You haven't drafted yet, so there are no candidate answers. Use this to see what to draft against." |
| Every card Has answers | "Every core in scope has at least one candidate answer. Still a type-and-speed screen, not a matchup verdict." |
| Core data failed to load | "Core data isn't available right now. The single-mon Threats list below still works." Hide the Team panel. |

---

## 7. Glossary additions (`glossary.js`, `{def, why}`, def ≤ 2 sentences)

| Key | def | why |
|---|---|---|
| `Core` | "Two or more mons that make a plan together, like a Trick Room setter plus slow hitters, or a weather setter plus mons its weather boosts." | "Every drafted pool is public on the league sheet, so you can plan around their possible plans, not just their single mons." |
| `Structural answer` | "An answer that comes from a mon's typing, ability or Speed, not from a specific move." | "It doesn't depend on a set choice, but it can still lose to coverage moves, partners or positioning." |
| `Prep tech` | "A move or set you choose for one matchup, like Taunt, Imprison, Wide Guard or your own weather to override theirs." | "Useful in a draft because their pool is public. It only helps if you bring it, and open team sheets would let them see it coming." |
| `Prep sensitivity` | "How much a core tends to rely on its opponent not preparing. Low = mostly mechanical, High = more dependent on surprise." | "A tendency, not a guarantee. How much it matters depends on what each side can see: pool only, or full team sheets." |
| `Has answers / Thin / No answer found` | "For cores: Has answers = at least 2 candidate answers, one structural. Thin = 1, or only prep tech. No answer found = none in the screen." | "A type-and-speed screen, not a matchup verdict. It doesn't see coverage moves, items, partners or damage." |
| `Candidate answer` | "One of your mons whose typing, ability, Speed or role suggests it can handle a core." | "A lead to check with a damage calc, not a guarantee." |
| `Taunt` | "Stops the target using status moves (Trick Room, Tailwind, screens) for 3 turns." | "Prep tech against setters. Mental Herb and Prankster-blocking abilities beat it." |
| `Imprison` | "The user blocks foes from using any move the user also knows." | "Imprison plus your own Trick Room stops theirs. It does nothing in most other matchups." |
| `Perish trap` | "Perish Song KOs every mon still on the field 3 turns later, and trapping stops yours from switching out." | "Hard to handle unprepared. Ghost-types, pivots and Soundproof tend to help." |
| `Screens` | "Reflect, Light Screen or Aurora Veil cut damage to that side for 5 turns." | "They buy their attackers time to set up. Brick Break and Infiltrator get through." |
| `Psychic Terrain` | "For 5 turns, grounded mons can't be hit by priority moves, and Psychic moves get stronger." | "It turns off your Fake Out and Prankster against grounded targets. Flying-types and other terrains get around it." |

VGC Strategy should sign off the move and mechanic copy against `cores.md`. That includes the Champions Fake Out change noted in `cores.json`, which may need an edit to the existing `Fake Out` entry.

---

## 8. Narrow and mobile layout

- Cards are single-column blocks: no table and no horizontal scroll. A table would need 7 or more columns.
- `.plan-head` already wraps, so chips drop under the title on narrow screens.
- Answer chips can be long. Set `white-space: normal` inside `.core-ans .chip`.
- Below 768px: the scope select goes full width. `Show more` and the `<summary>` heads get at least 44px of touch height.
- The `.explain` checkbox is already hidden below 768px, so phones get the full explanations.

---

## 9. Data contract and open issues (Developer and VGC Strategy)

Suggested helper: `coreList(dex, myIds, opponents, cores)`. It returns
`{coach, coreId, name, state, members:[{id, slot}], missing:[slot], status, answers:[{id, label, robust, note, conditional}], nonAnswers:[label], prepSensitivity, prepReasoning, oneLineWhy}`.

Open issues in the work-in-progress `cores.json`:
1. **Non-answers are encoded as answers.** Example: under Trick Room, `role tailwind` has the note "Does NOT answer TR". Add `"counts": false`.
2. **Notes are UI-facing.** Some are working notes ("Fails into Farigiraf? No - …"). Add a short `label` (≤ 5 words) and clean up `note`.
3. **`speed` answers are free text** (`"minSpe<=40 attacker"`). They need a machine-readable form.
4. **`prepModel.principle` states unconfirmed facts** ("public a week ahead", "team lists are open"). The UI must not display it. Strategy is reframing it as scenarios A and B. Per-core `prepReasoning` that assumes open lists or a week of notice should be rewritten before it ships as tooltip text.
5. **The status rule (§2)** is a proposal.
6. **Mega-conflict detection** is not implemented yet. Don't render `Needs 2 Megas` until it is.
7. **`keyMove` answers** need `conditional:true` so the UI writes "if it runs …".

---

## 10. Out of scope for v1, possible later

- Credit for candidate answers in plan scoring and "Check a pick". This needs optimizer weights.
- The mirror view: which of Anthony's cores each opponent's pool can answer.
- Per-opponent matchup page (ux-spec §3.5) with a bring-6 suggestion.
- Scenario-specific prep notes, once Anthony confirms team-sheet policy, Bo1/Bo3 and matchup timing.
- Free agency or trades: no rule is assumed. Ask Anthony first.

# Mocks: developer plan (read-only pass)

Drafarig Developer, 2026-10-19, against `prep-builder` 4732732. Written before `docs/research/ux/mocks.md` and
`docs/research/strategy/mock-method.md` exist; the placement and the data format follow those specs once they land. This file
only says what already exists, what a "best 6 of X vs Y" generator needs, and the order of work.

**The ask (as relayed):** a "Mocks" section that builds the team Calvin's upcoming league opponent would bring (W2 Jacky,
W4 ZhuZi, W5 Hex), with sets, a Showdown export, variants and pilot notes, so Anthony can play it against Calvin.

So the mock is **someone else's team** (X = Jacky / ZhuZi / Hex), aimed at **someone else** (Y = Calvin). Anthony pilots
it. None of it is Anthony's own league prep, which drives the storage choice below.

---

## 1. What exists and what to reuse

| Need | Existing piece | Reuse as is? |
|---|---|---|
| Pilot notes and a pilot card for a team you don't own | `public/prep-practice.js` `pilot(P)`, route `#prep/pilot`, actions `pilot-parse` / `pilot-copy` / `pilot-save` / `pilot-open` / `pilot-delete`. It renders the sets, Speed order (and TR reversed), Cores plans the team has (`suggestPlans`), and `parseBrief` fields (purpose, setup, fidelity, how to play, don't use) | **Yes**: the mock's pilot view is this card, fed by the mock instead of a paste |
| Storage for teams that aren't yours | The `drafarig.prep.pilot` document (`KEYS.pilot`): `{ teams: [{ id 'pilot_…', name, text, savedAt }] }`, validated in `lib/prep-schema.mjs` (`VALIDATORS.pilot`, ≤ 200 teams), included in backups | **Extend**: add optional fields per team (`mockOf: { coach, vs, week }`, `variant`, `source: 'generated'\|'guide'\|'pasted'`). Additive, no version bump, like `teams` |
| Not Teams | `lib/prep-teams.mjs` only lets your 10 drafted mons join a team, and its sets live in `mysets` (your library). A Jacky mock must not land there | **Don't reuse for storage**. Only reuse its export text (§1 row below) |
| Showdown export / import | `lib/paste.mjs` `exportTeam` (byte-for-byte Showdown, no backup header since d18d8de), `parseTeamQuick` (EVs → SP, one tap) | Yes |
| Sets for a mon from ladder data | `lib/prep-build.mjs` `targetsOf` (saved, else ladder guess, labelled; Megas as their own rows), `commonHits` (top spreads, items, abilities, moves ≥ 15%) | Yes, for the "ladder set" variant |
| Sets for a mon with no usage | `lib/move-search.mjs` `worstCaseAttacker`, `public/prep-workbench.js` `worstCaseOf` (+ nature, 32 SP, synergy ability, Life Orb or its stone) | Yes, for the "learnset worst case" variant. **Labelled as such everywhere**: "Ladder set" vs "Worst case (learnset)" (§5 bias fix 3) |
| Damage and threats in both directions | `lib/threat-scan.mjs` `scanThreats(calc, mech, pool, targets, { usage, typeEff, fast })` → ranked rows (OHKO odds × plausibility, ×1.25 spread / priority, roster weather and terrain); `spreadDoubles`, `priorityKOs`, `topPerMon`, `threatsTo` | Yes: the generator's core (§2) |
| Cores / game plans of a pool | `lib/prep-plans.mjs` `suggestPlans(cx, dex, rosterIds)`, `couldBringAgainst` | Yes, for synergy and the pilot notes |
| Lead-pair ranking | `lib/prep-board.mjs` `boardContext`, `rankLeadPairs`, `rankBackPairs`, `coverage` (written for "my 6 vs their plan") | Yes, with X's 6 as "mine" and Y's plans as targets |
| Curated content in the app's own screens | `lib/guides/index.mjs` (static registry, tolerant validation, `rosters` stale check, `registerGuide` for tests) and `public/prep-guide.js` (card, workbench links via `calcSeed`, Import / Update) | **Copy the pattern** for curated mocks: `lib/mocks/index.mjs` + one data file per mock, same tolerant validation and stale check |
| Calcs as links | `WB.open(P, seed)`; the guide's `calcSeed` (ours / ladder / worst + overrides + field) | Yes. For mocks both sides are "theirs", so `calcSeed` needs a side kind **"mock"** = the mock's own set (no "ours") |
| Speed tiers | `B.speedTiers`, `B.speedMarks`, the pilot card's Speed order | Yes |
| Practice records | `ws.mockSets` (per matchup workspace: games, debriefs, findings) | **No**: those record *your* rehearsals for *your* matchup. A mock you pilot for Calvin isn't one of your matchups. Optional later: a simple game tally on the pilot team |

## 2. An automatic "best 6 of X vs Y" generator

Input: X's 10 (sheet), Y's 10 (sheet), ladder usage (or none), the calc engine. Output: 6 mons with sets, one Mega at most,
item and species clauses satisfied, a lead pair, a ranked list of alternatives (variants), and the reasons (each a scan row
or a plan, so the pilot notes can say why).

### 2.1 Sets first, then the six
1. **A candidate set per X mon (and per Mega forme):** ladder set where usage exists (`commonHits` top spread / item / ability,
   its moves ≥ 15%), else a learnset set: its two strongest scan moves into Y (from §2.2) + its role moves from the dex
   (`roles`: Fake Out, Tailwind, Trick Room, redirection, Protect). Labelled ladder / learnset.
2. **Items are provisional here:** the clause is solved per six (§2.4), so each set keeps a ranked item list (its ladder
   item, Life Orb, the type item, Focus Sash, Sitrus, …), not one item.

### 2.2 Both directions of the threat scan (computed once, reused for every six)
- **X into Y (offence):** `scanThreats(pool = X's 10, targets = Y's likely sets)`. Y's sets: the ladder row, else **max bulk**
  (32 HP / 32 in the relevant defence), so a "can KO" claim holds against Y's bulkiest version. Per X mon: which Y mons it
  OHKOs or 2HKOs, spread double KOs, priority KOs.
- **Y into X (defence):** `scanThreats(pool = Y's 10, targets = X's candidate sets)`. Per X mon: which Y mons OHKO it, and
  how plausibly (the existing plausibility, no usage penalty).
- Cost: 10 × 10 forms × learnsets ≈ 0.5 s per direction with full items, ≈ 0.2 s with `fast: true`. Both directions once per
  (X, Y) pair; the 210 sixes reuse the rows. Run it in idle time (as the Brief scan) or in a tool for curated mocks.
- Megas: a mon with a stone has two candidate rows (base, Mega); a six may use at most one Mega row.

### 2.3 Scoring a six
For each of the C(10, 6) = 210 sixes (more with Mega choices: pick the best single Mega per six, ≤ ~600 evaluations):
- **Offence coverage:** for each Y mon likely to be brought (Y's own likely 6, from usage / draft value / Y's scan of X), the
  best OHKO odds × plausibility any member has on it; sum, with spread double KOs and priority KOs weighted ×1.25 as in the scan.
- **Defence:** for each X member, the Y hits that OHKO it (severity sum); penalise sixes whose members share a weakness to
  one Y spread move (the "Rock Slide double KO" pattern: two members both OHKO'd by the same spread hit).
- **Speed / modes:** Tailwind or Trick Room setters + abusers (`suggestPlans` cores on the six), Fake Out, Intimidate,
  redirection; one point per working mode, as the Cores rules count them.
- **Answers to Y's plans:** `couldBringAgainst` / `coverage` against Y's plans (Y's cores from `suggestPlans` on Y's pool).
- Normalise each term and weight them; the weights live in one place so VGC Strategy can tune them against their method.

### 2.4 Constraints (hard, not penalties)
- **Species clause:** no two members with the same dex number (`mech.species[id].num`), Megas counting as their base.
- **One Mega:** at most one member holds its stone (the board's `megaForms` and the team warnings already know this).
- **Item clause:** six different items. Solved per six as an assignment: each member's ranked item list (§2.1), maximise the
  summed value; with six members and ≤ 6 items each, a greedy pass with one swap step is enough (exact matching if needed).
  Mega stones are fixed first.
- **Legality:** every set through `checkSet` / `parseTeam` (moves learnable, ability legal, ≤ 66 SP, ≤ 32 per stat).
- **Only X's 10:** never a mon X didn't draft; a no-usage drafted mon is never dropped for lacking data.

### 2.5 Output
- The best six + **variants**: the next-best sixes that differ by one or two members (and the "Mega swap" variant).
- **Lead pair** per six from `rankLeadPairs` against Y's plans; **back** from `rankBackPairs`.
- **Pilot notes** generated from the reasons: "Lead Torkoal + X: sun Eruption 101–156% on …", "Don't lead Y into …",
  each number a workbench link (both sides "mock" / Y's ladder set).
- **Showdown export** of the six (`exportTeam`), and the pilot card.

## 3. Curated mocks (VGC Strategy's format)

The first Jacky mock comes as data. Treat it like guides:
- `lib/mocks/index.mjs`: static registry, `validateMock` (tolerant), `mockFor(x, y)`, stale detection against both rosters.
- Data fields to expect (to be confirmed by `mock-method.md`): `x`, `y` (coaches), `week`, `rosters`, `six` with `sets`
  (Showdown text), `variants`, `leads`, pilot notes (`howToPlay`, `dontUse`, `purpose`, `fidelity`, matching `parseBrief`'s
  fields so the pilot card renders them unchanged), `calcs` (both sides as mock / ladder / worst).
- When a curated mock exists, it wins; the generator's output is shown as "computed alternative" beside it.

## 4. Order of work

1. **Storage:** extend the pilot document with `mockOf` / `variant` / `source` (additive, validator + backup + a compat test).
2. **Mock module skeleton:** route (as the UX spec places it; likely `#prep/mocks` and `#prep/mocks/<x>v<y>`), list of the
   upcoming opponents of Y from the sheet's weeks (`P.weeks(Y)`), the pilot card reused for one mock.
3. **Curated mocks:** `lib/mocks/index.mjs` + the Jacky file, rendering, Showdown export, "Save as pilot team", calcs as
   workbench links (`calcSeed` with the "mock" side), tests with a fixture (like `test/guides.test.mjs`).
4. **Generator, pure (`lib/mock-gen.mjs`):** candidate sets → both scans → constraint-respecting sixes → scores → variants,
   with a brute-force test (all 210 sixes on a small fixture) and constraint tests (species clause, one Mega, item clause).
5. **Generator in the app:** idle-time computation and caching per (X, Y, usage month), "computed" labels, variants.
6. **Pilot notes from reasons** and the lead pair; then phone layout and QA.

## 5. Open questions for the specs
- Is the mock stored per (X, Y, week) or per (X, Y)? A W2 mock may be stale by W5.
- Should Y's likely 6 come from Y's own scan of X (game theory one step deep) or from Y's draft value and usage?
- Does Anthony want to log his mock games against Calvin (a tally on the pilot team), or is that Calvin's data?
- Should the generator's weights be VGC Strategy's (from `mock-method.md`) and fixed, or tunable in the UI?

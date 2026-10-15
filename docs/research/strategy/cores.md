# Cores to fear: opponent cores, Anthony's answers and prep time

Drafarig VGC Strategy, 2026-10-03. This is the companion to `cores.json`, the spec the Developer implements. `raw/cores-check.py` is a
reference implementation of that spec. Every league number below comes from running it on `raw/league-snapshot-2026-10-03.json`,
which is the league's public sheet fetched at 14:07 UTC through `lib/sheet.mjs` and `lib/league.mjs`. Rerun it to refresh:
`python3 docs/research/strategy/raw/cores-check.py` (add `--tests` for the fieldability tests).

Markers: **VERIFIED** = checked against the Showdown simulator source (Champions mod + base data) or the league sheet.
**CREATOR CLAIM** = a guide or video creator says it and I haven't verified it. **ASSUMPTION** = a modelling choice, or an unknown league rule.

---

## 0. What the model can and can't say

- A **core** is two or more mons (sometimes one, e.g. Alolan Ninetales snow + Veil) that make a plan together. Detection uses
  only the fields in `data/dex.json`: per-form types, abilities and base stats; species `roles`; and `keyMoves`
  (the Pikalytics top moves, a *usage* signal and not a guarantee of this coach's set).
- An **answer** is a *candidate answer*. A **structural** answer (type, ability, base Speed) doesn't rely on a specific move.
  It can still fail to coverage that hits the resist, to a partner removing it, to Fake Out or redirection, to items or to
  positioning. Two candidate answers don't mean the matchup is won. No damage calcs are run. Each answer in
  `cores.json` has a `failsTo` field listing its typical failure modes.
- Status names follow UX v2: **Has answers / Thin / No answer found** (rule in §6).

## 1. Prep scenarios (replaces the earlier "surprise is near zero" claim)

| | A. Pool-only (baseline) | B. Open team sheets at the match |
|---|---|---|
| Known | Both drafted 10s. **VERIFIED**: the Drafts tab is a published sheet. | A + the opponent's 6 with moves, items, abilities and Mega stone at team preview |
| Hidden | Which 6, which 4, the Mega choice, sets, items, Stat Points, leads | Which 4, leads, Mega timing, Stat Points |
| Status for this league | Baseline. **ASSUMPTION**: you know your opponent early enough to prep | **ASSUMPTION**. OTS are VERIFIED only for TPCi events and as a Showdown option |

- Not confirmed for this league: Bo1 vs Bo3, open team sheets, and how far ahead pairings are known. In Bo3, game 1 only gives
  partial information: the moves, items and abilities actually used, the Mega chosen that game and the 4 brought. Unused moves,
  unrevealed items, the 2 benched mons and the other Mega option stay hidden. So games 2–3 sit between A and B and aren't
  equivalent to open team sheets.
- **Key point:** OTS shown at the match don't change the week's *build*. Under both A and B you build your 6 knowing only the pool.
  OTS change team preview and play. So a tech move works as a **trap** under A (they must guess whether you run it) and as a
  **deterrent** under B (they see it and may leave the core at home). Structural answers are worth the same in both.
- Under A, *hidden breadth* matters. An opponent with 3 likely cores (Calvin, Data, DingDing) forces your one 6 to cover all
  three, because you don't know which they'll bring.

## 2. Mechanics that the answers depend on (checked 2026-10-03)

| Mechanic | Status | Source |
|---|---|---|
| Psychic Terrain blocks priority > 0 against **grounded** non-ally targets (Fake Out, Prankster, Sucker Punch); 1.3x Psychic | VERIFIED | Showdown `data/moves.ts` psychicterrain |
| Armor Tail blocks foes' priority moves aimed at its side (Fake Out, Prankster Taunt) | VERIFIED | `data/abilities.ts` armortail |
| Taunt: 3 turns, blocks Status moves (Trick Room, Tailwind, screens, **Perish Song**); reflectable (Magic Bounce) | VERIFIED | `moves.ts` taunt, perishsong |
| Imprison: foes can't use any move the user knows | VERIFIED | `moves.ts` imprison |
| Electro Shot fires in one turn in rain (+1 SpA) | VERIFIED | `moves.ts` electroshot |
| Mega Evolution resolves before moves (queue order 104 vs 200), so a Mega's weather (Charizard-Y Drought) overrides a lead weather on turn 1 | VERIFIED | `sim/battle-queue.ts` |
| Since Gen 7, Prankster status moves fail on Dark-type targets (Morpeko is Dark) | VERIFIED | `sim/battle-actions.ts` |
| Champions: Fake Out can't be selected after the user's first action; Run Away escapes trapping; para 1/8; sleep 2–3 turns | VERIFIED | `data/mods/champions/{moves,abilities,conditions}.ts` |
| Champions doesn't change Tailwind, Trick Room, Taunt, Imprison, Perish Song or Wide Guard (none overridden in the mod) | VERIFIED (absence in mod) | same |
| Mental Herb, Light Clay, weather rocks, Terrain Extender and seeds are in the M-C item pool; Covert Cloak isn't | VERIFIED | `raw/items.json`, format-and-meta.md §4 |
| Brick Break removes Reflect / Light Screen / Aurora Veil before dealing damage | VERIFIED | `moves.ts` brickbreak |
| Reflect / Light Screen / Aurora Veil multiply damage by 2732/4096 (≈0.67x) when the target's side has more than one active Pokémon (doubles), and by 0.5x otherwise. Crits and Infiltrator bypass them | VERIFIED | Showdown `data/moves.ts` (master, fetched 2026-10-03): auroraveil L859–860, lightscreen L10337–10338, reflect L14864–14865 (`activePerHalf > 1`) |

## 3. Core archetypes

Prep sensitivity is how much the core loses **when the defender has prepared**, given per scenario. Low = keeps working,
Med = cheap tailored tech cuts it a lot, High = a prepared defender usually has a way out.

| Core | Why it's strong in M-C | Detection (summary) | Structural answers → typical failures | Prep-tech answers | Prep A / B |
|---|---|---|---|---|---|
| Trick Room | Reverses order for 5 turns (4 useful). No Band, Specs or AV, so bulky slow hitters dominate | TR (usage or learnset) + 2 hitters at Spe ≤ 60 with Atk/SpA ≥ 100 (or Spe ≤ 30 with Eruption etc.) | Own slow hitter (partial) → their slower abusers still go first (Torkoal 20) | Own TR (standard on Sinistcha); Imprison + TR; Taunt; Fake Out → Armor Tail, Psychic Terrain, Ghost setters, redirection, Mental Herb | Low / Low |
| Tailwind | ×2 Speed for 4 turns. Base-100 Megas reach 334 | Tailwind + 2 attackers at Spe ≥ 60 with Atk/SpA ≥ 110 | Intimidate (partial) → special attackers | Own TR (best), mirror Tailwind, Icy Wind (partial), priority (partial), Fake Out / Taunt the setter → Prankster, Ghost / Inner Focus setters | Low / Low |
| Sun | Fire 1.5x. Mega Charizard-Y 159 SpA, Torkoal Eruption | Drought (or Sunny Day with usage evidence) + Fire STAB ≥ 100 / Chlorophyll / Eruption etc. | Own weather → their re-entry and Mega timing; Fire resist → Solar Beam / Earth Power coverage | Wide Guard vs Heat Wave | Low / Low |
| Rain | Water 1.5x, Swift Swim, one-turn Electro Shot | Drizzle (or Rain Dance with usage) + Swift Swim / Water STAB / Electro Shot etc. | Own weather; Water resist → Electric coverage; absorb abilities → Mold Breaker | (no clean tech) | Low / Low |
| Sand | Sand Rush, Rock SpD boost, overrides other weather | Sand Stream + Sand Rush / Sand Force | Rock resist → EQ / Iron Head; own weather | Wide Guard; TR | Low / Low |
| Snow + Veil | Veil = both screens in one move (≈0.67x damage in doubles) | Snow Warning + Aurora Veil / Blizzard (usage). One mon may be enough | Own weather (no new Veil); Infiltrator | Screen breakers; Taunt (Prankster-proof setter fails) | Med / Med |
| Psychic Terrain | Turns off your priority (incl. Fake Out); Expanding Force spread | Psychic Surge + Expanding Force or a Psychic attacker at SpA ≥ 110 | Dark immunity → Fighting / Bug / Fairy coverage; Psychic resist; own terrain | Wide Guard | Med / Med |
| Electric Terrain | 1.3x Electric (Raichu-Mega-X) | Electric Surge + Electric STAB ≥ 100 or Electro Shot / Thunderbolt user | Ground immunity; absorb abilities; Electric resist | — | Low / Low |
| Grassy Terrain | Rillaboom is #1 usage (35%) | Grassy Surge + Unburden / Grass STAB. **Blind spot:** seed items aren't in dex | Grass resist; own terrain | — | Low / Low |
| Fake Out + redirection | Free turns for the partner | Fake Out + Follow Me / Rage Powder (usage) on 2 mons | Ghost (Fake Out immune) → Scrappy; Inner Focus; Grass vs Rage Powder (partial) | Spread moves → Wide Guard | Low / Low |
| Perish trap | Forces KOs through Protect | Perish Song + Shadow Tag / Arena Trap / Mean Look / Block / Spirit Shackle / Anchor Shot | Ghost escapes trapping; Soundproof / Run Away | Pivot moves; Taunt (Perish Song is Status) | High / High |
| Intimidate cycle | Repeated -1 Atk | 2 Intimidate options (per form: Mega Salamence and Mega Staraptor lose it) + pivot / Fake Out | Special attackers; Intimidate-proof abilities | — | Low / Low |
| Screens | Prankster screens cut damage for 5–8 turns: 2732/4096 ≈ 0.67x in doubles, 0.5x only in singles | Reflect / Light Screen (usage) + 2 attackers ≥ 110 | Infiltrator | Brick Break / Psychic Fangs / Raging Bull / Defog; Taunt → Prankster setters move first | Med / **Low** |

Why some ratings shift between A and B:
- **Screens: Med under A, Low under B.** Under A, a hidden Brick Break can wreck a Light Clay turn. Under B the screens player
  sees it at preview and targets the breaker or holds screens.
- **Perish trap stays High under B.** Its answers are mostly structural (Ghosts, pivots), so visibility doesn't help it.
- **Trick Room stays Low.** Every counter (Taunt, Imprison, Fake Out) has a known counter-counter (Mental Herb, Armor Tail,
  Psychic Terrain, redirection). A guide makes the same "stop / stall / reverse / punish" split (CREATOR CLAIM, S-pcd-tr), and the
  priority-blocking parts are VERIFIED (§2).

## 4. Fieldability must be legal (rules + tests)

The Developer must enforce these rules (full algorithm in `cores.json` → `fieldability`):
1. Each member uses **exactly one option** (form + ability). Charizard is base, Mega X or Mega Y, never two at once.
2. **At most one member is in a Mega form.** A role that only exists on a Mega (Charizard-Y's Drought, Raichu-X's Electric Surge)
   uses up the one Mega.
3. **Species clause:** distinct dex numbers (one Rotom).
4. The core fits in the **4 brought** (maxMembers 4). It doesn't need all members on the field at once.
5. Abilities are per option. Staraptor and Salamence only have Intimidate in base form. Excadrill only has Sand Rush in base form.
6. No legal assignment, but one that works when rule 2 is dropped → `mega-conflict`. Otherwise not shown.

Test cases (`cores-check.py --tests`, all PASS, all real league mons):

| # | Roster | Core | Expect | Why |
|---|---|---|---|---|
| T1 | Jacky: Farigiraf, Torkoal, Golisopod, Incineroar | trick-room | fieldable, 0 Megas | Legal with base forms |
| T2 | Data's Raichu + Klefki | electric-terrain | not fieldable | Raichu can't be Mega-X setter and Mega-Y abuser at once |
| T3 | Data: Raichu, Archaludon, Klefki, Politoed | electric-terrain | fieldable, 1 Mega | Raichu-Mega-X + Archaludon (Electro Shot) |
| T4 | Charizard (Anthony) + Raichu (Data), test core "Drought + Electric Surge" | test core | mega-conflict | Both roles exist only on Megas |
| T5 | Staraptor, Salamence, Incineroar | intimidate-cycle | fieldable, members in base form | A Mega form must never count as Intimidate |
| T6 | Rotom-Wash + Rotom-Heat, "2 Electric-types" | test core | not fieldable | Species clause |

T4 uses a test-only core because no real league roster currently has a cross-species mega-conflict for the 13 cores. That's
worth knowing in itself: right now the single-Mega rule mostly bites *within* species (T2), not across them.

## 5. League results (snapshot 2026-10-03 14:07 UTC; all rosters have 6–7 of 10 picks)

Only cores with `likely` confidence (every move slot backed by usage) are listed. The learnset-only matches were noise and are
now filtered out (Sunny Day / Rain Dance / screens need usage evidence).

| Opponent | Likely cores they can field now | Anthony (A / B) | Notes |
|---|---|---|---|
| 1 Hex | **Tailwind** (Corviknight / Kleavor + Garchomp, Armarouge, Banette); **Psychic Terrain** (Indeedee-F + Armarouge) | Has answers / Has answers, but the **Tailwind card's only anchor is Pelipper** | Indeedee's terrain makes Anthony's priority (Fake Out ×2, Shadow Sneak) unreliable. Mega Banette's Prankster (Taunt is learnable, Encore is common) can stop Sinistcha's TR, but that uses Hex's Mega, so not alongside Mega Garchomp-Z. Mirror Tailwind is weak here: Garchomp-Mega-Z at 223 → 446 vs Mega Charizard 167 → 334 |
| 2 Ning | **Snow + Veil** (Alolan Ninetales alone) | Has answers | Pelipper / Charizard-Y weather override. Grassy core is one pick away but Ning has 9 pts |
| 3 ZhuZi | none likely | — | A goodstuffs roster (Metagross, Dragapult, Rotom-W, Krookodile, Infernape, Slowking-G). Cores-to-fear can't see it, so keep the single-mon Threats list. 29 pts left: TR, Tailwind, Psychic Terrain (Indeedee 17) and Intimidate are all one pick away |
| 4 Jacky | **Trick Room** (Farigiraf / Mimikyu + Torkoal, Golisopod, Incineroar); **Sun** (Torkoal) | Has answers | Kangaskhan's Fake Out on the setter is **contested** by Armor Tail. Under TR, Torkoal (min 36) and Mega Golisopod (54) move before all of Anthony's mons (slowest is Aegislash, min 72) |
| 6 Taro | **Tailwind** (Salamence); **Sand** (Tyranitar + Excadrill) | Has answers | Rock Slide hits Charizard 4x and Pelipper 2x. Aegislash resists Rock |
| 7 "17" | **Tailwind** (Dragonite); **Screens** (Prankster Meowstic) | Tailwind: Has answers; **Screens: Thin** | Morpeko's Taunt is contested by Prankster (screens go first) |
| 8 Calvin | **Tailwind** (Staraptor); **Fake Out + redirection** (Grimmsnarl + Volcarona Rage Powder); **Screens** (Grimmsnarl) | Tailwind: Has answers (**SPOF Pelipper**); **Screens: Thin** | Volcarona's Rage Powder redirects Anthony's single-target moves. Sinistcha is Grass, so it ignores Rage Powder (VERIFIED: powder immunity in `ragepowder`). Jolteon threatens Pelipper (4x Electric) |
| 9 DingDing | **Tailwind** (Prankster Whimsicott); **Rain** (Prankster Rain Dance Sableye + Swift Swim Overqwil); **Screens** (Sableye) | **Screens: Thin** | 38 pts left: the richest drafter. Whimsicott's Prankster contests Sinistcha's TR |
| 10 Data | **Rain** (Politoed + Archaludon); **Electric Terrain** (Raichu-Mega-X + Archaludon); **Screens** (Klefki) | **Screens: Thin** | Rain + Electro Shot and Electric Terrain both hit Pelipper 4x. **Perish trap is one pick away**: Politoed's Perish Song + Decidueye's Spirit Shackle (3 pts). Anthony's two Ghosts escape it |

**Cheap enablers** (≤ 8 pts, complete a likely core for 2+ opponents): Squawkabilly 3 (Tailwind or Intimidate cycling for 7 coaches),
Aurorus 3 / Abomasnow 6 / Vanilluxe 8 (snow + Veil alone), Pincurchin 4 (Electric Terrain for 5), Decidueye 3 (Tailwind, Perish
trap for Data), Simipour 1 (rain; usage-noise suspect, low sample). Per draft-strategy §4, only hate-draft one if Anthony would
also use it.

## 6. Anthony's roster against cores (Charizard, Sinistcha, Pelipper, Kangaskhan, Aegislash, Morpeko; 11 pts, 4 picks left)

- **Breadth is good.** All 13 archetypes are "Has answers" in the abstract (no opponent blockers), thanks to two Ghosts, a Dark
  type, both speed modes, two weather setters, two Fake Outs and two Wide Guards. That's an estimate, not a result.
- **Answer load is concentrated.** Cards each mon anchors: Pelipper 11, Sinistcha 8, Morpeko 7, Charizard 7, Aegislash 4,
  Kangaskhan 4. Pelipper is 4x weak to Electric, and Hex, ZhuZi, Jacky, 17, Calvin and Data all have Electric attackers. When Pelipper
  falls, the Tailwind answers vs Hex and Calvin drop to Thin.
- **Screens are the gap: Thin vs 17, Calvin, DingDing and Data.** Every screens setter there has Prankster, so Morpeko's Taunt
  goes second. The cheapest fix is **not** a pick. Brick Break is learnable by Kangaskhan, Aegislash and Charizard
  (`raw/champions-learnsets-board.json`), and Mega Kangaskhan's Parental Bond hits again after the break. That's a prep-tech move slot for
  those weeks. The model rates it Thin because tech doesn't anchor a Med core. That's the honest reading: it works if you bring it.
- **Affordable picks the model says would fix the weak cards** (max 8 pts on the next pick). Tauros 2, Tauros-Paldea-Combat 3 and
  Mabosstiff 4 bring Raging Bull / Psychic Fangs to all 4 screens cards. Squawkabilly 3, Gliscor 3 and Decidueye 3 remove the Pelipper
  single point of failure vs Hex and Calvin. These are low-usage mons (Pikalytics ~0%) and this is a card-level estimate, so treat it
  as input to the existing plan in league-analysis.md §4, not as a recommendation to change it. The draft order and Anthony's
  preferences decide.
- **Mirror view (Anthony's own cores, scenario A).** Tailwind (Pelipper + Megas), Sun (Charizard-Y), Rain (Pelipper) and the
  Fake Out + Rage Powder shell. His Tailwind is Thin to answer for Ning, ZhuZi, Jacky and Data. His sun is Thin for Calvin and Data,
  with no answer found for DingDing. Hidden information under A that's worth keeping hidden: **Charizard's Mega X vs Y**
  (physical Dragon Dance Fire/Dragon vs special sun) and **Sinistcha's Imprison** (learnable; Imprison + Trick Room shuts out
  Jacky's Farigiraf / Mimikyu TR, and Armor Tail doesn't stop it because Imprison isn't priority). Under B both are visible at preview.

### Status rule (amended from UX proposal; names aligned with UX v2)
- Count one candidate answer per Anthony mon, at its best class: structural > standard-move > tech. counts:false entries
  are never counted. At most one Mega-dependent mon counts.
- An **anchor** is a structural or **standard-move** answer (the move is in that mon's keyMoves, e.g. Sinistcha's own TR) that
  isn't `partial` and isn't **contested** (an opponent pool mon has a blocker, e.g. Armor Tail vs Fake Out). Tech counts as an anchor
  only where the core's sensitivity in the selected scenario is High.
- **Has answers** = ≥ 2 counted mons and ≥ 1 anchor. **Thin** = ≥ 1 counted mon but not that. **No answer found** = 0.
- What I changed and why: (1) standard-move answers anchor, because they don't depend on picking tech for the week; (2) partial
  and contested answers never anchor; (3) a single-point-of-failure check is added. Mega-conflict cards: I agree with UX v2 (no status
  cap; they aren't fieldable and sort after). I didn't edit `docs/research/ux/cores-ux.md`. The "Thin threat" cap edit wasn't mine.

## 7. Blind spots and uncertainty
- Rosters are 6–7 of 10. Cards will change, and the one-pick-away list is the forward view.
- Usage evidence comes from ladder M-C usage (Pikalytics 2026-10-02), not from this league's coaches. Low-usage mons have tiny samples
  (e.g. Simipour Rain Dance).
- Items aren't in dex.json, so these aren't seen: Grassy / Psychic Seed partners, Mental Herb, Light Clay, Focus Sash on setters,
  Choice Scarf speed.
- dex.json has no learnsets. Tech moves without a role tag (Imprison, Taunt, Brick Break, Spirit Shackle…) need `learnsetTech[]` built in
  `tools/build-data.mjs` (spec in `cores.json`). The reference script reads the raw learnsets directly.
- The blocker check ("contested") scans the opponent's whole pool and ignores their own one-Mega limit. Mega Banette's Prankster
  contests Sinistcha's TR even though Hex would then lose Mega Garchomp. It's cautious by design.
- Thresholds (Spe ≤ 60 / Atk-SpA ≥ 100 / ≥ 110) are judgement calls. Damage, Stat Points, natures, partners and positioning aren't modelled.
- League rules not confirmed: Bo1 / Bo3, OTS, pairing notice, item clause (league-analysis.md §6).

## 8. YouTube transcript attempts
Method: fetch the public watch page with curl, read the `captionTracks` URL the page itself offers, then request it.
Every request returned an **empty body**. The **suspected** cause is that YouTube now needs a player token for caption files.
I didn't establish the cause independently. I didn't use third-party transcript services
or token workarounds. **No transcript was retrieved, so no claim here is transcript evidence.** The descriptions and chapter lists were
readable and are cited only as CREATOR CLAIMs.

| Video | Retrieved | Used |
|---|---|---|
| Jay Jingles, "Avoid These 6 VGC Draft League Mistakes!" (2025-12-08) https://www.youtube.com/watch?v=dqxQcxr4OoA | description only | CREATOR CLAIM: plan for "how your opponent wants to beat you", which supports scoring opponent cores, not just mons |
| Xeminan, "How to Play PsySpam/Trick Room in Pokémon Champions VGC" (2026-09-15) https://www.youtube.com/watch?v=X7SDc5RhoKw | description + chapters (games at &t=379, &t=928, &t=1239) | CREATOR CLAIM: PsySpam = Indeedee-F + Expanding Force users (Armarouge, Mega Gardevoir) with "overwhelming spread damage pressure". The mechanics are VERIFIED (§2) |
| OhNoItsCody, "This Team Uses EVERY Terrain!" (2026-09-16) https://www.youtube.com/watch?v=QyJTiXTz-_o | description + chapters (e.g. "Electric Terrain vs Trick Room" &t=1095) | CREATOR CLAIM: "Regulation M-C has brought Terrain back". Consistent with the new seed / Terrain Extender items (VERIFIED, Serebii via format-and-meta.md) |
| Jay Jingles, "Did Pokemon Champions KILL Draft League?" (2026-03-25) https://www.youtube.com/watch?v=IVFDA8HtjaA | description only | not used (about the in-game economy) |
| King's Court, "3 Tips to Instantly Improve Your VGC Draft Team" (2025-05-08) https://www.youtube.com/watch?v=XsP91ZaPn1k | description only | not used (no substantive claims) |

## 9. Sources
Simulator: https://github.com/smogon/pokemon-showdown (`data/moves.ts`, `data/abilities.ts`, `sim/battle-queue.ts`,
`sim/battle-actions.ts`, `data/mods/champions/{moves,abilities,conditions}.ts`, fetched 2026-10-03). Guide: Pokémon Champions Discord
Trick Room guide (updated 2026-08-31) https://pokemonchampionsdiscord.com/pokemon-guides/pokemon-champions-trick-room-guide-how-trick-room-works-team-roles-proven-vgc-examples/
(CREATOR CLAIM: four counters "stop / stall / reverse / punish"; Farigiraf Armor Tail; Indeedee redirection + terrain; TR "about four
useful turns"). Repo: format-and-meta.md §3–7, draft-strategy.md §4–7, league-analysis.md §6, sources.md, `raw/*`, league sheet.

## 10. Questions for Anthony / the league
1. Are team sheets (moves / items) shared, and when: in advance, at the match, or never? (Decides scenario A vs B.)
2. How far ahead are weekly pairings known?
3. Bo1 or Bo3 per week?
4. Can rosters change after the draft (free agency or trades)? This affects whether hate-drafting cheap enablers is worth it.

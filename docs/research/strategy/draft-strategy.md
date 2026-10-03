# Draft-League Strategy Guide (Pokémon Champions VGC, Reg M-C)

Written for Anthony (first draft league) and for the Drafarig app. Sources are listed in `sources.md`
(mainly Smogon's *Beginner's Guide to Draft League* vols 1–2, the Smogon VGC Draft thread, Smogon's
Champions M-B VGC Draft Kickoff rules, the Reg M-C metagame thread, Victory Road, Pikalytics).

---

## 0. Role vocabulary (fixed tags used in `pokemon.json`)

The app should treat these as an enum. A Pokémon gets a tag if it can perform the role in a
standard M-C set (from its Champions learnset/abilities, **including any of its Megas** — drafting a
mon includes its Megas in this league). Mega-only roles are listed in `notes`.

| Tag | Meaning | Detection rule used |
|---|---|---|
| `fake-out` | Has Fake Out (turn-1 flinch) | learns Fake Out |
| `tailwind` | Sets Tailwind (×2 Speed, 4 turns) | learns Tailwind |
| `trick-room` | Sets Trick Room | learns Trick Room |
| `redirection` | Follow Me / Rage Powder | learns either |
| `intimidate` | Intimidate ability (base or Mega) | ability |
| `prankster` | Prankster (+1 priority status) | ability (base or Mega) |
| `speed-drop` | Spread speed control: Icy Wind / Electroweb | learns either |
| `wide-guard` | Wide Guard | learns |
| `quick-guard` | Quick Guard | learns |
| `helping-hand` | Helping Hand (only tagged on support-leaning mons) | learns + not a primary attacker |
| `pivot` | U-turn / Volt Switch / Flip Turn / Parting Shot | learns any |
| `status` | Will-O-Wisp / Thunder Wave / Spore / Sleep Powder / Yawn / Nuzzle | learns any |
| `disruption` | Taunt / Encore / Snarl / Knock Off / Fake Tears | learns any |
| `screens` | Reflect + Light Screen or Aurora Veil | learns |
| `healer` | Life Dew / Pollen Puff / Heal Pulse / Hospitality | learns/ability |
| `perish-trap` | Perish Song (bonus if Shadow Tag) | learns |
| `sun-setter` / `rain-setter` / `sand-setter` / `snow-setter` | Drought/Drizzle/Sand Stream/Snow Warning (base or Mega) | ability |
| `terrain-setter` | Grassy/Psychic/Electric/Misty Surge (base or Mega) | ability |
| `sun-abuser` | Chlorophyll / Solar Power / Mega Sol / strong Fire special attacker | ability or Fire STAB + SpA ≥ 100 |
| `rain-abuser` | Swift Swim / Rain Dish/Dry Skin user, strong Water attacker, or Thunder/Hurricane user | ability or Water STAB with ≥ 100 attacking stat |
| `sand-abuser` | Sand Rush / Sand Force / Rock-Ground-Steel attacker immune to sand | ability |
| `snow-abuser` | Slush Rush / Ice Body / Ice-type attacker (Blizzard 100% in snow) | ability or Ice STAB |
| `tr-abuser` | Base Speed ≤ 55 and attacking stat ≥ 100 (base or Mega) | stats |
| `spread-attacker` | STAB spread move (Heat Wave, Rock Slide, EQ, Hyper Voice, Dazzling Gleam, Surf/Muddy Water, Discharge, Blizzard, Expanding Force, Make It Rain, Matcha Gotcha, Sludge Wave, Breaking Swipe…) with ≥ 95 attacking stat | learnset + stats |
| `priority` | Damaging priority (Sucker Punch, Aqua Jet, Grassy Glide, Extreme Speed, Bullet Punch, Ice Shard, Shadow Sneak, Mach Punch, Vacuum Wave, Upper Hand, First Impression, Jet Punch) or Gale Wings | learnset |
| `setup` | Swords Dance / Nasty Plot / Dragon Dance / Calm Mind / Bulk Up / Shell Smash / Quiver Dance / Belly Drum / Coil / Shift Gear | learnset |
| `physical-attacker` / `special-attacker` | Attacking stat ≥ 100 (best of base/Mega) | stats |
| `bulky` | HP+Def+SpD ≥ 300 (best of base/Mega) | stats |
| `mega` | Has at least one legal Mega in M-C | data |

## 1. How this league works (as understood)

- 10 coaches, **100 points**, every coach must draft **exactly 10 Pokémon**. Board prices 1–20.
- **Snake draft**: odd rounds 1→10, even rounds 10→1. Anthony is seat **#5**, so his picks come in
  the middle; between any two of his picks there are either 10 picks by seats 6–10, or 8 picks by seats 1–4.
- **A drafted Pokémon includes all its Mega forms for free** (confirmed by Anthony).
- Each week: you see the opponent's 10, build 6 from your 10, then bring 6 → pick 4 at team
  preview (Champions rules). Bo1 vs Bo3 per week is UNVERIFIED — ask the league.
- Points are a hard cap: 10 picks must fit inside 100, i.e. after pick *k* you must keep at least
  `(10 − k) × 1` points for the remaining picks.

## 2. Budgeting philosophy (distilled)

1. **Top-heavy wins, but only if the stars compress roles.** Smogon's guide notes top-heavier drafts
   perform better *in most settings*, while warning against "drafting expensive Pokémon solely because
   they're available." In VGC the stars should be either the format's best Mega or mons that do two
   jobs at once (e.g., Rillaboom = Fake Out + terrain + priority; Incineroar = Fake Out + Intimidate + pivot).
2. **One Mega per battle.** Free Megas don't stack within a game. Draft 1 primary Mega + at most 1
   backup Mega; every extra Mega-dependent pick is a wasted star.
3. **Role compression > raw power** in the cheap tiers. A 2-point Intimidate or a 3-point
   Tailwind/Fake Out user is worth more to a team than a 3-point "strong attacker" with no support.
4. **Reserve math.** Before every pick, compute `max_spend_now = points_left − (picks_left_after_this × min_price)`.
   With 1-point mons on the board, min_price = 1. Keep a 1–2 point buffer if your fallback targets cost 2–3.
5. **Know where the cliff is.** On this board the useful 1–4 pointers are a short list (see
   league-analysis.md); once they're gone, the next useful tier is 5–8. Taking your cheap gems *before*
   rich coaches who need filler is often more important than another mid pick.
6. **Don't buy what the board gives free.** Many support roles (Fake Out, Intimidate, Tailwind,
   Trick Room, Icy Wind) are available at 1–5 points. Spend points on *damage and the Mega*.

## 3. Roster-completeness checklist (automatable)

The app can score a roster against these checks (✓ = present; weights are suggestions):

| # | Check | Minimum | Weight | How to evaluate |
|---|---|---|---|---|
| 1 | Primary Mega | 1 strong Mega | high | `megas` non-empty & tier ≥ A on at least one mon |
| 2 | Speed control (own) | ≥ 2 sources, ideally both modes | high | count `tailwind`, `trick-room`, `speed-drop`, `prankster`+Thunder Wave |
| 3 | Fake Out | ≥ 1, ideally 2 | high | `fake-out` |
| 4 | Intimidate | ≥ 1 | med-high | `intimidate` |
| 5 | Redirection or Wide Guard | ≥ 1 | med | `redirection`, `wide-guard` |
| 6 | Answer to Trick Room | ≥ 1 | med | `trick-room` (reverse), `disruption` (Taunt/Imprison), `tr-abuser` of your own, or Fake Out x2 |
| 7 | Answer to Tailwind/fast offense | ≥ 1 | med | own `tailwind`/`trick-room`/`priority`/`speed-drop` |
| 8 | Weather answer | have own setter or Cloud Nine | med | count `*-setter` |
| 9 | Terrain answer | ≥ 1 | low-med | `terrain-setter` or immunity (e.g. Psychic Terrain → non-priority plan) |
| 10 | Spread damage | ≥ 2 | med | `spread-attacker` |
| 11 | Physical + special balance | ≥ 2 each | low-med | attacker tags |
| 12 | Defensive typing coverage | Each of the top-15 meta attacking types resisted/immune by ≥ 2 roster mons | high | type chart vs meta attackers (Grass, Fighting, Poison, Fire, Water, Dragon, Flying, Dark, Steel, Ghost, Fairy, Electric, Ground, Rock, Normal(Aerilate=Flying)) |
| 13 | Offensive coverage | Super-effective STAB vs ≥ 80% of top-30 meta mons | high | type chart |
| 14 | Priority | ≥ 1 | low-med | `priority` |
| 15 | Ghost/Inner Focus vs Fake Out | ≥ 1 | low | Ghost type or Inner Focus |
| 16 | Specific meta answers | Rillaboom, Sneasler, Incineroar, Mega Salamence, Kingambit, Basculegion, Garchomp, Mega Charizard Y, Archaludon, Gholdengo, Indeedee-F/psyspam, Mega Raichu Y | high | ≥ 1 mon that resists their main STABs AND threatens them |
| 17 | Species clause | No duplicate dex numbers in a 6 | hard | (Rotom forms, Tauros forms, Indeedee, Meowstic, Basculegion, Lycanroc, Raichu/Alolan Raichu, Ninetales/Alolan, Slowbro/Galarian, Samurott/H, Typhlosion/H, Zoroark/H, Avalugg/H, Arcanine/H, Decidueye/H, Persian/A, Goodra/H, Stunfisk/G, Slowking/G) |
| 18 | Item clause | 6 different items | hard | — |
| 19 | Budget | sum ≤ 100, exactly 10 | hard | — |

## 4. Reading opponents & denying picks

- **Track every coach's points-left and picks-left.** A coach's max spend this pick = points_left − (picks_left − 1). Mons priced above that are safe from them.
- **Identify each roster's archetype by round 4–5** (rain? sun? Trick Room? Tailwind HO? sand?). Predict their next 2 picks: setters want abusers, TR wants slow attackers, HO wants Fake Out and a second speed control.
- **Hate-draft only when cheap and dual-purpose.** Taking Politoed to stop a rain team is only good if you also use it. With 10 picks and a tight budget, Anthony shouldn't hate-draft anything that doesn't make his own 6s.
- **Snipe risk window.** In a 10-team snake from seat 5, you are exposed to 10 consecutive picks by seats 6–10 after every odd-round pick, and to 8 picks by seats 1–4 after every even-round pick. Prioritise targets wanted by the group that picks next.

## 5. Weekly prep in draft (VGC)

1. Write both 10-man rosters side by side; mark each opponent mon's Mega(s), speed tier, and roles.
2. List their likely 2–3 *team cores* (which 6 they will build) — they also must respect one Mega per battle.
3. For each of their cores, pick your 6 and your common leads (bring 6 → pick 4).
4. Speed check every pairing (Lv-50 formula: neutral max = base + 52; positive = ⌊(base+52)×1.1⌋; Tailwind ×2; Trick Room reverses; paralysis ×0.5; Choice Scarf ×1.5).
5. Damage-calc the 5 key interactions (Showdown calc supports `[Gen 9 Champions]`).
6. Practise on Showdown `[Gen 9 Champions] VGC 2026 Reg M-C` or `4v4 Doubles Draft` custom games with a friend ("mock battles").
7. In Bo3, note revealed items/Mega choice after game 1.

## 6. Common rookie mistakes (draft + VGC)

- Spending the budget on attackers and ending with no Fake Out / speed control / Intimidate.
- Drafting 3–4 Megas (only one can evolve per game; Mega holders lose their item).
- Ignoring the minimum-price reserve and being forced into useless 1-pointers.
- Fighting the meta's weather/terrain without a plan (Rillaboom's Grassy Terrain is on ~35% of teams; rain/sun/sand all exist in this league).
- Choosing two weather setters that cancel each other without a plan (Charizard-Y sun + Pelipper rain *can* work — see Lexicon's festival-winning Sun-Rain — but you must decide per game which weather you want, and lead accordingly).
- Leading the same 2 every game; not using Protect; attacking into obvious Protect/Wide Guard.
- Forgetting species clause (only one Rotom/Tauros/Indeedee… per team) when drafting forms.
- Not checking Champions-specific changes: no Tera, no Assault Vest/Choice Band/Specs/Safety Goggles/Covert Cloak, Protect PP 8, para 1/8, sleep ≤ 3 turns.

## 7. Matchup thinking: what beats what in M-C

- **Tailwind HO** (Whimsicott/Pelipper/Talonflame/Hydreigon + Mega Floette/Raichu Y/Salamence) ← beaten by Trick Room, priority (Kingambit Sucker Punch, Grassy Glide), Fake Out on the setter, Icy Wind back, Wide Guard.
- **Trick Room** (Farigiraf, Indeedee-F, Sinistcha, Hatterene, Armarouge + Torkoal/Mega Camerupt/Snorlax/Conkeldurr/Golisopod/Kingambit) ← beaten by Taunt, Imprison, double Fake Out, Ghost/Dark damage into setters, Encore, outlasting 4 turns with Protect.
- **Psychic spam** (Indeedee + Mega Gardevoir/Armarouge/Delphox Expanding Force) ← Dark types (Kingambit, Incineroar), Rillaboom terrain override, Steel types, Gholdengo.
- **Sun** (Mega Charizard Y/Torkoal + Venusaur/Chlorophyll) ← rain/sand setters, Rock Slide, Archaludon, Water types, Hisuian Arcanine.
- **Rain** (Pelipper/Politoed + Mega Swampert/Basculegion/Archaludon) ← Grass/Electric, Rillaboom, own weather (Charizard Y, Tyranitar), Sinistcha (resists Water & Electric).
- **Sand** (Mega Tyranitar/Hippowdon + Excadrill/Mega Salamence/Mega Garchomp-Z) ← Water, Fighting (Sneasler), Grass, Intimidate.
- **Snow** (Mega Froslass/Alolan Ninetales Aurora Veil + Baxcalibur) ← Fire, Steel, Fighting, Rock.
- **Perish trap** (Mega Gengar Shadow Tag + Perish Song) ← Ghost types (immune to trapping), switching before Mega, Taunt, Fake Out.

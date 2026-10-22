# tools/sim: Showdown battle simulation (dev only, never shipped)

Never shipped: `scripts/build.mjs` bundles only `public/`, `lib/` and `data/*.json`; `server.mjs` serves only `lib/`,
`public/` and those data files; `npm test` runs `test/*.test.mjs` only. `tools/sim/vendor/` is gitignored.

## Step 1 feasibility spike (2026-10-21): feasible, no blockers

### Showdown
- https://github.com/smogon/pokemon-showdown, MIT licence. Pinned commit `d601443456c795f77c6e4f2b5b459167f2b10a3c`
  (master on 2026-10-21). `sh tools/sim/setup.sh` fetches exactly that commit into `tools/sim/vendor/pokemon-showdown`,
  runs `npm install` and `node build` there. Nothing is added to the app's package.json.
- Format `[Gen 9 Champions] VGC 2026 Reg M-C`, id **`gen9championsvgc2026regmc`** (also a Bo3 variant): mod `champions`,
  doubles, Flat Rules (Lv 50, Species Clause, Item Clause = 1, `Picked Team Size = Auto` = bring 6 pick 4, Min Team Size 6),
  VGC Timer, Open Team Sheets.
- Stat Points: `data/mods/champions/scripts.ts` `statModify`: HP = base + SP + 75, others = base + SP + 20, nature ×1.1 /
  ×0.9 truncated. **SP go on the EVs line** (our exports are already right). Validator (`sim/team-validator.ts`,
  `useStatPoints` for `champions*` mods): ≤ 32 per stat, total against the format's limit.
- Legality / Megas: both teams validate (`TeamValidator.get(id).validateTeam` → null). Charizard Mega Y evolves in battle;
  the Champions mod keeps a Mega after fainting. PP capped at 20 (Champions).

### Teams used
- Anthony: `docs/research/strategy/match-zhuzi.md` §5 (Week 1 six with Scrappy Kangaskhan over Conkeldurr).
- ZhuZi: `lib/mock-gen.mjs` over his drafted 10 (research usage, Sept league table) vs Anthony's roster; variant A.
  (`tools/sim/teams.mjs`)

### One full game (spike.mjs, RandomPlayerAI both sides, mega 0.7)
- Team preview picked 4 each, Mega Charizard Y evolved, game ran to `|win|` in 12 turns, no `|error|` lines.
- RandomPlayerAI never Megas unless `{ mega: p }` is passed (default 0).

### Parity with the app engine (lib/calc): exact
- Stats: Mega Charizard Y (Modest 6/0/0/32/2/26) and Mega Metagross (Jolly 2/32/0/0/0/32) identical in all six stats.
- Damage (no crits, 3–4k samples of `battle.actions.getDamage`, min/max HP vs our `calc.run` range):
  - Mega Charizard Y Heat Wave → Mega Metagross, sun, spread: 216–254 / 157 both (137.5–161.7%).
  - Kangaskhan Life Orb Last Resort → Infernape: 204–242 / 151 both.
  - Krookodile Rock Slide (spread) → Mega Charizard Y: 160–192 / 159 both.
  - Mega Metagross Psychic Fangs → Kangaskhan: 124–147 / 212 both.
  - Dragapult Life Orb Shadow Ball → Shield Aegislash: 125–148 / 167 both.
- Note: sampling `getDamage` in a loop trips PS's log-line guard ("Infinite loop"): reset `battle.sentLogPos` each call.

### Throughput (bench.mjs, random vs random, this Mac: 15 cores = 5 P + 10 E; load average ~25 from other work)
- Single thread: ~21–25 games/s (~11 turns/game).
- worker_threads pool, 15 workers: ~88–100 games/s (3.6–4.8× single) under that load. Expect more on an idle machine.
- Heuristic AIs will cost more per decision (calc calls): budget ~1–5 games/s per worker; 10k games is minutes.

## Step 2 proposal: heuristic AI player
- A `PlayerAI` subclass (BattleStream request JSON in, choice string out) per side, seeded PRNG, no hidden info: it sees
  the opponent's open team sheet (Open Team Sheets is on) but not their bring 4 / lead until revealed.
- Team preview: score each 4-of-6 (and lead pair) by the matchup matrix our app already computes (threat scan both ways,
  lib/threat-scan.mjs; OHKO odds × speed order), pick by softmax(score / temperature).
- Each turn: enumerate legal joint actions for both active slots (move × target, Protect, switch, Mega), score with
  lib/calc (damage % from the live battle state: HP, boosts, weather, terrain, screens, Trick Room, Intimidate drops), KO
  odds, speed / priority order, and simple rules (Fake Out turn 1, Protect when threatened by a predicted KO, don't hit
  your ally with a spread move unless it's immune, Wide Guard vs spread, Trick Room when slower, Mega on the first turn it
  helps). Expected value against the opponent's likely replies (their top-k scored actions), one ply.
- Skill and noise: `skill` (0–1) blends the best-scored action with softmax sampling; `noise` adds per-game random
  preferences so the same matchup doesn't play identically. Styles: aggressive (weights damage), safe (weights Protect /
  switching / survival), setup (weights TR / Tailwind / screens). Run grids of skill × style for both sides.
- Validation: unit tests on fixed states (it Fake Outs, it doesn't Heat Wave into its own Grass ally, it KOs when it can),
  and win rate vs RandomPlayerAI ≫ 50%.
- Outputs (step 3): win rate per (our 6, bring 4, lead) × their plausible teams (generator variants plus hand-picked),
  with confidence intervals; which of ZhuZi's teams beats us most; per-mon contribution (KOs, damage, fainted).

## Step 2: the heuristic AI (2026-10-21) — validated, no big runs yet

### Files
- `ai/data.mjs`: the pinned Showdown dex (move semantics) + the app's lib/calc (damage, stats).
- `ai/tracker.mjs`: protocol → what a player knows (HP, status, boosts, forms, items, actives, weather, terrain, Trick Room,
  Tailwind, screens, Fake Out eligibility, Choice locks, moves used). Open team sheets: both teams' sets are known.
- `ai/engine.mjs`: legal options per slot with the behaviour filters; an approximate one-turn resolver (priority / Speed /
  Trick Room order, Protect and its 1/3 repeat, Wide Guard, Follow Me / Rage Powder (Grass / Overcoat immune), Fake Out
  flinch, Helping Hand, Instruct, Intimidate, Drought on Mega Evolution, Sash, Sitrus, Life Orb, drain / recoil, stat-drop
  secondaries, burns, U-turn / Parting Shot / Chilly Reception pivots, Stance Change); damage from lib/calc cached per
  state (hit rate ~97%); the value function (Pokémon kept, field: Trick Room weighted by who it actually helps, Tailwind,
  screens, sun for sun users, status, boosts; plus next turn's threat with "can it Protect next turn", and tempo costs
  for Protect and switching).
- `ai/player.mjs`: team preview (bring 4 by offence − 0.8 × defence + roles; leads by offence + Fake Out / Drought / TR /
  Intimidate / Mega), then each turn: the opponent's plausible plans, our top options, both sides' candidate joint
  actions, the turn solved as a zero-sum matrix game (regret matching) with double-oracle expansion (each side's best
  response to the other's mix is added until nothing new). It plays from its equilibrium mix (`skill`), else a softmax
  over values (`temperature`), and a uniformly random legal action with probability `noise` (default 0.07). `style`:
  balanced / aggressive / safe / setup. `usualBring`: chance of bringing the first four (habit). Deterministic per seed.
- `game.mjs` (one game + summary), `run.mjs` (worker pool, cores − 1; seed = base + game index, so runs that differ in one
  option are paired game by game; JSONL appended per game, resumable; per-game timeout), `logs.mjs` (annotated logs),
  `validate.sh` / `validate.mjs`, tests in `test/` (`node --test tools/sim/test/*.test.mjs`: 16 pass).

### Behaviours (VGC Strategy's list) and where they live
- Fake Out: first turn out only; never into Ghosts (unless Scrappy), Inner Focus, a Queenly Majesty / Dazzling / Armor Tail
  side or Psychic Terrain (filters); target by value (flinch only if the target hasn't moved).
- Trick Room: never re-set your own (filter); re-setting the opponent's cancels it (resolver); 5 turns incl. the set turn.
- Tailwind: 4 turns; not under Trick Room (filter). Mega: on the first turn it can (always).
- Wide Guard / Protect: never twice in a row (filter); Protect's future cost is in the value (next-turn threat).
- Rage Powder / Follow Me: redirection with Grass / Overcoat / Goggles / Stalwart exceptions (resolver).
- Instruct (partner only) repeats the partner's move this turn if it already moved; Chilly Reception sets snow and pivots.
- Foul Play (calc uses the target's Attack) + Stance Change (Blade after attacking) → Aegislash shields more vs Umbreon.
- Choice locks and Last Resort (only after the other moves) are respected; uncharged Solar Beam (no sun / Power Herb) is
  not chosen; a spread move that also hits the partner only when the partner is immune or protecting.

### Validation (`sh tools/sim/validate.sh`, a01 = guide six, z = ZhuZi candidates)
- (a) Position tests: KO when available, Fake Out T1 (Metagross, never the Ghost), no Fake Out into Inner Focus / Ghost,
  no Boomburst into its partner, Wide Guard vs a known Rock Slide, Protect beats attacking when targeted and slower, never
  re-sets its own TR, sets TR with Fake Out support, Last Resort only after Fake Out, Choice lock, Instruct, Chilly
  Reception, Stance Change, Foul Play avoidance, determinism. All pass.
- (b) vs RandomPlayerAI: 392/400 = 98.0% (95% CI 96.1–99.0%).
- (c) Mirrors: a01 vs a01 308/600 = 51.3% (47.3–55.3%); z01 vs z01 193/400 = 48.3% (43.4–53.1%).
- (d) Style: Trick Room teams (z04, z15, z23) vs a fast team (z24) set TR in 240/294 games = 81.6% (76.8–85.6%).
  Against Anthony's a01 they set it only 37.9% (balanced) / 50.9% (setup style): a01 is mid-speed with its own slow
  Pokémon (Aegislash 72, Sinistcha 90), so TR barely helps them there (and Mega Charizard Y's sun Weather Ball threatens
  the setter); the AI sees that. Flag for VGC Strategy: is that the right read, or should "TR team" mean "TR habit"?
- Errors: ~1 recovered invalid / unavailable choice per 300 games (Showdown's default is taken; no game stalls).

### Throughput (this Mac, 14 workers, other work running)
- Heuristic vs random: ~20 games/s (0.5 s/game per worker). Heuristic vs heuristic: ~10–13 games/s (0.8–1.9 s/game).
  10,000 games ≈ 15 minutes.

### Logs for review: `tools/sim/logs/` (a01 vs z01, z04, z07, z03, z09): per turn, both players' preview / plans /
equilibrium mix / prediction / choice / own model, and the protocol lines.

### Known limits (ponytail notes in code)
- The resolver is expected-value, one turn deep (plus the threat term); no switching prediction beyond the matrix game.
- Open team sheets: each AI knows the other's exact sets (incl. Stat Points). An "OTS only" mode (guess SP) is not built.
- Two-turn moves other than Solar Beam, Encore / Taunt / Yawn effects and Imprison are modelled only roughly.

## Step 2b: VGC Strategy's review fixes (docs/research/strategy/sim/ai-review.md), 2026-10-21
1. Double Protect: a joint where both actives Protect / Wide Guard / King's Shield is only a candidate when both face a
   likely KO (≥ 50% from one foe hit); otherwise removed (both sides). Measured: 1–6% of two-mover turns.
2. Preconditions: Last Resort only after every other move since entry (also in the resolver), Fake Out / First
   Impression only on the first turn, Poltergeist not into an item-less target, Dream Eater only into sleep, Steel Roller
   only on terrain; a forced failing move (Kangaskhan after a flinched Fake Out with no switch) is modelled as nothing.
   Measured failed moves: 0.1–0.4% of moves.
3. Preview: the best three 4-sets, every lead pair in them scored by the solved turn-1 game against their two likeliest
   leads, plus the 4-set score; hard rule (no 4×-Rock-weak lead into a visible spread Rock user without Wide Guard or Fake
   Out beside it); `--preview guide` uses `lib/guides/5v3.mjs` previews (first row whose species are all in their six;
   the AI otherwise). Measured: Charizard into spread Rock uncovered 0.
4. Aegislash: Blade/Shield from the tracker (Blade after attacking until King's Shield), King's Shield drops a contact
   attacker's Attack, Wide Guard offered only against a real spread threat (≥ 25% into one of ours).
5. Personas (`run.mjs` PERSONAS, per game by seed): tr 60% on z04/z05/z15/z16/z23, 30% on z06 (lead setter + abuser,
   TR p 0.8 on the first chance, 0.5 to re-set, never on its own, partner Protect / Fake Out); rock 60% on z03/z08/z18
   (lead the Rock Slide user); chilly 60% on z07 (bring Slowking-G; Chilly Reception p 0.8 while the opponent's sun is up).
   `--persona none|all` overrides. Results print per persona.
6. Noise: second-best joint, one slot to Protect, or a target swap; a switch 2% of noise draws, never the un-Mega'd holder.
7. Instruct: the partner's last move (this turn's if it moved, else last turn's), best target by damage.
8. Tests: `tools/sim/test/review.test.mjs` (11), all 27 sim tests pass.
Metrics printed with every batch (run.mjs / validate.mjs): double-Protect, failed moves, Wide Guard uses vs turns with a
spread threat, Charizard leads into spread Rock (covered / uncovered), Mega count and turn, TR set rate by persona, Chilly
Reception use (chilly persona), win rate by persona.

### Validation after the fixes (`sh tools/sim/validate.sh pilot`)
- vs RandomPlayerAI 394/400 = 98.5% (96.8–99.3%). Mirrors: a01 280/600 = 46.7% (42.7–50.7%); z01 205/400 = 51.3% (46.4–56.1%).
- TR teams vs a01: persona tr sets TR 174/177 = 98.3%, calc 98/117 = 83.8%; vs the fast z24 (calc) 260/300 = 86.7%.
- Chilly persona (z07, all games): Slowking-G brought 100/100, Chilly Reception used in 34/100 (needs Slowking on the field
  while our sun is up).
- Pilot a01 vs z01..z24, 960 games each, paired seeds: AI preview 510/960 = 53.1% (50.0–56.3%); guide preview
  437/960 = 45.5% (42.4–48.7%); AI − guide +7.6 points (±4.2). The guide's first row (vs Metagross + Krookodile + Infernape:
  lead Aegislash + Kangaskhan, bring Charizard / Aegislash / Kangaskhan / Rotom-Fan) does worst (z01 15%, z10 15%, z13 17.5%,
  z22 15%, z24 17.5% vs 35–55% with the AI preview). Per-persona: tr 67%, calc 51%/42%, rock 41%/27% (AI/guide).
  (The pilot ran before the chilly persona brought Slowking; 24 chilly games in it.)
- ~2 s/game per worker with the lead lookahead; 960 games ≈ 2.5 minutes on 14 workers.

## Step 2c: VGC Strategy's second round (2026-10-21)
1. BUG fixed: `damage()` turned every lib/calc refusal into 0, so Mimicry (refused as `mechanic-unsupported:type-change`)
   made Stunfisk-Galar unhittable and harmless. Now a refusal is retried with the refused side's ability swapped for Run
   Away in a second calc (`ai/data.mjs` calcLoose: same engine, Run Away also legal) — exact for Mimicry without terrain
   (its own Ground/Steel); with terrain it's marked `mimicry-terrain` (approximate); anything still refused gets a rough
   base-power estimate, never 0. Every refusal is counted per game and printed per batch ("calc refusals: N (codes)").
   a02 quick check (48 games): Stunfisk brought 16/48 (was 92–97%), 30,541 refusals all type-change, all retried.
2. Semi-invulnerable turns: the tracker records the charge (`-prepare`); a charging Phantom Force / Shadow Force / Fly /
   Dig / Dive / Bounce user can only finish its move and is untargetable until it hits; choosing one this turn charges (no
   damage) and makes it untargetable for the rest of the turn; Phantom / Shadow Force (Showdown `breaksProtect`) go
   through Protect / King's Shield and lift it for the turn.
3. Mega switching: a switch-in pays 0.25 × (worst single hit the foes it came in on can do to it ÷ its HP), on top of the
   hits the resolver applies to its slot; switching out an evolved Mega costs 0.1 more.
4. Sucker Punch / Thunderclap fail unless the target is about to use a damaging move (hasn't moved, not Protect / status).
Tests: `tools/sim/test/fixes2.test.mjs` (5); 32/32 sim tests pass. Validation (machine load average ~60 from other work,
so the s/game numbers are inflated): vs random 390/400 = 97.5% (95.5–98.6%); mirrors a01 280/600 = 46.7% (42.7–50.7%),
z01 197/400 = 49.3% (44.4–54.1%); TR teams set TR (persona tr 98.9%, calc 83.5%, calc vs fast z24 87.0%).

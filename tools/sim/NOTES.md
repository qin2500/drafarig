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

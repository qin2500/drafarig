# The search engine (a "Stockfish for VGC" on Pokémon Showdown)

The heuristic AI (`tools/sim/ai`) decides with its own approximate one-turn model of the battle. The engine keeps that
AI's knowledge but checks every line in Showdown itself, and learns how to score positions from its own games.

## How a decision is made (`player.mjs`)

1. **Candidates.** The heuristic's turn solver proposes our ~10 best joint actions (both actives) and the opponent's
   ~10 likeliest replies (its equilibrium plus best responses). That keeps the search on plausible lines.
2. **Forward model.** The live Showdown battle is cloned (`Battle.toJSON` / `fromJSON`, ~0.5 ms) and **determinized**
   from our point of view:
   - his Pokémon that haven't appeared are resampled from his six (we don't know his back two);
   - for those that have appeared, unrevealed moves, the item, ability, SP spread and nature come from our beliefs
     (`--sheets`: `closed` = his most likely candidate set per species; `open` = his real sets);
   - the dice are re-seeded, and any choice he already locked in this turn is cleared.
   Each determinization is one sample (3 per decision by default).
3. **Simulation.** Every (ours × theirs) pair is played for one turn in Showdown from each sample: exact damage
   rolls, speed ties, Protect odds, abilities and items, as the real game does them. About 300 turns per decision.
4. **Leaf evaluation** of each resulting position:
   - by default, the heuristic's value: material, status, boosts, Trick Room / Tailwind / screens / sun, and next turn's
     threat both ways, plus its costs for Protect, switching and switch-ins;
   - with `--weights`, the **learned** value: a logistic model of the win probability fitted on the engine's own games
     (`fit-value.mjs`), over the heuristic's terms and features read straight from Showdown (`value.mjs`).
5. **Solve.** The payoff matrix is a simultaneous-move game; regret matching gives both sides' equilibrium mixes. We play
   ours (probabilities under 2% dropped).

Team preview and forced replacements still use the heuristic (preview tables are fitted separately). ZhuZi's plan
personas (Trick Room / rock / Chilly Reception habits) still override the engine for his side where they apply.

## The learning loop (the "RL" part)

1. Self-play: engine vs engine with `--record` (every decision's features), closed sheets, varied previews.
2. Fit: `node tools/sim/engine/fit-value.mjs weights.json results/*.jsonl` (held-out games by seed parity; the report
   compares the learned model's log loss with the heuristic value's).
3. Play the new weights against the old (paired seeds). Keep the winner; repeat with its games.

## Depth 2 and dice (`--depth 2`, `--dice`)

- **Common random numbers:** within one sample every cell uses the same dice seed, so candidates differ by the choices,
  not by luck.
- `--dice mean` plays the most likely outcome (average damage roll; every chance event, i.e. accuracy, crits,
  secondary effects and Protect streaks, goes to its likelier side; speed ties stay random). `mixed` = sample 0 mean,
  the rest random.
- `--depth 2`: after the one-turn matrix, our top 3 rows × his top 3 columns are re-scored by a second simulated turn.
  Forced replacements take Showdown's default; the next turn is its own small game (both sides' 4 best joints from the
  heuristic), played in Showdown and solved. The choice is then re-solved among those rows.

## How strong it is (mirror matches vs the noiseless heuristic)

Same six on both sides (c1 mirror and z01 mirror), open sheets, sides alternating; 50% = equal strength.

| Setting | Games | Engine wins |
|---|---|---|
| depth 1, 3 random samples | 960 | 46.7% |
| depth 1, common random numbers, 3 samples | 480 | 47.7% |
| depth 1, common random numbers, 8 samples | 480 | 51.3% |
| depth 1, mean dice, 2 samples | 480 | 44.6% |
| depth 1, mixed dice, 4 samples | 480 | 50.6% |
| depth 2, mixed dice, 4 samples | 480 | 51.3% |
| **depth 2, mean dice, 2 samples** | 1,440 | **56.5%** (fresh-seed confirmation: 57.4% of 960) |

The learned value (generation 1, fitted on 1,440 self-play games) predicted results slightly better than the heuristic
value on held-out games (log loss 0.507 vs 0.515) but did not play better (−1.5 ± 3.0 head to head), so the leaf is
the heuristic value. The ZhuZi runs use **depth 2, mean dice, 2 samples** on both sides (about 1 s per decision).

## Running

```
node tools/sim/run.mjs --ours <six> --theirs z01..z24 --ours-ai engine --theirs-ai engine --sheets closed \
  [--weights w.json --opp-weights w.json] [--samples 3] [--record] --games N --seed S --out f.jsonl
```

The result line gains `engine: { ours, theirs }` (decisions, simulated cells, ms, fallbacks, and with `--record` the
features).

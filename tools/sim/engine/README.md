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

## Running

```
node tools/sim/run.mjs --ours <six> --theirs z01..z24 --ours-ai engine --theirs-ai engine --sheets closed \
  [--weights w.json --opp-weights w.json] [--samples 3] [--record] --games N --seed S --out f.jsonl
```

The result line gains `engine: { ours, theirs }` (decisions, simulated cells, ms, fallbacks, and with `--record` the
features).

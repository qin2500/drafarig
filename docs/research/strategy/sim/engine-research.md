# Engine research: search + learning for Reg M-C doubles

Written 2026-10-29. Scope: how to make `tools/sim/engine` (the "Stockfish for VGC") stronger, based on published work.
No code was changed for this report. Every number below is either from a cited source or from this repo's own
README / results, and says which. Text marked **[speculative]** is my inference, not a published result.

---

## Short answer: the recommended architecture

1. **Keep the core you have.** Clone Showdown, determinize hidden info, play a candidate × candidate matrix for one turn,
   solve it as a simultaneous-move game, play the mixed strategy. The closest published system to this game, PokaiTrainer
   (Pokémon Champions Reg M-B doubles, 2026), is the same shape: shortlisted joint actions per side, a matrix game per
   decision solved by regret minimization, median depth 2 turns. It reached a 1492 peak on the Showdown ladder. Its
   author's main finding is that the search, not the network, carries the strength.
2. **Biggest lever: better candidate lists.** PokaiTrainer's largest measured single gain was ranking the shortlist by a
   learned prior (+16 points, 57.8% vs 41.8%). Meta's Diplomacy work fixed "good moves never get proposed" with a
   double-oracle step. Do both. Run the double oracle with Showdown as the oracle, not the heuristic's one-turn model,
   and keep reserved slots for Protect, switches, speed control and disruption (Encore, Taunt, weather).
3. **Model the opponent from human replays.** Use the replays mainly to train a small opponent policy prior (what humans
   click here). Use it to pick and weight his columns, and pull his equilibrium toward it the way piKL does in
   Diplomacy. Value labels are a weak second use.
4. **Use a real belief over hidden sets.** Sample several candidate sets per species, weighted by usage. Update the
   weights every turn from what is revealed (moves, items, abilities, speed order, damage taken). Carry the posterior
   across the games of a best of 3. Today each determinization uses the single most likely set, so the search is
   overconfident.
5. **Train the value from search, not only from game outcomes.** Keep the residual network. Train it on targets
   bootstrapped from the engine's own root values (TD-λ or solver values mixed with the outcome), held out by team. Add
   the state the leaf can't see today: rain, Encore/Taunt/Disable turns, choice lock, Protect streaks.
6. **Make team preview a 90 × 90 matrix game.** Bring 4 of 6 and choose leads: 15 × 6 = 90 options per side. Score it
   with sim-fitted values, blend the opponent's side with a human preview prior from replays, and condition games 2 and 3
   on game 1.
7. **Spend compute on width and opponent modelling before depth.** Here depth 1→2 gave about +5 points. PokaiTrainer
   found a bigger node budget alone worth +0.8 points, while a wider own menu plus more solver iterations was worth +9 to
   +14. Deepen selectively, for setup, disruption and speed-control lines, not everywhere.
8. **Gate everything with paired games on held-out teams, using a sequential test (SPRT, as Stockfish's fishtest
   does).** Expect most changes to be worth under ±4 points. PokaiTrainer reports that "almost every individual lever
   we tried lands inside" a ±4–6 point band at 256–512 games.

---

## Ranked roadmap for this codebase

"Gate" below means the existing nightly promotion gate: engine-new vs engine-old, paired seeds (common random numbers),
sides alternating, on the held-out benchmark pool (`general-teams` seeds 900000+), closed sheets with usage beliefs.
At 480 games one side's win rate has a standard error of about 2.3 points (95% CI about ±4.5). Detecting a +3 point
change reliably needs about 2,000+ games, or a sequential test that stops early on big effects (see §6).

| # | Step | Expected gain (evidence) | Effort | Risk | How to measure |
|---|---|---|---|---|---|
| 1 | **Engine-level double oracle + reserved candidate slots** (disruption fix) | Medium–high. DORA: DO at inference raised score 0.50→0.89 vs one opponent (Bakhtin et al. 2021). PokaiTrainer reserves switch/gimmick slots, and its early shortlists omitted Protect on 48% of legal turns. No data needed. | Low–medium (player.mjs only; ~1.3–2× cells per decision) | Low; time per decision up | Gate. Also a diagnostic: share of turns where the played joint contains a status move, vs replay humans at 1500+ |
| 2 | **Belief posterior over sets + Bo3 carry-over** | Medium (closed sheets). Foul Play infers sets from damage, priority, weather turns and move use, and won the Gen 9 OU PokéAgent track. PokaiTrainer reweights spread candidates by how well they reproduce observed outcomes. No published closed-sheet VGC number exists. | Medium | Medium (bugs in inference silently hurt) | Gate under closed sheets. Plus "gap closure": closed-sheet engine vs open-sheet engine (the open one is an upper bound); shrinking that gap is the target |
| 3 | **Opponent policy prior from replays** (factorized per-slot softmax in plain JS), used to (a) shortlist his columns, (b) seed our rows, (c) KL-regularize his mix | High if data suffices. PokaiTrainer: prior-ranked shortlist +16 points. Diplomacy SearchBot: candidates = top actions of a human-trained policy; scores rose from 20.2% (blueprint) to 51.1%. piKL: stronger and more human-like. | Medium–high (parser, features, trainer) | Medium: needs ~10⁴–10⁵ replays (PokaiTrainer used 122,804); bots on the ladder pollute data | Offline: top-1/top-3 accuracy and log loss on held-out replays (references: EliteFurretAI 55.0% / 83.5% top-1/top-3 on VGC; PokéChamp 13–16% opponent top-1 in singles). Then gate. Then vs a "human-like" opponent (engine with prior, λ high) |
| 4 | **Value targets from search (TD-λ / solver values) + missing leaf terms** | Medium. Our own net1–3: outcome-only labels on 6k–18k games memorized teams. PokaiTrainer: "the binding constraint is the value network"; its targets are solver values mixed with realized outcomes. TD-Gammon learned from bootstrapped targets. | Medium (record root values; change train-residual targets) | Medium: bootstrapping can lock in the heuristic's biases | Held-out-by-team log loss and calibration, then gate. A new net must win the gate, not just predict better (README: gen-1 predicted better and played worse) |
| 5 | **Team preview as a 90 × 90 matrix game** with a human prior on his side | Medium; unknown size. PokaiTrainer solves preview this way and found it the most exploitable decision type it checked. EliteFurretAI reports top players repeat the same preview ~80% of the time for a matchup, so a replay prior should predict well. | Medium | Low–medium | Gate with only preview changed. Offline: predicted-bring accuracy on held-out replays |
| 6 | **Budget reallocation instead of depth 3** (successive halving over rows, prior-weighted columns, KO-aware dice branch, selective deepening) | Low–medium. PokaiTrainer: B 32→128 alone 50.8% (flat); own menu 32 + 200 iterations 63.7%. Foul Play groups damage rolls by KO relevance. | Low–medium | Low | Gate at equal wall-clock time per decision |
| 7 | **Policy distillation / expert iteration** (train the prior on the engine's own mixes) | Medium, long-run. AlphaZero / ExIt / DORA all do this. PokaiTrainer: 32 self-play rounds added a lot on top of the BC prior, but self-play also erased some tactical skill (63/170 → 30/170 root checks). | Medium (after #3) | Medium: drift from human play; keep a KL anchor to the replay prior | Gate, plus prior accuracy on human replays must not collapse |
| 8 | **Not now:** global depth 3, MCTS from scratch, PPO end-to-end, LLM agents, Metamon-scale offline RL, NNUE | Evidence says low return at our compute (see §3–§4) | High | High | n/a |

Why this order: #1 and #2 need no new data and attack known failures (disruption never searched; overconfident
beliefs). #3 is the best-evidenced lever, but it needs the replay download to run for weeks first, so **start
`replays/fetch.mjs` running continuously today** (396 replays on disk as of writing). #4 builds on the residual work
already under way. #5–#7 compound on #3.

---

## 1. Pokémon-specific AI work

### What exists and what it reported

| System | Year | Format | Method | Reported result | Compute |
|---|---|---|---|---|---|
| **PokaiTrainer** (Max Yu) [arXiv 2608.29197](https://arxiv.org/abs/2608.29197) | 2026 | **Champions VGC Reg M-B doubles, open sheets** | Student-of-Games-style: CFR per decision over public belief states, growing subgame (median depth 2, up to 3), transformer value net (~5.4M params), policy prior BC-initialized on 122,804 human replays (2.56M decisions), self-play over hundreds of human teams; own Rust engine (~99% parity with Showdown) | 59% of 150 Bo3 sets vs a ~1320-average human field; 1350–1400 band, peak 1492; "first VGC agent rated on that ladder" | ~250 L40S-hours self-play + ~15 A100-hours training (32 rounds); 2.7 s median per decision |
| **Foul Play** (P. Mariglia) [GitHub](https://github.com/pmariglia/foul-play), [poke-engine](https://github.com/pmariglia/poke-engine) | 2019–2025 | Singles | Root-parallel MCTS with decoupled UCT for simultaneous moves; hand-made eval, no rollouts; damage rolls grouped by KO relevance; opponent sets from usage + replays, narrowed by damage/priority/weather/move inference, sampled by likelihood | Won PokéAgent Gen 9 OU track (50–14 final); >80% GXE Gen 9 OU (peak 1879), >90% GXE Gen 9 Random (peak 2341) ([PokéAgent paper, App. E](https://arxiv.org/abs/2603.15563)) | Rust engine; not stated |
| **Metamon** (Grigsby, Xie, Sasek, Zheng, Zhu) [arXiv 2504.04395](https://arxiv.org/abs/2504.04395) | 2025 (RLC) | Singles Gen 1–4 (later Gen 9 OU) | No search. Offline RL on transformers (15M–200M params) from ~475k reconstructed replays (~950k first-person trajectories), then self-play fine-tuning | Best agent ~top 10% of ladder (Gen 1 OU GXE 79.9%, Glicko 1761 ± 35); drew Foul Play in Gen 3–4, beat it in Gen 1–2 | 8× A5000, ≥11M gradient steps |
| **PokéChamp** (Karten et al.) [arXiv 2503.04094](https://arxiv.org/abs/2503.04094) | 2025 (ICML) | Singles | Minimax; LLM proposes own/opponent actions and scores leaves; local Showdown as world model; usage stats for hidden info | 84% vs Abyssal bot (GPT-4o); projected ladder 1300–1500; opponent action top-1 accuracy 13–16% | API LLM; 15 s per turn cap; ~1/3 of ladder games lost to timeouts |
| **PokéLLMon** (Hu, Huang, Liu) [arXiv 2402.01118](https://arxiv.org/abs/2402.01118) | 2024 | Singles random | LLM with in-context feedback and knowledge retrieval | 49% ladder, 56% invited battles | API LLM |
| **Wang MIT M.Eng. thesis** [DSpace](https://dspace.mit.edu/handle/1721.1/153888) | 2024 | Gen 4 random singles | MCTS guided by PPO self-play actor-critic | Peak rank 8, 1693 Elo | not checked |
| **VGC-Bench** (Angliss, Cui, Hu, Rahman, Stone) [arXiv 2506.10326](https://arxiv.org/abs/2506.10326) | 2025/AAMAS 2026 | Gen 9 VGC doubles, open sheets | BC on 700k+ logs, PPO with self-play / fictitious play / double oracle, LLM baseline | BC+self-play best; strong on 1 team but "performance decreases considerably and consistently" as team count grows; nearly all agents "approximately 100% exploitable" | 8× A40, ~5M timesteps |
| **EliteFurretAI** (caymansimpson) [GitHub](https://github.com/caymansimpson/EliteFurretAI) | ongoing | VGC doubles | 30.9M-param transformer BC on replays; search planned; RL starting | Action prediction top-1 55.0% / top-3 83.5%; no win rates reported | not stated |
| **PokéAgent Challenge** (Karten et al.) [arXiv 2603.15563](https://arxiv.org/abs/2603.15563) | NeurIPS 2025 | Gen 1 OU, Gen 9 OU singles | Competition | "Specialist methods (RL and search) outperformed LLM approaches"; Gen 9 won by search (Foul Play), Gen 1 by offline RL (PA-Agent, Metamon-based) | — |

Also checked: reuniclusVGC (abandoned; README judged MCTS too costly for doubles), the VGC AI Competition
([cog2025](https://cog2025.inesc-id.pt/vgc/); no published battle-track results found), Stockkarp (only its public FAQ as
summarized in the task: self-play network, human-data fine-tuned preview and predictions, board valuation plus opponent
prediction, sampling hidden info).

### What this tells us (established)

- **Search with a good model of the game wins at small compute.** Foul Play (hand eval, no network) won Gen 9 OU
  against RL entrants. PokaiTrainer: "the policy head alone loses even to a depth-one material-heuristic belief search".
  A raw policy without search lost to that search 71% pooled. Our engine is already in the right family.
- **Learning helps as a prior and an evaluator inside search, not as a replacement.** PokaiTrainer's network was the
  bottleneck ("the binding constraint is the value network"). Its gains came from the prior's shortlist (+16 points) and
  self-play rounds on top of search.
- **Generalizing across teams is the hard part.** VGC-Bench saw performance fall as team count grew. Our net1–3
  memorized training teams. PokaiTrainer: internal win rates are "substantially a matchup fact, not a strength fact". The
  held-out-team gate is the right defence. Keep it.
- **Hidden info is handled by inference, then sampling.** Foul Play and PokaiTrainer both keep a weighted candidate set
  per opposing Pokémon and update it from observed damage and order. Nobody has published a closed-sheet VGC agent:
  PokaiTrainer lists closed sheets as future work.
- **Scale references for pure learning approaches**, to show they are out of reach here: Metamon used ~475k battles and
  8 GPUs; VGC-Bench used 8 A40s; PokaiTrainer used ~265 GPU-hours. Our laptop's ~15 CPU cores overnight are 1–2
  orders of magnitude below that.

---

## 2. Imperfect-information and simultaneous-move search

### The options

| Method | Idea | Fit for ~1 s and ~10–20 × 10–20 joint menus |
|---|---|---|
| **One-shot matrix game + regret matching** (what we do) | Payoffs for all pairs, then an equilibrium | Good. Exact for one turn. Diplomacy SearchBot is one-ply plus truncated rollouts and a value net, with regret matching over sampled candidates ([Gray et al. 2021](https://arxiv.org/abs/2010.02923)), and ranked 17th of 1,128 humans |
| **Decoupled UCT / SM-MCTS** | Each side runs its own bandit at every node | Works in practice ([Tak, Lanctot, Winands 2014](https://cris.maastrichtuniversity.nl/portal/en/publications/monte-carlo-tree-search-variants-for-simultaneous-move-games(5e4c8118-4db7-49bf-b12d-d16ee90fe167).html): DUCT best "despite its theoretical shortcomings"). Foul Play uses it. But PokaiTrainer: DUCT at 10× iterations ties CFR head to head (51.7%) and is far more exploitable (a local best response beats its mix 83.6% vs 49.6% for CFR) |
| **Regret matching / Exp3 inside MCTS** | Converges to Nash in SM games | Proven to converge ([Lisý et al. 2013](https://proceedings.neurips.cc/paper/2013/hash/1579779b98ce9edb98dd85606f2c119d-Abstract.html)). Needs many visits per node, so it is too slow with Showdown at ~2 ms per turn |
| **Simultaneous-move alpha-beta** | Bound-based pruning of matrix cells | [Saffidine, Finnsson, Buro 2012](https://ojs.aaai.org/index.php/AAAI/article/view/8266) **[URL not verified in this session]**. Pruning saves cells only when bounds are tight. With a noisy heuristic leaf, gains are uncertain **[speculative]** |
| **Double oracle** | Grow both menus with best responses until stable | Our heuristic already does this inside its own approximate model (`ai/player.mjs solve`, step 4). DORA shows it fixes missing candidates ([Bakhtin et al. 2021](https://arxiv.org/abs/2110.02924)). **Recommended at engine level (roadmap #1)** |
| **CFR / MCCFR / ReBeL / Student of Games** | Solve subgames over public belief states with learned values | The principled answer to hidden info. ReBeL ([Brown et al. 2020](https://arxiv.org/abs/2007.13544)), Student of Games ([Schmid et al. 2023](https://arxiv.org/abs/2112.03178)), Pluribus depth-limited search ([Brown & Sandholm 2019](https://www.science.org/doi/10.1126/science.aay2400)). PokaiTrainer is SoG-style. Needs a value network over beliefs and a fast engine. Too expensive here as a whole, but two pieces are cheap (below) |
| **Information-set MCTS** | One tree over information sets, determinize per iteration | Avoids some strategy fusion ([Cowling, Powley, Whitehouse 2012](https://eprints.whiterose.ac.uk/id/eprint/75048/)). Needs many iterations, so again too slow with Showdown |

### Determinization and strategy fusion (relevant to us)

Perfect-information Monte Carlo (sample a world, solve it as if known) works surprisingly often. [Long, Sturtevant, Buro,
Furtak (AAAI 2010)](https://ojs.aaai.org/index.php/AAAI/article/view/7562) study when it does and doesn't. Its known
failure is **strategy fusion**: the solver acts as if it can pick a different action in each world, which it can't.

How it applies here **[my reading of `player.mjs`]**:

- **Root:** we average the payoff matrix over samples, then solve once. For our side that is correct: one action for all
  worlds, i.e. a Bayesian matrix game. For his side it is slightly wrong. He knows his own set, so the right model gives
  him a strategy per world. PokaiTrainer keeps "one regret table per world for seat 2". This is cheap to copy: solve a
  matrix where his strategy is indexed by sample. Worth trying with 2–4 samples **[speculative gain]**.
- **Depth 2:** `deepCell` solves the next turn inside each determinized world, so our second-turn play "knows" his set.
  That is classic fusion, and it overvalues lines that need information we won't have. It is mild today (1 sample at
  depth 2), but it grows if depth 2 uses more samples.
- **Bigger issue than fusion:** closed sheets use **one most-likely set per species**, so all samples share the same
  set. That is zero belief diversity, so the search is overconfident about his item, spread and moves (roadmap #2).

### Mixed vs pure play

PokaiTrainer measured exploitability: a local best response gains 0.117 against argmax play and 0.0004 against the full
mix. We already play the mix (pruned below 2%). Keep doing it, especially in a best of 3 against a human who adapts.

---

## 3. Search + learning hybrids

### What transfers

- **Policy priors to choose what to search (AlphaZero PUCT; Diplomacy candidate sampling).** AlphaZero
  ([Silver et al. 2018](https://arxiv.org/abs/1712.01815)) and MuZero ([Schrittwieser et al. 2020](https://arxiv.org/abs/1911.08265))
  use a policy network to focus the search. Gumbel MuZero ([Danihelka et al. 2022](https://openreview.net/forum?id=bERaNdoegnO))
  is the version built for **small simulation budgets**: sample actions without replacement at the root, then sequential
  halving. That matches our ~300 cells per decision. **Established in Go, chess and Atari. In Pokémon, PokaiTrainer's
  prior shortlist gave +16 points.**
- **Opponent modelling from human data, regularized search (piKL).** [Jacob et al. 2022](https://arxiv.org/abs/2112.07544):
  search that penalizes KL divergence from a human-imitation policy plays stronger than imitation and still predicts
  humans well (chess, Go, Diplomacy). Cicero builds on this. For us: solve his side as maximize payoff − λ·KL(q ‖
  human prior). λ large gives "plays like a 1500 human"; λ → 0 gives "plays the equilibrium". Tune λ on the gate and on
  replays. **[speculative for Pokémon; established in Diplomacy]**
- **Double oracle to find missing actions (DORA).** Inference-time DO raised score 0.50 → 0.89 against one model and
  cut exploitability (90.5% → 85.8%). Local edits of equilibrium actions beat uniform random proposals (0.89 vs 0.75).
  Our analogue: change one slot of an equilibrium joint at a time.
- **Value targets from search (ExIt, AlphaZero, TD).** Expert iteration ([Anthony, Tian, Barber 2017](https://arxiv.org/abs/1705.08439))
  trains the network on the search's output, so the target is a search-improved estimate rather than only a ±1 outcome.
  TD-Gammon ([Tesauro 1995](https://dl.acm.org/doi/10.1145/203330.203343)) learned a strong evaluator for a dice game
  with a small MLP from bootstrapped targets. PokaiTrainer mixes solver values with realized outcomes. **Established.**
- **Cheap evaluation (Stockfish NNUE).** [Stockfish blog 2020](https://stockfishchess.org/blog/2020/introducing-nnue-evaluation/):
  more than 80 Elo over the classical eval, trained on millions of positions scored by search. **The transferable part
  is "train the eval on search scores", not the incremental update.** Our cost is the Showdown clone and turn
  (~0.5 ms clone, ~2 ms per turn per PokaiTrainer), not the leaf, so a faster leaf alone buys little.

### What does not transfer now

- **End-to-end RL (PPO) or Metamon-style offline RL.** These need GPU-scale data and compute (§1). VGC-Bench's PPO agents
  were nearly fully exploitable.
- **LLM agents.** The PokéAgent organizers report specialist RL/search beat LLM approaches in battling.
- **MuZero's learned model.** Showdown is an exact simulator. Learning a model throws that away.

---

## 4. What is practical in plain JavaScript on this laptop

| Model | Use here | Feasible? | Data needed (evidence) |
|---|---|---|---|
| Logistic / conditional-logit (softmax over each slot's legal options with hand features) | Opponent prior, our row prior, preview prior | Yes. Trains in minutes in JS with SGD/Adam | Unknown for Pokémon. PokaiTrainer's BC used 122,804 replays. With ~20–50 well-chosen features per option, 10⁴ replays (~10⁵–10⁶ slot decisions) is a reasonable first target **[speculative]** |
| Count / Dirichlet tables | Set priors (moves/items/spreads given revealed facts), preview leads given the opposing six, P(Protect \| context) | Yes, trivial | Grows with replays. Smooth toward usage stats |
| Small MLP (existing `net.mjs`) | Residual value; later a policy head | Yes (already done) | Outcome labels alone: 6k–18k games memorized teams (our net1–3). Use search targets and more distinct teams |
| Gradient-boosted trees | Value residual alternative; robust to unscaled features | Feasible (a small JS GBDT is a few hundred lines) but unproven here | Same data as MLP. Main benefit: less tuning, less overfitting **[speculative]** |
| Transformers (PokaiTrainer 5.4M, EliteFurret 30.9M, Metamon 15–200M) | — | Not practical without a GPU and a tensor library | 10⁵+ games |

A rough throughput check **[from this repo's nightly log, not measured by me]**: 13 workers ran one 64-team
self-play round in a night. Expect around 10³ engine games per night. So any learned component must be useful at
10³–10⁴ games, or learn from replays, which don't cost simulation time.

---

## 5. The five questions

### (a) How to use the replay data

**Primary use: an opponent policy prior.** Replays show what real players click in real positions. That is exactly
what the heuristic guesses today. Train P(slot action | public state) per active slot:

- **State:** what a spectator sees. `ai/tracker.mjs` already rebuilds it from the protocol. Note that a replay's
  `|request|` lines aren't present, so legal options must be inferred.
- **Option set for each slot:** that Pokémon's moves revealed anywhere in the replay, plus Protect if revealed, plus
  switches to its revealed bench. That leaks a little future info, which is acceptable for a prior.
- **Features per option:** the heuristic's damage % and KO chance on each target, "is Protect / Fake Out / spread /
  speed control / weather / redirect / Encore / Taunt", whether the target is the faster foe, HP buckets, turn number,
  Tailwind/TR turns, and "used last turn".
- **Model:** a conditional logit (one weight vector, a softmax over options), with an optional small interaction layer.
  Joint = product of the two slots, with a couple of pair features (double-target, Protect + attack) **[speculative design]**.
- **Hygiene:** drop bot accounts (the first replay on disk is from a player named "YakinikuBOT2"). Weight by rating.
  Hold out by player, not by game, the same lesson as holding out by team.

**Then use the prior in four places:** (1) his columns: shortlist by prior × heuristic, and weight the payoff solve
piKL-style; (2) our rows: add the prior's top joints our heuristic missed; (3) team preview: P(bring, leads | his six,
our six); (4) set inference: revealed move/item co-occurrence counts.

**Secondary use: value labels.** Replays give diverse, human-shaped positions and thousands of distinct teams, which is
the cure for memorization. But (i) unrevealed sets must be inferred, as Metamon had to; (ii) human outcomes are noisy
labels; (iii) the label is still one bit per game. Use them later as extra training rows for the residual value, with
only public-info features (which `encode.mjs` already restricts itself to), and gate the result **[speculative]**.
Don't make them the main use.

### (b) Fixing candidate generation so disruption moves get searched

Root cause **[from the code]**: candidates come from the heuristic's `solve`, whose values come from its one-turn
`resolve` + `value`. A status move like Encore, Taunt or Rain Dance has almost no immediate effect in that model, so it
never ranks in the top `topM` per slot. The heuristic's own double-oracle step uses the same model as its oracle, so it
can't rescue them either. The leaf also has no rain term (`LEARNED_PARTS` has sun, TR, Tailwind and screens only), and
no term for an Encore or Taunt in effect.

Fix, in order of cost:

1. **Reserved slots.** Always include, per slot when legal: Protect; the best switch; each speed-control,
   weather/terrain, redirect and disruption move (Encore, Taunt, Disable, Fake Out, Icy Wind, Tailwind, Trick Room,
   Rain/Sun Dance), paired with the partner's best action. PokaiTrainer reserves slots for switch and gimmick joints.
   Its early shortlists omitting Protect on 48% of legal turns is the failure this prevents.
2. **Engine-level double oracle.** After the first solve, for each slot try every legal option (with the partner's
   equilibrium action) against his current mix *in Showdown*. Add our best response if it beats the current value by a
   margin. Do the same for his side. Repeat 2–3 times. Cost: roughly (legal options per slot × 2 slots × his support
   size) extra cells, about +30–100% cells. DORA's "local modification" proposals are the published version.
   The existing `--wide` flag is half of this (it adds the options, but not his best responses); its strength isn't in
   the README table.
3. **Give disruption moves a horizon.** Encore and weather pay off next turn, so a depth-1 leaf misses them. Either send
   any cell whose row or column contains a reserved-class move to the depth-2 re-score, whether or not it is in the top
   3, or add leaf terms (rain turns signed by who benefits, Encore/Taunt turns on each active weighted by how bad the
   locked move is). The first is general. The second is cheap and also feeds the learned residual.

Measure: gate win rate, plus "fraction of decisions where a reserved-class move is in the played mix" compared with
1500+ human replays.

### (c) Team preview

Today preview uses the heuristic or fitted tables. Recommended:

- Each side has 15 brings × 6 lead pairs = 90 options. Build a 90 × 90 matrix. Fill it cheaply: a learned preview value
  (from sim results on general teams: features of the two brought fours and leads), a short engine rollout for the top
  few cells, or both. Solve with regret matching. PokaiTrainer does exactly this and blends the opponent's bring marginal
  with a corpus prior.
- His side: blend the equilibrium with a human prior from replays (P(bring/leads | his six, our six), backed off to
  P(bring | his six)). EliteFurretAI reports top players repeat their preview ~80% of the time per matchup, so this prior
  should be sharp.
- Bo3: in games 2 and 3, condition his prior on what he brought in game 1 (humans often repeat or counter-adjust),
  and our beliefs on what was revealed.
- PokaiTrainer found preview the most exploitable decision type it checked, so keep it mixed.

Measure: gate with only preview changed; offline accuracy of predicted bring/leads on held-out replays.

### (d) Hidden info, closed sheets, Bo3

- **Belief over sets.** For each species keep several weighted candidates (the top usage sets, plus spread archetypes;
  PokaiTrainer puts 15% of mass on base-stat archetype spreads). Update each turn from reveals: moves used, item and
  ability messages, damage dealt and taken (does a candidate's calc reproduce the HP change?), and turn order (speed
  bounds). Keep a "contradiction" fallback for when nothing fits, as PokaiTrainer does. Determinize by **sampling**
  from this posterior, not taking the argmax.
- **Unseen back two:** already resampled from his six. Weight by the preview prior once it exists.
- **Bo3 game 1 → game 2.** Everything revealed in game 1 (moves, items, abilities, speed bounds, the four he brought)
  becomes hard or near-hard evidence for games 2 and 3. That is pure bookkeeping and probably one of the cheapest real
  gains under closed sheets **[speculative size]**. PokaiTrainer (open sheets) saw no within-set decline: 53.4% / 50.5%
  / 61.8% by game.
- **Opponent per-world strategy** (see §2): let his mix depend on the sample.
- **Leak check.** The overfitting audit found beliefs built from his candidate library leaked his real sets. Gate runs
  must use `--beliefs usage`.

Measure: closed-sheet engine vs open-sheet engine on the held-out pool. The open-sheet result is the ceiling; report the
share of that gap each change closes.

### (e) Deeper search or better evaluation and opponent modelling?

**Better evaluation and opponent modelling, plus wider candidate menus. Not global depth 3.** Evidence:

- Ours: depth 1 → 2 was about 51% → 56.5% (README). Most of the depth-1 variance came from dice handling, not depth.
- PokaiTrainer (same game): a 4× bigger node budget alone gave 50.8% (no gain). A wider own menu plus more solver
  iterations gave 59–63.7%. Prior-ranked shortlists gave +16 points. Its median depth is 2.
- Cost: with Showdown at ~2 ms per turn plus ~0.5 ms per clone, 1 s buys ~400 turn simulations. Depth 3 on a 3 × 3 × 4
  × 4 tree with 2 samples already uses most of that, and it shrinks width. Foul Play reaches 10+ turns, but in singles
  with a Rust engine.
- Where depth *does* pay: setup, disruption and speed-control lines (payoff is next turn), and endgames with few
  Pokémon left. Do selective deepening there (roadmap #1.3, #6). PokaiTrainer also notes bulkier teams gained more from
  deeper search than hyper-offense did.

---

## 6. Measurement notes (applies to every step)

- **Paired, common random numbers, sides swapped, held-out teams.** Already in place. Keep the gate free of ZhuZi and
  league teams.
- **Use a sequential probability ratio test** for promotions, the way Stockfish's fishtest does
  ([fishtest wiki](https://github.com/official-stockfish/fishtest/wiki)): stop early when a change is clearly good or
  clearly not. Fixed 480-game gates resolve only about ±4.5 points. PokaiTrainer warns most levers land inside its
  ±4–6 point band at 256–512 games.
- **Equal wall-clock.** Compare at the same time per decision. Steps #1 and #6 change cell counts, so a fair test caps
  time, not cells.
- **One change per gate.** Interactions are real (PokaiTrainer: root CFR iterations were "a dead lever", while child
  iterations became the biggest lever at wider shapes), but single-change tests keep conclusions clear.
- **Diagnostics beside the win rate:** replay-prior log loss, value calibration on held-out teams, the share of
  reserved-class moves played, and closed-vs-open gap closure.

---

## Sources (all accessed 2026-10-29)

- Yu, M. *PokaiTrainer: Scaling Equilibrium Search to Competitive Pokémon VGC.* arXiv 2608.29197, 2026. https://arxiv.org/abs/2608.29197
- Karten, S. et al. *The PokéAgent Challenge: Competitive and Long-Context Learning at Scale.* NeurIPS 2025 competition; arXiv 2603.15563, 2026. https://arxiv.org/abs/2603.15563
- Grigsby, J., Xie, Y., Sasek, J., Zheng, S., Zhu, Y. *Human-Level Competitive Pokémon via Scalable Offline RL with Transformers (Metamon).* RLC 2025. https://arxiv.org/abs/2504.04395
- Karten, S., Nguyen, A. L., Jin, C. *PokéChamp: an Expert-level Minimax Language Agent.* ICML 2025. https://arxiv.org/abs/2503.04094
- Hu, S., Huang, T., Liu, L. *PokéLLMon: A Human-Parity Agent for Pokémon Battles with LLMs.* 2024. https://arxiv.org/abs/2402.01118
- Angliss, C. L., Cui, J., Hu, J., Rahman, A., Stone, P. *VGC-Bench.* arXiv 2506.10326, 2025; AAMAS 2026. https://arxiv.org/abs/2506.10326
- Wang, J. *Winning at Pokémon Random Battles Using Reinforcement Learning.* MIT M.Eng. thesis, 2024. https://dspace.mit.edu/handle/1721.1/153888
- Mariglia, P. *Foul Play* and *poke-engine.* https://github.com/pmariglia/foul-play, https://github.com/pmariglia/poke-engine
- caymansimpson. *EliteFurretAI* and *reuniclusVGC.* https://github.com/caymansimpson/EliteFurretAI, https://github.com/caymansimpson/reuniclusVGC
- Gray, J., Lerer, A., Bakhtin, A., Brown, N. *Human-Level Performance in No-Press Diplomacy via Equilibrium Search.* ICLR 2021. https://arxiv.org/abs/2010.02923
- Bakhtin, A., Wu, D., Lerer, A., Brown, N. *No-Press Diplomacy from Scratch (DORA).* NeurIPS 2021. https://arxiv.org/abs/2110.02924
- Jacob, A. P. et al. *Modeling Strong and Human-Like Gameplay with KL-Regularized Search (piKL).* ICML 2022. https://arxiv.org/abs/2112.07544
- Tak, M., Lanctot, M., Winands, M. *Monte Carlo Tree Search Variants for Simultaneous Move Games.* IEEE CIG 2014. https://cris.maastrichtuniversity.nl/portal/en/publications/monte-carlo-tree-search-variants-for-simultaneous-move-games(5e4c8118-4db7-49bf-b12d-d16ee90fe167).html
- Lisý, V., Kovařík, V., Lanctot, M., Bošanský, B. *Convergence of MCTS in Simultaneous Move Games.* NeurIPS 2013. https://proceedings.neurips.cc/paper/2013/hash/1579779b98ce9edb98dd85606f2c119d-Abstract.html
- Saffidine, A., Finnsson, H., Buro, M. *Alpha-Beta Pruning for Games with Simultaneous Moves.* AAAI 2012. (URL above not verified in this session)
- Cowling, P., Powley, E., Whitehouse, D. *Information Set Monte Carlo Tree Search.* IEEE TCIAIG 2012. https://eprints.whiterose.ac.uk/id/eprint/75048/
- Long, J., Sturtevant, N., Buro, M., Furtak, T. *Understanding the Success of Perfect Information Monte Carlo Sampling in Game Tree Search.* AAAI 2010. https://ojs.aaai.org/index.php/AAAI/article/view/7562
- Brown, N., Bakhtin, A., Lerer, A., Gong, Q. *Combining Deep RL and Search for Imperfect-Information Games (ReBeL).* NeurIPS 2020. https://arxiv.org/abs/2007.13544
- Schmid, M. et al. *Student of Games.* Science Advances 2023. https://arxiv.org/abs/2112.03178
- Brown, N., Sandholm, T. *Superhuman AI for multiplayer poker (Pluribus).* Science 2019. https://www.science.org/doi/10.1126/science.aay2400
- Silver, D. et al. *AlphaZero.* Science 2018. https://arxiv.org/abs/1712.01815
- Schrittwieser, J. et al. *MuZero.* Nature 2020. https://arxiv.org/abs/1911.08265
- Danihelka, I., Guez, A., Schrittwieser, J., Silver, D. *Policy Improvement by Planning with Gumbel.* ICLR 2022. https://openreview.net/forum?id=bERaNdoegnO
- Anthony, T., Tian, Z., Barber, D. *Thinking Fast and Slow with Deep Learning and Tree Search (Expert Iteration).* NeurIPS 2017. https://arxiv.org/abs/1705.08439
- Tesauro, G. *Temporal Difference Learning and TD-Gammon.* CACM 1995. https://dl.acm.org/doi/10.1145/203330.203343
- Stockfish team. *Introducing NNUE Evaluation.* 2020. https://stockfishchess.org/blog/2020/introducing-nnue-evaluation/
- Stockfish fishtest (SPRT testing). https://github.com/official-stockfish/fishtest/wiki

Not verified in this session (cited from general knowledge, URL or detail may need checking): the Saffidine et al. URL,
the TD-Gammon DOI, the fishtest wiki page contents, the Gumbel OpenReview ID, the ReBeL / Student of Games / AlphaZero /
MuZero / ExIt arXiv IDs (well known, but not re-opened here), and the PokéChamp author list beyond the first author.

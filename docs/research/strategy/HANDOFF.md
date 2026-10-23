# Drafarig / VGC: handoff for a new session

*Written 2026-10-23 by the team-lead session (f99fd930), which runs as a background job without MCP tools. A new
foreground session should read this, then capture the durable facts below to the `memory` MCP server (it has it; the
background session did not, so nothing from this work is in that server yet).*

## Who / what

- Anthony's personal VGC draft-league tool (Pokémon Champions, Reg M-C). League: **closed team sheets, best of 3**.
- Real app = branch `prep-builder` in this worktree (`.claude/worktrees/core-prep-research`); `main` is an unrelated old
  history. Live site deployed by **Kuma** through the local Codex relay `codex:01a13bd6-…` (agent bridge); live = **v19,
  commit 655dbfb** (2026-10-22).
- Anthony prefers balance teams; wants deep, evidence-based research; prep shown inside the app, not separate pages.

## Week 3 vs ZhuZi: the current recommendation (live in the app's ZhuZi guide)

- **Six "c1":** Charizard (Mega Y, 32 HP / 0 Spe), Aegislash (Kasib, Shadow Sneak), Kangaskhan (Silk Scarf Fake Out /
  Double-Edge / Sucker Punch / Protect), Morpeko (sixth slot, never brought; Stunfisk-Galar ties), Sinistcha (Bold
  Sitrus), **Conkeldurr in place of Rotom-Fan**. Sets: `lib/guides/5v3.mjs` / `tools/sim/candidates/r5/c1.txt`.
- **Preview table** (guide `previews`): vs Mega Metagross + Krookodile + Infernape lead Kangaskhan + Sinistcha (Trick
  Room), Charizard + Conkeldurr behind; vs Oranguru + Toxtricity or Slowking-G lead Charizard + Kangaskhan; vs Slowking-G
  + Umbreon: **game 1** Aegislash + Sinistcha (Charizard, Kangaskhan behind), **games 2–3** Aegislash + Kangaskhan,
  Conkeldurr + Sinistcha, Charizard home; vs Dragapult + Umbreon Charizard + Kangaskhan, Conkeldurr + Sinistcha.
- **Evidence** (heuristic-AI sims, `docs/research/strategy/sim/zhuzi-sim-report.md`): closed sheets c1 78.5% vs 24
  modelled ZhuZi teams, **+8.6 ± 2.2** over the best alternative (a17); with full information +5.6 ± 2.3. Weakest vs
  bulky Umbreon / Taunt sixes (z09, z17 ~53%).
- **Lessons:** a sim bug (damage cache keyed by slot) once flipped the answer, so re-confirm on fresh seeds after any
  engine fix; the AI's own team preview is weak, so compare sixes each with its own fitted preview table
  (`--preview explore` → `scripts/fit-previews.mjs` → validate on new seeds).

## The search engine (in progress at the time of writing)

`tools/sim/engine/` (README there): "Stockfish for VGC" on Showdown: heuristic proposes candidate joint actions, the
live battle is cloned and determinized (closed-sheet beliefs), every pair is played in Showdown, the payoff matrix is
solved; `--depth 2` re-scores the main lines with a second simulated turn; `--dice mean` = most-likely dice.
- Validated: **depth 2, mean dice, 2 samples beats the noiseless heuristic 56.5% in mirror matches** (1,440 games).
- The learned value (self-play logistic regression, `fit-value.mjs`) predicted slightly better but did not play better
  (−1.5 ± 3.0); the leaf stays the heuristic value. Depth 1 was not stronger than the heuristic (dice noise).
- **Final run done (2026-10-23):** engine on both sides, closed sheets, 1,440 games per six: c1 76.7%, c2 76.5% (tie),
  c7 68.8% (−9.3 ± 3.2), a17 64.9% (−12.1 ± 3.2). The guide's preview table beat a re-fit one on fresh games (78.8% vs
  72.5%) and stays. Report §6b; guide note updated; deployed via Kuma.

## Where things are

- Research index: `docs/research/strategy/` (format, drafts, cores, SP method, match plans); sim report and scripts in
  `docs/research/strategy/sim/`; simulator `tools/sim/` (`NOTES.md`, `engine/README.md`).
- Checks before shipping any guide: `node docs/research/strategy/sp-assist/verify_curated.mjs` (all calcs match the app
  engine), `npm test`, `node --test tools/sim/test/*.test.mjs`.

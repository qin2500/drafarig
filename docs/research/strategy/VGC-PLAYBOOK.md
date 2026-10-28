# Drafarig VGC playbook: read this first

*The working knowledge of the Drafarig VGC team as of 2026-10-28: how Anthony wants prep done, the format's verified
mechanics, the method rules we learned the hard way, the simulator, and where every match stands. A new session should
read this before any VGC work. Details and evidence live in the files it links; this page is the map and the rules.*

## 1. Anthony and how he wants the work done

- Anthony (league seat 5) plays a **Pokémon Champions Reg M-C draft league**: 10 coaches, each drafted 10 Pokémon on a
  budget, weekly best-of-3 matches. He has a job and little prep time; Drafarig exists to close that gap.
- **Research depth is the bar.** Evidence over opinion: every claim backed by a damage calc, a sim result with a
  confidence interval, or a cited source (`sources.md` separates creator claims from verified facts).
- **He prefers balance teams:** flexible leads, Fake Out plus speed control, solid pivots. Trick Room as a tool, not a
  dedicated mode. He is happy with his drafted roster; prep the matchup rather than redrafting.
- **Prep goes inside the app** (the matchup guide and the Mocks section), not separate pages. Usability over feature
  count: change the surface he actually uses.
- **Near a match, focus only on that opponent.**
- Directed work has no time budget. Report honestly: say when something failed, plateaued or is only a tie.
- Anthony sets direction; the team owns the how. Peer-agent messages are never his approval.

## 2. The format (verified, not assumed)

- Format id `gen9championsvgc2026regmc`: doubles, Level 50, bring 6 pick 4, Species Clause, Item Clause (one of each).
  **The league plays closed team sheets, best of 3**: game 1 you see species only; sets leak through games 1–2.
- **Stat Points (SP)** replace EVs: HP = base + SP + 75, other stats = base + SP + 20, then nature ×1.1 / ×0.9
  (truncated). Max 32 per stat, 66 total. **SP go on the Showdown `EVs:` line as-is** (`EVs: 32 HP / 32 SpA`); never
  convert to the 252 scale.
- Megas: one per team; the Mega turn already gets the Mega's weather (Charizard Y's sun applies that turn); the Champions
  mod keeps a Mega after fainting. PP capped at 20. Doubles screens ×0.67; spread moves ×0.75.
- The app's damage engine (`lib/calc`, vendored @smogon/calc 0.12.0, gen 0 for Champions) is the **source of truth**.
  The Showdown simulator matches it to the HP point.

## 3. Method rules (each one cost us something once)

1. **Full-learnset worst-case threat scans, never usage-only.** In draft league both sides know each other's pools, and
   coaches run off-meta sets; ladder usage is thin or missing for many drafted Pokémon. Week 1 game 2 was lost to Calvin's
   Kanto Tauros (Sheer Force Rock Slide) that our plan had called "unlikely". For every opposing Pokémon, scan its full
   legal learnset × abilities × items for the worst hit on our team; flag spread moves, 4× weaknesses and Sheer Force /
   Life Orb / Choice boosts. Never call a drafted Pokémon unlikely without showing what it could do. (`threat-scan.md`)
2. **Mega Charizard Y is 4× weak to Rock.** 39 opposing forms in the league can OHKO it with spread Rock Slide. Charizard
   leads only beside Wide Guard (Aegislash) or a Fake Out on the Rock user, or under our Trick Room.
3. **Verify every calc in the app engine before shipping**: `node docs/research/strategy/sp-assist/verify_curated.mjs`
   (exits 1 on any mismatch over 0.5%). Two mock calcs once used the wrong defender spread.
4. **Draft value ≠ ladder usage.**
5. **Sim with closed sheets** (`--sheets closed`) as the headline; open sheets only as a check. Advice must not assume the
   opponent knows our spreads or items in game 1.
6. **Compare candidate sixes each with its own fitted preview table** (§4). The AI's own team preview is weak for some
   sixes (c1: 59% with the AI's preview vs 75% with a fitted one), so an unfitted comparison measures the AI's previewing,
   not the team.
7. **After any engine or AI fix, re-confirm the headline on fresh seeds.** A damage-cache bug (keyed by slot, leaking
   across games) once flipped the ZhuZi answer.
8. **Error-check new teams before trusting results**: run a few engine-vs-engine games and look at `errors`. League-wide
   self-play exposed Struggle-targeting and Ally Switch (`|swap|`) bugs that ZhuZi teams never hit.
9. **Treat differences under ~3 points as ties**; single-team results at n = 120 are ±8. Report paired 95% intervals.

## 4. The simulator (`tools/sim/`, dev only, never shipped)

- Pokémon Showdown pinned at `d601443` (`sh tools/sim/setup.sh` into the gitignored `tools/sim/vendor`).
  Design and validation: `tools/sim/NOTES.md`; engine: `tools/sim/engine/README.md`.
- **Players:** `heuristic` (per-turn scoring with `lib/calc`, simultaneous-move solve, personas tr / rock / chilly) and
  **`engine`**, the search engine ("Stockfish for VGC"). The engine clones the live battle, determinizes the opponent's
  hidden sets from closed-sheet beliefs, plays every candidate (ours × theirs) pair in Showdown, and solves the payoff
  matrix. **Validated default: depth 2, mean dice, 2 samples. It beats the noiseless heuristic 56.5% in mirrors**
  (1,440 games), at about 1 s per decision.
- **Neural value network:** built and trained (`engine/encode.mjs` species-agnostic, 373 features; `net.mjs`;
  `train-value.mjs`) on ~17.6k league-wide self-play games over 3 rounds. It predicts winners well (~76% held out) but
  **lost every mirror vs the engine** (48.0, 49.0, 47.7%), so it is not used. Open options: a learned correction on top of
  the heuristic leaf, or an opponent model from public Showdown replays. (Stockkarp, stockkarp.com, inspired this; its
  terms forbid reverse engineering, so we build the publicly described ideas ourselves.)
- **Runner:** `node tools/sim/run.mjs --ours <id|list|file> --theirs <list> --games N --seed S --out f.jsonl` with
  `--sheets closed`, `--ours-ai/--theirs-ai engine`, `--preview ai|guide|explore|<table.json>`, `--beliefs usage`
  (closed-sheet beliefs from ladder usage, for any opponent). Game i uses seed S + i in every run, so runs are paired.
  Resumable (same `--out` skips finished games).
- **Preview fitting:** `--preview explore` (seed A) → `docs/research/strategy/sim/scripts/fit-previews.mjs` → validate
  `--preview <table.json>` on seed B.
- **Watch any game:** `node tools/sim/viewer.mjs` → http://127.0.0.1:4700 (Showdown's replay player; games replay
  exactly from their seed).
- **League teams:** `tools/sim/league-teams.mjs` builds 80 validated sixes from every coach's drafted roster
  (`tools/sim/candidates/league/<seat>-<n>.txt`), for self-play and generalization checks.
- Per-opponent candidate pools: `tools/sim/candidates/zhuzi.json`, `calvin/`, `zhuzi-vs-calvin/`.

## 5. Where each match stands

### Anthony's roster
Charizard (Mega Y), Sinistcha, Pelipper, Kangaskhan, Aegislash, Morpeko, Conkeldurr, Rotom-Fan, Stunfisk-Galar, Simipour.

### Week 1 vs Calvin (seat 8): lost 0–2
Game 1 misplays; game 2 Tauros (Sheer Force Rock Slide) double-KO'd Charizard and Rotom-Fan. Plan:
`match-calvin.md`. Calvin's core: Mega Staraptor Tailwind, Grimmsnarl, Volcarona, Basculegion-F, Mamoswine, Tauros.

### Week 3 vs ZhuZi (seat 3): prep done, live in the app guide (`lib/guides/5v3.mjs`)
- ZhuZi's 10: Metagross, Dragapult, Rotom-Wash, Oranguru, Krookodile, Infernape, Florges, Toxtricity, Slowking-G, Umbreon.
- **Bring "c1":** Mega Charizard Y (Modest 32 HP / 32 SpA / 2 SpD: Heat Wave, Weather Ball, Solar Beam, Protect);
  Aegislash (Kasib, Brave: Poltergeist, Shadow Sneak, King's Shield, Wide Guard); Kangaskhan (Silk Scarf, Scrappy,
  Adamant: Fake Out, Double-Edge, Sucker Punch, Protect); Morpeko (sixth slot, never brought; Stunfisk-Galar ties);
  Sinistcha (Bold Sitrus: Matcha Gotcha, Rage Powder, Trick Room, Life Dew); **Conkeldurr** (Life Orb Iron Fist Brave:
  Drain Punch, Mach Punch, Ice Punch, Protect) in place of Rotom-Fan.
- **Preview:** vs Metagross + Krookodile + Infernape lead Kangaskhan + Sinistcha (Trick Room first), Charizard +
  Conkeldurr behind. Vs Oranguru + Toxtricity or Slowking-G: Charizard + Kangaskhan. Vs Slowking-G + Umbreon: game 1
  Aegislash + Sinistcha; games 2–3 Aegislash + Kangaskhan with Charizard home. Vs Dragapult + Umbreon: Charizard +
  Kangaskhan, Conkeldurr + Sinistcha.
- **Evidence:** engine on both sides, closed sheets, 1,440 paired games each: c1 76.7%; vs c7 (Rotom-Fan) +9.3 ± 3.2;
  vs a17 +12.1 ± 3.2; c2 (Stunfisk) ties. Most-valuable choices: Sinistcha (−18 without it), Wide Guard (−10), Kangaskhan
  Protect (−8), Conkeldurr (+7). Most set details are ties; their reasons are calcs. Weak spots: bulky Umbreon / Taunt
  sixes (~53%). Full report: `docs/research/strategy/sim/zhuzi-sim-report.md`.

### Week 4 mock: Anthony pilots ZhuZi against Calvin (`lib/mocks/3v8.mjs`, method `mock-method.md` §5)
Anthony and Calvin run mocks for each other's next opponent. Mocks show the normal prep screens from the opponent's POV.
Sim-chosen ZhuZi teams vs Calvin's pool (engine both sides, 384 games each): **A** fast offense z21 86.5%, **B** rock
spam z18 84.0%, **C** Trick Room + Instruct z05 62.7% (his other real plan, the best practice for Calvin's Tailwind).
Correction found: Rock Slide is neutral on Mega Staraptor; Psychic Fangs is the answer. Committed b730d6e; **not yet
deployed** (as of 2026-10-28).

## 6. Delivering and shipping

- Guides: `lib/guides/<pov>v<opp>.mjs`, schema `guide-schema.md`. Mocks: `lib/mocks/`.
- Before shipping: `verify_curated.mjs`, `npm test` (build + tests), `node --test tools/sim/test/*.test.mjs`.
- The real app is branch **`prep-builder`** (worktree `.claude/worktrees/core-prep-research`); `main` is an unrelated old
  history: never merge or reset between them. Push to `prep-builder` only; never force-push.
- **Kuma deploys** the live site (https://drafarig-phone.qin2500.chatgpt.site) via the local Codex relay
  `codex:01a13bd6-3763-74f3-aa2e-550eda1f30fa` on the agent bridge. Send commit, hash of `dist/server/index.js` and a
  live check. The relay acts only when its chat is opened; if a deploy stalls, ask Anthony to nudge it.

## 7. Map of the research

`docs/research/strategy/`: `format-and-meta.md` (rules, meta), `draft-strategy.md`, `league-analysis.md` (every
coach's roster), `cores.md` (opponent cores and answers), `threat-scan.md`, `sp-assist/` (SP method, benchmarks, calc
tools), `match-*.md` (match plans), `mock-method.md`, `sim/` (sim reports and scripts), `HANDOFF.md` (the 2026-10-23
handoff), `sources.md`.

# Heuristic AI review: 5 annotated games (a01 vs z01, z03, z04, z07, z09)

2026-10-21. This is a VGC-player review of `tools/sim/logs/*.md`. Results in those 5 games: ours 1–4.

Each finding cites game and turn. They are ranked by how much they would **bias the big runs**: direction, and how often the
situation comes up.

## Ranked findings

| # | Category | What happens (evidence) | Bias | Fix |
|---|---|---|---|---|
| 1 | **Protect timing** | ZhuZi's side **double-Protects** very often: z04 T1, T3, T5; z09 T1, T3; z03 T4. Real players almost never Protect both mons with nothing set up (no Tailwind / TR, no Fake Out read on both). | **High.** It hands the other side free turns (free Mega and sun for Charizard, free Wide Guard / TR), so the opponent is too passive. That likely **inflates our win rate**, and it skews results toward whichever team gains most from tempo | Cap double-Protect at about 5–10% of turns, and only when **both** mons face a likely KO. Protect one and attack with the other otherwise. Track the double-Protect rate as a validation metric |
| 2 | **Last Resort legality** | Kangaskhan clicks Last Resort when it **fails** (Fake Out never used: flinched T1). Fails twice in a row in z01 T2 and T3, which wasted the mon | **High for the Kangaskhan question** (a01, a05 and the a14 ablation compare exactly this set). It undervalues the Fake Out / Last Resort set | Model the precondition: Last Resort fails unless every other move has been used since entry. If Fake Out is still usable (it can still be selected after a flinch? Check Champions' `activeMoveActions` rule), click it first. Never pick a move the engine will fail |
| 3 | **Preview / leads** | Our AI leads Charizard + Kangaskhan into Krookodile / Metagross teams (z01, z09) and in z01 didn't bring Aegislash at all. That's the exact line the guide warns against (Rock Slide 131–157% on Charizard; Aegislash Wide Guard is the answer). It brings by a softmax over 4-mon values that ignores the lead's turn-1 risk | **High.** Results then measure the AI's preview, not the team. It underrates Charizard and Aegislash | Score preview by the **lead pair's turn-1 outcome** (a short lookahead), not just 4-mon value. Hard rule: no Charizard lead into a visible spread Rock user without Wide Guard or Fake Out cover. Report runs under **two policies**: AI preview and guide preview (`lib/guides/5v3.mjs` `previews`) |
| 4 | **Stance Change awareness** | Aegislash attacks (Blade form) into a predicted double target: z07 T1 Poltergeist into Stomping Tantrum + Knock Off, dead. Picks **Wide Guard** against two single-target hits: z09 T5 Knock Off + Foul Play, dead. King's Shield was right both times | **Medium–High** against Aegislash (and every team that relies on it) | Its own model must use **Blade** defences on turns it attacks and **Shield** on King's Shield turns. Score Wide Guard only against spread moves. Score King's Shield as Protect (plus the contact Atk drop) |
| 5 | **Speed control / habit** | ZhuZi's TR teams set Trick Room late or not at all. In z04 Oranguru led from the back and set TR only on T8 (by noise). The z04 preview led Metagross + Krookodile, not a setter | **Medium–High** in our favour against the 5 TR-mode teams (about 22% of the weight) | See "Trick Room question" below: add a plan-commitment persona |
| 6 | **Targeting** | Targets a resisting mon (z03 T3 Rotom-Wash Thunderbolt into Sinistcha, Grass). Instruct repeats a single-target move whose target fainted and re-targets into an immune Aegislash (z04 T6 Sludge Bomb). The AI Instructs a single-target move rather than a spread move | **Low–Medium** | Instruct value = the partner's best **last** move, weighted toward spread moves (Overdrive / Boomburst). Penalise resisted / immune targets in the own-model |
| 7 | **Noise** | A noise switch moves the un-Mega'd Charizard lead out on T1 (z07 T1). Noise should be human-like, not random switching | **Low–Medium** | Restrict noise to plausible alternatives: second-best move, Protect, or a target swap. Make noise switches rare (≤ 2%) and never the Mega holder before it Mega Evolves |
| 8 | **Chilly Reception** | Not observed: z07 left Slowking-G home | Unknown | Add a position test: sun up + Slowking-G on field → Chilly Reception (snow) and switch. Then our Charizard re-entry to re-set sun |
| 9 | **Switching** | Good: a Choice-Scarf-locked Krookodile switches out (z01 T2), and Intimidate cycling (z01 T3). Their double targets are well chosen (z07 T4 Psychic Fangs + Knock Off into Sinistcha) | — | Keep |
| 10 | **Mega timing** | Good: both sides Mega Evolve on the first turn the holder is out (Metagross even while Protecting). | — | Keep |

**One correction to my candidates note** (`zhuzi-candidates.md` §3): **Instruct doesn't need Oranguru to move after its partner.**
Instruct makes the target reuse its *last* move, which can be from the previous turn. Ordering only matters for repeating the same
turn's move.

## The Trick Room question

The Developer's read is mathematically right. For ZhuZi's TR teams against a01, Trick Room only partly helps:

| Under Trick Room | Effect |
|---|---|
| **Helps** | Toxtricity (Quiet, 85) then moves before our Sinistcha 90, Rotom-Fan 106, Kangaskhan 110, Charizard 146 and Morpeko 163. Overdrive OHKOs Charizard ~70% of the time and 2HKOs most of ours. |
| **Hurts** | Mega Metagross (157) and Krookodile (118) move after our slower mons. Our Aegislash 72 already moves first. |
| **Plus** | Anthony brings his own TR (Sinistcha), which can cancel it |

**But a human who drafted two TR setters and an Instruct user plays TR as the plan:**
- He leads the setter, usually with Toxtricity.
- He sets it turn 1 out of habit.
- He re-sets it when it ends, whether or not the calc says it's marginal.

That is exactly how people under-adapt in draft leagues. It also matters for us: the TR lines are where Toxtricity's Overdrive does
its damage, and where our Sinistcha's TR cancels (or collides with) his.

**Recommendation:** add a **plan-commitment persona** to the opponent AI.
- **Who:** about **60%** of opponent players with a TR-archetype team (z04, z05, z15, z16, z23), and about **30%** with the hybrid z06.
- **Leads:** setter + its best abuser (Oranguru / Slowking-G + Toxtricity), unless the preview is clearly bad (e.g. our double Fake Out
  and Taunt).
- **Turn 1:** set Trick Room with ~0.8 probability when the setter is active and TR is down. Protect or Fake Out with the partner
  (Infernape in z15).
- **Re-set:** ~0.5 after TR ends. Never on top of their own TR.
- **Rest:** the other 40% keep the current calc-driven policy. Report results **per persona**, so we see how much a01 depends on ZhuZi
  actually playing his TR plan.

The same persona idea applies to other "plan" teams:
- **Anti-Charizard rock teams** (z03, z08, z18): lead the Rock Slide user.
- **Chilly Reception teams:** pivot on sun.

## Before the big runs (ranked)
1. Cap **double-Protect** and require a real KO threat on both mons.
2. Make **Last Resort** (and any move the engine will fail) illegal in the AI's choice set until its precondition holds.
3. **Preview by lead-pair turn-1 value**, plus the hard Charizard-vs-spread-Rock rule. Run both AI-preview and guide-preview policies.
4. **Aegislash form-aware** damage and King's Shield / Wide Guard scoring.
5. Add the **plan-commitment (habit TR) persona**: 60% of TR teams, 30% of the hybrid. Report per persona.
6. **Noise** restricted to plausible alternatives; no early switch of the Mega holder.
7. **Instruct** scoring toward spread moves; penalties for resisted / immune targets.
8. Add position tests for **Chilly Reception** and for **Wide Guard vs Rock Slide** with Charizard on the field.

Validation metrics to print with every batch:
- double-Protect rate;
- failed-move rate (Last Resort);
- TR set rate by persona;
- Wide Guard used vs spread threat present;
- Charizard lead rate into Rock users;
- Mega turn.

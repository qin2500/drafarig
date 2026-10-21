# Simulation candidates: ZhuZi's teams and Anthony's sixes (Week 3)

2026-10-21.
- **Data:** `tools/sim/candidates/zhuzi.json`, written by `docs/research/strategy/sp-assist/gen_candidates.py`. Rerun the script after any edit: it
  validates every set and rewrites the JSON.
- **Format:** Showdown export text per team (Level 50, Champions Stat Points on the EVs line), plus `weight` (sums to 1 per side),
  `why`, and the set keys.
- **Validation** (0 problems), all against `data/mechanics.json`:
  - Every species is legal and every ability is legal for it. A Mega lists its base ability; the stone gives the Mega's own.
  - Every move is in the Champions learnset, and every item is in the M-C item pool.
  - Item clause holds. Where two sets wanted the same item, the later one takes a fallback item, and the swap is written into `why`.
  - At most one Mega stone per team; SP ≤ 32 per stat and ≤ 66 total.

## 1. ZhuZi: 24 weighted teams

**Weight inputs** (judgement, stated):
1. **Draft cost** (what he paid = what he values): Metagross 20, Dragapult 15, Rotom-Wash 14, Oranguru 10, Krookodile 9, Infernape 7,
   Florges 7, Toxtricity 7, Galarian Slowking 6, Umbreon 5.
2. **Style:** a goodstuffs core (Mega Metagross, Dragapult, Rotom-Wash, Krookodile, Infernape's Fake Out). He also has two Trick Room
   setters (Oranguru with Instruct, Slowking-G), which reads as TR as a second mode, not his main plan.
3. **Ladder sets** as the default set for each mon (Smogon Reg M-C ≥ 1760, Sept). **Never a reason to drop a mon**: Florges, Umbreon and
   Slowking-G stay in with learnset-based sets.
4. **Anti-Anthony prep** (he sees our 10):
   - Rock moves for Charizard: Rock Slide Metagross, Life Orb Rock Slide / Stone Edge Krookodile, Power Gem Slowking-G.
   - Foul Play (Umbreon / Oranguru) for Aegislash and Kangaskhan.
   - Imprison / Taunt against Sinistcha's Trick Room.
   - Chilly Reception against our sun.
5. **Human variants:** comfort or suboptimal picks. Skipping the Mega (Scarf Metagross), physical Dragapult, leaving Krookodile or
   Toxtricity at home.

| Team | Weight | Archetype | Why the weight |
|---|---|---|---|
| z01 | 9.2% | Goodstuffs offense, ladder sets | His six most expensive attackers + Fake Out: the most likely single team |
| z02 | 7.1% | Same, Life Orb Toxtricity | Toxtricity's top ladder item (50%) |
| z03 | 7.1% | Anti-Charizard rocks | Obvious prep vs our Charizard |
| z04 | 7.1% | Trick Room + Instruct | Two TR setters drafted |
| z05 | 4.1% | TR + Instruct, Imprison | Prep vs Sinistcha |
| z06 | 6.1% | Hybrid (TR option inside offense) | Most realistic use of Oranguru |
| z07 | 4.1% | Chilly Reception pivot | Kills our sun |
| z08 | 6.1% | Full anti-Anthony prep | Rocks, Power Gem, Foul Play |
| z09 | 4.1% | Bulky Foul Play balance | Umbreon + Florges |
| z10 | 3.1% | Fairy / Fake Out balance | Florges comfort |
| z11 | 3.1% | Human: Scarf Metagross, no Mega | Suboptimal but common habit |
| z12 | 3.1% | Human: physical Dragapult | 10% of ladder Dragapult are Jolly |
| z13 | 4.1% | Life Orb Infernape offense | Overheat / Aura Sphere set |
| z14 | 3.1% | Scarf Rotom-Wash | 20% of ladder Rotom-Wash |
| z15 | 4.1% | TR + Fake Out | Infernape protects the TR turn |
| z16 | 3.1% | Oranguru + Florges support | Pollen Puff / Helping Hand |
| z17 | 3.1% | Anti-Sinistcha: Taunt + Imprison | Prep vs our TR |
| z18 | 3.1% | Rock spam | Every Rock option |
| z19 | 3.1% | Slowking + Dragapult special | Special-heavy |
| z20 | 3.1% | Balance with Taunt Umbreon | — |
| z21 | 2.0% | Human: no Krookodile | Forgets the Rock answer |
| z22 | 2.0% | Human: no Toxtricity | — |
| z23 | 3.1% | Full TR, both setters | — |
| z24 | 2.0% | Fast pressure | — |

**Resulting chance each mon is in his 6:**

| Mon | Chance |
|---|---|
| Metagross | 100% |
| Krookodile | 98% |
| Toxtricity | 95% |
| Dragapult | 79% |
| Rotom-Wash | 67% |
| Infernape | 59% |
| Slowking-G | 35% |
| Oranguru | 31% |
| Umbreon | 21% |
| Florges | 15% |

**Set library** (keys in the JSON):
- **Metagross:** `meta_mega` (ladder), `meta_mega_bulk`, `meta_mega_rock` (anti-Charizard), `meta_scarf` (human).
- **Rotom-Wash:** `rotomw`, `rotomw_scarf`.
- **Dragapult:** `pult`, `pult_sash`, `pult_phys` (human).
- **Krookodile:** `krook_scarf` (42% ladder), `krook_bulk`, `krook_lo` (anti-Charizard).
- **Infernape:** `nape`, `nape_lo`.
- **Slowking-G:** `king` (Trick Room + Chilly Reception), `king_gem` (Power Gem).
- **Florges:** `florges`, `florges_supp`.
- **Oranguru:** `oran` (Mental Herb), `oran_imp` (Imprison).
- **Toxtricity:** `tox`, `tox_scarf`, `tox_tr` (Quiet, Trick Room).
- **Umbreon:** `umb`, `umb_supp` (Taunt).

## 2. Anthony: 16 candidate sixes (a test plan, not a prediction)
`weight` on our side is a **test-priority** share (how many sims each gets), not a likelihood.

| Id | Six / variant | Tests |
|---|---|---|
| a01 | Guide / Week 1 six (Modest Charizard, Aegislash Metal Coat, Kangaskhan Fake Out / Last Resort, Morpeko, Sinistcha, Rotom-Fan) | Baseline |
| a02 | Stunfisk-Galar for Rotom-Fan | Electric immunity vs Toxtricity / Rotom-Wash |
| a03 | Timid Charizard | 167 Speed vs Modest power |
| a04 | Bulky Modest Charizard (20 HP / 14 Spe) | Survive Overdrive more often |
| a05 | Kangaskhan Fake Out / Double-Edge / Sucker Punch / Protect, Silk Scarf | Flexible set vs Last Resort |
| a06 | Aegislash Shadow Sneak + Kasib Berry | Priority vs Metal Coat Iron Head |
| a07 | Morpeko Parting Shot | vs Taunt |
| a08 | Bold Sitrus Sinistcha | Physical bulk |
| a09 | Conkeldurr for Sinistcha | No TR |
| a10 | Conkeldurr for Rotom-Fan | TR abuser |
| a11 | Pelipper (Tailwind / Wide Guard) for Sinistcha | Second Wide Guard + Tailwind (weather clash) |
| a12 | Simipour for Morpeko | Second Fake Out |
| a13 | Stunfisk + Conkeldurr TR back line | — |
| a14 | No Kangaskhan | Ablation |
| a15 | No Morpeko | Ablation |
| a16 | Timid Charizard + Stunfisk | Combined variant |

**Ablation plan:** compare each variant to a01 on win rate against the weighted ZhuZi distribution. Report the per-team breakdown so
we see *which* ZhuZi teams a change helps or hurts, not just the average.

## 3. Behaviours the AI players need (generic, encoded once)

**Team preview / bring 4:**
- Pick 4 by matchup value, not fixed: our guide's preview table is one policy.
- ZhuZi's side should sometimes bring "his usual 4" regardless of preview (human habit).

**Turn 1:**
- **Fake Out** (Infernape, Kangaskhan, Morpeko):
  - Only on the user's first turn out.
  - Never into Ghosts (except Scrappy Kangaskhan), or into Inner Focus targets (Oranguru, Umbreon).
  - Never into a side with Queenly Majesty / Armor Tail / Psychic Terrain.
  - Target: the biggest threat, or the Trick Room setter.
- **Trick Room:**
  - Set it when the opposing side is faster on average.
  - Don't re-set it while it's up (that cancels it), unless the opponent set it.
  - Count 5 turns including the set turn.
- **Tailwind** (Pelipper): 4 turns including the set turn. Don't set it under Trick Room.
- **Mega Evolve** on the first turn the Mega-stone holder is on the field.

**Protection and redirection:**
- **Wide Guard:** use it when the opposing side has an active spread move that would KO or heavily hurt a partner (Rock Slide into
  Charizard, Overdrive, Heat Wave, EQ). Don't use it two turns in a row (fail chance).
- **Protect patterns:** Protect the mon that would be KO'd and can't move first. Protect on the turn a Fake Out hits a partner.
  Never Protect twice in a row unless forced.
- **Rage Powder / Follow Me:** use it when the partner is set up or is the main attacker and in KO range. Note Rage Powder fails on
  Grass types and Overcoat.

**ZhuZi-specific patterns:**
- **Instruct:** Oranguru Instructs the partner's spread move (Toxtricity Overdrive / Boomburst). Order matters: Oranguru must move
  after the partner (Trick Room, or Speed).
- **Chilly Reception:** Slowking-G uses it when the opponent's sun is up or it wants to pivot. It sets snow and switches out.
- **Switching on weather:** Charizard switches out and back to re-set sun after snow. Drought only triggers on entry.

**Damage-aware choices:**
- **Foul Play:** don't attack with Aegislash (Blade form) into Umbreon / Oranguru when they can target it; use King's Shield instead.
- **Choice-locked mons:** respect the lock and the switch-out to reset it.
- **Last Resort:** Kangaskhan can only click it after Fake Out has been used.
- **Stance Change:** Aegislash is Blade after attacking and Shield after King's Shield. The AI should account for its defences in
  each form.

**Human noise:** a small random-move rate (5–10%) and occasional "safe" Protect / switch reads, so the sims don't assume a perfect
opponent.

## 4. ZhuZi replays
- **Public Showdown replays:** the replay search for user **"zhuzi"** returns 32 public replays, all **Gen 9 OU / National Dex singles**
  (Apr–May 2025). There are **no Champions / VGC / doubles** replays.
- **Not usable:** it can't be confirmed that this account is the same person, and the format is different. So **no tendencies were
  extracted**.
- **League sheet:** it holds only the Board and Drafts tabs, with no replay links. Searched only via the public replay API; nothing
  behind a login.
- **If Anthony learns ZhuZi's Showdown name,** rerun the search (`https://replay.pokemonshowdown.com/search.json?user=<name>`).

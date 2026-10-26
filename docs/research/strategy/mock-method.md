# Mock opponents: the method, plus the first mock (Jacky → Calvin)

2026-10-19.
- **Goal:** Anthony pilots *coach X's* strongest realistic team against Calvin in friendly mocks, so Calvin can practise the
  opponent he actually faces.
- **Calcs:** `sp-assist/spcalc.py`. It reproduces the app's damage-engine test cases exactly; 5 of the ZhuZi guide's calcs were re-checked through the app's own engine and matched.
  Script: `sp-assist/mock_jacky_calvin.py`.
- **Sets:**
  - Calvin's: Smogon Reg M-C ladder sets (≥ 1760, Sept), plus the worst case for Tauros (no ladder data: Sheer Force, Life Orb, Adamant).
  - X's: tuned to benchmarks against Calvin's 10. Each set says where it departs from the ladder default.
- **App data:** `lib/mocks/4v8.mjs`, in the format in §4.

---

## 1. Method: "the strongest realistic team X brings vs Y"

| Step | What | Computed / judgement |
|---|---|---|
| 1. X's archetype | Read X's draft: setters, speed control, weather / terrain, Fake Out, Megas. E.g. Jacky = Trick Room (Farigiraf, Mimikyu, Mr. Rime) + Torkoal sun + Mega Golisopod + Incineroar | Computed: roles and cores from `cores.json` detection. Label: judgement |
| 2. Value of each of X's 10 vs Y's 10 | For every X mon, both directions with the **full learnset worst case** (threat scan, `lib/threat-scan.mjs`). (a) OHKOs it lands on Y's mons (severity-weighted). (b) Hits from Y it survives / is OHKO'd by. (c) Speed vs Y under none / Tailwind / Trick Room | Computed |
| 3. Pick 6 | Maximise coverage of Y's likely 6: every Y mon has ≥ 2 OHKO answers on X's side, and no Y spread move OHKOs two of X's six. Constraints: **one Mega used per battle** (bring at most 2 Mega candidates), **species clause**, **item clause** (six different items), and X's archetype must stay intact (its setter + its payoff) | Computed search, then a judgement pass for archetype fidelity |
| 4. Sets | Start from the ladder set. Tune spreads to benchmarks vs Y (the cheapest SP to OHKO / survive / outspeed the relevant Y forms; `threshold.mjs`). Change moves or items where the matchup argues for it (e.g. Chople Berry on Incineroar vs Mega Staraptor's Close Combat). Mark each departure "matchup-tuned" | Computed benchmarks; judgement on item / move swaps |
| 5. Bring-4 + leads | Per Y's likely preview (Y's 6 ranked by draft cost × threat to X): best 4 and lead pair by turn-1 value (Fake Out, setters, spread damage), with T1–T3 lines | Judgement, using the computed calcs |
| 6. Variant | A second look that stays plausible for X (e.g. no Trick Room / different Mega), so Y sees more than one plan | Judgement |
| 7. Pilot notes | For a cold pilot: win condition, leads, 5 key calcs, what Y will try, "if he does X → do Y" | Judgement, from the calcs |

**Faithful vs strong:** keep X's draft identity (its setters and the reason it drafted them), then make the strongest version of it.
Don't add mons X didn't draft. Don't assume sets X could not run (legal learnset only).

## 2. First mock: Jacky's team vs Calvin (W2)

### Calvin's likely 6 vs Jacky (from the Week 1 plan + worst case)
Mega Staraptor, Grimmsnarl (Prankster screens), Volcarona (Rage Powder / Quiver Dance), Basculegion-F, Mamoswine, Tauros or Tsareena.
- **Tauros (Sheer Force) Rock Slide** is the one that beat us. Into this team it's 42–51% on Torkoal and 49–58% on Incineroar.
- The Scarf Final Gambit Staraptor set OHKOs Torkoal, Golisopod, Mr. Rime and Lycanroc. Farigiraf (227 HP) and Incineroar (202) survive it.

### Team A, main: Trick Room sun (Jacky's archetype)
```
Farigiraf @ Sitrus Berry
Ability: Armor Tail
Level: 50
EVs: 32 HP / 2 SpA / 32 SpD
Sassy Nature
- Trick Room
- Helping Hand
- Psychic
- Protect

Torkoal @ Charcoal
Ability: Drought
Level: 50
EVs: 32 HP / 32 SpA / 2 SpD
Quiet Nature
- Eruption
- Weather Ball
- Earth Power
- Protect

Incineroar @ Chople Berry
Ability: Intimidate
Level: 50
EVs: 32 HP / 14 Def / 20 SpD
Careful Nature
- Fake Out
- Parting Shot
- Flare Blitz
- Throat Chop

Golisopod @ Golisopite
Ability: Emergency Exit
Level: 50
EVs: 32 HP / 32 Atk / 2 SpD
Brave Nature
- Iron Head
- Liquidation
- First Impression
- Protect

Mr. Rime @ Twisted Spoon
Ability: Screen Cleaner
Level: 50
EVs: 32 HP / 2 Def / 32 SpA
Quiet Nature
- Fake Out
- Psychic
- Freeze-Dry
- Trick Room

Lycanroc-Midnight @ Life Orb
Ability: No Guard
Level: 50
EVs: 32 HP / 32 Atk / 2 Def
Brave Nature
- Rock Slide
- Stone Edge
- Close Combat
- Protect
```

**Departures from the ladder (matchup-tuned):**
- **Incineroar Chople Berry** (ladder: Sitrus 63%): Mega Staraptor's Close Combat then does 52–61%.
- **Mr. Rime: Screen Cleaner** wipes Grimmsnarl's screens on entry. **Psychic** OHKOs Mega Staraptor (102–121%).
- **Lycanroc Brave, 0 Speed** for Trick Room. No Guard Rock Slide OHKOs Volcarona (124–149%).
- **Golisopod Brave, 0 Speed** (ladder Adamant).

**Speed under Trick Room** (slow first): Torkoal 36 → Mega Golisopod 54 → Farigiraf 72 → Incineroar 80 (= Calvin's Grimmsnarl / Empoleon 80) →
Mr. Rime 81 → Lycanroc 91 → all of Calvin's attackers (Volcarona 120+, Mega Staraptor 178 last).

### Team B, variant: no Trick Room (fast sun offense)
```
Incineroar @ Chople Berry
Ability: Intimidate
Level: 50
EVs: 32 HP / 14 Def / 20 SpD
Careful Nature
- Fake Out
- Parting Shot
- Flare Blitz
- Throat Chop

Torkoal @ Charcoal
Ability: Drought
Level: 50
EVs: 32 HP / 32 SpA / 2 SpD
Quiet Nature
- Eruption
- Weather Ball
- Earth Power
- Protect

Rotom-Mow @ Choice Scarf
Ability: Levitate
Level: 50
EVs: 2 HP / 32 SpA / 32 Spe
Timid Nature
- Leaf Storm
- Thunderbolt
- Volt Switch
- Electroweb

Lycanroc-Midnight @ Focus Sash
Ability: No Guard
Level: 50
EVs: 2 HP / 32 Atk / 32 Spe
Adamant Nature
- Rock Slide
- Stone Edge
- Close Combat
- Protect

Mimikyu @ Life Orb
Ability: Disguise
Level: 50
EVs: 2 HP / 32 Atk / 32 Spe
Adamant Nature
- Play Rough
- Shadow Sneak
- Trick Room
- Protect

Golisopod @ Golisopite
Ability: Emergency Exit
Level: 50
EVs: 32 HP / 32 Atk / 2 SpD
Brave Nature
- Iron Head
- Liquidation
- First Impression
- Protect
```
- **Rotom-Mow (Scarf, 151 Spe):** Leaf Storm OHKOs Basculegion-F (123–146%) and Mamoswine (154–183%). Thunderbolt OHKOs Scarf Staraptor (104–123%).
- **Mimikyu (Life Orb, 148 Spe):** Play Rough does 92–109% to Mega Staraptor (50% OHKO; any chip makes it sure). Disguise eats Brave Bird, and Trick Room is a back-up plan.
- **Lycanroc (Sash, 134 Spe):** Rock Slide 96–115% on bulky Volcarona; Sash survives Mega Staraptor's Close Combat once.

### Pilot notes (Anthony playing Jacky)

**How it wins (Team A):** set Trick Room, then Torkoal Eruption in sun and Golisopod / Lycanroc hit first for 4 turns. Calvin's fast
team moves last. Eruption OHKOs Mamoswine / Tsareena / Tauros, but **not Mega Staraptor** (79–94%). Mr. Rime Psychic (OHKO) or
Eruption + a second hit takes it.

**Leads:**
- **Farigiraf + Incineroar** (default). T1: Incineroar **Fake Out** his biggest threat (or Grimmsnarl to stop screens), Farigiraf
  **Trick Room**. Armor Tail blocks his Fake Out and his Prankster moves on our side.
- **Mr. Rime + Torkoal** vs Grimmsnarl leads: Screen Cleaner wipes the screens on entry. T1: Mr. Rime Fake Out a partner, Torkoal **Protect**.
  T2: Mr. Rime Trick Room, then Eruption.
- **Back:** Torkoal, Golisopod (Mega on its first turn), Lycanroc.

**5 key calcs** (our set → his ladder set):

| # | Calc | Damage | Result |
|---|---|---|---|
| 1 | Torkoal Eruption (sun, spread) → Mamoswine / Tsareena / Tauros | 228–270% / 193–230% / 125–148% | OHKO |
| 1b | Torkoal Eruption → Mega Staraptor | 79–94% | **No OHKO**: pair it with Mr. Rime Psychic or a Golisopod Iron Head (58–68%) the same turn |
| 2 | Lycanroc Rock Slide → Volcarona (bulky / Modest) | 124–149% / 167–198% | OHKO |
| 3 | Mega Golisopod Iron Head → Grimmsnarl | 125–147% (83–98% into Reflect) | OHKO without Reflect |
| 4 | Mr. Rime Psychic → Mega Staraptor | 102–121% | OHKO |
| 5 | His Mega Staraptor Close Combat → Incineroar (Chople) / Farigiraf / Torkoal | 52–61% / 63–75% / 46–55% | All survive |

**What Calvin will try:**
- Tailwind + screens + Mega Staraptor.
- Volcarona Heat Wave / Overheat **in our own sun**: Overheat OHKOs Mega Golisopod (299–356%; Fire is 4x) and Mr. Rime.
- Mamoswine High Horsepower on Torkoal (98–119%) / Incineroar (112–133%).
- Tauros Rock Slide.

**If he does X → do Y:**

| If he… | Do |
|---|---|
| Leads Grimmsnarl | Fake Out Grimmsnarl T1, or bring Mr. Rime (Screen Cleaner) |
| Tailwinds T1 | Trick Room the same turn: his doubled Speed moves last |
| Brings Volcarona | **Don't Mega Golisopod in front of it while sun is up.** Lycanroc Rock Slide it first |
| Taunts Farigiraf (non-Prankster) | Mr. Rime is the back-up Trick Room |
| His Staraptor doesn't Mega and moves first (Scarf) | Final Gambit incoming: Protect the target, or keep Farigiraf / Incineroar in front (they survive 192) |
| Mamoswine is in | Torkoal Eruption OHKOs it (228–270%); keep Torkoal's partner able to Protect |

**Team B pilot (no Trick Room):** lead Incineroar + Rotom-Mow.
- Fake Out the scariest target and Scarf Leaf Storm Basculegion-F / Mamoswine.
- Lycanroc Rock Slides Volcarona; Mimikyu Play Rough handles Mega Staraptor.

### W4 outline: ZhuZi's team vs Calvin
- **ZhuZi's archetype:**
  - Mega Metagross + Dragapult + Rotom-Wash offense.
  - Trick Room / Instruct support (Oranguru, Galarian Slowking).
  - Toxtricity Punk Rock and Krookodile Intimidate.
- **Likely 6 vs Calvin (judgement):** Mega Metagross (Psychic Fangs vs Staraptor and Tsareena; Iron Head vs Grimmsnarl), Rotom-Wash
  (Will-O-Wisp vs Staraptor; Hydro Pump vs Volcarona and Mamoswine), Krookodile (Intimidate; Rock Slide vs Volcarona and Staraptor),
  Toxtricity (Overdrive vs Basculegion-F and Staraptor), Dragapult, Oranguru (Trick Room vs Calvin's Tailwind).
- **To compute next:** the same steps 2–5 with `mock_*.py`, and Calvin's worst cases into these six (Tauros Rock Slide is neutral on most
  of them; Volcarona Fire is the threat to Mega Metagross).

## 3. Assumptions
- Calvin's sets are ladder defaults plus a Tauros worst case.
- Mega Staraptor is the Jolly 2/32 set in the attacking calcs and the 29/1/4 set when it's the target.
- Doubles, spread ×0.75, no crits or accuracy (No Guard makes Rock Slide / Stone Edge never miss).
- Incineroar has no Knock Off in Champions (verified in `mechanics.json`), so Throat Chop is used instead.

## 4. Mock file format (for the app): `lib/mocks/<xSeat>v<ySeat>.mjs`
```js
export default {
  version: 1, coach: 'Jacky', seat: 4, vs: 'Calvin', vsSeat: 8, week: 2, written: '2026-10-19',
  rosters: { x: [ids], y: [ids] },                 // sheet rosters when written (stale detection, as guides)
  archetype: '…',                                  // X's plan in one line
  assumptions: ['…'],
  team: '<Showdown export, Champions SP on EVs line>',
  departures: [{ mon: id, what: '…', why: '…' }],  // where the sets differ from ladder ("matchup-tuned")
  variants: [{ name: '…', team: '<export>', note: '…' }],
  pilotNotes: { wins: '…', leads: [{ ours: [id, id], t1: '…', t2: '…', note: '…' }], back: [ids],
                theyTry: ['…'], ifThen: [{ if: '…', do: '…' }] },
  calcs: [/* same entry shape as guide calcs: attacker/defender {id, set:'mock'|'ladder'|'worst', ability, item, nature, sp}, move, field, range, verdict, why */],
  outline: [{ coach: 'ZhuZi', week: 4, note: '…' }],  // optional next mocks
};
```
The app can render this like a guide. The extra action: **"Import as a team: vs Calvin (Jacky mock)"**, so Anthony can export it to
Showdown and play it.

## 5. W4 mock (ZhuZi → Calvin), chosen by simulation (2026-10-26)

Steps 2–6 of §1 replaced by the simulator (`tools/sim`), so the teams come from games, not judgement:

1. **Calvin's pool** (`tools/sim/candidates/calvin/build.mjs`): his Week 1 core (Mega Staraptor Tailwind, Grimmsnarl, Volcarona,
   Basculegion-F, Mamoswine, worst-case Tauros) and 5 variations (Tsareena, Empoleon, Jolteon, Scarf Staraptor), ladder-usage
   sets, plus 4 usage-random sixes from his roster (`league/8-*`).
2. **ZhuZi's candidates:** his 24 Week 3 candidates plus 5 Calvin-targeted sixes (`zhuzi-vs-calvin/zc-*`), all from his 10.
3. **Screen:** 192 games each with the heuristic AI, closed sheets with usage-based beliefs (`results/mock-calvin/screen`).
   The Calvin-targeted sixes ranked mid-pack (59–70%): bulky Intimidate and Taunt cost more than they gained.
4. **Confirm:** the top 6 with the depth-2 engine on both sides, 384 games each (`results/mock-calvin/engine`):

| Six | Plan | Win % vs Calvin's pool |
|---|---|---|
| z21 | Fast offense: Mega Metagross, Fake Out Infernape, Scarf Toxtricity, Dragapult, Florges, Rotom-Wash | **86.5 ± 3.9** (team A) |
| z18 | Rock spam: Rock Slide Metagross, Scarf Krookodile, Slowking-G Power Gem | **84.0 ± 3.9** (team B) |
| z01 | Goodstuffs | 76.8 ± 4.6 |
| z13 | Offense, Life Orb Infernape | 74.1 ± 4.6 |
| z07 | Snow / Chilly Reception pivot | 71.7 ± 4.9 |
| z05 | Trick Room + Instruct | **62.7 ± 5.1** (team C: ZhuZi's other real plan, the best practice vs Calvin's Tailwind) |

5. **Leads** from the engine games (our preview spread over the AI's top options): A Infernape + Metagross 95% (n = 60),
   Dragapult + Infernape 93%; B Krookodile + Infernape 88%, Dragapult + Infernape 95%; C Metagross + Oranguru 79%.
6. **Calcs:** 18, all computed in the app engine. One correction to the old W4 outline: Rock Slide is **neutral** on Mega
   Staraptor (Fighting resists Rock; Scarf Krookodile 18–22%), so Psychic Fangs (127–152%, OHKO) is the answer to it.

App data: `lib/mocks/3v8.mjs` (team A + variants B and C). Watch any sim game in the viewer (`node tools/sim/viewer.mjs`,
run `mock-calvin/engine/<six>.jsonl`).

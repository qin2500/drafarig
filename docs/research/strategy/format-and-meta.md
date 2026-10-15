# Format & Meta — Pokémon Champions VGC, Regulation Set M-C

Prepared by: Drafarig VGC Strategy (research agent). Data accessed 2026-10-02 unless noted.
Status markers: **VERIFIED** = confirmed by 2+ independent sources or by the Pokémon Showdown
simulator source code for the Champions mod; **UNVERIFIED** = single source or inferred.

---

## 1. What "regulation MC" is

| Item | Value | Status |
|---|---|---|
| Game | **Pokémon Champions** (Nintendo Switch + mobile; battle-only game, launched 2026-04-07/08) | VERIFIED (Serebii, Victory Road, Wikipedia) |
| Ruleset | **Regulation Set M-C** ("M" = Mega era; third Champions ruleset after M-A and M-B) | VERIFIED |
| Dates | **2026-09-09 → 2026-12-02** (game8: starts 02:00 UTC 9 Sep, ends 05:59 UTC 2 Dec) | VERIFIED (Serebii, Victory Road, game8, metaVGC) |
| Previous sets | M-A: 2026-04-08 → 06-17. M-B: 06-17 → 09-09 (used for 2026 Worlds) | VERIFIED |
| Showdown format | `[Gen 9 Champions] VGC 2026 Reg M-C` (Bo1, open team sheets) and `... (Bo3)`; draft leagues can use `[Gen 9 Champions] 4v4 Doubles Draft` (Flat Rules + VGC Timer, no roster legality beyond Champions availability) | VERIFIED (Showdown `config/formats.ts`) |
| Official events | Ranked Battles Season(s) 3+ in-game; VGC events incl. 2027 Latin America International Championships (São Paulo) | VERIFIED-ish (metaVGC) |

## 2. Battle rules (doubles)

- **Double Battle, bring 6, pick 4** (team preview, then choose 4). VERIFIED (Victory Road, metaVGC, Showdown `Flat Rules` "Picked Team Size = Auto").
- **Level 50 flat** — every Pokémon auto-set to Lv 50. VERIFIED.
- **Species Clause** — no two Pokémon with the same National Dex number (so only ONE Rotom form, one Tauros form, one Indeedee, one Basculegion, one Lycanroc, one Meowstic, one Ninetales, one Raichu, etc. per team). VERIFIED.
- **Item Clause** — no two Pokémon may hold the same item. VERIFIED.
- **No Restricted / Mythical** Pokémon — in practice there are none in the Champions pool anyway. No additional species bans. VERIFIED.
- **Timers**: Team preview 90 s · turn 45 s · player total ("Your Time") 7 min · game time 20 min. VERIFIED.
- **Open team sheets** in TPCi events (teams exchanged at match start); Showdown Bo1 ladder has Open Team Sheets option. VERIFIED.
- Swiss can be Bo1 or Bo3; top cut always Bo3 (official events). VERIFIED (Victory Road).

### Draft-league note
Anthony's league is a private draft; the league's own rules override anything above. Things to CONFIRM WITH THE LEAGUE (open questions):
1. Bo1 or Bo3 per weekly match? 2. Played in Champions itself or on Showdown? 3. Item clause on? (Showdown's generic `Standard Draft` ruleset *disables* item clause; the `4v4 Doubles Draft` Champions format keeps it.) 4. Are trades/free agency allowed? 5. How many picks exactly (looks like 10)?
League rule confirmed by Anthony: **drafting a Pokémon includes all of its Mega forms at no extra cost** (Charizard = Charizard + Mega X + Mega Y).

## 3. Gimmicks: what exists and what doesn't

| Mechanic | In M-C? | Notes |
|---|---|---|
| **Mega Evolution** | **YES — the format gimmick** | **Max ONE Mega Evolution per battle.** You may bring several Mega Stone holders (it hides which one will Mega), but only one can evolve. Mega Stone occupies the held-item slot, so a Mega gets no other item. Item clause also means two holders need two different stones anyway. Mega forms persist after fainting (relevant for Last Respects / revival). VERIFIED (game8 rules page, GameSpot/Operation Sports Mega guides, Showdown Champions scripts) |
| Terastallization | **NO** | Showdown Champions mod `canTerastallize() → null`. VERIFIED |
| Dynamax / Gigantamax | NO | VERIFIED |
| Z-Moves | NO (note: "Mega X **Z**" forms such as Mega Garchomp Z are just alternate Megas from Legends Z-A, not Z-Moves) | VERIFIED |

### Mega rules and what they mean for drafting
- Because only one Mega happens per game, a roster with 4 Mega-capable mons does NOT get 4 Megas worth of value per game — it gets **flexibility at team preview** (choose which Mega fits the matchup) plus **bluff value** (opponent can't tell which one evolves).
- But every Mega-stone holder that does NOT mega in a given game is playing *without an item*-equivalent (it is holding a useless stone) — so in practice teams bring 1–2 stone holders, not 4.
- In this league Megas are free with the base pick, so the **real value of a Mega-capable mon = max(base form value, mega form value)**, plus small extra value when the mon has two Megas (Charizard X/Y, Raichu X/Y, Garchomp/Garchomp-Z, Lucario/Lucario-Z, Absol/Absol-Z).
- Roster implication: you want **1 primary Mega + 1 backup Mega** and the rest strong *non-Mega* Pokémon that use real items (Sitrus, Focus Sash, Choice Scarf, Life Orb, Leftovers, resist berries...). Drafting a 3rd/4th Mega-reliant mon is usually wasted points.

**Legal Megas in M-C (80 per Showdown Champions data):** Venusaur, Charizard X, Charizard Y, Blastoise, Beedrill, Pidgeot, Raichu X, Raichu Y, Clefable, Alakazam, Victreebel, Slowbro, Gengar, Kangaskhan, Starmie, Pinsir, Gyarados, Aerodactyl, Dragonite, Meganium, Feraligatr, Ampharos, Steelix, Scizor, Heracross, Skarmory, Houndoom, Tyranitar, Sceptile, Blaziken, Swampert, Gardevoir, Sableye, Mawile, Aggron, Medicham, Manectric, Sharpedo, Camerupt, Altaria, Banette, Chimecho, Absol, Absol Z, Glalie, Salamence, Metagross, Staraptor, Lopunny, Garchomp, Garchomp Z, Lucario, Lucario Z, Abomasnow, Gallade, Froslass, Emboar, Excadrill, Audino, Scolipede, Scrafty, Eelektross, Chandelure, Golurk, Chesnaught, Delphox, Greninja, Pyroar, Floette (Eternal Flower), Malamar, Barbaracle, Dragalge, Hawlucha, Crabominable, Golisopod, Drampa, Falinks, Scovillain, Glimmora, Baxcalibur.
(Source: Showdown `data/pokedex.ts` + `data/mods/champions/formats-data.ts` + `items.ts`; counts reconcile with 59 at M-A launch + 16 in M-B (incl. Champions-original Raichu X/Y) + 6 in M-C ≈ 80–81.)
**New in M-C**: Mega Absol Z (Sharpness), Mega Garchomp Z (Levitate), Mega Lucario Z (Aura Guard), Mega Salamence (Aerilate), Mega Golisopod (Tough Claws), Mega Baxcalibur (Thermal Exchange). VERIFIED (Serebii, metaVGC, Victory Road).

Champions-original / Z-A Mega abilities worth knowing (Showdown ability text):
- Dragonize (Mega Feraligatr): Normal moves → Dragon, ×1.2.
- Eelevate (Mega Eelektross): Ground immunity; +1 highest stat on KO.
- Fire Mane (Mega Pyroar): ×1.5 offensive stat for Fire moves.
- Mega Sol (Mega Meganium): its moves act as if Sun is up.
- Piercing Drill (Mega Excadrill): contact moves hit through Protect for 1/4 damage.
- Spicy Spray (Mega Scovillain): attacker that hits it is burned.
- Aura Guard (Mega Lucario Z): takes 1/2 damage from contact moves.
- Sharpness (Mega Absol Z): slicing moves ×1.5.
- Thermal Exchange (Mega Baxcalibur): +1 Atk when hit by Fire; can't be burned.
- Fairy Aura (Mega Floette): all Fairy moves ×1.33 while active.
- Innards Out (Mega Victreebel), Stalwart (Mega Skarmory), Unseen Fist (Mega Golurk; Champions version: contact moves bypass Protect), Berserk (Mega Drampa), Tough Claws (Mega Golisopod/Barbaracle), Contrary (Mega Staraptor/Malamar), Huge Power (Mega Starmie), Snow Warning (Mega Froslass), Levitate (Mega Delphox/Chimecho/Garchomp Z), Mold Breaker (Mega Emboar), Bulletproof (Mega Chesnaught), Trace (Mega Meowstic/Gardevoir), Infiltrator (Mega Chandelure), Protean (Mega Greninja), No Guard (Mega Raichu Y/Hawlucha), Electric Surge (Mega Raichu X), Regenerator (Mega Dragalge), Iron Fist (Mega Crabominable), Defiant (Mega Falinks), Adaptability (Mega Glimmora), Shell Armor (Mega Scolipede), Intimidate (Mega Scrafty), Multiscale (Mega Dragonite).

## 4. Mechanic changes vs Scarlet/Violet (VERIFIED in Showdown Champions mod unless marked)

**Stats ("Stat Points" replace EVs/IVs)**
- All IVs are fixed at 31. EVs replaced by **Stat Points (SP): max 32 per stat, 66 total**. 1 SP = +1 stat at Lv 50 (≈ 8 EVs). VERIFIED (Showdown statModify: stat = base + SP + 20; HP = base + SP + 75; Champdex/theclick guides).
- Practical: you can max two stats (64) + 2 spare. Natures still ×1.1/×0.9.
- **Speed at Lv 50**: min = base+20 (×0.9 with −Spe nature), neutral max = base+52, positive max = floor((base+52)×1.1).

**Status nerfs**
- Paralysis: full-para chance **1/8** (was 1/4). Speed halving unchanged.
- Sleep: lasts **2 or 3 turns** (1/3 wake on turn 2) — no more 4-turn sleeps.
- Freeze: **25% thaw per turn, guaranteed thaw after 3 turns**.
- Sleep Moves Clause applies on the ranked/VGC Showdown standard (not in VGC Flat Rules — UNVERIFIED for in-game ranked).

**Moves (selected; full list in Showdown `data/mods/champions/moves.ts`)**
- **Protect / Detect-style moves have 5 base PP** (Protect, Spiky Shield, Baneful Bunker, King's Shield, Obstruct); max PP in Champions = (pp/5+1)×4 → 8 Protects.
- **Fake Out**: becomes *unselectable* after the user's first action (no more "click Fake Out and it fails").
- **Make It Rain**: 95% accuracy, **−2 SpA** (was −1). Big Gholdengo nerf.
- **Dire Claw**: status chance 30% (was 50%). Sneasler nerf.
- **Moonblast**: SpA-drop chance 10% (was 30%). **Iron Head** flinch 20% (was 30%).
- **Freeze-Dry** no longer freezes.
- Buffs: Psyshield Bash 90, Mountain Gale 120, Trop Kick 85, Spirit Shackle 90, Fire Lash 90, Apple Acid/Grav Apple 90, Anchor Shot 90, Infernal Parade 65, Slash 80, Crabhammer 95% acc, Syrup Bomb 90% acc, Clangorous Soul never misses, Toxic Thread −2 Spe, Snap Trap now Steel, King's Shield returns.
- **Milk Drink can target an ally**.
- Unavailable: Tera Blast, Ruination, Bleakwind/Sandsear/Springtide/Wildbolt Storm, Teleport, Burning Bulwark, Strange Steam, Thunderclap, Victory Dance, Doodle, Jungle Healing, plus ~180 others marked "Past".
- Still available (key VGC tools): Fake Out, Tailwind, Trick Room, Follow Me, Rage Powder, Helping Hand, Icy Wind, Electroweb, Wide Guard, Quick Guard, Parting Shot, Spore, Will-O-Wisp, Thunder Wave, Taunt, Encore, Reflect/Light Screen/Aurora Veil, Perish Song, Snarl, U-turn/Volt Switch/Flip Turn, Knock Off, Last Respects, Dire Claw, Make It Rain, Shed Tail, Revival Blessing, Coaching, Pollen Puff, Life Dew, Matcha Gotcha, Expanding Force, Grassy Glide, Extreme Speed, Sucker Punch, all weather/terrain moves.

**Abilities changed in Champions**: Regenerator/Natural Cure trigger normally; Healer 50%; Emergency Exit/Wimp Out switch logic changed; Unseen Fist reworked (see above); Run Away escapes trapping.

**Items** — legal pool is **166 held items** (Showdown Champions items list).
- **NOT available**: Choice Band, Choice Specs, Assault Vest, Safety Goggles, Covert Cloak, Clear Amulet, Loaded Dice, Power Herb, Booster Energy, Throat Spray, Weakness Policy, Mirror Herb, Ability Shield, Eviolite. VERIFIED (Showdown items + Victory Road tweet + games.gg).
- **Available**: Choice Scarf (only Choice item → disproportionately strong), Life Orb (returned in M-B), Focus Sash, Sitrus/Lum/Leftovers, all resist berries, weather rocks (Damp/Heat/Smooth/Icy Rock), Light Clay, Expert Belt, Muscle Band, Wise Glasses, type-boost items (Charcoal, Mystic Water, Miracle Seed…), Scope Lens, Wide Lens, Zoom Lens, Quick Claw, King's Rock, Bright Powder, Mental Herb, White Herb, Shed Shell, Iron Ball, Big Root, Shell Bell, Metronome, Light Ball, Leek, all 80+ Mega Stones.
- **New in M-C**: Rocky Helmet, Air Balloon, Red Card, Eject Button, Binding Band, Normal Gem, Terrain Extender, Electric/Psychic/Misty/Grassy Seed, Leek. VERIFIED (Serebii M-C page).
- Consequence: no AV/Specs/Band → damage is lower and bulky support (Incineroar, Farigiraf, Sinistcha) lasts longer; terrain seeds (esp. **Grassy Seed** with Rillaboom, enabling Unburden Sneasler / +1 Def Gholdengo) are a new meta pillar.

## 5. Meta snapshot (as of 2026-09-30 → 10-02)

### Usage (Pikalytics, Reg M-C, accessed 2026-10-02)
1 Rillaboom 35.2% · 2 Sneasler 31.8% · 3 Incineroar 25.1% · 4 Golisopod 20.8% · 5 Salamence 20.8% · 6 Indeedee-F 20.3% · 7 Kingambit 20.1% · 8 Farigiraf 19.7% · 9 Basculegion 18.5% · 10 Garchomp 16.8% · 11 **Charizard 15.8%** (Charizardite **Y 96%**, Heat Wave/Protect/Weather Ball; partners Farigiraf 42%, Archaludon 39%, Grimmsnarl 37%) · 12 Gholdengo 15.1% · 13 Archaludon 15.0% · 14 **Pelipper 12.1%** · 15 Whimsicott 11.4% · 16 Milotic 11.2% · 17 Raichu 10.6% · 18 Sylveon 9.6% · 19 Politoed 9.6% · 20 Arcanine-Hisui 9.3% · 21 Staraptor 9.0% · 22 Grimmsnarl 9.0% · 23 Tyranitar 8.5% · 24 Gardevoir 7.7% · 25 **Sinistcha 7.4%**.
Most common cores: Rillaboom+Sneasler (23.8% of teams), Rillaboom+Mega Salamence (21.1%), Mega Salamence+Sneasler (19.8%); trio Rillaboom/Mence/Sneasler 12.6%.

### Tier lists (cross-check)
- **Stratadex (updated 2026-09-30)** S: Rillaboom, Sneasler, Incineroar, Floette-Eternal. A: Salamence, Golisopod, Farigiraf, Kingambit, Indeedee-F, Basculegion, Garchomp, Charizard, Archaludon, Gholdengo, Pelipper. B: Raichu, Milotic, Whimsicott, Politoed, Sylveon, Arcanine-Hisui, Tyranitar, Staraptor, Grimmsnarl, Gardevoir, Sinistcha, Torkoal, Excadrill, Volcarona, Armarouge.
- **ShowdownTier (Showdown ladder 09-17→10-01, 275k games)** S: Rillaboom. B: Sneasler, Incineroar, Salamence, Kingambit, Gholdengo, Raichu, Archaludon, Charizard, Arcanine-Hisui, Tyranitar. C: Indeedee-F, Garchomp, Farigiraf, Golisopod, Milotic, Basculegion, Pelipper, Volcarona, Indeedee-M, Gardevoir, Staraptor, Politoed, Excadrill, Sylveon, Floette-Eternal, Armarouge, Grimmsnarl, Kommo-o. D: Whimsicott, Metagross, Torkoal, Gengar, Corviknight, Froslass, Swampert, Primarina, Dragonite, Glimmora, Annihilape, Delphox, Venusaur, Aerodactyl, Ceruledge, Pawmot, Blastoise, Meowstic-F. E: Sinistcha, Lucario, A-Ninetales, Dragapult, Baxcalibur, Sableye, Hatterene, Blaziken, Maushold, Talonflame, Absol, Camerupt, Hydreigon, Mawile, Rotom-W, Alakazam, Grapploct, H-Typhlosion, Gallade, Espathra, Lopunny, Clefable, Sirfetch'd, Meganium, Pincurchin, Inteleon, Altaria, Tsareena, Scovillain, Aegislash, Vivillon, Mamoswine, Empoleon, Malamar.

### Recent tournament winners (Pikalytics tournaments page, accessed 2026-10-02)
- r/VGC M-C Kickoff Cup (09-09) — Ryan Loseto: Mega Salamence, Rillaboom, Sneasler, Arcanine-Hisui, Kingambit, Basculegion.
- Alpensee Tour #74 (09-10) — Mega Gengar, Snorlax, Incineroar, Scrafty, Dragonite, Rillaboom.
- Tenki's Cart Weekly #120 (137 players) — Mega Dragonite, Annihilape, Raichu (Mega Y), Gholdengo, Arcanine-Hisui, Rillaboom.
- Sitrus-Series #78 (128 players) — Gholdengo, Rillaboom, Milotic, Mega Raichu Y, Ceruledge, Mega Staraptor.
- London Corviknights Weekly 15 (64p, 10-01) — Mega Gardevoir, Indeedee, Mega Pyroar, Whimsicott, Kommo-o, Basculegion.
- Intimidators Challenge (53p, 10-01) — Mega Lucario Z, Mega Gardevoir, Indeedee, Kingambit, Arcanine-Hisui, Dragapult.
- Chadweezy95 Ep 22 (47p) — Gholdengo, Volcarona, Mega Garchomp Z, Incineroar, Rillaboom, Mega Raichu Y.
- Thursday Night Throwdown #4 (Bo3, 21p) — Mega Hawlucha, Incineroar, Snorlax, Mega Slowbro, Rillaboom, Sneasler.
- Torneo Kurami (10-01) — Incineroar, Rillaboom, Sneasler, Mega Salamence, Mega Floette, Milotic.
- Unova Champions League #14 (10-02) — Ceruledge, Milotic, Gholdengo, Rillaboom, Mega Raichu Y, Mega Staraptor.
Pattern: **Rillaboom on 9/10**; Gholdengo, Incineroar, Milotic, Mega Raichu Y, Arcanine-Hisui recur. Mega diversity is high (Salamence, Raichu Y, Gardevoir, Staraptor, Garchomp Z, Lucario Z, Gengar, Dragonite, Hawlucha, Floette).

(Section continues below with archetypes and speed tiers.)

## 6. Core archetypes in M-C (with representative pieces)

| Archetype | Setter / enabler | Typical abusers & partners | Beaten by |
|---|---|---|---|
| **Rillaboom goodstuffs** (most common) | Rillaboom (Grassy Surge, Fake Out, Grassy Glide) + Sneasler (Fake Out, Unburden + Grassy Seed) | Mega Salamence, Kingambit, Gholdengo (Grassy Seed), Incineroar, Basculegion, Arcanine-Hisui, Milotic | Fire/Flying spread (Mega Charizard Y), Ghost-types ignoring Fake Out, Intimidate + Will-O-Wisp, Psychic Terrain override |
| **Mega Salamence offense** (new M-C pillar) | Intimidate on entry → Mega Aerilate Double-Edge/Hyper Voice, Dragon Dance | Rillaboom, Sneasler, Kingambit, Gholdengo, Arcanine-Hisui | Mega Froslass, Fairy (Mega Floette), Kingambit, sand teams, Ice (Icy Wind/Freeze-Dry), Rock Slide |
| **Psychic spam** | Indeedee-F / Indeedee-M (Psychic Surge, Follow Me) | Mega Gardevoir, Armarouge, Mega Delphox, Hatterene, Espathra; Expanding Force | Dark types (Kingambit, Incineroar), Rillaboom terrain override, Gholdengo/Aegislash |
| **Trick Room** | Farigiraf (Armor Tail), Indeedee-F, Sinistcha, Hatterene, Armarouge, Mr. Rime, Oranguru, Slowbro | Mega Golisopod, Torkoal (Eruption), Mega Camerupt, Snorlax, Kingambit, Conkeldurr, Mega Tyranitar | Taunt/Imprison, double Fake Out, Prankster Taunt, Ghost/Dark damage on setters, stalling 4 turns |
| **Tailwind hyper offense** | Whimsicott (Prankster), Pelipper, Talonflame (Gale Wings), Corviknight, Dragonite, Hydreigon, Aerodactyl, Squawkabilly | Mega Floette, Mega Raichu Y, Mega Staraptor, Basculegion, Garchomp | Trick Room, priority, Icy Wind, Fake Out on setter, Wide Guard |
| **Sun** | Mega Charizard Y, Torkoal, Ninetales | Venusaur (Chlorophyll), Mega Meganium (Mega Sol), Leafeon/Victreebel, Heat Wave/Eruption users, Mega Pyroar | Rain/sand setters, Rock Slide, Water, Archaludon |
| **Rain** | Pelipper, Politoed | Mega Swampert (Swift Swim), Basculegion, Archaludon (instant Electro Shot), Golisopod, Rotom-Wash, Mega Blastoise | Grass (Rillaboom), Electric, opposing weather, Sinistcha |
| **Sun-Rain** (Lexicon, won 4000+ player Grand Champions Festival Encore, 2026-07-13/14) | Mega Charizard Y + Pelipper (Sitrus) | Grimmsnarl (Light Clay), Archaludon (Leftovers), Venusaur (Focus Sash), Basculegion (Choice Scarf) | Requires precise weather management; Electric attackers hit both setters |
| **Sand** | Mega Tyranitar, Hippowdon | Excadrill (Sand Rush/Mega Piercing Drill), Mega Salamence, Mega Garchomp Z, Sneasler | Water, Fighting, Grass, Intimidate |
| **Snow / Veil** | Mega Froslass, Alolan Ninetales (Aurora Veil), Abomasnow, Vanilluxe | Mega Baxcalibur, Blizzard users | Fire, Steel, Fighting, Rock |
| **Perish trap** | Mega Gengar (Shadow Tag) + Perish Song | Snorlax, Scrafty, Incineroar (won Alpensee Tour #74) | Ghost-types, Taunt, Fake Out, pressure before Mega |
| **Electric/terrain offense** | Mega Raichu X (Electric Surge), Pincurchin | Mega Raichu Y, Pawmot, Archaludon | Ground types, Lightning Rod, Grass |

Key Champions-specific meta facts:
- **Fake Out ecosystem**: Rillaboom, Sneasler, Incineroar, Pawmot, Infernape, Kangaskhan, Raichu, Scrafty, Tinkaton, Mega Lopunny etc. Ghost types (Gholdengo, Basculegion, Sinistcha, Ceruledge, Mega Gengar, Mega Froslass, Annihilape, Aegislash, Mega Absol Z) are prized for ignoring Fake Out.
- **Grassy Seed** (new in M-C) turns Rillaboom's terrain into a +1 Def / Unburden trigger — the reason Sneasler and Gholdengo got stronger.
- **No Assault Vest/Choice Band/Specs** keeps support mons alive longer; **Choice Scarf** is the only Choice item and is common on Basculegion, Typhlosion-H, Tyranitar.
- **Mega Speed**: Mega Evolution happens before moves on the turn it's used, and the new Speed is used that turn (standard Gen 7+ behaviour; UNVERIFIED specifically for Champions).

## 7. Speed tiers (Lv 50, Champions Stat Points)

Formula (VERIFIED from Showdown Champions mod): non-HP stat = base + SP + 20, then nature ×1.1/×0.9 (floored).
Max SP in one stat = 32. Tailwind ×2 (4 turns incl. set turn), paralysis ×0.5, Choice Scarf ×1.5, Trick Room reverses order (5 turns).

| Pokémon | Base | Min (−Spe, 0 SP) | Neutral 32 SP | +Spe 32 SP | +Spe ×2 Tailwind |
|---|---|---|---|---|---|
| Lucario-Mega-Z | 151 | 153 | 203 | 223 | 446 |
| Garchomp-Mega-Z | 151 | 153 | 203 | 223 | 446 |
| Absol-Mega-Z | 151 | 153 | 203 | 223 | 446 |
| Aerodactyl-Mega | 150 | 153 | 202 | 222 | 444 |
| Dragapult | 142 | 145 | 194 | 213 | 426 |
| Delphox-Mega | 134 | 138 | 186 | 204 | 408 |
| Raichu-Mega-Y | 130 | 135 | 182 | 200 | 400 |
| Gengar-Mega | 130 | 135 | 182 | 200 | 400 |
| Talonflame | 126 | 131 | 178 | 195 | 390 |
| Meowscarada | 123 | 128 | 175 | 192 | 384 |
| Sneasler | 120 | 126 | 172 | 189 | 378 |
| Salamence-Mega | 120 | 126 | 172 | 189 | 378 |
| Froslass-Mega | 120 | 126 | 172 | 189 | 378 |
| Whimsicott | 116 | 122 | 168 | 184 | 368 |
| Lucario-Mega | 112 | 118 | 164 | 180 | 360 |
| Maushold | 111 | 117 | 163 | 179 | 358 |
| Staraptor-Mega | 110 | 117 | 162 | 178 | 356 |
| Raichu-Mega-X | 110 | 117 | 162 | 178 | 356 |
| Metagross-Mega | 110 | 117 | 162 | 178 | 356 |
| Ninetales-Alola | 109 | 116 | 161 | 177 | 354 |
| Heliolisk | 109 | 116 | 161 | 177 | 354 |
| Pawmot | 105 | 112 | 157 | 172 | 344 |
| Excadrill-Mega | 103 | 110 | 155 | 170 | 340 |
| Garchomp | 102 | 109 | 154 | 169 | 338 |
| Floette-Mega | 102 | 109 | 154 | 169 | 338 |
| Volcarona | 100 | 108 | 152 | 167 | 334 |
| Kangaskhan-Mega | 100 | 108 | 152 | 167 | 334 |
| Gardevoir-Mega | 100 | 108 | 152 | 167 | 334 |
| Dragonite-Mega | 100 | 108 | 152 | 167 | 334 |
| Charizard-Mega-Y | 100 | 108 | 152 | 167 | 334 |
| Hydreigon | 98 | 106 | 150 | 165 | 330 |
| Gliscor | 95 | 103 | 147 | 161 | 322 |
| Tinkaton | 94 | 102 | 146 | 160 | 320 |
| Squawkabilly | 92 | 100 | 144 | 158 | 316 |
| Arcanine-Hisui | 90 | 99 | 142 | 156 | 312 |
| Rillaboom | 85 | 94 | 137 | 150 | 300 |
| Indeedee-F | 85 | 94 | 137 | 150 | 300 |
| Archaludon | 85 | 94 | 137 | 150 | 300 |
| Gholdengo | 84 | 93 | 136 | 149 | 298 |
| Milotic | 81 | 90 | 133 | 146 | 292 |
| Basculegion | 78 | 88 | 130 | 143 | 286 |
| Armarouge | 75 | 85 | 127 | 139 | 278 |
| Tyranitar-Mega | 71 | 81 | 123 | 135 | 270 |
| Sinistcha | 70 | 81 | 122 | 134 | 268 |
| Politoed | 70 | 81 | 122 | 134 | 268 |
| Pelipper | 65 | 76 | 117 | 128 | 256 |
| Incineroar | 60 | 72 | 112 | 123 | 246 |
| Farigiraf | 60 | 72 | 112 | 123 | 246 |
| Kingambit | 50 | 63 | 102 | 112 | 224 |
| Azumarill | 50 | 63 | 102 | 112 | 224 |
| Golisopod-Mega | 40 | 54 | 92 | 101 | 202 |
| Snorlax | 30 | 45 | 82 | 90 | 180 |
| Torkoal | 20 | 36 | 72 | 79 | 158 |

Benchmarks worth remembering:
- **Base 151 Z-Megas** (Garchomp-Z, Lucario-Z, Absol-Z) top the format at 223 with +Spe — only Tailwind/Trick Room/priority deal with them.
- **Mega Charizard Y / Mega Kangaskhan (base 100)**: 167 max, ties with Volcarona, Mega Gardevoir, Mega Dragonite; outsped by Garchomp (169 Jolly), Mega Floette (169), Sneasler/Mega Salamence (189), Mega Raichu Y (200).
- **Pelipper (65)**: 128 max — its Tailwind turn lets your 100-base Megas hit 334, above every non-Tailwind mon in the format.
- **Sinistcha (70)**: 81 min speed — not a great Trick Room *abuser*, it's the setter.
- Under Trick Room, Torkoal (36 min), Snorlax (45), Mega Golisopod (54), Kingambit (63) move first.

## 8. Open uncertainties (flagged)
- Pikalytics per-Pokémon usage is shown as whole-number percentages for most mons; win rates on low-usage mons come from tiny samples — don't over-read them.
- Whether Anthony's league plays Bo1 or Bo3, in-game or on Showdown, and whether item clause is enforced — UNVERIFIED (ask the league).
- Showdown's ruleset implementation is the main source for mechanics; Bulbapedia pages returned HTTP 403 to the fetcher, so cross-checks used Serebii, Victory Road, game8, metaVGC, pokemon.com and news sites instead.

# Data sources — Drafarig

All checks below were measured on 2026-10-02 (~23:20–23:40 UTC) with curl / Node 24 from this Mac. The scripts are in `scratch/`.

## 0. Format: confirmed

- The league's "regulation MC" is **Pokémon Champions VGC 2026 Regulation Set M-C**, in effect **9 Sep – 2 Dec 2026** (victoryroad.pro). Doubles, Level 50, Megas allowed (one per battle), no Mythical or Restricted Legendary Pokémon, Species and Item Clause. Compared with M-B it adds 29 Pokémon and 6 new Megas (Absol-Z, Salamence, Garchomp-Z, Lucario-Z, Golisopod, Baxcalibur).
- **Showdown format id: `gen9championsvgc2026regmc`** (Bo3: `gen9championsvgc2026regmcbo3`). Verified in `config/formats.ts` on Showdown master: `name: "[Gen 9 Champions] VGC 2026 Reg M-C", mod: 'champions', gameType: 'doubles', ruleset: ['Flat Rules', 'VGC Timer', 'Open Team Sheets']`.
- On master, mod `champions` = **M-C**; `championsregmb` = M-B (archived). A `[Gen 9 Champions] Draft` and a `4v4 Doubles Draft` format also exist (`gen9championsdraft`, `gen9champions4v4doublesdraft`).
- Champions stats: no IVs (always 31). EVs are replaced by **Stat Points (SP)**: 0–32 per stat, 66 total. Lv50 HP = base + SP + 75; other stats = (base + SP + 20) × nature (`data/mods/champions/scripts.ts`, and `@smogon/calc` `calcStatChampions`). Smogon spreads are written as `Jolly:2/32/0/0/0/32` (SP).

## 1. Species, forms, Megas, types, stats, abilities, legality

### Primary: Pokémon Showdown client data (`play.pokemonshowdown.com/data/`): recommended

| File | Size | Use |
|---|---|---|
| `pokedex.json` | 524 KB | all species and formes: `name, num, types, baseStats, abilities, weightkg, baseSpecies, forme, otherFormes, battleOnly, requiredItem (mega stone), tags` |
| `moves.json` | 261 KB | moves (type, category, BP, accuracy, priority, target, flags) |
| `teambuilder-tables.js` | 15.7 MB | `BattleTeambuilderTable.champions`: `learnsets` (258 species, Champions-specific), `items` (171, legal list with "Popular items"), `overrideTier`, `overrideMoveData` (289 Champions move changes), `overrideAbilityData` (6 new abilities: dragonize, eelevate, firemane, megasol, piercingdrill, spicyspray), `overrideItemData` (251) |
| `abilities.js`, `items.js`, `typechart.js`, `aliases.js`, `formats-data.js`, `learnsets.js` | small–3 MB | `exports.Battle*` CommonJS; aliases help with name matching |

- Headers: `access-control-allow-origin: *`, `cache-control: max-age=691200` (8 days), `last-modified: Fri, 02 Oct 2026 08:52` (rebuilt from master daily or close to it). **CORS-open**, but these are large, so download and preprocess server-side.
- The data is plain JSON or JS object literals, so there is no TypeScript parsing.

### Champions legality: Showdown master `data/mods/champions/*.ts`

- Raw: `https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/mods/champions/{formats-data,learnsets,items,moves,abilities,conditions,rulesets,scripts}.ts`
- `formats-data.ts`: 1361 entries; **349 have no `isNonstandard` = legal in M-C**. 1000 are `Past`, 9 are `Future` (Mega Heatran, Mega Darkrai, Mega Zygarde, Mega Magearna, Mega Zeraora, Mega Tatsugiri × 3 → coming in a later regulation), 2 `LGPE`, 1 `Custom`. Flat Rules also bans Mythical + Restricted Legendary (none of the 349 carry those tags).
- **Legality rule:** `legal(id) = !(fd[id] ?? fd[toID(dex[id].baseSpecies)]).isNonstandard`. Cosmetic formes such as Meowstic-F have no entry and inherit from the base species.
- **82 legal Megas** in M-C (match the forme with `/(^|-)Mega(-|$)/`, not `startsWith('Mega')`, or you miss **Meowstic-M-Mega** and **Meowstic-F-Mega**, whose formes are `M-Mega`/`F-Mega`), including Champions-new ones: Raichu-Mega-X/Y, Clefable, Victreebel, Starmie, Dragonite, Meganium, Feraligatr, Skarmory, Chimecho, Absol-Mega-Z, Froslass, Staraptor, Garchomp-Mega-Z, Lucario-Mega-Z, Emboar, Excadrill, Scolipede, Scrafty, Eelektross, Chandelure, Golurk, Chesnaught, Delphox, Greninja, Pyroar, Floette (from Floette-Eternal), Malamar, Barbaracle, Dragalge, Hawlucha, Crabominable, Golisopod, Drampa, Falinks, Scovillain, Baxcalibur, Glimmora.
- `data/mods/champions/` has **no `pokedex.ts`**, so base stats and types are the standard ones from `data/pokedex.ts`. `overrideSpeciesData` in the client table only toggles `isNonstandard`.
- `.ts` files that hold only data (formats-data, learnsets, items) load with a 5-line `new Function` loader (`scratch/load-ps-ts.mjs`). **`moves.ts`/`abilities.ts`/`scripts.ts` contain TS-typed functions and do not load that way.** Use the client's `overrideMoveData` / `overrideAbilityData` instead.
- `config/formats.ts` (master) confirms the format ids.

### Board coverage (from `scratch/name-map.mjs` and `scratch/species-megas.mjs`)

- 259 distinct sheet names → 257 species ids (`Rotom-wash`/`Rotom-Wash` and `Politoed`/`Politoad` collapse). **All 257 are M-C-legal.**
- **77 board species own 82 Megas, which is every legal Mega in M-C** (`legalMegasNotOnBoard: []`). Species with two Megas: Charizard (X, Y), Raichu (X, Y), Absol (Mega, Mega-Z), Garchomp (Mega, Mega-Z), Lucario (Mega, Mega-Z). Meowstic (M) → Meowstic-M-Mega and Meowstic-F → Meowstic-F-Mega (`battleOnly` decides which).
- **Mega ownership rule** (league: drafting a species includes all its Megas): a Mega belongs to `toID(mega.battleOnly || mega.baseSpecies)`. So Floette-Mega belongs to `floetteeternal`, Raichu-Mega-X/Y belong to `raichu` (not `raichualola`), and Slowbro-Mega belongs to `slowbro` (not `slowbrogalar`). Board "Floette" is mapped to `floetteeternal`, because plain Floette is `Past` (illegal) and only Floette-Eternal has the Mega.
- Output: `dev/species-megas.json` lists, per board species: `base` + `megas[]`, each with `{id, name, num, types, baseStats, bst, abilities, weightkg, tier, megaStone}`, plus an optional `altFormes[]` for legal non-Mega formes **not separately listed on the board**: Gourgeist Small/Large/Super (different stats), Toxtricity-Low-Key and Squawkabilly colours (different abilities), and cosmetic ones (Maushold-Four, Polteageist-Antique, Sinistcha-Masterpiece, Vivillon patterns). **Whether drafting the base includes these is a league ruling; Anthony should ask.** The likely answer is yes, as with Megas. Smogon usage lists `Gourgeist-Super` separately.
- **Cross-validated against @smogon/calc 0.12.0 gen 0 (Champions):** base stats and types match for all 338 comparable forms (339 total; calc names Aegislash differently). Two Mega abilities differ: **Hawlucha-Mega** (Showdown master: No Guard; calc: Limber) and **Skarmory-Mega** (Showdown master: Stalwart; calc: Keen Eye). Showdown master is newer (Oct 2 vs Sep 18 calc release), so prefer it. Flag both in the UI as "recently changed".

### npm packages: checked, versions on 2026-10-02

| Package | Version (published) | Champions? | Verdict |
|---|---|---|---|
| `@smogon/calc` | 0.12.0 (2026-09-18), MIT | **Yes**: `Generations.get(0)` = Champions, 359 species incl. Garchomp-Mega-Z / Floette-Mega / Absol-Mega-Z / Baxcalibur-Mega; SP stat formula; doubles spread. Verified: `32 Atk Garchomp Earthquake vs. 32 HP / 2 Def Incineroar: 138-164 (68.3 - 81.1%)` | **Use for damage calcs** (server or browser; it is ~1 MB) |
| `@pkmn/dex`, `@pkmn/data`, `@pkmn/sim`, `@pkmn/mods` | 0.10.11 (2026-06-18) | has `champions` + `championsregma`, i.e. **M-A/M-B era, stale for M-C** | Skip; use raw Showdown data instead |
| `pokemon-showdown` | 0.11.11 (2026-07-28) | `champions` + `championsregma` mods (M-B era) | Skip (stale, heavy, pulls in sqlite3) |
| `@pkmn/img` | 0.3.4 | sprite URL helper | Not needed; the URL scheme is trivial (below) |

### PokeAPI

- `https://pokeapi.co/api/v2/...` is CORS `*`, `max-age=86400`, free, no key. It does **not** know Champions legality, the SP system, or the Champions Megas, so it is **not suitable as the main source**.
- Useful bulk data: `https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species_names.csv` (language 12 = zh-Hans, 4 = zh-Hant). It was used to cross-check the sheet's Chinese names (27 of 259 differ, all of them nicknames or typos such as 地龙 for Garchomp or 草猫 for Meowscarada; the English mapping is correct in every case). It could also give a Chinese display name per species.
- Licence: BSD-style for code; Pokémon names are © Nintendo.

### Type chart

- `play.pokemonshowdown.com/data/typechart.js` (`BattleTypeChart`, damageTaken codes: 0 = neutral, 1 = weak, 2 = resist, 3 = immune), or `@smogon/calc` `gen.types`. Champions uses the standard 18-type chart.

## 2. Usage / meta data

### Smogon monthly stats: primary

- Index: `https://www.smogon.com/stats/` (latest **2026-09**, published 2026-10-01 14:40 UTC). It also has **M-C files for September** (M-C started Sep 9).
- Files for this format (cutoffs 0 / 1500 / 1630 / 1760):
  - `https://www.smogon.com/stats/2026-09/gen9championsvgc2026regmc-1760.txt`: usage table. 1,631,943 battles. Top 7: Rillaboom 46.6%, Sneasler 37.1%, Incineroar 31.7%, Salamence-Mega 28.1%, Kingambit 25.3%, Basculegion 20.6%, Indeedee-F 20.3%.
  - `.../chaos/gen9championsvgc2026regmc-1760.json`: **16 MB** (0 cutoff: 12.6 MB; 1500: 18.7 MB). **277 species keys** (Megas are separate keys, e.g. `Salamence-Mega`, `Charizard-Mega-Y`).
  - `.../moveset/gen9championsvgc2026regmc-1760.txt`: human-readable sets.
  - `.../leads/`, `.../metagame/` dirs; the Bo3 variant is `gen9championsvgc2026regmcbo3-*`.
- Chaos JSON: `{info:{metagame, cutoff, "cutoff deviation", "team type", "number of battles"}, data:{"<Species Name>":{ "Raw count", usage (0..1 fraction), "Viability Ceiling":[n,top,..], Abilities:{id:weight}, Items:{id:weight}, Spreads:{"Nature:hp/atk/def/spa/spd/spe":weight}, Moves:{id:weight}, "Tera Types":{nothing}, Happiness, Teammates:{"Species Name":weight}, "Checks and Counters":{} }}}`. Weights are weighted counts; divide by the sum of Abilities weights (≈ the species' weighted total) to get a percentage. **Checks and Counters is empty for this doubles format.** Keys are display names, so join with `toID(name)`.
- Slimmed with `scratch/slim-stats.mjs` (top 8 abilities, items, moves, and teammates; top 4 SP spreads; percentages): 16 MB → **192 KB** for 277 species. 276 of the 339 board forms (incl. Megas) have usage entries; the rest have zero usage.
- Headers: `content-type: application/json`, `etag`, `last-modified`, and **no `access-control-allow-origin`**. **A browser cannot fetch it directly; it needs the local proxy.** Fetch it at most once a month, cache it on disk, and slim it (see the slimming note above).
- Licence: no explicit licence; free public stats. Credit "Smogon usage stats".

### Pikalytics: secondary

- **JSON API: works, but rate-limits fast.** The first requests (earlier session) returned `200 application/json`, `access-control-allow-origin: *`. Saved in `scratch/pikalytics/`:
  - list (`api-list-regmc.json`, 213 KB): 318 entries `{name, rank, search, winPercent, winRate, wins, losses, games, raw…}`.
  - per-mon (`api-garchomp-regmc.json`, 40 KB): `{types, stats, abilities[{ability,percent}], items, moves, team (teammates), counters, leads, megas, mega_percent, brought_percent, winRate, wins, losses, games, teams (sample teams), typeMatchups}`. **Win rate, bring rate, and Mega share are things Smogon does not have.**
  - Month-scoped URLs (`/api/l/2026-09/gen9championsvgc2026regmc-1760`, `/api/p/2026-09/.../garchomp`) returned `[]`. The exact URL of the working calls was not recorded; the likely pattern is `/api/l/<format>` and `/api/p/<format>/<Name>`. **Re-verify once the rate limit clears.**
  - After about 10 requests in a minute, every Pikalytics URL (including HTML) returned **HTTP 429 Cloudflare 1015**. So: proxy it, cache for 24 h, fetch on demand one mon at a time, never bulk.
- The AI/markdown endpoints work and are CORS `*`, `cache-control: public, max-age=86400`:
  - `https://www.pikalytics.com/ai/pokedex/gen9championsvgc2026regmc`: format summary, 2/3/4-Pokémon cores, recent top tournament teams.
  - `https://www.pikalytics.com/ai/pokedex/gen9championsvgc2026regmc/<Name>`: usage %, **win rate**, record, moves, abilities, items, teammates.
  - `https://www.pikalytics.com/llms.txt` documents these; `robots.txt` allows `/`.
- Caveats: the pages say "Data Date 2026-05" even for M-C (a label bug or stale data), and the Garchomp ability list contained noise (Levitate, Trace). Use Pikalytics only as an optional "win rate / bring rate / top teams" extra, behind the proxy, with a 24 h disk cache. Use JSON when it is available and fall back to the `/ai` markdown.

## 3. Sprites

- Showdown sprites, `https://play.pokemonshowdown.com/sprites/<set>/<spriteid>.<ext>`, `cache-control: max-age=691200`. A plain `<img>` needs no CORS.
- `spriteid = toID(baseSpecies || name) + (forme ? '-' + toID(forme) : '')`, e.g. `garchomp-megaz`, `floette-mega`, `tauros-paldeaaqua`, `indeedee-f`, `charizard-megax`.
- Coverage of all **339 forms** (257 board species + 82 Megas), HEAD-checked (`scratch/sprites.mjs`, results in `dev/sprite-coverage.json`):
  - `gen5/*.png`: 328/339
  - `ani/*.gif`: 334/339
  - `dex/*.png`: 316
  - `home-centered/*.png`: 299
  - **Every form has at least one sprite.** The 11 missing from gen5 are all new Megas, and all 11 exist in `ani`: barbaracle, dragalge, eelektross, falinks, malamar, pyroar, raichu-x/y, scolipede, scrafty, and staraptor Megas.
- **Recommendation:** `<img src="…/gen5/{sid}.png" onerror="this.src='…/ani/{sid}.gif'">`. Optionally fall back to `sprites/gen5/0.png`.
- Sprites are © Nintendo / Game Freak / Creatures. This is fine for a personal local tool; do not redistribute.
- The PokeAPI sprites repo does not have Champions-only Megas. Not needed.

## 4. Licensing summary

| Source | Licence / terms |
|---|---|
| Pokémon Showdown code + data | MIT (Guangcong Luo and contributors) |
| @smogon/calc | MIT |
| PokeAPI | BSD-style; names are Nintendo trademarks |
| Smogon stats | public, no stated licence: personal use, attribute |
| Pikalytics | public site, robots allow-all, no API terms: light personal use, cache 24 h, attribute |
| Sprites | © Nintendo/GF; personal use only |

No API keys, accounts, or paid services are needed anywhere.

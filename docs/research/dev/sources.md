# Sources (checked 2026-10-02)

## League sheet
- https://docs.google.com/spreadsheets/d/e/2PACX-1vRaWvbCLkcoMseTxroAvH65jxTaOOBGKStYCm5Waj-cXzd0jGs17T7OACJekcnr9w/pub?gid=1975886537&single=true&output=csv: Draft Board CSV (307 → googleusercontent, `private, max-age=300`, CORS ok)
- …/pub?gid=638600642&single=true&output=csv: Drafts CSV (source of truth for picks and points)
- …/pubhtml/sheet?headers=false&gid=1975886537: styled board table; red text = taken (`no-store`, CORS ok)
- …/pubhtml?gid=…&single=true: JS shell only, no table; do not use
- https://docswrite.com/blog/google-sheets-publish-to-web-not-updating-how-to-fix-it: publish-to-web republish delay ~5 min (+ "Automatically republish" setting)

## Format and rules
- https://victoryroad.pro/champions-regulations/: Reg M-A/M-B/M-C dates and changes (M-C: 9 Sep – 2 Dec 2026, +29 mons, +6 Megas)
- https://github.com/smogon/pokemon-showdown/blob/master/config/formats.ts: `[Gen 9 Champions] VGC 2026 Reg M-C` → id `gen9championsvgc2026regmc`, mod `champions`
- https://github.com/smogon/pokemon-showdown/tree/master/data/mods/champions: Champions mod (formats-data = legality, learnsets, items, moves, abilities, rulesets incl. Flat Rules, scripts incl. SP stat formula)
- https://github.com/smogon/pokemon-showdown/tree/master/data/mods/championsregmb: archived M-B mod
- https://replay.pokemonshowdown.com/gen9championsvgc2026regma-2580594433: shows the format naming on replays
- https://en.wikipedia.org/wiki/Pok%C3%A9mon_Champions: game background

## Pokémon data
- https://play.pokemonshowdown.com/data/pokedex.json: species/formes/Megas, stats, types, abilities, mega stones (CORS *, rebuilt daily)
- https://play.pokemonshowdown.com/data/moves.json: moves
- https://play.pokemonshowdown.com/data/teambuilder-tables.js: `champions` learnsets, legal items, move/ability/item overrides (15.7 MB)
- https://play.pokemonshowdown.com/data/typechart.js: type chart
- https://play.pokemonshowdown.com/data/aliases.js: name aliases (e.g. lycanrocmidday → Lycanroc)
- https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/pokedex.ts: canonical source of the above
- https://www.npmjs.com/package/@smogon/calc: v0.12.0 (2026-09-18), MIT, Champions = `Generations.get(0)`, verified working
- https://www.npmjs.com/package/@pkmn/dex: v0.10.11 (2026-06-18), Champions mod is M-A/M-B era, stale for M-C
- https://www.npmjs.com/package/pokemon-showdown: v0.11.11 (2026-07-28), stale for M-C, heavy
- https://pokeapi.co/api/v2/: free REST, CORS *, no Champions legality/Megas
- https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species_names.csv: zh-Hans (lang 12) names for the Chinese cross-check

## Usage / meta
- https://www.smogon.com/stats/: monthly index (latest 2026-09)
- https://www.smogon.com/stats/2026-09/gen9championsvgc2026regmc-1760.txt: usage table (1.63 M battles)
- https://www.smogon.com/stats/2026-09/chaos/gen9championsvgc2026regmc-1760.json: full chaos JSON (16 MB, no CORS → proxy)
- https://www.smogon.com/stats/2026-09/moveset/gen9championsvgc2026regmc-1760.txt: readable sets
- https://www.pikalytics.com/llms.txt: documents the /ai markdown endpoints
- https://www.pikalytics.com/ai/pokedex/gen9championsvgc2026regmc: format summary, cores, top teams (CORS *, 24 h cache)
- https://www.pikalytics.com/ai/pokedex/gen9championsvgc2026regmc/Garchomp: per-mon usage, win rate, sets (pattern `/ai/pokedex/<format>/<Name>`)
- https://www.pikalytics.com/pokedex/gen9championsvgc2026regmc: human page; JSON `/api/...` returned 429 (Cloudflare 1015)
- https://showdowntier.com/formats/dma/index.html: community viability tier list (M-A; reference only)
- https://pokemonvgcteamreport.com/champions: team reports (reference only)

## Sprites
- https://play.pokemonshowdown.com/sprites/gen5/<spriteid>.png: 328/339 board forms
- https://play.pokemonshowdown.com/sprites/ani/<spriteid>.gif: 334/339; covers the 11 gen5 gaps (new Megas)
- https://play.pokemonshowdown.com/sprites/dex/, /home-centered/: partial coverage

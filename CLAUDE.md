# Drafarig

Anthony's Pokémon Champions (Reg M-C) VGC draft-league prep tool. Node, no build step for development; `npm test`
builds and tests.

**Before any VGC, team, matchup, mock or simulator work, read `docs/research/strategy/VGC-PLAYBOOK.md`.** It holds how
Anthony wants the work done, the verified format mechanics, the method rules, the simulator, and where every match
stands.

- This branch (`prep-builder`) is the real app. `main` is an unrelated old history: never merge or reset between them.
- Check every guide or mock calc in the app engine before shipping: `node docs/research/strategy/sp-assist/verify_curated.mjs`.

#!/bin/sh
# Dev-only: fetch Pokémon Showdown (MIT, https://github.com/smogon/pokemon-showdown) at a pinned commit into
# tools/sim/vendor/pokemon-showdown (gitignored) and build its simulator. Never shipped: the Worker build and the served
# routes don't include tools/sim.
set -e
PS_COMMIT=d601443456c795f77c6e4f2b5b459167f2b10a3c
DIR="$(cd "$(dirname "$0")" && pwd)/vendor/pokemon-showdown"
if [ ! -d "$DIR/.git" ]; then
  mkdir -p "$DIR"
  git -C "$DIR" init -q
  git -C "$DIR" remote add origin https://github.com/smogon/pokemon-showdown.git
fi
git -C "$DIR" fetch -q --depth 1 origin "$PS_COMMIT"
git -C "$DIR" checkout -q --detach "$PS_COMMIT"
cd "$DIR"
npm install --no-audit --no-fund --silent
node build
echo "Pokémon Showdown $PS_COMMIT ready in $DIR"

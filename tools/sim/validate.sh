#!/bin/sh
# Validation games for the heuristic AI, then the summary (tools/sim/validate.mjs). Fresh files each time.
#   sh tools/sim/validate.sh          validation only (~5 minutes)
#   sh tools/sim/validate.sh pilot    plus the a01 vs z01..z24 pilot, 960 games under each preview policy (~10 minutes)
set -e
cd "$(dirname "$0")/../.."
R=tools/sim/results
mkdir -p $R
rm -f $R/validate-*.jsonl
node tools/sim/run.mjs --ours a01 --theirs z01 --theirs-ai random --games 400 --swap --out $R/validate-vs-random.jsonl | tail -1
node tools/sim/run.mjs --ours a01 --theirs a01 --games 600 --swap --out $R/validate-mirror-a01.jsonl | tail -1
node tools/sim/run.mjs --ours z01 --theirs z01 --games 400 --swap --out $R/validate-mirror-z01.jsonl | tail -1
node tools/sim/run.mjs --ours a01 --theirs z04,z15,z23 --games 300 --swap --out $R/validate-tr-style.jsonl | tail -1
node tools/sim/run.mjs --ours z04,z15,z23 --theirs z24 --games 300 --swap --out $R/validate-tr-vs-fast.jsonl | tail -1
if [ "$1" = "pilot" ]; then
  rm -f $R/pilot-*.jsonl
  node tools/sim/run.mjs --ours a01 --theirs z01..z24 --games 960 --swap --preview ai --out $R/pilot-ai.jsonl | tail -1
  node tools/sim/run.mjs --ours a01 --theirs z01..z24 --games 960 --swap --preview guide --out $R/pilot-guide.jsonl | tail -1
fi
node tools/sim/validate.mjs

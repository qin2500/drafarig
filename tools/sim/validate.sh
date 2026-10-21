#!/bin/sh
# Step 2 validation games (heuristic AI), then the summary. Fresh files each time. ~3–5 minutes on this Mac.
set -e
cd "$(dirname "$0")/../.."
R=tools/sim/results
mkdir -p $R
rm -f $R/validate-*.jsonl
node tools/sim/run.mjs --ours a01 --theirs z01 --theirs-ai random --games 400 --swap --out $R/validate-vs-random.jsonl | tail -1
node tools/sim/run.mjs --ours a01 --theirs a01 --games 600 --swap --out $R/validate-mirror-a01.jsonl | tail -1
node tools/sim/run.mjs --ours z01 --theirs z01 --games 400 --swap --out $R/validate-mirror-z01.jsonl | tail -1
node tools/sim/run.mjs --ours a01 --theirs z04,z15,z23 --games 300 --swap --out $R/validate-tr-style.jsonl | tail -1
node tools/sim/run.mjs --ours a01 --theirs z04,z15,z23 --games 300 --swap --opp-style setup --out $R/validate-tr-setup.jsonl | tail -1
node tools/sim/run.mjs --ours z04,z15,z23 --theirs z24 --games 300 --swap --out $R/validate-tr-vs-fast.jsonl | tail -1
node tools/sim/validate.mjs

// Determinism check: play N games the way real runs do (many games in one worker process), then replay every game in
// its own fresh process and count games whose winner or length differs. Any difference means state leaks between
// games or players (2026-11-06: trShare's memo was keyed by slot only; old code 14/48 differ, fixed 0/48).
// Run before trusting a headline after any AI / engine change, especially for Trick Room teams (playbook §3).
// usage: node tools/sim/check-determinism.mjs --cands <pool.json> --ours <ids> --theirs <ids> [--games 48] [--sheets closed]
//        [--ours-ai heuristic|engine] [--theirs-ai ...] [--seed 7200000]
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const cands = opt('cands'), ours = opt('ours'), theirs = opt('theirs');
if (!cands || !ours || !theirs) { console.error('need --cands, --ours, --theirs'); process.exit(2); }
const out = join(mkdtempSync(join(tmpdir(), 'determ-')), 'games.jsonl');
const run = ['tools/sim/run.mjs', '--cands', cands, '--ours', ours, '--theirs', theirs, '--games', opt('games', '48'), '--sheets', opt('sheets', 'closed'),
  '--seed', opt('seed', '7200000'), '--ours-ai', opt('ours-ai', 'heuristic'), '--theirs-ai', opt('theirs-ai', 'heuristic'), '--workers', '1', '--out', out];
execFileSync('node', run, { stdio: 'ignore' });
const recs = readFileSync(out, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const replay = `const { readFileSync } = await import('node:fs'); const { replayGame } = await import(${JSON.stringify(new URL('./run.mjs', import.meta.url).href)});
  const r = await replayGame(JSON.parse(readFileSync(${JSON.stringify(out + '.args.json')}, 'utf8')), Number(process.argv.at(-1))); console.log(JSON.stringify({ winner: r.winner, turns: r.turns }));`;
let bad = 0, tr = 0, badTr = 0;
for (const r of recs) {
  const f = JSON.parse(execFileSync('node', ['--input-type=module', '-e', replay, '--', '--cands', cands, String(r.i)]).toString().trim().split('\n').at(-1));
  const isTr = (r.our.tr ?? 0) + (r.their.tr ?? 0) > 0;
  const winner = f.winner; // replayGame returns the runner's record ('ours' / 'theirs' / 'tie')
  const diff = f.turns !== r.turns || winner !== r.winner;
  tr += isTr; bad += diff; badTr += diff && isTr;
  if (diff) console.log(`differs: game ${r.i} (${r.ours} vs ${r.theirs}): run ${r.winner}/${r.turns} turns, fresh ${winner}/${f.turns}`);
}
console.log(`${recs.length} games, ${bad} differ from a fresh replay (${badTr} of ${tr} with Trick Room)`);
process.exit(bad ? 1 : 0);

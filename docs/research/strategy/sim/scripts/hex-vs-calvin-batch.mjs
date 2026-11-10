// Week 5 mock (Hex vs Calvin): run a batch of Hex sixes one after another against Calvin's weighted pool.
//   node docs/research/strategy/sim/scripts/hex-vs-calvin-batch.mjs <outDir> <ids comma list|@file> <games> <seed> [extra run.mjs args...]
// Each six goes to <outDir>/<id>.jsonl (resumable: run.mjs skips finished games). Workers default to 4 (shared laptop).
// THEIRS: Calvin's k01-k12 as a 24-entry round-robin approximating their weights (gen_hex_vs_calvin.py KT), so game i
// meets the same Calvin six with the same seed for every Hex six (paired).
import { spawnSync } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';

export const THEIRS = ['k01', 'k02', 'k03', 'k04', 'k05', 'k06', 'k07', 'k08', 'k01', 'k07', 'k11', 'k09',
  'k01', 'k02', 'k03', 'k04', 'k05', 'k06', 'k07', 'k08', 'k01', 'k10', 'k11', 'k12'].join(',');
const [outDir, idsArg, games, seed, ...extra] = process.argv.slice(2);
if (!outDir || !idsArg) { console.error('usage: hex-vs-calvin-batch.mjs <outDir> <ids|@file> <games> <seed> [args]'); process.exit(2); }
const ids = idsArg.startsWith('@') ? readFileSync(idsArg.slice(1), 'utf8').split(/[\s,]+/).filter(Boolean) : idsArg.split(',');
mkdirSync(outDir, { recursive: true });
const hasWorkers = extra.includes('--workers');
for (const id of ids) {
  const args = ['tools/sim/run.mjs', '--cands', 'tools/sim/candidates/hex-vs-calvin.json', '--ours', id, '--theirs', THEIRS,
    '--games', games ?? '24', '--seed', seed ?? '7000000', '--sheets', 'closed', '--out', `${outDir}/${id}.jsonl`,
    ...(hasWorkers ? [] : ['--workers', '4']), ...extra];
  const t = Date.now();
  const r = spawnSync('node', args, { encoding: 'utf8', maxBuffer: 1 << 26 });
  const line = (r.stdout || '').split('\n').find((l) => l.startsWith('ours wins')) || (r.stderr || '').slice(-300);
  console.log(`${id}\t${((Date.now() - t) / 1000).toFixed(0)}s\t${line}`);
}

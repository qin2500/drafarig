// Run many games in a worker pool and append one JSON line per game (resumable).
//
//   node tools/sim/run.mjs --ours a01 --theirs z01 --games 200 [--ours-ai heuristic|random] [--theirs-ai …]
//     [--skill 0.85] [--opp-skill 0.85] [--style balanced|aggressive|safe|setup] [--opp-style …] [--noise 0.07]
//     [--opp-noise 0.07] [--usual 0] [--opp-usual 0] [--seed 1] [--workers N] [--out tools/sim/results/<name>.jsonl]
//     [--swap]  (alternate which side is p1)
//
// --ours / --theirs: a candidate id (tools/sim/candidates/zhuzi.json: a01…, z01…), a comma list (round-robin per game),
// or a file with Showdown text. Game i uses seed (--seed + i): the same i gives the same seed in every run, so two runs
// that differ in one option are paired game by game (common random numbers). A run with the same --out skips the games
// already in the file, so an interrupted run resumes where it stopped.
import { Worker, isMainThread, parentPort } from 'node:worker_threads';
import { cpus } from 'node:os';
import { readFileSync, existsSync, appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const CAND = JSON.parse(readFileSync(new URL('./candidates/zhuzi.json', import.meta.url), 'utf8'));
const teamText = (ref) => {
  const c = [...CAND.ours.teams, ...CAND.opponent.teams].find((t) => t.id === ref);
  if (c) return c.team;
  if (existsSync(ref)) return readFileSync(ref, 'utf8');
  throw new Error(`unknown team ${ref}`);
};
export function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const k = argv[i].slice(2), v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    o[k] = v;
  }
  return o;
}
/** Wilson 95% interval for k wins of n. */
export function wilson(k, n, z = 1.96) {
  if (!n) return [0, 1];
  const p = k / n, d = 1 + (z * z) / n, c = p + (z * z) / (2 * n), r = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [(c - r) / d, (c + r) / d];
}
export function taskList(a) {
  const ours = String(a.ours ?? 'a01').split(','), theirs = String(a.theirs ?? 'z01').split(',');
  const n = Number(a.games ?? 100), base = Number(a.seed ?? 1);
  const side = (ref, ai, pre) => ({ ref, text: teamText(ref), ai, skill: Number(a[`${pre}skill`] ?? 0.85), style: a[`${pre}style`] ?? 'balanced', noise: Number(a[`${pre}noise`] ?? 0.07), usualBring: Number(a[`${pre}usual`] ?? 0) });
  return Array.from({ length: n }, (_, i) => ({ i, seed: base + i, swap: !!a.swap && i % 2 === 1,
    ours: side(ours[i % ours.length], a['ours-ai'] ?? 'heuristic', ''), theirs: side(theirs[i % theirs.length], a['theirs-ai'] ?? 'heuristic', 'opp-') }));
}
async function play(t) {
  const { playGame } = await import('./game.mjs');
  const us = { ...t.ours, name: 'Ours' }, them = { ...t.theirs, name: 'Theirs' };
  const [p1, p2] = t.swap ? [them, us] : [us, them];
  const t0 = performance.now();
  const r = await playGame(p1, p2, t.seed);
  const ourSide = t.swap ? 'p2' : 'p1', theirSide = t.swap ? 'p1' : 'p2';
  return { i: t.i, seed: t.seed, ours: t.ours.ref, theirs: t.theirs.ref, oursAs: ourSide, winner: r.winner === 'tie' ? 'tie' : r.winner === ourSide ? 'ours' : 'theirs', turns: r.turns,
    our: r.summary[ourSide], their: r.summary[theirSide], errors: r.errors, ms: Math.round(performance.now() - t0) };
}

if (!isMainThread) {
  parentPort.on('message', async (t) => { try { parentPort.postMessage({ ok: true, rec: await play(t) }); } catch (e) { parentPort.postMessage({ ok: false, i: t.i, err: String(e.stack ?? e).slice(0, 500) }); } });
} else if (import.meta.url === `file://${process.argv[1]}`) {
  const a = parseArgs(process.argv.slice(2));
  const out = a.out ?? `tools/sim/results/${a.ours ?? 'a01'}_vs_${a.theirs ?? 'z01'}.jsonl`;
  mkdirSync(dirname(out), { recursive: true });
  const done = new Set(existsSync(out) ? readFileSync(out, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l).i) : []);
  const tasks = taskList(a).filter((t) => !done.has(t.i));
  const nw = Math.min(Number(a.workers ?? Math.max(1, cpus().length - 1)), tasks.length || 1);
  console.log(`${tasks.length} games to play (${done.size} already in ${out}), ${nw} workers`);
  const t0 = performance.now();
  let next = 0, finished = 0, failed = 0;
  // one worker per slot; a game that runs past --timeout seconds (a stuck battle) is recorded as failed and its worker
  // replaced, so one bad game can't stall the run
  const limit = 1000 * Number(a.timeout ?? 120);
  const slot = () => new Promise((res) => {
    let w, timer, cur;
    const start = () => {
      w = new Worker(new URL(import.meta.url));
      w.on('message', (m) => {
        clearTimeout(timer);
        if (m.ok) { appendFileSync(out, JSON.stringify(m.rec) + '\n'); finished++; } else { failed++; console.error(`game ${m.i} failed: ${m.err}`); }
        if ((finished + failed) % 50 === 0) console.log(`${finished + failed}/${tasks.length} (${(finished / ((performance.now() - t0) / 1000)).toFixed(2)} games/s)`);
        feed();
      });
      w.on('error', (e) => { clearTimeout(timer); console.error(`game ${cur?.i} worker error: ${e.message}`); failed++; start(); feed(); });
    };
    const feed = () => {
      if (next >= tasks.length) { void w.terminate(); res(); return; }
      cur = tasks[next++];
      timer = setTimeout(() => { console.error(`game ${cur.i} timed out`); failed++; void w.terminate(); start(); feed(); }, limit);
      w.postMessage(cur);
    };
    start(); feed();
  });
  await Promise.all(Array.from({ length: nw }, slot));
  const secs = (performance.now() - t0) / 1000;
  const recs = readFileSync(out, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const n = recs.length, k = recs.filter((r) => r.winner === 'ours').length + 0.5 * recs.filter((r) => r.winner === 'tie').length;
  const [lo, hi] = wilson(k, n);
  console.log(`played ${finished} in ${secs.toFixed(1)} s (${(finished / secs).toFixed(2)} games/s), ${failed} failed; errors in games: ${recs.reduce((t, r) => t + (r.errors ?? 0), 0)}`);
  console.log(`ours wins ${k}/${n} = ${(100 * k / n).toFixed(1)}% (95% CI ${(100 * lo).toFixed(1)}–${(100 * hi).toFixed(1)}%), avg ${(recs.reduce((t, r) => t + r.turns, 0) / n).toFixed(1)} turns`);
}

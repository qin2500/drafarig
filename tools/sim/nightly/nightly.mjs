// The overnight trainer: while the laptop is idle at night, play engine self-play on format-wide teams and train the
// residual value network (engine/train-residual.mjs), promoting a new network only when it beats the current one on
// teams it has never trained on. Started by launchd (install.sh) each night; exits at the end of the window.
//
// It only works while all of these hold, checked every minute; otherwise it stops the running batch (every batch is
// resumable game by game) and waits:
//   - inside the window (default 00:30–07:30 local);
//   - on AC power;
//   - nobody has touched the keyboard / mouse / trackpad for --idle minutes (default 10);
//   - no other simulator run is going (match prep comes first).
//
// One round = fresh teams → self-play → train a challenger → gate → (if promoted) diagnostics. State lives in
// tools/sim/results/nightly/state.json, so a round spans as many nights as it needs.
//
// Overfitting rules (the reason for most of this design):
//   - training teams: a new pool of format-wide ladder-like sixes every round (general-teams.mjs), plus the league's;
//     never a matchup's candidate pool;
//   - the gate uses a fixed BENCHMARK pool (general-teams seeds 900000+) that never appears in training;
//   - the network learns a correction to the hand-made value, held out by team, early-stopped;
//   - matchup numbers (c1 vs ZhuZi, league teams) are diagnostics only and never decide a promotion.
//
//   node tools/sim/nightly/nightly.mjs [--start 00:30] [--end 07:30] [--idle 10] [--games 1200] [--gate 480] [--once]
//     --force-window: ignore the window, AC and idle checks (testing)    --status: print the state and the log tail
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, readdirSync, copyFileSync } from 'node:fs';
import { cpus } from 'node:os';

const ROOT = new URL('../../../', import.meta.url).pathname;
const DIR = `${ROOT}tools/sim/results/nightly/`;
const TEAMS = `${ROOT}tools/sim/candidates/general/`;
const WEIGHTS = `${ROOT}tools/sim/engine/weights/`;
const CHAMP = `${WEIGHTS}nightly-champion.json`;
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i < 0 ? d : args[i + 1]; };
const flag = (k) => args.includes(`--${k}`);
const CFG = { start: opt('start', '00:30'), end: opt('end', '07:30'), idle: Number(opt('idle', 10)), games: Number(opt('games', 1200)),
  gate: Number(opt('gate', 480)), window: Number(opt('window', 5)), workers: Number(opt('workers', Math.max(2, cpus().length - 2))), force: flag('force-window') };
mkdirSync(DIR, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => { const d = new Date(), z = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`; };
const log = (s) => { const l = `${now()}  ${s}`; console.log(l); appendFileSync(`${DIR}log.md`, `${l}\n`); };
const loadState = () => (existsSync(`${DIR}state.json`) ? JSON.parse(readFileSync(`${DIR}state.json`, 'utf8')) : { round: 1, phase: 'teams', history: [] });
const saveState = (s) => writeFileSync(`${DIR}state.json`, JSON.stringify(s, null, 1));

if (flag('status')) {
  console.log(JSON.stringify(loadState(), null, 1));
  if (existsSync(`${DIR}log.md`)) console.log(readFileSync(`${DIR}log.md`, 'utf8').trim().split('\n').slice(-15).join('\n'));
  process.exit(0);
}

// ---- the guard -------------------------------------------------------------------------------------------------
const minutesOf = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
function inWindow(d = new Date()) {
  const t = d.getHours() * 60 + d.getMinutes(), a = minutesOf(CFG.start), b = minutesOf(CFG.end);
  return a <= b ? t >= a && t < b : t >= a || t < b;
}
const sh = (cmd, a) => { try { return execFileSync(cmd, a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return ''; } };
const onAC = () => /AC Power/.test(sh('pmset', ['-g', 'batt']));
const idleMinutes = () => { const m = sh('ioreg', ['-c', 'IOHIDSystem']).match(/"HIDIdleTime" = (\d+)/); return m ? Number(m[1]) / 6e10 : 0; };
// another simulator run (match prep) that isn't ours
const otherSims = () => sh('pgrep', ['-fl', 'tools/sim/run.mjs']).split('\n').filter((l) => l && !l.includes('results/nightly/')).length;
function blocker() {
  if (!inWindow()) return 'outside the window';
  if (CFG.force) return null;
  if (!onAC()) return 'on battery';
  if (idleMinutes() < CFG.idle) return 'laptop in use';
  if (otherSims()) return 'another sim is running';
  return null;
}

// ---- running one resumable batch under the guard ------------------------------------------------------------------
/** Runs a node script; stops it whenever the guard says so and resumes it when allowed. Resolves true when it finished,
 * false when the window ended first. */
async function guarded(label, argv) {
  for (;;) {
    let why = blocker();
    while (why && why !== 'outside the window') { await sleep(60_000); why = blocker(); }
    if (why) return false;
    const child = spawn('nice', ['-n', '15', process.execPath, ...argv], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    const caf = spawn('caffeinate', ['-i', '-w', String(child.pid)], { stdio: 'ignore' });
    let tail = '';
    child.stdout.on('data', (b) => { tail = (tail + b).slice(-2000); });
    child.stderr.on('data', (b) => { tail = (tail + b).slice(-2000); });
    const done = new Promise((r) => child.on('exit', (code) => r(code)));
    let stopped = null;
    for (;;) {
      const r = await Promise.race([done, sleep(60_000).then(() => 'tick')]);
      if (r !== 'tick') { caf.kill(); if (r === 0) return true; if (stopped) break; log(`${label}: exited ${r}: ${tail.trim().split('\n').slice(-3).join(' | ')}`); throw new Error(`${label} failed`); }
      const b = blocker();
      if (b) { stopped = b; log(`${label}: paused (${b})`); child.kill('SIGTERM'); }
    }
    if (stopped === 'outside the window') return false;
  }
}

// ---- the round ---------------------------------------------------------------------------------------------------
const list = (dir) => readdirSync(dir).filter((f) => f.endsWith('.txt')).sort().map((f) => `${dir}${f}`.replace(ROOT, ''));
const rotate = (xs, k) => xs.slice(k).concat(xs.slice(0, k));
const engineArgs = ['--ours-ai', 'engine', '--theirs-ai', 'engine', '--depth', '2', '--dice', 'mean', '--samples', '2', '--opp-depth', '2', '--opp-dice', 'mean',
  '--sheets', 'closed', '--beliefs', 'usage', '--swap', '--timeout', '900', '--workers', String(CFG.workers)];
function winRate(file) {
  const g = readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((r) => !(r.errors > 0));
  const w = g.filter((r) => r.winner === 'ours').length + 0.5 * g.filter((r) => r.winner === 'tie').length, n = g.length, p = w / n;
  return { n, p, lo: p - 1.96 * Math.sqrt(p * (1 - p) / n), hi: p + 1.96 * Math.sqrt(p * (1 - p) / n) };
}
const pct = (x) => `${(100 * x.p).toFixed(1)}% [${(100 * x.lo).toFixed(1)}, ${(100 * x.hi).toFixed(1)}] of ${x.n}`;

async function round(S) {
  const R = S.round, rd = `${DIR}r${R}/`;
  mkdirSync(rd, { recursive: true });
  const champ = existsSync(CHAMP) ? ['--net', CHAMP, '--opp-net', CHAMP] : [];
  if (S.phase === 'teams') {
    if (!existsSync(`${TEAMS}bench/index.json`)) execFileSync(process.execPath, ['tools/sim/general-teams.mjs', '--out', 'tools/sim/candidates/general/bench', '--n', '48', '--seed', '900000'], { cwd: ROOT, stdio: 'ignore' });
    execFileSync(process.execPath, ['tools/sim/general-teams.mjs', '--out', `tools/sim/candidates/general/train-r${R}`, '--n', '64', '--seed', String(R * 1000)], { cwd: ROOT, stdio: 'ignore' });
    log(`round ${R}: 64 fresh training teams (champion: ${champ.length ? 'nightly network' : 'original engine'})`);
    S.phase = 'selfplay'; saveState(S);
  }
  if (S.phase === 'selfplay') {
    const pool = [...list(`${TEAMS}train-r${R}/`), ...list(`${ROOT}tools/sim/candidates/league/`)];
    const ok = await guarded(`round ${R} self-play`, ['tools/sim/run.mjs', '--ours', pool.join(','), '--theirs', rotate(pool, 17).slice(0, pool.length - 1).join(','),
      '--games', String(CFG.games), '--seed', String(50_000_000 + R * 100_000), '--preview', 'explore', '--record', ...engineArgs, ...champ, '--out', `${rd}selfplay.jsonl`]);
    if (!ok) return false;
    log(`round ${R}: self-play done (${CFG.games} games)`);
    S.phase = 'train'; saveState(S);
  }
  if (S.phase === 'train') {
    const data = []; for (let k = Math.max(1, R - CFG.window + 1); k <= R; k++) if (existsSync(`${DIR}r${k}/selfplay.jsonl`)) data.push(`${DIR}r${k}/selfplay.jsonl`);
    const ok = await guarded(`round ${R} training`, ['tools/sim/engine/train-residual.mjs', `${rd}challenger.json`, ...data]);
    if (!ok) return false;
    const m = JSON.parse(readFileSync(`${rd}challenger.json`, 'utf8')).meta;
    log(`round ${R}: challenger trained on ${m.games} games: held-out-team log loss ${m.net.logloss} vs hand-made value ${m.heuristic.logloss} (best epoch ${m.net.epoch})`);
    S.phase = 'gate'; saveState(S);
  }
  if (S.phase === 'gate') {
    // two halves on the same seeds and team pairings with the networks swapped, so team strength cancels: the
    // challenger's score is its share of wins over both halves
    const bench = list(`${TEAMS}bench/`), half = String(Math.round(CFG.gate / 2));
    const teams = ['--ours', bench.join(','), '--theirs', rotate(bench, 7).slice(0, bench.length - 1).join(','), '--games', half, '--seed', '90000000', ...engineArgs];
    const ch = `${rd}challenger.json`, has = existsSync(CHAMP);
    if (!await guarded(`round ${R} gate (a)`, ['tools/sim/run.mjs', ...teams, '--net', ch, ...(has ? ['--opp-net', CHAMP] : []), '--out', `${rd}gate-a.jsonl`])) return false;
    if (!await guarded(`round ${R} gate (b)`, ['tools/sim/run.mjs', ...teams, ...(has ? ['--net', CHAMP] : []), '--opp-net', ch, '--out', `${rd}gate-b.jsonl`])) return false;
    const A = winRate(`${rd}gate-a.jsonl`), B = winRate(`${rd}gate-b.jsonl`), n = A.n + B.n, p = (A.p * A.n + (1 - B.p) * B.n) / n;
    const g = { n, p, lo: p - 1.96 * Math.sqrt(p * (1 - p) / n), hi: p + 1.96 * Math.sqrt(p * (1 - p) / n) }, promoted = g.n >= 200 && g.lo > 0.5;
    log(`round ${R}: gate on held-out benchmark teams: challenger ${pct(g)} vs ${existsSync(CHAMP) ? 'champion' : 'original engine'}: ${promoted ? 'PROMOTED' : 'kept the champion'}`);
    if (promoted) copyFileSync(`${rd}challenger.json`, CHAMP);
    S.history.push({ round: R, gate: +g.p.toFixed(4), lo: +g.lo.toFixed(4), n: g.n, promoted, at: now() });
    S.phase = promoted ? 'diag' : 'next'; saveState(S);
  }
  if (S.phase === 'diag') {
    // diagnostics only: the champion vs the original engine, on league teams and on Anthony's c1 vs ZhuZi
    const league = list(`${ROOT}tools/sim/candidates/league/`);
    const ok1 = await guarded(`round ${R} diagnostics (league)`, ['tools/sim/run.mjs', '--ours', league.join(','), '--theirs', rotate(league, 11).slice(0, league.length - 1).join(','),
      '--games', '240', '--seed', '91000000', ...engineArgs, '--net', CHAMP, '--out', `${rd}diag-league.jsonl`]);
    if (!ok1) return false;
    const ok2 = await guarded(`round ${R} diagnostics (c1 vs ZhuZi)`, ['tools/sim/run.mjs', '--ours', 'tools/sim/candidates/r5/c1.txt', '--theirs', 'z01..z24',
      '--games', '240', '--seed', '92000000', ...engineArgs, '--preview', 'guide', '--net', CHAMP, '--out', `${rd}diag-c1.jsonl`]);
    if (!ok2) return false;
    log(`round ${R}: diagnostics (not used to promote): league teams ${pct(winRate(`${rd}diag-league.jsonl`))} vs the original engine; c1 vs ZhuZi ${pct(winRate(`${rd}diag-c1.jsonl`))}`);
    S.phase = 'next'; saveState(S);
  }
  if (S.phase === 'next') { S.round = R + 1; S.phase = 'teams'; saveState(S); }
  return true;
}

// ---- main --------------------------------------------------------------------------------------------------------
const lock = `${DIR}lock`;
if (existsSync(lock)) { const pid = Number(readFileSync(lock, 'utf8')); if (pid > 0) try { process.kill(pid, 0); console.log(`already running (pid ${pid})`); process.exit(0); } catch { /* stale */ } }
writeFileSync(lock, String(process.pid));
const cleanup = () => { try { if (readFileSync(lock, 'utf8') === String(process.pid)) writeFileSync(lock, ''); } catch { /* */ } };
process.on('exit', cleanup); process.on('SIGTERM', () => process.exit(0)); process.on('SIGINT', () => process.exit(0));
log(`night start (window ${CFG.start}–${CFG.end}, idle ≥ ${CFG.idle} min, ${CFG.workers} workers)`);
try {
  for (;;) {
    const S = loadState();
    const finished = await round(S);
    if (!finished || flag('once')) break;
  }
} catch (e) { log(`stopped on error: ${e.message}`); }
log('night end');

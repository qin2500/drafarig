// Run many games in a worker pool and append one JSON line per game (resumable).
//
//   node tools/sim/run.mjs --ours a01 --theirs z01 --games 200 [--ours-ai heuristic|random] [--theirs-ai …]
//     [--skill 0.85] [--opp-skill 0.85] [--style balanced|aggressive|safe|setup] [--opp-style …] [--noise 0.07]
//     [--opp-noise 0.07] [--usual 0] [--opp-usual 0] [--seed 1] [--workers N] [--out tools/sim/results/<name>.jsonl]
//     [--swap]  (alternate which side is p1)  [--preview ai|guide|explore|<rows.json>] (ours: the AI's lead lookahead, the guide's
//     table, uniform over the AI's top 8 previews, or a fitted table of guide-shaped rows)
//     [--persona default|none|all] (opponent plan-commitment personas: the PERSONAS shares, none, or every game)
//     --theirs z01..z24 expands to the 24 ids (round-robin per game)
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
/** 'z01..z24' → z01,z02,…,z24; plain ids and comma lists pass through. */
export function expandIds(list) {
  return String(list).split(',').flatMap((x) => {
    const m = x.match(/^([a-z])(\d+)\.\.\1?(\d+)$/);
    if (!m) return [x];
    const w = m[2].length;
    return Array.from({ length: Number(m[3]) - Number(m[2]) + 1 }, (_, k) => `${m[1]}${String(Number(m[2]) + k).padStart(w, '0')}`);
  });
}
// Plan-commitment personas (ai-review.md #5): the share of opponent players who play the team's plan out of habit
export const PERSONAS = { z04: ['tr', 0.6], z05: ['tr', 0.6], z15: ['tr', 0.6], z16: ['tr', 0.6], z23: ['tr', 0.6], z06: ['tr', 0.3], z03: ['rock', 0.6], z08: ['rock', 0.6], z18: ['rock', 0.6], z07: ['chilly', 0.6] };
const unit = (seed, salt) => { let h = (seed * 2654435761) ^ salt; h = Math.imul(h ^ (h >>> 16), 2246822519); h = Math.imul(h ^ (h >>> 13), 3266489917); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
export function taskList(a) {
  const ours = expandIds(a.ours ?? 'a01'), theirs = expandIds(a.theirs ?? 'z01');
  const n = Number(a.games ?? 100), base = Number(a.seed ?? 1);
  const persona = (ref, seed) => { const pp = a.persona === 'none' ? null : PERSONAS[ref]; return pp && unit(seed, 77) < (a.persona === 'all' ? 1 : pp[1]) ? pp[0] : null; };
  const side = (ref, ai, pre, seed, opp) => ({ ref, text: teamText(ref), ai, skill: Number(a[`${pre}skill`] ?? 0.85), style: a[`${pre}style`] ?? 'balanced', noise: Number(a[`${pre}noise`] ?? 0.07),
    usualBring: Number(a[`${pre}usual`] ?? 0), preview: opp ? 'ai' : a.preview ?? 'ai', persona: opp ? persona(ref, seed) : null });
  return Array.from({ length: n }, (_, i) => ({ i, seed: base + i, swap: !!a.swap && i % 2 === 1,
    ours: side(ours[i % ours.length], a['ours-ai'] ?? 'heuristic', '', base + i, false), theirs: side(theirs[i % theirs.length], a['theirs-ai'] ?? 'heuristic', 'opp-', base + i, true) }));
}
const pc = (k, n) => (n ? `${(100 * k / n).toFixed(1)}%` : '—');
/** The review metrics (ai-review.md) for a batch: per side, plus TR set rate by persona. */
export function metrics(recs) {
  const lines = [];
  for (const who of ['our', 'their']) {
    const S = (f) => recs.reduce((t, r) => t + (f(r[who]) ?? 0), 0);
    const megaT = recs.map((r) => r[who].megaTurn).filter((x) => x != null);
    lines.push(`${who === 'our' ? 'ours  ' : 'theirs'}: double-Protect ${pc(S((x) => x.doubleProtect), S((x) => x.movers2))} of two-mover turns · failed moves ${pc(S((x) => x.failed), S((x) => x.moves))} · Wide Guard ${S((x) => x.wideGuard)} uses / ${S((x) => x.wgChances)} turns with WG vs an active spread threat · Charizard led into spread Rock ${S((x) => (x.zardIntoRock ? 1 : 0))}/${recs.length} (uncovered ${S((x) => (x.zardIntoRockUncovered ? 1 : 0))}) · Mega in ${megaT.length}/${recs.length} games, avg turn ${(megaT.reduce((t, x) => t + x, 0) / (megaT.length || 1)).toFixed(2)}`);
  }
  const SETTERS = ['oranguru', 'slowkinggalar', 'sinistcha'];
  const by = new Map();
  for (const r of recs) { if (!r.their.brought.some((s) => SETTERS.includes(s))) continue; const k = r.persona ?? 'calc'; const e = by.get(k) ?? [0, 0]; e[0] += r.their.tr > 0 ? 1 : 0; e[1]++; by.set(k, e); }
  if (by.size) lines.push(`their Trick Room set rate (games with a setter brought), by persona: ${[...by].map(([k, [x, n]]) => `${k} ${x}/${n} = ${pc(x, n)}`).join(' · ')}`);
  // calc refusals (retried with a damage-neutral ability, or estimated): visible so a gap in lib/calc can't hide
  const ref = {};
  for (const r of recs) for (const [k, n] of Object.entries(r.refusals ?? {})) ref[k] = (ref[k] ?? 0) + n;
  lines.push(`calc refusals: ${Object.values(ref).reduce((t, n) => t + n, 0)}${Object.keys(ref).length ? ` (${Object.entries(ref).map(([k, n]) => `${k} ${n}`).join(', ')}; retried with a neutral ability)` : ''}`);
  const ch = recs.filter((r) => r.persona === 'chilly');
  if (ch.length) lines.push(`their Chilly Reception (chilly persona): used in ${ch.filter((r) => r.their.chilly > 0).length}/${ch.length} games (${ch.filter((r) => r.their.brought.includes('slowkinggalar')).length} brought Slowking-G)`);
  const wr = new Map();
  for (const r of recs) { const k = r.persona ?? 'calc'; const e = wr.get(k) ?? [0, 0]; e[0] += r.winner === 'ours' ? 1 : r.winner === 'tie' ? 0.5 : 0; e[1]++; wr.set(k, e); }
  lines.push(`ours win rate by opponent persona: ${[...wr].map(([k, [x, n]]) => { const [lo, hi] = wilson(x, n); return `${k} ${x}/${n} = ${pc(x, n)} (${pc(lo * n, n)}–${pc(hi * n, n)})`; }).join(' · ')}`);
  return lines;
}
async function play(t) {
  const { playGame } = await import('./game.mjs');
  const us = { ...t.ours, name: 'Ours' }, them = { ...t.theirs, name: 'Theirs' };
  const [p1, p2] = t.swap ? [them, us] : [us, them];
  const t0 = performance.now();
  const r = await playGame(p1, p2, t.seed);
  const ourSide = t.swap ? 'p2' : 'p1', theirSide = t.swap ? 'p1' : 'p2';
  return { i: t.i, seed: t.seed, ours: t.ours.ref, theirs: t.theirs.ref, oursAs: ourSide, preview: t.ours.preview, persona: t.theirs.persona, winner: r.winner === 'tie' ? 'tie' : r.winner === ourSide ? 'ours' : 'theirs', turns: r.turns,
    our: r.summary[ourSide], their: r.summary[theirSide], errors: r.errors, refusals: r.refusals, ms: Math.round(performance.now() - t0) };
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
  for (const l of metrics(recs)) console.log(l);
}

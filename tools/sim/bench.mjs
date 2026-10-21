// Throughput: random-vs-random Champions Reg M-C doubles games, single-threaded, then a worker_threads pool (one per core).
// Run: node tools/sim/bench.mjs [gamesPerWorker=40]
import { createRequire } from 'node:module';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { cpus } from 'node:os';

const require = createRequire(import.meta.url);
const PS = new URL('./vendor/pokemon-showdown/dist/sim/', import.meta.url).pathname;
const FORMAT = 'gen9championsvgc2026regmc';

async function game(sim, p1team, p2team, seed) {
  const { BattleStream, getPlayerStreams, RandomPlayerAI } = sim;
  const streams = getPlayerStreams(new BattleStream());
  void new RandomPlayerAI(streams.p1, { seed: [seed, 1, 2, 3], mega: 0.7 }).start();
  void new RandomPlayerAI(streams.p2, { seed: [seed, 4, 5, 6], mega: 0.7 }).start();
  let winner = null, turns = 0;
  const done = (async () => { for await (const chunk of streams.omniscient) { const w = chunk.match(/\|win\|(.+)/); if (w) winner = w[1]; else if (/\|tie\b/.test(chunk)) winner = 'tie'; const t = [...chunk.matchAll(/\|turn\|(\d+)/g)].at(-1); if (t) turns = +t[1]; } })();
  void streams.omniscient.write(`>start ${JSON.stringify({ formatid: FORMAT, seed: [seed, 7, 8, 9] })}\n>player p1 ${JSON.stringify({ name: 'Anthony', team: p1team })}\n>player p2 ${JSON.stringify({ name: 'ZhuZi', team: p2team })}`);
  await done;
  return { winner, turns };
}
async function run(n, offset, p1, p2) {
  const ps = require(`${PS}index.js`);
  const sim = { ...ps, RandomPlayerAI: require(`${PS}tools/random-player-ai.js`).RandomPlayerAI };
  const out = [];
  for (let i = 0; i < n; i++) out.push(await game(sim, p1, p2, offset + i + 1));
  return out;
}

if (isMainThread) {
  const { anthonyTeam, zhuziTeams } = await import('./teams.mjs');
  const { Teams } = require(`${PS}index.js`);
  const p1 = Teams.pack(Teams.import(anthonyTeam())), p2 = Teams.pack(Teams.import(zhuziTeams()[0].text));
  const per = Number(process.argv[2] ?? 40);
  await run(3, 9000, p1, p2); // warm-up
  let t = performance.now();
  const single = await run(per, 0, p1, p2);
  const s1 = (performance.now() - t) / 1000;
  console.log(`single thread: ${per} games in ${s1.toFixed(2)} s = ${(per / s1).toFixed(1)} games/s; avg ${(single.reduce((a, g) => a + g.turns, 0) / per).toFixed(1)} turns`);
  const n = cpus().length;
  t = performance.now();
  const results = await Promise.all(Array.from({ length: n }, (_, k) => new Promise((res, rej) => {
    const w = new Worker(new URL(import.meta.url), { workerData: { n: per, offset: 1000 * (k + 1), p1, p2 } });
    w.once('message', res); w.once('error', rej);
  })));
  const s2 = (performance.now() - t) / 1000;
  const all = results.flat();
  const wins = all.filter((g) => g.winner === 'Anthony').length;
  console.log(`pool: ${n} workers × ${per} = ${all.length} games in ${s2.toFixed(2)} s = ${(all.length / s2).toFixed(1)} games/s (${(all.length / s2 / (per / s1)).toFixed(1)}× single); random-vs-random Anthony wins ${wins}/${all.length}`);
} else {
  parentPort.postMessage(await run(workerData.n, workerData.offset, workerData.p1, workerData.p2));
}

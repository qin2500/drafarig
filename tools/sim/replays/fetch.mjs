// Download public Pokémon Showdown replays of the format, for learning how people actually play: an opponent / policy
// model (what humans click in a position), team-preview choices, and set inference from what gets revealed. Polite: one
// request per second with an identifying User-Agent, newest first, then walking back in time; resumable (state.json) and
// incremental (re-running picks up new uploads and continues the walk back). Only rated games at or above --min-rating
// have their logs downloaded. Stored under tools/sim/results/replays/ (gitignored), one JSON line per replay.
//   node tools/sim/replays/fetch.mjs [--formats gen9championsvgc2026regmc,gen9championsvgc2026regmcbo3] [--min-rating 1300]
//     [--max 0 (no limit)] [--delay 1000]
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';

const ROOT = new URL('../../../', import.meta.url).pathname;
const DIR = `${ROOT}tools/sim/results/replays/`;
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i < 0 ? d : args[i + 1]; };
const FORMATS = opt('formats', 'gen9championsvgc2026regmc,gen9championsvgc2026regmcbo3').split(',');
const MIN = Number(opt('min-rating', 1300)), MAX = Number(opt('max', 0)), DELAY = Number(opt('delay', 1000));
const UA = 'drafarig-research/1.0 (personal VGC study tool; low-rate; one request per second)';
mkdirSync(DIR, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const statePath = `${DIR}state.json`;
const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : {};
const save = () => writeFileSync(statePath, JSON.stringify(state, null, 1));

let last = 0;
async function get(url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const wait = last + DELAY - Date.now(); if (wait > 0) await sleep(wait);
    last = Date.now();
    try {
      const r = await fetch(url, { headers: { 'user-agent': UA } });
      if (r.status === 429 || r.status >= 500) { await sleep(30_000 * (attempt + 1)); continue; }
      if (!r.ok) return null;
      return await r.json();
    } catch { await sleep(10_000 * (attempt + 1)); }
  }
  return null;
}

let fetched = 0;
for (const fmt of FORMATS) {
  const S = (state[fmt] ??= { newest: 0, oldest: 0, done: false, seen: 0, kept: 0 });
  const out = `${DIR}${fmt}.jsonl`;
  const have = new Set(existsSync(out) ? readFileSync(out, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l).id) : []);
  // pass 1: anything newer than what we have; pass 2: continue walking back from the oldest we've reached
  for (const pass of ['new', 'old']) {
    if (pass === 'old' && S.done) continue;
    let before = pass === 'new' ? 0 : S.oldest;
    for (;;) {
      if (MAX && fetched >= MAX) break;
      const page = await get(`https://replay.pokemonshowdown.com/search.json?format=${fmt}${before ? `&before=${before}` : ''}`);
      if (!page?.length) { if (pass === 'old') S.done = true; break; }
      let reachedKnown = false;
      for (const x of page.slice(0, 50)) {
        if (pass === 'new' && x.uploadtime <= S.newest) { reachedKnown = true; break; }
        S.seen++;
        if (have.has(x.id) || x.private || !(x.rating >= MIN)) continue;
        const r = await get(`https://replay.pokemonshowdown.com/${x.id}.json`);
        if (!r?.log) continue;
        appendFileSync(out, JSON.stringify({ id: x.id, format: fmt, uploadtime: x.uploadtime, rating: x.rating, players: x.players, log: r.log }) + '\n');
        have.add(x.id); S.kept++; fetched++;
      }
      const times = page.map((x) => x.uploadtime);
      if (pass === 'new') S.newest = Math.max(S.newest, ...times);
      S.oldest = S.oldest ? Math.min(S.oldest, ...times) : Math.min(...times);
      before = Math.min(...times);
      save();
      if (fetched && fetched % 200 < 50) console.log(`${new Date().toISOString().slice(0, 16)} ${fmt}: kept ${S.kept} (seen ${S.seen}), back to ${new Date(S.oldest * 1000).toISOString().slice(0, 10)}`);
      if (reachedKnown || page.length < 51) { if (pass === 'old' && page.length < 51) S.done = true; break; }
    }
    save();
  }
}
console.log('done:', JSON.stringify(state));

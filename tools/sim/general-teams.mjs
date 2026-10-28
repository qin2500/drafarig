// Format-wide teams for training the value network on VGC in general, not on any league coach or matchup: each six is
// grown from the format's ladder usage (data/cache usage), starting from a species drawn by usage and adding teammates
// drawn from the ladder's teammate data, so teams look like real ladder teams rather than random piles. Sets are drawn
// among each species' common abilities, items, moves and spreads. Species clause, item clause, at most two Mega Stones;
// every team passes Showdown's validator. Deterministic per seed, so the nightly trainer can draw a fresh training pool
// each night while the held-out benchmark pool (its own seed range) never changes.
//   node tools/sim/general-teams.mjs --out tools/sim/candidates/general/train-3 --n 64 --seed 3000
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { DEX, PS, toID } from './ai/data.mjs';

const root = new URL('../../', import.meta.url);
const usage = JSON.parse(readFileSync(new URL('data/cache/usage-gen9championsvgc2026regmc.json', root), 'utf8')).species;
const validator = PS.TeamValidator.get('gen9championsvgc2026regmc');

/** sampler seeded per call: mulberry32 */
const rng = (seed) => { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const pickW = (r, list) => { const tot = list.reduce((a, [, w]) => a + w, 0); let u = r() * tot; for (const x of list) { u -= x[1]; if (u <= 0) return x[0]; } return list[0][0]; };

// usage id → { base species, forced item } (a Mega's usage entry stands for its base species holding the stone)
function formOf(id) {
  const sp = DEX.species.get(id);
  if (!sp.exists) return null;
  if (sp.isMega && sp.requiredItem) return { base: DEX.species.get(sp.baseSpecies).name, item: sp.requiredItem, mega: true };
  return { base: sp.name, item: null, mega: false };
}
const POOL = Object.entries(usage).filter(([id, u]) => formOf(id) && u.moves?.length >= 4 && u.spreads?.length).map(([id, u]) => [id, u.usage]);

function setFor(r, id, used, stones) {
  const u = usage[id], f = formOf(id);
  let item = f.item;
  if (!item) {
    const items = u.items.filter(([it]) => DEX.items.get(it).exists && !used.has(it) && !(DEX.items.get(it).megaStone && stones >= 2)).slice(0, 4);
    item = items.length ? DEX.items.get(pickW(r, items)).name : '';
  }
  if (item && used.has(toID(item))) return null;
  const ability = pickW(r, u.abilities.slice(0, 2).filter(([, w]) => w >= 5).concat(u.abilities.slice(0, 1)));
  const top = u.moves.slice(0, 7).filter(([m]) => DEX.moves.get(m).exists);
  const moves = [];
  while (moves.length < Math.min(4, top.length)) moves.push(pickW(r, top.filter(([x]) => !moves.includes(x))));
  const [nature, sps] = pickW(r, u.spreads.slice(0, 3)).split(':');
  const [hp, atk, def, spa, spd, spe] = sps.split('/').map(Number);
  return { name: f.base, species: f.base, item, ability: DEX.abilities.get(ability).name, nature, level: 50, gender: '',
    evs: { hp, atk, def, spa, spd, spe }, ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, moves: moves.map((m) => DEX.moves.get(m).name) };
}

/** One six from seed: usage-drawn lead species, then teammates by the ladder's teammate data of the team so far. */
export function generalTeam(seed) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const r = rng(seed * 101 + attempt);
    const ids = [pickW(r, POOL)];
    while (ids.length < 6) {
      const bases = new Set(ids.map((x) => formOf(x).base));
      const mates = new Map();
      for (const x of ids) for (const [m, w] of usage[x].teammates ?? []) if (usage[m] && formOf(m) && !bases.has(formOf(m).base)) mates.set(m, (mates.get(m) ?? 0) + w);
      const cand = mates.size && r() < 0.8 ? [...mates] : POOL.filter(([m]) => !bases.has(formOf(m).base));
      ids.push(pickW(r, cand));
    }
    const used = new Set(); let stones = 0; const sets = [];
    for (const id of ids) {
      const s = setFor(r, id, used, stones);
      if (!s) break;
      if (s.item) { used.add(toID(s.item)); if (DEX.items.get(s.item).megaStone) stones++; }
      sets.push(s);
    }
    if (sets.length < 6) continue;
    if (validator.validateTeam(sets)?.length) continue;
    return PS.Teams.export(sets);
  }
  return null;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i < 0 ? d : args[i + 1]; };
  const out = opt('out', 'tools/sim/candidates/general/train'), n = Number(opt('n', 64)), seed = Number(opt('seed', 1));
  const dir = new URL(`${out.replace(/\/$/, '')}/`, root);
  mkdirSync(dir, { recursive: true });
  const files = [];
  for (let k = 0, s = seed; files.length < n && k < n * 4; k++, s++) {
    const t = generalTeam(s);
    if (!t) continue;
    const f = `g${s}.txt`;
    writeFileSync(new URL(f, dir), t);
    files.push(f);
  }
  writeFileSync(new URL('index.json', dir), JSON.stringify({ seed, n: files.length, written: new Date().toISOString(), files }, null, 1));
  console.log(`${files.length} format-wide teams → ${out} (all pass the validator)`);
}

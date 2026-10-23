// A fixed-size encoding of a Showdown battle position from one side's point of view, for the value network (net.mjs).
// Layout: our 4 brought Pokémon, then theirs (actives first, by slot, then the bench in team order; missing = zeros),
// each as types + base stats (of its current form, so a Mega counts as the Mega) + state; then the field; then the
// heuristic value's terms and the Showdown features of value.mjs (expert features: they let a small network learn from a
// few thousand games). Species-agnostic on purpose: the network must carry over to any opponent in the league, not learn
// one roster's names. Nothing here reads a hidden set: typing, base stats, HP, status, boosts, Mega, "has an item".
import { LEARNED_PARTS, FEATURES } from './value.mjs';

const TYPES = ['Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy'];
const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
const STATUS = ['brn', 'par', 'slp', 'psn', 'frz'];
const BOOSTS = ['atk', 'def', 'spa', 'spd', 'spe'];
const PER_MON = TYPES.length + STATS.length + 5 + STATUS.length + BOOSTS.length + 3;
const FIELD = 4 + 4 + 1 + 8 + 1;
export const ENC_SIZE = 8 * PER_MON + FIELD + LEARNED_PARTS.length + FEATURES.length;


function monInto(out, o, p, side) {
  for (const t of p.species.types) { const k = TYPES.indexOf(t); if (k >= 0) out[o + k] = 1; }
  let i = o + TYPES.length;
  for (const st of STATS) out[i++] = (p.species.baseStats[st] ?? 0) / 150;
  const alive = p.hp > 0 && !p.fainted;
  const pos = p.isActive ? side.active.indexOf(p) : -1;
  out[i++] = alive ? 1 : 0;
  out[i++] = alive ? p.hp / p.maxhp : 0;
  out[i++] = p.isActive && alive ? 1 : 0;
  out[i++] = pos === 0 && alive ? 1 : 0;
  out[i++] = pos === 1 && alive ? 1 : 0;
  for (const s of STATUS) out[i++] = alive && (p.status === s || (s === 'psn' && p.status === 'tox')) ? 1 : 0;
  for (const b of BOOSTS) out[i++] = alive && p.isActive ? (p.boosts[b] ?? 0) / 6 : 0;
  out[i++] = p.species.isMega ? 1 : 0;
  out[i++] = alive && p.canMegaEvo ? 1 : 0;
  out[i++] = alive && p.item ? 1 : 0;
}
function sideInto(out, o, side) {
  const order = [...side.active.filter(Boolean), ...side.pokemon.filter((p) => !p.isActive)].slice(0, 4);
  order.forEach((p, n) => monInto(out, o + n * PER_MON, p, side));
}

/** The encoding (Float32Array of ENC_SIZE) of battle `b` for side `me`; parts = valueParts object, ps = features array. */
export function encode(b, me, parts, ps) {
  const out = new Float32Array(ENC_SIZE);
  const A = b.getSide(me), B = b.getSide(me === 'p1' ? 'p2' : 'p1');
  sideInto(out, 0, A);
  sideInto(out, 4 * PER_MON, B);
  let i = 8 * PER_MON;
  const f = b.field, wt = f.weather ? Math.min(8, f.weatherState?.duration ?? 0) / 5 : 0;
  for (const w of ['sunnyday', 'raindance', 'sandstorm', 'snowscape']) out[i++] = f.weather === w || (w === 'sunnyday' && f.weather === 'desolateland') ? wt : 0;
  const tt = f.terrain ? Math.min(8, f.terrainState?.duration ?? 0) / 5 : 0;
  for (const t of ['electricterrain', 'grassyterrain', 'psychicterrain', 'mistyterrain']) out[i++] = f.terrain === t ? tt : 0;
  out[i++] = f.pseudoWeather.trickroom ? (f.pseudoWeather.trickroom.duration ?? 0) / 5 : 0;
  for (const s of [A, B]) for (const c of ['tailwind', 'reflect', 'lightscreen', 'auroraveil']) out[i++] = s.sideConditions[c] ? (s.sideConditions[c].duration ?? 0) / 5 : 0;
  out[i++] = Math.min(30, b.turn) / 20;
  for (const k of LEARNED_PARTS) out[i++] = parts[k] ?? 0;
  for (let k = 0; k < FEATURES.length; k++) out[i++] = ps[k] ?? 0;
  return out;
}

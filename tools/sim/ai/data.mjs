// Shared data for the sim AI: the pinned Showdown build (move semantics, team import, PRNG) and the app's own calc engine
// (lib/calc: damage and stats, parity-checked against Showdown in tools/sim/NOTES.md).
import { createRequire } from 'node:module';
import { mech, newCalc } from '../../../test/calc-helpers.mjs';
import { setStats } from '../../../lib/calc/mech.mjs';

const require = createRequire(import.meta.url);
export const PS_DIR = new URL('../vendor/pokemon-showdown/dist/sim/', import.meta.url).pathname;
export const PS = require(`${PS_DIR}index.js`);
export const { RandomPlayerAI } = require(`${PS_DIR}tools/random-player-ai.js`);
export const { BattlePlayer } = require(`${PS_DIR}battle-stream.js`);
export const DEX = PS.Dex.mod('champions');
export const FORMAT = 'gen9championsvgc2026regmc';
export const toID = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
export { mech };
export const calc = newCalc();

const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
/** Showdown export text → calc sets ({ name, species, item, ability, nature, moves, sp }) in team order. */
export function setsFromText(text) {
  return PS.Teams.import(text).map((s) => ({
    name: s.name || s.species, species: toID(s.species), item: toID(s.item), ability: toID(s.ability), nature: toID(s.nature || 'serious'),
    moves: s.moves.map(toID), sp: Object.fromEntries(STATS.map((k) => [k, s.evs?.[k] ?? 0])),
  }));
}
export const packTeam = (text) => PS.Teams.pack(PS.Teams.import(text));

/** The Mega forme a set becomes (or null). */
export const megaForme = (set) => mech.items[set.item]?.megaStone?.[set.species] ?? null;
const statCache = new Map();
/** Battle stats of a set (Mega-evolved or not), cached. */
export function statsOf(set, mega) {
  const k = `${set.species}|${set.item}|${set.nature}|${JSON.stringify(set.sp)}|${mega}`;
  if (!statCache.has(k)) statCache.set(k, setStats(mech, set, { megaEvolved: !!mega }));
  return statCache.get(k);
}
/** The species data in battle (Mega forme when evolved). */
export const speciesOf = (set, mega) => mech.species[(mega && megaForme(set)) || set.species];
/** The ability in battle (a Mega's own). */
export function abilityOf(set, mega) {
  const f = mega && megaForme(set);
  return f ? toID(DEX.species.get(f).abilities[0]) : set.ability;
}
export const typesOf = (set, mega) => speciesOf(set, mega)?.types ?? [];

const moveCache = new Map();
/** Move semantics from Showdown's data (target, priority, flags, effects). */
export function moveOf(id) {
  if (!moveCache.has(id)) moveCache.set(id, DEX.moves.get(id));
  return moveCache.get(id);
}
export const PROTECTS = new Set(['protect', 'detect', 'kingsshield', 'spikyshield', 'banefulbunker', 'silktrap', 'burningbulwark', 'obstruct', 'maxguard']);
export const SPREAD = new Set(['allAdjacentFoes', 'allAdjacent']);
export const SINGLE = new Set(['normal', 'any', 'adjacentFoe', 'randomNormal']);

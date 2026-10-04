// Shared loaders for the calc tests: the vendored engine module exactly as the browser loads it, the shipped projection,
// and a small set builder. Synthetic sets only.
import { readFileSync } from 'node:fs';
import * as engine from '../public/vendor/smogon-calc-0.12.0.mjs';
import { loadMechanics } from '../lib/calc/mech.mjs';
import { createCalc } from '../lib/calc/wrapper.mjs';

const ROOT = new URL('../', import.meta.url);
export const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');
export const mechRaw = JSON.parse(read('data/mechanics.json'));
export const mech = loadMechanics(mechRaw);
export { engine };
export const newCalc = () => createCalc(engine, mech);
export const SOURCE = JSON.parse(read('public/vendor/smogon-calc.SOURCE.json'));
export const ENGINE_INFO = { name: SOURCE.name, version: SOURCE.version, sha256: SOURCE.output.sha256 };

/** set('garchomp', 'roughskin', 'jolly', {atk:32,spe:32,hp:2}, ['earthquake'], 'lifeorb') */
export const set = (species, ability, nature, sp, moves, item = '') => ({ species, item, ability, nature, moves, sp: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, ...sp } });
export const CHOMP = set('garchomp', 'roughskin', 'jolly', { atk: 32, spe: 32, hp: 2 }, ['earthquake', 'rockslide', 'dragonclaw', 'protect']);
export const INCIN = set('incineroar', 'blaze', 'careful', { hp: 32, def: 2, spd: 32 }, ['fakeout', 'flareblitz', 'partingshot']);
export const sc = (attacker, defender, move, extra = {}) => ({ attacker: { set: attacker, state: extra.a ?? {} }, defender: { set: defender, state: extra.d ?? {} }, move: { id: move, ...(extra.move ?? {}) }, field: extra.field ?? {} });
export const rolls = (r) => r.hitRows?.[0];

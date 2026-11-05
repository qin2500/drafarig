// The Hex (Week 4, round 2) guide's calcs for six nC19 (Charizard, Scarf Pelipper, Mega Kangaskhan, Morpeko, Guts
// Conkeldurr, Rotom-Fan), computed exactly as verify_curated.mjs re-runs them (hex-calcs.mjs run()).
//   node docs/research/strategy/sim/scripts/hex2-guide-calcs.mjs [--json]
import { run, O, H as H1 } from './hex-calcs.mjs';
const SP = (hp, atk, def, spa, spd, spe) => ({ hp, atk, def, spa, spd, spe });
export const O2 = {
  ZARD: O.ZARD, MORPEKO: O.MORPEKO, MORPEKO_HANGRY: O.MORPEKO_HANGRY,
  PEL: { id: 'pelipper', set: 'ours', ability: 'drizzle', item: 'choicescarf', nature: 'Modest', sp: SP(2, 0, 0, 32, 0, 32) },
  KANGA: { id: 'kangaskhanmega', set: 'ours', ability: 'parentalbond', item: 'kangaskhanite', nature: 'Adamant', sp: SP(32, 32, 2, 0, 0, 0) },
  CONK: { id: 'conkeldurr', set: 'ours', ability: 'guts', item: 'lifeorb', nature: 'Brave', sp: SP(32, 32, 0, 0, 2, 0) },
  ROTOMF: { id: 'rotomfan', set: 'ours', ability: 'levitate', item: 'expertbelt', nature: 'Modest', sp: SP(32, 0, 0, 32, 2, 0) },
};
export const H = {
  ...H1,
  ROTOMH_SCARF: { id: 'rotomheat', set: 'ladder', ability: 'levitate', item: 'choicescarf', nature: 'Timid', sp: SP(2, 0, 0, 32, 0, 32) },
  KLEAVOR_RS: { id: 'kleavor', set: 'worst', ability: 'sharpness', item: 'choicescarf', nature: 'Jolly', sp: SP(2, 32, 0, 0, 0, 32) },
};
const RAIN = { weather: 'Rain' }, SUN = { weather: 'Sun' }, PSY = { terrain: 'Psychic' }, NONE = {};
const P = O2.PEL, K = O2.KANGA, C = O2.CONK, R = O2.ROTOMF, M = O2.MORPEKO_HANGRY, Z = O2.ZARD;
export const CALCS2 = [
  // ours into his
  [P, H.ROTOMH, 'weatherball', RAIN], [P, H.ROTOMH_SCARF, 'weatherball', RAIN], [P, H.KLEAVOR, 'weatherball', RAIN], [P, H.ARMA, 'weatherball', RAIN], [P, H.ARMA_FAST, 'weatherball', RAIN],
  [P, H.CHOMPZ, 'weatherball', RAIN], [P, H.CHOMP_LO, 'weatherball', RAIN], [P, H.INDEE, 'weatherball', RAIN], [P, H.CORV, 'hurricane', RAIN], [P, H.INDEE, 'hurricane', RAIN], [P, H.DRAMPA, 'hydropump', NONE],
  [K, H.INDEE, 'doubleedge', PSY], [K, H.ROTOMH, 'doubleedge', NONE], [K, H.ARMA, 'doubleedge', NONE], [K, H.CORV, 'doubleedge', NONE], [K, H.CHOMPZ, 'doubleedge', NONE], [K, H.DRAMPA, 'doubleedge', NONE], [K, H.KLEAVOR, 'doubleedge', NONE], [K, H.BANETTE, 'doubleedge', NONE],
  [K, H.ROTOMH, 'rockslide', NONE], [K, H.CORV, 'rockslide', NONE],
  [C, H.DRAMPA, 'drainpunch', NONE], [C, H.DRAMPA_MEGA, 'drainpunch', NONE], [C, H.INDEE, 'drainpunch', NONE], [C, H.KLEAVOR, 'drainpunch', NONE], [C, H.ROTOMH, 'drainpunch', NONE], [C, H.CHOMP_LO, 'drainpunch', NONE],
  [C, H.ROTOMH, 'rockslide', NONE], [C, H.CORV, 'rockslide', NONE], [C, H.CHOMPZ, 'machpunch', NONE],
  [M, H.ARMA, 'aurawheel', NONE], [M, H.INDEE, 'aurawheel', PSY], [M, H.BANETTE, 'aurawheel', NONE],
  [R, H.CORV, 'thunderbolt', NONE], [R, H.ARMA, 'thunderbolt', NONE], [R, H.INDEE, 'thunderbolt', NONE], [R, H.KLEAVOR, 'thunderbolt', NONE], [R, H.DRAMPA, 'thunderbolt', NONE], [R, H.ROTOMH, 'thunderbolt', NONE],
  [Z, H.KLEAVOR, 'heatwave', SUN], [Z, H.CORV, 'weatherball', SUN],
  // his into ours
  [H.KLEAVOR, P, 'stoneaxe', RAIN], [H.KLEAVOR, R, 'stoneaxe', NONE], [H.KLEAVOR, Z, 'stoneaxe', SUN], [H.KLEAVOR, K, 'stoneaxe', NONE], [H.KLEAVOR, C, 'stoneaxe', NONE], [H.KLEAVOR, O2.MORPEKO, 'closecombat', NONE],
  [H.KLEAVOR_RS, P, 'rockslide', RAIN], [H.KLEAVOR_RS, R, 'rockslide', NONE], [H.CHOMP_LO, P, 'rockslide', RAIN], [H.CHOMP_LO, R, 'rockslide', NONE], [H.CHOMP_LO, Z, 'rockslide', SUN],
  [H.ROTOMH, P, 'thunderbolt', RAIN], [H.ROTOMH, R, 'thunderbolt', NONE], [H.ROTOMH, K, 'overheat', NONE], [H.ROTOMH, K, 'overheat', RAIN], [H.ROTOMH, C, 'overheat', NONE], [H.ROTOMH, C, 'overheat', RAIN],
  [H.ARMA, C, 'expandingforce', PSY], [H.ARMA, K, 'expandingforce', PSY], [H.ARMA, P, 'expandingforce', PSY], [H.ARMA, R, 'expandingforce', PSY], [H.INDEE, C, 'psychic', PSY],
  [H.CHOMPZ, P, 'dracometeor', NONE], [H.CHOMPZ, O2.MORPEKO, 'dracometeor', NONE], [H.CHOMPZ, K, 'dracometeor', NONE], [H.DRAMPA, C, 'dracometeor', NONE], [H.DRAMPA, P, 'hypervoice', NONE],
].map(([attacker, defender, move, field]) => run({ attacker, defender, move, field }));
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  if (process.argv.includes('--json')) console.log(JSON.stringify(CALCS2, null, 1));
  else for (const c of CALCS2) console.log(`${c.attacker.id}${c.attacker.form ? '(' + c.attacker.form + ')' : ''} ${c.move} -> ${c.defender.id}${c.field.weather ? ' [' + c.field.weather + ']' : ''}${c.field.terrain ? ' [psy terrain]' : ''}: ${c.range}`);
}

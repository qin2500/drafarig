// Week 5 mock (Hex vs Calvin, lib/mocks/1v8.mjs): calcs in the APP engine exactly as verify_curated.mjs re-runs them
// (hex-calcs.mjs run(): same side() mapping, single move, defender Protect, weather + terrain only, doubles spread rule).
// Sets: Hex = gen_hex_vs_calvin.py HX library ('mock'); Calvin = its K library ('ladder' / 'worst').
//   node docs/research/strategy/sim/scripts/hex-vs-calvin-calcs.mjs [--json]
import { run } from './hex-calcs.mjs';

const SP = (hp, atk, def, spa, spd, spe) => ({ hp, atk, def, spa, spd, spe });
export const X = { // Hex (mock)
  CHOMPZ: { id: 'garchompmegaz', set: 'mock', ability: 'roughskin', item: 'garchompitez', nature: 'Modest', sp: SP(2, 0, 0, 32, 0, 32) },
  CHOMP_LO: { id: 'garchomp', set: 'mock', ability: 'roughskin', item: 'lifeorb', nature: 'Jolly', sp: SP(2, 32, 0, 0, 0, 32) },
  INDEE: { id: 'indeedeef', set: 'mock', ability: 'psychicsurge', item: 'rockyhelmet', nature: 'Relaxed', sp: SP(32, 0, 32, 0, 2, 0) },
  ARMA: { id: 'armarouge', set: 'mock', ability: 'flashfire', item: 'lifeorb', nature: 'Quiet', sp: SP(32, 0, 0, 32, 2, 0) },
  ARMA_EB: { id: 'armarouge', set: 'mock', ability: 'flashfire', item: 'expertbelt', nature: 'Quiet', sp: SP(32, 0, 0, 32, 2, 0) },
  ARMA_FAST: { id: 'armarouge', set: 'mock', ability: 'flashfire', item: 'focussash', nature: 'Modest', sp: SP(2, 0, 0, 32, 0, 32) },
  ARMA_HW: { id: 'armarouge', set: 'mock', ability: 'flashfire', item: 'lifeorb', nature: 'Modest', sp: SP(2, 0, 0, 32, 0, 32) },
  CORV: { id: 'corviknight', set: 'mock', ability: 'mirrorarmor', item: 'leftovers', nature: 'Careful', sp: SP(32, 2, 0, 0, 32, 0) },
  ROTOMH: { id: 'rotomheat', set: 'mock', ability: 'levitate', item: 'sitrusberry', nature: 'Modest', sp: SP(32, 0, 0, 32, 2, 0) },
  DRAMPA: { id: 'drampa', set: 'mock', ability: 'berserk', item: 'lifeorb', nature: 'Quiet', sp: SP(32, 0, 0, 32, 2, 0) },
  DRAMPA_EB: { id: 'drampa', set: 'mock', ability: 'berserk', item: 'expertbelt', nature: 'Quiet', sp: SP(32, 0, 0, 32, 2, 0) },
  DRAMPA_MEGA: { id: 'drampamega', set: 'mock', ability: 'berserk', item: 'drampanite', nature: 'Quiet', sp: SP(32, 0, 2, 32, 0, 0) },
  KLEAVOR: { id: 'kleavor', set: 'mock', ability: 'sharpness', item: 'focussash', nature: 'Jolly', sp: SP(2, 32, 0, 0, 0, 32) },
  BANETTE: { id: 'banettemega', set: 'mock', ability: 'prankster', item: 'banettite', nature: 'Adamant', sp: SP(32, 32, 0, 0, 2, 0) },
  FORRE: { id: 'forretress', set: 'mock', ability: 'sturdy', item: 'rockyhelmet', nature: 'Relaxed', sp: SP(32, 0, 32, 0, 2, 0) },
};
export const K = { // Calvin
  RAP: { id: 'staraptormega', set: 'ladder', ability: 'contrary', item: 'staraptite', nature: 'Jolly', sp: SP(2, 32, 0, 0, 0, 32) },
  RAPS: { id: 'staraptor', set: 'ladder', ability: 'intimidate', item: 'choicescarf', nature: 'Jolly', sp: SP(32, 2, 0, 0, 0, 32) },
  GRIMM: { id: 'grimmsnarl', set: 'ladder', ability: 'prankster', item: 'lightclay', nature: 'Careful', sp: SP(32, 0, 19, 0, 15, 0) },
  VOLC: { id: 'volcarona', set: 'ladder', ability: 'flamebody', item: 'rockyhelmet', nature: 'Bold', sp: SP(32, 0, 32, 0, 2, 0) },
  VOLC_OFF: { id: 'volcarona', set: 'worst', ability: 'flamebody', item: 'sitrusberry', nature: 'Modest', sp: SP(32, 0, 11, 5, 1, 17) },
  BASC: { id: 'basculegionf', set: 'ladder', ability: 'swiftswim', item: 'focussash', nature: 'Modest', sp: SP(0, 0, 1, 32, 1, 32) },
  MAMO: { id: 'mamoswine', set: 'ladder', ability: 'oblivious', item: 'lifeorb', nature: 'Adamant', sp: SP(2, 32, 0, 0, 0, 32) },
  MAMO_SASH: { id: 'mamoswine', set: 'ladder', ability: 'oblivious', item: 'focussash', nature: 'Adamant', sp: SP(2, 32, 0, 0, 0, 32) },
  TSA: { id: 'tsareena', set: 'ladder', ability: 'queenlymajesty', item: 'widelens', nature: 'Jolly', sp: SP(2, 32, 0, 0, 0, 32) },
  EMP: { id: 'empoleon', set: 'ladder', ability: 'competitive', item: 'chopleberry', nature: 'Modest', sp: SP(32, 0, 0, 19, 0, 15) },
  JOLT: { id: 'jolteon', set: 'ladder', ability: 'voltabsorb', item: 'lifeorb', nature: 'Timid', sp: SP(1, 0, 1, 32, 0, 32) },
  TAUROS: { id: 'tauros', set: 'worst', ability: 'sheerforce', item: 'lifeorb', nature: 'Adamant', sp: SP(2, 32, 0, 0, 0, 32) },
};
const PSY = { terrain: 'Psychic' };
// [attacker, defender, move, field]; field.spread is informational (the engine applies the doubles spread rule itself)
export const CANDIDATES = [
  // Hex into Calvin
  [X.INDEE, K.RAP, 'psychic', PSY], [X.ARMA, K.RAP, 'expandingforce', PSY], [X.ARMA_EB, K.RAP, 'expandingforce', PSY], [X.CHOMPZ, K.RAP, 'dracometeor', {}],
  [X.DRAMPA, K.RAP, 'thunderbolt', {}], [X.DRAMPA, K.RAP, 'dracometeor', {}], [X.ROTOMH, K.RAP, 'thunderbolt', {}], [X.CORV, K.RAP, 'bravebird', {}],
  [X.KLEAVOR, K.VOLC, 'stoneaxe', {}], [X.KLEAVOR, K.VOLC_OFF, 'stoneaxe', {}], [X.CHOMPZ, K.VOLC, 'powergem', {}], [X.CHOMPZ, K.VOLC, 'earthpower', {}],
  [X.KLEAVOR, K.TAUROS, 'closecombat', {}], [X.KLEAVOR, K.MAMO, 'closecombat', {}], [X.KLEAVOR, K.TSA, 'xscissor', {}], [X.KLEAVOR, K.GRIMM, 'xscissor', {}],
  [X.KLEAVOR, K.RAP, 'stoneaxe', {}], [X.KLEAVOR, K.EMP, 'closecombat', {}],
  [X.ROTOMH, K.BASC, 'thunderbolt', {}], [X.ROTOMH, K.EMP, 'thunderbolt', {}], [X.ROTOMH, K.MAMO, 'overheat', {}], [X.ROTOMH, K.TSA, 'overheat', {}], [X.ROTOMH, K.GRIMM, 'overheat', {}],
  [X.ARMA, K.MAMO, 'armorcannon', {}], [X.ARMA, K.TSA, 'armorcannon', {}], [X.ARMA, K.GRIMM, 'armorcannon', {}], [X.ARMA_HW, K.TSA, 'heatwave', {}],
  [X.CHOMPZ, K.EMP, 'earthpower', {}], [X.CHOMPZ, K.JOLT, 'earthpower', {}], [X.CHOMPZ, K.TAUROS, 'dracometeor', {}], [X.CHOMPZ, K.BASC, 'dracometeor', {}], [X.CHOMPZ, K.GRIMM, 'earthpower', {}],
  [X.CHOMP_LO, K.VOLC, 'rockslide', {}], [X.CHOMP_LO, K.EMP, 'earthquake', {}],
  [X.DRAMPA, K.BASC, 'thunderbolt', {}], [X.DRAMPA, K.GRIMM, 'hypervoice', {}], [X.DRAMPA, K.TAUROS, 'dracometeor', {}], [X.DRAMPA_MEGA, K.RAP, 'dracometeor', {}],
  [X.BANETTE, K.BASC, 'poltergeist', {}], [X.BANETTE, K.GRIMM, 'poltergeist', {}],
  [X.INDEE, K.GRIMM, 'psychic', PSY],
  // Calvin into Hex
  [K.RAP, X.INDEE, 'closecombat', {}], [K.RAP, X.KLEAVOR, 'closecombat', {}], [K.RAP, X.DRAMPA, 'closecombat', {}], [K.RAP, X.CHOMPZ, 'bravebird', {}], [K.RAP, X.ARMA, 'bravebird', {}], [K.RAP, X.ROTOMH, 'bravebird', {}], [K.RAP, X.CORV, 'closecombat', {}],
  [K.RAPS, X.ARMA, 'finalgambit', {}], [K.RAPS, X.INDEE, 'finalgambit', {}],
  [K.GRIMM, X.CHOMPZ, 'spiritbreak', {}], [K.GRIMM, X.DRAMPA, 'spiritbreak', {}], [K.GRIMM, X.KLEAVOR, 'spiritbreak', {}],
  [K.MAMO, X.CHOMPZ, 'iciclecrash', {}], [K.MAMO, X.CHOMP_LO, 'iceshard', {}], [K.MAMO, X.ARMA, 'highhorsepower', {}], [K.MAMO, X.KLEAVOR, 'highhorsepower', {}], [K.MAMO, X.DRAMPA, 'iciclecrash', {}], [K.MAMO, X.INDEE, 'highhorsepower', {}],
  [K.BASC, X.ARMA, 'shadowball', {}], [K.BASC, X.ROTOMH, 'muddywater', {}], [K.BASC, X.KLEAVOR, 'muddywater', {}], [K.BASC, X.CHOMPZ, 'icebeam', {}], [K.BASC, X.ARMA, 'muddywater', {}],
  [K.EMP, X.ROTOMH, 'hydropump', {}], [K.EMP, X.ARMA, 'hydropump', {}], [K.EMP, X.KLEAVOR, 'hydropump', {}], [K.EMP, X.CHOMPZ, 'icebeam', {}],
  [K.TAUROS, X.KLEAVOR, 'closecombat', {}], [K.TAUROS, X.ARMA, 'rockslide', {}], [K.TAUROS, X.ROTOMH, 'rockslide', {}], [K.TAUROS, X.CHOMPZ, 'bodyslam', {}],
  [K.TSA, X.KLEAVOR, 'powerwhip', {}], [K.TSA, X.CHOMPZ, 'tripleaxel', {}], [K.TSA, X.ROTOMH, 'highjumpkick', {}], [K.TSA, X.INDEE, 'highjumpkick', {}],
  [K.VOLC_OFF, X.CORV, 'heatwave', {}], [K.VOLC_OFF, X.FORRE, 'heatwave', {}], [K.VOLC_OFF, X.KLEAVOR, 'heatwave', {}],
  [K.JOLT, X.CORV, 'thunderbolt', {}], [K.JOLT, X.KLEAVOR, 'thunderbolt', {}],
];

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const [a, d, move, field] of CANDIDATES) {
    const c = run({ attacker: a, defender: d, move, field });
    if (process.argv.includes('--json')) console.log(JSON.stringify(c));
    else console.log(`${a.id}${a.item === 'lifeorb' ? '(LO)' : ''} ${move} -> ${d.id}${d.item ? `(${d.item})` : ''}${field.terrain ? ' [Psychic Terrain]' : ''}: ${c.range}`);
  }
}

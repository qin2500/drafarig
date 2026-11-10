// Week 5 mock (Hex vs Calvin), team A = Psychic Spam six e146 (Indeedee-F, Armarouge, Corviknight, Mega Banette, Ditto,
// Forretress): extra calcs beyond hex-vs-calvin-calcs.mjs, app engine (hex-calcs.mjs run(), as verify_curated.mjs).
//   node docs/research/strategy/sim/scripts/hex-vs-calvin-psy-calcs.mjs
import { run } from './hex-calcs.mjs';
import { X, K } from './hex-vs-calvin-calcs.mjs';
const PSY = { terrain: 'Psychic' }, N = {};
export const PSY_CALCS = [
  [X.ARMA, K.BASC, 'expandingforce', PSY], [X.ARMA, K.MAMO, 'expandingforce', PSY], [X.ARMA, K.TSA, 'expandingforce', PSY], [X.ARMA, K.TAUROS, 'expandingforce', PSY],
  [X.ARMA, K.VOLC, 'expandingforce', PSY], [X.ARMA, K.EMP, 'expandingforce', PSY], [X.ARMA, K.JOLT, 'expandingforce', PSY],
  [X.INDEE, K.TAUROS, 'psychic', PSY], [X.INDEE, K.MAMO, 'psychic', PSY],
  [X.BANETTE, K.RAP, 'poltergeist', N], [X.BANETTE, K.MAMO, 'poltergeist', N], [X.BANETTE, K.VOLC, 'poltergeist', N], [X.BANETTE, K.TSA, 'poltergeist', N],
  [X.CORV, K.TSA, 'bravebird', N], [X.CORV, K.VOLC, 'bravebird', N],
  [K.MAMO, X.BANETTE, 'iciclecrash', N], [K.BASC, X.BANETTE, 'shadowball', N], [K.GRIMM, X.BANETTE, 'spiritbreak', N], [K.GRIMM, X.ARMA, 'spiritbreak', N],
  [K.RAP, X.BANETTE, 'bravebird', N], [K.TAUROS, X.BANETTE, 'rockslide', N], [K.EMP, X.INDEE, 'hydropump', N], [K.VOLC_OFF, X.ARMA, 'heatwave', N],
];
if (import.meta.url === `file://${process.argv[1]}`)
  for (const [a, d, m, f] of PSY_CALCS) console.log(`${a.id} ${m} -> ${d.id}(${d.item})${f.terrain ? ' [PT]' : ''}: ${run({ attacker: a, defender: d, move: m, field: f }).range}`);

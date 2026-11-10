// The Jacky (Week 5) guide's calcs for six yJ10 (Charizard Y, Sinistcha, Sash Wide Guard Pelipper, Taunt Morpeko,
// Iron Fist Conkeldurr, Rotom-Fan), computed exactly as verify_curated.mjs re-runs them (hex-calcs.mjs run()).
//   node docs/research/strategy/sim/scripts/jacky-guide-calcs.mjs [--json]
import { run } from './hex-calcs.mjs';
const SP = (hp, atk, def, spa, spd, spe) => ({ hp, atk, def, spa, spd, spe });
// ours (gen_jacky.py package J, as simmed in yJ10)
export const OJ = {
  ZARD: { id: 'charizardmegay', set: 'ours', ability: 'drought', item: 'charizarditey', nature: 'Modest', sp: SP(32, 0, 0, 32, 2, 0) },
  SINIS: { id: 'sinistcha', set: 'ours', ability: 'hospitality', item: 'sitrusberry', nature: 'Bold', sp: SP(32, 0, 14, 0, 20, 0) },
  PEL: { id: 'pelipper', set: 'ours', ability: 'drizzle', item: 'focussash', nature: 'Modest', sp: SP(2, 0, 0, 32, 0, 32) },
  MORPEKO: { id: 'morpeko', set: 'ours', ability: 'hungerswitch', item: 'lifeorb', nature: 'Jolly', sp: SP(2, 32, 0, 0, 0, 32) },
  CONK: { id: 'conkeldurr', set: 'ours', ability: 'ironfist', item: 'expertbelt', nature: 'Brave', sp: SP(32, 32, 0, 0, 2, 0) },
  ROTOMF: { id: 'rotomfan', set: 'ours', ability: 'levitate', item: 'leftovers', nature: 'Modest', sp: SP(32, 0, 0, 32, 2, 0) },
};
OJ.MORPEKO_HANGRY = { ...OJ.MORPEKO, form: 'hangry' };
// Jacky (gen_jacky.py J library: L = ladder modal, W = worst case)
export const J = {
  GOLI: { id: 'golisopodmega', set: 'ladder', ability: 'emergencyexit', item: 'golisopite', nature: 'Adamant', sp: SP(32, 32, 0, 0, 2, 0) },
  INCIN: { id: 'incineroar', set: 'ladder', ability: 'intimidate', item: 'sitrusberry', nature: 'Careful', sp: SP(32, 0, 14, 0, 20, 0) },
  FARI: { id: 'farigiraf', set: 'ladder', ability: 'armortail', item: 'focussash', nature: 'Bold', sp: SP(27, 0, 20, 0, 19, 0) },
  TORK: { id: 'torkoal', set: 'ladder', ability: 'drought', item: 'charcoal', nature: 'Quiet', sp: SP(32, 0, 0, 32, 2, 0) },
  MOW: { id: 'rotommow', set: 'ladder', ability: 'levitate', item: 'choicescarf', nature: 'Timid', sp: SP(2, 0, 0, 32, 0, 32) },
  MIMI: { id: 'mimikyu', set: 'ladder', ability: 'disguise', item: 'mentalherb', nature: 'Brave', sp: SP(32, 32, 2, 0, 0, 0) },
  RIME: { id: 'mrrime', set: 'ladder', ability: 'screencleaner', item: 'twistedspoon', nature: 'Quiet', sp: SP(32, 0, 2, 32, 0, 0) },
  LYC: { id: 'lycanrocmidnight', set: 'worst', ability: 'noguard', item: 'focussash', nature: 'Jolly', sp: SP(2, 32, 0, 0, 0, 32) },
  LYC_TR: { id: 'lycanrocmidnight', set: 'worst', ability: 'noguard', item: 'lifeorb', nature: 'Brave', sp: SP(32, 32, 2, 0, 0, 0) },
  ROTOM: { id: 'rotom', set: 'ladder', ability: 'levitate', item: 'leftovers', nature: 'Modest', sp: SP(32, 0, 0, 32, 2, 0) },
  APPLE: { id: 'appletun', set: 'ladder', ability: 'thickfat', item: 'sitrusberry', nature: 'Quiet', sp: SP(32, 0, 0, 32, 2, 0) },
};
const RAIN = { weather: 'Rain' }, SUN = { weather: 'Sun' }, N = {};
const O = OJ;
export const CALCS_J = [
  // ours into his
  [O.ZARD, J.GOLI, 'heatwave', SUN], [O.ZARD, J.FARI, 'heatwave', SUN], [O.ZARD, J.RIME, 'heatwave', SUN],
  [O.ZARD, J.MOW, 'heatwave', SUN], [O.ZARD, J.INCIN, 'heatwave', SUN], [O.ZARD, J.APPLE, 'heatwave', SUN], [O.ZARD, J.TORK, 'solarbeam', SUN], [O.ZARD, J.LYC, 'solarbeam', SUN],
  [O.PEL, J.TORK, 'weatherball', RAIN], [O.PEL, J.INCIN, 'weatherball', RAIN], [O.PEL, J.LYC, 'weatherball', RAIN], [O.PEL, J.GOLI, 'hurricane', RAIN], [O.PEL, J.FARI, 'weatherball', RAIN],
  [O.CONK, J.INCIN, 'drainpunch', N], [O.CONK, J.INCIN, 'drainpunch', { intimidate: 1 }], [O.CONK, J.GOLI, 'drainpunch', { intimidate: 1 }], [O.CONK, J.LYC, 'drainpunch', N], [O.CONK, J.FARI, 'drainpunch', N], [O.CONK, J.TORK, 'drainpunch', N], [O.CONK, J.GOLI, 'drainpunch', N],
  [O.CONK, J.MOW, 'icepunch', N], [O.CONK, J.APPLE, 'icepunch', N], [O.CONK, J.LYC, 'machpunch', N],
  [O.ROTOMF, J.GOLI, 'airslash', N], [O.ROTOMF, J.TORK, 'thunderbolt', N], [O.ROTOMF, J.INCIN, 'thunderbolt', N],
  [O.MORPEKO_HANGRY, J.FARI, 'aurawheel', N], [O.MORPEKO_HANGRY, J.RIME, 'aurawheel', N], [O.MORPEKO, J.TORK, 'aurawheel', N],
  [O.SINIS, J.LYC, 'matchagotcha', N], [O.SINIS, J.TORK, 'matchagotcha', N],
  // his into ours
  [J.TORK, O.ZARD, 'eruption', SUN], [J.TORK, O.SINIS, 'eruption', SUN], [J.TORK, O.CONK, 'eruption', SUN], [J.TORK, O.ROTOMF, 'eruption', SUN], [J.TORK, O.PEL, 'eruption', RAIN], [J.TORK, O.CONK, 'eruption', RAIN],
  [J.GOLI, O.MORPEKO, 'closecombat', N], [J.GOLI, O.ZARD, 'leechlife', N], [J.INCIN, O.CONK, 'flareblitz', SUN], [J.TORK, O.PEL, 'weatherball', RAIN], [J.GOLI, O.SINIS, 'leechlife', N], [J.GOLI, O.CONK, 'leechlife', N], [J.GOLI, O.ROTOMF, 'ironhead', N], [J.GOLI, O.PEL, 'leechlife', N],
  [J.LYC, O.ZARD, 'rockslide', SUN], [J.LYC, O.ROTOMF, 'rockslide', N], [J.LYC, O.PEL, 'rockslide', RAIN], [J.LYC_TR, O.ZARD, 'rockslide', SUN], [J.LYC, O.CONK, 'closecombat', N],
  [J.INCIN, O.SINIS, 'flareblitz', SUN], [J.INCIN, O.SINIS, 'darkestlariat', N],
  [J.FARI, O.PEL, 'thunderbolt', RAIN], [J.MOW, O.PEL, 'leafstorm', RAIN], [J.MOW, O.CONK, 'leafstorm', N],
  [J.MIMI, O.CONK, 'playrough', N], [J.MIMI, O.MORPEKO, 'playrough', N],
  [J.RIME, O.PEL, 'freezedry', RAIN], [J.RIME, O.ROTOMF, 'freezedry', N], [J.RIME, O.CONK, 'psychic', N],
  [J.ROTOM, O.PEL, 'thunderbolt', RAIN],
];
const fld = (f) => (f.weather ? ` [${f.weather}]` : '') + (f.intimidate ? ' [-1 Atk]' : '');
if (import.meta.url === `file://${process.argv[1]}`) {
  const out = CALCS_J.map(([a, d, move, field]) => run({ attacker: a, defender: d, move, field }));
  if (process.argv.includes('--json')) console.log(JSON.stringify(out, null, 1));
  else for (const r of out) console.log(`${r.attacker.id} ${r.move} -> ${r.defender.id}${fld(r.field)}: ${r.range}`);
}

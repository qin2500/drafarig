// The Hex (Week 4) guide's calcs, computed in the APP engine exactly as verify_curated.mjs re-runs them (same side()
// mapping, single move, defender Protect, weather + terrain only, doubles spread rule by default). Prints each calc as the
// guide's calc object (JSON) plus a readable line. node docs/research/strategy/sim/scripts/hex-calcs.mjs [--json]
const ROOT = new URL('../../../../../', import.meta.url);
const { newCalc, mech } = await import(new URL('test/calc-helpers.mjs', ROOT));
const calc = newCalc();
const toID = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
const megaOf = Object.fromEntries(Object.entries(mech.species).filter(([, v]) => v.mega).map(([k, v]) => [k, v.mega]));
function side(x) {
  const m = megaOf[x.id];
  const species = m ? m.from : x.id;
  return { set: { species, item: m ? m.item : x.item ?? '', ability: m ? toID(mech.species[species].abilities[0]) : x.ability, nature: toID(x.nature ?? 'serious'), moves: [], sp: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, ...(x.sp ?? {}) } }, state: { form: x.form ?? '' } };
}
export function run(c) {
  const a = side(c.attacker), d = side(c.defender);
  a.set.moves = [c.move]; d.set.moves = ['protect'];
  const r = calc.run({ attacker: a, defender: d, move: { id: c.move }, field: { weather: c.field?.weather ?? '', ...(c.field?.terrain ? { terrain: c.field.terrain } : {}) } });
  if (r.class !== 'exact') return { ...c, range: `${r.class}${r.code ? ' ' + r.code : ''}` };
  return { ...c, range: `${(100 * r.range.min / r.maxHP).toFixed(1)}–${(100 * r.range.max / r.maxHP).toFixed(1)}%` };
}
const SP = (hp, atk, def, spa, spd, spe) => ({ hp, atk, def, spa, spd, spe });
// ours (the finalists' sets: gen_hex.py A library)
export const O = {
  ZARD: { id: 'charizardmegay', set: 'ours', ability: 'drought', item: 'charizarditey', nature: 'Modest', sp: SP(32, 0, 0, 32, 2, 0) },
  MORPEKO: { id: 'morpeko', set: 'ours', ability: 'hungerswitch', item: 'focussash', nature: 'Jolly', sp: SP(2, 32, 0, 0, 0, 32) },
  MORPEKO_HANGRY: { id: 'morpeko', set: 'ours', ability: 'hungerswitch', item: 'focussash', nature: 'Jolly', sp: SP(2, 32, 0, 0, 0, 32), form: 'hangry' },
  CONK: { id: 'conkeldurr', set: 'ours', ability: 'ironfist', item: 'lifeorb', nature: 'Brave', sp: SP(32, 32, 0, 0, 2, 0) },
  SIMIPOUR: { id: 'simipour', set: 'ours', ability: 'torrent', item: 'mysticwater', nature: 'Modest', sp: SP(2, 0, 0, 32, 0, 32) },
  STUNFISK: { id: 'stunfiskgalar', set: 'ours', ability: 'mimicry', item: 'leftovers', nature: 'Brave', sp: SP(32, 32, 2, 0, 0, 0) },
  PELIPPER: { id: 'pelipper', set: 'ours', ability: 'drizzle', item: 'focussash', nature: 'Modest', sp: SP(2, 0, 0, 32, 0, 32) },
};
// Hex (L = ladder modal, W = worst case; gen_hex.py H library)
export const H = {
  INDEE: { id: 'indeedeef', set: 'ladder', ability: 'psychicsurge', item: 'rockyhelmet', nature: 'Relaxed', sp: SP(32, 0, 32, 0, 2, 0) },
  ARMA: { id: 'armarouge', set: 'ladder', ability: 'flashfire', item: 'lifeorb', nature: 'Quiet', sp: SP(32, 0, 0, 32, 2, 0) },
  ARMA_FAST: { id: 'armarouge', set: 'ladder', ability: 'flashfire', item: 'focussash', nature: 'Modest', sp: SP(2, 0, 0, 32, 0, 32) },
  DRAMPA: { id: 'drampa', set: 'ladder', ability: 'cloudnine', item: 'lifeorb', nature: 'Quiet', sp: SP(32, 0, 0, 32, 2, 0) },
  DRAMPA_MEGA: { id: 'drampamega', set: 'ladder', ability: 'berserk', item: 'drampanite', nature: 'Quiet', sp: SP(32, 0, 2, 32, 0, 0) },
  CHOMPZ: { id: 'garchompmegaz', set: 'ladder', ability: 'roughskin', item: 'garchompitez', nature: 'Modest', sp: SP(2, 0, 0, 32, 0, 32) },
  CHOMP_LO: { id: 'garchomp', set: 'ladder', ability: 'roughskin', item: 'lifeorb', nature: 'Jolly', sp: SP(2, 32, 0, 0, 0, 32) },
  CORV: { id: 'corviknight', set: 'ladder', ability: 'mirrorarmor', item: 'leftovers', nature: 'Careful', sp: SP(32, 2, 0, 0, 32, 0) },
  ROTOMH: { id: 'rotomheat', set: 'ladder', ability: 'levitate', item: 'sitrusberry', nature: 'Modest', sp: SP(32, 0, 0, 32, 2, 0) },
  KLEAVOR: { id: 'kleavor', set: 'ladder', ability: 'sharpness', item: 'focussash', nature: 'Jolly', sp: SP(2, 32, 0, 0, 0, 32) },
  KLEAVOR_SF: { id: 'kleavor', set: 'worst', ability: 'sheerforce', item: 'lifeorb', nature: 'Jolly', sp: SP(2, 32, 0, 0, 0, 32) },
  BANETTE: { id: 'banettemega', set: 'ladder', ability: 'prankster', item: 'banettite', nature: 'Adamant', sp: SP(32, 32, 0, 0, 2, 0) },
  FORRE: { id: 'forretress', set: 'worst', ability: 'sturdy', item: 'rockyhelmet', nature: 'Relaxed', sp: SP(32, 0, 32, 0, 2, 0) },
};
const SUN = { weather: 'Sun' }, PSY = { terrain: 'Psychic' };
export const CALCS = [
  // ours into his
  [O.ZARD, H.INDEE, 'heatwave', SUN], [O.ZARD, H.INDEE, 'heatwave', {}], [O.ZARD, H.CORV, 'heatwave', SUN], [O.ZARD, H.CORV, 'heatwave', {}], [O.ZARD, H.KLEAVOR, 'heatwave', SUN],
  [O.ZARD, H.CHOMPZ, 'heatwave', SUN], [O.ZARD, H.BANETTE, 'heatwave', SUN], [O.ZARD, H.FORRE, 'heatwave', SUN], [O.ZARD, H.DRAMPA, 'heatwave', {}], [O.ZARD, H.ROTOMH, 'solarbeam', SUN], [O.ZARD, H.CHOMPZ, 'solarbeam', SUN],
  [O.ZARD, H.INDEE, 'weatherball', SUN], [O.ZARD, H.CORV, 'weatherball', SUN],
  [O.MORPEKO_HANGRY, H.INDEE, 'aurawheel', PSY], [O.MORPEKO_HANGRY, H.ARMA, 'aurawheel', {}], [O.MORPEKO_HANGRY, H.ARMA_FAST, 'aurawheel', {}], [O.MORPEKO_HANGRY, H.BANETTE, 'aurawheel', {}], [O.MORPEKO_HANGRY, H.DRAMPA, 'aurawheel', {}],
  [O.MORPEKO, H.CORV, 'aurawheel', {}], [O.MORPEKO, H.ARMA, 'aurawheel', {}], [O.MORPEKO, H.INDEE, 'aurawheel', PSY], [O.MORPEKO, H.ROTOMH, 'aurawheel', {}],
  [O.SIMIPOUR, H.INDEE, 'scald', {}], [O.ZARD, H.ROTOMH, 'heatwave', SUN], [O.ZARD, H.CHOMP_LO, 'heatwave', SUN],
  [O.CONK, H.DRAMPA, 'drainpunch', {}], [O.CONK, H.DRAMPA_MEGA, 'drainpunch', {}], [O.CONK, H.INDEE, 'drainpunch', {}], [O.CONK, H.KLEAVOR, 'drainpunch', {}], [O.CONK, H.ROTOMH, 'drainpunch', {}], [O.CONK, H.CORV, 'drainpunch', {}],
  [O.CONK, H.CHOMPZ, 'icepunch', {}], [O.CONK, H.CHOMP_LO, 'icepunch', {}], [O.CONK, H.CHOMPZ, 'machpunch', {}], [O.CONK, H.ARMA, 'drainpunch', {}],
  [O.SIMIPOUR, H.ARMA, 'scald', {}], [O.SIMIPOUR, H.ARMA_FAST, 'scald', {}], [O.SIMIPOUR, H.ROTOMH, 'scald', {}], [O.SIMIPOUR, H.KLEAVOR, 'scald', {}], [O.SIMIPOUR, H.CHOMPZ, 'icebeam', {}], [O.SIMIPOUR, H.CHOMP_LO, 'icebeam', {}], [O.SIMIPOUR, H.DRAMPA, 'icebeam', {}], [O.SIMIPOUR, H.CORV, 'icebeam', {}],
  // his into ours
  [H.ARMA, O.CONK, 'expandingforce', PSY], [H.ARMA, O.SIMIPOUR, 'expandingforce', PSY], [H.ARMA, O.ZARD, 'expandingforce', PSY], [H.ARMA, O.STUNFISK, 'expandingforce', PSY], [H.ARMA, O.SIMIPOUR, 'armorcannon', {}],
  [H.INDEE, O.CONK, 'psychic', PSY], [H.CHOMPZ, O.ZARD, 'powergem', SUN], [H.CHOMPZ, O.SIMIPOUR, 'dracometeor', {}], [H.CHOMPZ, O.MORPEKO, 'dracometeor', {}], [H.CHOMPZ, O.CONK, 'dracometeor', {}],
  [H.CHOMP_LO, O.ZARD, 'rockslide', SUN], [H.KLEAVOR, O.ZARD, 'stoneaxe', SUN], [H.KLEAVOR_SF, O.ZARD, 'rockslide', SUN], [H.FORRE, O.ZARD, 'rockslide', SUN],
  [H.ROTOMH, O.ZARD, 'thunderbolt', SUN], [H.ROTOMH, O.SIMIPOUR, 'thunderbolt', {}], [H.ROTOMH, O.CONK, 'overheat', {}], [H.DRAMPA, O.CONK, 'dracometeor', {}], [H.DRAMPA_MEGA, O.SIMIPOUR, 'hypervoice', {}],
  [H.CORV, O.CONK, 'bravebird', {}], [H.BANETTE, O.ZARD, 'poltergeist', SUN], [H.BANETTE, O.MORPEKO, 'poltergeist', {}],
].map(([attacker, defender, move, field]) => run({ attacker, defender, move, field }));
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  if (process.argv.includes('--json')) console.log(JSON.stringify(CALCS, null, 1));
  else for (const c of CALCS) console.log(`${c.attacker.id}${c.attacker.form ? '(' + c.attacker.form + ')' : ''} ${c.move} -> ${c.defender.id}${c.field.weather ? ' [sun]' : ''}${c.field.terrain ? ' [psy terrain]' : ''}: ${c.range}`);
}

// Non-Mega Kangaskhan (Scrappy) vs Calvin's likely 6 + Empoleon / Jolteon, app engine. Writes ../match-calvin-kanga.md.
//   node docs/research/strategy/sp-assist/kanga_calvin.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import * as engine from '../../../../public/vendor/smogon-calc-0.12.0.mjs';
import { loadMechanics } from '../../../../lib/calc/mech.mjs';
import { createCalc } from '../../../../lib/calc/wrapper.mjs';
import { normalizeScenario } from '../../../../lib/calc/scenario.mjs';
import { STAT_IDS, statValue, natureSign } from '../../../../lib/calc/stats.mjs';
import * as B from '../../../../lib/prep-build.mjs';

const HERE = new URL('./', import.meta.url), ROOT = new URL('../../../../', import.meta.url);
const mech = loadMechanics(JSON.parse(readFileSync(new URL('data/mechanics.json', ROOT), 'utf8')));
const calc = createCalc(engine, mech);
const U = JSON.parse(readFileSync(new URL('usage-regmc-2026-09-league.json', HERE), 'utf8')).species;
const sorted = (o) => Object.entries(o ?? {}).sort((a, b) => b[1] - a[1]);
const usage = (f) => (U[f] ? { spreads: sorted(U[f].spreads), items: sorted(U[f].items), abilities: sorted(U[f].abilities), moves: sorted(U[f].moves) } : null);
const N = (id) => mech.species[id]?.name ?? mech.moves[id]?.name ?? mech.items[id]?.name ?? id;
const sp = (o) => ({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, ...o });

const K = {
  'Adamant 32 HP / 32 Atk, Silk Scarf': { species: 'kangaskhan', item: 'silkscarf', ability: 'scrappy', nature: 'adamant', sp: sp({ hp: 32, atk: 32, def: 2 }) },
  'Adamant 32 HP / 32 Atk, Life Orb': { species: 'kangaskhan', item: 'lifeorb', ability: 'scrappy', nature: 'adamant', sp: sp({ hp: 32, atk: 32, def: 2 }) },
  'Jolly 32 Atk / 32 Spe, Silk Scarf': { species: 'kangaskhan', item: 'silkscarf', ability: 'scrappy', nature: 'jolly', sp: sp({ hp: 2, atk: 32, spe: 32 }) },
};
const C = Object.fromEntries([['staraptormega', 'staraptor'], ['grimmsnarl', 'grimmsnarl'], ['volcarona', 'volcarona'], ['basculegionf', 'basculegionf'], ['mamoswine', 'mamoswine'], ['tsareena', 'tsareena'], ['empoleon', 'empoleon'], ['jolteon', 'jolteon']].map(([f, s]) => {
  const c = B.commonHits(mech, s, f, usage(f)); const x = c.spreads[0];
  return [f, { set: { species: s, item: c.item, ability: c.ability, nature: x.nature, sp: x.sp, moves: c.moves.slice(0, 4) }, mega: c.mega, moves: c.moves, basis: `${x.nature} ${STAT_IDS.map((k) => x.sp[k]).join('/')} @ ${N(c.item)}` }];
}));
function hit(a, aMega, d, dMega, move, o = {}) {
  const r = calc.run(normalizeScenario({ attacker: { set: { ...a, moves: [move] }, state: { mega: aMega, boosts: o.intim ? { atk: -o.intim } : {} } }, defender: { set: { ...d, moves: (d.moves?.length ? d.moves : ['fakeout', 'lastresort']).slice(0, 4) }, state: { mega: dMega } }, move: { id: move }, field: {} }));
  if (r.class === 'no-damage') return 'immune';
  if (r.class !== 'exact') return `n/a (${r.code ?? r.class})`;
  const p = (n) => Math.floor((1000 * n) / r.maxHP) / 10, one = r.ko.one, two = r.ko.two;
  const sash = d.item === 'focussash' && one.num === '0' && r.range.max >= r.maxHP;
  const odds = (k) => (String(k.den) === '16' ? `${k.num}/16` : `${Math.round((100 * k.num) / k.den)}%`);
  const v = one.num === one.den ? 'OHKO' : one.num !== '0' ? `${odds(one)} OHKO` : sash ? 'Sash holds' : two && two.refused === undefined ? (two.num === two.den ? '2HKO' : two.num !== '0' ? `${odds(two)} 2HKO` : '3HKO+') : '—';
  return `${p(r.range.min)}–${p(r.range.max)}% ${v}`;
}
const L = [`# Non-Mega Kangaskhan vs Calvin`, '', `Generated ${new Date().toISOString().slice(0, 10)} by \`sp-assist/kanga_calvin.mjs\` (app engine). Calvin: ladder sets (${Object.entries(C).map(([f, c]) => `${N(f)} ${c.basis}`).join('; ')}). Doubles, no weather, screens or crits.`, ''];
L.push('**Verified:** Kangaskhan\'s Champions abilities are Early Bird / Inner Focus / Scrappy (data/mechanics.json). Last Resort is 140 BP and in its learnset; Return is not in Champions. Silk Scarf and Life Orb are both legal. Showdown `data/abilities.ts` Scrappy: Normal and Fighting moves hit Ghosts, and it blocks Intimidate\'s Attack drop (`onTryBoost` deletes it), so the −1 column (a straight −1 Atk stage) is only for reference: Grimmsnarl\'s Parting Shot −1 Atk still applies.', '');
const moves = ['lastresort', 'doubleedge', 'bodyslam', 'fakeout'];
for (const [name, k] of Object.entries(K)) {
  if (name.startsWith('Jolly')) continue;
  L.push(`## ${name}: into Calvin`, '', `| Target | ${moves.map(N).join(' | ')} | Last Resort at −1 |`, `|---|${moves.map(() => '---|').join('')}---|`);
  for (const [f, c] of Object.entries(C)) L.push(`| ${N(f)} | ${moves.map((m) => hit(k, false, c.set, c.mega, m)).join(' | ')} | ${hit(k, false, c.set, c.mega, 'lastresort', { intim: 1 })} |`);
  L.push('');
}
const jk = K['Jolly 32 Atk / 32 Spe, Silk Scarf'];
L.push('## Jolly 32 Atk / 32 Spe, Silk Scarf: Last Resort / Double-Edge', '', '| Target | Last Resort | Double-Edge |', '|---|---|---|');
for (const [f, c] of Object.entries(C)) L.push(`| ${N(f)} | ${hit(jk, false, c.set, c.mega, 'lastresort')} | ${hit(jk, false, c.set, c.mega, 'doubleedge')} |`);
const ak = K['Adamant 32 HP / 32 Atk, Silk Scarf'];
L.push('', '## His hits into Adamant 32 HP / 32 Atk / 2 Def Kangaskhan', '', '| Attacker | Hits |', '|---|---|');
const theirs = { tsareena: ['highjumpkick', 'lowkick', 'tripleaxel', 'powerwhip'], mamoswine: ['highhorsepower', 'iciclecrash', 'earthquake', 'iceshard'], basculegionf: ['shadowball', 'muddywater', 'icebeam'], volcarona: ['heatwave', 'overheat', 'bugbuzz'], grimmsnarl: ['spiritbreak', 'foulplay'], staraptormega: ['closecombat', 'bravebird'], empoleon: ['hydropump', 'flashcannon', 'icebeam'], jolteon: ['thunderbolt', 'voltswitch', 'shadowball'] };
for (const [f, ms] of Object.entries(theirs)) L.push(`| ${N(f)} | ${ms.map((m) => `${N(m)} ${hit(C[f].set, C[f].mega, ak, false, m)}`).join('<br>')} |`);
const spe = (base, n, s) => statValue('spe', base, s, natureSign(mech.natures[n], 'spe'));
L.push('', '## Speed (Lv 50)', '', `Kangaskhan base 90: Jolly 32 = **${spe(90, 'jolly', 32)}**, neutral 32 = ${spe(90, 'adamant', 32)}, Adamant 0 = **${spe(90, 'adamant', 0)}**, Brave 0 = ${spe(90, 'brave', 0)}.`, '', '| Calvin | Ladder Speed |', '|---|---|');
for (const [f, c] of Object.entries(C)) L.push(`| ${N(f)} | ${spe(mech.species[f].baseStats.spe, c.set.nature, c.set.sp.spe)} (${c.basis.split(' @')[0]}) |`);
L.push('', '## Last Resort rule', '', 'Showdown `data/moves.ts` lastresort.onTry: it fails if the user knows fewer than 2 moves, or if any OTHER move in its moveset has not been used since it came in (switching out resets this). So every other move must be used once first:', '',
  '- **Fake Out / Last Resort** (2 moves): Fake Out turn 1, Last Resort from turn 2. Fastest, but no Protect and Fake Out only works on its first turn out, so later it can only click Last Resort.',
  '- **Fake Out / Last Resort / Protect** (3 moves): Fake Out t1, Protect t2, Last Resort from t3. Protect is the cost of one extra turn.',
  '- With 4 moves, Last Resort needs all 3 others first (turn 4 at the earliest). Not worth it.',
  '- Recommended: **Fake Out / Last Resort / Double-Edge** if you want damage while unlocking (t1 Fake Out, t2 Double-Edge, t3 Last Resort), or the 2-move set for the quickest Last Resort.');
writeFileSync(new URL('../match-calvin-kanga.md', HERE), `${L.join('\n')}\n`);
console.log('wrote match-calvin-kanga.md');

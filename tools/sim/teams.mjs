// Teams for the sim spike: Anthony's six (docs/research/strategy/match-zhuzi.md §5: the Week 1 six with Scrappy
// Kangaskhan over Conkeldurr, match-calvin-kanga.md) and ZhuZi's generated six (lib/mock-gen.mjs over his drafted 10,
// research usage). Showdown text with Champions SP on the EVs line.
import { readFileSync } from 'node:fs';
import { mech, newCalc } from '../../test/calc-helpers.mjs';
import { generateMock, setsOf } from '../../lib/mock-gen.mjs';
import { exportTeam } from '../../lib/paste.mjs';

const ROOT = new URL('../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');

export function anthonyTeam() {
  const doc = read('docs/research/strategy/match-zhuzi.md');
  const at = doc.indexOf('## 5. Sets');
  const m = doc.slice(at).match(/```\n([\s\S]*?)```/);
  return m[1].trim();
}
export const ZHUZI_10 = ['metagross', 'dragapult', 'rotomwash', 'oranguru', 'krookodile', 'infernape', 'florges', 'toxtricity', 'slowkinggalar', 'umbreon'];
export const ANTHONY_10 = ['charizard', 'aegislash', 'kangaskhan', 'morpeko', 'sinistcha', 'rotomfan', 'conkeldurr'];

export function usage() {
  const raw = JSON.parse(read('docs/research/strategy/sp-assist/usage-regmc-2026-09-league.json')).species;
  const sorted = (o) => Object.entries(o ?? {}).sort((a, b) => b[1] - a[1]);
  return { month: '2026-09', species: Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, { spreads: sorted(v.spreads), items: sorted(v.items), abilities: sorted(v.abilities), moves: sorted(v.moves) }])) };
}
/** ZhuZi's generated mock team(s) vs Anthony: [{ name, text }]. */
export function zhuziTeams() {
  const r = generateMock(newCalc(), mech, { xPool: ZHUZI_10, yPool: ANTHONY_10, usage: usage() });
  return r.variants.map((v) => ({ name: v.name, text: exportTeam(setsOf(v.six).map((x) => x.set), mech).text }));
}

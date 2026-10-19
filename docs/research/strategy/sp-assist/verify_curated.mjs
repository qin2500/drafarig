// Re-run every curated calc (lib/guides/*.mjs, lib/mocks/*.mjs) in the APP engine and compare with the stated range.
// Run from the repo root: node docs/research/strategy/sp-assist/verify_curated.mjs   (read-only; exits 1 on a mismatch > 0.5%)
import { readdirSync } from 'node:fs';
const ROOT = new URL('../../../../', import.meta.url);
const { newCalc, mech } = await import(new URL('test/calc-helpers.mjs', ROOT));
const calc = newCalc();
const toID = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
const megaOf = Object.fromEntries(Object.entries(mech.species).filter(([, v]) => v.mega).map(([k, v]) => [k, v.mega]));
function side(x) {
  const m = megaOf[x.id];
  const species = m ? m.from : x.id;
  const item = m ? m.item : x.item ?? '';
  const ability = m ? toID(mech.species[species].abilities[0]) : x.ability;
  const nature = toID(x.nature ?? 'serious');
  return { set: { species, item, ability, nature, moves: [], sp: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, ...(x.sp ?? {}) } }, state: { form: x.form ?? '' } };
}
let bad = 0, n = 0;
for (const dir of ['lib/guides', 'lib/mocks']) {
  let files = [];
  try { files = readdirSync(new URL(dir, ROOT)).filter((f) => /^\d+v\d+\.mjs$/.test(f)); } catch { continue; }
  for (const f of files) {
    const g = (await import(new URL(`${dir}/${f}`, ROOT))).default;
    for (const [i, c] of (g.calcs ?? []).entries()) {
      const a = side(c.attacker), d = side(c.defender);
      a.set.moves = [c.move];
      d.set.moves = ['protect'];
      const field = { weather: c.field?.weather ?? '' };
      const r = calc.run({ attacker: a, defender: d, move: { id: c.move }, field });
      n++;
      if (r.class !== 'exact') { console.log(`${dir}/${f} #${i}: engine ${r.class} ${r.code ?? ''}`); bad++; continue; }
      const lo = (100 * r.range.min) / r.maxHP, hi = (100 * r.range.max) / r.maxHP;
      const [slo, shi] = c.range.replace('%', '').split('–').map(Number);
      const ok = Math.abs(lo - slo) <= 0.5 && Math.abs(hi - shi) <= 0.5;
      if (!ok) bad++;
      console.log(`${ok ? 'ok ' : 'BAD'} ${dir}/${f} #${i} ${c.attacker.id} ${c.move} -> ${c.defender.id}: stated ${c.range}, engine ${lo.toFixed(1)}–${hi.toFixed(1)}%`);
    }
  }
}
console.log(`${n - bad}/${n} match`);
process.exit(bad ? 1 : 0);

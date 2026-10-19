// Every calc in every registered guide (lib/guides) and curated mock (lib/mocks) must reproduce in the app's own engine
// within 0.5 percentage points of its stated range. Each entry is rebuilt from its own stated sets (ability, item, nature,
// SP; a Mega id = its stone and Mega state) and field, exactly as the workbench opens it; a side without a stated spread
// falls back to the ladder (usage table) or the worst case. Failures are listed in one message.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mech, newCalc } from './calc-helpers.mjs';
import { normalizeScenario } from '../lib/calc/scenario.mjs';
import { legalAbilities, learnset, toID } from '../lib/calc/mech.mjs';
import { commonHits } from '../lib/prep-build.mjs';
import { GUIDES, validateGuide, parseRange } from '../lib/guides/index.mjs';
import { MOCKS, validateMock } from '../lib/mocks/index.mjs';

// Known pending (each with its reason). Remove each line when its fix lands: this test fails while a pending calc still differs, AND once it starts matching (so the marker can't go stale).
const PENDING = new Set([
  'guide 5v3 #30', // Stunfisk-Galar's Mimicry: the app's calc refuses it (type change); spcalc ignores it
]);

const calc = newCalc();
const raw = JSON.parse(readFileSync(new URL('../docs/research/strategy/sp-assist/usage-regmc-2026-09-league.json', import.meta.url), 'utf8')).species;
const sorted = (o) => Object.entries(o ?? {}).sort((a, b) => b[1] - a[1]);
const usage = (f) => (raw[f] ? { spreads: sorted(raw[f].spreads), items: sorted(raw[f].items), abilities: sorted(raw[f].abilities), moves: sorted(raw[f].moves) } : null);
const ZERO = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

/** One side of an entry as a calc set: its stated fields over the ladder / worst-case base. */
function sideSet(side, move, attacking) {
  const f = mech.species[side.id];
  const mega = !!f?.mega;
  const species = mega ? f.mega.from : side.id;
  const mv = mech.moves[move];
  let base;
  const c = side.set === 'ladder' ? commonHits(mech, species, side.id, usage(side.id) ?? usage(species)) : null;
  if (c) base = { item: c.item, ability: c.ability, nature: c.spreads[0].nature, sp: c.spreads[0].sp };
  else if (attacking) { const stat = mv.category === 'Special' ? 'spa' : 'atk'; base = { item: 'lifeorb', ability: legalAbilities(mech, species)[0], nature: stat === 'spa' ? 'modest' : 'adamant', sp: { ...ZERO, [stat]: 32 } }; }
  else { const stat = mv.category === 'Special' ? 'spd' : 'def'; base = { item: '', ability: legalAbilities(mech, species)[0], nature: stat === 'spd' ? 'calm' : 'bold', sp: { ...ZERO, hp: 32, [stat]: 32 } }; }
  const set = { species, ...base, moves: attacking ? [move] : learnset(mech, species).slice(0, 1) };
  for (const k of ['item', 'nature']) if (side[k]) set[k] = toID(side[k]);
  if (side.ability && !mega) set.ability = toID(side.ability);
  if (mega) { set.item = f.mega.item; set.ability = legalAbilities(mech, species)[0]; }
  if (side.sp) set.sp = { ...ZERO, ...side.sp };
  return { set, mega };
}
function run(entry) {
  const a = sideSet(entry.attacker, entry.move, true), d = sideSet(entry.defender, entry.move, false);
  const f = entry.field ?? {};
  const screen = f.screens === true ? (mech.moves[entry.move].category === 'Special' ? 'lightScreen' : 'reflect') : f.screens === 'reflect' ? 'reflect' : f.screens === 'light' ? 'lightScreen' : null;
  const r = calc.run(normalizeScenario({ attacker: { set: a.set, state: { mega: a.mega, intimidated: Number(f.intimidate) || 0, ...(entry.attacker.form ? { form: entry.attacker.form } : {}) } },
    defender: { set: d.set, state: { mega: d.mega, ...(entry.defender.form ? { form: entry.defender.form } : {}) } }, move: { id: entry.move },
    field: { ...(f.weather ? { weather: f.weather } : {}), ...(f.terrain ? { terrain: f.terrain } : {}), ...(screen ? { defenderSide: { [screen]: true } } : {}) } }));
  if (r.class !== 'exact') return { refused: r.code ?? r.class };
  const p = (n) => Math.floor((1000 * n) / r.maxHP) / 10;
  return { lo: p(r.range.min), hi: p(r.range.max) };
}

test('every guide and mock calc reproduces in the app engine within 0.5 points (known-pending ones listed in PENDING)', () => {
  const entries = [
    ...GUIDES.map((g) => validateGuide(g, mech).guide).filter(Boolean).flatMap((g) => g.calcs.map((c, i) => ({ id: `guide ${g.pov}v${g.opp} #${i}`, c }))),
    ...MOCKS.map((m) => ({ raw: m, v: validateMock(m, mech).mock })).filter((x) => x.v).flatMap(({ raw: m, v }) => v.calcs.map((c, i) => ({ id: `mock ${m.seat}v${m.vsSeat} #${i}`, c }))),
  ];
  assert.ok(entries.length >= 12, `calcs found: ${entries.length}`);
  const bad = [], fixed = [];
  for (const { id, c } of entries) {
    const want = parseRange(c.range);
    if (!want) continue;
    const got = run(c);
    const ok = !got.refused && Math.abs(got.lo - want[0]) <= 0.5 && Math.abs(got.hi - want[1]) <= 0.5;
    const line = `${id}: ${c.attacker.id} ${c.move} → ${c.defender.id}: stated ${c.range}, engine ${got.refused ? `refused (${got.refused})` : `${got.lo}–${got.hi}%`}`;
    if (!ok && !PENDING.has(id)) bad.push(line);
    if (ok && PENDING.has(id)) fixed.push(`${id} now matches: remove it from PENDING`);
  }
  assert.deepEqual([...bad, ...fixed], [], `\n${[...bad, ...fixed].join('\n')}`);
});

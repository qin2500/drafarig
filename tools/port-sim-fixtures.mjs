// Dev-only. Copies the real-simulator expectations (pinned Pokémon Showdown battles with forced damage rolls) from a local
// copy of the simulator-validation evidence into test/fixtures/sim-expected.json, so product tests check the calc wrapper
// against the simulator without the simulator being a dependency. No network access; the evidence files are pinned by sha256.
//
//   node tools/port-sim-fixtures.mjs --from <path to the oracle evidence directory>
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const FILES = ['golden-sim.json', 'scenarios.json', 'wrapper-fixes.json', 'intimidate.json', 'survival.json', 'misc-semantics.json'];

const i = process.argv.indexOf('--from');
if (i < 0 || !process.argv[i + 1]) throw new Error('usage: node tools/port-sim-fixtures.mjs --from <oracle evidence dir>');
const dir = process.argv[i + 1];
const src = {}, ev = {};
for (const f of FILES) {
  const text = await readFile(join(dir, f), 'utf8');
  src[f] = createHash('sha256').update(text).digest('hex');
  ev[f] = JSON.parse(text);
}
const out = {
  generator: 'tools/port-sim-fixtures.mjs', simulator: 'smogon/pokemon-showdown@9fb3a5b99f1a0bea17f495c5cc1bfe04fdd19c3e', sources: src,
  golden: Object.fromEntries(ev['golden-sim.json'].map((g) => [g.id, g.psHits])),
  scenarios: Object.fromEntries(ev['scenarios.json'].map((s) => [s.id, { psHits: s.psHits, spreadHit: s.live?.spreadHit ?? null }])),
  wrapperFixes: ev['wrapper-fixes.json'].samples.filter((s) => s.fix === 'F3' || s.fix === 'F4').map((s) => ({ fix: s.fix, move: s.move, hitsTaken: s.hitsTaken, fainted: s.fainted, defender: s.defender, ability: s.ability, item: s.item, gravity: s.gravity, ps: s.ps })),
  intimidate: ev['intimidate.json'].map((x) => ({ receiverAbility: x.receiverAbility, item: x.item, receiver: x.ps.receiver, receiverItemAfter: x.ps.receiverItem, intimidatorAtk: x.ps.intimidatorAtk })),
  survival: Object.fromEntries(ev['survival.json'].map((s) => [s.id, s.psKO])),
  disguise: ev['misc-semantics.json'].disguise,
  aegislash: ev['misc-semantics.json'].aegislash,
};
await writeFile(join(ROOT, 'test/fixtures/sim-expected.json'), JSON.stringify(out, null, 1) + '\n');
console.log('Wrote test/fixtures/sim-expected.json');

// Showdown paste import/export (lib/paste.mjs) against the pinned simulator's own behaviour: Teams.import, exportSet and
// the Reg M-C TeamValidator (expected strings below are the validator's). Import is stricter than Showdown: every case
// where Showdown would silently change or drop something becomes a visible tier.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mech, read } from './calc-helpers.mjs';
import { parseTeam, exportSet, exportTeam, convertEV, resolveSpecies, SPECIES_ALIASES, setKey } from '../lib/paste.mjs';
import { STAT_IDS, statValue } from '../lib/calc/stats.mjs';

const blocks = {};
let cur = null;
for (const line of read('test/fixtures/pastes.txt').split('\n')) {
  const m = /^#### (.+)$/.exec(line);
  if (m) { cur = m[1]; blocks[cur] = ''; continue; }
  if (line.startsWith('###') || cur === null) continue;
  blocks[cur] += `${line}\n`;
}
const parse = (text, answers = {}, extra = {}) => parseTeam(text, { mech, side: 'mine', answers, ...extra });
const one = (text, answers) => parse(text, answers ? { 0: answers } : {}).sets[0];
const codes = (s) => s.lines.filter((l) => l.tier).map((l) => `${l.tier}:${l.code}`);
const mon = (sp, item, ability, evs, nature, moves, extra = '') => `${sp}${item ? ` @ ${item}` : ''}\nAbility: ${ability}\n${extra}EVs: ${evs}\n${nature} Nature\n${moves.map((m) => `- ${m}`).join('\n')}\n`;

test('T-PASTE-01…09: each fixture lands in the expected tier, with Showdown\'s validator wording where it applies', () => {
  const v = one(blocks['01-valid-champions']);
  assert.equal(v.status, 'ready');
  assert.deepEqual(v.set.sp, { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 });
  const legacy = one(blocks['02-legacy-252ev']);
  assert.equal(legacy.status, 'needs-answer');
  const conv = legacy.lines.find((l) => l.code === 'legacy-evs');
  assert.deepEqual([conv.tier, conv.question.suggested], [2, 'convert']);
  assert.deepEqual(conv.after, { hp: 1, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 }, '4/252/252 → 1/32/32');
  assert.equal(one(blocks['02-legacy-252ev'], { evs: 'convert' }).status, 'ready');
  assert.equal(one(blocks['02-legacy-252ev'], { evs: 'keep' }).status, 'rejected', 'kept as typed: over the limits');
  const tera = one(blocks['03-tera-and-ivs']);
  assert.deepEqual(codes(tera), ['4:dropped-tera', '1:ivs-not-31']);
  assert.equal(tera.lines.find((l) => l.code === 'ivs-not-31').ps, "Rotom's IVs are not maxed out, but this format requires all IVs to be 31.");
  assert.equal(one(blocks['03-tera-and-ivs'], { ivs: 'remove' }).status, 'ready');
  const mega = one(blocks['04a-mega-forme-correct-stone']);
  assert.equal(mega.status, 'ready');
  assert.deepEqual([mega.set.species, mega.set.item], ['garchomp', 'garchompite']);
  const wrong = one(blocks['04b-mega-z-wrong-stone']);
  assert.equal(wrong.status, 'rejected');
  assert.equal(wrong.lines.find((l) => l.code === 'mega-wrong-stone').ps, 'Garchomp-Mega-Z transforms in-battle with Garchompite Z, please fix its item.');
  const meow = one(blocks['04c-meowstic-f-mega']);
  assert.deepEqual([meow.status, meow.set.species, meow.set.item], ['ready', 'meowsticf', 'meowsticite']);
  const nick = parse(blocks['05-nickname-gender-shiny']).sets;
  assert.deepEqual([nick[0].status, nick[0].set.cosmetic], ['ready', { nickname: 'Chompy', gender: 'F', shiny: true, happiness: 160, pokeball: '' }]);
  assert.equal(nick[1].status, 'needs-answer');
  assert.equal(nick[1].lines[0].psReads, 'Bob)', 'Showdown would read "bob" as the species');
  const items = parse(blocks['06-unknown-and-past-items']).sets;
  assert.deepEqual(items.map((s) => s.lines.find((l) => l.tier === 1)?.code), ['item-not-in-regulation', 'item-not-in-regulation']);
  const sps = parse(blocks['07-nonstandard-sp-labels']).sets;
  assert.ok(sps.every((s) => s.lines.some((l) => l.code === 'sps-line' && l.tier === 3)), 'a SPs: line is never silently dropped');
  assert.deepEqual(parse(blocks['07-nonstandard-sp-labels'], { 0: { 'sps-line': 'read' } }).sets[0].set.sp, { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 });
  const odd = parse(blocks['08-ev-line-oddities']).sets;
  assert.ok(odd[0].lines.some((l) => l.code === 'token-alias'), '"32 Sp. Atk" would be skipped by Showdown');
  assert.ok(odd[0].lines.some((l) => l.code === 'spd-token'), '"Spd" asks: Showdown reads it as Speed');
  assert.equal(parse(blocks['08-ev-line-oddities'], { 0: { 'ev-token:32spatk': 'accept', spd: 'spe' } }).sets[0].set.sp.spe, 32);
  assert.ok(odd[1].lines.some((l) => l.code === 'value-not-integer' && l.tier === 1), '"x HP" is rejected (Showdown accepts NaN silently)');
  assert.equal(parse(blocks['09-species-name-variants']).rejected.code, 'paste-too-many', 'more than 6 sets: one team at a time');
});

test('species names: Mega formes normalize to base + stone; aliases resolve; "(F)" on a split forme asks; names Showdown rejects ask', () => {
  for (const [alias, target] of Object.entries(SPECIES_ALIASES)) assert.ok(mech.species[target], `${alias} → ${target}`);
  assert.equal(resolveSpecies(mech, 'Rotom-W').id, 'rotomwash');
  assert.equal(resolveSpecies(mech, 'Tauros-Paldea-Water').id, 'taurospaldeaaqua');
  assert.equal(resolveSpecies(mech, 'Garchomp-Mega Z').id, 'garchompmegaz');
  assert.deepEqual(resolveSpecies(mech, 'Mega Garchomp Z'), { fuzzy: ['garchompmegaz'] }, 'Showdown rejects "megagarchompz": ask, never accept silently');
  const f = one('Meowstic (F) @ Sitrus Berry\nAbility: Competitive\nEVs: 32 HP / 2 Def / 32 SpD\nCalm Nature\n- Fake Out\n');
  assert.equal(f.status, 'needs-answer');
  assert.deepEqual(f.questions[0].options, ['meowsticf', 'meowstic']);
  assert.equal(one('Meowstic (F) @ Sitrus Berry\nAbility: Competitive\nEVs: 32 HP / 2 Def / 32 SpD\nCalm Nature\n- Fake Out\n', { forme: 'meowsticf' }).set.species, 'meowsticf');
  const prank = one('Meowstic (F) @ Sitrus Berry\nAbility: Prankster\nEVs: 32 HP / 2 Def / 32 SpD\nCalm Nature\n- Fake Out\n', { forme: 'meowsticf' });
  assert.equal(prank.lines.find((l) => l.code === 'ability-not-legal').ps, "Meowstic-F can't have Prankster.", 'abilities are checked against the chosen forme');
  assert.equal(one(mon('Urshifu-Rapid-Strike', 'Focus Sash', 'Unseen Fist', '2 HP / 32 Atk / 32 Spe', 'Jolly', ['Surging Strikes'])).status, 'rejected');
});

test('Stat Point edges and legality use the validator\'s strings; slightly-over SP is rejected, not "converted"', () => {
  const s1 = one(mon('Garchomp', 'Life Orb', 'Rough Skin', '33 Atk / 32 Spe', 'Jolly', ['Earthquake']));
  assert.equal(s1.status, 'rejected');
  assert.equal(s1.lines.find((l) => l.code === 'sp-over-stat').ps, 'Garchomp has more than 32 Stat Points in Attack.');
  const s2 = one(mon('Garchomp', 'Life Orb', 'Rough Skin', '32 Atk / 32 Spe / 3 HP', 'Jolly', ['Earthquake']));
  assert.equal(s2.lines.find((l) => l.code === 'sp-over-total').ps, "Garchomp has 67 total Stat Points, which is more than this format's limit of 66.");
  assert.equal(one(mon('Garchomp', 'Life Orb', 'Rough Skin', '-1 Atk / 32 Spe', 'Jolly', ['Earthquake'])).status, 'rejected');
  const serious = one('Garchomp @ Life Orb\nAbility: Rough Skin\nSerious Nature\n- Earthquake\n');
  assert.ok(serious.lines.some((l) => l.code === 'zero-sp' && l.tier === 3), '0 SP + Serious: Showdown rejects; ask');
  assert.equal(one('Garchomp @ Life Orb\nAbility: Rough Skin\nSerious Nature\n- Earthquake\n', { 'zero-sp': 'keep' }).set.nature, 'hardy');
  const hardy = one('Garchomp @ Life Orb\nAbility: Rough Skin\nHardy Nature\n- Earthquake\n');
  assert.equal(hardy.status, 'ready', '0 SP + Hardy is valid in Showdown');
  assert.equal(one(mon('Garchomp', 'Life Orb', 'Rough Skin', '32 Atk / 32 Spe', 'Jolly', ['Earthquake'], 'Level: 100\n')).lines.find((l) => l.code === 'level-to-50').tier, 4);
  const spore = one(mon('Garchomp', 'Life Orb', 'Sand Veil', '32 Atk / 32 Spe', 'Jolly', ['Earthquake', 'Spore']));
  assert.equal(spore.lines.find((l) => l.code === 'move-not-learnable').ps, "Garchomp can't learn Spore.");
  assert.equal(one(mon('Garchomp', 'Life Orb', 'Huge Power', '32 Atk / 32 Spe', 'Jolly', ['Earthquake'])).lines.find((l) => l.code === 'ability-not-legal').ps, "Garchomp can't have Huge Power.");
  assert.equal(one(mon('Garchomp', 'Life Orb', 'Huge Power', '32 Atk / 32 Spe', 'Jolly', ['Earthquake'])).questions.filter((q) => q.key === 'ability').length, 1, 'one question per decision');
  assert.equal(one(mon('Annihilape', 'Life Orb', 'Defiant', '32 Atk / 32 Spe', 'Jolly', ['Rage Fist', 'Power Shift'])).lines.find((l) => l.code === 'move-not-learnable').ps, "Annihilape can't learn Power Shift.");
  const ko = one(mon('Incineroar', 'Sitrus Berry', 'Intimidate', '32 HP / 2 Def / 32 SpD', 'Careful', ['Fake Out', 'Flare Blitz', 'Knock Off', 'Parting Shot']));
  assert.equal(ko.lines.find((l) => l.code === 'move-not-learnable').ps, "Incineroar can't learn Knock Off.");
  assert.equal(one(mon('Garchomp', 'Life Orb', 'Rough Skin', '32 Atk / 32 Spe', 'Jolly', ['Earthquake', 'Dragon Hammer'])).lines.find((l) => l.tier === 1).code, 'move-not-in-regulation');
});

test('team warnings mirror the validator but never block: species, item and nickname clause, two Mega Stones allowed', () => {
  const six = [mon('Incineroar', 'Sitrus Berry', 'Intimidate', '32 HP / 2 Def / 32 SpD', 'Careful', ['Fake Out', 'Flare Blitz', 'Parting Shot']),
    mon('Garchomp', 'Choice Scarf', 'Rough Skin', '2 HP / 32 Atk / 32 Spe', 'Jolly', ['Earthquake', 'Dragon Claw', 'Rock Slide', 'Stomping Tantrum']),
    mon('Kingambit', 'Black Glasses', 'Defiant', '32 HP / 32 Atk / 2 Def', 'Adamant', ['Kowtow Cleave', 'Sucker Punch', 'Iron Head', 'Protect']),
    mon('Sinistcha', 'Leftovers', 'Hospitality', '32 HP / 32 Def / 2 SpD', 'Bold', ['Matcha Gotcha', 'Rage Powder', 'Trick Room', 'Strength Sap']),
    mon('Charizard', 'Charizardite Y', 'Blaze', '2 HP / 32 SpA / 32 Spe', 'Timid', ['Heat Wave', 'Solar Beam', 'Weather Ball', 'Protect'])];
  const t = parse([...six, mon('Gengar', 'Gengarite', 'Cursed Body', '2 HP / 32 SpA / 32 Spe', 'Timid', ['Shadow Ball', 'Sludge Bomb'])].join('\n'));
  assert.deepEqual(t.teamWarnings.map((w) => w.code), ['two-mega-stones']);
  assert.ok(t.sets.every((s) => s.status === 'ready'));
  const ic = parse([...six, mon('Rotom-Wash', 'Sitrus Berry', 'Levitate', '32 HP / 2 Def / 32 SpA', 'Modest', ['Hydro Pump'])].join('\n'));
  assert.deepEqual(ic.teamWarnings.map((w) => w.code), ['item-clause']);
  const sc = parse([...six.slice(0, 5), mon('Garchomp', 'Life Orb', 'Rough Skin', '2 HP / 32 Atk / 32 Spe', 'Jolly', ['Earthquake'])].join('\n'));
  assert.ok(sc.teamWarnings.some((w) => w.code === 'species-clause'));
});

test('export is byte-for-byte Showdown\'s exportSet; round-trips are stable; it never writes Tera, IVs, (F) for split formes or a Mega forme', () => {
  const golden = 'Garchomp @ Choice Scarf  \nAbility: Rough Skin  \nLevel: 50  \nEVs: 2 HP / 32 Atk / 32 Spe  \nJolly Nature  \n- Earthquake  \n- Dragon Claw  \n- Rock Slide  \n- Stomping Tantrum  \n';
  assert.equal(exportSet(one(blocks['01-valid-champions']).set, mech).text, golden, 'equals the canonical export the real validator produced');
  assert.equal(exportSet(one(blocks['04a-mega-forme-correct-stone']).set, mech).text, 'Garchomp @ Garchompite  \nAbility: Rough Skin  \nLevel: 50  \nEVs: 2 HP / 32 Atk / 32 Spe  \nJolly Nature  \n- Earthquake  \n- Dragon Claw  \n- Rock Slide  \n- Protect  \n');
  const chompy = exportSet(parse(blocks['05-nickname-gender-shiny']).sets[0].set, mech).text;
  assert.equal(chompy, 'Chompy (Garchomp) (F) @ Choice Scarf  \nAbility: Rough Skin  \nLevel: 50  \nShiny: Yes  \nHappiness: 160  \nEVs: 2 HP / 32 Atk / 32 Spe  \nJolly Nature  \n- Earthquake  \n- Dragon Claw  \n- Rock Slide  \n- Stomping Tantrum  \n');
  const meow = exportSet(one(blocks['04c-meowstic-f-mega']).set, mech).text;
  assert.ok(meow.startsWith('Meowstic-F @ Meowsticite  \n') && !meow.includes('(F)'));
  for (const id of Object.keys(blocks).filter((k) => !k.startsWith('09'))) {
    for (const s of parse(blocks[id]).sets.filter((x) => x.set)) {
      const a = exportSet(s.set, mech).text;
      assert.ok(!/Tera Type:|IVs:|-Mega/.test(a), id);
      const back = one(a);
      assert.equal(back.status, 'ready', `${id} re-import`);
      assert.equal(setKey(back.set), setKey(s.set), `${id} field-equal`);
      assert.equal(exportSet(back.set, mech).text, a, `${id} byte-stable`);
    }
  }
  const zero = { species: 'garchomp', item: '', ability: 'roughskin', nature: 'serious', moves: ['earthquake'], sp: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, cosmetic: {} };
  const z = exportSet(zero, mech);
  assert.ok(z.text.includes('Hardy Nature') && z.warnings.includes('serious-to-hardy'));
  assert.equal(one(z.text).status, 'ready', 'an exported 0-SP Hardy set re-imports without a question');
  const odd = exportSet({ ...zero, nature: 'jolly', sp: { atk: 32 }, cosmetic: { nickname: '=== Bob (x) @' } }, mech).text;
  assert.ok(odd.startsWith('Bob x (Garchomp)'), 'nicknames lose brackets, @ and a leading ===');
  assert.throws(() => exportSet({ ...zero, sp: 'unknown' }, mech), /unknown/);
  const team = exportTeam([zero, { ...zero, species: 'incineroar', ability: 'intimidate', moves: ['fakeout'] }], mech);
  assert.equal(team.text.split('\n\n').filter(Boolean).length, 2);
});

test('the legacy EV converter gives the same Lv 50 stats as the old 31-IV EV formula; any legal 510-EV spread fits in 66', () => {
  const oldStat = (stat, base, ev, sign) => {
    const core = Math.floor(((2 * base + 31 + Math.floor(ev / 4)) * 50) / 100);
    return stat === 'hp' ? core + 60 : Math.floor((core + 5) * (sign === '+' ? 1.1 : sign === '-' ? 0.9 : 1));
  };
  for (const base of [1, 50, 95, 102, 150, 255]) for (const stat of STAT_IDS) for (const sign of stat === 'hp' ? [''] : ['', '+', '-']) {
    for (let ev = 0; ev <= 252; ev++) assert.equal(statValue(stat, base, convertEV(ev), sign), oldStat(stat, base, ev, sign), `${stat} ${base} ${ev}${sign}`);
  }
  // each SP costs 8 EVs except the first (4), so Σ(8k−4) ≤ 510 ⇒ Σk ≤ 66; the tightest spread reaches exactly 66
  assert.equal(STAT_IDS.reduce((t) => t + convertEV(84), 0) , 66);
  assert.equal(convertEV(84) * 6 * 8 - 4 * 6, 504);
});

test('rejected pastes: packed, JSON, links, empty, too long', () => {
  assert.equal(parse('').rejected.code, 'paste-empty');
  assert.equal(parse('Garchomp||roughskin|earthquake|Jolly|||||').rejected.code, 'paste-packed');
  assert.equal(parse('[{"species":"Garchomp"}]').rejected.code, 'paste-json');
  assert.equal(parse('https://pokepast.es/abc').rejected.code, 'paste-link');
  assert.equal(parse('x'.repeat(50001)).rejected.code, 'paste-too-long');
  assert.equal(parse('=== [gen9ou] Team ===\n' + blocks['01-valid-champions']).teamWarnings[0].code, 'other-format');
  // roster check: their sets must be on their roster; your own off-roster set asks (add / skip) instead of failing
  const r = parseTeam(blocks['01-valid-champions'], { mech, side: 'theirs', allowedSpecies: new Set(['incineroar']) });
  assert.ok(r.sets[0].lines.some((l) => l.code === 'not-on-roster') && r.sets[0].status === 'rejected');
  const mine = (answers) => parseTeam(blocks['01-valid-champions'], { mech, side: 'mine', allowedSpecies: new Set(['incineroar']), answers }).sets[0];
  assert.deepEqual([mine({}).status, mine({}).questions.map((q) => q.key)], ['needs-answer', ['roster']]);
  assert.equal(mine({ 0: { roster: 'add' } }).status, 'ready');
  assert.equal(mine({ 0: { roster: 'skip' } }).status, 'rejected');
});

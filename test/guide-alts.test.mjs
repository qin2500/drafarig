// Guide alternatives (applyAlt / validateGuide alts / guideFor alt): written from the spec with small fixture guides.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mech } from './calc-helpers.mjs';
import { applyAlt, validateGuide, guideFor } from '../lib/guides/index.mjs';

const calc = (att, def, move = 'heatwave') => ({ attacker: att, defender: def, move, field: {}, range: '50–60%', verdict: 'x', why: 'y' });
const ours = (id) => ({ id, set: 'ours' });
const worst = (id) => ({ id, set: 'worst' });

const mk = (extra = {}) => ({
  version: 2, pov: 5, opp: 2, coach: 'Ning', week: 2, written: '2026-10-19',
  rosters: { ours: ['charizard', 'sinistcha', 'pelipper', 'kangaskhan', 'conkeldurr'], theirs: ['rillaboom', 'gholdengo', 'milotic', 'lucario'] },
  bring: { six: ['charizard', 'sinistcha', 'pelipper', 'kangaskhan'], bench: [{ id: 'conkeldurr', why: 'bench it' }, { id: 'pelipper', why: 'maybe' }], mega: null },
  previews: [
    { if: 'A', bring4: ['charizard', 'sinistcha', 'pelipper', 'kangaskhan'], lead: ['charizard', 'kangaskhan'], note: '' },
    { if: 'B', bring4: ['charizard', 'conkeldurr', 'pelipper', 'kangaskhan'], lead: ['conkeldurr', 'pelipper'], note: '' }],
  leads: [{ ours: ['charizard', 'kangaskhan'], vs: ['rillaboom', 'gholdengo'], t1: 'a' }, { ours: ['conkeldurr', 'pelipper'], vs: ['lucario', 'milotic'], t1: 'b' }],
  calcs: [
    calc(ours('charizardmegay'), worst('gholdengo')),            // 0 survives
    calc(worst('lucario'), ours('conkeldurr'), 'rockslide'),      // 1 pruned (conkeldurr gone)
    calc(worst('rillaboom'), ours('kangaskhan'), 'woodhammer')],  // 2 survives
  threats: [
    { id: 'lucario', title: 'Rock Slide', why: 'hits', calc: 1 },
    { id: 'rillaboom', title: 'Wood Hammer', why: 'hits', calc: 2 },
    { id: 'gholdengo', title: 'Make It Rain', why: 'hits', calc: 0 },
    { id: 'milotic', title: 'No calc', why: 'hits' }],
  combos: {
    theirs: [
      { attackers: [['rillaboom', 'woodhammer'], ['gholdengo', 'makeitrain']], into: 'kangaskhan' },
      { attackers: [['lucario', 'rockslide'], ['milotic', 'surf']], into: 'conkeldurr' }],
    ours: [
      { attackers: [['charizard', 'heatwave'], ['kangaskhan', 'doubleedge']], into: 'gholdengo' },
      { attackers: [['conkeldurr', 'closecombat'], ['charizard', 'heatwave']], into: 'milotic' }] },
  perMon: { rillaboom: { role: 'r' }, conkeldurr: { job: 'j' }, charizard: { job: 'c' } },
  team: { summary: ['s'], evidence: '', members: [{ id: 'charizard', role: 'a' }, { id: 'conkeldurr', role: 'b' }] },
  ...extra,
});
const withAlts = (alts, extra = {}) => mk({ alternatives: alts, ...extra });
const SWAP = { key: 'swap', name: 'Swap six', note: 'n', bring: { six: ['charizard', 'conkeldurr', 'pelipper', 'kangaskhan'] } };
const ALT_GONE = { key: 'noconk', name: 'No Conk', note: 'n' }; // six already excludes conkeldurr and sinistcha is in it

test('applyAlt returns the same object for null, undefined, main, unknown key and when there are no alternatives', () => {
  const raw = withAlts([SWAP]);
  for (const k of [null, undefined, 'main', 'nope']) assert.equal(applyAlt(raw, k), raw);
  const plainRaw = mk();
  assert.equal(applyAlt(plainRaw, 'swap'), plainRaw);
});

test('applyAlt does not mutate raw and returns a new object with altKey', () => {
  const raw = withAlts([SWAP]);
  const snap = structuredClone(raw);
  const out = applyAlt(raw, 'swap');
  assert.notEqual(out, raw);
  assert.equal(out.altKey, 'swap');
  assert.deepEqual(raw, snap);
  assert.equal(raw.altKey, undefined);
});

test('merge: plain objects merge key by key, strings and string arrays replace, null deletes a key', () => {
  const raw = withAlts([{ key: 'k', name: 'K', rosters: { theirs: ['milotic'] }, sets: 'new sets', assumptions: ['only'], team: { summary: ['t2'], evidence: null } }],
    { sets: 'old', assumptions: ['a', 'b'] });
  const out = applyAlt(raw, 'k');
  assert.deepEqual(out.rosters.theirs, ['milotic'], 'array of strings replaces');
  assert.deepEqual(out.rosters.ours, raw.rosters.ours, 'sibling key kept');
  assert.equal(out.sets, 'new sets');
  assert.deepEqual(out.assumptions, ['only']);
  assert.deepEqual(out.team.summary, ['t2']);
  assert.equal('evidence' in out.team, false, 'null deletes the key');
  assert.equal(out.team.members.length >= 1, true, 'other team keys kept');
  assert.equal(out.coach, 'Ning');
});

test('merge: a null patch value deletes a top-level key', () => {
  const out = applyAlt(withAlts([{ key: 'k', name: 'K', written: null }]), 'k');
  assert.equal('written' in out, false);
});

test('merge: arrays of { id } merge by id (replace, append, drop)', () => {
  const raw = withAlts([{ key: 'k', name: 'K',
    bring: { bench: [{ id: 'conkeldurr', why: 'replaced' }, { id: 'sinistcha', why: 'new bench' }] },
    team: { members: [{ id: 'charizard', role: 'new role' }, { id: 'pelipper', role: 'added' }, { id: 'conkeldurr', drop: true }] } }]);
  const out = applyAlt(raw, 'k');
  const bench = out.bring.bench;
  assert.equal(bench.find((b) => b.id === 'conkeldurr').why, 'replaced');
  assert.ok(bench.some((b) => b.id === 'sinistcha' && b.why === 'new bench') === false, 'sinistcha is in the six, so pruned from bench');
  const mem = out.team.members;
  assert.deepEqual(mem.map((m) => m.id), ['charizard', 'pelipper']);
  assert.equal(mem[0].role, 'new role');
  assert.equal(mem[0].drop, undefined);
});

test('merge: arrays without ids (leads patch) replace wholesale', () => {
  const raw = withAlts([{ key: 'k', name: 'K', leads: [{ ours: ['charizard', 'pelipper'], vs: ['lucario'], t1: 'only' }] }]);
  const out = applyAlt(raw, 'k');
  assert.equal(out.leads.length, 1);
  assert.equal(out.leads[0].t1, 'only');
});

test('merge: id arrays with a non-id patch element replace instead of merging', () => {
  const raw = withAlts([{ key: 'k', name: 'K', team: { members: [{ role: 'no id' }] } }]);
  const out = applyAlt(raw, 'k');
  assert.deepEqual(out.team.members, [{ role: 'no id' }]);
});

test('prune: leads whose ours are not all in the six are removed', () => {
  const out = applyAlt(withAlts([ALT_GONE]), 'noconk');
  assert.deepEqual(out.leads.map((l) => l.t1), ['a']);
});

test('prune: previews whose bring4 or lead contain a non-six mon are removed', () => {
  const out = applyAlt(withAlts([ALT_GONE]), 'noconk');
  assert.deepEqual(out.previews.map((p) => p.if), ['A']);
  // a preview whose lead alone is out of the six goes too
  const raw = withAlts([ALT_GONE], { previews: [{ if: 'L', bring4: ['charizard', 'pelipper'], lead: ['charizard', 'conkeldurr'], note: '' }] });
  assert.equal(applyAlt(raw, 'noconk').previews.length, 0);
});

test('prune: calcs with an ours side outside the six become null, index preserved, their calcs untouched', () => {
  const out = applyAlt(withAlts([ALT_GONE]), 'noconk');
  assert.equal(out.calcs.length, 3);
  assert.equal(out.calcs[1], null);
  assert.equal(out.calcs[0].attacker.id, 'charizardmegay');
  assert.equal(out.calcs[2].attacker.id, 'rillaboom');
});

test('prune: a calc whose ours side is the attacker is nulled too', () => {
  const raw = withAlts([ALT_GONE], { calcs: [calc(ours('conkeldurr'), worst('milotic'), 'closecombat'), calc(worst('lucario'), ours('charizard'), 'rockslide')] });
  const out = applyAlt(raw, 'noconk');
  assert.equal(out.calcs[0], null);
  assert.ok(out.calcs[1]);
});

test('mega prefix rule: charizardmegay counts as charizard in the six', () => {
  const raw = withAlts([{ key: 'k', name: 'K', bring: { six: ['charizard', 'pelipper', 'kangaskhan', 'sinistcha'] } }],
    { calcs: [calc(ours('charizardmegay'), worst('gholdengo')), calc(ours('charizardmegax'), worst('milotic'))] });
  const out = applyAlt(raw, 'k');
  assert.ok(out.calcs[0] && out.calcs[1], 'both mega formes survive');
  // and a mega of a mon that is gone is pruned
  const raw2 = withAlts([{ key: 'k', name: 'K', bring: { six: ['pelipper', 'kangaskhan', 'sinistcha', 'conkeldurr'] } }],
    { calcs: [calc(ours('charizardmegay'), worst('gholdengo'))], combos: { theirs: [], ours: [{ attackers: [['charizardmegay', 'heatwave'], ['kangaskhan', 'x']], into: 'milotic' }] } });
  const out2 = applyAlt(raw2, 'k');
  assert.equal(out2.calcs[0], null);
  assert.equal(out2.combos.ours.length, 0, 'charizardmegay attacker counts as gone');
});

test('mega prefix rule: a six entry that merely starts with the same letters does not match', () => {
  const raw = withAlts([{ key: 'k', name: 'K', bring: { six: ['charizardx', 'pelipper', 'kangaskhan', 'sinistcha'] } }], { calcs: [calc(ours('charizard'), worst('gholdengo'))] });
  assert.equal(applyAlt(raw, 'k').calcs[0], null);
});

test('prune: combos.theirs whose into is gone and combos.ours with a gone attacker are removed', () => {
  const out = applyAlt(withAlts([ALT_GONE]), 'noconk');
  assert.deepEqual(out.combos.theirs.map((c) => c.into), ['kangaskhan']);
  assert.deepEqual(out.combos.ours.map((c) => c.into), ['gholdengo']);
});

test('prune: combos keep entries that mention their (opponent) mons only', () => {
  const raw = withAlts([ALT_GONE], { combos: { theirs: [{ attackers: [['lucario', 'x'], ['milotic', 'y']], into: 'charizard' }], ours: [] } });
  assert.equal(applyAlt(raw, 'noconk').combos.theirs.length, 1);
});

test('prune: perMon keys that are gone are removed; their mons and in-six mons stay', () => {
  const out = applyAlt(withAlts([ALT_GONE]), 'noconk');
  assert.deepEqual(Object.keys(out.perMon).sort(), ['charizard', 'rillaboom']);
});

test('prune: team.members that are gone are removed', () => {
  const out = applyAlt(withAlts([ALT_GONE]), 'noconk');
  assert.deepEqual(out.team.members.map((m) => m.id), ['charizard']);
});

test('prune: bring.bench entries that are in the six are removed', () => {
  const out = applyAlt(withAlts([ALT_GONE]), 'noconk');
  assert.deepEqual(out.bring.bench.map((b) => b.id), ['conkeldurr']);
});

test('their mons are never pruned (rosters.theirs, calcs on their side, perMon, threats)', () => {
  const out = applyAlt(withAlts([ALT_GONE]), 'noconk');
  assert.deepEqual(out.rosters.theirs, ['rillaboom', 'gholdengo', 'milotic', 'lucario']);
  assert.ok(out.perMon.rillaboom);
  assert.equal(out.threats.length, 4);
  // even if an opposing mon is not in our six, nothing keyed on it is dropped
  const raw = withAlts([ALT_GONE], { perMon: { lucario: { role: 'x' } }, combos: { theirs: [{ attackers: [['lucario', 'x'], ['milotic', 'y']], into: 'kangaskhan' }], ours: [] } });
  const o2 = applyAlt(raw, 'noconk');
  assert.ok(o2.perMon.lucario);
  assert.equal(o2.combos.theirs.length, 1);
});

test('addCalcs are appended after the (pruned) calcs and shown in the validated output', () => {
  const extra = calc(worst('lucario'), ours('pelipper'), 'rockslide');
  const raw = withAlts([{ ...ALT_GONE, addCalcs: [extra] }]);
  const out = applyAlt(raw, 'noconk');
  assert.equal(out.calcs.length, 4);
  assert.deepEqual(out.calcs[3], extra);
  const { guide, problems } = validateGuide(out, mech);
  assert.equal(guide.calcs.length, 3, 'two survivors + the added calc');
  assert.equal(guide.calcs[2].defender.id, 'pelipper');
  assert.ok(!problems.some((p) => p.startsWith('calcs')), 'no calcs problems');
});

test('addCalcs naming a gone mon are kept (added after pruning)', () => {
  const extra = calc(ours('conkeldurr'), worst('milotic'), 'closecombat');
  const out = applyAlt(withAlts([{ ...ALT_GONE, addCalcs: [extra] }]), 'noconk');
  assert.deepEqual(out.calcs[out.calcs.length - 1], extra);
});

test('validateGuide drops null calcs without a problem but still reports malformed ones', () => {
  const raw = mk({ calcs: [calc(ours('charizard'), worst('gholdengo')), null, { attacker: { id: 'nosuch', set: 'ours' }, defender: worst('milotic'), move: 'heatwave' }] });
  const { guide, problems } = validateGuide(raw, mech);
  assert.equal(guide.calcs.length, 1);
  assert.ok(!problems.includes('calcs[1] dropped'), 'null entry silent');
  assert.ok(problems.includes('calcs[2] dropped'), 'malformed entry reported');
});

test('threats: a calc pointing at a pruned calc becomes null, a surviving one is re-indexed correctly', () => {
  const out = applyAlt(withAlts([ALT_GONE]), 'noconk');
  const { guide } = validateGuide(out, mech);
  assert.equal(guide.calcs.length, 2);
  const t = Object.fromEntries(guide.threats.map((x) => [x.id, x.calc]));
  assert.equal(t.lucario, null, 'pointed at the pruned calc');
  assert.equal(t.rillaboom, 1, 'raw calc 2 is now index 1');
  assert.equal(guide.calcs[t.rillaboom].attacker.id, 'rillaboom');
  assert.equal(t.gholdengo, 0);
  assert.equal(guide.calcs[t.gholdengo].defender.id, 'gholdengo');
  assert.equal(t.milotic, null);
});

test('threats: with addCalcs, raw indices still point at the same calcs', () => {
  const extra = calc(worst('lucario'), ours('pelipper'), 'rockslide');
  const out = applyAlt(withAlts([{ ...ALT_GONE, addCalcs: [extra] }]), 'noconk');
  const { guide } = validateGuide(out, mech);
  const r = guide.threats.find((x) => x.id === 'rillaboom');
  assert.equal(guide.calcs[r.calc].attacker.id, 'rillaboom');
});

test('validateGuide: alts is [] without valid alternatives, alt is main', () => {
  assert.deepEqual(validateGuide(mk(), mech).guide.alts, []);
  assert.equal(validateGuide(mk(), mech).guide.alt, 'main');
  const bad = mk({ alternatives: [{ key: 'x' }, { name: 'no key' }, { key: 'main', name: 'Main' }, { key: '', name: 'empty' }, null] });
  const { guide } = validateGuide(bad, mech);
  assert.deepEqual(guide.alts, []);
  assert.equal(guide.alt, 'main');
});

test('validateGuide: alts lists main first with defaults, then valid alternatives; invalid ones ignored', () => {
  const raw = withAlts([{ key: 'a', name: 'Alpha', note: 'na' }, { key: 'b', name: 'Beta' }, { name: 'nokey' }, { key: 'main', name: 'x' }, { key: 'c' }]);
  const { guide } = validateGuide(raw, mech);
  assert.deepEqual(guide.alts, [
    { key: 'main', name: 'Main six', note: '' },
    { key: 'a', name: 'Alpha', note: 'na' },
    { key: 'b', name: 'Beta', note: '' }]);
  assert.equal(guide.alt, 'main');
});

test('validateGuide: mainName and mainNote customise the main entry', () => {
  const raw = withAlts([{ key: 'a', name: 'Alpha' }], { mainName: 'Standard', mainNote: 'the default' });
  assert.deepEqual(validateGuide(raw, mech).guide.alts[0], { key: 'main', name: 'Standard', note: 'the default' });
});

test('guideFor applies the alternative before validating; alt reports the key', () => {
  const raw = withAlts([ALT_GONE]);
  const main = guideFor(5, 2, 'Ning', { guides: [raw], mech });
  const alt = guideFor(5, 2, 'Ning', { guides: [raw], mech, alt: 'noconk' });
  assert.equal(main.guide.alt, 'main');
  assert.equal(main.guide.leads.length, 2);
  assert.equal(alt.guide.alt, 'noconk');
  assert.equal(alt.guide.leads.length, 1);
  assert.equal(alt.guide.calcs.length, 2);
  assert.deepEqual(alt.guide.alts.map((a) => a.key), ['main', 'noconk']);
});

test('guideFor with a swapped six patch shows the new six', () => {
  const raw = withAlts([SWAP]);
  const { guide } = guideFor(5, 2, 'Ning', { guides: [raw], mech, alt: 'swap' });
  assert.deepEqual(guide.bring.six, ['charizard', 'conkeldurr', 'pelipper', 'kangaskhan']);
  assert.equal(guide.leads.length, 2, 'both leads survive: charizard+kanga and conk+pelipper');
  assert.ok(!guide.bring.bench.some((b) => b.id === 'conkeldurr' || b.id === 'pelipper'), 'six leaves the bench');
});

test('guideFor with an unknown alt falls back to the main guide', () => {
  const raw = withAlts([ALT_GONE]);
  const main = guideFor(5, 2, 'Ning', { guides: [raw], mech });
  const unk = guideFor(5, 2, 'Ning', { guides: [raw], mech, alt: 'does-not-exist' });
  assert.deepEqual(unk.guide, main.guide);
  assert.equal(unk.guide.alt, 'main');
});

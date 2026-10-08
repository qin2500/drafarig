// Calcs notebook as picture cards (UX-VISUAL-TOOLS.md §4, VGC-PLAN-TOOLS.md §7.1 CA1–CA2), on the stub DOM with saved
// calcs written as the app saves them (current pins, so they're up to date unless a test says otherwise).
// - k of 16 rolls shows 16 cells; any other fraction shows an exact-fraction bar, never cells.
// - Knife-edge is marked; mixed envelopes say "Depends on their investment".
// - Refused, needs-state, stale and unknown classes keep v4's no-digits rule, with no strip.
// - Colour follows the side you prepare, always with a glyph and words.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootApp, parseHtml, findAll, find, text, hasClass } from './ui-harness.mjs';
import { device, WS, NOW } from './prep-helpers.mjs';
import { mech } from './calc-helpers.mjs';
import { pinsOf } from '../lib/calc/keys.mjs';
import { ENGINE_INFO } from '../public/prep-engine.js';
import * as C from '../public/prep-copy.js';

const ready = (app) => app.waitFor(() => !/Checking what they can learn/.test(app.html()), 'the Reg M-C data', 20000);
const PINS = pinsOf(mech, ENGINE_INFO);
const set = (species, moves = []) => ({ species, item: '', ability: '', nature: '', moves, sp: 'unknown' });
let n = 0;
/** A saved calc: attacker side ('theirs' hits you), the summary as the app stores it, optional extras. */
function calc(side, summary, extra = {}) {
  const [a, d] = side === 'theirs' ? ['rillaboom', 'charizard'] : ['charizard', 'rillaboom'];
  return { id: `calc_${String.fromCharCode(97 + n++).repeat(12)}`, createdAt: NOW, updatedAt: NOW, pinned: false, mark: null, parentId: null, notes: '', tags: [], kind: 'damage', title: '',
    scenario: { attacker: { set: set(a, ['woodhammer']), state: {} }, defender: { set: set(d), state: {} }, move: { id: side === 'theirs' ? 'woodhammer' : 'heatwave' }, field: {} },
    refs: { attacker: { setId: null, v: null, side }, defender: { setId: null, v: null, side: side === 'theirs' ? 'mine' : 'theirs' } }, summary, pins: PINS, entities: {}, checkedAt: NOW, ...extra };
}
const exact = (num, den, extra = {}) => ({ class: 'exact', code: null, range: { min: 60, max: 72 }, maxHP: 150, curHP: 150, ko: { one: { num: String(num), den: String(den) } }, dist: [{ n: 1 }], chips: [], flags: [], envelope: null, ...extra });
const env = (rows) => exact(0, 1, { envelope: rows.map(([key, num, den]) => ({ key, label: null, class: den ? 'exact' : 'refused', range: den ? { min: 50, max: 90 } : null, maxHP: 150, ko: den ? { one: { num: String(num), den: String(den) } } : null })) });
async function cards(calcs) {
  n = n % 20;
  const app = await bootApp({ mode: `prep/w/${WS}/calcs`, storage: device({ ws: { calcs } }) });
  await ready(app);
  const r = parseHtml(app.html());
  return { app, cards: findAll(r, (x) => x.tag === 'div' && hasClass(x, 'calccard')) };
}
const tone = (c) => ['ok', 'bad', 'warn', 'stale', 'none'].find((t) => hasClass(c, `cc-${t}`));
const cells = (c) => findAll(c, (x) => hasClass(x, 'cell'));

test('CA1 a k-of-16 result: words first, the HP band, 16 cells with k filled; other fractions get an exact-fraction bar', async (t) => {
  const { app, cards: cs } = await cards([calc('mine', exact(6, 16)), calc('mine', exact(1, 3)), calc('mine', exact(3, 8, { dist: [{ n: 2 }] }))]);
  t.after(() => app.restore());
  const byWords = (re) => cs.find((c) => re.test(text(c)));
  const six = byWords(/6 of 16 rolls KO/);
  assert.equal(cells(six).length, 16);
  assert.equal(cells(six).filter((x) => hasClass(x, 'ko')).length, 6);
  assert.ok(find(six, (x) => hasClass(x, 'hpbar') && x.attrs['aria-hidden'] === 'true'), 'HP band, hidden from screen readers (the words say it)');
  const kids = six.children.filter((x) => x.tag);
  assert.ok(kids.findIndex((x) => hasClass(x, 'headline')) < kids.findIndex((x) => hasClass(x, 'hpbar')), 'words before the picture');
  const third = byWords(/in 1 of 3 cases/);
  assert.equal(cells(third).length, 0, 'never cells for 1/3');
  assert.ok(find(third, (x) => hasClass(x, 'fracbar')));
  const multi = byWords(/the move KOs in 3 of 8 cases/);
  assert.equal(cells(multi).length, 0, 'a multi-hit move gets the bar too');
  for (const c of cs) assert.ok(find(c, (x) => hasClass(x, 'movechip') && /\bty-[a-z]+\b/.test(x.attrs.class)), 'a type-coloured move chip');
});

test('CA2 colour follows your side: your hit that always KOs is good, theirs is bad; a split is "depends"; glyph and words always', async (t) => {
  const { app, cards: cs } = await cards([calc('mine', exact(16, 16)), calc('theirs', exact(16, 16)), calc('theirs', exact(0, 16)), calc('theirs', exact(4, 16))]);
  t.after(() => app.restore());
  assert.deepEqual(cs.map(tone), ['ok', 'bad', 'ok', 'warn']);
  const ocs = cs.map((c) => text(find(c, (x) => hasClass(x, 'oc'))).trim());
  assert.match(ocs[0], /^✓ .*every roll KOs/);
  assert.match(ocs[1], /^✕ .*every roll KOs/);
  assert.match(ocs[2], /^✓ .*no roll KOs/);
  assert.match(ocs[3], /^◐ .*4 of 16 rolls KO/);
  assert.match(text(cs[1]), new RegExp(C.CALCCARD.side.theirs));
});

test('knife-edge is badged; envelopes: all KO, none, or "Depends on their investment" with one labelled strip per investment', async (t) => {
  const { app, cards: cs } = await cards([
    calc('mine', exact(8, 16, { flags: ['knife-edge'] })),
    calc('mine', env([['frail', 16, 16], ['common', 16, 16], ['max', 16, 16]])),
    calc('theirs', env([['frail', 0, 16], ['max', 16, 16]])),
    calc('theirs', env([['frail', 16, 16], ['max', 0, 0]])),
  ]);
  t.after(() => app.restore());
  assert.ok(find(cs[0], (x) => hasClass(x, 'badge') && hasClass(x, 'knife')));
  assert.match(text(cs[1]), new RegExp(C.CALCCARD.envAll));
  assert.equal(tone(cs[1]), 'ok');
  assert.equal(findAll(cs[1], (x) => hasClass(x, 'envrow')).length, 3);
  assert.match(text(cs[2]), new RegExp(C.CALCCARD.envSplit));
  assert.equal(tone(cs[2]), 'warn');
  assert.match(text(cs[3]), new RegExp(`${C.CALCCARD.envSplit}[^]*∅ ${C.CALCCARD.noNumber}`), 'a row without a number is a grey "no number", not a strip');
});

test('no number, out of date and any class v4 never emits: a grey tile, no strip, no digits; out of date offers Re-check', async (t) => {
  const stalePins = { ...PINS, engine: 'something-else' };
  const { app, cards: cs } = await cards([
    calc('mine', { class: 'refused', code: 'engine-error' }),
    calc('mine', { class: 'needs-state', code: 'needs-form' }),
    calc('mine', { class: 'approx', code: null }),
    calc('theirs', exact(16, 16), { pins: stalePins }),
  ]);
  t.after(() => app.restore());
  for (const c of cs) {
    assert.equal(cells(c).length + findAll(c, (x) => hasClass(x, 'fracbar') || hasClass(x, 'hpbar')).length, 0, text(c));
    const body = text(c).replace(text(find(c, (x) => hasClass(x, 'linkish'))), '');
    assert.doesNotMatch(body, /\d/, `no digits: ${body}`);
  }
  assert.deepEqual(cs.map(tone), ['none', 'none', 'none', 'stale']);
  assert.ok(find(cs[3], (x) => x.attrs['data-pa'] === 'calc-recheck' && hasClass(x, 'primary')));
});

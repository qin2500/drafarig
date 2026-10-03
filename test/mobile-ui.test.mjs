// Phone layout of the Draft screen's "Best single picks" (and the adjacent overflow fixes), checked without a browser:
// the markup public/app.js renders from the fixtures (via test/ui-harness.mjs) and the rules in public/styles.css.
// These are source / markup / layout-arithmetic invariants at the target widths 320, 375, 390 and 430 px, not a rendering:
// nothing here measures pixels or takes screenshots.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bootApp, RAW, parseHtml, parseCss, findAll, find, hasClass, classes, text, ancestors } from './ui-harness.mjs';
import { buildLeague } from '../lib/league.mjs';
import { affordability } from '../lib/budget.mjs';
import { buildPlans } from '../lib/optimizer.mjs';

const ROOT = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');
const dex = JSON.parse(read('data/dex.json'));
const CSS = parseCss(read('public/styles.css'));
const PHONE = '(max-width: 767px)';
const WIDTHS = [320, 375, 390, 430];
const AFF_LABEL = { ok: 'Affordable', tight: 'Tight', breaks: 'Breaks budget' };

/** Declarations of the rule(s) for exactly this selector under this @media (null = top level), merged in source order. */
const rulesFor = (selector, media = null) => CSS.filter((r) => r.media === media && r.selectors.includes(selector));
const decl = (selector, media = null) => Object.assign({}, ...rulesFor(selector, media).map((r) => r.decls));
const lastIndex = (selector, media = null) => Math.max(-1, ...rulesFor(selector, media).map((r) => r.index));

// What the Draft screen should list for a coach, straight from lib/ (the same calls app.js makes).
function expectedSingles(coach) {
  const L = buildLeague(RAW, dex, {});
  const c = L.coaches.find((x) => x.name === coach);
  const available = L.board.filter((b) => !b.taken && b.id).map((b) => ({ id: b.id, cost: b.points }));
  const ids = (x) => x.picks.map((p) => p.id).filter(Boolean);
  const P = buildPlans(dex, ids(c), available, c.slotsLeft, c.pointsLeft, {
    opponents: L.coaches.filter((x) => x.name !== c.name).map((x) => ({ coach: x.name, ids: ids(x) })),
    rosterCosts: Object.fromEntries(c.picks.filter((p) => p.id).map((p) => [p.id, p.points])),
  });
  const aff = new Map(affordability(available, c.pointsLeft, c.slotsLeft).map((a) => [a.id, a]));
  const zh = (id) => L.board.find((b) => b.id === id)?.zh || dex.species[id]?.zh || '';
  return {
    ok: P.singles.filter((x) => aff.get(x.id)?.status !== 'breaks').slice(0, 12),
    over: P.singles.filter((x) => aff.get(x.id)?.status === 'breaks').slice(0, 5),
    aff, msg: (s) => `Pick: ${dex.species[s.id].name} ${zh(s.id)} (${s.cost} pts)`,
  };
}

async function singlesScreen(t, coach = 'Anthony') {
  const app = await bootApp();
  t.after(() => app.restore());
  if (coach !== 'Anthony') await app.change('coach', { value: coach }); // Anthony is the default coach
  await app.click({ dtab: 'singles' });
  const table = find(parseHtml(app.html()), (n) => n.tag === 'table' && hasClass(n, 'picks'));
  assert.ok(table, 'Best single picks renders a table.picks');
  return { app, table };
}

// Anthony (fixture): 12 affordable picks. Ning: Tight picks, plus over-budget picks below the divider with Blocked buttons.
for (const [coach, tight, over] of [['Anthony', 0, 0], ['Ning', 7, 5]])
test(`Best single picks (${coach}): every row has the four scoped cells, in ranking order, with the same data and actions`, async (t) => {
  const { table } = await singlesScreen(t, coach);
  const E = expectedSingles(coach);
  assert.deepEqual([E.ok.length, E.ok.filter((s) => E.aff.get(s.id).status === 'tight').length, E.over.length], [12, tight, over], 'fixture shape');
  const rows = findAll(table, (n) => n.tag === 'tr');
  const head = rows.find((r) => hasClass(r, 'picks-head'));
  assert.deepEqual(head.children.filter((c) => c.tag).map((c) => c.tag), ['th', 'th', 'th', 'th']);
  assert.deepEqual(head.children.filter((c) => c.tag).map(text), ['Mon', 'Budget', 'Why', '']);
  const picks = rows.filter((r) => hasClass(r, 'pick-row'));
  const divider = rows.filter((r) => hasClass(r, 'picks-divider'));
  assert.equal(rows.length, 1 + picks.length + divider.length, 'no unclassed rows');
  const expected = [...E.ok, ...E.over];
  assert.deepEqual(picks.map((r) => find(r, (n) => hasClass(n, 'nm')).attrs['data-mon']), expected.map((s) => s.id), 'ranking order unchanged');
  if (E.over.length) {
    assert.equal(divider.length, 1);
    assert.equal(rows.indexOf(divider[0]), 1 + E.ok.length, 'divider sits between affordable and over-budget picks');
    assert.equal(find(divider[0], (n) => n.tag === 'td').attrs.colspan, '4');
  } else assert.equal(divider.length, 0);

  picks.forEach((r, i) => {
    const s = expected[i], a = E.aff.get(s.id);
    const cells = r.children.filter((c) => c.tag);
    assert.deepEqual(cells.map((c) => [c.tag, classes(c)]), [['td', ['pick-mon']], ['td', ['pick-budget']], ['td', ['pick-why']], ['td', ['pick-act']]], s.id);
    const [mon, budget, why, act] = cells;
    assert.ok(text(mon).includes(`${s.cost} pts`), `${s.id} cost chip`);
    assert.equal(text(find(budget, (n) => hasClass(n, 'chip'))), AFF_LABEL[a.status]);
    assert.equal(text(find(budget, (n) => hasClass(n, 'small'))), a.reason ?? '');
    assert.deepEqual(findAll(why, (n) => hasClass(n, 'reason')).map(text), s.why, `${s.id} reasons, in order`);
    const inPlan = find(why, (n) => hasClass(n, 'muted'));
    assert.equal(inPlan ? text(inPlan) : '', s.inPlans.length ? `In plan ${s.inPlans.join(', ')}` : '');
    const buttons = findAll(act, (n) => n.tag === 'button');
    if (a.status === 'breaks') {
      assert.deepEqual(buttons.map((b) => [text(b), 'disabled' in b.attrs, b.attrs['data-check'], b.attrs['data-copy']]), [['Blocked', true, undefined, undefined]]);
    } else {
      assert.deepEqual(buttons.map((b) => [text(b), b.attrs['data-check'], b.attrs['data-copy']]), [['Check', s.id, undefined], ['Copy pick', undefined, E.msg(s)]]);
    }
  });
});

test('the picks classes are scoped to Best single picks: plans, other tables and screens do not get them', async (t) => {
  const app = await bootApp();
  t.after(() => app.restore());
  const scoped = (html) => findAll(parseHtml(html), (n) => classes(n).some((c) => /^picks?(-|$)/.test(c)));
  assert.equal(scoped(app.html()).length, 0, 'Roster plans tab');
  for (const mode of ['team', 'league', 'learn', 'setup']) {
    await app.click({ mode });
    assert.equal(scoped(app.html()).length, 0, mode);
  }
});

test('the card actions still drive the existing handlers: Check opens the check panel, Copy pick copies, the name opens the drawer', async (t) => {
  const { app, table } = await singlesScreen(t);
  const row = findAll(table, (n) => hasClass(n, 'pick-row')).find((r) => find(r, (n) => n.attrs['data-check']));
  const check = find(row, (n) => n.attrs['data-check']), copy = find(row, (n) => n.attrs['data-copy']), name = find(row, (n) => hasClass(n, 'nm'));
  const id = check.attrs['data-check'];

  await app.click({ copy: copy.attrs['data-copy'] });
  assert.deepEqual(app.clipboard, [copy.attrs['data-copy']]);
  assert.equal(app.toast.textContent, `Copied: ${copy.attrs['data-copy']}`);

  await app.click({ mon: name.attrs['data-mon'] });
  assert.equal(app.drawer.hidden, false);
  assert.ok(app.drawer.innerHTML.includes(dex.species[id].name));

  await app.click({ check: id });
  assert.equal(app.drawer.hidden, true, 'Check closes the drawer, as before');
  const sel = find(parseHtml(app.html()), (n) => n.tag === 'select' && n.attrs.id === 'checkPick');
  assert.equal(find(sel, (n) => n.tag === 'option' && 'selected' in n.attrs)?.attrs.value, id);
  assert.ok(app.html().includes('class="verdict"'), 'the check verdict renders');
  assert.ok(find(parseHtml(app.html()), (n) => n.tag === 'table' && hasClass(n, 'picks')), 'still on Best single picks');
});

test('phone CSS: each pick becomes a card with a full-width, labelled Why and a touch-size action row', () => {
  assert.ok(rulesFor('.layout', PHONE).length, `${PHONE} is the app's existing phone breakpoint`);
  for (const s of ['.picks', '.picks tbody', '.picks tr', '.picks td']) assert.equal(decl(s, PHONE).display, 'block', s);
  assert.equal(decl('.picks .picks-head', PHONE).display, 'none');
  assert.equal(decl('.picks .pick-why::before', PHONE).content, '"Why"');
  assert.equal(decl('.picks .pick-why::before', PHONE).display, 'block');
  assert.deepEqual([decl('.picks .pick-act', PHONE).display, decl('.picks .pick-act', PHONE)['flex-wrap']], ['flex', 'wrap']);
  assert.equal(decl('.picks .pick-act button', PHONE)['min-height'], '44px');
  assert.equal(decl('.picks td', PHONE).border, '0', 'no table borders inside a card');
  // Wide screens keep the table; its Why column wraps at word boundaries instead of splitting words into fragments.
  assert.equal(decl('.picks .reason')['overflow-wrap'], 'break-word');
  assert.ok(!CSS.some((r) => r.media === null && r.selectors.some((s) => s.startsWith('.picks')) && 'display' in r.decls), 'no wide-screen display change');
  assert.equal(decl('.reason')['overflow-wrap'], 'anywhere', 'the shared .reason rule is unchanged (plans, check panel)');
});

test('phone CSS: the overrides come after the base rules they override (same specificity, so source order decides)', () => {
  for (const [s, prop] of [['.chip', 'white-space'], ['.ladder .row', 'grid-template-columns'], ['.topbar', 'padding'], ['.drawer .close', 'min-height']]) {
    assert.ok(decl(s, PHONE)[prop], `${s} has a phone override`);
    assert.ok(lastIndex(s, PHONE) > lastIndex(s), `${s} phone rule must follow its base rule`);
  }
  assert.equal(decl('.chip', PHONE)['white-space'], 'normal');
  assert.equal(decl('.ladder .nm2', PHONE)['overflow-wrap'], 'break-word');
  for (const s of ['.filters > select', '.filters > input:not([type])']) {
    assert.deepEqual([decl(s, PHONE)['max-width'], decl(s, PHONE)['min-width']], ['100%', '0'], s);
  }
});

test('layout arithmetic from the stylesheet at 320 / 375 / 390 / 430 px: nothing fixed-width is wider than the screen', () => {
  const px = (v) => { const m = /^(-?[\d.]+)px$/.exec(v); assert.ok(m, `expected px, got ${v}`); return +m[1]; };
  const layoutPad = px(decl('.layout', PHONE).padding);
  const [, panelX] = decl('.panel').padding.split(' ').map(px);
  const panelBorder = px(decl('.panel').border.split(' ')[0]);
  const ladderFont = px(decl('.ladder .row')['font-size']);
  const ladder = decl('.ladder .row', PHONE);
  const tracks = /^minmax\(0, ([\d.]+)fr\) ([\d.]+)em minmax\(0, ([\d.]+)fr\)$/.exec(ladder['grid-template-columns']);
  assert.ok(tracks, ladder['grid-template-columns']);
  const oldLadder = /^(\d+)px (\d+)px minmax\(0, 1fr\)$/.exec(decl('.ladder .row')['grid-template-columns']);
  assert.ok(oldLadder, 'wide-screen ladder columns unchanged');
  const act = decl('.picks .pick-act', PHONE);
  for (const vw of WIDTHS) {
    const W = vw - 2 * layoutPad - 2 * panelBorder - 2 * panelX; // a panel's content width on a phone
    // coach grid: one column of min(250px, 100%) always fits
    assert.match(decl('.coach-grid')['grid-template-columns'], /minmax\(min\(250px, 100%\), 1fr\)/);
    assert.ok(Math.min(250, W) <= W);
    // speed ladder: name and bar both keep a usable width (was 170px + 60px fixed: a 24px bar at 320px)
    const free = W - +tracks[2] * ladderFont - 2 * px(ladder.gap);
    const fr = +tracks[1] + +tracks[3];
    const name = free * +tracks[1] / fr, bar = free * +tracks[3] / fr;
    assert.ok(name >= 100 && bar >= 60, `${vw}px: ladder name ${name.toFixed(0)}px, bar ${bar.toFixed(0)}px`);
    // pick card: Why spans the whole card; Check and Copy pick share one row at >= 44px tall and > 100px wide each
    assert.ok((W - px(act.gap)) / 2 > 100, `${vw}px: action buttons ${((W - px(act.gap)) / 2).toFixed(0)}px`);
    // glossary popover and drawer stay 8px inside the screen
    assert.equal(decl('.pop')['max-width'], 'min(320px, calc(100vw - 16px))');
    assert.ok(Math.min(320, vw - 16) + 8 <= vw - 8);
    assert.match(decl('.drawer', '(max-width: 1199px)').width, /^min\(380px, calc\(100vw - 16px\)\)$/);
  }
  // the drawer's height follows the visible viewport on phones (toolbar shown), with the 100vh rule as the fallback
  assert.equal(decl('.drawer', '(max-width: 1199px)')['max-height'], 'calc(100dvh - 80px)');
  assert.equal(decl('.drawer')['max-height'], 'calc(100vh - 80px)');
});

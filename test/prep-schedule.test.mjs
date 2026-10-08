// The league schedule in the app: Draft › League's schedule grid and Battle Prep's "Your weeks" strip, tab and card badges
// and hero line. Facts from the sheet's Paring tab only: no dates, results, current week or derived "next match"; honest
// states when the tab is missing, failed, unreadable or stale; unmatched names shown as written and never linked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootApp, RAW, parseHtml, findAll, find, text, hasClass } from './ui-harness.mjs';
import { T, device, isPortrait } from './prep-helpers.mjs';
import * as C from '../public/prep-copy.js';

const ready = (app) => app.waitFor(() => !/Checking what they can learn/.test(app.html()), 'the Reg M-C data', 20000);
async function open(mode, opts = {}) { const app = await bootApp({ mode, ...opts }); if (mode.startsWith('prep')) await ready(app); return app; }
const root = (app) => parseHtml(app.html());
const strip = (app) => find(root(app), (n) => n.tag === 'ol' && hasClass(n, 'weekstrip'));
const tabs = (app) => findAll(find(root(app), (n) => n.tag === 'nav' && n.attrs['aria-label'] === 'Opponents'), (n) => n.tag === 'a');
// words the schedule must never use about itself (the source line's "no dates, results or current week" is the one disclaimer)
const CLAIMS = /this week|current week|next match|upcoming|today|tomorrow|\b(mon|tue|wed|thu|fri|sat|sun)day\b|\b\d{1,2}\/\d{1,2}\b|\bwon\b|\blost\b|standings?/i;
const schedText = (app) => {
  const r = root(app);
  return [find(r, (n) => hasClass(n, 'weeks')), find(r, (n) => hasClass(n, 'sched')), find(r, (n) => hasClass(n, 'weekfact'))].filter(Boolean).map(text).join(' ').replace(/\s+/g, ' ')
    .replace(/the sheet has no dates, results or current week/g, '');
};

test('League: a schedule grid of weeks × groups from the sheet, your pairs marked "You" with a Battle Prep link, byes in grey', async (t) => {
  const app = await open('league');
  t.after(() => app.restore());
  const panel = find(root(app), (n) => hasClass(n, 'sched'));
  assert.ok(panel, 'schedule panel');
  const table = find(panel, (n) => n.tag === 'table');
  assert.deepEqual(findAll(table, (n) => n.tag === 'th' && n.attrs.scope === 'col').map(text), ['Week', 'Group A', 'Group B']);
  assert.deepEqual(findAll(table, (n) => n.tag === 'th' && n.attrs.scope === 'row').map(text), ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5']);
  const mine = findAll(table, (n) => hasClass(n, 'pair') && hasClass(n, 'you'));
  assert.equal(mine.length, 5, '4 matches and 1 bye');
  assert.match(text(mine[0]).replace(/\s+/g, ' '), /You Anthony vs Calvin Battle Prep/);
  assert.match(text(mine[1]).replace(/\s+/g, ' '), /You Anthony · Bye/);
  // names as Drafts writes them; links only from your own pairs, by seat (never by the sheet's raw text)
  assert.match(text(table), /Hex\(法拉\) vs Anthony/);
  assert.deepEqual(findAll(table, (n) => n.attrs['data-prep-vs']).map((n) => n.attrs['data-prep-vs']), ['8', '3', '1', '4']);
  assert.match(text(panel), /From the sheet's Paring tab, read \d{1,2}:\d\d( ?[AP]M)? · the sheet has no dates, results or current week/);
  assert.doesNotMatch(schedText(app), CLAIMS);
  await app.click({ prepVs: '8' });
  await app.waitFor(() => app.location.hash === '#prep/5v8', 'the week 1 matchup');
});

test('Battle Prep overview: "Your weeks" strip in week order, portraits and links by seat, the bye not a button, no week called current', async (t) => {
  const app = await open('prep/5');
  t.after(() => app.restore());
  assert.match(T(app), /Your weeks · Group A \(from the sheet\)/);
  const items = findAll(strip(app), (n) => n.tag === 'li');
  assert.equal(items.length, 5);
  const links = findAll(strip(app), (n) => n.tag === 'a');
  assert.deepEqual(links.map((a) => [a.attrs.href, a.attrs['data-opp'], a.attrs['aria-label']]), [
    ['#prep/5v8', '8', 'Week 1: Calvin. Open the briefing'],
    ['#prep/5v3', '3', 'Week 3: ZhuZi. Open the briefing'],
    ['#prep/5v1', '1', 'Week 4: Hex(法拉). Open the briefing'],
    ['#prep/5v4', '4', 'Week 5: Jacky. Open the briefing'],
  ]);
  assert.ok(links.every((a) => findAll(a, isPortrait).length + findAll(a, (n) => hasClass(n, 'noimg')).length === 1), 'one face per tile');
  const bye = items[1];
  assert.equal(findAll(bye, (n) => n.tag === 'a' || n.tag === 'button').length, 0);
  assert.match(text(bye), /Week 2: bye/);
  assert.equal(findAll(strip(app), (n) => n.attrs['aria-current'] !== undefined || hasClass(n, 'current') || hasClass(n, 'active')).length, 0);
  assert.doesNotMatch(schedText(app), CLAIMS);
  await app.click({ pa: 'go-opp', opp: '8' });
  assert.equal(app.location.hash, '#prep/5v8');
});

test('Opponent tabs, overview cards and the hero say the week(s) from the sheet; other-group opponents say they are not on your schedule', async (t) => {
  const app = await open('prep/5');
  t.after(() => app.restore());
  const byHref = Object.fromEntries(tabs(app).map((a) => [a.attrs.href, a]));
  assert.equal(text(find(byHref['#prep/5v8'], (n) => hasClass(n, 'wk'))), 'W1');
  assert.match(byHref['#prep/5v8'].attrs['aria-label'], /^Calvin, Week 1$/);
  assert.equal(find(byHref['#prep/5v2'], (n) => hasClass(n, 'wk')), null, 'Ning is in Group B');
  assert.equal(byHref['#prep/5v2'].attrs['aria-label'], 'Ning');
  const cards = findAll(root(app), (n) => n.tag === 'a' && hasClass(n, 'oppcard'));
  const card = (seat) => text(cards.find((a) => a.attrs['data-opp'] === seat)).replace(/\s+/g, ' ');
  assert.match(card('1'), /W4/);
  assert.match(card('2'), /Not paired with you in the sheet's weeks 1–5/);
  await app.click({ pa: 'go-opp', opp: '1' });
  assert.match(T(app), /W4 Week 4 · Group A/);
  await app.click({ pa: 'go-opp', opp: '2' });
  assert.match(T(app), /Not paired with you in the sheet's weeks 1–5 · Ning is in Group B on the sheet/);
  assert.doesNotMatch(schedText(app), CLAIMS);
  // another perspective sees its own weeks
  await app.click({ pa: 'flip' });
  assert.equal(app.location.hash, '#prep/2v5');
  assert.match(T(app), /Not paired with you in the sheet's weeks 1–5 · Anthony is in Group A on the sheet/);
});

test('"next" stays your own mark: a schedule never sets it, and a marked opponent is labelled "next (you marked)" on its week', async (t) => {
  const storage = device({ coach: 'Calvin', ws: { isNext: true } });
  const app = await open('prep/5', { storage });
  t.after(() => app.restore());
  const w1 = findAll(strip(app), (n) => n.tag === 'a')[0];
  assert.equal(w1.attrs['aria-label'], `Week 1: Calvin. Open the briefing, ${C.SCHED.marked}`);
  const fresh = await open('prep/5');
  t.after(() => fresh.restore());
  assert.equal(findAll(strip(fresh), (n) => hasClass(n, 'next')).length, 0, 'nothing is next until you say so');
  assert.equal([...fresh.storage.map.keys()].filter((k) => k.startsWith('drafarig.prep.ws.')).length, 0, 'reading the schedule saves nothing');
});

test('missing, failed and unreadable tabs: one honest line, no strip or badges, and the draft data still loads', async (t) => {
  const { pairingCsv, ...older } = RAW;
  const cases = [
    [older, C.SCHED.missing, 'Schedule: not in this copy of the sheet.'],
    [{ ...RAW, pairingCsv: null }, C.SCHED.failed, "Schedule couldn't be read from the sheet right now."],
    [{ ...RAW, pairingCsv: '<!DOCTYPE html><html>Sign in</html>' }, C.SCHED.unreadable, "The sheet's Paring tab didn't look like a schedule, so nothing is shown."],
  ];
  assert.equal(typeof pairingCsv, 'string');
  for (const [raw, prepLine, leagueLine] of cases) {
    const app = await open('prep/5', { raw });
    t.after(() => app.restore());
    assert.ok(T(app).includes(prepLine), prepLine);
    assert.equal(strip(app), null);
    assert.equal(tabs(app).filter((a) => find(a, (n) => hasClass(n, 'wk'))).length, 0);
    assert.match(T(app), /Battle Prep as Anthony/);
    await app.click({ pa: 'go-opp', opp: '8' });
    assert.equal(find(root(app), (n) => hasClass(n, 'weekfact')), null, 'no hero week fact');
    const league = await open('league', { raw });
    t.after(() => league.restore());
    const panel = find(root(league), (n) => hasClass(n, 'sched'));
    assert.ok(text(panel).includes(leagueLine), leagueLine);
    assert.equal(find(panel, (n) => n.tag === 'table'), null);
    assert.equal(!!find(panel, (n) => n.attrs['data-sheet-retry'] !== undefined), raw.pairingCsv === null, 'Retry only when the read failed');
    assert.match(T(league), /Coaches/);
  }
});

test('a perspective not in the schedule says so; the League grid still shows', async (t) => {
  const raw = { ...RAW, pairingCsv: RAW.pairingCsv.replace(/Anthony/g, 'Someone') };
  const app = await open('prep/5', { raw });
  t.after(() => app.restore());
  assert.ok(T(app).includes(C.SCHED.notListed('Anthony')));
  assert.equal(strip(app), null);
});

test('an unmatched name is shown as the sheet wrote it, escaped, marked "?", and never linked (strip and League)', async (t) => {
  const raw = { ...RAW, pairingCsv: RAW.pairingCsv.replace('Anthony,vs,Calvin', 'Anthony,vs,<img src=x onerror=alert(1)>') };
  const app = await open('prep/5', { raw });
  t.after(() => app.restore());
  const items = findAll(strip(app), (n) => n.tag === 'li');
  assert.equal(findAll(items[0], (n) => n.tag === 'a' || n.tag === 'img').length, 0);
  assert.match(text(items[0]), /Week 1: <img src=x onerror=alert\(1\)> \(not matched to a coach\)/);
  assert.ok(!app.html().includes('<img src=x'), 'escaped');
  const tab8 = tabs(app).find((a) => a.attrs.href === '#prep/5v8');
  assert.equal(find(tab8, (n) => hasClass(n, 'wk')), null, 'Calvin is no longer named for week 1');
  const league = await open('league', { raw });
  t.after(() => league.restore());
  const table = find(root(league), (n) => hasClass(n, 'sched-grid'));
  assert.ok(!league.html().includes('<img src=x'));
  assert.ok(findAll(table, (n) => n.tag === 'i').some((n) => text(n) === '<img src=x onerror=alert(1)>'));
  assert.deepEqual(findAll(table, (n) => n.attrs['data-prep-vs']).map((n) => n.attrs['data-prep-vs']), ['3', '1', '4'], 'no link for the unmatched week');
});

test('a stale sheet labels the schedule with its read time; a failed re-read of the Paring tab alone keeps the schedule already shown, labelled', async (t) => {
  const stale = await open('prep/5', { stale: true });
  t.after(() => stale.restore());
  assert.match(T(stale), /⚠ Sheet unreachable: schedule from \d{1,2}:\d\d( ?[AP]M)?/);
  const app = await open('prep/5');
  t.after(() => app.restore());
  assert.doesNotMatch(T(app), /Sheet unreachable/);
  app.setSheet({ ...RAW, pairingCsv: null });
  await app.visibility(false);
  await app.waitFor(() => app.fetches.filter((f) => f.path === '/api/sheet').length >= 2, 'the re-read');
  await app.settle(20);
  assert.equal(findAll(strip(app), (n) => n.tag === 'li').length, 5, 'still shown');
  assert.match(T(app), /⚠ Sheet unreachable: schedule from/, 'labelled as the earlier read');
  // a schedule edit on the sheet shows on the next read
  app.setSheet({ ...RAW, pairingCsv: RAW.pairingCsv.replace('Anthony,vs,Calvin', 'Anthony,vs,Data').replace('DingDIng,vs,Data', 'DingDIng,vs,Calvin') });
  await app.visibility(false);
  await app.waitFor(() => /Week 1: Data/.test(app.html()), 'the new week 1');
});

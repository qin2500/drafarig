// Sets as a team grid with set rings, and Practice as a record board (UX-VISUAL-TOOLS.md §3, §5; VGC-PLAN-TOOLS.md §7.3–7.4),
// on the stub DOM. Ring quarters follow each field's source, with the source in words. Your own library stays locked while
// preparing as another coach. Records are pips and counts, never a rate. Findings show severity in words and confidence as
// 0–3 bars from the existing rule. No pixels are measured here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootApp, parseHtml, findAll, find, text, hasClass } from './ui-harness.mjs';
import { T, device, theirSet, isPortrait, isIcon, WS, NOW } from './prep-helpers.mjs';
import { confidenceOf } from '../public/prep-practice.js';
import * as C from '../public/prep-copy.js';

const ready = (app) => app.waitFor(() => !/Checking what they can learn/.test(app.html()), 'the Reg M-C data', 20000);
async function open(mode, opts = {}) { const app = await bootApp({ mode, ...opts }); await ready(app); return app; }
const root = (app) => parseHtml(app.html());
const tileOf = (app, sp) => find(root(app), (n) => n.tag === 'li' && hasClass(n, 'settile') && !!find(n, (x) => x.attrs['data-species'] === sp || (x.tag === 'img' && (x.attrs.src ?? '').includes(`/${sp}.png`))));
const ringOf = (n) => (find(n, (x) => hasClass(x, 'sring'))?.attrs.class ?? '').split(/\s+/).filter((c) => c.startsWith('r-')).sort();

test('their team grid: a ring per portrait whose quarters follow each field\'s source, said in words; no set = a labelled guess action', async (t) => {
  const ladder = theirSet('set_llllllllllll', 'gholdengo', { item: 'choicespecs', ability: 'goodasgold', moves: ['makeitrain', 'shadowball'] });
  const s = device();
  const app0 = await open(`prep/w/${WS}/sets`, { storage: s });
  t.after(() => app0.restore());
  const rilla = tileOf(app0, 'rillaboom');
  assert.deepEqual(ringOf(rilla), ['r-ability-solid', 'r-item-solid', 'r-moves-gap', 'r-sp-gap'], 'seen item and ability; unknown moves and Stat Points');
  const b = find(rilla, (n) => n.tag === 'button');
  assert.equal(b.attrs['data-pa'], 'open-their-set');
  assert.match(b.attrs['aria-label'], /Item: Seen vs others; Ability: Seen vs others; Moves: unknown; Stat Points: unknown/);
  assert.match(text(rilla), /Seen vs others/);
  const milo = tileOf(app0, 'milotic');
  assert.ok(hasClass(milo, 'none'));
  assert.equal(find(milo, (n) => n.tag === 'button').attrs['data-pa'], 'guess-one');
  assert.match(text(milo), new RegExp(C.SETGRID.noSet));
  assert.ok(T(app0).includes(C.SETGRID.key), 'the ring key in words');
  // a ladder guess is dashed (never drawn like a seen set)
  const withLadder = device({ ws: { variants: [{ id: 'var_aaaaaaaaaaaa', role: 'likely', name: '', setIds: { gholdengo: 'set_llllllllllll' }, whyBuilt: '', planId: null, updatedAt: NOW }] } });
  const st = JSON.parse(withLadder.getItem(`drafarig.prep.ws.${WS}`));
  withLadder.setItem(`drafarig.prep.ws.${WS}`, JSON.stringify({ ...st, theirSets: [...st.theirSets, ladder] }));
  const app = await open(`prep/w/${WS}/sets`, { storage: withLadder });
  t.after(() => app.restore());
  assert.deepEqual(ringOf(tileOf(app, 'gholdengo')), ['r-ability-dashed', 'r-item-dashed', 'r-moves-dashed', 'r-sp-gap']);
  for (const img of findAll(find(root(app), (n) => hasClass(n, 'setgrid')), (n) => n.tag === 'img')) assert.ok(isPortrait(img));
  assert.equal(findAll(root(app), (n) => n.tag === 'svg' && !isIcon(n)).length, 0, 'rings are CSS, not drawn markup');
});

test('your sets: filled fields of your own set are solid ("yours"), ✓ marks the 6; preparing as another coach locks your library', async (t) => {
  const s = device();
  const app = await open(`prep/w/${WS}/sets`, { storage: s });
  t.after(() => app.restore());
  const zard = findAll(root(app), (n) => n.tag === 'li' && hasClass(n, 'settile') && hasClass(n, 'mine')).find((n) => /Charizard/.test(text(n)));
  assert.deepEqual(ringOf(zard), ['r-ability-solid', 'r-item-solid', 'r-moves-solid', 'r-sp-solid']);
  assert.ok(hasClass(zard, 'in6'));
  assert.match(find(zard, (n) => n.attrs.role === 'img').attrs['aria-label'], /Item: yours; Ability: yours; Moves: yours; Stat Points: yours/);
  assert.ok(find(zard, (n) => n.attrs['data-pa'] === 'toggle-six' && n.attrs['aria-pressed'] === 'true'));
  assert.ok(findAll(root(app), (n) => n.attrs['data-pa'] === 'my-create').length >= 1, 'a species without a set offers Create');
  const asNing = await open('prep/2v5/sets', { storage: device() });
  t.after(() => asNing.restore());
  await asNing.click({ pa: 'match-start-ws', tab: 'sets' });
  await asNing.waitFor(() => /Their team/.test(T(asNing)), 'the Sets tab as Ning');
  assert.ok(T(asNing).includes(`🔒 ${C.POV.mineViewing('Ning')}`));
  assert.equal(findAll(root(asNing), (n) => ['my-create', 'toggle-six'].includes(n.attrs['data-pa'])).length, 0);
});

test('practice board: one pip per game (won, lost, not logged) with words; counts only, no rate or %; findings with severity, status and confidence bars', async (t) => {
  const games = [{ id: 'game_aaaaaaaaaaaa', index: 0, result: 'W' }, { id: 'game_bbbbbbbbbbbb', index: 1, result: 'L' }, { id: 'game_cccccccccccc', index: 2, draft: true }];
  const mock = { id: 'mock_aaaaaaaaaaaa', date: '2026-10-06', partner: 'Sam', purpose: 'Does Trick Room survive Taunt?', variantIds: ['var_aaaaaaaaaaaa'], fidelity: 2, simulatedDisclosure: 'closed', games };
  const fnd = { id: 'fnd_aaaaaaaaaaaa', statement: 'Their Tailwind outran my lead', mechanism: 'speed', kind: 'structural', severity: 'major', evidence: { gameIds: ['game_bbbbbbbbbbbb'], calcIds: [] }, status: 'retest', statusAt: NOW, createdAt: NOW, sourceId: null };
  const s = device({ ws: { mockSets: [mock], findings: [fnd] } });
  const app = await open(`prep/w/${WS}/practice`, { storage: s });
  t.after(() => app.restore());
  const card = find(root(app), (n) => hasClass(n, 'mockcard'));
  assert.deepEqual(findAll(card, (n) => hasClass(n, 'pip')).map((n) => [n.attrs.class.split(' ')[1], text(find(n, (x) => hasClass(x, 'vh')))]),
    [['pip-W', 'Game 1: Won'], ['pip-L', 'Game 2: Lost'], ['pip-draft', 'Game 3: Not logged']]);
  assert.match(text(card), /1 won · 1 lost \(counts only\)/);
  assert.match(text(card), /Likely/);
  const tab = text(find(root(app), (n) => n.attrs.id === 'ptab-panel'));
  assert.doesNotMatch(tab, /%|win rate|\brate\b/i);
  const f = find(root(app), (n) => hasClass(n, 'findcard'));
  assert.ok(hasClass(f, 'sev-major'));
  assert.match(text(f), /Major · ⚡ Speed \/ Trick Room · Retesting/);
  const level = confidenceOf(JSON.parse(s.getItem(`drafarig.prep.ws.${WS}`)), fnd).level;
  assert.equal(findAll(f, (n) => hasClass(n, 'cb') && hasClass(n, 'on')).length, { none: 0, low: 1, medium: 2, high: 3 }[level]);
  assert.equal(find(f, (n) => hasClass(n, 'confbars')).attrs['aria-label'], `confidence ${C.CONFIDENCE[level]}`);
  const empty = await open(`prep/w/${WS}/practice`, { storage: device() });
  t.after(() => empty.restore());
  assert.ok(T(empty).includes(`✓ ${C.PRACTICE.noOpen}`));
});

test('expert chat is honestly not connected: one line in Tools, no input, button or reply area, nothing sent', async (t) => {
  const app = await open('prep/5', { storage: device() });
  t.after(() => app.restore());
  const line = find(root(app), (n) => n.tag === 'li' && hasClass(n, 'chat-off'));
  assert.ok(line);
  assert.equal(text(line).replace(/\s+/g, ' ').trim(), `${C.CHAT.name} ${C.CHAT.notConnected}`);
  assert.equal(findAll(line, (n) => ['input', 'textarea', 'button', 'a', 'form'].includes(n.tag)).length, 0);
  assert.doesNotMatch(app.html(), /data-pa="chat|aria-live|\bassistant\b|\blive chat\b/i);
  assert.ok(!app.fetches.some((f) => /chat/i.test(f.path)), 'no request is made for chat');
});

test('an off-script mock game is a grey pip and isn\'t counted as won or lost', async (t) => {
  const games = [{ id: 'game_aaaaaaaaaaaa', index: 0, result: 'W' }, { id: 'game_bbbbbbbbbbbb', index: 1, result: 'W', tag: 'partner-off-script' }];
  const s = device({ ws: { mockSets: [{ id: 'mock_aaaaaaaaaaaa', date: '2026-10-06', partner: 'Sam', purpose: '', variantIds: [], fidelity: 2, simulatedDisclosure: 'closed', games }] } });
  const app = await open(`prep/w/${WS}/practice`, { storage: s });
  t.after(() => app.restore());
  const card = find(root(app), (n) => hasClass(n, 'mockcard'));
  assert.deepEqual(findAll(card, (n) => hasClass(n, 'pip')).map((n) => n.attrs.class.split(' ')[1]), ['pip-W', 'pip-off']);
  assert.match(text(card), /1 won · 0 lost \(counts only\) · 1 off-script, not counted/);
});

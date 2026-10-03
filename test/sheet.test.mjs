// Sheet parsing + league building against a saved copy of the real sheet (2026-10-02).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCsv, parseBoardCsv, parseDraftsCsv, redNamesFromBoardHtml, isReddish } from '../lib/sheet.mjs';
import { buildLeague, computeTurn, picksUntil } from '../lib/league.mjs';

const fx = (n) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');
const dex = JSON.parse(readFileSync(new URL('../data/dex.json', import.meta.url), 'utf8'));
const raw = { boardCsv: fx('board.csv'), draftsCsv: fx('drafts.csv'), boardHtml: fx('board.html') };

test('parseCsv handles quotes, escaped quotes and CRLF', () => {
  assert.deepEqual(parseCsv('a,"b,c","d ""e"""\r\n1,,3'), [['a', 'b,c', 'd "e"'], ['1', '', '3']]);
});

test('board CSV: 257 entries over tiers 20..1, Chinese + English pairs', () => {
  const b = parseBoardCsv(raw.boardCsv);
  assert.equal(b.length, 257);
  assert.deepEqual([...new Set(b.map((x) => x.points))], Array.from({ length: 20 }, (_, i) => 20 - i));
  assert.deepEqual(b.find((x) => x.en === 'Charizard'), { points: 20, zh: '喷火龙', en: 'Charizard', row: 3, col: 1 });
});

test('drafts CSV: 10 coaches, picks with points, Points Left row', () => {
  const c = parseDraftsCsv(raw.draftsCsv);
  assert.equal(c.length, 10);
  const a = c.find((x) => x.name === 'Anthony');
  assert.equal(a.order, 5);
  assert.deepEqual(a.picks.map((p) => [p.en, p.points]), [['Charizard', 20], ['Sinistcha', 18], ['Pelipper', 16], ['Kangaskhan', 17]]);
  assert.equal(a.pointsLeft, 29);
  assert.equal(c.find((x) => x.order === 1).name, 'Hex(法拉)');
});

test('styled HTML: taken = red text, resolved through the CSS classes', () => {
  assert.ok(isReddish('#ff0000') && isReddish('#e06666') && !isReddish('#000000') && !isReddish('#ffffff'));
  const red = redNamesFromBoardHtml(raw.boardHtml).filter((r) => r.red);
  assert.equal(red.length, 44);
  assert.ok(red.every((r) => r.how === 'text'));
  assert.ok(red.some((r) => r.en === 'Charizard'));
});

test('red detection still works if the class names change or red becomes a background', () => {
  const html = raw.boardHtml.replaceAll('.s5{', '.s99{').replaceAll('class="s5', 'class="s99')
    .replace(/(\.s99\{[^}]*?)background-color:#ffffff;([^}]*?)color:#ff0000/, '$1background-color:#ea4335;$2color:#000000');
  const red = redNamesFromBoardHtml(html).filter((r) => r.red);
  assert.equal(red.length, 44);
  assert.ok(red.every((r) => r.how === 'background'));
});

test('league: Drafts tab is the source of truth, red cross-check agrees, typo is reported', () => {
  const L = buildLeague(raw, dex);
  assert.equal(L.unmatched.length, 0);
  assert.equal(L.board.filter((b) => b.taken).length, 44);
  assert.equal(L.board.find((b) => b.id === 'politoed').takenBy, 'Data');
  assert.deepEqual(L.warnings, ['Name differs between tabs: Drafts says "Politoad", board says "Politoed" (same Pokémon).']);
  const a = L.coaches.find((c) => c.name === 'Anthony');
  assert.deepEqual([a.pointsLeft, a.slotsLeft, a.spent], [29, 6, 71]);
  assert.deepEqual(a.picks.map((p) => p.id), ['charizard', 'sinistcha', 'pelipper', 'kangaskhan']);
});

test('league: red-but-undrafted and points mismatches become warnings, not silent fixes', () => {
  const drafts = raw.draftsCsv.replace(',Points Left,29,', ',Points Left,30,').replace('来悲粗茶,Sinistcha,18', ',,');
  const L = buildLeague({ ...raw, draftsCsv: drafts }, dex);
  assert.ok(L.warnings.some((w) => w.includes('Sinistcha is red on the board')));
  assert.ok(L.warnings.some((w) => w.startsWith('Anthony: sheet says 30 points left')));
  assert.equal(L.board.find((b) => b.id === 'sinistcha').taken, true); // red-only still counts as taken
});

test('league: board colours missing -> Drafts only, with a note', () => {
  const L = buildLeague({ ...raw, boardHtml: null }, dex);
  assert.equal(L.board.filter((b) => b.taken).length, 44);
  assert.ok(L.warnings.some((w) => w.startsWith('Board colours were not fetched')));
});

test('a non-sheet response (e.g. Google error page) throws instead of producing an empty board', () => {
  assert.throws(() => buildLeague({ ...raw, boardCsv: '<html>Sign in</html>' }, dex), /tier header/);
  assert.throws(() => buildLeague({ ...raw, draftsCsv: '<html></html>' }, dex), /coach header/);
});

test('turn: snake order puts Anthony (seat 5) on the clock at pick 45', () => {
  const L = buildLeague(raw, dex);
  const t = computeTurn(L.coaches, 'snake');
  assert.deepEqual([t.round, t.pickNo, t.coach, t.consistent], [5, 45, 'Anthony', true]);
  assert.equal(picksUntil(L.coaches, 'Anthony'), 0);
  assert.equal(picksUntil(L.coaches, 'Taro'), 1);
  assert.equal(picksUntil(L.coaches, 'Jacky'), 12); // seats 6..10, then round 6 runs 10..5, then seat 4
});

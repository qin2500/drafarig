// Dev-only real-browser check of the teambuilder's item combobox (the stub DOM in test/ has no live elements, focus or
// key events). Drives headless Chrome over CDP against a running dev server with a fresh profile: imports a team, opens a
// set, then types, filters, picks with the keyboard and the mouse. Exits 1 on any failed check.
//
//   node tools/check-item-combo.mjs [base URL, default http://127.0.0.1:4600/]
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.argv[2] ?? 'http://127.0.0.1:4600/';
const PORT = 9400 + Math.floor(Math.random() * 400);
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--disable-gpu', '--no-first-run',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'drafarig-combo-'))}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0;
const pending = new Map(), errors = [];
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
const key = async (k, code = k) => { await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: { ArrowDown: 40, ArrowUp: 38, Enter: 13, Escape: 27 }[k] }); await sleep(300); };
const state = () => ev(`JSON.stringify({ value: document.querySelector('#tb-item')?.value, open: !document.getElementById('tb-itemlist')?.hidden, shown: [...document.querySelectorAll('#tb-itemlist [role=option]')].filter((o) => !o.hidden).map((o) => o.textContent.trim()), noMatch: !document.querySelector('#tb-itemlist .tb-nomatch')?.hidden, unsaved: /unsaved/i.test(document.querySelector('main')?.innerText ?? '') })`).then(JSON.parse);
const open = async () => { await ev(`(() => { const i = document.querySelector('#tb-item'); i.focus(); i.click(); })()`); await sleep(300); };
const type = async (text) => { await send('Input.insertText', { text }); await sleep(400); };
let failed = 0;
const check = (name, ok, got) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `: ${JSON.stringify(got)}`}`); if (!ok) failed++; };
const TEAM = '=== [gen9championsvgc2026regmc] Combo check ===\n\nRotom-Fan @ Sitrus Berry\nAbility: Levitate\nLevel: 50\nEVs: 32 SpA / 32 Spe\nModest Nature\n- Thunderbolt\n- Air Slash\n- Protect\n';
try {
  let list; for (let i = 0; i < 40 && !list; i++) { try { list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); } catch { await sleep(250); } }
  ws = new WebSocket(list.find((x) => x.type === 'page').webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description); };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.navigate', { url: `${BASE}#prep/teams` }); await sleep(6000);
  await ev(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Import team')?.click()`); await sleep(800);
  await ev(`(() => { const t = document.querySelector('textarea'); t.value = ${JSON.stringify(TEAM)}; t.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await ev(`[...document.querySelectorAll('main button')].find((b) => b.textContent.trim() === 'Import')?.click()`); await sleep(3000);
  await ev(`[...document.querySelectorAll('main button')].find((b) => /^Rotom-Fan/.test(b.textContent.trim()))?.click()`); await sleep(8000);

  await open(); await type('life');
  let s = await state();
  check('focus selects the current value, so typing replaces it', s.value === 'life', s);
  check('typing filters by name', s.open && s.shown.length === 1 && s.shown[0] === 'Life Orb', s);
  await key('ArrowDown'); await key('Enter');
  s = await state();
  check('↓ Enter picks it into the draft', s.value === 'Life Orb' && !s.open && s.unsaved, s);
  // straight after a pick: the field still has focus and the pick's autosave redraws the screen in between (the race QA hit)
  await open(); await sleep(900); await type('sitrusberry');
  s = await state();
  check('spaces ignored in the query', s.shown.length === 1 && s.shown[0] === 'Sitrus Berry', s);
  await key('Escape');
  s = await state();
  check('Esc closes the list', !s.open, s);
  await open(); await type('zzz');
  s = await state();
  check('no match says so', s.shown.length === 0 && s.noMatch, s);
  await key('Escape');
  await open(); await type('leftov');
  await ev(`(() => { const o = [...document.querySelectorAll('#tb-itemlist [role=option]')].find((x) => !x.hidden); o.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); o.focus(); o.click(); })()`); await sleep(800);
  s = await state();
  check('a click picks it', s.value === 'Leftovers' && !s.open, s);
  check('no page errors', errors.length === 0, errors);
} catch (e) { console.log('ERR', e.stack); failed++; }
chrome.kill();
process.exit(failed ? 1 : 0);

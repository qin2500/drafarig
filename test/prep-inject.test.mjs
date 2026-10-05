// Injection hardening for prep data that comes from files (Restore, Import opponents) or another tab: a realistic device
// is built through the real flows, then every stored value the validator still accepts is replaced by markup, and every
// Prep screen is rendered. No injected element may appear. Markup / DOM checks only, no rendering.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootApp, memoryStorage, parseHtml, findAll } from './ui-harness.mjs';
import { isPortrait, isIcon } from './prep-helpers.mjs';
import { validate, typeOfKey, KEYS } from '../lib/prep-schema.mjs';
import { parseRoute } from '../lib/prep-route.mjs';

const PAYLOAD = '"\'><img src=x onerror=alert(1)><script>alert(2)</script>';
const settle = (ms) => new Promise((r) => setTimeout(r, ms));

/** A device with something in every part of prep, made by tapping through the app. */
async function richDevice() {
  const app = await bootApp({ mode: 'prep' });
  const btns = (pa) => findAll(parseHtml(app.html()), (n) => n.attrs['data-pa'] === pa).map((n) => Object.fromEntries(Object.entries(n.attrs).filter(([k]) => k.startsWith('data-')).map(([k, v]) => [k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase()), v])));
  const click = (pa, d = {}) => app.click({ pa, ...d });
  try {
    await click('confirm-me');
    await click('go-mysets-import');
    await app.input('paste-text', 'Charizard @ Charizardite Y\nAbility: Blaze\nEVs: 2 HP / 32 SpA / 32 Spe\nTimid Nature\n- Heat Wave\n- Protect\n\nKangaskhan @ Kangaskhanite\nAbility: Scrappy\nEVs: 2 HP / 32 Atk / 32 Spe\nJolly Nature\n- Fake Out\n- Double-Edge\n');
    await click('paste-check');
    await click('paste-import');
    await click('go-home');
    await click('open-coach', { coach: 'Ning' });
    await click('ws-next');
    await app.input('ws-premortem', 'premortem', {});
    await click('plan-new');
    await app.click(btns('plan-member')[0]);
    await click('back'); await app.settle(10);
    await click('card-new', { kind: 'plan' });
    await click('back'); await app.settle(10);
    await click('card-new', { kind: 'bo3-lost-g1' });
    await click('back'); await app.settle(10);
    await click('tab', { tab: 'sets' });
    await click('guess-all');
    await click('variant-new');
    await click('back'); await app.settle(10);
    for (const b of btns('toggle-six')) await app.click(b);
    await click('tab', { tab: 'calcs' });
    await click('calc-new');
    await app.waitFor(() => btns('calc-pick').length > 0 && !/Loading the calculator/.test(app.html()), 'engine', 20000);
    await app.click(btns('calc-pick').find((b) => b.which === 'a' && b.side === 'mine'));
    await app.click(btns('calc-pick').find((b) => b.which === 'd' && b.side === 'theirs'));
    await app.click(btns('calc-move')[0]);
    await click('calc-save');
    await click('tab', { tab: 'practice' });
    await click('go-brief');
    await click('br-start');
    const ls = btns('log-save')[0];
    await app.click({ pa: 'log-set', kind: 'mock', holder: ls.holder, index: '0', key: 'result', value: 'W' });
    await app.click({ pa: 'log-turn', kind: 'mock', holder: ls.holder, index: '0', delta: '1' });
    // every picker the log offers writes something the schema must accept
    for (const b of btns('log-pick')) await app.click(b);
    for (const key of ['myMega', 'theirMega', 'tag', 'mechanism', 'partnerFidelity', 'pasteCheckOk', 'previewGuess']) { const b = btns('log-set').find((x) => x.key === key && x.value); if (b) await app.click(b); }
    const plan = findAll(parseHtml(app.html()), (n) => n.tag === 'select' && n.attrs['data-pc'] === 'log-plan')[0];
    const planOpt = plan && findAll(plan, (n) => n.tag === 'option' && n.attrs.value)[0];
    if (planOpt) await app.changeData({ pc: 'log-plan', kind: 'mock', holder: ls.holder, index: '0' }, { value: planOpt.attrs.value });
    await app.click(ls);
    await click('finding-new', { mock: ls.holder });
    await click('rv-new', { finding: btns('rv-new')[0]?.finding ?? '' });
    await click('tab', { tab: 'plan' });
    await click('go-gameday');
    await click('match-start');
    await app.changeData({ pc: 'rv-species' }, { value: 'rillaboom' });
    await app.changeData({ pc: 'rv-value' }, { value: 'fakeout' });
    await click('rv-add');
    const ms = btns('log-save')[0];
    for (const b of btns('log-pick')) await app.click(b);
    for (const key of ['myMega', 'theirMega', 'result', 'tag']) { const b = btns('log-set').find((x) => x.key === key && x.value); if (b) await app.click(b); }
    await app.click(ms);
    await click('go-home');
    await click('go-pilot');
    await app.input('pilot-text', 'Rillaboom @ Miracle Seed\nAbility: Grassy Surge\nEVs: 32 HP / 32 Atk / 2 Spe\nAdamant Nature\n- Fake Out\n- Wood Hammer\n');
    await click('pilot-parse');
    await click('pilot-save');
    await settle(450); await app.settle(5);
    // nothing the screens wrote was refused by the schema: no save error, and every stored document validates
    assert.ok(!/isn't valid|Couldn't save/.test(app.html()), 'a save was refused');
    for (const [k, v] of app.storage.map) if (typeOfKey(k)) assert.deepEqual(validate(typeOfKey(k), JSON.parse(v)), [], k);
    const ws = JSON.parse([...app.storage.map].find(([k]) => typeOfKey(k) === 'ws')[1]);
    assert.ok(ws.mockSets[0].games[0].myMega || ws.mockSets[0].games[0].my4?.length, 'the log pickers were stored');
    return new Map(app.storage.map);
  } finally { app.restore(); }
}

/** Replace every leaf the validator still accepts with the payload (numbers too). Returns how many were accepted. */
function poison(key, raw) {
  const type = typeOfKey(key);
  const doc = JSON.parse(raw);
  let accepted = 0;
  const walk = (o) => {
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (v && typeof v === 'object') { walk(v); continue; }
      if (['schemaVersion', 'rev', 'id'].includes(k) || (typeof v !== 'string' && typeof v !== 'number')) continue;
      o[k] = PAYLOAD;
      if (validate(type, doc).length) o[k] = v; else accepted++;
    }
  };
  walk(doc);
  assert.deepEqual(validate(type, doc), [], key);
  return { text: JSON.stringify(doc), accepted, doc };
}

test('every stored text a file could carry is escaped on every Prep screen', async (t) => {
  const rich = await richDevice();
  const poisoned = new Map();
  let accepted = 0;
  for (const [k, v] of rich) {
    if (!typeOfKey(k)) { poisoned.set(k, v); continue; }
    const p = poison(k, v);
    poisoned.set(k, p.text);
    accepted += p.accepted;
  }
  assert.ok(accepted > 30, `payload accepted in ${accepted} free-text fields`);
  const ws = JSON.parse(poisoned.get([...poisoned.keys()].find((k) => typeOfKey(k) === 'ws')));
  const mine = JSON.parse(poisoned.get(KEYS.mysets));
  // the validator holds every id-like field: none of these carry the payload
  for (const s of [...ws.theirSets, ...mine.sets]) assert.ok(!JSON.stringify([s.speciesId, s.versions.map((v) => [v.data.item, v.data.ability, v.data.nature, v.data.moves])]).includes('<'), s.id);
  assert.ok(!JSON.stringify([ws.roster.speciesIds, ws.plans.map((p) => p.members), ws.reveals.map((r) => [r.speciesId, r.value]), ws.mockSets.map((m) => m.games.map((g) => [g.index, g.decidingTurn]))]).includes('<'));
  const storage = memoryStorage(Object.fromEntries(poisoned));
  const app = await bootApp({ mode: 'prep', storage });
  t.after(() => app.restore());
  const ids = (arr) => (arr ?? []).map((x) => x.id);
  const W = `#prep/w/${ws.id}`;
  const hashes = ['#prep', '#prep/rules', '#prep/backup', '#prep/pilot', '#prep/my-sets', '#prep/my-sets/import', ...ids(mine.sets).map((id) => `#prep/my-sets/${id}`),
    ...['plan', 'sets', 'calcs', 'practice'].map((tab) => `${W}/${tab}`), ...['eyes', 'gameday', 'import', 'export', 'threshold', 'speed', 'compare', 'brief', 'log', 'revisions'].map((k) => `${W}/${k}`),
    ...ids(ws.plans).map((id) => `${W}/theirplan/${id}`), ...ids(ws.cards).map((id) => `${W}/card/${id}`), ...ids(ws.theirSets).map((id) => `${W}/sets/${id}`), ...ids(mine.sets).map((id) => `${W}/sets/${id}`),
    ...ids(ws.calcs).map((id) => `${W}/calcs/${id}`), `${W}/calcs/new`, ...ids(ws.mockSets).map((id) => `${W}/mock/${id}`), ...ids(ws.matches).map((id) => `${W}/mock/${id}`),
    ...ids(ws.variants).map((id) => `${W}/variant/${id}`), ...ids(ws.findings).map((id) => `${W}/finding/${id}`)];
  assert.ok(hashes.length >= 35, String(hashes.length));
  let shown = 0;
  for (const h of hashes) {
    assert.ok(parseRoute(h), h);
    app.location.hash = h;
    await app.fire('popstate');
    await app.settle(5);
    const html = app.html();
    assert.ok(!/couldn't be shown/.test(html), `${h}: screen failed`);
    // the only images allowed are the app's verified sprite portraits (exact shape, id-only paths): nothing a file carries
    const bad = findAll(parseHtml(html), (n) => (n.tag === 'img' && !isPortrait(n)) || (['svg', 'use'].includes(n.tag) && !isIcon(n)) || ['script', 'iframe'].includes(n.tag) || Object.keys(n.attrs).some((a) => /^on/i.test(a)));
    assert.equal(bad.length, 0, `${h}: injected ${bad.map((n) => n.tag).join(',')}`);
    assert.ok(!findAll(parseHtml(app.banners.innerHTML), (n) => n.tag === 'img').length, `${h}: banners`);
    if (html.includes('&lt;img src=x')) shown++;
  }
  assert.ok(shown >= hashes.length / 2, `the payload reached ${shown} of ${hashes.length} screens (as text)`);
  // the text is still shown (escaped), e.g. the premortem
  app.location.hash = `${W}/plan`; await app.fire('popstate');
  assert.ok(app.html().includes('&lt;img src=x onerror=alert(1)&gt;'));
});

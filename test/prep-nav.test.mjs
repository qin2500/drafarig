// Navigation in Teams and the workbench (live v11 P0: "Back returns to set editing, stuck in a loop"): in-app ‹ goes to a
// fixed parent (slot → team → Teams → Prep) whatever the history holds; browser Back walks the real stack; old-route
// redirects replace their entry; the workbench's own history entry never leaks or bounces.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootApp } from './ui-harness.mjs';
import { device, WS, SET_MINE, flushSaves } from './prep-helpers.mjs';
import { KEYS } from '../lib/prep-schema.mjs';
import * as TM from '../lib/prep-teams.mjs';

const tN = TM.teamIdForWs(WS);
async function ready(mode, storage = device()) {
  const app = await bootApp({ mode, storage });
  await app.waitFor(() => storage.getItem(KEYS.teams) !== null, 'teams set up', 20000);
  await flushSaves(app);
  return app;
}
const back = async (app) => { await app.click({ pa: 'back' }); await app.settle(); };
const browserBack = async (app) => { app.history.back(); await app.settle(); };

test('(a) Teams → team → editor, in-app Back ×3 ends on Prep; a team opened from its own editor doesn\'t bounce', async (t) => {
  const app = await ready('prep/5');
  t.after(() => app.restore());
  await app.click({ pa: 'go-mysets' });
  await app.click({ pa: 'team-open', team: tN });
  await app.click({ pa: 'team-slot', team: tN, slot: '1' });
  assert.equal(app.location.hash, `#prep/teams/${tN}/1`);
  await back(app); assert.equal(app.location.hash, `#prep/teams/${tN}`);
  await back(app); assert.equal(app.location.hash, '#prep/teams');
  await back(app); assert.equal(app.location.hash, '#prep/5', 'Prep');
  // the loop: the editor's "+" opens the team ON TOP of the editor; ‹ from that team must go to Teams, not the editor
  await app.click({ pa: 'go-mysets' });
  await app.click({ pa: 'team-open', team: tN });
  await app.click({ pa: 'team-slot', team: tN, slot: '1' });
  await app.click({ pa: 'team-open', team: tN });
  await back(app); assert.equal(app.location.hash, '#prep/teams', 'the fixed parent, not the editor under it');
  await back(app); assert.equal(app.location.hash, '#prep/5');
});

test('(b) the same path with browser Back walks the stack: editor → team → Teams → Prep', async (t) => {
  const app = await ready('prep/5');
  t.after(() => app.restore());
  await app.click({ pa: 'go-mysets' });
  await app.click({ pa: 'team-open', team: tN });
  await app.click({ pa: 'team-slot', team: tN, slot: '1' });
  await browserBack(app); assert.equal(app.location.hash, `#prep/teams/${tN}`);
  await browserBack(app); assert.equal(app.location.hash, '#prep/teams');
  await browserBack(app); assert.equal(app.location.hash, '#prep/5');
});

test('(c) old links (#prep/my-sets, #prep/my-sets/<id>, #…/build/<n>) redirect by replacing their entry: Back leaves them', async (t) => {
  for (const [mode, to] of [['prep/my-sets', '#prep/teams'], [`prep/my-sets/${SET_MINE}`, `#prep/teams/${tN}/1`], ['prep/5v2/build/1', `#prep/w/${WS}/sets/${SET_MINE}`]]) {
    const app = await ready(mode);
    await app.waitFor(() => app.location.hash === to, `${mode} → ${to}`);
    assert.deepEqual(app.history.entries(), [to], `${mode}: the old address is gone from history`);
    app.restore();
  }
  // a link inside the app to the old My sets lands on Teams in one entry; Back returns to where it was
  const app = await ready('prep/5');
  t.after(() => app.restore());
  await app.click({ pa: 'go-mysets' });
  assert.deepEqual(app.history.entries(), ['#prep/5', '#prep/teams']);
  await browserBack(app); assert.equal(app.location.hash, '#prep/5');
});

async function editorWithWorkbench(t) {
  const app = await ready('prep/5');
  t.after(() => app.restore());
  await app.click({ pa: 'go-mysets' });
  await app.click({ pa: 'team-open', team: tN });
  await app.click({ pa: 'team-slot', team: tN, slot: '1' });
  await app.waitFor(() => /tb-srow/.test(app.html()) && !/Calculating…/.test(app.html()), 'the editor', 30000);
  await app.click({ pa: 'tb-focus', set: SET_MINE, i: '0' });
  const m = app.html().match(/data-pa="tb-wb" ([^>]*)>/);
  const d = Object.fromEntries([...m[1].matchAll(/data-([a-z]+)="([^"]*)"/g)].map((x) => [x[1], x[2]]));
  await app.click({ pa: 'tb-wb', ...d });
  assert.ok(/role="dialog"/.test(app.html()));
  return app;
}

test('(d) workbench × consumes its own entry: in-app Back → team, Back → Teams, browser Back → Prep (no bounce)', async (t) => {
  const app = await editorWithWorkbench(t);
  await app.click({ pa: 'wb-close' }); await app.settle();
  assert.ok(!/role="dialog"/.test(app.html()));
  assert.equal(app.location.hash, `#prep/teams/${tN}/1`);
  await back(app); assert.equal(app.location.hash, `#prep/teams/${tN}`);
  await back(app); assert.equal(app.location.hash, '#prep/teams');
  await browserBack(app); assert.equal(app.location.hash, '#prep/5');
  await browserBack(app); assert.equal(app.location.hash, '#prep/5', 'nothing left to bounce to');
});

test('(e) browser Back with the workbench open closes it and stays in the editor; the next Back goes to the team', async (t) => {
  const app = await editorWithWorkbench(t);
  await browserBack(app);
  assert.ok(!/role="dialog"/.test(app.html()), 'closed');
  assert.equal(app.location.hash, `#prep/teams/${tN}/1`, 'still the editor');
  await browserBack(app); assert.equal(app.location.hash, `#prep/teams/${tN}`);
});

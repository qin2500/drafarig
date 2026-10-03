// Cores to fear, as integrated into the Site: the reviewed modules are the exact reviewed bytes (b09fbab), the public
// runtime spec (data/cores.json) keeps everything the engine and panels read and none of the research-only fields, and
// the app boots with the Cores panels next to the mobile Best single picks. Uses only files that ship with the Site.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { CONTRACT, SUPPORTED_SPEC_REVISIONS, coreContext, coreCards } from '../lib/cores.mjs';
import { bootApp, RAW, parseHtml, find, findAll, hasClass, text } from './ui-harness.mjs';
import { buildLeague } from '../lib/league.mjs';

const ROOT = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT));
const sha = (p) => createHash('sha256').update(read(p)).digest('hex');
const dex = JSON.parse(read('data/dex.json'));
const SPEC = JSON.parse(read('data/cores.json'));

// SHA256 of the reviewed checkpoint b09fbab955a235b149066093548148929d1ab493 (SOURCE-MANIFEST.json of the staged source).
const REVIEWED = {
  'lib/cores.mjs': '55ba443c675a730bb53d6416988dc93fe90f984a7728e1aa1b5a3882edb1b182',
  'lib/cores-view.mjs': '768fe3d7eddc41bf16c79e445420a1ac3d70a7ec7307ca6040d2b94360a2b16b',
  'lib/rerender.mjs': '3f584d8abec4b7452c3bfc1599ef600cd6a8c58e0c3b582581663d38002b8d66',
  'public/glossary.js': '630bbd49f1dfcd25cdd813593f10fa13eee2b9c9dc4b77c5f667f71f049def07',
  'data/dex.json': 'f4578645e7b5481ae35d1bcf48b8ddb465bd2a4f4328e192d55596ac2c9c4a69',
};
// The public spec is an explicit runtime projection (MOBILE-INTEGRATION-HANDOFF.md §4): exactly these keys, nothing else.
const SHAPE = {
  top: ['version', 'revision', 'generated', 'format', 'dataModel', 'statusRule', 'cores', 'responseConcentration'],
  dataModel: ['moveTags', 'techMoves'], statusRule: ['names'], responseConcentration: ['coFailure'], coFailure: ['minMult', 'minStat'],
  core: ['id', 'name', 'oneLineWhy', 'detection', 'answers', 'prepSensitivity', 'prepReasoning', 'prepReasoningDisplaySafe'],
  detection: ['slots', 'minDistinct', 'maxMembers'], slot: ['name', 'min', 'anyOf'], setterBlockedBy: ['slot', 'anyOf'],
  answer: ['id', 'label', 'kind', 'test', 'note', 'failsTo', 'blockedBy', 'robust', 'conditional', 'counts', 'partial', 'setterBlockedBy'],
};
const DISPLAY_LINT = /VERIFIED|CREATOR CLAIM|ASSUMPTION|HYPOTHESIS|unread|\.ts\b|\.js\b|onStart/; // the reviewed display lint (D1)
// Internal report / file / review references and research markers: none anywhere in the public JSON.
const INTERNAL = /cores-deep|cores\.md|cores-check|\braw\/|docs\/|tools\/|\blib\/|\breview\b|review [a-z]?\d|re-review|\bR\d-\d|\.py\b|\.ts\b|\.mjs\b|\.json\b|\.md\b|VERIFIED|CREATOR CLAIM|ASSUMPTION|HYPOTHESIS|https?:|mutation|pikalytics-|Showdown data/i;

test('the reviewed Cores modules, glossary and dex ship byte for byte as reviewed', () => {
  for (const [f, h] of Object.entries(REVIEWED)) assert.equal(sha(f), h, f);
  assert.deepEqual(CONTRACT, { engine: 'cores/2', spec: 3, specRevisions: [2, 3, 4], statusRule: 'v3', schema: 'drafarig-cores-check/1' });
  assert.ok(dex && Object.values(dex.species).some((s) => Array.isArray(s.learnsetTech)), 'dex carries learnsetTech (tech-move evidence)');
});

test('public spec: accepted by the engine as is (version, revision, conditions, slots, answers, blockers)', () => {
  assert.deepEqual([SPEC.version, SPEC.revision, SPEC.generated], [3, 4, '2026-10-03']);
  assert.ok(SUPPORTED_SPEC_REVISIONS.includes(SPEC.revision));
  const cx = coreContext(dex, SPEC); // validateSpec throws on any condition-language violation
  assert.equal(cx.spec.cores.length, 13);
  assert.ok(Object.keys(SPEC.dataModel.moveTags).length && SPEC.dataModel.techMoves.length && SPEC.statusRule.names.has);
  assert.deepEqual(SPEC.responseConcentration.coFailure, { minMult: 2, minStat: 100 });
  assert.deepEqual(SPEC.statusRule.names, { has: 'Has answers', thin: 'Thin', none: 'No answer found' });
});

test('public spec: exactly the runtime projection (every read field present, nothing else) with zero internal references', () => {
  const only = (o, keys, where, required = keys) => {
    for (const k of Object.keys(o)) assert.ok(keys.includes(k), `${where}.${k} is not a runtime field`);
    for (const k of required) assert.ok(k in o, `${where}.${k} missing`);
  };
  only(SPEC, SHAPE.top, '$');
  only(SPEC.dataModel, SHAPE.dataModel, '$.dataModel');
  only(SPEC.statusRule, SHAPE.statusRule, '$.statusRule');
  only(SPEC.responseConcentration, SHAPE.responseConcentration, '$.responseConcentration');
  only(SPEC.responseConcentration.coFailure, SHAPE.coFailure, '$.responseConcentration.coFailure');
  for (const c of SPEC.cores) {
    only(c, SHAPE.core, c.id);
    only(c.detection, SHAPE.detection, `${c.id}.detection`);
    for (const s of c.detection.slots) { only(s, SHAPE.slot, `${c.id} slot`); assert.ok(s.min >= 1 && s.anyOf.length); }
    for (const a of c.answers) {
      only(a, SHAPE.answer, `${c.id}/${a.id}`, ['id', 'label', 'kind', 'test', 'note', 'robust', 'conditional', 'counts', 'partial']);
      if (a.setterBlockedBy) only(a.setterBlockedBy, SHAPE.setterBlockedBy, `${c.id}/${a.id}.setterBlockedBy`);
    }
  }
  // Conditions keep their evidence flags: the reviewed spec has 21 minEvidence flags across slots, tests and blockers.
  let flags = 0;
  const count = (v) => { if (Array.isArray(v)) v.forEach(count); else if (v && typeof v === 'object') { if ('minEvidence' in v) flags++; Object.values(v).forEach(count); } };
  for (const c of SPEC.cores) { count(c.detection); for (const a of c.answers) count([a.test, a.blockedBy, a.setterBlockedBy]); }
  assert.equal(flags, 21);
  const hits = [];
  const walk = (v, p) => {
    if (typeof v === 'string') { if (INTERNAL.test(v)) hits.push(`${p}: ${v}`); }
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${p}[${i}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (INTERNAL.test(k)) hits.push(`key ${p}.${k}`); walk(x, `${p}.${k}`); }
  };
  walk(SPEC, '$');
  assert.deepEqual(hits, []);
});

test('public spec: displayed copy passes the reviewed display lint; display-safe prep reasoning is all kept', () => {
  let prep = 0;
  for (const c of SPEC.cores) {
    for (const s of [c.name, c.oneLineWhy, ...c.answers.flatMap((a) => [a.label, a.note, a.failsTo])].filter(Boolean)) assert.ok(!DISPLAY_LINT.test(s), `${c.id}: ${s}`);
    for (const sc of ['A', 'B']) {
      if (c.prepReasoningDisplaySafe[sc] !== true) continue;
      prep++;
      assert.ok(c.prepReasoning[sc] && !DISPLAY_LINT.test(c.prepReasoning[sc]), `${c.id}.prepReasoning.${sc}`);
    }
  }
  assert.equal(prep, 26, 'all 13 x 2 prep reasonings are display-safe and shipped');
});

test('engine on the fixture league: every opponent pool is screened without errors', () => {
  const L = buildLeague(RAW, dex, {});
  const cx = coreContext(dex, SPEC);
  const me = L.coaches.find((c) => c.name === 'Anthony');
  const available = L.board.filter((b) => !b.taken && b.id).map((b) => ({ id: b.id, cost: b.points }));
  const cards = coreCards(cx, { me, opponents: L.coaches.filter((c) => c !== me), available, deep: 'main' });
  assert.ok(cards.length > 0);
  assert.ok(cards.every((c) => c.status.A.label && c.status.B.label));
});

test('app: League shows Cores to fear with its source and date labels, My team shows both Cores panels, Draft keeps the mobile picks', async (t) => {
  const app = await bootApp({ mode: 'league' });
  t.after(() => app.restore());
  let doc = parseHtml(app.html());
  const cores = find(doc, (n) => n.tag === 'section' && hasClass(n, 'cores'));
  assert.ok(cores, 'Cores to fear panel');
  assert.ok(!text(cores).includes("Core data isn't available"), 'not the error panel');
  const sources = text(find(cores, (n) => hasClass(n, 'sources')));
  assert.ok(sources.includes(`Core rules: cores.json v3 revision 4 (2026-10-03), engine ${CONTRACT.engine}.`), sources);
  assert.ok(sources.includes('league sheet read 2026-10-03 12:00 UTC'), sources);
  assert.ok(text(find(cores, (n) => hasClass(n, 'assumes'))).includes('Not known for this league'), 'uncertainty label');
  assert.ok(find(cores, (n) => n.attrs.id === 'coreScope'));
  assert.ok(find(doc, (n) => n.attrs.id === 'threatScope'), 'Threats still renders');

  await app.change('coreScope', { value: 'Ning' });
  doc = parseHtml(app.html());
  assert.equal(find(doc, (n) => n.attrs.id === 'threatScope' && true).children.find((o) => 'selected' in (o.attrs ?? {}))?.attrs.value, 'Ning', 'one scope for Cores and Threats');

  await app.click({ mode: 'team' });
  doc = parseHtml(app.html());
  assert.ok(find(doc, (n) => n.attrs.id === 'thin-h'), 'Cores with thin or no answers');
  assert.ok(find(doc, (n) => n.attrs.id === 'carries'), 'Who carries your answers');

  await app.click({ mode: 'draft' });
  await app.click({ dtab: 'singles' });
  const picks = find(parseHtml(app.html()), (n) => n.tag === 'table' && hasClass(n, 'picks'));
  assert.equal(findAll(picks, (n) => hasClass(n, 'pick-row')).length, 12);
});

test('app: a missing or refused spec shows the Cores error panel and the rest of League still works', async (t) => {
  for (const files of [{ '/data/cores.json': '{"version": 2}' }, { '/data/cores.json': 'not json' }]) {
    const app = await bootApp({ mode: 'league', files });
    t.after(() => app.restore());
    const doc = parseHtml(app.html());
    assert.ok(text(find(doc, (n) => n.tag === 'section' && hasClass(n, 'cores'))).includes("Core data isn't available right now."));
    assert.ok(find(doc, (n) => n.attrs.id === 'threatScope'));
    app.restore();
  }
});

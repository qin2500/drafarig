// The chat context allowlist (lib/chat-context.mjs), shared by the app (it builds and shows it) and the Worker (it refuses
// anything else): only these keys, ids and bounded strings; notes only as a separate, opted-in field; a size cap.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkContext, withoutChips, contextBytes, CHAT_LIMITS, newConvId, newClientId, newMessageId, CONV_RE, CLIENT_RE, MSG_RE } from '../lib/chat-context.mjs';
import { CONTEXT } from './chat-helpers.mjs';

test('the allowlist: a full page context passes; any unknown key, at any level, fails', () => {
  assert.deepEqual(checkContext(CONTEXT), []);
  assert.deepEqual(checkContext({ v: 1, page: { area: 'prep', view: 'overview' } }), [], 'the minimum: which screen');
  for (const bad of [
    { ...CONTEXT, wsId: 'ws_aaaaaaaaaaaa' }, { ...CONTEXT, pov: { ...CONTEXT.pov, email: 'x@y' } }, { ...CONTEXT, opponent: { ...CONTEXT.opponent, prep: 'notes' } },
    { ...CONTEXT, plan: { ...CONTEXT.plan, notes: 'x' } }, { ...CONTEXT, rosters: { ...CONTEXT.rosters, partner: ['x'] } }, { ...CONTEXT, page: { area: 'prep', view: 'plan', url: '/x' } },
    { ...CONTEXT, rules: { matchLength: 'bo3', secretRule: 'x' } }, { ...CONTEXT, rules: { matchLength: 'unknown' } },
  ]) assert.notDeepEqual(checkContext(bad), [], JSON.stringify(bad).slice(0, 80));
});

test('values: ids only where ids belong; bounded names; notes non-empty and capped; the whole thing capped in bytes', () => {
  for (const bad of [
    { ...CONTEXT, six: ['<img src=x>'] }, { ...CONTEXT, six: Array(11).fill('charizard') }, { ...CONTEXT, pov: { coach: 'x'.repeat(41), seat: 5, you: true } },
    { ...CONTEXT, pov: { coach: 'A', seat: 0, you: true } }, { ...CONTEXT, plan: { ...CONTEXT.plan, speed: 'fast' } }, { ...CONTEXT, plan: { ...CONTEXT.plan, lead: ['a', 'b', 'c'] } },
    { ...CONTEXT, notes: '   ' }, { ...CONTEXT, notes: 'n'.repeat(CHAT_LIMITS.notes + 1) }, { ...CONTEXT, pov: { coach: 'A\u0000B', seat: 5, you: true } }, { v: 2, page: CONTEXT.page }, 'string', null,
  ]) assert.notDeepEqual(checkContext(bad), [], JSON.stringify(bad)?.slice(0, 80));
  assert.deepEqual(checkContext({ ...CONTEXT, notes: 'my plan: Tailwind turn 1' }), []);
  const big = { ...CONTEXT, calc: { attacker: 'charizard', defender: 'staraptor', move: 'heatwave', result: 'r'.repeat(160) }, notes: 'n'.repeat(1000), pov: { coach: 'é'.repeat(40), seat: 5, you: true } };
  assert.ok(contextBytes(big) < CHAT_LIMITS.contextBytes, 'everything at its own cap still fits the byte cap');
});

test('removing chips never removes the page (it says which screen the question is about); ids have fixed shapes', () => {
  assert.deepEqual(Object.keys(withoutChips(CONTEXT, ['page', 'v', 'rosters', 'plan'])).sort(), ['opponent', 'page', 'pov', 'six', 'v']);
  for (let i = 0; i < 20; i++) {
    assert.match(newConvId(), CONV_RE); assert.match(newClientId(), CLIENT_RE); assert.match(newMessageId(Date.now()), MSG_RE);
  }
  assert.ok(newMessageId(1e12) < newMessageId(2e12), 'message ids sort by time');
});

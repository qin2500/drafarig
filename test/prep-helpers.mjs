// Shared fixtures for the Prep UI tests: a device that already has prep, and small readers for the rendered markup.
// Synthetic sets and ids only.
import assert from 'node:assert/strict';
import { memoryStorage, parseHtml, findAll, text } from './ui-harness.mjs';
import { createStore } from '../lib/prep-store.mjs';
import { KEYS, wsKey, emptyMeta, emptyRules, emptyMySets, newWorkspace } from '../lib/prep-schema.mjs';
import { newLineage } from '../lib/prep-model.mjs';

export const NOW = '2026-10-04T10:00:00.000Z';
export const WS = 'ws_aaaaaaaaaaaa', SET_MINE = 'set_mmmmmmmmmmmm', SET_THEIRS = 'set_tttttttttttt';
export const T = (app) => text(parseHtml(app.html())).replace(/\s+/g, ' ');
/** data-* of every button with this action: [{pa, set, …}] (camel-cased keys). */
export const btns = (app, pa) => findAll(parseHtml(app.html()), (n) => n.attrs['data-pa'] === pa).map((n) => Object.fromEntries(Object.entries(n.attrs).filter(([k]) => k.startsWith('data-')).map(([k, v]) => [k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase()), v])));
/** Wait past the autosave delay. */
export const flushSaves = (app) => new Promise((r) => setTimeout(r, 450)).then(() => app.settle(5));

/**
 * A device that already has prep: Anthony (or `me`) confirmed, a workspace vs Ning, one set of mine (in the 6) and one of theirs.
 * The workspace is `me`'s prep (a perspective's workspace, as Battle Prep saves it); legacy: true makes it one saved before
 * perspectives (no owner: read-only until reviewed).
 */
export function device({ coach = 'Ning', me = 'Anthony', ws = {}, mine = {}, theirs = {}, quota, extra = {}, mySets = [], legacy = false } = {}) {
  const storage = memoryStorage({}, { quota });
  const st = createStore(storage);
  const meta = { ...emptyMeta(NOW), myCoach: me, myCoachConfirmed: true, workspaces: [{ id: WS, coach, ...(legacy ? {} : { pov: me }), updatedAt: NOW, archived: false }] };
  const my = newLineage({ id: SET_MINE, side: 'mine', speciesId: 'charizard', name: 'Sun Zard', now: NOW,
    data: { item: 'charizarditey', ability: 'blaze', nature: 'timid', moves: ['heatwave', 'solarbeam', 'weatherball', 'protect'], sp: { hp: 2, atk: 0, def: 0, spa: 32, spd: 0, spe: 32 }, ...mine } });
  const th = newLineage({ id: SET_THEIRS, side: 'theirs', coach, speciesId: 'rillaboom', name: 'Pasted', now: NOW,
    data: { item: 'miracleseed', ability: 'grassysurge', nature: 'adamant', moves: ['fakeout', 'grassyglide', 'woodhammer', 'uturn'], sp: 'unknown', ...theirs },
    provenance: { item: { source: 'seen-vs-others', asOf: '2026-10-01' }, ability: { source: 'seen-vs-others', asOf: '2026-10-01' }, nature: null, moves: [null, null, null, null], sp: null } });
  const w = { ...newWorkspace({ id: WS, coach, roster: { fetchedAt: NOW, speciesIds: ['rillaboom', 'gholdengo', 'milotic', 'lucario', 'ninetalesalola'], points: {} }, now: NOW, pov: legacy ? null : me }),
    theirSets: [th], variants: [{ id: 'var_aaaaaaaaaaaa', role: 'likely', name: '', setIds: { rillaboom: SET_THEIRS }, whyBuilt: '', planId: null, updatedAt: NOW }], my6: [{ setId: SET_MINE }], ...ws };
  for (const [k, d] of Object.entries({ [KEYS.meta]: meta, [KEYS.rules]: emptyRules(NOW), [KEYS.mysets]: { ...emptyMySets(), sets: [my, ...mySets] }, [wsKey(WS)]: w, ...extra })) {
    const r = st.save(k, d, null);
    assert.ok(r.ok, `${k}: ${JSON.stringify(r)}`);
  }
  return storage;
}
/**
 * A Battle Prep portrait as public/app.js writes it (the only images Prep screens may hold): class "spr" inside a .pt
 * wrapper, a static Showdown sprite path made of id characters (gen5 or home-centered, .png; never animated ani/),
 * the same for its data-fb fallback, alt="" (the name is written beside it), explicit size, no referrer, no on* handler.
 */
export const SPRITE_SRC = /^https:\/\/play\.pokemonshowdown\.com\/sprites\/(gen5|home-centered)\/[a-z0-9-]+\.png$/;
export function isPortrait(n) {
  const a = n.attrs ?? {};
  return n.tag === 'img' && (a.class ?? '').split(/\s+/).includes('spr') && SPRITE_SRC.test(a.src ?? '') && (a['data-fb'] === undefined || SPRITE_SRC.test(a['data-fb']))
    && a.alt === '' && /^\d+$/.test(a.width ?? '') && a.width === a.height && a.referrerpolicy === 'no-referrer' && !Object.keys(a).some((k) => /^on/i.test(k))
    && (n.parent?.attrs?.class ?? '').split(/\s+/).includes('pt');
}
/** A Battle Prep mode icon: <svg class="ic" aria-hidden="true" focusable="false"> holding one <use href="#i-…"> of index.html. */
export function isIcon(n) {
  if (n.tag === 'use') return /^#i-[a-z]+$/.test(n.attrs.href ?? '') && Object.keys(n.attrs).length === 1 && n.parent?.tag === 'svg' && isIcon(n.parent);
  const a = n.attrs ?? {};
  return n.tag === 'svg' && a.class === 'ic' && a['aria-hidden'] === 'true' && a.focusable === 'false' && Object.keys(a).length === 3
    && n.children.length === 1 && n.children[0].tag === 'use' && /^#i-[a-z]+$/.test(n.children[0].attrs.href ?? '') && Object.keys(n.children[0].attrs).length === 1;
}
/** A synthetic set of theirs (labelled as a ladder guess unless said otherwise). */
export const theirSet = (id, speciesId, data, source = 'ladder') => newLineage({ id, side: 'theirs', coach: 'Ning', speciesId, name: 'Guess', now: NOW, data: { item: '', ability: '', nature: '', moves: [], sp: 'unknown', ...data },
  provenance: { item: data.item ? { source, asOf: '2026-10-01' } : null, ability: data.ability ? { source, asOf: '2026-10-01' } : null, nature: null, moves: (data.moves ?? []).map(() => ({ source, asOf: '2026-10-01' })), sp: null } });

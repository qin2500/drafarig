// Their likely plans (from the public Cores spec run on their roster) and "could bring against you" (counter-prep tools
// their roster can learn in Reg M-C, checked against the simulator-derived learnsets). Pure. Suggestions are guesses and
// say so; nothing here claims what an opponent will do.
import { detect } from './cores.mjs';
import { canLearn, legalAbilities, toID } from './calc/mech.mjs';

const SPEED_MODE = { 'trick-room': 'trick-room', tailwind: 'tailwind' };
const FIELD = { sun: 'sun', rain: 'rain', sand: 'sand', 'snow-veil': 'snow', 'psychic-terrain': 'psychic-terrain', 'electric-terrain': 'electric-terrain', 'grassy-terrain': 'grassy-terrain' };

/**
 * Plan suggestions for a roster: every Cores-spec core the roster can field, split per Mega path when the roster has more
 * than one Mega option for it. Each: {coreId, label, members, megaUser, speedMode, field, tells (members it can't run
 * without), confidence ('likely' from usage evidence, 'possible' from learnsets)}.
 */
export function suggestPlans(cx, dex, rosterIds) {
  const out = [];
  if (!cx) return out;
  for (const core of cx.spec.cores) {
    const seen = new Set();
    for (const megaLimit of [0, 1]) {
      const a = detect(cx, core, rosterIds, { megaLimit });
      if (!a) continue;
      const mega = a.members.find((m) => m.mega);
      const key = mega ? mega.id + mega.form : 'none';
      if (seen.has(key)) continue;
      seen.add(key);
      const firstSlot = core.detection.slots[0].name;
      out.push({
        coreId: core.id, label: core.name, members: a.members.map((m) => m.id), megaUser: mega ? mega.id : null, megaForm: mega ? mega.form : null,
        speedMode: SPEED_MODE[core.id] ?? 'unknown', field: FIELD[core.id] ?? '',
        tells: a.members.filter((m) => m.slots.includes(firstSlot)).map((m) => m.id), confidence: a.confidence,
      });
    }
  }
  // likely first, then fewer Megas, then spec order
  return out.sort((x, y) => (x.confidence === y.confidence ? 0 : x.confidence === 'likely' ? -1 : 1));
}

/** Move names referenced by an answer test (recursive over allOf/anyOf). */
function testMoves(t, out = new Set()) {
  if (!t) return out;
  if (Array.isArray(t)) { for (const x of t) testMoves(x, out); return out; }
  if (t.kind === 'move') for (const v of [].concat(t.value)) out.add(toID(v));
  for (const k of ['allOf', 'anyOf']) if (t[k]) testMoves(t[k], out);
  return out;
}
function testAbilities(t, out = new Set()) {
  if (!t) return out;
  if (Array.isArray(t)) { for (const x of t) testAbilities(x, out); return out; }
  if (t.kind === 'ability') for (const v of [].concat(t.value)) out.add(toID(v));
  for (const k of ['allOf', 'anyOf']) if (t[k]) testAbilities(t[k], out);
  return out;
}

/**
 * Through their eyes: for each of YOUR fieldable cores, which of their mons could bring a listed answer, verified against
 * the Reg M-C learnsets / legal abilities in the mechanics projection. Each tool says how common it is, only as far as
 * that is known: ladder 'yes' (on the ladder or a key move), 'no' (ladder data says it isn't used: a tech), 'only' (its only
 * ability) or 'unknown' (no ladder data). keyMoves(id) -> move names (the app's dex). onLadder stays for older callers.
 * Entries the spec marks counts:false (e.g. "Tailwind doesn't help" vs Trick Room) are the spec's non-answers and are
 * left out, as the Cores tab does; that says nothing about whether the move matters elsewhere in the game.
 * Returns [{coreId, label, answers:[{label, mons:[{id, via:[{kind, id, ladder, onLadder}]}]}]}]. Always "could, not will".
 */
export function couldBringAgainst(cx, mech, myRosterIds, theirRosterIds, usage = null, { keyMoves = () => [] } = {}) {
  if (!cx) return [];
  const out = [];
  for (const core of cx.spec.cores) {
    if (!detect(cx, core, myRosterIds)) continue;
    const answers = [];
    for (const ans of core.answers ?? []) {
      if (ans.counts === false) continue;
      const moves = [...testMoves(ans.test)].filter((m) => mech.moves[m]);
      const abilities = [...testAbilities(ans.test)].filter((a) => mech.abilities[a]);
      if (!moves.length && !abilities.length) continue;
      const mons = [];
      for (const id of theirRosterIds) {
        if (!mech.species[id]) continue;
        const via = [];
        const u = usage?.species?.[id];
        const used = new Set((u?.moves ?? []).map(([n]) => toID(n)));
        const usedAb = new Set((u?.abilities ?? []).map(([n]) => toID(n)));
        const key = new Set(keyMoves(id).map(toID));
        const legal = legalAbilities(mech, id);
        for (const m of moves) {
          if (!canLearn(mech, id, m)) continue;
          const ladder = used.has(m) || key.has(m) ? 'yes' : u ? 'no' : 'unknown';
          via.push({ kind: 'move', id: m, ladder, onLadder: ladder === 'yes' });
        }
        for (const a of abilities) {
          if (!legal.includes(a)) continue;
          const ladder = legal.length === 1 ? 'only' : usedAb.has(a) ? 'yes' : u ? 'no' : 'unknown';
          via.push({ kind: 'ability', id: a, ladder, onLadder: ladder === 'yes' || ladder === 'only' });
        }
        // an allOf answer needs every listed move on one mon
        const needAll = ans.test?.allOf && ans.test.allOf.every((x) => x.kind === 'move');
        if (needAll && via.filter((v) => v.kind === 'move').length < moves.length) continue;
        if (via.length) mons.push({ id, via });
      }
      if (mons.length) answers.push({ id: ans.id, label: ans.label, mons });
    }
    if (answers.length) out.push({ coreId: core.id, label: core.name, answers });
  }
  return out;
}

/** The plan whose preview tells are all in their preview six, best match first: [{planId, matched, of, missingTells}]. */
export function closestPlans(plans, previewIds) {
  const six = new Set(previewIds);
  return plans.map((p) => {
    const tells = p.falsifiers?.atPreview?.length ? p.falsifiers.atPreview : p.members;
    const missing = tells.filter((t) => !six.has(t));
    return { planId: p.id, matched: p.members.filter((m) => six.has(m)).length, of: p.members.length, missingTells: missing, alive: missing.length === 0 };
  }).sort((a, b) => Number(b.alive) - Number(a.alive) || b.matched - a.matched);
}

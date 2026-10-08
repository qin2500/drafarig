// Battle Prep matchups (pure; no DOM, storage or network). Three jobs:
//  1. Perspective: whose side the briefing is drawn from (resolvePov). It comes only from explicit navigation, a confirmed
//     identity or the Draft coach setting when that exact name is on the sheet; it is never guessed.
//  2. Ownership: which saved workspace belongs to (perspective, opponent). A workspace's `pov` is fixed when it is created;
//     a workspace saved before perspectives existed has none and stays unassigned until the user reviews that one
//     workspace and says whose it is (legacyEvidence gives the facts for that review).
//  3. The briefing (buildBriefing): a deterministic projection of the app's existing engines (Cores spec, Reg M-C
//     learnsets, the Champions Speed maths, ladder key moves) into look-first threats, their plans, Speed bands, your
//     useful mons, what they could prep against your cores (guarded), lead ideas to test and quick checks. Every item
//     carries its evidence layer: known (sheet + game data), possible (learnable), prior (ladder, not this league), saved.
//     No scores, percentages, damage numbers or outcome claims are produced here; type pressure is not damage and Speed
//     ranges are not turn order guarantees. Domain contract: VGC-DESIGN (Battle Prep briefing) §3–§9.
import { detect, answersFor, answerStatus, blockersFor, coreCards, maxNextPick } from './cores.mjs';
import { suggestPlans } from './prep-plans.mjs';
import { effectiveness } from './analysis.mjs';
import { speedRange, compareSpeed, outspeedSP } from './calc/stats.mjs';
import { canLearn, legalAbilities, toID } from './calc/mech.mjs';

export const BRIEFING_VERSION = 'drafarig-briefing/1';

// ---------- 1. perspective ----------
/**
 * The perspective for Battle Prep. coaches: the loaded sheet's coaches ([{name, order}]) or null while it loads.
 * urlSeat: the seat in the address (explicit navigation). meta: the prep meta document. hint: {name, source:'setting'|
 * 'default'} from the Draft coach setting (the stored value, or the shipped default when nothing is stored).
 * Returns {name, seat, source:'url'|'identity'|'setting'|'default'} or {name:null, reason}.
 */
export function resolvePov({ urlSeat = null, coaches = null, meta = null, hint = null } = {}) {
  if (!coaches) return { name: null, reason: 'no-sheet' };
  const bySeat = (s) => coaches.find((c) => c.order === s);
  const byName = (n) => coaches.find((c) => c.name === n);
  if (urlSeat !== null && urlSeat !== undefined) {
    const c = bySeat(urlSeat);
    return c ? { name: c.name, seat: c.order, source: 'url' } : { name: null, reason: 'unknown-seat' };
  }
  if (meta?.myCoachConfirmed && meta.myCoach) {
    const c = byName(meta.myCoach);
    if (c) return { name: c.name, seat: c.order, source: 'identity' };
    return { name: null, reason: 'identity-not-on-sheet', identity: meta.myCoach };
  }
  if (hint?.name) {
    const c = byName(hint.name);
    if (c) return { name: c.name, seat: c.order, source: hint.source === 'setting' ? 'setting' : 'default' };
  }
  return { name: null, reason: 'no-default' };
}
/** The confirmed identity, or null (a name the user said "this is me" to on this device). */
export const identityOf = (meta) => (meta?.myCoachConfirmed && meta.myCoach ? meta.myCoach : null);

// ---------- 2. ownership ----------
/** Whose prep a workspace is: its pov, or null for a workspace saved before perspectives existed (unassigned). */
export const ownerOf = (ws) => (typeof ws?.pov === 'string' && ws.pov && ws.pov !== ws.coach ? ws.pov : null); // a self-matchup (from a file) is nobody's
const newestFirst = (a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '') || String(a.id).localeCompare(String(b.id));
/** Workspaces of `pov` against `opp`, newest first (two after a "keep both" restore). Unassigned ones are never included. */
export const workspacesFor = (list, pov, opp) => [...list].filter((w) => ownerOf(w) === pov && w.coach === opp).sort(newestFirst);
/** Unassigned (saved before perspectives) workspaces against `opp`, newest first. */
export const unassignedVs = (list, opp) => [...list].filter((w) => !ownerOf(w) && w.coach === opp).sort(newestFirst);

/**
 * Facts for reviewing one unassigned workspace before saying whose it is. mysets: the My sets document; rosterOf(name) ->
 * species ids on the sheet now; whoHas(speciesId) -> the coach whose roster has it now (or null). Counts, every one of
 * "your" Pokémon it uses (its 6, plan cards, calcs, mocks, matches) with which are on `pov`'s roster now and whose roster
 * the others are on, and how its saved snapshot of the opponent compares with their roster now.
 */
export function legacyEvidence(ws, { pov, rosterOf, mysets, whoHas = () => null }) {
  const sets = mysets?.sets ?? [];
  const speciesOf = (setId) => sets.find((s) => s.id === setId)?.speciesId ?? null;
  const six = (ws.my6 ?? []).map((m) => speciesOf(m.setId)).filter(Boolean);
  const refs = [
    ...(ws.my6 ?? []).map((m) => m.setId),
    ...(ws.cards ?? []).flatMap((c) => [...(c.bring4 ?? []), ...(c.lead ?? []), ...(c.back ?? []), c.mega].filter(Boolean)),
    ...(ws.mockSets ?? []).flatMap((m) => (m.mySets ?? []).map((x) => x.setId)),
    ...(ws.matches ?? []).flatMap((m) => (m.my6 ?? []).map((x) => x.setId)),
  ];
  const fromCalcs = (ws.calcs ?? []).flatMap((c) => ['attacker', 'defender'].filter((side) => c.refs?.[side]?.side === 'mine').map((side) => speciesOf(c.refs[side].setId) ?? c.scenario?.[side]?.set?.species ?? null));
  const yours = [...new Set([...refs.map(speciesOf), ...fromCalcs].filter(Boolean))];
  const povRoster = new Set(pov ? rosterOf(pov) : []);
  const oppNow = new Set(rosterOf(ws.coach));
  const snap = ws.roster?.speciesIds ?? [];
  return {
    opp: ws.coach, createdAt: ws.createdAt ?? null, updatedAt: ws.updatedAt ?? null, matchDate: ws.matchDate || null,
    counts: { theirSets: (ws.theirSets ?? []).length, calcs: (ws.calcs ?? []).length, plans: (ws.plans ?? []).length, cards: (ws.cards ?? []).length,
      mockGames: (ws.mockSets ?? []).reduce((t, m) => t + (m.games ?? []).filter((g) => !g.draft).length, 0), matches: (ws.matches ?? []).length },
    six, yours, yoursOnPov: yours.filter((sp) => povRoster.has(sp)),
    yoursElsewhere: yours.filter((sp) => !povRoster.has(sp)).map((sp) => ({ id: sp, coach: whoHas(sp) })),
    snapshotMatches: snap.filter((sp) => oppNow.has(sp)).length, snapshotSize: snap.length, oppNowSize: oppNow.size,
    povIsOpp: pov === ws.coach,
  };
}

// ---------- 3. the briefing ----------
// Stance Change: dex.json and mechanics.json carry the Shield forme only; offense uses Blade (pinned PS Dex: Atk 140, SpA 140).
const OFFENSE_OVERRIDE = { aegislash: { atk: 140, spa: 140, note: 'stance-change-blade' } };
const WEATHER_SPEED = { sandrush: 'Sand', swiftswim: 'Rain', chlorophyll: 'Sun', slushrush: 'Snow' };
const WEATHER_SETTER_ABILITY = { sandstream: 'Sand', drizzle: 'Rain', drought: 'Sun', snowwarning: 'Snow' };
const WEATHER_MOVE = { sandstorm: 'Sand', raindance: 'Rain', sunnyday: 'Sun', snowscape: 'Snow' };
export const PRIORITY_MOVES = Object.freeze(['fakeout', 'extremespeed', 'feint', 'firstimpression', 'upperhand', 'suckerpunch', 'aquajet', 'bulletpunch', 'machpunch', 'iceshard', 'shadowsneak', 'quickattack', 'jetpunch', 'vacuumwave', 'accelerock', 'watershuriken']);
// Tools shown on a portrait (support moves and abilities that shape a doubles game), with their evidence layer.
export const TOOL_MOVES = Object.freeze({ fakeout: 'fake-out', followme: 'redirection', ragepowder: 'redirection', wideguard: 'wide-guard', tailwind: 'tailwind', trickroom: 'trick-room', icywind: 'speed-drop', electroweb: 'speed-drop', taunt: 'taunt' });
export const TOOL_ABILITIES = Object.freeze({ intimidate: 'intimidate', prankster: 'prankster' });
// Blunters an attacker's ability gets past (pinned PS: these abilities carry flags.breakable, so Mold Breaker ignores them).
const BREAKABLE_BLUNT = new Set(['Magic Bounce', 'Good as Gold', 'Oblivious', 'Aroma Veil', 'Inner Focus', 'Armor Tail', 'Queenly Majesty', 'Dazzling']);
const ATE = { aerilate: 'Flying', pixilate: 'Fairy', refrigerate: 'Ice', dragonize: 'Dragon' };
export const MAX_LOOK_FIRST = 3, MAX_PROMISING = 4, MAX_LEADS = 3, MAX_SPEED_FACTS = 3;

/**
 * The type rules the briefing and the Plan board share (one definition, so they can never disagree). Known layer only:
 * typing, base stats and forced abilities (analysis.effectiveness), no damage.
 * - attacking form: max(Atk, SpA) >= the Cores co-failure attacker line (100); Aegislash counts as Blade (140/140)
 * - hitsHard(m, t): an attacking form of m has one of its own types >= 2x on t's non-Mega form; the non-Mega form is tried
 *   first ({form, mega, mult, types} or null)
 * - walls(m, t): t has an attacking form, and m's non-Mega form takes <= 0.5x from every type of every attacking form of t
 * - exposedTo(m, t): some attacking form of t has a type >= 2x on m's non-Mega form
 */
export function typeRules(dex, cx = null) {
  const sp = (id) => dex.species[id];
  const baseForm = (id) => sp(id).forms.find((f) => !f.mega) ?? sp(id).forms[0];
  const offense = (id, f) => (f.mega ? f.baseStats : { ...f.baseStats, ...(OFFENSE_OVERRIDE[id] ?? {}) });
  const ATTACK_MIN = cx?.cofail?.minStat ?? 100;
  const isAttacking = (id, f) => Math.max(offense(id, f).atk, offense(id, f).spa) >= ATTACK_MIN;
  const stabHits = (af, defForm) => af.types.filter((t) => effectiveness(dex, t, defForm) >= 2);
  const resistsAllStab = (af, defForm) => af.types.every((t) => effectiveness(dex, t, defForm) <= 0.5);
  const attackingForms = (id) => sp(id).forms.filter((f) => isAttacking(id, f));
  function hitsHard(m, t) {
    const def = baseForm(t);
    const forms = attackingForms(m).sort((x, y) => Number(!!x.mega) - Number(!!y.mega));
    for (const f of forms) {
      const types = stabHits(f, def);
      if (types.length) return { form: f.name, mega: !!f.mega, types, mult: Math.max(...types.map((ty) => effectiveness(dex, ty, def))) };
    }
    return null;
  }
  const walls = (m, t) => { const af = attackingForms(t); return af.length > 0 && af.every((f) => resistsAllStab(f, baseForm(m))); };
  const exposedTo = (m, t) => attackingForms(t).some((f) => stabHits(f, baseForm(m)).length > 0);
  return { sp, baseForm, offense, ATTACK_MIN, isAttacking, stabHits, resistsAllStab, attackingForms, hitsHard, walls, exposedTo };
}

/**
 * Build one matchup briefing. input:
 *   { cx (Cores context or null), dex, mech (Reg M-C projection or null while it loads), usage (Smogon table or null),
 *     mine: {name, ids, slotsLeft, pointsLeft, order}, theirs: {name, ids, slotsLeft, pointsLeft, order},
 *     available: [{id, cost}], saved: {mine: {speciesId: {sp, sign, mega}}, theirs: {…}} | null }
 * Deterministic: the same input gives a deep-equal result.
 */
export function buildBriefing(input) {
  const { cx = null, dex, mech = null, usage = null, available = [], saved = null } = input;
  const myIds = [...new Set(input.mine.ids)].filter((id) => dex.species[id]);
  const theirIds = [...new Set(input.theirs.ids)].filter((id) => dex.species[id]);
  const { sp, baseForm, offense, isAttacking, stabHits, resistsAllStab } = typeRules(dex, cx);
  const ladder = (id) => {
    const out = new Set((sp(id)?.keyMoves ?? []).map(toID));
    for (const [n] of usage?.species?.[id]?.moves ?? []) out.add(toID(n));
    return out;
  };
  const ladderCache = new Map();
  const ladderOf = (id) => ladderCache.get(id) ?? ladderCache.set(id, ladder(id)).get(id);
  /** prior = legal and on the ladder for it; possible = learnable only; null = can't (or the data hasn't loaded). */
  const moveLayer = (id, m) => (!mech || !canLearn(mech, id, m) ? null : ladderOf(id).has(m) ? 'prior' : 'possible');
  /** known = its only legal ability; possible = one of several; null = not legal (or the data hasn't loaded). */
  const abilityLayer = (id, a) => { if (!mech) return null; const legal = legalAbilities(mech, id); return !legal.includes(a) ? null : legal.length === 1 ? 'known' : 'possible'; };
  const megaAbilityKnown = (f, a) => !!f.mega && (f.abilities?.length ?? 0) === 1 && toID(f.abilities[0]) === a;

  function toolTags(id) {
    const tags = [];
    for (const [m, code] of Object.entries(TOOL_MOVES)) { const l = moveLayer(id, m); if (l) tags.push({ code, via: m, kind: 'move', layer: l }); }
    for (const [a, code] of Object.entries(TOOL_ABILITIES)) {
      const l = abilityLayer(id, a);
      if (l) tags.push({ code, via: a, kind: 'ability', layer: l });
      for (const f of sp(id).forms) if (megaAbilityKnown(f, a)) tags.push({ code, via: a, kind: 'ability', layer: 'known-if-mega', form: f.name });
    }
    for (const [a, w] of Object.entries(WEATHER_SETTER_ABILITY)) {
      const l = abilityLayer(id, a);
      if (l) tags.push({ code: `weather-${w.toLowerCase()}`, via: a, kind: 'ability', layer: l });
      for (const f of sp(id).forms) if (megaAbilityKnown(f, a)) tags.push({ code: `weather-${w.toLowerCase()}`, via: a, kind: 'ability', layer: 'known-if-mega', form: f.name });
    }
    return tags;
  }
  /** Type pressure of T on a pool: its attacking form with the most victims (base forms of the pool); ties: fewer walls. */
  function pressure(tId, poolIds) {
    let best = null;
    for (const f of sp(tId).forms) {
      if (!isAttacking(tId, f)) continue;
      const victims = [], walls = [], megaEscape = [];
      for (const m of poolIds) {
        const bf = baseForm(m);
        const hit = stabHits(f, bf);
        if (hit.length) {
          victims.push({ id: m, types: hit, mult: Math.max(...hit.map((t) => effectiveness(dex, t, bf))) });
          const esc = sp(m).forms.find((mf) => mf.mega && !stabHits(f, mf).length);
          if (esc) megaEscape.push({ id: m, form: esc.name });
        }
        if (resistsAllStab(f, bf)) walls.push(m);
      }
      const cand = { form: f.name, mega: !!f.mega, types: f.types, victims, walls, megaEscape, offenseNote: OFFENSE_OVERRIDE[tId] && !f.mega ? OFFENSE_OVERRIDE[tId].note : null };
      if (!best || victims.length > best.victims.length || (victims.length === best.victims.length && walls.length < best.walls.length)) best = cand;
    }
    return best;
  }
  /** Speed rows for one species under a scenario side condition: base form and every Mega form; exact when a saved set says so. */
  function bandsFor(id, side, tailwind, savedSide) {
    return sp(id).forms.map((f) => {
      const s = savedSide?.[id];
      const known = s && Number.isInteger(s.sp) && !!s.mega === !!f.mega ? { sp: s.sp, sign: s.sign ?? '' } : null;
      const r = speedRange(f.baseStats.spe, { tailwind }, known);
      return { key: `${side}:${f.id ?? f.name}`, side, id, formId: f.id ?? toID(f.name), form: f.name, mega: !!f.mega, base: f.baseStats.spe, min: r.min, neutralMax: r.neutralMax, max: r.max, exact: r.exact, layer: known ? 'saved' : 'known', tailwind: !!tailwind };
    });
  }
  function weatherSetters(poolIds) {
    const out = {};
    for (const id of poolIds) {
      for (const [a, w] of Object.entries(WEATHER_SETTER_ABILITY)) {
        const l = abilityLayer(id, a) ?? (sp(id).forms.some((f) => megaAbilityKnown(f, a)) ? 'known-if-mega' : null);
        if (l) (out[w] ??= []).push({ id, via: a, kind: 'ability', layer: l });
      }
      for (const [m, w] of Object.entries(WEATHER_MOVE)) { const l = moveLayer(id, m); if (l) (out[w] ??= []).push({ id, via: m, kind: 'move', layer: l }); }
    }
    return out;
  }
  function speedControl(poolIds) {
    const out = { tailwind: [], trickroom: [], icywind: [], electroweb: [] };
    for (const id of poolIds) for (const m of Object.keys(out)) { const l = moveLayer(id, m); if (l) out[m].push({ id, layer: l }); }
    return out;
  }
  function priorityLane(poolIds) {
    const out = [];
    for (const id of poolIds) {
      const moves = PRIORITY_MOVES.map((m) => ({ move: m, layer: moveLayer(id, m) })).filter((x) => x.layer).map((x) => ({ ...x, priority: mech?.moves[x.move]?.priority ?? null }));
      const abilities = ['prankster', 'galewings'].map((a) => ({ ability: a, layer: abilityLayer(id, a) })).filter((x) => x.layer);
      if (moves.length || abilities.length) out.push({ id, moves, abilities });
    }
    return out;
  }
  function speedPair(a, b, trickRoom) {
    const res = compareSpeed(a.exact ? a.max : a, b.exact ? b.max : b, { trickRoom });
    const out = { a: a.key, b: b.key, aId: a.id, bId: b.id, aForm: a.form, bForm: b.form, aBand: [a.min, a.neutralMax, a.max], bBand: [b.min, b.neutralMax, b.max], result: res, trickRoom };
    // their item is unknown: a legal Choice Scarf (not on a Mega, which holds its stone) can change a "whatever the spreads" result
    if (res !== 'depends' && b.side === 'theirs' && !b.mega && !b.exact) {
      const scarf = speedRange(b.base, { tailwind: b.tailwind, scarf: true });
      if (compareSpeed(a.exact ? a.max : a, { min: b.min, max: scarf.max }, { trickRoom }) !== res) out.scarfCaveat = scarf.max;
    }
    if (res === 'depends' && a.side === 'mine' && !a.exact) {
      const cond = a.tailwind ? { tailwind: true } : {};
      out.mineNeeds = trickRoom ? outspeedSP(a.base, '-', b.min, cond, { trickRoom: true }) : outspeedSP(a.base, '+', b.max, cond);
    }
    return out;
  }
  // Blunters on YOUR side against their answers, checked against the mechanics that make them fail (never hides the item).
  function guardBlunt(b, attackerId, myCoreAssignment) {
    const legal = mech ? legalAbilities(mech, attackerId) : [];
    const allGrass = sp(attackerId).forms.every((f) => f.types.includes('Grass'));
    const unless = [];
    const vias = String(b.via ?? '').split(/ \/ | \+ /);
    if (vias.includes('Rage Powder') && !vias.includes('Follow Me')) {
      if (allGrass) return { void: true, reason: 'attacker-grass-powder-immune' };
      if (legal.includes('overcoat')) unless.push({ ability: 'overcoat' });
    }
    if (b.viaKind === 'move' && (vias.includes('Rage Powder') || vias.includes('Follow Me')) && legal.includes('stalwart')) unless.push({ ability: 'stalwart' });
    if (b.viaKind === 'ability' && BREAKABLE_BLUNT.has(b.via) && legal.includes('moldbreaker')) unless.push({ ability: 'moldbreaker' });
    if (b.viaKind === 'type' && String(b.via).includes('Ghost') && legal.includes('scrappy')) unless.push({ ability: 'scrappy' });
    if (b.via === 'Psychic Surge') {
      const setters = (myCoreAssignment?.members ?? []).filter((m) => m.slots.includes('setter'));
      const airborne = setters.filter((m) => sp(m.id).forms.find((f) => f.name === m.form)?.types.includes('Flying'));
      if (setters.length && airborne.length === setters.length) return { void: true, reason: 'setter-airborne' };
      unless.push({ condition: 'terrain-up-and-target-grounded' });
    }
    if (vias.some((v) => v === 'Taunt' || v === 'Encore')) unless.push({ item: 'mentalherb' });
    return { void: false, unless };
  }
  /** Per core of yours: their listed answers (roles reversed), split visible / could prep / reassurance (spec non-answers). */
  function counterPrepOnMyCores() {
    if (!cx) return [];
    const out = [];
    for (const core of cx.spec.cores) {
      const mine = detect(cx, core, myIds);
      if (!mine) continue;
      const blockers = blockersFor(cx, core, myIds);
      const theirs = answersFor(cx, core, theirIds, myIds, { blockers });
      const status = answerStatus(cx, core, theirs, 'A'); // counts:false never counts
      const visible = [], couldPrep = [], reassure = [];
      for (const e of theirs) {
        const bluntedBy = [], notBlunted = [];
        for (const c of e.contestedByAll ?? []) {
          const b = { id: c.id, via: c.via, viaKind: c.viaKind, setter: c.setter };
          const g = guardBlunt(b, e.mon, mine);
          (g.void ? notBlunted : bluntedBy).push({ ...b, ...g });
        }
        const layer = e.class === 'structural' ? (e.abilityChoice ? 'possible' : 'known') : e.class === 'standard-move' ? 'prior' : 'possible';
        const entry = { answer: e.answer, label: e.label, kind: e.kind, mon: e.mon, form: e.form, via: e.via, moves: e.moves, ability: e.ability, class: e.class, layer, partial: e.partial,
          megaDependent: e.megaDependent, visibility: { closed: e.visibility.A, open: e.visibility.B }, bluntedBy, notBlunted };
        // the spec's non-answers for this core (counts:false) are reassurances with their condition, never their counter-prep
        if (!e.counts) { reassure.push(entry); continue; }
        (e.class === 'structural' ? visible : couldPrep).push(entry);
      }
      out.push({ coreId: core.id, label: core.name, members: mine.members.map((m) => ({ id: m.id, form: m.form, mega: m.mega, slots: m.slots })), confidence: mine.confidence,
        theirStatus: status.key, visible, couldPrep, reassure });
    }
    return out.sort((x, y) => (x.confidence === y.confidence ? 0 : x.confidence === 'likely' ? -1 : 1) || STATUS_ORDER[x.theirStatus] - STATUS_ORDER[y.theirStatus] || x.couldPrep.length - y.couldPrep.length);
  }
  /** The move for a prefilled calc: legal, calc-supported, the attacker form's own type (forced -ate converts Normal);
   *  ladder moves first, then learnable; within a layer BP × effectiveness × the stat it uses (× 0.75 spread). */
  function chooseMove(attId, attForm, defId) {
    if (!mech) return null;
    const off = offense(attId, attForm), df = baseForm(defId);
    const forcedAte = (attForm.abilities?.length ?? 0) === 1 ? ATE[toID(attForm.abilities[0])] : null;
    const cands = [];
    for (const [mid, mv] of Object.entries(mech.moves)) {
      if (!mv.basePower || mv.calc !== 'ok' || mv.category === 'Status') continue;
      const type = forcedAte && mv.type === 'Normal' ? forcedAte : mv.type;
      if (!attForm.types.includes(type)) continue;
      if (!canLearn(mech, attId, mid)) continue;
      const eff = effectiveness(dex, type, df);
      const stat = mv.category === 'Physical' ? off.atk : off.spa;
      const spread = /allAdjacent/.test(mv.target ?? '');
      cands.push({ move: mid, type, viaAbility: type !== mv.type ? toID(attForm.abilities[0]) : null, layer: ladderOf(attId).has(mid) ? 'prior' : 'possible', score: mv.basePower * eff * stat * (spread ? 0.75 : 1), eff, spread });
    }
    cands.sort((a, b) => (a.layer === b.layer ? b.score - a.score || a.move.localeCompare(b.move) : a.layer === 'prior' ? -1 : 1));
    return cands[0] ?? null;
  }

  // --- their plans and your listed answers (published Cores engine) ---
  const theirCoach = { name: input.theirs.name, order: input.theirs.order ?? 0, picks: theirIds.map((id) => ({ id })), pointsLeft: input.theirs.pointsLeft ?? 0, slotsLeft: input.theirs.slotsLeft ?? 0 };
  const cards = cx ? coreCards(cx, { me: myIds, opponents: [theirCoach], available, deep: 'main' }) : [];
  const theirPlans = (cx ? suggestPlans(cx, dex, theirIds) : []).map((pl) => {
    const card = cards.find((c) => c.coreId === pl.coreId);
    const st = card?.status?.A, stB = card?.status?.B;
    const core = cx.coreById.get(pl.coreId);
    return { coreId: pl.coreId, label: pl.label, members: pl.members, megaUser: pl.megaUser, megaForm: pl.megaForm, tells: pl.tells, confidence: pl.confidence, speedMode: pl.speedMode, field: pl.field,
      oneLineWhy: core?.oneLineWhy ?? '', myStatus: st?.key ?? null, myStatusB: stB?.key ?? null,
      myCounted: (st?.counted ?? []).map((c) => ({ mon: c.mon, answer: c.answer, label: c.label, anchor: c.anchor, class: c.class, via: c.via, contestedBy: c.contestedBy?.id ?? null })),
      cofailTypes: (card?.cofailure?.A?.types ?? []).map((t) => ({ type: t.type, victims: t.victims, from: t.from, to: t.to, sources: t.sources })) };
  }).sort((x, y) => (x.confidence === y.confidence ? 0 : x.confidence === 'likely' ? -1 : 1) || STATUS_ORDER[x.myStatus ?? 'has'] - STATUS_ORDER[y.myStatus ?? 'has']);

  // --- look-first threats (reasons the user can check; the order is a transparent heuristic, never shown as a number) ---
  const n = myIds.length;
  const myBands0 = myIds.flatMap((id) => bandsFor(id, 'mine', false, saved?.mine));
  // your fastest form, Megas included: "faster at any investment" must hold even if you Mega Evolve (no Speed items assumed)
  const myMaxOf = (id) => Math.max(...myBands0.filter((r) => r.id === id).map((r) => r.max));
  const theirBands0 = theirIds.flatMap((id) => bandsFor(id, 'theirs', false, saved?.theirs));
  const threats = theirIds.map((t) => {
    const pr = pressure(t, myIds);
    const tb = theirBands0.filter((r) => r.id === t);
    const tBase = tb.find((r) => !r.mega) ?? tb[0];
    const tMegaMax = Math.max(...tb.map((r) => r.max));
    const sureOutspeeds = myIds.filter((m) => myMaxOf(m) < tBase.min);
    const plansIn = theirPlans.filter((p) => p.members.includes(t));
    const setterOf = plansIn.filter((p) => p.tells.includes(t));
    const reasons = [];
    let pts = 0;
    if (pr) {
      if (pr.victims.length >= 3) { reasons.push({ code: 'stab-se-many', layer: 'known', n: pr.victims.length, form: pr.form, types: pr.types, ids: pr.victims.map((v) => v.id), victims: pr.victims }); pts += 2; }
      else if (pr.victims.length === 2) { reasons.push({ code: 'stab-se-some', layer: 'known', n: 2, form: pr.form, types: pr.types, ids: pr.victims.map((v) => v.id), victims: pr.victims }); pts += 1; }
      if (n && pr.walls.length <= 1) { reasons.push({ code: pr.walls.length ? 'one-wall' : 'no-wall', layer: 'known', ids: pr.walls, form: pr.form, types: pr.types }); pts += pr.walls.length ? 1 : 2; }
    }
    if (n && sureOutspeeds.length * 2 >= n) { reasons.push({ code: 'faster-whatever-spreads', layer: 'known', n: sureOutspeeds.length, of: n, ids: sureOutspeeds }); pts += 1; }
    for (const p of setterOf) { reasons.push({ code: 'plan-tell', layer: p.confidence === 'likely' ? 'prior' : 'possible', coreId: p.coreId, label: p.label, confidence: p.confidence }); pts += p.confidence === 'likely' ? 2 : 1; }
    for (const p of plansIn.filter((x) => x.myStatus === 'none' || x.myStatus === 'thin')) { reasons.push({ code: p.myStatus === 'none' ? 'plan-unanswered' : 'plan-thin', layer: 'known', coreId: p.coreId, label: p.label }); pts += p.myStatus === 'none' ? 2 : 1; }
    const megas = sp(t).forms.filter((f) => f.mega);
    if (megas.length) { reasons.push({ code: 'mega-option', layer: 'known', forms: megas.map((f) => f.name) }); pts += 1; }
    return { id: t, attention: pts, reasons, pressure: pr, speed: { band: [tBase.min, tBase.neutralMax, tBase.max], megaMax: megas.length ? tMegaMax : null, sureOutspeeds }, tools: toolTags(t) };
  }).sort((a, b) => b.attention - a.attention || (b.pressure?.victims.length ?? 0) - (a.pressure?.victims.length ?? 0) || theirIds.indexOf(a.id) - theirIds.indexOf(b.id));
  threats.forEach((t, i) => { t.ring = i < MAX_LOOK_FIRST && t.attention >= 2 ? 'look-first' : t.attention >= 3 ? 'watch' : null; t.rank = t.ring === 'look-first' ? i + 1 : null; });
  const key = threats.filter((t) => t.ring === 'look-first').map((t) => t.id);

  // --- your mons: why each looks useful here and what it costs (never a pick) ---
  const myMons = myIds.map((m) => {
    const bf = baseForm(m), pros = [], cons = [];
    const walls = key.filter((t) => sp(t).forms.filter((f) => isAttacking(t, f)).length && sp(t).forms.filter((f) => isAttacking(t, f)).every((f) => resistsAllStab(f, bf)));
    if (walls.length) pros.push({ code: 'resists-key-stab', layer: 'known', ids: walls, form: bf.name });
    const hits = key.map((t) => {
      const f = sp(m).forms.filter((x) => isAttacking(m, x) && stabHits(x, baseForm(t)).length).sort((x, y) => Number(!!x.mega) - Number(!!y.mega))[0];
      return f ? { id: t, form: f.name, megaOnly: !!f.mega, types: stabHits(f, baseForm(t)) } : null;
    }).filter(Boolean);
    if (hits.length) pros.push({ code: 'hits-key-se', layer: 'known', hits, ids: hits.map((h) => h.id) });
    const answers = theirPlans.filter((p) => p.myCounted.some((c) => c.mon === m)).map((p) => { const c = p.myCounted.find((x) => x.mon === m); return { coreId: p.coreId, label: p.label, answer: c.answer, answerLabel: c.label, anchor: c.anchor, via: c.via }; });
    if (answers.length) pros.push({ code: 'answers-their-plan', layer: 'known', plans: answers });
    const theirAtk = theirIds.filter((t) => pressure(t, [m])?.victims.length);
    if (theirAtk.length) cons.push({ code: 'weak-to-their-stab', layer: 'known', ids: theirAtk });
    const cof = theirPlans.flatMap((p) => p.cofailTypes.filter((c) => c.victims.includes(m)).map((c) => ({ coreId: p.coreId, label: p.label, type: c.type })));
    if (cof.length) cons.push({ code: 'cofailure-victim', layer: 'known', items: cof });
    const contested = theirPlans.flatMap((p) => p.myCounted.filter((c) => c.mon === m && c.contestedBy).map((c) => ({ coreId: p.coreId, label: p.label, answer: c.answer, by: c.contestedBy })));
    if (contested.length) cons.push({ code: 'answer-contested', layer: 'known', items: contested });
    const outsped = theirIds.filter((t) => threats.find((x) => x.id === t).speed.band[0] > myMaxOf(m));
    if (theirIds.length && outsped.length * 2 >= theirIds.length) cons.push({ code: 'slower-than-most', layer: 'known', ids: outsped, n: outsped.length, of: theirIds.length });
    return { id: m, pros, cons, net: pros.length - cons.length };
  }).sort((a, b) => b.net - a.net || b.pros.length - a.pros.length || myIds.indexOf(a.id) - myIds.indexOf(b.id));
  const promising = myMons.filter((x) => x.pros.length).slice(0, MAX_PROMISING);

  // --- Speed: scenarios this matchup can produce, rows, weather-speed conditions, priority lane, deciding pairs ---
  const ctrlMine = speedControl(myIds), ctrlTheirs = speedControl(theirIds);
  const wMine = weatherSetters(myIds), wTheirs = weatherSetters(theirIds);
  const scenarios = [
    { key: 'none', enabled: true },
    { key: 'tw-mine', enabled: ctrlMine.tailwind.length > 0, setters: ctrlMine.tailwind },
    { key: 'tw-theirs', enabled: ctrlTheirs.tailwind.length > 0, setters: ctrlTheirs.tailwind },
    { key: 'tr', enabled: ctrlMine.trickroom.length + ctrlTheirs.trickroom.length > 0, settersMine: ctrlMine.trickroom, settersTheirs: ctrlTheirs.trickroom },
  ];
  const weatherSpeed = [];
  for (const [side, ids] of [['mine', myIds], ['theirs', theirIds]]) for (const id of ids) for (const [a, w] of Object.entries(WEATHER_SPEED)) {
    if (!mech || !legalAbilities(mech, id).includes(a)) continue;
    const own = side === 'mine' ? wMine : wTheirs, other = side === 'mine' ? wTheirs : wMine;
    // on its own side a setter counts by ability or move; from the other side only by ability (no one sets weather for you)
    const setBy = [...(own[w] ?? []).map((x) => ({ ...x, side })), ...(other[w] ?? []).filter((x) => x.kind === 'ability').map((x) => ({ ...x, side: side === 'mine' ? 'theirs' : 'mine', crossSide: true }))];
    if (setBy.length) weatherSpeed.push({ side, id, ability: a, weather: w, abilityLayer: abilityLayer(id, a), setBy });
  }
  const speedRows = (scenarioKey) => {
    const twMine = scenarioKey === 'tw-mine', twTheirs = scenarioKey === 'tw-theirs';
    const rows = [...myIds.flatMap((id) => bandsFor(id, 'mine', twMine, saved?.mine)), ...theirIds.flatMap((id) => bandsFor(id, 'theirs', twTheirs, saved?.theirs))];
    for (const r of rows) {
      r.extensions = r.mega ? [] : weatherSpeed.filter((w) => w.id === r.id && w.side === r.side).map((w) => {
        const x = speedRange(r.base, { tailwind: r.tailwind, ability: w.ability, weather: w.weather });
        return { kind: 'weather-ability', ability: w.ability, weather: w.weather, min: x.min, max: x.max, layer: w.abilityLayer };
      });
    }
    const tr = scenarioKey === 'tr';
    return rows.sort((a, b) => (tr ? a.min - b.min || a.max - b.max : b.max - a.max || b.min - a.min) || (a.side === b.side ? 0 : a.side === 'mine' ? -1 : 1) || a.key.localeCompare(b.key));
  };
  const top4 = myMons.slice(0, MAX_PROMISING).map((x) => x.id);
  const pairs = [];
  for (const s of scenarios.filter((x) => x.enabled)) {
    const tr = s.key === 'tr';
    for (const t of key) for (const m of top4) {
      const a = bandsFor(m, 'mine', s.key === 'tw-mine', saved?.mine).find((r) => !r.mega);
      for (const b of bandsFor(t, 'theirs', s.key === 'tw-theirs', saved?.theirs)) pairs.push({ scenario: s.key, ...speedPair(a, b, tr) });
    }
  }
  const byPair = new Map();
  for (const p of pairs) { const k = `${p.a}|${p.b}`; if (!byPair.has(k)) byPair.set(k, []); byPair.get(k).push(p); }
  const deciding = [...byPair.values()].filter((list) => new Set(list.map((p) => p.result)).size > 1 || list.some((p) => p.result === 'depends'));
  const factScore = (list) => {
    const none = list.find((p) => p.scenario === 'none');
    const mineFlip = list.some((p) => (p.scenario === 'tw-mine' || p.scenario === 'tr') && none && p.result !== none.result && p.result !== 'depends');
    const fixable = none?.result === 'depends' && none.mineNeeds && !none.mineNeeds.impossible;
    return [mineFlip ? 1 : 0, fixable ? 1 : 0, -key.indexOf(list[0].bId)];
  };
  const cmpDesc = (x, y) => { for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return y[i] - x[i]; return 0; };
  // one fact per mon of yours, at most two per threat (its Megas count as the same threat)
  const ranked = deciding.map((list) => ({ list, s: factScore(list) })).sort((x, y) => cmpDesc(x.s, y.s) || x.list[0].a.localeCompare(y.list[0].a) || x.list[0].b.localeCompare(y.list[0].b));
  const speedFacts = [], usedMine = new Set(), perThreat = new Map();
  for (const { list } of ranked) {
    if (speedFacts.length >= MAX_SPEED_FACTS) break;
    const mineId = list[0].aId, theirId = list[0].bId;
    if (usedMine.has(mineId) || (perThreat.get(theirId) ?? 0) >= 2) continue;
    usedMine.add(mineId); perThreat.set(theirId, (perThreat.get(theirId) ?? 0) + 1);
    speedFacts.push(list);
  }

  // --- what they could prep against your cores, and lead ideas to test ---
  const myCores = counterPrepOnMyCores();
  const attackTypes = new Map();
  for (const t of theirIds) for (const f of sp(t).forms) if (isAttacking(t, f)) for (const ty of f.types) { if (!attackTypes.has(ty)) attackTypes.set(ty, new Set()); attackTypes.get(ty).add(t); }
  const leadCands = new Set();
  for (let i = 0; i < top4.length; i++) for (let j = i + 1; j < top4.length; j++) leadCands.add([top4[i], top4[j]].sort().join('+'));
  for (const c of myCores) { const ms = [...new Set(c.members.map((m) => m.id))]; for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) leadCands.add([ms[i], ms[j]].sort().join('+')); }
  const leadIdeas = [...leadCands].map((k) => {
    const [a, b] = k.split('+'), fa = baseForm(a), fb = baseForm(b), pros = [], cons = [];
    const covers = key.filter((t) => [a, b].some((m) => isAttacking(m, baseForm(m)) && stabHits(baseForm(m), baseForm(t)).length));
    if (covers.length) pros.push({ code: 'pair-covers-key', layer: 'known', ids: covers });
    const cover = [];
    for (const [ty, src] of attackTypes) {
      if (effectiveness(dex, ty, fa) >= 2 && effectiveness(dex, ty, fb) <= 0.5) cover.push({ type: ty, protects: a, by: b, sources: [...src] });
      if (effectiveness(dex, ty, fb) >= 2 && effectiveness(dex, ty, fa) <= 0.5) cover.push({ type: ty, protects: b, by: a, sources: [...src] });
    }
    if (cover.length) pros.push({ code: 'pair-covers-each-other', layer: 'known', items: cover });
    const core = myCores.find((c) => [a, b].every((m) => c.members.some((x) => x.id === m)));
    if (core) pros.push({ code: 'pair-in-core', layer: core.confidence === 'likely' ? 'prior' : 'possible', coreId: core.coreId, label: core.label });
    const shared = [...attackTypes].filter(([ty]) => effectiveness(dex, ty, fa) >= 2 && effectiveness(dex, ty, fb) >= 2).map(([ty, src]) => ({ type: ty, sources: [...src] }));
    if (shared.length) cons.push({ code: 'pair-shared-weakness', layer: 'known', items: shared });
    return { pair: [a, b], pros, cons, net: pros.length - cons.length };
  }).filter((p) => p.pros.length).sort((x, y) => y.net - x.net || y.pros.length - x.pros.length || x.pair.join().localeCompare(y.pair.join())).slice(0, MAX_LEADS);

  // --- quick checks (prefill only; nothing is saved until the user saves) ---
  const myTop2 = myMons.slice(0, 2).map((x) => x.id);
  for (const t of threats.filter((x) => x.ring === 'look-first')) {
    const out = [];
    const tf = sp(t.id).forms.find((f) => f.name === t.pressure?.form) ?? baseForm(t.id);
    if (isAttacking(t.id, tf)) for (const m of myTop2) {
      const mv = chooseMove(t.id, tf, m);
      if (mv) out.push({ kind: 'calc', dir: 'survive', attacker: { side: 'theirs', species: t.id, form: tf.name, ifMega: !!tf.mega }, defender: { side: 'mine', species: m }, move: mv.move, moveType: mv.type, viaAbility: mv.viaAbility, moveLayer: mv.layer, spread: mv.spread });
    }
    for (const m of myTop2) {
      const mf = sp(m).forms.filter((f) => isAttacking(m, f)).sort((x, y) => Number(!!x.mega) - Number(!!y.mega))[0];
      if (!mf) continue;
      const mv = chooseMove(m, mf, t.id);
      if (mv && mv.eff >= 2) out.push({ kind: 'calc', dir: 'ko', attacker: { side: 'mine', species: m, form: mf.name, ifMega: !!mf.mega }, defender: { side: 'theirs', species: t.id }, move: mv.move, moveType: mv.type, viaAbility: mv.viaAbility, moveLayer: mv.layer, spread: mv.spread });
    }
    if (myTop2.length) for (const mf of sp(t.id).forms.filter((f) => f.mega && f.name !== tf.name && isAttacking(t.id, f))) {
      const mv = chooseMove(t.id, mf, myTop2[0]);
      if (mv) out.push({ kind: 'calc', dir: 'survive', attacker: { side: 'theirs', species: t.id, form: mf.name, ifMega: true }, defender: { side: 'mine', species: myTop2[0] }, move: mv.move, moveType: mv.type, viaAbility: mv.viaAbility, moveLayer: mv.layer, spread: mv.spread });
    }
    if (myTop2.length) out.push({ kind: 'speed', select: [t.id, ...myTop2] });
    t.checks = out.slice(0, 7);
  }

  const unknowns = [];
  if (!mech) unknowns.push('mech-loading');
  if (!cx) unknowns.push('cores-unavailable');
  if (!usage) unknowns.push('usage-offline');
  if ((input.theirs.slotsLeft ?? 0) > 0) unknowns.push('their-roster-open');
  if ((input.mine.slotsLeft ?? 0) > 0) unknowns.push('my-roster-open');
  return {
    version: BRIEFING_VERSION, pov: input.mine.name, opp: input.theirs.name, poolMine: myIds, poolTheirs: theirIds,
    rosterState: { theirSlotsLeft: input.theirs.slotsLeft ?? 0, mySlotsLeft: input.mine.slotsLeft ?? 0,
      theirMaxNextPick: (input.theirs.slotsLeft ?? 0) > 0 ? maxNextPick({ pointsLeft: input.theirs.pointsLeft ?? 0, slotsLeft: input.theirs.slotsLeft }, available) : null },
    layers: { mech: mech ? 'ready' : 'loading', cores: cx ? 'ready' : 'unavailable', usage: usage ? 'ready' : 'offline' },
    theirPlans, threats, key, myMons, promising, myCores, leadIdeas,
    speed: { scenarios, weatherSpeed, rows: speedRows, priority: { mine: priorityLane(myIds), theirs: priorityLane(theirIds) }, deciding, facts: speedFacts,
      // the Plan board's inputs (read-only, additive): Speed tools and weather setters per side, with their layers
      control: { mine: ctrlMine, theirs: ctrlTheirs }, weatherSetters: { mine: wMine, theirs: wTheirs } },
    unknowns,
  };
}
const STATUS_ORDER = { none: 0, thin: 1, has: 2 };

/** Row keys worth showing by default on the Speed track: look-first threats, members of their shown plans, your useful mons and your 6. */
export function relevantSpeedIds(b, { shortlist = [] } = {}) {
  const ids = new Set([...b.key, ...b.theirPlans.slice(0, 3).flatMap((p) => p.members), ...b.promising.map((x) => x.id), ...shortlist]);
  return ids;
}

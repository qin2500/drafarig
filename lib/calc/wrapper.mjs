// Fail-closed damage calc wrapper. Pure: the damage engine (@smogon/calc 0.12.0, vendored) is injected, never imported,
// so this module runs the same in the browser and in tests and never touches the network.
//
//   const calc = createCalc(engine, mech);   // engine = the vendored module's exports; mech = loadMechanics(data)
//   calc.run(scenario)                        // one scenario with known Stat Points on both sides
//   calc.envelope(scenario, 'attacker'|'defender', opts)   // frail / common / max rows for an unknown side
//
// Pipeline (no engine call before step 5): normalize → legality and set checks (projection) → move and ability support
// → game-state questions → build engine objects explicitly (Doubles always, abilities on Pokemon and Move) → calculate in
// try/catch → post-checks → own corrections (Protect-bypass order, Disguise) → exact KO odds (ko.mjs).
// Every result has a class: exact | no-damage | status | needs-state | refused (plus a knife-edge flag), with stable codes.
import { checkSet, battleForme, toID, canLearn, legalAbilities } from './mech.mjs';
import { computeStats, speedOf, STAT_IDS } from './stats.mjs';
import { koOdds, hitDistribution } from './ko.mjs';
import { normalizeScenario } from './scenario.mjs';
import * as R from './rules.mjs';

export const NEUTRAL_ABILITY = 'Run Away'; // no damage effect; used where a rule must switch an ability off
const SPREAD = ['allAdjacent', 'allAdjacentFoes'];
const RESIST_BERRY = { occaberry: 'Fire', passhoberry: 'Water', wacanberry: 'Electric', rindoberry: 'Grass', yacheberry: 'Ice',
  chopleberry: 'Fighting', kebiaberry: 'Poison', shucaberry: 'Ground', cobaberry: 'Flying', payapaberry: 'Psychic', tangaberry: 'Bug',
  chartiberry: 'Rock', kasibberry: 'Ghost', habanberry: 'Dragon', colburberry: 'Dark', babiriberry: 'Steel', roseliberry: 'Fairy', chilanberry: 'Normal' };
const SAND_IMMUNE_ABILITIES = ['overcoat', 'sandveil', 'sandrush', 'sandforce', 'magicguard'];

const SET_CODE = {
  'species-unknown': 'species-not-in-regulation', 'species-not-in-regulation': 'species-not-in-regulation', 'species-is-battle-forme': 'species-not-in-regulation',
  'item-not-in-regulation': 'item-not-in-regulation', 'mega-stone-mismatch': 'mega-stone-mismatch', 'ability-missing': 'ability-missing',
  'ability-not-legal': 'ability-not-legal', 'nature-missing': 'nature-missing', 'nature-unknown': 'nature-missing',
  'move-not-in-regulation': 'move-not-in-regulation', 'move-not-learnable': 'move-not-learnable', 'move-duplicate': 'set-invalid',
  'moves-too-many': 'set-invalid', 'moves-empty': 'set-invalid', 'moves-missing': 'set-invalid', 'set-missing': 'set-invalid',
  'sp-not-integer': 'sp-out-of-range', 'sp-negative': 'sp-out-of-range', 'sp-over-stat': 'sp-out-of-range', 'sp-over-total': 'sp-out-of-range',
  'sp-missing': 'sp-out-of-range', 'sp-unknown-stat': 'sp-out-of-range', 'sp-unknown-not-allowed': 'sp-out-of-range',
};

/** Exact HP for a shown percentage: the top (hi) or bottom (lo) of the band floor(100·hp/max) || 1 = pct. 100 = full HP. */
export function hpFromShown(max, pct, end = 'hi') {
  if (pct >= 100) return max;
  const lo = pct <= 1 ? 1 : Math.ceil((pct * max) / 100);
  const hi = Math.min(max - 1, Math.ceil(((pct + 1) * max) / 100) - 1);
  return Math.max(1, end === 'lo' ? Math.min(lo, hi) : Math.max(lo, hi));
}

export function createCalc(engine, mech) {
  const gen = engine.Generations.get(0);
  let calls = 0;
  const engineSpecies = (name) => gen.species.get(toID(name));
  const effectiveness = (type, types) => types.reduce((e, t) => e * (gen.types.get(toID(type))?.effectiveness?.[t] ?? 1), 1);

  const refuse = (code, detail = {}) => ({ class: 'refused', code, ...detail });
  const needs = (key, side, options, detail = {}) => ({ class: 'needs-state', code: `needs-state:${key}`, question: { key, side, options }, ...detail });

  /** Resolve one side to engine inputs, or a refusal / question. */
  function side(which, s, sc, mv) {
    const set = s.set, st = s.state;
    const sp = mech.species[set.species];
    const f = battleForme(mech, set.species, set.item, { megaEvolved: st.mega });
    if (f.error) return refuse(SET_CODE[f.error] ?? f.error, { side: which });
    const forme = mech.species[f.id];
    let ability = f.mega ? toID(forme.abilities[0]) : set.ability;
    const chips = [], applied = [];
    if (f.mega) chips.push({ code: 'as-mega', side: which, value: forme.name });
    else if (mech.items[set.item]?.megaStone) chips.push({ code: 'not-mega-yet', side: which, value: sp.name });
    let engineName = forme.name;
    // Special formes the projection lists once but the engine stores per forme.
    if (set.species === 'aegislash') {
      if (which === 'attacker') { engineName = 'Aegislash-Blade'; applied.push({ code: 'aegislash-blade-attacking' }); }
      else { engineName = st.form === 'blade' ? 'Aegislash-Blade' : 'Aegislash-Shield'; chips.push({ code: st.form === 'blade' ? 'aegislash-blade' : 'aegislash-shield', side: which }); }
    }
    if (set.species === 'palafin') {
      if (st.form !== 'zero' && st.form !== 'hero') return needs('form', which, ['zero', 'hero'], { formOf: 'palafin' });
      if (st.form === 'hero') engineName = 'Palafin-Hero';
      chips.push({ code: `palafin-${st.form}`, side: which });
    }
    if (set.species === 'morpeko' && which === 'attacker' && mv.id === 'aurawheel') {
      if (st.form === 'hangry') engineName = 'Morpeko-Hangry';
      chips.push({ code: st.form === 'hangry' ? 'morpeko-hangry' : 'morpeko-fullbelly', side: which });
    }
    if (ability === 'trace') {
      const t = st.tracedAbility;
      if (t && !mech.abilities[t]) return refuse('ability-not-legal', { side: which });
      chips.push({ code: t ? 'traced' : 'traced-none', side: which, value: t ? mech.abilities[t].name : '' });
      ability = t || '';
    }
    if (R.TRANSFORMS.includes(ability)) return refuse('mechanic-unsupported:transform', { side: which, fix: { kind: 'change-ability' } });
    if (R.TYPE_CHANGE[ability] && (R.TYPE_CHANGE[ability] === 'both' || R.TYPE_CHANGE[ability] === which)) {
      return refuse('mechanic-unsupported:type-change', { side: which, ability, fix: { kind: 'change-ability' } });
    }
    if ((ability === 'protean' || ability === 'libero') && which === 'attacker') {
      chips.push({ code: st.proteanActive ? 'protean-first-move' : 'protean-used', side: which, value: mech.abilities[ability].name });
      if (!st.proteanActive) ability = '';
    }
    if (ability === 'forecast' && ['Sun', 'Rain', 'Snow'].includes(sc.field.weather)) return refuse('mechanic-unsupported:type-change', { side: which, ability });
    const es = engineSpecies(engineName);
    if (!es) return refuse('species-missing-in-calc', { side: which });
    const item = st.itemConsumed && !mech.items[set.item]?.megaStone ? '' : set.item;
    if (st.itemConsumed && set.item && item === '') chips.push({ code: 'item-used', side: which, value: mech.items[set.item]?.name ?? set.item });
    return { ok: true, set, st, forme, formeId: f.id, mega: f.mega, engineName, engineBase: es.baseStats, ability, item, chips, applied };
  }

  /** Post-Intimidate stages from the simulator-verified table (never the engine's own Intimidate). */
  function intimidate(boosts, receiverAbility, item, times, chips, which) {
    const b = { ...boosts };
    let herb = item === 'whiteherb';
    for (let i = 0; i < times; i++) {
      let dropped = false;
      if (R.INTIMIDATE_BLOCKERS.includes(receiverAbility) || receiverAbility === 'mirrorarmor') {
        // blocked (Mirror Armor reflects the drop onto the Intimidator)
      } else if (receiverAbility === 'guarddog') b.atk += 1;
      else if (receiverAbility === 'contrary') b.atk += 1;
      else if (receiverAbility === 'simple') { b.atk -= 2; dropped = true; } else { b.atk -= 1; dropped = true; }
      if (dropped && receiverAbility === 'defiant') b.atk += 2;
      if (dropped && receiverAbility === 'competitive') b.spa += 2;
      if (receiverAbility === 'rattled') b.spe += 1;
      for (const k of Object.keys(b)) b[k] = Math.max(-6, Math.min(6, b[k]));
      if (herb && Object.values(b).some((v) => v < 0)) { for (const k of Object.keys(b)) b[k] = Math.max(0, b[k]); herb = false; chips.push({ code: 'white-herb-used', side: which }); }
    }
    return { boosts: b, herbUsed: item === 'whiteherb' && !herb };
  }

  const pokemon = (x, extra = {}) => new engine.Pokemon(gen, x.engineName, {
    level: 50, ability: x.ability ? (mech.abilities[x.ability]?.name ?? x.ability) : NEUTRAL_ABILITY, abilityOn: false,
    item: x.item ? mech.items[x.item].name : undefined, nature: mech.natures[x.set.nature].name, evs: x.set.sp,
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, status: x.st.status || '', gender: x.set.gender || undefined, ...extra,
  });

  function run(scIn, opts = {}) {
    const sc = normalizeScenario(scIn);
    const mv = mech.moves[sc.move.id];
    const base = { version: R.WRAPPER_VERSION, inputs: sc };
    // 1–3. legality and set checks (independent of the importer and the store)
    for (const which of ['attacker', 'defender']) {
      const s = sc[which];
      const problems = checkSet(mech, s.set, { side: 'theirs' }).filter((p) => p.severity === 'error');
      if (problems.length) return { ...base, ...refuse(SET_CODE[problems[0].code] ?? 'set-invalid', { side: which, problems }) };
      if (s.set.sp === 'unknown') return { ...base, ...refuse('sp-unknown', { side: which }) };
    }
    if (!sc.move.id) return { ...base, ...refuse('move-missing') };
    if (!mv) return { ...base, ...refuse('move-not-in-regulation') };
    if (!canLearn(mech, sc.attacker.set.species, sc.move.id)) return { ...base, ...refuse('move-not-learnable') };
    if (mv.category === 'Status') return { ...base, class: 'status', code: 'status-move' };
    if (R.UNSUPPORTED_MOVES[sc.move.id]) return { ...base, ...refuse('move-unsupported', { reason: R.UNSUPPORTED_MOVES[sc.move.id] }) };
    // 4. sides and game-state questions
    const A = side('attacker', sc.attacker, sc, sc.move), D = side('defender', sc.defender, sc, sc.move);
    for (const x of [A, D]) if (!x.ok) return { ...base, ...x };
    const st = R.STATE_BP[sc.move.id];
    if (st && sc.attacker.state[st.key] === null) return { ...base, ...needs(st.key, 'attacker', st.options) };
    if (A.ability === 'supremeoverlord' && sc.attacker.state.faintedAllies === null) return { ...base, ...needs('faintedAllies', 'attacker', [0, 1, 2, 3], { reason: 'supremeoverlord' }) };
    // A pinned hit count must be one the move can actually do
    const h = sc.move.hits;
    if (h) {
      const mh = mv.multihit;
      const ok = Array.isArray(mh) ? h >= mh[0] && h <= mh[1] : typeof mh === 'number' ? (R.PER_HIT_ACCURACY.includes(sc.move.id) ? h >= 1 && h <= mh : h === mh) : false;
      if (!ok) return { ...base, ...refuse('input-invalid:hits') };
    }
    // HP given as the percentage Showdown shows covers a band of exact HP (shown = floor(100·hp/max) || 1): the main result
    // uses the top of the band, and a second run gives the bottom of the band when it differs.
    const main = compute(sc, mv, side('attacker', sc.attacker, sc, sc.move), side('defender', sc.defender, sc, sc.move), base, { ...opts, hpEnd: 'hi' });
    if (main.class !== 'exact' || (sc.attacker.state.hpPct === 100 && sc.defender.state.hpPct === 100)) return main;
    const lo = compute(sc, mv, side('attacker', sc.attacker, sc, sc.move), side('defender', sc.defender, sc, sc.move), base, { ...opts, hpEnd: 'lo', lite: true });
    if (lo.class === 'exact' && (JSON.stringify(lo.hitRows) !== JSON.stringify(main.hitRows) || lo.curHP !== main.curHP)) {
      const hpLow = { curHP: lo.curHP, attackerHP: lo.attacker.curHP, range: lo.range, ko: { one: lo.ko.one }, side: lo.curHP !== main.curHP ? 'defender' : 'attacker' };
      Object.defineProperty(hpLow, 'koForHP', { enumerable: false, value: lo.koForHP });
      Object.defineProperty(main, 'hpLow', { enumerable: true, value: hpLow });
    }
    return main;
  }

  function compute(sc, mv, A, D, base, opts = {}) {
    const chips = [...A.chips, ...D.chips], applied = [...A.applied, ...D.applied], notCounted = [], notes = [];
    const moldBreaker = A.ability === 'moldbreaker';
    // Intimidate (receiver = the out-of-battle ability; Intimidate lands on switch-in, before Mega Evolution)
    const sideBoosts = {};
    for (const [which, X] of [['attacker', A], ['defender', D]]) {
      let b = X.st.boosts;
      if (X.st.intimidated) {
        const recv = X.set.ability;
        const grass = mech.species[X.formeId].types.includes('Grass');
        const partnerVeil = which === 'attacker' ? sc.field.attackerSide.flowerVeil : sc.field.defenderSide.flowerVeil;
        if ((recv === 'flowerveil' || partnerVeil) && grass) return { ...base, ...refuse('mechanic-unsupported:intimidate-flowerveil', { side: which }) };
        if (X.st.intimidated > 1) chips.push({ code: 'intimidate-twice', side: which });
        if (X.mega) chips.push({ code: 'intimidate-before-mega', side: which });
        const r = intimidate(b, recv, X.item, X.st.intimidated, chips, which);
        b = r.boosts;
        if (r.herbUsed) X.item = '';
        applied.push({ code: 'intimidate-table', side: which, value: X.st.intimidated });
      }
      sideBoosts[which] = b;
      for (const [k, v] of Object.entries(b)) if (v) chips.push({ code: 'stage', side: which, stat: k, value: v });
    }
    // Spread / lone target (simulator rule: spread iff more than one target at execution; an immune or Protecting partner counts)
    let target = mv.target;
    const groundedA = !mech.species[A.formeId].types.includes('Flying') && A.ability !== 'levitate' && A.ability !== 'eelevate' && A.item !== 'airballoon';
    if (sc.move.id === 'expandingforce' && sc.field.terrain === 'Psychic' && (groundedA || sc.field.gravity || A.item === 'ironball')) target = 'allAdjacentFoes';
    const spreadTarget = SPREAD.includes(target);
    const fs = sc.field.attackerSide, ds = sc.field.defenderSide;
    const isSpread = spreadTarget && (ds.partnerPresent || (target === 'allAdjacent' && fs.allyPresent));
    const overrides = {};
    if (spreadTarget) {
      if (isSpread) chips.push({ code: 'spread', value: target === 'allAdjacent' ? 'all' : 'foes' });
      else {
        if (sc.move.id === 'expandingforce') return { ...base, ...refuse('mechanic-unsupported:expanding-force-lone-target', { fix: { kind: 'set-field', key: 'partnerPresent', value: true } }) };
        overrides.target = 'normal';
        chips.push({ code: 'lone-target' });
        applied.push({ code: 'lone-target-spread' });
      }
    }
    // Base power from game state
    const sbp = R.STATE_BP[sc.move.id];
    if (sbp) { const k = sc.attacker.state[sbp.key]; overrides.basePower = sbp.bp(k); chips.push({ code: `state-${sbp.key}`, value: k }); applied.push({ code: `bp-${sc.move.id}` }); }
    const cbp = R.CONDITIONAL_BP[sc.move.id];
    let paybackPending = false;
    if (cbp) {
      const on = sc.move.state[cbp.key];
      chips.push({ code: `cond-${cbp.key}`, value: on });
      if (sc.move.id === 'payback') paybackPending = on; else overrides.basePower = on ? cbp.doubled : cbp.base;
    }
    if (A.ability === 'supremeoverlord') chips.push({ code: 'state-faintedAllies', value: sc.attacker.state.faintedAllies });
    // Hit counts
    let fixedHits = sc.move.hits || null;
    const skillLink = A.ability === 'skilllink';
    if (sc.move.id === 'dragondarts') { fixedHits = ds.partnerPresent ? 1 : 2; chips.push({ code: ds.partnerPresent ? 'dragon-darts-split' : 'dragon-darts-both' }); }
    else if (fixedHits && mv.multihit) chips.push({ code: 'hits-pinned', value: fixedHits });
    const dist = hitDistribution(mv.multihit, { skillLink, fixedHits });
    const maxHits = Math.max(...dist.map((d) => d.n));
    if (R.PER_HIT_ACCURACY.includes(sc.move.id)) chips.push({ code: 'all-hits-land', value: maxHits });
    const pbApplies = A.ability === 'parentalbond' && maxHits === 1 && !isSpread;
    const multi = maxHits > 1 || pbApplies;
    // Mid-hit changes the engine doesn't follow: refuse the total, offer the first hit only
    if (multi && !sc.move.firstHitOnly) {
      const mid = R.MID_HIT_DEFENDER[D.ability];
      if (mid && mid(mv)) return { ...base, ...refuse(`mechanic-unsupported:${D.ability === 'spicyspray' ? 'spicy-spray-multihit' : 'ability-change-multihit'}`, { fix: { kind: 'first-hit-only' } }) };
      if (A.item === 'normalgem' && mv.type === 'Normal' && !['aerilate', 'dragonize', 'pixilate', 'refrigerate'].includes(A.ability)) return { ...base, ...refuse('mechanic-unsupported:gem-multihit', { fix: { kind: 'first-hit-only' } }) };
      if (pbApplies) {
        const berryType = RESIST_BERRY[D.item];
        if (sc.move.id === 'knockoff' && D.item && !mech.items[D.item]?.megaStone && D.ability !== 'stickyhold') return { ...base, ...refuse('mechanic-unsupported:pb-item-change', { fix: { kind: 'first-hit-only' } }) };
        if (berryType && A.ability !== 'unnerve' && !fs.unnerve && (berryType === mv.type || berryType === 'Normal')) return { ...base, ...refuse('mechanic-unsupported:pb-item-change', { fix: { kind: 'first-hit-only', berry: D.item } }) };
      }
    }
    if (sc.move.firstHitOnly && multi) chips.push({ code: 'first-hit-only' });
    // Field
    const fairyAura = sc.field.otherFairyAura;
    if (fairyAura) applied.push({ code: 'fairy-aura-field' });
    let friendGuard = ds.friendGuard;
    if (friendGuard && moldBreaker) { friendGuard = false; applied.push({ code: 'moldbreaker-friendguard' }); }
    const atkFull = sc.attacker.state.hpPct === 100;
    const effPriority = mv.priority + (A.ability === 'galewings' && mv.type === 'Flying' && atkFull ? 1 : 0) + (sc.move.id === 'grassyglide' && sc.field.terrain === 'Grassy' && groundedA ? 1 : 0);
    if (effPriority > 0 && ds.priorityBlock && !moldBreaker) return { ...base, class: 'no-damage', code: 'blocked-priority-partner', chips };
    let protect = ds.protect, bypass = false;
    if (protect && R.BREAKS_PROTECT.includes(sc.move.id)) { protect = false; chips.push({ code: 'breaks-protect' }); }
    if (protect) {
      const contact = mv.flags.includes('contact');
      if ((A.ability === 'unseenfist' || A.ability === 'piercingdrill') && contact) { bypass = true; protect = false; applied.push({ code: 'protect-bypass-order' }); chips.push({ code: 'through-protect' }); }
      else return { ...base, class: 'no-damage', code: 'protected', chips };
    }
    // Iron Ball / Gravity ground a Levitate or Eelevate holder (the engine returns 0 and its description throws)
    const groundMove = mv.type === 'Ground';
    let dAbility = D.ability;
    if (groundMove && (dAbility === 'levitate' || dAbility === 'eelevate') && (D.item === 'ironball' || sc.field.gravity)) { dAbility = ''; applied.push({ code: 'ironball-grounded' }); }
    // Analytic: the engine infers turn order from raw Speed; reconcile with the stated order
    const speeds = { attacker: engineSpeed(A, sideBoosts.attacker, sc, 'attacker'), defender: engineSpeed(D, sideBoosts.defender, sc, 'defender') };
    const engineThinksLast = !(speeds.attacker > speeds.defender);
    let aAbilityOn = false, aAbility = A.ability;
    if (R.ACTIVATION[aAbility]) { aAbilityOn = A.st.abilityOn; chips.push({ code: `activation-${aAbility}`, value: aAbilityOn }); }
    if (aAbility === 'analytic') {
      const last = sc.move.state.movesLast;
      chips.push({ code: 'cond-movesLast', value: last });
      if (last) aAbilityOn = true; else if (engineThinksLast) aAbility = '';
    }
    if (sc.move.id === 'payback') overrides.basePower = (paybackPending ? 100 : 50) / (engineThinksLast ? 2 : 1);
    if (R.SPEED_BP.includes(sc.move.id) && (speeds.attacker >= 999 || speeds.defender >= 999)) return { ...base, ...refuse('mechanic-unsupported:speed-cap') };
    if (R.SPEED_BP.includes(sc.move.id)) chips.push({ code: 'speed-based-bp', value: `${speeds.attacker}/${speeds.defender}` });
    // Disguise (defender Mimikyu with an intact Disguise): the first damaging hit becomes a fixed ⌊max HP / 8⌋ chip
    const disguise = D.set.species === 'mimikyu' && D.ability === 'disguise' && !moldBreaker && D.st.disguiseIntact;
    if (D.set.species === 'mimikyu' && D.ability === 'disguise') {
      chips.push({ code: disguise ? 'disguise-intact' : moldBreaker ? 'disguise-ignored' : 'disguise-broken' });
      D.engineName = 'Mimikyu-Busted'; D.engineBase = engineSpecies('Mimikyu-Busted').baseStats; dAbility = '';
    }
    const ours = { attacker: computeStats(A.engineBase, A.set.sp, mech.natures[A.set.nature]), defender: computeStats(D.engineBase, D.set.sp, mech.natures[D.set.nature]) };
    const maxHP = ours.defender.hp;
    const curHP = hpFromShown(maxHP, sc.defender.state.hpPct, opts.hpEnd);
    const atkHP = hpFromShown(ours.attacker.hp, sc.attacker.state.hpPct, opts.hpEnd);
    if (sc.defender.state.hpPct !== 100) chips.push({ code: 'hp-band', side: 'defender', value: sc.defender.state.hpPct, lo: hpFromShown(maxHP, sc.defender.state.hpPct, 'lo'), hi: hpFromShown(maxHP, sc.defender.state.hpPct, 'hi') });
    if (sc.attacker.state.hpPct !== 100) chips.push({ code: 'hp-band', side: 'attacker', value: sc.attacker.state.hpPct, lo: hpFromShown(ours.attacker.hp, sc.attacker.state.hpPct, 'lo'), hi: hpFromShown(ours.attacker.hp, sc.attacker.state.hpPct, 'hi') });
    // Build and run. defenderHP: current HP for this run; berry: whether a resist berry is still held.
    const unburdenOn = (X) => X.ability === 'unburden' && X.st.itemConsumed && !!X.set.item;
    const build = ({ crit = false, defenderHP = curHP, berry = true, hits = maxHits } = {}) => {
      const atk = pokemon({ ...A, ability: aAbility }, {
        boosts: sideBoosts.attacker, abilityOn: aAbilityOn || unburdenOn(A), alliesFainted: A.ability === 'supremeoverlord' ? sc.attacker.state.faintedAllies : 0,
        curHP: atkHP,
      });
      const defItem = berry && !(fs.unnerve && RESIST_BERRY[D.item]) ? D.item : (RESIST_BERRY[D.item] ? '' : D.item);
      const def = pokemon({ ...D, ability: dAbility, item: defItem }, { boosts: sideBoosts.defender, curHP: defenderHP, abilityOn: unburdenOn(D) });
      const move = new engine.Move(gen, mv.name, { ability: atk.ability, item: atk.item, isCrit: crit, ...(hits > 1 ? { hits } : {}), overrides: { ...overrides } });
      const field = new engine.Field({
        gameType: 'Doubles', weather: sc.field.weather || undefined, terrain: sc.field.terrain || undefined, isGravity: sc.field.gravity,
        isMagicRoom: sc.field.magicRoom, isWonderRoom: sc.field.wonderRoom, isFairyAura: fairyAura,
        attackerSide: { isHelpingHand: fs.helpingHand, isTailwind: fs.tailwind, isSteelySpirit: fs.steelySpirit, isCharge: fs.charge },
        defenderSide: { isReflect: ds.reflect, isLightScreen: ds.lightScreen, isAuroraVeil: ds.auroraVeil, isFriendGuard: friendGuard, isProtected: protect, isTailwind: ds.tailwind },
      });
      calls++;
      return engine.calculate(gen, atk, def, move, field);
    };
    const rowsOf = (r) => {
      const d = r.damage;
      let h = typeof d === 'number' ? [Array(16).fill(d)] : Array.isArray(d[0]) ? d.map((x) => x.slice()) : [d.slice()];
      if (bypass) h = h.map((x) => x.map((v) => Math.max(1, Math.trunc((Math.trunc(v * 1024) + 2047) / 4096))));
      if (sc.move.firstHitOnly && multi) h = [h[0]];
      return h;
    };
    let first;
    try { first = build({ crit: sc.move.crit }); } catch (e) { return { ...base, ...refuse('engine-error') }; }
    // Stats must equal our stat function (one source of truth for editor, ladder, brief and calcs)
    for (const which of ['attacker', 'defender']) {
      const raw = first[which].rawStats;
      if (STAT_IDS.some((s) => raw[s] !== ours[which][s])) return { ...base, ...refuse('engine-stat-mismatch', { side: which }) };
    }
    const baseRows = rowsOf(first);
    if (!baseRows.every((h) => h.length === 16 && h.every((v) => Number.isInteger(v) && v >= 0))) return { ...base, ...refuse('engine-error') };
    const effType = first.move.type;
    // Zero damage: explain it (immunity, ability, item, terrain) or refuse as an engine anomaly
    if (baseRows[0].every((v) => v === 0)) {
      const why = zeroReason(first, effType, D, dAbility, sc, moldBreaker);
      if (!why) return { ...base, ...refuse('engine-zero') };
      return { ...base, class: 'no-damage', code: why, chips, applied };
    }
    const chip8 = Math.trunc(maxHP / 8);
    if (disguise) applied.push({ code: 'disguise-chip' });
    // Variants for the KO model: Multiscale (full HP only), a resist berry (first hit only), Disguise (first hit = chip)
    const eff = effectiveness(effType, first.defender.types);
    const berryType = RESIST_BERRY[D.item];
    const itemsOff = sc.field.magicRoom || D.ability === 'klutz';
    if (itemsOff && D.item) chips.push({ code: 'items-off', side: 'defender' });
    const noBerries = A.ability === 'unnerve' || fs.unnerve;
    const berryRelevant = !itemsOff && !!berryType && berryType === effType && (eff > 1 || effType === 'Normal') && !noBerries;
    const fullRelevant = D.ability === 'multiscale' && !moldBreaker;
    const engineRows = new Map();
    const rowsFor = (full, berry, crit) => {
      const f = fullRelevant ? full : curHP === maxHP, b = berryRelevant ? berry : true;
      const key = `${f}|${b}|${crit}`;
      if (!engineRows.has(key)) {
        const hp = f ? maxHP : Math.min(curHP, maxHP - 1);
        engineRows.set(key, (f === (curHP === maxHP) && b && crit === sc.move.crit) ? baseRows : rowsOf(build({ crit, defenderHP: fullRelevant ? hp : curHP, berry: b })));
      }
      return engineRows.get(key);
    };
    const variantRows = (fl, crit) => {
      const h = rowsFor(fl.full, fl.berry, crit);
      return fl.disguise ? [Array(16).fill(chip8), ...h.slice(1)] : h;
    };
    const distFor = (h) => (sc.move.firstHitOnly && multi ? [{ w: 1, hits: [h[0]] }] : pbApplies ? [{ w: 1, hits: h.slice(0, 2) }] : dist.map((d) => ({ w: d.w, hits: h.slice(0, d.n) })));
    const use = (heal = 0, crit = sc.move.crit) => ({
      variant: (fl) => ({ dist: distFor(variantRows(fl, crit)) }),
      moldBreaker, consumesBerry: berryRelevant, breaksDisguise: disguise, heal,
    });
    const hitRows = variantRows({ full: curHP === maxHP, berry: berryRelevant, disguise }, sc.move.crit);
    const eatenAlready = D.item === 'sitrusberry' && curHP <= maxHP / 2;
    const sitrusOn = !itemsOff && D.item === 'sitrusberry' && !noBerries && !eatenAlready;
    if (D.item === 'sitrusberry' && noBerries) chips.push({ code: 'unnerve-berry' });
    if (eatenAlready && !noBerries && !itemsOff) chips.push({ code: 'sitrus-already-eaten' });
    const defState = { maxHP, hp: curHP, sitrus: sitrusOn, sash: !itemsOff && D.item === 'focussash', sturdy: D.ability === 'sturdy' && !moldBreaker, berry: berryRelevant, disguise };
    const berryAbility = ['ripen', 'cheekpouch', 'harvest'].includes(D.ability) && (sitrusOn || berryRelevant);
    // One use (exact)
    let ko1;
    const oneUseRefusal = !itemsOff && D.item === 'oranberry' && !noBerries && multi ? 'between-hits:oran-berry' : berryAbility && multi && sitrusOn ? 'between-hits:berry-ability' : null;
    if (noBerries && !itemsOff && (D.item === 'oranberry' || (berryType === effType && (eff > 1 || effType === 'Normal')))) chips.push({ code: 'unnerve-berry' });
    try { ko1 = oneUseRefusal ? null : koOdds(defState, [use()]); } catch (e) { return { ...base, ...refuse('engine-error') }; }
    // Repeated use across turns (Leftovers between turns; anything else unmodelled refuses this line only)
    const repeatBlock = opts.lite ? 'not-computed' : berryAbility ? 'between-turns:berry-ability' : repeatRefusal(sc, mv, A, D, first, { itemsOff, effType, aAbilityOn });
    const leftovers = !itemsOff && D.item === 'leftovers' ? Math.trunc(maxHP / 16) : 0;
    let ko2 = null, ko3 = null;
    if (!repeatBlock && !oneUseRefusal) {
      const k = koOdds(defState, [use(leftovers), use(leftovers), use()]);
      ko2 = k.afterEach[1]; ko3 = k.afterEach[2];
      if (leftovers) chips.push({ code: 'leftovers-between-turns', value: leftovers });
    }
    if (defState.sitrus) chips.push({ code: 'sitrus-counted' });
    if (defState.sash && curHP === maxHP) chips.push({ code: 'sash-counted' });
    if (defState.sturdy && curHP === maxHP) chips.push({ code: 'sturdy-counted' });
    if (berryRelevant) chips.push({ code: 'resist-berry', value: mech.items[D.item].name });
    if (D.item === 'focusband') notCounted.push({ code: 'focus-band' });
    // If crit (separate line; never blended)
    let crit = null;
    const critImmune = ['shellarmor', 'battlearmor'].includes(D.ability) && !moldBreaker;
    if (opts.lite) crit = null;
    else if (R.ALWAYS_CRIT.includes(sc.move.id) || sc.move.crit) crit = { already: true };
    else if (critImmune) crit = { immune: true };
    else {
      try {
        const ch = variantRows({ full: curHP === maxHP, berry: berryRelevant, disguise }, true);
        // the crit line's KO odds have the same limits as the one-use line (e.g. Oran Berry between hits)
        const k = oneUseRefusal ? null : koOdds(defState, [use(0, true)]);
        crit = { hitRows: ch, range: rangeOf(ch, distFor), ko1: k ? { num: k.num, den: k.den } : { refused: oneUseRefusal } };
      } catch (e) { crit = { error: true }; }
    }
    // Notes: what is not counted
    if (mv.accuracy !== true && mv.accuracy < 100) notCounted.push({ code: 'accuracy', value: mv.accuracy });
    if (mv.hasSecondary) notCounted.push({ code: 'secondary' });
    notCounted.push({ code: 'after-hit' });
    if (R.USE_CONDITION[sc.move.id]) notes.push({ code: `use-${R.USE_CONDITION[sc.move.id]}` });
    if (A.item === 'metronome') notes.push({ code: 'metronome-first-use' });
    if (!sc.attacker.set.moves.includes(sc.move.id)) chips.push({ code: 'move-not-in-set' });
    if (sc.field.weather) chips.push({ code: 'weather', value: sc.field.weather });
    if (sc.field.terrain) chips.push({ code: 'terrain', value: sc.field.terrain });
    for (const [k, on] of [['helping-hand', fs.helpingHand], ['charge', fs.charge], ['steely-spirit', fs.steelySpirit], ['reflect', ds.reflect], ['light-screen', ds.lightScreen], ['aurora-veil', ds.auroraVeil], ['friend-guard', friendGuard], ['gravity', sc.field.gravity], ['fairy-aura', fairyAura], ['magic-room', sc.field.magicRoom], ['wonder-room', sc.field.wonderRoom]]) if (on) chips.push({ code: k });
    for (const which of ['attacker', 'defender']) {
      const s = sc[which].state;
      if (s.status) chips.push({ code: 'status', side: which, value: s.status });
    }
    if (sc.move.crit) chips.push({ code: 'crit' });
    const flags = knifeEdge(hitRows, curHP, sc, A, D, berryRelevant, friendGuard) ? ['knife-edge'] : [];
    const tiers = abilityTiers([A.ability, dAbility === '' ? null : D.ability]);
    return Object.defineProperty({
      ...base, class: 'exact', code: 'ok', flags,
      attacker: { name: A.engineName, formeId: A.formeId, mega: A.mega, ability: A.ability, item: A.item, stats: ours.attacker, speed: speeds.attacker, curHP: first.attacker.curHP(), maxHP: ours.attacker.hp },
      defender: { name: D.engineName, formeId: D.formeId, mega: D.mega, ability: D.ability, item: D.item, stats: ours.defender, speed: speeds.defender, curHP, maxHP },
      move: { id: sc.move.id, name: mv.name, type: effType, category: first.move.category, spread: isSpread, multi, dist: sc.move.firstHitOnly && multi ? [{ n: 1, w: 1 }] : pbApplies ? [{ n: 2, w: 1 }] : dist, pb: pbApplies },
      hitRows, range: rangeOf(hitRows, distFor), maxHP, curHP,
      ko: { one: ko1 ? { num: ko1.num, den: ko1.den } : { refused: oneUseRefusal }, two: ko2 ?? { refused: repeatBlock ?? oneUseRefusal }, three: ko3 ?? { refused: repeatBlock ?? oneUseRefusal } },
      crit, chips, applied, notCounted, notes, tiers,
    }, 'koForHP', { enumerable: false, value: (hp) => (oneUseRefusal ? null : koOdds({ ...defState, maxHP: hp, hp }, [use()])) });
  }

  function engineSpeed(X, boosts, sc, which) {
    const sideTw = which === 'attacker' ? sc.field.attackerSide.tailwind : sc.field.defenderSide.tailwind;
    const raw = computeStats(X.engineBase, X.set.sp, mech.natures[X.set.nature]).spe;
    return speedOf(raw, { stage: boosts.spe, tailwind: sideTw, scarf: X.item === 'choicescarf', ironBall: X.item === 'ironball', para: X.st.status === 'par', status: X.st.status, ability: X.ability, weather: sc.field.weather, terrain: sc.field.terrain, unburdenActive: X.st.itemConsumed && X.set.item && !X.item }).speed;
  }

  function zeroReason(r, type, D, dAbility, sc, moldBreaker) {
    const desc = r.rawDesc ?? {};
    if (desc.isProtected) return 'protected';
    if (desc.defenderAbility) return 'immune-ability';
    if (desc.defenderItem && D.item === 'airballoon') return 'immune-air-balloon';
    if (desc.terrain === 'Psychic') return 'immune-psychic-terrain';
    const types = r.defender.types;
    const t = gen.types.get(toID(type));
    let eff = 1;
    for (const dt of types) {
      let e = t?.effectiveness?.[dt] ?? 1;
      if (e === 0 && dt === 'Ghost' && (type === 'Normal' || type === 'Fighting') && r.attacker.hasAbility('Scrappy')) e = 1;
      if (e === 0 && dt === 'Flying' && type === 'Ground' && (sc.field.gravity || D.item === 'ironball')) e = 1;
      eff *= e;
    }
    if (eff === 0) return 'immune-type';
    if (['poltergeist', 'steelroller'].includes(sc.move.id)) return 'move-fails';
    if (dAbility && ['flashfire', 'waterabsorb', 'voltabsorb', 'dryskin', 'sapsipper', 'lightningrod', 'stormdrain', 'motordrive', 'eartheater', 'levitate', 'eelevate', 'bulletproof', 'soundproof', 'queenlymajesty', 'armortail', 'dazzling'].includes(dAbility) && !moldBreaker) return 'immune-ability';
    return null;
  }

  function repeatRefusal(sc, mv, A, D, r, { itemsOff = false, effType = mv.type, aAbilityOn = false } = {}) {
    const id = sc.move.id;
    if (sc.field.attackerSide.charge && effType === 'Electric') return 'changes-after-use:charge';
    if (aAbilityOn && ['electromorphosis', 'stakeout'].includes(A.ability)) return 'changes-after-use:one-turn-boost';
    if (A.item === 'normalgem' && effType === 'Normal' && !sc.field.magicRoom && A.ability !== 'klutz') return 'changes-after-use:gem';
    if (D.ability === 'spicyspray' && mv.category === 'Physical' && !mech.species[A.formeId].types.includes('Fire') && !sc.attacker.state.status) return 'between-turns:spicy-spray';
    if (['mummy', 'lingeringaroma', 'wanderingspirit'].includes(D.ability) && mv.flags.includes('contact')) return 'changes-after-use:attacker-ability';
    if (R.CHANGES_AFTER_USE[id]) return `changes-after-use:${R.CHANGES_AFTER_USE[id]}`;
    if (r.move.dropsStats) return 'changes-after-use:self-drop';
    if (sc.field.terrain === 'Grassy') {
      const types = mech.species[D.formeId].types;
      // an Air Balloon pops on the first damaging hit; Iron Ball and Gravity ground Flying types and Levitate
      const forced = sc.field.gravity || (D.item === 'ironball' && !itemsOff);
      const grounded = forced || (!types.includes('Flying') && !['levitate', 'eelevate'].includes(D.ability));
      if (grounded) return 'between-turns:grassy-heal';
    }
    if (sc.field.weather === 'Sand') {
      const types = mech.species[D.formeId].types;
      if (!types.some((t) => ['Rock', 'Ground', 'Steel'].includes(t)) && !SAND_IMMUNE_ABILITIES.includes(D.ability)) return 'between-turns:weather-chip';
    }
    if (['brn', 'psn', 'tox'].includes(sc.defender.state.status)) return 'between-turns:status-chip';
    const b = R.BETWEEN_TURN_UNMODELLED[D.ability];
    if (b !== undefined && b !== null) {
      if (b === '*' || (b === 'physical' && mv.category === 'Physical') || b.split('|').includes(sc.field.weather)) return `between-turns:ability`;
    }
    if (!itemsOff && R.ITEM_BETWEEN[D.item] && !(D.item === 'oranberry' && (A.ability === 'unnerve' || sc.field.attackerSide.unnerve))) return `between-turns:${R.ITEM_BETWEEN[D.item]}`;
    if (A.ability === 'moxie' || A.ability === 'speedboost' && R.SPEED_BP.includes(id)) return 'changes-after-use:attacker-ability';
    return null;
  }

  function knifeEdge(hitRows, curHP, sc, A, D, berry, friendGuard) {
    if (hitRows.length !== 1) return false;
    const ds = sc.field.defenderSide;
    const finals = [ds.reflect || ds.lightScreen || ds.auroraVeil, friendGuard, ['lifeorb', 'expertbelt'].includes(A.item), berry,
      ['multiscale', 'fluffy', 'auraguard', 'punkrock', 'filter', 'solidrock'].includes(D.ability)].filter(Boolean).length;
    const bps = [sc.field.attackerSide.helpingHand, !!sc.field.terrain, sc.field.otherFairyAura, ['muscleband', 'wiseglasses', 'normalgem'].includes(A.item) || /^(charcoal|mysticwater|miracleseed|magnet|nevermeltice|blackbelt|poisonbarb|softsand|sharpbeak|twistedspoon|silverpowder|hardstone|spelltag|dragonfang|blackglasses|metalcoat|silkscarf|fairyfeather)$/.test(A.item),
      ['technician', 'sharpness', 'strongjaw', 'megalauncher', 'toughclaws', 'sheerforce', 'ironfist', 'reckless', 'sandforce', 'punkrock', 'aerilate', 'dragonize', 'pixilate', 'refrigerate', 'steelyspirit'].includes(A.ability)].filter(Boolean).length;
    if (finals < 3 && bps < 3) return false;
    return hitRows[0].some((v) => Math.abs(v - curHP) <= 1);
  }

  function abilityTiers(ids) {
    return ids.filter(Boolean).map((id) => ({ id, tier: R.SIM_VERIFIED_ABILITIES.includes(id) ? 'sim' : 'source' }));
  }

  // ---------- envelope over unknown Stat Points ----------
  const PLUS = { atk: 'adamant', spa: 'modest', def: 'impish', spd: 'careful', hp: null };
  const PLUS_ALT = { def: 'bold', spd: 'calm' };
  const MINUS = { atk: 'modest', spa: 'adamant', def: 'lonely', spd: 'naughty' };

  /**
   * Three runs for an unknown side: frail (0 SP in the stats that matter, a nature lowering the key one), common (a supplied
   * spread, e.g. the set's own guess or a labelled usage spread; omitted when none), max (32 in what matters, a nature raising
   * it). A known nature is kept. Not a probability distribution over their spreads.
   */
  /** The stats an unknown side invests in for this move (attacker: its attacking stat; defender: HP + the defence used). */
  function envelopeStats(sc, which) {
    const mv = mech.moves[sc.move.id];
    const physical = mv.category === 'Physical';
    const defStat = (sc.move.id === 'psyshock' || sc.move.id === 'psystrike' || sc.move.id === 'secretsword') ? 'def' : physical ? 'def' : 'spd';
    if (which === 'attacker') return sc.move.id === 'foulplay' ? [] : sc.move.id === 'bodypress' ? ['def'] : [physical ? 'atk' : 'spa'];
    return ['hp', defStat, ...(sc.move.id === 'foulplay' ? ['atk'] : [])];
  }
  /**
   * One envelope row's spread for an unknown side, without running it: { sp, nature, label? } for 'frail' | 'common' | 'max'
   * (null for 'common' without a supplied spread). Shared by the range view and "What would it take?".
   */
  function spreadFor(scIn, which, key, { natureKnown = false, common = null } = {}) {
    const sc = normalizeScenario(scIn);
    if (!mech.moves[sc.move.id]) return null;
    const set = sc[which].set;
    if (key === 'common') return common && common.sp && common.sp !== 'unknown' ? { sp: { ...common.sp }, nature: common.nature || set.nature || 'hardy', label: common.label ?? null } : null;
    const stats = envelopeStats(sc, which);
    const k = stats.find((s) => s !== 'hp') ?? 'hp';
    const sp = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    if (key === 'max') { let budget = 66; for (const s of stats) { const v = Math.min(32, budget); sp[s] = v; budget -= v; } }
    const plus = which === 'defender' && k !== 'atk' && set.nature && mech.natures[set.nature]?.minus === 'spa' ? PLUS[k] : (PLUS_ALT[k] ?? PLUS[k]);
    const nat = key === 'max' ? plus : MINUS[k];
    return { sp, nature: natureKnown ? set.nature || 'hardy' : nat ?? 'hardy' };
  }

  function envelope(scIn, which, { natureKnown = false, common = null } = {}) {
    const sc = normalizeScenario(scIn);
    if (!mech.moves[sc.move.id]) return { rows: [run(sc)] };
    const rows = [];
    for (const key of ['frail', 'common', 'max']) {
      const sp = spreadFor(sc, which, key, { natureKnown, common });
      if (!sp) continue;
      const s = structuredClone(sc);
      s[which].set.sp = sp.sp;
      s[which].set.nature = sp.nature;
      rows.push({ key, sp: sp.sp, nature: sp.nature, ...(key === 'common' ? { label: sp.label } : {}), result: run(s) });
    }
    return { side: which, stats: envelopeStats(sc, which), rows };
  }

  return { run, envelope, spreadFor, engineCalls: () => calls, resetCalls: () => { calls = 0; }, gen, version: R.WRAPPER_VERSION };
}

/** Overall damage range for display: min over the fewest hits, max over the most. */
export function rangeOf(hitRows, distFor) {
  const dist = distFor(hitRows);
  let min = Infinity, max = 0;
  for (const d of dist) {
    const lo = d.hits.reduce((t, h) => t + h[0], 0), hi = d.hits.reduce((t, h) => t + h[15], 0);
    min = Math.min(min, lo); max = Math.max(max, hi);
  }
  return { min, max };
}

/** Outcome class used for "Outcome changed" after a re-check. */
export function outcomeClass(result) {
  if (!result || result.class !== 'exact') return result?.class ?? 'none';
  const cls = (f) => (!f || f.refused ? 'n/a' : f.num === '0' ? 'none' : f.num === f.den ? 'all' : 'some');
  return `one:${cls(result.ko.one)}|two:${cls(result.ko.two)}`;
}

// Calc wrapper rule tables. Each entry is a decision about how a mechanic reaches the damage engine: passed through,
// corrected, asked as an explicit game-state question, or refused with a fix. Rules marked "sim" were checked against
// the pinned Pokémon Showdown simulator (real battles with pinned damage rolls); "source" ones follow the simulator's
// source and the engine's implementation without a dedicated simulator probe. Changing anything here must bump
// WRAPPER_VERSION, which is part of every saved calc's key, so dependent calcs go out of date instead of silently drifting.

export const WRAPPER_VERSION = 'drafarig-calc/3';

/** Moves whose base power depends on a battle state the engine cannot know: answered as a question first. */
export const STATE_BP = Object.freeze({
  // sim: 50 + 50 per fainted Pokémon on the user's side
  lastrespects: { key: 'faintedAllies', options: [0, 1, 2, 3], bp: (k) => 50 + 50 * k }, // pick 4: at most 3 others can faint
  // sim: min(350, 50 + 50 per hit taken since it last switched in; Champions resets the count on switch-out)
  ragefist: { key: 'timesHit', options: [0, 1, 2, 3, 4, 5, 6], bp: (k) => Math.min(350, 50 + 50 * k) },
});

/** Moves with a condition the engine ignores or infers from raw Speed: an explicit, visible assumption with a default. */
export const CONDITIONAL_BP = Object.freeze({
  payback: { key: 'movesLast', def: false, base: 50, doubled: 100 },
  avalanche: { key: 'hitFirstThisTurn', def: false, base: 60, doubled: 120 },
  temperflare: { key: 'lastMoveFailed', def: false, base: 75, doubled: 150 },
  stompingtantrum: { key: 'lastMoveFailed', def: false, base: 75, doubled: 150 },
  ficklebeam: { key: 'fickleDouble', def: false, base: 80, doubled: 160 },
  assurance: { key: 'targetAlreadyHit', def: false, base: 60, doubled: 120 },
});

/** Damaging moves the wrapper does not calculate. */
export const UNSUPPORTED_MOVES = Object.freeze({
  beatup: 'beat-up', counter: 'damage-taken', mirrorcoat: 'damage-taken', metalburst: 'damage-taken', comeuppance: 'damage-taken',
  fissure: 'ohko-move', guillotine: 'ohko-move', horndrill: 'ohko-move', sheercold: 'ohko-move', spitup: 'stockpile',
  // the pinned engine returns no damage for these in gen 9 (only Seismic Toss, Night Shade and Final Gambit are fixed)
  superfang: 'target-hp-fraction', endeavor: 'target-hp-fraction',
});

/** Moves whose power or typing changes after each use, so repeated-use KO odds are refused (single use still shown). */
export const CHANGES_AFTER_USE = Object.freeze({
  burnup: 'loses-type', doubleshock: 'loses-type', knockoff: 'removes-item', saltcure: 'residual', poweruppunch: 'self-boost',
  hardpress: 'target-hp', eruption: 'user-hp', waterspout: 'user-hp', flail: 'user-hp', reversal: 'user-hp', endeavor: 'target-hp',
  superfang: 'target-hp', finalgambit: 'user-hp', explosion: 'user-faints', selfdestruct: 'user-faints', mistyexplosion: 'user-faints',
  fakeout: 'first-turn-only', firstimpression: 'first-turn-only', ragefist: 'state-changes', lastrespects: 'state-changes',
  meteorbeam: 'self-boost', electroshot: 'self-boost',
}); // plus any move the engine marks as lowering its own attacking stat (Draco Meteor, Make It Rain, Superpower, …)
/** Moves whose damage depends on the target's current HP: no threshold search on HP. */
export const TARGET_HP_MOVES = Object.freeze(['hardpress', 'superfang', 'endeavor']);
/** Fixed-damage moves the engine returns the fixed number for (Super Fang and Endeavor are refused above). */
export const FIXED_DAMAGE = Object.freeze(['seismictoss', 'nightshade', 'finalgambit']);
/** Speed-dependent base power computed by the engine from final Speed (exact unless a Speed exceeds the engine's 999 cap). */
export const SPEED_BP = Object.freeze(['electroball', 'gyroball']);
/** Moves that need a note about when they can be used (not a damage change). */
export const USE_CONDITION = Object.freeze({
  fakeout: 'first-turn', firstimpression: 'first-turn', suckerpunch: 'target-attacks', upperhand: 'target-priority',
  focuspunch: 'not-hit-first', beakblast: 'charges', solarbeam: 'charges', solarblade: 'charges', skyattack: 'charges', meteorbeam: 'charges',
  electroshot: 'charges', fly: 'semi-invulnerable', bounce: 'semi-invulnerable', dig: 'semi-invulnerable', dive: 'semi-invulnerable',
  phantomforce: 'semi-invulnerable', futuresight: 'delayed', steelroller: 'needs-terrain', poltergeist: 'needs-item', belch: 'needs-berry',
  outrage: 'locked', thrash: 'locked', petaldance: 'locked', ragingfury: 'locked', uproar: 'locked',
});
/** Moves that always land a critical hit (the base result is already a crit; no separate "if crit" line). */
export const ALWAYS_CRIT = Object.freeze(['stormthrow', 'frostbreath', 'flowertrick', 'wickedblow', 'surgingstrikes']);
/** Per-hit accuracy checks (a miss ends the move): results assume every hit lands, said in the chips. */
/** Moves that hit through Protect for full damage (they break it). */
export const BREAKS_PROTECT = Object.freeze(['feint', 'phantomforce', 'shadowforce', 'hyperspacefury', 'hyperspacehole']);
export const PER_HIT_ACCURACY = Object.freeze(['populationbomb', 'tripleaxel', 'tripledive']);

// ---------- abilities ----------
/** Checked with real battles in the pinned Pokémon Showdown simulator (pinned damage rolls). */
export const SIM_VERIFIED_ABILITIES = Object.freeze([
  'megasol', 'auraguard', 'dragonize', 'eelevate', 'levitate', 'unseenfist', 'piercingdrill', 'parentalbond', 'fairyaura', 'moldbreaker',
  'intimidate', 'innerfocus', 'owntempo', 'oblivious', 'scrappy', 'clearbody', 'hypercutter', 'whitesmoke', 'fullmetalbody', 'defiant',
  'competitive', 'contrary', 'simple', 'guarddog', 'mirrorarmor', 'rattled', 'disguise', 'stancechange', 'sturdy', 'friendguard',
  'swiftswim', 'chlorophyll', 'sandrush', 'slushrush', 'quickfeet', 'spicyspray', 'drizzle', 'drought', 'sandstream',
]);
/** Abilities the wrapper refuses as the defender (typing unknown) or attacker. */
export const TYPE_CHANGE = Object.freeze({ protean: 'defender', libero: 'defender', mimicry: 'both' });
export const TRANSFORMS = Object.freeze(['imposter']);
/** Abilities that change the attacker or the field during a multi-hit move in ways the engine does not follow. */
export const MID_HIT_DEFENDER = Object.freeze({
  spicyspray: (mv) => mv.category === 'Physical', // sim: burns the attacker on hit 1; later physical hits are halved
  mummy: (mv) => mv.flags.includes('contact'), lingeringaroma: (mv) => mv.flags.includes('contact'), wanderingspirit: (mv) => mv.flags.includes('contact'),
});
/** Intimidate receivers (sim-verified table). Blockers keep the stage; others per rule. */
export const INTIMIDATE_BLOCKERS = Object.freeze(['innerfocus', 'owntempo', 'oblivious', 'scrappy', 'clearbody', 'hypercutter', 'whitesmoke', 'fullmetalbody']);
/** Abilities with an on/off activation the user states (engine abilityOn); default off, always shown as a chip. */
export const ACTIVATION = Object.freeze({ flashfire: 'flashfire-active', stakeout: 'stakeout-target-switched-in', plus: 'plus-minus-ally', minus: 'plus-minus-ally', electromorphosis: 'charged' });
/** Abilities whose effect the engine computes from raw turn order; the wrapper reconciles it with the stated order. */
export const TURN_ORDER_ABILITIES = Object.freeze(['analytic']);
/** Weather/terrain healing or chip between turns that the KO model does not include (repeated-use odds refused). */
export const BETWEEN_TURN_UNMODELLED = Object.freeze({
  raindish: 'Rain', dryskin: 'Rain|Sun', icebody: 'Snow', solarpower: 'Sun', poisonheal: '*', moody: '*', seedsower: '*', sandspit: '*',
  stamina: 'physical', weakarmor: 'physical', speedboost: null,
});
/** Items that change damage across hits or turns in ways the KO model refuses. */
export const ITEM_BETWEEN = Object.freeze({ oranberry: 'oran-berry', focusband: 'focus-band' });

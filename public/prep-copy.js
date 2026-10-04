// Prep wording: the one reviewed list of strings the Prep screens show. Codes from lib/ map to plain words here; nothing
// is copied from research files. Rules (checked by test/prep-copy.test.mjs): no "guaranteed", "safe", "always" (except
// "every roll"), "beats", "counters", "wins", "loses to", "legal in your league", "they will" or "best lead"; numbers are
// "k of 16" natural frequencies; league rules you haven't confirmed are worded conditionally. Values are plain text; the
// renderer escapes them.

export const STAT_SHORT = { hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' };
export const STAT_LONG = { hp: 'HP', atk: 'Attack', def: 'Defense', spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed' };

// ---------- sources, roles, kinds ----------
export const SOURCE = {
  'sheet-open': 'On their sheet', 'seen-vs-me': 'Seen vs you', 'seen-vs-others': 'Seen vs others', ladder: 'Ladder',
  'my-guess': 'Your guess', 'counterprep-guess': 'Counter-prep guess', fixed: 'Only ability',
};
export const SOURCE_HELP = {
  'sheet-open': 'Shown on their open team sheet.', 'seen-vs-me': 'Seen in a game against you.', 'seen-vs-others': 'Seen in their games against other coaches.',
  ladder: 'From public ladder data, not their set.', 'my-guess': 'Your guess.', 'counterprep-guess': 'Something they could add after studying your 10.', fixed: 'The species has only this ability.',
};
export const VARIANT_ROLE = { likely: 'Likely', 'worst-plausible': 'Worst for me', counterprep: 'Counter-prep', idea: 'Idea' };
export const VARIANT_ROLE_HELP = {
  likely: 'Their likely sets: ladder guesses replaced by anything seen.',
  'worst-plausible': 'The likely sets changed on the one or two things that hurt you most. Check survival against this.',
  counterprep: 'What they might add after studying your 10: moves and items their mons can use in Reg M-C. Could, not will.',
  idea: 'An extra version to test an idea. Keep it if it changes one of your decisions.',
};
export const PLAN_KIND = { likely: 'Likely plan', alt: 'Other plan', counterprep: 'They prepped against me', idea: 'Idea' };
export const SPEED_MODE = { tailwind: 'Tailwind', 'trick-room': 'Trick Room', priority: 'Priority moves', none: 'No speed control', unknown: 'Speed control: not sure' };
export const FIELD = { '': 'No weather or terrain', sun: 'Sun', rain: 'Rain', sand: 'Sand', snow: 'Snow', 'psychic-terrain': 'Psychic Terrain', 'electric-terrain': 'Electric Terrain', 'grassy-terrain': 'Grassy Terrain', 'misty-terrain': 'Misty Terrain' };
export const CARD_KIND = { plan: 'Plan card', 'bo3-won-g1': 'If I win game 1', 'bo3-lost-g1': 'If I lose game 1' };
export const RUNG = { 'not-yet': 'not yet', 'thought-through': 'thought through', checked: 'checked', rehearsed: 'rehearsed', 'rehearsed-broadly': 'rehearsed broadly' };
export const RUNG_HELP = 'Rungs: not yet → thought through (a card exists) → checked (key calcs and Speed) → rehearsed (mock games played like them) → rehearsed broadly (2+ versions or partners and 2+ leads). Not a score.';

// ---------- rules profile ----------
export const RULES = {
  matchLength: { q: 'Match length', options: { bo3: 'Best of three', bo1: 'Single game', bo5: 'Best of five', unknown: "Don't know" } },
  disclosure: { q: 'Team sheets', options: { closed: 'Closed', 'open-at-preview': 'Open at preview', 'exchanged-in-advance': 'Sent before the match', partial: 'Partly', unknown: "Don't know" },
    help: 'With open sheets they see your moves, items, abilities and natures at team preview (never Stat Points). With closed sheets they see species only.' },
  sixPerMatch: { q: 'Your 6 per match', options: { 'pick-6-each-match': 'Pick 6 each match', 'six-per-game': '6 per game', 'whole-ten': 'Whole 10', unknown: "Don't know" } },
  setLockWithinBo3: { q: 'Same sets all set?', options: { locked: 'Yes', 'can-change': 'Can change', unknown: "Don't know" }, help: "Showdown's best-of-3 keeps the same team for every game." },
  platform: { q: 'Where you play', options: { showdown: 'Showdown', 'in-game': 'In-game', both: 'Both', unknown: "Don't know" } },
  itemClause: { q: 'Item clause', options: { on: 'On', off: 'Off', unknown: "Don't know" }, help: 'Reg M-C standard is one of each item. Showdown mocks enforce it either way.' },
  bringPick: { q: 'Bring / pick', options: { '6-4': '6 / 4', other: 'Something else', unknown: "Don't know" }, help: 'Reg M-C standard is bring 6, pick 4.' },
  replaysPublic: { q: 'Replays public?', options: { yes: 'Yes', no: 'No', unknown: "Don't know" } },
  notesDuringSet: { q: 'Notes during a set', options: { allowed: 'Allowed', 'between-games': 'Between games only', 'not-allowed': 'Not allowed', unknown: "Don't know" } },
  rosterChanges: { q: 'Trades or free agency', options: { none: 'None', trades: 'Trades', 'free-agency': 'Free agency', unknown: "Don't know" } },
};
export const RULES_MAIN = ['matchLength', 'disclosure', 'sixPerMatch', 'platform', 'itemClause'];
export const RULES_MORE = ['setLockWithinBo3', 'bringPick', 'replaysPublic', 'notesDuringSet', 'rosterChanges'];
export const GAME_RULES = 'Game rules (not league settings): one Mega Evolution per battle · Level 50 · Stat Points: 66 in total, at most 32 in one stat.';

// ---------- prep path ----------
export const STEP = {
  0: { title: 'Rules', help: 'What your league has told you.' },
  1: { title: 'Their plans', help: 'What could they be trying to do? Two likely plans plus one where they prepped against you are a good start.' },
  2: { title: 'Through their eyes', help: 'What they could bring against your 10. Could, not will.' },
  3: { title: 'Your 6', help: 'The 6 you are thinking of bringing.' },
  4: { title: 'Plan cards', help: 'Your 4, your lead, turn 1 and a few if-then lines per plan (three cover most leads), plus two cards for game 2.' },
  5: { title: 'Speed check', help: 'Who moves first in the pairs that decide turn 1.' },
  6: { title: 'Key calcs', help: 'The few numbers that decide this match, checked against their worst-for-you sets.' },
  7: { title: 'Mocks + premortem', help: 'Practice with a purpose; one line on how you could lose.' },
};
export const START_HERE = 'Start here';
export const START_HERE_RECHECK = 'Start here: re-check your out-of-date calcs';
export const CANT_KNOW = "Can't know before the match: their real sets and Stat Points, which 6 and 4 they bring, how they lead.";
export const PREMORTEM_Q = 'Imagine you lost this set 0–2. What is the most likely reason?';
export const EYES_Q = 'If you were them, what would you bring against you?';
export const COULD_NOT_WILL = 'could, not will';

// ---------- safeguard flags (at most three shown) ----------
export const FLAG = {
  F1: () => 'Tested against one version of their team only.',
  F2: () => 'Every mock started with the same lead from them.',
  F4: (p = {}) => `${p.here ? 'This calc' : 'A calc'} assumes no Intimidate; they can have it.`,
  F5: () => 'A calc marked fine was checked against their usual set, not the one that hurts most.',
  F6: () => "The weather in a key calc isn't the weather that plan sets up.",
  F7: (p) => `${p.count} Speed comparison${p.count === 1 ? ' uses' : 's use'} a guessed Speed for them.`,
  F9: () => "Most practice games weren't played like the real opponent.",
  F11: (p) => `Your team changed since ${p.count === 1 ? 'one calc was' : `${p.count} calcs were`} checked.`,
  F12: () => 'Their roster changed; re-check their plans.',
  F14: () => "You haven't looked at what they might prep against you.",
  F15: (p) => `No plan yet if they Mega Evolve ${p.name}.`,
  F16: (p) => `Depends on a league rule you haven't confirmed: ${p.rule}.`,
  F19: () => 'A mock used a Showdown format that shows different team info than you meant to practise.',
  F20: () => "Your partner's paste wasn't checked against the brief's numbers; it may not match.",
};
export const FLAG_ACTION = { F11: 'Re-check', F12: 'Review roster', F14: 'Open step 2', F15: 'Add a plan', F16: 'Rules', F19: 'Open mock', F20: 'Open mock', F4: 'Open calc', F5: 'Open calc', F6: 'Open calc', F7: 'Speed', F1: 'Practice', F2: 'Practice', F9: 'Practice' };

// ---------- calc results ----------
export const CLASS = { exact: '', approx: '≈ Approximation', 'knife-edge': 'Knife-edge', 'needs-state': 'No number yet', refused: 'No number', 'no-damage': 'No damage', status: 'No damage' };
export const FOOTER = 'Showdown mechanics (PS 3 Oct 2026) · calc 0.12.0';
export const SCOPE = 'For this hit, under these conditions; not a prediction of the turn.';
export const KNIFE = '1 HP from the line: rounding order or a slightly different spread can flip this.';
export const ENVELOPE_HEAD = 'depending on their investment (Stat Points unknown)';
export const ENVELOPE_ROW = { frail: 'frail', common: 'common', max: 'max' };
export const NOT_A_DISTRIBUTION = (rows) => `${rows === 2 ? 'Two example investments (least, most)' : 'Three example investments (least, typical, most)'}, not odds. Lines below the table are for max investment.`;

export const REFUSE = {
  'species-not-in-regulation': (p) => `${p.name} isn't in the Reg M-C list. Pick another Pokémon.`,
  'item-not-in-regulation': (p) => `${p.name ? `${p.name}'s item` : 'This item'} isn't available in Champions; Showdown would reject it. Choice Scarf and Life Orb are available.`,
  'mega-stone-mismatch': () => "That Mega Stone belongs to another Pokémon. Change the item.",
  'ability-missing': () => 'Choose an ability for this set first.',
  'ability-not-legal': () => "That ability isn't available to this Pokémon in Reg M-C.",
  'nature-missing': () => 'Choose a nature for this set first.',
  'move-not-in-regulation': () => "This move isn't available in Champions.",
  'move-not-learnable': (p) => `${p.name || 'This Pokémon'} can't learn that move in Champions.`,
  'set-invalid': () => 'This set has a problem (moves). Fix the set to calculate.',
  'sp-out-of-range': () => 'The set has too many Stat Points in one stat or in total. Open the set to see the limits and fix it.',
  'sp-unknown': () => 'Their Stat Points are unknown. The range view shows frail, common and max investment.',
  'move-missing': () => 'Choose a move.',
  'move-unsupported': (p) => ({ 'beat-up': "Beat Up isn't modelled. Test it in a mock.", 'damage-taken': 'This move returns damage it took; there is no fixed number. Test it in a mock.', 'ohko-move': 'A one-hit-KO move depends on accuracy, not damage.', stockpile: "Spit Up isn't modelled.", 'target-hp-fraction': "Super Fang takes half the target's current HP (no roll); Endeavor cuts it down to the user's HP. No calc needed." }[p.reason] ?? "This move isn't modelled."),
  'mechanic-unsupported:transform': () => "Transform-style abilities aren't modelled. Change the ability to calculate.",
  'mechanic-unsupported:type-change': () => "This ability changes the Pokémon's type during battle, which the calculator can't follow. Change the ability to calculate.",
  'mechanic-unsupported:intimidate-flowerveil': () => "Flower Veil with Intimidate isn't covered by the checked rules. Set Intimidate to none to calculate.",
  'mechanic-unsupported:spicy-spray-multihit': () => 'Spicy Spray burns the attacker on the first hit, so later hits are weaker in ways the calculator skips. You can calculate the first hit only.',
  'mechanic-unsupported:ability-change-multihit': () => "The first contact changes the attacker's ability, which the calculator can't follow for later hits. You can calculate the first hit only.",
  'mechanic-unsupported:gem-multihit': () => "A Gem is used up on the first hit; the calculator doesn't follow that. You can calculate the first hit only.",
  'mechanic-unsupported:pb-item-change': () => "The defender's item changes after the first hit (berry eaten or knocked off). You can calculate the first hit only.",
  'mechanic-unsupported:expanding-force-lone-target': () => "Expanding Force with one target left in Psychic Terrain isn't modelled.",
  'mechanic-unsupported:speed-cap': () => "This move's power uses Speeds above the calculator's limit. Lower the Speed boosts to calculate.",
  'input-invalid:hits': () => "That number of hits isn't possible for this move.",
  'species-missing-in-calc': () => "The calculator doesn't have this form.",
  'engine-error': () => "The calculator couldn't run this case. Change one input and try again.",
  'engine-zero': () => 'The calculator returned no damage here for a reason it could not explain, so no number is shown.',
  'engine-stat-mismatch': () => "The calculator's stats disagreed with the app's, so no number is shown.",
};
export const NO_DAMAGE = {
  'immune-type': 'No damage: the target is immune to this type.',
  'immune-ability': "No damage: the target's ability blocks this move.",
  'immune-air-balloon': 'No damage: Air Balloon (Ground moves miss until it pops).',
  'immune-psychic-terrain': 'No damage: Psychic Terrain blocks priority moves on grounded targets.',
  protected: 'No damage: Protect blocks this move.',
  'move-fails': 'No damage: the move fails in this situation.',
  'blocked-priority-partner': "No damage: the target's partner blocks priority moves (Armor Tail, Dazzling or Queenly Majesty).",
  'status-move': 'This is a status move: no damage.',
};
export const FIX = { 'first-hit-only': 'Calculate the first hit only', 'change-ability': 'Change the ability', 'set-field': 'Change the field', 'change-item': 'Change the item' };

export const QUESTION = {
  faintedAllies: (p) => (p.reason === 'supremeoverlord' ? 'Supreme Overlord counts the allies that had fainted when it came in. How many?' : 'Last Respects grows stronger for each fainted ally. How many of its side have fainted?'),
  timesHit: () => 'Rage Fist grows stronger each time the user was hit since it switched in. How many hits?',
  form: () => 'Has Palafin switched out and back in (Hero Form)?',
};
export const FORM_OPTION = { zero: 'Not yet (Zero Form)', hero: 'Yes (Hero Form)' };

/** Assumption chips (always visible when they apply). names: {attacker, defender} display names. */
export function chipText(c, names = {}) {
  const who = c.side ? names[c.side] ?? c.side : '';
  switch (c.code) {
    case 'spread': return c.value === 'all' ? 'Spread move: hits both foes and your ally (×0.75)' : 'Spread move: hits both foes (×0.75)';
    case 'lone-target': return 'Only one target left: full power';
    case 'stage': return `${who} ${STAT_SHORT[c.stat]} ${c.value > 0 ? '+' : '−'}${Math.abs(c.value)}`;
    case 'as-mega': return `${who} as ${c.value} (after Mega Evolution)`;
    case 'not-mega-yet': return `${who} before Mega Evolving`;
    case 'aegislash-blade-attacking': return 'Aegislash attacks in Blade Forme';
    case 'aegislash-shield': return "Aegislash in Shield Forme (hasn't attacked yet)";
    case 'aegislash-blade': return 'Aegislash in Blade Forme (attacked earlier)';
    case 'palafin-zero': return 'Palafin in Zero Form'; case 'palafin-hero': return 'Palafin in Hero Form';
    case 'morpeko-fullbelly': return 'Morpeko in Full Belly Mode (Aura Wheel is Electric)'; case 'morpeko-hangry': return 'Morpeko in Hangry Mode (Aura Wheel is Dark)';
    case 'traced': return `${who} traced ${c.value}`; case 'traced-none': return `${who}'s Trace copied an ability that doesn't change damage`;
    case 'protean-first-move': return `${c.value}: first move since switching in (its type matches the move)`;
    case 'protean-used': return `${who}'s type change already used`;
    case 'item-used': return `${who}'s ${c.value} already used`;
    case 'white-herb-used': return `${who}'s White Herb restored the drop (used up)`;
    case 'state-faintedAllies': return `${c.value} fainted on its side`;
    case 'state-timesHit': return `Hit ${c.value} time${c.value === 1 ? '' : 's'} since switching in`;
    case 'cond-movesLast': return c.value ? 'Moves after the target' : 'Moves before the target';
    case 'cond-hitFirstThisTurn': return c.value ? 'Was hit first this turn' : 'Not hit first this turn';
    case 'cond-lastMoveFailed': return c.value ? 'Its last move failed (double power)' : 'Its last move worked';
    case 'cond-fickleDouble': return c.value ? 'Double power this time (30% chance)' : 'Normal power (30% chance of double)';
    case 'cond-targetAlreadyHit': return c.value ? 'Target already hit this turn' : 'Target not hit yet this turn';
    case 'activation-flashfire': return c.value ? 'Flash Fire activated' : 'Flash Fire not activated';
    case 'activation-stakeout': return c.value ? 'Target just switched in (Stakeout)' : 'Target was already in';
    case 'activation-plus': case 'activation-minus': return c.value ? 'Ally has Plus or Minus' : 'No Plus or Minus ally';
    case 'activation-electromorphosis': return c.value ? 'Charged (Electromorphosis)' : 'Not charged';
    case 'dragon-darts-split': return 'Dragon Darts hits each foe once';
    case 'dragon-darts-both': return 'Dragon Darts hits this target twice';
    case 'hits-pinned': return `Exactly ${c.value} hits`;
    case 'all-hits-land': return `Every hit lands (each hit can miss)`;
    case 'first-hit-only': return 'First hit only';
    case 'through-protect': return 'Through Protect at ¼';
    case 'speed-based-bp': return `Power from Speeds ${String(c.value).replace('/', ' vs ')}`;
    case 'disguise-intact': return "Mimikyu's Disguise intact: the first hit only breaks it (¹⁄₈ of its HP)";
    case 'disguise-broken': return "Mimikyu's Disguise already broken";
    case 'disguise-ignored': return 'Mold Breaker ignores Disguise';
    case 'move-not-in-set': return "Move isn't in this set (testing what it could learn)";
    case 'weather': return { Sun: 'Sun', Rain: 'Rain', Sand: 'Sandstorm', Snow: 'Snow' }[c.value];
    case 'terrain': return `${c.value} Terrain`;
    case 'helping-hand': return 'Helping Hand'; case 'charge': return 'Charged';
    case 'steely-spirit': return 'Ally Steely Spirit'; case 'reflect': return 'Reflect'; case 'light-screen': return 'Light Screen';
    case 'aurora-veil': return 'Aurora Veil'; case 'friend-guard': return 'Ally Friend Guard'; case 'gravity': return 'Gravity';
    case 'fairy-aura': return 'Fairy Aura on the field'; case 'magic-room': return 'Magic Room'; case 'wonder-room': return 'Wonder Room';
    case 'status': return `${who} ${{ brn: 'burned', par: 'paralysed', psn: 'poisoned', tox: 'badly poisoned', slp: 'asleep', frz: 'frozen' }[c.value]}`;
    case 'hp-band': return `${who} shows ${c.value}% HP (${c.lo}–${c.hi} HP; ${c.hi} used)`;
    case 'items-off': return `${who}'s item has no effect (Magic Room or Klutz)`;
    case 'unnerve-berry': return "Unnerve: the target can't eat its berry";
    case 'sitrus-already-eaten': return 'Sitrus Berry already eaten (it is at half HP or less)';
    case 'intimidate-twice': return 'Two Intimidates counted';
    case 'intimidate-before-mega': return 'Intimidate before Mega Evolution: its new ability reacts after';
    case 'breaks-protect': return 'Breaks through Protect';
    case 'crit': return 'Critical hit';
    case 'sitrus-counted': return 'Sitrus Berry counted between hits';
    case 'sash-counted': return 'Focus Sash counted (full HP)';
    case 'sturdy-counted': return 'Sturdy counted (full HP)';
    case 'resist-berry': return `${c.value} halves the first hit`;
    case 'leftovers-between-turns': return `Leftovers between turns (+${c.value} HP)`;
    default: return c.code;
  }
}
export const APPLIED = {
  'intimidate-table': 'Intimidate stages from the checked table', 'lone-target-spread': 'Single target: no spread reduction',
  'moldbreaker-friendguard': 'Mold Breaker ignores Friend Guard', 'protect-bypass-order': 'The ¼ through Protect applied in Showdown order',
  'ironball-grounded': 'Iron Ball / Gravity grounds it: Ground moves hit', 'fairy-aura-field': 'Fairy Aura from another Pokémon',
  'disguise-chip': 'Disguise turns the first hit into a fixed chip', 'bp-ragefist': 'Rage Fist power from hits taken', 'bp-lastrespects': 'Last Respects power from fainted allies',
  'aegislash-blade-attacking': 'Aegislash attacks in Blade Forme',
};
export const NOT_COUNTED = {
  accuracy: (p) => `misses (${p.value}% accurate)`, secondary: 'added effects (flinch, burn, stat drops)', 'after-hit': 'anything after the hit (recoil, items, abilities)', 'focus-band': 'Focus Band (10% chance to hang on)',
};
export const NOTE = {
  'use-first-turn': 'Only works on its first turn on the field.', 'use-target-attacks': 'Fails unless the target is using an attack.', 'use-target-priority': 'Fails unless the target is using a priority move.',
  'use-not-hit-first': 'Fails if the user is hit first this turn.', 'use-charges': 'Charges on the first turn unless the weather or an item skips it.', 'use-semi-invulnerable': 'Two turns: off the field on the first.',
  'use-delayed': 'Lands two turns later.', 'use-needs-terrain': 'Fails without terrain.', 'use-needs-item': "Fails if the target has no item.", 'use-needs-berry': 'Needs a berry eaten first.', 'use-locked': 'Locks the user in for a few turns.',
  'metronome-first-use': "Metronome's boost for repeated use isn't counted.",
};
export const REPEAT_REFUSED = {
  'between-turns:grassy-heal': 'Grassy Terrain heals between turns, which this calculator skips.',
  'between-turns:weather-chip': 'Sandstorm damage between turns is skipped by this calculator.',
  'between-turns:status-chip': 'Status damage between turns is skipped by this calculator.',
  'between-turns:ability': "Its ability changes things between turns, which this calculator skips.",
  'between-turns:oran-berry': "Oran Berry healing isn't modelled.", 'between-hits:oran-berry': "Oran Berry healing between hits isn't modelled.",
  'changes-after-use:gem': 'The Gem is used up on the first use.',
  'changes-after-use:charge': 'Charge only boosts the next Electric move.', 'changes-after-use:one-turn-boost': 'That boost only lasts for one use.',  'between-turns:spicy-spray': 'Spicy Spray burns the attacker, so later uses are weaker.',
  'between-turns:berry-ability': 'Its ability changes how its berry works between turns.', 'between-hits:berry-ability': 'Its ability changes how its berry works between hits.',
  'between-turns:focus-band': 'Focus Band can leave it at 1 HP (10%).',
  'changes-after-use:self-drop': 'Its power drops after each use.', 'changes-after-use:self-boost': 'Its power changes after each use.',
  'changes-after-use:state-changes': 'Its power depends on the battle state, which changes between turns.', 'changes-after-use:loses-type': 'The user loses a type after using it.',
  'changes-after-use:removes-item': "The target's item is gone after the first use.", 'changes-after-use:residual': 'It adds damage each turn, which this calculator skips.',
  'changes-after-use:target-hp': "Its damage depends on the target's current HP.", 'changes-after-use:user-hp': "Its power depends on the user's HP, which can change.",
  'changes-after-use:user-faints': 'The user faints when using it.', 'changes-after-use:first-turn-only': 'It only works on the first turn.',
  'changes-after-use:attacker-ability': "The attacker's ability changes things between turns.", 'not-computed': '',
};
export const TIER = { sim: 'checked against the simulator', source: 'from the calculator and Showdown source (not separately simulated)' };

// ---------- staleness ----------
export const STALE = {
  'set-edited': (p) => `Out of date: ${p.name} changed (v${p.from} → v${p.to}).`,
  'engine-changed': () => 'Out of date: the calculator was updated.',
  'data-changed': () => "Out of date: Showdown's data for something in this calc changed.",
  'legality-changed': () => 'No number: something in this calc is no longer available in Reg M-C.',
  'regulation-changed': () => 'Out of date: this calc was checked for another regulation.',
  'set-deleted': (p) => `Uses a deleted set (${p.name}); showing the inputs it was saved with.`,
  'unknown-pins': () => 'Out of date: saved by an older version.',
};
export const OUTCOME_CHANGED = 'Outcome changed';

// ---------- practice ----------
export const FIDELITY = { 1: 'Play the plan', 2: 'Copy their habits', 3: 'Adapt between games', S: 'Stress: play to win' };
export const CONDITION = { closed: 'Closed sheets', 'open-at-preview': 'Open at preview', 'exchanged-in-advance': 'Sent before the match' };
export const PARTNER_IN_LEAGUE = { yes: 'Yes', no: 'No', unsure: 'Not sure' };
export const TAG = { misplay: 'I misplayed', 'knowledge-gap': "I didn't know something", structural: 'No good option', dice: 'Dice: crit, miss, paralysis', 'partner-off-script': 'Partner off-script', unclear: 'Not sure' };
export const MECHANISM = { speed: 'Speed / Trick Room', 'unexpected-ko': "A KO I didn't expect", 'fakeout-redirect': 'Fake Out / redirection', 'setup-mega': 'Setup or Mega', 'weather-terrain': 'Weather / terrain', other: 'Something else' };
export const SEVERITY = { critical: 'Critical', major: 'Major', minor: 'Minor' };
export const SEVERITY_HELP = 'Critical: loses the set if the real opponent finds it. Major: loses games in a common branch. Minor: costs tempo or HP.';
export const CONFIDENCE = { none: 'none (off-script games only)', low: 'low', medium: 'medium', high: 'high' };
export const CONFIDENCE_RULE = {
  'off-script-only': 'Only games where your partner went off-script.', once: 'Seen once, and not yet confirmed by a calc or Speed check.', 'no-games': 'Not seen in a game yet.',
  'once-confirmed': 'The mechanism is written down and a calc or Speed check confirms it.', 'repeated-varied': 'Seen in 2+ games with different versions or partners, mechanism written down.',
  'repeated-same-setup': 'Seen in 2+ games with the same version and partner (could be a partner habit).', 'repeated-unclear': 'Seen in 2+ games, mechanism not written down.',
};
export const FINDING_STATUS = { open: 'Open', accepted: 'Change planned', retest: 'Retesting', fixed: 'Fixed', rejected: 'Rejected' };
export const RECORD_NOTE = 'Too few games to judge the matchup; use findings instead.';
export const GUARD = {
  'split-structural': 'Make this a separate revision and test them one at a time?', 'one-unclear-game': 'This is based on one unclear game.',
  hunch: 'No finding linked: saved as a hunch.', 'late-change': 'Big change right before the match; was it tested?',
};
export const DEBRIEF_Q = {
  purpose: 'Purpose met?', deciding: 'Deciding turn of each game', partner: "Partner's view (ask them)", scared: 'What scared you most?', change: 'What would you change as them?',
  opposite: 'Why might this finding be wrong?', next: 'Next action', f13: "What's one way the real opponent differs from your partner?",
};
export const BETWEEN_GAMES_Q = ['Did they bring their best answer to you?', 'What would you change if you were them?', 'Did you show anything you did not need to?'];
export const TENDENCY = 'After a win, opponents often change their lead; after a loss they may repeat it (a weak tendency).';
export const ETIQUETTE = ['Play the brief, not to win; say so when you break from it.', "Keep their prep private, especially from anyone in their league.", 'Give feedback only if asked: why something happened, not just what.'];

// ---------- paste review ----------
export const PASTE_TIER = { 0: '✓', 1: '✗ can\'t import as written', 2: '⇄ convert?', 3: '? check this', 4: '~ changed' };
export const PASTE = {
  ok: () => '', 'kept-cosmetic': () => 'Kept for Showdown',
  'species-unknown': (p) => `"${p.typed}" isn't a Pokémon Showdown knows.`, 'species-fuzzy': (p) => `"${p.typed}" isn't an exact name. Did you mean one of these?`,
  'species-not-in-regulation': () => "Not in the Reg M-C list.", 'not-on-roster': () => "Not on this coach's roster.",
  'not-on-my-roster': () => "Not on your roster on the league sheet. Add it to My sets anyway?", skipped: () => 'Skipped.',
  'nickname-brackets': (p) => `Showdown would read "${p.psReads}" as the species because of the brackets.`, 'nickname-is-species': () => 'Nickname equals the species: treated as no nickname.',
  'gendered-forme': () => "Showdown turns a female (F) mark into the male forme here, which has different stats and abilities.",
  'item-not-in-regulation': (p) => `"${p.typed}" isn't available in Champions; Showdown would reject the set.`, 'item-dropped': () => 'Item removed.',
  'mega-wrong-stone': (p) => p.ps, 'mega-stone-mismatch': () => 'That Mega Stone belongs to another Pokémon.', 'mega-normalized': () => 'Saved as the base Pokémon holding its Mega Stone (it Mega Evolves in battle).',
  'ability-unknown': () => "Unknown ability.", 'ability-not-legal': (p) => p.ps, 'ability-is-mega': () => "That is the Mega's ability; write its normal ability.", 'ability-replaced': () => 'Ability changed as you chose.',
  'ability-missing': () => 'No ability line: choose one.', 'only-ability': () => 'Only one possible ability.',
  'level-to-50': (p) => `Level ${p.value} → 50 (Champions battles are Level 50).`, 'dropped-tera': () => 'Tera Type dropped (no Terastallization in Champions).',
  'dropped-line': () => 'Line dropped (not used in Champions).', 'dropped-ivs': () => 'IVs line removed (Champions has no IVs).',
  'ivs-not-31': (p) => `${p.ps} IVs don't exist in Champions; remove the line.`,
  'second-ev-line': () => 'A second EVs line: Showdown uses only one.', 'sps-line': () => 'Showdown ignores this line, so the set would get 0 Stat Points. Read it as the Stat Points line?',
  'sps-line-conflict': () => 'There is also an EVs line; this line is ignored.',
  'token-skipped': (p) => `Showdown would skip "${p.token}".`, 'token-alias': (p) => `Showdown would skip "${p.token}". Read it as ${STAT_SHORT[p.stat]}?`,
  'token-spacing': (p) => `Showdown would skip "${p.token}" (spacing). Read it as ${STAT_SHORT[p.stat]}?`, 'token-removed': () => 'Removed.',
  'stat-repeated': () => 'A stat appears twice; the last value is used.', 'value-not-integer': (p) => `"${p.token}" isn't a whole number (Showdown would accept it silently as nothing). Remove it?`,
  'spd-token': () => "Showdown reads 'Spd' as Speed and 'SpD' as Sp. Def. Which did you mean?",
  'sp-negative': () => 'Stat Points below zero.',
  'sp-over-stat': (p) => p.ps, 'sp-over-total': (p) => p.ps, 'zero-sp-note': () => '0 Stat Points with a non-Serious nature: Showdown accepts this. Check it is intended.', 'legacy-evs': () => 'These look like regular-game EVs, not Stat Points. Convert with the standard rule?',
  'legacy-evs-kept': () => 'Kept as typed: over the Stat Point limits, so it can\'t import.', 'evs-over-limit': () => 'Even converted, these are over 66 Stat Points.',
  'nature-unknown': () => 'Unknown nature.', 'nature-defaulted': () => 'No nature line: saved as Hardy (neutral, like Showdown).',
  'zero-sp': (p) => `This set has 0 Stat Points. Showdown accepts that only with a non-Serious nature${p?.note ? '; exported as Hardy' : ''}. Intended?`,
  'unknown-line': () => 'Showdown would ignore this line.',
  'move-not-in-regulation': (p) => p.ps, 'move-not-learnable': (p) => p.ps, 'move-duplicate': () => 'Same move twice.', 'moves-too-many': () => 'More than 4 moves.', 'moves-empty': () => 'No moves.',
};
export const PASTE_OPTION = {
  drop: 'Drop it', keep: 'Keep', convert: 'Convert', ignore: 'Ignore', read: 'Read it as Stat Points', accept: 'Read it', remove: 'Remove the line',
  spe: 'Speed (as Showdown reads it)', spd: 'Sp. Def', none: 'None of these', add: 'Add it to My sets', skip: 'Skip this one',
};
/** Option wording that depends on the question (the same option id means different things). */
export const PASTE_OPTION_FOR = {
  evs: { convert: 'Convert to Stat Points', keep: "Keep as typed (can't import)" },
  nickname: { keep: 'Keep (brackets removed on export)', drop: 'Drop the nickname' },
  'zero-sp': { keep: 'Use Hardy (0 Stat Points kept)' },
};
export const PASTE_REJECT = {
  'paste-too-long': 'This paste is too long. Paste one team at a time.', 'paste-empty': 'Paste a team first.', 'paste-json': 'This looks like JSON; paste the text export instead.',
  'paste-packed': "This looks like Showdown's packed format; use Export in the teambuilder for the text format.", 'paste-link': "Links aren't fetched. Open the link, copy the team text and paste it here.",
  'paste-too-many': 'More than 6 sets: paste one team at a time.',
};
export const TEAM_WARNING = {
  'species-clause': () => "Two Pokémon with the same Pokédex number: Showdown's Reg M-C format would reject this (Species Clause). Your league: don't know.",
  'item-clause': (p) => `Item clause: two ${p.name}. Reg M-C standard is one of each item; your league: don't know. Showdown mocks enforce it.`,
  'nickname-clause': () => 'Two Pokémon share a nickname; Showdown requires different nicknames.',
  'two-mega-stones': () => 'More than one Mega Stone: only one can Mega Evolve per battle (game rule).',
  'other-format': (p) => `Made for another format (${p.value}): moves, items and stats may differ in Champions.`,
};
export const EXPORT_WARN = {
  'unknown-sp': (p) => `${p.count} set${p.count === 1 ? ' has' : 's have'} unknown Stat Points: exported with the spread chosen below.`,
  'guessed-fields': (p) => `${p.count} set${p.count === 1 ? ' includes' : 's include'} guessed fields. Showdown plays them exactly as written.`,
  'no-set': (p) => `${p.name} has no set yet: left out.`, 'invalid': (p) => (p.missing ? `${p.name} is missing ${p.missing}: left out until it's filled in.` : `Fix ${p.name} first: it breaks Reg M-C checks.`),
  'serious-to-hardy': () => 'A set with 0 Stat Points is exported with Hardy (Showdown rejects Serious with 0).',
};

// ---------- storage / backup ----------
export const SAVE = {
  saved: 'Saved', saving: 'Saving…', quota: "Couldn't save on this device: browser storage is full. Your latest changes exist only in this tab.",
  error: "Couldn't save on this device. Your latest changes exist only in this tab.", conflict: (p) => `${p.what} changed in another tab. Reload it to keep editing.`,
  newer: 'This prep was saved by a newer version of Drafarig. Editing is off so nothing gets damaged.', invalid: "Couldn't save: something in this change isn't valid.",
  corrupt: 'Some prep on this device couldn\'t be read. Nothing was deleted.',
};
export const BACKUP = {
  intro: 'Your prep is saved only in this browser on this device. Browsers can clear it. A backup file is the only copy that survives that.',
  why: 'Safari deletes a site\'s data after 7 days of using Safari without opening the site; any browser can clear it when space is low, and clearing browsing data removes it. Private windows forget it when closed. Prep saved under one web address isn\'t visible under another.',
  protectButton: 'Ask this browser to keep it', protected: 'Protected from automatic clearing (you can still delete it).', notProtected: 'May be cleared automatically.',
  protectHelp: 'Some browsers ask you first; others decide on their own. Backups work the same either way.',
  ios: 'On iPhone, Safari and a Home Screen app keep separate data: back up in one, restore in the other.',
  share: 'Anything you send through email or a chat app passes through that service.',
  privateNote: 'Contains all your prep. Don\'t send it to league coaches.',
  errors: { 'too-large': 'This file is too large to be a Drafarig backup.', 'not-json': "This isn't a complete backup (it may be cut off).", 'not-backup': "This isn't a Drafarig prep backup.",
    'unexpected-field': "This backup has fields Drafarig doesn't expect; it was not restored.", 'forbidden-key': 'This backup contains unsafe data; it was not restored.',
    'newer-schema': 'This backup was made by a newer Drafarig. Reload to update, then restore.', checksum: "This backup was changed or damaged after it was made (checksum doesn't match).",
    'invalid-doc': 'Part of this backup is damaged; nothing was restored.' },
};

// ---------- glossary additions (def ≤ 2 sentences + why) ----------
export const GLOSSARY_PREP = {
  Premortem: { def: 'Before the match, imagine you lost it 0–2 and write the most likely reason in one line.', why: 'Naming how you could lose points at what to test in a mock before it happens for real.' },
  'Pilot card': { def: "A card for playing someone else's opponent in their mock: the team, how to play it and the setup, kept apart from your own prep.", why: 'Helping a friend practise shouldn\'t mix their opponent into your league prep.' },
  Set:{ def: 'One version of a Pokémon: item, ability, nature, moves and Stat Points. You can keep several per Pokémon.', why: 'Calcs and Speed depend on the set, so a guess here flows into every number.' },
  'Source (of a field)': { def: 'Where a detail of their set comes from: on their sheet, seen vs you, seen vs others, ladder data, your guess, or a counter-prep guess.', why: 'A number built on a ladder guess is only as good as the guess.' },
  'Their plan': { def: 'A short guess at what their team is trying to do: who, which Mega, how it controls Speed, what it needs.', why: 'Prepping a few plans, including "they prepped against me", goes further than prepping all 10 Pokémon equally.' },
  'Worst for me': { def: 'Their likely set changed on the one or two things that hurt you most.', why: 'Check survival against this, not their usual set.' },
  'Counter-prep': { def: 'What they might add after studying your 10, often a move their Pokémon can learn rather than one it usually runs.', why: 'Draft opponents prep against you too; could, not will.' },
  'Range (their investment)': { def: 'Their result from least to most invested, because their Stat Points are unknown.', why: "If the answer changes inside the range, you don't know it yet." },
  'Knife-edge': { def: 'A result within 1 HP of the KO line.', why: "Small rounding differences can flip it; don't rely on it." },
  'How closely (mock)': { def: 'How faithfully your partner plays the opponent: the plan, their habits, adapting between games, or playing to win.', why: 'Practice transfers best when it resembles the real opponent.' },
  'Damage roll': { def: 'Every hit does one of 16 equally likely damage amounts.', why: '"6 of 16 rolls KO" means about a third of the time, not every time.' },
  'Out of date (calc)': { def: 'Something the calc used has changed since it was checked: a set, the calculator, its data or the regulation.', why: 'The old number may be wrong; re-check before relying on it.' },
  'No number': { def: "The calculator can't model something in this calc, so it shows no number.", why: 'Test it in a mock instead of guessing.' },
  'Speed range': { def: "The lowest to highest Speed a Pokémon can have when you don't know its set.", why: 'If your Pokémon is inside their range, who moves first depends on their set.' },
  Mock: { def: "A practice game against a friend playing your opponent's team.", why: "It's only as good as how much it plays like them; vary their sets between games." },
  Finding: { def: 'One thing a game taught you, with how many games showed it.', why: 'One game can be luck; test a change before the match.' },
  Reveal: { def: 'Something a game showed: a move, item, ability, Mega or lead.', why: 'In best of three, both of you learn from game 1.' },
  'If-then line': { def: 'A plan for turn 1: if they lead X and Y, you lead A and B and do this.', why: 'Deciding in advance is faster and steadier than deciding under the timer.' },
  'Team sheets (open / closed)': { def: "Open: both players see each other's 6 with moves, items, abilities and natures at team preview. Closed: only species.", why: "Your league's rule isn't confirmed, so the app shows both where they differ." },
  'OHKO / 2HKO': { def: 'Knocked out in one hit / in two hits.', why: 'Two hits in doubles can come from two attackers in the same turn.' },
  'Stat stage': { def: 'A temporary boost or drop from +6 to −6 (Intimidate is −1 Attack).', why: 'Each stage changes damage a lot; Intimidate is the most common one.' },
  'Speed tie': { def: 'Equal Speed: who moves first is a coin flip each turn.', why: 'A tie is not a plan; one more Stat Point can settle it.' },
  'Prep coverage': { def: 'What you have checked for each of their plans, in words: not yet, thought through, checked, rehearsed, rehearsed broadly.', why: 'It shows weak spots honestly; it is not a score.' },
};

// ---------- misc ----------
export const HOME = {
  whose: (name) => `${name}'s prep`, isThisYou: 'Is this you?', choose: 'Prep for a match', chooseHelp: 'Pick an opponent. Everything you add stays in this browser on this device: not on the league sheet, not on Drafarig\'s server.',
  how: ['Their 10 are public. Their 6, sets and leads aren\'t.', 'Save the few numbers that decide games.', 'Mock with a friend; log what decided each game.', 'Change one thing, then test it again.', 'On match day, note what each side has revealed.'],
  savedLocal: 'Saved on this device only.', notStarted: 'Not started',
};
export const NOT_ON_DEVICE = "This link points to prep that isn't saved in this browser. Prep is saved per device and per browser. To move it, use Backup on the other device and Restore here.";
export const TOO_FEW = RECORD_NOTE;

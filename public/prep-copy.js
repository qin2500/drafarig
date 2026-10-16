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
export const FLAG_ACTION = { F11: 'Re-check', F12: 'Review roster', F14: 'Through their eyes', F15: 'Add a plan', F16: 'Rules', F19: 'Open mock', F20: 'Open mock', F4: 'Open calc', F5: 'Open calc', F6: 'Open calc', F7: 'Speed', F1: 'Practice', F2: 'Practice', F9: 'Practice' };

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
  'Speed creep': { def: 'Putting just enough Speed into a Pokémon to move before a common Speed: one point past it, not the maximum.', why: 'Every Stat Point not needed for Speed can go into bulk or damage. A tie is a coin flip, never "faster".' },
  Benchmark: { def: 'A result a spread is built to reach: outspeed X, KO Y with every roll, survive Z. In Champions each Stat Point adds exactly 1 to the stat, so each benchmark is crossed at one exact value.', why: 'If an investment reaches no benchmark you can name, it may do more somewhere else.' },
  Slack: { def: 'The Stat Points you have above what a benchmark needs.', why: 'Slack on one benchmark is room for another: bulk, Speed or a different KO.' },
  'Trial option': { def: 'A changed copy of your set shown next to the current one in Compare options. It is not saved until you press Save as a new version.', why: 'You see what a change costs and gains before your set, and the calcs that use it, change.' },
  'Setup move (+1/+2)': { def: 'A move that raises your own stats, like Nasty Plot (+2 Sp. Atk) or Calm Mind (+1 Sp. Atk, +1 Sp. Def). +1 and +2 are the stat stages.', why: 'It needs a free turn and a move slot; Encore, redirection, Haze, Clear Smog, Unaware and Imposter work against it.' },
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
  whose: (name) => `${name}'s prep`, isThisYou: 'Is this you?', choose: 'Prep for a match', chooseHelp: 'Pick an opponent. Your prep stays in this browser on this device: not on the league sheet, not on Drafarig\'s server. Chat messages you send are the exception (see the chat panel).',
  how: ['Their 10 are public. Their 6, sets and leads aren\'t.', 'Save the few numbers that decide games.', 'Mock with a friend; log what decided each game.', 'Change one thing, then test it again.', 'On match day, note what each side has revealed.'],
  savedLocal: 'Saved on this device only.', notStarted: 'Not started',
};
export const NOT_ON_DEVICE = "This link points to prep that isn't saved in this browser. Prep is saved per device and per browser. To move it, use Backup on the other device and Restore here.";
export const TOO_FEW = RECORD_NOTE;

// ---------- Battle Prep: perspective and ownership ----------
// Never says who the user is: a perspective is "Preparing as X" with where X comes from. Earlier saved prep is only ever
// tied to a coach by the user, one workspace at a time, with its facts shown.
export const POV = {
  group: 'Perspective', who: 'Who are you preparing as?', choose: 'Prepare as another coach', preparing: 'Preparing as', you: '✓ you', change: 'Change',
  source: { setting: 'from your Draft coach setting', default: "from Draft's default coach", url: 'chosen here', identity: '' },
  viewingAs: (n) => `Viewing as ${n}: not your side.`, backTo: (n) => `Back to ${n}`,
  unknownSeat: "That seat isn't on the league sheet now. Choose a coach.",
  identityGone: (n) => `Your saved identity "${n}" isn't on the sheet now. Choose who you are preparing as.`,
  unassignedHead: (n) => `Saved before perspectives (${n})`,
  unassignedHelp: "Saved before Battle Prep knew whose side it was. Each one stays nobody's until you review it and say whose it is.",
  otherHead: (n) => `Saved as other coaches (${n})`, review: 'Review whose prep this is', earlierChip: 'earlier prep to review',
  earlierHere: (o) => `You also have earlier prep vs ${o} that isn't tied to a coach yet.`,
  unassignedBanner: 'Saved before perspectives and not tied to a coach yet, so it is read-only here. Say whose prep it is to edit it.',
  assignFirst: 'This prep was saved before perspectives: say whose it is first (Review whose prep this is).',
  ownerHead: (o) => `Whose prep vs ${o} is this?`,
  ownerIntro: "This prep was saved before Battle Prep had perspectives, so it isn't tied to a coach. Check the facts below, then say whose it is. Nothing changes until you do.",
  evOpp: (o, m, n, now) => `Opponent: ${o}. Its saved copy of their roster shares ${m} of its ${n} Pokémon with their ${now} on the sheet now.`,
  evDates: (c, u, md) => `Started ${c || 'unknown'}, last changed ${u || 'unknown'}${md ? `, match date ${md}` : ''}.`,
  evCounts: (c) => `${c.theirSets} of their sets, ${c.calcs} calcs, ${c.plans} plans, ${c.cards} plan cards, ${c.mockGames} mock games, ${c.matches} matches.`,
  evSix: (names) => `Its 6: ${names}.`, evNoSix: 'No 6 chosen in it.',
  evYours: (names) => `"Your" Pokémon it uses anywhere (6, plan cards, calcs, mocks, matches): ${names}.`, evNoYours: 'It uses none of "your" Pokémon yet.',
  ownerQuestion: 'Whose prep is it?', ownerChoose: 'Choose a coach…',
  fitUnknown: (p) => `It uses none of "your" Pokémon, so nothing in it shows whether it is ${p}'s. Only say yes if you know.`,
  fitWarn: (p, names) => `Not on ${p}'s roster now: ${names}. This may be another coach's prep.`,
  fitOk: (p, names) => `The Pokémon it uses as "yours" (${names}) are all on ${p}'s roster now.`,
  assign: (p, o) => `Yes, this is ${p}'s prep vs ${o}`, notNow: 'Not now',
  assignHelp: 'You can undo this right after, or unassign it later from this screen. Once it belongs to a coach, an older Drafarig still open in another tab shows prep read-only instead of editing it.',
  ownedBy: (p, o) => `This is ${p}'s prep vs ${o}.`, assignedOn: (d) => `You assigned it from earlier prep on ${d}.`,
  unassign: 'Unassign (back to "saved before perspectives")', unassignHelp: "Use this if it wasn't this coach's prep.",
  assigned: (p, o) => `Now ${p}'s prep vs ${o}`, unassigned: (o) => `Prep vs ${o} is unassigned again`,
  savedAs: (p) => `Saved as ${p}'s prep`,
  mineBlocked: (p) => `My sets is your own library, so it isn't changed while you view as ${p}.`,
  mineViewing: (p) => `Viewing as ${p}: your own sets (My sets) aren't listed or changed here.`,
  seatsMoved: (p, o) => `The league sheet's seats changed: still showing ${p} vs ${o}.`,
  vaultGroup: 'Recover earlier prep',
  vaultText: (p, o, t, gone) => `${gone ? 'An older Drafarig tab removed' : 'An older Drafarig tab replaced'} ${p}'s prep vs ${o}. A copy saved at ${t} was kept on this device. Changes made after that aren't in it. If you have a newer backup file, restore that instead.`,
  vaultRecover: 'Recover it', vaultDiscard: 'Discard the copy', vaultDone: (p, o) => `${p}'s prep vs ${o} is back`, vaultDropped: 'Copy discarded',
  vaultDoneNoCopy: (p, o) => `${p}'s prep vs ${o} is back, but its new recovery copy didn't fit on this device`,
  copyGroup: 'Recovery copy not kept',
  copyFailed: (p, o) => `Couldn't keep a recovery copy of ${p}'s prep vs ${o}: this device's storage is nearly full. The prep itself is saved; a backup file keeps it safe from older Drafarig tabs.`,
  copyRetry: 'Try the copy again',
  draftGroup: 'Unsaved draft', draftAsk: 'Replace it with the new check?',
  draftCalc: (a, d) => `You have an unsaved quick check (${a} → ${d}).`, draftThreshold: 'You have an unsaved "What would it take?" question.',
};

// ---------- Battle Prep: the matchup briefing ----------
// Type pressure is not damage; Speed ranges are not a turn order; "could" is learnable, "ladder" is other players' habits.
// No percentages, outcome words or verdicts. Mechanics notes are Showdown behaviour (the game itself is unverified).
export const BRIEF = {
  appName: 'Battle Prep', overview: 'Overview', overviewHead: (p) => `Battle Prep as ${p}`, nextMatch: 'Next match', openBriefing: 'Open the briefing',
  toolsHead: 'Tools', stripNext: 'next', stripPlayed: 'played', allOpponents: (n) => `All ${n} opponents…`, jumpLabel: 'Go to an opponent',
  sheetLoading: 'Reading the league sheet… Opponents appear when it loads; your saved prep is below.',
  sheetFailed: "The league sheet didn't load, so opponents can't be listed. Your saved prep is below.",
  sheetFailedSeat: "Can't show this briefing: the league sheet hasn't loaded, so this seat is unknown. Your saved prep is in Battle Prep.",
  nothingSaved: 'Nothing saved for this matchup yet: the briefing is worked out each time from the league sheet.',
  startHelp: (p, o) => `Nothing is saved for ${p} vs ${o} yet. Starting saves prep on this device only.`,
  start: (p, o) => `Start ${p}'s prep vs ${o}`,
  unsavedDot: { calcs: 'unsaved quick check', sets: 'unsaved set or paste', practice: 'unsaved practice draft' },
  heroDrafted: (n) => `${n}/10 drafted`, heroOpen: (n, m) => `${n} open pick${n === 1 ? '' : 's'}${m !== null ? ` (up to ${m} pts each)` : ''}`,
  heroSheet: (t) => `sheet ${t}`, heroStale: (t) => `sheet unreachable: data from ${t}`, notStarted: 'Not started',
  savedCounts: (w) => `${w.theirSets.length} sets · ${w.calcs.length} calcs`, outOfDate: (n) => `${n} out of date`,
  next: 'Next match', flip: (o) => `See it from ${o}'s side`, viewAs: 'Their draft board', wsPick: 'Saved prep',
  rosterChanged: 'Roster changed since you saved prep',
  // sections
  yourTen: 'Your pool',
  keyLine: 'Key:', layer: { known: 'known', prior: 'ladder', possible: 'could', saved: 'your set', seen: 'seen', 'known-if-mega': 'known (as Mega)' },
  layerHelp: { known: 'From the league sheet and game data (typing, base stats, forced abilities).', prior: 'Other players on the ladder, not this league.', possible: 'Legal and learnable in Reg M-C: could, not will.', saved: 'From a set you saved.' },
  lookFirst: 'Look at these first', lookFirstSub: 'By type and Speed, not damage-checked.',
  lookFirstExplain: 'Ordered by checkable reasons: their attacking types against yours, Speed at any investment, the plans they set up, Mega options. Tap Calc to check real damage.',
  lookFirstKey: 'look first (numbered)', watchKey: 'watch: also worth a look', more: 'More', noPlans: 'No common team pattern fits their pool yet.', noMyPlans: 'No common team pattern fits your pool yet.',
  tellKey: 'preview tell: if it isn\'t in their 6, that plan is off',
  ringLabel: (n) => `look first, ${n} of 3`, watchLabel: 'watch', megaLabel: 'Mega comes with this pick', openSlot: (m) => `Open pick${m !== null ? `, up to ${m} pts` : ''}`,
  hitsHard: 'Super effective on these (by type)', takesIt: 'These resist both its attacking types', none: 'none',
  theirPlans: 'Their likely game plans', theirPlansSub: 'From common team patterns, not their sheet.',
  theirPlansExplain: 'Each plan comes from the public Cores rules run on their drafted pool. "Likely" = its moves are common on the ladder; "possible" = only learnable. "You" is your listed answers in those rules, not a matchup result.',
  confidence: { likely: 'Likely', possible: 'Possible' }, you: 'You:', yourAnswers: 'your listed answers',
  status: { has: 'Has answers', thin: 'Thin', none: 'No answer found' }, statusB: (s) => `if team sheets are open: ${s}`,
  tells: 'Preview tells (if these aren\'t in their 6, this plan is off):', morePlans: (n) => `${n} more plan${n === 1 ? '' : 's'}`,
  cofail: (type, names) => `Their ${type} attacks hit ${names}, so these answers can fall together.`,
  speedHead: 'Who moves first', speedLegend: 'Scenario',
  scenario: { none: 'No speed control', 'tw-mine': 'Your Tailwind', 'tw-theirs': 'Their Tailwind', tr: 'Trick Room' },
  scenarioOff: { 'tw-mine': 'No Tailwind user in your pool', 'tw-theirs': 'No Tailwind user in their pool', tr: 'No Trick Room user in either pool' },
  setters: (names) => `set by ${names}`,
  assumptions: 'Level 50 · theirs: 0–32 Stat Points with a −/+ Speed nature (tick: 32, neutral) · yours: the same range until you save a set, then exact · no Speed items.', spTerm: 'Stat Points?',
  scenarioNote: { 'tw-mine': 'Your Tailwind doubles yours.', 'tw-theirs': 'Their Tailwind doubles theirs.', tr: 'Trick Room: slower moves first, so the list is turned over.' },
  showAll: (n) => `Show all ${n}`, showFewer: 'Show the ones that matter', compareHelp: 'Tap two to compare.',
  verdict: {
    first: (a, b) => `${a} moves before ${b} at any investment, with no Speed item, in this scenario.`, second: (a, b) => `${b} moves before ${a} at any investment, with no Speed item, in this scenario.`,
    depends: (a, b) => `${a} vs ${b}: overlapping ranges, so it depends on Speed investment.`, tie: (a, b) => `${a} and ${b} tie: random each turn.`,
  },
  needs: (o) => (o.impossible ? `Even 32 Stat Points with +Speed (${o.best.speed}) doesn't clear it.` : `With +Speed, ${o.sp} Stat Points (${o.speed}) clears their highest.`),
  needsTr: (o) => (o.impossible ? `Even 0 Stat Points with −Speed (${o.best.speed}) isn't slower than their lowest.` : `With −Speed, up to ${o.sp} Stat Points (${o.speed}) stays slower than their lowest.`),
  facts: 'Speed facts that change with the field (no Speed items)', scarfCaveat: (n, v) => `unless ${n} holds a Choice Scarf (up to ${v})`,
  priorityHead: 'Moves before Speed order (priority)', priorityFake: 'first turn out only', priorityPrank: "its status moves fail on Dark-types",
  weatherRow: (ab, w, setters) => `if ${ab} in ${w} (set by ${setters})`,
  // Showdown behaviour (probes against the pinned simulator); the game itself may differ.
  mechTailwind: 'Tailwind doubles Speed for 4 turns counting the turn it is used (the rest of that turn and 3 more). A partner that moves later in that same turn is already faster.',
  mechTrickRoom: "Trick Room takes effect as soon as it's used. It has −7 priority, so it's almost always the last move of its turn: slower Pokémon then move first for the next 4 turns (the room lasts 5 turns counting the turn it was used). Priority moves still go first. Using Trick Room again while it's up ends it.",
  mechMega: "Mega Evolution's Speed counts from the turn it Mega Evolves.",
  mechSource: 'Showdown behaviour; the game itself may differ.',
  useful: 'Your mons that look useful here', usefulTag: 'A starting point, not a damage check.',
  usefulSub: (o) => `Chosen from your pool by what each does against ${o}'s: typing, Speed and answers to their plans.`,
  why: 'Why it looks useful', costs: 'What it costs', noCost: 'No cost found from typing and Speed. Check damage in Calcs.',
  addSix: '+ My 6', inSix: 'In My 6', speedBtn: 'Speed', setBtn: 'Set ›', calcBtn: 'Calc', whyBtn: 'Why', theirSetBtn: 'Their sets ›',
  yourPlans: 'Your plans vs what they could do', yourPlansSub: 'could, not will',
  theirListed: { none: 'their listed answers: none found', thin: 'their listed answers: thin', has: 'their listed answers: several' },
  visible: 'They have', couldPrep: 'They could bring (could, not will)', reassure: 'Not a problem for this plan',
  theyCouldAnswer: 'They could answer it:', plusMore: (n) => `+${n} more`, reassureShort: (n) => `${n} of their tools look relevant but aren't (explained inside)`,
  cpDetails: (n) => `What they could bring (${n})`,
  blunted: (names) => `blunted by your ${names}`, unless: { overcoat: 'unless it has Overcoat', stalwart: 'unless it has Stalwart', moldbreaker: 'unless it has Mold Breaker', scrappy: 'unless it has Scrappy', mentalherb: 'unless their setter holds Mental Herb', 'terrain-up-and-target-grounded': 'only while the terrain is up and the target is grounded' },
  hiddenUntilUsed: 'hidden until used with closed team sheets',
  reassureText: { 'tr-tailwind': 'While your Trick Room is up, their Tailwind makes them move later, not sooner. Your room covers the 4 turns after the one you set it; their Tailwind covers the turn they set it plus 3 more, so it can outlast your room.', 'pt-fakeout': 'Their Fake Out fails into your grounded Pokémon while your Psychic Terrain is up (it still hits Flying-types and works before the terrain is set).' },
  leads: 'Pairs to test', leadsSub: 'Ideas to try in practice, with what they share. Not a lead plan.', testIt: 'Test it in practice',
  checks: 'Next checks', checksSub: 'One tap opens the tool with this question set up. Nothing is saved until you save.',
  q: {
    survive: (a, mv, d) => `Does your ${d} take ${a}'s ${mv}?`, ko: (a, mv, d) => `How much does your ${a}'s ${mv} do to ${d}?`,
    speed: (a, b) => `Who moves first: ${a} or ${b}?`, practice: (plan) => `Practise against their ${plan} plan`,
  },
  moveLayer: { prior: 'ladder move', possible: 'learnable move' }, asMega: (f) => `as ${f}`,
  ifMega: 'if it Mega Evolves', ifYouMega: 'if you Mega Evolve', megaNote: 'One Mega per battle; team preview doesn\'t show which of their Megas comes.',
  unsavedCalc: (a, d) => `You have an unsaved quick check (${a} → ${d}).`, openIt: 'Open it', replaceIt: 'Replace it', cancel: 'Cancel',
  tray: 'My 6', trayEmpty: 'Tap "+ My 6" on a mon to shortlist it.', lens: 'Briefing for', lensTen: 'Your pool', lensSix: 'My 6',
  lensSaid: (s) => (s === '6' ? 'Showing the briefing for your 6.' : 'Showing the briefing for your whole pool.'),
  sixRuleUnknown: 'Same 6 for every game of a set: unknown league rule.',
  layerNotice: { 'mech-loading': 'Checking what they can learn…', 'cores-unavailable': "Game plan detection isn't available right now.", 'usage-offline': (d) => `Ladder data: the app's key moves list (${d}). Live ladder numbers are unavailable right now.` },
  openPicks: (o, n) => `${o} has ${n} open pick${n === 1 ? '' : 's'}: the briefing updates as picks come in.`,
  emptyPool: (o) => `${o} hasn't drafted yet: the briefing starts with their first pick.`,
  sectionFailed: "This part couldn't be shown. Your prep is unchanged.",
  back: '‹ Back to the briefing', sheetThem: (n) => `${n}: against your pool`, sheetYou: (n) => `Your ${n}: against their pool`,
  sheetHits: (n) => `${n}'s attacking types are super effective on these (by type)`, sheetWalls: 'These resist its attacking types', sheetFaster: 'Faster than it at any investment (no Speed items)', sheetSlower: 'Slower than it at any investment (no Speed items)',
  sheetLadder: 'Usually runs (ladder, not this league)', sheetCould: 'Could run against your plans (could, not will)', sheetTools: 'Tools', noTools: 'No listed tools.',
  sheetThreatens: 'Your attacking types are super effective on these (by type)', sheetWeakTo: 'Their attacking types are super effective on it (by type)', sheetSets: 'Your saved sets for it', noSets: 'No saved set yet.',
  core: 'Their plan', coreMembers: 'Members', rehearse: 'Rehearse this in practice', anchor: 'anchor', contested: (n) => `contested by their ${n}`,
};
/** Reason chips (look first, useful mons, pairs): code -> words. n(id) gives a display name. */
export const REASON = {
  'stab-se-many': (r) => `Its ${r.types.join('/')} is super effective on ${r.n} of yours (by type)`, 'stab-se-some': (r) => `Its ${r.types.join('/')} is super effective on 2 of yours (by type)`,
  'no-wall': () => 'None of yours resists both its attacking types', 'one-wall': (r, n) => `Only ${n(r.ids[0])} resists both its attacking types`,
  'faster-whatever-spreads': (r) => `Faster than ${r.n} of your ${r.of} at any investment (your Megas included; no Speed items)`,
  'plan-tell': (r) => `Sets up their ${r.label}`, 'plan-unanswered': (r) => `In their ${r.label}, where you have no listed answer`, 'plan-thin': (r) => `In their ${r.label}, where your listed answers are thin`,
  'mega-option': (r) => (r.forms.length > 1 ? `Has ${r.forms.length} Mega options` : 'Can Mega Evolve'),
  'resists-key-stab': (r, n) => `Resists ${r.ids.map(n).join(', ')}'s attacking types`,
  'hits-key-se': (r, n) => `Super effective on ${r.hits.map((h) => `${n(h.id)}${h.megaOnly ? ` (as ${h.form})` : ''}`).join(', ')} (by type)`,
  'answers-their-plan': (r) => `Listed answer to their ${r.plans.map((p) => p.label).join(', ')}`,
  'weak-to-their-stab': (r, n) => `${r.ids.length > 2 ? `${r.ids.length} of theirs are` : `${r.ids.map(n).join(' and ')} ${r.ids.length === 1 ? 'is' : 'are'}`} super effective on it (by type)`,
  'cofailure-victim': (r) => `Falls with other answers to their ${[...new Set(r.items.map((i) => i.type))].join('/')} attacks`,
  'answer-contested': (r, n) => `Its answer to their ${r.items[0].label} is contested by their ${n(r.items[0].by)}`,
  'slower-than-most': (r) => `Slower than ${r.n} of their ${r.of} at any investment (its Megas included; no Speed items)`,
  'pair-covers-key': (r, n) => `Together super effective on ${r.ids.map(n).join(', ')} (by type)`,
  'pair-covers-each-other': (r, n) => `${n(r.items[0].by)} resists the ${r.items[0].type} attacks that are super effective on ${n(r.items[0].protects)}`,
  'pair-in-core': (r) => `Both in your ${r.label}`,
  'pair-shared-weakness': (r) => `Both weak to their ${r.items.map((i) => i.type).join('/')} attacks`,
};

// ---------- League schedule (the sheet's Paring tab) ----------
// The tab lists week numbers, groups, pairs and byes only: no dates, results or current week, so none is ever said.
// "Next match" stays the user's own mark, never derived from the schedule.
export const SCHED = {
  head: (g) => `Your weeks${g ? ` · ${g}` : ''} (from the sheet)`,
  source: (t) => `From the sheet's Paring tab, read ${t} · the sheet has no dates, results or current week`,
  stale: (t) => `⚠ Sheet unreachable: schedule from ${t}`,
  missing: 'Schedule: not in this copy of the sheet.',
  failed: "Schedule couldn't be read from the sheet right now. ⟳ at the top re-reads it.",
  unreadable: "The sheet's Paring tab didn't look like a schedule, so nothing is shown.",
  notListed: (p) => `${p} isn't listed in the schedule.`,
  bye: 'Bye', week: (n) => `Week ${n}`, weeks: (ns) => (ns.length === 1 ? `Week ${ns[0]}` : `Weeks ${ns.slice(0, -1).join(', ')} and ${ns[ns.length - 1]}`),
  tile: (n, o) => `Week ${n}: ${o}. Open the briefing`, tileBye: (n) => `Week ${n}: bye`, tileRaw: (n, raw) => `Week ${n}: ${raw} (not matched to a coach)`,
  unmatched: 'not matched to a coach', marked: 'next (you marked)',
  // the tab pairs coaches within their group for the weeks it lists; nothing is said about other matches
  span: (ns) => (ns.length ? (ns.every((n, i) => i === 0 || n === ns[i - 1] + 1) && ns.length > 1 ? `weeks ${ns[0]}–${ns[ns.length - 1]}` : `week${ns.length > 1 ? 's' : ''} ${ns.join(', ')}`) : 'weeks'),
  notScheduled: (span) => `Not paired with you in the sheet's ${span}`, notScheduledIn: (o, g, span) => `Not paired with you in the sheet's ${span} · ${o} is in ${g} on the sheet`,
};

// ---------- Battle Prep: the Plan board ----------
// Type and Speed pressure and the Cores spec's listed answers only: never "beats", "counters", "wins", "safe", odds or
// percentages. Suggestions order what you tap; the app never picks your 6, lead or Mega.
export const BOARD = {
  theirPlans: 'Their plans', pick: 'Tap one to plan against it',
  kind: { likely: 'Likely', alt: 'Other', counterprep: 'They prepped vs you', idea: 'Idea' },
  suggested: 'suggested', seedWord: 'seed', unsavedNote: 'Not saved yet: your first pick below saves it.',
  seed: { 'seed-trick-room': 'Trick Room possible', 'seed-tailwind': 'Their Tailwind possible', 'seed-sun': 'Sun possible', 'seed-rain': 'Rain possible', 'seed-sand': 'Sand possible', 'seed-snow': 'Snow possible', 'look-first': 'Their look-first mons' },
  seedNote: 'Not one of the common team patterns. Built from their setters (ladder data or a forced ability).',
  lookFirstNote: 'The mons of theirs to look at first, by type and Speed.',
  couldAlso: (what, names) => `Could also: ${what} (${names}, learnable: could, not will)`,
  couldWhat: { 'seed-trick-room': 'Trick Room', 'seed-tailwind': 'Tailwind' },
  addPlan: '+ Their plan', ideas: 'Ideas', edit: 'Edit this plan', noTargets: (o) => `No common team pattern fits ${o}'s pool yet. Add your own plan.`,
  theirSide: 'Their side', yourSide: 'Your side', vs: 'vs', tell: 'preview tell', theirMega: 'their Mega',
  lead: 'Lead', back: 'Back', mega: 'Mega', noMega: 'No Mega', next: 'next', megaOne: 'One Mega per battle.',
  slotEmpty: (role, n) => `${role} ${n}: empty. Pick from your 6`,
  slotFilled: (role, n, name, set) => `${role} ${n}: ${name}${set ? ', set attached' : ', no set yet'}. Change`,
  tapHint: 'Tap your Pokémon below: the first two lead, the next two go in the back.',
  tapHintNoSix: 'First pick your 6 below (tap portraits), then tap them to fill Lead and Back.',
  pickSix: 'Pick your 6: tap portraits from your 10.', pickFromSix: 'Pick from your 6 below.',
  placed: (name, role) => `${name} placed in ${role}`, removed: (name) => `${name} taken off this plan`, full: 'Lead and Back are full: tap a slot to change it.',
  megaWhich: (forms) => `Pick ${forms}`, calcLoading: 'Loading the calculator… try again in a moment.',
  moveBack: 'Move to Back', moveLead: 'Move to Lead', remove: 'Remove', startSet: 'Start a set', openSet: 'Open its set', setAttached: 'set attached', noSet: 'no set yet',
  attachedSay: (name) => `Your ${name} set is attached (your only set for it).`,
  ready: 'Card ready: 2 lead, 2 back', readyHelp: 'A fact about the slots, not a verdict.',
  headline: { has: 'Has listed answers', weaker: 'Has a weaker listed answer', pressures: 'Pressures it by type', walls: 'Takes its hits', none: 'No clear link' },
  headFor: (lead) => `Your lead ${lead}:`, notChecked: 'type and Speed, not damage-checked', checked: 'a calc exists for this pair',
  tryHead: 'Lead ideas from your 6', tryBtn: 'Use as lead', backHead: 'Back ideas', backBtn: 'Use as back', backOpen: (names) => `Not yet hit hard or walled by your lead: ${names}`,
  backAllDone: 'Your lead already hits hard or walls everything listed here (by type). Pick the back for your other plans.',
  needSix: 'Pick 2 or more for your 6 to see lead ideas.',
  glyph: {
    answer: (label, anchor) => `✓ ${label}${anchor ? '' : ' (weaker)'}`, contested: (n) => `contested by ${n}`,
    hitSay: (m, t, form) => `${m} hits ${t} hard by type${form ? ` as ${form}` : ''} (not damage)`, megaMismatch: (form, picked) => `(needs ${form}; you picked ${picked})`,
    wallSay: (m, t) => `${m} takes ${t}'s attacks by type`,
    speed: { first: '⚡▲', second: '⚡▼', depends: '⚡◆', tie: '⚡=' },
    // who moves when (never "faster/slower": under Trick Room the slower one moves first)
    speedSay: { first: (m, t, mode) => `${m} moves before ${t}${mode}`, second: (m, t, mode) => `${m} moves after ${t}${mode}`, depends: (m, t, mode) => `${m} vs ${t}: depends on spreads${mode}`, tie: (m, t, mode) => `${m} and ${t}: coin flip${mode}` },
    speedDepends: (m, ts, mode) => `${m} vs ${ts}: depends on spreads${mode}`,
    mode: { 'trick-room': ' (Trick Room: slower moves first)', tailwind: ' (their Tailwind)', none: '' },
    shared: (t) => `⚠ Both hit hard by ${t}`, twoMegas: '⚠ needs 2 Megas (one per battle)',
  },
  lights: { speed: 'Speed', calcs: 'Calcs', practised: 'Practised' },
  lightSay: { speed: (n, of) => `Speed: ${n} of ${of} looked at`, calcs: (n, of, stale) => `Calcs: ${n} of ${of} run${stale ? `, ${stale} out of date` : ''}`, practised: (n, rung) => `Practised: ${n} game${n === 1 ? '' : 's'} (${rung})` },
  lightNone: 'Pick a lead first', calcsHead: 'Key calcs for this lead', calcAsk: (mine, theirs) => `Does your ${mine} survive their ${theirs}?`, calcOpen: 'Open', calcRun: 'Run it', calcStale: 'out of date',
  six: 'Your 6', sixEdit: 'Change your 6', sixDone: 'Done', sixMore: 'More than 6: a match uses 6.', sixFromSets: 'chosen in Sets',
  sixSay: (n) => `${n} of 6 picked`, sixAdd: (name) => `Add ${name} to your 6`, sixRemove: (name) => `Take ${name} out of your 6`,
  sixAdded: (name) => `${name} added to your 6`, sixRemoved: (name) => `${name} taken out of your 6`,
  coverage: 'What your 6 covers', covSay: { solid: 'covered', outline: 'covered (weaker)', gap: 'not covered' },
  fillGap: 'Fill a gap', gapNone: 'No gaps: each plan here has a listed answer in your 6, and each look-first mon is hit hard or walled by type (not damage-checked).',
  gapFor: (what) => `Gap: ${what}`, gapAdd: (n) => `Add ${n}`, another: 'Another idea', skip: 'Skip this gap',
  gapWhy: { 4: 'listed answer (anchor)', 3: 'listed answer', 2: 'hits it hard or takes its hits, by type', 1: 'hits it hard only as a Mega', 0.5: 'a super-effective type, but a weaker attacker by stats' },
  noCandidate: (n) => `None of your 10 hits ${n} hard or takes its hits by type. Check it with a calc.`,
  freeSwap: (names) => `Your 6 is full. Free to swap (taking it out uncovers nothing): ${names}`,
  notes: 'Notes: turn 1, win condition, if-then lines', editLines: 'Edit if-then lines', ifThen: (lead, resp) => `IF they lead ${lead} → ${resp}`,
  game2: 'Game 2 cards', before: 'Before the match: premortem, date, next', more: 'More',
  otherCards: 'Other cards vs this plan:', orphanCards: 'Cards not linked to a plan:', orphanCard: (lead) => `Card${lead ? ` (${lead})` : ''}`, cardN: (n, lead) => `Card ${n}${lead ? ` (${lead})` : ''}`,
  locked: { earlier: 'Earlier prep: say whose it is to edit it.', newer: 'Saved by a newer Drafarig: read-only here.' },
  sheetWait: 'Suggestions appear when the league sheet loads; your saved plans are below.',
  previewNote: (p, o) => `Nothing is saved for ${p} vs ${o} yet: your first pick starts the prep on this device. Game 2 cards and notes appear then.`,
};

// ---------- Calcs notebook cards (picture first, words always beside it) ----------
export const CALCCARD = {
  envAll: 'KO at every example investment', envNone: 'No KO at any example investment', envSplit: 'Depends on their investment',
  noNumber: 'No number', staleHidden: 'The number is hidden until you re-check.', noKo: 'No KO number for this hit.',
  twoHits: (words) => words, // koWords already says "2 uses …"
  category: { Physical: '⚔ physical', Special: '✦ special' },
  side: { mine: 'your hit', theirs: 'their hit on you' },
  mark: { fine: '✓ Fine', 'not-fine': '✕ Not fine', unsure: '? Unsure' },
};

// ---------- Sets: the team grid ----------
export const SETGRID = {
  field: { item: 'Item', ability: 'Ability', moves: 'Moves', sp: 'Stat Points' }, unknown: 'unknown', yours: 'yours',
  noSet: 'No set', noSetSay: 'no set yet. Make a labelled ladder guess',
  key: 'Ring, clockwise from the top: item, ability, moves, Stat Points. Solid = on a sheet or seen; dashed = ladder; dotted = a guess; missing = unknown.',
  roleIcon: { likely: '●', 'worst-plausible': '▲', counterprep: '⚔', idea: '✎' },
};

// ---------- Practice: the record board (counts, never a rate) ----------
export const PRACTICE = {
  mocks: 'Mock sets', noOpen: 'No open findings',
  pip: { W: 'Won', L: 'Lost', draft: 'Not logged', off: 'Partner off-script' }, pipGlyph: { W: '✓', L: '✕', draft: '○', off: '–' },
  recordLine: (w, l) => `${w} won · ${l} lost (counts only)`, offLine: (n) => `${n} off-script, not counted`,
  mechGlyph: { speed: '⚡', 'unexpected-ko': '✸', 'fakeout-redirect': '✋', 'setup-mega': '⬆', 'weather-terrain': '☀', other: '•' },
};

// ---------- Chat with the VGC agent (public/prep-chat.js) ----------
// Every state is said as it is; nothing pretends to be an answer. "Not connected" whenever the Site's chat isn't set up or
// the agent's relay is offline.
const VIEW_NAME = { overview: 'Overview', brief: 'Brief', plan: 'Plan', sets: 'Sets', calcs: 'Calcs', practice: 'Practice', build: 'Build', other: 'This screen' };
export const CHATUI = {
  open: 'Ask the VGC agent', openHere: 'Ask the VGC agent about this screen', title: 'Chat with the VGC agent', close: 'Close', retry: 'Try again',
  checking: 'Checking chat…', unreachable: "Can't reach Drafarig right now.",
  notSetUp: "Not connected: chat isn't set up yet. Nothing is sent.",
  setup: 'Setting it up', setupHelp: "Chat needs a one-time setup by whoever runs this Site. It starts with your account id on this Site: sign in, then show it here.",
  showId: 'Show my id', yourId: 'Your id on this Site:', yourIdHelp: 'Give it to whoever sets up chat. It identifies your sign-in on this Site only; it is not a password.',
  signIn: 'Sign in with ChatGPT to use chat. It is private to this Site\'s owner.', signInLink: 'Sign in with ChatGPT',
  notYours: 'This chat is private to its owner.',
  storage: "Chat isn't available right now.",
  online: 'Connected: the VGC agent is online.',
  offline: (t) => `Not connected: the VGC agent is offline${t ? ` (last seen ${t})` : ''}. Nothing can be sent until it's back.`,
  empty: 'Ask about the page you have open. The agent sees only the items listed below, not the rest of the screen.',
  sees: 'The agent sees:', seesHelp: 'tap one to leave it out of your next message',
  chipOn: 'included', chipOff: 'left out',
  chip: {
    // the page chip says when a screen's own content isn't attached (a set list, a calc list, Practice)
    page: (p, ctx = {}) => `Page: ${VIEW_NAME[p?.view] ?? 'Battle Prep'}${(p?.view === 'sets' && !ctx.set) || (p?.view === 'calcs' && !ctx.calc) ? ' (nothing open)' : p?.view === 'practice' ? ' (records not included)' : ''}`,
    pov: (p) => (p?.you ? `You: ${p.coach}` : `Preparing as ${p?.coach ?? ''}`),
    opponent: (o) => `Opponent: ${o?.coach ?? ''}${o?.weeks?.length ? ` (W${o.weeks.join('·W')})` : ''}`, schedule: (x) => `League weeks (${x?.weeks?.length ?? 0})${x?.next ? `, you marked ${x.next} next` : ''}`,
    rosters: (r) => (r?.theirs ? 'Both pools' : 'Your pool'), six: (x) => `Your 6 (${x?.length ?? 0})`,
    briefing: (b) => `The brief: top threats, ${b?.plans?.length ?? 0} plans, Speed facts`, plan: (p) => `Plan: ${p?.name ?? ''}`,
    set: (x) => `${x?.side === 'mine' ? 'Your' : 'Their'} set: ${x?.species ?? ''}`, calc: (c) => `Calc: ${c?.attacker ?? ''} → ${c?.defender ?? ''}`,
    rules: () => 'League rules you set', notes: () => 'Your notes',
  },
  includeNotes: 'Include my notes on this page (plan name, premortem, turn 1, win condition, if-then lines)', noNotes: 'No notes on this page to include',
  notesPreview: 'What your notes would send',
  ask: 'Your question', placeholder: 'e.g. What leads into their Tailwind plan?', max: (n) => `up to ${n} characters`,
  send: 'Send', sending: 'Sending…', sent: 'Sent to the agent', typeFirst: 'Type a question first.', oneAtATime: 'One question at a time: wait for the answer or cancel it.',
  cancel: 'Cancel', cancelError: "Couldn't cancel it (it may already be answered).", checkAgain: 'Check again',
  noUpdate: 'No update yet.', noText: "Answered, but the reply couldn't be shown.",
  youSaid: 'You asked:', agentSaid: 'The agent answered:',
  state: { queued: 'Waiting for the agent…', working: 'The agent is answering…', expired: 'Not delivered: the agent was offline.', timeout: 'No reply: it took too long.', cancelled: 'Cancelled.',
    'rate-limited': 'Not answered: too many messages for now.', error: "The agent couldn't answer this one.", declined: "The agent didn't answer this one.", missing: 'This message is gone.' },
  stateSay: { answered: 'The agent answered.', expired: 'Not delivered.', timeout: 'No reply in time.', cancelled: 'Cancelled.', 'rate-limited': 'Too many messages for now.', error: "The agent couldn't answer.", declined: "The agent didn't answer." },
  sendError: { 'relay-offline': 'The agent is offline: nothing was sent.', busy: 'One question at a time: wait for the answer or cancel it.', 'rate-limited': 'Too many messages this hour or today.',
    'bad-context': "This page's details couldn't be attached.", 'chat-not-set-up': "Chat isn't set up yet.", 'sign-in': 'Sign in first.', other: "Couldn't send it." },
  contextTooBig: "This page's details are too large to attach: leave some out (tap them).",
  limits: (h, d) => `Left: ${Math.max(0, h)} this hour, ${Math.max(0, d)} today.`,
  newConv: 'New conversation', newSaid: 'New conversation started', clear: 'Clear this conversation', clearAsk: 'Delete this conversation from the Site?', clearYes: 'Delete it', clearNo: 'Keep it',
  cleared: 'Conversation deleted', clearError: "Couldn't delete it right now.",
  // where chat text goes and how long it's kept, as the code does it (CHAT-SETUP-PROPOSAL.md §9; CHAT-ACTIVATION-REQUIRED.md)
  privacy: "Your messages and the details above go to this Site's private chat store, then to the VGC agent on the Drafarig cloud VM, which asks Claude (Anthropic) through your personal Claude account. The Site deletes them when you clear the conversation, or about 14 days after its last message (the next time chat is opened). The agent's own session history stays on the VM until it's deleted there.",
};

// ---------- Teambuilder: the set editor with the tools on its controls (public/prep-teambuilder.js) ----------
// Marks and the strip say what a number is and under which assumptions; they never say "worth it".
const pctOf = (r) => `${Math.floor((1000 * r.range.min) / r.maxHP) / 10}–${Math.floor((1000 * r.range.max) / r.maxHP) / 10}%`;
export const TB = {
  loadingData: 'Loading the Reg M-C data…', engineFailed: "The calculator didn't load: Speed marks still work. Reload to retry.", spUnknown: 'This set has no Stat Points yet: type them in below or import a Showdown set.',
  problem: (p, n) => ({ 'sp-over-total': `${p.total} of 66 Stat Points: ${p.total - 66} too many.`, 'sp-over-stat': `${STAT_LONG[p.stat]}: 32 is the most one stat can take.`,
    'move-not-learnable': `Can't learn ${n.move(p.value)} in Champions.`, 'ability-not-legal': "That ability isn't available to this Pokémon.", 'nature-missing': 'Choose a nature.',
    'item-not-in-regulation': `${n.item(p.value) || p.value} isn't available in Champions.`, 'moves-empty': 'Add at least one move.', 'move-duplicate': 'The same move twice.' }[p.code] ?? p.code),
  checking: 'Checking against', league: 'Whole league', next: 'next', oneOpp: (c) => `vs ${c}'s 10`, allOpp: (n) => `vs all ${n} opponents`,
  assumptions: (who, month, sun) => `${who} · their sets: saved, else ladder guesses (Smogon${month ? ` ${month}` : ''}, not this league) · their common spread unless stated · Lv 50 · single target (×0.75 when a move hits both) · no crits · Speed: their Lv 50 tiers (max +Spe, neutral max) or their saved set; Scarf, ladder spreads and Tailwind only when ticked · weather: ${sun ? `Auto, ${sun}` : 'none set by you (theirs shown per hit)'} · tap a mark for its calc`,
  noSet: 'no set yet', noItem: 'no item', yourSix: (coach) => `Your 6 vs ${coach}`, noSixHere: 'Your 6: choose them on a matchup\'s Sets tab', rest: 'Rest of your 10', yourTen: 'Your 10',
  move: (i) => `Move ${i + 1}`, moveAria: (i) => `Move ${i + 1}, type to search your learnset`, nick: 'Nickname', item: 'Item', itemAria: 'Item, type to search', ability: 'Ability',
  megaAbility: (f) => `${f} always has this ability`,
  setupNote: (m) => `${m}: no damage. With it in the set, hits and marks also show the boosted stage.`, statusNote: 'Status move: no damage.',
  calculating: 'Calculating…', noWeather: (w) => `no ${w.toLowerCase()}`, someKo: (k) => `${k.num}/${k.den} KO`,
  stripHead: (who, w) => `vs ${who === 'Whole league' ? 'the league\'s most used mons' : `${who}'s mons`} · their common spread · ${w ? `${w} (Auto)` : 'no weather'} · tap the move field again after changing it`,
  seed: { 'speed-to-bulk': (c) => `Speed SP → bulk (${c.n})`, 'damage-item': (c, n) => `+ ${n.item(c.item)}`, setup: (c, n) => `+ ${n.move(c.move)}${c.freed ? `, ${c.freed} SP → bulk` : ''}`, nature: (c, n) => `${n.nature(c.nature)} instead` },
  rank: (name, spe, fn, fp, of, ties) => `${name} Spe ${spe}: outspeeds ${fn} of their ${of} max-neutral tiers, ${fp} of their max-+Spe tiers${ties ? ` (ties ${ties})` : ''}`,
  tier: { 'max-plus': () => 'max +Spe', 'max-neutral': () => 'neutral max', set: () => 'their set', ladder: (l) => `ladder: ${l}` },
  tiers: (name, base, t) => `${name}: base ${base} → max +Spe ${t.maxPlus} · neutral ${t.maxNeutral} · uninvested ${t.uninvested} · min ${t.min}`,
  spdOpts: 'Speed also counts', spdOpt: { scarf: '+ Scarf users', ladder: 'ladder spreads', twTheirs: 'their Tailwind', twMine: 'your Tailwind' },
  pin: 'Pin as A to compare', tryLbl: 'try:', noChange: 'no changes yet', vsA: 'vs A', backToA: 'Back to A', unpin: 'Unpin',
  fasterThan: (a, b) => `outspeeds ${a.fasterNeutral} → ${b.fasterNeutral} of ${b.of} max-neutral, ${a.fasterPlus} → ${b.fasterPlus} max-+Spe tiers`,
  bulk: (a, b) => `bulk ${a.toFixed(2)} → ${b.toFixed(2)} expected OHKOs`, bulkHelp: 'Sum of OHKO odds from every common hit in scope (ladder sets): lower is bulkier.',
  pinned: 'Pinned as A: edit freely, the bar shows what changes. Nothing is saved until you press Save version.', trying: 'Trying it: compare with A above. Not saved.',
  outText: (who, s) => `outspeeds ${who} (${s})`, tieText: (who, s) => `ties ${who} at ${s} (coin flip)`, needs: (x) => `needs ${x}`,
  koText: (uses, move, who, boost) => `${uses === 2 ? '2HKO' : 'OHKO'} ${who} with ${move}${boost ? ` at +${boost}` : ''}, every roll`,
  surviveText: (who, move, pair, S) => `survive ${who}'s ${move} (with ${pair.sp} ${S[pair.stat]})`,
  speedCalc: (nat, sp, v, target, tie, tieAt) => `${nat} ${sp} SP = ${v} ${tie ? '=' : '>'} ${target}${tie ? ': a coin flip each turn' : tieAt !== null && tieAt !== undefined ? ` (${tieAt} SP ties)` : ''}.`,
  koCalc: (move, sp, stat, nat, r, words, spread, w) => `${move} at ${sp} ${stat} (${nat}): ${r.range.min}–${r.range.max} of ${r.maxHP} HP (${pctOf(r)}), ${words}; their spread: ${spread}${w ? `; ${w}` : ''}.`,
  surviveCalc: (hp, d, stat, nat, r, words, spread) => `At ${hp} HP / ${d} ${stat} (${nat}): ${r.range.min}–${r.range.max} of ${r.maxHP} HP (${pctOf(r)}), ${words}; their spread: ${spread}.`,
  reached: 'reached', notReached: 'not reached', notYet: 'not yet', tie: 'tie', koSurvive: 'KO / survive', needsOther: 'needs another nature / item / move',
  base: 'Base stat', spAria: (s) => `${s} Stat Points`, spNumAria: (s) => `${s} Stat Points (number)`, nature: 'Nature',
  over: (n) => `${n} over`, left: (n) => `${n} left`, ofTotal: 'of 66 · max 32 per stat',
  cantBeat: (s, best, who) => `can't beat ${s} (${best} max): ${who}`, cantBeatN: (n, a, b, best) => `can't beat ${n} Speeds, ${a}–${b} (${best} max)`,
  cantKo: (move, who) => `${move}: no OHKO on ${who} at +0 even at 32`, cantSurvive: (who, move) => `${who}'s ${move}: no HP / defence spread survives`,
  seenBy: 'Seen by:', close: 'Close', save: 'Save version', saveCopy: 'Save as a new set', discard: 'Discard', unsaved: 'unsaved changes', saved: (v) => `v${v} saved`,
  io: 'Import / Export', ioHelp: 'Showdown text (Stat Points on the EVs line). Paste a set for this Pokémon and press Import to put it in the editor (not saved yet).',
  importIt: 'Import', copy: 'Copy', current: 'current', useVersion: 'Use this version', history: (n) => `History (${n})`, delete: 'Delete this set',
  started: 'New set started from ladder data: check every field', importNothing: 'Paste a set first.', importFailed: "That text couldn't be read as a set; use Paste your team for the full import.",
  importOther: (name) => `That text is for ${name}; open ${name} first.`, imported: 'Imported into the editor: not saved yet',
  unknownItem: (x) => `"${x}" isn't an item this Pokémon can hold in Champions.`, unknownMove: (x, mon) => `${mon} can't learn "${x}" in Champions.`,
};

// ---------- Teams setup (public/prep.js, lib/prep-teams.mjs) ----------
const plural = (n, one, many) => (n === 1 ? one : many);
export const TEAMS = {
  head: 'Teams',
  blocked: "Your sets are moving into teams, but there isn't room on this device to keep a backup of how they are now. Download one first; then the move happens.",
  blockedBtn: 'Download a backup and set up teams',
  dropped: (n) => `${n} ${plural(n, 'set was', 'sets were')} deleted in another tab or an older version, so ${plural(n, 'it has left its team', 'they have left their teams')}.`,
  status: (n, at, kept) => `Your sets are in ${n} ${plural(n, 'team', 'teams')} (one per matchup's 6) plus "Imported sets", set up ${at}.${kept ? ' A backup of how they were before is kept on this device.' : ''}`,
  undo: 'Undo teams setup', undoYes: 'Undo it',
  undoAsk: (copies, lost) => `Your matchups go back to pointing at your original sets, and the ${copies} ${plural(copies, 'copy', 'copies')} made for them ${plural(copies, 'is', 'are')} removed.${lost.copyVersionsAdded ? ` ${lost.copyVersionsAdded} ${plural(lost.copyVersionsAdded, 'version', 'versions')} saved on copies since would go too.` : ''}${lost.teamsCreatedLater ? ` ${lost.teamsCreatedLater} ${plural(lost.teamsCreatedLater, 'team', 'teams')} made since would go.` : ''} Nothing else changes.`,
  undone: 'Teams setup undone', undoFailed: "Couldn't undo it right now; nothing changed. Try again after a reload.",
  offNow: 'Teams are off on this device (you undid the setup).', redo: 'Set up teams again', redone: 'Teams set up',
};

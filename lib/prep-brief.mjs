// Mock briefs (you → your practice partner) and pilot cards (you play a friend's opponent). Pure; plain text the user
// shares themselves. A brief contains the opponent team as you guess it, the purpose, the Showdown setup that matches the
// information condition, how to play it, a don't-use list and check numbers. It never contains your sets, your 6, plan
// cards, calcs, findings or notes.
import { exportSet } from './paste.mjs';
import { setStats } from './calc/mech.mjs';

export const BRIEF_HEADER = 'Drafarig mock brief v1';
export const FORMATS = Object.freeze({
  draft: { name: '[Gen 9 Champions] 4v4 Doubles Draft', id: 'gen9champions4v4doublesdraft', ots: false },
  vgcBo3: { name: '[Gen 9 Champions] VGC 2026 Reg M-C (Bo3)', id: 'gen9championsvgc2026regmcbo3', ots: true },
});
export const FIDELITY_TEXT = Object.freeze({
  1: 'Play the plan: follow "How to play it" as written.',
  2: 'Copy their habits: follow the plan and the habits listed (leads, Mega choice).',
  3: 'Adapt between games: change leads or targets between games the way they would.',
  S: 'Stress: play this team to win with everything it has.',
});

/** The Showdown setup for an information condition. 'closed' and unknown -> 4v4 Doubles Draft (no team sheets), best of 3 as a challenge option. */
export function setupFor(condition) {
  if (condition === 'open-at-preview' || condition === 'exchanged-in-advance') {
    return { ...FORMATS.vgcBo3, formatString: FORMATS.vgcBo3.id, bestOfOption: false };
  }
  return { ...FORMATS.draft, formatString: `${FORMATS.draft.id}@@@Best of = 3`, bestOfOption: true };
}

/** Check numbers for one set: Speed plus its highest attacking stat (or HP for support sets). */
export function checkNumbers(mech, set) {
  const st = setStats(mech, set, { megaEvolved: false });
  if (!st) return null;
  const key = st.atk >= st.spa ? 'atk' : 'spa';
  const usesKey = set.moves.some((m) => mech.moves[m]?.category === (key === 'atk' ? 'Physical' : 'Special'));
  return { speed: st.spe, stat: usesKey ? key : 'hp', value: usesKey ? st[key] : st.hp };
}

/**
 * Compose a brief. input: { mech, teamName, purpose, condition ('closed'|'open-at-preview'|'exchanged-in-advance'|'unknown'),
 * fidelity, blind, howToPlay:[lines], dontUse:[lines], sets:[{set, label?}] (their side only), spChoice (fn set -> sp for
 * unknown SP), conditionUnknown (league rule unknown) }. Returns { text, setup, warnings }.
 */
export function composeBrief(input) {
  const { mech } = input;
  const setup = setupFor(input.condition);
  const lines = [BRIEF_HEADER, ''];
  const name = (input.teamName || 'Their team').replace(/\s+/g, ' ').trim();
  lines.push(`Team: ${name}`);
  lines.push(`Purpose: ${(input.purpose || 'General practice').replace(/\s+/g, ' ').trim()}`);
  lines.push(`Setup: ${setup.name}${setup.bestOfOption ? ', best of 3 (pick best-of-3 in the challenge if it is offered, or use the typed challenge below)' : ''}`);
  lines.push('This is the closest Showdown setup for this mock, not our league\'s rules.');
  lines.push(setup.ots ? 'This format forces open team sheets: both players see moves, items, abilities and natures at team preview.'
    : 'This format has no team sheets: you only see species at team preview.');
  if (setup.bestOfOption) lines.push(`Typed challenge (check it once): /challenge NAME, ${setup.formatString}`);
  if (input.conditionUnknown) lines.push('Our league\'s team-sheet rule isn\'t confirmed; if it uses open team sheets, use the VGC 2026 Reg M-C (Bo3) format instead.');
  lines.push(`How closely: ${FIDELITY_TEXT[input.fidelity] ?? FIDELITY_TEXT[1]}`);
  if (input.blind) lines.push('Blind: pick one of the versions below without saying which, and keep the same one for the whole set.');
  const how = (input.howToPlay ?? []).map((s) => s.trim()).filter(Boolean);
  if (how.length) { lines.push('How to play it:'); for (const h of how) lines.push(`- ${h}`); }
  const dont = (input.dontUse ?? []).map((s) => s.trim()).filter(Boolean);
  lines.push('Don\'t use:');
  for (const d of dont.length ? dont : ['Anything from earlier mocks that the real opponent couldn\'t know.']) lines.push(`- ${d}`);
  lines.push('Check after importing (the teambuilder should show these; if not, the paste was misread):');
  const warnings = [];
  const pasteParts = [];
  for (const { set, label } of input.sets) {
    // a Pokémon missing from this regulation's data can't be checked or exported: leave it out and say so
    if (!mech.species[set.species]) { warnings.push({ code: 'not-in-data', species: set.species }); continue; }
    const sp = set.sp === 'unknown' ? input.spChoice?.(set) : set.sp;
    if (!sp) { warnings.push({ code: 'no-spread', species: set.species }); continue; }
    const s = { ...set, sp };
    const cn = checkNumbers(mech, s);
    const nm = mech.species[set.species].name;
    if (cn) lines.push(`- ${nm}: Speed ${cn.speed} · ${cn.stat === 'hp' ? 'HP' : cn.stat === 'atk' ? 'Atk' : 'SpA'} ${cn.value}${label ? ` (${label})` : ''}`);
    if (set.sp === 'unknown') warnings.push({ code: 'spread-chosen', species: set.species });
    pasteParts.push(exportSet(s, mech).text);
  }
  // Both setups take exactly 6 Pokémon (each game you pick 4 at team preview); the validator rejects any other count.
  const n = pasteParts.length;
  if (n === TEAM_SIZE) lines.push(`Team: exactly ${TEAM_SIZE} (Showdown checks it); each game you pick ${PICKED} at team preview.`);
  else {
    lines.push(n < TEAM_SIZE ? `The paste has ${n} Pokémon but Showdown needs exactly ${TEAM_SIZE}: add ${TEAM_SIZE - n} more from their roster before you start.`
      : `The paste has ${n} Pokémon but Showdown needs exactly ${TEAM_SIZE}: keep ${TEAM_SIZE} and delete the rest before you start.`);
    warnings.push({ code: 'team-size', count: n });
  }
  lines.push('');
  lines.push('Paste:');
  const text = `${lines.join('\n')}\n${pasteParts.map((p) => `${p}\n`).join('')}`;
  return { text, setup, warnings };
}
/** Team size in both mock setups (pinned Showdown: min = max = 6, picked 4). */
export const TEAM_SIZE = 6, PICKED = 4;

/** Read a brief back (pilot card) or treat the text as a plain paste. */
export function parseBrief(text) {
  const src = String(text ?? '').replace(/\r\n?/g, '\n');
  const lines = src.split('\n');
  if (lines[0].trim() !== BRIEF_HEADER) return { isBrief: false, paste: src };
  const out = { isBrief: true, team: '', purpose: '', setup: '', fidelity: '', howToPlay: [], dontUse: [], paste: '' };
  let section = null;
  for (let i = 1; i < lines.length; i++) {
    const l = lines[i];
    if (l === 'Paste:') { out.paste = lines.slice(i + 1).join('\n'); break; }
    if (l.startsWith('Team: ')) out.team = l.slice(6);
    else if (l.startsWith('Purpose: ')) out.purpose = l.slice(9);
    else if (l.startsWith('Setup: ')) out.setup = l.slice(7);
    else if (l.startsWith('How closely: ')) out.fidelity = l.slice(13);
    else if (l === 'How to play it:') section = 'howToPlay';
    else if (l === "Don't use:") section = 'dontUse';
    else if (l.startsWith('Check after importing')) section = null;
    else if (l.startsWith('- ') && section) out[section].push(l.slice(2));
  }
  return out;
}

export const ETIQUETTE = Object.freeze(['play-the-brief', 'keep-private', 'feedback-if-asked']);

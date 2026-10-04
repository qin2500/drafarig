// Showdown paste import/export for Champions (Reg M-C). Pure; checked against the pinned simulator's own Teams.import /
// exportSet / TeamValidator outcomes (test fixtures). Import is stricter and more talkative than Showdown: Showdown
// silently drops unknown lines (a `SPs:` line leaves 0 Stat Points), accepts NaN, turns "Meowstic (F)" into the male forme
// and reads a nickname with brackets as the species. Every such case becomes a visible decision here.
//
// Tiers per line: 0 ok · 1 reject (can't import as written) · 2 offer conversion · 3 warn and ask · 4 normalize with a note.
// Questions (tiers 2/3, and fixes for some tier-1 lines) are answered through opts.answers[setIndex][key]; a set imports
// only when every question is answered and no tier-1 line is left. The safer option is marked `suggested`, never applied.
import { toID, canLearn, legalAbilities, battleForme } from './calc/mech.mjs';
import { STAT_IDS, STAT_LABEL, STAT_NAME, SP_PER_STAT, SP_TOTAL } from './calc/stats.mjs';
import { matchName, suggest } from './names.mjs';

export const MAX_PASTE_CHARS = 50000;
export const MAX_SETS = 6;
// Showdown species aliases for app forms (each target is checked against the projection in tests).
export const SPECIES_ALIASES = Object.freeze({
  rotomw: 'rotomwash', rotomh: 'rotomheat', rotomf: 'rotomfrost', rotoms: 'rotomfan', rotomc: 'rotommow',
  taurospaldeawater: 'taurospaldeaaqua', taurospaldeafire: 'taurospaldeablaze', taurospaldea: 'taurospaldeacombat',
  meowsticm: 'meowstic', indeedeem: 'indeedee', basculegionm: 'basculegion', lycanrocmidday: 'lycanroc', floette: 'floetteeternal',
});
const FEMALE_FORMES = Object.freeze({ meowstic: 'meowsticf', indeedee: 'indeedeef', basculegion: 'basculegionf' });
// Dex.stats.getID in Showdown: ids, short names and full names; 'Spd' (exact) means Speed.
const STAT_TOKENS = { hp: 'hp', atk: 'atk', def: 'def', spa: 'spa', spd: 'spd', spe: 'spe', attack: 'atk', defense: 'def',
  specialattack: 'spa', specialdefense: 'spd', speed: 'spe', spatk: 'spa', spdef: 'spd' };
// Moves the Reg M-C validator knows but no legal species can learn (Showdown: "X can't learn Y.").
const UNLEARNABLE = Object.freeze({ powershift: 'Power Shift', softboiled: 'Soft-Boiled', spore: 'Spore' });
export const convertEV = (ev) => Math.min(SP_PER_STAT, Math.floor((ev + 4) / 8));

/** Resolve a typed species name to a projection id. Returns {id, how:'exact'|'alias'|'mega'|'rule'} or {fuzzy:[ids]} or {}. */
export function resolveSpecies(mech, raw) {
  const id = toID(raw);
  if (!id) return {};
  if (mech.species[id]) return { id, how: 'exact' };
  if (SPECIES_ALIASES[id] && mech.species[SPECIES_ALIASES[id]]) return { id: SPECIES_ALIASES[id], how: 'alias' };
  const mega = /^mega(.+?)([xyz]?)$/.exec(id);
  if (mega) for (const cand of [`${mega[1]}mega${mega[2]}`, `${mega[1]}${mega[2]}mega`]) if (mech.species[cand]) return { fuzzy: [cand] }; // Showdown rejects "Mega X" names
  const m = matchName(raw, (x) => !!mech.species[x]);
  if (m.id) return { id: m.id, how: 'rule' };
  const ids = Object.keys(mech.species).filter((x) => mech.species[x].legal);
  const s = suggest(raw, ids, 3).filter((x) => x.confidence >= 60).map((x) => x.id);
  return s.length ? { fuzzy: s } : {};
}

function splitBlocks(text) {
  const blocks = [];
  let cur = null, teamName = null, format = null;
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  lines.forEach((raw, n) => {
    const line = raw.trim();
    if (line === '' || line === '---') { cur = null; return; }
    if (line.startsWith('===')) {
      const m = /^===\s*(?:\[([^\]]*)\])?\s*(.*?)\s*===$/.exec(line);
      if (m) { format = m[1] ?? null; teamName = m[2] || null; }
      cur = null;
      return;
    }
    if (!cur) { cur = { lines: [] }; blocks.push(cur); }
    cur.lines.push({ text: line, n });
  });
  return { blocks, teamName, format };
}

/**
 * Parse a pasted team. opts: { mech, side:'mine'|'theirs', allowedSpecies?:Set<outOfBattleId>, answers?:{[i]:{[key]:value}} }.
 * Returns { sets:[{index, lines, set, status, questions, notes}], teamWarnings, teamName, format, rejected? }.
 */
export function parseTeam(text, opts) {
  const { mech } = opts;
  const src = String(text ?? '');
  if (src.length > MAX_PASTE_CHARS) return { rejected: { code: 'paste-too-long' }, sets: [], teamWarnings: [] };
  const trimmed = src.trim();
  if (!trimmed) return { rejected: { code: 'paste-empty' }, sets: [], teamWarnings: [] };
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) return { rejected: { code: 'paste-json' }, sets: [], teamWarnings: [] };
  if (!trimmed.includes('\n') && trimmed.includes('|')) return { rejected: { code: 'paste-packed' }, sets: [], teamWarnings: [] };
  const { blocks, teamName, format } = splitBlocks(src);
  if (/^https?:\/\//i.test(trimmed)) return { rejected: { code: 'paste-link' }, sets: [], teamWarnings: [] };
  if (blocks.length > MAX_SETS) return { rejected: { code: 'paste-too-many', count: blocks.length }, sets: [], teamWarnings: [] };
  const sets = blocks.map((b, i) => parseSet(b.lines, i, { ...opts, answers: opts.answers?.[i] ?? {} }));
  const teamWarnings = [];
  if (format && toID(format) && !toID(format).startsWith('gen9champions')) teamWarnings.push({ code: 'other-format', value: format });
  const ok = sets.filter((s) => s.set);
  const by = (f) => { const m = new Map(); for (const s of ok) { const k = f(s.set); if (k) m.set(k, [...(m.get(k) ?? []), s.index]); } return [...m].filter(([, v]) => v.length > 1); };
  for (const [num, idx] of by((s) => mech.species[s.species]?.num)) teamWarnings.push({ code: 'species-clause', value: num, sets: idx });
  for (const [it, idx] of by((s) => s.item)) teamWarnings.push({ code: 'item-clause', value: it, sets: idx });
  for (const [nick, idx] of by((s) => s.cosmetic.nickname)) teamWarnings.push({ code: 'nickname-clause', value: nick, sets: idx });
  const stones = ok.filter((s) => mech.items[s.set.item]?.megaStone);
  if (stones.length > 1) teamWarnings.push({ code: 'two-mega-stones', count: stones.length });
  return { sets, teamWarnings, teamName, format };
}

function parseSet(rawLines, index, { mech, side = 'theirs', allowedSpecies = null, answers = {} }) {
  const lines = [];
  const questions = [];
  const L = (text, tier, code, extra = {}) => { const r = { text, tier, code, ...extra }; lines.push(r); return r; };
  const ask = (line, key, options, suggested, extra = {}) => {
    const q = { key, options, suggested, ...extra };
    line.question = q;
    q.answer = answers[key];
    if (q.answer === undefined || !options.includes(q.answer)) { q.answer = undefined; questions.push(q); }
    return q.answer;
  };
  const set = { species: '', item: '', ability: '', nature: '', moves: [], sp: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    cosmetic: { nickname: '', gender: '', shiny: false, happiness: null, pokeball: '' } };
  let rejected = false;
  const reject = (text, code, extra) => { rejected = true; return L(text, 1, code, extra); };
  // ---------- species line ----------
  const first = rawLines[0].text;
  let head = first, itemText = null;
  const at = head.indexOf(' @ ');
  if (at >= 0) { itemText = head.slice(at + 3); head = head.slice(0, at); }
  if (head.endsWith(' (M)')) { set.cosmetic.gender = 'M'; head = head.slice(0, -4); } else if (head.endsWith(' (F)')) { set.cosmetic.gender = 'F'; head = head.slice(0, -4); }
  let nickname = '', speciesText = head;
  let headLine = null;
  if (head.endsWith(')') && head.includes('(')) {
    const lastOpen = head.lastIndexOf('(');
    speciesText = head.slice(lastOpen + 1, -1);
    nickname = head.slice(0, lastOpen).trim();
    const psSpecies = head.slice(0, -1).split('(')[1];
    if (head.indexOf('(') !== lastOpen) {
      headLine = L(first, 3, 'nickname-brackets', { psReads: psSpecies.trim() });
      const a = ask(headLine, 'nickname', ['drop', 'keep'], 'drop');
      if (a === 'drop') nickname = '';
      else if (a === 'keep') { nickname = nickname.replace(/[()@]/g, '').trim(); headLine.note = 'brackets-removed'; }
    }
  }
  const sp = resolveSpecies(mech, speciesText);
  let speciesId = sp.id ?? null;
  if (!speciesId && sp.fuzzy) {
    headLine ??= L(first, 3, 'species-fuzzy', { typed: speciesText });
    if (headLine.code !== 'species-fuzzy') headLine = L(first, 3, 'species-fuzzy', { typed: speciesText });
    const a = ask(headLine, 'species', [...sp.fuzzy, 'none'], sp.fuzzy[0]);
    if (a && a !== 'none') speciesId = a; else if (a === 'none') { reject(first, 'species-unknown', { typed: speciesText }); }
  } else if (!speciesId) reject(first, 'species-unknown', { typed: speciesText, ps: `The Pokemon "${toID(speciesText)}" does not exist.` });
  let megaFrom = null;
  if (speciesId && mech.species[speciesId].mega) { megaFrom = speciesId; speciesId = mech.species[speciesId].mega.from; }
  if (speciesId && !mech.species[speciesId].legal) reject(first, 'species-not-in-regulation', { value: speciesId });
  // "Meowstic (F)": Showdown keeps the male forme; ask.
  if (speciesId && set.cosmetic.gender === 'F' && FEMALE_FORMES[speciesId] && !megaFrom) {
    const l = headLine ?? L(first, 3, 'gendered-forme', { female: FEMALE_FORMES[speciesId] });
    if (l.code !== 'gendered-forme') { l.code2 = 'gendered-forme'; }
    const a = ask(l, 'forme', [FEMALE_FORMES[speciesId], speciesId], FEMALE_FORMES[speciesId], { female: FEMALE_FORMES[speciesId], male: speciesId });
    if (a) speciesId = a;
    headLine = l;
  }
  // Their sets must come from their roster; your own library may hold sets for Pokémon you haven't drafted (yet): ask.
  if (speciesId && allowedSpecies && !allowedSpecies.has(speciesId)) {
    if (side === 'mine') { if (ask(L(first, 3, 'not-on-my-roster', { value: speciesId }), 'roster', ['add', 'skip'], 'add') === 'skip') reject(first, 'skipped'); }
    else reject(first, 'not-on-roster', { value: speciesId });
  }
  if (speciesId) set.species = speciesId;
  if (nickname && speciesId && (toID(nickname) === toID(mech.species[speciesId].name) || toID(nickname) === toID(mech.species[speciesId].baseSpecies))) {
    nickname = '';
    if (!headLine) headLine = L(first, 4, 'nickname-is-species');
  }
  set.cosmetic.nickname = nickname;
  // item
  if (itemText !== null) {
    const iid = toID(itemText);
    if (iid && iid !== 'noitem') {
      if (mech.items[iid]) set.item = iid;
      else {
        const l = L(first, 1, 'item-not-in-regulation', { typed: itemText });
        const a = ask(l, 'item', ['drop'], 'drop');
        if (a === 'drop') { l.tier = 4; l.code = 'item-dropped'; } // else: the question stays open
      }
    }
  }
  if (megaFrom) {
    const want = mech.species[megaFrom].mega.item;
    if (set.item !== want) reject(first, 'mega-wrong-stone', { forme: megaFrom, stone: want, ps: `${mech.species[megaFrom].name} transforms in-battle with ${mech.items[want].name}, please fix its item.` });
    else L(first, 4, 'mega-normalized', { forme: megaFrom, base: speciesId, stone: want });
  } else if (speciesId && set.item && mech.items[set.item].megaStone && !mech.items[set.item].megaStone[speciesId]) {
    reject(first, 'mega-stone-mismatch', { value: set.item });
  }
  if (!lines.some((l) => l.text === first)) L(first, 0, 'ok');
  // ---------- other lines ----------
  let evLine = null, spsLine = null, evValues = null, natureSeen = false, levelSeen = false, abilitySeen = false;
  const parseStatLine = (body, line, kind) => {
    const vals = {}, problems = [];
    for (const tok0 of body.split('/')) {
      const tok = tok0.trim();
      const parts = tok.split(' ');
      const m = /^(-?\d+|\S+?)\s+(.+)$/.exec(tok);
      if (!m) { problems.push({ code: 'token-skipped', token: tok }); continue; }
      const [, vtext, name] = m;
      let stat = null;
      if (name === 'Spd') stat = 'spd-ambiguous';
      else stat = STAT_TOKENS[toID(name)] ?? null;
      if (!stat) { problems.push({ code: 'token-skipped', token: tok }); continue; }
      if (/^(Sp\.|Special)/.test(name)) problems.push({ code: 'token-alias', token: tok, stat });
      else if (parts.length !== 2) problems.push({ code: 'token-spacing', token: tok, stat });
      if (!/^-?\d+$/.test(vtext)) { problems.push({ code: 'value-not-integer', token: tok, stat }); continue; }
      const v = parseInt(vtext, 10);
      if (stat in vals) problems.push({ code: 'stat-repeated', token: tok, stat });
      vals[stat] = v;
    }
    return { vals, problems };
  };
  for (const { text } of rawLines.slice(1)) {
    if (text.startsWith('Ability: ') || text.startsWith('Trait: ')) {
      abilitySeen = true;
      const a = toID(text.slice(text.indexOf(':') + 2));
      if (!mech.abilities[a] && !legalAbilities(mech, speciesId ?? '').includes(a)) { reject(text, 'ability-unknown', { typed: text }); continue; }
      if (speciesId && !legalAbilities(mech, speciesId).includes(a)) {
        const forme = megaFrom && mech.species[megaFrom].abilities.map(toID).includes(a);
        const l = L(text, 1, forme ? 'ability-is-mega' : 'ability-not-legal', { value: a, ps: `${mech.species[speciesId].name} can't have ${mech.abilities[a]?.name ?? a}.` });
        const opts2 = legalAbilities(mech, speciesId);
        const ans = ask(l, 'ability', opts2, opts2.length === 1 ? opts2[0] : undefined);
        if (ans) { set.ability = ans; l.tier = 4; l.code = 'ability-replaced'; }
        continue;
      }
      set.ability = a; L(text, 0, 'ok');
    } else if (text.startsWith('Level: ')) {
      levelSeen = true;
      const lv = +text.slice(7);
      L(text, lv === 50 ? 0 : 4, lv === 50 ? 'ok' : 'level-to-50', { value: text.slice(7) });
    } else if (text === 'Shiny: Yes') { set.cosmetic.shiny = true; L(text, 0, 'kept-cosmetic'); }
    else if (text.startsWith('Happiness: ')) {
      const h = +text.slice(11);
      if (Number.isInteger(h) && h >= 0 && h <= 255) { set.cosmetic.happiness = h; L(text, 0, 'kept-cosmetic'); } else L(text, 4, 'dropped-line', { why: 'happiness' });
    } else if (text.startsWith('Pokeball: ')) { set.cosmetic.pokeball = text.slice(10).replace(/[^\w .'-]/g, ''); L(text, 0, 'kept-cosmetic'); }
    else if (text.startsWith('Tera Type: ')) L(text, 4, 'dropped-tera');
    else if (text.startsWith('Hidden Power: ') || text.startsWith('Dynamax Level: ') || text === 'Gigantamax: Yes') L(text, 4, 'dropped-line', { why: 'not-in-champions' });
    else if (text.startsWith('EVs: ')) {
      if (evLine) { const l = L(text, 3, 'second-ev-line'); ask(l, 'second-ev-line', ['ignore'], 'ignore'); continue; }
      evLine = L(text, 0, 'ok');
      evValues = parseStatLine(text.slice(5), evLine, 'ev');
    } else if (/^(SPs|SP|Stat Points|Stat points):/i.test(text)) {
      spsLine = L(text, 3, 'sps-line');
      const ans = ask(spsLine, 'sps-line', ['read', 'ignore'], 'read');
      if (ans === 'read' && !evLine) { evValues = parseStatLine(text.slice(text.indexOf(':') + 1), spsLine, 'sps'); evLine = spsLine; }
      else if (ans === 'read' && evLine) { spsLine.code = 'sps-line-conflict'; }
    } else if (text.startsWith('IVs: ')) {
      const { vals } = parseStatLine(text.slice(5), null, 'iv');
      const all31 = Object.values(vals).every((v) => v === 31);
      if (all31) { L(text, 4, 'dropped-ivs'); continue; }
      const l = L(text, 1, 'ivs-not-31', { ps: `${speciesId ? mech.species[speciesId].baseSpecies : 'This Pokémon'}'s IVs are not maxed out, but this format requires all IVs to be 31.` });
      const ans = ask(l, 'ivs', ['remove'], 'remove');
      if (ans === 'remove') { l.tier = 4; l.code = 'dropped-ivs'; }
    } else if (/^[A-Za-z]+ (N|n)ature/.test(text)) {
      natureSeen = true;
      const n = toID(text.slice(0, text.search(/ (N|n)ature/)));
      if (!mech.natures[n]) reject(text, 'nature-unknown', { typed: text }); else { set.nature = n; L(text, 0, 'ok'); }
    } else if (text.startsWith('-') || text.startsWith('~')) {
      const name = text.slice(text.charAt(1) === ' ' ? 2 : 1).trim();
      if (!name) { L(text, 4, 'dropped-line', { why: 'empty-move' }); continue; }
      const mid = toID(name.replace(/^Hidden Power \[?/, 'hiddenpower'));
      if (!mech.moves[mid] && UNLEARNABLE[mid]) { reject(text, 'move-not-learnable', { value: mid, ps: `${speciesId ? mech.species[speciesId].name : 'This Pokémon'} can't learn ${UNLEARNABLE[mid]}.` }); continue; }
      if (!mech.moves[mid]) { reject(text, 'move-not-in-regulation', { typed: name, ps: `"${name}" isn't available in Champions; Showdown would reject the set.` }); continue; }
      if (speciesId && !canLearn(mech, speciesId, mid)) { reject(text, 'move-not-learnable', { value: mid, ps: `${mech.species[speciesId].name} can't learn ${mech.moves[mid].name}.` }); continue; }
      if (set.moves.includes(mid)) { reject(text, 'move-duplicate', { value: mid }); continue; }
      if (set.moves.length >= 4) { reject(text, 'moves-too-many'); continue; }
      set.moves.push(mid); L(text, 0, 'ok');
    } else {
      const l = L(text, 3, 'unknown-line');
      ask(l, `line:${toID(text).slice(0, 24) || lines.length}`, ['ignore'], 'ignore');
    }
  }
  if (!levelSeen) { /* Showdown's validator sets level 50; nothing to say */ }
  // ---------- Stat Points ----------
  let converted = null;
  if (evValues) {
    const { vals, problems } = evValues;
    for (const p of problems) {
      const l = L(evLine.text, p.code === 'value-not-integer' ? 1 : 3, p.code, { token: p.token, stat: p.stat });
      const key = `ev-token:${toID(p.token)}`;
      if (p.code === 'value-not-integer') {
        if (ask(l, key, ['ignore'], 'ignore') === 'ignore') { l.tier = 4; l.code = 'token-removed'; }
        continue;
      }
      if (p.code === 'token-skipped') ask(l, key, ['ignore'], 'ignore');
      else if (ask(l, key, ['accept', 'ignore'], 'accept') === 'ignore') delete vals[p.stat];
    }
    if ('spd-ambiguous' in vals) {
      const l = lines.find((x) => x.stat === 'spd-ambiguous') ?? L(evLine.text, 3, 'spd-token');
      l.code = 'spd-token';
      const ans = ask(l, 'spd', ['spe', 'spd'], 'spe');
      const v = vals['spd-ambiguous']; delete vals['spd-ambiguous'];
      if (ans) vals[ans] = v;
    }
    const raw = Object.fromEntries(STAT_IDS.map((s) => [s, vals[s] ?? 0]));
    const negative = STAT_IDS.find((s) => raw[s] < 0);
    const total = STAT_IDS.reduce((t, s) => t + raw[s], 0);
    if (negative) reject(evLine.text, 'sp-negative', { stat: negative });
    else if (STAT_IDS.some((s) => raw[s] > SP_PER_STAT) || total > SP_TOTAL) {
      const looksLikeEVs = STAT_IDS.some((s) => raw[s] > 66) || total > 132;
      if (!looksLikeEVs) {
        const nm = speciesId ? mech.species[speciesId].name : 'This Pokémon';
        for (const st of STAT_IDS.filter((x) => raw[x] > SP_PER_STAT)) reject(evLine.text, 'sp-over-stat', { stat: st, ps: `${nm} has more than 32 Stat Points in ${STAT_NAME[st]}.` });
        if (total > SP_TOTAL) reject(evLine.text, 'sp-over-total', { total, ps: `${nm} has ${total} total Stat Points, which is more than this format's limit of 66.` });
      } else {
      const conv = Object.fromEntries(STAT_IDS.map((s) => [s, convertEV(raw[s])]));
      const convTotal = STAT_IDS.reduce((t, s) => t + conv[s], 0);
      const l = L(evLine.text, 2, 'legacy-evs', { before: raw, after: conv, total: convTotal, spare: SP_TOTAL - convTotal });
      const ans = ask(l, 'evs', ['convert', 'keep'], 'convert');
      if (ans === 'convert' && convTotal <= SP_TOTAL) { set.sp = conv; converted = { from: raw }; }
      else if (ans === 'keep' || convTotal > SP_TOTAL) { l.tier = 1; rejected = true; l.code = convTotal > SP_TOTAL ? 'evs-over-limit' : 'legacy-evs-kept'; }
      }
    } else set.sp = raw;
  }
  // Nature and zero-SP checks (Showdown rejects 0 SP with Serious or no nature)
  const pendingSp = questions.some((q) => q.key === 'evs' || q.key === 'sps-line' || q.key === 'spd');
  const zero = !pendingSp && STAT_IDS.every((s) => !set.sp[s]);
  if (!natureSeen) {
    if (!zero) { set.nature = 'hardy'; L('(no nature line)', 4, 'nature-defaulted'); }
  }
  if (zero && speciesId && natureSeen && set.nature && set.nature !== 'serious' && !spsLine) L(evLine ? evLine.text : '(no EVs line)', 4, 'zero-sp-note');
  else if (zero && speciesId) {
    const l = L(evLine ? evLine.text : '(no EVs line)', 3, 'zero-sp');
    const ans = ask(l, 'zero-sp', ['keep'], 'keep');
    if (ans === 'keep' && (!set.nature || set.nature === 'serious')) { set.nature = 'hardy'; l.note = 'serious-to-hardy'; }
  }
  // Ability default: only one legal ability.
  if (speciesId && !set.ability && !abilitySeen) {
    const opts2 = legalAbilities(mech, speciesId);
    if (opts2.length === 1) { set.ability = opts2[0]; L('(no ability line)', 4, 'only-ability', { value: opts2[0] }); }
    else {
      const l = L('(no ability line)', 3, 'ability-missing');
      const ans = ask(l, 'ability', opts2, undefined);
      if (ans) set.ability = ans;
    }
  }
  if (speciesId && !set.moves.length) reject('(no moves)', 'moves-empty');
  const status = rejected ? 'rejected' : questions.length ? 'needs-answer' : 'ready';
  return { index, header: first, lines, questions, status, converted, set: rejected ? null : status === 'ready' ? set : null, draft: set, side };
}

// ---------- export (byte-for-byte what Showdown's exportSet writes for these fields) ----------
const cleanNick = (s) => String(s ?? '').replace(/[()@\n\r|]/g, '').trim().replace(/^[=\-~ ]+/, '').trim();

/**
 * One set in Showdown's export format. set: {species, item, ability, nature, moves, sp, cosmetic}. sp 'unknown' needs
 * opts.sp (an explicit choice). Returns { text, warnings:[codes] }.
 */
export function exportSet(set, mech, opts = {}) {
  const warnings = [];
  const sp = set.sp === 'unknown' ? opts.sp : set.sp;
  if (!sp || sp === 'unknown') throw new Error('exportSet: Stat Points are unknown; choose a spread to export');
  const species = mech.species[set.species];
  if (!species || species.mega) throw new Error('exportSet: not an out-of-battle species');
  const name = species.name;
  const nick = cleanNick(set.cosmetic?.nickname);
  let out = nick && toID(nick) !== toID(name) ? `${nick} (${name})` : name;
  const g = set.cosmetic?.gender;
  if (g === 'M') out += ' (M)';
  if (g === 'F') out += ' (F)';
  // an id this regulation's data doesn't have (an older file, a rule change) is left out with a warning, never guessed
  if (set.item && mech.items[set.item]) out += ` @ ${mech.items[set.item].name}`;
  else if (set.item) warnings.push('unknown-item');
  out += '  \n';
  if (set.ability && mech.abilities[set.ability]) out += `Ability: ${mech.abilities[set.ability].name}  \n`;
  else if (set.ability) warnings.push('unknown-ability');
  out += 'Level: 50  \n';
  if (set.cosmetic?.shiny) out += 'Shiny: Yes  \n';
  if (Number.isInteger(set.cosmetic?.happiness) && set.cosmetic.happiness !== 255) out += `Happiness: ${set.cosmetic.happiness}  \n`;
  if (set.cosmetic?.pokeball) out += `Pokeball: ${set.cosmetic.pokeball}  \n`;
  const evs = STAT_IDS.filter((s) => sp[s]).map((s) => `${sp[s]} ${STAT_LABEL[s]}`);
  if (evs.length) out += `EVs: ${evs.join(' / ')}  \n`;
  let nature = set.nature && mech.natures[set.nature] ? set.nature : 'hardy';
  if (!evs.length && nature === 'serious') { nature = 'hardy'; warnings.push('serious-to-hardy'); }
  if (!set.nature || !mech.natures[set.nature]) warnings.push('nature-defaulted');
  out += `${mech.natures[nature].name} Nature  \n`;
  for (const m of set.moves) { if (mech.moves[m]) out += `- ${mech.moves[m].name}  \n`; else if (m) warnings.push('unknown-move'); }
  return { text: out, warnings };
}

/** A team: each set followed by a blank line, like Showdown's Teams.export. */
export function exportTeam(sets, mech, opts = {}) {
  const parts = sets.map((s, i) => exportSet(s, mech, { sp: opts.spFor?.(s, i) }));
  return { text: parts.map((p) => `${p.text}\n`).join(''), warnings: parts.flatMap((p, i) => p.warnings.map((w) => ({ set: i, code: w }))) };
}

/** Field equality for round-trip tests and duplicate detection. */
export const setKey = (s) => JSON.stringify([s.species, s.item, s.ability, s.nature, [...s.moves].sort(), s.sp === 'unknown' ? 'unknown' : STAT_IDS.map((k) => s.sp[k] ?? 0)]);

/** Is this battle forme / stone combination consistent? (used by the editor) */
export const megaFormeOf = (mech, set) => battleForme(mech, set.species, set.item);

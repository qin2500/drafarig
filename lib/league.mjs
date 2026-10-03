// Turns the parsed sheet into league state: who owns what, budgets, warnings. Pure (browser + server).
import { parseBoardCsv, parseDraftsCsv, redNamesFromBoardHtml } from './sheet.mjs';
import { matchName, suggest, toID } from './names.mjs';

export const ROSTER_SIZE = 10;
export const BUDGET = 100;

/**
 * @param {{boardCsv:string, draftsCsv:string, boardHtml?:string|null}} raw
 * @param {{species:Record<string,any>}} dex
 * @param {Record<string,string>} aliases  raw sheet name -> species id (user-accepted fixes)
 */
export function buildLeague(raw, dex, aliases = {}) {
  const has = (id) => !!dex.species[id];
  const ids = Object.keys(dex.species);
  const warnings = [];
  const unmatched = new Map();
  const match = (en, where) => {
    const m = matchName(en, has, aliases);
    if (!m.id && !unmatched.has(en)) unmatched.set(en, { raw: en, where, suggestions: suggest(en, ids) });
    return m.id;
  };

  const boardRows = parseBoardCsv(raw.boardCsv);
  const coachesRaw = parseDraftsCsv(raw.draftsCsv);
  if (!coachesRaw.length) throw new Error('Drafts tab: could not find the coach header row ("1.Name", "2.Name", ...)');
  if (coachesRaw.some((c) => c.pointsLeft === null)) warnings.push('Drafts tab: a "Points Left" value is missing; using 100 minus points spent.');

  const coaches = coachesRaw.map((c) => {
    const picks = c.picks.map((p) => ({ ...p, id: match(p.en, `Drafts (${c.name})`) }));
    const spent = picks.reduce((a, p) => a + (p.points || 0), 0);
    const computed = BUDGET - spent;
    if (c.pointsLeft !== null && c.pointsLeft !== computed) {
      warnings.push(`${c.name}: sheet says ${c.pointsLeft} points left, but picks add up to ${spent} spent (${computed} left). Using the sheet's number.`);
    }
    if (picks.length > ROSTER_SIZE) warnings.push(`${c.name} has ${picks.length} picks (league limit ${ROSTER_SIZE}).`);
    return { order: c.order, name: c.name, picks, spent, pointsLeft: c.pointsLeft ?? computed, slotsLeft: Math.max(0, ROSTER_SIZE - picks.length) };
  });

  const owner = new Map();
  for (const c of coaches) for (const p of c.picks) if (p.id) owner.set(p.id, c.name);

  let red = null;
  if (raw.boardHtml) {
    try { red = new Map(redNamesFromBoardHtml(raw.boardHtml).map((r) => [r.en, r.red])); }
    catch (e) { warnings.push('Board colours could not be read (' + e.message + '); ownership comes from the Drafts tab only.'); }
  } else warnings.push('Board colours were not fetched; ownership comes from the Drafts tab only.');

  const seen = new Set();
  const board = [];
  for (const r of boardRows) {
    const id = match(r.en, `Board (${r.points} pts)`);
    if (id && seen.has(id)) { warnings.push(`Board lists ${r.en} twice.`); continue; }
    if (id) seen.add(id);
    const isRed = red ? !!red.get(r.en) : null;
    const takenBy = id ? owner.get(id) ?? null : null;
    if (isRed === true && !takenBy) warnings.push(`${r.en} is red on the board but is not in anyone's picks. Treating it as taken (owner unknown).`);
    if (isRed === false && takenBy) warnings.push(`${r.en} is in ${takenBy}'s picks but is not red on the board.`);
    board.push({ id, en: r.en, zh: r.zh, points: r.points, takenBy, red: isRed, taken: !!takenBy || isRed === true });
  }
  // Picks whose board price differs from the Drafts tab
  const price = new Map(board.filter((b) => b.id).map((b) => [b.id, b.points]));
  for (const c of coaches) for (const p of c.picks) {
    if (p.id && price.has(p.id) && p.points !== price.get(p.id)) warnings.push(`${c.name}: ${p.en} cost ${p.points} in Drafts but ${price.get(p.id)} on the board.`);
    if (p.id && !price.has(p.id)) warnings.push(`${c.name}: ${p.en} is not on the board.`);
    if (p.id && p.en.trim() !== (board.find((b) => b.id === p.id)?.en ?? p.en).trim()) {
      const b = board.find((x) => x.id === p.id);
      if (b && toID(b.en) !== toID(p.en)) warnings.push(`Name differs between tabs: Drafts says "${p.en}", board says "${b.en}" (same Pokémon).`);
    }
  }
  return { board, coaches, warnings, unmatched: [...unmatched.values()] };
}

/** Whose turn it is. order: 'snake' (1→10, 10→1, …) or 'linear' (1→10 every round). */
export function computeTurn(coaches, order = 'snake') {
  const n = coaches.length;
  const total = coaches.reduce((a, c) => a + c.picks.length, 0);
  if (total >= n * ROSTER_SIZE) return { complete: true, total };
  const round = Math.floor(total / n) + 1, idx = total % n;
  const seat = order === 'snake' && round % 2 === 0 ? n - idx : idx + 1;
  const coach = coaches.find((c) => c.order === seat) ?? coaches[seat - 1];
  // Sanity: with a consistent sheet, the coach on the clock has exactly round-1 picks.
  const consistent = coach && coach.picks.length === round - 1;
  return { complete: false, total, round, pickNo: total + 1, seat, coach: coach?.name, consistent };
}

/** Number of picks before `name` picks again (0 = on the clock). */
export function picksUntil(coaches, name, order = 'snake') {
  const n = coaches.length;
  let total = coaches.reduce((a, c) => a + c.picks.length, 0);
  for (let k = 0; k < n * 2 + 1; k++, total++) {
    if (total >= n * ROSTER_SIZE) return null;
    const round = Math.floor(total / n) + 1, idx = total % n;
    const seat = order === 'snake' && round % 2 === 0 ? n - idx : idx + 1;
    if ((coaches.find((c) => c.order === seat) ?? coaches[seat - 1])?.name === name) return k;
  }
  return null;
}

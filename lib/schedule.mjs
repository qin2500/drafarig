// League pairings (the sheet's "Paring" tab): weeks of "A vs B" matchups per group, plus byes. Pure; browser and tests.
// The tab carries what it carries and nothing more: week numbers, group labels, pairs and byes. It has no dates, no
// results, no current-week marker and no rules, so none of those are produced here. Names are matched to the Drafts tab's
// coaches by one written rule (see matchCoach); a name that matches no coach, or more than one, stays unmatched and is
// shown as written, never guessed.
import { parseCsv } from './sheet.mjs';

const WEEK_RE = /^\s*week\s*(\d{1,2})\s*$/i;
// "Group A", and the sheet's own "Goup A" spelling: a label starting with G…p followed by a group name
const GROUP_RE = /^\s*g[a-z]*p\s+([a-z0-9]{1,3})\s*$/i;
const VS_RE = /^\s*vs\.?\s*$/i;
const BYE_RE = /^\s*bye\s*$/i;

/**
 * Comparable form of a coach name: a trailing parenthetical (ASCII or full-width) removed, all whitespace (NBSP included) and
 * zero-width characters removed, lower-cased without a locale ("Hex(法拉)" -> "hex", "DingDIng" -> "dingding").
 */
export const nameKey = (s) => String(s ?? '').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s*[(（][^()（）]*[)）]\s*$/, '').replace(/\s+/g, '').toLowerCase();

/** The one coach (from the Drafts tab) a pairing name means, or null (no match, or more than one). */
export function matchCoach(raw, coaches) {
  const key = nameKey(raw);
  if (!key) return null;
  const hits = coaches.filter((c) => nameKey(c.name) === key);
  return hits.length === 1 ? hits[0].name : null;
}

/**
 * Parse the pairing tab. coaches: [{name}] from the Drafts tab (may be empty while the sheet loads).
 * Returns { weeks: [{week, groups: [{label, raw, pairs: [{a, b}], byes: [side]}]}], unmatched: [raw], warnings: [code…] }
 * where side = {raw, coach|null}. An empty or unrecognisable tab gives weeks: [] and a warning, never invented pairs.
 */
export function parsePairings(csv, coaches = []) {
  const out = { weeks: [], unmatched: [], warnings: [] };
  if (typeof csv !== 'string' || !csv.trim()) { out.warnings.push({ code: 'empty' }); return out; }
  let rows;
  try { rows = parseCsv(csv); } catch { out.warnings.push({ code: 'unreadable' }); return out; }
  const headerRow = rows.findIndex((r) => r.some((c) => WEEK_RE.test(c)));
  if (headerRow < 0) { out.warnings.push({ code: 'no-week-header' }); return out; }
  const cols = []; // {col, week}
  rows[headerRow].forEach((c, col) => { const m = WEEK_RE.exec(c); if (m) cols.push({ col, week: Number(m[1]) }); });
  const side = (raw) => {
    const name = String(raw ?? '').trim();
    const coach = matchCoach(name, coaches);
    if (!coach && name && !out.unmatched.includes(name)) out.unmatched.push(name);
    return { raw: name, coach };
  };
  for (const { col, week } of cols) {
    if (out.weeks.some((w) => w.week === week)) { out.warnings.push({ code: 'duplicate-week', week }); continue; }
    const wk = { week, groups: [] };
    let group = null;
    for (let r = headerRow + 1; r < rows.length; r++) {
      const [x = '', y = '', z = ''] = [rows[r][col], rows[r][col + 1], rows[r][col + 2]].map((v) => String(v ?? '').trim());
      if (!x && !y && !z) continue;
      const g = GROUP_RE.exec(x);
      if (g && !y && !z) { group = { label: `Group ${g[1].toUpperCase()}`, raw: x, pairs: [], byes: [] }; wk.groups.push(group); continue; }
      if (!group) { group = { label: '', raw: '', pairs: [], byes: [] }; wk.groups.push(group); } // pairs before any group label
      if (x && VS_RE.test(y) && z) { group.pairs.push({ a: side(x), b: side(z) }); continue; }
      if (x && (BYE_RE.test(z) || BYE_RE.test(y)) && !(y && z && !BYE_RE.test(y) && !BYE_RE.test(z))) { group.byes.push(side(x)); continue; }
      out.warnings.push({ code: 'unrecognised-row', week, row: r + 1 });
    }
    wk.groups = wk.groups.filter((gr) => gr.pairs.length || gr.byes.length);
    if (wk.groups.length) out.weeks.push(wk);
  }
  out.weeks.sort((a, b) => a.week - b.week);
  // consistency facts, reported (never corrected): a coach listed twice in one week, or a coach of the sheet missing in a week
  for (const w of out.weeks) {
    const names = w.groups.flatMap((g) => [...g.pairs.flatMap((p) => [p.a.coach, p.b.coach]), ...g.byes.map((b) => b.coach)]).filter(Boolean);
    const twice = [...new Set(names.filter((n, i) => names.indexOf(n) !== i))];
    if (twice.length) out.warnings.push({ code: 'listed-twice', week: w.week, coaches: twice });
    const missing = coaches.map((c) => c.name).filter((n) => !names.includes(n));
    if (coaches.length && missing.length && !out.unmatched.length) out.warnings.push({ code: 'not-listed', week: w.week, coaches: missing });
  }
  if (!out.weeks.length) out.warnings.push({ code: 'no-pairings' });
  return out;
}

/**
 * One coach's schedule: [{week, group, opponent|null, bye:boolean, raw}] in week order (only weeks that list the coach).
 * opponent is the matched coach name, or null with raw = the sheet's text when the other name is unmatched.
 */
export function scheduleFor(pairings, coach) {
  const out = [];
  for (const w of pairings?.weeks ?? []) {
    for (const g of w.groups) {
      for (const p of g.pairs) {
        if (p.a.coach === coach) out.push({ week: w.week, group: g.label, opponent: p.b.coach, raw: p.b.raw, bye: false });
        else if (p.b.coach === coach) out.push({ week: w.week, group: g.label, opponent: p.a.coach, raw: p.a.raw, bye: false });
      }
      for (const b of g.byes) if (b.coach === coach) out.push({ week: w.week, group: g.label, opponent: null, raw: '', bye: true });
    }
  }
  return out;
}

/** The weeks two coaches are paired, in order. */
export const weeksAgainst = (pairings, coach, opp) => scheduleFor(pairings, coach).filter((x) => x.opponent === opp).map((x) => x.week);
/** The group label a coach appears in (from the first week that lists them), or ''. */
export const groupOf = (pairings, coach) => scheduleFor(pairings, coach)[0]?.group ?? '';

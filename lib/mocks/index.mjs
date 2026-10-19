// Curated mock opponents (docs/research/strategy/mock-method.md §4): coach X's strongest realistic team vs coach Y, for
// Anthony to pilot in friendly mocks. One file per pair, lib/mocks/<xSeat>v<ySeat>.mjs, imported here statically (no build
// step). They only ever show in Mocks (never in your own Brief or teambuilder). Validation is tolerant, like guides.
import { toID } from '../calc/mech.mjs';
import jacky4v8 from './4v8.mjs';

// Add a mock: import it and list it. Tests add fixtures with registerMock (the same module instance the app imports).
export const MOCKS = [jacky4v8];
export const registerMock = (m) => { MOCKS.push(m); return () => { const i = MOCKS.indexOf(m); if (i >= 0) MOCKS.splice(i, 1); }; };

const str = (x) => typeof x === 'string' && x.trim() !== '';
const strs = (x) => (Array.isArray(x) ? x.filter(str) : []);
const ids = (x) => (Array.isArray(x) ? x.map((v) => toID(v)).filter(Boolean) : []);

/**
 * Validate and normalise a curated mock. mech (optional) checks species / move ids. Returns { mock, problems:[text] };
 * mock is null only when the header (version 1, coach, vs, team text) is unusable. Bad entries are dropped and reported.
 */
export function validateMock(raw, mech = null) {
  const problems = [];
  const g = raw && typeof raw === 'object' ? raw : null;
  if (!g || g.version !== 1 || !str(g.coach) || !str(g.vs) || !str(g.team)) return { mock: null, problems: ['header: needs version 1, coach, vs and team'] };
  const sp = (id) => !mech || !!mech.species[id];
  const mv = (id) => !mech || !!mech.moves[id];
  const keep = (section, list, ok) => list.filter((x, i) => { const good = ok(x); if (!good) problems.push(`${section}[${i}] dropped`); return good; });
  const pn = g.pilotNotes && typeof g.pilotNotes === 'object' ? g.pilotNotes : {};
  const side = (x) => x && sp(toID(x.id)) && ['mock', 'ladder', 'worst'].includes(x.set);
  const out = {
    version: 1, coach: g.coach.trim(), seat: Number.isInteger(g.seat) ? g.seat : null, vs: g.vs.trim(), vsSeat: Number.isInteger(g.vsSeat) ? g.vsSeat : null,
    week: Number.isInteger(g.week) ? g.week : null, written: str(g.written) ? g.written : null,
    rosters: g.rosters && typeof g.rosters === 'object' ? { x: ids(g.rosters.x).filter(sp), y: ids(g.rosters.y).filter(sp) } : null,
    archetype: str(g.archetype) ? g.archetype : '', assumptions: strs(g.assumptions), team: g.team,
    departures: keep('departures', Array.isArray(g.departures) ? g.departures : [], (d) => sp(toID(d?.mon)) && str(d.what)).map((d) => ({ mon: toID(d.mon), what: d.what, why: str(d.why) ? d.why : '' })),
    variants: keep('variants', Array.isArray(g.variants) ? g.variants : [], (v) => str(v?.team)).map((v, i) => ({ key: `v${i + 1}`, name: str(v.name) ? v.name : `Variant ${i + 1}`, team: v.team, note: str(v.note) ? v.note : '' })),
    pilotNotes: {
      wins: str(pn.wins) ? pn.wins : '',
      leads: keep('pilotNotes.leads', Array.isArray(pn.leads) ? pn.leads : [], (l) => ids(l?.ours).length === 2 && ids(l.ours).every(sp)).map((l) => ({ ours: ids(l.ours), t1: str(l.t1) ? l.t1 : '', t2: str(l.t2) ? l.t2 : '', note: str(l.note) ? l.note : '' })),
      back: ids(pn.back).filter(sp), theyTry: strs(pn.theyTry),
      ifThen: keep('pilotNotes.ifThen', Array.isArray(pn.ifThen) ? pn.ifThen : [], (x) => str(x?.if) && str(x.do)).map((x) => ({ if: x.if, do: x.do })),
    },
    calcs: keep('calcs', Array.isArray(g.calcs) ? g.calcs : [], (c) => side(c?.attacker) && side(c.defender) && mv(toID(c.move)) && (c.attacker.set === 'mock') !== (c.defender.set === 'mock'))
      .map((c) => ({ attacker: { ...c.attacker, id: toID(c.attacker.id) }, defender: { ...c.defender, id: toID(c.defender.id) }, move: toID(c.move), field: c.field && typeof c.field === 'object' ? c.field : {},
        range: str(c.range) ? c.range.trim() : '', verdict: str(c.verdict) ? c.verdict : '', why: str(c.why) ? c.why : '' })),
    outline: keep('outline', Array.isArray(g.outline) ? g.outline : [], (o) => str(o?.coach)).map((o) => ({ coach: o.coach, week: Number.isInteger(o.week) ? o.week : null, note: str(o.note) ? o.note : '' })),
  };
  return { mock: out, problems };
}
/** The curated mock of coach `pilot` vs coach `friend` (matched by NAME: seats can move), validated; or null. */
export function mockFor(pilot, friend, { mocks = MOCKS, mech = null } = {}) {
  const raw = mocks.find((m) => m?.coach === pilot && m?.vs === friend);
  if (!raw) return null;
  const v = validateMock(raw, mech);
  return v.mock ? v : null;
}
/**
 * Have either roster changed since the mock was written? base(id) maps Mega formes to their species.
 * Returns { stale, x: { added, removed }, y: { added, removed } } (added = on the sheet now, not when written).
 */
export function mockStaleness(mock, xNow, yNow, base = (id) => id) {
  const cmp = (written, now) => {
    if (!written?.length) return { added: [], removed: [] };
    const w = new Set(written.map(base)), n = new Set(now.map(base));
    return { added: [...n].filter((id) => !w.has(id)), removed: [...w].filter((id) => !n.has(id)) };
  };
  const x = cmp(mock.rosters?.x, xNow), y = cmp(mock.rosters?.y, yNow);
  return { stale: !!(x.added.length || x.removed.length || y.added.length || y.removed.length), x, y };
}

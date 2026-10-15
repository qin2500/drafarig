// Prep routes: one parser and one formatter. Hashes carry opaque random ids, public sheet seats (1–2 digits, never names)
// and fixed words only; anything unknown or malformed maps to a safe route and never throws.
//   #prep                         Battle Prep (resolved to the overview of your perspective)
//   #prep/<p>                     overview as the coach in seat p
//   #prep/<p>v<o>[/<tab>]         p's matchup against seat o; tab: brief (default) | plan | sets | calcs | practice | build
//   #prep/<p>v<o>/their/<n>       a detail sheet over the brief: their n-th pick, your n-th pick (your/<n>) or a core
//   #prep/<p>v<o>/build/<n>       the dashboard for your n-th pick (a drill-down of the Build section)
//   #prep/w/<wsId>/<tab|kind>[/<id>]  a saved workspace by id (drill-downs; older links)
export const ID_RE = /^[a-z]+_[a-z2-7]{12}$/;
export const TABS = Object.freeze(['plan', 'sets', 'calcs', 'practice']);
/** The sections of a matchup: the brief first, then the workspace tabs. */
export const MATCH_TABS = Object.freeze(['brief', ...TABS, 'build']);
// Workspace drill-downs: kind -> whether it takes an id ('new' is allowed for calcs).
export const WS_KINDS = Object.freeze({
  theirplan: true, card: true, eyes: false, gameday: false, sets: true, import: false, export: false, calcs: true,
  threshold: false, speed: false, compare: false, brief: false, log: false, mock: true, revisions: false, variant: true, finding: true, owner: false,
});
const TOP = Object.freeze(['rules', 'backup', 'pilot', 'my-sets']);
const SEAT_RE = /^[1-9][0-9]?$/;
const MATCH_RE = /^([1-9][0-9]?)v([1-9][0-9]?)$/;
const CORE_RE = /^[a-z][a-z0-9-]{0,39}$/;
export const MAX_SLOT = 10;

export const isId = (s) => typeof s === 'string' && ID_RE.test(s);
export const isSeat = (n) => Number.isInteger(n) && n >= 1 && n <= 99;

function detailOf(kind, arg) {
  if ((kind === 'their' || kind === 'your' || kind === 'build') && /^[1-9][0-9]?$/.test(arg ?? '') && Number(arg) <= MAX_SLOT) return { side: kind, n: Number(arg) };
  if (kind === 'core' && CORE_RE.test(arg ?? '')) return { core: arg };
  return null;
}

/** '#prep/…' (or 'prep/…') -> route. Non-prep hashes return null. */
export function parseRoute(hash) {
  const h = String(hash ?? '').replace(/^#/, '');
  if (h !== 'prep' && !h.startsWith('prep/')) return null;
  const p = h.split('/').slice(1);
  const home = { view: 'home' };
  if (!p.length || p[0] === '') return home;
  if (SEAT_RE.test(p[0])) return p.length === 1 ? { view: 'overview', pov: Number(p[0]) } : { view: 'overview', pov: Number(p[0]) };
  const m = MATCH_RE.exec(p[0]);
  if (m) {
    const pov = Number(m[1]), opp = Number(m[2]);
    if (pov === opp) return { view: 'overview', pov };
    const base = { view: 'ws', pov, opp, tab: 'brief' };
    if (p.length === 1) return base;
    if (p.length === 2 && MATCH_TABS.includes(p[1])) return { ...base, tab: p[1] };
    if (p.length === 3) { const d = detailOf(p[1], p[2]); return d ? { ...base, detail: d } : base; }
    return base;
  }
  if (p[0] === 'my-sets') {
    if (p.length === 1) return { view: 'my-sets' };
    if (p.length === 2 && p[1] === 'import') return { view: 'my-sets', kind: 'import' };
    if (p.length === 2 && isId(p[1])) return { view: 'my-sets', id: p[1] };
    return home;
  }
  if (TOP.includes(p[0])) return p.length === 1 ? { view: p[0] } : home;
  if (p[0] === 'w' && isId(p[1])) {
    const wsId = p[1];
    if (p.length === 2) return { view: 'ws', wsId, tab: 'plan' };
    if (p.length === 3 && TABS.includes(p[2])) return { view: 'ws', wsId, tab: p[2] };
    const kind = p[2];
    if (!(kind in WS_KINDS)) return { view: 'ws', wsId, tab: 'plan' };
    if (WS_KINDS[kind]) {
      if (p.length === 4 && (isId(p[3]) || (kind === 'calcs' && p[3] === 'new'))) return { view: 'ws', wsId, kind, id: p[3] };
      if (p.length === 3 && kind === 'sets') return { view: 'ws', wsId, tab: 'sets' };
      if (p.length === 3 && kind === 'calcs') return { view: 'ws', wsId, tab: 'calcs' };
      return { view: 'ws', wsId, tab: 'plan' };
    }
    return p.length === 3 ? { view: 'ws', wsId, kind } : { view: 'ws', wsId, tab: 'plan' };
  }
  return home;
}

/** A matchup route (seat form): pov and opp seats, no drill-down. */
export const isMatch = (r) => !!r && r.view === 'ws' && !r.kind && isSeat(r.pov) && isSeat(r.opp) && r.pov !== r.opp;

/** route -> '#prep/…'. Invalid parts fall back to Prep home. */
export function formatRoute(r) {
  if (!r || r.view === 'home') return '#prep';
  if (r.view === 'overview') return isSeat(r.pov) ? `#prep/${r.pov}` : '#prep';
  if (TOP.includes(r.view) && r.view !== 'my-sets') return `#prep/${r.view}`;
  if (r.view === 'my-sets') return r.kind === 'import' ? '#prep/my-sets/import' : isId(r.id) ? `#prep/my-sets/${r.id}` : '#prep/my-sets';
  if (r.view === 'ws') {
    if (isMatch(r)) {
      const base = `#prep/${r.pov}v${r.opp}`;
      const d = r.detail && (r.detail.core ? detailOf('core', r.detail.core) : detailOf(r.detail.side, String(r.detail.n)));
      if (d) return d.core ? `${base}/core/${d.core}` : `${base}/${d.side}/${d.n}`;
      return MATCH_TABS.includes(r.tab) && r.tab !== 'brief' ? `${base}/${r.tab}` : base;
    }
    if (isId(r.wsId)) {
      if (r.kind && r.kind in WS_KINDS) {
        if (!WS_KINDS[r.kind]) return `#prep/w/${r.wsId}/${r.kind}`;
        if (isId(r.id) || (r.kind === 'calcs' && r.id === 'new')) return `#prep/w/${r.wsId}/${r.kind}/${r.id}`;
      }
      return `#prep/w/${r.wsId}/${TABS.includes(r.tab) ? r.tab : 'plan'}`;
    }
  }
  return '#prep';
}

const TAB_OF_KIND = { theirplan: 'plan', card: 'plan', eyes: 'plan', gameday: 'plan', sets: 'sets', import: 'sets', export: 'sets', variant: 'sets',
  calcs: 'calcs', threshold: 'calcs', speed: 'calcs', compare: 'calcs', brief: 'practice', log: 'practice', mock: 'practice', revisions: 'practice', finding: 'practice', owner: 'plan' };

/** The parent a Back/Save should return to when there is no history entry of ours. */
export function parentRoute(r) {
  if (!r || r.view === 'home') return { view: 'home' };
  if (r.view === 'overview') return { view: 'overview', pov: r.pov };
  if (r.view === 'my-sets') return r.id || r.kind ? { view: 'my-sets' } : { view: 'home' };
  if (r.view === 'ws') {
    if (isMatch(r)) return r.detail ? { view: 'ws', pov: r.pov, opp: r.opp, tab: r.detail.side === 'build' ? 'build' : 'brief' } : { view: 'overview', pov: r.pov };
    if (!r.kind) return { view: 'home' };
    return { view: 'ws', wsId: r.wsId, tab: TAB_OF_KIND[r.kind] ?? 'plan' };
  }
  return { view: 'home' };
}

const depth = (r) => (r.view === 'home' || r.view === 'overview' ? 0 : r.view === 'ws' ? (r.kind || r.detail ? 2 : 1) : r.id || r.kind ? 2 : 1);
/**
 * Peers replace, drill-downs push. Within Battle Prep: section tabs, another opponent and a perspective change are lateral
 * (replace); overview -> opponent, detail sheets and drill-downs push; "see it from their side" (the seats swap) pushes so
 * Back un-flips.
 */
export function navKind(from, to) {
  if (!from || !to) return 'replace';
  if (from.view === 'ws' && to.view === 'ws' && from.wsId && from.wsId === to.wsId && !from.kind && !to.kind && !from.detail && !to.detail) return 'replace'; // tab switch
  if (isMatch(from) && isMatch(to)) {
    if (from.pov === to.opp && from.opp === to.pov) return 'push'; // flip
    if (!from.detail && !to.detail) return 'replace'; // section tab, another opponent, another perspective
    if (to.detail && !from.detail) return 'push';
  }
  if (from.view === 'overview' && to.view === 'overview') return 'replace';
  return depth(to) > depth(from) ? 'push' : 'replace';
}

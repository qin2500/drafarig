// Prep routes: one parser and one formatter. Hashes carry opaque random ids only (never names or notes); anything
// unknown or malformed maps to Prep home and never throws.
export const ID_RE = /^[a-z]+_[a-z2-7]{12}$/;
export const TABS = Object.freeze(['plan', 'sets', 'calcs', 'practice']);
// Workspace drill-downs: kind -> whether it takes an id ('new' is allowed for calcs).
export const WS_KINDS = Object.freeze({
  theirplan: true, card: true, eyes: false, gameday: false, sets: true, import: false, export: false, calcs: true,
  threshold: false, speed: false, compare: false, brief: false, log: false, mock: true, revisions: false, variant: true, finding: true,
});
const TOP = Object.freeze(['rules', 'backup', 'pilot', 'my-sets']);

export const isId = (s) => typeof s === 'string' && ID_RE.test(s);

/** '#prep/…' (or 'prep/…') -> route. Non-prep hashes return null. */
export function parseRoute(hash) {
  const h = String(hash ?? '').replace(/^#/, '');
  if (h !== 'prep' && !h.startsWith('prep/')) return null;
  const p = h.split('/').slice(1);
  const home = { view: 'home' };
  if (!p.length || p[0] === '') return home;
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

/** route -> '#prep/…'. Invalid parts fall back to Prep home. */
export function formatRoute(r) {
  if (!r || r.view === 'home') return '#prep';
  if (TOP.includes(r.view) && r.view !== 'my-sets') return `#prep/${r.view}`;
  if (r.view === 'my-sets') return r.kind === 'import' ? '#prep/my-sets/import' : isId(r.id) ? `#prep/my-sets/${r.id}` : '#prep/my-sets';
  if (r.view === 'ws' && isId(r.wsId)) {
    if (r.kind && r.kind in WS_KINDS) {
      if (!WS_KINDS[r.kind]) return `#prep/w/${r.wsId}/${r.kind}`;
      if (isId(r.id) || (r.kind === 'calcs' && r.id === 'new')) return `#prep/w/${r.wsId}/${r.kind}/${r.id}`;
    }
    return `#prep/w/${r.wsId}/${TABS.includes(r.tab) ? r.tab : 'plan'}`;
  }
  return '#prep';
}

/** The parent a Back/Save should return to when there is no history entry of ours. */
export function parentRoute(r) {
  if (!r || r.view === 'home') return { view: 'home' };
  if (r.view === 'my-sets') return r.id || r.kind ? { view: 'my-sets' } : { view: 'home' };
  if (r.view === 'ws') {
    if (!r.kind) return { view: 'home' };
    const tabOf = { theirplan: 'plan', card: 'plan', eyes: 'plan', gameday: 'plan', sets: 'sets', import: 'sets', export: 'sets', variant: 'sets',
      calcs: 'calcs', threshold: 'calcs', speed: 'calcs', compare: 'calcs', brief: 'practice', log: 'practice', mock: 'practice', revisions: 'practice', finding: 'practice' };
    return { view: 'ws', wsId: r.wsId, tab: tabOf[r.kind] ?? 'plan' };
  }
  return { view: 'home' };
}

/** Peers replace, drill-downs push. */
export function navKind(from, to) {
  if (!from || !to) return 'replace';
  if (from.view === 'ws' && to.view === 'ws' && from.wsId === to.wsId && !from.kind && !to.kind) return 'replace'; // tab switch
  const depth = (r) => (r.view === 'home' ? 0 : r.view === 'ws' ? (r.kind ? 2 : 1) : r.id || r.kind ? 2 : 1);
  return depth(to) > depth(from) ? 'push' : 'replace';
}

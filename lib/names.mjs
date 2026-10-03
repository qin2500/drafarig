// Board name -> Showdown species id. Pure functions (used by server, browser and tests).

export const toID = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');

// Known typos in the league sheet (lowercase, whole words). Add new ones here.
export const TYPOS = {
  huisuian: 'hisuian', alalan: 'alolan', typhilosion: 'typhlosion', squawkability: 'squawkabilly',
  watchdog: 'watchog', samorott: 'samurott', manecri: 'manectric', spritomb: 'spiritomb',
  politoad: 'politoed', forrestress: 'forretress', prismarina: 'primarina',
};
const REGION = { alolan: 'alola', galarian: 'galar', hisuian: 'hisui', paldean: 'paldea' };
const TAUROS = { water: 'aqua', aqua: 'aqua', fire: 'blaze', blaze: 'blaze', fighting: 'combat', combat: 'combat' };
// Ids that the board uses for a forme Showdown files under another id.
const ID_FIX = { floette: 'floetteeternal', lycanrocmidday: 'lycanroc' };

/** Rule-based normalisation. `has(id)` says whether an id exists in the dex. Returns {id, how}. */
export function matchName(raw, has, aliases = {}) {
  const alias = aliases[String(raw).trim()];
  if (alias && has(alias)) return { id: alias, how: 'alias' };
  let s = String(raw).trim().toLowerCase().replace(/\s+/g, ' ');
  s = s.replace(/[a-z]+/g, (w) => TYPOS[w] ?? w);
  s = s.replace(/^(alolan|galarian|hisuian|paldean)[\s-]+(.+)$/, (_, r, rest) => `${rest}-${REGION[r]}`);
  s = s.replace(/^tauros-(water|aqua|fire|blaze|fighting|combat)-paldea$/, (_, t) => `tauros-paldea-${TAUROS[t]}`);
  s = s.replace(/-female$/, '-f').replace(/-male$/, ''); // Indeedee / Basculegion / Meowstic: base forme = male
  let id = toID(s);
  id = ID_FIX[id] ?? id;
  if (has(id)) return { id, how: id === toID(raw) ? 'exact' : 'rule' };
  return { id: null, how: 'unmatched' };
}

function lev(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

/** Closest ids by edit distance, for the "Did you mean" resolver. */
export function suggest(raw, ids, n = 3) {
  const t = toID(raw);
  return ids.map((id) => ({ id, d: lev(t, id) })).sort((a, b) => a.d - b.d).slice(0, n)
    .map(({ id, d }) => ({ id, confidence: Math.max(0, Math.round(100 * (1 - d / Math.max(t.length, id.length)))) }));
}

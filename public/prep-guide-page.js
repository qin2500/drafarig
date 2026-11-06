// The matchup's Guide tab: the full, long-form guide behind the Brief's "Game plan" card (data: lib/guides, schema
// docs/research/strategy/guide-schema.md v2). Reads like a paid team guide: his team and its threats first, then the six we
// bring and why, then how to play it (preview, leads, per-mon notes, in-game reads) and the evidence. Only for your own
// side (prep-guide.js guideOf). Every guide number stays a workbench link (linkify / calcLink).
import * as C from './prep-copy.js';
import { esc, btn, h2 } from './prep-ui.js';
import { parseTeamQuick } from '../lib/paste.mjs';
import { formatRoute } from '../lib/prep-route.mjs';
import * as Guide from './prep-guide.js';
import * as Deep from './prep-deep.js';

const GP = C.GUIDE_PAGE;
const G = C.GUIDE;
const { linkify, calcLink, hitLink, list, nm, base, face, goneTag } = Guide;
const SECTIONS = ['his', 'threats', 'team', 'preview', 'notes', 'game', 'evidence'];
const anchor = (k) => `gp-${k}`;
const para = (P, g, xs, cls = '') => xs.map((x) => `<p${cls ? ` class="${cls}"` : ''}>${linkify(P, g, x)}</p>`).join('');
const sec = (k, title, body) => (body ? `<section class="gp-sec" aria-labelledby="${anchor(k)}"><h3 id="${anchor(k)}" tabindex="-1">${esc(title)}</h3>${body}</section>` : '');
const monHead = (P, id, extra = '', size = 'sm') => `<span class="gp-mon">${P.pt(base(P)(id), { size })}<b>${esc(nm(P, id))}</b>${extra}</span>`;

/** The Showdown block of the guide's `sets` for one species (by base species), or ''. Cached per sets text. */
export function setBlock(P, g, id) {
  if (!g.sets) return '';
  P.guideBlocks ??= new Map();
  if (!P.guideBlocks.has(g.sets)) {
    const blocks = g.sets.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
    P.guideBlocks.set(g.sets, blocks.map((text) => ({ text, species: parseTeamQuick(text, { mech: P.mech, side: 'mine' }).sets.find((s) => s.set)?.set.species ?? null })));
  }
  return P.guideBlocks.get(g.sets).find((b) => b.species && base(P)(b.species) === base(P)(id))?.text ?? '';
}

// 1) his team
function his(P, g) {
  const o = g.overview;
  if (!o) return '';
  const tiers = ['core', 'likely', 'fringe'].map((t) => [t, o.roster.filter((r) => r.tier === t)]).filter(([, rs]) => rs.length);
  const roster = tiers.map(([t, rs]) => `<h4>${esc(GP.tiers[t])}</h4><ul class="gp-roster">${rs.map((r) => `<li class="gp-tier-${t}">${monHead(P, r.id)}<span class="gp-role">${linkify(P, g, r.role)}</span></li>`).join('')}</ul>`).join('');
  const likely = o.likely.length ? `<h4>${esc(GP.likely)}</h4>${o.likely.map((l) => `<div class="gp-six"><p class="gp-six-h"><b>${esc(l.label)}</b>${l.share ? ` <span class="small muted">${esc(l.share)}</span>` : ''}</p>
    <p class="gp-faces">${l.ids.map((id) => `<span class="gp-face">${P.pt(base(P)(id), { size: 'sm' })}<span class="small">${esc(nm(P, id))}</span></span>`).join('')}</p>${l.note ? `<p class="small">${linkify(P, g, l.note)}</p>` : ''}</div>`).join('')}` : '';
  return `${o.archetype ? `<p class="gp-arch"><span class="small muted">${esc(GP.archetype)}</span><br>${linkify(P, g, o.archetype)}</p>` : ''}${para(P, g, o.summary)}${roster}${likely}`;
}

// 2) threats, ranked
function threats(P, g) {
  if (!g.threats.length) return '';
  return `<ol class="gp-threats">${g.threats.map((t) => `<li class="gp-threat"><h4>${P.pt(base(P)(t.id), { size: 'sm' })}<span>${esc(t.title)}</span></h4>
    <p>${linkify(P, g, t.why)}</p>${t.answer ? `<p><b>${esc(GP.answer)}</b> ${linkify(P, g, t.answer)}</p>` : ''}${t.calc !== null && g.calcs[t.calc] ? `<p class="small">${esc(GP.theCalc)} ${calcLink(P, g, t.calc)}</p>` : ''}</li>`).join('')}</ol>`;
}

// 3) our team and why; without team.members (a v1 guide), the six from `bring` with each mon's perMon job
function team(P, g, m) {
  const t = g.team;
  const six = g.bring?.six ?? [];
  const members = t?.members.length ? t.members : six.map((id) => ({ id, role: g.perMon[id]?.job ?? '', why: '', spread: '' }));
  if (!members.length && !t) return '';
  const card = (mb) => {
    const pm = g.perMon[mb.id] ?? g.perMon[base(P)(mb.id)];
    const set = setBlock(P, g, mb.id);
    const mega = Guide.isMega(P, g, mb.id);
    return `<article class="gp-member"><header class="gp-member-h">${face(P, m.pov.picks, mb.id, { mega, size: 'md' })}<div><h4>${esc(nm(P, mb.id))}${mega ? ` <span class="chip">${esc(GP.megaChip)}</span>` : ''}</h4>${mb.role ? `<p class="gp-role">${linkify(P, g, mb.role)}</p>` : ''}</div></header>
      ${mb.why ? `<p>${linkify(P, g, mb.why)}</p>` : ''}${mb.spread ? `<p class="small"><b>${esc(GP.spread)}</b> ${linkify(P, g, mb.spread)}</p>` : ''}
      ${pm?.job && pm.job !== mb.role ? `<p class="small"><b>${esc(GP.job)}</b> ${linkify(P, g, pm.job)}</p>` : ''}${pm?.avoid ? `<p class="small"><b>${esc(GP.avoid)}</b> ${linkify(P, g, pm.avoid)}</p>` : ''}
      ${set ? `<details class="gp-set"><summary>${esc(GP.set)}</summary><pre tabindex="0">${esc(set)}</pre></details>` : ''}</article>`;
  };
  const mega = g.bring?.mega ? `<p><b>${esc(GP.mega(nm(P, g.bring.mega.id)))}</b>${g.bring.mega.why ? ` ${linkify(P, g, g.bring.mega.why)}` : ''}</p>` : '';
  const bench = g.bring?.bench.length ? `<h4>${esc(GP.benched)}</h4><ul class="gp-roster">${g.bring.bench.map((b) => `<li>${monHead(P, b.id)}<span class="gp-role">${linkify(P, g, b.why)}</span></li>`).join('')}</ul>` : '';
  return `${para(P, g, t?.summary ?? [])}${t?.evidence ? `<p class="gp-evidence">${linkify(P, g, t.evidence)}</p>` : ''}
    ${members.length ? `<p class="gd-faces">${members.map((mb) => face(P, m.pov.picks, mb.id, { mega: Guide.isMega(P, g, mb.id) })).join('')}</p>` : ''}
    ${Guide.teamButtons(P, g, m.ws)}${members.map(card).join('')}${mega}${bench}`;
}

// 4) team preview and leads
function preview(P, g, found) {
  const rows = g.previews.map((p) => {
    const off = goneTag(P, found, [...p.bring4, ...p.lead]);
    return `<div class="gd-preview${off ? ' gd-gone' : ''}"><p><span class="small muted">${esc(GP.ifPreview)}</span> <b>${esc(p.if.replace(/^their 6 includes\s+/i, ''))}</b>${off}</p>
      <p class="small"><b>${esc(GP.lead)}</b> ${p.lead.map((id) => esc(nm(P, id))).join(' + ')} &nbsp; <b>${esc(GP.bring4)}</b> ${p.bring4.map((id) => esc(nm(P, id))).join(' · ')}</p>${p.note ? `<p class="small">${linkify(P, g, p.note)}</p>` : ''}</div>`;
  }).join('');
  const leads = Guide.leadsHtml(P, g, found);
  return `${rows ? `<h4>${esc(GP.previewHead)}</h4>${rows}` : ''}${leads ? `<h4>${esc(GP.leadsHead)}</h4>${leads}` : ''}`;
}

// 5) matchup notes per opposing Pokémon (in the overview's roster order first)
function notes(P, g, m) {
  const ours = new Set([...(g.rosters?.ours ?? []), ...P.coachRoster(m.pov.name), ...(g.bring?.six ?? []), ...(g.bring?.bench ?? []).map((b) => b.id)].map(base(P)));
  const order = (g.overview?.roster ?? []).map((r) => r.id);
  const theirs = Object.keys(g.perMon).filter((id) => !ours.has(base(P)(id))).sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));
  return theirs.map((id) => {
    const n = g.perMon[id];
    const f = (k, label) => (n[k] ? `<p class="small"><b>${esc(label)}</b> ${linkify(P, g, n[k])}</p>` : '');
    return `<div class="gp-note">${monHead(P, id)}${f('role', GP.role)}${f('worstCase', GP.worst)}${f('answer', GP.answer)}${list(n.notes.map((x) => linkify(P, g, x)), 'ul', 'small')}</div>`;
  }).join('');
}

// 6) in the game: tells, ways we lose, endgame, combos
function game(P, g, found) {
  const theirs = g.combos.theirs.length ? list(g.combos.theirs.map((c) => `${c.attackers.map(([a, mv]) => hitLink(P, g, a, mv, c.into, false, `${nm(P, a)} ${P.name('moves', mv)}`)).join(' + ')} → ${esc(G.your(nm(P, c.into)))}${c.range ? ` <b>${esc(c.range)}</b>` : ''}${c.answer ? `<br><span class="small"><b>${esc(G.answerLabel)}</b> ${linkify(P, g, c.answer)}</span>` : ''}`)) : '';
  const part = (title, body) => (body ? `<h4>${esc(title)}</h4>${body}` : '');
  return `${part(GP.tells, Guide.tellsHtml(P, g))}${part(GP.lose, Guide.loseHtml(P, g))}${part(GP.endgame, Guide.endgameHtml(P, g))}${part(GP.ours, Guide.oursCombosHtml(P, g, found))}${part(GP.theirs, theirs)}`;
}

// 7) assumptions / evidence
function evidence(P, g, found, m) {
  const deep = Deep.has(P, m) ? `<p><a href="${esc(formatRoute({ view: 'ws', pov: m.pov.order, opp: m.opp.order, tab: 'deep' }))}" data-pa="tab" data-tab="deep">${esc(GP.deepLink)}</a></p>` : '';
  const problems = found.problems.length ? `<p class="small muted">${esc(G.problems(found.problems.length))}</p>` : '';
  return g.assumptions.length || deep ? `${list(g.assumptions.map((x) => linkify(P, g, x)))}${deep}${problems}` : '';
}

/** The tab body for matchup m ({ pov, opp, ws }). */
export function tab(P, m) {
  const found = Guide.hasPage(P, m) ? Guide.guideOf(P, m.pov.name, m.opp.name) : null;
  if (!found) return `${h2(GP.head(m.opp.name))}<p>${esc(GP.none)}</p>`;
  const g = found.guide;
  const titles = { his: GP.his(g.coach), threats: GP.threats, team: GP.team, preview: GP.preview, notes: GP.notes, game: GP.game, evidence: GP.evidence };
  const bodies = { his: his(P, g), threats: threats(P, g), team: team(P, g, m), preview: preview(P, g, found), notes: notes(P, g, m), game: game(P, g, found), evidence: evidence(P, g, found, m) };
  const shown = SECTIONS.filter((k) => bodies[k]);
  const toc = shown.length > 1 ? `<nav class="gp-toc" aria-label="${esc(GP.toc)}"><p class="small muted">${esc(GP.toc)}</p><ol>${shown.map((k) => `<li>${btn(titles[k], 'gp-jump', { to: anchor(k) }, { cls: 'linkish' })}</li>`).join('')}</ol></nav>` : '';
  return `<article class="gp">${h2(GP.head(g.coach, g.week))}${Guide.headHtml(P, g, found, { assumptions: 0 })}${toc}
    ${shown.map((k) => sec(k, titles[k], bodies[k])).join('')}
    <p class="gp-foot">${btn(GP.top, 'gp-jump', { to: 'prep-h' }, { cls: 'linkish' })} <a href="${esc(formatRoute({ view: 'ws', pov: m.pov.order, opp: m.opp.order, tab: 'brief' }))}" data-pa="tab" data-tab="brief">${esc(GP.backBrief)}</a></p></article>`;
}

export const actions = {
  'gp-jump': (t) => {
    const el = t.ownerDocument?.getElementById(t.dataset.to);
    if (el) { el.scrollIntoView({ block: 'start' }); el.focus?.({ preventScroll: true }); }
  },
};

// Drafarig front end. Plain ES modules, no build step. Shared logic lives in /lib (also used by the server and tests).
import { buildLeague, computeTurn, picksUntil, ROSTER_SIZE, BUDGET } from '/lib/league.mjs';
import { budgetSummary, affordability } from '/lib/budget.mjs';
import { buildPlans, checkPick } from '/lib/optimizer.mjs';
import { weaknessMatrix, roleChecklist, speedRows, threatList, synergies, SYNERGY_MODES } from '/lib/analysis.mjs';
import { coreContext } from '/lib/cores.mjs';
import { buildCoresView, createCoresCache, renderCoresPanel, renderCoresError, renderThinPanel, renderCarriesPanel, sheetReadText } from '/lib/cores-view.mjs';
import { focusKey, focusCandidates, scrollAfterRender } from '/lib/rerender.mjs';
import { GLOSSARY } from '/glossary.js';

// ---------- settings (per browser) ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem('drafarig.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  // a setting that can't be saved (storage full or blocked) says so once instead of failing silently
  set(k, v) { try { localStorage.setItem('drafarig.' + k, JSON.stringify(v)); } catch { if (!store.warned) { store.warned = true; toast("Settings couldn't be saved on this device (storage full or blocked)."); } } },
};
const DEFAULT_COACH = 'Anthony'; // the shipped default Draft coach setting (used only when nothing is stored)
const S = {
  coach: store.get('coach', DEFAULT_COACH), order: store.get('order', 'snake'), explain: store.get('explain', true),
  mode: store.get('mode', 'draft'), aliases: store.get('aliases', {}), draftTab: 'plans', check: '', showForms: false,
  tailwind: false, trickRoom: false, speedOpp: '', threatScope: 'all', boardFilter: { q: '', role: '', type: '', hideTaken: false, affordable: false },
  cores: { open: {}, more: false, showAll: {} }, // Cores panels: expand state per card / mon key (not persisted)
};

let dex, sheet, L, usage = null, usageError = null, planCache = null;
let coachIsFallback = false; // S.coach was filled in because the stored coach isn't on the sheet: shown, never saved as a setting
let sheetFailed = false;
// Cores to fear: the spec context is built once at boot; the per-coach view is cached and recomputed only by rebuild()
// (new sheet data or name fixes) or a coach change, never on a re-render (UX §11.1). The sheet read time isn't part of
// the cached view: it's passed at render time (QA S6).
let coreCx = null;
const coreCache = createCoresCache(() => buildCoresView(coreCx, {
  me: me(), opponents: L.coaches.filter((x) => x.name !== S.coach), available: available(),
}));
// A throw while building a Cores panel must not take the rest of the screen (Threats, Board) down with it (code review n2).
function coresSafe(build, fallback) {
  try { return build(); } catch (e) { console.error('Cores panel failed:', e); return fallback; }
}
// Phones (UX §3.4 / §9, the same breakpoint as styles.css): single-opponent "Close to forming" rows fold when there are > 5.
const narrowScreen = matchMedia('(max-width: 767px)');
function coresView() {
  if (!coreCx) return null;
  try { return coreCache.get(S.coach); } catch (e) { console.error('Cores to fear failed:', e); return null; }
}
// Battle Prep: device-local opponent prep (public/prep.js), the second app beside Draft. Its code loads on first use, so the
// Draft screens don't pay for it. Nothing in Prep is sent anywhere; the app only hands it the league data it already has and a
// few browser helpers. Draft is every other mode (Draft, My team, League, Rules & glossary, Setup).
const MODES = ['draft', 'team', 'league', 'learn', 'setup', 'prep'];
let lastDraftMode = 'draft';
let pendingVs = null; // "Battle Prep vs …" from Draft, applied once Prep has loaded
const isPrepHash = (h) => h === 'prep' || h.startsWith('prep/');
let prep = null, prepLoading = null, prepFailed = false, prepGlossary = {};
let viewingAs = null; // {coach: your coach before "See it as they do", back()} while League shows an opponent's side
const $ = (s) => document.querySelector(s);
const esc =(s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sp = (id) => dex.species[id];
const SPRITE = 'https://play.pokemonshowdown.com/sprites';
const sprite = (f) => `<img alt="" loading="lazy" src="${SPRITE}/gen5/${f.sprite}.png" onerror="this.onerror=null;this.src='${SPRITE}/ani/${f.sprite}.gif'">`;
// Battle Prep portraits: the same Showdown sprite host, static images only (no animated ani/ in Battle Prep). Coverage was
// HEAD-checked for every dex form on 2026-10-02 (prior research, sprite-coverage.json): home-centered has every base form,
// gen5 has every form except these 11 Megas, which show their base form's gen5 image (the card marks the Mega in words).
// No inline handlers: a document-level error listener walks data-fb, then leaves a text initials disc. alt="" because the
// name is always written next to the image; no-referrer so the image host isn't told which page asked.
const GEN5_MISSING = new Set(['barbaracle-mega', 'dragalge-mega', 'eelektross-mega', 'falinks-mega', 'malamar-mega', 'pyroar-mega', 'raichu-megax', 'raichu-megay', 'scolipede-mega', 'scrafty-mega', 'staraptor-mega']);
const PORTRAIT_PX = { xs: 24, sm: 40, md: 64, lg: 80 };
let formIndex = null;
function formOf(id) {
  if (!dex) return null;
  if (dex.species[id]) return { s: dex.species[id], f: dex.species[id].forms[0] };
  formIndex ??= new Map(Object.values(dex.species).flatMap((s) => s.forms.map((f) => [f.id, { s, f }])));
  return formIndex.get(id) ?? null;
}
function portrait(id, { size = 'sm' } = {}) {
  const x = formOf(id), px = PORTRAIT_PX[size] ?? 40, sz = PORTRAIT_PX[size] ? size : 'sm';
  const ini = esc(String(x?.s.name ?? id ?? '?').replace(/[^A-Za-z0-9]/g, '').slice(0, 2) || '?');
  const type = /^[A-Za-z]+$/.test(x?.f.types?.[0] ?? '') ? x.f.types[0].toLowerCase() : 'none';
  const sid = x?.f.sprite, base = x?.s.forms[0].sprite;
  if (!x || !/^[a-z0-9-]+$/.test(sid ?? '') || !/^[a-z0-9-]+$/.test(base ?? '')) return `<span class="pt pt-${sz} noimg ty-${type}" data-ini="${ini}"></span>`;
  const large = px >= 56;
  const chain = x.f.mega ? (GEN5_MISSING.has(sid) ? [`gen5/${base}`] : [`gen5/${sid}`, `gen5/${base}`]) : large ? [`home-centered/${sid}`, `gen5/${sid}`] : [`gen5/${sid}`];
  const [src, fb] = chain.map((c) => `${SPRITE}/${c}.png`);
  return `<span class="pt pt-${sz} ty-${type}${large && !x.f.mega ? ' home' : ''}" data-ini="${ini}"><img class="spr" src="${src}"${fb ? ` data-fb="${fb}"` : ''} alt="" width="${px}" height="${px}" loading="lazy" decoding="async" referrerpolicy="no-referrer"></span>`;
}
// A portrait that fails to load tries its fallback once, then becomes the initials disc (no broken-image icon).
document.addEventListener('error', (e) => {
  const img = e.target;
  if (!img || img.tagName !== 'IMG' || !img.classList?.contains('spr')) return;
  const fb = img.dataset?.fb;
  if (fb) { delete img.dataset.fb; img.src = fb; return; }
  img.parentElement?.classList.add('noimg');
  img.remove();
}, true);
const term = (label, key = label) => `<span class="term" tabindex="0" data-term="${esc(key)}">${esc(label)}</span>`;
const typeTag = (t) => `<span class="type">${esc(t)}</span>`;
const mult = (m) => (m === 0 ? '0' : m === 0.25 ? '¼' : m === 0.5 ? '½' : m === 1 ? '' : '×' + m);
const multClass = (m) => (m === 0 ? 'm-i' : m < 1 ? 'm-r' : m > 1 ? 'm-w' : '');
const zhOf = (id) => L.board.find((b) => b.id === id)?.zh || sp(id)?.zh || '';
const AFF = { ok: ['ok', 'Affordable'], tight: ['tight', 'Tight'], breaks: ['breaks', 'Breaks budget'] };

function monLine(id, extra = '') {
  const m = sp(id);
  if (!m) return `<span class="chip unc">Unknown: ${esc(id)}</span>`;
  const megas = m.forms.filter((f) => f.mega).length;
  return `<span class="mon">${sprite(m.forms[0])}<span><span class="nm" data-mon="${m.id}">${esc(m.name)}</span> <span lang="zh">${esc(zhOf(id))}</span>
    ${megas ? `<span class="chip mega" title="League rule: drafting this mon gives you all its Mega forms.">M${megas > 1 ? '×' + megas : ''}</span>` : ''}
    <span class="chip">${term(m.tier, 'Meta tier (S–D)')}</span> ${extra}<br>${m.forms[0].types.map(typeTag).join('')}</span></span>`;
}

// ---------- data ----------
async function loadSheet() {
  $('#sync').textContent = 'Syncing…';
  const r = await fetch('/api/sheet', { cache: 'no-store' });
  const body = await r.json();
  if (!r.ok) throw new Error(body.error || 'Sheet request failed');
  sheet = body;
  rebuild();
}
// While the page is open, re-read the sheet every 45 s (and when the tab comes back into view).
// Only re-render when the picks actually changed, so an idle page isn't redrawn under the user.
let refreshing = false;
async function refreshSheet() {
  if (refreshing || document.hidden || !sheet) return;
  refreshing = true;
  try {
    const r = await fetch('/api/sheet', { cache: 'no-store' });
    const body = await r.json();
    if (!r.ok) return;
    const changed = body.raw.draftsCsv !== sheet.raw.draftsCsv || body.raw.boardCsv !== sheet.raw.boardCsv;
    const before = L.coaches.reduce((s, c) => s + c.picks.length, 0);
    sheet = body;
    if (!changed) { renderTop(); showReadTime(); return; }
    // Battle Prep is redrawn only on a briefing or overview with no field in use (its screens with typing read the new picks
    // on their next screen); a matchup stays on the two coaches it was opened for (prep.js pins them).
    const typing = !!document.activeElement?.matches?.('input, textarea, select');
    rebuild(); if (S.mode === 'prep') { if (prep?.canRedraw?.() && !typing) render(); else renderTop(); } else render();
    const n = L.coaches.reduce((s, c) => s + c.picks.length, 0) - before;
    toast(n > 0 ? `Sheet updated: ${n} new pick${n > 1 ? 's' : ''}` : 'Sheet updated');
  } catch {} finally { refreshing = false; }
}
// A re-read with unchanged picks doesn't redraw #main, but the Cores Sources line must still show the new read time (QA S6).
function showReadTime() {
  for (const el of document.querySelectorAll('#main .sources .sheet-read')) el.textContent = sheetReadText(sheet.fetchedAt);
}

function rebuild() {
  L = buildLeague(sheet.raw, dex, S.aliases);
  planCache = null;
  coreCache.reset();
  if (!L.coaches.some((c) => c.name === S.coach)) { S.coach = L.coaches.find((c) => c.order === 5)?.name || L.coaches[0].name; coachIsFallback = true; }
}
async function loadUsage() {
  try {
    const r = await fetch('/api/usage');
    const b = await r.json();
    if (!r.ok) throw new Error(b.error);
    usage = b;
  } catch (e) { usageError = String(e.message || e); }
  render();
}

// ---------- derived state for the selected coach ----------
function me() { return L.coaches.find((c) => c.name === S.coach); }
function available() { return L.board.filter((b) => !b.taken && b.id).map((b) => ({ id: b.id, cost: b.points })); }
function myIds(c = me()) { return c.picks.map((p) => p.id).filter(Boolean); }
function opponents(c = me()) { return L.coaches.filter((x) => x.name !== c.name).map((x) => ({ coach: x.name, ids: myIds(x) })); }
function affMap(c = me()) { return new Map(affordability(available(), c.pointsLeft, c.slotsLeft).map((a) => [a.id, a])); }
function plans() {
  if (planCache?.coach === S.coach) return planCache.res;
  const c = me();
  const res = c.slotsLeft ? buildPlans(dex, myIds(c), available(), c.slotsLeft, c.pointsLeft, {
    opponents: opponents(c), rosterCosts: Object.fromEntries(c.picks.filter((p) => p.id).map((p) => [p.id, p.points])),
  }) : { plans: [], singles: [] };
  planCache = { coach: S.coach, res };
  return res;
}

// ---------- top bar ----------
function ago(iso) { const s = Math.max(0, Math.round((Date.now() - new Date(iso)) / 1000)); return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.round(s / 60)} min ago` : new Date(iso).toLocaleString(); }
function renderTop() {
  const sync = $('#sync');
  const t = new Date(sheet.fetchedAt).toLocaleTimeString();
  sync.className = 'sync' + (sheet.stale ? ' stale' : '');
  // phones show the dot and the age only; the full words stay for screen readers (and wider screens)
  const full = sheet.stale ? `⚠ Using data from ${t} (sheet unreachable) ⟳` : `● Synced ${ago(sheet.fetchedAt)} (${t}) ⟳`;
  sync.innerHTML = `<span class="sync-long">${esc(full)}</span><span class="sync-short" aria-hidden="true">${sheet.stale ? '⚠' : '●'} ${esc(ago(sheet.fetchedAt))} ⟳</span>`;
  sync.title = sheet.stale ? `Last error: ${sheet.error}. Click to retry.` : 'Fresh copy of the league sheet. It re-checks every 45 seconds while this tab is open; click to reload now. Google can lag a few minutes behind edits.';
  const turn = computeTurn(L.coaches, S.order);
  const until = picksUntil(L.coaches, S.coach, S.order);
  const el = $('#turn');
  if (turn.complete) { el.textContent = 'Draft complete'; el.className = 'turn'; }
  else if (turn.coach === S.coach) { el.textContent = `Round ${turn.round} · Pick ${turn.pickNo} · ${S.coach.toUpperCase()} IS ON THE CLOCK`; el.className = 'turn clock'; }
  else { el.textContent = `Round ${turn.round} · Pick ${turn.pickNo} · ${turn.coach} picking · ${S.coach} in ${until ?? '?'} picks`; el.className = 'turn'; }
  const c = me(), b = budgetSummary(c.pointsLeft, c.slotsLeft, available().map((a) => a.cost));
  $('#budget').innerHTML = `${c.pointsLeft} pts · ${c.slotsLeft} slots · ${term('max', 'Max this pick')} ${b.maxThisPick}`;
  $('#coach').innerHTML = L.coaches.map((x) => `<option ${x.name === S.coach ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
  markMode();

  const banners = [];
  if (viewingAs) banners.push(`<div class="banner info" role="status">Viewing as ${esc(S.coach)} (from your prep). Your prep hasn't changed. <button class="primary" data-viewas-back="">Back to my prep</button></div>`);
  if (sheet.stale) banners.push(`<div class="banner warn">Couldn't reach the league sheet (${esc(sheet.error)}). Showing data from ${t} (${ago(sheet.fetchedAt)}). Picks made since then are missing. <button id="retry">Retry</button></div>`);
  if (L.unmatched.length) banners.push(`<div class="banner warn">${L.unmatched.length} name(s) couldn't be matched to a Pokémon. They still count toward points but are left out of the analysis. <button data-goto="setup">Fix names</button></div>`);
  // sheet notes are about the draft board: Battle Prep leaves them out (stale and unmatched-name banners still show: they change the briefing)
  if (L.warnings.length && S.mode !== 'prep') banners.push(`<div class="banner info"><details><summary>${L.warnings.length} sheet note(s): Drafts tab is the source of truth; board red text is a cross-check.</summary><ul>${L.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></details></div>`);
  $('#banners').innerHTML = banners.join('');
}

// ---------- Draft ----------
function budgetPanel(c) {
  const b = budgetSummary(c.pointsLeft, c.slotsLeft, available().map((a) => a.cost));
  const segs = c.picks.map((p) => `<span class="spent" style="width:${p.points}%" title="${esc(p.en)} ${p.points}"></span>`).join('');
  const state = !b.feasible ? '<span class="chip breaks">Impossible</span>' : b.avgPerSlot < 2.5 ? '<span class="chip tight">Tight</span>' : '<span class="chip ok">Healthy</span>';
  return `<div class="panel"><h2>Budget ${state}</h2>
    <div class="meter" role="img" aria-label="${BUDGET - c.pointsLeft} of ${BUDGET} points spent">${segs}</div>
    <p class="budget-line">${c.pointsLeft} pts left · ${c.slotsLeft} slots to fill · ${term('Average per slot', 'Points per remaining slot')}: ${b.avgPerSlot} · ${term('Max you can spend on this pick', 'Max this pick')}: ${b.maxThisPick}</p>
    <p class="explainer">League rule: exactly ${ROSTER_SIZE} mons on ${BUDGET} points. "Max this pick" is points left minus the ${c.slotsLeft - 1} cheapest mons still on the board (${b.reserve ?? '—'} pts), so you can always fill every slot.</p>
    ${!b.feasible ? `<p class="banner bad">No combination of available mons fills your ${c.slotsLeft} slots with ${c.pointsLeft} pts.</p>` : ''}</div>`;
}
function reasonList(why) { return why.map((w) => `<span class="reason ${w.startsWith('−') ? 'neg' : ''}">${esc(w)}</span>`).join(''); }
function pickMsg(id, cost) { return `Pick: ${sp(id).name} ${zhOf(id)} (${cost} pts)`; }

const VERDICT = { great: ['ok', 'Great pick'], good: ['ok', 'Good pick'], okay: ['tight', 'Okay pick'], weak: ['unc', 'Weak pick'], breaks: ['breaks', 'Breaks your budget'], unavailable: ['unc', 'Already taken'] };
function checkPanel(c) {
  const opts = available().filter((m) => sp(m.id)).sort((a, b) => b.cost - a.cost || sp(a.id).name.localeCompare(sp(b.id).name))
    .map((m) => `<option value="${m.id}" ${m.id === S.check ? 'selected' : ''}>${esc(sp(m.id).name)} ${esc(zhOf(m.id))} (${m.cost})</option>`).join('');
  let body = '<p class="explainer">Thinking about a mon? Pick it here. The app builds the best complete roster that starts with it and compares that with your best plan.</p>';
  if (S.check) {
    const P = plans();
    planCache.checks ??= {};
    const r = planCache.checks[S.check] ??= checkPick(dex, myIds(c), available(), c.slotsLeft, c.pointsLeft, S.check, {
      best: P, opponents: opponents(c), rosterCosts: Object.fromEntries(c.picks.filter((p) => p.id).map((p) => [p.id, p.points])),
    });
    const [cls, label] = VERDICT[r.verdict];
    if (r.verdict === 'unavailable') body = `<p class="verdict"><span class="chip ${cls}">${label}</span></p>`;
    else if (r.verdict === 'breaks') body = `<p class="verdict"><span class="chip ${cls}">${label}</span></p><p>${esc(r.reason)}</p>`;
    else {
      const vs = r.delta > 1 ? `The best roster with it scores ${r.delta.toFixed(1)} above the plans below (the planner hadn't tried starting with it).`
        : r.delta >= -1 ? 'About as good as your best plan.'
        : `The best roster with it scores ${(-r.delta).toFixed(1)} below your best plan${r.bestFirst ? ` (which starts with ${esc(sp(r.bestFirst).name)})` : ''}.`;
      body = `<p class="verdict"><span class="chip ${cls}">${label}</span> ${vs}</p>
        ${monLine(r.id, `<span class="chip">${r.cost} pts</span>`)} ${reasonList(r.why)}
        ${r.rest.length ? `<p class="small">Then fill the rest with: ${r.rest.map((x) => `<span class="chip">${esc(sp(x.id).name)} ${x.cost}</span>`).join('')} (${r.left ? `${r.left} pts spare` : 'uses every point'})</p>` : ''}
        <p class="small muted">${r.inPlans.length ? `It's in plan ${r.inPlans.join(', ')}. ` : ''}Ranks #${r.rank} of ${r.of} for what it adds to your team right now.</p>
        <p class="explainer">Great: within 1 point of your best plan. Good: within 3. Okay: within 6. Weak: more than 6 below. The score adds up meta tier, roles, shared weaknesses, answers to opponents' top threats and points spent (see "Why?" on a plan). It's an estimate, not a damage calc.</p>
        <button data-copy="${esc(pickMsg(r.id, r.cost))}">Copy pick message</button>`;
    }
  }
  return `<div class="panel"><h2>Check a pick</h2><div class="filters"><select id="checkPick" aria-label="Mon to check"><option value="">Choose a mon…</option>${opts}</select>
    ${S.check ? '<button data-check="">Clear</button>' : ''}</div>${body}</div>`;
}

function renderDraft() {
  const c = me();
  if (!c.slotsLeft) return `${budgetPanel(c)}<div class="panel"><h2>Roster complete</h2><p>${esc(c.name)} has all ${ROSTER_SIZE} picks. Matchup prep is in Battle Prep.</p><button class="primary" data-mode="prep">Open Battle Prep</button></div>`;
  const P = plans(), aff = affMap();
  const tab = S.draftTab;
  const planHtml = P.plans.length ? P.plans.map((p, i) => `<div class="plan ${i === 0 ? 'selected' : ''}">
      <div class="plan-head"><span>Plan ${p.label} · ${esc(p.name)}</span><span>uses ${p.cost} of ${c.pointsLeft} pts ✓${p.left ? ` (${p.left} spare)` : ''}</span></div>
      <ol>${p.picks.map((x) => `<li><span class="step ${x.step === 'Now' ? 'now' : ''}">${x.step}</span>${monLine(x.id, `<span class="chip">${x.cost} pts</span>`)}
        ${reasonList(x.why)}${x.step === 'Now' ? ` <button data-copy="${esc(pickMsg(x.id, x.cost))}">Copy pick message</button>` : ''}</li>`).join('')}</ol>
      <div class="small">${p.fixes.length ? `Fixes: ${p.fixes.map((f) => `<span class="chip ok">${esc(f)} ✓</span>`).join('')}` : ''}
        ${p.missing.length ? ` Still missing: ${p.missing.map((f) => `<span class="chip">${esc(f)}</span>`).join('')}` : ''}
        ${p.stacked.length ? ` ${term('Stacked weakness')}: ${p.stacked.map((t) => `<span class="chip unc">${t}</span>`).join('')}` : ''}</div>
      <details class="small"><summary>Why? (score breakdown)</summary>Value ${p.score.value} · Roles ${p.score.roles} · Defense ${p.score.defense} · Threat coverage ${p.score.threats} · Synergy ${p.score.synergy} · Price ${p.score.price} → total ${p.score.total} (+${p.gain} vs now).
        <p class="explainer">Value = meta tier of the 6 you'd bring most (the rest count 35%). Roles = the checklist, with less credit for each extra holder. Defense = shared weaknesses, judged per form. Threat coverage = −3 for each opponent A/S-tier mon nobody on your team resists. Synergy = partners that use your sun, rain, sand, snow or Trick Room. Price = 0.5 × board points (unspent points are wasted).</p></details>
    </div>`).join('') : '<p>No feasible plan found.</p>';
  // Affordable picks first; picks that break the budget stay visible below a divider.
  // The pick-* classes let phones show each row as a card (styles.css .picks): full-width Why, then the actions.
  const ok = P.singles.filter((x) => aff.get(x.id)?.status !== 'breaks').slice(0, 12);
  const over = P.singles.filter((x) => aff.get(x.id)?.status === 'breaks').slice(0, 5);
  const row = (s) => {
    const a = aff.get(s.id); const [cls, label] = AFF[a?.status || 'ok'];
    return `<tr class="pick-row"><td class="pick-mon">${monLine(s.id, `<span class="chip">${s.cost} pts</span>`)}</td><td class="pick-budget"><span class="chip ${cls}">${label}</span><div class="small muted">${esc(a?.reason)}</div></td>
      <td class="pick-why">${reasonList(s.why)}${s.inPlans.length ? `<span class="small muted">In plan ${s.inPlans.join(', ')}</span>` : ''}</td>
      <td class="pick-act">${a?.status === 'breaks' ? '<button disabled title="This pick makes a 10-mon roster impossible">Blocked</button>' : `<button data-check="${s.id}">Check</button> <button data-copy="${esc(pickMsg(s.id, s.cost))}">Copy pick</button>`}</td></tr>`;
  };
  const singles = ok.map(row).join('') + (over.length ? `<tr class="picks-divider"><td colspan="4" class="small muted"><b>Can't afford without breaking your roster</b></td></tr>${over.map(row).join('')}` : '');
  return `<div class="cols"><div>${checkPanel(c)}
    <div class="panel"><div class="tabs"><button data-dtab="plans" class="${tab === 'plans' ? 'active' : ''}">Roster plans</button><button data-dtab="singles" class="${tab === 'singles' ? 'active' : ''}">Best single picks</button></div>
      <p class="explainer">Suggestions, not orders. Each plan is a complete, affordable set for all ${c.slotsLeft} remaining slots, built only from mons still available. "Now" is the pick to make first. Plans start with different picks so you get real alternatives. They recompute on every reload.</p>
      ${tab === 'plans' ? planHtml : `<div class="scroll"><table class="picks"><tr class="picks-head"><th>Mon</th><th>${term('Budget', 'Affordable / Tight / Breaks budget')}</th><th>Why</th><th></th></tr>${singles}</table></div>`}
    </div></div><div>${budgetPanel(c)}${synergyPanel(myIds(c))}${checklistPanel(myIds(c), true)}${weaknessSnapshot(myIds(c))}</div></div>`;
}

// ---------- My team ----------
function checklistPanel(ids, compact = false) {
  const rows = roleChecklist(dex, ids);
  const missing = rows.filter((r) => !r.met);
  return `<div class="panel"><h2>${compact ? 'Your team needs' : 'Role checklist'}</h2>
    <p class="verdict">${missing.length ? `Missing: ${missing.slice(0, 3).map((r) => r.label).join(', ')}${missing.length > 3 ? '…' : ''}` : 'Every checklist role is covered.'}</p>
    <table>${rows.map((r) => `<tr><td>${term(r.label, r.term)}</td><td class="${r.met ? 'check-ok' : 'check-no'}">${r.met ? '✓' : '✗'} ${r.count} of ${r.target}</td>
      <td class="small">${esc(r.holders.join(', ')) || '<span class="muted">nobody yet</span>'}</td></tr>`).join('')}</table>
    <p class="explainer">From the strategy guide's roster checklist. A role counts if any form (including Megas) provides it.</p></div>`;
}
function weaknessSnapshot(ids) {
  const rows = weaknessMatrix(dex, ids).filter((r) => r.weak > r.resist + r.immune).sort((a, b) => a.net - b.net).slice(0, 4);
  return `<div class="panel"><h2>Weakness snapshot</h2>${rows.length ? rows.map((r) => `<div>${r.stacked ? '⚠ ' : ''}<b>${r.type}</b>: ${r.weak} can be weak, ${r.resist} resist, ${r.immune} immune</div>`).join('') : '<p>No type hits more of your mons than you resist.</p>'}</div>`;
}
function renderTeam() {
  const c = me(), ids = myIds(c);
  if (!ids.length) return `<div class="panel">${esc(c.name)} has no picks yet.</div>`;
  const nums = new Map(); ids.forEach((id) => nums.set(sp(id).num, [...(nums.get(sp(id).num) || []), sp(id).name]));
  const dup = [...nums.values()].filter((v) => v.length > 1);
  const megaMons = ids.filter((id) => sp(id).forms.some((f) => f.mega));
  const cards = c.picks.map((p) => p.id ? `<div class="coach-card">${monLine(p.id, `<span class="chip">${p.points} pts</span>`)}
      <div style="margin-top:6px">${sp(p.id).forms.map((f, i) => `<span class="chip form ${i === 0 ? 'on' : ''}" data-mon="${p.id}" data-form="${i}">${i === 0 ? 'Base' : esc(f.name.replace(sp(p.id).name + '-', ''))}</span>`).join('')}</div>
      <div class="small muted">${sp(p.id).roles.filter((r) => !['setup', 'status', 'disruption'].includes(r)).slice(0, 8).join(' · ')}</div></div>`
    : `<div class="coach-card"><span class="chip unc">Unmatched: ${esc(p.en)}</span> ${p.points} pts</div>`).join('');
  return `<div class="panel"><h2>${esc(c.name)}'s roster (${c.picks.length}/${ROSTER_SIZE})</h2>
      ${megaMons.length > 1 ? `<p class="explainer">${megaMons.length} of these can Mega Evolve, but only <b>one</b> Mega per battle (${term('Mega Evolution')}). Pick the Mega per matchup.</p>` : ''}
      ${dup.length ? `<p class="banner warn">${term('Species clause')}: ${dup.map((d) => d.join(' + ')).join('; ')} can't be on the same team of 6.</p>` : ''}
      <div class="coach-grid">${cards}</div></div>
    ${synergyPanel(ids)}${coresTeamPanels()}${matrixPanel(ids)}${checklistPanel(ids)}${speedPanel(ids)}`;
}
// My team: "Cores with thin or no answers" and "Who carries your answers" (hidden when the core data failed to load).
function coresTeamPanels() {
  const v = coresView();
  return v ? coresSafe(() => renderThinPanel(v), '') + coresSafe(() => renderCarriesPanel(v, { state: S.cores }), '') : '';
}

// ---------- Synergy ----------
const SYN = { strong: ['ok', 'Strong'], thin: ['tight', 'Thin'], none: ['unc', 'No partners'] };
function synergyPanel(ids) {
  const on = synergies(dex, ids).filter((s) => s.status !== 'off');
  if (!on.length) return `<div class="panel"><h2>Team synergies</h2><p class="small muted">Nobody on this roster sets weather or Trick Room yet.</p></div>`;
  const c = me(), aff = c.slotsLeft ? affMap(c) : new Map();
  const rows = on.map((s) => {
    const mode = SYNERGY_MODES.find((m) => m.key === s.key);
    const [cls, label] = SYN[s.status];
    const partners = s.partners.map((p) => `<span class="chip ${p.strength === 1 ? 'ok' : ''}" title="${p.strength === 1 ? 'Strong partner' : 'Helps'}: ${esc(p.why)}">${esc(p.name)} · ${esc(p.why)}</span>`).join('') || '<span class="muted small">nobody uses it yet</span>';
    // Board suggestions: affordable partners for modes that still need help, best value first.
    const ideas = s.status === 'strong' || !c.slotsLeft ? [] : available()
      .filter((m) => sp(m.id) && !mode.setter(sp(m.id)) && aff.get(m.id)?.status !== 'breaks')
      .map((m) => ({ ...m, p: mode.partner(sp(m.id)) })).filter((m) => m.p)
      .sort((a, b) => b.p.strength - a.p.strength || 'SABCD'.indexOf(sp(a.id).tier) - 'SABCD'.indexOf(sp(b.id).tier) || a.cost - b.cost).slice(0, 5);
    return `<tr><td>${term(s.label, s.term)}<div class="small muted">set by ${esc(s.setters.join(', '))}</div></td><td><span class="chip ${cls}">${label}</span></td>
      <td>${partners}${ideas.length ? `<div class="small" style="margin-top:4px">On the board: ${ideas.map((m) => `<button class="linkish" data-check="${m.id}" title="Check this pick">${esc(sp(m.id).name)} ${m.cost}</button>`).join(' ')}</div>` : ''}</td></tr>`;
  }).join('');
  const weak = on.filter((s) => s.status !== 'strong').map((s) => s.label);
  return `<div class="panel"><h2>Team synergies</h2>
    <p class="verdict">${weak.length ? `${weak.join(', ')} ${weak.length > 1 ? 'have' : 'has'} a setter but little or no one to use it.` : 'Every setter has partners that use it.'}</p>
    <table>${rows}</table>
    <p class="explainer">A setter is only worth its slot if teammates gain from it. Strong partners (green) have an ability built for it (Swift Swim in rain, Chlorophyll in sun) or are slow hitters under Trick Room (base Speed 45 or less). Others just hit harder. Plans give credit for up to 2 partners per setter. Click a board suggestion to check it as a pick.</p></div>`;
}
function matrixPanel(ids) {
  const rows = weaknessMatrix(dex, ids);
  const mons = ids.map(sp);
  const cols = S.showForms ? mons.flatMap((m) => m.forms.map((f, i) => ({ m, f, i }))) : mons.map((m) => ({ m }));
  const flagged = rows.filter((r) => r.stacked);
  const top = rows.filter((r) => r.weak > r.resist + r.immune).sort((a, b) => a.net - b.net).slice(0, 3);
  const cell = (r, col) => {
    const c = r.cells.find((x) => x.id === col.m.id);
    if (col.f) { const v = c.forms[col.i].mult; return `<td class="${multClass(v)}">${mult(v)}</td>`; }
    const title = c.forms.map((f) => `${f.form}: ${mult(f.mult) || '×1'}`).join('\n');
    return `<td class="${multClass(c.worst)}" title="${esc(title)}">${c.varies ? `${mult(c.best) || '×1'}–${mult(c.worst) || '×1'}<sup>*</sup>` : mult(c.worst)}</td>`;
  };
  return `<div class="panel"><h2>Weakness grid</h2>
    <p class="verdict">${top.length ? 'Biggest problems: ' + top.map((r) => `${r.type} (${r.weak} can be weak, ${r.resist + r.immune} resist/immune)`).join('; ') : 'No type hits more of your mons than you resist.'}</p>
    ${flagged.length ? `<p class="banner warn">⚠ ${term('Stacked weakness')}: ${flagged.map((r) => r.type).join(', ')}, with no answer yet.</p>` : ''}
    <label><input type="checkbox" id="showForms" ${S.showForms ? 'checked' : ''}> Show every form (Mega columns)</label>
    <div class="scroll"><table class="matrix"><tr><th>Attack</th>${cols.map((c) => `<th>${esc(c.f ? c.f.name : c.m.name)}</th>`).join('')}<th>Weak</th><th>Resist</th><th>Immune</th><th>Net</th></tr>
    ${rows.map((r) => `<tr class="${r.stacked ? 'flag' : ''}"><td>${r.type}</td>${cols.map((c) => cell(r, c)).join('')}<td>${r.weak}</td><td>${r.resist}</td><td>${r.immune}</td><td>${r.net > 0 ? '+' : ''}${r.net}</td></tr>`).join('')}</table></div>
    <p class="explainer">${term('Super-effective / resist / immune')}. A mon counts as weak if <i>any</i> of its forms is weak (a range like ½–×2* means it depends on the form; hover for each form), and as resisting if any form resists, since you choose the form. Abilities like Levitate count only when the form has that one ability.</p></div>`;
}
function speedPanel(ids) {
  const mine = speedRows(dex, ids, { tailwind: S.tailwind, trickRoom: S.trickRoom });
  const opp = S.speedOpp ? speedRows(dex, myIds(L.coaches.find((x) => x.name === S.speedOpp)), { trickRoom: S.trickRoom, side: 'theirs' }) : [];
  const rows = [...mine, ...opp].sort((a, b) => (S.trickRoom ? a.speed - b.speed : b.speed - a.speed));
  const max = Math.max(...rows.map((r) => r.speed), 1);
  return `<div class="panel ladder"><h2>Speed ladder</h2>
    <div class="filters"><label><input type="checkbox" id="tw" ${S.tailwind ? 'checked' : ''}> ${term('Tailwind')} (mine)</label>
      <label><input type="checkbox" id="tr" ${S.trickRoom ? 'checked' : ''}> ${term('Trick Room')}</label>
      <label>Compare with <select id="speedOpp"><option value="">nobody</option>${L.coaches.filter((x) => x.name !== S.coach).map((x) => `<option ${x.name === S.speedOpp ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label></div>
    <p class="explainer">${S.trickRoom ? 'Trick Room is on: lower moves first.' : 'Higher moves first.'} Level 50, ${term('max Speed', 'Stat Points (SP)')} (32 SP, +Speed nature); slow Trick Room mons use minimum Speed under Trick Room. Megas are separate rows (M).</p>
    ${rows.map((r) => `<div class="row ${r.side} ${r.mega ? 'mega' : ''}"><span class="nm2">${esc(r.form)}${r.side === 'theirs' ? ` <span class="small muted">(${esc(S.speedOpp)})</span>` : ''}</span>
      <b>${r.speed}${r.tie ? ' =' : ''}</b><span class="bar" style="width:${Math.max(4, 100 * r.speed / max)}%" title="${r.invest}${r.tie ? ' · speed tie: 50/50 who moves first' : ''}"></span></div>`).join('')}</div>`;
}

// ---------- League ----------
function renderLeague() {
  const c = me(), aff = affMap(c), f = S.boardFilter;
  const roles = [...new Set(Object.values(dex.species).flatMap((m) => m.roles))].sort();
  const q = f.q.trim().toLowerCase();
  const tiers = [...new Set(L.board.map((b) => b.points))].sort((a, b) => b - a);
  const initials = (n) => n.replace(/\(.*\)/, '').slice(0, 3);
  const board = tiers.map((pts) => {
    const cells = L.board.filter((b) => b.points === pts).filter((b) => {
      const m = b.id && sp(b.id);
      if (q && !(b.en.toLowerCase().includes(q) || (b.zh || '').includes(f.q.trim()) || (m && m.name.toLowerCase().includes(q)))) return false;
      if (f.role && !(m && m.roles.includes(f.role))) return false;
      if (f.type && !(m && m.forms.some((x) => x.types.includes(f.type)))) return false;
      if (f.hideTaken && b.taken) return false;
      if (f.affordable && (b.taken || aff.get(b.id)?.status === 'breaks')) return false;
      return true;
    }).map((b) => {
      const a = !b.taken && aff.get(b.id); const m = b.id && sp(b.id);
      const megas = m ? m.forms.filter((x) => x.mega).length : 0;
      return `<span class="cell ${b.taken ? 'taken' : ''} ${b.takenBy === S.coach ? 'mine' : ''} ${a?.status === 'breaks' ? 'breaks' : ''}" data-mon="${b.id || ''}" title="${esc(a?.reason || (b.taken ? `Taken by ${b.takenBy || 'unknown'}` : ''))}">
        <span class="tn">${esc(m ? m.name : b.en)} <span lang="zh">${esc(b.zh)}</span></span>${megas ? ` <b>M${megas > 1 ? '×' + megas : ''}</b>` : ''}
        ${b.taken ? `<span class="owner">${esc(b.takenBy ? initials(b.takenBy) : '?')}</span>` : a ? `<span class="chip ${AFF[a.status][0]}">${AFF[a.status][1]}</span>` : '<span class="chip unc">unmatched</span>'}</span>`;
    });
    return cells.length ? `<div class="tier"><h3>${pts} pts</h3><div class="cells">${cells.join('')}</div></div>` : '';
  }).join('');
  const coaches = L.coaches.map((x) => {
    const b = budgetSummary(x.pointsLeft, x.slotsLeft, available().map((a) => a.cost));
    const missing = roleChecklist(dex, myIds(x)).filter((r) => !r.met && r.weight >= 4).map((r) => r.label);
    return `<div class="coach-card ${x.name === S.coach ? 'me' : ''}"><b>${x.order}. ${esc(x.name)}</b> ${b.feasible ? '' : '<span class="chip breaks">Infeasible</span>'}${x.name !== S.coach ? ` <button class="linkish" data-prep-vs="${x.order}">Battle Prep vs ${esc(x.name)}</button>` : ''}
      <div class="small">${x.pointsLeft} pts · ${x.slotsLeft} slots · avg ${b.avgPerSlot} · max next pick ${b.maxThisPick}</div>
      <div class="small muted">${x.slotsLeft ? `Can still afford: up to ${b.maxThisPick}-pt mons` : 'Roster complete'}</div>
      <div class="small">${x.picks.map((p) => `${esc(p.id ? sp(p.id).name : p.en)} ${p.points}`).join(' · ')}</div>
      ${missing.length && x.slotsLeft ? `<div class="small">Needs: ${missing.slice(0, 4).map((m) => `<span class="chip">${esc(m)}</span>`).join('')}</div>` : ''}</div>`;
  }).join('');
  const opp = S.threatScope === 'all' ? opponents(c) : opponents(c).filter((o) => o.coach === S.threatScope);
  const threats = threatList(dex, myIds(c), opp);
  const st = { Answered: 'ans', Thin: 'thin', Unchecked: 'unc' };
  const counts = Object.fromEntries(['Answered', 'Thin', 'Unchecked'].map((k) => [k, threats.filter((t) => t.status === k).length]));
  const coresV = coresView();
  const cores = coresV ? coresSafe(() => renderCoresPanel(coresV, { scope: S.threatScope, state: S.cores, narrow: narrowScreen.matches, fetchedAt: sheet.fetchedAt }), renderCoresError()) : renderCoresError();
  return `<div class="panel"><h2>Coaches</h2><p class="explainer">Budget math is the same 10-mon feasibility rule for everyone. A coach can't snipe a mon priced above their max next pick.</p><div class="coach-grid">${coaches}</div></div>
    ${cores}
    <div class="panel"><h2>Threats to ${esc(c.name)}</h2>
      <p class="verdict">${counts.Unchecked} unchecked, ${counts.Thin} thin, ${counts.Answered} answered.</p>
      <div class="filters">Scope <select id="threatScope"><option value="all">All ${L.coaches.length - 1} opponents</option>${L.coaches.filter((x) => x.name !== c.name).map((x) => `<option value="${esc(x.name)}" ${S.threatScope === x.name ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>
      <p class="explainer">${term('Answered / Thin / Unchecked')}. Estimate from types and speed (no damage calc). Each threat is judged by its most dangerous form, Megas included.</p>
      <div class="scroll"><table><tr><th>Threat</th><th>Coach</th><th>Why (estimate)</th><th>Your answers</th><th>Status</th></tr>
      ${threats.map((t) => `<tr><td>${monLine(t.id)}</td><td>${esc(t.coach)}</td><td class="small">${esc(t.why)}</td><td>${t.answers.map((a) => `<span class="chip">${esc(a)}</span>`).join('') || '—'}</td><td><span class="chip ${st[t.status]}">${t.status}</span></td></tr>`).join('')}</table></div></div>
    <div class="panel"><h2>Board</h2>
      <div class="filters"><input id="bq" placeholder="Search 英文 / 中文…" value="${esc(f.q)}">
        <select id="brole"><option value="">Any role</option>${roles.map((r) => `<option ${f.role === r ? 'selected' : ''}>${r}</option>`).join('')}</select>
        <select id="btype"><option value="">Any type</option>${dex.types.map((t) => `<option ${f.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
        <label><input type="checkbox" id="bhide" ${f.hideTaken ? 'checked' : ''}> Hide taken</label>
        <label><input type="checkbox" id="baff" ${f.affordable ? 'checked' : ''}> Only what ${esc(c.name)} can afford</label></div>
      <p class="explainer">Taken mons are struck through with the owner's initials. ${term('Affordable / Tight / Breaks budget')} is for ${esc(c.name)}. <b>M</b> = comes with Mega form(s).</p>
      ${board || '<p>No mons match these filters.</p>'}</div>`;
}

// ---------- Learn / Setup ----------
function rulesHtml() {
  return `<div class="panel"><h2>League rules</h2><ul>
    <li><b>Exactly ${ROSTER_SIZE} Pokémon on ${BUDGET} points</b> per coach. Prices run 1–20. The app blocks any pick that would make a full roster impossible.</li>
    <li><b>Megas come free with their base species.</b> Drafting Charizard gives base Charizard, Mega Charizard X and Mega Charizard Y.</li>
    <li><b>Only one Mega Evolution per battle.</b> A second Mega-capable mon adds team-preview choice, not a second Mega.</li>
    <li><b>${term('Species clause')}</b>: one of each Pokédex number per team (one Rotom form, one Tauros form, …). A coach may still draft several forms.</li>
    <li>Format: Pokémon Champions VGC 2026 Reg M-C (Showdown <code>gen9championsvgc2026regmc</code>): doubles, ${term('Bring 6, pick 4')}, Level 50, item clause.</li>
    <li>Draft order: ${S.order === 'snake' ? 'snake (1→10, then 10→1)' : 'linear (1→10 every round)'}. Change it in Setup.</li></ul></div>`;
}
function renderLearn() {
  return `${rulesHtml()}<div class="panel"><h2>Glossary</h2><dl class="gloss">${Object.entries(GLOSSARY).map(([k, g]) => `<dt>${esc(k)}</dt><dd>${esc(g.def)} <span class="explainer">${esc(g.why)}</span></dd>`).join('')}</dl></div>`;
}
function renderSetup() {
  const ids = Object.keys(dex.species).sort();
  return `<div class="panel"><h2>Setup</h2>
    <p>Coach: pick yourself (or anyone, to view their side) in the top bar. Default: Anthony (coach 5).</p>
    <p><label>Draft order <select id="order"><option value="snake" ${S.order === 'snake' ? 'selected' : ''}>Snake</option><option value="linear" ${S.order === 'linear' ? 'selected' : ''}>Linear</option></select></label></p>
    <p class="explainer">Sheet: the league's published Google Sheet, re-read on every page load. Usage data: ${usage ? `Smogon ${esc(usage.month)} (${esc(usage.info?.metagame)}, 1760+ cutoff${usage.stale ? ', cached copy' : ''})` : usageError ? `offline (${esc(usageError)}); recommendations use types, roles and tiers only` : 'loading…'}.</p></div>
    <div class="panel"><h2>Name fixes</h2>
    ${L.unmatched.length ? L.unmatched.map((u) => `<div class="filters"><b>${esc(u.raw)}</b> <span class="muted small">(${esc(u.where)})</span>
      <select data-alias="${esc(u.raw)}">${u.suggestions.map((s) => `<option value="${s.id}">${esc(sp(s.id).name)} (${s.confidence}%)</option>`).join('')}<option disabled>──────</option>${ids.map((id) => `<option value="${id}">${esc(sp(id).name)}</option>`).join('')}</select>
      <button class="primary" data-accept="${esc(u.raw)}">Accept</button></div>`).join('') : '<p>All sheet names are matched.</p>'}
    ${Object.keys(S.aliases).length ? `<h3>Saved fixes</h3>${Object.entries(S.aliases).map(([k, v]) => `<div>${esc(k)} → ${esc(sp(v)?.name || v)} <button data-unalias="${esc(k)}">Remove</button></div>`).join('')}` : ''}</div>`;
}

// ---------- drawer ----------
function openDrawer(id, formIdx = 0) {
  const m = sp(id); if (!m) return;
  const f = m.forms[formIdx], b = L.board.find((x) => x.id === id), a = affMap().get(id);
  const u = usage?.species?.[f.id] || usage?.species?.[id];
  const stats = Object.entries(f.baseStats);
  const d = $('#drawer');
  d.hidden = false; document.querySelector('.layout').classList.remove('nodrawer');
  d.innerHTML = `<button class="close" aria-label="Close">✕</button>
    <div class="mon">${sprite(f)}<div><b>${esc(m.name)}</b> <span lang="zh">${esc(zhOf(id))}</span><br>${f.types.map(typeTag).join('')}</div></div>
    <p>${b ? `${b.points} pts · ${b.taken ? `taken by ${esc(b.takenBy || 'unknown')}` : a ? `<span class="chip ${AFF[a.status][0]}">${AFF[a.status][1]}</span> <span class="small">${esc(a.reason)}</span> <button data-check="${id}">Check this pick</button>` : ''}` : ''} · ${term('Meta tier', 'Meta tier (S–D)')} <b>${m.tier}</b></p>
    <div>${m.forms.map((x, i) => `<span class="chip form ${i === formIdx ? 'on' : ''}" data-mon="${id}" data-form="${i}">${i === 0 ? 'Base' : esc(x.name.replace(m.name + '-', ''))}</span>`).join('')}</div>
    ${f.mega ? `<p class="small">Holds ${esc(f.stone)}. ${term('Mega Evolution')}: one per battle.</p>` : ''}
    <p class="small">Abilities: ${esc(f.abilities.join(' / '))}</p>
    <table>${stats.map(([k, v]) => `<tr><td>${k.toUpperCase()}</td><td>${v}</td><td style="width:60%"><div class="meter" style="margin:0"><span class="spent" style="width:${Math.min(100, v / 1.6)}%"></span></div></td></tr>`).join('')}
      <tr><td>BST</td><td>${stats.reduce((s, [, v]) => s + v, 0)}</td><td class="small">Speed: ${f.baseStats.spe + 52} neutral / ${Math.floor((f.baseStats.spe + 52) * 1.1)} max / ${Math.floor((f.baseStats.spe + 20) * 0.9)} min</td></tr></table>
    <p class="small">Roles: ${m.roles.map((r) => `<span class="chip">${r}</span>`).join('')}</p>
    ${m.keyMoves.length ? `<p class="small">Key moves: ${esc(m.keyMoves.join(', '))}</p>` : ''}
    <p class="small">${esc(m.notes)}</p>
    ${m.altFormes ? `<p class="small muted">Other forms not on the board: ${esc(m.altFormes.join(', '))} (ask the league whether they come with this pick).</p>` : ''}
    ${u ? `<h3>Ladder usage (Smogon ${esc(usage.month)}, not this league)</h3><p class="small">${u.usage}% of teams. Moves: ${esc(u.moves.slice(0, 6).map(([k, v]) => `${k} ${v}%`).join(', '))}<br>Items: ${esc(u.items.slice(0, 4).map(([k, v]) => `${k} ${v}%`).join(', '))}<br>Teammates: ${esc(u.teammates.slice(0, 5).map(([k]) => k).join(', '))}</p>`
      : m.pika ? `<p class="small">Pikalytics: ${m.pika.pct}% usage, rank ${m.pika.rank}, win rate ${m.pika.winrate}%.</p>` : ''}
    <p class="small"><a href="https://www.pikalytics.com/pokedex/gen9championsvgc2026regmc/${encodeURIComponent(f.name)}" target="_blank" rel="noopener">Pikalytics</a> · <a href="https://calc.pokemonshowdown.com/" target="_blank" rel="noopener">Damage calc</a></p>`;
}

// ---------- Prep ----------
function markMode() {
  document.body.dataset.mode = S.mode;
  // two apps: Battle Prep (mode prep) and Draft (every other mode); the switch marks the current one
  const app = S.mode === 'prep' ? 'prep' : 'draft';
  document.body.dataset.app = app;
  document.querySelectorAll('#modes button').forEach((b) => b.classList.toggle('active', b.dataset.mode === S.mode));
  const unsaved = !!prep?.P?.saveError;
  document.querySelectorAll('.appswitch a').forEach((a) => {
    const on = a.dataset.appLink === app;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    if (a.dataset.appLink === 'prep') { a.classList.toggle('warn', unsaved); a.setAttribute('aria-label', unsaved ? 'Battle Prep: changes not saved' : 'Battle Prep'); }
  });
}
function download(name, text, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
// This tab's session storage, for Prep's unfinished screen work (kept across a reload or a phone discarding the tab).
const tabStorage = (() => { try { return sessionStorage; } catch { return null; } })();
// localStorage itself can throw (storage blocked); Prep then reports that saving isn't possible instead of crashing.
const deviceStorage = (() => {
  try { return localStorage; } catch (e) {
    const fail = () => { throw e; };
    return { getItem: fail, setItem: fail, removeItem: fail, key: fail, get length() { return fail(); } };
  }
})();
// What Prep may use. Clipboard, share and storage protection run only from a tap on the matching button.
const prepApp = {
  get dex() { return dex ?? { species: {}, types: [] }; },
  league: () => L ?? null, sheet: () => sheet ?? null, usage: () => usage, coresCx: () => coreCx,
  viewingCoach: () => (viewingAs ? viewingAs.coach : S.coach),
  // public/prep.js SHELL_VERSION: a Prep from another release refuses to run in this shell. (This shell doesn't check Prep's
  // version; an older Prep here would read perspective workspaces as newer and stay read-only.)
  shellVersion: 2,
  /** The Draft coach setting as stored, or the shipped default when nothing is stored. Never the seat-5 stand-in. */
  identityHint() {
    try {
      const raw = localStorage.getItem('drafarig.coach');
      const v = raw === null ? null : JSON.parse(raw);
      return typeof v === 'string' && v ? { name: v, source: 'setting' } : { name: DEFAULT_COACH, source: 'default' };
    } catch { return { name: DEFAULT_COACH, source: 'default' }; }
  },
  portrait: (id, opts) => portrait(id, opts),
  sheetFailed: () => sheetFailed,
  goMode: (m) => goTo(m), toast: (m) => toast(m), announce: (m) => announce(m), rerender: () => render(),
  viewAs(coach, back) {
    viewingAs = { coach: viewingAs?.coach ?? S.coach, back };
    setCoach(coach); goTo('league');
  },
  storage: deviceStorage, session: tabStorage, crypto: globalThis.crypto, history, location, now: () => new Date().toISOString(),
  loadMechanics: () => fetch('/data/mechanics.json').then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
  download,
  copyText: (text) => navigator.clipboard.writeText(text),
  readClipboard: navigator.clipboard?.readText ? () => navigator.clipboard.readText() : null,
  share: navigator.share ? (d) => navigator.share(d) : null,
  persist: navigator.storage?.persist ? { persisted: () => navigator.storage.persisted(), persist: () => navigator.storage.persist() } : null,
  appBuild: '',
};
function loadPrep() {
  prepLoading ??= import('/prep.js').then((m) => {
    prep = m.createPrep(prepApp);
    prepGlossary = m.GLOSSARY_PREP ?? {};
    prepFailed = false;
    if (isPrepHash(location.hash.slice(1))) prep.applyHash(location.hash);
    if (pendingVs !== null) { const seat = pendingVs; pendingVs = null; prep.openVs?.(seat); }
    // navigator.storage.persisted() only reads the state; it never asks the user anything.
    prepApp.persist?.persisted().then((v) => prep.setPersisted(v), () => {});
    render();
  }).catch((e) => { console.error('Prep failed to load:', e && e.message); prepFailed = true; prepLoading = null; render(); });
  return prepLoading;
}
function renderPrep(main) {
  if (!prep) {
    main.innerHTML = prepFailed
      ? `<div class="panel"><h2>Prep couldn't load</h2><p>Your saved prep is still on this device. Check your connection and try again.</p><button class="primary" data-prep-retry="">Try again</button></div>`
      : '<div class="panel"><h2>Prep</h2><p class="skeleton">Opening your prep…</p></div>';
    shownMode = null;
    if (!prepFailed) loadPrep();
    return;
  }
  // A Prep navigation starts at the top with focus on the new heading; a "go to this section" moves to that section; a
  // re-render of the same screen keeps scroll and focus.
  const target = prep.consumeFocus();
  const nav = target === 'prep-h';
  const same = shownMode === 'prep' && !nav;
  const scroll = same ? window.scrollY : 0;
  const focused = same && !target ? prepFocusKey(document.activeElement, main) : null;
  const caret = focused ? document.activeElement?.selectionStart ?? null : null; // typing in a field that re-renders keeps its place
  const strip0 = document.querySelector('.oppstrip ol');
  const stripLeft = strip0 ? strip0.scrollLeft : null;
  main.innerHTML = prep.render();
  shownMode = 'prep';
  keepOppStrip(stripLeft);
  window.scrollY !== scroll && window.scrollTo(0, scroll);
  const el = target && document.getElementById(target);
  if (el) { if (!nav) el.scrollIntoView?.({ block: 'start' }); el.focus?.({ preventScroll: true }); }
  else for (const c of prepFocusCandidates(main, focused)) {
    c.focus?.({ preventScroll: true });
    if (document.activeElement === c) { if (caret !== null) try { c.setSelectionRange?.(caret, caret); } catch { /* not a text field */ } break; }
  }
}
// The opponent row is rebuilt on every Prep render: the same row keeps where the user scrolled it; a new opponent (or
// perspective) centres its tab. scrollLeft only, so the page itself never jumps (scrollIntoView could scroll vertically).
let shownStrip = null;
function keepOppStrip(left) {
  const ol = document.querySelector('.oppstrip ol');
  const key = prep?.stripKey?.() ?? null;
  if (ol) {
    if (key && key === shownStrip && left !== null) ol.scrollLeft = left;
    else {
      const a = ol.querySelector?.('[aria-current="page"]');
      if (a) ol.scrollLeft = Math.max(0, a.offsetLeft - (ol.clientWidth - a.offsetWidth) / 2);
    }
  }
  shownStrip = ol ? key : null;
}
// Prep controls without an id are found again by their action and arguments (all their data-* attributes).
const PREP_ATTRS = ['data-pa', 'data-pc', 'data-pi'];
function prepFocusKey(el, root) {
  if (el && !el.id && el.attributes && PREP_ATTRS.some((a) => el.hasAttribute?.(a)) && root.contains?.(el)) {
    return { prep: [...el.attributes].filter((a) => a.name.startsWith('data-')).map((a) => [a.name, a.value]), tag: el.tagName };
  }
  return focusKey(el, root);
}
function prepFocusCandidates(root, k) {
  if (!k?.prep) return focusCandidates(root, k);
  const sel = k.prep.map(([n, v]) => `[${n}="${CSS.escape(v)}"]`).join('');
  return [...root.querySelectorAll(`${k.tag.toLowerCase()}${sel}`)].slice(0, 1);
}
function setCoach(name) { S.coach = name; coachIsFallback = false; S.speedOpp = ''; S.threatScope = 'all'; S.check = ''; planCache = null; S.cores = { open: {}, more: false, showAll: {} }; }
function endViewAs() {
  const v = viewingAs;
  viewingAs = null;
  setCoach(v.coach); goTo('prep');
  v.back?.();
}
function onHashChange() {
  const h = location.hash.slice(1);
  if (isPrepHash(h)) {
    if (prep) prep.applyHash(location.hash);
    if (S.mode !== 'prep') { S.mode = 'prep'; save(); }
    render();
  } else if (MODES.includes(h) && h !== S.mode) {
    if (S.mode === 'prep' && prep) { prep.flush?.(); prep.saveUi?.(); }
    lastDraftMode = h; S.mode = h; save(); render();
  }
}

// ---------- render + events ----------
let shownMode = null; // the screen #main shows now
function render() {
  if (S.mode === 'prep') {
    document.body.classList.toggle('facts', !S.explain);
    $('#explain').checked = S.explain;
    if (L) renderTop(); else markMode();
    return renderPrep($('#main'));
  }
  if (!L) return;
  document.body.classList.toggle('facts', !S.explain);
  $('#explain').checked = S.explain;
  renderTop();
  const views = { draft: renderDraft, team: renderTeam, league: renderLeague, learn: renderLearn, setup: renderSetup };
  const main = $('#main'), sameScreen = shownMode === S.mode;
  // Same screen: keep the scroll position and put keyboard focus back on the same control (UX §10; QA S1, S2).
  // A screen change starts at the top with no refocus (QA S4); go-to buttons then scroll to their target.
  const scroll = scrollAfterRender(shownMode, S.mode, window.scrollY);
  const focused = sameScreen ? focusKey(document.activeElement, main) : null;
  main.innerHTML = (views[S.mode] || renderDraft)();
  shownMode = S.mode;
  window.scrollY !== scroll && window.scrollTo(0, scroll);
  for (const el of focusCandidates(main, focused)) { el.focus?.({ preventScroll: true }); if (document.activeElement === el) break; }
}
// Switch screens. The URL hash follows, so a reload or a copied link opens the same screen (QA S3). Prep comes back
// to the Prep screen you were on; its hashes carry random ids only.
function goTo(mode) {
  // leaving Battle Prep: pending autosaves are written and screen drafts kept for this tab before Draft renders
  if (S.mode === 'prep' && mode !== 'prep' && prep) { prep.flush?.(); prep.saveUi?.(); }
  if (mode !== 'prep') lastDraftMode = mode;
  S.mode = mode; history.replaceState(null, '', mode === 'prep' && prep ? prep.hash() : '#' + mode); save(); render();
}
/** The app switch: Battle Prep returns to its last screen; Draft returns to the last Draft screen this session. */
const switchApp = (app) => goTo(app === 'prep' ? 'prep' : lastDraftMode);
/** "Battle Prep vs <coach>" from Draft: the matchup from your Battle Prep perspective. */
function prepVs(seat) { goTo('prep'); if (prep) prep.openVs?.(seat); else pendingVs = seat; }
// While viewing League as an opponent, your own coach is what stays saved; a stand-in coach (the stored one isn't on the
// sheet) is never saved over your setting.
const save = () => { if (!coachIsFallback || viewingAs) store.set('coach', viewingAs ? viewingAs.coach : S.coach); store.set('order', S.order); store.set('explain', S.explain); store.set('mode', S.mode); store.set('aliases', S.aliases); };
// The toast is visual; screen readers get the same words from #live, a status region that stays in the page.
// Longer messages stay up longer.
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; announce(msg); clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), Math.min(6000, 2500 + 30 * String(msg).length)); }
function announce(msg) { const live = $('#live'); if (!live) return; live.textContent = ''; setTimeout(() => { live.textContent = msg; }, 30); }

const modifierClick = (e) => !!(e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || (e.button ?? 0) > 0);
document.addEventListener('click', async (e) => {
  // Battle Prep links (tabs, opponents) are real links: a modified click opens them natively, a plain click routes here
  const sw = e.target.closest('[data-app-link]');
  if (sw?.dataset.appLink) { if (modifierClick(e)) return; e.preventDefault?.(); switchApp(sw.dataset.appLink); return; }
  const pa = e.target.closest('[data-pa]');
  if (pa?.dataset.pa) {
    if (pa.tagName === 'A') { if (modifierClick(e)) return; e.preventDefault?.(); }
    if (S.mode === 'prep' && prep && !pa.disabled) prep.click(pa);
    return;
  }
  const t = e.target.closest('button, .nm, .cell, .chip.form, .term');
  if (!t) return;
  if (t.dataset.mode) goTo(t.dataset.mode);
  else if (t.dataset.prepVs) prepVs(Number(t.dataset.prepVs));
  else if (t.dataset.viewasBack !== undefined) { if (viewingAs) endViewAs(); }
  else if (t.dataset.prepRetry !== undefined) { prepFailed = false; render(); }
  else if (t.dataset.goto) {
    goTo(t.dataset.goto);
    // The target heading has scroll-margin-top, so it lands below the sticky top bar (QA S5).
    const target = t.dataset.focus && document.getElementById(t.dataset.focus);
    if (target) { target.scrollIntoView({ block: 'start' }); target.focus({ preventScroll: true }); }
  }
  else if (t.dataset.coresMore !== undefined) { S.cores.more = !S.cores.more; render(); document.querySelector('[data-cores-more]')?.focus(); }
  else if (t.dataset.coresAll) { const k = t.dataset.coresAll; S.cores.showAll[k] = !S.cores.showAll[k]; render(); document.querySelector(`[data-cores-all="${CSS.escape(k)}"]`)?.focus(); }
  else if (t.dataset.dtab) { S.draftTab = t.dataset.dtab; render(); }
  else if (t.dataset.check !== undefined) { S.check = t.dataset.check; if (S.check) { S.mode = 'draft'; $('#drawer').hidden = true; document.querySelector('.layout').classList.add('nodrawer'); } render(); if (S.check) window.scrollTo(0, 0); }
  else if (t.id === 'sync' || t.id === 'retry') location.reload();
  else if (t.dataset.copy) { try { await navigator.clipboard.writeText(t.dataset.copy); toast('Copied: ' + t.dataset.copy); } catch { prompt('Copy this message:', t.dataset.copy); } }
  else if (t.dataset.accept) { const sel = document.querySelector(`select[data-alias="${CSS.escape(t.dataset.accept)}"]`); S.aliases[t.dataset.accept] = sel.value; save(); rebuild(); render(); toast('Saved name fix'); }
  else if (t.dataset.unalias) { delete S.aliases[t.dataset.unalias]; save(); rebuild(); render(); }
  else if (t.classList.contains('close')) { $('#drawer').hidden = true; document.querySelector('.layout').classList.add('nodrawer'); }
  else if (t.classList.contains('term')) showPop(t, true);
  else if (t.dataset.mon && t.dataset.form !== undefined) openDrawer(t.dataset.mon, +t.dataset.form);
  else if (t.dataset.mon) openDrawer(t.dataset.mon);
});
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset?.pc || t.dataset?.pi) { if (S.mode === 'prep' && prep) prep.change(t); return; }
  if (t.id === 'coach') { viewingAs = null; setCoach(t.value); }
  else if (t.id === 'checkPick') S.check = t.value;
  else if (t.id === 'explain') S.explain = t.checked;
  else if (t.id === 'order') S.order = t.value;
  else if (t.id === 'showForms') S.showForms = t.checked;
  else if (t.id === 'tw') S.tailwind = t.checked;
  else if (t.id === 'tr') S.trickRoom = t.checked;
  else if (t.id === 'speedOpp') S.speedOpp = t.value;
  else if (t.id === 'threatScope' || t.id === 'coreScope') S.threatScope = t.value;
  else if (t.id === 'brole') S.boardFilter.role = t.value;
  else if (t.id === 'btype') S.boardFilter.type = t.value;
  else if (t.id === 'bhide') S.boardFilter.hideTaken = t.checked;
  else if (t.id === 'baff') S.boardFilter.affordable = t.checked;
  else return;
  save(); render();
});
// Remember which cores cards, mon rows and folds are open so a re-render (e.g. a sheet refresh) restores them.
document.addEventListener('toggle', (e) => {
  const d = e.target;
  if (d.tagName === 'DETAILS' && d.dataset.key && d.closest('.cores, .carries')) S.cores.open[d.dataset.key] = d.open;
}, true);
document.addEventListener('input', (e) => {
  if (e.target.dataset?.pi) { if (S.mode === 'prep' && prep) prep.input(e.target); return; }
  if (e.target.id !== 'bq') return;
  S.boardFilter.q = e.target.value;
  const pos = e.target.selectionStart; render();
  const el = $('#bq'); el.focus(); el.setSelectionRange(pos, pos);
});

// Glossary popover: hover/focus on desktop, tap on touch.
function showPop(el) {
  const g = GLOSSARY[el.dataset.term] ?? prepGlossary[el.dataset.term]; if (!g) return;
  const p = $('#pop');
  p.innerHTML = `<b>${esc(el.dataset.term)}</b>${esc(g.def)}<div class="why">Why it matters: ${esc(g.why)}</div>`;
  p.hidden = false;
  const r = el.getBoundingClientRect();
  p.style.left = Math.max(8, Math.min(r.left, innerWidth - p.offsetWidth - 8)) + 'px';
  p.style.top = (r.bottom + 6 + p.offsetHeight > innerHeight ? r.top - p.offsetHeight - 6 : r.bottom + 6) + 'px';
}
const hidePop = () => { $('#pop').hidden = true; };
document.addEventListener('mouseover', (e) => { const t = e.target.closest('.term'); t ? showPop(t) : hidePop(); });
document.addEventListener('focusin', (e) => { const t = e.target.closest('.term'); t ? showPop(t) : hidePop(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    // Battle Prep first: Escape closes an open detail sheet or a pending question (focus goes back with it)
    if (S.mode === 'prep' && prep?.escape?.()) return;
    hidePop(); $('#drawer').hidden = true; document.querySelector('.layout').classList.add('nodrawer');
    return;
  }
  // opponent row: ← → move between opponents, Home / End jump to the ends (links stay reachable by Tab too)
  const a = e.target?.closest?.('.oppstrip a');
  if (a && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
    const all = [...(a.closest('ol')?.querySelectorAll('a') ?? [])];
    const i = all.indexOf(a);
    const next = e.key === 'Home' ? all[0] : e.key === 'End' ? all.at(-1) : all[Math.max(0, Math.min(all.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1)))];
    if (next && next !== a) { e.preventDefault?.(); next.focus(); next.scrollIntoView?.({ inline: 'nearest', block: 'nearest' }); }
  }
});

// ---------- boot ----------
// The sticky top bar wraps on phones. Keep --topbar-h equal to its real height so the scroll-margin-top on the headings
// the app scrolls to (styles.css) clears it (QA S5).
function trackTopbarHeight() {
  const bar = document.querySelector('.topbar');
  const set = () => document.documentElement.style.setProperty('--topbar-h', `${Math.ceil(bar.getBoundingClientRect().height)}px`);
  set();
  if (typeof ResizeObserver === 'function') new ResizeObserver(set).observe(bar); else addEventListener('resize', set);
}

(async function boot() {
  document.querySelector('.layout').classList.add('nodrawer');
  trackTopbarHeight();
  const h = location.hash.slice(1); // deep link: #draft, #team, #league, #learn, #setup, #prep…
  if (MODES.includes(h) || isPrepHash(h)) S.mode = isPrepHash(h) ? 'prep' : h;
  if (!MODES.includes(S.mode)) S.mode = 'draft';
  if (S.mode !== 'prep') lastDraftMode = S.mode;
  // Prep saves when the page is hidden or closed, follows Back/Forward, and notices edits made in another tab.
  // (popstate also fires for typed-in hash changes, so hashchange isn't needed and would render twice.)
  addEventListener('popstate', onHashChange);
  addEventListener('storage', (e) => prep?.onStorage(e));
  addEventListener('pagehide', () => prep?.onHidden());
  document.addEventListener('visibilitychange', () => { if (document.hidden) prep?.onHidden(); });
  try {
    const coresSpec = fetch('/data/cores.json').then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))).catch((e) => e);
    dex = await (await fetch('/data/dex.json')).json();
    if (S.mode === 'prep') render(); // prep doesn't wait for the league sheet
    try { // validateSpec refuses an unsupported or malformed spec; the League panel then shows the error and Threats still works
      const spec = await coresSpec;
      if (spec instanceof Error) throw spec;
      coreCx = coreContext(dex, spec);
    } catch (e) { console.error('Core data unavailable:', e); }
    await loadSheet();
    render();
    loadUsage();
    setInterval(() => sheet && renderTop(), 15000); // keep "Synced Ns ago" honest
    setInterval(refreshSheet, 45000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshSheet(); });
    // Crossing the phone breakpoint changes only the single-opponent forming fold; the cores view is cached, so this is cheap.
    narrowScreen.addEventListener?.('change', () => { if (S.mode === 'league' && S.threatScope !== 'all') render(); });
  } catch (e) {
    $('#sync').textContent = '⚠ Sheet unreachable';
    // Prep is saved on this device, so it still opens without the sheet (opponents aren't listed until it loads).
    sheetFailed = true;
    if (S.mode === 'prep') { render(); return; }
    $('#main').innerHTML = `<div class="panel"><h2>Couldn't load the league sheet</h2><p>${esc(e.message)}</p><p>Check your internet connection and that the sheet is still published to the web.</p><button class="primary" id="retry">Retry</button> <button data-mode="prep">Open Battle Prep anyway</button></div>`;
  }
})();

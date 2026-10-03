// Drafarig front end. Plain ES modules, no build step. Shared logic lives in /lib (also used by the server and tests).
import { buildLeague, computeTurn, picksUntil, ROSTER_SIZE, BUDGET } from '/lib/league.mjs';
import { budgetSummary, affordability } from '/lib/budget.mjs';
import { buildPlans, checkPick } from '/lib/optimizer.mjs';
import { weaknessMatrix, roleChecklist, speedRows, threatList } from '/lib/analysis.mjs';
import { GLOSSARY } from '/glossary.js';

// ---------- settings (per browser) ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem('drafarig.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('drafarig.' + k, JSON.stringify(v)); } catch {} },
};
const S = {
  coach: store.get('coach', 'Anthony'), order: store.get('order', 'snake'), explain: store.get('explain', true),
  mode: store.get('mode', 'draft'), aliases: store.get('aliases', {}), draftTab: 'plans', check: '', showForms: false,
  tailwind: false, trickRoom: false, speedOpp: '', threatScope: 'all', boardFilter: { q: '', role: '', type: '', hideTaken: false, affordable: false },
};

let dex, sheet, L, usage = null, usageError = null, planCache = null;
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sp = (id) => dex.species[id];
const SPRITE = 'https://play.pokemonshowdown.com/sprites';
const sprite = (f) => `<img alt="" loading="lazy" src="${SPRITE}/gen5/${f.sprite}.png" onerror="this.onerror=null;this.src='${SPRITE}/ani/${f.sprite}.gif'">`;
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
function rebuild() {
  L = buildLeague(sheet.raw, dex, S.aliases);
  planCache = null;
  if (!L.coaches.some((c) => c.name === S.coach)) S.coach = L.coaches.find((c) => c.order === 5)?.name || L.coaches[0].name;
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
  sync.textContent = sheet.stale ? `⚠ Using data from ${t} (sheet unreachable) ⟳` : `● Synced ${ago(sheet.fetchedAt)} (${t}) ⟳`;
  sync.title = sheet.stale ? `Last error: ${sheet.error}. Click to retry.` : 'Fresh copy of the league sheet, fetched on this page load. Click to reload. Google can lag about 5 minutes behind edits.';
  const turn = computeTurn(L.coaches, S.order);
  const until = picksUntil(L.coaches, S.coach, S.order);
  const el = $('#turn');
  if (turn.complete) { el.textContent = 'Draft complete'; el.className = 'turn'; }
  else if (turn.coach === S.coach) { el.textContent = `Round ${turn.round} · Pick ${turn.pickNo} · ${S.coach.toUpperCase()} IS ON THE CLOCK`; el.className = 'turn clock'; }
  else { el.textContent = `Round ${turn.round} · Pick ${turn.pickNo} · ${turn.coach} picking · ${S.coach} in ${until ?? '?'} picks`; el.className = 'turn'; }
  const c = me(), b = budgetSummary(c.pointsLeft, c.slotsLeft, available().map((a) => a.cost));
  $('#budget').innerHTML = `${c.pointsLeft} pts · ${c.slotsLeft} slots · ${term('max', 'Max this pick')} ${b.maxThisPick}`;
  $('#coach').innerHTML = L.coaches.map((x) => `<option ${x.name === S.coach ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
  document.querySelectorAll('#modes button').forEach((b) => b.classList.toggle('active', b.dataset.mode === S.mode));

  const banners = [];
  if (sheet.stale) banners.push(`<div class="banner warn">Couldn't reach the league sheet (${esc(sheet.error)}). Showing data from ${t} (${ago(sheet.fetchedAt)}). Picks made since then are missing. <button id="retry">Retry</button></div>`);
  if (L.unmatched.length) banners.push(`<div class="banner warn">${L.unmatched.length} name(s) couldn't be matched to a Pokémon. They still count toward points but are left out of the analysis. <button data-goto="setup">Fix names</button></div>`);
  if (L.warnings.length) banners.push(`<div class="banner info"><details><summary>${L.warnings.length} sheet note(s): Drafts tab is the source of truth; board red text is a cross-check.</summary><ul>${L.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></details></div>`);
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
  if (!c.slotsLeft) return `${budgetPanel(c)}<div class="panel"><h2>Roster complete</h2><p>${esc(c.name)} has all ${ROSTER_SIZE} picks. See My team and League for matchup prep.</p></div>`;
  const P = plans(), aff = affMap();
  const tab = S.draftTab;
  const planHtml = P.plans.length ? P.plans.map((p, i) => `<div class="plan ${i === 0 ? 'selected' : ''}">
      <div class="plan-head"><span>Plan ${p.label} · ${esc(p.name)}</span><span>uses ${p.cost} of ${c.pointsLeft} pts ✓${p.left ? ` (${p.left} spare)` : ''}</span></div>
      <ol>${p.picks.map((x) => `<li><span class="step ${x.step === 'Now' ? 'now' : ''}">${x.step}</span>${monLine(x.id, `<span class="chip">${x.cost} pts</span>`)}
        ${reasonList(x.why)}${x.step === 'Now' ? ` <button data-copy="${esc(pickMsg(x.id, x.cost))}">Copy pick message</button>` : ''}</li>`).join('')}</ol>
      <div class="small">${p.fixes.length ? `Fixes: ${p.fixes.map((f) => `<span class="chip ok">${esc(f)} ✓</span>`).join('')}` : ''}
        ${p.missing.length ? ` Still missing: ${p.missing.map((f) => `<span class="chip">${esc(f)}</span>`).join('')}` : ''}
        ${p.stacked.length ? ` ${term('Stacked weakness')}: ${p.stacked.map((t) => `<span class="chip unc">${t}</span>`).join('')}` : ''}</div>
      <details class="small"><summary>Why? (score breakdown)</summary>Value ${p.score.value} · Roles ${p.score.roles} · Defense ${p.score.defense} · Threat coverage ${p.score.threats} · Price ${p.score.price} → total ${p.score.total} (+${p.gain} vs now).
        <p class="explainer">Value = meta tier of the 6 you'd bring most (the rest count 35%). Roles = the checklist, with less credit for each extra holder. Defense = shared weaknesses, judged per form. Threat coverage = −3 for each opponent A/S-tier mon nobody on your team resists. Price = 0.5 × board points (unspent points are wasted).</p></details>
    </div>`).join('') : '<p>No feasible plan found.</p>';
  // Affordable picks first; picks that break the budget stay visible below a divider.
  const ok = P.singles.filter((x) => aff.get(x.id)?.status !== 'breaks').slice(0, 12);
  const over = P.singles.filter((x) => aff.get(x.id)?.status === 'breaks').slice(0, 5);
  const row = (s) => {
    const a = aff.get(s.id); const [cls, label] = AFF[a?.status || 'ok'];
    return `<tr><td>${monLine(s.id, `<span class="chip">${s.cost} pts</span>`)}</td><td><span class="chip ${cls}">${label}</span><div class="small muted">${esc(a?.reason)}</div></td>
      <td>${reasonList(s.why)}${s.inPlans.length ? `<span class="small muted">In plan ${s.inPlans.join(', ')}</span>` : ''}</td>
      <td>${a?.status === 'breaks' ? '<button disabled title="This pick makes a 10-mon roster impossible">Blocked</button>' : `<button data-check="${s.id}">Check</button> <button data-copy="${esc(pickMsg(s.id, s.cost))}">Copy pick</button>`}</td></tr>`;
  };
  const singles = ok.map(row).join('') + (over.length ? `<tr><td colspan="4" class="small muted"><b>Can't afford without breaking your roster</b></td></tr>${over.map(row).join('')}` : '');
  return `<div class="cols"><div>${checkPanel(c)}
    <div class="panel"><div class="tabs"><button data-dtab="plans" class="${tab === 'plans' ? 'active' : ''}">Roster plans</button><button data-dtab="singles" class="${tab === 'singles' ? 'active' : ''}">Best single picks</button></div>
      <p class="explainer">Suggestions, not orders. Each plan is a complete, affordable set for all ${c.slotsLeft} remaining slots, built only from mons still available. "Now" is the pick to make first. Plans start with different picks so you get real alternatives. They recompute on every reload.</p>
      ${tab === 'plans' ? planHtml : `<div class="scroll"><table><tr><th>Mon</th><th>${term('Budget', 'Affordable / Tight / Breaks budget')}</th><th>Why</th><th></th></tr>${singles}</table></div>`}
    </div></div><div>${budgetPanel(c)}${checklistPanel(myIds(c), true)}${weaknessSnapshot(myIds(c))}</div></div>`;
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
    ${matrixPanel(ids)}${checklistPanel(ids)}${speedPanel(ids)}`;
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
    return `<div class="coach-card ${x.name === S.coach ? 'me' : ''}"><b>${x.order}. ${esc(x.name)}</b> ${b.feasible ? '' : '<span class="chip breaks">Infeasible</span>'}
      <div class="small">${x.pointsLeft} pts · ${x.slotsLeft} slots · avg ${b.avgPerSlot} · max next pick ${b.maxThisPick}</div>
      <div class="small muted">${x.slotsLeft ? `Can still afford: up to ${b.maxThisPick}-pt mons` : 'Roster complete'}</div>
      <div class="small">${x.picks.map((p) => `${esc(p.id ? sp(p.id).name : p.en)} ${p.points}`).join(' · ')}</div>
      ${missing.length && x.slotsLeft ? `<div class="small">Needs: ${missing.slice(0, 4).map((m) => `<span class="chip">${esc(m)}</span>`).join('')}</div>` : ''}</div>`;
  }).join('');
  const opp = S.threatScope === 'all' ? opponents(c) : opponents(c).filter((o) => o.coach === S.threatScope);
  const threats = threatList(dex, myIds(c), opp);
  const st = { Answered: 'ans', Thin: 'thin', Unchecked: 'unc' };
  const counts = Object.fromEntries(['Answered', 'Thin', 'Unchecked'].map((k) => [k, threats.filter((t) => t.status === k).length]));
  return `<div class="panel"><h2>Coaches</h2><p class="explainer">Budget math is the same 10-mon feasibility rule for everyone. A coach can't snipe a mon priced above their max next pick.</p><div class="coach-grid">${coaches}</div></div>
    <div class="panel"><h2>Threats to ${esc(c.name)}</h2>
      <p class="verdict">${counts.Unchecked} unchecked, ${counts.Thin} thin, ${counts.Answered} answered.</p>
      <div class="filters">Scope <select id="threatScope"><option value="all">All ${L.coaches.length - 1} opponents</option>${L.coaches.filter((x) => x.name !== c.name).map((x) => `<option ${S.threatScope === x.name ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>
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

// ---------- render + events ----------
function render() {
  if (!L) return;
  document.body.classList.toggle('facts', !S.explain);
  $('#explain').checked = S.explain;
  renderTop();
  const views = { draft: renderDraft, team: renderTeam, league: renderLeague, learn: renderLearn, setup: renderSetup };
  const scroll = window.scrollY;
  $('#main').innerHTML = (views[S.mode] || renderDraft)();
  window.scrollY !== scroll && window.scrollTo(0, scroll);
}
const save = () => { store.set('coach', S.coach); store.set('order', S.order); store.set('explain', S.explain); store.set('mode', S.mode); store.set('aliases', S.aliases); };
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 2500); }

document.addEventListener('click', async (e) => {
  const t = e.target.closest('button, .nm, .cell, .chip.form, .term');
  if (!t) return;
  if (t.dataset.mode) { S.mode = t.dataset.mode; history.replaceState(null, '', '#' + S.mode); save(); render(); }
  else if (t.dataset.goto) { S.mode = t.dataset.goto; save(); render(); }
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
  if (t.id === 'coach') { S.coach = t.value; S.speedOpp = ''; S.threatScope = 'all'; S.check = ''; planCache = null; }
  else if (t.id === 'checkPick') S.check = t.value;
  else if (t.id === 'explain') S.explain = t.checked;
  else if (t.id === 'order') S.order = t.value;
  else if (t.id === 'showForms') S.showForms = t.checked;
  else if (t.id === 'tw') S.tailwind = t.checked;
  else if (t.id === 'tr') S.trickRoom = t.checked;
  else if (t.id === 'speedOpp') S.speedOpp = t.value;
  else if (t.id === 'threatScope') S.threatScope = t.value;
  else if (t.id === 'brole') S.boardFilter.role = t.value;
  else if (t.id === 'btype') S.boardFilter.type = t.value;
  else if (t.id === 'bhide') S.boardFilter.hideTaken = t.checked;
  else if (t.id === 'baff') S.boardFilter.affordable = t.checked;
  else return;
  save(); render();
});
document.addEventListener('input', (e) => {
  if (e.target.id !== 'bq') return;
  S.boardFilter.q = e.target.value;
  const pos = e.target.selectionStart; render();
  const el = $('#bq'); el.focus(); el.setSelectionRange(pos, pos);
});

// Glossary popover: hover/focus on desktop, tap on touch.
function showPop(el) {
  const g = GLOSSARY[el.dataset.term]; if (!g) return;
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
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { hidePop(); $('#drawer').hidden = true; document.querySelector('.layout').classList.add('nodrawer'); } });

// ---------- boot ----------
(async function boot() {
  document.querySelector('.layout').classList.add('nodrawer');
  const h = location.hash.slice(1); // deep link: #draft, #team, #league, #learn, #setup
  if (['draft', 'team', 'league', 'learn', 'setup'].includes(h)) S.mode = h;
  try {
    dex = await (await fetch('/data/dex.json')).json();
    await loadSheet();
    render();
    loadUsage();
    setInterval(() => sheet && renderTop(), 15000); // keep "Synced Ns ago" honest
  } catch (e) {
    $('#sync').textContent = '⚠ Sheet unreachable';
    $('#main').innerHTML = `<div class="panel"><h2>Couldn't load the league sheet</h2><p>${esc(e.message)}</p><p>Check your internet connection and that the sheet is still published to the web.</p><button class="primary" id="retry">Retry</button></div>`;
  }
})();

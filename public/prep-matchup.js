// Battle Prep matchup briefing (the first screen for an opponent): portraits first, then what to look at first, their game
// plans, who moves first (Speed ranges under a chosen field), your mons that look useful here with their costs, your plans
// against what they could prep, pairs to test and one-tap checks into Calcs / Speed / Sets / Practice. Pure string
// renderers over lib/prep-matchup.mjs buildBriefing; nothing is saved by looking. Portraits come from the app's sprite helper
// (P.pt, app.js); this module holds no URLs.
import { buildBriefing, relevantSpeedIds, ownerOf, workspacesFor } from '../lib/prep-matchup.mjs';
import { compareSpeed, natureSign, speedRange } from '../lib/calc/stats.mjs';
import { currentVersion, defaultVariant } from '../lib/prep-model.mjs';
import { formatRoute } from '../lib/prep-route.mjs';
import * as C from './prep-copy.js';
import { esc, btn, chipBtn, h2, select, term } from './prep-ui.js';

const TYPE3 = { Normal: 'NOR', Fire: 'FIR', Water: 'WAT', Electric: 'ELE', Grass: 'GRA', Ice: 'ICE', Fighting: 'FIG', Poison: 'POI', Ground: 'GRO', Flying: 'FLY', Psychic: 'PSY', Bug: 'BUG', Rock: 'ROC', Ghost: 'GHO', Dragon: 'DRA', Dark: 'DAR', Steel: 'STE', Fairy: 'FAI' };
// Pictures for the modes a beginner meets most (inline SVG symbols defined once in index.html); other plans show only words.
const MODE_ICON = { 'trick-room': 'i-tr', tailwind: 'i-tw', sun: 'i-sun', rain: 'i-rain', sand: 'i-sand', 'snow-veil': 'i-snow' };

// ---------- model ----------
const keyOf = (pov, opp) => `${pov}|${opp}`;
export const briefUi = (P, pov, opp) => ((P.ui.brief ??= {})[keyOf(pov, opp)] ??= { scenario: 'none', sel: [], showAll: false, lens: '10' });
/** "Your 6" for a matchup: the shortlist plus the species of the sets chosen for the match. */
function sixOf(P, ws) {
  if (!ws) return [];
  const fromSets = (ws.my6 ?? []).map((m) => P.lineage(m.setId)?.speciesId).filter(Boolean);
  return [...new Set([...(ws.shortlist ?? []), ...fromSets])];
}
/** Saved Speed facts: yours only for the confirmed identity (sets in My sets), theirs from this workspace's sets. */
function savedSpeeds(P, pov, ws) {
  const out = { mine: {}, theirs: {} };
  if (!P.mech) return out;
  const entry = (l) => {
    const d = currentVersion(l).data;
    if (d.sp === 'unknown' || !Number.isInteger(d.sp?.spe) || !P.mech.natures[d.nature]) return null;
    const stone = P.mech.items[d.item]?.megaStone?.[l.speciesId] ?? null;
    return { sp: d.sp.spe, sign: natureSign(P.mech.natures[d.nature], 'spe'), megaForm: stone, scarf: d.item === 'choicescarf' };
  };
  if (P.identity() === pov.name) {
    const inSix = new Set((ws?.my6 ?? []).map((m) => m.setId));
    for (const id of pov.picks.map((p) => p.id).filter(Boolean)) {
      const sets = P.mineSets().filter((s) => s.speciesId === id);
      const l = sets.find((s) => inSix.has(s.id)) ?? sets[0];
      const e = l && entry(l);
      if (e) out.mine[id] = e;
    }
  }
  if (ws) {
    const v = defaultVariant(ws);
    for (const id of ws.roster.speciesIds) {
      const l = ws.theirSets.find((s) => s.id === v?.setIds?.[id]);
      const e = l && entry(l);
      if (e) out.theirs[id] = e;
    }
  }
  return out;
}
/** The briefing for (pov, opp), memoised on everything it reads. */
export function modelFor(P, pov, opp, ws) {
  const st = briefUi(P, pov.name, opp.name);
  const six = sixOf(P, ws).filter((id) => pov.picks.some((p) => p.id === id));
  const lens = st.lens === '6' && six.length ? '6' : '10';
  const mineIds = lens === '6' ? six : pov.picks.map((p) => p.id).filter(Boolean);
  const saved = savedSpeeds(P, pov, ws);
  const L = P.league();
  const available = (L?.board ?? []).filter((b) => !b.taken && b.id).map((b) => ({ id: b.id, cost: b.points }));
  const usage = P.app.usage?.() ?? null;
  const cx = P.app.coresCx?.() ?? null;
  const key = JSON.stringify([pov.name, opp.name, mineIds, opp.picks.map((p) => p.id), pov.slotsLeft, opp.slotsLeft, opp.pointsLeft, !!P.mech, !!cx, usage?.month ?? null, saved, available.length]);
  P.briefCache ??= new Map();
  if (!P.briefCache.has(key)) {
    if (P.briefCache.size > 24) P.briefCache.clear();
    P.briefCache.set(key, buildBriefing({ cx, dex: P.app.dex, mech: P.mech, usage, available, saved,
      mine: { name: pov.name, order: pov.order, ids: mineIds, slotsLeft: pov.slotsLeft, pointsLeft: pov.pointsLeft },
      theirs: { name: opp.name, order: opp.order, ids: opp.picks.map((p) => p.id).filter(Boolean), slotsLeft: opp.slotsLeft, pointsLeft: opp.pointsLeft } }));
  }
  return { b: P.briefCache.get(key), st, six, lens };
}

// ---------- small pieces ----------
const dexSp = (P, id) => P.app.dex.species[id] ?? null;
const nm = (P) => (id) => P.spName(id);
const typeBars = (types) => `<span class="types">${types.map((t) => `<span class="ty ty-${esc(t.toLowerCase())}" title="${esc(t)}">${esc(TYPE3[t] ?? t)}<span class="vh"> (${esc(t)})</span></span>`).join('')}</span>`;
const layerChip = (layer) => `<span class="lyr lyr-${esc(layer)}" title="${esc(C.BRIEF.layerHelp[layer] ?? '')}">${esc(C.BRIEF.layer[layer] ?? layer)}</span>`;
const reasonChip = (P, r, cls = 'pro') => `<li class="rsn ${cls} lyr-${esc(r.layer)}"><span class="rsn-ic" aria-hidden="true">${cls === 'pro' ? '✓' : cls === 'con' ? '⚠' : '•'}</span> ${esc((C.REASON[r.code] ?? (() => r.code))(r, nm(P)))}${r.layer !== 'known' ? ` ${layerChip(r.layer)}` : ''}</li>`;
const mini = (P, id, extra = '') => `<span class="mini">${P.pt(id, { size: 'xs' })}<span class="mini-n">${esc(P.spName(id))}</span>${extra}</span>`;
const multBadge = (m) => `<span class="mult ${m >= 4 ? 'x4' : 'x2'}">×${m}</span>`;
const modeBadge = (coreId) => (MODE_ICON[coreId] ? `<span class="mode mode-${esc(coreId)}"><svg class="ic" aria-hidden="true" focusable="false"><use href="#${MODE_ICON[coreId]}"></use></svg></span>` : '');
/** A briefing section: heading, a short honesty tag that always shows, and a longer explanation "Explain everything" can hide. */
function section(id, title, sub, body, cls = '', explain = '') {
  return `<section class="bsec ${cls}" id="bs-${id}" aria-labelledby="bs-${id}-h"><h3 id="bs-${id}-h">${esc(title)}</h3>${sub ? `<p class="bsub small muted">${esc(sub)}</p>` : ''}${explain ? `<p class="explainer">${esc(explain)}</p>` : ''}${body}</section>`;
}
/** A section that throws shows a one-line notice instead of taking the briefing down. */
const safe = (fn) => { try { return fn(); } catch (e) { console.error('Briefing section failed:', e && e.message); return `<p class="banner warn">${esc(C.BRIEF.sectionFailed)}</p>`; } };
const slotOf = (coach, id) => coach.picks.findIndex((p) => p.id === id) + 1;

// ---------- hero ----------
export function hero(P, { r, pov, opp, ws, legacy }) {
  const sheet = P.app.sheet?.();
  const t = sheet?.fetchedAt ? new Date(sheet.fetchedAt).toISOString().slice(11, 16) : null;
  const drafted = opp.picks.filter((p) => p.id).length;
  const stale = ws ? P.staleOf && ws.calcs.filter((c) => P.staleOf(ws, c).length).length : 0;
  const facts = [`seat ${opp.order}`, C.BRIEF.heroDrafted(drafted), t ? (sheet.stale ? C.BRIEF.heroStale(t) : C.BRIEF.heroSheet(t)) : '',
    ws ? `${C.BRIEF.savedCounts(ws)}${stale ? ` · ${C.BRIEF.outOfDate(stale)}` : ''}` : C.BRIEF.notStarted].filter(Boolean);
  const list = workspacesFor([...P.ws.values()], pov.name, opp.name);
  const diff = ws ? P.rosterDiffOf(ws) : { added: [], removed: [] };
  const titleText = `vs ${opp.name}`;
  const isBrief = (r.tab ?? 'brief') === 'brief' && !r.detail;
  return `<div class="mhero">${isBrief ? h2(titleText) : `<p class="herotitle">${esc(titleText)}</p>`}
    <p class="facts small muted">${esc(facts.join(' · '))}</p>
    <div class="heroacts">${chipBtn(C.BRIEF.next, 'brief-next', {}, ws?.isNext)} <details class="more"><summary>${esc(C.BRIEF.more)}</summary>${btn(`⇄ ${C.BRIEF.flip(opp.name)}`, 'flip', {}, { cls: 'linkish' })} ${btn(C.BRIEF.viewAs, 'brief-viewas', {}, { cls: 'linkish' })}</details></div>
    ${ws ? `<p class="small muted owner-line">${esc(C.POV.savedAs(ownerOf(ws)))}${ws.povFrom === 'legacy-confirm' ? ` · ${btn(C.POV.review, 'go-owner', { ws: ws.id }, { cls: 'linkish' })}` : ''}</p>` : ''}
    ${list.length > 1 ? select('brief-ws', list.map((w, i) => [w.id, `${i ? 'Other copy' : 'Most recent'} · changed ${(w.updatedAt ?? '').slice(0, 10)}`]), ws?.id ?? '', { label: C.BRIEF.wsPick, data: { pc: 'brief-ws' } }) : ''}
    ${!ws && legacy.length ? `<p class="banner info">${esc(C.POV.earlierHere(opp.name))} ${legacy.map((w) => btn(C.POV.review, 'go-owner', { ws: w.id })).join(' ')}</p>` : ''}
    ${diff.added.length || diff.removed.length ? `<p class="banner warn">${esc(C.BRIEF.rosterChanged)}: ${diff.added.map((x) => `+ ${esc(P.spName(x))}`).join(', ')}${diff.added.length && diff.removed.length ? ', ' : ''}${diff.removed.map((x) => `− ${esc(P.spName(x))}`).join(', ')}. ${btn('Update prep', 'roster-update', {}, { primary: true })} ${btn('Keep old roster', 'roster-keep')}</p>` : ''}
  </div>`;
}

// ---------- the briefing ----------
export function brief(P, ctx) {
  const { r, pov, opp, ws } = ctx;
  const { b, st, six, lens } = modelFor(P, pov, opp, ws);
  if (r.detail) return detail(P, ctx, b);
  const notices = [];
  if (b.layers.mech === 'loading') notices.push(P.mechState === 'failed' ? '' : C.BRIEF.layerNotice['mech-loading']);
  if (b.layers.cores !== 'ready') notices.push(C.BRIEF.layerNotice['cores-unavailable']);
  if (b.layers.usage !== 'ready') notices.push(C.BRIEF.layerNotice['usage-offline'](P.app.dex.sources?.keyMoves ?? 'ladder'));
  if (b.rosterState.theirSlotsLeft > 0) notices.push(b.poolTheirs.length ? C.BRIEF.openPicks(opp.name, b.rosterState.theirSlotsLeft) : C.BRIEF.emptyPool(opp.name));
  return `<div class="brief" data-lens="${lens}">
    ${notices.filter(Boolean).map((n) => `<p class="small notice">${esc(n)}</p>`).join('')}
    <div class="bcols"><div class="bcol bcol-them">
    ${safe(() => poolSection(P, ctx, b))}
    ${safe(() => threatsSection(P, ctx, b))}
    ${safe(() => plansSection(P, ctx, b))}
    ${safe(() => speedSection(P, ctx, b, st, six))}
    </div><div class="bcol bcol-you">
    ${safe(() => usefulSection(P, ctx, b, six))}
    ${safe(() => myPlansSection(P, ctx, b))}
    ${safe(() => leadsSection(P, ctx, b))}
    ${safe(() => checksSection(P, ctx, b))}
    </div></div>
    <p class="cantknow">${esc(C.CANT_KNOW)}</p>
    ${tray(P, ctx, six, lens)}</div>`;
}

function poolSection(P, { pov, opp }, b) {
  const ringOf = new Map(b.threats.map((t) => [t.id, t]));
  const order = [...b.threats.map((t) => t.id)];
  const cell = (id) => {
    const t = ringOf.get(id), s = dexSp(P, id);
    const megas = s?.forms.filter((f) => f.mega).length ?? 0;
    const label = [P.spName(id), (s?.forms[0].types ?? []).join(' '), t?.ring === 'look-first' ? C.BRIEF.ringLabel(t.rank) : t?.ring === 'watch' ? C.BRIEF.watchLabel : '', megas ? C.BRIEF.megaLabel : ''].filter(Boolean).join(', ');
    return `<li><button type="button" class="pcard${t?.ring ? ` ring-${t.ring}` : ''}" data-pa="brief-open" data-side="their" data-n="${slotOf(opp, id)}" aria-label="${esc(`${label}. Details`)}">
      ${t?.ring === 'look-first' ? `<span class="rank" aria-hidden="true">${t.rank}</span>` : ''}${megas ? `<span class="megad" aria-hidden="true">M${megas > 1 ? `×${megas}` : ''}</span>` : ''}
      ${P.pt(id, { size: 'md' })}<span class="pname">${esc(P.spName(id))}</span>${typeBars(s?.forms[0].types ?? [])}</button></li>`;
  };
  const open = Math.max(0, b.rosterState.theirSlotsLeft);
  const openCells = Array.from({ length: Math.min(open, 10) }, () => `<li><span class="pcard open"><span class="pt pt-md noimg" data-ini="?"></span><span class="pname">${esc(C.BRIEF.openSlot(b.rosterState.theirMaxNextPick))}</span></span></li>`).join('');
  const mine = pov.picks.map((p) => p.id).filter(Boolean);
  const myStrip = `<p class="small muted mystrip-h">${esc(C.BRIEF.yourTen)}</p><ul class="mystrip" aria-label="${esc(C.BRIEF.yourTen)}">${mine.map((id) => `<li><button type="button" class="pmini${b.promising.some((x) => x.id === id) ? ' ring-you' : ''}" data-pa="brief-open" data-side="your" data-n="${slotOf(pov, id)}" aria-label="${esc(`${P.spName(id)}${b.promising.some((x) => x.id === id) ? ', looks useful here' : ''}. Details`)}">${P.pt(id, { size: 'sm' })}<span class="pname">${esc(P.spName(id))}</span></button></li>`).join('')}</ul>`;
  const megaCount = b.poolTheirs.filter((id) => dexSp(P, id)?.forms.some((f) => f.mega)).length;
  return section('pool', `${opp.name}'s pool`, '', `<ul class="poolgrid">${order.map(cell).join('')}${openCells}</ul>
    <p class="lkey small">${esc(C.BRIEF.keyLine)} <span class="ring-key lf">${esc(C.BRIEF.lookFirstKey)}</span> <span class="ring-key w">${esc(C.BRIEF.watchKey)}</span> <span class="megad inline">M</span> ${term(C.BRIEF.megaLabel, 'Mega badge (M)')}${megaCount > 1 ? ` · ${esc(C.BRIEF.megaNote)}` : ''}</p>${myStrip}`, 'them');
}

function threatsSection(P, ctx, b) {
  const looks = b.threats.filter((t) => t.ring === 'look-first');
  if (!looks.length) return section('threats', C.BRIEF.lookFirst, C.BRIEF.lookFirstSub, `<p class="small">${esc(b.poolTheirs.length ? 'Nothing in their pool stands out by type or Speed against yours. Check their plans below.' : C.BRIEF.emptyPool(ctx.opp.name))}</p>`, 'them');
  const card = (t) => {
    const victims = t.pressure?.victims ?? [];
    const walls = t.pressure?.walls ?? [];
    const head = t.reasons[0];
    const calc = (t.checks ?? []).find((k) => k.kind === 'calc' && k.dir === 'survive');
    const band = t.speed.band;
    return `<li class="tcard" aria-labelledby="tc-${esc(t.id)}">
      <div class="tc-top"><span class="rank" aria-hidden="true">${t.rank}</span>${P.pt(t.id, { size: 'lg' })}<div><p class="tc-name" id="tc-${esc(t.id)}"><b>${esc(P.spName(t.id))}</b> <span class="vh">${esc(C.BRIEF.ringLabel(t.rank))}</span></p>${typeBars(dexSp(P, t.id)?.forms[0].types ?? [])}
        ${head ? `<p class="tc-head">${esc((C.REASON[head.code] ?? (() => head.code))(head, nm(P)))}</p>` : ''}</div></div>
      <ul class="rsns">${t.reasons.slice(1, 4).map((x) => reasonChip(P, x, 'them')).join('')}</ul>
      <p class="small rowlab">${esc(C.BRIEF.hitsHard)}${t.pressure?.mega ? ` (${esc(C.BRIEF.asMega(t.pressure.form))})` : ''}:</p><div class="minis">${victims.length ? victims.map((v) => mini(P, v.id, multBadge(v.mult))).join('') : `<span class="small muted">${esc(C.BRIEF.none)}</span>`}</div>
      <p class="small rowlab">${esc(C.BRIEF.takesIt)}:</p><div class="minis">${walls.length ? walls.map((w) => mini(P, w, '<span class="shield" aria-hidden="true">◈</span>')).join('') : `<span class="small muted">${esc(C.BRIEF.none)}</span>`}</div>
      <p class="small">Speed ${band[0]}–${band[2]}${t.speed.megaMax ? ` · ${esc(C.BRIEF.ifMega)} up to ${t.speed.megaMax}` : ''}</p>
      <p class="acts">${calc ? btn(C.BRIEF.calcBtn, 'brief-calc', checkData(calc), { aria: `${C.BRIEF.calcBtn}: ${checkQuestion(P, calc)}` }) : ''} ${btn(C.BRIEF.speedBtn, 'brief-speed', { a: t.id, b: (t.checks ?? []).find((k) => k.kind === 'speed')?.select?.[1] ?? '' })} ${btn(C.BRIEF.whyBtn, 'brief-open', { side: 'their', n: slotOf(ctx.opp, t.id) }, { cls: 'linkish', aria: `Why ${P.spName(t.id)}` })}</p></li>`;
  };
  return section('threats', C.BRIEF.lookFirst, C.BRIEF.lookFirstSub, `<ol class="tcards">${looks.map(card).join('')}</ol>`, 'them', C.BRIEF.lookFirstExplain);
}

function plansSection(P, ctx, b) {
  if (b.layers.cores !== 'ready') return section('plans', C.BRIEF.theirPlans, '', `<p class="small">${esc(C.BRIEF.layerNotice['cores-unavailable'])}</p>`, 'them');
  if (!b.theirPlans.length) return section('plans', C.BRIEF.theirPlans, C.BRIEF.theirPlansSub, `<p class="small">${esc(C.BRIEF.noPlans)}</p>`, 'them');
  const card = (p) => {
    const st = p.myStatus ?? 'none';
    const counted = p.myCounted;
    return `<li class="plancard conf-${esc(p.confidence)}"><button type="button" class="plan-open" data-pa="brief-open" data-core="${esc(p.coreId)}" aria-label="${esc(`${p.label}, ${C.BRIEF.confidence[p.confidence]}. ${C.BRIEF.you} ${C.BRIEF.status[st]}. Details`)}">
      <span class="ph">${modeBadge(p.coreId)} <span class="rc">${esc(p.label)}</span> <span class="conf">${esc(C.BRIEF.confidence[p.confidence])}</span></span></button>
      <div class="minis">${p.members.map((id) => mini(P, id, `${p.tells.includes(id) ? '<span class="tell" aria-label="preview tell">◎</span>' : ''}${p.megaUser === id ? '<span class="megad inline" aria-label="Mega">M</span>' : ''}`)).join('')}</div>
      <p class="status st-${esc(st)}"><b>${term(C.BRIEF.you, 'Has answers / Thin / No answer found')}</b> <span class="chip ${st === 'has' ? 'ok' : st === 'thin' ? 'tight' : 'breaks'}">${st === 'has' ? '✓' : st === 'thin' ? '◐' : '✕'} ${esc(C.BRIEF.status[st])}</span>${p.myStatusB && p.myStatusB !== st ? ` <span class="small muted">${esc(C.BRIEF.statusB(C.BRIEF.status[p.myStatusB]))}</span>` : ''} <span class="small muted">(${esc(C.BRIEF.yourAnswers)})</span></p>
      ${counted.length ? `<div class="minis">${counted.map((c) => mini(P, c.mon, c.anchor ? `<span class="small anchor">${term(C.BRIEF.anchor, 'Anchor')}</span>` : '')).join('')}</div>` : ''}
      ${p.cofailTypes.slice(0, 1).map((c) => `<p class="small warnline">⚠ ${esc(C.BRIEF.cofail(c.type, c.victims.map(nm(P)).join(', ')))}</p>`).join('')}
      ${p.speedMode === 'tailwind' || p.speedMode === 'trick-room' ? `<p>${btn(p.speedMode === 'tailwind' ? 'See Speed under their Tailwind' : 'See Speed under Trick Room', 'brief-scenario-go', { scenario: p.speedMode === 'tailwind' ? 'tw-theirs' : 'tr' }, { cls: 'linkish' })}</p>` : ''}</li>`;
  };
  const shown = b.theirPlans.slice(0, 3), rest = b.theirPlans.slice(3);
  const tellKey = b.theirPlans.some((p) => p.tells.length) ? `<p class="lkey small"><span class="tell" aria-hidden="true">◎</span> ${esc(C.BRIEF.tellKey)} · ${term(C.BRIEF.confidence.likely, 'Likely / Possible core')}</p>` : '';
  return section('plans', C.BRIEF.theirPlans, C.BRIEF.theirPlansSub, `<ul class="plancards">${shown.map(card).join('')}</ul>${rest.length ? `<details><summary>${esc(C.BRIEF.morePlans(rest.length))}</summary><ul class="plancards">${rest.map(card).join('')}</ul></details>` : ''}${tellKey}`, 'them', C.BRIEF.theirPlansExplain);
}

function speedSection(P, ctx, b, st, six) {
  const scen = b.speed.scenarios.find((s) => s.key === st.scenario && s.enabled) ? st.scenario : 'none';
  const tr = scen === 'tr';
  const rows = b.speed.rows(scen);
  const relevant = relevantSpeedIds(b, { shortlist: six });
  const shownRows = st.showAll ? rows : rows.filter((x) => relevant.has(x.id)).slice(0, 14);
  const lo = Math.min(...shownRows.map((x) => x.min), ...shownRows.flatMap((x) => x.extensions.map((e) => e.min)));
  const hi = Math.max(...shownRows.map((x) => x.max), ...shownRows.flatMap((x) => x.extensions.map((e) => e.max)));
  const pos = (v) => (hi > lo ? Math.round((1000 * (v - lo)) / (hi - lo)) / 10 : 50);
  const radios = b.speed.scenarios.map((s) => {
    const setters = s.key === 'tr' ? [...(s.settersMine ?? []), ...(s.settersTheirs ?? [])] : s.setters ?? [];
    const cap = !s.enabled ? C.BRIEF.scenarioOff[s.key] : setters.length ? C.BRIEF.setters(setters.slice(0, 4).map((x) => `${P.spName(x.id)}${x.layer === 'prior' ? ' (ladder)' : ' (could)'}`).join(', ')) : '';
    return `<label class="seg${scen === s.key ? ' on' : ''}${s.enabled ? '' : ' off'}" for="brief-scen-${esc(s.key)}"><input type="radio" id="brief-scen-${esc(s.key)}" name="brief-scenario" value="${esc(s.key)}" data-pc="brief-scenario"${scen === s.key ? ' checked' : ''}${s.enabled ? '' : ' disabled'}> ${esc(C.BRIEF.scenario[s.key])}${cap ? `<span class="segcap">${esc(cap)}</span>` : ''}</label>`;
  }).join('');
  const sel = st.sel.filter((k) => rows.some((x) => x.key === k));
  const row = (x) => {
    const pressed = sel.includes(x.key);
    // a Mega row names its form (Charizard has two) and says it is conditional
    const label = x.mega ? `${x.form} (${x.side === 'mine' ? C.BRIEF.ifYouMega : C.BRIEF.ifMega})` : P.spName(x.id);
    const val = x.exact ? `${x.max}` : `${x.min}–${x.max}`;
    const ext = x.extensions.map((e) => `<span class="ext" style="left:${pos(e.min)}%;width:${Math.max(1, pos(e.max) - pos(e.min))}%"></span>`).join('');
    const setters = (e) => [...new Set(b.speed.weatherSpeed.find((w) => w.id === x.id && w.side === x.side && w.ability === e.ability)?.setBy.map((s) => P.spName(s.id)) ?? [])].join(', ');
    const extText = x.extensions.map((e) => `${C.BRIEF.weatherRow(P.name('abilities', e.ability), e.weather, setters(e))}: ${e.min} to ${e.max}`);
    return `<li class="srow ${esc(x.side)}${x.exact ? ' exact' : ''}${pressed ? ' sel' : ''}"><button type="button" class="srowbtn" data-pa="brief-sel" data-key="${esc(x.key)}" aria-pressed="${pressed}" aria-label="${esc(`${label}, ${x.side === 'mine' ? 'yours' : 'theirs'}, ${x.exact ? val : `${x.min} to ${x.max}`}${extText.length ? `; ${extText.join('; ')}` : ''}. Compare`)}">
      <span class="slab">${P.pt(x.id, { size: 'xs' })}<span class="sname">${esc(label)}</span></span>
      <span class="strack" aria-hidden="true">${x.exact ? `<span class="dia" style="left:${pos(x.max)}%"></span>` : `<span class="band" style="left:${pos(x.min)}%;width:${Math.max(1.5, pos(x.max) - pos(x.min))}%"></span><span class="tick" style="left:${pos(x.neutralMax)}%"></span>`}${ext}</span>
      <span class="sval">${esc(val)}${x.extensions.map((e) => `<span class="small muted sext"> ${esc(C.BRIEF.weatherRow(P.name('abilities', e.ability), e.weather, setters(e)))}: ${e.min}–${e.max}</span>`).join('')}</span><span class="sside">${x.side === 'mine' ? 'yours' : 'theirs'}</span></button></li>`;
  };
  let verdict = '';
  if (sel.length === 2) {
    const [a, c] = sel.map((k) => rows.find((x) => x.key === k));
    const res = compareSpeed(a.exact ? a.max : a, c.exact ? c.max : c, { trickRoom: tr });
    const an = a.mega ? a.form : P.spName(a.id), cn = c.mega ? c.form : P.spName(c.id);
    // their item is unknown: say when a Choice Scarf on their side (never on a Mega) would change a sure-looking result
    const scarf = (x) => (x.side === 'theirs' && !x.mega && !x.exact ? speedRange(x.base, { tailwind: x.tailwind, scarf: true }).max : null);
    const val = (x, s2) => (x.exact ? x.max : { min: x.min, max: s2 ?? x.max });
    const caveat = res === 'depends' || res === 'tie' ? null : [[c, a], [a, c]].map(([x, y]) => { const sm = scarf(x); return sm && compareSpeed(val(y), val(x, sm), { trickRoom: tr }) !== compareSpeed(val(y), val(x), { trickRoom: tr }) ? C.BRIEF.scarfCaveat(x === a ? an : cn, sm) : null; }).find(Boolean);
    verdict = `<p class="verdict">${esc(C.BRIEF.verdict[res](an, cn))}${caveat ? ` <span class="caveat">(${esc(caveat)})</span>` : ''}</p>`;
  }
  const facts = b.speed.facts.map((list) => {
    const none = list.find((p) => p.scenario === 'none') ?? list[0];
    const parts = list.map((p) => `${C.BRIEF.scenario[p.scenario]}: ${p.result === 'first' ? `${P.spName(p.aId)} first` : p.result === 'second' ? `${p.bForm} first` : p.result === 'tie' ? 'tie' : 'depends on spreads'}${p.scarfCaveat ? ` (${C.BRIEF.scarfCaveat(p.bForm, p.scarfCaveat)})` : ''}`);
    const need = none.mineNeeds ? (none.trickRoom ? C.BRIEF.needsTr(none.mineNeeds) : C.BRIEF.needs(none.mineNeeds)) : '';
    return `<li class="sfact">${P.pt(none.aId, { size: 'xs' })} <b>${esc(P.spName(none.aId))}</b> vs <b>${esc(none.bForm)}</b>: ${esc(parts.join(' · '))}${need ? `. ${esc(need)}` : ''} ${btn(C.BRIEF.speedBtn, 'brief-speed', { a: none.bId, b: none.aId }, { cls: 'linkish' })}</li>`;
  }).join('');
  const prio = [...b.speed.priority.theirs.map((x) => ({ ...x, side: 'theirs' })), ...b.speed.priority.mine.map((x) => ({ ...x, side: 'mine' }))];
  const prioLine = (x) => `<li class="${x.side}">${mini(P, x.id)} ${x.moves.slice(0, 3).map((m) => `<span class="tool lyr-${esc(m.layer)}">${esc(P.name('moves', m.move))}${m.move === 'fakeout' ? ` (${esc(C.BRIEF.priorityFake)})` : ''}</span>`).join(' ')} ${x.abilities.map((a) => `<span class="tool lyr-${esc(a.layer)}">${esc(P.name('abilities', a.ability))}${a.ability === 'prankster' ? ` (${esc(C.BRIEF.priorityPrank)})` : ''}</span>`).join(' ')}</li>`;
  return section('speed', C.BRIEF.speedHead, '', `<fieldset class="scen"><legend>${esc(C.BRIEF.speedLegend)}</legend>${radios}</fieldset>
    <p class="small lkey">${term('Tailwind')} · ${term('Trick Room')} · ${term('Speed control')}</p>
    <p class="assume small">${esc(C.BRIEF.assumptions)} ${term(C.BRIEF.spTerm, 'Stat Points (SP)')}${scen !== 'none' ? ` · ${esc(C.BRIEF.scenarioNote[scen])}` : ''}</p>
    ${tr ? `<p class="trnote small">${esc(C.BRIEF.mechTrickRoom)} <span class="muted">${esc(C.BRIEF.mechSource)}</span></p>` : scen !== 'none' ? `<p class="small">${esc(C.BRIEF.mechTailwind)} <span class="muted">${esc(C.BRIEF.mechSource)}</span></p>` : ''}
    <p class="slegend small" aria-hidden="true"><span class="lg mine"></span> yours <span class="lg theirs"></span> theirs (range) <span class="lg tick"></span> 32 SP, neutral <span class="lg dia"></span> exact (a saved set) <span class="lg ext"></span> if ability + weather</p>
    <p class="small muted">${esc(tr ? 'Slower moves first: top of the list acts first.' : 'Faster moves first: top of the list acts first.')} ${esc(C.BRIEF.compareHelp)}</p>
    <ol class="speedtrack${tr ? ' tr' : ''}"><li class="saxis" aria-hidden="true"><span></span><span class="axis"><span>${lo}</span><span>${hi}</span></span><span></span></li>${shownRows.map(row).join('')}</ol>
    ${rows.length > shownRows.length || st.showAll ? `<p>${btn(st.showAll ? C.BRIEF.showFewer : C.BRIEF.showAll(rows.length), 'brief-showall', {}, { cls: 'linkish' })}</p>` : ''}
    ${verdict}${sel.length === 2 ? `<p>${btn('What would it take?', 'brief-threshold', { a: rows.find((x) => x.key === sel[0]).id, b: rows.find((x) => x.key === sel[1]).id })} ${btn('Open in Speed', 'brief-speed', { a: rows.find((x) => x.key === sel[0]).id, b: rows.find((x) => x.key === sel[1]).id })}</p>` : ''}
    ${facts ? `<h4>${esc(C.BRIEF.facts)}</h4><ul class="sfacts">${facts}</ul>` : ''}
    ${prio.length ? `<details class="prio"><summary>${esc(C.BRIEF.priorityHead)} (${prio.length})</summary><ul class="small">${prio.map(prioLine).join('')}</ul><p class="small muted">${esc(C.BRIEF.mechMega)} ${esc(C.BRIEF.mechSource)}</p></details>` : ''}`, 'speedsec');
}

function usefulSection(P, { pov, opp, ws }, b, six) {
  if (!b.poolMine.length) return section('useful', C.BRIEF.useful, '', `<p class="small">You haven't drafted yet.</p>`, 'you');
  const list = b.promising.length ? b.promising : b.myMons.slice(0, 2);
  const card = (m) => {
    const inSix = six.includes(m.id);
    const set = P.mineSets().find((s) => s.speciesId === m.id);
    return `<li class="ucard">${P.pt(m.id, { size: 'md' })}<div class="ubody"><p><b>${esc(P.spName(m.id))}</b> ${typeBars(dexSp(P, m.id)?.forms[0].types ?? [])}</p>
      <p class="small rowlab">${esc(C.BRIEF.why)}</p><ul class="rsns">${m.pros.slice(0, 3).map((x) => reasonChip(P, x, 'pro')).join('') || `<li class="small muted">—</li>`}</ul>
      <p class="small rowlab">${esc(C.BRIEF.costs)}</p><ul class="rsns">${m.cons.slice(0, 2).map((x) => reasonChip(P, x, 'con')).join('') || `<li class="small muted">${esc(C.BRIEF.noCost)}</li>`}</ul>
      <p class="acts">${chipBtn(inSix ? C.BRIEF.inSix : C.BRIEF.addSix, 'brief-six', { species: m.id }, inSix)} ${btn(C.BRIEF.speedBtn, 'brief-speed', { a: b.key[0] ?? '', b: m.id }, { cls: 'linkish' })} ${btn(set ? C.BRIEF.setBtn : 'Start a set ›', 'brief-set', { side: 'mine', species: m.id }, { cls: 'linkish' })}</p></div></li>`;
  };
  return section('useful', C.BRIEF.useful, C.BRIEF.usefulTag, `<ul class="ucards">${list.map(card).join('')}</ul>${b.myMons.length > list.length ? `<details><summary>All of yours (${b.myMons.length})</summary><ul class="ucards">${b.myMons.filter((x) => !list.includes(x)).map(card).join('')}</ul></details>` : ''}`, 'you', C.BRIEF.usefulSub(opp.name));
}

const unlessText = (u) => (u.ability ? C.BRIEF.unless[u.ability] : u.item ? C.BRIEF.unless[u.item] : C.BRIEF.unless[u.condition]) ?? '';
function cpEntry(P, e) {
  const via = e.via && String(e.via) !== e.label ? `: ${String(e.via)}` : '';
  const blunt = e.bluntedBy.length ? ` <span class="blunt">${esc(C.BRIEF.blunted(e.bluntedBy.map((x) => `${P.spName(x.id)}${x.via ? ` (${x.via})` : ''}`).join(', ')))}${e.bluntedBy.flatMap((x) => x.unless ?? []).length ? `, ${esc([...new Set(e.bluntedBy.flatMap((x) => (x.unless ?? []).map(unlessText)))].join('; '))}` : ''}</span>` : '';
  const hidden = e.visibility.closed === 'until-used' ? ` <span class="small muted">(${esc(C.BRIEF.hiddenUntilUsed)})</span>` : '';
  return `<li class="cp lyr-${esc(e.layer)}${e.bluntedBy.length ? ' isblunt' : ''}">${mini(P, e.mon)} <span class="rc">${esc(e.label)}</span>${esc(via)} ${layerChip(e.layer)}${hidden}${blunt}</li>`;
}
function myPlansSection(P, ctx, b) {
  if (b.layers.cores !== 'ready') return '';
  if (!b.myCores.length) return section('myplans', C.BRIEF.yourPlans, C.BRIEF.yourPlansSub, `<p class="small">${esc(C.BRIEF.noMyPlans)}</p>`, 'you');
  // at a glance: the plan, its members and who of theirs could answer it (≤3 faces, layer borders); the full lists fold away
  const card = (c) => {
    const who = [];
    for (const e of [...c.visible, ...c.couldPrep]) if (!who.some((x) => x.mon === e.mon)) who.push(e);
    const shown = who.slice(0, 3), more = who.length - shown.length;
    const n = c.visible.length + c.couldPrep.length;
    return `<li class="mycore"><p class="ph">${modeBadge(c.coreId)} <span class="rc">${esc(c.label)}</span> <span class="conf">${esc(C.BRIEF.confidence[c.confidence])}</span></p>
    <div class="minis">${c.members.map((m) => mini(P, m.id, m.mega ? '<span class="megad inline" aria-label="Mega">M</span>' : '')).join('')}</div>
    <p class="small cpline"><b>${esc(C.BRIEF.theyCouldAnswer)}</b> ${who.length ? `${shown.map((e) => `<span class="cpmini lyr-${esc(e.layer)}">${mini(P, e.mon)}</span>`).join('')}${more > 0 ? ` <span class="muted">${esc(C.BRIEF.plusMore(more))}</span>` : ''}` : `<span class="muted">${esc(C.BRIEF.theirListed.none)}</span>`}</p>
    ${c.reassure.length ? `<p class="small reassure">✓ ${esc(C.BRIEF.reassureShort(c.reassure.length))}</p>` : ''}
    ${n || c.reassure.length ? `<details class="cpd"><summary>${esc(C.BRIEF.cpDetails(n))}</summary>
      ${c.visible.length ? `<p class="small rowlab">${esc(C.BRIEF.visible)}</p><ul class="cps">${c.visible.map((e) => cpEntry(P, e)).join('')}</ul>` : ''}
      ${c.couldPrep.length ? `<p class="small rowlab">${esc(C.BRIEF.couldPrep)}</p><ul class="cps">${c.couldPrep.map((e) => cpEntry(P, e)).join('')}</ul>` : ''}
      ${c.reassure.length ? `<p class="small rowlab">${esc(C.BRIEF.reassure)}</p><ul class="cps">${[...new Set(c.reassure.map((e) => e.answer))].map((a) => `<li class="reassure">${c.reassure.filter((e) => e.answer === a).map((e) => mini(P, e.mon)).join('')} ${esc(C.BRIEF.reassureText[a] ?? '')}</li>`).join('')}</ul>` : ''}</details>` : ''}</li>`;
  };
  return section('myplans', C.BRIEF.yourPlans, C.BRIEF.yourPlansSub, `<ul class="mycores">${b.myCores.map(card).join('')}</ul>`, 'you');
}

function leadsSection(P, ctx, b) {
  if (!b.leadIdeas.length) return '';
  const card = (p) => `<li class="lcard"><div class="minis pair">${p.pair.map((id) => mini(P, id)).join('<span aria-hidden="true">+</span>')}</div>
    <ul class="rsns">${p.pros.map((x) => reasonChip(P, x, 'pro')).join('')}${p.cons.map((x) => reasonChip(P, x, 'con')).join('')}</ul>
    <p class="acts">${btn(C.BRIEF.testIt, 'brief-practice', { purpose: `Test ${p.pair.map((id) => P.spName(id)).join(' + ')} as a pair vs ${ctx.opp.name}'s pool` }, { cls: 'linkish' })}</p></li>`;
  return section('leads', C.BRIEF.leads, C.BRIEF.leadsSub, `<ul class="lcards">${b.leadIdeas.map(card).join('')}</ul>`, 'you');
}

const checkData = (k) => ({ as: k.attacker.side, aspecies: k.attacker.species, ds: k.defender.side, dspecies: k.defender.species, move: k.move, mega: k.attacker.ifMega ? '1' : '' });
function checkQuestion(P, k) {
  const a = `${P.spName(k.attacker.species)}${k.attacker.ifMega ? ' (Mega)' : ''}`, d = P.spName(k.defender.species), mv = P.name('moves', k.move);
  return k.dir === 'survive' ? C.BRIEF.q.survive(a, mv, d) : C.BRIEF.q.ko(a, mv, d);
}
function checksSection(P, ctx, b) {
  const out = [];
  const first = b.threats.find((t) => t.ring === 'look-first');
  const calc = first?.checks?.find((k) => k.kind === 'calc');
  if (calc) out.push(`<li class="check">${P.pt(calc.attacker.species, { size: 'xs' })} <span>${esc(checkQuestion(P, calc))}</span> ${layerChip(calc.moveLayer)}${calc.viaAbility ? ` <span class="small muted">(${esc(P.name('abilities', calc.viaAbility))} makes it ${esc(calc.moveType)})</span>` : ''} ${btn(C.BRIEF.calcBtn, 'brief-calc', checkData(calc), { primary: true })}</li>`);
  const fact = b.speed.facts[0];
  if (fact) { const p = fact[0]; out.push(`<li class="check">${P.pt(p.aId, { size: 'xs' })} <span>${esc(C.BRIEF.q.speed(P.spName(p.aId), p.bForm))}</span> ${btn(C.BRIEF.speedBtn, 'brief-speed', { a: p.bId, b: p.aId })}</li>`); }
  const plan = b.theirPlans.find((p) => p.confidence === 'likely') ?? b.theirPlans[0];
  if (plan) out.push(`<li class="check">${modeBadge(plan.coreId)} <span>${esc(C.BRIEF.q.practice(plan.label))}</span> ${btn('Practice', 'brief-practice', { purpose: C.BRIEF.q.practice(plan.label) })}</li>`);
  if (!out.length) return '';
  return section('checks', C.BRIEF.checks, C.BRIEF.checksSub, `<ul class="checks">${out.slice(0, 3).join('')}</ul>`);
}

function tray(P, { pov, opp, ws }, six, lens) {
  const rule = P.docs.rules.rules.sixPerMatch?.value;
  return `<div class="tray${six.length ? ' has-six' : ''}" role="group" aria-label="${esc(C.BRIEF.tray)}"><span class="tray-h"><b>${esc(C.BRIEF.tray)}</b> ${six.length}/6</span>
    <span class="tray-slots">${six.length ? six.map((id) => `<span class="tslot" title="${esc(P.spName(id))}">${P.pt(id, { size: 'xs' })}<span class="vh">${esc(P.spName(id))}</span></span>`).join('') : `<span class="small muted">${esc(C.BRIEF.trayEmpty)}</span>`}</span>
    ${six.length ? `<span class="lens" role="group" aria-label="${esc(C.BRIEF.lens)}">${chipBtn(C.BRIEF.lensTen, 'brief-lens', { lens: '10' }, lens === '10')}${chipBtn(C.BRIEF.lensSix, 'brief-lens', { lens: '6' }, lens === '6')}</span>` : ''}
    ${rule === 'unknown' || !rule ? `<span class="small muted">${esc(C.BRIEF.sixRuleUnknown)}</span>` : ''}</div>`;
}

// ---------- detail sheets (level 2) ----------
function detail(P, ctx, b) {
  const { r, pov, opp } = ctx;
  const d = r.detail;
  const back = `<p>${btn(C.BRIEF.back, 'back', {}, { cls: 'back' })}</p>`;
  if (d.core) {
    const p = b.theirPlans.find((x) => x.coreId === d.core);
    if (!p) return `<section class="sheet">${back}${h2('Not in this matchup')}<p class="small">That plan doesn't fit ${esc(opp.name)}'s pool now.</p></section>`;
    return `<section class="sheet" aria-labelledby="prep-h">${back}${h2(`${C.BRIEF.core}: ${p.label}`)}
      ${p.oneLineWhy ? `<p class="rc">${esc(p.oneLineWhy)}</p>` : ''}
      <p class="small rowlab">${esc(C.BRIEF.coreMembers)}</p><div class="minis">${p.members.map((id) => mini(P, id, p.megaUser === id ? '<span class="megad inline">M</span>' : '')).join('')}</div>
      ${p.tells.length ? `<p class="small">${esc(C.BRIEF.tells)} ${esc(p.tells.map(nm(P)).join(', '))}</p>` : ''}
      <p><b>${esc(C.BRIEF.you)}</b> ${esc(C.BRIEF.status[p.myStatus ?? 'none'])} <span class="small muted">(${esc(C.BRIEF.yourAnswers)})</span></p>
      <ul class="small">${p.myCounted.map((c) => `<li>${esc(P.spName(c.mon))}: <span class="rc">${esc(c.label)}</span>${c.via ? ` (${esc(c.via)})` : ''}${c.anchor ? ` · ${esc(C.BRIEF.anchor)}` : ''}${c.contestedBy ? ` · ${esc(C.BRIEF.contested(P.spName(c.contestedBy)))}` : ''}</li>`).join('') || '<li>—</li>'}</ul>
      ${p.cofailTypes.map((c) => `<p class="small warnline">⚠ ${esc(C.BRIEF.cofail(c.type, c.victims.map(nm(P)).join(', ')))}</p>`).join('')}
      <p>${btn(C.BRIEF.rehearse, 'brief-practice', { purpose: C.BRIEF.q.practice(p.label) }, { primary: true })}</p></section>`;
  }
  const coach = d.side === 'their' ? opp : pov;
  const id = coach.picks[d.n - 1]?.id;
  if (!id || !dexSp(P, id)) return `<section class="sheet">${back}${h2('Not drafted')}<p class="small">${esc(C.BRIEF.openSlot(null))}</p></section>`;
  const s = dexSp(P, id);
  const forms = `<p class="small">${s.forms.map((f) => `${esc(f.name)} ${typeBars(f.types)}${f.mega ? ' <span class="megad inline">M</span>' : ''}`).join(' · ')}</p>`;
  if (d.side === 'their') {
    const t = b.threats.find((x) => x.id === id);
    const victims = t?.pressure?.victims ?? [];
    const rows = b.speed.rows(briefUi(P, pov.name, opp.name).scenario === 'tr' ? 'tr' : 'none');
    const mine = rows.filter((x) => x.side === 'mine' && !x.mega), theirBase = rows.find((x) => x.side === 'theirs' && x.id === id && !x.mega);
    const faster = mine.filter((x) => x.min > theirBase.max).map((x) => x.id), slower = mine.filter((x) => x.max < theirBase.min).map((x) => x.id);
    const could = b.myCores.flatMap((c) => c.couldPrep.filter((e) => e.mon === id).map((e) => ({ ...e, core: c.label })));
    const ladderMoves = (s.keyMoves ?? []).slice(0, 6);
    const checks = (t?.checks ?? []).filter((k) => k.kind === 'calc');
    return `<section class="sheet them" aria-labelledby="prep-h">${back}${h2(C.BRIEF.sheetThem(P.spName(id)))}
      <div class="sheethead">${P.pt(id, { size: 'lg' })}<div>${forms}${t?.ring === 'look-first' ? `<p class="small">${esc(C.BRIEF.ringLabel(t.rank))}</p>` : ''}</div></div>
      ${t?.reasons.length ? `<ul class="rsns">${t.reasons.map((x) => reasonChip(P, x, 'them')).join('')}</ul>` : ''}
      <p class="small rowlab">${esc(C.BRIEF.sheetHits(P.spName(id)))}${t?.pressure?.mega ? ` (${esc(C.BRIEF.asMega(t.pressure.form))})` : ''}</p><div class="minis">${victims.map((v) => mini(P, v.id, multBadge(v.mult))).join('') || `<span class="small muted">${esc(C.BRIEF.none)}</span>`}</div>
      <p class="small rowlab">${esc(C.BRIEF.sheetWalls)}</p><div class="minis">${(t?.pressure?.walls ?? []).map((w) => mini(P, w)).join('') || `<span class="small muted">${esc(C.BRIEF.none)}</span>`}</div>
      <p class="small rowlab">${esc(C.BRIEF.sheetFaster)} (${esc(C.BRIEF.scenario[briefUi(P, pov.name, opp.name).scenario === 'tr' ? 'tr' : 'none'])})</p><div class="minis">${faster.map((x) => mini(P, x)).join('') || `<span class="small muted">${esc(C.BRIEF.none)}</span>`}</div>
      <p class="small rowlab">${esc(C.BRIEF.sheetSlower)}</p><div class="minis">${slower.map((x) => mini(P, x)).join('') || `<span class="small muted">${esc(C.BRIEF.none)}</span>`}</div>
      <p class="small">Speed ${theirBase.min}–${theirBase.max} (32 SP neutral: ${theirBase.neutralMax})</p>
      <h3>${esc(C.BRIEF.sheetTools)}</h3><p>${(t?.tools ?? []).map((x) => `<span class="tool lyr-${esc(x.layer === 'known-if-mega' ? 'known' : x.layer)}">${esc(x.kind === 'move' ? P.name('moves', x.via) : P.name('abilities', x.via))}${x.form ? ` (${esc(x.form)})` : ''} ${layerChip(x.layer)}</span>`).join(' ') || `<span class="small muted">${esc(P.mech ? C.BRIEF.noTools : C.BRIEF.layerNotice['mech-loading'])}</span>`}</p>
      ${ladderMoves.length ? `<h3>${esc(C.BRIEF.sheetLadder)}</h3><p>${ladderMoves.map((m) => `<span class="tool lyr-prior">${esc(m)}</span>`).join(' ')} <span class="small muted">(${esc(P.app.dex.sources?.keyMoves ?? '')})</span></p>` : ''}
      ${could.length ? `<h3>${esc(C.BRIEF.sheetCould)}</h3><ul class="cps">${could.map((e) => cpEntry(P, e)).join('')}</ul>` : ''}
      <h3>${esc(C.BRIEF.checks)}</h3><ul class="checks">${checks.map((k) => `<li class="check"><span>${esc(checkQuestion(P, k))}</span> ${layerChip(k.moveLayer)} ${btn(C.BRIEF.calcBtn, 'brief-calc', checkData(k))}</li>`).join('') || `<li class="small muted">${esc(C.BRIEF.layerNotice['mech-loading'])}</li>`}</ul>
      <p>${btn(C.BRIEF.speedBtn, 'brief-speed', { a: id, b: b.promising[0]?.id ?? '' })} ${btn(C.BRIEF.theirSetBtn, 'brief-set', { side: 'their', species: id })}</p></section>`;
  }
  const m = b.myMons.find((x) => x.id === id);
  const sets = P.mineSets().filter((x) => x.speciesId === id);
  const six = sixOf(P, ctx.ws);
  return `<section class="sheet you" aria-labelledby="prep-h">${back}${h2(C.BRIEF.sheetYou(P.spName(id)))}
    <div class="sheethead">${P.pt(id, { size: 'lg' })}<div>${forms}</div></div>
    <p class="small rowlab">${esc(C.BRIEF.why)}</p><ul class="rsns">${(m?.pros ?? []).map((x) => reasonChip(P, x, 'pro')).join('') || '<li class="small muted">—</li>'}</ul>
    <p class="small rowlab">${esc(C.BRIEF.costs)}</p><ul class="rsns">${(m?.cons ?? []).map((x) => reasonChip(P, x, 'con')).join('') || `<li class="small muted">${esc(C.BRIEF.noCost)}</li>`}</ul>
    <h3>${esc(C.BRIEF.sheetSets)}</h3>${P.identity() === pov.name ? `<ul class="small">${sets.map((x) => `<li>${btn(`${x.name || 'Set'} v${x.currentV}`, 'open-my-set', { set: x.id }, { cls: 'linkish' })}</li>`).join('') || `<li>${esc(C.BRIEF.noSets)}</li>`}</ul>` : `<p class="small muted">${esc(C.POV.viewingAs(pov.name))}</p>`}
    <p>${chipBtn(six.includes(id) ? C.BRIEF.inSix : C.BRIEF.addSix, 'brief-six', { species: id }, six.includes(id))} ${btn(C.BRIEF.speedBtn, 'brief-speed', { a: b.key[0] ?? '', b: id })} ${btn(sets.length ? C.BRIEF.setBtn : 'Start a set ›', 'brief-set', { side: 'mine', species: id })}</p></section>`;
}

// ---------- actions ----------
const matchOf = (P) => P.match?.() ?? null;
/** The workspace for the open matchup, created on this tap if there is none (an explicit action). */
const wsFor = (P) => { const m = matchOf(P); return m ? P.ensureWorkspace(m.pov.name, m.opp.name) : null; };
const stOf = (P) => { const m = matchOf(P); return m ? briefUi(P, m.pov.name, m.opp.name) : null; };
const routeHere = (P, extra = {}) => ({ view: 'ws', pov: P.route.pov, opp: P.route.opp, tab: 'brief', ...extra });
/** Their set for a species in a workspace (the version calcs default to), else any of their sets for it. */
function theirSetId(ws, sp) {
  const v = defaultVariant(ws);
  return ws.theirSets.find((s) => s.id === v?.setIds?.[sp])?.id ?? ws.theirSets.find((s) => s.speciesId === sp)?.id ?? null;
}
function mySetId(P, ws, sp) {
  const inSix = new Set((ws.my6 ?? []).map((m) => m.setId));
  const sets = P.mineSets().filter((s) => s.speciesId === sp);
  return (sets.find((s) => inSix.has(s.id)) ?? sets[0])?.id ?? null;
}
function openCalc(P, ws, k) {
  const side = (s, sp) => ({ side: s, species: sp, setId: s === 'theirs' ? theirSetId(ws, sp) : mySetId(P, ws, sp) });
  const cd = { a: side(k.as, k.aspecies), d: side(k.ds, k.dspecies), move: k.move, crit: false, hits: 0, firstHitOnly: false, moveState: {}, field: {}, aState: {}, dState: {}, calcId: null, title: '' };
  // an unsaved quick check is never replaced silently: P.prefill asks first
  P.prefill(ws, 'cd', cd, { view: 'ws', wsId: ws.id, kind: 'calcs', id: 'new' });
}
export const actions = {
  'go-opp-brief': (t, P) => P.go(routeHere(P)),
  'brief-open': (t, P) => {
    if (!matchOf(P)) return;
    const detail = t.dataset.core ? { core: t.dataset.core } : { side: t.dataset.side === 'your' ? 'your' : 'their', n: Number(t.dataset.n) };
    P.go(routeHere(P, { detail }), { push: true });
  },
  'brief-sel': (t, P) => {
    const st = stOf(P);
    if (!st) return;
    const k = t.dataset.key;
    st.sel = st.sel.includes(k) ? st.sel.filter((x) => x !== k) : [...st.sel, k].slice(-2);
    P.saveUi();
    P.app.rerender();
    if (st.sel.length === 2) {
      const m = matchOf(P);
      const { b } = modelFor(P, m.pov, m.opp, m.ws);
      const rows = b.speed.rows(st.scenario);
      const [a, c] = st.sel.map((x) => rows.find((r) => r.key === x));
      if (a && c) P.app.announce?.(C.BRIEF.verdict[compareSpeed(a.exact ? a.max : a, c.exact ? c.max : c, { trickRoom: st.scenario === 'tr' })](P.spName(a.id), P.spName(c.id)));
    }
  },
  'brief-showall': (t, P) => { const st = stOf(P); if (st) { st.showAll = !st.showAll; P.saveUi(); P.app.rerender(); } },
  'brief-lens': (t, P) => { const st = stOf(P); if (st) { st.lens = t.dataset.lens === '6' ? '6' : '10'; P.saveUi(); P.app.announce?.(C.BRIEF.lensSaid(st.lens)); P.app.rerender(); } },
  'brief-scenario-go': (t, P) => { const st = stOf(P); if (st) { st.scenario = t.dataset.scenario; st.sel = []; P.saveUi(); P.focusOn('bs-speed'); } },
  // + My 6: a shortlist of species saved with this matchup's prep (it starts the prep: an explicit tap)
  'brief-six': (t, P) => {
    const ws = wsFor(P);
    if (!ws) return;
    const sp = t.dataset.species;
    P.mutate(`ws:${ws.id}`, (d) => { const a = d.shortlist ?? []; d.shortlist = a.includes(sp) ? a.filter((x) => x !== sp) : [...a, sp].slice(0, 10); });
  },
  'brief-next': (t, P) => {
    const ws = wsFor(P);
    if (!ws) return;
    const owner = ownerOf(ws);
    for (const w of P.ws.values()) if (w.id !== ws.id && w.isNext && ownerOf(w) === owner) P.mutate(`ws:${w.id}`, (d) => { d.isNext = false; }, { render: false });
    P.mutate(`ws:${ws.id}`, (d) => { d.isNext = !d.isNext; });
  },
  'brief-calc': (t, P) => {
    if (!matchOf(P)) return;
    const k = { as: t.dataset.as, aspecies: t.dataset.aspecies, ds: t.dataset.ds, dspecies: t.dataset.dspecies, move: t.dataset.move };
    const ws = wsFor(P);
    if (ws) openCalc(P, ws, k);
  },
  'brief-speed': (t, P) => {
    const st = stOf(P), ws = wsFor(P);
    if (!ws) return;
    const scen = st?.scenario ?? 'none';
    const sel = [t.dataset.a ? `t:${t.dataset.a}` : null, t.dataset.b ? `m:${t.dataset.b}` : null].filter(Boolean);
    P.wsUi(ws.id).sp = { tailwindMine: scen === 'tw-mine', tailwindTheirs: scen === 'tw-theirs', trickRoom: scen === 'tr', icyWind: false, paraThem: false, sel };
    P.go({ view: 'ws', wsId: ws.id, kind: 'speed' }, { push: true });
  },
  'brief-threshold': (t, P) => {
    const st = stOf(P), ws = wsFor(P);
    if (!ws) return;
    const m = matchOf(P);
    const mineIds = new Set(m.pov.picks.map((p) => p.id));
    const [mine, theirs] = mineIds.has(t.dataset.a) ? [t.dataset.a, t.dataset.b] : [t.dataset.b, t.dataset.a];
    P.prefill(ws, 'th', { kind: 'outspeed', mine: mySetId(P, ws, mine), their: theirSetId(ws, theirs), theirSpecies: theirs, move: '', investment: 'max', crit: false, result: null,
      trickRoom: st?.scenario === 'tr', tailwindMine: st?.scenario === 'tw-mine', tailwindTheirs: st?.scenario === 'tw-theirs' }, { view: 'ws', wsId: ws.id, kind: 'threshold' });
  },
  // a purpose idea for a mock brief: shown there as a suggestion to tap (the Purpose field stays yours to fill)
  'brief-practice': (t, P) => {
    const ws = wsFor(P);
    if (!ws) return;
    P.wsUi(ws.id).brPurposeHint = String(t.dataset.purpose ?? '').slice(0, 160);
    P.go({ view: 'ws', wsId: ws.id, kind: 'brief' }, { push: true });
  },
  'brief-set': (t, P) => {
    const ws = wsFor(P);
    if (!ws) return;
    if (t.dataset.side === 'mine') {
      const id = mySetId(P, ws, t.dataset.species);
      if (id) return P.go({ view: 'ws', wsId: ws.id, kind: 'sets', id }, { push: true });
    } else {
      const id = theirSetId(ws, t.dataset.species);
      if (id) return P.go({ view: 'ws', wsId: ws.id, kind: 'sets', id }, { push: true });
    }
    P.go({ view: 'ws', pov: P.route.pov, opp: P.route.opp, tab: 'sets' }, { push: true });
  },
  // their draft board in League, with the app's "Back to my prep" banner (Battle Prep keeps this route while you look)
  'brief-viewas': (t, P) => { const m = matchOf(P); if (m) P.app.viewAs(m.opp.name, () => {}); },
  // See it from their side: the same briefing with the seats swapped (push, so Back un-flips)
  flip: (t, P) => { const r = P.route; if (matchOf(P)) P.go({ view: 'ws', pov: r.opp, opp: r.pov, tab: 'brief' }, { push: true }); },
};
export const changes = {
  'brief-scenario': (t, P) => { const st = stOf(P); if (st) { st.scenario = t.value; st.sel = []; P.saveUi(); P.app.rerender(); } },
  'brief-ws': (t, P) => { const m = matchOf(P); if (!m) return; (P.ui.activeWs ??= {})[keyOf(m.pov.name, m.opp.name)] = t.value; P.go(P.route, { push: false }); },
};
export const inputs = {};

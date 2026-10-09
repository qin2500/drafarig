// Battle Prep › Chat with the VGC agent. A panel under the open screen, so the page it talks about stays the page you have
// open.
// - Each message carries that page's context, built from an allowlist (lib/chat-context.mjs) and shown as chips you can
//   remove. Your notes go only when you tick "include my notes".
// - Replies are shown as plain text (escaped; no links or markup).
// - Every state is said as it is: not set up, sign in, not yours, offline (with last seen), waiting, answering, answered,
//   not delivered, timed out, cancelled, too many messages. There are never canned replies.
// - The network goes through app.chat (same-origin, only after the panel opens); this file has none of its own.
import { checkContext, withoutChips, newConvId, newClientId, CHAT_LIMITS, PAGE_VIEWS, RULE_VALUES, CONV_RE } from '../lib/chat-context.mjs';
import { isMatch } from '../lib/prep-route.mjs';
import { ownerOf, workspacesFor } from '../lib/prep-matchup.mjs';
import { currentVersion } from '../lib/prep-model.mjs';
import { SOURCES } from '../lib/prep-schema.mjs';
import * as C from './prep-copy.js';
import { esc, attrs, btn, koWords } from './prep-ui.js';
import { sixOf, modelFor } from './prep-matchup.js';
import { boardModel, cardFor, cardPicks, previewWs } from './prep-board.js';
import { summarize } from './prep-calcs.js';

// A message is polled every 2 s for its first minute, then every 10 s, until it's final or 11 minutes have passed (past
// the Site's own limits: 10 min unclaimed, 240 s once claimed). Then the bubble says "No update yet" with Check again.
export const POLL = { fastMs: 2000, slowMs: 10_000, fastForMs: 60_000, forMs: 11 * 60_000 }; // tests shorten these
const FINAL = new Set(['answered', 'expired', 'timeout', 'cancelled', 'rate-limited', 'error', 'declined', 'missing']);
export const chatUi = (P) => (P.ui.chat ??= { open: false, checking: false, st: null, draft: '', notes: false, removed: [], msgs: [], whoami: null, confirmClear: false, sending: false });
const convOf = (P) => { let c = P.store.hint('chatConv'); if (!c || !CONV_RE.test(c)) { c = newConvId(); P.store.hint('chatConv', c); } return c; };
/** The "Ask the VGC agent" entry under a screen (focus returns here when the panel closes). */
export const entry = (label) => `<button type="button" id="chat-entry" class="linkish chat-entry" data-pa="chat-open">${esc(label)}</button>`;

// ---------- the page as context (allowlisted) ----------
/** The open matchup (pov, opp, ws), from a seat route or a workspace opened by id; null elsewhere. */
function matchOfRoute(P) {
  const r = P.route;
  if (isMatch(r)) { const m = P.match(r); return m ? { ...m, ws: m.ws ?? workspacesFor([...P.ws.values()], m.pov.name, m.opp.name)[0] ?? null } : null; }
  if (r.view === 'ws') {
    const ws = P.ws.get(r.wsId), owner = ws && ownerOf(ws);
    const pov = owner && (P.coaches() ?? []).find((c) => c.name === owner), opp = ws && (P.coaches() ?? []).find((c) => c.name === ws.coach);
    return pov && opp ? { pov, opp, ws } : null;
  }
  return null;
}
function viewOf(r) {
  if (r.view === 'home' || r.view === 'overview') return 'overview';
  if (r.kind === 'calcs') return 'calcs';
  if (r.kind === 'sets' || (r.view === 'my-sets' && r.id)) return 'sets';
  if (r.kind || r.detail) return 'other';
  const t = r.tab ?? (isMatch(r) ? 'brief' : 'plan');
  return PAGE_VIEWS.includes(t) ? t : 'other';
}
const SOURCE_OF = { suggested: 'detected', saved: 'saved', seed: 'seed', 'look-first': 'look-first' };
/** The open plan card on the Plan board: their plan (with where it comes from) and your picks (species; the Mega as its form). */
function planPart(P, ws) {
  const w = ws ?? previewWs(P);
  const m = w && boardModel(P, w);
  const t = m?.target;
  if (!t) return null;
  const picks = cardPicks(P, cardFor(w, t.planId));
  const detected = t.coreId ? m.b.theirPlans.find((x) => x.coreId === t.coreId) : null;
  // a saved plan's own label is your free text: it goes only with your notes (notesOf), so the name here is generated
  const name = (t.source === 'suggested' ? t.label : t.source === 'saved' ? detected?.label || C.BOARD.seed[t.seed] || C.PLAN_KIND[t.kind] : C.BOARD.seed[t.seed]) ?? '';
  return { name: name.slice(0, 60), source: SOURCE_OF[t.source], members: t.members.slice(0, 10), tells: t.tells.slice(0, 10), theirSpeed: t.speedMode,
    lead: picks.lead.slice(0, 2), back: picks.back.slice(0, 4), mega: picks.megaForm || picks.mega || '', myStatus: detected?.myStatus ?? null };
}
/** The Brief's own reading: look-first mons and why (codes), their plans with your listed-answer status, and the Speed facts. */
function briefingPart(P, m) {
  const { b } = modelFor(P, m.pov, m.opp, m.ws);
  if (!b) return null;
  const threat = (id) => b.threats.find((x) => x.id === id);
  return {
    key: b.key.slice(0, 3).map((id) => ({ id, reasons: [...new Set((threat(id)?.reasons ?? []).map((r) => r.code))].slice(0, 8) })),
    plans: b.theirPlans.slice(0, 6).map((x) => ({ core: x.coreId, tells: x.tells.slice(0, 6), status: x.myStatus ?? null })),
    speed: b.speed.facts.flat().slice(0, 12).map((x) => ({ a: x.aId, b: x.bId, scenario: x.scenario, result: x.result })),
  };
}
const ID = /^[a-z0-9]{1,40}$/;
const idOr = (v) => (typeof v === 'string' && ID.test(v) ? v : '');
const srcOr = (v) => (SOURCES.includes(v) ? v : null);
/** The set open in the set editor, as you see it (an unsaved draft included). Your own sets only when you're you. */
function setPart(P, r, ws, you) {
  if (!r.id || (r.view === 'ws' ? r.kind !== 'sets' : r.view !== 'my-sets')) return null;
  const l = ws?.theirSets.find((x) => x.id === r.id) ?? P.docs.mysets?.sets.find((x) => x.id === r.id);
  if (!l || (l.side === 'mine' && r.view === 'ws' && !you) || !ID.test(l.speciesId ?? '')) return null;
  const d = (l.side === 'mine' ? P.docs.mysets?.drafts : ws?.drafts)?.[l.id], cur = currentVersion(l);
  const data = d?.data ?? cur.data, prov = (d ? d.provenance : cur.provenance) ?? {};
  const moves = (data.moves ?? []).map((x, i) => [idOr(x), i]).filter(([x]) => x).slice(0, 4);
  const sp = data.sp === 'unknown' || !data.sp ? 'unknown' : Object.fromEntries(['hp', 'atk', 'def', 'spa', 'spd', 'spe'].map((k) => [k, Math.min(32, Math.max(0, Math.round(Number(data.sp[k]) || 0)))]));
  const out = { side: l.side, species: l.speciesId, item: idOr(data.item), ability: idOr(data.ability), nature: idOr(data.nature), moves: moves.map(([x]) => x), sp };
  if (l.side === 'theirs') out.src = { item: srcOr(prov.item?.source), ability: srcOr(prov.ability?.source), nature: srcOr(prov.nature?.source), sp: srcOr(prov.sp?.source), moves: moves.map(([, i]) => srcOr(prov.moves?.[i]?.source)) };
  return out;
}
const norm = (v) => String(v).toLowerCase().replace(/[^a-z0-9+.-]/g, '');
const kebab = (k) => k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
/** The conditions a calc ran under, as codes: the calc's own chips (Mega, Intimidate, spread, stages…) and the field. */
function calcChips(s, sc) {
  const out = (s.chips ?? []).map((c) => `${norm(c.code)}${c.side ? `@${norm(c.side)}` : ''}${c.stat ? `:${norm(c.stat)}` : ''}${c.value !== undefined && c.value !== null && c.value !== '' ? `=${norm(c.value)}` : ''}`);
  const f = sc.field ?? {};
  if (f.weather) out.push(`weather=${norm(f.weather)}`);
  if (f.terrain) out.push(`terrain=${norm(f.terrain)}`);
  for (const k of ['gravity', 'magicRoom', 'wonderRoom', 'otherFairyAura']) if (f[k]) out.push(kebab(k));
  for (const [side, o] of [['attacker', f.attackerSide], ['defender', f.defenderSide]]) for (const [k, v] of Object.entries(o ?? {})) if (v === true && !['allyPresent', 'partnerPresent'].includes(k)) out.push(`${kebab(k)}@${side}`);
  if (sc.move?.crit) out.push('crit');
  return [...new Set(out.map((x) => x.slice(0, 48)).filter(Boolean))].slice(0, 16);
}
/** A KO chance in short: "k/16" for one roll of one hit, else a percentage (never rounded to "sure"). */
function koShort(ko, hits = 1) {
  if (!ko || ko.num === undefined || ko.den === undefined) return null;
  const n = BigInt(ko.num), d = BigInt(ko.den);
  if (d === 0n) return null;
  return hits === 1 && 16n % d === 0n ? `${(n * 16n) / d}/16` : `${Number((n * 1000n) / d) / 10}%`;
}
/** The calc open in the calc editor (the live draft, else the saved result): who hits whom, under what, and the numbers. */
function calcPart(P, ws, r) {
  if (!ws || r.kind !== 'calcs' || !r.id) return null;
  const saved = r.id !== 'new' ? ws.calcs.find((x) => x.id === r.id) : null;
  if (r.id !== 'new' && !saved) return null;
  const cd = P.wsUi(ws.id).cd;
  const live = !!(cd?.result && cd.resultFor && (cd.calcId ?? null) === (saved?.id ?? null));
  const sc = live ? JSON.parse(cd.resultFor) : saved?.scenario;
  const s = live ? summarize(cd.result) : saved?.summary;
  const ids = [sc?.attacker?.set?.species, sc?.defender?.set?.species, sc?.move?.id];
  if (!s || !ids.every((x) => typeof x === 'string' && ID.test(x))) return null;
  const hits = Math.max(1, ...(s.dist ?? []).map((x) => x.n));
  const pct = (n, hp) => Math.floor((1000 * n) / hp) / 10;
  const stale = !live && saved && P.staleOf(ws, saved).length ? 'out of date (not re-checked): ' : '';
  let result = C.CLASS[s.class] || 'no number';
  if (s.class === 'exact' && s.range) {
    const line = `${pct(s.range.min, s.maxHP)}–${pct(s.range.max, s.maxHP)}% of HP · ${koWords(s.ko?.one, { hits }) ?? 'no KO chance'}`;
    result = s.envelope?.length ? `depends on their investment (Stat Points unknown); max investment: ${line}` : line;
  }
  const out = { attacker: ids[0], defender: ids[1], move: ids[2], result: `${stale}${result}`.slice(0, 200), chips: calcChips(s, sc) };
  if (s.class === 'exact' && s.ko?.one?.num !== undefined && BigInt(s.ko.one.num) === 0n) out.ko2 = koShort(s.ko.two, 2);
  if (s.envelope?.length) out.envelope = s.envelope.filter((e) => ['frail', 'common', 'max'].includes(e.key)).slice(0, 3).map((e) => ({ key: e.key, ko: e.class === 'exact' ? koShort(e.ko?.one, hits) : null }));
  return out;
}
/** The overview's league weeks for this perspective (sheet facts) and the opponent you marked next, if any. */
function schedulePart(P, pov) {
  const w = P.weeks?.(pov.name);
  if (!w || w.state !== 'ok' || !w.rows.length) return null;
  const next = [...P.ws.values()].find((x) => ownerOf(x) === pov.name && x.isNext)?.coach ?? null;
  return { weeks: w.rows.slice(0, 10).map((x) => ({ week: x.week, opponent: x.opponent ? x.opponent.slice(0, 40) : null, bye: !!x.bye })), next: next ? next.slice(0, 40) : null };
}
/** Your free-text notes on this page (sent only when you tick "include my notes"): a saved plan's own name is one of them. */
function notesOf(P, ws) {
  if (!ws) return '';
  const m = boardModel(P, ws);
  const card = m?.target ? cardFor(ws, m.target.planId) : null;
  const parts = [m?.target?.source === 'saved' && m.target.label && `Plan name: ${m.target.label}`, ws.premortem && `Premortem: ${ws.premortem}`, card?.turn1Intent && `Turn 1: ${card.turn1Intent}`, card?.winCondition && `Win condition: ${card.winCondition}`,
    ...(card?.ifThen ?? []).filter((l) => l.response).map((l) => `If they lead ${(l.trigger?.theirLead ?? []).join(' + ')}: ${l.response}`)];
  return parts.filter(Boolean).join('\n').slice(0, CHAT_LIMITS.notes);
}
/** {ctx, notes}: the full context for this page (before chips are removed) and the notes that may go with it. */
export function pageContext(P) {
  const r = P.route;
  const m = matchOfRoute(P);
  const pov = m?.pov ?? (r.view === 'overview' ? P.coachBySeat(r.pov) : null);
  const ws = m?.ws ?? (r.view === 'ws' ? P.ws.get(r.wsId) ?? null : null);
  const ctx = { v: 1, page: { area: 'prep', view: viewOf(r) } };
  const you = !!pov && P.identity() === pov.name;
  if (pov) ctx.pov = { coach: pov.name.slice(0, 40), seat: pov.order, you };
  const part = (k, f) => { try { const x = f(); if (x) ctx[k] = x; } catch (e) { console.error(`Chat context (${k}) failed:`, e && e.message); } };
  if (m) {
    const vs = P.weeksVs?.(m.pov.name, m.opp.name);
    ctx.opponent = { coach: m.opp.name.slice(0, 40), seat: m.opp.order, ...(vs?.weeks.length ? { weeks: vs.weeks.slice(0, 5) } : {}), ...(vs?.oppGroup ? { group: vs.oppGroup.slice(0, 12) } : {}) };
    ctx.rosters = { mine: m.pov.picks.map((p) => p.id).filter(Boolean).slice(0, 12), theirs: m.opp.picks.map((p) => p.id).filter(Boolean).slice(0, 12) };
    const six = m.ws ? sixOf(P, m.ws).slice(0, 10) : [];
    if (six.length) ctx.six = six;
    if (ctx.page.view === 'brief') part('briefing', () => briefingPart(P, m));
    if (ctx.page.view === 'plan') part('plan', () => planPart(P, m.ws));
  } else if (pov) {
    ctx.rosters = { mine: pov.picks.map((p) => p.id).filter(Boolean).slice(0, 12) };
    if (ctx.page.view === 'overview') part('schedule', () => schedulePart(P, pov));
  }
  part('set', () => setPart(P, r, ws, you));
  part('calc', () => calcPart(P, ws, r));
  const rules = Object.fromEntries(Object.entries(P.docs.rules?.rules ?? {}).filter(([k, x]) => RULE_VALUES[k]?.includes(x?.value)).map(([k, x]) => [k, x.value]));
  if (Object.keys(rules).length) ctx.rules = rules;
  return { ctx, notes: notesOf(P, ws) };
}
/** The context as it will be sent: minus removed chips, plus notes when ticked. */
function outgoing(P) {
  const ui = chatUi(P);
  const { ctx, notes } = pageContext(P);
  const out = withoutChips(ctx, ui.removed);
  if (ui.notes && notes.trim()) out.notes = notes;
  return out;
}

// ---------- network (through app.chat) ----------
async function refresh(P) {
  const ui = chatUi(P);
  if (!P.app.chat) { ui.st = { status: 0, body: {} }; return P.app.rerender(); }
  ui.checking = true; P.app.rerender();
  ui.st = await P.app.chat.status();
  ui.checking = false;
  if (ui.st.status === 200) {
    const conv = convOf(P);
    const h = await P.app.chat.history(conv);
    if (h.status === 200) ui.msgs = (h.body.messages ?? []).map((x) => ({ ...x, conv: x.conv ?? conv }));
    for (const x of ui.msgs) if (!FINAL.has(x.state)) watch(P, x);
  }
  P.app.rerender();
}
/** The status line again (online, limits), quietly: after a message ends, so "Connected" and "Left: n" don't go stale. */
async function restatus(P) {
  const ui = chatUi(P);
  const st = await P.app.chat.status();
  if (st.status === 200 || ui.st?.status !== 200) ui.st = st;
}
/** Poll one message (in its own conversation) until it's final; past the Site's limits it says so instead of waiting on. */
function watch(P, msg) {
  const ui = chatUi(P), started = Date.now(), { id, conv } = msg;
  if ((ui.watching ??= new Set()).has(id)) return;
  ui.watching.add(id);
  msg.stuck = false;
  const step = async () => {
    const r = await P.app.chat.message(conv, id);
    const x = ui.msgs.find((y) => y.id === id);
    if (r.status === 200 && x) Object.assign(x, r.body);
    else if (r.status === 404 && x) x.state = 'missing';
    const final = !x || FINAL.has(x.state);
    if (final || Date.now() - started > POLL.forMs) {
      ui.watching.delete(id);
      if (x && final) { P.app.announce?.(C.CHATUI.stateSay[x.state] ?? ''); await restatus(P); } else if (x) x.stuck = true;
      return P.app.rerender();
    }
    P.app.rerender();
    setTimeout(step, Date.now() - started < POLL.fastForMs ? POLL.fastMs : POLL.slowMs);
  };
  setTimeout(step, POLL.fastMs);
}

// ---------- the panel ----------
/** A time today ("14:07"); on another day with its date ("3 Oct, 14:07"), so an old "last seen" never reads as today. */
export function when(ms, now = Date.now()) {
  if (!ms) return '';
  const d = new Date(ms), n = new Date(now);
  const today = d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
  return today ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : d.toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function bubble(x) {
  const st = C.CHATUI.state[x.state] ?? '';
  const text = x.reply?.kind === 'reply' && x.reply.text;
  const reply = text ? `<div class="chat-msg agent"><span class="vh">${esc(C.CHATUI.agentSaid)}</span><p class="chat-text">${esc(text)}</p></div>` : '';
  const live = x.state === 'queued' || x.state === 'working';
  const line = x.state === 'answered' && !text ? `${esc(C.CHATUI.noText)} ${btn(C.CHATUI.checkAgain, 'chat-refresh', {}, { cls: 'linkish' })}`
    : live && x.stuck ? `${esc(C.CHATUI.noUpdate)} ${btn(C.CHATUI.checkAgain, 'chat-refresh', {}, { cls: 'linkish' })}`
    : st && x.state !== 'answered' ? `${esc(st)}${live ? ` ${btn(C.CHATUI.cancel, 'chat-cancel', { msg: x.id, conv: x.conv ?? '' }, { cls: 'linkish' })}` : ''}` : '';
  return `<li class="chat-turn"><div class="chat-msg you"><span class="vh">${esc(C.CHATUI.youSaid)}</span><p class="chat-text">${esc(x.text)}</p></div>${reply}
    ${line ? `<p class="small chat-state st-${esc(x.state)}">${line}</p>` : ''}</li>`;
}
function composer(P, ui, online) {
  const { ctx, notes } = pageContext(P);
  const parts = Object.keys(ctx).filter((k) => k !== 'v');
  const label = (k) => C.CHATUI.chip[k](ctx[k], ctx);
  const chip = (k) => {
    const on = !ui.removed.includes(k), fixed = k === 'page';
    return fixed ? `<span class="pchip on fixed">${esc(label(k))}</span>`
      : `<button${attrs({ type: 'button', class: `pchip${on ? ' on' : ''}`, 'data-pa': 'chat-chip', 'data-key': k, 'aria-pressed': String(on), 'aria-label': `${label(k)}: ${on ? C.CHATUI.chipOn : C.CHATUI.chipOff}` })}>${esc(label(k))}</button>`;
  };
  const pending = ui.msgs.some((x) => x.state === 'queued' || x.state === 'working');
  const can = online && !pending && !ui.sending;
  const has = !!notes.trim();
  return `<div class="chat-compose">
    <p class="small"><b>${esc(C.CHATUI.sees)}</b> <span class="small muted">${esc(C.CHATUI.seesHelp)}</span></p>
    <div class="chat-chips" role="group" aria-label="${esc(C.CHATUI.sees)}">${parts.map(chip).join('')}${ui.notes && has ? `<span class="pchip on">${esc(C.CHATUI.chip.notes())}</span>` : ''}</div>
    <label class="chat-notes"><input type="checkbox" data-pc="chat-notes"${ui.notes ? ' checked' : ''}${has ? '' : ' disabled'}> ${esc(has ? C.CHATUI.includeNotes : C.CHATUI.noNotes)}</label>
    ${has ? `<details class="small chat-notes-preview"><summary>${esc(C.CHATUI.notesPreview)}</summary><p class="chat-text">${esc(notes)}</p></details>` : ''}
    <label class="field" for="chat-draft"><span class="vh">${esc(C.CHATUI.ask)}</span><textarea id="chat-draft" rows="3" maxlength="${CHAT_LIMITS.text}" data-pi="chat-draft" placeholder="${esc(C.CHATUI.placeholder)}"${online ? '' : ' disabled'}>${esc(ui.draft)}</textarea></label>
    <p>${btn(ui.sending ? C.CHATUI.sending : C.CHATUI.send, 'chat-send', {}, { primary: true, disabled: !can })} <span class="small muted">${esc(C.CHATUI.max(CHAT_LIMITS.text))}</span>${pending ? ` <span class="small muted">${esc(C.CHATUI.oneAtATime)}</span>` : ''}</p></div>`;
}
/** The panel's state line: what's true right now, in words. */
function stateLine(P, ui) {
  const st = ui.st;
  const retry = btn(C.CHATUI.retry, 'chat-refresh');
  const signIn = (cls) => `<a${attrs({ class: cls, href: P.app.chat.signInHref(P.app.location?.hash ?? '#prep'), target: '_top' })}>${esc(C.CHATUI.signInLink)}</a>`;
  if (ui.checking && !st) return `<p class="small muted">${esc(C.CHATUI.checking)}</p>`;
  if (!st) return '';
  if (st.status === 0) return `<p class="banner warn">${esc(C.CHATUI.unreachable)} ${retry}</p>`;
  if (st.status === 401) return `<p>${esc(C.CHATUI.signIn)}</p><p>${signIn('primary-link')}</p>`;
  if (st.status === 403 && st.body.error === 'not-the-owner') return `<p class="banner warn">${esc(C.CHATUI.notYours)}</p>`;
  if (st.status === 503 && st.body.error === 'chat-not-set-up') {
    const who = ui.whoami;
    const id = !who ? '' : who.status === 200 && typeof who.body.id === 'string' ? `<p class="small">${esc(C.CHATUI.yourId)} <code class="chat-id">${esc(who.body.id)}</code></p><p class="small muted">${esc(C.CHATUI.yourIdHelp)}</p>`
      : who.status === 401 ? `<p class="small">${signIn('primary-link')}</p>` : `<p class="small">${esc(C.CHATUI.unreachable)} ${btn(C.CHATUI.retry, 'chat-whoami')}</p>`;
    return `<p class="banner info">${esc(C.CHATUI.notSetUp)}</p><details class="small"${who ? ' open' : ''}><summary>${esc(C.CHATUI.setup)}</summary><p>${esc(C.CHATUI.setupHelp)}</p>${btn(C.CHATUI.showId, 'chat-whoami', {}, { cls: 'linkish' })}${id}</details>`;
  }
  if (st.status !== 200) return `<p class="banner warn">${esc(C.CHATUI.storage)} ${retry}</p>`;
  const r = st.body.relay ?? {};
  return r.online ? `<p class="small chat-online">● ${esc(C.CHATUI.online)} ${btn(C.CHATUI.checkAgain, 'chat-refresh', {}, { cls: 'linkish' })}</p>` : `<p class="banner warn">${esc(C.CHATUI.offline(when(r.seenAt)))} ${retry}</p>`;
}
export function panel(P) {
  const ui = chatUi(P);
  if (!ui.open) return '';
  const ok = ui.st?.status === 200, online = ok && ui.st.body.relay?.online;
  const limits = ok ? ui.st.body.limits : null;
  return `<section class="panel chat" id="chat-panel" aria-labelledby="chat-h"><div class="chat-head"><h2 id="chat-h" tabindex="-1">${esc(C.CHATUI.title)}</h2>${btn(C.CHATUI.close, 'chat-close', {}, { cls: 'linkish' })}</div>
    ${stateLine(P, ui)}
    ${ok ? `<ol class="chat-log">${ui.msgs.map(bubble).join('')}</ol>${ui.msgs.length ? '' : `<p class="small muted">${esc(C.CHATUI.empty)}</p>`}${composer(P, ui, online)}
      ${limits ? `<p class="small muted">${esc(C.CHATUI.limits(limits.hour.cap - limits.hour.used, limits.day.cap - limits.day.used))}</p>` : ''}
      <p class="small">${btn(C.CHATUI.newConv, 'chat-new', {}, { cls: 'linkish' })} · ${ui.confirmClear ? `${esc(C.CHATUI.clearAsk)} ${btn(C.CHATUI.clearYes, 'chat-clear', { confirm: 'yes' })} ${btn(C.CHATUI.clearNo, 'chat-clear-no', {}, { cls: 'linkish' })}` : btn(C.CHATUI.clear, 'chat-clear', {}, { cls: 'linkish' })}</p>` : ''}
    <p class="small muted">${esc(C.CHATUI.privacy)}</p></section>`;
}

// ---------- actions ----------
export const actions = {
  'chat-open': (t, P) => { const ui = chatUi(P); ui.open = true; ui.st = null; P.focusOn('chat-h'); refresh(P); },
  'chat-close': (t, P) => { chatUi(P).open = false; P.focusOn('chat-entry'); },
  'chat-refresh': (t, P) => refresh(P),
  'chat-whoami': async (t, P) => { const ui = chatUi(P); ui.whoami = await P.app.chat.whoami(); P.app.rerender(); },
  'chat-chip': (t, P) => { const ui = chatUi(P), k = t.dataset.key; if (k === 'page') return; ui.removed = ui.removed.includes(k) ? ui.removed.filter((x) => x !== k) : [...ui.removed, k]; P.app.rerender(); },
  'chat-send': async (t, P) => {
    const ui = chatUi(P);
    const text = ui.draft.trim();
    if (ui.sending) return;
    if (!text) { P.toast(C.CHATUI.typeFirst); return; }
    const context = outgoing(P);
    if (checkContext(context).length) { P.toast(C.CHATUI.contextTooBig); return; }
    ui.sending = true; P.app.rerender();
    const clientId = ui.retryId ?? newClientId();
    ui.retryId = clientId; // a retry after a network failure is the same message
    const r = await P.app.chat.send({ conv: convOf(P), clientId, text: text.slice(0, CHAT_LIMITS.text), context });
    ui.sending = false;
    if (r.status === 200) {
      ui.retryId = null; ui.draft = ''; ui.removed = []; ui.notes = false;
      if (!ui.msgs.some((x) => x.id === r.body.id)) ui.msgs.push({ id: r.body.id, conv: r.body.conv, text, state: r.body.state });
      watch(P, ui.msgs.find((x) => x.id === r.body.id));
      P.app.announce?.(C.CHATUI.sent);
    } else {
      if (r.status !== 0) ui.retryId = null;
      P.toast(C.CHATUI.sendError[r.body.error] ?? (r.status === 0 ? C.CHATUI.unreachable : C.CHATUI.sendError.other));
      if (r.status === 401 || r.status === 403 || r.body.error === 'relay-offline' || r.body.error === 'chat-not-set-up') return refresh(P);
    }
    P.app.rerender();
  },
  'chat-cancel': async (t, P) => {
    const ui = chatUi(P);
    const r = await P.app.chat.cancel(CONV_RE.test(t.dataset.conv ?? '') ? t.dataset.conv : convOf(P), t.dataset.msg);
    const x = ui.msgs.find((y) => y.id === t.dataset.msg);
    if (r.status === 200 && x) x.state = 'cancelled';
    else if (r.status !== 200) P.toast(C.CHATUI.cancelError);
    P.app.rerender();
  },
  'chat-new': (t, P) => { P.store.hint('chatConv', newConvId()); const ui = chatUi(P); ui.msgs = []; ui.confirmClear = false; P.app.announce?.(C.CHATUI.newSaid); P.app.rerender(); },
  'chat-clear': async (t, P) => {
    const ui = chatUi(P);
    if (t.dataset.confirm !== 'yes') { ui.confirmClear = true; return P.app.rerender(); }
    ui.confirmClear = false;
    const r = await P.app.chat.clear(convOf(P));
    if (r.status === 200) { ui.msgs = []; P.store.hint('chatConv', newConvId()); P.toast(C.CHATUI.cleared); } else P.toast(C.CHATUI.clearError);
    P.app.rerender();
  },
  'chat-clear-no': (t, P) => { chatUi(P).confirmClear = false; P.app.rerender(); },
};
export const inputs = { 'chat-draft': (t, P) => { chatUi(P).draft = String(t.value ?? '').slice(0, CHAT_LIMITS.text); } }; // no redraw while typing
export const changes = { 'chat-notes': (t, P) => { chatUi(P).notes = !!t.checked; P.app.rerender(); } };

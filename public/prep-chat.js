// Battle Prep › Chat with the VGC agent. A panel under the open screen, so the page it talks about stays the page you have
// open.
// - Each message carries that page's context, built from an allowlist (lib/chat-context.mjs) and shown as chips you can
//   remove. Your notes go only when you tick "include my notes".
// - Replies are shown as plain text (escaped; no links or markup).
// - Every state is said as it is: not set up, sign in, not yours, offline (with last seen), waiting, answering, answered,
//   not delivered, timed out, cancelled, too many messages. There are never canned replies.
// - The network goes through app.chat (same-origin, only after the panel opens); this file has none of its own.
import { checkContext, withoutChips, newConvId, newClientId, CHAT_LIMITS, PAGE_VIEWS } from '../lib/chat-context.mjs';
import { isMatch } from '../lib/prep-route.mjs';
import { ownerOf, workspacesFor } from '../lib/prep-matchup.mjs';
import * as C from './prep-copy.js';
import { esc, attrs, btn, koWords } from './prep-ui.js';
import { sixOf } from './prep-matchup.js';
import { boardModel, cardFor, cardPicks, previewWs } from './prep-board.js';

const POLL_MS = 2000, POLL_FOR_MS = 260_000;
const FINAL = new Set(['answered', 'expired', 'timeout', 'cancelled', 'rate-limited', 'error', 'declined', 'missing']);
export const chatUi = (P) => (P.ui.chat ??= { open: false, checking: false, st: null, draft: '', notes: false, removed: [], msgs: [], whoami: null, confirmClear: false, sending: false });
const convOf = (P) => { let c = P.store.hint('chatConv'); if (!c || !/^c_[a-z2-7]{16}$/.test(c)) { c = newConvId(); P.store.hint('chatConv', c); } return c; };

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
  if (r.kind || r.detail) return 'other';
  const t = r.tab ?? (isMatch(r) ? 'brief' : 'plan');
  return PAGE_VIEWS.includes(t) ? t : 'other';
}
/** The open plan card on the Plan board: their plan and your picks (species). */
function planPart(P, ws) {
  const w = ws ?? previewWs(P);
  const m = w && boardModel(P, w);
  const t = m?.target;
  if (!t) return null;
  const picks = cardPicks(P, cardFor(w, t.planId));
  const name = (t.source === 'saved' ? t.label || C.PLAN_KIND[t.kind] : t.source === 'suggested' ? t.label : C.BOARD.seed[t.seed]) ?? '';
  return { name: name.slice(0, 60), members: t.members.slice(0, 10), speed: t.speedMode, lead: picks.lead.slice(0, 2), back: picks.back.slice(0, 4), mega: picks.mega || '' };
}
function calcPart(P, ws, r) {
  const c = r.kind === 'calcs' && ws?.calcs.find((x) => x.id === r.id);
  if (!c) return null;
  const s = c.summary;
  const pct = (n) => Math.floor((1000 * n) / s.maxHP) / 10;
  const result = s?.class === 'exact' && s.range && s.ko?.one?.num !== undefined ? `${pct(s.range.min)}–${pct(s.range.max)}% · ${koWords(s.ko.one) ?? ''}` : C.CLASS[s?.class] || 'no number';
  return { attacker: c.scenario.attacker.set.species, defender: c.scenario.defender.set.species, move: c.scenario.move.id, result: result.slice(0, 160) };
}
/** Your free-text notes on this page (sent only when you tick "include my notes"). */
function notesOf(P, ws) {
  if (!ws) return '';
  const m = boardModel(P, ws);
  const card = m?.target ? cardFor(ws, m.target.planId) : null;
  const parts = [ws.premortem && `Premortem: ${ws.premortem}`, card?.turn1Intent && `Turn 1: ${card.turn1Intent}`, card?.winCondition && `Win condition: ${card.winCondition}`,
    ...(card?.ifThen ?? []).filter((l) => l.response).map((l) => `If they lead ${(l.trigger?.theirLead ?? []).join(' + ')}: ${l.response}`)];
  return parts.filter(Boolean).join('\n').slice(0, CHAT_LIMITS.notes);
}
/** {ctx, chips, notes}: the full context for this page (before chips are removed) and what each chip says. */
export function pageContext(P) {
  const r = P.route;
  const m = matchOfRoute(P);
  const pov = m?.pov ?? (r.view === 'overview' ? P.coachBySeat(r.pov) : null);
  const ctx = { v: 1, page: { area: 'prep', view: viewOf(r) } };
  if (pov) ctx.pov = { coach: pov.name.slice(0, 40), seat: pov.order, you: P.identity() === pov.name };
  if (m) {
    const vs = P.weeksVs?.(m.pov.name, m.opp.name);
    ctx.opponent = { coach: m.opp.name.slice(0, 40), seat: m.opp.order, ...(vs?.weeks.length ? { weeks: vs.weeks.slice(0, 5) } : {}), ...(vs?.oppGroup ? { group: vs.oppGroup.slice(0, 12) } : {}) };
    ctx.rosters = { mine: m.pov.picks.map((p) => p.id).filter(Boolean).slice(0, 12), theirs: m.opp.picks.map((p) => p.id).filter(Boolean).slice(0, 12) };
    const six = m.ws ? sixOf(P, m.ws).slice(0, 10) : [];
    if (six.length) ctx.six = six;
    if (ctx.page.view === 'plan') { const p = planPart(P, m.ws); if (p) ctx.plan = p; }
    const c = calcPart(P, m.ws, r);
    if (c) ctx.calc = c;
  } else if (pov) ctx.rosters = { mine: pov.picks.map((p) => p.id).filter(Boolean).slice(0, 12) };
  const rules = Object.fromEntries(Object.entries(P.docs.rules?.rules ?? {}).filter(([k, x]) => ['matchLength', 'disclosure', 'sixPerMatch', 'itemClause', 'platform'].includes(k) && x?.value && x.value !== 'unknown').map(([k, x]) => [k, x.value]));
  if (Object.keys(rules).length) ctx.rules = rules;
  return { ctx, notes: notesOf(P, m?.ws ?? null) };
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
    const h = await P.app.chat.history(convOf(P));
    if (h.status === 200) ui.msgs = (h.body.messages ?? []).map((x) => ({ ...x }));
    for (const x of ui.msgs) if (!FINAL.has(x.state)) watch(P, x.id);
  }
  P.app.rerender();
}
/** Poll one message every 2 s until it reaches a final state (or 260 s, after which the server's own time limits apply). */
function watch(P, id) {
  const ui = chatUi(P), started = Date.now();
  if ((ui.watching ??= new Set()).has(id)) return;
  ui.watching.add(id);
  const step = async () => {
    const r = await P.app.chat.message(convOf(P), id);
    const x = ui.msgs.find((y) => y.id === id);
    if (r.status === 200 && x) Object.assign(x, r.body);
    const done = !x || FINAL.has(x.state) || r.status === 404 || Date.now() - started > POLL_FOR_MS;
    P.app.rerender();
    if (done) { ui.watching.delete(id); if (x && FINAL.has(x.state)) P.app.announce?.(C.CHATUI.stateSay[x.state] ?? ''); return; }
    setTimeout(step, POLL_MS);
  };
  setTimeout(step, POLL_MS);
}

// ---------- the panel ----------
const time = (ms) => (ms ? new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');
function bubble(x) {
  const st = C.CHATUI.state[x.state] ?? '';
  const reply = x.reply?.kind === 'reply' && x.reply.text ? `<div class="chat-msg agent"><span class="vh">${esc(C.CHATUI.agentSaid)}</span><p class="chat-text">${esc(x.reply.text)}</p></div>` : '';
  const live = x.state === 'queued' || x.state === 'working';
  return `<li class="chat-turn"><div class="chat-msg you"><span class="vh">${esc(C.CHATUI.youSaid)}</span><p class="chat-text">${esc(x.text)}</p></div>${reply}
    ${st && x.state !== 'answered' ? `<p class="small chat-state st-${esc(x.state)}">${esc(st)}${live ? ` ${btn(C.CHATUI.cancel, 'chat-cancel', { msg: x.id }, { cls: 'linkish' })}` : ''}</p>` : ''}</li>`;
}
function composer(P, ui, online) {
  const { ctx, notes } = pageContext(P);
  const parts = Object.keys(ctx).filter((k) => k !== 'v');
  const chip = (k) => {
    const on = !ui.removed.includes(k), fixed = k === 'page';
    return fixed ? `<span class="pchip on fixed">${esc(C.CHATUI.chip[k](ctx[k]))}</span>`
      : `<button${attrs({ type: 'button', class: `pchip${on ? ' on' : ''}`, 'data-pa': 'chat-chip', 'data-key': k, 'aria-pressed': String(on), 'aria-label': `${C.CHATUI.chip[k](ctx[k])}: ${on ? C.CHATUI.chipOn : C.CHATUI.chipOff}` })}>${esc(C.CHATUI.chip[k](ctx[k]))}</button>`;
  };
  const pending = ui.msgs.some((x) => x.state === 'queued' || x.state === 'working');
  const can = online && !pending && !ui.sending;
  return `<div class="chat-compose">
    <p class="small"><b>${esc(C.CHATUI.sees)}</b> <span class="small muted">${esc(C.CHATUI.seesHelp)}</span></p>
    <div class="chat-chips" role="group" aria-label="${esc(C.CHATUI.sees)}">${parts.map(chip).join('')}${ui.notes && notes.trim() ? `<span class="pchip on">${esc(C.CHATUI.chip.notes())}</span>` : ''}</div>
    <label class="chat-notes"><input type="checkbox" data-pc="chat-notes"${ui.notes ? ' checked' : ''}${notes.trim() ? '' : ' disabled'}> ${esc(notes.trim() ? C.CHATUI.includeNotes : C.CHATUI.noNotes)}</label>
    <label class="field" for="chat-draft"><span class="vh">${esc(C.CHATUI.ask)}</span><textarea id="chat-draft" rows="3" maxlength="${CHAT_LIMITS.text}" data-pi="chat-draft" placeholder="${esc(C.CHATUI.placeholder)}"${online ? '' : ' disabled'}>${esc(ui.draft)}</textarea></label>
    <p>${btn(ui.sending ? C.CHATUI.sending : C.CHATUI.send, 'chat-send', {}, { primary: true, disabled: !can })} <span class="small muted">${esc(C.CHATUI.max(CHAT_LIMITS.text))}</span>${pending ? ` <span class="small muted">${esc(C.CHATUI.oneAtATime)}</span>` : ''}</p></div>`;
}
/** The panel's state line: what's true right now, in words. */
function stateLine(P, ui) {
  const st = ui.st;
  if (ui.checking && !st) return `<p class="small muted">${esc(C.CHATUI.checking)}</p>`;
  if (!st) return '';
  if (st.status === 0) return `<p class="banner warn">${esc(C.CHATUI.unreachable)} ${btn(C.CHATUI.retry, 'chat-refresh')}</p>`;
  if (st.status === 401) return `<p>${esc(C.CHATUI.signIn)}</p><p><a class="primary-link" href="${esc(P.app.chat.signInHref(P.app.location?.hash ?? '#prep'))}" target="_top">${esc(C.CHATUI.signInLink)}</a></p>`;
  if (st.status === 403) return `<p class="banner warn">${esc(C.CHATUI.notYours)}</p>`;
  if (st.status === 503 && st.body.error === 'chat-not-set-up') {
    const who = ui.whoami;
    const id = who?.status === 200 ? `<p class="small">${esc(C.CHATUI.yourId)} <code class="chat-id">${esc(who.body.id)}</code></p><p class="small muted">${esc(C.CHATUI.yourIdHelp)}</p>`
      : who?.status === 401 ? `<p class="small"><a href="${esc(P.app.chat.signInHref(P.app.location?.hash ?? '#prep'))}" target="_top">${esc(C.CHATUI.signInLink)}</a></p>` : '';
    return `<p class="banner info">${esc(C.CHATUI.notSetUp)}</p><details class="small"><summary>${esc(C.CHATUI.setup)}</summary><p>${esc(C.CHATUI.setupHelp)}</p>${btn(C.CHATUI.showId, 'chat-whoami', {}, { cls: 'linkish' })}${id}</details>`;
  }
  if (st.status !== 200) return `<p class="banner warn">${esc(C.CHATUI.storage)} ${btn(C.CHATUI.retry, 'chat-refresh')}</p>`;
  const r = st.body.relay ?? {};
  return r.online ? `<p class="small chat-online">● ${esc(C.CHATUI.online)}</p>` : `<p class="banner warn">${esc(C.CHATUI.offline(time(r.seenAt)))} ${btn(C.CHATUI.retry, 'chat-refresh')}</p>`;
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
  'chat-close': (t, P) => { chatUi(P).open = false; P.app.rerender(); },
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
      watch(P, r.body.id);
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
    const r = await P.app.chat.cancel(convOf(P), t.dataset.msg);
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

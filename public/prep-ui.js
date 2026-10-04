// Prep view helpers: escaping, small widgets and the calc result anatomy (who → whom, headline in natural frequencies,
// class badge, if-crit line, assumption chips, not-counted line, footer). Pure string renderers: test/prep-ui.test.mjs
// reads their HTML without a DOM. A refused or "no number yet" result never renders a digit or % in its result area.
import * as C from './prep-copy.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const attrs = (o) => Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== false).map(([k, v]) => (v === true ? ` ${k}` : ` ${k}="${esc(v)}"`)).join('');
/** A button wired to a prep action: data-pa="<action>" plus data-* arguments. */
export const btn = (label, action, data = {}, { cls = '', primary = false, disabled = false, aria = null, pressed = null } = {}) =>
  `<button type="button"${attrs({ class: [primary ? 'primary' : '', cls].filter(Boolean).join(' ') || undefined, 'data-pa': action, ...Object.fromEntries(Object.entries(data).map(([k, v]) => [`data-${k}`, v])), disabled, 'aria-label': aria, 'aria-pressed': pressed === null ? undefined : String(pressed) })}>${esc(label)}</button>`;
/** A toggle chip (aria-pressed). */
export const chipBtn = (label, action, data, on, extra = {}) => btn(label, action, data, { cls: `pchip${on ? ' on' : ''}${extra.cls ? ` ${extra.cls}` : ''}`, pressed: !!on, disabled: extra.disabled });
export const term = (label, key = label) => `<span class="term" tabindex="0" data-term="${esc(key)}">${esc(label)}</span>`;
export const h2 = (text, id = 'prep-h') => `<h2 id="${id}" tabindex="-1">${esc(text)}</h2>`;
/** A select with a visible label, or an accessible name (aria, else its placeholder option's text). */
export const select = (id, options, value, { label, data = {}, cls = '', aria = null } = {}) =>
  `${label ? `<label class="field"${attrs({ for: id })}><span>${esc(label)}</span>` : ''}<select${attrs({ id, class: cls || undefined, 'aria-label': label ? undefined : aria ?? String(options[0]?.[1] ?? '').replace(/…$/, ''), ...Object.fromEntries(Object.entries(data).map(([k, v]) => [`data-${k}`, v])) })}>${options.map(([v, l, dis]) => `<option value="${esc(v)}"${v === value ? ' selected' : ''}${dis ? ' disabled' : ''}>${esc(l)}</option>`).join('')}</select>${label ? '</label>' : ''}`;
export const sourceChip = (src) => (src ? `<span class="chip src src-${esc(src)}" title="${esc(C.SOURCE_HELP[src] ?? '')}">${esc(C.SOURCE[src] ?? src)}</span>` : '');

const pct = (n, d) => (d ? Math.floor((1000 * n) / d) / 10 : 0);
/** "6 of 16 rolls KO (about 1 in 3)" / exact fraction wording for mixtures. ko: {num, den} strings. */
export function koWords(ko, { hits = 1, uses = 1 } = {}) {
  if (!ko) return '';
  if (ko.refused !== undefined) return null;
  const n = BigInt(ko.num), d = BigInt(ko.den);
  const what = uses === 1 ? (hits > 1 ? 'the move KOs' : 'rolls KO') : `${uses} uses KO`;
  if (n === 0n) return uses === 1 ? (hits > 1 ? 'no hit combination KOs' : 'no roll KOs (0 of 16)') : `${uses} uses: no roll combination KOs`;
  if (n === d) return uses === 1 ? (hits > 1 ? 'every hit combination KOs if every hit lands' : 'every roll KOs if it hits (16 of 16)') : `${uses} uses: every roll combination KOs if they hit`;
  const ABOUT = { 4: '1 in 4', 5: 'about 1 in 3', 6: 'about 1 in 3', 8: 'half', 10: 'about 2 in 3', 11: 'about 2 in 3', 12: '3 in 4' };
  // "k of 16 rolls" only when the fraction is exactly that (one hit, one use); otherwise the exact fraction, never rounded
  if (uses === 1 && hits === 1 && 16n % d === 0n) { const k = Number((n * 16n) / d); return `${k} of 16 rolls KO${ABOUT[k] ? ` (${ABOUT[k]})` : ''}`; }
  const p = Number((n * 1000n) / d) / 10;
  const about = p < 1 ? 'under 1%' : p > 99 ? 'over 99%' : `about ${Math.round(p)}%`;
  return `${uses === 1 ? 'the move KOs' : `${uses} uses KO`} in ${n} of ${d} cases (${about})`;
}

/** Headline for one exact result: "48–56% of Pelipper's HP · no roll KOs (0 of 16)". */
export function headline(r, defName) {
  const lo = pct(r.range.min, r.maxHP), hi = pct(r.range.max, r.maxHP);
  const hits = Math.max(...r.move.dist.map((d) => d.n));
  const ko = koWords(r.ko.one, { hits });
  return `${lo}–${hi}% of ${defName}'s HP${ko ? ` · ${ko}` : ''}`;
}

/**
 * The full trust anatomy for one result. names: {attacker, defender, attackerSet, defenderSet}. opts: {fixActions:true,
 * envelope: [{key, result}], showRolls}. Returns HTML; refused/needs-state areas carry class "noresult" and no digits.
 */
export function resultBlock(r, names, opts = {}) {
  if (!r) return '';
  const who = `<p class="who">${esc(names.attacker)}${names.attackerSet ? ` <span class="muted">(${esc(names.attackerSet)})</span>` : ''} → ${esc(names.defender)}${names.defenderSet ? ` <span class="muted">(${esc(names.defenderSet)})</span>` : ''}</p>`;
  if (r.class === 'refused') {
    // No digits from the template; the Pokémon name goes in afterwards so a name like "Porygon2" stays whole.
    const NAME = '\u0000';
    const text = noDigits((C.REFUSE[r.code] ?? (() => C.REFUSE['engine-error']()))({ name: NAME, reason: r.reason })).split(NAME).join(names[r.side] ?? names.attacker);
    const fix = r.fix?.kind === 'first-hit-only' && opts.fixActions !== false ? btn(C.FIX['first-hit-only'], 'calc-first-hit') : '';
    return `${who}<div class="result noresult" data-class="refused"><span class="badge refused">${esc(C.CLASS.refused)}</span> <span class="reason-text">${esc(text)}</span> ${fix}</div>`;
  }
  if (r.class === 'needs-state') {
    const q = r.question;
    const text = (C.QUESTION[q.key] ?? (() => q.key))(r);
    const opt = q.options.map((o) => btn(q.key === 'form' ? C.FORM_OPTION[o] : String(o), 'calc-state', { key: q.key, side: q.side, value: o }, { cls: 'pchip' })).join('');
    return `${who}<div class="result noresult" data-class="needs-state"><span class="badge needs">${esc(C.CLASS['needs-state'])}</span> <span class="reason-text">${esc(noDigits(text))}</span></div><div class="choices" role="group" aria-label="${esc(noDigits(text))}">${opt}</div>`;
  }
  if (r.class === 'no-damage' || r.class === 'status') {
    return `${who}<div class="result" data-class="no-damage"><span class="badge">${esc(C.CLASS['no-damage'])}</span> ${esc(C.NO_DAMAGE[r.code] ?? '')}</div>`;
  }
  const knife = r.flags?.includes('knife-edge');
  const hits = Math.max(...r.move.dist.map((d) => d.n));
  const env = opts.envelope;
  let head;
  if (env?.length) {
    const ex = env.filter((e) => e.result.class === 'exact');
    const lo = Math.min(...ex.map((e) => pct(e.result.range.min, e.result.maxHP))), hi = Math.max(...ex.map((e) => pct(e.result.range.max, e.result.maxHP)));
    head = `<p class="headline">${ex.length ? `${lo}–${hi}% of ${esc(names.defender)}'s HP, ${esc(C.ENVELOPE_HEAD)}` : esc(C.CLASS.refused)}</p>
      <table class="envelope"><tbody>${env.map((e) => `<tr><th scope="row">${esc(C.ENVELOPE_ROW[e.key] ?? e.key)}${e.label ? ` <span class="muted small">(${esc(e.label)})</span>` : ''}</th>${e.result.class === 'exact'
        ? `<td>${pct(e.result.range.min, e.result.maxHP)}–${pct(e.result.range.max, e.result.maxHP)}% <span class="muted small">(${e.result.range.min}–${e.result.range.max} of ${e.result.maxHP} HP)</span></td><td>${esc(koWords(e.result.ko.one, { hits }) ?? '')}</td>`
        : `<td colspan="2" class="noresult">${esc(C.CLASS[e.result.class] ?? '')}</td>`}</tr>`).join('')}</tbody></table>
      <p class="small muted">${esc(C.NOT_A_DISTRIBUTION(env.length))}</p>`;
  } else {
    // when Focus Sash or Sturdy is what stops the KO, the headline says so (not a chip four lines down)
    const saver = hangsOn(r) && r.hitRows.length === 1 && r.hitRows[0].some((d) => d >= r.curHP) ? ` (${r.chips.some((c) => c.code === 'sash-counted') ? 'Focus Sash' : 'Sturdy'} leaves it at 1 HP)` : '';
    head = `<p class="headline">${esc(headline(r, names.defender) + saver)}</p><p class="small">${r.range.min}–${r.range.max} of ${r.curHP === r.maxHP ? r.maxHP : `${r.curHP} (max ${r.maxHP})`} HP</p>`;
  }
  // With an envelope, the lines below the table describe the max-investment row: say so.
  const maxLabel = env?.length ? 'Max investment: ' : '';
  const two = r.ko.two?.refused !== undefined ? (C.REPEAT_REFUSED[r.ko.two.refused] ? `<p class="small">${maxLabel}Two uses: <span class="noresult">${esc(C.CLASS.refused)}</span> ${esc(C.REPEAT_REFUSED[r.ko.two.refused])}</p>` : '')
    : r.ko.one.num !== r.ko.one.den ? `<p class="small">${maxLabel}${esc(koWords(r.ko.two, { uses: 2 }))} (turns apart${r.chips.some((c) => c.code === 'leftovers-between-turns') ? ', Leftovers counted' : ''})</p>` : '';
  const critKo = r.crit?.ko1 ? koWords(r.crit.ko1, { hits }) : null;
  const crit = r.crit?.already ? '' : r.crit?.immune ? '<p class="small">If crit: this target can\'t be hit critically.</p>'
    : r.crit?.range ? `<p class="small">${maxLabel}${hits > 1 ? 'If every hit crits' : 'If crit'}: ${pct(r.crit.range.min, r.maxHP)}–${pct(r.crit.range.max, r.maxHP)}%${critKo ? ` · ${esc(critKo)}` : ''}</p>` : '';
  const targetBand = r.hpLow && r.hpLow.curHP !== r.curHP, attackerBand = r.hpLow && r.hpLow.attackerHP !== r.attacker?.curHP;
  const bandWho = targetBand && attackerBand ? `the attacker at ${r.hpLow.attackerHP} HP, the target at ${r.hpLow.curHP} HP`
    : attackerBand ? `the attacker at ${r.hpLow.attackerHP} HP` : `the target at ${r.hpLow?.curHP} HP`;
  const band = r.hpLow ? `<p class="small">${maxLabel}At the bottom of the HP shown (${bandWho}): ${esc(koWords(r.hpLow.ko.one, { hits }) ?? '')}.</p>` : '';
  const badge = knife ? `<span class="badge knife">${esc(C.CLASS['knife-edge'])}</span> <span class="small">${esc(C.KNIFE)}</span>` : '';
  const chipNames = { attacker: names.attacker, defender: names.defender };
  const chips = r.chips.map((c) => `<span class="chip asm">${esc(C.chipText(c, chipNames))}</span>`).join('');
  const nc = r.notCounted.map((n) => (typeof C.NOT_COUNTED[n.code] === 'function' ? C.NOT_COUNTED[n.code](n) : C.NOT_COUNTED[n.code])).filter(Boolean);
  const notes = r.notes.map((n) => C.NOTE[n.code]).filter(Boolean);
  return `${who}<div class="result" data-class="${knife ? 'knife-edge' : 'exact'}">${badge}${head}${band}${two}${crit}
    <p class="scope small">${esc(C.SCOPE)}</p>
    <div class="chips" aria-label="Assumptions">${chips}</div>
    <p class="small">Not counted: ${esc(nc.join(', '))}.</p>${notes.length ? `<p class="small">${esc(notes.join(' '))}</p>` : ''}
    <p class="footer small muted">${esc(C.FOOTER)}</p></div>`;
}

/** Strip digits from refusal text (names never carry numbers there; this guards the contract). */
export const noDigits = (s) => String(s).replace(/[0-9]+%?/g, '').replace(/\s{2,}/g, ' ');

/** Focus Sash or Sturdy at full HP keeps it at 1 HP from a single hit that would KO. */
const hangsOn = (r) => r.curHP === r.maxHP && r.chips.some((c) => c.code === 'sash-counted' || c.code === 'sturdy-counted');
/** "Every roll" detail: 16 values per hit and the HP they leave (as the KO model counts it). */
export function rollsDetail(r, { maxRow = false } = {}) {
  if (r?.class !== 'exact') return '';
  const left = (d) => (hangsOn(r) && r.hitRows.length === 1 ? Math.max(1, r.curHP - d) : Math.max(0, r.curHP - d));
  return `<details class="small"><summary>${maxRow ? 'Max investment: every roll (16)' : 'Every roll (16)'}</summary>${r.hitRows.map((h, i) => `<p>${r.hitRows.length > 1 ? `Hit ${i + 1}: ` : ''}${h.join(', ')}</p>`).join('')}
    <p>HP left after one hit: ${[...new Set(r.hitRows[0].map(left))].join(', ')}${hangsOn(r) && r.hitRows.length === 1 && r.hitRows[0].some((d) => d >= r.curHP) ? ` (${r.chips.some((c) => c.code === 'sash-counted') ? 'Focus Sash' : 'Sturdy'} leaves it at 1 HP)` : ''}</p></details>`;
}

/** "How this was calculated": versions, rules applied, ability evidence tiers. */
export function howCalculated(r, { checkedAt = null, dataHash = '', nameOf = (id) => id } = {}) {
  if (r?.class !== 'exact') return '';
  const applied = (r.applied ?? []).map((a) => C.APPLIED[a.code]).filter(Boolean);
  const tiers = (r.tiers ?? []).map((t) => `${nameOf(t.id)}: ${C.TIER[t.tier]}`);
  return `<details class="small"><summary>How this was calculated</summary><p>${esc(C.FOOTER)} · wrapper ${esc(r.version)}${dataHash ? ` · data ${esc(dataHash.slice(0, 12))}` : ''}${checkedAt ? ` · checked ${esc(checkedAt)}` : ''}.</p>
    ${applied.length ? `<p>Applied: ${esc(applied.join('; '))}.</p>` : ''}${tiers.length ? `<p>Abilities: ${esc(tiers.join('; '))}.</p>` : ''}
    <p>Damage rolls come from @smogon/calc 0.12.0 with the app's own corrections, checked against the pinned Pokémon Showdown simulator. Cartridge behaviour may differ.</p></details>`;
}

/** Speed ladder rows (pure). rows: [{label, side:'mine'|'theirs', min, max, exact, src}] sorted by caller. */
export function ladder(rows, { trickRoom = false } = {}) {
  const top = Math.max(1, ...rows.map((r) => r.max));
  return `<p class="small">${trickRoom ? 'Trick Room is on: lower moves first.' : 'Higher moves first.'}</p><ol class="pladder">${rows.map((r) => {
    const val = r.exact ? `${r.max}` : `${r.min}–${r.max}`;
    const w = Math.max(4, Math.round((100 * r.max) / top)), l = r.exact ? 0 : Math.round((100 * r.min) / top);
    return `<li class="${esc(r.side)}${r.exact ? '' : ' range'}"><span class="nm2">${esc(r.label)}</span><b>${val}</b><span class="track"><span class="bar" style="margin-left:${r.exact ? 0 : l}%;width:${Math.max(4, w - (r.exact ? 0 : l))}%"></span></span><span class="small muted">${esc(r.note ?? (r.side === 'mine' ? 'yours' : r.exact ? 'set' : 'range'))}</span></li>`;
  }).join('')}</ol>`;
}

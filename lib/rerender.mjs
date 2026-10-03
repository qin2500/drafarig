// Keeping the user's place across a full re-render of #main: keyboard focus (UX cores §10; rendered-QA S1, S2) and the
// scroll position (QA S4). Pure: the helpers read only id, tagName, parentElement, children, getAttribute and
// hasAttribute (plus querySelectorAll('*') when the element has it), so tests can drive them with a small element tree
// built from the panels' HTML. public/app.js does the DOM work: focusing and scrolling.

/** Attributes that identify a control that has no id, checked in this order. */
export const FOCUS_ATTRS = ['data-mon', 'data-term', 'data-cores-more', 'data-cores-all', 'data-goto', 'data-check', 'data-dtab',
  'data-accept', 'data-unalias', 'data-alias', 'data-copy', 'data-form'];

const kids = (el) => Array.from(el?.children ?? []);
function* walk(el) { for (const c of kids(el)) { yield c; yield* walk(c); } }
/** Every element under el, in document order. */
const descendants = (el) => (typeof el.querySelectorAll === 'function' ? Array.from(el.querySelectorAll('*')) : [...walk(el)]);
const inside = (el, root) => { for (let x = el; x; x = x.parentElement) if (x === root) return true; return false; };
function keyedBlock(el, root) { for (let x = el; x && x !== root; x = x.parentElement) if (x.hasAttribute?.('data-key')) return x; return null; }
const sameControl = (k) => (x) => x.tagName === k.tag && x.getAttribute(k.attr) === k.value;

/**
 * Describes the focused element so that the same control can be found again after root's content is replaced.
 * - It has an id: {id} (S1: selects such as #coreScope and #threatScope, the #carries heading, inputs).
 * - It has one of FOCUS_ATTRS: {key, tag, attr, value, nth}. key is the data-key of the nearest [data-key] block (null:
 *   none, so root is the block), and nth is its position among the same controls in that block (S2: a mon button inside
 *   an open card).
 * - Otherwise, inside a [data-key] block: {key, summary: true}, the block's own <summary>.
 * Returns null when focus isn't inside root or nothing identifies it.
 */
export function focusKey(el, root) {
  if (!el || !root || el === root || !inside(el, root)) return null;
  if (el.id) return { id: el.id };
  const block = keyedBlock(el, root);
  const key = block ? block.getAttribute('data-key') : null;
  const attr = FOCUS_ATTRS.find((a) => el.hasAttribute?.(a));
  if (attr) {
    const k = { key, tag: el.tagName, attr, value: el.getAttribute(attr) };
    return { ...k, nth: Math.max(0, descendants(block ?? root).filter(sameControl(k)).indexOf(el)) };
  }
  return block ? { key, summary: true } : null;
}

/**
 * Where focus goes back to after the re-render, best first: the same control (by id; or by attribute within the same
 * block, the nth match or the last one if there are fewer now), then the block's own <summary>. The app focuses the
 * first candidate that actually takes focus (an element inside a closed <details> doesn't). [] when nothing matches.
 */
export function focusCandidates(root, k) {
  if (!root || !k) return [];
  const all = descendants(root);
  if (k.id) return all.filter((x) => x.id === k.id).slice(0, 1);
  const block = k.key === null || k.key === undefined ? root : all.find((x) => x.getAttribute?.('data-key') === k.key);
  if (!block) return [];
  const out = [];
  if (k.attr) {
    const same = (block === root ? all : descendants(block)).filter(sameControl(k));
    if (same.length) out.push(same[Math.min(k.nth ?? 0, same.length - 1)]);
  }
  const summary = block !== root && kids(block).find((x) => x.tagName === 'SUMMARY');
  if (summary) out.push(summary);
  return out;
}

/** The scroll offset after a re-render: kept within one screen; a screen change starts at the top (QA S4). */
export const scrollAfterRender = (shownMode, mode, scrollY) => (shownMode === mode ? scrollY : 0);

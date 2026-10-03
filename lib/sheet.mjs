// League sheet: URLs, fetch, and parsers for both tabs + the styled board HTML (red text = taken).
// Pure ESM, no Node-only imports, so the browser and tests can use it too.

export const PUB = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRaWvbCLkcoMseTxroAvH65jxTaOOBGKStYCm5Waj-cXzd0jGs17T7OACJekcnr9w';
export const GID = { board: '1975886537', drafts: '638600642' };
export const csvUrl = (gid, base = PUB) => `${base}/pub?gid=${gid}&single=true&output=csv`;
// The /pubhtml?gid=..&single=true page is an empty JS shell; the actual table lives here:
export const htmlUrl = (gid, base = PUB) => `${base}/pubhtml/sheet?headers=false&gid=${gid}`;

export async function fetchText(url) {
  // cache: 'no-store' matters in the browser; harmless in Node.
  const r = await fetch(url, { cache: 'no-store', redirect: 'follow', signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return r.text();
}

// RFC4180-ish CSV parser (quotes, escaped quotes, CRLF).
export function parseCsv(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(f); rows.push(row); row = []; f = '';
    } else f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows;
}

// ---------- Draft Board (CSV) ----------
// Row with "20 Points" headers -> each tier occupies a (Chinese, English) column pair.
export function parseBoardCsv(text) {
  const rows = parseCsv(text);
  const hdrIdx = rows.findIndex((r) => r.some((c) => /^\s*\d+\s*Points?\s*$/i.test(c)));
  if (hdrIdx < 0) throw new Error('board: no tier header row');
  const tiers = []; // {col, points}
  rows[hdrIdx].forEach((c, col) => {
    const m = c.match(/^\s*(\d+)\s*Points?\s*$/i);
    if (m) tiers.push({ col, points: +m[1] });
  });
  const out = [];
  for (let r = hdrIdx + 1; r < rows.length; r++) {
    for (const { col, points } of tiers) {
      const zh = (rows[r][col] || '').trim(), en = (rows[r][col + 1] || '').trim();
      if (!en || en === 'English name') continue;
      out.push({ points, zh, en, row: r, col: col + 1 });
    }
  }
  return out;
}

// ---------- Drafts (CSV) ----------
// Row 0: "1.Hex(法拉)",,,"2.Ning",,, ... ; row1: Chinese Name,English Name,Points x10; then picks;
// a row containing "Points Left" carries remaining budget in the next column.
export function parseDraftsCsv(text) {
  const rows = parseCsv(text);
  const coaches = [];
  rows[0].forEach((c, col) => {
    const m = c.trim().match(/^(\d+)\s*\.\s*(.+)$/);
    if (m) coaches.push({ order: +m[1], name: m[2].trim(), col, picks: [], pointsLeft: null });
  });
  for (let r = 2; r < rows.length; r++) {
    for (const co of coaches) {
      const zh = (rows[r][co.col] || '').trim(), en = (rows[r][co.col + 1] || '').trim(), pts = (rows[r][co.col + 2] || '').trim();
      if (/points\s*left/i.test(en)) { co.pointsLeft = pts === '' ? null : +pts; continue; }
      if (!en && !zh) continue;
      co.picks.push({ round: co.picks.length + 1, zh, en, points: pts === '' ? null : +pts });
    }
  }
  return coaches;
}

// ---------- Draft Board (published HTML) -> which cells are styled red ----------
// Classes (s0, s5, ...) are regenerated on each render, so resolve them via the inline CSS.
function hexToRgb(h) {
  h = h.replace('#', ''); if (h.length === 3) h = [...h].map((x) => x + x).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
export function isReddish(hex) {
  if (!hex) return false; const [r, g, b] = hexToRgb(hex);
  return r >= 180 && g <= 120 && b <= 120; // #ff0000, #e06666, #cc0000, #ea4335 ...
}
export function parseStyledGrid(html) {
  const cls = {};
  for (const [, name, body] of html.matchAll(/\.ritz \.waffle \.(s\d+)\{([^}]*)\}/g)) {
    const bg = body.match(/background-color:\s*(#[0-9a-f]{3,6})/i)?.[1];
    const color = body.match(/(?:^|;)color:\s*(#[0-9a-f]{3,6})/i)?.[1];
    cls[name] = { bg, color };
  }
  const grid = []; // grid[r][c] = {text, cls, bg, color}
  const tbody = html.slice(html.indexOf('<tbody'), html.indexOf('</tbody>'));
  for (const [, tr] of tbody.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const row = []; let c = 0;
    for (const [, attrs, inner] of tr.matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/g)) {
      const k = attrs.match(/class="([^"]*)"/)?.[1].split(/\s+/).find((x) => /^s\d+$/.test(x));
      const span = +(attrs.match(/colspan="(\d+)"/)?.[1] || 1);
      const inlineBg = attrs.match(/background-color:\s*(#[0-9a-f]{3,6})/i)?.[1];
      const text = decode(inner.replace(/<[^>]+>/g, '')).trim();
      row[c] = { text, cls: k, bg: inlineBg || cls[k]?.bg, color: cls[k]?.color };
      c += span;
    }
    grid.push(row);
  }
  return grid;
}
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');

// Returns English board names whose cell (or its Chinese partner) is red bg or red text.
export function redNamesFromBoardHtml(html) {
  const grid = parseStyledGrid(html);
  const hdr = grid.findIndex((r) => r.some((c) => c && /^\d+\s*Points?$/i.test(c.text)));
  const tierCols = [];
  grid[hdr].forEach((c, i) => { const m = c?.text.match(/^(\d+)\s*Points?$/i); if (m) tierCols.push({ i, points: +m[1] }); });
  const out = [];
  for (let r = hdr + 1; r < grid.length; r++) for (const { i, points } of tierCols) {
    const zh = grid[r][i], en = grid[r][i + 1];
    if (!en?.text || en.text === 'English name') continue;
    const red = [zh, en].some((x) => x && (isReddish(x.bg) || isReddish(x.color)));
    const how = [zh, en].some((x) => x && isReddish(x.bg)) ? 'background' : red ? 'text' : null;
    out.push({ points, en: en.text, zh: zh?.text, red, how });
  }
  return out;
}


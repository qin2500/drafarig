// Sim viewer: browse the simulation runs and watch any game in Pokémon Showdown's own replay player.
//   node tools/sim/viewer.mjs [--port 4700]   →  http://127.0.0.1:4700
// Runs = tools/sim/results/**/*.jsonl. A game is re-played from its seed with the run's saved arguments (<run>.args.json,
// written by run.mjs; games are deterministic per seed) and the battle log is cached in tools/sim/results/.replays/.
// The replay page is Showdown's downloadable-replay format: the log embedded in the page and played by Showdown's
// replay-embed.js from play.pokemonshowdown.com. Local only (127.0.0.1); never part of the app.
import { createServer } from 'node:http';
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { replayGame, parseArgs } from './run.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const RESULTS = join(HERE, 'results');
const CACHE = join(RESULTS, '.replays');
const port = Number(parseArgs(process.argv.slice(2)).port ?? 4700);
const CAND = JSON.parse(readFileSync(join(HERE, 'candidates/zhuzi.json'), 'utf8'));
const LEAGUE = existsSync(join(HERE, 'candidates/league/index.json')) ? JSON.parse(readFileSync(join(HERE, 'candidates/league/index.json'), 'utf8')).teams : [];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const short = (ref) => String(ref ?? '').split('/').pop().replace(/\.txt$/, '');
function label(ref) {
  const id = short(ref);
  const z = CAND.opponent.teams.find((t) => t.id === id) ?? CAND.ours.teams.find((t) => t.id === id);
  if (z) return `${id} · ${z.label ?? ''}`;
  const l = LEAGUE.find((t) => t.id === id);
  return l ? `${id} · ${l.coach}` : id;
}

function runs() {
  const out = [];
  const walk = (d) => { for (const f of readdirSync(d)) { if (f.startsWith('.')) continue; const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (f.endsWith('.jsonl')) out.push(p); } };
  walk(RESULTS);
  return out.map((p) => ({ path: relative(RESULTS, p), replayable: existsSync(`${p}.args.json`), mtime: statSync(p).mtimeMs })).sort((a, b) => b.mtime - a.mtime);
}
const games = (rel) => readFileSync(join(RESULTS, rel), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)).sort((a, b) => a.i - b.i);
const safe = (rel) => { const p = join(RESULTS, rel); if (!p.startsWith(RESULTS) || !p.endsWith('.jsonl') || !existsSync(p)) throw new Error('no such run'); return rel; };

const page = (title, body) => `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>:root{--bg:#fff;--fg:#1d1d1f;--mut:#6e6e73;--line:#e5e5ea;--acc:#0a66c2;--win:#1a7f37;--loss:#b42318}
@media (prefers-color-scheme:dark){:root{--bg:#161618;--fg:#f2f2f7;--mut:#a1a1a6;--line:#2c2c2e;--acc:#5aa9ff;--win:#4ac26b;--loss:#ff6b5e}}
body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.45 system-ui,-apple-system,sans-serif}main{max-width:1100px;margin:0 auto;padding:16px}
a{color:var(--acc);text-decoration:none}a:hover{text-decoration:underline}h1{font-size:20px;margin:8px 0 4px}p.mut,.mut{color:var(--mut)}
table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);white-space:nowrap}
th{font-weight:600;color:var(--mut);position:sticky;top:0;background:var(--bg)}.win{color:var(--win);font-weight:600}.loss{color:var(--loss);font-weight:600}
.bar{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}input,select{font:inherit;padding:6px 8px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--fg)}
.wrap{overflow-x:auto}</style><main>${body}</main></html>`;

function home() {
  const rows = runs().map((r) => {
    let n = 0, w = 0;
    try { for (const g of games(r.path)) { n++; if (g.winner === 'ours') w++; } } catch {}
    return `<tr><td>${r.replayable ? `<a href="/run?f=${encodeURIComponent(r.path)}">${esc(r.path)}</a>` : esc(r.path)}</td><td>${n}</td><td>${n ? (100 * w / n).toFixed(1) + '%' : ''}</td><td class="mut">${r.replayable ? 'watchable' : 'no saved settings'}</td><td class="mut">${new Date(r.mtime).toLocaleString()}</td></tr>`;
  }).join('');
  return page('Sim viewer', `<h1>Simulation runs</h1><p class="mut">Newest first. "Watchable" runs saved their settings, so any game can be replayed from its seed.</p>
<div class="wrap"><table><thead><tr><th>Run</th><th>Games</th><th>Our win %</th><th></th><th>Updated</th></tr></thead><tbody>${rows}</tbody></table></div>`);
}

function run(rel) {
  const gs = games(rel);
  const opps = [...new Set(gs.map((g) => short(g.theirs)))].sort();
  const rows = gs.map((g) => `<tr data-opp="${esc(short(g.theirs))}" data-w="${g.winner}"><td>${g.i}</td><td>${esc(label(g.theirs))}</td><td class="${g.winner === 'ours' ? 'win' : g.winner === 'theirs' ? 'loss' : ''}">${g.winner === 'ours' ? 'Win' : g.winner === 'theirs' ? 'Loss' : 'Tie'}</td><td>${g.turns}</td>
<td>${esc((g.our?.leads ?? []).join(' + '))}</td><td>${esc((g.their?.leads ?? []).join(' + '))}</td><td>${esc((g.our?.brought ?? []).filter((x) => !(g.our?.leads ?? []).includes(x)).join(', '))}</td><td>${esc(g.persona ?? '')}</td><td><a href="/watch?f=${encodeURIComponent(rel)}&i=${g.i}" target="_blank">Watch</a></td></tr>`).join('');
  return page(`Run ${rel}`, `<p><a href="/">← All runs</a></p><h1>${esc(rel)}</h1><p class="mut">Our side: ${esc(label(gs[0]?.ours))} · ${gs.length} games · ${(100 * gs.filter((g) => g.winner === 'ours').length / Math.max(1, gs.length)).toFixed(1)}% won. A replay takes a few seconds to a minute to rebuild the first time (the engine replays the game), then it's instant.</p>
<div class="bar"><label>Opponent <select id="opp"><option value="">all</option>${opps.map((o) => `<option>${esc(o)}</option>`).join('')}</select></label>
<label>Result <select id="res"><option value="">all</option><option value="ours">wins</option><option value="theirs">losses</option></select></label><span id="count" class="mut"></span></div>
<div class="wrap"><table><thead><tr><th>#</th><th>Opponent team</th><th>Result</th><th>Turns</th><th>Our leads</th><th>Their leads</th><th>Our back</th><th>His habit</th><th></th></tr></thead><tbody id="rows">${rows}</tbody></table></div>
<script>const f=()=>{const o=document.getElementById('opp').value,r=document.getElementById('res').value;let n=0;for(const tr of document.querySelectorAll('#rows tr')){const show=(!o||tr.dataset.opp===o)&&(!r||tr.dataset.w===r);tr.style.display=show?'':'none';if(show)n++;}document.getElementById('count').textContent=n+' shown';};
document.getElementById('opp').onchange=f;document.getElementById('res').onchange=f;f();</script>`);
}

// Showdown's replay player wants the spectator log: drop the open-team-sheet prompt lines, name the sides
function spectator(log, oursName, theirsName, oursAs) {
  const names = oursAs === 'p2' ? { p1: theirsName, p2: oursName } : { p1: oursName, p2: theirsName };
  return log.split('\n').filter((l) => !/^\|uhtml(change)?\|otsrequest/.test(l))
    .map((l) => l.replace(/^\|player\|(p[12])\|(Ours|Theirs)\|/, (m, s) => `|player|${s}|${names[s]}|`).replace(/^\|win\|(Ours|Theirs)$/, (m, w) => `|win|${w === 'Ours' ? oursName : theirsName}`)).join('\n');
}
async function watch(rel, i) {
  const g = games(rel).find((x) => x.i === i);
  if (!g) throw new Error('no such game');
  mkdirSync(CACHE, { recursive: true });
  const key = join(CACHE, `${rel.replace(/[^a-z0-9]+/gi, '_')}_${i}.log`);
  let log;
  if (existsSync(key)) log = readFileSync(key, 'utf8');
  else {
    const args = JSON.parse(readFileSync(join(RESULTS, `${rel}.args.json`), 'utf8'));
    const r = await replayGame(args, i);
    log = r.log;
    if (r.winner !== g.winner || r.turns !== g.turns) log += `\n|raw|<div class="broadcast-red">Note: this replay ended ${r.winner} in ${r.turns} turns; the recorded game was ${g.winner} in ${g.turns}. The sim code changed since this run, so the replay is close but not identical.</div>`;
    writeFileSync(key, log);
  }
  const ours = `Ours (${short(g.ours)})`, theirs = `Theirs (${short(g.theirs)})`;
  const data = spectator(log, ours, theirs, g.oursAs).replace(/<\/script/gi, '<\\/script');
  return `<!doctype html><meta charset="utf-8"><title>${esc(`${short(g.ours)} vs ${short(g.theirs)} · game ${i}`)}</title>
<style>body{margin:0;background:#eee}.top{font:14px system-ui,sans-serif;padding:8px 12px}</style>
<div class="top"><a href="/run?f=${encodeURIComponent(rel)}">← ${esc(rel)}</a> · game ${i} · ${esc(label(g.theirs))} · ${g.winner === 'ours' ? 'we won' : g.winner === 'theirs' ? 'we lost' : 'tie'} in ${g.turns} turns${g.persona ? ` · his habit: ${esc(g.persona)}` : ''}</div>
<div class="wrapper replay-wrapper" style="max-width:1180px;margin:0 auto">
<input type="hidden" name="replayid" value="drafarig-sim-${i}">
<div class="battle"></div><div class="battle-log"></div><div class="replay-controls"></div><div class="replay-controls-2"></div>
<script type="text/plain" class="battle-log-data">${data}</script>
</div>
<script>let daily=Math.floor(Date.now()/1000/60/60/24);document.write('<script src="https://play.pokemonshowdown.com/js/replay-embed.js?version'+daily+'"></'+'script>');</script>`;
}

createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  try {
    let html;
    if (u.pathname === '/') html = home();
    else if (u.pathname === '/run') html = run(safe(u.searchParams.get('f')));
    else if (u.pathname === '/watch') html = await watch(safe(u.searchParams.get('f')), Number(u.searchParams.get('i')));
    else { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(html);
  } catch (e) { res.writeHead(500, { 'content-type': 'text/plain' }).end(String(e.message ?? e)); }
}).listen(port, '127.0.0.1', () => console.log(`Sim viewer: http://127.0.0.1:${port}`));

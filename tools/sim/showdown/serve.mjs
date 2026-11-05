// Play the engine in the real Pokémon Showdown: the vendored PS server runs locally, battles run in this process, and a
// bot user ("Engine") plays your next opponent's modelled sixes with the strongest engine we have. You get Showdown's
// own client: battle UI, teambuilder (edit your teams or make new ones), replays of the log.
//
//   node tools/sim/showdown/serve.mjs            then open http://localhost:8000 and PM "Engine": play
//
// Options: --port 8000, --cands tools/sim/candidates/hexpov.json, --theirs <comma ids> (the sixes the engine may play),
//          --name Engine.
// Rules: Reg M-C, closed team sheets (Open Team Sheets removed), best of 3. The engine starts each series from a guess of
// your sets (your earlier weeks' sets, else ladder usage) and learns what each game shows, as a person would.
// Every game is saved to tools/sim/results/play/<you>-<time>/game-N.json: the full battle log, both sides' inputs,
// your real six, the engine's belief of it, and the engine's per-decision notes.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { PS, FORMAT, packTeam, toID } from '../ai/data.mjs';
import { EnginePlayer } from '../engine/player.mjs';
import { beliefText, usageLibrary, library } from '../sheets.mjs';
import { clearDamageCache } from '../ai/engine.mjs';

const require = createRequire(import.meta.url);
const ROOT = new URL('../../../', import.meta.url).pathname;
const VENDOR = `${ROOT}tools/sim/vendor/pokemon-showdown/`;
const args = process.argv.slice(2);
const arg = (k, d) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1] : d);
const PORT = Number(arg('port', 8000));
const BOT = arg('name', 'Engine');
const CHALLENGE_FORMAT = `${FORMAT}@@@!Open Team Sheets, Best Of = 3`;

// ---------- the teams ----------
const CAND = JSON.parse(readFileSync(`${ROOT}${arg('cands', 'tools/sim/candidates/hexpov.json')}`, 'utf8'));
const team = (id) => [...CAND.ours.teams, ...CAND.opponent.teams].find((t) => t.id === id);
const THEIR_IDS = arg('theirs', 'h01,h02,h03,h04,h05,h06,h07,h08,h09,h10,h11,h12,h13,h14,h15,h16,h17,h18,h19,h20,p022,p026,p047,p091,p095,p043,p134,p097').split(',');
const THEIRS = THEIR_IDS.map((id) => ({ id, label: team(id).label, text: team(id).team, weight: team(id).weight ?? 0 }));
const POOL = THEIRS.filter((t) => t.weight > 0); // "random": a weighted draw from his likely sixes, hidden until the series ends
const draw = () => { let r = Math.random() * POOL.reduce((s, t) => s + t.weight, 0); for (const t of POOL) { r -= t.weight; if (r <= 0) return t; } return POOL.at(-1); };
// your teams, ready for the teambuilder's "Import from text" (or Backup/Restore, which takes them all at once)
const MY_TEAMS = `${ROOT}tools/sim/showdown/my-teams.txt`;
writeFileSync(MY_TEAMS, (arg('ours', 's119,k086,s206').split(',')).map((id) => `=== [${FORMAT}] ${id} ${team(id).label.replace(/[/|]/g, '-')} ===\n\n${team(id).team.trim()}\n`).join('\n'));

// the engine's prior on your sets: what you showed in earlier weeks (beliefRef), else ladder usage
const PRIOR = new Map([...usageLibrary(), ...library([{ text: team(CAND.ours.beliefRef ?? 'o01')?.team ?? '' }])]);

/** What a game showed of the human's six (moves used, items, abilities, Mega), merged into the series so far. */
function revealed(log, humanSets, side, prev) {
  const byName = Object.fromEntries(humanSets.flatMap((s) => [[s.species, s], [PS.Dex.species.get(s.species).baseSpecies, s], ...(s.name ? [[s.name, s]] : [])]));
  const out = structuredClone(prev ?? {});
  const mon = (ref) => { const n = String(ref ?? '').split(': ').slice(1).join(': '); const s = byName[n]; return s ? (out[s.species] ??= { moves: [], item: null, ability: null }) : null; };
  for (const l of log) {
    const p = l.split('|');
    if (!p[2]?.startsWith(side)) {
      const of = p.find((x) => x.startsWith(`[of] ${side}`));
      const ab = p.find((x) => x.startsWith('[from] ability: '));
      if (of && ab) { const m = mon(of.slice(5)); if (m) m.ability = ab.slice(16); }
      continue;
    }
    const m = mon(p[2]); if (!m) continue;
    if (p[1] === 'move' && !p.includes('[from]lockedmove') && !m.moves.includes(p[3])) m.moves.push(p[3]);
    if (p[1] === '-mega') m.item = p[4] || m.item;
    if (p[1] === '-item' || p[1] === '-enditem') m.item = p[3];
    if (p[1] === '-ability') m.ability = p[3];
    for (const x of p) { if (x.startsWith('[from] item: ')) m.item = x.slice(13); if (x.startsWith('[from] ability: ')) m.ability = x.slice(16); }
  }
  return out;
}
/** Closed sheets: species from preview, sets from the prior, overwritten by whatever the series has shown. */
function belief(humanText, shown) {
  const sets = PS.Teams.import(beliefText(humanText, 'closed', PRIOR));
  for (const s of sets) {
    const r = shown?.[s.species]; if (!r) continue;
    s.moves = [...r.moves, ...s.moves.filter((x) => !r.moves.includes(x))].slice(0, 4);
    if (r.item) s.item = r.item;
    if (r.ability) s.ability = r.ability;
  }
  return PS.Teams.export(sets);
}

// ---------- the Showdown server, battles in this process so the engine can search the live battle ----------
process.chdir(VENDOR);
process.env.PSBINDADDR = '127.0.0.1'; // this Mac only: logins here skip authentication
// a bare port number in argv makes PS skip its cloud autoconfig, which would rebind to 0.0.0.0
if (!process.argv.includes(String(PORT))) process.argv.push(String(PORT));
const Config = require(`${VENDOR}dist/server/config-loader.js`).load();
Object.assign(Config, {
  port: PORT, bindaddress: '127.0.0.1', noguestsecurity: true, nothrottle: true, noipchecks: true, crashguard: true, repl: false, watchconfig: false,
  // networking in its own process as usual; simulator, validator and the rest here (simulator: 0 = in-process battles)
  subprocessescache: { network: 1, simulator: 0, validator: 0, verifier: 0, chatdb: 0, pm: 0, modlog: 0, friends: 0, battlesearch: 0, datasearch: 0, localartemis: 0, remoteartemis: 0 },
});
await require(`${VENDOR}dist/server/index.js`).readyPromise;
// a local server has no login server accounts: treat every named user as confirmed so guests can PM the bot
const rename = globalThis.Users.User.prototype.forceRename;
globalThis.Users.User.prototype.forceRename = function (...a) { const r = rename.apply(this, a); if (this.named) this.autoconfirmed = this.id; return r; };
const liveBattle =(roomid) => globalThis.Rooms.get(roomid)?.battle?.stream?.battle ?? null;

// ---------- the bot ----------
const series = new Map(); // human userid -> { pick, team, dir, games: [{ room, winner }], score, shown, done }
const picks = new Map(); // human userid -> team id they asked for ('random' default)
const games = new Map(); // battle roomid -> game state
let ws;
const send = (s) => ws.send(s);
const pm = (user, msg) => send(`|/pm ${user}, ${msg}`);
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const HELP = [
  `I play ${CAND.opponent.coach}'s modelled sixes with the strongest engine we have. Reg M-C, closed sheets, best of 3.`,
  `"play" — I challenge you; his six is a weighted draw from his likely teams, shown when the series ends.`,
  `"play <id>" — a chosen six. "teams" — the list. Accept my challenge with your team from the teambuilder.`,
];

function startSeries(user, userid) {
  const choice = picks.get(userid) ?? 'random';
  const t = choice === 'random' ? draw() : THEIRS.find((x) => x.id === choice);
  series.set(userid, { pick: choice, team: t, dir: `${ROOT}tools/sim/results/play/${userid}-${stamp()}/`, games: [], score: { human: 0, engine: 0 }, shown: null, done: false });
  send(`|/utm ${packTeam(t.text)}`);
  return t;
}
function onPM(from, msg) {
  const userid = toID(from);
  if (userid === toID(BOT)) return;
  const name = from.replace(/^[^A-Za-z0-9]/, '').trim();
  if (msg.startsWith('/challenge ')) { // he challenged me: accept only closed sheets in Reg M-C
    const fmt = msg.slice(11).split('|')[0];
    if (!toID(fmt).startsWith(FORMAT)) { send(`|/reject ${name}`); pm(name, `I only play ${FORMAT}. PM me "play" and I'll challenge you.`); return; }
    if (!/!\s*open\s*team\s*sheets/i.test(fmt)) { send(`|/reject ${name}`); pm(name, 'That challenge has open team sheets. PM me "play" and I\'ll send a closed-sheet best of 3.'); return; }
    startSeries(name, userid);
    send(`|/accept ${name}`);
    return;
  }
  if (msg.startsWith('/')) return;
  const [cmd, id] = msg.trim().split(/\s+/);
  if (toID(cmd) === 'teams') {
    pm(name, `Sixes I can play (say "play <id>"): ${THEIRS.map((t) => t.id).join(', ')}. "play" alone = weighted draw from ${POOL.map((t) => t.id).join(', ')}.`);
    return;
  }
  if (toID(cmd) === 'play') {
    if (id && id !== 'random' && !THEIRS.some((t) => t.id === id)) { pm(name, `No six "${id}". Say "teams" for the list.`); return; }
    picks.set(userid, id ?? 'random');
    startSeries(name, userid);
    send(`|/challenge ${name}, ${CHALLENGE_FORMAT}`);
    pm(name, `Challenge sent (${id && id !== 'random' ? `six ${id}` : 'hidden six'}). Accept it with your team.`);
    return;
  }
  for (const l of HELP) pm(name, l);
}

// chat and room chrome the engine's tracker shouldn't see
const SKIP = new Set(['c', 'c:', 'j', 'J', 'l', 'L', 'n', 'N', 'b', 'B', 'raw', 'html', 'uhtml', 'uhtmlchange', 'inactive', 'inactiveoff', 't:', 'title', 'init', 'deinit', 'noinit', 'tempnotify', 'tempnotifyoff', 'notify', 'timestamp', 'expire', 'controlshtml', 'fieldhtml', 'debug', 'chatmsg', 'chatmsg-raw', 'pm', 'askreg', 'nametaken', 'popup', 'customgroups', 'formats', 'updatesearch', 'updatechallenges', 'queryresponse', 'hidelines', 'unlink']);
function onBattle(roomid, lines) {
  let g = games.get(roomid);
  if (!g) {
    if (!lines.some((l) => l.startsWith('|init|battle') || l.startsWith('|request|'))) return;
    g = { roomid, lines: [], pending: [], engine: null, rqid: 0, human: null, side: null, saved: false, startedAt: new Date() };
    games.set(roomid, g);
  }
  for (const line of lines) {
    if (line.startsWith('|player|')) { const [, , slot, nm] = line.split('|'); if (nm && toID(nm) !== toID(BOT)) g.human = { slot, name: nm, id: toID(nm) }; }
    if (line.startsWith('|request|')) {
      const r = JSON.parse(line.slice(9) || 'null'); if (!r) continue;
      g.rqid = r.rqid ?? g.rqid;
      if (!g.engine) makeEngine(g, r);
      g.engine.receiveLine(line);
      continue;
    }
    const cmd = line.split('|')[1];
    if (!line.startsWith('|') || SKIP.has(cmd)) continue;
    g.lines.push(line);
    if (g.engine) g.engine.receiveLine(line); else g.pending.push(line);
    if (cmd === 'win' || cmd === 'tie') endGame(g, cmd === 'win' ? line.split('|')[2] : null);
  }
}
function makeEngine(g, request) {
  clearDamageCache();
  g.side = request.side.id;
  const b = liveBattle(g.roomid);
  const humanSide = g.side === 'p1' ? 'p2' : 'p1';
  g.humanSide = humanSide;
  g.humanSets = b?.getSide(humanSide)?.team ?? [];
  g.humanText = PS.Teams.export(g.humanSets);
  const s = g.human && series.get(g.human.id);
  g.series = s;
  g.mine = s?.team?.text ?? PS.Teams.export(b.getSide(g.side).team);
  g.believed = belief(g.humanText, s?.shown); // species only (closed sheets) + what earlier games showed
  const seed = Math.floor(Math.random() * 1e9);
  const stream = { write: (choice) => { send(`${g.roomid}|/choose ${choice}|${g.rqid}`); } };
  // ENGINE_DEFAULTS: depth 2, mean dice, 2 samples — every gated upgrade tied, so this is the strongest we have
  g.engine = new EnginePlayer(stream, { mine: g.mine, theirs: g.believed, seed: [seed, 2, 13, 17], battle: () => liveBattle(g.roomid), notes: true,
    skill: 1, style: 'balanced', noise: 0, usualBring: 0, preview: 'ai', persona: null, sheets: 'closed', samples: null, weights: null, wide: false, depth: null, dice: null, net: null });
  for (const l of g.pending) g.engine.receiveLine(l);
  g.pending = [];
}
function endGame(g, winner) {
  if (g.saved) return; g.saved = true;
  const b = liveBattle(g.roomid);
  const s = g.series;
  const n = s ? s.games.length + 1 : 1;
  const engineWon = winner && toID(winner) === toID(BOT);
  if (s) {
    s.games.push({ room: g.roomid, winner });
    if (winner) s.score[engineWon ? 'engine' : 'human']++;
    s.shown = revealed(g.lines, g.humanSets, g.humanSide, s.shown);
    s.done = s.score.human >= 2 || s.score.engine >= 2 || s.games.length >= 3;
  }
  const dir = s?.dir ?? `${ROOT}tools/sim/results/play/unknown-${stamp()}/`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}game-${n}.json`, JSON.stringify({
    when: g.startedAt, room: g.roomid, game: n, winner, human: g.human?.name, humanSide: g.humanSide,
    series: s ? { engineSix: s.team.id, engineSixLabel: s.team.label, pick: s.pick, score: s.score, done: s.done } : null,
    humanTeam: g.humanText, engineTeam: g.mine, engineBelievedHuman: g.believed,
    engineNotes: g.engine?.notes ?? [], engineStats: g.engine?.stats ?? null, engineCrashes: g.engine?.crashes ?? 0,
    inputLog: b?.inputLog ?? null, log: b?.log ?? g.lines,
  }, null, 1));
  console.log(`${new Date().toISOString()} ${g.roomid}: ${winner ?? 'tie'} wins game ${n}${s ? ` (${s.score.human}-${s.score.engine})` : ''} -> ${dir}game-${n}.json`);
  if (s?.done && g.human) pm(g.human.name, `Series over, ${s.score.human}-${s.score.engine}. I played ${s.team.id}: ${s.team.label}. Logs saved for the engine.`);
  setTimeout(() => games.delete(g.roomid), 60e3);
}

const readied = new Set();
function onMessage(data) {
  let roomid = '';
  if (data.startsWith('>')) { const nl = data.indexOf('\n'); roomid = data.slice(1, nl); data = data.slice(nl + 1); }
  const lines = data.split('\n');
  // best of 3: confirm "ready" for the next game
  for (const m of data.matchAll(/\/msgroom ([^,"]+),\/confirmready/g)) {
    const k = `${m[1]}#${(data.match(/ready for game (\d)/) ?? [])[1]}`;
    if (!readied.has(k) && !/I'm ready!<\/button> &ndash; waiting/.test(data)) { readied.add(k); send(`|/msgroom ${m[1]},/confirmready`); }
  }
  if (roomid.startsWith('battle-')) return onBattle(roomid, lines);
  for (const line of lines) {
    if (line.startsWith('|challstr|')) send(`|/trn ${BOT},0,`);
    else if (line.startsWith('|updateuser|') && toID(line.split('|')[2]) === toID(BOT)) {
      if (!globalThis.__botReady) { globalThis.__botReady = true; console.log(`Engine bot "${BOT}" logged in.`); }
    } else if (line.startsWith('|pm|')) { const [, , from, , ...rest] = line.split('|'); onPM(from, rest.join('|')); }
  }
}
function connect() {
  ws = new WebSocket(`ws://127.0.0.1:${PORT}/showdown/websocket`);
  ws.onmessage = (e) => { try { onMessage(String(e.data)); } catch (err) { console.error('bot error:', err); } };
  ws.onclose = () => { console.log('bot disconnected; reconnecting'); globalThis.__botReady = false; setTimeout(connect, 2000); };
  ws.onerror = () => {};
}
setTimeout(connect, 1500);
console.log(`Showdown is up: open http://localhost:${PORT} (it redirects to the official client pointed at this server).`);
console.log(`Then find the user "${BOT}" and PM it: play   (or "play h14", or "teams").`);
console.log(`Your teams to import into the teambuilder: ${MY_TEAMS}`);

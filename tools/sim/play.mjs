// Play a game against the search engine yourself: a local page where you pick your moves and the engine (depth 2, mean
// dice, the same settings as the match studies) plays the other side. Closed team sheets: the engine only knows your
// species and guesses your sets from what you showed in earlier weeks, else ladder usage. Local only (127.0.0.1).
//   node tools/sim/play.mjs [--port 4701] [--cands tools/sim/candidates/hexpov.json] [--ours s119,k086] [--theirs h01,...]
//   then open http://127.0.0.1:4701. Best of 3 with the same sixes; games 2-3: the engine knows what earlier games revealed.
//   Logs + the engine's per-decision notes: tools/sim/results/play/<coach>-<time>/game-N.json
import { createServer } from 'node:http';
import { readFileSync, existsSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { PS, FORMAT, packTeam } from './ai/data.mjs';
import { EnginePlayer } from './engine/player.mjs';
import { beliefText, usageLibrary, library } from './sheets.mjs';
import { clearDamageCache } from './ai/engine.mjs';

const ROOT = new URL('../../', import.meta.url).pathname;
const args = process.argv.slice(2);
const arg = (k, d) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1] : d);
const PORT = Number(arg('port', 4701));
// --cands: the match's candidates file (default: Hex, Week 4). --ours / --theirs: comma lists of team ids from it.
const CAND = JSON.parse(readFileSync(`${ROOT}${arg('cands', 'tools/sim/candidates/hexpov.json')}`, 'utf8'));
const USAGE = usageLibrary();
const team = (id) => [...CAND.ours.teams, ...CAND.opponent.teams].find((t) => t.id === id);

// teams you can pick: yours, and the opponent's modelled sixes (for Hex: his likely sixes and his counter-sixes)
const OURS = arg('ours', 's119,k086').split(',').map((id) => [id, `${id}: ${team(id).label}`, team(id).team]);
const THEIR_IDS = arg('theirs', 'h01,h02,h03,h04,h05,h06,h07,h08,h09,h10,h11,h12,h13,h14,h15,h16,h17,h18,h19,h20,p022,p026,p047,p091,p095,p043,p134,p097').split(',');
const THEIRS = THEIR_IDS.map((id) => [id, `${CAND.opponent.coach} ${id}: ${team(id).label}`, team(id).team, team(id).weight ?? 0]);
const RANDOM_POOL = THEIRS.filter((t) => t[3] > 0); // "random" = a weighted draw from the likely sixes, hidden until the series ends

/**
 * Best of 3, closed team sheets: the same two sixes all series. The engine starts from usage-based guesses of your sets;
 * after each game it knows what that game revealed (moves used, items, abilities, Mega), as a human opponent would.
 */
let SER = null;
function revealed(log, oursText) {
  const sets = PS.Teams.import(oursText);
  // the log names a mon by its nickname, else its base species (Stunfisk-Galar shows as "Stunfisk")
  const byName = Object.fromEntries(sets.flatMap((s) => [[s.species, s], [PS.Dex.species.get(s.species).baseSpecies, s], ...(s.name ? [[s.name, s]] : [])]));
  const out = SER?.revealed ?? {};
  const mon = (ref) => { const n = String(ref ?? '').split(': ').slice(1).join(': '); const s = byName[n]; return s ? (out[s.species] ??= { moves: [], item: null, ability: null }) : null; };
  for (const l of log) {
    const p = l.split('|');
    if (!p[2]?.startsWith('p1')) {
      const of = p.find((x) => x.startsWith('[of] p1'));
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
// the engine's starting guess of your sets: what you showed in earlier weeks (the candidates file's beliefRef, e.g. your
// Week 3 six: Mega Charizard Y, Kangaskhan, ...), else ladder usage, the same assumption as the match sims
const PRIOR = new Map([...USAGE, ...library([{ text: team(CAND.ours.beliefRef ?? 'o01')?.team ?? '' }])]);
function belief(oursText) {
  const sets = PS.Teams.import(beliefText(oursText, 'closed', PRIOR));
  for (const s of sets) {
    const r = SER?.revealed?.[s.species]; if (!r) continue;
    s.moves = [...r.moves, ...s.moves.filter((x) => !r.moves.includes(x))].slice(0, 4);
    if (r.item) s.item = r.item;
    if (r.ability) s.ability = r.ability;
  }
  return PS.Teams.export(sets);
}

// one game at a time
let G = null;
function newGame(oursText, theirsText, theirsLabel) {
  clearDamageCache();
  const bs = new PS.BattleStream();
  const streams = PS.getPlayerStreams(bs);
  const seed = Math.floor(Math.random() * 1e9);
  const believed = belief(oursText);
  const g = { log: [], request: null, waiting: false, error: '', over: false, winner: null, theirsLabel, oursText, theirsText, seed, streams, startedAt: new Date(), believed };
  // the strongest engine we have: ENGINE_DEFAULTS (depth 2, mean dice, 2 samples), every gated upgrade having tied
  const engine = new EnginePlayer(streams.p2, { mine: theirsText, theirs: believed, seed: [seed, 2, 13, 17], battle: () => bs.battle, notes: true,
    skill: 1, style: 'balanced', noise: 0, usualBring: 0, preview: 'ai', persona: null, sheets: 'closed', samples: null, weights: null, wide: false, depth: null, dice: null, net: null });
  g.engine = engine;
  void engine.start().catch((e) => { g.error = `engine stopped: ${e.message}`; });
  (async () => {
    for await (const chunk of streams.p1) {
      for (const line of chunk.split('\n')) {
        if (line.startsWith('|request|')) {
          const r = JSON.parse(line.slice(9) || 'null');
          if (r && !r.wait) { g.request = r; g.last = r; g.waiting = false; }
        } else if (line.startsWith('|error|')) { g.error = line.slice(7); g.request = g.last; g.waiting = false; }
        else if (line) {
          g.log.push(line);
          if (line.startsWith('|win|') || line === '|tie' || line.startsWith('|tie|')) { g.over = true; g.winner = line.split('|')[2] ?? 'tie'; g.request = null; saveLog(g); }
        }
      }
    }
  })();
  void streams.omniscient.write(`>start ${JSON.stringify({ formatid: FORMAT, seed: [seed, 1, 2, 3] })}\n>player p1 ${JSON.stringify({ name: 'Anthony', team: packTeam(oursText) })}\n>player p2 ${JSON.stringify({ name: 'Engine', team: packTeam(theirsText) })}`);
  return g;
}
function saveLog(g) {
  if (g.saved) return; g.saved = true;
  const n = SER ? SER.games.length + 1 : 1;
  if (SER) {
    if (g.winner === 'Anthony') SER.score[0]++; else if (g.winner === 'Engine') SER.score[1]++;
    SER.games.push(g.winner);
    SER.revealed = revealed(g.log, g.oursText);
    SER.done = SER.score[0] >= 2 || SER.score[1] >= 2 || SER.games.length >= 3;
  }
  const dir = SER ? SER.dir : `${ROOT}tools/sim/results/play/`; mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}game-${n}.json`, JSON.stringify({ when: g.startedAt, seed: g.seed, game: n, series: SER ? { opponent: SER.theirsId, score: SER.score, done: SER.done } : null,
    winner: g.winner, opponent: g.theirsLabel, ours: g.oursText, theirs: g.theirsText, engineBelievedOurs: g.believed, engineNotes: g.engine?.notes ?? [], engineStats: g.engine?.stats ?? null, log: g.log }, null, 1));
}

const page = () => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Play the Engine</title><style>
:root{--bg:#f6f5f2;--card:#fff;--ink:#1d1d1f;--mute:#6b6b70;--line:#e2e0da;--acc:#2f5fd0;--good:#2e7d32;--bad:#c62828;--warn:#b26a00}
@media (prefers-color-scheme:dark){:root{--bg:#141416;--card:#1f1f23;--ink:#ececf0;--mute:#9a9aa3;--line:#33333a;--acc:#7aa2ff;--good:#6fcf73;--bad:#ff7b7b;--warn:#f0b35a}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 system-ui,-apple-system,sans-serif}
main{max-width:1100px;margin:0 auto;padding:16px}h1{font-size:20px;margin:0 0 4px}.sub{color:var(--mute);font-size:13px;margin-bottom:14px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}@media(max-width:760px){.grid{grid-template-columns:1fr}}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px}
.mon{display:flex;justify-content:space-between;gap:8px;padding:4px 0}.bar{height:7px;border-radius:4px;background:var(--line);overflow:hidden;margin-top:3px}.bar>i{display:block;height:100%;background:var(--good)}
.side h3{margin:0 0 6px;font-size:14px;color:var(--mute);font-weight:600}
#log{height:420px;overflow:auto;font-size:13.5px}#log div{padding:1px 0}#log .t{margin-top:8px;font-weight:700;border-top:1px solid var(--line);padding-top:6px}
#log .me{color:var(--acc)}#log .x{color:var(--mute);font-size:12.5px}
button{font:inherit;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:8px;padding:6px 10px;margin:3px;cursor:pointer}
button:hover{border-color:var(--acc)}button.on{background:var(--acc);color:#fff;border-color:var(--acc)}button:disabled{opacity:.4;cursor:default}
select,textarea{font:inherit;width:100%;background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:6px}
.err{color:var(--bad);font-size:13px}.wait{color:var(--warn)}.slot{border-top:1px dashed var(--line);margin-top:8px;padding-top:6px}
</style></head><body><main>
<h1>Play the Engine</h1><div class="sub">You are p1. The engine plays the other side with closed team sheets: it sees your species, not your sets (it guesses them from ladder usage). Local only.</div>
<div id="setup" class="card"></div><div id="game" style="display:none">
<div class="grid"><div class="card side" id="field"></div><div class="card"><div id="act"></div></div></div>
<div class="card" style="margin-top:14px"><div id="log"></div></div></div>
<script>
const $=s=>document.querySelector(s);let S=null,sel={},pv=[];
const esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
async function setup(){const o=await (await fetch('/options')).json();
$('#setup').innerHTML='<b>Your team</b><select id=ours>'+o.ours.map(x=>'<option value="'+x[0]+'">'+esc(x[1])+'</option>').join('')+'<option value=paste>Paste a Showdown export…</option></select><textarea id=paste rows=6 style="display:none;margin-top:6px" placeholder="Showdown export"></textarea>'
+'<div style="margin-top:10px"><b>Engine plays</b><select id=theirs><option value=random>Hidden: a likely '+esc(o.coach)+' six, drawn by weight (revealed after the series)</option>'+o.theirs.map(x=>'<option value="'+x[0]+'">'+esc(x[1])+'</option>').join('')+'</select></div><div style="margin-top:10px"><button class=on onclick=start()>Start best of 3</button> <span class=err id=serr></span></div>';
$('#ours').onchange=()=>{$('#paste').style.display=$('#ours').value==='paste'?'block':'none'};}
async function start(){const r=await fetch('/start',{method:'POST',body:JSON.stringify({ours:$('#ours').value,paste:$('#paste').value,theirs:$('#theirs').value})});const j=await r.json();if(j.error){$('#serr').textContent=j.error;return}
$('#setup').style.display='none';$('#game').style.display='block';poll();}
const who=s=>s.startsWith('p1')?'Your ':'Engine\\'s ';const nm=s=>s.split(': ').slice(1).join(': ');
const hp=c=>{if(!c)return 100;if(c.endsWith(' fnt')||c==='0 fnt')return 0;const [a,b]=c.split(' ')[0].split('/').map(Number);return b?Math.round(100*a/b):100};
function fmt(l){const p=l.split('|');const t=p[1];const tag=x=>x&&x.startsWith('p1')?'me':'';
switch(t){case'turn':return['t','Turn '+p[2]];case'switch':case'drag':return[tag(p[2]),who(p[2])+nm(p[2])+' comes in ('+hp(p[4])+'%)'];
case'move':return[tag(p[2]),who(p[2])+nm(p[2])+' used '+p[3]+(p[4]&&p[4][0]==='p'&&!p[4].startsWith(p[2].slice(0,3))?' → '+who(p[4]).toLowerCase()+nm(p[4]):'')];
case'-damage':return[tag(p[2]),'  '+who(p[2])+nm(p[2])+' → '+hp(p[3])+'%'+(p[4]?' '+p[4].replace('[from] ',''):'')];case'-heal':return[tag(p[2]),'  '+who(p[2])+nm(p[2])+' healed to '+hp(p[3])+'%'+(p[4]?' '+p[4].replace('[from] ',''):'')];
case'faint':return['', '  '+who(p[2])+nm(p[2])+' fainted'];case'-supereffective':return['x','  super effective'];case'-resisted':return['x','  resisted'];case'-crit':return['x','  critical hit'];case'-miss':return['x','  missed'];case'-fail':return['x','  it failed'];case'-immune':return['x','  no effect'];
case'-mega':return[tag(p[2]),who(p[2])+nm(p[2])+' Mega Evolved'];case'-weather':return p[2]==='none'?['x','weather ended']:p[3]?.includes('upkeep')?null:['', 'Weather: '+p[2]];case'-fieldstart':return['', p[2].replace('move: ','')+' started'];case'-fieldend':return['x', p[2].replace('move: ','')+' ended'];
case'-sidestart':return['', (p[2].startsWith('p1')?'Your':'Engine\\'s')+' side: '+p[3].replace('move: ','')];case'-status':return['', '  '+who(p[2])+nm(p[2])+' is '+p[3]];case'-boost':case'-unboost':return['x','  '+who(p[2])+nm(p[2])+' '+p[3]+(t==='-boost'?' +':' −')+p[4]];
case'cant':return['', '  '+who(p[2])+nm(p[2])+' can\\'t move ('+p[3]+')'];case'-activate':return['x','  '+(p[3]||'').replace('move: ','').replace('ability: ','').replace('item: ','')+(p[2]?' ('+nm(p[2])+')':'')];case'-enditem':return['x','  '+who(p[2])+nm(p[2])+'\\'s '+p[3]+' was used'];
case'win':return['t',p[2]+' won!'];case'poke':return['x',(p[2]==='p1'?'You':'Engine')+' brought '+p[3].split(',')[0]+' to preview'];default:return null}}
function fieldState(log){const a={};for(const l of log){const p=l.split('|');if(p[1]==='switch'||p[1]==='drag'){a[p[2].slice(0,3)]={n:nm(p[2]),h:hp(p[4])}}else if((p[1]==='-damage'||p[1]==='-heal')&&a[p[2].slice(0,3)])a[p[2].slice(0,3)].h=hp(p[3]);else if(p[1]==='faint'&&a[p[2].slice(0,3)])a[p[2].slice(0,3)].h=0;else if(p[1]==='detailschange'&&a[p[2].slice(0,3)])a[p[2].slice(0,3)].n=p[3].split(',')[0]}return a}
const monRow=m=>m?'<div class=mon><div>'+esc(m.n)+'<div class=bar><i style="width:'+m.h+'%;background:'+(m.h>50?'var(--good)':m.h>20?'var(--warn)':'var(--bad)')+'"></i></div></div><div>'+m.h+'%</div></div>':'<div class=mon><div style="color:var(--mute)">—</div></div>';
function render(){const a=fieldState(S.log);let f='<h3>Engine ('+esc(S.theirsLabel)+')</h3>'+monRow(a.p2a)+monRow(a.p2b)+'<h3 style="margin-top:10px">You</h3>'+monRow(a.p1a)+monRow(a.p1b);
if(S.request?.side)f+='<div class=x style="margin-top:8px;color:var(--mute);font-size:12.5px">Your team: '+S.request.side.pokemon.map(p=>esc(p.details.split(',')[0])+' '+(p.condition.endsWith('fnt')?'✗':hp(p.condition)+'%')).join(' · ')+'</div>';
$('#field').innerHTML=f;const L=$('#log');const at=L.scrollHeight-L.scrollTop-L.clientHeight<40;
L.innerHTML=S.log.map(fmt).filter(Boolean).map(([c,t])=>'<div class="'+c+'">'+esc(t)+'</div>').join('');if(at)L.scrollTop=L.scrollHeight;actions();}
async function next(){await fetch('/next',{method:'POST'});poll1()}async function poll1(){S=await (await fetch('/state')).json();render()}
function actions(){const r=S.request,A=$('#act');const sr=S.series;const sc=sr?'<div class=sub>Best of 3: you '+sr.score[0]+' – '+sr.score[1]+' engine'+(sr.done?'':' · game '+sr.game)+'</div>':'';
if(S.over){A.innerHTML='<b>'+(S.winner==='Anthony'?'You won this game.':'The engine won this game.')+'</b>'+sc+(sr&&sr.done?'<div><b>'+(sr.score[0]>sr.score[1]?'You won the series.':'The engine won the series.')+'</b></div>'+(sr.reveal?'<div class=sub>The engine was playing '+esc(sr.reveal)+'</div>':'')+'<button onclick="location.reload()">New series</button>':'<div class=sub>From the next game, the engine knows what this one showed of your sets (closed sheets).</div><button class=on onclick="next()">Next game</button>')+'<div class=sub>Logs and the engine\\'s reasoning are saved in tools/sim/results/play/.</div>';return}
if(S.waiting||!r){A.innerHTML=sc+'<span class=wait>Engine is thinking…</span>';return}let h=sc+(S.error?'<div class=err>'+esc(S.error)+'</div>':'');
if(r.teamPreview){h+='<b>Team preview:</b> click 4 to bring, in order (the first two lead).<div>'+r.side.pokemon.map((p,i)=>'<button class="'+(pv.includes(i+1)?'on':'')+'" onclick="tp('+(i+1)+')">'+(pv.includes(i+1)?(pv.indexOf(i+1)+1)+'. ':'')+esc(p.details.split(',')[0])+'</button>').join('')+'</div><button '+(pv.length===4?'':'disabled')+' onclick="send(\\'team '+pv.join('')+'\\')">Lock in</button> <button onclick="pv=[];actions()">Clear</button>';A.innerHTML=h;return}
const slots=(r.forceSwitch||r.active).map((_,pos)=>pos);h+='<b>'+(r.forceSwitch?'Choose replacements':'Turn '+turnNo()+': your moves')+'</b>';
for(const pos of slots){const p=r.side.pokemon[pos];const need=r.forceSwitch?r.forceSwitch[pos]:!(p.condition.endsWith(' fnt')||p.commanding);h+='<div class=slot><b>'+esc(p.details.split(',')[0])+'</b> ';
if(!need){h+='<span class=sub>(nothing to do)</span></div>';sel[pos]='pass';continue}const c=sel[pos]||'';
if(!r.forceSwitch){const act=r.active[pos];act.moves.forEach((m,i)=>{const tg=['normal','any','adjacentFoe','adjacentAlly','adjacentAllyOrSelf'].includes(m.target);
if(!tg)h+='<button '+(m.disabled?'disabled':'')+' class="'+(c==='move '+(i+1)?'on':'')+'" onclick="pick('+pos+',\\'move '+(i+1)+'\\')">'+esc(m.move)+'</button>';
else{h+='<span style="white-space:nowrap">'+esc(m.move)+': ';const ts=m.target==='adjacentAlly'?[[-(2-pos),'ally']]:m.target==='adjacentAllyOrSelf'?[[-(pos+1),'self'],[-(2-pos),'ally']]:[[1,'foe L'],[2,'foe R']].concat(m.target==='any'||m.target==='normal'?[[-(2-pos),'ally']]:[]);
for(const [t,lab] of ts)h+='<button '+(m.disabled?'disabled':'')+' class="'+(c==='move '+(i+1)+' '+t?'on':'')+'" onclick="pick('+pos+',\\'move '+(i+1)+' '+t+'\\')">'+lab+'</button>';h+='</span> '}});
if(act.canMegaEvo)h+='<label style="margin-left:6px"><input type=checkbox id=mega'+pos+' '+(sel['m'+pos]?'checked':'')+' onchange="sel[\\'m'+pos+'\\']=this.checked"> Mega Evolve</label>';}
const bench=r.side.pokemon.map((q,i)=>[q,i+1]).filter(([q,i])=>i>r.active?.length||(r.forceSwitch&&i>r.forceSwitch.length)).filter(([q])=>!q.condition.endsWith(' fnt')&&!q.active);
if(!(r.active&&r.active[pos].trapped))h+='<div>Switch: '+bench.map(([q,i])=>'<button class="'+(c==='switch '+i?'on':'')+'" onclick="pick('+pos+',\\'switch '+i+'\\')">'+esc(q.details.split(',')[0])+'</button>').join('')+'</div>';h+='</div>'}
const ready=slots.every(p=>sel[p]);h+='<div style="margin-top:8px"><button class=on '+(ready?'':'disabled')+' onclick="go()">Confirm</button></div>';A.innerHTML=h;}
const turnNo=()=>{let n=0;for(const l of S.log)if(l.startsWith('|turn|'))n=+l.split('|')[2];return n};
function tp(i){pv=pv.includes(i)?pv.filter(x=>x!==i):pv.length<4?[...pv,i]:pv;actions()}function pick(pos,c){sel[pos]=c;actions()}
function go(){const r=S.request;const slots=(r.forceSwitch||r.active).map((_,p)=>p);send(slots.map(p=>sel[p]+(sel['m'+p]&&sel[p].startsWith('move')?' mega':'')).join(', '))}
async function send(c){sel={};pv=[];S.waiting=true;actions();await fetch('/choose',{method:'POST',body:JSON.stringify({choice:c})});}
async function poll(){try{S=await (await fetch('/state')).json();render()}catch(e){}setTimeout(poll,700)}
setup();
</script></main></body></html>`;

const body = (req) => new Promise((r) => { let s = ''; req.on('data', (c) => { s += c; }); req.on('end', () => { try { r(JSON.parse(s || '{}')); } catch { r({}); } }); });
createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const json = (o) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (url.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(page()); return; }
  if (url.pathname === '/options') return json({ coach: CAND.opponent.coach, ours: OURS.map(([id, label]) => [id, label]), theirs: THEIRS.map(([id, label]) => [id, label]) });
  if (url.pathname === '/start' && req.method === 'POST') {
    const b = await body(req);
    let ours = OURS.find((x) => x[0] === b.ours)?.[2];
    if (b.ours === 'paste') {
      const sets = PS.Teams.import(b.paste ?? '');
      const p = sets?.length ? PS.TeamValidator.get(FORMAT).validateTeam(sets) : ['could not read the team'];
      if (p?.length) return json({ error: p.slice(0, 3).join(' | ') });
      ours = PS.Teams.export(sets);
    }
    let t = THEIRS.find((x) => x[0] === b.theirs);
    if (b.theirs === 'random') { let u = Math.random() * RANDOM_POOL.reduce((s, x) => s + x[3], 0); t = RANDOM_POOL.find((x) => (u -= x[3]) < 0) ?? RANDOM_POOL[0]; }
    if (!ours || !t) return json({ error: 'pick both teams' });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    SER = { theirsId: t[0], theirsLabel: t[1], hidden: b.theirs === 'random', ours, theirs: t[2], score: [0, 0], games: [], revealed: {}, done: false,
      dir: `${ROOT}tools/sim/results/play/${CAND.opponent.coach.replace(/[^A-Za-z0-9]/g, '')}-${stamp}/` };
    G = newGame(ours, t[2], SER.hidden ? `a hidden ${CAND.opponent.coach} six` : t[1]);
    return json({ ok: true });
  }
  if (url.pathname === '/next' && req.method === 'POST') {
    if (!SER || SER.done || !G?.over) return json({ error: 'no next game' });
    G = newGame(SER.ours, SER.theirs, G.theirsLabel);
    return json({ ok: true });
  }
  if (url.pathname === '/state') {
    if (!G) return json({ log: [], request: null });
    return json({ log: G.log, request: G.request, waiting: G.waiting, error: G.error, over: G.over, winner: G.winner, theirsLabel: G.theirsLabel,
      series: SER ? { score: SER.score, game: SER.games.length + (G.over ? 0 : 1), done: SER.done, reveal: SER.done && SER.hidden ? SER.theirsLabel : null } : null });
  }
  if (url.pathname === '/choose' && req.method === 'POST') {
    const b = await body(req);
    if (!G || !b.choice) return json({ error: 'no game' });
    G.error = ''; G.waiting = true; G.request = null;
    void G.streams.p1.write(b.choice);
    return json({ ok: true });
  }
  res.writeHead(404); res.end('not found');
}).listen(PORT, '127.0.0.1', () => console.log(`Play the engine: http://127.0.0.1:${PORT}`));

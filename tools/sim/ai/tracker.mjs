// What one player knows during a battle, rebuilt from the Showdown protocol it receives: both teams' sets (open team
// sheets: given up front), every Pokémon's HP fraction, status, boosts, form, item, the actives, and the field (weather,
// terrain, Trick Room, Tailwind, screens). Pure bookkeeping; no decisions.
import { toID, DEX, PROTECTS } from './data.mjs';

const WEATHER = { sunnyday: 'Sun', desolateland: 'Sun', raindance: 'Rain', primordialsea: 'Rain', sandstorm: 'Sand', snowscape: 'Snow', snow: 'Snow', hail: 'Snow' };
const TERRAIN = { electricterrain: 'Electric', grassyterrain: 'Grassy', psychicterrain: 'Psychic', mistyterrain: 'Misty' };
const hpOf = (s) => {
  const [hp, status] = String(s ?? '').split(' ');
  if (hp === '0' || status === 'fnt') return { hp: 0, status: '', fnt: true };
  const [a, b] = hp.split('/').map(Number);
  return { hp: b ? a / b : 1, status: status ?? '', fnt: false };
};
const baseOf = (speciesName) => { const sp = DEX.species.get(speciesName); return toID(sp.baseSpecies === sp.name ? sp.name : sp.battleOnly ? (Array.isArray(sp.battleOnly) ? sp.battleOnly[0] : sp.battleOnly) : sp.name); };

export function newMon(set, side, i) {
  return { key: `${side}:${i}`, side, i, set, species: set.species, mega: false, hp: 1, status: '', boosts: {}, fainted: false, pos: -1,
    itemGone: false, form: set.species === 'aegislash' ? 'shield' : '', entered: -1, lastMove: '', protectStreak: 0, movesUsed: [], locked: '',
    taunt: 0, seen: false, brought: false };
}

export class Tracker {
  /** teams: { p1: sets, p2: sets } (setsFromText order = the request's order before preview) */
  constructor(teams) {
    this.mons = { p1: teams.p1.map((s, i) => newMon(s, 'p1', i)), p2: teams.p2.map((s, i) => newMon(s, 'p2', i)) };
    this.active = { p1: [null, null], p2: [null, null] };
    this.side = { p1: { tailwind: 0, reflect: 0, lightScreen: 0, auroraVeil: 0 }, p2: { tailwind: 0, reflect: 0, lightScreen: 0, auroraVeil: 0 } };
    this.field = { weather: '', terrain: '', tr: 0, trBy: null };
    this.turn = 0;
    this.byIdent = new Map();
    this.events = []; // this turn's notable lines (for logs)
  }
  monOf(ident) {
    const side = ident.slice(0, 2), name = ident.slice(ident.indexOf(':') + 2);
    return this.byIdent.get(`${side}|${name}`) ?? null;
  }
  posOf(ident) { return ident[2] === 'b' ? 1 : 0; }
  line(line) {
    if (!line.startsWith('|')) return;
    const p = line.slice(1).split('|');
    const cmd = p[0];
    const h = this[`on_${cmd.replace(/^-/, '_')}`];
    if (h) h.call(this, p);
  }
  on_switch(p) {
    const [, ident, details, hp] = p;
    const side = ident.slice(0, 2), pos = this.posOf(ident), name = ident.slice(ident.indexOf(':') + 2);
    const spName = details.split(',')[0];
    const id = toID(spName), base = baseOf(spName);
    const m = this.byIdent.get(`${side}|${name}`) ?? this.mons[side].find((x) => x.set.species === id || x.set.species === base || toID(x.set.name) === toID(name));
    if (!m) return;
    this.byIdent.set(`${side}|${name}`, m);
    const old = this.active[side][pos];
    if (old && old !== m) this.leave(old);
    this.active[side][pos] = m;
    m.pos = pos; m.seen = true; m.brought = true; m.entered = this.turn;
    m.species = id; m.mega = /-mega/i.test(spName);
    const s = hpOf(hp); m.hp = s.hp; m.status = s.status; m.fainted = s.fnt;
  }
  on_drag(p) { this.on_switch(p); }
  on_replace(p) { this.on_switch(p); }
  leave(m) {
    m.pos = -1; m.boosts = {}; m.locked = ''; m.protectStreak = 0; m.movesUsed = []; m.lastMove = ''; m.taunt = 0;
    if (m.set.species === 'aegislash') m.form = 'shield';
  }
  on_detailschange(p) { this.forme(p); }
  on__formechange(p) { this.forme(p); }
  forme(p) {
    const m = this.monOf(p[1]); if (!m) return;
    const spName = p[2].split(',')[0];
    if (/-mega/i.test(spName)) m.mega = true;
    if (m.set.species === 'aegislash') m.form = /blade/i.test(spName) ? 'blade' : 'shield';
    if (m.set.species === 'morpeko') m.form = /hangry/i.test(spName) ? 'hangry' : '';
    if (p[0] === 'detailschange') m.species = toID(spName);
  }
  on__mega(p) { const m = this.monOf(p[1]); if (m) m.mega = true; }
  on_move(p) {
    const m = this.monOf(p[1]); if (!m) return;
    this.lastMover = m.side;
    const id = toID(p[2]);
    const called = p.slice(3).some((x) => x.startsWith('[from]'));
    if (!called) {
      m.lastMove = id;
      if (!m.movesUsed.includes(id)) m.movesUsed.push(id);
      m.protectStreak = PROTECTS.has(id) || id === 'wideguard' ? m.protectStreak + 1 : 0;
      if (/^choice/.test(m.set.item) && !m.itemGone) m.locked = id;
    }
    if (m.set.species === 'aegislash' && DEX.moves.get(id).category !== 'Status') m.form = 'blade';
    if (id === 'kingsshield' && m.set.species === 'aegislash') m.form = 'shield';
    this.events.push(`${p[1]} used ${p[2]}${p[3] ? ` → ${p[3]}` : ''}`);
  }
  on__damage(p) { const m = this.monOf(p[1]); if (!m) return; const s = hpOf(p[2]); m.hp = s.hp; if (s.fnt) m.fainted = true; if (s.status) m.status = s.status; }
  on__heal(p) { this.on__damage(p); }
  on__sethp(p) { this.on__damage(p); }
  on_faint(p) { const m = this.monOf(p[1]); if (m) { m.fainted = true; m.hp = 0; } this.events.push(`${p[1]} fainted`); }
  on__boost(p, sign = 1) { const m = this.monOf(p[1]); if (!m) return; const k = p[2]; m.boosts[k] = Math.max(-6, Math.min(6, (m.boosts[k] ?? 0) + sign * Number(p[3]))); }
  on__unboost(p) { this.on__boost(p, -1); }
  on__setboost(p) { const m = this.monOf(p[1]); if (m) m.boosts[p[2]] = Number(p[3]); }
  on__clearboost(p) { const m = this.monOf(p[1]); if (m) m.boosts = {}; }
  on__clearallboost() { for (const s of ['p1', 'p2']) for (const m of this.mons[s]) m.boosts = {}; }
  on__clearnegativeboost(p) { const m = this.monOf(p[1]); if (m) for (const k in m.boosts) if (m.boosts[k] < 0) m.boosts[k] = 0; }
  on__status(p) { const m = this.monOf(p[1]); if (m) m.status = p[2]; }
  on__curestatus(p) { const m = this.monOf(p[1]); if (m) m.status = ''; }
  on__enditem(p) { const m = this.monOf(p[1]); if (m && !p.some((x) => x.startsWith('[from] move: Thief'))) { m.itemGone = true; m.locked = ''; } }
  on__item(p) { const m = this.monOf(p[1]); if (m) m.itemGone = toID(p[2]) !== m.set.item; }
  on__start(p) { const m = this.monOf(p[1]); if (m && /taunt/i.test(p[2])) m.taunt = 3; }
  on__end(p) { const m = this.monOf(p[1]); if (m && /taunt/i.test(p[2])) m.taunt = 0; }
  on__weather(p) {
    const w = toID(p[1]);
    if (w === 'none') { this.field.weather = ''; this.field.weatherTurns = 0; return; }
    this.field.weather = WEATHER[w] ?? '';
    if (!p.includes('[upkeep]')) this.field.weatherTurns = 5;
  }
  on__fieldstart(p) {
    const id = toID(p[1].replace(/^move: /, ''));
    // durations count the turn they were set in (the next turn line takes one off)
    if (id === 'trickroom') { this.field.tr = 5; const m = p.find((x) => x.startsWith('[of] ')); this.field.trBy = m ? m.slice(5, 7) : this.lastMover; }
    if (TERRAIN[id]) { this.field.terrain = TERRAIN[id]; this.field.terrainTurns = 5; }
  }
  on__fieldend(p) {
    const id = toID(p[1].replace(/^move: /, ''));
    if (id === 'trickroom') { this.field.tr = 0; this.field.trBy = null; }
    if (TERRAIN[id]) this.field.terrain = '';
  }
  on__sidestart(p) {
    const side = p[1].slice(0, 2), id = toID(p[2].replace(/^move: /, ''));
    if (id === 'tailwind') this.side[side].tailwind = 4;
    if (id === 'reflect') this.side[side].reflect = 5;
    if (id === 'lightscreen') this.side[side].lightScreen = 5;
    if (id === 'auroraveil') this.side[side].auroraVeil = 5;
  }
  on__sideend(p) {
    const side = p[1].slice(0, 2), id = toID(p[2].replace(/^move: /, ''));
    if (id === 'tailwind') this.side[side].tailwind = 0;
    if (id === 'reflect') this.side[side].reflect = 0;
    if (id === 'lightscreen') this.side[side].lightScreen = 0;
    if (id === 'auroraveil') this.side[side].auroraVeil = 0;
  }
  on_turn(p) {
    this.turn = Number(p[1]);
    if (this.turn > 1) {
      if (this.field.tr > 0) this.field.tr--;
      for (const s of ['p1', 'p2']) for (const k of ['tailwind', 'reflect', 'lightScreen', 'auroraVeil']) if (this.side[s][k] > 0) this.side[s][k]--;
      if (this.field.weatherTurns > 0) this.field.weatherTurns--;
      for (const s of ['p1', 'p2']) for (const m of this.mons[s]) if (m.taunt > 0) m.taunt--;
    }
    this.events = [];
  }
  /** Is this the mon's first turn on the field (Fake Out, First Impression)? Decided at a move request for this.turn. */
  firstTurn(m) { return m.entered === this.turn - 1; }
}

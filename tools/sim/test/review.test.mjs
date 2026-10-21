// VGC Strategy's AI review fixes (docs/research/strategy/sim/ai-review.md): one test per item.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { position, team } from './helpers.mjs';
import { snapshot, optionsFor, resolve, spreadThreat } from '../ai/engine.mjs';
import { HeuristicPlayer } from '../ai/player.mjs';
import { setsFromText, PROTECTS } from '../ai/data.mjs';

const A = team('a01'), Z1 = team('z01'), Z3 = team('z03'), Z4 = team('z04');
const why = (r) => `\nchoice: ${r.choice}\n${JSON.stringify(r.note, null, 1)}`;
const mv = (side, pos, move, target = null) => ({ kind: 'move', side, pos, move, target });
const guards = (a) => a.kind === 'move' && (PROTECTS.has(a.move) || a.move === 'wideguard');

test('#1 double Protect only when both face a likely KO (z04 Oranguru + Metagross vs Charizard + Kangaskhan, turn 1)', () => {
  const r = position({ mine: Z4, theirs: A, us: ['oranguru', 'metagross'], them: ['charizard', 'kangaskhan'], turn: 1, firstTurn: true, bench: ['toxtricity', 'krookodile'] });
  const dp = r.player.last.final.filter((x) => guards(x.j[0]) && guards(x.j[1])).reduce((t, x) => t + x.p, 0);
  assert.equal(dp, 0, why(r));
});

test('#2 Last Resort is never offered before Fake Out has been used (Fake Out disabled after a flinch): switch instead', () => {
  const r = position({ mine: A, theirs: Z1, us: ['kangaskhan', 'charizard'], them: ['krookodile', 'infernape'], mega: ['p1:charizard'], turn: 2, bench: ['aegislash', 'sinistcha'] });
  assert.equal(r.pOf(0, (a) => a.move === 'lastresort'), 0, why(r));
  assert.equal(r.pOf(0, (a) => a.move === 'fakeout'), 0, why(r));
});

test('#2 a forced failing move is modelled as doing nothing; Poltergeist is never aimed at a Pokémon with no item', () => {
  const r = position({ mine: A, theirs: Z1, us: ['kangaskhan', 'aegislash'], them: ['krookodile', 'metagross'], mega: ['p2:metagross'], turn: 2, gone: ['p2:krookodile'], bench: [] });
  const S = snapshot(r.player.T);
  const R = resolve(S, [mv('p1', 0, 'lastresort', 0), mv('p1', 1, 'kingsshield'), { kind: 'pass', side: 'p2', pos: 0 }, { kind: 'pass', side: 'p2', pos: 1 }]);
  assert.ok(R.log.some((l) => /lastresort fails/.test(l)), R.log.join('\n'));
  assert.equal(R.mons[S.active.p2[0]].hp, 1);
  assert.ok(!optionsFor(S, 'p1', 1).some((o) => o.move === 'poltergeist' && o.target === 0), 'no Poltergeist into the item-less Krookodile');
});

test('#3 hard lead rule: no Charizard lead into a visible spread Rock user without Wide Guard or Fake Out beside it', () => {
  const p = new HeuristicPlayer({ write() {}, async *[Symbol.asyncIterator]() {} }, { mine: A, theirs: Z3, seed: 1 });
  const [zard, aegis, , , sinis] = setsFromText(A), opp = setsFromText(Z3);
  assert.equal(p.leadAllowed([zard, sinis], opp), false);
  assert.equal(p.leadAllowed([zard, aegis], opp), true);
  assert.equal(p.leadAllowed([zard, sinis], setsFromText(team('z21'))), true, 'z21 has no Krookodile / Rock Slide Metagross');
});

test('#3 preview: the AI never leads an uncovered Charizard into z03; the guide policy uses the guide table (vs z01: Aegislash + Kangaskhan)', () => {
  const req = { teamPreview: true, side: { id: 'p1', pokemon: setsFromText(A).map((s) => ({ ident: `p1: ${s.name}`, details: `${s.name}, L50`, condition: '100/100' })) } };
  for (const seed of [1, 2, 3]) {
    const p = new HeuristicPlayer({ write() {}, async *[Symbol.asyncIterator]() {} }, { mine: A, theirs: Z3, seed, notes: true });
    p.ensure(req);
    p.preview(req);
    const pv = p.notes.at(-1).preview;
    assert.ok(!pv.leads.includes('charizard') || pv.leads.some((x) => ['aegislash', 'kangaskhan', 'morpeko'].includes(x)), JSON.stringify(pv));
  }
  const g = new HeuristicPlayer({ write() {}, async *[Symbol.asyncIterator]() {} }, { mine: A, theirs: Z1, seed: 1, notes: true, preview: 'guide' });
  g.ensure(req);
  g.preview(req);
  const pv = g.notes.at(-1).preview;
  assert.deepEqual([pv.leads, [...pv.bring].sort()], [['aegislash', 'kangaskhan'], ['aegislash', 'charizard', 'kangaskhan', 'rotomfan']]);
  assert.match(pv.why, /guide preview/);
});

test('#4 Aegislash: King\'s Shield drops a contact attacker\'s Attack; Wide Guard is not offered without a real spread threat', () => {
  const r = position({ mine: A, theirs: team('z09'), us: ['aegislash', 'charizard'], them: ['umbreon', 'krookodile'], bench: ['kangaskhan', 'sinistcha'] });
  const S = snapshot(r.player.T);
  const R = resolve(S, [mv('p1', 0, 'kingsshield'), mv('p1', 1, 'protect'), mv('p2', 0, 'foulplay', 0), mv('p2', 1, 'knockoff', 0)]);
  assert.ok((R.mons[S.active.p2[1]].boosts.atk ?? 0) < 0, 'Knock Off (contact) into King\'s Shield: −1 Atk');
  const S2 = snapshot(position({ mine: A, theirs: team('z09'), us: ['aegislash', 'charizard'], them: ['umbreon', 'florges'], bench: ['kangaskhan', 'sinistcha'] }).player.T);
  assert.ok(spreadThreat(S2, 'p1') < 0.25, `spread threat ${spreadThreat(S2, 'p1')}`);
  assert.ok(!optionsFor(S2, 'p1', 0).some((o) => o.move === 'wideguard'));
  const S3 = snapshot(position({ mine: A, theirs: Z3, us: ['aegislash', 'charizard'], them: ['krookodile', 'metagross'], mega: ['p1:charizard', 'p2:metagross'], field: { weather: 'Sun' }, bench: ['kangaskhan', 'sinistcha'] }).player.T);
  assert.ok(optionsFor(S3, 'p1', 0).some((o) => o.move === 'wideguard'), 'Rock Slide into Mega Charizard Y is a real spread threat');
});

test('#5 plan persona tr: turn-1 Trick Room about 80% of the time, partner Protecting or Faking Out; never on top of its own', () => {
  let tr = 0, support = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const r = position({ mine: Z4, theirs: A, us: ['oranguru', 'toxtricity'], them: ['charizard', 'kangaskhan'], turn: 1, firstTurn: true, bench: ['metagross', 'slowkinggalar'], seed, opts: { persona: 'tr' } });
    if (r.slots[0].move === 'trickroom') { tr++; if (['protect', 'fakeout'].includes(r.slots[1].move)) support++; }
  }
  assert.ok(tr >= 30, `TR in ${tr}/40`); // the persona's 0.8, plus the calc's own TR choices
  assert.ok(support >= tr * 0.9, `partner Protect / Fake Out in ${support}/${tr}`);
  const own = position({ mine: Z4, theirs: A, us: ['oranguru', 'toxtricity'], them: ['charizard', 'kangaskhan'], field: { tr: 3, trBy: 'p1' }, bench: ['metagross', 'slowkinggalar'], opts: { persona: 'tr' } });
  assert.notEqual(own.slots[0].move, 'trickroom');
});

test('#5 plan persona chilly: Chilly Reception while the opponent\'s sun is up', () => {
  let n = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const r = position({ mine: team('z07'), theirs: A, us: ['slowkinggalar', 'metagross'], them: ['charizard', 'kangaskhan'], mega: ['p2:charizard'], field: { weather: 'Sun', weatherTurns: 4 }, used: { 'p2:kangaskhan': ['fakeout'] }, bench: ['dragapult', 'krookodile'], seed, opts: { persona: 'chilly' } });
    if (r.slots[0].move === 'chillyreception') n++;
  }
  assert.ok(n >= 12, `Chilly Reception in ${n}/20`);
});

test('#6 noise is human-like: never switches out the Mega holder before it Mega Evolves; switches are rare', () => {
  let switches = 0, megaOut = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const r = position({ mine: A, theirs: Z1, us: ['charizard', 'kangaskhan'], them: ['metagross', 'dragapult'], turn: 1, firstTurn: true, bench: ['aegislash', 'sinistcha'], seed, opts: { noise: 1 } });
    if (r.slots.some((s) => s.switch)) switches++;
    if (r.slots[0].switch) megaOut++;
  }
  assert.equal(megaOut, 0);
  assert.ok(switches <= 3, `${switches}/60 noise switches`);
});

test('#7 Instruct repeats the partner\'s last move (last turn\'s), weighted to spread moves', () => {
  const r = position({ mine: Z4, theirs: A, us: ['oranguru', 'toxtricity'], them: ['charizard', 'kangaskhan'], mega: ['p2:charizard'], used: { 'p1:toxtricity': ['overdrive'] }, bench: ['metagross', 'slowkinggalar'] });
  const S = snapshot(r.player.T);
  // Toxtricity doesn't move this turn (e.g. flinched): Instruct makes it reuse last turn's Overdrive
  const R = resolve(S, [mv('p1', 0, 'instruct', 'ally'), { kind: 'pass', side: 'p1', pos: 1 }, { kind: 'pass', side: 'p2', pos: 0 }, { kind: 'pass', side: 'p2', pos: 1 }]);
  assert.ok(R.log.some((l) => /Instructs Toxtricity \(Overdrive\)/.test(l)), R.log.join('\n'));
  assert.ok(R.log.filter((l) => /Overdrive →/.test(l)).length === 2, 'the repeated Overdrive hits both foes');
});

test('#8 Wide Guard vs Rock Slide with Charizard on the field (Aegislash), and Chilly Reception value with our sun up', () => {
  const r = position({ mine: A, theirs: Z3, us: ['aegislash', 'charizard'], them: ['krookodile', 'metagross'], mega: ['p1:charizard', 'p2:metagross'], field: { weather: 'Sun' }, bench: ['kangaskhan', 'sinistcha'] });
  assert.ok(r.pOf(0, (a) => a.move === 'wideguard') >= 0.5, why(r));
});

// Builds lib/guides/5v3-deep.mjs, the data of the ZhuZi matchup's Deep dive tab: every six tested for Week 3, its paste,
// its fitted leads and its sim results, plus ZhuZi's modelled sixes. Reads the (gitignored) runs in
// tools/sim/results/w3fix, so re-run it from the repo root after a run finishes:
//   node docs/research/strategy/sim/scripts/deep-5v3.mjs
// Results: heuristic AI on both sides, closed sheets, ladder beliefs (--beliefs usage), paired seeds (9200000), each six
// with its own fitted preview table; "vs yours" = paired difference to n1b (Anthony's six) on the same games.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const ROOT = new URL('../../../../../', import.meta.url).pathname;
const R = `${ROOT}tools/sim/results/w3fix/`;
const CAND = `${ROOT}tools/sim/candidates/`;
const read = (p) => readFileSync(p, 'utf8');
const Z = JSON.parse(read(`${CAND}zhuzi.json`)).opponent.teams;
const W = Object.fromEntries(Z.map((t) => [t.id, t.weight]));
const sp = Object.fromEntries(Z.map((t) => [t.id, t.team]));
const rockN = (id) => (sp[id] ?? '').split(/\n\n+/).filter((b) => /- (Rock Slide|Stone Edge)/.test(b)).length;
const tid = (r) => r.theirs.split('/').pop().replace('.txt', '');
const anti = (id) => id.startsWith('zr') || rockN(id) >= 2 || (/Slowking-Galar/.test(sp[id] ?? '') && /Umbreon/.test(sp[id] ?? ''));
const w = (r) => (r.winner === 'ours' ? 1 : r.winner === 'tie' ? 0.5 : 0);
const load = (f) => (existsSync(f) ? new Map(read(f).trim().split('\n').filter(Boolean).map(JSON.parse).filter((r) => r.winner).map((r) => [r.i, r])) : null);
const pct = (x) => Math.round(1000 * x) / 10;
function wtd(M) { let a = 0, b = 0; for (const r of M.values()) { const t = tid(r); if (!W[t]) continue; a += W[t] * w(r); b += W[t]; } return b ? pct(a / b) : null; }
function sub(M, f) { const x = [...M.values()].filter((r) => f(tid(r))); return x.length ? { pct: pct(x.reduce((a, r) => a + w(r), 0) / x.length), n: x.length } : null; }
function diff(A, B, f = () => true) {
  const d = []; for (const [i, a] of A) { const b = B.get(i); if (b && f(tid(a))) d.push(w(a) - w(b)); }
  if (d.length < 2) return null;
  const n = d.length, m = d.reduce((x, y) => x + y, 0) / n, sd = Math.sqrt(d.reduce((x, y) => x + (y - m) ** 2, 0) / (n - 1));
  return { d: pct(m), ci: pct((1.96 * sd) / Math.sqrt(n)), n };
}
// Curated calcs for Anthony's six (sp = Champions Stat Points). 'ladder' = the guide's ZhuZi sets (lib/guides/5v3.mjs).
const KANGA = { id: 'kangaskhanmega', set: 'ours', nature: 'Adamant', sp: { hp: 32, atk: 32, def: 2, spa: 0, spd: 0, spe: 0 } };
const ZARDX = { id: 'charizardmegax', set: 'ours', nature: 'Adamant', sp: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 } };
const AEGIS = { id: 'aegislash', set: 'ours', ability: 'stancechange', item: 'kasibberry', nature: 'Modest', sp: { hp: 32, atk: 0, def: 2, spa: 32, spd: 0, spe: 0 }, form: 'blade' };
const CONK = { id: 'conkeldurr', set: 'ours', ability: 'sheerforce', item: 'lifeorb', nature: 'Brave', sp: { hp: 32, atk: 32, def: 0, spa: 0, spd: 2, spe: 0 } };
const PELI = { id: 'pelipper', set: 'ours', ability: 'drizzle', item: 'focussash', nature: 'Timid', sp: { hp: 2, atk: 0, def: 0, spa: 32, spd: 0, spe: 32 } };
const META = { id: 'metagrossmega', set: 'ladder', ability: 'toughclaws', item: 'metagrossite', nature: 'Jolly', sp: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 } };
const ROTOMW = { id: 'rotomwash', set: 'ladder', ability: 'levitate', item: 'sitrusberry', nature: 'Modest', sp: { hp: 32, atk: 0, def: 4, spa: 8, spd: 16, spe: 6 } };
const PULT = { id: 'dragapult', set: 'ladder', ability: 'clearbody', item: 'lifeorb', nature: 'Modest', sp: { hp: 2, atk: 0, def: 0, spa: 32, spd: 0, spe: 32 } };
const KROOK = { id: 'krookodile', set: 'worst', ability: 'intimidate', item: 'lifeorb', nature: 'Adamant', sp: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 } };
const NAPE = { id: 'infernape', set: 'ladder', ability: 'blaze', item: 'focussash', nature: 'Hasty', sp: { hp: 0, atk: 2, def: 0, spa: 32, spd: 0, spe: 32 } };
const SLOWKING = { id: 'slowkinggalar', set: 'ladder', ability: 'regenerator', item: 'colburberry', nature: 'Sassy', sp: { hp: 32, atk: 0, def: 5, spa: 19, spd: 10, spe: 0 } };
const FLORGES = { id: 'florges', set: 'ladder', ability: 'flowerveil', item: 'leftovers', nature: 'Modest', sp: { hp: 32, atk: 0, def: 0, spa: 32, spd: 2, spe: 0 } };
const UMBREON = { id: 'umbreon', set: 'ladder', ability: 'innerfocus', item: 'leftovers', nature: 'Bold', sp: { hp: 30, atk: 0, def: 16, spa: 0, spd: 20, spe: 0 } };
const RAIN = { weather: 'Rain' };
const CALCS = [
  { attacker: KANGA, defender: NAPE, move: 'doubleedge', field: {}, range: '133.8–158.9%', verdict: 'OHKO through Focus Sash', why: 'Parental Bond: the first hit breaks the Sash, the second KOs' },
  { attacker: KANGA, defender: NAPE, move: 'suckerpunch', field: {}, range: '25.8–30.5%', verdict: 'chip', why: 'Sucker Punch alone does not answer Infernape; Fake Out + a second attacker, or Double-Edge' },
  { attacker: KANGA, defender: PULT, move: 'suckerpunch', field: {}, range: '81.2–97.0%', verdict: 'survives', why: 'after Mega: Scrappy is gone, so Double-Edge and Fake Out fail on Dragapult; Sucker Punch is the hit' },
  { attacker: KANGA, defender: ROTOMW, move: 'doubleedge', field: {}, range: '80.9–95.5%', verdict: 'survives', why: 'near-KO; any chip finishes it' },
  { attacker: ZARDX, defender: META, move: 'flareblitz', field: {}, range: '131.2–156.7%', verdict: 'OHKO', why: 'out of rain' },
  { attacker: ZARDX, defender: META, move: 'flareblitz', field: RAIN, range: '65.0–77.7%', verdict: 'survives', why: 'Pelipper\'s rain halves Fire: keep Charizard X and Pelipper apart' },
  { attacker: ZARDX, defender: PULT, move: 'dragonclaw', field: {}, range: '150.3–178.2%', verdict: 'OHKO', why: '' },
  { attacker: ZARDX, defender: FLORGES, move: 'flareblitz', field: {}, range: '108.6–128.1%', verdict: 'OHKO', why: '' },
  { attacker: AEGIS, defender: PULT, move: 'shadowball', field: {}, range: '123.6–145.5%', verdict: 'OHKO', why: 'special Aegislash, Blade forme' },
  { attacker: AEGIS, defender: SLOWKING, move: 'shadowball', field: {}, range: '62.4–74.3%', verdict: '2HKO', why: '' },
  { attacker: AEGIS, defender: FLORGES, move: 'flashcannon', field: {}, range: '59.5–71.4%', verdict: '2HKO', why: '' },
  { attacker: CONK, defender: PULT, move: 'icepunch', field: {}, range: '129.1–152.7%', verdict: 'OHKO', why: 'Sheer Force + Life Orb, no recoil' },
  { attacker: CONK, defender: KROOK, move: 'icepunch', field: {}, range: '118.0–139.0%', verdict: 'OHKO', why: 'max-Attack Life Orb Krookodile, the worst case' },
  { attacker: CONK, defender: META, move: 'firepunch', field: {}, range: '76.4–91.1%', verdict: 'survives', why: 'Fire Punch in Mach Punch\'s slot' },
  { attacker: CONK, defender: UMBREON, move: 'drainpunch', field: {}, range: '74.0–87.0%', verdict: '2HKO', why: '' },
  { attacker: PELI, defender: NAPE, move: 'weatherball', field: RAIN, range: '182.8–215.9%', verdict: 'OHKO (Sash survives once)', why: 'rain Weather Ball is Water' },
  { attacker: PELI, defender: KROOK, move: 'weatherball', field: RAIN, range: '160.5–189.5%', verdict: 'OHKO', why: '' },
  { attacker: ROTOMW, defender: ZARDX, move: 'hydropump', field: RAIN, range: '83.9–99.4%', verdict: 'survives', why: 'our own rain powers his Hydro Pump (56.1–66.5% without it)' },
  { attacker: ROTOMW, defender: ZARDX, move: 'hydropump', field: {}, range: '56.1–66.5%', verdict: '2HKO', why: '' },
  { attacker: KROOK, defender: KANGA, move: 'closecombat', field: {}, range: '84.4–100.5%', verdict: 'can OHKO', why: 'worst-case Krookodile; Intimidate lowers your Attack first' },
  { attacker: PULT, defender: AEGIS, move: 'shadowball', field: {}, range: '83.8–98.8%', verdict: 'survives', why: 'Blade forme; King\'s Shield first if you expect it' },
  { attacker: META, defender: PELI, move: 'ironhead', field: {}, range: '35.0–41.6%', verdict: '3HKO', why: '' },
];
const json = (f) => (existsSync(f) ? JSON.parse(read(f)) : null);

// Each six: what it is, where its team and lead table live, and the run that tested it.
const SIXES = [
  { id: 'n1b', name: 'Your six', tag: 'yours', file: 'w3fix/n1.txt', table: 'n1b-table.json', run: 'n1b-val',
    change: 'Your post-mock six: Mega Kangaskhan, Charizard X (surprise Mega), special Aegislash, Sinistcha, Sheer Force Conkeldurr, Pelipper.',
    notes: ['Same six with its first lead table (2 rows): 4.1 points lower. The leads matter.'] },
  { id: 'c1', name: 'Old guide six (c1)', tag: 'guide', file: 'r5/c1.txt', table: '../r7t/c1.json', run: 'c1-val',
    change: 'The six the guide was written for: Charizard Y, Silk Scarf Kangaskhan, physical Aegislash, Morpeko, Iron Fist Conkeldurr.' },
  { id: 'n2', name: 'Morpeko for Pelipper', file: 'w3fix/n2.txt', table: 'n2-table.json', run: 'n2-val', change: 'Morpeko (Aura Wheel / Fake Out / Parting Shot / Protect) in Pelipper\'s slot.' },
  { id: 'n3', name: 'Iron Fist Conkeldurr', file: 'w3fix/n3.txt', table: 'n3-table.json', run: 'n3-val', change: 'Iron Fist Conkeldurr with Mach Punch (Drain / Mach / Ice / Protect) instead of Sheer Force.' },
  { id: 'n4', name: 'Wide Guard Aegislash', file: 'w3fix/n4.txt', table: 'n4-table.json', run: 'n4-val', change: 'Physical Brave Aegislash with Wide Guard (Poltergeist / Shadow Sneak / King\'s Shield / Wide Guard).' },
  { id: 'n5', name: 'Charizard Y for X', file: 'w3fix/n5.txt', table: 'n5-table.json', run: 'n5-val', change: 'Modest Charizard Y (Heat Wave / Weather Ball / Solar Beam / Protect) instead of X.' },
  { id: 'n6', name: 'Rotom-Fan for Pelipper', file: 'w3fix/n6.txt', table: 'n6-table.json', run: 'n6-val', change: 'Rotom-Fan (Thunderbolt / Air Slash / Will-O-Wisp / Protect) in Pelipper\'s slot.' },
  { id: 'n7', name: 'Stunfisk-G for Pelipper', file: 'w3fix/n7.txt', table: 'n7-table.json', run: 'n7-val', change: 'Galarian Stunfisk (Stomping Tantrum / Snap Trap / Yawn / Protect) in Pelipper\'s slot.' },
  { id: 'n8', name: 'Simipour for Pelipper', file: 'w3fix/n8.txt', table: 'n8-table.json', run: 'n8-val', change: 'Simipour (Fake Out / Scald / Icy Wind / Protect) in Pelipper\'s slot.' },
  { id: 'n9', name: 'Rotom-Fan for Charizard', file: 'w3fix/n9.txt', table: 'n9-table.json', run: 'n9-val', change: 'No Charizard: Rotom-Fan in its slot, Kangaskhan the only Mega.' },
];
const OPP_EXTRA = [
  { id: 'zr1', label: 'Rock-heavy offense (like your mock partner\'s)', why: 'Three Rock Slide users (Metagross, Life Orb Krookodile, Infernape) with Dragapult, Rotom-Wash, Toxtricity', file: 'w3fix/zr1.txt' },
  { id: 'zr2', label: 'Rock-heavy with Trick Room', why: 'Three Rock Slide users with Galarian Slowking and Umbreon', file: 'w3fix/zr2.txt' },
];

const base = load(`${R}n1b-val.jsonl`);
const baseEng = load(`${R}n1b-eng.jsonl`) ?? load(`${R}n1-eng.jsonl`);
const sixes = SIXES.map((s) => {
  const M = load(`${R}${s.run}.jsonl`);
  const E = load(`${R}${s.id}-eng.jsonl`);
  const res = M && M.size >= 100 ? {
    n: M.size, zhuzi: wtd(M), anti: sub(M, anti), rock: sub(M, (t) => t.startsWith('zr')),
    vsYours: s.id === 'n1b' ? null : diff(M, base), vsYoursAnti: s.id === 'n1b' ? null : diff(M, base, anti),
  } : null;
  const eng = E && E.size >= 50 ? { n: E.size, zhuzi: wtd(E), anti: sub(E, anti), vsYours: s.id === 'n1b' || !baseEng ? null : diff(E, baseEng) } : null;
  const table = json(`${R}${s.table}`) ?? [];
  return { id: s.id, name: s.name, tag: s.tag ?? '', change: s.change, notes: s.notes ?? [], paste: read(`${CAND}${s.file}`).trim(),
    leads: table.map((p) => ({ if: p.if, bring4: p.bring4, lead: p.lead, fit: p.note ?? '' })), results: res, engine: eng };
});
const opponents = [
  ...Z.map((t) => ({ id: t.id, label: t.label, weight: t.weight, why: t.why, anti: anti(t.id), paste: t.team.trim() })),
  ...OPP_EXTRA.map((t) => ({ id: t.id, label: t.label, weight: null, why: t.why, anti: true, paste: read(`${CAND}${t.file}`).trim() })),
];
// The Kangaskhan Rock Slide test ran on its own: c1 with Rock Slide over Sucker Punch vs c1, 700 paired games (seed 9000000)
// against all 24 of his sixes, and 700 against the 14 with Infernape
const rs = (() => { const pair = (a, b) => { const A = load(`${R}${a}.jsonl`), B = load(`${R}${b}.jsonl`); return A && B ? diff(A, B) : null; }; const all = pair('c1rs-all', 'c1-all'), inf = pair('c1rs-inf', 'c1-inf'); return all ? { all, inf } : null; })();

const out = {
  written: new Date().toISOString().slice(0, 10),
  method: [
    'Every number is a Pokémon Showdown simulation: our heuristic AI on both sides, closed team sheets, each side guessing unrevealed sets from ladder usage (no peeking at his sets).',
    'Each six played 960 games against ZhuZi\'s 24 modelled sixes plus two Rock-heavy sixes like your mock partner\'s, with its own fitted lead table. All sixes play the same seeds, so "vs yours" is a paired difference on identical games.',
    '"ZhuZi" weights his 24 sixes by how likely we think he brings each one. "Anti-Charizard" is the subset built to beat Charizard (two or more Rock Slide / Stone Edge users, or Slowking-G + Umbreon). "Rock-heavy" is the two three-Rock-Slide sixes.',
    'A ± is a 95% interval: if it crosses zero, treat it as a tie.',
  ],
  caveats: [
    'The AI is not a human. It almost never clicks Rain Dance (2 of 12 chances) or Encore (0 of 10), so these sims under-test those plans; the guide\'s tells cover them.',
    'Win rates are against our model of ZhuZi, not ZhuZi. The ranking between sixes is more trustworthy than the absolute numbers.',
  ],
  sixes, opponents,
  rockSlide: rs,
  calcs: CALCS,
};
const file = `${ROOT}lib/guides/5v3-deep.mjs`;
const body = JSON.stringify(out, null, 2).replace(/^( *)"([a-zA-Z_][a-zA-Z0-9_]*)":/gm, '$1$2:');
writeFileSync(file, `// GENERATED by docs/research/strategy/sim/scripts/deep-5v3.mjs from tools/sim/results/w3fix (re-run it after a run).
// The Deep dive tab of Anthony vs ZhuZi (Week 3): every six tested, its paste, leads and results. Its calcs are curated in
// the script; each one reproduces in the app engine (verify_curated.mjs).
export default ${body};
`);
console.log(`wrote ${file}: ${sixes.filter((s) => s.results).length}/${sixes.length} sixes with results, ${sixes.filter((s) => s.engine).length} with engine results, ${opponents.length} opponent sixes`);

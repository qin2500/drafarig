// League-wide teams for training and testing the engine, so it doesn't learn one opponent: for every coach's drafted
// roster (the cached sheet's Drafts tab) draw K sixes, each set drawn from the format's ladder usage (data/cache usage:
// abilities, items, moves, spreads), sampled among the common options so teams vary. Item clause respected; at most two
// Mega Stones. Deterministic per seed.
//   node tools/sim/league-teams.mjs [--per 8] [--seed 1]  → tools/sim/candidates/league/<seat>-<k>.txt + index.json
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { parseDraftsCsv } from '../../lib/sheet.mjs';
import { DEX, toID } from './ai/data.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i < 0 ? d : args[i + 1]; };
const PER = Number(opt('per', 8)), SEED = Number(opt('seed', 1));
const root = new URL('../../', import.meta.url);
const sheet = JSON.parse(readFileSync(new URL('data/cache/sheet-last-good.json', root), 'utf8'));
const usage = JSON.parse(readFileSync(new URL('data/cache/usage-gen9championsvgc2026regmc.json', root), 'utf8')).species;
const outDir = new URL('tools/sim/candidates/league/', root);
mkdirSync(outDir, { recursive: true });

let s = SEED >>> 0;
const r = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pickW = (list) => { const tot = list.reduce((a, [, w]) => a + w, 0); let u = r() * tot; for (const x of list) { u -= x[1]; if (u <= 0) return x[0]; } return list[0][0]; };

// sheet names → Showdown species ("Alolan Ninetales" → Ninetales-Alola, "Indeedee-female" → Indeedee-F)
function speciesOf(en) {
  let n = en.trim().replace(/-female$/i, '-F').replace(/-male$/i, '-M');
  const reg = n.match(/^(Alolan|Galarian|Hisuian|Paldean)\s+(.+)$/i);
  if (reg) n = `${reg[2]}-${{ alolan: 'Alola', galarian: 'Galar', hisuian: 'Hisui', paldean: 'Paldea' }[reg[1].toLowerCase()]}`;
  if (/^politoad$/i.test(n)) n = 'Politoed';
  const sp = DEX.species.get(n);
  return sp.exists ? sp : null;
}

function setFor(sp, usedItems, stones) {
  const u = usage[toID(sp.name)];
  if (!u) return null;
  const ability = u.abilities[0]?.[0];
  const items = u.items.filter(([it]) => DEX.items.get(it).exists && !usedItems.has(it) && !(DEX.items.get(it).megaStone && stones >= 2)).slice(0, 3);
  const item = items.length ? pickW(items) : '';
  const top = u.moves.slice(0, 6);
  const moves = [];
  while (moves.length < Math.min(4, top.length)) { const m = pickW(top.filter(([x]) => !moves.includes(x))); moves.push(m); }
  const spread = pickW(u.spreads.slice(0, 3));
  const [nature, sps] = spread.split(':');
  const [hp, atk, def, spa, spd, spe] = sps.split('/').map(Number);
  const evs = Object.entries({ HP: hp, Atk: atk, Def: def, SpA: spa, SpD: spd, Spe: spe }).filter(([, v]) => v).map(([k, v]) => `${v} ${k}`).join(' / ');
  return { item, text: `${sp.name}${item ? ` @ ${DEX.items.get(item).name}` : ''}\nAbility: ${DEX.abilities.get(ability).name}\nLevel: 50\nEVs: ${evs}\n${nature} Nature\n${moves.map((m) => `- ${DEX.moves.get(m).name}`).join('\n')}\n` };
}

const coaches = parseDraftsCsv(sheet.raw.draftsCsv);
const index = [];
for (const co of coaches) {
  const pool = co.picks.map((p) => speciesOf(p.en)).filter((sp) => sp && usage[toID(sp.name)]);
  if (pool.length < 6) { console.log(`skip ${co.name}: only ${pool.length} species with usage data`); continue; }
  for (let k = 0; k < PER; k++) {
    const six = [...pool].sort(() => r() - 0.5).slice(0, 6);
    const used = new Set(); let stones = 0; const sets = [];
    for (const sp of six) {
      const st = setFor(sp, used, stones);
      if (!st) continue;
      if (st.item) { used.add(toID(st.item)); if (DEX.items.get(st.item).megaStone) stones++; }
      sets.push(st.text);
    }
    if (sets.length < 6) continue;
    const id = `${co.order}-${k}`;
    writeFileSync(new URL(`${id}.txt`, outDir), sets.join('\n'));
    index.push({ id, seat: co.order, coach: co.name });
  }
}
writeFileSync(new URL('index.json', outDir), JSON.stringify({ seed: SEED, per: PER, written: new Date().toISOString(), teams: index }, null, 1));
console.log(`${index.length} teams from ${new Set(index.map((x) => x.seat)).size} coaches`);

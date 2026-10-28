// Gap check before Week 3 (2026-10-28): ZhuZi's modelled sixes with two legal moves none of them carried, so the sim can
// measure how c1 plays into them. Rain: Rotom-Wash Rain Dance (in rain its Hydro Pump OHKOs Mega Charizard Y, 108–128%)
// in place of Will-O-Wisp (else its last non-Protect move). Encore: one Encore user per six (Infernape, else Oranguru,
// else Toxtricity) in place of Protect (else its last move). Our side's closed-sheet beliefs stay the old candidate sets,
// so these come as a surprise, as they would in the match.
//   node tools/sim/candidates/zhuzi-gaps/build.mjs  → rain-zNN.txt, encore-zNN.txt, base-zNN.txt + index.json
import { writeFileSync, readFileSync } from 'node:fs';
import { PS } from '../../ai/data.mjs';

const CAND = JSON.parse(readFileSync(new URL('../zhuzi.json', import.meta.url), 'utf8'));
const v = PS.TeamValidator.get('gen9championsvgc2026regmc');
const dir = new URL('./', import.meta.url);
const swap = (s, move, prefer) => {
  if (s.moves.includes(move)) return false;
  let i = s.moves.indexOf(prefer);
  if (i < 0) i = s.moves.findLastIndex((m) => m !== 'Protect' && m !== 'Fake Out');
  s.moves[i] = move; return true;
};
const index = { rain: [], encore: [] };
const write = (id, team) => {
  const probs = v.validateTeam(team);
  if (probs?.length) throw new Error(`${id}: ${probs.join(' | ')}`);
  writeFileSync(new URL(`${id}.txt`, dir), PS.Teams.export(team));
};
for (const t of CAND.opponent.teams) {
  const base = PS.Teams.import(t.team);
  write(`base-${t.id}`, base);
  const rain = structuredClone(base), rw = rain.find((s) => s.species === 'Rotom-Wash');
  if (rw && swap(rw, 'Rain Dance', 'Will-O-Wisp')) { write(`rain-${t.id}`, rain); index.rain.push({ id: t.id, weight: t.weight, set: rw.moves.join(' / ') }); }
  const enc = structuredClone(base);
  const user = ['Infernape', 'Oranguru', 'Toxtricity'].map((n) => enc.find((s) => s.species === n)).find(Boolean);
  if (user && swap(user, 'Encore', 'Protect')) { write(`encore-${t.id}`, enc); index.encore.push({ id: t.id, weight: t.weight, mon: user.species, set: user.moves.join(' / ') }); }
}
writeFileSync(new URL('index.json', dir), JSON.stringify(index, null, 1));
console.log(`rain ${index.rain.length}, encore ${index.encore.length} (all pass the validator)`);

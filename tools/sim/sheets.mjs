// What each AI believes about the other side's sets (--sheets open|ots|closed). The battle always uses the real sets;
// only the AI's model of the opponent changes.
//   open:   the real sets (the default; what rounds 1-8 used).
//   ots:    real open team sheets: species, item, ability and moves are known; SP spread and nature are not, so a
//           generic spread is assumed (two or more attacks: 32 in the main attacking stat + 32 Speed, boosting nature;
//           otherwise 32 HP / 17 Def / 17 SpD, Bold or Calm).
//   closed: species only. ZhuZi's Pokémon get his most likely candidate set (summed team weight, zhuzi.json); ours get
//           the Week 1 six's set (a01, which he could have scouted), else the ots guess of our real set.
import { PS, moveOf, toID } from './ai/data.mjs';

const generic = (s) => {
  const hits = s.moves.map((m) => moveOf(toID(m))).filter((m) => m && m.category !== 'Status');
  if (hits.length >= 2) {
    const phys = hits.filter((m) => m.category === 'Physical').length >= hits.length / 2;
    return { ...s, nature: phys ? 'Adamant' : 'Modest', evs: { hp: 2, atk: phys ? 32 : 0, def: 0, spa: phys ? 0 : 32, spd: 0, spe: 32 } };
  }
  const phys = hits[0]?.category === 'Physical';
  return { ...s, nature: phys ? 'Impish' : 'Bold', evs: { hp: 32, atk: 0, def: 17, spa: 0, spd: 17, spe: 0 } };
};
const exportSets = (sets) => PS.Teams.export(sets);

/** species id -> the most likely set, from weighted team texts [{ text, weight }]. */
export function library(teams) {
  const tally = new Map();
  for (const { text, weight } of teams) for (const s of PS.Teams.import(text)) {
    const k = JSON.stringify(s), id = toID(s.species);
    const m = tally.get(id) ?? new Map(); m.set(k, (m.get(k) ?? 0) + (weight ?? 1)); tally.set(id, m);
  }
  return new Map([...tally].map(([id, m]) => [id, JSON.parse([...m].sort((a, b) => b[1] - a[1])[0][0])]));
}

/** The text an AI uses for the opponent's team. lib: species -> set (closed only). */
export function beliefText(text, mode, lib) {
  if (!mode || mode === 'open') return text;
  const sets = PS.Teams.import(text);
  if (mode === 'ots') return exportSets(sets.map(generic));
  if (mode === 'closed') return exportSets(sets.map((s) => { const b = lib?.get(toID(s.species)); return b ? { ...b, name: s.name } : generic(s); }));
  throw new Error(`unknown --sheets ${mode}`);
}

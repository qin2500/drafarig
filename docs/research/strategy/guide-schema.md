# Matchup guide schema (v1)

A matchup guide is curated, matchup-specific advice that the app injects into its existing screens for one matchup. One file per matchup: `lib/guides/<pov>v<opp>.mjs` (pov/opp = sheet seats), exporting `default` as below. Plain data, no code. Every number must come from the app engine or `spcalc.py` (state which), and every opposing set must state whether it is a ladder set or a learnset worst case.

```js
export default {
  version: 1, pov: 5, opp: 3, coach: 'ZhuZi', week: 3, written: '2026-10-19',
  rosters: { ours: [ids], theirs: [ids] },  // sheet rosters when written (exact stale detection)
  assumptions: ['…'],                       // short lines, shown under the guide header
  remember: ['…', '…'],                     // 3–6 must-remember rules (Brief top card)
  bring: { six: ['charizard', …], bench: [{ id, why }], mega: { id, why } },
  previews: [{ if: 'their 6 includes …', bring4: [ids], lead: [id, id], note }],
  leads: [{ ours: [id, id], vs: [id, id], t1: '…', t2: '…', t3: '…', ifs: ['if he X → Y'] }],
  tells: [{ see: '…', means: '…', do: '…' }],
  lose: [{ how: '…', fix: '…' }],          // ways we lose
  endgame: ['…'],
  combos: { theirs: [{ attackers: [[id, move], [id, move]], into: id, range: 'a–b%', answer: '…' }],
            ours:   [{ attackers: [[id, move], [id, move]], into: id, range: 'a–b%', verdict: 'KO|maybe' }] },
  calcs: [{ attacker: { id, set: 'ours'|'ladder'|'worst' , ability?, item?, nature?, sp? }, defender: { … }, move, field: { weather?, screens?, intimidate? }, range: 'a–b%', verdict: '…', why: '…' }],
  perMon: { '<theirId>': { role: '…', worstCase: '…', answer: '…', notes: ['…'] },
            '<ourId>':   { job: '…', avoid: '…', notes: ['…'] } },
  sets: '<Showdown export text for the recommended 6, Champions SP on the EVs line>',
};
```

Where it shows (the UI UX spec decides the exact placement):
- Brief: a "Game plan vs <coach>" card first (remember, bring, preview table, leads), with folded sections for tells, combos, ways we lose, endgame.
- Brief pool cards and detail sheets: perMon notes for their mon.
- Teambuilder (editing one of ours with this opponent in scope): perMon notes for our mon, plus that mon's calcs.
- Calcs listed in the guide open in the workbench with the stated sets and field.
- Teams: "Import recommended team" makes a team named "vs <coach> (guide)" from `sets`, in one tap.
- Plan board: optional pre-fill from `leads`.

# Matchup guide schema (v2)

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

  // ---- v2 (all optional; a v1 guide stays valid and renders without them) ----
  overview: {                               // section 1 of the Guide tab: his team
    archetype: 'one line',                  // also leads the Brief card
    summary: ['paragraph', '…'],
    roster: [{ id, role: '…', tier: 'core'|'likely'|'fringe' }],   // another tier reads as 'likely'
    likely: [{ label: '…', ids: [6 ids], share?: 'about 40%', note?: '…' }],
  },
  threats: [{ id, title: '…', why: '…', answer: '…', calc?: <index into calcs> }],  // ranked; the top 3 titles are on the Brief card
  team: {                                   // section 3: our team and why
    summary: ['paragraph', '…'], evidence?: 'one line of sim evidence',
    members: [{ id, role: '…', why: '…', spread?: 'SP benchmarks' }],  // its set is shown from `sets`; without members, bring.six + perMon job
  },
};
```

`version` is 1 or 2 (2 when a guide uses the v2 fields). Validation is tolerant: a malformed roster / likely / threat /
member entry is dropped and reported; an empty overview or team reads as absent. `threats[].calc` indexes the raw `calcs`
array as written; when an earlier calc is dropped the index is remapped, and a threat whose calc was dropped keeps its
text without the link. Every "a–b%" in any text field links to the guide calc stating exactly that range (else it is
marked unchecked), so write ranges as the calcs state them.

Where it shows (the UI UX spec decides the exact placement):
- Guide tab (`#prep/<pov>v<opp>/guide`, public/prep-guide-page.js), the full read, in order with a table of contents: 1) his team (overview), 2) threats (each with its calc as a workbench link), 3) our team and why (team, each member's set from `sets`, the Mega and bench reasons from `bring`, Import as team), 4) team preview and leads (`previews`, `leads`), 5) matchup notes (perMon for his mons), 6) in the game (tells, ways we lose, endgame, both sides' combos), 7) assumptions (plus a Deep dive link when there is one).
- Brief: a "Game plan vs <coach>" card first, the short version: archetype, top 3 threats, the six (Mega, bench, Import), "Read the full guide", remember, the preview chips. (A mock's game plan has no Guide tab and keeps the folded sections on the card.)
- Brief pool cards and detail sheets: perMon notes for their mon.
- Teambuilder (editing one of ours with this opponent in scope): perMon notes for our mon, plus that mon's calcs.
- Calcs listed in the guide open in the workbench with the stated sets and field.
- Teams: "Import recommended team" makes a team named "vs <coach> (guide)" from `sets`, in one tap.
- Plan board: optional pre-fill from `leads`.

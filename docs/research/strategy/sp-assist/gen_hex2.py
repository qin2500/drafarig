"""Week 4 vs Hex, round 2 (2026-11-05), after the mock with Calvin: s119 (Simipour + Stunfisk-Galar) had no answer to
Kleavor + Rotom-Heat. Anthony's rules for this round:
  - no Simipour or Stunfisk-Galar (stats too low in real play) unless we cannot win without them;
  - Mega Kangaskhan is the main Mega ("another mega-Kanga game"); Charizard is still good but needs speed support,
    and must not switch in under Kleavor's Stone Axe rocks;
  - his team is weak to offensive Pelipper (Water hits Rotom-Heat, Kleavor and Armarouge for 2x): Tailwind, with
    Rage Powder (Sinistcha) beside it, then sweep in rain;
  - don't over-correct: the Indeedee-F + Armarouge Psychic spam is still his strongest plan.
Every six of the eight allowed (Charizard, Sinistcha, Pelipper, Kangaskhan, Aegislash, Morpeko, Conkeldurr, Rotom-Fan)
in three set packages: A = the new answers (Tailwind attacker Pelipper, Rock Slide Mega Kangaskhan, Iron Head Aegislash,
Guts Conkeldurr, Electroweb Morpeko / Rotom-Fan), B = the Week 3 sets with Mega Kangaskhan and Wide Guard Pelipper,
C = A with Choice Scarf Pelipper (Champions has no Specs / Flame Orb). Charizard + Kangaskhan sixes hold both stones (one Mega per battle, chosen in game).
Opponent: hexpov.json's (h01-h20 weighted, p001-p210 at weight 0). Writes tools/sim/candidates/hex2.json."""
import json, os
from itertools import combinations
from gen_candidates import S, build, ROOT
from gen_hex import A, AT, PERSONAS, ROWS
from gen_hexpov import H, PT, HT, PP

A2 = {
    **A,
    'pel_tw_off': S('Pelipper', 'pelipper', 'Mystic Water', 'Drizzle', 'Modest', [2, 0, 0, 32, 0, 32], ['Hurricane', 'Weather Ball', 'Tailwind', 'Protect'], 'Tailwind then sweep; Water 2x into Rotom-Heat, Kleavor, Armarouge'),
    'pel_scarf': S('Pelipper', 'pelipper', 'Choice Scarf', 'Drizzle', 'Modest', [2, 0, 0, 32, 0, 32], ['Hurricane', 'Weather Ball', 'Hydro Pump', 'U-turn'], 'Scarf rain attacker: fast without Tailwind (no Choice Specs in Champions)'),
    'kangaM_rs': S('Kangaskhan', 'kangaskhan', 'Kangaskhanite', 'Scrappy', 'Adamant', [32, 32, 2, 0, 0, 0], ['Fake Out', 'Double-Edge', 'Rock Slide', 'Protect'], 'Rock Slide 2x into Rotom-Heat; Parental Bond breaks Sash'),
    'aegis_ih': S('Aegislash', 'aegislash', 'Kasib Berry', 'Stance Change', 'Brave', [32, 32, 2, 0, 0, 0], ['Poltergeist', 'Iron Head', "King's Shield", 'Wide Guard'], 'Walls Kleavor (resists Bug/Rock, immune to Close Combat); Iron Head 2x'),
    'conk_guts': S('Conkeldurr', 'conkeldurr', 'Life Orb', 'Guts', 'Brave', [32, 32, 0, 0, 2, 0], ['Drain Punch', 'Mach Punch', 'Rock Slide', 'Protect'], 'Guts: Will-O-Wisp powers it (no Flame Orb in Champions); Rock Slide 2x into Rotom-Heat'),
    'morpeko_web': S('Morpeko', 'morpeko', 'Focus Sash', 'Hunger Switch', 'Jolly', [2, 32, 0, 0, 0, 32], ['Fake Out', 'Aura Wheel', 'Electroweb', 'Protect'], 'Fake Out + Electroweb speed control'),
    'sinis_hp': S('Sinistcha', 'sinistcha', 'Sitrus Berry', 'Heatproof', 'Bold', [32, 0, 14, 0, 20, 0], ['Matcha Gotcha', 'Rage Powder', 'Trick Room', 'Life Dew'], 'Heatproof: halves Rotom-Heat / Armarouge Fire'),
    'rotom_web': S('Rotom-Fan', 'rotomfan', 'Expert Belt', 'Levitate', 'Modest', [32, 0, 0, 32, 2, 0], ['Electroweb', 'Thunderbolt', 'Air Slash', 'Protect'], 'Electroweb speed control'),
}
EIGHT = ['charizard', 'sinistcha', 'pelipper', 'kangaskhan', 'aegislash', 'morpeko', 'conkeldurr', 'rotomfan']
NAME = {'charizard': 'Charizard', 'sinistcha': 'Sinistcha', 'pelipper': 'Pelipper', 'kangaskhan': 'Mega Kangaskhan',
        'aegislash': 'Aegislash', 'morpeko': 'Morpeko', 'conkeldurr': 'Conkeldurr', 'rotomfan': 'Rotom-Fan'}
PKG = {
    'A': {'charizard': 'zardY', 'sinistcha': 'sinis', 'pelipper': 'pel_tw_off', 'kangaskhan': 'kangaM_rs', 'aegislash': 'aegis_ih',
          'morpeko': 'morpeko_web', 'conkeldurr': 'conk_guts', 'rotomfan': 'rotom_web'},
    'B': {'charizard': 'zardY', 'sinistcha': 'sinis', 'pelipper': 'pelipper', 'kangaskhan': 'kangaM', 'aegislash': 'aegis',
          'morpeko': 'morpeko', 'conkeldurr': 'conk', 'rotomfan': 'rotom'},
}
PKG['C'] = {**PKG['A'], 'pelipper': 'pel_scarf'}

NT = []
for pk, m in PKG.items():
    for n, six in enumerate(combinations(EIGHT, 6), 1):
        NT.append((f'n{pk}{n:02d}', '+'.join(NAME[s] for s in six) + f' [{pk}]', 1, [m[s] for s in six], f'package {pk}'))

# variants of the engine's top sixes (2026-11-05): Heatproof Sinistcha in nC04
NT.append(('nC04h', 'nC04 with Heatproof Sinistcha', 1, ['zardY', 'sinis_hp', 'pel_scarf', 'kangaM_rs', 'morpeko_web', 'conk_guts'], 'variant'))

if __name__ == '__main__':
    ht, he = build(H, PT + HT, 'hex')
    # o01 (his Week 3 six) stays as the closed-sheet beliefRef: what Hex expects our sets to be
    at, ae = build(A2, NT + [t for t in AT if t[0] == 'o01'], 'anthony')
    for tid_, p in he + ae:
        print('PROBLEM', tid_, p)
    dst = os.path.join(ROOT, 'tools', 'sim', 'candidates')
    json.dump({'version': 1, 'written': '2026-11-05', 'format': 'gen9championsvgc2026regmc', 'level': 50,
               'notes': 'Hex round 2: every six of the 8 allowed mons x 3 set packages (gen_hex2.py) vs hexpov opponent.',
               'opponent': {'coach': 'Hex', 'seat': 1, 'teams': ht, 'personas': {**PERSONAS, **PP}, 'rows': ROWS},
               'ours': {'coach': 'Anthony', 'seat': 5, 'teams': at, 'beliefRef': 'o01'}}, open(os.path.join(dst, 'hex2.json'), 'w'), indent=1)
    print(len(ht), 'Hex teams,', len(at), 'Anthony teams; problems:', len(he) + len(ae))

"""Week 5 vs Jacky (seat 4), round 1 (2026-11-06). Writes tools/sim/candidates/jacky.json.
Jacky drafted (points): Golisopod 20, Incineroar 19, Farigiraf 16, Torkoal 16, Rotom-Mow 11, Mimikyu 11, Mr. Rime 3,
Rotom 2, Appletun 1, Lycanroc-Midnight 1. Only Mega: Golisopod (Golisopite: Bug/Steel, Tough Claws, 150 Atk / 175 Def).
Archetype (our Week 2 mock of his side, lib/mocks/4v8.mjs, and ladder teammates): Trick Room (Farigiraf, Mr. Rime,
Mimikyu) with Torkoal sun Eruption, Mega Golisopod and Incineroar Fake Out / Intimidate / Parting Shot.
Threat scan: sp-assist/jacky_scan.py -> jacky-scan.json.

Anthony's rules carried over from Week 4 (feedback-no-low-stat-picks): no Simipour / Stunfisk-Galar unless we cannot win
without them, so our pool is every six of the other eight in two set packages:
  J = answers to this roster (Wide Guard Aegislash and Pelipper vs Eruption / Rock Slide, Taunt Morpeko vs his Trick Room
      setters, Sinistcha Trick Room to undo his, Iron Fist Ice Punch Conkeldurr, Sucker Punch Mega Kangaskhan);
  K = the Hex round-2 sets (Scarf Pelipper, Rock Slide Mega Kangaskhan, Guts Conkeldurr, Electroweb Morpeko / Rotom-Fan).
His side: weighted judgement sixes j01-j16 plus every six of his ten with default sets (q001-q210, weight 0) for the
best-response pass (playbook 2026-11-04: always build the opponent's best response, then ours)."""
import json, os
from itertools import combinations
from gen_candidates import S, build, ROOT
from gen_hex import A
from gen_hex2 import A2

# ---------------- Jacky set library ----------------
# L = Smogon Reg M-C ladder (data/cache usage) modal; W = worst case / anti-Anthony (jacky-scan.json); H = human / mock.
J = {
    # Incineroar: Fake Out 99%, Parting Shot 96%, Flare Blitz 91%, Sitrus 63%
    'incin': S('Incineroar', 'incineroar', 'Sitrus Berry', 'Intimidate', 'Careful', [32, 0, 14, 0, 20, 0], ['Fake Out', 'Parting Shot', 'Flare Blitz', 'Throat Chop'], 'L: modal'),
    'incin_chople': S('Incineroar', 'incineroar', 'Chople Berry', 'Intimidate', 'Careful', [32, 0, 14, 0, 20, 0], ['Fake Out', 'Parting Shot', 'Flare Blitz', 'Throat Chop'], 'H/W: our Week 2 mock set; Chople vs Conkeldurr / Mega Kangaskhan'),
    'incin_lariat': S('Incineroar', 'incineroar', 'Sitrus Berry', 'Intimidate', 'Adamant', [32, 32, 0, 0, 2, 0], ['Fake Out', 'Flare Blitz', 'Darkest Lariat', 'Protect'], 'L: Adamant attacker (Lariat 31%)'),
    # Golisopod: Mega (Bug/Steel, Tough Claws) modal Leech Life / Iron Head / Protect / Swords Dance
    'goliM': S('Golisopod', 'golisopod', 'Golisopite', 'Emergency Exit', 'Adamant', [32, 32, 0, 0, 2, 0], ['Leech Life', 'Iron Head', 'Swords Dance', 'Protect'], 'L: Mega modal'),
    'goliM_fi': S('Golisopod', 'golisopod', 'Golisopite', 'Emergency Exit', 'Brave', [32, 32, 0, 0, 2, 0], ['First Impression', 'Iron Head', 'Liquidation', 'Protect'], 'H/W: mock set; Liquidation into Charizard / Torkoal-free sun'),
    'goliM_sp': S('Golisopod', 'golisopod', 'Golisopite', 'Emergency Exit', 'Brave', [32, 32, 0, 0, 2, 0], ['Leech Life', 'Iron Head', 'Sucker Punch', 'Protect'], 'L: Sucker Punch 27%, Brave TR spread'),
    # Farigiraf: Armor Tail blocks our priority (Fake Out, Mach Punch, Sucker Punch) into his side
    'fari': S('Farigiraf', 'farigiraf', 'Sitrus Berry', 'Armor Tail', 'Bold', [27, 0, 20, 0, 19, 0], ['Trick Room', 'Psychic', 'Helping Hand', 'Protect'], 'L: modal'),
    'fari_tb': S('Farigiraf', 'farigiraf', 'Sitrus Berry', 'Armor Tail', 'Sassy', [32, 0, 0, 2, 32, 0], ['Trick Room', 'Psychic', 'Thunderbolt', 'Protect'], 'L/W: Thunderbolt 40% (4x Pelipper)'),
    'fari_colbur': S('Farigiraf', 'farigiraf', 'Colbur Berry', 'Armor Tail', 'Bold', [27, 0, 20, 0, 19, 0], ['Trick Room', 'Psychic', 'Helping Hand', 'Protect'], 'L: Colbur 16% (vs Morpeko Aura Wheel)'),
    # Torkoal: Drought Eruption
    'tork': S('Torkoal', 'torkoal', 'Charcoal', 'Drought', 'Quiet', [32, 0, 0, 32, 2, 0], ['Eruption', 'Weather Ball', 'Earth Power', 'Protect'], 'L: modal'),
    'tork_hh': S('Torkoal', 'torkoal', 'Charcoal', 'Drought', 'Quiet', [32, 0, 0, 32, 2, 0], ['Eruption', 'Heat Wave', 'Helping Hand', 'Protect'], 'L: Heat Wave 38%, Helping Hand 28%'),
    'tork_sb': S('Torkoal', 'torkoal', 'Charcoal', 'Drought', 'Quiet', [32, 0, 0, 32, 2, 0], ['Eruption', 'Weather Ball', 'Solar Beam', 'Protect'], 'W: Solar Beam into Pelipper rain answers'),
    # Rotom-Mow: Scarf 81%
    'mow': S('Rotom-Mow', 'rotommow', 'Choice Scarf', 'Levitate', 'Timid', [2, 0, 0, 32, 0, 32], ['Leaf Storm', 'Thunderbolt', 'Volt Switch', 'Electroweb'], 'L: Scarf modal'),
    'mow_wisp': S('Rotom-Mow', 'rotommow', 'Sitrus Berry', 'Levitate', 'Modest', [32, 0, 0, 32, 2, 0], ['Leaf Storm', 'Thunderbolt', 'Will-O-Wisp', 'Protect'], 'L: Sitrus 13%, Wisp 13% (vs Kangaskhan / Conkeldurr)'),
    # Mimikyu: Disguise; Trick Room 46%
    'mimi': S('Mimikyu', 'mimikyu', 'Life Orb', 'Disguise', 'Adamant', [2, 32, 0, 0, 0, 32], ['Play Rough', 'Shadow Sneak', 'Shadow Claw', 'Protect'], 'L: Life Orb attacker'),
    'mimi_tr': S('Mimikyu', 'mimikyu', 'Mental Herb', 'Disguise', 'Brave', [32, 32, 2, 0, 0, 0], ['Trick Room', 'Play Rough', 'Shadow Sneak', 'Will-O-Wisp'], 'L: TR setter (Mental Herb 14%, Wisp 20%)'),
    # Mr. Rime: Fake Out + Trick Room
    'rime': S('Mr. Rime', 'mrrime', 'Twisted Spoon', 'Screen Cleaner', 'Quiet', [32, 0, 2, 32, 0, 0], ['Fake Out', 'Trick Room', 'Freeze-Dry', 'Psychic'], 'L/H: modal + mock'),
    # Rotom (base): Electric/Ghost
    'rotomb': S('Rotom', 'rotom', 'Sitrus Berry', 'Levitate', 'Modest', [32, 0, 0, 32, 2, 0], ['Thunderbolt', 'Shadow Ball', 'Will-O-Wisp', 'Protect'], 'H: no ladder data; Wisp + coverage'),
    # Appletun: Thick Fat halves our Fire
    'apple': S('Appletun', 'appletun', 'Sitrus Berry', 'Thick Fat', 'Quiet', [32, 0, 0, 32, 2, 0], ['Apple Acid', 'Draco Meteor', 'Recover', 'Protect'], 'H: no ladder data; Thick Fat vs Charizard'),
    # Lycanroc-Midnight: No Guard Rock Slide (never misses) into Charizard
    'lyc': S('Lycanroc-Midnight', 'lycanrocmidnight', 'Life Orb', 'No Guard', 'Brave', [32, 32, 2, 0, 0, 0], ['Rock Slide', 'Stone Edge', 'Close Combat', 'Protect'], 'H/W: mock set, TR attacker'),
    'lyc_fast': S('Lycanroc-Midnight', 'lycanrocmidnight', 'Focus Sash', 'No Guard', 'Jolly', [2, 32, 0, 0, 0, 32], ['Rock Slide', 'Close Combat', 'Sucker Punch', 'Protect'], 'W: fast No Guard Rock Slide vs Charizard'),
}

# ---------------- Jacky teams (weights: judgement) ----------------
# His six most expensive picks (Golisopod, Incineroar, Farigiraf, Torkoal, Rotom-Mow, Mimikyu = 93 of 100 points) are the
# core; Mr. Rime is a second Trick Room + Fake Out at 3 points and was in our mock six; Lycanroc-Midnight is the anti-
# Charizard Rock Slide pick (Charizard Y is his obvious target: Anthony brought it every week).
JT = [
    ('j01', 'Core six (his six biggest picks)', 0.14, ['goliM', 'incin', 'fari', 'tork', 'mow', 'mimi_tr'], 'Most likely single six'),
    ('j02', 'Core, Mr. Rime for Mimikyu', 0.10, ['goliM', 'incin', 'fari', 'tork', 'mow', 'rime'], 'Two Trick Rooms + two Fake Outs'),
    ('j03', 'Our Week 2 mock six', 0.08, ['goliM_fi', 'incin_chople', 'fari', 'tork', 'rime', 'lyc'], 'The six we built for his side vs Calvin'),
    ('j04', 'Core, Lycanroc for Rotom-Mow', 0.08, ['goliM', 'incin', 'fari', 'tork', 'mimi_tr', 'lyc'], 'Anti-Charizard No Guard Rock Slide'),
    ('j05', 'Core, Mr. Rime for Rotom-Mow', 0.07, ['goliM', 'incin', 'fari', 'tork', 'mimi_tr', 'rime'], 'Three Trick Room setters'),
    ('j06', 'Hard Trick Room + Lycanroc', 0.06, ['goliM_sp', 'incin', 'fari', 'tork', 'rime', 'lyc'], 'Slow mode: Brave Golisopod, Brave Lycanroc'),
    ('j07', 'Anti-Anthony: Chople, Wisp, Thunderbolt', 0.06, ['goliM', 'incin_chople', 'fari_tb', 'tork', 'mow_wisp', 'lyc_fast'], 'Wisp for Kangaskhan / Conkeldurr, Thunderbolt for Pelipper, Rock Slide for Charizard'),
    ('j08', 'Fast mode: Scarf Mow + Life Orb Mimikyu', 0.05, ['goliM', 'incin_lariat', 'fari', 'tork', 'mow', 'mimi'], 'Less Trick Room, more pressure'),
    ('j09', 'Core with Heat Wave / Helping Hand Torkoal', 0.05, ['goliM', 'incin', 'fari', 'tork_hh', 'mow', 'mimi_tr'], 'Ladder Torkoal variant'),
    ('j10', 'Appletun (Thick Fat) for Mimikyu', 0.04, ['goliM', 'incin', 'fari', 'tork', 'mow', 'apple'], 'Fire answer vs Charizard'),
    ('j11', 'Rotom (Wisp) for Mimikyu', 0.04, ['goliM', 'incin', 'fari', 'tork', 'mow', 'rotomb'], 'Comfort cheap pick'),
    ('j12', 'No Torkoal: Trick Room bruisers', 0.05, ['goliM_sp', 'incin', 'fari_colbur', 'mimi_tr', 'rime', 'lyc'], 'Leaves sun home (our Charizard benefits from his sun)'),
    ('j13', 'Solar Beam Torkoal vs rain', 0.04, ['goliM', 'incin', 'fari_tb', 'tork_sb', 'mow', 'mimi_tr'], 'Answers Pelipper'),
    ('j14', 'Colbur Farigiraf + Wisp Mow', 0.04, ['goliM', 'incin', 'fari_colbur', 'tork', 'mow_wisp', 'rime'], 'Anti-Morpeko / anti-physical'),
    ('j15', 'Lycanroc + Mr. Rime, no Mimikyu / Mow', 0.03, ['goliM_fi', 'incin', 'fari', 'tork', 'rime', 'lyc'], 'Mock six with standard Incineroar'),
    ('j16', 'Rotom + Appletun cheap picks', 0.03, ['goliM', 'incin', 'fari', 'tork', 'rotomb', 'apple'], 'Low-cost comfort picks'),
]
TEN = ['goliM', 'incin', 'fari', 'tork', 'mow', 'mimi_tr', 'rime', 'rotomb', 'apple', 'lyc']
QT = [(f'q{n:03d}', '+'.join(J[k]['name'] for k in six), 0, list(six), 'every-six screen') for n, six in enumerate(combinations(TEN, 6), 1)]

PERSONAS = {**{t: ['tr', 0.6] for t in ['j02', 'j05', 'j06', 'j12', 'j15']},
            **{t: ['tr', 0.3] for t in ['j01', 'j03', 'j04', 'j09', 'j10', 'j11', 'j13', 'j14', 'j16']},
            **{t: ['rock', 0.6] for t in ['j04', 'j07']}}
ROWS = [
    {'if': 'their 6 includes Torkoal + Farigiraf + Mr. Rime', 'need': ['torkoal', 'farigiraf', 'mrrime']},
    {'if': 'their 6 includes Torkoal + Farigiraf + Lycanroc-Midnight', 'need': ['torkoal', 'farigiraf', 'lycanrocmidnight']},
    {'if': 'their 6 includes Torkoal + Farigiraf', 'need': ['torkoal', 'farigiraf']},
    {'if': 'their 6 has no Torkoal', 'need': []},
]

# ---------------- Anthony: every six of the eight allowed, two packages ----------------
A3 = {
    **A2,
    'aegis_wg': S('Aegislash', 'aegislash', 'Kasib Berry', 'Stance Change', 'Brave', [32, 32, 2, 0, 0, 0], ['Poltergeist', 'Iron Head', "King's Shield", 'Wide Guard'], 'Wide Guard vs Eruption / Rock Slide / Electroweb; Iron Head into Mimikyu / Mr. Rime'),
    'morpeko_taunt': S('Morpeko', 'morpeko', 'Focus Sash', 'Hunger Switch', 'Jolly', [2, 32, 0, 0, 0, 32], ['Fake Out', 'Aura Wheel', 'Taunt', 'Protect'], 'Taunt his Trick Room setters; Dark into Farigiraf / Mr. Rime'),
    'kangaM_sp': S('Kangaskhan', 'kangaskhan', 'Kangaskhanite', 'Scrappy', 'Adamant', [32, 32, 2, 0, 0, 0], ['Fake Out', 'Double-Edge', 'Sucker Punch', 'Protect'], 'Sucker Punch moves first under Trick Room'),
    'pel_wg': S('Pelipper', 'pelipper', 'Focus Sash', 'Drizzle', 'Modest', [2, 0, 0, 32, 0, 32], ['Hurricane', 'Weather Ball', 'Tailwind', 'Wide Guard'], 'Rain halves his Fire; Wide Guard vs Eruption'),
}
EIGHT = ['charizard', 'sinistcha', 'pelipper', 'kangaskhan', 'aegislash', 'morpeko', 'conkeldurr', 'rotomfan']
NAME = {'charizard': 'Charizard', 'sinistcha': 'Sinistcha', 'pelipper': 'Pelipper', 'kangaskhan': 'Mega Kangaskhan',
        'aegislash': 'Aegislash', 'morpeko': 'Morpeko', 'conkeldurr': 'Conkeldurr', 'rotomfan': 'Rotom-Fan'}
PKG = {
    'J': {'charizard': 'zardY', 'sinistcha': 'sinis', 'pelipper': 'pel_wg', 'kangaskhan': 'kangaM_sp', 'aegislash': 'aegis_wg',
          'morpeko': 'morpeko_taunt', 'conkeldurr': 'conk', 'rotomfan': 'rotom_web'},
    'K': {'charizard': 'zardY', 'sinistcha': 'sinis', 'pelipper': 'pel_scarf', 'kangaskhan': 'kangaM_rs', 'aegislash': 'aegis_ih',
          'morpeko': 'morpeko_web', 'conkeldurr': 'conk_guts', 'rotomfan': 'rotom_web'},
}
NT = []
for pk, m in PKG.items():
    for n, six in enumerate(combinations(EIGHT, 6), 1):
        NT.append((f'y{pk}{n:02d}', '+'.join(NAME[s] for s in six) + f' [{pk}]', 1, [m[s] for s in six], f'package {pk}'))
# closed-sheet belief of our sets (what Jacky expects): Hex round-2 six nC19 with the common Iron Fist Conkeldurr
BELIEF = ('b01', 'belief: our last six (nC19 shape, ladder Conkeldurr)', 0, ['zardY', 'pel_scarf', 'kangaM_rs', 'morpeko_web', 'conk', 'rotom_web'], 'beliefRef')

if __name__ == '__main__':
    jt, je = build(J, JT + QT, 'jacky')
    at, ae = build(A3, NT + [BELIEF], 'anthony')
    for tid_, p in je + ae:
        print('PROBLEM', tid_, p)
    dst = os.path.join(ROOT, 'tools', 'sim', 'candidates')
    json.dump({'version': 1, 'written': '2026-11-06', 'format': 'gen9championsvgc2026regmc', 'level': 50,
               'notes': 'Week 5 vs Jacky round 1 (gen_jacky.py): every six of the 8 allowed mons x 2 set packages vs his weighted sixes + every-six screen.',
               'opponent': {'coach': 'Jacky', 'seat': 4, 'teams': jt, 'personas': PERSONAS, 'rows': ROWS},
               'ours': {'coach': 'Anthony', 'seat': 5, 'teams': at, 'beliefRef': 'b01'}}, open(os.path.join(dst, 'jacky.json'), 'w'), indent=1)
    print(len(jt), 'Jacky teams,', len(at), 'Anthony teams; problems:', len(je) + len(ae))

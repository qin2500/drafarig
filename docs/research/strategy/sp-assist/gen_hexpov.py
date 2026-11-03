"""Week 4 vs Hex, from HEX's side: every six of his 10 (p001-p210) plus the hand-modelled h01-h20, against our sixes.
Writes tools/sim/candidates/hexpov.json. Same set library as gen_hex.py (H = his ladder sets, A = ours), so results are
comparable with hex.json. Run: python3 gen_hexpov.py

Set rule for p-sixes (his ladder sets, one Mega per six):
  Banette in the six -> Mega Banette (Prankster TR) and Life Orb Garchomp; else Garchomp -> Mega-Z Garchomp (ladder).
  Neither -> no Mega (Drampa keeps Cloud Nine against our sun rather than going Mega).
  Armarouge: Trick Room Life Orb set when Indeedee-F is in the six, else the fast Heat Wave set.
  Everything else: the ladder modal set (Indeedee-F Rocky Helmet TR, Tailwind Corviknight, Sitrus Rotom-Heat, Life Orb
  Cloud Nine Drampa, Sash Kleavor, Scarf Ditto, Sturdy Forretress).
Personas: a six with a Trick Room setter (Indeedee-F + TR Armarouge, or Mega Banette) commits to TR in 30% of games."""
import json, os
from itertools import combinations
from gen_hex import H, HT, A, AT, PERSONAS, ROWS
from gen_candidates import build, ROOT

TEN = ['garchomp', 'indeedeef', 'armarouge', 'corviknight', 'rotomheat', 'drampa', 'kleavor', 'banette', 'ditto', 'forretress']
DEFAULT = {'indeedeef': 'indee', 'corviknight': 'corv_tw', 'rotomheat': 'rotomh', 'drampa': 'drampa', 'kleavor': 'kleavor',
           'banette': 'banM', 'ditto': 'ditto', 'forretress': 'forre'}
NAME = {'garchomp': 'Garchomp', 'indeedeef': 'Indeedee-F', 'armarouge': 'Armarouge', 'corviknight': 'Corviknight', 'rotomheat': 'Rotom-Heat',
        'drampa': 'Drampa', 'kleavor': 'Kleavor', 'banette': 'Banette', 'ditto': 'Ditto', 'forretress': 'Forretress'}


def sets_for(six):
    keys = []
    for s in six:
        if s == 'garchomp':
            keys.append('chomp_lo' if 'banette' in six else 'chompZ')
        elif s == 'armarouge':
            keys.append('arma_tr' if 'indeedeef' in six else 'arma_hw')
        else:
            keys.append(DEFAULT[s])
    return keys


PT, PP = [], {}
for n, six in enumerate(combinations(TEN, 6), 1):
    keys = sets_for(six)
    mega = 'Mega Banette' if 'banM' in keys else 'Mega-Z Garchomp' if 'chompZ' in keys else 'no Mega'
    tid = f'p{n:03d}'
    PT.append((tid, '+'.join(NAME[s] for s in six) + f' ({mega})', 0, keys, 'every-six screen'))
    if 'banM' in keys or ('indee' in keys and 'arma_tr' in keys):
        PP[tid] = ['tr', 0.3]

# Both stones (Anthony, 2026-11-03: "bring both a Mega Charizard and Mega Kangaskhan ... quite effective"): every s-six
# with Charizard and Kangaskhan again as k### with Kangaskhanite instead of Silk Scarf (one Mega Evolution per battle,
# chosen in game). Same number as its s-six, so k009 vs s009 is a paired Silk Scarf vs Kangaskhanite comparison.
KT = [('k' + t[1:], l.replace('Kangaskhan', 'Mega Kangaskhan').replace('Mega Charizard Y', 'Mega Charizard Y / ') .replace('/ +', '/ '), 0,
       [('kangaM' if k == 'kanga' else k) for k in keys], 'both stones') for (t, l, _, keys, w) in AT if t.startswith('s') and 'zardY' in keys and 'kanga' in keys]

if __name__ == '__main__':
    # weights: p-sixes 0, h-sixes as in hex.json, so closed-sheet beliefs (run.mjs library(): modal set per species,
    # weighted) are exactly hex.json's. With equal weights the modal Garchomp became Life Orb physical and our AI misread
    # Mega-Z Garchomp all game (s119 vs h01: 29/39 wins -> 6/39 on the same seeds).
    ht, he = build(H, PT + HT, 'hex')
    at, ae = build(A, AT + KT, 'anthony')
    for tid_, p in he + ae:
        print('PROBLEM', tid_, p)
    dst = os.path.join(ROOT, 'tools', 'sim', 'candidates')
    json.dump({'version': 1, 'written': '2026-11-03', 'format': 'gen9championsvgc2026regmc', 'level': 50,
               'notes': 'Hex-side screen: p001-p210 = every six of his 10 (set rule in gen_hexpov.py), h01-h20 = hex.json teams.',
               'opponent': {'coach': 'Hex', 'seat': 1, 'teams': ht, 'personas': {**PERSONAS, **PP}, 'rows': ROWS},
               'ours': {'coach': 'Anthony', 'seat': 5, 'teams': at, 'beliefRef': 'o01'}}, open(os.path.join(dst, 'hexpov.json'), 'w'), indent=1)
    print(len(ht), 'Hex teams,', len(at), 'Anthony teams; problems:', len(he) + len(ae))

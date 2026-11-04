"""Week 4 mock refresh (ZhuZi vs Calvin, 2026-11-04): every six of ZhuZi's 10 (y001-y210) plus his 24 Week 3 candidates
(z01-z24), for the mock screen against Calvin's pool. Writes tools/sim/candidates/zhuzi-mock.json.
Run: python3 gen_zhuzi_mock.py

Set rule for y-sixes (his ladder sets from gen_candidates.py Z; only Metagross can Mega):
  Trick Room setter in the six (Oranguru or Slowking-G) -> the TR Toxtricity set (Sitrus) and bulky Krookodile;
  otherwise Scarf Toxtricity and Scarf Krookodile. Everything else: the modal set (Mega Metagross, Sitrus Rotom-Wash,
  Life Orb Dragapult, Sash Infernape, Colbur Slowking-G, Leftovers Florges, Mental Herb Oranguru, Leftovers Umbreon).
  Item clause conflicts are resolved by build() as for every other pool."""
import json, os
from itertools import combinations
from gen_candidates import Z, ZT, build, ROOT

TEN = ['metagross', 'rotomwash', 'dragapult', 'krookodile', 'infernape', 'slowkinggalar', 'florges', 'oranguru', 'toxtricity', 'umbreon']
NAME = {'metagross': 'Mega Metagross', 'rotomwash': 'Rotom-Wash', 'dragapult': 'Dragapult', 'krookodile': 'Krookodile', 'infernape': 'Infernape',
        'slowkinggalar': 'Slowking-G', 'florges': 'Florges', 'oranguru': 'Oranguru', 'toxtricity': 'Toxtricity', 'umbreon': 'Umbreon'}


def sets_for(six):
    tr = 'oranguru' in six or 'slowkinggalar' in six
    pick = {'metagross': 'meta_mega', 'rotomwash': 'rotomw', 'dragapult': 'pult', 'krookodile': 'krook_bulk' if tr else 'krook_scarf',
            'infernape': 'nape', 'slowkinggalar': 'king', 'florges': 'florges', 'oranguru': 'oran',
            'toxtricity': 'tox_tr' if tr else 'tox_scarf', 'umbreon': 'umb'}
    return [pick[s] for s in six]


YT = [(f'y{n:03d}', '+'.join(NAME[s] for s in six), 1, sets_for(six), 'every-six screen') for n, six in enumerate(combinations(TEN, 6), 1)]

if __name__ == '__main__':
    teams, probs = build(Z, YT + list(ZT), 'zhuzi')
    for tid_, p in probs:
        print('PROBLEM', tid_, p)
    dst = os.path.join(ROOT, 'tools', 'sim', 'candidates', 'zhuzi-mock.json')
    json.dump({'version': 1, 'written': '2026-11-04', 'format': 'gen9championsvgc2026regmc', 'level': 50,
               'notes': 'Mock refresh: y001-y210 = every six of ZhuZi\'s 10 (set rule in gen_zhuzi_mock.py), z01-z24 = his Week 3 candidates.',
               'opponent': {'coach': 'ZhuZi', 'seat': 3, 'teams': teams, 'personas': {}},
               'ours': {'coach': 'ZhuZi', 'seat': 3, 'teams': [], 'beliefRef': 'z01'}}, open(dst, 'w'), indent=1)
    print(len(teams), 'ZhuZi teams; problems:', len(probs))

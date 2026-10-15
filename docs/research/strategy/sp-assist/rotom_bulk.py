"""What the SP freed by Nasty Plot buys Rotom-Fan: survival vs every common league hit, offense vs bulky builds.
Run: python3 rotom_bulk.py"""
import itertools
from spcalc import mon, rolls, stat, MOVES
from league_calc import opponents, default_set, weighted_ko, multihit_mix

THREATS = []  # (coach, form, move, set, ctx)
for coach, sid, fid in opponents():
    s = default_set(fid)
    if not s:
        continue
    for mv in s['moves']:
        ctx = {'spread': True} if MOVES[mv]['target'] in ('allAdjacent', 'allAdjacentFoes') else {}
        THREATS.append((coach, fid, mv, s, ctx))


_CACHE = {}


def odds(d):
    """(OHKO, 2HKO) odds per threat. Cached on (threat, defending stat value, HP): nothing else about `d` matters here."""
    out = []
    hp = stat('rotomfan', 'hp', d['sp'].get('hp', 0), d['nature'])
    for i, (coach, fid, mv, s, ctx) in enumerate(THREATS):
        ds = 'def' if MOVES[mv]['category'] == 'Physical' else 'spd'
        key = (i, stat('rotomfan', ds, d['sp'].get(ds, 0), d['nature']), hp)
        if key not in _CACHE:
            mk = lambda nat, sp, s=s, fid=fid: mon(fid, nat, sp, s['ability'], s['item'])
            p1, err = weighted_ko(s['spreads'], mk, d, mv, ctx, 1)
            p2, _ = weighted_ko(s['spreads'], mk, d, mv, ctx, 2) if p1 is not None else (None, None)
            _CACHE[key] = (p1, p2)
        out.append(_CACHE[key])
    return out


def rotom(nature, sp):
    return mon('rotomfan', nature, sp, 'Levitate')


BUILDS = {
    'O1 Modest 32 SpA / 32 Spe / 2 HP (no NP)': rotom('Modest', {'hp': 2, 'spa': 32, 'spe': 32}),
    'O2 Modest 32 SpA / 32 HP / 2 SpD (no NP, Tailwind speed)': rotom('Modest', {'hp': 32, 'spa': 32, 'spd': 2}),
}


def best_alloc(nature, spa, spe=0, step=2):
    """Best HP/Def/SpD split of the remaining SP: fewest expected OHKOs, then fewest 2HKOs, over all league threats."""
    budget = 66 - spa - spe
    best = None
    for h in range(0, 33, step):
        for df in range(0, 33, step):
            sd = budget - h - df
            if not 0 <= sd <= 32:
                continue
            o = odds(rotom(nature, {'hp': h, 'def': df, 'spd': sd, 'spa': spa, 'spe': spe}))
            score = (sum(p1 for p1, _ in o if p1 is not None), sum(p2 for _, p2 in o if p2 is not None))
            if best is None or score < best[0]:
                best = (score, {'hp': h, 'def': df, 'spd': sd, 'spa': spa, 'spe': spe})
    return best


if __name__ == '__main__':
    print(len(THREATS), 'common league hits (moves >= 15% of a form with usage data)')
    for nat, spa in (('Modest', 16), ('Modest', 8), ('Calm', 30), ('Bold', 30), ('Calm', 21)):
        sc, sp = best_alloc(nat, spa)
        BUILDS[f'N {nat} {spa} SpA, best bulk {sp}'] = rotom(nat, sp)
        print('best', nat, spa, sp, 'expected OHKOs %.2f, 2HKOs %.2f' % sc)
    res = {k: odds(d) for k, d in BUILDS.items()}
    names = list(BUILDS)
    print('\nexpected OHKOs / 2HKOs over all hits:')
    for k in names:
        o = res[k]
        print(f'  {k}: {sum(p for p, _ in o if p is not None):.2f} / {sum(p for _, p in o if p is not None):.2f}; '
              f'hits that OHKO >=50%: {sum(1 for p, _ in o if p is not None and p >= 0.5)}')
    print('\nhits whose OHKO odds differ by >= 25 points between builds (O1, O2, then N builds):')
    for i, (coach, fid, mv, s, ctx) in enumerate(THREATS):
        row = [res[k][i][0] for k in names]
        if None in row or max(row) - min(row) < 0.25:
            continue
        print(f'  {coach:9s} {fid:15s} {mv:14s} ' + '  '.join(f'{100*p:5.1f}' for p in row))
    skipped = sorted({(fid, mv) for i, (c, fid, mv, s, ctx) in enumerate(THREATS) if res[names[0]][i][0] is None})
    print('\nskipped (unsupported):', skipped)

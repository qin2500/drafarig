"""Bulk score goldens: expected OHKOs from one opponent's common hits on a defender build (spec in rotom-fan-case.md §6).
Run: python3 bulk_score.py [Coach]   (default Calvin)"""
import sys
from spcalc import mon, MOVES
from league_calc import roster, forms, default_set, weighted_ko


def hits(coach):
    for sid in roster(coach):
        for fid in forms(sid):
            s = default_set(fid)
            if not s:
                continue
            for mv in s['moves']:
                ctx = {'spread': True} if MOVES[mv]['target'] in ('allAdjacent', 'allAdjacentFoes') else {}
                yield fid, mv, s, ctx


def score(coach, d):
    total, rows = 0.0, []
    for fid, mv, s, ctx in hits(coach):
        mk = lambda n, sp, s=s, fid=fid: mon(fid, n, sp, s['ability'], s['item'])
        p, err = weighted_ko(s['spreads'], mk, d, mv, ctx, 1)
        if err:
            raise SystemExit(err)
        total += p
        rows.append((fid, mv, p))
    return total, rows


if __name__ == '__main__':
    coach = sys.argv[1] if len(sys.argv) > 1 else 'Calvin'
    builds = {
        'O1 Modest 2/0/0/32/0/32': mon('rotomfan', 'Modest', {'hp': 2, 'spa': 32, 'spe': 32}, 'Levitate'),
        'O2 Modest 32/0/0/32/2/0': mon('rotomfan', 'Modest', {'hp': 32, 'spa': 32, 'spd': 2}, 'Levitate'),
        'N16 Modest 32/0/14/16/4/0': mon('rotomfan', 'Modest', {'hp': 32, 'def': 14, 'spa': 16, 'spd': 4}, 'Levitate'),
    }
    for name, d in builds.items():
        t, rows = score(coach, d)
        print(f'{coach} vs Rotom-Fan {name}: expected OHKOs {t:.4f} over {len(rows)} hits; nonzero: ' +
              ', '.join(f'{f}/{m}={100*p:.1f}%' for f, m, p in rows if p > 0))

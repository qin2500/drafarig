"""League-opponent calcs for the SP-assist research: default opponent sets from Smogon usage, threats to one of Anthony's
sets, KO targets for it, and Speed tiers. Shared by rotom-fan-case.md and benchmarks-league.md.
Run: python3 league_calc.py rotomfan    (needs /tmp/sp/mech.json and a league snapshot, see README notes in the .md files)"""
import json, os, sys
from spcalc import rolls, ko_chance, mon, sp_from, stat, multihit_mix, MOVES, SPC, aid

HERE = os.path.dirname(os.path.abspath(__file__))
U = json.load(open(os.path.join(HERE, 'usage-regmc-2026-09-league.json')))['species']
LEAGUE = json.load(open(os.environ.get('LEAGUE', os.path.join(HERE, 'league-2026-10-15.json'))))
FIX = {'Hisiuan Goodra': 'goodrahisui'}
MIN_MOVE = 15.0  # a move counts as "common" at >= 15% of the species' sets
# ponytail: moves are taken at listed base power (no Knock Off item bonus, no terrain-boosted Expanding Force, accuracy
# ignored, weight-based moves with BP 0 dropped). The dashboard's real engine handles these; this is a research estimate.


def roster(name):
    c = next(c for c in LEAGUE['coaches'] if c['name'] == name)
    return [p['id'] or FIX.get(p['en'], p['en']) for p in c['picks']]


def forms(sid):
    return [sid] + [k for k, v in SPC.items() if (v.get('mega') or {}).get('from') == sid]


def default_set(fid, top=3):
    """Common sets for a form from usage: top-`top` spreads (weights renormalised), top item and ability, common moves.
    None when the form has no usage data (unknown set)."""
    u = U.get(fid)
    if not u:
        return None
    sp = list(u['spreads'].items())[:top]
    tot = sum(w for _, w in sp)
    ab = next(iter(u['abilities']), SPC[fid]['abilities'][0])
    item = next(iter(u['items']), '')
    moves = [m for m, p in u['moves'].items() if p >= MIN_MOVE and m in MOVES and MOVES[m]['category'] != 'Status'
             and (MOVES[m]['basePower'] or m == 'finalgambit')]
    return {'spreads': [(w / tot, *sp_from(s)) for s, w in sp], 'ability': ab, 'item': item, 'moves': moves, 'usage': u['usage']}


def opponents(exclude='Anthony'):
    for c in LEAGUE['coaches']:
        if c['name'] == exclude:
            continue
        for sid in roster(c['name']):
            for fid in forms(sid):
                yield c['name'], sid, fid


def weighted_ko(att_spreads, mk_att, dfn, move, ctx, uses=1, hp=None):
    """KO odds over the attacker's spread distribution and, for 2-5 hit moves, the hit-count distribution
    (the same hit count is assumed on every use: a simplification for 2HKOs)."""
    hp = hp or stat(dfn['id'], 'hp', dfn['sp'].get('hp', 0), dfn['nature'])
    p = 0.0
    for w, nat, sp in att_spreads:
        a = mk_att(nat, sp)
        try:
            for wh, n in multihit_mix(move, a['ability']):
                c = dict(ctx, hits=n) if n else ctx
                p += w * wh * ko_chance(rolls(a, dfn, move, c), hp, uses)
        except ValueError as e:
            return None, str(e)
    return p, None


def threats(dfn, ctxs=({},), uses=(1, 2)):
    """Every common opposing hit on `dfn`: (coach, form, move, ctx-label, OHKO odds, 2HKO odds, %range at modal spread)."""
    out = []
    for coach, sid, fid in opponents():
        s = default_set(fid)
        if not s:
            continue
        for mv in s['moves']:
            for ctx in ctxs:
                c = dict(ctx)
                if MOVES[mv]['target'] in ('allAdjacent', 'allAdjacentFoes'):
                    c['spread'] = True
                mk = lambda nat, sp: mon(fid, nat, sp, s['ability'], s['item'])
                p1, err = weighted_ko(s['spreads'], mk, dfn, mv, c, 1)
                if err:
                    out.append((coach, fid, mv, c, None, None, err))
                    continue
                p2, _ = weighted_ko(s['spreads'], mk, dfn, mv, c, 2)
                w, nat, sp = s['spreads'][0]
                mix = multihit_mix(mv, s['ability'])
                r_lo = rolls(mk(nat, sp), dfn, mv, dict(c, hits=mix[0][1]))
                r_hi = rolls(mk(nat, sp), dfn, mv, dict(c, hits=mix[-1][1]))
                hp = stat(dfn['id'], 'hp', dfn['sp'].get('hp', 0), dfn['nature'])
                lo, hi = sum(h[0] for h in r_lo), sum(h[-1] for h in r_hi)
                out.append((coach, fid, mv, c, p1, p2, f'{100*lo/hp:.0f}-{100*hi/hp:.0f}%'))
    return out


def speed_field(fid, cond_mult=1):
    """[(weight, speed)] for a form from its full spread distribution."""
    u = U.get(fid)
    if not u:
        return None
    sp = list(u['spreads'].items())
    tot = sum(w for _, w in sp)
    return [(w / tot, stat(fid, 'spe', sp_from(s)[1]['spe'], sp_from(s)[0]) * cond_mult) for s, w in sp]


def main(sid):
    print('league snapshot', LEAGUE.get('fetchedAt'))
    for nat, sp in (('Modest', {'hp': 2, 'spa': 32, 'spe': 32}), ('Calm', {'hp': 32, 'spd': 32, 'spa': 2}), ('Bold', {'hp': 32, 'def': 32, 'spa': 2})):
        d = mon(sid, nat, sp, SPC[sid]['abilities'][0])
        print(f'\n== {sid} {nat} {sp}: threats (OHKO / 2HKO odds, % at modal spread)')
        rows = [t for t in threats(d) if t[4] is None or t[5] > 0.05]
        rows.sort(key=lambda t: -(t[4] or 0) - (t[5] or 0) / 10)
        for coach, fid, mv, c, p1, p2, info in rows[:40]:
            if p1 is None:
                print(f'  {coach:9s} {fid:16s} {mv:14s} SKIPPED: {info}')
            else:
                print(f'  {coach:9s} {fid:16s} {mv:14s} {"spread" if c.get("spread") else "      "} OHKO {100*p1:5.1f}%  2HKO {100*p2:5.1f}%  {info}')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'rotomfan')

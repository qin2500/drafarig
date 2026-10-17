"""Worst-case threat scan (threat-scan.md): every opposing league form x full legal learnset x legal abilities x realistic items,
max-offence spread, into Anthony's 10. Run: python3 threat_scan.py [--tauros]  (writes threat-scan-results.json)"""
import json, os, sys
from spcalc import rolls, ko_chance, mon, stat, sp_from, multihit_mix, eff, MOVES, SPC, MECH, aid
from league_calc import U, LEAGUE, FIX

HERE = os.path.dirname(os.path.abspath(__file__))
LS = MECH['learnsets']; LM = MECH['learnsetMoves']
TYPE_ITEM = {'Electric': 'magnet', 'Flying': 'sharpbeak', 'Water': 'mysticwater', 'Fire': 'charcoal', 'Grass': 'miracleseed',
             'Ice': 'nevermeltice', 'Rock': 'hardstone', 'Ground': 'softsand', 'Fighting': 'blackbelt', 'Ghost': 'spelltag',
             'Psychic': 'twistedspoon', 'Dark': 'blackglasses', 'Steel': 'metalcoat', 'Dragon': 'dragonfang', 'Normal': 'silkscarf',
             'Poison': 'poisonbarb', 'Bug': 'silverpowder', 'Fairy': 'fairyfeather'}
SPREAD_T = ('allAdjacent', 'allAdjacentFoes')
# Anthony's 10 (sets from match-calvin.md §5 where given; others from benchmarks-league.md assumptions)
ANTHONY = {
    'Mega Charizard Y': mon('charizardmegay', 'Modest', sp_from('Modest:6/0/0/32/2/26')[1], 'Drought', 'charizarditey'),
    'Rotom-Fan': mon('rotomfan', 'Modest', sp_from('Modest:32/0/0/32/2/0')[1], 'Levitate', 'sitrusberry'),
    'Aegislash (Shield)': mon('aegislash', 'Brave', sp_from('Brave:32/32/2/0/0/0')[1], 'Stance Change', 'metalcoat'),
    'Aegislash (Blade)': mon('aegislashblade', 'Brave', sp_from('Brave:32/32/2/0/0/0')[1], 'Stance Change', 'metalcoat'),
    'Morpeko': mon('morpeko', 'Jolly', sp_from('Jolly:2/32/0/0/0/32')[1], 'Hunger Switch', 'focussash'),
    'Sinistcha': mon('sinistcha', 'Calm', sp_from('Calm:32/0/2/0/32/0')[1], 'Hospitality', 'cobaberry'),
    'Conkeldurr': mon('conkeldurr', 'Brave', sp_from('Brave:32/32/0/0/2/0')[1], 'Iron Fist', 'lifeorb'),
    'Kangaskhan': mon('kangaskhan', 'Adamant', sp_from('Adamant:32/32/2/0/0/0')[1], 'Scrappy', 'lifeorb'),
    'Pelipper': mon('pelipper', 'Modest', sp_from('Modest:2/0/0/32/0/32')[1], 'Drizzle', 'focussash'),
    'Stunfisk-Galar': mon('stunfiskgalar', 'Brave', sp_from('Brave:32/32/2/0/0/0')[1], 'Mimicry', 'sitrusberry'),
    'Simipour': mon('simipour', 'Modest', sp_from('Modest:2/0/0/32/0/32')[1], 'Torrent', 'mysticwater'),
}
SYNERGY = {
    'sheerforce': lambda mv, mid, f: mv.get('hasSecondary'), 'technician': lambda mv, mid, f: 0 < mv['basePower'] <= 60,
    'toughclaws': lambda mv, mid, f: 'contact' in mv['flags'], 'adaptability': lambda mv, mid, f: mv['type'] in SPC[f]['types'],
    'sharpness': lambda mv, mid, f: 'slicing' in mv['flags'], 'ironfist': lambda mv, mid, f: 'punch' in mv['flags'],
    'strongjaw': lambda mv, mid, f: 'bite' in mv['flags'], 'punkrock': lambda mv, mid, f: 'sound' in mv['flags'],
    'reckless': lambda mv, mid, f: mid in ('bravebird', 'doubleedge', 'flareblitz', 'woodhammer', 'headsmash', 'wildcharge', 'highjumpkick'),
    'hugepower': lambda mv, mid, f: mv['category'] == 'Physical', 'aerilate': lambda mv, mid, f: mv['type'] == 'Normal',
    'waterbubble': lambda mv, mid, f: mv['type'] == 'Water', 'solarpower': lambda mv, mid, f: mv['category'] == 'Special',
    'skilllink': lambda mv, mid, f: isinstance(mv.get('multihit'), list), 'protean': lambda mv, mid, f: True,
}
WEATHER_SET = {'drought': 'sun', 'drizzle': 'rain', 'sandstream': 'sand', 'snowwarning': 'snow'}
TERRAIN_SET = {'electricsurge': 'electric', 'grassysurge': 'grassy', 'psychicsurge': 'psychic'}


def roster(c):
    return [p['id'] or FIX.get(p['en']) for p in c['picks']]


def forms(sid):
    return [sid] + [k for k, v in SPC.items() if (v.get('mega') or {}).get('from') == sid]


def coach_fields(c):
    """Weather / terrain this coach can set (abilities on any drafted form, or Sunny Day / Rain Dance etc. in a learnset)."""
    w, t = set(), set()
    for sid in roster(c):
        for f in forms(sid):
            for a in SPC[f]['abilities']:
                if aid(a) in WEATHER_SET: w.add(WEATHER_SET[aid(a)])
                if aid(a) in TERRAIN_SET: t.add(TERRAIN_SET[aid(a)])
    return w, t


def max_set(f, ability, item):
    """Max offence: 32 in the attacking stat with a boosting nature, for both categories (they're computed separately)."""
    return {'Physical': mon(f, 'Adamant', {'atk': 32, 'hp': 2, 'spe': 32}, ability, item),
            'Special': mon(f, 'Modest', {'spa': 32, 'hp': 2, 'spe': 32}, ability, item)}


def usage_pct(f, mid):
    return (U.get(f) or {}).get('moves', {}).get(mid, 0.0)


def plaus(f, ability, mid, mv, item, se=False):
    """Plausibility 0..1 of this exact attacker = move x ability x item (threat-scan.md §3).
    The rule that would have caught Tauros: a form WITHOUT usage data is never down-weighted for lacking data. A move it
    learns counts as likely when it is STAB, synergises with the ability, or hits the defender super-effectively."""
    u = U.get(f)
    stab = mv['type'] in SPC[f]['types']
    syn = bool(SYNERGY.get(aid(ability), lambda *a: False)(mv, mid, f))
    if u:
        p_move = 1.0 if usage_pct(f, mid) >= 5 else (0.7 if (syn or stab) else 0.5)
        top_ab = next(iter(u['abilities']), None)
        # Draft rule: an ability that synergises with the move stays plausible even if the ladder prefers another one
        # (Kleavor/Tauros Sheer Force + Rock Slide). Ladder usage only tells us what ladder players pick.
        p_ab = 1.0 if aid(ability) == top_ab else (0.8 if syn else 0.3)
        is_mega = bool(SPC[f].get('mega'))
        p_item = 1.0 if is_mega or u['items'].get(item, 0) >= 5 else (0.9 if item in ('lifeorb', '') else 0.8)
    else:
        p_move = 0.9 if (stab or syn or se) else 0.7
        p_ab = 1.0 if syn else 0.8
        p_item = 1.0 if item in ('lifeorb', '') or SPC[f].get('mega') else 0.9
    return round(p_move * p_ab * p_item, 4), syn


def ko_odds(att, dfn, mid, ctx):
    hp = stat(dfn['id'], 'hp', dfn['sp'].get('hp', 0), dfn['nature'])
    p = 0.0
    lo = hi = None
    for w, n in multihit_mix(mid, att['ability']):
        c = dict(ctx, hits=n) if n else ctx
        r = rolls(att, dfn, mid, c)
        p += w * ko_chance(r, hp)
        l, h = sum(x[0] for x in r), sum(x[-1] for x in r)
        lo = l if lo is None else min(lo, l); hi = h if hi is None else max(hi, h)
    return p, lo, hi, hp


def scan(coaches=None, defenders=ANTHONY):
    out = []
    for c in LEAGUE['coaches']:
        if c['name'] == 'Anthony' or (coaches and c['name'] not in coaches):
            continue
        weathers, terrains = coach_fields(c)
        for sid in roster(c):
            for f in forms(sid):
                is_mega = bool(SPC[f].get('mega'))
                items = [SPC[f]['mega']['item']] if is_mega else None
                for ab in SPC[f]['abilities']:
                    for li in LS.get(f) or LS[sid]:  # Megas use the base species' learnset
                        mid = LM[li]
                        mv = MOVES[mid]
                        if mv['category'] == 'Status' or (not mv['basePower'] and mid != 'finalgambit') or mid in ('tripleaxel', 'populationbomb'):
                            continue
                        cands = items or ['lifeorb', 'expertbelt', TYPE_ITEM.get(mv['type'], ''), 'muscleband' if mv['category'] == 'Physical' else 'wiseglasses', '']
                        ctxs = [{}] + [{'weather': w} for w in weathers] + [{'terrain': t} for t in terrains]
                        if mv['type'] == 'Fire': ctxs.append({'weather': 'sun', 'ours': True})  # our Charizard's sun boosts their Fire
                        spread = mv['target'] in SPREAD_T
                        for dname, d in defenders.items():
                            best = None
                            for item in cands:
                                att = max_set(f, ab, item)[mv['category']]
                                # Mega Charizard Y on the field means Drought's sun, unless the opponent's own weather replaces it
                                dctx = [({'weather': 'sun', 'ours': True} if not c0.get('weather') and not c0.get('terrain') and d['id'] == 'charizardmegay' else c0) for c0 in ctxs]
                                for ctx in dctx:
                                    c2 = dict(ctx, spread=spread)
                                    c2.pop('ours', None)
                                    try:
                                        p, lo, hi, hp = ko_odds(att, d, mid, c2)
                                    except ValueError:
                                        continue
                                    pl, syn = plaus(f, ab, mid, mv, item, se=eff(mv['type'], SPC[d['id']]['types']) > 1)
                                    sev = p * pl * (1.25 if spread else 1) * (1.25 if mv['priority'] > 0 else 1)
                                    key = (sev, p)
                                    if best is None or key > best[0]:
                                        best = (key, dict(coach=c['name'], form=f, ability=ab, item=item, move=mid, defender=dname,
                                                          ctx={k: v for k, v in ctx.items()}, ko=round(p, 4), lo=lo, hi=hi, hp=hp,
                                                          pct=f'{100*lo/hp:.1f}-{100*hi/hp:.1f}%', plaus=round(pl, 2), synergy=bool(syn),
                                                          spread=spread, priority=mv['priority'], severity=round(sev, 4),
                                                          sash=d.get('item') == 'focussash'))
                            if best and best[1]['ko'] > 0:
                                out.append(best[1])
    return out


def tauros_goldens():
    z, r = ANTHONY['Mega Charizard Y'], ANTHONY['Rotom-Fan']
    print('Tauros (base form, Normal) Rock Slide (75 BP, spread x0.75, flinch -> Sheer Force), max Atk Adamant 32:')
    for ab in ('Sheer Force', 'Intimidate', 'Anger Point'):
        for item in ('lifeorb', 'hardstone', 'muscleband', 'expertbelt', ''):
            for nat in ('Adamant', 'Jolly'):
                a = mon('tauros', nat, {'atk': 32, 'hp': 2, 'spe': 32}, ab, item)
                for name, d in (('Zard Y', z), ('Rotom-Fan', r)):
                    p, lo, hi, hp = ko_odds(a, d, 'rockslide', {'spread': True})
                    p1, lo1, hi1, _ = ko_odds(a, d, 'rockslide', {})
                    print(f'  {ab:11s} {item or "none":10s} {nat:7s} -> {name:9s} spread {lo}-{hi}/{hp} ({100*lo/hp:.1f}-{100*hi/hp:.1f}%) OHKO {100*p:.1f}% | lone target {100*lo1/hp:.1f}-{100*hi1/hp:.1f}% OHKO {100*p1:.1f}%')


if __name__ == '__main__':
    if '--tauros' in sys.argv:
        tauros_goldens(); sys.exit()
    res = scan()
    json.dump({'league': LEAGUE['fetchedAt'], 'rows': res}, open(os.path.join(HERE, 'threat-scan-results.json'), 'w'), indent=0)
    print(len(res), 'rows')

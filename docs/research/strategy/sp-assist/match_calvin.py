"""Anthony vs Calvin: the calcs behind match-calvin.md. Run: python3 match_calvin.py
Calvin's sets: Smogon ladder usage (most common spread/item/ability). Anthony's sets: the proposed match spreads below."""
import sys
from spcalc import rolls, mon, stat, sp_from, MOVES, ko_chance
from league_calc import U

def cs(fid, spread=None, item=None, ability=None, boosts=None):
    """Calvin form at its modal ladder spread (or a given 'Nature:hp/../spe')."""
    u = U[fid]
    s = spread or next(iter(u['spreads']))
    n, sp = sp_from(s)
    return mon(fid, n, sp, ability or next(iter(u['abilities'])), item if item is not None else next(iter(u['items'])), boosts)

A = {  # Anthony's proposed match sets (see match-calvin.md §5)
    'zard': mon('charizardmegay', 'Modest', sp_from('Modest:6/0/0/32/2/26')[1], 'Drought', 'charizarditey'),
    'rotom': mon('rotomfan', 'Modest', sp_from('Modest:32/0/0/32/2/0')[1], 'Levitate', 'sitrusberry'),
    'aegis': mon('aegislashblade', 'Adamant', sp_from('Adamant:32/32/0/0/2/0')[1], 'Stance Change', 'lifeorb'),
    'aegisS': mon('aegislash', 'Adamant', sp_from('Adamant:32/32/0/0/2/0')[1], 'Stance Change', 'lifeorb'),
    'morpeko': mon('morpeko', 'Jolly', sp_from('Jolly:2/32/0/0/0/32')[1], 'Hunger Switch', 'focussash'),
    'sinistcha': mon('sinistcha', 'Bold', sp_from('Bold:32/0/14/0/20/0')[1], 'Hospitality', 'cobaberry'),
    'conk': mon('conkeldurr', 'Brave', sp_from('Brave:32/32/0/0/2/0')[1], 'Iron Fist', 'lifeorb'),
    'kanga': mon('kangaskhan', 'Adamant', sp_from('Adamant:32/32/2/0/0/0')[1], 'Scrappy', 'silkscarf'),
    'pelipper': mon('pelipper', 'Modest', sp_from('Modest:2/0/0/32/0/32')[1], 'Drizzle', 'focussash'),
}
SPREAD = {'heatwave', 'muddywater', 'rockslide', 'earthquake', 'discharge', 'icywind', 'electroweb', 'strugglebug', 'matchagotcha'}


def line(att, d, mv, ctx=None, label=''):
    ctx = dict(ctx or {})
    if mv in SPREAD and 'spread' not in ctx:
        ctx['spread'] = True
    hp = stat(d['id'], 'hp', d['sp'].get('hp', 0), d['nature'])
    if mv == 'tripleaxel':  # 20/40/60 BP per hit (data/moves.ts basePowerCallback 20*hit); all three hits assumed to land
        import copy
        parts = []
        for bp in (20, 40, 60):
            MOVES['_ta'] = dict(MOVES['tripleaxel'], basePower=bp, multihit=None)
            parts.append(rolls(att, d, '_ta', ctx)[0])
        r = parts
    else:
        n = ctx.get('hits')
        r = rolls(att, d, mv, ctx)
    lo, hi = sum(h[0] for h in r), sum(h[-1] for h in r)
    p = ko_chance(r, hp)
    p2 = ko_chance(r, hp, 2)
    tag = ' '.join(k for k in ('spread', 'weather', 'screens', 'helpingHand', 'crit') if ctx.get(k)) + (f"={ctx['weather']}" if ctx.get('weather') else '')
    print(f'  {label or att["id"]:>14s} {mv:13s} -> {d["id"]:15s} {tag:22s} {lo:3d}-{hi:3d} / {hp} ({100*lo/hp:5.1f}-{100*hi/hp:5.1f}%)  OHKO {100*p:5.1f}%  2HKO {100*p2:5.1f}%')


def section(t):
    print('\n## ' + t)


if __name__ == '__main__':
    for k, v in A.items():
        print(k, {s: stat(v['id'], s, v['sp'].get(s, 0), v['nature']) for s in ('hp', 'atk', 'def', 'spa', 'spd', 'spe')})
    rapJ = cs('staraptormega', 'Jolly:2/32/0/0/0/32'); rapB = cs('staraptormega')
    scarf = cs('staraptor')
    grim = cs('grimmsnarl'); volc = cs('volcarona'); voM = cs('volcarona', 'Modest:21/0/15/5/1/24')
    bas = cs('basculegionf'); mam = cs('mamoswine'); tsa = cs('tsareena'); emp = cs('empoleon'); jol = cs('jolteon')
    tau = mon('tauros', 'Jolly', {'hp': 2, 'atk': 32, 'spe': 32}, 'Intimidate', 'lifeorb')  # no usage data: assumed max Atk
    section('CALVIN -> ANTHONY')
    for mv in ('bravebird', 'closecombat', 'dualwingbeat'):
        for k in ('zard', 'rotom', 'aegis', 'aegisS', 'morpeko', 'sinistcha', 'conk'):
            line(rapJ, A[k], mv, label='Mega Rap 32Atk')
    for k in ('zard', 'rotom', 'morpeko', 'sinistcha', 'conk'):
        line(scarf, A[k], 'finalgambit', label='Scarf Rap')
    for wx in ('sun', None):
        for b in (0, 1, 2):
            v = dict(voM, boosts={'spa': b})
            for k in ('aegis', 'sinistcha', 'rotom', 'conk', 'zard'):
                line(v, A[k], 'heatwave', {'weather': wx}, label=f'Volc(Mod5) +{b}')
    for b in (0, 2):
        for k in ('aegis', 'sinistcha', 'conk'):
            line(dict(volc, boosts={'spa': b}), A[k], 'heatwave', {}, label=f'Volc(Bold) +{b}')
    for mv, ks in (('shadowball', ('aegis', 'aegisS', 'sinistcha', 'zard', 'rotom')), ('muddywater', ('zard', 'conk', 'aegis', 'morpeko')), ('icebeam', ('rotom', 'zard', 'sinistcha'))):
        for wx in ('sun', None):
            for k in ks:
                line(bas, A[k], mv, {'weather': wx}, label='Bascul-F LO')
    line(bas, A['zard'], 'muddywater', {'weather': 'rain'}, label='Bascul-F LO')
    for mv, ks in (('iciclecrash', ('rotom', 'zard', 'sinistcha', 'aegis', 'morpeko')), ('iceshard', ('rotom', 'sinistcha')), ('highhorsepower', ('aegis', 'aegisS', 'zard', 'morpeko', 'conk')), ('rockslide', ('zard', 'rotom'))):
        for k in ks:
            line(mam, A[k], mv, label='Mamo Adamant')
    mamLO = cs('mamoswine', 'Adamant:2/32/0/0/0/32', item='lifeorb')
    for k in ('rotom', 'aegis', 'zard'):
        line(mamLO, A[k], 'iciclecrash' if k == 'rotom' else ('highhorsepower' if k == 'aegis' else 'rockslide'), label='Mamo LO')
    for k in ('conk', 'morpeko', 'sinistcha'):
        line(grim, A[k], 'spiritbreak', label='Grimmsnarl')
    for mv, ks in (('tripleaxel', ('rotom', 'sinistcha', 'zard', 'conk')), ('powerwhip', ('sinistcha', 'conk', 'morpeko')), ('highjumpkick', ('morpeko', 'conk'))):
        for k in ks:
            line(tsa, A[k], mv, label='Tsareena')
    for k in ('zard', 'rotom', 'morpeko', 'pelipper'):
        line(jol, A[k], 'thunderbolt', label='Jolteon')
    for k in ('zard', 'rotom', 'conk'):
        line(emp, A[k], 'icebeam', {'weather': 'sun'}, label='Empoleon')
        line(emp, A[k], 'hydropump', {'weather': 'sun'}, label='Empoleon')
    for k in ('zard', 'rotom', 'sinistcha'):
        line(tau, A[k], 'ragingbull', label='Tauros(assumed)')
    section('ANTHONY -> CALVIN')
    tg = {'Mega Rap 29/1/4': rapB, 'Mega Rap 2/32': rapJ, 'Scarf Rap': scarf, 'Grimmsnarl': grim, 'Volc Bold': volc, 'Volc Modest': voM, 'Bascul-F': bas,
          'Mamoswine': mam, 'Tsareena': tsa, 'Empoleon': emp, 'Jolteon': jol, 'Tauros(32HP?)': mon('tauros', 'Jolly', {'hp': 2, 'atk': 32, 'spe': 32}, 'Intimidate', 'lifeorb')}
    for name, d in tg.items():
        for scr in (False, True):
            c = {'weather': 'sun', 'screens': scr}
            line(A['zard'], d, 'heatwave', c, label='Zard Y')
        if name in ('Bascul-F', 'Empoleon', 'Mamoswine', 'Tsareena'):
            line(A['zard'], d, 'solarbeam', {'weather': 'sun'}, label='Zard Y')
        line(A['zard'], d, 'weatherball', {'weather': 'sun'}, label='Zard Y')
        for mv in ('thunderbolt', 'airslash'):
            line(A['rotom'], d, mv, {}, label='Rotom Mod32')
        for mv in ('ironhead', 'poltergeist', 'closecombat', 'shadowsneak'):
            line(A['aegis'], d, mv, {}, label='Aegis Blade')
        for mv in ('drainpunch', 'machpunch', 'icepunch', 'thunderpunch'):
            line(A['conk'], d, mv, {}, label='Conk Brave LO')
        line(A['morpeko'], d, 'aurawheel', {}, label='Morpeko')
    section('SPEED (Champions stats)')
    sp = lambda m: stat(m['id'], 'spe', m['sp'].get('spe', 0), m['nature'])
    rows = [(k, sp(v)) for k, v in A.items()] + [('C:' + n, sp(d)) for n, d in tg.items()] + [('C:Scarf Rap x1.5', sp(scarf) * 3 // 2)]
    for k, v in sorted(rows, key=lambda x: -x[1]):
        print(f'  {v:4d}  TW {2*v:4d}  {k}')

"""Anthony vs ZhuZi: the calcs behind match-zhuzi.md and lib/guides/5v3.mjs. Run: python3 match_zhuzi.py
ZhuZi 'ladder' sets: Smogon Reg M-C >= 1760 Sept modal spread / top item / top ability. 'worst' sets: max offence (threat_scan).
Anthony's sets: the Week 1 six (public/vs-calvin.html) + Conkeldurr / Stunfisk-Galar alternatives."""
from spcalc import rolls, mon, stat, sp_from, ko_chance
from match_calvin import cs, line

A = {
    'zard': mon('charizardmegay', 'Modest', sp_from('Modest:6/0/0/32/2/26')[1], 'Drought', 'charizarditey'),
    'aegis': mon('aegislash', 'Brave', sp_from('Brave:32/32/2/0/0/0')[1], 'Stance Change', 'metalcoat'),
    'aegisB': mon('aegislashblade', 'Brave', sp_from('Brave:32/32/2/0/0/0')[1], 'Stance Change', 'metalcoat'),
    'morpeko': mon('morpeko', 'Jolly', sp_from('Jolly:2/32/0/0/0/32')[1], 'Hunger Switch', 'focussash'),
    'rotom': mon('rotomfan', 'Modest', sp_from('Modest:32/0/0/32/2/0')[1], 'Levitate', 'sitrusberry'),
    'sinistcha': mon('sinistcha', 'Calm', sp_from('Calm:32/0/2/0/32/0')[1], 'Hospitality', 'cobaberry'),
    'kanga': mon('kangaskhan', 'Adamant', sp_from('Adamant:32/32/0/0/0/0')[1], 'Scrappy', 'lifeorb'),
    'conk': mon('conkeldurr', 'Brave', sp_from('Brave:32/32/0/0/2/0')[1], 'Iron Fist', 'lifeorb'),
    'stunfisk': mon('stunfiskgalar', 'Brave', sp_from('Brave:32/32/2/0/0/0')[1], 'Mimicry', 'sitrusberry'),
}
Z = {  # ladder sets (modal spread, top item, top ability)
    'metagrossmega': cs('metagrossmega'), 'metagross': cs('metagross'), 'rotomwash': cs('rotomwash'), 'dragapult': cs('dragapult'),
    'krookodile': cs('krookodile'), 'krookodileA': cs('krookodile', 'Adamant:2/32/0/0/0/32', item='lifeorb'), 'infernape': cs('infernape'),
    'slowkinggalar': cs('slowkinggalar'), 'florges': cs('florges'), 'oranguru': cs('oranguru'), 'toxtricity': cs('toxtricity'),
    'umbreon': cs('umbreon'),
}


def sec(t):
    print('\n## ' + t)


if __name__ == '__main__':
    for k, v in {**A, **Z}.items():
        print(k, v['nature'], v['sp'], v['ability'], v['item'], {s: stat(v['id'], s, v['sp'].get(s, 0), v['nature']) for s in ('hp', 'atk', 'def', 'spa', 'spd', 'spe')})
    sec('ZHUZI -> ANTHONY (ladder sets)')
    T = [
        ('metagrossmega', ['psychicfangs', 'ironhead', 'stompingtantrum', 'bulletpunch'], ['zard', 'aegis', 'aegisB', 'morpeko', 'rotom', 'sinistcha', 'kanga', 'conk', 'stunfisk']),
        ('metagross', ['psychicfangs', 'explosion'], ['zard', 'rotom', 'kanga']),
        ('rotomwash', ['hydropump', 'thunderbolt'], ['zard', 'aegis', 'morpeko', 'rotom', 'kanga', 'stunfisk']),
        ('dragapult', ['dracometeor', 'shadowball'], ['zard', 'aegis', 'aegisB', 'morpeko', 'rotom', 'sinistcha', 'kanga']),
        ('krookodileA', ['highhorsepower', 'knockoff', 'rockslide', 'stoneedge', 'earthquake'], ['zard', 'aegis', 'aegisB', 'morpeko', 'rotom', 'sinistcha', 'kanga', 'stunfisk']),
        ('infernape', ['heatwave', 'overheat', 'closecombat', 'aurasphere', 'fakeout'], ['zard', 'aegis', 'sinistcha', 'kanga', 'rotom', 'morpeko', 'stunfisk']),
        ('slowkinggalar', ['sludgebomb', 'psychic', 'powergem', 'flamethrower'], ['zard', 'aegis', 'kanga', 'conk', 'sinistcha', 'morpeko']),
        ('florges', ['moonblast', 'dazzlinggleam'], ['kanga', 'conk', 'morpeko', 'zard', 'aegis']),
        ('oranguru', ['psychic', 'foulplay'], ['kanga', 'conk', 'aegisB']),
        ('toxtricity', ['overdrive', 'boomburst', 'sludgebomb'], ['zard', 'rotom', 'morpeko', 'kanga', 'sinistcha', 'aegis', 'stunfisk']),
        ('umbreon', ['foulplay'], ['kanga', 'aegisB', 'morpeko', 'conk', 'stunfisk']),
    ]
    for a, mvs, ds in T:
        for mv in mvs:
            for d in ds:
                for wx in (('sun', None) if mv in ('hydropump', 'heatwave', 'overheat', 'flamethrower') else (None,)):
                    line(Z[a], A[d], mv, {'weather': wx}, label=a)
    sec('worst-case extras (max offence, Life Orb)')
    tox = mon('toxtricity', 'Modest', {'spa': 32, 'hp': 2, 'spe': 32}, 'Punk Rock', 'lifeorb')
    for d in ('zard', 'rotom', 'sinistcha', 'aegis', 'kanga', 'stunfisk'):
        line(tox, A[d], 'overdrive', {'weather': 'sun'} if d == 'zard' else {}, label='Tox worst')
    kro = mon('krookodile', 'Adamant', {'atk': 32, 'hp': 2, 'spe': 32}, 'Intimidate', 'lifeorb')
    line(kro, A['zard'], 'rockslide', {'weather': 'sun'}, label='Krook worst')
    line(kro, A['zard'], 'stoneedge', {'weather': 'sun'}, label='Krook worst')
    line(cs('krookodile', 'Jolly:2/32/0/0/0/32', item='choicescarf'), A['zard'], 'rockslide', {'weather': 'sun'}, label='Krook Scarf')
    sk = mon('slowkinggalar', 'Modest', {'spa': 32, 'hp': 32}, 'Regenerator', 'lifeorb')
    line(sk, A['zard'], 'powergem', {'weather': 'sun'}, label='Slowking worst')
    line(mon('umbreon', 'Bold', sp_from('Bold:30/0/16/0/20/0')[1], 'Inner Focus', 'leftovers'), A['aegisB'], 'foulplay', label='Umbreon')
    sec('ANTHONY -> ZHUZI (ladder sets)')
    O = [
        ('zard', ['heatwave', 'weatherball', 'solarbeam'], {'weather': 'sun'}),
        ('aegisB', ['ironhead', 'poltergeist', 'shadowsneak', 'closecombat'], {}),
        ('morpeko', ['aurawheel', 'knockoff'], {}),
        ('rotom', ['thunderbolt', 'airslash'], {}),
        ('kanga', ['lastresort', 'fakeout'], {}),
        ('sinistcha', ['matchagotcha', 'shadowball'], {}),
        ('conk', ['drainpunch', 'machpunch', 'icepunch', 'knockoff'], {}),
        ('stunfisk', ['stompingtantrum', 'snaptrap'], {}),
    ]
    for d in Z:
        for a, mvs, ctx in O:
            for mv in mvs:
                line(A[a], Z[d], mv, ctx, label=a)
    sec('Hangry Aura Wheel (Dark) and screens/Intimidate variants')
    import copy
    from spcalc import MOVES
    MOVES['_awdark'] = dict(MOVES['aurawheel'], type='Dark')
    for d in ('metagrossmega', 'slowkinggalar', 'oranguru', 'dragapult', 'toxtricity'):
        line(A['morpeko'], Z[d], '_awdark', {}, label='Morpeko Hangry')
    for d in ('metagrossmega', 'dragapult', 'toxtricity', 'infernape'):
        line(dict(A['kanga'], boosts={'atk': -1}), Z[d], 'lastresort', {}, label='Kanga -1')
        line(dict(A['aegisB'], boosts={'atk': -1}), Z[d], 'poltergeist' if d == 'dragapult' else 'ironhead', {}, label='Aegis -1')
    for d in ('metagrossmega', 'toxtricity', 'infernape', 'florges'):
        line(A['zard'], Z[d], 'heatwave', {'weather': 'sun', 'screens': True}, label='zard LScreen')
    sec('SPEED')
    sp = lambda m: stat(m['id'], 'spe', m['sp'].get('spe', 0), m['nature'])
    rows = [(k, sp(v)) for k, v in A.items()] + [('Z:' + k, sp(v)) for k, v in Z.items()]
    for k, v in sorted(rows, key=lambda x: -x[1]):
        print(f'  {v:4d}  {k}')

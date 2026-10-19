"""Mock: Jacky's team vs Calvin (mock-method.md §3). Run: python3 mock_jacky_calvin.py
Jacky's sets: proposed (TR-sun main + offense variant). Calvin: ladder sets (cs) + Tauros worst case."""
from spcalc import mon, sp_from, stat, MOVES
from match_calvin import cs, line

J = {
    'torkoal': mon('torkoal', 'Quiet', sp_from('Quiet:32/0/0/32/2/0')[1], 'Drought', 'charcoal'),
    'farigiraf': mon('farigiraf', 'Sassy', sp_from('Sassy:32/0/0/2/32/0')[1], 'Armor Tail', 'sitrusberry'),
    'incineroar': mon('incineroar', 'Careful', sp_from('Careful:32/0/14/0/20/0')[1], 'Intimidate', 'chopleberry'),
    'golimega': mon('golisopodmega', 'Brave', sp_from('Brave:32/32/0/0/2/0')[1], 'Tough Claws', 'golisopite'),
    'mrrime': mon('mrrime', 'Quiet', sp_from('Quiet:32/0/2/32/0/0')[1], 'Screen Cleaner', 'twistedspoon'),
    'lycanroc': mon('lycanrocmidnight', 'Adamant', sp_from('Adamant:2/32/0/0/0/32')[1], 'No Guard', 'lifeorb'),
    'lycanrocB': mon('lycanrocmidnight', 'Brave', sp_from('Brave:32/32/2/0/0/0')[1], 'No Guard', 'focussash'),
    'rotommow': mon('rotommow', 'Timid', sp_from('Timid:2/0/0/32/0/32')[1], 'Levitate', 'choicescarf'),
    'mimikyu': mon('mimikyu', 'Adamant', sp_from('Adamant:2/32/0/0/0/32')[1], 'Disguise', 'lifeorb'),
}
C = {
    # attacker: the 32-Atk spread; as a TARGET use the modal Jolly 29/1/0/0/4/32 (HP 189). Mixing these up caused the
    # 2026-10-19 mismatch (calcs labelled 29/1/4 were run against the 2-HP spread).
    'staraptormega': cs('staraptormega', 'Jolly:2/32/0/0/0/32'), 'staraptormegaT': cs('staraptormega', 'Jolly:29/1/0/0/4/32'),
    'staraptor': cs('staraptor'), 'grimmsnarl': cs('grimmsnarl'),
    'volcarona': cs('volcarona'), 'volcaronaM': cs('volcarona', 'Modest:21/0/15/5/1/24'), 'basculegionf': cs('basculegionf'),
    'mamoswine': cs('mamoswine', item='lifeorb'), 'tsareena': cs('tsareena'), 'empoleon': cs('empoleon'), 'jolteon': cs('jolteon'),
    'tauros': mon('tauros', 'Adamant', {'atk': 32, 'hp': 2, 'spe': 32}, 'Sheer Force', 'lifeorb'),
}
if __name__ == '__main__':
    for k, v in {**J}.items():
        print(k, {s: stat(v['id'], s, v['sp'].get(s, 0), v['nature']) for s in ('hp', 'atk', 'def', 'spa', 'spd', 'spe')})
    print('\n## JACKY -> CALVIN')
    O = [('torkoal', ['eruption', 'heatwave', 'weatherball'], {'weather': 'sun'}), ('mrrime', ['freezedry', 'icywind', 'psychic'], {}),
         ('lycanroc', ['rockslide', 'stoneedge', 'closecombat', 'psychicfangs'], {}), ('golimega', ['firstimpression', 'ironhead', 'liquidation', 'suckerpunch'], {}),
         ('incineroar', ['flareblitz', 'knockoff'], {'weather': 'sun'}), ('farigiraf', ['psychic', 'hypervoice'], {}),
         ('rotommow', ['thunderbolt', 'leafstorm'], {}), ('mimikyu', ['playrough', 'shadowsneak'], {})]
    for d in [k for k in C if k != 'staraptormega']:
        for a, mvs, ctx in O:
            for mv in mvs:
                line(J[a], C[d], mv, ctx, label=a)
    print('\n## CALVIN -> JACKY')
    T = [('staraptormega', ['closecombat', 'bravebird']), ('staraptor', ['closecombat', 'finalgambit']), ('grimmsnarl', ['spiritbreak']),
         ('volcaronaM', ['heatwave', 'overheat']), ('basculegionf', ['muddywater', 'shadowball', 'icebeam']), ('mamoswine', ['highhorsepower', 'iciclecrash', 'earthquake']),
         ('tsareena', ['powerwhip', 'highjumpkick']), ('jolteon', ['thunderbolt']), ('empoleon', ['hydropump', 'flashcannon']), ('tauros', ['rockslide', 'closecombat'])]
    for a, mvs in T:
        for mv in mvs:
            for d in ('torkoal', 'farigiraf', 'incineroar', 'golimega', 'mrrime', 'lycanroc', 'rotommow', 'mimikyu'):
                wx = 'sun' if mv in ('heatwave', 'overheat', 'muddywater', 'hydropump') else None
                line(C[a], J[d], mv, {'weather': wx}, label=a)
    print('\n## SPEED')
    sp = lambda m: stat(m['id'], 'spe', m['sp'].get('spe', 0), m['nature'])
    for k, v in sorted([(k, sp(v)) for k, v in {**J, **{'C:' + a: b for a, b in C.items()}}.items()], key=lambda x: x[1]):
        print(f'  {v:4d}  {k}')

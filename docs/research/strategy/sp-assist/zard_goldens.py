"""Goldens: Anthony's Mega Charizard Y (Modest 2/0/0/32/0/32, Charizardite Y, Drought) into Calvin's pool, sun vs no sun.
Targets use each form's modal Smogon ladder spread (usage-regmc-2026-09-league.json). Run: python3 zard_goldens.py"""
from spcalc import rolls, mon, stat, sp_from
from league_calc import U, default_set

ZARD = mon('charizardmegay', 'Modest', {'hp': 2, 'spa': 32, 'spe': 32}, 'Drought', 'charizarditey')
CASES = [('grimmsnarl', 'heatwave', True), ('staraptormega', 'heatwave', True), ('tsareena', 'weatherball', False),
         ('basculegionf', 'solarbeam', False), ('volcarona', 'heatwave', True)]

if __name__ == '__main__':
    print('Mega Charizard Y Modest 32 SpA: SpA', stat('charizardmegay', 'spa', 32, 'Modest'), 'Spe', stat('charizardmegay', 'spe', 32, 'Modest'))
    for fid, mv, spread in CASES:
        s = default_set(fid)
        modal = next(iter(U[fid]['spreads']))
        nat, sp = sp_from(modal)
        t = mon(fid, nat, sp, s['ability'], s['item'])
        hp = stat(fid, 'hp', sp.get('hp', 0), nat)
        for weather in ('sun', None):
            r = rolls(ZARD, t, mv, {'spread': spread, 'weather': weather})[0]
            ko = sum(x >= hp for x in r)
            print(f'{fid:13s} {modal:24s} ({s["ability"]}, {s["item"]}) HP {hp:3d} | {mv:11s} {"spread" if spread else "single"} '
                  f'{"sun   " if weather else "no sun"}: {r[0]}-{r[-1]} ({100*r[0]/hp:.1f}-{100*r[-1]/hp:.1f}%) OHKO {ko}/16  rolls {r}')

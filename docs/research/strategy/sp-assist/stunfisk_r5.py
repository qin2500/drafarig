"""Stunfisk-Galar numbers for the ZhuZi sim report (2026-10-22). The app engine refuses Mimicry (type change), so these come
from spcalc, which treats Mimicry as inactive (no terrain in this match: Stunfisk-Galar stays Ground/Steel).
Run: python3 stunfisk_r5.py"""
from spcalc import mon, sp_from
from match_calvin import cs, line

STUN = mon('stunfiskgalar', 'Brave', sp_from('Brave:32/32/2/0/0/0')[1], 'Mimicry', 'leftovers')
Z = {
    'metagrossmega': cs('metagrossmega', 'Jolly:2/32/0/0/0/32', item='metagrossite', ability='Tough Claws'),
    'krookScarf': cs('krookodile', 'Jolly:2/32/0/0/0/32', item='choicescarf', ability='Intimidate'),
    'krookLO': cs('krookodile', 'Adamant:2/32/0/0/0/32', item='lifeorb', ability='Intimidate'),
    'infernape': cs('infernape', 'Hasty:0/2/0/32/0/32', item='focussash', ability='Blaze'),
    'toxtricity': cs('toxtricity', 'Modest:1/0/0/32/1/32', item='lifeorb', ability='Punk Rock'),
    'rotomwash': cs('rotomwash', 'Modest:32/0/4/8/16/6', item='sitrusberry', ability='Levitate'),
    'dragapult': cs('dragapult', 'Modest:2/0/0/32/0/32', item='lifeorb', ability='Clear Body'),
    'oranguru': cs('oranguru', 'Relaxed:32/0/32/0/2/0', item='mentalherb', ability='Inner Focus'),
    'umbreon': cs('umbreon', 'Bold:30/0/16/0/20/0', item='leftovers', ability='Inner Focus'),
}
print('-- Stunfisk-Galar attacking')
for d in ('toxtricity', 'infernape', 'metagrossmega', 'krookScarf', 'oranguru', 'umbreon'):
    line(STUN, Z[d], 'stompingtantrum', {}, label=f'Stunfisk Stomping Tantrum -> {d}')
line(STUN, Z['dragapult'], 'snaptrap', {}, label='Stunfisk Snap Trap -> dragapult')
print('-- into Stunfisk-Galar')
for a, mv, ctx in (('metagrossmega', 'psychicfangs', {}), ('metagrossmega', 'ironhead', {}), ('krookScarf', 'highhorsepower', {}), ('krookLO', 'highhorsepower', {}),
                   ('infernape', 'closecombat', {}), ('infernape', 'heatwave', {'weather': 'sun'}), ('rotomwash', 'hydropump', {}), ('rotomwash', 'hydropump', {'weather': 'sun'}),
                   ('dragapult', 'dracometeor', {}), ('toxtricity', 'sludgebomb', {})):
    line(Z[a], STUN, mv, ctx, label=f'{a} {mv}{" (sun)" if ctx else ""} -> Stunfisk')

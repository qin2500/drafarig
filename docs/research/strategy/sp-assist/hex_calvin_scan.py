"""Week 5 mock (Hex vs Calvin, 2026-11-09): full-learnset worst-case scan in both directions (playbook rule 1).
  Calvin's 10 (every legal form x ability x move x realistic item, max offence) into Hex's modelled sets, and
  Hex's 10 into Calvin's modelled sets. Writes hex-calvin-scan.json; prints the top hit per (attacker form, defender).
Run: python3 hex_calvin_scan.py"""
import json, os
from collections import defaultdict
from spcalc import mon, sp_from
from threat_scan import scan

# Hex's sets as Calvin will meet them (gen_hex_vs_calvin.py library, modal choices)
HEX = {
    'Mega Garchomp-Z': mon('garchompmegaz', 'Modest', sp_from('Modest:2/0/0/32/0/32')[1], 'Levitate', 'garchompitez'),
    'Garchomp (LO)': mon('garchomp', 'Jolly', sp_from('Jolly:2/32/0/0/0/32')[1], 'Rough Skin', 'lifeorb'),
    'Indeedee-F': mon('indeedeef', 'Relaxed', sp_from('Relaxed:32/0/32/0/2/0')[1], 'Psychic Surge', 'rockyhelmet'),
    'Armarouge (TR)': mon('armarouge', 'Quiet', sp_from('Quiet:32/0/0/32/2/0')[1], 'Flash Fire', 'lifeorb'),
    'Corviknight': mon('corviknight', 'Careful', sp_from('Careful:32/2/0/0/32/0')[1], 'Mirror Armor', 'leftovers'),
    'Rotom-Heat': mon('rotomheat', 'Modest', sp_from('Modest:32/0/0/32/2/0')[1], 'Levitate', 'sitrusberry'),
    'Drampa': mon('drampa', 'Quiet', sp_from('Quiet:32/0/0/32/2/0')[1], 'Berserk', 'lifeorb'),
    'Kleavor (Sash)': mon('kleavor', 'Jolly', sp_from('Jolly:2/32/0/0/0/32')[1], 'Sharpness', 'focussash'),
    'Mega Banette': mon('banettemega', 'Adamant', sp_from('Adamant:32/32/0/0/2/0')[1], 'Prankster', 'banettite'),
    'Forretress': mon('forretress', 'Relaxed', sp_from('Relaxed:32/0/32/0/2/0')[1], 'Sturdy', 'rockyhelmet'),
}
# Calvin's sets (gen_hex_vs_calvin.py library: ladder >= 1760 plus his Week 1 Mega Staraptor)
CALVIN = {
    'Mega Staraptor': mon('staraptormega', 'Jolly', sp_from('Jolly:2/32/0/0/0/32')[1], 'Contrary', 'staraptite'),
    'Grimmsnarl': mon('grimmsnarl', 'Careful', sp_from('Careful:32/0/19/0/15/0')[1], 'Prankster', 'lightclay'),
    'Volcarona': mon('volcarona', 'Bold', sp_from('Bold:32/0/32/0/2/0')[1], 'Flame Body', 'rockyhelmet'),
    'Basculegion-F': mon('basculegionf', 'Modest', sp_from('Modest:0/0/1/32/1/32')[1], 'Swift Swim', 'focussash'),
    'Mamoswine': mon('mamoswine', 'Adamant', sp_from('Adamant:2/32/0/0/0/32')[1], 'Oblivious', 'focussash'),
    'Tsareena': mon('tsareena', 'Jolly', sp_from('Jolly:2/32/0/0/0/32')[1], 'Queenly Majesty', 'widelens'),
    'Empoleon': mon('empoleon', 'Modest', sp_from('Modest:32/0/0/19/0/15')[1], 'Competitive', 'chopleberry'),
    'Jolteon': mon('jolteon', 'Timid', sp_from('Timid:1/0/1/32/0/32')[1], 'Volt Absorb', 'focussash'),
    'Tauros': mon('tauros', 'Adamant', sp_from('Adamant:2/32/0/0/0/32')[1], 'Sheer Force', 'lifeorb'),
    'Swalot': mon('swalot', 'Sassy', sp_from('Sassy:32/0/17/0/17/0')[1], 'Liquid Ooze', 'leftovers'),
}


def top(rows, label):
    f = lambda r: (f"{r['form']} ({r['ability']}, {r['item'] or 'none'}) {r['move']}{' [spread]' if r['spread'] else ''}{' [prio]' if r['priority'] > 0 else ''}"
                   f"{' ' + str(r['ctx']) if r['ctx'] else ''} -> {r['defender']}: {r['pct']} OHKO {100*r['ko']:.0f}%{' SASH' if r['sash'] else ''} plaus {r['plaus']}")
    print(f'\n######## {label}')
    by = defaultdict(list)
    for r in rows:
        by[r['defender']].append(r)
    for d, rs in by.items():
        print(f'\n== into {d}: OHKO threats (best per attacker form, OHKO >= 50%, plausibility-ranked)')
        best = {}
        for r in rs:
            if r['ko'] >= 0.5 and (r['form'] not in best or (r['severity'], r['lo']) > (best[r['form']]['severity'], best[r['form']]['lo'])):
                best[r['form']] = r
        for r in sorted(best.values(), key=lambda r: -r['severity']):
            print('  ', f(r))


if __name__ == '__main__':
    c2h = scan(coaches=['Calvin'], defenders=HEX)
    h2c = scan(coaches=['Hex(法拉)'], defenders=CALVIN)
    here = os.path.dirname(os.path.abspath(__file__))
    json.dump({'calvin_into_hex': c2h, 'hex_into_calvin': h2c}, open(os.path.join(here, 'hex-calvin-scan.json'), 'w'), indent=0)
    top(c2h, "Calvin's 10 (worst case) into Hex's sets")
    top(h2c, "Hex's 10 (worst case) into Calvin's sets")

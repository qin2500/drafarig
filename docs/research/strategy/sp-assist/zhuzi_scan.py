"""Worst-case threat scan of ZhuZi's 10 into Anthony's 10 (match-zhuzi.md §3). Run: python3 zhuzi_scan.py"""
import json, os
from collections import defaultdict
from threat_scan import scan

rows = scan(coaches=['ZhuZi'])
json.dump(rows, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'zhuzi-scan.json'), 'w'), indent=0)
ok = [r for r in rows if r['defender'] != 'Aegislash (Blade)']
f = lambda r: (f"{r['form']} ({r['ability']}, {r['item'] or 'none'}) {r['move']}{' [spread]' if r['spread'] else ''}{' [prio]' if r['priority'] > 0 else ''}"
               f"{' ' + str(r['ctx']) if r['ctx'] else ''} -> {r['defender']}: {r['lo']}-{r['hi']}/{r['hp']} ({r['pct']}) OHKO {100*r['ko']:.0f}%"
               f"{' SASH' if r['sash'] else ''} plaus {r['plaus']} sev {r['severity']}")
by = defaultdict(list)
for r in ok:
    by[r['form']].append(r)
for form, rs in by.items():
    print(f'\n== {form}: top rows (one per defender)')
    seen = set()
    for r in sorted(rs, key=lambda r: (-r['severity'], -r['lo'] / r['hp'])):
        if r['defender'] in seen or r['ko'] < 0.25:
            continue
        seen.add(r['defender'])
        print('  ', f(r))
print('\n== Everything that OHKOs Mega Charizard Y (best per form)')
best = {}
for r in ok:
    if r['defender'] == 'Mega Charizard Y' and r['ko'] >= 0.5:
        if r['form'] not in best or (r['severity'], r['lo']) > (best[r['form']]['severity'], best[r['form']]['lo']):
            best[r['form']] = r
for r in sorted(best.values(), key=lambda r: -r['severity']):
    print('  ', f(r))
print('\n== Rock moves into Mega Charizard Y (all forms, best variant each)')
rk = {}
for r in ok:
    if r['defender'] == 'Mega Charizard Y' and r['move'] in ('rockslide', 'stoneedge', 'rocktomb', 'powergem', 'rockblast', 'ancientpower', 'meteorbeam', 'headsmash', 'rockwrecker'):
        k = (r['form'], r['move'])
        if k not in rk or r['severity'] > rk[k]['severity']:
            rk[k] = r
for r in sorted(rk.values(), key=lambda r: -r['lo'] / r['hp']):
    print('  ', f(r))

"""Summarise threat-scan-results.json (threat-scan.md §4). Run: python3 threat_report.py"""
import json, os
from collections import defaultdict
R = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'threat-scan-results.json')))['rows']
fmt = lambda r: (f"{r['coach']}: {r['form']} ({r['ability']}, {r['item'] or 'no item'}) {r['move']}{' [spread]' if r['spread'] else ''}"
                 f"{' [priority]' if r['priority'] > 0 else ''}{' ' + str(r['ctx']) if r['ctx'] else ''} -> {r['defender']}: {r['pct']}, "
                 f"OHKO {100*r['ko']:.0f}%{' (Sash holds at full HP)' if r['sash'] else ''}, plaus {r['plaus']}, severity {r['severity']}")
real = [r for r in R if not r['sash']]
print('== Top 15 league-wide (one row per attacker form x move; Sash defenders excluded)')
seen = set()
for r in sorted(real, key=lambda r: (-r['severity'], -r['lo'] / r['hp'])):
    k = (r['coach'], r['form'], r['move'])
    if k in seen: continue
    seen.add(k); print(' ', fmt(r))
    if len(seen) >= 15: break
print('\n== Anything that OHKOs Mega Charizard Y >= 50% with plausibility >= 0.6, best per attacker form')
best = {}
for r in R:
    if r['defender'] == 'Mega Charizard Y' and r['ko'] >= 0.5 and r['plaus'] >= 0.6:
        k = (r['coach'], r['form'])
        if k not in best or r['severity'] > best[k]['severity']: best[k] = r
for r in sorted(best.values(), key=lambda r: (-r['severity'], -r['lo'] / r['hp'])): print(' ', fmt(r))
print('\n== Spread moves that OHKO >= 50% two or more of Anthony\'s mons (same attacker form, ability, move)')
g = defaultdict(list)
for r in real:
    if r['spread'] and r['ko'] >= 0.5: g[(r['coach'], r['form'], r['ability'], r['move'])].append(r)
for k, rows in sorted(g.items(), key=lambda kv: -len(kv[1])):
    if len(rows) >= 2:
        print(f"  {k[0]}: {k[1]} ({k[2]}) {k[3]} -> " + ', '.join(f"{r['defender']} {100*r['ko']:.0f}% [{r['item'] or 'none'}]" for r in rows))
print('\n== Priority moves that OHKO >= 50%')
for r in sorted([r for r in real if r['priority'] > 0 and r['ko'] >= 0.5], key=lambda r: (-r['severity'], -r['lo'] / r['hp']))[:12]: print(' ', fmt(r))
print('\n== Per opponent (top 3 rows, severity)')
by = defaultdict(list)
for r in real: by[r['coach']].append(r)
for c, rows in by.items():
    print(' ', c)
    s = set()
    for r in sorted(rows, key=lambda r: (-r['severity'], -r['lo'] / r['hp'])):
        k = (r['form'], r['move'], r['defender'])
        if k in s: continue
        s.add(k); print('    ', fmt(r))
        if len(s) >= 3: break

"""Rotom-Fan vs Mega Staraptor: the numbers behind rotom-fan-case.md.
Run: python3 rotom_case.py   (needs /tmp/sp/mech.json, see spcalc.py)"""
import json, os
from spcalc import rolls, ko_chance, mon, sp_from, stat, MOVES, SPC

HERE = os.path.dirname(os.path.abspath(__file__))
U = json.load(open(os.path.join(HERE, 'usage-regmc-2026-09-league.json')))['species']


def field(sid, top=None):
    """Spread distribution [(weight, nature, sp)] normalised to 1."""
    sp = list(U[sid]['spreads'].items())[:top] if top else list(U[sid]['spreads'].items())
    tot = sum(w for _, w in sp)
    return [(w / tot, *sp_from(s)) for s, w in sp]


RAPTOR = field('staraptormega')
MODAL = RAPTOR[0]


def rotom(nature, spa, stage=0, item=''):
    return mon('rotomfan', nature, {'spa': spa}, 'Levitate', item, {'spa': stage})


def raptor(nature, sp, spd_stage=0):
    return mon('staraptormega', nature, sp, 'Contrary', 'staraptite', {'spd': spd_stage})


def p_ko(att, move, tgt, ctx, uses=1):
    hp = stat('staraptormega', 'hp', tgt['sp'].get('hp', 0), tgt['nature'])
    return ko_chance(rolls(att, tgt, move, ctx), hp, uses)


def field_ko(att, move, ctx, spd_stage=0, uses=1):
    return sum(w * p_ko(att, move, raptor(n, sp, spd_stage), ctx, uses) for w, n, sp in RAPTOR)


def min_sp(nature, move, ctx, stage, spd_stage, item, level, uses=1, target='field'):
    """Least SpA SP so the KO chance >= level (vs the weighted field, or the modal spread). None if 32 doesn't."""
    for s in range(33):
        a = rotom(nature, s, stage, item)
        p = field_ko(a, move, ctx, spd_stage, uses) if target == 'field' else p_ko(a, move, raptor(MODAL[1], MODAL[2], spd_stage), ctx, uses)
        if p >= level - 1e-12:
            return s, p
    return None, field_ko(rotom(nature, 32, stage, item), move, ctx, spd_stage, uses) if target == 'field' else None


def table():
    print('Mega Staraptor field: %d spreads, modal %s %s (%.1f%%)' % (len(RAPTOR), MODAL[1], MODAL[2], 100 * MODAL[0]))
    hp_w = {}
    for w, n, sp in RAPTOR:
        hp_w[sp['hp']] = hp_w.get(sp['hp'], 0) + w
    spd_any = sum(w for w, n, sp in RAPTOR if sp['spd'] > 4)
    print('HP SP distribution (weight):', sorted(((h, round(100 * w, 1)) for h, w in hp_w.items()), key=lambda x: -x[1])[:12])
    print('share with SpD SP > 4: %.1f%%; natures: %s' % (100 * spd_any, sorted({n for _, n, _ in RAPTOR})))
    rng = lambda a, t, mv, ctx={}: rolls(a, t, mv, ctx)[0]
    t0 = raptor(MODAL[1], MODAL[2])
    hp0 = stat('staraptormega', 'hp', MODAL[2]['hp'], MODAL[1])
    print('\nModal target HP', hp0, 'SpD', stat('staraptormega', 'spd', MODAL[2]['spd'], MODAL[1]))
    for nat in ('Modest', 'Timid'):
        for st in (0, 1, 2):
            for spd in (0, 1):
                for mv in ('thunderbolt', 'airslash'):
                    for item in ('', 'magnet', 'lifeorb'):
                        r = rng(rotom(nat, 32, st, item), raptor(MODAL[1], MODAL[2], spd), mv)
                        r0 = rng(rotom(nat, 0, st, item), raptor(MODAL[1], MODAL[2], spd), mv)
                        print(f'  {nat:6s} +{st} vs SpD+{spd} {mv:11s} {item or "no item":8s} 0SpA {r0[0]}-{r0[-1]} ({100*r0[0]/hp0:.0f}-{100*r0[-1]/hp0:.0f}%)  32SpA {r[0]}-{r[-1]} ({100*r[0]/hp0:.0f}-{100*r[-1]/hp0:.0f}%)')
    print('\nLeast SpA SP for an OHKO (Thunderbolt), field-weighted / modal spread; "-" = not reachable, value in () = odds at 32 SP')
    for item in ('', 'magnet', 'lifeorb', 'expertbelt'):
        for nat in ('Modest', 'Timid'):
            for st in (0, 1, 2):
                for spd in (0, 1):
                    row = []
                    for lvl in (1.0, 15 / 16, 0.5):
                        s, p = min_sp(nat, 'thunderbolt', {}, st, spd, item, lvl)
                        row.append(f'{s:>2}' if s is not None else f' -({100*p:.0f}%)')
                    s_m, _ = min_sp(nat, 'thunderbolt', {}, st, spd, item, 1.0, target='modal')
                    print(f'  {item or "no item":10s} {nat:6s} +{st} SpD+{spd}: field 100%/94%/50% -> {" / ".join(row)} | modal guaranteed {s_m if s_m is not None else "-"}')
    print('\n2HKO (two Thunderbolts, no recovery), least SpA SP for 100% vs field:')
    for nat in ('Modest', 'Timid'):
        for spd in (0, 1, 2):
            s, p = min_sp(nat, 'thunderbolt', {}, 0, spd, '', 1.0, uses=2)
            print(f'  {nat} +0 vs SpD+{spd}: {s} (odds at 32: {100*p:.1f}%)' if s is None else f'  {nat} +0 vs SpD+{spd}: {s}')
    print('\nRain Thunder (110 BP, 100% acc in rain), Helping Hand, Light Screen variants, +0, field 100%:')
    for nat in ('Modest', 'Timid'):
        for mv, ctx, label in (('thunder', {'weather': 'rain'}, 'Thunder in rain'), ('thunderbolt', {'helpingHand': True}, 'Thunderbolt + Helping Hand'),
                               ('thunderbolt', {'screens': True}, 'Thunderbolt into Light Screen'), ('discharge', {'spread': True}, 'Discharge (spread)')):
            for st in (0, 2):
                s, p = min_sp(nat, mv, ctx, st, 0, '', 1.0)
                s50, p50 = min_sp(nat, mv, ctx, st, 0, '', 0.5)
                print(f'  {nat} +{st} {label}: guaranteed {s if s is not None else "-"} ; >=50% {s50 if s50 is not None else "-"} ; field odds at 32 SP {100*field_ko(rotom(nat, 32, st), mv, ctx):.1f}%')


def extras():
    print('\n+2 vs two Close Combats (SpD+2), and the Spirit Break case (+2 then -1 = +1), field odds by SpA SP:')
    for nat in ('Modest', 'Calm'):
        for item in ('', 'magnet', 'lifeorb'):
            for st, spd in ((2, 2), (1, 0), (1, 1)):
                s94, p = min_sp(nat, 'thunderbolt', {}, st, spd, item, 15 / 16)
                s50, p50 = min_sp(nat, 'thunderbolt', {}, st, spd, item, 0.5)
                print(f'  {nat:6s} {item or "no item":8s} +{st} vs SpD+{spd}: >=94% {s94 if s94 is not None else "-(%.0f%%)" % (100*p)} ; >=50% {s50 if s50 is not None else "-"}')
    # Base Staraptor (Choice Scarf Final Gambit set): Normal/Flying, Electric is 2x.
    base = [(w / 1, *sp_from(s)) for s, w in list(U['staraptor']['spreads'].items())]
    tot = sum(w for w, _, _ in base)
    base = [(w / tot, n, sp) for w, n, sp in base]
    print('\nBase (Scarf) Staraptor field, +0 Thunderbolt OHKO odds by SpA SP:')
    for nat in ('Modest', 'Timid'):
        for item in ('', 'magnet'):
            row = []
            for s in (0, 8, 16, 24, 32):
                a = rotom(nat, s, 0, item)
                p = sum(w * ko_chance(rolls(a, mon('staraptor', n, sp, 'Intimidate', 'choicescarf'), 'thunderbolt'),
                                      stat('staraptor', 'hp', sp['hp'], n)) for w, n, sp in base)
                row.append(f'{s}:{100*p:.0f}%')
            print(f'  {nat} {item or "no item"}: ' + '  '.join(row))
    # What Mega Staraptor does to Rotom-Fan (its STABs are resisted)
    print('\nMega Staraptor into Rotom-Fan (32 HP / 0 Def neutral-Def Rotom, and 2 HP):')
    for sp_r, label in (({'hp': 32}, '32 HP'), ({'hp': 2}, '2 HP')):
        d = mon('rotomfan', 'Modest', sp_r, 'Levitate')
        hp = stat('rotomfan', 'hp', sp_r['hp'], 'Modest')
        for mv in ('bravebird', 'closecombat', 'dualwingbeat', 'doubleedge'):
            r = rolls(mon('staraptormega', 'Jolly', {'atk': 32, 'hp': 2, 'spe': 32}, 'Contrary', 'staraptite'), d, mv)
            lo, hi = sum(h[0] for h in r), sum(h[-1] for h in r)
            print(f'  {label} {mv:12s} {lo}-{hi} of {hp} ({100*lo/hp:.0f}-{100*hi/hp:.0f}%)')
    fg = stat('staraptor', 'hp', 32, 'Jolly')
    print(f'  Scarf Staraptor Final Gambit = its HP: {fg} (32 HP SP) vs Rotom-Fan max HP {stat("rotomfan", "hp", 32, "Modest")}')
    print('\nSpeed: Rotom-Fan', {f'{n} {s}': stat('rotomfan', 'spe', s, n) for n in ('Timid', 'Modest') for s in (0, 32)},
          '| Mega Staraptor Jolly 32:', stat('staraptormega', 'spe', 32, 'Jolly'), '| Scarf base Staraptor Jolly 32 x1.5:',
          stat('staraptor', 'spe', 32, 'Jolly') * 3 // 2)


if __name__ == '__main__':
    table()
    extras()

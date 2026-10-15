"""Per-mon benchmarks for Anthony's roster vs the actual league opponents (benchmarks-league.md).
Run: python3 bench.py [monId ...] > out.txt
Benchmark types (benchmarks-method.md): OUTSPEED (SP to move first vs an opponent form's common spreads), KO (attack SP to
OHKO an opponent form at >= 15/16 over its common spreads), SURVIVE (bulk SP so a common league hit no longer OHKOs >= 1/16).
Opponent sets: Smogon usage defaults (league_calc.default_set). Anthony's sets: ASSUMED below (usage modal or stated)."""
import sys
from spcalc import mon, rolls, stat, MOVES, SPC, NAT
from league_calc import opponents, default_set, weighted_ko, U, sp_from, LEAGUE

# Anthony's assumed sets: form used for each benchmark, nature, SP, ability, item, main moves, battle context.
MINE = {
    'charizardmegay': ('Timid', '2/0/0/32/0/32', 'Drought', 'charizarditey', ['heatwave', 'weatherball', 'solarbeam'], {'weather': 'sun'}),
    'sinistcha': ('Bold', '32/0/14/0/20/0', 'Hospitality', 'sitrusberry', ['matchagotcha', 'shadowball'], {}),
    'pelipper': ('Modest', '2/0/0/32/0/32', 'Drizzle', 'focussash', ['hurricane', 'weatherball'], {'weather': 'rain'}),
    'kangaskhanmega': ('Brave', '32/32/1/0/1/0', 'Parental Bond', 'kangaskhanite', ['doubleedge', 'icepunch', 'hammerarm'], {}),
    'aegislashblade': ('Adamant', '2/32/0/0/0/32', 'Stance Change', 'lifeorb', ['ironhead', 'poltergeist', 'closecombat'], {}),
    'morpeko': ('Jolly', '2/32/0/0/0/32', 'Hunger Switch', 'focussash', ['aurawheel'], {}),
    'conkeldurr': ('Brave', '32/32/0/0/2/0', 'Iron Fist', 'lifeorb', ['drainpunch', 'machpunch', 'icepunch', 'thunderpunch'], {}),
    'rotomfan': ('Modest', '32/0/0/32/2/0', 'Levitate', 'lifeorb', ['thunderbolt', 'airslash'], {}),
    'stunfiskgalar': ('Brave', '32/32/2/0/0/0', 'Mimicry', 'sitrusberry', ['stompingtantrum', 'snaptrap'], {}),
    'simipour': ('Modest', '2/0/0/32/0/32', 'Torrent', 'mysticwater', ['scald', 'icebeam'], {'weather': 'rain'}),
}
LEVEL = 15 / 16


def my(fid, sp=None, nature=None, boosts=None):
    nat, s, ab, item, _, _ = MINE[fid]
    return mon(fid, nature or nat, sp if sp is not None else sp_from(f'{nat}:{s}')[1], ab, item, boosts)


def plus_nature(stat_name):
    """A neutral-to-the-set nature raising stat_name (lowering the unused attack stat or, for attack stats, Spe-neutral)."""
    return {'spe': 'Timid', 'spa': 'Modest', 'atk': 'Adamant', 'def': 'Bold', 'spd': 'Calm'}[stat_name]


def opp_speeds(ofid):
    """[(weight, Speed)] over the form's spreads; Choice Scarf x1.5 applied when it is the form's majority item (>= 50%)."""
    u = U[ofid]
    sp_list = list(u['spreads'].items())
    tot = sum(w for _, w in sp_list)
    scarf = u['items'].get('choicescarf', 0) >= 50
    f = (lambda v: (v * 6144 + 2047) // 4096) if scarf else (lambda v: v)  # Showdown modify(v, 1.5)
    return [(w / tot, f(stat(ofid, 'spe', sp_from(x)[1]['spe'], sp_from(x)[0]))) for x, w in sp_list], scarf


def opp_forms():
    seen = set()
    for coach, sid, fid in opponents():
        if (coach, fid) in seen or not default_set(fid):
            continue
        seen.add((coach, fid))
        yield coach, fid, default_set(fid)


def speed(fid):
    nat, s, *_ = MINE[fid]
    base = sp_from(f'{nat}:{s}')[1]
    mine_now = stat(fid, 'spe', base['spe'], nat)
    lo, hi = stat(fid, 'spe', 0, nat), max(stat(fid, 'spe', 32, nat), stat(fid, 'spe', 32, 'Timid' if base.get('spa', 0) >= base.get('atk', 0) else 'Jolly'))
    print(f'\n[{fid}] SPEED now {mine_now} ({nat} {base["spe"]} SP); reachable {lo}-{hi}; Tailwind x2 = {2*mine_now}')
    rows = []
    for coach, ofid, s in opp_forms():
        u = U[ofid]
        dist, scarf = opp_speeds(ofid)
        top = max(v for w, v in dist if w >= 0.03) if any(w >= 0.03 for w, _ in dist) else max(v for _, v in dist)
        modal = dist[0][1]
        frac_now = sum(w for w, v in dist if mine_now > v)
        if lo <= top + 1 and modal < hi + 1:
            need = next((sp for sp in range(33) if stat(fid, 'spe', sp, nat) > top), None)
            need_plus = next((sp for sp in range(33) if stat(fid, 'spe', sp, 'Timid') > top), None)
            rows.append((u['usage'], coach, ofid, modal, top, frac_now, need, need_plus))
    for usage, coach, ofid, modal, top, frac, need, need_plus in sorted(rows, key=lambda r: -r[0])[:14]:
        print(f'  {coach:9s} {ofid:16s} usage {usage:5.2f}%  modal {modal:3d}  top-common {top:3d}  outsped now {100*frac:5.1f}%'
              f'  SP to beat top-common: {nat} {need if need is not None else "-"} / +Spe nature {need_plus if need_plus is not None else "-"}')


def ko(fid):
    nat, s, ab, item, moves, ctx = MINE[fid]
    base = sp_from(f'{nat}:{s}')[1]
    print(f'\n[{fid}] KO (OHKO >= 15/16 over the target\'s top-3 spreads; ctx {ctx})')
    rows = []
    for coach, ofid, s_ in opp_forms():
        for mv in moves:
            mvd = MOVES[mv]
            st = 'atk' if mvd['category'] == 'Physical' else 'spa'
            c = dict(ctx, spread=mvd['target'] in ('allAdjacent', 'allAdjacentFoes'))
            for boosts in ({}, {'atk': -1}) if st == 'atk' else ({},):
                def p_at(sp_val, nature):
                    d_sp = dict(base, **{st: sp_val})
                    tgt = lambda n, sp: mon(ofid, n, sp, s_['ability'], s_['item'])
                    # attacker fixed, defender varies over its spreads
                    tot = 0.0
                    for w, n, sp in s_['spreads']:
                        t = tgt(n, sp)
                        hp = stat(ofid, 'hp', sp.get('hp', 0), n)
                        from spcalc import ko_chance
                        tot += w * ko_chance(rolls(my(fid, d_sp, nature, boosts), t, mv, c), hp)
                    return tot
                try:
                    now = p_at(base.get(st, 0), nat)
                    top = max(p_at(32, nat), p_at(32, plus_nature(st)))
                except ValueError as e:
                    rows.append((0, coach, ofid, mv, boosts, None, None, str(e)))
                    continue
                if now < LEVEL <= top or (now >= LEVEL and p_at(0, nat) < LEVEL):
                    need = next((v for v in range(33) if p_at(v, nat) >= LEVEL), None)
                    need_p = next((v for v in range(33) if p_at(v, plus_nature(st)) >= LEVEL), None)
                    rows.append((U[ofid]['usage'], coach, ofid, mv, boosts, now, (need, need_p), ''))
    for usage, coach, ofid, mv, boosts, now, need, err in sorted(rows, key=lambda r: -r[0])[:18]:
        if err:
            print(f'  SKIP {coach} {ofid} {mv}: {err}')
            continue
        print(f'  {coach:9s} {ofid:16s} {mv:13s} {"at -1 " if boosts else "      "} odds now {100*now:5.1f}%  '
              f'SP for >=15/16: {nat} {need[0] if need[0] is not None else "-"} / +nature {need[1] if need[1] is not None else "-"}')


def survive(fid):
    nat, s, ab, item, moves, ctx = MINE[fid]
    base = sp_from(f'{nat}:{s}')[1]
    print(f'\n[{fid}] SURVIVE (current {nat} {s}); hits with OHKO odds that bulk SP changes')
    hp_now = stat(fid, 'hp', base['hp'], nat)
    rows = []
    for coach, ofid, s_ in opp_forms():
        for mv in s_['moves']:
            mvd = MOVES[mv]
            ds = 'def' if mvd['category'] == 'Physical' else 'spd'
            c = {'spread': mvd['target'] in ('allAdjacent', 'allAdjacentFoes')}
            if mvd['type'] in ('Water', 'Fire') and ctx.get('weather'):
                c['weather'] = ctx['weather']  # my weather is up
            mk = lambda n, sp, s_=s_, ofid=ofid: mon(ofid, n, sp, s_['ability'], s_['item'])
            def p_at(hp_sp, d_sp, nature):
                return weighted_ko(s_['spreads'], mk, my(fid, dict(base, hp=hp_sp, **{ds: d_sp}), nature), mv, c)[0]
            now = p_at(base['hp'], base.get(ds, 0), nat)
            if now is None or now < 1 / 16:
                continue
            best = p_at(32, 32, plus_nature(ds))
            if best is not None and best < 1 / 16:
                # cheapest (hp, def) pair with current nature, then with +nature
                opts = []
                for nature in (nat, plus_nature(ds)):
                    for tot in range(0, 65):
                        hit = next(((h, tot - h) for h in range(32, -1, -1) if 0 <= tot - h <= 32 and p_at(h, tot - h, nature) < 1 / 16), None)
                        if hit:
                            opts.append((nature, tot, hit))
                            break
                rows.append((U[ofid]['usage'], coach, ofid, mv, now, opts))
    for usage, coach, ofid, mv, now, opts in sorted(rows, key=lambda r: -r[0])[:14]:
        print(f'  {coach:9s} {ofid:16s} {mv:14s} OHKO odds now {100*now:5.1f}%  survive with: ' +
              '; '.join(f'{n} {t} SP (HP {h} / {("Def" if MOVES[mv]["category"] == "Physical" else "SpD")} {d})' for n, t, (h, d) in opts))


def speed_table(fid, natures=('Timid', 'Modest')):
    """Full creep table: for each league form whose common Speeds sit in reach, % of its spreads my Speed beats / ties."""
    print(f'\n[{fid}] SPEED CREEP TABLE (share of each opponent form\'s usage spreads: beaten / tied / faster)')
    marks = sorted({stat(fid, 'spe', sp, n) for n in natures for sp in (0, 8, 16, 24, 28, 32)})
    lo, hi = min(marks), max(marks)
    for coach, ofid, s in sorted(opp_forms(), key=lambda r: -U[r[1]]['usage']):
        u = U[ofid]
        dist, scarf = opp_speeds(ofid)
        if not any(lo - 10 <= v <= hi + 10 for _, v in dist):
            continue
        cells = []
        for m in (lo, stat(fid, 'spe', 32, natures[1]), hi):
            b = sum(w for w, v in dist if v < m); t = sum(w for w, v in dist if v == m)
            cells.append(f'{m}: {100*b:3.0f}/{100*t:2.0f}/{100*(1-b-t):3.0f}')
        common = sorted({v for w, v in dist if w >= 0.03})
        print(f'  {coach:9s} {ofid:16s}{" (Scarf)" if scarf else ""} usage {u["usage"]:5.2f}%  common Speeds {common}  | ' + ' | '.join(cells))


if __name__ == '__main__':
    print('league snapshot', LEAGUE['fetchedAt'])
    if sys.argv[1:] == ['zardspeed']:
        speed_table('charizardmegay'); sys.exit()
    for fid in (sys.argv[1:] or list(MINE)):
        speed(fid); ko(fid); survive(fid)

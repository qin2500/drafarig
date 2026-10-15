"""Reference implementation of docs/research/strategy/cores.json (v2).

Not app code. It reproduces every number quoted in cores.md, and the Developer can diff the JS implementation against it.
Usage:  python3 cores-check.py [league-snapshot.json]      (default: raw/league-snapshot-2026-10-03.json)
        python3 cores-check.py --tests                     (runs the fieldability test cases only)
Inputs: data/dex.json, cores.json, raw/champions-learnsets-board.json (for learnsetTech), a league snapshot
        ({coaches:[{name, pointsLeft, slotsLeft, picks:[{id}]}], available:[{id, points}]}).
"""
import itertools, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
STRAT = os.path.dirname(HERE)
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(STRAT)))
DEX = json.load(open(os.path.join(ROOT, 'data', 'dex.json')))
SP, TC = DEX['species'], DEX['typechart']
SPEC = json.load(open(os.path.join(STRAT, 'cores.json')))
toID = lambda s: ''.join(c for c in str(s).lower() if c.isalnum())
_LS = {toID(k): set(v) for k, v in json.load(open(os.path.join(HERE, 'champions-learnsets-board.json'))).items()}
TECH = {toID(m) for m in SPEC['dataModel']['techMoves']}
LEARN_TECH = {i: (_LS.get(i, set()) & TECH) for i in SP}  # what tools/build-data.mjs should emit as learnsetTech
MOVETAG = SPEC['dataModel']['moveTags']
USAGE, LEARNSET = 2, 1


def options(sid):
    s = SP[sid]
    for f in s['forms']:
        for a in (f.get('abilities') or [None]):
            yield {'sid': sid, 'num': s['num'], 'form': f, 'ability': a, 'mega': bool(f.get('mega'))}


def ev_move(sid, values):
    values = values if isinstance(values, list) else [values]
    s = SP[sid]
    if any(v in s['keyMoves'] for v in values):
        return USAGE
    for v in values:
        if MOVETAG.get(v) in s['roles'] and MOVETAG.get(v) not in ('screens', 'redirection', 'speed-drop', 'pivot'):
            return LEARNSET  # single-move tag: exact
        if toID(v) in LEARN_TECH[sid]:
            return LEARNSET
    # group tags: tag says "one of the group"; accept only if every value of the condition is in that group
    tags = {MOVETAG.get(v) for v in values}
    if len(tags) == 1 and None not in tags and tags <= set(s['roles']):
        return LEARNSET
    return None


def cmp(v, rule):
    (op, n), = rule.items()
    return v <= n if op == '<=' else v >= n


def ev(cond, o):
    """Evidence (USAGE/LEARNSET) that option o satisfies cond, or None."""
    if 'allOf' in cond:
        parts = [ev(c, o) for c in cond['allOf']]
        return None if None in parts else min(parts)
    e = _ev(cond, o)
    if e and cond.get('minEvidence') == 'usage' and e < USAGE:
        return None
    return e


def _ev(cond, o):
    k, f = cond['kind'], o['form']
    bs = f['baseStats']
    if k == 'move':
        return ev_move(o['sid'], cond['value'])
    if k == 'ability':
        return USAGE if o['ability'] in cond['value'] else None
    if k == 'type':
        return USAGE if set(f['types']) & set(cond['value']) else None
    if k == 'stats':
        ok = True
        if 'spe' in cond: ok &= cmp(bs['spe'], cond['spe'])
        if 'atkOrSpa' in cond: ok &= cmp(max(bs['atk'], bs['spa']), cond['atkOrSpa'])
        if 'spa' in cond: ok &= cmp(bs['spa'], cond['spa'])
        if cond.get('spaOverAtk'): ok &= bs['spa'] > bs['atk']
        return USAGE if ok else None
    if k == 'defense':
        m = 1.0
        for t in f['types']:
            m *= TC[cond['attackType']][t]
        return USAGE if m <= cond['maxMult'] else None
    if k == 'stab':
        return USAGE if cond['type'] in f['types'] and max(bs['atk'], bs['spa']) >= cond['minStat'] else None
    raise ValueError(k)


def slot_ev(slot, o):
    best = None
    for c in slot['anyOf']:
        e = ev(c, o)
        if e and (best is None or e > best):
            best = e
    return best


def detect(core, roster, mega_limit=1):
    """Best legal assignment or None. roster: list of species ids."""
    det = core['detection']
    slots = det['slots']
    cands = {}
    for sid in roster:
        seen = {}
        for o in options(sid):
            sig = tuple(slot_ev(s, o) for s in slots)
            if not any(sig):
                continue
            key = (sig, o['mega'])
            if key not in seen:
                seen[key] = (o, sig)
        if seen:
            cands[sid] = list(seen.values())
    best = None
    ids = list(cands)
    for n in range(det.get('minDistinct', 2), min(det.get('maxMembers', 4), len(ids)) + 1):
        for S in itertools.combinations(ids, n):
            if len({SP[i]['num'] for i in S}) < n:
                continue  # species clause
            for pick in itertools.product(*(cands[i] for i in S)):
                megas = sum(o['mega'] for o, _ in pick)
                if megas > mega_limit:
                    continue
                okslots, evmin = True, USAGE
                for j, s in enumerate(slots):
                    hits = [sig[j] for _, sig in pick if sig[j]]
                    if len(hits) < s['min']:
                        okslots = False
                        break
                    evmin = min(evmin, sorted(hits, reverse=True)[s['min'] - 1])
                if not okslots:
                    continue
                score = (megas, -evmin, n, [ids.index(i) for i in S])
                if best is None or score < best[0]:
                    members = [{'id': o['sid'], 'form': o['form']['name'], 'ability': o['ability'],
                                'slots': [slots[j]['name'] for j in range(len(slots)) if sig[j]]} for o, sig in pick]
                    best = (score, {'members': members, 'megas': megas,
                                    'confidence': 'likely' if evmin == USAGE else 'possible'})
    return best[1] if best else None


def state(core, roster):
    a = detect(core, roster)
    if a:
        return 'fieldable', a
    b = detect(core, roster, mega_limit=99)
    return ('mega-conflict', b) if b else (None, None)


STRUCT_KINDS = {'type', 'defense', 'ability', 'stats', 'stab'}


def slot_pool(core, roster):
    """For each slot, every roster mon that can fill it with some option (Mega forms flagged)."""
    out = {}
    for s in core['detection']['slots']:
        hits = []
        for sid in roster:
            best = None
            for o in options(sid):
                e = slot_ev(s, o)
                if e and (best is None or (e, not o['mega']) > best[:2]):
                    best = (e, not o['mega'], o)
            if best:
                hits.append(best[2]['form']['name'] + ('' if best[0] == USAGE else '?'))
        out[s['name']] = hits
    return out


def contested(ans, opp_roster):
    for cond in ans.get('blockedBy', []):
        for sid in opp_roster:
            if any(ev(cond, o) for o in options(sid)):
                return SP[sid]['name']
    return None


def answers_for(core, roster, opp_roster=()):
    out = []
    for ans in core['answers']:
        blocker = contested(ans, opp_roster)
        for sid in roster:
            best = None
            for o in options(sid):
                e = ev(ans['test'], o)
                if not e:
                    continue
                cls = 'structural' if ans['kind'] in STRUCT_KINDS else ('standard-move' if e == USAGE else 'tech')
                rank = {'structural': 3, 'standard-move': 2, 'tech': 1}[cls]
                key = (not o['mega'], rank)
                if best is None or key > best[0]:
                    best = (key, {'answer': ans['id'], 'label': ans['label'], 'mon': sid, 'form': o['form']['name'],
                                  'class': cls, 'megaDependent': o['mega'], 'partial': ans.get('partial', False),
                                  'counts': ans.get('counts', True), 'contestedBy': blocker})
            if best:
                out.append(best[1])
    return out


def status(core, ans, scenario='A'):
    high = core['prepSensitivity'][scenario] == 'High'
    per = {}
    for a in ans:
        if not a['counts']:
            continue
        r = {'structural': 3, 'standard-move': 2, 'tech': 1}[a['class']]
        anchor = (not a['partial']) and (not a['contestedBy']) and (a['class'] != 'tech' or high)
        cur = per.get(a['mon'])
        cand = (anchor, r, not a['megaDependent'], a)
        if cur is None or cand[:3] > cur[:3]:
            per[a['mon']] = cand
    vals = sorted(per.values(), key=lambda x: x[:3], reverse=True)
    counted, mega_used = [], False
    for v in vals:
        if v[3]['megaDependent']:
            if mega_used:
                continue
            mega_used = True
        counted.append(v)
    if not counted:
        return 'No answer found', counted
    if len(counted) >= 2 and any(v[0] for v in counted):
        return 'Has answers', counted
    return 'Thin', counted


def run_tests():
    core = {c['id']: c for c in SPEC['cores']}
    T = [
        ('T1 legal: Jacky Trick Room (Farigiraf + Torkoal + Golisopod)', 'trick-room',
         ['farigiraf', 'torkoal', 'golisopod', 'incineroar'], 'fieldable'),
        ('T2 one form per mon: Raichu cannot be Mega-X setter AND Mega-Y abuser', 'electric-terrain',
         ['raichu', 'klefki'], None),
        ('T3 legal with exactly one Mega: Data Raichu-Mega-X + Archaludon', 'electric-terrain',
         ['raichu', 'archaludon', 'klefki', 'politoed'], 'fieldable'),
        ('T4 mega-conflict: Charizard-Mega-Y (only Drought source) + Raichu-Mega-X (only Electric Surge source) for a sun+terrain test core',
         '__sun_terrain', ['charizard', 'raichu'], 'mega-conflict'),
        ('T5 ability per form: Staraptor and Salamence only Intimidate in base form; Mega forms must not count',
         'intimidate-cycle', ['staraptor', 'salamence', 'incineroar'], 'fieldable'),
        ('T6 species clause: Rotom-Wash + Rotom-Heat count as one species', '__two_rotom',
         ['rotomwash', 'rotomheat'], None),
    ]
    core['__sun_terrain'] = {'id': '__sun_terrain', 'detection': {'slots': [
        {'name': 'sun', 'min': 1, 'anyOf': [{'kind': 'ability', 'value': ['Drought']}]},
        {'name': 'terrain', 'min': 1, 'anyOf': [{'kind': 'ability', 'value': ['Electric Surge']}]}], 'minDistinct': 2, 'maxMembers': 4}}
    core['__two_rotom'] = {'id': '__two_rotom', 'detection': {'slots': [
        {'name': 'electric', 'min': 2, 'anyOf': [{'kind': 'type', 'value': ['Electric']}]}], 'minDistinct': 2, 'maxMembers': 4}}
    ok = True
    for name, cid, roster, want in T:
        st, a = state(core[cid], roster)
        good = st == want
        ok &= good
        print(('PASS ' if good else 'FAIL ') + name, '->', st, json.dumps(a['members']) if a else '')
        if cid == 'intimidate-cycle' and a:
            assert all('Mega' not in m['form'] for m in a['members'] if m['id'] in ('staraptor', 'salamence')), 'Mega form counted for Intimidate'
    return ok


def fmt_ans(v):
    a = v[3]
    tags = [a['class']]
    if a['partial']: tags.append('partial')
    if a['megaDependent']: tags.append('MEGA')
    if a['contestedBy']: tags.append('contested by ' + a['contestedBy'])
    return f"{SP[a['mon']]['name']}: {a['label']} ({', '.join(tags)})"


def redundancy(core, my, opp):
    weak = []
    for sid in my:
        rest = [x for x in my if x != sid]
        s, _ = status(core, answers_for(core, rest, opp), 'A')
        if s != 'Has answers':
            weak.append(SP[sid]['name'])
    return weak


def main():
    if '--tests' in sys.argv:
        sys.exit(0 if run_tests() else 1)
    path = next((a for a in sys.argv[1:] if a.endswith('.json')), os.path.join(HERE, 'league-snapshot-2026-10-03.json'))
    L = json.load(open(path))
    me = next(c for c in L['coaches'] if c['name'] == 'Anthony')
    my = [p['id'] for p in me['picks'] if p['id']]
    print('snapshot', L.get('fetchedAt'), '| Anthony:', my, '| pointsLeft', me['pointsLeft'], 'slotsLeft', me['slotsLeft'])
    avail = {a['id']: a['points'] for a in L['available']}
    enablers = {}
    for c in L['coaches']:
        if c['name'] == 'Anthony':
            continue
        roster = [p['id'] for p in c['picks'] if p['id']]
        maxspend = c['pointsLeft'] - max(0, c['slotsLeft'] - 1)
        print(f"\n== {c['order']}. {c['name']} ({len(roster)} picks, {c['pointsLeft']} pts, {c['slotsLeft']} left, max next pick {maxspend})")
        for core in SPEC['cores']:
            st, a = state(core, roster)
            if st and a['confidence'] == 'likely':
                ans = answers_for(core, my, roster)
                sA, cA = status(core, ans, 'A')
                sB, _ = status(core, ans, 'B')
                pool = '; '.join(f"{k}: {', '.join(v)}" for k, v in slot_pool(core, roster).items())
                mega = ' (uses the Mega)' if a['megas'] else ''
                print(f"  {st} {core['id']}{mega} | {pool}")
                print(f"      Anthony A:{sA} B:{sB} | " + '; '.join(fmt_ans(v) for v in cA))
                nonans = [x for x in ans if not x['counts']]
                if nonans:
                    print('      non-answers: ' + ', '.join(f"{SP[x['mon']]['name']}: {x['label']}" for x in nonans))
                if sA == 'Has answers':
                    w = redundancy(core, my, roster)
                    if w:
                        print('      single point of failure: ' + ', '.join(w))
            elif st:
                print(f"  ({st} but learnset-only: {core['id']})")
            elif c['slotsLeft'] > 0:
                adds = [(i, p) for i, p in avail.items() if p <= maxspend and state(core, roster + [i])[0] == 'fieldable'
                        and detect(core, roster + [i])['confidence'] == 'likely']
                for i, p in adds:
                    enablers.setdefault(i, (p, []))[1].append(f"{c['name']}:{core['id']}")
                if adds:
                    adds.sort(key=lambda x: -(SP[x[0]].get('pika') or {}).get('pct', 0))
                    print(f"  forming {core['id']}: one pick away via " + ', '.join(f"{i}({p})" for i, p in adds[:8]) + (f" +{len(adds)-8} more" if len(adds) > 8 else ''))
    print('\n== Cheap enablers: available mons that complete a likely core for 2+ opponents (cost <= 8, i.e. affordable for Anthony too)')
    for i, (p, lst) in sorted(enablers.items(), key=lambda x: (-len(x[1][1]), x[1][0])):
        if len(lst) >= 2 and p <= 8:
            print(f"  {i} ({p} pts): {', '.join(lst)}")
    print('\n== Anthony vs every core in the abstract (no opponent blockers), scenario A / B')
    for core in SPEC['cores']:
        ans = answers_for(core, my)
        sA, cA = status(core, ans, 'A')
        sB, _ = status(core, ans, 'B')
        print(f"  {core['id']:17s} A:{sA:15s} B:{sB:15s} " + '; '.join(fmt_ans(v) for v in cA))
    print('\n== Affordable picks for Anthony that fix weak cards (Thin / No answer -> Has answers, or remove a single point of failure)')
    mymax = me['pointsLeft'] - max(0, me['slotsLeft'] - 1)
    weak_cards = []
    for c in L['coaches']:
        if c['name'] == 'Anthony':
            continue
        roster = [p['id'] for p in c['picks'] if p['id']]
        for core in SPEC['cores']:
            st, a = state(core, roster)
            if st == 'fieldable' and a['confidence'] == 'likely':
                s, _ = status(core, answers_for(core, my, roster), 'A')
                spof = redundancy(core, my, roster) if s == 'Has answers' else []
                if s != 'Has answers' or spof:
                    weak_cards.append((c['name'], core, roster, s, spof))
    for name, core, _, s, spof in weak_cards:
        print(f"  weak: {name} {core['id']} -> {s}" + (f" (SPOF {', '.join(spof)})" if spof else ''))
    fixes = {}
    for i, p in avail.items():
        if p > mymax:
            continue
        for name, core, roster, s, spof in weak_cards:
            s2, _ = status(core, answers_for(core, my + [i], roster), 'A')
            # Thin -> Has answers counts as a fix; a SPOF card needs the SPOF removed
            ok = s2 == 'Has answers' and (s != 'Has answers' or not redundancy(core, my + [i], roster))
            if ok:
                fixes.setdefault(i, (p, []))[1].append(f"{name}:{core['id']}")
    for i, (p, lst) in sorted(fixes.items(), key=lambda x: (-len(x[1][1]), x[1][0]))[:25]:
        print(f"  {i} ({p} pts, usage {(SP[i].get('pika') or {}).get('pct', 0)}%): fixes {len(lst)}: {', '.join(lst)}")
    print('\n== Answer load: how many (opponent, likely core) cards each Anthony mon anchors')
    load = {}
    for c in L['coaches']:
        if c['name'] == 'Anthony':
            continue
        roster = [p['id'] for p in c['picks'] if p['id']]
        for core in SPEC['cores']:
            st, a = state(core, roster)
            if st == 'fieldable' and a['confidence'] == 'likely':
                _, cA = status(core, answers_for(core, my, roster), 'A')
                for v in cA:
                    if v[0]:
                        load[v[3]['mon']] = load.get(v[3]['mon'], 0) + 1
    for k, n in sorted(load.items(), key=lambda x: -x[1]):
        print(f"  {SP[k]['name']}: {n}")


if __name__ == '__main__':
    main()

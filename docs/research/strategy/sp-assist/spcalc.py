"""Reference damage / Stat Point calculator for the SP-assist research (Champions Reg M-C, level 50, doubles).

Research tool, not app code. It reimplements the Pokémon Showdown formulas so that the numbers in rotom-fan-case.md and
benchmarks-league.md can be reproduced and diffed against the app's vendored @smogon/calc. Sources (smogon/pokemon-showdown
master @ 3a766f2, 2026-10-13):
  stats      data/mods/champions/scripts.ts L10-38  (HP = base+SP+75; others = base+SP+20, nature x1.1/x0.9 truncated)
  base dmg   sim/battle-actions.ts L1709            tr(tr(tr(tr(2*L/5+2)*BP*A)/D)/50)
  modifiers  data/mods/champions/scripts.ts L196-311 (+2, spread 0.75, weather, crit, random, STAB, type, burn, ModifyDamage)
  random     sim/battle.ts L2395-2398              tr(tr(d*(100-r))/100), r in 0..15
  modify     sim/battle.ts L2336-2347; chainModify L2325-2334
  boosts     sim/pokemon.ts calculateStat (boostTable [1,1.5,2,2.5,3,3.5,4])
Data: drafarig data/mechanics.json (cloud-checkpoint cda8f0a, a projection of Showdown's Champions data; read as data,
nothing from that branch is executed) and the type chart in data/dex.json.
Scope (ponytail): only the abilities/items/moves the reference cases need; anything else raises instead of being ignored.
Run:  python3 spcalc.py      (self-checks)
"""
import json, os
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
MECH = json.load(open(os.environ.get('MECH', '/tmp/sp/mech.json')))
TC = json.load(open(os.path.join(ROOT, 'data', 'dex.json')))['typechart']
SPC, MOVES, NAT = MECH['species'], MECH['moves'], MECH['natures']
# mechanics.json has no Aegislash-Blade (the app handles it with wrapper rule W-AEGISLASH-FORME). Stats from Showdown
# data/pokedex.ts L12820-12827; Stance Change (data/abilities.ts L4524-4531) attacks from Blade forme.
SPC.setdefault('aegislashblade', dict(SPC['aegislash'], name='Aegislash-Blade',
                                      baseStats={'hp': 60, 'atk': 140, 'def': 50, 'spa': 140, 'spd': 50, 'spe': 60}))
tr = int  # Showdown trunc for non-negative numbers
aid = lambda s: ''.join(c for c in str(s).lower() if c.isalnum())


def modify(v, mod4096):
    return tr((tr(v * mod4096) + 2047) / 4096)


def chain(mods):
    m = 4096
    for x in mods:
        m = (m * x + 2048) >> 12
    return m


def stat(sid, s, sp, nature):
    base = SPC[sid]['baseStats'][s]
    if s == 'hp':
        return base + sp + 75
    v = base + sp + 20
    n = NAT[nature.lower()]
    if n['plus'] != n['minus']:
        if n['plus'] == s: v = tr(v * 110 / 100)
        elif n['minus'] == s: v = tr(v * 90 / 100)
    return v


def boosted(v, stage):
    t = [1, 1.5, 2, 2.5, 3, 3.5, 4]
    return tr(v * t[stage]) if stage >= 0 else tr(v / t[-stage])


def eff(mtype, types):
    m = 1.0
    for t in types:
        m *= TC[mtype][t]
    return m


BP_ITEM = {'magnet': 'Electric', 'sharpbeak': 'Flying', 'mysticwater': 'Water', 'charcoal': 'Fire', 'miracleseed': 'Grass',
           'nevermeltice': 'Ice', 'hardstone': 'Rock', 'softsand': 'Ground', 'blackbelt': 'Fighting', 'spelltag': 'Ghost',
           'twistedspoon': 'Psychic', 'blackglasses': 'Dark', 'metalcoat': 'Steel', 'dragonfang': 'Dragon',
           'silkscarf': 'Normal', 'poisonbarb': 'Poison', 'silverpowder': 'Bug', 'fairyfeather': 'Fairy'}
KNOWN_ABIL = {'levitate', 'intimidate', 'contrary', 'reckless', 'toughclaws', 'adaptability', 'drought', 'drizzle', 'aerilate',
              'parentalbond', 'technician', 'sheerforce', 'solarpower', 'blaze', 'torrent', 'overgrow', 'multiscale', 'innerfocus',
              'prankster', 'hospitality', 'heatproof', 'stancechange', 'hungerswitch', 'guts', 'ironfist', 'keeneye', 'raindish',
              'mimicry', 'swiftswim', 'thickfat', 'competitive', 'defiant', 'clearbody', 'pressure', 'unnerve', 'sandstream',
              'roughskin', 'sandveil', 'sandforce', 'stamina', 'sturdy', 'stalwart', 'goodasgold', 'grassysurge', 'regenerator',
              'snowwarning', 'flashfire', 'psychicsurge', 'owntempo', 'electricsurge', 'noguard', 'static', 'lightningrod',
              'moxie', 'unburden', 'poisontouch', 'cudchew', 'armortail', 'sapsipper', 'waterabsorb', 'damp', 'magicbounce',
              'chlorophyll', 'protean', 'marvelscale', 'cutecharm', 'emergencyexit', 'infiltrator', 'cursedbody', 'mirrorarmor',
              'voltabsorb', 'naturalcure', 'frisk', 'pickpocket', 'magician', 'sharpness', 'piercingdrill', 'moldbreaker', 'sandrush',
              'surgesurfer', 'illusion', 'supremeoverlord', 'download', 'sniper', 'whitesmoke', 'shellarmor', 'disguise', 'steadfast',
              'justified', 'auraguard', 'snowcloak', 'insomnia', 'hustle', 'slushrush', 'icebody', 'thermalexchange', 'scrappy',
              'earlybird', 'aromaveil', 'flowerveil', 'healer', 'klutz', 'synchronize', 'trace', 'swarm', 'shielddust',
              # no effect on these damage numbers (or effect triggers mid-battle and is out of scope: Berserk, Speed Boost)
              'flamebody', 'queenlymajesty', 'liquidooze', 'stickyhold', 'oblivious', 'quickfeet', 'gluttony', 'imposter',
              'screencleaner', 'speedboost', 'wanderingspirit', 'hypercutter', 'berserk',
              # modelled below
              'hugepower', 'waterbubble', 'punkrock', 'unaware', 'cloudnine', 'auraguard', 'thickfat', 'heatproof', 'disguise',
              'protean', 'moldbreaker', 'flashfire', 'voltabsorb', 'lightningrod', 'motordrive', 'waterabsorb', 'stormdrain',
              'dryskin', 'sapsipper', 'wellbakedbody', 'eartheater', 'levitate',
              # no effect on these numbers
              'illuminate', 'poisonpoint', 'symbiosis', 'telepathy', 'mimicry'}
IMMUNE = {'levitate': 'Ground', 'eartheater': 'Ground', 'flashfire': 'Fire', 'wellbakedbody': 'Fire', 'voltabsorb': 'Electric',
          'lightningrod': 'Electric', 'motordrive': 'Electric', 'waterabsorb': 'Water', 'stormdrain': 'Water', 'dryskin': 'Water',
          'sapsipper': 'Grass'}


def rolls(att, dfn, move_id, ctx=None):
    """16 damage rolls per hit -> list of hit roll-lists. att/dfn: dict(id, nature, sp{}, ability, item, boosts{}, hpPct)."""
    ctx = ctx or {}
    mv = dict(MOVES[move_id])
    for side in (att, dfn):
        if aid(side.get('ability', '')) not in KNOWN_ABIL:
            raise ValueError('unsupported ability ' + side.get('ability', ''))
    a_types, d_types = SPC[att['id']]['types'], SPC[dfn['id']]['types']
    aab, dab = aid(att.get('ability', '')), aid(dfn.get('ability', ''))
    weather = None if 'cloudnine' in (aab, dab) else ctx.get('weather')
    mtype, bp = mv['type'], mv['basePower']
    if move_id == 'weatherball' and weather:
        mtype, bp = {'rain': 'Water', 'sun': 'Fire', 'sand': 'Rock', 'snow': 'Ice'}[weather], 100
    if aab == 'aerilate' and mtype == 'Normal':
        mtype, aerilate = 'Flying', True
    else:
        aerilate = False
    if aab == 'moldbreaker':
        dab = ''  # ponytail: treats every defensive ability as breakable; fine for the abilities modelled here
    e = eff(mtype, d_types)
    if e == 0 or IMMUNE.get(dab) == mtype:
        return [[0] * 16]
    if dab == 'disguise' and dfn.get('hpPct', 100) == 100:
        # Disguise takes the first hit for 1/8 max HP chip (gen 8+); later hits are normal. Modelled for the first hit only.
        return [[stat(dfn['id'], 'hp', dfn['sp'].get('hp', 0), dfn['nature']) // 8] * 16]
    if move_id == 'finalgambit':
        hp = stat(att['id'], 'hp', att['sp'].get('hp', 0), att['nature'])
        return [[hp] * 16]
    phys = mv['category'] == 'Physical'
    # base power modifiers (BasePower event)
    bpm = []
    if ctx.get('helpingHand'): bpm.append(6144)
    if BP_ITEM.get(att.get('item', '')) == mtype: bpm.append(4915)
    if att.get('item') == 'wiseglasses' and not phys: bpm.append(4505)
    if att.get('item') == 'muscleband' and phys: bpm.append(4505)
    if aab == 'toughclaws' and 'contact' in mv['flags']: bpm.append(5325)
    if aerilate: bpm.append(4915)
    if aab == 'reckless' and move_id in ('bravebird', 'doubleedge', 'flareblitz', 'woodhammer', 'headsmash', 'wildcharge'): bpm.append(4915)
    if aab == 'technician' and bp <= 60: bpm.append(6144)
    if aab == 'ironfist' and 'punch' in mv['flags']: bpm.append(4915)
    if aab == 'sharpness' and 'slicing' in mv['flags']: bpm.append(6144)
    if aab == 'punkrock' and 'sound' in mv['flags']: bpm.append(5325)
    terrain = ctx.get('terrain')
    grounded = aab != 'levitate' and 'Flying' not in a_types and att.get('item') != 'airballoon'
    if terrain and grounded and {'electric': 'Electric', 'grassy': 'Grass', 'psychic': 'Psychic'}.get(terrain) == mtype: bpm.append(5325)
    if bpm: bp = max(1, modify(bp, chain(bpm)))
    # attack / defense
    if move_id == 'bodypress':
        a_stat, a_from = 'def', att
    else:
        a_stat, a_from = ('atk' if phys else 'spa'), att
    d_stat = 'def' if phys else 'spd'
    A = stat(a_from['id'], a_stat, a_from['sp'].get(a_stat, 0), a_from['nature'])
    D = stat(dfn['id'], d_stat, dfn['sp'].get(d_stat, 0), dfn['nature'])
    ab, db = att.get('boosts', {}).get(a_stat, 0), dfn.get('boosts', {}).get(d_stat, 0)
    if ctx.get('crit'):
        ab, db = max(ab, 0), min(db, 0)
    if dab == 'unaware': ab = 0
    if aab == 'unaware': db = 0
    A, D = boosted(A, ab), boosted(D, db)
    am = []
    if aab == 'hugepower' and phys: am.append(8192)
    if aab == 'waterbubble' and mtype == 'Water': am.append(8192)
    if dab == 'waterbubble' and mtype == 'Fire': am.append(2048)
    if dab == 'thickfat' and mtype in ('Fire', 'Ice'): am.append(2048)
    if dab == 'heatproof' and mtype == 'Fire': am.append(2048)
    if aab == 'solarpower' and weather == 'sun' and not phys: am.append(6144)
    if aab == 'hustle' and phys: am.append(6144)
    if am: A = modify(A, chain(am))
    if weather == 'sand' and 'Rock' in d_types and not phys: D = modify(D, 6144)
    if weather == 'snow' and 'Ice' in d_types and phys: D = modify(D, 6144)
    base = tr(tr(tr(22 * bp * A) / D) / 50) + 2
    if ctx.get('spread') and mv['target'] in ('allAdjacent', 'allAdjacentFoes'): base = modify(base, 3072)
    hits = [0]
    if aab == 'parentalbond' and not mv.get('multihit') and mv['target'] in ('normal', 'any'): hits = [0, 1]
    if mv.get('multihit'):
        n = mv['multihit'] if isinstance(mv['multihit'], int) else ctx.get('hits')
        if n is None:
            raise ValueError(f'{move_id}: variable hit count, pass ctx hits (see multihit_mix)')
        hits = list(range(n))
    if weather == 'rain' and mtype == 'Water' or weather == 'sun' and mtype == 'Fire': base = modify(base, 6144)
    if weather == 'rain' and mtype == 'Fire' or weather == 'sun' and mtype == 'Water': base = modify(base, 2048)
    out = []
    for h in hits:
        b0 = modify(base, 1024) if (aab == 'parentalbond' and h == 1) else base
        if ctx.get('crit'): b0 = tr(b0 * 1.5)
        hit = []
        for r in range(16):
            d = tr(tr(b0 * (100 - r)) / 100)
            if mtype in a_types or aab == 'protean':  # Protean: STAB on the first move after switching in
                d = modify(d, 8192 if aab == 'adaptability' else 6144)
            steps = {4: 2, 2: 1, 1: 0, 0.5: -1, 0.25: -2}[e]
            for _ in range(max(steps, 0)): d *= 2
            for _ in range(max(-steps, 0)): d = tr(d / 2)
            fm = []
            if ctx.get('screens') and not ctx.get('crit') and aab != 'infiltrator': fm.append(2732)
            if dab == 'multiscale' and dfn.get('hpPct', 100) == 100: fm.append(2048)
            if dab == 'punkrock' and 'sound' in mv['flags']: fm.append(2048)
            if dab == 'auraguard' and 'contact' in mv['flags']: fm.append(2048)
            if att.get('item') == 'lifeorb': fm.append(5324)
            if att.get('item') == 'expertbelt' and e > 1: fm.append(4915)
            if fm: d = modify(d, chain(fm))
            hit.append(max(1, d % 65536))
        out.append(sorted(hit))
    return out


def _conv(a, b):
    out = Counter()
    for x, px in a.items():
        for y, py in b.items():
            out[x + y] += px * py
    return out


def dist(hit_lists, uses=1):
    """Damage distribution {damage: weight} of `uses` uses of a move given per-hit roll lists (rolls equiprobable)."""
    acc = Counter({0: 1})
    for _ in range(uses):
        for h in hit_lists:
            acc = _conv(acc, Counter(h))
    return acc


def ko_chance(hit_lists, hp, uses=1):
    """Exact probability that `uses` uses of the move deal >= hp (no recovery or chip in between)."""
    d = dist(hit_lists, uses)
    return sum(p for x, p in d.items() if x >= hp) / sum(d.values())


def multihit_mix(move_id, ability=''):
    """[(weight, hits)] for a move: fixed count, or 2-5 hits at 35/35/15/15% (Skill Link: 5), per Showdown
    sim/battle-actions.ts (gen 5+ multihit distribution)."""
    mh = MOVES[move_id].get('multihit')
    if not isinstance(mh, list):
        return [(1.0, None)]
    if aid(ability) == 'skilllink':
        return [(1.0, mh[1])]
    if mh == [2, 5]:
        return [(0.35, 2), (0.35, 3), (0.15, 4), (0.15, 5)]
    raise ValueError(f'{move_id}: multihit {mh} not modelled')


def mon(sid, nature, sp, ability, item='', boosts=None, hpPct=100):
    return {'id': sid, 'nature': nature, 'sp': dict(sp), 'ability': ability, 'item': item, 'boosts': boosts or {}, 'hpPct': hpPct}


def sp_from(s):
    """'Jolly:29/1/0/0/4/32' -> (nature, sp dict)."""
    nat, nums = s.split(':')
    return nat, dict(zip(['hp', 'atk', 'def', 'spa', 'spd', 'spe'], map(int, nums.split('/'))))


def _selfcheck():
    # Stats: Rotom-Fan 32 SpA Modest = floor((105+32+20)*1.1) = 172; Mega Staraptor 0 HP = 160, 0 SpD Jolly = 110.
    assert stat('rotomfan', 'spa', 32, 'Modest') == 172
    assert stat('staraptormega', 'hp', 0, 'Jolly') == 160 and stat('staraptormega', 'spd', 0, 'Jolly') == 110
    # Hand calc, neutral 32 SpA Thunderbolt into 0/0 Jolly Mega Staraptor: base tr(tr(22*90*157/110)/50)+2 = 58;
    # roll 85: tr(58*85/100)=49 -> STAB modify(49,6144)=73 -> x2 = 146. roll 100: 58 -> 87 -> 174.
    r = rolls(mon('rotomfan', 'Serious', {'spa': 32}, 'Levitate'), mon('staraptormega', 'Jolly', {}, 'Contrary'), 'thunderbolt')
    assert r[0][0] == 146 and r[0][-1] == 174, r
    # Final Gambit = user's HP regardless of resistances (Fighting into Electric/Flying).
    fg = rolls(mon('staraptor', 'Jolly', {'hp': 32}, 'Intimidate'), mon('rotomfan', 'Calm', {'hp': 32}, 'Levitate'), 'finalgambit')
    assert fg[0][0] == 192
    assert abs(ko_chance([[1] * 8 + [2] * 8], 2) - 0.5) < 1e-9
    # Goldens from the app's test/calc-engine.test.mjs L33-46 (cloud-checkpoint; hand-worked from the simulator order).
    chomp = mon('garchomp', 'Jolly', {'atk': 32, 'spe': 32, 'hp': 2}, 'Rough Skin')
    inci = mon('incineroar', 'Careful', {'hp': 32, 'def': 2, 'spd': 32}, 'Blaze')
    assert rolls(chomp, inci, 'earthquake', {'spread': True})[0] == [138, 140, 140, 144, 144, 146, 150, 150, 152, 152, 156, 156, 158, 158, 162, 164]
    assert rolls(chomp, inci, 'earthquake')[0] == [186, 186, 188, 192, 192, 194, 198, 200, 200, 204, 206, 210, 210, 212, 216, 218]
    chomp['boosts'] = {'atk': -1}
    assert rolls(chomp, inci, 'earthquake', {'spread': True})[0] == [92, 92, 96, 96, 96, 98, 98, 102, 102, 102, 104, 104, 104, 108, 108, 110]
    assert rolls(chomp, inci, 'earthquake', {'spread': True, 'crit': True})[0] == [206, 210, 212, 216, 216, 218, 222, 224, 228, 230, 230, 234, 236, 240, 242, 246]
    sala = mon('salamencemega', 'Adamant', {'atk': 32, 'spe': 32, 'hp': 2}, 'Aerilate', 'salamencite')
    gambit = mon('kingambit', 'Adamant', {'hp': 32, 'atk': 32, 'def': 2}, 'Defiant')
    assert rolls(sala, gambit, 'doubleedge')[0] == [62, 63, 63, 64, 65, 66, 66, 67, 68, 69, 69, 70, 71, 72, 72, 73]
    zard = mon('charizardmegay', 'Timid', {'spa': 32, 'spe': 32, 'hp': 2}, 'Drought', 'charizarditey')
    rilla = mon('rillaboom', 'Adamant', {'hp': 32, 'atk': 32, 'spd': 2}, 'Overgrow')
    assert rolls(zard, rilla, 'heatwave', {'spread': True, 'weather': 'sun'})[0] == [276, 278, 282, 284, 290, 294, 296, 300, 302, 306, 308, 312, 314, 318, 320, 326]
    print('selfcheck ok (incl. 6 app engine goldens)')


if __name__ == '__main__':
    _selfcheck()

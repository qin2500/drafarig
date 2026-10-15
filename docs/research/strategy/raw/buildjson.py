import json, csv
exec(open('/tmp/drafarig-ps/annot.py').read())
d = json.load(open('/tmp/drafarig-ps/dataset.json'))
LS = json.load(open('/tmp/drafarig-ps/learnsets.json'))
MV = json.load(open('/tmp/drafarig-ps/moves.json'))
PK = json.load(open('/tmp/drafarig-ps/pika.json'))
BY = json.load(open('/tmp/drafarig-ps/drafted.json'))

SPREAD = {'heatwave','rockslide','earthquake','hypervoice','dazzlinggleam','muddywater','surf','discharge','blizzard','expandingforce','makeitrain','matchagotcha','sludgewave','breakingswipe','eruption','waterspout','bulldoze','lavaplume','boomburst','snarl','icywind','electroweb','glaciate','originpulse','lusterpurge','petalblizzard','razorleaf','aircutter','mountaingale','alluringvoice','struggleBug','strugglebug','bleakwindstorm','dragonenergy','lunge'}
SPREAD_DMG = {'heatwave':'Fire','rockslide':'Rock','earthquake':'Ground','hypervoice':'Normal','dazzlinggleam':'Fairy','muddywater':'Water','surf':'Water','discharge':'Electric','blizzard':'Ice','expandingforce':'Psychic','makeitrain':'Steel','matchagotcha':'Grass','sludgewave':'Poison','breakingswipe':'Dragon','eruption':'Fire','waterspout':'Water','lavaplume':'Fire','boomburst':'Normal','petalblizzard':'Grass','aircutter':'Flying','mountaingale':'Ice','alluringvoice':'Fairy'}
PRIO = {'suckerpunch','aquajet','grassyglide','extremespeed','bulletpunch','iceshard','shadowsneak','machpunch','vacuumwave','upperhand','firstimpression','jetpunch','accelerock','thunderclap'}
SETUP = {'swordsdance','nastyplot','dragondance','calmmind','bulkup','shellsmash','quiverdance','bellydrum','coil','shiftgear','clangoroussoul','tailglow','geomancy','victorydance','curse','irondefense','agility'}
STATUS = {'willowisp','thunderwave','spore','sleeppowder','yawn','nuzzle','glare','stunspore','hypnosis'}
DISR = {'taunt','encore','snarl','knockoff','faketears','imprison','quash'}
PIVOT = {'uturn','voltswitch','flipturn','partingshot','chillyreception','shedtail'}
HEAL = {'lifedew','pollenpuff','healpulse','floralhealing','junglehealing','lunarblessing'}

def best(p, key):
    vals = [p['baseStats'][key]] + [m['baseStats'][key] for m in p['megas'] if m['legal']]
    return max(vals)
def allabils(p):
    return set(p['abilities']) | {m['ability'] for m in p['megas'] if m['legal']}
def alltypes(p):
    s = set(p['types'])
    for m in p['megas']:
        if m['legal']: s |= set(m['types'])
    return s

def roles(p):
    ls = set(LS[p['name']]); ab = allabils(p); r = []
    atk = best(p,'atk'); spa = best(p,'spa'); off = max(atk, spa)
    minspe = min([p['baseStats']['spe']] + [m['baseStats']['spe'] for m in p['megas'] if m['legal']])
    bulk = max([p['baseStats']['hp']+p['baseStats']['def']+p['baseStats']['spd']] + [m['baseStats']['hp']+m['baseStats']['def']+m['baseStats']['spd'] for m in p['megas'] if m['legal']])
    def add(x):
        if x not in r: r.append(x)
    if 'fakeout' in ls: add('fake-out')
    if 'tailwind' in ls: add('tailwind')
    if 'trickroom' in ls: add('trick-room')
    if ls & {'followme','ragepowder'}: add('redirection')
    if 'Intimidate' in ab: add('intimidate')
    if 'Prankster' in ab: add('prankster')
    if ls & {'icywind','electroweb'}: add('speed-drop')
    if 'wideguard' in ls: add('wide-guard')
    if 'quickguard' in ls: add('quick-guard')
    if 'helpinghand' in ls and off < 110: add('helping-hand')
    if ls & PIVOT: add('pivot')
    if ls & STATUS: add('status')
    if ls & DISR: add('disruption')
    if ('reflect' in ls and 'lightscreen' in ls) or 'auroraveil' in ls: add('screens')
    if ls & HEAL or 'Hospitality' in ab: add('healer')
    if 'perishsong' in ls: add('perish-trap')
    if 'Drought' in ab: add('sun-setter')
    if 'Drizzle' in ab: add('rain-setter')
    if ab & {'Sand Stream','Sand Spit'}: add('sand-setter')
    if 'Snow Warning' in ab: add('snow-setter')
    if ab & {'Grassy Surge','Psychic Surge','Electric Surge','Misty Surge','Seed Sower'}: add('terrain-setter')
    ty = alltypes(p)
    if ab & {'Chlorophyll','Solar Power','Mega Sol','Harvest','Flower Gift','Leaf Guard'} or ('Fire' in ty and spa >= 100): add('sun-abuser')
    if ab & {'Swift Swim','Rain Dish','Dry Skin','Hydration'} or ('Water' in ty and off >= 100) or ('thunder' in ls and 'Electric' in ty and spa >= 95) or ('hurricane' in ls and 'Flying' in ty and 'Fire' not in ty and spa >= 95) or ('electroshot' in ls): add('rain-abuser')
    if ab & {'Sand Rush','Sand Force'}: add('sand-abuser')
    if ab & {'Slush Rush','Ice Body'} or ('Ice' in ty and off >= 95): add('snow-abuser')
    if minspe <= 55 and off >= 100: add('tr-abuser')
    for mv, typ in SPREAD_DMG.items():
        if mv in ls and (typ in ty or (typ=='Normal' and ab & {'Pixilate','Aerilate','Refrigerate','Liquid Voice','Dragonize'})):
            stat = atk if MV[mv]['cat']=='Physical' else spa
            if stat >= 95: add('spread-attacker'); break
    if ls & PRIO or 'Gale Wings' in ab: add('priority')
    if ls & SETUP: add('setup')
    if atk >= 100: add('physical-attacker')
    if spa >= 100: add('special-attacker')
    if bulk >= 300: add('bulky')
    if any(m['legal'] for m in p['megas']): add('mega')
    return r

ARCH = {
 'sun-setter':'sun','sun-abuser':'sun','rain-setter':'rain','rain-abuser':'rain','sand-setter':'sand','sand-abuser':'sand',
 'snow-setter':'snow','snow-abuser':'snow','trick-room':'trick-room','tr-abuser':'trick-room','tailwind':'tailwind',
 'perish-trap':'perish-trap'}
def archetypes(p, r):
    a = []
    for k,v in ARCH.items():
        if k in r and v not in a: a.append(v)
    ab = allabils(p)
    if 'Psychic Surge' in ab or ('expandingforce' in LS[p['name']] and best(p,'spa')>=100): a.append('psychic-spam')
    if 'Grassy Surge' in ab or 'grassyglide' in LS[p['name']]: a.append('grassy-terrain')
    if 'Electric Surge' in ab or 'risingvoltage' in LS[p['name']]: a.append('electric-terrain')
    if 'fake-out' in r or 'intimidate' in r or 'redirection' in r: a.append('goodstuffs-support')
    if 'tailwind' in r or best(p,'spe') >= 100: a.append('hyper-offense')
    return a

def keymoves(p, r):
    u = PK.get(p['name'], {})
    mv = [m for m,pct in u.get('moves', []) if float(pct.rstrip('%')) >= 5][:6]
    if len(mv) >= 4: return mv, 'pikalytics'
    ls = LS[p['name']]
    pref = ['fakeout','tailwind','trickroom','followme','ragepowder','partingshot','wideguard','icywind','electroweb','helpinghand','willowisp','thunderwave','spore','sleeppowder','perishsong','encore','taunt','snarl','auroraveil','lifedew','pollenpuff','coaching','quickguard','uturn','voltswitch','flipturn','knockoff']
    out = [MV[m]['name'] for m in pref if m in ls][:3]
    ty = alltypes(p); atk = best(p,'atk'); spa = best(p,'spa')
    cat = 'Physical' if atk >= spa else 'Special'
    stabs = sorted([m for m in ls if MV.get(m) and MV[m]['cat']==cat and MV[m]['type'] in ty and (MV[m]['bp'] or 0) >= 60 and m not in ('hyperbeam','gigaimpact','selfdestruct','explosion','focuspunch','skyattack','solarbeam','solarblade','meteorbeam','dig','dive','fly','bounce','phantomforce','outrage','thrash','petaldance','lastresort')], key=lambda m: -(MV[m]['bp'] * (1.5 if MV[m]['target'] in ('allAdjacentFoes','allAdjacent') else 1) + (40 if MV[m]['pri'] > 0 else 0)))
    seen = set()
    for m in stabs:
        if MV[m]['type'] in seen: continue
        seen.add(MV[m]['type']); out.append(MV[m]['name'])
        if len(out) >= 5: break
    if 'protect' in ls: out.append('Protect')
    return out[:6], 'learnset-derived'

TIERVAL = {'S':5,'A':4,'B':3,'C':2,'D':1}
FAIR = {'S':(18,20),'A':(14,20),'B':(8,17),'C':(3,10),'D':(1,4)}
def valuenote(p, tier, r):
    c = p['cost']; lo, hi = FAIR[tier]
    if c < lo: v = f'UNDERPRICED: {tier}-tier at {c} pts (typical {lo}-{hi}).'
    elif c > hi: v = f'OVERPRICED: {tier}-tier at {c} pts (fair {lo}-{hi}).'
    else: v = f'Fairly priced: {tier}-tier at {c} pts.'
    sup = [x for x in r if x in ('fake-out','tailwind','trick-room','redirection','intimidate','prankster','wide-guard','speed-drop')]
    if c <= 4 and sup: v += ' Cheap source of ' + ', '.join(sup) + '.'
    megas = [m['name'] for m in p['megas'] if m['legal']]
    if len(megas) > 1: v += f' Includes {len(megas)} Megas ({", ".join(megas)}) — extra team-preview flexibility.'
    elif megas: v += f' Includes {megas[0]} at no extra cost (but only one Mega per battle).'
    return v

out = []
for p in sorted(d, key=lambda x: (-x['cost'], x['name'])):
    name = p['name']
    tier, _ = T.get(name, ['D', None])
    r = roles(p)
    km, kmsrc = keymoves(p, r)
    u = PK.get(name, {})
    note = N.get(name, '') or ''
    usage = u.get('usage')
    o = {
      'name': name, 'boardName': p['boardName'], 'zhName': p['zh'], 'cost': p['cost'],
      'draftedBy': BY.get(name),
      'types': p['types'], 'baseStats': p['baseStats'], 'abilities': p['abilities'],
      'megas': [{'name':m['name'],'types':m['types'],'ability':m['ability'],'baseStats':m['baseStats'],'stone':m['stone']} for m in p['megas'] if m['legal']],
      'roles': r, 'keyMoves': km, 'keyMovesSource': kmsrc, 'tier': tier,
      'archetypes': archetypes(p, r),
      'usage': {'pct': float(usage) if usage else None, 'rank': int(u['rank']) if u.get('rank','').isdigit() else None, 'winrate': float(u['winrate']) if u.get('winrate') else None,
                'topItems': [i for i,_ in u.get('items',[])[:4]], 'topTeammates': [i for i,_ in u.get('teammates',[])[:6]], 'source':'pikalytics gen9championsvgc2026regmc, 2026-10-02'} if u else None,
      'notes': note,
      'valueNote': valuenote(p, tier, r),
    }
    out.append(o)
json.dump(out, open('/Users/anthony/.claude/jobs/e684a1f7/tmp/research/strategy/pokemon.json','w'), ensure_ascii=False, indent=1)
print(len(out))
import collections
print(collections.Counter(o['tier'] for o in out))
for o in out:
    if o['name'] in ('Charizard','Squawkabilly','Toxicroak','Azumarill','Kangaskhan','Floette-Eternal'): print(json.dumps(o,ensure_ascii=False)[:900])

"""Generate the simulation candidate teams (docs/research/strategy/sim/zhuzi-candidates.md).
Writes tools/sim/candidates/zhuzi.json. Every set is checked against data/mechanics.json: species legal, ability legal for the
species (Mega: base ability; the stone gives the Mega's), every move in the Champions learnset, item in the regulation pool,
item clause per team, at most one Mega stone per team, SP <= 32 per stat and <= 66 total, weights sum to 1 per side.
Run: python3 gen_candidates.py"""
import json, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))
M = json.load(open(os.path.join(ROOT, 'data', 'mechanics.json')))
SP, LM, LS, ITEMS, MOVES, ABIL = M['species'], M['learnsetMoves'], M['learnsets'], M['items'], M['moves'], M['abilities']
tid = lambda s: ''.join(c for c in s.lower() if c.isalnum())
STATS = ['HP', 'Atk', 'Def', 'SpA', 'SpD', 'Spe']


def S(name, species, item, ability, nature, sp, moves, note=''):
    return dict(name=name, species=species, item=item, ability=ability, nature=nature, sp=sp, moves=moves, note=note)


# ---------------- ZhuZi set library (L = ladder-based, W = worst-case / anti-Anthony, H = human / comfort) ----------------
Z = {
    'meta_mega': S('Metagross', 'metagross', 'Metagrossite', 'Clear Body', 'Jolly', [2, 32, 0, 0, 0, 32], ['Psychic Fangs', 'Iron Head', 'Stomping Tantrum', 'Protect'], 'L: modal Mega set'),
    'meta_mega_bulk': S('Metagross', 'metagross', 'Metagrossite', 'Clear Body', 'Adamant', [24, 15, 0, 0, 0, 27], ['Psychic Fangs', 'Iron Head', 'Bullet Punch', 'Protect'], 'L: 2nd ladder spread'),
    'meta_mega_rock': S('Metagross', 'metagross', 'Metagrossite', 'Clear Body', 'Jolly', [2, 32, 0, 0, 0, 32], ['Psychic Fangs', 'Iron Head', 'Rock Slide', 'Protect'], 'W: Rock Slide for Charizard'),
    'meta_scarf': S('Metagross', 'metagross', 'Choice Scarf', 'Clear Body', 'Jolly', [2, 32, 0, 0, 0, 32], ['Psychic Fangs', 'Iron Head', 'Explosion', 'Rock Slide'], 'L/H: non-Mega Scarf'),
    'rotomw': S('Rotom-Wash', 'rotomwash', 'Sitrus Berry', 'Levitate', 'Modest', [32, 0, 4, 8, 16, 6], ['Hydro Pump', 'Will-O-Wisp', 'Thunderbolt', 'Protect'], 'L'),
    'rotomw_scarf': S('Rotom-Wash', 'rotomwash', 'Choice Scarf', 'Levitate', 'Timid', [2, 0, 0, 32, 0, 32], ['Hydro Pump', 'Thunderbolt', 'Volt Switch', 'Electroweb'], 'L: Scarf'),
    'pult': S('Dragapult', 'dragapult', 'Life Orb', 'Clear Body', 'Modest', [2, 0, 0, 32, 0, 32], ['Draco Meteor', 'Shadow Ball', 'Will-O-Wisp', 'Protect'], 'L'),
    'pult_sash': S('Dragapult', 'dragapult', 'Focus Sash', 'Clear Body', 'Timid', [2, 0, 0, 32, 0, 32], ['Draco Meteor', 'Shadow Ball', 'Will-O-Wisp', 'Protect'], 'L: Sash (item clause)'),
    'pult_phys': S('Dragapult', 'dragapult', 'Life Orb', 'Clear Body', 'Jolly', [2, 32, 0, 0, 0, 32], ['Dragon Darts', 'Phantom Force', 'Will-O-Wisp', 'Protect'], 'H: physical (10% ladder Jolly)'),
    'krook_scarf': S('Krookodile', 'krookodile', 'Choice Scarf', 'Intimidate', 'Jolly', [2, 32, 0, 0, 0, 32], ['High Horsepower', 'Knock Off', 'Rock Slide', 'Close Combat'], 'L: Scarf 42%'),
    'krook_bulk': S('Krookodile', 'krookodile', 'Passho Berry', 'Intimidate', 'Impish', [32, 0, 3, 0, 25, 6], ['Knock Off', 'High Horsepower', 'Rock Slide', 'Protect'], 'L: bulky Impish'),
    'krook_lo': S('Krookodile', 'krookodile', 'Life Orb', 'Intimidate', 'Adamant', [2, 32, 0, 0, 0, 32], ['Rock Slide', 'Stone Edge', 'High Horsepower', 'Protect'], 'W: anti-Charizard'),
    'nape': S('Infernape', 'infernape', 'Focus Sash', 'Blaze', 'Hasty', [0, 2, 0, 32, 0, 32], ['Fake Out', 'Heat Wave', 'Close Combat', 'Protect'], 'L'),
    'nape_lo': S('Infernape', 'infernape', 'Life Orb', 'Blaze', 'Timid', [2, 0, 0, 32, 0, 32], ['Fake Out', 'Overheat', 'Aura Sphere', 'Protect'], 'L: Life Orb'),
    'king': S('Slowking-Galar', 'slowkinggalar', 'Colbur Berry', 'Regenerator', 'Sassy', [32, 0, 5, 19, 10, 0], ['Trick Room', 'Chilly Reception', 'Sludge Bomb', 'Protect'], 'L'),
    'king_gem': S('Slowking-Galar', 'slowkinggalar', 'Sitrus Berry', 'Regenerator', 'Quiet', [32, 0, 2, 32, 0, 0], ['Trick Room', 'Psychic', 'Sludge Bomb', 'Power Gem'], 'W: Power Gem for Charizard'),
    'florges': S('Florges', 'florges', 'Leftovers', 'Flower Veil', 'Modest', [32, 0, 0, 32, 2, 0], ['Moonblast', 'Dazzling Gleam', 'Calm Mind', 'Protect'], 'L'),
    'florges_supp': S('Florges', 'florges', 'Sitrus Berry', 'Flower Veil', 'Bold', [32, 0, 16, 0, 18, 0], ['Moonblast', 'Helping Hand', 'Pollen Puff', 'Protect'], 'H: support'),
    'oran': S('Oranguru', 'oranguru', 'Mental Herb', 'Inner Focus', 'Relaxed', [32, 0, 32, 0, 2, 0], ['Trick Room', 'Instruct', 'Psychic', 'Protect'], 'L'),
    'oran_imp': S('Oranguru', 'oranguru', 'Sitrus Berry', 'Inner Focus', 'Sassy', [32, 0, 2, 0, 32, 0], ['Trick Room', 'Instruct', 'Imprison', 'Foul Play'], 'W: Imprison vs our Trick Room'),
    'tox': S('Toxtricity', 'toxtricity', 'Life Orb', 'Punk Rock', 'Modest', [1, 0, 0, 32, 1, 32], ['Overdrive', 'Sludge Bomb', 'Boomburst', 'Protect'], 'L'),
    'tox_scarf': S('Toxtricity', 'toxtricity', 'Choice Scarf', 'Punk Rock', 'Timid', [1, 0, 0, 32, 1, 32], ['Overdrive', 'Boomburst', 'Sludge Bomb', 'Volt Switch'], 'L: Scarf 25%'),
    'tox_tr': S('Toxtricity', 'toxtricity', 'Throat Spray' if 'throatspray' in ITEMS else 'Sitrus Berry', 'Punk Rock', 'Quiet', [32, 0, 0, 32, 2, 0], ['Overdrive', 'Boomburst', 'Sludge Bomb', 'Protect'], 'W: Trick Room / Instruct target'),
    'umb': S('Umbreon', 'umbreon', 'Leftovers', 'Inner Focus', 'Bold', [30, 0, 16, 0, 20, 0], ['Foul Play', 'Snarl', 'Moonlight', 'Protect'], 'L'),
    'umb_supp': S('Umbreon', 'umbreon', 'Sitrus Berry', 'Inner Focus', 'Careful', [32, 0, 24, 0, 10, 0], ['Foul Play', 'Taunt', 'Helping Hand', 'Protect'], 'H/W: Taunt our Trick Room'),
}

# ---------------- ZhuZi teams: (id, label, weight, [set keys], why) ----------------
ZT = [
    ('z01', 'Goodstuffs offense (ladder sets)', 0.09, ['meta_mega', 'pult', 'rotomw', 'krook_scarf', 'nape', 'tox_scarf'], 'His six most expensive attackers + Fake Out; ladder sets'),
    ('z02', 'Goodstuffs, Life Orb Toxtricity', 0.07, ['meta_mega', 'pult_sash', 'rotomw', 'krook_scarf', 'nape', 'tox'], 'Same core, Toxtricity Life Orb (its top ladder item)'),
    ('z03', 'Anti-Charizard rocks', 0.07, ['meta_mega_rock', 'pult_sash', 'rotomw', 'krook_lo', 'nape', 'tox_scarf'], 'Prep vs Anthony: Rock Slide on Metagross + Life Orb Krookodile'),
    ('z04', 'Trick Room + Instruct', 0.07, ['oran', 'tox_tr', 'meta_mega', 'king', 'krook_bulk', 'rotomw'], 'Two TR setters drafted; Instruct Overdrive'),
    ('z05', 'Trick Room + Instruct, Imprison', 0.04, ['oran_imp', 'tox_tr', 'meta_mega_bulk', 'king', 'krook_bulk', 'pult_sash'], 'Prep vs Sinistcha TR: Imprison Oranguru'),
    ('z06', 'Hybrid: TR mode + fast mode', 0.06, ['meta_mega', 'oran', 'tox', 'pult_sash', 'krook_scarf', 'nape'], 'Brings TR as an option, not a full TR team'),
    ('z07', 'Snow / Chilly Reception pivot', 0.04, ['king', 'meta_mega', 'pult', 'rotomw', 'krook_scarf', 'tox_scarf'], 'Chilly Reception vs our sun'),
    ('z08', 'Anti-Anthony full prep', 0.06, ['meta_mega_rock', 'krook_lo', 'tox_scarf', 'umb', 'king_gem', 'pult_sash'], 'Rocks + Power Gem for Charizard, Foul Play for Aegislash / Kangaskhan'),
    ('z09', 'Bulky Foul Play balance', 0.04, ['meta_mega', 'umb', 'rotomw', 'krook_bulk', 'tox', 'florges'], 'Umbreon + Florges bulk'),
    ('z10', 'Fairy / Fake Out balance', 0.03, ['meta_mega', 'florges', 'nape', 'pult', 'krook_scarf', 'rotomw_scarf'], 'Florges comfort pick'),
    ('z11', 'Human: Scarf Metagross no Mega', 0.03, ['meta_scarf', 'pult', 'rotomw', 'krook_bulk', 'nape', 'tox_scarf'], 'Suboptimal: skips the Mega'),
    ('z12', 'Human: physical Dragapult', 0.03, ['meta_mega', 'pult_phys', 'rotomw', 'krook_scarf', 'nape', 'tox_scarf'], 'Comfort physical Dragapult'),
    ('z13', 'Offense, Life Orb Infernape', 0.04, ['meta_mega', 'pult_sash', 'rotomw', 'krook_scarf', 'nape_lo', 'tox_scarf'], 'Overheat / Aura Sphere Infernape'),
    ('z14', 'Scarf Rotom-Wash offense', 0.03, ['meta_mega', 'pult', 'rotomw_scarf', 'krook_bulk', 'nape', 'tox_tr'], 'Scarf Rotom-Wash'),
    ('z15', 'TR + Fake Out', 0.04, ['oran', 'nape', 'meta_mega_bulk', 'tox_tr', 'king', 'krook_bulk'], 'Infernape Fake Out protects the TR turn'),
    ('z16', 'Oranguru + Florges support', 0.03, ['oran', 'florges_supp', 'meta_mega', 'tox_tr', 'krook_bulk', 'rotomw'], 'Two supports, Pollen Puff / Helping Hand'),
    ('z17', 'Anti-Sinistcha: Taunt + Imprison', 0.03, ['umb_supp', 'oran_imp', 'meta_mega', 'tox', 'krook_scarf', 'pult_sash'], 'Prep vs our TR'),
    ('z18', 'Rock spam', 0.03, ['meta_mega_rock', 'krook_scarf', 'nape', 'pult', 'king_gem', 'tox_scarf'], 'Every Rock option vs Charizard'),
    ('z19', 'Slowking + Dragapult special', 0.03, ['king', 'pult', 'tox', 'meta_mega', 'krook_scarf', 'florges'], 'Special-heavy with TR backup'),
    ('z20', 'Balance with Umbreon Taunt', 0.03, ['umb_supp', 'meta_mega', 'rotomw', 'pult_sash', 'krook_lo', 'tox_scarf'], 'Taunt Umbreon + anti-Charizard Krookodile'),
    ('z21', 'Human: no Krookodile', 0.02, ['meta_mega', 'pult', 'rotomw', 'nape', 'tox_scarf', 'florges'], 'Forgets the Rock answer'),
    ('z22', 'Human: no Toxtricity', 0.02, ['meta_mega', 'pult', 'rotomw', 'krook_scarf', 'nape', 'umb'], 'Leaves Toxtricity home'),
    ('z23', 'TR heavy, both setters', 0.03, ['oran', 'king', 'tox_tr', 'meta_mega_bulk', 'krook_bulk', 'umb'], 'Full TR'),
    ('z24', 'Fast pressure', 0.02, ['meta_mega', 'krook_scarf', 'rotomw_scarf', 'tox', 'nape', 'pult_sash'], 'Scarf Krookodile + fast attackers'),
]


def check(team):
    probs, items, stones = [], set(), 0
    for s in team:
        sid = s['species']
        if sid not in SP or not SP[sid].get('legal', True):
            probs.append(f'{sid} not legal')
        if tid(s['ability']) not in {tid(a) for a in SP[sid]['abilities']}:
            probs.append(f'{sid} ability {s["ability"]}')
        ls = {LM[i] for i in LS[sid]}
        for mv in s['moves']:
            if tid(mv) not in ls:
                probs.append(f'{sid} cannot learn {mv}')
        it = tid(s['item'])
        if it not in ITEMS:
            probs.append(f'{sid} item {s["item"]} not in pool')
        if it in items:
            probs.append(f'item clause: {s["item"]}')
        items.add(it)
        if ITEMS.get(it, {}).get('megaStone'):
            stones += 1
        if any(v > 32 for v in s['sp']) or sum(s['sp']) > 66:
            probs.append(f'{sid} SP {s["sp"]}')
    if stones > 1:
        probs.append(f'{stones} Mega stones')
    return probs


def export(team):
    out = []
    for s in team:
        ev = ' / '.join(f'{v} {STATS[i]}' for i, v in enumerate(s['sp']) if v)
        out.append(f"{s['name']} @ {s['item']}\nAbility: {s['ability']}\nLevel: 50\nEVs: {ev}\n{s['nature']} Nature\n" + ''.join(f'- {m}\n' for m in s['moves']))
    return '\n'.join(out)


# ---------------- Anthony set library ----------------
A = {
    'zardM': S('Charizard', 'charizard', 'Charizardite Y', 'Blaze', 'Modest', [6, 0, 0, 32, 2, 26], ['Heat Wave', 'Weather Ball', 'Solar Beam', 'Protect']),
    'zardT': S('Charizard', 'charizard', 'Charizardite Y', 'Blaze', 'Timid', [2, 0, 0, 32, 0, 32], ['Heat Wave', 'Weather Ball', 'Solar Beam', 'Protect']),
    'zardB': S('Charizard', 'charizard', 'Charizardite Y', 'Blaze', 'Modest', [20, 0, 0, 32, 0, 14], ['Heat Wave', 'Weather Ball', 'Solar Beam', 'Protect']),
    'aegis': S('Aegislash', 'aegislash', 'Metal Coat', 'Stance Change', 'Brave', [32, 32, 2, 0, 0, 0], ['Poltergeist', 'Iron Head', "King's Shield", 'Wide Guard']),
    'aegisSS': S('Aegislash', 'aegislash', 'Kasib Berry', 'Stance Change', 'Brave', [32, 32, 2, 0, 0, 0], ['Poltergeist', 'Shadow Sneak', "King's Shield", 'Wide Guard']),
    'kanga': S('Kangaskhan', 'kangaskhan', 'Life Orb', 'Scrappy', 'Adamant', [32, 32, 0, 0, 0, 0], ['Fake Out', 'Last Resort']),
    'kangaDE': S('Kangaskhan', 'kangaskhan', 'Silk Scarf', 'Scrappy', 'Adamant', [32, 32, 2, 0, 0, 0], ['Fake Out', 'Double-Edge', 'Sucker Punch', 'Protect']),
    'morpeko': S('Morpeko', 'morpeko', 'Focus Sash', 'Hunger Switch', 'Jolly', [2, 32, 0, 0, 0, 32], ['Fake Out', 'Aura Wheel', 'Taunt', 'Protect']),
    'morpekoPS': S('Morpeko', 'morpeko', 'Focus Sash', 'Hunger Switch', 'Jolly', [2, 32, 0, 0, 0, 32], ['Fake Out', 'Aura Wheel', 'Parting Shot', 'Protect']),
    'sinis': S('Sinistcha', 'sinistcha', 'Coba Berry', 'Hospitality', 'Calm', [32, 0, 2, 0, 32, 0], ['Matcha Gotcha', 'Rage Powder', 'Trick Room', 'Protect']),
    'sinisB': S('Sinistcha', 'sinistcha', 'Sitrus Berry', 'Hospitality', 'Bold', [32, 0, 14, 0, 20, 0], ['Matcha Gotcha', 'Rage Powder', 'Trick Room', 'Life Dew']),
    'rotom': S('Rotom-Fan', 'rotomfan', 'Sitrus Berry', 'Levitate', 'Modest', [32, 0, 0, 32, 2, 0], ['Thunderbolt', 'Air Slash', 'Will-O-Wisp', 'Protect']),
    # a08 as simulated: the item clause moved Rotom-Fan's Sitrus to Expert Belt (Sinistcha holds the Sitrus)
    'rotomEB': S('Rotom-Fan', 'rotomfan', 'Expert Belt', 'Levitate', 'Modest', [32, 0, 0, 32, 2, 0], ['Thunderbolt', 'Air Slash', 'Will-O-Wisp', 'Protect']),
    'stunfisk': S('Stunfisk-Galar', 'stunfiskgalar', 'Leftovers', 'Mimicry', 'Brave', [32, 32, 2, 0, 0, 0], ['Stomping Tantrum', 'Snap Trap', 'Yawn', 'Protect']),
    'conk': S('Conkeldurr', 'conkeldurr', 'Life Orb', 'Iron Fist', 'Brave', [32, 32, 0, 0, 2, 0], ['Drain Punch', 'Mach Punch', 'Ice Punch', 'Protect']),
    'pelipper': S('Pelipper', 'pelipper', 'Focus Sash', 'Drizzle', 'Modest', [2, 0, 0, 32, 0, 32], ['Hurricane', 'Weather Ball', 'Tailwind', 'Wide Guard']),
    'simipour': S('Simipour', 'simipour', 'Mystic Water', 'Torrent', 'Modest', [2, 0, 0, 32, 0, 32], ['Fake Out', 'Scald', 'Ice Beam', 'Protect']),
}
AT = [
    ('a01', 'Guide / Week 1 six', 0.16, ['zardM', 'aegis', 'kanga', 'morpeko', 'sinis', 'rotom'], 'Baseline (match-zhuzi.md)'),
    ('a02', 'Stunfisk-Galar for Rotom-Fan', 0.08, ['zardM', 'aegis', 'kanga', 'morpeko', 'sinis', 'stunfisk'], 'Electric immunity vs Toxtricity / Rotom-Wash'),
    ('a03', 'Timid Charizard', 0.07, ['zardT', 'aegis', 'kanga', 'morpeko', 'sinis', 'rotom'], 'Speed 167 vs Modest power'),
    ('a04', 'Bulky Modest Charizard', 0.06, ['zardB', 'aegis', 'kanga', 'morpeko', 'sinis', 'rotom'], '20 HP / 14 Spe: survive Overdrive more often'),
    ('a05', 'Kangaskhan Double-Edge set', 0.07, ['zardM', 'aegis', 'kangaDE', 'morpeko', 'sinis', 'rotom'], 'Protect + Sucker Punch vs Last Resort'),
    ('a06', 'Aegislash Shadow Sneak + Kasib', 0.06, ['zardM', 'aegisSS', 'kanga', 'morpeko', 'sinis', 'rotom'], 'Priority + Ghost resist berry'),
    ('a07', 'Morpeko Parting Shot', 0.05, ['zardM', 'aegis', 'kanga', 'morpekoPS', 'sinis', 'rotom'], 'Parting Shot vs Taunt'),
    ('a08', 'Bold Sitrus Sinistcha', 0.05, ['zardM', 'aegis', 'kanga', 'morpeko', 'sinisB', 'rotom'], 'Physical bulk (Krookodile / Metagross)'),
    ('a09', 'Conkeldurr for Sinistcha', 0.06, ['zardM', 'aegis', 'kanga', 'morpeko', 'conk', 'rotom'], 'No TR; Drain Punch Krookodile / Infernape'),
    ('a10', 'Conkeldurr for Rotom-Fan', 0.05, ['zardM', 'aegis', 'kanga', 'morpeko', 'sinis', 'conk'], 'TR abuser'),
    ('a11', 'Pelipper Tailwind / Wide Guard', 0.05, ['zardM', 'aegis', 'kanga', 'morpeko', 'pelipper', 'rotom'], 'Second Wide Guard + Tailwind (weather conflict)'),
    ('a12', 'Simipour Fake Out', 0.04, ['zardM', 'aegis', 'kanga', 'simipour', 'sinis', 'rotom'], 'Comfort: second Fake Out, Water coverage'),
    ('a13', 'Stunfisk + Conkeldurr TR', 0.05, ['zardM', 'aegis', 'kanga', 'stunfisk', 'sinis', 'conk'], 'Full TR-abuser back line'),
    ('a14', 'No Kangaskhan', 0.05, ['zardM', 'aegis', 'morpeko', 'sinis', 'rotom', 'stunfisk'], 'Ablation: Kangaskhan value'),
    ('a15', 'No Morpeko', 0.05, ['zardM', 'aegis', 'kanga', 'sinis', 'rotom', 'stunfisk'], 'Ablation: Morpeko value'),
    ('a16', 'Timid Charizard + Stunfisk', 0.05, ['zardT', 'aegis', 'kanga', 'morpeko', 'sinis', 'stunfisk'], 'Combine two variants'),
    # Round-2 combinations (2026-10-21) of the round-1 gainers a05 / a06 / a08 (and a04). Weight 0 keeps the a01-a16 weights
    # unchanged; items: Charizardite Y, Kasib, Silk Scarf, Focus Sash, Sitrus (Sinistcha), Expert Belt (Rotom-Fan): no clash.
    ('a17', 'a05 + a06 + a08', 0.0, ['zardM', 'aegisSS', 'kangaDE', 'morpeko', 'sinisB', 'rotomEB'], 'Stack all three round-1 gainers'),
    ('a18', 'a05 + a06', 0.0, ['zardM', 'aegisSS', 'kangaDE', 'morpeko', 'sinis', 'rotom'], 'Kangaskhan DE set + Aegislash Sneak/Kasib; Rotom keeps Sitrus'),
    ('a19', 'a06 + a08', 0.0, ['zardM', 'aegisSS', 'kanga', 'morpeko', 'sinisB', 'rotomEB'], 'Aegislash Sneak/Kasib + Bold Sitrus Sinistcha'),
    ('a20', 'a05 + a08', 0.0, ['zardM', 'aegis', 'kangaDE', 'morpeko', 'sinisB', 'rotomEB'], 'Kangaskhan DE set + Bold Sitrus Sinistcha'),
    ('a21', 'a17 + bulky Charizard (a04)', 0.0, ['zardB', 'aegisSS', 'kangaDE', 'morpeko', 'sinisB', 'rotomEB'], 'All four round-1 gainers'),
]


FALLBACK = ['Life Orb', 'Expert Belt', 'Focus Sash', 'Sitrus Berry', 'Leftovers', 'Rocky Helmet', 'Mental Herb', 'Wide Lens']


def resolve_items(team):
    """Item clause: a later duplicate takes the first unused fallback item. Returns (team, notes)."""
    used, out, notes = set(), [], []
    for s in team:
        s = dict(s)
        if tid(s['item']) in used:
            new = next(i for i in FALLBACK if tid(i) not in used)
            notes.append(f"{s['name']}: {s['item']} -> {new} (item clause)")
            s['item'] = new
        used.add(tid(s['item']))
        out.append(s)
    return out, notes


def build(lib, teams, side):
    out, errs = [], []
    total = sum(w for _, _, w, _, _ in teams)
    for tid_, label, w, keys, why in teams:
        team, swaps = resolve_items([lib[k] for k in keys])
        if swaps:
            why = why + ' | ' + '; '.join(swaps)
        p = check(team)
        if p:
            errs.append((tid_, p))
        out.append({'id': tid_, 'label': label, 'weight': round(w / total, 4), 'why': why, 'sets': keys,
                    'notes': {k: lib[k]['note'] for k in keys if lib[k].get('note')}, 'team': export(team)})
    return out, errs


if __name__ == '__main__':
    zt, ze = build(Z, ZT, 'zhuzi')
    at, ae = build(A, AT, 'anthony')
    for tid_, p in ze + ae:
        print('PROBLEM', tid_, p)
    dst = os.path.join(ROOT, 'tools', 'sim', 'candidates')
    os.makedirs(dst, exist_ok=True)
    json.dump({'version': 1, 'written': '2026-10-21', 'format': 'gen9championsvgc2026regmc', 'level': 50,
               'notes': 'Showdown export text per team; Champions Stat Points on the EVs line. weight sums to 1 per side.',
               'opponent': {'coach': 'ZhuZi', 'seat': 3, 'teams': zt},
               'ours': {'coach': 'Anthony', 'seat': 5, 'teams': at}}, open(os.path.join(dst, 'zhuzi.json'), 'w'), indent=1)
    print(len(zt), 'ZhuZi teams,', len(at), 'Anthony teams; problems:', len(ze) + len(ae))

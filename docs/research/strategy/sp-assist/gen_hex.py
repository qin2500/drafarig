"""Week 4 vs Hex (seat 1): simulation candidates (docs/research/strategy/sim/hex-candidates.md).
Writes tools/sim/candidates/hex.json: Hex's weighted candidate sixes and Anthony's candidate sixes.
Every set is validated as in gen_candidates.py (species, ability, Champions learnset, M-C item pool, item clause, one Mega,
SP <= 32 per stat / 66 total). Run: python3 gen_hex.py"""
import json, os
from gen_candidates import S, check, export, resolve_items, ROOT

# ---------------- Hex set library ----------------
# L = Smogon Reg M-C ladder >= 1760 (2026-09) modal set; W = worst case / anti-Anthony (threat scan, hex-scan.json);
# H = human / comfort variant. Hex drafted (points): Garchomp 19, Indeedee-F 18, Armarouge 14, Corviknight 13,
# Rotom-Heat 12, Drampa 8, Kleavor 6, Banette 5, Ditto 4, Forretress 1. Not in the Champions learnsets: Drampa Trick Room /
# Tailwind, Forretress Trick Room, Indeedee-F Expanding Force.
H = {
    # Garchomp: three Megas available (Mega-Z is the ladder's: Levitate, 151 Spe, special) or Life Orb / Scarf non-Mega
    'chompZ': S('Garchomp', 'garchomp', 'Garchompite Z', 'Rough Skin', 'Modest', [2, 0, 0, 32, 0, 32], ['Draco Meteor', 'Earth Power', 'Power Gem', 'Protect'], 'L: Mega-Z modal (Power Gem 82%)'),
    'chompZ_fire': S('Garchomp', 'garchomp', 'Garchompite Z', 'Rough Skin', 'Timid', [2, 0, 0, 32, 0, 32], ['Dragon Pulse', 'Earth Power', 'Flamethrower', 'Protect'], 'L: Mega-Z, Flamethrower for Steels (Aegislash)'),
    'chomp_lo': S('Garchomp', 'garchomp', 'Life Orb', 'Rough Skin', 'Jolly', [2, 32, 0, 0, 0, 32], ['Dragon Claw', 'Rock Slide', 'Earthquake', 'Protect'], 'L: Life Orb 43%, Rock Slide 74%'),
    'chomp_scarf': S('Garchomp', 'garchomp', 'Choice Scarf', 'Rough Skin', 'Jolly', [2, 32, 0, 0, 0, 32], ['Dragon Claw', 'Rock Slide', 'Earthquake', 'Stomping Tantrum'], 'L: Scarf 38%'),
    'chompM': S('Garchomp', 'garchomp', 'Garchompite', 'Rough Skin', 'Adamant', [32, 32, 0, 0, 2, 0], ['Earthquake', 'Rock Slide', 'Dragon Claw', 'Protect'], 'L: Sand Force Mega (0.3% usage), bulky TR-friendly'),
    # Indeedee-F: Psychic Surge (blocks our priority into grounded targets), Follow Me, Trick Room
    'indee': S('Indeedee-F', 'indeedeef', 'Rocky Helmet', 'Psychic Surge', 'Relaxed', [32, 0, 32, 0, 2, 0], ['Follow Me', 'Helping Hand', 'Trick Room', 'Psychic'], 'L: modal'),
    'indee_colbur': S('Indeedee-F', 'indeedeef', 'Colbur Berry', 'Psychic Surge', 'Bold', [32, 0, 32, 0, 2, 0], ['Follow Me', 'Helping Hand', 'Trick Room', 'Protect'], 'L: Colbur 28% (vs Morpeko / Kangaskhan Sucker Punch)'),
    'indee_imp': S('Indeedee-F', 'indeedeef', 'Psychic Seed', 'Psychic Surge', 'Relaxed', [32, 0, 32, 0, 2, 0], ['Follow Me', 'Trick Room', 'Imprison', 'Psychic'], 'W: Imprison stops Sinistcha reversing his Trick Room'),
    # Armarouge: Expanding Force under the terrain, Trick Room, Wide Guard; Flash Fire eats our Fire moves
    'arma_tr': S('Armarouge', 'armarouge', 'Life Orb', 'Flash Fire', 'Quiet', [32, 0, 0, 32, 2, 0], ['Expanding Force', 'Armor Cannon', 'Trick Room', 'Protect'], 'L: Life Orb 49%, Quiet TR spread'),
    'arma_wg': S('Armarouge', 'armarouge', 'Focus Sash', 'Flash Fire', 'Modest', [2, 0, 0, 32, 0, 32], ['Expanding Force', 'Armor Cannon', 'Wide Guard', 'Protect'], 'L: Sash 29%, Wide Guard 45% (vs our Heat Wave)'),
    'arma_hw': S('Armarouge', 'armarouge', 'Life Orb', 'Flash Fire', 'Modest', [2, 0, 0, 32, 0, 32], ['Expanding Force', 'Heat Wave', 'Aura Sphere', 'Protect'], 'L: fast spread attacker (Heat Wave 25%, Aura Sphere 16%) vs Kangaskhan'),
    # Corviknight
    'corv_tw': S('Corviknight', 'corviknight', 'Leftovers', 'Mirror Armor', 'Careful', [32, 2, 0, 0, 32, 0], ['Brave Bird', 'Tailwind', 'Roost', 'Bulk Up'], 'L: Tailwind 41%'),
    'corv_bulk': S('Corviknight', 'corviknight', 'Psychic Seed', 'Mirror Armor', 'Careful', [32, 2, 0, 0, 32, 0], ['Brave Bird', 'Bulk Up', 'Roost', 'Body Press'], 'L: Bulk Up 70%, Psychic Seed 41% (with Indeedee)'),
    # Rotom-Heat
    'rotomh': S('Rotom-Heat', 'rotomheat', 'Sitrus Berry', 'Levitate', 'Modest', [32, 0, 0, 32, 2, 0], ['Overheat', 'Thunderbolt', 'Will-O-Wisp', 'Protect'], 'L: Sitrus 43%'),
    'rotomh_scarf': S('Rotom-Heat', 'rotomheat', 'Choice Scarf', 'Levitate', 'Timid', [2, 0, 0, 32, 0, 32], ['Overheat', 'Thunderbolt', 'Volt Switch', 'Electroweb'], 'L: Scarf 32%'),
    # Drampa: Cloud Nine cancels our sun (and our rain)
    'drampa': S('Drampa', 'drampa', 'Life Orb', 'Cloud Nine', 'Quiet', [32, 0, 0, 32, 2, 0], ['Hyper Voice', 'Draco Meteor', 'Flamethrower', 'Protect'], 'L/W: Cloud Nine 97% (turns off Mega Charizard Y\'s sun), Quiet TR abuser'),
    'drampaM': S('Drampa', 'drampa', 'Drampanite', 'Berserk', 'Quiet', [32, 0, 2, 32, 0, 0], ['Hyper Voice', 'Draco Meteor', 'Earth Power', 'Protect'], 'L: Mega (Berserk) modal'),
    # Kleavor: Sharpness Stone Axe; worst case Sheer Force Life Orb Rock Slide (threat-scan G3)
    'kleavor': S('Kleavor', 'kleavor', 'Focus Sash', 'Sharpness', 'Jolly', [2, 32, 0, 0, 0, 32], ['Stone Axe', 'X-Scissor', 'Close Combat', 'Protect'], 'L: Sash 45%'),
    'kleavor_tw': S('Kleavor', 'kleavor', 'Focus Sash', 'Sharpness', 'Jolly', [2, 32, 0, 0, 0, 32], ['Stone Axe', 'X-Scissor', 'Tailwind', 'Feint'], 'L: Tailwind 19%, Feint 28%'),
    'kleavor_rs': S('Kleavor', 'kleavor', 'Choice Scarf', 'Sharpness', 'Jolly', [2, 32, 0, 0, 0, 32], ['Stone Axe', 'Rock Slide', 'X-Scissor', 'Close Combat'], 'L/W: Scarf 43% + Rock Slide 30% (spread vs Charizard)'),
    'kleavor_sf': S('Kleavor', 'kleavor', 'Life Orb', 'Sheer Force', 'Jolly', [2, 32, 0, 0, 0, 32], ['Rock Slide', 'X-Scissor', 'Close Combat', 'Protect'], 'W: Sheer Force Life Orb Rock Slide double-KOs Charizard + Rotom-Fan'),
    # Banette: Mega gets Prankster (priority Trick Room / Will-O-Wisp / Encore)
    'banM': S('Banette', 'banette', 'Banettite', 'Insomnia', 'Adamant', [32, 32, 0, 0, 2, 0], ['Poltergeist', 'Trick Room', 'Will-O-Wisp', 'Protect'], 'L: Mega Prankster TR (ladder 0.04%)'),
    'banM_enc': S('Banette', 'banette', 'Banettite', 'Insomnia', 'Adamant', [32, 32, 0, 0, 2, 0], ['Poltergeist', 'Encore', 'Taunt', 'Protect'], 'W: Prankster Taunt / Encore vs Sinistcha Trick Room'),
    # Ditto, Forretress (no Trick Room in Champions)
    'ditto': S('Ditto', 'ditto', 'Choice Scarf', 'Imposter', 'Bold', [32, 0, 32, 0, 2, 0], ['Transform'], 'L: Scarf Imposter 45%'),
    'forre': S('Forretress', 'forretress', 'Rocky Helmet', 'Sturdy', 'Relaxed', [32, 0, 32, 0, 2, 0], ['Gyro Ball', 'Rock Slide', 'Body Press', 'Protect'], 'H/W: Sturdy, Rock Slide vs Charizard, TR abuser'),
}

# ---------------- Hex teams ----------------
# Weights (judgement, stated in hex-candidates.md): his five most expensive picks (Garchomp, Indeedee-F, Armarouge,
# Corviknight, Rotom-Heat = 76 of 100 points) are the core; the sixth slot by cost (Drampa > Kleavor > Banette > Ditto >
# Forretress). Mega-Z Garchomp is the ladder default. Indeedee + Armarouge is a known Psychic Terrain / Trick Room pair, so
# TR mode gets real weight. Anti-Anthony: Rock Slide (Charizard 4x), Cloud Nine (sun), Wide Guard (Heat Wave), Imprison /
# Prankster Taunt (Sinistcha's Trick Room).
HT = [
    ('h01', 'Core + Drampa (ladder sets)', 0.10, ['chompZ', 'indee', 'arma_tr', 'corv_tw', 'rotomh', 'drampa'], 'His five big picks + Cloud Nine Drampa: the most likely single six'),
    ('h02', 'Core + Kleavor', 0.08, ['chompZ', 'indee', 'arma_tr', 'corv_tw', 'rotomh', 'kleavor'], 'Core + his next physical attacker'),
    ('h03', 'Psychic Terrain Trick Room, Mega Drampa', 0.06, ['indee', 'arma_tr', 'drampaM', 'rotomh', 'corv_bulk', 'chomp_lo'], 'Full TR mode around Indeedee + Armarouge'),
    ('h04', 'Anti-Charizard rocks, no Mega', 0.07, ['chomp_scarf', 'kleavor_sf', 'indee', 'arma_wg', 'rotomh', 'drampa'], 'Every answer to Charizard: Rock Slide x2, Wide Guard, Cloud Nine'),
    ('h05', 'Tailwind offense', 0.06, ['corv_tw', 'kleavor_tw', 'chompZ', 'arma_wg', 'rotomh', 'drampa'], 'Double Tailwind, fast mode instead of TR'),
    ('h06', 'Mega Banette Prankster Trick Room', 0.04, ['banM', 'indee', 'arma_tr', 'drampa', 'chomp_lo', 'rotomh'], 'Priority TR; Garchomp loses its Mega'),
    ('h07', 'TR + Imprison (anti-Sinistcha)', 0.04, ['indee_imp', 'arma_tr', 'drampa', 'chompZ', 'rotomh', 'corv_tw'], 'Stops Sinistcha undoing his Trick Room'),
    ('h08', 'Sand Force Mega Garchomp', 0.03, ['chompM', 'indee', 'arma_tr', 'corv_tw', 'rotomh', 'kleavor'], 'The other Garchomp Mega (bulky, works in TR)'),
    ('h09', 'No Corviknight: Kleavor + Drampa', 0.05, ['chompZ', 'indee', 'arma_tr', 'rotomh', 'kleavor', 'drampa'], 'Corviknight benched for both cheap attackers'),
    ('h10', 'Scarf Garchomp + Mega Drampa', 0.04, ['chomp_scarf', 'drampaM', 'indee', 'arma_tr', 'corv_tw', 'rotomh'], 'Mega on Drampa, Scarf rocks on Garchomp'),
    ('h11', 'Human: Ditto', 0.03, ['chompZ', 'indee', 'arma_tr', 'corv_tw', 'rotomh', 'ditto'], 'Comfort pick: Scarf Ditto copies Charizard / Kangaskhan'),
    ('h12', 'Bulk Up Corviknight balance', 0.04, ['chompZ', 'indee_colbur', 'arma_wg', 'corv_bulk', 'rotomh', 'drampa'], 'Bulky Corviknight + Wide Guard Armarouge'),
    ('h13', 'Scarf Rotom-Heat offense', 0.03, ['chompZ', 'indee', 'arma_wg', 'corv_tw', 'rotomh_scarf', 'kleavor'], 'Scarf Rotom-Heat'),
    ('h14', 'Full anti-Anthony', 0.05, ['chomp_lo', 'kleavor_rs', 'drampa', 'indee_imp', 'rotomh', 'arma_wg'], 'Rock Slide x2, Cloud Nine, Wide Guard, Imprison'),
    ('h15', 'Forretress Trick Room', 0.02, ['indee', 'forre', 'arma_tr', 'drampaM', 'chomp_lo', 'rotomh'], 'Cheapest pick as a Sturdy TR abuser'),
    ('h16', 'Prankster Taunt / Encore, fast', 0.03, ['banM_enc', 'chomp_scarf', 'corv_tw', 'kleavor', 'rotomh', 'arma_wg'], 'Banette stops our Trick Room with priority'),
    ('h17', 'No Indeedee: fast Garchomp-Z', 0.04, ['chompZ', 'corv_tw', 'rotomh', 'arma_hw', 'kleavor', 'drampa'], 'Leaves the terrain home; Heat Wave Armarouge'),
    ('h18', 'Mega Drampa TR + rocks', 0.04, ['indee', 'arma_tr', 'drampaM', 'chomp_lo', 'kleavor_rs', 'rotomh'], 'TR mode with Rock Slide backups'),
    ('h19', 'Human: Banette + Ditto', 0.02, ['banM', 'ditto', 'indee', 'arma_tr', 'chomp_scarf', 'rotomh'], 'Low-cost comfort picks'),
    ('h20', 'Special Garchomp-Z, Bulk Up Corviknight', 0.03, ['chompZ_fire', 'corv_bulk', 'kleavor_tw', 'indee', 'arma_wg', 'rotomh'], 'Flamethrower Mega-Z for Aegislash'),
]

# ---------------- Anthony set library (c1's sets are the Week 3 winners) ----------------
A = {
    'zardY': S('Charizard', 'charizard', 'Charizardite Y', 'Blaze', 'Modest', [32, 0, 0, 32, 2, 0], ['Heat Wave', 'Weather Ball', 'Solar Beam', 'Protect'], 'c1'),
    'zardYfast': S('Charizard', 'charizard', 'Charizardite Y', 'Blaze', 'Modest', [2, 0, 0, 32, 0, 32], ['Heat Wave', 'Weather Ball', 'Solar Beam', 'Protect'], '167 Spe'),
    'zardX': S('Charizard', 'charizard', 'Charizardite X', 'Blaze', 'Jolly', [2, 32, 0, 0, 0, 32], ['Flare Blitz', 'Dragon Claw', 'Dragon Dance', 'Protect'], 'Fire/Dragon: Rock only 2x; Dragon Claw for Garchomp / Drampa'),
    'aegis': S('Aegislash', 'aegislash', 'Kasib Berry', 'Stance Change', 'Brave', [32, 32, 2, 0, 0, 0], ['Poltergeist', 'Shadow Sneak', "King's Shield", 'Wide Guard'], 'c1'),
    'kanga': S('Kangaskhan', 'kangaskhan', 'Silk Scarf', 'Scrappy', 'Adamant', [32, 32, 2, 0, 0, 0], ['Fake Out', 'Double-Edge', 'Sucker Punch', 'Protect'], 'c1'),
    'kangaM': S('Kangaskhan', 'kangaskhan', 'Kangaskhanite', 'Scrappy', 'Adamant', [32, 32, 2, 0, 0, 0], ['Fake Out', 'Double-Edge', 'Sucker Punch', 'Protect'], 'Mega (Parental Bond) when Charizard stays home'),
    'morpeko': S('Morpeko', 'morpeko', 'Focus Sash', 'Hunger Switch', 'Jolly', [2, 32, 0, 0, 0, 32], ['Fake Out', 'Aura Wheel', 'Taunt', 'Protect'], 'c1; Dark Aura Wheel into Indeedee / Armarouge / Banette'),
    'sinis': S('Sinistcha', 'sinistcha', 'Sitrus Berry', 'Hospitality', 'Bold', [32, 0, 14, 0, 20, 0], ['Matcha Gotcha', 'Rage Powder', 'Trick Room', 'Life Dew'], 'c1'),
    'conk': S('Conkeldurr', 'conkeldurr', 'Life Orb', 'Iron Fist', 'Brave', [32, 32, 0, 0, 2, 0], ['Drain Punch', 'Mach Punch', 'Ice Punch', 'Protect'], 'c1; Ice Punch 4x into Garchomp'),
    'rotom': S('Rotom-Fan', 'rotomfan', 'Expert Belt', 'Levitate', 'Modest', [32, 0, 0, 32, 2, 0], ['Thunderbolt', 'Air Slash', 'Will-O-Wisp', 'Protect'], 'a17'),
    'stunfisk': S('Stunfisk-Galar', 'stunfiskgalar', 'Leftovers', 'Mimicry', 'Brave', [32, 32, 2, 0, 0, 0], ['Stomping Tantrum', 'Snap Trap', 'Yawn', 'Protect'], 'Electric immune (Rotom-Heat), Steel vs Fairy-less Hex'),
    'pelipper': S('Pelipper', 'pelipper', 'Focus Sash', 'Drizzle', 'Modest', [2, 0, 0, 32, 0, 32], ['Hurricane', 'Weather Ball', 'Tailwind', 'Wide Guard'], 'Rain halves his Fire (Armarouge, Rotom-Heat); Wide Guard + Tailwind'),
    'simipour': S('Simipour', 'simipour', 'Mystic Water', 'Torrent', 'Modest', [2, 0, 0, 32, 0, 32], ['Fake Out', 'Scald', 'Ice Beam', 'Protect'], 'Ice Beam 4x into Garchomp; Water into Armarouge / Rotom-Heat'),
}
AT = [
    ('o01', 'c1 (Week 3 six)', 1, ['zardY', 'aegis', 'kanga', 'morpeko', 'sinis', 'conk'], 'Baseline'),
    ('o02', 'c1, Rotom-Fan for Conkeldurr (c7)', 1, ['zardY', 'aegis', 'kanga', 'morpeko', 'sinis', 'rotom'], 'Week 1 / 2 shape'),
    ('o03', 'c1, Stunfisk for Morpeko (c2)', 1, ['zardY', 'aegis', 'kanga', 'stunfisk', 'sinis', 'conk'], 'Electric immunity vs Rotom-Heat'),
    ('o04', 'c1, Simipour for Morpeko', 1, ['zardY', 'aegis', 'kanga', 'simipour', 'sinis', 'conk'], 'Ice Beam for Garchomp, second Fake Out'),
    ('o05', 'c1, Pelipper for Morpeko', 1, ['zardY', 'aegis', 'kanga', 'pelipper', 'sinis', 'conk'], 'Second Wide Guard + Tailwind (weather clash)'),
    ('o06', 'Charizard X', 1, ['zardX', 'aegis', 'kanga', 'morpeko', 'sinis', 'conk'], 'X keeps Rock at 2x and ignores Cloud Nine'),
    ('o07', 'No Charizard: Mega Kangaskhan balance', 1, ['kangaM', 'aegis', 'morpeko', 'sinis', 'conk', 'rotom'], 'Charizard is the Hex roster\'s main target'),
    ('o08', 'No Charizard: rain', 1, ['pelipper', 'simipour', 'kangaM', 'aegis', 'sinis', 'conk'], 'Rain halves Armarouge / Rotom-Heat Fire'),
    ('o09', 'No Charizard: Mega Kangaskhan TR', 1, ['kangaM', 'aegis', 'sinis', 'conk', 'stunfisk', 'morpeko'], 'Slow TR core, Electric immunity'),
    ('o10', 'Charizard Y + Rotom-Fan + Stunfisk', 1, ['zardY', 'aegis', 'kanga', 'stunfisk', 'sinis', 'rotom'], 'No Morpeko / Conkeldurr'),
    ('o11', 'c1, fast Charizard', 1, ['zardYfast', 'aegis', 'kanga', 'morpeko', 'sinis', 'conk'], '167 Spe outspeeds Garchomp-Z? (no: 151 base)'),
    ('o12', 'No Charizard: rain + Morpeko', 1, ['pelipper', 'simipour', 'kangaM', 'aegis', 'morpeko', 'sinis'], 'Rain with Morpeko instead of Conkeldurr'),
]

# Screen: every six of Anthony's 10 (default set each; Mega Kangaskhan when Charizard stays home), ids s001-s210
from itertools import combinations
TEN = ['zardY', 'aegis', 'kanga', 'morpeko', 'sinis', 'conk', 'rotom', 'stunfisk', 'pelipper', 'simipour']
for n, six in enumerate(combinations(TEN, 6), 1):
    keys = [('kangaM' if k == 'kanga' and 'zardY' not in six else k) for k in six]
    NAME = {'zardY': 'Mega Charizard Y', 'kangaM': 'Mega Kangaskhan'}
    lab = '+'.join(NAME.get(k, A[k]['name']) for k in keys) + ('' if any(k in NAME for k in keys) else ' (no Mega)')
    AT.append((f's{n:03d}', lab, 0, keys, 'screen'))

# Mega choice on the shortlist (2026-11-02): Mega Charizard X instead of Y (Rock 2x not 4x, no sun to lose to Cloud Nine)
AT += [
    ('x119', 's119 with Mega Charizard X', 0, ['zardX', 'morpeko', 'conk', 'stunfisk', 'pelipper', 'simipour'], 'X vs Y on the top six'),
    ('x117', 's117 with Mega Charizard X', 0, ['zardX', 'morpeko', 'conk', 'rotom', 'stunfisk', 'simipour'], 'X vs Y'),
    ('x110', 's110 with Mega Charizard X', 0, ['zardX', 'morpeko', 'sinis', 'conk', 'stunfisk', 'simipour'], 'X vs Y'),
]

# Plan-commitment personas (run.mjs): the share of games where his AI plays the team's plan out of habit
PERSONAS = {**{t: ['tr', 0.6] for t in ['h03', 'h06', 'h07', 'h15', 'h18']},
            **{t: ['tr', 0.3] for t in ['h01', 'h02', 'h08', 'h09', 'h10', 'h11', 'h19']},
            **{t: ['rock', 0.6] for t in ['h04', 'h14']}}
# Preview rows (what Anthony sees at team preview under closed sheets: species only); first match wins
ROWS = [
    {'if': 'their 6 includes Indeedee-F + Armarouge + Drampa + Kleavor', 'need': ['indeedeef', 'armarouge', 'drampa', 'kleavor']},
    {'if': 'their 6 includes Indeedee-F + Armarouge + Drampa', 'need': ['indeedeef', 'armarouge', 'drampa']},
    {'if': 'their 6 includes Indeedee-F + Armarouge + Kleavor', 'need': ['indeedeef', 'armarouge', 'kleavor']},
    {'if': 'their 6 includes Indeedee-F + Armarouge', 'need': ['indeedeef', 'armarouge']},
    {'if': 'their 6 has no Indeedee-F', 'need': []},
]

if __name__ == '__main__':
    from gen_candidates import build
    ht, he = build(H, HT, 'hex')
    at, ae = build(A, AT, 'anthony')
    for tid_, p in he + ae:
        print('PROBLEM', tid_, p)
    dst = os.path.join(ROOT, 'tools', 'sim', 'candidates')
    json.dump({'version': 1, 'written': '2026-11-02', 'format': 'gen9championsvgc2026regmc', 'level': 50,
               'notes': 'Showdown export text per team; Champions Stat Points on the EVs line. weight sums to 1 per side.',
               'opponent': {'coach': 'Hex', 'seat': 1, 'teams': ht, 'personas': PERSONAS, 'rows': ROWS},
               'ours': {'coach': 'Anthony', 'seat': 5, 'teams': at, 'beliefRef': 'o01'}}, open(os.path.join(dst, 'hex.json'), 'w'), indent=1)
    print(len(ht), 'Hex teams,', len(at), 'Anthony teams; problems:', len(he) + len(ae))

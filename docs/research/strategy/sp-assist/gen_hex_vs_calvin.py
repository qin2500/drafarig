"""Week 5 mock (2026-11-09): Hex (seat 1) vs Calvin (seat 8). Anthony pilots Hex's side; Calvin practises his real Week 5
opponent. Writes tools/sim/candidates/hex-vs-calvin.json with Hex's candidate sixes as "ours" and Calvin's as "opponent".
Run: python3 gen_hex_vs_calvin.py

Rosters (league sheet cache 2026-11-06, drafts tab; pairing tab: Week 5 = Hex vs Calvin):
  Hex:    Garchomp, Indeedee-F, Corviknight, Rotom-Heat, Armarouge, Kleavor, Banette, Ditto, Forretress, Drampa.
  Calvin: Staraptor, Grimmsnarl, Empoleon, Basculegion-F, Jolteon, Volcarona, Tsareena, Mamoswine, Tauros, Swalot.
  (Calvin's 10 are unchanged since the Week 4 mock, lib/mocks/3v8.mjs.)

Hex's side, reusing the Week 4 model (gen_hex.py H = his ladder / worst-case set library, hex2.json h01-h20):
  h01-h20  his Week 4 sixes as modelled against Anthony (same sets);
  c01-c12  Calvin-targeted sixes (hand-built from the two-way scan hex_calvin_scan.py);
  e001-e210 every six of his 10 with a Calvin-tuned default set rule (sets_for below).
  Focus Sash Kleavor (Sharpness Stone Axe) is his default Kleavor everywhere: it is what beat Anthony in Week 4.
  b01, b02  closed-sheet beliefRef: the sets Calvin expects (he piloted Hex's modelled sets in the Week 4 mock).
Calvin's side: k01-k12, rebuilt from his current 10 (gen below). Sets = current ladder (>= 1760) modal sets, his Week 1
  Mega Staraptor (Tailwind) and the worst-case Tauros (Sheer Force + Life Orb Rock Slide, which beat Anthony in Week 1).
  The old cal-*.txt pool gave Tauros a Sitrus Berry by item-clause accident; here Tauros keeps Life Orb and the others
  take their own ladder second items (ALTS), so nothing silently falls back to Life Orb.
"""
import json, os
from itertools import combinations
from gen_candidates import S, build, ROOT
from gen_hex import H, HT

# ---------------- Hex: Calvin-tuned additions to the Week 4 library ----------------
HX = {
    **H,
    'drampa_b': S('Drampa', 'drampa', 'Life Orb', 'Berserk', 'Quiet', [32, 0, 0, 32, 2, 0], ['Hyper Voice', 'Draco Meteor', 'Thunderbolt', 'Protect'], 'C: Berserk (Cloud Nine does nothing vs Calvin); Thunderbolt 2x into Staraptor / Basculegion-F / Empoleon'),
    'kleavor_rs': S('Kleavor', 'kleavor', 'Focus Sash', 'Sharpness', 'Jolly', [2, 32, 0, 0, 0, 32], ['Stone Axe', 'Rock Slide', 'Close Combat', 'Protect'], 'C: Sash + spread Rock Slide (Volcarona 4x, Mega Staraptor neutral); Close Combat for Tauros / Mamoswine / Empoleon'),
    'rotomh_web': S('Rotom-Heat', 'rotomheat', 'Sitrus Berry', 'Levitate', 'Modest', [32, 0, 0, 32, 2, 0], ['Overheat', 'Thunderbolt', 'Electroweb', 'Protect'], 'C: Electroweb speed control vs his Tailwind'),
    'indee_fo': S('Indeedee-F', 'indeedeef', 'Rocky Helmet', 'Psychic Surge', 'Relaxed', [32, 0, 32, 0, 2, 0], ['Fake Out', 'Follow Me', 'Trick Room', 'Psychic'], 'C: Fake Out (stops a turn-1 Tailwind); Psychic 2x into Mega Staraptor'),
}
# item clause: each species' next item (ladder second choice / what a human picks), so a clash never falls back to Life Orb
HALTS = {'garchomp': ['Expert Belt', 'Choice Scarf', 'Yache Berry'], 'armarouge': ['Expert Belt', 'Focus Sash', 'Sitrus Berry'],
         'drampa': ['Expert Belt', 'Sitrus Berry', 'Leftovers'], 'kleavor': ['Life Orb', 'Expert Belt', 'Choice Scarf'],
         'indeedeef': ['Sitrus Berry', 'Psychic Seed', 'Colbur Berry'], 'forretress': ['Leftovers', 'Sitrus Berry', 'Chople Berry'],
         'corviknight': ['Sitrus Berry', 'Rocky Helmet'], 'rotomheat': ['Leftovers', 'Shuca Berry', 'Expert Belt'],
         'ditto': ['Focus Sash', 'Sitrus Berry'], 'banette': [], }
for _s in HX.values():
    _s['alts'] = HALTS.get(_s['species'], [])

TEN = ['garchomp', 'indeedeef', 'armarouge', 'corviknight', 'rotomheat', 'drampa', 'kleavor', 'banette', 'ditto', 'forretress']
NAME = {'garchomp': 'Garchomp', 'indeedeef': 'Indeedee-F', 'armarouge': 'Armarouge', 'corviknight': 'Corviknight', 'rotomheat': 'Rotom-Heat',
        'drampa': 'Drampa', 'kleavor': 'Kleavor', 'banette': 'Banette', 'ditto': 'Ditto', 'forretress': 'Forretress'}


def sets_for(six):
    """Calvin-tuned default sets. One Mega per six: Banette in the six -> Mega Banette (Prankster Trick Room) and Life Orb
    Garchomp; else Garchomp -> Mega-Z (ladder); neither -> Mega Drampa. Armarouge: the Trick Room set beside a Trick Room
    setter (Indeedee-F / Mega Banette), else the fast Heat Wave set. Drampa: Berserk Life Orb (no weather to cancel)."""
    tr = 'indeedeef' in six or 'banette' in six
    out = []
    for s in six:
        if s == 'garchomp':
            out.append('chomp_lo' if 'banette' in six else 'chompZ')
        elif s == 'drampa':
            out.append('drampa_b' if ('garchomp' in six or 'banette' in six) else 'drampaM')
        elif s == 'armarouge':
            out.append('arma_tr' if tr else 'arma_hw')
        else:
            out.append({'indeedeef': 'indee', 'corviknight': 'corv_tw', 'rotomheat': 'rotomh', 'kleavor': 'kleavor', 'banette': 'banM',
                        'ditto': 'ditto', 'forretress': 'forre'}[s])
    return out


ET = [(f'e{n:03d}', '+'.join(NAME[s] for s in six), 0, sets_for(six), 'every-six screen') for n, six in enumerate(combinations(TEN, 6), 1)]
# Calvin-targeted sixes (hex_calvin_scan.py): answers to Mega Staraptor (Psychic, Brave Bird, Draco Meteor, Thunderbolt),
# Volcarona (Rock 4x), Basculegion-F (Thunderbolt, Poltergeist), Mamoswine (Fire, Close Combat, Will-O-Wisp), and Trick
# Room / Tailwind / Electroweb against his Tailwind.
CT = [
    ('c01', 'Psychic Terrain Trick Room + Sash Kleavor', 1, ['indee', 'arma_tr', 'chompZ', 'kleavor', 'rotomh', 'drampa_b'], 'His core with the two attackers that beat Anthony'),
    ('c02', 'Kleavor + Rotom-Heat offense, Wide Guard Armarouge', 1, ['chompZ', 'kleavor', 'rotomh', 'indee', 'arma_wg', 'corv_tw'], 'Wide Guard vs Rock Slide / Muddy Water / Heat Wave'),
    ('c03', 'Tailwind vs Tailwind', 1, ['corv_tw', 'kleavor_rs', 'chompZ', 'rotomh_web', 'arma_hw', 'drampa_b'], 'Fast mode, double speed control'),
    ('c04', 'Fake Out Indeedee Trick Room, Mega Banette', 1, ['indee_fo', 'arma_tr', 'banM', 'drampa_b', 'chomp_lo', 'kleavor'], 'Two Trick Room setters, Fake Out vs turn-1 Tailwind'),
    ('c05', 'Mega Banette Prankster TR + Will-O-Wisp', 1, ['banM', 'indee', 'arma_tr', 'chomp_lo', 'rotomh', 'kleavor'], 'Priority Trick Room'),
    ('c06', 'Mega Drampa Trick Room', 1, ['indee', 'arma_tr', 'drampaM', 'rotomh', 'kleavor', 'chomp_lo'], 'Mega on Drampa, Life Orb rocks on Garchomp'),
    ('c07', 'Rock spam vs Volcarona / Staraptor', 1, ['chompZ', 'kleavor_rs', 'forre', 'indee', 'rotomh', 'corv_tw'], 'Rock Slide Kleavor, Sturdy Forretress'),
    ('c08', 'No Indeedee: fast Mega-Z + Tailwind', 1, ['chompZ', 'corv_tw', 'rotomh', 'arma_hw', 'kleavor', 'drampa_b'], 'Leaves the terrain home'),
    ('c09', 'Core + Ditto', 1, ['chompZ', 'indee', 'arma_tr', 'rotomh', 'kleavor', 'ditto'], 'Scarf Ditto copies Mega Staraptor'),
    ('c10', 'Bulk Up Corviknight + Trick Room', 1, ['indee', 'corv_bulk', 'chompZ', 'rotomh', 'kleavor', 'arma_tr'], 'Corviknight walls Tsareena / Grimmsnarl / Mamoswine'),
    ('c11', 'Electroweb Rotom-Heat + Sash Kleavor', 1, ['chompZ', 'kleavor', 'rotomh_web', 'indee_fo', 'arma_tr', 'corv_tw'], 'Speed control on both modes'),
    ('c12', 'Forretress Trick Room, Mega Drampa', 1, ['indee', 'forre', 'arma_tr', 'drampaM', 'chomp_lo', 'rotomh'], 'Cheapest picks as TR abusers'),
    # one-change variants of the stage-2 leader c08 (2026-11-09), for the engine confirm
    ('c13', 'c08 with Rock Slide Kleavor', 1, ['chompZ', 'corv_tw', 'rotomh', 'arma_hw', 'kleavor_rs', 'drampa_b'], 'Spread Rock Slide (Volcarona 4x) instead of X-Scissor'),
    ('c14', 'c08 with Electroweb Rotom-Heat', 1, ['chompZ', 'corv_tw', 'rotomh_web', 'arma_hw', 'kleavor', 'drampa_b'], 'Electroweb instead of Will-O-Wisp'),
    ('c15', 'c08 with Fake Out Indeedee-F for Drampa', 1, ['chompZ', 'corv_tw', 'rotomh', 'arma_tr', 'kleavor', 'indee_fo'], 'Terrain + Fake Out + Trick Room option'),
    ('c16', 'c08 with Mega Banette for Drampa (two stones)', 1, ['chompZ', 'corv_tw', 'rotomh', 'arma_hw', 'kleavor', 'banM'], 'Prankster Trick Room / Will-O-Wisp as the sixth'),
]
# what Calvin expects Hex's sets to be (he piloted our Week 4 Hex model in the mock): every species, modal sets
BELIEF = [('b01', 'belief: Hex core (Week 4 model)', 0, ['chompZ', 'indee', 'arma_tr', 'corv_tw', 'rotomh', 'kleavor'], 'beliefRef'),
          ('b02', 'belief: the other four (Week 4 model)', 0, ['drampa', 'banM', 'ditto', 'forre', 'arma_wg', 'indee_colbur'], 'beliefRef (second)'),
          ('b03', 'belief: Week 4 alternatives', 0, ['chomp_lo', 'drampaM', 'rotomh_scarf', 'corv_bulk', 'kleavor_tw', 'indee_fo'], 'beliefRef (third)')]

# ---------------- Calvin's set library (rebuilt 2026-11-09 from his current 10) ----------------
K = {
    'rapM': S('Staraptor', 'staraptor', 'Staraptite', 'Intimidate', 'Jolly', [2, 32, 0, 0, 0, 32], ['Close Combat', 'Brave Bird', 'Tailwind', 'Protect'], 'his Week 1 Mega (Contrary once Mega)'),
    'rapS': S('Staraptor', 'staraptor', 'Choice Scarf', 'Intimidate', 'Jolly', [32, 2, 0, 0, 0, 32], ['Final Gambit', 'Close Combat', 'Brave Bird', 'U-turn'], 'L: Scarf Final Gambit (98%)'),
    'grimm': S('Grimmsnarl', 'grimmsnarl', 'Light Clay', 'Prankster', 'Careful', [32, 0, 19, 0, 15, 0], ['Light Screen', 'Reflect', 'Parting Shot', 'Spirit Break'], 'L: modal'),
    'volc': S('Volcarona', 'volcarona', 'Rocky Helmet', 'Flame Body', 'Bold', [32, 0, 32, 0, 2, 0], ['Rage Powder', 'Struggle Bug', 'Quiver Dance', 'Protect'], 'L: support (Rocky Helmet 39%)'),
    'volc_tw': S('Volcarona', 'volcarona', 'Grassy Seed', 'Flame Body', 'Bold', [32, 0, 32, 0, 2, 0], ['Rage Powder', 'Tailwind', 'Overheat', 'Protect'], 'L: Tailwind 43%, Overheat 50%'),
    'volc_off': S('Volcarona', 'volcarona', 'Sitrus Berry', 'Flame Body', 'Modest', [32, 0, 11, 5, 1, 17], ['Heat Wave', 'Giga Drain', 'Quiver Dance', 'Protect'], 'W: attacker; Fire 4x into Forretress, 2x Corviknight / Kleavor-free Steels'),
    'basc': S('Basculegion-F', 'basculegionf', 'Focus Sash', 'Swift Swim', 'Modest', [0, 0, 1, 32, 1, 32], ['Shadow Ball', 'Muddy Water', 'Ice Beam', 'Protect'], 'L: Sash 85%'),
    'mamo': S('Mamoswine', 'mamoswine', 'Focus Sash', 'Oblivious', 'Adamant', [2, 32, 0, 0, 0, 32], ['Ice Shard', 'High Horsepower', 'Icicle Crash', 'Protect'], 'L: modal'),
    'tsa': S('Tsareena', 'tsareena', 'Wide Lens', 'Queenly Majesty', 'Jolly', [2, 32, 0, 0, 0, 32], ['Triple Axel', 'Power Whip', 'High Jump Kick', 'Protect'], 'L: modal; Queenly Majesty blocks priority (Prankster) into his side'),
    'emp': S('Empoleon', 'empoleon', 'Chople Berry', 'Competitive', 'Modest', [32, 0, 0, 19, 0, 15], ['Flash Cannon', 'Ice Beam', 'Hydro Pump', 'Protect'], 'L: modal'),
    'jolt': S('Jolteon', 'jolteon', 'Focus Sash', 'Volt Absorb', 'Timid', [1, 0, 1, 32, 0, 32], ['Thunderbolt', 'Electroweb', 'Shadow Ball', 'Detect'], 'L: Sash; Electroweb speed control'),
    'tauros': S('Tauros', 'tauros', 'Life Orb', 'Sheer Force', 'Adamant', [2, 32, 0, 0, 0, 32], ['Rock Slide', 'Body Slam', 'Close Combat', 'Protect'], 'W: no ladder data; Sheer Force Life Orb (Week 1 game 2)'),
    'swalot': S('Swalot', 'swalot', 'Leftovers', 'Liquid Ooze', 'Sassy', [32, 0, 17, 0, 17, 0], ['Body Press', 'Stockpile', 'Toxic', 'Protect'], 'L: modal'),
}
KALTS = {'staraptor': ['Sharp Beak', 'Focus Sash'], 'grimmsnarl': ['Sitrus Berry', 'Roseli Berry'], 'volcarona': ['Grassy Seed', 'Sitrus Berry', 'Charti Berry'],
         'basculegionf': ['Life Orb', 'Mystic Water', 'Expert Belt'], 'mamoswine': ['Life Orb', 'Never-Melt Ice', 'Choice Scarf'],
         'tsareena': ['Choice Scarf', 'Focus Sash'], 'empoleon': ['Leftovers', 'Sitrus Berry'], 'jolteon': ['Life Orb', 'Magnet', 'Choice Scarf'],
         'tauros': ['Silk Scarf', 'Expert Belt'], 'swalot': ['Sitrus Berry']}
for _s in K.values():
    _s['alts'] = KALTS.get(_s['species'], [])
# Order inside a six = item priority (Tauros before Basculegion / Mamoswine, so it keeps Life Orb).
KT = [
    ('k01', 'Week 1 core: Mega Staraptor Tailwind, Grimmsnarl screens, Volcarona, Tauros, Basculegion-F, Mamoswine', 0.20, ['rapM', 'grimm', 'volc', 'tauros', 'basc', 'mamo'], 'his most likely six'),
    ('k02', 'Week 1 core, Tsareena for Tauros', 0.10, ['rapM', 'grimm', 'volc', 'basc', 'mamo', 'tsa'], ''),
    ('k03', 'Empoleon for Basculegion-F', 0.08, ['rapM', 'grimm', 'volc', 'tauros', 'emp', 'mamo'], 'Steel / Water body vs Hex\'s Dragons and Rocks'),
    ('k04', 'Fast: Jolteon + Tsareena, no Mamoswine', 0.08, ['rapM', 'grimm', 'volc', 'basc', 'jolt', 'tsa'], ''),
    ('k05', 'Scarf Staraptor (Final Gambit) instead of the Mega', 0.07, ['rapS', 'grimm', 'volc', 'tauros', 'basc', 'mamo'], ''),
    ('k06', 'Empoleon + Jolteon + Tauros', 0.06, ['rapM', 'grimm', 'tauros', 'emp', 'jolt', 'mamo'], ''),
    ('k07', 'Anti-Hex: Water + Ice + Fire', 0.10, ['rapM', 'grimm', 'volc_off', 'basc', 'emp', 'mamo'], 'Water into Armarouge / Rotom-Heat / Kleavor, Ice into Garchomp / Drampa, Fire into Corviknight / Forretress'),
    ('k08', 'Double Tailwind (Volcarona Tailwind)', 0.08, ['rapM', 'grimm', 'volc_tw', 'basc', 'tsa', 'mamo'], ''),
    ('k09', 'Scarf Staraptor + Swalot (usage-random shape)', 0.04, ['rapS', 'tsa', 'grimm', 'emp', 'basc', 'swalot'], 'league/8-1 shape'),
    ('k10', 'No Staraptor: Volcarona + Empoleon + Jolteon', 0.04, ['mamo', 'basc', 'tsa', 'emp', 'volc', 'jolt'], 'league/8-3 shape'),
    ('k11', 'Mega Staraptor, no Volcarona / Mamoswine', 0.05, ['rapM', 'grimm', 'basc', 'jolt', 'emp', 'tsa'], 'league/8-5 shape'),
    ('k12', 'All-out offense, no Grimmsnarl', 0.05, ['rapM', 'volc_off', 'tauros', 'basc', 'mamo', 'tsa'], ''),
]
KPERSONAS = {t: ['rock', 0.3] for t, _, _, keys, _ in KT if 'tauros' in keys}
KROWS = [{'if': f'their 6 includes {n}', 'need': [s]} for s, n in [('staraptor', 'Staraptor'), ('grimmsnarl', 'Grimmsnarl'), ('volcarona', 'Volcarona'),
         ('basculegionf', 'Basculegion-F'), ('mamoswine', 'Mamoswine'), ('tsareena', 'Tsareena'), ('empoleon', 'Empoleon'), ('jolteon', 'Jolteon')]]

if __name__ == '__main__':
    ours, oe = build(HX, CT + list(HT) + ET + BELIEF, 'hex')
    theirs, te = build(K, KT, 'calvin')
    for tid_, p in oe + te:
        print('PROBLEM', tid_, p)
    swaps = [(t['id'], t['why'].split(' | ', 1)[1]) for t in ours + theirs if ' | ' in t['why']]
    for t, s in swaps:
        print('item swap', t, s)
    dst = os.path.join(ROOT, 'tools', 'sim', 'candidates', 'hex-vs-calvin.json')
    json.dump({'version': 1, 'written': '2026-11-09', 'format': 'gen9championsvgc2026regmc', 'level': 50,
               'notes': 'Week 5 mock (gen_hex_vs_calvin.py): ours = Hex (c01-c12 Calvin-targeted, h01-h20 Week 4 model, e001-e210 every six), opponent = Calvin k01-k12.',
               'opponent': {'coach': 'Calvin', 'seat': 8, 'teams': theirs, 'personas': KPERSONAS, 'rows': KROWS},
               'ours': {'coach': 'Hex', 'seat': 1, 'teams': ours, 'beliefRef': 'b01,b02,b03'}}, open(dst, 'w'), indent=1)
    print(len(ours), 'Hex teams,', len(theirs), 'Calvin teams; problems:', len(oe) + len(te), '; item swaps:', len(swaps))

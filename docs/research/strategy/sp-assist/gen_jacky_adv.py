"""Week 5 vs Jacky, adversarial set search (2026-11-11, Anthony: "take my opponent's perspective"). The best-response pass
(jacky-report.md section 3) searched his sixes with DEFAULT sets only. Here his strongest sixes against our six yJ10 get
every one-set change from his library (worst-case sets included: Chople / Wisp / Snarl Incineroar, Thunderbolt Farigiraf,
Close Combat / Aqua Jet Golisopod, Yawn / Solar Beam Torkoal, Icy Wind Mr. Rime, Sash Lycanroc, Wisp Rotom-Mow), so the
search plays from his side as a human who has scouted Anthony would. Writes tools/sim/candidates/jacky-adv.json.
  python3 docs/research/strategy/sp-assist/gen_jacky_adv.py [stage2 keys json]"""
import json, os, sys
from gen_jacky import J, ROOT
from gen_candidates import build

BY_SPECIES = {}
for k, s in J.items():
    BY_SPECIES.setdefault(s['species'], []).append(k)
BASES = {
    'q007': ['goliM', 'incin', 'fari', 'tork', 'mimi_tr', 'rotomb'],
    'q052': ['goliM', 'incin', 'tork', 'rime', 'rotomb', 'apple'],
    'j07': ['goliM', 'incin_chople', 'fari_tb', 'tork', 'mow_wisp', 'lyc_fast'],
}
teams = []
for b, keys in BASES.items():
    teams.append((f'a{b}', f'{b} base', 1, keys, 'base'))
    for i, k in enumerate(keys):
        for alt in BY_SPECIES[J[k]['species']]:
            if alt == k:
                continue
            six = keys[:i] + [alt] + keys[i + 1:]
            teams.append((f'a{b}-{alt}', f'{b}: {k} -> {alt}', 1, six, 'one-set change'))
# stage 2: explicit sixes (combined best changes), passed as a JSON file {id: [keys]}
if len(sys.argv) > 1:
    for tid_, keys in json.load(open(sys.argv[1])).items():
        teams.append((tid_, 'combined: ' + ', '.join(keys), 1, keys, 'stage 2'))

if __name__ == '__main__':
    jt, je = build(J, teams, 'jacky')
    for t, p in je:
        print('PROBLEM', t, p)
    src = json.load(open(os.path.join(ROOT, 'tools', 'sim', 'candidates', 'jacky.json')))
    ours = {**src['ours'], 'teams': [t for t in src['ours']['teams'] if t['id'] in ('yJ10', 'b01', 'b02')]}
    personas = {t[0]: (['rock', 0.6] if 'lyc' in ' '.join(t[3]) else ['tr', 0.3]) for t in teams}
    json.dump({'version': 1, 'written': '2026-11-11', 'format': src['format'], 'level': 50,
               'notes': 'Adversarial set search vs yJ10 (gen_jacky_adv.py).',
               'opponent': {**src['opponent'], 'teams': jt, 'personas': personas},
               'ours': ours}, open(os.path.join(ROOT, 'tools', 'sim', 'candidates', 'jacky-adv.json'), 'w'), indent=1)
    print(len(jt), 'Jacky variants; problems:', len(je))

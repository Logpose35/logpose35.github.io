"""
- Insère "Reverie" dans ARCS entre Whole Cake Island (28) et Wano (29)
- Bumpe tous les personnages avec arc >= 29 de +1
- Applique les corrections spécifiques
"""
import json

with open('data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# ── 1. Insérer Reverie à l'index 28 (après WCI à l'index 27) ──
data['ARCS'].insert(28, 'Reverie')
print('ARCS après insertion:')
for i, arc in enumerate(data['ARCS']):
    print(f'  {i+1:2}. {arc}')

# ── 2. Bumper tous les personnages avec arc >= 29 (+1) ──
bumped = []
for char in data['CHARACTERS']:
    if char.get('arc', 0) >= 29:
        char['arc'] += 1
        bumped.append(f"{char['name']}: {char['arc']-1} → {char['arc']}")

print(f'\nPersonnages bumpés ({len(bumped)}):')
for b in bumped:
    print(f'  {b}')

# ── 3. Corrections spécifiques ──
CORRECTIONS = {
    'Jimbei':          21,  # Impel Down
    'Sabo':            26,  # Dressrosa
    'Scopper Gaban':   30,  # Wano (flashback Roger, arc 30 après insertion)
    'Koala':           26,  # Dressrosa
    'Shiryu':          21,  # Impel Down
    'Pedro':           27,  # Zou
    'Kanjuro':         26,  # Dressrosa
    'Zunesha':         27,  # Zou
    'Nefertari Cobra': 11,  # Alabasta
    'Belo Betty':      29,  # Reverie
    'Morley':          29,  # Reverie
    'Lindbergh':       29,  # Reverie
    'Karasu':          29,  # Reverie
}

print('\nCorrections spécifiques:')
for char in data['CHARACTERS']:
    if char['name'] in CORRECTIONS:
        old = char['arc']
        char['arc'] = CORRECTIONS[char['name']]
        arc_name = data['ARCS'][char['arc'] - 1]
        print(f"  {char['name']}: {old} → {char['arc']} ({arc_name})")

# ── 4. Vérification finale ──
print('\nVérification — arcs 28-32:')
for char in data['CHARACTERS']:
    if char.get('arc', 0) >= 28:
        arc_name = data['ARCS'][char['arc'] - 1]
        print(f"  arc {char['arc']:2} ({arc_name:<20}) — {char['name']}")

# ── 5. Écriture ──
with open('data.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, separators=(',', ':'))

print(f'\ndata.json mis a jour ! ARCS: {len(data["ARCS"])} arcs, CHARACTERS: {len(data["CHARACTERS"])} persos')

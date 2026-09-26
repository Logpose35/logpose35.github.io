# -*- coding: utf-8 -*-
"""
tirage.py — Jumeau Python de js/tirage.js : les réponses du jour depuis la v8.1.

Les deux fichiers DOIVENT rendre exactement les mêmes réponses (tools/test-tirage.js
les compare jour par jour). Toute retouche des règles se fait des deux côtés.
Les règles, et pourquoi le calendrier pré-généré a disparu : voir l'en-tête de js/tirage.js.

Usage :
  python tools/tirage.py --verifier            état : bascule, archive, éléments sans date d'entrée
  python tools/tirage.py --entrees             donne une date d'entrée (demain) aux nouveautés
  python tools/tirage.py --entrees --date AAAA-MM-JJ
  python tools/tirage.py --apercu 30 --graine 12345
                                               aperçu avec une graine de DÉMONSTRATION : ne jamais
                                               afficher la vraie suite (le propriétaire joue chaque jour)
  python tools/tirage.py --dump 400 [--graine G]   JSON des journées calculées (test de parité)

Après TOUT ajout (personnage, fruit, silhouette, tome) : lancer `--entrees`. Sans date
d'entrée, un élément n'est jamais tiré — l'oubli retarde son arrivée, il ne casse rien.
"""
import io, json, os, sys, argparse
from datetime import date, datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAL = os.path.join(ROOT, 'calendar.json')

GRAINE = 435432186      # tirée au hasard le 26/09/2026 — ne plus jamais la changer
EXCLUSION = 90
BOOST = 10          # nouveautés : ×10 pendant 45 jours (réglage : voir js/tirage.js)
BOOST_JOURS = 45
ORDRE_PERSOS = ['classic', 'wanted', 'silhouette', 'emoji', 'fruit']
SELS = {'classic': 1, 'wanted': 31, 'fruit': 71, 'emoji': 137, 'audio': 53, 'tome': 181, 'silhouette': 211, 'anniv': 7}
ANNIVERSAIRES = {
    '01-01': ['Portgas D. Ace'], '02-06': ['Nico Robin'], '03-02': ['Sanji'], '03-09': ['Franky'],
    '03-20': ['Sabo'], '04-01': ['Usopp'], '04-02': ['Jimbei'], '04-03': ['Brook'],
    '04-06': ['Edward Newgate'], '05-02': ['Garp'], '05-05': ['Monkey D. Luffy'], '05-13': ['Rayleigh'],
    '07-03': ['Nami'], '09-02': ['Boa Hancock'], '10-06': ['Trafalgar D. Water Law'],
    '11-11': ['Roronoa Zoro'], '12-24': ['Tony Tony Chopper'],
}
M32 = 0xFFFFFFFF
INF = float('inf')
EPOQUE = date(1970, 1, 1)


# ── Hasard déterministe (identique à js/tirage.js) ─────────────────────────────
def seed_hash(base, salt):
    h = ((base + salt) & M32) * 2654435761 & M32
    h = (h ^ (h >> 16)) & M32
    h = (h * 0x45d9f3b) & M32
    return (h ^ (h >> 16)) & M32


def _imul(a, b):
    return (a * b) & M32


def mulberry32(seed):
    a = [seed & M32]

    def rnd():
        a[0] = (a[0] + 0x6d2b79f5) & M32
        t = a[0]
        t = _imul(t ^ (t >> 15), t | 1)
        t = (t ^ ((t + _imul(t ^ (t >> 7), t | 61)) & M32)) & M32
        return ((t ^ (t >> 14)) & M32) / 4294967296
    return rnd


def rng_du(n, sel, graine):
    return mulberry32(seed_hash((n + graine) & M32, sel))


def shuffle_perm(cycle, salt, n):
    rng = mulberry32(seed_hash(cycle, salt))
    a = list(range(n))
    for i in range(n - 1, 0, -1):
        j = int(rng() * (i + 1))
        a[i], a[j] = a[j], a[i]
    return a


def bag_pick(day, salt, n):
    if n <= 1:
        return 0
    cycle = day // n
    pos = day - cycle * n
    perm = shuffle_perm(cycle, salt, n)
    if cycle > 0 and perm[0] == shuffle_perm(cycle - 1, salt, n)[n - 1]:
        perm = perm[1:] + [perm[0]]
    return perm[pos]


def num_jour(iso):
    y, m, d = (int(x) for x in iso.split('-'))
    return (date(y, m, d) - EPOQUE).days


def iso_de(n):
    return (EPOQUE + timedelta(days=n)).isoformat()


# ── Préparation ────────────────────────────────────────────────────────────────
def preparer(data, focus, cal, graine=None):
    graine = GRAINE if graine is None else graine
    E = (cal or {}).get('entrees') or {}

    def entrees(groupe):
        m = {}
        for dt, ids in (E.get(groupe) or {}).items():
            for i in ids or []:
                m[str(i)] = num_jour(dt)
        return m
    eP, eF, eS, eT = entrees('personnages'), entrees('fruits'), entrees('silhouettes'), entrees('tomes')
    de = lambda m, i: m.get(str(i), INF)
    chars = data.get('CHARACTERS') or []
    sil_key = lambda c: c['img'][0] if isinstance(c.get('img'), list) else c.get('img')
    perso = lambda c: {'id': c['name'], 'perso': c['name'], 'entree': de(eP, c['name'])}

    pools = {
        'classic': [perso(c) for c in chars],
        'wanted': [perso(c) for c in chars if c.get('img') is not None],
        'emoji': [perso(c) for c in chars if isinstance(c.get('emoji'), list) and len(c['emoji']) > 0],
        'silhouette': [{'id': c['name'], 'perso': c['name'], 'entree': max(de(eP, c['name']), de(eS, c['name']))}
                       for c in chars if sil_key(c) and focus and focus.get(sil_key(c))],
        'fruit': [{'id': f['name'], 'perso': f.get('holder'),
                   'entree': max(de(eF, f['name']), de(eP, f.get('holder')))} for f in data.get('FRUITS') or []],
        'tome': [{'id': t, 'perso': None, 'entree': de(eT, t)} for t in data.get('TOMES') or []],
    }
    archive = (cal or {}).get('days') or {}
    jours = sorted(archive)
    derniers = {m: {} for m in pools}
    for iso in jours:
        j, n = archive[iso], num_jour(iso)
        for m in pools:
            if j and j.get(m) is not None:
                derniers[m][str(j[m])] = n
    porteurs = {f['name']: f.get('holder') for f in data.get('FRUITS') or []}
    sorti_perso = {}
    for iso in jours:
        noter_persos(archive[iso], num_jour(iso), porteurs, sorti_perso)
    bascule = num_jour(cal['bascule']) if (cal or {}).get('bascule') else None
    return {
        'graine': graine, 'pools': pools, 'archive': archive, 'derniers': derniers, 'bascule': bascule,
        'porteurs': porteurs, 'sortiPerso': sorti_perso,
        'openings': data.get('OPENINGS') or [],
        'debutHist': num_jour(jours[0]) if jours else (bascule if bascule is not None else 0),
        'prochain': bascule, 'cache': {},
    }


MODES_NOMS = ['classic', 'wanted', 'silhouette', 'emoji']


def noter_persos(j, n, porteurs, sorti_perso):
    if not j:
        return
    for m in MODES_NOMS:
        if j.get(m) is not None:
            sorti_perso[j[m]] = n
    if j.get('fruit') is not None and porteurs.get(j['fruit']):
        sorti_perso[porteurs[j['fruit']]] = n


def booste(ctx, mode, el, n):
    """Règle 3 : favorisé tant qu'il est entré depuis moins de BOOST_JOURS ET jamais sorti
    depuis son entrée (dans n'importe quel mode pour un personnage)."""
    if not (n - el['entree'] < BOOST_JOURS):
        return False
    vu = ctx['derniers'][mode].get(str(el['id'])) if mode in ('fruit', 'tome') else ctx['sortiPerso'].get(el['perso'])
    return not (vu is not None and vu >= el['entree'])


def tirer(ctx, mode, n, pris):
    der = ctx['derniers'][mode]
    cand, poids = [], []
    secours, secours_attente = None, -1
    for el in ctx['pools'][mode]:
        if el['entree'] > n:
            continue
        if el['perso'] and el['perso'] in pris:
            continue
        vu = der.get(str(el['id']))
        attente = n - (vu if vu is not None else ctx['debutHist'])
        if attente > secours_attente:
            secours, secours_attente = el, attente
        if attente <= EXCLUSION:
            continue
        w = attente - EXCLUSION
        if booste(ctx, mode, el, n):
            w *= BOOST
        cand.append(el)
        poids.append(w)
    if not cand:
        return secours
    rng = rng_du(n, SELS[mode], ctx['graine'])
    total = sum(poids)
    r = rng() * total
    acc = 0
    for el, w in zip(cand, poids):
        acc += w
        if r < acc:
            return el
    return cand[-1]


def calculer(ctx, n):
    res, pris = {}, set()
    rng_a = rng_du(n, SELS['anniv'], ctx['graine'])
    for nom in ANNIVERSAIRES.get(iso_de(n)[5:], []):
        if nom in pris:
            continue
        possibles = []
        for mode in ORDRE_PERSOS:
            if mode in res:
                continue
            el = next((e for e in ctx['pools'][mode] if e['perso'] == nom and e['entree'] <= n), None)
            if el:
                possibles.append((mode, el))
        if not possibles:
            continue
        mode, el = possibles[int(rng_a() * len(possibles))]
        res[mode] = el['id']
        pris.add(nom)
    for mode in ORDRE_PERSOS + ['tome']:
        if mode in res:
            continue
        el = tirer(ctx, mode, n, pris)
        res[mode] = el['id'] if el else None
        if el and el['perso']:
            pris.add(el['perso'])
    ops = ctx['openings']
    res['audio'] = ops[bag_pick(n, SELS['audio'], len(ops))]['id'] if ops else None
    for m in ctx['pools']:
        if res.get(m) is not None:
            ctx['derniers'][m][str(res[m])] = n
    noter_persos(res, n, ctx['porteurs'], ctx['sortiPerso'])
    return res


def jour(ctx, iso):
    n = num_jour(iso)
    if ctx['bascule'] is None or n < ctx['bascule']:
        return ctx['archive'].get(iso)
    while ctx['prochain'] <= n:
        ctx['cache'][iso_de(ctx['prochain'])] = calculer(ctx, ctx['prochain'])
        ctx['prochain'] += 1
    return ctx['cache'][iso]


# ── Accès aux fichiers du dépôt ────────────────────────────────────────────────
def charger(graine=None):
    data = json.load(open(os.path.join(ROOT, 'data.json'), encoding='utf-8'))
    focus = json.load(open(os.path.join(ROOT, 'silhouettes', 'focus.json'), encoding='utf-8'))
    cal = json.load(open(CAL, encoding='utf-8'))
    return data, focus, cal, preparer(data, focus, cal, graine)


def aujourdhui_paris():
    # Heure de Paris sans dépendance : UTC+1 l'hiver, UTC+2 de fin mars à fin octobre.
    utc = datetime.now(timezone.utc)
    an = utc.year
    dernier_dim = lambda mois: max(date(an, mois, j) for j in range(25, 32) if date(an, mois, j).weekday() == 6)
    ete = datetime(an, 3, dernier_dim(3).day, 1, tzinfo=timezone.utc) <= utc < datetime(an, 10, dernier_dim(10).day, 1, tzinfo=timezone.utc)
    return (utc + timedelta(hours=2 if ete else 1)).date()


def elements(data, focus):
    """Tous les éléments qui ont besoin d'une date d'entrée, par groupe."""
    sil_key = lambda c: c['img'][0] if isinstance(c.get('img'), list) else c.get('img')
    return {
        'personnages': [c['name'] for c in data['CHARACTERS']],
        'fruits': [f['name'] for f in data['FRUITS']],
        'silhouettes': [c['name'] for c in data['CHARACTERS'] if sil_key(c) and focus.get(sil_key(c))],
        'tomes': [str(t) for t in data.get('TOMES', [])],
    }


def sans_entree(data, focus, cal):
    connus = {g: {str(i) for ids in (cal.get('entrees', {}).get(g) or {}).values() for i in ids} for g in ('personnages', 'fruits', 'silhouettes', 'tomes')}
    return {g: [i for i in ids if i not in connus[g]] for g, ids in elements(data, focus).items()}


def ecrire_cal(cal):
    txt = json.dumps(cal, ensure_ascii=False, separators=(',', ':'))
    open(CAL, 'w', encoding='utf-8', newline='\n').write(txt + '\n')


def basculer(jour_bascule):
    """Migration UNIQUE vers le tirage à règles, à lancer le jour du push de la v8.1 avec
    le LENDEMAIN du push. Repart toujours de la version PUBLIÉE (git HEAD) : l'archive
    est celle que les joueurs ont réellement vue, jamais une régénération locale."""
    import subprocess
    git = lambda p: json.loads(subprocess.run(['git', '-C', ROOT, 'show', 'HEAD:' + p],
                                              capture_output=True, text=True, encoding='utf-8').stdout)
    cal_pub = git('calendar.json')
    if cal_pub.get('bascule'):
        sys.exit('La version publiée a déjà basculé : rien à migrer.')
    data_pub, focus_pub = git('data.json'), git('silhouettes/focus.json')
    data = json.load(open(os.path.join(ROOT, 'data.json'), encoding='utf-8'))
    focus = json.load(open(os.path.join(ROOT, 'silhouettes', 'focus.json'), encoding='utf-8'))
    archive = {k: v for k, v in cal_pub['days'].items() if k < jour_bascule}
    veille = iso_de(num_jour(jour_bascule) - 1)
    if veille not in archive:
        sys.exit(f'La veille de la bascule ({veille}) manque à l\'archive publiée : choisir une autre date.')
    lancement = cal_pub.get('launch', '2026-05-18')
    anciens, tous = elements(data_pub, focus_pub), elements(data, focus)
    entrees = {}
    for g, ids in tous.items():
        vieux = set(anciens[g])
        entrees[g] = {lancement: [i for i in ids if i in vieux]}
        neufs = [i for i in ids if i not in vieux]
        if neufs:
            entrees[g][jour_bascule] = neufs
        print(f'  {g:<12} {len(entrees[g][lancement])} anciens, {len(neufs)} nouveaux')
    ecrire_cal({
        '_note': ("Archive des réponses jouées jusqu'à la veille de la bascule, et dates d'entrée des "
                  "éléments. Depuis la v8.1, les journées à partir de la bascule sont CALCULÉES par "
                  "js/tirage.js (jumeau : tools/tirage.py) : rien d'avance dans ce fichier. Après tout "
                  "ajout : python tools/tirage.py --entrees"),
        'launch': lancement, 'bascule': jour_bascule, 'uncertain': cal_pub.get('uncertain', []),
        'days': archive, 'entrees': entrees,
    })
    retirees = sum(1 for k in cal_pub['days'] if k >= jour_bascule)
    print(f'bascule {jour_bascule} · archive {min(archive)} -> {max(archive)} ({len(archive)} jours) · '
          f'{retirees} journées d\'avance retirées du fichier public')


def main():
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    ap = argparse.ArgumentParser()
    ap.add_argument('--bascule', metavar='AAAA-MM-JJ', help='migration unique (jour du push, avec le lendemain)')
    ap.add_argument('--verifier', action='store_true')
    ap.add_argument('--entrees', action='store_true')
    ap.add_argument('--date')
    ap.add_argument('--apercu', type=int)
    ap.add_argument('--dump', type=int)
    ap.add_argument('--graine', type=int)
    a = ap.parse_args()
    if a.bascule:
        basculer(a.bascule)
        return
    data, focus, cal, ctx = charger(a.graine)

    if a.entrees:
        dt = a.date or (aujourdhui_paris() + timedelta(days=1)).isoformat()
        manque = sans_entree(data, focus, cal)
        cal.setdefault('entrees', {})
        total = 0
        for g, ids in manque.items():
            if ids:
                cal['entrees'].setdefault(g, {}).setdefault(dt, []).extend(ids)
                total += len(ids)
                print(f'  {g:<12} +{len(ids)} entrant le {dt} : {", ".join(ids[:6])}{" …" if len(ids) > 6 else ""}')
        if total:
            ecrire_cal(cal)
        print(f'{total} élément(s) daté(s).' if total else 'Rien à dater : tout a sa date d\'entrée.')
        return

    if a.dump is not None:
        debut = ctx['bascule']
        out = {iso_de(n): jour(ctx, iso_de(n)) for n in range(debut, debut + a.dump)}
        print(json.dumps(out, ensure_ascii=False))
        return

    if a.apercu is not None:
        if a.graine is None:
            sys.exit('Aperçu refusé sans --graine : la vraie suite ne doit jamais être affichée.')
        debut = max(ctx['bascule'], num_jour(aujourdhui_paris().isoformat()) + 1)
        for n in range(debut, debut + a.apercu):
            print(iso_de(n), json.dumps(jour(ctx, iso_de(n)), ensure_ascii=False))
        return

    # --verifier (défaut)
    manque = sans_entree(data, focus, cal)
    arch = sorted(cal.get('days', {}))
    print('bascule :', cal.get('bascule'), '| archive :', arch[0] if arch else '-', '→', arch[-1] if arch else '-',
          f'({len(arch)} jours)')
    futur = [k for k in arch if cal.get('bascule') and k >= cal['bascule']]
    print('journées d\'archive au-delà de la bascule (seraient ignorées ET lisibles par tous) :', len(futur))
    for g, ids in manque.items():
        print(f'sans date d\'entrée ({g}) : {len(ids)}' + (f' → {", ".join(ids[:8])}' if ids else ''))
    print('pools :', {m: len(p) for m, p in ctx['pools'].items()}, '| openings :', len(ctx['openings']))


if __name__ == '__main__':
    main()

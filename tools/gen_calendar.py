# -*- coding: utf-8 -*-
"""
gen_calendar.py — Génère calendar.json : la réponse de chaque mode, jour par jour.

POURQUOI
    Jusqu'ici la cible du jour était CALCULÉE au chargement : `_bagPick(jour, salt, N)`
    où N = taille du pool. Conséquence : ajouter un personnage ou une silhouette
    décale TOUTES les journées, passées comme présentes — au point que déployer de
    nouvelles silhouettes changeait la réponse du jour EN COURS.

    Le calendrier fige le résultat. Le jeu lit ce fichier ; le calcul ne sert plus
    que de filet quand une date y manque.

DEUX RÈGLES, opposées selon le côté de la date du jour :
    • date <= aujourd'hui : JAMAIS réécrite. C'est l'archive, elle est immuable.
    • date  > aujourd'hui : régénérée à chaque exécution, donc à chaque changement
      de pool — c'est ainsi que les nouveaux personnages entrent en rotation.

L'algorithme reproduit EXACTEMENT celui de js/data.js (sac sans remise, permutation
seedée par cycle, garde-fou de jonction, override anniversaire du Classique). Toute
divergence ferait changer la réponse d'un jour déjà joué : `--verify` compare les
deux implémentations, et tools/verify_calendar.js les recroise dans le navigateur.

Usage :  python tools/gen_calendar.py            (archive + 90 jours d'avance)
         python tools/gen_calendar.py --days 30  (autre horizon)
         python tools/gen_calendar.py --check    (n'écrit rien, dit ce qui manque)
"""
import io, json, os, sys, argparse
from datetime import date, timedelta

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAL  = os.path.join(ROOT, 'calendar.json')

# Première journée reproductible à l'identique : le pool a changé pour la dernière
# fois le 03/08/2026 (+2 persos, focus.json modifié le même jour). Avant cette date,
# le modulo a bougé et les réponses réellement vues par les joueurs sont perdues.
FIRST_DAY = date(2026, 8, 4)

# Salt premier par mode — mêmes valeurs que js/data.js, ne jamais les changer.
SALTS = {'classic': 1, 'wanted': 31, 'fruit': 71, 'emoji': 137,
         'audio': 53, 'tome': 181, 'silhouette': 211}

M32 = 0xFFFFFFFF


# ───────────────────────── portage de js/data.js ─────────────────────────
def _seed_hash(base, salt):
    h = ((base + salt) & M32) * 2654435761 & M32
    h = (h ^ (h >> 16)) & M32
    h = (h * 0x45d9f3b) & M32
    return (h ^ (h >> 16)) & M32


def _mulberry32(seed):
    a = [seed & M32]
    def rnd():
        a[0] = (a[0] + 0x6d2b79f5) & M32
        t = a[0]
        t = ((t ^ (t >> 15)) * (t | 1)) & M32
        t = (t ^ (t + ((t ^ (t >> 7)) * (t | 61) & M32))) & M32
        return ((t ^ (t >> 14)) & M32) / 4294967296
    return rnd


def _shuffle_perm(cycle, salt, n):
    rng = _mulberry32(_seed_hash(cycle, salt))
    a = list(range(n))
    for i in range(n - 1, 0, -1):
        j = int(rng() * (i + 1))
        a[i], a[j] = a[j], a[i]
    return a


def _day_number(d):
    return (d - date(1970, 1, 1)).days


def _bag_pick(day, salt, n):
    if n <= 1:
        return 0
    cycle = day // n
    pos   = day - cycle * n
    perm  = _shuffle_perm(cycle, salt, n)
    # Garde-fou de jonction : évite que le 1er du cycle répète le dernier du précédent
    if cycle > 0 and perm[0] == _shuffle_perm(cycle - 1, salt, n)[n - 1]:
        perm = perm[1:] + [perm[0]]
    return perm[pos]


def daily_index(d, salt, n):
    return _bag_pick(_day_number(d), salt, n)


def _date_base(d):
    return d.year * 10000 + d.month * 100 + d.day


def daily_seed(d, salt):
    return _seed_hash(_date_base(d), salt)


# ───────────────────────── pools (mêmes filtres que loadGameData) ─────────
BIRTHDAYS = {
    '01-01': ['Portgas D. Ace'], '02-06': ['Nico Robin'], '03-02': ['Sanji'],
    '03-09': ['Franky'], '03-20': ['Sabo'], '04-01': ['Usopp'], '04-02': ['Jimbei'],
    '04-03': ['Brook'], '04-06': ['Edward Newgate'], '05-02': ['Garp'],
    '05-05': ['Monkey D. Luffy'], '05-13': ['Rayleigh'], '07-03': ['Nami'],
    '09-02': ['Boa Hancock'], '10-06': ['Trafalgar D. Water Law'],
    '11-11': ['Roronoa Zoro'], '12-24': ['Tony Tony Chopper'],
}


def load_pools():
    d = json.load(open(os.path.join(ROOT, 'data.json'), encoding='utf-8'))
    focus = json.load(open(os.path.join(ROOT, 'silhouettes', 'focus.json'), encoding='utf-8'))
    chars = d['CHARACTERS']

    def sil_key(c):
        k = c['img'][0] if isinstance(c.get('img'), list) else c.get('img')
        return k

    return {
        'classic':    chars,
        'wanted':     [c for c in chars if c.get('img') is not None],
        'fruit':      d['FRUITS'],
        'emoji':      [c for c in chars if isinstance(c.get('emoji'), list) and c['emoji']],
        'audio':      d['OPENINGS'],
        'tome':       d.get('TOMES', []),
        'silhouette': [c for c in chars if sil_key(c) and focus.get(sil_key(c))],
    }, chars


def pick_for(day, pools, chars):
    """Les 7 réponses d'une journée, sous leur forme identifiante (nom ou numéro)."""
    out = {}
    for mode, pool in pools.items():
        if not pool:
            out[mode] = None
            continue
        item = pool[daily_index(day, SALTS[mode], len(pool))]
        out[mode] = item if mode == 'tome' else (item['id'] if mode == 'audio' else item['name'])

    # Override anniversaire du Classique (js/data.js) : 30 % de chances qu'un perso
    # dont c'est l'anniversaire remplace le tirage du sac.
    mmdd  = '%02d-%02d' % (day.month, day.day)
    names = [n for n in BIRTHDAYS.get(mmdd, []) if any(c['name'] == n for c in chars)]
    if names and daily_seed(day, 7) % 10 < 3:
        out['classic'] = names[daily_seed(day, 11) % len(names)]
    return out


# ───────────────────────── génération ─────────────────────────
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--days', type=int, default=90, help="jours d'avance à générer")
    ap.add_argument('--check', action='store_true', help='ne rien écrire, juste diagnostiquer')
    ap.add_argument('--verify', action='store_true', help='recalcule et compare les journées archivées')
    args = ap.parse_args()

    pools, chars = load_pools()
    today = date.today()
    cal   = {}
    if os.path.exists(CAL):
        cal = json.load(open(CAL, encoding='utf-8')).get('days', {})

    if args.check or args.verify:
        past = [k for k in cal if k <= today.isoformat()]
        ahead = len([k for k in cal if k > today.isoformat()])
        print('archive : %d jours (%s → %s)' % (len(past), min(past, default='—'), max(past, default='—')))
        print("avance  : %d jours%s" % (ahead, '  ⚠️  REGÉNÉRER' if ahead < 30 else ''))
        if args.verify:
            ko = [k for k in sorted(past)
                  if cal[k] != pick_for(date.fromisoformat(k), pools, chars)]
            print('divergences sur l\'archive : %d' % len(ko))
            for k in ko[:10]:
                print('  ', k, 'fichier =', cal[k])
                print('  ', ' ' * len(k), 'calculé =', pick_for(date.fromisoformat(k), pools, chars))
            if ko:
                print('→ NORMAL si le pool a changé depuis : le fichier fait foi, il n\'est pas réécrit.')
        return

    figees, ajoutees, regenerees = 0, 0, 0
    d = FIRST_DAY
    end = today + timedelta(days=args.days)
    while d <= end:
        k = d.isoformat()
        if k in cal and d <= today:
            figees += 1                      # archive : intouchable
        else:
            if k in cal:
                regenerees += 1
            else:
                ajoutees += 1
            cal[k] = pick_for(d, pools, chars)
        d += timedelta(days=1)

    # Purge des dates hors fenêtre au-delà de l'horizon (si on réduit --days)
    cal = {k: v for k, v in cal.items() if k <= end.isoformat()}

    out = {
        '_note': ("Réponses figées jour par jour. Les dates <= aujourd'hui ne sont JAMAIS "
                  "réécrites (archive) ; celles d'après sont régénérées à chaque exécution de "
                  "tools/gen_calendar.py, ce qui fait entrer les nouveaux personnages."),
        'days': dict(sorted(cal.items())),
    }
    json.dump(out, open(CAL, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('calendar.json : %d jours (%d figés, %d ajoutés, %d régénérés) · %.1f Ko'
          % (len(cal), figees, ajoutees, regenerees, os.path.getsize(CAL) / 1024))
    print('pools : ' + ' · '.join('%s %d' % (m, len(p)) for m, p in pools.items()))


if __name__ == '__main__':
    main()

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
import io, json, os, sys, argparse, subprocess
from datetime import date, datetime, timedelta

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


# ───────────────────────── reconstitution par l'historique git ─────────────
# Le calendrier ne peut naître qu'aujourd'hui… sauf à rejouer le passé du dépôt :
# pour chaque journée écoulée, on ressort le data.json et le focus.json QUI ÉTAIENT
# EN LIGNE ce jour-là, et on applique l'algorithme de tirage de l'époque.
#
# Trois choses ont bougé depuis l'ouverture, et il faut les respecter :
#   • l'algorithme : modulo simple jusqu'au 17/07/2026, sac sans remise depuis ;
#   • les modes : ils sont arrivés un par un (dates ci-dessous) ;
#   • l'override anniversaire du Classique, apparu avec la v5 le 04/06/2026.
#
# Une journée pendant laquelle un de ces éléments a changé est marquée « incertaine » :
# les joueurs du matin et ceux du soir n'ont pas vu la même réponse.
LAUNCH = date(2026, 5, 18)          # 1er commit du dépôt — sert aussi à numéroter les jours

BAG_FROM      = date(2026, 7, 18)   # lendemain de 330bdc6 (tirage sans remise)
BIRTHDAY_FROM = date(2026, 6, 5)    # lendemain de 8b80245 (v5)
MODE_FROM = {                       # 1re journée CERTAINE de chaque mode
    'classic': date(2026, 5, 19), 'wanted': date(2026, 5, 19), 'fruit': date(2026, 5, 19),
    'emoji':   date(2026, 5, 20), 'audio':  date(2026, 5, 24), 'tome':  date(2026, 6, 5),
    'silhouette': date(2026, 7, 3),
}
# Journées où le jeu a changé sous les pieds des joueurs (déploiement en cours de journée)
SWITCH_DAYS = {date(2026, 5, 18), date(2026, 5, 19), date(2026, 5, 23),
               date(2026, 6, 4), date(2026, 7, 2), date(2026, 7, 17)}


def _git(*args):
    return subprocess.run(['git'] + list(args), cwd=ROOT, capture_output=True,
                          text=True, encoding='utf-8').stdout


def _versions(path):
    """[(sha, date locale du commit)] du plus récent au plus ancien."""
    out = []
    for line in _git('log', '--format=%H|%cI', '--', path).splitlines():
        sha, iso = line.split('|', 1)
        out.append((sha, datetime.fromisoformat(iso).date()))
    return out


def _version_at(versions, d):
    """Version en ligne au MATIN du jour d = dernier commit antérieur à d."""
    for sha, cd in versions:
        if cd < d:
            return sha
    return None


_CACHE = {}


def _blob(sha, path):
    key = (sha, path)
    if key not in _CACHE:
        _CACHE[key] = json.loads(_git('show', '%s:%s' % (sha, path)))
    return _CACHE[key]


def _legacy_index(d, salt, n):
    """Tirage d'avant le 17/07 : modulo, avec anti-répétition de la veille."""
    if n <= 1:
        return 0
    idx = _seed_hash(_date_base(d), salt) % n
    prev = _seed_hash(_date_base(d - timedelta(days=1)), salt) % n
    return (idx + 1) % n if idx == prev else idx


def pools_from(data, focus):
    chars = data['CHARACTERS']

    def sk(c):
        return c['img'][0] if isinstance(c.get('img'), list) else c.get('img')

    return {
        'classic':    chars,
        'wanted':     [c for c in chars if c.get('img') is not None],
        'fruit':      data.get('FRUITS', []),
        'emoji':      [c for c in chars if isinstance(c.get('emoji'), list) and c['emoji']],
        'audio':      data.get('OPENINGS', []),
        'tome':       data.get('TOMES', []),
        'silhouette': [c for c in chars if sk(c) and focus.get(sk(c))],
    }


def reconstruct(d, data, focus):
    """Les réponses telles qu'un joueur les a vues ce jour-là (modes existants seulement)."""
    pools = pools_from(data, focus)
    index = daily_index if d >= BAG_FROM else _legacy_index
    out = {}
    for mode, pool in pools.items():
        if d < MODE_FROM[mode] or not pool:
            out[mode] = None
            continue
        item = pool[index(d, SALTS[mode], len(pool))]
        out[mode] = item if mode == 'tome' else (item['id'] if mode == 'audio' else item['name'])

    if d >= BIRTHDAY_FROM:
        mmdd  = '%02d-%02d' % (d.month, d.day)
        names = [n for n in BIRTHDAYS.get(mmdd, []) if any(c['name'] == n for c in data['CHARACTERS'])]
        if names and daily_seed(d, 7) % 10 < 3:
            out['classic'] = names[daily_seed(d, 11) % len(names)]
    return out


def backfill_git(cal, today, ecrire=True):
    vd = _versions('data.json')
    vf = _versions('silhouettes/focus.json')
    jours_data = {cd for _, cd in vd} | {cd for _, cd in vf}

    ajoutes, incertains, verifies, divergents, dates_ajoutees = 0, [], 0, [], []
    d = LAUNCH
    while d <= today:
        sha_d = _version_at(vd, d)
        if not sha_d:
            d += timedelta(days=1); continue
        sha_f = _version_at(vf, d)
        data  = _blob(sha_d, 'data.json')
        focus = _blob(sha_f, 'silhouettes/focus.json') if sha_f else {}
        rec   = reconstruct(d, data, focus)
        k = d.isoformat()

        if k in cal:
            # Journée déjà archivée : sert de contrôle de la méthode
            verifies += 1
            if any(cal[k].get(m) != rec[m] for m in rec if rec[m] is not None):
                divergents.append(k)
        else:
            garde = {m: v for m, v in rec.items() if v is not None}
            if garde:                      # une journée sans aucun mode ne sert à rien
                if ecrire:
                    cal[k] = garde
                ajoutes += 1
                dates_ajoutees.append(k)
                if d in SWITCH_DAYS or d in jours_data:
                    incertains.append(k)
        d += timedelta(days=1)

    print('reconstitution : %d journées ajoutées (%s → %s)'
          % (ajoutes, dates_ajoutees[0] if dates_ajoutees else '—',
             dates_ajoutees[-1] if dates_ajoutees else '—'))
    print('contrôle       : %d journées déjà archivées recalculées, %d divergence(s)%s'
          % (verifies, len(divergents), ' → ' + ', '.join(divergents[:5]) if divergents else ''))
    print('incertaines    : %d (déploiement en cours de journée) → %s'
          % (len(incertains), ', '.join(incertains) if incertains else '—'))
    return cal, divergents, incertains


# ───────────────────────── génération ─────────────────────────
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--days', type=int, default=90, help="jours d'avance à générer")
    ap.add_argument('--check', action='store_true', help='ne rien écrire, juste diagnostiquer')
    ap.add_argument('--verify', action='store_true', help='recalcule et compare les journées archivées')
    ap.add_argument('--backfill-git', action='store_true',
                    help="reconstitue le passé depuis l'historique du dépôt (n'écrase jamais l'existant)")
    ap.add_argument('--dry-run', action='store_true', help='avec --backfill-git : ne rien écrire')
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

    if args.backfill_git:
        cal, divergents, incertains = backfill_git(cal, today, ecrire=not args.dry_run)
        if divergents:
            print('\n⚠️  La méthode ne retrouve pas les journées déjà archivées : rien n\'est écrit.')
            return
        if args.dry_run:
            print('\n(--dry-run : calendar.json inchangé)')
            return
        out = {
            '_note': ("Réponses figées jour par jour. Les dates <= aujourd'hui ne sont JAMAIS "
                      "réécrites ; celles d'après sont régénérées par tools/gen_calendar.py."),
            'launch': LAUNCH.isoformat(),
            'uncertain': sorted(set(json.load(open(CAL, encoding='utf-8')).get('uncertain', [])
                                    if os.path.exists(CAL) else []) | set(incertains)),
            'days': dict(sorted(cal.items())),
        }
        json.dump(out, open(CAL, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
        print('\ncalendar.json : %d jours · %.1f Ko' % (len(cal), os.path.getsize(CAL) / 1024))
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

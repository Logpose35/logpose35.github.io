# -*- coding: utf-8 -*-
"""
gen_answers.py — Génère les pages d'archive des réponses, FR et EN.

    /reponses/index.html      (fr)
    /en/answers/index.html    (en)

Cible la requête « onepiecedle answer / réponse », mesurée en position 38-70 dans
Search Console alors que la demande est réelle (France, Espagne, Brésil).

Règles non négociables :

  1. AUCUNE date future n'est rendue. calendar.json contient ~90 jours d'avance ;
     tout ce qui dépasse la date de génération est ignoré.

  2. La journée EN COURS ne donne rien : ni réponse, ni indice. Décision du
     18/08/2026, après constat que les indices (arc, affiliation, prime, première
     lettre) résolvaient de fait les modes visuels — Silhouette, Émoji et Wanted
     ne montrent qu'une image, ces indices y valaient la réponse. La section du
     jour annonce le numéro de journée et renvoie vers les modes, rien de plus.

  3. Les journées passées sont repliées derrière un <details>, APRÈS le lien
     « Rejouer » : sans quoi la page tuerait la fonction qu'elle met en avant.

Le mode Fruit stocke le FRUIT dans le calendrier, mais la réponse attendue du
joueur est son DÉTENTEUR (cf. app.js, TARGET_FRU.holder). Ne pas confondre.

i18n : cette page n'passe PAS par gen_en.py, qui écrirait dans /en/reponses/ —
un mot français dans une URL anglaise, alors que tous les autres slugs sont
traduits. Elle applique elle-même le dictionnaire i18n/en.json, dont les clés
sont les chaînes FR (même convention que le reste du site). Toute chaîne FR
absente du dictionnaire est signalée en fin de génération.

Usage :  python tools/gen_answers.py
         python tools/gen_answers.py --check   (n'écrit rien, résume)
"""
import os
import re
import sys
import json
import html
import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import modes as MODES_MOD

# Ordre d'affichage = ordre canonique des modes, moins le mode Infini (pas quotidien).
DAILY = [m for m in MODES_MOD.MODES if m['id'] != 'inf']
SLUG = {'fr': {m['id']: m['fr_slug'] for m in MODES_MOD.MODES},
        'en': {m['id']: m['en_slug'] for m in MODES_MOD.MODES}}

# Libellés FR ; l'anglais sort du dictionnaire i18n (clé = chaîne FR).
LABEL_FR = {
    'classic': 'Classique', 'wanted': 'Wanted', 'silhouette': 'Silhouette',
    'fruit': 'Fruit du Démon', 'emoji': 'Émoji', 'audio': 'Opening', 'tome': 'Tome',
}

# Icône de sprite par mode — mêmes associations que la modale « À propos » du jeu.
# La classe de couleur est toujours « mi-<id> » et vit dans base.css (--mode-*).
ICON = {
    'classic': 'ic-compass', 'wanted': 'ic-wanted', 'silhouette': 'ic-silhouette',
    'fruit': 'ic-fruit', 'emoji': 'ic-rebus', 'audio': 'ic-note', 'tome': 'ic-tome',
}

MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
        'août', 'septembre', 'octobre', 'novembre', 'décembre']
MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
          'August', 'September', 'October', 'November', 'December']

# Où chaque langue est publiée, et son URL absolue (canonical / hreflang / og:url,
# qui EXIGENT l'absolu). Pour la navigation, on passe par PATH : un chemin
# racine-relatif marche en local comme en prod, une URL absolue non.
OUT = {'fr': ('reponses', 'https://onepiecedle.fr/reponses/'),
       'en': (os.path.join('en', 'answers'), 'https://onepiecedle.fr/en/answers/')}
PATH = {'fr': '/reponses/', 'en': '/en/answers/'}

DICT = json.load(open(os.path.join(ROOT, 'i18n', 'en.json'), encoding='utf-8'))
MISSING = set()


def T(s, lang):
    """Traduit une chaîne FR. Clé absente => on garde le FR et on le signale."""
    if lang == 'fr':
        return s
    if s in DICT:
        return DICT[s]
    MISSING.add(s)
    return s


def cache_version():
    """Lit la version de cache courante dans sw.js — évite de la coder en dur ici."""
    sw = open(os.path.join(ROOT, 'sw.js'), encoding='utf-8').read()
    m = re.search(r'logpose-v(\d+)', sw)
    return m.group(1) if m else '1'


def esc(s):
    return html.escape(str(s), quote=True)


def fmt_date(iso, lang):
    y, m, d = (int(x) for x in iso.split('-'))
    if lang == 'fr':
        return '%d %s %d' % (d, MOIS[m - 1], y)
    return '%s %d, %d' % (MONTHS[m - 1], d, y)


class Data(object):
    """Traduit une valeur du calendrier en la réponse que le joueur devait donner."""

    def __init__(self):
        d = json.load(open(os.path.join(ROOT, 'data.json'), encoding='utf-8'))
        self.fruits = {f['name']: f for f in d['FRUITS']}
        self.openings = {o['id']: o for o in d['OPENINGS']}

    def answer(self, mode, value, lang):
        if value is None:
            return None
        if mode in ('classic', 'wanted', 'silhouette', 'emoji'):
            return value                       # noms propres : identiques dans les 2 langues
        if mode == 'fruit':
            # Le calendrier stocke le fruit ; la réponse attendue est son détenteur.
            return (self.fruits.get(value) or {}).get('holder')
        if mode == 'audio':
            o = self.openings.get(value)
            return o['name'] if o else None
        if mode == 'tome':
            # Juste le numéro : la cellule porte déjà le libellé « Tome » / « Volume ».
            return str(int(value))
        return None


def build(lang):
    cal = json.load(open(os.path.join(ROOT, 'calendar.json'), encoding='utf-8'))
    days = cal.get('days', {})
    launch = cal.get('launch')
    uncertain = set(cal.get('uncertain') or [])
    data = Data()
    ver = cache_version()
    slug = SLUG[lang]

    today = datetime.date.today().isoformat()
    # Règle 1 : le futur n'existe pas sur cette page.
    keys = sorted([k for k in days if k <= today], reverse=True)
    if not keys:
        print('[!] aucune journée à publier — abandon')
        return None

    def day_no(iso):
        if not launch:
            return None
        a = datetime.date(*[int(x) for x in iso.split('-')])
        b = datetime.date(*[int(x) for x in launch.split('-')])
        return (a - b).days + 1

    def label(mid):
        return T(LABEL_FR[mid], lang)

    # ---------- Aujourd'hui : les modes jouables, rien d'autre ----------
    today_modes = ''.join(
        '<li><a class="ans-mode" data-mode="%s" href="/%s%s/">'
        '<svg class="ic mi-%s" aria-hidden="true"><use href="#%s"></use></svg>%s</a></li>'
        % (m['id'], 'en/' if lang == 'en' else '', esc(slug[m['id']]),
           m['id'], ICON[m['id']], esc(label(m['id'])))
        for m in DAILY if days.get(today, {}).get(m['id']) is not None)

    # ---------- Archive : journées passées, repliées sous le lien « Rejouer » ----------
    replay_txt = esc(T('Rejouer cette journée', lang))
    warn_txt = esc(T("Journée incertaine : le pool a changé en cours de journée, "
                     "c'est la version du matin qui est retenue.", lang))
    blocks = []
    for iso in keys:
        if iso == today:
            continue
        d = days[iso]
        items = []
        for m in DAILY:
            a = data.answer(m['id'], d.get(m['id']), lang)
            if not a:
                continue
            items.append('<div class="ans-cell"><span class="ans-k">%s</span>'
                         '<span class="ans-v">%s</span></div>'
                         % (esc(label(m['id'])), esc(a)))
        if not items:
            continue
        n = day_no(iso)
        first = next((m['id'] for m in DAILY if d.get(m['id']) is not None), 'classic')
        see = esc(T('Voir les %d réponses', lang) % len(items))
        blocks.append(
            '<article class="ans-day" data-jour="%s">' % esc(iso)
            + '<header class="ans-day__h">'
            '<h3>%s%s</h3>'
            '<a class="ans-replay" href="/%s%s/?jour=%s">%s</a>'
            '</header>'
            '<details class="ans-sol"><summary>%s</summary>'
            '<div class="ans-grid">%s</div></details>%s</article>'
            % (('<span class="ans-num">#%d</span> ' % n) if n else '',
               esc(fmt_date(iso, lang)), 'en/' if lang == 'en' else '', esc(slug[first]),
               esc(iso), replay_txt, see, ''.join(items),
               '<p class="ans-warn">%s</p>' % warn_txt if iso in uncertain else ''))

    n_today = day_no(today)
    pfx = 'en/' if lang == 'en' else ''

    # Config lue par js/answers.js pour rattraper l'ecart a l'affichage.
    # holders/openings sont embarques (~4 Ko) plutot que de faire charger
    # data.json (103 Ko) a une page qui n'en a besoin que pour 1 a 3 journees.
    cfg = {
        'lang': lang,
        'launch': launch,
        'generated': today,
        'prefix': pfx,
        'months': MOIS if lang == 'fr' else MONTHS,
        'dayWord': T('Journée', lang),
        'replay': T('Rejouer cette journée', lang),
        'seeTpl': T('Voir les %d réponses', lang),
        'countTpl': T('%d journées', lang),
        'uncertain': T("Journée incertaine : le pool a changé en cours de journée, "
                       "c'est la version du matin qui est retenue.", lang),
        'modes': [{'id': m['id'], 'label': label(m['id'])} for m in DAILY],
        'slugs': {m['id']: slug[m['id']] for m in DAILY},
        'holders': {k: v['holder'] for k, v in data.fruits.items() if v.get('holder')},
        'openings': {str(k): v['name'] for k, v in data.openings.items()},
    }
    # '<' echappe : le JSON vit dans un <script>, un '</script>' dans une donnee
    # fermerait la balise. Aucun nom ne contient '<' aujourd'hui, mais c'est gratuit.
    cfg_json = json.dumps(cfg, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')

    doc = TEMPLATE % {
        'cfg': cfg_json,
        'v': ver,
        'lang': lang,
        'locale': 'fr_FR' if lang == 'fr' else 'en_US',
        'self': OUT[lang][1],
        'fr_url': OUT['fr'][1],
        'en_url': OUT['en'][1],
        'other_url': PATH['en' if lang == 'fr' else 'fr'],   # relatif : testable en local
        'other_lbl': 'EN' if lang == 'fr' else 'FR',
        'other_aria': esc('Switch to English' if lang == 'fr' else 'Passer en français'),
        'title': esc(T('OnePiecedle — réponses des journées passées et archive · LogPose', lang)),
        'desc': esc(T("L'archive complète des réponses OnePiecedle, jour par jour et rejouable. "
                      "Les réponses d'une journée sont publiées le lendemain.", lang)),
        'h1': esc(T('OnePiecedle : les réponses des journées passées', lang)),
        'intro': esc(T("Les réponses d'une journée sont publiées le lendemain. Celles de la "
                       "journée en cours ne figurent nulle part sur cette page, et aucun indice "
                       "n'est donné. Chaque journée archivée reste entièrement rejouable, ce que "
                       "ne permet aucun autre site.", lang)),
        'day_word': esc(T('Journée', lang)),
        'today_n': ('#%d — ' % n_today) if n_today else '',
        'today_h': esc(fmt_date(today, lang)),
        'note': esc(T('Les réponses du jour paraîtront demain. En attendant, les sept modes '
                      'se jouent ici :', lang)),
        'archive_h': esc(T('Archive des réponses', lang)),
        'count': esc(T('%d journées', lang) % len(blocks)),
        'play': esc(T('Jouer', lang)),
        'play_today': esc(T('Jouer la journée du jour', lang)),
        'theme_aria': esc(T('Changer de thème', lang)),
        'legal': esc(T('One Piece © Eiichiro Oda · Shueisha · Toei Animation · projet fan '
                       'non officiel, sans affiliation.', lang)),
        'nav_aria': esc(T('Navigation principale', lang)),
        'lang_home': pfx,
        'classic_slug': esc(pfx + slug['classic']),
        'modes': today_modes,
        'days': ''.join(blocks),
    }
    return doc, today_modes.count('<li>'), len(blocks)


TEMPLATE = """<!DOCTYPE html>
<html lang="%(lang)s" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>%(title)s</title>

  <!-- SEO -->
  <meta name="description" content="%(desc)s">
  <meta name="robots" content="index, follow">
  <meta name="theme-color" content="#c89408">
  <link rel="canonical" href="%(self)s">
  <!-- Bloc hreflang identique des deux cotes (cluster reciproque). -->
  <link rel="alternate" hreflang="fr" href="%(fr_url)s">
  <link rel="alternate" hreflang="en" href="%(en_url)s">
  <link rel="alternate" hreflang="x-default" href="%(en_url)s">

  <meta property="og:title" content="%(title)s">
  <meta property="og:description" content="%(desc)s">
  <meta property="og:type" content="website">
  <meta property="og:url" content="%(self)s">
  <meta property="og:locale" content="%(locale)s">
  <meta property="og:image" content="https://onepiecedle.fr/images/og_preview.jpg">
  <meta property="og:site_name" content="OnePiecedle">

  <link rel="icon" type="image/png" href="/images/favicon.png">

  <!-- Theme partage avec le reste du site (cle 'op-theme'), applique avant le rendu. -->
  <script>
    (function () {
      function applyTheme(t) { document.documentElement.setAttribute('data-theme', t); }
      window.toggleTheme = function () {
        var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        try { localStorage.setItem('op-theme', next); } catch (e) {}
      };
      function readAndApply() {
        var saved;
        try { saved = localStorage.getItem('op-theme'); } catch (e) {}
        if (saved) applyTheme(saved);
        else applyTheme(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      }
      readAndApply();
      window.addEventListener('pageshow', function (e) { if (e.persisted) readAndApply(); });
    })();
  </script>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700;900&family=Barlow+Condensed:wght@300;400;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/base.css?v=%(v)s">
  <link rel="stylesheet" href="/css/landing.css?v=%(v)s">
  <link rel="stylesheet" href="/css/answers.css?v=%(v)s">
  <link rel="stylesheet" href="/css/mobile.css?v=%(v)s">
</head>
<!-- nav-condensed : sur la landing, js/landing.js pose cette classe au scroll pour
     deplier la nav (logo + « Jouer »). Cette page n'a pas de heros et ne charge pas
     ce script : l'etat deplie est le bon d'emblee, sinon la barre reste amputee. -->
<body class="landing-body ans-body nav-condensed">

<!-- Sprite d'icones : page autonome, elle n'herite pas de celui du jeu.
     Ces 7 symboles sont copies a l'identique de tools/game.master.html. -->
<svg width="0" height="0" aria-hidden="true" focusable="false" style="position:absolute">
  <symbol id="ic-compass" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="9"/>
    <path d="M12 5l1.7 5.3 5.3 1.7-5.3 1.7L12 19l-1.7-5.3L5 12l5.3-1.7z" fill="currentColor" stroke="none"/>
  </symbol>
  <symbol id="ic-wanted" viewBox="0 0 24 24">
    <rect x="5" y="3" width="14" height="18" rx="1"/>
    <path d="M5 6h14M5 18h14"/>
    <circle cx="12" cy="11" r="2.6"/>
    <path d="M8.5 15.5c.8-1.6 6.2-1.6 7 0"/>
  </symbol>
  <symbol id="ic-silhouette" viewBox="0 0 24 24">
    <circle cx="12" cy="7.5" r="4" fill="currentColor" stroke="none"/>
    <path d="M4.5 21c0-4.7 3.4-7.5 7.5-7.5s7.5 2.8 7.5 7.5z" fill="currentColor" stroke="none"/>
  </symbol>
  <symbol id="ic-fruit" viewBox="0 0 24 24">
    <path d="M12 8.2C12 5.5 13.2 4.2 15.3 3.6"/>
    <circle cx="12" cy="14.3" r="6.3"/>
    <path d="M9.4 14.8c1-1.7 3.8-1.7 4.8 0s-1.1 3.1-2.6 2.1"/>
  </symbol>
  <symbol id="ic-rebus" viewBox="0 0 24 24">
    <path d="M4 5h16v11H9l-4 4v-4H4z"/>
    <circle cx="9" cy="10.5" r="0.7" fill="currentColor" stroke="none"/>
    <circle cx="12" cy="10.5" r="0.7" fill="currentColor" stroke="none"/>
    <circle cx="15" cy="10.5" r="0.7" fill="currentColor" stroke="none"/>
  </symbol>
  <symbol id="ic-note" viewBox="0 0 24 24">
    <path d="M9 17V6l10-2.2V15"/>
    <ellipse cx="6.5" cy="17" rx="2.5" ry="2"/>
    <ellipse cx="16.5" cy="15" rx="2.5" ry="2"/>
  </symbol>
  <symbol id="ic-tome" viewBox="0 0 24 24">
    <rect x="6" y="3" width="12" height="18" rx="1"/>
    <path d="M9 3v18"/>
    <path d="M11.5 7.5h4M11.5 10.5h4"/>
  </symbol>
  <symbol id="ic-anchor" viewBox="0 0 24 24">
    <circle cx="12" cy="5" r="2"/>
    <path d="M12 7v13"/>
    <path d="M7.5 11h9"/>
    <path d="M5 13.5a7 7 0 0 0 14 0"/>
    <path d="M5 13.5l-1.8.4M5 13.5l1.4 1.4M19 13.5l1.8.4M19 13.5l-1.4 1.4"/>
  </symbol>
  <symbol id="ic-sun" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="4"/>
    <path d="M12 2v2.2M12 19.8V22M2 12h2.2M19.8 12H22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M19.1 4.9l-1.6 1.6M6.5 17.5l-1.6 1.6"/>
  </symbol>
  <symbol id="ic-moon" viewBox="0 0 24 24">
    <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" fill="currentColor" stroke="none"/>
  </symbol>
</svg>

<!-- Barre reprise a l'identique de la landing : memes classes, memes icones.
     .lp-nav__brand et .lp-play sont masques sous 760px par landing.css. -->
<nav class="lp-nav" aria-label="%(nav_aria)s">
  <a class="lp-nav__brand" href="/%(lang_home)s">
    <svg class="ic" aria-hidden="true"><use href="#ic-compass"></use></svg>
    LogPose
  </a>
  <div class="lp-nav__actions">
    <a class="lp-play" href="/%(classic_slug)s/">
      <svg class="ic" aria-hidden="true"><use href="#ic-anchor"></use></svg>
      %(play)s
    </a>
    <a class="lp-lang" href="%(other_url)s" aria-label="%(other_aria)s">%(other_lbl)s</a>
    <button class="lp-theme" onclick="toggleTheme()" aria-label="%(theme_aria)s">
      <svg class="ic ic-moon" aria-hidden="true"><use href="#ic-moon"></use></svg>
      <svg class="ic ic-sun" aria-hidden="true"><use href="#ic-sun"></use></svg>
    </button>
  </div>
</nav>

<main class="ans">
  <h1 class="ans-title">%(h1)s</h1>
  <p class="ans-intro">%(intro)s</p>

  <section class="ans-today" id="aujourdhui">
    <h2 id="ans-today-h">%(day_word)s %(today_n)s%(today_h)s</h2>
    <p class="ans-today__note">%(note)s</p>
    <ul class="ans-modes">%(modes)s</ul>
  </section>

  <section class="ans-archive" id="archive">
    <h2>%(archive_h)s <span class="ans-count" id="ans-count">%(count)s</span></h2>
    %(days)s
  </section>
</main>

<footer class="lp-foot">
  <a class="lp-cta" href="/%(classic_slug)s/">%(play_today)s</a>
  <div class="lp-foot__meta"><span class="lp-foot__brand">LogPose</span></div>
  <p class="lp-foot__legal">%(legal)s</p>
</footer>

<!-- Rattrapage a l'affichage : le HTML fige la date de generation, js/answers.js
     recalcule l'en-tete du jour et ajoute les journees ecoulees depuis. Sans lui,
     la page mentirait sur la date des le lendemain d'un deploiement. -->
<script type="application/json" id="ans-data">%(cfg)s</script>
<script src="/js/answers.js?v=%(v)s" defer></script>

<script src="/js/version.js?v=%(v)s"></script>
</body>
</html>
"""


if __name__ == '__main__':
    check = '--check' in sys.argv[1:]
    for lang in ('fr', 'en'):
        res = build(lang)
        if not res:
            sys.exit(1)
        doc, nmodes, ndays = res
        sub, url = OUT[lang]
        rel = os.path.join(sub, 'index.html')
        if check:
            print('[check] %s : %d modes, %d journées — rien écrit' % (lang, nmodes, ndays))
            continue
        os.makedirs(os.path.join(ROOT, sub), exist_ok=True)
        open(os.path.join(ROOT, rel), 'w', encoding='utf-8', newline='').write(doc)
        print('=> ecrit %s  (%.1f Ko)  %d modes, %d journées'
              % (rel.replace(os.sep, '/'), len(doc) / 1024.0, nmodes, ndays))
    if MISSING:
        print('\n[!] %d chaîne(s) FR absente(s) de i18n/en.json — la page EN les garde en français :'
              % len(MISSING))
        for s in sorted(MISSING):
            print('    %s' % json.dumps(s, ensure_ascii=False))
    else:
        print('[ok] toutes les chaînes sont traduites')

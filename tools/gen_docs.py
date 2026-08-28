# -*- coding: utf-8 -*-
"""
gen_docs.py — Génère les pages de contenu hors jeu, en FR et en EN :

    /a-propos/          /en/about/
    /mentions-legales/  /en/legal-notice/
    /confidentialite/   /en/privacy/

Contenu et slugs : tools/pages.py (source unique).

Ces pages ne chargent PAS le moteur de jeu (ni data.json, ni app.js, ni le
dictionnaire i18n) : le texte anglais est écrit en dur dans pages.py. Elles
n'embarquent que la barre de navigation, le thème et le pied de page.

La version de cache (?v=NNN) est LUE dans sw.js : le sed de cache-busting
bumpe sw.js, ces pages suivent automatiquement à la régénération suivante.
gen_modes.py appelle ce script en fin de passe complète, si bien que le
rituel habituel (sed puis `python tools/gen_modes.py`) les couvre déjà.

Outil de dev local, comme gen_modes.py / gen_en.py — PAS un build de site.
"""
import io, os, re, sys

if not isinstance(sys.stdout, io.TextIOWrapper) or sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

from pages import DOCS, CONTENT, CONTACT, EDITEUR_PRO, IDENTITE, foot_html  # noqa: E402

SITE = 'https://onepiecedle.fr'
MASTER = os.path.join(ROOT, 'tools', 'game.master.html')

# Icônes reprises du sprite du jeu. Extraites à la génération plutôt que
# recopiées : une retouche du sprite se propage ici sans intervention.
SYMBOLES = ['ic-compass', 'ic-anchor', 'ic-moon', 'ic-sun']


def version_cache():
    """Numéro ?v= courant, lu dans sw.js (source unique du cache-busting)."""
    sw = open(os.path.join(ROOT, 'sw.js'), encoding='utf-8').read()
    m = re.search(r"logpose-v(\d+)", sw)
    if not m:
        raise SystemExit('gen_docs: version de cache introuvable dans sw.js')
    return m.group(1)


def sprite():
    """Les 4 <symbol> nécessaires, prélevés dans le sprite de game.master.html."""
    src = open(MASTER, encoding='utf-8').read()
    out = []
    for sid in SYMBOLES:
        m = re.search(r'<symbol id="%s".*?</symbol>' % re.escape(sid), src, re.S)
        if not m:
            raise SystemExit('gen_docs: symbole %s introuvable dans le gabarit' % sid)
        out.append('  ' + m.group(0).strip())
    return ('<svg width="0" height="0" aria-hidden="true" focusable="false" '
            'style="position:absolute">\n%s\n</svg>' % '\n'.join(out))


def esc(s):
    """Échappe pour un attribut HTML entre guillemets doubles."""
    return (s.replace('&', '&amp;').replace('<', '&lt;')
             .replace('>', '&gt;').replace('"', '&#x22;').replace("'", '&#x27;'))


THEME_BOOT = '''  <!-- Thème partagé avec le reste du site (clé op-theme), appliqué avant le rendu. -->
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
  </script>'''


def editeur_note(lang):
    """Bloc identité, affiché seulement si le site passe en édition professionnelle."""
    if not (EDITEUR_PRO and IDENTITE):
        return ''
    label = 'Éditeur :' if lang == 'fr' else 'Publisher:'
    return '\n<p><strong>%s</strong> %s</p>' % (label, IDENTITE)


def build(doc, lang):
    v = version_cache()
    c = CONTENT[doc['id']][lang]
    fr_url = '%s/%s/' % (SITE, doc['fr_slug'])
    en_url = '%s/en/%s/' % (SITE, doc['en_slug'])
    url = fr_url if lang == 'fr' else en_url

    # Le corps porte {CONTACT} en gabarit : une seule adresse à changer.
    body = c['body'].replace('{CONTACT}', CONTACT)
    if doc['id'] == 'legal':
        body = body.replace('<h2>Hébergement</h2>', editeur_note('fr') + '\n<h2>Hébergement</h2>')
        body = body.replace('<h2>Hosting</h2>', editeur_note('en') + '\n<h2>Hosting</h2>')

    if lang == 'fr':
        lang_href, lang_label, lang_aria = '/en/%s/' % doc['en_slug'], 'EN', 'Switch to English'
        play_href, play_label = '/classique/', 'Jouer'
        home = '/'
        nav_aria, theme_aria = 'Navigation principale', 'Changer de thème'
    else:
        lang_href, lang_label, lang_aria = '/%s/' % doc['fr_slug'], 'FR', 'Passer en français'
        play_href, play_label = '/en/classic/', 'Play'
        home = '/en/'
        nav_aria, theme_aria = 'Main navigation', 'Toggle theme'

    return '''<!DOCTYPE html>
<html lang="{lang}" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>

  <!-- SEO -->
  <meta name="description" content="{desc}">
  <meta name="robots" content="index, follow">
  <meta name="theme-color" content="#c89408">
  <link rel="canonical" href="{url}">
  <!-- Bloc hreflang identique des deux côtés (cluster réciproque). -->
  <link rel="alternate" hreflang="fr" href="{fr_url}">
  <link rel="alternate" hreflang="en" href="{en_url}">
  <link rel="alternate" hreflang="x-default" href="{en_url}">

  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{desc}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="{url}">
  <meta property="og:locale" content="{locale}">
  <meta property="og:image" content="{site}/images/og_preview.jpg">
  <meta property="og:site_name" content="OnePiecedle">

  <link rel="icon" type="image/png" href="/images/favicon.png">

{theme_boot}

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700;900&family=Barlow+Condensed:wght@300;400;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/base.css?v={v}">
  <link rel="stylesheet" href="/css/landing.css?v={v}">
  <link rel="stylesheet" href="/css/doc.css?v={v}">
  <link rel="stylesheet" href="/css/mobile.css?v={v}">
</head>
<!-- nav-condensed : ces pages n'ont pas de héros et ne chargent pas js/landing.js,
     l'état déplié de la barre est donc le bon d'emblée. -->
<body class="landing-body doc-body nav-condensed">

{sprite}

<nav class="lp-nav" aria-label="{nav_aria}">
  <a class="lp-nav__brand" href="{home}">
    <svg class="ic" aria-hidden="true"><use href="#ic-compass"></use></svg>
    LogPose
  </a>
  <div class="lp-nav__actions">
    <a class="lp-play" href="{play_href}">
      <svg class="ic" aria-hidden="true"><use href="#ic-anchor"></use></svg>
      {play_label}
    </a>
    <a class="lp-lang" href="{lang_href}" aria-label="{lang_aria}">{lang_label}</a>
    <button class="lp-theme" onclick="toggleTheme()" aria-label="{theme_aria}">
      <svg class="ic ic-moon" aria-hidden="true"><use href="#ic-moon"></use></svg>
      <svg class="ic ic-sun" aria-hidden="true"><use href="#ic-sun"></use></svg>
    </button>
  </div>
</nav>

<main class="doc">
  <h1 class="doc-title">{h1}</h1>
{body}
</main>

<footer class="lp-foot">
  <a class="lp-cta" href="{play_href}">{play_label}</a>
  <div class="lp-foot__meta">
    <span class="lp-foot__brand">LogPose</span>
    <span class="lp-foot__ver js-version"></span>
  </div>
  {foot}
  <p class="lp-foot__legal">{legal}</p>
</footer>

<script src="/js/version.js?v={v}"></script>
</body>
</html>
'''.format(
        lang=lang, v=v, site=SITE, url=url, fr_url=fr_url, en_url=en_url,
        locale='fr_FR' if lang == 'fr' else 'en_US',
        title=esc(c['title']), desc=esc(c['desc']), h1=esc(c['h1']),
        body=body.strip(), theme_boot=THEME_BOOT, sprite=sprite(),
        home=home, play_href=play_href, play_label=play_label,
        lang_href=lang_href, lang_label=lang_label, lang_aria=lang_aria,
        nav_aria=nav_aria, theme_aria=theme_aria,
        foot=foot_html(lang),
        legal=('One Piece © Eiichiro Oda · Shueisha · Toei Animation · projet fan non officiel, '
               'sans affiliation.') if lang == 'fr' else
              ('One Piece © Eiichiro Oda · Shueisha · Toei Animation · unofficial fan project, '
               'not affiliated.'))


def ecrire(doc, lang):
    rel = ('%s/index.html' % doc['fr_slug']) if lang == 'fr' else \
          ('en/%s/index.html' % doc['en_slug'])
    out = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, 'w', encoding='utf-8', newline='').write(build(doc, lang))
    print('=> écrit', rel)


def main(argv):
    ids = [a for a in argv if not a.startswith('-')] or [d['id'] for d in DOCS]
    connus = {d['id']: d for d in DOCS}
    for i in ids:
        if i not in connus:
            print('page inconnue:', i, '— dispo:', ', '.join(connus)); continue
        ecrire(connus[i], 'fr')
        ecrire(connus[i], 'en')


if __name__ == '__main__':
    main(sys.argv[1:])

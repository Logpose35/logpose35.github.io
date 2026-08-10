# -*- coding: utf-8 -*-
"""
gen_modes.py — Génère UNE page FR par mode de jeu à partir de game.html.

Pourquoi : les 8 modes vivaient tous sur /game.html derrière des onglets JS.
Une seule URL => aucun sitelink possible dans Google, aucune présence sur
« onepiecedle wanted », « onepiecedle silhouette », etc. Chaque mode reçoit
donc sa propre URL indexable :  /<fr_slug>/  (dossier + index.html, car
GitHub Pages ne réécrit pas les URL : /wanted.html n'aurait pas de repli
extensionless, alors que /wanted est redirigé en 301 vers /wanted/).

Source unique = game.html (structure/markup, édité à la main) + tools/modes.py
(table des modes + contenu éditorial). Le script ne duplique aucune logique :
il transforme mécaniquement le HTML.

Transformations :
  1. Chemins relatifs -> absolus racine (la page vit dans un sous-dossier)
  2. Navigation interne -> URL absolues
  3. Onglets : <button onclick="switchMode()"> -> <a href="/<slug>/"> (vraie nav)
  4. Sections : on ne garde QUE celle du mode (sinon les 8 pages sont des doublons)
  5. window.LP_MODE = '<id>' : le mode forcé à l'arrivée (js/app.js le lit à l'init)
  6. SEO : title, description, canonical auto-référent, hreflang réciproque, og/twitter, JSON-LD
  7. Bloc éditorial propre au mode (h1 + 100-150 mots + FAQ) + balisage FAQPage

Usage :  python tools/gen_modes.py            (les 8 modes, puis les pages EN)
         python tools/gen_modes.py wanted     (un seul mode)
         python tools/gen_modes.py --no-en    (sans les pages EN)

Outil de dev local, comme gen_en.py / blacken.py — PAS un build de site.
"""
import io, os, re, sys

if (getattr(sys.stdout, 'encoding', '') or '').lower().replace('-', '') != 'utf8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

from modes import MODES, BY_ID, SEO   # noqa: E402

SITE   = 'https://onepiecedle.fr'
# Gabarit des 8 sections : il n'est plus servi (une page de mode ne contient que
# SA section). C'est ce fichier qu'on édite à la main ; /game.html à la racine
# est devenu une redirection générée (build_redirects).
MASTER = os.path.join('tools', 'game.master.html')


# ---------------------------------------------------------------- utilitaires

def sub1(html, pattern, repl, what, flags=0):
    """re.sub avec garde-fou : le motif DOIT être trouvé exactement une fois.
    Si game.html change de forme, on veut un échec bruyant, pas une page muette."""
    new, n = re.subn(pattern, lambda m: repl, html, count=1, flags=flags)
    if n != 1:
        raise SystemExit('gen_modes: motif introuvable dans %s -> %s' % (MASTER, what))
    return new


def check_attr_safe(mode_id, **strings):
    """Les chaînes SEO finissent dans des attributs HTML et dans du JSON-LD :
    un guillemet double ou un antislash y casserait le document."""
    for name, s in strings.items():
        if '"' in s or '\\' in s:
            raise SystemExit('gen_modes: %s/%s contient un " ou un \\ — interdit' % (mode_id, name))


def dedent_html(block):
    """Normalise l'indentation d'un bloc HTML écrit dans une chaîne Python."""
    lines = [l.strip() for l in block.strip().splitlines()]
    return '\n'.join('      ' + l for l in lines if l)


def find_block(html, open_re, what):
    """Bornes (début, fin) d'un <div> équilibré dont la balise ouvrante matche open_re."""
    m = re.search(open_re, html)
    if not m:
        raise SystemExit('gen_modes: bloc introuvable -> %s' % what)
    i, depth = m.end(), 1
    tag = re.compile(r'<(/?)div\b', re.I)
    while depth:
        t = tag.search(html, i)
        if not t:
            raise SystemExit('gen_modes: <div> non fermé -> %s' % what)
        depth += -1 if t.group(1) else 1
        i = t.end()
    return m.start(), html.index('>', i) + 1


def extend_back(html, start):
    """Remonte sur les blancs et sur un éventuel commentaire d'en-tête, pour ne
    pas laisser « <!-- MODE WANTED --> » orphelin après suppression du bloc."""
    j = start
    while j > 0 and html[j - 1] in ' \t':
        j -= 1
    k = html.rfind('-->', 0, j)
    if k != -1 and html[k + 3:j].strip() == '':
        c = html.rfind('<!--', 0, k)
        if c != -1:
            j = c
            while j > 0 and html[j - 1] in ' \t':
                j -= 1
    return j


# ------------------------------------------------------------- transformations

def absolute_paths(html):
    """La page vit dans /<slug>/ : tout chemin relatif y pointerait vers /<slug>/css/…"""
    html = re.sub(r'(src|href)="(css/|js/|images/|silhouettes/|audio/|i18n/)', r'\1="/\2', html)
    html = html.replace('href="manifest.json"', 'href="/manifest.json"')
    return html


def nav_links(html):
    html = html.replace('href="index.html"', 'href="/"')
    html = html.replace('href="versus.html"', 'href="/versus.html"')
    html = html.replace('href="game.html"',   'href="/classique/"')
    return html


def tabs_markup(mode):
    """Onglets = vrais liens. On perd la bascule instantanée (et l'animation FLIP),
    on gagne 8 URL réellement distinctes — c'est tout l'objet du chantier."""
    out = ['<nav class="mode-tabs" aria-label="Modes de jeu quotidiens">']
    for m in MODES:
        if m['id'] == 'inf':
            continue
        cur = (m['id'] == mode['id'])
        out.append(
            '  <a class="mode-tab%s" id="%s" href="/%s/"%s>'
            '<svg class="ic tab-ic" aria-hidden="true"><use href="#%s"></use></svg>%s</a>'
            % (' active' if cur else '', m['tab'], m['fr_slug'],
               ' aria-current="page"' if cur else '', m['icon'], m['fr_label']))
    out.append('</nav>')
    inf = BY_ID['inf']
    cur = (mode['id'] == 'inf')
    out.append('<div class="mode-tabs-inf">')
    out.append('  <a class="mode-tab mode-tab-inf%s" id="tab-inf" href="/%s/"%s>'
               '<svg class="ic tab-ic" aria-hidden="true"><use href="#%s"></use></svg>%s</a>'
               % (' active' if cur else '', inf['fr_slug'],
                  ' aria-current="page"' if cur else '', inf['icon'], inf['fr_label']))
    out.append('  <a class="mode-tab mode-tab-inf mode-tab-versus" id="tab-versus" href="/versus.html">'
               '<svg class="ic tab-ic" aria-hidden="true"><use href="#ic-versus"></use></svg>Versus 1v1</a>')
    out.append('</div>')
    return '\n'.join(out)


def rebuild_tabs(html, mode):
    a, b = find_block(html, r'<div class="mode-tabs" role="tablist"[^>]*>', 'barre d\'onglets')
    c, d = find_block(html, r'<div class="mode-tabs-inf">', 'ligne Infini/Versus')
    if not a < b <= c < d:
        raise SystemExit('gen_modes: les deux barres d\'onglets ne se suivent plus')
    return html[:a] + tabs_markup(mode) + html[d:]


def keep_only_section(html, mode):
    """Le point critique : si les 8 pages partagent 95 % de leur HTML, Google les
    traite comme des doublons et n'en garde qu'une. Chaque page ne contient donc
    QUE sa propre section de mode."""
    for m in MODES:
        if m['id'] == mode['id']:
            continue
        a, b = find_block(html, r'<div id="%s"[^>]*>' % re.escape(m['section']), m['section'])
        html = html[:extend_back(html, a)] + html[b:]
    if ('id="%s"' % mode['section']) not in html:
        raise SystemExit('gen_modes: la section du mode %s a disparu' % mode['id'])
    return re.sub(r'\n{3,}', '\n\n', html)


def inject_lp_mode(html, mode):
    anchor = "<script>window.ASSET_BASE = 'https://assets.onepiecedle.fr/';</script>"
    if anchor not in html:
        raise SystemExit('gen_modes: ancre ASSET_BASE introuvable')
    return html.replace(
        anchor,
        anchor + "\n  <!-- Mode de cette page (une URL par mode) : js/app.js l'active à l'init. -->"
                 "\n  <script>window.LP_MODE = '%s';</script>" % mode['id'], 1)


def head_seo(html, mode, seo):
    url = '%s/%s/' % (SITE, mode['fr_slug'])
    en  = '%s/en/%s/' % (SITE, mode['en_slug'])
    html = sub1(html, r'<title>.*?</title>', '<title>%s</title>' % seo['title'], 'title', re.S)
    html = sub1(html, r'<meta name="description" content="[^"]*">',
                '<meta name="description" content="%s">' % seo['desc'], 'meta description')
    html = sub1(html, r'<link rel="canonical" href="[^"]*">',
                '<link rel="canonical" href="%s">' % url, 'canonical')
    html = sub1(html, r'<!-- Alternatives de langue \(i18n\) — bloc identique sur [^>]*-->',
                '<!-- Alternatives de langue (i18n) — bloc identique sur /%s/ et /en/%s/ -->'
                % (mode['fr_slug'], mode['en_slug']), 'commentaire hreflang')
    html = sub1(html,
                r'<link rel="alternate" hreflang="fr" href="[^"]*">\s*\n\s*'
                r'<link rel="alternate" hreflang="en" href="[^"]*">\s*\n\s*'
                r'<link rel="alternate" hreflang="x-default" href="[^"]*">',
                # x-default = ANGLAIS (décision du 10/08/2026) : il ne sert qu'aux
                # visiteurs dont Google ne reconnaît ni le français ni l'anglais.
                # Les francophones déclenchent hreflang="fr", explicite, et ne sont
                # donc jamais concernés. Viser l'anglais élargit la prise
                # internationale, le marché des jeux -dle étant anglophone.
                '<link rel="alternate" hreflang="fr" href="%s">\n'
                '  <link rel="alternate" hreflang="en" href="%s">\n'
                '  <link rel="alternate" hreflang="x-default" href="%s">' % (url, en, en),
                'bloc hreflang')
    html = sub1(html, r'<meta property="og:title" content="[^"]*">',
                '<meta property="og:title" content="%s">' % seo['og_title'], 'og:title')
    html = sub1(html, r'<meta property="og:description" content="[^"]*">',
                '<meta property="og:description" content="%s">' % seo['og_desc'], 'og:description')
    html = sub1(html, r'<meta property="og:url" content="[^"]*">',
                '<meta property="og:url" content="%s">' % url, 'og:url')
    html = sub1(html, r'<meta name="twitter:title" content="[^"]*">',
                '<meta name="twitter:title" content="%s">' % seo['og_title'], 'twitter:title')
    html = sub1(html, r'<meta name="twitter:description" content="[^"]*">',
                '<meta name="twitter:description" content="%s">' % seo['og_desc'], 'twitter:description')
    # JSON-LD WebApplication : nom/URL/description de CETTE page
    html = sub1(html, r'"name": "LogPose"', '"name": "%s"' % seo['ld_name'], 'JSON-LD name')
    html = sub1(html, r'"url": "https://onepiecedle\.fr/game\.html"',
                '"url": "%s"' % url, 'JSON-LD url')
    html = sub1(html, r'"description": "[^"]*"',
                '"description": "%s"' % seo['ld_desc'], 'JSON-LD description')
    # Sélecteur de langue : la page miroir n'est plus déductible du chemin
    # (slugs traduits) -> on l'écrit en dur, js/i18n.js lit data-mirror.
    html = sub1(html, r'<a id="lang-toggle" class="lang-toggle" href="[^"]*"',
                '<a id="lang-toggle" class="lang-toggle" href="/en/%s/" data-mirror="/en/%s/"'
                % (mode['en_slug'], mode['en_slug']), 'sélecteur de langue')
    return html


def seo_block(mode, seo):
    """FAQ facultative : un mode sans clé 'faq' produit un bloc réduit (h1 +
    introduction), sans accordéon ni balisage FAQPage."""
    block = (
        '<!-- ===== BLOC ÉDITORIAL (SEO) — propre à ce mode, généré par tools/gen_modes.py ===== -->\n'
        '<section class="mode-seo">\n'
        '  <h1 class="mode-seo__h1">%s</h1>\n'
        '  <div class="mode-seo__body" data-i18n-html="%s">\n%s\n  </div>\n'
        % (seo['h1'], seo['body_key'], dedent_html(seo['body'])))
    if not seo.get('faq'):
        return block + '</section>\n\n'

    faq_html = '\n'.join(
        '      <details class="mode-seo__q"><summary>%s</summary><p>%s</p></details>' % (q, a)
        for q, a in seo['faq'])
    faq_ld = ',\n'.join(
        '      { "@type": "Question", "name": "%s",\n'
        '        "acceptedAnswer": { "@type": "Answer", "text": "%s" } }' % (q, a)
        for q, a in seo['faq'])
    return (
        block +
        '  <h2 class="mode-seo__h2">Questions fréquentes</h2>\n'
        '  <div class="mode-seo__faq">\n%s\n  </div>\n'
        '</section>\n\n'
        '<!-- Balisage FAQPage (Schema.org) : miroir exact de la FAQ ci-dessus -->\n'
        '<script type="application/ld+json">\n'
        '{\n  "@context": "https://schema.org",\n  "@type": "FAQPage",\n  "mainEntity": [\n%s\n  ]\n}\n'
        '</script>\n\n'
        % (faq_html, faq_ld))


def inject_seo_block(html, mode, seo):
    # Le <h1> de la page = le titre du mode. Le « LogPose » de l'en-tête devient
    # un simple libellé de marque (même rendu, cf. .brand-name dans base.css).
    html = sub1(html, r'<h1>LogPose</h1>',
                '<span class="brand-name">LogPose</span>', 'marque de l\'en-tête')
    if '<footer>' not in html:
        raise SystemExit('gen_modes: <footer> introuvable')
    return html.replace('<footer>', seo_block(mode, seo) + '<footer>', 1)


# --------------------------------------------------------------------- build

def build(mode_id):
    mode = BY_ID[mode_id]
    seo  = SEO.get(mode_id)
    html = open(os.path.join(ROOT, MASTER), encoding='utf-8').read()

    html = absolute_paths(html)
    html = nav_links(html)
    html = rebuild_tabs(html, mode)
    html = keep_only_section(html, mode)
    html = inject_lp_mode(html, mode)

    if seo:
        check_attr_safe(mode_id, title=seo['title'], desc=seo['desc'], og_title=seo['og_title'],
                        og_desc=seo['og_desc'], ld_name=seo['ld_name'], ld_desc=seo['ld_desc'],
                        h1=seo['h1'])
        for q, a in (seo.get('faq') or []):
            check_attr_safe(mode_id, faq_q=q, faq_a=a)
        html = head_seo(html, mode, seo)
        html = inject_seo_block(html, mode, seo)
    else:
        print('  [!] %s : aucun contenu éditorial dans tools/modes.py '
              '-> page générée SANS bloc SEO (non publiable en l\'état)' % mode_id)

    outdir = os.path.join(ROOT, mode['fr_slug'])
    os.makedirs(outdir, exist_ok=True)
    out = os.path.join(outdir, 'index.html')
    open(out, 'w', encoding='utf-8', newline='').write(html)
    print('=> écrit %s/index.html  (%d Ko)' % (mode['fr_slug'], len(html.encode('utf-8')) // 1024))
    return out


# ---------------------------------------------------------- anciennes URL

# GitHub Pages ne sait pas faire de 301 : le seul signal de redirection
# permanente qu'il reste est le meta-refresh à 0 seconde, que Google traite
# comme tel. Sans lui, /game.html (indexée, en favori, ex-start_url de la PWA)
# resterait un quasi-doublon de /classique/ et se disputerait son classement.
REDIRECTS = [
    ('game.html',    '/classique/',   'fr',
     'Redirection · OnePiecedle', 'Cette page a déménagé vers'),
    ('en/game.html', '/en/classic/',  'en',
     'Redirect · OnePiecedle',    'This page has moved to'),
]

REDIRECT_TPL = '''<!DOCTYPE html>
<html lang="%(lang)s">
<head>
<meta charset="UTF-8">
<title>%(title)s</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="canonical" href="%(site)s%(target)s">
<meta http-equiv="refresh" content="0; url=%(target)s">
<script>location.replace('%(target)s' + location.search + location.hash);</script>
<style>body{background:#04101f;color:#e8d8a8;font-family:sans-serif;text-align:center;padding:3rem 1rem}
a{color:#e8c030}</style>
</head>
<body>
<p>%(sentence)s <a href="%(target)s">%(site)s%(target)s</a></p>
</body>
</html>
'''


def build_redirects():
    """Génère les pages de redirection des anciennes URL (fichier GÉNÉRÉ : ne
    pas éditer game.html à la main, c'est tools/game.master.html le gabarit)."""
    for path, target, lang, title, sentence in REDIRECTS:
        html = REDIRECT_TPL % dict(lang=lang, title=title, target=target,
                                   site=SITE, sentence=sentence)
        out = os.path.join(ROOT, path)
        os.makedirs(os.path.dirname(out), exist_ok=True)
        open(out, 'w', encoding='utf-8', newline='').write(html)
        print('=> écrit %s  (redirection -> %s)' % (path, target))


def main(argv):
    want_en = '--no-en' not in argv
    ids = [a for a in argv if not a.startswith('-')] or [m['id'] for m in MODES]
    for i in ids:
        if i not in BY_ID:
            print('mode inconnu:', i, '— dispo:', ', '.join(BY_ID)); continue
        print('--- mode', i, '---')
        build(i)
    if len(ids) == len(MODES):
        print('--- anciennes URL ---')
        build_redirects()
    if want_en:
        print('\n=== pages anglaises ===')
        import gen_en
        gen_en.build_dict_js()
        for i in ids:
            if i in BY_ID:
                gen_en.build_mode(i)


if __name__ == '__main__':
    main(sys.argv[1:])

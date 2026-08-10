# -*- coding: utf-8 -*-
"""
gen_en.py — Génère les pages anglaises /en/*.html à partir des pages FR racine.

Source unique = les HTML racine (structure/markup) + i18n/en.json (traductions).
Le script ne DUPLIQUE aucune logique : il transforme mécaniquement le HTML FR en HTML EN.

Transformations :
  1. <html lang="fr"> -> "en"
  2. Chemins relatifs -> absolus racine (css/, js/, images/, manifest.json…) pour marcher depuis /en/
  3. Liens de navigation internes (index/game/versus.html) -> /en/…
  4. URLs SEO (canonical, og:url, JSON-LD url) -> /en/… ; og:locale fr_FR -> en_US ; inLanguage fr -> en
  5. Sélecteur de langue (#lang-toggle) : libellé EN->FR, href -> page miroir FR
  6. data-i18n-html="clé" : remplace l'INNER HTML par la valeur EN (cas HTML mixte)
  7. Texte visible + attributs (title/meta/alt/aria) : remplacement FR->EN (clé = chaîne FR exacte)
  8. Rapport des chaînes FR restantes (traductions manquantes)

Les pages PAR MODE (/wanted/ -> /en/wanted/) sont générées par build_mode() :
même chaîne de transformations, mais la source est la page FR déjà produite par
tools/gen_modes.py (chemins déjà absolus) et le slug est traduit.

Usage :  python tools/gen_en.py            (toutes les pages configurées + les 8 modes)
         python tools/gen_en.py index      (une seule page)

Ne PAS lancer via un build de site : outil de dev local, comme blacken.py.
"""
import io, json, os, re, sys

# Idempotent : gen_modes.py importe ce module après avoir déjà passé stdout en
# UTF-8. Ré-emballer le même buffer fermerait celui du premier wrapper (GC).
if (getattr(sys.stdout, 'encoding', '') or '').lower().replace('-', '') != 'utf8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
DICT = json.load(open(os.path.join(ROOT, 'i18n', 'en.json'), encoding='utf-8'))

from modes import MODES, BY_ID   # noqa: E402

# Pages à générer : (fichier racine, url_path SEO, chemin miroir FR pour le sélecteur)
# game.html n'y figure plus : depuis « une URL par mode », c'est une simple
# redirection vers /classique/, générée (FR et EN) par tools/gen_modes.py.
PAGES = {
    'index':  ('index.html',  '',            '/'),
    'versus': ('versus.html', 'versus.html', '/versus.html'),
}

# Clés « gettext » (chaîne FR -> EN), hors clés spéciales namespacées (contiennent un point sans espace).
TEXT_KEYS = {k: v for k, v in DICT.items()
             if not k.startswith('__') and not re.fullmatch(r'[a-z0-9]+(\.[a-z0-9]+)+', k)}
HTML_KEYS = {k: v for k, v in DICT.items()
             if re.fullmatch(r'[a-z0-9]+(\.[a-z0-9]+)+', k)}


def structural(html, url_path, mirror):
    # 1. langue
    html = html.replace('<html lang="fr"', '<html lang="en"')
    # 2. chemins d'assets relatifs -> absolus racine
    html = re.sub(r'(src|href)="(css/|js/|images/|silhouettes/|audio/)', r'\1="/\2', html)
    html = html.replace('href="manifest.json"', 'href="/manifest.en.json"')   # PWA anglaise
    # 3. navigation interne -> /en/
    html = html.replace('href="index.html"', 'href="/en/"')
    html = html.replace('href="versus.html"', 'href="/en/versus.html"')
    # Liens vers les pages de mode (landing : rose des vents + CTA « Jouer »).
    # Les slugs sont traduits, d'où la table plutôt qu'un simple préfixe.
    for m in MODES:
        html = html.replace('href="/%s/"' % m['fr_slug'], 'href="/en/%s/"' % m['en_slug'])
    # 4. SEO : URL canonique/og/JSON-LD -> /en/… (ciblé : ni les images, ni le bloc hreflang)
    base   = 'https://onepiecedle.fr/%s' % url_path
    enbase = 'https://onepiecedle.fr/en/%s' % url_path
    html = html.replace('rel="canonical" href="%s"' % base, 'rel="canonical" href="%s"' % enbase)
    html = html.replace('og:url" content="%s"' % base,      'og:url" content="%s"' % enbase)
    html = html.replace('"url": "%s"' % base,               '"url": "%s"' % enbase)
    html = html.replace('og:locale" content="fr_FR"', 'og:locale" content="en_US"')
    html = html.replace('"inLanguage": "fr"', '"inLanguage": "en"')
    # 5. sélecteur de langue : EN (vers /en/) -> FR (vers page miroir)
    html = re.sub(
        r'(<a id="lang-toggle"[^>]*?href=")[^"]*("[^>]*>)\s*EN\s*(</a>)',
        r'\g<1>%s\g<2>FR\g<3>' % mirror, html)
    html = html.replace('aria-label="Switch to English"', 'aria-label="Passer en français"')
    # 6. dictionnaire EN SYNCHRONE injecté AVANT js/i18n.js : les tables const de app.js
    #    (MODES, WIN_TITLES, rangs…) appellent t() dès le chargement du script.
    html = re.sub(r'(<script src="/js/i18n\.js\?v=(\d+)"></script>)',
                  lambda m: '<script src="/i18n/en.js?v=%s"></script>\n%s' % (m.group(2), m.group(1)),
                  html, count=1)
    return html


def build_dict_js():
    """Génère i18n/en.js (window.__I18N_EN) depuis i18n/en.json — chargé seulement par les pages /en/."""
    out = os.path.join(ROOT, 'i18n', 'en.js')
    body = json.dumps(DICT, ensure_ascii=False, separators=(',', ':'))
    open(out, 'w', encoding='utf-8', newline='').write('window.__I18N_EN=%s;\n' % body)
    print('=> écrit i18n/en.js (%d clés)' % len(DICT))


def expected_keys(mode_id=None):
    """Clés data-i18n-html attendues sur la page traitée. Les blocs éditoriaux
    seo.<mode>.body sont propres à UNE page de mode : leur absence ailleurs est
    normale et ne doit pas être signalée."""
    return {k for k in HTML_KEYS
            if not k.startswith('seo.') or (mode_id and k == 'seo.%s.body' % mode_id)}


def apply_html_blocks(html, expect):
    for key, en in HTML_KEYS.items():
        pat = re.compile(r'(<(\w+)[^>]*data-i18n-html="%s"[^>]*>)(.*?)(</\2>)' % re.escape(key), re.S)
        if not pat.search(html) and key in expect:
            print('  [!] data-i18n-html introuvable pour la clé :', key)
        html = pat.sub(lambda m: m.group(1) + en + m.group(4), html)
    return html


def apply_text(html):
    # Clés longues d'abord : les phrases complètes (meta) priment sur les mots isolés.
    for fr in sorted(TEXT_KEYS, key=len, reverse=True):
        en = TEXT_KEYS[fr]
        e = re.escape(fr)
        # A. nœud de texte : >  FR  <  (espaces/retours autour préservés)
        html = re.sub(r'(>)(\s*)%s(\s*)(<)' % e, lambda m: m.group(1) + m.group(2) + en + m.group(3) + m.group(4), html)
        # B. valeur entre guillemets : "FR"  (title, meta, alt, aria, JSON-LD)
        #    Garde-fou : clés courtes exclues du remplacement d'attribut (ex. ne jamais toucher lang="en").
        if len(fr) >= 4:
            html = html.replace('"%s"' % fr, '"%s"' % en)
    return html


FRENCH_HINT = re.compile(r'[éèêàâçîïôûùœ]|\b(le|la|les|un|une|des|du|et|à|pour|chaque|avec|dans|tes|ton|ta|jeu|joue|défi|défis)\b', re.I)


def report_untranslated(html, name):
    # Nœuds de texte restants qui « sentent » le français (aide au dev, pas bloquant).
    hits = []
    for m in re.finditer(r'>([^<>]{3,})<', html):
        txt = m.group(1).strip()
        if txt and FRENCH_HINT.search(txt) and txt not in ('One Piece © Eiichiro Oda · Shueisha · Toei Animation',):
            hits.append(txt[:80])
    # dédoublonne en gardant l'ordre
    seen, uniq = set(), []
    for h in hits:
        if h not in seen:
            seen.add(h); uniq.append(h)
    if uniq:
        print('  [FR restant ?] %d nœud(s) suspect(s) dans %s :' % (len(uniq), name))
        for h in uniq:
            print('      -', h)
    else:
        print('  [ok] aucun texte FR suspect détecté dans', name)


def build(page):
    src, url_path, mirror = PAGES[page]
    html = open(os.path.join(ROOT, src), encoding='utf-8').read()
    html = structural(html, url_path, mirror)
    html = apply_html_blocks(html, expected_keys())
    html = apply_text(html)
    outdir = os.path.join(ROOT, 'en')
    os.makedirs(outdir, exist_ok=True)
    out = os.path.join(outdir, src)
    open(out, 'w', encoding='utf-8', newline='').write(html)
    print('=> écrit', os.path.relpath(out, ROOT))
    report_untranslated(html, 'en/' + src)


# ============================================================================
# PAGES PAR MODE  /<fr_slug>/  ->  /en/<en_slug>/
# Source = la page FR produite par tools/gen_modes.py : ses chemins d'assets
# sont DÉJÀ absolus (elle vit elle-même dans un sous-dossier), il ne reste que
# la navigation, les URL SEO et le texte à traduire.
# ============================================================================

def structural_mode(html, mode):
    fr, en = mode['fr_slug'], mode['en_slug']
    fr_url = 'https://onepiecedle.fr/%s/' % fr
    en_url = 'https://onepiecedle.fr/en/%s/' % en

    html = html.replace('<html lang="fr"', '<html lang="en"')
    html = html.replace('href="/manifest.json"', 'href="/manifest.en.json"')   # PWA anglaise

    # 1. Navigation interne -> /en/… (AVANT le sélecteur de langue, dont le href
    #    pointe déjà vers /en/<en_slug>/ et ne doit pas être re-préfixé).
    html = html.replace('href="/"', 'href="/en/"')
    html = html.replace('href="/versus.html"', 'href="/en/versus.html"')
    for m in MODES:
        html = html.replace('href="/%s/"' % m['fr_slug'], 'href="/en/%s/"' % m['en_slug'])

    # 2. URL SEO auto-référentes (ciblé : le bloc hreflang porte les MÊMES URL
    #    des deux côtés et doit rester intact).
    html = html.replace('rel="canonical" href="%s"' % fr_url, 'rel="canonical" href="%s"' % en_url)
    html = html.replace('og:url" content="%s"' % fr_url,      'og:url" content="%s"' % en_url)
    html = html.replace('"url": "%s"' % fr_url,               '"url": "%s"' % en_url)
    html = html.replace('og:locale" content="fr_FR"', 'og:locale" content="en_US"')
    html = html.replace('"inLanguage": "fr"', '"inLanguage": "en"')

    # 3. Sélecteur de langue : renvoie vers la page FR miroir (slug français)
    html = html.replace('href="/en/%s/" data-mirror="/en/%s/"' % (en, en),
                        'href="/%s/" data-mirror="/%s/"' % (fr, fr))
    html = re.sub(r'(<a id="lang-toggle"[^>]*>)\s*EN\s*(</a>)', r'\g<1>FR\g<2>', html)
    html = html.replace('aria-label="Switch to English"', 'aria-label="Passer en français"')

    # 4. Dictionnaire EN SYNCHRONE avant js/i18n.js (tables const de app.js)
    html = re.sub(r'(<script src="/js/i18n\.js\?v=(\d+)"></script>)',
                  lambda m: '<script src="/i18n/en.js?v=%s"></script>\n%s' % (m.group(2), m.group(1)),
                  html, count=1)
    return html


def build_mode(mode_id):
    mode = BY_ID[mode_id]
    src  = os.path.join(ROOT, mode['fr_slug'], 'index.html')
    if not os.path.exists(src):
        print('  [!] %s absent — lancer d\'abord python tools/gen_modes.py' % os.path.relpath(src, ROOT))
        return
    html = open(src, encoding='utf-8').read()
    html = structural_mode(html, mode)
    html = apply_html_blocks(html, expected_keys(mode_id))
    html = apply_text(html)
    outdir = os.path.join(ROOT, 'en', mode['en_slug'])
    os.makedirs(outdir, exist_ok=True)
    out = os.path.join(outdir, 'index.html')
    open(out, 'w', encoding='utf-8', newline='').write(html)
    print('=> écrit', os.path.relpath(out, ROOT).replace('\\', '/'))
    report_untranslated(html, 'en/%s/index.html' % mode['en_slug'])


if __name__ == '__main__':
    build_dict_js()
    args  = sys.argv[1:]
    pages = [a for a in args if a in PAGES] or (list(PAGES) if not args else [])
    for p in pages:
        print('--- génération', p, '---')
        build(p)
    mods = [a for a in args if a in BY_ID] or ([m['id'] for m in MODES] if not args else [])
    for i in mods:
        print('--- génération mode', i, '---')
        build_mode(i)
    for a in args:
        if a not in PAGES and a not in BY_ID:
            print('page inconnue:', a, '— dispo:', ', '.join(list(PAGES) + list(BY_ID)))

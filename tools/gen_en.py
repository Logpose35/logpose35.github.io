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

Usage :  python tools/gen_en.py            (toutes les pages configurées)
         python tools/gen_en.py index      (une seule page)

Ne PAS lancer via un build de site : outil de dev local, comme blacken.py.
"""
import io, json, os, re, sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DICT = json.load(open(os.path.join(ROOT, 'i18n', 'en.json'), encoding='utf-8'))

# Pages à générer : (fichier racine, url_path SEO, chemin miroir FR pour le sélecteur)
PAGES = {
    'index':  ('index.html',  '',            '/'),
    'game':   ('game.html',   'game.html',   '/game.html'),
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
    html = html.replace('href="game.html"', 'href="/en/game.html"')
    html = html.replace('href="versus.html"', 'href="/en/versus.html"')
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


def apply_html_blocks(html):
    for key, en in HTML_KEYS.items():
        pat = re.compile(r'(<(\w+)[^>]*data-i18n-html="%s"[^>]*>)(.*?)(</\2>)' % re.escape(key), re.S)
        if not pat.search(html):
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
    html = apply_html_blocks(html)
    html = apply_text(html)
    outdir = os.path.join(ROOT, 'en')
    os.makedirs(outdir, exist_ok=True)
    out = os.path.join(outdir, src)
    open(out, 'w', encoding='utf-8', newline='').write(html)
    print('=> écrit', os.path.relpath(out, ROOT))
    report_untranslated(html, 'en/' + src)


if __name__ == '__main__':
    build_dict_js()
    pages = sys.argv[1:] or list(PAGES)
    for p in pages:
        if p not in PAGES:
            print('page inconnue:', p, '— dispo:', ', '.join(PAGES)); continue
        print('--- génération', p, '---')
        build(p)

# gen_arcs.py : génère les pages d'arcs /arcs/<slug>/index.html
# Texte éditorial dans TEXTES (rédigé à la main), fiches tirées de data.json.
# Usage : python gen_arcs.py <chemin data.json> <dossier de sortie>
# Règle de rédaction : aucun tiret quadratin dans les textes.
import json, sys, os, html

DATA, OUT = sys.argv[1], sys.argv[2]
d = json.load(open(DATA, encoding='utf-8'))
ARCS = d['ARCS']
FRUITS = {}
for f in d['FRUITS']:
    FRUITS[f['holder']] = f
for f in d['FRUITS']:
    for h in f.get('holdersAlt') or []:
        FRUITS.setdefault(h, f)

def esc(s): return html.escape(s, quote=True)

def prime(b):
    if b is None: return 'inconnue'
    if b == 0: return 'aucune'
    if b < 1:
        n = round(b * 1_000_000)
        return f"{n:,} berrys".replace(',', '\u202f')
    if b >= 1000:
        s = f"{b/1000:.3f}".rstrip('0').rstrip('.').replace('.', ',')
        return f"{s} milliard{'s' if b >= 2000 else ''} de berrys"
    return f"{b} millions de berrys"

def fruit(c):
    f = FRUITS.get(c['name'])
    if f: return f"{esc(f['name'])} ({esc(f['translated'])}, {esc(f['type'])})"
    if c['fruit']: return esc(c['fruit'])
    return 'aucun'

def haki(c):
    h = c['haki']
    if not h: return 'aucun connu'
    return ', '.join(x.lower() for x in h)

from textes_arcs import TEXTES
import re
# Sprite SVG + barre de navigation repris tels quels de /a-propos/ (lien EN retiré : pas de version anglaise des arcs pour l'instant)
_ap = open(os.path.join(os.path.dirname(DATA), 'a-propos', 'index.html'), encoding='utf-8').read()
_sprite = _ap[_ap.index('<svg width="0"'):_ap.index('</svg>', _ap.index('<svg width="0"')) + 6]
_nav = _ap[_ap.index('<nav class="lp-nav"'):_ap.index('</nav>') + 6]
_nav = re.sub(r'\s*<a class="lp-lang"[^>]*>EN</a>', '', _nav)
GABARIT_NAV = _sprite + '\n\n' + _nav
# Version de cache : lue dans sw.js (logpose-vNN), pour suivre les bumps sans retoucher ce fichier
try:
    _sw = open(os.path.join(os.path.dirname(DATA), 'sw.js'), encoding='utf-8').read()
    CACHE_V = re.search(r'logpose-v(\d+)', _sw).group(1)
except Exception:
    CACHE_V = re.search(r'\?v=(\d+)', _ap).group(1)
# Pied de page : repris tel quel de /a-propos/ (lien « Les arcs » et badge compris)
_FOOT = _ap[_ap.index('<footer'):_ap.index('</footer>') + len('</footer>')]

ordre = [i for i in range(1, len(ARCS))]

def page(slug, t):
    idx = ARCS.index(t['arc'])
    debuts = [c for c in d['CHARACTERS'] if c['arc'] == idx]
    prev_i = idx - 1 if idx > 1 else None
    next_i = idx + 1 if idx + 1 < len(ARCS) else None
    fiches = []
    for c in debuts:
        epi = f'<span class="arc-carte__epi">{esc(c["epithet"])}</span>' if c.get('epithet') else ''
        fiches.append(f"""    <li class="arc-carte">
      <h3>{esc(c['name'])}</h3>{epi}
      <dl>
        <dt>Affiliation</dt><dd>{esc(c['affil'])}</dd>
        <dt>Origine</dt><dd>{esc(c['origin'])}</dd>
        <dt>Fruit</dt><dd>{fruit(c)}</dd>
        <dt>Haki</dt><dd>{haki(c)}</dd>
        <dt>Statut</dt><dd>{esc(c['status'])}</dd>
        <dt>Prime</dt><dd>{prime(c['bounty'])}</dd>
      </dl>
    </li>""")
    bref = ''.join(f'<dt>{esc(k)}</dt><dd>{v}</dd>' for k, v in t['bref'])
    corps = '\n\n'.join(t['sections'])
    nav = []
    if prev_i is not None and ARCS[prev_i] in SLUGS:
        nav.append(f'<a href="/arcs/{SLUGS[ARCS[prev_i]]}/">Arc précédent : {esc(ARCS[prev_i])}</a>')
    if next_i is not None and ARCS[next_i] in SLUGS:
        nav.append(f'<a href="/arcs/{SLUGS[ARCS[next_i]]}/">Arc suivant : {esc(ARCS[next_i])}</a>')
    navh = ' · '.join(nav)
    title = f"Arc {t['arc']} de One Piece : résumé, personnages et indices · OnePiecedle"
    url = f"https://onepiecedle.fr/arcs/{slug}/"
    return f"""<!DOCTYPE html>
<html lang="fr" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{esc(title)}</title>
  <meta name="description" content="{esc(t['description'])}">
  <meta name="robots" content="index, follow">
  <meta name="theme-color" content="#c89408">
  <link rel="canonical" href="{url}">
  <meta property="og:title" content="{esc(title)}">
  <meta property="og:description" content="{esc(t['description'])}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="{url}">
  <meta property="og:locale" content="fr_FR">
  <meta property="og:image" content="https://onepiecedle.fr/images/og_preview.jpg">
  <meta property="og:site_name" content="OnePiecedle">
  <link rel="icon" type="image/png" href="/images/favicon.png">
  <script>
    (function () {{
      function applyTheme(t) {{ document.documentElement.setAttribute('data-theme', t); }}
      window.toggleTheme = function () {{
        var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        try {{ localStorage.setItem('op-theme', next); }} catch (e) {{}}
      }};
      function readAndApply() {{
        var saved;
        try {{ saved = localStorage.getItem('op-theme'); }} catch (e) {{}}
        if (saved) applyTheme(saved);
        else applyTheme(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      }}
      readAndApply();
      window.addEventListener('pageshow', function (e) {{ if (e.persisted) readAndApply(); }});
    }})();
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700;900&family=Barlow+Condensed:wght@300;400;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/base.css?v={CACHE_V}">
  <link rel="stylesheet" href="/css/landing.css?v={CACHE_V}">
  <link rel="stylesheet" href="/css/doc.css?v={CACHE_V}">
  <link rel="stylesheet" href="/css/arcs.css?v={CACHE_V}">
  <link rel="stylesheet" href="/css/mobile.css?v={CACHE_V}">
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9097997401612968" crossorigin="anonymous"></script>
  <script type="application/ld+json">
  {{"@context":"https://schema.org","@type":"Article","headline":{json.dumps("Arc " + t['arc'] + " de One Piece", ensure_ascii=False)},"inLanguage":"fr","mainEntityOfPage":"{url}","publisher":{{"@type":"Organization","name":"OnePiecedle"}}}}
  </script>
</head>
<body class="landing-body doc-body nav-condensed">

{GABARIT_NAV}

<main class="doc">
  <p class="arc-fil"><a href="/arcs/">Les arcs de One Piece</a> · arc {idx} sur {len(ARCS) - 1}</p>
  <h1 class="doc-title">Arc {esc(t['arc'])}</h1>
  <p class="doc-lead">{t['chapo']}</p>
  <aside class="arc-bref" aria-label="L'arc en bref"><h2>L'arc en bref</h2><dl>{bref}</dl></aside>

{corps}

  <h2>Les personnages qui apparaissent pour la première fois</h2>
  <p>Dans OnePiecedle, la colonne « 1er Arc » du mode <a href="/classique/">Classique</a> indique l'arc de
  première apparition d'un personnage. Pour {esc(t['arc'])}, {len(debuts)} personnage{'s' if len(debuts) > 1 else ''} de la sélection
  en relève{'nt' if len(debuts) > 1 else ''}. Leurs fiches, telles que le jeu les compare :</p>
  <ul class="arc-cartes">
{chr(10).join(fiches)}
  </ul>
  {t['note_jeu']}

  <p class="arc-nav">{navh}</p>
</main>

{_FOOT}
<script src="/js/version.js?v={CACHE_V}"></script>
</body>
</html>
"""

SLUGS = {t['arc']: s for s, t in TEXTES.items()}
for slug, t in TEXTES.items():
    os.makedirs(os.path.join(OUT, slug), exist_ok=True)
    out = page(slug, t)
    assert '—' not in ''.join(t['sections']) + t['chapo'] + t['note_jeu'] + t['description'], slug
    open(os.path.join(OUT, slug, 'index.html'), 'w', encoding='utf-8').write(out)
    print('ok', slug)


# ── Page sommaire /arcs/ : même gabarit qu'une page d'arc, <head> et <main> remplacés ──
def sommaire():
    blocs = [('East Blue', 1, 6), ('Grand Line', 7, 23), ('Le Nouveau Monde', 24, len(ARCS) - 1)]
    corps = []
    for titre, a, b in blocs:
        items = []
        for i in range(a, b + 1):
            arc = ARCS[i]
            slug = SLUGS[arc]
            chap = dict(TEXTES[slug]['bref']).get('Chapitres', '')
            n = sum(1 for c in d['CHARACTERS'] if c['arc'] == i)
            items.append(f'    <li><a href="/arcs/{slug}/">{esc(arc)}</a> <span class="arc-som__meta">chapitres {esc(chap[0].lower() + chap[1:])} · {n} perso{"s" if n > 1 else ""} du jeu</span></li>')
        corps.append(f'  <h2>{titre}</h2>\n  <ol class="arc-som" start="{a}">\n' + '\n'.join(items) + '\n  </ol>')
    desc = ("Les 32 arcs de One Piece, de Romance Dawn à Elbaf : résumés, chapitres et personnages "
            "qui y font leurs débuts, avec les repères utiles pour OnePiecedle.")
    title = "Les arcs de One Piece : résumés et personnages · OnePiecedle"
    url = "https://onepiecedle.fr/arcs/"
    base = page('alabasta', TEXTES['alabasta'])
    h = base[:base.index('<main')]
    h = re.sub(r'<title>.*?</title>', f'<title>{esc(title)}</title>', h)
    h = re.sub(r'(<meta (?:name="description"|property="og:description") content=")[^"]*', lambda m: m.group(1) + esc(desc), h)
    h = re.sub(r'(<meta property="og:title" content=")[^"]*', lambda m: m.group(1) + esc(title), h)
    h = h.replace('https://onepiecedle.fr/arcs/alabasta/', url)
    h = re.sub(r'\s*<script type="application/ld\+json">.*?</script>', '', h, flags=re.S)
    main = f"""<main class="doc">
  <h1 class="doc-title">Les arcs de One Piece</h1>
  <p class="doc-lead">One Piece se découpe en arcs, chacun centré sur une île et un adversaire. Les {len(ARCS) - 1} pages
  ci-dessous résument chaque arc, donnent ses chapitres et listent les personnages qui y font leur première
  apparition, celle qu'utilise la colonne « 1er Arc » du mode <a href="/classique/">Classique</a> pour
  deviner le personnage One Piece du jour.</p>

{chr(10).join(corps)}
</main>"""
    pied = base[base.index('</main>') + len('</main>'):]
    open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write(h + main + pied)
    print('ok sommaire')

sommaire()

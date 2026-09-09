# -*- coding: utf-8 -*-
"""
compteurs.py — les chiffres qui quantifient le contenu du site, DÉDUITS des
données plutôt qu'écrits à la main.

Pourquoi : le 09/09/2026, quinze personnages ont été ajoutés et l'éditorial
annonçait toujours « 266 personnages » à une quinzaine d'endroits — page
d'accueil, blocs SEO des huit modes, FAQ, page À propos, et leurs traductions
anglaises. Un chiffre écrit en dur est faux dès l'ajout suivant.

Fonctionnement : les textes portent des jetons `{{NB_PERSOS}}`, `{{NB_SILHOUETTES}}`,
`{{NB_FRUITS}}`, `{{NB_TOMES}}`, `{{NB_OPENINGS}}`. Les générateurs appellent
`substituer()` juste avant d'écrire. Le jeton traverse donc toute la chaîne, y
compris la traduction : les clés de `i18n/en.json` restent STABLES quand les
compteurs bougent, ce qui était l'autre moitié du problème.

⚠️ Les entrées de CHANGELOG (js/app.js) gardent leurs chiffres en dur : ce sont
des archives de version, elles décrivent ce qui était vrai à l'époque.
"""
import json
import os

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _charge(chemin):
    with open(os.path.join(RACINE, chemin), encoding='utf-8') as f:
        return json.load(f)


def _iles_de_la_carte():
    """Nombre d'entrees de la table ISLANDS de js/map.js (la zone Filler, qui
    vit dans FILLER_ZONE a part, n'en fait pas partie)."""
    import re
    with open(os.path.join(RACINE, 'js', 'map.js'), encoding='utf-8') as f:
        src = f.read()
    debut = src.index('const ISLANDS = [')
    corps = src[debut:src.index('\n  ];', debut)]
    return len(re.findall(r'\{\s*arc:\s*\d+', corps))


def compteurs():
    """Les chiffres réels, relus à chaque appel (les générateurs tournent après
    une modification de data.json)."""
    d = _charge('data.json')
    focus = _charge(os.path.join('silhouettes', 'focus.json'))
    persos = d['CHARACTERS']

    # Pool silhouette = clés de focus.json croisées avec l'image PRINCIPALE des
    # personnages — la même règle que js/data.js. Une découpe sans fiche ne compte pas.
    cles = set()
    for p in persos:
        img = p.get('img')
        cle = img[0] if isinstance(img, list) and img else (img if isinstance(img, str) else None)
        if cle:
            cles.add(cle)

    return {
        'NB_PERSOS':      len(persos),
        'NB_SILHOUETTES': len([k for k in focus if k in cles]),
        'NB_FRUITS':      len(d['FRUITS']),
        'NB_TOMES':       len(d.get('TOMES') or []),
        'NB_OPENINGS':    len(d.get('OPENINGS') or []),
        # La carte fait foi, pas data.json : la table ISLANDS de js/map.js est
        # tenue à la main (coordonnées + seuil par île). Ajouter un arc à
        # data.json n'ajoute pas une île — annoncer len(ARCS)-1 mentirait.
        'NB_ILES':        _iles_de_la_carte(),
        # Les arcs COMPTENT Filler : c'est une valeur du champ `arc` d'une
        # fiche, donc une donnee du jeu. NB_ILES l'exclut, la carte non plus
        # ne le compte pas — les deux nombres different d'une unite, exprès.
        'NB_ARCS':        len(d['ARCS']),
        # Les arcs COMPTENT Filler : c'est une valeur du champ `arc` d'une
        # fiche, donc une donnee du jeu. NB_ILES l'exclut, la carte non plus
        # ne le compte pas — les deux nombres different d'une unite, exprès.
        'NB_ARCS':        len(d['ARCS']),
    }


def substituer(texte, valeurs=None):
    """Remplace les jetons `{{NB_…}}` par les chiffres réels."""
    v = valeurs if valeurs is not None else compteurs()
    for cle, n in v.items():
        texte = texte.replace('{{%s}}' % cle, str(n))
    return texte


def jetons_restants(texte):
    """Jetons non substitués — sert de garde-fou aux générateurs."""
    import re
    return sorted(set(re.findall(r'\{\{NB_[A-Z]+\}\}', texte)))


# ── Fichiers SERVIS tels quels ───────────────────────────────────────────────
# index.html n'est pas généré : un jeton y resterait visible pour les joueurs.
# Ses compteurs sont donc réécrits EN PLACE, chiffre par chiffre, sur des motifs
# ancrés à leur phrase. Un motif qui ne trouve rien lève une erreur plutôt que
# de laisser filer un chiffre périmé — c'est tout l'intérêt.
_MOTIFS_EN_PLACE = {
    'index.html': [
        (r'(Le jeu compte )\d+( personnages de One Piece)', 'NB_PERSOS'),
        (r'(<use href="#ic-note"></use></svg> )\d+( openings)', 'NB_OPENINGS'),
        (r'(<p>)\d+( îles à débloquer en jouant\.)', 'NB_ILES'),
        # Ruban « L'équipage en chiffres » : le nombre et son libellé sont sur
        # deux lignes distinctes, donc le motif traverse le saut de ligne — sans
        # le libellé, tous les compteurs du ruban se ressembleraient.
        (r'(<div class="ribbon__num">)\d+(</div>\s*<div class="ribbon__label">Personnages</div>)', 'NB_PERSOS'),
        (r'(<div class="ribbon__num">)\d+(</div>\s*<div class="ribbon__label">Openings</div>)', 'NB_OPENINGS'),
    ],
}


def sync_en_place(racine=None, verbeux=True):
    """Met à jour les compteurs des fichiers non générés. Renvoie le nombre de
    remplacements."""
    import re
    base = racine or RACINE
    v = compteurs()
    total = 0
    for rel, regles in _MOTIFS_EN_PLACE.items():
        chemin = os.path.join(base, rel)
        with open(chemin, encoding='utf-8', newline='') as f:
            brut = f.read()
        fin = '\r\n' if '\r\n' in brut else '\n'
        s = brut.replace('\r\n', '\n')
        for motif, cle in regles:
            s, n = re.subn(motif, lambda m: m.group(1) + str(v[cle]) + m.group(2), s)
            if n == 0:
                raise SystemExit(
                    'compteurs : motif introuvable dans %s (%s). La phrase a dû '
                    'changer — corriger _MOTIFS_EN_PLACE.' % (rel, cle))
            total += n
        if s != brut.replace('\r\n', '\n'):
            with open(chemin, 'w', encoding='utf-8', newline='') as f:
                f.write(s.replace('\n', fin))
        if verbeux:
            print('=> compteurs synchronisés dans %s (%d emplacement(s))' % (rel, total))
    return total


if __name__ == '__main__':
    import io
    import sys
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    for k, n in compteurs().items():
        print('  %-16s %d' % (k, n))

# -*- coding: utf-8 -*-
"""
modes.py — Table des 8 modes de jeu + contenu éditorial SEO par mode.

Source UNIQUE partagée par :
  • tools/gen_modes.py  (génère les pages FR  /<fr_slug>/index.html)
  • tools/gen_en.py     (génère les pages EN  /en/<en_slug>/index.html)

Chaque mode a sa propre URL indexable (chantier « une URL par mode ») : c'est
ce qui rend les pages distinctes aux yeux de Google et rend les sitelinks
possibles. Une page = la section de SON mode + un bloc éditorial propre.

Champs :
  id       identifiant interne (celui de MODES dans js/app.js)
  section  id du <div> de section dans game.html
  tab      id de l'onglet
  icon     id du <symbol> SVG (sprite inline)
  fr_label libellé affiché sur l'onglet (FR)
  fr_slug  segment d'URL français   -> https://onepiecedle.fr/<fr_slug>/
  en_slug  segment d'URL anglais    -> https://onepiecedle.fr/en/<en_slug>/

Les libellés EN viennent du dictionnaire i18n/en.json (clé = libellé FR).
"""

MODES = [
    dict(id='classic',    section='classic-section',    tab='tab-classic',
         icon='ic-compass',    fr_label='Classique',      fr_slug='classique',       en_slug='classic'),
    dict(id='wanted',     section='wanted-section',     tab='tab-wanted',
         icon='ic-wanted',     fr_label='Wanted',         fr_slug='wanted',          en_slug='wanted'),
    dict(id='silhouette', section='silhouette-section', tab='tab-silhouette',
         icon='ic-silhouette', fr_label='Silhouette',     fr_slug='silhouette',      en_slug='silhouette'),
    dict(id='fruit',      section='fruit-section',      tab='tab-fruit',
         icon='ic-fruit',      fr_label='Fruit du Démon', fr_slug='fruit-du-demon',  en_slug='devil-fruit'),
    dict(id='emoji',      section='emoji-section',      tab='tab-emoji',
         icon='ic-rebus',      fr_label='Émoji',          fr_slug='emoji',           en_slug='emoji'),
    dict(id='audio',      section='audio-section',      tab='tab-audio',
         icon='ic-note',       fr_label='Opening',        fr_slug='opening',         en_slug='opening'),
    dict(id='tome',       section='tome-section',       tab='tab-tome',
         icon='ic-tome',       fr_label='Tome',           fr_slug='tome',            en_slug='volume'),
    dict(id='inf',        section='inf-section',        tab='tab-inf',
         icon='ic-shuffle',    fr_label='Mode Infini',    fr_slug='infini',          en_slug='endless'),
]

BY_ID = {m['id']: m for m in MODES}

# Les 7 modes quotidiens forment la barre d'onglets principale ; « inf » vit sur
# la ligne du dessous, avec le lien Versus (page autonome, pas un mode quotidien).
DAILY_IDS = [m['id'] for m in MODES if m['id'] != 'inf']


# ============================================================================
# CONTENU ÉDITORIAL — une fiche courte PAR MODE (h1 + ~50 mots).
#
# Rôle exact, et rien de plus : empêcher que Google fusionne 8 pages qui
# partagent la même coquille (en-tête, réglages, barre de score, modales…).
# Ce n'est PAS ce qui fait ranker sur « onepiecedle » — le concurrent n°1 n'a
# aucun texte : son avantage vient de ses URL par mode et de son réseau de
# jeux -dle. Le texte reste donc court et factuel, sous la ligne de flottaison.
#
# Formulation IMPERSONNELLE (pas de tutoiement). Chiffres vérifiés dans le code.
# Chaque chaîne FR doit avoir sa traduction dans i18n/en.json, sinon elle
# s'affichera en français sur /en/ (le générateur le signale).
# Un mode absent de ce dictionnaire est généré SANS bloc éditorial.
#
# Clé 'faq' FACULTATIVE : la fournir rajoute l'accordéon + le balisage FAQPage
# (voir gen_modes.seo_block). Aucun mode n'en a pour l'instant — décision du
# 09/08/2026 après comparaison avec onepiecedle.net.
# ============================================================================

SEO = {

    'classic': dict(
        title='OnePiecedle Classique — le personnage One Piece du jour · LogPose',
        desc='OnePiecedle Classique : deviner le personnage One Piece du jour en croisant genre, '
             'affiliation, origine, fruit du démon, haki et prime. 10 essais, gratuit.',
        og_title='OnePiecedle · Classique — le personnage One Piece du jour',
        og_desc='Chaque essai compare genre, affiliation, origine, fruit du démon, haki, statut, '
                'premier arc et prime. Dix essais pour trouver.',
        ld_name='OnePiecedle Classique',
        ld_desc='Devinette quotidienne One Piece : identifier le personnage du jour à partir de huit '
                'caractéristiques comparées à chaque essai.',
        h1='OnePiecedle Classique — deviner le personnage One Piece du jour',
        body_key='seo.classic.body',
        body='''<p>Le mode Classique compare chaque proposition au personnage du jour sur huit
        caractéristiques — genre, affiliation, origine, fruit du démon, haki, statut, premier arc et
        prime — le vert signalant une correspondance exacte, l'orange une proximité et les flèches le
        sens de la prime. Dix essais sont accordés, et un indice facultatif dévoile un attribut
        manquant contre la moitié du score.</p>''',
    ),

    'wanted': dict(
        title='OnePiecedle Wanted — l\'avis de recherche du jour · LogPose',
        desc='OnePiecedle Wanted : chaque jour, un avis de recherche One Piece flouté à identifier. '
             'L\'image se précise à chaque erreur, 8 essais au total. Gratuit, sans inscription.',
        og_title='OnePiecedle · Wanted — l\'avis de recherche One Piece du jour',
        og_desc='Un avis de recherche flouté chaque jour. Le portrait se précise à chaque erreur : '
                '8 essais pour reconnaître le pirate.',
        ld_name='OnePiecedle Wanted',
        ld_desc='Devinette quotidienne One Piece : identifier le personnage d\'un avis de recherche '
                'progressivement défloutté en 8 essais.',
        h1='OnePiecedle Wanted — deviner le personnage de l\'avis de recherche',
        body_key='seo.wanted.body',
        body='''<p>Le mode Wanted affiche chaque jour un avis de recherche One Piece entièrement
        flouté : à chaque erreur, le portrait se précise d'un cran, jusqu'au huitième et dernier essai.
        Le personnage est tiré au sort à minuit, heure de Paris, et reste le même pour tous les joueurs
        de la journée.</p>''',
    ),

    'silhouette': dict(
        title='OnePiecedle Silhouette — le personnage du jour à sa forme · LogPose',
        desc='OnePiecedle Silhouette : un gros plan sur le contour d\'un personnage One Piece, qui '
             's\'élargit à chaque erreur. 10 essais et un indice couleur au cinquième.',
        og_title='OnePiecedle · Silhouette — reconnaître le personnage à sa forme',
        og_desc='Un gros plan sur le contour, qui recule à chaque erreur jusqu\'à la silhouette '
                'entière. Dix essais.',
        ld_name='OnePiecedle Silhouette',
        ld_desc='Devinette quotidienne One Piece : reconnaître un personnage à partir d\'un gros plan '
                'sur sa silhouette, dézoomé progressivement en 10 essais.',
        h1='OnePiecedle Silhouette — reconnaître le personnage à sa forme',
        body_key='seo.silhouette.body',
        body='''<p>Le mode Silhouette part d'un gros plan très serré sur un point du contour d'un
        personnage, puis recule d'un cran à chaque erreur jusqu'à dévoiler la forme entière au dixième
        essai. À partir du cinquième essai, un indice facultatif éclaire une zone en couleur contre la
        moitié du score ; 162 des 258 personnages du jeu peuvent tomber.</p>''',
    ),

    'fruit': dict(
        title='OnePiecedle Fruit du Démon — trouver le détenteur · LogPose',
        desc='OnePiecedle Fruit du Démon : le nom d\'un fruit du démon est affiché, son détenteur '
             'reste à trouver. 117 fruits, 10 essais et trois indices progressifs.',
        og_title='OnePiecedle · Fruit du Démon — qui a mangé ce fruit ?',
        og_desc='Un nom de fruit du démon est donné, son détenteur reste à trouver. Trois indices se '
                'débloquent au fil des essais.',
        ld_name='OnePiecedle Fruit du Démon',
        ld_desc='Devinette quotidienne One Piece : retrouver le détenteur d\'un fruit du démon donné, '
                'en dix essais et trois indices.',
        h1='OnePiecedle Fruit du Démon — trouver le détenteur du fruit',
        body_key='seo.fruit.body',
        body='''<p>Le mode Fruit du Démon affiche le nom d'un des 117 fruits recensés et laisse
        deviner son détenteur en dix essais. Trois indices se débloquent au fil des erreurs : le type
        du fruit au troisième essai, sa traduction française au cinquième et la description de son
        pouvoir au huitième, chacun réduisant le score obtenu.</p>''',
    ),

    'emoji': dict(
        title='OnePiecedle Émoji — le personnage derrière les émojis · LogPose',
        desc='OnePiecedle Émoji : huit émojis décrivent un personnage One Piece, dévoilés un par un '
             'à chaque erreur. 8 essais pour l\'identifier. Gratuit, sans inscription.',
        og_title='OnePiecedle · Émoji — le personnage derrière les émojis',
        og_desc='Huit émojis choisis pour un seul personnage, révélés un par un à chaque erreur. '
                'Huit essais.',
        ld_name='OnePiecedle Émoji',
        ld_desc='Devinette quotidienne One Piece : identifier un personnage à partir d\'une série de '
                'huit émojis dévoilés progressivement.',
        h1='OnePiecedle Émoji — deviner le personnage derrière les émojis',
        body_key='seo.emoji.body',
        body='''<p>Le mode Émoji résume un personnage One Piece en huit émojis distinctifs — pouvoir,
        arme, animal, trait de caractère — dévoilés un par un à chaque erreur, sur huit essais au
        total. Après trois erreurs, un indice facultatif révèle la première apparition du personnage,
        au prix d'une part du score.</p>''',
    ),

    'audio': dict(
        title='OnePiecedle Opening — l\'opening One Piece du jour · LogPose',
        desc='OnePiecedle Opening : un extrait d\'une seconde d\'un opening One Piece, allongé à '
             'chaque erreur. 29 openings et 6 essais pour reconnaître le bon.',
        og_title='OnePiecedle · Opening — reconnaître l\'opening One Piece du jour',
        og_desc='Une seconde de musique au premier essai, seize au dernier. 29 openings, six essais.',
        ld_name='OnePiecedle Opening',
        ld_desc='Devinette musicale quotidienne One Piece : reconnaître un opening à partir d\'un '
                'extrait qui s\'allonge à chaque erreur.',
        h1='OnePiecedle Opening — reconnaître l\'opening One Piece du jour',
        body_key='seo.audio.body',
        body='''<p>Le mode Opening diffuse une seconde d'un des 29 génériques de la série, puis
        rallonge l'extrait à chaque erreur : deux, quatre, sept, onze, puis seize secondes au sixième
        et dernier essai. Le point de départ de l'extrait change chaque jour, si bien qu'un refrain
        connu ne tombe pas toujours au même endroit.</p>''',
    ),

    'tome': dict(
        title='OnePiecedle Tome — reconnaître le tome à sa couverture · LogPose',
        desc='OnePiecedle Tome : un gros plan sur la couverture d\'un tome de One Piece, dézoomé à '
             'chaque erreur. 112 tomes et 6 essais pour trouver le bon numéro.',
        og_title='OnePiecedle · Tome — reconnaître le tome à sa couverture',
        og_desc='Un détail de couverture qui s\'élargit à chaque erreur. 112 tomes, six essais, et '
                'l\'écart est indiqué à chaque proposition.',
        ld_name='OnePiecedle Tome',
        ld_desc='Devinette quotidienne One Piece : retrouver le numéro d\'un tome à partir d\'un gros '
                'plan sur sa couverture.',
        h1='OnePiecedle Tome — reconnaître le tome à sa couverture',
        body_key='seo.tome.body',
        body='''<p>Le mode Tome montre un détail très agrandi de la couverture d'un des 112 tomes
        parus et recule d'un cran à chaque erreur jusqu'à la couverture entière. La réponse est un
        numéro entre 1 et 112 : chaque proposition indique si le tome cherché est plus haut ou plus
        bas, ce qui laisse six essais pour l'encadrer.</p>''',
    ),

    'inf': dict(
        title='OnePiecedle Mode Infini — s\'entraîner sans limite · LogPose',
        desc='OnePiecedle Mode Infini : la grille du mode Classique en parties illimitées, hors défi '
             'quotidien. Un personnage au hasard, 10 essais, une série à tenir.',
        og_title='OnePiecedle · Mode Infini — l\'entraînement sans limite',
        og_desc='La grille du mode Classique en parties illimitées : un personnage au hasard à chaque '
                'partie et une série de victoires à tenir.',
        ld_name='OnePiecedle Mode Infini',
        ld_desc='Entraînement One Piece illimité : deviner un personnage tiré au hasard avec la '
                'grille du mode Classique, autant de fois que voulu.',
        h1='OnePiecedle Mode Infini — s\'entraîner sans limite',
        body_key='seo.inf.body',
        body='''<p>Le mode Infini reprend la grille du mode Classique — huit caractéristiques
        comparées à chaque essai — mais tire un personnage au hasard et se rejoue autant de fois que
        voulu. Il reste hors du défi quotidien : il ne rapporte aucun point au score du jour et ne
        compte qu'une série de victoires et son record.</p>''',
    ),

}

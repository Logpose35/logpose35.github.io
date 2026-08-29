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
# (balisage inerte depuis mai 2026, cf. gen_modes.py — l'intérêt est le texte)
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
        body='''
        <p>Le mode Classique donne dix essais pour retrouver le personnage One Piece du jour. Chaque nom
        proposé revient sous forme de ligne, avec huit cases comparées à la réponse : genre, affiliation,
        origine, fruit du démon, haki, statut, premier arc d'apparition et prime.</p>
        <p>Le vert signale une valeur identique, l'orange une correspondance partielle. Sur l'affiliation,
        l'orange rapproche deux équipages d'une même alliance ou de la Grande Flotte. Sur l'origine, il
        indique deux mers portant le même nom, East Blue et North Blue par exemple. Sur le fruit du démon,
        il signifie que les deux personnages en portent un, mais pas du même type. Sur le haki, qu'ils
        partagent au moins une couleur sans avoir exactement les mêmes.</p>
        <p>Deux colonnes affichent en plus une flèche. Le premier arc indique s'il faut chercher plus tôt ou
        plus tard dans l'histoire, la prime si le montant recherché est plus haut ou plus bas. Ces deux
        repères réduisent la liste bien plus vite que les cases de couleur seules.</p>
        <p>La sélection compte 266 personnages, des Chapeaux de Paille aux Empereurs, en passant par les
        seconds rôles des grands arcs. Un indice facultatif dévoile un attribut resté inconnu, contre la
        moitié du score de la manche. Le tirage a lieu à minuit, heure de Paris, et vaut pour tous les
        joueurs jusqu'au lendemain.</p>''',
        faq=[
            ("Combien d'essais donne le mode Classique ?",
             "Dix. Chaque proposition affiche les huit caractéristiques comparées au personnage du jour, ce qui permet d'écarter des pans entiers de la liste dès les premiers essais."),
            ("Que veut dire une case orange ?",
             "Une correspondance partielle : deux équipages d'une même alliance sur l'affiliation, deux mers Blue sur l'origine, deux fruits du démon de types différents, ou au moins une couleur de haki en commun."),
            ("Le personnage du jour est-il le même pour tout le monde ?",
             "Oui. Le tirage a lieu à minuit, heure de Paris, et la réponse reste identique pour l'ensemble des joueurs jusqu'au lendemain."),
        ],
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
        body='''
        <p>Le mode Wanted affiche un avis de recherche One Piece dont le portrait est flouté au maximum.
        Chaque erreur retire un cran de flou : vingt pixels au départ, puis seize, douze, neuf, six, trois,
        un, et l'image nette au huitième et dernier essai.</p>
        <p>Les premiers essais se jouent sur la silhouette générale, les aplats de couleur, une coiffure ou
        une posture. Les traits du visage n'arrivent qu'ensuite. Comme le score baisse à chaque erreur, il
        reste souvent plus rentable de proposer tôt un personnage plausible que d'attendre une image
        parfaitement lisible.</p>
        <p>L'affiche reprend la mise en page des avis de recherche de la série, prime comprise. Cette prime
        est celle de la fiche du personnage, mais elle ne devient lisible qu'une fois le flou suffisamment
        réduit : elle sert donc de confirmation en fin de manche plutôt que d'indice de départ.</p>
        <p>Le personnage est tiré au sort à minuit, heure de Paris, et reste le même pour tous les joueurs de
        la journée. Les parties en cours et terminées sont conservées dans le navigateur, sans compte ni
        inscription.</p>''',
        faq=[
            ("Combien d'essais pour identifier l'avis de recherche ?",
             "Huit. Le flou diminue d'un cran à chaque erreur, de vingt pixels au premier essai jusqu'à l'image nette au huitième."),
            ("La prime affichée est-elle la vraie prime du personnage ?",
             "Oui, c'est celle de sa fiche. Elle n'est simplement lisible qu'une fois le flou assez réduit, en fin de manche."),
            ("Que se passe-t-il après huit erreurs ?",
             "La réponse est dévoilée et la manche se termine. Le résultat compte dans le score du jour, et un nouvel avis de recherche arrive le lendemain à minuit."),
        ],
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
        body='''
        <p>Le mode Silhouette part d'un gros plan très serré sur un point du contour d'un personnage. À
        chaque erreur, la vue recule d'un cran et se recentre, jusqu'à la silhouette entière au dixième
        essai.</p>
        <p>Le cadrage initial ne montre qu'un dixième de l'image environ. Les premiers paliers ouvrent
        largement, puis la progression ralentit sur la fin, de sorte que l'essentiel de la forme se dévoile
        en milieu de partie. Une mèche de cheveux, un chapeau, une arme portée dans le dos suffisent parfois
        à trancher bien avant le dézoom complet.</p>
        <p>À partir du cinquième essai, un indice facultatif éclaire en couleur la zone visible du contour,
        contre la moitié du score de la manche. Il aide surtout sur les personnages dont la couleur fait
        l'identité, une chevelure rousse ou une tenue immédiatement reconnaissable.</p>
        <p>197 des 266 personnages du jeu peuvent tomber : seuls ceux dont la silhouette a été découpée
        entrent dans le tirage. Cette sélection s'élargit au fil des ajouts, sans jamais modifier les
        journées déjà jouées.</p>''',
        faq=[
            ("Combien d'essais dans le mode Silhouette ?",
             "Dix. La vue recule d'un cran à chaque erreur, du gros plan initial jusqu'à la silhouette complète au dernier essai."),
            ("À quoi sert l'indice couleur ?",
             "Il colore la zone visible du contour, à partir du cinquième essai. Il coûte la moitié du score de la manche et ne se déclenche qu'à la demande."),
            ("Tous les personnages peuvent-ils tomber ?",
             "Non. Le tirage se limite aux 197 personnages dont la silhouette est disponible, sur les 266 que compte le jeu."),
        ],
    ),

    'fruit': dict(
        title='OnePiecedle Fruit du Démon — trouver le détenteur · LogPose',
        desc='OnePiecedle Fruit du Démon : le nom d\'un fruit du démon est affiché, son détenteur '
             'reste à trouver. 118 fruits, 10 essais et trois indices progressifs.',
        og_title='OnePiecedle · Fruit du Démon — qui a mangé ce fruit ?',
        og_desc='Un nom de fruit du démon est donné, son détenteur reste à trouver. Trois indices se '
                'débloquent au fil des essais.',
        ld_name='OnePiecedle Fruit du Démon',
        ld_desc='Devinette quotidienne One Piece : retrouver le détenteur d\'un fruit du démon donné, '
                'en dix essais et trois indices.',
        h1='OnePiecedle Fruit du Démon — trouver le détenteur du fruit',
        body_key='seo.fruit.body',
        body='''
        <p>Le mode Fruit du Démon affiche le nom d'un des 118 fruits recensés dans le jeu et laisse retrouver
        son détenteur en dix essais. Pour les fruits célèbres, le nom seul suffit. Beaucoup d'autres
        appartiennent à des seconds rôles et demandent d'attendre les indices.</p>
        <p>Trois indices se débloquent au fil des erreurs, sans jamais consommer d'essai. Le type du fruit
        arrive à la troisième erreur, Paramecia, Logia ou Zoan. Sa traduction française à la cinquième. La
        description du pouvoir à la huitième. Chacun réduit le score de la manche.</p>
        <p>Le classement par type est celui de l'œuvre, Zoan mythiques compris. Quelques fruits acceptent
        deux réponses, lorsque l'histoire leur a donné deux porteurs successifs : les deux noms sont alors
        validés.</p>
        <p>Le fruit du jour est fixé à minuit, heure de Paris, et reste le même pour tous les joueurs
        jusqu'au lendemain. La partie est conservée dans le navigateur, ce qui permet de la reprendre plus
        tard sans rien perdre.</p>''',
        faq=[
            ("Combien de fruits du démon le jeu contient-il ?",
             "118, des fruits les plus connus à ceux croisés une seule fois dans un arc secondaire."),
            ("Les indices coûtent-ils un essai ?",
             "Non. Ils se débloquent seuls à la troisième, cinquième et huitième erreur. Ils réduisent le score de la manche, pas le nombre d'essais restants."),
            ("Un fruit peut-il avoir deux détenteurs valables ?",
             "Oui, pour les quelques fruits dont l'histoire a montré deux porteurs successifs. Les deux réponses sont acceptées."),
        ],
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
        body='''
        <p>Le mode Émoji résume un personnage One Piece en huit émojis choisis pour lui seul : un pouvoir,
        une arme, un animal, un lieu, un trait de caractère. Le premier est visible d'emblée, les suivants
        se dévoilent un par un à chaque erreur, sur huit essais au total.</p>
        <p>L'ordre change tous les jours. Les huit émojis sont mélangés par la graine du jour, si bien qu'un
        même personnage ne se dévoile jamais dans le même ordre et que l'émoji le plus parlant peut tomber
        en premier comme en dernier.</p>
        <p>Aucun émoji ne sert de simple décor. Les pastilles de couleur posées pour une teinte de cheveux
        sont écartées, sauf quand la couleur fait l'identité du personnage. Un même équipage ne partage
        jamais un bloc entier d'émojis, ce qui évite de tourner en rond entre ses membres.</p>
        <p>Après trois erreurs, un indice facultatif révèle l'arc de première apparition du personnage,
        contre une part du score. Le huitième et dernier essai se joue donc avec la série complète sous les
        yeux.</p>''',
        faq=[
            ("Combien d'émojis décrivent le personnage ?",
             "Huit, tous distincts. Un seul est visible au départ, les autres apparaissent un par un à chaque erreur."),
            ("Les émojis indiquent-ils la couleur des cheveux ?",
             "En principe non. Une pastille de couleur n'est retenue que lorsque la couleur fait l'identité du personnage, comme le roux de Shanks ou le magma d'Akainu."),
            ("L'ordre des émojis est-il toujours le même ?",
             "Non, il est mélangé chaque jour. Le même personnage proposé à deux dates différentes ne se dévoilera pas dans le même ordre."),
        ],
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
        body='''
        <p>Le mode Opening diffuse une seconde d'un des 29 génériques de la série animée. À chaque erreur
        l'extrait s'allonge : deux secondes, puis quatre, sept, onze, et seize au sixième et dernier
        essai.</p>
        <p>Le point de départ de l'extrait est tiré au sort chaque jour. Un même opening ne commence donc
        pas toujours au même endroit, et un refrain très connu peut très bien ne pas tomber dans la première
        seconde. C'est ce qui rend les premiers essais difficiles même pour qui connaît la bande-son par
        cœur.</p>
        <p>L'extrait se rejoue autant de fois que voulu sans consommer d'essai, et le volume se règle depuis
        le lecteur. Seule une proposition de réponse fait avancer la manche.</p>
        <p>La réponse attendue est le titre de l'opening, proposé par la saisie assistée dès les premières
        lettres. Le générique du jour est fixé à minuit, heure de Paris, et vaut pour tous les joueurs
        jusqu'au lendemain.</p>''',
        faq=[
            ("Combien de musique au premier essai ?",
             "Une seconde. L'extrait passe ensuite à deux, quatre, sept, onze puis seize secondes au fil des erreurs."),
            ("L'extrait démarre-t-il au début de l'opening ?",
             "Non. Le point de départ est tiré au sort chaque jour, ce qui change complètement la difficulté d'un même générique."),
            ("Peut-on réécouter sans perdre un essai ?",
             "Oui. Le bouton de lecture se rejoue librement. Seule une proposition de réponse consomme un essai."),
        ],
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
        body='''
        <p>Le mode Tome montre un détail très agrandi de la couverture d'un des 112 tomes présents dans le
        jeu. La vue recule à chaque erreur, jusqu'à la couverture entière au sixième et dernier essai.</p>
        <p>La réponse est un numéro compris entre 1 et 112. Chaque proposition indique si le tome cherché se
        situe plus haut ou plus bas, ce qui permet de l'encadrer par dichotomie. Six essais suffisent en
        théorie à couvrir toute la collection, à condition de couper l'intervalle en deux à chaque fois.</p>
        <p>Le détail initial porte souvent sur un aplat de couleur ou un fragment de logo, difficile à
        situer. Le dézoom fait ensuite apparaître les personnages en couverture, ce qui rattache le tome à un
        arc précis et resserre l'intervalle bien plus vite que le seul jeu du plus haut ou plus bas.</p>
        <p>C'est le seul mode quotidien dont la réponse est un nombre et non un nom, ce qui change la façon
        de jouer : la logique de recherche y compte davantage que la connaissance des personnages.</p>''',
        faq=[
            ("Combien d'essais dans le mode Tome ?",
             "Six. Le zoom recule d'un cran à chaque erreur, du détail de départ jusqu'à la couverture complète."),
            ("Comment savoir si le tome cherché est plus haut ou plus bas ?",
             "Chaque proposition affiche une flèche indiquant le sens. Couper l'intervalle en deux à chaque essai reste la méthode la plus sûre."),
            ("Combien de tomes peuvent tomber ?",
             "112, soit toutes les couvertures présentes dans le jeu. Le numéro attendu se situe donc entre 1 et 112."),
        ],
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
        body='''
        <p>Le mode Infini reprend la grille du mode Classique, avec les mêmes huit caractéristiques comparées
        à chaque essai et les mêmes dix tentatives, mais tire un personnage au hasard et se rejoue sans
        limite.</p>
        <p>Il sert avant tout d'entraînement. Enchaîner les parties fait retenir les primes, les affiliations
        et les arcs de première apparition, ce qui se ressent ensuite sur le défi quotidien. Les personnages
        secondaires, rarement tirés au quotidien, y reviennent beaucoup plus souvent.</p>
        <p>Ce mode reste en dehors du défi du jour. Il ne rapporte aucun point au score quotidien et n'entre
        pas dans le résultat partagé en fin de journée. Il tient son propre compteur : la série de victoires
        en cours et le meilleur record, conservés dans le navigateur.</p>
        <p>Une nouvelle partie est disponible immédiatement après chaque fin, sans attendre minuit et sans
        limite de nombre.</p>''',
        faq=[
            ("Le mode Infini compte-t-il dans le score quotidien ?",
             "Non. Il vit à côté du défi du jour, avec son propre compteur de série et son record."),
            ("Combien de parties peut-on enchaîner ?",
             "Autant que voulu. Chaque partie tire un nouveau personnage au hasard parmi les 266 du jeu."),
            ("Les règles sont-elles celles du mode Classique ?",
             "Oui, la grille et les dix essais sont identiques. Seule la sélection change : au hasard, et sans lien avec la journée en cours."),
        ],
    ),

}

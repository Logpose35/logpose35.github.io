# -*- coding: utf-8 -*-
"""
pages.py — Table des pages de contenu hors jeu (à propos, mentions légales,
confidentialité) + leur contenu éditorial FR et EN.

Source UNIQUE partagée par :
  • tools/gen_docs.py   (génère /<fr_slug>/index.html ET /en/<en_slug>/index.html)
  • tools/gen_en.py     (réécrit les liens de pied de page vers /en/…)

Pourquoi ces pages existent
---------------------------
AdSense a refusé le site le 28/08/2026 pour « contenu à faible valeur
informative ». Le site n'avait AUCUNE page de confiance : ni mentions légales,
ni politique de confidentialité, ni page « à propos » indexable (le « À propos »
n'était qu'une modale, invisible d'un robot comme d'un examinateur).

Les mentions légales sont par ailleurs obligatoires en France (LCEN art. 6-III),
indépendamment de toute publicité.

Contrairement aux pages de mode, ces pages ne chargent PAS le moteur de jeu :
pas de data.json, pas d'app.js. Juste du texte, le thème et le sélecteur de
langue. D'où un générateur distinct de gen_modes.py.

⚠️ ÉDITEUR — statut non professionnel
--------------------------------------
La page mentions légales utilise la forme prévue par la LCEN art. 6-III-2 pour
un éditeur NON professionnel : l'identité peut rester non publiée dès lors
qu'elle est tenue à la disposition de l'hébergeur. C'est valable pour un projet
personnel sans revenu.

Le jour où la publicité rapporte, l'édition devient professionnelle au sens de
la loi et l'identité complète (nom, prénom, adresse) doit alors figurer sur
cette page. Voir EDITEUR_PRO plus bas.
"""

# Adresse de contact publiée. C'est déjà celle du formulaire de signalement
# (REPORT_MAIL_TO côté serveur). La publier expose au moissonnage par les
# robots à spam : c'est le prix d'une voie de contact lisible, exigée aussi
# bien par la LCEN que par les examinateurs AdSense.
CONTACT = 'contact@onepiecedle.fr'

# Passer à True et remplir IDENTITE le jour où le site dégage un revenu
# (publicité comprise) : l'éditeur devient alors professionnel au sens de la
# LCEN et son identité complète doit être publiée.
EDITEUR_PRO = False
IDENTITE = ''   # ex. 'Prénom Nom, 12 rue Exemple, 75000 Paris'

DOCS = [
    dict(id='about',   fr_slug='a-propos',        en_slug='about'),
    dict(id='legal',   fr_slug='mentions-legales', en_slug='legal-notice'),
    dict(id='privacy', fr_slug='confidentialite',  en_slug='privacy'),
]

BY_ID = {d['id']: d for d in DOCS}


# ============================================================================
# CONTENU
#
# Formulation IMPERSONNELLE (pas de tutoiement), phrases courtes.
# Chiffres relus dans data.json / focus.json / js/app.js le 28/08/2026.
# Chaque page existe en FR et en EN : le texte anglais est écrit, pas traduit
# à la volée par le dictionnaire i18n (ces pages ne chargent pas js/i18n.js).
# ============================================================================

CONTENT = {}

# ---------------------------------------------------------------- À PROPOS --

CONTENT['about'] = dict(
    fr=dict(
        title='À propos de OnePiecedle — qui fait le jeu et comment · LogPose',
        desc='OnePiecedle (LogPose) est un jeu quotidien One Piece gratuit, sans '
             'inscription. Origine du projet, choix des réponses, sources des données '
             'et signalement des erreurs.',
        h1='À propos de OnePiecedle',
        body='''
<p class="doc-lead">OnePiecedle, aussi appelé LogPose, est un jeu de devinettes quotidien
consacré à One Piece. Sept défis par jour, un mode d'entraînement illimité et un mode duel
en un contre un. Gratuit, sans inscription, sans application à installer.</p>

<h2>Le projet</h2>
<p>Le site est développé et maintenu par une seule personne, sur son temps libre, depuis
mai 2026. C'est un projet de fan, sans but lucratif à l'origine et sans aucun lien avec
les ayants droit de l'œuvre.</p>
<p>Il n'y a ni compte à créer, ni newsletter, ni application à télécharger. Une partie se
joue dans le navigateur et la progression reste sur l'appareil. Le site fonctionne aussi
hors connexion une fois la page chargée une première fois.</p>

<h2>Comment la réponse du jour est choisie</h2>
<p>Les sept réponses quotidiennes sont fixées à l'avance, jour par jour, dans un calendrier
figé. Elles basculent à minuit, heure de Paris, et restent identiques pour tous les joueurs
jusqu'au lendemain. Personne ne voit une réponse différente selon son fuseau horaire ou son
appareil.</p>
<p>Une fois une journée passée, sa réponse ne change plus, même si de nouveaux personnages
entrent dans le jeu. C'est ce qui permet de rejouer une journée écoulée et de consulter
l'archive des réponses passées.</p>

<h2>Les données</h2>
<p>Le jeu s'appuie sur une base de 266 personnages, 118 fruits du démon, 112 tomes, 29
génériques et 33 arcs narratifs. Chaque fiche de personnage porte huit caractéristiques :
genre, affiliation, origine, fruit du démon, haki, statut, arc de première apparition et
prime.</p>
<p>Ces informations sont relevées à la main depuis le manga, la série animée et les
encyclopédies de référence, puis recoupées. Les fiches sont relues périodiquement : une
relecture complète des 266 personnages a été menée en août 2026.</p>

<h2>Signaler une erreur</h2>
<p>Une prime obsolète, un arc de première apparition discutable, une silhouette
méconnaissable : les erreurs existent et les signalements sont utiles. Un formulaire est
accessible depuis le pied de page de chaque partie, ou directement par courriel à
<a href="mailto:{CONTACT}">{CONTACT}</a>.</p>
<p>Les corrections de fiches sont appliquées de préférence après minuit, pour ne pas
modifier une partie en cours chez les joueurs.</p>

<h2>One Piece</h2>
<p>One Piece est une œuvre d'Eiichiro Oda, publiée par Shueisha et adaptée en série animée
par Toei Animation. OnePiecedle est un projet de fan indépendant, sans affiliation ni
approbation de ces ayants droit. Les noms, images et éléments de l'univers restent la
propriété de leurs détenteurs respectifs.</p>
''',
    ),
    en=dict(
        title='About OnePiecedle — who makes the game and how · LogPose',
        desc='OnePiecedle (LogPose) is a free daily One Piece game, no signup required. '
             'How the project started, how answers are chosen, where the data comes from '
             'and how to report a mistake.',
        h1='About OnePiecedle',
        body='''
<p class="doc-lead">OnePiecedle, also known as LogPose, is a daily guessing game built around
One Piece. Seven challenges a day, an unlimited practice mode and a one-on-one duel mode.
Free, no signup, nothing to install.</p>

<h2>The project</h2>
<p>The site is built and maintained by one person, in their spare time, since May 2026. It is
a fan project, started with no commercial purpose and with no connection to the rights holders
of the work.</p>
<p>There is no account to create, no newsletter and no app to download. A game is played in
the browser and progress stays on the device. The site also works offline once the page has
loaded a first time.</p>

<h2>How the daily answer is chosen</h2>
<p>The seven daily answers are set in advance, day by day, in a fixed calendar. They roll over
at midnight Paris time and stay identical for every player until the next day. Nobody sees a
different answer depending on their timezone or device.</p>
<p>Once a day has passed, its answer never changes, even when new characters enter the game.
That is what makes it possible to replay a past day and to browse the archive of past
answers.</p>

<h2>The data</h2>
<p>The game draws on a base of 266 characters, 118 Devil Fruits, 112 volumes, 29 opening themes
and 33 story arcs. Every character sheet carries eight attributes: gender, affiliation, origin,
Devil Fruit, Haki, status, first arc and bounty.</p>
<p>This information is collected by hand from the manga, the anime and reference encyclopedias,
then cross-checked. Sheets are reviewed periodically: a full pass over all 266 characters was
carried out in August 2026.</p>

<h2>Reporting a mistake</h2>
<p>An out-of-date bounty, a debatable first arc, an unrecognizable silhouette: mistakes happen
and reports genuinely help. A form is available from the footer of every game, or you can write
directly to <a href="mailto:{CONTACT}">{CONTACT}</a>.</p>
<p>Corrections to character sheets are applied after midnight where possible, so that a game
already in progress is never altered.</p>

<h2>One Piece</h2>
<p>One Piece is a work by Eiichiro Oda, published by Shueisha and adapted into an animated
series by Toei Animation. OnePiecedle is an independent fan project, with no affiliation to or
endorsement from those rights holders. Names, images and elements of the universe remain the
property of their respective owners.</p>
''',
    ),
)

# -------------------------------------------------------- MENTIONS LÉGALES --

CONTENT['legal'] = dict(
    fr=dict(
        title='Mentions légales — OnePiecedle · LogPose',
        desc='Mentions légales du site OnePiecedle (LogPose) : éditeur, hébergement, '
             'propriété intellectuelle et contact.',
        h1='Mentions légales',
        body='''
<p class="doc-lead">Informations requises par l'article 6-III de la loi n° 2004-575 du
21 juin 2004 pour la confiance dans l'économie numérique.</p>

<h2>Éditeur du site</h2>
<p>Le site <strong>onepiecedle.fr</strong> est édité à titre personnel et non professionnel,
sans but lucratif.</p>
<p>Conformément à l'article 6-III-2 de la même loi, l'éditeur non professionnel qui souhaite
préserver son anonymat tient son identité à la disposition de l'hébergeur. Toute demande
relevant de ces dispositions peut être adressée à
<a href="mailto:{CONTACT}">{CONTACT}</a>.</p>
<p>Directeur de la publication : l'éditeur du site.</p>

<h2>Hébergement</h2>
<p>Les pages du site sont hébergées par :</p>
<ul>
  <li><strong>GitHub, Inc.</strong> (GitHub Pages), 88 Colin P. Kelly Jr. Street,
      San Francisco, CA 94107, États-Unis.</li>
</ul>
<p>Les fichiers volumineux (images, silhouettes, extraits audio) et le service du mode Versus
sont hébergés par :</p>
<ul>
  <li><strong>OVH SAS</strong>, 2 rue Kellermann, 59100 Roubaix, France.</li>
</ul>

<h2>Propriété intellectuelle</h2>
<p>One Piece est une œuvre d'Eiichiro Oda, publiée par Shueisha et adaptée en série animée par
Toei Animation. Les noms, personnages, images, couvertures et musiques issus de cette œuvre
demeurent la propriété exclusive de leurs ayants droit.</p>
<p>OnePiecedle est un projet de fan indépendant, sans affiliation, partenariat ni approbation
de Shueisha, Toei Animation ou de tout autre détenteur de droits. Il n'est ni un produit
officiel, ni une source d'information officielle.</p>
<p>Tout ayant droit qui souhaiterait le retrait d'un contenu peut en faire la demande à
<a href="mailto:{CONTACT}">{CONTACT}</a>. Les demandes fondées sont traitées sans délai.</p>
<p>Le code du site, ses textes éditoriaux et son interface sont l'œuvre de l'éditeur.</p>

<h2>Responsabilité</h2>
<p>Le site est proposé en l'état, à titre de divertissement. Les informations sur les
personnages sont relevées à la main et peuvent comporter des erreurs ou devenir obsolètes au
fil de la parution. Elles n'ont aucune valeur de référence.</p>
<p>Le site peut être interrompu à tout moment, notamment pour maintenance, sans préavis ni
indemnité.</p>

<h2>Liens externes</h2>
<p>Certaines pages renvoient vers des sites tiers, notamment YouTube pour le visionnage des
génériques. L'éditeur n'exerce aucun contrôle sur ces sites et décline toute responsabilité
quant à leur contenu.</p>

<h2>Contact</h2>
<p>Pour toute question relative au site, à ses données ou à ces mentions :
<a href="mailto:{CONTACT}">{CONTACT}</a>.</p>
''',
    ),
    en=dict(
        title='Legal notice — OnePiecedle · LogPose',
        desc='Legal notice for OnePiecedle (LogPose): publisher, hosting, intellectual '
             'property and contact details.',
        h1='Legal notice',
        body='''
<p class="doc-lead">Information required under article 6-III of French law no. 2004-575 of
21 June 2004 on confidence in the digital economy.</p>

<h2>Site publisher</h2>
<p>The site <strong>onepiecedle.fr</strong> is published on a personal, non-professional and
non-commercial basis.</p>
<p>Under article 6-III-2 of the same law, a non-professional publisher who wishes to remain
anonymous keeps their identity available to the host. Any request falling under those
provisions may be sent to <a href="mailto:{CONTACT}">{CONTACT}</a>.</p>
<p>Publication director: the site publisher.</p>

<h2>Hosting</h2>
<p>The pages of the site are hosted by:</p>
<ul>
  <li><strong>GitHub, Inc.</strong> (GitHub Pages), 88 Colin P. Kelly Jr. Street,
      San Francisco, CA 94107, United States.</li>
</ul>
<p>Large files (images, silhouettes, audio clips) and the Versus mode service are hosted by:</p>
<ul>
  <li><strong>OVH SAS</strong>, 2 rue Kellermann, 59100 Roubaix, France.</li>
</ul>

<h2>Intellectual property</h2>
<p>One Piece is a work by Eiichiro Oda, published by Shueisha and adapted into an animated
series by Toei Animation. Names, characters, images, covers and music from that work remain the
exclusive property of their rights holders.</p>
<p>OnePiecedle is an independent fan project, with no affiliation, partnership or endorsement
from Shueisha, Toei Animation or any other rights holder. It is neither an official product nor
an official source of information.</p>
<p>Any rights holder wishing to have content removed may request it at
<a href="mailto:{CONTACT}">{CONTACT}</a>. Well-founded requests are handled without delay.</p>
<p>The site code, its editorial texts and its interface are the work of the publisher.</p>

<h2>Liability</h2>
<p>The site is provided as is, for entertainment. Character information is collected by hand and
may contain errors or become out of date as the work is published. It carries no reference
value.</p>
<p>The site may be interrupted at any time, in particular for maintenance, without notice or
compensation.</p>

<h2>External links</h2>
<p>Some pages link to third-party sites, notably YouTube for watching opening themes. The
publisher exercises no control over those sites and accepts no responsibility for their
content.</p>

<h2>Contact</h2>
<p>For any question about the site, its data or this notice:
<a href="mailto:{CONTACT}">{CONTACT}</a>.</p>
''',
    ),
)

# ---------------------------------------------------------- CONFIDENTIALITÉ --

CONTENT['privacy'] = dict(
    fr=dict(
        title='Politique de confidentialité — OnePiecedle · LogPose',
        desc='Ce que OnePiecedle (LogPose) stocke, ce qu\'il n\'envoie pas, et les services '
             'tiers utilisés. Aucun compte, aucune inscription, aucune revente de données.',
        h1='Politique de confidentialité',
        body='''
<p class="doc-lead">OnePiecedle ne demande ni compte, ni inscription, ni adresse électronique
pour jouer. Le site ne constitue aucun profil de joueur et ne revend aucune donnée. Cette page
décrit précisément ce qui est stocké et ce qui transite vers des tiers.</p>

<h2>Ce qui reste sur l'appareil</h2>
<p>La progression et les préférences sont enregistrées dans le stockage local du navigateur.
Ces données ne quittent jamais l'appareil : elles ne sont envoyées à aucun serveur, y compris
celui du site.</p>
<ul>
  <li>les préférences d'affichage : thème clair ou sombre, taille du texte, mode daltonien,
      effets sonores ;</li>
  <li>les parties du jour en cours ou terminées, mode par mode ;</li>
  <li>les statistiques personnelles : parties jouées, victoires, séries en cours et
      records ;</li>
  <li>le score quotidien et l'historique des journées jouées ;</li>
  <li>le bilan des duels du mode Versus ;</li>
  <li>quelques indicateurs d'interface, par exemple une annonce déjà lue.</li>
</ul>
<p>Vider les données de site du navigateur efface l'ensemble. Cette suppression est définitive
et fait perdre la progression, puisqu'il n'existe aucune copie côté serveur. Une sauvegarde
peut être exportée puis réimportée depuis les réglages du jeu.</p>

<h2>Compteurs anonymes</h2>
<p>Le site tient un compteur du nombre de parties terminées par jour et par mode, ainsi qu'un
compteur collectif de progression sur la carte. Ces compteurs sont de simples nombres, stockés
chez <strong>Google Firebase</strong> sur des serveurs situés dans l'Union européenne
(europe-west1).</p>
<p>Aucun identifiant, aucune adresse IP et aucune donnée de partie ne leur est associé. Il est
impossible d'en déduire qui a joué, ni quoi.</p>

<h2>Formulaire de signalement</h2>
<p>Le formulaire de signalement d'erreur transmet le message rédigé, la catégorie choisie et la
page d'origine à un serveur géré par l'éditeur, hébergé en France. Le message est ensuite
relayé par courriel à l'éditeur.</p>
<p>L'adresse IP est utilisée le temps de la requête pour limiter les envois abusifs, sans être
conservée dans un registre. Renseigner une adresse de contact est facultatif : sans elle, le
signalement reste anonyme, mais aucune réponse n'est possible.</p>

<h2>Services tiers</h2>
<p>Consulter le site implique des échanges avec les services suivants, qui reçoivent à cette
occasion l'adresse IP et des informations techniques sur le navigateur.</p>
<ul>
  <li><strong>Google Fonts</strong> : chargement des polices d'écriture.</li>
  <li><strong>Google AdSense</strong> : régie publicitaire. Son script est chargé sur les
      pages en vue d'une activation. Une fois la publicité active, ce service dépose des
      cookies et lit ceux qu'il a déposés, pour mesurer l'audience des annonces et, selon le
      consentement, les personnaliser.</li>
  <li><strong>Google Firebase</strong> : compteurs anonymes décrits plus haut.</li>
  <li><strong>YouTube</strong> et <strong>AnimeThemes</strong> : visionnage du générique,
      proposé uniquement à la fin d'une partie du mode Opening. Rien n'est chargé avant.</li>
  <li><strong>jsDelivr</strong> : bibliothèque d'affichage 3D de la page d'accueil.</li>
  <li><strong>assets.onepiecedle.fr</strong> et <strong>multi.onepiecedle.fr</strong> :
      serveurs de l'éditeur, hébergés en France, pour les images, les extraits audio et le
      mode Versus.</li>
</ul>

<h2>Cookies</h2>
<p>Le site n'utilise aucun cookie pour son propre fonctionnement : le stockage local décrit
plus haut n'en est pas un et n'est jamais transmis.</p>
<p>Aucune annonce n'est diffusée à ce jour et aucun emplacement publicitaire n'est placé sur
les pages. Avant toute diffusion, un bandeau de consentement sera présenté aux visiteurs de
l'Union européenne. Le refus y sera aussi simple que l'acceptation et modifiable à tout
moment. Refuser n'empêchera pas de jouer : aucune fonctionnalité du jeu n'en dépend.</p>

<h2>Mode Versus</h2>
<p>Une partie en duel ouvre une connexion vers le serveur de l'éditeur. Ce serveur ne conserve
la partie qu'en mémoire vive, le temps de la manche : le pseudonyme choisi, le code du salon et
les propositions faites. Tout disparaît à la fin de la partie et rien n'est écrit sur disque.
Le pseudonyme est libre et n'a pas à être un vrai nom.</p>

<h2>Mineurs</h2>
<p>Le site s'adresse à un large public et ne collecte volontairement aucune donnée permettant
d'identifier une personne, quel que soit son âge.</p>

<h2>Droits et contact</h2>
<p>Le site ne détenant aucune donnée nominative, il n'existe pas de dossier personnel à
consulter ou à supprimer : effacer les données de site du navigateur suffit à tout retirer.</p>
<p>Pour les cookies publicitaires, les droits s'exercent auprès de Google, qui en est
responsable. Pour toute question sur cette politique :
<a href="mailto:{CONTACT}">{CONTACT}</a>.</p>
''',
    ),
    en=dict(
        title='Privacy policy — OnePiecedle · LogPose',
        desc='What OnePiecedle (LogPose) stores, what it never sends, and which third-party '
             'services are used. No account, no signup, no data selling.',
        h1='Privacy policy',
        body='''
<p class="doc-lead">OnePiecedle asks for no account, no signup and no email address in order to
play. The site builds no player profile and sells no data. This page sets out exactly what is
stored and what travels to third parties.</p>

<h2>What stays on the device</h2>
<p>Progress and preferences are saved in the browser local storage. That data never leaves the
device: it is sent to no server, including the site own server.</p>
<ul>
  <li>display preferences: light or dark theme, text size, colorblind mode, sound effects;</li>
  <li>games for the current day, in progress or finished, mode by mode;</li>
  <li>personal statistics: games played, wins, current streaks and records;</li>
  <li>the daily score and the history of days played;</li>
  <li>the win-loss record for Versus duels;</li>
  <li>a few interface flags, such as an announcement already read.</li>
</ul>
<p>Clearing site data in the browser erases all of it. That deletion is permanent and loses your
progress, since no server-side copy exists. A save file can be exported and re-imported from the
game settings.</p>

<h2>Anonymous counters</h2>
<p>The site keeps a count of games finished per day and per mode, along with a collective
progress counter on the map. These counters are plain numbers, stored with
<strong>Google Firebase</strong> on servers located in the European Union (europe-west1).</p>
<p>No identifier, no IP address and no game data is attached to them. There is no way to work
out who played, or what.</p>

<h2>Report form</h2>
<p>The mistake report form sends the message written, the chosen category and the originating
page to a server run by the publisher and hosted in France. The message is then relayed by email
to the publisher.</p>
<p>The IP address is used for the duration of the request to limit abuse, and is not kept in a
log. Providing a contact address is optional: without one the report stays anonymous, but no
reply is possible.</p>

<h2>Third-party services</h2>
<p>Browsing the site involves exchanges with the following services, which receive the IP address
and technical information about the browser in the process.</p>
<ul>
  <li><strong>Google Fonts</strong>: loading the typefaces.</li>
  <li><strong>Google AdSense</strong>: advertising network. Its script is loaded on the pages
      ahead of a future activation. Once advertising is live, the service sets cookies and
      reads the ones it has set, in order to measure ad performance and, subject to consent,
      personalize them.</li>
  <li><strong>Google Firebase</strong>: the anonymous counters described above.</li>
  <li><strong>YouTube</strong> and <strong>AnimeThemes</strong>: watching the opening theme,
      offered only once an Opening round has ended. Nothing loads before that.</li>
  <li><strong>jsDelivr</strong>: the 3D display library on the home page.</li>
  <li><strong>assets.onepiecedle.fr</strong> and <strong>multi.onepiecedle.fr</strong>:
      the publisher own servers, hosted in France, for images, audio clips and Versus mode.</li>
</ul>

<h2>Cookies</h2>
<p>The site uses no cookie of its own: the local storage described above is not a cookie and is
never transmitted.</p>
<p>No advertising is served today and no ad slot is placed on the pages. Before anything is
served, a consent banner will be shown to visitors from the European Union. Refusing will be as
easy as accepting, and changeable at any time. Refusing will not prevent play: no game feature
depends on it.</p>

<h2>Versus mode</h2>
<p>A duel opens a connection to the publisher server. That server keeps the game in memory only,
for the length of the round: the chosen nickname, the room code and the guesses made. Everything
disappears when the game ends and nothing is written to disk. The nickname is free-form and need
not be a real name.</p>

<h2>Minors</h2>
<p>The site addresses a general audience and deliberately collects no data capable of identifying
a person, whatever their age.</p>

<h2>Rights and contact</h2>
<p>Since the site holds no personal data, there is no personal record to access or delete:
clearing site data in the browser removes everything.</p>
<p>For advertising cookies, rights are exercised with Google, which is responsible for them. For
any question about this policy: <a href="mailto:{CONTACT}">{CONTACT}</a>.</p>
''',
    ),
)


# ------------------------------------------------------------ PIED DE PAGE --
# Libellés des liens ajoutés au pied de page de TOUTES les pages du site.
# Le FR est la clé i18n : gen_en traduit les pages de jeu via i18n/en.json,
# donc ces trois chaînes doivent y figurer.

# « Le projet » et non « À propos » : le pied de page du jeu et celui de la
# landing portent DÉJÀ un bouton « À propos » qui ouvre la modale du jeu. Deux
# entrées du même nom, l'une ouvrant une modale et l'autre changeant de page,
# se marcheraient dessus. La page garde son <h1> « À propos de OnePiecedle »,
# qui est ce que Google indexe.
FOOT_LINKS = [
    dict(id='about',   fr='Le projet',         en='The project'),
    dict(id='legal',   fr='Mentions légales',  en='Legal notice'),
    dict(id='privacy', fr='Confidentialité',   en='Privacy'),
]


def foot_html(lang='fr'):
    """Bloc de liens légaux du pied de page, dans la langue demandée."""
    parts = []
    for l in FOOT_LINKS:
        d = BY_ID[l['id']]
        href = '/%s/' % d['fr_slug'] if lang == 'fr' else '/en/%s/' % d['en_slug']
        parts.append('<a href="%s">%s</a>' % (href, l[lang]))
    return '<span class="foot-legal">%s</span>' % ' · '.join(parts)

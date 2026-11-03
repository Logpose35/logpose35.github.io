# Textes éditoriaux des pages d'arcs. Rédigés à la main, sans tiret quadratin.
# Chaque entrée : arc (nom exact dans data.json ARCS), description (meta),
# chapo, sections (HTML), note_jeu (HTML, après les fiches).

TEXTES = {}
TEXTES.update({

'alabasta': {
'arc': 'Alabasta',
'description': "Résumé de l'arc Alabasta de One Piece (chapitres 155 à 217) : le complot de Crocodile, la rébellion, les combats contre Baroque Works et les personnages qui y font leurs débuts.",
'bref': [
  ('Chapitres', '155 à 217'),
  ('Lieu', "Royaume d'Alabasta, île désertique de Grand Line"),
  ('Adversaire', 'Crocodile (Mr. 0) et Baroque Works'),
  ('Enjeu', 'Empêcher une guerre civile provoquée de toutes pièces'),
  ('Primes après l\'arc', 'Luffy 100 M · Zoro 60 M (sa première)'),
],
'chapo': "Alabasta clôt la première grande saga de Grand Line. Un royaume du désert au bord de la "
         "guerre civile, une organisation secrète qui tire les ficelles, et un Grand Corsaire que "
         "personne n'ose soupçonner : c'est le premier arc où l'équipage affronte un adversaire "
         "d'envergure mondiale. Il couvre les chapitres 155 à 217 du manga.",
'sections': [
"""  <h2>Le contexte</h2>
  <p>Depuis Reverse Mountain, l'équipage voyage avec Nefertari Vivi, princesse d'Alabasta infiltrée
  sous le nom de Miss Wednesday dans Baroque Works. Elle y a découvert que l'organisation prépare la
  chute de son pays, et que son chef, Mr. 0, n'est autre que Crocodile, l'un des sept Grands Corsaires,
  adulé par la population pour ses victoires contre les pirates.</p>
  <p>Le plan de Crocodile est patient. Une poudre, la Dance Powder, fait tomber la pluie sur une ville en
  l'asséchant ailleurs. Utilisée en secret, elle prive le royaume de pluie pendant trois ans, tandis que
  des agents laissent croire que le roi Cobra en est responsable. La rébellion menée par Kohza, ami
  d'enfance de Vivi, grossit jusqu'à compter des centaines de milliers d'hommes.</p>""",
"""  <h2>Le déroulement</h2>
  <h3>La traversée du désert</h3>
  <p>L'arrivée de l'équipage coïncide avec celle de Portgas D. Ace, frère de Luffy, lancé sur la piste de
  Barbe Noire, et avec la poursuite du capitaine Smoker. La traversée du désert jusqu'à Yuba, oasis
  ensevelie par les tempêtes de sable, montre l'ampleur de la sécheresse.</p>
  <h3>Les duels d'Alubarna</h3>
  <p>À Alubarna, la capitale, rebelles et armée royale s'affrontent pendant que les agents de Baroque
  Works sont répartis face aux membres de l'équipage. Zoro apprend à trancher l'acier contre Mr. 1,
  Nami découvre son Clima-Tact face à Miss Doublefinger, Sanji tient tête à Mr. 2 Bon Clay, tandis
  qu'Usopp et Chopper viennent à bout de Mr. 4 et Miss Merry Christmas.</p>
  <h3>Luffy contre Crocodile</h3>
  <p>Luffy affronte Crocodile à trois reprises. Le sable rend le Corsaire insaisissable ; il faut de
  l'eau, puis le sang de Luffy lui-même, pour le toucher. Pendant ce temps, Pell emporte au ciel une
  bombe destinée à raser la place de la capitale, et la pluie retombe enfin sur le royaume.</p>""",
"""  <h2>Ce que l'arc change pour la suite</h2>
  <p>Alabasta pose plusieurs fils qui ne seront tirés que bien plus tard. Crocodile cherchait Pluton,
  une arme antique mentionnée sur un Ponéglyphe caché sous le palais. Nico Robin, alors Miss All Sunday
  et associée de Crocodile, lit ce Ponéglyphe et rejoint ensuite l'équipage. Le Gouvernement mondial,
  lui, préfère étouffer l'affaire et attribuer la victoire à la Marine.</p>
  <p>Les primes suivent : celle de Luffy passe à 100 millions de berrys et Zoro reçoit sa première, à
  60 millions. Vivi choisit de rester dans son royaume. Les adieux sur le quai, bras levés et marque
  en croix sur l'avant-bras, restent l'une des scènes les plus citées de la série.</p>""",
],
'note_jeu': """  <p>Deux absences surprennent souvent dans cette liste. <strong>Vivi</strong> compte pour Reverse Mountain,
  où elle apparaît sous le nom de Miss Wednesday, et <strong>Crocodile</strong> pour Little Garden. Dans le
  mode Classique, une flèche vers le bas sur un perso d'Alabasta oriente donc vers ces arcs plus anciens.
  Pour s'entraîner à <a href="/classique/">deviner le personnage One Piece du jour</a>, ce genre de repère
  fait gagner plusieurs essais. Les journées passées et leurs solutions figurent dans
  <a href="/reponses/">l'archive des réponses One Piece dle</a>, publiée le lendemain.</p>""",
},

'enies-lobby': {
'arc': 'Enies Lobby',
'description': "Résumé de l'arc Enies Lobby de One Piece (chapitres 375 à 430) : le sauvetage de Nico Robin, le CP9, le passé d'Ohara et les personnages qui y font leurs débuts.",
'bref': [
  ('Chapitres', '375 à 430'),
  ('Lieu', 'Enies Lobby, île judiciaire du Gouvernement mondial'),
  ('Adversaire', 'Spandam et le CP9, mené par Rob Lucci'),
  ('Enjeu', 'Arracher Nico Robin au Gouvernement mondial'),
  ('Primes après l\'arc', 'Luffy 300 M · Zoro 120 M · Robin 80 M'),
],
'chapo': "Enies Lobby est l'arc où l'équipage déclare la guerre au Gouvernement mondial. Pour "
         "récupérer Nico Robin, livrée au CP9, Luffy et les siens prennent d'assaut l'île judiciaire "
         "et brûlent le drapeau du Gouvernement. Il suit directement Water 7 et couvre les chapitres "
         "375 à 430 du manga.",
'sections': [
"""  <h2>Le contexte</h2>
  <p>À la fin de Water 7, Nico Robin quitte l'équipage sans explication et se rend au CP9, l'unité
  d'agents secrets qui avait infiltré la ville pendant des années. Son marché est simple : sa liberté
  contre la vie de ses compagnons, que le Gouvernement menace d'un Buster Call. Elle est emmenée avec
  Franky, détenteur des plans de Pluton, vers Enies Lobby, île de justice où les condamnés transitent
  vers Impel Down ou le Quartier général de la Marine.</p>""",
"""  <h2>Le déroulement</h2>
  <h3>L'assaut</h3>
  <p>L'équipage, rejoint par la Franky Family et les charpentiers de Galley-La, embarque sur le Rocketman,
  un train des mers lancé à pleine vitesse. Usopp, qui a quitté l'équipage après son duel contre Luffy,
  revient masqué sous l'identité de Sogeking, le roi des tireurs d'élite.</p>
  <p>Sur l'île, les géants Oimo et Kashii gardent la porte principale depuis cinquante ans, convaincus
  d'avoir été promis à la libération de leur capitaine. Le mensonge révélé, ils retournent leur arme
  contre la Marine. Devant la Tour de la Justice, Robin finit par crier ce qu'elle taisait depuis
  l'enfance : elle veut vivre. Luffy répond en faisant abattre le drapeau du Gouvernement mondial.</p>
  <h3>Les duels contre le CP9</h3>
  <p>Chaque membre de l'équipage affronte un agent du CP9, dont la plupart maîtrisent le Rokushiki et
  plusieurs un fruit Zoan : Jabra se transforme en loup, Kaku en girafe, Lucci en léopard. Luffy
  dévoile contre Blueno ses techniques Gear Second et Gear Third, qu'il pousse à bout face à Lucci.</p>""",
"""  <h2>Le passé d'Ohara</h2>
  <p>L'arc dévoile enfin l'histoire de Robin. Enfant, elle vivait à Ohara, île d'archéologues qui
  étudiaient en secret les Ponéglyphes. Le professeur Clover y dirigeait les recherches, et sa mère,
  Nico Olvia, revenait d'années de voyage. Le Gouvernement déclencha un Buster Call pour effacer l'île
  de la carte. Le géant Jaguar D. Saul, vice-amiral déserteur, protégea la fillette et lui apprit à rire
  avant de lui faire quitter l'île.</p>""",
"""  <h2>Ce que l'arc change pour la suite</h2>
  <p>Le Buster Call lancé par Spandam frappe Enies Lobby elle-même, avec cinq vice-amiraux dont Momonga.
  L'équipage s'échappe de justesse grâce au Vogue Merry, venu seul les chercher, qui sombre ensuite lors
  de funérailles par le feu restées célèbres. Franky rejoint l'équipage et construira son successeur,
  le Thousand Sunny.</p>
  <p>Les primes de tout l'équipage sont relevées : 300 millions de berrys pour Luffy, et même une prime
  au nom de Sogeking, qu'Usopp n'est pas près d'oublier.</p>""",
],
'note_jeu': """  <p>Les agents les plus connus du CP9, comme <strong>Rob Lucci</strong>, <strong>Kaku</strong>,
  <strong>Kalifa</strong> et <strong>Blueno</strong>, ne figurent pas ici : ils apparaissent dès Water 7, sous
  leur couverture d'employés de Galley-La ou de barman. Dans le jeu, l'affiliation CP0 signale qu'ils ont
  depuis rejoint l'unité d'élite du Gouvernement. Pour <a href="/classique/">deviner le personnage One Piece
  du jour</a>, Water 7 et Enies Lobby sont donc à distinguer. Les solutions des journées passées sont
  dans <a href="/reponses/">l'archive des réponses One Piece dle</a>, publiée le lendemain.</p>""",
},

})

from textes_lot1 import LOT1
from textes_lot2 import LOT2
from textes_lot3 import LOT3
for _lot in (LOT1, LOT2, LOT3):
    TEXTES.update(_lot)

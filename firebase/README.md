# Règles de la Realtime Database

`database.rules.json` est la **source versionnée** des règles. Elles ne sont pas
déployées automatiquement : il faut les coller dans la console Firebase
(Realtime Database → Règles → Publier).

## Ce qu'elles font

**Racine fermée, explicitement.** Les règles d'avant n'ouvraient déjà que les
trois chemins publics ci-dessous, tout le reste étant refusé par défaut : il n'y
avait donc pas de trou à refermer, contrairement à ce que cette page affirmait
d'abord. Le `false` posé à la racine ne change pas le comportement, il rend la
règle lisible plutôt qu'implicite.

**Les trois chemins publics existants restent inchangés** — lecture et écriture
libres, exactement comme aujourd'hui :

| Chemin | Écrit par | Rôle |
|---|---|---|
| `counters/{date}/{mode}` | `js/app.js`, lu par `js/landing.js` | compteur de parties du jour |
| `daily-stats/{date}/…` | `js/app.js` (`onGameEnd`) | gagnants, essais moyens, agrégat `_day` |
| `island-reach/{arc}` | `js/map.js` | compteur communauté de la carte |

⚠️ Les trois y sont : oublier `counters/` casserait le compteur de la landing
**sans aucune erreur visible**, la lecture renvoyant simplement `null`.

**`saves/{uid}` : privé, par compte.** Lisible et écrivable seulement par son
propriétaire authentifié. Ce qu'on y stocke ne contient **aucune donnée
nominative** : ni e-mail, ni nom, ni photo. L'adresse reste dans Firebase Auth,
chez Google, hors de cette base. Si ces règles étaient un jour mal republiées,
ce qui fuiterait serait une progression de jeu, pas une identité.

**`pseudos/{nom}` : l'unicité des pseudos.** Une case porte l'uid de son
propriétaire. Écrire n'est permis que si la case est **vide ou déjà à nous** —
c'est cette règle, et elle seule, qui garantit qu'un pseudo n'est pris qu'une
fois ; le client ne fait que présenter proprement ce que la base décide. La clé
est en **minuscules** (l'unicité ignore la casse), la casse d'affichage vit dans
`saves/{uid}/meta/pseudo`.

Le `.read` est posé sur `{nom}`, pas sur `pseudos` : on peut demander « ce nom
est-il libre ? », on ne peut pas **énumérer** l'index ni en tirer une table
uid → pseudo.

Cette lecture est **publique depuis le 09/09/2026** (`.read: true`, elle exigeait
un compte avant). Le serveur Versus en a besoin pour refuser qu'un visiteur
prenne le pseudo réservé de quelqu'un d'autre, et il n'a **aucun identifiant
Firebase** : il vérifie des jetons, il n'en émet pas (voir
`server/firebase-token.js`, volontairement sans SDK Admin ni clé de service).
Ça n'expose rien de neuf : la correspondance uid → pseudo est **déjà publique**
par `leaderboard/{jour}`, dont les clés sont des uid et le champ `n` le pseudo,
en `.read: true`. Et l'anti-énumération tient toujours — c'est le niveau
`pseudos` qui l'interdit, et il n'a pas bougé.

**`pseudo-delai/{uid}` : un changement de pseudo par 24 h.** Deux règles qui se
tiennent l'une l'autre :

- `pseudo-delai/{uid}` n'accepte une écriture que si la précédente date de plus
  d'un jour, **ne peut jamais être supprimé** (`newData.exists()` dans le
  `.write`, sinon il suffirait de l'effacer pour repartir à zéro), et sa valeur
  doit être l'horloge du serveur (`newData.val() === now`) — donc pas
  d'antidatage.
- `pseudos/{nom}` n'accepte une réservation que si cet horodatage vient d'être
  posé **dans la même écriture** (`newData.parent().parent().child('pseudo-delai')
  .child(auth.uid).val() === now`).

Réserver sans déclencher le délai devient donc impossible. C'est pour ça que
`claimPseudo()` fait **un seul PATCH à la racine** portant le nom, l'horodatage
et le nom affiché : trois écritures séparées seraient refusées. Effet de bord
bienvenu, il n'y a plus d'état intermédiaire où la case serait prise sans que le
compte porte le nom.

Une **suppression** est exemptée du contrôle : libérer son propre pseudo reste
possible à tout moment. Ça n'ouvre rien — reprendre un nom exige toujours un
horodatage frais, que la première règle refuse avant 24 h.

⚠️ Conséquence à connaître : **un pseudo mal orthographié est figé pour 24 h.**
Le seul recours est de supprimer `pseudo-delai/{uid}` depuis l'onglet Données de
la console — les écritures de la console passent outre les règles.

**`leaderboard/{date}/{uid}` : le classement du jour.** Lecture **publique**
d'une journée — un visiteur sans compte voit le classement, c'est ce qui donne
envie d'en créer un. Là encore, `leaderboard` tout entier reste fermé : pas
d'aspiration de toutes les journées d'un coup.

L'écriture est bornée par la règle, pas par le client :

| Contrainte | Effet |
|---|---|
| `n` doit **égaler** `saves/{auth.uid}/meta/pseudo` | impossible de se présenter sous l'identité d'un autre, ni d'écrire autre chose qu'un pseudo au format connu |
| `n` doit matcher `^[a-zA-Z0-9_-]{3,16}$` | aucun balisage ne peut entrer dans la base |
| `s` : nombre, `0 ≤ s ≤ 70000` | 7 modes × 10 000, le plafond de la barre de score |
| `t` : nombre (posé par le serveur, `.sv`) | départage les égalités, et n'est pas falsifiable côté client |
| `$autre` : `.validate: false` | aucun champ en trop |
| `$uid === auth.uid` | on n'écrit que dans sa propre case |

Conséquence voulue : **pas de classement sans pseudo réservé.** C'est l'avantage
du compte, et c'est aussi ce qui empêche un bot de remplir la liste de noms
jetables.

## Forme d'une sauvegarde

```
saves/{uid}/meta/{ v, updatedAt, pseudo }
saves/{uid}/days/{2026-9-8}/{ "op-gs-classic-2026-9-8": "…", "op-score-2026-9-8": "…", … }
saves/{uid}/agg/{ "op-cumulative-score": "…", "op-stats-classic": "…", … }
```

Le découpage par journée n'est pas cosmétique : une sauvegarde complète pèse
**174 Ko à 114 journées** et grossit de ~1,5 Ko par jour (~556 Ko sur un an).
Pousser le tout à chaque fin de partie serait sept réécritures de 200 Ko par
jour. Un nœud de journée pèse 1,5 Ko, et c'est le seul écrit d'une partie finie.

Les valeurs sont les chaînes du `localStorage` telles quelles, jamais du JSON
ré-encodé : c'est ce qui permet de réinjecter la sauvegarde sans conversion, et
de garder l'export fichier existant compatible.

## Limites assumées

Le plafond de taille est posé **par feuille** (8 Ko pour une journée, 32 Ko pour
un agrégat). Rien n'empêche le propriétaire d'un compte d'écrire un très grand
nombre de journées dans le sien. Vu le palier gratuit (1 Go), ça n'est pas un
sujet ; ça le deviendrait s'il fallait un jour compter les nœuds par compte.

Les règles ne valident pas le *contenu* des chaînes de `saves/`. Un joueur peut
donc écrire n'importe quel score dans sa propre sauvegarde — comme il peut déjà
le faire dans son `localStorage`.

**Depuis le classement du jour, quelque chose en dépend**, et c'est assumé : le
propriétaire a tranché le 09/09/2026 qu'il n'y aurait **pas d'anti-triche**
(« tant pis, des gens vont tricher pour être premier, c'est dans la nature
humaine »). La règle ne pose donc qu'un **plafond de bon sens à 70 000** et
impose que le nom affiché soit le pseudo réservé. Elle empêche l'usurpation
d'identité et les valeurs absurdes ; elle ne cherche pas à savoir si les points
ont été gagnés honnêtement, et ne le peut pas — le jeu est entièrement côté
client.

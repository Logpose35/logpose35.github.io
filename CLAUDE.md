# LogPose — Contexte projet

Jeu One Piece quotidien type Wordle. **Site statique** (HTML/CSS/JS pur) hébergé sur
GitHub Pages, déployé sur **onepiecedle.fr**. **7 modes quotidiens** (Classique, Wanted,
Silhouette, Fruit du Démon, Émoji, Opening, Tome) + un mode Infini. Compteurs journaliers
via Firebase Realtime DB.

> **Prod : v5.1** (cache `v186`). **En local, commité non poussé : v5.2** (cache `v194`,
> mode Silhouette). Ce fichier-ci = contexte opérationnel permanent.

## Standard de travail attendu

Agir comme un dev web senior responsable de ce site en prod :
- **Comprendre avant de modifier** : lire la région concernée de `app.js`, pas deviner.
- **Changements minimaux et ciblés** : pas de refonte non demandée, pas de dépendance ajoutée
  (le site est volontairement vanilla, zéro build).
- **Préserver le comportement existant** : clés localStorage figées, seed Paris intacte,
  rétrocompat des sauvegardes joueurs.
- **Toujours penser au cache** : bump `?v=NN` + `logpose-vNN` après toute modif JS/CSS/JSON.
- **Pas de sur-ingénierie** : la solution la plus simple qui tient en prod gagne.
- **Vérifier avant d'affirmer "c'est fait"** : relire le diff, tester en preview si pertinent.
- **Signaler les risques** (perf, accessibilité, copyright audio/images) plutôt que les ignorer.

## Stack & environnement

- **Aucun build, aucun Node** (pas de `package.json`). On édite les fichiers servis tels quels.
- **Python dispo** (PIL/Pillow OK) — utilisé pour éditer `data.json` et générer des images.
- **Firebase** : config inline dans `js/app.js` et `js/landing.js` (compteurs de parties,
  compteur communauté `island-reach/{arc}` via `js/map.js`).
- OS : **Windows**. Bash dispo. Piège : le `/tmp` de bash ≠ `/tmp` du Python Windows
  (qui est `C:/Users/lebos/AppData/Local/Temp/`). Pour les emojis en sortie console :
  `sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')`.

## Structure

| Chemin | Rôle |
|---|---|
| `index.html` | Landing « rose des vents » (7 modes), `js/landing.js` |
| `game.html` | Le jeu, charge `js/data.js` puis `js/app.js` (+ sprite SVG `<symbol>` inline) |
| `js/data.js` | Charge `data.json` + `silhouettes/focus.json`, calcule les cibles du jour (seed timezone Paris, salt premier par mode) |
| `js/app.js` | Toute la logique de jeu (gros fichier, ~3030 lignes) |
| `js/map.js`, `js/jolly-roger.js`, `js/canvas-share.js`, `js/ocean3d.js` | Carte Grand Line, Jolly Roger procédural, image de partage, fond 3D |
| `data.json` | 246 personnages + arcs/aliases/fruits/openings/tomes/emoji-names. **JSON minifié sur UNE ligne** (~103 Ko) |
| `silhouettes/` | Assets du mode Silhouette : `<clé>.png` (noir), `color/<clé>.png`, `focus.json` (clé → point de focus ; = source du pool) |
| `css/*.css` | CSS éclaté : base, layout, modals, classic, wanted, silhouette, fruit, inf, emoji, misc, audio, landing, animations, map, tome, ocean3d |
| `sw.js` | Service Worker, cache `logpose-vNN`, network-first HTML/JS/CSS/JSON, cache-first images, `/audio/` jamais intercepté |

## Carte de `js/app.js` (~3030 lignes — lire par tranches, pas en entier)

> Utiliser `Read` avec `offset`/`limit` sur la région voulue plutôt que tout le fichier.

| Lignes | Région |
|---|---|
| 1–58 | Firebase (`fbGet`/`fbIncrement`) + compteurs |
| 59–101 | Registre **`MODES`**/`MODE_IDS` + clés **`LS`** (sources uniques) |
| 102–179 | Rang pirate (8 insignes SVG colorés, seuils de score cumulé) |
| 180–227 | Utils (`esc`, `safeParseJSON`, `lsGet/Set`) + état du jeu |
| 228–414 | Réglages & UI (taille, daltonien, SFX WebAudio, fond 3D opt-in, thème) |
| 415–502 | Modal spoiler · date & hier (cibles par date, dont silhouette salt 211) |
| 503–659 | Onglets (`switchMode`), banners, compteur, formatage prime |
| 660–760 | Autocomplete + submit |
| 761–965 | **Mode Classique** (+ récap + indices) |
| 966–1074 | **Mode Wanted** |
| 1075–1215 | **Mode Silhouette** (dézoom `SIL_SCALES` ×3.2→1, 10 essais, indice couleur au 5e) |
| 1216–1520 | Statistiques (`loadStats`@1305, `showStats`@1361) + **Mode Infini** |
| 1521–1640 | **Mode Fruit** (Akuma no Mi) |
| 1641–1860 | **Mode Émoji** |
| 1861–2077 | **Mode Opening** (audio) |
| 2078–2174 | **Mode Tome** (couverture zoomée → dézoom) |
| 2175–2394 | Score (`calcModeScore`@2181), persistance (`saveState`/`restoreAllStates`), **`onGameEnd`@2304**, partage (`buildShareText`@2340) |
| 2395–2688 | À propos · gazette Silhouette · export/import sauvegarde · changelog |
| 2689–2992 | Barre de score (`updateScoreBar`@2689) · compte à rebours · confettis · konami · micro-animations |
| 2993–fin | Init asynchrone |

## Points d'architecture

- **`onGameEnd(mode, won, tries, score, extra)`** = point d'entrée UNIQUE de fin de partie
  des 7 modes (rang pirate, stats Firebase, animations y sont branchés).
- **`MODES`** = `[{ id, icon, svg, label }]` (+ `MODE_IDS`) : registre unique, ordre canonique.
  Icônes = sprite SVG `<symbol>` inline dans game.html/index.html (plus d'emojis d'UI).
- **`LS`** : objet centralisant TOUTES les clés localStorage. Toute nouvelle clé va ici.
- **Couleur signature par mode** : variables CSS `--mode-*`, survol d'onglet coloré.

## Mode Silhouette (v5.2 — remplace l'ancien Pavillon/`flag`)

- **Pool = clés de `silhouettes/focus.json`** croisées avec `img[0]` des persos
  (`SIL_POOL`, actuellement **150/246**). Les persos sans silhouette sont **exclus du pool**.
  ⚠️ Ajouter des silhouettes change la taille du pool → **la cible du jour change** au déploiement.
- Mécanique : gros plan ×3.2 sur un point du contour (focus.json) → pan + dézoom sur 10 essais ;
  **indice couleur au 5e essai** (÷2 score, disque `clip-path` depuis `silhouettes/color/<clé>.png`).
- **⚠️ `?v=` codé en dur** dans `silSrc`/`silColorSrc` (`app.js` ~1082) → à bumper avec le reste
  (le sed ci-dessous inclut `js/app.js` pour ça).
- Workflow assets : l'utilisateur fournit des découpes PNG transparentes dans
  `images/silhouette_src/` (gitignoré, ~200 Mo) → `python blacken.py <clés>` (noircit + cadre +
  focus.json) puis `python colorize.py` (version couleur cadrée idem). Scripts gitignorés (locaux).
- **96 persos restants** (liste : `images/silhouette_src/_A_REFAIRE.txt`) — dont
  **Zoro, Sanji, Usopp, Franky, Brook** (prioritaires).
- Restes assumés : 4 variantes non utilisées dans `silhouettes/` (`chopper_ts`, `luffy_g5`,
  `nami_ts`, `robin2` — la clé du jeu est `img[0]`) ; anciennes stats `op-stats-flag` orphelines
  dans le localStorage des joueurs (inoffensif) ; clé `FLAGS` encore présente dans data.json (inutilisée).

## Schéma d'un personnage (`data.json` → `CHARACTERS[]`)

`name`, `img` (string | array | null), `emoji` (array de 8), `epithet`, `gender`,
`affil`, `origin`, `fruit`, `haki` (array), `status`, `arc` (1-based), `bounty`, `debut`.
Le jeu charge les portraits en `images/<img>.jpg`.

### Convention emojis (mode Émoji) — établie le 29/05/2026

Chaque perso a **8 emojis distinctifs**. Règles :
- Un emoji = un **trait identifiant** (pouvoir, arme/objet signature, animal, thème, personnalité).
- **Pas de béquille "couleur"** : on ne met PAS un rond/cœur coloré juste pour la couleur de
  cheveux/tenue. Exception : la couleur EST l'identité (Shanks 🔴 le Roux, Akainu magma, Aokiji glace)
  et n'est pas déjà dite autrement.
- Cœurs **gardés** seulement si signifiants : romance (Hancock 💕) ou tragédie (💔 perte).
- Éviter qu'un **groupe** partage un bloc identique (max ~2 emojis "famille" partagés).
- Toujours **8 emojis, aucun doublon interne** par perso.

## Workflow de dev

- **`data.json` = ~103 Ko sur UNE seule ligne.** Ne JAMAIS le `Read` en entier (gaspille ~20k tokens
  pour une ligne illisible). Le **lire/interroger via Python** (`json.load` puis filtrer `CHARACTERS`
  par `name`) ou `Grep`. L'**éditer toujours via Python**, jamais à la main :
  `json.dump(d, open('data.json','w',encoding='utf-8'), ensure_ascii=False, separators=(',',':'))`
- **Cache-busting** : après toute modif de JS/CSS/JSON, bumper la version partout :
  `sed -i "s/v=NN/v=NN+1/g; s/logpose-vNN/logpose-vNN+1/g" sw.js game.html index.html js/app.js`
  (`js/app.js` inclus à cause des `?v=` en dur de `silSrc`/`silColorSrc`). **Version actuelle : v194.**
- **Nouveau fichier JS/CSS** : (a) `<script>/<link>` dans game.html, (b) ajouté au
  précache de `sw.js`, (c) suffixé `?v=NN`.
- **Preview local** : MCP `Claude_Preview` (config "logpose", `python http.server` port 3333).
  Rituel pour voir du frais : unregister SW + `caches.delete` + recharger avec `?fresh=Date.now()`.
  Les sous-ressources `app.js?v=NN` sont cachées par URL HTTP → bumper `?v` après édition de app.js.

## Contraintes process (IMPORTANT)

- **Ne JAMAIS pousser sur GitHub sans accord explicite de l'utilisateur.** Idem pour les commits :
  attendre la demande.
- Le `.gitignore` couvre déjà : `.claude/`, docs de dev (`BRIEF_*`, `CONTEXTE_*`…),
  `images/silhouette_src/` (197 Mo !), scripts silhouette (`blacken.py`/`colorize.py`/
  `generate_silhouettes.py`), `__pycache__/`, `.playwright-mcp/`, doublons d'images.
  **Ne jamais forcer l'ajout d'un fichier ignoré.**
- Garder **onepiecedle.fr** dans les meta/OG (le repo GitHub est `Logpose35` mais le domaine est onepiecedle.fr).
- Les **chaînes de clés localStorage doivent rester identiques** (ne pas casser les sauvegardes joueurs).
- **Copyright** : 30 MP3 d'openings (`audio/`) et images de persos dans un repo public — risque
  connu et assumé, à re-signaler si le sujet revient.

## État courant (02/07/2026)

- **Prod (poussée)** : **v5.1**, cache `v186` — refonte landing « rose des vents », icônes SVG,
  couleur par mode, fond 3D océan/île, carte Grand Line, rang pirate, stats communauté.
- **Commité en local, NON poussé** : **v5.2**, cache `v194` — **mode Silhouette** (remplace
  Pavillon), gazette de lancement, nettoyage code mort Pavillon (`css/flag.css`,
  `TARGET_F`/`FLAGS`/`CELL_ORDER` de data.js), `.gitignore` chantier silhouette.
- **Avant push v5.2** : vérifier les règles Firebase (la branche `island-reach/` est DÉJÀ
  utilisée en prod par la carte) · test appareil réel.
- **Reste à faire** : 96 silhouettes manquantes (Zoro/Sanji/Usopp/Franky/Brook en tête) ·
  P5b Calendrier de l'Avent (décembre) · compression images lourdes
  (`wanted_frame.png` 4,3 Mo, `carte.jpeg` 2,3 Mo, `koala.jpg` 2 Mo).

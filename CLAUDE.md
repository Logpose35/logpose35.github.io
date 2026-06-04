# LogPose — Contexte projet

Jeu One Piece quotidien type Wordle. **Site statique** (HTML/CSS/JS pur) hébergé sur
GitHub Pages, déployé sur **onepiecedle.fr**. 6 modes quotidiens (Classique, Wanted,
Pavillon, Fruit du Démon, Émoji, Opening) + un mode Infini. Compteurs journaliers via
Firebase Realtime DB. Version affichée en prod : **v4.7**.

> **v5 : fonctionnellement complète** (cache `v137`), non déployée. Seul **P5b — Calendrier
> de l'Avent** reste (hors-saison, décembre). Ce fichier-ci = contexte opérationnel permanent.

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
- **Firebase** : config inline dans `js/app.js` et `js/landing.js` (compteurs de parties).
- OS : **Windows**. Bash dispo. Piège : le `/tmp` de bash ≠ `/tmp` du Python Windows
  (qui est `C:/Users/lebos/AppData/Local/Temp/`). Pour les emojis en sortie console :
  `sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')`.

## Structure

| Chemin | Rôle |
|---|---|
| `index.html` | Landing (présente les 6 modes), `js/landing.js` |
| `game.html` | Le jeu, charge `js/data.js` puis `js/app.js` |
| `js/data.js` | Charge `data.json` (fetch `/data.json`, `no-cache`), calcule les cibles du jour (seed timezone Paris, salt premier par mode) |
| `js/app.js` | Toute la logique de jeu (gros fichier) |
| `data.json` | Données des 233 personnages + arcs/flags/fruits/openings. **JSON minifié sur une ligne** |
| `css/*.css` | CSS éclaté par mode (base, layout, modals, classic, wanted, flag, fruit, inf, emoji, misc, audio, landing). ⚠️ `style.css` monolithe a été SUPPRIMÉ |
| `sw.js` | Service Worker, cache `logpose-vNN`, network-first HTML/JS/CSS/JSON, cache-first images |

## Carte de `js/app.js` (2346 lignes — lire par tranches, pas en entier)

> Utiliser `Read` avec `offset`/`limit` sur la région voulue plutôt que tout le fichier.

| Lignes | Région |
|---|---|
| 1–105 | Firebase (`fbGet`/`fbIncrement`) + constantes `COUNTER_LABELS`, `WIN_TITLES`, `MODES`, `MODE_IDS`, `LS` |
| 107–146 | Helpers (`esc`, `safeParseJSON`, `sanitizeNum`, `lsGet/Set/Remove`) |
| 149–330 | Réglages & UI globale (taille, settings, daltonien, SFX WebAudio, thème) |
| 333–495 | Cœur quotidien (`seedForDate`, `saveTodayTargets`, `switchMode`, `syncBanners`, `updateCounter`) |
| 495–590 | Comparaisons & recherche (`formatBounty`, `getMatchHint`, `charMatchesQuery`) |
| 591–810 | **Mode Classique** (`submitClassic`, `finClassic`, `cmp*`, `buildGuessRow`, `updateRecap`, indices) |
| 812–918 | **Mode Wanted** (`initPoster`, `applyFilter`, `defloutStep`, `finWanted`) |
| 920–1011 | **Mode Pavillon** (`initFlagGrid`, `revealFlagCells`, `finFlag`) |
| 1012–1094 | **Mode Infini** (`pickInfTarget`, `initInfMode`, `finInf`, `replayInf`) |
| 1095–1294 | Stats & résultats (`loadStats`, `recordResult`, `showStats`, `renderStatsContent`) |
| 1295–1417 | **Mode Fruit** (`initFruitMode`, `revealHint`, `finFruit`) |
| 1418–1599 | **Mode Émoji** (`seededShuffle`, `buildEmojiSeed`, `updateEmojiStrip`, `finEmoji`) |
| 1600–1812 | **Mode Opening** (`initAudioMode`, `playSnippet`, `showAudioReveal`, `finAudio`) |
| 1813–1927 | Scores & persistance (`calcModeScore`, `saveState`, `restoreAllStates`, **`onGameEnd` @1912**) |
| 1928–2033 | Partage (`buildShareText`, `shareDaily`, `shareVia`) |
| 2034–2126 | Barre de score & onglets (`updateScoreBar`, `updateStreakDisplay`) |
| 2127–2346 | Effets (`launchPerfectDay`, `startCountdown`, `launchConfetti`, konami) |

## Seams en place pour la v5 (déjà pré-adaptés, comportement identique à v4.6)

- **`onGameEnd(mode, won, tries, score, extra)`** dans `app.js` = point d'entrée UNIQUE
  de fin de partie des 6 modes. C'est ici qu'on branchera rang pirate / animations / stats Firebase.
- **`MODES`** = `[{ id, icon, label }]` (+ `MODE_IDS`) : registre unique, ordre canonique.
- **`LS`** : objet centralisant TOUTES les clés localStorage. Toute nouvelle clé va ici.
  Clés v5 déjà réservées : `LS.cumulativeScore`, `LS.pirateRank`, `LS.mapUnlocked`.

## Schéma d'un personnage (`data.json` → `CHARACTERS[]`)

`name`, `img` (string | array | null), `emoji` (array de 8), `epithet`, `gender`,
`affil`, `origin`, `fruit`, `haki` (array), `status`, `arc` (1-based), `bounty`.

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

- **`data.json` = 87 Ko sur UNE seule ligne.** Ne JAMAIS le `Read` en entier (gaspille ~20k tokens
  pour une ligne illisible). Le **lire/interroger via Python** (`json.load` puis filtrer `CHARACTERS`
  par `name`) ou `Grep`. L'**éditer toujours via Python**, jamais à la main :
  `json.dump(d, open('data.json','w',encoding='utf-8'), ensure_ascii=False, separators=(',',':'))`
- **Cache-busting** : après toute modif de JS/CSS/JSON, bumper la version partout :
  `sed -i "s/v=NN/v=NN+1/g; s/logpose-vNN/logpose-vNN+1/g" sw.js game.html index.html`
  (les `<script>/<link>` sont suffixés `?v=NN`, le SW a `logpose-vNN`). **Version actuelle : v102.**
- **Nouveau fichier JS/CSS en v5** : (a) `<script>/<link>` dans game.html, (b) ajouté au
  précache de `sw.js`, (c) suffixé `?v=NN`.
- **Preview local** : MCP `Claude_Preview` (config "logpose", `python http.server` port 3333).
  Rituel pour voir du frais : unregister SW + `caches.delete` + recharger avec `?fresh=Date.now()`.
  Les sous-ressources `app.js?v=NN` sont cachées par URL HTTP → bumper `?v` après édition de app.js.

## Contraintes process (IMPORTANT)

- **Ne JAMAIS pousser sur GitHub sans accord explicite de l'utilisateur.** Idem pour les commits :
  attendre la demande.
- À **exclure des commits** (untracked, non voulus) : `.claude/`, et les doublons d'images
  `images/*.jpg` (favicon, going_merry, jolly_roger, wanted_frame, wanted_template — les vrais sont en `.png`).
- Garder **onepiecedle.fr** dans les meta/OG (le repo GitHub est `Logpose35` mais le domaine est onepiecedle.fr).
- Les **chaînes de clés localStorage doivent rester identiques** (ne pas casser les sauvegardes joueurs).
- **v5 codée en local, NON déployée** (cache `v137`). Avant prod : règles Firebase pour la branche
  `island-reach/`, version affichée v4.7 → v5, puis commit + push (sur accord).
- `split_css.py` est **obsolète** (lisait `style.css` supprimé) — à retirer.

## État courant — v4.7 (commité + poussé le 29/05/2026)

La release **v4.7** est en prod (cache **v102**). Contenu de cette release :
- **Audit complet des emojis** (60 personnages) — suppression des béquilles couleur,
  dégroupage des blocs identiques (satellites Vegapunk, 5 Gorosei, équipage Barbe Noire),
  nettoyage des marqueurs Wano empilés. Convention emoji documentée plus haut.
- **Pré-adaptation v5** : seams `onGameEnd` / `MODES` / `LS` posés (comportement identique),
  suppression du `css/style.css` mort.
- **UX** : popup de fin accélérée (1800→900 ms), OG preview régénérée (6 modes).
- **Doc/infra** : ajout de ce `CLAUDE.md`, `.gitignore` enrichi (`.claude/` + doublons `.jpg`).

## v5 — codée en local (cache `v137`, NON déployée)

Toute la v5 est implémentée mais **rien n'est commité/poussé** :
- **P1** Rang/titre pirate · **P1.1** Jolly Roger procédural (`js/jolly-roger.js`)
- **P2** Share image canvas (`js/canvas-share.js`, + pavillon perso en filigrane)
- **P3** Micro-animations victoire (`css/animations.css`) · **UX** transitions d'onglets
- **P4** Stats communauté Firebase · **P5a** Anniversaires personnages
- **P6** Carte de Grand Line (`js/map.js` + `css/map.css`) : 32 îles aux vraies positions géo,
  zoom/pan, déblocage par score cumulé, **carnet de capture** (clic île → dossier d'arc, persos
  capturés/silhouettes), **fiche personnage** (clic perso), **compteur communauté** (`island-reach/{arc}`).

**Reste :** P5b — Calendrier de l'Avent (hors-saison, décembre).
**Avant prod :** règles Firebase `island-reach/` · version v4.7 → v5 · commit + push (sur accord) · test appareil.

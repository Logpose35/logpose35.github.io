# LogPose v5 — Roadmap "Concurrent Sérieux"

> Fichier de référence — à récupérer en début de session pour attaquer la v5.
> Stack : HTML/CSS/JS pur + Firebase (déjà intégré). Aucun backend supplémentaire.
> Version actuelle en production : v4.0

---

## Vision

Transformer LogPose d'un "Wordle One Piece" en une **expérience pirate quotidienne**.
Les autres sites font du quiz avec une skin One Piece.
LogPose doit faire du One Piece qui se joue comme un quiz.

**Question centrale à laquelle le site doit répondre :**
> "Pourquoi est-ce que je reviens ici spécifiquement ?"

---

## Priorité 1 — Rang/Titre Pirate Persistant
**Impact : Fort (rétention) | Effort : Faible**

### Concept
Sans compte, sans email. Identité pirate générée et stockée en localStorage.

### Titres (basés sur score cumulé total)
| Titre | Score cumulé |
|-------|-------------|
| Moussaillon | 0 – 49 999 |
| Matelot | 50 000 – 149 999 |
| Pirate | 150 000 – 349 999 |
| Second | 350 000 – 699 999 |
| Capitaine | 700 000 – 1 499 999 |
| Corsaire | 1 500 000 – 2 999 999 |
| Amiral | 3 000 000 – 5 999 999 |
| Yonko | 6 000 000+ |

### Implémentation
- Clé localStorage : `op-cumulative-score` — s'incrémente à chaque partie gagnée
- Clé localStorage : `op-pirate-rank` — recalculé à chaque session
- Affiché dans : header (petit badge sous le nom), modal stats, share recap
- Share recap mis à jour : `"⚔️ Capitaine · Série 12j · 284 000 pts cumulés"`

### Jolly Roger Procédural (optionnel, v5.1)
- Hash de l'appareil (fingerprint léger, pas intrusif) → couleur + motif de crâne
- Généré en Canvas SVG, toujours le même pour le même appareil
- Visible dans le modal stats et le share image

---

## Priorité 2 — Share Image Canvas
**Impact : Très fort (acquisition) | Effort : Élevé**

### Concept
Le bouton "Partager" génère une vraie image PNG au lieu de texte brut.
Les gens la postent sur Instagram, TikTok, X — ce qui convertit de nouveaux joueurs.

### Design de l'image (800×500px)
```
┌─────────────────────────────────────┐
│  [Logo LogPose]        23/05/2026   │
│  ─────────────────────────────────  │
│  🗺️  ✅  3 essais    · 8 500 pts   │
│  🏴‍☠️  ✅  1 essai     · 10 000 pts  │
│  🏴   ✅  2 essais   · 9 200 pts   │
│  🍎  ❌              · 0 pts       │
│  😀  ✅  5 essais    · 6 000 pts   │
│  🎵  ✅  2 essais    · Carmine     │
│  ─────────────────────────────────  │
│  ⭐  43 700 / 60 000 pts            │
│  ⚔️  Capitaine · Série 7 jours     │
│  [Silhouette floutée du perso]      │
└─────────────────────────────────────┘
```
- Background : texture maritime sombre (#04090f + vagues subtiles)
- Accents dorés (#c89408)
- Silhouette du personnage Classique (image floutée + assombrie, bords fondus)
- Fonction : `generateShareImage()` → Canvas → `canvas.toBlob()` → Web Share API image

### Implémentation
- Nouvelle fonction `generateShareImage()` dans app.js
- Remplace le texte par l'image dans le share popup (bouton "🖼️ Partager l'image")
- Fallback texte conservé pour les navigateurs sans support Canvas

---

## Priorité 3 — Micro-animations Victoire
**Impact : Fort (wow effect) | Effort : Moyen**

### Par mode

**Classique**
- L'image du personnage trouvé fait une entrée : scale 0.5→1.05→1 + fade (400ms)
- Le nom s'affiche lettre par lettre (typewriter, 30ms/lettre)
- Particules dorées légères (pas de confettis génériques)

**Wanted**
- L'image "se révèle" : effet scan vertical de haut en bas (clip-path animation)
- Tampon rouge "TROUVÉ" qui apparaît par rotation (comme un vrai tampon)

**Pavillon**
- Le drapeau trouvé "se déploie" : animation wave CSS (transform + keyframes)
- Fond qui prend brièvement la couleur dominante du drapeau

**Fruit du Démon**
- Le fruit tourne sur lui-même 360° puis s'immobilise avec rebond
- Aura colorée selon le type (Logia=blanc, Zoan=vert, Paramecia=bleu, Mythique=violet)

**Émoji**
- Les emojis corrects "sautent" en cascade (stagger 80ms chacun)
- Le personnage apparaît avec un pop

**Opening**
- Une onde sonore animée pulse 3 fois
- Le titre + artiste s'affiche en fondu avec le numéro d'opening en grand en arrière-plan

### Implémentation
- Nouvelles classes CSS : `.reveal-classic`, `.reveal-wanted`, `.reveal-flag`, etc.
- Fonction `playWinAnimation(mode)` appelée après chaque victoire
- Respecte `prefers-reduced-motion` — animations désactivées si l'utilisateur le préfère

---

## Priorité 4 — Stats Communauté "Le Bord"
**Impact : Moyen (engagement) | Effort : Faible (Firebase déjà là)**

### Concept
Section sous le timer (ou dans une modale dédiée) qui montre la vie collective du site.

### Données affichées
- **Personnage d'hier** : nom + image + % victoires communauté + moyenne d'essais
- **Records du site** : "🏆 Meilleure journée — 89% de victoires en Classique"
- **Hall of Shame** : "💀 Top 3 des personnages les plus durs de l'histoire"
- **Compteur live** : "👥 X joueurs ont joué aujourd'hui" (déjà en place, à enrichir)

### Implémentation Firebase
- Nouvelle collection `daily-stats/{date}` : stocke win_rate, avg_tries, total_players par mode
- Cloud Function (ou simple write côté client avec règles) qui agrège à la fin de la journée
- Lecture en temps réel via `onValue` pour le compteur live

---

## Priorité 5 — Événements & Saisonnalité

### Anniversaires des personnages
**Effort : Faible**

Table des anniversaires One Piece (canoniques) :
- Luffy : 5 mai
- Zoro : 11 novembre
- Nami : 3 juillet
- Sanji : 2 mars
- ... (à compléter avec toute la liste)

Comportement le jour J :
- Badge "🎂 Bon anniversaire [Nom] !" dans la date-badge
- Le mode Classique a 30% de chances de tomber sur ce personnage (seed modifiée)
- Animation spéciale si le joueur trouve le bon personnage ce jour-là
- Mention dans le share recap

### Calendrier de l'Avent (décembre)
**Effort : Moyen**

- Du 1er au 24 décembre, les 6 modes ont des personnages/openings pré-sélectionnés iconiques
- Table hardcodée dans data.js : `ADVENT_CALENDAR = { '12-01': {...}, '12-02': {...}, ... }`
- Fenêtre spéciale au 1er décembre annonçant l'événement
- Badge "🎄 Avent" sur les onglets pendant tout décembre
- Override de `dailyPick()` pour les dates de décembre

### Arc Spécial Hebdomadaire (futur)
- Une semaine thématique par arc (tous les persos de Dressrosa, etc.)
- Annoncé 3 jours avant sur le site
- Badge spécial dans le share

---

## Priorité 6 — Carte des Grands Line (Pièce Maîtresse)
**Impact : Très fort (long terme) | Effort : Élevé**

### Concept
Remplace/complète le modal Stats avec une carte SVG interactive des Grands Line.
Les îles = les arcs de One Piece. Elles s'illuminent selon ta progression.

### Îles et conditions de déblocage
| Île | Arc | Condition |
|-----|-----|-----------|
| ⚓ Romance Dawn | Arc 1 | 1ère partie jouée |
| 🏴‍☠️ Orange Town | Arc 2 | 5 victoires Classique |
| 🏹 Syrup Village | Arc 3 | 10 victoires |
| 🍽️ Baratie | Arc 4 | 20 victoires |
| 🐟 Arlong Park | Arc 5 | 35 victoires |
| ... | ... | ... |
| 🌊 Elbaf | Arc 31 | 200+ victoires |

### Visuellement
- SVG custom dessiné façon carte au trésor (parchemin, traits d'encre)
- Îles verrouillées : grises et avec un cadenas
- Îles débloquées : colorées, avec un petit Jolly Roger planté dessus
- Ta position actuelle : une icône de bateau animée
- Hover sur une île : nom de l'arc + ta stat pour ce mode
- Route tracée entre les îles débloquées (ligne pointillée animée)

### Implémentation
- SVG statique custom (dessiné ou généré une seule fois)
- `loadStats()` pour tous les modes → calcul des îles débloquées
- Modal "Carte" accessible depuis le header (icône 🗺️)
- Clé localStorage : `op-map-unlocked` = array des arcs débloqués

---

## Transitions entre onglets (Amélioration UX transversale)
**Effort : Moyen**

Technique FLIP (First, Last, Invert, Play) :
- Au changement d'onglet, les cartes de la grille précédente glissent vers la gauche (hors écran)
- Les nouvelles cartes arrivent par la droite
- Durée : 200ms, easing `cubic-bezier(0.25, 0.46, 0.45, 0.94)`
- Désactivé si `prefers-reduced-motion`

---

## Fichiers à modifier / créer en v5

| Fichier | Modifications |
|---------|--------------|
| `js/data.js` | Table anniversaires, ADVENT_CALENDAR, logique seed override |
| `js/app.js` | Rang pirate, share canvas, animations victoire, stats communauté, carte |
| `css/style.css` | Nouvelles animations, styles carte, badges événements |
| `index.html` | Nouveaux éléments DOM (modale carte, badge rang, etc.) |
| `js/canvas-share.js` | Nouveau fichier dédié à la génération d'image Canvas |
| `js/map.js` | Nouveau fichier dédié à la carte des Grands Line |

---

## Ce qui NE change PAS en v5

- Pas de compte utilisateur (tout en localStorage)
- Pas de nouveau backend (Firebase existant suffit)
- Pas d'audio MP3 dans Git (copyright)
- Pas de push GitHub sans accord explicite
- La mécanique de jeu des 6 modes reste identique
- Le système de seed Paris timezone reste identique

---

## Ordre d'exécution suggéré en session v5

1. `[ ]` Rang/Titre pirate (1-2h)
2. `[ ]` Micro-animations victoire (2-3h)
3. `[ ]` Anniversaires personnages + table des dates (1h)
4. `[ ]` Share image Canvas — `canvas-share.js` (3-4h)
5. `[ ]` Stats communauté Firebase (1-2h)
6. `[ ]` Transitions onglets FLIP (1h)
7. `[ ]` Calendrier de l'Avent (2h)
8. `[ ]` Carte des Grands Line — `map.js` (4-6h)
9. `[ ]` Jolly Roger procédural (2h)

---

*Créé le 23/05/2026 — Session v4 → v5 planning*

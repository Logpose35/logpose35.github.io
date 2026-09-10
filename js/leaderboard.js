// ============================================================================
//  Classement du jour — LogPose
//  ---------------------------------------------------------------------------
//  Deux moitiés bien séparées :
//    • `classer()` est PURE (aucun DOM, aucun réseau) et tourne aussi sous Node :
//      c'est elle que les tests couvrent.
//    • le reste peint le panneau et parle au compte.
//
//  Le nom affiché n'est jamais choisi par le client : la règle de la base impose
//  qu'une ligne porte EXACTEMENT le pseudo réservé de son compte. Impossible de
//  se présenter sous l'identité d'un autre, ni d'y glisser autre chose. Le rendu
//  passe malgré tout par `textContent` — deux verrous valent mieux qu'un.
// ============================================================================
(function (global) {
  'use strict';

  const TOP = 5;          // podium visible ; au-delà, on n'affiche que sa propre ligne
  const MAX = 70000;      // 7 modes × 10 000 : le plafond de la barre de score
  const DEBOUNCE = 3000;  // enchaîner les 7 modes ne doit coûter qu'un seul envoi
  // Série de jours consécutifs, affichée entre parenthèses à côté du score :
  // le classement du jour récompense la performance, la série récompense la
  // FIDÉLITÉ — c'est elle qui donne une raison de revenir demain.
  // Plafond de bon sens, comme le score : garde-fou, pas anti-triche (la
  // décision de ne pas arbitrer vaut ici comme ailleurs).
  const SERIE_MAX = 10000;
  // En dessous de 2 jours, il n'y a pas de série à montrer — « (1 j) » sur
  // toutes les lignes serait du bruit, et dévaloriserait celles qui en ont une.
  const SERIE_MIN = 2;

  // ── Classement (pur) ──────────────────────────────────────────────────────
  // `entrees` = { uid: { n: pseudo, s: score, t: horodatage } }, tel que la base
  // le renvoie. Une ligne illisible est ignorée plutôt que de casser le rendu :
  // ces données viennent du réseau, elles ne sont jamais tenues pour propres.
  function classer(entrees, opts) {
    const o = opts || {};
    const max = o.max == null ? MAX : o.max;
    const top = o.top == null ? TOP : o.top;
    const moiUid = o.uid || null;

    const liste = Object.keys(entrees || {}).map(uid => {
      const e = entrees[uid];
      if (!e || typeof e !== 'object') return null;
      const nom = typeof e.n === 'string' ? e.n.trim() : '';
      const brut = Number(e.s);
      if (!nom || !isFinite(brut)) return null;
      // `d` est facultatif : les lignes écrites avant l'ajout de la série n'en
      // ont pas, et une entrée sans série reste une entrée valable.
      const jours = Number(e.d);
      return {
        uid: uid,
        nom: nom,
        score: Math.max(0, Math.min(max, Math.round(brut))),
        serie: isFinite(jours) ? Math.max(0, Math.min(SERIE_MAX, Math.round(jours))) : 0,
        t: isFinite(Number(e.t)) ? Number(e.t) : 0,
      };
    }).filter(Boolean);

    // Score décroissant. À égalité, celui qui y est arrivé le premier passe
    // devant ; l'uid ne tranche qu'en dernier recours, pour que l'ordre soit
    // strictement déterminé (deux appareils doivent afficher la même liste).
    liste.sort((a, b) =>
      b.score - a.score ||
      a.t - b.t ||
      (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));

    liste.forEach((l, i) => { l.rang = i + 1; });

    const moi = moiUid ? (liste.filter(l => l.uid === moiUid)[0] || null) : null;
    return {
      total: liste.length,
      tete: liste.slice(0, top),
      moi: moi,
      moiDansTete: !!(moi && moi.rang <= top),
    };
  }

  // Sous Node, on s'arrête là : tout ce qui suit touche au DOM.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { classer: classer, MAX: MAX, TOP: TOP };
  }
  if (typeof document === 'undefined') {
    global.LPLeaderboard = { classer: classer };
    return;
  }

  // ── Réglages fournis par app.js ───────────────────────────────────────────
  // Les clés localStorage et la notion de « journée active » restent chez lui :
  // ce module ne les redécouvre pas.
  let cfg = { jour: null, score: null, serie: null, replie: null };
  function configure(o) { cfg = Object.assign({}, cfg, o || {}); }

  const T = s => (typeof global.t === 'function' ? global.t(s) : s);
  const TF = (s, a) => (typeof global.tf === 'function' ? global.tf(s, a) : s.replace('{0}', a));
  const NF = n => (typeof global.nfmt === 'function' ? global.nfmt(n) : String(n));

  const el = id => document.getElementById(id);

  // ── Pavillon ──────────────────────────────────────────────────────────────
  // Dérivé du PSEUDO : tout le monde calcule donc le même pavillon pour un même
  // joueur, sans que la base ait à le transporter. (Le pavillon du panneau des
  // statistiques, lui, vient de l'appareil — ce sont deux identités distinctes.)
  const _flags = {};
  function pavillon(nom) {
    if (_flags[nom]) return _flags[nom];
    if (typeof global.buildJollyRoger !== 'function' ||
        typeof global.hashJollyRoger !== 'function') return '';
    try {
      _flags[nom] = global.buildJollyRoger(global.hashJollyRoger(nom)).svg;
    } catch (e) { _flags[nom] = ''; }
    return _flags[nom];
  }

  function ligne(l, marque) {
    const li = document.createElement('li');
    li.className = 'lb-row' + (l.rang <= 3 ? ' lb-podium lb-rank-' + l.rang : '') +
                   (marque ? ' lb-me' : '');

    const pos = document.createElement('span');
    pos.className = 'lb-pos';
    pos.textContent = l.rang;

    const flag = document.createElement('span');
    flag.className = 'lb-flag';
    flag.setAttribute('aria-hidden', 'true');
    flag.innerHTML = pavillon(l.nom);   // SVG engendré à partir d'un nombre, jamais du texte reçu

    const nom = document.createElement('span');
    nom.className = 'lb-name';
    nom.textContent = l.nom;            // JAMAIS innerHTML

    const sc = document.createElement('span');
    sc.className = 'lb-score';
    sc.textContent = NF(l.score);

    li.appendChild(pos); li.appendChild(flag); li.appendChild(nom); li.appendChild(sc);

    // Série de jours consécutifs, entre parenthèses après le score. Ajoutée
    // seulement quand il y en a une : une ligne sans série ne porte rien, plutôt
    // qu'un « (0 j) » qui ferait tache.
    if (l.serie >= SERIE_MIN) {
      const sr = document.createElement('span');
      sr.className = 'lb-streak';
      sr.textContent = TF('({0} j)', NF(l.serie));
      sr.title = TF('{0} jours d\'affilée', NF(l.serie));
      li.appendChild(sr);
    }
    return li;
  }

  // Placement du panneau. TOUT est mesuré, rien n'est supposé : deux essais à
  // coup de valeurs en dur ont échoué, l'un sur la barre de score, l'autre sur
  // le bandeau « Hier ». La page n'a pas la même largeur utile selon le mode.
  //
  //   • Vertical   — sous la barre de score, qui est PLEINE LARGEUR et dont le
  //                  texte (« 8 000 / 70 000 ») déborde à droite de la colonne.
  //                  Sa hauteur bouge aussi : la barre de série apparaît quand
  //                  une série est en cours.
  //   • Horizontal — à droite de tout ce que la colonne occupe réellement. Le
  //                  bandeau « Hier » est plus large que la zone de saisie, et
  //                  c'est lui que le panneau mordait.
  //
  // Deux placements, choisis par la MESURE et non par une requête média :
  //   • gouttière — il y a la place à droite du jeu : panneau flottant, rien
  //                 n'est repoussé ;
  //   • flux      — pas la place : le panneau redevient un bloc normal et se
  //                 pose sous la partie, là où il est dans le document. C'est
  //                 le cas du mobile, mais aussi d'une fenêtre étroite.
  // Un seuil en pixels aurait été faux quelque part : la largeur utile change
  // avec le mode joué ET avec l'option « taille de l'interface ».
  const GOUTTIERE = 28;          // entre la colonne de jeu et le panneau
  const MARGE = 20;              // entre le panneau et le bord de la fenêtre
  const LARGEUR_GOUTTIERE = 285; // doit suivre la largeur posée en CSS

  // L'option « taille de l'interface » applique un `zoom` sur <body>
  // (css/base.css : 0,78 en Petit, 1,22 en Grand). Conséquence à ne pas rater :
  // getBoundingClientRect() rend des pixels ÉCRAN, alors qu'une valeur écrite
  // dans style.left est relue en pixels CSS puis zoomée à son tour. Sans cette
  // conversion, le panneau se posait sur le jeu en Petit et sortait de l'écran
  // en Grand. Mesuré plutôt que lu dans `zoom` : ça reste vrai si la mise à
  // l'échelle change un jour de moyen.
  function facteurEchelle() {
    const b = document.body;
    const f = b.offsetWidth ? b.getBoundingClientRect().width / b.offsetWidth : 1;
    return (isFinite(f) && f > 0.1 && f < 10) ? f : 1;
  }

  // Repasse le panneau dans le flux : on efface les positions posées en ligne,
  // sinon elles battraient la feuille de style.
  function mettreDansLeFlux(panneau) {
    panneau.style.top = '';
    panneau.style.left = '';
    panneau.classList.add('lb-flux');
  }

  function placer(panneau) {
    const barre = document.querySelector('.score-bar-section');
    const colonne = document.querySelector('main');
    if (!barre || !colonne) { mettreDansLeFlux(panneau); return; }

    const z = facteurEchelle();

    // Tout ce qui suit est en pixels ÉCRAN, comme les rectangles mesurés.
    // Position dans le DOCUMENT : indépendante du défilement au moment de la
    // mesure, alors que le panneau, lui, est fixe par rapport à la fenêtre.
    const haut = barre.getBoundingClientRect().bottom + (window.scrollY || 0) + 12;

    let droite = colonne.getBoundingClientRect().right;
    ['#yesterday-bar', '.date-badge', '#daily-average', '#daily-counter'].forEach(sel => {
      const e = document.querySelector(sel);
      if (e && e.offsetWidth) droite = Math.max(droite, e.getBoundingClientRect().right);
    });

    // Largeur du panneau en gouttière : celle de la feuille de style, qu'on ne
    // peut pas lire tant qu'il est dans le flux ou masqué.
    const largeur = LARGEUR_GOUTTIERE * z;
    const gauche = droite + GOUTTIERE;

    // Pas la place à droite : le panneau descend dans le flux, sous la partie.
    if (gauche + largeur + MARGE > window.innerWidth) {
      mettreDansLeFlux(panneau);
      return;
    }

    panneau.classList.remove('lb-flux');
    panneau.style.top = Math.round(haut / z) + 'px';
    panneau.style.left = Math.round(gauche / z) + 'px';
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────
  // Dernier classement peint : un redimensionnement le rejoue pour remesurer la
  // gouttière, sans repasser par le réseau.
  let dernierRendu = null;
  let attenteReplace = null;

  function replacer() {
    if (attenteReplace) clearTimeout(attenteReplace);
    attenteReplace = setTimeout(() => {
      attenteReplace = null;
      if (dernierRendu) peindre(dernierRendu.cl, dernierRendu.etat);
    }, 150);
  }

  function peindre(cl, etat) {
    const panneau = el('lb-panel');
    const liste = el('lb-list');
    const pied = el('lb-foot');
    if (!panneau || !liste || !pied) return;
    dernierRendu = { cl: cl, etat: etat };

    // Personne de classé : on efface le panneau plutôt que de poser un cadre
    // vide sur les huit pages. Les phrases d'invite ne servent à rien tant
    // qu'il n'y a pas un classement à rejoindre — et tôt le matin, il n'y en a
    // pas encore.
    if (!cl.total) { panneau.hidden = true; return; }

    liste.textContent = '';
    cl.tete.forEach(l => liste.appendChild(ligne(l, cl.moi && l.uid === cl.moi.uid)));

    // Hors du top : sa propre ligne, détachée, précédée d'une ellipse.
    if (cl.moi && !cl.moiDansTete) {
      const sep = document.createElement('li');
      sep.className = 'lb-gap';
      sep.setAttribute('aria-hidden', 'true');
      sep.textContent = '···';
      liste.appendChild(sep);
      liste.appendChild(ligne(cl.moi, true));
    }

    // Chaque phrase doit être VRAIE au moment où elle s'affiche : dire
    // « terminez un mode » à quelqu'un qui n'a pas encore de pseudo l'envoie
    // faire la mauvaise chose, et il ne comprendra pas pourquoi il n'apparaît
    // toujours pas.
    pied.textContent =
        etat === 'anonyme'    ? T('Connectez-vous et réservez un pseudo pour figurer au classement.')
      : etat === 'sanspseudo' ? T('Réservez un pseudo pour figurer au classement.')
      : etat === 'sansscore'  ? T('Terminez un mode pour entrer au classement.')
      : cl.total === 1        ? T("1 joueur classé aujourd'hui.")
      :                         TF("{0} joueurs classés aujourd'hui.", NF(cl.total));

    placer(panneau);
    panneau.hidden = false;
  }

  // ── Réseau ────────────────────────────────────────────────────────────────
  let dernierEnvoi = null;   // dernier score effectivement publié, pour ne pas réécrire à l'identique
  let derniereSerie = null;  // idem pour la série : elle seule peut avoir changé
  let minuteur = null;
  let enCours = false;
  let pseudoConnu = null;    // pseudo réservé du compte, une fois connu

  function jourCourant() { return cfg.jour ? cfg.jour() : null; }
  function monScore() {
    const n = cfg.score ? Number(cfg.score()) : 0;
    return isFinite(n) ? Math.max(0, Math.min(MAX, Math.round(n))) : 0;
  }

  // La série vient du jeu (statistiques du mode Classique), injectée comme le
  // reste : ce module ne connaît ni les clés localStorage ni la notion de série.
  function maSerie() {
    const n = cfg.serie ? Number(cfg.serie()) : 0;
    return isFinite(n) ? Math.max(0, Math.min(SERIE_MAX, Math.round(n))) : 0;
  }

  async function refresh() {
    const jour = jourCourant();
    if (!jour || !global.LPAccount || enCours) return;
    enCours = true;
    try {
      const r = await LPAccount.readLeaderboard(jour);
      if (!r.ok) return;                      // hors ligne : on laisse ce qui est affiché

      const uid = LPAccount.accountUid ? LPAccount.accountUid() : null;
      const cl = classer(r.data, { uid: uid });

      let etat = 'ok';
      if (!uid) etat = 'anonyme';
      else if (!cl.moi) {
        // Pourquoi ce compte n'est-il pas classé : pas de pseudo, ou pas encore
        // de score ? On le DEMANDE plutôt que de le deviner d'après le score.
        // Une seule requête, et seulement tant qu'il n'y a pas de pseudo : dès
        // qu'il y en a un, la réponse est gardée.
        if (!pseudoConnu) {
          try { pseudoConnu = await LPAccount.myPseudo(); } catch (e) { /* réseau : on retentera */ }
        }
        etat = pseudoConnu ? 'sansscore' : 'sanspseudo';
      }
      peindre(cl, etat);
    } finally { enCours = false; }
  }

  // Publie le score du jour, puis rafraîchit. Débouncé : terminer les sept modes
  // d'affilée ne produit qu'un seul écrit.
  function onScoreChange() {
    if (minuteur) clearTimeout(minuteur);
    minuteur = setTimeout(() => { minuteur = null; publier(); }, DEBOUNCE);
  }

  async function publier() {
    const jour = jourCourant();
    const score = monScore();
    if (!jour || !global.LPAccount || !LPAccount.isSignedIn()) return refresh();
    // La série change aussi la ligne : on republie quand l'un OU l'autre bouge.
    const serie = maSerie();
    if (score <= 0 || (score === dernierEnvoi && serie === derniereSerie)) return refresh();
    const r = await LPAccount.pushDailyScore(jour, score, serie);
    if (r && r.ok) { dernierEnvoi = r.score; derniereSerie = serie; }
    await refresh();
  }

  // ── Replier / déplier ─────────────────────────────────────────────────────
  // Une touche SUR le panneau plutôt qu'un réglage enfoui dans les Paramètres :
  // on replie là où l'on regarde. Replié, il ne reste que la barre de titre —
  // jamais rien de moins, sinon plus rien ne permettrait de le rouvrir.
  // Replier ne retire pas du classement : le score continue d'être publié, et la
  // liste d'être rafraîchie en arrière-plan — déplier montre l'état du moment.
  let replie = false;
  function appliquerReplie() {
    const panneau = el('lb-panel'), corps = el('lb-corps'), tete = el('lb-head');
    if (!panneau || !corps || !tete) return;
    panneau.classList.toggle('lb-replie', replie);
    corps.hidden = replie;
    tete.setAttribute('aria-expanded', String(!replie));
    tete.title = replie ? T('Afficher le classement') : T('Réduire le classement');
  }

  function init(o) {
    configure(o);
    // L'état vient du stockage, fourni par app.js ; s'il est illisible, on part
    // déplié. La variable locale fait foi pour la page, même si l'écriture
    // échoue (navigation privée, stockage plein).
    try { replie = !!(cfg.replie && cfg.replie.lire()); } catch (e) { replie = false; }
    appliquerReplie();
    const tete = el('lb-head');
    if (tete) tete.addEventListener('click', () => {
      replie = !replie;
      appliquerReplie();
      try { if (cfg.replie) cfg.replie.ecrire(replie); } catch (e) { /* l'état tient pour la page */ }
    });
    refresh();
    // Le retour sur l'onglet est le moment où l'on veut voir bouger le classement,
    // et c'est déjà celui où le compte se resynchronise.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refresh();
    });
    // Redimensionner change tout : la hauteur de la barre de score, la largeur
    // de la colonne, et la place disponible. On repeint le dernier classement
    // connu — ce qui remesure, et masque ou réaffiche selon la gouttière — sans
    // repasser par le réseau. Amorti, parce que `resize` part en rafale.
    window.addEventListener('resize', replacer);

    // La colonne de jeu s'élargit EN COURS DE PARTIE : la grille du Classique
    // n'existe qu'à partir du premier essai, et c'est le mode le plus large.
    // Sans cette surveillance, le panneau resterait posé sur la largeur d'avant
    // jusqu'à la fin de la partie. (Le panneau est en position fixe, hors flux :
    // le replacer ne peut pas retailler la colonne, donc pas de boucle.)
    const colonne = document.querySelector('main');
    if (colonne && typeof ResizeObserver === 'function') {
      new ResizeObserver(replacer).observe(colonne);
    }
  }

  global.LPLeaderboard = {
    classer: classer, configure: configure, init: init,
    refresh: refresh, onScoreChange: onScoreChange, publier: publier,
    MAX: MAX, TOP: TOP,
  };
})(typeof window !== 'undefined' ? window : this);

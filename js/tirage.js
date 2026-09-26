// ===== TIRAGE DES RÉPONSES DU JOUR (v8.1) =====
// UMD-lite comme versus-rules.js : global LPTirage dans le navigateur, module.exports
// sous Node (tools/test-tirage.js). JUMEAU PYTHON : tools/tirage.py, qui sert la page
// des réponses. Les deux DOIVENT rendre exactement les mêmes réponses : le test les
// compare jour par jour. Toute retouche se fait des deux côtés à la fois.
//
// Avant la v8.1, calendar.json contenait 90 jours de réponses d'avance, lisibles par
// n'importe qui, et devait être régénéré avant chaque push. Il ne garde plus que
// l'ARCHIVE (journées < bascule). À partir de la bascule, chaque journée est calculée
// en rejouant l'historique jour après jour, avec les règles fixées par le propriétaire
// le 26/09/2026 :
//   1. un élément sorti dans un mode n'y ressort pas pendant 90 jours (chaque mode
//      compte pour lui-même) ;
//   2. ensuite, sa chance est proportionnelle à son attente au-delà de ces 90 jours :
//      plus il attend, plus il a de chances, sans jamais de certitude ;
//   3. une nouveauté voit ses chances multipliées JUSQU'À SA PREMIÈRE SORTIE : un nouveau
//      personnage doit arriver au moins une fois dans UN des modes, pas dans chacun
//      (précision du propriétaire) — sorti quelque part, il redevient ordinaire partout ;
//   4. jamais le même personnage dans deux modes le même jour (Classique, Wanted,
//      Silhouette, Émoji, porteur du fruit) ;
//   5. anniversaire : le personnage sort FORCÉMENT dans un des modes, tiré au sort —
//      pas toujours le Classique, pour que ce ne soit pas devinable d'avance.
// L'Opening garde le tirage sans remise d'avant : aucune règle (décision du propriétaire).
//
// STABILITÉ. Un élément n'est éligible qu'à partir de sa DATE D'ENTRÉE (calendar.json →
// entrees) : un ajout ne touche donc jamais ni le passé ni la journée en cours. Élément
// sans date d'entrée = jamais tiré : un oubli retarde son arrivée, il ne casse rien.
// DISCIPLINE : ne jamais supprimer ni réordonner d'éléments dans data.json (l'ordre
// entre dans le tirage) ; renommer un personnage = renommer aussi son entrée. Et ne
// JAMAIS changer GRAINE après la bascule : toutes les journées calculées changeraient,
// passé compris.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LPTirage = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const GRAINE      = 435432186;   // tirée au hasard le 26/09/2026 — ne plus jamais la changer
  const EXCLUSION   = 90;           // jours sans répétition dans un même mode
  // Nouveautés : ×10, pendant 45 jours au plus, et seulement jusqu'à leur 1re sortie (règle 3).
  // Réglé par simulation (15 graines de démonstration, 20 nouveaux personnages) : tous
  // sortis au moins une fois en ~19 jours (27 au pire), environ 1,6 nouveau par jour sur
  // les 5 réponses à personnages les deux premières semaines, et un nouveau au Classique
  // 4 jours sur 14. À ×5, un malchanceux pouvait rester des mois sans sortir.
  const BOOST       = 10;
  const BOOST_JOURS = 45;
  // Ordre de tirage des modes à personnages : il compte pour la règle 4.
  const ORDRE_PERSOS = ['classic', 'wanted', 'silhouette', 'emoji', 'fruit'];
  // Mêmes sels que l'ancien tirage (js/data.js), combinés à GRAINE.
  const SELS = { classic: 1, wanted: 31, fruit: 71, emoji: 137, audio: 53, tome: 181, silhouette: 211, anniv: 7 };

  // Anniversaires (source : wiki One Piece). 'MM-JJ' → noms exacts de data.json.
  const ANNIVERSAIRES = {
    '01-01': ['Portgas D. Ace'],
    '02-06': ['Nico Robin'],
    '03-02': ['Sanji'],
    '03-09': ['Franky'],
    '03-20': ['Sabo'],
    '04-01': ['Usopp'],
    '04-02': ['Jimbei'],
    '04-03': ['Brook'],
    '04-06': ['Edward Newgate'],
    '05-02': ['Garp'],
    '05-05': ['Monkey D. Luffy'],
    '05-13': ['Rayleigh'],
    '07-03': ['Nami'],
    '09-02': ['Boa Hancock'],
    '10-06': ['Trafalgar D. Water Law'],
    '11-11': ['Roronoa Zoro'],
    '12-24': ['Tony Tony Chopper'],
  };

  // ── Hasard déterministe (identique à js/data.js et à tools/tirage.py) ──────────
  function seedHash(base, salt) {
    let h = Math.imul((base + salt) >>> 0, 2654435761) >>> 0;
    h = (h ^ (h >>> 16)) >>> 0;
    h = Math.imul(h, 0x45d9f3b) >>> 0;
    h = (h ^ (h >>> 16)) >>> 0;
    return h;
  }
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
      t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function rngDu(n, sel, graine) { return mulberry32(seedHash((n + graine) >>> 0, sel)); }

  // Tirage sans remise d'avant la v8.1, gardé pour l'Opening (copie de js/data.js).
  function shufflePerm(cycle, salt, n) {
    const rng = mulberry32(seedHash(cycle, salt));
    const a = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = (rng() * (i + 1)) | 0;
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function bagPick(day, salt, n) {
    if (n <= 1) return 0;
    const cycle = Math.floor(day / n);
    const pos = day - cycle * n;
    let perm = shufflePerm(cycle, salt, n);
    if (cycle > 0 && perm[0] === shufflePerm(cycle - 1, salt, n)[n - 1]) perm = perm.slice(1).concat(perm[0]);
    return perm[pos];
  }

  // ── Dates : numéro de jour (jours depuis 1970) ⇄ 'AAAA-MM-JJ' ─────────────────
  const pad = x => String(x).padStart(2, '0');
  function numJour(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  }
  function isoDe(n) {
    const dt = new Date(n * 86400000);
    return dt.getUTCFullYear() + '-' + pad(dt.getUTCMonth() + 1) + '-' + pad(dt.getUTCDate());
  }

  // ── Préparation : pools, dates d'entrée, historique de l'archive ─────────────
  function preparer(data, focus, cal, opts) {
    const graine = (opts && opts.graine !== undefined) ? opts.graine : GRAINE;
    const E = (cal && cal.entrees) || {};
    const entrees = groupe => {
      const m = {};
      Object.keys(E[groupe] || {}).forEach(date => {
        (E[groupe][date] || []).forEach(id => { m[String(id)] = numJour(date); });
      });
      return m;
    };
    const eP = entrees('personnages'), eF = entrees('fruits'), eS = entrees('silhouettes'), eT = entrees('tomes');
    const de = (m, id) => (Object.prototype.hasOwnProperty.call(m, String(id)) ? m[String(id)] : Infinity);
    const chars = data.CHARACTERS || [];
    const silKey = c => (Array.isArray(c.img) ? c.img[0] : c.img);
    const perso = c => ({ id: c.name, perso: c.name, entree: de(eP, c.name) });

    const pools = {
      classic:    chars.map(perso),
      wanted:     chars.filter(c => c.img !== null && c.img !== undefined).map(perso),
      emoji:      chars.filter(c => Array.isArray(c.emoji) && c.emoji.length > 0).map(perso),
      silhouette: chars.filter(c => silKey(c) && focus && focus[silKey(c)])
                       .map(c => ({ id: c.name, perso: c.name, entree: Math.max(de(eP, c.name), de(eS, c.name)) })),
      fruit:      (data.FRUITS || []).map(f => ({ id: f.name, perso: f.holder,
                                                  entree: Math.max(de(eF, f.name), de(eP, f.holder)) })),
      tome:       (data.TOMES || []).map(t => ({ id: t, perso: null, entree: de(eT, t) })),
    };

    const archive = (cal && cal.days) || {};
    const jours = Object.keys(archive).sort();
    const derniers = {};
    Object.keys(pools).forEach(m => { derniers[m] = new Map(); });
    jours.forEach(iso => {
      const j = archive[iso], n = numJour(iso);
      Object.keys(pools).forEach(m => {
        if (j && j[m] !== undefined && j[m] !== null) derniers[m].set(String(j[m]), n);
      });
    });
    // Dernière sortie de chaque PERSONNAGE, tous modes confondus (porteur du fruit compris) :
    // c'est elle qui éteint le bonus d'un nouveau (règle 3).
    const porteurs = {};
    (data.FRUITS || []).forEach(f => { porteurs[f.name] = f.holder; });
    const sortiPerso = new Map();
    jours.forEach(iso => noterPersos(archive[iso], numJour(iso), porteurs, sortiPerso));
    const bascule = (cal && cal.bascule) ? numJour(cal.bascule) : null;
    return {
      graine, pools, archive, derniers, bascule, porteurs, sortiPerso,
      openings: data.OPENINGS || [],
      debutHist: jours.length ? numJour(jours[0]) : (bascule !== null ? bascule : 0),
      prochain: bascule, cache: {},
    };
  }

  const MODES_NOMS = ['classic', 'wanted', 'silhouette', 'emoji'];   // réponses = noms de personnages
  function noterPersos(j, n, porteurs, sortiPerso) {
    if (!j) return;
    MODES_NOMS.forEach(m => { if (j[m] !== undefined && j[m] !== null) sortiPerso.set(j[m], n); });
    if (j.fruit !== undefined && j.fruit !== null && porteurs[j.fruit]) sortiPerso.set(porteurs[j.fruit], n);
  }

  // Règle 3 : l'élément est-il encore une nouveauté favorisée ? Oui tant qu'il est entré
  // depuis moins de BOOST_JOURS ET qu'il n'est jamais sorti depuis son entrée — dans
  // n'importe quel mode pour un personnage, au mode Fruit pour un fruit, au mode Tome pour
  // un tome.
  function booste(ctx, mode, el, n) {
    if (!(n - el.entree < BOOST_JOURS)) return false;
    const vu = (mode === 'fruit' || mode === 'tome')
      ? ctx.derniers[mode].get(String(el.id))
      : ctx.sortiPerso.get(el.perso);
    return !(vu !== undefined && vu >= el.entree);
  }

  // Un élément pour un mode (règles 1 à 4). null si le pool est vide.
  function tirer(ctx, mode, n, pris) {
    const der = ctx.derniers[mode];
    const cand = [], poids = [];
    let secours = null, secoursAttente = -1;
    ctx.pools[mode].forEach(el => {
      if (el.entree > n) return;
      if (el.perso && pris.has(el.perso)) return;
      const vu = der.get(String(el.id));
      const attente = n - (vu !== undefined ? vu : ctx.debutHist);
      if (attente > secoursAttente) { secours = el; secoursAttente = attente; }
      if (attente <= EXCLUSION) return;
      let w = attente - EXCLUSION;
      if (booste(ctx, mode, el, n)) w *= BOOST;
      cand.push(el); poids.push(w);
    });
    // Filet : pool trop petit pour 90 jours d'exclusion → le plus ancien.
    if (!cand.length) return secours;
    const rng = rngDu(n, SELS[mode], ctx.graine);
    let total = 0;
    poids.forEach(w => { total += w; });
    const r = rng() * total;
    let acc = 0;
    for (let i = 0; i < cand.length; i++) {
      acc += poids[i];
      if (r < acc) return cand[i];
    }
    return cand[cand.length - 1];
  }

  function calculer(ctx, n) {
    const res = {}, pris = new Set();
    // Règle 5 : l'anniversaire d'abord, dans un mode tiré au sort.
    const rngA = rngDu(n, SELS.anniv, ctx.graine);
    (ANNIVERSAIRES[isoDe(n).slice(5)] || []).forEach(nom => {
      if (pris.has(nom)) return;
      const possibles = [];
      ORDRE_PERSOS.forEach(mode => {
        if (res[mode] !== undefined) return;
        const el = ctx.pools[mode].find(e => e.perso === nom && e.entree <= n);
        if (el) possibles.push([mode, el]);
      });
      if (!possibles.length) return;
      const [mode, el] = possibles[Math.floor(rngA() * possibles.length)];
      res[mode] = el.id;
      pris.add(nom);
    });
    // Règles 1 à 4 pour les autres modes, puis le tome (hors règle 4).
    ORDRE_PERSOS.concat(['tome']).forEach(mode => {
      if (res[mode] !== undefined) return;
      const el = tirer(ctx, mode, n, pris);
      res[mode] = el ? el.id : null;
      if (el && el.perso) pris.add(el.perso);
    });
    // Opening : tirage sans remise d'avant, sans règle.
    res.audio = ctx.openings.length ? ctx.openings[bagPick(n, SELS.audio, ctx.openings.length)].id : null;
    Object.keys(ctx.pools).forEach(m => {
      if (res[m] !== null && res[m] !== undefined) ctx.derniers[m].set(String(res[m]), n);
    });
    noterPersos(res, n, ctx.porteurs, ctx.sortiPerso);
    return res;
  }

  // Réponses d'une journée 'AAAA-MM-JJ' : l'archive avant la bascule, le calcul après.
  // Le calcul avance jour par jour depuis la bascule (l'historique en dépend) et garde
  // tout en mémoire : demander une date, c'est aussi calculer toutes celles d'avant.
  function jour(ctx, iso) {
    const n = numJour(iso);
    if (ctx.bascule === null || n < ctx.bascule) return ctx.archive[iso] || null;
    while (ctx.prochain <= n) {
      ctx.cache[isoDe(ctx.prochain)] = calculer(ctx, ctx.prochain);
      ctx.prochain++;
    }
    return ctx.cache[iso];
  }

  return { preparer, jour, numJour, isoDe, bagPick, booste, ANNIVERSAIRES,
           GRAINE, EXCLUSION, BOOST, BOOST_JOURS, ORDRE_PERSOS };
});

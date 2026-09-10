// ===== FUSION DE SAUVEGARDES (compte joueur) =====
// SOURCE UNIQUE de la règle de fusion entre la sauvegarde locale (localStorage)
// et celle du compte (Firebase). Fonctions PURES : ni DOM, ni réseau, ni accès
// au localStorage — pour rester testables hors navigateur
// (`node tools/test-save-merge.js`). Bi-environnement comme js/versus-rules.js.
//
// PRINCIPE DIRECTEUR : la fusion est MONOTONE. Elle n'enlève jamais une journée,
// un score, un personnage capturé. Trois conséquences dont on dépend ailleurs :
//   • idempotente     — resynchroniser deux fois ne change rien ;
//   • commutative     — l'ordre des deux camps n'importe pas (hors arbitrage
//                       d'égalité, qui favorise le local) ;
//   • auto-réparante  — deux appareils qui poussent en même temps peuvent perdre
//                       une écriture, la synchro suivante la rattrape.
// C'est ce qui permet de se passer de transactions côté base.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Les clés de journée sont suffixées par dateKeyOf() : 2026-9-8, SANS zéro de
  // remplissage (app.js:1368). Ne pas « corriger » en \d{2}.
  const DAY = '(\\d{4}-\\d{1,2}-\\d{1,2})';
  const RE_GS      = new RegExp('^op-gs-([a-z]+)-' + DAY + '$');
  const RE_DAILY   = new RegExp('^op-daily-' + DAY + '$');
  const RE_SCORE   = new RegExp('^op-score-' + DAY + '$');
  const RE_RESULT  = new RegExp('^op-result-' + DAY + '$');
  const RE_PERFECT = new RegExp('^op-perfect-' + DAY + '$');
  const RE_COUNTED = new RegExp('^op-day-counted-' + DAY + '$');
  const RE_STATS   = /^op-stats-([a-z]+)$/;

  // Clés volontairement NON synchronisées : elles décrivent l'appareil, pas la
  // progression. Un réglage de taille de texte fait sur un téléphone n'a rien à
  // faire sur un écran de bureau, et « le site a changé de thème tout seul » est
  // un bug qu'on ne diagnostique jamais.
  const LOCAL_ONLY = new Set([
    'op-size', 'op-cb', 'op-sfx', 'op-theme', 'op-yest-open',
    // Classement du jour replié : goût d'affichage d'un appareil. Le replier
    // sur l'ordinateur ne doit pas le replier sur le téléphone.
    'op-lb-collapsed',
    'op-versus-volume', 'op-versus-pseudo',
    // Écrite par js/i18n.js à la bascule FR/EN, mais relue NULLE PART : la
    // langue se déduit du chemin de l'URL (/en/). Elle remontait quand même au
    // compte, la règle par défaut étant de tout sauvegarder plutôt que
    // d'oublier une clé. Un réglage d'appareil n'a rien à y faire.
    'op-lang',
    'op-v5-seen', 'op-wn-sil-seen', 'op-wn-versus-seen',
    'op-versus-resume',     // jeton d'un duel en cours SUR CET APPAREIL
    'op-backup-premerge',   // filet de sécurité local : ne remonte jamais au compte
    // Comptabilité de la synchro : décrit l'état de CET appareil vis-à-vis du
    // compte. La renvoyer au compte n'aurait aucun sens et la ferait diverger.
    'op-account-uid',       // compte actuellement connecté ici
    'op-sync-stamps',       // miroir des horodatages de journée déjà intégrés
    'op-sync-dirty',        // journées poussées sans succès (réseau coupé), à retenter
  ]);

  // Sous-ensemble de LOCAL_ONLY qui décrit le LIEN avec le compte, et non un
  // goût d'affichage. Ces clés doivent survivre à un remplacement en bloc des
  // clés « op- » — typiquement l'import d'un fichier de sauvegarde. Sans ça,
  // importer une sauvegarde effacerait `op-account-uid`, et l'appareil
  // oublierait le compte alors que la session Firebase est toujours vivante.
  // Et dans l'autre sens : la valeur venue d'un FICHIER ne doit jamais
  // s'imposer, sinon la sauvegarde d'un autre joueur ferait pointer cet
  // appareil vers un compte qui n'est pas le sien.
  const SYNC_KEYS = new Set(['op-account-uid', 'op-sync-stamps', 'op-sync-dirty']);

  // ── Utilitaires ──────────────────────────────────────────────────────────
  function parse(raw, fallback) {
    if (typeof raw !== 'string') return fallback;
    try {
      const v = JSON.parse(raw);
      return (v === null || v === undefined) ? fallback : v;
    } catch (e) { return fallback; }
  }
  const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const num   = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

  // Union de deux listes en préservant l'ordre : le local d'abord, puis ce que
  // le compte apporte en plus (carnet de capture, îles déjà comptées).
  function unionList(a, b) {
    const out  = Array.isArray(a) ? a.slice() : [];
    const seen = new Set(out.map(String));
    (Array.isArray(b) ? b : []).forEach(v => {
      if (!seen.has(String(v))) { out.push(v); seen.add(String(v)); }
    });
    return out;
  }

  // ── Lecture d'un camp pour une (journée, mode) ───────────────────────────
  // Les trois morceaux d'une partie vivent dans trois clés distinctes : la
  // grille (op-gs-<mode>-<jour>), le score et le résultat (deux maps indexées
  // par mode). Ils doivent être choisis ENSEMBLE, sinon on afficherait une
  // grille de 4 essais sous le score d'une partie gagnée en 2.
  function readSide(save, day, mode) {
    const scores  = parse(save['op-score-'  + day], {});
    const results = parse(save['op-result-' + day], {});
    const gsRaw   = save['op-gs-' + mode + '-' + day];
    const gs      = parse(gsRaw, null);
    const res     = isObj(results) && isObj(results[mode]) ? results[mode] : null;
    return {
      finished: !!res,
      score:    isObj(scores) ? num(scores[mode]) : 0,
      scoreSet: isObj(scores) && scores[mode] !== undefined,
      tries:    res ? num(res.tries) : Infinity,
      guesses:  (gs && Array.isArray(gs.guesses)) ? gs.guesses.length : 0,
      gsRaw:    typeof gsRaw === 'string' ? gsRaw : null,
      result:   res,
      hasAny:   !!res || typeof gsRaw === 'string' || (isObj(scores) && scores[mode] !== undefined),
    };
  }

  // Arbitrage d'une (journée, mode) jouée des deux côtés. Retourne 'a' ou 'b'.
  //   1. terminé bat en cours ;
  //   2. deux terminés -> meilleur score, puis moins d'essais ;
  //   3. deux en cours -> le plus d'essais posés.
  // Toute égalité résiduelle revient au camp A (le local) : arbitraire, mais
  // déterministe, ce qui garde la fusion idempotente.
  function pickSide(a, b) {
    if (a.finished !== b.finished) return a.finished ? 'a' : 'b';
    if (a.finished) {
      if (a.score !== b.score) return a.score > b.score ? 'a' : 'b';
      if (a.tries !== b.tries) return a.tries < b.tries ? 'a' : 'b';
      return 'a';
    }
    if (a.guesses !== b.guesses) return a.guesses > b.guesses ? 'a' : 'b';
    return 'a';
  }

  // ── Fusion ───────────────────────────────────────────────────────────────
  // local / cloud : maps plates { 'op-...': 'chaîne' } — exactement ce que
  // produit déjà exportSave(). opts.rankOf(score) -> libellé du rang, optionnel.
  function mergeSaves(local, cloud, opts) {
    const A = isObj(local) ? local : {};
    const B = isObj(cloud) ? cloud : {};
    const options = opts || {};
    const out = {};

    // 1. Réglages de l'appareil : recopiés du local, jamais négociés.
    LOCAL_ONLY.forEach(k => { if (A[k] !== undefined) out[k] = A[k]; });

    // 2. Inventaire des journées et des modes vus de chaque côté.
    const days = new Map(); // jour -> Set(modes)
    const noteDay = (day, mode) => {
      if (!days.has(day)) days.set(day, new Set());
      if (mode) days.get(day).add(mode);
    };
    [A, B].forEach(save => {
      Object.keys(save).forEach(k => {
        let m;
        if ((m = RE_GS.exec(k))) { noteDay(m[2], m[1]); return; }
        if ((m = RE_SCORE.exec(k)) || (m = RE_RESULT.exec(k))) {
          noteDay(m[1], null);
          const map = parse(save[k], {});
          if (isObj(map)) Object.keys(map).forEach(mode => noteDay(m[1], mode));
          return;
        }
        if ((m = RE_DAILY.exec(k)) || (m = RE_PERFECT.exec(k)) || (m = RE_COUNTED.exec(k))) noteDay(m[1], null);
      });
    });

    // 3. Journée par journée, mode par mode.
    let daysAdded = 0, daysTouched = 0;
    days.forEach((modes, day) => {
      const scores = {}, results = {};
      let touched = false;
      const localHadDay = A['op-score-' + day] !== undefined
                       || A['op-result-' + day] !== undefined
                       || A['op-daily-' + day] !== undefined;

      modes.forEach(mode => {
        const a = readSide(A, day, mode);
        const b = readSide(B, day, mode);
        if (!a.hasAny && !b.hasAny) return;
        const win = !a.hasAny ? 'b' : !b.hasAny ? 'a' : pickSide(a, b);
        const s = win === 'a' ? a : b;
        if (s.gsRaw !== null)  out['op-gs-' + mode + '-' + day] = s.gsRaw;
        if (s.finished)        results[mode] = s.result;
        if (s.scoreSet)        scores[mode]  = s.score;
        if (win === 'b')       touched = true;
      });

      if (Object.keys(scores).length)  out['op-score-'  + day] = JSON.stringify(scores);
      if (Object.keys(results).length) out['op-result-' + day] = JSON.stringify(results);

      // Cibles du jour : identiques des deux côtés (le calendrier fait foi), on
      // prend simplement celle qui existe.
      const daily = A['op-daily-' + day] !== undefined ? A['op-daily-' + day] : B['op-daily-' + day];
      if (daily !== undefined) out['op-daily-' + day] = daily;

      // Sans-faute fêté, et journée déjà comptée dans l'agrégat Firebase : union.
      // Pour day-counted c'est le SENS qui protège — compté d'un côté = compté,
      // sinon changer d'appareil gonflerait le compteur public de la journée.
      if (A['op-perfect-' + day] || B['op-perfect-' + day]) out['op-perfect-' + day] = '1';
      if (A['op-day-counted-' + day] || B['op-day-counted-' + day]) out['op-day-counted-' + day] = '1';

      if (!localHadDay && (B['op-score-' + day] !== undefined || B['op-result-' + day] !== undefined)) daysAdded++;
      else if (touched) daysTouched++;
    });

    // 4. Score cumulé : RECALCULÉ, jamais fusionné. Deux appareils à 400 000 et
    // 300 000 points sur des journées qui se recoupent en partie : le max perd
    // des points, la somme en invente, et le rang pirate devient faux dans les
    // deux cas. Le total est exactement la somme des scores de toutes les
    // journées — saveModeScore et l'incrément du cumul sont appelés sous la
    // même condition (app.js:2671). Plancher aux deux valeurs stockées pour ne
    // rien retirer à un joueur dont l'historique de scores serait incomplet.
    let sum = 0;
    Object.keys(out).forEach(k => {
      if (!RE_SCORE.test(k)) return;
      const map = parse(out[k], {});
      if (isObj(map)) Object.keys(map).forEach(mode => { sum += num(map[mode]); });
    });
    const cumul = Math.max(sum, num(A['op-cumulative-score']), num(B['op-cumulative-score']));
    out['op-cumulative-score'] = String(cumul);
    if (typeof options.rankOf === 'function') {
      out['op-pirate-rank'] = String(options.rankOf(cumul));
    } else if (A['op-pirate-rank'] || B['op-pirate-rank']) {
      out['op-pirate-rank'] = num(A['op-cumulative-score']) >= num(B['op-cumulative-score'])
        ? (A['op-pirate-rank'] || B['op-pirate-rank'])
        : (B['op-pirate-rank'] || A['op-pirate-rank']);
    }

    // 5. Statistiques par mode : prises EN BLOC du côté le plus avancé, puis on
    // relève le meilleur maxStreak. Un recalcul depuis les résultats serait
    // faux : une rediffusion écrit bien op-result-<jour> mais ne compte pas dans
    // les stats (app.js:2653), et rien ne distingue les deux après coup. Prendre
    // le bloc entier garde l'objet cohérent avec sa distribution.
    const statKeys = new Set(Object.keys(A).concat(Object.keys(B)).filter(k => RE_STATS.test(k)));
    statKeys.forEach(k => {
      const a = parse(A[k], null), b = parse(B[k], null);
      if (!isObj(a)) { if (isObj(b)) out[k] = B[k]; return; }
      if (!isObj(b)) { out[k] = A[k]; return; }
      const merged = Object.assign({}, num(b.played) > num(a.played) ? b : a);
      merged.maxStreak = Math.max(num(a.maxStreak), num(b.maxStreak));
      // La série EN COURS appartient au camp qui a joué le plus récemment.
      const recent = String(b.lastDate || '') > String(a.lastDate || '') ? b : a;
      merged.currentStreak = num(recent.currentStreak);
      merged.lastDate = recent.lastDate || null;
      out[k] = JSON.stringify(merged);
    });

    // 6. Records du mode Infini et duels : max champ par champ. Le Versus peut
    // sous-compter si on duelle sur deux appareils entre deux synchros — jamais
    // sur-compter, ce qui est le bon sens de l'erreur.
    ['op-inf-record', 'op-inf-streak'].forEach(k => {
      if (A[k] === undefined && B[k] === undefined) return;
      out[k] = String(Math.max(num(A[k]), num(B[k])));
    });
    if (A['op-versus-stats'] !== undefined || B['op-versus-stats'] !== undefined) {
      const a = parse(A['op-versus-stats'], {}) || {};
      const b = parse(B['op-versus-stats'], {}) || {};
      out['op-versus-stats'] = JSON.stringify({ w: Math.max(num(a.w), num(b.w)), l: Math.max(num(a.l), num(b.l)) });
    }

    // 7. Listes cumulatives : union.
    const capturedBefore = parse(A['op-captured'], []);
    ['op-captured', 'op-islands-reached', 'op-map-unlocked'].forEach(k => {
      if (A[k] === undefined && B[k] === undefined) return;
      const a = parse(A[k], null), b = parse(B[k], null);
      if (!Array.isArray(a) && !Array.isArray(b)) { out[k] = A[k] !== undefined ? A[k] : B[k]; return; }
      out[k] = JSON.stringify(unionList(a, b));
    });

    // 8. Tout le reste : une clé op- non prévue ici est conservée plutôt que
    // perdue. Le local tranche si les deux la portent — une version future du
    // jeu peut ajouter une clé sans que la fusion ne l'efface entre-temps.
    new Set(Object.keys(A).concat(Object.keys(B))).forEach(k => {
      if (out[k] !== undefined || LOCAL_ONLY.has(k) || !k.startsWith('op-')) return;
      out[k] = A[k] !== undefined ? A[k] : B[k];
    });

    const capturedAfter = parse(out['op-captured'], []);
    return {
      data: out,
      report: {
        daysAdded,
        daysTouched,
        scoreDelta: cumul - num(A['op-cumulative-score']),
        capturedAdded: (Array.isArray(capturedAfter) ? capturedAfter.length : 0)
                     - (Array.isArray(capturedBefore) ? capturedBefore.length : 0),
      },
    };
  }

  // Extrait les clés d'UNE journée : ce qu'on pousse en fin de partie (~2 Ko)
  // plutôt que la sauvegarde entière, qui grossit de ~2 Ko par jour.
  function daySlice(save, day) {
    const out = {};
    Object.keys(save || {}).forEach(k => {
      const g = RE_GS.exec(k);
      if (g) { if (g[2] === day) out[k] = save[k]; return; }
      const m = RE_DAILY.exec(k) || RE_SCORE.exec(k) || RE_RESULT.exec(k)
             || RE_PERFECT.exec(k) || RE_COUNTED.exec(k);
      if (m && m[1] === day) out[k] = save[k];
    });
    return out;
  }

  // Le complément de daySlice : tout ce qui n'appartient à aucune journée et
  // qui a vocation à être synchronisé (cumul, rang, stats, carnet, records…).
  // Défini en NÉGATIF, pour qu'une clé ajoutée par une version future du jeu
  // soit sauvegardée d'office plutôt qu'oubliée en silence.
  function aggSlice(save) {
    const out = {};
    Object.keys(save || {}).forEach(k => {
      if (!k.startsWith('op-') || LOCAL_ONLY.has(k)) return;
      if (RE_GS.test(k) || RE_DAILY.test(k) || RE_SCORE.test(k)
       || RE_RESULT.test(k) || RE_PERFECT.test(k) || RE_COUNTED.test(k)) return;
      out[k] = save[k];
    });
    return out;
  }

  // Journées présentes dans une sauvegarde, triées chronologiquement (les clés
  // n'étant pas remplies de zéros, un tri lexical brut mettrait 2026-10-1 avant
  // 2026-9-8).
  function daysOf(save) {
    const set = new Set();
    Object.keys(save || {}).forEach(k => {
      const g = RE_GS.exec(k);
      if (g) { set.add(g[2]); return; }
      const m = RE_DAILY.exec(k) || RE_SCORE.exec(k) || RE_RESULT.exec(k)
             || RE_PERFECT.exec(k) || RE_COUNTED.exec(k);
      if (m) set.add(m[1]);
    });
    const pad = d => d.split('-').map(n => String(n).padStart(2, '0')).join('-');
    return [...set].sort((x, y) => (pad(x) < pad(y) ? -1 : pad(x) > pad(y) ? 1 : 0));
  }

  return { mergeSaves, daySlice, aggSlice, daysOf, LOCAL_ONLY, SYNC_KEYS };
});

// ===== COMPTE JOUEUR — TRANSPORT ET SYNCHRONISATION =====
// Ce que fait ce fichier : porter la sauvegarde entre le localStorage et la
// Realtime Database, et décider QUAND. La règle de fusion, elle, vit dans
// js/save-merge.js et n'est pas dupliquée ici.
// Ce qu'il ne fait PAS : la connexion elle-même. La couche Firebase Auth se
// branche par setAuthProvider() — tant qu'aucun compte n'est connecté, ce
// module ne fait strictement rien et le jeu tourne exactement comme avant.
//
// TROIS MOMENTS DE SYNCHRO, et pourquoi :
//   • au démarrage, AVANT le rendu — c'est ce qui fait qu'un mode terminé sur
//     un autre appareil apparaît déjà terminé au premier affichage, sans
//     clignotement ni rechargement ;
//   • au retour sur l'onglet — pour l'appareil resté ouvert pendant qu'on
//     jouait sur l'autre ;
//   • en fin de partie — un seul écrit, la journée courante (~1,5 Ko).
//
// POURQUOI PAS DE TRANSACTION : la fusion de save-merge.js est monotone, donc
// idempotente. Deux appareils qui poussent en même temps peuvent perdre une
// écriture ; la synchro suivante la rattrape toute seule. C'est aussi pour ça
// qu'un échec réseau n'est jamais grave : la journée est notée « à repousser »
// et repart au prochain démarrage.
(function () {
  'use strict';

  const SM = window;   // save-merge.js expose ses fonctions en globals
  const K_UID    = 'op-account-uid';
  const K_STAMPS = 'op-sync-stamps';
  const K_DIRTY  = 'op-sync-dirty';
  const K_BACKUP = 'op-backup-premerge';
  // Chaîne dupliquée à l'identique dans js/versus.js et js/app.js (LS.versusPseudo) :
  // page autonome, même convention que les autres clés `op-versus-*`.
  const K_VPSEUDO = 'op-versus-pseudo';

  const SAVE_V      = 1;
  const BOOT_MS     = 1500;   // au-delà, on démarre en local et on rattrape après
  const NET_MS      = 8000;   // requêtes hors démarrage
  const PUSH_DEBOUNCE_MS = 3000;

  let DB   = '';      // URL de la base, posée par configure()
  let auth = null;    // { uid(): string|null, token(): Promise<string|null> }
  let getActiveDay = () => null;
  let onRemoteChange = () => {};
  let pushTimer = null;
  let syncing = false;

  // ── localStorage (autoporteur : ce module peut charger avant app.js) ──────
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } };
  const lsDel = k => { try { localStorage.removeItem(k); } catch (e) {} };
  const parse = (raw, fb) => { try { const v = JSON.parse(raw); return v == null ? fb : v; } catch (e) { return fb; } };

  // ── Sauvegarde locale ────────────────────────────────────────────────────
  // Même périmètre que l'export fichier de app.js : les clés « op- » et elles
  // seules. Les valeurs sont transportées telles quelles, jamais ré-encodées,
  // pour que la sauvegarde du compte et le fichier d'export restent le même
  // format et restent interchangeables.
  function readLocal() {
    const out = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('op-')) out[k] = localStorage.getItem(k);
      }
    } catch (e) { /* stockage inaccessible (navigation privée) : sauvegarde vide */ }
    return out;
  }

  // Remplace la progression locale par `data`. Ne touche QU'AUX clés « op- »,
  // comme l'import fichier. Une copie de l'état précédent est déposée avant,
  // parce que c'est la seule opération du site capable d'effacer un an de jeu.
  function applyLocal(data, withBackup) {
    if (withBackup) {
      const avant = readLocal();
      delete avant[K_BACKUP];   // ne jamais empiler les copies l'une dans l'autre
      lsSet(K_BACKUP, JSON.stringify({ at: Date.now(), data: avant }));
    }
    const garder = lsGet(K_BACKUP);
    try {
      Object.keys(localStorage).filter(k => k.startsWith('op-')).forEach(lsDel);
    } catch (e) { return false; }
    let ok = true;
    Object.keys(data).forEach(k => { if (!lsSet(k, data[k])) ok = false; });
    if (garder && !data[K_BACKUP]) lsSet(K_BACKUP, garder);
    return ok;
  }

  // ── Transport REST ───────────────────────────────────────────────────────
  // On reste sur fetch + REST plutôt que sur le SDK temps réel : c'est ce que
  // fait déjà le reste du site, et surtout une connexion permanente par joueur
  // consommerait le quota des 100 connexions simultanées du palier gratuit.

  // Clés interdites par la base : . $ # [ ] /. Aucune clé du jeu n'en contient,
  // mais une clé ajoutée un jour sans y penser ferait échouer TOUTE la requête.
  // On l'écarte plutôt que de perdre la synchro entière pour une clé.
  const KEY_OK = /^[^.$#[\]\/\x00-\x1f\x7f]+$/;
  function sanitize(obj, ou) {
    const out = {};
    Object.keys(obj).forEach(k => {
      if (KEY_OK.test(k)) out[k] = obj[k];
      else console.warn(`[compte] clé non transportable, ignorée (${ou}) :`, k);
    });
    return out;
  }

  async function req(method, path, body, ms) {
    if (!DB || !auth) return { ok: false, status: 0 };
    let token = await auth.token();
    if (!token) return { ok: false, status: 401 };

    const once = async tok => {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), ms || NET_MS);
      try {
        const r = await fetch(`${DB}/${path}.json?auth=${encodeURIComponent(tok)}`, {
          method,
          signal: ctrl.signal,
          headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        const data = r.ok && method !== 'DELETE' ? await r.json().catch(() => null) : null;
        return { ok: r.ok, status: r.status, data };
      } finally { clearTimeout(to); }
    };

    try {
      const r = await once(token);
      // 401 : jeton expiré (une heure de validité). Un seul rafraîchissement,
      // puis on abandonne — sinon on boucle sur un compte réellement révoqué.
      if (r.status === 401 && auth.token) {
        token = await auth.token(true);
        if (token) return await once(token);
      }
      return r;
    } catch (e) {
      return { ok: false, status: 0, aborted: e && e.name === 'AbortError' };
    }
  }

  const uidPath = () => `saves/${auth.uid()}`;

  // Le rang pirate se déduit du cumul, que la fusion recalcule. app.js porte le
  // barème ; ce module ne le duplique pas et se contente de le passer, quand il
  // est là — ce fichier peut charger avant app.js, et tourne aussi sous Node
  // dans les tests, où le barème n'existe pas.
  function mergeOpts() {
    return (typeof window.getRankFromScore === 'function')
      ? { rankOf: s => window.getRankFromScore(s).title }
      : undefined;
  }

  // Index des journées et leurs horodatages : ~2 Ko, une seule requête, et il
  // dit exactement quelles journées ont bougé ailleurs. C'est ce qui évite de
  // retélécharger la sauvegarde entière (174 Ko à 114 journées) à chaque fois.
  const pullMeta   = ms => req('GET', `${uidPath()}/meta`, undefined, ms);
  const pullDay    = (d, ms) => req('GET', `${uidPath()}/days/${d}`, undefined, ms);
  const pullAgg    = ms => req('GET', `${uidPath()}/agg`, undefined, ms);
  const pullAll    = () => req('GET', uidPath(), undefined, 30000);
  const deleteAll  = () => req('DELETE', uidPath());

  // Un seul PATCH multi-chemins : la journée, les agrégats et l'horodatage
  // partent ensemble et atomiquement. Écrire les trois séparément laisserait
  // une fenêtre où un autre appareil verrait un score sans sa grille.
  async function pushDay(day) {
    const local = readLocal();
    const jour  = sanitize(SM.daySlice(local, day), `journée ${day}`);
    const agg   = sanitize(SM.aggSlice(local), 'agrégats');
    const now   = Date.now();
    const body  = { [`days/${day}`]: jour, agg, 'meta/v': SAVE_V, 'meta/updatedAt': now, [`meta/dayStamps/${day}`]: now };
    const r = await req('PATCH', uidPath(), body);
    if (r.ok) {
      const st = parse(lsGet(K_STAMPS), {});
      st[day] = now;
      lsSet(K_STAMPS, JSON.stringify(st));
      undirty(day);
    } else {
      dirty(day);
    }
    return r.ok;
  }

  // Première mise en ligne d'un compte vide : toute la progression d'un coup.
  async function pushEverything() {
    const local = readLocal();
    const days = SM.daysOf(local);
    const now = Date.now();
    const body = { agg: sanitize(SM.aggSlice(local), 'agrégats'), 'meta/v': SAVE_V, 'meta/updatedAt': now };
    const stamps = {};
    days.forEach(d => {
      body[`days/${d}`] = sanitize(SM.daySlice(local, d), `journée ${d}`);
      stamps[d] = now;
    });
    body['meta/dayStamps'] = stamps;
    const r = await req('PATCH', uidPath(), body, 30000);
    if (r.ok) lsSet(K_STAMPS, JSON.stringify(stamps));
    return r.ok;
  }

  // ── Pseudo réservé ───────────────────────────────────────────────────────
  // L'unicité est garantie par la RÈGLE de la base, pas ici : écrire dans
  // `pseudos/{nom}` n'est permis que si la case est vide ou déjà à nous. Deux
  // joueurs qui réservent le même nom en même temps : un passe, l'autre reçoit
  // un refus. Ce code ne fait donc que présenter proprement ce que la base
  // décide — il ne « protège » rien, et ne doit surtout pas donner l'illusion
  // de le faire.
  const PSEUDO_RE = /^[a-zA-Z0-9_-]{3,16}$/;
  const normPseudo = n => String(n == null ? '' : n).trim().toLowerCase();
  const pseudoValide = n => PSEUDO_RE.test(String(n == null ? '' : n).trim());

  // Nom réservé par ce compte, ou null. Lu depuis notre propre méta.
  async function myPseudo() {
    if (!isSignedIn()) return null;
    const r = await req('GET', `${uidPath()}/meta/pseudo`);
    return (r.ok && typeof r.data === 'string') ? r.data : null;
  }

  // Disponible ? Un nom qui est DÉJÀ le nôtre compte comme disponible : c'est
  // le cas « je regarde si je peux garder le mien », pas un conflit.
  async function pseudoDisponible(nom) {
    if (!pseudoValide(nom)) return { ok: false, code: 'FORMAT' };
    if (!isSignedIn()) return { ok: false, code: 'NON_CONNECTE' };
    const r = await req('GET', 'pseudos/' + normPseudo(nom));
    if (!r.ok) return { ok: false, code: 'RESEAU' };
    if (r.data === null || r.data === undefined) return { ok: true, libre: true };
    return { ok: true, libre: r.data === auth.uid(), aMoi: r.data === auth.uid() };
  }

  // Un changement de nom par 24 h. Le délai est porté par la RÈGLE, pas par ce
  // fichier : `pseudo-delai/{uid}` n'accepte une écriture que si la précédente
  // date de plus d'un jour, ne peut jamais être supprimé, et sa valeur doit être
  // l'horloge du serveur. La règle de `pseudos/{nom}` exige à son tour que cet
  // horodatage vienne d'être posé DANS LA MÊME écriture — d'où le PATCH atomique
  // plus bas. Réserver sans déclencher le délai est donc impossible, y compris
  // depuis la console du navigateur.
  const DELAI_MS = 24 * 60 * 60 * 1000;

  // Millisecondes restantes avant de pouvoir changer de nom, 0 si c'est ouvert.
  // Le calcul se fait sur l'horloge LOCALE : c'est un affichage, l'autorité
  // reste la règle, qui utilise celle du serveur.
  async function delaiRestant() {
    if (!isSignedIn()) return 0;
    const r = await req('GET', 'pseudo-delai/' + auth.uid());
    if (!r.ok || typeof r.data !== 'number') return 0;
    const reste = r.data + DELAI_MS - Date.now();
    return reste > 0 ? reste : 0;
  }

  // Réserve le nom. On pose la NOUVELLE case avant de libérer l'ancienne : dans
  // l'autre sens, un échec au milieu laisserait le joueur sans aucun pseudo.
  // Le prix est qu'un échec de libération laisse une case orpheline — ennuyeux,
  // mais réparable au prochain changement, alors que perdre son nom ne l'est pas.
  async function claimPseudo(nom) {
    if (!isSignedIn()) return { ok: false, code: 'NON_CONNECTE' };
    const affiche = String(nom == null ? '' : nom).trim();
    if (!pseudoValide(affiche)) return { ok: false, code: 'FORMAT' };
    const cle = normPseudo(affiche);

    const ancien = await myPseudo();
    const ancienneCle = ancien ? normPseudo(ancien) : null;
    if (ancienneCle === cle) {
      // Même nom à la casse près : ce n'est pas un changement, le délai ne
      // s'applique pas et la case de l'index ne bouge pas.
      const m = await req('PATCH', uidPath(), { 'meta/pseudo': affiche });
      return m.ok ? { ok: true, pseudo: affiche } : { ok: false, code: 'RESEAU' };
    }

    // Le délai est demandé AVANT d'écrire, uniquement pour pouvoir annoncer le
    // temps qu'il reste. Ce n'est pas lui qui protège.
    const restant = await delaiRestant();
    if (restant > 0) return { ok: false, code: 'DELAI', restantMs: restant };

    // On LIT d'abord. Sans cette lecture, un 401 à l'écriture serait ambigu :
    // nom déjà pris, ou règles pas publiées ? Les deux donnent 401, et annoncer
    // « déjà pris » quand les règles manquent enverrait le joueur essayer
    // vingt noms sans jamais comprendre. Une lecture refusée dit clairement
    // que le problème n'est pas le nom.
    const vue = await req('GET', 'pseudos/' + cle);
    if (!vue.ok) return { ok: false, code: vue.status === 401 ? 'INTERDIT' : 'RESEAU' };
    if (vue.data && vue.data !== auth.uid()) return { ok: false, code: 'PRIS' };

    // UN SEUL écrit, à la racine : le nom, l'horodatage du délai et le nom
    // affiché partent ensemble ou pas du tout. C'est ce que la règle exige, et
    // c'est aussi plus sûr qu'avant — il n'y a plus d'état intermédiaire où la
    // case serait prise sans que le compte porte le nom.
    const patch = await req('PATCH', '', {
      ['pseudos/' + cle]: auth.uid(),
      ['pseudo-delai/' + auth.uid()]: { '.sv': 'timestamp' },
      [uidPath() + '/meta/pseudo']: affiche,
    });
    if (!patch.ok) {
      if (patch.status !== 401) return { ok: false, code: 'RESEAU' };
      // Refus APRÈS une lecture qui disait « libre » : soit quelqu'un est passé
      // entre les deux, soit le délai vient de se refermer. On redemande plutôt
      // que d'annoncer la mauvaise raison.
      const encore = await delaiRestant();
      return encore > 0 ? { ok: false, code: 'DELAI', restantMs: encore }
                        : { ok: false, code: 'PRIS' };
    }
    if (ancienneCle) await req('DELETE', 'pseudos/' + ancienneCle);
    return { ok: true, pseudo: affiche };
  }

  async function releasePseudo() {
    if (!isSignedIn()) return { ok: false, code: 'NON_CONNECTE' };
    const ancien = await myPseudo();
    if (!ancien) return { ok: true };
    const r = await req('DELETE', 'pseudos/' + normPseudo(ancien));
    if (!r.ok) return { ok: false, code: 'RESEAU' };
    await req('PATCH', uidPath(), { 'meta/pseudo': null });
    return { ok: true };
  }

  // ── Classement du jour ────────────────────────────────────
  // Le nom publié n'est pas un choix du client : la règle de la base exige
  // qu'il soit EXACTEMENT le pseudo réservé du compte. On le relit donc plutôt
  // que de le recevoir en paramètre — un appelant distrait ne peut pas inscrire
  // quelqu'un sous un autre nom, et la base refuserait de toute façon.
  const SCORE_MAX = 70000;
  const SERIE_MAX = 10000;   // série de jours : garde-fou de bon sens, comme le score
  const JOUR_OK = /^[0-9]{4}-[0-9]{1,2}-[0-9]{1,2}$/;

  async function pushDailyScore(jour, score, serie) {
    if (!isSignedIn()) return { ok: false, code: 'NON_CONNECTE' };
    if (!JOUR_OK.test(String(jour))) return { ok: false, code: 'DATE' };
    const nom = await myPseudo();
    if (!nom) return { ok: false, code: 'SANS_PSEUDO' };
    const n = Number(score);
    const s = isFinite(n) ? Math.max(0, Math.min(SCORE_MAX, Math.round(n))) : 0;
    // `d` = série de jours consécutifs. Bornée ICI comme le score, et bornée
    // AUSSI par la règle — c'est cette dernière qui fait foi.
    const j = Number(serie);
    const d = isFinite(j) ? Math.max(0, Math.min(SERIE_MAX, Math.round(j))) : 0;
    const r = await req('PUT', `leaderboard/${jour}/${auth.uid()}`, { n: nom, s, d, t: { '.sv': 'timestamp' } });
    if (r.ok) return { ok: true, score: s, serie: d, pseudo: nom };
    return { ok: false, code: r.status === 401 ? 'INTERDIT' : 'RESEAU' };
  }

  // Lecture PUBLIQUE, sans jeton : le classement se voit sans compte, c'est ce
  // qui donne envie d'en créer un. On tire la journée entière et on trie chez
  // nous — une seule requête, et à quelques dizaines de joueurs par jour ça pese
  // deux ou trois Ko. À revoir au-delà de ~500 lignes par jour : il faudra alors
  // un `.indexOn` sur `s` et une requête `orderBy`/`limitToLast`.
  async function readLeaderboard(jour, ms) {
    if (!DB || !JOUR_OK.test(String(jour))) return { ok: false, status: 0 };
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), ms || NET_MS);
    try {
      const r = await fetch(`${DB}/leaderboard/${jour}.json`, { signal: ctrl.signal });
      if (!r.ok) return { ok: false, status: r.status };
      const data = await r.json().catch(() => null);
      return { ok: true, data: data || {} };
    } catch (e) {
      return { ok: false, status: 0 };
    } finally { clearTimeout(to); }
  }

  // ── Journées en attente de renvoi ────────────────────────────────────────
  function dirty(day) {
    const l = parse(lsGet(K_DIRTY), []);
    if (!l.includes(day)) { l.push(day); lsSet(K_DIRTY, JSON.stringify(l)); }
  }
  function undirty(day) {
    const l = parse(lsGet(K_DIRTY), []).filter(d => d !== day);
    if (l.length) lsSet(K_DIRTY, JSON.stringify(l)); else lsDel(K_DIRTY);
  }
  async function flushDirty() {
    const l = parse(lsGet(K_DIRTY), []);
    for (const d of l.slice(0, 10)) await pushDay(d);   // borne : une reprise ne doit pas figer le démarrage
  }

  // ── Descente : quelles journées tirer, et fusion ──────────────────────────
  async function pullAndMerge(activeDay, ms) {
    const meta = await pullMeta(ms);
    if (!meta.ok) return { ok: false, offline: true };

    // Le pseudo réservé est l'identité du compte : il doit suivre sur TOUS les
    // appareils, pas seulement celui qui l'a réservé. `meta` est déjà là, donc
    // ça ne coûte aucune requête. On n'écrase jamais avec du vide : un compte
    // sans pseudo laisse au joueur le nom local qu'il s'était donné.
    const nomCompte = meta.data && meta.data.pseudo;
    if (typeof nomCompte === 'string' && nomCompte) lsSet(K_VPSEUDO, nomCompte);

    const distant = (meta.data && meta.data.dayStamps) || {};
    const miroir  = parse(lsGet(K_STAMPS), {});
    const local   = readLocal();
    const connues = new Set(SM.daysOf(local));

    // Une journée est à tirer si le compte l'a modifiée depuis notre dernière
    // intégration, ou si on ne l'a tout simplement jamais vue ici.
    const aTirer = Object.keys(distant).filter(d =>
      Number(distant[d]) > Number(miroir[d] || 0) || !connues.has(d));
    // La journée en cours est toujours revérifiée : c'est celle qui bouge.
    if (activeDay && distant[activeDay] && !aTirer.includes(activeDay)) aTirer.push(activeDay);

    const distantSave = {};
    for (const d of aTirer) {
      const r = await pullDay(d, ms);
      if (r.ok && r.data) Object.assign(distantSave, r.data);
      else if (!r.ok) return { ok: false, offline: true };
    }
    const agg = await pullAgg(ms);
    if (agg.ok && agg.data) Object.assign(distantSave, agg.data);

    if (!Object.keys(distantSave).length) {
      lsSet(K_STAMPS, JSON.stringify(distant));
      return { ok: true, changed: false, activeDayChanged: false, report: null };
    }

    const avantActif = activeDay ? JSON.stringify(SM.daySlice(local, activeDay)) : '';
    const m = SM.mergeSaves(local, distantSave, mergeOpts());
    const gros = m.report.daysAdded > 0 || m.report.daysTouched > 0;
    applyLocal(m.data, gros);
    lsSet(K_STAMPS, JSON.stringify(distant));

    const apresActif = activeDay ? JSON.stringify(SM.daySlice(m.data, activeDay)) : '';
    return {
      ok: true,
      changed: gros || avantActif !== apresActif,
      activeDayChanged: avantActif !== apresActif,
      report: m.report,
    };
  }

  // ── Points d'entrée ──────────────────────────────────────────────────────

  // Démarrage. Lancé en parallèle du chargement de data.json et attendu juste
  // avant le rendu : dans les faits il ne coûte rien, le data.json domine.
  // Au-delà de BOOT_MS on démarre en local — un compte injoignable ne doit
  // jamais empêcher de jouer.
  async function bootSync() {
    if (!DB || !auth || syncing) return { ok: false };
    // Firebase restaure la session de façon ASYNCHRONE : au démarrage, on ne
    // sait pas encore si quelqu'un est connecté. On laisse à la couche Auth le
    // même budget qu'à la descente — au-delà, on joue en local et le retour sur
    // l'onglet rattrapera. Sans fournisseur (état actuel), aucune attente.
    if (typeof auth.ready === 'function') {
      await Promise.race([
        Promise.resolve(auth.ready()).catch(() => null),
        new Promise(r => setTimeout(r, BOOT_MS)),
      ]);
    }
    if (!isSignedIn()) return { ok: false };
    syncing = true;
    try {
      const uid = auth.uid();
      // Compte différent (ou première connexion sur cet appareil) : le miroir
      // d'horodatages ne veut plus rien dire, on repart d'une descente complète.
      if (lsGet(K_UID) !== uid) { lsDel(K_STAMPS); lsSet(K_UID, uid); }
      const r = await pullAndMerge(getActiveDay(), BOOT_MS);
      flushDirty();   // sans await : ne retarde pas le premier rendu
      return r;
    } finally { syncing = false; }
  }

  // Retour sur l'onglet. Si la journée affichée a changé sous nos pieds, il
  // faut recharger : restoreAllStates() rejoue les essais par-dessus la grille
  // existante, la rappeler en cours de session doublerait l'affichage. Rien
  // n'est perdu au passage, chaque essai est déjà écrit dans le localStorage.
  async function focusSync() {
    if (!isSignedIn() || syncing) return { ok: false };
    syncing = true;
    try {
      const r = await pullAndMerge(getActiveDay(), NET_MS);
      if (r.ok && r.changed) onRemoteChange(r);
      flushDirty();
      return r;
    } finally { syncing = false; }
  }

  // Fin de partie : un écrit, débouncé, pour ne pas envoyer sept fois la même
  // journée quand on enchaîne les modes.
  function queueDay(day) {
    if (!isSignedIn() || !day) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => pushDay(day), PUSH_DEBOUNCE_MS);
  }
  function flush() {
    if (!isSignedIn()) return;
    clearTimeout(pushTimer);
    const d = getActiveDay();
    if (d) pushDay(d);
  }

  // Première connexion d'un compte : on descend tout, on fusionne, on remonte
  // tout. C'est le chemin qu'empruntera chaque joueur au lancement, donc celui
  // qui doit être le plus sûr — d'où la copie de sécurité systématique.
  async function firstSync() {
    if (!isSignedIn()) return { ok: false };
    const r = await pullAll();
    if (!r.ok) return { ok: false, offline: true };
    const distant = r.data || {};
    const plat = {};
    Object.keys(distant.days || {}).forEach(d => Object.assign(plat, distant.days[d]));
    Object.assign(plat, distant.agg || {});
    const local = readLocal();
    const m = SM.mergeSaves(local, plat, mergeOpts());
    applyLocal(m.data, true);
    lsSet(K_UID, auth.uid());
    lsSet(K_STAMPS, JSON.stringify((distant.meta && distant.meta.dayStamps) || {}));
    const ok = await pushEverything();
    return { ok, report: m.report, wasEmpty: !Object.keys(plat).length };
  }

  // Suppression du compte : le contenu part d'abord, l'identité ensuite (c'est
  // la couche Auth qui s'en charge). Dans cet ordre, un échec à mi-chemin
  // laisse un compte sans données plutôt que des données sans propriétaire.
  async function wipeRemote() {
    if (!isSignedIn()) return false;
    const r = await deleteAll();
    if (r.ok) { lsDel(K_STAMPS); lsDel(K_DIRTY); }
    return r.ok;
  }

  function isSignedIn() { return !!(DB && auth && auth.uid()); }
  // Le classement en a besoin pour repérer SA ligne parmi celles des autres.
  function accountUid() { return isSignedIn() ? auth.uid() : null; }

  function configure(cfg) { DB = (cfg && cfg.dbUrl) || ''; }
  function setAuthProvider(p) { auth = p; }

  // Installé une fois par app.js. `activeDay` est une fonction, pas une valeur :
  // la journée affichée change en mode « Rejouer ».
  function start(opts) {
    opts = opts || {};
    if (typeof opts.activeDay === 'function') getActiveDay = opts.activeDay;
    if (typeof opts.onRemoteChange === 'function') onRemoteChange = opts.onRemoteChange;

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') focusSync();
      else flush();   // l'onglet part en arrière-plan : on ne parie pas sur son retour
    });
    // pagehide couvre la fermeture et le bfcache, là où unload n'est pas fiable
    // sur mobile. Le push part sans être attendu ; s'il n'aboutit pas, la
    // journée est marquée et repartira au prochain démarrage.
    window.addEventListener('pagehide', flush);
  }

  window.LPAccount = {
    configure, setAuthProvider, start, isSignedIn,
    bootSync, focusSync, firstSync, queueDay, flush,
    pushEverything, wipeRemote,
    readLocal, applyLocal,
    // Pseudo réservé : l'unicité vient de la règle de la base, pas d'ici.
    myPseudo, pseudoDisponible, claimPseudo, releasePseudo, pseudoValide, delaiRestant,
    pushDailyScore, readLeaderboard, accountUid,
  };
})();

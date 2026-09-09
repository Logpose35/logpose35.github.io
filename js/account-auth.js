// ===== COMPTE JOUEUR — CONNEXION (Firebase Auth) =====
// La seule brique qui parle d'identité. Elle fournit à js/account.js un uid et
// un jeton, rien d'autre : ni l'adresse e-mail ni le nom ne sont écrits dans la
// base. L'identité reste chez Google, nous n'en voyons qu'un identifiant opaque.
//
// AUCUN MOT DE PASSE ne transite par le site : connexion Google (OAuth) ou lien
// magique reçu par e-mail. Il n'y a donc rien à stocker, rien à hacher, et rien
// à faire fuiter.
//
// LE SDK EST CHARGÉ À LA DEMANDE (~170 Ko) : au démarrage uniquement si une
// session a déjà existé sur cet appareil, sinon au premier clic sur « Se
// connecter ». Un joueur qui n'utilise pas de compte ne télécharge rien.
(function () {
  'use strict';

  // ─────────────────────────────────────────────────────────────────────────
  // ⚠️ À REMPLIR — Console Firebase → Paramètres du projet → Vos applications
  //    → Web. S'il n'y a pas encore d'application web, en créer une (ça ne
  //    touche à rien d'existant). Copier les quatre valeurs ci-dessous.
  //    Ces valeurs sont PUBLIQUES par nature : l'apiKey identifie le projet,
  //    ce n'est pas un secret. Ce qui protège les données, ce sont les règles
  //    de firebase/database.rules.json.
  // ─────────────────────────────────────────────────────────────────────────
  // `authDomain` est le domaine que Google affiche sur l'écran de consentement
  // (« Avant d'utiliser l'appli … »). D'où le domaine personnalisé plutôt que
  // le logpose-eec08.firebaseapp.com par défaut : CNAME chez OVH
  // (auth → logpose-eec08.web.app), sous-domaine rattaché à Firebase Hosting et
  // inscrit dans les domaines autorisés de Firebase Auth. Le site, lui, reste
  // entièrement sur GitHub Pages : Hosting ne sert QUE le gestionnaire OAuth.
  // ROLLBACK en une ligne : remettre 'logpose-eec08.firebaseapp.com'.
  // Contrôle de bonne santé du sous-domaine :
  //     curl -o /dev/null -w "%{http_code}\n" https://auth.onepiecedle.fr/__/auth/handler
  // 200 attendu. La racine renvoie 404, c'est normal (rien n'y est déployé).
  const CONFIG = {
    apiKey:     'AIzaSyBO_ZAeHOFar2apjE27H1hQT8shf5xCFKE',
    authDomain: 'auth.onepiecedle.fr',
    projectId:  'logpose-eec08',
    appId:      '1:557853159496:web:fcb2029fdb6044ea45e87d',
    databaseURL: 'https://logpose-eec08-default-rtdb.europe-west1.firebasedatabase.app',
  };

  const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const K_UID  = 'op-account-uid';
  const K_MAIL = 'op-account-mail';   // adresse en attente d'un lien de connexion

  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const lsDel = k => { try { localStorage.removeItem(k); } catch (e) {} };

  let _uid = null, _mail = null, _user = null;
  let _sdk = null;                     // promesse de chargement du SDK
  let _readyResolve, _ready = new Promise(r => { _readyResolve = r; });
  let _readyDone = false;
  const _listeners = [];

  const available = () => !!(CONFIG.apiKey && CONFIG.authDomain && CONFIG.appId);

  // Navigateur intégré à une application (TikTok, Instagram, Facebook…).
  // Google y REFUSE OAuth (« disallowed_useragent ») : c'est une part réelle de
  // notre trafic, qui arrive des réseaux. Le lien par e-mail, lui, passe
  // partout — d'où les deux méthodes plutôt qu'une.
  const inAppBrowser = () =>
    /FBAN|FBAV|Instagram|TikTok|BytedanceWebview|musical_ly|Snapchat|Line\/|Twitter/i.test(navigator.userAgent);

  function notify() {
    const st = state();
    _listeners.forEach(f => { try { f(st); } catch (e) { console.warn('[compte] écouteur:', e); } });
  }
  function settleReady() {
    if (_readyDone) return;
    _readyDone = true;
    _readyResolve();
  }

  // ── Chargement du SDK ────────────────────────────────────────────────────
  function loadScript(src) {
    return new Promise((ok, ko) => {
      const s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = ok;
      s.onerror = () => ko(new Error('chargement impossible : ' + src));
      document.head.appendChild(s);
    });
  }

  function ensureSdk() {
    if (_sdk) return _sdk;
    _sdk = (async () => {
      await loadScript(SDK + 'firebase-app-compat.js');
      await loadScript(SDK + 'firebase-auth-compat.js');
      if (!firebase.apps.length) firebase.initializeApp(CONFIG);
      firebase.auth().onAuthStateChanged(u => {
        _user = u || null;
        _uid  = u ? u.uid : null;
        _mail = u ? (u.email || null) : null;
        if (_uid) lsSet(K_UID, _uid); else lsDel(K_UID);
        settleReady();      // la session est connue : la synchro peut partir
        notify();
      });
      return firebase.auth();
    })();
    _sdk.catch(e => { console.warn('[compte] SDK indisponible :', e.message); settleReady(); });
    return _sdk;
  }

  // ── Jeton pour les requêtes de js/account.js ─────────────────────────────
  async function token(force) {
    if (!_user) return null;
    try { return await _user.getIdToken(!!force); }
    catch (e) { console.warn('[compte] jeton indisponible :', e && e.message); return null; }
  }

  // ── Connexion ────────────────────────────────────────────────────────────
  async function signInGoogle() {
    const auth = await ensureSdk();
    const p = new firebase.auth.GoogleAuthProvider();
    p.setCustomParameters({ prompt: 'select_account' });
    try {
      await auth.signInWithPopup(p);
      return { ok: true };
    } catch (e) {
      // Pop-up bloquée ou fermée : on retente en redirection, qui passe là où
      // la pop-up ne passe pas (Safari iOS strict, certains navigateurs mobiles).
      if (e && /popup-blocked|popup-closed-by-user|cancelled-popup-request|operation-not-supported/.test(e.code || '')) {
        try { await auth.signInWithRedirect(p); return { ok: true, redirect: true }; }
        catch (e2) { return { ok: false, code: e2.code, message: e2.message }; }
      }
      return { ok: false, code: e && e.code, message: e && e.message };
    }
  }

  // Lien magique : aucune saisie de mot de passe, et ça fonctionne dans les
  // navigateurs intégrés où Google refuse OAuth.
  async function sendEmailLink(email) {
    const auth = await ensureSdk();
    const adresse = String(email || '').trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adresse)) return { ok: false, code: 'auth/invalid-email' };
    try {
      await auth.sendSignInLinkToEmail(adresse, {
        // On revient sur la page d'où l'on est parti, sans le paramètre de
        // rejouer éventuel : le lien doit ramener sur une page de jeu normale.
        url: location.origin + location.pathname,
        handleCodeInApp: true,
      });
      lsSet(K_MAIL, adresse);
      return { ok: true };
    } catch (e) {
      return { ok: false, code: e && e.code, message: e && e.message };
    }
  }

  const isEmailLink = () => /[?&](oobCode|apiKey)=/.test(location.search) && /signIn/i.test(location.search);

  // Retour du lien reçu par e-mail. Si l'adresse n'est plus en mémoire (lien
  // ouvert sur un AUTRE appareil que celui qui l'a demandé), on la redemande.
  async function completeEmailLink() {
    const auth = await ensureSdk();
    if (!auth.isSignInWithEmailLink(location.href)) return { ok: false, code: 'pas-un-lien' };
    let adresse = lsGet(K_MAIL);
    if (!adresse) {
      adresse = window.prompt(window.t ? t('Confirmez l\'adresse e-mail qui a reçu le lien :') : 'Adresse e-mail :');
      if (!adresse) return { ok: false, code: 'auth/missing-email' };
    }
    try {
      await auth.signInWithEmailLink(adresse, location.href);
      lsDel(K_MAIL);
      // On retire le code du lien de la barre d'adresse : il est à usage unique,
      // et le laisser traîner ferait échouer un rechargement.
      history.replaceState(null, '', location.origin + location.pathname);
      return { ok: true };
    } catch (e) {
      return { ok: false, code: e && e.code, message: e && e.message };
    }
  }

  async function signOut() {
    if (!_sdk) return { ok: true };
    const auth = await ensureSdk();
    try { await auth.signOut(); lsDel(K_UID); return { ok: true }; }
    catch (e) { return { ok: false, code: e && e.code }; }
  }

  // Suppression du compte : les DONNÉES d'abord (js/account.js), l'identité
  // ensuite. Dans cet ordre, un échec à mi-chemin laisse un compte sans données
  // plutôt que des données sans propriétaire.
  async function deleteAccount() {
    if (!_user) return { ok: false, code: 'pas-connecte' };
    if (window.LPAccount) await LPAccount.wipeRemote();
    try {
      await _user.delete();
      lsDel(K_UID);
      return { ok: true };
    } catch (e) {
      // Firebase exige une connexion récente pour supprimer un compte.
      if (e && e.code === 'auth/requires-recent-login') return { ok: false, code: e.code };
      return { ok: false, code: e && e.code, message: e && e.message };
    }
  }

  function state() {
    return {
      disponible: available(),
      connecte: !!_uid,
      // L'uid sert aux pages qui lisent la base sans embarquer js/account.js —
      // la page Versus, qui n'a besoin que du pseudo réservé.
      uid: _uid,
      email: _mail,
      navigateurIntegre: inAppBrowser(),
    };
  }
  function onChange(fn) { _listeners.push(fn); return () => _listeners.splice(_listeners.indexOf(fn), 1); }

  // ── Démarrage ────────────────────────────────────────────────────────────
  // Appelé par app.js AVANT LPAccount.bootSync(), qui attendra ready().
  function boot() {
    if (!available()) { settleReady(); return; }
    if (window.LPAccount) LPAccount.setAuthProvider({ uid: () => _uid, token, ready: () => _ready });

    if (isEmailLink()) { ensureSdk().then(completeEmailLink); return; }
    // Pas de session connue sur cet appareil : on ne charge RIEN et la synchro
    // n'attend pas. Le SDK ne viendra qu'au premier clic sur « Se connecter ».
    if (!lsGet(K_UID)) { settleReady(); return; }
    ensureSdk();
  }

  window.LPAuth = {
    boot, state, onChange, available, inAppBrowser,
    signInGoogle, sendEmailLink, completeEmailLink, signOut, deleteAccount,
    // Le serveur Versus vérifie ce jeton — non pour ouvrir une porte (il n'y en
    // a plus), mais pour savoir qui porte un pseudo réservé.
    token,
    // URL de la base, pour les pages qui font une lecture ponctuelle sans
    // charger js/account.js. Évite de dupliquer l'adresse une troisième fois.
    dbUrl: () => CONFIG.databaseURL,
    // Chargement explicite du SDK, pour le panneau « Compte » qui s'ouvre.
    prepare: ensureSdk,
  };
})();

// ===== TESTS DU TRANSPORT ET DE LA SYNCHRO (js/account.js) =====
// `node tools/test-account-sync.js` — aucune dépendance, aucun réseau.
// js/save-merge.js et js/account.js sont exécutés dans un contexte navigateur
// simulé (vm), face à une fausse Realtime Database en mémoire qui reproduit la
// sémantique REST utilisée : GET d'un sous-arbre, PATCH multi-chemins, DELETE.
// Ce que ces tests protègent : une fin de partie ne doit coûter QU'UN écrit,
// une coupure réseau ne doit rien perdre, et les préférences de l'appareil ne
// doivent jamais partir au compte.
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');
// Partie PURE du classement : elle sert ici à vérifier le tri sur les données
// que la fausse base a réellement acceptées.
const LB = require('../js/leaderboard.js');

let passed = 0, failed = 0;
function ok(cond, label) {
  if (cond) { passed++; console.log(`  ✅ ${label}`); }
  else      { failed++; console.log(`  ❌ ${label}`); }
}
const J = v => JSON.stringify(v);

// ── Fausse base ───────────────────────────────────────────────────────────
// Reproduit ce dont account.js dépend réellement : un PATCH dont les clés sont
// des CHEMINS relatifs écrase chaque chemin visé, et lui seul.
function makeDB() {
  // `now` est l'horloge du SERVEUR, en millisecondes réelles : les tests la
  // font avancer de 24 h d'un coup pour éprouver le délai de changement de
  // pseudo. Elle avance aussi d'un cran à chaque requête, comme une vraie :
  // c'est ce qui rend un horodatage « frais » impossible à rejouer plus tard.
  const db = { root: {}, calls: [], fail: 0, strictAuth: false, now: Date.now(), JOUR: 86400000 };
  const seg = p => p.split('/').filter(Boolean);
  const getAt = p => seg(p).reduce((n, s) => (n && typeof n === 'object' ? n[s] : undefined), db.root);
  const setAt = (p, v) => {
    const s = seg(p); const last = s.pop();
    let n = db.root;
    s.forEach(k => { if (typeof n[k] !== 'object' || n[k] === null) n[k] = {}; n = n[k]; });
    if (v === null || v === undefined) delete n[last]; else n[last] = v;
  };
  db.fetch = async (url, opt) => {
    const u = new URL(url);
    const p = u.pathname.replace(/^\//, '').replace(/\.json$/, '');
    const method = (opt && opt.method) || 'GET';
    db.now += 1;   // le temps passe entre deux requêtes
    const token = u.searchParams.get('auth');
    db.calls.push({ method, path: p, body: opt && opt.body ? JSON.parse(opt.body) : undefined });

    // Le classement se lit sans compte (règle `.read: true` sur leaderboard/$jour) :
    // c'est ce qui permet à un visiteur non connecté de le voir, donc d'avoir envie
    // d'en créer un. Tout le reste exige un jeton.
    const lecturePublique = method === 'GET' && p.startsWith('leaderboard/');
    if (db.strictAuth && !lecturePublique && !String(token || '').startsWith('jeton-')) return { ok: false, status: 401, json: async () => null };
    if (db.fail > 0) { db.fail--; throw new Error('réseau coupé'); }

    if (method === 'GET')    { const v = getAt(p); return { ok: true, status: 200, json: async () => (v === undefined ? null : v) }; }
    // Règle `pseudos/{nom}` reproduite : écrire n'est permis que si la case est
    // VIDE ou déjà à nous. C'est elle qui garantit l'unicité — la tester ici,
    // c'est tester ce qui protège vraiment, pas seulement notre code.
    const monUid = String(token || '').replace(/^jeton-/, '');
    if (p.startsWith('pseudos/') && (method === 'PUT' || method === 'DELETE')) {
      const actuel = getAt(p);
      const libre = actuel === undefined || actuel === null;
      if (!libre && actuel !== monUid) return { ok: false, status: 401, json: async () => ({ error: 'Permission denied' }) };
      if (method === 'PUT') {
        const v = JSON.parse(opt.body);
        if (v !== monUid) return { ok: false, status: 401, json: async () => ({ error: 'Permission denied' }) };
        // La règle exige un horodatage de délai posé dans LA MÊME écriture. Un
        // PUT isolé n'en pose aucun : il ne peut relire que l'ancien, qui n'est
        // jamais égal à `now` puisque l'horloge avance à chaque requête.
        if (getAt('pseudo-delai/' + monUid) !== db.now) return { ok: false, status: 401, json: async () => ({ error: 'Permission denied' }) };
        setAt(p, v);
        return { ok: true, status: 200, json: async () => v };
      }
      setAt(p, null);
      return { ok: true, status: 200, json: async () => null };
    }
    // Règle `leaderboard/{jour}/{uid}` reproduite. Le point qui compte : le nom
    // publié DOIT être le pseudo réservé du compte. C'est ce qui interdit de se
    // présenter sous l'identité d'un autre, et d'y glisser autre chose qu'un
    // pseudo — le client ne peut pas contourner ça, la base refuse.
    if (p.startsWith('leaderboard/') && method === 'PUT') {
      const bouts = p.split('/');                       // leaderboard / jour / uid
      const jour = bouts[1], cible = bouts[2];
      const refus = { ok: false, status: 401, json: async () => ({ error: 'Permission denied' }) };
      if (!/^[0-9]{4}-[0-9]{1,2}-[0-9]{1,2}$/.test(jour || '')) return refus;
      if (!cible || cible !== monUid) return refus;
      const v = JSON.parse(opt.body);
      const reserve = getAt('saves/' + monUid + '/meta/pseudo');
      if (typeof v.n !== 'string' || v.n !== reserve) return refus;
      if (typeof v.s !== 'number' || v.s < 0 || v.s > 70000) return refus;
      // `d` = série de jours. FACULTATIF (les lignes d'avant n'en ont pas),
      // mais borné dès qu'il est là — même logique que le score.
      if (v.d !== undefined && (typeof v.d !== 'number' || v.d < 0 || v.d > 10000)) return refus;
      if (v.t && typeof v.t === 'object' && v.t['.sv'] === 'timestamp') v.t = db.now++;
      if (typeof v.t !== 'number') return refus;
      // `$autre: false` : aucun champ en plus des quatre prévus.
      const permis = { n: 1, s: 1, d: 1, t: 1 };
      if (Object.keys(v).some(k => !permis[k])) return refus;
      setAt(p, v);
      return { ok: true, status: 200, json: async () => v };
    }
    if (method === 'DELETE') { setAt(p, null); return { ok: true, status: 200, json: async () => null }; }
    if (method === 'PUT') {
      const v = JSON.parse(opt.body);
      setAt(p, v);
      return { ok: true, status: 200, json: async () => v };
    }
    if (method === 'PATCH')  {
      const body = JSON.parse(opt.body);
      const prefixe = p ? p + '/' : '';
      const refuse = { ok: false, status: 401, json: async () => ({ error: 'Permission denied' }) };
      const resoudre = v => (v && typeof v === 'object' && v['.sv'] === 'timestamp') ? db.now : v;

      // Règle `pseudo-delai/{uid}` : jamais supprimable, valeur imposée par
      // l'horloge du serveur, et pas deux écritures à moins de 24 h.
      const cleDelai = Object.keys(body).filter(k => (prefixe + k).indexOf('pseudo-delai/') === 0)[0];
      if (cleDelai !== undefined) {
        const chemin = prefixe + cleDelai;
        const cible = chemin.split('/')[1];
        const val = body[cleDelai];
        const estHorloge = val && typeof val === 'object' && val['.sv'] === 'timestamp';
        const avant = getAt(chemin);
        if (cible !== monUid || !estHorloge) return refuse;
        if (typeof avant === 'number' && !(db.now > avant + db.JOUR)) return refuse;
      }

      // Règle `pseudos/{nom}` : case libre ou à nous, ET horodatage du délai
      // posé DANS LA MÊME écriture. C'est ce couplage qui rend le délai réel :
      // réserver sans le déclencher devient impossible.
      for (const k of Object.keys(body)) {
        const chemin = prefixe + k;
        if (chemin.indexOf('pseudos/') !== 0) continue;
        const v = body[k];
        if (v === null) continue;                      // libérer n'est pas changer
        const actuel = getAt(chemin);
        if (actuel !== undefined && actuel !== null && actuel !== monUid) return refuse;
        if (v !== monUid) return refuse;
        if (cleDelai === undefined) return refuse;
      }

      Object.keys(body).forEach(k => setAt(prefixe + k, resoudre(body[k])));
      return { ok: true, status: 200, json: async () => body };
    }
    return { ok: false, status: 405, json: async () => null };
  };
  return db;
}

// ── Faux localStorage : les clés stockées sont les SEULES propriétés propres,
// pour que Object.keys(localStorage) se comporte comme dans un navigateur.
function makeLS(initial) {
  const proto = {
    getItem(k) { return Object.prototype.hasOwnProperty.call(this, k) ? this[k] : null; },
    setItem(k, v) { Object.defineProperty(this, k, { value: String(v), enumerable: true, configurable: true, writable: true }); },
    removeItem(k) { delete this[k]; },
    key(i) { const ks = Object.keys(this); return i < ks.length ? ks[i] : null; },
  };
  Object.defineProperty(proto, 'length', { get() { return Object.keys(this).length; } });
  const ls = Object.create(proto);
  Object.keys(initial || {}).forEach(k => ls.setItem(k, initial[k]));
  return ls;
}

// ── Un appareil : contexte isolé, son localStorage, la base partagée ───────
function makeDevice(db, storage, uid, activeDay) {
  const listeners = {};
  const sandbox = {
    console, setTimeout, clearTimeout, URL, AbortController,
    localStorage: makeLS(storage),
    fetch: db.fetch,
    document: { visibilityState: 'visible', addEventListener: (t, f) => { listeners[t] = f; } },
  };
  sandbox.window = sandbox;
  sandbox.addEventListener = (t, f) => { listeners['win:' + t] = f; };
  // Le client compare l'horodatage stocké à SON horloge : sans ce branchement,
  // un délai posé sur l'horloge de la fausse base paraîtrait toujours écoulé.
  sandbox.Date = class extends Date { static now() { return db.now; } };
  vm.createContext(sandbox);
  const run = f => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), sandbox, { filename: f });
  run('save-merge.js');
  run('account.js');

  let token = 'jeton-' + uid;   // le jeton porte l'uid : la fausse base en a besoin
                                //  pour appliquer une règle qui dépend de auth.uid
  let refreshes = 0;
  let onRefresh = () => token;   // par défaut, un rafraîchissement ne change rien
  let ready = null;              // null = session déjà connue (pas d'attente)
  let compte = uid;
  sandbox.LPAccount.configure({ dbUrl: 'https://base.test' });
  const poserFournisseur = () => sandbox.LPAccount.setAuthProvider({
    uid: () => compte,
    token: async force => { if (force) { refreshes++; token = onRefresh(); } return token; },
    ready,
  });
  poserFournisseur();

  const dev = {
    api: sandbox.LPAccount, ls: sandbox.localStorage, listeners,
    activeDay: activeDay || null,   // mutable : le mode « Rejouer » la fait changer
    reloads: 0,
    setToken: t => { token = t; },
    refreshes: () => refreshes,
    onRefresh: f => { onRefresh = f; },
    save: () => sandbox.LPAccount.readLocal(),
    // Écriture BRUTE, en court-circuitant account.js : c'est ainsi qu'on éprouve
    // ce que la RÈGLE refuse, et non ce que notre code s'abstient d'envoyer.
    raw: (method, chemin, corps) => db.fetch(
      'https://base.test/' + chemin + '.json?auth=' + encodeURIComponent(token),
      { method, body: corps === undefined ? undefined : JSON.stringify(corps) }),
    signOut: () => sandbox.LPAccount.setAuthProvider({ uid: () => null, token: async () => null }),
    // Simule la restauration asynchrone de session de Firebase Auth : le compte
    // n'est connu qu'une fois `ready()` résolu.
    sessionDifferee: (attente, uidFinal) => {
      compte = null;
      ready = () => new Promise(r => setTimeout(() => { compte = uidFinal === undefined ? uid : uidFinal; r(); }, attente));
      poserFournisseur();
    },
    sessionBloquee: () => { compte = null; ready = () => new Promise(() => {}); poserFournisseur(); },
  };
  // Ce que fera app.js une fois : brancher la journée affichée et la réaction
  // à un changement venu d'un autre appareil.
  dev.api.start({ activeDay: () => dev.activeDay, onRemoteChange: () => { dev.reloads++; } });
  return dev;
}

// Une journée jouée, telle que le jeu l'écrit.
function jour(d, mode, { guesses = ['Luffy'], score = 1000 } = {}) {
  return {
    [`op-gs-${mode}-${d}`]: J({ guesses, target: 'Luffy' }),
    [`op-score-${d}`]: J({ [mode]: score }),
    [`op-result-${d}`]: J({ [mode]: { won: true, tries: guesses.length } }),
    'op-cumulative-score': String(score),
  };
}

const attendre = () => new Promise(r => setTimeout(r, 0));

async function main() {
  console.log('\n— 1. Première mise en ligne (import de la progression) —');
  {
    const db = makeDB();
    const pc = makeDevice(db, Object.assign(jour('2026-9-1', 'classic'), { 'op-theme': 'dark', 'op-captured': J(['Luffy']) }), 'u1');
    const r = await pc.api.firstSync();
    ok(r.ok && r.wasEmpty, 'compte vide détecté, progression locale poussée');
    ok(!!db.root.saves.u1.days['2026-9-1'], 'la journée est en ligne');
    ok(db.root.saves.u1.agg['op-cumulative-score'] === '1000', 'les agrégats sont en ligne');
    ok(db.root.saves.u1.agg['op-theme'] === undefined, 'le thème de l\'appareil n\'est PAS parti au compte');
    ok(!!db.root.saves.u1.meta.dayStamps['2026-9-1'], 'l\'horodatage de la journée est posé');
    ok(pc.ls.getItem('op-theme') === 'dark', 'le thème local est intact après la fusion');
  }

  console.log('\n— 2. Nouvel appareil : tout apparaît —');
  {
    const db = makeDB();
    const pc = makeDevice(db, jour('2026-9-1', 'classic', { guesses: ['Zoro', 'Luffy'], score: 900 }), 'u1');
    await pc.api.firstSync();

    const tel = makeDevice(db, { 'op-theme': 'light' }, 'u1');
    const r = await tel.api.bootSync();
    ok(r.ok && r.changed, 'la synchro de démarrage rapporte un changement');
    ok(!!tel.ls.getItem('op-gs-classic-2026-9-1'), 'la grille du PC est arrivée sur le téléphone');
    ok(J(JSON.parse(tel.ls.getItem('op-result-2026-9-1'))) === J({ classic: { won: true, tries: 2 } }), 'le résultat aussi (mode marqué terminé)');
    ok(tel.ls.getItem('op-cumulative-score') === '900', 'le score cumulé suit');
    ok(tel.ls.getItem('op-theme') === 'light', 'le téléphone garde SON thème');
  }

  console.log('\n— 3. Fin de partie : un seul écrit —');
  {
    const db = makeDB();
    const pc = makeDevice(db, jour('2026-9-1', 'classic'), 'u1');
    await pc.api.firstSync();
    Object.entries(jour('2026-9-2', 'emoji', { score: 800 })).forEach(([k, v]) => pc.ls.setItem(k, v));
    pc.ls.setItem('op-cumulative-score', '1800');
    pc.activeDay = '2026-9-2';
    db.calls.length = 0;

    await pc.api.flush();
    await attendre();
    const patchs = db.calls.filter(c => c.method === 'PATCH');
    ok(patchs.length === 1, `une seule requête d'écriture (${patchs.length})`);
    const corps = patchs[0].body;
    ok(!!corps['days/2026-9-2'] && !corps['days/2026-9-1'], 'seule la journée concernée est envoyée');
    ok(Object.keys(corps['days/2026-9-2']).every(k => k.includes('2026-9-2')), 'le nœud ne contient que les clés de cette journée');
    ok(corps.agg['op-cumulative-score'] === '1800', 'les agrégats accompagnent la journée dans le MÊME écrit');
    ok(!!corps['meta/dayStamps/2026-9-2'], 'l\'horodatage part avec');
    ok(corps.agg['op-theme'] === undefined, 'toujours aucune préférence dans l\'écrit');
    pc.ls.setItem('op-lang', 'en');
    db.calls.length = 0;
    await pc.api.flush(); await attendre();
    const corps2 = db.calls.filter(c => c.method === 'PATCH')[0].body;
    ok(corps2.agg['op-lang'] === undefined, 'la langue ne part pas au compte non plus');
  }

  console.log('\n— 4. Rien de neuf : rien à tirer —');
  {
    const db = makeDB();
    const pc = makeDevice(db, jour('2026-9-1', 'classic'), 'u1');
    await pc.api.firstSync();
    db.calls.length = 0;
    const r = await pc.api.bootSync();
    ok(r.ok && !r.changed, 'aucune modification distante détectée');
    ok(db.calls.filter(c => c.path.includes('/days/')).length === 0, 'aucune journée retéléchargée');
    ok(db.calls.filter(c => c.method === 'GET').length <= 2, `descente minimale : ${db.calls.filter(c => c.method === 'GET').length} lectures (méta + agrégats)`);
  }

  console.log('\n— 5. L\'autre appareil a joué la journée en cours —');
  {
    const db = makeDB();
    const pc  = makeDevice(db, jour('2026-9-1', 'classic'), 'u1', '2026-9-1');
    await pc.api.firstSync();
    const tel = makeDevice(db, {}, 'u1');
    await tel.api.bootSync();

    // Le PC termine l'émoji du même jour.
    pc.ls.setItem('op-gs-emoji-2026-9-1', J({ guesses: ['Nami'], target: 'Nami' }));
    pc.ls.setItem('op-score-2026-9-1', J({ classic: 1000, emoji: 800 }));
    pc.ls.setItem('op-result-2026-9-1', J({ classic: { won: true, tries: 1 }, emoji: { won: true, tries: 1 } }));
    pc.ls.setItem('op-cumulative-score', '1800');
    await pc.api.flush();
    await attendre();

    const r = await tel.api.focusSync();
    ok(r.ok && r.changed, 'le retour sur l\'onglet voit le travail fait sur l\'autre appareil');
    ok(!!tel.ls.getItem('op-gs-emoji-2026-9-1'), 'la grille émoji du PC est arrivée sur le téléphone');
    const res = JSON.parse(tel.ls.getItem('op-result-2026-9-1'));
    ok(!!res.classic && !!res.emoji, 'les deux modes de la journée sont marqués terminés');
    ok(tel.ls.getItem('op-cumulative-score') === '1800', 'le cumul est à jour');
  }

  console.log('\n— 6. Journée active et rechargement —');
  {
    const db = makeDB();
    const pc  = makeDevice(db, jour('2026-9-1', 'classic'), 'u1', '2026-9-1');
    await pc.api.firstSync();
    const tel = makeDevice(db, {}, 'u1', '2026-9-1');
    await tel.api.bootSync();

    pc.ls.setItem('op-gs-emoji-2026-9-1', J({ guesses: ['Nami'], target: 'Nami' }));
    pc.ls.setItem('op-result-2026-9-1', J({ classic: { won: true, tries: 1 }, emoji: { won: true, tries: 1 } }));
    await pc.api.flush();
    await attendre();

    const r = await tel.api.focusSync();
    ok(r.activeDayChanged === true, 'la journée AFFICHÉE a changé : signalé');
    ok(tel.reloads === 1, 'le rappel de rechargement a été déclenché une fois');
    ok(typeof tel.listeners['visibilitychange'] === 'function', 'le retour sur l\'onglet est bien écouté');
    ok(typeof tel.listeners['win:pagehide'] === 'function', 'la fermeture de page déclenche un envoi');
  }

  console.log('\n— 7. Réseau coupé : rien n\'est perdu —');
  {
    const db = makeDB();
    const pc = makeDevice(db, jour('2026-9-1', 'classic'), 'u1');
    await pc.api.firstSync();
    Object.entries(jour('2026-9-2', 'emoji', { score: 800 })).forEach(([k, v]) => pc.ls.setItem(k, v));
    pc.activeDay = '2026-9-2';

    db.fail = 1;
    await pc.api.flush();
    await attendre();
    ok(J(JSON.parse(pc.ls.getItem('op-sync-dirty'))) === J(['2026-9-2']), 'la journée est marquée à repousser');
    ok(!db.root.saves.u1.days['2026-9-2'], 'elle n\'est effectivement pas en ligne');
    ok(!!pc.ls.getItem('op-gs-emoji-2026-9-2'), 'mais elle est intacte en local');

    await pc.api.bootSync();
    await attendre();
    ok(!!db.root.saves.u1.days['2026-9-2'], 'le démarrage suivant la repousse');
    ok(pc.ls.getItem('op-sync-dirty') === null, 'la marque est levée');
  }

  console.log('\n— 8. Jeton expiré —');
  {
    // Un jeton Firebase vit une heure : l'onglet laissé ouvert toute la nuit
    // repart forcément sur un refus. Il doit se rafraîchir seul, et une fois.
    const db = makeDB();
    const pc = makeDevice(db, jour('2026-9-1', 'classic'), 'u1', '2026-9-1');
    await pc.api.firstSync();
    db.strictAuth = true;
    pc.setToken('périmé');
    pc.onRefresh(() => 'jeton-valide');
    db.calls.length = 0;

    const r = await pc.api.focusSync();
    ok(r.ok, 'un jeton expiré est rafraîchi et la synchro aboutit');
    ok(pc.refreshes() === 1, `un seul rafraîchissement demandé (${pc.refreshes()})`);

    // Compte réellement révoqué : ne pas boucler, ne rien perdre en local.
    const pc2 = makeDevice(db, jour('2026-9-3', 'wanted', { score: 600 }), 'u2', '2026-9-3');
    pc2.setToken('périmé');
    pc2.onRefresh(() => 'périmé');
    db.calls.length = 0;
    const r2 = await pc2.api.bootSync();
    ok(r2.ok === false, 'un refus persistant fait échouer la synchro proprement');
    ok(db.calls.length <= 4, `pas de boucle de reprise (${db.calls.length} requêtes)`);
    ok(!!pc2.ls.getItem('op-gs-wanted-2026-9-3'), 'la progression locale est intacte après un refus');
  }

  console.log('\n— 9. Hors compte, le jeu ne parle à personne —');
  {
    const db = makeDB();
    const pc = makeDevice(db, jour('2026-9-1', 'classic'), 'u1');
    pc.signOut();
    db.calls.length = 0;
    const r = await pc.api.bootSync();
    pc.api.queueDay('2026-9-1');
    await pc.api.flush();
    await attendre();
    ok(r.ok === false, 'la synchro de démarrage ne fait rien');
    ok(db.calls.length === 0, 'aucune requête réseau déclenchée');
    ok(pc.api.isSignedIn() === false, 'isSignedIn() dit non');
  }

  console.log('\n— 10. Copie de sécurité et suppression —');
  {
    const db = makeDB();
    const pc = makeDevice(db, jour('2026-9-1', 'classic'), 'u1');
    await pc.api.firstSync();
    const tel = makeDevice(db, jour('2026-9-5', 'wanted', { score: 600 }), 'u1');
    await tel.api.firstSync();
    const backup = JSON.parse(tel.ls.getItem('op-backup-premerge') || 'null');
    ok(!!backup && !!backup.data['op-gs-wanted-2026-9-5'], 'une copie de l\'état d\'avant fusion est déposée');
    ok(backup.data['op-backup-premerge'] === undefined, 'la copie ne s\'imbrique pas dans elle-même');
    ok(!!tel.ls.getItem('op-gs-classic-2026-9-1') && !!tel.ls.getItem('op-gs-wanted-2026-9-5'), 'les deux historiques ont fusionné');

    ok(await tel.api.wipeRemote(), 'la suppression du contenu du compte réussit');
    ok(db.root.saves.u1 === undefined, 'plus rien en ligne pour ce compte');
    ok(!!tel.ls.getItem('op-gs-classic-2026-9-1'), 'la progression locale survit à la suppression du compte');
  }

  console.log('\n— 11. Changement de compte sur le même appareil —');
  {
    const db = makeDB();
    const pc = makeDevice(db, jour('2026-9-1', 'classic'), 'u1');
    await pc.api.firstSync();
    ok(pc.ls.getItem('op-account-uid') === 'u1', 'le compte connecté est mémorisé');
    ok(!!pc.ls.getItem('op-sync-stamps'), 'le miroir d\'horodatages est posé');

    const autre = makeDevice(db, {}, 'u2');
    Object.entries(jour('2026-9-9', 'tome', { score: 500 })).forEach(([k, v]) => autre.ls.setItem(k, v));
    await autre.api.firstSync();
    ok(!!db.root.saves.u2 && db.root.saves.u1 !== undefined, 'les deux comptes coexistent sans se mélanger');
    ok(db.root.saves.u2.days['2026-9-1'] === undefined, 'le compte u2 n\'a pas hérité de la journée de u1');
  }

  console.log('\n— 12. Session restaurée en différé (ce que fera Firebase Auth) —');
  {
    const db = makeDB();
    const pc = makeDevice(db, jour('2026-9-1', 'classic'), 'u1', '2026-9-1');
    await pc.api.firstSync();

    // Le compte n'est connu que 40 ms après le démarrage : la descente doit
    // l'attendre, sinon elle partirait en croyant le joueur déconnecté.
    const tel = makeDevice(db, {}, 'u1', '2026-9-1');
    tel.sessionDifferee(40);
    const r = await tel.api.bootSync();
    ok(r.ok && r.changed, 'la descente attend que la session soit restaurée');
    ok(!!tel.ls.getItem('op-gs-classic-2026-9-1'), 'et la progression arrive bien');

    // Auth qui ne répond jamais : le jeu ne doit pas rester bloqué au démarrage.
    const lent = makeDevice(db, {}, 'u1', '2026-9-1');
    lent.sessionBloquee();
    const t0 = Date.now();
    const r2 = await lent.api.bootSync();
    const dt = Date.now() - t0;
    ok(r2.ok === false, 'une session qui ne répond jamais fait renoncer la descente');
    ok(dt < 2500, `sans bloquer le démarrage (${dt} ms, budget 1500)`);
  }

  console.log('\n— 13. Pseudo réservé —');
  {
    const db = makeDB();
    db.strictAuth = true;                      // les jetons comptent, ici
    const a = makeDevice(db, {}, 'u1', '2026-9-1');
    const b = makeDevice(db, {}, 'u2', '2026-9-1');
    await a.api.firstSync(); await b.api.firstSync();

    ok(a.api.pseudoValide('Mugiwara'), 'un nom simple est valide');
    ok(!a.api.pseudoValide('ab'), 'trop court : refusé');
    ok(!a.api.pseudoValide('a'.repeat(17)), 'trop long : refusé');
    ok(!a.api.pseudoValide('Mon Pseudo'), 'espace : refusé');
    ok(!a.api.pseudoValide('<script>x'), 'chevrons : refusés (rien d\'injectable ne passe)');
    ok(!a.api.pseudoValide('émoji'), 'accents : refusés');

    const libre = await a.api.pseudoDisponible('Shanks');
    ok(libre.ok && libre.libre, 'un nom jamais pris est annoncé libre');

    const r1 = await a.api.claimPseudo('Shanks');
    ok(r1.ok && r1.pseudo === 'Shanks', 'réservation réussie, casse d\'affichage conservée');
    ok(await a.api.myPseudo() === 'Shanks', 'le nom est relu depuis le compte');
    ok(db.root.pseudos.shanks === 'u1', 'l\'index est indexé en MINUSCULES');

    // LE test qui compte : c'est la règle de la base qui refuse, pas notre code.
    const r2 = await b.api.claimPseudo('Shanks');
    ok(!r2.ok && r2.code === 'PRIS', 'un autre compte ne peut pas le prendre');
    const r3 = await b.api.claimPseudo('SHANKS');
    ok(!r3.ok && r3.code === 'PRIS', 'ni dans une autre casse — l\'unicité ignore la casse');
    ok(await b.api.myPseudo() === null, 'le compte refusé n\'a toujours pas de pseudo');

    const dispo = await b.api.pseudoDisponible('Shanks');
    ok(dispo.ok && !dispo.libre, 'et la vérification préalable le dit aussi');

    // Changement de nom : l'ancien doit redevenir disponible. Un jour doit
    // s'être écoulé, sinon le délai s'y oppose (voir § 16).
    db.now += 25 * 3600 * 1000;
    const r4 = await a.api.claimPseudo('Roux');
    ok(r4.ok, 'changer de nom fonctionne');
    ok(db.root.pseudos.shanks === undefined, 'l\'ancien nom est libéré');
    ok(db.root.pseudos.roux === 'u1', 'le nouveau est réservé');
    const r5 = await b.api.claimPseudo('Shanks');
    ok(r5.ok, 'le nom libéré est immédiatement reprenable par un autre');

    // Reprendre son propre nom dans une autre casse ne doit pas être un conflit.
    const r6 = await a.api.claimPseudo('ROUX');
    ok(r6.ok && r6.pseudo === 'ROUX', 'changer la casse de SON pseudo : autorisé');
    ok(db.root.pseudos.roux === 'u1', 'et l\'index reste sur la même case');

    const r7 = await a.api.releasePseudo();
    ok(r7.ok && db.root.pseudos.roux === undefined, 'libérer rend la case');
    ok(await a.api.myPseudo() === null, 'et le compte n\'affiche plus de pseudo');

    ok((await a.api.claimPseudo('a b')).code === 'FORMAT', 'un format invalide est refusé sans toucher à la base');

    // Son PROPRE nom doit être annoncé disponible : c'est le cas « je vérifie
    // avant de garder le mien ». Attrape la comparaison à `auth.uid` sans les
    // parenthèses, qui rendait la réponse toujours « pris ».
    db.now += 25 * 3600 * 1000;
    await a.api.claimPseudo('Roux');
    const mien = await a.api.pseudoDisponible('Roux');
    ok(mien.ok && mien.libre && mien.aMoi, 'son propre pseudo est annoncé disponible');
    const mienCasse = await a.api.pseudoDisponible('rOuX');
    ok(mienCasse.ok && mienCasse.libre, "et dans n’importe quelle casse");
  }

  console.log('\n— 14. Le pseudo suit sur les autres appareils —');
  {
    // Le nom réservé est l'identité du compte : un deuxième appareil doit
    // l'apprendre par la simple synchro, sans rouvrir le panneau Compte.
    const db = makeDB();
    const a = makeDevice(db, {}, 'u1', '2026-9-1');
    await a.api.firstSync();
    await a.api.claimPseudo('Nami');

    const b = makeDevice(db, { 'op-versus-pseudo': 'AncienNomLocal' }, 'u1', '2026-9-1');
    await b.api.bootSync();
    ok(b.ls.getItem('op-versus-pseudo') === 'Nami', 'le 2e appareil reçoit le pseudo réservé');

    // Et l'inverse : un compte SANS pseudo ne doit pas effacer le nom local que
    // le joueur s'était donné dans le Versus.
    const db2 = makeDB();
    const c = makeDevice(db2, {}, 'u2', '2026-9-1');
    await c.api.firstSync();
    const d = makeDevice(db2, { 'op-versus-pseudo': 'NomChoisiIci' }, 'u2', '2026-9-1');
    await d.api.bootSync();
    ok(d.ls.getItem('op-versus-pseudo') === 'NomChoisiIci', "un compte sans pseudo n’écrase pas le nom local");

    // Changer de nom se propage aussi : c'est le nouveau qui doit suivre.
    db.now += 25 * 3600 * 1000;   // le délai de changement de pseudo est écoulé
    await a.api.claimPseudo('Nico-Robin');
    await b.api.focusSync();
    ok(b.ls.getItem('op-versus-pseudo') === 'Nico-Robin', 'un changement de nom se propage à la synchro suivante');
  }

  console.log('\n— 15. Classement du jour —');
  {
    const db = makeDB();
    db.strictAuth = true;
    const a = makeDevice(db, {}, 'u1', '2026-9-1');
    const b = makeDevice(db, {}, 'u2', '2026-9-1');
    await a.api.firstSync(); await b.api.firstSync();

    // Sans pseudo réservé, pas de classement : c'est l'avantage du compte, et
    // c'est aussi ce qui empêche un bot de remplir la liste de noms jetables.
    const sans = await a.api.pushDailyScore('2026-9-1', 12000);
    ok(!sans.ok && sans.code === 'SANS_PSEUDO', "sans pseudo réservé, rien n’est publié");
    ok(db.root.leaderboard === undefined, 'et la base reste vide');

    await a.api.claimPseudo('Nami');
    const r = await a.api.pushDailyScore('2026-9-1', 12000);
    ok(r.ok && r.score === 12000, 'avec un pseudo, le score part');
    const ligne = db.root.leaderboard['2026-9-1'].u1;
    ok(ligne.n === 'Nami', 'la ligne porte le pseudo réservé');
    ok(ligne.s === 12000, 'et le score');
    ok(typeof ligne.t === 'number', "l’horodatage est posé par le serveur, pas par nous");

    // Plafond : la consigne est claire, on ne cherche pas la triche, on borne.
    // 70 000 = 7 modes à 10 000.
    await a.api.pushDailyScore('2026-9-1', 999999);
    ok(db.root.leaderboard['2026-9-1'].u1.s === 70000, 'un score délirant est ramené à 70 000');
    await a.api.pushDailyScore('2026-9-1', -50);
    ok(db.root.leaderboard['2026-9-1'].u1.s === 0, 'un score négatif devient 0');

    const mauvaiseDate = await a.api.pushDailyScore('pas-une-date', 500);
    ok(!mauvaiseDate.ok && mauvaiseDate.code === 'DATE', "une date mal formée est refusée avant l’envoi");

    // LES tests qui comptent : c'est la base qui refuse, pas notre code.
    await b.api.claimPseudo('Zoro');
    const usurpation = await b.raw('PUT', 'leaderboard/2026-9-1/u2', { n: 'Nami', s: 70000, t: 1 });
    ok(usurpation.status === 401, "publier sous le pseudo d’un autre : refusé par la règle");
    const injection = await b.raw('PUT', 'leaderboard/2026-9-1/u2', { n: '<img src=x>', s: 10, t: 1 });
    ok(injection.status === 401, "un nom qui n’est pas son pseudo réservé : refusé aussi");
    const caseDautrui = await b.raw('PUT', 'leaderboard/2026-9-1/u1', { n: 'Zoro', s: 70000, t: 1 });
    ok(caseDautrui.status === 401, "écrire dans la case d’un autre compte : refusé");
    ok(db.root.leaderboard['2026-9-1'].u1.n === 'Nami', "la ligne visée n’a pas bougé");

    await b.api.pushDailyScore('2026-9-1', 30000);
    ok(Object.keys(db.root.leaderboard['2026-9-1']).length === 2, 'deux comptes = deux lignes');

    // ── Série de jours consécutifs ────────────────────────────────────────
    // Elle voyage dans `d`, à côté du score. La règle la borne de son côté ;
    // ici on éprouve le transport et le garde-fou du client.
    const avecSerie = await a.api.pushDailyScore('2026-9-1', 12000, 42);
    ok(avecSerie.ok && avecSerie.serie === 42, 'la série part avec le score');
    ok(db.root.leaderboard['2026-9-1'].u1.d === 42, 'et atterrit dans `d`');
    await a.api.pushDailyScore('2026-9-1', 12000, 999999);
    ok(db.root.leaderboard['2026-9-1'].u1.d === 10000, 'une série délirante est ramenée au plafond');
    await a.api.pushDailyScore('2026-9-1', 12000, -3);
    ok(db.root.leaderboard['2026-9-1'].u1.d === 0, 'une série négative devient 0');
    await a.api.pushDailyScore('2026-9-1', 12000);
    ok(db.root.leaderboard['2026-9-1'].u1.d === 0, 'sans série fournie, `d` vaut 0 (jamais NaN)');
    // LE test qui compte : la RÈGLE refuse une série hors bornes, même en
    // court-circuitant le client — c'est elle qui garantit, pas notre bornage.
    const serieBrute = await a.raw('PUT', 'leaderboard/2026-9-1/u1',
                                   { n: 'Nami', s: 100, d: 50000, t: 1 });
    ok(serieBrute.status === 401, 'une série hors bornes en PUT brut : refusée par la règle');
    const serieTexte = await a.raw('PUT', 'leaderboard/2026-9-1/u1',
                                   { n: 'Nami', s: 100, d: 'beaucoup', t: 1 });
    ok(serieTexte.status === 401, 'une série non numérique : refusée aussi');
    // `$autre: false` : la ligne ne porte QUE n, s, d et t. Sans ça, la base
    // deviendrait un espace de stockage gratuit pour n'importe qui.
    const champEnTrop = await a.raw('PUT', 'leaderboard/2026-9-1/u1',
                                    { n: 'Nami', s: 100, d: 3, t: 1, bonus: 'x' });
    ok(champEnTrop.status === 401, 'un champ en trop : refusé');

    // Changer de pseudo : la ligne doit suivre, sinon le classement afficherait
    // un nom que plus personne ne porte.
    db.now += 25 * 3600 * 1000;   // le délai de changement de pseudo est écoulé
    await a.api.claimPseudo('Nico-Robin');
    await a.api.pushDailyScore('2026-9-1', 40000);
    ok(db.root.leaderboard['2026-9-1'].u1.n === 'Nico-Robin', 'après renommage, la ligne porte le nouveau nom');

    // Lecture PUBLIQUE : sans elle, un visiteur ne verrait rien et n'aurait
    // aucune raison de se créer un compte.
    const c = makeDevice(db, {}, 'anonyme', '2026-9-1');
    c.signOut();
    const vue = await c.api.readLeaderboard('2026-9-1');
    ok(vue.ok && Object.keys(vue.data).length === 2, "le classement se lit sans être connecté");
    const vide = await c.api.readLeaderboard('2026-9-2');
    ok(vide.ok && Object.keys(vide.data).length === 0, 'une journée sans joueur renvoie une liste vide');
    const horsFormat = await c.api.readLeaderboard('nimporte-quoi');
    ok(!horsFormat.ok, "une date mal formée n’est même pas demandée");

    // Et le classement calculé sur ces données réelles doit tomber juste.
    const cl = LB.classer(vue.data, { uid: 'u1' });
    ok(cl.tete[0].nom === 'Nico-Robin' && cl.tete[0].score === 40000, 'le tri met le bon joueur en tête');
    ok(cl.moi && cl.moi.rang === 1, 'et repère bien sa propre ligne');
  }

  console.log('\n— 16. Un changement de pseudo par jour —');
  {
    const db = makeDB();
    db.strictAuth = true;
    const a = makeDevice(db, {}, 'u1', '2026-9-1');
    const b = makeDevice(db, {}, 'u2', '2026-9-1');
    await a.api.firstSync(); await b.api.firstSync();

    // La première réservation est libre : rien à attendre quand on n'a pas encore de nom.
    ok((await a.api.claimPseudo('Nami')).ok, 'la première réservation passe');
    ok(typeof db.root['pseudo-delai'].u1 === 'number', "et pose l'horodatage du délai");

    // La deuxième, tout de suite : refusée par la RÈGLE, pas par une politesse du client.
    const trop = await a.api.claimPseudo('Robin');
    ok(!trop.ok && trop.code === 'DELAI', 'changer tout de suite : refusé');
    ok(trop.restantMs > 0 && trop.restantMs <= 86400000, 'et le temps restant est annoncé');
    ok(db.root.pseudos.robin === undefined, "le nom convoité n'a pas été pris au passage");
    ok(db.root.pseudos.nami === 'u1', "l'ancien est toujours là");
    ok(await a.api.myPseudo() === 'Nami', 'le compte porte encore son nom');

    // Le refus ci-dessus vient du pré-contrôle de claimPseudo, qui n'écrit même
    // pas : il ne prouve donc RIEN sur ce qui protège vraiment. On refait la
    // tentative en s'adressant directement à la base, comme le ferait la console
    // du navigateur — c'est là que la règle doit tenir.
    const forcage = await a.raw('PATCH', '', {
      'pseudos/robin': 'u1',
      'pseudo-delai/u1': { '.sv': 'timestamp' },
      'saves/u1/meta/pseudo': 'Robin',
    });
    ok(forcage.status === 401, 'changer tout de suite en contournant le client : refusé par la règle');
    ok(db.root.pseudos.robin === undefined, "et rien n'a été écrit");
    ok(await a.api.myPseudo() === 'Nami', "le nom affiché n'a pas bougé non plus");

    // Changer la CASSE n'est pas changer de nom : le délai ne s'y applique pas.
    const casse = await a.api.claimPseudo('NAMI');
    ok(casse.ok && casse.pseudo === 'NAMI', 'corriger la casse reste possible');

    // Libérer puis reprendre ne doit pas contourner le délai.
    await a.api.releasePseudo();
    const contournement = await a.api.claimPseudo('Robin');
    ok(!contournement.ok && contournement.code === 'DELAI', 'libérer ne remet pas le compteur à zéro');

    // Vingt-quatre heures plus tard, c'est ouvert.
    db.now += 25 * 3600 * 1000;
    const apres = await a.api.claimPseudo('Robin');
    ok(apres.ok && apres.pseudo === 'Robin', 'après 24 h, le changement passe');
    ok(db.root.pseudos.robin === 'u1', "et l'index suit");

    // Les contournements directs, ceux qu'on tenterait depuis la console.
    const sansHorodatage = await b.raw('PUT', 'pseudos/zoro', 'u2');
    ok(sansHorodatage.status === 401, 'réserver par un PUT isolé : refusé');
    const patchSansDelai = await b.raw('PATCH', '', { 'pseudos/zoro': 'u2' });
    ok(patchSansDelai.status === 401, 'réserver sans déclencher le délai : refusé');
    ok(db.root.pseudos.zoro === undefined, "aucune de ces tentatives n'a écrit");

    // b n'a jamais réservé : son premier essai doit passer, délai ou pas.
    const premierDeB = await b.api.claimPseudo('Zoro');
    ok(premierDeB.ok, 'un compte qui n\u2019a jamais réservé n\u2019attend pas');

    // Et l'horodatage lui-même ne se réinitialise pas.
    const effacement = await a.raw('PATCH', '', { 'pseudo-delai/u1': null });
    ok(effacement.status === 401, "effacer l\u2019horodatage du délai : refusé");
    const antidate = await a.raw('PATCH', '', { 'pseudo-delai/u1': 1 });
    ok(antidate.status === 401, "l\u2019antidater : refusé aussi");
  }

  console.log(`\n=== RÉSULTAT : ${passed} PASS, ${failed} FAIL ===`);
  process.exit(failed ? 1 : 0);
}

main().catch(e => { console.error('ÉCHEC DU SCÉNARIO :', e); process.exit(1); });

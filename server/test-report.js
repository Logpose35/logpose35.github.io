// ===== TESTS DE LA ROUTE /report =====
// Lance le serveur sur un port libre et exerce la route de signalement.
// Aucun webhook n'est configuré : les signalements retombent dans stdout,
// ce qui est justement le comportement de repli qu'on veut vérifier.
//
//   node server/test-report.js
'use strict';

const { spawn } = require('child_process');
const path = require('path');

const PORT = 8791;
const BASE = `http://127.0.0.1:${PORT}`;
const ORIGIN_OK = 'https://onepiecedle.fr';
const ORIGIN_KO = 'https://exemple-pirate.test';

let passes = 0, echecs = 0;
function ok(nom, cond, detail) {
  if (cond) { passes++; console.log('  PASS  ' + nom); }
  else { echecs++; console.log('  FAIL  ' + nom + (detail ? '  → ' + detail : '')); }
}

function post(corps, opts = {}) {
  return fetch(BASE + '/report', {
    method: opts.method || 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.origin === null ? {} : { Origin: opts.origin || ORIGIN_OK }),
    },
    body: opts.method === 'OPTIONS' ? undefined : JSON.stringify(corps),
  });
}

const base = { category: 'fiche', message: 'Le premier arc de X est faux.', page: '/classique/', mode: 'classic', version: 'v7.0', lang: 'fr', ua: 'test' };

(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, 'versus-server.js')], {
    env: { ...process.env, VERSUS_PORT: String(PORT), VERSUS_HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  srv.stdout.on('data', d => { logs += d.toString(); });
  srv.stderr.on('data', d => { logs += d.toString(); });

  // attendre que /health réponde
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(BASE + '/health'); if (r.ok) break; } catch (e) {}
    await new Promise(r => setTimeout(r, 250));
  }

  try {
    console.log('\n--- route /report ---');

    let r = await post(base);
    ok('signalement valide -> 200', r.status === 200, 'reçu ' + r.status);
    ok('réponse ok:true', (await r.json()).ok === true);

    r = await post(base, { method: 'OPTIONS' });
    ok('pré-vol OPTIONS -> 204', r.status === 204, 'reçu ' + r.status);
    ok('CORS renvoie l\'origine autorisée',
       r.headers.get('access-control-allow-origin') === ORIGIN_OK);

    r = await post(base, { origin: ORIGIN_KO });
    ok('origine inconnue -> 403', r.status === 403, 'reçu ' + r.status);

    r = await post({ ...base, message: 'ok' });
    ok('message trop court -> 400', r.status === 400, 'reçu ' + r.status);

    r = await post({ ...base, website: 'http://spam.test' });
    ok('leurre -> 200 sans rien enregistrer', r.status === 200);
    ok('leurre journalisé', logs.includes('leurre déclenché'));

    r = await post({ ...base, category: 'nimportequoi' });
    ok('catégorie inconnue acceptée et repliée sur « autre »', r.status === 200);
    ok('catégorie repliée visible dans les logs', logs.includes('"categorie":"autre"'));

    // Le serveur doit RÉPONDRE, pas couper la socket : un client qui reçoit
    // « other side closed » ne peut rien afficher d'utile au joueur.
    let statutGros;
    try {
      const g = await fetch(BASE + '/report', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGIN_OK },
        body: 'x'.repeat(9000),
      });
      statutGros = g.status;
    } catch (e) { statutGros = 'socket coupée (' + e.message + ')'; }
    ok('corps trop gros -> 400 sans couper la socket', statutGros === 400, 'reçu ' + statutGros);

    // 5/heure : les envois valides précédents en ont déjà consommé une partie
    let dernier = 200;
    for (let i = 0; i < 8; i++) dernier = (await post(base)).status;
    ok('limite de débit atteinte -> 429', dernier === 429, 'reçu ' + dernier);

    r = await fetch(BASE + '/health');
    ok('/health toujours vivant après tout ça', r.ok);

    ok('le message est bien dans stdout (repli sans webhook)',
       logs.includes('Le premier arc de X est faux.'));

    console.log(`\n${passes} PASS · ${echecs} FAIL\n`);
  } finally {
    // On laisse la boucle d'événements se vider d'elle-même : un process.exit()
    // immédiat après kill() fait râler libuv sur Windows (handle en cours de
    // fermeture) et donne l'impression d'un plantage alors que tout est passé.
    srv.kill();
    process.exitCode = echecs ? 1 : 0;
  }
})();

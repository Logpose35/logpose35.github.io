// ===== PSEUDOS RÉSERVÉS EN VERSUS =====
// Un pseudo réservé par un compte n'est utilisable QUE par ce compte, y compris
// dans les duels. Le contrôle ne peut pas vivre côté client : une page modifiée
// enverrait ce qu'elle veut. Ces tests éprouvent donc le SERVEUR, en lui parlant
// directement — c'est le seul niveau où la garantie existe.
//
// La table des pseudos est servie par un faux serveur local (VERSUS_PSEUDOS_URL)
// pour ne JAMAIS lire la base de production pendant les tests.
//
//   node server/test-pseudo.js
'use strict';

const { spawn } = require('child_process');
const crypto = require('crypto');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');

const PORT = 8797;
const PORT_FB = 8798;
const URL = `ws://127.0.0.1:${PORT}`;
const ORIGIN = 'http://localhost:3333';
const PROJET = 'logpose-eec08';
const KID = 'test-pseudo';

// Jetons signés pour de vrai : le serveur reçoit le certificat public par
// VERSUS_FB_TEST_CERT et vérifie la signature comme en production. Sans ça, le
// test « le propriétaire passe » ne prouverait rien.
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const b64url = o => Buffer.from(JSON.stringify(o)).toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function jeton(uid) {
  const t = Math.floor(Date.now() / 1000);
  const corps = b64url({ alg: 'RS256', kid: KID, typ: 'JWT' }) + '.' + b64url({
    iss: 'https://securetoken.google.com/' + PROJET, aud: PROJET,
    sub: uid, iat: t - 60, auth_time: t - 60, exp: t + 3600,
  });
  const sig = crypto.createSign('RSA-SHA256').update(corps).sign(privateKey)
    .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return corps + '.' + sig;
}

let passed = 0, failed = 0;
function ok(cond, label) {
  if (cond) { passed++; console.log('  ✅ ' + label); }
  else { failed++; console.log('  ❌ ' + label); }
}

// Table de réservation simulée : « shanks » appartient à uid-A, le reste est libre.
const RESERVES = { shanks: 'uid-A' };
let lectures = 0;

class Sock {
  constructor(nom) { this.nom = nom; this.recus = []; }
  connect() {
    return new Promise((res, rej) => {
      this.ws = new WebSocket(URL, { origin: ORIGIN });
      this.ws.on('open', res);
      this.ws.on('error', rej);
      this.ws.on('message', raw => { try { this.recus.push(JSON.parse(raw)); } catch (e) {} });
    });
  }
  send(type, payload) { this.ws.send(JSON.stringify({ v: 1, type, payload: payload || {} })); }
  waitFor(types, ms) {
    const veut = Array.isArray(types) ? types : [types];
    const trouve = () => this.recus.find(m => veut.includes(m.type));
    const deja = trouve();
    if (deja) return Promise.resolve(deja);
    return new Promise(res => {
      const t = setInterval(() => { const m = trouve(); if (m) { clearInterval(t); clearTimeout(k); res(m); } }, 40);
      const k = setTimeout(() => { clearInterval(t); res(null); }, ms || 4000);
    });
  }
  close() { try { this.ws.close(); } catch (e) {} }
}

const pause = ms => new Promise(r => setTimeout(r, ms));
const OPTS = { bestOf: 1, turnSeconds: 30 };

async function main() {
  // ── Faux Firebase : sert /pseudos/<nom>.json ──
  const fb = http.createServer((req, res) => {
    const m = /^\/pseudos\/([^/.]+)\.json/.exec(req.url || '');
    lectures++;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(m ? (RESERVES[m[1]] ?? null) : null));
  });
  await new Promise(r => fb.listen(PORT_FB, '127.0.0.1', r));

  const srv = spawn(process.execPath, [path.join(__dirname, 'versus-server.js')], {
    // VERSUS_STATS=0 : sans lui les tests écrivent dans les compteurs de PROD.
    // VERSUS_REQUIRE_ACCOUNT=0 : ce fichier teste le pseudo, pas la porte des
    // parties publiques (test-auth-gate.js s'en charge avec de vrais jetons).
    env: { ...process.env, VERSUS_PORT: String(PORT), VERSUS_ALLOW_FAST_TURNS: '1',
           VERSUS_STATS: '0', VERSUS_REQUIRE_ACCOUNT: '0',
           VERSUS_PSEUDOS_URL: `http://127.0.0.1:${PORT_FB}/pseudos`,
           VERSUS_DATA_URL: 'http://127.0.0.1:9/none',
           VERSUS_FB_TEST_CERT: publicKey.export({ type: 'spki', format: 'pem' }),
           VERSUS_FB_TEST_KID: KID },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  srv.stderr.on('data', d => process.stdout.write(`  [srv!] ${d}`));
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('serveur muet')), 8000);
    srv.stdout.on('data', d => { if (String(d).includes('en écoute')) { clearTimeout(t); res(); } });
  });

  try {
    console.log('\n— 1. Un pseudo réservé est refusé à un visiteur —');
    const intrus = new Sock('intrus'); await intrus.connect();
    intrus.send('create_lobby', { pseudo: 'Shanks', options: OPTS });
    const refus = await intrus.waitFor(['lobby_created', 'error']);
    ok(refus && refus.type === 'error', 'la création est refusée, pas acceptée');
    ok(refus && refus.payload.code === 'PSEUDO_RESERVE',
       `le code dit pourquoi (${refus && refus.payload.code})`);

    console.log('\n— 2. La casse ne contourne rien —');
    for (const variante of ['SHANKS', 'sHaNkS', '  shanks  ']) {
      const s = new Sock(variante); await s.connect();
      s.send('create_lobby', { pseudo: variante, options: OPTS });
      const r = await s.waitFor(['lobby_created', 'error']);
      ok(r && r.type === 'error' && r.payload.code === 'PSEUDO_RESERVE',
         `« ${variante} » est refusé comme « shanks »`);
      s.close();
    }

    // ── LE test qui compte ────────────────────────────────────────────────
    // Sans lui, les refus ci-dessus prouveraient seulement qu'on bloque TOUT
    // le monde — y compris le propriétaire, ce qui serait un bug, pas une
    // protection. C'est aussi la mutation qui fait tomber la garde si on
    // remplace `proprio === ws.uid` par un `return false`.
    console.log('\n— 2 bis. Le PROPRIÉTAIRE, lui, passe —');
    const proprio = new Sock('propriétaire'); await proprio.connect();
    proprio.send('create_lobby', { pseudo: 'Shanks', options: OPTS, token: jeton('uid-A') });
    const accepte = await proprio.waitFor(['lobby_created', 'error']);
    ok(accepte && accepte.type === 'lobby_created',
       `uid-A joue « Shanks », son propre pseudo réservé (${accepte && (accepte.payload.code || 'ok')})`);
    proprio.close();
    await pause(200);

    console.log('\n— 2 ter. Un AUTRE compte connecté ne passe pas non plus —');
    // Être connecté ne suffit pas : il faut être le bon compte.
    const autre = new Sock('autre compte'); await autre.connect();
    autre.send('create_lobby', { pseudo: 'Shanks', options: OPTS, token: jeton('uid-B') });
    const refusB = await autre.waitFor(['lobby_created', 'error']);
    ok(refusB && refusB.payload.code === 'PSEUDO_RESERVE',
       'uid-B est refusé bien qu\'il ait un jeton valable');
    autre.close();
    await pause(200);

    console.log('\n— 3. Rejoindre est protégé aussi, pas seulement créer —');
    const hote = new Sock('hôte'); await hote.connect();
    hote.send('create_lobby', { pseudo: 'Zoro', options: OPTS });
    const lobby = await hote.waitFor('lobby_created');
    ok(!!lobby, 'un pseudo libre passe (Zoro)');
    const squatteur = new Sock('squatteur'); await squatteur.connect();
    squatteur.send('join_lobby', { code: lobby.payload.code, pseudo: 'Shanks' });
    const refusJoin = await squatteur.waitFor(['lobby_created', 'error']);
    ok(refusJoin && refusJoin.payload.code === 'PSEUDO_RESERVE',
       'entrer dans un lobby avec le pseudo d\'un autre est refusé');

    console.log('\n— 4. Un pseudo libre reste libre —');
    const libre = new Sock('libre'); await libre.connect();
    libre.send('join_lobby', { code: lobby.payload.code, pseudo: 'Nami' });
    const entre = await libre.waitFor(['lobby_created', 'error']);
    ok(entre && entre.type === 'lobby_created', 'un pseudo non réservé entre sans rien prouver');
    hote.close(); squatteur.close(); libre.close();
    await pause(300);

    console.log('\n— 5. Format hors norme : aucune requête, aucun blocage —');
    // Un nom de 2 lettres ne peut PAS être réservé (la règle impose 3..16) :
    // inutile d'aller le demander à la base.
    const avant = lectures;
    const court = new Sock('court'); await court.connect();
    court.send('create_lobby', { pseudo: 'Ax', options: OPTS });
    const r5 = await court.waitFor(['lobby_created', 'error']);
    ok(r5 && r5.type === 'lobby_created', 'un pseudo hors format passe (il n\'est réservable par personne)');
    ok(lectures === avant, 'et il n\'a coûté aucune lecture de la table');
    court.close();
    await pause(300);

    console.log('\n— 6. Le cache évite de re-demander le même nom —');
    const avant6 = lectures;
    for (let i = 0; i < 3; i++) {
      const s = new Sock('rep' + i); await s.connect();
      s.send('create_lobby', { pseudo: 'Shanks', options: OPTS });
      await s.waitFor('error');
      s.close();
    }
    ok(lectures === avant6, `trois refus du même nom = zéro lecture de plus (${lectures - avant6})`);

    console.log('\n— 7. Base injoignable : on laisse passer —');
    // Choix ASSUMÉ : refuser tous les duels parce que Firebase hoquette serait
    // pire que le risque couvert. Il s'agit d'un nom affiché, pas d'un accès.
    await new Promise(r => fb.close(r));
    const pendantPanne = new Sock('panne'); await pendantPanne.connect();
    pendantPanne.send('create_lobby', { pseudo: 'Inconnu42', options: OPTS });
    const r7 = await pendantPanne.waitFor(['lobby_created', 'error'], 8000);
    ok(r7 && r7.type === 'lobby_created', 'un nom jamais vu passe quand la base ne répond pas');
    pendantPanne.close();

    intrus.close();
  } finally {
    srv.kill();
    try { fb.close(); } catch (e) {}
  }

  console.log(`\n=== RÉSULTAT : ${passed} PASS, ${failed} FAIL ===`);
  process.exit(failed ? 1 : 0);
}

main().catch(e => { console.error('ÉCHEC DU SCÉNARIO :', e.message); process.exit(1); });

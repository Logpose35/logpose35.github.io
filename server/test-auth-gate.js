// ===== TESTS : LE VERSUS EST OUVERT À TOUS, LE JETON N'OUVRE RIEN =====
// `node test-auth-gate.js` — vérifie qu'AUCUNE action du Versus n'exige de
// compte, et qu'un jeton, quand il est là, est bel et bien vérifié.
//
// ⚠️ Ce fichier testait l'inverse jusqu'au 09/09/2026 : les parties publiques
// étaient réservées aux comptes. Le propriétaire est revenu sur cette décision
// le lendemain — tout est ouvert. Le vérificateur de jetons, lui, reste vital :
// c'est lui qui empêche l'usurpation d'un pseudo réservé (voir test-pseudo.js).
// D'où cette suite, qui garde les deux moitiés : rien n'est fermé, et un faux
// jeton ne confère aucune identité.
//
// Contrairement à test-token.js (qui teste le vérificateur isolément), on lance
// ici un VRAI serveur et on lui parle en WebSocket, avec de vrais jetons signés.
// La clé publique est passée au serveur par VERSUS_FB_TEST_CERT — crochet de
// test, inerte tant que la variable n'est pas définie.
'use strict';

const { spawn } = require('child_process');
const crypto = require('crypto');
const path = require('path');
const WebSocket = require('ws');

const PORT = 8796;
const URL = `ws://127.0.0.1:${PORT}`;
const ORIGIN = 'http://localhost:3333';
const PROJET = 'logpose-eec08';
const KID = 'kid-de-test';

let passed = 0, failed = 0;
function ok(cond, label) {
  if (cond) { passed++; console.log(`  ✅ ${label}`); }
  else      { failed++; console.log(`  ❌ ${label}`); }
}

// ── Jetons ────────────────────────────────────────────────────────────────
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const { privateKey: clefPirate } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });

const b64url = o => Buffer.from(JSON.stringify(o)).toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function jeton(extra = {}, clef) {
  const t = Math.floor(Date.now() / 1000);
  const p = Object.assign({
    iss: 'https://securetoken.google.com/' + PROJET, aud: PROJET,
    sub: 'uid-test', iat: t - 60, auth_time: t - 60, exp: t + 3600,
  }, extra);
  const corps = b64url({ alg: 'RS256', kid: KID, typ: 'JWT' }) + '.' + b64url(p);
  const sig = crypto.createSign('RSA-SHA256').update(corps).sign(clef || privateKey)
    .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return corps + '.' + sig;
}

class Sock {
  constructor(tag) { this.tag = tag; this.queue = []; this.waiters = []; }
  connect() {
    return new Promise((res, rej) => {
      this.ws = new WebSocket(URL, { headers: { Origin: ORIGIN } });
      this.ws.on('open', res); this.ws.on('error', rej);
      this.ws.on('message', raw => {
        const m = JSON.parse(raw);
        this.queue.push(m);
        this.waiters = this.waiters.filter(w => !w(m));
      });
    });
  }
  send(type, payload = {}) { this.ws.send(JSON.stringify({ v: 1, type, payload })); }
  waitFor(types, timeout = 6000) {
    const set = Array.isArray(types) ? types : [types];
    const i = this.queue.findIndex(m => set.includes(m.type));
    if (i !== -1) return Promise.resolve(this.queue.splice(i, 1)[0]);
    return new Promise((res, rej) => {
      const w = m => {
        if (!set.includes(m.type)) return false;
        clearTimeout(t); this.queue.splice(this.queue.indexOf(m), 1); res(m); return true;
      };
      const t = setTimeout(() => {
        this.waiters = this.waiters.filter(x => x !== w);
        rej(new Error(`${this.tag}: timeout en attendant ${set.join('/')}`));
      }, timeout);
      this.waiters.push(w);
    });
  }
  close() { this.ws.close(); }
}

const OPTS = { bestOf: 1, turnSeconds: 30 };
const PUBLIC = { ...OPTS, visibility: 'public' };
const pause = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  // Fausse table des pseudos réservés : « shanks » est à uid-A. Servie en local,
  // la base de PRODUCTION n'est jamais interrogée par les tests.
  const PORT_FB = PORT + 1;
  const fb = require('http').createServer((req, res) => {
    const m = /^\/pseudos\/([^/.]+)\.json/.exec(req.url || '');
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(m && m[1] === 'shanks' ? 'uid-A' : null));
  });
  await new Promise(r => fb.listen(PORT_FB, '127.0.0.1', r));

  const srv = spawn(process.execPath, [path.join(__dirname, 'versus-server.js')], {
    // ⚠️ VERSUS_STATS=0 OBLIGATOIRE (pollution des compteurs de prod, 24/08/2026).
    env: { ...process.env, VERSUS_PORT: String(PORT), VERSUS_ALLOW_FAST_TURNS: '1',
           VERSUS_STATS: '0', VERSUS_PSEUDOS_URL: `http://127.0.0.1:${PORT_FB}/pseudos`,
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
    console.log('\n— 1. Ce qui reste OUVERT à tous —');
    {
      // Le duel entre amis par code est le cœur du mode : le fermer punirait les
      // joueurs, alors qu'un robot ne peut rien en faire sans connaître le code.
      const a = new Sock('sans-compte'); await a.connect();
      a.send('create_lobby', { pseudo: 'Anonyme', options: OPTS });
      const r = await a.waitFor(['lobby_created', 'error']);
      ok(r.type === 'lobby_created', 'créer un lobby PRIVÉ sans compte : autorisé');
      const code = r.payload.code;

      const b = new Sock('invite'); await b.connect();
      b.send('join_lobby', { code, pseudo: 'Invite' });
      const r2 = await b.waitFor(['lobby_created', 'error']);
      ok(r2.type === 'lobby_created', 'rejoindre par code sans compte : autorisé');

      const c = new Sock('curieux'); await c.connect();
      c.send('list_lobbies');
      const r3 = await c.waitFor(['lobby_list', 'error']);
      ok(r3.type === 'lobby_list', 'consulter la liste sans compte : autorisé');

      a.close(); b.close(); c.close();
      await pause(300);
    }

    console.log('\n— 2. Le PUBLIC aussi est ouvert à tous —');
    {
      // C'était l'inverse la veille. Ce test EXISTE pour que le retour en
      // arrière se voie tout de suite si quelqu'un remet une porte.
      const a = new Sock('sans-compte'); await a.connect();
      a.send('create_lobby', { pseudo: 'Anonyme2', options: PUBLIC });
      const r = await a.waitFor(['lobby_created', 'error']);
      ok(r.type === 'lobby_created',
         `créer un lobby PUBLIC sans compte : autorisé (${(r.payload && r.payload.code) || 'ok'})`);
      ok(r.type === 'lobby_created' && r.payload.options.visibility === 'public',
         'et il est bien public');

      const b = new Sock('rejoint'); await b.connect();
      b.send('join_lobby', { code: r.payload.code, pseudo: 'Anonyme3' });
      const r2 = await b.waitFor(['lobby_created', 'error']);
      ok(r2.type === 'lobby_created', 'rejoindre un lobby public sans compte : autorisé');

      a.close(); b.close();
      await pause(300);
    }

    console.log('\n— 3. Avec un compte, rien de plus mais rien de moins —');
    {
      // Pseudo LIBRE volontairement : on mesure ici que le compte n'ajoute ni
      // ne retire rien sur un nom que personne n'a réservé.
      const a = new Sock('connecte'); await a.connect();
      a.send('create_lobby', { pseudo: 'Benn', options: PUBLIC, token: jeton() });
      const r = await a.waitFor(['lobby_created', 'error']);
      ok(r.type === 'lobby_created', 'créer un lobby public AVEC un jeton valable : autorisé');
      a.close();
      await pause(300);
    }

    console.log('\n— 4. Un faux jeton ne confère AUCUNE identité —');
    {
      // Le jeton n'ouvre plus de porte, mais il porte l'identité qui protège les
      // pseudos réservés. Un jeton bidon ne doit donc jamais poser d'uid : on le
      // vérifie par le seul canal observable, la protection du pseudo.
      // (`shanks` appartient à uid-A dans la fausse table servie plus bas.)
      const cas = [
        ['signé par une autre clé', jeton({ sub: 'uid-A' }, clefPirate)],
        ['émis pour un autre projet', jeton({ sub: 'uid-A', aud: 'autre-projet' })],
        ['périmé', jeton({ sub: 'uid-A', exp: Math.floor(Date.now() / 1000) - 3600 })],
        ['chaîne quelconque', 'ceci-nest-pas-un-jeton'],
        ['vide', ''],
      ];
      for (const [nom, t] of cas) {
        const s = new Sock('faux'); await s.connect();
        s.send('create_lobby', { pseudo: 'Shanks', options: OPTS, token: t });
        const r = await s.waitFor(['lobby_created', 'error']);
        ok(r.type === 'error' && r.payload.code === 'PSEUDO_RESERVE',
           `${nom} : ne permet pas de porter « Shanks » (${(r.payload && r.payload.code) || r.type})`);
        s.close();
        await pause(120);
      }

      // Le vrai jeton du propriétaire, lui, passe — sinon les refus ci-dessus
      // prouveraient seulement qu'on bloque tout le monde.
      const vrai = new Sock('propriétaire'); await vrai.connect();
      vrai.send('create_lobby', { pseudo: 'Shanks', options: OPTS, token: jeton({ sub: 'uid-A' }) });
      const rv = await vrai.waitFor(['lobby_created', 'error']);
      ok(rv.type === 'lobby_created', 'le jeton signé de uid-A, lui, permet de porter « Shanks »');
      vrai.close();
      await pause(200);
    }
  } finally {
    srv.kill();
    try { fb.close(); } catch (e) { /* deja ferme */ }
  }

  console.log(`\n=== RÉSULTAT : ${passed} PASS, ${failed} FAIL ===`);
  process.exit(failed ? 1 : 0);
}

main().catch(e => { console.error('ÉCHEC DU SCÉNARIO :', e.message); process.exit(1); });

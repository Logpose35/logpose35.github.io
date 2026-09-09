// ===== TESTS DU SALON PUBLIC (liste des parties + file d'attente) =====
// `node test-lobbies.js` — spawn le serveur en mode rapide et vérifie :
//   1. qu'un lobby reste PRIVÉ par défaut (comportement d'avant ce chantier)
//   2. qu'un lobby public apparaît, puis disparaît quand il n'est plus joignable
//   3. que la liste est POUSSÉE aux abonnés, sans qu'ils la redemandent
//   4. que la file d'attente apparie deux joueurs et crée le lobby
//   5. qu'une socket partie ne laisse ni entrée de file, ni abonnement
'use strict';

const { spawn } = require('child_process');
const path = require('path');
const WebSocket = require('ws');

const PORT = 8794;
const URL = `ws://127.0.0.1:${PORT}`;
const ORIGIN = 'http://localhost:3333';

let passed = 0, failed = 0;
function ok(cond, label) {
  if (cond) { passed++; console.log(`  ✅ ${label}`); }
  else      { failed++; console.log(`  ❌ ${label}`); }
}

class Sock {
  constructor(tag) { this.tag = tag; this.queue = []; this.waiters = []; }
  connect() {
    return new Promise((res, rej) => {
      this.ws = new WebSocket(URL, { headers: { Origin: ORIGIN } });
      this.ws.on('open', res);
      this.ws.on('error', rej);
      this.ws.on('message', raw => {
        const m = JSON.parse(raw);
        this.queue.push(m);
        this.waiters = this.waiters.filter(w => !w(m));
      });
    });
  }
  send(type, payload = {}) { this.ws.send(JSON.stringify({ v: 1, type, payload })); }
  waitFor(types, timeout = 6000, pred = null) {
    const set = Array.isArray(types) ? types : [types];
    const match = m => set.includes(m.type) && (!pred || pred(m));
    const i = this.queue.findIndex(match);
    if (i !== -1) return Promise.resolve(this.queue.splice(i, 1)[0]);
    return new Promise((res, rej) => {
      const w = m => {
        if (!match(m)) return false;
        clearTimeout(t);
        this.queue.splice(this.queue.indexOf(m), 1);
        res(m); return true;
      };
      const t = setTimeout(() => {
        this.waiters = this.waiters.filter(x => x !== w);
        rej(new Error(`${this.tag}: timeout en attendant ${set.join('/')}`));
      }, timeout);
      this.waiters.push(w);
    });
  }
  purge(types) { this.queue = this.queue.filter(m => !types.includes(m.type)); }
  close() { this.ws.close(); }
  kill() { this.ws.terminate(); }
}

const pause = ms => new Promise(r => setTimeout(r, ms));
const OPTS = { bestOf: 1, turnSeconds: 30 };

async function main() {
  const srv = spawn(process.execPath, [path.join(__dirname, 'versus-server.js')], {
    // ⚠️ VERSUS_STATS=0 OBLIGATOIRE : sans lui les tests écrivent dans les
    // compteurs Firebase de PRODUCTION (incident du 24/08/2026).
    // VERSUS_REQUIRE_ACCOUNT=0 : ce fichier teste la MÉCANIQUE des lobbys, pas
    // l'authentification. La porte des parties publiques a sa propre suite,
    // test-auth-gate.js, qui elle signe de vrais jetons.
    env: { ...process.env, VERSUS_PORT: String(PORT), VERSUS_ALLOW_FAST_TURNS: '1',
           VERSUS_STATS: '0', VERSUS_REQUIRE_ACCOUNT: '0',
           VERSUS_PSEUDOS_URL: 'http://127.0.0.1:9/none',   // jamais la table de prod
           VERSUS_DATA_URL: 'http://127.0.0.1:9/none' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  srv.stderr.on('data', d => process.stdout.write(`  [srv!] ${d}`));
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('serveur muet')), 8000);
    srv.stdout.on('data', d => { if (String(d).includes('en écoute')) { clearTimeout(t); res(); } });
  });

  try {
    console.log('\n— 1. Privé par défaut —');
    const vitrine = new Sock('vitrine'); await vitrine.connect();
    vitrine.send('list_lobbies');
    let liste = await vitrine.waitFor('lobby_list');
    ok(Array.isArray(liste.payload.lobbies) && liste.payload.lobbies.length === 0, 'la liste démarre vide');
    ok(typeof liste.payload.online === 'number' && typeof liste.payload.queue === 'number',
       `la liste porte les compteurs (online=${liste.payload.online}, file=${liste.payload.queue})`);

    const prive = new Sock('privé'); await prive.connect();
    prive.send('create_lobby', { pseudo: 'Discret', options: OPTS });   // pas de visibility
    const cree = await prive.waitFor('lobby_created');
    ok(cree.payload.options.visibility === 'private', 'un lobby sans visibilité déclarée est privé');
    await pause(200);
    vitrine.purge(['lobby_list']);
    vitrine.send('list_lobbies');
    liste = await vitrine.waitFor('lobby_list');
    ok(liste.payload.lobbies.length === 0, 'il n\'apparaît PAS dans la liste publique');

    console.log('\n— 2. Un lobby public s\'affiche —');
    const hote = new Sock('hôte'); await hote.connect();
    hote.send('create_lobby', { pseudo: 'Shanks', options: { ...OPTS, visibility: 'public' } });
    const creePublic = await hote.waitFor('lobby_created');
    const codePublic = creePublic.payload.code;
    // La liste arrive SEULE : la vitrine est abonnée depuis son list_lobbies.
    const pousse = await vitrine.waitFor('lobby_list', 6000, m => m.payload.lobbies.length > 0);
    const entree = pousse.payload.lobbies[0];
    ok(entree.code === codePublic, 'le lobby public apparaît dans la liste');
    ok(entree.host === 'Shanks', `le pseudo de l'hôte est visible (${entree.host})`);
    ok(entree.bestOf === 1 && entree.turnSeconds === 30, 'les options annoncées sont les bonnes');
    ok(typeof entree.waitingMs === 'number' && entree.waitingMs >= 0, 'le temps d\'attente est fourni');
    ok(pousse.payload.lobbies.every(l => l.code !== cree.payload.code), 'le lobby privé reste absent');

    console.log('\n— 3. Il disparaît dès qu\'il n\'est plus joignable —');
    const venu = new Sock('venu'); await venu.connect();
    venu.send('join_lobby', { code: codePublic, pseudo: 'Beckman' });
    await venu.waitFor('lobby_created');
    const apresJoin = await vitrine.waitFor('lobby_list', 6000, m => m.payload.lobbies.length === 0);
    ok(apresJoin.payload.lobbies.length === 0, 'une fois complet, il sort de la liste');

    venu.close(); hote.close();
    await pause(300);

    console.log('\n— 4. La file apparie deux joueurs —');
    const a = new Sock('A'); await a.connect();
    const b = new Sock('B'); await b.connect();
    a.send('quick_match', { pseudo: 'Luffy', options: { bestOf: 3, turnSeconds: 60 } });
    const enFile = await a.waitFor('queued');
    ok(enFile.payload.position === 1, 'le premier arrivé est mis en file');
    await pause(150);
    b.send('quick_match', { pseudo: 'Zoro', options: { bestOf: 5, turnSeconds: 120 } });
    const lobbyA = await a.waitFor('lobby_created');
    const lobbyB = await b.waitFor('lobby_created');
    ok(lobbyA.payload.code === lobbyB.payload.code, 'les deux reçoivent le MÊME lobby');
    ok(lobbyA.payload.matched === true, 'le client sait qu\'il vient de la file (matched)');
    ok(lobbyA.payload.options.bestOf === 3 && lobbyA.payload.options.turnSeconds === 60,
       'ce sont les options du premier arrivé qui sont retenues');
    ok(lobbyA.payload.options.visibility === 'private', 'un lobby issu de la file n\'est pas listé');
    ok(lobbyA.payload.resumeToken !== lobbyB.payload.resumeToken, 'chacun a son propre jeton de reprise');
    const etat = await a.waitFor('lobby_state');
    ok(etat.payload.players && etat.payload.players.length === 2, 'le lobby contient bien les deux joueurs');
    a.close(); b.close();
    await pause(300);

    console.log('\n— 5. Annulation et sockets parties —');
    const c = new Sock('C'); await c.connect();
    c.send('quick_match', { pseudo: 'Usopp', options: OPTS });
    await c.waitFor('queued');
    c.send('cancel_quick_match');
    await c.waitFor('queue_cancelled');
    vitrine.purge(['lobby_list']);
    vitrine.send('list_lobbies');
    let l2 = await vitrine.waitFor('lobby_list');
    ok(l2.payload.queue === 0, 'annuler libère la place dans la file');

    // Une socket qui part sans annuler ne doit pas bloquer l'appariement suivant.
    const fantome = new Sock('fantôme'); await fantome.connect();
    fantome.send('quick_match', { pseudo: 'Fantome', options: OPTS });
    await fantome.waitFor('queued');
    fantome.kill();
    await pause(400);
    const d = new Sock('D'); await d.connect();
    const e = new Sock('E'); await e.connect();
    d.send('quick_match', { pseudo: 'Nami', options: OPTS });
    await d.waitFor('queued');
    e.send('quick_match', { pseudo: 'Robin', options: OPTS });
    const lobbyD = await d.waitFor('lobby_created', 6000);
    const lobbyE = await e.waitFor('lobby_created', 6000);
    ok(lobbyD.payload.code === lobbyE.payload.code, 'une socket morte en file n\'empêche pas l\'appariement suivant');
    d.close(); e.close(); c.close();
    await pause(300);

    console.log('\n— 6. Garde-fous —');
    const f = new Sock('F'); await f.connect();
    f.send('create_lobby', { pseudo: 'Occupe', options: OPTS });
    await f.waitFor('lobby_created');
    f.send('quick_match', { pseudo: 'Occupe', options: OPTS });
    const err = await f.waitFor('error');
    ok(err.payload.code === 'ALREADY_IN_LOBBY', 'on ne peut pas chercher un adversaire en étant déjà dans un lobby');

    const g = new Sock('G'); await g.connect();
    g.send('quick_match', { pseudo: 'Mauvais', options: { bestOf: 7, turnSeconds: 60 } });
    const err2 = await g.waitFor('error');
    ok(err2.payload.code === 'BAD_OPTIONS', 'les options de la file sont validées comme les autres');

    // Un lobby public reste joignable par son code, comme avant.
    const h = new Sock('H'); await h.connect();
    h.send('create_lobby', { pseudo: 'Ouvert', options: { ...OPTS, visibility: 'public' } });
    const pub2 = await h.waitFor('lobby_created');
    const i = new Sock('I'); await i.connect();
    i.send('join_lobby', { code: pub2.payload.code, pseudo: 'ParCode' });
    const rejoint = await i.waitFor(['lobby_created', 'error']);
    ok(rejoint.type === 'lobby_created', 'un lobby public se rejoint aussi par son code');

    f.close(); g.close(); h.close(); i.close(); vitrine.close(); prive.close();
  } finally {
    srv.kill();
  }

  console.log(`\n=== RÉSULTAT : ${passed} PASS, ${failed} FAIL ===`);
  process.exit(failed ? 1 : 0);
}

main().catch(e => { console.error('ÉCHEC DU SCÉNARIO :', e.message); process.exit(1); });

// ===== COMPTEUR « EN LIGNE » DU SALON — régression du 21/09/2026 =====
// La liste des parties ouvertes est POUSSÉE par le serveur. Elle partait à chaque
// partie créée ou fermée et à chaque nouvel abonné, mais JAMAIS au départ d'une
// socket : le « X pirates en ligne » ne redescendait donc jamais et ne faisait que
// monter. Ce test tient la marche : départ propre, départ brutal, et le compteur
// doit suivre /health. `node test-online.js` → PASS/FAIL.
'use strict';

const { spawn } = require('child_process');
const path = require('path');
const WebSocket = require('ws');

const PORT = 8793;
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
  waitFor(types, timeout = 5000, pred = null) {
    const set = Array.isArray(types) ? types : [types];
    const match = m => set.includes(m.type) && (!pred || pred(m));
    const i = this.queue.findIndex(match);
    if (i !== -1) return Promise.resolve(this.queue.splice(i, 1)[0]);
    return new Promise((res, rej) => {
      const w = m => {
        if (!match(m)) return false;
        clearTimeout(t);
        this.queue.splice(this.queue.indexOf(m), 1);
        res(m);
        return true;
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

const sante = async () => (await fetch(`http://127.0.0.1:${PORT}/health`)).json();

async function main() {
  const srv = spawn(process.execPath, [path.join(__dirname, 'versus-server.js')], {
    // VERSUS_STATS=0 obligatoire : sinon les tests écrivent dans les compteurs de PROD.
    env: { ...process.env, VERSUS_PORT: String(PORT), VERSUS_ALLOW_FAST_TURNS: '1',
           VERSUS_STATS: '0',
           VERSUS_PSEUDOS_URL: 'http://127.0.0.1:9/none',
           VERSUS_DATA_URL: 'http://127.0.0.1:9/none' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  srv.stderr.on('data', d => process.stdout.write(`  [srv!] ${d}`));
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('serveur muet')), 8000);
    srv.stdout.on('data', d => { if (String(d).includes('en écoute')) { clearTimeout(t); res(); } });
  });

  try {
    // ── Un abonné seul ────────────────────────────────────────────────────
    const A = new Sock('A'); await A.connect();
    A.send('list_lobbies');
    const seul = await A.waitFor('lobby_list');
    ok(seul.payload.online === 1, `abonné seul : online = ${seul.payload.online} (attendu 1)`);

    // ── Une arrivée fait monter le compteur chez l'abonné ──────────────────
    const B = new Sock('B'); await B.connect();
    B.send('list_lobbies');
    const deux = await A.waitFor('lobby_list', 5000, m => m.payload.online === 2);
    ok(deux.payload.online === 2, 'une arrivée pousse la liste : online = 2');

    // ── LE BUG : un départ propre doit faire redescendre le compteur ───────
    A.purge(['lobby_list']);
    B.close();
    const apresDepart = await A.waitFor('lobby_list');
    ok(apresDepart.payload.online === 1, `départ propre : online = ${apresDepart.payload.online} (attendu 1)`);

    // ── Départ brutal (réseau coupé, pas de trame de close) ────────────────
    const C = new Sock('C'); await C.connect();
    C.send('list_lobbies');
    await A.waitFor('lobby_list', 5000, m => m.payload.online === 2);
    A.purge(['lobby_list']);
    C.kill();
    const apresBrutal = await A.waitFor('lobby_list');
    ok(apresBrutal.payload.online === 1, `départ brutal : online = ${apresBrutal.payload.online} (attendu 1)`);

    // ── Le compteur poussé dit la même chose que /health ───────────────────
    const h = await sante();
    ok(h.online === 1, `/health d'accord avec le salon : online = ${h.online}`);
    ok(h.lobbies === 0 && h.queue === 0, 'aucun lobby ni file ouverts par ce test');

    // ── Un non-abonné qui s'en va ne casse rien ────────────────────────────
    const D = new Sock('D'); await D.connect();     // ne s'abonne pas
    const troisD = await A.waitFor('lobby_list', 5000, m => m.payload.online === 2).catch(() => null);
    ok(troisD === null, 'une socket qui ne s’abonne pas ne pousse rien (le salon ne bouge pas)');
    A.purge(['lobby_list']);
    D.close();
    const apresD = await A.waitFor('lobby_list');
    ok(apresD.payload.online === 1, 'le départ d’un non-abonné rafraîchit quand même le compteur');

    A.close();
  } finally {
    srv.kill();
  }

  console.log(`\n=== RÉSULTAT : ${passed} PASS, ${failed} FAIL ===`);
  process.exit(failed ? 1 : 0);
}

main().catch(e => { console.error('ÉCHEC DU SCÉNARIO :', e.message); process.exit(1); });

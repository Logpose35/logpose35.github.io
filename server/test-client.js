// ===== CLIENT WS JETABLE — test bout-en-bout du serveur Versus (jalon ①) =====
// Lance lui-même le serveur (port dédié, tours rapides), ouvre 2 connexions et
// déroule un match complet : lobby, erreurs, tours, timeout/strike, coupure +
// resume, victoire, revanche, départ. `node test-client.js` → PASS/FAIL.
'use strict';

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');

const PORT = 8791;
const URL = `ws://127.0.0.1:${PORT}`;
const ORIGIN = 'http://localhost:3333';
const NAMES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data.json'), 'utf8'))
  .CHARACTERS.map(c => c.name);

let passed = 0, failed = 0;
function ok(cond, label) {
  if (cond) { passed++; console.log(`  ✅ ${label}`); }
  else      { failed++; console.log(`  ❌ ${label}`); }
}

class Sock {
  constructor(tag) { this.tag = tag; this.queue = []; this.waiters = []; this.leaked = []; }
  connect() {
    return new Promise((res, rej) => {
      this.ws = new WebSocket(URL, { headers: { Origin: ORIGIN } });
      this.ws.on('open', res);
      this.ws.on('error', rej);
      this.ws.on('message', raw => {
        const m = JSON.parse(raw);
        // Vigie anti-fuite : la cible ne doit JAMAIS apparaître avant round_end
        if (m.type !== 'round_end' && JSON.stringify(m.payload).includes('"target"')) this.leaked.push(m.type);
        this.queue.push(m);
        this.waiters = this.waiters.filter(w => !w(m));
      });
    });
  }
  send(type, payload = {}) { this.ws.send(JSON.stringify({ v: 1, type, payload })); }
  // Attend le prochain message d'un des types donnés (consomme la file d'abord).
  // `pred` optionnel : ignore les messages du bon type qui ne matchent pas —
  // indispensable car les broadcasts des DEUX sockets voyagent indépendamment
  // (un guess_result périmé peut arriver après une purge).
  waitFor(types, timeout = 8000, pred = null) {
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
      // au timeout, RETIRER le guetteur (sinon il consommerait un futur message pour rien)
      const t = setTimeout(() => { this.waiters = this.waiters.filter(x => x !== w); rej(new Error(`${this.tag}: timeout en attendant ${set.join('/')}`)); }, timeout);
      this.waiters.push(w);
    });
  }
  // Purge les broadcasts périmés (le serveur diffuse à CHAQUE changement :
  // sans purge, waitFor consommerait un état obsolète)
  purge(types) { this.queue = this.queue.filter(m => !types.includes(m.type)); }
  close() { this.ws.close(); }
  kill() { this.ws.terminate(); }
}

// Pilote la phase de veto jusqu'au countdown, en laissant `keep` comme décideur
// (bannit tout le reste). Rejoue le countdown dans la file pour la suite du test.
async function driveVeto(socks, keep) {
  const A = socks[0];
  const acted = new Set();
  while (true) {
    const m = await A.waitFor(['lobby_state', 'countdown'], 12000);
    if (m.type === 'countdown') { A.queue.unshift(m); return; }
    const v = m.payload.veto;
    if (m.payload.state !== 'VETO' || !v || acted.has(v.stepIdx)) continue;
    acted.add(v.stepIdx);
    const mode = v.action === 'pick'
      ? (v.avail.includes(keep) ? keep : v.avail[0])
      : (v.avail.find(x => x !== keep) || v.avail[0]);
    socks[v.turnOf].send('veto_action', { mode });
  }
}

async function main() {
  console.log('— Démarrage du serveur de test —');
  const srv = spawn(process.execPath, [path.join(__dirname, 'versus-server.js')], {
    env: { ...process.env, VERSUS_PORT: String(PORT), VERSUS_ALLOW_FAST_TURNS: '1',
           VERSUS_DATA_URL: 'http://127.0.0.1:9/none' }, // fetch échoue vite → fallback local (test hermétique)
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  srv.stdout.on('data', d => process.stdout.write(`  [srv] ${d}`));
  srv.stderr.on('data', d => process.stdout.write(`  [srv!] ${d}`));
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('serveur muet')), 8000);
    srv.stdout.on('data', d => { if (String(d).includes('en écoute')) { clearTimeout(t); res(); } });
  });

  try {
    // ── Lobby ──
    console.log('— Lobby —');
    const A = new Sock('A'), B = new Sock('B'), C = new Sock('C');
    await A.connect();
    A.send('create_lobby', { pseudo: '  Capitaine Trop Long Pseudo XXL  ', options: { bestOf: 1, turnSeconds: 60 } });
    const created = await A.waitFor('lobby_created');
    const { code, resumeToken: tokenA } = created.payload;
    ok(/^[A-HJ-KM-NP-Z2-9]{5}$/.test(code), `code 5 chars sans ambiguïté (${code})`);
    ok(!!tokenA && created.payload.dataVersion.length === 12, 'resumeToken + dataVersion');
    let st = (await A.waitFor('lobby_state')).payload;
    ok(st.players[0].name.length <= 16, `pseudo tronqué à 16 (« ${st.players[0].name} »)`);

    await B.connect();
    B.send('join_lobby', { code: 'ZZZZZ', pseudo: 'B' });
    ok((await B.waitFor('error')).payload.code === 'BAD_CODE', 'join code invalide → BAD_CODE');
    B.send('join_lobby', { code, pseudo: 'Barbe-Test' });
    await B.waitFor('lobby_created');
    st = (await B.waitFor('lobby_state')).payload;
    ok(st.state === 'FULL' && st.players.length === 2, 'join OK → FULL');

    await C.connect();
    C.send('join_lobby', { code, pseudo: 'Intrus' });
    ok((await C.waitFor('error')).payload.code === 'LOBBY_FULL', '3e joueur → LOBBY_FULL');
    C.kill();

    B.send('set_options', { options: { bestOf: 3, turnSeconds: 60 } });
    ok((await B.waitFor('error')).payload.code === 'NOT_CREATOR', 'set_options par B → NOT_CREATOR');
    A.send('set_options', { options: { bestOf: 1, turnSeconds: 2 } });
    do { st = (await A.waitFor('lobby_state')).payload; } while (st.options.turnSeconds !== 2);
    ok(st.players.every(p => !p.ready), 'set_options créateur OK + ready reset');

    // ── Début de partie ──
    console.log('— Manche —');
    A.send('set_ready', { ready: true });
    B.send('set_ready', { ready: true });
    await driveVeto([A, B], 'classic');   // veto (Bo1 : 5 bans) → laisse Classique comme décideur
    await A.waitFor('countdown');
    const turn1 = (await A.waitFor('turn')).payload;
    await B.waitFor('turn');
    ok([0, 1].includes(turn1.turnOf) && turn1.remainingMs > 0, `countdown → tour de ${turn1.turnOf} (${turn1.remainingMs} ms)`);

    const socks = [A, B];                       // index alignés sur players[]
    let turnOf = turn1.turnOf;
    const wrong = socks[turnOf === 0 ? 1 : 0];  // pas son tour
    wrong.send('guess', { name: NAMES[0] });
    ok((await wrong.waitFor('error')).payload.code === 'NOT_YOUR_TURN', 'guess hors tour → NOT_YOUR_TURN');

    socks[turnOf].send('guess', { name: 'Personnage Qui N Existe Pas' });
    ok((await socks[turnOf].waitFor('error')).payload.code === 'UNKNOWN_CHAR', 'perso inconnu → UNKNOWN_CHAR');

    socks[turnOf].send('guess', { name: NAMES[0] });
    const g1 = (await A.waitFor(['guess_result', 'round_end'])).payload;
    let matchDone = false, roundEndSeen = null;
    if (g1.target) { roundEndSeen = g1; matchDone = true; } // NAMES[0] était la cible (1 chance sur 246)
    else {
      ok(g1.by === turnOf && g1.verdicts && g1.char.imgFile !== undefined, 'guess_result : by + verdicts + imgFile');
      turnOf = (await A.waitFor('turn')).payload.turnOf;
      await B.waitFor('turn');
      socks[turnOf].send('guess', { name: NAMES[0] });
      ok((await socks[turnOf].waitFor('error')).payload.code === 'ALREADY_GUESSED', 'même perso re-proposé → ALREADY_GUESSED');

      // ── Timeout / strike : on laisse expirer le tour (2 s) ──
      const to = (await A.waitFor('turn_timeout', 6000)).payload;
      ok(to.player === turnOf && to.strikes === 1, `timeout → strike 1 pour ${to.player}`);
      turnOf = (await A.waitFor('turn')).payload.turnOf;
      await B.waitFor('turn');

      // ── Coupure + resume (LA feature centrale, §2.7) ──
      console.log('— Coupure / resume —');
      const idxA = 0; // A a créé le lobby
      A.kill();
      const od = (await B.waitFor('opponent_disconnected')).payload;
      ok(od.graceMs === 90000, `opponent_disconnected (grace ${od.graceMs} ms)`);
      const A2 = new Sock('A2');
      await A2.connect();
      A2.send('resume', { code, resumeToken: tokenA });
      const snap = (await A2.waitFor('resume_ok')).payload;
      ok(snap.you === idxA && snap.guesses.length >= 1 && snap.turnOf !== null && !snap.paused,
         `resume_ok : snapshot complet (${snap.guesses.length} essai(s), tour de ${snap.turnOf})`);
      await B.waitFor('opponent_reconnected');
      ok(true, 'opponent_reconnected reçu par B');
      socks[0] = A2;

      // ── On joue jusqu'à la victoire (Bo1) ──
      console.log('— Fin de manche —');
      turnOf = snap.turnOf;
      let nameIdx = 1;
      for (let i = 0; i < 300 && !matchDone; i++) {
        while (snap.guesses.some(g => g.char.name === NAMES[nameIdx])) nameIdx++;
        const sock = socks[turnOf], guessed = NAMES[nameIdx];
        sock.purge(['guess_result', 'turn', 'lobby_state', 'countdown', 'turn_timeout']); // borne la file
        sock.send('guess', { name: guessed });
        // On attend LE résultat de CE guess (prédicat), pas un broadcast périmé
        const m = await sock.waitFor(['guess_result', 'round_end', 'error'], 8000,
          x => x.type !== 'guess_result' || x.payload.char.name === guessed);
        if (m.type === 'error') throw new Error(`erreur inattendue : ${m.payload.code}`);
        if (m.type === 'round_end' || m.payload.verdicts.win) {
          roundEndSeen = m.type === 'round_end' ? m.payload : (await sock.waitFor('round_end')).payload;
          matchDone = true;
        } else {
          nameIdx++;
          const next = turnOf === 0 ? 1 : 0; // après un guess valide, le tour passe à l'autre
          await sock.waitFor('turn', 8000, x => x.payload.turnOf === next);
          turnOf = next;
        }
      }
    }
    ok(roundEndSeen && roundEndSeen.target && roundEndSeen.target.name && roundEndSeen.target.imgFile !== undefined,
       `round_end : cible révélée (${roundEndSeen && roundEndSeen.target.name}) après ${roundEndSeen && roundEndSeen.tries} essais`);
    const me = (await socks[0].waitFor('match_end')).payload;
    ok(me.winner === roundEndSeen.winner, `match_end : vainqueur ${me.winner}, scores ${me.scores.join(':')}`);

    // ── Revanche + départ ──
    console.log('— Revanche / départ —');
    socks[0].send('rematch'); socks[1].send('rematch');
    let st2;
    do { st2 = (await socks[1].waitFor('lobby_state')).payload; } while (st2.state !== 'FULL');
    ok(st2.scores.every(s => s === 0) && st2.players.every(p => !p.ready), 'revanche → même lobby, scores remis à zéro');

    socks[1].send('leave_lobby');
    ok((await socks[0].waitFor('lobby_closed')).payload.reason === 'opponent_left', 'leave → lobby_closed pour l’autre');

    // ── /health + vigie anti-fuite ──
    const health = await (await fetch(`http://127.0.0.1:${PORT}/health`)).json();
    ok(health.ok === true && health.characters > 200, `/health : ${health.characters} persos, ${health.lobbies} lobby(s)`);
    ok(A.leaked.length + B.leaked.length + socks[0].leaked.length === 0,
       'la cible n’a JAMAIS fuité avant round_end (vigie sur tous les messages)');
  } finally {
    srv.kill();
  }

  console.log(`\n=== RÉSULTAT : ${passed} PASS, ${failed} FAIL ===`);
  process.exit(failed ? 1 : 0);
}

main().catch(e => { console.error('ÉCHEC DU SCÉNARIO :', e.message); process.exit(1); });

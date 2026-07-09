// ===== ADVERSAIRE AUTOMATISÉ (test manuel du client versus.html) =====
// Usage : node test-opponent.js <CODE> [délai_ms=800]
// Rejoint le lobby, se met prêt, et joue un personnage au hasard à chacun de
// ses tours. Ne connaît pas la cible (comme un vrai joueur). S'arrête au
// match_end (ou lobby_closed).
'use strict';
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const CODE = (process.argv[2] || '').toUpperCase();
const DELAY = parseInt(process.argv[3] || '800', 10);
if (!/^[A-Z2-9]{5}$/.test(CODE)) { console.error('Usage : node test-opponent.js <CODE 5 chars> [délai_ms]'); process.exit(2); }

const CHARS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data.json'), 'utf8')).CHARACTERS;
const NAMES = CHARS.map(c => c.name);
const EMOJI_NAMES = CHARS.filter(c => Array.isArray(c.emoji) && c.emoji.length > 0).map(c => c.name);
let curMode = 'classic';
const ws = new WebSocket('ws://127.0.0.1:8765', { headers: { Origin: 'http://localhost:3333' } });
const send = (type, payload = {}) => ws.send(JSON.stringify({ v: 1, type, payload }));

let myIdx = null, guessed = new Set(), over = false, pending = false;

function playIfMyTurn(turnOf) {
  if (over || pending || turnOf !== myIdx) return; // pending : turn + lobby_state déclenchent tous deux
  pending = true;
  const base = curMode === 'emoji' ? EMOJI_NAMES : NAMES;
  const pool = base.filter(n => !guessed.has(n));
  const pick = pool[Math.floor(Math.random() * pool.length)];
  setTimeout(() => { pending = false; if (!over) { console.log(`[bot] je propose : ${pick}`); send('guess', { name: pick }); } }, DELAY);
}

ws.on('open', () => { console.log(`[bot] connecté, je rejoins ${CODE}…`); send('join_lobby', { code: CODE, pseudo: 'Bot-Baggy' }); });
ws.on('message', raw => {
  const { type, payload } = JSON.parse(raw);
  switch (type) {
    case 'lobby_created': console.log('[bot] dans le lobby, je me mets prêt'); send('set_ready', { ready: true }); break;
    case 'lobby_state':
      if (myIdx === null && payload.you !== undefined) myIdx = payload.you;
      // Revanche acceptée : retour en FULL → on se remet prêt tout seul
      if (payload.state === 'FULL' && myIdx !== null && payload.players[myIdx] && !payload.players[myIdx].ready) send('set_ready', { ready: true });
      if (payload.state === 'IN_GAME' && payload.turnOf !== null && !payload.paused) playIfMyTurn(payload.turnOf);
      break;
    case 'countdown': guessed = new Set(); curMode = payload.mode || 'classic'; console.log(`[bot] manche ${payload.round} (${curMode}) dans ${payload.seconds} s`); break;
    case 'turn': playIfMyTurn(payload.turnOf); break;
    case 'guess_result': guessed.add(payload.char.name); break;
    case 'round_end': console.log(`[bot] manche finie — c'était ${payload.target.name} (${payload.tries} essais), scores ${payload.scores.join(':')}`); break;
    case 'match_end':
      console.log(`[bot] match fini, vainqueur index ${payload.winner} — je propose la revanche`);
      guessed = new Set(); pending = false;
      send('rematch');
      break;
    case 'lobby_closed': console.log(`[bot] lobby fermé (${payload.reason})`); process.exit(0); break;
    case 'opponent_disconnected': console.log('[bot] adversaire déconnecté (grace)…'); break;
    case 'opponent_reconnected': console.log('[bot] adversaire de retour'); break;
    case 'error': console.log(`[bot] erreur : ${payload.code}`); break;
  }
});
ws.on('close', () => { if (!over) { console.log('[bot] socket fermée'); process.exit(1); } });
setTimeout(() => { console.log('[bot] timeout global 10 min'); process.exit(1); }, 600_000);

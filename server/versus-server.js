// ===== SERVEUR VERSUS 1v1 LOGPOSE =====
// Node.js + ws. État 100 % en RAM (pas de BDD) — un restart perd les matchs en
// cours, c'est assumé (matchs courts). Voir BRIEF_V6 §2 pour le protocole.
//
// Principes clefs :
//  - Le client est bête : la cible n'est JAMAIS envoyée avant round_end.
//  - Verdicts calculés ici via ../js/versus-rules.js (SOURCE UNIQUE partagée).
//  - players[]/turnOrder[] (jamais p1/p2 en dur) — le 3+ joueurs resterait une
//    contrainte d'UI, pas de structure.
//  - Timers gérés serveur ; le client ne reçoit que des remainingMs.
//
// Env : VERSUS_PORT (déf. 8765), VERSUS_HOST (déf. 127.0.0.1),
//       VERSUS_ORIGINS (whitelist Origin, séparés par des virgules),
//       VERSUS_DATA_URL (déf. https://onepiecedle.fr/data.json),
//       VERSUS_ALLOW_FAST_TURNS=1 (dev/test : autorise turnSeconds >= 2 et
//       countdown 1 s), VERSUS_ALLOW_NO_ORIGIN=1 (dev : accepte les clients
//       sans header Origin).
'use strict';

const http   = require('http');
const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');
const { WebSocketServer } = require('ws');
const rules  = require('../js/versus-rules.js');

const PORT = parseInt(process.env.VERSUS_PORT || '8765', 10);
const HOST = process.env.VERSUS_HOST || '127.0.0.1';
const DATA_URL = process.env.VERSUS_DATA_URL || 'https://onepiecedle.fr/data.json';
const FAST = process.env.VERSUS_ALLOW_FAST_TURNS === '1';
const ALLOWED_ORIGINS = (process.env.VERSUS_ORIGINS ||
  'https://onepiecedle.fr,https://www.onepiecedle.fr,http://localhost:3333')
  .split(',').map(s => s.trim()).filter(Boolean);

const PROTO_V = 1;
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sans ambiguïté 0/O, 1/I/L
const CODE_LEN = 5;
const GRACE_MS = 90_000;                    // grace period déconnexion
const COUNTDOWN_S = FAST ? 1 : 3;
const INTER_ROUND_MS = FAST ? 1500 : 8000;  // temps de lecture de la réponse entre deux manches (overlay centré)
const TTL_MS = { CREATED: 15 * 60_000, FULL: 10 * 60_000, POST_MATCH: 10 * 60_000 };
const MAX_LOBBIES = 500;
const MAX_STRIKES = 3;                      // 3 timeouts consécutifs = forfait de manche
const VALID_BEST_OF = [1, 3, 5];
const VALID_TURN_S = FAST ? null : [30, 60, 120, 0]; // 0 = ∞ ; null = libre (dev)

// Modes jouables en versus. Les modes visuels (wanted/silhouette/tome) envoient
// la référence de leur asset au client : l'URL révèle la cible en console —
// assumé (jeu fun entre amis, pas d'anti-triche — décision du 09/07/2026).
// Opening attendra (partage de flux audio plus lourd).
const MODES_V = ['classic', 'wanted', 'silhouette', 'fruit', 'emoji', 'tome'];
// Seuils d'indices du mode Fruit (identiques au daily : type @3, traduction @5, description @8)
const FRU_HINTS_AT = { type: 3, translated: 5, description: 8 };

// ── Données du jeu (data.json) ─────────────────────────────────────────────
// Fetch prod au démarrage + toutes les 6 h (aligné sur ce que voient les
// joueurs sans git pull) ; fallback froid : la copie du repo.
let CHARACTERS = [], ALIASES = {}, DATA_VERSION = 'inconnue';
let EMOJI_POOL = [], FRUITS_V = [];   // pools dérivés (mêmes règles que data.js/le daily)
let WANTED_POOL = [], SIL_POOL_S = [], TOMES_V = [];  // pools wanted/silhouette/tome
let SIL_FOCUS = {};                   // focus.json (source du pool silhouette, comme le daily)
let lastDataRefetch = 0;
const FOCUS_URL = process.env.VERSUS_FOCUS_URL || 'https://onepiecedle.fr/silhouettes/focus.json';

function loadDataFromText(txt, source) {
  const d = JSON.parse(txt);
  if (!Array.isArray(d.CHARACTERS) || d.CHARACTERS.length < 100) {
    throw new Error('data.json suspect (CHARACTERS manquant/trop petit)');
  }
  CHARACTERS = d.CHARACTERS;
  ALIASES = d.ALIASES || {};
  EMOJI_POOL = CHARACTERS.filter(c => Array.isArray(c.emoji) && c.emoji.length > 0);
  FRUITS_V = (d.FRUITS || []).filter(f => f.holder && CHARACTERS.some(c => c.name === f.holder));
  WANTED_POOL = CHARACTERS.filter(c => c.img !== null && c.img !== undefined);
  TOMES_V = Array.isArray(d.TOMES) ? d.TOMES : [];
  rebuildSilPool();
  DATA_VERSION = crypto.createHash('sha256').update(txt).digest('hex').slice(0, 12);
  console.log(`[data] ${CHARACTERS.length} persos chargés (${source}, version ${DATA_VERSION}) — pools : ${EMOJI_POOL.length} émoji, ${FRUITS_V.length} fruits, ${WANTED_POOL.length} wanted, ${SIL_POOL_S.length} silhouettes, ${TOMES_V.length} tomes`);
}

// Le pool silhouette dépend de DEUX sources (data.json × focus.json) — reconstruit
// quand l'une ou l'autre change.
function rebuildSilPool() {
  SIL_POOL_S = CHARACTERS.filter(c => { const k = imgFileOf(c); return k && SIL_FOCUS[k]; });
}

async function refreshFocus(reason) {
  try {
    const res = await fetch(FOCUS_URL, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    SIL_FOCUS = await res.json();
  } catch (e) {
    // Fallback froid : copie du repo (absente dans le conteneur → pool vide,
    // le mode silhouette est alors simplement indisponible, pas d'erreur)
    try { SIL_FOCUS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'silhouettes', 'focus.json'), 'utf8')); }
    catch { console.warn(`[data] focus.json indisponible (${reason} : ${e.message}) — mode silhouette désactivé`); }
  }
  rebuildSilPool();
  console.log(`[data] pool silhouette : ${SIL_POOL_S.length} persos (focus ${reason})`);
}

async function refreshData(reason) {
  try {
    const res = await fetch(DATA_URL, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    loadDataFromText(await res.text(), `fetch ${reason}`);
    return true;
  } catch (e) {
    console.warn(`[data] re-fetch échoué (${reason}) : ${e.message}`);
    return false;
  }
}

function loadDataFallback() {
  const p = path.join(__dirname, '..', 'data.json');
  loadDataFromText(fs.readFileSync(p, 'utf8'), 'fichier local');
}

// Auto-guérison du skew : sur UNKNOWN_CHAR, UN re-fetch throttlé (10 min)
async function throttledRefetch() {
  if (Date.now() - lastDataRefetch < 10 * 60_000) return false;
  lastDataRefetch = Date.now();
  return refreshData('UNKNOWN_CHAR');
}

const imgFileOf = c => Array.isArray(c.img) ? c.img[0] : c.img; // versus : pas de seed de date

// ── Utilitaires ────────────────────────────────────────────────────────────
const lobbies = new Map(); // code → lobby

function newCode() {
  for (let tries = 0; tries < 50; tries++) {
    let code = '';
    for (let i = 0; i < CODE_LEN; i++) code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
    if (!lobbies.has(code)) return code;
  }
  return null; // improbable (31^5 ≈ 28,6 M)
}

function cleanPseudo(raw) {
  const s = String(raw ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 16);
  return s || 'Pirate';
}

function validOptions(o) {
  const bestOf = Number(o?.bestOf ?? 3);
  const turnSeconds = Number(o?.turnSeconds ?? 60);
  if (!VALID_BEST_OF.includes(bestOf)) return null;
  if (VALID_TURN_S ? !VALID_TURN_S.includes(turnSeconds)
                   : !(turnSeconds === 0 || (turnSeconds >= 2 && turnSeconds <= 600))) return null;
  return { bestOf, turnSeconds }; // les modes par manche viennent des picks des joueurs
}

function send(ws, type, payload = {}) {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify({ v: PROTO_V, type, payload }));
}

// Rate-limit create/join par IP (jeu entre amis : borne large, anti-scan)
const ipHits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const hits = (ipHits.get(ip) || []).filter(t => now - t < 60_000);
  hits.push(now); ipHits.set(ip, hits);
  return hits.length > 20;
}

// ── Lobby ──────────────────────────────────────────────────────────────────
function makeLobby(code, options) {
  return {
    code, options,
    state: 'CREATED',            // CREATED → FULL → IN_GAME → POST_MATCH
    createdAt: Date.now(), touchedAt: Date.now(),
    players: [],                 // [{ name, ws, resumeToken, ready, connected, wantsRematch, graceTimer }]
    picks: ['classic', 'classic'], // mode choisi par chaque joueur (index aligné sur players[])
    roundModes: [],              // programme des manches, figé à startMatch
    turnOrder: [],               // indices dans players — 1re manche au hasard, puis alternance
    scores: [],                  // manches gagnées par joueur
    round: 0,                    // n° de manche 1-based
    roundsHistory: [],           // [{ winner, targetName, tries, mode }]
    cur: null,                   // manche courante : { mode, target, fruit?, emojiOrder?, wrongCount, guesses[], guessedNames:Set, turnOf, deadline, remainingOnPause, strikes[], timer }
    countdownTimer: null,
    paused: false,
  };
}

// Pool de devinettes par mode (sert aussi de test de disponibilité : un pool
// vide — ex. focus.json injoignable — rend le mode inéligible aux picks/décideur)
function poolForMode(m) {
  return m === 'emoji' ? EMOJI_POOL : m === 'fruit' ? FRUITS_V
       : m === 'wanted' ? WANTED_POOL : m === 'silhouette' ? SIL_POOL_S
       : m === 'tome' ? TOMES_V : CHARACTERS;
}
const modeAvailable = m => MODES_V.includes(m) && poolForMode(m).length > 0;

// Programme des manches : picks alternés, la dernière (décideur) au tirage au sort.
// Bo1 : le pick du créateur.
function buildRoundModes(lb) {
  const n = lb.options.bestOf;
  if (n === 1) return [lb.picks[0]];
  const modes = [];
  for (let r = 1; r < n; r++) modes.push(lb.picks[(r - 1) % 2]);
  const avail = MODES_V.filter(modeAvailable);
  modes.push(avail[crypto.randomInt(avail.length)]);   // décideur
  return modes;
}

// Indice courant de la manche (partagé — l'info adverse fait partie du jeu)
function clueFor(lb) {
  const cur = lb.cur;
  if (!cur) return null;
  if (cur.mode === 'emoji') {
    return { emojis: cur.emojiOrder.slice(0, Math.min(cur.wrongCount + 1, cur.emojiOrder.length)), total: cur.emojiOrder.length };
  }
  if (cur.mode === 'fruit') {
    const h = {};
    for (const [k, at] of Object.entries(FRU_HINTS_AT)) if (cur.wrongCount >= at) h[k] = cur.fruit[k];
    return { fruitName: cur.fruit.name, hints: h, nextHintIn: nextHintIn(cur.wrongCount) };
  }
  // Modes visuels : le client calcule flou/dézoom depuis wrongCount (paliers du daily)
  if (cur.mode === 'wanted') {
    return { img: imgFileOf(cur.target), wrongCount: cur.wrongCount };
  }
  if (cur.mode === 'silhouette') {
    const k = imgFileOf(cur.target);
    return { silKey: k, focus: SIL_FOCUS[k] || null, wrongCount: cur.wrongCount };
  }
  if (cur.mode === 'tome') {
    return { cover: cur.target.tome, zoom: cur.tomeZoom, wrongCount: cur.wrongCount };
  }
  return null; // classic : pas d'indice, les verdicts suffisent
}
function nextHintIn(wrong) {
  const next = Object.values(FRU_HINTS_AT).filter(at => at > wrong).sort((a, b) => a - b)[0];
  return next ? next - wrong : null;
}

function touch(lb) { lb.touchedAt = Date.now(); }

function playerIdxOf(lb, ws) { return lb.players.findIndex(p => p.ws === ws); }

function otherIdx(i) { return i === 0 ? 1 : 0; }

// Snapshot idempotent (§2.5) : le client peut TOUT reconstruire depuis ça.
// `you` étant par joueur, on construit un snapshot par destinataire.
function snapshotFor(lb, idx) {
  return {
    code: lb.code, state: lb.state, options: lb.options, dataVersion: DATA_VERSION,
    you: idx,
    players: lb.players.map(p => ({ name: p.name, ready: p.ready, connected: p.connected, wantsRematch: p.wantsRematch })),
    picks: lb.picks.slice(),
    roundModes: lb.roundModes.slice(),
    scores: lb.scores.slice(),
    round: lb.round,
    roundsHistory: lb.roundsHistory.slice(),
    mode: lb.cur ? lb.cur.mode : null,
    clue: clueFor(lb),
    turnOf: lb.cur ? lb.cur.turnOf : null,
    remainingMs: turnRemainingMs(lb),
    paused: lb.paused,
    strikes: lb.cur ? lb.cur.strikes.slice() : [],
    guesses: lb.cur ? lb.cur.guesses.slice() : [],   // fiches complètes + verdicts (déjà publiques)
  };
}

function broadcastState(lb) {
  lb.players.forEach((p, i) => send(p.ws, 'lobby_state', snapshotFor(lb, i)));
}

function turnRemainingMs(lb) {
  if (!lb.cur || lb.options.turnSeconds === 0) return null;
  if (lb.paused) return lb.cur.remainingOnPause ?? null;
  if (!lb.cur.deadline) return null;
  return Math.max(0, lb.cur.deadline - Date.now());
}

function closeLobby(lb, reason) {
  clearTimeout(lb.countdownTimer);
  if (lb.cur) clearTimeout(lb.cur.timer);
  lb.players.forEach(p => {
    clearTimeout(p.graceTimer);
    send(p.ws, 'lobby_closed', { reason });
    if (p.ws && p.ws.readyState === p.ws.OPEN) p.ws.close();
  });
  lobbies.delete(lb.code);
  console.log(`[lobby ${lb.code}] fermé (${reason}) — ${lobbies.size} lobbies actifs`);
}

// ── Déroulé d'une partie ───────────────────────────────────────────────────
function startMatch(lb) {
  lb.state = 'IN_GAME';
  lb.scores = lb.players.map(() => 0);
  lb.round = 0;
  lb.roundsHistory = [];
  lb.roundModes = buildRoundModes(lb);
  // 1re manche : premier joueur au tirage au sort ; ensuite alternance stricte
  const first = crypto.randomInt(2);
  lb.turnOrder = [first, otherIdx(first)];
  lb.players.forEach(p => { p.wantsRematch = false; });
  console.log(`[lobby ${lb.code}] programme des manches : ${lb.roundModes.join(' → ')}`);
  startRound(lb);
}

// Mélange crypto (Fisher-Yates) — l'ordre des emojis ne doit pas être prévisible
function cryptoShuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function startRound(lb) {
  lb.round++;
  let mode = lb.roundModes[lb.round - 1] || 'classic';
  if (!modeAvailable(mode)) mode = 'classic';  // pool devenu vide (ex : focus.json perdu au re-fetch)
  // Cible par mode — aléa crypto, jamais le seed quotidien
  let target, fruit = null, emojiOrder = null, tomeZoom = null;
  if (mode === 'emoji') {
    target = EMOJI_POOL[crypto.randomInt(EMOJI_POOL.length)];
    emojiOrder = cryptoShuffle(target.emoji);
  } else if (mode === 'fruit') {
    fruit = FRUITS_V[crypto.randomInt(FRUITS_V.length)];
    target = CHARACTERS.find(c => c.name === fruit.holder);
  } else if (mode === 'wanted') {
    target = WANTED_POOL[crypto.randomInt(WANTED_POOL.length)];
  } else if (mode === 'silhouette') {
    target = SIL_POOL_S[crypto.randomInt(SIL_POOL_S.length)];
  } else if (mode === 'tome') {
    const n = TOMES_V[crypto.randomInt(TOMES_V.length)];
    target = { name: `Tome ${n}`, tome: n };  // pseudo-fiche : .name suffit à endRound/history
    tomeZoom = { x: 18 + crypto.randomInt(64), y: 18 + crypto.randomInt(64) }; // comme le daily : centre bridé loin des bords
  } else {
    target = CHARACTERS[crypto.randomInt(CHARACTERS.length)];
  }
  const firstPlayer = lb.turnOrder[(lb.round - 1) % 2];
  lb.cur = {
    mode, target, fruit, emojiOrder, tomeZoom, wrongCount: 0,
    guesses: [], guessedNames: new Set(),
    turnOf: firstPlayer,
    deadline: null, remainingOnPause: null,
    strikes: lb.players.map(() => 0),
    timer: null,
  };
  touch(lb);
  console.log(`[lobby ${lb.code}] manche ${lb.round} (${mode}) — commence : ${lb.players[firstPlayer].name}`);
  lb.players.forEach(p => send(p.ws, 'countdown', { seconds: COUNTDOWN_S, round: lb.round, mode }));
  lb.countdownTimer = setTimeout(() => { beginTurn(lb, firstPlayer); broadcastState(lb); }, COUNTDOWN_S * 1000);
}

function beginTurn(lb, idx) {
  const cur = lb.cur;
  cur.turnOf = idx;
  clearTimeout(cur.timer);
  if (lb.options.turnSeconds > 0 && !lb.paused) {
    cur.deadline = Date.now() + lb.options.turnSeconds * 1000;
    cur.timer = setTimeout(() => onTurnTimeout(lb), lb.options.turnSeconds * 1000);
  } else {
    cur.deadline = null;
  }
  console.log(`[lobby ${lb.code}] → turn ${cur.turnOf} (${lb.players[cur.turnOf].name}), ${turnRemainingMs(lb)} ms`);
  lb.players.forEach(p => send(p.ws, 'turn', { turnOf: cur.turnOf, remainingMs: turnRemainingMs(lb), round: lb.round }));
}

function onTurnTimeout(lb) {
  const cur = lb.cur;
  if (!cur || lb.state !== 'IN_GAME' || lb.paused) return;
  const idx = cur.turnOf;
  cur.strikes[idx]++;
  console.log(`[lobby ${lb.code}] timeout de ${lb.players[idx].name} (strike ${cur.strikes[idx]})`);
  lb.players.forEach(p => send(p.ws, 'turn_timeout', { player: idx, strikes: cur.strikes[idx] }));
  if (cur.strikes[idx] >= MAX_STRIKES) {
    endRound(lb, otherIdx(idx), 'forfait de manche (3 timeouts consécutifs)');
  } else {
    beginTurn(lb, otherIdx(idx));
    broadcastState(lb);
  }
}

function endRound(lb, winnerIdx, why) {
  const cur = lb.cur;
  clearTimeout(cur.timer);
  lb.scores[winnerIdx]++;
  const targetFiche = { ...cur.target, imgFile: imgFileOf(cur.target) };
  const fruitName = cur.fruit ? cur.fruit.name : null;
  lb.roundsHistory.push({ winner: winnerIdx, targetName: cur.target.name, tries: cur.guesses.length, mode: cur.mode, fruitName });
  console.log(`[lobby ${lb.code}] manche ${lb.round} (${cur.mode}) → ${lb.players[winnerIdx].name} (${why}) — scores ${lb.scores.join(':')}`);
  lb.players.forEach(p => send(p.ws, 'round_end', {
    winner: winnerIdx, target: targetFiche, tries: cur.guesses.length,
    scores: lb.scores.slice(), round: lb.round, why, mode: cur.mode, fruitName,
  }));
  const needed = Math.floor(lb.options.bestOf / 2) + 1;
  if (lb.scores[winnerIdx] >= needed) {
    lb.state = 'POST_MATCH';
    lb.cur = null;
    touch(lb);
    lb.players.forEach(p => send(p.ws, 'match_end', { winner: winnerIdx, scores: lb.scores.slice() }));
    broadcastState(lb);
  } else {
    lb.cur = null;
    setTimeout(() => { if (lb.state === 'IN_GAME' && lobbies.has(lb.code)) startRound(lb); }, INTER_ROUND_MS);
  }
}

function handleGuess(lb, idx, name) {
  const cur = lb.cur;
  const p = lb.players[idx];
  if (lb.state !== 'IN_GAME' || !cur) return send(p.ws, 'error', { code: 'GAME_IN_PROGRESS', message: 'Pas de manche en cours' });
  if (lb.paused) return send(p.ws, 'error', { code: 'PAUSED' });
  if (cur.turnOf !== idx) return send(p.ws, 'error', { code: 'NOT_YOUR_TURN' });

  // Mode Tome : on devine un NUMÉRO, pas un personnage
  if (cur.mode === 'tome') {
    const n = parseInt(name, 10);
    const max = TOMES_V.length ? Math.max(...TOMES_V) : 0;
    if (!Number.isInteger(n) || n < 1 || n > max) {
      return send(p.ws, 'error', { code: 'UNKNOWN_CHAR', message: name });
    }
    if (cur.guessedNames.has(String(n))) return send(p.ws, 'error', { code: 'ALREADY_GUESSED' });
    cur.guessedNames.add(String(n));
    cur.strikes[idx] = 0;
    const win = n === cur.target.tome;
    if (!win) cur.wrongCount++;
    const verdicts = win ? { win } : { win, dir: n < cur.target.tome ? 'higher' : 'lower' };
    const entry = { by: idx, tome: n, verdicts };
    cur.guesses.push(entry);
    touch(lb);
    const clue = clueFor(lb);
    lb.players.forEach(pp => send(pp.ws, 'guess_result', { ...entry, clue }));
    if (win) endRound(lb, idx, 'tome trouvé');
    else { beginTurn(lb, otherIdx(idx)); broadcastState(lb); }
    return;
  }

  const char = CHARACTERS.find(c => c.name === name);
  if (!char) {
    throttledRefetch();
    return send(p.ws, 'error', { code: 'UNKNOWN_CHAR', message: name });
  }
  // Pool restreint selon le mode (émoji/wanted/silhouette : persos éligibles seulement,
  // aligné sur l'autocomplete client — même règle que le daily)
  if ((cur.mode === 'emoji' || cur.mode === 'wanted' || cur.mode === 'silhouette')
      && !poolForMode(cur.mode).includes(char)) {
    return send(p.ws, 'error', { code: 'NOT_IN_POOL' });
  }
  if (cur.guessedNames.has(char.name)) return send(p.ws, 'error', { code: 'ALREADY_GUESSED' });

  cur.guessedNames.add(char.name);
  cur.strikes[idx] = 0; // jouer remet ses strikes à zéro
  // Verdicts par mode : grille complète en classic, ✅/❌ + indice partagé sinon
  let verdicts;
  if (cur.mode === 'classic') {
    verdicts = rules.computeVerdicts(char, cur.target);
  } else {
    const win = char.name === cur.target.name;
    if (!win) cur.wrongCount++;
    verdicts = { win };
  }
  const entry = { by: idx, char: { ...char, imgFile: imgFileOf(char) }, verdicts };
  cur.guesses.push(entry);
  touch(lb);
  const clue = clueFor(lb);
  lb.players.forEach(pp => send(pp.ws, 'guess_result', { ...entry, clue }));

  if (verdicts.win) {
    endRound(lb, idx, 'perso trouvé');
  } else {
    beginTurn(lb, otherIdx(idx));
    broadcastState(lb);
  }
}

// ── Déconnexion / reprise (§2.7 — LA feature centrale) ────────────────────
function onDisconnect(lb, idx) {
  const p = lb.players[idx];
  p.connected = false;
  p.ws = null;
  touch(lb);
  console.log(`[lobby ${lb.code}] ${p.name} déconnecté (état ${lb.state})`);

  if (lb.state === 'CREATED') return closeLobby(lb, 'creator_left');

  if (lb.state === 'IN_GAME' && !lb.paused) {
    // Pause : timers gelés
    lb.paused = true;
    if (lb.cur) {
      lb.cur.remainingOnPause = lb.cur.deadline ? Math.max(0, lb.cur.deadline - Date.now()) : null;
      clearTimeout(lb.cur.timer);
    }
    clearTimeout(lb.countdownTimer); // entre deux manches : on repartira au resume
  }
  const other = lb.players[otherIdx(idx)];
  send(other?.ws, 'opponent_disconnected', { graceMs: GRACE_MS });

  p.graceTimer = setTimeout(() => {
    if (!lobbies.has(lb.code) || p.connected) return;
    if (lb.state === 'IN_GAME') {
      // Grace expirée → forfait du MATCH pour le déconnecté
      const winner = otherIdx(idx);
      lb.state = 'POST_MATCH';
      if (lb.cur) clearTimeout(lb.cur.timer);
      lb.cur = null; lb.paused = false;
      touch(lb);
      send(lb.players[winner]?.ws, 'match_end', { winner, scores: lb.scores.slice(), why: 'forfait (déconnexion)' });
      broadcastState(lb);
    } else {
      closeLobby(lb, 'opponent_left');
    }
  }, GRACE_MS);
}

function handleResume(ws, code, token) {
  const lb = lobbies.get(String(code || '').toUpperCase());
  if (!lb) return send(ws, 'error', { code: 'BAD_CODE' });
  const idx = lb.players.findIndex(p => p.resumeToken === token);
  if (idx === -1) return send(ws, 'error', { code: 'BAD_RESUME' });
  const p = lb.players[idx];

  // Double connexion : la nouvelle socket supplante l'ancienne
  if (p.ws && p.ws.readyState === p.ws.OPEN) {
    send(p.ws, 'lobby_closed', { reason: 'superseded' });
    p.ws.removeAllListeners('close');
    p.ws.close();
  }
  clearTimeout(p.graceTimer);
  p.ws = ws; p.connected = true;
  ws.lobbyCode = lb.code;
  touch(lb);
  console.log(`[lobby ${lb.code}] ${p.name} reconnecté`);

  // Dégel des timers
  if (lb.paused && lb.players.every(pp => pp.connected)) {
    lb.paused = false;
    if (lb.state === 'IN_GAME') {
      if (lb.cur) {
        if (lb.options.turnSeconds > 0 && lb.cur.remainingOnPause != null) {
          lb.cur.deadline = Date.now() + lb.cur.remainingOnPause;
          lb.cur.timer = setTimeout(() => onTurnTimeout(lb), lb.cur.remainingOnPause);
          lb.cur.remainingOnPause = null;
        }
      } else {
        startRound(lb); // la coupure était entre deux manches
      }
    }
  }
  send(ws, 'resume_ok', snapshotFor(lb, idx));
  send(lb.players[otherIdx(idx)]?.ws, 'opponent_reconnected', {});
  broadcastState(lb);
}

// ── Dispatch des messages ──────────────────────────────────────────────────
function onMessage(ws, raw, ip) {
  let msg;
  try { msg = JSON.parse(raw); } catch { return send(ws, 'error', { code: 'BAD_MESSAGE' }); }
  if (msg?.v !== PROTO_V) return send(ws, 'error', { code: 'BAD_PROTOCOL_VERSION', message: `attendu v=${PROTO_V}` });
  const { type, payload = {} } = msg;

  if (type === 'ping') return send(ws, 'pong', {});
  if (type === 'resume') return handleResume(ws, payload.code, payload.resumeToken);

  if (type === 'create_lobby') {
    if (ws.lobbyCode) return send(ws, 'error', { code: 'ALREADY_IN_LOBBY' });
    if (rateLimited(ip)) return send(ws, 'error', { code: 'RATE_LIMITED' });
    if (lobbies.size >= MAX_LOBBIES) return send(ws, 'error', { code: 'SERVER_FULL' });
    const options = validOptions(payload.options);
    if (!options) return send(ws, 'error', { code: 'BAD_OPTIONS' });
    const code = newCode();
    if (!code) return send(ws, 'error', { code: 'SERVER_FULL' });
    const lb = makeLobby(code, options);
    lb.players.push({
      name: cleanPseudo(payload.pseudo), ws, resumeToken: crypto.randomBytes(16).toString('hex'),
      ready: false, connected: true, wantsRematch: false, graceTimer: null,
    });
    lobbies.set(code, lb);
    ws.lobbyCode = code;
    console.log(`[lobby ${code}] créé par ${lb.players[0].name} (Bo${options.bestOf}, ${options.turnSeconds || '∞'} s) — ${lobbies.size} lobbies`);
    send(ws, 'lobby_created', { code, options, resumeToken: lb.players[0].resumeToken, dataVersion: DATA_VERSION });
    broadcastState(lb);
    return;
  }

  if (type === 'join_lobby') {
    if (ws.lobbyCode) return send(ws, 'error', { code: 'ALREADY_IN_LOBBY' });
    if (rateLimited(ip)) return send(ws, 'error', { code: 'RATE_LIMITED' });
    const lb = lobbies.get(String(payload.code || '').toUpperCase());
    if (!lb) return send(ws, 'error', { code: 'BAD_CODE' });
    if (lb.state === 'IN_GAME' || lb.state === 'POST_MATCH') return send(ws, 'error', { code: 'GAME_IN_PROGRESS' });
    if (lb.players.length >= 2) return send(ws, 'error', { code: 'LOBBY_FULL' });
    // payload.role : réservé (spectateur possible plus tard — §2.9)
    const player = {
      name: cleanPseudo(payload.pseudo), ws, resumeToken: crypto.randomBytes(16).toString('hex'),
      ready: false, connected: true, wantsRematch: false, graceTimer: null,
    };
    lb.players.push(player);
    lb.state = 'FULL';
    touch(lb);
    ws.lobbyCode = lb.code;
    console.log(`[lobby ${lb.code}] ${player.name} a rejoint`);
    send(ws, 'lobby_created', { code: lb.code, options: lb.options, resumeToken: player.resumeToken, dataVersion: DATA_VERSION });
    broadcastState(lb);
    return;
  }

  // Tous les messages suivants exigent d'être dans un lobby
  const lb = lobbies.get(ws.lobbyCode);
  if (!lb) return send(ws, 'error', { code: 'NOT_IN_LOBBY' });
  const idx = playerIdxOf(lb, ws);
  if (idx === -1) return send(ws, 'error', { code: 'NOT_IN_LOBBY' });

  switch (type) {
    case 'set_options': {
      // Créateur uniquement, en FULL/CREATED, tant que personne n'est prêt ;
      // toute modif reset les ready (§2.3)
      if (idx !== 0) return send(ws, 'error', { code: 'NOT_CREATOR' });
      if (lb.state !== 'CREATED' && lb.state !== 'FULL') return send(ws, 'error', { code: 'GAME_IN_PROGRESS' });
      const options = validOptions(payload.options);
      if (!options) return send(ws, 'error', { code: 'BAD_OPTIONS' });
      lb.options = options;
      lb.players.forEach(p => { p.ready = false; });
      touch(lb);
      broadcastState(lb);
      return;
    }
    case 'set_pick': {
      // Chaque joueur choisit SON mode (pour sa manche du programme), avant le match
      if (lb.state !== 'CREATED' && lb.state !== 'FULL') return send(ws, 'error', { code: 'GAME_IN_PROGRESS' });
      const mode = String(payload.mode || '');
      if (!modeAvailable(mode)) return send(ws, 'error', { code: 'BAD_OPTIONS' });
      lb.picks[idx] = mode;
      touch(lb);
      broadcastState(lb);
      return;
    }
    case 'set_ready': {
      if (lb.state !== 'FULL') return send(ws, 'error', { code: 'GAME_IN_PROGRESS' });
      lb.players[idx].ready = !!payload.ready;
      touch(lb);
      if (lb.players.length === 2 && lb.players.every(p => p.ready)) startMatch(lb);
      broadcastState(lb);
      return;
    }
    case 'guess':
      return handleGuess(lb, idx, String(payload.name ?? ''));
    case 'rematch': {
      if (lb.state !== 'POST_MATCH') return send(ws, 'error', { code: 'GAME_IN_PROGRESS' });
      lb.players[idx].wantsRematch = true;
      touch(lb);
      if (lb.players.length === 2 && lb.players.every(p => p.wantsRematch)) {
        // Revanche : même lobby, même code, retour à l'écran « prêt ? »
        lb.state = 'FULL';
        lb.players.forEach(p => { p.ready = false; p.wantsRematch = false; });
        lb.scores = lb.players.map(() => 0);
        lb.round = 0; lb.roundsHistory = []; lb.cur = null;
      }
      broadcastState(lb);
      return;
    }
    case 'leave_lobby': {
      ws.lobbyCode = null;
      closeLobby(lb, 'opponent_left'); // matchs courts entre amis : partir ferme le lobby
      return;
    }
    default:
      return send(ws, 'error', { code: 'BAD_MESSAGE', message: `type inconnu : ${type}` });
  }
}

// ── Serveur HTTP (health) + WebSocket ──────────────────────────────────────
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, lobbies: lobbies.size, characters: CHARACTERS.length, dataVersion: DATA_VERSION, uptime: Math.round(process.uptime()) }));
  } else {
    res.writeHead(404); res.end();
  }
});

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const origin = req.headers.origin;
  const okOrigin = origin ? ALLOWED_ORIGINS.includes(origin)
                          : process.env.VERSUS_ALLOW_NO_ORIGIN === '1';
  if (!okOrigin) {
    console.warn(`[ws] Origin refusé : ${origin || '(absent)'}`);
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
});

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress || '?';
  ws.isAlive = true;
  ws.lobbyCode = null;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', raw => {
    try { onMessage(ws, raw, ip); }
    catch (e) { console.error('[ws] erreur de traitement :', e); send(ws, 'error', { code: 'SERVER_ERROR' }); }
  });
  ws.on('close', () => {
    const lb = lobbies.get(ws.lobbyCode);
    if (!lb) return;
    const idx = playerIdxOf(lb, ws);
    if (idx !== -1) onDisconnect(lb, idx);
  });
});

// Heartbeat protocolaire ~30 s (nginx/Caddy coupent les sockets muettes ; détecte
// aussi les sockets zombies mobiles) — doublé côté client par un ping applicatif.
const heartbeat = setInterval(() => {
  wss.clients.forEach(ws => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30_000);

// GC : sweep toutes les 60 s des lobbies expirés (TTL par état, §2.3)
const gc = setInterval(() => {
  const now = Date.now();
  for (const lb of [...lobbies.values()]) {
    const ttl = TTL_MS[lb.state];
    if (ttl && now - lb.touchedAt > ttl) closeLobby(lb, 'expired');
    if (now - lb.createdAt > 24 * 3600_000) closeLobby(lb, 'expired'); // borne absolue
  }
  for (const [ip, hits] of ipHits) if (hits.every(t => now - t > 60_000)) ipHits.delete(ip);
}, 60_000);

// Drain gracieux : SIGTERM (restart systemd/docker) → on prévient les joueurs
process.on('SIGTERM', () => {
  console.log('[srv] SIGTERM — fermeture gracieuse');
  for (const lb of [...lobbies.values()]) closeLobby(lb, 'server_restart');
  clearInterval(heartbeat); clearInterval(gc);
  wss.close(); server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
});

// ── Démarrage ──────────────────────────────────────────────────────────────
(async () => {
  loadDataFallback();                       // fallback froid immédiat (copie du repo)
  await refreshData('démarrage');           // puis alignement sur la prod
  await refreshFocus('démarrage');          // pool silhouette (focus.json prod)
  setInterval(() => { refreshData('périodique'); refreshFocus('périodique'); }, 6 * 3600_000).unref();
  server.listen(PORT, HOST, () => {
    console.log(`[srv] Versus 1v1 en écoute sur ${HOST}:${PORT} (origins : ${ALLOWED_ORIGINS.join(' ')})`);
  });
})();

// ===== TEST DES MODES VERSUS (veto CS2 + 6 modes + décideur) =====
// `node test-modes.js` — spawn le serveur en mode rapide et joue :
//   1. un Bo3 où le veto force émoji + fruit (indices émoji/fruit)
//   2. un Bo3 où le veto force wanted + silhouette (indices visuels)
//   3. un Bo1 où le veto force le tome comme décideur (devinette numérique)
// Vérifie aussi la mécanique du veto (tour, ban/pick, mode indisponible).
'use strict';

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');

const PORT = 8792;
const URL = `ws://127.0.0.1:${PORT}`;
const ORIGIN = 'http://localhost:3333';
const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data.json'), 'utf8'));
const ALL = DATA.CHARACTERS;
const ALL_NAMES = ALL.map(c => c.name);
const EMOJI_NAMES = ALL.filter(c => Array.isArray(c.emoji) && c.emoji.length > 0).map(c => c.name);
const WANTED_NAMES = ALL.filter(c => c.img !== null && c.img !== undefined).map(c => c.name);
const imgKey = c => Array.isArray(c.img) ? c.img[0] : c.img;
let SIL_FOCUS = {};
try { SIL_FOCUS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'silhouettes', 'focus.json'), 'utf8')); } catch {}
const SIL_NAMES = ALL.filter(c => imgKey(c) && SIL_FOCUS[imgKey(c)]).map(c => c.name);
const TOME_MAX = Math.max(...(DATA.TOMES || [112]));

function poolNamesFor(mode) {
  return mode === 'emoji' ? EMOJI_NAMES : mode === 'wanted' ? WANTED_NAMES
       : mode === 'silhouette' ? SIL_NAMES : ALL_NAMES;
}

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
        if (process.env.TRACE) console.log(`      [${this.tag}] ← ${m.type}${m.type === 'countdown' ? ' (manche ' + m.payload.round + ', ' + m.payload.mode + ')' : ''}`);
        this.queue.push(m);
        this.waiters = this.waiters.filter(w => !w(m));
      });
    });
  }
  send(type, payload = {}) { this.ws.send(JSON.stringify({ v: 1, type, payload })); }
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
        res(m); return true;
      };
      const t = setTimeout(() => { this.waiters = this.waiters.filter(x => x !== w); rej(new Error(`${this.tag}: timeout en attendant ${set.join('/')}`)); }, timeout);
      this.waiters.push(w);
    });
  }
  purge(types) { this.queue = this.queue.filter(m => !types.includes(m.type)); }
  kill() { this.ws.terminate(); }
}

// Crée + rejoint un lobby (plus de picks : le veto se joue après « prêt »)
async function makeLobby(pseudoA, pseudoB, options) {
  const A = new Sock('A'), B = new Sock('B');
  await A.connect(); await B.connect();
  A.send('create_lobby', { pseudo: pseudoA, options });
  const { code } = (await A.waitFor('lobby_created')).payload;
  B.send('join_lobby', { code, pseudo: pseudoB });
  await B.waitFor('lobby_created');
  let st; do { st = (await A.waitFor('lobby_state')).payload; } while (st.state !== 'FULL');
  return [A, B];
}

// Passe « prêt » des deux côtés, puis pilote le veto : sur une action 'pick' on
// choisit un mode de `prefer` (pour le forcer au programme), sur un 'ban' on
// retire un mode HORS `prefer`. Rend la file dans l'état « juste avant countdown ».
async function readyAndVeto(socks, prefer, onFirstVeto) {
  const [A, B] = socks;
  A.send('set_ready', { ready: true });
  B.send('set_ready', { ready: true });
  const acted = new Set();
  let firstChecked = false;
  while (true) {
    const m = await A.waitFor(['lobby_state', 'countdown'], 12000);
    if (m.type === 'countdown') { A.queue.unshift(m); return; }       // veto terminé, la manche démarre
    const st = m.payload;
    if (st.state !== 'VETO' || !st.veto) continue;
    const v = st.veto;
    if (!firstChecked && onFirstVeto) { onFirstVeto(v); firstChecked = true; }
    if (acted.has(v.stepIdx)) continue;                               // snapshot en double
    acted.add(v.stepIdx);
    const mode = v.action === 'pick'
      ? (prefer.find(x => v.avail.includes(x)) || v.avail[0])
      : (v.avail.find(x => !prefer.includes(x)) || v.avail[0]);
    socks[v.turnOf].send('veto_action', { mode });
  }
}

// Joue un match complet (toutes manches jusqu'à match_end). onClue(mode, wrongs, clue).
async function playMatch(socks, bestOf, onClue) {
  const [A, B] = socks;
  let matchEnd = null;
  for (let r = 1; r <= bestOf && !matchEnd; r++) {
    const cd = (await A.waitFor('countdown', 12000)).payload;
    await B.waitFor('countdown');
    A.purge(['guess_result', 'lobby_state', 'turn_timeout', 'round_end']);
    B.purge(['guess_result', 'lobby_state', 'turn_timeout', 'round_end']);
    const mode = cd.mode;
    console.log(`  [test] manche ${cd.round} (${mode}) — countdown reçu`);
    let turnOf = (await A.waitFor('turn', 12000, x => x.payload.round === cd.round)).payload.turnOf;
    let wrongs = 0, roundOver = false, lo = 1, hi = TOME_MAX, nameIdx = 0;
    const pool = poolNamesFor(mode);
    const guessed = new Set();

    for (let i = 0; i < 400 && !roundOver; i++) {
      const sock = socks[turnOf];
      let pick, pred;
      if (mode === 'tome') {
        const n = Math.floor((lo + hi) / 2); pick = String(n);
        pred = x => x.type !== 'guess_result' || x.payload.tome === n;
      } else {
        while (guessed.has(pool[nameIdx])) nameIdx++;
        pick = pool[nameIdx]; guessed.add(pick);
        pred = x => x.type !== 'guess_result' || x.payload.char.name === pick;
      }
      sock.purge(['guess_result', 'turn', 'lobby_state', 'countdown', 'turn_timeout']);
      sock.send('guess', { name: pick });
      const m = await sock.waitFor(['guess_result', 'round_end', 'error'], 8000, pred);
      if (m.type === 'error') throw new Error(`manche ${r} (${mode}) : erreur ${m.payload.code} sur ${pick}`);
      if (m.type === 'round_end') { roundOver = true; break; }
      if (m.payload.verdicts.win) {
        const re = (await sock.waitFor('round_end')).payload;
        if (onClue) onClue(mode, 'round_end', re);
        roundOver = true; break;
      }
      wrongs++;
      if (mode === 'tome') {
        const n = parseInt(pick, 10);
        if (wrongs === 1) ok(['higher', 'lower'].includes(m.payload.verdicts.dir), `tome : verdict directionnel (${n} → ${m.payload.verdicts.dir})`);
        if (m.payload.verdicts.dir === 'higher') lo = n + 1; else hi = n - 1;
      }
      if (onClue) onClue(mode, wrongs, m.payload.clue);
      const next = turnOf === 0 ? 1 : 0;
      await sock.waitFor('turn', 8000, x => x.payload.turnOf === next);
      turnOf = next;
    }
    const me = await Promise.race([
      socks[0].waitFor('match_end', 3000).catch(() => null),
      socks[1].waitFor('match_end', 3000).catch(() => null),
    ]);
    if (me) matchEnd = me.payload;
  }
  return matchEnd;
}

async function main() {
  const srv = spawn(process.execPath, [path.join(__dirname, 'versus-server.js')], {
    env: { ...process.env, VERSUS_PORT: String(PORT), VERSUS_ALLOW_FAST_TURNS: '1',
           VERSUS_DATA_URL: 'http://127.0.0.1:9/none', VERSUS_FOCUS_URL: 'http://127.0.0.1:9/none' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  srv.stdout.on('data', d => process.stdout.write(`  [srv] ${d}`));
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('serveur muet')), 8000);
    srv.stdout.on('data', d => { if (String(d).includes('en écoute')) { clearTimeout(t); res(); } });
  });

  try {
    // ── Scénario 0 : mécanique du veto (tour, mode indisponible) ──
    console.log('\n— Scénario 0 : mécanique du veto —');
    const s0 = await makeLobby('MecA', 'MecB', { bestOf: 3, turnSeconds: 60 });
    s0[0].send('set_ready', { ready: true }); s0[1].send('set_ready', { ready: true });
    let v0; do { v0 = (await s0[0].waitFor('lobby_state')).payload; } while (v0.state !== 'VETO');
    ok(v0.veto && v0.veto.total === 5 && v0.veto.action === 'ban', `veto démarré : 5 actions, ouvre par un ban`);
    const wrong = v0.veto.turnOf === 0 ? 1 : 0;
    s0[wrong].send('veto_action', { mode: v0.veto.avail[0] });
    ok((await s0[wrong].waitFor('error')).payload.code === 'NOT_YOUR_TURN', 'action hors-tour → NOT_YOUR_TURN');
    s0[v0.veto.turnOf].send('veto_action', { mode: 'zzz-inexistant' });
    ok((await s0[v0.veto.turnOf].waitFor('error')).payload.code === 'BAD_OPTIONS', 'mode indisponible → BAD_OPTIONS');
    s0[0].send('leave_lobby'); s0[0].kill(); s0[1].kill();
    await new Promise(r => setTimeout(r, 300));

    // ── Scénario 1 : Bo3, veto force émoji + fruit ──
    console.log('\n— Scénario 1 : Bo3 veto → émoji / fruit —');
    const s1 = await makeLobby('VetoA', 'VetoB', { bestOf: 3, turnSeconds: 60 });
    await readyAndVeto(s1, ['emoji', 'fruit'], v => {
      ok(v.total === 5, `Bo3 : veto de 5 actions`);
    });
    let emojiChecks = false, fruitChecks = false;
    const m1 = await playMatch(s1, 3, (mode, wrongs, clue) => {
      if (mode === 'emoji' && wrongs === 1 && !emojiChecks) {
        emojiChecks = true;
        ok(Array.isArray(clue.emojis) && clue.emojis.length === 2, `émoji : 2 emojis après 1 erreur (${(clue.emojis || []).join(' ')})`);
      }
      if (mode === 'fruit' && wrongs === 3 && !fruitChecks) {
        fruitChecks = true;
        ok(clue.fruitName && clue.hints.type, `fruit : indice « type » à 3 erreurs (${clue.fruitName})`);
      }
    });
    ok(!!m1 && Math.max(...m1.scores) === 2, `match_end : scores ${m1 && m1.scores.join(':')}`);
    ok(emojiChecks, 'le mode émoji a bien été forcé par le veto et vérifié');
    s1[0].kill(); s1[1].kill();
    await new Promise(r => setTimeout(r, 300));

    // ── Scénario 2 : Bo3, veto force wanted + silhouette ──
    console.log('\n— Scénario 2 : Bo3 veto → wanted / silhouette —');
    ok(SIL_NAMES.length > 0, `pool silhouette local : ${SIL_NAMES.length} persos`);
    const s2 = await makeLobby('WantA', 'SilB', { bestOf: 3, turnSeconds: 60 });
    await readyAndVeto(s2, ['wanted', 'silhouette']);
    let wantedClue = false, silClue = false;
    const m2 = await playMatch(s2, 3, (mode, wrongs, clue) => {
      if (mode === 'wanted' && wrongs === 1 && !wantedClue) {
        wantedClue = true;
        ok(typeof clue.img === 'string' && clue.wrongCount === 1, `wanted : indice image + wrongCount (${clue.img})`);
      }
      if (mode === 'silhouette' && wrongs === 1 && !silClue) {
        silClue = true;
        ok(typeof clue.silKey === 'string', `silhouette : indice silKey (${clue.silKey})`);
      }
    });
    ok(!!m2 && Math.max(...m2.scores) === 2, `match_end : scores ${m2 && m2.scores.join(':')}`);
    ok(wantedClue, 'le mode wanted a bien été forcé et vérifié');
    s2[0].kill(); s2[1].kill();
    await new Promise(r => setTimeout(r, 300));

    // ── Scénario 3 : Bo1, veto force le tome comme décideur ──
    console.log('\n— Scénario 3 : Bo1 veto → tome (décideur) —');
    const s3 = await makeLobby('TomeA', 'TomeB', { bestOf: 1, turnSeconds: 60 });
    await readyAndVeto(s3, ['tome'], v => {
      ok(v.total === 5 && v.action === 'ban', `Bo1 : 5 bans (motif ${v.total} actions)`);
    });
    let tomeClue = false, tomeEnd = null, tomeWasPlayed = false;
    const m3 = await playMatch(s3, 1, (mode, wrongs, clue) => {
      if (mode === 'tome') tomeWasPlayed = true;
      if (mode === 'tome' && wrongs === 1 && !tomeClue) {
        tomeClue = true;
        ok(Number.isInteger(clue.cover) && clue.zoom && clue.zoom.x >= 18 && clue.zoom.x <= 82, `tome : indice cover + zoom (Tome ${clue.cover})`);
      }
      if (mode === 'tome' && wrongs === 'round_end') tomeEnd = clue;
    });
    ok(tomeWasPlayed, 'le décideur forcé par le veto est bien le tome');
    ok(!!m3 && Math.max(...m3.scores) === 1, `match_end Bo1 : scores ${m3 && m3.scores.join(':')}`);
    ok(!tomeEnd || /^Tome \d+$/.test(tomeEnd.target.name), `décideur = tome : ${tomeEnd ? tomeEnd.target.name : '(gagné du 1er coup)'}`);
    s3[0].kill(); s3[1].kill();
  } finally {
    srv.kill();
  }
  console.log(`\n=== RÉSULTAT : ${passed} PASS, ${failed} FAIL ===`);
  process.exit(failed ? 1 : 0);
}

main().catch(e => { console.error('ÉCHEC DU SCÉNARIO :', e.message); process.exit(1); });

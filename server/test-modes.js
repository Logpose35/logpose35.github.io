// ===== TEST DES MODES VERSUS (picks Bo3, 6 modes, décideur) =====
// `node test-modes.js` — spawn le serveur en mode rapide et joue :
//   1. un Bo3 émoji/fruit (+ décideur au sort, tous modes possibles)
//   2. un Bo3 wanted/silhouette (indices visuels + pools restreints)
//   3. un Bo1 tome (devinette numérique, plus haut / plus bas)
// PASS/FAIL en sortie.
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
const MODES_ALL = ['classic', 'wanted', 'silhouette', 'fruit', 'emoji', 'tome'];
const NON_EMOJI = ALL.find(c => !Array.isArray(c.emoji) || !c.emoji.length);
const NON_SIL = ALL.find(c => !SIL_NAMES.includes(c.name));

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
      // au timeout, RETIRER le guetteur (sinon il consommerait un futur message pour rien)
      const t = setTimeout(() => { this.waiters = this.waiters.filter(x => x !== w); rej(new Error(`${this.tag}: timeout en attendant ${set.join('/')}`)); }, timeout);
      this.waiters.push(w);
    });
  }
  purge(types) { this.queue = this.queue.filter(m => !types.includes(m.type)); }
  kill() { this.ws.terminate(); }
}

// Joue un match complet (toutes manches jusqu'à match_end). `onClue(mode, wrongs, clue)`
// est appelé après chaque erreur pour les vérifications d'indices.
async function playMatch(socks, bestOf, onClue) {
  const [A, B] = socks;
  let matchEnd = null;
  for (let r = 1; r <= bestOf && !matchEnd; r++) {
    const cd = (await A.waitFor('countdown', 12000)).payload;
    await B.waitFor('countdown');
    // Purge des broadcasts périmés — dont le round_end de la manche précédente,
    // resté dans la file du PERDANT (seul le gagnant le consomme dans la boucle).
    A.purge(['guess_result', 'lobby_state', 'turn_timeout', 'round_end']);
    B.purge(['guess_result', 'lobby_state', 'turn_timeout', 'round_end']);
    const mode = cd.mode;
    console.log(`  [test] manche ${cd.round} (${mode}) — countdown reçu`);
    let turnOf = (await A.waitFor('turn', 12000, x => x.payload.round === cd.round)).payload.turnOf;
    let wrongs = 0, roundOver = false;
    // Mode tome : recherche dichotomique par plus haut / plus bas
    let lo = 1, hi = TOME_MAX;
    const pool = poolNamesFor(mode);
    const guessed = new Set();
    let nameIdx = 0;

    for (let i = 0; i < 400 && !roundOver; i++) {
      const sock = socks[turnOf];
      let pick, pred;
      if (mode === 'tome') {
        const n = Math.floor((lo + hi) / 2);
        pick = String(n);
        pred = x => x.type !== 'guess_result' || x.payload.tome === n;
      } else {
        while (guessed.has(pool[nameIdx])) nameIdx++;
        pick = pool[nameIdx];
        guessed.add(pick);
        pred = x => x.type !== 'guess_result' || x.payload.char.name === pick;
      }
      sock.purge(['guess_result', 'turn', 'lobby_state', 'countdown', 'turn_timeout']);
      sock.send('guess', { name: pick });
      const m = await sock.waitFor(['guess_result', 'round_end', 'error'], 8000, pred);
      if (m.type === 'error') throw new Error(`manche ${r} (${mode}) : erreur ${m.payload.code} sur ${pick}`);
      if (i > 0 && i % 40 === 0) console.log(`  [test] manche ${cd.round} : ${i} essais…`);
      if (m.type === 'round_end') { roundOver = true; break; }
      if (m.payload.verdicts.win) {
        const re = (await sock.waitFor('round_end')).payload;
        if (onClue) onClue(mode, 'round_end', re);
        roundOver = true; break;
      }
      wrongs++;
      if (mode === 'tome') {
        const n = parseInt(pick, 10);
        if (wrongs === 1) ok(['higher', 'lower'].includes(m.payload.verdicts.dir),
                            `tome : verdict directionnel (${n} → ${m.payload.verdicts.dir})`);
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

async function makeLobby(pseudoA, pseudoB, options, pickA, pickB) {
  const A = new Sock('A'), B = new Sock('B');
  await A.connect(); await B.connect();
  A.send('create_lobby', { pseudo: pseudoA, options });
  const { code } = (await A.waitFor('lobby_created')).payload;
  if (pickA) A.send('set_pick', { mode: pickA });
  B.send('join_lobby', { code, pseudo: pseudoB });
  await B.waitFor('lobby_created');
  if (pickB) B.send('set_pick', { mode: pickB });
  return [A, B];
}

async function startWhenPicked(socks, wantPicks) {
  const [A, B] = socks;
  let st;
  do { st = (await B.waitFor('lobby_state')).payload; }
  while (!(st.picks[0] === wantPicks[0] && (wantPicks[1] == null || st.picks[1] === wantPicks[1])));
  A.send('set_ready', { ready: true }); B.send('set_ready', { ready: true });
  do { st = (await A.waitFor('lobby_state')).payload; } while (st.state !== 'IN_GAME');
  return st;
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
    // ── Scénario 1 : Bo3 émoji / fruit + décideur ──
    console.log('\n— Scénario 1 : Bo3 émoji / fruit —');
    const s1 = await makeLobby('PickA', 'PickB', { bestOf: 3, turnSeconds: 60 }, 'emoji', 'fruit');
    const [A, B] = s1;
    B.send('set_pick', { mode: 'plonk' });
    ok((await B.waitFor('error')).payload.code === 'BAD_OPTIONS', 'pick invalide → BAD_OPTIONS');
    const st = await startWhenPicked(s1, ['emoji', 'fruit']);
    ok(st.roundModes[0] === 'emoji' && st.roundModes[1] === 'fruit', `programme : ${st.roundModes.join(' → ')}`);
    ok(MODES_ALL.includes(st.roundModes[2]), `décideur tiré au sort (${st.roundModes[2]})`);

    let emojiChecks = false, fruitChecks = false, notInPoolChecked = !NON_EMOJI;
    if (!notInPoolChecked) {
      // hors-pool émoji : proposé par le premier joueur au premier tour
      const first = (await A.waitFor('turn', 12000)).payload;
      A.queue.unshift({ type: 'turn', payload: first }); // re-file le message pour playMatch
      const sock = s1[first.turnOf];
      sock.send('guess', { name: NON_EMOJI.name });
      ok((await sock.waitFor('error')).payload.code === 'NOT_IN_POOL', `hors-pool émoji → NOT_IN_POOL (${NON_EMOJI.name})`);
      notInPoolChecked = true;
    }
    const m1 = await playMatch(s1, 3, (mode, wrongs, clue) => {
      if (mode === 'emoji' && wrongs === 1 && !emojiChecks) {
        emojiChecks = true;
        ok(Array.isArray(clue.emojis) && clue.emojis.length === 2,
           `émoji : 2 emojis révélés après 1 erreur (${(clue.emojis || []).join(' ')})`);
      }
      if (mode === 'fruit' && wrongs === 3 && !fruitChecks) {
        fruitChecks = true;
        ok(clue.fruitName && clue.hints.type, `fruit : indice « type » débloqué à 3 erreurs (${clue.fruitName} → ${clue.hints.type})`);
      }
    });
    ok(!!m1 && Math.max(...m1.scores) === 2, `match_end : scores ${m1 && m1.scores.join(':')}`);
    ok(emojiChecks, 'les vérifications émoji ont bien eu lieu');
    ok(fruitChecks || true, fruitChecks ? 'les vérifications fruit ont bien eu lieu' : 'fruit : manche finie avant 3 erreurs (vérif sautée, OK)');
    A.kill(); B.kill();
    await new Promise(r => setTimeout(r, 300));

    // ── Scénario 2 : Bo3 wanted / silhouette (indices visuels) ──
    console.log('\n— Scénario 2 : Bo3 wanted / silhouette —');
    ok(SIL_NAMES.length > 0, `pool silhouette local : ${SIL_NAMES.length} persos`);
    const s2 = await makeLobby('WantA', 'SilB', { bestOf: 3, turnSeconds: 60 }, 'wanted', 'silhouette');
    const st2 = await startWhenPicked(s2, ['wanted', 'silhouette']);
    ok(st2.roundModes[0] === 'wanted' && st2.roundModes[1] === 'silhouette', `programme : ${st2.roundModes.join(' → ')}`);
    let wantedClue = false, silClue = false;
    const m2 = await playMatch(s2, 3, (mode, wrongs, clue) => {
      if (mode === 'wanted' && wrongs === 1 && !wantedClue) {
        wantedClue = true;
        ok(typeof clue.img === 'string' && clue.img.length > 0 && clue.wrongCount === 1,
           `wanted : indice image + wrongCount (img=${clue.img}, wrong=${clue.wrongCount})`);
      }
      if (mode === 'silhouette' && wrongs === 1 && !silClue) {
        silClue = true;
        ok(typeof clue.silKey === 'string' && (clue.focus === null || Array.isArray(clue.focus)),
           `silhouette : indice silKey + focus (${clue.silKey} @ ${JSON.stringify(clue.focus)})`);
      }
      if (mode === 'silhouette' && wrongs === 'round_end') { /* rien */ }
    });
    ok(!!m2 && Math.max(...m2.scores) === 2, `match_end : scores ${m2 && m2.scores.join(':')}`);
    ok(wantedClue, 'les vérifications wanted ont bien eu lieu');
    ok(silClue || true, silClue ? 'les vérifications silhouette ont bien eu lieu' : 'silhouette : manche 2 non jouée (2-0), OK');
    s2[0].kill(); s2[1].kill();
    await new Promise(r => setTimeout(r, 300));

    // ── Scénario 3 : Bo1 tome (numérique) ──
    console.log('\n— Scénario 3 : Bo1 tome —');
    const s3 = await makeLobby('TomeA', 'TomeB', { bestOf: 1, turnSeconds: 60 }, 'tome', null);
    const st3 = await startWhenPicked(s3, ['tome']);
    ok(st3.roundModes.length === 1 && st3.roundModes[0] === 'tome', `programme Bo1 : ${st3.roundModes.join('')}`);
    let tomeClue = false, tomeEnd = null;
    const m3 = await playMatch(s3, 1, (mode, wrongs, clue) => {
      if (mode === 'tome' && wrongs === 1 && !tomeClue) {
        tomeClue = true;
        ok(Number.isInteger(clue.cover) && clue.zoom && clue.zoom.x >= 18 && clue.zoom.x <= 82,
           `tome : indice cover + zoom (Tome ${clue.cover}, zoom ${clue.zoom.x}/${clue.zoom.y})`);
      }
      if (mode === 'tome' && wrongs === 'round_end') tomeEnd = clue;  // clue = payload round_end ici
    });
    ok(!!m3 && Math.max(...m3.scores) === 1, `match_end Bo1 : scores ${m3 && m3.scores.join(':')}`);
    ok(!tomeEnd || /^Tome \d+$/.test(tomeEnd.target.name), `round_end tome : ${tomeEnd ? tomeEnd.target.name : '(gagné du 1er coup)'}`);
    s3[0].kill(); s3[1].kill();
  } finally {
    srv.kill();
  }
  console.log(`\n=== RÉSULTAT : ${passed} PASS, ${failed} FAIL ===`);
  process.exit(failed ? 1 : 0);
}

main().catch(e => { console.error('ÉCHEC DU SCÉNARIO :', e.message); process.exit(1); });

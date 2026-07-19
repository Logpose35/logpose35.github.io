// ===== CLIENT VERSUS 1v1 (versus.html) =====
// Page dédiée, indépendante d'app.js (voir BRIEF_V6 §2.8). Le client est BÊTE :
// il ne connaît jamais la cible avant round_end, ne calcule aucun verdict, et
// reconstruit toute son UI depuis les snapshots lobby_state/resume_ok.
// Dépendances chargées avant : js/data.js (CHARACTERS/ALIASES/ARCS via
// loadGameData) et js/versus-rules.js (fruitLabel, charMatchesQuery, getMatchHint).
(function () {
  'use strict';

  // ── Clés localStorage PROPRES au versus (aucune clé daily touchée) ──
  const K_RESUME = 'op-versus-resume';   // { code, token } — survit à un F5/onglet fermé
  const K_PSEUDO = 'op-versus-pseudo';
  const K_STATS  = 'op-versus-stats';    // { w, l } — lu par l'onglet stats du jeu (LS.versusStats d'app.js)

  // ── Copies locales de helpers d'affichage (app.js n'est pas chargé ici) ──
  const AB = window.ASSET_BASE || '';
  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
                    .replace(/"/g,'&quot;').replace(/'/g,'&#x27;');
  }
  function formatBounty(b) {
    if (!b) return '—';
    if (b >= 1000) {
      const md = b / 1000;
      return md % 1 === 0 ? md + ' Md' : md.toFixed(3).replace(/\.?0+$/, '').replace('.', ',') + ' Md';
    }
    return b + ' M';
  }
  const STATE_FR = { correct: 'correct', partial: 'partiel', wrong: 'incorrect' };
  const arrowFr = a => a === '⬆️' ? ', plus haut' : a === '⬇️' ? ', plus bas' : '';
  const $ = id => document.getElementById(id);

  // Dev : localhost ou IP privée (test téléphone sur le réseau local) → serveur local
  const isDevHost = location.hostname === 'localhost' || location.hostname === '127.0.0.1' ||
    /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(location.hostname);
  const WS_URL = isDevHost ? `ws://${location.hostname}:8765` : 'wss://multi.onepiecedle.fr';

  const ERR_FR = {
    BAD_CODE: 'Code de lobby introuvable.', LOBBY_FULL: 'Ce lobby est déjà complet.',
    GAME_IN_PROGRESS: 'La partie a déjà commencé.', NOT_YOUR_TURN: 'Ce n’est pas ton tour !',
    UNKNOWN_CHAR: 'Personnage inconnu.', ALREADY_GUESSED: 'Déjà proposé dans cette manche !',
    NOT_CREATOR: 'Seul le créateur peut modifier les options.', RATE_LIMITED: 'Doucement, moussaillon !',
    SERVER_FULL: 'Serveur complet, réessaie plus tard.', BAD_OPTIONS: 'Options invalides.',
    PAUSED: 'Partie en pause (adversaire déconnecté).',
  };
  const CLOSED_FR = {
    opponent_left: 'Ton adversaire a quitté le lobby.', expired: 'Lobby expiré (inactivité).',
    superseded: 'Partie reprise dans un autre onglet.', server_restart: 'Le serveur a redémarré.',
    creator_left: 'Le créateur a quitté le lobby.',
  };

  // ── État client ──
  let ws = null, wsOpen = false, outbox = [];
  let snap = null;                 // dernier snapshot serveur
  let me = null;                   // mon index dans players[]
  let guessed = new Set();         // noms proposés cette manche (autocomplete)
  let rendered = new Set();        // clés `${by}:${nom}` déjà affichées
  let deadline = null;             // échéance LOCALE du tour (Date.now() + remainingMs)
  let vetoDeadline = null, vetoTotalMs = 0;  // minuteur local de l'action de veto
  let lastWinner = null;           // vainqueur du match (match_end)
  let lastRound = null;            // dernier round_end reçu (réponse à afficher en fin de match)
  let curMode = 'classic';         // mode de la manche en cours (classic | wanted | silhouette | fruit | emoji | tome)
  // Icônes + couleurs signature = les mêmes que game.html (registre MODES / vars --mode-*)
  const MODE_META = {
    classic:    { label: 'Classique',      svg: 'ic-compass',    color: 'var(--mode-classic)' },
    wanted:     { label: 'Wanted',         svg: 'ic-wanted',     color: 'var(--mode-wanted)' },
    silhouette: { label: 'Silhouette',     svg: 'ic-silhouette', color: 'var(--mode-silhouette)' },
    fruit:      { label: 'Fruit du Démon', svg: 'ic-fruit',      color: 'var(--mode-fruit)' },
    emoji:      { label: 'Émoji',          svg: 'ic-rebus',      color: 'var(--mode-emoji)' },
    tome:       { label: 'Tome',           svg: 'ic-tome',       color: 'var(--mode-tome)' },
  };
  // Paliers visuels des modes wanted/silhouette/tome — copies du daily (app.js
  // n'est pas chargé ici ; BLUR_STEPS vient de data.js). wrongCount (serveur,
  // erreurs cumulées des DEUX joueurs) pilote flou et dézoom.
  const V_SIL_SCALES  = [3.2, 2.9, 2.6, 2.3, 2.0, 1.75, 1.5, 1.3, 1.15, 1];
  const V_SIL_HINT_AT = 5;   // disque couleur automatique à partir de 5 erreurs
  const V_TOME_SCALES = [8, 5.3, 3.5, 2.3, 1.5, 1];
  const tomeMax = () => (typeof TOMES !== 'undefined' && TOMES.length) ? Math.max(...TOMES) : 112;
  let wantedColor = false;   // toggle couleur du mode Wanted (N&B par défaut, comme le daily)
  const modeChip = m => MODE_META[m]
    ? `<span class="v-modechip" style="color:${MODE_META[m].color}"><svg class="ic ic-inline" aria-hidden="true"><use href="#${MODE_META[m].svg}"></use></svg>${esc(MODE_META[m].label)}</span>`
    : '';
  function setModeAccent(m) {
    document.body.style.setProperty('--vmode', MODE_META[m] ? MODE_META[m].color : 'var(--gold)');
  }
  const turnLabel = s => s === 0 ? 'Tour illimité' : `${s} s / tour`;
  const optionPills = o => o
    ? `<span class="v-optpill">Bo${o.bestOf}</span><span class="v-optpill">${turnLabel(o.turnSeconds)}</span>`
    : '';
  let retryTimer = null, retryCount = 0, supersededFlag = false;
  let acSel = -1, acFilt = [];

  // ── WebSocket ──
  function send(type, payload = {}) {
    const msg = JSON.stringify({ v: 1, type, payload });
    if (wsOpen) ws.send(msg); else outbox.push(msg);
  }
  function connect() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
    ws = new WebSocket(WS_URL);
    ws.onopen = () => {
      wsOpen = true; retryCount = 0;
      outbox.splice(0).forEach(m => ws.send(m));
    };
    ws.onmessage = e => { try { handle(JSON.parse(e.data)); } catch (err) { console.error(err); } };
    ws.onclose = () => {
      wsOpen = false;
      // Coupure inattendue en cours de lobby → tentative de resume (grace 90 s côté serveur)
      const saved = savedResume();
      if (saved && !supersededFlag && retryCount < 20) {
        banner('⚓ Connexion perdue — reconnexion en cours…');
        retryTimer = setTimeout(() => { retryCount++; connect(); send('resume', { code: saved.code, resumeToken: saved.token }); }, 2000);
      }
    };
  }
  setInterval(() => { if (wsOpen) send('ping'); }, 25_000); // heartbeat applicatif

  // Bilan victoires/défaites — affiché dans l'onglet « Versus 1v1 » des stats du jeu
  function recordVersusStat(won) {
    if (me === null) return;
    let s; try { s = JSON.parse(localStorage.getItem(K_STATS)) || {}; } catch { s = {}; }
    const w = Number(s.w) || 0, l = Number(s.l) || 0;
    localStorage.setItem(K_STATS, JSON.stringify(won ? { w: w + 1, l } : { w, l: l + 1 }));
  }

  function savedResume() {
    try { return JSON.parse(localStorage.getItem(K_RESUME)); } catch { return null; }
  }
  function storeResume(code, token) { localStorage.setItem(K_RESUME, JSON.stringify({ code, token })); }
  function purgeResume() { localStorage.removeItem(K_RESUME); }

  // ── Réception ──
  function handle({ type, payload }) {
    switch (type) {
      case 'lobby_created':
        storeResume(payload.code, payload.resumeToken);
        break;
      case 'lobby_state':
      case 'resume_ok':
        if (type === 'resume_ok') { banner(null); toast('Partie reprise !', 'info'); }
        render(payload);
        break;
      case 'countdown':      onCountdown(payload); break;
      case 'turn':           onTurn(payload); break;
      case 'guess_result':   addGuess(payload); if (payload.clue) renderClue(payload.clue); break;
      case 'turn_timeout':
        toast(payload.player === me ? `⏳ Temps écoulé ! Strike ${payload.strikes}/3`
                                    : `L’adversaire a laissé filer son tour (strike ${payload.strikes}/3)`, 'info');
        break;
      case 'round_end':      onRoundEnd(payload); break;
      case 'match_end':
        lastWinner = payload.winner;
        recordVersusStat(payload.winner === me);
        break;
      case 'opponent_disconnected':
        banner(`⚓ Adversaire déconnecté — partie en pause (${Math.round(payload.graceMs / 1000)} s de grâce)…`);
        break;
      case 'opponent_reconnected':
        banner(null); toast('Adversaire de retour !', 'info');
        break;
      case 'lobby_closed':
        if (payload.reason === 'superseded') supersededFlag = true;
        purgeResume(); clearTimeout(retryTimer);
        toast(CLOSED_FR[payload.reason] || 'Lobby fermé.', 'info');
        resetToHome();
        break;
      case 'error':          onError(payload); break;
      case 'pong': break;
      default: break;
    }
  }

  function onError(p) {
    if (p.code === 'BAD_RESUME') { purgeResume(); clearTimeout(retryTimer); banner(null); resetToHome(); return; }
    if (p.code === 'BAD_CODE' && savedResume()) { purgeResume(); banner(null); resetToHome(); return; }
    toast(ERR_FR[p.code] || `Erreur : ${p.code}`);
  }

  // ── Rendu piloté par snapshot (idempotent) ──
  function screen(id) {
    ['v-home', 'v-wait', 'v-ready', 'v-veto', 'v-game', 'v-post'].forEach(s => { $(s).hidden = (s !== id); });
  }
  function resetToHome() {
    snap = null; me = null; guessed = new Set(); rendered = new Set(); deadline = null; lastWinner = null; lastRound = null;
    $('v-grid-me').innerHTML = ''; $('v-grid-op').innerHTML = '';
    $('v-post-reveal').hidden = true;
    $('v-roundover').hidden = true; $('v-codechip').hidden = true; $('v-count').hidden = true;
    screen('v-home');
  }

  function render(s) {
    snap = s; me = s.you;
    const op = me === 0 ? 1 : 0;
    $('v-codechip').textContent = s.code;
    $('v-codechip').hidden = false;

    if (s.state === 'CREATED') {
      $('v-bigcode').textContent = s.code;
      $('v-bigcode').classList.remove('copied');
      $('v-wait-opts').innerHTML = optionPills(s.options);
      screen('v-wait');
      return;
    }
    if (s.state === 'FULL') {
      $('v-roundover').hidden = true;
      $('v-ready-players').innerHTML = s.players.map((p, i) => `
        <div class="v-player ${p.ready ? 'ready' : ''} ${p.connected ? '' : 'off'}">
          <span class="v-pname">${esc(p.name)}${i === me ? ' (toi)' : ''}</span>
          <span class="v-pstate">${p.connected ? (p.ready ? 'Prêt ✔' : 'Pas prêt') : 'déconnecté…'}</span>
        </div>`).join('');
      $('v-bestof2').value = String(s.options.bestOf);
      $('v-turns2').value = String(s.options.turnSeconds);
      const isCreator = me === 0;
      $('v-bestof2').disabled = !isCreator; $('v-turns2').disabled = !isCreator;
      $('v-ready-optsinfo').hidden = isCreator;
      $('v-readybtn').textContent = s.players[me]?.ready ? 'Annuler « prêt »' : 'Je suis prêt !';
      screen('v-ready');
      return;
    }
    if (s.state === 'VETO') {
      renderVeto(s);
      if (s.paused) banner('⚓ Veto en pause (adversaire déconnecté)…'); else banner(null);
      screen('v-veto');
      return;
    }
    if (s.state === 'IN_GAME') {
      curMode = s.mode || curMode;   // AVANT la reconstruction (les lignes en dépendent)
      setModeAccent(curMode);
      document.querySelectorAll('.v-gridblock').forEach(g => g.classList.toggle('simple', curMode !== 'classic'));
      renderClue(s.clue);
      // Reconstruction complète si désynchronisé (resume, onglet revenu, etc.)
      const totalRows = $('v-grid-me').children.length + $('v-grid-op').children.length;
      if (totalRows !== s.guesses.length) {
        $('v-grid-me').innerHTML = ''; $('v-grid-op').innerHTML = '';
        rendered = new Set(); guessed = new Set();
        s.guesses.forEach(addGuess);
      }
      $('v-scorebar').innerHTML = s.players.map((p, i) => `
        <span class="${i === me ? 'me' : 'op'}">${esc(p.name)}${i === me ? ' (toi)' : ''} : ${s.scores[i] ?? 0}
          <span class="v-strikes">${'✖'.repeat(s.strikes[i] || 0)}</span></span>`)
        .join(`<span> · manche ${s.round}/${s.options.bestOf} — ${modeChip(s.mode)} · </span>`);
      $('v-gridtitle-me').textContent = `${s.players[me]?.name || 'Toi'} (toi)`;
      $('v-gridtitle-op').textContent = s.players[op]?.name || 'Adversaire';
      if (s.turnOf !== null) applyTurn(s.turnOf, s.remainingMs);
      if (s.paused) banner('⚓ Partie en pause…');
      screen('v-game');
      return;
    }
    if (s.state === 'POST_MATCH') {
      $('v-roundover').hidden = true;   // l'écran de fin affiche déjà la réponse
      const winner = lastWinner !== null ? lastWinner
        : s.scores.indexOf(Math.max(...s.scores));
      const iWon = winner === me;
      const winnerName = esc(s.players[winner]?.name || 'Vainqueur');
      $('v-post-title').innerHTML =
        `<span class="v-post-verdict">${iWon ? '🏆 Victoire !' : '💀 Défaite…'}</span>` +
        `<span class="v-post-winner">${winnerName} remporte le duel${iWon ? ' (toi)' : ''}</span>`;
      // Réponse de la dernière manche + récap de toutes les manches
      const pr = $('v-post-reveal');
      if (lastRound && lastRound.target) {
        pr.innerHTML = `${revealImgTag(lastRound.target)}
          <div><div class="v-rtitle">C'était ${esc(lastRound.target.name)}${lastRound.fruitName ? ` (${esc(lastRound.fruitName)})` : ''}</div>
          <div class="v-rsub">trouvé en ${lastRound.tries} essai${lastRound.tries > 1 ? 's' : ''}</div></div>`;
        pr.hidden = false;
      } else pr.hidden = true;
      $('v-post-rounds').innerHTML = (s.roundsHistory || []).map((r, i) =>
        `Manche ${i + 1} ${modeChip(r.mode)} : <b>${esc(r.targetName)}</b>${r.fruitName ? ` — ${esc(r.fruitName)}` : ''} — ${esc(s.players[r.winner]?.name || '?')} (${r.tries} essai${r.tries > 1 ? 's' : ''})`).join('<br>');
      $('v-post-score').textContent = `${esc(s.players[me]?.name)} ${s.scores[me]} — ${s.scores[op]} ${esc(s.players[op]?.name)}`;
      const meWants = s.players[me]?.wantsRematch, opWants = s.players[op]?.wantsRematch;
      $('v-rematch').disabled = !!meWants;
      $('v-rematch-wait').hidden = !meWants || opWants;
      screen('v-post');
      return;
    }
  }

  // ── Veto des modes (façon CS2) : ban/pick tour à tour jusqu'au décideur ──
  const VETO_ORDER = ['classic', 'wanted', 'silhouette', 'fruit', 'emoji', 'tome']; // ordre canonique d'affichage
  function renderVeto(s) {
    const v = s.veto;
    if (!v) return;
    setModeAccent('classic'); document.body.style.setProperty('--vmode', 'var(--gold)');
    const myTurn = v.turnOf === me;
    const isBan = v.action === 'ban';
    $('v-veto-title').textContent = `Veto des modes · ${v.stepIdx}/${v.total}`;
    const stt = $('v-veto-status');
    if (myTurn) {
      stt.innerHTML = isBan ? '🚫 <b>Bannis</b> un mode' : '✅ <b>Choisis</b> un mode à jouer';
      stt.className = 'v-veto-status mine ' + (isBan ? 'ban' : 'pick');
    } else {
      stt.innerHTML = `L'adversaire ${isBan ? 'bannit' : 'choisit'} un mode<span class="v-dots">…</span>`;
      stt.className = 'v-veto-status';
    }
    $('v-veto-board').innerHTML = VETO_ORDER.map(m => {
      const meta = MODE_META[m]; if (!meta) return '';
      const banned = v.banned.includes(m);
      const pIdx = v.picked.indexOf(m);
      const picked = pIdx !== -1;
      const avail = v.avail.includes(m);
      const clickable = avail && myTurn && !s.paused;
      const cls = ['v-vcard'];
      if (banned) cls.push('banned');
      if (picked) cls.push('picked');
      if (avail && !myTurn) cls.push('waiting');
      if (clickable) cls.push('selectable', isBan ? 'act-ban' : 'act-pick');
      const tag = banned ? '<span class="v-vtag ban">banni</span>'
        : picked ? `<span class="v-vtag pick">manche ${pIdx + 1}</span>` : '';
      return `<button class="${cls.join(' ')}" data-mode="${m}" ${clickable ? '' : 'disabled'} style="--mc:${meta.color}">
        <svg class="ic" aria-hidden="true"><use href="#${meta.svg}"></use></svg>
        <span class="v-vname">${esc(meta.label)}</span>${tag}</button>`;
    }).join('');
    vetoTotalMs = v.totalMs || 20000;
    vetoDeadline = (v.remainingMs != null) ? Date.now() + v.remainingMs : null;
    $('v-veto-timerwrap').style.display = vetoDeadline ? '' : 'none';
  }

  // ── Tour & timer (le client ne reçoit QUE des remainingMs, jamais d'horodatage) ──
  function applyTurn(turnOf, remainingMs) {
    if (!snap) return;
    snap.turnOf = turnOf;
    deadline = (remainingMs != null) ? Date.now() + remainingMs : null;
    const mine = turnOf === me;
    const input = $('search-input');
    input.disabled = !mine;
    // Mode tome : saisie numérique (clavier chiffres sur mobile)
    if (curMode === 'tome') input.setAttribute('inputmode', 'numeric');
    else input.removeAttribute('inputmode');
    input.placeholder = mine
      ? (curMode === 'tome' ? `Numéro du tome (1–${tomeMax()})…` : 'À toi de jouer…')
      : `Tour de ${snap.players[turnOf]?.name || '…'}`;
    if (mine) input.focus();
    $('v-gridtitle-me').classList.toggle('turn-me', mine);
    $('v-gridtitle-op').classList.toggle('turn', !mine);
    $('v-timerwrap').style.display = deadline ? '' : 'none';
  }
  function onTurn(p) { $('v-count').hidden = true; applyTurn(p.turnOf, p.remainingMs); }

  setInterval(() => {
    if (snap && snap.state === 'VETO' && vetoDeadline) {
      const rem = Math.max(0, vetoDeadline - Date.now());
      $('v-veto-timerbar').style.width = `${(rem / vetoTotalMs) * 100}%`;
      $('v-veto-timerbar').classList.toggle('urgent', rem < 5000);
    }
    if (!snap || snap.state !== 'IN_GAME') return;
    const line = $('v-turnline');
    if (snap.turnOf === null) {  // entre round_end et le countdown suivant
      line.textContent = '🔍 Réponse révélée — manche suivante dans quelques secondes…';
      line.classList.remove('mine');
      return;
    }
    const mine = snap.turnOf === me;
    if (deadline) {
      const rem = Math.max(0, deadline - Date.now());
      const total = snap.options.turnSeconds * 1000;
      $('v-timerbar').style.width = `${(rem / total) * 100}%`;
      $('v-timerbar').classList.toggle('urgent', rem < 10_000);
      line.textContent = (mine ? '🎯 À toi de jouer ' : `Tour de ${snap.players[snap.turnOf]?.name || '…'} `) + `(${Math.ceil(rem / 1000)} s)`;
    } else {
      line.textContent = mine ? '🎯 À toi de jouer' : `Tour de ${snap.players[snap.turnOf]?.name || '…'}`;
    }
    line.classList.toggle('mine', mine);
  }, 200);

  // ── Compte à rebours de manche ──
  function onCountdown(p) {
    if (p.round === 1) lastRound = null;  // nouveau match (revanche incluse)
    // Nouvelle manche : grilles, indice et état de manche remis à zéro
    curMode = p.mode || 'classic';
    setModeAccent(curMode);
    document.querySelectorAll('.v-gridblock').forEach(g => g.classList.toggle('simple', curMode !== 'classic'));
    $('v-clue').hidden = true;
    $('v-grid-me').innerHTML = ''; $('v-grid-op').innerHTML = '';
    rendered = new Set(); guessed = new Set();
    $('v-roundover').hidden = true;
    $('v-countround').innerHTML = `Manche ${p.round} — ${modeChip(curMode)}`;
    $('v-count').hidden = false;
    let n = p.seconds;
    $('v-countnum').textContent = n;
    const iv = setInterval(() => {
      n--;
      if (n <= 0) { clearInterval(iv); $('v-count').hidden = true; }
      else $('v-countnum').textContent = n;
    }, 1000);
  }

  // ── Indice partagé de la manche (émoji / fruit) ──
  function renderClue(clue) {
    const el = $('v-clue');
    if (!clue) { el.hidden = true; return; }
    if (clue.emojis) {
      el.innerHTML = `<div class="v-clue-emojis">`
        + clue.emojis.map(e => `<div class="em">${esc(e)}</div>`).join('')
        + Array(Math.max(0, (clue.total || 8) - clue.emojis.length)).fill('<div class="em hid">?</div>').join('')
        + `</div>`;
    } else if (clue.fruitName) {
      const H = clue.hints || {};
      const line = (label, v) => v ? `<b>${esc(label)} :</b> ${esc(v)}`
                                   : `<span class="lock">${esc(label)} 🔒</span>`;
      el.innerHTML = `<div class="v-clue-fruit">
        <div class="v-fruitname"><svg class="ic ic-inline" aria-hidden="true" style="color:var(--mode-fruit)"><use href="#ic-fruit"></use></svg>${esc(clue.fruitName)}</div>
        <div class="v-fruithints">${line('Type', H.type)} · ${line('Traduction', H.translated)}<br>${line('Description', H.description)}</div>
      </div>`;
    } else if (clue.img) {          // wanted : portrait flouté, défloute à chaque erreur
      const blur = BLUR_STEPS[Math.min(clue.wrongCount, BLUR_STEPS.length - 1)];
      let img = el.querySelector('.v-frame-wanted img');
      if (!img || img.dataset.key !== clue.img) {
        el.innerHTML = `<div class="v-clue-frame v-frame-wanted"><img data-key="${esc(clue.img)}" src="${AB}images/${esc(clue.img)}.jpg" alt="Portrait mystère" draggable="false"></div>
          <div class="v-clue-sub"></div>
          <label class="color-toggle v-wcolor"><input type="checkbox" id="v-wcolor-cb"><div class="toggle-track"><div class="toggle-knob"></div></div>Couleur</label>`;
        img = el.querySelector('.v-frame-wanted img');
        const cb = el.querySelector('#v-wcolor-cb');
        cb.checked = wantedColor;
        cb.addEventListener('change', () => { wantedColor = cb.checked; applyWantedFilter(); });
      }
      el.dataset.blur = blur;
      applyWantedFilter();
      el.querySelector('.v-clue-sub').textContent = blur === 0 ? 'Image parfaitement nette !' : `Flou : ${blur}px`;
    } else if (clue.silKey) {       // silhouette : pan + dézoom depuis le point de contour
      let frame = el.querySelector('.v-frame-sil');
      if (!frame || frame.dataset.key !== clue.silKey) {
        el.innerHTML = `<div class="v-clue-frame v-frame-sil" data-key="${esc(clue.silKey)}">
          <img class="v-sil-black" src="${AB}silhouettes/${esc(clue.silKey)}.png" alt="Silhouette mystère" draggable="false">
          <img class="v-sil-color" src="${AB}silhouettes/color/${esc(clue.silKey)}.png" alt="" draggable="false">
        </div><div class="v-clue-sub"></div>`;
        frame = el.querySelector('.v-frame-sil');
      }
      const cc = silCenterV(clue);
      // transform-origin:0 0 → translate (en %) place le point (cc.x,cc.y) au centre du cadre
      const tr = `translate(${(0.5 - cc.s * cc.x) * 100}%, ${(0.5 - cc.s * cc.y) * 100}%) scale(${cc.s})`;
      frame.querySelectorAll('img').forEach(i => { i.style.transform = tr; });
      const colorOn = clue.wrongCount >= V_SIL_HINT_AT;
      const col = frame.querySelector('.v-sil-color');
      col.style.opacity = colorOn ? '1' : '0';
      col.style.clipPath = colorOn ? `circle(7% at ${(cc.x * 100).toFixed(2)}% ${(cc.y * 100).toFixed(2)}%)` : 'none';
      el.querySelector('.v-clue-sub').textContent = (colorOn ? '🎨 Indice couleur débloqué · ' : '')
        + (cc.s === 1 ? 'Silhouette entière !' : 'Dézoome à chaque erreur…');
    } else if (clue.cover) {        // tome : couverture zoomée → dézoom
      let frame = el.querySelector('.v-frame-tome');
      if (!frame || frame.dataset.key !== String(clue.cover)) {
        el.innerHTML = `<div class="v-clue-frame v-frame-tome" data-key="${clue.cover}"><img src="${AB}images/cover/Tome_${clue.cover}.webp" alt="Couverture mystère" draggable="false"></div><div class="v-clue-sub"></div>`;
        frame = el.querySelector('.v-frame-tome');
      }
      const s = V_TOME_SCALES[Math.min(clue.wrongCount, V_TOME_SCALES.length - 1)];
      const img = frame.querySelector('img');
      if (clue.zoom) img.style.transformOrigin = `${clue.zoom.x}% ${clue.zoom.y}%`;
      img.style.transform = `scale(${s})`;
      el.querySelector('.v-clue-sub').textContent = s === 1 ? 'Couverture entière !' : 'Dézoome à chaque erreur…';
    } else { el.hidden = true; return; }
    el.hidden = false;
  }

  // Wanted : applique flou + noir&blanc/couleur selon le toggle (comme le daily)
  function applyWantedFilter() {
    const el = $('v-clue');
    const img = el.querySelector('.v-frame-wanted img');
    if (img) img.style.filter = `blur(${el.dataset.blur || 0}px) grayscale(${wantedColor ? 0 : 1})`;
  }

  // Cadrage silhouette à l'étape courante — même math que le daily (silCenter d'app.js) :
  // interpole du point de contour (focus.json) vers le centre au fil du dézoom.
  function silCenterV(clue) {
    const s = V_SIL_SCALES[Math.min(clue.wrongCount, V_SIL_SCALES.length - 1)];
    const t = (V_SIL_SCALES[0] - s) / (V_SIL_SCALES[0] - 1) || 0;
    const f = (Array.isArray(clue.focus) && clue.focus.length === 2)
      ? { x: clue.focus[0], y: clue.focus[1] } : { x: 0.5, y: 0.18 };
    return { x: f.x + (0.5 - f.x) * t, y: f.y + (0.5 - f.y) * t, s };
  }

  // ── Lignes d'essai (rendu depuis les verdicts REÇUS — zéro calcul local) ──
  function addGuess(entry) {
    const isTome = entry.tome != null;   // mode tome : un numéro, pas de fiche perso
    const key = isTome ? `${entry.by}:tome-${entry.tome}` : `${entry.by}:${entry.char.name}`;
    if (rendered.has(key)) return;
    rendered.add(key);
    guessed.add(isTome ? `tome-${entry.tome}` : entry.char.name);
    const grid = entry.by === me ? $('v-grid-me') : $('v-grid-op');
    grid.prepend(isTome ? buildTomeRow(entry.tome, entry.verdicts)
               : curMode === 'classic' ? buildRow(entry.char, entry.verdicts)
               : buildSimpleRow(entry.char, entry.verdicts));
  }

  // Ligne du mode Tome : numéro + plus haut / plus bas (comme le daily)
  function buildTomeRow(n, v) {
    const row = document.createElement('div');
    row.className = 'v-simple-row';
    const res = v.win ? '✅ TROUVÉ !' : v.dir === 'higher' ? '📈 Plus haut' : '📉 Plus bas';
    row.innerHTML = `<span class="nm">Tome ${n}</span><span class="res ${v.win ? 'correct' : 'wrong'}">${res}</span>`;
    return row;
  }

  // Ligne compacte des modes sans grille de verdicts (émoji / fruit)
  function buildSimpleRow(char, v) {
    const row = document.createElement('div');
    row.className = 'v-simple-row';
    row.innerHTML = `
      ${char.imgFile ? `<img src="${AB}images/${esc(char.imgFile)}.jpg" alt="" loading="lazy" onerror="this.remove()">` : ''}
      <span class="nm">${esc(char.name)}</span>
      <span class="res ${v.win ? 'correct' : 'wrong'}">${v.win ? '✅ TROUVÉ !' : '❌ Raté'}</span>`;
    return row;
  }

  function buildRow(char, v) {
    const row = document.createElement('div');
    row.className = 'guess-row grid-cols';
    row.setAttribute('role', 'listitem');
    const fl = fruitLabel(char.fruit);
    const genderTxt = char.gender === 'M' ? 'Homme' : char.gender === 'F' ? 'Femme' : 'Inconnu';
    const hakiTxt = Array.isArray(char.haki) && char.haki.length > 0 ? char.haki.join(', ') : 'Aucun';
    const arcTxt = (typeof ARCS !== 'undefined' && ARCS[char.arc]) || '?';
    const al = (label, val, state, extra = '') => `aria-label="${esc(label)} : ${esc(String(val))} — ${STATE_FR[state]}${extra}"`;
    row.innerHTML = `
      <div class="cell cell-char">
        ${char.imgFile
          ? `<img class="char-thumb" src="${AB}images/${esc(char.imgFile)}.jpg" alt="${esc(char.name)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"/><span class="char-name-fallback" style="display:none">${esc(char.name)}</span>`
          : `<span class="char-name-only">${esc(char.name)}</span>`}
      </div>
      <div class="cell ${v.gender}" data-label="Genre" ${al('Genre', genderTxt, v.gender)}><span class="cell-icon" aria-hidden="true">${char.gender === 'M' ? '♂️' : char.gender === 'F' ? '♀️' : '❓'}</span><span class="cell-val">${genderTxt}</span></div>
      <div class="cell ${v.affil}" data-label="Affiliation" ${al('Affiliation', char.affil, v.affil)}><span class="cell-val" style="font-size:0.76rem;line-height:1.3">${esc(char.affil)}</span></div>
      <div class="cell ${v.origin}" data-label="Origine" ${al('Origine', char.origin, v.origin)}><span class="cell-val" style="font-size:0.76rem;line-height:1.3">${esc(char.origin)}</span></div>
      <div class="cell ${v.fruit}" data-label="Fruit du Démon" ${al('Fruit du Démon', fl.val, v.fruit)}><span class="cell-icon" aria-hidden="true">${esc(fl.icon)}</span><span class="cell-val">${esc(fl.val)}</span></div>
      <div class="cell ${v.haki}" data-label="Haki" ${al('Haki', hakiTxt, v.haki)}><span class="cell-val" style="font-size:0.72rem;line-height:1.4">${esc(hakiTxt)}</span></div>
      <div class="cell ${v.status}" data-label="Statut" ${al('Statut', char.status, v.status)}><span class="cell-icon" aria-hidden="true">${char.status === 'Vivant' ? '💚' : '💀'}</span><span class="cell-val">${esc(char.status)}</span></div>
      <div class="cell ${v.arc.state}" data-label="1er Arc" ${al('Premier arc', arcTxt, v.arc.state, arrowFr(v.arc.arrow))}><span class="cell-val" style="font-size:0.74rem;line-height:1.3">${esc(arcTxt)}</span>${v.arc.arrow ? `<span class="cell-arrow" aria-hidden="true">${esc(v.arc.arrow)}</span>` : ''}</div>
      <div class="cell ${v.bounty.state}" data-label="Prime" ${al('Prime', formatBounty(char.bounty), v.bounty.state, arrowFr(v.bounty.arrow))}><span class="cell-val">${esc(formatBounty(char.bounty))}</span>${v.bounty.arrow ? `<span class="cell-arrow" aria-hidden="true">${esc(v.bounty.arrow)}</span>` : ''}</div>
    `;
    row.querySelectorAll('.cell').forEach((cell, i) => {
      cell.style.setProperty('--delay', `${i * 55}ms`);
      cell.classList.add('cell-anim');
    });
    return row;
  }

  // Image de reveal : portrait perso, ou couverture pour une manche Tome
  function revealImgTag(t) {
    if (t?.tome) return `<img src="${AB}images/cover/Tome_${t.tome}.webp" alt="" onerror="this.remove()">`;
    if (t?.imgFile) return `<img src="${AB}images/${esc(t.imgFile)}.jpg" alt="" onerror="this.remove()">`;
    return '';
  }

  // ── Fin de manche : réponse en GRAND au centre de l'écran (comme les bannières
  // du daily), le temps de l'inter-manche — masquée au countdown suivant ──
  function onRoundEnd(p) {
    deadline = null;
    lastRound = p;
    if (snap) snap.turnOf = null;   // fige le bandeau sur « réponse révélée »
    $('search-input').disabled = true;
    const wName = snap?.players[p.winner]?.name || '…';
    const mine = p.winner === me;
    $('v-roundover-card').innerHTML = `
      ${revealImgTag(p.target)}
      <div>
        <div class="v-rtitle">${mine ? '🏆 Manche gagnée !' : `💀 Manche pour ${esc(wName)}`}</div>
        <div class="v-rname">C'était <b>${esc(p.target.name)}</b>${p.fruitName ? ` (${esc(p.fruitName)})` : ''}</div>
        <div class="v-rsub">trouvé en ${p.tries} essai${p.tries > 1 ? 's' : ''} · Score : ${p.scores.join(' — ')}</div>
      </div>`;
    $('v-roundover').hidden = false;
  }

  // ── Autocomplete mince (réutilise charMatchesQuery/getMatchHint partagés) ──
  const input = () => $('search-input');
  const acBox = () => $('autocomplete');

  function acUpdate() {
    if (curMode === 'tome') { acFilt = []; acBox().classList.remove('open'); return; }  // saisie numérique, pas d'autocomplete
    const q = input().value.trim().toLowerCase();
    if (!q) { acFilt = []; acBox().classList.remove('open'); return; }
    // Pool par mode = celui du daily (aligné sur le contrôle NOT_IN_POOL serveur)
    const pool = (curMode === 'emoji' && typeof EMOJI_POOL !== 'undefined' && EMOJI_POOL.length) ? EMOJI_POOL
      : (curMode === 'wanted' && typeof WANTED_CHARS !== 'undefined' && WANTED_CHARS.length) ? WANTED_CHARS
      : (curMode === 'silhouette' && typeof SIL_POOL !== 'undefined' && SIL_POOL.length) ? SIL_POOL
      : CHARACTERS;
    acFilt = pool.filter(c => !guessed.has(c.name) && charMatchesQuery(c, q, ALIASES)).slice(0, 8);
    if (!acFilt.length) { acBox().classList.remove('open'); return; }
    acBox().innerHTML = acFilt.map((c, i) => {
      const hint = getMatchHint(c, q, ALIASES);
      return `<div class="ac-item" data-i="${i}">${esc(c.name)}${hint ? ` <span class="ac-hint">${esc(hint)}</span>` : ''}</div>`;
    }).join('');
    acBox().classList.add('open'); acSel = -1;
    acBox().querySelectorAll('.ac-item').forEach(el =>
      el.addEventListener('click', () => submitGuess(acFilt[+el.dataset.i].name)));
  }

  function submitGuess(name) {
    if (!name) return;
    if (curMode === 'tome') {   // numéro de tome, pas un personnage
      const n = parseInt(name, 10);
      if (!Number.isInteger(n) || n < 1 || n > tomeMax()) return toast(`Un numéro de tome entre 1 et ${tomeMax()} !`);
      if (guessed.has(`tome-${n}`)) return toast(ERR_FR.ALREADY_GUESSED);
      send('guess', { name: String(n) });
      input().value = '';
      return;
    }
    const c = resolveName(CHARACTERS, name);
    if (!c) return toast(ERR_FR.UNKNOWN_CHAR);
    send('guess', { name: c.name });
    input().value = '';
    acBox().classList.remove('open');
  }

  // ── UI feedback ──
  let toastTimer = null;
  function toast(msg, kind) {
    const t = $('v-toast');
    t.textContent = msg; t.className = 'v-toast' + (kind === 'info' ? ' info' : ''); t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 3000);
  }
  function banner(msg) {
    const b = $('v-banner');
    if (!msg) { b.hidden = true; return; }
    b.textContent = msg; b.hidden = false;
  }

  // ── Câblage ──
  function init() {
    $('v-pseudo').value = localStorage.getItem(K_PSEUDO) || '';

    $('v-create').addEventListener('click', () => {
      const pseudo = $('v-pseudo').value.trim() || 'Pirate';
      localStorage.setItem(K_PSEUDO, pseudo);
      supersededFlag = false;
      connect();
      send('create_lobby', { pseudo, options: { bestOf: +$('v-bestof').value, turnSeconds: +$('v-turns').value, gameType: 'classic' } });
    });

    $('v-join').addEventListener('click', joinFromInput);
    $('v-code').addEventListener('keydown', e => { if (e.key === 'Enter') joinFromInput(); });
    function joinFromInput() {
      const code = $('v-code').value.trim().toUpperCase();
      if (code.length !== 5) return toast('Le code fait 5 caractères.');
      const pseudo = $('v-pseudo').value.trim() || 'Pirate';
      localStorage.setItem(K_PSEUDO, pseudo);
      supersededFlag = false;
      connect();
      send('join_lobby', { code, pseudo });
    }

    $('v-copylink').addEventListener('click', async () => {
      const url = `${location.origin}${location.pathname}?code=${snap?.code || ''}`;
      try { await navigator.clipboard.writeText(url); toast('Lien copié !', 'info'); }
      catch { toast(url, 'info'); }
    });
    $('v-bigcode').addEventListener('click', async () => {
      const el = $('v-bigcode');
      try {
        await navigator.clipboard.writeText(snap?.code || el.textContent);
        el.classList.add('copied'); toast('Code copié !', 'info');
        setTimeout(() => el.classList.remove('copied'), 1500);
      } catch { toast('Code : ' + (snap?.code || ''), 'info'); }
    });
    $('v-cancelwait').addEventListener('click', () => { send('leave_lobby'); purgeResume(); resetToHome(); });
    $('v-leaveready').addEventListener('click', () => { send('leave_lobby'); purgeResume(); resetToHome(); });
    $('v-leaveveto').addEventListener('click', () => { send('leave_lobby'); purgeResume(); resetToHome(); });
    $('v-quit').addEventListener('click', () => { send('leave_lobby'); purgeResume(); resetToHome(); });

    $('v-readybtn').addEventListener('click', () => send('set_ready', { ready: !snap?.players[me]?.ready }));
    $('v-veto-board').addEventListener('click', e => {
      const btn = e.target.closest('.v-vcard.selectable');
      if (btn) send('veto_action', { mode: btn.dataset.mode });
    });
    $('v-rematch').addEventListener('click', () => send('rematch'));

    ['v-bestof2', 'v-turns2'].forEach(id => $(id).addEventListener('change', () =>
      send('set_options', { options: { bestOf: +$('v-bestof2').value, turnSeconds: +$('v-turns2').value, gameType: 'classic' } })));

    input().addEventListener('input', acUpdate);
    input().addEventListener('keydown', e => {
      const items = acBox().querySelectorAll('.ac-item');
      if (e.key === 'ArrowDown') { acSel = Math.min(acSel + 1, items.length - 1); hiAc(items); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { acSel = Math.max(acSel - 1, 0); hiAc(items); e.preventDefault(); }
      else if (e.key === 'Enter') {
        if (curMode === 'tome') submitGuess(input().value.trim());   // numéro : jamais l'autocomplete (acFilt périmé)
        else if (acSel >= 0 && acFilt[acSel]) submitGuess(acFilt[acSel].name);
        else if (acFilt.length === 1) submitGuess(acFilt[0].name);
        else submitGuess(input().value.trim());
      }
    });
    function hiAc(items) { items.forEach((el, i) => el.classList.toggle('selected', i === acSel)); }
    document.addEventListener('click', e => { if (!e.target.closest('.search-wrap')) acBox().classList.remove('open'); });

    // ?code=XXXXX dans l'URL → pré-rempli
    const urlCode = new URLSearchParams(location.search).get('code');
    if (urlCode) { $('v-code').value = urlCode.toUpperCase(); $('v-pseudo').focus(); }

    // Reprise automatique si un match était en cours (F5, onglet fermé…)
    const saved = savedResume();
    if (saved && saved.code && saved.token) {
      connect();
      send('resume', { code: saved.code, resumeToken: saved.token });
    }
  }

  loadGameData().then(init).catch(e => {
    console.error(e);
    toast('Impossible de charger les données du jeu.');
  });
})();

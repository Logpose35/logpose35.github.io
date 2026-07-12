// Base des assets lourds (portraits, covers, silhouettes, audio) servis par le VPS.
// Définie inline dans le <head> de game.html/index.html ; '' = retour aux chemins relatifs (Pages).
const ASSET_BASE = window.ASSET_BASE || '';

// ===== FIREBASE COMPTEUR QUOTIDIEN =====
const FB_URL = 'https://logpose-eec08-default-rtdb.europe-west1.firebasedatabase.app';

async function fbGet(path) {
  try {
    const res = await fetch(`${FB_URL}/${path}.json`);
    return await res.json();
  } catch { return null; }
}

async function fbIncrement(path) {
  try {
    const url  = `${FB_URL}/${path}.json`;
    const raw  = await (await fetch(url)).json();
    const current = (Number.isFinite(Number(raw)) && Number(raw) >= 0)
      ? Math.floor(Number(raw)) : 0;
    const next = current + 1;
    await fetch(url, { method: 'PUT', body: JSON.stringify(next) });
    return next;
  } catch { return null; }
}

async function fbIncrementBy(path, delta) {
  if (!delta || delta <= 0) return null;
  try {
    const url  = `${FB_URL}/${path}.json`;
    const raw  = await (await fetch(url)).json();
    const current = (Number.isFinite(Number(raw)) && Number(raw) >= 0)
      ? Math.floor(Number(raw)) : 0;
    const next = current + Math.floor(delta);
    await fetch(url, { method: 'PUT', body: JSON.stringify(next) });
    return next;
  } catch { return null; }
}

// Verbe/action propre à chaque mode pour le compteur du jour ("X pirates ont ___ aujourd'hui").
// fruit : null → "croqué le <nom du fruit>" (dynamique). Sert aussi à filtrer les modes éligibles (pas l'Infini).
const COUNTER_VERBS = {
  classic: "mené l'enquête",
  wanted:  "scruté l'avis de recherche",
  silhouette: 'reconnu la silhouette',
  fruit:   null,
  emoji:   'déchiffré les émojis',
  audio:   "identifié l'opening",
  tome:    'feuilleté le tome',
};

const WIN_TITLES = {
  classic: '🏴‍☠️ Nakama trouvé !',
  wanted:  '🎯 Avis de recherche résolu !',
  silhouette: '<svg class="ic win-ic" aria-hidden="true"><use href="#ic-silhouette"></use></svg>Silhouette reconnue !',
  fruit:   '🍎 Fruit du Démon identifié !',
  emoji:   '😄 Nakama identifié !',
  audio:   '🎵 Opening trouvé !',
  tome:    '📕 Tome identifié !',
  inf:     '🏴‍☠️ Nakama trouvé !',
};

// ===== REGISTRE DES MODES (source unique, ordre canonique) =====
// id : identifiant interne · icon : emoji (share/landing) · label : nom affiché
const MODES = [
  { id: 'classic', icon: '🗺️',  svg: 'ic-compass', label: 'Classique' },
  { id: 'wanted',  icon: '🖼️', svg: 'ic-wanted',  label: 'Wanted' },
  { id: 'silhouette', icon: '🕵️', svg: 'ic-silhouette', label: 'Silhouette' },
  { id: 'fruit',   icon: '🍎',  svg: 'ic-fruit',   label: 'Fruit du Démon' },
  { id: 'emoji',   icon: '😀',  svg: 'ic-rebus',   label: 'Émoji' },
  { id: 'audio',   icon: '🎵',  svg: 'ic-note',    label: 'Opening' },
  { id: 'tome',    icon: '📕',  svg: 'ic-tome',    label: 'Tome' },
];
const MODE_IDS = MODES.map(m => m.id);

// ===== CLÉS localStorage (source unique) =====
// Statiques = constantes · paramétrées = fonctions produisant la clé exacte.
const LS = {
  // Préférences
  size:      'op-size',
  cb:        'op-cb',
  sfx:       'op-sfx',
  ocean3d:   'op-ocean3d',     // fond 3D du jeu — opt-in ('1' = 3D, sinon classique)
  theme:     'op-theme',
  spoilerOk: 'op-spoiler-ok',
  v5seen:    'op-v5-seen',     // pop-up "Nouveautés v5" déjà vue (historique)
  wnSilSeen: 'op-wn-sil-seen', // pop-up "Gazette · mode Silhouette (v5.2)" déjà vue (historique)
  wnVersusSeen: 'op-wn-versus-seen', // pop-up "Gazette · mode Versus 1v1 (v6.0)" déjà vue
  // Mode Infini
  infStreak: 'op-inf-streak',
  infRecord: 'op-inf-record',
  // Mode Versus 1v1 — { w, l }, ÉCRIT par js/versus.js (même chaîne là-bas), lu ici (onglet stats)
  versusStats: 'op-versus-stats',
  // Paramétrées (mode et/ou jour)
  stats:   m       => `op-stats-${m}`,
  gs:      (m, dk) => `op-gs-${m}-${dk}`,
  daily:   dk      => `op-daily-${dk}`,
  score:   dk      => `op-score-${dk}`,
  result:  dk      => `op-result-${dk}`,
  perfect: dk      => `op-perfect-${dk}`,
  // Réservé v5 (non utilisé pour l'instant) : rang pirate, carte
  cumulativeScore: 'op-cumulative-score',
  pirateRank:      'op-pirate-rank',
  mapUnlocked:     'op-map-unlocked',
  captured:        'op-captured',          // B — carnet de capture (noms de persos trouvés)
  islandsReached:  'op-islands-reached',   // E — arcs déjà comptés au compteur communauté
};

// ===== RANG PIRATE =====
const RANK_THRESHOLDS = [
  { emoji: '⚓',  icon: 'ic-rk-anchor', title: 'Moussaillon', min: 0 },
  { emoji: '🌊',  icon: 'ic-rk-wave',   title: 'Matelot',     min: 50_000 },
  { emoji: '🏴‍☠️', icon: 'ic-rk-flag',   title: 'Pirate',      min: 150_000 },
  { emoji: '⚔️',  icon: 'ic-rk-sabers', title: 'Second',      min: 350_000 },
  { emoji: '🎩',  icon: 'ic-rk-hat',    title: 'Capitaine',   min: 700_000 },
  { emoji: '⚜️',  icon: 'ic-rk-shield', title: 'Corsaire',    min: 1_500_000 },
  { emoji: '🌟',  icon: 'ic-rk-star',   title: 'Amiral',      min: 3_000_000 },
  { emoji: '👑',  icon: 'ic-rk-crown',  title: 'Yonko',       min: 6_000_000 },
];

function getRankFromScore(score) {
  let rank = RANK_THRESHOLDS[0];
  for (const r of RANK_THRESHOLDS) {
    if (score >= r.min) rank = r;
  }
  const idx = RANK_THRESHOLDS.indexOf(rank);
  return { ...rank, next: RANK_THRESHOLDS[idx + 1] || null };
}

function updateRankBadge() {
  const el = document.getElementById('pirate-rank-badge');
  if (!el) return;
  const score = sanitizeNum(lsGet(LS.cumulativeScore));
  const { icon, title } = getRankFromScore(score);
  el.innerHTML = `<svg class="rank-ic" aria-hidden="true"><use href="#${icon}"></use></svg>${esc(title)}`;
  el.title = `Score cumulé : ${score.toLocaleString('fr-FR')} pts`;
}

function counterPredicate(mode) {
  return mode === 'fruit' ? `croqué le ${TARGET_FRU.name}` : COUNTER_VERBS[mode];
}
// "🏴‍☠️ X pirates ont <action propre au mode> aujourd'hui" (+ "· N essais moyens" si dispo)
function counterText(count, mode, avg) {
  const pred = counterPredicate(mode);
  let t = `🏴‍☠️ ${count.toLocaleString('fr-FR')} pirate${count > 1 ? 's ont' : ' a'} ${pred} aujourd'hui`;
  if (avg > 0) t += ` · ${avg} essai${avg > 1 ? 's' : ''} moyen${avg > 1 ? 's' : ''}`;
  return t;
}

async function loadDailyCounter(mode) {
  const el = document.getElementById('daily-counter');
  if (!el || !COUNTER_VERBS.hasOwnProperty(mode)) { if (el) el.textContent = ''; return; }
  el.textContent = '';
  el.classList.add('loading');
  const dateKey = todayKey();
  const count = await fbGet(`counters/${dateKey}/${mode}`);
  el.classList.remove('loading');
  if (currentMode !== mode) return;   // onglet changé pendant l'await → on n'écrase pas
  if (count && count > 0) {
    el.textContent = counterText(count, mode, 0);     // accroche immédiate
    appendDailyAvg(el, mode, count, dateKey);         // ajoute "· N essais moyens" si dispo
  }
}

async function incrementDailyCounter(mode) {
  const dateKey = todayKey();
  const count = await fbIncrement(`counters/${dateKey}/${mode}`);
  const el = document.getElementById('daily-counter');
  if (!el) return;
  if (count && count > 0) {
    el.textContent = counterText(count, mode, 0);
    appendDailyAvg(el, mode, count, dateKey);
  }
}

// Ajoute "· N essais moyens" à l'accroche, depuis daily-stats/{date}/{mode} (alimenté par onGameEnd).
// Ne fait rien s'il n'y a pas encore de gagnant ou si Firebase est indispo (fallback gracieux).
async function appendDailyAvg(el, mode, count, dateKey) {
  let s;
  try { s = await fbGet(`daily-stats/${dateKey}/${mode}`); } catch (e) { return; }
  if (currentMode !== mode) return;   // onglet changé pendant l'await
  if (!el || !s || !s.wins || !s.tries_sum) return;
  const avg = Math.round(s.tries_sum / s.wins);
  if (avg > 0) el.textContent = counterText(count, mode, avg);
}

// ===== UTILS =====
function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#x27;');
}

// JSON.parse sécurisé — jamais d'exception non gérée sur du localStorage corrompu
function safeParseJSON(str, fallback) {
  if (!str) return fallback;
  try {
    const v = JSON.parse(str);
    return (v !== null && v !== undefined) ? v : fallback;
  } catch { return fallback; }
}

// Sanitise une valeur numérique lue depuis le localStorage
function sanitizeNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

// Valide qu'un ID YouTube ne contient que des caractères autorisés ([\w-]{11})
function validateYTId(id) {
  return /^[\w-]{11}$/.test(String(id)) ? String(id) : '';
}

function lsGet(key)      { try { return localStorage.getItem(key); }    catch { return null; } }
function lsSet(key, val) { try { localStorage.setItem(key, val); }      catch {} }
function lsRemove(key)   { try { localStorage.removeItem(key); }        catch {} }

// ===== ÉTAT DU JEU =====
let currentMode = 'classic';
let cGuesses = [], cOver = false, cNames = new Set();
let wGuesses = [], wOver = false, wNames = new Set();
let silGuesses = [], silOver = false, silNames = new Set(), silHintUsed = false, silHintFocus = null;
let frGuesses = [], frOver = false, frNames = new Set(), frHintsRevealed = new Set();
let infGuesses = [], infOver = false, infNames = new Set(), infTarget = null;
let auGuesses = [], auOver = false, auNames = new Set();
let _restoring = false; // supprime effets secondaires pendant la restauration
const MAX_INF_GUESSES = 10;
let colorMode = false;
let hintUsed = false;
const MAX_CLASSIC_GUESSES = 10;

// ===== TAILLE INTERFACE + MENU PARAMÈTRES =====
function setSize(size) {
  document.body.classList.remove('size-small', 'size-large');
  if (size !== 'medium') document.body.classList.add('size-' + size);
  lsSet(LS.size, size);
  const map = { small: 'sz-p', medium: 'sz-m', large: 'sz-g' };
  Object.entries(map).forEach(([s, id]) => {
    const btn = document.getElementById(id);
    if (btn) btn.classList.toggle('active', s === size);
  });
}

function toggleSettings() {
  document.getElementById('settings-panel').classList.toggle('hidden');
}

document.addEventListener('click', e => {
  const panel = document.getElementById('settings-panel');
  if (!panel.classList.contains('hidden') && !e.target.closest('.settings-wrap')) {
    panel.classList.add('hidden');
  }
});

(function () {
  setSize(lsGet(LS.size) || 'medium');
})();

// ===== ACCESSIBILITÉ : MODE DALTONIEN =====
let cbMode = false;
function setCbMode(on) {
  cbMode = !!on;
  document.body.classList.toggle('cb-mode', cbMode);
  lsSet(LS.cb, cbMode ? '1' : '0');
  const t = document.getElementById('cb-toggle');
  if (t) t.checked = cbMode;
}

// ===== SONS (opt-in, synthétisés via Web Audio) =====
let sfxOn = false;
let _actx = null;
function setSfx(on) {
  sfxOn = !!on;
  lsSet(LS.sfx, sfxOn ? '1' : '0');
  const t = document.getElementById('sfx-toggle');
  if (t) t.checked = sfxOn;
  if (sfxOn) { try { _ensureAudio(); sfx('tick'); } catch {} }
}
// ===== FOND 3D (océan/île) — désactivable pour les performances =====
function setOcean3d(on) {
  lsSet(LS.ocean3d, on ? '1' : '0');
  const t = document.getElementById('ocean-toggle');
  if (t) t.checked = !!on;
  window.dispatchEvent(new Event('lp-ocean3d-changed'));
}

function _ensureAudio() {
  if (!_actx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) _actx = new AC();
  }
  if (_actx && _actx.state === 'suspended') _actx.resume();
  return _actx;
}
function _tone(freq, start, dur, type = 'sine', peak = 0.18) {
  const ctx = _actx; if (!ctx) return;
  const t0 = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type; osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t0); osc.stop(t0 + dur + 0.02);
}
// Note de cuivre (2 saws désaccordés + filtre + léger vibrato) → timbre fanfare/aventure
function _brass(freq, start, dur, peak = 0.16) {
  const ctx = _actx; if (!ctx) return;
  const t0 = ctx.currentTime + start;
  const g = ctx.createGain();
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(freq * 2.2, t0);
  lp.frequency.exponentialRampToValueAtTime(freq * 4.5, t0 + 0.05);
  lp.Q.value = 0.7;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.025);
  g.gain.setValueAtTime(peak, t0 + dur * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  // vibrato
  const lfo = ctx.createOscillator(); const lfoG = ctx.createGain();
  lfo.frequency.value = 5.5; lfoG.gain.value = freq * 0.012;
  lfo.connect(lfoG);
  [0, -3].forEach(det => {
    const o = ctx.createOscillator();
    o.type = 'sawtooth'; o.frequency.value = freq; o.detune.value = det;
    lfoG.connect(o.detune);
    o.connect(g);
    o.start(t0); o.stop(t0 + dur + 0.03);
  });
  lfo.start(t0); lfo.stop(t0 + dur + 0.03);
  g.connect(lp).connect(ctx.destination);
}
// Glissando de cuivre (trombone) avec "wah" → effet comique de dégonflage
function _slide(f1, f2, start, dur, peak = 0.16) {
  const ctx = _actx; if (!ctx) return;
  const t0 = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 1400; lp.Q.value = 4;
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(f1, t0);
  osc.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  lp.frequency.setValueAtTime(1600, t0);
  lp.frequency.exponentialRampToValueAtTime(500, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(lp).connect(ctx.destination);
  osc.start(t0); osc.stop(t0 + dur + 0.02);
}
function sfx(kind) {
  if (!sfxOn || !_ensureAudio()) return;
  switch (kind) {
    // petit "toc" de bois (coque de navire)
    case 'tick':    _tone(900, 0, 0.04, 'triangle', 0.08); break;
    // double "toc" boisé pour une tentative
    case 'guess':   _tone(640, 0, 0.05, 'triangle', 0.11); _tone(480, 0.05, 0.06, 'triangle', 0.09); break;
    // fanfare triomphale aux cuivres (do majeur ascendant + accord tenu + grelot)
    case 'win':
      _brass(392, 0.00, 0.14, 0.14);   // sol (levée)
      _brass(523, 0.13, 0.16, 0.16);   // do
      _brass(659, 0.29, 0.16, 0.16);   // mi
      _brass(784, 0.45, 0.50, 0.18);   // sol tenu
      _brass(523, 0.55, 0.40, 0.10);   // accord : do
      _brass(659, 0.55, 0.40, 0.10);   // accord : mi
      _tone(1568, 0.50, 0.45, 'sine', 0.07); // grelot brillant
      break;
    // trombone comique qui se dégonfle (wah-wah descendant + blat grave)
    case 'lose':
      _slide(330, 247, 0.00, 0.22, 0.15);
      _slide(247, 175, 0.22, 0.30, 0.15);
      _brass(131, 0.52, 0.30, 0.12);   // blat final grave
      break;
  }
}

(function () {
  setCbMode(lsGet(LS.cb) === '1');
  sfxOn = lsGet(LS.sfx) === '1';
  const st = document.getElementById('sfx-toggle');
  if (st) st.checked = sfxOn;
  const ot = document.getElementById('ocean-toggle');
  if (ot) ot.checked = lsGet(LS.ocean3d) === '1';   // jeu : classique par défaut, 3D en opt-in
})();

// ===== THÈME =====
function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const next = isDark ? 'light' : 'dark';
  applyTheme(next);
  lsSet(LS.theme, next);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  // Le bouton thème porte ses icônes SVG (soleil/lune) ; le swap est géré en CSS via [data-theme].
}

(function () {
  const saved = lsGet(LS.theme);
  if (saved) {
    applyTheme(saved);
  } else {
    // Aucune préférence sauvegardée → suivre le système
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
    // Écouter les changements de préférence système (seulement si pas de choix manuel)
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        if (!lsGet(LS.theme)) applyTheme(e.matches ? 'dark' : 'light');
      });
    }
  }
})();

// ===== MODAL SPOILER =====
function closeSpoilerModal() {
  if (document.getElementById('spoiler-no-show').checked) {
    lsSet(LS.spoilerOk, '1');
  }
  document.getElementById('spoiler-modal').classList.add('hidden');
}

(function () {
  if (!lsGet(LS.spoilerOk)) {
    document.getElementById('spoiler-modal').classList.remove('hidden');
  }
})();

// ===== DATE & HIER =====
document.getElementById('date-label').textContent =
  new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

function seedForDate(d, salt = 1) {
  // d doit être une date Paris (depuis parisNow())
  // Même hash que dailyPick pour cohérence du fallback "hier"
  const base = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  let h = Math.imul(base + salt, 2654435761) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  h = Math.imul(h, 0x45d9f3b) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h;
}
// Sauvegarde les cibles du jour (une seule fois par jour, pour le "hier" de demain)
function saveTodayTargets() {
  const key = LS.daily(todayKey());
  if (lsGet(key)) return;
  lsSet(key, JSON.stringify({
    classic: TARGET_C.name,
    wanted:  TARGET_W.name,
    silhouette: TARGET_SIL ? TARGET_SIL.name : null,
    fruit:   TARGET_FRU.holder,
    emoji:   TARGET_EM.name,
    audio:   TARGET_AU.name,
    tome:    TARGET_TOME,
  }));
}
// Affiche la barre "hier" — localStorage en priorité, seed en fallback
function buildYesterdayBar() {
  const d = parisNow(); d.setDate(d.getDate() - 1);
  const yKey = `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
  const stored = safeParseJSON(lsGet(LS.daily(yKey)), null);
  const el = document.getElementById('yesterday-bar');

  const audioOp = stored?.audio
    ? OPENINGS.find(o => o.name === stored.audio) || OPENINGS[dailyIndex(d, 53, OPENINGS.length)]
    : OPENINGS[dailyIndex(d, 53, OPENINGS.length)];

  const data = stored || {
    classic: CHARACTERS[dailyIndex(d,    1, CHARACTERS.length)].name,
    wanted:  WANTED_CHARS[dailyIndex(d, 31, WANTED_CHARS.length)].name,
    silhouette: (typeof SIL_POOL !== 'undefined' && SIL_POOL.length) ? SIL_POOL[dailyIndex(d, 211, SIL_POOL.length)].name : null,
    fruit:   FRUITS[dailyIndex(d,       71, FRUITS.length)].holder,
    emoji:   EMOJI_POOL[dailyIndex(d,  137, EMOJI_POOL.length)].name,
    tome:    TOMES[dailyIndex(d,       181, TOMES.length)],
  };

  const tomeBit = (data.tome != null)
    ? ` &nbsp;|&nbsp; <svg class="ic ic-inline mi-tome" aria-hidden="true"><use href="#ic-tome"></use></svg>Tome : <strong>${esc(String(data.tome))}</strong>` : '';
  el.innerHTML =
    `Hier &nbsp;—&nbsp; Classique : <strong>${esc(data.classic)}</strong> &nbsp;|&nbsp; Wanted : <strong>${esc(data.wanted)}</strong> &nbsp;|&nbsp; Silhouette : <strong>${esc(data.silhouette || '?')}</strong> &nbsp;|&nbsp; Fruit : <strong>${esc(data.fruit)}</strong> &nbsp;|&nbsp; Émoji : <strong>${esc(data.emoji)}</strong>` +
    `<br><span class="yesterday-op"><svg class="ic ic-inline mi-audio" aria-hidden="true"><use href="#ic-note"></use></svg>Opening : <strong>${esc(audioOp.name)}</strong> <em>(${esc(audioOp.artist)})</em>${tomeBit}</span>` +
    `<br><span class="yesterday-community" id="yesterday-community"></span>`;
}
// Charge les stats communauté d'hier depuis Firebase et les affiche
async function loadYesterdayStats() {
  const d = parisNow(); d.setDate(d.getDate() - 1);
  // Même format (non zéro-paddé) que todayKey(), sinon la clé ne matche pas l'écriture de daily-stats
  const yKey = `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
  const stats = await fbGet(`daily-stats/${yKey}`);
  const el = document.getElementById('yesterday-community');
  if (!el || !stats) return;
  const parts = MODES.map(({ id, svg }) => {
    const s = stats[id];
    if (!s || !s.total) return null;
    const pct = s.wins ? Math.round((s.wins / s.total) * 100) : 0;
    const avg = (s.wins && s.tries_sum) ? (s.tries_sum / s.wins).toFixed(1) : null;
    return `<svg class="ic ic-inline mi-${id}" aria-hidden="true"><use href="#${svg}"></use></svg>${pct}%${avg ? `&nbsp;·&nbsp;∅${avg}` : ''}`;
  }).filter(Boolean);
  if (!parts.length) return;
  el.innerHTML = `<svg class="ic ic-inline" aria-hidden="true"><use href="#ic-flag"></use></svg>Communauté&nbsp;: ${parts.join('&emsp;')}`;
}

// ===== NAVIGATION PAR ONGLETS =====
function switchMode(mode) {
  const _prevMode = currentMode;

  // ── Transition FLIP : style inline (priorité absolue sur les stylesheets) ──
  let _flipEl = null;
  if (_prevMode !== mode && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const _order = ['classic', 'wanted', 'silhouette', 'fruit', 'emoji', 'audio', 'tome', 'inf'];
    const _anim  = _order.indexOf(mode) >= _order.indexOf(_prevMode) ? 'slideInRight' : 'slideInLeft';
    const _sid   = mode === 'classic' ? 'classic-section' : `${mode}-section`;
    _flipEl = document.getElementById(_sid);
    if (_flipEl) _flipEl.style.animation = `${_anim} 220ms cubic-bezier(0.25,0.46,0.45,0.94) both`;
  }

  currentMode = mode;
  document.getElementById('tab-classic').classList.toggle('active', mode === 'classic');
  document.getElementById('tab-wanted').classList.toggle('active', mode === 'wanted');
  document.getElementById('tab-silhouette').classList.toggle('active', mode === 'silhouette');
  document.getElementById('tab-fruit').classList.toggle('active', mode === 'fruit');
  document.getElementById('tab-emoji').classList.toggle('active', mode === 'emoji');
  document.getElementById('tab-audio').classList.toggle('active', mode === 'audio');
  document.getElementById('tab-tome').classList.toggle('active', mode === 'tome');
  document.getElementById('tab-inf').classList.toggle('active', mode === 'inf');
  // Sync ARIA : l'onglet actif est annoncé comme sélectionné aux lecteurs d'écran
  document.querySelectorAll('.mode-tab[role="tab"]').forEach(t => {
    t.setAttribute('aria-selected', t.classList.contains('active') ? 'true' : 'false');
  });
  document.getElementById('classic-section').classList.toggle('hidden', mode !== 'classic');
  document.getElementById('wanted-section').classList.toggle('active', mode === 'wanted');
  document.getElementById('silhouette-section').classList.toggle('active', mode === 'silhouette');
  document.getElementById('fruit-section').classList.toggle('active', mode === 'fruit');
  document.getElementById('emoji-section').classList.toggle('active', mode === 'emoji');
  document.getElementById('audio-section').classList.toggle('active', mode === 'audio');
  document.getElementById('tome-section').classList.toggle('active', mode === 'tome');
  document.getElementById('inf-section').classList.toggle('active', mode === 'inf');
  // Le mode Tome a son propre champ numérique → masquer la zone de saisie partagée + le compteur
  const _sa = input.closest('.search-area');
  if (_sa) _sa.style.display = (mode === 'tome') ? 'none' : '';
  if (mode === 'tome') { const _c = document.getElementById('counter'); if (_c) _c.style.display = 'none'; }

  const over = mode === 'classic' ? cOver
             : mode === 'wanted'  ? wOver
             : mode === 'fruit'   ? frOver
             : mode === 'emoji'   ? emOver
             : mode === 'audio'   ? auOver
             : mode === 'inf'     ? infOver
             : mode === 'tome'    ? tmOver
             : mode === 'silhouette' ? silOver
             :                      cOver;
  input.placeholder = mode === 'classic' || mode === 'inf'
    ? 'Tape un nom de personnage...'
    : mode === 'wanted'
    ? 'Devine le personnage sur le poster...'
    : mode === 'fruit'
    ? 'Devine le détenteur du fruit...'
    : mode === 'emoji'
    ? 'Devine le personnage...'
    : mode === 'audio'
    ? "Devine le nom de l'opening..."
    : 'Devine le personnage...';
  input.disabled = over;
  document.getElementById('guess-btn').disabled = over;
  syncBanners();
  updateCounter();
  if (mode === 'wanted') initPoster();
  if (mode === 'silhouette') initSilhouetteMode();
  if (mode === 'fruit')  initFruitMode();
  if (mode === 'emoji')  initEmojiMode();
  if (mode === 'audio')  initAudioMode();
  if (mode === 'tome')   initTomeMode();
  if (mode === 'inf')    initInfMode();
  loadDailyCounter(mode);
  // Auto-focus du champ de saisie si le mode n'est pas terminé
  if (!over) setTimeout(() => { input.focus(); }, 80);
  const TITLES = {
    classic: 'LogPose · Classique — Devine le personnage One Piece',
    wanted:  'LogPose · Wanted — Reconnais l\'avis de recherche',
    silhouette: 'LogPose · Silhouette — Devine le personnage à sa forme',
    fruit:   'LogPose · Fruit du Démon — Trouve le détenteur',
    emoji:   'LogPose · Émoji — Devine le personnage One Piece',
    audio:   'LogPose · Opening — Devine l\'opening One Piece',
    tome:    'LogPose · Tome — Devine le tome One Piece',
    inf:     'LogPose · Classique Infini — Entraînement sans limite',
  };
  document.title = TITLES[mode] || 'LogPose — 7 défis One Piece quotidiens';

  // Cleanup FLIP : fige animation:none pour neutraliser sectionIn (ne PAS remettre '' — ça le retriggerait)
  if (_flipEl) {
    _flipEl.addEventListener('animationend', () => { _flipEl.style.animation = 'none'; }, { once: true });
  }
}

// ===== BANNERS =====
function syncBanners() {
  if (currentMode === 'tome') {
    if (!tmOver) {
      document.getElementById('win-banner').classList.remove('show');
      document.getElementById('lose-banner').classList.remove('show');
      return;
    }
    const won = tmGuesses.includes(TARGET_TOME);
    document.getElementById('win-banner').classList.toggle('show', won);
    document.getElementById('lose-banner').classList.toggle('show', !won);
    if (won) {
      document.getElementById('win-title').textContent     = WIN_TITLES.tome;
      document.getElementById('win-char-name').textContent = `Tome ${TARGET_TOME}`;
      document.getElementById('win-attempts').textContent  = tmGuesses.length;
    } else {
      document.getElementById('lose-char-name').textContent = `Tome ${TARGET_TOME}`;
    }
    return;
  }
  const over    = currentMode === 'classic' ? cOver    : currentMode === 'wanted' ? wOver    : currentMode === 'fruit' ? frOver    : currentMode === 'emoji' ? emOver    : currentMode === 'audio' ? auOver  : currentMode === 'inf' ? infOver  : silOver;
  const guesses = currentMode === 'classic' ? cGuesses : currentMode === 'wanted' ? wGuesses : currentMode === 'fruit' ? frGuesses : currentMode === 'emoji' ? emGuesses : currentMode === 'audio' ? auGuesses : currentMode === 'inf' ? infGuesses : silGuesses;
  const target  = currentMode === 'classic' ? TARGET_C : currentMode === 'wanted' ? TARGET_W : currentMode === 'fruit' ? { name: TARGET_FRU.holder } : currentMode === 'emoji' ? emTarget : currentMode === 'audio' ? TARGET_AU : currentMode === 'inf' ? infTarget : TARGET_SIL;

  if (!over) {
    document.getElementById('win-banner').classList.remove('show');
    document.getElementById('lose-banner').classList.remove('show');
    return;
  }
  const won = guesses.some(g => g.name === target.name);
  document.getElementById('win-banner').classList.toggle('show', won);
  document.getElementById('lose-banner').classList.toggle('show', !won);
  if (won) {
    document.getElementById('win-title').innerHTML = WIN_TITLES[currentMode] || '🏴‍☠️ Nakama trouvé !';
    document.getElementById('win-char-name').textContent = target.name;
    document.getElementById('win-attempts').textContent = guesses.length;
  } else {
    document.getElementById('lose-char-name').textContent = target.name;
  }
}

// ===== COUNTER =====
function updateCounter() {
  if (currentMode === 'tome') return;   // le mode Tome gère son propre affichage (tome-hint / tome-guesses)
  const guesses = currentMode === 'classic' ? cGuesses : currentMode === 'wanted' ? wGuesses : currentMode === 'fruit' ? frGuesses : currentMode === 'emoji' ? emGuesses : currentMode === 'audio' ? auGuesses : currentMode === 'inf' ? infGuesses : silGuesses;
  const names   = currentMode === 'classic' ? cNames   : currentMode === 'wanted' ? wNames   : currentMode === 'fruit' ? frNames   : currentMode === 'emoji' ? emNames   : currentMode === 'audio' ? auNames   : currentMode === 'inf' ? infNames   : silNames;
  document.getElementById('counter').style.display = 'block';
  document.getElementById('current-try').textContent = guesses.length + 1;
  document.getElementById('already-guessed-label').textContent =
    names.size > 0 ? `Déjà essayé : ${[...names].join(', ')}` : '';
}

// ===== FORMATAGE PRIME =====
function formatBounty(b) {
  if (!b) return '—';
  if (b >= 1000) {
    const md = b / 1000;
    const str = md % 1 === 0
      ? md + ' Md'
      : md.toFixed(3).replace(/\.?0+$/, '').replace('.', ',') + ' Md';
    return str;
  }
  return b + ' M';
}

// ===== AUTOCOMPLETE =====
const input = document.getElementById('search-input');
const acBox = document.getElementById('autocomplete');
let acSel = -1, acFilt = [];

// getMatchHint / charMatchesQuery vivent dans js/versus-rules.js (source unique
// partagée avec le serveur Versus) — ALIASES y est passé en paramètre.

input.addEventListener('input', () => {
  const q = input.value.trim().toLowerCase();
  if (!q) { acBox.classList.remove('open'); return; }
  let pool, used;
  if (currentMode === 'classic')      { pool = CHARACTERS;   used = cNames; }
  else if (currentMode === 'wanted')  { pool = WANTED_CHARS; used = wNames; }
  else if (currentMode === 'fruit')   { pool = CHARACTERS;   used = frNames; }
  else if (currentMode === 'emoji')   { pool = EMOJI_POOL;   used = emNames; }
  else if (currentMode === 'audio')   { pool = OPENINGS;     used = auNames; }
  else if (currentMode === 'inf')     { pool = CHARACTERS;   used = infNames; }
  else                                { pool = CHARACTERS;   used = silNames; }  // silhouette
  acFilt = pool.filter(c => !used.has(c.name) && charMatchesQuery(c, q, ALIASES)).slice(0, 8);
  if (!acFilt.length) { acBox.classList.remove('open'); return; }
  acBox.innerHTML = acFilt.map((c, i) => {
    const hint = getMatchHint(c, q, ALIASES);
    const sub  = hint ? ` <span class="ac-hint">${esc(hint)}</span>` : '';
    return `<div class="ac-item" data-i="${i}">${esc(c.name)}${sub}</div>`;
  }).join('');
  acBox.classList.add('open'); acSel = -1;
  acBox.querySelectorAll('.ac-item').forEach(el =>
    el.addEventListener('click', () => { input.value = acFilt[+el.dataset.i].name; acBox.classList.remove('open'); })
  );
});

input.addEventListener('keydown', e => {
  const items = acBox.querySelectorAll('.ac-item');
  if (e.key === 'ArrowDown')      { acSel = Math.min(acSel + 1, items.length - 1); hiAc(items); e.preventDefault(); }
  else if (e.key === 'ArrowUp')   { acSel = Math.max(acSel - 1, 0); hiAc(items); e.preventDefault(); }
  else if (e.key === 'Enter') {
    if (acSel >= 0 && acFilt[acSel]) { input.value = acFilt[acSel].name; acBox.classList.remove('open'); }
    submitGuess();
  }
});

function hiAc(items) {
  items.forEach((el, i) => el.classList.toggle('selected', i === acSel));
  if (acSel >= 0) items[acSel].scrollIntoView({ block: 'nearest' });
}
document.addEventListener('click', e => { if (!e.target.closest('.search-wrap')) acBox.classList.remove('open'); });

// ===== SUBMIT =====
document.getElementById('guess-btn').addEventListener('click', submitGuess);

function submitGuess() {
  if (currentMode === 'classic')     submitClassic();
  else if (currentMode === 'wanted') submitWanted();
  else if (currentMode === 'fruit')  submitFruit();
  else if (currentMode === 'emoji')  submitEmoji();
  else if (currentMode === 'audio')  submitAudio();
  else if (currentMode === 'inf')    submitInf();
  else if (currentMode === 'tome')   submitTome();   // (input dédié, mais sécurité)
  else if (currentMode === 'silhouette') submitSilhouette();
}

function shake(el) {
  el.style.animation = 'none'; el.offsetHeight;
  el.style.animation = 'shake 0.3s ease';
  setTimeout(() => el.style.animation = '', 300);
}

// ===== MODE CLASSIQUE =====
function submitClassic() {
  if (cOver) return;
  const name = input.value.trim();
  const char = resolveName(CHARACTERS, name);
  if (!char || cNames.has(char.name)) { shake(input); return; }
  cNames.add(char.name); cGuesses.push(char);
  saveState('classic');
  input.value = ''; acBox.classList.remove('open');
  renderClassicRow(char);
  updateCounter();
  updateRecap();
  checkHintAvailable();
  if (char.name === TARGET_C.name) finClassic(true);
  else if (cGuesses.length >= MAX_CLASSIC_GUESSES) finClassic(false);
  else sfx('guess');
}

function finClassic(won) {
  cOver = true;
  if (!_restoring) sfx(won ? 'win' : 'lose');
  document.getElementById('guess-btn').disabled = true;
  input.disabled = true;
  // Révèle l'image du personnage
  const imgFile = getImgFile(TARGET_C);
  if (imgFile) {
    const revealEl  = document.getElementById('classic-reveal');
    const revealImg = document.getElementById('classic-reveal-img');
    const revealName = document.getElementById('classic-reveal-name');
    revealImg.src = `${ASSET_BASE}images/${imgFile}.jpg`;
    revealName.textContent = TARGET_C.name;
    revealEl.style.display = 'block';
  }
  if (won) {
    const isBdayWin = getTodayBirthdays().some(c => c.name === TARGET_C.name);
    document.getElementById('win-title').textContent      = isBdayWin ? '🎂 Joyeux anniversaire !' : WIN_TITLES['classic'];
    document.getElementById('win-char-name').textContent  = TARGET_C.name;
    document.getElementById('win-attempts').textContent   = cGuesses.length;
    document.getElementById('win-banner').classList.add('show');
    if (!_restoring) launchConfetti(isBdayWin ? 'birthday' : null);
  } else {
    document.getElementById('lose-char-name').textContent = TARGET_C.name;
    document.getElementById('lose-banner').classList.add('show');
  }
  onGameEnd('classic', won, cGuesses.length, won ? calcModeScore('classic', cGuesses.length, hintUsed, 0) : 0);
}

// Comparaisons : cmpHaki/cmpArc/cmpBounty/cmpOrigin/cmpAffil/AFFIL_STOP/fruitLabel
// vivent dans js/versus-rules.js (SOURCE UNIQUE partagée avec le serveur Versus —
// toute retouche de règle se fait là-bas, jamais en la dupliquant ici).

const STATE_FR = { correct: 'correct', partial: 'partiel', wrong: 'incorrect' };
const arrowFr = a => a === '⬆️' ? ', plus haut' : a === '⬇️' ? ', plus bas' : '';
function buildGuessRow(char, T) {
  const row = document.createElement('div');
  row.className = 'guess-row grid-cols';
  row.setAttribute('role', 'listitem');
  // Verdicts calculés par la source unique partagée (js/versus-rules.js) ;
  // déstructurés vers les noms historiques pour laisser le template intact.
  const { gender: gs, affil: as, origin: os, fruit: fs, haki: hs, status: ss,
          arc: ac, bounty: bc } = computeVerdicts(char, T);
  const fl = fruitLabel(char.fruit);
  const genderTxt = char.gender === 'M' ? 'Homme' : char.gender === 'F' ? 'Femme' : 'Inconnu';
  const hakiTxt   = Array.isArray(char.haki) && char.haki.length > 0 ? char.haki.join(', ') : 'Aucun';
  const arcTxt    = ARCS[char.arc - 1] || '?';
  const al = (label, val, state, extra = '') => `aria-label="${esc(label)} : ${esc(String(val))} — ${STATE_FR[state]}${extra}"`;
  row.innerHTML = `
    <div class="cell cell-char">
      ${getImgFile(char)
        ? `<img class="char-thumb" src="${ASSET_BASE}images/${esc(getImgFile(char))}.jpg" alt="${esc(char.name)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"/><span class="char-name-fallback" style="display:none">${esc(char.name)}</span>`
        : `<span class="char-name-only">${esc(char.name)}</span>`
      }
    </div>
    <div class="cell ${gs}" data-label="Genre" ${al('Genre', genderTxt, gs)}><span class="cell-icon" aria-hidden="true">${char.gender === 'M' ? '♂️' : char.gender === 'F' ? '♀️' : '❓'}</span><span class="cell-val">${genderTxt}</span></div>
    <div class="cell ${as}" data-label="Affiliation" ${al('Affiliation', char.affil, as)}><span class="cell-val" style="font-size:0.76rem;line-height:1.3">${esc(char.affil)}</span></div>
    <div class="cell ${os}" data-label="Origine" ${al('Origine', char.origin, os)}><span class="cell-val" style="font-size:0.76rem;line-height:1.3">${esc(char.origin)}</span></div>
    <div class="cell ${fs}" data-label="Fruit du Démon" ${al('Fruit du Démon', fl.val, fs)}><span class="cell-icon" aria-hidden="true">${esc(fl.icon)}</span><span class="cell-val">${esc(fl.val)}</span></div>
    <div class="cell ${hs}" data-label="Haki" ${al('Haki', hakiTxt, hs)}><span class="cell-val" style="font-size:0.72rem;line-height:1.4">${esc(hakiTxt)}</span></div>
    <div class="cell ${ss}" data-label="Statut" ${al('Statut', char.status, ss)}><span class="cell-icon" aria-hidden="true">${char.status === 'Vivant' ? '💚' : '💀'}</span><span class="cell-val">${esc(char.status)}</span></div>
    <div class="cell ${ac.state}" data-label="1er Arc" ${al('Premier arc', arcTxt, ac.state, arrowFr(ac.arrow))}><span class="cell-val" style="font-size:0.74rem;line-height:1.3">${esc(arcTxt)}</span>${ac.arrow ? `<span class="cell-arrow" aria-hidden="true">${esc(ac.arrow)}</span>` : ''}</div>
    <div class="cell ${bc.state}" data-label="Prime" ${al('Prime', formatBounty(char.bounty), bc.state, arrowFr(bc.arrow))}><span class="cell-val">${esc(formatBounty(char.bounty))}</span>${bc.arrow ? `<span class="cell-arrow" aria-hidden="true">${esc(bc.arrow)}</span>` : ''}</div>
  `;
  // Flip animé décalé par colonne (style Wordle)
  row.querySelectorAll('.cell').forEach((cell, i) => {
    cell.style.setProperty('--delay', `${i * 55}ms`);
    cell.classList.add('cell-anim');
  });
  return row;
}

function renderClassicRow(char) {
  document.getElementById('guesses-container').prepend(buildGuessRow(char, TARGET_C));
}

// ===== RECAP =====
const RECAP_COLS = [
  { key:'gender', label:'Genre',     fn: c => c.gender === 'M' ? 'Homme' : c.gender === 'F' ? 'Femme' : 'Inconnu', check: (g,t) => g.gender === t.gender },
  { key:'affil',  label:'Affil.',    fn: c => c.affil,                                       check: (g,t) => g.affil  === t.affil  },
  { key:'origin', label:'Origine',   fn: c => c.origin,                                      check: (g,t) => g.origin === t.origin },
  { key:'fruit',  label:'Fruit',     fn: c => c.fruit || 'Aucun',                            check: (g,t) => g.fruit  === t.fruit  },
  { key:'haki',   label:'Haki',      fn: c => c.haki.length ? c.haki.join(', ') : 'Aucun', check: (g,t) => JSON.stringify([...g.haki].sort()) === JSON.stringify([...t.haki].sort()) },
  { key:'status', label:'Statut',    fn: c => c.status,                                      check: (g,t) => g.status === t.status },
  { key:'arc',    label:'1er Arc',   fn: c => ARCS[c.arc - 1],                               check: (g,t) => g.arc    === t.arc    },
  { key:'bounty', label:'Prime',     fn: c => formatBounty(c.bounty),                        check: (g,t) => g.bounty === t.bounty },
];

function updateRecap() {
  if (cGuesses.length === 0) return;
  document.getElementById('recap-bar').style.display = 'block';
  const grid = document.getElementById('recap-grid');
  grid.innerHTML = '';

  const empty = document.createElement('div');
  empty.style.cssText = 'background:transparent;border:none;';
  grid.appendChild(empty);

  RECAP_COLS.forEach(col => {
    const item = document.createElement('div');
    const correctGuess = cGuesses.find(g => col.check(g, TARGET_C));
    const hintedThis   = hintUsed && document.getElementById('hint-display').innerHTML.includes(col.label);
    item.className = 'recap-item' + (correctGuess ? ' known' : hintedThis ? ' hinted' : '');
    item.innerHTML = `
      <span class="ri-label">${esc(col.label)}</span>
      <span class="ri-val">${correctGuess || hintedThis ? esc(String(col.fn(TARGET_C))) : '???'}</span>
    `;
    grid.appendChild(item);
  });
}

// ===== INDICE =====
const HINT_COLS = [
  { key:'gender', label:'Genre',          fn: c => c.gender === 'M' ? 'Homme' : c.gender === 'F' ? 'Femme' : 'Inconnu' },
  { key:'affil',  label:'Affiliation',    fn: c => c.affil },
  { key:'origin', label:'Origine',        fn: c => c.origin },
  { key:'fruit',  label:'Fruit du Démon', fn: c => c.fruit || 'Aucun' },
  { key:'haki',   label:'Haki',           fn: c => c.haki.length ? c.haki.join(', ') : 'Aucun' },
  { key:'status', label:'Statut',         fn: c => c.status },
  { key:'arc',    label:'1er Arc',        fn: c => ARCS[c.arc - 1] },
  { key:'bounty', label:'Prime',          fn: c => formatBounty(c.bounty) },
];

function checkHintAvailable() {
  if (currentMode !== 'classic' || cOver || hintUsed) return;
  if (cGuesses.length >= 6) document.getElementById('hint-area').style.display = 'flex';
}

function useHint() {
  if (hintUsed || cOver) return;
  const unsolvedCols = HINT_COLS.filter(col => {
    return !cGuesses.some(g => {
      if (col.key === 'gender') return g.gender === TARGET_C.gender;
      if (col.key === 'affil')  return g.affil  === TARGET_C.affil;
      if (col.key === 'origin') return g.origin === TARGET_C.origin;
      if (col.key === 'fruit')  return g.fruit  === TARGET_C.fruit;
      if (col.key === 'haki')   return JSON.stringify([...g.haki].sort()) === JSON.stringify([...TARGET_C.haki].sort());
      if (col.key === 'status') return g.status === TARGET_C.status;
      if (col.key === 'arc')    return g.arc    === TARGET_C.arc;
      if (col.key === 'bounty') return g.bounty === TARGET_C.bounty;
      return false;
    });
  });

  const display = document.getElementById('hint-display');
  if (!unsolvedCols.length) {
    display.innerHTML = '✅ Tu as déjà tous les attributs corrects !';
    display.classList.add('show');
    return;
  }

  const pick = unsolvedCols[cGuesses.length % unsolvedCols.length];
  display.innerHTML = `💡 <strong>${esc(pick.label)}</strong> : ${esc(String(pick.fn(TARGET_C)))}`;
  display.classList.add('show');
  document.getElementById('hint-btn').disabled = true;
  hintUsed = true;
  updateRecap();
}

// ===== MODE WANTED =====
function initPoster() {
  const img   = document.getElementById('wanted-img');
  const noImg = document.getElementById('wanted-no-img');
  img.src = '';
  img.src = `${ASSET_BASE}images/${getImgFile(TARGET_W)}.jpg`;
  img.draggable = false;
  img.addEventListener('dragstart', e => e.preventDefault());
  img.onerror = () => { img.style.display = 'none'; noImg.style.display = 'flex'; };
  img.onload  = () => { img.style.display = 'block'; noImg.style.display = 'none'; };
  if (wOver) {
    revealFull();
  } else {
    const blurPx = BLUR_STEPS[Math.min(wGuesses.length, BLUR_STEPS.length - 1)];
    applyFilter(img, blurPx);
  }
  updateDots(); updateHint();
}

function applyFilter(img, blurPx) {
  img.style.filter = colorMode
    ? `blur(${blurPx}px) grayscale(0)`
    : `blur(${blurPx}px) grayscale(1)`;
}

function updateDots() {
  const dots = document.getElementById('blur-dots');
  dots.innerHTML = '';
  for (let i = 0; i < MAX_GUESSES; i++) {
    const d = document.createElement('div');
    d.className = 'blur-dot' + (i < wGuesses.length ? ' revealed' : '');
    dots.appendChild(d);
  }
}

function updateHint() {
  const blurPx = BLUR_STEPS[Math.min(wGuesses.length, BLUR_STEPS.length - 1)];
  const el   = document.getElementById('wanted-blur-level');
  const left = MAX_GUESSES - wGuesses.length;
  if (wOver)            el.textContent = wGuesses.some(g => g.name === TARGET_W.name) ? '🎉 Trouvé !' : '💀 Perdu !';
  else if (blurPx === 0) el.textContent = 'Image parfaitement nette !';
  else                  el.textContent = `Flou : ${blurPx}px — ${left} essai(s) restant(s)`;
}

function toggleColor(checked) {
  colorMode = checked;
  const img    = document.getElementById('wanted-img');
  const blurPx = BLUR_STEPS[Math.min(wGuesses.length, BLUR_STEPS.length - 1)];
  applyFilter(img, blurPx);
}

function defloutStep() {
  const blurPx = BLUR_STEPS[Math.min(wGuesses.length, BLUR_STEPS.length - 1)];
  applyFilter(document.getElementById('wanted-img'), blurPx);
  updateDots(); updateHint();
}

function revealFull() {
  const img = document.getElementById('wanted-img');
  img.style.filter = 'blur(0) grayscale(0)';
  document.getElementById('poster-name').textContent    = TARGET_W.name;
  document.getElementById('poster-epithet').textContent = TARGET_W.epithet ? `"${TARGET_W.epithet}"` : '';
  document.getElementById('poster-amount').textContent  = TARGET_W.bounty > 0
    ? (TARGET_W.bounty * 1_000_000).toLocaleString('en-US') : '—';
  updateDots(); updateHint();
}

function submitWanted() {
  if (wOver) return;
  const name = input.value.trim();
  const char = resolveName(WANTED_CHARS, name);
  if (!char || wNames.has(char.name)) { shake(input); return; }
  wNames.add(char.name); wGuesses.push(char);
  saveState('wanted');
  input.value = ''; acBox.classList.remove('open');
  const correct = char.name === TARGET_W.name;
  renderWantedRow(char, correct);
  updateCounter();
  if (correct) finWanted(true);
  else { defloutStep(); if (wGuesses.length >= MAX_GUESSES) finWanted(false); }
}

function renderWantedRow(char, correct) {
  const row = document.createElement('div');
  row.className = 'wanted-guess-row';
  row.innerHTML = `<span class="wg-name">${esc(char.name)}</span><span class="wg-result ${correct ? 'correct' : 'wrong'}">${correct ? '✅ TROUVÉ !' : '❌ Raté'}</span>`;
  document.getElementById('wanted-guesses').prepend(row);
}

function finWanted(won) {
  wOver = true;
  if (!_restoring) sfx(won ? 'win' : 'lose');
  document.getElementById('guess-btn').disabled = true;
  input.disabled = true;
  revealFull();
  if (won) {
    document.getElementById('win-title').textContent      = WIN_TITLES['wanted'];
    document.getElementById('win-char-name').textContent  = TARGET_W.name;
    document.getElementById('win-attempts').textContent   = wGuesses.length;
    document.getElementById('win-banner').classList.add('show');
    if (!_restoring) launchConfetti();
    playWinWanted();
  } else {
    document.getElementById('lose-char-name').textContent = TARGET_W.name;
    document.getElementById('lose-banner').classList.add('show');
  }
  onGameEnd('wanted', won, wGuesses.length, won ? calcModeScore('wanted', wGuesses.length, false, 0) : 0);
}

// ===== MODE SILHOUETTE (gros plan sur un bord → dézoom + pan) =====
const MAX_SIL_GUESSES = 10;
// départ serré (gros plan sur une arête) → dézoom complet (silhouette entière) en 10 essais
const SIL_SCALES  = [3.2, 2.9, 2.6, 2.3, 2.0, 1.75, 1.5, 1.3, 1.15, 1];
const SIL_HINT_AT = 5;   // l'indice couleur se débloque à partir du 5e essai

function silFile(char)      { return Array.isArray(char.img) ? char.img[0] : char.img; }
function silSrc(char)       { return `${ASSET_BASE}silhouettes/${silFile(char)}.png?v=213`; }
function silColorSrc(char)  { return `${ASSET_BASE}silhouettes/color/${silFile(char)}.png?v=213`; }
function silFocus() {
  const f = (typeof SIL_FOCUS_MAP !== 'undefined') && SIL_FOCUS_MAP[silFile(TARGET_SIL)];
  return (f && f.length === 2) ? { x: f[0], y: f[1] } : { x: 0.5, y: 0.18 };
}
// Centre de cadrage (pan) à l'étape courante : interpole du point de contour vers le centre.
function silCenter(step) {
  const s = SIL_SCALES[Math.min(step, SIL_SCALES.length - 1)];
  const t = (SIL_SCALES[0] - s) / (SIL_SCALES[0] - 1) || 0;
  const f = silFocus();
  return { x: f.x + (0.5 - f.x) * t, y: f.y + (0.5 - f.y) * t, s };
}

function initSilhouetteMode() {
  if (!TARGET_SIL) return;
  const img = document.getElementById('sil-img');
  const col = document.getElementById('sil-color');
  if (img && img.getAttribute('src') !== silSrc(TARGET_SIL)) {
    img.src = silSrc(TARGET_SIL);
    img.draggable = false; img.addEventListener('dragstart', e => e.preventDefault());
  }
  if (col && col.getAttribute('src') !== silColorSrc(TARGET_SIL)) {
    col.src = silColorSrc(TARGET_SIL);
    col.draggable = false; col.addEventListener('dragstart', e => e.preventDefault());
  }
  document.getElementById('sil-guesses').innerHTML = '';
  silGuesses.forEach(c => renderSilGuess(c, c.name === TARGET_SIL.name, false));
  applyZoomSil();
  applySilHintReveal();
  updateSilStatus();
}

// Pan du point de contour (départ) vers le centre (fin) + dézoom léger — §3.3(c).
function applyZoomSil() {
  const img = document.getElementById('sil-img');
  const col = document.getElementById('sil-color');
  if (!img) return;
  const step = Math.min(silGuesses.length, SIL_SCALES.length - 1);
  const cc = silCenter(step);
  const s  = silOver ? 1 : cc.s;
  const ccx = silOver ? 0.5 : cc.x;
  const ccy = silOver ? 0.5 : cc.y;
  // transform-origin:0 0 → translate (en %) place le point (ccx,ccy) au centre du cadre
  const tr = `translate(${(0.5 - s * ccx) * 100}%, ${(0.5 - s * ccy) * 100}%) scale(${s})`;
  img.style.transform = tr;
  if (col) col.style.transform = tr;
}

// Indice : révèle un petit disque en couleur, figé sur la zone visible au moment de l'appui.
function useSilHint() {
  if (silOver || silHintUsed || silGuesses.length < SIL_HINT_AT) return;
  const cc = silCenter(Math.min(silGuesses.length, SIL_SCALES.length - 1));
  silHintFocus = { x: cc.x, y: cc.y };   // centre de la zone actuellement visible
  silHintUsed  = true;
  saveState('silhouette');
  applySilHintReveal();
  updateSilStatus();
}

function applySilHintReveal() {
  const sec = document.getElementById('silhouette-section');
  const col = document.getElementById('sil-color');
  if (!sec || !col) return;
  if (silOver) {                                   // partie finie → révèle le perso en couleur entière
    col.style.clipPath = 'none';
    sec.classList.add('sil-hinted');
  } else if (silHintUsed && silHintFocus) {        // indice actif → petit disque couleur sur la zone visible
    col.style.clipPath = `circle(7% at ${(silHintFocus.x * 100).toFixed(2)}% ${(silHintFocus.y * 100).toFixed(2)}%)`;
    sec.classList.add('sil-hinted');
  } else {
    sec.classList.remove('sil-hinted');
  }
}

function updateSilStatus() {
  const st  = document.getElementById('sil-status');
  const bar = document.getElementById('sil-hint-bar');
  const left = MAX_SIL_GUESSES - silGuesses.length;
  if (st) {
    st.textContent = silOver
      ? (silGuesses.some(g => g.name === TARGET_SIL.name) ? '🎉 Trouvé !' : `💀 Perdu ! C'était ${TARGET_SIL.name}.`)
      : `${left} essai${left > 1 ? 's' : ''} restant${left > 1 ? 's' : ''}`;
  }
  if (bar) bar.classList.toggle('hidden', !(!silOver && !silHintUsed && silGuesses.length >= SIL_HINT_AT));
}

function renderSilGuess(char, correct, fresh = true) {
  const row = document.createElement('div');
  row.className = 'wanted-guess-row' + (fresh ? ' fresh' : '');
  row.innerHTML = `<span class="wg-name">${esc(char.name)}</span><span class="wg-result ${correct ? 'correct' : 'wrong'}">${correct ? '✅ TROUVÉ !' : '❌ Raté'}</span>`;
  document.getElementById('sil-guesses').prepend(row);
}

function submitSilhouette() {
  if (silOver || !TARGET_SIL) return;
  const name = input.value.trim();
  const char = resolveName(CHARACTERS, name);
  if (!char || silNames.has(char.name)) { shake(input); return; }
  silNames.add(char.name); silGuesses.push(char);
  saveState('silhouette');
  input.value = ''; acBox.classList.remove('open');
  const correct = char.name === TARGET_SIL.name;
  renderSilGuess(char, correct);
  updateCounter();
  if (correct) finSilhouette(true);
  else {
    applyZoomSil();
    updateSilStatus();
    if (silGuesses.length >= MAX_SIL_GUESSES) finSilhouette(false);
  }
}

function finSilhouette(won) {
  silOver = true;
  if (!_restoring) sfx(won ? 'win' : 'lose');
  document.getElementById('guess-btn').disabled = true;
  input.disabled = true;
  applyZoomSil();          // s=1 → silhouette pleine centrée
  applySilHintReveal();
  updateSilStatus();
  if (won) {
    document.getElementById('win-title').innerHTML        = WIN_TITLES['silhouette'];
    document.getElementById('win-char-name').textContent  = TARGET_SIL.name;
    document.getElementById('win-attempts').textContent   = silGuesses.length;
    document.getElementById('win-banner').classList.add('show');
    if (!_restoring) launchConfetti();
  } else {
    document.getElementById('lose-char-name').textContent = TARGET_SIL.name;
    document.getElementById('lose-banner').classList.add('show');
  }
  onGameEnd('silhouette', won, silGuesses.length, won ? calcModeScore('silhouette', silGuesses.length, silHintUsed, 0) : 0);
}

// ===== STATISTIQUES =====
const MAX_DIST_CLASSIC = 10;
const MAX_DIST_WANTED  = 8;
const MAX_DIST_FRUIT   = 10;

// ===== MODE INFINI =====
function loadInfStats() {
  return {
    streak: sanitizeNum(lsGet(LS.infStreak)),
    record: sanitizeNum(lsGet(LS.infRecord)),
  };
}
function saveInfStats(streak, record) {
  lsSet(LS.infStreak, String(streak));
  lsSet(LS.infRecord, String(record));
}

function pickInfTarget() {
  infTarget = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
  infGuesses = [];
  infOver = false;
  infNames = new Set();
}

function initInfMode() {
  if (!infTarget) pickInfTarget();
  document.getElementById('inf-guesses-container').innerHTML = '';
  infGuesses.forEach(g => document.getElementById('inf-guesses-container').prepend(buildGuessRow(g, infTarget)));
  const { streak, record } = loadInfStats();
  document.getElementById('inf-streak').textContent = streak;
  document.getElementById('inf-record').textContent = record;
  document.getElementById('inf-replay-wrap').classList.toggle('hidden', !infOver);
}

function submitInf() {
  if (infOver) return;
  const name = input.value.trim();
  const char = resolveName(CHARACTERS, name);
  if (!char || infNames.has(char.name)) { shake(input); return; }
  infNames.add(char.name); infGuesses.push(char);
  input.value = ''; acBox.classList.remove('open');
  document.getElementById('inf-guesses-container').prepend(buildGuessRow(char, infTarget));
  updateCounter();
  if (char.name === infTarget.name) finInf(true);
  else if (infGuesses.length >= MAX_INF_GUESSES) finInf(false);
}

function finInf(won) {
  infOver = true;
  if (!_restoring) sfx(won ? 'win' : 'lose');
  document.getElementById('guess-btn').disabled = true;
  input.disabled = true;
  const { streak, record } = loadInfStats();
  const newStreak = won ? streak + 1 : 0;
  const newRecord = Math.max(record, newStreak);
  saveInfStats(newStreak, newRecord);
  document.getElementById('inf-streak').textContent = newStreak;
  document.getElementById('inf-record').textContent = newRecord;
  if (won) {
    document.getElementById('win-title').textContent     = WIN_TITLES['inf'];
    document.getElementById('win-char-name').textContent = infTarget.name;
    document.getElementById('win-attempts').textContent  = infGuesses.length;
    document.getElementById('win-banner').classList.add('show');
    launchConfetti();
  } else {
    document.getElementById('lose-char-name').textContent = infTarget.name;
    document.getElementById('lose-banner').classList.add('show');
  }
  document.getElementById('inf-replay-wrap').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function replayInf() {
  pickInfTarget();
  document.getElementById('win-banner').classList.remove('show');
  document.getElementById('lose-banner').classList.remove('show');
  document.getElementById('inf-replay-wrap').classList.add('hidden');
  document.getElementById('inf-guesses-container').innerHTML = '';
  input.disabled = false;
  document.getElementById('guess-btn').disabled = false;
  updateCounter();
}

function defaultStats(maxGuesses) {
  const dist = {};
  for (let i = 1; i <= maxGuesses; i++) dist[i] = 0;
  return { played: 0, won: 0, currentStreak: 0, maxStreak: 0, lastDate: null, distribution: dist };
}

function loadStats(mode) {
  const key  = LS.stats(mode);
  const max  = mode === 'silhouette' ? MAX_SIL_GUESSES : mode === 'fruit' ? MAX_DIST_FRUIT : mode === 'emoji' ? MAX_EM_GUESSES : mode === 'audio' ? MAX_AU_GUESSES : mode === 'tome' ? MAX_TOME_GUESSES : MAX_DIST_CLASSIC;
  const raw  = lsGet(key);
  if (!raw) return defaultStats(max);
  return safeParseJSON(raw, defaultStats(max));
}

function saveStats(mode, stats) {
  lsSet(LS.stats(mode), JSON.stringify(stats));
}

function parisNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
}

function todayKey() {
  const d = parisNow();
  return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
}

function recordResult(mode, won, numGuesses) {
  const stats = loadStats(mode);
  const today = todayKey();
  // Si déjà joué aujourd'hui : on ne repasse que si on vient de gagner après une défaite enregistrée
  if (stats.lastDate === today) {
    if (!won || stats.won > 0) return;
    // Correction : on avait enregistré une défaite, on enregistre maintenant la victoire
    stats.won++;
    stats.currentStreak++;
    if (stats.currentStreak > stats.maxStreak) stats.maxStreak = stats.currentStreak;
    const key = String(numGuesses);
    if (stats.distribution[key] !== undefined) stats.distribution[key]++;
    stats.lastWinGuesses = numGuesses;
    saveStats(mode, stats);
    return;
  }
  stats.lastDate = today;
  stats.played++;
  if (won) {
    stats.won++;
    stats.currentStreak++;
    if (stats.currentStreak > stats.maxStreak) stats.maxStreak = stats.currentStreak;
    const key = String(numGuesses);
    if (stats.distribution[key] !== undefined) stats.distribution[key]++;
    stats.lastWinGuesses = numGuesses;
  } else {
    stats.currentStreak = 0;
    stats.lastWinGuesses = null;
  }
  saveStats(mode, stats);
}

// Appel dans chaque fin de partie
let _statsMode = 'classic';

function showStats(mode) {
  _statsMode = mode || currentMode;
  if (_statsMode === 'inf') _statsMode = 'classic'; // inf n'a pas de stats
  document.getElementById('stats-modal').classList.remove('hidden');
  renderStatsContent(_statsMode);
  // Met à jour les onglets (+ versus : onglet stats sans mode quotidien associé)
  [...MODE_IDS, 'versus'].forEach(m => {
    const tab = document.getElementById(`stab-${m}`);
    if (tab) tab.classList.toggle('active', m === _statsMode);
  });
}

function closeStats() {
  document.getElementById('stats-modal').classList.add('hidden');
}

function handleModalClick(e) {
  if (e.target === document.getElementById('stats-modal')) closeStats();
}

function switchStatsTab(mode) {
  _statsMode = mode;
  [...MODE_IDS, 'versus'].forEach(m => {
    const tab = document.getElementById(`stab-${m}`);
    if (tab) tab.classList.toggle('active', m === mode);
  });
  renderStatsContent(mode);
}

const MODES_ORDER = MODE_IDS;

function getNextUnplayedMode(currentMode) {
  const results = safeParseJSON(lsGet(LS.result(todayKey())), {});
  const startIdx = MODES_ORDER.indexOf(currentMode);
  // Cherche d'abord après le mode actuel, puis depuis le début
  const ordered = [
    ...MODES_ORDER.slice(startIdx + 1),
    ...MODES_ORDER.slice(0, startIdx),
  ];
  return ordered.find(m => !results[m]) || null;
}

// Onglet Versus 1v1 : bilan de duels (clé écrite par js/versus.js), pas de stats quotidiennes
function renderVersusStats() {
  const s = safeParseJSON(lsGet(LS.versusStats), {});
  const w = sanitizeNum(s.w), l = sanitizeNum(s.l);
  const played = w + l;
  const pct = played === 0 ? 0 : Math.round((w / played) * 100);
  let html = `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-val">${played}</div><div class="stat-label">Duels joués</div></div>
      <div class="stat-card"><div class="stat-val">${w}</div><div class="stat-label">Victoires</div></div>
      <div class="stat-card"><div class="stat-val">${l}</div><div class="stat-label">Défaites</div></div>
      <div class="stat-card"><div class="stat-val">${pct}%</div><div class="stat-label">Taux de victoire</div></div>
    </div>`;
  if (played === 0) html += `<div class="stats-empty">Aucun duel joué — défie un ami depuis l'onglet Versus !</div>`;
  html += `<button class="stats-next-btn" onclick="location.href='versus.html'">Lancer un duel <svg class="ic ic-inline" aria-hidden="true"><use href="#ic-versus"></use></svg> →</button>`;
  document.getElementById('stats-content').innerHTML = html;
}

function renderStatsContent(mode) {
  if (mode === 'versus') return renderVersusStats();
  const stats   = loadStats(mode);
  const played  = sanitizeNum(stats.played);
  const won     = sanitizeNum(stats.won);
  const winPct  = played === 0 ? 0 : Math.round((won / played) * 100);
  const streak  = sanitizeNum(stats.currentStreak);
  const maxStr  = sanitizeNum(stats.maxStreak);
  const maxDist = mode === 'silhouette' ? MAX_SIL_GUESSES : mode === 'fruit' ? MAX_DIST_FRUIT : mode === 'emoji' ? MAX_EM_GUESSES : mode === 'audio' ? MAX_AU_GUESSES : mode === 'tome' ? MAX_TOME_GUESSES : MAX_DIST_CLASSIC;
  const maxVal  = Math.max(1, ...Object.values(stats.distribution).map(v => sanitizeNum(v)));
  // Moyenne d'essais (sur les parties gagnées uniquement)
  const totGuesses  = Object.entries(stats.distribution).reduce((s, [k, v]) => s + Number(k) * sanitizeNum(v), 0);
  const avgTriesTxt = won > 0 ? (totGuesses / won).toFixed(1).replace('.', ',') : '—';

  // Dernier essai gagnant pour surligner la barre
  const lastWinGuess = stats.lastWinGuesses || null;

  // ── Score du jour ──────────────────────────────────────────────
  const todayScores = safeParseJSON(lsGet(LS.score(todayKey())), {});
  const rawMode     = Object.prototype.hasOwnProperty.call(todayScores, mode) ? sanitizeNum(todayScores[mode]) : undefined;
  const totalScore  = Object.values(todayScores).reduce((a, b) => a + sanitizeNum(b), 0);
  const modeLabels  = { classic:'Classique', wanted:'Wanted', silhouette:'Silhouette', fruit:'Fruit du Démon', emoji:'Émoji' };
  const scoreHtml   = rawMode !== undefined ? `
    <div class="stats-score-row">
      <div class="stats-score-item">
        <span class="stats-score-label">Score ${modeLabels[mode] || mode}</span>
        <span class="stats-score-val">${rawMode.toLocaleString('fr-FR')} pts</span>
      </div>
      <div class="stats-score-sep">⚓</div>
      <div class="stats-score-item">
        <span class="stats-score-label">Total du jour</span>
        <span class="stats-score-val">${totalScore.toLocaleString('fr-FR')} <span class="stats-score-max">/ 70 000</span></span>
      </div>
    </div>` : '';

  // ── Rang pirate ──────────────────────────────────────────────
  const cumulScore = sanitizeNum(lsGet(LS.cumulativeScore));
  const { emoji: rankEmoji, title: rankTitle, min: rankMin, next: rankNext } = getRankFromScore(cumulScore);
  const rankPct = rankNext
    ? Math.min(100, Math.round(((cumulScore - rankMin) / (rankNext.min - rankMin)) * 100))
    : 100;
  const rankHtml = `
    <div class="stats-rank-section">
      <div class="stats-rank-jr-row">
        <div class="jr-badge" id="jr-badge"></div>
        <div class="stats-rank-info">
          <div class="stats-rank-title">${esc(rankEmoji)} ${esc(rankTitle)}</div>
          <div class="stats-rank-sub">${cumulScore.toLocaleString('fr-FR')} pts cumulés${rankNext ? ` · prochain : ${rankNext.title} (${rankNext.min.toLocaleString('fr-FR')})` : ' · Rang maximal atteint !'}</div>
          <div class="stats-rank-bar-track"><div class="stats-rank-bar" style="width:${rankPct}%"></div></div>
          <div class="jr-label" id="jr-label"></div>
        </div>
      </div>
    </div>`;

  let html = rankHtml + scoreHtml + `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-val">${played}</div><div class="stat-label">Parties jouées</div></div>
      <div class="stat-card"><div class="stat-val">${winPct}%</div><div class="stat-label">Victoires</div></div>
      <div class="stat-card"><div class="stat-val">${streak}</div><div class="stat-label">Série actuelle</div></div>
      <div class="stat-card"><div class="stat-val">${maxStr}</div><div class="stat-label">Meilleure série</div></div>
      <div class="stat-card"><div class="stat-val">${avgTriesTxt}</div><div class="stat-label">Essais moyen</div></div>
    </div>
    <div class="dist-title">Distribution des essais</div>
  `;

  if (played === 0) {
    html += `<div class="stats-empty">Aucune partie jouée pour ce mode.</div>`;
  } else {
    for (let i = 1; i <= maxDist; i++) {
      const count   = sanitizeNum(stats.distribution[i]);
      const pct     = Math.round((count / maxVal) * 100);
      const hl      = (lastWinGuess === i) ? 'highlight' : '';
      const hasVal  = count > 0 ? 'has-value' : '';
      html += `
        <div class="dist-row">
          <span class="dist-num">${i}</span>
          <div class="dist-bar-track">
            <div class="dist-bar ${hl} ${hasVal}" data-pct="${Math.max(pct, count > 0 ? 8 : 3)}">
              <span>${count > 0 ? count : ''}</span>
            </div>
          </div>
        </div>`;
    }
  }

  html += `<button class="stats-share-btn" onclick="closeStats(); shareDaily()">📋 Partager mon récap</button>`;

  // Bouton "mode suivant" — uniquement si un mode non joué existe
  const nextMode = getNextUnplayedMode(mode);
  if (nextMode) {
    const nm = MODES.find(m => m.id === nextMode);
    const nextLabel = nm ? `<svg class="ic ic-inline mi-${nm.id}" aria-hidden="true"><use href="#${nm.svg}"></use></svg>${esc(nm.label)}` : esc(nextMode);
    html += `<button class="stats-next-btn" onclick="closeStats(); switchMode('${nextMode}')">Jouer : ${nextLabel} →</button>`;
  }

  document.getElementById('stats-content').innerHTML = html;

  // Jolly Roger procédural — badge unique par appareil (déterministe, SVG)
  const jrEl = document.getElementById('jr-badge');
  if (jrEl && window.renderJollyRoger) {
    renderJollyRoger(jrEl);
    const jrLbl = document.getElementById('jr-label');
    if (jrLbl) jrLbl.textContent = getJollyRogerVariantName();
  }

  // Anime les barres après insertion dans le DOM (délai pour laisser le browser rendre width:0 d'abord)
  setTimeout(() => {
    document.querySelectorAll('.dist-bar[data-pct]').forEach(bar => {
      bar.style.width = bar.dataset.pct + '%';
    });
  }, 60);
}

function resetStats(mode) {
  if (!confirm(`Réinitialiser les statistiques du mode "${mode}" ?`)) return;
  lsRemove(LS.stats(mode));
  renderStatsContent(mode);
}

// ===== MODE AKUMA NO MI =====
const FRU_HINT1_AT = 3;
const FRU_HINT2_AT = 5;
const FRU_HINT3_AT = 8;

function initFruitMode() {
  document.getElementById('fr-fruit-name').textContent = TARGET_FRU.name;
  document.getElementById('fruit-guesses').innerHTML = '';
  frGuesses.forEach(g => renderFruitRow(g, g.name === TARGET_FRU.holder));
  renderFruitHints();
}

function revealHint(n) {
  const wrongCount = frGuesses.filter(g => g.name !== TARGET_FRU.holder).length;
  const thresholds = [FRU_HINT1_AT, FRU_HINT2_AT, FRU_HINT3_AT];
  if (wrongCount >= thresholds[n - 1] || frOver) {
    frHintsRevealed.add(n);
    renderFruitHints();
  }
}

function renderFruitHints() {
  const wrongCount = frGuesses.filter(g => g.name !== TARGET_FRU.holder).length;

  function applyHint(id, subId, threshold, value, hintNum) {
    const box = document.getElementById(id);
    const sub = document.getElementById(subId);
    const available = wrongCount >= threshold || frOver;
    const revealed  = frHintsRevealed.has(hintNum) || frOver;

    box.classList.toggle('unlocked',  available && revealed);
    box.classList.toggle('available', available && !revealed);

    if (!available) {
      sub.textContent = `Dans ${threshold - wrongCount} essai(s)`;
      box.onclick = null;
    } else if (!revealed) {
      sub.textContent = '👁 Cliquer pour révéler';
      box.onclick = () => revealHint(hintNum);
    } else {
      sub.textContent = value;
      box.onclick = null;
    }
  }

  applyHint('fr-hint1', 'fr-h1-sub', FRU_HINT1_AT, TARGET_FRU.type, 1);
  applyHint('fr-hint2', 'fr-h2-sub', FRU_HINT2_AT, TARGET_FRU.translated, 2);
  applyHint('fr-hint3', 'fr-h3-sub', FRU_HINT3_AT, TARGET_FRU.description, 3);

  const status = document.getElementById('fruit-status');
  if (frOver) {
    const won = frGuesses.some(g => g.name === TARGET_FRU.holder);
    status.textContent = won ? '🎉 Trouvé !' : `💀 C'était ${TARGET_FRU.holder} !`;
    status.style.color = won ? 'var(--correct)' : 'var(--red)';
  } else {
    const left = MAX_FRU_GUESSES - frGuesses.length;
    status.textContent = `${left} essai(s) restant(s) — des indices se débloquent à chaque erreur`;
    status.style.color = '';
  }
}

function submitFruit() {
  if (frOver) return;
  const raw = input.value.trim().toLowerCase();
  const resolved = ALIASES[raw];
  const searchName = resolved || input.value.trim();
  const char = resolveName(CHARACTERS, searchName);
  if (!char || frNames.has(char.name)) { shake(input); return; }
  frNames.add(char.name);
  frGuesses.push(char);
  saveState('fruit');
  input.value = '';
  acBox.classList.remove('open');
  const correct = char.name === TARGET_FRU.holder;
  renderFruitRow(char, correct);
  updateCounter();
  renderFruitHints();
  if (correct) finFruit(true);
  else if (frGuesses.length >= MAX_FRU_GUESSES) finFruit(false);
}

function renderFruitRow(char, correct) {
  const row = document.createElement('div');
  row.className = 'wanted-guess-row';
  row.innerHTML = `<span class="wg-name">${esc(char.name)}</span><span class="wg-result ${correct ? 'correct' : 'wrong'}">${correct ? '✅ TROUVÉ !' : '❌ Raté'}</span>`;
  document.getElementById('fruit-guesses').prepend(row);
}

function finFruit(won) {
  frOver = true;
  if (!_restoring) sfx(won ? 'win' : 'lose');
  document.getElementById('guess-btn').disabled = true;
  input.disabled = true;
  renderFruitHints();
  // Reveal character image
  const holder = CHARACTERS.find(c => c.name === TARGET_FRU.holder);
  if (holder) {
    const imgFile = getImgFile(holder);
    if (imgFile) {
      const revealEl = document.getElementById('fruit-reveal');
      const revealImg = document.getElementById('fruit-reveal-img');
      const revealName = document.getElementById('fruit-reveal-name');
      revealImg.src = `${ASSET_BASE}images/${imgFile}.jpg`;
      revealName.textContent = TARGET_FRU.holder;
      revealEl.style.display = 'block';
    }
  }
  if (won) {
    document.getElementById('win-title').textContent     = WIN_TITLES['fruit'];
    document.getElementById('win-char-name').textContent = TARGET_FRU.holder;
    document.getElementById('win-attempts').textContent  = frGuesses.length;
    document.getElementById('win-banner').classList.add('show');
    if (!_restoring) launchConfetti();
  } else {
    document.getElementById('lose-char-name').textContent = TARGET_FRU.holder;
    document.getElementById('lose-banner').classList.add('show');
  }
  onGameEnd('fruit', won, frGuesses.length, won ? calcModeScore('fruit', frGuesses.length, false, frHintsRevealed.size) : 0);
}

// ===== MODE EMOJI =====
const MAX_EM_GUESSES = 8; // = nombre d'émojis max par personnage

let emGuesses = [], emOver = false, emNames = new Set(), emHintRevealed = false;
let emTarget  = null;   // null → sera initialisé sur TARGET_EM à l'ouverture du mode
let emShuffledEmoji = []; // ordre mélangé (seed du jour)

// Mélange déterministe d'un tableau via une seed (Fisher-Yates + LCG)
function seededShuffle(arr, seed) {
  const a = [...arr];
  let s = seed >>> 0;
  for (let i = a.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildEmojiSeed() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
  const base = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  return (base * 137 * 11) >>> 0; // salt distinct des autres modes
}

function showEmojiReveal() {
  const revEl   = document.getElementById('emoji-reveal');
  const revImg  = document.getElementById('emoji-reveal-img');
  const revName = document.getElementById('emoji-reveal-name');
  const imgFile = getImgFile(emTarget);
  if (imgFile) {
    revImg.src = `${ASSET_BASE}images/${imgFile}.jpg`;
    revImg.style.display = '';
  } else {
    revImg.style.display = 'none';
  }
  revName.textContent = emTarget.name;
  revEl.style.display = 'block';
}

function initEmojiMode() {
  // Premier appel : utiliser la cible quotidienne + mélanger les emojis
  if (!emTarget) {
    emTarget = TARGET_EM;
    emShuffledEmoji = seededShuffle(emTarget.emoji, buildEmojiSeed());
  }

  // Réinitialise la section
  document.getElementById('emoji-guesses').innerHTML = '';

  // Restaure la révélation si la partie est déjà terminée
  if (emOver) {
    showEmojiReveal();
  } else {
    document.getElementById('emoji-reveal').style.display = 'none';
  }

  updateEmojiStrip();
  updateEmojiStatus();
  updateEmojiDebutHint();

  // Re-rendu des devinettes déjà faites (si on revient sur l'onglet)
  emGuesses.slice().reverse().forEach(g => renderEmojiGuess(g, g.name === emTarget.name, false));
}

function updateEmojiStrip(freshIndex = -1) {
  const strip = document.getElementById('emoji-strip');
  const emojis = emShuffledEmoji;
  const total  = emojis.length;
  // Quand la partie est finie on révèle tout, sinon wrongCount + 1
  const wrongCount = emGuesses.filter(g => g.name !== emTarget.name).length;
  const revealed   = emOver ? total : Math.min(wrongCount + 1, total);

  strip.innerHTML = '';
  for (let i = 0; i < total; i++) {
    const box = document.createElement('div');
    if (i < revealed) {
      box.className = 'emoji-box revealed' + (i === freshIndex ? ' fresh' : '');
      box.textContent = emojis[i];
      const eName = (typeof EMOJI_NAMES !== 'undefined' && EMOJI_NAMES[emojis[i]])
        ? EMOJI_NAMES[emojis[i]]
        : emojis[i];
      box.title = eName;
      box.dataset.idx = i + 1;
    } else {
      box.className = 'emoji-box locked';
      box.textContent = '🔒';
    }
    strip.appendChild(box);
  }

  const label = document.getElementById('emoji-progress-label');
  if (emOver) {
    label.textContent = `${total} / ${total} indices révélés`;
  } else {
    label.textContent = `${revealed} / ${total} indice${revealed > 1 ? 's' : ''} révélé${revealed > 1 ? 's' : ''}`;
  }
}

function updateEmojiStatus() {
  const el = document.getElementById('emoji-status');
  if (emOver) {
    const won = emGuesses.some(g => g.name === emTarget.name);
    el.textContent = won
      ? `🎉 Bravo ! C'était bien ${emTarget.name} !`
      : `💀 Perdu ! C'était ${emTarget.name}.`;
    el.style.color = won ? 'var(--green-l)' : 'var(--red)';
  } else {
    const left = MAX_EM_GUESSES - emGuesses.length;
    el.textContent = `${left} essai${left > 1 ? 's' : ''} restant${left > 1 ? 's' : ''} — un nouvel indice emoji se débloque à chaque erreur`;
    el.style.color = '';
  }
}

// Indice « 1ère apparition » : bouton cliquable débloqué au 3e essai (façon mode Fruit).
const EM_HINT_AT = 3; // nombre d'erreurs avant déblocage du bouton
function updateEmojiDebutHint() {
  const el = document.getElementById('emoji-debut-hint');
  if (!el) return;
  const debut = (emTarget && emTarget.debut) ? String(emTarget.debut).trim() : '';
  if (!debut) { el.className = 'emoji-debut-hint hidden'; el.onclick = null; el.innerHTML = ''; return; }

  const wrongCount = emGuesses.filter(g => g.name !== emTarget.name).length;
  const available  = wrongCount >= EM_HINT_AT || emOver;
  const revealed   = emHintRevealed || emOver;

  el.classList.remove('hidden');
  el.classList.toggle('available', available && !revealed);
  el.classList.toggle('revealed',  revealed);

  if (!available) {
    const left = EM_HINT_AT - wrongCount;
    el.innerHTML = `🔒 Indice « 1ʳᵉ apparition » dans ${left} essai${left > 1 ? 's' : ''}`;
    el.onclick = null;
  } else if (!revealed) {
    el.innerHTML = `👁 Révéler l'indice « 1ʳᵉ apparition » <span class="em-hint-cost">(−score)</span>`;
    el.onclick = revealEmojiHint;
  } else {
    el.innerHTML = `💡 <strong>1ʳᵉ apparition</strong> : ${esc(debut)}`;
    el.onclick = null;
  }
}
function revealEmojiHint() {
  if (emOver || emHintRevealed) return;
  emHintRevealed = true;
  saveState('emoji');
  updateEmojiDebutHint();
}

function submitEmoji() {
  if (emOver) return;
  const raw  = input.value.trim();
  const char = resolveName(EMOJI_POOL, raw);
  if (!char || emNames.has(char.name)) { shake(input); return; }
  emNames.add(char.name); emGuesses.push(char);
  saveState('emoji');
  input.value = ''; acBox.classList.remove('open');
  const correct = char.name === emTarget.name;
  renderEmojiGuess(char, correct, true);
  updateCounter();

  if (correct) {
    finEmoji(true);
  } else {
    // Révèle le prochain emoji avec animation
    const wrongCount = emGuesses.filter(g => g.name !== emTarget.name).length;
    const newIdx = Math.min(wrongCount, emShuffledEmoji.length - 1);
    updateEmojiStrip(newIdx);
    updateEmojiStatus();
    updateEmojiDebutHint();
    if (emGuesses.length >= MAX_EM_GUESSES) finEmoji(false);
  }
}

function renderEmojiGuess(char, correct, prepend = true) {
  const row = document.createElement('div');
  row.className = 'wanted-guess-row';
  row.innerHTML = `<span class="wg-name">${esc(char.name)}</span><span class="wg-result ${correct ? 'correct' : 'wrong'}">${correct ? '✅ TROUVÉ !' : '❌ Raté'}</span>`;
  const container = document.getElementById('emoji-guesses');
  if (prepend) container.prepend(row);
  else         container.appendChild(row);
}

function finEmoji(won) {
  emOver = true;
  if (!_restoring) sfx(won ? 'win' : 'lose');
  document.getElementById('guess-btn').disabled = true;
  input.disabled = true;

  // Révèle tous les émojis
  updateEmojiStrip();
  updateEmojiDebutHint();

  // Affiche l'image du personnage
  const imgFile = getImgFile(emTarget);
  if (imgFile) {
    const revEl   = document.getElementById('emoji-reveal');
    const revImg  = document.getElementById('emoji-reveal-img');
    const revName = document.getElementById('emoji-reveal-name');
    revImg.src = `${ASSET_BASE}images/${imgFile}.jpg`;
    revName.textContent = emTarget.name;
    revEl.style.display = 'block';
  }

  updateEmojiStatus();
  showEmojiReveal();

  if (won) {
    document.getElementById('win-title').textContent      = WIN_TITLES['emoji'];
    document.getElementById('win-char-name').textContent  = emTarget.name;
    document.getElementById('win-attempts').textContent   = emGuesses.length;
    document.getElementById('win-banner').classList.add('show');
    if (!_restoring) launchConfetti();
  } else {
    document.getElementById('lose-char-name').textContent = emTarget.name;
    document.getElementById('lose-banner').classList.add('show');
  }
  onGameEnd('emoji', won, emGuesses.length, won ? calcModeScore('emoji', emGuesses.length, false, emHintRevealed ? 1 : 0) : 0);
}

// ===== MODE AUDIO (OPENING) =====
const AUDIO_DURATIONS = [1, 2, 4, 7, 11, 16]; // secondes par essai
const MAX_AU_GUESSES  = AUDIO_DURATIONS.length; // 6
const SCORE_PENALTY_AUDIO = 1500;

let _auPlaying = false;
let _auTimer   = null;

function initAudioMode() {
  document.getElementById('audio-guesses').innerHTML = '';
  auGuesses.slice().reverse().forEach(g => renderAudioGuess(g, g.name === TARGET_AU.name, false));
  updateAudioDots();
  updateAudioStatus();
  updateAudioBarLabel();
  if (auOver) {
    document.getElementById('au-reveal').classList.remove('hidden');
    showAudioReveal();
  } else {
    document.getElementById('au-reveal').classList.add('hidden');
  }
  // Sync volume
  const audio = document.getElementById('au-audio');
  if (audio) audio.volume = parseFloat(document.getElementById('au-volume').value);
  // Reset barre
  const fill = document.getElementById('au-bar-fill');
  if (fill) { fill.style.transition = 'none'; fill.style.width = '0%'; }
  const btn = document.getElementById('au-play-btn');
  if (btn) btn.textContent = auOver ? '▶ Réécouter' : '▶ Écouter';
}

function updateAudioBarLabel() {
  const snippetIdx = auOver ? AUDIO_DURATIONS.length - 1 : Math.min(auGuesses.length, AUDIO_DURATIONS.length - 1);
  const el = document.getElementById('au-bar-label');
  if (el) el.textContent = AUDIO_DURATIONS[snippetIdx] + 's';
}

function playSnippet() {
  const audio = document.getElementById('au-audio');
  if (!audio) return;

  // Si en cours de lecture → stop
  if (_auPlaying) {
    audio.pause(); audio.currentTime = 0;
    clearTimeout(_auTimer); _auTimer = null;
    _auPlaying = false;
    const fill = document.getElementById('au-bar-fill');
    if (fill) { fill.style.transition = 'width 0.3s ease'; fill.style.width = '0%'; }
    document.getElementById('au-play-btn').textContent = '▶ Réécouter';
    return;
  }

  const snippetIdx = auOver ? AUDIO_DURATIONS.length - 1 : Math.min(auGuesses.length, AUDIO_DURATIONS.length - 1);
  const duration   = AUDIO_DURATIONS[snippetIdx];

  audio.src     = `${ASSET_BASE}audio/Opening${TARGET_AU.id}.mp3`;
  audio.currentTime = 0;
  audio.volume  = parseFloat(document.getElementById('au-volume').value);

  const btn  = document.getElementById('au-play-btn');
  const fill = document.getElementById('au-bar-fill');

  audio.play().then(() => {
    _auPlaying = true;
    if (btn)  btn.textContent = '⏹ Stop';
    if (fill) {
      fill.style.transition = 'none';
      fill.style.width = '0%';
      requestAnimationFrame(() => {
        fill.style.transition = `width ${duration}s linear`;
        fill.style.width = '100%';
      });
    }
    _auTimer = setTimeout(() => {
      audio.pause(); audio.currentTime = 0;
      _auPlaying = false; _auTimer = null;
      if (fill) { fill.style.transition = 'width 0.3s ease'; fill.style.width = '0%'; }
      if (btn)  btn.textContent = '▶ Réécouter';
    }, duration * 1000);
  }).catch(() => {
    if (btn) btn.textContent = '▶ Écouter';
  });
}

function setAudioVolume(val) {
  const audio = document.getElementById('au-audio');
  if (audio) audio.volume = parseFloat(val);
  const icon = document.getElementById('au-vol-icon');
  if (icon) icon.textContent = val == 0 ? '🔇' : parseFloat(val) < 0.5 ? '🔉' : '🔊';
}

function updateAudioDots() {
  const dots = document.getElementById('au-dots');
  if (!dots) return;
  dots.innerHTML = '';
  for (let i = 0; i < MAX_AU_GUESSES; i++) {
    const d = document.createElement('div');
    const g = auGuesses[i];
    d.className = 'au-dot ' + (!g ? 'au-dot-empty' : g.name === TARGET_AU.name ? 'au-dot-correct' : 'au-dot-wrong');
    dots.appendChild(d);
  }
}

function updateAudioStatus() {
  const el = document.getElementById('au-status');
  if (!el) return;
  if (auOver) {
    const won = auGuesses.some(g => g.name === TARGET_AU.name);
    el.textContent = won
      ? `🎉 Bravo ! C'était bien "${TARGET_AU.name}" — Opening ${TARGET_AU.id} !`
      : `💀 Perdu ! C'était "${TARGET_AU.name}" — Opening ${TARGET_AU.id} par ${TARGET_AU.artist}`;
    el.style.color = won ? 'var(--green-l)' : 'var(--red)';
  } else {
    const snippetIdx = Math.min(auGuesses.length, AUDIO_DURATIONS.length - 1);
    const dur  = AUDIO_DURATIONS[snippetIdx];
    const left = MAX_AU_GUESSES - auGuesses.length;
    el.textContent = `Essai ${auGuesses.length + 1}/${MAX_AU_GUESSES} — ${dur} seconde${dur > 1 ? 's' : ''} révélée${dur > 1 ? 's' : ''}`;
    el.style.color = '';
  }
}

function showAudioReveal() {
  document.getElementById('au-reveal-num').textContent    = TARGET_AU.id;
  document.getElementById('au-reveal-name').textContent   = TARGET_AU.name;
  document.getElementById('au-reveal-artist').textContent = 'par ' + TARGET_AU.artist;

  const wrap = document.getElementById('au-yt-wrap');
  wrap.innerHTML = '';

  const ytQuery = encodeURIComponent(`One Piece Opening ${TARGET_AU.id} ${TARGET_AU.name} ${TARGET_AU.artist}`);
  const ytSearchUrl = `https://www.youtube.com/results?search_query=${ytQuery}`;

  const safeYTId = validateYTId(TARGET_AU.yt || '');
  if (safeYTId) {
    // Iframe YouTube nocookie
    const iframe = document.createElement('iframe');
    iframe.className       = 'au-yt-iframe';
    iframe.src             = `https://www.youtube-nocookie.com/embed/${safeYTId}?rel=0&modestbranding=1`;
    iframe.allow           = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    iframe.allowFullscreen = true;
    iframe.loading         = 'lazy';
    iframe.title           = `${TARGET_AU.name} — One Piece Opening ${TARGET_AU.id}`;
    wrap.appendChild(iframe);

    // Lien de secours sous l'iframe (si erreur 153 ou autre)
    const link = document.createElement('a');
    link.className  = 'au-yt-link';
    link.href       = `https://www.youtube.com/watch?v=${safeYTId}`;
    link.target     = '_blank';
    link.rel        = 'noopener noreferrer';
    link.textContent = '▶ Regarder sur YouTube';
    wrap.appendChild(link);
  } else {
    // Pas d'ID connu → bouton recherche
    const btn = document.createElement('a');
    btn.className   = 'au-yt-btn';
    btn.href        = ytSearchUrl;
    btn.target      = '_blank';
    btn.rel         = 'noopener noreferrer';
    btn.textContent = '▶ Écouter sur YouTube';
    wrap.appendChild(btn);
  }
}

function submitAudio() {
  if (auOver) return;
  const raw = input.value.trim();
  const op  = resolveName(OPENINGS, raw);
  if (!op || auNames.has(op.name)) { shake(input); return; }
  auNames.add(op.name);
  auGuesses.push(op);
  saveState('audio');
  input.value = ''; acBox.classList.remove('open');
  const correct = op.name === TARGET_AU.name;
  renderAudioGuess(op, correct, true);
  updateCounter();
  updateAudioDots();
  updateAudioBarLabel();
  updateAudioStatus();
  if (correct) finAudio(true);
  else if (auGuesses.length >= MAX_AU_GUESSES) finAudio(false);
}

function renderAudioGuess(op, correct, prepend = true) {
  const row = document.createElement('div');
  row.className = 'wanted-guess-row';
  row.innerHTML = `<span class="wg-name">${esc(op.name)}</span><span class="wg-result ${correct ? 'correct' : 'wrong'}">${correct ? '✅ TROUVÉ !' : '❌ Raté'}</span>`;
  const container = document.getElementById('audio-guesses');
  if (prepend) container.prepend(row); else container.appendChild(row);
}

function finAudio(won) {
  auOver = true;
  if (!_restoring) sfx(won ? 'win' : 'lose');
  document.getElementById('guess-btn').disabled = true;
  input.disabled = true;
  updateAudioDots();
  updateAudioStatus();
  document.getElementById('au-reveal').classList.remove('hidden');
  showAudioReveal();
  updateAudioBarLabel();
  const btn = document.getElementById('au-play-btn');
  if (btn) btn.textContent = '▶ Réécouter';
  if (won) {
    document.getElementById('win-title').textContent     = WIN_TITLES['audio'];
    document.getElementById('win-char-name').textContent = TARGET_AU.name;
    document.getElementById('win-attempts').textContent  = auGuesses.length;
    document.getElementById('win-banner').classList.add('show');
    if (!_restoring) launchConfetti();
  } else {
    document.getElementById('lose-char-name').textContent = TARGET_AU.name;
    document.getElementById('lose-banner').classList.add('show');
  }
  onGameEnd('audio', won, auGuesses.length,
    won ? Math.max(0, 10000 - (auGuesses.length - 1) * SCORE_PENALTY_AUDIO) : 0,
    { opening: TARGET_AU.name, artist: TARGET_AU.artist });
}

// ===== MODE TOME (couverture zoomée → dézoom) =====
const MAX_TOME_GUESSES = 6;
const TOME_ZOOM_SCALES = [8, 5.3, 3.5, 2.3, 1.5, 1]; // du plus serré (gros plan) au dézoom complet
let tmGuesses = [], tmOver = false;                    // tmGuesses = numéros de tomes proposés
function tomeInputEl() { return document.getElementById('tome-input'); }
function tomeCoverSrc() { return `${ASSET_BASE}images/cover/Tome_${TARGET_TOME}.webp`; }

function initTomeMode() {
  const img = document.getElementById('tome-img');
  if (img && img.getAttribute('src') !== tomeCoverSrc()) {
    img.src = tomeCoverSrc();
    img.draggable = false;
    img.addEventListener('dragstart', e => e.preventDefault());
  }
  document.getElementById('tome-guesses').innerHTML = '';
  tmGuesses.forEach(n => renderTomeGuess(n, n === TARGET_TOME, false));
  updateTomeZoom();
  updateTomeHint();
  const ti = tomeInputEl(), tb = document.getElementById('tome-btn');
  if (ti) ti.disabled = tmOver;
  if (tb) tb.disabled = tmOver;
}

function updateTomeZoom() {
  const img = document.getElementById('tome-img');
  if (!img) return;
  const step = Math.min(tmGuesses.length, TOME_ZOOM_SCALES.length - 1);
  const s = tmOver ? 1 : TOME_ZOOM_SCALES[step];
  img.style.transformOrigin = `${TOME_ZOOM.x}% ${TOME_ZOOM.y}%`;
  img.style.transform = `scale(${s})`;
}

function updateTomeHint() {
  const el = document.getElementById('tome-hint');
  if (!el) return;
  if (tmOver) {
    const won = tmGuesses.includes(TARGET_TOME);
    el.textContent = won ? `🎉 C'était le Tome ${TARGET_TOME} !`
                         : `💀 Perdu ! C'était le Tome ${TARGET_TOME}.`;
    return;
  }
  const left = MAX_TOME_GUESSES - tmGuesses.length;
  const last = tmGuesses.length ? tmGuesses[tmGuesses.length - 1] : null;
  const dir  = last == null ? '' : (last < TARGET_TOME ? ' · 📈 plus haut' : ' · 📉 plus bas');
  el.textContent = `${left} essai${left > 1 ? 's' : ''} restant${left > 1 ? 's' : ''}${dir}`;
}

function renderTomeGuess(n, correct, fresh = true) {
  const cont = document.getElementById('tome-guesses');
  if (!cont) return;
  const row = document.createElement('div');
  row.className = 'tome-guess-row' + (fresh ? ' fresh' : '');
  const verdict = correct ? '✅ TROUVÉ !' : (n < TARGET_TOME ? '📈 Plus haut' : '📉 Plus bas');
  row.innerHTML = `<span class="tg-num">Tome ${n}</span><span class="tg-res ${correct ? 'correct' : 'wrong'}">${verdict}</span>`;
  cont.prepend(row);
}

function submitTome() {
  if (tmOver) return;
  const ti = tomeInputEl();
  const n  = parseInt((ti.value || '').trim(), 10);
  if (!n || n < 1 || n > 112 || tmGuesses.includes(n)) { shake(ti); return; }
  tmGuesses.push(n);
  saveState('tome');
  ti.value = '';
  const correct = n === TARGET_TOME;
  renderTomeGuess(n, correct);
  if (correct) {
    finTome(true);
  } else {
    updateTomeZoom();
    updateTomeHint();
    if (tmGuesses.length >= MAX_TOME_GUESSES) finTome(false);
  }
}

function finTome(won) {
  tmOver = true;
  if (!_restoring) sfx(won ? 'win' : 'lose');
  const ti = tomeInputEl(), tb = document.getElementById('tome-btn');
  if (ti) ti.disabled = true;
  if (tb) tb.disabled = true;
  updateTomeZoom();
  updateTomeHint();
  if (won) {
    document.getElementById('win-title').textContent     = WIN_TITLES['tome'];
    document.getElementById('win-char-name').textContent = `Tome ${TARGET_TOME}`;
    document.getElementById('win-attempts').textContent  = tmGuesses.length;
    document.getElementById('win-banner').classList.add('show');
    if (!_restoring) launchConfetti();
  } else {
    document.getElementById('lose-char-name').textContent = `Tome ${TARGET_TOME}`;
    document.getElementById('lose-banner').classList.add('show');
  }
  onGameEnd('tome', won, tmGuesses.length, won ? calcModeScore('tome', tmGuesses.length, false, 0) : 0);
}

// ===== SYSTÈME DE SCORE =====
const SCORE_MAX_TOTAL = 70000;   // 7 modes × 10 000
const SCORE_PENALTIES = { classic: 1000, wanted: 1250, fruit: 1000, emoji: 1250, tome: 1800, silhouette: 1100 };

function round50(n) { return Math.round(n / 50) * 50; }

function calcModeScore(mode, tries, hintUsed, hintsCount) {
  let base = Math.max(0, 10000 - (tries - 1) * SCORE_PENALTIES[mode]);
  if (mode === 'classic'    && hintUsed)   base = round50(base / 2);
  if (mode === 'silhouette' && hintUsed)   base = round50(base / 2);   // indice couleur
  if (mode === 'fruit'      && hintsCount) base = round50(base / Math.pow(1.5, hintsCount));
  if (mode === 'emoji'      && hintsCount) base = round50(base / 1.5);
  return base;
}

// ===== SAUVEGARDE / RESTAURATION DE L'ÉTAT DE JEU =====
function saveState(mode) {
  const dk = todayKey();
  // Le nom de la cible est inclus pour détecter un changement de hash en cours de journée
  if (mode === 'classic') lsSet(LS.gs('classic', dk), JSON.stringify({ guesses: cGuesses.map(c => c.name), hintUsed, target: TARGET_C.name }));
  if (mode === 'wanted')  lsSet(LS.gs('wanted',  dk), JSON.stringify({ guesses: wGuesses.map(c => c.name), target: TARGET_W.name }));
  if (mode === 'silhouette') lsSet(LS.gs('silhouette', dk), JSON.stringify({ guesses: silGuesses.map(c => c.name), hintUsed: silHintUsed, hintFocus: silHintFocus, target: TARGET_SIL.name }));
  if (mode === 'fruit')   lsSet(LS.gs('fruit',   dk), JSON.stringify({ guesses: frGuesses.map(f => f.name), hints: [...frHintsRevealed], target: TARGET_FRU.name }));
  if (mode === 'emoji')   lsSet(LS.gs('emoji',   dk), JSON.stringify({ guesses: emGuesses.map(c => c.name), hintRevealed: emHintRevealed, target: TARGET_EM.name }));
  if (mode === 'audio')   lsSet(LS.gs('audio',   dk), JSON.stringify({ guesses: auGuesses.map(o => o.name), target: TARGET_AU.name }));
  if (mode === 'tome')    lsSet(LS.gs('tome',    dk), JSON.stringify({ guesses: tmGuesses, target: TARGET_TOME }));
}

// Valide qu'un nom restauré depuis le localStorage est une chaîne de taille raisonnable
function validName(n) { return typeof n === 'string' && n.length > 0 && n.length <= 120; }

function restoreAllStates() {
  const dk = todayKey();
  _restoring = true;

  // Classic
  const sc = safeParseJSON(lsGet(LS.gs('classic', dk)), null);
  if (sc && Array.isArray(sc.guesses) && (!sc.target || sc.target === TARGET_C.name)) {
    hintUsed = !!sc.hintUsed;
    sc.guesses.filter(validName).forEach(name => { input.value = name; submitClassic(); });
  }

  // Wanted
  const sw = safeParseJSON(lsGet(LS.gs('wanted', dk)), null);
  if (sw && Array.isArray(sw.guesses) && (!sw.target || sw.target === TARGET_W.name)) {
    sw.guesses.filter(validName).forEach(name => { input.value = name; submitWanted(); });
  }

  // Silhouette
  const ssil = safeParseJSON(lsGet(LS.gs('silhouette', dk)), null);
  if (ssil && Array.isArray(ssil.guesses) && TARGET_SIL && (!ssil.target || ssil.target === TARGET_SIL.name)) {
    ssil.guesses.filter(validName).forEach(name => { input.value = name; submitSilhouette(); });
    if (ssil.hintUsed) { silHintUsed = true; silHintFocus = ssil.hintFocus || silHintFocus; applySilHintReveal(); updateSilStatus(); }
  }

  // Fruit
  const sfr = safeParseJSON(lsGet(LS.gs('fruit', dk)), null);
  if (sfr && Array.isArray(sfr.guesses) && (!sfr.target || sfr.target === TARGET_FRU.name)) {
    (Array.isArray(sfr.hints) ? sfr.hints : []).forEach(i => frHintsRevealed.add(i));
    sfr.guesses.filter(validName).forEach(name => { input.value = name; submitFruit(); });
  }

  // Emoji — doit attendre que emTarget soit initialisé
  const sem = safeParseJSON(lsGet(LS.gs('emoji', dk)), null);
  if (sem && Array.isArray(sem.guesses) && (!sem.target || sem.target === TARGET_EM.name)) {
    if (!emTarget) {
      emTarget = TARGET_EM;
      emShuffledEmoji = seededShuffle(emTarget.emoji, buildEmojiSeed());
    }
    sem.guesses.filter(validName).forEach(name => { input.value = name; submitEmoji(); });
    if (sem.hintRevealed) emHintRevealed = true;
  }

  // Audio
  const sau = safeParseJSON(lsGet(LS.gs('audio', dk)), null);
  if (sau && Array.isArray(sau.guesses) && (!sau.target || sau.target === TARGET_AU.name)) {
    sau.guesses.filter(validName).forEach(name => { input.value = name; submitAudio(); });
  }

  // Tome
  const stm = safeParseJSON(lsGet(LS.gs('tome', dk)), null);
  if (stm && Array.isArray(stm.guesses) && (stm.target == null || stm.target === TARGET_TOME)) {
    const ti = tomeInputEl();
    if (ti) { stm.guesses.forEach(n => { ti.value = String(n); submitTome(); }); ti.value = ''; }
  }

  _restoring = false;
  input.value = '';
}

function saveModeScore(mode, pts) {
  const key    = LS.score(todayKey());
  const scores = safeParseJSON(lsGet(key), {});
  scores[mode] = pts;
  lsSet(key, JSON.stringify(scores));
  updateScoreBar();
}

function saveModeResult(mode, won, tries, extra) {
  const key     = LS.result(todayKey());
  const results = safeParseJSON(lsGet(key), {});
  if (results[mode]) return; // déjà enregistré
  results[mode] = { won: won, tries: tries, ...extra };
  lsSet(key, JSON.stringify(results));
}

// Fin de partie des 7 modes quotidiens — point d'ancrage unique.
// Toute nouvelle réaction à "partie terminée" (rang pirate, animation de
// victoire, stats communauté…) se branche ICI plutôt que dans chaque finXxx().
// ── B — Carnet de capture : nom du perso-cible d'un mode (null si non pertinent) ──
function captureTargetName(mode) {
  try {
    const t = mode === 'classic' ? TARGET_C
            : mode === 'wanted'  ? TARGET_W
            : mode === 'fruit'   ? { name: TARGET_FRU.holder }
            : mode === 'emoji'   ? emTarget
            : mode === 'audio'   ? TARGET_AU
            : mode === 'inf'     ? infTarget
            : TARGET_SIL;
    return (t && t.name) ? t.name : null;
  } catch (e) { return null; }
}
function markCaptured(mode) {
  const name = captureTargetName(mode);
  if (!name || !CHARACTERS.some(c => c.name === name)) return;  // uniquement de vrais persos
  const list = safeParseJSON(lsGet(LS.captured), []);
  if (!list.includes(name)) { list.push(name); lsSet(LS.captured, JSON.stringify(list)); }
}

function onGameEnd(mode, won, tries, score, extra) {
  if (_restoring) return;
  recordResult(mode, won, tries);
  saveModeResult(mode, won, tries, extra);
  // Écriture stats communauté, PUIS rafraîchissement du compteur une fois les écritures
  // prises en compte (sinon on relit daily-stats avant que la victoire du joueur y figure).
  const _dk = todayKey();
  const _statWrites = [fbIncrement(`daily-stats/${_dk}/${mode}/total`)];
  if (won) {
    _statWrites.push(fbIncrement(`daily-stats/${_dk}/${mode}/wins`));
    if (tries > 0) _statWrites.push(fbIncrementBy(`daily-stats/${_dk}/${mode}/tries_sum`, tries));
  }
  // compteur public (navigation + gagnants/essais moyens), rafraîchi après les écritures
  Promise.allSettled(_statWrites).then(() => incrementDailyCounter(mode));
  if (won) {
    saveModeScore(mode, score);
    const prev = sanitizeNum(lsGet(LS.cumulativeScore));
    const cumul = prev + score;
    lsSet(LS.cumulativeScore, cumul);
    lsSet(LS.pirateRank, getRankFromScore(cumul).title);
    updateRankBadge();
    markCaptured(mode);                                              // B — carnet de capture
    if (typeof reportIslandsReached === 'function') reportIslandsReached(cumul); // E — compteur communauté
    playWinAnimation(mode);
  } else {
    updateScoreBar();
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
  // N'ouvre les stats automatiquement QUE lorsque TOUS les modes du jour sont terminés
  // (sinon la modale s'ouvre après chaque mode et casse l'enchaînement).
  const _res = safeParseJSON(lsGet(LS.result(todayKey())), {});
  if (MODE_IDS.every(m => _res[m])) setTimeout(() => showStats(mode), 900);
}

let _shareText = '';

function buildShareText() {
  const dk      = todayKey();
  const scores  = safeParseJSON(lsGet(LS.score(dk)),  {});
  const results = safeParseJSON(lsGet(LS.result(dk)), {});
  const total   = Object.values(scores).reduce((a, b) => a + sanitizeNum(b), 0);

  const [y, m, d] = dk.split('-');
  let lines = [`LogPose · ${d}/${m}`, ''];

  MODES.forEach(({ id, icon }) => {
    const res = results[id];
    const pts = sanitizeNum(scores[id]);
    if (!res) {
      lines.push(`${icon} —`);
    } else if (res.won) {
      const essai = res.tries > 1 ? 'essais' : 'essai';
      lines.push(`${icon} ✅ ${res.tries} ${essai} · ${pts.toLocaleString('fr-FR')} pts`);
    } else {
      lines.push(`${icon} ❌ · 0 pts`);
    }
  });

  // Mention anniversaire si un perso fête son anniv aujourd'hui
  const bdays = getTodayBirthdays();
  if (bdays.length) {
    const names = bdays.map(c => c.name).join(' & ');
    lines.push(`🎂 Anniversaire de ${names} !`);
  }
  lines.push('');
  lines.push(`⭐ ${total.toLocaleString('fr-FR')} / 70 000 pts`);
  const cumul = sanitizeNum(lsGet(LS.cumulativeScore));
  if (cumul > 0) {
    const { title: rankTitle } = getRankFromScore(cumul);
    const streak = sanitizeNum(loadStats('classic').currentStreak);
    lines.push(`⚔️ ${rankTitle} · Série ${streak}j · ${cumul.toLocaleString('fr-FR')} pts cumulés`);
  }
  lines.push('https://onepiecedle.fr');
  return lines.join('\n');
}

function shareDaily() {
  _shareText = buildShareText();
  document.getElementById('share-popup-preview').textContent = _shareText;
  document.getElementById('share-popup').classList.remove('hidden');
}

function closeSharePopup() {
  document.getElementById('share-popup').classList.add('hidden');
  if (typeof hideCanvasPreview === 'function') hideCanvasPreview();
}

function handleShareOverlayClick(e) {
  if (e.target === document.getElementById('share-popup')) closeSharePopup();
}

// ===== À PROPOS =====
function openAbout() {
  document.getElementById('about-modal').classList.remove('hidden');
}
function closeAbout() {
  document.getElementById('about-modal').classList.add('hidden');
}
function handleAboutOverlayClick(e) {
  if (e.target === document.getElementById('about-modal')) closeAbout();
}

// ===== POP-UP "GAZETTE · MODE VERSUS 1V1 (v6.0)" (Une de gazette · affichée une seule fois) =====
function maybeShowWhatsNew() {
  if (lsGet(LS.wnVersusSeen)) return;  // déjà vue → on ne montre plus
  showWhatsNew();
}
function _wnEsc(e) { if (e.key === 'Escape') closeWhatsNew(); }
function closeWhatsNew() {
  lsSet(LS.wnVersusSeen, '1');
  const ov = document.getElementById('whatsnew-overlay');
  if (ov) ov.remove();
  document.removeEventListener('keydown', _wnEsc);
}
function showWhatsNew() {
  if (document.getElementById('whatsnew-overlay')) return;
  const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const ov = document.createElement('div');
  ov.id = 'whatsnew-overlay';
  ov.className = 'wn-overlay';
  ov.setAttribute('role', 'dialog');
  ov.setAttribute('aria-modal', 'true');
  ov.setAttribute('aria-label', 'Nouveautés LogPose v6.0 — mode Versus 1v1');
  ov.innerHTML =
      '<div class="wn-gazette" role="document">'
    +   '<button class="wn-close" type="button" aria-label="Fermer">×</button>'
    +   '<div class="wn-frame">'
    +     '<div class="wn-masthead">'
    +       '<div class="wn-paper-name"><span class="wn-orn">☠</span>La Gazette du Log Pose<span class="wn-orn">☠</span></div>'
    +       '<div class="wn-tagline">« Toutes les nouvelles de Grand Line »</div>'
    +     '</div>'
    +     '<div class="wn-dateline"><span>Édition spéciale · v6.0</span><span>' + esc(today) + '</span></div>'
    +     '<div class="wn-kicker">— Deux navires se rangent bord à bord —</div>'
    +     '<h2 class="wn-headline">Le mode Versus 1v1 <span class="wn-headline-ico"><svg class="ic" aria-hidden="true"><use href="#ic-versus"></use></svg></span></h2>'
    +     '<p class="wn-lede">Défie un ami en duel, au tour par tour&nbsp;: crée un salon, partage ton code à 5 lettres, et devinez le même personnage mystère — le premier qui le trouve remporte la manche.</p>'
    +     '<div class="wn-fleuron">✦ ✦ ✦</div>'
    +     '<div class="wn-cols">'
    +       '<div class="wn-col"><div class="wn-col-ico"><svg class="ic" aria-hidden="true"><use href="#ic-versus"></use></svg></div><div class="wn-col-h">Bo1, Bo3 ou Bo5</div><div class="wn-col-p">Chacun choisit le mode de sa manche — Classique, Wanted, Silhouette, Fruit, Émoji ou Tome — et la manche décisive est tirée au sort.</div></div>'
    +       '<div class="wn-col"><div class="wn-col-ico"><svg class="ic" aria-hidden="true"><use href="#ic-hourglass"></use></svg></div><div class="wn-col-h">Au tour par tour</div><div class="wn-col-p">30, 60 ou 120 secondes par tour (ou sans limite). Les indices se dévoilent à chaque erreur… pour les deux équipages.</div></div>'
    +       '<div class="wn-col"><div class="wn-col-ico"><svg class="ic" aria-hidden="true"><use href="#ic-chart"></use></svg></div><div class="wn-col-h">Bilan de duels</div><div class="wn-col-p">Victoires, défaites et taux de victoire rejoignent tes statistiques — et la revanche est à un clic.</div></div>'
    +     '</div>'
    +     '<div class="wn-fleuron">✦ ✦ ✦</div>'
    +     '<p class="wn-brief">Rendez-vous dans l\'onglet Versus, juste à droite du mode Infini.</p>'
    +     '<div class="wn-cta-wrap"><button class="wn-cta" type="button">Croiser le fer ⚔</button></div>'
    +   '</div>'
    + '</div>';
  ov.addEventListener('click', e => { if (e.target === ov) closeWhatsNew(); });
  ov.querySelector('.wn-close').addEventListener('click', closeWhatsNew);
  ov.querySelector('.wn-cta').addEventListener('click', () => { closeWhatsNew(); location.href = 'versus.html'; });
  document.body.appendChild(ov);
  document.addEventListener('keydown', _wnEsc);
  const cta = ov.querySelector('.wn-cta');
  if (cta) cta.focus();
}

// ===== EXPORT / IMPORT DE LA SAUVEGARDE (clés "op-" uniquement · 100% local, sans serveur) =====
function exportSave() {
  try {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('op-')) data[k] = localStorage.getItem(k);
    }
    const d = parisNow();
    const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `logpose-save-${stamp}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    alert('Échec de l\'export de la sauvegarde.');
  }
}

function importSavePrompt() {
  const inp = document.getElementById('import-save-input');
  if (inp) { inp.value = ''; inp.click(); }   // reset → permet de réimporter le même fichier
}

function importSaveFile(event) {
  const file = event.target && event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onerror = () => alert('Impossible de lire le fichier.');
  reader.onload = () => {
    let obj;
    try { obj = JSON.parse(reader.result); }
    catch (e) { alert('Fichier invalide : ce n\'est pas une sauvegarde LogPose lisible.'); return; }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      alert('Fichier invalide : format inattendu.'); return;
    }
    // On ne retient QUE les clés "op-" à valeur texte (on ignore tout le reste du fichier)
    const entries = Object.entries(obj).filter(([k, v]) => k.startsWith('op-') && typeof v === 'string');
    if (!entries.length) {
      alert('Aucune donnée LogPose (clés « op- ») trouvée dans ce fichier.'); return;
    }
    if (!confirm(`Importer cette sauvegarde ? Cela remplacera ta progression actuelle (${entries.length} entrée${entries.length > 1 ? 's' : ''}).`)) return;
    try {
      // On ne touche QU'AUX clés "op-" : on retire les anciennes, puis on pose celles du fichier
      Object.keys(localStorage).filter(k => k.startsWith('op-')).forEach(k => localStorage.removeItem(k));
      entries.forEach(([k, v]) => localStorage.setItem(k, v));
    } catch (e) {
      alert('Échec de l\'import (stockage plein ?).'); return;
    }
    location.reload();
  };
  reader.readAsText(file);
}

// ===== NOTES DE VERSION (changelog accessible à tout moment) =====
// Plus récent en premier. Ajouter une entrée { v, date, items[] } à chaque release.
const CHANGELOG = [
  { v: '6.0', date: 'Juillet 2026', items: [
    '⚔️ Nouveau mode Versus 1v1 — défie un ami en duel au tour par tour (salon privé, code à partager)',
    '🎲 Bo1 / Bo3 / Bo5 : chacun choisit le mode de sa manche parmi 6, la manche décisive est tirée au sort',
    '📊 Bilan de duels (victoires, défaites, % de victoire) dans tes statistiques',
    '🚀 Images, silhouettes et openings servis par un serveur dédié — chargements plus rapides',
  ] },
  { v: '5.2', date: 'Juillet 2026', items: [
    '👤 Nouveau mode Silhouette — devine le pirate à son ombre (remplace Pavillon)',
    '🎨 Indice couleur à mi-partie + révélation en couleur en fin de partie',
  ] },
  { v: '5.1', date: 'Juin 2026', items: [
    '🌊 Refonte visuelle « nuit en mer » : fond 3D océan & île',
    '🧭 Nouvelle page d\'accueil en rose des vents',
    '🎨 Icônes du jeu redessinées + couleur de signature par mode',
    '➕ 2 nouveaux Chevaliers Divins : Shamrock & Gunko (246 persos)',
  ] },
  { v: '5.0', date: 'Juin 2026', items: [
    '📕 Nouveau mode Tome — devine le tome à sa couverture',
    '🗺️ Carte de Grand Line : 32 îles, carnet de capture & fiches perso',
    '🏴‍☠️ Rang de pirate + Jolly Roger personnel généré',
    '🖼️ Image de partage récap (avec ton pavillon)',
    '🎂 Anniversaires des personnages · 📊 stats de la communauté',
    '💾 Export / import de ta sauvegarde',
    '➕ 11 nouveaux personnages (244 au total)',
  ] },
  { v: '4.7', date: 'Mai 2026', items: [
    '😀 Grand audit des émojis (60 personnages)',
    '⚡ Popup de fin de partie accélérée',
  ] },
];

function _pnEsc(e) { if (e.key === 'Escape') closePatchNotes(); }
function closePatchNotes() {
  const o = document.getElementById('patchnotes-overlay');
  if (o) o.remove();
  document.removeEventListener('keydown', _pnEsc);
}
function showPatchNotes() {
  if (document.getElementById('patchnotes-overlay')) return;
  const entries = CHANGELOG.map(e =>
      '<div class="pn-entry">'
    +   `<div class="pn-ver">v${esc(e.v)}<span class="pn-date"> · ${esc(e.date)}</span></div>`
    +   `<ul class="pn-items">${e.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`
    + '</div>'
  ).join('');
  const ov = document.createElement('div');
  ov.id = 'patchnotes-overlay';
  ov.className = 'modal-overlay';
  ov.setAttribute('role', 'dialog');
  ov.setAttribute('aria-modal', 'true');
  ov.setAttribute('aria-label', 'Notes de version');
  ov.innerHTML =
      '<div class="modal-box pn-box">'
    +   '<button class="modal-close" type="button" aria-label="Fermer" onclick="closePatchNotes()">×</button>'
    +   '<div class="modal-title">📜 Notes de version</div>'
    +   `<div class="pn-list">${entries}</div>`
    + '</div>';
  ov.addEventListener('click', e => { if (e.target === ov) closePatchNotes(); });
  document.body.appendChild(ov);
  document.addEventListener('keydown', _pnEsc);
}

function shareVia(platform) {
  if (platform === 'copy') {
    const btn = document.querySelector('.share-via-copy');
    const done = () => {
      if (btn) { btn.textContent = '✅ Copié !'; setTimeout(() => { btn.textContent = '📋 Copier'; }, 2200); }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(_shareText).then(done).catch(() => fallbackCopy(_shareText, done));
    } else {
      fallbackCopy(_shareText, done);
    }
    return;
  }
  if (platform === 'discord') {
    // Mobile : Web Share API (ouvre Discord natif avec le texte)
    if (navigator.share) {
      navigator.share({ text: _shareText }).catch(() => {});
      return;
    }
    // Desktop : copie le texte puis ouvre Discord web — l'utilisateur n'a qu'à coller
    const btn = document.querySelector('.share-via-discord');
    const done = () => {
      if (btn) { btn.textContent = '✅ Copié !'; setTimeout(() => { btn.textContent = '💬 Discord'; }, 2200); }
      window.open('https://discord.com/channels/@me', '_blank', 'noopener,noreferrer');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(_shareText).then(done).catch(() => fallbackCopy(_shareText, done));
    } else {
      fallbackCopy(_shareText, done);
    }
    return;
  }

  const enc = encodeURIComponent(_shareText);
  const urls = {
    twitter:  `https://twitter.com/intent/tweet?text=${enc}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fonepiecedle.fr%2F&quote=${enc}`,
    bluesky:  `https://bsky.app/intent/compose?text=${enc}`,
  };
  if (urls[platform]) window.open(urls[platform], '_blank', 'noopener,noreferrer,width=600,height=520');
}

function fallbackCopy(text, cb) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;';
  document.body.appendChild(ta);
  ta.focus(); ta.select();
  try { document.execCommand('copy'); } catch(e) {}
  document.body.removeChild(ta);
  if (cb) cb();
}

function getTotalScore() {
  const scores = safeParseJSON(lsGet(LS.score(todayKey())), {});
  return Object.values(scores).reduce((a, b) => a + sanitizeNum(b), 0);
}

function updateTabDoneStates() {
  const results = safeParseJSON(lsGet(LS.result(todayKey())), {});
  MODE_IDS.forEach(mode => {
    const tab = document.getElementById('tab-' + mode);
    if (!tab) return;
    const res = results[mode];
    tab.classList.toggle('tab-done', !!(res && res.won));
    tab.classList.toggle('tab-lost', !!(res && res.won === false));
  });
}

function toggleScoreBreakdown(e) {
  if (e) e.stopPropagation();
  const el = document.getElementById('score-breakdown');
  if (!el) return;
  const isHidden = el.classList.contains('hidden');
  if (isHidden) {
    const scores  = safeParseJSON(lsGet(LS.score(todayKey())),  {});
    const results = safeParseJSON(lsGet(LS.result(todayKey())), {});
    // Libellés courts spécifiques à la pastille compacte (≠ registre global).
    const rows = [
      { key:'classic', icon:'🗺️',  label:'Classique' },
      { key:'wanted',  icon:'🖼️', label:'Wanted'    },
      { key:'silhouette', icon:'🕵️', label:'Silhouette' },
      { key:'fruit',   icon:'🍎',  label:'Fruit'     },
      { key:'emoji',   icon:'😀',  label:'Émoji'     },
      { key:'audio',   icon:'🎵',  label:'Opening'   },
    ];
    let html = '';
    rows.forEach(({ key, icon, label }) => {
      const pts    = Object.prototype.hasOwnProperty.call(scores, key) ? sanitizeNum(scores[key]) : undefined;
      const res    = results[key];
      const status = !res ? 'sb-pending' : res.won ? 'sb-won' : 'sb-lost';
      const valStr = pts !== undefined ? pts.toLocaleString('fr-FR') + ' pts' : '—';
      html += `<div class="sb-row ${status}"><span>${icon} ${label}</span><span>${valStr}</span></div>`;
    });
    const total = Object.values(scores).reduce((a, b) => a + sanitizeNum(b), 0);
    html += `<div class="sb-divider"></div><div class="sb-row sb-total"><span>⭐ Total</span><span>${total.toLocaleString('fr-FR')} pts</span></div>`;
    el.innerHTML = html;
    // Position fixe sous la barre de score
    const track = document.getElementById('score-track');
    const rect  = track.getBoundingClientRect();
    el.style.top  = (rect.bottom + 10) + 'px';
    el.style.left = (rect.left + rect.width / 2) + 'px';
    el.style.transform = 'translateX(-50%)';
    el.classList.remove('hidden');
    setTimeout(() => document.addEventListener('click', closeScoreBreakdown, { once: true }), 10);
  } else {
    el.classList.add('hidden');
  }
}

function closeScoreBreakdown() {
  const el = document.getElementById('score-breakdown');
  if (el) el.classList.add('hidden');
}

function updateScoreBar() {
  const total    = getTotalScore();
  const pct      = Math.min(100, (total / SCORE_MAX_TOTAL) * 100);
  const fill     = document.getElementById('score-fill');
  const label    = document.getElementById('score-total');
  const shareBtn = document.getElementById('share-daily-btn');
  if (fill)  fill.style.width = pct + '%';
  if (label) label.textContent = total.toLocaleString('fr-FR');
  if (shareBtn) {
    const results = safeParseJSON(lsGet(LS.result(todayKey())), {});
    shareBtn.classList.toggle('hidden', Object.keys(results).length === 0);
  }
  // Célébration 50 000 pts
  if (total >= SCORE_MAX_TOTAL && !lsGet(LS.perfect(todayKey()))) {
    lsSet(LS.perfect(todayKey()), '1');
    setTimeout(launchPerfectDay, 800);
  }
  updateStreakDisplay();
  updateTabDoneStates();
}

function updateStreakDisplay() {
  const el = document.getElementById('streak-bar');
  if (!el) return;
  const stats = loadStats('classic');
  const s = stats.currentStreak;
  if (s <= 1) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  el.textContent = `🔥 Série Classique · ${s} jours consécutifs · Record : ${stats.maxStreak}`;
}

function launchPerfectDay() {
  // Overlay
  const overlay = document.createElement('div');
  overlay.className = 'perfect-overlay';
  overlay.innerHTML = `
    <canvas class="perfect-canvas" id="perfect-canvas"></canvas>
    <div class="perfect-content">
      <div class="perfect-emoji">🏴‍☠️</div>
      <div class="perfect-sub">70 000 / 70 000 pts</div>
      <div class="perfect-sub2">Tu as réussi tous les défis du jour !</div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Particules dorées sur canvas
  const canvas = document.getElementById('perfect-canvas');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');

  const COLORS = ['#ffd84d','#c89408','#fff','#f5a623','#ffe066','#ffb300'];
  const pieces = Array.from({ length: 200 }, () => ({
    x:     Math.random() * canvas.width,
    y:     Math.random() * -canvas.height * 0.6,
    r:     2 + Math.random() * 7,
    speed: 2 + Math.random() * 4,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    angle: Math.random() * Math.PI * 2,
    spin:  (Math.random() - 0.5) * 0.18,
    drift: (Math.random() - 0.5) * 1.5,
    shape: Math.random() < 0.6 ? 'rect' : 'circle',
    glow:  Math.random() < 0.3,
  }));

  const FRAMES = 280;
  let frame = 0;

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const fade = frame < FRAMES * 0.6 ? 1 : 1 - (frame - FRAMES * 0.6) / (FRAMES * 0.4);
    ctx.globalAlpha = Math.max(0, fade);
    pieces.forEach(p => {
      p.y     += p.speed;
      p.x     += p.drift;
      p.angle += p.spin;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      if (p.glow) ctx.shadowColor = p.color, ctx.shadowBlur = 10;
      ctx.fillStyle = p.color;
      if (p.shape === 'rect') ctx.fillRect(-p.r, -p.r * 0.45, p.r * 2, p.r * 0.9);
      else { ctx.beginPath(); ctx.arc(0, 0, p.r * 0.6, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
      if (p.y > canvas.height) { p.y = -20; p.x = Math.random() * canvas.width; }
    });
    frame++;
    if (frame < FRAMES) requestAnimationFrame(draw);
    else {
      overlay.classList.add('perfect-fade-out');
      setTimeout(() => overlay.remove(), 600);
    }
  }
  draw();

  // Clic pour fermer
  overlay.addEventListener('click', () => {
    overlay.classList.add('perfect-fade-out');
    setTimeout(() => overlay.remove(), 600);
  });
}

// (updateScoreBar et restoreAllStates sont appelés dans initGame ci-dessous)

// ===== COMPTE À REBOURS =====
function startCountdown() {
  const el = document.getElementById('next-puzzle-timer');
  if (!el) return;
  function tick() {
    try {
      const paris    = parisNow();
      const midnight = new Date(paris);
      midnight.setHours(24, 0, 0, 0);
      const diff = midnight - paris;
      if (!Number.isFinite(diff) || diff < 0) return;
      const h = String(Math.floor(diff / 3600000)).padStart(2, '0');
      const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
      const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
      el.textContent = `${h}:${m}:${s}`;
    } catch(e) {}
  }
  tick();
  setInterval(tick, 1000);
}
// (startCountdown est appelé dans initGame ci-dessous)

// ===== CONFETTIS =====
function launchConfetti(variant) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  // Palette anniversaire : rose/violet/doré + emojis 🎂🎉🎈
  const COLORS = variant === 'birthday'
    ? ['#ff69b4','#ff1493','#c878f0','#ffd84d','#ff8c42','#ffffff','#da70d6']
    : ['#e8c030','#20b858','#e04040','#4a9ff5','#ff8c42','#c878f0','#ffffff'];
  const pieces = Array.from({ length: 130 }, () => ({
    x:         Math.random() * canvas.width,
    y:         Math.random() * -canvas.height * 0.5,
    r:         3 + Math.random() * 6,
    speed:     2.5 + Math.random() * 3.5,
    color:     COLORS[Math.floor(Math.random() * COLORS.length)],
    angle:     Math.random() * Math.PI * 2,
    spin:      (Math.random() - 0.5) * 0.14,
    drift:     (Math.random() - 0.5) * 1.2,
    shape:     Math.random() < 0.5 ? 'rect' : 'circle',
  }));

  const FRAMES = 200;
  let frame = 0;

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const fade = frame < FRAMES * 0.65 ? 1 : 1 - (frame - FRAMES * 0.65) / (FRAMES * 0.35);
    ctx.globalAlpha = Math.max(0, fade);

    pieces.forEach(p => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      if (p.shape === 'rect') {
        ctx.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.r * 0.65, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      p.y     += p.speed;
      p.x     += p.drift;
      p.angle += p.spin;
      if (p.y > canvas.height + 20) {
        p.y = -10;
        p.x = Math.random() * canvas.width;
      }
    });

    ctx.globalAlpha = 1;
    frame++;
    if (frame < FRAMES) requestAnimationFrame(draw);
    else canvas.remove();
  }
  requestAnimationFrame(draw);
}

// (loadDailyCounter est appelé dans initGame ci-dessous)

// ===== EASTER EGG KONAMI =====
(function () {
  const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
  let kIdx = 0;
  document.addEventListener('keydown', e => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === KONAMI[kIdx]) {
      kIdx++;
      if (kIdx === KONAMI.length) { kIdx = 0; openKonami(); }
    } else {
      kIdx = (k === KONAMI[0]) ? 1 : 0;
    }
  }, true);
})();

function openKonami() {
  const audio = document.getElementById('konami-audio');
  const player = document.getElementById('konami-player');
  audio.volume = 0.6;
  audio.currentTime = 0;
  audio.play();
  document.getElementById('konami-play-btn').textContent = '⏸';
  player.classList.remove('hidden');
}

function toggleKonamiAudio() {
  const audio = document.getElementById('konami-audio');
  const btn = document.getElementById('konami-play-btn');
  if (audio.paused) { audio.play(); btn.textContent = '⏸'; }
  else              { audio.pause(); btn.textContent = '▶'; }
}

function stopKonamiAudio() {
  const audio = document.getElementById('konami-audio');
  audio.pause();
  audio.currentTime = 0;
  document.getElementById('konami-player').classList.add('hidden');
}


// ===== MICRO-ANIMATIONS VICTOIRE (P3) =====
function playWinAnimation(mode) {
  const fns = {
    classic: playWinClassic,
    wanted:  playWinWanted,
    silhouette: playWinSilhouette,
    fruit:   playWinFruit,
    emoji:   playWinEmoji,
    audio:   playWinAudio,
  };
  fns[mode]?.();
}

function playWinClassic() {
  const img  = document.getElementById('classic-reveal-img');
  const name = document.getElementById('classic-reveal-name');
  if (img)  img.classList.add('anim-reveal-classic');
  if (name) name.classList.add('anim-typewriter');
}

function playWinWanted() {
  const box = document.querySelector('.poster-aspect-box');
  if (!box || box.querySelector('#win-stamp')) return;
  const stamp = document.createElement('div');
  stamp.id = 'win-stamp';
  stamp.className = 'anim-stamp';
  stamp.textContent = 'TROUVÉ !';
  box.appendChild(stamp);
}

function playWinSilhouette() {
  // Payoff : la silhouette laisse place au personnage en couleur.
  const sec = document.getElementById('silhouette-section');
  const col = document.getElementById('sil-color');
  if (col) col.style.clipPath = 'none';
  if (sec) sec.classList.add('sil-hinted', 'sil-won');
}

function playWinFruit() {
  const img = document.getElementById('fruit-reveal-img');
  if (!img) return;
  img.classList.add('anim-reveal-fruit');
  const typeMap = {
    Logia:     'aura-logia',
    Zoan:      'aura-zoan',
    Paramecia: 'aura-paramecia',
    Mythique:  'aura-mythique',
  };
  const aura = typeMap[TARGET_FRU?.type];
  if (aura) img.classList.add(aura);
}

function playWinEmoji() {
  const boxes = document.querySelectorAll('#emoji-strip .emoji-box.revealed');
  boxes.forEach((box, i) => {
    box.style.animationDelay = `${i * 60}ms`;
    box.classList.add('anim-jump');
  });
  const reveal = document.getElementById('emoji-reveal');
  if (reveal) {
    reveal.style.animationDelay = `${boxes.length * 60}ms`;
    reveal.classList.add('anim-pop');
  }
}

function playWinAudio() {
  const reveal = document.getElementById('au-reveal');
  if (reveal) reveal.classList.add('anim-reveal-audio');
  const num = document.getElementById('au-reveal-num');
  if (num) num.classList.add('anim-num-big');
}

// ===== INIT ASYNCHRONE =====
// Attend le chargement de data.json avant d'initialiser le jeu
(async function initGame() {
  try {
    await loadGameData();
  } catch(e) {
    console.error('LogPose — échec du chargement des données :', e);
    document.body.insertAdjacentHTML('afterbegin',
      '<div style="padding:1rem;background:#c82020;color:#fff;text-align:center;font-family:sans-serif">' +
      '⚠️ Erreur de chargement — rechargez la page ou vérifiez votre connexion.</div>');
    return;
  }
  saveTodayTargets();
  buildYesterdayBar();
  loadYesterdayStats(); // fire-and-forget, remplit #yesterday-community quand Firebase répond
  // Badge anniversaire
  (function() {
    const bdays = getTodayBirthdays();
    const el = document.getElementById('birthday-badge');
    if (!el || !bdays.length) return;
    const names = bdays.map(c => c.name).join(' & ');
    el.textContent = `🎂 ${names}`;
    el.hidden = false;
  })();
  try { updateScoreBar();    } catch(e) { console.warn('updateScoreBar init:', e); }
  try { updateRankBadge();   } catch(e) { console.warn('updateRankBadge init:', e); }
  try { restoreAllStates();  } catch(e) { console.warn('restoreAllStates init:', e); }
  startCountdown();
  updateCounter();
  initSilhouetteMode();
  loadDailyCounter('classic');
  try { maybeShowWhatsNew(); } catch(e) { console.warn('whatsNew init:', e); }
})();


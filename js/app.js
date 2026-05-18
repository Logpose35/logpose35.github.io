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
    const url = `${FB_URL}/${path}.json`;
    const current = (await (await fetch(url)).json()) || 0;
    await fetch(url, { method: 'PUT', body: JSON.stringify(current + 1) });
    return current + 1;
  } catch { return null; }
}

const COUNTER_LABELS = {
  classic: 'le mode Classique',
  wanted:  'le mode Wanted',
  flag:    'le mode Pavillon',
  fruit:   null, // remplacé par le nom du fruit
};

async function loadDailyCounter(mode) {
  const el = document.getElementById('daily-counter');
  if (!el || !COUNTER_LABELS.hasOwnProperty(mode)) { if (el) el.textContent = ''; return; }
  const dateKey = todayKey();
  const count = await fbGet(`counters/${dateKey}/${mode}`);
  if (count === null || count === 0) { el.textContent = ''; return; }
  const label = mode === 'fruit'
    ? `le ${TARGET_FRU.name}`
    : COUNTER_LABELS[mode];
  el.textContent = `🏴‍☠️ ${count.toLocaleString('fr-FR')} joueur${count > 1 ? 's' : ''} ont complété ${label} aujourd'hui`;
}

async function incrementDailyCounter(mode) {
  const dateKey = todayKey();
  const count = await fbIncrement(`counters/${dateKey}/${mode}`);
  if (count === null) return;
  const el = document.getElementById('daily-counter');
  if (!el) return;
  const label = mode === 'fruit'
    ? `le ${TARGET_FRU.name}`
    : COUNTER_LABELS[mode];
  el.textContent = `🏴‍☠️ ${count.toLocaleString('fr-FR')} joueur${count > 1 ? 's' : ''} ont complété ${label} aujourd'hui`;
}

// ===== UTILS =====
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function lsGet(key)      { try { return localStorage.getItem(key); }    catch { return null; } }
function lsSet(key, val) { try { localStorage.setItem(key, val); }      catch {} }
function lsRemove(key)   { try { localStorage.removeItem(key); }        catch {} }

// ===== ÉTAT DU JEU =====
let currentMode = 'classic';
let cGuesses = [], cOver = false, cNames = new Set();
let wGuesses = [], wOver = false, wNames = new Set();
let fGuesses  = [], fOver  = false, fNames  = new Set();
let frGuesses = [], frOver = false, frNames = new Set(), frHintsRevealed = new Set();
let infGuesses = [], infOver = false, infNames = new Set(), infTarget = null;
const MAX_INF_GUESSES = 10;
let colorMode = false;
let hintUsed = false;
const MAX_CLASSIC_GUESSES = 10;

// ===== TAILLE INTERFACE + MENU PARAMÈTRES =====
function setSize(size) {
  document.body.classList.remove('size-small', 'size-large');
  if (size !== 'medium') document.body.classList.add('size-' + size);
  lsSet('op-size', size);
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
  setSize(lsGet('op-size') || 'medium');
})();

// ===== THÈME =====
function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  document.getElementById('theme-btn').textContent = isDark ? '🌙' : '☀️';
  lsSet('op-theme', isDark ? 'light' : 'dark');
}

(function () {
  const saved = lsGet('op-theme');
  if (saved) {
    document.documentElement.setAttribute('data-theme', saved);
    document.getElementById('theme-btn').textContent = saved === 'dark' ? '☀️' : '🌙';
  }
})();

// ===== MODAL SPOILER =====
function closeSpoilerModal() {
  if (document.getElementById('spoiler-no-show').checked) {
    lsSet('op-spoiler-ok', '1');
  }
  document.getElementById('spoiler-modal').classList.add('hidden');
}

(function () {
  if (!lsGet('op-spoiler-ok')) {
    document.getElementById('spoiler-modal').classList.remove('hidden');
  }
})();

// ===== DATE & HIER =====
document.getElementById('date-label').textContent =
  new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

function seedForDate(d, salt = 1) {
  const base = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  return (base * salt) >>> 0;
}
const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
const yChar   = CHARACTERS[seedForDate(yesterday, 1)  % CHARACTERS.length];
const yWanted = WANTED_CHARS[seedForDate(yesterday, 31) % WANTED_CHARS.length];
const yFlag   = FLAGS[seedForDate(yesterday, 97) % FLAGS.length];
document.getElementById('yesterday-bar').innerHTML =
  `Hier — Classique : <strong>${esc(yChar.name)}</strong> &nbsp;|&nbsp; Wanted : <strong>${esc(yWanted.name)}</strong> &nbsp;|&nbsp; Pavillon : <strong>${esc(yFlag.name)}</strong>`;

// ===== NAVIGATION PAR ONGLETS =====
function switchMode(mode) {
  currentMode = mode;
  document.getElementById('tab-classic').classList.toggle('active', mode === 'classic');
  document.getElementById('tab-wanted').classList.toggle('active', mode === 'wanted');
  document.getElementById('tab-flag').classList.toggle('active', mode === 'flag');
  document.getElementById('tab-fruit').classList.toggle('active', mode === 'fruit');
  document.getElementById('tab-inf').classList.toggle('active', mode === 'inf');
  document.getElementById('classic-section').classList.toggle('hidden', mode !== 'classic');
  document.getElementById('wanted-section').classList.toggle('active', mode === 'wanted');
  document.getElementById('flag-section').classList.toggle('active', mode === 'flag');
  document.getElementById('fruit-section').classList.toggle('active', mode === 'fruit');
  document.getElementById('inf-section').classList.toggle('active', mode === 'inf');

  const over = mode === 'classic' ? cOver : mode === 'wanted' ? wOver : mode === 'fruit' ? frOver : mode === 'inf' ? infOver : fOver;
  input.placeholder = mode === 'classic' || mode === 'inf'
    ? 'Tape un nom de personnage...'
    : mode === 'wanted'
    ? 'Devine le personnage sur le poster...'
    : mode === 'fruit'
    ? 'Devine le détenteur du fruit...'
    : "Devine l'équipage...";
  input.disabled = over;
  document.getElementById('guess-btn').disabled = over;
  syncBanners();
  updateCounter();
  if (mode === 'wanted') initPoster();
  if (mode === 'flag') initFlagGrid();
  if (mode === 'fruit') initFruitMode();
  if (mode === 'inf') initInfMode();
  loadDailyCounter(mode);
}

// ===== BANNERS =====
function syncBanners() {
  const over    = currentMode === 'classic' ? cOver    : currentMode === 'wanted' ? wOver    : currentMode === 'fruit' ? frOver    : currentMode === 'inf' ? infOver  : fOver;
  const guesses = currentMode === 'classic' ? cGuesses : currentMode === 'wanted' ? wGuesses : currentMode === 'fruit' ? frGuesses : currentMode === 'inf' ? infGuesses : fGuesses;
  const target  = currentMode === 'classic' ? TARGET_C : currentMode === 'wanted' ? TARGET_W : currentMode === 'fruit' ? { name: TARGET_FRU.holder } : currentMode === 'inf' ? infTarget : TARGET_F;

  if (!over) {
    document.getElementById('win-banner').classList.remove('show');
    document.getElementById('lose-banner').classList.remove('show');
    return;
  }
  const won = guesses.some(g => g.name === target.name);
  document.getElementById('win-banner').classList.toggle('show', won);
  document.getElementById('lose-banner').classList.toggle('show', !won);
  if (won) {
    document.getElementById('win-char-name').textContent = target.name;
    document.getElementById('win-attempts').textContent = guesses.length;
  } else {
    document.getElementById('lose-char-name').textContent = target.name;
  }
}

// ===== COUNTER =====
function updateCounter() {
  const guesses = currentMode === 'classic' ? cGuesses : currentMode === 'wanted' ? wGuesses : currentMode === 'fruit' ? frGuesses : currentMode === 'inf' ? infGuesses : fGuesses;
  const names   = currentMode === 'classic' ? cNames   : currentMode === 'wanted' ? wNames   : currentMode === 'fruit' ? frNames   : currentMode === 'inf' ? infNames   : fNames;
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

// Retourne le label d'alias/épithète qui a matché, ou null si c'est le nom qui matche
function getMatchHint(c, q) {
  if (c.name.toLowerCase().includes(q)) return null;
  // Épithète
  if (c.epithet && c.epithet.toLowerCase().includes(q)) return c.epithet;
  // Alias explicites
  for (const [alias, charName] of Object.entries(ALIASES)) {
    if (charName === c.name && alias.includes(q)) return alias;
  }
  return null;
}

function charMatchesQuery(c, q) {
  if (c.name.toLowerCase().includes(q)) return true;
  if (c.epithet && c.epithet.toLowerCase().includes(q)) return true;
  return Object.entries(ALIASES).some(([alias, charName]) => charName === c.name && alias.includes(q));
}

input.addEventListener('input', () => {
  const q = input.value.trim().toLowerCase();
  if (!q) { acBox.classList.remove('open'); return; }
  let pool, used;
  if (currentMode === 'classic')      { pool = CHARACTERS;   used = cNames; }
  else if (currentMode === 'wanted')  { pool = WANTED_CHARS; used = wNames; }
  else if (currentMode === 'fruit')   { pool = CHARACTERS;   used = frNames; }
  else if (currentMode === 'inf')     { pool = CHARACTERS;   used = infNames; }
  else                                { pool = FLAGS;        used = fNames; }
  acFilt = pool.filter(c => !used.has(c.name) && charMatchesQuery(c, q)).slice(0, 8);
  if (!acFilt.length) { acBox.classList.remove('open'); return; }
  acBox.innerHTML = acFilt.map((c, i) => {
    const hint = getMatchHint(c, q);
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
    else submitGuess();
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
  else if (currentMode === 'inf')    submitInf();
  else                               submitFlag();
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
  const char = CHARACTERS.find(c => c.name.toLowerCase() === name.toLowerCase());
  if (!char || cNames.has(char.name)) { shake(input); return; }
  cNames.add(char.name); cGuesses.push(char);
  input.value = ''; acBox.classList.remove('open');
  renderClassicRow(char);
  updateCounter();
  updateRecap();
  checkHintAvailable();
  if (char.name === TARGET_C.name) finClassic(true);
  else if (cGuesses.length >= MAX_CLASSIC_GUESSES) finClassic(false);
}

function finClassic(won) {
  cOver = true;
  document.getElementById('guess-btn').disabled = true;
  input.disabled = true;
  if (won) {
    document.getElementById('win-char-name').textContent  = TARGET_C.name;
    document.getElementById('win-attempts').textContent   = cGuesses.length;
    document.getElementById('win-banner').classList.add('show');
  } else {
    document.getElementById('lose-char-name').textContent = TARGET_C.name;
    document.getElementById('lose-banner').classList.add('show');
  }
  recordResult('classic', won, cGuesses.length);
  if (won) incrementDailyCounter('classic');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => showStats('classic'), 1800);
}

// Comparaisons
function cmpHaki(g, t) {
  if (!g.length && !t.length) return 'correct';
  if (JSON.stringify([...g].sort()) === JSON.stringify([...t].sort())) return 'correct';
  return g.some(h => t.includes(h)) ? 'partial' : 'wrong';
}
function cmpArc(g, t)    { return g === t ? { state:'correct', arrow:'' } : { state:'wrong', arrow: g < t ? '⬆️' : '⬇️' }; }
function cmpBounty(g, t) { return g === t ? { state:'correct', arrow:'' } : { state:'wrong', arrow: g < t ? '⬆️' : '⬇️' }; }
function cmpOrigin(g, t) {
  if (g === t) return 'correct';
  if (g.includes('Blue') && t.includes('Blue')) return 'partial';
  return 'wrong';
}
function fruitLabel(f) {
  if (!f) return { icon:'❌', val:'Aucun' };
  return { icon: { Paramecia:'🌀', Logia:'🌊', Zoan:'🐾', Mythique:'✨' }[f] || '❓', val: f };
}

function buildGuessRow(char, T) {
  const row = document.createElement('div');
  row.className = 'guess-row grid-cols';
  const gs = char.gender === T.gender ? 'correct' : 'wrong';
  const as = char.affil  === T.affil  ? 'correct' : char.affil.split(' ').some(w => T.affil.includes(w)) ? 'partial' : 'wrong';
  const os = cmpOrigin(char.origin, T.origin);
  const fs = char.fruit  === T.fruit  ? 'correct' : (char.fruit && T.fruit ? 'partial' : 'wrong');
  const hs = cmpHaki(char.haki, T.haki);
  const ss = char.status === T.status ? 'correct' : 'wrong';
  const ac = cmpArc(char.arc, T.arc);
  const bc = cmpBounty(char.bounty, T.bounty);
  const fl = fruitLabel(char.fruit);
  row.innerHTML = `
    <div class="cell cell-char">
      ${getImgFile(char)
        ? `<img class="char-thumb" src="images/${esc(getImgFile(char))}.jpg" alt="${esc(char.name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"/><span class="char-name-fallback" style="display:none">${esc(char.name)}</span>`
        : `<span class="char-name-only">${esc(char.name)}</span>`
      }
    </div>
    <div class="cell ${gs}"><span class="cell-icon">${char.gender === 'M' ? '♂️' : '♀️'}</span><span class="cell-val">${char.gender === 'M' ? 'Homme' : 'Femme'}</span></div>
    <div class="cell ${as}"><span class="cell-val" style="font-size:0.76rem;line-height:1.3">${char.affil}</span></div>
    <div class="cell ${os}"><span class="cell-val" style="font-size:0.76rem;line-height:1.3">${char.origin}</span></div>
    <div class="cell ${fs}"><span class="cell-icon">${fl.icon}</span><span class="cell-val">${fl.val}</span></div>
    <div class="cell ${hs}"><span class="cell-val" style="font-size:0.72rem;line-height:1.4">${char.haki.length ? char.haki.join(', ') : 'Aucun'}</span></div>
    <div class="cell ${ss}"><span class="cell-icon">${char.status === 'Vivant' ? '💚' : '💀'}</span><span class="cell-val">${char.status}</span></div>
    <div class="cell ${ac.state}"><span class="cell-val" style="font-size:0.74rem;line-height:1.3">${ARCS[char.arc - 1]}</span>${ac.arrow ? `<span class="cell-arrow">${ac.arrow}</span>` : ''}</div>
    <div class="cell ${bc.state}"><span class="cell-val">${formatBounty(char.bounty)}</span>${bc.arrow ? `<span class="cell-arrow">${bc.arrow}</span>` : ''}</div>
  `;
  return row;
}

function renderClassicRow(char) {
  document.getElementById('guesses-container').prepend(buildGuessRow(char, TARGET_C));
}

// ===== RECAP =====
const RECAP_COLS = [
  { key:'gender', label:'Genre',     fn: c => c.gender === 'M' ? 'Homme' : 'Femme',        check: (g,t) => g.gender === t.gender },
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
      <span class="ri-label">${col.label}</span>
      <span class="ri-val">${correctGuess || hintedThis ? col.fn(TARGET_C) : '???'}</span>
    `;
    grid.appendChild(item);
  });
}

// ===== INDICE =====
const HINT_COLS = [
  { key:'gender', label:'Genre',          fn: c => c.gender === 'M' ? 'Homme' : 'Femme' },
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
  display.innerHTML = `💡 <strong>${pick.label}</strong> : ${pick.fn(TARGET_C)}`;
  display.classList.add('show');
  document.getElementById('hint-btn').disabled = true;
  hintUsed = true;
  updateRecap();
}

// ===== MODE WANTED =====
function initPoster() {
  const blurPx = BLUR_STEPS[Math.min(wGuesses.length, BLUR_STEPS.length - 1)];
  const img    = document.getElementById('wanted-img');
  const noImg  = document.getElementById('wanted-no-img');
  img.src = '';
  img.src = `images/${getImgFile(TARGET_W)}.jpg?v=29`;
  applyFilter(img, blurPx);
  img.onerror = () => { img.style.display = 'none'; noImg.style.display = 'flex'; };
  img.onload  = () => { img.style.display = 'block'; noImg.style.display = 'none'; };
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
  const char = WANTED_CHARS.find(c => c.name.toLowerCase() === name.toLowerCase());
  if (!char || wNames.has(char.name)) { shake(input); return; }
  wNames.add(char.name); wGuesses.push(char);
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
  document.getElementById('guess-btn').disabled = true;
  input.disabled = true;
  revealFull();
  if (won) {
    document.getElementById('win-char-name').textContent  = TARGET_W.name;
    document.getElementById('win-attempts').textContent   = wGuesses.length;
    document.getElementById('win-banner').classList.add('show');
  } else {
    document.getElementById('lose-char-name').textContent = TARGET_W.name;
    document.getElementById('lose-banner').classList.add('show');
  }
  recordResult('wanted', won, wGuesses.length);
  if (won) incrementDailyCounter('wanted');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => showStats('wanted'), 1800);
}

// ===== MODE PAVILLON =====
function initFlagGrid() {
  const grid = document.getElementById('flag-grid');
  grid.innerHTML = '';
  const src = `flags/${TARGET_F.file}.jpg`;
  for (let i = 0; i < 16; i++) {
    const r = Math.floor(i / 4), c = i % 4;
    const cell = document.createElement('div');
    cell.className = 'flag-cell flag-masked';
    cell.dataset.r = r; cell.dataset.c = c; cell.dataset.i = i;
    const img = document.createElement('img');
    img.src = src; img.alt = '';
    cell.appendChild(img);
    grid.appendChild(cell);
  }
  revealFlagCells();
  updateFlagHint();
}

function revealFlagCells() {
  const cells    = document.querySelectorAll('.flag-cell');
  const toReveal = Math.min(fGuesses.length + 1, 16);
  for (let i = 0; i < 16; i++) {
    const idx = CELL_ORDER[i];
    if (i < toReveal) cells[idx].classList.remove('flag-masked');
    else              cells[idx].classList.add('flag-masked');
  }
  document.getElementById('flag-revealed').textContent = toReveal;
}

function updateFlagHint() {
  const toReveal = Math.min(fGuesses.length + 1, 16);
  const el   = document.getElementById('flag-hint-title');
  const left = 16 - fGuesses.length;
  if (fOver) el.textContent = fGuesses.some(g => g.name === TARGET_F.name) ? '🎉 Trouvé !' : '💀 Perdu !';
  else        el.textContent = `${toReveal} case(s) révélée(s) — ${Math.max(0, left - 1)} essai(s) restant(s)`;
}

function revealAllFlag() {
  document.querySelectorAll('.flag-cell').forEach(c => c.classList.remove('flag-masked'));
  document.getElementById('flag-revealed').textContent = 16;
}

function submitFlag() {
  if (fOver) return;
  const name = input.value.trim();
  const flag = FLAGS.find(f => f.name.toLowerCase() === name.toLowerCase());
  if (!flag || fNames.has(flag.name)) { shake(input); return; }
  fNames.add(flag.name); fGuesses.push(flag);
  input.value = ''; acBox.classList.remove('open');
  const correct = flag.name === TARGET_F.name;
  renderFlagGuess(flag, correct);
  updateCounter();
  if (correct) finFlag(true);
  else {
    revealFlagCells();
    updateFlagHint();
    if (fGuesses.length >= 15) finFlag(false);
  }
}

function renderFlagGuess(flag, correct) {
  const row = document.createElement('div');
  row.className = 'wanted-guess-row';
  row.innerHTML = `<span class="wg-name">${esc(flag.name)}</span><span class="wg-result ${correct ? 'correct' : 'wrong'}">${correct ? '✅ TROUVÉ !' : '❌ Raté'}</span>`;
  document.getElementById('flag-guesses').prepend(row);
}

function finFlag(won) {
  fOver = true;
  document.getElementById('guess-btn').disabled = true;
  input.disabled = true;
  revealAllFlag();
  updateFlagHint();
  if (won) {
    document.getElementById('win-char-name').textContent  = TARGET_F.name;
    document.getElementById('win-attempts').textContent   = fGuesses.length;
    document.getElementById('win-banner').classList.add('show');
  } else {
    document.getElementById('lose-char-name').textContent = TARGET_F.name;
    document.getElementById('lose-banner').classList.add('show');
  }
  recordResult('flag', won, fGuesses.length);
  if (won) incrementDailyCounter('flag');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => showStats('flag'), 1800);
}

// ===== STATISTIQUES =====
const MAX_DIST_CLASSIC = 10;
const MAX_DIST_WANTED  = 8;
const MAX_DIST_FLAG    = 15;
const MAX_DIST_FRUIT   = 10;

// ===== MODE INFINI =====
function loadInfStats() {
  return {
    streak: parseInt(lsGet('op-inf-streak') || '0'),
    record: parseInt(lsGet('op-inf-record') || '0'),
  };
}
function saveInfStats(streak, record) {
  lsSet('op-inf-streak', String(streak));
  lsSet('op-inf-record', String(record));
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
  const char = CHARACTERS.find(c => c.name.toLowerCase() === name.toLowerCase());
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
  document.getElementById('guess-btn').disabled = true;
  input.disabled = true;
  const { streak, record } = loadInfStats();
  const newStreak = won ? streak + 1 : 0;
  const newRecord = Math.max(record, newStreak);
  saveInfStats(newStreak, newRecord);
  document.getElementById('inf-streak').textContent = newStreak;
  document.getElementById('inf-record').textContent = newRecord;
  if (won) {
    document.getElementById('win-char-name').textContent = infTarget.name;
    document.getElementById('win-attempts').textContent  = infGuesses.length;
    document.getElementById('win-banner').classList.add('show');
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
  const key  = `op-stats-${mode}`;
  const max  = mode === 'flag' ? MAX_DIST_FLAG : MAX_DIST_CLASSIC;
  const raw  = lsGet(key);
  if (!raw) return defaultStats(max);
  try { return JSON.parse(raw); } catch { return defaultStats(max); }
}

function saveStats(mode, stats) {
  lsSet(`op-stats-${mode}`, JSON.stringify(stats));
}

function todayKey() {
  const d = new Date();
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
  document.getElementById('stats-modal').classList.remove('hidden');
  renderStatsContent(_statsMode);
  // Met à jour les onglets
  ['classic','wanted','flag','fruit'].forEach(m => {
    document.getElementById(`stab-${m}`).classList.toggle('active', m === _statsMode);
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
  ['classic','wanted','flag','fruit'].forEach(m => {
    document.getElementById(`stab-${m}`).classList.toggle('active', m === mode);
  });
  renderStatsContent(mode);
}

function renderStatsContent(mode) {
  const stats   = loadStats(mode);
  const winPct  = stats.played === 0 ? 0 : Math.round((stats.won / stats.played) * 100);
  const maxDist = mode === 'flag' ? MAX_DIST_FLAG : mode === 'fruit' ? MAX_DIST_FRUIT : MAX_DIST_CLASSIC;
  const maxVal  = Math.max(1, ...Object.values(stats.distribution));

  // Dernier essai gagnant pour surligner la barre
  const lastWinGuess = stats.lastWinGuesses || null;

  let html = `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-val">${stats.played}</div><div class="stat-label">Parties jouées</div></div>
      <div class="stat-card"><div class="stat-val">${winPct}%</div><div class="stat-label">Victoires</div></div>
      <div class="stat-card"><div class="stat-val">${stats.currentStreak}</div><div class="stat-label">Série actuelle</div></div>
      <div class="stat-card"><div class="stat-val">${stats.maxStreak}</div><div class="stat-label">Meilleure série</div></div>
    </div>
    <div class="dist-title">Distribution des essais</div>
  `;

  if (stats.played === 0) {
    html += `<div class="stats-empty">Aucune partie jouée pour ce mode.</div>`;
  } else {
    for (let i = 1; i <= maxDist; i++) {
      const count   = stats.distribution[i] || 0;
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

  html += `<button class="stats-reset-btn" onclick="resetStats('${mode}')">🗑️ Réinitialiser ces stats</button>`;

  document.getElementById('stats-content').innerHTML = html;

  // Anime les barres après insertion dans le DOM (délai pour laisser le browser rendre width:0 d'abord)
  setTimeout(() => {
    document.querySelectorAll('.dist-bar[data-pct]').forEach(bar => {
      bar.style.width = bar.dataset.pct + '%';
    });
  }, 60);
}

function resetStats(mode) {
  if (!confirm(`Réinitialiser les statistiques du mode "${mode}" ?`)) return;
  lsRemove(`op-stats-${mode}`);
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
  const char = CHARACTERS.find(c => c.name.toLowerCase() === searchName.toLowerCase());
  if (!char || frNames.has(char.name)) { shake(input); return; }
  frNames.add(char.name);
  frGuesses.push(char);
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
      revealImg.src = `images/${imgFile}.jpg`;
      revealName.textContent = TARGET_FRU.holder;
      revealEl.style.display = 'block';
    }
  }
  if (won) {
    document.getElementById('win-char-name').textContent = TARGET_FRU.holder;
    document.getElementById('win-attempts').textContent  = frGuesses.length;
    document.getElementById('win-banner').classList.add('show');
  } else {
    document.getElementById('lose-char-name').textContent = TARGET_FRU.holder;
    document.getElementById('lose-banner').classList.add('show');
  }
  recordResult('fruit', won, frGuesses.length);
  if (won) incrementDailyCounter('fruit');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => showStats('fruit'), 1800);
}

// Charge le compteur du mode par défaut au démarrage
loadDailyCounter('classic');

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


// ===== INIT =====
updateCounter();
initFlagGrid();

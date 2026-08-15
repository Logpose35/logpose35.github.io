// ===== CONSTANTES =====
const BLUR_STEPS    = [20, 16, 12, 9, 6, 3, 1, 0];
const MAX_GUESSES   = 8;
const MAX_FRU_GUESSES = 10;

// ===== ANNIVERSAIRES (sources : wiki One Piece) =====
// Format : 'MM-DD' → [noms exacts de data.json]
const BIRTHDAYS = {
  '01-01': ['Portgas D. Ace'],
  '02-06': ['Nico Robin'],
  '03-02': ['Sanji'],
  '03-09': ['Franky'],
  '03-20': ['Sabo'],
  '04-01': ['Usopp'],
  '04-02': ['Jimbei'],
  '04-03': ['Brook'],
  '04-06': ['Edward Newgate'],
  '05-02': ['Garp'],
  '05-05': ['Monkey D. Luffy'],
  '05-13': ['Rayleigh'],
  '07-03': ['Nami'],
  '09-02': ['Boa Hancock'],
  '10-06': ['Trafalgar D. Water Law'],
  '11-11': ['Roronoa Zoro'],
  '12-24': ['Tony Tony Chopper'],
};

// Retourne les personnages du pool dont c'est l'anniversaire aujourd'hui (Paris).
// Appelable uniquement après loadGameData() (CHARACTERS doit être initialisé).
// Sans argument : aujourd'hui (Paris). Avec une date : celle-là — le mode « rejouer »
// doit fêter l'anniversaire de la journée REJOUÉE, pas celui du jour réel.
function getTodayBirthdays(when) {
  const d = when || new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
  const mmdd = String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const names = BIRTHDAYS[mmdd] || [];
  return names.map(name => CHARACTERS.find(c => c.name === name)).filter(Boolean);
}

// ===== HELPERS =====
function getImgFile(char) {
  if (!char.img) return null;
  if (Array.isArray(char.img)) {
    const d = new Date();
    const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    return char.img[seed % char.img.length];
  }
  return char.img;
}

// salt : nombre premier différent par mode pour éviter les collisions
function _parisDate() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
}
function _dateBase(d) { return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
function _seedHash(base, salt) {
  let h = Math.imul((base + salt) >>> 0, 2654435761) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  h = Math.imul(h, 0x45d9f3b) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h;
}
// ── Tirage quotidien SANS REMISE (« sac de jetons ») ─────────────────────────
// Chaque perso sort UNE seule fois avant que le cycle recommence : le temps est
// découpé en cycles de N jours (N = taille du pool) et on parcourt une permutation
// seedée du pool, différente à chaque cycle. 100 % déterministe et identique pour
// tous les joueurs (ne dépend que de la date, du salt du mode et de N).
// ⚠️ La garantie « pas de doublon » tient ENTRE deux changements de taille de pool :
// si N change (ajout de persos/silhouettes), la permutation du cycle en cours est
// recalculée — connu et assumé (cf. brief : changer le pool change la cible).

// Numéro de jour linéaire (jours depuis 1970) à partir de la date calendaire.
// Insensible au fuseau/DST : ne dépend que de l'année/mois/jour affichés.
function _dayNumber(d) {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
}
// PRNG déterministe 32 bits (mulberry32) : suite reproductible depuis un seed.
function _mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
    t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Permutation seedée de [0..n-1] pour un cycle donné (Fisher-Yates).
function _shufflePerm(cycle, salt, n) {
  const rng = _mulberry32(_seedHash(cycle, salt));
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
// Index du jour dans le sac. Garde-fou anti-répétition à la JONCTION de deux
// cycles : si le 1er du nouveau cycle = le dernier du précédent, on fait tourner
// la permutation d'un cran (elle reste une permutation → aucun doublon interne).
function _bagPick(day, salt, n) {
  const cycle = Math.floor(day / n);
  const pos   = day - cycle * n;               // 0..n-1
  let perm    = _shufflePerm(cycle, salt, n);
  if (cycle > 0 && perm[0] === _shufflePerm(cycle - 1, salt, n)[n - 1]) {
    perm = perm.slice(1).concat(perm[0]);
  }
  return perm[pos];
}
// Index du jour pour une date donnée (tirage sans remise, salt par mode).
function dailyIndex(d, salt, n) {
  if (n <= 1) return 0;
  return _bagPick(_dayNumber(d), salt, n);
}
function dailyPick(pool, salt = 1) {
  return pool[dailyIndex(_parisDate(), salt, pool.length)];
}

// ===== CALENDRIER (réponses figées) =====
// Le tirage ci-dessus dépend de la TAILLE du pool : ajouter un personnage ou une
// silhouette décalait toutes les journées, passées comme en cours. calendar.json fige
// donc la réponse de chaque jour (généré par tools/gen_calendar.py, dates <= aujourd'hui
// jamais réécrites). Le tirage par seed ne sert plus que de filet : date absente du
// fichier, ou nom qui n'existe plus dans data.json.
let CALENDAR = {};
let CALENDAR_LAUNCH = null;   // 1er jour du site (= journée #1) — numérote les rediffusions

function _isoKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
                         + '-' + String(d.getDate()).padStart(2, '0');
}
// Réponses figées d'une date (null si le calendrier ne la couvre pas).
function calendarDay(d) {
  return CALENDAR[_isoKey(d || _parisDate())] || null;
}

// ===== JOURNÉE REJOUÉE (?jour=AAAA-MM-JJ) =====
// Déclaré ICI et pas dans app.js : les cibles sont résolues au chargement des données,
// donc la date doit être connue avant. app.js s'en sert ensuite (activeDate/activeKey).
// Toute valeur douteuse — format invalide, date future, journée absente du calendrier —
// est ignorée : on retombe silencieusement sur la partie du jour.
let REPLAY_DATE = null;

function _parseReplayParam() {
  const p = new URLSearchParams(location.search).get('jour');
  if (!p || !/^\d{4}-\d{2}-\d{2}$/.test(p)) return null;
  const [y, m, d] = p.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  const today = _parisDate();
  today.setHours(0, 0, 0, 0);
  if (dt > today) return null;                 // le futur ne se rejoue pas
  return CALENDAR[_isoKey(dt)] ? dt : null;    // hors archive → journée du jour
}
// Cible d'un mode : le calendrier fait foi, le tirage par seed prend le relais sinon.
function _resolve(pool, salt, value, match) {
  if (value !== undefined && value !== null) {
    const hit = pool.find(item => match(item, value));
    if (hit !== undefined) return hit;
  }
  return dailyPick(pool, salt);
}

// Hash pur (sans modulo) pour des décisions déterministes indépendantes du pool.
// Suit la journée rejouée : le cadrage du Tome doit être celui de CETTE journée-là.
function dailySeed(salt = 1, when) {
  return _seedHash(_dateBase(when || REPLAY_DATE || _parisDate()), salt);
}

// ===== VARIABLES GLOBALES (initialisées par loadGameData) =====
let ARCS         = [];
let CHARACTERS   = [];
let ALIASES      = {};
let FRUITS       = [];
let OPENINGS     = [];
let WANTED_CHARS = [];
let WANTED_EXTRA  = []; // réservé pour futures affiches spéciales
let EMOJI_POOL    = [];
let EMOJI_NAMES   = {}; // emoji → nom lisible (infobulle)
let TARGET_C, TARGET_W, TARGET_FRU, TARGET_EM, TARGET_AU;
let SIL_POOL = [], TARGET_SIL = null, SIL_FOCUS_MAP = {};   // Mode Silhouette
let TOMES        = [];           // numéros de tomes du pool quotidien (1..112)
let TARGET_TOME;                 // numéro du tome à deviner aujourd'hui
let TOME_ZOOM    = { x: 50, y: 50 }; // centre du gros plan (en %), déterministe

// ===== CHARGEMENT DES DONNÉES =====
async function loadGameData() {
  const res  = await fetch('/data.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`data.json introuvable (${res.status})`);
  const raw  = await res.json();

  ARCS        = raw.ARCS;
  CHARACTERS  = raw.CHARACTERS;
  ALIASES     = raw.ALIASES;
  FRUITS      = raw.FRUITS;
  OPENINGS    = raw.OPENINGS;
  EMOJI_NAMES = raw.EMOJI_NAMES || {};

  // Dérivés
  WANTED_CHARS = CHARACTERS.filter(c => c.img !== null && c.img !== undefined);
  EMOJI_POOL   = CHARACTERS.filter(c => Array.isArray(c.emoji) && c.emoji.length > 0);

  // Calendrier des réponses (facultatif : sans lui, on retombe sur le tirage par seed)
  try {
    const _cr = await fetch('/calendar.json', { cache: 'no-cache' });
    const _cj = _cr.ok ? await _cr.json() : {};
    CALENDAR = _cj.days || {};
    if (_cj.launch) {
      const [ly, lm, ld] = _cj.launch.split('-').map(Number);
      CALENDAR_LAUNCH = new Date(ly, lm - 1, ld);
    }
  } catch (e) { CALENDAR = {}; }

  // Journée rejouée : lue APRÈS le calendrier (qui sert à la valider), AVANT les cibles.
  REPLAY_DATE = _parseReplayParam();
  const _day = calendarDay(REPLAY_DATE || undefined);

  // Cibles du jour : calendrier d'abord, seed en secours (salt indépendant par mode)
  const _byName = (item, v) => item.name === v;
  TARGET_C   = _resolve(CHARACTERS,   1, _day && _day.classic, _byName);   // Classique
  TARGET_W   = _resolve(WANTED_CHARS, 31, _day && _day.wanted, _byName);   // Wanted
  TARGET_FRU = _resolve(FRUITS,       71, _day && _day.fruit,  _byName);   // Fruit du Démon
  TARGET_EM  = _resolve(EMOJI_POOL,  137, _day && _day.emoji,  _byName);   // Émoji
  TARGET_AU  = _resolve(OPENINGS,     53, _day && _day.audio, (o, v) => o.id === v);
  TOMES      = raw.TOMES || [];
  TARGET_TOME = _resolve(TOMES,      181, _day && _day.tome,  (n, v) => n === v);
  // Centre du gros plan : déterministe, bridé loin des bords (18..82 %)
  const _z = dailySeed(191);
  TOME_ZOOM  = { x: 18 + (_z % 64), y: 18 + ((_z >>> 8) % 64) };

  // Mode Silhouette : pool = personnages ayant une silhouette générée (= clés de focus.json).
  // Certains persos (sans bonne image) n'ont pas de silhouette → exclus du pool.
  try {
    const _fr = await fetch('/silhouettes/focus.json', { cache: 'no-cache' });
    SIL_FOCUS_MAP = _fr.ok ? await _fr.json() : {};
  } catch (e) { SIL_FOCUS_MAP = {}; }
  SIL_POOL = CHARACTERS.filter(c => {
    const k = Array.isArray(c.img) ? c.img[0] : c.img;
    return k && SIL_FOCUS_MAP[k];
  });
  TARGET_SIL = SIL_POOL.length
    ? _resolve(SIL_POOL, 211, _day && _day.silhouette, _byName)   // salt premier dédié
    : null;

  // Override anniversaire Classique : 30 % de chances si un personnage fête son anniv aujourd'hui.
  // Déterministe — même seed → même décision à chaque rechargement.
  // Ignoré quand le calendrier a fourni la réponse : elle l'intègre déjà (gen_calendar.py).
  const _bdayChars = (_day && _day.classic) ? [] : getTodayBirthdays(REPLAY_DATE || undefined);
  if (_bdayChars.length) {
    // Salt 7 (≠ salt 1 du classique) : décision indépendante du choix de base
    if (dailySeed(7) % 10 < 3) {
      // Si plusieurs anniversaires le même jour, on en prend un via seed
      TARGET_C = _bdayChars[dailySeed(11) % _bdayChars.length];
    }
  }

}

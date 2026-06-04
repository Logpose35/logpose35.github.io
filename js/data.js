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
function getTodayBirthdays() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
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
function dailyPick(pool, salt = 1) {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
  const base = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  let h = Math.imul(base + salt, 2654435761) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  h = Math.imul(h, 0x45d9f3b) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return pool[h % pool.length];
}

// Retourne le hash pur (sans modulo) pour la même date Paris + salt donné.
// Utilisé pour des décisions déterministes indépendantes du pool.
function dailySeed(salt = 1) {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
  const base = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  let h = Math.imul(base + salt, 2654435761) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  h = Math.imul(h, 0x45d9f3b) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h;
}

// ===== VARIABLES GLOBALES (initialisées par loadGameData) =====
let ARCS         = [];
let CHARACTERS   = [];
let FLAGS        = [];
let ALIASES      = {};
let FRUITS       = [];
let OPENINGS     = [];
let WANTED_CHARS = [];
let WANTED_EXTRA  = []; // réservé pour futures affiches spéciales
let EMOJI_POOL    = [];
let EMOJI_NAMES   = {}; // emoji → nom lisible (infobulle)
let TARGET_C, TARGET_W, TARGET_F, TARGET_FRU, TARGET_EM, TARGET_AU;
let TOMES        = [];           // numéros de tomes du pool quotidien (1..112)
let TARGET_TOME;                 // numéro du tome à deviner aujourd'hui
let TOME_ZOOM    = { x: 50, y: 50 }; // centre du gros plan (en %), déterministe
let CELL_ORDER   = [];

// ===== CHARGEMENT DES DONNÉES =====
async function loadGameData() {
  const res  = await fetch('/data.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`data.json introuvable (${res.status})`);
  const raw  = await res.json();

  ARCS        = raw.ARCS;
  CHARACTERS  = raw.CHARACTERS;
  FLAGS       = raw.FLAGS;
  ALIASES     = raw.ALIASES;
  FRUITS      = raw.FRUITS;
  OPENINGS    = raw.OPENINGS;
  EMOJI_NAMES = raw.EMOJI_NAMES || {};

  // Dérivés
  WANTED_CHARS = CHARACTERS.filter(c => c.img !== null && c.img !== undefined);
  EMOJI_POOL   = CHARACTERS.filter(c => Array.isArray(c.emoji) && c.emoji.length > 0);

  // Cibles du jour (seed indépendant par mode)
  TARGET_C   = dailyPick(CHARACTERS,   1);   // Classique
  TARGET_W   = dailyPick(WANTED_CHARS, 31);  // Wanted
  TARGET_F   = dailyPick(FLAGS,        97);  // Pavillon
  TARGET_FRU = dailyPick(FRUITS,       71);  // Fruit du Démon
  TARGET_EM  = dailyPick(EMOJI_POOL,  137);  // Émoji
  TARGET_AU  = dailyPick(OPENINGS,    53);   // Opening du jour
  TOMES      = raw.TOMES || [];
  TARGET_TOME = dailyPick(TOMES,     181);   // Tome du jour (salt premier dédié)
  // Centre du gros plan : déterministe, bridé loin des bords (18..82 %)
  const _z = dailySeed(191);
  TOME_ZOOM  = { x: 18 + (_z % 64), y: 18 + ((_z >>> 8) % 64) };

  // Override anniversaire Classique : 30 % de chances si un personnage fête son anniv aujourd'hui.
  // Déterministe — même seed → même décision à chaque rechargement.
  const _bdayChars = getTodayBirthdays();
  if (_bdayChars.length) {
    // Salt 7 (≠ salt 1 du classique) : décision indépendante du choix de base
    if (dailySeed(7) % 10 < 3) {
      // Si plusieurs anniversaires le même jour, on en prend un via seed
      TARGET_C = _bdayChars[dailySeed(11) % _bdayChars.length];
    }
  }

  // Ordre déterministe des cases du pavillon
  CELL_ORDER = (function () {
    const arr  = [...Array(16).keys()];
    let seed = TARGET_F.file.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    for (let i = arr.length - 1; i > 0; i--) {
      seed = (seed * 9301 + 49297) % 233280;
      const j = Math.floor(seed / 233280 * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  })();
}

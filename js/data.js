// ===== CONSTANTES =====
const BLUR_STEPS    = [20, 16, 12, 9, 6, 3, 1, 0];
const MAX_GUESSES   = 8;
const MAX_FRU_GUESSES = 10;

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

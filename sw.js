const CACHE_NAME = 'logpose-v285';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/game.html',        // redirection vers /classique/ (ancienne URL, favoris)
  '/versus.html',
  '/en/',
  '/en/index.html',
  '/en/game.html',     // redirection vers /en/classic/
  '/en/versus.html',
  // Une page par mode (chantier SEO) : 16 documents d'environ 34 Ko. Les
  // précacher permet de changer de mode hors ligne — c'est désormais une
  // navigation, plus une bascule JS. Coût : ~550 Ko à l'installation, en
  // arrière-plan (l'événement install ne bloque pas l'affichage).
  '/classique/',
  '/wanted/',
  '/silhouette/',
  '/fruit-du-demon/',
  '/emoji/',
  '/opening/',
  '/tome/',
  '/infini/',
  '/en/classic/',
  '/en/wanted/',
  '/en/silhouette/',
  '/en/devil-fruit/',
  '/en/emoji/',
  '/en/opening/',
  '/en/volume/',
  '/en/endless/',
  '/js/i18n.js?v=285',
  '/i18n/en.js?v=285',
  '/css/versus.css?v=285',
  '/js/versus.js?v=285',
  '/css/base.css?v=285',
  '/css/landing.css?v=285',
  '/css/layout.css?v=285',
  '/css/modals.css?v=285',
  '/css/classic.css?v=285',
  '/css/wanted.css?v=285',
  '/css/silhouette.css?v=285',
  '/css/fruit.css?v=285',
  '/css/inf.css?v=285',
  '/css/emoji.css?v=285',
  '/css/misc.css?v=285',
  '/css/audio.css?v=285',
  '/js/version.js?v=285',
  '/js/data.js?v=285',
  '/js/landing.js?v=285',
  '/js/jolly-roger.js?v=285',
  '/js/versus-rules.js?v=285',
  '/js/app.js?v=285',
  '/js/canvas-share.js?v=285',
  '/js/map.js?v=285',
  '/css/animations.css?v=285',
  '/css/map.css?v=285',
  '/css/tome.css?v=285',
  '/css/ocean3d.css?v=285',
  '/css/mobile.css?v=285',
  '/js/ocean3d-boot.js?v=285',
  '/data.json',
  '/manifest.json',
  '/manifest.en.json',
  '/images/jolly_roger_sm.webp',
  '/images/favicon.png',
  '/images/going_merry_sm.webp',
];
// Volontairement HORS précache (récupérés par le runtime si besoin) :
//   /js/ocean3d.js       110 Ko — fond 3D chargé à la demande depuis la v6.5
//   /images/og_preview.jpg 75 Ko — vignette de partage, jamais affichée sur le site
//   /images/wanted_frame.webp     — n'est utile qu'en mode Wanted

// Installation : mise en cache des assets essentiels
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
});

// Activation : nettoyage des anciens caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ============================================================
// STRATÉGIE DE CACHE (revue en v6.5)
// ------------------------------------------------------------
// Avant : network-first sur TOUT le JS/CSS/JSON. Or ces URL portent déjà
// ?v=NNN : elles sont immuables par construction. On re-téléchargeait donc
// ~730 Ko à chaque partie quotidienne pour obtenir un contenu déjà en cache,
// et sans timeout — en 4G dégradée (métro, tunnel) la requête ne rate pas,
// elle traîne, et le repli cache ne se déclenchait jamais.
//
// Maintenant :
//   • URL versionnée (?v=)  -> CACHE-FIRST      (immuable, 0 octet réseau)
//   • HTML et data.json     -> NETWORK-FIRST avec timeout, repli cache
//   • images et le reste    -> CACHE-FIRST
// Le HTML reste en network-first : c'est lui qui porte les nouveaux ?v=,
// donc c'est lui qui déclenche la mise à jour de tout le reste.
// ============================================================

const NET_TIMEOUT_MS = 3000;

// Met en cache une réponse valable uniquement (pas les 404, pas les opaques)
function putIfOk(request, response) {
  if (!response || !response.ok || response.type === 'opaque') return response;
  const clone = response.clone();
  caches.open(CACHE_NAME).then(cache => cache.put(request, clone)).catch(() => {});
  return response;
}

// Réseau d'abord, mais on n'attend pas indéfiniment : passé NET_TIMEOUT_MS,
// on sert la version en cache s'il y en a une (le réseau continue en fond
// et rafraîchit le cache pour la prochaine fois).
async function networkFirst(request) {
  // Le fetch continue en arrière-plan même si on répond depuis le cache :
  // le cache est ainsi rafraîchi pour la visite suivante.
  const reseau = fetch(request).then(res => putIfOk(request, res));

  // Course entre le réseau et le chronomètre.
  const chrono = new Promise(resolve => setTimeout(() => resolve(null), NET_TIMEOUT_MS));
  const gagnant = await Promise.race([reseau.catch(() => null), chrono]);
  if (gagnant) return gagnant;

  // Réseau trop lent ou en échec : on sert le cache s'il a la ressource.
  const cache = await caches.match(request);
  if (cache) return cache;

  // Rien en cache : on laisse le réseau aller au bout (et remonter son erreur).
  return reseau;
}

function cacheFirst(request) {
  return caches.match(request).then(cached => {
    if (cached) return cached;
    return fetch(request).then(res => putIfOk(request, res));
  });
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Ne pas intercepter les requêtes externes (fonts, Firebase, three.js CDN…)
  if (url.origin !== self.location.origin) return;

  // Ne pas intercepter les requêtes audio (MP3) — toujours depuis le réseau
  if (url.pathname.startsWith('/audio/')) return;

  // Une URL versionnée (?v=NNN) est immuable par construction : son contenu ne
  // changera jamais, seul le HTML pointera un jour vers un autre ?v=.
  if (url.searchParams.has('v')) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // Non versionné et susceptible de changer : le HTML (qui porte les nouveaux
  // ?v=) et les JSON (data.json quand des personnages sont ajoutés,
  // manifest*.json quand la PWA évolue). Sans cette règle, un manifeste mis en
  // précache ne serait plus jamais rafraîchi.
  const estHTML = url.pathname.endsWith('.html') || url.pathname.endsWith('/');
  const estJSON = url.pathname.endsWith('.json');

  if (estHTML || estJSON) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Images, polices, et tout le reste : immuables en pratique.
  event.respondWith(cacheFirst(event.request));
});

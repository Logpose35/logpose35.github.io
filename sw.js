const CACHE_NAME = 'logpose-v194';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/game.html',
  '/css/base.css?v=194',
  '/css/landing.css?v=194',
  '/css/layout.css?v=194',
  '/css/modals.css?v=194',
  '/css/classic.css?v=194',
  '/css/wanted.css?v=194',
  '/css/silhouette.css?v=194',
  '/css/fruit.css?v=194',
  '/css/inf.css?v=194',
  '/css/emoji.css?v=194',
  '/css/misc.css?v=194',
  '/css/audio.css?v=194',
  '/js/data.js?v=194',
  '/js/landing.js?v=194',
  '/js/jolly-roger.js?v=194',
  '/js/app.js?v=194',
  '/js/canvas-share.js?v=194',
  '/js/map.js?v=194',
  '/css/animations.css?v=194',
  '/css/map.css?v=194',
  '/css/tome.css?v=194',
  '/css/ocean3d.css?v=194',
  '/js/ocean3d.js?v=194',
  '/data.json',
  '/manifest.json',
  '/images/jolly_roger.png',
  '/images/favicon.png',
  '/images/going_merry.png',
  '/images/og_preview.jpg',
];

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

// Fetch : network-first pour JS/CSS versionnés, cache-first pour images
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Ne pas intercepter les requêtes externes (fonts, Firebase, YouTube, AdSense…)
  if (url.origin !== self.location.origin) return;

  // Ne pas intercepter les requêtes audio (MP3) — toujours depuis le réseau
  if (url.pathname.startsWith('/audio/')) return;

  // Network-first pour HTML, JS/CSS et JSON (on veut toujours la dernière version)
  if (
    url.pathname.endsWith('.html') ||
    url.pathname === '/' ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.json')
  ) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first pour images et autres assets statiques
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return res;
      });
    })
  );
});

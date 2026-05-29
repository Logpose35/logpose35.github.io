const CACHE_NAME = 'logpose-v99';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/game.html',
  '/css/base.css?v=99',
  '/css/landing.css?v=99',
  '/css/layout.css?v=99',
  '/css/modals.css?v=99',
  '/css/classic.css?v=99',
  '/css/wanted.css?v=99',
  '/css/flag.css?v=99',
  '/css/fruit.css?v=99',
  '/css/inf.css?v=99',
  '/css/emoji.css?v=99',
  '/css/misc.css?v=99',
  '/css/audio.css?v=99',
  '/js/data.js?v=99',
  '/js/landing.js?v=99',
  '/js/app.js?v=99',
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

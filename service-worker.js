// service-worker.js
const VERSION = '1.0.30'; // Dit sturen we naar de Sheet
const CACHE_NAME = 'kalanera-cache-v1.0.130'; // Dit dwingt de code-update af
const IMAGE_CACHE = 'kalanera-images-v130'; // Dit laten we lekker staan voor de snelheid

// VOEG DIT TOE: Luister naar vragen van de app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: VERSION });
  }
});

// Zorg ook dat deze erin staan (die dwingen de update af):
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME && key !== IMAGE_CACHE)
            .map(key => caches.delete(key))
      );
    })
  );
  // Zorgt dat de nieuwe SW direct de controle overneemt
  return self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // KRUCIAL: Alleen verzoeken naar onze EIGEN domein cachen
  // Dit voorkomt problemen met Google Maps, Tally en GoatCounter
  if (!url.origin.includes(self.location.hostname)) return;

  // 1. AFBEELDINGEN: Cache First, then Network
  if (event.request.destination === 'image' || url.pathname.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(cache => {
        return cache.match(event.request).then(cachedResponse => {
          if (cachedResponse) return cachedResponse;
          return fetch(event.request).then(networkResponse => {
            if (networkResponse.status === 200) cache.put(event.request, networkResponse.clone());
            return networkResponse;
          }).catch(() => caches.match('/icon-512.png'));
        });
      })
    );
    return;
  }

  // 2. CSS, JS & HTML: Cache First (voor snelheid) en op de achtergrond updaten
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      const fetchPromise = fetch(event.request).then(networkResponse => {
        if (networkResponse.status === 200) {
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse.clone()));
        }
        return networkResponse;
      });

      // Geef direct uit cache als het er is, anders wacht op netwerk
      return cachedResponse || fetchPromise;
    })
  );
});
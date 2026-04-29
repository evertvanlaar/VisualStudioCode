// service-worker.js
const VERSION = '2.0.74'; // Dit sturen we naar de Sheet
const CACHE_NAME = 'kalanera-cache-v2.0.74'; // Dit dwingt de code-update af
const IMAGE_CACHE = 'kalanera-images-v2.0.74'; // Afbeeldingen apart cachen voor snelheid

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

// manifest.json niet pre-cachen: oude background_color bleef anders "vast" in splash/PWA-metadata
const STATIC_ASSETS = [
  '/',
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

  // Manifest: network-first zodat background_color / icons altijd actueel zijn (geen witte splash uit oude cache)
  if (url.pathname === '/manifest.json') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse.status === 200) {
            const copy = networkResponse.clone();
            event.waitUntil(
              copy
                .arrayBuffer()
                .then((body) =>
                  caches.open(CACHE_NAME).then((cache) =>
                    cache.put(
                      event.request,
                      new Response(body, {
                        status: networkResponse.status,
                        statusText: networkResponse.statusText,
                        headers: networkResponse.headers
                      })
                    )
                  )
                )
                .catch(() => {})
            );
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 1. AFBEELDINGEN: Cache First, then Network
  if (event.request.destination === 'image' || url.pathname.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(cache => {
        return cache.match(event.request).then(cachedResponse => {
          if (cachedResponse) return cachedResponse;
          return fetch(event.request).then(networkResponse => {
            if (networkResponse.status === 200) {
              const copy = networkResponse.clone();
              event.waitUntil(
                copy
                  .arrayBuffer()
                  .then((body) =>
                    cache.put(
                      event.request,
                      new Response(body, {
                        status: networkResponse.status,
                        statusText: networkResponse.statusText,
                        headers: networkResponse.headers
                      })
                    )
                  )
                  .catch(() => {})
              );
            }
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
      if (cachedResponse) {
        event.waitUntil(
          fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse.status !== 200) return;
              const copy = networkResponse.clone();
              return copy.arrayBuffer().then((body) =>
                caches.open(CACHE_NAME).then((cache) =>
                  cache.put(
                    event.request,
                    new Response(body, {
                      status: networkResponse.status,
                      statusText: networkResponse.statusText,
                      headers: networkResponse.headers
                    })
                  )
                )
              );
            })
            .catch(() => {})
        );
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse.status !== 200) return networkResponse;
        const copy = networkResponse.clone();
        event.waitUntil(
          copy
            .arrayBuffer()
            .then((body) =>
              caches.open(CACHE_NAME).then((cache) =>
                cache.put(
                  event.request,
                  new Response(body, {
                    status: networkResponse.status,
                    statusText: networkResponse.statusText,
                    headers: networkResponse.headers
                  })
                )
              )
            )
            .catch(() => {})
        );
        return networkResponse;
      });
    })
  );
});
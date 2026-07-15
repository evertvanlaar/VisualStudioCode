// service-worker.js
const VERSION = '3.1.103'; // Dit sturen we naar de Sheet
const CACHE_NAME = 'kalanera-cache-v3.1.103'; // Dit dwingt de code-update af
const IMAGE_CACHE = 'kalanera-images-v3.1.103'; // Afbeeldingen apart cachen voor snelheid

// VOEG DIT TOE: Luister naar vragen van de app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: VERSION });
  }
});

// manifest.json niet pre-cachen: oude background_color bleef anders "vast" in splash/PWA-metadata
const STATIC_ASSETS = [
  '/',
  '/offline.html',
  '/icon-192.png',
  '/icon-512.png'
];

// Single install handler: precache + immediate activation.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Single activate handler: cleanup + claim.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME && key !== IMAGE_CACHE)
            .map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Alleen exact dezelfde origin (niet apex vs www: includes('kalanera.gr') matcht ook www.kalanera.gr).
  if (url.origin !== self.location.origin) return;

  // Businessfoto's: niet via SW (mobiel/PWA: parallelle /pix/-loads anders deels geblokkeerd of time-out).
  if (url.pathname.startsWith('/pix/')) return;

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

  // 1. AFBEELDINGEN: network-first (PWA/mobiel: geen kapotte cache-first meer → lege/icon placeholders)
  if (event.request.destination === 'image' || url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse.status === 200) {
            event.waitUntil(
              caches.open(IMAGE_CACHE).then((cache) =>
                cache.put(event.request, networkResponse.clone()).catch(() => {})
              )
            );
            return networkResponse;
          }
          return caches.open(IMAGE_CACHE).then((cache) =>
            cache.match(event.request).then((cached) => cached || networkResponse)
          );
        })
        .catch(() =>
          caches.open(IMAGE_CACHE).then((cache) =>
            cache.match(event.request).then(
              (cached) => cached || caches.match('/pix/nophoto.jpg') || caches.match('/icon-512.png')
            )
          )
        )
    );
    return;
  }

  // Gefingerprinte CSS/JS (?v=): network-first zodat cache-first hier geen oude style/app na deploy serveert (PWA).
  const pathname = url.pathname || '';
  if (
    /[?&]v=/.test(url.search) &&
    /\.(css|js)$/i.test(pathname || '')
  ) {
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
                        headers: networkResponse.headers,
                      }),
                    ),
                  ),
                )
                .catch(() => {}),
            );
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request)),
    );
    return;
  }

  // 2. HTML-documenten: Network-first zodat ingesloten app.js?v= / style.css?v= niet vast blijven
  //    hangen aan oude cache van index*.html (typisch na deploy); offline → nog steeds cached pagina.
  if (event.request.destination === 'document') {
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
                        headers: networkResponse.headers,
                      }),
                    ),
                  ),
                )
                .catch(() => {}),
            );
          }
          return networkResponse;
        })
        .catch(() =>
          caches.match(event.request).then((cached) => cached || caches.match('/offline.html'))
        ),
    );
    return;
  }

  // Statische datasets (/data/*.json): network-first — na rooster-wissel geen oude bus-schedule.json uit SW-cache (vooral PWA/mobiel).
  if (url.pathname.startsWith('/data/') && /\.json$/i.test(pathname)) {
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
                        headers: networkResponse.headers,
                      }),
                    ),
                  ),
                )
                .catch(() => {}),
            );
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request)),
    );
    return;
  }

  // 3. CSS, JS & overige: Cache First (voor snelheid) en op de achtergrond updaten
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
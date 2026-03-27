// service-worker.js
const CACHE_NAME = 'kalanera-cache-v1.0.30';
const IMAGE_CACHE = 'kalanera-images-v30';

// Bestanden die ALTIJD offline beschikbaar moeten zijn (de basis)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',  // <--- Zorg dat deze hierbij staat!
  '/manifest.json',
  '/icon-512.png'
];

// 1. Installatie: Sla de basisbestanden op
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// 2. Activatie: Verwijder oude caches als we de versie verhogen
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME && key !== IMAGE_CACHE)
            .map(key => caches.delete(key))
      );
    })
  );
});

// 3. De Magie: Afbeeldingen onderscheppen en opslaan
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Check of het verzoek om een afbeelding gaat
  if (event.request.destination === 'image' || url.pathname.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(cache => {
        return cache.match(event.request).then(cachedResponse => {
          // Geef de foto uit de cache als we die hebben
          if (cachedResponse) return cachedResponse;

          // Zo niet, haal hem op van internet en sla een kopie op
          return fetch(event.request).then(networkResponse => {
            if (networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => {
             // Als internet faalt en we hebben geen cache, toon eventueel een placeholder
             return caches.match('/icon-512.png'); 
          });
        });
      })
    );
  } else {
    // Voor normale bestanden (HTML/JS): probeer netwerk, anders cache
    event.respondWith(
      caches.match(event.request).then(response => {
        return response || fetch(event.request);
      })
    );
  }
});
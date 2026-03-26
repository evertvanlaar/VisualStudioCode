// service-worker.js
const CACHE_NAME = 'kalanera-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  // Hieronder vul je de exacte namen van je CSS en JS bestanden in:
  '/style.css', 
  '/script.js',
  '/icon-512.png',
  'https://www.kalanera.gr/villageoverview.jpg' // Je header foto
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});
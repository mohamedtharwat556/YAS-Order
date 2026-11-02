const CACHE_NAME = 'yas-order-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/login.html',
  '/driver.html',
  '/login-driver.html',
  '/track.html',
  '/style.css',
  '/supabase-config.js',
  '/app-sales.js',
  '/app-driver.js',
  '/app-track.js',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

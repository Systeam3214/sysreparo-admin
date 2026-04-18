const CACHE_NAME = 'rstark-cache-v2';
const urlsToCache = [
  './',
  './index.html',
  './dashboard.html',
  './bloqueado.html',
  './css/style.css',
  './css/dashboard.css',
  './css/print-os.css',
  './js/script.js',
  './js/dashboard.js',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap'
];

self.addEventListener('install', event => {
  self.skipWaiting(); // Force the waiting service worker to become the active one
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache v2');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  // Ignora chamadas para o Firestore e Google APIs
  if (event.request.url.includes('firestore.googleapis.com') || event.request.url.includes('identitytoolkit.googleapis.com')){
      return;
  }

  // Estratégia Stale-While-Revalidate: serve do cache, mas atualiza em background
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        const fetchPromise = fetch(event.request).then(networkResponse => {
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, networkResponse.clone());
          });
          return networkResponse;
        });
        return cachedResponse || fetchPromise;
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

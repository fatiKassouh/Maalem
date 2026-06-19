// Simple Service Worker for Maalem PWA
const CACHE_NAME = 'maalem-cache-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/Maalem.dc.html',
  '/manifest.json',
  '/maalem-logo.png',
  '/maalem-mark.png',
  '/support.js',
  '/image-slot.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS).catch(err => {
          console.error('Cache addAll failed', err);
        });
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
});

self.addEventListener('fetch', event => {
  // Only handle GET requests to avoid API issues (like POST /api/chat)
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  
  // If requesting /Maalem.dc, serve the cached /Maalem.dc.html
  if (url.pathname === '/Maalem.dc') {
    event.respondWith(
      caches.match('/Maalem.dc.html').then(cached => {
        return cached || fetch(event.request);
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request);
    })
  );
});

// Simple Service Worker for Maalem PWA
const CACHE_NAME = 'maalem-cache-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/Maalem.dc.html',
  '/manifest.json',
  '/maalem-logo.png'
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
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request);
    })
  );
});

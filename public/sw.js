
/**
 * Citydrive Service Worker
 * Provides basic caching and PWA installability.
 */

const CACHE_NAME = 'citydrive-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // For standard PWA functionality, we pass through requests.
  // This satisfies browser requirements for installability.
  event.respondWith(fetch(event.request));
});

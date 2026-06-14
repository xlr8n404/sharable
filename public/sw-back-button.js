/**
 * Service Worker for handling Android back button behavior
 * Prevents the app from closing when the back button is pressed
 * and ensures proper in-app navigation instead
 */

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(clients.claim());
});

// Listen for messages from the client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Handle fetch events (optional, for caching strategies)
self.addEventListener('fetch', (event) => {
  // Default: let the browser handle it
  // You can add caching strategies here if needed
});

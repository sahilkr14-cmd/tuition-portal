// sw.js
// Service Worker to cache static assets for offline capability and instant loads.

const CACHE_NAME = "elitetutors-cache-v1";
const ASSETS = [
  "/",
  "/index.html",
  "/admin.html",
  "/style.css",
  "/database.js",
  "/app.js",
  "/admin.js",
  "/logo.svg",
  "/manifest.json"
];

// Install Event
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Caching application shell assets...");
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("Clearing outdated cache versions...");
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event (Cache-first with network fallback)
self.addEventListener("fetch", (e) => {
  // Exclude API requests from being cached by Service Worker to ensure real-time operations
  if (e.request.url.includes("/api/")) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(e.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }
        // Dynamically cache new static assets
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, responseToCache);
        });
        return networkResponse;
      });
    }).catch(() => {
      // Offline fallback handling
      if (e.request.mode === "navigate") {
        return caches.match("/index.html");
      }
    })
  );
});

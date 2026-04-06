// Service Worker for caching static assets
const CACHE_NAME = 'reporadar-v1';
const STATIC_CACHE_DURATION = 365 * 24 * 60 * 60 * 1000; // 1 year
const DYNAMIC_CACHE_DURATION = 24 * 60 * 60 * 1000; // 1 day

// Assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Service Worker: Static assets cached');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Failed to cache static assets', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip external requests
  if (url.origin !== location.origin) {
    return;
  }

  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        // Return cached response if available and not expired
        if (cachedResponse) {
          const cachedDate = new Date(cachedResponse.headers.get('date') || 0);
          const now = new Date();
          const age = now.getTime() - cachedDate.getTime();
          
          // Check if cache is still valid
          const maxAge = isStaticAsset(url.pathname) ? STATIC_CACHE_DURATION : DYNAMIC_CACHE_DURATION;
          
          if (age < maxAge) {
            console.log('Service Worker: Serving from cache', request.url);
            return cachedResponse;
          }
        }

        // Fetch from network and cache the response
        return fetch(request)
          .then((networkResponse) => {
            // Don't cache error responses
            if (!networkResponse.ok) {
              return networkResponse;
            }

            // Clone the response before caching
            const responseToCache = networkResponse.clone();
            
            caches.open(CACHE_NAME)
              .then((cache) => {
                console.log('Service Worker: Caching new response', request.url);
                cache.put(request, responseToCache);
              })
              .catch((error) => {
                console.error('Service Worker: Failed to cache response', error);
              });

            return networkResponse;
          })
          .catch((error) => {
            console.error('Service Worker: Network request failed', error);
            
            // Return cached response as fallback, even if expired
            if (cachedResponse) {
              console.log('Service Worker: Serving stale cache as fallback', request.url);
              return cachedResponse;
            }
            
            // Return offline page for navigation requests
            if (request.mode === 'navigate') {
              return caches.match('/offline.html') || new Response('Offline', { status: 503 });
            }
            
            throw error;
          });
      })
  );
});

// Helper function to determine if an asset is static
function isStaticAsset(pathname) {
  const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2'];
  return staticExtensions.some(ext => pathname.endsWith(ext)) || pathname.includes('/assets/');
}

// Message event - handle cache management commands
self.addEventListener('message', (event) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'CLEAR_CACHE':
      caches.delete(CACHE_NAME)
        .then(() => {
          console.log('Service Worker: Cache cleared');
          event.ports[0].postMessage({ success: true });
        })
        .catch((error) => {
          console.error('Service Worker: Failed to clear cache', error);
          event.ports[0].postMessage({ success: false, error: error.message });
        });
      break;

    case 'GET_CACHE_SIZE':
      caches.open(CACHE_NAME)
        .then((cache) => cache.keys())
        .then((keys) => {
          console.log('Service Worker: Cache contains', keys.length, 'items');
          event.ports[0].postMessage({ size: keys.length });
        })
        .catch((error) => {
          console.error('Service Worker: Failed to get cache size', error);
          event.ports[0].postMessage({ size: 0, error: error.message });
        });
      break;

    case 'PRECACHE_ROUTES':
      if (payload && payload.routes) {
        caches.open(CACHE_NAME)
          .then((cache) => {
            return cache.addAll(payload.routes);
          })
          .then(() => {
            console.log('Service Worker: Routes precached');
            event.ports[0].postMessage({ success: true });
          })
          .catch((error) => {
            console.error('Service Worker: Failed to precache routes', error);
            event.ports[0].postMessage({ success: false, error: error.message });
          });
      }
      break;

    default:
      console.warn('Service Worker: Unknown message type', type);
  }
});
// VERITAS Admin Progressive Web App Service Worker
// Conservative, high-integrity offline cache for static assets only.
// Sensitive APIs, orders, Supabase data, and PayFast are NEVER cached.

const CACHE_VERSION = 'veritas-admin-v2.0.0';
const STATIC_CACHE_NAME = `veritas-admin-static-${CACHE_VERSION}`;

// Pre-cached static immutable shell assets (strictly non-code assets)
const PRECACHE_ASSETS = [
  '/manifest.webmanifest',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-maskable-512x512.png',
  '/apple-touch-icon.png',
  '/icons/icon.svg',
  '/favicon.png'
];

// Patterns that MUST NEVER be cached or intercepted by the service worker
const SENSITIVE_URL_PATTERNS = [
  /\/api\/admin\//i,
  /\/api\/orders\//i,
  /\/api\/payfast\//i,
  /\/api\/gemini\//i,
  /supabase\.co/i,
  /auth\/v1/i,
  /rest\/v1/i,
  /storage\/v1/i,
  /\.rsc$/i,
  /\.json$/i,
  /_next\//i,
  /__nextjs/i
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Pre-caching non-fatal asset warning:', err);
      });
    }).then(() => {
      // Force active immediately on install
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            return (
              (cacheName.startsWith('veritas-admin-') || cacheName.startsWith('veritas-')) &&
              cacheName !== STATIC_CACHE_NAME
            );
          })
          .map((cacheName) => {
            console.log('[SW] Deleting obsolete cache:', cacheName);
            return caches.delete(cacheName);
          })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Never intercept non-GET requests (mutations: POST, PUT, DELETE, PATCH)
  if (request.method !== 'GET') {
    return;
  }

  // 2. Strict Security Boundary: Never cache sensitive endpoints
  const isSensitive = 
    SENSITIVE_URL_PATTERNS.some((pattern) => pattern.test(request.url)) || 
    request.headers.has('RSC') || 
    request.headers.has('Next-Router-State-Tree');
    
  if (isSensitive) {
    // Network-only, bypass Service Worker cache entirely
    return;
  }

  // 3. Static Icons, Manifest, and Fonts (Cache-First or Stale-While-Revalidate)
  const isStaticAsset = 
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/apple-touch-icon.png' ||
    url.pathname === '/favicon.png' ||
    url.pathname === '/manifest.webmanifest' ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com');

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Fetch update in background for freshness
          fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(STATIC_CACHE_NAME).then((cache) => {
                cache.put(request, networkResponse);
              });
            }
          }).catch(() => {});
          return cachedResponse;
        }

        return fetch(request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(STATIC_CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
          return networkResponse;
        });
      })
    );
    return;
  }

  // 4. HTML Navigation Requests for Admin (/admin/*)
  // Network-First with graceful fallback to prevent stale stock/orders/payment data
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          return networkResponse;
        })
        .catch(async () => {
          // Check if there is a cached response
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }

          // Return offline fallback HTML shell
          return new Response(
            `<!DOCTYPE html>
            <html lang="en" class="dark">
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <title>VERITAS Admin — Offline</title>
              <style>
                body {
                  margin: 0;
                  padding: 24px;
                  background-color: #070707;
                  color: #E0E0E0;
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  min-height: 100vh;
                  box-sizing: border-box;
                }
                .card {
                  max-width: 440px;
                  width: 100%;
                  background: #0E0E0E;
                  border: 1px solid #222;
                  padding: 32px;
                  border-radius: 4px;
                  text-align: center;
                  box-shadow: 0 20px 40px rgba(0,0,0,0.8);
                }
                .logo {
                  width: 44px;
                  height: 44px;
                  background: #fff;
                  margin: 0 auto 20px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                }
                .diamond {
                  width: 20px;
                  height: 20px;
                  background: #000;
                  transform: rotate(45deg);
                }
                h1 {
                  font-size: 16px;
                  letter-spacing: 0.15em;
                  text-transform: uppercase;
                  color: #fff;
                  margin: 0 0 8px;
                }
                .status {
                  font-size: 11px;
                  color: #D4AF37;
                  font-family: monospace;
                  letter-spacing: 0.1em;
                  margin-bottom: 16px;
                }
                p {
                  font-size: 13px;
                  line-height: 1.6;
                  color: #888;
                  margin: 0 0 24px;
                }
                button {
                  background: #D4AF37;
                  color: #000;
                  border: none;
                  padding: 10px 24px;
                  font-size: 11px;
                  font-weight: bold;
                  font-family: monospace;
                  letter-spacing: 0.15em;
                  text-transform: uppercase;
                  cursor: pointer;
                  border-radius: 2px;
                }
                button:hover {
                  background: #B3932F;
                }
              </style>
            </head>
            <body>
              <div class="card">
                <div class="logo">
                  <div class="diamond"></div>
                </div>
                <h1>VERITAS Admin</h1>
                <div class="status">DISCONNECTED FROM NETWORK</div>
                <p>You are offline. Live VERITAS Admin data is temporarily unavailable. Reconnect to the internet to resume operations.</p>
                <button onclick="window.location.reload()">Retry Connection</button>
              </div>
            </body>
            </html>`,
            {
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            }
          );
        })
    );
  }
});

// ==============================================================================
// 5. WEB PUSH NOTIFICATIONS & CLICK HANDLER
// ==============================================================================

self.addEventListener('push', (event) => {
  let payload = {
    title: 'VERITAS Admin',
    body: 'New operational alert',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    data: { url: '/admin/notifications' },
    tag: `veritas-${Date.now()}`,
  };

  if (event.data) {
    try {
      const data = event.data.json();
      payload = {
        title: data.title || 'VERITAS Admin',
        body: data.body || 'New operational alert',
        icon: data.icon || '/icons/icon-192x192.png',
        badge: data.badge || '/icons/icon-192x192.png',
        tag: data.tag || `veritas-${data.type || 'alert'}-${Date.now()}`,
        data: {
          url: data.url || '/admin/notifications',
          type: data.type,
          notificationId: data.notificationId,
        },
      };
    } catch {
      payload.body = event.data.text() || 'New operational alert';
    }
  }

  const options = {
    body: payload.body,
    icon: payload.icon,
    badge: payload.badge,
    tag: payload.tag,
    data: payload.data,
    vibrate: [100, 50, 100],
    requireInteraction: payload.data?.type === 'paid_order' || payload.data?.type === 'payment_attention',
    actions: [
      { action: 'open', title: 'View Details' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = event.notification.data?.url || '/admin/notifications';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If an existing Admin window is already open, focus it and navigate
      for (const client of clientList) {
        if (client.url.includes('/admin') && 'focus' in client) {
          if ('navigate' in client && targetUrl) {
            return client.navigate(targetUrl).then((focusedClient) => focusedClient.focus());
          }
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

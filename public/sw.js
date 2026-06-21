// ============================================================
// Fresh Mart London — Service Worker
// Basic caching strategy:
//   - Cache-first for static assets (JS, CSS, images, fonts)
//   - Network-first for API calls and HTML pages
//   - App shell cached for offline access
//
// IMPORTANT: Bump CACHE_NAME + STATIC_CACHE_NAME version numbers
// whenever you want to force ALL clients to drop their old caches.
// The activate handler deletes any cache whose name doesn't match
// the current version.
// ============================================================

const CACHE_NAME = 'freshmart-v2-login-fix'
const STATIC_CACHE_NAME = 'freshmart-static-v2-login-fix'

// Static assets to pre-cache (app shell)
const APP_SHELL = [
  '/',
  '/manifest.json',
  '/logo.svg',
  '/icon-192.png',
  '/icon-512.png',
]

// File extensions that should use cache-first strategy
const STATIC_EXTENSIONS = [
  '.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg',
  '.ico', '.woff', '.woff2', '.ttf', '.eot', '.webp',
]

// Install event: pre-cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL)
    }).then(() => self.skipWaiting())
  )
})

// Activate event: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      console.log('[SW] Activating. Existing caches:', cacheNames)
      // Delete EVERY cache that doesn't match the current version names.
      // This is aggressive on purpose — any time we bump the version,
      // ALL old caches get wiped, including any stale API responses
      // that may have been cached by a previous (buggy) SW version.
      const cachesToDelete = cacheNames.filter(
        (name) => name !== CACHE_NAME && name !== STATIC_CACHE_NAME
      )
      console.log('[SW] Deleting old caches:', cachesToDelete)
      return Promise.all(cachesToDelete.map((name) => caches.delete(name)))
    }).then(() => self.clients.claim())
      .then(() => {
        // Tell all open tabs to refresh so they pick up the new SW
        return self.clients.matchAll({ type: 'window' })
      })
      .then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'SW_UPDATED' })
        })
      })
  )
})

// Fetch event: routing strategy
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // NEVER intercept non-GET requests (POST, PUT, DELETE, etc.)
  // This includes /api/auth/login, /api/auth/logout, etc.
  // Let them go straight to the network.
  if (request.method !== 'GET') return

  // Skip cross-origin requests (except our own)
  if (url.origin !== location.origin) return

  // API calls: network-first, but DON'T cache auth endpoints
  if (url.pathname.startsWith('/api/')) {
    // Never cache auth-related API endpoints — always go to network
    if (url.pathname.startsWith('/api/auth/')) {
      event.respondWith(fetch(request))
      return
    }
    event.respondWith(networkFirst(request))
    return
  }

  // Static assets: cache-first
  const isStaticAsset = STATIC_EXTENSIONS.some((ext) =>
    url.pathname.endsWith(ext)
  )

  if (isStaticAsset) {
    event.respondWith(cacheFirst(request))
    return
  }

  // HTML pages: network-first with offline fallback
  event.respondWith(networkFirstWithOfflineFallback(request))
})

// ─── Cache Strategies ────────────────────────────────────────

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached

  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE_NAME)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return new Response('', { status: 408, statusText: 'Request timeout' })
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    return new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

async function networkFirstWithOfflineFallback(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached

    // Fallback to the cached root page for SPA routing
    const fallback = await caches.match('/')
    if (fallback) return fallback

    return new Response('Offline — Please check your connection', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    })
  }
}

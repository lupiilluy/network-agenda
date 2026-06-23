const CACHE_NAME = 'network-intelligence-v4'
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/icon-512.png', '/icon-maskable-512.png', '/apple-touch-icon.png']

function isSameOrigin(request) {
  return new URL(request.url).origin === self.location.origin
}

function canCache(response) {
  return response && (response.ok || response.type === 'opaque')
}

async function cachePut(request, response) {
  if (!canCache(response)) return
  const cache = await caches.open(CACHE_NAME)
  await cache.put(request, response.clone())
}

async function networkFirst(request, fallbackUrl = '/index.html') {
  try {
    const response = await fetch(request)
    await cachePut(request, response)
    return response
  } catch {
    return (await caches.match(request)) || caches.match(fallbackUrl)
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request)
  const network = fetch(request)
    .then(async (response) => {
      await cachePut(request, response)
      return response
    })
    .catch(() => null)
  if (cached) return cached
  return (await network) || caches.match('/index.html')
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  )
  if (self.registration?.navigationPreload) {
    event.waitUntil(self.registration.navigationPreload.enable().catch(() => {}))
  }
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET' || !isSameOrigin(request)) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request))
    return
  }

  if (['script', 'style', 'worker', 'image', 'font', 'manifest'].includes(request.destination)) {
    event.respondWith(staleWhileRevalidate(request))
    return
  }

  event.respondWith(networkFirst(request))
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

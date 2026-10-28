// Service worker de la PWA. scripts/build-pwa.mjs completa VERSION y FILES.
const VERSION = '__VERSION__'
const FILES = [] /* __FILES__ */
const CACHE = 'chanchito-' + VERSION

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('chanchito-') && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

// La app pide actualizar cuando el usuario toca "Actualizar".
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') void self.skipWaiting()
})

// Primero el caché (anda sin internet); las rutas de la app son todas el mismo index.
self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  const key = req.mode === 'navigate' ? '/' : url.pathname
  event.respondWith(
    caches
      .open(CACHE)
      .then((cache) => cache.match(key))
      .then((hit) => hit ?? fetch(req)),
  )
})

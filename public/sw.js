/* Conservative app-shell cache. Remote services and game data are never cached. */
const CACHE_NAME = 'paleciaki-magazyn-chaosu-shell-v1';
const OFFLINE_URL = './offline.html';
const MAX_CACHEABLE_BYTES = 6 * 1024 * 1024;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll([OFFLINE_URL])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => (key.startsWith('operacja-b4-') || key.startsWith('paleciaki-magazyn-chaosu-shell-')) && key !== CACHE_NAME).map((key) => caches.delete(key))
  )).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.includes('/__/') || url.pathname.includes('/api/')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) || Response.error()));
    return;
  }
  if (!/\.(?:js|css|woff2?|png|jpe?g|webp|avif|svg|glb|gltf|mp3|ogg|wav)$/i.test(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(request);
      const length = Number(response.headers.get('content-length') || 0);
      if (response.ok && response.type === 'basic' && (!length || length <= MAX_CACHEABLE_BYTES)) {
        await cache.put(request, response.clone());
      }
      return response;
    } catch {
      return (await cache.match(request)) || Response.error();
    }
  })());
});

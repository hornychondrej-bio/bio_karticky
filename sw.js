// Network-first service worker: tries fresh files first (so CSV edits show up right after a deploy),
// falls back to the cache when offline or when the network is slower than NETWORK_TIMEOUT.
// Bump CACHE when the SHELL list changes.
const CACHE = 'bio-karticky-v2';
const NETWORK_TIMEOUT = 4000;
const SHELL = [
  './',
  'index.html',
  'css/style.css',
  'js/app.js',
  'js/cards.js',
  'js/csv.js',
  'js/data.js',
  'js/fsrs.js',
  'js/scheduler.js',
  'js/stats.js',
  'js/store.js',
  'js/time.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

/** Caches the manifest and every card CSV it lists, so the first visit already works offline. */
async function precacheData(cache) {
  try {
    const res = await fetch('data/packages.json', { cache: 'reload' });
    if (!res.ok) return;
    await cache.put('data/packages.json', res.clone());
    const manifest = await res.json();
    await Promise.all(
      (manifest.packages ?? []).map(async (p) => {
        const csv = await fetch(`data/${p.file}`, { cache: 'reload' });
        if (csv.ok) await cache.put(`data/${p.file}`, csv);
      }),
    );
  } catch {
    // Offline or broken data must not block installing the app shell.
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await cache.addAll(SHELL);
      await precacheData(cache);
    }),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(req) {
  const network = fetch(req).then((res) => {
    if (res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then((cache) => cache.put(req, copy));
    }
    return res;
  });
  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), NETWORK_TIMEOUT));
  try {
    const res = await Promise.race([network, timeout]);
    if (res) return res;
    // Network is slow: use the cache if we have the file, otherwise keep waiting for the network.
    return (await caches.match(req)) ?? network;
  } catch {
    return (await caches.match(req)) ?? (await caches.match('index.html'));
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  event.respondWith(networkFirst(req));
});

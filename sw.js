/* СтройУчёт MAX — service worker. Меняйте VERSION при каждом выпуске. */
const VERSION = 'su-v18-5';
const SHELL = `shell-${VERSION}`;
const RUNTIME = 'runtime-libs';
const PRECACHE = [
  './', './index.html', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png',
  './icons/apple-icon-180.png', './icons/favicon.png'
];
const LIB_HOSTS = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('shell-') && k !== SHELL).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Supabase (API, Storage, Realtime) и всё прочее чужое — только сеть, не трогаем
  if (url.origin !== location.origin && !LIB_HOSTS.includes(url.hostname)) return;

  // Библиотеки с CDN: из кэша, обновляем в фоне
  if (LIB_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.open(RUNTIME).then(async c => {
        const hit = await c.match(req);
        const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; }).catch(() => hit);
        return hit || net;
      })
    );
    return;
  }

  // Страница: сначала сеть (чтобы получать обновления), без сети — из кэша
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(r => { const copy = r.clone(); caches.open(SHELL).then(c => c.put('./index.html', copy)); return r; })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // Остальные свои файлы (иконки и т.п.): кэш, затем сеть
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(SHELL).then(c => c.put(req, copy)); }
      return r;
    }))
  );
});

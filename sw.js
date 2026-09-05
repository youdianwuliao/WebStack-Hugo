const CACHE = 'navsite-v44';
const CORE = [
  './',
  './index.html',
  './gushi.html',
  './gushi/index.html',
  './gushi/gushi.css',
  './gushi/gushi.js',
  './maoxuan/',
  './maoxuan/index.html',
  './jianfen/',
  './jianfen/index.html',
  './jianfen/data.js',
  './json/',
  './json/index.html',
  './qrcode/',
  './qrcode/index.html',
  './qrcode/jsqr.js',
  './markdown/',
  './markdown/index.html',
  './encode/',
  './encode/index.html',
  './image/',
  './image/index.html',
  './tools/',
  './tools/index.html',
  './dev/',
  './dev/index.html',
  './nav.json',
  './assets/js/pinyin-map.js',
  './assets/js/quotes.js',
  './404.html',
  './manifest.webmanifest',
  './assets/favicon.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.allSettled(CORE.map((u) => cache.add(u)));
      self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) return;
  if (request.url.includes('/api/counter')) return;
  // ffmpeg 资源（31MB 分片等）不做 SW 缓存：体积大、更新频繁，
  // 缓存到旧版本会污染 wasmBinary 加载链路（详见 index.html vgLoadFFmpeg）。
  if (request.url.includes('/image/ffmpeg/')) return;

  e.respondWith(
    (async () => {
      let cache, cached;
      try {
        cache = await caches.open(CACHE);
        cached = await cache.match(request);
      } catch (_) {}

      const fromNetwork = async () => {
        try {
          const res = await fetch(request);
          if (res && res.status === 200 && res.type === 'basic' && cache) {
            cache.put(request, res.clone()).catch(() => {});
          }
          return res;
        } catch (_) {
          return cached;
        }
      };

      if (cached) {
        e.waitUntil(fromNetwork().catch(() => {}));
        return cached;
      }
      return fromNetwork();
    })()
  );
});

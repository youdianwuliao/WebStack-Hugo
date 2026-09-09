const CACHE = 'navsite-v61';
// 安装时只预缓存首页冷启动路径。拼音/金句按需加载；子站 HTML / 题库 / jsqr
// 仍由下方 fetch 在首次访问时写入同一 CACHE，访问过的页面离线可用。
const CORE = [
  './',
  './index.html',
  './gushi/gushi.css',
  './gushi/gushi.js',
  './nav.json',
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

// HTML 文档网络优先：改版后刷新即生效，只有在断网时才回退缓存。
// 静态资源仍走 stale-while-revalidate（见下方 fetch 处理），兼顾速度。
function isHtmlRequest(request) {
  if (request.mode === 'navigate' || request.destination === 'document') return true;
  return /\.html?(?:[?#]|$)/.test(request.url);
}

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) return;
  if (request.url.includes('/api/counter')) return;
  // ffmpeg 资源（31MB 分片等）不做 SW 缓存：体积大、更新频繁，
  // 缓存到旧版本会污染 wasmBinary 加载链路（详见 index.html vgLoadFFmpeg）。
  if (request.url.includes('/image/ffmpeg/')) return;

  if (isHtmlRequest(request)) {
    e.respondWith(
      (async () => {
        let cache, cached;
        try {
          cache = await caches.open(CACHE);
          cached = await cache.match(request);
        } catch (_) {}
        try {
          const res = await fetch(request);
          if (res && res.status === 200 && cache) cache.put(request, res.clone()).catch(() => {});
          return res;
        } catch (_) {
          return cached || Response.error();
        }
      })()
    );
    return;
  }

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

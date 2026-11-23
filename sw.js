/**
 * sw.js - Service Worker（PWA 离线外壳缓存）
 * -------------------------------------------------
 * 策略：
 *  - 核心静态资源（页面/样式/脚本）安装时预缓存
 *  - 页面/JS/CSS 一律「网络优先，离线兜底」，保证每次打开都拿到最新版本
 *    （业务 JS 更新频繁，cache-first 会导致上传新代码后用户仍看到旧界面）
 *  - 图标等稳定资源缓存优先（快速 + 离线可用）
 *  - 高德 CDN 跨域资源：网络直连，不缓存
 * 版本号：改动任何静态资源时 +1，触发自动更新
 */
const CACHE = 'bx-sj-v3';

const CORE = [
  './',
  './index.html',
  './manifest.json',
  './css/base.css',
  './css/layout.css',
  './css/pages.css',
  './js/store.js',
  './js/router.js',
  './js/app.js',
  './js/utils/time.js',
  './js/utils/ui.js',
  './js/utils/validate.js',
  './js/utils/amap.js',
  './js/utils/export.js',
  './js/utils/lead-builder.js',
  './js/pages/home.js',
  './js/pages/input.js',
  './js/pages/detail.js',
  './js/pages/stats.js',
  './js/pages/mine.js',
  './js/pages/share.js',
  './js/pages/guide.js',
  './config/amap-key.js',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

/* 安装：预缓存核心 */
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(CORE).catch(function (err) {
        // 单个资源失败不影响整体安装（有些可选资源如 diag.html 不预缓存）
        console.warn('[SW] 部分资源预缓存失败', err);
      });
    }).then(function () {
      self.skipWaiting();
    })
  );
});

/* 激活：清理旧版本缓存 */
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () {
      self.clients.claim();
    })
  );
});

/* 请求拦截 */
self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // 仅处理同源资源；跨域（高德 CDN）直接放行
  if (url.origin !== location.origin) return;

  const isDoc = req.mode === 'navigate';
  const isAppCode = /\.(js|css)$/.test(url.pathname);

  // 页面 / JS / CSS：网络优先，失败用缓存兜底（离线可用）
  // 这样业务代码每次更新上传后，打开页面即是最新，不被缓存锁死
  if (isDoc || isAppCode) {
    event.respondWith(
      fetch(req)
        .then(function (res) {
          if (res && res.ok && !url.pathname.includes('diag')) {
            const copy = res.clone();
            caches.open(CACHE).then(function (c) { c.put(req, copy); });
          }
          return res;
        })
        .catch(function () {
          return caches.match(req).then(function (hit) {
            return hit || caches.match('./index.html');
          });
        })
    );
    return;
  }

  // 其它静态资源（图标/manifest 等）：缓存优先，成功后后台刷新
  event.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) {
        const refresh = fetch(req).then(function (res) {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(function (c) { c.put(req, copy); });
          }
          return res;
        }).catch(function () {});
        // 触发后台刷新，但先返回缓存
        refresh;
        return hit;
      }
      return fetch(req).then(function (res) {
        if (res && res.ok && !url.pathname.includes('diag')) {
          const copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match('./index.html');
      });
    })
  );
});

/* Oflayn ishlash uchun oddiy cache — yo'lda internetsiz test yechish mumkin */
var CACHE = 'attest-v1';
var ASSETS = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'questions.js',
  'sheet.js',
  'icon.svg',
  'manifest.webmanifest'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (ks) {
      return Promise.all(ks.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      if (hit) {
        // fon rejimida yangilab qo'yamiz
        fetch(e.request).then(function (r) {
          if (r && r.ok) caches.open(CACHE).then(function (c) { c.put(e.request, r.clone()); });
        }).catch(function () {});
        return hit;
      }
      return fetch(e.request).then(function (r) {
        if (r && r.ok && e.request.url.indexOf('http') === 0) {
          var cp = r.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, cp); });
        }
        return r;
      }).catch(function () { return caches.match('index.html'); });
    })
  );
});

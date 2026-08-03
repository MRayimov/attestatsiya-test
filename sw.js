/* Oflayn ishlash uchun oddiy cache — yo'lda internetsiz test yechish mumkin.
   Faqat SHU sayt fayllari keshlanadi; Supabase so'rovlari keshlanmaydi. */
var CACHE = 'attest-v2';
var ASSETS = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'questions.js',
  'sheet.js',
  'config.js',
  'sync.js',
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

  // Boshqa domenlar (Supabase API) — keshsiz, to'g'ridan-to'g'ri tarmoqqa
  var url;
  try { url = new URL(e.request.url); } catch (x) { return; }
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(e.request).then(function (hit) {
      if (hit) {
        // fon rejimida yangilab qo'yamiz (stale-while-revalidate)
        fetch(e.request).then(function (r) {
          if (r && r.ok) caches.open(CACHE).then(function (c) { c.put(e.request, r.clone()); });
        }).catch(function () {});
        return hit;
      }
      return fetch(e.request).then(function (r) {
        if (r && r.ok) {
          var cp = r.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, cp); });
        }
        return r;
      }).catch(function () { return caches.match('index.html'); });
    })
  );
});

/* Oflayn ishlash uchun kesh — yo'lda internetsiz test yechish mumkin.
   Faqat SHU sayt fayllari keshlanadi; Supabase so'rovlari keshlanmaydi. */
var CACHE = 'attest-v14';
var ASSETS = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'questions.js',
  'sheet.js',
  'cards.js',
  'config.js',
  'sync.js',
  'icon.svg',
  'manifest.webmanifest'
];

// Bittasi yiqilsa butun addAll yiqilmasin — har birini alohida qo'yamiz
function precache() {
  return caches.open(CACHE).then(function (c) {
    return Promise.all(ASSETS.map(function (a) {
      return fetch(a, { cache: 'reload' })
        .then(function (r) { return r && r.ok ? c.put(a, r) : null; })
        .catch(function () { return null; });
    }));
  });
}

self.addEventListener('install', function (e) {
  e.waitUntil(precache().then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (ks) {
        return Promise.all(ks.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
      })
      // O'z-o'zini tiklash: kesh brauzer tomonidan tozalangan bo'lsa qayta to'ldiriladi
      .then(precache)
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch (x) { return; }

  // Boshqa domenlar (Supabase API) — keshsiz, to'g'ridan-to'g'ri tarmoqqa
  if (url.origin !== self.location.origin) return;

  // Sahifaga kirish: avval tarmoq, ilinmasa keshdagi index.html.
  // Nusxa DOIM «index.html» kaliti ostida saqlanadi — shunda «?v=123» kabi
  // so'rov qatorlari alohida yozuv yaratmaydi va oflayn kirish ishlayveradi.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (r) {
        if (r && r.ok) {
          var cp = r.clone();
          caches.open(CACHE).then(function (c) { c.put('index.html', cp); });
        }
        return r;
      }).catch(function () {
        return caches.match('index.html').then(function (hit) {
          return hit || caches.match('./');
        });
      })
    );
    return;
  }

  // Qolgan fayllar: keshdan tez beriladi, fonda yangilanadi
  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) {
        fetch(req).then(function (r) {
          if (r && r.ok) caches.open(CACHE).then(function (c) { c.put(req, r.clone()); });
        }).catch(function () {});
        return hit;
      }
      return fetch(req).then(function (r) {
        if (r && r.ok) {
          var cp = r.clone();
          caches.open(CACHE).then(function (c) { c.put(req, cp); });
        }
        return r;
      });
    })
  );
});

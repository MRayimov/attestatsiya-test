/* ============================================================
   Bulutli sinxronizatsiya — Supabase Auth + PostgREST
   Tashqi kutubxonasiz: oddiy fetch. Local-first —
   localStorage har doim asosiy manba, bulut faqat ustiga qo'shiladi.
   ============================================================ */
window.Sync = (function () {
  'use strict';

  var AKEY = 'attest.auth';
  var URL_ = (window.SUPABASE_URL || '').replace(/\/+$/, '');
  var ANON = window.SUPABASE_ANON_KEY || '';

  // Supabase Auth ichkarida email talab qiladi, lekin foydalanuvchi
  // faqat ISM yozadi. Ism shu domenga ulanadi. «.invalid» — RFC 6761
  // bo'yicha kafolatlangan mavjud bo'lmagan domen: bu manzilga hech qachon
  // haqiqiy xat ketmaydi, shuning uchun begona odamga tushib qolmaydi.
  var LOGIN_DOMAIN = 'attestatsiya.invalid';

  var TRANSLIT = {
    а:'a',б:'b',в:'v',г:'g',ғ:'g',д:'d',е:'e',ё:'yo',ж:'j',з:'z',и:'i',й:'y',
    к:'k',қ:'q',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ў:'o',
    ф:'f',х:'x',ҳ:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sh',ъ:'',ы:'i',ь:'',э:'e',ю:'yu',я:'ya'
  };

  // «Muhammad Rayimov» -> «muhammad.rayimov»
  function slug(s) {
    var t = String(s || '').trim().toLowerCase();
    t = t.replace(/[Ѐ-ӿ]/g, function (c) { return TRANSLIT[c] !== undefined ? TRANSLIT[c] : c; });
    t = t.replace(/[ʻʼ'’`]/g, '');
    t = t.replace(/[\s_]+/g, '.');
    t = t.replace(/[^a-z0-9.\-]/g, '');
    t = t.replace(/\.{2,}/g, '.').replace(/^[.\-]+|[.\-]+$/g, '');
    return t;
  }

  // Ism -> ichki email. Foydalanuvchi haqiqiy email yozsa — o'zgarishsiz qoladi.
  function toEmail(login) {
    var v = String(login || '').trim();
    if (v.indexOf('@') > 0) return v.toLowerCase();
    var s = slug(v);
    return s ? s + '@' + LOGIN_DOMAIN : '';
  }

  // Ichki emaildan ko'rsatiladigan ismni ajratish
  function toLogin(email) {
    var v = String(email || '');
    return v.indexOf('@' + LOGIN_DOMAIN) > 0 ? v.split('@')[0] : v;
  }

  var bound = null;           // {get, set}
  var listeners = [];
  var state = { on: false, status: 'off', email: '', at: 0, msg: '' };
  var busy = false, dirty = false, timer = null;

  function configured() { return !!(URL_ && ANON); }

  /* -------------------- token saqlash -------------------- */
  function auth() {
    try { return JSON.parse(localStorage.getItem(AKEY) || 'null'); } catch (e) { return null; }
  }
  function setAuth(a) {
    if (a) localStorage.setItem(AKEY, JSON.stringify(a));
    else localStorage.removeItem(AKEY);
  }

  function emit(patch) {
    for (var k in patch) state[k] = patch[k];
    listeners.forEach(function (f) { try { f(state); } catch (e) {} });
  }
  function on(f) { listeners.push(f); f(state); }

  /* -------------------- HTTP -------------------- */
  function req(path, opts) {
    opts = opts || {};
    var h = opts.headers || {};
    h.apikey = ANON;
    h['Content-Type'] = 'application/json';
    return fetch(URL_ + path, {
      method: opts.method || 'GET',
      headers: h,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (r) {
      return r.text().then(function (t) {
        var j = null;
        try { j = t ? JSON.parse(t) : null; } catch (e) {}
        if (!r.ok) {
          var e2 = new Error((j && (j.msg || j.message || j.error_description || j.error)) || ('HTTP ' + r.status));
          e2.status = r.status;
          throw e2;
        }
        return j;
      });
    });
  }

  // Server/tarmoq xatolarini o'qiladigan matnga aylantirish
  function friendly(e) {
    var m = (e && e.message) || '';
    if (/Failed to fetch|NetworkError|load failed|ERR_/i.test(m) || !navigator.onLine)
      return new Error('Internet yo\'q yoki server javob bermayapti. Keyinroq urinib ko\'ring — progress shu qurilmada saqlanib turadi.');
    if (/Invalid login credentials/i.test(m)) return new Error('Ism yoki parol noto\'g\'ri. Ilk marta bo\'lsa — «Ro\'yxatdan o\'tish».');
    if (/already registered|already been registered/i.test(m)) return new Error('Bu ism allaqachon band — «Kirish» tugmasini bosing.');
    if (/Email not confirmed/i.test(m)) return new Error('Hisob tasdiqlanmagan. Supabase panelida Authentication → Email → «Confirm email» ni o\'chiring, keyin qayta urinib ko\'ring.');
    if (/Password should be at least/i.test(m)) return new Error('Parol kamida 6 belgidan iborat bo\'lsin.');
    if (/valid email|Unable to validate email/i.test(m)) return new Error('Ismda faqat harf, raqam, nuqta va chiziqcha ishlatiladi.');
    if (/rate limit|too many/i.test(m)) return new Error('Juda ko\'p urinish. Bir necha daqiqadan keyin qayta urinib ko\'ring.');
    if (/relation .* does not exist|schema cache/i.test(m)) return new Error('Bazada «progress» jadvali topilmadi — SQL skriptini ishga tushirish kerak.');
    return e;
  }

  function authed(path, opts) {
    var a = auth();
    if (!a) return Promise.reject(new Error('Kirilmagan'));
    opts = opts || {};
    opts.headers = opts.headers || {};
    opts.headers.Authorization = 'Bearer ' + a.access_token;
    return req(path, opts).catch(function (e) {
      if (e.status !== 401) throw e;
      return refresh().then(function () {
        opts.headers.Authorization = 'Bearer ' + auth().access_token;
        return req(path, opts);
      });
    });
  }

  function refresh() {
    var a = auth();
    if (!a || !a.refresh_token) return Promise.reject(new Error('Sessiya tugagan'));
    return req('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', body: { refresh_token: a.refresh_token }
    }).then(function (r) { return store(r); })
      .catch(function (e) { signOut(); throw new Error('Sessiya tugagan — qaytadan kiring'); });
  }

  function store(r) {
    if (!r || !r.access_token) throw new Error('Token olinmadi');
    var a = {
      access_token: r.access_token,
      refresh_token: r.refresh_token,
      user_id: r.user && r.user.id,
      email: (r.user && r.user.email) || (auth() || {}).email || '',
      exp: Date.now() + (r.expires_in || 3600) * 1000
    };
    setAuth(a);
    emit({ on: true, email: toLogin(a.email) });
    return a;
  }

  /* -------------------- auth -------------------- */
  function signUp(login, password) {
    if (!configured()) return Promise.reject(new Error('Sinxronizatsiya sozlanmagan'));
    var email = toEmail(login);
    if (!email) return Promise.reject(new Error('Ism kiriting (harf va raqamlardan).'));
    return req('/auth/v1/signup', { method: 'POST', body: { email: email, password: password } })
      .then(function (r) {
        if (!r || !r.access_token) {
          // «Confirm email» yoqilgan — soxta domenga xat bora olmaydi
          throw new Error('Supabase panelida Authentication → Email → «Confirm email» yoqilgan. Uni o\'chiring, keyin qayta urinib ko\'ring.');
        }
        store(r);
        return syncNow();
      })
      .catch(function (e) { throw friendly(e); });
  }

  function signIn(login, password) {
    if (!configured()) return Promise.reject(new Error('Sinxronizatsiya sozlanmagan'));
    var email = toEmail(login);
    if (!email) return Promise.reject(new Error('Ism kiriting (harf va raqamlardan).'));
    return req('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: email, password: password } })
      .then(function (r) { store(r); return syncNow(); })
      .catch(function (e) { throw friendly(e); });
  }

  // «Confirm email» holati — soxta domen bilan u YOQILGAN bo'lsa ro'yxatdan o'tib bo'lmaydi
  var settingsCache = null;
  function settings() {
    if (!configured()) return Promise.resolve(null);
    if (settingsCache) return Promise.resolve(settingsCache);
    return req('/auth/v1/settings')
      .then(function (r) { settingsCache = r; return r; })
      .catch(function () { return null; });
  }

  function signOut() {
    setAuth(null);
    emit({ on: false, status: configured() ? 'out' : 'off', email: '', at: 0, msg: '' });
  }

  /* -------------------- merge -------------------- */
  // Har savol bo'yicha oxirgi javob vaqti (t) kattasi ustun — takroriy
  // sinxronda natija o'zgarmaydi (idempotent).
  function merge(a, b) {
    a = a || {}; b = b || {};
    var out = {
      v: 1,
      q: {},
      sessions: [],
      streak: 0,
      best: Math.max(a.best || 0, b.best || 0),
      theme: a.theme || b.theme || 'dark',
      goal: a.goal || b.goal || 40
    };

    var ids = {}, k;
    for (k in (a.q || {})) ids[k] = 1;
    for (k in (b.q || {})) ids[k] = 1;
    for (k in ids) {
      var x = (a.q || {})[k], y = (b.q || {})[k];
      if (!x) { out.q[k] = y; continue; }
      if (!y) { out.q[k] = x; continue; }
      var tx = x.t || 0, ty = y.t || 0;
      var win = tx > ty ? x : ty > tx ? y : ((x.s || 0) >= (y.s || 0) ? x : y);
      var lose = win === x ? y : x;
      out.q[k] = {
        s: Math.max(win.s || 0, lose.s || 0),
        c: Math.max(win.c || 0, lose.c || 0),
        w: Math.max(win.w || 0, lose.w || 0),
        b: win.b || 0,
        t: Math.max(tx, ty),
        f: (win.f || lose.f) ? 1 : 0,
        lw: win.lw
      };
    }

    var seen = {};
    (a.sessions || []).concat(b.sessions || []).forEach(function (s) {
      if (!s || !s.ts) return;
      var key = s.ts + '|' + s.total + '|' + s.correct;
      if (seen[key]) return;
      seen[key] = 1;
      out.sessions.push(s);
    });
    out.sessions.sort(function (p, q) { return p.ts - q.ts; });
    if (out.sessions.length > 200) out.sessions = out.sessions.slice(-200);

    // streak — oxirgi faoliyat qaysi tomonda bo'lsa, o'shanikisi
    out.streak = (last(a) >= last(b)) ? (a.streak || 0) : (b.streak || 0);
    return out;
  }

  function last(s) {
    var m = 0, k;
    for (k in (s && s.q) || {}) if (s.q[k] && s.q[k].t > m) m = s.q[k].t;
    ((s && s.sessions) || []).forEach(function (x) { if (x && x.ts > m) m = x.ts; });
    return m;
  }

  /* -------------------- sinxron -------------------- */
  function pull() {
    var a = auth();
    return authed('/rest/v1/progress?select=data,updated_at&user_id=eq.' + a.user_id)
      .then(function (rows) { return (rows && rows[0] && rows[0].data) || null; });
  }

  function push(data) {
    var a = auth();
    return authed('/rest/v1/progress', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: { user_id: a.user_id, data: data, updated_at: new Date().toISOString() }
    });
  }

  function syncNow() {
    if (!configured() || !auth() || !bound) return Promise.resolve();
    if (busy) { dirty = true; return Promise.resolve(); }
    busy = true;
    emit({ status: 'sync', msg: '' });

    var local = bound.get();
    return pull()
      .then(function (remote) {
        var merged = remote ? merge(local, remote) : local;
        if (remote) bound.set(merged);
        return push(merged);
      })
      .then(function () {
        busy = false;
        emit({ status: 'ok', at: Date.now(), msg: '' });
        if (dirty) { dirty = false; return syncNow(); }
      })
      .catch(function (e) {
        busy = false;
        var off = !navigator.onLine || /Failed to fetch|NetworkError|load failed/i.test(e.message || '');
        emit({
          status: off ? 'offline' : 'err',
          msg: off ? 'Internet yo\'q — ulanish tiklanganda o\'zi sinxronlanadi' : (friendly(e).message || 'Xato')
        });
        if (!off && /Sessiya tugagan/.test(e.message || '')) signOut();
      });
  }

  // sessiyadan keyin — darhol emas, 3 soniyadan keyin (bir necha chaqiruv birlashadi)
  function schedule() {
    if (!configured() || !auth()) return;
    clearTimeout(timer);
    timer = setTimeout(syncNow, 3000);
  }

  /* -------------------- boshlash -------------------- */
  function bind(io) {
    bound = io;
    if (!configured()) { emit({ on: false, status: 'off' }); return; }
    var a = auth();
    if (a) { emit({ on: true, email: toLogin(a.email), status: 'idle' }); syncNow(); }
    else emit({ on: false, status: 'out' });

    window.addEventListener('online', function () { if (auth()) syncNow(); });
    window.addEventListener('visibilitychange', function () {
      if (!document.hidden && auth()) schedule();
    });
  }

  return {
    configured: configured,
    bind: bind, on: on, state: function () { return state; },
    signIn: signIn, signUp: signUp, signOut: signOut,
    syncNow: syncNow, schedule: schedule, merge: merge,
    settings: settings, slug: slug, toEmail: toEmail, toLogin: toLogin
  };
})();

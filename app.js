/* ============================================================
   Attestatsiya — davlat xaridlari ekspertizasi
   Adaptiv test dvigateli (Leitner qutilari + og'irlikli tanlov)
   ============================================================ */
(function () {
  'use strict';

  var QS = (window.QUESTIONS || []).slice();
  var KEY = 'attest.v1';
  var APP_VER = '15';

  /* -------------------- store -------------------- */
  var S = load();

  function load() {
    var d = { v: 1, q: {}, cards: {}, sessions: [], streak: 0, best: 0, theme: 'dark', goal: 40, today: null, todayN: 0 };
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var p = JSON.parse(raw);
        for (var k in d) if (!(k in p)) p[k] = d[k];
        return p;
      }
    } catch (e) {}
    return d;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
  }
  function st(id) {
    if (!S.q[id]) S.q[id] = { s: 0, c: 0, w: 0, b: 0, t: 0, f: 0 };
    return S.q[id];
  }

  /* -------------------- helpers -------------------- */
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function pct(n, d) { return d ? Math.round((n / d) * 100) : 0; }
  function mmss(s) {
    s = Math.max(0, Math.round(s));
    return (Math.floor(s / 60) < 10 ? '0' : '') + Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60);
  }
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.hidden = true; }, 2200);
  }

  /* -------------------- theme -------------------- */
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', S.theme);
    $('#btnTheme').textContent = S.theme === 'dark' ? '◐' : '◑';
  }
  $('#btnTheme').addEventListener('click', function () {
    S.theme = S.theme === 'dark' ? 'light' : 'dark'; save(); applyTheme();
  });

  /* -------------------- bucket / weights -------------------- */
  // box: 0 = ko'rilmagan · 1-2 = zaif · 3-4 = yaxshi · 5 = mustahkam
  var W = [1.0, 7.0, 3.4, 1.5, 0.6, 0.18];

  function bucket(id) {
    var a = S.q[id];
    if (!a || !a.s) return 'new';
    if (a.b <= 1) return 'weak';   // oxirgi javob xato edi
    if (a.b <= 3) return 'ok';     // tuzatilgan, lekin hali mustahkam emas
    return 'mast';                 // ketma-ket 3+ to'g'ri
  }

  function weightOf(id) {
    var a = S.q[id];
    if (!a || !a.s) return W[0];
    var w = W[Math.min(5, Math.max(0, a.b))];
    // yaqinda ko'rilgan savol biroz kamroq chiqadi
    var ago = Date.now() - (a.t || 0);
    if (ago < 3 * 60 * 1000) w *= 0.25;
    else if (ago < 30 * 60 * 1000) w *= 0.7;
    return w;
  }

  function pickWeighted(pool, n, exclude) {
    var out = [], used = {}, i;
    for (i = 0; i < (exclude || []).length; i++) used[exclude[i]] = 1;
    var cand = pool.filter(function (q) { return !used[q.id]; });
    if (!cand.length) cand = pool.slice();
    n = Math.min(n, cand.length);
    for (i = 0; i < n; i++) {
      var tot = 0, j;
      for (j = 0; j < cand.length; j++) tot += weightOf(cand[j].id);
      var r = Math.random() * tot, acc = 0, hit = cand.length - 1;
      for (j = 0; j < cand.length; j++) {
        acc += weightOf(cand[j].id);
        if (r <= acc) { hit = j; break; }
      }
      out.push(cand[hit]);
      cand.splice(hit, 1);
    }
    return out;
  }

  /* -------------------- home render -------------------- */
  var DOCS = ['ЗРУ-684', 'ПП-332', 'ВМ-276', 'ПҚ-104', 'Umumiy'];
  var TOPICS = ['Tender', 'Texnik topshiriq', 'Shartnoma', 'Ekspertiza', 'Umumiy'];

  function agg(list) {
    var seen = 0, cor = 0, wr = 0;
    list.forEach(function (q) {
      var a = S.q[q.id]; if (!a || !a.s) return;
      seen += a.s; cor += a.c; wr += a.w;
    });
    return { seen: seen, cor: cor, wr: wr, acc: pct(cor, cor + wr) };
  }

  function renderHome() {
    $('#statTotalQ').textContent = QS.length;
    $('#hpTotal').textContent = QS.length;

    var b = { new: 0, weak: 0, ok: 0, mast: 0 };
    QS.forEach(function (q) { b[bucket(q.id)]++; });
    $('#lgNew').textContent = b.new;
    $('#lgWeak').textContent = b.weak;
    $('#lgOk').textContent = b.ok;
    $('#lgMast').textContent = b.mast;
    $('#hpMastered').textContent = b.mast;
    $('#hpBar').style.width = pct(b.mast + b.ok * 0.5, QS.length) + '%';

    $('#cntMistakes').textContent = mistakePool().length;
    // namunaviy savollar — har yo'nalish uchun alohida hisob (Umumiy ikkalasiga ham kiradi)
    ['IT', 'Sanoat'].forEach(function (dir) {
      var el = $('#cntCards' + dir); if (!el) return;
      el.textContent = ((window.CARDS && window.CARDS.blocks) || []).reduce(function (n, b) {
        return n + ((b.group === dir || b.group === 'Umumiy') ? (b.answers || []).length : 0);
      }, 0);
    });
    $('#streakPill').innerHTML = '🔥 <b>' + S.streak + '</b>';

    // hujjat chiplari
    $('#docChips').innerHTML = DOCS.map(function (d) {
      var list = QS.filter(function (q) { return q.doc === d; });
      if (!list.length) return '';
      var a = agg(list);
      return '<button class="chip" data-doc="' + esc(d) + '">' + esc(d) +
        '<span class="n">' + list.length + '</span>' +
        (a.seen ? '<span class="acc" style="color:' + accColor(a.acc) + '">' + a.acc + '%</span>' : '') +
        '</button>';
    }).join('');

    // qo'shimcha: belgilangan + hali ko'rilmagan savollar
    var flagged = QS.filter(function (q) { return S.q[q.id] && S.q[q.id].f; }).length;
    var unseen = QS.filter(function (q) { return !S.q[q.id] || !S.q[q.id].s; }).length;
    var extra = '';
    if (flagged) extra += '<button class="chip" data-extra="flag">★ Belgilangan<span class="n">' + flagged + '</span></button>';
    if (unseen) extra += '<button class="chip" data-extra="new">Hali ko\'rilmagan<span class="n">' + unseen + '</span></button>';
    $('#extraChips').innerHTML = extra;

    $('#topicChips').innerHTML = TOPICS.map(function (t) {
      var list = QS.filter(function (q) { return q.topic === t; });
      if (!list.length) return '';
      var a = agg(list);
      return '<button class="chip" data-topic="' + esc(t) + '">' + esc(t) +
        '<span class="n">' + list.length + '</span>' +
        (a.seen ? '<span class="acc" style="color:' + accColor(a.acc) + '">' + a.acc + '%</span>' : '') +
        '</button>';
    }).join('');

    // statistika
    var all = agg(QS);
    var lastN = S.sessions.slice(-5);
    var avg = lastN.length ? Math.round(lastN.reduce(function (s, x) { return s + pct(x.correct, x.total); }, 0) / lastN.length) : 0;
    $('#statsGrid').innerHTML = [
      card(all.seen, 'Jami javob', ''),
      card(all.acc + '%', 'Aniqlik', all.acc >= 80 ? 'good' : all.acc >= 60 ? 'warn' : all.seen ? 'bad' : ''),
      card(S.best, 'Eng uzun seriya', 'warn'),
      card(S.sessions.length, 'Sessiya', ''),
      card(avg ? avg + '%' : '—', "So'nggi 5 o'rtacha", avg >= 80 ? 'good' : avg >= 60 ? 'warn' : avg ? 'bad' : '')
    ].join('');

    // zaif nuqtalar — ref bo'yicha guruhlash
    var byRef = {};
    QS.forEach(function (q) {
      var a = S.q[q.id]; if (!a || !a.w) return;
      var k = q.doc + ' · ' + q.ref;
      if (!byRef[k]) byRef[k] = { w: 0, c: 0, doc: q.doc, ref: q.ref, topic: q.topic };
      byRef[k].w += a.w; byRef[k].c += a.c;
    });
    var weak = Object.keys(byRef).map(function (k) { return byRef[k]; })
      .sort(function (x, y) { return y.w - x.w; }).slice(0, 8);
    $('#weakList').innerHTML = weak.length ? weak.map(function (x) {
      return '<div class="weak"><span class="wt"><b>' + esc(x.ref) + '</b><small>' + esc(x.doc) + ' · ' + esc(x.topic) + '</small></span>' +
        '<span class="wn">' + x.w + ' xato</span></div>';
    }).join('') : '<div class="empty">Hali xato yo\'q — mashqni boshlang.</div>';

    renderVersion();
  }

  function renderVersion() {
    var el = $('#verLine'); if (!el) return;
    var nc = ((window.CARDS && window.CARDS.blocks) || []).reduce(function (n, b) { return n + (b.answers || []).length; }, 0);
    var ns = ((window.SHEET && window.SHEET.groups) || []).reduce(function (n, g) { return n + (g.rows || []).length; }, 0);
    el.textContent = 'v' + APP_VER + ' · ' + QS.length + ' test savoli · ' + nc + ' namunaviy · ' + ns + ' shpargalka qatori';
  }

  function accColor(a) { return a >= 80 ? 'var(--ok)' : a >= 60 ? 'var(--warn)' : 'var(--bad)'; }
  function card(v, k, cls) {
    return '<div class="stat ' + (cls || '') + '"><span class="v">' + esc(v) + '</span><span class="k">' + esc(k) + '</span></div>';
  }

  function mistakePool() {
    return QS.filter(function (q) { var a = S.q[q.id]; return a && a.w > 0 && a.b <= 3; });
  }

  /* -------------------- views -------------------- */
  function show(v) {
    ['home', 'quiz', 'result', 'sheet', 'cards'].forEach(function (x) { $('#view-' + x).hidden = x !== v; });
    window.scrollTo({ top: 0, behavior: 'instant' in document.body.style ? 'instant' : 'auto' });
  }
  function goHome() {
    stopTimers();
    renderHome();
    show('home');
    location.hash = '';
  }
  $('#btnHome').addEventListener('click', goHome);
  $('#btnQuit').addEventListener('click', function () {
    if (Q.list.length && Q.i < Q.list.length && Q.answered.length) {
      if (!confirm('Sessiyani tugatasizmi? Natija saqlanadi.')) return;
      finish();
    } else { goHome(); }
  });
  $('#btnResHome').addEventListener('click', goHome);

  /* -------------------- quiz engine -------------------- */
  var Q = {
    mode: 'adaptive', list: [], i: 0, answered: [], order: [], sel: -1,
    started: 0, limit: 0, perQ: 0, instant: true, title: 'Mashq'
  };
  var tickT = null, perT = null;

  function stopTimers() { clearInterval(tickT); clearInterval(perT); tickT = perT = null; }

  var MODES = {
    adaptive: { title: 'Adaptiv mashq', n: 30, instant: true, limit: 0, perQ: 0 },
    mistakes: { title: 'Xatolar ustida', n: 25, instant: true, limit: 0, perQ: 0 },
    exam: { title: 'Imtihon', n: 40, instant: false, limit: 40 * 60, perQ: 0 },
    blitz: { title: 'Blits', n: 15, instant: true, limit: 0, perQ: 30 }
  };

  function start(mode, filter, label) {
    var cfg = MODES[mode] || MODES.adaptive;
    var pool = QS.slice();

    if (mode === 'mistakes') {
      pool = mistakePool();
      if (!pool.length) { toast('Xato javoblar yo\'q — avval mashq qiling.'); return; }
    }
    if (filter) pool = QS.filter(filter);
    if (!pool.length) { toast('Bu bo\'limda savol yo\'q.'); return; }

    var n = Math.min(cfg.n, pool.length);
    var list;
    if (mode === 'exam') {
      // hujjatlar bo'yicha mutanosib namuna
      list = stratified(pool, n);
    } else {
      list = pickWeighted(pool, n, []);
    }

    Q.mode = mode;
    Q.title = label || cfg.title;
    Q.list = list;
    Q.pool = pool;
    Q.i = 0;
    Q.answered = [];
    Q.instant = cfg.instant;
    Q.limit = cfg.limit;
    Q.perQ = cfg.perQ;
    Q.started = Date.now();

    $('#qhMode').textContent = Q.title;
    $('#qhTot').textContent = ' / ' + Q.list.length;
    $('#qhTimer').hidden = !(Q.limit || Q.perQ);

    if (Q.limit) {
      tickT = setInterval(function () {
        var left = Q.limit - (Date.now() - Q.started) / 1000;
        $('#qhTimer').textContent = mmss(left);
        $('#qhTimer').classList.toggle('low', left < 120);
        if (left <= 0) { stopTimers(); toast('Vaqt tugadi'); finish(true); }
      }, 500);
      $('#qhTimer').textContent = mmss(Q.limit);
    }

    show('quiz');
    renderQ();
  }

  function stratified(pool, n) {
    var groups = {};
    pool.forEach(function (q) { (groups[q.doc] = groups[q.doc] || []).push(q); });
    var keys = Object.keys(groups), out = [];
    keys.forEach(function (k) {
      var share = Math.round(n * groups[k].length / pool.length);
      out = out.concat(pickWeighted(groups[k], share, []));
    });
    // to'ldirish / qirqish
    var used = {}; out.forEach(function (q) { used[q.id] = 1; });
    while (out.length < n) {
      var rest = pool.filter(function (q) { return !used[q.id]; });
      if (!rest.length) break;
      var add = pickWeighted(rest, n - out.length, []);
      add.forEach(function (q) { used[q.id] = 1; });
      out = out.concat(add);
    }
    return shuffle(out.slice(0, n));
  }

  var LET = ['A', 'B', 'C', 'D', 'E', 'F'];

  function renderQ() {
    stopPerTimer();
    var q = Q.list[Q.i];
    if (!q) { finish(); return; }

    $('#qhIdx').textContent = Q.i + 1;
    $('#qhBar').style.width = pct(Q.i, Q.list.length) + '%';

    $('#qDoc').textContent = q.doc;
    $('#qTopic').textContent = q.topic;
    $('#qRef').textContent = q.ref;
    var d = q.difficulty || 2;
    $('#qDiff').textContent = d === 1 ? '● oson' : d === 2 ? '●● o\'rta' : '●●● qiyin';
    $('#qText').textContent = q.q;

    var flagged = (S.q[q.id] && S.q[q.id].f) ? true : false;
    $('#btnFlag').classList.toggle('on', flagged);
    $('#btnFlag').textContent = flagged ? '★ Belgilangan' : '☆ Belgilash';

    // variantlarni aralashtirish (savol id asosida barqaror emas — har safar yangi)
    var order = shuffle(q.options.map(function (_, i) { return i; }));
    Q.order = order;

    $('#options').innerHTML = order.map(function (oi, k) {
      var o = q.options[oi];
      return '<button class="opt" data-oi="' + oi + '">' +
        '<span class="k">' + LET[k] + '</span>' +
        '<span class="txt">' + esc(o.t) + '<span class="why" hidden></span></span>' +
        '</button>';
    }).join('');

    $('#explain').hidden = true;
    $('#btnNext').disabled = true;
    $('#btnNext').textContent = (Q.i === Q.list.length - 1) ? 'Yakunlash ✓' : 'Keyingisi →';
    Q.sel = -1;

    $$('#options .opt').forEach(function (el) {
      el.addEventListener('click', function () { select(parseInt(el.dataset.oi, 10)); });
    });

    if (Q.perQ) startPerTimer();
  }

  function startPerTimer() {
    var end = Date.now() + Q.perQ * 1000;
    $('#qhTimer').hidden = false;
    perT = setInterval(function () {
      var left = (end - Date.now()) / 1000;
      $('#qhTimer').textContent = mmss(left);
      $('#qhTimer').classList.toggle('low', left < 10);
      if (left <= 0) { stopPerTimer(); answer(-1); }
    }, 250);
    $('#qhTimer').textContent = mmss(Q.perQ);
  }
  function stopPerTimer() { clearInterval(perT); perT = null; }

  // Imtihon rejimida javob darhol qulflanmaydi — «Keyingisi» bosilguncha o'zgartirish mumkin
  function select(oi) {
    if (Q.answered[Q.i] !== undefined) return;
    if (Q.instant) { answer(oi); return; }
    Q.sel = oi;
    $$('#options .opt').forEach(function (el) {
      el.classList.toggle('pending', parseInt(el.dataset.oi, 10) === oi);
    });
    $('#btnNext').disabled = false;
  }

  function answer(oi) {
    if (Q.answered[Q.i] !== undefined) return;
    stopPerTimer();
    var q = Q.list[Q.i];
    var correctIdx = -1;
    q.options.forEach(function (o, i) { if (o.ok) correctIdx = i; });
    var ok = oi === correctIdx;

    Q.answered[Q.i] = { qid: q.id, chosen: oi, correct: correctIdx, ok: ok };

    // holat yangilash
    var a = st(q.id);
    a.s++; a.t = Date.now();
    if (ok) {
      a.c++;
      a.b = a.b ? Math.min(5, a.b + 1) : 2;   // birinchi to'g'ri javob → 2-quti
      S.streak++; if (S.streak > S.best) S.best = S.streak;
    } else { a.w++; a.b = 1; a.lw = oi; S.streak = 0; }
    save();
    $('#streakPill').innerHTML = '🔥 <b>' + S.streak + '</b>';

    // UI
    var opts = $$('#options .opt');
    opts.forEach(function (el) {
      var i = parseInt(el.dataset.oi, 10);
      el.classList.add('locked');
      if (!Q.instant) { if (i === oi) el.classList.add('pending'); return; }
      // Barcha variantlarning izohi ochiladi — chalg'ituvchilarni ham eslab qolish uchun
      var why = el.querySelector('.why');
      why.textContent = q.options[i].why || '';
      why.hidden = !why.textContent;
      if (i === correctIdx) el.classList.add('correct');
      else if (i === oi) el.classList.add('wrong');
      else el.classList.add('dim');
    });

    if (Q.instant) {
      var h = $('#exVerdict');
      h.parentNode.className = 'ex-head ' + (ok ? 'ok' : 'bad');
      h.textContent = ok ? '✓ To\'g\'ri' : (oi === -1 ? '⏱ Vaqt tugadi' : '✕ Noto\'g\'ri');
      $('#exBody').textContent = q.exp || '';
      $('#exRef').textContent = q.doc + ' — ' + q.ref + (q.tags && q.tags.length ? '  ·  ' + q.tags.join(' · ') : '');
      $('#explain').hidden = false;
    }

    $('#btnNext').disabled = false;
  }

  function next() {
    if (Q.answered[Q.i] === undefined) {
      if (!Q.instant && Q.sel >= 0) answer(Q.sel);   // imtihon: «Keyingisi» bosilganda hisoblanadi
      else return;
    }
    Q.i++;
    if (Q.i >= Q.list.length) { finish(); return; }
    if (Q.mode === 'adaptive') maybeExtend();
    renderQ();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  $('#btnNext').addEventListener('click', next);

  // adaptiv rejim: oxiriga yetganda xato qilinganlarni qayta qo'shadi
  function maybeExtend() {
    if (Q.list.length - Q.i > 3) return;
    var upcoming = Q.list.slice(Q.i).map(function (q) { return q.id; });
    var pool = Q.pool && Q.pool.length ? Q.pool : QS;
    var add = pickWeighted(pool, 10, upcoming);
    if (add.length) {
      Q.list = Q.list.concat(add);
      $('#qhTot').textContent = ' / ' + Q.list.length;
    }
  }

  $('#btnFlag').addEventListener('click', function () {
    var q = Q.list[Q.i]; if (!q) return;
    var a = st(q.id); a.f = a.f ? 0 : 1; save();
    $('#btnFlag').classList.toggle('on', !!a.f);
    $('#btnFlag').textContent = a.f ? '★ Belgilangan' : '☆ Belgilash';
  });

  /* -------------------- finish / result -------------------- */
  function finish(markRest) {
    stopTimers();
    if (markRest) {
      for (var z = 0; z < Q.list.length; z++) {
        if (Q.answered[z] === undefined) {
          var qq = Q.list[z], ci = -1;
          qq.options.forEach(function (o, i) { if (o.ok) ci = i; });
          Q.answered[z] = { qid: qq.id, chosen: -1, correct: ci, ok: false };
          var aa = st(qq.id); aa.s++; aa.w++; aa.b = 1; aa.t = Date.now();
        }
      }
      save();
    }
    var done = Q.answered.filter(function (a) { return a; });
    var cor = done.filter(function (a) { return a.ok; }).length;
    var secs = Math.round((Date.now() - Q.started) / 1000);

    if (done.length) {
      S.sessions.push({ ts: Date.now(), mode: Q.mode, total: done.length, correct: cor, secs: secs });
      if (S.sessions.length > 200) S.sessions = S.sessions.slice(-200);
      save();
      if (window.Sync) Sync.schedule();
    }

    var p = pct(cor, done.length);
    var ring = $('#resRing');
    ring.style.setProperty('--p', p);
    ring.style.setProperty('--rc', p >= 80 ? 'var(--ok)' : p >= 60 ? 'var(--warn)' : 'var(--bad)');
    $('#resPct').textContent = p + '%';
    $('#resTitle').textContent = p >= 90 ? 'A\'lo natija' : p >= 80 ? 'Yaxshi' : p >= 60 ? 'Qoniqarli' : 'Takrorlash kerak';
    $('#resSub').textContent = Q.title + ' · ' + cor + '/' + done.length + ' to\'g\'ri · ' + mmss(secs);

    var byDoc = {};
    done.forEach(function (a) {
      var q = qById(a.qid); if (!q) return;
      if (!byDoc[q.doc]) byDoc[q.doc] = { c: 0, n: 0 };
      byDoc[q.doc].n++; if (a.ok) byDoc[q.doc].c++;
    });
    $('#resGrid').innerHTML = Object.keys(byDoc).map(function (d) {
      var x = byDoc[d], a = pct(x.c, x.n);
      return card(a + '%', d + ' (' + x.c + '/' + x.n + ')', a >= 80 ? 'good' : a >= 60 ? 'warn' : 'bad');
    }).join('');

    var wrongs = done.filter(function (a) { return !a.ok; });
    $('#resReview').innerHTML = wrongs.length ? wrongs.map(function (a) {
      var q = qById(a.qid); if (!q) return '';
      var you = a.chosen >= 0 ? q.options[a.chosen] : null;
      var right = q.options[a.correct];
      return '<div class="rv">' +
        '<div class="rq">' + esc(q.q) + '</div>' +
        (you ? '<div class="rl you"><span class="lbl">Siz</span><span>' + esc(you.t) +
          (you.why ? ' <i style="color:var(--fg-mute)">— ' + esc(you.why) + '</i>' : '') + '</span></div>'
          : '<div class="rl you"><span class="lbl">Siz</span><span>javob berilmadi</span></div>') +
        '<div class="rl ans"><span class="lbl">To\'g\'ri</span><span>' + esc(right.t) + '</span></div>' +
        '<div class="rex">' + esc(q.exp) + '</div>' +
        '<div class="rref">' + esc(q.doc + ' — ' + q.ref) + '</div>' +
        '</div>';
    }).join('') : '<div class="empty">Bitta ham xato yo\'q. Zo\'r! 🎉</div>';

    $('#btnResRetry').style.display = wrongs.length ? '' : 'none';
    show('result');
  }

  var IDX = {};
  QS.forEach(function (q) { IDX[q.id] = q; });
  function qById(id) { return IDX[id]; }

  $('#btnResRetry').addEventListener('click', function () { start('mistakes'); });

  /* -------------------- home actions -------------------- */
  $$('.mode-card[data-mode]').forEach(function (el) {
    el.addEventListener('click', function () { start(el.dataset.mode); });
  });
  $('#docChips').addEventListener('click', function (e) {
    var b = e.target.closest('[data-doc]'); if (!b) return;
    var d = b.dataset.doc;
    start('adaptive', function (q) { return q.doc === d; }, d);
  });
  $('#extraChips').addEventListener('click', function (e) {
    var b = e.target.closest('[data-extra]'); if (!b) return;
    if (b.dataset.extra === 'flag') {
      start('adaptive', function (q) { return S.q[q.id] && S.q[q.id].f; }, '★ Belgilangan');
    } else {
      start('adaptive', function (q) { return !S.q[q.id] || !S.q[q.id].s; }, 'Hali ko\'rilmagan');
    }
  });
  $('#topicChips').addEventListener('click', function (e) {
    var b = e.target.closest('[data-topic]'); if (!b) return;
    var t = b.dataset.topic;
    start('adaptive', function (q) { return q.topic === t; }, t);
  });

  $('#btnReset').addEventListener('click', function () {
    if (!confirm('Barcha progress o\'chiriladi. Davom etasizmi?')) return;
    var theme = S.theme;
    S = { v: 1, q: {}, cards: {}, sessions: [], streak: 0, best: 0, theme: theme, goal: 40, today: null, todayN: 0 };
    save(); renderHome(); toast('Progress tozalandi');
  });
  $('#btnExport').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify(S)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'attestatsiya-progress.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });
  $('#btnImport').addEventListener('click', function () { $('#fileImport').click(); });
  $('#fileImport').addEventListener('change', function (e) {
    var f = e.target.files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var p = JSON.parse(r.result);
        if (!p || typeof p !== 'object' || !p.q) throw 0;
        S = p; save(); applyTheme(); renderHome(); toast('Progress yuklandi');
      } catch (x) { toast('Fayl noto\'g\'ri'); }
    };
    r.readAsText(f);
    e.target.value = '';
  });

  /* -------------------- shpargalka -------------------- */
  var SHEET = (window.SHEET && window.SHEET.groups) || [];

  function renderSheet(qs) {
    var needle = (qs || '').trim().toLowerCase();
    var html = '', shown = 0;
    SHEET.forEach(function (g) {
      var rows = g.rows.filter(function (r) {
        if (!needle) return true;
        return (r.k + ' ' + r.v + ' ' + r.ref + ' ' + (r.note || '')).toLowerCase().indexOf(needle) >= 0;
      });
      if (!rows.length) return;
      shown += rows.length;
      html += '<section class="sgroup"><h3><span>' + esc(g.icon || '•') + '</span>' + esc(g.title) +
        '<span class="cnt">' + rows.length + '</span></h3>' +
        rows.map(function (r) {
          return '<div class="srow">' +
            '<span class="sk">' + hi(r.k, needle) +
            (r.note ? '<small>' + hi(r.note, needle) + '</small>' : '') + '</span>' +
            '<span class="sv">' + hi(r.v, needle) + '<em>' + hi(r.ref, needle) + '</em></span>' +
            '</div>';
        }).join('') + '</section>';
    });
    $('#sheetBody').innerHTML = html || '<div class="empty">Topilmadi.</div>';
    return shown;
  }

  function hi(text, needle) {
    var s = esc(text == null ? '' : text);
    if (!needle) return s;
    var i = s.toLowerCase().indexOf(needle);
    if (i < 0) return s;
    return s.slice(0, i) + '<mark>' + s.slice(i, i + needle.length) + '</mark>' + s.slice(i + needle.length);
  }

  var btnSheet = $('#btnSheet');
  if (btnSheet) {
    btnSheet.addEventListener('click', function () {
      if (!SHEET.length) { toast('Shpargalka yuklanmadi'); return; }
      renderSheet('');
      $('#sheetSearch').value = '';
      show('sheet');
    });
  }
  $('#btnSheetBack').addEventListener('click', goHome);
  $('#sheetSearch').addEventListener('input', function (e) { renderSheet(e.target.value); });

  /* -------------------- namunaviy savollar (kartochka) -------------------- */
  /* Ikki yo'nalish alohida: IT foydalanuvchisi Sanoat bloklarini ko'rmaydi va aksincha.
     «Umumiy» bloklar ikkalasiga ham kiradi. */
  var CARDS = (window.CARDS && window.CARDS.blocks) || [];

  function blocksFor(dir) {
    return CARDS.filter(function (b) { return b.group === dir || b.group === 'Umumiy'; });
  }
  function flatFor(dir) {
    var out = [];
    blocksFor(dir).forEach(function (b) {
      (b.answers || []).forEach(function (a) {
        out.push({ block: b.block, key: b.key, n: a.n, q: a.q, short: a.short, full: a.full, ref: a.ref });
      });
    });
    return out;
  }

  var C = { dir: 'IT', flat: [], list: [], i: 0, filter: null };

  function cardId(c) { return c.key + '-' + c.n; }
  function known(c) { return !!(S.cards && S.cards[cardId(c)]); }
  function setKnown(c, v) {
    if (!S.cards) S.cards = {};
    if (v) S.cards[cardId(c)] = 1; else delete S.cards[cardId(c)];
    save();
  }

  function cardPool() {
    return C.filter ? C.flat.filter(function (c) { return c.key === C.filter; }) : C.flat;
  }

  function renderCardChips() {
    var html = '<button class="chip' + (C.filter ? '' : ' on') + '" data-cb="">Hammasi<span class="n">' + C.flat.length + '</span></button>';
    var lastG = '';
    blocksFor(C.dir).forEach(function (b) {
      // yo'nalish o'zgarganda ajratuvchi yorliq
      if (b.group && b.group !== lastG) {
        lastG = b.group;
        html += '<span class="chip-group">' + esc(b.group) + '</span>';
      }
      var n = (b.answers || []).length;
      var bilgan = (b.answers || []).filter(function (a) { return known({ key: b.key, n: a.n }); }).length;
      var nom = String(b.block || '').replace(/^[^·]+·\s*/, '');
      html += '<button class="chip" data-cb="' + esc(b.key) + '" title="' + esc(b.block) + '">' + esc(nom) +
        '<span class="n">' + bilgan + '/' + n + '</span></button>';
    });
    $('#cardBlocks').innerHTML = html;
  }

  function renderCard() {
    var pool = C.list;
    if (!pool.length) { $('#cardQ').textContent = 'Savol yo\'q'; return; }
    if (C.i >= pool.length) C.i = pool.length - 1;
    if (C.i < 0) C.i = 0;
    var c = pool[C.i];

    $('#cardIdx').textContent = C.i + 1;
    $('#cardTot').textContent = ' / ' + pool.length;
    $('#cardBar').style.width = pct(C.i + 1, pool.length) + '%';
    $('#cardBlock').textContent = c.block;
    $('#cardNo').textContent = '№' + c.n;
    $('#cardRef').textContent = c.ref || '';
    $('#cardRef').hidden = !c.ref;
    $('#cardQ').textContent = c.q;

    $('#cardShort').textContent = c.short || '';
    $('#cardFull').innerHTML = (c.full || '').split('\n').map(function (l) {
      l = l.trim();
      if (!l) return '';
      return /^[•\-–]\s*/.test(l)
        ? '<span class="li">• ' + esc(l.replace(/^[•\-–]\s*/, '')) + '</span>'
        : '<span class="li" style="padding-left:0;text-indent:0">' + esc(l) + '</span>';
    }).join('');

    $('#cardAnswer').hidden = true;
    $('#btnReveal').hidden = false;
    $('#btnCardKnow').classList.toggle('on', known(c));
    $('#btnCardKnow').textContent = known(c) ? '✓ Bilaman' : '✓ Bilaman';
    $('#btnCardNext').textContent = (C.i === pool.length - 1) ? 'Yakuniga ✓' : 'Keyingisi →';
  }

  function renderCardList() {
    var html = '', last = '';
    C.list.forEach(function (c, i) {
      if (c.block !== last) { html += '<div class="card-group">' + esc(c.block) + '</div>'; last = c.block; }
      html += '<button class="card-row' + (known(c) ? ' known' : '') + '" data-ci="' + i + '">' +
        '<span class="n">' + c.n + '</span>' +
        '<span class="t">' + esc(c.q.length > 110 ? c.q.slice(0, 110) + '…' : c.q) +
        (c.ref ? '<small>' + esc(c.ref) + '</small>' : '') + '</span></button>';
    });
    $('#cardListView').innerHTML = html || '<div class="empty">Savol yo\'q</div>';
  }

  function dirNom(dir) {
    var g = ((window.CARDS && window.CARDS.groups) || []).filter(function (x) { return x.key === dir })[0];
    return g ? g.nom : dir;
  }

  function openCards(dir) {
    C.dir = dir || C.dir;
    C.flat = flatFor(C.dir);
    if (!C.flat.length) { toast('Namunaviy savollar yuklanmadi'); return; }
    C.filter = null; C.i = 0;
    C.list = cardPool();
    $('#cardDir').textContent = 'Namunaviy · ' + C.dir;
    $('#cardDir').title = dirNom(C.dir);
    renderCardChips(); renderCard();
    $('#cardListView').hidden = true;
    $('#cardView').hidden = false;
    $$('#view-cards .quiz-foot').forEach(function (e) { e.hidden = false; });
    show('cards');
  }

  $$('[data-dir]').forEach(function (b) {
    b.addEventListener('click', function () { openCards(b.dataset.dir); });
  });
  $('#btnCardsBack').addEventListener('click', goHome);

  $('#btnReveal').addEventListener('click', function () {
    $('#cardAnswer').hidden = false;
    this.hidden = true;
  });
  $('#btnCardNext').addEventListener('click', function () {
    if (C.i >= C.list.length - 1) { goHome(); return; }
    C.i++; renderCard(); window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  $('#btnCardPrev').addEventListener('click', function () {
    if (C.i > 0) { C.i--; renderCard(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  });
  $('#btnCardKnow').addEventListener('click', function () {
    var c = C.list[C.i]; if (!c) return;
    setKnown(c, !known(c));
    renderCardChips(); renderCard();
  });
  $('#btnCardList').addEventListener('click', function () {
    var showList = $('#cardListView').hidden;
    if (showList) renderCardList();
    $('#cardListView').hidden = !showList;
    $('#cardView').hidden = showList;
    $$('#view-cards .quiz-foot').forEach(function (e) { e.hidden = showList; });
  });
  $('#cardListView').addEventListener('click', function (e) {
    var b = e.target.closest('[data-ci]'); if (!b) return;
    C.i = parseInt(b.dataset.ci, 10);
    $('#cardListView').hidden = true; $('#cardView').hidden = false;
    $$('#view-cards .quiz-foot').forEach(function (x) { x.hidden = false; });
    renderCard(); window.scrollTo({ top: 0, behavior: 'instant' in document.body.style ? 'instant' : 'auto' });
  });
  $('#cardBlocks').addEventListener('click', function (e) {
    var b = e.target.closest('[data-cb]'); if (!b) return;
    C.filter = b.dataset.cb || null;
    C.list = cardPool(); C.i = 0;
    $$('#cardBlocks .chip').forEach(function (x) { x.classList.toggle('on', (x.dataset.cb || null) === C.filter); });
    if (!$('#cardListView').hidden) renderCardList(); else renderCard();
  });

  /* -------------------- keyboard -------------------- */
  document.addEventListener('keydown', function (e) {
    if ($('#view-quiz').hidden) return;
    var k = e.key.toLowerCase();
    var map = { '1': 0, '2': 1, '3': 2, '4': 3, a: 0, b: 1, c: 2, d: 3 };
    if (k in map) {
      var els = $$('#options .opt');
      if (els[map[k]] && !els[map[k]].classList.contains('locked')) { els[map[k]].click(); e.preventDefault(); }
    } else if (k === 'enter' || k === ' ') {
      if (!$('#btnNext').disabled) { next(); e.preventDefault(); }
    } else if (k === 'escape') {
      $('#btnQuit').click();
    }
  });

  /* -------------------- hisob / sinxronizatsiya -------------------- */
  function initSync() {
    if (!window.Sync || !Sync.configured()) return;   // config.js bo'sh -> faqat lokal
    $('#btnAccount').hidden = false;

    Sync.bind({
      get: function () { return S; },
      set: function (v) { S = v; save(); applyTheme(); renderHome(); }
    });

    Sync.on(function (st) {
      var b = $('#btnAccount');
      b.className = 'icon-btn' + (
        st.status === 'sync' ? ' sync-run' :
        st.status === 'ok' ? ' sync-ok' :
        st.status === 'err' ? ' sync-err' : ''
      );
      b.textContent = st.on ? (st.status === 'offline' ? '☁' : '☁') : '☁';
      b.title = st.on
        ? (st.email + (st.at ? ' — sinxronlangan ' + new Date(st.at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }) : ''))
        : 'Kirish — progressni qurilmalar orasida saqlash';

      $('#acctOut').hidden = st.on;
      $('#acctIn').hidden = !st.on;
      if (st.on) {
        $('#acctWho').textContent = st.email;
        $('#acctState').textContent =
          st.status === 'sync' ? 'Sinxronlanmoqda…' :
          st.status === 'offline' ? '⚠ ' + st.msg :
          st.status === 'err' ? '⚠ ' + st.msg :
          st.at ? '✓ Oxirgi sinxron: ' + new Date(st.at).toLocaleString('uz-UZ') :
          'Kutilmoqda…';
      }
    });
  }

  function acctBusy(on, err) {
    $('#acctSignIn').disabled = on;
    $('#acctSignUp').disabled = on;
    $('#acctErr').hidden = !err;
    if (err) $('#acctErr').textContent = err;
  }

  $('#btnAccount').addEventListener('click', function () {
    $('#acctErr').hidden = true;
    $('#acctModal').hidden = false;
    // «Confirm email» yoqilgan bo'lsa ism bilan ro'yxatdan o'tib bo'lmaydi — oldindan ogohlantiramiz
    Sync.settings().then(function (s) {
      var bad = s && s.mailer_autoconfirm === false;
      $('#acctWarn').hidden = !bad;
      if (bad) {
        $('#acctWarn').textContent = '⚠ Supabase panelida Authentication → Email → «Confirm email» yoqilgan. '
          + 'Ism bilan ro\'yxatdan o\'tish uchun uni o\'chirish kerak.';
      }
    });
  });

  // ism -> qanday ko'rinishda saqlanishini jonli ko'rsatish
  $('#acctEmail').addEventListener('input', function (e) {
    var v = e.target.value.trim();
    var h = $('#acctHint');
    if (!v || v.indexOf('@') > 0) { h.hidden = true; return; }
    var s = Sync.slug(v);
    h.hidden = !s || s === v.toLowerCase();
    if (!h.hidden) h.innerHTML = 'Login: <code>' + esc(s) + '</code>';
  });
  function closeAcct() { $('#acctModal').hidden = true; }
  $('#acctClose').addEventListener('click', closeAcct);
  $('#acctSkip').addEventListener('click', closeAcct);
  $('#acctModal').addEventListener('click', function (e) {
    if (e.target === $('#acctModal')) closeAcct();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !$('#acctModal').hidden) { closeAcct(); e.stopPropagation(); }
  }, true);

  function doAuth(fn) {
    var login = $('#acctEmail').value.trim();
    var pw = $('#acctPw').value;
    if (login.indexOf('@') < 0 && Sync.slug(login).length < 2) {
      acctBusy(false, 'Ism kamida 2 ta harf yoki raqamdan iborat bo\'lsin.'); return;
    }
    if (pw.length < 6) { acctBusy(false, 'Parol kamida 6 belgidan iborat bo\'lsin.'); return; }
    acctBusy(true, '');
    fn(login, pw).then(function () {
      acctBusy(false, '');
      $('#acctPw').value = '';
      $('#acctHint').hidden = true;
      $('#acctModal').hidden = true;
      toast('Sinxronizatsiya yoqildi');
      renderHome();
    }).catch(function (e) {
      acctBusy(false, e.message || 'Xato');
    });
  }
  $('#acctSignIn').addEventListener('click', function () { doAuth(Sync.signIn); });
  $('#acctSignUp').addEventListener('click', function () { doAuth(Sync.signUp); });
  $('#acctPw').addEventListener('keydown', function (e) { if (e.key === 'Enter') doAuth(Sync.signIn); });
  $('#acctSignOut').addEventListener('click', function () {
    Sync.signOut(); $('#acctModal').hidden = true; toast('Chiqildi — progress shu qurilmada qoladi');
  });
  $('#acctSync').addEventListener('click', function () {
    Sync.syncNow().then(function () { renderHome(); });
  });

  /* -------------------- boot -------------------- */
  applyTheme();
  if (!QS.length) {
    $('#view-home').innerHTML = '<div class="empty">questions.js yuklanmadi.</div>';
  } else {
    renderHome();
    initSync();
  }

  /* -------------------- avtomatik yangilanish --------------------
     Muammo: eski service worker eski index.html ni beradi — unda yangi
     <script> teglari yo'q, natijada yangi bo'lim «0 ta» ko'rinadi va
     ochilmaydi. Yechim: yangi SW boshqaruvni olganda sahifa BIR MARTA
     o'zi qayta yuklanadi. */
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    var reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (reloaded) return;
      reloaded = true;
      location.reload();
    });
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      reg.addEventListener('updatefound', function () {
        var nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', function () {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            toast('Yangi versiya — yangilanmoqda…');
          }
        });
      });
      if (reg.update) reg.update().catch(function () {});
    }).catch(function () {});
  }
})();

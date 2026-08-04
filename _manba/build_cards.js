/* Namunaviy savollar javoblari -> cards.js
 *
 *   node _manba/build_cards.js <chiqish.js> [--base <cards.js>] [--reuse <savollar.json>]
 *                              [--patch <journal>] <journal…>
 *
 * --base   mavjud cards.js ni ASOS qilib oladi. Undagi javoblar journal'dagilardan USTUN —
 *          qo'lda tuzatilgan javob (masalan it-1 #7/#8 ПҚ-4328/ПП-4024 bo'yicha) qayta
 *          generatsiyada yo'qolmasin. Journal faqat YANGI bloklarni/savollarni qo'shadi.
 * --reuse  savollar.json dagi `reuse` maydonini bajaradi: javob boshqa blokdan ko'chiriladi
 *          (masalan sanoat-a #255 <- it-1 #8), qayta yozilmaydi.
 * --patch  audit natijasi bo'yicha tuzatilgan javoblar journali. HAMMA narsadan ustun —
 *          eng oxirida qo'llanadi va mavjud javobni almashtiradi. Bir necha marta berilishi mumkin.
 *
 * Oddiy journal'lar «birinchi kelgan yutadi» tartibida yig'iladi.
 */
const fs = require('fs');

const argv = process.argv.slice(2);
let OUT = null, BASE = null, REUSE = null;
const JOURNALS = [], PATCHES = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--base') BASE = argv[++i];
  else if (argv[i] === '--reuse') REUSE = argv[++i];
  else if (argv[i] === '--patch') PATCHES.push(argv[++i]);
  else if (!OUT) OUT = argv[i];
  else JOURNALS.push(argv[i]);
}
if (!OUT) { console.error('foydalanish: build_cards.js <chiqish.js> [--base cards.js] [--reuse savollar.json] <journal…>'); process.exit(1) }

// blok kaliti -> ko'rsatiladigan nom va tartib
const META = {
  'it-1':         { group: 'IT',     title: 'IT · keyslar (1–10)',           order: 1 },
  'keys':         { group: 'IT',     title: 'IT · keyslar (1–10)',           order: 1 },
  'it-2':         { group: 'IT',     title: 'IT · protsedura (11–20)',       order: 2 },
  'sanoat-a':     { group: 'Sanoat', title: 'Sanoat · ЗРУ-684 + ПҚ-332',     order: 3 },
  'sanoat-b':     { group: 'Sanoat', title: 'Sanoat · ВМ-276 nizomi',        order: 4 },
  'uz2030':       { group: 'Umumiy', title: "Umumiy · O'zbekiston — 2030",  order: 5 },
  'ish-yuritish': { group: 'Umumiy', title: 'Umumiy · ish yuritish va til',  order: 6 },
  'eksp-1':       { group: 'Umumiy', title: 'Umumiy · ПҚ-332 va ekspertiza', order: 7 },
  'eksp-2':       { group: 'Umumiy', title: 'Umumiy · ekspertiza (davomi)',  order: 8 },
};

function unesc(s) {
  return String(s == null ? '' : s)
    .replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    // ilova Markdown render qilmaydi — «**qalin**» belgilari matnda ko'rinib qolardi
    .replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*\*/g, '')
    .replace(/[ \t]+\n/g, '\n').trim();
}

// n raqami bo'yicha eski klassifikator (faqat blok kaliti yo'q natijalar uchun)
function guessKey(n, q) {
  if (/O'zbekiston|Oʻzbekiston|Ўзбекистон/i.test(String(q)) && /2030/.test(String(q))) return 'uz2030';
  if (n >= 47) return 'eksp-2';
  if (n >= 33) return 'eksp-1';
  if (n >= 21) return 'ish-yuritish';
  if (n >= 11) return 'it-2';
  return 'it-1';
}

// yo'nalish nomlari (cards.js ning yuqori darajasidagi `groups`)
const GROUP_NOM = {
  'IT':     'IT va raqamlashtirish',
  'Sanoat': 'Asosiy sanoat tarmoqlari va ijtimoiy soha',
  'Umumiy': "Umumiy — har ikkala yo'nalish uchun",
};

// barcha javoblarni yig'amiz: blok kaliti -> (n -> javob)
const byKey = new Map();
const baseKeys = new Set();
let baseGroups = null;
function put(key, a, { overwrite }) {
  if (!byKey.has(key)) byKey.set(key, new Map());
  const m = byKey.get(key);
  if (!overwrite && m.has(a.n)) return false;
  m.set(a.n, a);
  return true;
}

/* ---------- 1) asos: mavjud cards.js ---------- */
if (BASE) {
  if (!fs.existsSync(BASE)) { console.error('⚠ --base topilmadi:', BASE); process.exit(1) }
  const src = fs.readFileSync(BASE, 'utf8').replace(/^\s*window\.CARDS\s*=/m, 'module.exports =');
  const cards = eval('(function(){var module={exports:{}};' + src + ';return module.exports})()');
  if (Array.isArray(cards.groups)) baseGroups = cards.groups;
  for (const b of (cards.blocks || [])) {
    baseKeys.add(b.key);
    for (const a of (b.answers || [])) put(b.key, a, { overwrite: true });
  }
  console.log('asos:', BASE, '·', [...baseKeys].join(', '));
}

/* ---------- 2) journal natijalari ---------- */
// journal fayldan [kalit, javob] juftliklarini ajratadi
function oqi(j) {
  const list = [];
  if (!fs.existsSync(j)) { console.log('⚠ topilmadi:', j); return list }
  for (const line of fs.readFileSync(j, 'utf8').split(/\r?\n/).filter(Boolean)) {
    let o; try { o = JSON.parse(line) } catch { continue }
    if (o.type !== 'result' || !o.result) continue;
    const r = o.result;

    // 1) {blocks:[{key, answers}]} — blok kaliti aniq ko'rsatilgan (afzal shakl)
    if (Array.isArray(r.blocks)) {
      for (const b of r.blocks) {
        if (!b || !Array.isArray(b.answers)) continue;
        for (const a of b.answers) if (a && a.n != null) list.push([b.key || 'boshqa', a]);
      }
    }
    // 2) {answers:[...]} — kalit n bo'yicha taxmin qilinadi
    else if (Array.isArray(r.answers)) {
      for (const a of r.answers) if (a && a.n != null && a.q) list.push([guessKey(a.n, a.q), a]);
    }
    // 3) bitta savol: {n, q, short, full, ref, tags}
    else if (r.n != null && r.q && r.short && r.full) list.push([guessKey(r.n, r.q), r]);
  }
  return list;
}

let jNew = 0, jSkip = 0;
for (const j of JOURNALS) {
  // asosdagi javob ustun — journal uni bosib ketmaydi
  for (const [k, a] of oqi(j)) {
    if (baseKeys.has(k) && byKey.get(k) && byKey.get(k).has(a.n)) { jSkip++; continue }
    if (put(k, a, { overwrite: false })) jNew++;
  }
}
if (JOURNALS.length) console.log('journal:', jNew, 'ta yangi javob' + (jSkip ? ' · ' + jSkip + ' ta asosdagi javob saqlandi' : ''));

/* ---------- 3) reuse: javobni boshqa blokdan ko'chirish ---------- */
const reuseYoq = [];
if (REUSE) {
  const spec = JSON.parse(fs.readFileSync(REUSE, 'utf8'));
  let n = 0;
  for (const bol of (spec.bolimlar || [])) {
    for (const s of (bol.savollar || [])) {
      if (!s.reuse) continue;
      const src = byKey.get(s.reuse.block);
      const a = src && src.get(s.reuse.n);
      if (!a) { reuseYoq.push(`${bol.key}#${s.n} <- ${s.reuse.block}#${s.reuse.n}`); continue }
      // savol matni manba blokidan olinadi (u OCR'dan tozalangan), raqam — yangi blokniki
      put(bol.key, { ...a, n: s.n }, { overwrite: true });
      n++;
    }
  }
  console.log('reuse:', n, 'ta javob ko\'chirildi' + (reuseYoq.length ? ' · ' + reuseYoq.length + ' ta manba topilmadi' : ''));
  if (reuseYoq.length) console.log('  ⚠ ' + reuseYoq.join('\n  ⚠ '));
}

/* ---------- 3b) patch: audit bo'yicha tuzatilgan javoblar (hammadan ustun) ---------- */
let pN = 0;
for (const p of PATCHES) {
  for (const [k, a] of oqi(p)) { put(k, a, { overwrite: true }); pN++ }
}
if (PATCHES.length) console.log('patch:', pN, 'ta javob tuzatildi');

/* ---------- 4) yig'ish ---------- */
const blocks = [];
for (const [key, m] of byKey) {
  const meta = META[key] || { title: key, order: 99 };
  const answers = [...m.values()]
    .filter(a => a.q && a.short && a.full)
    .sort((x, y) => x.n - y.n)
    .map(a => ({
      n: a.n,
      q: unesc(a.q),
      short: unesc(a.short),
      full: unesc(a.full),
      ref: unesc(a.ref),
      tags: Array.isArray(a.tags) ? a.tags.slice(0, 3).map(unesc) : [],
    }));
  if (answers.length) blocks.push({ key, block: meta.title, answers, group: meta.group || 'Umumiy', order: meta.order });
}
blocks.sort((a, b) => a.order - b.order);
blocks.forEach(b => delete b.order);

// yo'nalishlar ro'yxati: asosdagisi saqlanadi, yangi yo'nalish paydo bo'lsa qo'shiladi
const groups = [];
for (const g of (baseGroups || [])) groups.push(g);
for (const b of blocks) {
  if (groups.some(g => g.key === b.group)) continue;
  groups.push({ key: b.group, nom: GROUP_NOM[b.group] || b.group });
}

const total = blocks.reduce((s, b) => s + b.answers.length, 0);
console.log('\nbloklar:', blocks.length, '· jami javob:', total);
blocks.forEach(b => {
  const ns = b.answers.map(a => a.n);
  const uz = [];
  for (let i = Math.min(...ns); i <= Math.max(...ns); i++) if (!ns.includes(i)) uz.push(i);
  console.log(`  • ${b.block.padEnd(26)} ${String(b.answers.length).padStart(3)} ta  (№${Math.min(...ns)}–${Math.max(...ns)})`
    + (uz.length ? `  ⚠ yetishmaydi: ${uz.slice(0, 15).join(',')}${uz.length > 15 ? '…(' + uz.length + ')' : ''}` : ''));
});

/* ---------- 5) tekshiruv ---------- */
const shubha = [];
blocks.forEach(b => b.answers.forEach(a => {
  if (a.short.length < 20) shubha.push(`${b.key}#${a.n} short juda qisqa`);
  if (a.full.length < 40) shubha.push(`${b.key}#${a.n} full juda qisqa`);
  if (!a.ref) shubha.push(`${b.key}#${a.n} manba yo'q`);
}));
console.log(shubha.length ? '\n⚠ ' + shubha.length + ' ta shubhali:\n  ' + shubha.slice(0, 20).join('\n  ') : '\n✓ hamma javob to\'liq');

const ent = JSON.stringify(blocks).match(/&[a-z]{2,5};|&#\d+;/g);
console.log('HTML belgilar:', ent ? [...new Set(ent)].join(',') : "yo'q ✓");

fs.writeFileSync(OUT,
  '/* Namunaviy savollar (ish beruvchi bergan) — ' + total + ' ta savol javobi bilan\n'
  + '   Yo\'nalishlar: ' + groups.map(g => g.key).join(' · ') + ' (Umumiy — ikkalasiga ham tegishli)\n'
  + '   Manba: lex.uz amaldagi tahriri, 2026-08-04 */\n'
  + 'window.CARDS = ' + JSON.stringify({ blocks, groups }) + ';\n', 'utf8');
console.log('\nyozildi ->', OUT, (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB');

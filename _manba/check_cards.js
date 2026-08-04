/* cards.js sifat tekshiruvi — chiqarishdan oldin majburiy
 *
 *   node _manba/check_cards.js cards.js [_manba/sanoat-savollar.json]
 *
 * Tekshiradi: to'liqlik · bo'sh ref · qisqa javob · HTML entity · OCR qoldig'i ·
 *             takroriy javob matni · kirill/lotin aralashmasi · qavs muvozanati.
 */
const fs = require('fs');
const CARDS_PATH = process.argv[2] || 'cards.js';
const SPEC_PATH = process.argv[3];

const src = fs.readFileSync(CARDS_PATH, 'utf8').replace(/^\s*window\.CARDS\s*=/m, 'module.exports =');
const CARDS = eval('(function(){var module={exports:{}};' + src + ';return module.exports})()');

const xato = [], ogoh = [];
const E = (s) => xato.push(s);
const W = (s) => ogoh.push(s);

// reuse orqali ko'chirilgan javoblar — takror matn ular uchun normal
const REUSE = new Set();
if (SPEC_PATH && fs.existsSync(SPEC_PATH)) {
  const sp = JSON.parse(fs.readFileSync(SPEC_PATH, 'utf8'));
  for (const bol of (sp.bolimlar || [])) for (const s of (bol.savollar || [])) if (s.reuse) REUSE.add(`${bol.key}#${s.n}`);
}

/* --- 1) kutilgan savollar to'liqmi --- */
if (SPEC_PATH && fs.existsSync(SPEC_PATH)) {
  const spec = JSON.parse(fs.readFileSync(SPEC_PATH, 'utf8'));
  for (const bol of (spec.bolimlar || [])) {
    const blk = CARDS.blocks.find(b => b.key === bol.key);
    if (!blk) { E(`blok yo'q: ${bol.key} (${bol.savollar.length} savol)`); continue }
    const bor = new Set(blk.answers.map(a => a.n));
    const yoq = bol.savollar.map(s => s.n).filter(n => !bor.has(n));
    if (yoq.length) E(`${bol.key}: ${yoq.length} ta javob yo'q — №${yoq.join(', №')}`);
    const ortiqcha = [...bor].filter(n => !bol.savollar.some(s => s.n === n));
    if (ortiqcha.length) W(`${bol.key}: ro'yxatda yo'q raqamlar — №${ortiqcha.join(', №')}`);
  }
}

/* --- 2) har javob --- */
const OCR_QOLDIQ = /ус Папотада|тартибдап|уипак|377-рапа|09 1519|бunimaga|ЗРУ-684 ст\.\?|\bХХХ\b/;
const KIRILL = /[А-Яа-яЎўҚқҒғҲҳЁё]/;
const fullMap = new Map();

for (const b of CARDS.blocks) {
  const ns = new Set();
  for (const a of b.answers) {
    const id = `${b.key}#${a.n}`;
    if (ns.has(a.n)) E(`${id}: raqam takrorlangan`);
    ns.add(a.n);

    if (!a.ref || !a.ref.trim()) E(`${id}: ref bo'sh`);
    if (!a.short || a.short.length < 20) E(`${id}: short juda qisqa (${(a.short || '').length})`);
    if (!a.full || a.full.length < 40) E(`${id}: full juda qisqa (${(a.full || '').length})`);
    if (!a.q || a.q.length < 10) E(`${id}: savol matni yo'q`);

    for (const [f, v] of Object.entries({ q: a.q, short: a.short, full: a.full, ref: a.ref })) {
      const s = String(v || '');
      if (/&[a-z]{2,5};|&#\d+;/.test(s)) E(`${id}.${f}: HTML entity`);
      // ʻ (U+02BB) o'zbek harfi — xato emas; faqat qiyshiq QO'SH tirnoq tozalanishi kerak
      if (/[“”„‟]/.test(s)) W(`${id}.${f}: tozalanmagan qiyshiq tirnoq “ ”`);
    }
    if (OCR_QOLDIQ.test(a.q)) E(`${id}.q: OCR qoldig'i tuzatilmagan`);

    // javob matnida kirill bo'lishi normal (atamalar), lekin butun jumla kirill bo'lsa shubhali
    // (qonun iqtibosi kirillda bo'lishi normal — faqat butunlay kirill javob shubhali)
    const kirillUlush = (a.full.match(/[А-Яа-яЎўҚқҒғҲҳ]/g) || []).length / a.full.length;
    if (kirillUlush > 0.65) W(`${id}: full ning ${Math.round(kirillUlush * 100)}% i kirill — lotin o'zbekchada bo'lishi kerak`);

    // «tasdiqlanmadi» — halol, lekin ko'p bo'lsa manba yetishmayapti
    if (/tasdiqlanmadi|topilmadi/i.test(a.full)) W(`${id}: manbadan tasdiqlanmagan ma'lumot bor`);

    // takroriy full matni (reuse orqali ko'chirilganlar bundan mustasno)
    const kalit = a.full.slice(0, 160);
    if (fullMap.has(kalit)) { if (!REUSE.has(id)) W(`${id}: full matni ${fullMap.get(kalit)} bilan bir xil boshlanadi`) }
    else fullMap.set(kalit, id);

    // qavs muvozanati — faqat « » (oddiy qavs «1)», «(i)» sanoqlarida ataylab nomutanosib)
    const no = (a.full.split('«').length - 1), nc = (a.full.split('»').length - 1);
    if (no !== nc) W(`${id}: « » qavs muvozanati buzilgan (${no}/${nc})`);
  }
}

/* --- 3) hisobot --- */
const jami = CARDS.blocks.reduce((s, b) => s + b.answers.length, 0);
console.log(`bloklar: ${CARDS.blocks.length} · javoblar: ${jami}`);
CARDS.blocks.forEach(b => console.log(`  • ${String(b.group).padEnd(7)} ${b.block.padEnd(28)} ${String(b.answers.length).padStart(3)} ta`));

if (ogoh.length) console.log(`\n⚠ ${ogoh.length} ta ogohlantirish:\n  ` + ogoh.slice(0, 40).join('\n  ') + (ogoh.length > 40 ? `\n  …yana ${ogoh.length - 40} ta` : ''));
if (xato.length) { console.log(`\n✗ ${xato.length} ta XATO:\n  ` + xato.slice(0, 40).join('\n  ') + (xato.length > 40 ? `\n  …yana ${xato.length - 40} ta` : '')); process.exit(1) }
console.log('\n✓ xatosiz');

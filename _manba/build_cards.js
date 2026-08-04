/* Namunaviy savollar javoblari -> cards.js */
const fs = require('fs');
const OUT = process.argv[2];
const JOURNALS = process.argv.slice(3);

// blok kaliti -> ko'rsatiladigan nom va tartib
const META = {
  'it-1':          { title: 'IT keyslar (1–10)',        order: 1 },
  'keys':          { title: 'IT keyslar (1–10)',        order: 1 },
  'it-2':          { title: 'IT savollar (11–20)',      order: 2 },
  'uz2030':        { title: "O'zbekiston — 2030",       order: 3 },
  'ish-yuritish':  { title: 'Ish yuritish va til',      order: 4 },
  'eksp-1':        { title: 'ПП-332 va ekspertiza',     order: 5 },
  'eksp-2':        { title: 'Ekspertiza (davomi)',      order: 6 },
};

function unesc(s) {
  return String(s == null ? '' : s)
    .replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n').trim();
}

// barcha javoblarni yig'amiz (n + manba blokiga qarab)
const byKey = new Map();

for (const j of JOURNALS) {
  if (!fs.existsSync(j)) { console.log('⚠ topilmadi:', j); continue }
  for (const line of fs.readFileSync(j, 'utf8').split(/\r?\n/).filter(Boolean)) {
    let o; try { o = JSON.parse(line) } catch { continue }
    if (o.type !== 'result' || !o.result) continue;
    const r = o.result;

    // 1) asosiy workflow: {blocks:[{key, answers}]}
    if (Array.isArray(r.blocks)) {
      for (const b of r.blocks) {
        if (!b || !Array.isArray(b.answers)) continue;
        const k = b.key || 'boshqa';
        if (!byKey.has(k)) byKey.set(k, new Map());
        for (const a of b.answers) if (a && a.n != null) byKey.get(k).set(a.n, a);
      }
    }
    // 2) alohida agent natijasi: {answers:[...]}
    else if (Array.isArray(r.answers)) {
      for (const a of r.answers) {
        if (!a || a.n == null || !a.q) continue;
        const q = String(a.q);
        let k;
        if (/O'zbekiston|Oʻzbekiston|Ўзбекистон/i.test(q) && /2030/.test(q)) k = 'uz2030';
        else if (a.n >= 47) k = 'eksp-2';
        else if (a.n >= 33) k = 'eksp-1';
        else if (a.n >= 21) k = 'ish-yuritish';
        else if (a.n >= 11) k = 'it-2';
        else k = 'it-1';
        if (!byKey.has(k)) byKey.set(k, new Map());
        if (!byKey.get(k).has(a.n)) byKey.get(k).set(a.n, a);
      }
    }
    // 3) bitta savolga javob bergan agent: {n, q, short, full, ref, tags}
    else if (r.n != null && r.q && r.short && r.full) {
      const q = String(r.q);
      let k;
      if (/O'zbekiston|Oʻzbekiston|Ўзбекистон/i.test(q) && /2030/.test(q)) k = 'uz2030';
      else if (r.n >= 47) k = 'eksp-2';
      else if (r.n >= 33) k = 'eksp-1';
      else if (r.n >= 21) k = 'ish-yuritish';
      else if (r.n >= 11) k = 'it-2';
      else k = 'it-1';
      if (!byKey.has(k)) byKey.set(k, new Map());
      if (!byKey.get(k).has(r.n)) byKey.get(k).set(r.n, r);
    }
  }
}

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
  if (answers.length) blocks.push({ key, block: meta.title, order: meta.order, answers });
}
blocks.sort((a, b) => a.order - b.order);
blocks.forEach(b => delete b.order);

const total = blocks.reduce((s, b) => s + b.answers.length, 0);
console.log('bloklar:', blocks.length, '· jami javob:', total);
blocks.forEach(b => {
  const ns = b.answers.map(a => a.n);
  console.log(`  • ${b.block.padEnd(24)} ${String(b.answers.length).padStart(2)} ta  (№${Math.min(...ns)}–${Math.max(...ns)})`);
});

// tekshiruv: bo'sh yoki juda qisqa javoblar
const shubha = [];
blocks.forEach(b => b.answers.forEach(a => {
  if (a.short.length < 20) shubha.push(`${b.key}#${a.n} short juda qisqa`);
  if (a.full.length < 40) shubha.push(`${b.key}#${a.n} full juda qisqa`);
  if (!a.ref) shubha.push(`${b.key}#${a.n} manba yo'q`);
}));
console.log(shubha.length ? '\n⚠ ' + shubha.length + ' ta shubhali:\n  ' + shubha.slice(0, 12).join('\n  ') : '\n✓ hamma javob to\'liq');

const ent = JSON.stringify(blocks).match(/&[a-z]{2,5};|&#\d+;/g);
console.log('HTML belgilar:', ent ? [...new Set(ent)].join(',') : "yo'q ✓");

fs.writeFileSync(OUT,
  '/* Namunaviy savollar (ish beruvchi bergan) — ' + total + ' ta savol javobi bilan\n'
  + '   Manba: lex.uz amaldagi tahriri, 2026-08-03 */\n'
  + 'window.CARDS = ' + JSON.stringify({ blocks }) + ';\n', 'utf8');
console.log('\nyozildi ->', OUT, (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB');

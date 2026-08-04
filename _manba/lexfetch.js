/* lex.uz sahifasini toza matnga aylantirish */
const fs = require('fs');
const https = require('https');

const url = process.argv[2];
const out = process.argv[3];

function get(u, redirects = 0) {
  return new Promise((resolve, reject) => {
    https.get(u, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept-Language': 'ru,uz;q=0.8',
      }
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects < 5) {
        res.resume();
        return resolve(get(new URL(res.headers.location, u).href, redirects + 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      const bufs = [];
      res.on('data', d => bufs.push(d));
      res.on('end', () => resolve(Buffer.concat(bufs).toString('utf8')));
    }).on('error', reject);
  });
}

function clean(h) {
  h = h.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  h = h.replace(/<\/(p|div|tr|h[1-6]|li)>/gi, '\n').replace(/<br[^>]*>/gi, '\n').replace(/<\/td>/gi, ' | ');
  let t = h.replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&laquo;/g, '«').replace(/&raquo;/g, '»')
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    .replace(/&mdash;/g, '—').replace(/&ndash;/g, '–');
  t = t.replace(/Предложения по документу|Прослушать аудио|Получить ссылку из элемента документа|Ҳужжат бўйича таклифлар|Аудиони тинглаш/g, '');
  t = t.split('\n').map(x => x.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).join('\n');
  return t.replace(/\n{3,}/g, '\n\n');
}

get(url).then(h => {
  const t = clean(h);
  fs.writeFileSync(out, t, 'utf8');
  console.log('OK', url);
  console.log('  belgi:', t.length, '-> ', out);
  const red = [...t.matchAll(/\(([^)]{0,60}в редакции[^)]{0,120})\)/g)].map(m => m[1]);
  const uniq = [...new Set(red.map(r => (r.match(/(Закона|Указа|постановления)[^—]{0,70}/) || [''])[0].trim()))].filter(Boolean);
  console.log('  o\'zgartirish hujjatlari (unikal):', uniq.length);
  uniq.slice(0, 12).forEach(r => console.log('    -', r));
}).catch(e => { console.error('XATO', url, e.message); process.exit(1); });

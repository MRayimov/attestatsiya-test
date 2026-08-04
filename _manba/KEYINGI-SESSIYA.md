# Keyingi sessiya uchun topshiriq

## Bajarilgani (2026-08-04)

«Sanoat va ijtimoiy soha» yo'nalishi **to'liq qo'shildi**.

| Blok | Savol | Holat |
|---|--:|---|
| `sanoat-a` — ЗРУ-684 + ПҚ-332 | 300 | 281 yangi javob + 19 `reuse` (IT blokidan) |
| `sanoat-b` — ВМ-276 nizomi | 40 | 40 yangi javob |

Saytda hozir: **239 test savoli · 420 namunaviy javob · 79 shpargalka qatori ·
Word qo'llanma**. Versiya **v14**.

### Qanday qilingan

1. **FAKT-VARAQ** (`scratchpad/fakt/*.md`, ~405 KB) — 7 ta agent lex.uz matnlaridan zich
   ma'lumotnoma tuzdi (ПҚ-332 asosiy + Прил.1/2/3/4, ЗРУ-684, ВМ-276, yondosh hujjatlar).
   Javob yozuvchi agentlarning HAMMASI shu bitta manbadan grounding oldi → 321 javob
   bo'ylab raqamlar bir-biriga mos.
2. **Javob generatsiyasi** — 54 agent × 6 savol. Bitta agent StructuredOutput limitiga
   urildi (6 savol), 3 tadan bo'lib qayta yuborilgach o'tdi.
3. **Adversarial audit** — 124 ta eng xavfli javob (to'lov hisobi, muddat, chegara,
   import kontrakt, ВМ-276 raqamlari) mustaqil auditor agentlar tomonidan asl matnga
   solishtirildi: **108 to'g'ri · 13 xato · 3 shubhali**. 16 tasi tuzatildi.
4. **Yig'ish** — `build_cards.js` (quyida), keyin `check_cards.js`, keyin brauzerda
   `getComputedStyle` bilan tekshiruv.

### Audit topgan tipik xatolar (keyingi safar shularga qara)

- **Qism raqami**: `ст.66 ч.1` ↔ `ч.2` — e'lon Markaz xulosasidan keyin degan norma **ч.2** da.
- **Mavjud bo'lmagan абзац**: ПП-332 Прил.3 п.4 bitta абзацдан iborat — «п.4 абз.2» YO'Q,
  «ikkinchi jumla» deb yozilishi kerak. Manbada абзац = alohida QATOR.
- **Eskirgan bandga havola**: Прил.4 Инструкция п.6 da hanuz 100 БҲМ turibdi; joriy chegara
  asosiy qaror **п.3«а»** (ПҚ-104, 16.03.2026) da **200 БҲМ**. REF ga Прил.4 ni izohsiz qo'yish xato.
- **Formula to'liq emas**: Прил.4 п.7 = `Ц ос × 0,1 % × ставка НДС` (natija ҚҚС bilan).
- **Shartsiz qoida**: Прил.3 п.27 dagi «ustuvor til» talabi FAQAT ikki tilli loyihaga tegishli.
- **Boshqa reestr**: ЗРУ-684 ст.47 dagi to'lov taqiqi — vakolatli organ yuritadigan
  Yagona shartnomalar reestriga tegishli, Markazdagi регистрация bilan aralashtirilmaydi.

## Yig'ish buyrug'i

```bash
node _manba/build_cards.js cards.js --base cards.js --reuse _manba/sanoat-savollar.json --patch <tuzatish.jsonl> <journal…>
```

- `--base` — mavjud `cards.js` ASOS. Undagi javoblar journal'dan **ustun** (qo'lda tuzatilgan
  it-1 #7/#8 ПҚ-4328/ПП-4024 javoblari yo'qolmaydi). Round-trip mazmunan bayt-aynan.
- `--reuse` — `sanoat-savollar.json` dagi `reuse` maydonini bajaradi (javob manba blokdan
  ko'chiriladi, qayta yozilmaydi).
- `--patch` — audit bo'yicha tuzatilgan javoblar journali, **hammadan ustun**, bir necha marta
  berilishi mumkin.
- Oddiy journal'lar «birinchi kelgan yutadi» tartibida.
- `unesc()` Markdown `**qalin**` belgilarini olib tashlaydi — ilova Markdown render qilmaydi.

Keyin **majburiy**:

```bash
node _manba/check_cards.js cards.js _manba/sanoat-savollar.json
```

To'liqlik · bo'sh `ref` · qisqa javob · HTML entity · OCR qoldig'i · takroriy matn ·
kirill ulushi · « » muvozanati. Xato bo'lsa exit 1.

So'ng `app.js` dagi `APP_VER` va `sw.js` dagi `CACHE` oshiriladi.
⚠️ Brauzerda tekshirishdan oldin service worker keshini tozalash kerak, aks holda eski
`cards.js` ko'rsatiladi (kesh nomi o'zgarmagan bo'lsa ham).

## Qolgan ish (keyingi sessiya uchun)

1. **Auditdan o'tmagan ~197 javob.** Tekshirilgani — 124 ta (raqam/muddat/chegara zonasi).
   Qolganlari asosan ta'rif va prinsip savollari, xavfi pastroq, lekin `sanoat-a` №51–100
   (ta'riflar, prinsiplar, subyektlar) va №61–99 (ЗРУ-684 tuzilmasi) ni audit qilish
   foydali — u yerda modda raqamlari ko'p.
   Tayyor asbob: `scratchpad/wf-tekshir.js` (guruhlarni `verify/index.json` shaklida bering).
2. **`cards.js` 888 KB.** Gzip bilan ~200 KB, hozircha muammo emas. Agar sekinlashsa —
   yo'nalish bo'yicha alohida faylga bo'lib, talab bo'yicha yuklash.
3. **Test savollari** (`questions.js`, 239 ta) hali faqat IT/umumiy yo'nalish bo'yicha.
   Sanoat yo'nalishi uchun alohida test banki yo'q — kerak bo'lsa shu 340 savoldan
   test savollari generatsiya qilinadi.
4. **`sanoat-b` №15** — savoldagi «377-band» ВМ-276 da yo'q (bandlar 1–218, 197–205 esa
   matnda umuman yo'q). Javob buni ochiq aytadi va Постановление **п.3¹ абз.3** +
   Положение **п.6¹** ga yo'naltiradi. Ish beruvchidan asl savol raqamini aniqlashtirish mumkin.

## Manbalar

Vault'dagi `06 - Qonunchilik/` nusxalari 2026-08-03 da yangilangan. Yangi hujjat kerak bo'lsa:

```bash
node _manba/lexfetch.js "https://lex.uz/ru/docs/<id>" chiqish.txt
```

⚠️ **ONDATE parametrisiz** — u joriy tahrirni beradi.

| Hujjat | lex.uz doc id | Eslatma |
|---|---|---|
| ЗРУ-684 | `5382983` | ст.33 va ст.71 rus tarjimasi ЗРУ-1155/1157 bo'yicha eskirgan |
| ПҚ-332 | `6130752` | п.3 ПҚ-104 bilan qayta yozilgan; Прил.4 Инструкция yangilanmagan |
| ВМ-276 | `6026646` | ⚠️ eski `6024539` → 404 |
| ПҚ-104 | — | skan; OCR matni vault'da |
| ПҚ-4328 | `4346983` | п.3 (УП-76) — Кибербезопасность markazi xulosasi |
| ПП-4024 | `4071399` | **п.7(в)** — ТЗ ni «Центр технического содействия» bilan kelishish |
| ПФ-158 (UZ-2030) | `6600413` | ⚠️ **17.02.2026 da kuchini yo'qotgan** |
| ПФ-21 | `8050769` | ПФ-158 o'rniga |

## Javob formati

`_manba/JAVOB-QOIDASI.md` da to'liq. Qisqacha:

```json
{ "n": 12, "q": "savol matni", "short": "1-2 jumla", "full": "to'liq javob",
  "ref": "ЗРУ-684 ст.34; ПП-332 Прил.2 п.12", "tags": ["ТЗ","brend"] }
```

Til: **o'zbek (lotin)**, ruscha atamalar **kirillda** (отбор · задаток · замечание).

## Tuzoqlar (tasdiqlangan)

1. **StructuredOutput limiti** — schema'da `maxLength` (`short` 420, `full` 1700) va
   bir agentga **6 savoldan ko'p emas**. Yiqilsa — 3 tadan bo'lib qayta yubor.
2. **Rus tilidagi kelishik** — grep O'ZAK bo'yicha: `техническ.*задани`, `закупочн`,
   `тендерн`, `оффшор`, `задатк`, `аффилирован`, `рамочн`.
3. **`build_cards.js` klassifikatori** — agent natijasi `{blocks:[{key,answers}]}` shaklida
   qaytarilsa blok kaliti aniq bo'ladi. `{answers:[...]}` shaklida kalit `n` bo'yicha
   TAXMIN qilinadi va sanoat bloklari uchun NOTO'G'RI chiqadi.
4. **Workflow `args`** — obyekt sifatida berilsa ham skriptga **satr** bo'lib yetadi;
   skript boshida `typeof args === 'string' ? JSON.parse(args) : args`.
5. **Atama tuzoqlari** — ЗРУ-684 ta'riflari **ст.4** da (ст.3 emas); ВМ-276 da
   «персональный кабинет» (личный emas), «расчетно-клиринговая палата (РКП)»,
   «комиссионный сбор»; ПП-332 Прил.3 da «бенефициарный **собственник**».

# Keyingi sessiya uchun topshiriq — «Sanoat va ijtimoiy soha» yo'nalishi

## Vazifa

`_manba/sanoat-savollar.json` dagi **340 ta ochiq savolga** javob tayyorlash va
ularni saytga yangi yo'nalish sifatida qo'shish.

- `sanoat-a` — 300 savol (ЗРУ-684 + ПҚ-332 bo'yicha)
- `sanoat-b` — 40 savol (ВМ-276 nizomi bo'yicha)
- **19 tasida `reuse` maydoni bor** — javobi `cards.js` dagi IT blokidan
  ko'chiriladi, qayta yozilmaydi. Ya'ni **321 ta yangi javob** kerak.

## ⚠️ 60 ta UMUMIY savol — qayta yaratilmaydi

`cards.js` da allaqachon javob bilan turgan **60 ta umumiy savol** (Umumiy 60:
O'zbekiston-2030 20 · ish yuritish va til 12 · ПҚ-332 va ekspertiza 14 ·
ekspertiza davomi 14) **har ikkala yo'nalishga ham tegishli** — IT ga ham,
Sanoat ga ham. Ular `group: "Umumiy"` bilan belgilangan va ilovada alohida
yorliq ostida ko'rinadi.

**Ularni qayta yaratmang va nusxalamang** — bloklar umumiy, ikkala yo'nalish
foydalanuvchisiga baribir ko'rinadi. Yangi `sanoat-a` va `sanoat-b` bloklariga
`group: "Sanoat"` qo'yiladi (xarita `_manba/build_cards.js` dagi META da).

## Manbalar — FAQAT lex.uz amaldagi tahriri

Vault'dagi `06 - Qonunchilik/` nusxalari **2026-08-03 da yangilangan**, ulardan
foydalanish mumkin. Boshqa hujjat kerak bo'lsa `_manba/lexfetch.js` bilan olinadi:

```
node _manba/lexfetch.js "https://lex.uz/ru/docs/<id>" chiqish.txt
```

⚠️ **ONDATE parametrisiz** — u joriy tahrirni beradi.

| Hujjat | lex.uz doc id | Eslatma |
|---|---|---|
| ЗРУ-684 | `5382983` | 6 ta o'zgartirish qonuni 2025-2026 da |
| ПҚ-332 | `6130752` | Прил.2 п.21 УП-259 (26.12.2025) bilan qayta yozilgan |
| ВМ-276 | `6026646` | ⚠️ eski `6024539` → 404 |
| ПҚ-104 | — | skan; OCR matni vault'da |
| ПҚ-4328 | `4346983` | п.3 (УП-76) — Кибербезопасность markazi xulosasi |
| ПП-4024 | `4071399` | **п.7(в)** — ТЗ ni «Центр технического содействия» bilan kelishish |
| ПФ-158 (UZ-2030) | `6600413` | ⚠️ **17.02.2026 da kuchini yo'qotgan** |
| ПФ-21 | `8050769` | ПФ-158 o'rniga |

## Javob formati

`_manba/JAVOB-QOIDASI.md` da to'liq yozilgan. Qisqacha — har javob:

```json
{ "n": 12, "q": "savol matni", "short": "1-2 jumla", "full": "to'liq javob",
  "ref": "ЗРУ-684 ст.34; ПП-332 Прил.2 п.12", "tags": ["ТЗ","brend"] }
```

Til: **o'zbek (lotin)**, ruscha atamalar **kirillda** (отбор · задаток · замечание).

## ⚠️ Uchta tuzoq — oldingi sessiyada yo'l qo'yilgan xatolar

1. **StructuredOutput limiti.** Javoblar uzun bo'lsa agent 5 marta urinib
   yiqiladi. Yechim: schema'da `maxLength` qo'ying (`short` 400, `full` 1400)
   va **bir agentga 5-8 savoldan ko'p bermang**. 10 ta savol → yiqildi,
   5 ta → ishladi.

2. **Rus tilidagi kelishik.** `техническое задание` bo'yicha grep 0 natija
   berdi, matnda esa `техническим заданиям` edi — natijada «bu hujjatda norma
   yo'q» degan noto'g'ri xulosa chiqdi. **O'zak bo'yicha qidiring**:
   `техническ.*задани`, `закупочн`, `тендерн`.

3. **build_cards.js klassifikatori.** Journal'da agent natijalari uch xil
   shaklda keladi: `{blocks:[...]}`, `{answers:[...]}`, va bitta savolga
   javob bergan agentda to'g'ridan-to'g'ri `{n,q,short,full,ref,tags}`.
   Uchalasi ham qo'llab-quvvatlanadi — `META` jadvaliga yangi blok
   kalitlarini (`sanoat-a`, `sanoat-b`) qo'shish kifoya.

## Yig'ish va joylash

```bash
# javoblar tayyor bo'lgach
node _manba/build_cards.js cards.js <journal1.jsonl> <journal2.jsonl> ...
# keyin sw.js dagi CACHE va app.js dagi APP_VER ni oshiring
```

Saytda blok avtomatik paydo bo'ladi — `app.js` `window.CARDS.blocks` ni
o'zi o'qiydi, kod o'zgartirish shart emas. Faqat `_manba/build_cards.js`
ichidagi `META` ga sarlavha va tartib qo'shiladi.

## Tekshiruv (majburiy)

Chiqarishdan oldin:
- har javobda `ref` bo'sh emasligi
- `short` ≥ 20 belgi, `full` ≥ 40 belgi
- HTML belgilar (`&gt;` va h.k.) tozalanganligi
- saytda: `getComputedStyle(el).display` bilan (el.hidden xususiyati bilan EMAS)

## Hozirgi holat (2026-08-03)

Saytda: **239 test savoli · 80 namunaviy javob · 79 shpargalka qatori ·
Word qo'llanma**. Versiya **v12**, bosh sahifa pastida ko'rinadi.

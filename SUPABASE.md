# Sinxronizatsiyani yoqish — Supabase (bepul)

Maqsad: kompyuterda boshlab, telefonda davom etish. Progress bulutda birlashadi.
Ilova **local-first** — internetsiz ham ishlayveradi, ulanish tiklanganda o'zi sinxronlanadi.

Jami 4 qadam, ~5 daqiqa.

---

## 1. Loyiha yaratish

1. https://supabase.com → **Start your project** → GitHub bilan kirish
2. **New project**
   - Name: `attestatsiya`
   - Database password: kuchli parol qo'ying va **saqlab qo'ying** (bu ilovaga kerak emas,
     lekin Supabase panelida kerak bo'lishi mumkin)
   - Region: **Frankfurt** yoki **London** (O'zbekistonga eng yaqin bepul mintaqalar)
3. Loyiha ko'tarilishini kuting (~2 daqiqa)

---

## 2. Jadval va himoyani yaratish

Chap menyudan **SQL Editor** → **New query** → quyidagini to'liq nusxalab qo'ying → **Run**:

```sql
-- Har foydalanuvchi uchun bitta qator: uning butun progressi
create table if not exists public.progress (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Row Level Security: har kim FAQAT o'z qatorini ko'radi va yozadi
alter table public.progress enable row level security;

drop policy if exists "progress_select_own" on public.progress;
drop policy if exists "progress_insert_own" on public.progress;
drop policy if exists "progress_update_own" on public.progress;

create policy "progress_select_own" on public.progress
  for select using (auth.uid() = user_id);

create policy "progress_insert_own" on public.progress
  for insert with check (auth.uid() = user_id);

create policy "progress_update_own" on public.progress
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

`Success. No rows returned` chiqsa — bo'ldi.

---

## 3. Email tasdiqlashni o'chirish ⚠️ MAJBURIY

**Authentication → Sign In / Providers → Email** → **Confirm email** ni **o'chiring** → Save.

Ilova email o'rniga **ism** so'raydi (pastga qarang), ism esa ichkarida mavjud
bo'lmagan domenga ulanadi — u yerga tasdiqlash xati bora olmaydi. Shuning uchun
«Confirm email» yoqiq qolsa **ro'yxatdan o'tib bo'lmaydi**.

Ilova buni o'zi sezadi: kirish oynasida sariq ogohlantirish chiqadi.

---

## 4. Kalitlarni ilovaga qo'yish

**Project Settings → API** bo'limidan ikkita qiymatni oling:

- **Project URL** — `https://xxxxxxxx.supabase.co`
- **anon / public** kalit — `eyJhbGciOi...` bilan boshlanadigan uzun satr

`config.js` faylini shunday to'ldiring:

```js
window.SUPABASE_URL = 'https://xxxxxxxx.supabase.co';
window.SUPABASE_ANON_KEY = 'eyJhbGciOi...';
```

Keyin commit qilib push qiling — GitHub Pages 1-2 daqiqada yangilanadi.
Saytda yuqori o'ng burchakda **☁** tugmasi paydo bo'ladi.

---

## Xavfsizlik haqida

| Kalit | Ochiq repoda bo'lishi | Izoh |
|---|---|---|
| **Project URL** | ✅ mumkin | shunchaki manzil |
| **anon / public** | ✅ mumkin | **shunga mo'ljallangan**; RLS uni cheklaydi — bu kalit bilan faqat o'z qatoringizga tegish mumkin |
| **service_role** | ❌ **HECH QACHON** | RLS ni aylanib o'tadi, butun bazaga to'liq huquq beradi |

`service_role` kalitini `config.js` ga ham, repoga ham, hech kimga bermang.
Agar tasodifan chiqib ketsa — **Project Settings → API → Reset** qiling.

---

## Ishlatish

1. Kompyuterda **☁** → **ism** + parol → **Ro'yxatdan o'tish**
2. Telefonda saytni oching → **☁** → **o'sha ism va parol** → **Kirish**
3. Progress birlashadi. Har sessiyadan keyin avtomatik sinxronlanadi.

### Ism qanday ishlaydi

Email so'ralmaydi — faqat ism. Ilova uni ichkarida loginga aylantiradi:

| Yozasiz | Login bo'ladi |
|---|---|
| `Muhammad` | `muhammad` |
| `Muhammad Rayimov` | `muhammad.rayimov` |
| `Раҳимов Ўткир` | `rahimov.otkir` (kirill lotinga o'giriladi) |
| `Gʻulom` | `gulom` |

Kiritish paytida login qanday ko'rinishi maydon ostida ko'rsatiladi — ikkinchi
qurilmada aynan shu ismni yozsangiz kifoya.

Texnik jihatdan Supabase Auth baribir email talab qiladi, shuning uchun login
ichkarida `ism@attestatsiya.invalid` ko'rinishida saqlanadi. `.invalid` — RFC 6761
bo'yicha kafolatlangan **mavjud bo'lmagan** domen: bu manzilga hech qachon
haqiqiy xat ketmaydi va begona odamga tushmaydi.

Xohlasangiz haqiqiy email ham yozishingiz mumkin (`@` bo'lsa o'zgarishsiz
ishlatiladi) — parolni tiklash faqat shunda ishlaydi.

**Birlashtirish qoidasi:** har savol bo'yicha *oxirgi javob berilgan* qurilmaning
holati ustun turadi; ko'rilgan/to'g'ri/xato hisoblari maksimum bo'yicha olinadi.
Shuning uchun ikkala qurilmada ishlasangiz ham hech narsa yo'qolmaydi.

---

## Bilib qo'yish kerak

- Bepul loyiha **~1 hafta faoliyatsizlikdan keyin pauzaga** tushadi. Panelda
  bir tugma bilan qayta yoqiladi; ilova bu vaqtda ham lokal ishlayveradi.
- Sinxronizatsiya **ixtiyoriy**. `config.js` bo'sh bo'lsa ilova avvalgidek
  faqat shu qurilmada ishlaydi va **☁** tugmasi umuman ko'rinmaydi.
- **Parolni unutsangiz:** ism bilan kirganda parolni tiklash imkoni yo'q
  (haqiqiy pochta yo'q). Supabase panelida **Authentication → Users** dan
  foydalanuvchini o'chirib, qaytadan ro'yxatdan o'ting — progress lokal
  nusxada saqlanib turadi va qayta kirganda bulutga chiqadi.

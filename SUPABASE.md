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

## 3. Email tasdiqlashni o'chirish (tavsiya)

**Authentication → Sign In / Providers → Email** → **Confirm email** ni **o'chiring** → Save.

Aks holda ro'yxatdan o'tgandan keyin pochtadagi havolani bosish kerak bo'ladi —
yo'lda bu qulay emas. (Xohlasangiz keyin qayta yoqasiz.)

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

1. Kompyuterda **☁** → email + parol → **Ro'yxatdan o'tish**
2. Telefonda saytni oching → **☁** → o'sha email/parol → **Kirish**
3. Progress birlashadi. Har sessiyadan keyin avtomatik sinxronlanadi.

**Birlashtirish qoidasi:** har savol bo'yicha *oxirgi javob berilgan* qurilmaning
holati ustun turadi; ko'rilgan/to'g'ri/xato hisoblari maksimum bo'yicha olinadi.
Shuning uchun ikkala qurilmada ishlasangiz ham hech narsa yo'qolmaydi.

---

## Bilib qo'yish kerak

- Bepul loyiha **~1 hafta faoliyatsizlikdan keyin pauzaga** tushadi. Panelda
  bir tugma bilan qayta yoqiladi; ilova bu vaqtda ham lokal ishlayveradi.
- Sinxronizatsiya **ixtiyoriy**. `config.js` bo'sh bo'lsa ilova avvalgidek
  faqat shu qurilmada ishlaydi va **☁** tugmasi umuman ko'rinmaydi.
- Parolni unutsangiz: Supabase panelida **Authentication → Users** dan
  foydalanuvchini o'chirib, qaytadan ro'yxatdan o'tish eng oson yo'l
  (progress lokal nusxada saqlanib turadi).

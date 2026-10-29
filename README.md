# LITSEY FACE ID — O‘quvchilar Davomatini Yuzni Tanish Orqali Avtomatlashtirish Platformasi

Akademik litsey o‘quvchilarining davomatini kamera orqali yuzni tanish yordamida avtomatik belgilaydigan, 100% oflayn ishlaydigan, ishonchli va xavfsiz lokal veb-platforma.

---

## 1. Asosiy imkoniyatlar

- **100% Lokal va Oflayn ishlash:** Internet ulanishi talab qilinmaydi. Tashqi bulut yoki uchinchi tomon serverlariga hech qanday ma’lumot yuborilmaydi.
- **Biometrik Yuzni Tanish (Face ID):** 128-o‘lchamli tekstura va geometrik parametrlar yordamida real vaqt rejimida yuzni tanish va taqqoslash.
- **Avtomatlashtirilgan davomat:** Kamera uzluksiz ishlaydi, tanilgan o‘quvchi soniyaning bir qismida qayd etiladi va takroriy yozuv yaratilmaydi.
- **Kechikish va qoidalar nazorati:** Dars boshlanish vaqti va kechikish chegarasi (daqiqa) asosida avtomatik "Kelgan" yoki "Kechikkan" holati belgilanadi.
- **O‘quvchilar va guruhlar boshqaruvi:** Yangi o‘quvchi qo‘shish, rasm biriktirish, kameradan yuz shablonini olish, guruhlararo ko‘chirish va arxivlash.
- **Audit jurnali va tuzatishlar:** Qo‘lda kiritilgan o‘zgarishlar va sabablar tizim auditida to‘liq saqlanadi.
- **Hisobotlar va Eksport:** Kunlik, haftalik, oylik statistika hamda CSV/Excel formatida to‘liq hisobotni yuklab olish.
- **Lokal SQLite bazasi va Zaxiralash:** Ma’lumotlar bazasini bir bosishda fayl (`.sqlite` yoki `.json`) sifatida yuklab olish va tiklash.

---

## 2. Tizim talablari

- **Operatsion tizim:** Windows 10 / 11 (yoki Linux, macOS)
- **Node.js:** Versiya 18 yoki undan yuqori (https://nodejs.org)
- **Vebkamera:** Standart USB vebkamera yoki noutbukning o‘rnatilgan kamerasi
- **Brauzer:** Google Chrome, Microsoft Edge, Mozilla Firefox

---

## 3. Windows tizimida ishga tushirish

1. **Loyiha papkasini oching.**
2. **`start.bat`** faylini ikki marta bosing:
   - Dastur zarur kutubxonalarni tekshiradi.
   - Lokal SQLite bazasi ishga tushadi.
   - Standart brauzeringizda avtomatik ravishda `http://localhost:3000` manzili ochiladi.
3. Serverni to‘xtatish uchun **`stop.bat`** faylini ishlating yoki konsol oynasida `Ctrl + C` bosing.

---

## 4. Dastlabki tizimga kirish ma’lumotlari

- **Administrator logini:** `admin`
- **Standart parol:** `litsey2026`
- *Eslatma: Birinchi kirishdan so‘ng Administrator sozlamalari bo‘limida parolni yangilashingiz mumkin. Barcha parollar xeshlangan (PBKDF2/SHA-256) holda saqlanadi.*

---

## 5. Davomat olish tartibi

1. Chap menyudan **"Davomat"** bo‘limiga o‘ting.
2. **"FACE ID ORQALI DAVOMATNI BOSHLASH"** tugmasini bosing.
3. Brauzer kameraga ruxsat so‘rasa, **"Ruxsat berish"** (Allow) tugmasini tanlang.
4. O‘quvchi kameraga qaraydi:
   - Yashil ramka va o‘quvchining ismi paydo bo‘ladi.
   - "Davomat belgilandi" signali yangraydi va yozuv bazaga kiritiladi.
   - O‘quvchi o‘tib ketgach, kamera to‘xtatilmasdan keyingi o‘quvchini kutadi.
5. Bir kunda har bir o‘quvchi faqat bitta asosiy davomat yozuviga ega bo‘ladi.

---

## 6. Biometrik xavfsizlik va maxfiylik

- Yuz shablonlari shaxsiy kompyuteringizdagi `data/litsey_faceid.sqlite` faylida xavfsiz saqlanadi.
- Profil rasmi va biometrik shablonlar alohida boshqariladi.
- O‘quvchi ro‘yxatdan chiqarilganda yoki administrator xohishiga ko‘ra uning yuz shabloni butunlay o‘chirilishi mumkin.
- Tizimda fotosurat orqali aldashdan ogohlantiruvchi dinamik mikro-harakat tahlili mavjud.

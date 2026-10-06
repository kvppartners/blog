---
title: "Maqola yozish: matnni formatlash"
date: 2026-10-03T11:00:00+09:00
draft: true
categories: ["Qo‘llanmalar"]
description: "Maqolada ishlatish mumkin bo‘lgan barcha matn uslublari va ular uchun yoziladigan Markdown."
---

Maqolalar **Markdown** formatidagi oddiy matn fayllaridir: bir nechta oddiy belgilarni yozasiz va ular formatlangan matnga aylanadi. Quyidagi har bir bo‘limda avval nima yozish kerakligi, keyin esa saytda qanday ko‘rinishi ko‘rsatilgan.

<!--more-->

## Maqolalar qayerda saqlanadi {#where}

Har bir maqola `content/posts/` ichidagi papkadir. Unda har bir til uchun bittadan matn fayli, shuningdek maqolaning rasm va fayllari turadi:

```text
content/posts/my-article/
├── index.uz.md        ← o‘zbekcha (lotin)
├── index.uz-cyrl.md   ← o‘zbekcha (kirill)
├── index.ru.md        ← ruscha
├── index.en.md        ← inglizcha
└── photo.jpg          ← barcha tillar uchun umumiy
```

Papka nomi sahifa manziliga aylanadi, masalan `/posts/my-article/`. Faqat kichik lotin harflari va chiziqchalardan foydalaning.

Yangi maqola boshlash uchun mavjud papkadan nusxa oling yoki quyidagini bajaring:

```bash
hugo new posts/my-article/index.uz.md
```

## Fayl sarlavhasi {#header}

Har bir fayl ikkita `---` qatori orasidagi blok bilan boshlanadi. Unda maqolaning matni emas, sozlamalari saqlanadi:

```yaml
---
title: "D-2 talaba vizasini qanday olish mumkin"   # ro‘yxatda va sahifada
date: 2026-10-03T12:00:00+09:00   # nashr sanasi; ro‘yxat shu bo‘yicha saralanadi
draft: true                       # true = yashirin; faqat `hugo server -D` bilan ko‘rinadi
categories: ["Qo‘llanmalar", "Vizalar"]   # bitta yoki bir nechta kategoriya
description: "Maqolalar ro‘yxatida sarlavha ostidagi bitta jumla"
---
```

- Maqola nashrga tayyor bo‘lganda `draft: false` qiling.
- Har bir maqolada uning sarlavhalaridan tuzilgan mundarija bor. Uni yashirish uchun fayl sarlavhasiga `ShowToc: false` qo‘shing; `TocOpen: true` uni darhol ochiq holda ko‘rsatadi.
- Maqolani Telegram kanalga joylagandan keyin `telegram: "https://t.me/kvp_partners/123"` (post havolasi) qo‘shing — maqola ostida shu postning izohlari ko‘rinadi.
- Bir tildagi barcha maqolalarda har bir kategoriyani bir xil yozing: «Viza» va «Vizalar» ikki xil tugmaga aylanadi.
- Maqola boshidagi rasm (`cover`) [Rasm, video va fayllarni qo‘shish](/posts/guide-media/) maqolasida tushuntirilgan.

## Sarlavhalar {#headings}

Maqola nomi eng katta sarlavha, shuning uchun matn ichidagi sarlavhalar ikkita `#` bilan boshlanadi:

```markdown
## Bo‘lim
### Kichik bo‘lim
#### Kichikroq sarlavha
```

Bu sahifada ular allaqachon ishlatilgan: yuqoridagi «Sarlavhalar» — `##`, pastdagi «Qalin, kursiv, o‘chirilgan» esa `###` sarlavha. Sahifa boshidagi mundarija ham sarlavhalardan tuziladi.

## Xatboshilar va yangi qator {#paragraphs}

Xatboshilar orasida bo‘sh qator qoldiring. Bitta qator ko‘chirish e’tiborga olinmaydi; xatboshi ichida yangi qator boshlash uchun qator oxiriga teskari qiya chiziq `\` qo‘ying.

```markdown
Birinchi xatboshi.

Ikkinchi xatboshi,\
majburiy yangi qator bilan.
```

Birinchi xatboshi.

Ikkinchi xatboshi,\
majburiy yangi qator bilan.

## Matn uslublari {#text-styles}

### Qalin, kursiv, o‘chirilgan

```markdown
**qalin**, *kursiv*, ***qalin kursiv***, ~~o‘chirilgan~~
```

**qalin**, *kursiv*, ***qalin kursiv***, ~~o‘chirilgan~~

### Ajratish, tagiga chizish, pastki va yuqori indeks

```markdown
==ajratilgan==, ++tagiga chizilgan++, H~2~O, 25 m^2^
```

==ajratilgan==, ++tagiga chizilgan++, H~2~O, 25 m^2^

### Qator ichidagi kod

Aniq qiymatlar, fayl nomlari yoki buyruqlar uchun:

```markdown
Anketada viza turi `D-2` deb yoziladi.
```

Anketada viza turi `D-2` deb yoziladi.

### Avtomatik tipografika

To‘g‘ri qo‘shtirnoqlar, ikkita chiziqcha va uchta nuqta avtomatik almashtiriladi:

```markdown
"Qo‘shtirnoq" -- qisqa tire --- uzun tire...
```

"Qo‘shtirnoq" -- qisqa tire --- uzun tire...

«Burchakli» qo‘shtirnoq va boshqa har qanday belgini to‘g‘ridan-to‘g‘ri yozing: «», №, ₩, €, ©, 🇰🇷 🎓 ✈️.

## Havolalar {#links}

```markdown
- [Veb-sayt](https://www.hikorea.go.kr)
- <https://www.visa.go.kr>
- [Elektron pochta manzili](mailto:info@example.com)
- [Blogdagi boshqa maqola](/posts/guide-media/)
- [Shu sahifadagi bo‘lim](#tables)
```

- [Veb-sayt](https://www.hikorea.go.kr)
- <https://www.visa.go.kr>
- [Elektron pochta manzili](mailto:info@example.com)
- [Blogdagi boshqa maqola](/posts/guide-media/)
- [Shu sahifadagi bo‘lim](#tables)

Boshqa maqolaga havola (`/posts/…`) uni o‘quvchining joriy tilida ochadi. https://www.visa.go.kr kabi oddiy manzil ham o‘zi havolaga aylanadi.

Bo‘limga havola uning sarlavhasidan keyin jingalak qavs ichida yozilgan nomdan foydalanadi. Masalan, bu sahifadagi jadvallar bo‘limi `## Jadvallar {#tables}` deb yozilgan. Qavslarsiz nom sarlavha matnidan olinadi, u esa har bir tilda har xil.

## Ro‘yxatlar {#lists}

### Belgili ro‘yxat

```markdown
- Pasport
- Rasm, 3,5 × 4,5 sm
  - oq fonda (ikki bo‘sh joy bilan surilgan)
  - so‘nggi 6 oy ichida tushirilgan
- Anketa
```

- Pasport
- Rasm, 3,5 × 4,5 sm
  - oq fonda (ikki bo‘sh joy bilan surilgan)
  - so‘nggi 6 oy ichida tushirilgan
- Anketa

### Raqamli ro‘yxat

```markdown
1. Hujjatlarni yig‘ish
2. Qabulga yozilish
   1. Sanani tanlash (uch bo‘sh joy bilan surilgan)
   2. To‘lovni amalga oshirish
3. Suhbatdan o‘tish
```

1. Hujjatlarni yig‘ish
2. Qabulga yozilish
   1. Sanani tanlash (uch bo‘sh joy bilan surilgan)
   2. To‘lovni amalga oshirish
3. Suhbatdan o‘tish

Raqamlar o‘zi qo‘yiladi: har bir qatorga `1.` deb yozish mumkin.

### Vazifalar ro‘yxati

```markdown
- [x] Pasport nusxasi
- [ ] Bank ko‘chirmasi
```

- [x] Pasport nusxasi
- [ ] Bank ko‘chirmasi

## Iqtiboslar va eslatmalar {#quotes}

```markdown
> Iqtibos bir necha
> qatordan iborat bo‘lishi mumkin.
>
> — Muallif ismi

> **Muhim:** qalin so‘z bilan boshlanadigan iqtibos ogohlantirish yoki maslahat uchun juda mos.
```

> Iqtibos bir necha
> qatordan iborat bo‘lishi mumkin.
>
> — Muallif ismi

> **Muhim:** qalin so‘z bilan boshlanadigan iqtibos ogohlantirish yoki maslahat uchun juda mos.

## Jadvallar {#tables}

```markdown
| Hujjat   | Nusxa | Tayyor |
|:---------|------:|:------:|
| Pasport  |     1 |   ✓    |
| Rasm     |     2 |   ✓    |
| Anketa   |     1 |   —    |
```

| Hujjat   | Nusxa | Tayyor |
|:---------|------:|:------:|
| Pasport  |     1 |   ✓    |
| Rasm     |     2 |   ✓    |
| Anketa   |     1 |   —    |

Ikkinchi qator ustunlarning tekislanishini belgilaydi: `:---` chapga, `:---:` markazga, `---:` o‘ngga. Faylning o‘zida ustunlarni tekislab yozish shart emas.

## Kod bloklari {#code}

Koddan oldingi va keyingi qatorlarga uchta teskari apostrof qo‘ying. Birinchi apostroflardan keyin til nomini yozsangiz, kod rangli bo‘ladi:

````markdown
```python
def days_left(stay, used):
    return stay - used
```
````

```python
def days_left(stay, used):
    return stay - used
```

Qator raqamlari va ajratilgan qatorlar:

````markdown
```python {linenos=true, hl_lines=[2]}
def days_left(stay, used):
    return stay - used
```
````

```python {linenos=true, hl_lines=[2]}
def days_left(stay, used):
    return stay - used
```

## Izohlar {#footnotes}

```markdown
C-3 vizasi qisqa muddat qolish imkonini beradi.[^1] Izohlar avtomatik raqamlanadi.[^source]

[^1]: Aniq muddat berilgan vizaga bog‘liq.
[^source]: ^ belgisidan keyingi nom istalgan so‘z bo‘lishi mumkin; o‘quvchi raqamni ko‘radi.
```

C-3 vizasi qisqa muddat qolish imkonini beradi.[^1] Izohlar avtomatik raqamlanadi.[^source]

[^1]: Aniq muddat berilgan vizaga bog‘liq.
[^source]: ^ belgisidan keyingi nom istalgan so‘z bo‘lishi mumkin; o‘quvchi raqamni ko‘radi.

Izoh matnlari faylning qayerida yozilganidan qat’i nazar, maqolaning eng oxirida ko‘rsatiladi.

## Ta’riflar {#definitions}

```markdown
Homiy
: Arizani qo‘llab-quvvatlovchi shaxs yoki kompaniya.

Apostil
: Hujjatni chet elda haqiqiy qiladigan tasdiq.
```

Homiy
: Arizani qo‘llab-quvvatlovchi shaxs yoki kompaniya.

Apostil
: Hujjatni chet elda haqiqiy qiladigan tasdiq.

## Ajratuvchi chiziq {#divider}

Alohida qatordagi uchta chiziqcha, tepasida bo‘sh qator bilan:

```markdown
---
```

---

## Yig‘iladigan blok {#collapsible}

Savol-javoblar uchun qulay: o‘quvchi bosmaguncha mazmun yashirin turadi.

```markdown
{{</* details summary="Bu yerda matnni formatlash mumkinmi?" */>}}
Ha: **qalin**, *kursiv*, [havolalar](#links) va ro‘yxatlar ichida ishlaydi.
{{</* /details */>}}
```

{{< details summary="Bu yerda matnni formatlash mumkinmi?" >}}
Ha: **qalin**, *kursiv*, [havolalar](#links) va ro‘yxatlar ichida ishlaydi.
{{< /details >}}

## Belgini o‘z holicha ko‘rsatish {#escaping}

Belgi formatlashga aylanmasligi uchun undan oldin teskari qiya chiziq qo‘ying:

```markdown
\*kursiv emas\*, 5 \* 3
```

\*kursiv emas\*, 5 \* 3

## Ro‘yxatdagi tavsif {#preview}

Maqolalar ro‘yxatidagi har bir kartochkada sarlavha ostida maqola tavsifi ko‘rsatiladi: fayl sarlavhasidagi `description: "…"`. Maqola sahifasining o‘zida u ko‘rinmaydi, shuning uchun uni o‘quvchida maqolani ochish istagi uyg‘onadigan qilib yozing. Tavsifi yo‘q maqolada matnning boshi ko‘rsatiladi: `<!--more-->` qatoridan oldingi matn (bu maqolada u birinchi xatboshidan keyin turibdi), bu qator bo‘lmasa esa taxminan dastlabki 70 ta so‘z.

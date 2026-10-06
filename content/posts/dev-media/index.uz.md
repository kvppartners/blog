---
title: "Rasm, video va fayllarni qo‘shish"
date: 2026-10-03T11:10:00+09:00
draft: true
categories: ["Qo‘llanmalar", "Media"]
description: "Izohli rasmlar, YouTube videolari va yuklab olinadigan fayllar."
cover:
  image: "cover.jpg"
  alt: "Quyosh botayotgan paytdagi shahar osmono‘par binolari"
  caption: "Muqova rasmi maqola faylining sarlavhasida belgilanadi. Rasm: Kevin Young / Unsplash"
---

Rasm va fayllar maqolaning o‘z papkasiga, uning matn fayllari yoniga qo‘yiladi. Barcha til versiyalari bir xil fayllardan foydalanadi, shuning uchun har bir rasm faqat bir marta yuklanadi.

<!--more-->

## Fayllarni qayerga qo‘yish kerak {#files-folder}

```text
content/posts/guide-media/
├── index.uz.md
├── index.uz-cyrl.md
├── index.ru.md
├── index.en.md
├── cover.jpg
├── workspace.jpg
├── landscape.jpg
├── typewriter.jpg
├── buildings.jpg
└── sample-document.pdf
```

- Fayllarga oddiy nom bering: kichik lotin harflari va chiziqchalar, bo‘sh joysiz. `IMG 2034 (1).JPG` emas, `team-meeting.jpg` deb yozing.
- Fotosuratlar uchun JPG, skrinshotlar uchun PNG ishlating.
- Telefondan olingan katta rasmlar ham bo‘laveradi: sayt ularni internet uchun qulay o‘lchamga o‘zi kichraytiradi.

## Muqova rasmi {#cover}

Muqova matnda emas, fayl sarlavhasida belgilanadi. U maqola boshida va maqolalar ro‘yxatidagi kartochkasida ko‘rinadi:

```yaml
cover:
  image: "cover.jpg"
  alt: "Quyosh botayotgan paytdagi shahar"   # ekran o‘quvchi dasturlar uchun rasm tavsifi
  caption: "Rasm: Kevin Young / Unsplash"    # maqola sahifasida rasm ostidagi izoh
```

Muqovani ro‘yxatda emas, faqat maqola sahifasida ko‘rsatish uchun `cover:` ostiga `hiddenInList: true` qo‘shing.

## Matn ichidagi rasm {#photo}

```markdown
![Yog‘och stol ustidagi noutbuk va daftar](workspace.jpg)
```

![Yog‘och stol ustidagi noutbuk va daftar](workspace.jpg)

Kvadrat qavs ichidagi matn rasmni tavsiflaydi. O‘quvchilar uni ko‘rmaydi, lekin ekran o‘quvchi dasturlar va qidiruv tizimlari undan foydalanadi, rasm yuklanmasa esa shu matn chiqadi.

## Izohli rasm {#caption}

```markdown
{{</* figure src="landscape.jpg" alt="Qoyali tog‘lar orasidagi moviy fyord"
    title="Izohli rasm"
    caption="Rasm: [Alexey Topolyanskiy](https://unsplash.com/photos/-oWyJoSqBRM) / Unsplash" */>}}
```

{{< figure src="landscape.jpg" alt="Qoyali tog‘lar orasidagi moviy fyord"
    title="Izohli rasm"
    caption="Rasm: [Alexey Topolyanskiy](https://unsplash.com/photos/-oWyJoSqBRM) / Unsplash" >}}

`title` qalin harflarda, `caption` esa uning ostida ko‘rsatiladi. Ikkalasi ham ixtiyoriy, `caption` ichida havolalar ishlaydi.

## Kichikroq, markazdagi rasm {#size}

```markdown
{{</* figure src="typewriter.jpg" alt="Eski yozuv mashinkasi" width="360" align="center"
    caption="Eni 360 piksel, markazda" */>}}
```

{{< figure src="typewriter.jpg" alt="Eski yozuv mashinkasi" width="360" align="center"
    caption="Eni 360 piksel, markazda" >}}

`width` bo‘lmasa, rasm matnning butun enini egallaydi.

## To‘liq o‘lchamda ochiladigan rasm {#full-size}

```markdown
{{</* figure src="buildings.jpg" alt="Pastdan ko‘rinayotgan ofis minoralari"
    link="buildings.jpg" target="_blank"
    caption="Rasmni yangi oynada to‘liq o‘lchamda ochish uchun ustiga bosing" */>}}
```

{{< figure src="buildings.jpg" alt="Pastdan ko‘rinayotgan ofis minoralari"
    link="buildings.jpg" target="_blank"
    caption="Rasmni yangi oynada to‘liq o‘lchamda ochish uchun ustiga bosing" >}}

`link` ga istalgan manzilni, masalan, boshqa maqolani ham yozish mumkin.

## Boshqa saytdagi rasm {#external-photo}

```markdown
![Tavsif](https://example.com/photo.jpg)
```

Bu ishlaydi, lekin boshqa sayt rasmni o‘chirsa yoki ko‘chirsa, rasm yo‘qoladi. Imkon bo‘lsa, rasmni maqola papkasiga saqlang.

## YouTube videosi {#youtube}

Videolar saytga yuklanmaydi. Ular YouTube’dan ijro etiladi, shuning uchun faqat video ID’si — manzil oxiridagi kod kerak:

| YouTube manzili                                 | Video ID      |
|:------------------------------------------------|:--------------|
| `https://www.youtube.com/watch?v=aqz-KE-bpKQ`   | `aqz-KE-bpKQ` |
| `https://youtu.be/aqz-KE-bpKQ`                  | `aqz-KE-bpKQ` |
| `https://www.youtube.com/shorts/aqz-KE-bpKQ`    | `aqz-KE-bpKQ` |

Keyin shunday yozing:

```markdown
{{</* youtube aqz-KE-bpKQ */>}}
```

{{< youtube aqz-KE-bpKQ >}}

Video matnning butun enini egallaydi va telefonlarda ham shaklini saqlaydi.

Videoni ma’lum bir soniyadan, masalan 1:00 dan boshlash uchun `start` dan foydalaning. `end` uni belgilangan soniyada to‘xtatadi:

```markdown
{{</* youtube id="aqz-KE-bpKQ" start="60" end="90" */>}}
```

{{< youtube id="aqz-KE-bpKQ" start="60" end="90" >}}

*Video: «Big Buck Bunny» © Blender Foundation, CC BY 3.0. Video ostiga izoh sifatida shunga o‘xshash kursiv qator yozish mumkin.*

## Yuklab olinadigan fayllar {#download}

Faylni maqola papkasiga qo‘ying va unga havola qiling:

```markdown
[Namuna hujjatni yuklab olish (PDF, 24 KB)](sample-document.pdf)
```

[Namuna hujjatni yuklab olish (PDF, 24 KB)](sample-document.pdf)

Shu tarzda istalgan turdagi faylni biriktirish mumkin: `.pdf`, `.docx`, `.xlsx`, `.zip` va boshqalar. O‘quvchi nimani yuklab olayotganini bilishi uchun havola matnida fayl turi va hajmini ko‘rsating.

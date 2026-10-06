---
title: "How to add photos, videos and files"
date: 2026-10-03T11:10:00+09:00
draft: true
categories: ["Guides", "Media"]
description: "Photos with captions, YouTube videos and downloadable files."
cover:
  image: "cover.jpg"
  alt: "A city skyline at sunset"
  caption: "The cover photo is set in the article header. Photo: Kevin Young / Unsplash"
---

Photos and files go into the article's own folder, next to its text files. All language versions use the same files, so each photo is uploaded only once.

<!--more-->

## Where to put the files {#files-folder}

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

- Give files simple names: lowercase Latin letters and hyphens, no spaces. Write `team-meeting.jpg`, not `IMG 2034 (1).JPG`.
- Use JPG for photos and PNG for screenshots.
- Large photos straight from a phone are fine: the site shrinks them to a web-friendly size automatically.

## Cover photo {#cover}

The cover is set in the header, not in the text. It appears at the top of the article and on its card in the article list:

```yaml
cover:
  image: "cover.jpg"
  alt: "A city skyline at sunset"          # describes the photo for screen readers
  caption: "Photo: Kevin Young / Unsplash" # shown under the photo on the article page
```

To show the cover on the article page only, and not in the list, add `hiddenInList: true` under `cover:`.

## A photo in the text {#photo}

```markdown
![A laptop and a notebook on a wooden desk](workspace.jpg)
```

![A laptop and a notebook on a wooden desk](workspace.jpg)

The text in square brackets describes the photo. Readers don't see it, but screen readers and search engines use it, and it appears if the photo fails to load.

## Photo with a caption {#caption}

```markdown
{{</* figure src="landscape.jpg" alt="A blue fjord between rocky mountains"
    title="Photo with a caption"
    caption="Photo: [Alexey Topolyanskiy](https://unsplash.com/photos/-oWyJoSqBRM) / Unsplash" */>}}
```

{{< figure src="landscape.jpg" alt="A blue fjord between rocky mountains"
    title="Photo with a caption"
    caption="Photo: [Alexey Topolyanskiy](https://unsplash.com/photos/-oWyJoSqBRM) / Unsplash" >}}

`title` is shown in bold and `caption` below it. Both are optional, and links work inside `caption`.

## Smaller, centered photo {#size}

```markdown
{{</* figure src="typewriter.jpg" alt="An old typewriter" width="360" align="center"
    caption="360 pixels wide, centered" */>}}
```

{{< figure src="typewriter.jpg" alt="An old typewriter" width="360" align="center"
    caption="360 pixels wide, centered" >}}

Without `width`, a photo fills the width of the text.

## Photo that opens full size {#full-size}

```markdown
{{</* figure src="buildings.jpg" alt="Office towers seen from below"
    link="buildings.jpg" target="_blank"
    caption="Click the photo to open it full size in a new tab" */>}}
```

{{< figure src="buildings.jpg" alt="Office towers seen from below"
    link="buildings.jpg" target="_blank"
    caption="Click the photo to open it full size in a new tab" >}}

`link` can also be any web address, for example a related article.

## Photo from another website {#external-photo}

```markdown
![Description](https://example.com/photo.jpg)
```

This works, but the photo disappears if the other website removes or moves it. When you can, save the photo into the article folder instead.

## YouTube video {#youtube}

Videos are not uploaded to the site. They play from YouTube, so you only need the video's ID, the code at the end of its address:

| YouTube address                                 | Video ID      |
|:------------------------------------------------|:--------------|
| `https://www.youtube.com/watch?v=aqz-KE-bpKQ`   | `aqz-KE-bpKQ` |
| `https://youtu.be/aqz-KE-bpKQ`                  | `aqz-KE-bpKQ` |
| `https://www.youtube.com/shorts/aqz-KE-bpKQ`    | `aqz-KE-bpKQ` |

Then write:

```markdown
{{</* youtube aqz-KE-bpKQ */>}}
```

{{< youtube aqz-KE-bpKQ >}}

The video fills the width of the text and keeps its shape on phones.

To start the video at a given second, for example at 1:00, use `start`. `end` stops it at a given second:

```markdown
{{</* youtube id="aqz-KE-bpKQ" start="60" end="90" */>}}
```

{{< youtube id="aqz-KE-bpKQ" start="60" end="90" >}}

*Video: "Big Buck Bunny" © Blender Foundation, CC BY 3.0. You can write a line in italics like this one under a video as its caption.*

## Downloadable files {#download}

Put the file into the article folder and link to it:

```markdown
[Download the sample document (PDF, 24 KB)](sample-document.pdf)
```

[Download the sample document (PDF, 24 KB)](sample-document.pdf)

This works for any type of file: `.pdf`, `.docx`, `.xlsx`, `.zip` and so on. Mention the type and size in the link text so readers know what they will get.

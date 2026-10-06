---
title: "How to write an article: text formatting"
date: 2026-10-03T11:00:00+09:00
draft: true
categories: ["Guides"]
description: "Every text style you can use in an article, with the exact Markdown to type."
---

Articles are plain text files written in **Markdown**: you type a few simple symbols and they turn into formatted text. Each section below first shows what to type, then how it looks on the site.

<!--more-->

## Where articles live {#where}

Every article is a folder inside `content/posts/`. The folder holds one text file per language, plus any photos or files the article uses:

```text
content/posts/my-article/
├── index.uz.md        ← Uzbek (Latin)
├── index.uz-cyrl.md   ← Uzbek (Cyrillic)
├── index.ru.md        ← Russian
├── index.en.md        ← English
└── photo.jpg          ← shared by all languages
```

The folder name becomes the web address, for example `/posts/my-article/`. Use lowercase Latin letters and hyphens only.

To start a new article, copy an existing folder, or run:

```bash
hugo new posts/my-article/index.en.md
```

## The header {#header}

Each file starts with a header between two `---` lines. It holds the settings of the article, not its text:

```yaml
---
title: "How to apply for a D-2 student visa"   # shown in the list and on the page
date: 2026-10-03T11:00:00+09:00   # release date; the list is sorted by it
draft: true                       # true = hidden; visible only with `hugo server -D`
categories: ["Guides", "Visas"]   # one or more categories
description: "One sentence shown under the title in the article list"
---
```

- Set `draft: false` when the article is ready to publish.
- Every article gets a table of contents built from its headings. To hide it, add `ShowToc: false` to the header; `TocOpen: true` shows it already opened.
- After posting the article in the Telegram channel, add `telegram: "https://t.me/kvp_partners/123"` (the post link) to show that post's comments under the article.
- Spell each category exactly the same way in every article of the same language: "Visa" and "Visas" become two different buttons.
- The photo shown at the top (`cover`) is explained in [How to add photos, videos and files](/posts/guide-media/).

## Headings {#headings}

The article title is the biggest heading, so headings inside the text start at two `#`:

```markdown
## Section
### Sub-section
#### Smaller heading
```

This page uses them: "Headings" above is a `##` heading, and "Bold, italic, strikethrough" below is a `###` heading. Headings also make up the table of contents at the top of the page.

## Paragraphs and line breaks {#paragraphs}

Leave an empty line between paragraphs. A single line break is ignored; to start a new line inside a paragraph, end the line with a backslash `\`.

```markdown
First paragraph.

Second paragraph,\
with a forced line break.
```

First paragraph.

Second paragraph,\
with a forced line break.

## Text styles {#text-styles}

### Bold, italic, strikethrough

```markdown
**bold**, *italic*, ***bold and italic***, ~~strikethrough~~
```

**bold**, *italic*, ***bold and italic***, ~~strikethrough~~

### Highlight, underline, subscript, superscript

```markdown
==highlighted==, ++underlined++, H~2~O, 25 m^2^
```

==highlighted==, ++underlined++, H~2~O, 25 m^2^

### Inline code

For exact values, file names or commands:

```markdown
The visa type is written as `D-2` in the application.
```

The visa type is written as `D-2` in the application.

### Automatic typography

Straight quotes, double hyphens and three dots are converted for you:

```markdown
"Quotes" -- en dash --- em dash...
```

"Quotes" -- en dash --- em dash...

Any other character can be typed directly: «», №, ₩, €, ©, 🇰🇷 🎓 ✈️.

## Links {#links}

```markdown
- [A website](https://www.hikorea.go.kr)
- <https://www.visa.go.kr>
- [An email address](mailto:info@example.com)
- [Another article on this blog](/posts/guide-media/)
- [A section of this page](#tables)
```

- [A website](https://www.hikorea.go.kr)
- <https://www.visa.go.kr>
- [An email address](mailto:info@example.com)
- [Another article on this blog](/posts/guide-media/)
- [A section of this page](#tables)

A link to another article (`/posts/…`) automatically opens it in the reader's current language. A plain web address like https://www.visa.go.kr also becomes a link by itself.

A link to a section uses the name in curly braces after its heading. For example, this page's table section is written as `## Tables {#tables}`. Without the braces the name is made from the heading text, which differs between languages.

## Lists {#lists}

### Bulleted list

```markdown
- Passport
- Photo, 3.5 × 4.5 cm
  - white background (indent with two spaces)
  - taken within the last 6 months
- Application form
```

- Passport
- Photo, 3.5 × 4.5 cm
  - white background (indent with two spaces)
  - taken within the last 6 months
- Application form

### Numbered list

```markdown
1. Collect the documents
2. Book an appointment
   1. Choose the date (indent with three spaces)
   2. Pay the fee
3. Attend the interview
```

1. Collect the documents
2. Book an appointment
   1. Choose the date (indent with three spaces)
   2. Pay the fee
3. Attend the interview

The numbers count themselves: you can write `1.` on every line.

### Checklist

```markdown
- [x] Passport copied
- [ ] Bank statement
```

- [x] Passport copied
- [ ] Bank statement

## Quotes and notes {#quotes}

```markdown
> A quote can span
> several lines.
>
> — Author's name

> **Note:** a quote that starts with a bold word works well as a warning or a tip.
```

> A quote can span
> several lines.
>
> — Author's name

> **Note:** a quote that starts with a bold word works well as a warning or a tip.

## Tables {#tables}

```markdown
| Document         | Copies | Ready |
|:-----------------|-------:|:-----:|
| Passport         |      1 |   ✓   |
| Photo            |      2 |   ✓   |
| Application form |      1 |   —   |
```

| Document         | Copies | Ready |
|:-----------------|-------:|:-----:|
| Passport         |      1 |   ✓   |
| Photo            |      2 |   ✓   |
| Application form |      1 |   —   |

The second line sets the alignment of each column: `:---` left, `:---:` center, `---:` right. The columns don't have to line up in the text file.

## Code blocks {#code}

Put three backticks on the lines before and after the code. Add the language name after the first backticks to get colors:

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

Line numbers and highlighted lines:

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

## Footnotes {#footnotes}

```markdown
A C-3 visa allows a short stay.[^1] Footnotes are numbered automatically.[^source]

[^1]: The exact length depends on the visa issued.
[^source]: The label after ^ can be any word; readers see a number.
```

A C-3 visa allows a short stay.[^1] Footnotes are numbered automatically.[^source]

[^1]: The exact length depends on the visa issued.
[^source]: The label after ^ can be any word; readers see a number.

The footnote texts appear at the very end of the article, wherever you write them in the file.

## Definitions {#definitions}

```markdown
Sponsor
: A person or company that supports the application.

Apostille
: A certificate that makes a document valid abroad.
```

Sponsor
: A person or company that supports the application.

Apostille
: A certificate that makes a document valid abroad.

## Divider line {#divider}

Three hyphens on their own line, with an empty line above:

```markdown
---
```

---

## Collapsible block {#collapsible}

Useful for questions and answers: the content stays hidden until the reader clicks.

```markdown
{{</* details summary="Can I format text in here?" */>}}
Yes: **bold**, *italic*, [links](#links) and lists all work inside.
{{</* /details */>}}
```

{{< details summary="Can I format text in here?" >}}
Yes: **bold**, *italic*, [links](#links) and lists all work inside.
{{< /details >}}

## Showing symbols as they are {#escaping}

Put a backslash before a symbol to stop it from formatting:

```markdown
\*not italic\*, 5 \* 3
```

\*not italic\*, 5 \* 3

## Description in the list {#preview}

Each card in the article list shows the article's description, `description: "…"` in the header, under its title. The article page itself doesn't show it, so write it to make readers want to open the article. An article without a description shows the start of its text instead: the text above the `<!--more-->` line (this article has one after its first paragraph), or without that line the first 70 words or so.

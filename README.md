# Korean Visa Planner blog

Source of the KVP Partners blog (https://kvppartners.com), built with
[Hugo](https://gohugo.io) and the [PaperMod](https://github.com/adityatelange/hugo-PaperMod) theme,
and hosted on Cloudflare Workers.

## Running locally

Writing and previewing articles:

```bash
hugo server -D          # http://localhost:1313 (-D also shows drafts)
```

Reactions under articles need the small Cloudflare Worker in `worker/`, so they
don't appear under `hugo server`. To try the full site, including reactions,
run it with Cloudflare's local tool (needs Node.js; the data stays on your computer):

```bash
hugo -D --baseURL http://localhost:8787/
npx wrangler d1 migrations apply kvp-blog --local   # first time only
npx wrangler dev                                    # http://localhost:8787
```

`--baseURL` makes links and photos point to your computer instead of the real
domain. After changing content, run the `hugo` line again and restart `npx wrangler dev`.

## Deploying to Cloudflare

One-time setup:

1. Log in to Cloudflare from the terminal: `npx wrangler login`
2. Create the reactions database: `npx wrangler d1 create kvp-blog`.
   Copy the `database_id` it prints into `wrangler.jsonc`, then commit and push.
3. Create its tables: `npx wrangler d1 migrations apply kvp-blog --remote`
4. In the Cloudflare dashboard, go to **Workers & Pages → Create → Import a repository**,
   pick this repository and set:
   - **Build command:** `git submodule update --init --recursive && hugo --gc --minify`
     (the first part downloads the PaperMod theme, which is a git submodule)
   - **Deploy command:** `npx wrangler deploy` (the default)
   - **Build variable:** `HUGO_VERSION` = `0.167.0`. Cloudflare's default Hugo is
     older and cannot build this site.
5. Attach the domain under the Worker's **Settings → Domains & Routes**.

After that, every push to the main branch rebuilds and publishes the site.
If a new file is added to `worker/migrations/`, run step 3 again.

## Test site (dev.kvppartners.com)

New features are tested on https://dev.kvppartners.com before they reach the main site.
It is a second Worker, `kvp-blog-dev`, built from the `dev` branch; the production Worker
above keeps building `main`. The test site:

- shows draft pages too (`--buildDrafts`), so a page with `draft: true` can be tested
  there while the main site leaves it out;
- asks for a login (Cloudflare Access, step 8 below);
- tells search engines not to index it (Hugo builds it as the `dev` environment, so pages
  get `noindex`);
- has its own database (`kvp-blog-dev`, `env.dev` in `wrangler.jsonc`), so test reactions
  and problem reports never reach the main site's data.

One-time setup (after the production setup above):

1. Create the test database: `npx wrangler d1 create kvp-blog-dev`. Copy the
   `database_id` it prints into `wrangler.jsonc`, under `env.dev`.
2. Create its tables: `npx wrangler d1 migrations apply kvp-blog-dev --remote --env dev`
3. Commit, create the `dev` branch and push it:
   `git checkout -b dev`, commit, then `git push -u origin dev`.
4. Create the Worker with a first deploy from your computer:

   ```bash
   git submodule update --init --recursive
   hugo --gc --minify --buildDrafts --environment dev --baseURL https://dev.kvppartners.com/ --cleanDestinationDir
   npx wrangler deploy --env dev
   ```

5. Problem reports: give the test Worker the Telegram bot's token and chat id (the same
   bot works; reports from the test site have a dev.kvppartners.com link):
   `npx wrangler secret put TELEGRAM_BOT_TOKEN --env dev`, then
   `npx wrangler secret put TELEGRAM_CHAT_ID --env dev`.
6. In the Cloudflare dashboard, open **Workers & Pages → kvp-blog-dev**:
   - **Settings → Domains & Routes → Add → Custom domain:** `dev.kvppartners.com`
   - **Settings → Build → Connect** this repository, and set:
     - **Branch:** `dev`
     - **Build command:** `git submodule update --init --recursive && hugo --gc --minify --buildDrafts --environment dev --baseURL https://dev.kvppartners.com/`
     - **Deploy command:** `npx wrangler deploy --env dev`
     - **Preview builds** (builds for other branches): off
     - **Build variables:** `HUGO_VERSION` = `0.167.0`, and `SHOW_DOCUMENT_SOURCE` = `true` if
       the test site should show where to get each document
7. On the production Worker (**kvp-blog → Settings → Build → Branch control**), keep the
   branch `main` and turn preview builds off, so pushes to `dev` build only the test site.
8. Login for the test site, with Cloudflare Access (no code; the main site stays open):
   - **Zero Trust** (left menu of the dashboard): the first time, choose a team name and the
     **Free** plan. It asks for payment details but charges nothing.
   - **Zero Trust → Access controls → Applications → Create new application → Self-hosted
     and private → Add public hostname:** `dev.kvppartners.com`.
   - Policy: **Allow**, include **Emails** with the addresses that may open the test site.
   - Login methods: the **Cloudflare** login (your Cloudflare account) is the default for new
     Zero Trust accounts and lets in only members of your Cloudflare account. For people
     without one, add **Zero Trust → Integrations → Identity providers → Add new identity
     provider → One-time PIN** and select it in the application: they type their email and
     get a code.
   - `workers_dev` and `preview_urls` are off for `env.dev` in `wrangler.jsonc`, so the test
     Worker has no other public address that would skip the login.

From then on:

- Push to `dev`: the test site rebuilds. Push to `main`: the main site rebuilds.
- To release: merge `dev` into `main` and push `main`. A page that is still
  `draft: true` stays off the main site until you set `draft: false`.
- A new file in `worker/migrations/` must be applied to both databases: step 3 of the
  production setup and step 2 here.
- Production builds print a warning that `wrangler.jsonc` has more than one environment.
  It is harmless; the deploy command `npx wrangler deploy --env=""` silences it.

## Visa docs

The **Visa docs** page (`content/visa-docs/`, menu item after Visa map) lists the documents
to prepare for a move between two visas, inside Korea (change of status) or at a Korean
embassy (first visa, or a ✈ move), or for an extension of stay on the current visa. Every
visa with an official document list is offered; the Visa map's usual next steps come first.
A move within one status (D-2-2 → D-2-3) is offered only when the manual says how it is made
(`within` in the data).

- The lists live in `data/visadocs.yaml`, copied from the Korea Immigration Service manuals
  with the source of each list. Add only documents from official lists.
- Optional questions on the page come from the lists themselves: the manual's applicant
  cases, its extra documents for some occupations and regional programmes (`addon`), and
  the documents it marks as applying only to some people. Cases for some nationalities only
  (visa agreements, the marriage guidance programme) are shown only to them.
- A list the manual gives only in part is marked `partial`, and the page says so. Visas
  whose manual chapter has no document list are not offered.
- **Where to get each document** (download the form or get it online) shows only when the
  site is built with the environment variable `SHOW_DOCUMENT_SOURCE=true`; otherwise it is
  hidden. Hugo reads it at build time: on Cloudflare, set it under the Worker's
  **Settings → Build → Variables and secrets** (not the runtime variables) and redeploy.
  Locally: `SHOW_DOCUMENT_SOURCE=true hugo server -D`. Page text that only makes sense
  with the links goes inside `{{% document-sources %}}…{{% /document-sources %}}`.
- Page layout: `layouts/visa-docs.html`; logic: `assets/js/visadocs.js`. Code shared with the
  Visa map (search box, pictures, problem reports) is in `assets/js/visa/`.

## Archive

The **Archive** page (`content/archive/`, menu item after Visa docs) offers official blank
forms to download as PDF, HWP or Word: the 156 forms on HiKorea's forms page (민원서식) and the
EPS standard labour contract, grouped as on HiKorea, with a search box.

- The list lives in `data/archive.yaml`; the files are in `static/forms/`, named after each
  form's `id`. Keep the files unchanged and name the source: Korean government forms may be
  shared (Copyright Act arts. 7, 24-2 and 37), but only as the government published them.
- A form changed: download the new file from the source page, replace the file in
  `static/forms/` under the same name, update its `size` and the `updated` date.
- A new form: add it to its group in `data/archive.yaml` with names in all four languages, and
  put its files in `static/forms/`.
- `catalog` in the same file says which Visa docs documents are one of these forms. With
  `SHOW_DOCUMENT_SOURCE=true` (see Visa docs), those documents link to the form on this page.
- Page layout: `layouts/archive.html`; search: `assets/js/archive.js`.

## Problem reports (Telegram bot)

**Report a problem** on the Visa map and Visa docs pages sends the reader's message, a
bug-report picture and what the page shows as text to you through a Telegram bot,
without opening Telegram. The bot's token stays in Cloudflare (`worker/index.js`,
`/api/report`); browsers never see it.

One-time setup:

1. In Telegram, open **@BotFather**, send `/newbot`, choose a name and a username
   ending in `bot`, and copy the token it gives you.
2. From the account that should receive reports (@kvp_partners_admin), open the new
   bot and press **Start**: a bot can only write to people who started it. (Or add the
   bot to a private group for the team.)
3. Find the chat id: open `https://api.telegram.org/bot<TOKEN>/getUpdates` in a
   browser; the number after `"chat":{"id":` is it (negative for a group).
4. Save both as secrets of the Worker:
   ```bash
   npx wrangler secret put TELEGRAM_BOT_TOKEN
   npx wrangler secret put TELEGRAM_CHAT_ID
   ```
   or in the dashboard: **Workers & Pages → kvp-blog → Settings → Variables and
   Secrets → Add**, type *Secret*.
5. Create the flood-protection table: `npx wrangler d1 migrations apply kvp-blog --remote`

Reports leave out sensitive answers (under Korea's Personal Information Protection Act,
information about ethnicity, health, beliefs or criminal records is "sensitive"): the Visa map
report leaves out Korean descent (`SENSITIVE` in `assets/js/visamap.js`), and the Visa docs
report leaves out the reader's yes/no answers (`withoutAnswers` in `assets/js/visadocs.js`).
The report's link opens the page without them. The report form tells readers that reports are
deleted once the problem is fixed, so delete them from the Telegram chat then.

Each reader can send 5 reports an hour, and the site at most 100 a day. Until the
secrets are set (and under `hugo server`, which has no Worker), the dialog offers a
Telegram link with the report filled in instead. To try the bot locally, put the two
values in `.dev.vars` (ignored by git) and run `npx wrangler dev`.

## Privacy policy

`content/privacy/` says what personal information the site handles (reactions, hashed IP
addresses for flood protection, problem reports), who else handles it (Cloudflare, Telegram)
and how long it is kept. It is `draft: true` until you have checked it; once published, the
footer and the problem-report form link to it. Update it when the site starts collecting
anything new, in all four languages.

## Comments from Telegram

Comments under an article come from its post in the Telegram channel, through
Telegram's discussion widget. The channel must be public and have a discussion
group linked.

After posting an article in the channel, copy the post link in Telegram and add it
to the front matter of that language's article file, then push:

```yaml
telegram: "https://t.me/kvp_partners/123"
```

Articles without this line simply show no comments section.

## Telegram Instant View

Articles can open inside Telegram, in Instant View, without leaving the app. Telegram
builds that page from a template (`instant-view.txt`) and only uses it for links of the
form `https://t.me/iv?url=<article>&rhash=<template id>`. Each article has a **Copy link
for Telegram** button that copies exactly that link; paste it in the channel post.

One-time setup:

1. Open <https://instantview.telegram.org/my/> and log in with Telegram.
2. Enter an article address, for example `https://kvppartners.com/posts/4/`, to open
   the editor for kvppartners.com.
3. Replace the editor's template with the whole of `instant-view.txt`. The preview on
   the right should show the article with its cover; check one in another language and
   one with photos or videos too, and fix anything the editor reports.
4. Use the editor's **View in Telegram** button. The `t.me/iv` link it gives contains
   `rhash=...`: copy that value into `hugo.toml` and push:
   ```toml
   instantViewRhash = "1a2b3c4d5e6f7a"
   ```
   The button appears under articles once this is set.

Then, for each article: open it on the site, press **Copy link for Telegram**, and paste
the link in the channel post. The preview shows an **Instant View** button and a **Join**
button for @kvp_partners. To keep the long link out of the text, attach it to a word
instead (select the word, Ctrl+K). Telegram keeps its own copy of a page for a while, so
later edits to an article can take some time to appear there.

If the template is changed in the editor and its `rhash` changes, update `hugo.toml`.
Plain `kvppartners.com` links get Instant View only if Telegram approves the template
(**Submit** in the editor), which can take long or not happen; the `t.me/iv` links
work without it.

## Visa map

The **Visa map** page (`content/visa-map/`, menu item next to Home) lets readers draw
their path to permanent residence (F-5), from their current visa or from no visa yet
(`NONE`), and download it as a PNG image. Nationality and age are required; family,
Korean descent, education, Korean level, work experience and investment are optional
and only hide options that clearly don't fit. It runs entirely in the browser.

- Visa types, the moves between them, and who they are for live in
  `data/visamap.yaml`. Edit that file to update the map; each visa has names and
  "how to get it" notes in all four languages. The comments at the top of the file
  explain the rules (`age`, `countries`, `needs`, `gives`, `lang`).
- The nationality list and its names in each language live in `data/countries.yaml`.
- `hugo` warns about missing translations, unknown next visas, unknown countries and
  unknown rule names in these files, so check the build output after editing them.
- The page address keeps the current map (answers and path after `#`), so a copied
  address opens the same map.
- **Report a problem** sends the reader's message to you through a Telegram bot; see
  [Problem reports](#problem-reports-telegram-bot). Remove
  `telegramAdmin` from `hugo.toml` to hide the button.
- Page layout: `layouts/visa-map.html`; logic and PNG drawing: `assets/js/visamap.js`.
- Add more pages to the menu by putting this in their front matter:
  ```yaml
  menus:
    main:
      weight: 20
  ```

## License

Copyright (c) 2026 KVP Partners. All rights reserved.

This repository is public for viewing only. Its articles, images, logo and code
may not be copied, reused or published, commercially or otherwise, without
written permission from KVP Partners. Third-party parts (Hugo, PaperMod and
icons) keep their own licenses. See [LICENSE](LICENSE) for the full terms.

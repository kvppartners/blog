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

## Visa map problem reports (Telegram bot)

**Report a problem** on the Visa map sends the reader's message, a bug-report picture
and the map as text to you through a Telegram bot, without opening Telegram. The
bot's token stays in Cloudflare (`worker/index.js`, `/api/report`); browsers never see it.

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

Each reader can send 5 reports an hour, and the site at most 100 a day. Until the
secrets are set (and under `hugo server`, which has no Worker), the dialog offers a
Telegram link with the report filled in instead. To try the bot locally, put the two
values in `.dev.vars` (ignored by git) and run `npx wrangler dev`.

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
  [Visa map problem reports](#visa-map-problem-reports-telegram-bot). Remove
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

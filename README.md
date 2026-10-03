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

## License

Copyright (c) 2026 KVP Partners. All rights reserved.

This repository is public for viewing only. Its articles, images, logo and code
may not be copied, reused or published, commercially or otherwise, without
written permission from KVP Partners. Third-party parts (Hugo, PaperMod and
icons) keep their own licenses. See [LICENSE](LICENSE) for the full terms.

// Cloudflare Worker for the blog.
//
// The site itself is static: Cloudflare serves everything in ./public directly
// and this code only runs for paths that are not a file there. It provides two
// endpoints:
//
// /api/reactions stores the emoji reactions under articles in the D1 database
// bound as env.DB (see wrangler.jsonc).
//   GET  /api/reactions?key=/posts/x&visitor=<id>
//        -> { counts: { "👍": 3, ... }, mine: ["👍"] }
//   POST /api/reactions  { path, key, reaction, visitor, active }
//        -> same shape, after adding (active: true) or removing the reaction
//
// /api/report passes problem reports from the Visa map and Visa docs pages to the admin
// through a Telegram bot.
// The bot token and the admin chat id are secrets (TELEGRAM_BOT_TOKEN,
// TELEGRAM_CHAT_ID), never sent to browsers; setup steps are in README.md.
//   POST /api/report  multipart form: message, name, contact, details, link, lang and
//        an optional PNG picture -> { ok: true }

const MAX_CHANGES_PER_MINUTE = 30; // per IP address, to stop scripted flooding
const MAX_REPORTS_PER_HOUR = 5; // per IP address
const MAX_REPORTS_PER_DAY = 100; // from everyone, so a flood can't bury the admin chat
const MAX_PICTURE_BYTES = 4 * 1024 * 1024;
const REPORT_LANGS = new Set(['en', 'ru', 'uz', 'uz-cyrl']);
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const REPORT_PAGES = /\/visa-(?:map|docs)\/$/;

// A single emoji, optionally with skin tone, variation selector or ZWJ sequence.
const EMOJI = /^\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier}|‍\p{Extended_Pictographic})*$/u;
// Article paths as Hugo writes them: lowercase segments, e.g. /ru/posts/guide-media/
const PATH = /^\/(?:[a-z0-9._-]+\/)+$/;
// Language-independent article key, e.g. /posts/guide-media
const KEY = /^(?:\/[a-z0-9._-]+)+$/;
// Visitor ids come from crypto.randomUUID() in the reader's browser.
const VISITOR = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        if (url.pathname === '/api/reactions') {
            try {
                return await handleReactions(request, env, url);
            } catch (err) {
                console.error(err);
                return json({ error: 'server error' }, 500);
            }
        }
        if (url.pathname === '/api/report') {
            try {
                return await handleReport(request, env, url);
            } catch (err) {
                console.error(err);
                return json({ error: 'server error' }, 500);
            }
        }
        // Anything else that is not a file: let the assets handler send the 404 page.
        return env.ASSETS.fetch(request);
    },
};

async function handleReactions(request, env, url) {
    if (request.method === 'GET') {
        const key = url.searchParams.get('key') || '';
        const visitor = url.searchParams.get('visitor') || '';
        if (!KEY.test(key) || key.length > 200) return json({ error: 'invalid key' }, 400);
        return json(await readState(env, key, VISITOR.test(visitor) ? visitor : ''));
    }

    if (request.method !== 'POST') {
        return json({ error: 'method not allowed' }, 405, { Allow: 'GET, POST' });
    }
    // Only accept changes sent by pages of this site.
    if (request.headers.get('Origin') !== url.origin) {
        return json({ error: 'forbidden' }, 403);
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return json({ error: 'invalid JSON' }, 400);
    }
    const { path, key, reaction, visitor, active } = body || {};
    if (typeof path !== 'string' || path.length > 200 || !PATH.test(path) ||
        typeof key !== 'string' || key.length > 200 || !KEY.test(key) ||
        // The key is the path without the language prefix, e.g. /ru/posts/x/ -> /posts/x
        !path.endsWith(key + '/') ||
        typeof reaction !== 'string' || reaction.length > 32 || !EMOJI.test(reaction) ||
        typeof visitor !== 'string' || !VISITOR.test(visitor) ||
        typeof active !== 'boolean') {
        return json({ error: 'invalid request' }, 400);
    }

    // Reactions are only stored for pages that exist on the site.
    const page = await env.ASSETS.fetch(new URL(path, url));
    if (page.status !== 200) return json({ error: 'unknown page' }, 404);

    if (!(await allowChange(request, env))) {
        return json({ error: 'too many requests' }, 429, { 'Retry-After': '60' });
    }

    if (active) {
        await env.DB.prepare('INSERT OR IGNORE INTO reactions (page, visitor, reaction, created_at) VALUES (?, ?, ?, ?)')
            .bind(key, visitor, reaction, Date.now()).run();
    } else {
        await env.DB.prepare('DELETE FROM reactions WHERE page = ? AND visitor = ? AND reaction = ?')
            .bind(key, visitor, reaction).run();
    }
    return json(await readState(env, key, visitor));
}

async function readState(env, key, visitor) {
    const [counts, mine] = await env.DB.batch([
        env.DB.prepare('SELECT reaction, count FROM reaction_counts WHERE page = ? AND count > 0').bind(key),
        env.DB.prepare('SELECT reaction FROM reactions WHERE page = ? AND visitor = ?').bind(key, visitor),
    ]);
    return {
        counts: Object.fromEntries(counts.results.map((row) => [row.reaction, row.count])),
        mine: mine.results.map((row) => row.reaction),
    };
}

// Allows at most MAX_CHANGES_PER_MINUTE reaction changes per IP address per minute.
// Only a hash of the address is stored, and only for one minute.
async function allowChange(request, env) {
    const now = Date.now();
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const ipHash = await sha256(`${ip}|${new Date(now).toISOString().slice(0, 10)}`);

    const [, recent] = await env.DB.batch([
        env.DB.prepare('DELETE FROM throttle WHERE created_at < ?').bind(now - 60_000),
        env.DB.prepare('SELECT COUNT(*) AS n FROM throttle WHERE ip_hash = ?').bind(ipHash),
    ]);
    if (recent.results[0].n >= MAX_CHANGES_PER_MINUTE) return false;

    await env.DB.prepare('INSERT INTO throttle (ip_hash, created_at) VALUES (?, ?)').bind(ipHash, now).run();
    return true;
}

async function handleReport(request, env, url) {
    if (request.method !== 'POST') {
        return json({ error: 'method not allowed' }, 405, { Allow: 'POST' });
    }
    // Only accept reports sent by pages of this site.
    if (request.headers.get('Origin') !== url.origin) {
        return json({ error: 'forbidden' }, 403);
    }
    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
        return json({ error: 'reports are not set up' }, 503);
    }
    if (Number(request.headers.get('Content-Length') || 0) > MAX_PICTURE_BYTES + 100_000) {
        return json({ error: 'too large' }, 413);
    }

    let form;
    try {
        form = await request.formData();
    } catch {
        return json({ error: 'invalid form' }, 400);
    }
    const field = (name) => {
        const value = form.get(name);
        return typeof value === 'string' ? value.trim() : '';
    };
    const message = field('message');
    const name = field('name');
    const contact = field('contact');
    const details = field('details');
    const link = field('link');
    const lang = field('lang');
    if (!message || message.length > 2000 || name.length > 100 || contact.length > 200 || details.length > 20000 ||
        !REPORT_LANGS.has(lang) || link.length > 2000 ||
        // The link must point to the Visa map or Visa docs page on this site.
        !link.startsWith(`${url.origin}/`) || !REPORT_PAGES.test(new URL(link).pathname)) {
        return json({ error: 'invalid report' }, 400);
    }
    const pageName = new URL(link).pathname.endsWith('/visa-docs/') ? 'Visa docs' : 'Visa map';

    let picture = null;
    const file = form.get('picture');
    if (file && typeof file !== 'string') {
        if (file.size > MAX_PICTURE_BYTES) return json({ error: 'picture too large' }, 413);
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (!PNG_SIGNATURE.every((byte, i) => bytes[i] === byte)) return json({ error: 'invalid picture' }, 400);
        picture = new Blob([bytes], { type: 'image/png' });
    }

    if (!(await allowReport(request, env))) {
        return json({ error: 'too many reports' }, 429, { 'Retry-After': '3600' });
    }

    // 1. The picture with a short summary as its caption (or the summary alone);
    // 2. the full map snapshot, as a copyable block or, if too long, a text file.
    const summary = [`🐞 ${pageName} bug report`, `From: ${name || '—'}`, `Contact: ${contact || '—'}`,
        `Language: ${lang}`, `Link: ${link}`, '', message].join('\n');
    try {
        if (picture) {
            try {
                await telegram(env, 'sendPhoto', { caption: clip(summary, 1024) }, ['photo', picture, 'bug-report.png']);
            } catch {
                // Telegram refuses some photo sizes; a document keeps the picture as it is.
                await telegram(env, 'sendDocument', { caption: clip(summary, 1024) }, ['document', picture, 'bug-report.png']);
            }
        } else {
            await telegram(env, 'sendMessage', { text: clip(summary, 4096), link_preview_options: '{"is_disabled":true}' });
        }
        if (details) {
            const block = `<pre>${escapeHtml(details)}</pre>`;
            if (block.length <= 4096) {
                await telegram(env, 'sendMessage', { text: block, parse_mode: 'HTML' });
            } else {
                const text = new Blob([details], { type: 'text/plain; charset=utf-8' });
                await telegram(env, 'sendDocument', { caption: 'Snapshot' }, ['document', text, 'bug-report.txt']);
            }
        }
    } catch (err) {
        console.error(err);
        return json({ error: 'could not send' }, 502);
    }
    return json({ ok: true });
}

// Calls the Telegram Bot API. TELEGRAM_API can point to a test server; it defaults
// to Telegram itself.
async function telegram(env, method, fields, file) {
    const body = new FormData();
    body.append('chat_id', env.TELEGRAM_CHAT_ID);
    for (const [name, value] of Object.entries(fields)) body.append(name, value);
    if (file) body.append(file[0], file[1], file[2]);
    const api = env.TELEGRAM_API || 'https://api.telegram.org';
    const response = await fetch(`${api}/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, { method: 'POST', body });
    const result = await response.json().catch(() => ({}));
    if (!result.ok) throw new Error(`Telegram ${method} failed: ${result.description || response.status}`);
}

// Allows MAX_REPORTS_PER_HOUR reports per IP address and MAX_REPORTS_PER_DAY in total.
// Only a hash of the address is stored, and only for a day.
async function allowReport(request, env) {
    const now = Date.now();
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const ipHash = await sha256(`report|${ip}|${new Date(now).toISOString().slice(0, 10)}`);

    const [, mine, everyone] = await env.DB.batch([
        env.DB.prepare('DELETE FROM report_log WHERE created_at < ?').bind(now - 86_400_000),
        env.DB.prepare('SELECT COUNT(*) AS n FROM report_log WHERE ip_hash = ? AND created_at >= ?').bind(ipHash, now - 3_600_000),
        env.DB.prepare('SELECT COUNT(*) AS n FROM report_log'),
    ]);
    if (mine.results[0].n >= MAX_REPORTS_PER_HOUR || everyone.results[0].n >= MAX_REPORTS_PER_DAY) return false;

    await env.DB.prepare('INSERT INTO report_log (ip_hash, created_at) VALUES (?, ?)').bind(ipHash, now).run();
    return true;
}

const clip = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);
const escapeHtml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function sha256(text) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function json(data, status = 200, headers = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
    });
}

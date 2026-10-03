// Cloudflare Worker for the blog.
//
// The site itself is static: Cloudflare serves everything in ./public directly
// and this code only runs for paths that are not a file there. It provides one
// endpoint, /api/reactions, which stores the emoji reactions under articles in
// the D1 database bound as env.DB (see wrangler.jsonc).
//
//   GET  /api/reactions?key=/posts/x&visitor=<id>
//        -> { counts: { "👍": 3, ... }, mine: ["👍"] }
//   POST /api/reactions  { path, key, reaction, visitor, active }
//        -> same shape, after adding (active: true) or removing the reaction

const MAX_CHANGES_PER_MINUTE = 30; // per IP address, to stop scripted flooding

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

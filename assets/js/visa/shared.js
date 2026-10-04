// Shared by the Visa map and Visa docs pages: page data and texts, visa codes, the visa
// search box, the nationality list and drawing pictures. Hugo bundles it into each page's
// script (js.Build in layouts/_partials/extend_footer.html).

// The starting point for readers who have no Korean visa yet.
export const NONE = 'NONE';

export const isGoal = (code) => code.startsWith('F-5');
export const statusOf = (code) => code.split('-').slice(0, 2).join('-');
export const tokens = (s) => String(s).toUpperCase().match(/[A-Z]+|\d+/g) || [];
export const fold = (s) => String(s).toLocaleLowerCase().replace(/[‘’ʻʼ`´']/g, "'").replace(/ё/g, 'е');

export function el(tag, className, content) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = content;
    return node;
}

// Natural order of visa codes: D-2-2 before D-2-10, D-10-1 after D-9-1.
export function byCode(a, b) {
    const ta = tokens(a);
    const tb = tokens(b);
    for (let i = 0; i < Math.max(ta.length, tb.length); i++) {
        if (ta[i] === undefined) return -1;
        if (tb[i] === undefined) return 1;
        const na = Number(ta[i]);
        const nb = Number(tb[i]);
        const diff = Number.isNaN(na) || Number.isNaN(nb) ? ta[i].localeCompare(tb[i]) : na - nb;
        if (diff) return diff;
    }
    return 0;
}

// The page's data and texts, embedded by its layout, with helpers in the page language.
export function pageContext(root) {
    const data = JSON.parse(document.getElementById('vm-data').textContent);
    const T = JSON.parse(document.getElementById('vm-i18n').textContent);
    const lang = root.dataset.lang;
    const visas = data.visas || {};
    const groups = data.groups || {};
    const countries = data.countries || {};
    // Picks the current language from { en, ru, uz, uz-cyrl } values.
    const text = (value) => (value && typeof value === 'object' ? value[lang] || value.en || '' : value || '');
    return {
        root,
        data,
        T,
        lang,
        langTag: lang === 'uz-cyrl' ? 'uz-Cyrl' : lang,
        visas,
        text,
        nameOf: (code) => text(visas[code] && visas[code].name),
        codeLabel: (code) => (code === NONE ? T.noVisa : code),
        countryName: (code) => countries[code] || code,
        // Nationality lists: a group name from data.groups, or a list of ISO codes.
        countryList: (value) => (typeof value === 'string' ? groups[value] || [] : value || []),
    };
}

// The nationality list: Uzbekistan first, then every country by its name in the page
// language. Names come from data/countries.yaml, since many browsers have no Uzbek names.
export function fillCountries(select, ctx) {
    const countries = ctx.data.countries || {};
    const first = ['UZ'];
    first.forEach((code) => select.add(new Option(ctx.countryName(code), code)));
    const divider = new Option('──────────', '');
    divider.disabled = true;
    select.add(divider);
    Object.keys(countries).filter((code) => !first.includes(code))
        .sort((a, b) => ctx.countryName(a).localeCompare(ctx.countryName(b), ctx.langTag))
        .forEach((code) => select.add(new Option(ctx.countryName(code), code)));
}

// Yes/no buttons (.vm-segment) can be clicked again to clear the answer.
export function clearableRadios(container) {
    container.addEventListener('click', (e) => {
        const input = e.target.closest('.vm-segment input[type="radio"]');
        if (!input) return;
        if (input.dataset.checked === 'true') input.checked = false;
        container.querySelectorAll(`input[name="${CSS.escape(input.name)}"]`).forEach((r) => {
            r.dataset.checked = String(r.checked);
        });
    });
}

// A search box for a visa: codes (D-2 lists D-2-1 … D-2-8) or words in the page language,
// with "No visa yet" first while the box is empty. `codes` are the visas it offers (a list,
// or a function when they depend on other choices); onPick(code) runs when the reader
// chooses one. With `groups` (a function returning [{ label, codes }]), an empty box lists
// every option under those headings; `mark(code)` adds a sign after a code (✈).
export function visaSearch(ctx, { input, list, codes, withNone = true, groups = null, mark = () => '', onPick = () => {} }) {
    const { T, text, nameOf, codeLabel } = ctx;
    const statuses = ctx.data.statuses || {};
    const offerNone = withNone && Boolean(ctx.visas[NONE]);
    const allCodes = () => (typeof codes === 'function' ? codes() : codes);
    let picked = null;
    let active = -1;

    function search(query) {
        const q = query.trim();
        if (!q) return offerNone ? [NONE] : [];
        const qt = tokens(q);
        const qf = fold(q);
        const hits = [];
        if (offerNone && qf.length >= 2 && fold(`${T.noVisa} ${nameOf(NONE)}`).includes(qf)) hits.push({ code: NONE, score: -1 });
        for (const code of allCodes()) {
            const ct = tokens(code);
            let score = -1;
            // Code match: every typed part matches the code; the last one may be unfinished.
            if (qt.length && qt.length <= ct.length &&
                qt.every((t, i) => (i === qt.length - 1 ? ct[i].startsWith(t) : ct[i] === t))) {
                score = qt.length === ct.length && qt[qt.length - 1] === ct[ct.length - 1] ? 0 : 1;
            } else if (qf.length >= 2 && fold(`${nameOf(code)} ${text(statuses[statusOf(code)])}`).includes(qf)) {
                score = 2;
            }
            if (score >= 0) hits.push({ code, score });
        }
        hits.sort((a, b) => a.score - b.score || byCode(a.code, b.code));
        return hits.slice(0, 40).map((h) => h.code);
    }

    function exactCode(value) {
        if (offerNone && fold(value.trim()) === fold(T.noVisa)) return NONE;
        const vt = tokens(value).join('-');
        return allCodes().find((c) => tokens(c).join('-') === vt) || null;
    }

    function option(code, i) {
        const li = el('li', code === NONE ? 'vm-option vm-option-none' : 'vm-option');
        li.id = `${list.id}-${i}`;
        li.setAttribute('role', 'option');
        li.dataset.code = code;
        li.append(el('b', '', `${codeLabel(code)}${mark(code)}`), el('span', '', nameOf(code)));
        return li;
    }

    function show() {
        active = -1;
        list.replaceChildren();
        // An empty box with groups: every option, under its heading.
        if (groups && !input.value.trim()) {
            let i = 0;
            groups().filter((group) => group.codes.length).forEach((group) => {
                const heading = el('li', 'vm-option-group', group.label);
                heading.setAttribute('role', 'presentation');
                list.append(heading, ...group.codes.map((code) => option(code, i++)));
            });
        } else {
            const hits = search(input.value);
            if (!hits.length) {
                const goal = tokens(input.value).slice(0, 2).join('-') === 'F-5';
                list.append(el('li', 'vm-option-empty', goal && !groups ? T.isGoal : T.noMatch));
            }
            hits.forEach((code, i) => list.append(option(code, i)));
        }
        list.hidden = false;
        input.setAttribute('aria-expanded', 'true');
    }

    function close() {
        list.hidden = true;
        input.setAttribute('aria-expanded', 'false');
        input.removeAttribute('aria-activedescendant');
    }

    function pick(code) {
        picked = code;
        input.value = code === NONE ? T.noVisa : `${code}${mark(code)} — ${nameOf(code)}`;
        close();
        onPick(code);
    }

    function highlight(index) {
        const items = list.querySelectorAll('.vm-option');
        if (!items.length) return;
        active = (index + items.length) % items.length;
        items.forEach((item, i) => item.classList.toggle('is-active', i === active));
        items[active].scrollIntoView({ block: 'nearest' });
        input.setAttribute('aria-activedescendant', items[active].id);
    }

    input.addEventListener('input', () => {
        picked = null;
        show();
    });
    input.addEventListener('focus', () => {
        if (!picked) show();
    });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (list.hidden) show();
            highlight(active + (e.key === 'ArrowDown' ? 1 : -1));
        } else if (e.key === 'Enter' && !list.hidden && active >= 0) {
            e.preventDefault();
            pick(list.querySelectorAll('.vm-option')[active].dataset.code);
        } else if (e.key === 'Escape') {
            close();
        }
    });
    list.addEventListener('mousedown', (e) => e.preventDefault()); // keep focus in the input
    list.addEventListener('click', (e) => {
        const option = e.target.closest('.vm-option');
        if (option) pick(option.dataset.code);
    });
    document.addEventListener('click', (e) => {
        if (!input.closest('.vm-combo').contains(e.target)) close();
    });

    return {
        get picked() {
            return picked;
        },
        pick,
        exactCode,
        // The chosen code, or the code typed in full; an empty box means "No visa yet".
        value() {
            const typed = input.value.trim();
            return picked || (typed ? exactCode(typed) : offerNone ? NONE : null);
        },
        clear() {
            picked = null;
            input.value = '';
            close();
        },
    };
}

// ---------- Pictures ----------

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Ubuntu, "Noto Sans", Arial, sans-serif';
export const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "DejaVu Sans Mono", monospace';
export const C = {
    navy: '#1e2e4f', gold: '#e8c27a', green: '#16a34a', greenSoft: '#eaf7ef',
    ink: '#1f2937', muted: '#6b7280', line: '#e5e7eb', white: '#ffffff', amber: '#b54708',
};
export const font = (weight, size, family = FONT) => `${weight} ${size}px ${family}`;

// Splits text into lines that fit maxWidth; with maxLines, the last line ends with "…".
export function wrap(ctx, value, maxWidth, maxLines) {
    const words = String(value || '').split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (!line || ctx.measureText(test).width <= maxWidth) line = test;
        else {
            lines.push(line);
            line = word;
        }
    }
    if (line) lines.push(line);
    if (maxLines && lines.length > maxLines) {
        lines.length = maxLines;
        lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[\s,.;:]+$/, '')}…`;
    }
    return lines;
}

// Wraps text that may have no spaces (links) at any character.
export function wrapAnywhere(ctx, value, maxWidth) {
    const lines = [];
    let line = '';
    for (const char of String(value)) {
        if (line && ctx.measureText(line + char).width > maxWidth) {
            lines.push(line);
            line = '';
        }
        line += char;
    }
    if (line) lines.push(line);
    return lines;
}

export function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

export function loadImage(src) {
    return new Promise((resolve) => {
        if (!src) {
            resolve(null);
            return;
        }
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
    });
}

// Draws a picture in two passes: paint(ctx, false) measures and returns the height, then
// paint(ctx, true) draws it. Resolves to a PNG.
export async function renderPicture(paint, width = 1080) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = Math.ceil(paint(canvas.getContext('2d'), false));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = C.white;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    paint(ctx, true);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('No picture');
    return blob;
}

export function saveBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = el('a');
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// The navy band at the top of result pictures: logo, site name and title. Returns its height.
export function paintBrand(ctx, draw, { logo, site, title, width = 1080, pad = 64 }) {
    const height = 220;
    ctx.textBaseline = 'alphabetic';
    if (draw) {
        ctx.fillStyle = C.navy;
        ctx.fillRect(0, 0, width, height);
        if (logo) ctx.drawImage(logo, pad, (height - 132) / 2, 132, 132);
    }
    const x = pad + 132 + 32;
    ctx.font = font(700, 50);
    if (draw) {
        ctx.fillStyle = C.white;
        ctx.fillText(site, x, 104);
    }
    ctx.font = font(500, 30);
    wrap(ctx, title, width - x - pad, 2).forEach((line, i) => {
        if (draw) {
            ctx.fillStyle = C.gold;
            ctx.fillText(line, x, 152 + i * 38);
        }
    });
    return height;
}

// The bottom of result pictures: call to action, contacts and the disclaimer, from y.
// Returns the picture's full height.
export function paintContacts(ctx, draw, y, T, { width = 1080, pad = 64 } = {}) {
    const inner = width - 2 * pad;
    y += 56;
    if (draw) {
        ctx.fillStyle = C.line;
        ctx.fillRect(pad, y, inner, 2);
    }
    ctx.font = font(700, 36);
    wrap(ctx, T.contact, inner, 2).forEach((line, i) => {
        y += i ? 46 : 64;
        if (draw) {
            ctx.fillStyle = C.navy;
            ctx.fillText(line, pad, y);
        }
    });
    ctx.font = font(500, 28);
    const contacts = [
        [T.telegram && `Telegram: @${T.telegram}`, T.instagram && `Instagram: @${T.instagram}`],
        [T.email, T.url],
    ].map((parts) => parts.filter(Boolean).join('   ·   ')).filter(Boolean);
    contacts.forEach((line) => {
        y += 46;
        if (draw) {
            ctx.fillStyle = C.ink;
            ctx.fillText(line, pad, y);
        }
    });
    y += 26;
    ctx.font = font(400, 22);
    wrap(ctx, T.disclaimer, inner, 3).forEach((line) => {
        y += 32;
        if (draw) {
            ctx.fillStyle = C.muted;
            ctx.fillText(line, pad, y);
        }
    });
    return y + pad;
}

// "Share" sends a picture straight to apps (Telegram etc.) where the browser can share files.
export function shareButton(button, makeBlob, fileName, { title, url }) {
    const probe = new File([new Blob()], 'probe.png', { type: 'image/png' });
    if (!navigator.canShare || !navigator.canShare({ files: [probe] })) return;
    button.hidden = false;
    button.addEventListener('click', async () => {
        const file = new File([await makeBlob()], fileName(), { type: 'image/png' });
        try {
            await navigator.share({ files: [file], title, text: `${title} — ${url}` });
        } catch {
            // Sharing cancelled.
        }
    });
}

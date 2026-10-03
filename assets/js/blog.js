(function () {
    'use strict';

    const input = document.getElementById('search-input');
    const list = document.getElementById('post-list');

    // Case-insensitive title matching that also treats the apostrophe variants
    // used in Uzbek Latin (o‘, g‘) as equal, and Russian ё as е.
    function normalize(text) {
        return (text || '')
            .toLocaleLowerCase()
            .replace(/[‘’ʻʼ`´]/g, "'")
            .replace(/ё/g, 'е')
            .trim();
    }

    if (list) {
        initListFilter();
    } else if (input) {
        initSearchDropdown();
    }
    initBackLinks();
    initReactions();
    initTelegramComments();

    // Pages with an article list (home, category pages): the search box and,
    // on the home page, the category buttons filter the list in place.
    function initListFilter() {
        const entries = Array.from(list.querySelectorAll('.post-entry')).map((el) => ({
            el,
            title: normalize(el.dataset.title),
            categories: JSON.parse(el.dataset.categories || '[]'),
        }));
        const empty = document.getElementById('post-list-empty');
        const buttons = Array.from(document.querySelectorAll('.category-bar .cat-btn'));
        const filterable = list.hasAttribute('data-filterable');
        let category = '';

        function setCategory(value) {
            category = buttons.some((b) => b.dataset.category === value) ? value : '';
            for (const btn of buttons) {
                const active = btn.dataset.category === category;
                btn.classList.toggle('active', active);
                if (active) btn.setAttribute('aria-current', 'true');
                else btn.removeAttribute('aria-current');
            }
        }

        function apply() {
            const query = normalize(input.value);
            let shown = 0;
            for (const entry of entries) {
                const visible = (!query || entry.title.includes(query)) &&
                    (!category || entry.categories.includes(category));
                entry.el.hidden = !visible;
                if (visible) shown++;
            }
            empty.hidden = shown > 0;

            // Keep the filters in the URL so reloading, sharing, or returning
            // from an article restores the same view.
            if (filterable) {
                const url = new URL(location.href);
                if (category) url.searchParams.set('category', category);
                else url.searchParams.delete('category');
                if (input.value.trim()) url.searchParams.set('q', input.value.trim());
                else url.searchParams.delete('q');
                history.replaceState(history.state, '', url);
            }
        }

        if (filterable) {
            const params = new URLSearchParams(location.search);
            input.value = params.get('q') || '';
            setCategory(params.get('category') || '');

            // Category buttons and the category labels on each article.
            document.addEventListener('click', (e) => {
                const link = e.target.closest('.cat-btn, .entry-cat');
                if (!link || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
                e.preventDefault();
                const value = link.dataset.category;
                // Clicking the active category again goes back to "All".
                setCategory(value === category && link.classList.contains('cat-btn') ? '' : value);
                apply();
                if (link.classList.contains('entry-cat')) {
                    document.querySelector('.category-bar').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            });
        }

        input.addEventListener('input', apply);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                input.value = '';
                apply();
            }
        });
        if (input.value || category) apply();
    }

    // Other pages (articles): show matching titles in a dropdown under the box.
    function initSearchDropdown() {
        const results = document.getElementById('search-results');
        let index = null;
        let loading = null;

        function load() {
            if (!loading) {
                loading = fetch(input.dataset.index)
                    .then((r) => r.json())
                    .then((pages) => {
                        index = pages.map((p) => Object.assign({ key: normalize(p.title) }, p));
                    })
                    .catch(() => {
                        index = [];
                    });
            }
            return loading;
        }

        function close() {
            results.hidden = true;
        }

        async function render() {
            const query = normalize(input.value);
            if (!query) {
                results.replaceChildren();
                close();
                return;
            }
            await load();
            if (normalize(input.value) !== query) return; // a newer keystroke won

            const items = index.filter((p) => p.key.includes(query)).slice(0, 8).map((p) => {
                const li = document.createElement('li');
                const a = document.createElement('a');
                a.href = p.permalink;
                a.textContent = p.title;
                if (p.date) {
                    const date = document.createElement('span');
                    date.className = 'search-result-date';
                    date.textContent = p.date;
                    a.append(date);
                }
                li.append(a);
                return li;
            });
            if (!items.length) {
                const li = document.createElement('li');
                li.className = 'search-empty';
                li.textContent = input.dataset.noResults;
                items.push(li);
            }
            results.replaceChildren(...items);
            results.hidden = false;
        }

        input.addEventListener('focus', () => {
            load();
            if (input.value.trim()) render();
        });
        input.addEventListener('input', render);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                input.value = '';
                render();
                input.blur();
            } else if (e.key === 'Enter') {
                const first = results.querySelector('a');
                if (first) location.href = first.href;
            } else if (e.key === 'ArrowDown') {
                const first = results.querySelector('a');
                if (first) {
                    e.preventDefault();
                    first.focus();
                }
            }
        });
        results.addEventListener('keydown', (e) => {
            const links = Array.from(results.querySelectorAll('a'));
            const i = links.indexOf(document.activeElement);
            if (e.key === 'ArrowDown' && i < links.length - 1) {
                e.preventDefault();
                links[i + 1].focus();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                (i > 0 ? links[i - 1] : input).focus();
            } else if (e.key === 'Escape') {
                close();
                input.focus();
            }
        });
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.site-search')) close();
        });
    }

    // "Back" returns to the home page. When the visitor came from the home
    // page, go back in history instead so their filters and scroll are kept.
    function initBackLinks() {
        document.querySelectorAll('[data-back-link]').forEach((link) => {
            link.addEventListener('click', (e) => {
                if (!document.referrer || history.length < 2) return;
                const from = new URL(document.referrer);
                const home = new URL(link.href);
                if (from.origin === home.origin && from.pathname === home.pathname) {
                    e.preventDefault();
                    history.back();
                }
            });
        });
    }

    // Emoji reactions under an article. Counts live in the Cloudflare Worker
    // (worker/index.js); the box stays hidden if it can't be reached.
    function initReactions() {
        const box = document.querySelector('[data-reactions]');
        if (!box || !window.fetch) return;
        const api = '/api/reactions';
        const { path, key } = box.dataset;
        const visitor = visitorId();
        const buttons = Array.from(box.querySelectorAll('.reaction'));
        const pending = new Set();
        let state = { counts: {}, mine: [] };

        function render() {
            for (const button of buttons) {
                const reaction = button.dataset.reaction;
                const count = state.counts[reaction] || 0;
                button.querySelector('.reaction-count').textContent = count > 0 ? count : '';
                button.setAttribute('aria-pressed', String(state.mine.includes(reaction)));
            }
        }

        fetch(`${api}?key=${encodeURIComponent(key)}&visitor=${encodeURIComponent(visitor)}`)
            .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
            .then((data) => {
                state = data;
                render();
                box.hidden = false;
            })
            .catch(() => {});

        box.addEventListener('click', async (e) => {
            const button = e.target.closest('.reaction');
            if (!button) return;
            const reaction = button.dataset.reaction;
            if (pending.has(reaction)) return;
            const active = !state.mine.includes(reaction);

            // Show the change straight away; undo it if the request fails.
            const previous = state;
            const count = (state.counts[reaction] || 0) + (active ? 1 : -1);
            state = {
                counts: { ...state.counts, [reaction]: Math.max(count, 0) },
                mine: active ? [...state.mine, reaction] : state.mine.filter((r) => r !== reaction),
            };
            render();

            pending.add(reaction);
            try {
                const response = await fetch(api, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path, key, reaction, visitor, active }),
                });
                if (!response.ok) throw new Error(response.status);
                state = await response.json();
            } catch {
                state = previous;
            } finally {
                pending.delete(reaction);
                render();
            }
        });
    }

    // A random id remembered by this browser, so a reader can undo their own reactions.
    function visitorId() {
        const fresh = () => (crypto.randomUUID ? crypto.randomUUID()
            : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
                (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));
        try {
            let id = localStorage.getItem('kvp-visitor');
            if (!id) {
                id = fresh();
                localStorage.setItem('kvp-visitor', id);
            }
            return id;
        } catch {
            return fresh();
        }
    }

    // Comments from the article's Telegram channel post, via Telegram's
    // discussion widget. Reloaded when the light/dark theme changes, since
    // the widget picks its colours when it loads.
    function initTelegramComments() {
        const box = document.querySelector('[data-telegram-comments]');
        if (!box) return;

        function load() {
            const script = document.createElement('script');
            script.async = true;
            script.src = 'https://telegram.org/js/telegram-widget.js?22';
            script.dataset.telegramDiscussion = box.dataset.telegramComments;
            script.dataset.commentsLimit = box.dataset.commentsLimit || '10';
            script.dataset.colorful = '1';
            if (document.documentElement.dataset.theme === 'dark') script.dataset.dark = '1';
            box.replaceChildren(script);
        }

        load();
        new MutationObserver(load).observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme'],
        });
    }
})();

// Visa map: the reader enters nationality, age, their current visa (or none yet) and any
// details they like (family, education, Korean, work, money), then steps through the
// possible next visas until they reach permanent residence (F-5). The visa data
// (data/visamap.yaml) and translated texts are embedded in the page by
// layouts/visa-map.html. Everything runs in the browser.
import {
    C, NONE, byCode, clearableRadios, el, fillCountries, font, isGoal, loadImage, pageContext, paintBrand,
    paintContacts, renderPicture, roundRect, saveBlob, shareButton as offerShare, visaSearch, wrap,
} from './visa/shared.js';
import { setupReport } from './visa/report.js';
import { visaRules } from './visa/rules.js';

const mapRoot = document.getElementById('visa-map');
if (mapRoot) visaMap(mapRoot);

function visaMap(root) {
    const page = pageContext(root);
    const { T, visas, text, nameOf, codeLabel, countryName } = page;

    const form = document.getElementById('vm-start');
    const ageInput = document.getElementById('vm-age');
    const nationalityInput = document.getElementById('vm-nationality');
    const visaInput = document.getElementById('vm-visa');
    const optionList = document.getElementById('vm-visa-list');
    const parentField = document.getElementById('vm-parent-field');
    const eduExtras = document.getElementById('vm-edu-extras');
    const errorBox = document.getElementById('vm-error');
    const board = document.getElementById('vm-board');
    const profile = document.getElementById('vm-profile');
    const tree = document.getElementById('vm-tree');
    const links = document.getElementById('vm-links');
    const levels = document.getElementById('vm-levels');
    const done = document.getElementById('vm-done');
    const stepsList = document.getElementById('vm-steps');
    const downloadButton = document.getElementById('vm-download');
    const shareButton = document.getElementById('vm-share');

    let person = null; // nationality, age and the details the reader gave
    let path = []; // chosen visa codes; path[0] is the current visa or NONE
    const revealed = new Set(); // rows where options that don't fit the reader are shown
    // The steps the reader had chosen after a visa they then replaced or reopened, by the path up
    // to that visa ('NONE.E-7-1'), so picking it again brings them back.
    const tails = new Map();

    const rules = visaRules(page.data);

    // Possible next visas from path[level - 1], with notes in the page language.
    const nextSteps = (level) => rules.nextSteps(person, path, level).map((step) => ({ ...step, note: text(step.note) }));

    // Extra notes a visa has for the reader's nationality. Embassy rules (abroad) only show
    // on steps where the reader applies for the visa from abroad.
    const countryNotes = (code, fromAbroad) => ((visas[code] && visas[code].notes) || [])
        .filter((n) => rules.isIn(person, n.countries) && (!n.abroad || fromAbroad)).map((n) => text(n.text));

    // What to show about getting `to` as step `level` of the path (from path[level - 1]): the
    // move's own note or the visa's general note, the income it asks of this reader, and any
    // notes for the reader's nationality.
    function howTo(level, to) {
        const from = path[level - 1];
        const step = from ? nextSteps(level).find((s) => s.to === to) : null;
        const main = (step && step.note) || text(visas[to] && visas[to].how);
        const fromAbroad = from === NONE || Boolean(step && step.abroad);
        const income = step ? incomeLine(rules.incomeFor(person, path, level, step)) : '';
        return [main, income, ...countryNotes(to, fromAbroad)].filter(Boolean).join(' ');
    }

    // ---------- What fits the reader ----------

    // Why an option doesn't fit, by fact.
    const WHY = {
        spouse: 'whyFamily', koreanChild: 'whyFamily', parent: 'whyFamily', korean: 'koreansOnly',
        edu: 'whyEducation', koreanEdu: 'whyEducation', stem: 'whyEducation', rank: 'whyEducation',
        experience: 'whyExperience', invest: 'whyInvest', ageUnder: 'whyAge', countries: 'notForNationality',
        notAfter: 'whyPrevious', stay: 'whyStay',
    };

    // { topik: 3, kiip: 3, koreanEdu: 1 } in words: "TOPIK 3 / KIIP 3 / a Korean school or university diploma".
    const languageText = (want) => Object.entries(want)
        .map(([key, level]) => (key === 'koreanEdu' ? T.langSchool : `${key.toUpperCase()} ${level}`)).join(' / ');
    // Numbers as the page language writes them. Browsers' Uzbek (Latin) data writes a decimal
    // point; the texts write a comma, as Uzbek (Cyrillic) does.
    const numberTag = page.lang === 'uz' ? 'uz-Cyrl' : page.langTag;
    const number = (n, digits) => new Intl.NumberFormat(numberTag, { maximumFractionDigits: digits }).format(n);
    // Money in ₩ million ("₩104.8M"). A requirement is rounded up, so that an income equal to
    // the amount shown is always enough.
    const money = (amount) => T.money.replace('{n}', number(amount, 1));
    const need = (amount) => money(Math.ceil(amount * 10 - 1e-9) / 10);

    function reasonText(reason) {
        if (reason.key === 'ageOnly') return T.ageOnly.replace('{range}', reason.range);
        if (reason.key === 'why') return T[WHY[reason.fact]];
        return T[reason.key];
    }

    function tagText(tag) {
        switch (tag.key) {
            case 'matches': return `✓ ${T.matches}`;
            case 'langNeed': return `⏳ ${T.langNeed.replace('{req}', languageText(tag.language))}`;
            case 'laterAge': return `⏳ ${T.laterAge.replace('{n}', tag.age)}`;
            case 'laterExperience': return `⏳ ${T.laterExperience.replace('{n}', tag.years)}`;
            case 'laterIncome': return `⏳ ${T.laterIncome.replace('{amount}', need(tag.amount))}`;
            case 'laterOwnIncome': return `⏳ ${T.laterOwnIncome.replace('{amount}', need(tag.amount))}`;
            default: return T[tag.key];
        }
    }

    // The income a step asks of the reader, in words: the amount and the rule behind it, the
    // reduction that applies to them, and the ones that might.
    function incomeLine(income) {
        if (!income) return '';
        const rule = income.rule.gni !== undefined
            ? T.incomeGni.replace('{n}', number(income.multiple, 2)).replace('{year}', page.data.gni.year)
            : '';
        const lead = income.whose === 'household' && income.rule.ownHalf ? T.incomeHouseholdHalf
            : { own: T.incomeOwn, household: T.incomeHousehold, sponsor: T.incomeSponsor }[income.whose];
        const parts = [lead.replace('{amount}', need(income.base)).replace('{rule}', rule ? ` (${rule})` : '')];
        if (income.cut) {
            parts.push((income.amount ? T.incomeCut : T.incomeNone)
                .replace('{amount}', need(income.amount)).replace('{why}', text(income.cut.text)));
        }
        if (income.maybe.length) parts.push(T.incomeMaybe.replace('{why}', income.maybe.map((c) => text(c.text)).join('; ')));
        const assets = income.assets;
        if (assets) {
            if (assets.amount !== undefined) parts.push((assets.own ? T.assetsOwn : T.assetsHousehold).replace('{amount}', need(assets.amount)));
            else parts.push(assets.median ? T.assetsMedian : T.assetsAny);
        }
        if (income.result === 'yes' && income.amount > 0 && income.whose !== 'sponsor') parts.push(`✓ ${T.incomeOk}`);
        return parts.join(' ');
    }

    // Whether the reader can take a step: blocked with the reasons, or open with tags (in words).
    function assess(level, step) {
        const check = rules.assess(person, path, level, step);
        return {
            ...check,
            reasons: [...new Set(check.reasons.map(reasonText))],
            tags: check.tags.map((tag) => ({ text: tagText(tag), match: Boolean(tag.match), later: Boolean(tag.later) })),
        };
    }

    // ---------- Nationality list ----------

    fillCountries(nationalityInput, page);

    // ---------- Details ----------

    clearableRadios(form);

    // Parents only matter for readers under 19; school details need a school level.
    function syncDetails() {
        const age = Number.parseInt(ageInput.value, 10);
        parentField.hidden = !(age >= 14 && age < 19);
        const edu = form.elements.edu.value;
        eduExtras.disabled = edu === '' || Number(edu) < 1;
    }
    ageInput.addEventListener('input', syncDetails);
    form.elements.edu.addEventListener('change', syncDetails);
    syncDetails();

    function readDetails() {
        const f = form.elements;
        const choice = (name) => f[name].value || undefined;
        const level = (name) => (f[name].value === '' ? undefined : Number(f[name].value));
        const yes = (name) => (f[name].value === '' ? undefined : f[name].value === 'yes');
        // A number box: empty or outside the box's range is unknown (start() says so).
        const amount = (name) => {
            const value = Number.parseFloat(f[name].value);
            const max = Number(f[name].max) || Infinity;
            return Number.isFinite(value) && value >= 0 && value <= max ? value : undefined;
        };
        const details = {
            gender: choice('gender'),
            korean: yes('korean'),
            spouse: choice('spouse'),
            koreanChild: yes('koreanChild'),
            parent: choice('parent'),
            edu: level('edu'),
            topik: level('topik'),
            kiip: level('kiip'),
            experience: level('experience'),
            invest: level('invest'),
            income: amount('income'),
        };
        // Below high school, there is no school in Korea, field or ranking to ask about.
        if (details.edu !== undefined) {
            const extras = details.edu >= 1;
            const korean = level('koreanEdu');
            details.koreanEdu = extras ? (korean === undefined ? undefined : Math.min(korean, details.edu)) : 0;
            details.stem = extras ? yes('stem') : undefined;
            details.rank = extras ? level('rank') : undefined;
        }
        return details;
    }

    // ---------- Search box (current visa) ----------

    const search = visaSearch(page, {
        input: visaInput,
        list: optionList,
        codes: Object.keys(visas).filter((code) => !isGoal(code) && code !== NONE).sort(byCode),
        onPick: () => {
            errorBox.hidden = true;
        },
    });

    // ---------- Start ----------

    // Checks the form and draws the map from the current visa. Returns whether it started.
    function start() {
        const nationality = nationalityInput.value;
        const age = Number.parseInt(ageInput.value, 10);
        // An empty visa field means no Korean visa yet.
        const code = search.value();
        const incomeBox = form.elements.income;
        const income = Number.parseFloat(incomeBox.value);
        const badIncome = incomeBox.value !== '' && !(income >= 0 && income <= Number(incomeBox.max));
        const error = !nationality ? T.errNationality : !(age >= 14 && age <= 99) ? T.errAge
            : !code || !visas[code] ? T.errVisa : badIncome ? T.errIncome : '';
        if (error) {
            errorBox.textContent = error;
            errorBox.hidden = false;
            return false;
        }
        errorBox.hidden = true;
        person = { nationality, age, ...readDetails() };
        path = [code];
        revealed.clear();
        tails.clear();
        profile.textContent = profileLine(' · ');
        form.hidden = true;
        board.hidden = false;
        render();
        return true;
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (start()) board.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    document.getElementById('vm-restart').addEventListener('click', () => {
        path = [];
        history.replaceState(null, '', location.pathname + location.search);
        board.hidden = true;
        form.hidden = false;
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // The reader's answers in one line, as they chose them in the form.
    function profileLine(separator) {
        const f = form.elements;
        const answer = (select) => select.selectedOptions[0].textContent.trim();
        const parts = [`${T.nationality}: ${countryName(person.nationality)}`, `${T.age}: ${person.age}`];
        if (person.gender) parts.push(`${T.gender}: ${T[person.gender]}`);
        if (person.korean) parts.push(T.koreanRoots);
        if (person.spouse) parts.push(answer(f.spouse));
        if (person.koreanChild) parts.push(T.koreanChild);
        if (person.parent && person.age < 19) parts.push(answer(f.parent));
        if (person.edu !== undefined) {
            const extras = [person.koreanEdu > 0 && `${T.koreanEdu}: ${answer(f.koreanEdu)}`, person.stem && T.stem,
                person.rank !== undefined && answer(f.rank)].filter(Boolean);
            parts.push(`${T.education}: ${answer(f.edu)}${extras.length ? ` (${extras.join(', ')})` : ''}`);
        }
        if (person.topik !== undefined) parts.push(answer(f.topik));
        if (person.kiip !== undefined) parts.push(answer(f.kiip));
        if (person.experience !== undefined) parts.push(`${T.experience}: ${answer(f.experience)}`);
        if (person.invest !== undefined) parts.push(`${T.invest}: ${answer(f.invest)}`);
        if (person.income !== undefined) parts.push(`${T.income}: ${money(person.income)}`);
        return parts.join(separator);
    }

    // ---------- Map links ----------

    // The page address keeps the map: the answers and the path, so a shared or reported link
    // opens the same map.
    const RADIOS = ['gender', 'korean', 'koreanChild', 'stem'];
    const SELECTS = ['spouse', 'parent', 'edu', 'koreanEdu', 'rank', 'topik', 'kiip', 'experience', 'invest', 'income']; // and the income box

    function mapParams(leaveOut = []) {
        const f = form.elements;
        const params = new URLSearchParams({ nationality: person.nationality, age: person.age });
        RADIOS.filter((name) => !leaveOut.includes(name)).forEach((name) => f[name].value && params.set(name, f[name].value));
        SELECTS.forEach((name) => f[name].value !== '' && params.set(name, f[name].value));
        params.set('path', path.join('.'));
        return params;
    }

    const mapLink = (leaveOut) => `${location.origin}${location.pathname}#${mapParams(leaveOut)}`;
    const saveMap = () => history.replaceState(null, '', `#${mapParams()}`);

    // Opens the map from the page address, keeping only the steps that are still possible.
    function openMap() {
        const params = new URLSearchParams(location.hash.slice(1));
        // A visa the map no longer has ends the path there (dropping it would shift the steps after it).
        let codes = (params.get('path') || '').split('.').filter(Boolean);
        const unknown = codes.findIndex((code) => !visas[code]);
        if (unknown >= 0) codes = codes.slice(0, unknown);
        if (!codes.length) return;
        // Start from a clean form, so no answers from an earlier map stay.
        form.reset();
        form.querySelectorAll('.vm-segment input').forEach((input) => {
            input.dataset.checked = 'false';
        });
        revealed.clear();
        nationalityInput.value = params.get('nationality') || '';
        ageInput.value = params.get('age') || '';
        // Older links had checkboxes: eduKorea=1 (the highest level was in Korea) and stem=1.
        if (params.get('eduKorea') === '1' && !params.has('koreanEdu') && params.has('edu')) params.set('koreanEdu', params.get('edu'));
        if (params.get('stem') === '1') params.set('stem', 'yes');
        RADIOS.forEach((name) => {
            const input = form.querySelector(`input[name="${name}"][value="${CSS.escape(params.get(name) || '')}"]`);
            if (input) {
                input.checked = true;
                input.dataset.checked = 'true';
            }
        });
        SELECTS.forEach((name) => {
            if (params.has(name)) form.elements[name].value = params.get(name);
        });
        if ([...RADIOS, ...SELECTS].some((name) => params.has(name))) {
            document.getElementById('vm-details').open = true;
        }
        syncDetails();
        search.pick(codes[0]);
        if (!start()) return;
        follow(codes.slice(1));
        render();
    }

    // ---------- Tree ----------

    // Rows with many options (like "no visa yet") are grouped by purpose.
    const GROUP_AT = 12;
    const CATEGORIES = [
        ['study', /^D-[24]-/],
        ['work', /^(C-4|D-3|D-10|E-|H-)/],
        ['family', /^(F-1|F-2-(2|3|13|71|81|T1)$|F-3|F-4|F-6)/],
        ['business', /^(D-[789]|F-2-(5|8|12)$|F-5-(5|25)$)/],
        ['residence', /^F-2/],
        ['pr', /^F-5/],
        ['visit', /^[BC]-/],
        ['other', /^/],
    ];
    const categoryOf = (code) => CATEGORIES.find(([, pattern]) => pattern.test(code))[0];

    function render() {
        const rows = [{ level: 0, options: [{ to: path[0] }], selected: path[0] }];
        for (let level = 1; level <= path.length; level++) {
            const parent = path[level - 1];
            if (isGoal(parent)) break;
            const options = nextSteps(level).map((step) => ({ ...step, check: assess(level, step) }));
            rows.push({ level, options, selected: path[level] || null });
        }
        levels.replaceChildren(...rows.map(renderRow));

        const finished = isGoal(path[path.length - 1]);
        done.hidden = !finished;
        if (finished) fillDone();
        saveMap();
        requestAnimationFrame(drawLinks);
    }

    function renderRow(row) {
        const section = el('section', 'vm-level');
        section.dataset.level = row.level;
        // Options the reader can take now come before the ones they can only take later.
        const open = row.options.filter((o) => !o.check || (!o.check.blocked && !o.check.later))
            .concat(row.options.filter((o) => o.check && !o.check.blocked && o.check.later));
        const closed = row.options.filter((o) => o.check && o.check.blocked);
        if (row.level === 0) section.append(el('p', 'vm-caption', path[0] === NONE ? T.startNone : T.start));
        else if (!row.selected) {
            const caption = open.length ? T.choose : row.options.length ? T.noneFit : T.deadEnd;
            section.append(el('p', 'vm-caption is-open', caption));
        }
        const nodes = (options, extra) => {
            const box = el('div', extra ? `vm-nodes ${extra}` : 'vm-nodes');
            options.forEach((option) => box.append(renderNode(row, option)));
            return box;
        };
        if (open.length > GROUP_AT) {
            section.classList.add('is-large');
            CATEGORIES.forEach(([category]) => {
                const items = open.filter((o) => categoryOf(o.to) === category).sort((a, b) => byCode(a.to, b.to));
                if (!items.length) return;
                const group = el('div', 'vm-group');
                group.append(el('p', 'vm-group-title', T.categories[category]), nodes(items));
                section.append(group);
            });
        } else if (open.length) {
            section.append(nodes(open));
        }
        // Options that don't fit the reader's details stay hidden until asked for (open row only).
        if (closed.length && !row.selected) {
            const shown = revealed.has(row.level);
            const toggle = el('button', 'vm-more', (shown ? T.hideClosed : T.showClosed).replace('{n}', closed.length));
            toggle.type = 'button';
            toggle.dataset.level = row.level;
            toggle.setAttribute('aria-expanded', String(shown));
            section.append(toggle);
            if (shown) section.append(nodes(closed, 'vm-closed'));
        }
        return section;
    }

    function renderNode(row, option) {
        const code = option.to;
        const selected = row.selected === code;
        const node = el(row.level === 0 ? 'div' : 'button', 'vm-node');
        node.dataset.code = code;
        node.dataset.level = row.level;
        if (row.level === 0) node.classList.add('is-root');
        if (code === NONE) node.classList.add('is-none');
        if (isGoal(code)) node.classList.add('is-goal');
        if (selected) node.classList.add('on-path');
        else if (row.selected) node.classList.add('is-dim');

        node.append(el('span', 'vm-node-code', codeLabel(code)), el('span', 'vm-node-name', nameOf(code)));
        // Before a first visa: what the reader's nationality needs for any long-term visa.
        const before = code === NONE ? countryNotes(NONE, true).join(' ') : '';
        if (before) node.append(el('span', 'vm-node-how', before));
        if (row.level > 0) {
            const check = option.check;
            node.type = 'button';
            node.setAttribute('aria-pressed', String(selected));
            node.title = howTo(row.level, code);
            const tags = el('span', 'vm-node-tags');
            // From "no visa yet" every first visa is applied for abroad, so the plane would only add noise.
            if (option.abroad && path[row.level - 1] !== NONE) {
                const plane = el('span', 'vm-tag vm-tag-abroad', '✈');
                plane.title = T.abroad;
                tags.append(plane);
            }
            if (check.blocked) {
                node.disabled = true;
                node.classList.add('is-blocked');
                check.reasons.forEach((reason) => tags.append(el('span', 'vm-tag', reason)));
            } else {
                // Not yet: the reader can take this step after more time, work, Korean or income.
                if (check.later) node.classList.add('is-later');
                check.tags.forEach((tag) => tags.append(el('span',
                    tag.match ? 'vm-tag vm-tag-match' : tag.later ? 'vm-tag vm-tag-later' : 'vm-tag', tag.text)));
            }
            if (tags.childNodes.length) node.append(tags);
            if (selected) {
                const how = el('span', 'vm-node-how');
                how.append(el('b', '', `${T.how}: `), document.createTextNode(howTo(row.level, code)));
                const korean = languageNote(check);
                if (korean) how.append(el('span', 'vm-node-lang', korean));
                node.append(how);
            }
        }
        return node;
    }

    // A line about the reader's Korean level when the step needs one and we know their level.
    function languageNote(check) {
        if (check.korean === 'yes') return `✓ ${T.langOk.replace('{req}', languageText(check.language))}`;
        if (check.korean === 'later') return `⏳ ${T.langNeed.replace('{req}', languageText(check.language))}`;
        return '';
    }

    levels.addEventListener('click', (e) => {
        const more = e.target.closest('.vm-more');
        if (more) {
            const level = Number(more.dataset.level);
            if (!revealed.delete(level)) revealed.add(level);
            render();
            return;
        }
        const node = e.target.closest('button.vm-node');
        if (!node || node.disabled) return;
        const level = Number(node.dataset.level);
        const code = node.dataset.code;
        // Picking the already chosen visa again reopens the choices after it; picking another one
        // brings back the steps last chosen after that one. Either way the steps cut off are kept.
        const reopen = path[level] === code;
        const cut = reopen ? level + 1 : level;
        const key = path.slice(0, cut + 1).join('.');
        if (path.length > cut + 1) tails.set(key, path.slice(cut + 1));
        else if (path.length === cut + 1) tails.delete(key); // nothing was chosen after it
        path = reopen ? path.slice(0, level + 1) : path.slice(0, level).concat(code);
        if (!reopen) follow(tails.get(path.join('.')) || []);
        revealed.forEach((l) => l > level && revealed.delete(l));
        render();
        requestAnimationFrame(() => {
            const next = isGoal(code) ? done : levels.querySelector(`[data-level="${level + 1}"]`);
            if (next) next.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
    });

    // Adds the given visas to the path, step by step, as long as each is still possible.
    function follow(codes) {
        for (const code of codes) {
            const level = path.length;
            if (isGoal(path[level - 1])) break;
            const step = nextSteps(level).find((s) => s.to === code);
            if (!step || assess(level, step).blocked) break;
            path.push(code);
        }
    }

    // Desktop: curved lines from each chosen visa to the options below it (to the row
    // caption only in big grouped rows). Phones: a timeline, i.e. a line down the left
    // with ticks to the chosen visas and open options.
    const compactLayout = window.matchMedia('(max-width: 640px)');

    function drawLinks() {
        const box = tree.getBoundingClientRect();
        links.setAttribute('width', box.width);
        links.setAttribute('height', box.height);
        links.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
        const rows = Array.from(levels.querySelectorAll('.vm-level'));
        const lines = { 'is-dim': [], 'is-open': [], 'on-path': [] };
        const add = (kind, d) => lines[kind].push(`<path class="vm-link ${kind}" d="${d}"/>`);
        const rect = (node) => {
            const r = node.getBoundingClientRect();
            return { left: r.left - box.left, top: r.top - box.top, width: r.width, height: r.height };
        };

        if (compactLayout.matches) {
            const x = 12;
            const anchor = (r) => r.top + Math.min(24, r.height / 2);
            const chosen = rows.map((row, i) => row.querySelector(`.vm-node.on-path[data-code="${CSS.escape(path[i] || '')}"]`))
                .filter(Boolean).map(rect);
            if (chosen.length) {
                const ys = chosen.map(anchor);
                add('on-path', `M${x},${ys[0]} V${ys[ys.length - 1]}`);
                chosen.forEach((r, i) => add('on-path', `M${x},${ys[i]} H${r.left}`));
                const open = rows[path.length];
                if (open) {
                    const options = Array.from(open.querySelectorAll('.vm-node')).map(rect);
                    if (options.length) {
                        add('is-open', `M${x},${ys[ys.length - 1]} V${anchor(options[options.length - 1])}`);
                        options.forEach((r) => add('is-open', `M${x},${anchor(r)} H${r.left}`));
                    }
                }
            }
        } else {
            const curve = (p, x2, y2) => {
                const x1 = p.left + p.width / 2;
                const y1 = p.top + p.height;
                const mid = (y2 - y1) / 2;
                return `M${x1},${y1} C${x1},${y1 + mid} ${x2},${y2 - mid} ${x2},${y2}`;
            };
            for (let i = 1; i < rows.length; i++) {
                const parent = rows[i - 1].querySelector(`.vm-node[data-code="${CSS.escape(path[i - 1])}"]`);
                if (!parent) continue;
                const p = rect(parent);
                if (rows[i].classList.contains('is-large')) {
                    const target = rows[i].querySelector('.vm-node.on-path') || rows[i].querySelector('.vm-caption');
                    if (target) {
                        const t = rect(target);
                        add(target.classList.contains('on-path') ? 'on-path' : 'is-open', curve(p, t.left + t.width / 2, t.top));
                    }
                    continue;
                }
                rows[i].querySelectorAll('.vm-node').forEach((child) => {
                    const c = rect(child);
                    const kind = child.classList.contains('on-path') ? 'on-path'
                        : child.classList.contains('is-dim') || child.classList.contains('is-blocked') ? 'is-dim' : 'is-open';
                    add(kind, curve(p, c.left + c.width / 2, c.top));
                });
            }
        }
        // Green path last, so it is drawn on top.
        links.innerHTML = lines['is-dim'].join('') + lines['is-open'].join('') + lines['on-path'].join('');
    }

    if (window.ResizeObserver) new ResizeObserver(() => !board.hidden && drawLinks()).observe(tree);

    // ---------- Result ----------

    function fillDone() {
        stepsList.replaceChildren(...path.map((code, i) => {
            const li = el('li');
            li.append(el('b', '', codeLabel(code)), document.createTextNode(` — ${nameOf(code)}`));
            if (i > 0) li.append(el('span', 'vm-step-how', howTo(i, code)));
            return li;
        }));
    }

    // Lays out the image; draws only when `draw` is true. Returns the height used.
    function paint(ctx, draw, logo) {
        const W = 1080;
        const P = 64;
        const inner = W - 2 * P;
        const dotX = P + 48;
        const textX = P + 104;
        ctx.textBaseline = 'alphabetic';

        const headerH = paintBrand(ctx, draw, { logo, site: T.site, title: T.imageTitle });
        let y = headerH + 24;
        ctx.font = font(500, 28);
        const now = new Date();
        const date = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
        wrap(ctx, `${profileLine('   ·   ')}   ·   ${date}`, inner, 5).forEach((line) => {
            y += 40;
            if (draw) {
                ctx.fillStyle = C.muted;
                ctx.fillText(line, P, y);
            }
        });
        y += 44;

        path.forEach((code, i) => {
            const goal = isGoal(code);
            if (i > 0) {
                // Connector with the "how" note beside it.
                ctx.font = font(400, 26);
                const note = wrap(ctx, howTo(i, code), inner - (textX - P), 6);
                const gap = Math.max(70, note.length * 34 + 40);
                if (draw) {
                    ctx.strokeStyle = C.green;
                    ctx.lineWidth = 6;
                    ctx.beginPath();
                    ctx.moveTo(dotX, y);
                    ctx.lineTo(dotX, y + gap - 14);
                    ctx.stroke();
                    ctx.fillStyle = C.green;
                    ctx.beginPath();
                    ctx.moveTo(dotX - 14, y + gap - 18);
                    ctx.lineTo(dotX + 14, y + gap - 18);
                    ctx.lineTo(dotX, y + gap);
                    ctx.closePath();
                    ctx.fill();
                    ctx.fillStyle = C.muted;
                    const top = y + gap / 2 - (note.length * 34) / 2 + 24;
                    note.forEach((line, k) => ctx.fillText(line, textX, top + k * 34));
                }
                y += gap;
            }

            // Visa node.
            ctx.font = font(400, 28);
            const name = wrap(ctx, nameOf(code), inner - (textX - P) - 24, 2);
            const h = 40 + 48 + name.length * 36 + 20;
            if (draw) {
                roundRect(ctx, P, y, inner, h, 26);
                ctx.fillStyle = goal ? C.green : i === 0 ? C.white : C.greenSoft;
                ctx.fill();
                ctx.lineWidth = 4;
                ctx.strokeStyle = C.green;
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(dotX, y + h / 2, 30, 0, Math.PI * 2);
                ctx.fillStyle = goal ? C.white : C.green;
                ctx.fill();
                ctx.font = font(700, 28);
                ctx.textAlign = 'center';
                ctx.fillStyle = goal ? C.green : C.white;
                ctx.fillText(goal ? '★' : String(i + 1), dotX, y + h / 2 + 10);
                ctx.textAlign = 'left';

                ctx.font = font(700, 44);
                ctx.fillStyle = goal ? C.white : C.ink;
                ctx.fillText(codeLabel(code), textX, y + 40 + 38);
                ctx.font = font(400, 28);
                ctx.fillStyle = goal ? 'rgba(255,255,255,0.92)' : C.muted;
                name.forEach((line, k) => ctx.fillText(line, textX, y + 40 + 48 + 28 + k * 36));

                const tag = goal ? T.goal : i === 0 ? (code === NONE ? T.startNone : T.start) : '';
                if (tag) {
                    ctx.font = font(600, 24);
                    ctx.textAlign = 'right';
                    ctx.fillStyle = goal ? C.white : C.muted;
                    ctx.fillText(tag, P + inner - 28, y + 50);
                    ctx.textAlign = 'left';
                }
            }
            y += h;
        });

        // Footer: call to action and contacts.
        return paintContacts(ctx, draw, y, T);
    }

    async function makeImage() {
        const logo = await loadImage(root.dataset.logo);
        return renderPicture((c, draw) => paint(c, draw, logo));
    }

    const fileName = () => `visa-map-${path[0] === NONE ? 'no-visa' : path[0]}-to-${path[path.length - 1]}.png`;

    async function downloadImage() {
        saveBlob(await makeImage(), fileName());
    }

    downloadButton.addEventListener('click', downloadImage);

    offerShare(shareButton, makeImage, fileName, { title: T.imageTitle, url: T.url });

    // ---------- Problem reports ----------

    // Korean descent is information about ethnicity, which the Personal Information Protection
    // Act treats as sensitive, so problem reports leave it out: they describe and link the map
    // as if that question had not been answered.
    const SENSITIVE = ['korean'];
    function withoutSensitive(make) {
        const saved = person;
        person = { ...person };
        SENSITIVE.forEach((key) => {
            person[key] = undefined;
        });
        try {
            return make();
        } finally {
            person = saved;
        }
    }

    setupReport(page, () => withoutSensitive(() => {
        const last = path[path.length - 1];
        const row = lastRow();
        return {
            page: 'Visa map',
            link: mapLink(SENSITIVE),
            summary: [profileLine(' · '), `${T.reportPath}: ${path.map(codeLabel).join(' → ')}`],
            text: (message, sender) => withoutSensitive(() => reportText(message, sender)),
            fileTag: last,
            sections: [
                { heading: 'Answers', rows: [profileLine(' · ')] },
                {
                    heading: `Path (${path.length} steps)`,
                    rows: path.map((code, i) => ({ num: i + 1, strong: codeLabel(code), rest: nameOf(code), green: isGoal(code) })),
                },
                isGoal(last) ? { heading: 'Result', rows: [`Finished at ${last}.`] } : {
                    heading: `Options after ${codeLabel(last)}`,
                    rows: [
                        `Shown: ${row.filter((o) => !o.check.blocked).map((o) => `${o.step.to}${o.step.abroad ? ' (abroad)' : ''}`).join(', ') || 'none'}`,
                        { muted: true, text: `Hidden: ${row.filter((o) => o.check.blocked).map((o) => `${o.step.to} (${o.check.reasons.join('; ')})`).join(', ') || 'none'}` },
                    ],
                },
            ],
        };
    }));

    // The options after the last step, as the reader sees them (or none at the goal).
    function lastRow() {
        const level = path.length;
        const last = path[level - 1];
        if (isGoal(last)) return [];
        return nextSteps(level).map((step) => ({ step, check: assess(level, step) }));
    }

    // The map as plain text, for the admin or an AI assistant: enough to see and reproduce
    // what the reader saw (without the sensitive answers). Labels are English; names and notes
    // are in the page language.
    function reportText(message, sender) {
        const last = path[path.length - 1];
        const facts = Object.entries(person)
            .filter(([key, value]) => key !== 'nationality' && key !== 'age' && value !== undefined)
            .map(([key, value]) => `${key}=${value}`);
        const lines = [
            'VISA MAP BUG REPORT',
            `time: ${new Date().toISOString()}`,
            `page: ${location.origin}${location.pathname}`,
            `language: ${page.lang}`,
            `data: data/visamap.yaml, updated ${page.data.updated || '?'}`,
            `link: ${mapLink(SENSITIVE)}`,
            '',
            'message:',
            message,
            `name: ${sender.name || '(none)'}`,
            `contact: ${sender.contact || '(none)'}`,
            '',
            `profile: nationality=${person.nationality} (${countryName(person.nationality)}) age=${person.age}`,
            `details: ${facts.join(' ') || '(none)'}`,
            `left out (sensitive): ${SENSITIVE.join(', ')}`,
            `path: ${path.join(' > ')}`,
            'steps:',
            ...path.map((code, i) => (i === 0
                ? `  1. ${code} (${nameOf(code)}): start`
                : `  ${i + 1}. ${code} (${nameOf(code)}): ${howTo(i, code)}`)),
        ];
        if (isGoal(last)) {
            lines.push(`finished: yes, at ${last}`);
        } else {
            lines.push(`options after ${last} (row ${path.length + 1}):`);
            lastRow().forEach(({ step, check }) => {
                const marks = [step.abroad && 'abroad', ...check.tags.map((tag) => tag.text)].filter(Boolean);
                lines.push(`  ${check.blocked ? 'hidden' : 'shown '} ${step.to}${marks.length ? ` [${marks.join('; ')}]` : ''}`
                    + (check.blocked ? ` - ${check.reasons.join('; ')}` : ''));
            });
        }
        lines.push('', `browser: ${navigator.userAgent}`, `window: ${innerWidth}x${innerHeight} @${devicePixelRatio}x`);
        return lines.join('\n');
    }

    // A map link (from a report or a shared address) opens that map right away, also when
    // it's opened in a tab that already shows the page.
    if (location.hash.includes('path=')) openMap();
    window.addEventListener('hashchange', () => {
        if (location.hash.includes('path=')) openMap();
    });
}

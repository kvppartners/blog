// Visa map: the reader enters nationality, age, their current visa (or none yet) and any
// details they like (family, education, Korean, work, money), then steps through the
// possible next visas until they reach permanent residence (F-5). The visa data
// (data/visamap.yaml) and translated texts are embedded in the page by
// layouts/visa-map.html. Everything runs in the browser.
(function () {
    'use strict';

    const root = document.getElementById('visa-map');
    if (!root) return;

    const data = JSON.parse(document.getElementById('vm-data').textContent);
    const T = JSON.parse(document.getElementById('vm-i18n').textContent);
    const lang = root.dataset.lang;
    const visas = data.visas || {};
    const statuses = data.statuses || {};
    const groups = data.groups || {};

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

    // The starting point for readers who have no Korean visa yet.
    const NONE = 'NONE';

    let person = null; // nationality, age and the details the reader gave
    let path = []; // chosen visa codes; path[0] is the current visa or NONE
    let picked = null; // code chosen in the search box
    const revealed = new Set(); // rows where options that don't fit the reader are shown

    // ---------- Helpers ----------

    const langTag = lang === 'uz-cyrl' ? 'uz-Cyrl' : lang;

    // Picks the current language from { en, ru, uz, uz-cyrl } values.
    const text = (value) => (value && typeof value === 'object' ? value[lang] || value.en || '' : value || '');
    const isGoal = (code) => code.startsWith('F-5');
    const nameOf = (code) => text(visas[code] && visas[code].name);
    const codeLabel = (code) => (code === NONE ? T.noVisa : code);
    const statusOf = (code) => code.split('-').slice(0, 2).join('-');
    const tokens = (s) => String(s).toUpperCase().match(/[A-Z]+|\d+/g) || [];
    const fold = (s) => String(s).toLocaleLowerCase().replace(/[‘’ʻʼ`´']/g, "'").replace(/ё/g, 'е');
    const el = (tag, className, content) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (content !== undefined) node.textContent = content;
        return node;
    };

    // Natural order of visa codes: D-2-2 before D-2-10, D-10-1 after D-9-1.
    function byCode(a, b) {
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

    // Nationality lists: a group name from data.groups, or a list of ISO codes.
    const countryList = (value) => (typeof value === 'string' ? groups[value] || [] : value || []);
    const isIn = (value) => Boolean(person && countryList(value).includes(person.nationality));

    // Possible next visas from `code`. A visa held earlier on the path can be offered again
    // (a second D-10-1 after a new degree, E-7-1 again after a job search); a move's `again`
    // note then replaces its usual note. A move needs a new visa from abroad if marked so, or
    // only for some nationalities (abroadFor). A move can have its own requirements (needs,
    // lang) instead of the visa's.
    function nextSteps(code, level) {
        const visa = visas[code];
        if (!visa) return [];
        const earlier = path.slice(0, level);
        return (visa.next || [])
            .map((step) => (typeof step === 'string' ? { to: step } : step))
            .filter((step) => visas[step.to])
            .map((step) => ({
                to: step.to,
                note: text(earlier.includes(step.to) && step.again ? step.again : step.note),
                abroad: Boolean(step.abroad || visa.abroad || (step.abroadFor && isIn(step.abroadFor))),
                needs: step.needs,
                lang: step.lang,
            }));
    }

    // Extra notes a visa has for the reader's nationality. Embassy rules (abroad) only show
    // on steps where the reader applies for the visa from abroad.
    const countryNotes = (code, fromAbroad) => ((visas[code] && visas[code].notes) || [])
        .filter((n) => isIn(n.countries) && (!n.abroad || fromAbroad)).map((n) => text(n.text));

    // What to show about getting `to` as step `level` of the path (from path[level - 1]): the
    // move's own note or the visa's general note, plus any notes for the reader's nationality.
    function howTo(level, to) {
        const from = path[level - 1];
        const step = from ? nextSteps(from, level).find((s) => s.to === to) : null;
        const main = (step && step.note) || text(visas[to] && visas[to].how);
        const fromAbroad = from === NONE || Boolean(step && step.abroad);
        return [main, ...countryNotes(to, fromAbroad)].filter(Boolean).join(' ');
    }

    // ---------- What fits the reader ----------

    // Facts are what we know about the reader: their details, plus what the visas chosen so
    // far imply ("gives": a Korean degree after D-2-2, a Korean spouse on F-6-1). The reader's
    // own answers win over what a visa implies. Levels are numbers (education, experience,
    // investment, university ranking); a level implied by the path raises the reader's level,
    // or is a minimum when they left that field empty. An empty field is unknown and never
    // hides an option. Requirements can also name an age limit (ageUnder), nationalities
    // (countries) or visas that may not come right before this step (notAfter); the first two
    // are always known, the last one once the path has a visa before this step.
    const LEVELS = ['edu', 'koreanEdu', 'rank', 'experience', 'invest'];
    const FACTS = ['korean', 'spouse', 'koreanChild', 'parent', 'edu', 'rank', 'experience', 'invest'];
    // Facts that unlock options; meeting them marks the option as a match.
    const PERSONAL = ['korean', 'spouse', 'koreanChild', 'parent', 'invest', 'rank', 'stem', 'koreanEdu'];
    // Why an option doesn't fit, by fact.
    const WHY = {
        spouse: 'whyFamily', koreanChild: 'whyFamily', parent: 'whyFamily', korean: 'koreansOnly',
        edu: 'whyEducation', koreanEdu: 'whyEducation', stem: 'whyEducation', rank: 'whyEducation',
        experience: 'whyExperience', invest: 'whyInvest', ageUnder: 'whyAge', countries: 'notForNationality',
        notAfter: 'whyPrevious',
    };
    // A visa code matches a listed status or sub-status: 'D-4' matches D-4-1, 'E-1' doesn't match E-10.
    const isStatus = (code, list) => [].concat(list).some((s) => code === s || code.startsWith(`${s}-`));

    function profileFacts() {
        const known = {};
        FACTS.forEach((key) => {
            if (person[key] !== undefined) known[key] = person[key];
        });
        if (person.edu !== undefined) {
            known.koreanEdu = person.eduKorea ? person.edu : 0;
            known.stem = person.stem;
        }
        if (person.age >= 19) known.parent = 'none'; // parents' status matters for minors only
        return known;
    }

    function factsAt(level) {
        const known = profileFacts();
        const min = {};
        path.slice(0, level).forEach((code) => {
            Object.entries((visas[code] && visas[code].gives) || {}).forEach(([key, value]) => {
                if (!LEVELS.includes(key)) {
                    if (known[key] === undefined) known[key] = value;
                } else if (known[key] !== undefined) known[key] = Math.max(known[key], value);
                else min[key] = Math.max(min[key] === undefined ? value : min[key], value);
            });
        });
        // The visa held before the one this step leaves from (unknown for the current visa).
        return { known, min, previous: level >= 2 ? path[level - 2] : undefined };
    }

    // Each check is 'yes', 'no' or 'maybe' (not enough known).
    function checkFact(facts, key, want) {
        if (key === 'ageUnder') return person.age < want ? 'yes' : 'no';
        if (key === 'countries') return isIn(want) ? 'yes' : 'no';
        if (key === 'notAfter') return facts.previous === undefined ? 'maybe' : isStatus(facts.previous, want) ? 'no' : 'yes';
        const have = facts.known[key];
        if (LEVELS.includes(key)) {
            if (have !== undefined) return have >= want ? 'yes' : 'no';
            return facts.min[key] >= want ? 'yes' : 'maybe';
        }
        if (have === undefined) return 'maybe';
        return [].concat(want).includes(have) ? 'yes' : 'no';
    }

    // Requirements: { fact: value, ... } where all must hold, or a list of those where any
    // one is enough. Returns the result and the facts behind it.
    function checkNeeds(needs, facts) {
        if (!needs) return { result: 'yes', keys: [] };
        const options = [].concat(needs).map((group) => {
            const checks = Object.entries(group).map(([key, want]) => ({ key, result: checkFact(facts, key, want) }));
            const count = (result) => checks.filter((c) => c.result === result).length;
            return { checks, result: count('no') ? 'no' : count('maybe') ? 'maybe' : 'yes', misses: count('no') };
        });
        const best = options.find((o) => o.result === 'yes') || options.find((o) => o.result === 'maybe')
            || options.reduce((a, b) => (b.misses < a.misses ? b : a));
        const wanted = best.result === 'yes' ? 'yes' : best.result === 'no' ? 'no' : 'maybe';
        return { result: best.result, keys: best.checks.filter((c) => c.result === wanted).map((c) => c.key) };
    }

    // Korean level: { topik: 3, kiip: 3 } means TOPIK 3 or KIIP level 3 is enough.
    function checkLanguage(want) {
        if (!want) return null;
        const results = Object.entries(want)
            .map(([key, level]) => (person[key] === undefined ? 'maybe' : person[key] >= level ? 'yes' : 'no'));
        return results.includes('yes') ? 'yes' : results.includes('maybe') ? 'maybe' : 'no';
    }

    const languageText = (want) => Object.entries(want).map(([key, level]) => `${key.toUpperCase()} ${level}`).join(' / ');

    // Whether the reader can take a step: blocked with the reasons, or open with tags.
    function assess(level, step) {
        const visa = visas[step.to] || {};
        const reasons = [];
        const tags = [];
        const age = (visa.ageByCountry && visa.ageByCountry[person.nationality]) || visa.age;
        if (age) {
            const [min, max] = age;
            if (person.age < min || (max && person.age > max)) {
                reasons.push(T.ageOnly.replace('{range}', max ? `${min}–${max}` : `${min}+`));
            }
        }
        if (visa.countries && !isIn(visa.countries)) reasons.push(T.notForNationality);

        const want = step.needs || visa.needs;
        const needs = checkNeeds(want, factsAt(level));
        // A match: the reader's own answers (not just the path) unlock this option.
        const own = checkNeeds(want, { known: profileFacts(), min: {} });
        if (needs.result === 'no') needs.keys.forEach((key) => reasons.push(T[WHY[key]]));
        else if (needs.result === 'maybe' && needs.keys.includes('korean')) tags.push({ text: T.koreansOnly });
        else if (own.result === 'yes' && own.keys.some((key) => PERSONAL.includes(key))) {
            tags.push({ text: `✓ ${T.matches}`, match: true });
        }

        const language = step.lang || visa.lang;
        const korean = checkLanguage(language);
        if (korean === 'no') tags.push({ text: T.langNeed.replace('{req}', languageText(language)) });
        return { blocked: reasons.length > 0, reasons: [...new Set(reasons)], tags, korean, language };
    }

    // ---------- Nationality list ----------

    // Names in the page language come from data/countries.yaml, since many
    // browsers have no Uzbek country names.
    const countries = data.countries || {};
    const countryName = (code) => countries[code] || code;

    const first = ['UZ'];
    first.forEach((code) => nationalityInput.add(new Option(countryName(code), code)));
    const divider = new Option('──────────', '');
    divider.disabled = true;
    nationalityInput.add(divider);
    Object.keys(countries).filter((code) => !first.includes(code))
        .sort((a, b) => countryName(a).localeCompare(countryName(b), langTag))
        .forEach((code) => nationalityInput.add(new Option(countryName(code), code)));

    // ---------- Details ----------

    // Yes/no buttons can be clicked again to clear the answer.
    form.querySelectorAll('.vm-segment input[type="radio"]').forEach((input) => {
        input.addEventListener('click', () => {
            if (input.dataset.checked === 'true') input.checked = false;
            form.querySelectorAll(`input[name="${input.name}"]`).forEach((r) => {
                r.dataset.checked = String(r.checked);
            });
        });
    });

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
        };
        if (details.edu !== undefined) {
            const extras = details.edu >= 1;
            details.eduKorea = extras && f.eduKorea.checked;
            details.stem = extras && f.stem.checked;
            details.rank = extras ? level('rank') : undefined;
        }
        return details;
    }

    // ---------- Search box (current visa) ----------

    const startCodes = Object.keys(visas).filter((c) => !isGoal(c) && c !== NONE).sort(byCode);
    let active = -1;

    function search(query) {
        const q = query.trim();
        if (!q) return visas[NONE] ? [NONE] : [];
        const qt = tokens(q);
        const qf = fold(q);
        const hits = [];
        if (visas[NONE] && qf.length >= 2 && fold(`${T.noVisa} ${nameOf(NONE)}`).includes(qf)) hits.push({ code: NONE, score: -1 });
        for (const code of startCodes) {
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
        if (fold(value.trim()) === fold(T.noVisa)) return NONE;
        const vt = tokens(value).join('-');
        return startCodes.find((c) => tokens(c).join('-') === vt) || null;
    }

    function showOptions() {
        const hits = search(visaInput.value);
        active = -1;
        optionList.replaceChildren();
        if (!hits.length) {
            const goal = tokens(visaInput.value).slice(0, 2).join('-') === 'F-5';
            optionList.append(el('li', 'vm-option-empty', goal ? T.isGoal : T.noMatch));
        }
        hits.forEach((code, i) => {
            const li = el('li', code === NONE ? 'vm-option vm-option-none' : 'vm-option');
            li.id = `vm-opt-${i}`;
            li.setAttribute('role', 'option');
            li.dataset.code = code;
            li.append(el('b', '', codeLabel(code)), el('span', '', nameOf(code)));
            optionList.append(li);
        });
        optionList.hidden = false;
        visaInput.setAttribute('aria-expanded', 'true');
    }

    function closeOptions() {
        optionList.hidden = true;
        visaInput.setAttribute('aria-expanded', 'false');
        visaInput.removeAttribute('aria-activedescendant');
    }

    function pick(code) {
        picked = code;
        visaInput.value = code === NONE ? T.noVisa : `${code} — ${nameOf(code)}`;
        closeOptions();
        errorBox.hidden = true;
    }

    function highlight(index) {
        const items = optionList.querySelectorAll('.vm-option');
        if (!items.length) return;
        active = (index + items.length) % items.length;
        items.forEach((item, i) => item.classList.toggle('is-active', i === active));
        items[active].scrollIntoView({ block: 'nearest' });
        visaInput.setAttribute('aria-activedescendant', items[active].id);
    }

    visaInput.addEventListener('input', () => {
        picked = null;
        showOptions();
    });
    visaInput.addEventListener('focus', () => {
        if (!picked) showOptions();
    });
    visaInput.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (optionList.hidden) showOptions();
            highlight(active + (e.key === 'ArrowDown' ? 1 : -1));
        } else if (e.key === 'Enter' && !optionList.hidden && active >= 0) {
            e.preventDefault();
            pick(optionList.querySelectorAll('.vm-option')[active].dataset.code);
        } else if (e.key === 'Escape') {
            closeOptions();
        }
    });
    optionList.addEventListener('mousedown', (e) => e.preventDefault()); // keep focus in the input
    optionList.addEventListener('click', (e) => {
        const option = e.target.closest('.vm-option');
        if (option) pick(option.dataset.code);
    });
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.vm-combo')) closeOptions();
    });

    // ---------- Start ----------

    // Checks the form and draws the map from the current visa. Returns whether it started.
    function start() {
        const nationality = nationalityInput.value;
        const age = Number.parseInt(ageInput.value, 10);
        const typed = visaInput.value.trim();
        // An empty visa field means no Korean visa yet.
        const code = picked || (typed ? exactCode(typed) : NONE);
        const error = !nationality ? T.errNationality : !(age >= 14 && age <= 99) ? T.errAge
            : !code || !visas[code] ? T.errVisa : '';
        if (error) {
            errorBox.textContent = error;
            errorBox.hidden = false;
            return false;
        }
        errorBox.hidden = true;
        person = { nationality, age, ...readDetails() };
        path = [code];
        revealed.clear();
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
            const extras = [person.eduKorea && T.eduKorea, person.stem && T.stem,
                person.rank !== undefined && answer(f.rank)].filter(Boolean);
            parts.push(`${T.education}: ${answer(f.edu)}${extras.length ? ` (${extras.join(', ')})` : ''}`);
        }
        if (person.topik !== undefined) parts.push(answer(f.topik));
        if (person.kiip !== undefined) parts.push(answer(f.kiip));
        if (person.experience !== undefined) parts.push(`${T.experience}: ${answer(f.experience)}`);
        if (person.invest !== undefined) parts.push(`${T.invest}: ${answer(f.invest)}`);
        return parts.join(separator);
    }

    // ---------- Map links ----------

    // The page address keeps the map: the answers and the path, so a shared or reported link
    // opens the same map.
    const RADIOS = ['gender', 'korean', 'koreanChild'];
    const SELECTS = ['spouse', 'parent', 'edu', 'rank', 'topik', 'kiip', 'experience', 'invest'];
    const CHECKS = ['eduKorea', 'stem'];

    function mapParams() {
        const f = form.elements;
        const params = new URLSearchParams({ nationality: person.nationality, age: person.age });
        RADIOS.forEach((name) => f[name].value && params.set(name, f[name].value));
        SELECTS.forEach((name) => f[name].value !== '' && params.set(name, f[name].value));
        CHECKS.forEach((name) => f[name].checked && params.set(name, '1'));
        params.set('path', path.join('.'));
        return params;
    }

    const mapLink = () => `${location.origin}${location.pathname}#${mapParams()}`;
    const saveMap = () => history.replaceState(null, '', `#${mapParams()}`);

    // Opens the map from the page address, keeping only the steps that are still possible.
    function openMap() {
        const params = new URLSearchParams(location.hash.slice(1));
        const codes = (params.get('path') || '').split('.').filter((code) => visas[code]);
        if (!codes.length) return;
        // Start from a clean form, so no answers from an earlier map stay.
        form.reset();
        form.querySelectorAll('.vm-segment input').forEach((input) => {
            input.dataset.checked = 'false';
        });
        revealed.clear();
        nationalityInput.value = params.get('nationality') || '';
        ageInput.value = params.get('age') || '';
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
        CHECKS.forEach((name) => {
            form.elements[name].checked = params.get(name) === '1';
        });
        if ([...RADIOS, ...SELECTS, ...CHECKS].some((name) => params.has(name))) {
            document.getElementById('vm-details').open = true;
        }
        syncDetails();
        pick(codes[0]);
        if (!start()) return;
        for (let level = 1; level < codes.length && !isGoal(path[level - 1]); level++) {
            const step = nextSteps(path[level - 1], level).find((s) => s.to === codes[level]);
            if (!step || assess(level, step).blocked) break;
            path.push(codes[level]);
        }
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
            const options = nextSteps(parent, level).map((step) => ({ ...step, check: assess(level, step) }));
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
        const open = row.options.filter((o) => !o.check || !o.check.blocked);
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
            if (option.abroad) {
                const plane = el('span', 'vm-tag vm-tag-abroad', '✈');
                plane.title = T.abroad;
                tags.append(plane);
            }
            if (check.blocked) {
                node.disabled = true;
                node.classList.add('is-blocked');
                check.reasons.forEach((reason) => tags.append(el('span', 'vm-tag', reason)));
            } else {
                check.tags.forEach((tag) => tags.append(el('span', tag.match ? 'vm-tag vm-tag-match' : 'vm-tag', tag.text)));
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
        if (check.korean === 'no') return T.langNeed.replace('{req}', languageText(check.language));
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
        // Picking the already chosen visa again reopens the choices after it.
        path = path[level] === code ? path.slice(0, level + 1) : path.slice(0, level).concat(code);
        revealed.forEach((l) => l > level && revealed.delete(l));
        render();
        requestAnimationFrame(() => {
            const next = isGoal(code) ? done : levels.querySelector(`[data-level="${level + 1}"]`);
            if (next) next.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
    });

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

    const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Ubuntu, "Noto Sans", Arial, sans-serif';
    const C = {
        navy: '#1e2e4f', gold: '#e8c27a', green: '#16a34a', greenSoft: '#eaf7ef',
        ink: '#1f2937', muted: '#6b7280', line: '#e5e7eb', white: '#ffffff',
    };
    const font = (weight, size) => `${weight} ${size}px ${FONT}`;

    function wrap(ctx, value, maxWidth, maxLines) {
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

    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    // Lays out the image; draws only when `draw` is true. Returns the height used.
    function paint(ctx, draw, logo) {
        const W = 1080;
        const P = 64;
        const inner = W - 2 * P;
        const dotX = P + 48;
        const textX = P + 104;
        ctx.textBaseline = 'alphabetic';

        // Header band: logo, site name, title.
        const headerH = 220;
        if (draw) {
            ctx.fillStyle = C.navy;
            ctx.fillRect(0, 0, W, headerH);
            if (logo) ctx.drawImage(logo, P, (headerH - 132) / 2, 132, 132);
        }
        const tx = P + 132 + 32;
        ctx.font = font(700, 50);
        if (draw) {
            ctx.fillStyle = C.white;
            ctx.fillText(T.site, tx, 104);
        }
        ctx.font = font(500, 30);
        wrap(ctx, T.imageTitle, W - tx - P, 2).forEach((line, i) => {
            if (draw) {
                ctx.fillStyle = C.gold;
                ctx.fillText(line, tx, 152 + i * 38);
            }
        });

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
        y += 56;
        if (draw) {
            ctx.fillStyle = C.line;
            ctx.fillRect(P, y, inner, 2);
        }
        ctx.font = font(700, 36);
        wrap(ctx, T.consult, inner, 2).forEach((line, i) => {
            y += i ? 46 : 64;
            if (draw) {
                ctx.fillStyle = C.navy;
                ctx.fillText(line, P, y);
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
                ctx.fillText(line, P, y);
            }
        });
        y += 26;
        ctx.font = font(400, 22);
        wrap(ctx, T.disclaimer, inner, 3).forEach((line) => {
            y += 32;
            if (draw) {
                ctx.fillStyle = C.muted;
                ctx.fillText(line, P, y);
            }
        });
        return y + P;
    }

    function loadImage(src) {
        return new Promise((resolve) => {
            if (!src) return resolve(null);
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = src;
        });
    }

    async function makeImage() {
        const logo = await loadImage(root.dataset.logo);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 1080;
        canvas.height = Math.ceil(paint(ctx, false, logo));
        const draw = canvas.getContext('2d');
        draw.fillStyle = C.white;
        draw.fillRect(0, 0, canvas.width, canvas.height);
        paint(draw, true, logo);
        return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    }

    const fileName = () => `visa-map-${path[0] === NONE ? 'no-visa' : path[0]}-to-${path[path.length - 1]}.png`;

    function saveBlob(blob, name) {
        const url = URL.createObjectURL(blob);
        const a = el('a');
        a.href = url;
        a.download = name;
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    }

    async function downloadImage() {
        saveBlob(await makeImage(), fileName());
    }

    downloadButton.addEventListener('click', downloadImage);

    // Share the image straight to apps (Telegram etc.) where the browser supports it.
    const probe = new File([new Blob()], 'probe.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [probe] })) {
        shareButton.hidden = false;
        shareButton.addEventListener('click', async () => {
            const blob = await makeImage();
            const file = new File([blob], fileName(), { type: 'image/png' });
            try {
                await navigator.share({ files: [file], title: T.imageTitle, text: `${T.imageTitle} — ${T.url}` });
            } catch {
                // Sharing cancelled.
            }
        });
    }

    // ---------- Problem reports ----------

    // The reader describes the problem; the page sends it to /api/report (worker/index.js),
    // whose Telegram bot passes it to the admin with a bug-report picture and the map as
    // text. Without a picture the text still goes; if sending fails, a Telegram link with
    // the same text is offered instead.
    const report = document.getElementById('vm-report');
    if (report) {
        const reportForm = document.getElementById('vm-report-form');
        const status = document.getElementById('vm-report-status');
        const sendButton = document.getElementById('vm-report-send');
        const telegram = document.getElementById('vm-report-telegram');
        const download = document.getElementById('vm-report-download');
        const say = (message) => {
            status.textContent = message;
        };

        root.querySelectorAll('[data-report]').forEach((button) => button.addEventListener('click', () => {
            say('');
            sendButton.hidden = false;
            sendButton.disabled = false;
            telegram.hidden = true;
            download.hidden = true;
            reportForm.elements.message.readOnly = false;
            report.showModal();
            reportForm.elements.message.focus();
        }));

        reportForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const message = reportForm.elements.message.value.trim();
            // Optional, so the admin knows who wrote and can answer.
            const sender = { name: reportForm.elements.name.value.trim(), contact: reportForm.elements.contact.value.trim() };
            if (!message) {
                say(T.reportEmpty);
                reportForm.elements.message.focus();
                return;
            }
            sendButton.disabled = true;
            say(T.reportSending);
            const body = new FormData();
            body.append('message', message);
            body.append('name', sender.name);
            body.append('contact', sender.contact);
            body.append('details', reportText(message, sender));
            body.append('link', mapLink());
            body.append('lang', lang);
            const picture = await makeReportImage(message, sender).catch(() => null);
            if (picture) body.append('picture', picture, 'visa-map-report.png');
            let response = null;
            try {
                response = await fetch('/api/report', { method: 'POST', body });
            } catch {
                // Offline or blocked: offer Telegram below.
            }
            if (response && response.ok) {
                say(T.reportSent);
                sendButton.hidden = true;
                reportForm.elements.message.readOnly = true;
                return;
            }
            sendButton.disabled = false;
            if (response && response.status === 429) {
                say(T.reportBusy);
                return;
            }
            say(T.reportFailed);
            const text = [T.reportMsg, profileLine(' · '), `${T.reportPath}: ${path.map(codeLabel).join(' → ')}`,
                `${T.reportMap}: ${mapLink()}`, '', T.reportProblem, message].join('\n');
            telegram.href = `https://t.me/${T.telegramAdmin}?text=${encodeURIComponent(text)}`;
            telegram.hidden = false;
            download.hidden = !picture;
        });

        download.addEventListener('click', async () => {
            const form = reportForm.elements;
            const sender = { name: form.name.value.trim(), contact: form.contact.value.trim() };
            const blob = await makeReportImage(form.message.value.trim(), sender);
            saveBlob(blob, `visa-map-report-${path[path.length - 1]}.png`);
        });
        telegram.addEventListener('click', () => report.close());
        document.getElementById('vm-report-close').addEventListener('click', () => report.close());
        // A click on the dimmed area around the dialog closes it.
        report.addEventListener('click', (e) => {
            const box = report.getBoundingClientRect();
            if (e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom) report.close();
        });
    }

    // The options after the last step, as the reader sees them (or none at the goal).
    function lastRow() {
        const level = path.length;
        const last = path[level - 1];
        if (isGoal(last)) return [];
        return nextSteps(last, level).map((step) => ({ step, check: assess(level, step) }));
    }

    // The map as plain text, for the admin or an AI assistant: enough to see and reproduce
    // exactly what the reader saw. Labels are English; names and notes are in the page language.
    function reportText(message, sender) {
        const last = path[path.length - 1];
        const facts = Object.entries(person)
            .filter(([key, value]) => key !== 'nationality' && key !== 'age' && value !== undefined)
            .map(([key, value]) => `${key}=${value}`);
        const lines = [
            'VISA MAP BUG REPORT',
            `time: ${new Date().toISOString()}`,
            `page: ${location.origin}${location.pathname}`,
            `language: ${lang}`,
            `data: data/visamap.yaml, updated ${data.updated || '?'}`,
            `link: ${mapLink()}`,
            '',
            'message:',
            message,
            `name: ${sender.name || '(none)'}`,
            `contact: ${sender.contact || '(none)'}`,
            '',
            `profile: nationality=${person.nationality} (${countryName(person.nationality)}) age=${person.age}`,
            `details: ${facts.join(' ') || '(none)'}`,
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

    // Wraps text that may have no spaces (links) at any character.
    function wrapAnywhere(ctx, value, maxWidth) {
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

    // A picture for the admin, not a plan for the reader: a red BUG REPORT band, the reader's
    // message, answers, path and the options after the last step, and the map link.
    const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "DejaVu Sans Mono", monospace';
    const R = { red: '#b42318', redSoft: '#fef3f2', redLine: '#fecdca' };

    function paintReport(ctx, draw, message, sender) {
        const W = 1080;
        const P = 56;
        const inner = W - 2 * P;
        const stamp = `${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`;
        ctx.textBaseline = 'alphabetic';
        const text = (value, x, y, style, color) => {
            ctx.font = style;
            if (draw) {
                ctx.fillStyle = color;
                ctx.fillText(value, x, y);
            }
        };

        // Red band with a warning mark.
        const bandH = 150;
        if (draw) {
            ctx.fillStyle = R.red;
            ctx.fillRect(0, 0, W, bandH);
            ctx.beginPath();
            ctx.arc(P + 42, bandH / 2, 42, 0, Math.PI * 2);
            ctx.fillStyle = C.white;
            ctx.fill();
        }
        ctx.textAlign = 'center';
        text('!', P + 42, bandH / 2 + 21, font(800, 60), R.red);
        ctx.textAlign = 'left';
        text('BUG REPORT', P + 112, 76, font(800, 48), C.white);
        text(`${T.site} · Visa map · ${lang} · ${stamp}`, P + 112, 114, font(500, 24), 'rgba(255,255,255,0.88)');

        let y = bandH;
        const heading = (title) => {
            y += 52;
            text(title.toUpperCase(), P, y, font(800, 22), R.red);
            y += 8;
        };
        const paragraph = (value, size, color, maxLines, family = FONT, weight = 400) => {
            ctx.font = `${weight} ${size}px ${family}`;
            const lines = family === MONO ? wrapAnywhere(ctx, value, inner) : wrap(ctx, value, inner, maxLines);
            lines.forEach((line) => {
                y += Math.round(size * 1.45);
                text(line, P, y, `${weight} ${size}px ${family}`, color);
            });
        };

        // The reader's message, in a tinted box.
        heading('Message from the user');
        ctx.font = font(500, 28);
        const said = wrap(ctx, message, inner - 48, 14);
        const from = [sender.name, sender.contact].filter(Boolean).join(' · ');
        const boxTop = y + 14;
        const boxH = said.length * 40 + 36 + (from ? 44 : 0);
        if (draw) {
            roundRect(ctx, P, boxTop, inner, boxH, 18);
            ctx.fillStyle = R.redSoft;
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = R.redLine;
            ctx.stroke();
        }
        said.forEach((line, i) => text(line, P + 24, boxTop + 46 + i * 40, font(500, 28), C.ink));
        if (from) text(`From: ${from}`, P + 24, boxTop + boxH - 22, font(600, 24), C.muted);
        y = boxTop + boxH;

        heading('Answers');
        paragraph(profileLine(' · '), 26, C.ink, 6);

        heading(`Path (${path.length} steps)`);
        path.forEach((code, i) => {
            y += 42;
            text(`${i + 1}.`, P, y, font(700, 26), C.muted);
            text(codeLabel(code), P + 48, y, font(800, 28), isGoal(code) ? C.green : C.ink);
            ctx.font = font(800, 28);
            const nameX = P + 48 + ctx.measureText(codeLabel(code)).width + 16;
            ctx.font = font(400, 26);
            const name = wrap(ctx, nameOf(code), W - P - nameX, 1)[0] || '';
            text(name, nameX, y, font(400, 26), C.muted);
        });

        const last = path[path.length - 1];
        if (isGoal(last)) {
            heading('Result');
            paragraph(`Finished at ${last}.`, 26, C.ink, 2);
        } else {
            const row = lastRow();
            heading(`Options after ${codeLabel(last)}`);
            const shown = row.filter((o) => !o.check.blocked)
                .map((o) => `${o.step.to}${o.step.abroad ? ' (abroad)' : ''}`);
            const hidden = row.filter((o) => o.check.blocked)
                .map((o) => `${o.step.to} (${o.check.reasons.join('; ')})`);
            paragraph(`Shown: ${shown.join(', ') || 'none'}`, 26, C.ink, 8);
            paragraph(`Hidden: ${hidden.join(', ') || 'none'}`, 26, C.muted, 8);
        }

        heading('Map link');
        paragraph(mapLink(), 20, C.muted, 0, MONO);

        y += 40;
        if (draw) {
            ctx.fillStyle = C.line;
            ctx.fillRect(P, y, inner, 2);
        }
        y += 40;
        text(`Reported from ${T.url}. The text snapshot sent with this picture has every detail.`, P, y, font(400, 22), C.muted);
        return y + P;
    }

    async function makeReportImage(message, sender) {
        const canvas = document.createElement('canvas');
        canvas.width = 1080;
        canvas.height = Math.ceil(paintReport(canvas.getContext('2d'), false, message, sender));
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = C.white;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        paintReport(ctx, true, message, sender);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error('No picture');
        return blob;
    }

    // A map link (from a report or a shared address) opens that map right away, also when
    // it's opened in a tab that already shows the page.
    if (location.hash.includes('path=')) openMap();
    window.addEventListener('hashchange', () => {
        if (location.hash.includes('path=')) openMap();
    });
})();

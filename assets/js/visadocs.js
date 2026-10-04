// Visa docs: the reader picks their nationality and current visa, then the visa they want
// or an extension of the current one, and gets the documents to prepare, from official lists
// only (data/visadocs.yaml), with Korean names and where to get each. The optional questions
// come from the list itself: the manual's applicant cases and its "if applicable" documents.
// Every visa with an official list is offered; the Visa map's usual next steps
// (data/visamap.yaml) come first.
import {
    C, NONE, byCode, el, fillCountries, font, isGoal, loadImage, pageContext, paintBrand, paintContacts,
    renderPicture, saveBlob, shareButton as offerShare, statusOf, visaSearch, wrap,
} from './visa/shared.js';
import { setupReport } from './visa/report.js';

const docsRoot = document.getElementById('visa-docs');
if (docsRoot) visaDocs(docsRoot);

function visaDocs(root) {
    const page = pageContext(root);
    const { T, visas, text, nameOf, codeLabel, countryName } = page;
    const targets = page.data.targets || {};
    const catalog = page.data.docs || {};
    // Moves within one status (D-2-2 → D-2-3) and how the manual says they are made.
    const within = page.data.within || {};
    // Moves normally made from abroad (✈) that the manual allows in Korea in some cases.
    const exceptions = page.data.exceptions || {};

    const nationalityInput = document.getElementById('vd-nationality');
    const fromInput = document.getElementById('vd-from');
    const extendField = document.getElementById('vd-extend-field');
    const extendBox = document.getElementById('vd-extend');
    const toField = document.getElementById('vd-to-field');
    const toInput = document.getElementById('vd-to');
    const toHint = document.getElementById('vd-to-hint');
    const errorBox = document.getElementById('vd-error');
    const result = document.getElementById('vd-result');
    const routeLine = document.getElementById('vd-route');
    const titleLine = document.getElementById('vd-title');
    const requirements = document.getElementById('vd-req');
    const questions = document.getElementById('vd-questions');
    const questionsBody = document.getElementById('vd-questions-body');
    const docsBox = document.getElementById('vd-docs');
    const sourceLine = document.getElementById('vd-source');
    const partialNote = document.getElementById('vd-partial');
    const toHintText = toHint.textContent;
    // Where to get each document (form or online link) is shown only if the build allows it.
    const showSource = root.dataset.showSource === 'true';

    // The chosen move and the reader's answers: kind is how it is done (change: change of
    // status in Korea, abroad: a visa from a Korean embassy, extend: extension of stay),
    // caseIndex picks one of the manual's applicant cases (null: all), extraIndex one of its
    // extra lists for an occupation or programme (null: all, 'none': none), answers holds
    // "yes"/"no" for "only if" conditions by their text.
    let state = null;

    // Some cases are only for some nationalities (agreements, the marriage guidance programme).
    const fits = (variant, nationality) => (!variant.countries || variant.countries.includes(nationality))
        && !(variant.notCountries || []).includes(nationality);
    const casesIn = (list, nationality) => (list.variants || []).filter((v) => !v.addon && fits(v, nationality));
    const extrasIn = (list, nationality) => (list.variants || []).filter((v) => v.addon && fits(v, nationality));
    // A visa's list of one kind (change, abroad or extend) that has a case for this nationality.
    const listOf = (code, kind, nationality) => {
        const list = (targets[code] || {})[kind];
        return list && casesIn(list, nationality).length ? list : null;
    };

    // One move with the list for how it is made, or null when there is no official list.
    // Within one status, only what the manual says: a change, an extension with the new
    // sub-code, a new visa from abroad, or a report (D-2 degree courses); other moves use the
    // change-of-status list in Korea, or the embassy list.
    function makeMove(from, to, abroad, nationality) {
        if (from !== NONE && statusOf(to) === statusOf(from)) {
            const rule = within[`${from}>${to}`] || (targets[to]?.change?.within ? { use: 'change' } : null);
            if (!rule) return null;
            const list = listOf(rule.list || to, rule.use, nationality);
            return list ? withExceptions({ to, abroad: rule.use === 'abroad', kind: rule.use, list, rule }, from, nationality) : null;
        }
        const kind = abroad ? 'abroad' : 'change';
        const list = listOf(to, kind, nationality);
        return list ? withExceptions({ to, abroad, kind, list }, from, nationality) : null;
    }

    // The in-Korea exceptions of a move from abroad, each with its list: the visa's change
    // list, a report list, or the exception's own list.
    function withExceptions(move, from, nationality) {
        if (!move.abroad || from === NONE) return move;
        const options = (exceptions[`${from}>${move.to}`] || [])
            .filter((exc) => fits(exc, nationality))
            .map((exc) => ({ ...exc, list: exc.own || listOf(exc.list || move.to, exc.use, nationality) }))
            .filter((exc) => exc.list);
        return options.length ? { ...move, exceptions: options } : move;
    }

    // Every visa with an official list for getting it from `from`: the Visa map's usual next
    // steps first (✈ where the map says it is done from abroad), then all others: in Korea
    // when there is a change-of-status list, otherwise from abroad (✈). With no visa yet,
    // every visa with an embassy list.
    function movesFrom(from, nationality) {
        const visa = visas[from];
        if (!visa) return [];
        const steps = visa.next || [];
        const usual = steps.map((step) => makeMove(from, step.to, from === NONE || Boolean(step.abroad
            || (step.abroadFor && page.countryList(step.abroadFor).includes(nationality))), nationality))
            .filter(Boolean)
            .sort((a, b) => byCode(a.to, b.to))
            .map((move) => ({ ...move, usual: true }));
        const onMap = new Set(steps.map((step) => step.to));
        const others = Object.keys(targets)
            .filter((to) => to !== from && !onMap.has(to))
            .map((to) => makeMove(from, to, from === NONE || !listOf(to, 'change', nationality), nationality))
            .filter(Boolean)
            .sort((a, b) => byCode(a.to, b.to));
        return [...usual, ...others];
    }

    // ---------- Form ----------

    fillCountries(nationalityInput, page);
    const fromCodes = Object.keys(visas)
        .filter((code) => code !== NONE && (!isGoal(code) || targets[code]?.extend))
        .sort(byCode);
    const search = visaSearch(page, {
        input: fromInput,
        list: document.getElementById('vd-from-list'),
        codes: fromCodes,
        onPick: () => update(),
    });
    // The visa wanted: a search box over the moves from the current visa.
    let moves = [];
    const moveTo = (code) => moves.find((move) => move.to === code);
    const toSearch = visaSearch(page, {
        input: toInput,
        list: document.getElementById('vd-to-list'),
        codes: () => moves.map((move) => move.to),
        withNone: false,
        groups: () => [
            { label: T.groupUsual, codes: moves.filter((m) => m.usual).map((m) => m.to) },
            { label: T.groupOther, codes: moves.filter((m) => !m.usual).map((m) => m.to) },
        ],
        // ✈ from abroad; ✈* from abroad, or in Korea in the cases the manual allows.
        mark: (code) => {
            const move = moveTo(code);
            if (search.picked === NONE || !move?.abroad) return '';
            return move.exceptions ? ' ✈*' : ' ✈';
        },
        onPick: () => update(),
    });
    nationalityInput.addEventListener('change', () => update());
    extendBox.addEventListener('change', () => update());

    // Recomputes the visas the reader can move to; a chosen one that no longer fits is cleared.
    function refreshTargets(from, nationality) {
        moves = from && nationality ? movesFrom(from, nationality) : [];
        if (toSearch.picked && !moveTo(toSearch.picked)) toSearch.clear();
        toInput.disabled = !moves.length;
        toHint.textContent = from && nationality && !moves.length ? T.toNone : toHintText;
        // Extending applies to a visa held in Korea.
        extendField.hidden = !from || from === NONE;
        if (extendField.hidden) extendBox.checked = false;
        toField.hidden = extendBox.checked;
    }

    function update(answers) {
        const nationality = nationalityInput.value;
        const from = search.picked;
        refreshTargets(from, nationality);
        errorBox.hidden = true;
        const fail = (message) => {
            errorBox.textContent = message;
            errorBox.hidden = false;
        };
        if (from && !nationality) fail(T.errNationality);
        const extending = extendBox.checked;
        const move = extending
            ? { to: from, abroad: false, kind: 'extend', list: from && nationality && listOf(from, 'extend', nationality), self: true }
            : moveTo(toSearch.picked);
        if (extending && from && nationality && !move.list) fail(T.extendNone);
        if (!from || !nationality || !move || !move.list) {
            state = null;
            result.hidden = true;
            if (!from && !nationality) history.replaceState(null, '', location.pathname + location.search);
            return;
        }
        const same = state && state.from === from && state.to === move.to && state.self === Boolean(move.self)
            && state.nationality === nationality;
        // How the reader applies: from abroad (via null), or in Korea by one of the exceptions.
        const options = move.exceptions || [];
        const via = same && typeof state.via === 'number' && state.via < options.length ? state.via : null;
        const exception = via === null ? null : options[via];
        const keep = same && state.via === via;
        state = {
            nationality,
            from,
            to: move.to,
            abroad: exception ? false : move.abroad,
            kind: exception ? exception.use : move.kind,
            self: Boolean(move.self),
            rule: exception ? null : move.rule || null,
            options,
            via,
            exception,
            list: exception ? exception.list : move.list,
            caseIndex: keep ? state.caseIndex : null,
            extraIndex: keep ? state.extraIndex : null,
            answers: answers || (keep ? state.answers : new Map()),
        };
        render();
    }

    // ---------- Documents ----------

    const variants = () => casesIn(state.list, state.nationality);
    const extras = () => extrasIn(state.list, state.nationality);
    const chosenVariants = () => (state.caseIndex === null ? variants() : [variants()[state.caseIndex]]);
    const chosenExtra = () => (typeof state.extraIndex === 'number' ? extras()[state.extraIndex] : null);
    const docKey = (item) => `${item.doc}|${text(item.only)}`;
    // A condition is asked once per text ("Students on a scholarship"), or per document when the
    // source only says "if applicable" (ask: doc): then the question is the document itself.
    const condKey = (item) => (item.ask === 'doc' ? `${item.doc}|doc` : text(item.only));

    // The "only if" conditions in the chosen case(s) and extra list, in list order:
    // { key, label, ko } with the source's Korean wording.
    function conditions() {
        const seen = [];
        [...chosenVariants(), chosenExtra()].filter(Boolean).forEach((variant) => variant.docs.forEach((item) => {
            if (!item.only || seen.some((c) => c.key === condKey(item))) return;
            seen.push(item.ask === 'doc'
                ? { key: condKey(item), label: docName(item), ko: docKo(item) }
                : { key: condKey(item), label: text(item.only), ko: item.onlyKo || '' });
        }));
        return seen;
    }

    // Groups of documents to show: with one case, its list; with several, the documents in
    // every case first, then each case's own. Then the extra documents for the reader's
    // occupation or programme. Conditional documents answered "no" are left out.
    function documentGroups() {
        const chosen = chosenVariants();
        const keep = (item) => !item.only || state.answers.get(condKey(item)) !== 'no';
        let groups;
        if (chosen.length === 1) {
            const heading = variants().length > 1 ? T.onlyCase.replace('{case}', text(chosen[0].case)) : '';
            groups = [{ heading, docs: chosen[0].docs.filter(keep) }];
        } else {
            const common = chosen[0].docs.filter((item) => chosen.every((v) => v.docs.some((x) => docKey(x) === docKey(item))));
            groups = [
                { heading: T.everyone, docs: common.filter(keep) },
                // Each case's own documents, folded on the page until the reader opens them.
                ...chosen.map((v) => ({
                    heading: T.onlyCase.replace('{case}', text(v.case)),
                    docs: v.docs.filter((item) => !common.some((c) => docKey(c) === docKey(item))).filter(keep),
                    folded: true,
                })),
            ];
        }
        const shown = new Set(groups.flatMap((group) => group.docs.map(docKey)));
        const own = (extra) => extra.docs.filter((item) => !shown.has(docKey(item))).filter(keep);
        if (chosenExtra()) {
            groups.push({ heading: T.extraFor.replace('{case}', text(chosenExtra().case)), docs: own(chosenExtra()) });
        } else if (state.extraIndex === null) {
            extras().forEach((extra) => groups.push({
                heading: T.onlyCase.replace('{case}', text(extra.case)), docs: own(extra), folded: true,
            }));
        }
        return groups.filter((group) => group.docs.length);
    }

    // Documents left out because of the reader's answers (for problem reports).
    function hiddenDocs() {
        const out = [];
        [...chosenVariants(), chosenExtra()].filter(Boolean).forEach((variant) => variant.docs.forEach((item) => {
            if (item.only && state.answers.get(condKey(item)) === 'no') out.push(item);
        }));
        return out;
    }

    // How the chosen case is applied for: in Korea, or abroad at an embassy, through a CCVI, as
    // an e-visa, or (cases of both kinds) depending on the case.
    const ROUTE = { ccvi: 'ccvi', 'e-visa': 'evisa', both: 'both' };
    function routeText() {
        if (state.kind === 'permit') return T.permitRoute;
        if (state.exception) return state.kind === 'report' ? T.reportRoute : T.exceptionRoute;
        if (state.kind === 'report') return T.reportRoute;
        if (state.kind === 'extend') return state.self ? T.extendRoute : T.withinExtend;
        if (!state.abroad) return T.inKorea;
        const routes = new Set(chosenVariants().map((v) => v.route || state.list.route || 'consulate'));
        const route = routes.size === 1 ? [...routes][0] : 'both';
        return T[ROUTE[route]] || T.abroad;
    }

    // The list's source: the chosen case's own section of the manual, if it has one.
    const chosenSource = () => {
        const own = state.caseIndex !== null && chosenVariants()[0].source ? chosenVariants()[0] : state.list;
        return { source: own.source, ref: own.ref };
    };

    const docName = (item) => text((catalog[item.doc] || {}).name) || item.doc;
    const docKo = (item) => (catalog[item.doc] || {}).ko || '';
    const BY = { employer: 'byEmployer', school: 'bySchool', inviter: 'byInviter' };
    const LINK = { form: 'linkForm', online: 'linkOnline', info: 'linkInfo' };
    const host = (url) => {
        try {
            return new URL(url).hostname.replace(/^www\./, '');
        } catch {
            return '';
        }
    };

    // Conditions that already read as one ("If…", "Если…", "Agar…") are shown as they are;
    // others ("GKS scholarship students") get "Only if:" in front.
    const READS_AS_CONDITION = /^(if|when|only|for|in case|если|при|только|для|в случае|agar|faqat|агар|фақат)(?=[\s,:]|$)/iu;
    const conditionNote = (item) => {
        const condition = text(item.only);
        return item.ask === 'doc' || READS_AS_CONDITION.test(condition) ? condition : T.onlyIf.replace('{cond}', condition);
    };

    // The fee documents (수수료, 수입인지): the amount for this move is shown under them.
    const FEE_DOC = /^(?:비자\s*)?(?:신청\s*)?수수료(?:\(수입인지\))?$|수입인지 포함/;
    const feeNote = () => (state.abroad ? T.visaFee : feeText() && `${T.fee}: ${feeText()}`);

    // Notes under a document: who prepares it, where it is handed in, the fee, the manual's
    // note, and its condition when the reader hasn't answered it.
    function docNotes(item) {
        const notes = [];
        if (FEE_DOC.test(docKo(item)) && feeNote()) notes.push(feeNote());
        if (item.by && BY[item.by]) notes.push(T[BY[item.by]]);
        if (item.at === 'embassy') notes.push(T.atEmbassy);
        if (item.only && !state.answers.has(condKey(item))) notes.push(conditionNote(item));
        if (item.note) notes.push(text(item.note));
        return notes;
    }

    // The move in a few words: "D-2-2 → D-2-3", or "D-2-2 · Extension" for the current visa.
    const moveLabel = () => (state.self ? `${codeLabel(state.from)} · ${T.extendShort}` : `${codeLabel(state.from)} → ${state.to}`);

    // Fees paid in Korea (Enforcement Rule art. 72 and 74); visa fees abroad depend on
    // nationality and entry type, so none is shown for them.
    function feeText() {
        if (state.abroad || state.kind === 'report') return '';
        const fees = page.data.fees || {};
        if (state.exception && state.exception.fee === 'exempt') return T.feeExempt;
        if (state.kind === 'permit') return text(fees.permit);
        const holder = state.kind === 'extend' ? state.from : state.to;
        if ((fees.exempt || []).includes(statusOf(holder))) return T.feeExempt;
        if (state.kind === 'extend') return text(statusOf(state.from) === 'F-6' ? fees.extendF6 : fees.extend);
        return text(isGoal(state.to) ? fees.pr : fees.change);
    }

    // What the manual says on top of the list: it is only part of the documents, the
    // list's own notice (e.g. visa-free stays are not extended), and the move's rule.
    const notices = () => [state.list.partial && T.partial, text(state.list.notice), state.rule && text(state.rule.notice),
        state.exception && text(state.exception.notice)].filter(Boolean);
    const viaLabel = (exc) => T.viaKorea.replace('{who}', text(exc.who));

    function render() {
        const { from, to } = state;
        routeLine.textContent = routeText();
        partialNote.textContent = notices().join(' ');
        partialNote.hidden = !notices().length;
        titleLine.replaceChildren(...(state.self
            ? [el('span', 'vd-code', codeLabel(from)), document.createTextNode(` · ${T.extendShort}`)]
            : [el('span', 'vd-code', codeLabel(from)), document.createTextNode(' → '), el('span', 'vd-code', to)]),
        el('span', 'vd-title-name', nameOf(to)));
        // How to get the visa matters for a new one, not for extending the current one.
        requirements.textContent = !state.self && text(visas[to].how) ? `${T.requirements}: ${text(visas[to].how)}` : '';
        renderQuestions();

        let number = 0;
        docsBox.replaceChildren(...documentGroups().map((group) => {
            const box = el(group.folded ? 'details' : 'section', 'vd-group');
            if (group.folded) box.append(el('summary', 'vd-group-title', `${group.heading} (${group.docs.length})`));
            else if (group.heading) box.append(el('h4', 'vd-group-title', group.heading));
            const listEl = el('ol', 'vd-list');
            group.docs.forEach((item) => {
                number += 1;
                const entry = catalog[item.doc] || {};
                const li = el('li', 'vd-doc');
                li.append(el('span', 'vd-num', String(number)));
                const body = el('div', 'vd-doc-body');
                const name = el('p', 'vd-doc-name', docName(item));
                if (docKo(item)) {
                    const ko = el('span', 'vd-doc-ko', docKo(item));
                    ko.lang = 'ko';
                    name.append(ko);
                }
                body.append(name);
                const notes = docNotes(item);
                if (notes.length) body.append(el('p', 'vd-doc-note', notes.join(' · ')));
                if (showSource && entry.link) {
                    const a = el('a', 'vd-doc-link', `${T[LINK[entry.kind] || 'linkInfo']} · ${host(entry.link)}`);
                    a.href = entry.link;
                    a.target = '_blank';
                    a.rel = 'noopener';
                    body.append(a);
                }
                li.append(body);
                listEl.append(li);
            });
            box.append(listEl);
            return box;
        }));
        document.getElementById('vd-docs-title').textContent = `${T.docsTitle} (${number})`;
        const fee = feeText();
        sourceLine.textContent = [`${T.source}: ${chosenSource().source}`, fee && `${T.fee}: ${fee}`].filter(Boolean).join(' · ');
        result.hidden = false;
        saveDocs();
    }

    // A list to pick from, with "show all" first: the applicant cases, the extra lists.
    function choiceField(id, labelText, first, options, value, onPick, hint) {
        const field = el('div', 'vm-field');
        const label = el('label', 'vm-label', labelText);
        label.htmlFor = id;
        const select = el('select', 'vm-input');
        select.id = id;
        first.forEach(([optionText, optionValue]) => select.add(new Option(optionText, optionValue)));
        options.forEach((v, i) => select.add(new Option(text(v.case), String(i))));
        select.value = value;
        select.addEventListener('change', () => {
            onPick(select.value);
            render();
        });
        field.append(label, select);
        if (hint) field.append(el('p', 'vm-hint', hint));
        return field;
    }

    // The manual's applicant cases, its extra lists for occupations and programmes, and one
    // yes/no per "only if" condition.
    function renderQuestions() {
        const rows = [];
        if (state.options.length) {
            rows.push(choiceField('vd-via', T.via, [[T.viaAbroad, '']], state.options.map((exc) => ({ case: viaLabel(exc) })),
                state.via === null ? '' : String(state.via),
                (value) => {
                    state.via = value === '' ? null : Number(value);
                    update();
                }));
        }
        if (variants().length > 1) {
            rows.push(choiceField('vd-case', T.situation, [[T.situationAll, '']], variants(),
                state.caseIndex === null ? '' : String(state.caseIndex),
                (value) => { state.caseIndex = value === '' ? null : Number(value); }));
        }
        if (extras().length) {
            rows.push(choiceField('vd-extra', T.extra, [[T.extraAll, ''], [T.extraNone, 'none']], extras(),
                state.extraIndex === null ? '' : String(state.extraIndex),
                (value) => { state.extraIndex = value === '' ? null : value === 'none' ? 'none' : Number(value); },
                T.extraHint));
        }
        const asked = conditions();
        if (asked.length) {
            const fields = el('fieldset', 'vm-group-fields');
            fields.append(el('legend', 'vm-group-legend', T.applies));
            asked.forEach((condition, i) => {
                const row = el('div', 'vd-condition');
                const label = el('span', 'vd-condition-text', condition.label);
                // The source's own wording, for checking with a Korean speaker.
                if (condition.ko) {
                    const ko = el('span', 'vd-condition-ko', condition.ko);
                    ko.lang = 'ko';
                    label.append(ko);
                }
                row.append(label);
                const segment = el('div', 'vm-segment');
                ['yes', 'no'].forEach((value) => {
                    const label = el('label');
                    const input = el('input');
                    input.type = 'radio';
                    input.name = `vd-q${i}`;
                    input.value = value;
                    input.checked = state.answers.get(condition.key) === value;
                    input.dataset.checked = String(input.checked);
                    input.addEventListener('click', () => {
                        // A second click on the chosen answer clears it.
                        if (state.answers.get(condition.key) === value) state.answers.delete(condition.key);
                        else state.answers.set(condition.key, value);
                        render();
                    });
                    label.append(input, el('span', '', T[value]));
                    segment.append(label);
                });
                row.append(segment);
                fields.append(row);
            });
            rows.push(fields);
        }
        questions.hidden = !rows.length;
        questionsBody.replaceChildren(...rows);
        // Several applicant cases or extra lists: open the questions, since a choice shortens
        // the list a lot.
        if (state.options.length || variants().length > 1 || extras().length || state.caseIndex !== null || state.answers.size) {
            questions.open = true;
        }
    }

    // The reader's choices in one line: nationality, case, extra list and answered conditions.
    function profileLine(separator) {
        const parts = [`${T.nationality}: ${countryName(state.nationality)}`];
        if (state.exception) parts.push(viaLabel(state.exception));
        if (state.caseIndex !== null) parts.push(text(variants()[state.caseIndex].case));
        if (chosenExtra()) parts.push(text(chosenExtra().case));
        conditions().forEach((c) => state.answers.has(c.key) && parts.push(`${c.label}: ${T[state.answers.get(c.key)]}`));
        return parts.join(separator);
    }

    // ---------- Links ----------

    // The page address keeps the choice (nationality, visas, case, extra list, answers by
    // condition number), so a shared or reported link opens the same list.
    function docsParams() {
        const params = new URLSearchParams({ nationality: state.nationality, from: state.from });
        if (state.self) params.set('extend', '1');
        else params.set('to', state.to);
        if (state.via !== null) params.set('via', state.via);
        if (state.caseIndex !== null) params.set('case', state.caseIndex);
        if (state.extraIndex !== null) params.set('extra', state.extraIndex);
        const asked = conditions();
        ['yes', 'no'].forEach((value) => {
            const picked = asked.map((c, i) => (state.answers.get(c.key) === value ? i : -1)).filter((i) => i >= 0);
            if (picked.length) params.set(value, picked.join('.'));
        });
        return params;
    }

    const docsLink = () => `${location.origin}${location.pathname}#${docsParams()}`;
    const saveDocs = () => history.replaceState(null, '', `#${docsParams()}`);

    function openDocs() {
        const params = new URLSearchParams(location.hash.slice(1));
        const from = params.get('from');
        if (!from || !visas[from]) return;
        nationalityInput.value = params.get('nationality') || '';
        extendBox.checked = params.get('extend') === '1';
        state = null;
        toSearch.clear();
        search.pick(from); // updates the visas offered
        const to = params.get('to');
        if (!extendBox.checked && to && moveTo(to)) toSearch.pick(to);
        if (!state) return;
        const via = Number.parseInt(params.get('via'), 10);
        if (via >= 0 && via < state.options.length) {
            state.via = via;
            update();
        }
        const caseIndex = Number.parseInt(params.get('case'), 10);
        if (caseIndex >= 0 && caseIndex < variants().length) state.caseIndex = caseIndex;
        const extra = params.get('extra');
        const extraIndex = Number.parseInt(extra, 10);
        if (extra === 'none') state.extraIndex = 'none';
        else if (extraIndex >= 0 && extraIndex < extras().length) state.extraIndex = extraIndex;
        const asked = conditions();
        ['yes', 'no'].forEach((value) => (params.get(value) || '').split('.').forEach((i) => {
            if (asked[Number(i)] !== undefined && i !== '') state.answers.set(asked[Number(i)].key, value);
        }));
        render();
    }

    // ---------- Picture ----------

    // The documents as a picture: the move, the reader's choices, each document with its
    // Korean name and where to get it, and our contacts.
    function paint(ctx, draw, logo) {
        const W = 1080;
        const P = 64;
        const inner = W - 2 * P;
        const textX = P + 76;
        const line = (value, x, y, style, color) => {
            ctx.font = style;
            if (draw) {
                ctx.fillStyle = color;
                ctx.fillText(value, x, y);
            }
        };
        let y = paintBrand(ctx, draw, { logo, site: T.site, title: T.imageTitle });

        y += 74;
        line(moveLabel(), P, y, font(800, 46), C.ink);
        ctx.font = font(400, 28);
        wrap(ctx, nameOf(state.to), inner, 2).forEach((part) => {
            y += 40;
            line(part, P, y, font(400, 28), C.muted);
        });
        ctx.font = font(700, 26);
        wrap(ctx, routeLine.textContent, inner, 2).forEach((part, i) => {
            y += i ? 34 : 42;
            line(part, P, y, font(700, 26), C.green);
        });
        ctx.font = font(500, 24);
        wrap(ctx, profileLine('   ·   '), inner, 4).forEach((part) => {
            y += 36;
            line(part, P, y, font(500, 24), C.muted);
        });
        if (notices().length) {
            y += 12;
            ctx.font = font(700, 24);
            wrap(ctx, notices().join(' '), inner, 8).forEach((part) => {
                y += 34;
                line(part, P, y, font(700, 24), C.amber);
            });
        }
        y += 20;

        let number = 0;
        documentGroups().forEach((group) => {
            if (group.heading) {
                y += 52;
                ctx.font = font(800, 22);
                wrap(ctx, group.heading.toUpperCase(), inner, 2).forEach((part, i) => {
                    if (i) y += 30;
                    line(part, P, y, font(800, 22), C.navy);
                });
                y += 6;
            }
            group.docs.forEach((item) => {
                number += 1;
                const entry = catalog[item.doc] || {};
                y += 30;
                const top = y;
                ctx.font = font(700, 30);
                const name = wrap(ctx, docName(item), inner - (textX - P), 3);
                name.forEach((part, i) => line(part, textX, top + 30 + i * 40, font(700, 30), C.ink));
                y = top + 30 + (name.length - 1) * 40;
                if (docKo(item)) {
                    ctx.font = font(500, 26);
                    wrap(ctx, docKo(item), inner - (textX - P), 3).forEach((part, i) => {
                        y += i ? 34 : 38;
                        line(part, textX, y, font(500, 26), C.green);
                    });
                }
                const meta = [...docNotes(item), showSource && entry.link && `→ ${host(entry.link)}`].filter(Boolean).join(' · ');
                if (meta) {
                    ctx.font = font(400, 23);
                    wrap(ctx, meta, inner - (textX - P), 4).forEach((part) => {
                        y += 32;
                        line(part, textX, y, font(400, 23), C.muted);
                    });
                }
                if (draw) {
                    ctx.beginPath();
                    ctx.arc(P + 24, top + 20, 24, 0, Math.PI * 2);
                    ctx.fillStyle = C.green;
                    ctx.fill();
                    ctx.textAlign = 'center';
                    line(String(number), P + 24, top + 29, font(700, 24), C.white);
                    ctx.textAlign = 'left';
                }
                y += 14;
            });
        });

        y += 30;
        ctx.font = font(400, 22);
        wrap(ctx, sourceLine.textContent, inner, 3).forEach((part) => {
            y += 30;
            line(part, P, y, font(400, 22), C.muted);
        });
        return paintContacts(ctx, draw, y, T);
    }

    async function makeImage() {
        const logo = await loadImage(root.dataset.logo);
        return renderPicture((ctx, draw) => paint(ctx, draw, logo));
    }

    const fileName = () => `visa-docs-${state.from === NONE ? 'no-visa' : state.from}-${state.self ? 'extension' : `to-${state.to}`}.png`;
    document.getElementById('vd-download').addEventListener('click', async () => saveBlob(await makeImage(), fileName()));
    offerShare(document.getElementById('vd-share'), makeImage, fileName, { title: T.imageTitle, url: T.url });

    // ---------- Problem reports ----------

    // The list as plain text, for the admin or an AI assistant.
    function docsText(message, sender) {
        const asked = conditions();
        const lines = [
            'VISA DOCS BUG REPORT',
            `time: ${new Date().toISOString()}`,
            `page: ${location.origin}${location.pathname}`,
            `language: ${page.lang}`,
            `data: data/visadocs.yaml, updated ${page.data.updated || '?'}`,
            `link: ${docsLink()}`,
            '',
            'message:',
            message,
            `name: ${sender.name || '(none)'}`,
            `contact: ${sender.contact || '(none)'}`,
            '',
            `nationality: ${state.nationality} (${countryName(state.nationality)})`,
            `move: ${state.self ? `${state.from} extension` : `${state.from} > ${state.to}`} (${state.kind === 'extend'
                ? 'extension of stay' : state.kind === 'report' ? 'report of a change of registration' : state.abroad ? `abroad: ${routeText()}` : 'change of status in Korea'})`
                + `${state.rule ? ` [within-status rule: ${JSON.stringify(state.rule)}]` : ''}`,
            `source: ${chosenSource().source}${chosenSource().ref ? ` [${chosenSource().ref}]` : ''}`,
            `partial list: ${state.list.partial ? 'yes (the manual names only part of the documents)' : 'no'}`,
            `notices: ${notices().join(' | ') || '(none)'}`,
            `applies: ${state.exception ? `in Korea by exception ${state.via}: ${text(state.exception.who)}` : state.options.length ? `from abroad (${state.options.length} exceptions offered)` : 'as the route says'}`,
            `case: ${state.caseIndex === null ? `all (${variants().length})` : text(variants()[state.caseIndex].case)}`,
            `extra list: ${!extras().length ? '(none offered)' : state.extraIndex === null ? `all (${extras().length})`
                : state.extraIndex === 'none' ? 'none of these' : text(chosenExtra().case)}`,
            `answers: ${asked.map((c) => `${c.label}=${state.answers.get(c.key) || '?'}`).join('; ') || '(no questions)'}`,
            'documents shown:',
        ];
        let number = 0;
        documentGroups().forEach((group) => {
            if (group.heading) lines.push(`  [${group.heading}]`);
            group.docs.forEach((item) => {
                number += 1;
                const entry = catalog[item.doc] || {};
                lines.push(`  ${number}. ${item.doc}: ${docName(item)} / ${docKo(item)}`
                    + `${item.only ? ` | only: ${text(item.only)}` : ''}${item.by ? ` | by: ${item.by}` : ''}`
                    + `${item.at ? ` | at: ${item.at}` : ''}`
                    + `${item.note ? ` | note: ${text(item.note)}` : ''}${entry.link ? ` | ${entry.link}` : ''}`);
            });
        });
        const hidden = hiddenDocs();
        lines.push(`documents hidden by answers: ${hidden.map((item) => item.doc).join(', ') || 'none'}`);
        lines.push('', `browser: ${navigator.userAgent}`, `window: ${innerWidth}x${innerHeight} @${devicePixelRatio}x`);
        return lines.join('\n');
    }

    setupReport(page, () => {
        let number = 0;
        const rows = [];
        documentGroups().forEach((group) => group.docs.forEach((item) => {
            number += 1;
            rows.push({ num: number, strong: docName(item), rest: docKo(item) });
        }));
        return {
            page: 'Visa docs',
            link: docsLink(),
            summary: [profileLine(' · '), `${T.reportPath}: ${moveLabel()}`],
            text: docsText,
            fileTag: `${state.from}-${state.self ? 'extension' : state.to}`,
            sections: [
                { heading: 'Answers', rows: [profileLine(' · ')] },
                { heading: 'Move', rows: [`${moveLabel()} · ${routeLine.textContent}`,
                    { muted: true, text: `Source: ${chosenSource().source}${state.list.partial ? ' (partial list)' : ''}` }] },
                { heading: `Documents shown (${number})`, rows },
                { heading: 'Hidden by answers', rows: [hiddenDocs().map((item) => docName(item)).join(', ') || 'none'] },
            ],
        };
    });

    // A link with a choice (from a report or a shared address) opens it right away.
    if (location.hash.includes('from=')) openDocs();
    window.addEventListener('hashchange', () => {
        if (location.hash.includes('from=')) openDocs();
    });
}

// The rules of the Visa map: which visas can follow which, and whether each one fits the
// reader and the path so far. No page code here, so the same rules run in the browser
// (visamap.js) and in the tests (tests/visamap.test.mjs).
import { NONE, statusOf } from './shared.js';

// Levels are numbers (education, experience, investment, university ranking): a level implied
// by the path raises the reader's own level, or is a minimum when they left that field empty.
export const LEVELS = ['edu', 'koreanEdu', 'rank', 'experience', 'invest'];
const FACTS = ['korean', 'spouse', 'koreanChild', 'parent', 'edu', 'rank', 'experience', 'invest'];
// Facts that unlock options; meeting them marks the option as a match.
const PERSONAL = ['korean', 'spouse', 'koreanChild', 'parent', 'invest', 'rank', 'stem', 'koreanEdu'];

// A visa code matches a listed status or sub-status: 'D-4' matches D-4-1, 'E-1' doesn't match E-10.
export const isStatus = (code, list) => [].concat(list).some((s) => code === s || code.startsWith(`${s}-`));

// Each check is 'yes', 'later' (not yet, but the reader can get there on this path), 'maybe'
// (not enough known) or 'no'. Several checks that must all hold count as the worst of them;
// of several alternatives the reader gets the best one, where an unknown beats a sure "not yet".
const SEVERITY = ['yes', 'later', 'maybe', 'no'];
const PREFER = ['yes', 'maybe', 'later', 'no'];
const worst = (results) => results.reduce((a, b) => (SEVERITY.indexOf(b) > SEVERITY.indexOf(a) ? b : a), 'yes');

// data: the visa map data (visas, groups, statusGroups, gni, incomeCuts), as embedded in the page.
export function visaRules(data) {
    const visas = data.visas || {};
    const groups = data.groups || {};
    const statusGroups = data.statusGroups || {};
    const gni = data.gni || null;
    const cuts = data.incomeCuts || {};

    // Nationality lists: a group name from data.groups, or a list of ISO codes.
    const countryList = (value) => (typeof value === 'string' ? groups[value] || [] : value || []);
    const isIn = (person, value) => Boolean(person && countryList(value).includes(person.nationality));
    // Visa lists: a group name from data.statusGroups, or a list of codes.
    const statusList = (value) => (typeof value === 'string' ? statusGroups[value] || [value] : value || []);

    // How long a visa can be held, in years: [shortest, longest]. Without 'years' it has no
    // fixed length (it can be extended), so [0, Infinity].
    function span(code) {
        const years = visas[code] && visas[code].years;
        if (!years) return [0, Infinity];
        return [years[0] || 0, years[1] === undefined ? Infinity : years[1]];
    }

    // Possible next visas from path[level - 1]. A visa held earlier on the path can be offered
    // again (a second D-10-1 after a new degree, E-7-1 again after a job search); a move's
    // `again` note then replaces its usual note. A move needs a new visa from abroad if marked
    // so, only for some nationalities (abroadFor), or when the reader has no Korean visa yet.
    // A move can have its own requirements (needs, lang, income) instead of the visa's.
    function nextSteps(person, path, level) {
        const code = path[level - 1];
        const visa = visas[code];
        if (!visa) return [];
        const earlier = path.slice(0, level);
        return (visa.next || [])
            .map((step) => (typeof step === 'string' ? { to: step } : step))
            .filter((step) => visas[step.to])
            .map((step) => ({
                to: step.to,
                note: earlier.includes(step.to) && step.again ? step.again : step.note,
                abroad: Boolean(step.abroad || visa.abroad || code === NONE
                    || (step.abroadFor && isIn(person, step.abroadFor))),
                needs: step.needs,
                lang: step.lang,
                income: step.income,
            }));
    }

    // ---------- Facts ----------

    function profileFacts(person) {
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

    // What the path before step `level` says about time, as [at least, at most] years:
    // - age: years added to the reader's age;
    // - work: years of work on the visas of the path that are jobs ('work: true');
    // - on(list): years on the listed visas.
    // The current visa (path[0]) is already running: the reader may stay on it up to its limit,
    // but it adds nothing for sure. Every later visa takes at least its shortest length. Time
    // abroad before a first visa isn't part of the path.
    function timeAt(path, level) {
        const before = path.slice(0, level);
        const sum = (keep) => before.reduce(([lo, hi], code, i) => {
            if (code === NONE || !keep(code)) return [lo, hi];
            const [min, max] = span(code);
            return [lo + (i === 0 ? 0 : min), hi + max];
        }, [0, 0]);
        return {
            age: sum(() => true),
            work: sum((code) => Boolean(visas[code] && visas[code].work)),
            on: (list) => {
                const codes = statusList(list);
                return sum((code) => isStatus(code, codes));
            },
        };
    }

    // Facts are what we know about the reader when they take step `level` (from path[level - 1]):
    // their details, plus what the visas chosen so far imply ("gives": a Korean degree after
    // D-2-2) and the time the path takes (age, years of work). The reader's own answers win
    // over what a visa implies.
    function factsAt(person, path, level) {
        const known = profileFacts(person);
        const min = {};
        path.slice(0, level).forEach((code) => {
            Object.entries((visas[code] && visas[code].gives) || {}).forEach(([key, value]) => {
                if (!LEVELS.includes(key)) {
                    if (known[key] === undefined) known[key] = value;
                } else if (known[key] !== undefined) known[key] = Math.max(known[key], value);
                else min[key] = Math.max(min[key] === undefined ? value : min[key], value);
            });
        });
        // The visa held before the status this step leaves from (a run of sub-statuses of one
        // status, such as D-10-1 > D-10-2 > D-10-1, counts as one). Unknown for the current visa.
        const from = path[level - 1];
        let i = level - 2;
        while (i >= 0 && statusOf(path[i]) === statusOf(from)) i--;
        const time = timeAt(path, level);
        const age = [person.age + time.age[0], person.age + time.age[1]];
        return { known, min, previous: i >= 0 ? path[i] : undefined, time, age, path, level };
    }

    // Requirement checks, each 'yes', 'maybe', 'later' or 'no'.
    function checkFact(person, facts, key, want) {
        if (key === 'ageUnder') return facts.age[0] < want ? 'yes' : 'no';
        if (key === 'countries') return isIn(person, want) ? 'yes' : 'no';
        if (key === 'notAfter') return facts.previous === undefined ? 'maybe' : isStatus(facts.previous, want) ? 'no' : 'yes';
        if (key === 'stay') {
            // Years on the listed visas along the path. What came before the current visa is
            // unknown, so only a path that starts with no visa can fall short for good.
            const [lo, hi] = facts.time.on(want.in);
            if (lo >= want.years) return 'yes';
            if (hi >= want.years) return 'later';
            return facts.path[0] === NONE ? 'no' : 'maybe';
        }
        const have = facts.known[key];
        if (key === 'experience') {
            const [lo, hi] = facts.time.work;
            const base = have !== undefined ? have : facts.min.experience || 0;
            if (base + lo >= want) return 'yes';
            if (have === undefined) return 'maybe';
            return base + hi >= want ? 'later' : 'no';
        }
        if (LEVELS.includes(key)) {
            if (have !== undefined) return have >= want ? 'yes' : 'no';
            return facts.min[key] >= want ? 'yes' : 'maybe';
        }
        if (have === undefined) return 'maybe';
        return [].concat(want).includes(have) ? 'yes' : 'no';
    }

    // Requirements: { fact: value, ... } where all must hold, or a list of those where any one
    // is enough. Returns the result of the best alternative and the facts behind it; when no
    // alternative fits, every fact that stands in the way.
    function checkNeeds(person, needs, facts) {
        if (!needs) return { result: 'yes', keys: [], later: [] };
        const options = [].concat(needs).map((group) => {
            const checks = Object.entries(group).map(([key, want]) => ({ key, want, result: checkFact(person, facts, key, want) }));
            return { checks, result: worst(checks.map((c) => c.result)) };
        });
        const best = PREFER.map((r) => options.find((o) => o.result === r)).find(Boolean)
            || { checks: [], result: 'yes' };
        const keysOf = (option, result) => option.checks.filter((c) => c.result === result).map((c) => c.key);
        if (best.result === 'no') {
            return { result: 'no', keys: [...new Set(options.flatMap((o) => keysOf(o, 'no')))], later: [] };
        }
        return {
            result: best.result,
            keys: keysOf(best, best.result === 'later' ? 'yes' : best.result),
            later: best.checks.filter((c) => c.result === 'later'),
        };
    }

    // Korean level: { topik: 3, kiip: 3 } means TOPIK 3 or KIIP level 3 is enough. A lower level
    // the reader gave is 'later': Korean can be learned on the way.
    function checkLanguage(person, want) {
        if (!want) return null;
        const results = Object.entries(want)
            .map(([key, level]) => (person[key] === undefined ? 'maybe' : person[key] >= level ? 'yes' : 'no'));
        return results.includes('yes') ? 'yes' : results.includes('maybe') ? 'maybe' : 'later';
    }

    // ---------- Income ----------

    // Whether a reduction of the income requirement applies to the reader: 'yes', 'no', or
    // 'maybe' when it depends on something the map doesn't ask. `when` is { fact: value, ... }
    // (all must hold) or a list of those (any one is enough); no `when` means the map can't tell.
    function cutApplies(person, facts, cut) {
        if (!cut.when) return 'maybe';
        const one = (group) => {
            const results = Object.entries(group).map(([key, want]) => {
                if (key === 'kiip' || key === 'topik') return person[key] === undefined ? 'maybe' : person[key] >= want ? 'yes' : 'no';
                const result = checkFact(person, facts, key, want);
                return result === 'later' ? 'maybe' : result;
            });
            return results.includes('no') ? 'no' : results.includes('maybe') ? 'maybe' : 'yes';
        };
        const results = [].concat(cut.when).map(one);
        return results.includes('yes') ? 'yes' : results.includes('maybe') ? 'maybe' : 'no';
    }

    // The yearly income a step asks of the reader, in ₩ million: the base amount (a multiple of
    // GNI per person, or a fixed amount), lowered by the reductions that apply to the reader.
    // Reductions don't add up: each names its own share of the base (a combination that the
    // rules allow is a reduction of its own), the smallest share that applies counts, and it
    // never goes below the rule's floor. A share of 0 means no income test at all.
    // With household income (the reader's family living with them counts too), the reader's
    // own share must still be at least half, so the reader's own income alone only settles it
    // when it covers everything or less than half. Returns null without an income requirement.
    function incomeFor(person, path, level, step) {
        const visa = visas[step.to] || {};
        const rule = step.income || visa.income;
        if (!rule || (rule.gni === undefined && rule.krw === undefined)) return null;
        const base = rule.gni !== undefined ? (gni ? rule.gni * gni.krw : null) : rule.krw;
        if (base === null) return null;
        const facts = factsAt(person, path, level);
        const applies = (rule.cuts || []).map((id) => ({ id, ...cuts[id] })).filter((c) => c.factor !== undefined)
            .map((c) => ({ ...c, result: cutApplies(person, facts, c) }));
        const used = applies.filter((c) => c.result === 'yes').sort((a, b) => a.factor - b.factor)[0] || null;
        const floor = rule.floor !== undefined ? rule.floor : 0;
        const factor = used ? Math.max(used.factor, floor) : 1;
        const amount = base * factor;
        const own = person.income;
        let result = 'maybe';
        if (amount === 0 || (own !== undefined && own >= amount)) result = 'yes';
        else if (own !== undefined && (!rule.household || own < amount / 2)) result = 'later';
        return {
            rule,
            base,
            amount,
            cut: used,
            // Reductions that may apply but depend on things the map doesn't know.
            maybe: applies.filter((c) => c.result === 'maybe' && c.factor < factor),
            whose: rule.household ? 'household' : 'own',
            result,
        };
    }

    // ---------- Assessment ----------

    // Whether the reader can take a step: blocked with the reasons, or open with tags. Reasons
    // and tags are { key, ... } for the page to put in words. An open option the reader can
    // only take after more time, work, Korean or income is marked `later`.
    function assess(person, path, level, step) {
        const visa = visas[step.to] || {};
        const reasons = [];
        const tags = [];
        const facts = factsAt(person, path, level);
        // The reader's age when taking this step: as soon as the path allows, or as late.
        const [young, old] = facts.age;
        const age = (visa.ageByCountry && visa.ageByCountry[person.nationality]) || visa.age;
        if (age) {
            const [min, max] = age;
            const range = max !== undefined ? `${min}–${max}` : `${min}+`;
            if ((max !== undefined && young > max) || old < min) reasons.push({ key: 'ageOnly', range });
            else if (young < min) tags.push({ key: 'laterAge', age: min, later: true });
        }
        if (visa.countries && !isIn(person, visa.countries)) reasons.push({ key: 'notForNationality' });

        const want = step.needs || visa.needs;
        const needs = checkNeeds(person, want, facts);
        // A match: the reader's own answers (not just the path) unlock this option.
        const own = checkNeeds(person, want, { ...facts, known: profileFacts(person), min: {},
            time: { work: [0, 0], on: () => [0, 0] } });
        if (needs.result === 'no') needs.keys.forEach((key) => reasons.push({ key: 'why', fact: key }));
        else if (needs.result === 'maybe' && needs.keys.includes('korean')) tags.push({ key: 'koreansOnly' });
        else if (own.result === 'yes' && own.keys.some((key) => PERSONAL.includes(key))) tags.push({ key: 'matches', match: true });
        // Years on the right visas are the normal way forward and the move's note names them;
        // years of work the reader said they don't have yet are worth a tag.
        needs.later.filter((c) => c.key === 'experience')
            .forEach((c) => tags.push({ key: 'laterExperience', years: c.want, later: true }));

        const language = step.lang || visa.lang;
        const korean = checkLanguage(person, language);
        if (korean === 'later') tags.push({ key: 'langNeed', language, later: true });

        const income = incomeFor(person, path, level, step);
        if (income && income.result === 'later') tags.push({ key: 'laterIncome', amount: income.amount, later: true });

        return {
            blocked: reasons.length > 0,
            reasons: reasons.filter((r, i) => reasons.findIndex((s) => JSON.stringify(s) === JSON.stringify(r)) === i),
            tags,
            later: !reasons.length && tags.some((t) => t.later),
            korean,
            language,
            income,
            age: facts.age,
        };
    }

    return { nextSteps, factsAt, timeAt, checkNeeds, assess, incomeFor, isIn, countryList, span };
}

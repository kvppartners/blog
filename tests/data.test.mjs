// Checks of data/visamap.yaml itself: the graph is well formed, every rule uses facts the
// engine knows, every text exists in all four languages, and the moves agree with the official
// document lists in data/visadocs.yaml. Run with `npm test` in tests/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { isGoal } from '../assets/js/visa/shared.js';

const read = (file) => load(readFileSync(new URL(`../data/${file}`, import.meta.url), 'utf8'));
const map = read('visamap.yaml');
const docs = read('visadocs.yaml');
const countries = read('countries.yaml');
const { visas, groups } = map;
const LANGS = ['en', 'ru', 'uz', 'uz-cyrl'];
const FACTS = ['korean', 'spouse', 'koreanChild', 'parent', 'edu', 'koreanEdu', 'stem', 'rank', 'experience', 'invest',
    'ageUnder', 'countries', 'notAfter', 'stay'];

const moves = (code) => (visas[code].next || []).map((m) => (typeof m === 'string' ? { to: m } : m));
const allMoves = () => Object.keys(visas).flatMap((from) => moves(from).map((m) => ({ from, ...m })));
const rulesOf = (code) => [visas[code].needs, ...moves(code).map((m) => m.needs)].filter(Boolean).flatMap((n) => [].concat(n));
const missingLangs = (value) => LANGS.filter((l) => !(value && typeof value[l] === 'string' && value[l].trim()));

test('every move goes to a known visa, once, and never to itself', () => {
    const problems = [];
    for (const code of Object.keys(visas)) {
        const seen = new Set();
        for (const m of moves(code)) {
            if (!visas[m.to]) problems.push(`${code} -> unknown ${m.to}`);
            if (m.to === code) problems.push(`${code} -> itself`);
            if (seen.has(m.to)) problems.push(`${code} -> ${m.to} twice`);
            seen.add(m.to);
        }
    }
    assert.deepEqual(problems, []);
});

test('permanent residence is the end of a path', () => {
    assert.deepEqual(Object.keys(visas).filter((c) => isGoal(c) && moves(c).length), []);
});

test('requirements only use facts the engine knows', () => {
    const problems = [];
    for (const code of Object.keys(visas)) {
        for (const group of rulesOf(code)) {
            Object.keys(group).filter((k) => !FACTS.includes(k)).forEach((k) => problems.push(`${code}: ${k}`));
            if (group.stay) {
                const { years, in: list } = group.stay;
                if (!(years > 0)) problems.push(`${code}: stay without years`);
                if (typeof list === 'string' ? !(map.statusGroups || {})[list] : !Array.isArray(list)) problems.push(`${code}: stay in ${list}`);
            }
        }
        const gives = visas[code].gives || {};
        Object.keys(gives).filter((k) => !FACTS.includes(k)).forEach((k) => problems.push(`${code} gives ${k}`));
    }
    assert.deepEqual(problems, []);
});

test('time on a visa is [shortest, longest] years', () => {
    const problems = Object.entries(visas).filter(([, v]) => v.years !== undefined).filter(([, v]) => {
        const [min, max] = v.years;
        return !(Array.isArray(v.years) && min >= 0 && (max === undefined || max >= min));
    }).map(([code]) => code);
    assert.deepEqual(problems, []);
});

test('income rules use GNI or a fixed amount and known reductions', () => {
    const cuts = map.incomeCuts || {};
    const problems = [];
    const rules = Object.entries(visas).flatMap(([code, v]) => [[code, v.income], ...moves(code).map((m) => [`${code}->${m.to}`, m.income])])
        .filter(([, r]) => r);
    for (const [where, rule] of rules) {
        if ((rule.gni === undefined) === (rule.krw === undefined)) problems.push(`${where}: needs gni or krw`);
        if (rule.gni !== undefined && !(map.gni && map.gni.krw > 0)) problems.push(`${where}: no gni figure`);
        (rule.cuts || []).filter((id) => !cuts[id]).forEach((id) => problems.push(`${where}: unknown cut ${id}`));
        if (rule.floor !== undefined && !(rule.floor > 0 && rule.floor <= 1)) problems.push(`${where}: floor ${rule.floor}`);
    }
    for (const [id, cut] of Object.entries(cuts)) {
        if (!(cut.factor >= 0 && cut.factor < 1)) problems.push(`cut ${id}: factor ${cut.factor}`);
        missingLangs(cut.text).forEach((l) => problems.push(`cut ${id}: no ${l} text`));
    }
    assert.deepEqual(problems, []);
});

test('every name, note and nationality note exists in all four languages', () => {
    const problems = [];
    for (const [code, v] of Object.entries(visas)) {
        missingLangs(v.name).forEach((l) => problems.push(`${code} name ${l}`));
        missingLangs(v.how).forEach((l) => problems.push(`${code} how ${l}`));
        (v.notes || []).forEach((n, i) => missingLangs(n.text).forEach((l) => problems.push(`${code} notes[${i}] ${l}`)));
        moves(code).forEach((m) => {
            if (m.note) missingLangs(m.note).forEach((l) => problems.push(`${code} -> ${m.to} note ${l}`));
            if (m.again) missingLangs(m.again).forEach((l) => problems.push(`${code} -> ${m.to} again ${l}`));
        });
    }
    assert.deepEqual(problems, []);
});

test('nationality lists name known countries', () => {
    const known = new Set(Object.keys(countries.en));
    const problems = [];
    for (const [name, list] of Object.entries(groups)) list.filter((c) => !known.has(c)).forEach((c) => problems.push(`${name}: ${c}`));
    const refs = (value) => (typeof value === 'string' ? (groups[value] ? [] : [value]) : value || []);
    for (const [code, v] of Object.entries(visas)) {
        refs(v.countries).filter((c) => !known.has(c)).forEach((c) => problems.push(`${code}: ${c}`));
        (v.notes || []).forEach((n) => refs(n.countries).filter((c) => !known.has(c)).forEach((c) => problems.push(`${code} note: ${c}`)));
        moves(code).forEach((m) => refs(m.abroadFor).filter((c) => !known.has(c)).forEach((c) => problems.push(`${code} -> ${m.to}: ${c}`)));
    }
    assert.deepEqual(problems, []);
    assert.deepEqual(groups.visaWaiver.filter((c) => groups.visaFree.includes(c)), []);
    assert.deepEqual(groups.h1NoChange.filter((c) => !groups.h1.includes(c)), []);
});

// The official lists say how a status can be reached: 'change' inside Korea, 'abroad' at an
// embassy, and 'within' for moves between sub-statuses of one status.
const targets = docs.targets;
const within = docs.within || {};
// Statuses whose rules the manuals describe without a document list of their own.
const UNLISTED = ['F-5-14', 'F-5-27', 'F-5-6R'];
// Routes the manuals document but whose list hasn't been copied into data/visadocs.yaml yet:
// the moves stay (they are verified in visa-map-audit/round2), the docs page shows no list.
const NOT_COPIED = {
    change: ['E-7-Y'], // 외국인체류 안내매뉴얼 2026.9.18 › 38 › Ⅲ.2 국내성장인력(E-7-Y) › 체류자격 변경
    abroad: ['F-1', 'D-4-2'], // 사증발급 안내매뉴얼 2026.9.1 › 방문동거(F-1); › 일반연수(D-4) D-4-2 section
};
// Visa-free entries: no visa is issued for them.
const VISA_FREE = ['B-1', 'B-2'];

test('a move inside Korea goes to a visa the manual lets you change to there', () => {
    const problems = allMoves().filter((m) => m.from !== 'NONE' && !m.abroad && !m.abroadFor && !visas[m.from].abroad)
        .filter((m) => !UNLISTED.includes(m.to) && !NOT_COPIED.change.includes(m.to))
        .filter((m) => {
            const rule = within[`${m.from}>${m.to}`];
            if (rule) return rule.use === 'abroad';
            return !(targets[m.to] && targets[m.to].change);
        })
        .map((m) => `${m.from} -> ${m.to}`);
    assert.deepEqual(problems, []);
});

test('a move from abroad goes to a visa an embassy issues', () => {
    const problems = allMoves().filter((m) => m.from === 'NONE' || m.abroad)
        .filter((m) => !UNLISTED.includes(m.to) && !NOT_COPIED.abroad.includes(m.to) && !VISA_FREE.includes(m.to))
        .filter((m) => !(targets[m.to] && targets[m.to].abroad))
        .map((m) => `${m.from} -> ${m.to}`);
    assert.deepEqual(problems, []);
});

test('every visa can be reached from "no visa yet", or from a status the map offers only as a start', () => {
    // startOnly: statuses held only by people already in them (closed to new applicants, granted
    // by a decision of the Ministry), so the map offers them only as a current visa.
    const starts = ['NONE', ...(map.startOnly || [])];
    starts.forEach((code) => assert.ok(visas[code], `startOnly names unknown ${code}`));
    const reached = new Set(starts);
    const queue = [...starts];
    while (queue.length) moves(queue.shift()).forEach((m) => !reached.has(m.to) && reached.add(m.to) && queue.push(m.to));
    assert.deepEqual(Object.keys(visas).filter((c) => !reached.has(c)), []);
});

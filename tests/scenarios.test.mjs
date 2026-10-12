// Readers walking real paths through data/visamap.yaml: what the map remembers about them on
// the way, and the income each F-2 / F-5 step asks of them, including the reductions.
// Amounts are in ₩ million, on the GNI the data names (2025: ₩52.416M per person).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { visaRules } from '../assets/js/visa/rules.js';

const data = load(readFileSync(new URL('../data/visamap.yaml', import.meta.url), 'utf8'));
const rules = visaRules(data);
const GNI = data.gni.krw;
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);

// The reader's options after `path`, as the page lists them.
function options(person, path) {
    return rules.nextSteps(person, path, path.length).map((step) => ({ step, ...rules.assess(person, path, path.length, step) }));
}
function option(person, path, to) {
    const found = options(person, path).find((o) => o.step.to === to);
    assert.ok(found, `${path.join(' > ')} does not offer ${to}`);
    return found;
}
const income = (person, path, to) => option(person, path, to).income;
const uz = (details = {}) => ({ nationality: 'UZ', age: 30, ...details });

test('the GNI figure is the one immigration applies from April 2026', () => {
    assert.deepEqual(data.gni, { year: 2025, krw: 52.416 });
});

// ---------- Memory of the answers and the path ----------

test('years of work on the path count: Top-Tier is "not yet", not closed, after a professional job', () => {
    const reader = uz({ age: 24, edu: 3, eduKorea: false, experience: 0 });
    const r = option(reader, ['NONE', 'E-7-1'], 'F-2-T');
    assert.equal(r.blocked, false);
    assert.equal(r.later, true);
    assert.ok(r.tags.some((t) => t.key === 'laterExperience'));
});

test('a Korean degree earned on the path opens professional work for a high-school reader', () => {
    const reader = uz({ age: 19, edu: 1, eduKorea: false, experience: 0 });
    assert.equal(option(reader, ['NONE'], 'E-7-1').blocked, true);
    assert.equal(option(reader, ['NONE', 'D-2-2', 'D-10-1'], 'E-7-1').blocked, false);
});

test('a 17-year-old is old enough for permanent residence by the time a Korean degree is done', () => {
    const reader = uz({ age: 17, edu: 1 });
    const r = option(reader, ['NONE', 'D-2-2', 'D-10-1', 'E-7-1'], 'F-5-1');
    assert.equal(r.blocked, false);
    assert.ok(r.age[0] >= 19);
});

test('Korean below the required level is "not yet", with the level named', () => {
    const reader = uz({ edu: 3, kiip: 0 });
    const r = option(reader, ['NONE', 'E-7-1', 'F-2-7'], 'F-5-16');
    assert.equal(r.blocked, false);
    assert.equal(r.korean, 'later');
    assert.ok(r.tags.some((t) => t.key === 'langNeed'));
});

// ---------- Income ----------

test('F-5-1: household income of 2× GNI, at least half of it the reader\'s own', () => {
    const path = ['NONE', 'E-7-1'];
    const at = (amount) => income(uz({ edu: 3, income: amount }), path, 'F-5-1');
    near(at(0).amount, 2 * GNI);
    assert.equal(at(0).whose, 'household');
    assert.equal(at(2 * GNI).result, 'yes');
    assert.equal(at(GNI).result, 'maybe'); // family income may make up the rest
    assert.equal(at(GNI - 0.1).result, 'later');
    // No reduction applies to F-5-1, whatever the reader's Korean or degree.
    const strong = income(uz({ edu: 3, eduKorea: true, kiip: 5 }), path, 'F-5-1');
    assert.equal(strong.cut, null);
    assert.deepEqual(strong.maybe, []);
});

test('F-5-16: the reader\'s own income of 2× GNI; family income doesn\'t count', () => {
    const r = income(uz({ edu: 3, income: 60 }), ['NONE', 'E-7-1', 'F-2-7'], 'F-5-16');
    near(r.amount, 2 * GNI);
    assert.equal(r.whose, 'own');
    assert.equal(r.result, 'later');
});

const ethnicKorean = (details) => uz({ korean: true, ...details });

test('F-5-6: 1× GNI household income for overseas Koreans, with no reduction by default', () => {
    const r = income(ethnicKorean({ edu: 3, eduKorea: false, kiip: 0 }), ['NONE', 'F-4'], 'F-5-6');
    near(r.amount, GNI);
    assert.equal(r.cut, null);
    // Volunteering is not asked, so the 80% reduction is listed as possible; the Korean ones are ruled out.
    assert.deepEqual(r.maybe.map((c) => c.id), ['volunteer']);
});

test('F-5-6: 70% with KIIP 5, or with a Korean bachelor\'s', () => {
    const kiip = income(ethnicKorean({ kiip: 5, edu: 1, eduKorea: false }), ['NONE', 'F-4'], 'F-5-6');
    near(kiip.amount, 0.7 * GNI);
    assert.equal(kiip.cut.id, 'koreanSkill');
    const degree = income(ethnicKorean({ edu: 3, eduKorea: true }), ['NONE', 'F-4'], 'F-5-6');
    near(degree.amount, 0.7 * GNI);
    // A Korean college diploma is not a bachelor's.
    const college = income(ethnicKorean({ edu: 2, eduKorea: true, kiip: 3 }), ['NONE', 'F-4'], 'F-5-6');
    near(college.amount, GNI);
});

test('F-5-6: with the Korean condition met, volunteering would lower it to 60%, not 56%', () => {
    const r = income(ethnicKorean({ kiip: 5 }), ['NONE', 'F-4'], 'F-5-6');
    assert.deepEqual(r.maybe.map((c) => c.id), ['koreanSkillVolunteer']);
    assert.equal(r.maybe[0].factor, 0.6);
});

test('F-5-6: a Korean degree earned on the path counts for the reduction', () => {
    const reader = ethnicKorean({ edu: 1, eduKorea: false, kiip: 0 });
    const path = ['NONE', 'D-2-2', 'D-10-1'];
    const offers = options(reader, path).map((o) => o.step.to);
    if (!offers.includes('F-4')) return; // the reduction needs a D-10-1 > F-4 move in the data
    near(income(reader, [...path, 'F-4'], 'F-5-6').amount, 0.7 * GNI);
});

test('F-2-R: 70% of GNI, or no income test with a Korean college degree', () => {
    const path = ['NONE', 'D-2-2', 'D-10-1'];
    const graduate = income(uz({ edu: 1, income: 0 }), path, 'F-2-R');
    assert.equal(graduate.amount, 0);
    assert.equal(graduate.result, 'yes');
    const worker = income(uz({ edu: 3, eduKorea: false, income: 30 }), ['NONE', 'E-7-1'], 'F-2-R');
    near(worker.amount, 0.7 * GNI);
    assert.equal(worker.result, 'later');
});

test('F-2-99: the reader\'s own income of a fixed ₩40M', () => {
    const r = income(uz({ edu: 3, income: 40 }), ['NONE', 'E-7-1'], 'F-2-99');
    assert.equal(r.amount, 40);
    assert.equal(r.whose, 'own');
    assert.equal(r.result, 'yes');
});

test('an income below the requirement marks the option "not yet", never hides it', () => {
    const r = option(uz({ edu: 3, income: 10 }), ['NONE', 'E-7-1'], 'F-5-1');
    assert.equal(r.blocked, false);
    assert.equal(r.later, true);
    assert.ok(r.tags.some((t) => t.key === 'laterIncome'));
});

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

test('F-5-1: household income of 2× GNI, or 1.5× the average household net assets', () => {
    const path = ['NONE', 'E-7-1'];
    const at = (amount) => income(uz({ edu: 3, income: amount }), path, 'F-5-1');
    near(at(0).amount, 2 * GNI);
    assert.equal(at(0).whose, 'household');
    assert.equal(at(2 * GNI).result, 'yes');
    assert.equal(at(GNI).result, 'maybe'); // family income may make up the rest
    near(at(0).assets.amount, 1.5 * data.netAssets.average);
    // No reduction applies to F-5-1, whatever the reader's Korean or degree.
    const strong = income(uz({ edu: 3, koreanEdu: 3, kiip: 5 }), path, 'F-5-1');
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
    const r = income(ethnicKorean({ edu: 3, koreanEdu: 0, kiip: 0 }), ['NONE', 'F-4'], 'F-5-6');
    near(r.amount, GNI);
    assert.equal(r.cut, null);
    // Volunteering is not asked, so the 80% reduction is listed as possible; the Korean ones are ruled out.
    assert.deepEqual(r.maybe.map((c) => c.id), ['volunteer']);
});

test('F-5-6: 70% with KIIP 5, or with a Korean bachelor\'s', () => {
    const kiip = income(ethnicKorean({ kiip: 5, edu: 1, koreanEdu: 0 }), ['NONE', 'F-4'], 'F-5-6');
    near(kiip.amount, 0.7 * GNI);
    assert.equal(kiip.cut.id, 'koreanSkill');
    const degree = income(ethnicKorean({ edu: 3, koreanEdu: 3 }), ['NONE', 'F-4'], 'F-5-6');
    near(degree.amount, 0.7 * GNI);
    // A Korean college diploma is not a bachelor's.
    const college = income(ethnicKorean({ edu: 2, koreanEdu: 2, kiip: 3 }), ['NONE', 'F-4'], 'F-5-6');
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

test('F-2-R: the regional living wage is not a GNI rule, so no amount is computed', () => {
    assert.equal(income(uz({ edu: 3 }), ['NONE', 'E-7-1'], 'F-2-R'), null);
});

test('F-5-6: at least half of the household income must be the reader\'s own', () => {
    const at = (amount) => income(ethnicKorean({ kiip: 0, edu: 1, koreanEdu: 0, income: amount }), ['NONE', 'F-4'], 'F-5-6');
    assert.equal(at(GNI / 2).result, 'maybe');
    assert.equal(at(GNI / 2 - 0.1).result, 'later');
    near(at(0).assets.amount, data.netAssets.average);
    assert.equal(at(0).assets.own, true);
});

test('F-5-2: 80% when raising a child or from age 60, and other grounds the map doesn\'t ask', () => {
    const path = ['NONE', 'F-6-1'];
    near(income(uz({ koreanChild: true }), path, 'F-5-2').amount, 0.8 * GNI);
    near(income(uz({ age: 61, koreanChild: false }), path, 'F-5-2').amount, 0.8 * GNI);
    const r = income(uz({ age: 30, koreanChild: false }), path, 'F-5-2');
    near(r.amount, GNI);
    assert.deepEqual(r.maybe.map((c) => c.id), ['marriageRelief']); // pregnancy, infertility, the spouse's parents
});

test('a sponsor\'s income is shown, never compared with the reader\'s', () => {
    const r = income(uz({ income: 0 }), ['NONE'], 'F-6-1');
    assert.equal(r.whose, 'sponsor');
    assert.equal(r.result, 'maybe');
    assert.equal(r.amount, 25.195752);
    assert.equal(income(uz({ koreanChild: true }), ['NONE'], 'F-6-1').amount, 0); // a child together
    const f23 = income(uz({ income: 0 }), ['NONE'], 'F-2-3');
    near(f23.amount, GNI);
    assert.deepEqual(f23.maybe.map((c) => c.id), ['smallHousehold']);
});

test('Top-Tier: 3× GNI from abroad, 2× GNI as a change after work in Korea', () => {
    near(income(uz({ edu: 4, rank: 3 }), ['NONE'], 'F-2-T').amount, 3 * GNI);
    near(income(uz({ edu: 4, rank: 3 }), ['NONE', 'E-7-1'], 'F-2-T').amount, 2 * GNI);
});

test('a Korean diploma meets the Korean requirement of F-2-99', () => {
    const r = option(uz({ edu: 3, koreanEdu: 3, kiip: 0 }), ['NONE', 'E-7-1'], 'F-2-99');
    assert.equal(r.korean, 'yes');
    assert.equal(option(uz({ edu: 3, koreanEdu: 0, kiip: 0 }), ['NONE', 'E-7-1'], 'F-2-99').korean, 'later');
});

test('F-2-99: the reader\'s own income of a fixed ₩40M', () => {
    const r = income(uz({ edu: 3, income: 40 }), ['NONE', 'E-7-1'], 'F-2-99');
    assert.equal(r.amount, 40);
    assert.equal(r.whose, 'own');
    assert.equal(r.result, 'yes');
});

test('an income below the requirement marks the option "not yet", never hides it', () => {
    const r = option(uz({ edu: 3, income: 10 }), ['NONE', 'E-7-1', 'F-2-7'], 'F-5-16');
    assert.equal(r.blocked, false);
    assert.equal(r.later, true);
    assert.ok(r.tags.some((t) => t.key === 'laterIncome'));
});

test('a Korean bachelor\'s and a foreign doctorate is not a Korean doctorate', () => {
    const reader = uz({ age: 35, edu: 5, koreanEdu: 3, stem: true, rank: 3 });
    const r = option(reader, ['NONE', 'E-7-1'], 'F-5-15');
    assert.equal(r.blocked, true);
    assert.deepEqual(r.reasons, [{ key: 'why', fact: 'koreanEdu' }]);
    // Leaving the Korean part unanswered keeps it open.
    assert.equal(option(uz({ age: 35, edu: 5 }), ['NONE', 'E-7-1'], 'F-5-15').blocked, false);
});

test('a marriage migrant who left the spouse question blank can still plan F-6-2 and F-6-3', () => {
    assert.equal(option(uz(), ['NONE', 'F-6-1'], 'F-6-3').blocked, false);
    assert.equal(option(uz({ koreanChild: true }), ['NONE', 'F-6-1'], 'F-6-2').blocked, false);
});

test('a blocked option names what the reader can change, not a narrow alternative they can\'t', () => {
    const r = option(uz({ age: 35, edu: 1, koreanEdu: 0, experience: 0 }), ['NONE'], 'E-7-1');
    assert.equal(r.blocked, true);
    const facts = r.reasons.map((x) => x.fact);
    assert.ok(!facts.includes('countries') && !facts.includes('ageUnder'), facts.join(','));
});

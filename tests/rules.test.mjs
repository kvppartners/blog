// How the Visa map rules read requirements and the path, on a small made-up map, so each
// rule can be checked on its own. Run with `npm test` in tests/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visaRules } from '../assets/js/visa/rules.js';

const MAP = {
    groups: { notified: ['UZ', 'VN'] },
    statusGroups: { work: ['E-7', 'F-2'] },
    gni: { year: 2025, krw: 50 },
    incomeCuts: {
        kiip: { factor: 0.7, when: { kiip: 5 }, text: 'KIIP 5' },
        degree: { factor: 0.8, when: { koreanEdu: 3 }, text: 'Korean degree' },
        young: { factor: 0.9, when: { ageUnder: 30 }, text: 'under 30' },
        region: { factor: 0.5, text: 'living in a depopulating area' },
        school: { factor: 0, when: [{ koreanEdu: 2 }, { kiip: 5, ageUnder: 30 }], text: 'a Korean degree' },
    },
    visas: {
        NONE: { next: ['D-2-2', 'D-10-1', 'E-7-1', 'E-9', 'F-6-1', { to: 'F-5-1', needs: {} }] },
        'D-2-2': { years: [4, 6], gives: { edu: 3, koreanEdu: 3 }, next: ['D-10-1', 'E-7-1'] },
        'D-10-1': { years: [0, 2], next: ['E-7-1', 'F-5-1', 'F-2-R'] },
        'D-10-2': { years: [0, 1], next: ['D-10-1'] },
        'E-9': { years: [0, 4.8], work: true, next: ['D-10-1', 'E-7-4'] },
        'E-7-1': {
            work: true,
            needs: [{ edu: 3 }, { experience: 5 }],
            next: ['F-2-7', 'F-5-1', 'D-10-1', 'F-2-T', 'F-5-13'],
        },
        'E-7-4': { work: true, next: [] },
        'F-2-7': { work: true, income: { gni: 1 }, next: ['F-5-1', 'F-2-T', 'F-5-2', 'F-2-R'] },
        'F-5-2': { income: { gni: 1, household: true } },
        'F-2-T': { needs: { experience: 5 }, next: [] },
        'F-2-R': { needs: { notAfter: ['E-9', 'D-3'] }, income: { gni: 0.7, cuts: ['school'] }, next: [] },
        'F-6-1': { needs: { spouse: 'korean' }, next: [] },
        'F-5-1': {
            age: [19],
            needs: { stay: { years: 5, in: 'work' } },
            lang: { kiip: 5 },
            income: { gni: 2, cuts: ['kiip', 'degree', 'young', 'region'], floor: 0.6 },
        },
        'F-5-13': { age: [60] },
    },
};

const rules = visaRules(MAP);
const reader = (details = {}) => ({ nationality: 'UZ', age: 25, ...details });
const step = (path, to) => rules.nextSteps(reader(), path, path.length).find((s) => s.to === to);
const check = (person, path, to) => rules.assess(person, path, path.length, step(path, to));

test('an unanswered detail never blocks an option', () => {
    const r = check(reader(), ['NONE'], 'F-6-1');
    assert.equal(r.blocked, false);
    assert.equal(check(reader({ spouse: 'none' }), ['NONE'], 'F-6-1').blocked, true);
});

test('every first visa is applied for from abroad', () => {
    assert.ok(rules.nextSteps(reader(), ['NONE'], 1).every((s) => s.abroad));
    assert.equal(step(['D-2-2'], 'D-10-1').abroad, false);
});

test('a degree from the path counts for later steps', () => {
    const person = reader({ edu: 1, experience: 0 });
    assert.equal(check(person, ['NONE'], 'E-7-1').blocked, true);
    assert.equal(check(person, ['NONE', 'D-2-2', 'D-10-1'], 'E-7-1').blocked, false);
});

test('years of work on the path count as experience, as "not yet" until they are there', () => {
    const person = reader({ edu: 3, experience: 0 });
    // Right after starting E-7-1 the reader has no experience, but can stay on it for years.
    const r = check(person, ['NONE', 'E-7-1'], 'F-2-T');
    assert.equal(r.blocked, false);
    assert.equal(r.later, true);
    assert.deepEqual(r.tags.find((t) => t.key === 'laterExperience'), { key: 'laterExperience', years: 5, later: true });
    // A reader who already has the years gets it straight away.
    assert.equal(check(reader({ edu: 3, experience: 5 }), ['NONE', 'E-7-1'], 'F-2-T').later, false);
});

test('a job seeker visa with a time limit cannot make up missing years', () => {
    const person = reader({ edu: 3, experience: 0 });
    assert.equal(rules.assess(person, ['NONE', 'D-10-1'], 2, { to: 'F-2-T' }).blocked, true);
});

test('years on the right visas: the path must be able to give them', () => {
    const person = reader({ edu: 3 });
    // No visa yet > job seeker (at most 2 years, not a work visa) > permanent residence: impossible.
    const r = check(person, ['NONE', 'D-10-1'], 'F-5-1');
    assert.equal(r.blocked, true);
    assert.deepEqual(r.reasons, [{ key: 'why', fact: 'stay' }]);
    // After E-7-1, which can be extended, it is possible.
    assert.equal(check(person, ['NONE', 'D-2-2', 'D-10-1', 'E-7-1'], 'F-5-1').blocked, false);
    // Starting from a visa the reader holds today, the years before it are unknown: not blocked.
    assert.equal(check(person, ['D-10-1'], 'F-5-1').blocked, false);
});

test('a move\'s own empty needs lifts the visa\'s requirements', () => {
    assert.equal(check(reader(), ['NONE'], 'F-5-1').blocked, false);
});

test('a visa that may not come right before is found past sub-statuses of one status', () => {
    const person = reader();
    assert.equal(check(person, ['NONE', 'E-9', 'D-10-1'], 'F-2-R').blocked, true);
    // Hopping D-10-1 > D-10-2 > D-10-1 doesn't wash the E-9 away.
    const path = ['NONE', 'E-9', 'D-10-1', 'D-10-2', 'D-10-1'];
    assert.equal(rules.assess(person, path, path.length, { to: 'F-2-R', needs: MAP.visas['F-2-R'].needs }).blocked, true);
    // Unknown for the visa the reader holds today.
    assert.equal(check(person, ['D-10-1'], 'F-2-R').blocked, false);
});

test('age gates use the reader\'s age when they get there', () => {
    const teen = reader({ age: 17, edu: 1 });
    // A bachelor's in Korea takes at least 4 years: 21 by then.
    const path = ['NONE', 'D-2-2', 'D-10-1', 'E-7-1'];
    const r = check(teen, path, 'F-5-1');
    assert.equal(r.blocked, false);
    assert.equal(r.tags.some((t) => t.key === 'laterAge'), false);
    assert.deepEqual(r.age, [21, Infinity]);
    // On E-7-1 at 17: permanent residence from 19, by staying on it.
    const now = rules.assess(teen, ['E-7-1'], 1, { to: 'F-5-1' });
    assert.equal(now.blocked, false);
    assert.deepEqual(now.tags.find((t) => t.key === 'laterAge'), { key: 'laterAge', age: 19, later: true });
    assert.equal(check(teen, ['NONE', 'E-7-1'], 'F-5-13').blocked, false);
    // Waiting abroad is not a path: with no visa yet, today's age counts.
    assert.deepEqual(rules.assess(teen, ['NONE'], 1, { to: 'F-5-13' }).reasons, [{ key: 'ageOnly', range: '60+' }]);
    // An upper limit counts the shortest time the path takes.
    assert.deepEqual(rules.assess(reader({ age: 16 }), ['NONE', 'D-2-2'], 2, { to: 'F-2-7', needs: { ageUnder: 20 } }).reasons,
        [{ key: 'why', fact: 'ageUnder' }]);
});

test('Korean below the level a step needs is "not yet", never blocked', () => {
    const r = check(reader({ edu: 3, kiip: 2 }), ['NONE', 'E-7-1'], 'F-5-1');
    assert.equal(r.blocked, false);
    assert.equal(r.korean, 'later');
    assert.equal(r.later, true);
    assert.equal(check(reader({ edu: 3, kiip: 5 }), ['NONE', 'E-7-1'], 'F-5-1').korean, 'yes');
    assert.equal(check(reader({ edu: 3 }), ['NONE', 'E-7-1'], 'F-5-1').korean, 'maybe');
});

test('when no alternative fits, every fact in the way is named', () => {
    const r = check(reader({ edu: 1, experience: 0 }), ['NONE'], 'E-7-1');
    assert.deepEqual(r.reasons.map((x) => x.fact).sort(), ['edu', 'experience']);
});

test('income: the base is a multiple of GNI per person', () => {
    const income = rules.incomeFor(reader({ age: 40 }), ['NONE', 'E-7-1'], 2, step(['NONE', 'E-7-1'], 'F-5-1'));
    assert.equal(income.base, 100);
    assert.equal(income.amount, 100);
    assert.equal(income.cut, null);
    assert.equal(income.result, 'maybe');
    // A reduction that depends on something the map doesn't ask is listed as possible.
    assert.deepEqual(income.maybe.map((c) => c.id), ['kiip', 'degree', 'region']);
});

test('income: the largest reduction that applies counts, never below the floor', () => {
    const path = ['NONE', 'E-7-1'];
    const to = step(path, 'F-5-1');
    // KIIP 5 completed: 70%.
    assert.equal(rules.incomeFor(reader({ age: 40, kiip: 5 }), path, 2, to).amount, 70);
    // KIIP 5 and a Korean bachelor's: the bigger cut (70%) wins, they don't add up.
    const both = rules.incomeFor(reader({ age: 40, kiip: 5, edu: 3, eduKorea: true }), path, 2, to);
    assert.equal(both.amount, 70);
    assert.equal(both.cut.id, 'kiip');
    // Under 30 with nothing else: 90%.
    assert.equal(rules.incomeFor(reader({ age: 25, kiip: 0, edu: 3, eduKorea: false }), path, 2, to).amount, 90);
    // A degree from the path counts, like any other fact.
    const viaSchool = ['NONE', 'D-2-2', 'D-10-1', 'E-7-1'];
    assert.equal(rules.incomeFor(reader({ age: 40, kiip: 0, edu: 1 }), viaSchool, 4, step(viaSchool, 'F-5-1')).amount, 80);
});

test('income: enough, not yet, or unknown', () => {
    const path = ['NONE', 'E-7-1'];
    const to = step(path, 'F-5-1');
    assert.equal(rules.incomeFor(reader({ age: 40, kiip: 5, income: 70 }), path, 2, to).result, 'yes');
    const low = reader({ age: 40, kiip: 5, income: 69.9 });
    assert.equal(rules.incomeFor(low, path, 2, to).result, 'later');
    const r = rules.assess(low, path, 2, to);
    assert.equal(r.blocked, false);
    assert.deepEqual(r.tags.find((t) => t.key === 'laterIncome'), { key: 'laterIncome', amount: 70, later: true });
});

test('income: a move without its own rule uses the visa\'s', () => {
    const income = rules.incomeFor(reader(), ['NONE', 'E-7-1'], 2, step(['NONE', 'E-7-1'], 'F-2-7'));
    assert.equal(income.base, 50);
    assert.equal(rules.incomeFor(reader(), ['NONE'], 1, step(['NONE'], 'E-9')), null);
});

test('income: household income counts, but the reader\'s own share must be at least half', () => {
    const path = ['NONE', 'E-7-1', 'F-2-7'];
    const to = step(path, 'F-5-2');
    const at = (income) => rules.incomeFor(reader({ income }), path, 3, to);
    assert.equal(at(50).result, 'yes');
    assert.equal(at(25).result, 'maybe'); // the family's income may make up the rest
    assert.equal(at(24.9).result, 'later');
    assert.equal(at(25).whose, 'household');
});

test('income: a reduction can waive the test, on any one of its conditions', () => {
    const path = ['NONE', 'E-7-1', 'F-2-7'];
    const to = step(path, 'F-2-R');
    const degree = rules.incomeFor(reader({ edu: 2, eduKorea: true, income: 0 }), path, 3, to);
    assert.equal(degree.amount, 0);
    assert.equal(degree.result, 'yes');
    assert.equal(rules.incomeFor(reader({ kiip: 5, age: 25, income: 0 }), path, 3, to).result, 'yes');
    // KIIP 5 alone is not one of the conditions.
    const older = rules.incomeFor(reader({ kiip: 5, age: 40, edu: 1, income: 0 }), path, 3, to);
    assert.equal(older.amount, 35);
    assert.equal(older.result, 'later');
    // Not knowing the education leaves the waiver open.
    assert.deepEqual(rules.incomeFor(reader({ age: 40 }), path, 3, to).maybe.map((c) => c.id), ['school']);
});

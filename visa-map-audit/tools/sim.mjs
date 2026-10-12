// The Visa map's option logic for the audit scripts: it runs the page's own rules
// (assets/js/visa/rules.js) on data/visamap.yaml, so it can't drift from the page.
// Needs js-yaml: `npm install js-yaml` in this folder.
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { visaRules } from '../../assets/js/visa/rules.js';
import { isGoal } from '../../assets/js/visa/shared.js';

export const data = load(readFileSync(new URL('../../data/visamap.yaml', import.meta.url), 'utf8'));
export const { visas, groups } = data;
export { isGoal };
export const rules = visaRules(data);

// A reason as a short word: the fact behind it, or its kind (ageOnly, notForNationality).
const word = (reason) => (reason.key === 'why' ? reason.fact : reason.key);

// The options the page offers at step `level` of `path` for `person`, with the check behind each.
export function options(person, path, level) {
    return rules.nextSteps(person, path, level).map((step) => {
        const check = rules.assess(person, path, level, step);
        return { to: step.to, step, check: { ...check, reasons: check.reasons.map(word) } };
    });
}

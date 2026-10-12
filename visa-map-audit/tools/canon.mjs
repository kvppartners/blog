// For every edge, build the minimal reader who legitimately holds the SOURCE visa (satisfying
// the source's own needs and age, plus whatever the source 'gives'), then ask the engine whether
// the TARGET is offered. A target blocked for the canonical holder of the source is a suspect edge.
import { options, visas, groups } from './sim.mjs';

const LEVELS = ['edu', 'koreanEdu', 'rank', 'experience', 'invest'];

function canonical(code, nationality) {
    const v = visas[code] || {};
    const p = { nationality, age: 30 };
    const age = v.age || (v.ageByCountry && v.ageByCountry[nationality]);
    if (age) p.age = Math.max(19, age[0] + (age[1] ? Math.min(2, age[1] - age[0]) : 2));
    if (v.ageByCountry && v.ageByCountry[nationality]) p.age = Math.max(19, v.ageByCountry[nationality][0] + 1);
    // Satisfy the first needs alternative minimally.
    const first = [].concat(v.needs || [])[0] || {};
    Object.entries(first).forEach(([k, want]) => {
        if (k === 'ageUnder') p.age = Math.min(p.age, want - 1);
        else if (k === 'countries' || k === 'notAfter') { /* nationality handled by caller */ }
        else if (LEVELS.includes(k)) p[k] = want;
        else p[k] = Array.isArray(want) ? want[0] : want;
    });
    Object.entries(v.gives || {}).forEach(([k, want]) => {
        if (LEVELS.includes(k)) p[k] = Math.max(p[k] || 0, want);
        else if (p[k] === undefined) p[k] = want;
    });
    if (p.edu !== undefined) { p.eduKorea = (p.koreanEdu || 0) >= p.edu; p.stem = Boolean(p.stem); }
    return p;
}

const nats = { generic: 'UZ', alt: 'US' };
const rows = [];
for (const code of Object.keys(visas)) {
    if (code === 'NONE') continue;
    for (const [tag, nat] of Object.entries(nats)) {
        const v = visas[code];
        if (v.countries && !(groups[v.countries] || [].concat(v.countries)).includes(nat)) continue;
        const person = canonical(code, nat);
        const opts = options(person, [code], 1);
        const blocked = opts.filter((o) => o.check.blocked);
        if (blocked.length) {
            rows.push({ code, tag, nat, age: person.age, blocked: blocked.map((b) => `${b.to}(${b.check.reasons.join('+')})`) });
        }
    }
}
const seen = new Set();
console.log('# Targets blocked for the canonical holder of the source visa\n');
for (const r of rows) {
    const key = `${r.code}|${r.blocked.join(',')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    console.log(`${r.code} [${r.nat} age ${r.age}] -> ${r.blocked.join('  ')}`);
}

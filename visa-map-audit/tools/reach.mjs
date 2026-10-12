import { options, visas, isGoal } from './sim.mjs';

// Breadth-first over OPEN options only, as the page would offer them, to find starts from
// which a persona can never reach any F-5, and dead ends with no open option at all.
function explore(person, start, maxDepth = 6) {
    let frontier = [[start]];
    const seen = new Set([start]);
    const deadEnds = [];
    for (let depth = 1; depth <= maxDepth; depth++) {
        const next = [];
        for (const path of frontier) {
            const last = path[path.length - 1];
            if (isGoal(last)) return { reached: true, path };
            const opts = options(person, path, path.length);
            const open = opts.filter((o) => !o.check.blocked);
            if (!open.length) deadEnds.push(path.join(' > '));
            for (const o of open) {
                if (isGoal(o.to)) return { reached: true, path: [...path, o.to] };
                if (!seen.has(o.to)) { seen.add(o.to); next.push([...path, o.to]); }
            }
        }
        frontier = next;
        if (!frontier.length) break;
    }
    return { reached: false, deadEnds: deadEnds.slice(0, 3) };
}

const PERSONAS = {
    'UZ 25, nothing answered': { nationality: 'UZ', age: 25 },
    'UZ 25, no education (edu 0)': { nationality: 'UZ', age: 25, edu: 0, eduKorea: false, stem: false },
    'UZ 30, high school only': { nationality: 'UZ', age: 30, edu: 1, eduKorea: false, stem: false, spouse: 'none', koreanChild: false, korean: false, experience: 0, invest: 0 },
    'US 28, bachelor, no money': { nationality: 'US', age: 28, edu: 3, eduKorea: false, stem: false, spouse: 'none', koreanChild: false, korean: false, experience: 0, invest: 0 },
    'VN 45, no education, no money': { nationality: 'VN', age: 45, edu: 0, eduKorea: false, stem: false, spouse: 'none', koreanChild: false, korean: false, experience: 0, invest: 0 },
    'CN 35 ethnic Korean': { nationality: 'CN', age: 35, korean: true, edu: 1, eduKorea: false, stem: false, spouse: 'none', koreanChild: false, experience: 0, invest: 0 },
};

const starts = Object.keys(visas).filter((c) => !isGoal(c));
for (const [label, person] of Object.entries(PERSONAS)) {
    const unreachable = [];
    const dead = [];
    for (const s of starts) {
        const r = explore(person, s);
        if (!r.reached) unreachable.push(s);
        if (r.deadEnds && r.deadEnds.length) dead.push(`${s}: ${r.deadEnds[0]}`);
    }
    console.log(`\n## ${label}`);
    console.log(`  cannot reach any F-5 from (${unreachable.length}): ${unreachable.join(' ') || '-'}`);
    console.log(`  dead ends (no open option) (${dead.length}): ${dead.slice(0, 12).join(' | ') || '-'}`);
}

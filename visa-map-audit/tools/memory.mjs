import { options } from './sim.mjs';

// A reader who answers honestly at the start, then plots a long career path. Does the engine
// take the path into account when it lists the next options?
const reader = {
    nationality: 'UZ', age: 24, edu: 3, eduKorea: false, stem: false, rank: undefined,
    spouse: 'none', koreanChild: false, korean: false, experience: 0, invest: 0,
};

const show = (label, path) => {
    const o = options(reader, path, path.length);
    const open = o.filter((x) => !x.check.blocked).map((x) => x.to);
    const blocked = o.filter((x) => x.check.blocked).map((x) => `${x.to}(${x.check.reasons.join('+')})`);
    console.log(`\n${label}`);
    console.log(`  path: ${path.join(' > ')}`);
    console.log(`  OPEN:    ${open.join(' ') || '-'}`);
    console.log(`  BLOCKED: ${blocked.join(' ') || '-'}`);
};

console.log('# Reader: UZ, 24, bachelor (not Korean, not STEM), no experience, no money, single');
show('Step 1 from no visa', ['NONE']);
show('Step 2 after taking E-7-1 (a professional job)', ['NONE', 'E-7-1']);
show('Step 3 after E-7-1 then F-2-7 (points resident)', ['NONE', 'E-7-1', 'F-2-7']);
console.log('\n# Same reader, but a long study path first');
show('After D-2-2 (Korean bachelor)', ['NONE', 'D-2-2']);
show('After D-2-2 > D-2-3 (Korean master)', ['NONE', 'D-2-2', 'D-2-3']);
console.log('\n# Does a decade of work ever grant experience? Compare the same step with experience answered as 5');
const veteran = { ...reader, experience: 5 };
for (const p of [['NONE', 'E-7-1'], ['NONE', 'E-7-1', 'F-2-7']]) {
    const a = options(reader, p, p.length).filter((x) => !x.check.blocked).map((x) => x.to);
    const b = options(veteran, p, p.length).filter((x) => !x.check.blocked).map((x) => x.to);
    const onlyVeteran = b.filter((x) => !a.includes(x));
    console.log(`  ${p.join(' > ')} -> options only the 5-year answer unlocks: ${onlyVeteran.join(' ') || '(none)'}`);
}

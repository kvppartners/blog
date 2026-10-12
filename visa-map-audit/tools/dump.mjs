// Writes graph.txt (the whole visa graph, English only) and money.txt (every money, income, GNI,
// asset, points or years statement) from data/visamap.yaml. Needs js-yaml: `npm install js-yaml`.
import { readFileSync, writeFileSync } from 'node:fs';
import { load } from 'js-yaml';

const data = load(readFileSync(new URL('../../data/visamap.yaml', import.meta.url), 'utf8'));
const { visas, groups, statuses } = data;
const json = (v) => JSON.stringify(v);
const moves = (code) => (visas[code].next || []).map((m) => (typeof m === 'string' ? { to: m } : m));

const g = ['GROUPS:', ...Object.entries(groups).map(([k, v]) => `  ${k}: ${v.join(',')}`), '',
    'STATUS GROUPS:', ...Object.entries(data.statusGroups || {}).map(([k, v]) => `  ${k}: ${v.join(',')}`), '',
    `GNI: ${json(data.gni)}  NET ASSETS: ${json(data.netAssets)}  START ONLY: ${(data.startOnly || []).join(',')}`, '',
    'INCOME CUTS:', ...Object.entries(data.incomeCuts || {}).map(([k, c]) => `  ${k}: factor ${c.factor} when ${json(c.when || null)} - ${c.text.en}`), '',
    'STATUS LABELS:', ...Object.entries(statuses).map(([k, v]) => `  ${k}: ${v.en}`), '', `VISAS (${Object.keys(visas).length}):`, ''];
for (const [code, v] of Object.entries(visas)) {
    g.push(`=== ${code} :: ${v.name.en}`, `  how: ${v.how.en}`);
    for (const key of ['age', 'ageByCountry', 'countries', 'needs', 'income', 'gives', 'lang', 'years', 'work']) {
        if (v[key] !== undefined) g.push(`  ${key}: ${json(v[key])}`);
    }
    (v.notes || []).forEach((n) => g.push(`  note[${json(n.countries)}]${n.abroad ? '[abroad]' : ''}: ${n.text.en}`));
    g.push(`  next (${moves(code).length}):`);
    for (const m of moves(code)) {
        const flags = [m.abroad && 'abroad', m.abroadFor && `abroadFor=${m.abroadFor}`, m.needs && `needs=${json(m.needs)}`,
            m.income && `income=${json(m.income)}`].filter(Boolean);
        g.push(`    -> ${m.to}${flags.length ? ` [${flags.join(' ')}]` : ''}`);
        if (m.note) g.push(`       note: ${m.note.en}`);
        if (m.again) g.push(`       again: ${m.again.en}`);
    }
    g.push('');
}
writeFileSync(new URL('./graph.txt', import.meta.url), `${g.join('\n')}\n`);

const money = /₩|\bGNI\b|income|asset|invest|points?\b|\byears?\b|salary|wage|pension|KRW|US\$|%/i;
const m = ['# Every money / income / GNI / asset / points / years statement in data/visamap.yaml (English text only).',
    '# Format: location | text', ''];
for (const [code, v] of Object.entries(visas)) {
    if (money.test(v.how.en)) m.push(`VISA ${code} how | ${v.how.en}`);
    for (const key of ['needs', 'income', 'years']) if (v[key] !== undefined) m.push(`VISA ${code} ${key} | ${json(v[key])}`);
    for (const mv of moves(code)) {
        if (mv.note && money.test(mv.note.en)) m.push(`EDGE ${code}->${mv.to} note | ${mv.note.en}`);
        if (mv.again && money.test(mv.again.en)) m.push(`EDGE ${code}->${mv.to} again | ${mv.again.en}`);
        if (mv.needs) m.push(`EDGE ${code}->${mv.to} needs | ${json(mv.needs)}`);
        if (mv.income) m.push(`EDGE ${code}->${mv.to} income | ${json(mv.income)}`);
    }
}
writeFileSync(new URL('./money.txt', import.meta.url), `${m.join('\n')}\n`);
console.log(`graph.txt: ${g.length} lines, money.txt: ${m.length} lines`);

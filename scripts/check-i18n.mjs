// Checks apps/web i18n dictionaries:
//  1. every dictionary group has the same keys in ru, ky and en;
//  2. no t('literal.key', ...) call in the app uses a key missing from the ru dictionaries.
// A t() call with a key missing everywhere silently shows its (usually Russian)
// fallback to ky/en users. Usage: node scripts/check-i18n.mjs [--report]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const web = path.join(root, 'apps/web');
const ts = createRequire(path.join(web, 'package.json'))('typescript');
const dictDir = path.join(web, 'src/app/_components/i18n/dictionaries');
const report = process.argv.includes('--report');

const LOCALES = ['Ru', 'Ky', 'En'];
const groups = new Map(); // base name -> { Ru: Set, Ky: Set, En: Set }

function propertyKey(name) {
    if (ts.isStringLiteral(name) || ts.isNumericLiteral(name) || ts.isIdentifier(name)) return name.text;
    return null;
}

for (const file of fs.readdirSync(dictDir).filter(f => f.endsWith('.ts') && f !== 'index.ts')) {
    const sf = ts.createSourceFile(file, fs.readFileSync(path.join(dictDir, file), 'utf8'), ts.ScriptTarget.Latest, true);
    for (const st of sf.statements) {
        if (!ts.isVariableStatement(st)) continue;
        for (const d of st.declarationList.declarations) {
            if (!ts.isIdentifier(d.name) || !d.initializer) continue;
            const m = d.name.text.match(/^(.*)(Ru|Ky|En)$/);
            let init = d.initializer;
            while (ts.isAsExpression(init) || ts.isSatisfiesExpression?.(init) || ts.isParenthesizedExpression(init)) init = init.expression;
            if (!m || !ts.isObjectLiteralExpression(init)) continue;
            const keys = new Set();
            for (const p of init.properties) {
                if (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) {
                    const k = propertyKey(p.name); if (k) keys.add(k);
                } else if (ts.isSpreadAssignment(p)) {
                    keys.add(`...${p.expression.getText(sf)}`);
                }
            }
            if (!groups.has(m[1])) groups.set(m[1], {});
            groups.get(m[1])[m[2]] = keys;
        }
    }
}

const failures = [];
let missingParityKeys = 0;
const allRu = new Set();
for (const [base, byLocale] of [...groups].sort()) {
    for (const k of byLocale.Ru ?? []) allRu.add(k);
    const union = new Set(LOCALES.flatMap(l => [...(byLocale[l] ?? [])]));
    for (const locale of LOCALES) {
        if (!byLocale[locale]) { failures.push(`${base}: no ${locale} dictionary`); continue; }
        const missing = [...union].filter(k => !byLocale[locale].has(k));
        missingParityKeys += missing.length;
        if (missing.length) failures.push(`${base}${locale}: missing ${missing.length} key(s): ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ', …' : ''}`);
    }
}

// Literal t('key', ...) calls whose key is in no ru dictionary.
const unknownKeys = new Map();
function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { if (!['__tests__', 'node_modules', 'generated'].includes(e.name)) walk(p); continue; }
        if (!/\.(ts|tsx)$/.test(e.name) || /\.test\.tsx?$/.test(e.name) || p.startsWith(dictDir)) continue;
        const text = fs.readFileSync(p, 'utf8');
        for (const m of text.matchAll(/\bt\(\s*['"]([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+)['"]/g)) {
            if (!allRu.has(m[1])) {
                const rel = path.relative(web, p).split(path.sep).join('/');
                if (!unknownKeys.has(m[1])) unknownKeys.set(m[1], rel);
            }
        }
    }
}
walk(path.join(web, 'src'));

console.log(`i18n: ${groups.size} dictionary groups, ${allRu.size} ru keys; keys missing in some locale: ${missingParityKeys}; t() keys missing from dictionaries: ${unknownKeys.size}.`);
if (report) {
    for (const f of failures) console.log(`  parity  ${f}`);
    for (const [k, f] of [...unknownKeys].sort()) console.log(`  missing ${k}  (${f})`);
}

// Ratchet (2026-11-16 baseline): both numbers may only go down. Lower them when
// translations are added; never raise them to let a change pass.
const MAX_MISSING_PARITY_KEYS = 59;
const MAX_UNKNOWN_KEYS = 242;
let failed = false;
if (missingParityKeys > MAX_MISSING_PARITY_KEYS) {
    failed = true;
    console.error(`  ${missingParityKeys} keys are missing in some locale (limit ${MAX_MISSING_PARITY_KEYS}):`);
    if (!report) for (const f of failures.slice(0, 20)) console.error(`    ${f}`);
}
if (unknownKeys.size > MAX_UNKNOWN_KEYS) {
    failed = true;
    console.error(`  ${unknownKeys.size} t() keys are missing from dictionaries (limit ${MAX_UNKNOWN_KEYS}); run with --report`);
}
if (failed) process.exit(1);

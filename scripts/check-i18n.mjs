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

// Every key is translated since 2026-11-17 (baseline was 59/242): a new t() key
// needs ru, ky and en entries in the same change. Never raise these limits.
const MAX_MISSING_PARITY_KEYS = 0;
const MAX_UNKNOWN_KEYS = 0;
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

// 3. Russian text in the UI that bypasses t() (FE-10): JSX text and string literals of .tsx files
// outside t() (a Cyrillic fallback of t('key', 'Текст') is a translation) and outside console and
// log calls. Each file may not have more than its baseline (scripts/i18n-untranslated-baseline.json),
// and a lower count must be written down with --write-baseline, so the gain is kept. The admin panel
// and the legal pages are the deliberate rest of the baseline.
const BASELINE_FILE = path.join(root, 'scripts', 'i18n-untranslated-baseline.json');
const CYRILLIC = /[А-Яа-яЁё]/;
const NOT_UI_CALLEE = /(^|\.)(t|tr|translate)$|^console\.|^(logDebug|logWarn|logError)$/;
function outsideTranslation(node) {
    for (let current = node.parent; current; current = current.parent) {
        if (ts.isCallExpression(current) && NOT_UI_CALLEE.test(current.expression.getText())) return false;
        if (ts.isJsxElement(current) || ts.isSourceFile(current)) return true;
    }
    return true;
}
const untranslated = new Map();
function scanUi(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { if (!['__tests__', 'node_modules', 'generated'].includes(e.name) && p !== dictDir) scanUi(p); continue; }
        if (!e.name.endsWith('.tsx') || /\.test\.tsx$/.test(e.name)) continue;
        const sf = ts.createSourceFile(p, fs.readFileSync(p, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
        const found = [];
        const visit = (node) => {
            let text = null;
            if (ts.isJsxText(node)) text = node.getText();
            else if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node))
                && !ts.isImportDeclaration(node.parent) && !ts.isExportDeclaration(node.parent) && outsideTranslation(node)) {
                text = node.getText();
            }
            if (text && CYRILLIC.test(text)) {
                found.push(`${sf.getLineAndCharacterOfPosition(node.getStart()).line + 1}: ${text.replace(/\s+/g, ' ').trim().slice(0, 80)}`);
            }
            ts.forEachChild(node, visit);
        };
        visit(sf);
        if (found.length) untranslated.set(path.relative(web, p).split(path.sep).join('/'), found);
    }
}
scanUi(path.join(web, 'src'));
const counts = Object.fromEntries([...untranslated].sort(([a], [b]) => a.localeCompare(b)).map(([file, found]) => [file, found.length]));
const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
if (process.argv.includes('--write-baseline')) {
    fs.writeFileSync(BASELINE_FILE, `${JSON.stringify(counts, null, 2)}\n`);
    console.log(`i18n: wrote the untranslated-text baseline: ${total} in ${Object.keys(counts).length} files.`);
} else {
    const baseline = fs.existsSync(BASELINE_FILE) ? JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')) : {};
    const grown = Object.entries(counts).filter(([file, n]) => n > (baseline[file] ?? 0));
    const shrunk = Object.entries(baseline).filter(([file, n]) => (counts[file] ?? 0) < n);
    console.log(`i18n: untranslated UI text: ${total} in ${Object.keys(counts).length} files (baseline ${Object.values(baseline).reduce((s, n) => s + n, 0)}).`);
    if (report) for (const [file, found] of untranslated) for (const line of found) console.log(`  text    ${file}:${line}`);
    if (grown.length) {
        failed = true;
        console.error('  Russian text outside t() grew; translate it (ru, ky and en dictionaries) or explain why not:');
        for (const [file, n] of grown) {
            console.error(`    ${file}: ${n} (baseline ${baseline[file] ?? 0})`);
            for (const line of (untranslated.get(file) ?? []).slice(0, 5)) console.error(`      ${line}`);
        }
    }
    if (shrunk.length) {
        failed = true;
        console.error(`  ${shrunk.length} file(s) have less untranslated text than the baseline; keep the gain: node scripts/check-i18n.mjs --write-baseline`);
    }
}
if (failed) process.exit(1);

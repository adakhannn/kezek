// Checks the i18n dictionaries of apps/web and apps/mobile:
//  1. every dictionary group has the same keys in ru, ky and en, and each value has the same
//     {placeholders} in all three;
//  2. no t('literal.key', ...) call in the app uses a key missing from the ru dictionaries;
//  3. Russian text that bypasses the translations grows in no file (see below);
//  4. no two server messages (server*.ts groups, FE-10) share their Russian text (web only).
// The mobile dictionaries live in apps/mobile/src/i18n/dictionaries (see the README there); their
// groups are reported with a "mobile:" prefix and their files in the baseline as apps/mobile/...
// A t() call with a key missing everywhere silently shows its (usually Russian)
// fallback to ky/en users. Usage: node scripts/check-i18n.mjs [--report] [--write-baseline]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const web = path.join(root, 'apps/web');
const ts = createRequire(path.join(web, 'package.json'))('typescript');
const dictDir = path.join(web, 'src/app/_components/i18n/dictionaries');
const mobile = path.join(root, 'apps/mobile');
const mobileDictDir = path.join(mobile, 'src/i18n/dictionaries');
const report = process.argv.includes('--report');

const LOCALES = ['Ru', 'Ky', 'En'];
const PLACEHOLDER = /\{([a-zA-Z][a-zA-Z0-9_]*)\}/g;

function propertyKey(name) {
    if (ts.isStringLiteral(name) || ts.isNumericLiteral(name) || ts.isIdentifier(name)) return name.text;
    return null;
}

// Dictionary groups of one directory: an object literal named <group>Ru, <group>Ky or <group>En.
// Assembly files (ru.ts, index.ts, ...) declare no such object and add nothing.
function collectGroups(dir) {
const groups = new Map(); // base name -> { Ru: Set, Ky: Set, En: Set }
const values = new Map(); // base name -> { Ru: Map(key -> text), ... } for plain string values
for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.ts') && f !== 'index.ts')) {
    const sf = ts.createSourceFile(file, fs.readFileSync(path.join(dir, file), 'utf8'), ts.ScriptTarget.Latest, true);
    for (const st of sf.statements) {
        if (!ts.isVariableStatement(st)) continue;
        for (const d of st.declarationList.declarations) {
            if (!ts.isIdentifier(d.name) || !d.initializer) continue;
            const m = d.name.text.match(/^(.*)(Ru|Ky|En)$/);
            let init = d.initializer;
            while (ts.isAsExpression(init) || ts.isSatisfiesExpression?.(init) || ts.isParenthesizedExpression(init)) init = init.expression;
            if (!m || !ts.isObjectLiteralExpression(init)) continue;
            const keys = new Set();
            const texts = new Map();
            for (const p of init.properties) {
                if (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) {
                    const k = propertyKey(p.name); if (k) keys.add(k);
                    if (k && ts.isPropertyAssignment(p) && (ts.isStringLiteral(p.initializer) || ts.isNoSubstitutionTemplateLiteral(p.initializer))) {
                        texts.set(k, p.initializer.text);
                    }
                } else if (ts.isSpreadAssignment(p)) {
                    keys.add(`...${p.expression.getText(sf)}`);
                }
            }
            if (!groups.has(m[1])) { groups.set(m[1], {}); values.set(m[1], {}); }
            groups.get(m[1])[m[2]] = keys;
            values.get(m[1])[m[2]] = texts;
        }
    }
}
return { groups, values };
}

const failures = [];
let missingParityKeys = 0;
const placeholderMismatches = [];
// A translation that loses or renames a {placeholder} shows the raw marker, or drops the value.
const placeholderNames = (text) => [...text.matchAll(PLACEHOLDER)].map(m => m[1]).sort().join(', ');
// Key parity and placeholder parity of one app's groups; returns the app's ru keys.
function checkGroups({ groups, values }, label) {
    const ruKeys = new Set();
    for (const [base, byLocale] of [...groups].sort()) {
        for (const k of byLocale.Ru ?? []) ruKeys.add(k);
        const union = new Set(LOCALES.flatMap(l => [...(byLocale[l] ?? [])]));
        for (const locale of LOCALES) {
            if (!byLocale[locale]) { failures.push(`${label}${base}: no ${locale} dictionary`); continue; }
            const missing = [...union].filter(k => !byLocale[locale].has(k));
            missingParityKeys += missing.length;
            if (missing.length) failures.push(`${label}${base}${locale}: missing ${missing.length} key(s): ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ', …' : ''}`);
        }
    }
    for (const [base, byLocale] of [...values].sort()) {
        for (const [key, ruText] of byLocale.Ru ?? []) {
            for (const locale of ['Ky', 'En']) {
                const text = byLocale[locale]?.get(key);
                if (text !== undefined && placeholderNames(text) !== placeholderNames(ruText)) {
                    placeholderMismatches.push(`${label}${base}${locale} ${key}: {${placeholderNames(text)}} instead of {${placeholderNames(ruText)}}`);
                }
            }
        }
    }
    return ruKeys;
}
const { groups, values } = collectGroups(dictDir);
const allRu = checkGroups({ groups, values }, '');
const mobileGroups = fs.existsSync(mobileDictDir) ? collectGroups(mobileDictDir) : { groups: new Map(), values: new Map() };
const allMobileRu = checkGroups(mobileGroups, 'mobile:');

// Server messages (FE-10): src/lib/serverMessages.ts translates an API message found here. The same
// Russian text under two keys would make one translation dead.
const MARK = '\u0000';
const serverMessages = new Map(); // Russian text with each {placeholder} as MARK -> key
const duplicateServerMessages = [];
for (const [base, byLocale] of [...values].sort()) {
    if (!/^server[A-Z]/.test(base)) continue;
    for (const [key, ruText] of byLocale.Ru ?? []) {
        const normalized = ruText.replace(PLACEHOLDER, MARK);
        if (serverMessages.has(normalized)) duplicateServerMessages.push(`${key} repeats ${serverMessages.get(normalized)}: ${ruText}`);
        else serverMessages.set(normalized, key);
    }
}

// Literal t('key', ...) calls whose key is in no ru dictionary of the same app.
const unknownKeys = new Map();
function walk(dir, app) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { if (!['__tests__', 'node_modules', 'generated'].includes(e.name)) walk(p, app); continue; }
        if (!/\.(ts|tsx)$/.test(e.name) || /\.test\.tsx?$/.test(e.name) || p.startsWith(app.dict)) continue;
        const text = fs.readFileSync(p, 'utf8');
        for (const m of text.matchAll(/\bt\(\s*['"]([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+)['"]/g)) {
            if (!app.keys.has(m[1])) {
                const rel = app.prefix + path.relative(app.root, p).split(path.sep).join('/');
                if (!unknownKeys.has(app.prefix + m[1])) unknownKeys.set(app.prefix + m[1], rel);
            }
        }
    }
}
walk(path.join(web, 'src'), { root: web, dict: dictDir, keys: allRu, prefix: '' });
if (fs.existsSync(mobileDictDir)) walk(path.join(mobile, 'src'), { root: mobile, dict: mobileDictDir, keys: allMobileRu, prefix: 'apps/mobile/' });

console.log(`i18n: ${groups.size} dictionary groups, ${allRu.size} ru keys; mobile: ${mobileGroups.groups.size} groups, ${allMobileRu.size} ru keys; keys missing in some locale: ${missingParityKeys}; t() keys missing from dictionaries: ${unknownKeys.size}; placeholder mismatches: ${placeholderMismatches.length}; server messages: ${serverMessages.size}.`);
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
if (placeholderMismatches.length) {
    failed = true;
    console.error(`  ${placeholderMismatches.length} translation(s) have other {placeholders} than the ru text:`);
    for (const f of placeholderMismatches.slice(0, 20)) console.error(`    ${f}`);
}
if (duplicateServerMessages.length) {
    failed = true;
    console.error(`  ${duplicateServerMessages.length} server message(s) repeat the Russian text of another key; keep one:`);
    for (const f of duplicateServerMessages.slice(0, 20)) console.error(`    ${f}`);
}

// 3. Russian text that bypasses the translations (FE-10): JSX text and string literals of .tsx and
// .ts files outside t() (a Cyrillic fallback of t('key', 'Текст') is a translation) and outside
// console and log calls. In server code (API routes and src/lib modules without 'use client') a
// literal that is a server message counts as translated: the API answers with it in the language of
// the request; a template literal matches a message with {placeholders} where it has ${...}. Each
// file may not have more than its baseline (scripts/i18n-untranslated-baseline.json), and a lower
// count must be written down with --write-baseline, so the gain is kept. The deliberate rest of the
// baseline: the admin panel, the legal pages, the texts of outgoing notifications and bot replies
// (the recipient's language is not stored), internal errors and text matching. apps/mobile/src is
// scanned the same way (it has no server code), with its files under apps/mobile/ in the baseline.
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
function literalText(node) {
    if (ts.isTemplateExpression(node)) return node.head.text + node.templateSpans.map(span => MARK + span.literal.text).join('');
    return node.text;
}
function isServerFile(rel, source) {
    if (rel.startsWith('src/app/api/') || rel.endsWith('/route.ts')) return true;
    return rel.startsWith('src/lib/') && !/^\s*(\/\/[^\n]*\n\s*|\/\*[\s\S]*?\*\/\s*)*['"]use client['"]/.test(source);
}
const untranslated = new Map();
function scanUi(dir, app = { root: web, dict: dictDir, prefix: '', server: true }) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { if (!['__tests__', 'node_modules', 'generated'].includes(e.name) && p !== app.dict) scanUi(p, app); continue; }
        if (!/\.tsx?$/.test(e.name) || e.name.endsWith('.d.ts') || /\.test\.tsx?$/.test(e.name)) continue;
        const local = path.relative(app.root, p).split(path.sep).join('/');
        const rel = app.prefix + local;
        const source = fs.readFileSync(p, 'utf8');
        const tsx = e.name.endsWith('.tsx');
        const server = app.server && !tsx && isServerFile(local, source);
        const sf = ts.createSourceFile(p, source, ts.ScriptTarget.Latest, true, tsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
        const found = [];
        const visit = (node) => {
            let text = null;
            if (ts.isJsxText(node)) text = node.getText();
            else if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node))
                && !ts.isImportDeclaration(node.parent) && !ts.isExportDeclaration(node.parent) && outsideTranslation(node)
                && !(server && serverMessages.has(literalText(node)))) {
                text = node.getText();
            }
            if (text && CYRILLIC.test(text)) {
                found.push(`${sf.getLineAndCharacterOfPosition(node.getStart()).line + 1}: ${text.replace(/\s+/g, ' ').trim().slice(0, 80)}`);
            }
            ts.forEachChild(node, visit);
        };
        visit(sf);
        if (found.length) untranslated.set(rel, found);
    }
}
scanUi(path.join(web, 'src'));
scanUi(path.join(mobile, 'src'), { root: mobile, dict: mobileDictDir, prefix: 'apps/mobile/', server: false });
const counts = Object.fromEntries([...untranslated].sort(([a], [b]) => a.localeCompare(b)).map(([file, found]) => [file, found.length]));
const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
if (process.argv.includes('--write-baseline')) {
    fs.writeFileSync(BASELINE_FILE, `${JSON.stringify(counts, null, 2)}\n`);
    console.log(`i18n: wrote the untranslated-text baseline: ${total} in ${Object.keys(counts).length} files.`);
} else {
    const baseline = fs.existsSync(BASELINE_FILE) ? JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')) : {};
    const grown = Object.entries(counts).filter(([file, n]) => n > (baseline[file] ?? 0));
    const shrunk = Object.entries(baseline).filter(([file, n]) => (counts[file] ?? 0) < n);
    console.log(`i18n: untranslated text: ${total} in ${Object.keys(counts).length} files (baseline ${Object.values(baseline).reduce((s, n) => s + n, 0)}).`);
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

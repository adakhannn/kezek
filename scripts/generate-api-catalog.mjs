import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { repoRoot, walkFiles, slash, markdownLinks, resolveDocLink } from './docs-lib.mjs';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const verbs = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
const cache = new Map();

function moduleFile(from, specifier) {
    const base = specifier.startsWith('@/') ? path.join(repoRoot, 'apps/web/src', specifier.slice(2)) : specifier.startsWith('.') ? path.resolve(path.dirname(from), specifier) : null;
    if (!base) throw new Error(`Unsupported route re-export: ${specifier}`);
    const resolved = ['', '.ts', '.tsx', '.js', '/index.ts'].map(suffix => base + suffix).find(file => fs.existsSync(file) && fs.statSync(file).isFile());
    if (!resolved) throw new Error(`Unresolved route re-export: ${specifier}`);
    return resolved;
}

function routeExports(file, stack = []) {
    if (cache.has(file)) return cache.get(file);
    if (stack.includes(file)) throw new Error(`Cyclic route re-export: ${file}`);
    const text = fs.readFileSync(file, 'utf8');
    const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    if (ast.parseDiagnostics.length) throw new Error(`Cannot parse route: ${file}`);
    const methods = new Set();
    const delegates = new Map();
    for (const statement of ast.statements) {
        const exported = statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword) && !statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.DefaultKeyword);
        if (exported && ts.isFunctionDeclaration(statement) && verbs.includes(statement.name?.text)) methods.add(statement.name.text);
        if (exported && ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) {
            if (ts.isIdentifier(declaration.name) && verbs.includes(declaration.name.text)) methods.add(declaration.name.text);
        }
        if (ts.isExportDeclaration(statement)) {
            if (statement.isTypeOnly) continue;
            if (!statement.moduleSpecifier) {
                for (const item of statement.exportClause?.elements || []) if (!item.isTypeOnly && verbs.includes(item.name.text)) methods.add(item.name.text);
            } else {
                const target = moduleFile(file, statement.moduleSpecifier.text);
                const inherited = routeExports(target, [...stack, file]);
                if (!statement.exportClause) inherited.methods.forEach(method => methods.add(method));
                else for (const item of statement.exportClause.elements || []) if (!item.isTypeOnly && verbs.includes(item.name.text)) methods.add(item.name.text);
                delegates.set(slash(path.relative(repoRoot, target)), 're-export');
            }
        }
        if (ts.isImportDeclaration(statement) && statement.importClause && ts.isStringLiteral(statement.moduleSpecifier)) {
            const symbols = statement.importClause.namedBindings?.elements || [];
            const used = symbols.filter(item => !item.isTypeOnly && /^run[A-Z]/.test(item.name.text) && new RegExp(`\\b${item.name.text}\\s*\\(`).test(text));
            if (used.length) {
                const target = moduleFile(file, statement.moduleSpecifier.text);
                delegates.set(slash(path.relative(repoRoot, target)), used.map(item => item.name.text).join(', '));
            }
        }
    }
    const result = { methods: verbs.filter(verb => methods.has(verb)), delegates: [...delegates] };
    cache.set(file, result);
    return result;
}

export function apiRouteRecords() {
    cache.clear();
    const files = walkFiles('apps/web/src/app', file => /\/route\.(?:ts|tsx|js)$/.test(file));
    const records = files.map(file => {
        const exports = routeExports(path.join(repoRoot, file));
        if (!exports.methods.length) throw new Error(`No explicit HTTP export found: ${file}`);
        const route = '/' + file.replace(/^apps\/web\/src\/app\//, '').replace(/\/route\.(ts|tsx|js)$/, '').split('/').filter(part => !/^\([^)]*\)$/.test(part) && !part.startsWith('@')).join('/');
        return { file, route, ...exports };
    });
    return records;
}

export function apiContractCoverage(records = apiRouteRecords()) {
    const expected = new Set(records.flatMap(record => record.methods.map(method => `${method} ${record.route}`)));
    const contracts = new Map();
    const failures = [];
    const sourceFiles = new Set(records.map(record => record.file));
    for (const file of walkFiles('docs/api', name => name.endsWith('.md') && !name.endsWith('/ROUTE_CATALOG.md'))) {
        const content = fs.readFileSync(path.join(repoRoot, file), 'utf8');
        const markers = [...content.matchAll(/<!-- api-contract: ([A-Z]+) ([^\s]+) -->/g)];
        for (const marker of markers) {
            const key = `${marker[1]} ${marker[2]}`;
            if (!expected.has(key)) failures.push(`${file}: contract for nonexistent export ${key}`);
            if (contracts.has(key)) failures.push(`${file}: duplicate contract marker ${key} (also ${contracts.get(key)})`);
            contracts.set(key, file);
        }
        if (markers.length) for (const link of markdownLinks(content)) {
            if (!link.target) continue;
            const resolved = resolveDocLink(file, link.target);
            if (!resolved?.filePath || !/\.(?:tsx?|jsx?|sql|json|ya?ml|toml)$/.test(resolved.filePath) || !fs.existsSync(resolved.filePath)) continue;
            sourceFiles.add(slash(path.relative(repoRoot, resolved.filePath)));
        }
    }
    for (const key of expected) if (!contracts.has(key)) failures.push(`Missing source-reviewed API contract: ${key}`);
    const hash = createHash('sha256');
    for (const file of [...sourceFiles].sort()) hash.update(file).update('\0').update(fs.readFileSync(path.join(repoRoot, file), 'utf8').replace(/\r\n/g, '\n')).update('\0');
    return { contracts, failures, sourceCount: sourceFiles.size, sourceSha256: hash.digest('hex') };
}

export function generateApiCatalog() {
    const records = apiRouteRecords();
    const coverage = apiContractCoverage(records);
    if (coverage.failures.length) throw new Error(coverage.failures.join('\n'));
    const count = records.reduce((sum, record) => sum + record.methods.length, 0);
    const result = [
        '# Полный каталог HTTP-маршрутов', '',
        'Статус: автоматически построенная карта исходников. Генератор читает TypeScript AST и локальные re-export; приложение и handlers не выполняются.', '',
        `В текущем дереве: **${records.length} route-файлов, ${count} явных METHOD/path**. Автоматические HEAD/OPTIONS framework не добавляются; middleware, rewrites и доступность deployment этой картой не проверяются.`, '',
        `Для каждой пары есть один api-contract marker в тематическом справочнике. Это контроль полноты навигации; факты контракта сверены чтением исходников, runtime NOT_RUN.`, '',
        `Контрольная сумма ${coverage.sourceCount} исходных файлов (routes и явно связанные из справочников TS/JS/SQL/config): \`${coverage.sourceSha256}\`. Изменение этих файлов требует повторной сверки затронутого описания перед обновлением каталога. Транзитивные зависимости без прямой ссылки этим fingerprint не охвачены.`, '',
        '[Руководство API](../../API_DOCUMENTATION.md) объясняет границы контрактов. Колонка «Делегирование» содержит вызванные из route функции с префиксом run и re-export; это указатель чтения, не полный граф вызовов или доказательство авторизации.', '',
        'Обновление из корня: `node scripts/generate-api-catalog.mjs --write`. Проверка без записи: `node scripts/generate-api-catalog.mjs --check`. Нужен установленный TypeScript из корневых devDependencies; сеть не используется.', '',
    ];
    for (const group of [...new Set(records.map(record => record.route.split('/')[1]))].sort()) {
        result.push(`## /${group}`, '', '| Путь | Явные методы | Исходник | Делегирование | Контракт |', '| --- | --- | --- | --- | --- |');
        for (const record of records.filter(record => record.route.split('/')[1] === group)) {
            const delegates = record.delegates.map(([file, label]) => `[${label}](../../${file})`).join('<br>') || 'Внутри route; читать исходник';
            const contracts = [...new Set(record.methods.map(method => coverage.contracts.get(`${method} ${record.route}`)))].map(file => `[справочник](${path.posix.relative('docs/api', file)})`).join('<br>');
            result.push(`| \`${record.route}\` | ${record.methods.join(', ')} | [route](../../${record.file}) | ${delegates} | ${contracts} |`);
        }
        result.push('');
    }
    return result.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const file = path.join(repoRoot, 'docs/api/ROUTE_CATALOG.md');
    const content = generateApiCatalog();
    if (process.argv.includes('--write')) {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, content);
        console.log('Updated docs/api/ROUTE_CATALOG.md from route exports.');
    } else if (process.argv.includes('--check')) {
        if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') !== content) { console.error('API route catalog is stale; run node scripts/generate-api-catalog.mjs --write'); process.exitCode = 1; }
        else console.log('API route catalog matches every discovered route export.');
    } else { console.error('Use --check or --write.'); process.exitCode = 1; }
}

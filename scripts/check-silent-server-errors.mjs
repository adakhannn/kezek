// Fails on server code that answers 5xx without leaving a log line (ARCH-04: errors in
// production were invisible because routes returned 500/503 and logged nothing).
//
// For every response built with a literal 5xx status (NextResponse.json, Response.json,
// new NextResponse, new Response; a ternary or `??` that can yield 5xx counts too), the
// enclosing catch block, or the enclosing function body when the response is not in a catch
// block, must call logError, logWarn, logErrorSafe or handleApiError, or throw.
// createErrorResponse(...) reports 5xx by itself and is exempt.
// A computed status (`status: result.status`, `{ status }`) cannot be judged statically: such
// responses in scopes without a log are listed for review and do not fail the check.
// The check is per function, not per path: a function that logs on one branch passes for all.
//
// Usage: node scripts/check-silent-server-errors.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIR = 'apps/web/src';
const SKIP_DIRS = new Set(['node_modules', '.next', '__tests__', '__mocks__']);
const SOURCE_FILE = /\.(ts|tsx)$/;
const TEST_FILE = /\.(test|spec)\.(ts|tsx)$/;
const RESPONSE_CLASSES = new Set(['NextResponse', 'Response']);
const LOG_CALLS = new Set(['logError', 'logWarn', 'logErrorSafe', 'handleApiError']);
const SELF_REPORTING = new Set(['createErrorResponse']);

function unwrap(node) {
    while (node && (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)
        || ts.isNonNullExpression(node) || ts.isTypeAssertionExpression(node))) node = node.expression;
    return node;
}

/** 'server-error' when the expression can evaluate to a literal 5xx, 'literal' for other literals, 'dynamic' otherwise. */
export function classifyStatus(node) {
    node = unwrap(node);
    if (!node) return 'dynamic';
    if (ts.isNumericLiteral(node)) {
        const value = Number(node.text);
        return value >= 500 && value <= 599 ? 'server-error' : 'literal';
    }
    const branches = ts.isConditionalExpression(node) ? [node.whenTrue, node.whenFalse]
        : ts.isBinaryExpression(node) && [ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken].includes(node.operatorToken.kind)
            ? [node.left, node.right] : null;
    if (!branches) return 'dynamic';
    const kinds = branches.map(classifyStatus);
    if (kinds.includes('server-error')) return 'server-error';
    return kinds.includes('dynamic') ? 'dynamic' : 'literal';
}

/** The `status` expression of a ResponseInit: undefined when absent (200), null when not visible. */
function statusOf(init) {
    init = unwrap(init);
    if (!init) return undefined;
    if (!ts.isObjectLiteralExpression(init)) return null;
    for (const property of init.properties) {
        const name = property.name && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) ? property.name.text : null;
        if (name !== 'status') continue;
        if (ts.isPropertyAssignment(property)) return property.initializer;
        if (ts.isShorthandPropertyAssignment(property)) return property.name;
        return null;
    }
    return undefined;
}

/** { builder, init } for NextResponse/Response, { builder, selfReporting } for createErrorResponse, else null. */
function responseBuilder(node) {
    if (ts.isCallExpression(node)) {
        const callee = unwrap(node.expression);
        if (ts.isPropertyAccessExpression(callee) && callee.name.text === 'json'
            && ts.isIdentifier(callee.expression) && RESPONSE_CLASSES.has(callee.expression.text)) {
            return { builder: `${callee.expression.text}.json`, init: node.arguments[1] };
        }
        if (ts.isIdentifier(callee) && SELF_REPORTING.has(callee.text)) return { builder: callee.text, selfReporting: true };
    }
    if (ts.isNewExpression(node)) {
        const callee = unwrap(node.expression);
        if (ts.isIdentifier(callee) && RESPONSE_CLASSES.has(callee.text)) return { builder: `new ${callee.text}`, init: node.arguments?.[1] };
    }
    return null;
}

function isFunctionLike(node) {
    return ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node) || ts.isMethodDeclaration(node)
        || ts.isConstructorDeclaration(node) || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node);
}

/** The enclosing catch block, or the enclosing function body when the node is not in a catch block. */
export function enclosingScope(node) {
    for (let current = node.parent; current; current = current.parent) {
        if (ts.isCatchClause(current)) return current.block;
        if (isFunctionLike(current)) return current.body ?? current;
        if (ts.isSourceFile(current)) return current;
    }
    return null;
}

/** True when the scope calls one of the log functions (also as a method: deps.logError) or throws. */
export function scopeReports(scope) {
    let found = false;
    const visit = (node) => {
        if (found) return;
        if (ts.isThrowStatement(node)) { found = true; return; }
        if (ts.isCallExpression(node)) {
            const callee = unwrap(node.expression);
            const name = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : null;
            if (name && LOG_CALLS.has(name)) { found = true; return; }
        }
        ts.forEachChild(node, visit);
    };
    visit(scope);
    return found;
}

/**
 * Responses of one source text: `silent` (literal 5xx without a log: fails the check), `dynamic`
 * (computed status in a scope without a log: report only), and counters for the summary.
 */
export function analyzeSource(text, fileName = 'source.ts') {
    const kind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, kind);
    const silent = [];
    const dynamic = [];
    let serverErrors = 0;
    let selfReported = 0;
    const lineOf = (node) => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
    const visit = (node) => {
        const response = responseBuilder(node);
        if (response?.selfReporting) {
            selfReported++;
        } else if (response) {
            const status = statusOf(response.init);
            const statusKind = status === undefined ? 'literal' : status === null ? 'dynamic' : classifyStatus(status);
            if (statusKind !== 'literal') {
                if (statusKind === 'server-error') serverErrors++;
                const scope = enclosingScope(node);
                if (!scope || !scopeReports(scope)) {
                    const finding = { line: lineOf(node), builder: response.builder, status: status ? status.getText(source) : '(not visible)' };
                    (statusKind === 'server-error' ? silent : dynamic).push(finding);
                }
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(source);
    return { silent, dynamic, serverErrors, selfReported };
}

function* sourceFiles(directory) {
    if (!fs.existsSync(directory)) return;
    const entries = fs.readdirSync(directory, { withFileTypes: true })
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
        const full = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            if (!SKIP_DIRS.has(entry.name)) yield* sourceFiles(full);
        } else if (SOURCE_FILE.test(entry.name) && !TEST_FILE.test(entry.name) && !entry.name.endsWith('.d.ts')) {
            yield full;
        }
    }
}

/** Findings for every server source file under `directory`, with paths relative to `base`. */
export function check(directory = path.join(root, SOURCE_DIR), base = root) {
    const silent = [];
    const dynamic = [];
    let files = 0;
    let serverErrors = 0;
    let selfReported = 0;
    for (const file of sourceFiles(directory)) {
        files++;
        const rel = path.relative(base, file).split(path.sep).join('/');
        const result = analyzeSource(fs.readFileSync(file, 'utf8'), file);
        serverErrors += result.serverErrors;
        selfReported += result.selfReported;
        for (const finding of result.silent) silent.push({ file: rel, ...finding });
        for (const finding of result.dynamic) dynamic.push({ file: rel, ...finding });
    }
    return { files, serverErrors, selfReported, silent, dynamic };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const { files, serverErrors, selfReported, silent, dynamic } = check();
    const format = ({ file, line, builder, status }) => `  ${file}:${line} ${builder} status ${status}`;
    if (dynamic.length) {
        console.log(`Computed status in a scope without a log (${dynamic.length}, report only; the 5xx cases must be logged by the caller):`);
        for (const finding of dynamic) console.log(format(finding));
    }
    if (silent.length) {
        console.error(`5xx responses without a log (${silent.length}). Log the cause before returning: logError(scope, 'constant message', error); or rethrow, or use createErrorResponse.`);
        for (const finding of silent) console.error(format(finding));
        process.exit(1);
    }
    console.log(`Silent server error check passed: ${files} files; ${serverErrors} literal 5xx responses log their cause; ${selfReported} createErrorResponse calls report by themselves.`);
}

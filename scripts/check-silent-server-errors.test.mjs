import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { analyzeSource, check } from './check-silent-server-errors.mjs';

const lines = (findings) => findings.map((finding) => finding.line);

test('flags a 500 answered from a catch block without a log', () => {
    const { silent } = analyzeSource([
        "export async function GET() {",
        "    try { return NextResponse.json({ ok: true }); }",
        "    catch (error) { return NextResponse.json({ ok: false }, { status: 500 }); }",
        "}",
    ].join('\n'));
    assert.deepEqual(lines(silent), [3]);
    assert.equal(silent[0].builder, 'NextResponse.json');
});

test('flags Response.json, new Response and new NextResponse the same way', () => {
    const { silent } = analyzeSource([
        "export function a() { return Response.json({ ok: false }, { status: 503 }); }",
        "export function b() { return new Response(null, { status: 502 }); }",
        "export function c() { return new NextResponse('{}', { status: 500 as const }); }",
    ].join('\n'));
    assert.deepEqual(lines(silent), [1, 2, 3]);
});

test('a 5xx is not flagged when its block logs, delegates to handleApiError or rethrows', () => {
    const { silent, serverErrors } = analyzeSource([
        "export async function logged() {",
        "    try { return await work(); }",
        "    catch (error) { logError('Scope', 'Work failed', error); return NextResponse.json({ ok: false }, { status: 500 }); }",
        "}",
        "export async function warned() {",
        "    try { return await work(); }",
        "    catch (error) { deps.logWarn('Scope', 'Work failed', error); return NextResponse.json({ ok: false }, { status: 503 }); }",
        "}",
        "export async function delegated() {",
        "    try { return await work(); }",
        "    catch (error) { if (busy(error)) return NextResponse.json({ ok: false }, { status: 503 }); return handleApiError(error, 'Scope'); }",
        "}",
        "export async function rethrown() {",
        "    try { return await work(); }",
        "    catch (error) { if (retryable(error)) return new Response(null, { status: 503 }); throw error; }",
        "}",
        "export function outsideCatch(error: unknown) {",
        "    logErrorSafe('Scope', 'Lookup failed', error);",
        "    return Response.json({ ok: false }, { status: 500 });",
        "}",
    ].join('\n'));
    assert.deepEqual(silent, []);
    assert.equal(serverErrors, 5);
});

test('createErrorResponse reports by itself and is not flagged', () => {
    const result = analyzeSource([
        "export async function GET() {",
        "    try { return await work(); }",
        "    catch { return createErrorResponse('internal', 'Failed', undefined, 500); }",
        "}",
    ].join('\n'));
    assert.deepEqual(result.silent, []);
    assert.equal(result.selfReported, 1);
});

test('flags a ternary that can yield 5xx in a block without a log', () => {
    const { silent } = analyzeSource([
        "export async function GET() {",
        "    const ok = await work();",
        "    return NextResponse.json({ ok }, { status: ok ? 200 : 500 });",
        "}",
    ].join('\n'));
    assert.deepEqual(lines(silent), [3]);
    assert.equal(silent[0].status, 'ok ? 200 : 500');
});

test('a log elsewhere in the function does not cover a silent catch block', () => {
    const { silent } = analyzeSource([
        "export async function POST() {",
        "    logWarn('Scope', 'Starting');",
        "    try { return await work(); }",
        "    catch { return NextResponse.json({ ok: false }, { status: 500 }); }",
        "}",
    ].join('\n'));
    assert.deepEqual(lines(silent), [4]);
});

test('4xx and 2xx responses are ignored; a computed status is reported, not failed', () => {
    const result = analyzeSource([
        "export async function GET() {",
        "    if (bad) return NextResponse.json({ ok: false }, { status: 400 });",
        "    if (gone) return NextResponse.json({ ok: false }, { status: cond ? 404 : 410 });",
        "    const result = await work();",
        "    if (!result.ok) return NextResponse.json({ ok: false }, { status: result.status });",
        "    return NextResponse.json({ ok: true });",
        "}",
        "const reply = (data: object, status = 200) => NextResponse.json(data, { status });",
    ].join('\n'));
    assert.deepEqual(result.silent, []);
    assert.deepEqual(lines(result.dynamic), [5, 8]);
    assert.deepEqual(result.dynamic.map((finding) => finding.status), ['result.status', 'status']);
});

test('scans .ts and .tsx sources and skips tests', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'silent-errors-'));
    try {
        const silentRoute = "export function GET() { return NextResponse.json({}, { status: 500 }); }\n";
        fs.mkdirSync(path.join(directory, 'app'));
        fs.mkdirSync(path.join(directory, '__tests__'));
        fs.writeFileSync(path.join(directory, 'app', 'route.ts'), silentRoute);
        fs.writeFileSync(path.join(directory, 'app', 'Page.tsx'), "export const Page = () => <div>{String(new Response(null, { status: 503 }).status)}</div>;\n");
        fs.writeFileSync(path.join(directory, 'app', 'route.test.ts'), silentRoute);
        fs.writeFileSync(path.join(directory, '__tests__', 'fixture.ts'), silentRoute);
        const result = check(directory, directory);
        assert.equal(result.files, 2);
        assert.deepEqual(result.silent.map((finding) => `${finding.file}:${finding.line}`), ['app/Page.tsx:1', 'app/route.ts:1']);
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});

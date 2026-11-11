import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { buildOpenApi, checkOpenApi, writeOpenApi, openApiPath } from './generate-openapi.mjs';
import { apiRouteRecords } from './generate-api-catalog.mjs';
import { generateSdk, sdkDirectory } from './generate-sdk.mjs';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const files = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);
const text = file => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const operations = spec => Object.entries(spec.paths).flatMap(([route, methods]) => Object.keys(methods).map(method => `${method.toUpperCase()} ${route}`)).sort();
function removeTemporaryDirectory(directory) {
    const parent = path.resolve(os.tmpdir());
    const target = path.resolve(directory);
    assert.equal(path.dirname(target), parent);
    assert.match(path.basename(target), /^kezek-(openapi|sdk)-/);
    fs.rmSync(target, { recursive: true, force: true });
}

test('inventory exactly covers AST exports, including .tsx, non-api routes and dynamic segments', () => {
    const { 'openapi.json': full, 'openapi-sdk.json': sdk } = buildOpenApi();
    const expected = apiRouteRecords().flatMap(record => record.methods.map(method => `${method} ${openApiPath(record.route)}`)).sort();
    assert.deepEqual(operations(full), expected);
    assert.ok(full.paths['/api/users/search'].post['x-source-file'].endsWith('route.tsx'));
    assert.ok(full.paths['/auth/callback/google'].GET === undefined);
    assert.ok(full.paths['/auth/callback/google'].get);
    assert.ok(Object.keys(full.paths).some(route => route.startsWith('/admin/')));
    for (const [route, methods] of Object.entries(full.paths)) for (const operation of Object.values(methods)) {
        assert.ok(fs.existsSync(operation['x-manual-contract']));
        if (operation['x-contract-status'] === 'inventory-only') {
            assert.equal(operation.security, undefined);
            assert.equal(operation.requestBody, undefined);
            assert.deepEqual(Object.keys(operation.responses), ['default']);
            assert.deepEqual(operation.parameters.map(parameter => parameter.name), [...route.matchAll(/\{([^}]+)\}/g)].map(match => match[1]));
        }
    }
    assert.deepEqual(operations(sdk), ['POST /api/quick-book-guest', 'POST /api/quick-hold', 'POST /api/staff/shift/close', 'POST /api/staff/shift/items']);
});

test('new catch-all route requires deliberate path modeling', () => {
    assert.equal(openApiPath('/api/staff/[id]/close'), '/api/staff/{id}/close');
    assert.throws(() => openApiPath('/api/[...slug]'), /Review catch-all/);
    assert.throws(() => openApiPath('/api/[[...slug]]'), /Review catch-all/);
});

test('generation is deterministic outside repo cwd and check detects stale artifacts', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kezek-openapi-'));
    const cwd = process.cwd();
    try {
        const before = buildOpenApi();
        process.chdir(directory);
        assert.deepEqual(writeOpenApi(directory), before);
        checkOpenApi(directory);
        fs.appendFileSync(path.join(directory, 'openapi-sdk.json'), ' ');
        assert.throws(() => checkOpenApi(directory), /is stale/);
        writeOpenApi(directory);
        checkOpenApi(directory);
        assert.ok(before['openapi.json']['x-reviewed-sources'].includes('apps/web/src/lib/validation/schemas.ts'));
    } finally { process.chdir(cwd); removeTemporaryDirectory(directory); }
});

test('generated SDK is reproducible and typechecks a consumer with required identities and typed results', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kezek-sdk-'));
    try {
        const output = path.join(directory, 'client');
        await generateSdk(output);
        const relative = file => path.relative(output, file);
        assert.deepEqual(files(output).map(relative).sort(), files(sdkDirectory).map(file => path.relative(sdkDirectory, file)).sort());
        for (const file of files(output)) assert.equal(text(file), text(path.join(sdkDirectory, relative(file))), `Stale SDK: ${relative(file)}`);
        const consumer = path.join(directory, 'consumer.ts');
        fs.writeFileSync(consumer, `import { BookingsService, ShiftsService, type QuickHoldInput } from './client';
async function consumer(body: QuickHoldInput) {
    const result = await BookingsService.quickHold({ idempotencyKey: 'unit-key', requestBody: body });
    const id: string = result.data.booking_id;
    // @ts-expect-error wire result must not be any
    const impossible: number = result.data.booking_id;
    // @ts-expect-error a booking requires its caller-created idempotency identity
    BookingsService.quickHold({ requestBody: body });
    // @ts-expect-error guest also requires the durable guest proof
    BookingsService.quickBookGuest({ idempotencyKey: 'unit-key', requestBody: {} });
    // @ts-expect-error Save must carry original identity and revision
    ShiftsService.saveShiftItems({ requestBody: { items: [] } });
    const saved = await ShiftsService.saveShiftItems({ requestBody: { items: [], expectedShiftId: null, expectedRevision: null } });
    const revision: number = saved.data.revision;
    // @ts-expect-error Save response revision must not be any
    const invalidRevision: string = saved.data.revision;
    const closed = await ShiftsService.closeShift({ requestBody: { expectedShiftId: id, expectedRevision: revision, totalAmount: 0 } });
    const closedRevision: number = closed.data.shift.ledger_revision;
    // @ts-expect-error Close response ledger revision must not be any
    const invalidClosedRevision: string = closed.data.shift.ledger_revision;
    return closedRevision;
}
void consumer;
`);
        const program = ts.createProgram([consumer], { strict: true, noEmit: true, skipLibCheck: true, target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, moduleResolution: ts.ModuleResolutionKind.Node10, lib: ['lib.es2020.d.ts', 'lib.dom.d.ts'], types: [] });
        const diagnostics = ts.getPreEmitDiagnostics(program);
        assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCurrentDirectory: () => directory, getCanonicalFileName: name => name, getNewLine: () => '\n' }));
    } finally { removeTemporaryDirectory(directory); }
});

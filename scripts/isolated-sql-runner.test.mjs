import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { isolatedSqlSuites, runIsolatedSqlSuites } from './run-isolated-sql-tests.mjs';

test('required CI SQL matrix matches the canonical isolated suite registry', () => {
    const ci = fs.readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
    const matrix = ci.match(/  sql_tests:[\s\S]*?        runner:\s*\r?\n((?:          - [^\r\n]+\r?\n)+)/)?.[1];
    assert.ok(matrix, 'update this strict parity check if the matrix structure changes');
    const files = [...matrix.matchAll(/- (test-[a-z0-9-]+\.(?:mjs|cjs))/g)].map(match => match[1]);
    assert.deepEqual(files, isolatedSqlSuites);
});
test('dispatches exactly the registry using Node and no shell interpolation', () => {
    const calls = [];
    assert.equal(runIsolatedSqlSuites((binary, args, options) => { calls.push([binary, args, options]); return { status: 0 }; }), 0);
    assert.deepEqual(calls.map(([, [file]]) => path.basename(file)), isolatedSqlSuites);
    for (const [binary, args, options] of calls) {
        assert.equal(binary, process.execPath);
        assert.equal(args.length, 1);
        assert.equal(options.shell, false);
        assert.equal(options.windowsHide, true);
    }
});
test('first suite failure stops execution and preserves the native exit status', () => {
    let calls = 0;
    assert.equal(runIsolatedSqlSuites(() => ({ status: ++calls === 2 ? 17 : 0 })), 17);
    assert.equal(calls, 2);
});
test('spawn failure or signal cannot become a success', () => {
    assert.equal(runIsolatedSqlSuites(() => ({ status: null, error: new Error('spawn failed') })), 1);
    assert.equal(runIsolatedSqlSuites(() => ({ status: null, signal: 'SIGTERM' })), 1);
});

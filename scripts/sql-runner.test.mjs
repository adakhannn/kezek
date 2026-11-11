import assert from 'node:assert/strict';
import test from 'node:test';
import { runSqlTests } from './run-sql-tests.mjs';

test('missing/blank explicit database target fails before invoking any executable', () => {
    for (const value of [undefined, '', '   ']) {
        const messages = [];
        const status = runSqlTests({ env: { SUPABASE_DB_URL: value },
            spawn: () => assert.fail('must not dispatch'), report: message => messages.push(message) });
        assert.equal(status, 2);
        assert.equal(messages.length, 1);
    }
});

test('psql receives fail-fast, no-psqlrc and no-prompt options without shell parsing', () => {
    const target = 'postgresql://synthetic:password@127.0.0.1/isolated';
    let calls = 0;
    const status = runSqlTests({ env: { SUPABASE_DB_URL: target }, spawn: (command, args, options) => {
        calls++;
        assert.equal(command, 'psql');
        assert.ok(args.includes('-X'));
        assert.ok(args.includes('--set=ON_ERROR_STOP=1'));
        assert.ok(args.includes('--no-password'));
        assert.ok(args.includes(`--dbname=${target}`));
        assert.match(args.at(-1), /supabase[/\\]tests_critical_scenarios\.sql$/);
        assert.equal(options.shell, false);
        assert.equal(options.stdio, 'inherit');
        return { status: 0 };
    } });
    assert.equal(status, 0);
    assert.equal(calls, 1);
});

test('SQL/native nonzero exit is preserved without retry or a second shell', () => {
    for (const expected of [1, 2, 3, 37]) {
        let calls = 0;
        const status = runSqlTests({ env: { SUPABASE_DB_URL: 'synthetic-only' },
            spawn: () => { calls++; return { status: expected }; } });
        assert.equal(status, expected);
        assert.equal(calls, 1);
    }
});

test('missing executable or interrupted process is a failure without exposing the target', () => {
    for (const result of [{ status: null, error: new Error('ENOENT') }, { status: null, signal: 'SIGTERM' }]) {
        const messages = [];
        assert.equal(runSqlTests({ env: { SUPABASE_DB_URL: 'private-target' }, spawn: () => result,
            report: message => messages.push(message) }), 1);
        assert.equal(messages.length, 1);
        assert.ok(!messages[0].includes('private-target'));
    }
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { databaseHost, refuseTarget, runSqlTests } from './run-sql-tests.mjs';

const local = 'postgresql://synthetic:password@127.0.0.1:54322/isolated';

test('missing/blank explicit database target fails before invoking any executable', () => {
    for (const value of [undefined, '', '   ']) {
        const messages = [];
        const status = runSqlTests({ env: { SUPABASE_DB_URL: value },
            spawn: () => assert.fail('must not dispatch'), report: message => messages.push(message) });
        assert.equal(status, 2);
        assert.equal(messages.length, 1);
    }
});

test('psql receives fail-fast, no-psqlrc and no-prompt options and a rolled-back transaction', () => {
    let calls = 0;
    const status = runSqlTests({ env: { SUPABASE_DB_URL: local }, spawn: (command, args, options) => {
        calls++;
        assert.equal(command, 'psql');
        assert.ok(args.includes('-X'));
        assert.ok(args.includes('--set=ON_ERROR_STOP=1'));
        assert.ok(args.includes('--no-password'));
        assert.ok(args.includes(`--dbname=${local}`));
        const file = args.indexOf('--file');
        assert.deepEqual(args.slice(file - 2, file), ['--command', 'begin']);
        assert.match(args[file + 1], /supabase[/\\]tests_critical_scenarios\.sql$/);
        assert.deepEqual(args.slice(file + 2), ['--command', 'rollback']);
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
        const status = runSqlTests({ env: { SUPABASE_DB_URL: local },
            spawn: () => { calls++; return { status: expected }; } });
        assert.equal(status, expected);
        assert.equal(calls, 1);
    }
});

test('missing executable or interrupted process is a failure without exposing the target', () => {
    for (const result of [{ status: null, error: new Error('ENOENT') }, { status: null, signal: 'SIGTERM' }]) {
        const messages = [];
        assert.equal(runSqlTests({ env: { SUPABASE_DB_URL: local }, spawn: () => result,
            report: message => messages.push(message) }), 1);
        assert.equal(messages.length, 1);
        assert.ok(!messages[0].includes('synthetic:password'));
    }
});

test('only local targets run without an explicit authorization (CI-06)', () => {
    for (const target of [local, 'postgres://u@localhost/db', 'postgresql://u@[::1]:5432/db',
        'postgresql://u@db:5432/postgres', 'host=127.0.0.1 port=54322 dbname=postgres user=postgres']) {
        assert.equal(refuseTarget(target, {}), null, target);
    }
    for (const target of ['postgresql://postgres.abcd@aws-0-eu-north-1.pooler.supabase.com:6543/postgres',
        'host=db.example.org dbname=postgres', 'not a connection string']) {
        assert.notEqual(refuseTarget(target, {}), null, target);
    }
});

test('one remote host can be authorized, never the production project', () => {
    const remote = 'postgresql://u@test-db.example.org:5432/postgres';
    assert.equal(refuseTarget(remote, { KEZEK_SQL_TESTS_TARGET_HOST: 'test-db.example.org' }), null);
    assert.notEqual(refuseTarget(remote, { KEZEK_SQL_TESTS_TARGET_HOST: 'other.example.org' }), null);
    const production = 'postgresql://postgres.beulnmftzbmtbdlgurht@aws-0-eu-north-1.pooler.supabase.com:6543/postgres';
    assert.match(refuseTarget(production, { KEZEK_SQL_TESTS_TARGET_HOST: 'aws-0-eu-north-1.pooler.supabase.com' }), /production/);
});

test('a refused target never reaches psql and is not printed', () => {
    const messages = [];
    const target = 'postgresql://secret-user:secret-pass@db.example.org/postgres';
    const status = runSqlTests({ env: { SUPABASE_DB_URL: target },
        spawn: () => assert.fail('must not dispatch'), report: message => messages.push(message) });
    assert.equal(status, 2);
    assert.ok(!messages.join(' ').includes('secret-pass'));
    assert.equal(databaseHost(target), 'db.example.org');
});

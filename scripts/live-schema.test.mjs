// Unit tests for the function parity comparator of the isolated SQL suites (CI-01). No Docker.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { SUPABASE_DEFAULT_PRIVILEGES, checkAgainstRatchet, compareFunctions, lastJsonLine, liveFunctionSql, loadCatalog, migrationWhereObjectsExistSql } = require('./lib/live-schema.cjs');

const fingerprint = (overrides = {}) => ({
    arguments: 'p_biz_id uuid, p_window_minutes integer DEFAULT 60',
    body: '0123456789abcdef0123456789abcdef',
    config: ['search_path=public, pg_temp'],
    definer: true,
    execute: { anon: false, authenticated: false, public: false, service_role: true },
    kind: 'f',
    language: 'plpgsql',
    owner: 'postgres',
    result: 'jsonb',
    strict: false,
    volatility: 'v',
    ...overrides,
});
const SIG = 'public.get_stats(uuid,integer)';
const catalog = { functions: { [SIG]: fingerprint(), 'public.other()': fingerprint({ arguments: '' }) }, dropped: ['public.purge_user'] };
const fields = (problems) => problems.map((problem) => `${problem.signature}:${problem.field}`);

test('identical fingerprints and functions unknown to the chain pass', () => {
    assert.deepEqual(compareFunctions(catalog, { [SIG]: fingerprint(), 'public.fixture_helper()': fingerprint() }), []);
});

test('a difference in body, config, an argument default or EXECUTE names the field', () => {
    const actual = {
        [SIG]: fingerprint({
            body: 'ffffffffffffffffffffffffffffffff',
            config: [],
            arguments: 'p_biz_id uuid, p_window_minutes integer',
            execute: { anon: true, authenticated: false, public: true, service_role: true },
        }),
    };
    assert.deepEqual(fields(compareFunctions(catalog, actual)).sort(), [`${SIG}:arguments`, `${SIG}:body`, `${SIG}:config`, `${SIG}:execute`]);
    const execute = compareFunctions(catalog, actual).find((problem) => problem.field === 'execute');
    assert.equal(execute.expected, 'anon=false, public=false');
    assert.equal(execute.actual, 'anon=true, public=true');
});

test('EXECUTE is compared only for roles the suite database has', () => {
    const actual = { [SIG]: fingerprint({ execute: { public: false, service_role: true } }) };
    assert.deepEqual(compareFunctions(catalog, actual), []);
});

test('a body-only stub may differ in body, never in interface or ACL', () => {
    const stubs = { [SIG]: { reason: 'synthetic schedule', skip: ['body'] } };
    assert.deepEqual(compareFunctions(catalog, { [SIG]: fingerprint({ body: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' }) }, { stubs }), []);
    const wrongAcl = fingerprint({ body: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', execute: { anon: false, authenticated: true, public: false, service_role: true } });
    assert.deepEqual(fields(compareFunctions(catalog, { [SIG]: wrongAcl }, { stubs })), [`${SIG}:execute`]);
    assert.throws(() => compareFunctions(catalog, {}, { stubs: { [SIG]: { reason: 'x', skip: ['execute'] } } }), /cannot skip execute/);
    assert.throws(() => compareFunctions(catalog, {}, { stubs: { [SIG]: { skip: ['body'] } } }), /needs a reason/);
});

test('an obsolete stub fails: it matches live, is absent, or names no live signature', () => {
    const stubs = { [SIG]: { reason: 'old copy', skip: ['body'] } };
    assert.deepEqual(fields(compareFunctions(catalog, { [SIG]: fingerprint() }, { stubs })), [`${SIG}:stub`]);
    assert.deepEqual(fields(compareFunctions(catalog, {}, { stubs })), [`${SIG}:stub`]);
    const unknown = { 'public.gone()': { reason: 'x', skip: ['body'] } };
    assert.deepEqual(fields(compareFunctions(catalog, {}, { stubs: unknown })), ['public.gone():stub']);
});

test('an overload the chain does not have, or a dropped function, fails', () => {
    const actual = { 'public.get_stats(uuid)': fingerprint(), 'public.purge_user(uuid)': fingerprint() };
    assert.deepEqual(fields(compareFunctions(catalog, actual)), ['public.get_stats(uuid):signature', 'public.purge_user(uuid):dropped']);
});

test('the ratchet tolerates listed drift and fails on new drift and on entries that match again', () => {
    const problems = [{ signature: SIG, field: 'body' }, { signature: 'public.other()', field: 'config' }];
    assert.deepEqual(checkAgainstRatchet(problems, [SIG, 'public.other()']), { unexpected: [], obsolete: [] });
    assert.deepEqual(checkAgainstRatchet(problems, [SIG]).unexpected.map((p) => p.signature), ['public.other()']);
    assert.deepEqual(checkAgainstRatchet([], [SIG]).obsolete, [SIG]);
});

test('psql output parsing takes the JSON line', () => {
    assert.deepEqual(lastJsonLine('SET\n{"a":1}\n'), { a: 1 });
    assert.throws(() => lastJsonLine('ERROR'), /Expected JSON/);
});

test('the default-privilege emulation is the prod baseline text', () => {
    const baseline = fs.readFileSync(new URL('../supabase/migrations/20261009110000_prod_baseline.sql', import.meta.url), 'utf8');
    for (const line of SUPABASE_DEFAULT_PRIVILEGES.split('\n')) assert.ok(baseline.includes(line), line);
});

test('the catalog covers the chain and its definitions install with the catalogued ACL', () => {
    const live = loadCatalog();
    assert.ok(Object.keys(live.functions).length > 100);
    assert.equal(live.functions['private.is_valid_time_zone(text)'].execute.public, true);
    const sql = liveFunctionSql('private.is_valid_time_zone(text)');
    assert.match(sql, /^CREATE OR REPLACE FUNCTION private\.is_valid_time_zone\(/);
    assert.match(sql, /foreach r in array array\[[^\]]*'public'[^\]]*\]::text\[\]/);
});

test('a grant migration applies per object and skips objects the suite lacks', () => {
    const sql = migrationWhereObjectsExistSql('20261119060000_definer_function_hardening.sql');
    assert.equal((sql.match(/do \$guard\$/g) || []).length, 7);
    assert.ok(sql.includes('execute $statement$alter function public.branch_admins_effective(uuid) set search_path = pg_catalog, public$statement$;'));
    assert.match(sql, /exception when undefined_function or undefined_table or undefined_object then null;/);
    // Only grant, revoke and alter function statements qualify: a migration that creates or changes data does not.
    assert.throws(() => migrationWhereObjectsExistSql('20261119040000_rls_policy_hygiene.sql'), /only grant, revoke and alter function/);
});

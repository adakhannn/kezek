// Static guard for the isolated SQL suites (CI-01), no Docker: every registered suite compares its
// functions with the catalog built from the migration chain, runs the PostgreSQL major production
// runs, and the list of known drift (scripts/sql-parity-ratchet.json) can only shrink.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { POSTGRES_MAJOR } = require('./lib/isolated-postgres.cjs');
const { loadCatalog, loadRatchet, functionName } = require('./lib/live-schema.cjs');

const scripts = new URL('./', import.meta.url);
const suites = JSON.parse(fs.readFileSync(new URL('sql-isolated-suites.json', scripts), 'utf8'));
const read = (name) => fs.readFileSync(new URL(name, scripts), 'utf8');

// Lower this whenever a suite is fixed; it must never grow. Zero means the ratchet file can go.
const RATCHET_BUDGET = 0;

test('every registered suite compares its functions with the migration chain under its own name', () => {
    for (const suite of suites) {
        const source = read(suite);
        assert.match(source, /require\('\.\/lib\/live-schema\.cjs'\)|from '\.\/lib\/live-schema\.cjs'/, `${suite} imports live-schema`);
        const call = new RegExp(`assertLiveFunctions\\(sql,\\s*\\{\\s*suite:\\s*'${suite.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`);
        assert.match(source, call, `${suite} calls assertLiveFunctions with its own name`);
    }
});

test('no suite names its own PostgreSQL image', () => {
    const files = fs.readdirSync(scripts).filter((name) => /^test-.*\.(cjs|mjs)$/.test(name))
        .concat(fs.readdirSync(new URL('lib/', scripts)).filter((name) => name !== 'isolated-postgres.cjs').map((name) => `lib/${name}`));
    for (const file of files) assert.doesNotMatch(read(file), /postgres:\d+/, `${file} must use lib/isolated-postgres.cjs`);
});

test('the suites, the local stack and the catalog run the same PostgreSQL major', () => {
    const config = fs.readFileSync(new URL('../supabase/config.toml', import.meta.url), 'utf8');
    const major = Number(/^\[db\][^[]*?^major_version\s*=\s*(\d+)/m.exec(config)?.[1]);
    assert.equal(major, POSTGRES_MAJOR);
    assert.equal(loadCatalog().serverVersionMajor, POSTGRES_MAJOR);
});

test('the catalog is consistent: dropped names are not live', () => {
    const catalog = loadCatalog();
    const live = new Set(Object.keys(catalog.functions).map(functionName));
    for (const name of catalog.dropped) assert.ok(!live.has(name), `${name} is both live and dropped`);
});

test('the drift ratchet names registered suites only and never grows', () => {
    const ratchet = loadRatchet();
    let total = 0;
    for (const [suite, signatures] of Object.entries(ratchet)) {
        assert.ok(suites.includes(suite), `${suite} is not a registered suite`);
        assert.ok(Array.isArray(signatures) && signatures.length > 0, `${suite}: an empty entry must be removed`);
        assert.deepEqual(signatures, [...new Set(signatures)].sort(), `${suite}: signatures sorted and unique`);
        total += signatures.length;
    }
    assert.ok(total <= RATCHET_BUDGET, `the ratchet has ${total} entries, budget ${RATCHET_BUDGET}: fix drift instead of listing it`);
});

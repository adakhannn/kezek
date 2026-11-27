// Self-test of the local load test without Docker: node --test scripts/load/load.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { assertLocalTarget, LoadTargetError, localUrl } from './guard.mjs';
import { resolveConfig, runLoad } from './run.mjs';
import { createCell, formatMarkdown, percentile, record, summarizeCell } from './stats.mjs';
import { startStubServer } from './stub-server.mjs';

const RUN = path.join(path.dirname(fileURLToPath(import.meta.url)), 'run.mjs');
const BIZ = 'e2e00000-0000-4000-8000-000000000001';
const NO_ENV_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'does-not-exist.env');

describe('URL guard', () => {
    it('accepts loopback hosts', () => {
        for (const url of ['http://localhost:3100', 'http://127.0.0.1:54321', 'http://[::1]:3000', 'https://localhost']) {
            assert.ok(assertLocalTarget(url));
        }
    });
    it('refuses production and any non-loopback host', () => {
        for (const url of [
            'https://kezek.vercel.app', 'https://preview-123.vercel.app', 'https://kezek.kg', 'https://www.kezek.kg',
            'https://beulnmftzbmtbdlgurht.supabase.co', 'https://abcdefgh.supabase.co', 'http://localhost/?x=beulnmftzbmtbdlgurht',
            'http://192.168.1.10:3000', 'http://10.0.0.1', 'http://localhost.evil.example', 'http://127.0.0.1.nip.io',
            'http://user:pw@localhost:3000', 'ftp://localhost', 'localhost:3000', '', 'not a url',
        ]) {
            assert.throws(() => assertLocalTarget(url), LoadTargetError, url);
        }
    });
    it('does not let a path escape the local origin', () => {
        assert.throws(() => localUrl('http://localhost:3100', '//kezek.vercel.app/'), LoadTargetError);
        assert.equal(localUrl('http://localhost:3100', '/b/e2e-salon').href, 'http://localhost:3100/b/e2e-salon');
    });
    it('resolveConfig refuses a hosted web or Supabase URL', () => {
        const env = { NEXT_PUBLIC_SUPABASE_ANON_KEY: 'k', E2E_TEST_BUSINESS_ID: BIZ };
        assert.throws(() => resolveConfig({ baseUrl: 'https://kezek.vercel.app', envFile: NO_ENV_FILE }, env), LoadTargetError);
        assert.throws(() => resolveConfig({ baseUrl: 'http://localhost:3100', envFile: NO_ENV_FILE },
            { ...env, NEXT_PUBLIC_SUPABASE_URL: 'https://beulnmftzbmtbdlgurht.supabase.co' }), LoadTargetError);
        assert.throws(() => resolveConfig({ baseUrl: 'http://localhost:3100', envFile: NO_ENV_FILE, scenarios: ['slots'] }, env), LoadTargetError);
    });
    it('the CLI exits 2 before any request for a production target', () => {
        const r = spawnSync(process.execPath, [RUN, '--base-url', 'https://kezek.vercel.app', '--scenarios', 'home', '--seed-env', NO_ENV_FILE], { encoding: 'utf8' });
        assert.equal(r.status, 2);
        assert.match(r.stderr, /Refusing to run/);
    });
    it('the CLI dry run accepts a local target', () => {
        const r = spawnSync(process.execPath, [RUN, '--dry-run', '--base-url', 'http://127.0.0.1:3100', '--scenarios', 'home', '--seed-env', NO_ENV_FILE], { encoding: 'utf8' });
        assert.equal(r.status, 0, r.stderr);
        assert.match(r.stdout, /no requests sent/);
    });
});

describe('stats and markdown', () => {
    it('nearest-rank percentiles', () => {
        const s = Array.from({ length: 100 }, (_, i) => i + 1);
        assert.equal(percentile(s, 50), 50);
        assert.equal(percentile(s, 95), 95);
        assert.equal(percentile(s, 99), 99);
        assert.equal(percentile([], 50), null);
    });
    it('error rate excludes expected conflicts, includes 429/503 and network errors', () => {
        const cell = createCell('booking', 10);
        cell.durationMs = 2000;
        record(cell, { ms: 100, status: 200, kind: 'ok' });
        record(cell, { ms: 120, status: 409, kind: 'conflict' });
        record(cell, { ms: 10, status: 429, kind: 'rate_limited' });
        record(cell, { ms: 30000, status: null, kind: 'network' });
        const r = summarizeCell(cell);
        assert.equal(r.total, 4);
        assert.equal(r.errors, 2);
        assert.equal(r.errorPct, 50);
        assert.equal(r.rps, 2);
        assert.equal(r.verdict, 'FAIL');
        const md = formatMarkdown({ meta: { runId: 't' }, cells: [cell], integrity: { overlaps: 0, created: 1 }, cleanup: { note: 'x' } });
        assert.match(md, /\| Создание записи \(гость\) \| 10 \| 4 \| 2\.0 \|/);
        assert.match(md, /200×1, 409×1, 429×1, ERR×1/);
        assert.match(md, /Пересекающихся активных записей одного мастера: \*\*0\*\*/);
    });
    it('stages above the SLO limit are reported as stress', () => {
        const cell = createCell('slots', 100);
        cell.durationMs = 1000;
        record(cell, { ms: 5, status: 200, kind: 'ok' });
        assert.equal(summarizeCell(cell).verdict, 'стресс');
    });
});

describe('runner against a local stub server', () => {
    let stub;
    before(async () => { stub = await startStubServer(); });
    after(() => new Promise((r) => stub.server.close(r)));

    it('runs every scenario through a ramp and writes a summary', async () => {
        const config = resolveConfig({
            baseUrl: stub.url, supabaseUrl: stub.url, envFile: NO_ENV_FILE,
            stages: [2, 4], stageSeconds: 0.4, days: 2, runId: 'selftest-0001',
        }, { NEXT_PUBLIC_SUPABASE_ANON_KEY: 'local-anon', E2E_TEST_BUSINESS_ID: BIZ });
        const calls = [];
        const run = await runLoad(config, {
            log: () => {},
            db: {
                checkIntegrity: (_c, id) => { calls.push(['check', id]); return { created: stub.stats.bookings, overlaps: 0 }; },
                cancelRunBookings: (_c, id) => { calls.push(['cancel', id]); return stub.stats.bookings; },
            },
        });
        assert.equal(run.cells.length, 10);
        for (const cell of run.cells) {
            const r = summarizeCell(cell);
            assert.ok(r.total > 0, `${cell.scenario} ${cell.vus} has samples`);
            assert.equal(r.errors, 0, `${cell.scenario} ${cell.vus}: ${JSON.stringify(r.statuses)}`);
            assert.ok(r.p50 <= r.p95 && r.p95 <= r.p99 && r.p99 <= r.max);
        }
        assert.ok(stub.stats.bookings > 0);
        assert.equal(stub.stats.xffMissing, 0);
        assert.deepEqual(calls.map(([k]) => k), ['check', 'cancel', 'check', 'cancel']);
        const md = formatMarkdown(run);
        for (const title of ['Главная', 'Каталог (поиск)', 'Страница бизнеса', 'Свободные слоты (RPC)', 'Создание записи (гость)']) {
            assert.match(md, new RegExp(`\\| ${title.replace(/[()]/g, '\\$&')} \\| 2 \\|`));
        }
        assert.match(md, /Очистка/);
    });

    it('reports integrity as not verified when the local database is unreachable', async () => {
        const config = resolveConfig({
            baseUrl: stub.url, supabaseUrl: stub.url, envFile: NO_ENV_FILE, scenarios: ['booking'],
            stages: [1], stageSeconds: 0.2, days: 1, runId: 'selftest-0002',
        }, { NEXT_PUBLIC_SUPABASE_ANON_KEY: 'local-anon', E2E_TEST_BUSINESS_ID: BIZ });
        const run = await runLoad(config, { log: () => {}, db: { checkIntegrity: () => { throw new Error('docker: daemon not running'); }, cancelRunBookings: () => 0 } });
        const md = formatMarkdown(run);
        assert.match(md, /не проверено: локальная БД через docker недоступна/);
        assert.match(md, /--cleanup-only selftest-0002/);
    });
});

// Integration fixture for 20261118220000_analytics_ingest_guards. A disposable PostgreSQL with the
// production analytics tables (from the baseline), Supabase-style default grants and the ENG-67
// tenant guard shows client roles writing analytics rows directly and oversized events being
// stored, applies the real migration and checks the grants, the size limits (existing rows are
// kept), and that events cannot point at another business's branch, service or master.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { POSTGRES_IMAGE } = require('./lib/isolated-postgres.cjs');
const { assertLiveFunctions } = require('./lib/live-schema.cjs');

const migrations = path.join(__dirname, '..', 'supabase', 'migrations');
const read = (file) => fs.readFileSync(path.join(migrations, file), 'utf8').replace(/\r/g, '');
function extract(file, start, end) {
    const text = read(file);
    const from = text.indexOf(start);
    assert.ok(from >= 0, `${start} not found in ${file}`);
    const to = text.indexOf(end, from);
    assert.ok(to > from, `${end} not found after ${start}`);
    return text.slice(from, to + end.length);
}
const baseline = '20261009110000_prod_baseline.sql';

const container = `kezek-analytics-guards-${randomUUID()}`;
const docker = (args, input = '') => new Promise((resolve, reject) => {
    const child = spawn('docker', args, { windowsHide: true });
    let out = '';
    let err = '';
    child.stdout.on('data', (data) => { out += data; });
    child.stderr.on('data', (data) => { err += data; });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(err || out || `exit ${code}`))));
    child.stdin.end(input);
});
const sql = (input) => docker(['exec', '-i', container, 'psql', '-X', '-q', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], input);

const [bizA, bizB, branchA, branchB, serviceA, serviceB, staffA, staffB] = Array.from({ length: 8 }, () => randomUUID());
const funnel = (overrides = {}) => {
    const row = { event_type: 'branch_select', source: 'public', biz_id: bizA, session_id: 's1', ...overrides };
    const cols = Object.keys(row);
    return `insert into public.funnel_events(${cols.join(', ')}) values (${cols.map((c) => (row[c] === null ? 'null' : `'${String(row[c]).replace(/'/g, "''")}'`)).join(', ')})`;
};
let created = false;

(async () => {
    try {
        await docker(['run', '--detach', '--rm', '--network', 'none', '--tmpfs', '/var/lib/postgresql/data', '--name', container, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', POSTGRES_IMAGE]);
        created = true;
        let ready = false;
        for (let i = 0; i < 120; i += 1) {
            try {
                if (await docker(['exec', container, 'cat', '/proc/1/comm']) === 'postgres') {
                    await docker(['exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres']);
                    ready = true;
                    break;
                }
            } catch { /* still starting */ }
            await new Promise((r) => setTimeout(r, 500));
        }
        assert.ok(ready, 'PostgreSQL did not start');

        await sql(`create role anon; create role authenticated; create role service_role bypassrls; create schema private;
            grant usage on schema public to anon, authenticated, service_role;
            create table public.branches(id uuid primary key, biz_id uuid);
            create table public.services(id uuid primary key, biz_id uuid);
            create table public.staff(id uuid primary key, biz_id uuid);
            insert into public.branches values ('${branchA}', '${bizA}'), ('${branchB}', '${bizB}');
            insert into public.services values ('${serviceA}', '${bizA}'), ('${serviceB}', '${bizB}');
            insert into public.staff values ('${staffA}', '${bizA}'), ('${staffB}', '${bizB}');`);
        await sql([
            extract(baseline, 'CREATE TABLE IF NOT EXISTS "public"."analytics_events"', '\n);\n'),
            extract(baseline, 'CREATE TABLE IF NOT EXISTS "public"."funnel_events"', '\n);\n'),
            extract('20261118110000_tenant_reference_guards.sql', 'create or replace function private.tenant_reference_guard()', '\n$$;'),
            // Supabase default privileges: client roles hold full table grants.
            'grant all on public.analytics_events, public.funnel_events to anon, authenticated, service_role;',
        ].join('\n'));

        // Before: a client role writes directly, any size; another business's branch is accepted.
        await sql(`set role anon; insert into public.analytics_events(event_type, source, metadata) values ('booking_created', 'system', jsonb_build_object('blob', repeat('x', 100000)))`);
        await sql(funnel({ branch_id: branchB }));
        assert.equal(await sql('select count(*) from public.analytics_events'), '1', 'API-09: direct anon write');

        await sql(read('20261118220000_analytics_ingest_guards.sql'));

        // Client roles: no grants left.
        for (const role of ['anon', 'authenticated']) {
            await assert.rejects(sql(`set role ${role}; insert into public.analytics_events(event_type, source) values ('home_view', 'web')`), /permission denied/);
            await assert.rejects(sql(`set role ${role}; select count(*) from public.funnel_events`), /permission denied/);
        }

        // Size limits hold for new rows; existing rows are kept (NOT VALID).
        await assert.rejects(sql(`insert into public.analytics_events(event_type, source, metadata) values ('home_view', 'web', jsonb_build_object('blob', repeat('y', 5000)))`), /analytics_events_bounded/);
        await assert.rejects(sql(`insert into public.analytics_events(event_type, source, session_id) values ('home_view', 'web', repeat('s', 65))`), /analytics_events_bounded/);
        await assert.rejects(sql(funnel({ metadata: JSON.stringify({ blob: 'z'.repeat(5000) }) })), /funnel_events_metadata_bounded/);
        await sql(`insert into public.analytics_events(event_type, source, session_id, metadata) values ('home_view', 'web', 'session_1', '{"locale":"ru"}')`);
        assert.equal(await sql('select count(*) from public.analytics_events'), '2');

        // Tenant references: another business's branch, service or master is refused.
        for (const overrides of [{ branch_id: branchB }, { service_id: serviceB }, { staff_id: staffB }]) {
            await assert.rejects(sql(funnel(overrides)), /TENANT_REFERENCE_MISMATCH/);
        }
        await sql(funnel({ branch_id: branchA, service_id: serviceA, staff_id: staffA }));
        await assert.rejects(sql(`insert into public.analytics_events(event_type, source, biz_id, branch_id) values ('business_page_view', 'web', '${bizA}', '${branchB}')`), /TENANT_REFERENCE_MISMATCH/);
        await sql(`insert into public.analytics_events(event_type, source, biz_id, branch_id) values ('business_page_view', 'web', '${bizA}', '${branchA}')`);


        await assertLiveFunctions(sql, { suite: 'test-analytics-ingest-guards-isolated.cjs' });
        console.log('analytics ingest guards: ok');
    } finally {
        if (created) await docker(['rm', '--force', container]).catch(() => undefined);
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

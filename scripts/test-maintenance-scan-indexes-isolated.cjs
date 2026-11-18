// Integration fixture for 20261118200000_maintenance_scan_indexes. A disposable PostgreSQL with
// 100k historical bookings and 20k pruned outbox tombstones shows the per-minute hold purge and
// the outbox prune reading the whole table, applies the real migration (twice) and checks that
// both jobs then read only the live rows through the new partial indexes, with unchanged results.
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

const container = `kezek-maint-indexes-${randomUUID()}`;
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
const plan = async (query) => JSON.parse(await sql(`explain (format json, costs off) ${query}`))[0].Plan;
const nodes = (node) => [node, ...(node.Plans ?? []).flatMap(nodes)];
const scans = (node) => nodes(node).map((item) => `${item['Node Type']}:${item['Index Name'] ?? item['Relation Name'] ?? ''}`);
let created = false;

const purgeWhere = `status = 'hold' and expires_at is not null and expires_at < now()`;
const pruneSelect = `select id from public.booking_notification_outbox where
    (completed_at < now() - interval '30 days' or prepared_at < now() - interval '30 days')
    and payloads_pruned_at is null and (status <> 'processing' or lease_until <= now())`;

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

        await sql(`create type public.booking_status as enum ('hold', 'confirmed', 'paid', 'cancelled', 'no_show');
            create table public.bookings(id uuid primary key default gen_random_uuid(), biz_id uuid not null, staff_id uuid not null,
                status public.booking_status not null default 'hold', start_at timestamptz not null, end_at timestamptz not null, expires_at timestamptz);
            create index bookings_biz_status_start_at_idx on public.bookings (biz_id, status, start_at desc);
            insert into public.bookings(biz_id, staff_id, status, start_at, end_at)
                select gen_random_uuid(), gen_random_uuid(), (array['confirmed','paid','cancelled','no_show']::public.booking_status[])[1 + g % 4],
                       now() - g * interval '10 minutes', now() - g * interval '10 minutes' + interval '1 hour'
                  from generate_series(1, 100000) g;
            insert into public.bookings(biz_id, staff_id, status, start_at, end_at, expires_at) values
                (gen_random_uuid(), gen_random_uuid(), 'hold', now() + interval '1 day', now() + interval '1 day 1 hour', now() - interval '1 minute'),
                (gen_random_uuid(), gen_random_uuid(), 'hold', now() + interval '1 day', now() + interval '1 day 1 hour', now() - interval '3 hours'),
                (gen_random_uuid(), gen_random_uuid(), 'hold', now() + interval '1 day', now() + interval '1 day 1 hour', now() + interval '2 minutes'),
                (gen_random_uuid(), gen_random_uuid(), 'hold', now() + interval '1 day', now() + interval '1 day 1 hour', null);
            create table public.booking_notification_outbox(id uuid primary key default gen_random_uuid(), status text not null default 'pending',
                lease_until timestamptz, prepared_at timestamptz, completed_at timestamptz, payloads_pruned_at timestamptz);
            insert into public.booking_notification_outbox(status, completed_at, payloads_pruned_at)
                select 'sent', now() - interval '70 days', now() - interval '40 days' from generate_series(1, 20000);
            insert into public.booking_notification_outbox(status, completed_at) select 'sent', now() - interval '31 days' from generate_series(1, 3);
            insert into public.booking_notification_outbox(status, prepared_at) values ('failed', now() - interval '31 days');
            insert into public.booking_notification_outbox(status, completed_at) select 'sent', now() from generate_series(1, 50);
            analyze public.bookings; analyze public.booking_notification_outbox;`);
        await sql(extract('20261009110000_prod_baseline.sql', 'CREATE OR REPLACE FUNCTION "public"."purge_expired_holds"()', 'end $$;'));

        // Before: the purge walks a whole composite index or the table; the prune reads every outbox row.
        const purgeBefore = scans(await plan(`update public.bookings set status = 'cancelled', expires_at = null where ${purgeWhere}`));
        assert.ok(!purgeBefore.some((scan) => scan.includes('bookings_hold_expires_at_idx')), 'DB-12: no hold index yet');
        assert.ok(scans(await plan(pruneSelect)).some((scan) => scan.startsWith('Seq Scan:booking_notification_outbox')), 'DB-12: outbox seq scan');

        await sql(read('20261118200000_maintenance_scan_indexes.sql'));
        await sql(read('20261118200000_maintenance_scan_indexes.sql'));
        await sql('analyze public.bookings; analyze public.booking_notification_outbox;');

        // After: both jobs read only their live rows through the partial indexes.
        const purgeAfter = scans(await plan(`update public.bookings set status = 'cancelled', expires_at = null where ${purgeWhere}`));
        assert.ok(purgeAfter.some((scan) => scan.endsWith(':bookings_hold_expires_at_idx')), purgeAfter.join(' '));
        const pruneAfter = scans(await plan(pruneSelect));
        // Either retention index covers exactly the unpruned rows; the planner may read one whole
        // (few live rows) or combine both (BitmapOr) when the backlog is large.
        assert.ok(pruneAfter.some((scan) => /:booking_notification_outbox_(completed|prepared)_retention$/.test(scan)), pruneAfter.join(' '));
        assert.ok(!pruneAfter.some((scan) => scan.startsWith('Seq Scan')), pruneAfter.join(' '));
        const buffers = JSON.parse(await sql(`explain (analyze, buffers, format json, costs off) update public.bookings set status = status where ${purgeWhere}`))[0].Plan;
        const pages = nodes(buffers).reduce((sum, node) => sum + (node['Shared Hit Blocks'] ?? 0) + (node['Shared Read Blocks'] ?? 0), 0);
        assert.ok(pages < 50, `the purge reads ${pages} pages`);
        assert.equal(await sql(`select count(*) from (${pruneSelect}) expired`), '4');

        // The real function's result is unchanged: the two expired holds are cancelled, the others stay.
        await sql('select public.purge_expired_holds()');
        assert.equal(await sql(`select string_agg(status::text || ':' || coalesce((expires_at > now())::text, 'null'), ',' order by status, expires_at nulls last)
            from public.bookings where start_at > now()`), 'hold:true,hold:null,cancelled:null,cancelled:null');

        await assertLiveFunctions(sql, { suite: 'test-maintenance-scan-indexes-isolated.cjs' });
        console.log(`maintenance scan indexes: ok (purge reads ${pages} pages of 100k bookings)`);
    } finally {
        if (created) await docker(['rm', '--force', container]).catch(() => undefined);
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

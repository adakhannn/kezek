// Integration fixture for 20261119000000_visit_package_sale_identity (API-11). A disposable
// PostgreSQL with the columns the migration touches shows that, before it, a repeated sale
// stored a second package; then applies it and checks that a sale request key is unique (a
// retry cannot sell twice, sales without a key still work), and that the visit lookup counts a
// package's last day in the business's own time zone - for a business far ahead of UTC and one
// far behind it - while keeping the function's grants.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { POSTGRES_IMAGE } = require('./lib/isolated-postgres.cjs');
const { assertLiveFunctions } = require('./lib/live-schema.cjs');

const migration = fs.readFileSync(
    path.join(__dirname, '..', 'supabase', 'migrations', '20261119000000_visit_package_sale_identity.sql'),
    'utf8',
).replace(/\r/g, '');

const container = `kezek-visit-package-sale-${randomUUID()}`;
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

const ids = Object.fromEntries(['ahead', 'behind', 'client', 'branch', 'service', 'planAhead', 'planBehind', 'bookingAhead', 'bookingBehind'].map((key) => [key, randomUUID()]));

const fixture = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create table public.businesses (id uuid primary key, tz text);
create table public.bookings (id uuid primary key, biz_id uuid not null, client_id uuid, branch_id uuid, service_id uuid, status text not null);
create table public.visit_package_plans (id uuid primary key, biz_id uuid not null, service_id uuid, branch_ids uuid[], is_active boolean not null default true);
create table public.client_visit_packages (id uuid primary key default gen_random_uuid(), client_id uuid not null, plan_id uuid not null,
    remaining_visits integer not null, valid_until date not null, purchased_at timestamptz not null default now(), created_at timestamptz not null default now());
create table public.client_visit_package_uses (id uuid primary key default gen_random_uuid(), booking_id uuid not null);
create function public.assert_booking_finance_access(p_booking_id uuid) returns void language sql as 'select';

insert into public.businesses values ('${ids.ahead}', 'Pacific/Kiritimati'), ('${ids.behind}', 'Pacific/Pago_Pago');
insert into public.visit_package_plans(id, biz_id) values ('${ids.planAhead}', '${ids.ahead}'), ('${ids.planBehind}', '${ids.behind}');
insert into public.bookings values
    ('${ids.bookingAhead}', '${ids.ahead}', '${ids.client}', '${ids.branch}', '${ids.service}', 'paid'),
    ('${ids.bookingBehind}', '${ids.behind}', '${ids.client}', '${ids.branch}', '${ids.service}', 'paid');
`;

const localToday = (tz) => `(now() at time zone '${tz}')::date`;
const lookup = (booking) => sql(`select coalesce(public.get_applicable_visit_package_for_booking('${booking}')::text, 'none')`);
const packageFor = (plan, validUntil) => sql(`delete from public.client_visit_packages;
    insert into public.client_visit_packages(client_id, plan_id, remaining_visits, valid_until)
    values ('${ids.client}', '${plan}', 3, ${validUntil}) returning id`);

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
        await sql(fixture);

        // Before: the same sale twice stores two packages.
        const sale = `insert into public.client_visit_packages(client_id, plan_id, remaining_visits, valid_until)
            values ('${ids.client}', '${ids.planAhead}', 5, current_date + 30)`;
        await sql(`${sale}; ${sale};`);
        assert.equal(await sql('select count(*) from public.client_visit_packages'), '2', 'API-11: a repeated sale was stored twice');
        await sql('delete from public.client_visit_packages');

        await sql(migration);

        // A sale request key is unique; sales without a key are unaffected.
        const key = randomUUID();
        const keyed = `insert into public.client_visit_packages(client_id, plan_id, remaining_visits, valid_until, request_id)
            values ('${ids.client}', '${ids.planAhead}', 5, current_date + 30, '${key}')`;
        await sql(keyed);
        await assert.rejects(sql(keyed), /client_visit_packages_request_id_key/);
        await sql(`${sale}; ${sale};`);
        assert.equal(await sql('select count(*) from public.client_visit_packages'), '3');
        await sql('delete from public.client_visit_packages');

        // The last day counts in the business's calendar: ahead of UTC (Kiritimati, UTC+14) and
        // behind it (Pago Pago, UTC-11), whatever the UTC date is right now.
        const aheadToday = localToday('Pacific/Kiritimati');
        const behindToday = localToday('Pacific/Pago_Pago');
        let packageId = await packageFor(ids.planAhead, aheadToday);
        assert.equal(await lookup(ids.bookingAhead), packageId, 'valid through its last local day');
        await packageFor(ids.planAhead, `${aheadToday} - 1`);
        assert.equal(await lookup(ids.bookingAhead), 'none', 'expired after its last local day');
        packageId = await packageFor(ids.planBehind, behindToday);
        assert.equal(await lookup(ids.bookingBehind), packageId);
        await packageFor(ids.planBehind, `${behindToday} - 1`);
        assert.equal(await lookup(ids.bookingBehind), 'none');

        // A business without a stored time zone uses Asia/Bishkek.
        await sql(`update public.businesses set tz = null where id = '${ids.behind}'`);
        packageId = await packageFor(ids.planBehind, localToday('Asia/Bishkek'));
        assert.equal(await lookup(ids.bookingBehind), packageId);

        // Grants unchanged: clients and the service role, never anon.
        assert.equal(await sql(`select string_agg(r, ',' order by r) from unnest(array['anon','authenticated','service_role']) r
            where has_function_privilege(r, 'public.get_applicable_visit_package_for_booking(uuid)', 'execute')`), 'authenticated,service_role');

        await assertLiveFunctions(sql, { suite: 'test-visit-package-sale-identity-isolated.cjs' });
        console.log('Visit package sale identity (API-11): one package per sale key, last day in the business time zone.');
    } finally {
        if (created) await docker(['rm', '-f', container]).catch(() => {});
    }
})().catch((error) => {
    console.error(error);
    process.exit(1);
});

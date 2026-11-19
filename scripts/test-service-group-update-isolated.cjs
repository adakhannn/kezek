// Integration fixture for 20261119130000_service_group_update_command (ARCH-07). A disposable
// PostgreSQL holds the tables the command touches, shaped as production has them (keys, checks and
// delete rules), runs the real migration and checks that an edit of a service group is saved whole
// or not at all, that history and sold packages keep their copies, and that concurrent edits wait.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { POSTGRES_IMAGE } = require('./lib/isolated-postgres.cjs');
const { assertLiveFunctions, SUPABASE_DEFAULT_PRIVILEGES } = require('./lib/live-schema.cjs');

const migration = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '20261119130000_service_group_update_command.sql'), 'utf8');
const container = `kezek-service-group-${randomUUID()}`;
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
const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const biz = id(1), otherBiz = id(2);
const [b1, b2, b3, b4, b5, b6, foreignBranch] = [11, 12, 13, 14, 15, 16, 19].map(id);
const call = (service, branches, { name = 'Massage Pro', duration = 90, from = 1200, to = 1800, active = true, business = biz } = {}) =>
    `select public.update_service_group('${business}', '${service}', array[${branches.map((b) => `'${b}'`).join(',')}]::uuid[],
        '${name}', null, 'Massage Pro', ${duration}, ${from}, ${to}, ${active})`;
const snapshot = () => sql(`select md5(coalesce(string_agg(s::text, '|' order by s.id), '')) from public.services s`);
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

        // Keys, checks and delete rules of the prod baseline for what the command reads and writes.
        await sql(`create role anon; create role authenticated; create role service_role bypassrls;
            ${SUPABASE_DEFAULT_PRIVILEGES}
            create type public.booking_status as enum ('hold', 'confirmed', 'paid', 'cancelled', 'no_show');
            create table public.businesses(id uuid primary key);
            create table public.branches(id uuid primary key, biz_id uuid not null references public.businesses, name text not null);
            create table public.services(id uuid primary key default gen_random_uuid(), biz_id uuid not null references public.businesses on delete cascade,
                branch_id uuid not null references public.branches, name_ru text not null, name_ky text, name_en text,
                duration_min integer not null check (duration_min > 0), price_from numeric not null, price_to numeric not null,
                active boolean default true, created_at timestamptz default now(),
                constraint services_price_range_check check (price_from >= 0 and price_to >= price_from));
            create table public.bookings(id uuid primary key default gen_random_uuid(), service_id uuid references public.services on delete restrict,
                start_at timestamptz not null, status public.booking_status not null default 'confirmed');
            create table public.booking_services(id uuid primary key default gen_random_uuid(), booking_id uuid not null references public.bookings on delete cascade,
                service_id uuid not null references public.services on delete restrict);
            create table public.visit_package_plans(id uuid primary key default gen_random_uuid(), service_id uuid references public.services on delete set null);
            create table public.service_staff(service_id uuid not null references public.services on delete cascade, staff_id uuid not null);

            insert into public.businesses values ('${biz}'), ('${otherBiz}');
            insert into public.branches values ('${b1}', '${biz}', 'Center'), ('${b2}', '${biz}', 'North'), ('${b3}', '${biz}', 'South'),
                ('${b4}', '${biz}', 'East'), ('${b5}', '${biz}', 'West'), ('${b6}', '${biz}', 'Lake'),
                ('${foreignBranch}', '${otherBiz}', 'Foreign');
            -- "Massage" in five branches: the edited copy, a copy with a past booking, a copy with only a
            -- cancelled future booking, a copy sold in a package and an unused copy.
            insert into public.services(id, biz_id, branch_id, name_ru, duration_min, price_from, price_to) values
                ('${id(101)}', '${biz}', '${b1}', 'Massage', 60, 1000, 1500), ('${id(102)}', '${biz}', '${b2}', 'Massage', 60, 1000, 1500),
                ('${id(103)}', '${biz}', '${b3}', 'Massage', 60, 1000, 1500), ('${id(104)}', '${biz}', '${b4}', 'Massage', 60, 1000, 1500),
                ('${id(106)}', '${biz}', '${b6}', 'Massage', 60, 1000, 1500),
                ('${id(105)}', '${biz}', '${b1}', 'Other', 30, 100, 200),
                ('${id(109)}', '${otherBiz}', '${foreignBranch}', 'Massage', 60, 1000, 1500);
            insert into public.bookings(service_id, start_at, status) values ('${id(102)}', now() - interval '3 days', 'paid'),
                ('${id(103)}', now() + interval '3 days', 'cancelled');
            insert into public.visit_package_plans(service_id) values ('${id(104)}');
            insert into public.service_staff values ('${id(106)}', '${id(900)}'), ('${id(101)}', '${id(900)}');`);

        await sql(migration);

        // Only the service role may run it.
        const signature = 'public.update_service_group(uuid, uuid, uuid[], text, text, text, integer, numeric, numeric, boolean)';
        for (const role of ['anon', 'authenticated']) {
            assert.equal(await sql(`select has_function_privilege('${role}', '${signature}', 'EXECUTE')`), 'f', role);
        }
        assert.equal(await sql(`select has_function_privilege('service_role', '${signature}', 'EXECUTE')`), 't');

        // Refusals change nothing: another business's service, a foreign branch, an invalid price range.
        const before = await snapshot();
        await assert.rejects(sql(`set role service_role; ${call(id(109), [b1])}`), /SERVICE_FORBIDDEN/);
        await assert.rejects(sql(`set role service_role; ${call(id(101), [b1, foreignBranch])}`), new RegExp(`SERVICE_BRANCH_FORBIDDEN[\\s\\S]*${foreignBranch}`));
        await assert.rejects(sql(`set role service_role; ${call(id(101), [b1], { from: 2000, to: 1000 })}`), /services_price_range_check/);
        await assert.rejects(sql(`set role service_role; ${call(id(101), [])}`), /SERVICE_BRANCH_REQUIRED/);
        assert.equal(await snapshot(), before);

        // The whole edit: keep and rename Center, add West, and drop the rest. North (a past booking),
        // South (a cancelled future booking: it does not block, but the booking keeps the copy) and East
        // (sold in a package) are switched off; Lake is unused and deleted with its staff links.
        assert.deepEqual(JSON.parse(await sql(`set role service_role; ${call(id(101), [b1, b5, b1])}`)), { updated: 1, added: 1, deleted: 1, archived: 3 });
        assert.equal(await sql(`select string_agg(concat_ws(':', b.name, s.name_ru, s.duration_min, s.price_from, s.price_to, s.active), ',' order by b.name)
            from public.services s join public.branches b on b.id = s.branch_id where s.biz_id = '${biz}' and s.name_ru like 'Massage%'`),
            'Center:Massage Pro:90:1200:1800:t,East:Massage:60:1000:1500:f,North:Massage:60:1000:1500:f,South:Massage:60:1000:1500:f,West:Massage Pro:90:1200:1800:t');
        assert.equal(await sql(`select count(*) from public.services where id = '${id(106)}'`), '0');
        assert.equal(await sql(`select string_agg(service_id::text, ',') from public.service_staff`), id(101));
        assert.equal(await sql(`select count(*) from public.visit_package_plans where service_id = '${id(104)}'`), '1');
        assert.equal(await sql(`select concat_ws(':', name_ru, active) from public.services where id = '${id(105)}'`), 'Other:t');

        // A removed copy with a future booking, single or complex, refuses the whole edit.
        await sql(`insert into public.services(id, biz_id, branch_id, name_ru, duration_min, price_from, price_to) values
                ('${id(201)}', '${biz}', '${b1}', 'Hair', 60, 500, 500), ('${id(202)}', '${biz}', '${b2}', 'Hair', 60, 500, 500),
                ('${id(203)}', '${biz}', '${b3}', 'Hair', 60, 500, 500);
            insert into public.bookings(id, service_id, start_at) values ('${id(301)}', '${id(202)}', now() + interval '1 day'),
                ('${id(302)}', null, now() + interval '2 days');
            insert into public.booking_services(booking_id, service_id) values ('${id(302)}', '${id(203)}');`);
        const busy = await snapshot();
        await assert.rejects(sql(`set role service_role; ${call(id(201), [b1], { name: 'Hair' })}`),
            /SERVICE_BRANCH_HAS_FUTURE_BOOKINGS[\s\S]*DETAIL:\s+North, South/);
        assert.equal(await snapshot(), busy);

        // Concurrent edits of one group wait for each other instead of interleaving.
        const key = Math.floor(Math.random() * 1e9) + 1;
        const holder = sql(`begin; select 1 from public.services where id = '${id(201)}' for update; select pg_advisory_xact_lock(${key}); select pg_sleep(2); commit;`);
        holder.catch(() => {});
        let held = false;
        for (let i = 0; i < 100 && !held; i += 1) {
            held = (await sql(`select count(*) from pg_locks where locktype = 'advisory' and objid = ${key} and granted`)) === '1';
            if (!held) await new Promise((r) => setTimeout(r, 20));
        }
        assert.ok(held, 'the first edit did not take its lock');
        const second = sql(`set application_name = 'service_group_${key}'; set role service_role; ${call(id(201), [b1, b2, b3], { name: 'Hair', from: 600, to: 600 })}`);
        second.catch(() => {});
        let waiting = false;
        for (let i = 0; i < 100 && !waiting; i += 1) {
            waiting = (await sql(`select count(*) from pg_stat_activity where application_name = 'service_group_${key}' and wait_event_type = 'Lock'`)) === '1';
            if (!waiting) await new Promise((r) => setTimeout(r, 20));
        }
        assert.ok(waiting, 'the second edit did not wait for the first');
        await holder;
        assert.deepEqual(JSON.parse(await second), { updated: 3, added: 0, deleted: 0, archived: 0 });
        assert.equal(await sql(`select string_agg(price_from::text, ',' order by id) from public.services where name_ru = 'Hair'`), '600,600,600');

        await assertLiveFunctions(sql, { suite: 'test-service-group-update-isolated.cjs' });
        console.log('service group update: ok');
    } finally {
        if (created) await docker(['rm', '--force', container]).catch(() => undefined);
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

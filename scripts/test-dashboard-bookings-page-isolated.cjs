// Integration fixture for 20261118190000_dashboard_bookings_page. A disposable PostgreSQL with the
// booking tables and the production business-manager predicates checks what the dashboard list now
// gets from one read: search over the whole history (beyond the first page), literal matching,
// phone digits across formats, id prefixes, ordered disjoint pages, the total of matches, filters,
// profile names, and that only managers of the business (or the service role) can call it.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');

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

const container = `kezek-dash-bookings-${randomUUID()}`;
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
const as = (role, sub) => `set role ${role}; set request.jwt.claims='${JSON.stringify({ sub: sub ?? '', role })}';`;

const [bizA, bizB, branchA, branchA2, branchB] = Array.from({ length: 5 }, () => randomUUID());
const [owner, manager, stranger, managerB, superAdmin, ownerOnly, client] = Array.from({ length: 7 }, () => randomUUID());
const [staffA, staffA2, staffB] = Array.from({ length: 3 }, () => randomUUID());
const [haircut, manicure, serviceB] = Array.from({ length: 3 }, () => randomUUID());
const oldest = randomUUID();
const legacy = randomUUID();
const complex = randomUUID();
const callA = (args = '') => `select public.dashboard_bookings_page('${bizA}'${args ? `, ${args}` : ''})::text`;
let created = false;

(async () => {
    try {
        await docker(['run', '--detach', '--rm', '--network', 'none', '--tmpfs', '/var/lib/postgresql/data', '--name', container, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:16']);
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

        await sql(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth;
            create function auth.uid() returns uuid language sql stable as $$ select nullif(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub','')::uuid $$;
            create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role' $$;
            grant usage on schema auth to anon, authenticated, service_role;
            grant usage on schema public to anon, authenticated, service_role;
            create type public.booking_status as enum ('hold', 'confirmed', 'paid', 'cancelled', 'no_show');
            create table public.businesses(id uuid primary key, owner_id uuid);
            create table public.roles(id uuid primary key, key text, scope text);
            create table public.user_roles(user_id uuid, role_id uuid, biz_id uuid);
            create table public.user_global_roles(user_id uuid, role_id uuid);
            create table public.super_admins_legacy(user_id uuid);
            create table public.profiles(id uuid primary key, full_name text);
            create table public.staff(id uuid primary key, biz_id uuid, full_name text);
            create table public.services(id uuid primary key, biz_id uuid, name_ru text not null, name_ky text, name_en text);
            create table public.bookings(id uuid primary key default gen_random_uuid(), biz_id uuid not null, branch_id uuid not null,
                service_id uuid not null, staff_id uuid not null, client_id uuid, client_name text, client_phone text,
                status public.booking_status not null, start_at timestamptz not null, end_at timestamptz not null);
            create table public.booking_services(id uuid primary key default gen_random_uuid(), booking_id uuid not null,
                service_id uuid not null, duration_min integer not null, order_index integer default 0 not null);
            insert into public.roles values ('00000000-0000-0000-0000-000000000001', 'manager', 'business'),
                ('00000000-0000-0000-0000-000000000002', 'super_admin', 'platform'), ('00000000-0000-0000-0000-000000000003', 'client', 'business');
            insert into public.businesses values ('${bizA}', '${owner}'), ('${bizB}', '${managerB}');
            insert into public.user_roles values ('${manager}', '00000000-0000-0000-0000-000000000001', '${bizA}'),
                ('${managerB}', '00000000-0000-0000-0000-000000000001', '${bizB}'), ('${client}', '00000000-0000-0000-0000-000000000003', '${bizA}');
            insert into public.user_global_roles values ('${superAdmin}', '00000000-0000-0000-0000-000000000002');
            insert into public.staff values ('${staffA}', '${bizA}', 'Адахан Мастер'), ('${staffA2}', '${bizA}', 'Второй Мастер'), ('${staffB}', '${bizB}', 'Адахан Мастер');
            insert into public.services values ('${haircut}', '${bizA}', 'Стрижка', 'Чач кыркуу', 'Haircut'),
                ('${manicure}', '${bizA}', 'Маникюр', null, null), ('${serviceB}', '${bizB}', 'Стрижка', null, null);
            insert into public.profiles values ('${legacy}', 'Жылдыз Профиль');
            -- 75 non-cancelled bookings in A: ten share one start time; the oldest one belongs to 'Айгерим Старая'
            insert into public.bookings(biz_id, branch_id, service_id, staff_id, client_name, client_phone, status, start_at, end_at)
                select '${bizA}', case when n % 2 = 0 then '${branchA}'::uuid else '${branchA2}'::uuid end, '${haircut}', '${staffA}',
                       'Клиент ' || n, '+99670000' || lpad(n::text, 4, '0'),
                       (array['hold','confirmed','paid','no_show']::public.booking_status[])[1 + n % 4],
                       case when n < 10 then timestamptz '2026-11-01 10:00+06' else timestamptz '2026-11-01 10:00+06' - n * interval '1 day' end,
                       case when n < 10 then timestamptz '2026-11-01 11:00+06' else timestamptz '2026-11-01 11:00+06' - n * interval '1 day' end
                  from generate_series(1, 71) n;
            insert into public.bookings(id, biz_id, branch_id, service_id, staff_id, client_name, client_phone, status, start_at, end_at) values
                ('${oldest}', '${bizA}', '${branchA}', '${haircut}', '${staffA2}', 'Айгерим Старая', '0555 12-34-56', 'paid', '2024-01-05 10:00+06', '2024-01-05 11:00+06');
            insert into public.bookings(id, biz_id, branch_id, service_id, staff_id, client_id, client_name, client_phone, status, start_at, end_at) values
                ('${legacy}', '${bizA}', '${branchA}', '${haircut}', '${staffA}', '${legacy}', '  ', '+996555123456', 'confirmed', '2025-03-01 10:00+06', '2025-03-01 11:00+06');
            insert into public.bookings(id, biz_id, branch_id, service_id, staff_id, client_name, status, start_at, end_at) values
                ('${complex}', '${bizA}', '${branchA}', '${haircut}', '${staffA}', 'Скидка 50%', 'hold', '2025-04-01 10:00+06', '2025-04-01 12:00+06');
            insert into public.booking_services(booking_id, service_id, duration_min, order_index) values
                ('${complex}', '${manicure}', 60, 2), ('${complex}', '${haircut}', 30, 1);
            insert into public.bookings(biz_id, branch_id, service_id, staff_id, client_name, status, start_at, end_at) values
                ('${bizA}', '${branchA}', '${haircut}', '${staffA}', 'name_with_underscore', 'confirmed', '2025-05-01 10:00+06', '2025-05-01 11:00+06');
            insert into public.bookings(biz_id, branch_id, service_id, staff_id, client_name, status, start_at, end_at)
                select '${bizA}', '${branchA}', '${haircut}', '${staffA}', 'Отмена ' || n, 'cancelled', now() - n * interval '1 hour', now() - n * interval '1 hour' + interval '30 minutes'
                  from generate_series(1, 5) n;
            insert into public.bookings(biz_id, branch_id, service_id, staff_id, client_name, client_phone, status, start_at, end_at) values
                ('${bizB}', '${branchB}', '${serviceB}', '${staffB}', 'Айгерим Старая', '+996555123456', 'paid', '2024-01-05 10:00+06', '2024-01-05 11:00+06');
            grant select on all tables in schema public to anon, authenticated;`);
        await sql([
            extract('20261110131000_shift_hours_adjustment.sql', 'create or replace function public.finance_is_platform_admin', '\n$$;'),
            extract('20261110131000_shift_hours_adjustment.sql', 'create or replace function public.finance_can_manage_business', '\n$$;'),
        ].join('\n'));
        await sql(read('20261118190000_dashboard_bookings_page.sql'));

        const page = async (args, who = manager) => JSON.parse(await sql(`${as('authenticated', who)} ${callA(args)}`));

        // (1) the whole history is searched: the oldest booking is found from page 1, total 1
        const found = await page(`p_search => 'айгерим старая'`);
        assert.equal(found.total, 1);
        assert.equal(found.rows[0].id, oldest);
        assert.equal(found.rows[0].staff_name, 'Второй Мастер');

        // (2) ordered, disjoint pages with the real total of matches (75 non-cancelled)
        const pages = await Promise.all([0, 30, 60, 90].map((offset) => page(`p_offset => ${offset}`)));
        assert.deepEqual(pages.map((p) => p.rows.length), [30, 30, 15, 0]);
        assert.ok(pages.every((p) => p.total === 75));
        const ids = pages.flatMap((p) => p.rows.map((row) => row.id));
        assert.equal(new Set(ids).size, 75);
        const order = pages.flatMap((p) => p.rows.map((row) => [row.start_at, row.id]));
        for (let i = 1; i < order.length; i += 1) {
            const [prevStart, prevId] = order[i - 1];
            const [start, id] = order[i];
            assert.ok(new Date(prevStart) > new Date(start) || (prevStart === start && prevId > id), `order at ${i}`);
        }

        // (3) statuses
        assert.equal((await page(`p_status => 'any'`)).total, 80);
        assert.equal((await page(`p_status => 'cancelled'`)).total, 5);
        assert.ok((await page(`p_status => 'holdConfirmed', p_limit => 100`)).rows.every((row) => ['hold', 'confirmed'].includes(row.status)));
        await assert.rejects(page(`p_status => 'bogus'`), /DASHBOARD_BOOKINGS_BAD_STATUS/);

        // (4) id prefixes: '#' and dashes ignored, at least 4 hex digits; '----' is not "everything"
        assert.equal((await page(`p_search => '#${oldest.slice(0, 8).toUpperCase()}'`)).rows[0].id, oldest);
        assert.equal((await page(`p_search => '${oldest}'`)).rows[0].id, oldest);
        assert.equal((await page(`p_search => '${oldest.replace(/-/g, '')}'`)).rows[0].id, oldest);
        assert.equal((await page(`p_search => '----'`)).total, 0);

        // (5) phone digits across formats; LIKE characters are literal
        const phone = await page(`p_search => '555 12 34'`);
        assert.deepEqual(phone.rows.map((row) => row.id).sort(), [legacy, oldest].sort());
        assert.deepEqual((await page(`p_search => '+996555'`)).rows.map((row) => row.id), [legacy]);
        assert.deepEqual((await page(`p_search => '50%'`)).rows.map((row) => row.id), [complex]);
        assert.equal((await page(`p_search => '_'`)).total, 1);

        // (6) staff, service (ru/ky/en and complex booking services) and profile names
        assert.equal((await page(`p_search => 'АДАХАН'`)).total, 74);
        assert.equal((await page(`p_search => 'чач'`)).total, 75);
        assert.equal((await page(`p_search => 'haircut'`)).total, 75);
        const complexRow = (await page(`p_search => 'маникюр'`)).rows;
        assert.deepEqual(complexRow.map((row) => row.id), [complex]);
        assert.deepEqual(complexRow[0].booking_services.map((item) => item.service.name_ru), ['Стрижка', 'Маникюр']);
        const legacyRow = (await page(`p_search => 'жылдыз'`)).rows;
        assert.deepEqual(legacyRow.map((row) => [row.id, row.client_name]), [[legacy, 'Жылдыз Профиль']]);

        // (7) branch, staff and time window
        assert.ok((await page(`p_branch_id => '${branchA2}', p_limit => 100`)).rows.every((row) => row.branch_id === branchA2));
        assert.deepEqual((await page(`p_staff_id => '${staffA2}'`)).rows.map((row) => row.id), [oldest]);
        const day = await page(`p_status => 'any', p_start_from => '2026-11-01 00:00+06', p_start_before => '2026-11-02 00:00+06'`);
        assert.equal(day.total, 9);

        // (8) who may read: managers of A (role, owner_id only, platform admin) and the service role
        for (const who of [owner, superAdmin]) assert.equal((await page('', who)).total, 75);
        await sql(`delete from public.user_roles where user_id = '${owner}'`);
        assert.equal((await page('', owner)).total, 75, 'an owner known only through businesses.owner_id');
        assert.equal(JSON.parse(await sql(`${as('service_role')} ${callA()}`)).total, 75);
        for (const who of [stranger, managerB, client]) {
            await assert.rejects(page('', who), /DASHBOARD_BOOKINGS_FORBIDDEN/, who);
        }
        await assert.rejects(sql(`${as('anon')} ${callA()}`), /permission denied for function/);

        // (9) clamps; (10) definer settings; (11) another business's rows never appear
        assert.equal((await page(`p_limit => 1000`)).rows.length, 75);
        assert.equal((await page(`p_limit => 1000, p_offset => -5`)).rows.length, 75);
        assert.equal(await sql(`select prosecdef::text || ',' || provolatile::text || ',' || array_to_string(proconfig, ';')
            from pg_proc where proname = 'dashboard_bookings_page'`), 'true,s,search_path=pg_catalog, public');
        const all = await page(`p_status => 'any', p_limit => 100, p_offset => 0`);
        assert.ok(!all.rows.some((row) => row.branch_id === branchB));

        // A large business stays fast: 20k bookings, a search scans them within a second.
        await sql(`insert into public.bookings(biz_id, branch_id, service_id, staff_id, client_name, client_phone, status, start_at, end_at)
            select '${bizA}', '${branchA}', '${haircut}', '${staffA}', 'Нагрузка ' || n, '+99677' || lpad(n::text, 7, '0'), 'paid',
                   timestamptz '2020-01-01' + n * interval '1 hour', timestamptz '2020-01-01' + n * interval '1 hour' + interval '30 minutes'
              from generate_series(1, 20000) n; analyze public.bookings;`);
        const started = Date.now();
        const heavy = await page(`p_search => 'нагрузка 1999'`);
        const elapsed = Date.now() - started;
        assert.equal(heavy.total, 11);
        assert.ok(elapsed < 5000, `search took ${elapsed} ms`);

        console.log(`dashboard bookings page: ok (20k-row search ${elapsed} ms incl. docker exec)`);
    } finally {
        if (created) await docker(['rm', '--force', container]).catch(() => undefined);
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

// Integration fixture for 20261118100000_booking_service_staff_checks. A disposable PostgreSQL
// loads the previous production bodies of the slots and hold commands straight from the earlier
// migrations, shows that they book a master for a service they do not perform, accept a
// client-chosen duration (a year) outside the schedule and start in the past, then applies the
// real migration and checks the new rules, including temporary transfers and businesses that
// never linked services to staff.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { POSTGRES_IMAGE } = require('./lib/isolated-postgres.cjs');
const { assertLiveFunctions, liveFunctionSql, SUPABASE_DEFAULT_PRIVILEGES } = require('./lib/live-schema.cjs');

// The schedule fixture replaces the resolver of versioned schedules; everything that reads it is live.
const stubs = {
    'public.schedule_effective_day(uuid,date)': {
        reason: 'the live body resolves versioned schedules, absences, legacy rules and home-branch changes; '
            + 'this suite needs a fixed 09:00-18:00 day in the home branch or in a temporary transfer branch',
        skip: ['body'],
    },
};

const migrations = path.join(__dirname, '..', 'supabase', 'migrations');
const read = (file) => fs.readFileSync(path.join(migrations, file), 'utf8').replace(/\r/g, '');
// One CREATE FUNCTION statement of an earlier migration, from its first line to its terminator.
function extract(file, start, end) {
    const text = read(file);
    const from = text.indexOf(start);
    assert.ok(from >= 0, `${start} not found in ${file}`);
    const to = text.indexOf(end, from);
    assert.ok(to > from, `${end} not found after ${start} in ${file}`);
    return text.slice(from, to + end.length);
}

const container = `kezek-booking-staff-${randomUUID()}`;
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
const q = (text) => `'${text.replace(/'/g, "''")}'`;
// 'ok <value>' or '<SQLSTATE> <message>' of one statement, run as the function owner.
const attempt = (statement) => sql(`select public.fixture_try(${q(statement)})`);
// A local wall-clock time of the business on day D (+offset days), as timestamptz SQL.
const at = (time, offset = 2) => `((current_date + ${offset})::timestamp + time '${time}') at time zone 'Asia/Bishkek'`;

const [client] = [randomUUID()];
const [biz, bizNoLinks, otherBiz] = [randomUUID(), randomUUID(), randomUUID()];
const [branchA, branchB, branchNoLinks, branchOther] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
const [cutter, idle, freeMaster] = [randomUUID(), randomUUID(), randomUUID()];
const [cut, color, cutB, freeService] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
let created = false;

const hold = (service, staff, start, branch = branchA, business = biz) =>
    `select public._hold_slot_for_actor('${business}', '${branch}', '${service}', '${staff}', ${start}, '${client}')::text`;
const holdComplex = (items, staff, start, branch = branchA) =>
    `select public._hold_complex_slot_for_actor('${biz}', '${branch}', '${staff}', ${start}, ${q(JSON.stringify(items))}::jsonb, '${client}')::text`;
const guest = (service, staff, start) =>
    `select public.hold_slot_guest('${biz}', '${branchA}', '${service}', '${staff}', ${start}, 'Guest', '996700000009')::text`;
const guestComplex = (items, staff, start) =>
    `select public.hold_complex_slot_guest('${biz}', '${branchA}', '${staff}', ${start}, ${q(JSON.stringify(items))}::jsonb, 'Guest', '996700000009')::text`;
const slots = (service, staff, offset = 2, business = biz) =>
    sql(`select count(*) from public.get_free_slots_service_day_v2('${business}', '${service}', current_date + ${offset}, 400, 15, '${staff}')`);
const minutes = (result) => sql(`select (extract(epoch from end_at - start_at) / 60)::integer from public.bookings where id = '${result.slice(3)}'`);

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

        // Functions get the grants the production baseline gave them.
        await sql(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth;
            ${SUPABASE_DEFAULT_PRIVILEGES}
            create table auth.users(id uuid primary key, email text, phone text, raw_user_meta_data jsonb);
            create type public.booking_status as enum ('hold', 'confirmed', 'paid', 'cancelled', 'no_show');
            create table public.profiles(id uuid primary key, full_name text, phone text);
            create table public.businesses(id uuid primary key, tz text);
            create table public.branches(id uuid primary key, biz_id uuid, is_active boolean default true);
            create table public.staff(id uuid primary key, biz_id uuid, branch_id uuid, is_active boolean default true, user_id uuid);
            create table public.staff_schedule_versions(staff_id uuid);
            create table public.services(id uuid primary key, biz_id uuid, branch_id uuid, name_ru text, duration_min integer, active boolean default true);
            create table public.service_staff(service_id uuid, staff_id uuid, is_active boolean default true);
            create table public.bookings(id uuid primary key default gen_random_uuid(), biz_id uuid, branch_id uuid, service_id uuid,
                staff_id uuid, client_id uuid, client_name text, client_phone text, client_email text,
                start_at timestamptz, end_at timestamptz, status public.booking_status, expires_at timestamptz);
            create table public.booking_services(booking_id uuid, service_id uuid, duration_min integer, order_index integer);

            -- Schedule fixture: every master works 09:00-18:00 every day in the home branch, unless
            -- fixture_days moves them to another branch for a day (a temporary transfer). A declared
            -- stub: the signature, security and grants of the live schedule_effective_day.
            create table public.fixture_days(staff_id uuid, day date, branch_id uuid);
            create function public.schedule_effective_day(p_staff uuid, p_day date) returns jsonb language plpgsql stable security definer
                set search_path to 'public' as $$
                begin
                    return (select jsonb_build_object('date', p_day, 'source', 'fixture', 'tz', coalesce(b.tz, 'Asia/Bishkek'),
                        'branch_id', coalesce((select d.branch_id from public.fixture_days d where d.staff_id = p_staff and d.day = p_day), s.branch_id),
                        'intervals', '[{"start":"09:00","end":"18:00"}]'::jsonb, 'breaks', '[]'::jsonb)
                        from public.staff s join public.businesses b on b.id = s.biz_id where s.id = p_staff);
                end $$;
            revoke all on function public.schedule_effective_day(uuid, date) from public;
            grant execute on function public.schedule_effective_day(uuid, date) to anon, authenticated, service_role;
            ${liveFunctionSql('public.resolve_staff_day(uuid,date)')}
            create function public.fixture_try(p_sql text) returns text language plpgsql as $$
                declare v text;
                begin
                    execute p_sql into v;
                    return 'ok ' || coalesce(v, '');
                exception when others then
                    return sqlstate || ' ' || sqlerrm;
                end $$;

            insert into auth.users values ('${client}', 'client@unit.test', null, '{"full_name":"Client"}');
            insert into public.profiles values ('${client}', 'Client', '996700000001');
            insert into public.businesses values ('${biz}', 'Asia/Bishkek'), ('${bizNoLinks}', 'Asia/Bishkek'), ('${otherBiz}', 'Asia/Bishkek');
            insert into public.branches values ('${branchA}', '${biz}'), ('${branchB}', '${biz}'), ('${branchNoLinks}', '${bizNoLinks}'), ('${branchOther}', '${otherBiz}');
            insert into public.staff values ('${cutter}', '${biz}', '${branchA}'), ('${idle}', '${biz}', '${branchA}'),
                ('${freeMaster}', '${bizNoLinks}', '${branchNoLinks}');
            insert into public.services values
                ('${cut}', '${biz}', '${branchA}', 'Стрижка', 60), ('${color}', '${biz}', '${branchA}', 'Окрашивание', 120),
                ('${cutB}', '${biz}', '${branchB}', 'Стрижка', 60), ('${freeService}', '${bizNoLinks}', '${branchNoLinks}', 'Маникюр', 45);
            insert into public.service_staff values ('${cut}', '${cutter}');
            -- On day D+3 the cutter works in branch B (temporary transfer).
            insert into public.fixture_days values ('${cutter}', current_date + 3, '${branchB}');`);

        // Previous production bodies, taken from the migrations that last defined them.
        await sql([
            extract('20261009110000_prod_baseline.sql', 'CREATE OR REPLACE FUNCTION "public"."schedule_contains_booking"', '\n$$;'),
            extract('20261009110000_prod_baseline.sql', 'CREATE OR REPLACE FUNCTION "public"."hold_slot_guest"', '\n$$;'),
            extract('20261009110000_prod_baseline.sql', 'CREATE OR REPLACE FUNCTION "public"."hold_complex_slot_guest"', '\n$$;'),
            extract('20261110121000_staff_scoped_slots.sql', 'CREATE OR REPLACE FUNCTION public.get_free_slots_service_day_v2(', 'END$function$;'),
            extract('20261110123000_service_only_booking_commands.sql', 'create or replace function public._hold_slot_for_actor(', '\n$$;'),
            extract('20261110123000_service_only_booking_commands.sql', 'create or replace function public._hold_complex_slot_for_actor(', '\n$$;'),
            // Their grants as those migrations left them (the migration under test keeps them).
            // Baseline: schedule_contains_booking is not executable by PUBLIC.
            'revoke all on function public.schedule_contains_booking(uuid, uuid, timestamptz, timestamptz) from public;',
            'grant all on function public.schedule_contains_booking(uuid, uuid, timestamptz, timestamptz) to service_role;',
            // 20261110101000_atomic_booking_requests: guest holds run only inside the atomic booking command.
            `revoke all on function public.hold_slot_guest(uuid, uuid, uuid, uuid, timestamptz, text, text, text),
                public.hold_complex_slot_guest(uuid, uuid, uuid, timestamptz, jsonb, text, text, text) from public, anon, authenticated;`,
            // 20261110121000_staff_scoped_slots.
            'revoke all on function public.get_free_slots_service_day_v2(uuid, uuid, date, integer, integer, uuid) from public;',
            'grant execute on function public.get_free_slots_service_day_v2(uuid, uuid, date, integer, integer, uuid) to anon, authenticated, service_role;',
            // 20261110123000_service_only_booking_commands: the actor helpers are internal.
            `revoke all on function public._hold_slot_for_actor(uuid, uuid, uuid, uuid, timestamptz, uuid),
                public._hold_complex_slot_for_actor(uuid, uuid, uuid, timestamptz, jsonb, uuid) from public, anon, authenticated, service_role;`,
        ].join('\n'));

        // Exposures before the migration.
        assert.match(await attempt(hold(color, cutter, at('10:00'))), /^ok /, 'MOB-01: a master is booked for a service they do not perform');
        assert.notEqual(await slots(cut, idle), '0', 'MOB-01: slots are offered for a master without the service');
        const yearHold = await attempt(holdComplex([{ service_id: cut, duration_min: 525600 }], cutter, at('12:00')));
        assert.match(yearHold, /^ok /, 'API-04: a client-chosen duration is accepted');
        assert.equal(await minutes(yearHold), '525600', 'API-04: the master is held for a year');
        assert.match(await attempt(hold(cut, cutter, at('10:00', -3))), /^ok /, 'a hold may start in the past');
        await sql('delete from public.booking_services; delete from public.bookings;');

        await sql(read('20261118100000_booking_service_staff_checks.sql'));

        // Simple holds: the service must be the branch's and performed by the master; no past start.
        assert.equal(await attempt(hold(color, cutter, at('10:00'))), '22023 STAFF_DOES_NOT_PERFORM_SERVICE');
        assert.equal(await attempt(hold(cut, idle, at('10:00'))), '22023 STAFF_DOES_NOT_PERFORM_SERVICE');
        assert.equal(await attempt(hold(cutB, cutter, at('10:00'))), '22023 service not found or inactive');
        assert.equal(await attempt(hold(cut, cutter, at('10:00', -3))), '22023 SLOT_IN_PAST');
        assert.match(await attempt(hold(cut, cutter, at('10:00'))), /^ok /);
        assert.equal(await attempt(hold(cut, cutter, at('10:30'))), 'P0001 time slot is already booked');
        assert.equal(await attempt(hold(cut, cutter, at('17:30'))), 'P0001 SCHEDULE_OUTSIDE_WORKING_HOURS');

        // Temporary transfer: in branch B the cutter may do B's service with the same name and duration.
        assert.match(await attempt(hold(cutB, cutter, at('10:00', 3), branchB)), /^ok /);
        assert.notEqual(await slots(cutB, cutter, 3), '0');
        assert.equal(await slots(cutB, cutter, 2), '0', 'not on a day spent in the home branch');

        // A business that never linked services to staff keeps every master bookable.
        assert.match(await attempt(hold(freeService, freeMaster, at('10:00'), branchNoLinks, bizNoLinks)), /^ok /);
        assert.notEqual(await slots(freeService, freeMaster, 2, bizNoLinks), '0');

        // Slots only for masters who perform the service.
        assert.equal(await slots(cut, idle), '0');
        assert.equal(await slots(color, cutter), '0');
        assert.notEqual(await slots(cut, cutter), '0');

        // Complex holds: catalogue durations, the whole visit inside the schedule, each service checked.
        const complexHold = await attempt(holdComplex([{ service_id: cut, duration_min: 525600 }, { service_id: cut, duration_min: 1 }], cutter, at('13:00')));
        assert.match(complexHold, /^ok /);
        assert.equal(await minutes(complexHold), '120');
        assert.equal(await sql(`select string_agg(duration_min::text, ',' order by order_index) from public.booking_services where booking_id = '${complexHold.slice(3)}'`), '60,60');
        assert.equal(await attempt(holdComplex([{ service_id: cut }, { service_id: cut }], cutter, at('17:00'))), 'P0001 SCHEDULE_OUTSIDE_WORKING_HOURS');
        assert.equal(await attempt(holdComplex([{ service_id: cut }, { service_id: color }], cutter, at('15:00'))), '22023 STAFF_DOES_NOT_PERFORM_SERVICE');
        assert.equal(await attempt(holdComplex([{ service_id: cutB }], cutter, at('15:00'))), '22023 service not found or inactive');
        assert.equal(await attempt(holdComplex([{ service_id: cut }], cutter, at('15:00', -3))), '22023 SLOT_IN_PAST');
        assert.equal(await attempt(holdComplex(Array.from({ length: 21 }, () => ({ service_id: cut })), cutter, at('09:00', 4))), '22023 INVALID_BOOKING_REQUEST');
        assert.equal(await attempt(holdComplex([], cutter, at('15:00'))), '22023 INVALID_BOOKING_REQUEST');

        // Guest holds follow the same rules.
        assert.equal(await attempt(guest(color, cutter, at('09:00', 5))), '22023 STAFF_DOES_NOT_PERFORM_SERVICE');
        assert.equal(await attempt(guest(cut, cutter, at('09:00', -3))), '22023 SLOT_IN_PAST');
        assert.match(await attempt(guest(cut, cutter, at('09:00', 5))), /^ok /);
        const guestComplexHold = await attempt(guestComplex([{ service_id: cut, duration_min: 525600 }], cutter, at('11:00', 5)));
        assert.match(guestComplexHold, /^ok /);
        assert.equal(await minutes(guestComplexHold), '60');
        assert.equal(await attempt(guestComplex([{ service_id: color }], cutter, at('13:00', 5))), '22023 STAFF_DOES_NOT_PERFORM_SERVICE');
        assert.equal(await attempt(guestComplex([{ service_id: cut }, { service_id: cut }], cutter, at('17:00', 5))), 'P0001 SCHEDULE_OUTSIDE_WORKING_HOURS');

        // The helper is not callable by API roles.
        assert.equal(await sql(`select has_function_privilege('authenticated', 'public._staff_performs_service(uuid,uuid,uuid)', 'execute')
            or has_function_privilege('anon', 'public._staff_performs_service(uuid,uuid,uuid)', 'execute')
            or has_function_privilege('service_role', 'public._staff_performs_service(uuid,uuid,uuid)', 'execute')`), 'f');

        await assertLiveFunctions(sql, { suite: 'test-booking-service-staff-isolated.cjs', stubs });
        console.log('booking service staff checks: ok');
    } finally {
        if (created) await docker(['rm', '--force', container]).catch(() => undefined);
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

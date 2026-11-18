// Shared fixture of the explicit-schedule suites (CI-03), not a Supabase baseline. The tables are
// synthetic: the columns, defaults and constraints the schedule functions use, shaped as production
// has them (bookings with its no_overlap exclusion constraint), except that bookings.service_id stays
// nullable so the suites can write bare reservations. The functions are the migration chain (CI-01):
// the schedule functions and their triggers come from the prod baseline, where production last
// defined them; the booking writers, when a suite needs them, run their later migrations
// (installBookingWriters); then the grant and config migrations of 19 November apply to what the
// fixture has, and the release of expired holds (20261119100000) runs whole. Every suite on this
// fixture ends with assertLiveFunctions, so a function that drifts from the chain fails the suite.
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { SUPABASE_DEFAULT_PRIVILEGES, applyMigrationWhereObjectsExist } = require('./live-schema.cjs');

export const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
export const biz = id(1), branch = id(2), staff = id(3), owner = id(4), other = id(5), branch2 = id(6);

export const migration = async (name) =>
    (await readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8')).replace(/\r/g, '');

// The text of a migration from `from` (inclusive) up to `to` (exclusive).
function part(text, name, from, to) {
    const start = text.indexOf(from);
    const end = start < 0 ? -1 : text.indexOf(to, start + from.length);
    if (start < 0 || end < 0) throw new Error(`${name}: no part from ${from} to ${to}`);
    return text.slice(start, end);
}

// One function of the prod baseline (pg_dump format) with its owner and grants.
function baselineFunction(baseline, name) {
    const marker = `CREATE OR REPLACE FUNCTION "public"."${name}"(`;
    const start = baseline.indexOf(marker);
    if (start < 0 || baseline.indexOf(marker, start + 1) >= 0) throw new Error(`prod baseline: expected one definition of ${name}`);
    const owner = baseline.indexOf('\nALTER FUNCTION ', start) + 1;
    const identity = baseline.slice(owner + 'ALTER FUNCTION '.length, baseline.indexOf(' OWNER TO ', owner));
    if (!identity.startsWith(`"public"."${name}"(`)) throw new Error(`prod baseline: no owner statement after ${name}`);
    const acl = baseline.split('\n').filter((line) => /^(GRANT|REVOKE) ALL ON FUNCTION /.test(line) && line.includes(` ON FUNCTION ${identity} `));
    return [baseline.slice(start, baseline.indexOf(';\n', owner) + 1), ...acl].join('\n');
}

// One trigger of the prod baseline.
function baselineTrigger(baseline, name, table) {
    const lines = baseline.split('\n').filter((line) => line.startsWith(`CREATE OR REPLACE TRIGGER "${name}" `) && line.includes(` ON "public"."${table}" `));
    if (lines.length !== 1) throw new Error(`prod baseline: expected one trigger ${name} on ${table}`);
    return lines[0];
}

// Explicit schedules (publication, versions, absences, home transfers, branch hours) and the guards
// on bookings and legacy rules. None changed after the prod baseline except grants (20261119050000).
const SCHEDULE_FUNCTIONS = [
    'schedule_validate_day', 'schedule_actor_can_manage', 'schedule_bound_to_branch', 'resolve_staff_day_legacy',
    'schedule_effective_day', 'resolve_staff_day', 'schedule_contains_booking', 'publish_staff_schedule',
    'read_staff_schedule', 'read_staff_schedule_draft', 'reset_staff_schedule_day', 'replace_branch_schedule',
    'transfer_staff_home', 'read_staff_work_locations', 'check_explicit_schedule_booking',
    'guard_legacy_staff_schedule_write', 'guard_staff_absence_booking', 'guard_staff_home_change',
];
const SCHEDULE_TRIGGERS = [
    ['check_explicit_schedule_booking', 'bookings'],
    ['guard_legacy_staff_schedule_write', 'staff_schedule_rules'],
    ['guard_legacy_working_hours_write', 'working_hours'],
    ['guard_staff_absence_booking', 'staff_time_off'],
    ['guard_staff_home_change', 'staff'],
];

// The booking writers and the slots they agree with, in chain order: the prod baseline, the revoke of
// 20261110101000, the staff-scoped slots of 20261110121000, the actor helpers and JWT wrappers of
// 20261110123000 and 20261118100000 run whole. The atomic booking command, its receipts and the
// booking lifecycle of those migrations are outside this fixture.
async function installBookingWriters(sql, baseline) {
    await sql(['hold_slot', 'hold_complex_slot', 'hold_slot_guest', 'hold_complex_slot_guest'].map((name) => baselineFunction(baseline, name)).join('\n'));
    // 20261110101000_atomic_booking_requests: the writers run only inside the atomic booking command.
    const atomic = '20261110101000_atomic_booking_requests.sql';
    await sql(`${part(await migration(atomic), atomic, 'revoke all on function public.hold_slot(', ';')};`);
    const slots = '20261110121000_staff_scoped_slots.sql';
    await sql(part(await migration(slots), slots, 'CREATE OR REPLACE FUNCTION public.get_free_slots_service_day_v2(', 'create or replace function public.get_free_slots_complex_day_v1('));
    const commands = '20261110123000_service_only_booking_commands.sql';
    const text = await migration(commands);
    await sql(part(text, commands, 'create or replace function public._hold_slot_for_actor(', 'CREATE OR REPLACE FUNCTION public._confirm_booking_transition('));
    // The wrappers' revoke also names two lifecycle helpers of that migration this fixture does not build.
    const wrappers = part(text, commands, 'create or replace function public.hold_slot(', 'create or replace function public.create_confirmed_booking(');
    const lifecycle = ',\n public._confirm_booking_transition(uuid),public._confirm_created_booking(uuid,uuid)';
    if (!wrappers.includes(lifecycle)) throw new Error(`${commands}: the revoke of the JWT wrappers changed`);
    await sql(wrappers.replace(lifecycle, ''));
    await sql(await migration('20261118100000_booking_service_staff_checks.sql'));
}

/**
 * Builds the fixture with `sql` (text run as postgres). `bookingWriters` adds hold_slot, hold_slot_guest,
 * hold_complex_slot, hold_complex_slot_guest and the slots of get_free_slots_service_day_v2.
 */
export async function setupScheduleFixture(sql, { bookingWriters = false } = {}) {
    // The prod-baseline function defaults: the migrations below ran under them in production.
    await sql(`
create role anon; create role authenticated; create role service_role bypassrls;
${SUPABASE_DEFAULT_PRIVILEGES}
create schema auth;
create schema private;
create extension btree_gist;
create table auth.users(id uuid primary key, email text, phone text, raw_user_meta_data jsonb);
-- As in Supabase: the subject of the request's JWT claims, null without them.
create function auth.uid() returns uuid language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid $$;
create type public.booking_status as enum ('hold', 'confirmed', 'paid', 'cancelled', 'no_show');
create type public.schedule_rule_kind as enum ('weekly', 'date', 'range');
create table public.businesses(id uuid primary key, owner_id uuid, tz text default 'Asia/Bishkek');
create table public.branches(id uuid primary key, biz_id uuid not null, is_active boolean default true);
create table public.staff(id uuid primary key, biz_id uuid not null, branch_id uuid not null, user_id uuid, is_active boolean default true);
create table public.roles(id uuid primary key default gen_random_uuid(), key text not null);
create table public.user_roles(id uuid primary key default gen_random_uuid(), user_id uuid not null, biz_id uuid, role_id uuid not null);
create table public.profiles(id uuid primary key, full_name text, phone text);
create table public.services(id uuid primary key, biz_id uuid not null, branch_id uuid not null, name_ru text not null,
    duration_min integer not null check (duration_min > 0), active boolean default true);
create table public.service_staff(service_id uuid not null, staff_id uuid not null, is_active boolean not null default true,
    primary key (service_id, staff_id));
create table public.staff_branch_assignments(id uuid primary key default gen_random_uuid(), biz_id uuid not null, staff_id uuid not null,
    branch_id uuid not null, valid_from date not null, valid_to date);
create table public.staff_home_branch_changes(id bigint generated always as identity primary key, staff_id uuid not null,
    biz_id uuid not null, from_branch_id uuid, to_branch_id uuid not null, effective_on date not null,
    transaction_id bigint not null default txid_current(), created_by uuid not null, created_at timestamptz not null default now());
create table public.staff_schedule_rules(id uuid primary key default gen_random_uuid(), biz_id uuid not null, staff_id uuid not null,
    kind public.schedule_rule_kind not null, day_of_week smallint check (day_of_week between 0 and 6), date_on date,
    date_from date, date_to date, branch_id uuid not null, tz text not null default 'Asia/Bishkek',
    intervals jsonb not null default '[]', breaks jsonb not null default '[]', is_active boolean not null default true,
    priority integer not null default 0, created_at timestamptz default now(),
    check ((kind = 'weekly' and day_of_week is not null and date_on is null and date_from is null and date_to is null)
        or (kind = 'date' and date_on is not null and day_of_week is null and date_from is null and date_to is null)
        or (kind = 'range' and date_from is not null and date_to is not null and date_from <= date_to and day_of_week is null and date_on is null)));
create table public.staff_schedule_versions(id uuid primary key default gen_random_uuid(), staff_id uuid not null, biz_id uuid not null,
    branch_id uuid not null, kind text not null check (kind in ('week', 'day')), effective_from date not null, days jsonb not null,
    revision bigint not null check (revision > 0), created_by uuid not null, created_at timestamptz not null default now(),
    unique (staff_id, revision));
create table public.staff_time_off(id uuid primary key default gen_random_uuid(), biz_id uuid not null, staff_id uuid not null,
    date_from date not null, date_to date not null, reason text, created_at timestamptz default now(), created_by uuid,
    cancelled_at timestamptz, cancelled_by uuid, check (date_from <= date_to));
create table public.working_hours(id uuid primary key default gen_random_uuid(), biz_id uuid not null, staff_id uuid not null,
    day_of_week smallint not null check (day_of_week between 0 and 6), intervals jsonb not null default '[]', breaks jsonb not null default '[]');
create table public.branch_working_hours(id uuid primary key default gen_random_uuid(), biz_id uuid not null, branch_id uuid not null,
    day_of_week smallint not null check (day_of_week between 0 and 6), intervals jsonb not null default '[]',
    breaks jsonb not null default '[]', unique (biz_id, branch_id, day_of_week));
create table public.bookings(id uuid primary key default gen_random_uuid(), biz_id uuid not null, branch_id uuid not null,
    service_id uuid, staff_id uuid not null, client_id uuid, status public.booking_status not null default 'hold',
    start_at timestamptz not null, end_at timestamptz not null, expires_at timestamptz,
    client_name text, client_phone text, client_email text,
    time_range tstzrange generated always as (tstzrange(start_at, end_at, '[)')) stored,
    constraint no_overlap exclude using gist (staff_id with =, time_range with &&)
        where (status in ('hold', 'confirmed', 'paid')));
create table public.booking_services(id uuid primary key default gen_random_uuid(),
    booking_id uuid not null references public.bookings on delete cascade, service_id uuid not null,
    duration_min integer not null, order_index integer not null default 0);
`);
    const baseline = await migration('20261009110000_prod_baseline.sql');
    await sql(SCHEDULE_FUNCTIONS.map((name) => baselineFunction(baseline, name)).join('\n'));
    await sql(SCHEDULE_TRIGGERS.map(([name, table]) => baselineTrigger(baseline, name, table)).join('\n'));
    if (bookingWriters) await installBookingWriters(sql, baseline);
    await applyMigrationWhereObjectsExist(sql, '20261119050000_privilege_parity_with_prod.sql');
    await applyMigrationWhereObjectsExist(sql, '20261119060000_definer_function_hardening.sql');
    await sql(await migration('20261119100000_release_expired_holds_on_booking.sql'));
    await sql(`
insert into public.businesses values ('${biz}', '${owner}', 'Asia/Bishkek');
insert into public.branches values ('${branch}', '${biz}', true), ('${branch2}', '${biz}', true);
insert into public.staff values ('${staff}', '${biz}', '${branch}', '${other}', true);
insert into public.branch_working_hours(biz_id, branch_id, day_of_week, intervals, breaks)
    select '${biz}', b, d, '[{"start":"08:00","end":"20:00"}]', '[]'
    from unnest(array['${branch}'::uuid, '${branch2}'::uuid]) b cross join generate_series(0, 6) d;
`);
}

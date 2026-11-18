// Integration fixture for 20261118235000_value_range_checks (DB-16). A disposable PostgreSQL with
// the columns the checks cover shows that, before the migration, a 150/-50 split, a negative or
// upside-down price, a negative expense, a 300 % package discount, a promotion ending before it
// starts, a 0 % birthday discount and an unknown time zone were all stored; that the migration
// refuses to run over such rows and changes nothing; and that afterwards each check rejects bad
// values and accepts the edges, including for a client role without USAGE on schema private.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { POSTGRES_IMAGE } = require('./lib/isolated-postgres.cjs');

const migration = fs.readFileSync(
    path.join(__dirname, '..', 'supabase', 'migrations', '20261118235000_value_range_checks.sql'),
    'utf8',
).replace(/\r/g, '');

const container = `kezek-value-checks-${randomUUID()}`;
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
const asClient = (statement) => sql(`begin; set local role client_writer; ${statement}; rollback;`);

// Production column types (see the prod baseline and later migrations); only the checked columns.
const fixture = `
create schema private;
revoke all on schema private from public;
create type public.promotion_type as enum ('free_after_n_visits', 'referral_free', 'referral_discount_50', 'birthday_discount', 'first_visit_discount');
create type public.visit_package_discount_type as enum ('percent', 'fixed_price');
create table public.staff (id uuid primary key default gen_random_uuid(), percent_master numeric not null default 60,
    percent_salon numeric not null default 40, hourly_rate numeric, check ((percent_master + percent_salon) = 100));
create table public.services (id uuid primary key default gen_random_uuid(), price_from integer not null, price_to integer not null,
    duration_min integer not null check (duration_min > 0));
create table public.booking_services (id uuid primary key default gen_random_uuid(), duration_min integer not null, price_from numeric, price_to numeric);
create table public.staff_shift_expenses (id uuid primary key default gen_random_uuid(), amount numeric not null default 0);
create table public.visit_package_plans (id uuid primary key default gen_random_uuid(), discount_type public.visit_package_discount_type not null,
    discount_value numeric(10,2) not null check (discount_value >= 0));
create table public.branch_promotions (id uuid primary key default gen_random_uuid(), promotion_type public.promotion_type not null,
    params jsonb not null default '{}', valid_from date, valid_to date);
create table public.businesses (id uuid primary key default gen_random_uuid(), tz text default 'Asia/Bishkek');
create table public.staff_schedule_rules (id uuid primary key default gen_random_uuid(), tz text not null default 'Asia/Bishkek');
create table public.rating_global_config (id integer primary key default 1, window_days integer not null default 30);
create table public.rating_biz_config (biz_id uuid primary key default gen_random_uuid(), window_days integer not null);
create role client_writer nologin;
grant usage on schema public to client_writer;
grant select, insert, update on all tables in schema public to client_writer;
`;

const badRows = [
    `insert into public.staff(percent_master, percent_salon) values (150, -50)`,
    `insert into public.staff(hourly_rate) values (-1)`,
    `insert into public.services(price_from, price_to, duration_min) values (500, 100, 30)`,
    `insert into public.services(price_from, price_to, duration_min) values (-10, 0, 30)`,
    `insert into public.booking_services(duration_min, price_from, price_to) values (0, 100, 50)`,
    `insert into public.staff_shift_expenses(amount) values (-5)`,
    `insert into public.visit_package_plans(discount_type, discount_value) values ('percent', 300)`,
    `insert into public.branch_promotions(promotion_type, valid_from, valid_to) values ('free_after_n_visits', '2026-12-31', '2026-01-01')`,
    `insert into public.branch_promotions(promotion_type, params) values ('birthday_discount', '{"discount_percent": 0}')`,
    `insert into public.branch_promotions(promotion_type, params) values ('first_visit_discount', '{"discount_percent": "10"}')`,
    `insert into public.branch_promotions(promotion_type, params) values ('free_after_n_visits', '{"visit_count": 0}')`,
    `insert into public.businesses(tz) values ('Mars/Olympus')`,
    `insert into public.staff_schedule_rules(tz) values ('Bishkek')`,
    `insert into public.rating_global_config(id, window_days) values (2, 0)`,
    `insert into public.rating_biz_config(window_days) values (-7)`,
];

const goodRows = [
    `insert into public.staff(percent_master, percent_salon, hourly_rate) values (100, 0, 0)`,
    `insert into public.staff(percent_master, percent_salon, hourly_rate) values (0, 100, null)`,
    `insert into public.services(price_from, price_to, duration_min) values (0, 0, 15)`,
    `insert into public.services(price_from, price_to, duration_min) values (500, 900, 60)`,
    `insert into public.booking_services(duration_min, price_from, price_to) values (30, null, null)`,
    `insert into public.booking_services(duration_min, price_from, price_to) values (30, 100, 100)`,
    `insert into public.booking_services(duration_min, price_from, price_to) values (30, null, 200)`,
    `insert into public.staff_shift_expenses(amount) values (0)`,
    `insert into public.visit_package_plans(discount_type, discount_value) values ('percent', 100)`,
    `insert into public.visit_package_plans(discount_type, discount_value) values ('fixed_price', 3500)`,
    `insert into public.branch_promotions(promotion_type, valid_from, valid_to) values ('free_after_n_visits', '2026-01-01', '2026-01-01')`,
    `insert into public.branch_promotions(promotion_type, params) values ('birthday_discount', '{"discount_percent": 100}')`,
    `insert into public.branch_promotions(promotion_type, params) values ('first_visit_discount', '{"discount_percent": 1}')`,
    `insert into public.branch_promotions(promotion_type, params) values ('free_after_n_visits', '{"visit_count": 5}')`,
    `insert into public.branch_promotions(promotion_type, params) values ('referral_discount_50', '{"discount_percent": 50, "anything": "else"}')`,
    `insert into public.branch_promotions(promotion_type, params) values ('birthday_discount', '{}')`,
    `insert into public.businesses(tz) values (null)`,
    `insert into public.businesses(tz) values ('Asia/Bishkek')`,
    `insert into public.businesses(tz) values ('UTC')`,
    `insert into public.staff_schedule_rules(tz) values ('Asia/Almaty')`,
    `insert into public.rating_biz_config(window_days) values (1)`,
];

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

        // Before: every bad value is stored.
        for (const row of badRows) await sql(row);
        assert.equal(await sql('select count(*) from public.branch_promotions'), '4', 'DB-16: bad promotions stored');

        // The migration refuses to run over them and changes nothing.
        await assert.rejects(sql(migration), /violated by some row/);
        assert.equal(await sql(`select count(*) from pg_constraint where conname like '%\\_check' and conname in
            ('staff_percent_range_check', 'services_price_range_check', 'businesses_tz_check')`), '0');
        assert.equal(await sql(`select to_regprocedure('private.is_valid_time_zone(text)') is null`), 't');

        await sql(`truncate public.staff, public.services, public.booking_services, public.staff_shift_expenses,
            public.visit_package_plans, public.branch_promotions, public.businesses, public.staff_schedule_rules,
            public.rating_global_config, public.rating_biz_config`);
        await sql(migration);

        // After: each bad value is refused (23514), as the owner and as a client role.
        for (const row of badRows) {
            await assert.rejects(sql(row), /violates check constraint/, row);
            await assert.rejects(asClient(row), /violates check constraint/, `client: ${row}`);
        }

        // The edges are allowed, and the time zone check works without USAGE on schema private.
        for (const row of goodRows) await asClient(row);
        for (const row of goodRows) await sql(row);
        assert.equal(await sql(`select has_schema_privilege('client_writer', 'private', 'usage')`), 'f');
        await assert.rejects(asClient(`update public.businesses set tz = 'Nowhere/Land'`), /businesses_tz_check/);
        await asClient(`update public.businesses set tz = 'Europe/Moscow' where tz is not null`);

        assert.equal(await sql(`select private.is_valid_time_zone('Asia/Bishkek')::text || private.is_valid_time_zone('Mars/Olympus')::text
            || coalesce(private.is_valid_time_zone(null)::text, 'null')`), 'truefalsenull');
        assert.equal(await sql(`select provolatile::text from pg_proc where oid = 'private.is_valid_time_zone(text)'::regprocedure`), 'i');
        assert.equal(await sql(`select count(*) from pg_constraint where contype = 'c' and not convalidated and conrelid::regclass::text like 'public.%'`), '0');

        console.log('Value range checks (DB-16): bad values refused for every role, edges allowed, migration refuses over bad rows.');
    } finally {
        if (created) await docker(['rm', '-f', container]).catch(() => {});
    }
})().catch((error) => {
    console.error(error);
    process.exit(1);
});

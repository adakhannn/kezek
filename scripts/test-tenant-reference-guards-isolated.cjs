// Integration fixture for 20261118110000_tenant_reference_guards. A disposable PostgreSQL
// reproduces the one-sided manager policies (row biz_id only), shows a manager writing schedule
// rules and service links for another business's master, applies the real migration and checks
// every guarded table for clients and the service role.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { POSTGRES_IMAGE } = require('./lib/isolated-postgres.cjs');

const container = `kezek-tenant-refs-${randomUUID()}`;
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
const asRole = (role, id, body) =>
    sql(`set role ${role}; set request.jwt.claims='{"sub":"${id}","role":"${role}"}'; ${body}`);

const [managerA, managerB] = [randomUUID(), randomUUID()];
const [bizA, bizB] = [randomUUID(), randomUUID()];
const [branchA, branchB] = [randomUUID(), randomUUID()];
const [staffA, staffB] = [randomUUID(), randomUUID()];
const [serviceA, serviceB] = [randomUUID(), randomUUID()];
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

        await sql(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth;
            create function auth.uid() returns uuid language sql stable as $$ select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
            grant usage on schema auth to anon, authenticated, service_role;
            alter default privileges in schema public grant all on tables to anon, authenticated, service_role;

            create table public.businesses(id uuid primary key);
            create table public.branches(id uuid primary key, biz_id uuid not null);
            create table public.staff(id uuid primary key, biz_id uuid not null, branch_id uuid not null, full_name text default 'Master');
            create table public.services(id uuid primary key, biz_id uuid not null, branch_id uuid not null, name_ru text default 'Service');
            create table public.service_staff(service_id uuid not null, staff_id uuid not null, is_active boolean default true);
            create table public.staff_branch_assignments(id uuid primary key default gen_random_uuid(), biz_id uuid not null, staff_id uuid not null, branch_id uuid not null);
            create table public.staff_schedule_rules(id uuid primary key default gen_random_uuid(), biz_id uuid not null, staff_id uuid not null,
                branch_id uuid not null, kind text default 'date', date_on date default current_date, is_active boolean default true);
            create table public.working_hours(id uuid primary key default gen_random_uuid(), biz_id uuid not null, staff_id uuid not null, day_of_week int default 1);
            create table public.branch_promotions(id uuid primary key default gen_random_uuid(), biz_id uuid not null, branch_id uuid not null, title_ru text default 'Promo');
            create table public.branch_working_hours(id uuid primary key default gen_random_uuid(), biz_id uuid not null, branch_id uuid not null, day_of_week int default 1);
            create table public.visit_package_plans(id uuid primary key default gen_random_uuid(), biz_id uuid not null, service_id uuid, name text default 'Plan');
            create table public.bookings(id uuid primary key default gen_random_uuid(), biz_id uuid not null, branch_id uuid not null,
                staff_id uuid not null, service_id uuid not null, status text default 'confirmed');
            create table public.roles(id uuid primary key default gen_random_uuid(), key text unique);
            create table public.user_roles(user_id uuid, biz_id uuid, role_id uuid references public.roles(id));
            grant select on public.roles, public.user_roles to authenticated;

            create function public.has_role(p_role_key text, p_biz_id uuid default null) returns boolean language sql stable security definer
                set search_path = public as $$
                select exists(select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
                    where ur.user_id = auth.uid() and r.key = p_role_key and (p_biz_id is null and ur.biz_id is null or ur.biz_id = p_biz_id)) $$;

            -- Production policy shapes: the row's biz_id (or one side of the link) only.
            alter table public.staff_schedule_rules enable row level security;
            create policy "Business managers can manage staff_schedule_rules" on public.staff_schedule_rules to authenticated
                using (biz_id in (select ur.biz_id from user_roles ur join roles r on ur.role_id = r.id
                    where ur.user_id = auth.uid() and r.key = any (array['owner','admin','manager'])))
                with check (biz_id in (select ur.biz_id from user_roles ur join roles r on ur.role_id = r.id
                    where ur.user_id = auth.uid() and r.key = any (array['owner','admin','manager'])));
            alter table public.service_staff enable row level security;
            create policy "Business owners can manage service_staff" on public.service_staff to authenticated
                using (exists (select 1 from services svc join user_roles ur on ur.biz_id = svc.biz_id join roles r on ur.role_id = r.id
                    where svc.id = service_staff.service_id and ur.user_id = auth.uid() and r.key = any (array['owner','admin','manager'])))
                with check (exists (select 1 from services svc join user_roles ur on ur.biz_id = svc.biz_id join roles r on ur.role_id = r.id
                    where svc.id = service_staff.service_id and ur.user_id = auth.uid() and r.key = any (array['owner','admin','manager'])));
            alter table public.branch_promotions enable row level security;
            create policy "Biz owners/admins/managers can manage branch promotions" on public.branch_promotions to authenticated
                using (biz_id in (select ur.biz_id from user_roles ur join roles r on ur.role_id = r.id
                    where ur.user_id = auth.uid() and r.key = any (array['owner','admin','manager'])))
                with check (biz_id in (select ur.biz_id from user_roles ur join roles r on ur.role_id = r.id
                    where ur.user_id = auth.uid() and r.key = any (array['owner','admin','manager'])));

            insert into public.businesses values ('${bizA}'), ('${bizB}');
            insert into public.branches values ('${branchA}', '${bizA}'), ('${branchB}', '${bizB}');
            insert into public.staff(id, biz_id, branch_id) values ('${staffA}', '${bizA}', '${branchA}'), ('${staffB}', '${bizB}', '${branchB}');
            insert into public.services(id, biz_id, branch_id) values ('${serviceA}', '${bizA}', '${branchA}'), ('${serviceB}', '${bizB}', '${branchB}');
            insert into public.roles(key) values ('owner'), ('admin'), ('manager');
            insert into public.user_roles select '${managerA}', '${bizA}', id from public.roles where key = 'manager';
            insert into public.user_roles select '${managerB}', '${bizB}', id from public.roles where key = 'manager';`);

        // Before: manager A writes a schedule rule and a promotion for business B, and links B's master.
        assert.equal(await asRole('authenticated', managerA, `insert into public.staff_schedule_rules(biz_id, staff_id, branch_id)
            values ('${bizA}', '${staffB}', '${branchA}') returning 'inserted'`), 'inserted', 'DB-08: a rule for a foreign master');
        assert.equal(await asRole('authenticated', managerA, `insert into public.branch_promotions(biz_id, branch_id)
            values ('${bizA}', '${branchB}') returning 'inserted'`), 'inserted', 'DB-08: a promotion on a foreign branch');
        assert.equal(await asRole('authenticated', managerA, `insert into public.service_staff(service_id, staff_id)
            values ('${serviceA}', '${staffB}') returning 'inserted'`), 'inserted', 'DB-08: a service linked to a foreign master');
        await sql('delete from public.staff_schedule_rules; delete from public.branch_promotions; delete from public.service_staff;');

        await sql(fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '20261118110000_tenant_reference_guards.sql'), 'utf8'));

        const mismatch = /TENANT_REFERENCE_MISMATCH/;
        await assert.rejects(asRole('authenticated', managerA, `insert into public.staff_schedule_rules(biz_id, staff_id, branch_id)
            values ('${bizA}', '${staffB}', '${branchA}')`), mismatch);
        await assert.rejects(asRole('authenticated', managerA, `insert into public.branch_promotions(biz_id, branch_id)
            values ('${bizA}', '${branchB}')`), mismatch);
        await assert.rejects(asRole('authenticated', managerA, `insert into public.service_staff(service_id, staff_id)
            values ('${serviceA}', '${staffB}')`), mismatch);

        // The manager's own business keeps working.
        assert.equal(await asRole('authenticated', managerA, `insert into public.staff_schedule_rules(biz_id, staff_id, branch_id)
            values ('${bizA}', '${staffA}', '${branchA}') returning 'inserted'`), 'inserted');
        assert.equal(await asRole('authenticated', managerA, `insert into public.service_staff(service_id, staff_id)
            values ('${serviceA}', '${staffA}') returning 'inserted'`), 'inserted');
        assert.equal(await asRole('authenticated', managerA, `insert into public.branch_promotions(biz_id, branch_id)
            values ('${bizA}', '${branchA}') returning 'inserted'`), 'inserted');

        // Every guarded table, for every writer (here the table owner): foreign references are refused.
        const foreign = [
            `insert into public.staff(id, biz_id, branch_id) values (gen_random_uuid(), '${bizA}', '${branchB}')`,
            `insert into public.services(id, biz_id, branch_id) values (gen_random_uuid(), '${bizA}', '${branchB}')`,
            `insert into public.staff_branch_assignments(biz_id, staff_id, branch_id) values ('${bizA}', '${staffB}', '${branchA}')`,
            `insert into public.staff_branch_assignments(biz_id, staff_id, branch_id) values ('${bizA}', '${staffA}', '${branchB}')`,
            `insert into public.working_hours(biz_id, staff_id) values ('${bizA}', '${staffB}')`,
            `insert into public.branch_working_hours(biz_id, branch_id) values ('${bizA}', '${branchB}')`,
            `insert into public.visit_package_plans(biz_id, service_id) values ('${bizA}', '${serviceB}')`,
            `insert into public.bookings(biz_id, branch_id, staff_id, service_id) values ('${bizA}', '${branchA}', '${staffA}', '${serviceB}')`,
            `insert into public.bookings(biz_id, branch_id, staff_id, service_id) values ('${bizA}', '${branchA}', '${staffB}', '${serviceA}')`,
            `insert into public.bookings(biz_id, branch_id, staff_id, service_id) values ('${bizA}', '${branchB}', '${staffA}', '${serviceA}')`,
            `insert into public.service_staff(service_id, staff_id) values ('${serviceB}', '${staffA}')`,
        ];
        for (const statement of foreign) await assert.rejects(sql(statement), mismatch, statement);
        assert.equal(await asRole('service_role', managerA, `insert into public.staff_branch_assignments(biz_id, staff_id, branch_id)
            values ('${bizB}', '${staffB}', '${branchB}') returning 'inserted'`), 'inserted');
        await assert.rejects(asRole('service_role', managerA, `insert into public.staff_branch_assignments(biz_id, staff_id, branch_id)
            values ('${bizB}', '${staffA}', '${branchB}')`), mismatch);

        // Consistent rows are accepted; unrelated updates are not re-checked; re-pointing is.
        const booking = await sql(`insert into public.bookings(biz_id, branch_id, staff_id, service_id)
            values ('${bizA}', '${branchA}', '${staffA}', '${serviceA}') returning id`);
        assert.equal(await sql(`update public.bookings set status = 'paid' where id = '${booking}' returning status`), 'paid');
        await assert.rejects(sql(`update public.bookings set staff_id = '${staffB}' where id = '${booking}'`), mismatch);
        await assert.rejects(sql(`update public.bookings set biz_id = '${bizB}' where id = '${booking}'`), mismatch);
        assert.equal(await sql(`update public.staff set full_name = 'Renamed' where id = '${staffA}' returning full_name`), 'Renamed');
        await assert.rejects(sql(`update public.staff set branch_id = '${branchB}' where id = '${staffA}'`), mismatch);
        assert.equal(await sql(`update public.service_staff set is_active = false where staff_id = '${staffA}' returning 'updated'`), 'updated');
        await assert.rejects(sql(`update public.service_staff set staff_id = '${staffB}' where staff_id = '${staffA}'`), mismatch);
        assert.equal(await sql(`insert into public.visit_package_plans(biz_id, service_id) values ('${bizA}', null) returning 'inserted'`), 'inserted');

        assert.equal(await sql(`select has_function_privilege('authenticated', 'private.tenant_reference_guard()', 'execute')
            or has_function_privilege('service_role', 'private.service_staff_same_business()', 'execute')`), 'f');

        console.log('tenant reference guards: ok');
    } finally {
        if (created) await docker(['rm', '--force', container]).catch(() => undefined);
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

// Integration fixture for 20261118230000_keep_history_on_delete. A disposable PostgreSQL with the
// business, branch, staff, booking, shift and promotion tables and their production foreign keys
// shows a branch delete wiping its bookings, applies the real migration and checks that history
// can no longer be deleted by any path, that a branch or business without history is still
// deleted completely in one call, and who may call the functions.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { POSTGRES_IMAGE } = require('./lib/isolated-postgres.cjs');

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

const container = `kezek-keep-history-${randomUUID()}`;
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
const count = (table, where = 'true') => sql(`select count(*) from public.${table} where ${where}`);
const id = () => randomUUID();
let created = false;

// A business with: a branch with history (a booking and a shift), an empty branch with an
// inactive master and an inactive service, and an owner role.
async function seedBusiness() {
    const b = { biz: id(), owner: id(), busy: id(), empty: id(), staff: id(), inactiveStaff: id(), service: id(), inactiveService: id(), promo: id(), plan: id() };
    await sql(`insert into public.businesses values ('${b.biz}', '${b.owner}');
        insert into public.user_roles(user_id, biz_id, role_id) values ('${b.owner}', '${b.biz}', '00000000-0000-0000-0000-000000000001');
        insert into public.branches values ('${b.busy}', '${b.biz}'), ('${b.empty}', '${b.biz}');
        insert into public.branch_working_hours(biz_id, branch_id) values ('${b.biz}', '${b.busy}'), ('${b.biz}', '${b.empty}');
        insert into public.services values ('${b.service}', '${b.biz}', '${b.busy}', true), ('${b.inactiveService}', '${b.biz}', '${b.empty}', false);
        insert into public.staff values ('${b.staff}', '${b.biz}', '${b.busy}', null, true), ('${b.inactiveStaff}', '${b.biz}', '${b.empty}', null, false);
        insert into public.service_staff values ('${b.inactiveService}', '${b.inactiveStaff}');
        insert into public.staff_schedule_rules(biz_id, branch_id, staff_id) values ('${b.biz}', '${b.empty}', '${b.inactiveStaff}');
        insert into public.staff_branch_assignments(biz_id, staff_id, branch_id) values ('${b.biz}', '${b.inactiveStaff}', '${b.empty}');
        insert into public.bookings(biz_id, branch_id, service_id, staff_id) values ('${b.biz}', '${b.busy}', '${b.service}', '${b.staff}');
        insert into public.staff_shifts(biz_id, branch_id, staff_id) values ('${b.biz}', '${b.busy}', '${b.staff}');
        insert into public.branch_promotions values ('${b.promo}', '${b.biz}', '${b.busy}');
        insert into public.client_promotion_usage(biz_id, branch_id, promotion_id) values ('${b.biz}', '${b.busy}', '${b.promo}');
        insert into public.visit_package_plans values ('${b.plan}', '${b.biz}', null);`);
    return b;
}

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

        // Production foreign keys (prod_baseline.sql) of every table the deletes touch.
        await sql(`create role anon; create role authenticated; create role service_role bypassrls;
            grant usage on schema public to anon, authenticated, service_role;
            create table public.roles(id uuid primary key, key text);
            insert into public.roles values ('00000000-0000-0000-0000-000000000001', 'owner'), ('00000000-0000-0000-0000-000000000002', 'staff'), ('00000000-0000-0000-0000-000000000003', 'client');
            create table public.businesses(id uuid primary key, owner_id uuid);
            create table public.user_roles(id uuid primary key default gen_random_uuid(), user_id uuid, biz_id uuid references public.businesses(id) on delete cascade,
                role_id uuid references public.roles(id), unique (user_id, biz_id, role_id));
            create table public.branches(id uuid primary key, biz_id uuid references public.businesses(id) on delete cascade);
            create table public.services(id uuid primary key, biz_id uuid references public.businesses(id) on delete cascade, branch_id uuid references public.branches(id), active boolean);
            create table public.staff(id uuid primary key, biz_id uuid references public.businesses(id) on delete cascade,
                branch_id uuid constraint staff_branch_id_fkey references public.branches(id) on delete cascade, user_id uuid, is_active boolean);
            create table public.service_staff(service_id uuid references public.services(id) on delete cascade, staff_id uuid references public.staff(id) on delete cascade);
            create table public.branch_working_hours(id uuid primary key default gen_random_uuid(), biz_id uuid references public.businesses(id) on delete cascade,
                branch_id uuid references public.branches(id) on delete cascade);
            create table public.staff_schedule_rules(id uuid primary key default gen_random_uuid(), biz_id uuid references public.businesses(id) on delete cascade,
                branch_id uuid references public.branches(id) on delete restrict, staff_id uuid references public.staff(id) on delete cascade);
            create table public.staff_branch_assignments(id uuid primary key default gen_random_uuid(), biz_id uuid, staff_id uuid, branch_id uuid);
            create table public.bookings(id uuid primary key default gen_random_uuid(),
                biz_id uuid constraint bookings_biz_id_fkey references public.businesses(id) on delete cascade,
                branch_id uuid constraint bookings_branch_id_fkey references public.branches(id) on delete cascade,
                service_id uuid references public.services(id) on delete restrict, staff_id uuid references public.staff(id) on delete restrict);
            create table public.booking_services(id uuid primary key default gen_random_uuid(), booking_id uuid references public.bookings(id) on delete cascade,
                service_id uuid references public.services(id) on delete restrict);
            create table public.staff_shifts(id uuid primary key default gen_random_uuid(),
                biz_id uuid constraint staff_shifts_biz_id_fkey references public.businesses(id) on delete cascade,
                branch_id uuid constraint staff_shifts_branch_id_fkey references public.branches(id) on delete cascade,
                staff_id uuid constraint staff_shifts_staff_id_fkey references public.staff(id) on delete cascade);
            create table public.staff_finance_operation_logs(id uuid primary key default gen_random_uuid(),
                biz_id uuid constraint staff_finance_operation_logs_biz_id_fkey references public.businesses(id) on delete cascade,
                staff_id uuid constraint staff_finance_operation_logs_staff_id_fkey references public.staff(id) on delete cascade);
            create table public.staff_schedule_versions(id uuid primary key default gen_random_uuid(), biz_id uuid references public.businesses(id),
                branch_id uuid references public.branches(id), staff_id uuid references public.staff(id));
            create table public.staff_home_branch_changes(id uuid primary key default gen_random_uuid(), biz_id uuid references public.businesses(id),
                staff_id uuid references public.staff(id), from_branch_id uuid references public.branches(id), to_branch_id uuid references public.branches(id));
            create table public.branch_promotions(id uuid primary key, biz_id uuid references public.businesses(id) on delete cascade, branch_id uuid references public.branches(id) on delete cascade);
            create table public.client_promotion_usage(id uuid primary key default gen_random_uuid(),
                biz_id uuid constraint client_promotion_usage_biz_id_fkey references public.businesses(id) on delete cascade,
                branch_id uuid constraint client_promotion_usage_branch_id_fkey references public.branches(id) on delete cascade,
                promotion_id uuid constraint client_promotion_usage_promotion_id_fkey references public.branch_promotions(id) on delete cascade);
            create table public.client_referrals(id uuid primary key default gen_random_uuid(),
                biz_id uuid constraint client_referrals_biz_id_fkey references public.businesses(id) on delete cascade,
                branch_id uuid constraint client_referrals_branch_id_fkey references public.branches(id) on delete cascade);
            create table public.visit_package_plans(id uuid primary key, biz_id uuid references public.businesses(id) on delete cascade, service_id uuid references public.services(id) on delete set null);
            create table public.client_visit_packages(id uuid primary key default gen_random_uuid(), plan_id uuid references public.visit_package_plans(id) on delete restrict);
            grant all on all tables in schema public to anon, authenticated, service_role;`);
        await sql(extract('20261118120000_staff_delete_without_history.sql', 'create or replace function public.delete_staff_without_history', '\n$$;'));

        // Before: deleting the busy branch takes its booking, shift and promotion usage with it.
        const before = await seedBusiness();
        // A transfer branch: its bookings and shifts use the busy branch's service and master.
        const transfer = id();
        await sql(`insert into public.branches values ('${transfer}', '${before.biz}');
            update public.bookings set branch_id = '${transfer}' where biz_id = '${before.biz}';
            update public.staff_shifts set branch_id = '${transfer}' where biz_id = '${before.biz}';`);
        await sql(`delete from public.branches where id = '${transfer}'`);
        assert.equal(await count('bookings', `biz_id = '${before.biz}'`), '0', 'DB-14: the branch delete wiped the booking');
        assert.equal(await count('staff_shifts', `biz_id = '${before.biz}'`), '0', 'DB-14: and the shift');

        await sql(read('20261118230000_keep_history_on_delete.sql'));

        // History can no longer be deleted through a parent, by any path.
        const b = await seedBusiness();
        await assert.rejects(sql(`delete from public.branches where id = '${b.busy}'`), /violates foreign key constraint/);
        await assert.rejects(sql(`delete from public.businesses where id = '${b.biz}'`), /violates foreign key constraint/);
        await assert.rejects(sql(`delete from public.branch_promotions where id = '${b.promo}'`), /client_promotion_usage_promotion_id_fkey/);
        assert.equal(await count('bookings', `biz_id = '${b.biz}'`), '1');
        assert.equal(await count('staff_shifts', `biz_id = '${b.biz}'`), '1');

        // The branch command: history and use are refused, a clean branch goes completely.
        const branch = (target) => sql(`set role service_role; select public.delete_branch_without_history('${b.biz}', '${target}')`);
        await assert.rejects(branch(b.busy), /BRANCH_IN_USE/, 'active master and service');
        await assert.rejects(branch(id()), /BRANCH_NOT_FOUND/);
        await sql(`update public.staff set is_active = false where id = '${b.staff}'; update public.services set active = false where id = '${b.service}'`);
        await assert.rejects(branch(b.busy), /BRANCH_HAS_HISTORY/);
        await sql(`insert into public.staff_shifts(biz_id, branch_id, staff_id) values ('${b.biz}', '${b.busy}', '${b.staff}')`);
        await branch(b.empty);
        assert.equal(await count('branches', `id = '${b.empty}'`), '0');
        assert.equal(await count('staff', `id = '${b.inactiveStaff}'`), '0');
        assert.equal(await count('services', `id = '${b.inactiveService}'`), '0');
        assert.equal(await count('staff_schedule_rules', `branch_id = '${b.empty}'`), '0');
        assert.equal(await count('staff_branch_assignments', `branch_id = '${b.empty}'`), '0');
        assert.equal(await count('branch_working_hours', `branch_id = '${b.empty}'`), '0');

        // A branch whose inactive master has history elsewhere is refused.
        const other = id();
        const homed = id();
        await sql(`insert into public.branches values ('${other}', '${b.biz}');
            insert into public.staff values ('${homed}', '${b.biz}', '${other}', null, false);
            insert into public.staff_finance_operation_logs(biz_id, staff_id) values ('${b.biz}', '${homed}');`);
        await assert.rejects(branch(other), /BRANCH_HAS_HISTORY/);

        // The business command: history refused (also through the old entry point); a clean one goes.
        await assert.rejects(sql(`set role service_role; select public.delete_business_without_history('${b.biz}')`), /BUSINESS_HAS_HISTORY/);
        await assert.rejects(sql(`set role service_role; select public.force_delete_business_and_downgrade_owner('${b.biz}')`), /BUSINESS_HAS_HISTORY/);
        const clean = await seedBusiness();
        await sql(`delete from public.client_promotion_usage where biz_id = '${clean.biz}'; delete from public.staff_shifts where biz_id = '${clean.biz}';
            delete from public.bookings where biz_id = '${clean.biz}';`);
        await sql(`set role service_role; select public.delete_business_without_history('${clean.biz}')`);
        for (const table of ['businesses', 'branches', 'staff', 'services', 'user_roles', 'staff_schedule_rules', 'branch_working_hours', 'visit_package_plans']) {
            assert.equal(await count(table, table === 'businesses' ? `id = '${clean.biz}'` : `biz_id = '${clean.biz}'`), '0', table);
        }
        assert.equal(await count('staff_branch_assignments', `biz_id = '${clean.biz}'`), '0');
        const sold = await seedBusiness();
        await sql(`delete from public.client_promotion_usage where biz_id = '${sold.biz}'; delete from public.staff_shifts where biz_id = '${sold.biz}';
            delete from public.bookings where biz_id = '${sold.biz}'; insert into public.client_visit_packages(plan_id) values ('${sold.plan}');`);
        await assert.rejects(sql(`set role service_role; select public.delete_business_without_history('${sold.biz}')`), /BUSINESS_HAS_HISTORY/, 'a sold package');

        // Access: the commands are service-only; client roles cannot delete branches or packages.
        for (const role of ['authenticated', 'anon']) {
            await assert.rejects(sql(`set role ${role}; select public.delete_branch_without_history('${b.biz}', '${b.busy}')`), /permission denied for function/);
            await assert.rejects(sql(`set role ${role}; select public.delete_business_without_history('${b.biz}')`), /permission denied for function/);
            await assert.rejects(sql(`set role ${role}; delete from public.branches where id = '${b.busy}'`), /permission denied for table branches/);
            await assert.rejects(sql(`set role ${role}; delete from public.client_visit_packages`), /permission denied for table client_visit_packages/);
        }

        console.log('keep history on delete: ok');
    } finally {
        if (created) await docker(['rm', '--force', container]).catch(() => undefined);
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

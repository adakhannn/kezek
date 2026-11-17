// Integration fixture for 20261118120000_staff_delete_without_history. A disposable PostgreSQL
// reproduces the production foreign keys around staff (bookings RESTRICT, schedule versions
// NO ACTION, per-master rows CASCADE) and the user_roles guards, applies the real migration and
// checks that a master with history is refused untouched, a master without history disappears
// in one transaction with only the staff role removed, and that only the service role may call it.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');

const container = `kezek-staff-delete-${randomUUID()}`;
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
const asRole = (role, body) => sql(`set role ${role}; ${body}`);
const remove = (biz, staff) => sql(`select public.delete_staff_without_history('${biz}', '${staff}')`);

const [biz, otherBiz] = [randomUUID(), randomUUID()];
const [ownerUser, suspendedUser] = [randomUUID(), randomUUID()];
const [withBooking, withShift, withVersion, clean, suspendedClean] = Array.from({ length: 5 }, () => randomUUID());
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
            create table auth.users(id uuid primary key);
            create table public.businesses(id uuid primary key);
            create table public.staff(id uuid primary key, biz_id uuid not null references public.businesses(id), user_id uuid references auth.users(id));
            create table public.bookings(id uuid primary key default gen_random_uuid(), staff_id uuid not null references public.staff(id) on delete restrict);
            create table public.staff_shifts(id uuid primary key default gen_random_uuid(), staff_id uuid not null references public.staff(id) on delete cascade);
            create table public.staff_schedule_versions(id uuid primary key default gen_random_uuid(), staff_id uuid not null references public.staff(id));
            create table public.staff_home_branch_changes(id uuid primary key default gen_random_uuid(), staff_id uuid not null references public.staff(id));
            create table public.staff_finance_operation_logs(id uuid primary key default gen_random_uuid(), staff_id uuid not null references public.staff(id) on delete cascade);
            create table public.staff_branch_assignments(id uuid primary key default gen_random_uuid(), biz_id uuid not null, staff_id uuid not null);
            create table public.working_hours(id uuid primary key default gen_random_uuid(), staff_id uuid not null references public.staff(id) on delete cascade);
            create table public.service_staff(service_id uuid not null, staff_id uuid not null references public.staff(id) on delete cascade);
            create table public.roles(id uuid primary key default gen_random_uuid(), key text unique);
            create table public.user_roles(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
                biz_id uuid references public.businesses(id), role_id uuid not null references public.roles(id));
            create unique index ux_user_roles_business on public.user_roles(user_id, biz_id, role_id) where biz_id is not null;
            create table public.user_suspensions(user_id uuid primary key);
            create function public.prevent_roles_for_suspended() returns trigger language plpgsql as $$
                begin
                    if exists (select 1 from public.user_suspensions where user_id = new.user_id) then raise exception 'USER_SUSPENDED'; end if;
                    return new;
                end $$;
            create trigger trg_prevent_roles_for_suspended before insert or update on public.user_roles
                for each row execute function public.prevent_roles_for_suspended();

            insert into auth.users values ('${ownerUser}'), ('${suspendedUser}');
            insert into public.businesses values ('${biz}'), ('${otherBiz}');
            insert into public.roles(key) values ('owner'), ('staff'), ('client');
            insert into public.staff values ('${withBooking}', '${biz}', null), ('${withShift}', '${biz}', null), ('${withVersion}', '${biz}', null),
                ('${clean}', '${biz}', '${ownerUser}'), ('${suspendedClean}', '${biz}', '${suspendedUser}');
            insert into public.bookings(staff_id) values ('${withBooking}');
            insert into public.staff_shifts(staff_id) values ('${withShift}');
            insert into public.staff_schedule_versions(staff_id) values ('${withVersion}');
            insert into public.staff_branch_assignments(biz_id, staff_id) values ('${biz}', '${withBooking}'), ('${biz}', '${clean}');
            insert into public.working_hours(staff_id) values ('${clean}'), ('${withBooking}');
            insert into public.service_staff values (gen_random_uuid(), '${clean}');
            -- The owner of the business also works as a master.
            insert into public.user_roles(user_id, biz_id, role_id) select '${ownerUser}', '${biz}', id from public.roles where key in ('owner', 'staff');
            insert into public.user_roles(user_id, biz_id, role_id) select '${suspendedUser}', '${biz}', id from public.roles where key = 'staff';
            insert into public.user_suspensions values ('${suspendedUser}');`);

        await sql(fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '20261118120000_staff_delete_without_history.sql'), 'utf8'));

        // Masters with history are refused and nothing of theirs changes.
        for (const staff of [withBooking, withShift, withVersion]) {
            await assert.rejects(remove(biz, staff), /STAFF_HAS_HISTORY/);
        }
        assert.equal(await sql(`select (select count(*) from public.staff where id in ('${withBooking}', '${withShift}', '${withVersion}'))
            || '/' || (select count(*) from public.bookings) || '/' || (select count(*) from public.staff_branch_assignments where staff_id = '${withBooking}')
            || '/' || (select count(*) from public.working_hours where staff_id = '${withBooking}')`), '3/1/1/1');

        // Another business's master is not found.
        await assert.rejects(remove(otherBiz, clean), /STAFF_NOT_FOUND/);

        // A master without history disappears with everything per-master, in one call.
        await remove(biz, clean);
        assert.equal(await sql(`select (select count(*) from public.staff where id = '${clean}')
            || '/' || (select count(*) from public.working_hours where staff_id = '${clean}')
            || '/' || (select count(*) from public.service_staff where staff_id = '${clean}')
            || '/' || (select count(*) from public.staff_branch_assignments where staff_id = '${clean}')`), '0/0/0/0');
        // Only the staff role goes: the owner keeps the business and gets the client role.
        assert.equal(await sql(`select string_agg(r.key, ',' order by r.key) from public.user_roles ur join public.roles r on r.id = ur.role_id
            where ur.user_id = '${ownerUser}' and ur.biz_id = '${biz}'`), 'client,owner');

        // A suspended account cannot take the client role; the card is removed all the same.
        await remove(biz, suspendedClean);
        assert.equal(await sql(`select (select count(*) from public.staff where id = '${suspendedClean}')
            || '/' || (select count(*) from public.user_roles where user_id = '${suspendedUser}')`), '0/0');

        // Only the service role may call the command.
        await assert.rejects(asRole('authenticated', `select public.delete_staff_without_history('${biz}', '${withBooking}')`), /permission denied for function/);
        await assert.rejects(asRole('anon', `select public.delete_staff_without_history('${biz}', '${withBooking}')`), /permission denied for function/);
        await assert.rejects(asRole('service_role', `select public.delete_staff_without_history('${biz}', '${withBooking}')`), /STAFF_HAS_HISTORY/);

        console.log('staff delete without history: ok');
    } finally {
        if (created) await docker(['rm', '--force', container]).catch(() => undefined);
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

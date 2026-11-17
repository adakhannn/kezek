// Access-control integration fixture for 20261118090000_bookings_read_scope. A disposable
// PostgreSQL reproduces the production bookings / booking_services policies and grants (client
// roles: SELECT only on bookings since ENG-29), shows the phone and any-role exposures, applies
// the real migration and checks clients, staff, managers, super admins and the service role.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');

const container = `kezek-bookings-read-${randomUUID()}`;
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
    sql(`set role ${role}; set request.jwt.claims='{"sub":"${id ?? ''}","role":"${role}"}'; ${body}`);
// Sorted labels of the bookings / booking_services rows a role can read.
const seen = (role, id, table = 'bookings') =>
    asRole(role, id, table === 'bookings'
        ? `select coalesce(string_agg(label, ',' order by label collate "C"), '-') from public.bookings`
        : `select coalesce(string_agg(b.label, ',' order by b.label collate "C"), '-') from public.booking_services bs
             join lateral (select label from public.bookings where id = bs.booking_id) b on true`);

const [client, attacker, staffUser, colleagueUser, formerStaffUser, roleOnlyUser, manager, superAdmin, otherClient] =
    Array.from({ length: 9 }, () => randomUUID());
const [biz, otherBiz, staffRow, colleagueRow, formerStaffRow] = Array.from({ length: 5 }, () => randomUUID());
const guestPhone = '996700000001';
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

            create table public.businesses(id uuid primary key, owner_id uuid);
            create table public.staff(id uuid primary key, biz_id uuid, user_id uuid, is_active boolean);
            create table public.roles(id uuid primary key default gen_random_uuid(), key text unique);
            create table public.user_roles(user_id uuid, biz_id uuid, role_id uuid references public.roles(id));
            create table public.profiles(id uuid primary key, phone text);
            create table public.bookings(id uuid primary key default gen_random_uuid(), label text, biz_id uuid, staff_id uuid,
                client_id uuid, client_phone text, status text default 'confirmed');
            create table public.booking_services(id uuid primary key default gen_random_uuid(), booking_id uuid references public.bookings(id));
            create table public.reviews(id uuid primary key default gen_random_uuid(), booking_id uuid, client_id uuid);

            create function public.has_role(p_role_key text, p_biz_id uuid default null) returns boolean language sql stable security definer
                set search_path = public as $$
                select exists(select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
                    where ur.user_id = auth.uid() and r.key = p_role_key and (p_biz_id is null and ur.biz_id is null or ur.biz_id = p_biz_id)) $$;
            create function public.is_super_admin() returns boolean language sql stable security definer set search_path = public as $$
                select auth.uid() is not null and public.has_role('super_admin', null) $$;
            create function public.user_lifecycle_access_allowed() returns boolean language sql stable as $$ select true $$;

            grant select on public.businesses, public.staff, public.roles, public.user_roles, public.profiles, public.reviews
                to anon, authenticated, service_role;
            grant update on public.profiles to authenticated;
            -- ENG-29: client roles keep only SELECT on bookings; booking_services keeps Supabase's ALL.
            grant select on public.bookings to anon, authenticated;
            grant all on public.bookings, public.booking_services to service_role;
            grant all on public.booking_services to anon, authenticated;

            alter table public.profiles enable row level security;
            create policy profiles_self on public.profiles using (id = auth.uid()) with check (id = auth.uid());

            -- Production policies on bookings (pg_policies, 18 Nov 2026).
            alter table public.bookings enable row level security;
            create policy "Business owners can update own bookings" on public.bookings for update to authenticated
                using (biz_id in (select ur.biz_id from user_roles ur join roles r on ur.role_id = r.id
                    where ur.user_id = auth.uid() and r.key = any (array['owner','admin','manager'])) or is_super_admin())
                with check (biz_id in (select ur.biz_id from user_roles ur join roles r on ur.role_id = r.id
                    where ur.user_id = auth.uid() and r.key = any (array['owner','admin','manager'])) or is_super_admin());
            create policy "Business owners can view own bookings" on public.bookings for select to authenticated
                using (biz_id in (select ur.biz_id from user_roles ur join roles r on ur.role_id = r.id
                    where ur.user_id = auth.uid() and r.key = any (array['owner','admin','manager'])) or is_super_admin());
            create policy "Clients can create own bookings" on public.bookings for insert to authenticated
                with check (client_id = auth.uid() or client_id is null);
            create policy "Clients can update own bookings" on public.bookings for update to authenticated
                using (client_id = auth.uid() or (client_phone is not null and exists (select 1 from profiles
                    where profiles.id = auth.uid() and profiles.phone = bookings.client_phone)))
                with check (client_id = auth.uid() or (client_phone is not null and exists (select 1 from profiles
                    where profiles.id = auth.uid() and profiles.phone = bookings.client_phone)));
            create policy "Clients can view own bookings" on public.bookings for select to authenticated
                using (client_id = auth.uid() or (client_phone is not null and exists (select 1 from profiles
                    where profiles.id = auth.uid() and profiles.phone = bookings.client_phone)));
            create policy "Staff can view own bookings" on public.bookings for select to authenticated
                using (exists (select 1 from staff s where s.id = bookings.staff_id and s.user_id = auth.uid() and s.is_active = true));
            create policy "Super admins can manage all bookings" on public.bookings to authenticated using (is_super_admin()) with check (is_super_admin());
            create policy "biz delete" on public.bookings for delete
                using (is_super_admin() or exists (select 1 from user_roles ur where ur.user_id = auth.uid() and ur.biz_id = bookings.biz_id));
            create policy "biz update" on public.bookings for update
                using (is_super_admin() or exists (select 1 from user_roles ur where ur.user_id = auth.uid() and ur.biz_id = bookings.biz_id));
            create policy bookings_insert_client on public.bookings for insert to authenticated with check (client_id = auth.uid());
            create policy bookings_select_client on public.bookings for select to authenticated using (client_id = auth.uid());
            create policy bookings_srv_cascade_upd on public.bookings for update using (auth.role() = 'service_role') with check (true);
            create policy "client insert hold" on public.bookings for insert
                with check (auth.uid() is not null and client_id = auth.uid() and status = 'hold');
            create policy "client reads own bookings" on public.bookings for select to authenticated using (client_id = auth.uid());
            create policy kezek_lifecycle_access on public.bookings as restrictive to authenticated
                using ((select user_lifecycle_access_allowed())) with check ((select user_lifecycle_access_allowed()));
            create policy "manage bookings by role" on public.bookings to authenticated
                using (has_role('owner', biz_id) or has_role('admin', biz_id) or has_role('manager', biz_id) or has_role('super_admin', null))
                with check (has_role('owner', biz_id) or has_role('admin', biz_id) or has_role('manager', biz_id) or has_role('super_admin', null));
            create policy "read bookings by biz or client" on public.bookings for select
                using (is_super_admin() or exists (select 1 from user_roles ur where ur.user_id = auth.uid() and ur.biz_id = bookings.biz_id)
                    or auth.uid() = client_id);
            create policy "read bookings by participants" on public.bookings for select to authenticated
                using (has_role('owner', biz_id) or has_role('admin', biz_id) or has_role('manager', biz_id) or has_role('staff', biz_id)
                    or has_role('super_admin', null));
            create policy "read my bookings" on public.bookings for select to authenticated using (client_id = auth.uid());
            create policy srv_upd_bookings on public.bookings for update using (auth.role() = 'service_role') with check (true);
            create policy super_all on public.bookings using (is_super_admin()) with check (is_super_admin());

            alter table public.booking_services enable row level security;
            create policy "Business owners can view booking_services" on public.booking_services for select to authenticated
                using (exists (select 1 from bookings b where b.id = booking_services.booking_id
                    and (b.biz_id in (select ur.biz_id from user_roles ur join roles r on ur.role_id = r.id
                        where ur.user_id = auth.uid() and r.key = any (array['owner','admin','manager'])) or is_super_admin())));
            create policy "Clients can view own booking_services" on public.booking_services for select to authenticated
                using (exists (select 1 from bookings b where b.id = booking_services.booking_id
                    and (b.client_id = auth.uid() or (b.client_phone is not null and exists (select 1 from profiles p
                        where p.id = auth.uid() and p.phone = b.client_phone)))));
            create policy "Staff can view booking_services" on public.booking_services for select to authenticated
                using (exists (select 1 from bookings b join staff s on s.id = b.staff_id
                    where b.id = booking_services.booking_id and s.user_id = auth.uid() and s.is_active = true));
            create policy "Super admins can manage all booking_services" on public.booking_services to authenticated
                using (is_super_admin()) with check (is_super_admin());
            create policy kezek_lifecycle_access on public.booking_services as restrictive to authenticated
                using ((select user_lifecycle_access_allowed())) with check ((select user_lifecycle_access_allowed()));

            alter table public.reviews enable row level security;
            create policy "Users can select own reviews" on public.reviews for select to authenticated
                using (client_id = auth.uid() or exists (select 1 from bookings b join staff s on s.id = b.staff_id
                    join businesses biz on biz.id = s.biz_id where b.id = reviews.booking_id and biz.owner_id = auth.uid()));

            insert into public.roles(key) values ('owner'), ('admin'), ('manager'), ('staff'), ('client'), ('super_admin');
            insert into public.businesses values ('${biz}', '${manager}'), ('${otherBiz}', null);
            insert into public.staff values ('${staffRow}', '${biz}', '${staffUser}', true), ('${colleagueRow}', '${biz}', '${colleagueUser}', true),
                ('${formerStaffRow}', '${biz}', '${formerStaffUser}', false);
            insert into public.user_roles(user_id, biz_id, role_id)
                select v.u::uuid, v.b::uuid, r.id from (values
                    ('${manager}', '${biz}', 'manager'), ('${staffUser}', '${biz}', 'staff'), ('${colleagueUser}', '${biz}', 'staff'),
                    ('${formerStaffUser}', '${biz}', 'staff'), ('${roleOnlyUser}', '${biz}', 'client'), ('${superAdmin}', null, 'super_admin')) v(u, b, k)
                join public.roles r on r.key = v.k;
            insert into public.profiles values ('${client}', null), ('${attacker}', null), ('${otherClient}', null);
            insert into public.bookings(label, biz_id, staff_id, client_id, client_phone) values
                ('own', '${biz}', '${staffRow}', '${client}', null),
                ('guest', '${biz}', '${colleagueRow}', null, '${guestPhone}'),
                ('colleague', '${biz}', '${colleagueRow}', '${otherClient}', null),
                ('other-biz', '${otherBiz}', null, '${otherClient}', null);
            insert into public.booking_services(booking_id) select id from public.bookings;
            insert into public.reviews(booking_id, client_id) select id, client_id from public.bookings where label = 'own';`);

        // The attacker puts the guest's phone into their own profile (no OTP is needed).
        await asRole('authenticated', attacker, `update public.profiles set phone = '${guestPhone}' where id = auth.uid()`);

        // Exposures before the migration.
        assert.equal(await seen('authenticated', attacker), 'guest', 'DB-06: unverified profile phone reads the guest booking');
        assert.equal(await seen('authenticated', attacker, 'booking_services'), 'guest');
        assert.equal(await seen('authenticated', roleOnlyUser), 'colleague,guest,own', 'DB-07: any user_roles row reads the business');
        assert.equal(await seen('authenticated', staffUser), 'colleague,guest,own', 'DB-07: the staff role reads every booking');
        assert.equal(await seen('authenticated', formerStaffUser), 'colleague,guest,own', 'DB-07: inactive staff keeps reading');

        await sql(fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '20261118090000_bookings_read_scope.sql'), 'utf8'));

        // Clients: own bookings only.
        assert.equal(await seen('authenticated', attacker), '-');
        assert.equal(await seen('authenticated', attacker, 'booking_services'), '-');
        assert.equal(await seen('authenticated', client), 'own');
        assert.equal(await seen('authenticated', client, 'booking_services'), 'own');
        assert.equal(await seen('authenticated', roleOnlyUser), '-');
        assert.equal(await seen('anon', null), '-');

        // Staff: active staff read their own bookings; dismissed staff read nothing.
        assert.equal(await seen('authenticated', staffUser), 'own');
        assert.equal(await seen('authenticated', staffUser, 'booking_services'), 'own');
        assert.equal(await seen('authenticated', colleagueUser), 'colleague,guest');
        assert.equal(await seen('authenticated', formerStaffUser), '-');

        // Managers read the whole business, super admins everything, the service role everything.
        assert.equal(await seen('authenticated', manager), 'colleague,guest,own');
        assert.equal(await seen('authenticated', manager, 'booking_services'), 'colleague,guest,own');
        assert.equal(await seen('authenticated', superAdmin), 'colleague,guest,other-biz,own');
        assert.equal(await seen('service_role', null), 'colleague,guest,other-biz,own');

        // The business owner still sees the reviews of the business (policy subquery on bookings).
        assert.equal(await asRole('authenticated', manager, 'select count(*) from public.reviews'), '1');
        assert.equal(await asRole('authenticated', client, 'select count(*) from public.reviews'), '1');

        // No write policy is left for client roles to revive, and none of them can write.
        assert.equal(await sql(`select string_agg(policyname || ':' || cmd, ',' order by policyname collate "C") from pg_policies
            where tablename = 'bookings'`),
        'Business owners can view own bookings:SELECT,Staff can view own bookings:SELECT,bookings_select_client:SELECT,kezek_lifecycle_access:ALL');
        await assert.rejects(asRole('authenticated', manager, `update public.bookings set status = 'cancelled'`), /permission denied for table bookings/);
        assert.equal(await asRole('service_role', null, `update public.bookings set status = 'paid' where label = 'own' returning label`), 'own');

        console.log('bookings read scope: ok');
    } finally {
        if (created) await docker(['rm', '--force', container]).catch(() => undefined);
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

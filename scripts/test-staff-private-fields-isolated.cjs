// Access-control integration fixture for 20261117160000_staff_private_fields and
// 20261117170000_authenticated_column_privileges. A disposable PostgreSQL reproduces production
// (table-level SELECT for `authenticated`, staff/business rows readable by any signed-in account),
// applies the real migrations and checks the staff member, a manager, another account, anon and
// the service role, plus policies elsewhere that compare staff.user_id / businesses.owner_id.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { POSTGRES_IMAGE } = require('./lib/isolated-postgres.cjs');

const container = `kezek-staff-private-${randomUUID()}`;
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

const [owner, manager, staffUser, stranger, otherOwner] = Array.from({ length: 5 }, () => randomUUID());
const [biz, otherBiz, staffA, staffB, booking] = Array.from({ length: 5 }, () => randomUUID());
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
            create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role' $$;
            grant usage on schema auth to anon, authenticated, service_role;

            create table public.businesses(id uuid primary key, name text, slug text, phones text[], address text, coords text, categories text[],
                tz text, plan text, is_approved boolean, owner_id uuid, created_at timestamptz default now(), email_notify_to text[],
                rating_score numeric(5,2), rating_updated_at timestamptz, city_id uuid, last_rating_recalculated_at timestamptz,
                branch_limit integer, creation_source text, created_by_user_id uuid, source_application_id uuid,
                contact_phone text, contact_whatsapp text, contact_email text, website_url text);
            create table public.staff(id uuid primary key, biz_id uuid references public.businesses(id), branch_id uuid, full_name text, skills text[],
                is_active boolean default true, created_at timestamptz default now(), email text, phone text, user_id uuid, avatar_url text,
                percent_master numeric(5,2), percent_salon numeric(5,2), hourly_rate numeric(10,2), rating_score numeric(5,2),
                rating_updated_at timestamptz, last_rating_recalculated_at timestamptz);
            create table public.roles(id uuid primary key default gen_random_uuid(), key text unique);
            create table public.user_roles(user_id uuid, biz_id uuid, role_id uuid references public.roles(id));
            create table public.bookings(id uuid primary key, biz_id uuid, staff_id uuid);

            -- Production-shaped access: public rows for everyone, sub-query policies on user_id / owner_id.
            alter table public.businesses enable row level security;
            create policy biz_public_read on public.businesses for select using (is_approved = true);
            alter table public.staff enable row level security;
            create policy staff_public_read on public.staff for select
                using (is_active = true and biz_id in (select b.id from public.businesses b where b.is_approved));
            alter table public.bookings enable row level security;
            create policy bookings_staff_read on public.bookings for select to authenticated
                using (exists (select 1 from public.staff s where s.id = bookings.staff_id and s.user_id = auth.uid()));
            create policy bookings_owner_read on public.bookings for select to authenticated
                using (exists (select 1 from public.businesses b where b.id = bookings.biz_id and b.owner_id = auth.uid()));

            create function public.finance_is_platform_admin(p_actor_id uuid) returns boolean language sql stable security definer as $$ select false $$;
            create function public.finance_can_manage_business(p_actor_id uuid, p_biz_id uuid) returns boolean language sql stable security definer
                set search_path = pg_catalog, public as $$
                select p_actor_id is not null and (
                    exists(select 1 from public.businesses b where b.id = p_biz_id and b.owner_id = p_actor_id)
                    or exists(select 1 from public.user_roles u join public.roles r on r.id = u.role_id
                        where u.user_id = p_actor_id and u.biz_id = p_biz_id and r.key in ('owner','admin','manager'))
                    or public.finance_is_platform_admin(p_actor_id)) $$;
            revoke all on function public.finance_can_manage_business(uuid, uuid) from public, anon, authenticated;

            grant all on all tables in schema public to anon, authenticated, service_role;

            insert into public.roles(key) values ('owner'), ('admin'), ('manager'), ('staff');
            insert into public.businesses(id, name, slug, is_approved, owner_id, email_notify_to, created_by_user_id, contact_phone)
                values ('${biz}', 'Salon', 'salon', true, '${owner}', array['owner-notify@unit.test'], '${owner}', '+996555000000'),
                       ('${otherBiz}', 'Other', 'other', true, '${otherOwner}', array['other@unit.test'], '${otherOwner}', null);
            insert into public.user_roles(user_id, biz_id, role_id) select '${manager}'::uuid, '${biz}'::uuid, id from public.roles where key = 'manager';
            insert into public.staff(id, biz_id, full_name, email, phone, user_id, percent_master, percent_salon, hourly_rate)
                values ('${staffA}', '${biz}', 'Aida', 'aida@unit.test', '+996555111111', '${staffUser}', 60, 40, 150),
                       ('${staffB}', '${otherBiz}', 'Bek', 'bek@unit.test', '+996555222222', null, 70, 30, null);
            insert into public.bookings values ('${booking}', '${biz}', '${staffA}');`);

        // The fixture reproduces the exposure: a stranger reads contacts and pay terms of other businesses.
        assert.equal(await asRole('authenticated', stranger, `select phone || '|' || percent_master from public.staff where id = '${staffB}'`), '+996555222222|70.00');
        assert.equal(await asRole('authenticated', stranger, `select array_to_string(email_notify_to, ',') from public.businesses where id = '${biz}'`), 'owner-notify@unit.test');

        for (const migration of ['20261117160000_staff_private_fields.sql', '20261117170000_authenticated_column_privileges.sql']) {
            await sql(fs.readFileSync(path.join(__dirname, '../supabase/migrations', migration), 'utf8'));
        }

        // Signed-in accounts keep the public columns and the ids that policies compare.
        assert.equal(await asRole('authenticated', stranger, 'select count(*) from public.staff'), '2');
        assert.equal(await asRole('authenticated', stranger, `select full_name || '|' || coalesce(user_id::text, '-') from public.staff where id = '${staffA}'`), `Aida|${staffUser}`);
        assert.equal(await asRole('authenticated', stranger, `select owner_id from public.businesses where id = '${biz}'`), owner);
        for (const column of ['email', 'phone', 'percent_master', 'percent_salon', 'hourly_rate']) {
            await assert.rejects(asRole('authenticated', stranger, `select ${column} from public.staff`), /permission denied/, `staff.${column}`);
        }
        for (const column of ['email_notify_to', 'created_by_user_id', 'source_application_id']) {
            await assert.rejects(asRole('authenticated', stranger, `select ${column} from public.businesses`), /permission denied/, `businesses.${column}`);
        }
        await assert.rejects(asRole('authenticated', stranger, 'select * from public.staff'), /permission denied/);

        // Policies elsewhere that compare staff.user_id and businesses.owner_id still work.
        assert.equal(await asRole('authenticated', staffUser, 'select count(*) from public.bookings'), '1');
        assert.equal(await asRole('authenticated', owner, 'select count(*) from public.bookings'), '1');
        assert.equal(await asRole('authenticated', stranger, 'select count(*) from public.bookings'), '0');

        // Private fields through the function: the staff member, managers of that business, service role.
        const privateRow = (id) => `select email || '|' || phone || '|' || percent_master || '|' || coalesce(hourly_rate::text, '-') from public.staff_private_fields('${id}')`;
        assert.equal(await asRole('authenticated', staffUser, privateRow(staffA)), 'aida@unit.test|+996555111111|60.00|150.00');
        assert.equal(await asRole('authenticated', owner, privateRow(staffA)), 'aida@unit.test|+996555111111|60.00|150.00');
        assert.equal(await asRole('authenticated', manager, privateRow(staffA)), 'aida@unit.test|+996555111111|60.00|150.00');
        assert.equal(await asRole('service_role', stranger, privateRow(staffB)), 'bek@unit.test|+996555222222|70.00|-');
        await assert.rejects(asRole('authenticated', stranger, privateRow(staffA)), /STAFF_FORBIDDEN/);
        await assert.rejects(asRole('authenticated', staffUser, privateRow(staffB)), /STAFF_FORBIDDEN/);
        await assert.rejects(asRole('authenticated', manager, privateRow(staffB)), /STAFF_FORBIDDEN/);
        await assert.rejects(asRole('anon', stranger, privateRow(staffA)), /permission denied for function/);
        assert.equal(await asRole('authenticated', owner, `select count(*) from public.staff_private_fields('${randomUUID()}')`), '0');

        console.log('staff private fields and authenticated column privileges: ok');
    } finally {
        if (created) await docker(['rm', '--force', container]).catch(() => undefined);
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

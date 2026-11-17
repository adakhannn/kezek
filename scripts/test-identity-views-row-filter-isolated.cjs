// Access-control integration fixture for 20261117100000_identity_views_row_filter.
// A disposable PostgreSQL reproduces the production exposure (owner-rights views over
// auth.users readable by `authenticated`), applies the real migration and checks every
// consumer: own-row RLS policies, a SECURITY DEFINER reader, the service role and super admins.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');

const container = `kezek-identity-views-${randomUUID()}`;
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

const [admin, owner, staffUser, client, biz] = Array.from({ length: 5 }, () => randomUUID());
const columns = (view) => sql(`select string_agg(attname || ':' || format_type(atttypid, atttypmod), ',' order by attnum) from pg_attribute where attrelid = 'public.${view}'::regclass and attnum > 0`);
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

        await sql(`create role anon; create role authenticated; create role service_role; create schema auth;
            create function auth.uid() returns uuid language sql stable as $$ select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
            grant usage on schema auth to anon,authenticated,service_role;
            create table auth.users(id uuid primary key, email varchar(255), phone text, raw_user_meta_data jsonb, created_at timestamptz default now());
            create table public.user_suspensions(user_id uuid);
            create table public.roles(id uuid primary key default gen_random_uuid(), key text unique, name text);
            create table public.user_roles(user_id uuid, biz_id uuid, role_id uuid references public.roles(id));
            create function public.is_super_admin() returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
                select auth.uid() is not null and exists(select 1 from public.user_roles u join public.roles r on r.id=u.role_id
                    where u.user_id=auth.uid() and u.biz_id is null and r.key='super_admin') $$;

            -- The views exactly as the production baseline defines them: no row filter.
            create view public.auth_users_view as select id, email, phone,
                nullif((raw_user_meta_data ->> 'full_name'::text), ''::text) as full_name, created_at,
                (exists (select 1 from public.user_suspensions s where s.user_id = u.id)) as is_suspended
                from auth.users u;
            create view public.user_roles_with_user as select ur.user_id, ur.biz_id, r.key as role_key, r.name as role_name,
                au.email, au.phone, nullif((au.raw_user_meta_data ->> 'full_name'::text), ''::text) as full_name
                from ((public.user_roles ur join public.roles r on ((r.id = ur.role_id))) left join auth.users au on ((au.id = ur.user_id)));
            create view public.user_roles_legacy as select ur.user_id, ur.biz_id, r.key as role
                from (public.user_roles ur join public.roles r on ((r.id = ur.role_id)));

            -- Consumers as in production: own-row RLS policies and a SECURITY DEFINER reader.
            create table public.rating_jobs(id serial primary key, note text);
            alter table public.rating_jobs enable row level security;
            create policy "Rating jobs superadmin" on public.rating_jobs for all to authenticated
                using (exists (select 1 from public.user_roles_with_user ur where ur.user_id = auth.uid() and ur.role_key = 'super_admin' and ur.biz_id is null))
                with check (exists (select 1 from public.user_roles_with_user ur where ur.user_id = auth.uid() and ur.role_key = 'super_admin' and ur.biz_id is null));
            create table public.finance_settings_audit_log(id serial primary key, biz_id uuid);
            alter table public.finance_settings_audit_log enable row level security;
            create policy "Managers can view audit log for their biz" on public.finance_settings_audit_log for select to authenticated
                using (exists (select 1 from public.user_roles_with_user ur where ur.user_id = auth.uid()
                    and ur.biz_id = finance_settings_audit_log.biz_id and ur.role_key = any (array['owner'::text, 'manager'::text])));
            create function public.members_of_biz(p_biz_id uuid) returns table(user_id uuid, email text)
                language plpgsql security definer set search_path to 'public' as $$
                begin return query select u.user_id, u.email::text from public.user_roles_with_user u where u.biz_id = p_biz_id; end; $$;

            grant all on all tables in schema public to authenticated, service_role;
            grant usage on all sequences in schema public to authenticated, service_role;
            revoke select on public.auth_users_view, public.user_roles_with_user, public.user_roles_legacy from anon;
            grant execute on all functions in schema public to anon, authenticated, service_role;

            insert into auth.users(id, email, phone, raw_user_meta_data) values
                ('${admin}', 'admin@unit.test', '+10000000001', '{"full_name":"Admin"}'),
                ('${owner}', 'owner@unit.test', '+10000000002', '{"full_name":"Owner"}'),
                ('${staffUser}', 'staff@unit.test', '+10000000003', '{"full_name":"Staff"}'),
                ('${client}', 'client@unit.test', '+10000000004', '{"full_name":"Client"}');
            insert into public.roles(key, name) values ('super_admin', 'Super'), ('owner', 'Owner'), ('manager', 'Manager'), ('staff', 'Staff');
            insert into public.user_roles(user_id, biz_id, role_id) select '${admin}'::uuid, null::uuid, id from public.roles where key = 'super_admin';
            insert into public.user_roles(user_id, biz_id, role_id) select '${owner}'::uuid, '${biz}'::uuid, id from public.roles where key = 'owner';
            insert into public.user_roles(user_id, biz_id, role_id) select '${staffUser}'::uuid, '${biz}'::uuid, id from public.roles where key = 'staff';
            insert into public.rating_jobs(note) values ('existing');
            insert into public.finance_settings_audit_log(biz_id) values ('${biz}');
        `);

        // The fixture reproduces the production exposure before the migration runs.
        assert.equal(await asRole('authenticated', client, 'select count(*) from public.auth_users_view'), '4');
        assert.equal(await asRole('authenticated', client, 'select count(*) from public.user_roles_with_user'), '3');
        const before = { auth: await columns('auth_users_view'), roles: await columns('user_roles_with_user'), legacy: await columns('user_roles_legacy') };

        await sql(fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261117100000_identity_views_row_filter.sql'), 'utf8'));

        // Shape and grants are unchanged, so PostgREST clients and generated types keep working.
        assert.deepEqual({ auth: await columns('auth_users_view'), roles: await columns('user_roles_with_user'), legacy: await columns('user_roles_legacy') }, before);
        for (const view of ['auth_users_view', 'user_roles_with_user', 'user_roles_legacy']) {
            assert.equal(await sql(`select has_table_privilege('authenticated', 'public.${view}', 'SELECT')`), 't', `${view}: authenticated grant`);
            assert.equal(await sql(`select has_table_privilege('anon', 'public.${view}', 'SELECT')`), 'f', `${view}: anon grant`);
        }

        // 1. An ordinary account sees only itself.
        assert.equal(await asRole('authenticated', client, 'select string_agg(email, \',\') from public.auth_users_view'), 'client@unit.test');
        assert.equal(await asRole('authenticated', client, 'select count(*) from public.user_roles_with_user'), '0');
        assert.equal(await asRole('authenticated', client, 'select count(*) from public.user_roles_legacy'), '0');
        assert.equal(await asRole('authenticated', staffUser, 'select string_agg(role_key || \'/\' || email, \',\') from public.user_roles_with_user'), 'staff/staff@unit.test');
        assert.equal(await asRole('authenticated', staffUser, 'select string_agg(role, \',\') from public.user_roles_legacy'), 'staff');
        await assert.rejects(asRole('anon', client, 'select count(*) from public.auth_users_view'), /permission denied/);

        // 2. Own-row policies keep their meaning.
        assert.equal(await asRole('authenticated', owner, 'select count(*) from public.finance_settings_audit_log'), '1');
        assert.equal(await asRole('authenticated', staffUser, 'select count(*) from public.finance_settings_audit_log'), '0');
        assert.equal(await asRole('authenticated', admin, 'insert into public.rating_jobs(note) values (\'by admin\') returning note'), 'by admin');
        assert.equal(await asRole('authenticated', admin, 'select count(*) from public.rating_jobs'), '2');
        assert.equal(await asRole('authenticated', client, 'select count(*) from public.rating_jobs'), '0');
        await assert.rejects(asRole('authenticated', client, 'insert into public.rating_jobs(note) values (\'by client\')'), /row-level security/);

        // 3. Privileged readers still see everything they saw before.
        assert.equal(await asRole('authenticated', owner, `select count(*) from public.members_of_biz('${biz}')`), '2');
        assert.equal(await asRole('authenticated', admin, 'select count(*) from public.auth_users_view'), '4');
        assert.equal(await asRole('authenticated', admin, 'select count(*) from public.user_roles_with_user'), '3');
        assert.equal(await asRole('service_role', client, 'select count(*) from public.auth_users_view'), '4');
        assert.equal(await asRole('service_role', client, 'select count(*) from public.user_roles_with_user'), '3');
        assert.equal(await asRole('service_role', client, 'select count(*) from public.user_roles_legacy'), '3');
        assert.equal(await sql('select count(*) from public.auth_users_view'), '4');

        console.log('identity views row filter: ok');
    } finally {
        if (created) await docker(['rm', '--force', container]).catch(() => undefined);
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

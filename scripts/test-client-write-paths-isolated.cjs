// Access-control integration fixture for 20261117200000_close_client_write_paths. A disposable
// PostgreSQL reproduces the production grants and policies (Supabase defaults: ALL for client
// roles), shows each exposure, applies the real migration and checks clients, managers, branch
// admins, SECURITY DEFINER commands and the service role.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');

const container = `kezek-client-writes-${randomUUID()}`;
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
// Number of rows a write statement touched. psql's ROW_COUNT avoids RETURNING, which would also
// apply SELECT policies and privileges to the written rows.
const touched = (role, id, statement) => asRole(role, id, `${statement};\n\\echo :ROW_COUNT`);

const [owner, manager, staffUser, stranger, branchAdmin, otherOwner] = Array.from({ length: 6 }, () => randomUUID());
const [biz, otherBiz, branchA, branchB, staffA] = Array.from({ length: 5 }, () => randomUUID());
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
            create function auth.uid() returns uuid language sql stable as $$ select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
            create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role' $$;
            grant usage on schema auth to anon, authenticated, service_role;
            alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
            alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

            create table auth.users(id uuid primary key, email text, phone text, raw_user_meta_data jsonb, created_at timestamptz default now(),
                email_confirmed_at timestamptz, phone_confirmed_at timestamptz, deleted_at timestamptz);
            create table public.businesses(id uuid primary key, name text, categories text[], is_approved boolean default true,
                owner_id uuid, branch_limit integer default 1, rating_score numeric);
            create table public.branches(id uuid primary key, biz_id uuid references public.businesses(id), name text);
            create table public.staff(id uuid primary key default gen_random_uuid(), biz_id uuid references public.businesses(id),
                branch_id uuid references public.branches(id), full_name text, skills text[], is_active boolean default true,
                created_at timestamptz default now(), email text, phone text, user_id uuid, avatar_url text,
                percent_master numeric default 60, percent_salon numeric default 40, hourly_rate numeric, rating_score numeric,
                rating_updated_at timestamptz, last_rating_recalculated_at timestamptz);
            create table public.roles(id uuid primary key default gen_random_uuid(), key text unique);
            create table public.user_roles(user_id uuid, biz_id uuid, role_id uuid references public.roles(id));
            create table public.branch_admins(branch_id uuid, user_id uuid);
            create table public.user_suspensions(user_id uuid primary key references auth.users(id), reason text,
                created_at timestamptz default now(), created_by uuid);

            create view public.auth_users_view as select id, email, phone, created_at from auth.users
                where id = auth.uid() or current_user = any (array['postgres', 'service_role']::name[]);
            create view public.current_staff_branch as select distinct on (s.id) s.id as staff_id, s.branch_id from public.staff s order by s.id;

            create function public.has_role(p_role_key text, p_biz_id uuid default null) returns boolean language sql stable security definer
                set search_path = public as $$
                select exists(select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
                    where ur.user_id = auth.uid() and r.key = p_role_key and (p_biz_id is null and ur.biz_id is null or ur.biz_id = p_biz_id)) $$;
            create function public.is_super_admin() returns boolean language sql stable security definer set search_path = public as $$
                select auth.uid() is not null and public.has_role('super_admin', null) $$;
            create function public.has_branch_admin(p_branch_id uuid) returns boolean language sql stable security definer set search_path = public as $$
                select exists(select 1 from public.branch_admins ba where ba.branch_id = p_branch_id and ba.user_id = auth.uid()) $$;
            create function public.finance_is_platform_admin(p_actor_id uuid) returns boolean language sql stable security definer as $$ select false $$;
            create function public.finance_can_manage_business(p_actor_id uuid, p_biz_id uuid) returns boolean language sql stable security definer
                set search_path = pg_catalog, public as $$
                select p_actor_id is not null and (
                    exists(select 1 from public.businesses b where b.id = p_biz_id and b.owner_id = p_actor_id)
                    or exists(select 1 from public.user_roles u join public.roles r on r.id = u.role_id
                        where u.user_id = p_actor_id and u.biz_id = p_biz_id and r.key in ('owner','admin','manager'))
                    or public.finance_is_platform_admin(p_actor_id)) $$;

            -- Production bodies of the functions the migration drops or replaces.
            create function public.grant_role_rpc(p_user uuid, p_biz uuid, p_role text) returns void language plpgsql security definer
                set search_path = public as $$
                declare v_role_id uuid;
                begin
                    select id into v_role_id from public.roles where key = p_role;
                    if not (public.has_role('super_admin', null) or public.has_role('owner', p_biz) or public.has_role('admin', p_biz)
                            or public.has_role('manager', p_biz)) then raise exception 'forbidden'; end if;
                    insert into public.user_roles(user_id, biz_id, role_id) values (p_user, p_biz, v_role_id);
                end $$;
            create function public.revoke_role_rpc(p_user uuid, p_biz uuid, p_role text) returns void language sql security definer as $$ select $$;
            create function public.assign_business_owner(p_biz_id uuid, p_user_id uuid) returns void language sql as $$
                update public.businesses set owner_id = p_user_id where id = p_biz_id $$;
            create function public.delete_business_cascade(p_biz_id uuid) returns void language sql security definer as $$
                delete from public.businesses where id = p_biz_id $$;
            create function public.cat_remove_slug(the_slug text) returns integer language plpgsql security definer set search_path = public as $$
                declare v_count int := 0;
                begin
                    if not public.is_super_admin() then raise exception 'forbidden' using errcode = 'P0001'; end if;
                    update public.businesses set categories = array(select x from unnest(coalesce(categories, '{}'::text[])) as t(x) where x <> the_slug)
                     where categories @> array[the_slug] returning 1 into v_count;
                    return coalesce(v_count, 0);
                end $$;
            create function public.cat_replace_slug(old_slug text, new_slug text) returns integer language plpgsql security definer set search_path = public as $$
                declare v_count int := 0;
                begin
                    if not public.is_super_admin() then raise exception 'forbidden' using errcode = 'P0001'; end if;
                    update public.businesses set categories = array(select case when x = old_slug then new_slug else x end
                        from unnest(coalesce(categories, '{}'::text[])) as t(x)) where categories @> array[old_slug] returning 1 into v_count;
                    return coalesce(v_count, 0);
                end $$;
            -- A checked command that writes staff as its owner (like the transfer and shift close commands).
            create function public.fixture_definer_set_rate(p_staff uuid, p_rate numeric) returns void language sql security definer as $$
                update public.staff set hourly_rate = p_rate where id = p_staff $$;

            alter table public.user_suspensions enable row level security;
            create policy user_suspensions_self_read on public.user_suspensions for select using (user_id = auth.uid());
            create policy user_suspensions_srv_all on public.user_suspensions using (auth.role() = 'service_role') with check (true);

            alter table public.staff enable row level security;
            create policy "Public can view active staff" on public.staff for select to authenticated, anon using (is_active);
            create policy "Staff can update own profile" on public.staff for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
            create policy "Business owners can manage own staff" on public.staff to authenticated
                using (biz_id in (select ur.biz_id from public.user_roles ur join public.roles r on r.id = ur.role_id
                    where ur.user_id = auth.uid() and r.key in ('owner', 'admin', 'manager')))
                with check (biz_id in (select ur.biz_id from public.user_roles ur join public.roles r on r.id = ur.role_id
                    where ur.user_id = auth.uid() and r.key in ('owner', 'admin', 'manager')));
            create policy manage_staff_by_branch on public.staff to authenticated using (public.has_branch_admin(branch_id)) with check (public.has_branch_admin(branch_id));

            alter table public.businesses enable row level security;
            create policy "Public can view approved businesses" on public.businesses for select using (is_approved);
            create policy "Business owners can update own businesses" on public.businesses for update to authenticated
                using (owner_id = auth.uid()) with check (owner_id = auth.uid());
            create policy "update business by role" on public.businesses for update
                using (auth.uid() is not null and (public.has_role('owner', id) or public.has_role('admin', id) or public.has_role('manager', id)));
            create policy "manage businesses by role" on public.businesses to authenticated
                using (public.has_role('owner', id) or public.has_role('admin', id) or public.has_role('manager', id))
                with check (public.has_role('owner', id) or public.has_role('admin', id) or public.has_role('manager', id));

            alter table public.branches enable row level security;
            create policy branches_read on public.branches for select using (true);
            alter table public.user_roles enable row level security;
            create policy user_roles_self on public.user_roles for select using (user_id = auth.uid());

            insert into auth.users(id, email, email_confirmed_at) select id, id || '@unit.test', now() from unnest(array[
                '${owner}', '${manager}', '${staffUser}', '${stranger}', '${branchAdmin}', '${otherOwner}']::uuid[]) id;
            insert into public.roles(key) values ('owner'), ('admin'), ('manager'), ('staff'), ('super_admin');
            insert into public.businesses(id, name, owner_id, categories) values
                ('${biz}', 'Salon', '${owner}', array['barber', 'spa']), ('${otherBiz}', 'Other', '${otherOwner}', array['barber', 'spa', 'nails']);
            insert into public.branches values ('${branchA}', '${biz}', 'A'), ('${branchB}', '${otherBiz}', 'B');
            insert into public.user_roles(user_id, biz_id, role_id) select '${manager}'::uuid, '${biz}'::uuid, id from public.roles where key = 'manager';
            insert into public.user_roles(user_id, biz_id, role_id) select '${owner}'::uuid, '${biz}'::uuid, id from public.roles where key = 'owner';
            insert into public.branch_admins values ('${branchA}', '${branchAdmin}');
            insert into public.staff(id, biz_id, branch_id, full_name, user_id, percent_master, percent_salon, hourly_rate)
                values ('${staffA}', '${biz}', '${branchA}', 'Aida', '${staffUser}', 60, 40, 150);`);

        // The fixture reproduces each exposure before the migration (every write is reverted).
        assert.equal(await touched('anon', stranger, `insert into public.user_suspensions(user_id, reason) values ('${owner}', 'x')`), '1');
        assert.equal(await touched('anon', stranger, `insert into public.auth_users_view(id, email) values ('${randomUUID()}', 'x@unit.test')`), '1');
        assert.equal(await touched('authenticated', stranger, `update public.auth_users_view set email = 'taken@unit.test' where id = auth.uid()`), '1');
        assert.equal(await touched('authenticated', staffUser, `update public.staff set percent_master = 100, percent_salon = 0, hourly_rate = 9999 where user_id = auth.uid()`), '1');
        assert.equal(await touched('authenticated', owner, `update public.businesses set is_approved = true, branch_limit = 99 where id = '${biz}'`), '1');
        assert.equal(await touched('authenticated', branchAdmin, `insert into public.staff(biz_id, branch_id, full_name) values ('${otherBiz}', '${branchA}', 'Ghost')`), '1');
        await asRole('authenticated', manager, `select public.grant_role_rpc('${manager}', '${biz}', 'owner')`);
        assert.equal(await sql(`select count(*) from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = '${manager}' and r.key = 'owner'`), '1');
        await sql(`delete from public.user_suspensions; delete from auth.users where email = 'x@unit.test';
            update auth.users set email = id || '@unit.test'; delete from public.staff where full_name = 'Ghost';
            update public.staff set percent_master = 60, percent_salon = 40, hourly_rate = 150;
            update public.businesses set branch_limit = 1;
            delete from public.user_roles ur using public.roles r where r.id = ur.role_id and ur.user_id = '${manager}' and r.key = 'owner';`);

        await sql(fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261117200000_close_client_write_paths.sql'), 'utf8'));

        // DB-01: only the service role writes suspensions; users still read their own.
        for (const role of ['anon', 'authenticated']) {
            await assert.rejects(touched(role, stranger, `insert into public.user_suspensions(user_id, reason) values ('${owner}', 'x')`), /permission denied/, role);
        }
        assert.equal(await touched('service_role', stranger, `insert into public.user_suspensions(user_id, reason) values ('${stranger}', 'x')`), '1');
        assert.equal(await asRole('authenticated', stranger, 'select count(*) from public.user_suspensions'), '1');
        assert.equal(await asRole('authenticated', owner, 'select count(*) from public.user_suspensions'), '0');
        await assert.rejects(touched('authenticated', stranger, `delete from public.user_suspensions where user_id = auth.uid()`), /permission denied/);

        // DB-02: views over auth.users and other project views are read-only for clients.
        await assert.rejects(touched('anon', stranger, `insert into public.auth_users_view(id, email) values ('${randomUUID()}', 'x@unit.test')`), /permission denied/);
        await assert.rejects(touched('authenticated', stranger, `update public.auth_users_view set email = 'taken@unit.test' where id = auth.uid()`), /permission denied/);
        await assert.rejects(touched('authenticated', stranger, `delete from public.auth_users_view where id = auth.uid()`), /permission denied/);
        assert.equal(await asRole('authenticated', stranger, 'select email from public.auth_users_view'), `${stranger}@unit.test`);
        assert.equal(await asRole('service_role', stranger, 'select count(*) from public.auth_users_view'), '6');
        assert.equal(await sql(`select has_table_privilege('authenticated', 'public.current_staff_branch', 'INSERT')
            or has_table_privilege('anon', 'public.current_staff_branch', 'UPDATE')`), 'f');
        assert.equal(await sql(`select has_table_privilege('authenticated', 'public.current_staff_branch', 'SELECT')`), 't');

        // DB-03: staff cannot change their own pay terms, activity or business.
        assert.equal(await touched('authenticated', staffUser, `update public.staff set percent_master = 100, percent_salon = 0 where user_id = auth.uid()`), '0');
        assert.equal(await touched('authenticated', staffUser, `update public.staff set full_name = 'Me' where user_id = auth.uid()`), '0');
        assert.equal(await sql(`select percent_master || '|' || hourly_rate || '|' || full_name from public.staff where id = '${staffA}'`), '60|150|Aida');

        // Managers of the business keep managing staff, within their business.
        assert.equal(await touched('authenticated', manager, `update public.staff set percent_master = 70, percent_salon = 30, hourly_rate = 200,
            is_active = true, phone = '+996555000000' where id = '${staffA}'`), '1');
        assert.equal(await touched('authenticated', owner, `update public.staff set full_name = 'Aida K.' where id = '${staffA}'`), '1');
        await assert.rejects(touched('authenticated', manager, `update public.staff set biz_id = '${otherBiz}' where id = '${staffA}'`), /STAFF_FIELD_READ_ONLY/);
        await assert.rejects(touched('authenticated', manager, `update public.staff set rating_score = 5 where id = '${staffA}'`), /STAFF_FIELD_READ_ONLY/);
        assert.equal(await touched('authenticated', manager, `insert into public.staff(biz_id, branch_id, full_name, rating_score) values ('${biz}', '${branchA}', 'New', 5)`), '1');
        assert.equal(await sql(`select coalesce(rating_score::text, 'null') from public.staff where full_name = 'New'`), 'null');
        await assert.rejects(touched('authenticated', manager, `insert into public.staff(biz_id, branch_id, full_name) values ('${biz}', '${branchB}', 'Cross')`), /STAFF_WRITE_FORBIDDEN/);
        await assert.rejects(touched('authenticated', manager, `delete from public.staff where id = '${staffA}'`), /permission denied/);

        // Branch admins (no business role) edit names in their branch, not pay terms, and cannot create staff elsewhere.
        await assert.rejects(touched('authenticated', branchAdmin, `insert into public.staff(biz_id, branch_id, full_name) values ('${otherBiz}', '${branchA}', 'Ghost')`), /STAFF_WRITE_FORBIDDEN/);
        assert.equal(await touched('authenticated', branchAdmin, `update public.staff set full_name = 'Aida B.' where id = '${staffA}'`), '1');
        await assert.rejects(touched('authenticated', branchAdmin, `update public.staff set hourly_rate = 1 where id = '${staffA}'`), /STAFF_WRITE_FORBIDDEN/);
        await assert.rejects(touched('anon', stranger, `update public.staff set full_name = 'x'`), /permission denied/);

        // Checked SECURITY DEFINER commands and the service role are not restricted by the guard.
        await asRole('authenticated', stranger, `select public.fixture_definer_set_rate('${staffA}', 321)`);
        assert.equal(await touched('service_role', stranger, `update public.staff set rating_score = 4.5, biz_id = biz_id where id = '${staffA}'`), '1');
        assert.equal(await sql(`select hourly_rate || '|' || rating_score || '|' || percent_master || '|' || full_name from public.staff where id = '${staffA}'`), '321|4.5|70|Aida B.');

        // DB-04: businesses are written only by the service role.
        await assert.rejects(touched('authenticated', owner, `update public.businesses set is_approved = true where id = '${biz}'`), /permission denied/);
        await assert.rejects(touched('authenticated', owner, `delete from public.businesses where id = '${biz}'`), /permission denied/);
        await assert.rejects(touched('authenticated', owner, `insert into public.businesses(id, name) values ('${randomUUID()}', 'x')`), /permission denied/);
        assert.equal(await asRole('authenticated', owner, `select count(*) from public.businesses`), '2');
        assert.equal(await touched('service_role', stranger, `update public.businesses set branch_limit = 3 where id = '${biz}'`), '1');

        // DB-05: role and ownership helpers are gone.
        assert.equal(await sql(`select count(*) from pg_proc where pronamespace = 'public'::regnamespace
            and proname in ('grant_role_rpc', 'revoke_role_rpc', 'assign_business_owner', 'delete_business_cascade')`), '0');

        // Category maintenance works for the service role with several businesses, and only for it.
        assert.equal(await asRole('service_role', stranger, `select public.cat_replace_slug('barber', 'barbershop')`), '2');
        assert.equal(await asRole('service_role', stranger, `select public.cat_remove_slug('spa')`), '2');
        assert.equal(await sql(`select string_agg(array_to_string(categories, ','), ';' order by name) from public.businesses`), 'barbershop,nails;barbershop');
        await assert.rejects(asRole('authenticated', owner, `select public.cat_remove_slug('nails')`), /permission denied for function/);

        // TRUNCATE (not subject to RLS), REFERENCES and TRIGGER: gone for clients, now and for new tables.
        assert.equal(await sql(`select bool_or(has_table_privilege(r, t, p)) from unnest(array['anon', 'authenticated']) r,
            unnest(array['public.staff', 'public.businesses', 'public.user_suspensions', 'public.auth_users_view']) t,
            unnest(array['TRUNCATE', 'REFERENCES', 'TRIGGER']) p`), 'f');
        assert.equal(await sql(`select has_table_privilege('service_role', 'public.staff', 'TRUNCATE')`), 't');
        await sql('create table public.fixture_new_table(id int)');
        assert.equal(await sql(`select has_table_privilege('authenticated', 'public.fixture_new_table', 'SELECT')
            and not has_table_privilege('authenticated', 'public.fixture_new_table', 'TRUNCATE')
            and not has_table_privilege('anon', 'public.fixture_new_table', 'TRIGGER')`), 't');

        // API-01: exact account lookup by a confirmed e-mail or phone, for the service role only.
        await sql(`update auth.users set phone = '996555000111', phone_confirmed_at = now(), raw_user_meta_data = '{"full_name":"Str"}' where id = '${stranger}';
            update auth.users set phone = '996555000222', email_confirmed_at = null where id = '${otherOwner}';`);
        const lookup = (email, phone) => asRole('service_role', stranger,
            `select coalesce(string_agg(id::text || '|' || coalesce(full_name, '-'), ','), 'none') from public.find_accounts_by_contact(${email}, ${phone})`);
        assert.equal(await lookup(`'${stranger.toUpperCase()}@UNIT.TEST'`, 'null'), `${stranger}|Str`);
        assert.equal(await lookup('null', `'996555000111'`), `${stranger}|Str`);
        assert.equal(await lookup(`'${otherOwner}@unit.test'`, 'null'), 'none');
        assert.equal(await lookup('null', `'996555000222'`), 'none');
        assert.equal(await lookup(`'%@unit.test'`, `'%'`), 'none');
        assert.equal(await lookup('null', 'null'), 'none');
        await assert.rejects(asRole('authenticated', owner, `select * from public.find_accounts_by_contact('x@unit.test', null)`), /permission denied for function/);

        console.log('client write paths: ok');
    } finally {
        if (created) await docker(['rm', '--force', container]).catch(() => undefined);
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

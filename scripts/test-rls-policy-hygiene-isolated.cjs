// Integration fixture for 20261119040000_rls_policy_hygiene (DB-09). A disposable PostgreSQL with a
// Supabase-like auth.uid() and the tables the migration touches shows that wrapping auth.*() calls
// in (select ...) changes no visibility or write decision for any user, that the plan evaluates the
// call once (InitPlan) instead of per row, that the dead policies go, and that re-running is a no-op.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { POSTGRES_IMAGE } = require('./lib/isolated-postgres.cjs');
const { assertLiveFunctions } = require('./lib/live-schema.cjs');

const migration = fs.readFileSync(
    path.join(__dirname, '..', 'supabase', 'migrations', '20261119040000_rls_policy_hygiene.sql'),
    'utf8',
).replace(/\r/g, '');

const container = `kezek-rls-hygiene-${randomUUID()}`;
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

const USER_A = '00000000-0000-4000-8000-00000000000a';
const USER_B = '00000000-0000-4000-8000-00000000000b';
const BIZ = '00000000-0000-4000-8000-0000000000f1';
const as = (user, statement) => sql(`begin; set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"${user}","role":"authenticated"}', true);
${statement}; rollback;`);

// Supabase's auth helpers read the request's JWT claims; anon/authenticated/service_role as on the platform.
const fixture = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claims', true)::jsonb ->> 'role' $$;
create function auth.jwt() returns jsonb language sql stable as $$ select current_setting('request.jwt.claims', true)::jsonb $$;
grant usage on schema auth, public to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;

create table public.businesses (id uuid primary key, owner_id uuid, name text);
create table public.user_roles (user_id uuid, biz_id uuid, role text);
create table public.notes (id bigint generated always as identity primary key, owner_id uuid not null, biz_id uuid, body text);
create table public.analytics_events (id serial primary key);
create table public.staff_shift_aggregates (id serial primary key);
create table public.telegram_auth_audit_log (id serial primary key);
create table public.frontend_metrics (id serial primary key);
create table public.super_admins_legacy (user_id uuid);
create table public.user_global_roles (user_id uuid);
do $$ declare t text; begin
    foreach t in array array['businesses','user_roles','notes','analytics_events','staff_shift_aggregates','telegram_auth_audit_log','frontend_metrics','super_admins_legacy','user_global_roles'] loop
        execute format('alter table public.%I enable row level security', t);
    end loop;
end $$;
grant select, insert, update on public.notes, public.businesses to authenticated;
grant select on public.user_roles to authenticated;

-- Live policies, unwrapped: a column test, a subquery, auth.jwt(), auth.role(), USING + WITH CHECK.
create policy notes_own on public.notes for select to authenticated using (owner_id = auth.uid());
create policy notes_team on public.notes for select to authenticated
    using (biz_id in (select ur.biz_id from public.user_roles ur where ur.user_id = auth.uid()));
create policy notes_write on public.notes for insert to authenticated with check (owner_id = auth.uid() and (auth.jwt() ->> 'role') = 'authenticated');
create policy notes_edit on public.notes for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy businesses_owner on public.businesses for select to authenticated using (owner_id = auth.uid() or auth.role() = 'service_role');
create policy already_wrapped on public.user_roles for select to authenticated using (user_id = (select auth.uid()));

-- The thirteen dead policies the migration drops.
create policy "Analytics events select all for service_role" on public.analytics_events for select to service_role using (true);
create policy "Staff shift aggregates service_role all" on public.staff_shift_aggregates for all to service_role using (true) with check (true);
create policy "Telegram auth audit insert service role" on public.telegram_auth_audit_log for insert to service_role with check (true);
create policy "Telegram auth audit select service role" on public.telegram_auth_audit_log for select to service_role using (true);
create policy businesses_srv_cascade_upd on public.businesses for update using (auth.role() = 'service_role') with check (true);
create policy srv_upd_businesses on public.businesses for update using (auth.role() = 'service_role') with check (true);
create policy "Allow insert access to frontend metrics" on public.frontend_metrics for insert with check (true);
create policy srv_del_super_admins_legacy on public.super_admins_legacy for delete using (auth.role() = 'service_role');
create policy super_admins_legacy_srv_cascade_del on public.super_admins_legacy for delete using (auth.role() = 'service_role');
create policy srv_del_user_global_roles on public.user_global_roles for delete using (auth.role() = 'service_role');
create policy user_global_roles_srv_cascade_del on public.user_global_roles for delete using (auth.role() = 'service_role');
create policy srv_del_user_roles on public.user_roles for delete using (auth.role() = 'service_role');
create policy user_roles_srv_cascade_del on public.user_roles for delete using (auth.role() = 'service_role');

insert into public.user_roles values ('${USER_B}', '${BIZ}', 'staff'), ('${USER_A}', '${BIZ}', 'owner');
insert into public.businesses values ('${BIZ}', '${USER_A}', 'Fixture');
insert into public.notes(owner_id, biz_id, body) select case when g % 3 = 0 then '${USER_A}'::uuid else gen_random_uuid() end,
    case when g % 5 = 0 then '${BIZ}'::uuid end, 'n' || g from generate_series(1, 300) g;
`;

// Every decision the policies make, for both users.
async function decisions() {
    const result = {};
    for (const [name, user] of [['a', USER_A], ['b', USER_B]]) {
        result[`${name}:notes`] = await as(user, 'select count(*) from public.notes');
        result[`${name}:businesses`] = await as(user, 'select count(*) from public.businesses');
        result[`${name}:user_roles`] = await as(user, 'select count(*) from public.user_roles');
        result[`${name}:insert own`] = await as(user, `insert into public.notes(owner_id, body) values ('${user}', 'x') returning 'ok'`).catch((e) => /row-level security/.test(e.message) ? 'denied' : Promise.reject(e));
        result[`${name}:insert other`] = await as(user, `insert into public.notes(owner_id, body) values ('${USER_A === user ? USER_B : USER_A}', 'x') returning 'ok'`).catch((e) => /row-level security/.test(e.message) ? 'denied' : Promise.reject(e));
        result[`${name}:update`] = await as(user, `with u as (update public.notes set body = 'y' where body like 'n%' returning 1) select count(*) from u`);
    }
    return result;
}
const policyText = `select string_agg(c.relname || '.' || pol.polname || ': ' || coalesce(pg_get_expr(pol.polqual, pol.polrelid), '-') || ' / '
    || coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '-'), E'\\n' order by c.relname, pol.polname)
    from pg_policy pol join pg_class c on c.oid = pol.polrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public'`;
const unwrapped = `select count(*) from pg_policy pol join pg_class c on c.oid = pol.polrelid join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and (coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') || ' ' || coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), ''))
    ~ '(?<!SELECT )auth\\.(uid|jwt|role)\\(\\)'`;

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

        const before = await decisions();
        assert.equal(await sql(unwrapped), '13', 'DB-09: five live and eight dead policies call auth.*() per row');
        assert.equal(await sql('select count(*) from pg_policy'), '19');
        const planBefore = await as(USER_A, 'explain (costs off) select * from public.businesses');
        assert.doesNotMatch(planBefore, /InitPlan/, 'unwrapped calls are evaluated per row');

        await sql(migration);

        // Same decisions for every user and command; calls now evaluated once per statement.
        assert.deepEqual(await decisions(), before);
        assert.equal(await sql(unwrapped), '0');
        assert.match(await as(USER_A, 'explain (costs off) select * from public.businesses'), /InitPlan/);
        assert.match(await sql(`select pg_get_expr(polqual, polrelid) from pg_policy where polname = 'notes_team'`), /\( SELECT auth\.uid\(\) AS uid\)/);
        assert.equal(await sql(`select pg_get_expr(polwithcheck, polrelid) from pg_policy where polname = 'notes_write'`),
            "((owner_id = ( SELECT auth.uid() AS uid)) AND ((( SELECT auth.jwt() AS jwt) ->> 'role'::text) = 'authenticated'::text))");

        // The dead policies are gone; the live ones stay.
        assert.equal(await sql('select count(*) from pg_policy'), '6');
        assert.equal(await sql(`select string_agg(polname, ',' order by polname) from pg_policy`),
            'already_wrapped,businesses_owner,notes_edit,notes_own,notes_team,notes_write');

        // Re-running changes nothing.
        const once = await sql(policyText);
        await sql(migration);
        assert.equal(await sql(policyText), once);

        await assertLiveFunctions(sql, { suite: 'test-rls-policy-hygiene-isolated.cjs' });
        console.log('RLS policy hygiene (DB-09): same decisions for every user, auth calls in InitPlans, dead policies dropped, re-run is a no-op.');
    } finally {
        if (created) await docker(['rm', '-f', container]).catch(() => {});
    }
})().catch((error) => {
    console.error(error);
    process.exit(1);
});

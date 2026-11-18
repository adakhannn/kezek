// Integration fixture for 20261119080000_inactive_rows_visibility (DB-09, part 2). A disposable
// PostgreSQL with the production read policies of branches, staff and bookings shows that before the
// migration anyone, anon included, read archived branches and dismissed masters of an approved
// business; that afterwards only the active rows stay public, while a client still sees the branch
// and master of their own bookings (the cabinet history embeds) and members of the business see all
// of its rows; that the new policies do not recurse through the bookings policies; and that a re-run
// changes nothing.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { POSTGRES_IMAGE } = require('./lib/isolated-postgres.cjs');
const { SUPABASE_DEFAULT_PRIVILEGES, assertLiveFunctions } = require('./lib/live-schema.cjs');

const migration = fs.readFileSync(
    path.join(__dirname, '..', 'supabase', 'migrations', '20261119080000_inactive_rows_visibility.sql'),
    'utf8',
).replace(/\r/g, '');

const container = `kezek-inactive-rows-${randomUUID()}`;
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

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const OWNER = id(1); const MEMBER = id(2); const CLIENT = id(3); const STRANGER = id(4); const MASTER_USER = id(5);
const BIZ = id(10); const ACTIVE_BRANCH = id(20); const ARCHIVED_BRANCH = id(21);
const ACTIVE_MASTER = id(30); const DISMISSED_MASTER = id(31);

const as = (user, statement) => (user
    ? sql(`begin; set local role authenticated;
do $claims$ begin perform set_config('request.jwt.claims', '{"sub":"${user}","role":"authenticated"}', true); end $claims$;
${statement}; rollback;`)
    : sql(`begin; set local role anon; do $claims$ begin perform set_config('request.jwt.claims', '{"role":"anon"}', true); end $claims$; ${statement}; rollback;`));

// Production read policies (after 20261119040000) of the three tables, and their data shape.
const fixture = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
${SUPABASE_DEFAULT_PRIVILEGES}
create schema auth;
create schema private;
revoke all on schema private from public;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid $$;
grant usage on schema auth, public to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
create function public.is_super_admin() returns boolean language sql stable security definer set search_path = pg_catalog, public as $$ select false $$;

create table public.roles (id uuid primary key, key text not null);
create table public.user_roles (user_id uuid not null, biz_id uuid, role_id uuid not null references public.roles(id));
create table public.businesses (id uuid primary key, is_approved boolean not null default false, owner_id uuid);
create table public.branches (id uuid primary key, biz_id uuid not null references public.businesses(id), name text not null, is_active boolean not null default true);
create table public.staff (id uuid primary key, biz_id uuid not null references public.businesses(id), user_id uuid, full_name text not null, is_active boolean not null default true);
create table public.bookings (id uuid primary key default gen_random_uuid(), biz_id uuid not null, branch_id uuid not null references public.branches(id),
    staff_id uuid not null references public.staff(id), client_id uuid);
alter table public.roles enable row level security;
alter table public.user_roles enable row level security;
alter table public.businesses enable row level security;
alter table public.branches enable row level security;
alter table public.staff enable row level security;
alter table public.bookings enable row level security;
grant select on public.roles, public.user_roles, public.businesses, public.branches, public.staff, public.bookings to anon, authenticated;

create policy roles_read on public.roles for select using (true);
create policy user_roles_own on public.user_roles for select to authenticated using (user_id = (select auth.uid()));
create policy businesses_read on public.businesses for select using (is_approved or owner_id = (select auth.uid()));

create policy "Business owners can view own branches" on public.branches for select to authenticated
    using ((biz_id in (select ur.biz_id from user_roles ur join roles r on ur.role_id = r.id
        where ur.user_id = (select auth.uid()) and r.key = any (array['owner', 'admin', 'manager']))) or is_super_admin());
create policy "Public can view active branches" on public.branches for select to anon, authenticated
    using (is_active = true and biz_id in (select businesses.id from businesses where businesses.is_approved = true));
create policy "read branches of approved business" on public.branches for select
    using (exists (select 1 from businesses b where b.id = branches.biz_id and b.is_approved = true));

create policy "Business owners can view own staff" on public.staff for select to authenticated
    using ((biz_id in (select ur.biz_id from user_roles ur join roles r on ur.role_id = r.id
        where ur.user_id = (select auth.uid()) and r.key = any (array['owner', 'admin', 'manager']))) or is_super_admin());
create policy "Public can view active staff" on public.staff for select to anon, authenticated
    using (is_active = true and biz_id in (select businesses.id from businesses where businesses.is_approved = true));
create policy "Staff can view own profile" on public.staff for select to authenticated using (user_id = (select auth.uid()));
create policy "read staff of approved business" on public.staff for select
    using ((exists (select 1 from businesses b where b.id = staff.biz_id and b.is_approved = true))
        or (exists (select 1 from user_roles ur where ur.user_id = (select auth.uid()) and ur.biz_id = staff.biz_id)));

-- Bookings policies read staff, as in production: a staff policy that read bookings directly would recurse.
create policy bookings_select_client on public.bookings for select to authenticated using (client_id = (select auth.uid()));
create policy "Staff can view own bookings" on public.bookings for select to authenticated
    using (staff_id in (select s.id from staff s where s.user_id = (select auth.uid())));

insert into public.roles values ('${id(90)}', 'owner'), ('${id(91)}', 'staff');
insert into public.businesses values ('${BIZ}', true, '${OWNER}');
-- The owner is known only by businesses.owner_id, as for some production owners.
insert into public.user_roles values ('${MEMBER}', '${BIZ}', '${id(91)}');
insert into public.branches values ('${ACTIVE_BRANCH}', '${BIZ}', 'Center', true), ('${ARCHIVED_BRANCH}', '${BIZ}', 'Old street', false);
insert into public.staff values ('${ACTIVE_MASTER}', '${BIZ}', null, 'Active master', true),
    ('${DISMISSED_MASTER}', '${BIZ}', '${MASTER_USER}', 'Dismissed master', false);
insert into public.bookings(biz_id, branch_id, staff_id, client_id) values ('${BIZ}', '${ARCHIVED_BRANCH}', '${DISMISSED_MASTER}', '${CLIENT}');
`;

const visible = async (user) => ({
    branches: await as(user, 'select coalesce(string_agg(name, \',\' order by name), \'-\') from public.branches'),
    staff: await as(user, 'select coalesce(string_agg(full_name, \',\' order by full_name), \'-\') from public.staff'),
});
// What the cabinet history renders: the booking with its master and branch embedded.
const history = (user) => as(user, `select coalesce(st.full_name, 'NULL') || ' @ ' || coalesce(br.name, 'NULL')
    from public.bookings b left join public.staff st on st.id = b.staff_id left join public.branches br on br.id = b.branch_id`);

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

        // Before: the archived branch and the dismissed master are public.
        assert.deepEqual(await visible(null), { branches: 'Center,Old street', staff: 'Active master,Dismissed master' }, 'DB-09: anon reads archived rows');
        assert.deepEqual(await visible(STRANGER), { branches: 'Center,Old street', staff: 'Active master,Dismissed master' });
        assert.equal(await history(CLIENT), 'Dismissed master @ Old street');

        await sql(migration);

        // After: only active rows are public.
        assert.deepEqual(await visible(null), { branches: 'Center', staff: 'Active master' });
        assert.deepEqual(await visible(STRANGER), { branches: 'Center', staff: 'Active master' });
        // The client keeps the branch and master of their own booking, so the history still renders.
        assert.deepEqual(await visible(CLIENT), { branches: 'Center,Old street', staff: 'Active master,Dismissed master' });
        assert.equal(await history(CLIENT), 'Dismissed master @ Old street');
        assert.equal(await history(STRANGER), '');
        // Members of the business, the owner, and the dismissed master's own account.
        assert.deepEqual(await visible(MEMBER), { branches: 'Center,Old street', staff: 'Active master,Dismissed master' });
        assert.deepEqual(await visible(OWNER), { branches: 'Center,Old street', staff: 'Active master,Dismissed master' });
        assert.equal((await visible(MASTER_USER)).staff, 'Active master,Dismissed master');
        assert.equal((await visible(MASTER_USER)).branches, 'Center,Old street');
        // A staff session reading bookings (bookings policy -> staff policy -> helper) does not recurse.
        assert.equal(await as(MASTER_USER, 'select count(*) from public.bookings'), '1');

        // The helpers run for authenticated sessions only.
        assert.equal(await sql(`select has_function_privilege('anon', 'private.viewer_booked_staff(uuid)', 'execute')::text
            || has_function_privilege('authenticated', 'private.viewer_booked_staff(uuid)', 'execute')::text
            || has_function_privilege('anon', 'private.viewer_booked_branch(uuid)', 'execute')::text`), 'falsetruefalse');
        // Sessions reach them only through the policies: schema private is not theirs to call into.
        await assert.rejects(as(STRANGER, `select private.viewer_booked_staff('${DISMISSED_MASTER}')`), /permission denied for schema private/);

        // Re-running changes nothing.
        const policies = `select string_agg(c.relname || '.' || polname, ',' order by c.relname, polname) from pg_policy p join pg_class c on c.oid = p.polrelid`;
        const once = await sql(policies);
        await sql(migration);
        assert.equal(await sql(policies), once);
        assert.doesNotMatch(once, /read (branches|staff) of approved business/);

        await assertLiveFunctions(sql, {
            suite: 'test-inactive-rows-visibility-isolated.cjs',
            stubs: { 'public.is_super_admin()': { reason: 'the platform admin stores are not modelled: nobody here is a super admin', skip: ['body'] } },
        });
        console.log('Inactive rows visibility (DB-09): archived branches and dismissed masters no longer public; own-booking history and members keep them; no policy recursion.');
    } finally {
        if (created) await docker(['rm', '-f', container]).catch(() => {});
    }
})().catch((error) => {
    console.error(error);
    process.exit(1);
});

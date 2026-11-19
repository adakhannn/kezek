// Integration fixture for 20261119140000_one_super_admin_rule (DB-10). A disposable PostgreSQL holds
// the three stores of the platform role as production has them, with is_super_admin() and the old
// last-super-admin guard of the prod baseline. It shows that the old guard left a super admin of
// user_global_roles unprotected, applies the real migration and checks that the shared rule agrees
// with is_super_admin() for every store and that the guard protects every store.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { POSTGRES_IMAGE } = require('./lib/isolated-postgres.cjs');
const { assertLiveFunctions, installLiveFunction, SUPABASE_DEFAULT_PRIVILEGES } = require('./lib/live-schema.cjs');

const migrations = path.join(__dirname, '..', 'supabase', 'migrations');
const read = (file) => fs.readFileSync(path.join(migrations, file), 'utf8').replace(/\r/g, '');
const baseline = read('20261009110000_prod_baseline.sql');
function baselineFunction(name) {
    const marker = `CREATE OR REPLACE FUNCTION "public"."${name}"(`;
    const from = baseline.indexOf(marker);
    assert.ok(from >= 0 && baseline.indexOf(marker, from + 1) < 0, `${name}: expected one definition in the prod baseline`);
    const to = baseline.indexOf(`\nALTER FUNCTION "public"."${name}"(`, from);
    return baseline.slice(from, to);
}

const container = `kezek-super-admin-${randomUUID()}`;
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
const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const [superRole, managerRole] = [id(1), id(2)];
const [alice, bob, carol, dave] = [id(11), id(12), id(13), id(14)];
const biz = id(21);
const asUser = (user, body) => sql(`set role authenticated; select set_config('request.jwt.claims', '{"sub":"${user}","role":"authenticated"}', false); ${body}`);
const isSuper = async (user) => (await asUser(user, 'select public.is_super_admin()')).split('\n').pop();
const shared = async () => sql(`set role service_role; select array_to_string(public.super_admin_user_ids(), ',')`);
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

        // The three stores with the keys and delete rules of the prod baseline.
        await sql(`create role anon; create role authenticated; create role service_role bypassrls;
            ${SUPABASE_DEFAULT_PRIVILEGES}
            create schema auth; create schema private;
            grant usage on schema auth, public to anon, authenticated, service_role;
            create table auth.users(id uuid primary key);
            create function auth.uid() returns uuid language sql stable as $$
                select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid $$;
            grant execute on function auth.uid() to anon, authenticated, service_role;
            create table public.roles(id uuid primary key, key text not null unique, scope text not null);
            create table public.user_roles(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
                biz_id uuid, role_id uuid not null references public.roles);
            create table public.user_global_roles(user_id uuid not null references auth.users on delete cascade,
                role_id uuid not null references public.roles on delete cascade, created_at timestamptz default now(), primary key (user_id, role_id));
            create table public.super_admins_legacy(user_id uuid primary key references auth.users on delete cascade);
            grant all on all tables in schema public to service_role;
            insert into auth.users values ('${alice}'), ('${bob}'), ('${carol}'), ('${dave}');
            insert into public.roles values ('${superRole}', 'super_admin', 'platform'), ('${managerRole}', 'manager', 'business');
            ${baselineFunction('guard_last_super_admin')}
            create trigger trg_guard_last_super_admin before delete on public.user_roles
                for each row execute function public.guard_last_super_admin();`);
        await installLiveFunction(sql, 'public.is_super_admin()');

        // Before: the old guard watched user_roles only. Bob, the only super admin, recorded in
        // user_global_roles, could be removed and nobody kept the role.
        await sql(`insert into public.user_global_roles(user_id, role_id) values ('${bob}', '${superRole}')`);
        assert.equal(await isSuper(bob), 't');
        await sql(`delete from public.user_global_roles where user_id = '${bob}'`);
        assert.equal(await isSuper(bob), 'f');

        await sql(read('20261119140000_one_super_admin_rule.sql'));
        assert.equal(await sql(`select to_regprocedure('public.guard_last_super_admin()') is null`), 't');

        // Without any super admin, ordinary role changes are not blocked (a fresh database).
        await sql(`insert into public.user_roles(user_id, biz_id, role_id) values ('${dave}', '${biz}', '${managerRole}');
            delete from public.user_roles where user_id = '${dave}';`);

        // One record per store: Alice in user_roles, Bob in user_global_roles, Carol in the legacy list,
        // and Dave with a business-scoped super_admin row, which is not the platform role.
        await sql(`insert into public.user_roles(user_id, biz_id, role_id) values ('${alice}', null, '${superRole}'), ('${dave}', '${biz}', '${superRole}');
            insert into public.user_global_roles(user_id, role_id) values ('${bob}', '${superRole}');
            insert into public.super_admins_legacy values ('${carol}');`);
        for (const [user, expected] of [[alice, 't'], [bob, 't'], [carol, 't'], [dave, 'f']]) {
            assert.equal(await isSuper(user), expected, `is_super_admin for ${user}`);
        }
        assert.equal(await shared(), [alice, bob, carol].join(','));

        // A multi-row change that would leave nobody is refused whole.
        await sql(`insert into public.user_roles(user_id, biz_id, role_id) values ('${bob}', null, '${superRole}')`);
        await sql(`delete from public.user_global_roles; delete from public.super_admins_legacy;`);
        await assert.rejects(sql(`delete from public.user_roles where role_id = '${superRole}' and biz_id is null`), /Нельзя удалить последнего super_admin/);
        assert.equal(await shared(), [alice, bob].join(','));

        // An account that keeps the role in another store may drop one record; the last record of the
        // last super admin may not go, by delete, by update or by deleting the account.
        await sql(`delete from public.user_roles where user_id = '${alice}' and role_id = '${superRole}';
            insert into public.user_global_roles(user_id, role_id) values ('${bob}', '${superRole}');
            delete from public.user_roles where user_id = '${bob}' and role_id = '${superRole}';`);
        assert.equal(await shared(), bob);
        await assert.rejects(sql(`delete from public.user_global_roles where user_id = '${bob}'`), /Нельзя удалить последнего super_admin/);
        await assert.rejects(sql(`update public.user_global_roles set role_id = '${managerRole}' where user_id = '${bob}'`), /Нельзя удалить последнего super_admin/);
        await assert.rejects(sql(`delete from auth.users where id = '${bob}'`), /Нельзя удалить последнего super_admin/);
        await sql(`insert into public.super_admins_legacy values ('${carol}'); delete from public.user_global_roles where user_id = '${bob}';`);
        await assert.rejects(sql(`update public.super_admins_legacy set user_id = '${dave}'`), /Нельзя удалить последнего super_admin/);
        // A business-scoped row never counts and is never guarded.
        await sql(`delete from public.user_roles where user_id = '${dave}'`);
        assert.equal(await shared(), carol);

        // The shared list is for the server only.
        for (const role of ['anon', 'authenticated']) {
            assert.equal(await sql(`select has_function_privilege('${role}', 'public.super_admin_user_ids()', 'EXECUTE')`), 'f', role);
            assert.equal(await sql(`select has_function_privilege('${role}', 'private.super_admin_ids()', 'EXECUTE')`), 'f', role);
        }
        assert.equal(await sql(`select has_function_privilege('service_role', 'public.super_admin_user_ids()', 'EXECUTE')`), 't');

        await assertLiveFunctions(sql, { suite: 'test-one-super-admin-rule-isolated.cjs' });
        console.log('one super admin rule: ok');
    } finally {
        if (created) await docker(['rm', '--force', container]).catch(() => undefined);
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

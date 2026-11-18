// Integration fixture for 20261118180000_admin_user_directory. A disposable PostgreSQL with
// auth.users, profiles, suspensions and the production platform-admin predicate shows what the
// old page-local search could not do (find a user beyond the first page, count matches), then
// checks the search rules, paging, the status filter, the counts and who may call the functions.
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

const container = `kezek-admin-users-${randomUUID()}`;
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
const json = async (input) => JSON.parse(await sql(input));

const admin = randomUUID();
const plain = randomUUID();
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
            create table auth.users(id uuid primary key, email varchar(255), phone text, last_sign_in_at timestamptz,
                created_at timestamptz, deleted_at timestamptz, raw_user_meta_data jsonb default '{}');
            create table public.profiles(id uuid primary key, full_name text);
            create table public.user_suspensions(user_id uuid not null, reason text, created_at timestamptz default now() not null, created_by uuid);
            create table public.roles(id uuid primary key, key text, scope text);
            create table public.user_global_roles(user_id uuid, role_id uuid);
            create table public.super_admins_legacy(user_id uuid);
            create table public.user_roles(user_id uuid, role_id uuid, biz_id uuid);
            grant usage on schema public to anon, authenticated, service_role;
            insert into public.roles values ('00000000-0000-0000-0000-000000000001', 'super_admin', 'platform');
            -- 75 users, newest first: u-0 is the newest, u-74 the oldest
            insert into auth.users(id, email, phone, created_at, raw_user_meta_data)
                select gen_random_uuid(), 'user' || n || '@example.com', '99655500' || lpad(n::text, 4, '0'),
                       timestamptz '2026-11-01' - n * interval '1 hour', '{}'
                  from generate_series(0, 74) n;
            update auth.users set email = 'aigerim.old@example.com', raw_user_meta_data = '{"full_name":"Айгерим Старая"}' where email = 'user74@example.com';
            insert into public.profiles select id, 'Профиль 50%' from auth.users where email = 'user60@example.com';
            insert into public.profiles select id, 'name_with_underscore' from auth.users where email = 'user61@example.com';
            insert into public.user_suspensions(user_id, reason) select id, 'spam' from auth.users where email in ('user1@example.com', 'user2@example.com');
            insert into auth.users(id, email, created_at, deleted_at) values (gen_random_uuid(), 'deleted@example.com', now(), now());
            insert into auth.users(id, email, created_at) values ('${admin}', 'root@example.com', timestamptz '2020-01-01'), ('${plain}', 'plain@example.com', timestamptz '2020-01-02');
            insert into public.user_global_roles values ('${admin}', '00000000-0000-0000-0000-000000000001');`);
        await sql(extract('20261110131000_shift_hours_adjustment.sql', 'create or replace function public.finance_is_platform_admin', '\n$$;'));
        await sql(read('20261118180000_admin_user_directory.sql'));

        const page = (args) => json(`set role service_role; select public.admin_list_users('${admin}', ${args})::text`);

        // The whole directory is searched: the oldest user is found from page 1, with the real total.
        const old = await page(`'айгерим', 'all', 50, 0`);
        assert.equal(old.total, 1);
        assert.equal(old.items[0].email, 'aigerim.old@example.com');
        assert.equal(old.items[0].full_name, 'Айгерим Старая');

        // Paging: 77 live users (75 + root + plain), newest first, disjoint pages.
        const first = await page(`null, 'all', 50, 0`);
        const second = await page(`null, 'all', 50, 50`);
        assert.equal(first.total, 77);
        assert.equal(first.items.length, 50);
        assert.equal(second.items.length, 27);
        assert.equal(first.items[0].email, 'user0@example.com');
        assert.equal(new Set([...first.items, ...second.items].map((item) => item.id)).size, 77);
        assert.ok(![...first.items, ...second.items].some((item) => item.email === 'deleted@example.com'));

        // Status filter and block reason.
        const blocked = await page(`null, 'blocked', 50, 0`);
        assert.equal(blocked.total, 2);
        assert.deepEqual(blocked.items.map((item) => item.block_reason), ['spam', 'spam']);
        assert.equal((await page(`null, 'active', 200, 0`)).total, 75);
        await assert.rejects(page(`null, 'bogus', 50, 0`), /ADMIN_USERS_BAD_STATUS/);

        // Search: profile name first, LIKE characters literal, phone digits, id, limit clamp.
        assert.deepEqual((await page(`'50%', 'all', 50, 0`)).items.map((item) => item.full_name), ['Профиль 50%']);
        assert.deepEqual((await page(`'_with_', 'all', 50, 0`)).items.map((item) => item.full_name), ['name_with_underscore']);
        assert.equal((await page(`'%', 'all', 50, 0`)).total, 1);
        assert.equal((await page(`'000007', 'all', 50, 0`)).items[0].phone, '996555000007');
        const id = first.items[3].id;
        assert.equal((await page(`'${id.slice(0, 13)}', 'all', 50, 0`)).items[0].id, id);
        assert.equal((await page(`null, 'all', 1000, -5`)).items.length, 77);

        // Counts.
        assert.deepEqual(await json(`set role service_role; select public.admin_user_stats('${admin}')::text`), { total: 77, active: 75, blocked: 2, super: 1 });

        // Access: service role with a platform administrator as actor only.
        await assert.rejects(json(`set role service_role; select public.admin_list_users('${plain}')::text`), /ADMIN_USERS_FORBIDDEN/);
        await assert.rejects(json(`set role service_role; select public.admin_user_stats(null)::text`), /ADMIN_USERS_FORBIDDEN/);
        for (const role of ['authenticated', 'anon']) {
            await assert.rejects(sql(`set role ${role}; select public.admin_list_users('${admin}')`), /permission denied for function/);
            await assert.rejects(sql(`set role ${role}; select public.admin_user_stats('${admin}')`), /permission denied for function/);
        }

        console.log('admin user directory: ok');
    } finally {
        if (created) await docker(['rm', '--force', container]).catch(() => undefined);
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

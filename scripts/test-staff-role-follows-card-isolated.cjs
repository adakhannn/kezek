// Integration fixture for 20261119090000_staff_role_follows_card (ARCH-10). A disposable PostgreSQL
// with the production user_roles guards shows that the 'staff' role now follows the staff card:
// existing linked active cards get their missing role, linking, activating or moving a card grants
// it, unrelated edits and unlinking leave roles alone, a suspended account gets no role while its
// card is still saved, and a re-run changes nothing.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { POSTGRES_IMAGE } = require('./lib/isolated-postgres.cjs');
const { assertLiveFunctions, installLiveFunction } = require('./lib/live-schema.cjs');

const migration = fs.readFileSync(
    path.join(__dirname, '..', 'supabase', 'migrations', '20261119090000_staff_role_follows_card.sql'),
    'utf8',
).replace(/\r/g, '');

const container = `kezek-staff-role-${randomUUID()}`;
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
const BIZ = id(10); const OTHER_BIZ = id(11);
const EARLY = id(1); const LINKED = id(2); const LATER = id(3); const SUSPENDED = id(4);

// The production shape of the tables the trigger and the user_roles guards touch.
const fixture = `
create schema auth;
create schema private;
create table auth.users (id uuid primary key);
create table public.roles (id uuid primary key, key text not null unique);
create table public.businesses (id uuid primary key);
create table public.user_suspensions (user_id uuid primary key);
create table public.user_lifecycle_commands (user_id uuid not null, completed boolean not null default false);
create table public.user_roles (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    role_id uuid not null references public.roles(id),
    biz_id uuid references public.businesses(id) on delete cascade,
    biz_key uuid generated always as (coalesce(biz_id, '00000000-0000-0000-0000-000000000000'::uuid)) stored,
    constraint user_roles_unique_all unique (user_id, role_id, biz_key));
create table public.staff (id uuid primary key default gen_random_uuid(), biz_id uuid not null references public.businesses(id),
    user_id uuid, full_name text not null, is_active boolean not null default true);

insert into auth.users values ('${EARLY}'), ('${LINKED}'), ('${LATER}'), ('${SUSPENDED}');
insert into public.roles values ('${id(90)}', 'staff'), ('${id(91)}', 'owner');
insert into public.businesses values ('${BIZ}'), ('${OTHER_BIZ}');
insert into public.user_suspensions values ('${SUSPENDED}');
-- A card linked before the migration: the application used to add its role on first use.
insert into public.staff (biz_id, user_id, full_name) values ('${BIZ}', '${EARLY}', 'Early master');
`;
const guards = `
create trigger trg_prevent_roles_for_suspended before insert or update on public.user_roles
    for each row execute function public.prevent_roles_for_suspended();
create trigger kezek_lifecycle_assignment before insert or update on public.user_roles
    for each row execute function public.guard_user_lifecycle_assignment();
`;
const roles = () => sql(`select coalesce(string_agg(right(user_id::text, 2) || '@' || right(biz_id::text, 2), ',' order by user_id, biz_id), '-')
    from public.user_roles ur join public.roles r on r.id = ur.role_id where r.key = 'staff'`);

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
        await installLiveFunction(sql, 'public.prevent_roles_for_suspended()');
        await installLiveFunction(sql, 'public.guard_user_lifecycle_assignment()');
        await sql(guards);

        // Before: a linked active card has no role until the application adds it.
        assert.equal(await roles(), '-', 'ARCH-10: the role depended on the first staff request');

        await sql(migration);
        assert.equal(await roles(), '01@10', 'the existing card got its role');

        // Linking a new card grants the role; an unrelated edit neither duplicates nor fails.
        await sql(`insert into public.staff (biz_id, user_id, full_name) values ('${BIZ}', '${LINKED}', 'Linked master')`);
        await sql(`update public.staff set full_name = 'Renamed master' where user_id = '${LINKED}'`);
        assert.equal(await roles(), '01@10,02@10');

        // An inactive card grants nothing until it is activated; linking a card later grants it too.
        await sql(`insert into public.staff (biz_id, user_id, full_name, is_active) values ('${BIZ}', '${LATER}', 'Later master', false)`);
        assert.equal(await roles(), '01@10,02@10');
        await sql(`update public.staff set is_active = true where user_id = '${LATER}'`);
        assert.equal(await roles(), '01@10,02@10,03@10');

        // Moving a card to another business grants the role there.
        await sql(`update public.staff set biz_id = '${OTHER_BIZ}' where user_id = '${LINKED}'`);
        assert.equal(await roles(), '01@10,02@10,02@11,03@10');

        // A suspended account gets no role, and its card is still saved.
        await sql(`insert into public.staff (biz_id, user_id, full_name) values ('${BIZ}', '${SUSPENDED}', 'Suspended master')`);
        assert.equal(await sql(`select count(*) from public.staff where user_id = '${SUSPENDED}'`), '1');
        assert.equal(await roles(), '01@10,02@10,02@11,03@10');

        // Unlinking a card leaves the role, as before.
        await sql(`update public.staff set user_id = null where user_id = '${EARLY}'`);
        assert.equal(await roles(), '01@10,02@10,02@11,03@10');

        // Re-running changes nothing.
        await sql(migration);
        assert.equal(await roles(), '01@10,02@10,02@11,03@10');
        assert.equal(await sql(`select count(*) from pg_trigger where tgname = 'staff_ensure_staff_role'`), '1');

        await assertLiveFunctions(sql, { suite: 'test-staff-role-follows-card-isolated.cjs' });
        console.log('Staff role follows the card (ARCH-10): backfill, link, activate and move grant it; suspended accounts get none; re-run is a no-op.');
    } finally {
        if (created) await docker(['rm', '-f', container]).catch(() => {});
    }
})().catch((error) => {
    console.error(error);
    process.exit(1);
});

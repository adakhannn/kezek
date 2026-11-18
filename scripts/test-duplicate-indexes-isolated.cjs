// Integration fixture for 20261118140000_drop_duplicate_indexes. A disposable PostgreSQL gets the
// production index pairs, the real migration drops one of each, the identical twin stays, the
// uniqueness rules keep holding and ON CONFLICT still infers its index.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { POSTGRES_IMAGE } = require('./lib/isolated-postgres.cjs');
const { assertLiveFunctions } = require('./lib/live-schema.cjs');

const container = `kezek-dup-indexes-${randomUUID()}`;
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

        await sql(`create table public.bookings(id uuid primary key default gen_random_uuid(), staff_id uuid, start_at timestamptz);
            create index bookings_staff_id_start_at_idx on public.bookings(staff_id, start_at);
            create index idx_bookings_staff_start on public.bookings(staff_id, start_at);
            create table public.staff_shifts(id uuid primary key default gen_random_uuid(), staff_id uuid, shift_date date);
            create index staff_shifts_staff_id_shift_date_idx on public.staff_shifts(staff_id, shift_date);
            create index staff_shifts_staff_date_idx on public.staff_shifts(staff_id, shift_date);
            create table public.user_roles(id uuid primary key default gen_random_uuid(), user_id uuid not null, biz_id uuid, role_id uuid not null);
            create unique index user_roles_uniq on public.user_roles(user_id, role_id, biz_id);
            create unique index user_roles_unique_triplet on public.user_roles(user_id, role_id, biz_id);
            create unique index user_roles_uq_triplet_scoped on public.user_roles(user_id, biz_id, role_id) where biz_id is not null;
            create unique index ux_user_roles_business on public.user_roles(user_id, biz_id, role_id) where biz_id is not null;`);

        await sql(fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '20261118140000_drop_duplicate_indexes.sql'), 'utf8'));

        assert.equal(await sql(`select string_agg(indexname, ',' order by indexname collate "C") from pg_indexes
            where schemaname = 'public' and indexname not like '%_pkey'`),
        'bookings_staff_id_start_at_idx,staff_shifts_staff_id_shift_date_idx,user_roles_uniq,user_roles_uq_triplet_scoped');

        // The rules the kept indexes enforce still hold, and ON CONFLICT still finds its index.
        const user = randomUUID();
        const role = randomUUID();
        const biz = randomUUID();
        await sql(`insert into public.user_roles(user_id, role_id, biz_id) values ('${user}', '${role}', '${biz}')`);
        await assert.rejects(sql(`insert into public.user_roles(user_id, role_id, biz_id) values ('${user}', '${role}', '${biz}')`), /duplicate key/);
        assert.equal(await sql(`insert into public.user_roles(user_id, role_id, biz_id) values ('${user}', '${role}', '${biz}')
            on conflict (user_id, role_id, biz_id) do nothing returning id`), '');
        assert.equal(await sql(`insert into public.user_roles(user_id, role_id, biz_id) values ('${user}', '${role}', '${biz}')
            on conflict (user_id, biz_id, role_id) where biz_id is not null do nothing returning id`), '');

        await assertLiveFunctions(sql, { suite: 'test-duplicate-indexes-isolated.cjs' });
        console.log('duplicate indexes: ok');
    } finally {
        if (created) await docker(['rm', '--force', container]).catch(() => undefined);
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

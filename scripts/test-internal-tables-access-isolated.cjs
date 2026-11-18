// Access-control integration fixture for 20261117140000_close_client_access_to_internal_tables.
// A disposable PostgreSQL reproduces the production policies and grants (always-true policies on
// staff_shift_aggregates, whatsapp_otp_codes and super_admins_legacy), applies the real migration
// and checks each role: anon, a staff member, another account, the definer writer and service_role.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { POSTGRES_IMAGE } = require('./lib/isolated-postgres.cjs');

const container = `kezek-internal-tables-${randomUUID()}`;
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

const [staffUser, otherUser, superAdmin, staffA, staffB] = Array.from({ length: 5 }, () => randomUUID());
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
            grant usage on schema auth to anon, authenticated, service_role;
            create table public.staff(id uuid primary key, user_id uuid, is_active boolean default true);
            alter table public.staff enable row level security;
            create policy staff_read on public.staff for select using (true);
            create table public.staff_shift_aggregates(id uuid primary key default gen_random_uuid(), staff_id uuid, biz_id uuid,
                period_type text, period_value text, shifts_count integer, total_amount numeric(12,2), total_master numeric(12,2),
                total_salon numeric(12,2), total_late_minutes integer, updated_at timestamptz default now());
            alter table public.staff_shift_aggregates enable row level security;
            create policy "Staff shift aggregates all" on public.staff_shift_aggregates to authenticated, anon, service_role using (true) with check (true);
            create policy "Staff shift aggregates own all" on public.staff_shift_aggregates to authenticated
                using (exists (select 1 from public.staff s where s.id = staff_shift_aggregates.staff_id and s.user_id = auth.uid() and s.is_active = true))
                with check (exists (select 1 from public.staff s where s.id = staff_shift_aggregates.staff_id and s.user_id = auth.uid() and s.is_active = true));
            create policy "Staff shift aggregates service_role all" on public.staff_shift_aggregates to service_role using (true) with check (true);
            create function public.update_shift_aggregates(p_staff_id uuid) returns void language plpgsql security definer set search_path = public as $$
                begin update public.staff_shift_aggregates set shifts_count = shifts_count + 1 where staff_id = p_staff_id; end; $$;
            create table public.whatsapp_otp_codes(id uuid primary key default gen_random_uuid(), phone text, otp_hash text, status text);
            alter table public.whatsapp_otp_codes enable row level security;
            create policy "Allow insert for OTP codes" on public.whatsapp_otp_codes for insert with check (true);
            create table public.super_admins_legacy(user_id uuid primary key);
            alter table public.super_admins_legacy enable row level security;
            create policy "read super_admins (auth)" on public.super_admins_legacy for select to authenticated using (true);
            grant all on all tables in schema public to anon, authenticated, service_role;
            grant execute on all functions in schema public to anon, authenticated, service_role;
            insert into public.staff values ('${staffA}', '${staffUser}', true), ('${staffB}', '${otherUser}', true);
            insert into public.staff_shift_aggregates(staff_id, period_type, period_value, shifts_count, total_amount, total_master, total_salon, total_late_minutes)
                values ('${staffA}', 'day', '2026-11-17', 1, 1000, 600, 400, 0), ('${staffB}', 'day', '2026-11-17', 2, 3000, 1800, 1200, 5);
            insert into public.super_admins_legacy values ('${superAdmin}');`);

        // The fixture reproduces the exposure before the migration.
        assert.equal(await asRole('anon', staffUser, 'select count(*) from public.staff_shift_aggregates'), '2');
        assert.equal(await asRole('anon', staffUser, 'update public.staff_shift_aggregates set total_master = 0 returning staff_id').then((out) => out.split('\n').length), 2);
        await sql('update public.staff_shift_aggregates set total_master = total_amount * 0.6');
        // PostgREST inserts with return=minimal; RETURNING would also need a SELECT policy.
        await asRole('anon', staffUser, `insert into public.whatsapp_otp_codes(phone, status) values ('+996555000111', 'pending')`);
        assert.equal(await sql(`select count(*) from public.whatsapp_otp_codes where phone = '+996555000111'`), '1');
        assert.equal(await asRole('authenticated', otherUser, 'select count(*) from public.super_admins_legacy'), '1');

        await sql(fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261117140000_close_client_access_to_internal_tables.sql'), 'utf8'));

        // staff_shift_aggregates: no anonymous access, staff read only their own rows.
        await assert.rejects(asRole('anon', staffUser, 'select count(*) from public.staff_shift_aggregates'), /permission denied/);
        assert.equal(await asRole('authenticated', staffUser, 'select string_agg(total_master::text, \',\') from public.staff_shift_aggregates'), '600.00');
        assert.equal(await asRole('authenticated', otherUser, `select count(*) from public.staff_shift_aggregates where staff_id = '${staffA}'`), '0');
        await assert.rejects(asRole('authenticated', staffUser, 'update public.staff_shift_aggregates set total_master = 9999'), /permission denied/);
        await asRole('authenticated', staffUser, `select public.update_shift_aggregates('${staffA}')`);
        assert.equal(await sql(`select shifts_count from public.staff_shift_aggregates where staff_id = '${staffA}'`), '2');
        assert.equal(await asRole('service_role', staffUser, 'select count(*) from public.staff_shift_aggregates'), '2');

        // whatsapp_otp_codes: only the service role writes.
        await assert.rejects(asRole('anon', staffUser, `insert into public.whatsapp_otp_codes(phone, status) values ('+996555000222', 'pending')`), /permission denied/);
        await assert.rejects(asRole('authenticated', staffUser, `insert into public.whatsapp_otp_codes(phone, status) values ('+996555000222', 'pending')`), /permission denied/);
        assert.equal(await asRole('service_role', staffUser, `insert into public.whatsapp_otp_codes(phone, status) values ('+996555000333', 'pending') returning status`), 'pending');

        // super_admins_legacy: a session sees only its own row.
        assert.equal(await asRole('authenticated', otherUser, 'select count(*) from public.super_admins_legacy'), '0');
        assert.equal(await asRole('authenticated', superAdmin, 'select count(*) from public.super_admins_legacy'), '1');
        await assert.rejects(asRole('anon', otherUser, 'select count(*) from public.super_admins_legacy'), /permission denied/);

        console.log('internal tables access: ok');
    } finally {
        if (created) await docker(['rm', '--force', container]).catch(() => undefined);
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

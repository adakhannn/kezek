// Access-control integration fixture for 20261117130000_service_only_unchecked_definer_functions.
// A disposable PostgreSQL reproduces production grants (every API role may execute the unchecked
// SECURITY DEFINER helpers), shows the notification hijack, applies the real migration and checks
// that only the service role and the postgres-owned auth.users trigger can still use them.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { POSTGRES_IMAGE } = require('./lib/isolated-postgres.cjs');
const { assertLiveFunctions } = require('./lib/live-schema.cjs');

const container = `kezek-definer-acl-${randomUUID()}`;
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
const asRole = (role, body) => sql(`set role ${role}; ${body}`);

const victim = randomUUID();
const newcomer = randomUUID();
const functions = [
    'sync_user_notification_email(uuid, text, text, text)',
    'remove_user_notification_email_source(uuid, text)',
    'recalculate_ratings_for_date(date)',
    'get_api_metrics_stats(text, integer, text)',
    'get_failed_api_requests(text, integer, integer)',
    'get_slow_api_requests(text, integer, integer)',
    'branch_admins_effective(uuid)',
];
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

        await sql(`create role anon; create role authenticated; create role service_role; create role supabase_auth_admin;
            create schema auth; grant usage on schema auth to supabase_auth_admin;
            create table auth.users(id uuid primary key, email text);
            grant insert, update on auth.users to supabase_auth_admin;
            create table public.user_notification_emails(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
                email text not null, verified boolean not null default false, enabled boolean not null default false, unique(user_id, email));
            create table public.user_notification_email_sources(email_id uuid not null references public.user_notification_emails(id) on delete cascade,
                source text not null, unique(email_id, source));

            -- Same signatures and security as production; bodies reduced to the behaviour under test.
            create function public.sync_user_notification_email(target_user_id uuid, target_email text, target_source text, target_provider_subject text default null)
                returns void language plpgsql security definer set search_path = public as $$
                declare v_id uuid;
                begin
                    insert into public.user_notification_emails(user_id, email, verified, enabled)
                        values (target_user_id, lower(target_email), true, true)
                        on conflict (user_id, email) do update set verified = true returning id into v_id;
                    insert into public.user_notification_email_sources(email_id, source) values (v_id, target_source) on conflict do nothing;
                end; $$;
            create function public.remove_user_notification_email_source(target_user_id uuid, target_source text)
                returns void language plpgsql security definer set search_path = public as $$
                begin
                    delete from public.user_notification_email_sources s using public.user_notification_emails e
                        where s.email_id = e.id and e.user_id = target_user_id and s.source = target_source;
                    delete from public.user_notification_emails e where e.user_id = target_user_id
                        and not exists (select 1 from public.user_notification_email_sources s where s.email_id = e.id);
                end; $$;
            create function public.recalculate_ratings_for_date(p_date date) returns void language plpgsql security definer as $$ begin end; $$;
            create function public.get_api_metrics_stats(p_endpoint text, p_window_minutes integer, p_method text default null)
                returns jsonb language sql security definer as $$ select '{}'::jsonb $$;
            create function public.get_failed_api_requests(p_endpoint text default null, p_window_minutes integer default 60, p_limit integer default 50)
                returns table(id uuid) language sql security definer as $$ select null::uuid where false $$;
            create function public.get_slow_api_requests(p_endpoint text default null, p_threshold_ms integer default 1000, p_limit integer default 50)
                returns table(id uuid) language sql security definer as $$ select null::uuid where false $$;
            create function public.branch_admins_effective(p_branch_id uuid) returns table(user_id uuid, source text)
                language sql security definer as $$ select null::uuid, null::text where false $$;
            grant execute on all functions in schema public to anon, authenticated, service_role;

            -- The auth.users trigger keeps the account e-mail in sync, as in production.
            create function public.sync_auth_user_notification_email() returns trigger language plpgsql security definer set search_path = public as $$
                begin perform public.sync_user_notification_email(new.id, new.email, 'account', new.id::text); return new; end; $$;
            create trigger sync_auth_user_notification_email after insert or update of email on auth.users
                for each row execute function public.sync_auth_user_notification_email();

            insert into auth.users values ('${victim}', 'owner@unit.test');`);

        // The fixture reproduces the hijack: the anon key attaches an address and drops the owner's.
        await asRole('anon', `select public.sync_user_notification_email('${victim}', 'attacker@unit.test', 'google', null)`);
        await asRole('anon', `select public.remove_user_notification_email_source('${victim}', 'account')`);
        assert.equal(await sql(`select string_agg(email, ',') from public.user_notification_emails where user_id = '${victim}'`), 'attacker@unit.test');
        await sql(`delete from public.user_notification_emails where user_id = '${victim}';
            update auth.users set email = 'owner2@unit.test' where id = '${victim}';
            update auth.users set email = 'owner@unit.test' where id = '${victim}';
            delete from public.user_notification_emails where user_id = '${victim}' and email = 'owner2@unit.test';`);

        await sql(fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261117130000_service_only_unchecked_definer_functions.sql'), 'utf8'));

        for (const fn of functions) {
            for (const role of ['anon', 'authenticated']) {
                assert.equal(await sql(`select has_function_privilege('${role}', 'public.${fn}', 'EXECUTE')`), 'f', `${role}: ${fn}`);
            }
            assert.equal(await sql(`select has_function_privilege('service_role', 'public.${fn}', 'EXECUTE')`), 't', `service_role: ${fn}`);
        }
        await assert.rejects(asRole('anon', `select public.sync_user_notification_email('${victim}', 'attacker@unit.test', 'google', null)`), /permission denied for function/);
        await assert.rejects(asRole('authenticated', `select public.remove_user_notification_email_source('${victim}', 'account')`), /permission denied for function/);
        await assert.rejects(asRole('anon', `select public.recalculate_ratings_for_date(current_date)`), /permission denied for function/);
        assert.equal(await sql(`select string_agg(email, ',') from public.user_notification_emails where user_id = '${victim}'`), 'owner@unit.test');

        // Trusted callers keep working: the service role and the postgres-owned auth trigger.
        await asRole('service_role', `select public.sync_user_notification_email('${victim}', 'google-login@unit.test', 'google', 'sub-1')`);
        await asRole('supabase_auth_admin', `insert into auth.users values ('${newcomer}', 'NEW@unit.test')`);
        assert.equal(await sql(`select count(*) from public.user_notification_emails where user_id = '${victim}'`), '2');
        assert.equal(await sql(`select email from public.user_notification_emails where user_id = '${newcomer}'`), 'new@unit.test');

        await assertLiveFunctions(sql, { suite: 'test-service-only-definer-functions-isolated.cjs' });
        console.log('service-only definer functions: ok');
    } finally {
        if (created) await docker(['rm', '--force', container]).catch(() => undefined);
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

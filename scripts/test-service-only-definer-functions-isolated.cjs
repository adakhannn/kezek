// Access-control integration fixture for 20261117130000_service_only_unchecked_definer_functions.
// A disposable PostgreSQL holds the functions as the prod baseline created them, under the
// production default grants (every API role may execute the unchecked SECURITY DEFINER helpers),
// shows the notification hijack, applies the real migration and checks that only the service role
// and the postgres-owned auth.users trigger can still use them. The later migrations that changed
// these functions run too, so the trusted callers are checked on the live definitions.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { POSTGRES_IMAGE } = require('./lib/isolated-postgres.cjs');
const { applyMigrationWhereObjectsExist, assertLiveFunctions, SUPABASE_DEFAULT_PRIVILEGES } = require('./lib/live-schema.cjs');

const migrations = path.join(__dirname, '..', 'supabase', 'migrations');
const read = (file) => fs.readFileSync(path.join(migrations, file), 'utf8').replace(/\r/g, '');
const baseline = read('20261009110000_prod_baseline.sql');
// Every overload of a function as the prod baseline creates it: each CREATE up to its ALTER FUNCTION ... OWNER.
function baselineFunctions(name) {
    const marker = `CREATE OR REPLACE FUNCTION "public"."${name}"(`;
    const definitions = [];
    for (let from = baseline.indexOf(marker); from >= 0; from = baseline.indexOf(marker, from + marker.length)) {
        const to = baseline.indexOf(`\nALTER FUNCTION "public"."${name}"(`, from);
        assert.ok(to > from, `${name}: no ALTER FUNCTION after its definition in the prod baseline`);
        definitions.push(baseline.slice(from, to));
    }
    assert.ok(definitions.length > 0, `${name} not found in the prod baseline`);
    return definitions.join('\n');
}

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
// The later migrations that change these functions, in chain order: 20261117180000 repairs
// get_api_metrics_stats (and revokes grant_role/revoke_role), 20261117190000 drops grant_role and
// revoke_role, 20261118150000 makes sync_user_notification_email accept only proven addresses,
// 20261119020000 drops the two API request readers.
const later = [
    '20261117180000_fix_api_metrics_stats.sql',
    '20261117190000_drop_dead_functions.sql',
    '20261118150000_notification_email_proven_sources.sql',
    '20261119020000_dead_functions_and_cleanup_jobs.sql',
];
// pg_cron stand-in: vanilla PostgreSQL has no pg_cron and this suite runs no jobs, so cron.schedule
// only accepts the job declarations of 20261119020000.
const cron = `create schema cron;
    create function cron.schedule(job_name text, schedule text, command text) returns bigint language sql as $$ select 0::bigint $$;`;
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

        // Functions get the grants the production baseline gave them (PUBLIC and every API role).
        await sql(`create role anon; create role authenticated; create role service_role; create role supabase_auth_admin;
            ${SUPABASE_DEFAULT_PRIVILEGES}
            create schema auth; grant usage on schema auth to supabase_auth_admin;
            create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
            create table auth.identities(user_id uuid not null references auth.users(id), provider text not null, identity_data jsonb not null);
            grant insert, update on auth.users to supabase_auth_admin;
            create table public.profiles(id uuid primary key references auth.users(id), yandex_id text);
            -- Columns and keys of the prod baseline.
            create table public.user_notification_emails(id uuid primary key default gen_random_uuid(),
                user_id uuid not null references auth.users(id) on delete cascade, email text not null check (email = lower(btrim(email))),
                verified boolean not null default true, enabled boolean not null default false,
                created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id, email));
            create table public.user_notification_email_sources(email_id uuid not null references public.user_notification_emails(id) on delete cascade,
                source text not null check (source in ('account', 'google', 'yandex')), provider_subject text,
                created_at timestamptz not null default now(), primary key(email_id, source));

            -- Production before the migration: the prod baseline definitions. grant_role and revoke_role
            -- are here because 20261117180000 revokes them before 20261117190000 drops them.
            ${['sync_user_notification_email', 'remove_user_notification_email_source', 'recalculate_ratings_for_date',
                'get_api_metrics_stats', 'get_failed_api_requests', 'get_slow_api_requests', 'branch_admins_effective',
                'sync_auth_user_notification_email', 'grant_role', 'revoke_role'].map(baselineFunctions).join('\n')}

            -- The auth.users trigger keeps the confirmed account e-mail in sync, as in production (20261119010000).
            create trigger sync_auth_user_notification_email_trigger after insert or update of email, email_confirmed_at on auth.users
                for each row execute function public.sync_auth_user_notification_email();

            insert into auth.users values ('${victim}', 'owner@unit.test', now());
            insert into auth.identities values ('${victim}', 'google', '{"email": "google-login@unit.test", "email_verified": true}');`);

        // The fixture reproduces the hijack: the anon key attaches an address and drops the owner's.
        await asRole('anon', `select public.sync_user_notification_email('${victim}', 'attacker@unit.test', 'google', null)`);
        await asRole('anon', `select public.remove_user_notification_email_source('${victim}', 'account')`);
        assert.equal(await sql(`select string_agg(email, ',') from public.user_notification_emails where user_id = '${victim}'`), 'attacker@unit.test');
        await sql(`delete from public.user_notification_emails where user_id = '${victim}';
            update auth.users set email = 'owner2@unit.test' where id = '${victim}';
            update auth.users set email = 'owner@unit.test' where id = '${victim}';
            delete from public.user_notification_emails where user_id = '${victim}' and email = 'owner2@unit.test';`);

        await sql(read('20261117130000_service_only_unchecked_definer_functions.sql'));

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

        await sql(cron);
        for (const file of later) await sql(read(file));
        for (const fn of ['get_failed_api_requests(text, integer, integer)', 'get_slow_api_requests(text, integer, integer)']) {
            assert.equal(await sql(`select to_regprocedure('public.${fn}') is null`), 't', `${fn} is dropped`);
        }

        // Trusted callers keep working on the live definitions: the service role with an address the
        // user's Google identity proves, and the postgres-owned auth trigger with a confirmed e-mail.
        await asRole('service_role', `select public.sync_user_notification_email('${victim}', 'google-login@unit.test', 'google', 'sub-1')`);
        await asRole('supabase_auth_admin', `insert into auth.users values ('${newcomer}', 'NEW@unit.test', now())`);
        assert.equal(await sql(`select count(*) from public.user_notification_emails where user_id = '${victim}'`), '2');
        assert.equal(await sql(`select email from public.user_notification_emails where user_id = '${newcomer}'`), 'new@unit.test');

        await applyMigrationWhereObjectsExist(sql, '20261119060000_definer_function_hardening.sql');
        await assertLiveFunctions(sql, { suite: 'test-service-only-definer-functions-isolated.cjs' });
        console.log('service-only definer functions: ok');
    } finally {
        if (created) await docker(['rm', '--force', container]).catch(() => undefined);
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

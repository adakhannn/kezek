// Integration fixture for 20261118150000_notification_email_proven_sources. A disposable
// PostgreSQL with the notification e-mail tables, the baseline sync/remove functions (loaded from
// the baseline migration) and the production auth.users trigger shows the old function storing a
// forged Yandex address as verified, applies the real migration and checks the proof rules,
// the cleanup and the AFTER ROW trigger path.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');

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

const container = `kezek-notify-proof-${randomUUID()}`;
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
const sync = (user, email, source, subject) =>
    sql(`set role service_role; select public.sync_user_notification_email('${user}', '${email}', '${source}', ${subject === null ? 'null' : `'${subject}'`})`);
const emailsOf = (user) => sql(`select coalesce(string_agg(e.email || ':' || s.source || ':' || e.enabled::text, ',' order by e.email collate "C", s.source), '-')
    from public.user_notification_emails e join public.user_notification_email_sources s on s.email_id = e.id where e.user_id = '${user}'`);

const [attacker, linked, legit, fresh] = Array.from({ length: 4 }, () => randomUUID());
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
            grant usage on schema auth to service_role; grant usage on schema public to anon, authenticated, service_role;
            create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz, raw_user_meta_data jsonb default '{}');
            create table auth.identities(id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id), provider text, provider_id text, identity_data jsonb);
            create table public.profiles(id uuid primary key references auth.users(id), yandex_id text unique);
            create table public.user_notification_emails (
                id uuid default gen_random_uuid() primary key, user_id uuid not null references auth.users(id) on delete cascade,
                email text not null, verified boolean default true not null, enabled boolean default false not null,
                created_at timestamptz default now() not null, updated_at timestamptz default now() not null,
                constraint user_notification_emails_normalized check (email = lower(btrim(email))),
                constraint user_notification_emails_unique unique (user_id, email));
            create table public.user_notification_email_sources (
                email_id uuid not null references public.user_notification_emails(id) on delete cascade,
                source text not null check (source = any (array['account', 'google', 'yandex'])), provider_subject text,
                created_at timestamptz default now() not null, primary key (email_id, source));
            grant all on public.user_notification_emails, public.user_notification_email_sources to anon, authenticated, service_role;`);

        // Baseline bodies, and the production trigger (absent from the baseline, DB-15).
        await sql([
            extract('20261009110000_prod_baseline.sql', 'CREATE OR REPLACE FUNCTION "public"."sync_user_notification_email"', '\n$$;'),
            extract('20261009110000_prod_baseline.sql', 'CREATE OR REPLACE FUNCTION "public"."remove_user_notification_email_source"', '\n$$;'),
            `create function public.sync_auth_user_notification_email() returns trigger language plpgsql security definer set search_path = public as $$
            begin
                if tg_op = 'UPDATE' and old.email is distinct from new.email then
                    perform public.remove_user_notification_email_source(new.id, 'account');
                end if;
                if new.email is not null and new.email_confirmed_at is not null then
                    perform public.sync_user_notification_email(new.id, new.email, 'account', new.id::text);
                end if;
                return new;
            end $$;
            create trigger sync_auth_user_notification_email_trigger after insert or update on auth.users
                for each row execute function public.sync_auth_user_notification_email();
            revoke all on function public.sync_user_notification_email(uuid, text, text, text), public.remove_user_notification_email_source(uuid, text) from public, anon, authenticated;
            grant execute on function public.sync_user_notification_email(uuid, text, text, text), public.remove_user_notification_email_source(uuid, text) to service_role;`,
        ].join('\n'));

        await sql(`insert into auth.users(id, email, email_confirmed_at) values
                ('${attacker}', 'attacker@unit.test', now()), ('${linked}', 'b@unit.test', now()), ('${legit}', 'l@unit.test', now());
            insert into public.profiles values ('${attacker}', null), ('${linked}', 'y-b'), ('${legit}', 'y-l');
            insert into auth.identities(user_id, provider, provider_id, identity_data) values
                ('${legit}', 'google', 'g-l', '{"email":"L.Google@Unit.Test"}'),
                ('${legit}', 'google', 'g-x', '{"email":"unverified@unit.test","email_verified":false}');`);

        // The old function accepted any address the web passed, e.g. from forged user_metadata.
        await sync(attacker, 'victim@unit.test', 'yandex', '');
        await sync(linked, 'b@yandex.unit', 'yandex', 'y-b');
        await sync(linked, 'victim2@unit.test', 'yandex', 'zzz');
        await sync(legit, 'l@yandex.unit', 'yandex', 'y-l');
        assert.equal(await sql(`select verified::text from public.user_notification_emails where email = 'victim@unit.test'`), 'true', 'the hole');

        await sql(read('20261118150000_notification_email_proven_sources.sql'));

        // Cleanup: forged rows gone, legitimate ones kept, the attacker's account e-mail enabled again.
        assert.equal(await emailsOf(attacker), 'attacker@unit.test:account:true');
        assert.equal(await emailsOf(linked), 'b@unit.test:account:true,b@yandex.unit:yandex:false');
        assert.equal(await emailsOf(legit), 'l@unit.test:account:true,l@yandex.unit:yandex:false');

        // Proof rules for every source.
        const notProven = /NOTIFICATION_EMAIL_NOT_PROVEN/;
        await assert.rejects(sync(attacker, 'victim@unit.test', 'yandex', ''), notProven);
        await assert.rejects(sync(attacker, 'victim@unit.test', 'yandex', 'y-l'), notProven, "another user's yandex_id");
        await assert.rejects(sync(attacker, 'other@unit.test', 'account', attacker), notProven);
        await assert.rejects(sync(legit, 'unverified@unit.test', 'google', 'g-x'), notProven);
        await assert.rejects(sync(attacker, 'L.Google@Unit.Test', 'google', 'g-l'), notProven, "another user's identity");
        await sync(legit, 'L.Google@Unit.Test', 'google', 'g-l');
        await sync(linked, 'b2@yandex.unit', 'yandex', 'y-b');
        await sync(linked, ' B@Unit.Test ', 'account', linked);
        assert.equal(await sql(`select count(*) from public.user_notification_emails where email in ('l.google@unit.test', 'b2@yandex.unit')`), '2');

        // The auth.users trigger (AFTER ROW) still syncs a newly confirmed account e-mail and an e-mail change.
        await sql(`insert into auth.users(id, email, email_confirmed_at) values ('${fresh}', 'Fresh@Unit.Test', null)`);
        assert.equal(await emailsOf(fresh), '-');
        await sql(`update auth.users set email_confirmed_at = now() where id = '${fresh}'`);
        assert.equal(await emailsOf(fresh), 'fresh@unit.test:account:true');
        await sql(`update auth.users set email = 'renamed@unit.test' where id = '${fresh}'`);
        assert.equal(await emailsOf(fresh), 'renamed@unit.test:account:true');

        // Only the definer functions write; client roles hold no write privilege.
        assert.equal(await sql(`select has_table_privilege('authenticated', 'public.user_notification_emails', 'INSERT')
            or has_table_privilege('authenticated', 'public.user_notification_email_sources', 'INSERT')
            or has_function_privilege('authenticated', 'public.sync_user_notification_email(uuid,text,text,text)', 'execute')`), 'f');

        console.log('notification email proven sources: ok');
    } finally {
        if (created) await docker(['rm', '--force', container]).catch(() => undefined);
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

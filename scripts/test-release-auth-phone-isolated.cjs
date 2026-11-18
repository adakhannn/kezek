// Integration fixture for 20261118210000_release_auth_phone. A disposable PostgreSQL with the Auth
// columns GoTrue uses for phones checks that one number leaves one account completely (phone,
// confirmation, pending change, phone identity, metadata copy) in both spellings, that other
// numbers, accounts, the e-mail and app metadata stay untouched, that it is idempotent, and that
// only the service role may call it.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { POSTGRES_IMAGE } = require('./lib/isolated-postgres.cjs');
const { assertLiveFunctions } = require('./lib/live-schema.cjs');

const migration = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '20261118210000_release_auth_phone.sql'), 'utf8').replace(/\r/g, '');
const container = `kezek-release-auth-phone-${randomUUID()}`;
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
const release = (user, digits, role = 'service_role') => sql(`set role ${role}; select public.release_auth_phone('${user}', '${digits}')`);
const state = (user) => sql(`select coalesce(phone, '-') || '|' || (phone_confirmed_at is not null)::text || '|' || coalesce(nullif(phone_change, ''), '-') || '|'
    || coalesce(nullif(phone_change_token, ''), '-') || '|' || coalesce(raw_user_meta_data ->> 'phone', '-') || '|' || coalesce(email, '-') || '|'
    || (raw_app_meta_data ->> 'provider') || '|' || (select count(*) from auth.identities i where i.user_id = u.id and i.provider = 'phone')
    from auth.users u where id = '${user}'`);

const [whatsApp, changer, other, plus] = Array.from({ length: 4 }, () => randomUUID());
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
            grant usage on schema public to anon, authenticated, service_role;
            create table auth.users(id uuid primary key, email text, phone text unique default null, phone_confirmed_at timestamptz,
                phone_change text default '', phone_change_token varchar(255) default '', phone_change_sent_at timestamptz,
                raw_user_meta_data jsonb default '{}', raw_app_meta_data jsonb default '{}');
            create table auth.identities(id uuid primary key default gen_random_uuid(), provider_id text not null, user_id uuid not null references auth.users(id),
                identity_data jsonb not null, provider text not null, unique (provider_id, provider));
            insert into auth.users(id, email, phone, phone_confirmed_at, raw_user_meta_data, raw_app_meta_data) values
                ('${whatsApp}', null, '996555123456', now(), '{"phone":"+996555123456","full_name":"Айгерим"}', '{"provider":"phone"}'),
                ('${other}', 'other@example.test', '996700000001', now(), '{"phone":"+996700000001"}', '{"provider":"phone"}'),
                ('${plus}', null, '+996700000009', now(), '{}', '{"provider":"phone"}');
            insert into auth.users(id, email, phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at, raw_app_meta_data) values
                ('${changer}', 'changer@example.test', '996700000002', now(), '996555123456', 'token', now(), '{"provider":"email"}');
            insert into auth.identities(provider_id, user_id, identity_data, provider) values
                ('${whatsApp}', '${whatsApp}', '{"sub":"${whatsApp}","phone":"996555123456"}', 'phone'),
                ('${other}', '${other}', '{"sub":"${other}","phone":"996700000001"}', 'phone'),
                ('${plus}', '${plus}', '{"sub":"${plus}","phone":"+996700000009"}', 'phone');`);
        await sql(migration);

        // The WhatsApp-created account loses the number completely; the name and app metadata stay.
        assert.equal(await release(whatsApp, '996555123456'), '1');
        assert.equal(await state(whatsApp), '-|false|-|-|-|-|phone|0');
        assert.equal(await sql(`select raw_user_meta_data ->> 'full_name' from auth.users where id = '${whatsApp}'`), 'Айгерим');

        // A pending change to that number on another account is released there only when asked for it.
        assert.equal(await state(changer), '996700000002|true|996555123456|token|-|changer@example.test|email|0');
        assert.equal(await release(changer, '996555123456'), '1');
        assert.equal(await state(changer), '996700000002|true|-|-|-|changer@example.test|email|0');

        // Other accounts and numbers are untouched; the '+' spelling is released too; repeat calls are no-ops.
        assert.equal(await state(other), '996700000001|true|-|-|+996700000001|other@example.test|phone|1');
        assert.equal(await release(plus, '996700000009'), '1');
        assert.equal(await state(plus), '-|false|-|-|-|-|phone|0');
        assert.equal(await release(whatsApp, '996555123456'), '0');
        assert.equal(await release(other, '996555123456'), '0');
        assert.equal(await state(other), '996700000001|true|-|-|+996700000001|other@example.test|phone|1');

        // Input checks and access.
        await assert.rejects(release(other, '12345'), /INVALID_PHONE/);
        await assert.rejects(sql(`set role service_role; select public.release_auth_phone(null, '996700000001')`), /INVALID_USER/);
        for (const role of ['authenticated', 'anon']) {
            await assert.rejects(release(other, '996700000001', role), /permission denied for function release_auth_phone/);
        }
        assert.equal(await state(other), '996700000001|true|-|-|+996700000001|other@example.test|phone|1');

        await assertLiveFunctions(sql, { suite: 'test-release-auth-phone-isolated.cjs' });
        console.log('release auth phone: ok');
    } finally {
        if (created) await docker(['rm', '--force', container]).catch(() => undefined);
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

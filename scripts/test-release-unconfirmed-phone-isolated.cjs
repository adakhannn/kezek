// Integration fixture for 20261118130000_release_unconfirmed_phone. A disposable PostgreSQL with
// an auth.users table that keeps phones unique checks that only unconfirmed claims on the number
// are released (both GoTrue spellings), confirmed phones and other numbers stay, bad input is
// refused, and only the service role may call the function.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');

const container = `kezek-release-phone-${randomUUID()}`;
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
const [squatter, plusSquatter, owner, other] = Array.from({ length: 4 }, () => randomUUID());
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
            create table auth.users(id uuid primary key, phone text, phone_confirmed_at timestamptz);
            create unique index users_phone_key on auth.users(phone);
            insert into auth.users values
                ('${squatter}', '996700000001', null),
                ('${plusSquatter}', '+996700000002', null),
                ('${owner}', '996700000003', now()),
                ('${other}', '996700000004', null);`);

        await sql(fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '20261118130000_release_unconfirmed_phone.sql'), 'utf8'));

        assert.equal(await sql(`select public.release_unconfirmed_phone('996700000001')`), '1');
        assert.equal(await sql(`select public.release_unconfirmed_phone('996700000002')`), '1', 'the +digits spelling');
        assert.equal(await sql(`select public.release_unconfirmed_phone('996700000003')`), '0', 'a confirmed phone stays');
        const phoneOf = (id) => sql(`select coalesce(phone, '-') from auth.users where id = '${id}'`);
        assert.equal(await phoneOf(squatter), '-');
        assert.equal(await phoneOf(plusSquatter), '-');
        assert.equal(await phoneOf(owner), '996700000003', 'a confirmed phone is never released');
        assert.equal(await phoneOf(other), '996700000004', 'other numbers stay');

        // The released numbers can now be taken by the verified owner's new account.
        assert.equal(await sql(`insert into auth.users values (gen_random_uuid(), '996700000001', now()) returning phone`), '996700000001');

        for (const bad of ["''", "'%'", "'99670000000x'", "'12'", 'null']) {
            await assert.rejects(sql(`select public.release_unconfirmed_phone(${bad})`), /INVALID_PHONE/, bad);
        }
        for (const role of ['anon', 'authenticated']) {
            await assert.rejects(sql(`set role ${role}; select public.release_unconfirmed_phone('996700000004')`), /permission denied for function/);
        }
        assert.equal(await sql(`select has_function_privilege('service_role', 'public.release_unconfirmed_phone(text)', 'execute')`), 't');

        console.log('release unconfirmed phone: ok');
    } finally {
        if (created) await docker(['rm', '--force', container]).catch(() => undefined);
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

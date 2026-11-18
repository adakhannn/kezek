// Disposable PostgreSQL 17 in Docker only (no network, no project data; never connects to Supabase).
// The browser-bound Telegram login as production has it: telegram_web_login_attempts, profiles and
// transition_telegram_web_login come from the prod baseline, created under its default privileges,
// and 20261119050000_privilege_parity_with_prod leaves the table and the function to service_role,
// the role the backend creates attempts and calls the function with.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { POSTGRES_IMAGE } from './lib/isolated-postgres.cjs';
import { applyMigrationWhereObjectsExist, assertLiveFunctions, SUPABASE_DEFAULT_PRIVILEGES } from './lib/live-schema.cjs';

const baseline = readFileSync(new URL('../supabase/migrations/20261009110000_prod_baseline.sql', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
// The statement of the prod baseline that starts with `start`, up to `end`.
function baselineStatement(start, end) {
    const from = baseline.indexOf(start);
    assert.ok(from >= 0 && baseline.indexOf(start, from + 1) < 0, `${start}: once in the prod baseline`);
    return baseline.slice(from, baseline.indexOf(end, from) + end.length);
}
// A function as the prod baseline creates it: definition, owner and grants.
function baselineFunction(name) {
    const owner = baselineStatement(`ALTER FUNCTION "public"."${name}"(`, ';\n');
    const from = baseline.indexOf(`CREATE OR REPLACE FUNCTION "public"."${name}"(`);
    assert.ok(from >= 0 && baseline.indexOf(`CREATE OR REPLACE FUNCTION "public"."${name}"(`, from + 1) < 0, `${name}: one definition in the prod baseline`);
    const identity = owner.slice('ALTER FUNCTION '.length, owner.indexOf(' OWNER TO '));
    const grants = baseline.split('\n').filter((line) => /^(GRANT|REVOKE) ALL ON FUNCTION /.test(line) && line.includes(` ON FUNCTION ${identity} `));
    return [baseline.slice(from, baseline.indexOf(owner, from)), owner, ...grants].join('\n');
}
// A table as the prod baseline creates it: columns, constraints, indexes, row level security and
// grants (policies and triggers are left out).
function baselineTable(name) {
    const table = `"public"."${name}"`;
    const parts = [baselineStatement(`CREATE TABLE IF NOT EXISTS ${table} (`, '\n);\n')];
    for (const match of baseline.matchAll(/^ALTER TABLE (?:ONLY )?("[^"\n]+"\."[^"\n]+")\n {4}ADD CONSTRAINT [^\n]+;$/gm)) {
        if (match[1] === table) parts.push(match[0]);
    }
    parts.push(...baseline.split('\n').filter((line) => line === `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`
        || (/^CREATE (UNIQUE )?INDEX /.test(line) && line.includes(` ON ${table} USING `))
        || (/^(GRANT|REVOKE) /.test(line) && line.includes(` ON TABLE ${table} `))));
    return parts.join('\n');
}
// The prod baseline's default privileges for new tables in public: a database built from the
// migrations creates the baseline tables under them, which 20261119050000 corrects.
const tableDefaults = baseline.split('\n').filter((line) => line.startsWith('ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO '));
assert.equal(tableDefaults.length, 4);

const container = `kezek-telegram-web-login-${randomUUID()}`;
const docker = (args, input = '') => new Promise((resolve, reject) => {
    const child = spawn('docker', args, { windowsHide: true });
    let out = '';
    let err = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (data) => { out += data; });
    child.stderr.on('data', (data) => { err += data; });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(err || out || `exit ${code}`))));
    child.stdin.end(input);
});
const sql = (input) => docker(['exec', '-i', container, 'psql', '-X', '-q', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], input);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const literal = (value) => (value === null ? 'null' : typeof value === 'number' ? String(value) : `'${String(value).replaceAll("'", "''")}'`);

const uid = '00000000-0000-0000-0000-000000000001';
const browser = 'b'.repeat(64);
const other = 'c'.repeat(64);
let i = 0;
async function create() {
    const hash = (++i).toString(16).padStart(64, '0');
    await sql(`set role service_role; insert into public.telegram_web_login_attempts(token_hash, browser_hash) values ('${hash}', '${browser}');`);
    return hash;
}
const call = (hash, action, secret = null, telegram = null) => `select public.transition_telegram_web_login(${[hash, action, secret, telegram, 'Name'].map(literal).join(', ')})`;
const step = async (...args) => JSON.parse(await sql(`set role service_role; ${call(...args)};`));
// Two calls as service_role in sessions that really overlap: the first keeps its transaction open
// after its call until the second waits for a lock the first holds, and then commits.
async function overlap(first, second) {
    const tag = randomUUID().replaceAll('-', '');
    let failure = null;
    const holder = sql(`set application_name = 'first_${tag}';
begin;
set local role service_role;
${first};
reset role;
do $wait$ begin
    for i in 1..400 loop
        perform pg_stat_clear_snapshot();
        if exists (select 1 from pg_stat_activity where application_name = 'second_${tag}' and wait_event_type = 'Lock') then return; end if;
        perform pg_sleep(0.05);
    end loop;
    raise exception 'the second session never waited for the first';
end $wait$;
commit;`);
    holder.catch((error) => { failure = error; });
    for (let n = 0; await sql(`select count(*) from pg_stat_activity where application_name = 'first_${tag}' and wait_event = 'PgSleep'`) !== '1'; n += 1) {
        if (failure) throw failure;
        assert.ok(n < 200, 'the first session never reached its wait');
        await delay(50);
    }
    const results = await Promise.all([holder, sql(`set application_name = 'second_${tag}'; set role service_role; ${second};`)]);
    return results.map((result) => JSON.parse(result));
}

let created = false;
try {
    await docker(['run', '--detach', '--rm', '--network', 'none', '--tmpfs', '/var/lib/postgresql/data', '--name', container, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', POSTGRES_IMAGE]);
    created = true;
    let ready = false;
    for (let n = 0; n < 120; n += 1) {
        try {
            if (await docker(['exec', container, 'cat', '/proc/1/comm']) === 'postgres') {
                await docker(['exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres']);
                ready = true;
                break;
            }
        } catch { /* still starting */ }
        await delay(500);
    }
    assert.ok(ready, 'PostgreSQL did not start');

    await sql(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
${SUPABASE_DEFAULT_PRIVILEGES}
${tableDefaults.join('\n')}
create schema auth;
create table auth.users(id uuid primary key);
${baselineTable('profiles')}
${baselineTable('telegram_web_login_attempts')}
${baselineFunction('transition_telegram_web_login')}`);
    await applyMigrationWhereObjectsExist(sql, '20261119050000_privilege_parity_with_prod.sql');
    await sql(`insert into auth.users(id) values ('${uid}');
insert into public.profiles(id, telegram_id, telegram_verified) values ('${uid}', 123, true);`);

    const a = await create();
    assert.equal((await step(a, 'finish', other, 123)).error, 'not_found');
    assert.equal((await step(a, 'approve', null, 123)).error, 'not_claimed');
    assert.equal((await step(a, 'claim', null, 123)).status, 'pending');
    assert.equal((await step(a, 'claim', null, 456)).error, 'different_account');
    assert.equal((await step(a, 'approve', null, 456)).error, 'different_account');
    assert.equal((await step(a, 'finish', browser, 123)).error, 'not_approved');
    assert.equal((await step(a, 'approve', null, 123)).status, 'approved');
    assert.equal((await step(a, 'approve', null, 123)).status, 'approved');
    assert.equal((await step(a, 'finish', browser, 456)).error, 'different_account');
    // Two finishes at once: the second waits for the first's row lock and then finds the attempt consumed.
    assert.deepEqual(await overlap(call(a, 'finish', browser, 123), call(a, 'finish', browser, 123)), [{ status: 'consumed', user_id: uid }, { error: 'closed' }]);
    const b = await create();
    await step(b, 'claim', null, 123);
    await step(b, 'approve', null, 123);
    await sql('update public.profiles set telegram_verified = false');
    assert.equal((await step(b, 'finish', browser, 123)).error, 'not_linked');
    await sql('update public.profiles set telegram_verified = true');
    const c = await create();
    assert.equal((await step(c, 'cancel', other)).error, 'not_found');
    assert.equal((await step(c, 'cancel', browser)).status, 'cancelled');
    assert.equal((await step(c, 'claim', null, 123)).error, 'closed');
    const d = await create();
    await sql(`update public.telegram_web_login_attempts set expires_at = now() - interval '1 second' where token_hash = '${d}'`);
    assert.equal((await step(d, 'claim', null, 123)).error, 'expired');
    const e = await create();
    await step(e, 'claim', null, 999);
    await step(e, 'approve', null, 999);
    assert.equal((await step(e, 'finish', browser, 999)).error, 'not_linked');
    assert.equal(await sql('select count(*) from public.profiles'), '1');
    for (const role of ['anon', 'authenticated']) {
        assert.equal(await sql(`select has_table_privilege('${role}', 'public.telegram_web_login_attempts', 'SELECT')`), 'f', `${role} reads attempts`);
        assert.equal(await sql(`select has_function_privilege('${role}', 'public.transition_telegram_web_login(text,text,text,bigint,text)', 'EXECUTE')`), 'f', `${role} executes the transition`);
    }
    assert.equal(await sql("select relrowsecurity from pg_class where oid = 'public.telegram_web_login_attempts'::regclass"), 't');

    await assertLiveFunctions(sql, { suite: 'test-telegram-web-login-db.mjs' });
    console.log('PASS: browser binding, consent, identity, expiry, cancellation, single consumption under a real race, unlink, no signup, RLS/grants');
} finally {
    if (created) await docker(['rm', '-f', container]).catch(() => {});
}

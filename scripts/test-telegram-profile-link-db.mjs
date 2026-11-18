// Disposable PostgreSQL 17 in Docker only (no network, no project data; never connects to Supabase).
// Telegram profile linking as production has it: telegram_profile_link_attempts, profiles and
// transition_telegram_profile_link come from the prod baseline, created under its default
// privileges; profiles keeps the identity-column guard of 20261116120000 (live definition), and
// 20261119050000_privilege_parity_with_prod leaves the attempts table and the function to
// service_role, the role the backend creates attempts and calls the function with.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { POSTGRES_IMAGE } from './lib/isolated-postgres.cjs';
import { applyMigrationWhereObjectsExist, assertLiveFunctions, installLiveFunction, SUPABASE_DEFAULT_PRIVILEGES } from './lib/live-schema.cjs';

const migration = (file) => readFileSync(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const baseline = migration('20261009110000_prod_baseline.sql');
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
// The trigger of 20261116120000_identity_and_auth_surface_hardening that guards the profile identity columns.
const hardening = migration('20261116120000_identity_and_auth_surface_hardening.sql');
const guardAt = hardening.indexOf('create trigger profiles_protect_identity_columns');
assert.ok(guardAt >= 0, 'the identity guard trigger of 20261116120000');
const guardTrigger = hardening.slice(guardAt, hardening.indexOf(';', guardAt) + 1);

const container = `kezek-telegram-profile-link-${randomUUID()}`;
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

const owner = '00000000-0000-0000-0000-000000000001';
const other = '00000000-0000-0000-0000-000000000002';
let n = 0;
async function attempt(user = owner) {
    const hash = (++n).toString(16).padStart(64, '0');
    await sql(`set role service_role; insert into public.telegram_profile_link_attempts(token_hash, owner_id) values ('${hash}', '${user}');`);
    return hash;
}
const call = (hash, action, user = null, tg = null) => `select public.transition_telegram_profile_link(${[hash, action, user, tg, 'test_user', 'Test User'].map(literal).join(', ')})`;
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
    for (let i = 0; await sql(`select count(*) from pg_stat_activity where application_name = 'first_${tag}' and wait_event = 'PgSleep'`) !== '1'; i += 1) {
        if (failure) throw failure;
        assert.ok(i < 200, 'the first session never reached its wait');
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
    for (let i = 0; i < 120; i += 1) {
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
create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
${baselineTable('profiles')}
${baselineTable('telegram_profile_link_attempts')}
${baselineFunction('transition_telegram_profile_link')}`);
    await installLiveFunction(sql, 'public.protect_profile_identity_columns()');
    await sql(guardTrigger);
    await applyMigrationWhereObjectsExist(sql, '20261119050000_privilege_parity_with_prod.sql');
    await sql(`insert into auth.users(id) values ('${owner}'), ('${other}');
insert into public.profiles(id) select id from auth.users;`);

    const a = await attempt();
    assert.equal((await step(a, 'finish', other, 100)).error, 'not_found');
    assert.equal((await step(a, 'finish', owner, 100)).error, 'not_claimed');
    assert.equal((await step(a, 'claim', null, 100)).status, 'pending');
    assert.equal((await step(a, 'claim', null, 200)).error, 'different_account');
    assert.equal((await step(a, 'approve', null, 200)).error, 'different_account');
    assert.equal((await step(a, 'finish', owner, 100)).error, 'not_approved');
    assert.equal((await step(a, 'approve', null, 100)).status, 'approved');
    assert.equal((await step(a, 'finish', owner, 200)).error, 'different_account');
    assert.equal((await step(a, 'finish', owner, 100)).status, 'consumed');
    assert.equal((await step(a, 'finish', owner, 100)).status, 'consumed');
    assert.equal((await step(a, 'cancel_owner', owner)).error, 'closed');
    // The link survives the identity guard, which resets these columns only for client sessions.
    assert.equal(await sql(`select telegram_id, telegram_verified from public.profiles where id = '${owner}'`), '100|t');
    assert.equal(await sql(`select raw_user_meta_data -> 'telegram_id' from auth.users where id = '${owner}'`), '100');
    const b = await attempt(other);
    await step(b, 'claim', null, 100);
    await step(b, 'approve', null, 100);
    assert.equal((await step(b, 'finish', other, 100)).error, 'already_linked');
    assert.equal(await sql(`select telegram_id is null from public.profiles where id = '${other}'`), 't');
    const c = await attempt();
    await step(c, 'claim', null, 300);
    await step(c, 'approve', null, 300);
    assert.equal((await step(c, 'finish', owner, 300)).error, 'already_connected');
    const d = await attempt();
    await step(d, 'claim', null, 100);
    await step(d, 'approve', null, 100);
    await sql(`update public.telegram_profile_link_attempts set expires_at = now() - interval '1 second' where token_hash = '${d}'`);
    assert.equal((await step(d, 'finish', owner, 100)).error, 'expired');
    const e = await attempt();
    assert.equal((await step(e, 'cancel_owner', owner)).status, 'cancelled');
    assert.equal((await step(e, 'claim', null, 100)).error, 'closed');
    // A failure after the profile write must roll back both profile and attempt state.
    const f = await attempt(other);
    await step(f, 'claim', null, 400);
    await step(f, 'approve', null, 400);
    await sql(`create function public.test_metadata_failure() returns trigger language plpgsql as $$
begin raise exception 'simulated metadata failure'; end $$;
create trigger metadata_failure before update on auth.users for each row execute function public.test_metadata_failure();`);
    await assert.rejects(step(f, 'finish', other, 400), /simulated metadata failure/);
    assert.equal(await sql(`select telegram_id is null from public.profiles where id = '${other}'`), 't');
    assert.equal(await sql(`select status from public.telegram_profile_link_attempts where token_hash = '${f}'`), 'approved');
    await sql('drop trigger metadata_failure on auth.users; drop function public.test_metadata_failure();');
    // Concurrent attempts for the same Telegram identity cannot both claim ownership: the second
    // finish waits on the profile's unique Telegram id until the first commits and is then refused.
    await sql(`update public.profiles set telegram_id = null where id = '${owner}'`);
    const g = await attempt(owner);
    await step(g, 'claim', null, 400);
    await step(g, 'approve', null, 400);
    assert.deepEqual(await overlap(call(f, 'finish', other, 400), call(g, 'finish', owner, 400)), [{ status: 'consumed' }, { error: 'already_linked' }]);
    assert.equal(await sql(`select telegram_id is null from public.profiles where id = '${owner}'`), 't');
    for (const role of ['anon', 'authenticated']) {
        assert.equal(await sql(`select has_function_privilege('${role}', 'public.transition_telegram_profile_link(text,text,uuid,bigint,text,text)', 'execute')`), 'f', `${role} executes the transition`);
        assert.equal(await sql(`select has_table_privilege('${role}', 'public.telegram_profile_link_attempts', 'select')`), 'f', `${role} reads attempts`);
    }

    await assertLiveFunctions(sql, { suite: 'test-telegram-profile-link-db.mjs' });
    console.log('PASS: ownership, two-sided approval, account binding, expiry, replay, conflict under a real race, atomic metadata, cancellation and database permissions');
} finally {
    if (created) await docker(['rm', '-f', container]).catch(() => {});
}

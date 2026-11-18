// Integration fixture for 20261119030000_closed_default_privileges (DB-11). A disposable PostgreSQL
// with the production default privileges (the prod baseline plus 20261117200000) shows that, before
// the migration, a new table, view, sequence and SECURITY DEFINER function in public were open to
// anon and authenticated, and a new function in any schema was executable by PUBLIC; and that after
// it new objects belong to the owner and service_role only, explicit grants still work, trigger
// functions fire without a grant, objects created earlier keep their grants and re-running the
// migration changes nothing.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { POSTGRES_IMAGE } = require('./lib/isolated-postgres.cjs');

const migration = fs.readFileSync(
    path.join(__dirname, '..', 'supabase', 'migrations', '20261119030000_closed_default_privileges.sql'),
    'utf8',
).replace(/\r/g, '');

const container = `kezek-default-privileges-${randomUUID()}`;
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
const as = (role, statement) => sql(`begin; set local role ${role}; ${statement}; rollback;`);

// Roles and default privileges as in production: the prod baseline (20261009110000) grants ALL on
// new tables, sequences and functions in public to anon, authenticated and service_role, and
// 20261117200000 took TRUNCATE, REFERENCES, TRIGGER and MAINTAIN off the table defaults.
const fixture = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
grant usage on schema public to anon, authenticated, service_role;
create schema private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on sequences to postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public revoke truncate, references, trigger on tables from anon, authenticated;
alter default privileges in schema public revoke maintain on tables from anon, authenticated;
`;

// One object of each kind, created by the migration role.
const objects = (suffix) => `
create table public.notes_${suffix} (id bigint generated always as identity primary key, body text not null default 'x');
create view public.notes_${suffix}_view as select id, body from public.notes_${suffix};
create sequence public.counter_${suffix};
create function public.secret_${suffix}() returns text language sql security definer set search_path = '' as $$ select 'secret'::text $$;
create function private.helper_${suffix}() returns text language sql as $$ select 'helper'::text $$;
`;

const tablePrivileges = (role, table) => sql(`select coalesce(string_agg(p, ',' order by p), 'none') from unnest(array['select','insert','update','delete','truncate','references','trigger']) p
    where has_table_privilege('${role}', 'public.${table}', p)`);
const canExecute = (role, signature) => sql(`select has_function_privilege('${role}', '${signature}', 'execute')`);
const canUseSequence = (role, sequence) => sql(`select has_sequence_privilege('${role}', 'public.${sequence}', 'usage')`);

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

        // Before: new objects are open to client sessions.
        await sql(objects('before'));
        for (const role of ['anon', 'authenticated']) {
            assert.equal(await tablePrivileges(role, 'notes_before'), 'delete,insert,select,update', `DB-11: ${role} on a new table`);
            assert.equal(await tablePrivileges(role, 'notes_before_view'), 'delete,insert,select,update', `DB-11: ${role} on a new view`);
            assert.equal(await canUseSequence(role, 'counter_before'), 't');
            assert.equal(await canExecute(role, 'public.secret_before()'), 't');
            assert.equal(await canExecute(role, 'private.helper_before()'), 't', 'DB-11: PUBLIC executes new functions in any schema');
        }
        assert.equal(await as('anon', 'select public.secret_before()'), 'secret', 'DB-11: a visitor runs a new SECURITY DEFINER function');
        await as('anon', `insert into public.notes_before(body) values ('written by a visitor')`);

        await sql(migration);

        // After: new objects belong to the owner and service_role only.
        await sql(objects('after'));
        for (const role of ['anon', 'authenticated']) {
            assert.equal(await tablePrivileges(role, 'notes_after'), 'none', `${role} on a new table`);
            assert.equal(await tablePrivileges(role, 'notes_after_view'), 'none', `${role} on a new view`);
            assert.equal(await canUseSequence(role, 'counter_after'), 'f');
            assert.equal(await canExecute(role, 'public.secret_after()'), 'f');
            assert.equal(await canExecute(role, 'private.helper_after()'), 'f');
        }
        await assert.rejects(as('anon', 'select public.secret_after()'), /permission denied for function secret_after/);
        await assert.rejects(as('authenticated', 'select * from public.notes_after'), /permission denied for table notes_after/);
        await assert.rejects(as('authenticated', `insert into public.notes_after(body) values ('x')`), /permission denied for table notes_after/);
        assert.equal(await tablePrivileges('service_role', 'notes_after'), 'delete,insert,references,select,trigger,truncate,update');
        assert.equal(await canUseSequence('service_role', 'counter_after'), 't');
        assert.equal(await canExecute('service_role', 'public.secret_after()'), 't');
        assert.equal(await as('service_role', 'select public.secret_after()'), 'secret');

        // Objects created before the migration keep their grants.
        assert.equal(await tablePrivileges('authenticated', 'notes_before'), 'delete,insert,select,update');
        assert.equal(await canExecute('anon', 'public.secret_before()'), 't');
        assert.equal(await canUseSequence('anon', 'counter_before'), 't');

        // An explicit grant opens exactly what it names.
        await sql(`grant select on public.notes_after to authenticated;
            grant execute on function public.secret_after() to authenticated;`);
        assert.equal(await tablePrivileges('authenticated', 'notes_after'), 'select');
        assert.equal(await tablePrivileges('anon', 'notes_after'), 'none');
        assert.equal(await as('authenticated', 'select public.secret_after()'), 'secret');
        await assert.rejects(as('anon', 'select public.secret_after()'), /permission denied/);

        // A trigger function fires for a client session without an EXECUTE grant; a function used by
        // a column default needs one, as the migration header says.
        await sql(`
create function public.stamp_body_after() returns trigger language plpgsql as $$ begin new.body := new.body || ' (stamped)'; return new; end $$;
create trigger stamp_body before insert on public.notes_after for each row execute function public.stamp_body_after();
create function public.default_body_after() returns text language sql as $$ select 'default body'::text $$;
create table public.drafts_after (id bigint primary key, body text not null default public.default_body_after());
grant insert, select on public.notes_after, public.drafts_after to authenticated;`);
        assert.equal(await canExecute('authenticated', 'public.stamp_body_after()'), 'f');
        assert.equal(await as('authenticated', `insert into public.notes_after(body) values ('client') returning body`), 'client (stamped)');
        await assert.rejects(as('authenticated', 'insert into public.drafts_after(id) values (1)'), /permission denied for function default_body_after/);
        await sql('grant execute on function public.default_body_after() to authenticated;');
        assert.equal(await as('authenticated', 'insert into public.drafts_after(id) values (1) returning body'), 'default body');

        // Re-running the migration changes nothing.
        const defaults = `select string_agg(coalesce(n.nspname, '*') || ':' || d.defaclobjtype::text || ':' || d.defaclacl::text, ' ' order by 1)
            from pg_default_acl d left join pg_namespace n on n.oid = d.defaclnamespace where d.defaclrole = 'postgres'::regrole`;
        const once = await sql(defaults);
        await sql(migration);
        assert.equal(await sql(defaults), once);
        assert.match(once, /\*:f:\{postgres=X\/postgres\}/, 'the global function default is owner-only');
        assert.doesNotMatch(once, /anon=|authenticated=/, 'no default grants to client roles remain');

        console.log('Closed default privileges (DB-11): new tables, views, sequences and functions are owner + service_role only; explicit grants and earlier objects unchanged.');
    } finally {
        if (created) await docker(['rm', '-f', container]).catch(() => {});
    }
})().catch((error) => {
    console.error(error);
    process.exit(1);
});

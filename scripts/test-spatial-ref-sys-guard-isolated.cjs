// Access-control integration fixture for 20261117120000_spatial_ref_sys_read_only.
// A disposable PostgreSQL reproduces production: spatial_ref_sys owned by supabase_admin,
// every privilege granted to the API roles, no RLS. The real migration is applied by a
// non-owner role that only holds TRIGGER on the table, as `postgres` does in Supabase.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { POSTGRES_IMAGE } = require('./lib/isolated-postgres.cjs');
const { assertLiveFunctions } = require('./lib/live-schema.cjs');

const container = `kezek-srs-guard-${randomUUID()}`;
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
const sql = (input, user = 'postgres') => docker(['exec', '-i', container, 'psql', '-X', '-q', '-U', user, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], input);
// Every probe runs inside a transaction that is rolled back, so the fixture row survives.
const probe = (role, statement) => sql(`begin; set local role ${role}; ${statement}; rollback;`);
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

        await sql(`create role anon; create role authenticated; create role service_role;
            create role supabase_admin; create role migrator login;
            grant create on database postgres to migrator;
            grant anon, authenticated, service_role, supabase_admin to postgres;
            create table public.spatial_ref_sys(srid integer primary key, auth_name varchar(256), auth_srid integer,
                srtext varchar(2048), proj4text varchar(2048));
            alter table public.spatial_ref_sys owner to supabase_admin;
            insert into public.spatial_ref_sys values (4326, 'EPSG', 4326, 'GEOGCS["WGS 84"]', '+proj=longlat +datum=WGS84 +no_defs');
            set role supabase_admin;
            grant all on public.spatial_ref_sys to migrator, anon, authenticated, service_role;
            grant select on public.spatial_ref_sys to public;
            reset role;`);

        // The fixture reproduces the exposure: the anon key could delete SRID 4326.
        assert.equal(await probe('anon', 'delete from public.spatial_ref_sys where srid = 4326 returning srid'), '4326');
        assert.equal(await sql('select has_table_privilege(\'migrator\', \'public.spatial_ref_sys\', \'TRIGGER\') and not pg_has_role(\'migrator\', \'supabase_admin\', \'MEMBER\')'), 't');

        await sql(fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261117120000_spatial_ref_sys_read_only.sql'), 'utf8'), 'migrator');
        // migrator stands in for postgres, which runs migrations and so owns what they create in production.
        await sql('reassign owned by migrator to postgres');

        // API roles keep reading but can no longer change or empty the table.
        for (const role of ['anon', 'authenticated', 'service_role']) {
            assert.equal(await probe(role, 'select count(*) from public.spatial_ref_sys'), '1', `${role} select`);
            await assert.rejects(probe(role, 'delete from public.spatial_ref_sys where srid = 4326'), /spatial_ref_sys is read-only/, `${role} delete`);
            await assert.rejects(probe(role, 'update public.spatial_ref_sys set proj4text = \'\' where srid = 4326'), /spatial_ref_sys is read-only/, `${role} update`);
            await assert.rejects(probe(role, 'insert into public.spatial_ref_sys(srid) values (999999)'), /spatial_ref_sys is read-only/, `${role} insert`);
            await assert.rejects(probe(role, 'truncate public.spatial_ref_sys'), /spatial_ref_sys is read-only/, `${role} truncate`);
        }

        // Extension maintenance roles are unaffected.
        assert.equal(await probe('supabase_admin', 'update public.spatial_ref_sys set auth_name = auth_name where srid = 4326 returning srid'), '4326');
        assert.equal(await sql('begin; update public.spatial_ref_sys set auth_name = auth_name where srid = 4326 returning srid; rollback;'), '4326');
        assert.equal(await sql('select count(*) from public.spatial_ref_sys'), '1');

        await assertLiveFunctions(sql, { suite: 'test-spatial-ref-sys-guard-isolated.cjs' });
        console.log('spatial_ref_sys guard: ok');
    } finally {
        if (created) await docker(['rm', '--force', container]).catch(() => undefined);
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

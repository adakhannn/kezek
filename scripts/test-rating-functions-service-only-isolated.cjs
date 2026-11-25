// Access-control fixture for 20261119110000_rating_functions_service_only (ENG-122). A disposable
// PostgreSQL holds the nine rating functions as the prod baseline created them, under the production
// default grants, shows that the anon key can drive the recalculation over every row and any range of
// days, applies the real migration and checks that only the service role can still run them.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { POSTGRES_IMAGE } = require('./lib/isolated-postgres.cjs');
const { applyMigrationFunctionsWhereExist, assertLiveFunctions, SUPABASE_DEFAULT_PRIVILEGES } = require('./lib/live-schema.cjs');

const migrations = path.join(__dirname, '..', 'supabase', 'migrations');
const read = (file) => fs.readFileSync(path.join(migrations, file), 'utf8').replace(/\r/g, '');
const baseline = read('20261009110000_prod_baseline.sql');
// A function as the prod baseline creates it: the CREATE up to its ALTER FUNCTION ... OWNER.
function baselineFunction(name) {
    const marker = `CREATE OR REPLACE FUNCTION "public"."${name}"(`;
    const from = baseline.indexOf(marker);
    assert.ok(from >= 0 && baseline.indexOf(marker, from + 1) < 0, `${name}: expected one definition in the prod baseline`);
    const to = baseline.indexOf(`\nALTER FUNCTION "public"."${name}"(`, from);
    assert.ok(to > from, `${name}: no ALTER FUNCTION after its definition in the prod baseline`);
    return baseline.slice(from, to);
}

const functions = [
    'calculate_biz_day_metrics(uuid, date)',
    'calculate_biz_rating(uuid)',
    'calculate_branch_day_metrics(uuid, date)',
    'calculate_branch_rating(uuid)',
    'calculate_staff_day_metrics(uuid, date)',
    'calculate_staff_rating(uuid)',
    'initialize_all_ratings(integer)',
    'recalculate_ratings_for_date_range(date, date)',
    'update_all_aggregated_ratings()',
];

const container = `kezek-rating-acl-${randomUUID()}`;
const docker = (args, input = '') => new Promise((resolve, reject) => {
    const child = spawn('docker', args, { windowsHide: true });
    let out = '';
    let err = '';
    child.stdout.on('data', (data) => { out += data; });
    child.stderr.on('data', (data) => { err += data; });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve({ out: out.trim(), err }) : reject(new Error(err || out || `exit ${code}`))));
    child.stdin.end(input);
});
const run = (input) => docker(['exec', '-i', container, 'psql', '-X', '-q', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], input);
const sql = async (input) => (await run(input)).out;
const asRole = (role, body) => run(`set role ${role}; ${body}`);
let created = false;

(async () => {
    try {
        await docker(['run', '--detach', '--rm', '--network', 'none', '--tmpfs', '/var/lib/postgresql/data', '--name', container, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', POSTGRES_IMAGE]);
        created = true;
        let ready = false;
        for (let i = 0; i < 120; i += 1) {
            try {
                if ((await docker(['exec', container, 'cat', '/proc/1/comm'])).out === 'postgres') {
                    await docker(['exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres']);
                    ready = true;
                    break;
                }
            } catch { /* still starting */ }
            await new Promise((r) => setTimeout(r, 500));
        }
        assert.ok(ready, 'PostgreSQL did not start');

        // The functions get the grants the production baseline gave them (PUBLIC and every API role).
        // The loops read these tables; as in production, the API roles may select their rows.
        await sql(`create role anon; create role authenticated; create role service_role bypassrls;
            ${SUPABASE_DEFAULT_PRIVILEGES}
            create table public.businesses(id uuid primary key);
            create table public.branches(id uuid primary key, biz_id uuid not null);
            create table public.staff(id uuid primary key, biz_id uuid not null, branch_id uuid not null);
            grant select on public.businesses, public.branches, public.staff to anon, authenticated, service_role;
            -- As pg_dump restores them: the bodies name metric tables this fixture does not build.
            set check_function_bodies = off;
            ${functions.map((fn) => baselineFunction(fn.slice(0, fn.indexOf('(')))).join('\n')}
            insert into public.businesses values ('${randomUUID()}');
            insert into public.branches select gen_random_uuid(), id from public.businesses;
            insert into public.staff select gen_random_uuid(), b.biz_id, b.id from public.branches b cross join generate_series(1, 3);`);

        // Before: the anon key runs the whole-database loop over a range it chooses. Every inner
        // calculation fails (here on the missing metric tables, in production on RLS) and is caught,
        // so the call succeeds after one subtransaction per day and row.
        for (const fn of functions) {
            for (const role of ['anon', 'authenticated']) {
                assert.equal(await sql(`select has_function_privilege('${role}', 'public.${fn}', 'EXECUTE')`), 't', `before: ${role}: ${fn}`);
            }
        }
        const swallowed = (await asRole('anon', `select public.recalculate_ratings_for_date_range(date '2000-01-01', date '2000-01-10')`)).err;
        assert.equal((swallowed.match(/Error calculating (staff|branch|biz) metrics/g) ?? []).length, 10 * (3 + 1 + 1));

        await sql(read('20261119110000_rating_functions_service_only.sql'));

        // After: only the service role (and the owner, for recalculate_ratings_for_date) runs them.
        for (const fn of functions) {
            for (const role of ['anon', 'authenticated']) {
                assert.equal(await sql(`select has_function_privilege('${role}', 'public.${fn}', 'EXECUTE')`), 'f', `after: ${role}: ${fn}`);
            }
            assert.equal(await sql(`select has_function_privilege('service_role', 'public.${fn}', 'EXECUTE')`), 't', `after: service_role: ${fn}`);
        }
        await assert.rejects(asRole('anon', `select public.recalculate_ratings_for_date_range(date '2000-01-01', date '2100-01-01')`),
            /permission denied for function recalculate_ratings_for_date_range/);
        await assert.rejects(asRole('authenticated', 'select public.initialize_all_ratings(36500)'), /permission denied for function initialize_all_ratings/);
        await assert.rejects(asRole('authenticated', 'select public.update_all_aggregated_ratings()'), /permission denied for function update_all_aggregated_ratings/);
        // The service role keeps the loop: its nested calls need EXECUTE on the inner functions too.
        const served = (await asRole('service_role', `select public.recalculate_ratings_for_date_range(date '2000-01-01', date '2000-01-02')`)).err;
        assert.equal((served.match(/permission denied/g) ?? []).length, 0, served);
        assert.equal((served.match(/Error calculating (staff|branch|biz) metrics/g) ?? []).length, 2 * (3 + 1 + 1));

        // Re-running changes nothing.
        await sql(read('20261119110000_rating_functions_service_only.sql'));
        assert.equal(await sql(`select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace
            and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('authenticated', p.oid, 'EXECUTE'))`), '0');

        // The later business-day redefinition (ARCH-11) keeps the service-only grants.
        await applyMigrationFunctionsWhereExist(sql, '20261125100000_business_time_zone_days.sql');
        assert.equal(await sql(`select has_function_privilege('anon', 'public.calculate_staff_day_metrics(uuid,date)', 'EXECUTE')`), 'f');
        await assertLiveFunctions(sql, { suite: 'test-rating-functions-service-only-isolated.cjs' });
        console.log('rating functions are service-only: ok');
    } finally {
        if (created) await docker(['rm', '--force', container]).catch(() => undefined);
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

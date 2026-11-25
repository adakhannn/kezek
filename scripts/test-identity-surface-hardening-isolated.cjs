// Access-control integration fixture for 20261116120000_identity_and_auth_surface_hardening.
// A disposable PostgreSQL reproduces Supabase's default (over-broad) grants, then
// applies the real migration and checks the resulting boundary as each role.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { POSTGRES_IMAGE } = require('./lib/isolated-postgres.cjs');
const { applyMigrationFunctionsWhereExist, assertLiveFunctions, installLiveFunction, SUPABASE_DEFAULT_PRIVILEGES } = require('./lib/live-schema.cjs');

const migrations = path.join(__dirname, '..', 'supabase', 'migrations');
const read = (file) => fs.readFileSync(path.join(migrations, file), 'utf8').replace(/\r/g, '');
// One CREATE FUNCTION statement of an earlier migration, from its first line to its terminator.
function extract(file, start, end) {
    const text = read(file);
    const from = text.indexOf(start);
    assert.ok(from >= 0, `${start} not found in ${file}`);
    const to = text.indexOf(end, from);
    assert.ok(to > from, `${end} not found after ${start} in ${file}`);
    return text.slice(from, to + end.length);
}
const baseline = '20261009110000_prod_baseline.sql';

const container = `kezek-identity-surface-${randomUUID()}`;
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
const asRole = (role, id, body) =>
    sql(`set role ${role}; set request.jwt.claims='{"sub":"${id}","role":"${role}"}'; ${body}`);

const [user, other, client, branch, promo] = Array.from({ length: 5 }, () => randomUUID());
let created = false;

(async () => {
    try {
        await docker(['run', '--detach', '--rm', '--network', 'none', '--tmpfs', '/var/lib/postgresql/data', '--name', container, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', POSTGRES_IMAGE]);
        created = true;
        // The image first runs a temporary socket-only server for initialisation and
        // then restarts; it is ready only once postgres is PID 1 and accepts TCP.
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
        await sql(`create role anon; create role authenticated; create role service_role; create schema auth;
            ${SUPABASE_DEFAULT_PRIVILEGES}
            create function auth.uid() returns uuid language sql stable as $$ select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
            grant usage on schema auth to anon,authenticated,service_role;
            create table profiles(
                id uuid primary key, full_name text, phone text,
                notify_email boolean default true, notify_whatsapp boolean default true, notify_telegram boolean default true,
                whatsapp_phone text, whatsapp_verified boolean default false,
                telegram_id bigint, telegram_username text, telegram_photo_url text, telegram_verified boolean default false,
                yandex_id text, yandex_username text);
            alter table profiles enable row level security;
            create policy own_select on profiles for select using (auth.uid() = id);
            create policy own_update on profiles for update using (auth.uid() = id);
            create policy own_insert on profiles for insert with check (auth.uid() = id);
            create policy service_all on profiles to service_role using (true) with check (true);
            create table telegram_mobile_auth_attempts(id uuid primary key default gen_random_uuid(), nonce text, status text, user_id uuid, exchange_code text, expires_at timestamptz);
            create table frontend_metrics(id integer);
            alter table frontend_metrics enable row level security;
            create policy "Allow read access to frontend metrics" on frontend_metrics for select using (true);
            create table bookings(client_id uuid, branch_id uuid, status text, end_at timestamptz, id uuid primary key default gen_random_uuid());
            create table businesses(id uuid primary key, tz text);
            create table branch_promotions(id uuid primary key, branch_id uuid, biz_id uuid, promotion_type text, params jsonb default '{}',
                is_active boolean default true, valid_from date, valid_to date);
            create table client_referrals(referrer_id uuid, branch_id uuid, referrer_bonus_used boolean default false);
            -- The promotion helpers exactly as the production baseline defines them: SECURITY DEFINER, no search_path.
            ${extract(baseline, 'CREATE OR REPLACE FUNCTION "public"."get_client_visit_count"', '\n$$;')}
            ${extract(baseline, 'CREATE OR REPLACE FUNCTION "public"."can_use_promotion"', '\n$$;')}
            create function public.definer_link_whatsapp(p_phone text) returns void language plpgsql security definer set search_path=public as $$
                begin update profiles set whatsapp_phone = p_phone, whatsapp_verified = true where id = auth.uid(); end; $$;
            grant all on all tables in schema public to anon,authenticated,service_role;
            insert into profiles(id, full_name) values ('${user}', 'Original'), ('${other}', 'Other');
            insert into bookings values ('${client}', '${branch}', 'paid', now() - interval '1 day');
            -- Free 2nd visit: the client with one paid visit qualifies.
            insert into branch_promotions(id, branch_id, promotion_type, params) values ('${promo}', '${branch}', 'free_after_n_visits', '{"visit_count": 2}');
        `);

        // The fixture must reproduce every exposure before the migration runs.
        assert.equal(await sql(`select has_table_privilege('anon','telegram_mobile_auth_attempts','SELECT')`), 't');
        assert.equal(await asRole('authenticated', user, `update profiles set whatsapp_phone='+996555000111', whatsapp_verified=true where id='${user}' returning whatsapp_verified`), 't');
        await sql(`update profiles set whatsapp_phone=null, whatsapp_verified=false where id='${user}'`);
        assert.equal(await asRole('anon', user, `select get_client_visit_count('${client}','${branch}')`), '1');

        await sql(fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261116120000_identity_and_auth_surface_hardening.sql'), 'utf8'));

        // 1. Telegram mobile auth attempts: service role only.
        assert.equal(await sql(`select relrowsecurity from pg_class where oid='public.telegram_mobile_auth_attempts'::regclass`), 't');
        for (const role of ['anon', 'authenticated']) {
            assert.equal(await sql(`select has_table_privilege('${role}','telegram_mobile_auth_attempts','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')`), 'f', `${role} attempts`);
        }
        assert.equal(await sql(`select has_table_privilege('service_role','telegram_mobile_auth_attempts','SELECT,INSERT,UPDATE,DELETE')`), 't');

        // 2. Users keep editing ordinary fields but cannot claim identities.
        assert.equal(
            await asRole('authenticated', user, `update profiles set full_name='Renamed', notify_email=false, whatsapp_phone='+996555000111', whatsapp_verified=true, telegram_id=42, telegram_verified=true, yandex_id='y' where id='${user}' returning concat_ws('|', full_name, notify_email, coalesce(whatsapp_phone,'-'), whatsapp_verified, coalesce(telegram_id::text,'-'), telegram_verified, coalesce(yandex_id,'-'))`),
            'Renamed|f|-|f|-|f|-',
        );
        const newcomer = randomUUID();
        assert.equal(
            await asRole('authenticated', newcomer, `insert into profiles(id, full_name, whatsapp_phone, whatsapp_verified, telegram_id, telegram_verified) values ('${newcomer}', 'New', '+996555000222', true, 7, true) returning concat_ws('|', full_name, coalesce(whatsapp_phone,'-'), whatsapp_verified, coalesce(telegram_id::text,'-'), telegram_verified)`),
            'New|-|f|-|f',
        );

        // Privileged writers (service role, definer commands) are unaffected.
        await asRole('service_role', other, `update profiles set whatsapp_phone='+996555000333', whatsapp_verified=true, telegram_id=99, telegram_verified=true where id='${other}'`);
        assert.equal(await sql(`select concat_ws('|', whatsapp_phone, whatsapp_verified, telegram_id, telegram_verified) from profiles where id='${other}'`), '+996555000333|t|99|t');
        await asRole('authenticated', user, `select definer_link_whatsapp('+996555000444')`);
        assert.equal(await sql(`select concat_ws('|', whatsapp_phone, whatsapp_verified) from profiles where id='${user}'`), '+996555000444|t');

        // An upsert by the user (PostgREST on_conflict path) preserves verified identity.
        assert.equal(
            await asRole('authenticated', user, `insert into profiles(id, full_name, notify_whatsapp) values ('${user}', 'Upserted', false)
                on conflict (id) do update set full_name = excluded.full_name, notify_whatsapp = excluded.notify_whatsapp,
                    whatsapp_phone = excluded.whatsapp_phone, whatsapp_verified = excluded.whatsapp_verified
                returning concat_ws('|', full_name, notify_whatsapp, whatsapp_phone, whatsapp_verified)`),
            'Upserted|f|+996555000444|t',
        );

        // 3. Promotion helpers: no direct execution, fixed search_path, definer callers still work.
        for (const sig of ['get_client_visit_count(uuid,uuid)', 'can_use_promotion(uuid,uuid,uuid)']) {
            for (const role of ['anon', 'authenticated']) {
                assert.equal(await sql(`select has_function_privilege('${role}','public.${sig}','execute')`), 'f', `${role}: ${sig}`);
            }
            assert.equal(await sql(`select has_function_privilege('service_role','public.${sig}','execute')`), 't');
            assert.equal(await sql(`select array_to_string(proconfig, ',') from pg_proc where oid='public.${sig}'::regprocedure`), 'search_path=public, pg_temp');
        }
        await assert.rejects(asRole('authenticated', user, `select get_client_visit_count('${client}','${branch}')`), /permission denied/);
        // can_use_promotion (definer) still counts the paid visit through get_client_visit_count.
        assert.equal(await asRole('service_role', user, `select can_use_promotion('${client}','${branch}','${promo}')`), 't');

        // 3b. 20261119120000 (ENG-123): the helpers take the booking being priced and leave it out.
        // The old signatures are gone, the new ones keep the same access.
        await sql(fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261119120000_promotion_visits_exclude_priced_booking.sql'), 'utf8'));
        // The later business-day redefinition (ARCH-11): promotion validity is today of the business.
        await applyMigrationFunctionsWhereExist(sql, '20261125100000_business_time_zone_days.sql');
        // R25-04: the price of a booking comes from all its services (20261125140000).
        // The suite never runs it; install its live body (it calls private.booking_catalog_amount).
        await installLiveFunction(sql, 'public.apply_promotion_to_booking(uuid)');
        for (const sig of ['get_client_visit_count(uuid,uuid)', 'can_use_promotion(uuid,uuid,uuid)']) {
            assert.equal(await sql(`select to_regprocedure('public.${sig}') is null`), 't', `${sig} is dropped`);
        }
        for (const sig of ['get_client_visit_count(uuid,uuid,uuid)', 'can_use_promotion(uuid,uuid,uuid,uuid)']) {
            for (const role of ['anon', 'authenticated']) {
                assert.equal(await sql(`select has_function_privilege('${role}','public.${sig}','execute')`), 'f', `${role}: ${sig}`);
            }
            assert.equal(await sql(`select has_function_privilege('service_role','public.${sig}','execute')`), 't');
        }
        const paidVisit = await sql(`select id from bookings where client_id='${client}'`);
        // Another booking being priced: the paid visit counts, so it is the second visit and free.
        assert.equal(await asRole('service_role', user, `select can_use_promotion('${client}','${branch}','${promo}',gen_random_uuid())`), 't');
        // That paid visit being priced itself: it is the first visit, not the second.
        assert.equal(await asRole('service_role', user, `select get_client_visit_count('${client}','${branch}','${paidVisit}')`), '0');
        assert.equal(await asRole('service_role', user, `select can_use_promotion('${client}','${branch}','${promo}','${paidVisit}')`), 'f');

        // 4. Frontend metrics are no longer world-readable.
        for (const role of ['anon', 'authenticated']) {
            assert.equal(await sql(`select has_table_privilege('${role}','frontend_metrics','SELECT')`), 'f', `${role} metrics`);
        }
        assert.equal(await sql(`select count(*) from pg_policies where tablename='frontend_metrics' and policyname='Allow read access to frontend metrics'`), '0');

        await assertLiveFunctions(sql, { suite: 'test-identity-surface-hardening-isolated.cjs' });
        console.log('identity and auth surface hardening: ok');
    } finally {
        if (created) await docker(['rm', '--force', container]).catch(() => undefined);
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

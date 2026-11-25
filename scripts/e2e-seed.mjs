#!/usr/bin/env node
// Seeds the Playwright e2e fixture into a LOCAL Supabase stack and prints the E2E_* env values.
//
//   node scripts/e2e-seed.mjs                      # stack started from ./supabase (CI: pnpm db:start:check)
//   node scripts/e2e-seed.mjs --workdir <dir>      # stack started with `supabase start --workdir <dir>`
//   node scripts/e2e-seed.mjs >> "$GITHUB_ENV"     # CI: export the values to the next steps
//
// The output is KEY=VALUE lines on stdout (progress goes to stderr): the Supabase URL and keys of
// the local stack, the ids and slug of the seeded business, and the test accounts. It is idempotent:
// rows have fixed ids, accounts are created or have their password reset, re-running changes nothing
// except the dated shifts (a closed shift for yesterday is added when missing).
//
// Local only. The API URL must be localhost/127.0.0.1 and the production project is refused, so the
// fixture can never be written to a real project. The passwords below are LOCAL TEST VALUES: they
// exist only in the throwaway local GoTrue of `supabase start` and are not secrets.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PRODUCTION_PROJECT_REF = 'beulnmftzbmtbdlgurht';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/** LOCAL TEST PASSWORD — only for accounts in the disposable local GoTrue. */
export const LOCAL_E2E_PASSWORD = 'kezek-local-e2e-only-1';

// Fixed ids make the seed idempotent and let specs refer to rows directly.
export const IDS = {
    business: 'e2e00000-0000-4000-8000-000000000001',
    branch: 'e2e00000-0000-4000-8000-000000000011',
    serviceHaircut: 'e2e00000-0000-4000-8000-000000000021',
    serviceStyling: 'e2e00000-0000-4000-8000-000000000022',
    serviceColoring: 'e2e00000-0000-4000-8000-000000000023',
    staff: 'e2e00000-0000-4000-8000-000000000031',
    staffMulti: 'e2e00000-0000-4000-8000-000000000032',
    promotionFirstVisit: 'e2e00000-0000-4000-8000-000000000041',
    promotionFreeAfterN: 'e2e00000-0000-4000-8000-000000000042',
    promotionExpired: 'e2e00000-0000-4000-8000-000000000043',
    // Bookings of the multi-role master (the specs book the first master, "E2E Мастер").
    bookingPastAttend: 'e2e00000-0000-4000-8000-000000000051',
    bookingPastNoShow: 'e2e00000-0000-4000-8000-000000000052',
    bookingHold: 'e2e00000-0000-4000-8000-000000000053',
    bookingClientFuture: 'e2e00000-0000-4000-8000-000000000054',
    bookingToCancel: 'e2e00000-0000-4000-8000-000000000055',
    bookingPackageVisit: 'e2e00000-0000-4000-8000-000000000056',
    users: {
        owner: 'e2e00000-0000-4000-8000-0000000000a1',
        staff: 'e2e00000-0000-4000-8000-0000000000a2',
        client: 'e2e00000-0000-4000-8000-0000000000a3',
        superAdmin: 'e2e00000-0000-4000-8000-0000000000a4',
        multiRole: 'e2e00000-0000-4000-8000-0000000000a5',
    },
};

export const BUSINESS_SLUG = 'e2e-salon';

/** LOCAL TEST VALUE: the app verifies WhatsApp webhook signatures with it in the e2e stack only. */
export const LOCAL_WHATSAPP_APP_SECRET = 'kezek-local-e2e-whatsapp-secret';
/** LOCAL TEST VALUE: receiver id the webhook accepts; no message is ever sent from it. */
export const LOCAL_WHATSAPP_PHONE_NUMBER_ID = '100000000000001';

const USERS = [
    { key: 'owner', email: 'e2e-owner@kezek.test', fullName: 'E2E Владелец', phone: '+996700000001' },
    { key: 'staff', email: 'e2e-staff@kezek.test', fullName: 'E2E Мастер', phone: '+996700000002' },
    { key: 'client', email: 'e2e-client@kezek.test', fullName: 'E2E Клиент', phone: '+996700000003' },
    { key: 'superAdmin', email: 'e2e-admin@kezek.test', fullName: 'E2E Суперадмин', phone: '+996700000004' },
    { key: 'multiRole', email: 'e2e-multi@kezek.test', fullName: 'E2E Мульти', phone: '+996700000005' },
];

function parseArgs(argv) {
    const args = { workdir: null };
    for (let i = 0; i < argv.length; i += 1) {
        if (argv[i] === '--workdir') args.workdir = argv[++i];
        else if (argv[i] === '--help' || argv[i] === '-h') args.help = true;
        else throw new Error(`Unknown argument: ${argv[i]}`);
    }
    return args;
}

function log(message) {
    process.stderr.write(`[e2e-seed] ${message}\n`);
}

function supabaseBin() {
    const bin = path.join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'supabase.cmd' : 'supabase');
    return existsSync(bin) ? bin : 'supabase';
}

function readStackStatus(workdir) {
    const args = ['status', '-o', 'json'];
    if (workdir) args.push('--workdir', workdir);
    const result = spawnSync(supabaseBin(), args, {
        cwd: ROOT,
        encoding: 'utf8',
        shell: process.platform === 'win32',
    });
    if (result.status !== 0) {
        throw new Error(`supabase status failed (is the local stack running?):\n${result.stderr || result.stdout}`);
    }
    const start = result.stdout.indexOf('{');
    const end = result.stdout.lastIndexOf('}');
    if (start < 0 || end < start) throw new Error(`Unexpected supabase status output:\n${result.stdout}`);
    return JSON.parse(result.stdout.slice(start, end + 1));
}

function readProjectId(workdir) {
    const config = path.join(workdir ? path.resolve(workdir) : ROOT, 'supabase', 'config.toml');
    const match = /^project_id\s*=\s*"([^"]+)"/m.exec(readFileSync(config, 'utf8'));
    if (!match) throw new Error(`project_id not found in ${config}`);
    return match[1];
}

function assertLocal(url) {
    if (url.includes(PRODUCTION_PROJECT_REF)) throw new Error('The production project is never an e2e target.');
    const host = new URL(url).hostname.toLowerCase();
    if (!LOCAL_HOSTS.has(host)) throw new Error(`Refusing to seed a non-local Supabase API: ${url}`);
}

async function gotrue(apiUrl, serviceKey, method, route, body) {
    const response = await fetch(`${apiUrl}/auth/v1${route}`, {
        method,
        headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
}

async function ensureUser(apiUrl, serviceKey, user) {
    const id = IDS.users[user.key];
    const attributes = {
        email: user.email,
        password: LOCAL_E2E_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: user.fullName },
    };
    const existing = await gotrue(apiUrl, serviceKey, 'GET', `/admin/users/${id}`);
    if (existing.status === 200) {
        const updated = await gotrue(apiUrl, serviceKey, 'PUT', `/admin/users/${id}`, attributes);
        if (updated.status !== 200) throw new Error(`Updating ${user.email} failed: ${JSON.stringify(updated.body)}`);
        return;
    }
    const created = await gotrue(apiUrl, serviceKey, 'POST', '/admin/users', { id, ...attributes });
    if (created.status !== 200 && created.status !== 201) {
        throw new Error(`Creating ${user.email} failed (${created.status}): ${JSON.stringify(created.body)}`);
    }
}

function sqlLiteral(value) {
    return `'${String(value).replace(/'/g, "''")}'`;
}

function fixtureSql() {
    const u = IDS.users;
    const profiles = USERS.map(
        (user) =>
            `(${sqlLiteral(u[user.key])}, ${sqlLiteral(user.fullName)}, ${sqlLiteral(user.phone)})`,
    ).join(',\n    ');

    return `
\\set ON_ERROR_STOP on
begin;

insert into public.profiles (id, full_name, phone)
values
    ${profiles}
on conflict (id) do update set full_name = excluded.full_name, phone = excluded.phone;

insert into public.businesses (id, name, slug, tz, is_approved, owner_id, branch_limit, address, phones, contact_phone)
values ('${IDS.business}', 'E2E Салон', '${BUSINESS_SLUG}', 'Asia/Bishkek', true, '${u.owner}', 10,
        'Бишкек, ул. Тестовая, 1', '{+996700000100}', '+996700000100')
on conflict (id) do update set owner_id = excluded.owner_id, is_approved = true, branch_limit = 10;

insert into public.branches (id, biz_id, name, address, is_active, coords)
values ('${IDS.branch}', '${IDS.business}', 'E2E Филиал Центр', 'Бишкек, ул. Тестовая, 1', true, 'SRID=4326;POINT(74.5698 42.8746)')
on conflict (id) do nothing;

-- Branches the admin spec creates are removed again, so the business keeps one branch.
delete from public.branches where biz_id = '${IDS.business}' and id <> '${IDS.branch}';

insert into public.branch_working_hours (biz_id, branch_id, day_of_week, intervals, breaks)
select '${IDS.business}', '${IDS.branch}', d, '[{"start":"08:00","end":"22:00"}]'::jsonb, '[]'::jsonb
from generate_series(0, 6) as d
on conflict (biz_id, branch_id, day_of_week) do update set intervals = excluded.intervals, breaks = excluded.breaks;

insert into public.services (id, biz_id, branch_id, name_ru, name_en, duration_min, price_from, price_to, active)
values
    ('${IDS.serviceHaircut}', '${IDS.business}', '${IDS.branch}', 'Стрижка', 'Haircut', 30, 500, 500, true),
    ('${IDS.serviceStyling}', '${IDS.business}', '${IDS.branch}', 'Укладка', 'Styling', 30, 700, 700, true),
    ('${IDS.serviceColoring}', '${IDS.business}', '${IDS.branch}', 'Окрашивание', 'Coloring', 60, 1500, 1500, true)
on conflict (id) do nothing;

insert into public.staff (id, biz_id, branch_id, full_name, is_active, user_id, email, phone, percent_master, percent_salon, hourly_rate)
values
    ('${IDS.staff}', '${IDS.business}', '${IDS.branch}', 'E2E Мастер', true, '${u.staff}', 'e2e-staff@kezek.test', '+996700000002', 60, 40, 100),
    ('${IDS.staffMulti}', '${IDS.business}', '${IDS.branch}', 'E2E Мульти', true, '${u.multiRole}', 'e2e-multi@kezek.test', '+996700000005', 50, 50, null)
on conflict (id) do nothing;

-- Home-branch assignment, as staff creation writes it; bookings check it.
insert into public.staff_branch_assignments (biz_id, staff_id, branch_id, valid_from)
select '${IDS.business}', st.id, '${IDS.branch}', date '2026-01-01'
from public.staff st
where st.id in ('${IDS.staff}', '${IDS.staffMulti}')
  and not exists (select 1 from public.staff_branch_assignments a where a.staff_id = st.id);

insert into public.service_staff (service_id, staff_id, is_active)
select s.id, st.id, true
from public.services s
cross join public.staff st
where s.biz_id = '${IDS.business}' and st.id in ('${IDS.staff}', '${IDS.staffMulti}')
on conflict (service_id, staff_id) do nothing;

-- Weekly hours 08:00-22:00 every day in the legacy store, the model production runs
-- (SCHEDULE_V2_ENABLED off); the slot functions fall back to it without a published schedule.
insert into public.working_hours (biz_id, staff_id, day_of_week, intervals, breaks, exceptions)
select '${IDS.business}', st.id, d, '[{"start":"08:00","end":"22:00"}]'::jsonb, '[]'::jsonb, '[]'::jsonb
from public.staff st
cross join generate_series(0, 6) as d
where st.id in ('${IDS.staff}', '${IDS.staffMulti}')
  and not exists (select 1 from public.working_hours w where w.staff_id = st.id and w.day_of_week = d);

-- Roles: owner of the business, the multi-role account is also its manager (and a staff card above).
insert into public.user_roles (user_id, biz_id, role_id)
select x.user_id, '${IDS.business}'::uuid, r.id
from (values ('${u.owner}'::uuid, 'owner'), ('${u.multiRole}'::uuid, 'manager')) as x(user_id, role_key)
join public.roles r on r.key = x.role_key
on conflict (user_id, role_id, biz_key) do nothing;

insert into public.user_global_roles (user_id, role_id)
select '${u.superAdmin}', r.id from public.roles r where r.key = 'super_admin'
on conflict (user_id, role_id) do nothing;

-- Promotions shown on the public page and in the booking summary, and an ended (inactive) one.
insert into public.branch_promotions (id, branch_id, biz_id, promotion_type, params, title_ru, title_en, description_ru, is_active)
values
    ('${IDS.promotionFirstVisit}', '${IDS.branch}', '${IDS.business}', 'first_visit_discount',
     '{"discount_percent": 20}'::jsonb, 'Скидка 20% на первый визит', '20% off the first visit',
     'Скидка для новых клиентов', true),
    ('${IDS.promotionFreeAfterN}', '${IDS.branch}', '${IDS.business}', 'free_after_n_visits',
     '{"visit_count": 5}'::jsonb, 'Каждая 5-я услуга бесплатно', 'Every 5th visit free', null, true),
    ('${IDS.promotionExpired}', '${IDS.branch}', '${IDS.business}', 'birthday_discount',
     '{"discount_percent": 15}'::jsonb, 'E2E Завершённая акция', 'E2E Ended promotion', null, false)
on conflict (id) do nothing;

-- A closed shift yesterday (business time) with two clients, for the finance and hours pages.
-- Bookings (business time): past confirmed visits to mark (one of the client account, paid with the
-- visit package the specs sell), a hold to confirm, a future visit of the client account and one to
-- cancel. Re-seeding puts them back to these dates and statuses.
with d as (select (now() at time zone 'Asia/Bishkek')::date as today)
insert into public.bookings (id, biz_id, branch_id, service_id, staff_id, client_id, client_name, client_phone,
                             status, start_at, end_at, expires_at, source)
select x.id::uuid, '${IDS.business}', '${IDS.branch}', '${IDS.serviceHaircut}', '${IDS.staffMulti}',
       x.client_id::uuid, x.client_name, x.client_phone, x.status::public.booking_status,
       ((d.today + x.day_offset)::timestamp + x.at) at time zone 'Asia/Bishkek',
       ((d.today + x.day_offset)::timestamp + x.at + interval '30 minutes') at time zone 'Asia/Bishkek',
       null, 'dashboard'
from d
cross join (values
    ('${IDS.bookingPastAttend}', null, 'E2E Пришёл', '+996700000201', 'confirmed', -1, time '10:00'),
    ('${IDS.bookingPastNoShow}', null, 'E2E Неявка', '+996700000202', 'confirmed', -1, time '11:00'),
    ('${IDS.bookingHold}', null, 'E2E Ожидает', '+996700000203', 'hold', 1, time '15:00'),
    ('${IDS.bookingClientFuture}', '${u.client}', 'E2E Клиент', '+996700000003', 'confirmed', 1, time '12:00'),
    ('${IDS.bookingToCancel}', null, 'E2E Отмена', '+996700000205', 'confirmed', 1, time '16:00'),
    ('${IDS.bookingPackageVisit}', '${u.client}', 'E2E Клиент пакет', '+996700000003', 'confirmed', -1, time '12:00')
) as x(id, client_id, client_name, client_phone, status, day_offset, at)
on conflict (id) do update
   set status = excluded.status, start_at = excluded.start_at, end_at = excluded.end_at, expires_at = null,
       promotion_applied = null, subscription_applied = null;

-- Visit packages sold to the client account by earlier runs are removed (the spec sells one and
-- expects that one to pay the next visit).
delete from public.client_visit_packages where client_id = '${u.client}';

-- Future bookings left by earlier runs free their slots again (local re-runs on one stack).
update public.bookings
   set status = 'cancelled', expires_at = null
 where biz_id = '${IDS.business}'
   and start_at > now()
   and status in ('hold', 'confirmed')
   and id not in ('${IDS.bookingHold}', '${IDS.bookingClientFuture}', '${IDS.bookingToCancel}');

-- Items can only be written to an open shift by a finance actor, so the shift is written open as
-- the service role, gets its items and is then closed with the totals the close command computes
-- (60% of 3500 to the master; 9 h x 100 guaranteed is below the share, so no top-up).
do $$
declare
    v_day date := (now() at time zone 'Asia/Bishkek')::date - 1;
    v_shift uuid;
begin
    if exists (select 1 from public.staff_shifts where staff_id = '${IDS.staff}' and shift_date = v_day) then
        return;
    end if;
    perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
    insert into public.staff_shifts (staff_id, biz_id, branch_id, shift_date, opened_at, status,
                                     percent_master, percent_salon, hourly_rate)
    values ('${IDS.staff}', '${IDS.business}', '${IDS.branch}', v_day,
            (v_day::timestamp + time '09:00') at time zone 'Asia/Bishkek', 'open', 60, 40, 100)
    returning id into v_shift;
    insert into public.staff_shift_items (shift_id, client_name, service_name, service_amount)
    values (v_shift, 'E2E Клиент смены 1', 'Стрижка', 1500),
           (v_shift, 'E2E Клиент смены 2', 'Окрашивание', 2000);
    update public.staff_shifts
       set status = 'closed',
           closed_at = (v_day::timestamp + time '18:00') at time zone 'Asia/Bishkek',
           total_amount = 3500, master_share = 2100, salon_share = 1400,
           hours_worked = 9, guaranteed_amount = 900, topup_amount = 0
     where id = v_shift;
    perform set_config('request.jwt.claims', '', true);
end;
$$;

commit;
`;
}

function runSql(projectId, sql) {
    const container = `supabase_db_${projectId}`;
    execFileSync('docker', ['exec', '-i', container, 'psql', '-q', '-U', 'postgres', '-d', 'postgres'], {
        input: sql,
        stdio: ['pipe', 'inherit', 'inherit'],
    });
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        process.stdout.write('Usage: node scripts/e2e-seed.mjs [--workdir <dir>]\n');
        return;
    }
    const status = readStackStatus(args.workdir);
    const apiUrl = status.API_URL;
    const anonKey = status.ANON_KEY;
    const serviceKey = status.SERVICE_ROLE_KEY;
    if (!apiUrl || !anonKey || !serviceKey) throw new Error('supabase status did not report API_URL, ANON_KEY and SERVICE_ROLE_KEY');
    assertLocal(apiUrl);

    log(`seeding accounts in ${apiUrl}`);
    for (const user of USERS) await ensureUser(apiUrl, serviceKey, user);

    const projectId = readProjectId(args.workdir);
    log(`seeding fixture rows in supabase_db_${projectId}`);
    runSql(projectId, fixtureSql());

    const email = Object.fromEntries(USERS.map((user) => [user.key, user.email]));
    const values = {
        NEXT_PUBLIC_SUPABASE_URL: apiUrl,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
        SUPABASE_SERVICE_ROLE_KEY: serviceKey,
        WHATSAPP_APP_SECRET: LOCAL_WHATSAPP_APP_SECRET,
        WHATSAPP_PHONE_NUMBER_ID: LOCAL_WHATSAPP_PHONE_NUMBER_ID,
        E2E_TEST_PASSWORD: LOCAL_E2E_PASSWORD,
        E2E_TEST_BUSINESS_SLUG: BUSINESS_SLUG,
        E2E_TEST_BUSINESS_ID: IDS.business,
        E2E_TEST_BRANCH_ID: IDS.branch,
        E2E_TEST_STAFF_ID: IDS.staff,
        E2E_TEST_MANAGER_EMAIL: email.owner,
        E2E_TEST_STAFF_EMAIL: email.staff,
        E2E_TEST_STAFF_PASSWORD: LOCAL_E2E_PASSWORD,
        E2E_TEST_CLIENT_EMAIL: email.client,
        E2E_TEST_CLIENT_SEARCH: email.client,
        E2E_TEST_SUPER_ADMIN_EMAIL: email.superAdmin,
        E2E_TEST_SUPERADMIN_EMAIL: email.superAdmin,
        E2E_TEST_MULTI_ROLE_EMAIL: email.multiRole,
    };
    for (const [key, value] of Object.entries(values)) process.stdout.write(`${key}=${value}\n`);
    log('done');
}

main().catch((error) => {
    process.stderr.write(`[e2e-seed] ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
});

// Disposable PostgreSQL 17 in Docker only (no network, no project data): the public booking receipt
// as production has it. booking_receipt_public comes from the prod baseline (definition, owner and
// grants, created under its default privileges; no later migration changes it) and reads the
// baseline tables, each with row level security. The receipt UUID is the capability: anon gets the
// ordered localized composition and durations or the single-service fallback and no client field,
// an unknown UUID discloses nothing, and reading bookings directly returns no row.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { POSTGRES_IMAGE } from './lib/isolated-postgres.cjs';
import { assertLiveFunctions, SUPABASE_DEFAULT_PRIVILEGES } from './lib/live-schema.cjs';

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
// A table as the prod baseline creates it, with row level security (the receipt needs neither its
// keys, indexes and triggers nor the tables they reference).
const baselineTable = (name) => `${baselineStatement(`CREATE TABLE IF NOT EXISTS "public"."${name}" (`, '\n);\n')}
${baselineStatement(`ALTER TABLE "public"."${name}" ENABLE ROW LEVEL SECURITY;`, ';')}`;

const container = `kezek-booking-receipt-${randomUUID()}`;
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
const asAnon = (statement) => sql(`set role anon; ${statement};`);
const receipt = async (booking) => JSON.parse(await asAnon(`select row_to_json(r) from public.booking_receipt_public('${booking}') r`));

const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const biz = id(10);
const branch = id(11);
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
        await new Promise((r) => setTimeout(r, 500));
    }
    assert.ok(ready, 'PostgreSQL did not start');

    await sql(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
${SUPABASE_DEFAULT_PRIVILEGES}
${baselineStatement('CREATE TYPE "public"."booking_status" AS ENUM (', '\n);\n')}
${['services', 'staff', 'bookings', 'booking_services'].map(baselineTable).join('\n')}
-- As in production, client roles may SELECT bookings and RLS decides the rows: no policy admits anon
-- (20261110123000_service_only_booking_commands revoked only the writes of the baseline grants).
grant select on public.bookings to anon, authenticated;
insert into public.services(id, biz_id, branch_id, name_ru, name_ky, name_en, duration_min, price_from, price_to)
    values ('${id(1)}', '${biz}', '${branch}', 'Первая', 'Биринчи', 'First', 60, 0, 0),
           ('${id(2)}', '${biz}', '${branch}', 'Вторая', 'Экинчи', 'Second', 1, 0, 0);
insert into public.staff(id, biz_id, branch_id, full_name) values ('${id(3)}', '${biz}', '${branch}', 'Test staff');
insert into public.bookings(id, biz_id, branch_id, service_id, staff_id, status, start_at, end_at, client_phone)
    values ('${id(4)}', '${biz}', '${branch}', '${id(1)}', '${id(3)}', 'confirmed', '2099-01-05T09:00:00+06:00', '2099-01-05T10:01:00+06:00', 'PRIVATE'),
           ('${id(5)}', '${biz}', '${branch}', '${id(1)}', '${id(3)}', 'cancelled', '2099-01-05T11:00:00+06:00', '2099-01-05T12:00:00+06:00', 'PRIVATE');
insert into public.booking_services(booking_id, service_id, duration_min, order_index)
    values ('${id(4)}', '${id(2)}', 1, 1), ('${id(4)}', '${id(1)}', 60, 0);
${baselineFunction('booking_receipt_public')}`);

    const composed = await receipt(id(4));
    assert.equal(composed.status, 'confirmed');
    assert.deepEqual(composed.services.map((s) => [s.name_en, s.duration_min]), [['First', 60], ['Second', 1]]);
    assert.deepEqual(Object.keys(composed), ['id', 'status', 'start_at', 'end_at', 'staff_name', 'services']);
    const single = await receipt(id(5));
    assert.equal(single.status, 'cancelled');
    assert.equal(single.services.length, 1);
    assert.equal(single.services[0].duration_min, 60);
    assert.equal(await asAnon(`select count(*) from public.booking_receipt_public('${id(99)}')`), '0');
    // The bookings and their client phones exist, but anon reads none of them directly.
    assert.equal(await sql('select count(*) from public.bookings'), '2');
    assert.equal(await asAnon('select count(*) from public.bookings'), '0', 'RLS hides every booking from anon');
    assert.equal(await sql("select has_function_privilege('anon', 'public.booking_receipt_public(uuid)', 'execute')"), 't');

    await assertLiveFunctions(sql, { suite: 'test-public-booking-receipt.mjs' });
    console.log('PASS: anon exact UUID receipt returns ordered localized composition/durations and single-service fallback; no private fields, unknown booking disclosure or direct booking read');
} finally {
    if (created) await docker(['rm', '-f', container]).catch(() => {});
}

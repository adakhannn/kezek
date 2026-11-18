// Integration fixture for 20261118160000_review_write_rules. A disposable PostgreSQL loads the
// production review functions, trigger and policies from the baseline, shows a review for a
// visit that never happened and a review moved to another booking, applies the real migration
// and checks who may create, edit and delete reviews.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { POSTGRES_IMAGE } = require('./lib/isolated-postgres.cjs');

const migrations = path.join(__dirname, '..', 'supabase', 'migrations');
const read = (file) => fs.readFileSync(path.join(migrations, file), 'utf8').replace(/\r/g, '');
function extract(file, start, end) {
    const text = read(file);
    const from = text.indexOf(start);
    assert.ok(from >= 0, `${start} not found in ${file}`);
    const to = text.indexOf(end, from);
    assert.ok(to > from, `${end} not found after ${start}`);
    return text.slice(from, to + end.length);
}
const baseline = '20261009110000_prod_baseline.sql';

const container = `kezek-review-rules-${randomUUID()}`;
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
    sql(`set role ${role}; set request.jwt.claims='{"sub":"${id ?? ''}","role":"${role}"}'; ${body}`);

const [client, other, owner] = [randomUUID(), randomUUID(), randomUUID()];
const [biz, staff] = [randomUUID(), randomUUID()];
const [paid, paid2, future, cancelled, noShow, othersPaid] = Array.from({ length: 6 }, () => randomUUID());
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
            create function auth.uid() returns uuid language sql stable as $$ select nullif(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub','')::uuid $$;
            grant usage on schema auth to anon, authenticated, service_role;
            grant usage on schema public to anon, authenticated, service_role;
            create type public.booking_status as enum ('hold', 'confirmed', 'paid', 'cancelled', 'no_show');
            create table public.businesses(id uuid primary key, owner_id uuid);
            create table public.staff(id uuid primary key, biz_id uuid);
            create table public.bookings(id uuid primary key, client_id uuid, staff_id uuid, status public.booking_status,
                start_at timestamptz, end_at timestamptz);
            create table public.reviews(id uuid primary key default gen_random_uuid(),
                booking_id uuid not null unique references public.bookings(id) on delete cascade, client_id uuid,
                rating smallint check (rating >= 1 and rating <= 5), comment text,
                created_at timestamptz default now(), updated_at timestamptz default now());
            grant select on public.businesses, public.staff, public.bookings to anon, authenticated;
            grant all on public.reviews to anon, authenticated, service_role;
            insert into public.businesses values ('${biz}', '${owner}');
            insert into public.staff values ('${staff}', '${biz}');
            insert into public.bookings values
                ('${paid}', '${client}', '${staff}', 'paid', now() - interval '2 days', now() - interval '2 days' + interval '1 hour'),
                ('${paid2}', '${client}', '${staff}', 'paid', now() - interval '1 day', now() - interval '1 day' + interval '1 hour'),
                ('${future}', '${client}', '${staff}', 'confirmed', now() + interval '2 days', now() + interval '2 days 1 hour'),
                ('${cancelled}', '${client}', '${staff}', 'cancelled', now() - interval '3 days', now() - interval '3 days' + interval '1 hour'),
                ('${noShow}', '${client}', '${staff}', 'no_show', now() - interval '4 days', now() - interval '4 days' + interval '1 hour'),
                ('${othersPaid}', '${other}', '${staff}', 'paid', now() - interval '1 day', now() - interval '1 day' + interval '1 hour');`);

        // Production review objects, from the baseline.
        await sql([
            extract(baseline, 'CREATE OR REPLACE FUNCTION "public"."can_edit_review"', '\n$$;'),
            extract(baseline, 'CREATE OR REPLACE FUNCTION "public"."can_review"', '\n$$;'),
            extract(baseline, 'CREATE OR REPLACE FUNCTION "public"."reviews_set_client_id"', '\n$$;'),
            extract(baseline, 'CREATE OR REPLACE TRIGGER "trg_reviews_set_client_id"', ';\n'),
            'alter table public.reviews enable row level security;',
            ...['CREATE POLICY "Users can insert own reviews"', 'CREATE POLICY "Users can select own reviews"',
                'CREATE POLICY "Users can update own reviews"', 'CREATE POLICY "reviews_delete_self"',
                'CREATE POLICY "reviews_insert_self"', 'CREATE POLICY "reviews_select_self"',
                'CREATE POLICY "reviews_update_self"'].map((start) => extract(baseline, start, ';\n')),
        ].join('\n'));

        // Exposures before the migration.
        assert.match(await asRole('authenticated', client, `insert into public.reviews(booking_id, rating) values ('${future}', 5) returning 'inserted'`),
            /inserted/, 'DB-13: a review for a visit that has not happened');
        assert.equal(await asRole('authenticated', client, `update public.reviews set booking_id = '${othersPaid}' where booking_id = '${future}' returning 'moved'`),
            'moved', 'DB-13: a review moved to another booking');
        await sql('delete from public.reviews');

        await sql(read('20261118160000_review_write_rules.sql'));

        const rls = /row-level security|permission denied/;
        // Create: only an own paid visit that has started; server-set author and creation time.
        for (const booking of [future, cancelled, noShow, othersPaid]) {
            await assert.rejects(asRole('authenticated', client, `insert into public.reviews(booking_id, rating) values ('${booking}', 5)`), rls, booking);
        }
        assert.equal(await asRole('authenticated', client, `insert into public.reviews(booking_id, rating, client_id, created_at)
            values ('${paid}', 5, '${other}', '2999-01-01') returning (client_id = '${client}')::text || ',' || (created_at <= now())::text`), 'true,true');
        await assert.rejects(asRole('anon', null, `insert into public.reviews(booking_id, rating) values ('${paid2}', 5)`), /permission denied/);

        // Edit: the author changes rating and comment, also long after posting; nothing else.
        await sql(`update public.reviews set created_at = now() - interval '200 days' where booking_id = '${paid}'`);
        assert.equal(await asRole('authenticated', client, `update public.reviews set rating = 4, comment = 'ok' where booking_id = '${paid}' returning rating::text`), '4');
        await assert.rejects(asRole('authenticated', client, `update public.reviews set booking_id = '${paid2}' where booking_id = '${paid}'`), /REVIEW_FIELD_READ_ONLY/);
        await assert.rejects(asRole('authenticated', client, `update public.reviews set created_at = now() where booking_id = '${paid}'`), /REVIEW_FIELD_READ_ONLY/);
        await assert.rejects(asRole('authenticated', client, `update public.reviews set client_id = '${other}' where booking_id = '${paid}'`), /REVIEW_FIELD_READ_ONLY|row-level security/);
        assert.equal(await asRole('authenticated', other, `update public.reviews set rating = 1 where booking_id = '${paid}' returning 'changed'`), '');

        // Delete: not by clients.
        await assert.rejects(asRole('authenticated', client, `delete from public.reviews where booking_id = '${paid}'`), /permission denied/);

        // Reads are unchanged: the author and the business owner see the review.
        assert.equal(await asRole('authenticated', client, 'select count(*) from public.reviews'), '1');
        assert.equal(await asRole('authenticated', owner, 'select count(*) from public.reviews'), '1');
        assert.equal(await asRole('authenticated', other, 'select count(*) from public.reviews'), '0');

        // The service role and definer commands stay unrestricted.
        assert.equal(await asRole('service_role', null, `update public.reviews set booking_id = '${paid2}' where booking_id = '${paid}' returning 'moved'`), 'moved');

        assert.equal(await sql(`select string_agg(policyname || ':' || cmd, ',' order by policyname collate "C") from pg_policies where tablename = 'reviews'`),
            'Users can select own reviews:SELECT,reviews_insert_self:INSERT,reviews_select_self:SELECT,reviews_update_self:UPDATE');

        console.log('review write rules: ok');
    } finally {
        if (created) await docker(['rm', '--force', container]).catch(() => undefined);
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

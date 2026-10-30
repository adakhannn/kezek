// Disposable PostgreSQL only; never connects to Supabase or uses credentials.
// node scripts/test-simple-schedule-booking-writer.mjs <pglite/dist/index.js>
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { setupScheduleFixture, id, biz, branch, branch2, staff, owner } from './lib/explicit-schedule-fixture.mjs';
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
await setupScheduleFixture(db);
await db.exec(`
create table auth.users(id uuid primary key,email text,phone text,raw_user_meta_data jsonb);
create table profiles(id uuid primary key,full_name text,phone text);
insert into auth.users values('${owner}','test@example.invalid',null,'{"full_name":"LIVE TEST"}');
`);
const day = { intervals: [{ start: '09:00', end: '18:00' }], breaks: [{ start: '13:00', end: '14:00' }] };
const week = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [i + 1, day]));
await db.query('select publish_staff_schedule($1,$2,$3,0,$4,$5,$6,$7)', [staff, biz, owner, 'week', '2099-01-05', branch, week]);
await db.query('select publish_staff_schedule($1,$2,$3,1,$4,$5,$6,$7)', [staff, biz, owner, 'day', '2099-01-07', branch2, { day }]);
await db.query('insert into services values($1,$2,$3,60,true)', [id(9), biz, branch2]);
const reserve = (date, time, location = branch2, business = biz) => db.query(
    'select hold_slot($1,$2,$3,$4,$5) as booking', [business, location, id(9), staff, `${date}T${time}:00+06:00`]);
await db.exec(await readFile(new URL('../supabase/migrations/20260206000001_fix_hold_slot_handle_missing_profile.sql', import.meta.url), 'utf8'));
await assert.rejects(reserve('2099-01-07', '12:00'), /staff not found or inactive/);
await db.exec(await readFile(new URL('../supabase/migrations/20261009103000_simple_booking_effective_schedule.sql', import.meta.url), 'utf8'));
const booking = (await reserve('2099-01-07', '12:00')).rows[0].booking;
assert.ok(booking);
const saved = (await db.query('select * from bookings where id=$1', [booking])).rows[0];
assert.equal(saved.branch_id, branch2);
assert.equal(saved.client_id, owner);
assert.equal(saved.status, 'confirmed');
assert.equal(saved.client_name, 'LIVE TEST');
assert.equal(saved.expires_at, null);
assert.equal((await db.query('select branch_id from staff where id=$1', [staff])).rows[0].branch_id, branch);
await assert.rejects(reserve('2099-01-07', '12:00'), /already booked|SCHEDULE_SLOT_TAKEN/);
await assert.rejects(reserve('2099-01-07', '13:00'), /SCHEDULE_OUTSIDE_WORKING_HOURS/);
await assert.rejects(reserve('2099-01-07', '14:00', branch), /SCHEDULE_OUTSIDE_WORKING_HOURS/);
await reserve('2099-01-07', '14:00');
await reserve('2099-01-05', '09:00', branch);
await db.query('insert into staff_time_off(staff_id,biz_id,date_from,date_to) values($1,$2,$3,$3)', [staff, biz, '2099-01-08']);
await assert.rejects(reserve('2099-01-08', '09:00', branch), /SCHEDULE_OUTSIDE_WORKING_HOURS/);
await assert.rejects(reserve('2099-01-07', '15:00', branch2, id(99)), /service not found or inactive/);
await db.query('update staff set is_active=false where id=$1', [staff]);
await assert.rejects(reserve('2099-01-07', '15:00'), /staff not found or inactive/);
await db.exec('create or replace function auth.uid() returns uuid language sql as $$ select null::uuid $$');
await assert.rejects(reserve('2099-01-07', '15:00'), /User must be authenticated/);
assert.equal((await db.query('select count(*)::int n from bookings')).rows[0].n, 3);
await db.close();
console.log('PASS: old writer reproduced transfer rejection; new writer supports effective branch, exact break boundary, regular day, identity/contact contract and rejects overlap, break, wrong branch, absence, foreign business, inactive staff and anonymous caller');

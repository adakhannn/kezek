// Disposable Docker PostgreSQL only (lib/explicit-schedule-postgres.mjs). No Supabase credentials or external database.
// node scripts/test-complex-booking-identity.mjs
import assert from 'node:assert/strict';
import { assertLiveFunctions } from './lib/live-schema.cjs';
import { rowsClient, withSchedulePostgres } from './lib/explicit-schedule-postgres.mjs';
import { setupScheduleFixture, id, biz, branch, staff, owner } from './lib/explicit-schedule-fixture.mjs';
await withSchedulePostgres('kezek-complex-booking-identity', async (sql) => {
const db = rowsClient(sql);
await setupScheduleFixture(sql, { bookingWriters: true });
await db.query('insert into auth.users(id,email) values($1,$2)', [owner, 'owner@example.invalid']);
await db.query('insert into profiles(id,full_name,phone) values($1,$2,$3)', [owner, 'LIVE TEST', 'test-phone']);
const day = { intervals: [{ start: '09:00', end: '18:00' }], breaks: [{ start: '13:00', end: '14:00' }] };
const week = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [i + 1, day]));
await db.query('select publish_staff_schedule($1,$2,$3,0,$4,$5,$6,$7)', [staff, biz, owner, 'week', '2099-01-05', branch, week]);
await db.query("insert into services(id,biz_id,branch_id,name_ru,duration_min) values($1,$2,$3,'Cut',60),($4,$2,$3,'Finish',1)", [id(9), biz, branch, id(10)]);
const services = [{ service_id: id(9), duration_min: 60, order_index: 0 }, { service_id: id(10), duration_min: 1, order_index: 1 }];
// hold_complex_slot books for the subject of the request's JWT claims (auth.uid()); null actor: no claims.
const reserve = (time, items = services, actor = owner) => db.query('select hold_complex_slot($1,$2,$3,$4,$5) as booking',
    [biz, branch, staff, `2099-01-05T${time}:00+06:00`, items], actor ? `set request.jwt.claims to '${JSON.stringify({ sub: actor })}';` : '');
const booking = (await reserve('09:00')).rows[0].booking;
const saved = (await db.query('select *,extract(epoch from(end_at-start_at))/60 as minutes from bookings where id=$1', [booking])).rows[0];
assert.equal(saved.client_id, owner);
assert.equal(saved.client_name, 'LIVE TEST');
assert.equal(saved.client_phone, 'test-phone');
assert.equal(saved.client_email, 'owner@example.invalid');
assert.equal(saved.status, 'hold');
assert.ok(saved.expires_at);
assert.equal(Number(saved.minutes), 61);
assert.deepEqual((await db.query('select service_id,duration_min,order_index from booking_services where booking_id=$1 order by order_index', [booking])).rows, services);
await assert.rejects(reserve('10:00'), /already booked|SCHEDULE_SLOT_TAKEN/);
await assert.rejects(reserve('12:00'), /SCHEDULE_OUTSIDE_WORKING_HOURS/);
await assert.rejects(reserve('15:00', [{service_id:id(99),duration_min:30}]), /service not found/);
// 20261118100000: an empty composition is an invalid request (SQLSTATE 22023, answered with 400).
await assert.rejects(reserve('15:00', []), /INVALID_BOOKING_REQUEST/);
await assert.rejects(reserve('15:00', services, null), /User must be authenticated/);
assert.equal((await db.query('select count(*)::int n from bookings')).rows[0].n, 1);
await assertLiveFunctions(sql, { suite: 'test-complex-booking-identity.mjs' });
});
console.log('PASS: authenticated identity email, profile contacts, 61-minute composition/ordered services/hold expiry preserved; overlap, break, foreign service, empty composition and anonymous caller rejected');

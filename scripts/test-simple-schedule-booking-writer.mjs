// Disposable Docker PostgreSQL only (lib/explicit-schedule-postgres.mjs); never connects to Supabase or uses credentials.
// node scripts/test-simple-schedule-booking-writer.mjs
import assert from 'node:assert/strict';
import { assertLiveFunctions } from './lib/live-schema.cjs';
import { rowsClient, withSchedulePostgres } from './lib/explicit-schedule-postgres.mjs';
import { setupScheduleFixture, id, biz, branch, branch2, staff, owner } from './lib/explicit-schedule-fixture.mjs';
await withSchedulePostgres('kezek-simple-booking-writer', async (sql) => {
const db = rowsClient(sql);
await setupScheduleFixture(sql, { bookingWriters: true });
await db.query('insert into auth.users(id,email,phone,raw_user_meta_data) values($1,$2,null,$3)', [owner, 'test@example.invalid', { full_name: 'LIVE TEST' }]);
const day = { intervals: [{ start: '09:00', end: '18:00' }], breaks: [{ start: '13:00', end: '14:00' }] };
const week = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [i + 1, day]));
await db.query('select publish_staff_schedule($1,$2,$3,0,$4,$5,$6,$7)', [staff, biz, owner, 'week', '2099-01-05', branch, week]);
await db.query('select publish_staff_schedule($1,$2,$3,1,$4,$5,$6,$7)', [staff, biz, owner, 'day', '2099-01-07', branch2, { day }]);
// 20261118100000: a hold books the booked branch's own service, so each branch has its 60-minute service.
await db.query("insert into services(id,biz_id,branch_id,name_ru,duration_min) values($1,$2,$3,'Cut',60),($4,$2,$5,'Cut',60)", [id(9), biz, branch2, id(19), branch]);
const serviceOf = (location) => (location === branch ? id(19) : id(9));
// hold_slot books for the subject of the request's JWT claims (auth.uid()); null actor: no claims.
const reserve = (date, time, location = branch2, business = biz, service = serviceOf(location), actor = owner) => db.query(
    'select hold_slot($1,$2,$3,$4,$5) as booking', [business, location, service, staff, `${date}T${time}:00+06:00`],
    actor ? `set request.jwt.claims to '${JSON.stringify({ sub: actor })}';` : '');
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
// 20261118100000: the service of another branch is refused before the schedule is consulted.
await assert.rejects(reserve('2099-01-07', '14:00', branch, biz, id(9)), /service not found or inactive/);
await assert.rejects(reserve('2099-01-07', '14:00', branch), /SCHEDULE_OUTSIDE_WORKING_HOURS/);
await reserve('2099-01-07', '14:00');
await reserve('2099-01-05', '09:00', branch);
await db.query('insert into staff_time_off(staff_id,biz_id,date_from,date_to) values($1,$2,$3,$3)', [staff, biz, '2099-01-08']);
await assert.rejects(reserve('2099-01-08', '09:00', branch), /SCHEDULE_OUTSIDE_WORKING_HOURS/);
await assert.rejects(reserve('2099-01-07', '15:00', branch2, id(99)), /service not found or inactive/);
await db.query('update staff set is_active=false where id=$1', [staff]);
await assert.rejects(reserve('2099-01-07', '15:00'), /staff not found or inactive/);
await assert.rejects(reserve('2099-01-07', '15:00', branch2, biz, id(9), null), /User must be authenticated/);
assert.equal((await db.query('select count(*)::int n from bookings')).rows[0].n, 3);
await assertLiveFunctions(sql, { suite: 'test-simple-schedule-booking-writer.mjs' });
});
console.log('PASS: live writer supports effective branch, exact break boundary, regular day, identity/contact contract and rejects overlap, break, wrong branch, service of another branch, absence, foreign business, inactive staff and anonymous caller');

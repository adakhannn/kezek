import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { setupScheduleFixture, staff, biz, branch, owner } from './lib/explicit-schedule-fixture.mjs';

const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
await setupScheduleFixture(db);
const day = { intervals: [{ start: '09:00', end: '18:00' }], breaks: [] };
const week = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [i + 1, day]));
await db.query('select publish_staff_schedule($1,$2,$3,$4,$5,$6,$7,$8)', [staff,biz,owner,0,'week','2099-01-01',branch,week]);

const insert = () => db.query("insert into staff_time_off(staff_id,biz_id,date_from,date_to,created_by) values($1,$2,'2099-01-05','2099-01-07',$3) returning id",[staff,biz,owner]);
const absence = (date='2099-01-05') => db.query('select schedule_effective_day($1,$2) d',[staff,date]);
const created = (await insert()).rows[0].id;
assert.equal((await absence()).rows[0].d.source,'absence');
assert.equal((await absence('2099-01-07')).rows[0].d.source,'absence');
await assert.rejects(db.query("insert into staff_time_off(staff_id,biz_id,date_from,date_to) values($1,$2,'2099-01-07','2099-01-08')",[staff,biz]),/SCHEDULE_ABSENCE_OVERLAP/);
await assert.rejects(db.query("update staff_time_off set date_to='2099-01-08' where id=$1",[created]),/SCHEDULE_INVALID/);
await db.query('update staff_time_off set cancelled_at=now(),cancelled_by=$2 where id=$1',[created,owner]);
assert.equal((await absence()).rows[0].d.source,'week');
assert.equal((await db.query('select count(*)::int n from staff_time_off where id=$1',[created])).rows[0].n,1);
await assert.rejects(db.query('update staff_time_off set cancelled_at=null where id=$1',[created]),/SCHEDULE_INVALID/);
await db.query("insert into bookings(staff_id,biz_id,branch_id,start_at,end_at,status) values($1,$2,$3,'2099-01-05 09:00+06','2099-01-05 10:00+06','confirmed')",[staff,biz,branch]);
await assert.rejects(insert(),/SCHEDULE_BOOKING_CONFLICT/);
await db.close();
console.log('PASS: absence overrides schedule, overlap and booking conflict blocked, immutable cancellation restores schedule, history kept');

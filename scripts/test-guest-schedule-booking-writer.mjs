// Disposable Docker PostgreSQL only (lib/explicit-schedule-postgres.mjs); no external connections or credentials.
// node scripts/test-guest-schedule-booking-writer.mjs
import assert from 'node:assert/strict';
import {assertLiveFunctions} from './lib/live-schema.cjs';
import {rowsClient,withSchedulePostgres} from './lib/explicit-schedule-postgres.mjs';
import {setupScheduleFixture,id,biz,branch,branch2,staff,owner} from './lib/explicit-schedule-fixture.mjs';
await withSchedulePostgres('kezek-guest-booking-writer',async sql=>{
const db=rowsClient(sql);await setupScheduleFixture(sql,{bookingWriters:true});
const day={intervals:[{start:'09:00',end:'18:00'}],breaks:[{start:'13:00',end:'14:00'}]};
await db.query('select publish_staff_schedule($1,$2,$3,0,$4,$5,$6,$7)',[staff,biz,owner,'week','2099-01-05',branch,Object.fromEntries(Array.from({length:7},(_,i)=>[i+1,day]))]);
await db.query('select publish_staff_schedule($1,$2,$3,1,$4,$5,$6,$7)',[staff,biz,owner,'day','2099-01-07',branch2,{day}]);
// 20261118100000: a hold books the booked branch's own service, so each branch has its 60-minute service.
await db.query("insert into services(id,biz_id,branch_id,name_ru,duration_min) values($1,$2,$3,'Cut',60),($4,$2,$5,'Cut',60)",[id(9),biz,branch2,id(19),branch]);
const serviceOf=location=>location===branch?id(19):id(9);
const reserve=(date,time,location=branch2,business=biz,name=' LIVE TEST ',phone=' test ',service=serviceOf(location))=>(db.query('select hold_slot_guest($1,$2,$3,$4,$5,$6,$7,null) as booking',[business,location,service,staff,`${date}T${time}:00+06:00`,name,phone]));
const booking=(await reserve('2099-01-07','12:00')).rows[0].booking;
const saved=(await db.query('select * from bookings where id=$1',[booking])).rows[0];
assert.equal(saved.status,'hold');assert.equal(saved.client_id,null);assert.equal(saved.client_name,'LIVE TEST');assert.equal(saved.client_phone,'test');assert.ok(saved.expires_at);
assert.equal((new Date(saved.end_at)-new Date(saved.start_at))/60000,60);
await assert.rejects(reserve('2099-01-07','12:00'),/already booked|SCHEDULE_SLOT_TAKEN/);
await assert.rejects(reserve('2099-01-07','12:15'),/SCHEDULE_OUTSIDE_WORKING_HOURS/);
await assert.rejects(reserve('2099-01-07','13:00'),/SCHEDULE_OUTSIDE_WORKING_HOURS/);
// 20261118100000: the service of another branch is refused before the schedule is consulted.
await assert.rejects(reserve('2099-01-07','14:00',branch,biz,'Test','test',id(9)),/service not found or inactive/);
await assert.rejects(reserve('2099-01-07','14:00',branch),/SCHEDULE_OUTSIDE_WORKING_HOURS/);
await assert.rejects(reserve('2099-01-07','14:00',branch2,id(99)),/service not found/);
await assert.rejects(reserve('2099-01-07','14:00',branch2,biz,''),/client_name is required/);
await assert.rejects(reserve('2099-01-07','14:00',branch2,biz,'Test',''),/client_phone is required/);
// Expired hold should not block: preserve deployed behaviour, not old migration. (Production's
// no_overlap constraint, not in the fixture, blocks it until purge_expired_holds cancels the hold.)
await db.query('update bookings set expires_at=now()-interval \'1 minute\' where id=$1',[booking]);
const second=(await reserve('2099-01-07','12:00')).rows[0].booking;assert.notEqual(second,booking);
await db.query('update staff set is_active=false where id=$1',[staff]);
await assert.rejects(reserve('2099-01-07','14:00'),/staff not found/);
assert.equal((await db.query('select branch_id from staff where id=$1',[staff])).rows[0].branch_id,branch);
await assertLiveFunctions(sql, { suite: 'test-guest-schedule-booking-writer.mjs' });
});
console.log('PASS: live guest writer: temporary branch guest/break boundary/contacts/hold expiry preserved; livehold overlap, breaks, wrongbranch/tenant, service of another branch, emptycontacts, inactive staff rejected; expiredhold freed; homebranch unchanged');

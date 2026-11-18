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
// An expired hold does not block (20261119100000): the booking trigger cancels it as
// purge_expired_holds would, before the no_overlap constraint is checked.
await db.query('update bookings set expires_at=now()-interval \'1 minute\' where id=$1',[booking]);
const second=(await reserve('2099-01-07','12:00')).rows[0].booking;assert.notEqual(second,booking);
const statusOf=async bookingId=>(await db.query('select status::text as status,expires_at from bookings where id=$1',[bookingId])).rows[0];
assert.deepEqual(await statusOf(booking),{status:'cancelled',expires_at:null});
// The same at the table, for any writer: a booking or a move takes the time of an expired hold, while a
// hold without expires_at (the purge leaves it too) and a live hold still block.
const direct=(time,end,status,expires)=>db.query('insert into bookings(staff_id,biz_id,branch_id,start_at,end_at,status,expires_at) values($1,$2,$3,$4,$5,$6,'+expires+') returning id',
    [staff,biz,branch2,`2099-01-07T${time}:00+06:00`,`2099-01-07T${end}:00+06:00`,status]);
const expiredAt15=(await direct('15:00','16:00','hold',"now()-interval '1 minute'")).rows[0].id;
const confirmedAt15=(await direct('15:00','16:00','confirmed','null')).rows[0].id;
assert.deepEqual(await statusOf(expiredAt15),{status:'cancelled',expires_at:null});
const expiredAt17=(await direct('17:00','18:00','hold',"now()-interval '1 minute'")).rows[0].id;
await db.query('update bookings set start_at=$2,end_at=$3 where id=$1',[confirmedAt15,'2099-01-07T17:00:00+06:00','2099-01-07T18:00:00+06:00']);
assert.deepEqual(await statusOf(expiredAt17),{status:'cancelled',expires_at:null});
assert.equal((await statusOf(confirmedAt15)).status,'confirmed');
await direct('15:00','16:00','hold','null');
await assert.rejects(direct('15:00','16:00','confirmed','null'),/no_overlap/);
await direct('16:00','17:00','hold',"now()+interval '2 minutes'");
await assert.rejects(direct('16:00','17:00','confirmed','null'),/SCHEDULE_SLOT_TAKEN/);
await db.query('update staff set is_active=false where id=$1',[staff]);
await assert.rejects(reserve('2099-01-07','14:00'),/staff not found/);
assert.equal((await db.query('select branch_id from staff where id=$1',[staff])).rows[0].branch_id,branch);
await assertLiveFunctions(sql, { suite: 'test-guest-schedule-booking-writer.mjs' });
});
console.log('PASS: live guest writer: temporary branch guest/break boundary/contacts/hold expiry preserved; livehold overlap, breaks, wrongbranch/tenant, service of another branch, emptycontacts, inactive staff rejected; expiredhold released by any writer or move, holds without expiry and live holds still block; homebranch unchanged');

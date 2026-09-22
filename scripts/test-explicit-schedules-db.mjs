// node scripts/test-explicit-schedules-db.mjs <path-to-pglite/dist/index.js>
// Disposable in-memory PostgreSQL only. No Supabase connection or credentials.
import assert from 'node:assert/strict';
import { setupScheduleFixture, id, biz, branch, staff, owner, other, branch2 } from './lib/explicit-schedule-fixture.mjs';
import { pathToFileURL } from 'node:url';
process.on('uncaughtException', error => { console.error(error.message, error.position ?? '', error.where ?? ''); process.exit(1); });
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
await setupScheduleFixture(db);
const day = {intervals:[{start:'09:00',end:'18:00'}],breaks:[{start:'13:00',end:'14:00'}]};
const week = Object.fromEntries(Array.from({length:7},(_,i)=>[i+1,day]));
const from='2099-01-05';
const snapshot = async () => (await db.query('select read_staff_schedule($1,$2,$3::date,$3::date+13) as r',[staff,biz,from])).rows[0].r;
const publish = async (days=week,kind='week',date=from,rev=0,actor=owner,toBranch=branch) =>
    (await db.query('select publish_staff_schedule($1,$2,$3,$4,$5,$6,$7,$8) as r',[staff,biz,actor,rev,kind,date,toBranch,days])).rows[0].r;
assert.equal((await snapshot()).days[0].source,'unconfigured');
assert.equal((await db.query('select count(*)::int as n from staff_schedule_versions')).rows[0].n,0);
await db.query(`insert into staff_schedule_rules(staff_id,biz_id,branch_id,kind,date_on,is_active,tz,intervals,breaks)
values($1,$2,$3,'date',$4,true,'Asia/Bishkek','[]','[]')`,[staff,biz,branch,'2099-01-09']);
await assert.rejects(publish(week,'week',from,0,other),/SCHEDULE_FORBIDDEN/);
await assert.rejects(publish(week,'week','2000-01-01'),/SCHEDULE_INVALID/);
await assert.rejects(publish({...week,1:{intervals:[{start:'18:00',end:'09:00'}],breaks:[]}}),/SCHEDULE_INVALID/);
await assert.rejects(publish({...week,1:{intervals:day.intervals,breaks:[{start:'07:00',end:'08:00'}]}}),/SCHEDULE_INVALID/);
assert.equal((await publish()).revision,1);
const draft = async kind => (await db.query('select read_staff_schedule_draft($1,$2,$3,$4) as r',[staff,biz,'2099-01-09',kind])).rows[0].r;
assert.deepEqual((await draft('week')).days,week); // legacy date off must not overwrite the weekly draft
assert.deepEqual((await draft('day')).days.day.intervals,[]);
await assert.rejects(db.query('select read_staff_schedule_draft($1,$2,$3,$4)',[staff,other,from,'week']),/SCHEDULE_NOT_FOUND/);
await assert.rejects(publish(),/SCHEDULE_STALE/);
assert.deepEqual((await snapshot()).days[0].breaks,day.breaks);
assert.equal((await snapshot()).days[13].source,'week');
await db.query('insert into services values($1,$2,$3,60,true)',[id(9),biz,branch]);
const slots = async () => (await db.query('select * from get_free_slots_service_day_v2($1,$2,$3)',[biz,id(9),from])).rows;
assert.ok((await slots()).length>0);
assert.equal((await db.query('select * from resolve_staff_day($1,$2)',[staff,from])).rows[0].intervals[0].end,'18:00');
await db.query('insert into bookings(staff_id,biz_id,branch_id,start_at,end_at,status) values($1,$2,$3,$4,$5,$6)',
    [staff,biz,branch,`${from}T09:00:00+06:00`,`${from}T10:00:00+06:00`,'confirmed']);
const off={day:{intervals:[],breaks:[]}};
const conflict=await publish(off,'day',from,1);
assert.equal(conflict.ok,false);
assert.equal(conflict.conflicts.length,1);
assert.equal((await snapshot()).revision,1); // failed publication is fully rolled back
assert.equal((await snapshot()).days[0].source,'week');
await assert.rejects(db.query('insert into bookings(staff_id,biz_id,branch_id,start_at,end_at,status) values($1,$2,$3,$4,$5,$6)',
    [staff,biz,branch,`${from}T13:00:00+06:00`,`${from}T14:00:00+06:00`,'confirmed']),/SCHEDULE_OUTSIDE_WORKING_HOURS/);
assert.equal((await publish(off,'day','2099-01-06',1)).revision,2);
assert.deepEqual((await snapshot()).days[1].intervals,[]);
assert.equal((await snapshot()).days[2].source,'week');
const split={day:{intervals:[{start:'09:00',end:'12:00'},{start:'15:00',end:'19:00'}],breaks:[]}};
assert.equal((await publish(split,'day','2099-01-07',2,owner,branch2)).revision,3);
assert.equal((await snapshot()).days[2].branch_id,branch2);
assert.equal((await snapshot()).days[2].intervals.length,2);
assert.equal((await db.query('select * from read_staff_work_locations($1,$2,$2)',[biz,'2099-01-07'])).rows[0].branch_id,branch2);
await assert.rejects(db.query('select read_staff_schedule($1,$2,$3,$3)',[staff,id(999),from]),/SCHEDULE_NOT_FOUND/);
await db.query('insert into staff_time_off(staff_id,biz_id,date_from,date_to) values($1,$2,$3,$3)',[staff,biz,'2099-01-08']);
assert.equal((await snapshot()).days[3].source,'absence');
await assert.rejects(db.query('delete from staff_schedule_rules where staff_id=$1',[staff]),/SCHEDULE_USE_PUBLICATION_EDITOR/);
assert.equal((await snapshot()).days[4].source,'legacy');
assert.deepEqual((await snapshot()).days[4].intervals,[]);
// Boundary: a booking ending exactly when a break begins is permitted.
await db.query('insert into bookings(staff_id,biz_id,branch_id,start_at,end_at,status) values($1,$2,$3,$4,$5,$6)',
    [staff,biz,branch,`${from}T12:00:00+06:00`,`${from}T13:00:00+06:00`,'confirmed']);
// Changing a future week never changes the past version.
assert.equal((await publish(Object.fromEntries(Object.keys(week).map(k=>[k,{intervals:[],breaks:[]}])),'week','2099-01-12',3)).revision,4);
assert.equal((await snapshot()).days[0].intervals.length,1);
assert.deepEqual((await snapshot()).days[7].intervals,[]);
// Branch replacement must be atomic and cannot strand confirmed bookings.
const closedBranch=Array.from({length:7},(_,i)=>({day_of_week:i,intervals:[],breaks:[]}));
await assert.rejects(db.query('select replace_branch_schedule($1,$2,$3,$4)',[biz,branch,owner,closedBranch]),/SCHEDULE_BOOKING_CONFLICT/);
assert.equal((await db.query('select intervals from branch_working_hours where branch_id=$1 limit 1',[branch])).rows[0].intervals[0].end,'20:00');
// Duplicate attempts serialize and cannot create another booking in occupied time.
await assert.rejects(db.query('insert into bookings(staff_id,biz_id,branch_id,start_at,end_at,status) values($1,$2,$3,$4,$5,$6)',
    [staff,biz,branch,`${from}T09:00:00+06:00`,`${from}T10:00:00+06:00`,'confirmed']),/SCHEDULE_SLOT_TAKEN/);
await db.query('insert into bookings(staff_id,biz_id,branch_id,start_at,end_at,status,expires_at) values($1,$2,$3,$4,$5,$6,now()+interval \'2 minutes\')',
    [staff,biz,branch,`${from}T10:00:00+06:00`,`${from}T11:00:00+06:00`,'hold']);
assert.ok(!(await slots()).some(s=>new Date(s.start_at).toISOString()===`${from}T04:00:00.000Z`));
await db.exec("update bookings set expires_at=now()-interval '1 minute' where status='hold'");
assert.ok((await slots()).some(s=>new Date(s.start_at).toISOString()===`${from}T04:00:00.000Z`));
// Actual complex reservation writers agree with slots and support published transfers.
const guestHold = async (date, time, location=branch) => db.query(
    'select hold_complex_slot_guest($1,$2,$3,$4,$5,$6,$7)',
    [biz,location,staff,`${date}T${time}:00+06:00`,[{service_id:id(9),duration_min:60}],'Test','test-phone']);
await guestHold(from,'10:00'); // expired hold no longer blocks the actual writer
await assert.rejects(guestHold(from,'10:00'),/already booked|SCHEDULE_SLOT_TAKEN/);
await guestHold('2099-01-07','09:00',branch2);
await assert.rejects(guestHold('2099-01-07','15:00',branch),/SCHEDULE_OUTSIDE_WORKING_HOURS/);
// Transfers preserve explicit plans and reject stale membership and unauthorized actors.
const transfer = async (s,expected,target,actor=owner) => db.query('select transfer_staff_home($1,$2,$3,$4,$5)',[s,biz,actor,expected,target]);
await assert.rejects(transfer(staff,branch,branch2,other),/SCHEDULE_FORBIDDEN/);
await transfer(staff,branch,branch2);
await assert.rejects(db.query('update staff set branch_id=$1 where id=$2',[branch,staff]),/SCHEDULE_USE_TRANSFER_COMMAND/);
assert.equal((await snapshot()).days[0].branch_id,branch);
await assert.rejects(transfer(staff,branch,branch2),/SCHEDULE_STALE/);
// Legacy inherited hours: conflicts roll back EVERY table, and history remains in the original branch.
const legacyStaff=id(88);
await db.query('insert into staff values($1,$2,$3,$4,true)',[legacyStaff,biz,branch,other]);
await db.query(`insert into working_hours select $1,$2,d,'[{"start":"09:00","end":"18:00"}]','[]' from generate_series(0,6) d`,[legacyStaff,biz]);
await db.query('insert into bookings(staff_id,biz_id,branch_id,start_at,end_at,status) values($1,$2,$3,$4,$5,$6)',[legacyStaff,biz,branch,`${from}T09:00:00+06:00`,`${from}T10:00:00+06:00`,'confirmed']);
await assert.rejects(transfer(legacyStaff,branch,branch2),/SCHEDULE_BOOKING_CONFLICT/);
assert.equal((await db.query('select branch_id from staff where id=$1',[legacyStaff])).rows[0].branch_id,branch);
assert.equal((await db.query('select count(*)::int n from staff_home_branch_changes where staff_id=$1',[legacyStaff])).rows[0].n,0);
assert.equal((await db.query('select count(*)::int n from staff_branch_assignments where staff_id=$1',[legacyStaff])).rows[0].n,0);
await db.query("update bookings set status='cancelled' where staff_id=$1",[legacyStaff]);
await transfer(legacyStaff,branch,branch2);
assert.equal((await db.query("select * from resolve_staff_day($1,'2020-01-01')",[legacyStaff])).rows[0].branch_id,branch);
assert.equal((await db.query('select * from resolve_staff_day($1,$2)',[legacyStaff,from])).rows[0].branch_id,branch2);
for(const role of ['anon','authenticated']) {
    assert.equal((await db.query(`select has_function_privilege($1,'public.publish_staff_schedule(uuid,uuid,uuid,bigint,text,date,uuid,jsonb)','execute') as allowed`,[role])).rows[0].allowed,false);
    assert.equal((await db.query(`select has_function_privilege($1,'public.schedule_effective_day(uuid,date)','execute') as allowed`,[role])).rows[0].allowed,false);
}
await db.close();
console.log('PASS: read-only snapshots, ownership, validation, revision conflicts, rollback, breaks, split intervals, legacy preservation, absence, transfers, boundaries, version history and permissions');

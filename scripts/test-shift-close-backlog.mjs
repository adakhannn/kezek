// Synthetic disposable PostgreSQL only: no network, ports, volumes, remote credentials or existing containers.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { setupFinanceFixture, ids, asActor } from './lib/finance-transaction-fixture.mjs';
const container=`kezek-close-backlog-test-${randomUUID()}`;
function docker(args,input='') { return new Promise((resolve,reject)=>{
 const p=spawn('docker',args,{windowsHide:true});let out='',err='';
 p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);p.on('error',reject);
 p.on('close',code=>code===0?resolve(out.trim()):reject(new Error(err||out||`exit ${code}`)));p.stdin.end(input);
}); }
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const sql=text=>docker(['exec','-i',container,'psql','-X','-q','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At'],text);
const call=async text=>JSON.parse(await sql(`${asActor()} ${text}`));

const load=name=>fs.readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
let created=false;
try {
 await docker(['info','--format','{{.ServerVersion}}']);
 await docker(['run','--detach','--rm','--network','none','--tmpfs','/var/lib/postgresql/data','--name',container,'-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:16']);created=true;
 let ready=false;for(let i=0;i<60;i++){try{await sql('select 1');ready=true;break;}catch{await delay(500);}}assert.ok(ready);
 await setupFinanceFixture(sql);
 // Match the authoritative constraint name; the fixture previously used an inline check.
 await sql('alter table staff_shifts rename constraint staff_shifts_hours_worked_check to staff_shifts_hours_worked_range');
 await sql(await load('20261110113000_shift_close_backlog.sql'));
 console.log('PASS close backlog/timezone migration compiles');
 const now='2026-11-10T00:00Z';
 const claim=(token,at=now,limit=25)=>`select claim_overdue_staff_shifts('${token}',${limit},'${at}');`;
 const tokenA=randomUUID(),tokenB=randomUUID();
 await assert.rejects(sql(`${asActor(ids.owner,'authenticated')} ${claim(tokenA)}`),/permission denied/);
 await assert.rejects(sql(`set role anon; select read_staff_shift_close_snapshot('${ids.biz}','${ids.staff}','${ids.shift}');`),/permission denied/);
 await assert.rejects(call(`select read_staff_shift_close_snapshot('${ids.biz}','${ids.otherStaff}','${ids.shift}');`),/FINANCE_FORBIDDEN/);
 await sql(`${asActor()} insert into staff_shift_items(id,shift_id,service_amount,consumables_amount) select md5('backlog-ledger-'||i)::uuid,'${ids.shift}',i%11,0.5 from generate_series(1,1501)i;
 insert into staff_shifts(id,staff_id,biz_id,branch_id,shift_date,opened_at) select md5('poison-shift-'||i)::uuid,'${ids.staff}','${ids.biz}','${ids.branch}',date '2020-01-01'+i,(date '2020-01-01'+i)::timestamp at time zone 'Asia/Bishkek' from generate_series(1,40)i;`);
 const snapshot=await call(`select read_staff_shift_close_snapshot('${ids.biz}','${ids.staff}','${ids.shift}');`);
 assert.equal(snapshot.items.length,1501);assert.equal(snapshot.items.reduce((sum,i)=>sum+i.service_amount,0),Array.from({length:1501},(_,i)=>(i+1)%11).reduce((a,b)=>a+b,0));
 assert.equal(snapshot.dayHours,24);
 const editorSnapshot=await call(`select read_staff_shift_snapshot('${ids.biz}','${ids.staff}','2026-10-12');`);
 assert.equal(editorSnapshot.staff_shift_items.length,1501);assert.equal(editorSnapshot.ledger_revision,snapshot.shift.ledger_revision);

 // Real simultaneous sessions: each gets a disjoint bounded batch under row locks.
 const firstPromise=sql(`set application_name='reporting_claim_overlap'; begin; ${asActor()} ${claim(tokenA)} select pg_sleep(2); commit;`).then(JSON.parse);
 let observedOverlap=false;
 for(let attempt=0;attempt<40;attempt++) {
  if(await sql(`select count(*) from pg_stat_activity where application_name='reporting_claim_overlap' and wait_event='PgSleep'`)==='1') { observedOverlap=true; break; }
  await delay(50);
 }
 assert.ok(observedOverlap,'first claimant holds row locks before second claimant starts');
 const b=await call(claim(tokenB));const a=await firstPromise;
 const aid=a.rows.map(r=>r.shift.id),bid=b.rows.map(r=>r.shift.id);
 assert.equal(new Set([...aid,...bid]).size,42);assert.equal(aid.length+bid.length,42);assert.ok(aid.every(id=>!bid.includes(id)));
 assert.ok(a.rows.length<=25&&b.rows.length<=25);
 assert.equal((await call(claim(randomUUID()))).rows.length,0);
 // A later never-attempted shift is selected before old failures when leases expire.
 await sql(`insert into staff_shifts(id,staff_id,biz_id,branch_id,shift_date,opened_at) values(md5('new-unattempted')::uuid,'${ids.staff}','${ids.biz}','${ids.branch}','2026-11-08','2026-11-08 09:00+06')`);
 const next=await call(claim(randomUUID(),'2026-11-10T00:06Z',1));assert.equal(next.rows[0].shift.shift_date,'2026-11-08');
 await sql(`${asActor()} select release_staff_shift_claims('${tokenA}',array['${aid[0]}']::uuid[]);`);
 assert.equal(await sql(`select lease_until<=now() from staff_shift_close_attempts where shift_id='${aid[0]}'`),'t');
 // Claims never alter the financial revision or close a shift.
 assert.equal(await sql(`select status from staff_shifts where id='${ids.shift}'`),'open');
 assert.equal(Number(await sql(`select ledger_revision from staff_shifts where id='${ids.shift}'`)),snapshot.shift.ledger_revision);
 console.log('PASS >1000 full ledger, simultaneous disjoint claims, leases, fairness and no financial side effects');
 await sql(`update businesses set tz='America/New_York' where id='${ids.otherBiz}';update staff set hourly_rate=100 where id='${ids.otherStaff}';
 insert into staff_shifts(id,staff_id,biz_id,branch_id,shift_date,opened_at) values
 (md5('dst-fall')::uuid,'${ids.otherStaff}','${ids.otherBiz}','${ids.otherBranch}','2026-11-01','2026-11-01 04:00Z'),
 (md5('dst-spring')::uuid,'${ids.otherStaff}','${ids.otherBiz}','${ids.otherBranch}','2026-03-08','2026-03-08 05:00Z'),
 (md5('normal-day')::uuid,'${ids.otherStaff}','${ids.otherBiz}','${ids.otherBranch}','2026-11-02','2026-11-02 05:00Z');`);
 for(const [key,hours,end] of [['dst-fall',25,'2026-11-02T05:00:00+00:00'],['dst-spring',23,'2026-03-09T04:00:00+00:00'],['normal-day',24,'2026-11-03T05:00:00+00:00']]) {
  const id=await sql(`select md5('${key}')::uuid`);
  const snap=await call(`select read_staff_shift_close_snapshot('${ids.otherBiz}','${ids.otherStaff}','${id}');`);
  assert.equal(snap.dayHours,hours);assert.equal(Date.parse(snap.closeBoundary),Date.parse(end));
  await assert.rejects(sql(`update staff_shifts set hours_worked=${hours+1} where id='${id}'`),/SHIFT_HOURS_OUTSIDE_LOCAL_DAY/);
  const calc={totalAmount:0,totalConsumables:0,normalizedPercentMaster:60,normalizedPercentSalon:40,finalMasterShare:hours*100,finalSalonShare:0,hoursWorked:hours,hourlyRate:100,guaranteedAmount:hours*100,topupAmount:hours*100,closedAt:end};
  const result=await call(`select close_staff_shift_command('${id}',null,${snap.shift.ledger_revision},'${JSON.stringify(snap.staff)}','${JSON.stringify(calc)}');`);
  assert.equal(result.ok,true);assert.equal(result.shift.hours_worked,hours);assert.equal(result.shift.master_share,hours*100);
 }
 console.log('PASS real 23/24/25-hour local-day constraints and full guaranteed payouts; excessive hours rejected');
 // Save links a booking by its business-local date, which differs from Bishkek.
 const saveId=await sql(`select md5('tz-save')::uuid`),bookingId=await sql(`select md5('tz-booking')::uuid`);
 await sql(`insert into staff_shifts(id,staff_id,biz_id,branch_id,shift_date,opened_at) values('${saveId}','${ids.otherStaff}','${ids.otherBiz}','${ids.otherBranch}','2026-11-03','2026-11-03 05:00Z');
 insert into bookings(id,biz_id,branch_id,staff_id,service_id,start_at,end_at,status) values('${bookingId}','${ids.otherBiz}','${ids.otherBranch}','${ids.otherStaff}','${ids.otherService}','2026-11-04 04:00Z','2026-11-04 04:30Z','confirmed');`);
 const saved=await call(`select save_staff_shift_command('${ids.otherStaff}','${ids.otherBiz}','2026-11-03','[{"clientName":"Synthetic","serviceAmount":1000,"consumablesAmount":0,"bookingId":"${bookingId}"}]','${ids.otherOwner}',false,0,'${saveId}');`);
 assert.equal(saved.ok,true);assert.equal(saved.items[0].bookingId,bookingId);
 await sql(`update businesses set tz='Invalid/Timezone' where id='${ids.otherBiz}'`);
 const validBatch=await call(claim(randomUUID(),'2026-11-10T00:12Z'));
 assert.ok(validBatch.configurationErrors.some(e=>e.includes('invalid_business_timezone')));assert.ok(validBatch.rows.every(r=>r.shift.biz_id===ids.biz));
 console.log('PASS business-local booking date and observable invalid-TZ isolation');

 await sql(`alter table staff_shifts enable row level security;alter table staff_shift_items enable row level security;
 create policy snapshot_shift_scope on staff_shifts for select to authenticated using(staff_id='${ids.staff}' and auth.uid()='${ids.staffUser}');
 create policy snapshot_item_scope on staff_shift_items for select to authenticated using(shift_id in(select id from staff_shifts));`);
 const ownEditor=JSON.parse(await sql(`${asActor(ids.staffUser,'authenticated')} select read_staff_shift_snapshot('${ids.biz}','${ids.staff}','2026-10-12');`));assert.equal(ownEditor.staff_shift_items.length,1501);
 assert.equal(await sql(`${asActor(ids.otherOwner,'authenticated')} select coalesce(read_staff_shift_snapshot('${ids.biz}','${ids.staff}','2026-10-12')::text,'NULL');`),'NULL');
 await assert.rejects(sql(`set role anon; select read_staff_shift_snapshot('${ids.biz}','${ids.staff}','2026-10-12');`),/permission denied/);

 await sql(await load('20261110114000_finance_calendar.sql'));
 await sql("update businesses set tz='America/New_York' where id='"+ids.otherBiz+"'");
 const calendar=await call("select read_staff_finance_calendar('"+ids.otherBiz+"','"+ids.otherStaff+"',null,'2026-11-10 02:00Z');");
 assert.equal(calendar.date,'2026-11-09');assert.equal(calendar.timezone,'America/New_York');
 for(const [date,hours] of [['2026-03-08',23],['2026-11-01',25]]) {
  const cal=await call("select read_staff_finance_calendar('"+ids.otherBiz+"','"+ids.otherStaff+"','"+date+"');");
  assert.equal(cal.date,date);assert.equal(cal.dayHours,hours);assert.equal(Date.parse(cal.dayEnd)-Date.parse(cal.dayStart),hours*3600000);
 }
 await assert.rejects(sql(asActor(ids.otherOwner,'authenticated')+" select read_staff_finance_calendar('"+ids.biz+"','"+ids.staff+"');"),/FINANCE_FORBIDDEN/);
 await assert.rejects(sql("set role anon; select read_staff_finance_calendar('"+ids.biz+"','"+ids.staff+"');"),/permission denied/);
 const calendarShift=await sql("select md5('calendar-shift')::uuid");
 await sql("insert into staff_shifts(id,staff_id,biz_id,branch_id,shift_date,opened_at) values('"+calendarShift+"','"+ids.staff+"','"+ids.biz+"','"+ids.branch+"','2002-01-02','2002-01-02 09:00+06')");
 const revision=Number(await sql("select ledger_revision from staff_shifts where id='"+calendarShift+"'"));
 const saveSql=(date,rev,shiftId)=>"select save_staff_shift_command('"+ids.staff+"','"+ids.biz+"',"+date+",'[]','"+ids.owner+"',true,"+rev+","+shiftId+");";
 await assert.rejects(call(saveSql("'2026-10-11'",revision,"'"+calendarShift+"'")),/SHIFT_DATE_MISMATCH/);
 const sameDay=await call(saveSql('null',revision,"'"+calendarShift+"'"));assert.equal(sameDay.ok,true);
 assert.equal(await sql("select shift_date from staff_shifts where id='"+calendarShift+"'"),'2002-01-02');
 await assert.rejects(call(saveSql("'2001-01-01'",'null','null')),/SHIFT_DATE_REQUIRES_EXISTING_SHIFT/);
 await assert.rejects(call(saveSql("(now() at time zone 'Asia/Bishkek')::date+1",'null','null')),/SHIFT_DATE_REQUIRES_EXISTING_SHIFT/);
 const openSql=date=>"select open_staff_shift_safe('"+ids.staff+"','"+ids.biz+"','"+ids.branch+"',"+date+",now(),null,0);";
 await assert.rejects(call(openSql("'2001-01-01'")),/SHIFT_DATE_REQUIRES_EXISTING_SHIFT/);
 await assert.rejects(call(openSql("(now() at time zone 'Asia/Bishkek')::date+1")),/SHIFT_FUTURE_DATE/);
 const origin=await sql("select opened_at from staff_shifts where id='"+calendarShift+"'");
 await sql("update staff_shifts set status='closed',closed_at='2002-01-02 18:00Z' where id='"+calendarShift+"'");
 const closedRevision=Number(await sql("select ledger_revision from staff_shifts where id='"+calendarShift+"'"));
 await assert.rejects(sql(asActor(ids.staffUser,'authenticated')+openSql("'2002-01-02'")),/FINANCE_FORBIDDEN/);
 const reopened=JSON.parse(await sql(asActor(ids.owner,'authenticated')+openSql("'2002-01-02'")));
 assert.equal(reopened.action,'reopened');assert.ok(reopened.shift.ledger_revision>closedRevision);
 assert.equal(await sql("select opened_at from staff_shifts where id='"+calendarShift+"'"),origin);
 await assert.rejects(call(saveSql("'2002-01-02'",closedRevision,"'"+calendarShift+"'")),/SHIFT_STALE/);
 const repeat=await call(openSql("'2002-01-02'"));assert.equal(repeat.action,'already_open');assert.equal(repeat.shift.ledger_revision,reopened.shift.ledger_revision);
 const todayOpen=await call(openSql('null'));assert.equal(todayOpen.ok,true);assert.equal(todayOpen.shift.shift_date,(await call("select read_staff_finance_calendar('"+ids.biz+"','"+ids.staff+"');")).todayDate);
 console.log('PASS calendar DST, scoped access, existing-date Save, historical/future create fencing, manager-only original-time reopen and stale revision');

 console.log('PASS all isolated shift-close backlog regressions');
} finally { if(created) await docker(['rm','--force',container]); }

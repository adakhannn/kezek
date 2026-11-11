// Disposable synthetic SQL proof; never reads credentials or existing containers.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { setupFinanceFixture, ids, asActor, day } from './lib/finance-transaction-fixture.mjs';
const container='kezek-hours-test-'+randomUUID();
function docker(args,input=''){return new Promise((resolve,reject)=>{const p=spawn('docker',args,{windowsHide:true});let out='',err='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);p.on('error',reject);p.on('close',code=>code===0?resolve(out.trim()):reject(new Error(err||out)));p.stdin.end(input);});}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const sql=text=>docker(['exec','-i',container,'psql','-X','-q','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At'],text);
const load=name=>fs.readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
const call=async text=>JSON.parse(await sql(asActor()+text));
// Independent explicit oracle for persisted amount1001,consumables99,60/40,rate100.
function calc(hours){const guarantee=Math.round(hours*10000)/100,topup=Math.max(0,guarantee-601);return {totalAmount:1001,totalConsumables:99,guaranteedAmount:guarantee,topupAmount:topup,finalMasterShare:Math.max(601,guarantee),finalSalonShare:Math.max(0,499-topup)};}
const command=(id,revision,hours=8,actor=ids.owner,biz=ids.biz,calculation=calc(hours))=>`select adjust_closed_shift_hours_command('${id}','${biz}',${actor===null?'null':"'"+actor+"'"},${revision},${hours},'${JSON.stringify(calculation)}');`;
const get=async(id=ids.shift)=>call(`select read_staff_shift_adjustment_snapshot('${id}','${ids.biz}','${ids.owner}');`);
async function overlap(query,name){const pending=sql(`set application_name='${name}';begin;${asActor()}${query}select pg_sleep(4);commit;`);let seen=false;for(let i=0;i<40;i++){if(await sql(`select count(*) from pg_stat_activity where application_name='${name}' and wait_event='PgSleep'`)==='1'){seen=true;break;}await delay(50);}assert.ok(seen,'observed transaction holding row lock');return {pending};}
let created=false;
try{
 await docker(['run','--detach','--rm','--network','none','--tmpfs','/var/lib/postgresql/data','--name',container,'-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:16']);created=true;
 let ready=false;for(let i=0;i<60;i++){try{await sql('select 1');ready=true;break;}catch{await delay(500);}}assert.ok(ready);
 await setupFinanceFixture(sql);
 await sql(`alter table roles add column scope text not null default 'business';create table user_global_roles(user_id uuid,role_id uuid);create table super_admins_legacy(user_id uuid);
 alter table staff_shifts rename constraint staff_shifts_hours_worked_check to staff_shifts_hours_worked_range;`);
 const reporting=await load('20261110110000_reporting_completeness.sql');await sql(reporting.slice(0,reporting.indexOf('create function public.recalculate_business_daily_stats'))+'commit;');
 await sql(await load('20261110113000_shift_close_backlog.sql'));
 await sql(await load('20261110114000_finance_calendar.sql'));
 await sql(await load('20261110131000_shift_hours_adjustment.sql'));
 await sql(`update staff_shifts set status='closed',closed_at='${day} 18:00+06',total_amount=1001,consumables_amount=99,percent_master=60,percent_salon=40,hourly_rate=100 where id='${ids.shift}';`);
 let snap=await get();assert.equal(snap.dayHours,24);
 for(const role of ['anon','authenticated'])await assert.rejects(sql(asActor(ids.owner,role)+command(ids.shift,snap.shift.ledger_revision)),/permission denied/);
 for(const actor of [null,ids.otherOwner,ids.staffUser])await assert.rejects(call(command(ids.shift,snap.shift.ledger_revision,8,actor)),/FINANCE_FORBIDDEN/);
 await assert.rejects(call(command(ids.shift,snap.shift.ledger_revision,8,ids.otherOwner,ids.otherBiz)),/SHIFT_NOT_FOUND/);
 // Three current trusted super-admin stores, and negative wrong-scope global role.
 for(const [key,kind] of [['global','global'],['legacy-table','table'],['legacy-null','null']]){
  const actor=await sql(`select md5('${key}')::uuid`),role=randomUUID();
  if(kind==='table')await sql(`insert into super_admins_legacy values('${actor}')`);
  else {await sql(`insert into roles(id,key,scope) values('${role}','super_admin','${kind==='global'?'platform':'business'}')`);await sql(kind==='global'?`insert into user_global_roles values('${actor}','${role}')`:`insert into user_roles values('${actor}','${role}',null)`);}
  assert.equal((await call(`select read_staff_shift_adjustment_snapshot('${ids.shift}','${ids.biz}','${actor}');`)).shift.id,ids.shift);
 }
 const wrong=randomUUID(),wrongRole=randomUUID();await sql(`insert into roles values('${wrongRole}','super_admin','business');insert into user_global_roles values('${wrong}','${wrongRole}')`);
 await assert.rejects(call(`select read_staff_shift_adjustment_snapshot('${ids.shift}','${ids.biz}','${wrong}');`),/FINANCE_FORBIDDEN/);
 console.log('PASS mandatory actor/tenant/service boundary and all three legitimate platform-admin stores');
 await assert.rejects(call(command(ids.shift,snap.shift.ledger_revision,8,ids.owner,ids.biz,{...calc(8),totalAmount:1002})),/SHIFT_CALCULATION_CHANGED/);
 await assert.rejects(call(command(ids.shift,snap.shift.ledger_revision,8,ids.owner,ids.biz,{...calc(8),finalSalonShare:-1})),/SHIFT_CALCULATION_INVALID/);
 await assert.rejects(call(command(ids.shift,snap.shift.ledger_revision,8).replace(',8,',",'NaN',")),/SHIFT_HOURS_OUTSIDE_LOCAL_DAY/);
 const original=snap.shift.ledger_revision;
 const race=await overlap(command(ids.shift,original),'hours_overlap');
 await assert.rejects(call(command(ids.shift,original,9)),/SHIFT_STALE_OR_REOPENED/);const receipt=JSON.parse(await race.pending);
 assert.equal(receipt.shift.hours_worked,8);assert.equal(receipt.shift.master_share,800);assert.equal(receipt.shift.salon_share,300);assert.equal(receipt.shift.topup_amount,199);
 assert.ok(receipt.shift.ledger_revision>original);assert.equal(await sql(`select count(*) from staff_shift_aggregates where staff_id='${ids.staff}' and total_master=800 and total_salon=300`),'3');
 const report=await call(`select read_finance_report_snapshot('${ids.biz}','${day}','${day}','${ids.staff}',null);`);
 assert.equal(report.shifts[0].ledger_revision,receipt.shift.ledger_revision);assert.equal(report.shifts[0].day_hours,24);assert.equal(report.shifts[0].timezone,'Asia/Bishkek');assert.equal(report.closedStats[0].total_master,800);
 console.log('PASS genuine same-version overlap commits once, rejects stale writer and updates three aggregates + report snapshot');
 // Failure after shift UPDATE must roll back both its data/revision and aggregate values.
 snap=await get();await sql(`create function hours_aggregate_failure() returns trigger language plpgsql as $$begin raise exception 'SYNTHETIC_AGGREGATE_FAILURE';end$$;create trigger hours_aggregate_failure before update on staff_shift_aggregates for each row execute function hours_aggregate_failure();`);
 await assert.rejects(call(command(ids.shift,snap.shift.ledger_revision,10)),/SYNTHETIC_AGGREGATE_FAILURE/);assert.deepEqual(await get(),snap);assert.equal(await sql(`select count(*) from staff_shift_aggregates where staff_id='${ids.staff}' and total_master=800 and total_salon=300`),'3');await sql('drop trigger hours_aggregate_failure on staff_shift_aggregates');
 const reopened=await overlap(`select open_staff_shift_safe('${ids.staff}','${ids.biz}','${ids.branch}','${day}',null,now());`,'hours_reopen_overlap');
 await assert.rejects(call(command(ids.shift,snap.shift.ledger_revision,8)),/SHIFT_STALE_OR_REOPENED/);await reopened.pending;assert.equal((await get()).shift.status,'open');
 // Opposite order: hours owns lock first; later reopening recomputes aggregates without the now-open shift.
 await sql(`update staff_shifts set status='closed' where id='${ids.shift}'`);snap=await get();
 const adjusting=await overlap(command(ids.shift,snap.shift.ledger_revision,9),'hours_before_reopen');
 const openResult=await call(`select open_staff_shift_safe('${ids.staff}','${ids.biz}','${ids.branch}','${day}',null,now());`);await adjusting.pending;
 assert.equal(openResult.shift.status,'open');assert.equal(openResult.shift.hours_worked,9);assert.equal(await sql(`select count(*) from staff_shift_aggregates where staff_id='${ids.staff}' and total_master<>0`),'0');
 console.log('PASS aggregate error rolls back revision and payout; adjustment/reopen races serialize in both orders');
 await sql(`update businesses set tz='America/New_York' where id='${ids.biz}'`);
 for(const [key,date,length] of [['fall','2026-11-01',25],['spring','2026-03-08',23],['normal','2026-11-02',24]]){
  const id=await sql(`select md5('hours-${key}')::uuid`);await sql(`insert into staff_shifts(id,staff_id,biz_id,branch_id,shift_date,status,opened_at,closed_at,total_amount,consumables_amount,percent_master,percent_salon,hourly_rate) values('${id}','${ids.staff}','${ids.biz}','${ids.branch}','${date}','closed','${date}'::timestamp at time zone 'America/New_York',('${date}'::date+1)::timestamp at time zone 'America/New_York',1001,99,60,40,100)`);
  const state=await get(id);assert.equal(state.dayHours,length);
  await assert.rejects(call(command(id,state.shift.ledger_revision,length+1)),/SHIFT_HOURS_OUTSIDE_LOCAL_DAY/);
  const result=await call(command(id,state.shift.ledger_revision,length));assert.equal(result.shift.hours_worked,length);assert.equal(result.shift.guaranteed_amount,length*100);
 }
 const calendar=await call("select read_business_finance_calendar('"+ids.biz+"');");
 assert.equal(calendar.timezone,'America/New_York');assert.equal(calendar.todayDate,await sql("select (statement_timestamp() at time zone 'America/New_York')::date"));
 await assert.rejects(sql(asActor(ids.owner,'authenticated')+"select read_business_finance_calendar('"+ids.biz+"');"),/permission denied/);
 console.log('PASS actual 23/24/25-hour day limit and guaranteed amounts; ordinary 25-hour input rejected');
 console.log('PASS all isolated shift-hours adjustment regressions');
}finally{if(created)await docker(['rm','--force',container]);}

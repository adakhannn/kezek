import fs from 'node:fs/promises';
// Disposable PostgreSQL only: synthetic fixture, no host ports, mounts or credentials.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { setupFinanceFixture, ids, day, asActor } from './lib/finance-transaction-fixture.mjs';
const container=`kezek-finance-test-${randomUUID()}`;
function docker(args,input='') {
 return new Promise((resolve,reject)=>{
  const p=spawn('docker',args,{windowsHide:true}); let out='',err='';
  p.stdout.on('data',d=>out+=d); p.stderr.on('data',d=>err+=d); p.on('error',reject);
  p.on('close',code=>code===0?resolve(out.trim()):reject(new Error(err||out||`exit ${code}`))); p.stdin.end(input);
 });
}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const sql=text=>docker(['exec','-i',container,'psql','-X','-q','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At'],text);
const lit=value=>`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`;
const item={clientId:ids.item,bookingId:ids.booking,clientName:'Synthetic',serviceName:'Service',serviceAmount:1000,consumablesAmount:100};
// Defaults read the fixture revision only to prepare an individual test command.
// Race cases always pass a captured literal revision, exactly as a client draft does.
const save=(items=[item],revision=`(select ledger_revision from staff_shifts where id='${ids.shift}')`,shiftId=ids.shift)=>`select save_staff_shift_command('${ids.staff}','${ids.biz}','${day}',${lit(items)},'${ids.owner}',false,${revision??'null'},${shiftId ? `'${shiftId}'` : 'null'})`;
const close=(revision,settings={percent_master:60,percent_salon:40,hourly_rate:null},calc={})=>`select close_staff_shift_command('${ids.shift}','${ids.owner}',${revision},${lit(settings)},${lit({totalAmount:500,totalConsumables:100,normalizedPercentMaster:60,normalizedPercentSalon:40,finalMasterShare:300,finalSalonShare:300,hoursWorked:null,hourlyRate:null,guaranteedAmount:0,topupAmount:0,closedAt:`${day}T12:00:00+06:00`,...calc})})`;
const rev=async()=>Number(await sql(`select ledger_revision from staff_shifts where id='${ids.shift}'`));
let created=false;
try {
 await docker(['info','--format','{{.ServerVersion}}']);
 await docker(['run','--detach','--rm','--network','none','--name',container,'-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:16']); created=true;
 let ready=false; for(let i=0;i<60;i++){try{assert.equal(await docker(['exec',container,'cat','/proc/1/comm']),'postgres'); await sql('select 1');ready=true;break;}catch{await delay(500);}}
 assert.ok(ready,'PostgreSQL failed to start');
 await setupFinanceFixture(sql);
 await sql('alter table staff_shifts rename constraint staff_shifts_hours_worked_check to staff_shifts_hours_worked_range');
 await sql(await fs.readFile(new URL('../supabase/migrations/20261110113000_shift_close_backlog.sql',import.meta.url),'utf8'));
 console.log('PASS fixture and latest finance/timezone migration compilation');
 await assert.rejects(sql(`${asActor()} ${save([item],null,null)};`),/SHIFT_STALE/);
 await assert.rejects(sql(`${asActor()} ${save([item],0,ids.otherShift)};`),/SHIFT_STALE/);
 await assert.rejects(sql(`${asActor(ids.owner,'authenticated')} select save_staff_shift_command_internal_v1('${ids.staff}','${ids.biz}','${day}','[]','${ids.owner}',false,null);`),/permission denied/);
 await assert.rejects(sql(`${asActor(ids.otherOwner,'authenticated')} select update_booking_status_no_check('${ids.booking}','paid');`),/FINANCE_FORBIDDEN/);
 await assert.rejects(sql(`${asActor(ids.otherOwner,'authenticated')} select get_business_finance_stats('${ids.biz}','${day}','${day}',null,false);`),/FINANCE_FORBIDDEN/);
 await assert.rejects(sql(`${asActor(ids.otherOwner,'authenticated')} select get_staff_finance_stats('${ids.staff}','${ids.biz}','${day}','${day}',false);`),/FINANCE_FORBIDDEN/);
 await assert.rejects(sql(`${asActor(ids.otherOwner,'authenticated')} ${save()};`),/FINANCE_FORBIDDEN/);
 await assert.rejects(sql(`${asActor(ids.owner,'authenticated')} select save_shift_items_atomic('${ids.shift}','[]');`),/permission denied/);
 await assert.rejects(sql(`${asActor(ids.staffUser,'authenticated')} update staff_shifts set status='closed' where id='${ids.shift}';`),/SHIFT_COMMAND_REQUIRED/);
 await assert.rejects(sql(`${asActor(ids.staffUser,'authenticated')} update staff_shifts set master_share=999 where id='${ids.shift}';`),/SHIFT_COMMAND_REQUIRED/);
 await assert.rejects(sql(`${asActor(ids.staffUser,'authenticated')} update staff_shifts set opened_at=opened_at-interval '1 hour' where id='${ids.shift}';`),/SHIFT_COMMAND_REQUIRED/);
 await assert.rejects(sql(`${asActor(ids.staffUser,'authenticated')} insert into staff_shifts(staff_id,biz_id,shift_date,status,opened_at) values('${ids.staff}','${ids.biz}','2026-10-13','open','2026-10-13 00:00+06');`),/SHIFT_COMMAND_REQUIRED/);
 await assert.rejects(sql(`${asActor(ids.staffUser,'authenticated')} insert into staff_shifts(staff_id,biz_id,shift_date,status,total_amount) values('${ids.staff}','${ids.biz}','2026-10-13','closed',999);`),/SHIFT_COMMAND_REQUIRED/);
 await assert.rejects(sql(`${asActor(ids.staffUser,'authenticated')} insert into staff_shift_items(shift_id,service_amount) values('${ids.shift}',1);`),/SHIFT_COMMAND_REQUIRED/);
 await assert.rejects(sql(`${asActor()} ${save([{...item,bookingId:ids.otherBooking}])};`),/SHIFT_BOOKING_SCOPE/);
 await assert.rejects(sql(`${asActor()} ${save([item,{...item,clientId:ids.otherItem}])};`),/SHIFT_BOOKING_DUPLICATE/);
 await sql(`update bookings set status='cancelled' where id='${ids.booking}'`);
 await assert.rejects(sql(`${asActor()} ${save()};`),/SHIFT_BOOKING_CANCELLED/);
 await sql(`update bookings set status='confirmed' where id='${ids.booking}'`);
 assert.equal(await sql(`select status from bookings where id='${ids.booking}'`),'confirmed');
 // Force a failure after booking/package mutation and prove complete rollback.
 await sql(`create function fail_finance_item() returns trigger language plpgsql as $$begin if new.client_name='FAIL_AFTER_STATUS' then raise exception 'INJECTED_ITEM_FAILURE'; end if; return new; end$$; create trigger fail_item before insert on staff_shift_items for each row execute function fail_finance_item();`);
 await assert.rejects(sql(`${asActor()} ${save([{...item,clientName:'FAIL_AFTER_STATUS'}])};`),/INJECTED_ITEM_FAILURE/);
 assert.equal(await sql(`select status from bookings where id='${ids.booking}'`),'confirmed');
 assert.equal(await sql(`select remaining_visits from client_visit_packages where id='${ids.pack}'`),'3');
 assert.equal(await sql('select count(*) from client_visit_package_uses'),'0');
 assert.equal(await sql('select count(*) from staff_shift_items'),'0');
 const receipt=JSON.parse((await sql(`${asActor(ids.staffUser,'authenticated')} ${save()};`)).split('\n').at(-1));
 assert.equal(receipt.shift_id,ids.shift);
 assert.equal(receipt.revision,await rev());
 assert.equal(receipt.items[0].id,ids.item);
 assert.equal(receipt.items[0].serviceAmount,500);
 await assert.rejects(sql(`${asActor(ids.staffUser,'authenticated')} update staff_shift_items set service_amount=999 where id='${ids.item}';`),/SHIFT_COMMAND_REQUIRED/);
 await assert.rejects(sql(`${asActor(ids.owner,'authenticated')} delete from staff_shift_items where id='${ids.item}';`),/SHIFT_COMMAND_REQUIRED/);
 await assert.rejects(sql(`${asActor()} ${save([item],0)};`),/SHIFT_STALE/);
 const createdAt=await sql(`select created_at from staff_shift_items where id='${ids.item}'`);
 await sql(`${asActor()} ${save()};`);
 assert.equal(await sql(`select created_at from staff_shift_items where id='${ids.item}'`),createdAt);
 assert.equal(await sql('select count(*) from staff_shift_items'),'1');
 assert.equal(await sql('select count(*) from client_visit_package_uses'),'1');
 assert.equal(await sql(`select remaining_visits from client_visit_packages where id='${ids.pack}'`),'2');
 assert.equal(await sql(`select remaining_visits from client_visit_packages where id='${ids.otherPack}'`),'99');
 assert.equal(await sql(`select total_amount||','||consumables_amount||','||master_share||','||salon_share from staff_shifts where id='${ids.shift}'`),'500.00,100,300,300.00');
 console.log('PASS tenant guards, package business scope, idempotent save and rollback');
 const walkins=[{...item,bookingId:null},{...item,bookingId:null,clientId:ids.otherItem}];
 await sql(`${asActor()} ${save(walkins)};`);
 assert.equal(await sql('select count(*) from staff_shift_items'),'2');
 await sql(`${asActor()} ${save([{clientName:' ',serviceAmount:0,consumablesAmount:0}])};`);
 assert.equal(await sql('select count(*) from staff_shift_items'),'0');
 // A cron command must not finalize an empty ledger with confirmed/paid attendance.
 await assert.rejects(sql(`${asActor()} ${close(await rev()).replace(`'${ids.owner}',`,'null,')};`),/SHIFT_NEEDS_REVIEW/);
 await sql(`${asActor()} ${save()};`);
 // Legacy close catches an aggregate failure; the command must rethrow and roll back attendance too.
 const pending='10000000-0000-4000-8000-000000000003';
 await sql(`insert into bookings(id,biz_id,staff_id,start_at,end_at,status) values('${pending}','${ids.biz}','${ids.staff}','${day} 12:00+06','${day} 13:00+06','hold');
 create function fail_finance_aggregate() returns trigger language plpgsql as $$begin raise exception 'INJECTED_AGGREGATE_FAILURE'; end$$;
 create trigger fail_aggregate before insert on staff_shift_aggregates for each row execute function fail_finance_aggregate();`);
 await assert.rejects(sql(`${asActor()} ${close(await rev())};`),/SHIFT_CLOSE_FAILED/);
 assert.equal(await sql(`select status from bookings where id='${pending}'`),'hold');
 assert.equal(await sql(`select status from staff_shifts where id='${ids.shift}'`),'open');
 await sql('drop trigger fail_aggregate on staff_shift_aggregates');
 // Assert actual overlap: the winner announces its marker only after obtaining row locks.
 async function race(winner,loser,expected,loserIdentity=asActor()) {
  const key=Math.floor(Math.random()*1e9)+1;
  const first=sql(`${asActor()} begin; set local statement_timeout='15s'; ${winner}; select pg_advisory_xact_lock(${key}); select pg_sleep(3); commit;`); first.catch(()=>{});
  let held=false;for(let i=0;i<100;i++){if(await sql(`select count(*) from pg_locks where locktype='advisory' and objid=${key} and granted`)==='1'){held=true;break;}await delay(20);}
  assert.ok(held,'Winner did not reach lock marker');
  const second=sql(`${loserIdentity} set application_name='finance_racer_${key}'; set statement_timeout='15s'; ${loser};`); second.catch(()=>{});
  let waiting=false;for(let i=0;i<40;i++){if(await sql(`select count(*) from pg_stat_activity where application_name='finance_racer_${key}' and wait_event_type='Lock'`)==='1'){waiting=true;break;}await delay(20);}
  assert.ok(waiting,'Commands must overlap on a real PostgreSQL lock');
  await assert.rejects(second,expected);await first;
 }
 let revision=await rev(); await race(save([item],revision),close(revision),/SHIFT_STALE/);
 revision=await rev(); await race(save([item],revision),save([item],revision),/SHIFT_STALE/);
 revision=await rev(); await race(`update staff_shift_items set client_name='Direct edit' where id='${ids.item}'`,close(revision),/SHIFT_STALE/);
 revision=await rev();
 await assert.rejects(sql(`${asActor()} ${close(revision,{percent_master:50,percent_salon:50,hourly_rate:null})};`),/SHIFT_SETTINGS_CHANGED/);
 await race(close(revision),save(),/SHIFT_CLOSED/);
 await sql(`${asActor()} ${close(revision)};`);
 assert.equal(await sql(`select shifts_count from staff_shift_aggregates where period_type='day'`),'1');
 await assert.rejects(sql(`${asActor(ids.staffUser,'authenticated')} insert into staff_shift_items(shift_id,service_amount) values('${ids.shift}',1);`),/SHIFT_COMMAND_REQUIRED/);
 await assert.rejects(sql(`${asActor(ids.staffUser,'authenticated')} update staff_shifts set status='open' where id='${ids.shift}';`),/SHIFT_COMMAND_REQUIRED/);
 console.log('PASS real overlapping Save/Save, Save/Close, direct item/Close, Close/Save locks and direct finance/status guards');
 // Reclose changes authoritative totals, not cumulative increments. Guarantee top-up is not deducted twice.
 await assert.rejects(sql(`${asActor(ids.otherOwner,'authenticated')} select open_staff_shift_safe('${ids.staff}','${ids.biz}','${ids.branch}','${day}','${day} 09:00+06');`),/FINANCE_FORBIDDEN/);
 const reopened=JSON.parse(await sql(`${asActor(ids.staffUser,'authenticated')} select open_staff_shift_safe('${ids.staff}','${ids.biz}','${ids.branch}','${day}','${day} 09:00+06');`));
 assert.equal(reopened.action,'reopened');
 assert.equal(await sql(`select shifts_count from staff_shift_aggregates where period_type='day'`),'0');
 await sql(`update staff set hourly_rate=200 where id='${ids.staff}';`);
 await sql(`${asActor()} ${close(await rev(),{percent_master:60,percent_salon:40,hourly_rate:200},{hoursWorked:2,hourlyRate:200,guaranteedAmount:400,topupAmount:100,finalMasterShare:400,finalSalonShare:200})};`);
 assert.equal(await sql(`select shifts_count||','||total_master||','||total_salon from staff_shift_aggregates where period_type='day'`),'1,400.00,200.00');
 console.log('PASS guarantee aggregation and reclose idempotence');
 // A tenant reassignment while waiting for the row lock cannot retain the old authorization.
 await race(`update bookings set biz_id='${ids.otherBiz}',staff_id='${ids.otherStaff}',branch_id='${ids.otherBranch}',status='paid' where id='${pending}'`,
  `select apply_visit_package_to_booking('${pending}')`,/FINANCE_FORBIDDEN/,asActor(ids.owner,'authenticated'));
 // Execute the promotion query/calculation (not just PL/pgSQL declaration parsing), then retry.
 await sql(`insert into branch_promotions(biz_id,branch_id,promotion_type,title_ru,params) values('${ids.otherBiz}','${ids.otherBranch}','free_after_n_visits','Synthetic free visit','{"visit_count":1}');
 update bookings set status='paid' where id='${ids.otherBooking}';`);
 const promotion=JSON.parse(await sql(`${asActor(ids.otherOwner,'authenticated')} select apply_promotion_to_booking('${ids.otherBooking}');`));
 assert.equal(promotion.applied,true); assert.equal(promotion.original_amount,1000); assert.equal(promotion.final_amount,0);
 await sql(`${asActor(ids.otherOwner,'authenticated')} select apply_promotion_to_booking('${ids.otherBooking}');`);
 assert.equal(await sql(`select count(*) from client_promotion_usage where booking_id='${ids.otherBooking}'`),'1');
 console.log('PASS locked tenant recheck and actual promotion calculation/retry');
 const createCommand=`select save_staff_shift_command('${ids.staff}','${ids.biz}','2026-10-15',${lit([{...item,clientId:'20000000-0000-4000-8000-000000000099',bookingId:null}])},'${ids.owner}',true,null,null)`;
 // A second manager's absent-shift draft cannot replace the first manager's new ledger.
 await race(createCommand,createCommand,/SHIFT_STALE/);
 assert.equal(await sql(`select count(*) from staff_shifts where staff_id='${ids.staff}' and shift_date='2026-10-15'`),'1');
 console.log('PASS absent-shift create/create overlap, required revision and canonical acknowledgement');
 console.log('PASS all isolated finance transaction regressions');
} finally { if(created) await docker(['rm','--force',container]); }

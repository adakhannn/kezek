// Disposable PostgreSQL only: synthetic fixture, no host ports, mounts or credentials.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { setupFinanceFixture, ids, day, asActor } from './lib/finance-transaction-fixture.mjs';
import { race as raceSessions } from './lib/finance-race.mjs';
import { POSTGRES_IMAGE } from './lib/isolated-postgres.cjs';
import { assertLiveFunctions } from './lib/live-schema.cjs';
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
const attendance=(booking,biz,actor)=>`select mark_booking_attendance_command('${booking}','${biz}','${actor}',true)`;
const rev=async()=>Number(await sql(`select ledger_revision from staff_shifts where id='${ids.shift}'`));
// Real overlap: the winner keeps its transaction open until the server sees the loser waiting on
// its locks, then commits (lib/finance-race.mjs). Both sessions are the trusted backend by default.
const race=(winner,loser,expected,options={})=>raceSessions(container,{winner,loser,expected,identity:asActor(),...options});
let created=false;
try {
 await docker(['info','--format','{{.ServerVersion}}']);
 await docker(['run','--detach','--rm','--network','none','--name',container,'-e','POSTGRES_HOST_AUTH_METHOD=trust',POSTGRES_IMAGE]); created=true;
 let ready=false; for(let i=0;i<60;i++){try{assert.equal(await docker(['exec',container,'cat','/proc/1/comm']),'postgres'); await sql('select 1');ready=true;break;}catch{await delay(500);}}
 assert.ok(ready,'PostgreSQL failed to start');
 await setupFinanceFixture(sql);
 console.log('PASS fixture and live finance chain compilation');
 await assert.rejects(sql(`${asActor()} ${save([item],null,null)};`),/SHIFT_STALE/);
 // Another staff member's shift id never addresses this staff member's day (20261110114000).
 await assert.rejects(sql(`${asActor()} ${save([item],0,ids.otherShift)};`),/SHIFT_DATE_MISMATCH/);
 await assert.rejects(sql(`${asActor(ids.owner,'authenticated')} select save_staff_shift_command_internal_v1('${ids.staff}','${ids.biz}','${day}','[]','${ids.owner}',false,null);`),/permission denied/);
 // The direct status and benefit RPCs are closed to every API role (20261110130000); attendance
 // and benefits run through the checked commands.
 for(const role of ['authenticated','service_role']) for(const rpc of [`update_booking_status_no_check('${ids.booking}','paid')`,`update_booking_status_with_promotion('${ids.booking}','paid')`,`apply_visit_package_to_booking('${ids.booking}')`,`apply_promotion_to_booking('${ids.booking}')`])
  await assert.rejects(sql(`${asActor(ids.otherOwner,role)} select ${rpc};`),/permission denied/);
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
 let revision=await rev(); await race(save([item],revision),close(revision),/SHIFT_STALE/);
 revision=await rev(); await race(save([item],revision),save([item],revision),/SHIFT_STALE/);
 revision=await rev(); await race(`update staff_shift_items set client_name='Direct edit' where id='${ids.item}'`,close(revision),/SHIFT_STALE/);
 revision=await rev();
 await assert.rejects(sql(`${asActor()} ${close(revision,{percent_master:50,percent_salon:50,hourly_rate:null})};`),/SHIFT_SETTINGS_CHANGED/);
 // Close gives up after lock_timeout=2s (20261110114000): a writer holding the staff row longer
 // fails it with 55P03 and the shift stays exactly as it was.
 assert.equal(await sql(`select proconfig@>array['lock_timeout=2s','statement_timeout=10s'] from pg_proc where oid='public.close_staff_shift_command(uuid,uuid,bigint,jsonb,jsonb)'::regprocedure`),'t');
 await race(`select id from staff where id='${ids.staff}' for update`,close(revision),/55P03: canceling statement due to lock timeout/,{holdSeconds:3,loserIdentity:`\\set VERBOSITY verbose\n${asActor()}`});
 assert.equal(await rev(),revision);
 assert.equal(await sql(`select status from staff_shifts where id='${ids.shift}'`),'open');
 await race(close(revision),save(),/SHIFT_CLOSED/);
 await sql(`${asActor()} ${close(revision)};`);
 assert.equal(await sql(`select shifts_count from staff_shift_aggregates where period_type='day'`),'1');
 await assert.rejects(sql(`${asActor(ids.staffUser,'authenticated')} insert into staff_shift_items(shift_id,service_amount) values('${ids.shift}',1);`),/SHIFT_COMMAND_REQUIRED/);
 await assert.rejects(sql(`${asActor(ids.staffUser,'authenticated')} update staff_shifts set status='open' where id='${ids.shift}';`),/SHIFT_COMMAND_REQUIRED/);
 console.log('PASS real overlapping Save/Save, Save/Close, direct item/Close, Close/Save locks, Close lock timeout and direct finance/status guards');
 // Reclose changes authoritative totals, not cumulative increments. Guarantee top-up is not deducted twice.
 await assert.rejects(sql(`${asActor(ids.otherOwner,'authenticated')} select open_staff_shift_safe('${ids.staff}','${ids.biz}','${ids.branch}','${day}','${day} 09:00+06');`),/FINANCE_FORBIDDEN/);
 // Reopening a closed shift is a manager operation (20261110114000): the shift's own staff user may not.
 await assert.rejects(sql(`${asActor(ids.staffUser,'authenticated')} select open_staff_shift_safe('${ids.staff}','${ids.biz}','${ids.branch}','${day}','${day} 09:00+06');`),/FINANCE_FORBIDDEN/);
 const reopened=JSON.parse(await sql(`${asActor(ids.owner,'authenticated')} select open_staff_shift_safe('${ids.staff}','${ids.biz}','${ids.branch}','${day}','${day} 09:00+06');`));
 assert.equal(reopened.action,'reopened');
 assert.equal(await sql(`select shifts_count from staff_shift_aggregates where period_type='day'`),'0');
 await sql(`update staff set hourly_rate=200 where id='${ids.staff}';`);
 await sql(`${asActor()} ${close(await rev(),{percent_master:60,percent_salon:40,hourly_rate:200},{hoursWorked:2,hourlyRate:200,guaranteedAmount:400,topupAmount:100,finalMasterShare:400,finalSalonShare:200})};`);
 assert.equal(await sql(`select shifts_count||','||total_master||','||total_salon from staff_shift_aggregates where period_type='day'`),'1,400.00,200.00');
 console.log('PASS manager-only reopen, guarantee aggregation and reclose idempotence');
 // A tenant reassignment while the attendance command waits for the booking row cannot keep the old
 // authorization: the shared transition helper re-reads the booking under its lock (20261110123000).
 const moved=await sql(`select md5('tenant-race')::uuid`);
 await sql(`insert into bookings(id,biz_id,branch_id,staff_id,service_id,client_id,start_at,end_at,status) values('${moved}','${ids.biz}','${ids.branch}','${ids.staff}','${ids.service}','${ids.client}','${day} 15:00+06','${day} 16:00+06','confirmed')`);
 await race(`update bookings set biz_id='${ids.otherBiz}',staff_id='${ids.otherStaff}',branch_id='${ids.otherBranch}' where id='${moved}'`,attendance(moved,ids.biz,ids.owner),/BOOKING_CHANGED/);
 assert.equal(await sql(`select status||','||(subscription_applied is null)||','||(promotion_applied is null) from bookings where id='${moved}'`),'confirmed,true,true');
 assert.equal(await sql(`select (select count(*) from client_visit_package_uses where booking_id='${moved}')+(select count(*) from client_promotion_usage where booking_id='${moved}')`),'0');
 // Execute the promotion query/calculation through the attendance command, for a client without a
 // package in that business; an exact replay is read-only and returns the identical receipt.
 const promoClient=await sql(`select md5('promotion-client')::uuid`),promoBooking=await sql(`select md5('promotion-booking')::uuid`);
 await sql(`insert into auth.users values('${promoClient}');
 insert into branch_promotions(biz_id,branch_id,promotion_type,title_ru,params) values('${ids.otherBiz}','${ids.otherBranch}','free_after_n_visits','Synthetic free visit','{"visit_count":1}');
 insert into bookings(id,biz_id,branch_id,staff_id,service_id,client_id,start_at,end_at,status) values('${promoBooking}','${ids.otherBiz}','${ids.otherBranch}','${ids.otherStaff}','${ids.otherService}','${promoClient}','${day} 12:00+06','${day} 13:00+06','confirmed');`);
 const promotion=JSON.parse(await sql(`${asActor()} ${attendance(promoBooking,ids.otherBiz,ids.otherOwner)};`));
 assert.equal(promotion.status,'paid'); assert.equal(promotion.promotion_applied,true); assert.equal(promotion.subscription_applied,false);
 assert.deepEqual(promotion.promotion_info,{title:'Synthetic free visit',discount_percent:100,discount_amount:1000,final_amount:0});
 const applied=JSON.parse(await sql(`select promotion_applied from bookings where id='${promoBooking}'`));
 assert.equal(applied.promotion_type,'free_after_n_visits'); assert.equal(applied.original_amount,1000); assert.equal(applied.final_amount,0);
 assert.deepEqual(JSON.parse(await sql(`${asActor()} ${attendance(promoBooking,ids.otherBiz,ids.otherOwner)};`)),promotion);
 assert.equal(await sql(`select count(*) from client_promotion_usage where booking_id='${promoBooking}'`),'1');
 console.log('PASS locked tenant recheck and actual promotion calculation/replay through the attendance command');
 // Two managers create the absent shift of the business-local today at once (p_shift_date null,
 // 20261110114000): one ledger is created and the second draft cannot replace it.
 const createCommand=`select save_staff_shift_command('${ids.staff}','${ids.biz}',null,${lit([{...item,clientId:'20000000-0000-4000-8000-000000000099',bookingId:null}])},'${ids.owner}',true,null,null)`;
 const createdShift=JSON.parse((await race(createCommand,createCommand,/SHIFT_STALE/)).split('\n').at(-1)).shift_id;
 assert.equal(await sql(`select count(*) from staff_shifts where staff_id='${ids.staff}' and shift_date=(select shift_date from staff_shifts where id='${createdShift}')`),'1');
 assert.equal(await sql(`select shift_date in ((now() at time zone 'Asia/Bishkek')::date,((now()-interval '10 minutes') at time zone 'Asia/Bishkek')::date) from staff_shifts where id='${createdShift}'`),'t');
 assert.equal(await sql(`select count(*) from staff_shift_items where shift_id='${createdShift}'`),'1');
 console.log('PASS absent-shift create/create overlap on the business-local today, required revision and canonical acknowledgement');
 await assertLiveFunctions(sql, { suite: 'test-finance-transactions.mjs' });
 console.log('PASS all isolated finance transaction regressions');
} finally { if(created) await docker(['rm','--force',container]); }

// Synthetic PostgreSQL only. Runs the live finance chain of the shared fixture, including the shared transition helper from 20261110123000.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { setupFinanceFixture, ids, asActor, day } from './lib/finance-transaction-fixture.mjs';
import { POSTGRES_IMAGE } from './lib/isolated-postgres.cjs';
import { assertLiveFunctions } from './lib/live-schema.cjs';
const container='kezek-attendance-test-'+randomUUID();
function docker(args,input=''){return new Promise((resolve,reject)=>{const p=spawn('docker',args,{windowsHide:true});let out='',err='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);p.on('error',reject);p.on('close',code=>code===0?resolve(out.trim()):reject(new Error(err||out)));p.stdin.end(input);});}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const sql=text=>docker(['exec','-i',container,'psql','-X','-q','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At'],text);
const command=(id=ids.booking,biz=ids.biz,actor=ids.owner,attended=true)=>'select mark_booking_attendance_command('+[id,biz,actor].map(v=>v===null?'null':"'"+v+"'").join(',')+','+attended+');';
const call=async query=>JSON.parse(await sql(asActor()+query));
let created=false;
try {
 await docker(['run','--detach','--rm','--network','none','--tmpfs','/var/lib/postgresql/data','--name',container,'-e','POSTGRES_HOST_AUTH_METHOD=trust',POSTGRES_IMAGE]);created=true;
 let ready=false;for(let i=0;i<120;i++){try{if((await docker(['exec',container,'cat','/proc/1/comm'])).trim()==='postgres'){await sql('select 1');ready=true;break;}}catch{/* starting */}await delay(500);}assert.ok(ready);
 // The fixture runs the finance chain with 20261110130000_booking_attendance_command and the shared
 // transition helper of 20261110123000; the complete booking migration has its own runner.
 await setupFinanceFixture(sql);
 // 20261119020000 dropped the aggregate initializer that 20261110130000 had made service-only.
 assert.equal(await sql("select to_regprocedure('public.initialize_shift_aggregates(uuid,uuid)') is null"),'t');
 for(const role of ['anon','authenticated'])await assert.rejects(sql(asActor(ids.owner,role)+command()),/permission denied/);
 for(const role of ['authenticated','service_role']) for(const rpc of ['update_booking_status_no_check','update_booking_status_with_promotion']) await assert.rejects(sql(asActor(ids.owner,role)+"select "+rpc+"('"+ids.booking+"','paid');"),/permission denied/);
 for(const role of ['authenticated','service_role']) for(const rpc of ['apply_visit_package_to_booking','apply_promotion_to_booking'])await assert.rejects(sql(asActor(ids.owner,role)+"select "+rpc+"('"+ids.booking+"');"),/permission denied/);
 await assert.rejects(call(command(ids.booking,ids.biz,null)),/BOOKING_FORBIDDEN/);
 await assert.rejects(call(command(ids.booking,ids.biz,ids.otherOwner)),/BOOKING_FORBIDDEN/);
 await assert.rejects(call(command(ids.booking,ids.otherBiz,ids.otherOwner)),/BOOKING_FORBIDDEN/);
 await assert.rejects(call(command(ids.booking,ids.biz,ids.staffUser)),/BOOKING_FORBIDDEN/);
 console.log('PASS mandatory verified manager actor, tenant scope and legacy RPC ACL');
 // Force genuine overlap: first command has committed its changes only inside its open transaction.
 const first=sql("set application_name='attendance_overlap'; begin; "+asActor()+command()+"select pg_sleep(2); commit;").then(JSON.parse);
 let overlap=false;for(let i=0;i<40;i++){if(await sql("select count(*) from pg_stat_activity where application_name='attendance_overlap' and wait_event='PgSleep'")==='1'){overlap=true;break;}await delay(50);}assert.ok(overlap);
 const second=await call(command()),receipt=await first;
 assert.deepEqual(second,receipt);assert.equal(receipt.status,'paid');assert.equal(receipt.subscription_applied,true);assert.equal(receipt.promotion_info.final_amount,500);
 assert.equal(await sql("select remaining_visits from client_visit_packages where id='"+ids.pack+"'"),'2');
 assert.equal(await sql("select count(*) from client_visit_package_uses where booking_id='"+ids.booking+"'"),'1');
 assert.equal(await sql("select count(*) from staff_shift_items where booking_id='"+ids.booking+"'"),'0');
 await assert.rejects(call(command(ids.booking,ids.biz,ids.owner,false)),/BOOKING_FINANCIAL_REVIEW_REQUIRED/);
 console.log('PASS real simultaneous attendance replay consumes one benefit and returns identical authoritative receipt without fabricated ledger');
 const make=async(key,status='confirmed',future=false)=>{const id=await sql("select md5('"+key+"')::uuid");await sql("insert into bookings(id,biz_id,branch_id,staff_id,service_id,client_id,start_at,end_at,status) values('"+id+"','"+ids.biz+"','"+ids.branch+"','"+ids.staff+"','"+ids.service+"','"+ids.client+"',"+(future?"now()+interval '1 day'":"'"+day+" 12:00+06'")+","+(future?"now()+interval '2 days'":"'"+day+" 13:00+06'")+",'"+status+"')");return id;};
 const noShow=await make('no-show');const absent=await call(command(noShow,ids.biz,ids.owner,false));assert.equal(absent.status,'no_show');assert.deepEqual(await call(command(noShow,ids.biz,ids.owner,false)),absent);await assert.rejects(call(command(noShow)),/BOOKING_FINANCIAL_REVIEW_REQUIRED/);
 await assert.rejects(call(command(await make('cancelled','cancelled'))),/BOOKING_FINANCIAL_REVIEW_REQUIRED/);
 await assert.rejects(call(command(await make('future','confirmed',true))),/BOOKING_NOT_IN_PAST/);
 const ledger=await make('ledger-inconsistent');await sql(asActor()+"insert into staff_shift_items(shift_id,booking_id,service_amount,consumables_amount) values('"+ids.shift+"','"+ledger+"',1000,0)");
 await assert.rejects(call(command(ledger)),/BOOKING_FINANCIAL_REVIEW_REQUIRED/);await assert.rejects(call(command(ledger,ids.biz,ids.owner,false)),/BOOKING_FINANCIAL_REVIEW_REQUIRED/);
 const rollback=await make('rollback');
 await sql("create function attendance_test_failure() returns trigger language plpgsql as $$begin if new.booking_id='"+rollback+"' then raise exception 'SYNTHETIC_DEBIT_FAILURE'; end if; return new; end$$; create trigger attendance_test_failure before insert on client_visit_package_uses for each row execute function attendance_test_failure();");
 await assert.rejects(call(command(rollback)),/SYNTHETIC_DEBIT_FAILURE/);
 assert.equal(await sql("select status from bookings where id='"+rollback+"'"),'confirmed');assert.equal(await sql("select remaining_visits from client_visit_packages where id='"+ids.pack+"'"),'2');assert.equal(await sql("select count(*) from client_visit_package_uses where booking_id='"+rollback+"'"),'0');
 console.log('PASS future/final/ledger contradictions rejected and benefit failure rolls back status/debit/use together');
 // A platform super_admin (user_global_roles, scope platform; 20261110131000) manages every business;
 // the same role key with a business scope in that table does not.
 const platformRole=randomUUID(),businessRole=randomUUID(),platformAdmin=randomUUID(),scopedAdmin=randomUUID();
 await sql("insert into roles(id,key,scope) values('"+platformRole+"','super_admin','platform'),('"+businessRole+"','super_admin','business'); insert into user_global_roles values('"+platformAdmin+"','"+platformRole+"'),('"+scopedAdmin+"','"+businessRole+"');");
 const adminBooking=await make('platform-admin');
 await assert.rejects(call(command(adminBooking,ids.biz,scopedAdmin)),/BOOKING_FORBIDDEN/);
 assert.equal(await sql("select status from bookings where id='"+adminBooking+"'"),'confirmed');
 const byAdmin=await call(command(adminBooking,ids.biz,platformAdmin));assert.equal(byAdmin.status,'paid');assert.equal(byAdmin.subscription_applied,true);
 assert.equal(await sql("select remaining_visits from client_visit_packages where id='"+ids.pack+"'"),'1');
 console.log('PASS platform-scoped global super_admin allowed, business-scoped global role rejected');
 // R25-04 (20261125140000): a benefit prices every service of the booking (booking_services), and a
 // range price counts at its exact midpoint. ids.service is the 1000 haircut of each business.
 const coloring=randomUUID(),otherColoring=randomUUID(),oddRange=randomUUID(),promoClient=randomUUID(),oddClient=randomUUID();
 await sql(`insert into services(id,biz_id,price_from,price_to) values('${coloring}','${ids.biz}',3000,3000),('${otherColoring}','${ids.otherBiz}',3000,3000),('${oddRange}','${ids.otherBiz}',1000,1501);
 insert into auth.users values('${promoClient}'),('${oddClient}');`);
 const book=async(key,{biz=ids.biz,branch=ids.branch,staff=ids.staff,client=ids.client,service=ids.service,extra=[],hour=14}={})=>{
  const id=await sql(`select md5('${key}')::uuid`);
  await sql(`insert into bookings(id,biz_id,branch_id,staff_id,service_id,client_id,start_at,end_at,status) values('${id}','${biz}','${branch}','${staff}','${service}','${client}','${day} ${hour}:00+06','${day} ${hour}:30+06','confirmed');`
   +(extra.length?`insert into booking_services(booking_id,service_id,order_index) select '${id}',s,o-1 from unnest(array['${[service,...extra].join("','")}']::uuid[]) with ordinality u(s,o);`:''));
  return id;
 };
 const benefit=async id=>JSON.parse(await sql(`select coalesce(subscription_applied,promotion_applied) from bookings where id='${id}'`));
 // 50% package (ids.pack has one visit left): haircut 1000 + coloring 3000 -> 2000, not 500.
 const packMulti=await book('package-multi',{extra:[coloring]});
 const packReceipt=await call(command(packMulti));assert.equal(packReceipt.subscription_applied,true);assert.equal(packReceipt.promotion_info.final_amount,2000);
 assert.equal((await benefit(packMulti)).final_amount,2000);assert.equal(await sql(`select remaining_visits from client_visit_packages where id='${ids.pack}'`),'0');
 // 100% package of the other business: the whole booking is 0.
 const freeMulti=await book('package-free-multi',{biz:ids.otherBiz,branch:ids.otherBranch,staff:ids.otherStaff,service:ids.otherService,extra:[otherColoring],hour:10});
 assert.equal((await call(command(freeMulti,ids.otherBiz,ids.otherOwner))).subscription_applied,true);assert.equal((await benefit(freeMulti)).final_amount,0);
 // 10% first-visit promotion: 1000 + 3000 -> original 4000, final 3600 (was 900 from the haircut alone).
 await sql(`insert into branch_promotions(biz_id,branch_id,promotion_type,title_ru,params) values('${ids.otherBiz}','${ids.otherBranch}','first_visit_discount','Synthetic first visit','{"discount_percent":10}');`);
 const promoMulti=await book('promotion-multi',{biz:ids.otherBiz,branch:ids.otherBranch,staff:ids.otherStaff,client:promoClient,service:ids.otherService,extra:[otherColoring],hour:11});
 const promoReceipt=await call(command(promoMulti,ids.otherBiz,ids.otherOwner));assert.equal(promoReceipt.promotion_applied,true);
 assert.deepEqual(promoReceipt.promotion_info,{title:'Synthetic first visit',discount_percent:10,discount_amount:400,final_amount:3600});
 const promoApplied=await benefit(promoMulti);assert.equal(promoApplied.original_amount,4000);assert.equal(promoApplied.final_amount,3600);
 // A single-service booking without booking_services rows and an odd range 1000..1501: base 1250.50
 // (integer division made it 1250), final round(1250.50 * 0.9, 2) = 1125.45.
 const oddBooking=await book('promotion-odd-range',{biz:ids.otherBiz,branch:ids.otherBranch,staff:ids.otherStaff,client:oddClient,service:oddRange,hour:12});
 assert.equal((await call(command(oddBooking,ids.otherBiz,ids.otherOwner))).promotion_applied,true);
 assert.equal(await sql(`select (promotion_applied->>'original_amount')||','||(promotion_applied->>'final_amount') from bookings where id='${oddBooking}'`),'1250.50,1125.45');
 console.log('PASS package and promotion price every service of the booking; range midpoint is exact');
 // The shift close still accepts the benefit amounts (20261110113000 compares staff_shift_items.service_amount
 // with final_amount): the manager enters the full booking amount, save keeps it, and close succeeds.
 const shiftItems=[[freeMulti,0],[promoMulti,3600],[oddBooking,1125.45]].map(([bookingId,serviceAmount])=>({clientId:randomUUID(),bookingId,clientName:'Synthetic',serviceName:'Multi',serviceAmount,consumablesAmount:0}));
 const otherRevision=()=>`(select ledger_revision from staff_shifts where id='${ids.otherShift}')`;
 await sql(`${asActor()} select save_staff_shift_command('${ids.otherStaff}','${ids.otherBiz}','${day}','${JSON.stringify(shiftItems)}'::jsonb,'${ids.otherOwner}',false,${otherRevision()},'${ids.otherShift}');`);
 assert.deepEqual(JSON.parse(await sql(`select json_agg(i.service_amount order by i.service_amount) from staff_shift_items i where i.shift_id='${ids.otherShift}'`)),[0,1125.45,3600]);
 await sql(`${asActor()} select close_staff_shift_command('${ids.otherShift}','${ids.otherOwner}',${otherRevision()},'{"percent_master":60,"percent_salon":40,"hourly_rate":null}'::jsonb,
  '${JSON.stringify({totalAmount:4725.45,totalConsumables:0,normalizedPercentMaster:60,normalizedPercentSalon:40,finalMasterShare:2835.27,finalSalonShare:1890.18,hoursWorked:null,hourlyRate:null,guaranteedAmount:0,topupAmount:0,closedAt:`${day}T18:00:00+06:00`})}'::jsonb);`);
 assert.deepEqual(JSON.parse(await sql(`select json_build_array(status,total_amount) from staff_shifts where id='${ids.otherShift}'`)),['closed',4725.45]);
 console.log('PASS shift with multi-service benefit amounts saves and closes without SHIFT_PRICING_CHANGED');
 await assertLiveFunctions(sql, { suite: 'test-attendance-command-isolated.mjs' });
 console.log('PASS all isolated attendance command regressions');
}finally{if(created)await docker(['rm','--force',container]);}

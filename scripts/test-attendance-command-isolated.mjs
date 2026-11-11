// Synthetic PostgreSQL only. Uses actual finance definitions plus the shared transition helper from123000.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { setupFinanceFixture, ids, asActor, day } from './lib/finance-transaction-fixture.mjs';
const container='kezek-attendance-test-'+randomUUID();
function docker(args,input=''){return new Promise((resolve,reject)=>{const p=spawn('docker',args,{windowsHide:true});let out='',err='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);p.on('error',reject);p.on('close',code=>code===0?resolve(out.trim()):reject(new Error(err||out)));p.stdin.end(input);});}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const sql=text=>docker(['exec','-i',container,'psql','-X','-q','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At'],text);
const load=name=>fs.readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
const command=(id=ids.booking,biz=ids.biz,actor=ids.owner,attended=true)=>'select mark_booking_attendance_command('+[id,biz,actor].map(v=>v===null?'null':"'"+v+"'").join(',')+','+attended+');';
const call=async query=>JSON.parse(await sql(asActor()+query));
let created=false;
try {
 await docker(['run','--detach','--rm','--network','none','--tmpfs','/var/lib/postgresql/data','--name',container,'-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:16']);created=true;
 let ready=false;for(let i=0;i<60;i++){try{await sql('select 1');ready=true;break;}catch{await delay(500);}}assert.ok(ready);
 await setupFinanceFixture(sql);
 const agg=await load('20260212000000_create_shift_aggregates.sql');await sql(agg.slice(agg.indexOf('create or replace function public.initialize_shift_aggregates'),agg.indexOf('comment on function public.initialize_shift_aggregates')));
 // This runner covers attendance and its shared locks; the complete booking123000 migration has its own runner/actual-schema replay.
 const shared=await load('20261110123000_service_only_booking_commands.sql');
 const start=shared.indexOf('create function public._assert_booking_transition_access('),end=shared.indexOf('create or replace function public.confirm_booking(',start);
 assert.ok(start>=0&&end>start);await sql(shared.slice(start,end));
 await sql(await load('20261110130000_booking_attendance_command.sql'));
 await assert.rejects(sql(asActor(ids.owner,'authenticated')+'select initialize_shift_aggregates(null,null);'),/permission denied/);
 for(const role of ['anon','authenticated'])await assert.rejects(sql(asActor(ids.owner,role)+command()),/permission denied/);
 for(const role of ['authenticated','service_role']) for(const rpc of ['update_booking_status_no_check','update_booking_status_with_promotion']) await assert.rejects(sql(asActor(ids.owner,role)+"select "+rpc+"('"+ids.booking+"','paid');"),/permission denied/);
 for(const rpc of ['apply_visit_package_to_booking','apply_promotion_to_booking'])await assert.rejects(sql(asActor(ids.owner,'authenticated')+"select "+rpc+"('"+ids.booking+"');"),/permission denied/);
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
 console.log('PASS all isolated attendance command regressions');
}finally{if(created)await docker(['rm','--force',container]);}

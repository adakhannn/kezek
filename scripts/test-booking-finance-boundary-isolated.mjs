// Genuine finance/cancellation races. Disposable synthetic PostgreSQL only.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { setupFinanceFixture, ids, day, asActor } from './lib/finance-transaction-fixture.mjs';
const container=`kezek-booking-finance-${randomUUID()}`;
function docker(args,input='') { return new Promise((resolve,reject)=>{
 const p=spawn('docker',args,{windowsHide:true});let out='',err='';
 p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);p.on('error',reject);
 p.on('close',code=>code===0?resolve(out.trim()):reject(new Error(err||out)));p.stdin.end(input);
}); }
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const sql=text=>docker(['exec','-i',container,'psql','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1'],text);
const load=name=>fs.readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
const lit=value=>`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`;
const item={clientId:ids.item,bookingId:ids.booking,clientName:'Synthetic',serviceName:'Service',serviceAmount:1000,consumablesAmount:100};
const save=revision=>`select save_staff_shift_command('${ids.staff}','${ids.biz}','${day}',${lit([item])},'${ids.owner}',false,${revision},'${ids.shift}')`;
const cancel=`select cancel_booking('${ids.booking}')`;
const revision=async()=>Number(await sql(`select ledger_revision from staff_shifts where id='${ids.shift}'`));
async function race(winner,loser,rejection) {
 const marker=Math.floor(Math.random()*1e9)+1;
 // Keep the winning transaction open until the competing session is observed
 // waiting. A fixed pg_sleep can expire while Docker starts the second psql.
 const p=spawn('docker',['exec','-i',container,'psql','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1'],{windowsHide:true});
 let out='',err='';let markReady;
 const ready=new Promise(resolve=>{markReady=resolve;});
 p.stdout.on('data',chunk=>{out+=chunk;if(out.includes(`COMMAND_LOCKS_HELD_${marker}`))markReady();});
 p.stderr.on('data',chunk=>err+=chunk);
 const first=new Promise((resolve,reject)=>{p.on('error',reject);p.on('close',code=>code===0?resolve():reject(new Error(err||out)));});
 first.catch(()=>{});
 let timer;
 try {
  p.stdin.write(`${asActor()} begin; set local statement_timeout='15s'; set local idle_in_transaction_session_timeout='30s'; ${winner};\n\\echo COMMAND_LOCKS_HELD_${marker}\n`);
  await Promise.race([ready,first.then(()=>{throw new Error('Winner exited before lock barrier');}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Winner did not reach lock barrier')),15000);})]);
  clearTimeout(timer);
  const second=sql(`${asActor()} set application_name='booking_finance_${marker}'; set statement_timeout='15s'; ${loser};`);second.catch(()=>{});
  let waits=false;const deadline=Date.now()+10000;
  while(Date.now()<deadline) {
   if(await sql(`select exists(select 1 from pg_stat_activity where application_name='booking_finance_${marker}' and wait_event_type='Lock')`)==='t'){waits=true;break;}await delay(20);
  }
  assert(waits,'loser must wait on real row locks, not a sequential test');
  p.stdin.end('commit;\n');
  await first;await assert.rejects(second,rejection);
 } finally {
  clearTimeout(timer);
  if(!p.stdin.writableEnded)p.stdin.end('rollback;\n');
  await first.catch(()=>{});
 }
}
let created=false;
try {
 await docker(['image','inspect','postgres:16']);
 await docker(['run','--detach','--rm','--network','none','--tmpfs','/var/lib/postgresql/data','--name',container,'-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:16']);created=true;
 let ready=false;for(let i=0;i<60;i++){try{assert.equal(await docker(['exec',container,'cat','/proc/1/comm']),'postgres');await sql('select 1');ready=true;break;}catch{await delay(250);}}assert(ready);
 await setupFinanceFixture(sql);
 await sql('alter table staff_shifts rename constraint staff_shifts_hours_worked_check to staff_shifts_hours_worked_range');
 await sql(await load('20261110113000_shift_close_backlog.sql'));
 await sql(await load('20261110114000_finance_calendar.sql'));
 await sql(`alter table bookings add expires_at timestamptz;
   alter table roles add scope text;
   create table branch_admins(branch_id uuid,user_id uuid);
   create table user_global_roles(user_id uuid,role_id uuid);
   create table super_admins_legacy(user_id uuid);`);
 await sql(await fs.readFile(new URL('./fixtures/booking-authority-helpers.sql',import.meta.url),'utf8'));
 await sql(await load('20261110090000_booking_notification_outbox.sql'));
 // Exact lifecycle functions + ACL from the production migration; booking
 // creation helpers are exercised by the separate booking-request runner.
 const boundary=await load('20261110123000_service_only_booking_commands.sql');
 const start=boundary.indexOf('CREATE OR REPLACE FUNCTION public._confirm_booking_transition(');
 const end=boundary.indexOf('-- Deprecated internal wrappers');assert(start>0&&end>start);
 await sql(boundary.slice(start,end));
 await race(cancel,save(await revision()),/SHIFT_BOOKING_CANCELLED/);
 assert.equal(await sql(`select status from bookings where id='${ids.booking}'`),'cancelled');
 assert.equal(await sql('select count(*) from staff_shift_items'),'0');
 assert.equal(await sql('select count(*) from client_visit_package_uses'),'0');
 await sql(`update bookings set status='confirmed' where id='${ids.booking}'`);
 await race(save(await revision()),cancel,/BOOKING_FINANCIAL_REVERSAL_REQUIRED/);
 assert.equal(await sql(`select status from bookings where id='${ids.booking}'`),'paid');
 assert.equal(await sql('select count(*) from staff_shift_items'),'1');
 assert.equal(await sql('select count(*) from client_visit_package_uses'),'1');
 assert.equal(await sql(`select remaining_visits from client_visit_packages where id='${ids.pack}'`),'2');
 const snapshot=await sql(`select row_to_json(i) from staff_shift_items i where id='${ids.item}'`);
 const calculation={totalAmount:500,totalConsumables:100,normalizedPercentMaster:60,normalizedPercentSalon:40,
  finalMasterShare:300,finalSalonShare:300,hoursWorked:null,hourlyRate:null,guaranteedAmount:0,topupAmount:0,closedAt:`${day}T12:00:00+06:00`};
 const close=`select close_staff_shift_command('${ids.shift}','${ids.owner}',${await revision()},${lit({percent_master:60,percent_salon:40,hourly_rate:null})},${lit(calculation)})`;
 await race(close,cancel,/BOOKING_FINANCIAL_REVERSAL_REQUIRED/);
 assert.equal(await sql(`select status from staff_shifts where id='${ids.shift}'`),'closed');
 assert.equal(await sql(`select status from bookings where id='${ids.booking}'`),'paid');
 assert.equal(await sql(`select row_to_json(i) from staff_shift_items i where id='${ids.item}'`),snapshot);
 assert.equal(await sql('select count(*) from client_visit_package_uses'),'1');
 assert.equal(await sql(`select count(*) from booking_notification_outbox where booking_id='${ids.booking}' and event_type='cancel'`),'1','only the first successful cancellation enqueued');
 console.log('PASS actual cancellation vs Save/Close: real concurrent row-lock waits; cancel-first save rollback; save/close-first cancellation conflict; ledger/package/status/outbox invariants preserved. PostgreSQL16, synthetic records only.');
} finally {
 if(created&&/^kezek-booking-finance-[0-9a-f-]{36}$/.test(container))await docker(['rm','-f','-v',container]);
}

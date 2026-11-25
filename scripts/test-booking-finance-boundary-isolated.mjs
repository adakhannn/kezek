// Genuine finance/cancellation races. Disposable synthetic PostgreSQL only.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { setupFinanceFixture, ids, day, asActor, migration, migrationPart, dropRetiredFunctions } from './lib/finance-transaction-fixture.mjs';
import { race as raceSessions } from './lib/finance-race.mjs';
import { POSTGRES_IMAGE } from './lib/isolated-postgres.cjs';
import { assertLiveFunctions } from './lib/live-schema.cjs';
const container=`kezek-booking-finance-${randomUUID()}`;
function docker(args,input='') { return new Promise((resolve,reject)=>{
 const p=spawn('docker',args,{windowsHide:true});let out='',err='';
 p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);p.on('error',reject);
 p.on('close',code=>code===0?resolve(out.trim()):reject(new Error(err||out)));p.stdin.end(input);
}); }
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const sql=text=>docker(['exec','-i',container,'psql','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1'],text);
const lit=value=>`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`;
const item={clientId:ids.item,bookingId:ids.booking,clientName:'Synthetic',serviceName:'Service',serviceAmount:1000,consumablesAmount:100};
const save=revision=>`select save_staff_shift_command('${ids.staff}','${ids.biz}','${day}',${lit([item])},'${ids.owner}',false,${revision},'${ids.shift}')`;
const cancel=`select cancel_booking('${ids.booking}')`;
const revision=async()=>Number(await sql(`select ledger_revision from staff_shifts where id='${ids.shift}'`));
// The winner keeps its transaction open until the loser is seen waiting on its row locks
// (lib/finance-race.mjs): a real overlap, not a sequential test or a fixed sleep.
const race=(winner,loser,rejection)=>raceSessions(container,{winner,loser,expected:rejection,identity:asActor()});
let created=false;
try {
 await docker(['image','inspect',POSTGRES_IMAGE]);
 await docker(['run','--detach','--rm','--network','none','--tmpfs','/var/lib/postgresql/data','--name',container,'-e','POSTGRES_HOST_AUTH_METHOD=trust',POSTGRES_IMAGE]);created=true;
 let ready=false;for(let i=0;i<60;i++){try{assert.equal(await docker(['exec',container,'cat','/proc/1/comm']),'postgres');await sql('select 1');ready=true;break;}catch{await delay(250);}}assert(ready);
 // The fixture runs the live finance chain with the shared transition helper of 20261110123000.
 await setupFinanceFixture(sql);
 // The outbox counts cancellations; its old claim function was dropped later (20261119020000).
 await sql(await migration('20261110090000_booking_notification_outbox.sql'));
 await dropRetiredFunctions(sql);
 // Checked cancellation with its ACL and the bookings write revokes, from the production migration;
 // booking creation helpers are exercised by the separate booking-request runner.
 await sql(await migrationPart('20261110123000_service_only_booking_commands.sql','create or replace function public.cancel_booking(','-- Deprecated internal wrappers'));
 // R25-10: cancel_booking as 20261125150000 redefines it (client cut-off at the start).
 await sql(await migration('20261125150000_client_cancel_cutoff.sql'));
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
 await assertLiveFunctions(sql, { suite: 'test-booking-finance-boundary-isolated.mjs' });
 console.log('PASS actual cancellation vs Save/Close: real concurrent row-lock waits; cancel-first save rollback; save/close-first cancellation conflict; ledger/package/status/outbox invariants preserved on the live finance chain. Synthetic records only.');
} finally {
 if(created&&/^kezek-booking-finance-[0-9a-f-]{36}$/.test(container))await docker(['rm','-f','-v',container]);
}

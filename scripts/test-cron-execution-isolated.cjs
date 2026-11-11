// Synthetic PostgreSQL only; no ports, mounted files, remote URLs or credentials.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {randomUUID}=require('node:crypto');
const container=`kezek-cron-test-${randomUUID()}`;
const docker=(args,input='')=>new Promise((resolve,reject)=>{
 const child=spawn('docker',args,{windowsHide:true});let out='',err='';
 child.stdout.on('data',data=>out+=data);child.stderr.on('data',data=>err+=data);
 child.on('error',reject);child.on('close',code=>code===0?resolve(out.trim()):reject(new Error(err||out||`exit ${code}`)));
 child.stdin.end(input);
});
const sql=input=>docker(['exec','-i',container,'psql','-X','-q','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At'],input);
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let created=false;
(async()=>{
 try {
  await docker(['run','--detach','--rm','--network','none','--name',container,'-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:16']);created=true;
  let ready=false;for(let i=0;i<60;i++){try{await sql('select 1');ready=true;break;}catch{await pause(500);}}
  assert.ok(ready,'PostgreSQL did not start');
  await sql('create role anon; create role authenticated; create role service_role;');
  await sql(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261110113500_cron_execution_tracking.sql'),'utf8'));
  const id=randomUUID(),second=randomUUID();
  await Promise.all(Array.from({length:8},()=>sql(`set role service_role; select start_cron_execution('${id}','close-shifts');`)));
  assert.equal(await sql('select count(*) from cron_executions'),'1');
  await sql(`set role service_role; select start_cron_execution('${second}','close-shifts'); select finish_cron_execution('${second}','succeeded',200);`);
  await sql(`set role service_role; select finish_cron_execution('${id}','failed',500,'handler_failed'); select finish_cron_execution('${id}','failed',500,'handler_failed');`);
  const health=JSON.parse(await sql('set role service_role; select read_cron_execution_health();'));
  assert.equal(health.length,1);assert.ok(health[0].last_success_at);assert.ok(health[0].last_failure_at);assert.equal(health[0].running_count,0);
  await assert.rejects(sql(`set role service_role; select finish_cron_execution('${id}','succeeded',200);`),/CRON_EXECUTION_ALREADY_FINISHED/);
  await assert.rejects(sql(`set role service_role; select start_cron_execution('${id}','data-retention');`),/CRON_EXECUTION_CONFLICT/);
  await assert.rejects(sql(`set role service_role; select finish_cron_execution('${second}','succeeded',500);`),/CRON_EXECUTION_INVALID/);
  await assert.rejects(sql(`set role authenticated; select start_cron_execution('${randomUUID()}','close-shifts');`),/permission denied/);
  await assert.rejects(sql('set role anon; select read_cron_execution_health();'),/permission denied/);
  await assert.rejects(sql(`set role service_role; update cron_executions set outcome='succeeded';`),/permission denied/);
  const abandoned=randomUUID();
  await sql(`insert into cron_executions(id,job,started_at) values('${abandoned}','close-shifts',now()-interval '16 minutes');
    insert into cron_executions(id,job,started_at) select gen_random_uuid(),'old-job',now()-interval '31 days' from generate_series(1,250);
    set role service_role;select start_cron_execution('${randomUUID()}','close-shifts');`);
  assert.equal(await sql(`select outcome||':'||error_code from cron_executions where id='${abandoned}'`),'failed:execution_expired');
  assert.equal(await sql("select count(*) from cron_executions where job='old-job'"),'50');
  console.log('PASS cron: concurrent idempotent starts, independent overlapping receipts, failure persistence, invalid transitions, ACL, bounded retention, abandoned-run recovery');
 }finally{if(created){await docker(['rm','--force',container]);console.log('Removed owned isolated cron container');}}
})().catch(error=>{console.error(error.message);process.exitCode=1;});

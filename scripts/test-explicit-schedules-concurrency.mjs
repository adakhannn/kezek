// Dedicated, disposable Docker PostgreSQL; no host ports, volumes or production credentials.
// node scripts/test-explicit-schedules-concurrency.mjs
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { setupScheduleFixture, biz, branch, branch2, staff, owner } from './lib/explicit-schedule-fixture.mjs';

const container = `kezek-schedule-test-${randomUUID()}`;
function docker(args, input='') {
    return new Promise((resolve,reject) => {
        const child=spawn('docker',args,{windowsHide:true}); let out='',err='';
        child.stdout.on('data',d=>out+=d); child.stderr.on('data',d=>err+=d);
        child.on('error',reject);
        child.on('close',code=>code===0?resolve(out.trim()):reject(new Error(err||out||`docker exit ${code}`)));
        child.stdin.end(input);
    });
}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const sql=text=>docker(['exec','-i',container,'psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At'],text);
await docker(['info','--format','{{.ServerVersion}}']);
let created=false;
try {
    await docker(['run','--detach','--rm','--network','none','--name',container,'-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:16']); created=true;
    let ready=false;
    for(let i=0;i<60;i++) {
        try { await docker(['exec',container,'pg_isready','-U','postgres']); ready=true; break; }
        catch { await delay(500); }
    }
    assert.ok(ready,'Isolated PostgreSQL failed to start');
    await setupScheduleFixture({exec:sql});
    const day={intervals:[{start:'09:00',end:'18:00'}],breaks:[]};
    const week=JSON.stringify(Object.fromEntries(Array.from({length:7},(_,i)=>[i+1,day])));
    const publish=`select publish_staff_schedule('${staff}','${biz}','${owner}',0,'week','2099-01-05','${branch}','${week}')`;
    const booking=`insert into bookings(staff_id,biz_id,branch_id,start_at,end_at,status) values('${staff}','${biz}','${branch}','2099-01-05 09:00+06','2099-01-05 10:00+06','confirmed')`;
    async function race(winner,loser,expectedError) {
        const key=Math.floor(Math.random()*1000000000)+1;
        // Advisory marker is acquired AFTER the tested row lock and held through commit.
        // No timing assumption about which statement reaches the lock first.
        const first=sql(`begin; set local statement_timeout='15s'; ${winner}; select pg_advisory_xact_lock(${key}); select pg_sleep(3); commit;`);
        first.catch(()=>{});
        let held=false;
        for(let i=0;i<100;i++) {
            const state=await sql(`select count(*) from pg_locks where locktype='advisory' and objid=${key} and granted`);
            if(state==='1') { held=true; break; } await delay(20);
        }
        assert.ok(held,'Winner did not reach lock marker');
        const second=sql(`set application_name='schedule_racer_${key}'; set statement_timeout='15s'; ${loser};`);
        second.catch(()=>{});
        let waiting=false;
        for(let i=0;i<40;i++) {
            if(await sql(`select count(*) from pg_stat_activity where application_name='schedule_racer_${key}' and wait_event_type='Lock'`)==='1') { waiting=true; break; }
            await delay(20);
        }
        assert.ok(waiting,'The two commands did not actually overlap at the lock');
        await assert.rejects(second,expectedError);
        await first;
    }
    await race(publish,publish,/SCHEDULE_STALE/);
    assert.equal(await sql('select count(*) from staff_schedule_versions'),'1');
    await race(booking,booking,/SCHEDULE_SLOT_TAKEN/);
    assert.equal(await sql('select count(*) from bookings'),'1');
    // Publication holds staff lock: a racing reservation must observe the new day off.
    const off=`select publish_staff_schedule('${staff}','${biz}','${owner}',1,'day','2099-01-06','${branch}','{"day":{"intervals":[],"breaks":[]}}')`;
    await race(off,booking.replaceAll('2099-01-05','2099-01-06'),/SCHEDULE_OUTSIDE_WORKING_HOURS/);
    const transfer=`select transfer_staff_home('${staff}','${biz}','${owner}','${branch}','${branch2}')`;
    await race(transfer,transfer,/SCHEDULE_STALE/);
    assert.equal(await sql('select count(*) from staff_home_branch_changes'),'1');
    console.log('PASS: concurrent publication, double booking, publication versus booking and competing transfers');
} finally {
    if(created) await docker(['rm','--force',container]);
}

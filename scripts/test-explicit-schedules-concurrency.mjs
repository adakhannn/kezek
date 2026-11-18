// Dedicated, disposable Docker PostgreSQL (lib/explicit-schedule-postgres.mjs); no host ports, volumes or production credentials.
// node scripts/test-explicit-schedules-concurrency.mjs
import assert from 'node:assert/strict';
import { assertLiveFunctions } from './lib/live-schema.cjs';
import { withSchedulePostgres } from './lib/explicit-schedule-postgres.mjs';
import { setupScheduleFixture, biz, branch, branch2, staff, owner } from './lib/explicit-schedule-fixture.mjs';

const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
await withSchedulePostgres('kezek-schedule-test', async (sql) => {
    await setupScheduleFixture(sql);
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
    await assertLiveFunctions(sql, { suite: 'test-explicit-schedules-concurrency.mjs' });
});
console.log('PASS: concurrent publication, double booking, publication versus booking and competing transfers');

// Synthetic disposable PostgreSQL only: no network, ports, volumes, remote credentials or existing containers.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { setupFinanceFixture, ids, asActor } from './lib/finance-transaction-fixture.mjs';
const container=`kezek-reporting-test-${randomUUID()}`;
function docker(args,input='') { return new Promise((resolve,reject)=>{
 const p=spawn('docker',args,{windowsHide:true});let out='',err='';
 p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);p.on('error',reject);
 p.on('close',code=>code===0?resolve(out.trim()):reject(new Error(err||out||`exit ${code}`)));p.stdin.end(input);
}); }
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const sql=text=>docker(['exec','-i',container,'psql','-X','-q','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At'],text);
const call=async text=>JSON.parse(await sql(`${asActor()} ${text}`));
const report=(staff='null',branch='null')=>`select read_finance_report_snapshot('${ids.biz}','2026-11-01','2026-11-01',${staff},${branch});`;
const daily=date=>`select recalculate_business_daily_stats('${date}','Asia/Bishkek');`;
const hourly=date=>`select recalculate_business_hourly_load('${date}','Asia/Bishkek');`;
const load=name=>fs.readFile(new URL(`../supabase/migrations/${name}`,import.meta.url),'utf8');
let created=false;
try {
 await docker(['info','--format','{{.ServerVersion}}']);
 await docker(['run','--detach','--rm','--network','none','--tmpfs','/var/lib/postgresql/data','--name',container,'-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:16']);created=true;
 let ready=false;for(let i=0;i<60;i++){try{await sql('select 1');ready=true;break;}catch{await delay(500);}}assert.ok(ready);
 await setupFinanceFixture(sql);
 // Selected constraints confirmed in the schema-only metadata (PostgreSQL 17.4).
 // Business-specific scheduling/audit triggers are outside this synthetic read fixture.
 await sql(`create extension if not exists btree_gist;
 alter table staff_shifts alter column branch_id set not null;
 alter table staff_shifts add constraint reporting_opened_at_check check(status<>'open' or opened_at is not null);
 alter table staff_shifts add constraint reporting_closed_at_check check(status<>'closed' or closed_at is not null);
 alter table bookings add column time_range tstzrange generated always as(tstzrange(start_at,end_at,'[)')) stored;
 alter table bookings add constraint reporting_no_overlap exclude using gist(staff_id with =,time_range with &&) where(status in ('hold','confirmed','paid'));`);
 await sql(`create table analytics_events(id uuid primary key default gen_random_uuid(),biz_id uuid references businesses,created_at timestamptz,event_type text,metadata jsonb);`);
 await sql(await load('20260227000001_create_business_daily_stats.sql'));
 await sql(await load('20260227000002_create_business_hourly_load.sql'));
 await sql(await load('20261110110000_reporting_completeness.sql'));
 console.log('PASS reporting migrations compile');
 for(const command of [report(),daily('2026-11-01'),hourly('2026-11-01')]) {
  await assert.rejects(sql(`${asActor(ids.owner,'authenticated')} ${command}`),/permission denied/);
  await assert.rejects(sql(`set role anon; ${command}`),/permission denied/);
 }
 await assert.rejects(call(`select read_finance_report_snapshot(null,'2026-01-01','2026-01-02');`),/REPORT_SCOPE_OR_RANGE_INVALID/);
 await assert.rejects(call(`select read_finance_report_snapshot('${ids.biz}','2025-01-01','2026-11-01');`),/REPORT_SCOPE_OR_RANGE_INVALID/);
 await assert.rejects(call(report(`'${ids.otherStaff}'`)),/REPORT_SCOPE_INVALID/);
 await assert.rejects(call(report('null',`'${ids.otherBranch}'`)),/REPORT_SCOPE_INVALID/);
 await sql(`${asActor()}
 insert into branches(id,biz_id,name) select md5('branch-'||i)::uuid,'${ids.biz}','Branch '||i from generate_series(1,1201)i;
 insert into staff(id,biz_id,branch_id,full_name) select md5('staff-'||i)::uuid,'${ids.biz}','${ids.branch}','Staff '||i from generate_series(1,1201)i;
 insert into staff_shifts(id,staff_id,biz_id,branch_id,shift_date,opened_at) select md5('shift-'||i)::uuid,md5('staff-'||i)::uuid,'${ids.biz}','${ids.branch}','2026-11-01','2026-11-01 09:00+06' from generate_series(1,1201)i;
 insert into staff_shift_items(id,shift_id,service_amount,consumables_amount) select md5('item-'||i)::uuid,md5('shift-'||i)::uuid,(i%11)+1,2 from generate_series(1,1201)i;
 insert into staff_shifts(id,staff_id,biz_id,branch_id,shift_date,opened_at) values(md5('large-shift')::uuid,'${ids.staff}','${ids.biz}','${ids.branch}','2026-11-01','2026-11-01 09:00+06');
 insert into staff_shift_items(id,shift_id,service_amount,consumables_amount) select md5('large-item-'||i)::uuid,md5('large-shift')::uuid,(i%17)+0.25,0.5 from generate_series(1,1501)i;
 `);
 const snapshot=await call(report());
 assert.equal(snapshot.branches.length,1202);assert.equal(snapshot.staff.length,1202);assert.equal(snapshot.shifts.length,1202);
 const expectedAmount=Array.from({length:1201},(_,i)=>((i+1)%11)+1).reduce((a,b)=>a+b,0)
  +Array.from({length:1501},(_,i)=>((i+1)%17)+0.25).reduce((a,b)=>a+b,0);
 assert.equal(snapshot.shifts.flatMap(s=>s.items).reduce((sum,i)=>sum+i.service_amount,0),expectedAmount);
 assert.equal(snapshot.shifts.flatMap(s=>s.items).length,2702);
 const detail=await call(report(`'${ids.staff}'`));assert.equal(detail.shifts[0].items.length,1501);
 // PostgREST max_rows caps returned SQL rows; this function returns exactly one scalar JSON row.
 assert.equal(await sql(`${asActor()} select count(*) from read_finance_report_snapshot('${ids.biz}','2026-11-01','2026-11-01');`),'1');
 const transferredStaff=await sql(`select md5('staff-1')::uuid`);
 await sql(`${asActor()} update staff_shifts set status='closed',closed_at='2026-11-01 18:00+06',total_amount=987.5,master_share=600,salon_share=400,consumables_amount=12.5 where staff_id='${transferredStaff}' and shift_date='2026-11-01';
 update staff set branch_id=md5('branch-1')::uuid where id='${transferredStaff}';`);
 const historical=await call(report('null',`'${ids.branch}'`));
 assert.ok(historical.staff.some(s=>s.id===transferredStaff));
 assert.equal(historical.closedStats.find(s=>s.staff_id===transferredStaff).total_amount,987.5);
 console.log('PASS >1000 staff/branches/shifts/items, single-row JSON, tenant/range ACL and historical branch attribution');
 await sql(`update businesses set tz='America/New_York' where id='${ids.otherBiz}';
 insert into staff(id,biz_id,branch_id,full_name) select md5('analytics-staff-'||i)::uuid,'${ids.biz}','${ids.branch}','Analytics '||i from generate_series(1,1501)i;
 insert into bookings(id,biz_id,branch_id,staff_id,service_id,start_at,end_at,status,promotion_applied)
 select md5('analytics-'||i)::uuid,'${ids.biz}','${ids.branch}',md5('analytics-staff-'||i)::uuid,'${ids.service}','2026-10-31 18:30Z','2026-10-31 19:00Z','paid',
 case when i%3=0 then '{"promotion_type":"discount","final_amount":125.5}'::jsonb else null end from generate_series(1,1501)i;
 insert into analytics_events(biz_id,created_at,event_type) select '${ids.biz}','2026-10-31 18:00Z','home_view' from generate_series(1,1501)i;
 insert into analytics_events(biz_id,created_at,event_type) values('${ids.biz}','2026-10-31 17:59:59.999999Z','home_view'),('${ids.biz}','2026-11-01 18:00Z','home_view');
 insert into bookings(id,biz_id,branch_id,staff_id,service_id,start_at,end_at,status) values
 (md5('last-microsecond')::uuid,'${ids.biz}','${ids.branch}','${ids.staff}','${ids.service}','2026-11-01 17:59:59.999999Z','2026-11-01 18:00Z','confirmed'),
 (md5('next-local-date')::uuid,'${ids.biz}','${ids.branch}','${ids.staff}','${ids.service}','2026-11-01 18:00Z','2026-11-01 19:00Z','paid'),
 (md5('fall-first-hour')::uuid,'${ids.otherBiz}','${ids.otherBranch}','${ids.otherStaff}','${ids.otherService}','2026-11-01 05:30Z','2026-11-01 06:00Z','paid'),
 (md5('fall-repeated-hour')::uuid,'${ids.otherBiz}','${ids.otherBranch}','${ids.otherStaff}','${ids.otherService}','2026-11-01 06:30Z','2026-11-01 07:00Z','paid'),
 (md5('fall-last-hour')::uuid,'${ids.otherBiz}','${ids.otherBranch}','${ids.otherStaff}','${ids.otherService}','2026-11-02 04:30Z','2026-11-02 05:00Z','paid'),
 (md5('fall-next-midnight')::uuid,'${ids.otherBiz}','${ids.otherBranch}','${ids.otherStaff}','${ids.otherService}','2026-11-02 05:00Z','2026-11-02 06:00Z','paid'),
 (md5('spring-hour-one')::uuid,'${ids.otherBiz}','${ids.otherBranch}','${ids.otherStaff}','${ids.otherService}','2026-03-08 06:59Z','2026-03-08 07:00Z','paid'),
 (md5('spring-hour-three')::uuid,'${ids.otherBiz}','${ids.otherBranch}','${ids.otherStaff}','${ids.otherService}','2026-03-08 07:00Z','2026-03-08 08:00Z','paid'),
 (md5('spring-next-midnight')::uuid,'${ids.otherBiz}','${ids.otherBranch}','${ids.otherStaff}','${ids.otherService}','2026-03-09 04:00Z','2026-03-09 05:00Z','paid');
 update bookings set promotion_applied='{"promotion_type":"free","final_amount":0}' where id=md5('fall-first-hour')::uuid;`);
 await call(daily('2026-11-01'));await call(hourly('2026-11-01'));
 const dailyRows=JSON.parse(await sql(`select jsonb_agg(to_jsonb(s)) from business_daily_stats s where date='2026-11-01'`));
 const a=dailyRows.find(r=>r.biz_id===ids.biz),b=dailyRows.find(r=>r.biz_id===ids.otherBiz);
 const expectedRevenue=1000+Array.from({length:1501},(_,i)=>(i+1)%3===0?125.5:1000).reduce((x,y)=>x+y,0);
 assert.equal(a.total_revenue,expectedRevenue);assert.equal(a.home_views,1501);assert.equal(a.promo_bookings,500);assert.equal(a.promo_revenue,62750);
 assert.equal(b.total_revenue,2000);assert.equal(b.promo_bookings,1);assert.equal(b.promo_revenue,0);
 const hours=JSON.parse(await sql(`select jsonb_agg(to_jsonb(s)) from business_hourly_load s where date='2026-11-01'`));
 assert.equal(hours.find(r=>r.biz_id===ids.biz&&r.hour===0).bookings_count,1501);
 assert.equal(hours.find(r=>r.biz_id===ids.biz&&r.hour===23).bookings_count,1);
 assert.equal(hours.find(r=>r.biz_id===ids.otherBiz&&r.hour===1).bookings_count,2);
 assert.equal(hours.find(r=>r.biz_id===ids.otherBiz&&r.hour===23).bookings_count,1);
 await sql(`insert into business_hourly_load(biz_id,branch_id,date,hour,bookings_count) values('${ids.otherBiz}','${ids.otherBranch}','2026-03-08',2,99)`);
 await call(daily('2026-03-08'));await call(hourly('2026-03-08'));
 assert.equal(await sql(`select total_revenue from business_daily_stats where biz_id='${ids.otherBiz}' and date='2026-03-08'`),'2000.00');
 assert.equal(await sql(`select string_agg(hour::text,',' order by hour) from business_hourly_load where date='2026-03-08'`),'1,3');
 console.log('PASS independent count/sum oracle, microsecond half-open bounds and 23/25-hour DST days');
 const analyticsRead=(kind,biz='null',branch='null')=>`select read_analytics_report_snapshot('2026-11-01','2026-11-01',${biz},${branch},'${kind}');`;
 const promoRead=(biz=ids.biz,branch='null')=>`select read_promotion_analytics_snapshot('${biz}','2026-11-01','2026-11-01',${branch});`;
 const promo=await call(promoRead());
 assert.deepEqual(promo.summary,{promoBookings:500,promoRevenue:62750,totalRevenue:expectedRevenue});
 assert.equal(promo.byType[0].bookings,500);assert.equal(promo.byDay.length,1);
 assert.deepEqual((await call(promoRead(ids.biz,`'${ids.branch}'`))).summary,promo.summary);
 assert.equal((await call(promoRead(ids.otherBiz))).summary.totalRevenue,2000);
 assert.equal((await call(analyticsRead('daily',`'${ids.biz}'`))).rows[0].home_views,1501);
 const global=await call(analyticsRead('global'));assert.equal(global.activeBusinesses,2);
 assert.equal(global.rows[0].total_revenue,expectedRevenue+2000);assert.equal(global.rows[0].active_businesses,2);
 for(const command of [analyticsRead('global'),analyticsRead('daily',`'${ids.biz}'`),promoRead()]) {
  await assert.rejects(sql(`${asActor(ids.owner,'authenticated')} ${command}`),/permission denied/);
  await assert.rejects(sql(`set role anon; ${command}`),/permission denied/);
 }
 await assert.rejects(call(analyticsRead('hourly',`'${ids.biz}'`,`'${ids.otherBranch}'`)),/REPORT_SCOPE_INVALID/);
 await assert.rejects(call(analyticsRead('daily')),/REPORT_SCOPE_INVALID/);
 await assert.rejects(call(`select read_analytics_report_snapshot('2025-01-01','2026-11-01',null,null,'global')`),/REPORT_SCOPE_OR_RANGE_INVALID/);
 await assert.rejects(call(promoRead(ids.biz,`'${ids.otherBranch}'`)),/REPORT_SCOPE_INVALID/);
 // More than 1000 branch buckets, but no truncated REST traversal and exact sum oracle.
 await sql(`insert into business_hourly_load(biz_id,branch_id,date,hour,bookings_count) select '${ids.biz}',md5('branch-'||i)::uuid,'2026-11-01',4,i%7 from generate_series(1,1201)i`);
 const completeHours=await call(analyticsRead('hourly',`'${ids.biz}'`));assert.equal(completeHours.rows.length,1203);
 assert.equal(completeHours.rows.reduce((sum,r)=>sum+r.bookings_count,0),1502+Array.from({length:1201},(_,i)=>(i+1)%7).reduce((a,b)=>a+b,0));
 await call(hourly('2026-11-01'));
 // Global aggregation includes >1000 tenants while returning only one daily row.
 await sql(`insert into businesses(id,tz) select md5('report-biz-'||i)::uuid,'Asia/Bishkek' from generate_series(1,1201)i;
 insert into business_daily_stats(biz_id,date,home_views,total_revenue) select md5('report-biz-'||i)::uuid,'2026-11-01',i,i*0.25 from generate_series(1,1201)i;`);
 const manyBiz=await call(analyticsRead('global'));assert.equal(manyBiz.activeBusinesses,1203);assert.equal(manyBiz.rows.length,1);
 assert.equal(manyBiz.rows[0].total_revenue,expectedRevenue+2000+Array.from({length:1201},(_,i)=>(i+1)*0.25).reduce((a,b)=>a+b,0));
 await sql(`delete from business_daily_stats where biz_id not in ('${ids.biz}','${ids.otherBiz}');delete from businesses where id not in ('${ids.biz}','${ids.otherBiz}')`);
 await sql(`${asActor()} insert into staff_shifts(id,staff_id,biz_id,branch_id,shift_date,status,opened_at,closed_at,total_amount,master_share,salon_share,guaranteed_amount,topup_amount)
 select md5('history-'||i)::uuid,'${ids.staff}','${ids.biz}','${ids.branch}',date '2020-01-01'+i,'closed','2020-01-01 09:00+06','2020-01-01 18:00+06',i,2*i,3*i,99,5 from generate_series(1,1201)i;`);
 const history=await call(`select read_staff_finance_history('${ids.biz}','${ids.staff}');`);assert.equal(history.length,1203);
 assert.equal(history.filter(s=>s.status==='closed').reduce((sum,s)=>sum+s.salon_share,0),Array.from({length:1201},(_,i)=>3*(i+1)).reduce((a,b)=>a+b,0));
 await assert.rejects(call(`select read_staff_finance_history('${ids.biz}','${ids.otherStaff}');`),/REPORT_SCOPE_INVALID/);
 await assert.rejects(sql(`set role anon; select read_staff_finance_history('${ids.biz}','${ids.staff}');`),/permission denied/);
 await sql('alter table business_daily_stats rename to reporting_missing_daily');
 await assert.rejects(call(analyticsRead('global')),/business_daily_stats/);
 await sql('alter table reporting_missing_daily rename to business_daily_stats');
 await sql('alter table bookings rename to reporting_missing_bookings');
 await assert.rejects(call(promoRead()),/bookings/);
 await sql('alter table reporting_missing_bookings rename to bookings');
 await sql(`alter table staff enable row level security; alter table staff_shifts enable row level security;
 create policy reporting_history_staff_rls on staff for select to authenticated using(user_id=auth.uid());
 create policy reporting_history_rls on staff_shifts for select to authenticated using(staff_id in(select id from staff where user_id=auth.uid()));`);
 const ownHistory=JSON.parse(await sql(`${asActor(ids.staffUser,'authenticated')} select read_staff_finance_history('${ids.biz}','${ids.staff}');`));assert.equal(ownHistory.length,1203);
 await assert.rejects(sql(`${asActor(ids.otherOwner,'authenticated')} select read_staff_finance_history('${ids.biz}','${ids.staff}');`),/REPORT_SCOPE_INVALID/);
 console.log('PASS scalar daily/hourly/global/promotions/history readers, >1000 tenants/buckets/shifts, dependency failure and scope ACL');

 const before=await sql(`select jsonb_agg(to_jsonb(s) order by biz_id,date) from business_daily_stats s`);
 await sql(`update bookings set promotion_applied='{"promotion_type":"invalid","final_amount":"NaN"}' where id=md5('analytics-1')::uuid`);
 await assert.rejects(call(daily('2026-11-01')),/ANALYTICS_AMOUNT_INVALID/);
 assert.equal(await sql(`select jsonb_agg(to_jsonb(s) order by biz_id,date) from business_daily_stats s`),before);
 await sql(`update bookings set promotion_applied=null where id=md5('analytics-1')::uuid`);
 await sql('alter table analytics_events rename to analytics_events_unavailable');
 await assert.rejects(call(daily('2026-11-01')),/analytics_events/);
 await sql('alter table analytics_events_unavailable rename to analytics_events');
 assert.equal(await sql(`select jsonb_agg(to_jsonb(s) order by biz_id,date) from business_daily_stats s`),before);
 await sql(`create function fail_reporting_write() returns trigger language plpgsql as $$begin raise exception 'INJECTED_REPORTING_FAILURE'; end;$$;
 create trigger fail_reporting before insert or update on business_daily_stats for each row execute function fail_reporting_write();`);
 await assert.rejects(call(daily('2026-11-01')),/INJECTED_REPORTING_FAILURE/);
 assert.equal(await sql(`select jsonb_agg(to_jsonb(s) order by biz_id,date) from business_daily_stats s`),before);
 await sql('drop trigger fail_reporting on business_daily_stats');
 await sql(`update businesses set tz='Invalid/Timezone' where id='${ids.otherBiz}'`);
 await assert.rejects(call(hourly('2026-11-01')),/time zone/);
 await sql(`update businesses set tz='America/New_York' where id='${ids.otherBiz}';
 update bookings set status='cancelled' where biz_id='${ids.biz}';`);
 await call(daily('2026-11-01'));await call(hourly('2026-11-01'));
 assert.equal(await sql(`select total_revenue from business_daily_stats where biz_id='${ids.biz}' and date='2026-11-01'`),'0.00');
 assert.equal(await sql(`select to_jsonb(s)->>'created_at' from business_daily_stats s where biz_id='${ids.biz}' and date='2026-11-01'`),a.created_at);
 assert.equal(await sql(`select count(*) from business_hourly_load where biz_id='${ids.biz}' and date='2026-11-01'`),'0');
 await sql(`delete from analytics_events where biz_id='${ids.biz}';delete from bookings where biz_id='${ids.otherBiz}' and start_at>='2026-11-01 04:00Z' and start_at<'2026-11-02 05:00Z';`);
 assert.equal((await call(daily('2026-11-01'))).updated,0);assert.equal((await call(hourly('2026-11-01'))).updated,0);
 assert.equal(await sql(`select count(*) from business_daily_stats where date='2026-11-01'`),'0');
 assert.equal(await sql(`select count(*) from business_hourly_load where date='2026-11-01'`),'0');
 assert.equal(await sql(`select count(*) from business_hourly_load where date='2026-03-08'`),'2');
 console.log('PASS dependency/write failures rollback, invalid timezone rejection and stale/zero buckets after cancel/delete');
 console.log('PASS all isolated reporting completeness regressions');
} finally { if(created) await docker(['rm','--force',container]); }

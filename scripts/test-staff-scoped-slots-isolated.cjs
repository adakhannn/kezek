// Local synthetic availability correctness + operation-count benchmark.
// Uses real old/new slot SQL, but a controlled resolver fixture (not production schedules).
// No .env, remote database, provider, network, host ports or volumes.
const { spawnSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const name = 'kezek-staff-slots-' + randomUUID();
const run = (args, input, allowError = false) => {
  const result = spawnSync('docker', args, { input, encoding: 'utf8' });
  if (!allowError && result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result;
};
const psql = ['exec', '-i', name, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres'];
const sql = text => run(psql, text).stdout.trim();
const source = file => readFileSync(path.join(root, 'supabase/migrations', file), 'utf8');
const id = number => '00000000-0000-4000-8000-' + String(number).padStart(12, '0');
const biz = id(1), otherBiz = id(2), branch = id(3), otherBranch = id(4), service = id(5);
const staff = id(10), transfer = id(11), inactive = id(12), unavailable = id(13), wrongBranch = id(14), foreign = id(15);
const call = (staffId, day = '2035-01-01', extra = '') => `public.get_free_slots_service_day_v2('${biz}','${service}','${day}',400,15${staffId === undefined ? '' : ',' + (staffId === null ? 'null::uuid' : "'" + staffId + "'::uuid")})${extra}`;
const count = staffId => Number(sql(`select count(*) from ${call(staffId)};`));
const failure = (statement, regex) => {
  const result = run(psql, statement, true);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, regex);
};
(async () => {
  try {
    run(['image','inspect','postgres:16']);
    run(['run','-d','--name',name,'--network','none','--tmpfs','/var/lib/postgresql/data','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:16']);
    let ready = false;
    for (let index = 0; index < 60; index++) {
      if (run(['exec',name,'pg_isready','-U','postgres'],undefined,true).status === 0) { ready = true; break; }
      await new Promise(resolve => setTimeout(resolve,250));
    }
    assert(ready);
    sql(`
      create role anon; create role authenticated; create role service_role; create role outsider;
      create table businesses(id uuid primary key, tz text);
      create table branches(id uuid primary key, biz_id uuid, is_active boolean default true);
      create table services(id uuid primary key, biz_id uuid, branch_id uuid, active boolean default true, duration_min int);
      create table staff(id uuid primary key, biz_id uuid, branch_id uuid, is_active boolean default true);
      create index staff_biz on staff(biz_id);
      create table synthetic_schedule(staff_id uuid, day date, branch_id uuid, intervals jsonb, breaks jsonb, primary key(staff_id,day));
      create function resolve_staff_day(p_staff uuid,p_day date)
      returns table(branch_id uuid,intervals jsonb,breaks jsonb)
      language plpgsql stable set search_path=public as $$begin
        return query select s.branch_id,s.intervals,s.breaks from synthetic_schedule s where s.staff_id=p_staff and s.day=p_day;
      end$$;
      revoke all on function resolve_staff_day(uuid,date) from public;
      create table bookings(id uuid primary key default gen_random_uuid(),biz_id uuid,staff_id uuid,start_at timestamptz,end_at timestamptz,status text,expires_at timestamptz);
      create index bookings_staff on bookings(staff_id);
      alter table bookings enable row level security;
      insert into businesses values('${biz}','Asia/Bishkek'),('${otherBiz}','America/New_York');
      insert into branches values('${branch}','${biz}',true),('${otherBranch}','${biz}',true);
      insert into services values('${service}','${biz}','${branch}',true,30);
      insert into staff values
        ('${staff}','${biz}','${branch}',true),('${transfer}','${biz}','${otherBranch}',true),
        ('${inactive}','${biz}','${branch}',false),('${unavailable}','${biz}','${branch}',true),
        ('${wrongBranch}','${biz}','${otherBranch}',true),('${foreign}','${otherBiz}','${branch}',true);
      insert into synthetic_schedule
      select id,'2035-01-01',case when id='${wrongBranch}' then '${otherBranch}'::uuid else '${branch}'::uuid end,
        '[{"start":"08:00","end":"10:00"}]','[{"start":"09:00","end":"09:15"}]'
      from staff where id<>'${unavailable}';
    `);
    const old = source('20260918131000_explicit_schedule_booking_consumers.sql');
    const begin = old.indexOf('CREATE OR REPLACE FUNCTION public.get_free_slots_service_day_v2(');
    sql(old.slice(begin, old.indexOf('END$function$;',begin) + 'END$function$;'.length));
    const rows = query => JSON.parse(sql(`select coalesce(jsonb_agg(to_jsonb(s) order by staff_id,start_at),'[]') from ${query} s;`));
    const original = rows(call());
    assert.equal(original.length,10);
    const complexBegin = old.indexOf('create or replace function public.get_free_slots_complex_day_v1(');
    sql(old.slice(complexBegin,old.indexOf('$function$;',complexBegin)+'$function$;'.length));
    sql(source('20261110121000_staff_scoped_slots.sql'));
    assert.deepEqual(rows(call()),original,'five-argument compatibility');
    assert.deepEqual(rows(call(null)),original,'explicit any-staff compatibility');
    assert.deepEqual(rows(call(staff)),original.filter(row=>row.staff_id===staff),'scoped result equals original subset');
    assert.equal(count(transfer),5,'effective schedule branch accepts transfer');
    for(const value of [inactive,unavailable,wrongBranch,foreign,id(999)]) assert.equal(count(value),0,'ineligible staff '+value);
    assert.equal(sql(`select count(*) from ${call(staff,'2035-01-02')};`),'0','day without schedule');
    assert.equal(sql(`set role anon; select count(*) from ${call(staff)};`),'5');
    assert.equal(sql(`set role authenticated; select count(*) from ${call(staff)};`),'5');
    failure(`set role anon; select count(*) from public.get_free_slots_service_day_v2('${biz}','${service}','2035-01-01');`,/USE_PAGED_SLOTS/);
    for (const role of ['anon','authenticated']) {
      failure(`set role ${role}; select * from ${call(null)};`,/USE_PAGED_SLOTS/);
      failure(`set role ${role}; select * from get_free_slots_complex_day_v1('${biz}','${branch}',null,'2035-01-01',30);`,/USE_PAGED_SLOTS/);
    }
    assert.equal(sql(`set role service_role; select count(*) from ${call()};`),'10','trusted diagnostics preserve legacy defaults');
    failure(`set role outsider; select * from ${call(staff)};`,/permission denied for function/);
    failure(`set role outsider; select * from ${call()};`,/permission denied for function/);
    const pageCall = (cursor=null,options={}) => {
      const {limit=2,day='2035-01-01',staffId=null,complex=false,branchId=branch}=options;
      const encoded=cursor===null?'null':"'"+JSON.stringify(cursor).replaceAll("'","''")+"'::jsonb";
      return `get_free_slots_page_v1('${biz}','${branchId}','${day}',${complex?'null':"'"+service+"'"},${complex?'30':'null'},${staffId?"'"+staffId+"'":'null'},${encoded},${limit===null?'null':limit})`;
    };
    const page = (cursor=null,options={}) => JSON.parse(sql(`select ${pageCall(cursor,options)};`));
    const collect = options => {
      let cursor=null;const collected=[];
      for(let index=0;index<30;index++) {
        const value=page(cursor,options);assert(value.slots.length<=(options.limit??2));
        collected.push(...value.slots);if(value.next_cursor===null)return collected;
        assert.notDeepEqual(value.next_cursor,cursor);cursor=value.next_cursor;
      }
      assert.fail('cursor must finish');
    };
    const ordered = values => [...values].sort((a,b)=>a.staff_id.localeCompare(b.staff_id)||a.start_at.localeCompare(b.start_at));
    assert.deepEqual(ordered(collect({})),original,'paged any retains every staff and slot, including equal times');
    assert.deepEqual(ordered(collect({complex:true})),original,'complex any uses same bounded page contract');
    assert.deepEqual(ordered(collect({staffId:staff})),original.filter(row=>row.staff_id===staff));
    const firstCursor=page().next_cursor;
    for(const options of [{day:'2035-01-02'},{staffId:staff},{complex:true},{branchId:otherBranch}]) {
      failure(`select ${pageCall(firstCursor,options)};`,/INVALID_SLOTS_CURSOR|SERVICE_NOT_FOUND_OR_INACTIVE/);
    }
    for(const cursor of [[],{}, {...firstCursor,v:2},{...firstCursor,scope:'forged'},{...firstCursor,extra:1},{...firstCursor,staff_id:null},{...firstCursor,start_at:'infinity'},{...firstCursor,start_at:42},{...firstCursor,start_at:'bad date'}]) {
      failure(`select ${pageCall(cursor)};`,/INVALID_SLOTS_CURSOR/);
    }
    for(const limit of [0,101,null]) failure(`select ${pageCall(null,{limit})};`,/INVALID_SLOTS_PAGE_INPUT/);
    failure(`set role outsider; select ${pageCall()};`,/permission denied for function/);
    assert.equal(JSON.parse(sql(`set role anon; select ${pageCall()};`)).slots.length,2);
    sql(`insert into bookings(biz_id,staff_id,start_at,end_at,status) values('${biz}','${staff}','2035-01-01T02:00Z','2035-01-01T02:30Z','confirmed');`);
    assert.equal(count(staff),3,'confirmed blocks overlap but preserves adjacent start');
    sql(`insert into bookings(biz_id,staff_id,start_at,end_at,status) values('${biz}','${staff}','2035-01-01T03:30Z','2035-01-01T04:00Z','paid');`);
    assert.equal(count(staff),1,'paid blocks overlaps');
    assert.equal(sql(`select start_at from ${call(staff)};`),'2035-01-01 02:30:00+00');
    sql(`insert into bookings(biz_id,staff_id,start_at,end_at,status,expires_at) values('${biz}','${staff}','2035-01-01T02:30Z','2035-01-01T03:00Z','hold',now()+interval '1 hour');`);
    assert.equal(count(staff),0,'live hold blocks availability');
    sql(`update bookings set expires_at=now()-interval '1 second' where status='hold';`);
    assert.equal(count(staff),1,'expired hold does not block');
    assert.equal(sql(`set role anon; select count(*) from ${call(staff)};`),'1','definer sees blocking bookings despite RLS');
    sql(`update services set active=false where id='${service}';`);
    failure(`select * from ${call(staff)};`,/SERVICE_NOT_FOUND_OR_INACTIVE/);
    sql(`update services set active=true where id='${service}'; truncate bookings,synthetic_schedule,staff;
      insert into staff select ('00000000-0000-4000-9000-'||lpad(i::text,12,'0'))::uuid,'${biz}','${branch}',true from generate_series(1,1000) i;
      insert into synthetic_schedule select id,'2035-01-01','${branch}','[{"start":"08:00","end":"18:00"}]','[]' from staff;
      analyze staff; analyze synthetic_schedule; analyze bookings;`);
    const selected='00000000-0000-4000-9000-000000000001';
    // Function stats count real resolver invocations; no instrumentation writes inside the resolver.
    const benchmark = staffId => {
      sql(`select pg_stat_reset_single_function_counters('resolve_staff_day(uuid,date)'::regprocedure);`);
      const plan=JSON.parse(sql(`set track_functions='all'; explain (analyze,buffers,format json) select * from ${call(staffId)}; select pg_stat_force_next_flush();`))[0];
      const calls=Number(sql(`select calls from pg_stat_user_functions where funcid='resolve_staff_day(uuid,date)'::regprocedure;`));
      return {staffCount:1000,scope:staffId===null?'any':'selected',resolverCalls:calls,rows:plan.Plan['Actual Rows'],executionMs:plan['Execution Time'],plan};
    };
    const scoped=benchmark(selected), all=benchmark(null);
    assert.equal(scoped.resolverCalls,1); assert.equal(all.resolverCalls,1000);
    assert.equal(scoped.rows,39); assert.equal(all.rows,39000);
    sql(`select pg_stat_reset_single_function_counters('resolve_staff_day(uuid,date)'::regprocedure);`);
    const boundedPage=JSON.parse(sql(`set track_functions='all'; select ${pageCall(null,{limit:100})}; select pg_stat_force_next_flush();`));
    const pageCalls=Number(sql(`select calls from pg_stat_user_functions where funcid='resolve_staff_day(uuid,date)'::regprocedure;`));
    assert.equal(boundedPage.slots.length,100);assert.equal(pageCalls,3);assert(boundedPage.next_cursor);
    sql(`delete from synthetic_schedule where staff_id in (select id from staff order by id limit 8);`);
    sql(`select pg_stat_reset_single_function_counters('resolve_staff_day(uuid,date)'::regprocedure);`);
    const empty=JSON.parse(sql(`set track_functions='all'; select ${pageCall(null,{limit:100})}; select pg_stat_force_next_flush();`));
    assert.equal(Number(sql(`select calls from pg_stat_user_functions where funcid='resolve_staff_day(uuid,date)'::regprocedure;`)),8);
    assert.equal(empty.slots.length,0);assert(empty.next_cursor,'empty page must continue past unavailable staff');
    assert.equal(page(empty.next_cursor,{limit:100}).slots.length,100);
    // Duplicated schedule intervals must not truncate later unique times before cursoring.
    sql(`update synthetic_schedule set intervals=(select jsonb_agg(jsonb_build_object('start','08:00','end','18:00')) from generate_series(1,20)) where staff_id='00000000-0000-4000-9000-000000000009';`);
    const dedup=collect({staffId:'00000000-0000-4000-9000-000000000009',limit:10});
    assert.equal(dedup.length,39);assert.equal(new Set(dedup.map(row=>row.start_at)).size,39);
    console.log(JSON.stringify({result:'PASS',boundary:'synthetic resolver, local PostgreSQL16; not production RPS',page:{rows:100,resolverCalls:pageCalls,maxEmptyPageCalls:8},benchmarks:[scoped,all]}));
  } finally { run(['rm','-f',name],undefined,true); }
})().catch(error=>{console.error(error);process.exitCode=1;});

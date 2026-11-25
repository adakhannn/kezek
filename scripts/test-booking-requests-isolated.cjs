// Local-only transaction regressions. Uses production hold/confirm/request/outbox
// SQL in a synthetic minimal schema; schedule availability itself is not tested.
// Never reads .env/connection URLs or sends provider messages.
const { spawnSync, spawn } = require('node:child_process');
const { readFileSync, existsSync } = require('node:fs');
const { randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');
const path = require('node:path');
const { POSTGRES_IMAGE } = require('./lib/isolated-postgres.cjs');
const { assertLiveFunctions, installLiveFunction, SUPABASE_DEFAULT_PRIVILEGES } = require('./lib/live-schema.cjs');
const root = path.resolve(__dirname, '..');
const name = 'kezek-booking-regression-' + randomUUID();
const run = (args, input, allowError = false) => {
  const result = spawnSync('docker', args, { input, encoding: 'utf8' });
  if (!allowError && result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result;
};
const psqlArgs = ['exec', '-i', name, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres'];
const sql = text => run(psqlArgs, text).stdout.trim();
const asyncSql = text => new Promise((resolve, reject) => {
  const child = spawn('docker', psqlArgs);
  let out = '', err = '';
  child.stdout.on('data', chunk => out += chunk);
  child.stderr.on('data', chunk => err += chunk);
  child.on('error', reject);
  child.on('exit', code => code === 0 ? resolve(out.trim()) : reject(new Error(err)));
  child.stdin.end(text);
});
const source = filename => readFileSync(path.join(root, existsSync(path.join(root, 'supabase/migrations', filename)) ? 'supabase/migrations' : 'supabase/migrations_archive', filename), 'utf8');
const baseline = source('20261009110000_prod_baseline.sql').replace(/\r\n/g, '\n');
// A function as production had it on 2026-10-09 (definition, owner and grants from the prod
// baseline): the predecessor that the migrations under test replace or revoke.
const baselineFunction = name => {
  const marker = `CREATE OR REPLACE FUNCTION "public"."${name}"(`;
  const start = baseline.indexOf(marker);
  assert(start >= 0 && baseline.indexOf(marker, start + 1) < 0, name);
  const owner = baseline.indexOf('\nALTER FUNCTION ', start) + 1;
  const identity = baseline.slice(owner + 'ALTER FUNCTION '.length, baseline.indexOf(' OWNER TO ', owner));
  assert(identity.startsWith(`"public"."${name}"(`), identity);
  const acl = baseline.split('\n').filter(line => /^(GRANT|REVOKE) ALL ON FUNCTION /.test(line) && line.includes(` ON FUNCTION ${identity} `));
  return [baseline.slice(start, baseline.indexOf(';\n', owner) + 1), ...acl].join('\n');
};
const baselinePolicy = name => {
  const start = baseline.indexOf(`CREATE POLICY "${name}" ON "public"."bookings" `);
  assert(start >= 0, name);
  return baseline.slice(start, baseline.indexOf(';\n', start) + 1);
};
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
const id = digit => '00000000-0000-4000-8000-' + String(digit).padStart(12, '0');
const user = id(1), other = id(2), biz = id(3), branch = id(4), staff = id(5), service = id(6), service2 = id(7);
const secret = 'a'.repeat(64);
const payload = day => ({
  biz_id: biz, branch_id: branch, staff_id: staff, service_id: service,
  start_at: `2035-01-${String(day).padStart(2, '0')}T10:00:00Z`,
  client_name: 'Synthetic Guest', client_phone: '+996555000000', client_email: 'synthetic@example.invalid',
});
const command = (requestId, input, guest = true, actor = user, proof = secret) =>
  `set role service_role; set request.jwt.claim.sub = '${other}'; ` +
  `select create_confirmed_booking(${quote(requestId)},${quote(JSON.stringify(input))}::jsonb,${guest ? quote(proof) : 'null'},${guest || !actor ? 'null' : quote(actor)});`;
const expectFailure = (statement, pattern) => {
  const result = run(psqlArgs, statement, true);
  assert.notEqual(result.status, 0, 'statement must fail');
  assert.match(result.stderr, pattern);
};

(async () => {
  try {
    // Existing image only. No network, published ports, mounts or project data.
    run(['image', 'inspect', POSTGRES_IMAGE]);
    run(['run', '-d', '--name', name, '--network', 'none', '--tmpfs', '/var/lib/postgresql/data', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', POSTGRES_IMAGE]);
    let ready = false;
    for (let i = 0; i < 60; i++) {
      const logs=run(['logs',name],undefined,true);
      if ((logs.stdout+logs.stderr).includes('PostgreSQL init process complete') &&
        run(['exec', name, 'pg_isready', '-U', 'postgres'], undefined, true).status === 0) { ready = true; break; }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    assert(ready, 'disposable Postgres startup');
    sql(`
      create role anon; create role authenticated; create role service_role bypassrls;
      ${SUPABASE_DEFAULT_PRIVILEGES}
      create schema auth;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create table auth.users(id uuid primary key, email text, phone text, raw_user_meta_data jsonb default '{}');
      create table profiles(id uuid primary key references auth.users, full_name text, phone text);
      create table businesses(id uuid primary key,owner_id uuid,is_approved boolean default true);
      create table branches(id uuid primary key, biz_id uuid references businesses, is_active boolean default true);
      create table staff(id uuid primary key, biz_id uuid references businesses, branch_id uuid references branches, is_active boolean default true,user_id uuid,full_name text);
      create table roles(id uuid primary key,key text,scope text);
      create table user_roles(user_id uuid,biz_id uuid,role_id uuid);
      create table branch_admins(branch_id uuid,user_id uuid);
      create table user_global_roles(user_id uuid,role_id uuid);
      create table super_admins_legacy(user_id uuid);
      create table staff_schedule_versions(staff_id uuid references staff);
      create table services(id uuid primary key, biz_id uuid references businesses, branch_id uuid references branches, name_ru text, active boolean default true, duration_min integer);
      create table service_staff(service_id uuid references services, staff_id uuid references staff, is_active boolean not null default true);
      create table working_hours(staff_id uuid,biz_id uuid,day_of_week integer,intervals jsonb);
      create type booking_status as enum ('hold','confirmed','paid','cancelled','completed','no_show');
      create table bookings(id uuid primary key default gen_random_uuid(), biz_id uuid not null references businesses,
        branch_id uuid not null references branches, staff_id uuid not null references staff, service_id uuid not null references services,
        client_id uuid references auth.users, client_name text, client_phone text, client_email text,
        start_at timestamptz not null, end_at timestamptz not null, status booking_status not null, expires_at timestamptz,
        source text default 'public', created_at timestamptz default now(),promotion_applied jsonb,subscription_applied jsonb);
      create table staff_shift_items(booking_id uuid references bookings);
      create table booking_services(booking_id uuid references bookings on delete cascade, service_id uuid references services,
        duration_min integer not null, order_index integer not null);
      -- Schedule availability is not tested here: every requested time is inside working hours.
      create function schedule_contains_booking(p_staff uuid,p_branch uuid,p_start timestamptz,p_end timestamptz) returns boolean
        language plpgsql stable security definer set search_path=public as $$begin return true; end$$;
      revoke all on function schedule_contains_booking(uuid,uuid,timestamptz,timestamptz) from public;
      revoke all on function schedule_contains_booking(uuid,uuid,timestamptz,timestamptz) from anon,authenticated;
      grant execute on function schedule_contains_booking(uuid,uuid,timestamptz,timestamptz) to service_role;
      insert into auth.users(id,email) values('${user}','one@example.invalid'),('${other}','two@example.invalid');
      insert into profiles(id,full_name) values('${user}','Synthetic One'),('${other}','Synthetic Two');
      insert into businesses(id) values('${biz}'); insert into branches(id,biz_id) values('${branch}','${biz}');
      insert into staff(id,biz_id,branch_id) values('${staff}','${biz}','${branch}');
      insert into services(id,biz_id,branch_id,duration_min) values('${service}','${biz}','${branch}',30),('${service2}','${biz}','${branch}',20);
    `);
    for (const predecessor of ['hold_slot','hold_complex_slot','hold_slot_guest','hold_complex_slot_guest','confirm_booking','cancel_booking',
      'get_free_slots_service_day','booking_view_public']) sql(baselineFunction(predecessor));
    sql(source('20261110090000_booking_notification_outbox.sql'));
    sql(source('20261110101000_atomic_booking_requests.sql'));
    // Authorization helpers as the migration chain leaves them (20261110131000, 20261110132000, the baseline).
    for (const signature of ['public.finance_is_platform_admin(uuid)','public.finance_can_manage_business(uuid,uuid)',
      'public.is_super_admin()','public.has_branch_admin(uuid)']) installLiveFunction(sql, signature);
    // Baseline table grants (20261110123000 revokes the writes) and the read policies that
    // 20261118090000 keeps; it drops every write policy.
    sql(`alter table bookings enable row level security;
      grant all on bookings to anon,authenticated;
      grant update(status),insert(id),references(id) on bookings to authenticated;
      grant select on profiles,user_roles,roles,staff to authenticated;
      ${['Business owners can view own bookings','Staff can view own bookings','bookings_select_client'].map(baselinePolicy).join('\n')}`);
    sql(source('20261110123000_service_only_booking_commands.sql'));
    // 20261118100000 also redefines this slots function; 20261110121000 created it with grants for the client roles.
    installLiveFunction(sql, 'public.get_free_slots_service_day_v2(uuid,uuid,date,integer,integer,uuid)');
    sql(source('20261118100000_booking_service_staff_checks.sql'));
    sql(source('20261125110100_booking_requires_approved_business.sql'));
    sql(source('20261125150000_client_cancel_cutoff.sql'));
    sql(source('20261125150100_client_reschedule.sql'));

    // Real first transaction overlaps concurrent retries; every caller gets the
    // identical committed receipt, not another attempt or an unavailable slot.
    const guestId = randomUUID();
    const slowFirst = asyncSql('begin; ' + command(guestId, payload(1)) + ' select pg_sleep(0.35); commit;');
    await new Promise(resolve => setTimeout(resolve, 80));
    const guestRetries = await Promise.all(Array.from({ length: 8 }, () => asyncSql(command(guestId, payload(1)))));
    const first = JSON.parse((await slowFirst).trim());
    guestRetries.forEach(result => assert.deepEqual(JSON.parse(result), first));
    assert.equal(sql('select count(*) from bookings;'), '1');
    assert.equal(sql('select count(*) from booking_creation_requests;'), '1');
    assert.equal(sql("select status||':'||(expires_at is null) from bookings;"), 'confirmed:true');
    assert.equal(sql(`select count(*) from booking_notification_outbox where booking_id='${first.booking_id}' and event_type='confirm';`), '1');

    expectFailure(command(guestId, payload(2)), /BOOKING_REQUEST_CONFLICT/);
    expectFailure(command(guestId, payload(1), true, user, 'b'.repeat(64)), /BOOKING_REQUEST_CONFLICT/);
    expectFailure(command(guestId, payload(1), false), /BOOKING_REQUEST_CONFLICT/);
    assert.equal(sql('select count(*) from bookings;'), '1');

    const authId = randomUUID();
    const auth = await Promise.all(Array.from({ length: 8 }, () => asyncSql(command(authId, payload(2), false))));
    assert.equal(new Set(auth).size, 1);
    const authBooking = JSON.parse(auth[0]).booking_id;
    assert.equal(sql(`select client_id from bookings where id='${authBooking}';`), user);
    expectFailure(command(authId, payload(2), false, other), /BOOKING_REQUEST_CONFLICT/);

    for (const [day, guest] of [[3, true], [4, false]]) {
      const input = { ...payload(day), services: [
        { service_id: service, duration_min: 30, order_index: 0 },
        { service_id: service2, duration_min: 20, order_index: 1 },
      ] };
      const requestId = randomUUID();
      const results = await Promise.all(Array.from({ length: 6 }, () => asyncSql(command(requestId, input, guest))));
      assert.equal(new Set(results).size, 1);
      const bookingId = JSON.parse(results[0]).booking_id;
      assert.equal(sql(`select count(*) from booking_services where booking_id='${bookingId}';`), '2');
      assert.equal(sql(`select status from bookings where id='${bookingId}';`), 'confirmed');
    }

    // Different request identities still cannot book one staff/time twice.
    const competitors = await Promise.allSettled(Array.from({ length: 8 }, () => asyncSql(command(randomUUID(), payload(5)))));
    assert.equal(competitors.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(competitors.filter(result => result.status === 'rejected' && /time slot is already booked/.test(result.reason.message)).length, 7);

    // Replay must survive changes to availability and user-facing status.
    sql(`update branches set is_active=false where id='${branch}'; update bookings set status='cancelled' where id='${first.booking_id}';`);
    assert.deepEqual(JSON.parse(sql(command(guestId, payload(1)))), first);
    sql(`update branches set is_active=true where id='${branch}';`);

    // Inject an actual PostgreSQL failure after hold insertion. There must be no
    // booking/services/receipt/outbox from the failed transaction, then retry works.
    sql(`create function synthetic_fail_confirmation() returns trigger language plpgsql as $$begin
      if new.start_at='2035-01-06T10:00:00Z'::timestamptz and new.status='confirmed' then raise exception 'synthetic confirm failure'; end if;
      return new; end$$;
      create trigger synthetic_confirm_failure before update on bookings for each row execute function synthetic_fail_confirmation();`);
    const rollbackId = randomUUID();
    const outboxBefore = sql('select count(*) from booking_notification_outbox;');
    expectFailure(command(rollbackId, payload(6)), /synthetic confirm failure/);
    assert.equal(sql(`select count(*) from bookings where start_at='2035-01-06T10:00:00Z';`), '0');
    assert.equal(sql(`select count(*) from booking_creation_requests where request_id='${rollbackId}';`), '0');
    assert.equal(sql('select count(*) from booking_notification_outbox;'), outboxBefore);
    sql('drop trigger synthetic_confirm_failure on bookings; drop function synthetic_fail_confirmation();');
    assert.equal(JSON.parse(sql(command(rollbackId, payload(6)))).confirmed, true);

    sql(`create function synthetic_fail_outbox() returns trigger language plpgsql as $$begin
      if new.event_type='confirm' and exists(select 1 from bookings where id=new.booking_id and start_at='2035-01-07T10:00:00Z'::timestamptz)
      then raise exception 'synthetic outbox failure'; end if; return new; end$$;
      create trigger synthetic_outbox_failure before insert on booking_notification_outbox for each row execute function synthetic_fail_outbox();`);
    const outboxRollbackId = randomUUID();
    const outboxCount = sql('select count(*) from booking_notification_outbox;');
    expectFailure(command(outboxRollbackId, payload(7)), /synthetic outbox failure/);
    assert.equal(sql(`select count(*) from bookings where start_at='2035-01-07T10:00:00Z';`), '0');
    assert.equal(sql(`select count(*) from booking_creation_requests where request_id='${outboxRollbackId}';`), '0');
    assert.equal(sql('select count(*) from booking_notification_outbox;'), outboxCount);
    sql('drop trigger synthetic_outbox_failure on booking_notification_outbox; drop function synthetic_fail_outbox();');
    assert.equal(JSON.parse(sql(command(outboxRollbackId, payload(7)))).confirmed, true);

    sql(`create function synthetic_fail_composition() returns trigger language plpgsql as $$begin
      if new.order_index=1 then raise exception 'synthetic composition failure'; end if; return new; end$$;
      create trigger synthetic_composition_failure before insert on booking_services for each row execute function synthetic_fail_composition();`);
    const compositionId = randomUUID();
    const complexInput = { ...payload(8), services: [
      { service_id: service, duration_min: 30, order_index: 0 },
      { service_id: service2, duration_min: 20, order_index: 1 },
    ] };
    const compositionBefore = sql('select count(*) from booking_services;');
    const compositionOutbox = sql('select count(*) from booking_notification_outbox;');
    expectFailure(command(compositionId, complexInput), /synthetic composition failure/);
    assert.equal(sql('select count(*) from booking_services;'), compositionBefore);
    assert.equal(sql('select count(*) from booking_notification_outbox;'), compositionOutbox);
    assert.equal(sql(`select count(*) from bookings where start_at='2035-01-08T10:00:00Z';`), '0');
    assert.equal(sql(`select count(*) from booking_creation_requests where request_id='${compositionId}';`), '0');
    sql('drop trigger synthetic_composition_failure on booking_services; drop function synthetic_fail_composition();');
    assert.equal(JSON.parse(sql(command(compositionId, complexInput))).confirmed, true);

    for (const role of ['anon', 'authenticated']) {
      expectFailure(`set role ${role}; select * from booking_creation_requests;`, /permission denied/);
      expectFailure(`set role ${role}; insert into booking_creation_requests(request_id,caller_hash,payload_hash) values(gen_random_uuid(),'forged','forged');`, /permission denied/);
      for (const signature of [
        'hold_slot(uuid,uuid,uuid,uuid,timestamp with time zone)',
        'hold_complex_slot(uuid,uuid,uuid,timestamp with time zone,jsonb)',
        'hold_slot_guest(uuid,uuid,uuid,uuid,timestamp with time zone,text,text,text)',
        'hold_complex_slot_guest(uuid,uuid,uuid,timestamp with time zone,jsonb,text,text,text)',
      ]) assert.equal(sql(`select has_function_privilege('${role}',${quote(signature)},'execute');`), 'f');
      for (const signature of ['create_confirmed_booking(uuid,jsonb,text)','create_confirmed_booking(uuid,jsonb,text,uuid)',
        '_hold_slot_for_actor(uuid,uuid,uuid,uuid,timestamptz,uuid)','_hold_complex_slot_for_actor(uuid,uuid,uuid,timestamptz,jsonb,uuid)',
        '_confirm_booking_transition(uuid)','_confirm_created_booking(uuid,uuid)']) {
        assert.equal(sql(`select has_function_privilege('${role}',${quote(signature)},'execute');`),'f');
      }
      expectFailure(`set role ${role}; select create_confirmed_booking(gen_random_uuid(),'{}',null,'${user}');`,/permission denied/);
      expectFailure(`set role ${role}; select create_confirmed_booking(gen_random_uuid(),'{}','${secret}');`,/permission denied/);
    }
    for(const signature of ['_hold_slot_for_actor(uuid,uuid,uuid,uuid,timestamptz,uuid)',
      '_hold_complex_slot_for_actor(uuid,uuid,uuid,timestamptz,jsonb,uuid)','_confirm_booking_transition(uuid)','_confirm_created_booking(uuid,uuid)']) {
      assert.equal(sql(`select has_function_privilege('service_role',${quote(signature)},'execute');`),'f','private implementation is command-only');
    }
    assert.equal(sql("select has_function_privilege('service_role','create_confirmed_booking(uuid,jsonb,text,uuid)','execute');"),'t');
    expectFailure(`set role service_role; select create_confirmed_booking(gen_random_uuid(),'{}','${secret}','${user}');`,/INVALID_BOOKING_REQUEST/);
    expectFailure(command(randomUUID(), payload(7), false, ''), /BOOKING_AUTH_REQUIRED/);
    expectFailure(command(randomUUID(), payload(7), true, user, 'short'), /INVALID_BOOKING_REQUEST/);
    const context = sql(command(randomUUID(),payload(25),false)+" select current_setting('request.jwt.claim.sub');").split('\n');
    assert.equal(context.at(-1),other,'explicit actor must not alter request JWT context');
    const created = JSON.parse(context[0]);
    assert.equal(sql(`select client_id from bookings where id='${created.booking_id}';`),user,'analytics/insert sees the verified actor from creation');
    // Receipts created by the previous three-argument implementation remain replayable.
    for(const [day,guest] of [[26,true],[27,false]]) {
      const request=randomUUID();
      const old=JSON.parse(sql(`set request.jwt.claim.sub='${guest?'':user}'; select create_confirmed_booking('${request}',${quote(JSON.stringify(payload(day)))}::jsonb,${guest?quote(secret):'null'});`));
      assert.deepEqual(JSON.parse(sql(command(request,payload(day),guest))),old);
    }
    const lockedRequest=randomUUID();
    const lockOwner=asyncSql(`set application_name='booking-deadline-fixture'; begin; select id from staff where id='${staff}' for update; select pg_sleep(9); commit;`);
    let lockReady=false;
    for(let index=0;index<20;index++) {
      if(sql("select exists(select 1 from pg_stat_activity where application_name='booking-deadline-fixture' and wait_event='PgSleep');")==='t') { lockReady=true; break; }
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    assert(lockReady,'staff lock fixture must be acquired before deadline probe');
    expectFailure(command(lockedRequest,payload(28)),/lock timeout/);
    assert.equal(sql(`select count(*) from booking_creation_requests where request_id='${lockedRequest}';`),'0','lock timeout rolls back uncommitted receipt');
    await lockOwner;
    assert.equal(JSON.parse(sql(command(lockedRequest,payload(28)))).confirmed,true,'same request may retry after lock timeout');

    // 20261118100000: the holds book only a master who performs the service (service_staff), never a
    // start in the past, and take durations from the catalogue. The scenarios above run in a business
    // without links, where every master performs every service.
    const linkedBiz=id(50),linkedBranch=id(51),performer=id(52),newcomer=id(53),cut=id(54),wash=id(55);
    sql(`insert into businesses(id) values('${linkedBiz}'); insert into branches(id,biz_id) values('${linkedBranch}','${linkedBiz}');
      insert into staff(id,biz_id,branch_id) values('${performer}','${linkedBiz}','${linkedBranch}'),('${newcomer}','${linkedBiz}','${linkedBranch}');
      insert into services(id,biz_id,branch_id,name_ru,duration_min) values('${cut}','${linkedBiz}','${linkedBranch}','Synthetic cut',30),
        ('${wash}','${linkedBiz}','${linkedBranch}','Synthetic wash',20);
      insert into service_staff(service_id,staff_id) values('${cut}','${performer}'),('${wash}','${performer}');`);
    const linked=(staffId,start,services)=>({...payload(1),biz_id:linkedBiz,branch_id:linkedBranch,staff_id:staffId,service_id:cut,start_at:start,...(services?{services}:{})});
    const unlinkedRequest=randomUUID();
    expectFailure(command(unlinkedRequest,linked(newcomer,'2035-02-01T10:00:00Z')),/STAFF_DOES_NOT_PERFORM_SERVICE/);
    assert.equal(sql(`select count(*) from booking_creation_requests where request_id='${unlinkedRequest}';`),'0','a rejected master leaves no receipt');
    sql(`insert into service_staff(service_id,staff_id) values('${cut}','${newcomer}');`);
    assert.equal(JSON.parse(sql(command(unlinkedRequest,linked(newcomer,'2035-02-01T10:00:00Z')))).confirmed,true,'the same request succeeds once the master performs the service');
    expectFailure(command(randomUUID(),linked(performer,new Date(Date.now()-3600000).toISOString())),/SLOT_IN_PAST/);
    const catalogue=JSON.parse(sql(command(randomUUID(),linked(performer,'2035-02-02T10:00:00Z',
      [{service_id:cut,duration_min:525600},{service_id:wash,duration_min:525600}]))));
    assert.equal(sql(`select (end_at-start_at)||'|'||(select string_agg(duration_min::text,',' order by order_index) from booking_services s where s.booking_id=b.id)
      from bookings b where id='${catalogue.booking_id}';`),'00:50:00|30,20','durations come from the catalogue, not the request');
    // R25-09: an unapproved business refuses new bookings; a replay of an earlier receipt still answers.
    const approvedRequest=randomUUID();
    const approvedPayload=linked(performer,'2035-02-03T10:00:00Z',[{service_id:cut,duration_min:30}]);
    const approvedFirst=JSON.parse(sql(command(approvedRequest,approvedPayload)));
    const approvedBiz=`(select biz_id from bookings where id='${approvedFirst.booking_id}')`;
    sql(`update businesses set is_approved=false where id=${approvedBiz};`);
    assert.deepEqual(JSON.parse(sql(command(approvedRequest,approvedPayload))),approvedFirst);
    expectFailure(command(randomUUID(),linked(performer,'2035-02-04T10:00:00Z',[{service_id:cut,duration_min:30}])),/BUSINESS_NOT_BOOKABLE/);
    sql(`update businesses set is_approved=true where id=${approvedBiz};`);

    const owner=id(20),manager=id(21),foreignManager=id(22),worker=id(23),branchAdmin=id(24),platformAdmin=id(25),biz2=id(26),branch2=id(27);
    sql(`update businesses set owner_id='${owner}' where id='${biz}';
      insert into businesses(id) values('${biz2}'); insert into branches(id,biz_id) values('${branch2}','${biz}');
      insert into roles values('${id(30)}','manager','business'),('${id(31)}','super_admin','platform');
      insert into user_roles values('${manager}','${biz}','${id(30)}'),('${foreignManager}','${biz2}','${id(30)}');
      insert into branch_admins values('${branch}','${branchAdmin}');
      insert into user_global_roles values('${platformAdmin}','${id(31)}');
      update staff set user_id='${worker}' where id='${staff}';`);
    let fixtureIndex=0;
    const hold = (client=user,branchId=branch) => {
      const bookingId=randomUUID();fixtureIndex++;
      sql(`insert into bookings(id,biz_id,branch_id,staff_id,service_id,client_id,start_at,end_at,status,expires_at)
        values('${bookingId}','${biz}','${branchId}','${staff}','${service}',${client?quote(client):'null'},
        '2036-01-01'::timestamptz+interval '${fixtureIndex} hours','2036-01-01'::timestamptz+interval '${fixtureIndex} hours 30 minutes','hold',now()+interval '1 hour');`);
      return bookingId;
    };
    const confirm = (bookingId,actor,role='authenticated') => `set role ${role}; set request.jwt.claim.sub='${actor??''}'; select confirm_booking('${bookingId}');`;
    const owned=hold();
    expectFailure(confirm(owned,user,'anon'),/permission denied/);
    expectFailure(confirm(owned,other),/BOOKING_FORBIDDEN/);
    expectFailure(`set role authenticated; set request.jwt.claim.sub='${other}'; set request.jwt.claim.role='service_role'; select confirm_booking('${owned}');`,/BOOKING_FORBIDDEN/);
    assert.equal(sql(`select status from bookings where id='${owned}';`),'hold');
    sql(confirm(owned,user));sql(confirm(owned,user));
    assert.equal(sql(`select status||':'||(expires_at is null) from bookings where id='${owned}';`),'confirmed:true');
    assert.equal(sql(`select count(*) from booking_notification_outbox where booking_id='${owned}' and event_type='confirm';`),'1');
    for(const actor of [owner,manager,worker,branchAdmin,platformAdmin]) {
      const target=hold();sql(confirm(target,actor));
      assert.equal(sql(`select status from bookings where id='${target}';`),'confirmed');
    }
    expectFailure(confirm(hold(),foreignManager),/BOOKING_FORBIDDEN/);
    expectFailure(confirm(hold(user,branch2),branchAdmin),/BOOKING_FORBIDDEN/);
    sql(`update staff set is_active=false where id='${staff}';`);
    expectFailure(confirm(hold(),worker),/BOOKING_FORBIDDEN/);
    const guestTarget=hold(null);sql(confirm(guestTarget,null,'service_role'));
    assert.equal(sql(`select status from bookings where id='${guestTarget}';`),'confirmed');
    sql(`update staff set is_active=true where id='${staff}';`);
    const cancel=(bookingId,actor=user,role='authenticated')=>`set role ${role}; set request.jwt.claim.sub='${actor??''}'; select cancel_booking('${bookingId}');`;
    const cancellable=hold();
    expectFailure(cancel(cancellable,user,'anon'),/permission denied/);
    expectFailure(cancel(cancellable,other),/BOOKING_FORBIDDEN/);
    expectFailure(cancel(randomUUID()),/BOOKING_NOT_FOUND/);
    for(const actor of [user,owner,manager,worker,branchAdmin,platformAdmin]) {
      const target=hold();sql(cancel(target,actor));sql(cancel(target,actor));
      assert.equal(sql(`select status||':'||(expires_at is null) from bookings where id='${target}';`),'cancelled:true');
      assert.equal(sql(`select count(*) from booking_notification_outbox where booking_id='${target}' and event_type='cancel';`),'1');
    }
    expectFailure(cancel(hold(),foreignManager),/BOOKING_FORBIDDEN/);
    expectFailure(cancel(hold(user,branch2),branchAdmin),/BOOKING_FORBIDDEN/);
    for(const reason of ['paid','ledger','promotion','subscription']) {
      const target=hold();sql(confirm(target,user));
      if(reason==='paid') sql(`update bookings set status='paid' where id='${target}';`);
      if(reason==='ledger') sql(`insert into staff_shift_items values('${target}');`);
      if(reason==='promotion'||reason==='subscription') sql(`update bookings set ${reason}_applied='{}' where id='${target}';`);
      const before=sql(`select row_to_json(b) from bookings b where id='${target}';`);
      expectFailure(cancel(target,user),/BOOKING_FINANCIAL_REVERSAL_REQUIRED/);
      expectFailure(cancel(target,null,'service_role'),/BOOKING_FINANCIAL_REVERSAL_REQUIRED/);
      assert.equal(sql(`select row_to_json(b) from bookings b where id='${target}';`),before);
      assert.equal(sql(`select count(*) from booking_notification_outbox where booking_id='${target}' and event_type='cancel';`),'0');
    }
    const terminal=hold();sql(`update bookings set status='no_show' where id='${terminal}';`);
    expectFailure(cancel(terminal),/BOOKING_STATUS_NOT_CANCELLABLE/);
    const serviceCancel=hold(null);sql(cancel(serviceCancel,null,'service_role'));
    assert.equal(sql(`select status from bookings where id='${serviceCancel}';`),'cancelled');
    // The live read policies let the own client and a business manager see the row, but neither
    // can bypass the checked RPCs through DML: no table or column write grants remain.
    for(const actor of [user,manager]) {
      const prefix=`set role authenticated; set request.jwt.claim.sub='${actor}';`;
      assert.equal(sql(prefix+`select count(*) from bookings where id='${cancellable}';`),'1');
      for(const action of [`update bookings set status='cancelled' where id='${cancellable}'`,
        `delete from bookings where id='${cancellable}'`,
        `insert into bookings(id,client_id) values('${randomUUID()}','${actor}')`,
        'truncate bookings']) expectFailure(prefix+action,/permission denied/);
      assert.equal(sql(`select has_any_column_privilege('authenticated','bookings','UPDATE') or has_any_column_privilege('authenticated','bookings','INSERT') or has_any_column_privilege('authenticated','bookings','REFERENCES');`),'f');
    }
    const internal=(actor,complex=false,role='authenticated',branchId=branch)=>{
      fixtureIndex++;
      const start=`'2038-01-01'::timestamptz+interval '${fixtureIndex} hours'`;
      const args=complex?`'${biz}','${branchId}','${staff}',${start},'[{"service_id":"${service}","duration_min":30}]'::jsonb,null,null,null,null`
        :`'${biz}','${branchId}','${service}','${staff}',${start},30,null,null,null`;
      return `set role ${role};set request.jwt.claim.sub='${actor}';select create_internal_${complex?'complex_':''}booking(${args});`;
    };
    for(const complex of [false,true]) {
      expectFailure(internal(owner,complex,'anon'),/permission denied/);
      for(const actor of [other,foreignManager]) expectFailure(internal(actor,complex),/BOOKING_FORBIDDEN/);
      expectFailure(internal(branchAdmin,complex,'authenticated',branch2),/BOOKING_FORBIDDEN/);
      for(const actor of [owner,manager,worker,branchAdmin,platformAdmin]) {
        const target=sql(internal(actor,complex));
        assert.equal(sql(`select status from bookings where id='${target}';`),'confirmed');
        assert.equal(sql(`select count(*) from booking_notification_outbox where booking_id='${target}' and event_type='confirm';`),'1');
      }
    }
    assert.equal(sql("select has_function_privilege('authenticated','_assert_internal_booking_access(uuid,uuid,uuid)','execute')"),'f');
    // 20261117190000 dropped the unchecked seven-argument overload.
    assert.equal(sql("select to_regprocedure('public.create_internal_booking(uuid,uuid,uuid,uuid,timestamptz,integer,uuid)') is null"),'t');
    {
    sql(source('20261110133000_internal_booking_requests.sql'));
    const internalPayload={mode:'simple',biz_id:biz,branch_id:branch,staff_id:staff,service_id:service,
      start_at:'2039-01-01T10:00:00Z',duration_min:30,client_id:user,client_name:null,client_phone:null};
    const internalCommand=(requestId,input=internalPayload,actor=owner)=>`set role service_role;set request.jwt.claim.sub='${other}';select create_internal_booking_request('${requestId}',${quote(JSON.stringify(input))}::jsonb,'${actor}');`;
    const internalRequest=randomUUID();
    const legacyPlatformActor=id(45);
    sql(`insert into user_roles(user_id,biz_id,role_id) values('${legacyPlatformActor}',null,'${id(31)}');`);
    assert.equal(JSON.parse(sql(internalCommand(randomUUID(),{...internalPayload,start_at:'2039-01-05T10:00:00Z'},legacyPlatformActor))).confirmed,true);
    const internalFirst=asyncSql('begin;'+internalCommand(internalRequest)+'select pg_sleep(0.35);commit;');
    await new Promise(resolve=>setTimeout(resolve,80));
    const internalReplies=await Promise.all(Array.from({length:8},()=>asyncSql(internalCommand(internalRequest))));
    const internalReceipt=JSON.parse((await internalFirst).trim());
    internalReplies.forEach(reply=>assert.deepEqual(JSON.parse(reply),internalReceipt));
    assert.equal(sql(`select client_id from bookings where id='${internalReceipt.booking_id}'`),user,'actor is not booking client');
    assert.equal(sql(`select count(*) from booking_notification_outbox where booking_id='${internalReceipt.booking_id}' and event_type='confirm'`),'1');
    assert.deepEqual(JSON.parse(sql(internalCommand(internalRequest,{...internalPayload,start_at:'2039-01-01T16:00:00+06:00'}))),internalReceipt);
    expectFailure(internalCommand(internalRequest,{...internalPayload,duration_min:45}),/BOOKING_REQUEST_CONFLICT/);
    expectFailure(internalCommand(internalRequest,internalPayload,manager),/BOOKING_REQUEST_CONFLICT/);
    expectFailure(internalCommand(randomUUID(),internalPayload,other),/BOOKING_FORBIDDEN/);
    expectFailure(internalCommand(guestId,internalPayload),/BOOKING_REQUEST_CONFLICT/);
    for(const role of ['anon','authenticated']) {
      expectFailure(`set role ${role};select create_internal_booking_request('${randomUUID()}',${quote(JSON.stringify(internalPayload))}::jsonb,'${owner}');`,/permission denied/);
    }
    for(const role of ['anon','authenticated','service_role']) {
      expectFailure(internal(owner,false,role),/permission denied/);
      expectFailure(internal(owner,true,role),/permission denied/);
      // A seven-argument call resolves to the nine-argument overload, closed to every client role.
      expectFailure(`set role ${role};select create_internal_booking('${biz}'::uuid,'${branch}'::uuid,'${service}'::uuid,'${staff}'::uuid,now(),30,'${user}'::uuid);`,/permission denied/);
    }
    const complexInput={...internalPayload,mode:'complex',start_at:'2039-01-02T10:00:00Z',services:[{service_id:service,duration_min:30},{service_id:service2,duration_min:20}]};
    delete complexInput.service_id;delete complexInput.duration_min;
    const complexRequest=randomUUID();
    const complexResults=await Promise.all(Array.from({length:6},()=>asyncSql(internalCommand(complexRequest,complexInput,worker))));
    assert.equal(new Set(complexResults).size,1);
    assert.equal(sql(`select count(*) from booking_services where booking_id='${JSON.parse(complexResults[0]).booking_id}'`),'2');
    const competingInternal=await Promise.allSettled(Array.from({length:5},()=>asyncSql(internalCommand(randomUUID(),{...internalPayload,start_at:'2039-01-04T10:00:00Z'}))));
    assert.equal(competingInternal.filter(result=>result.status==='fulfilled').length,1);
    assert.equal(sql("select count(*) from bookings where start_at='2039-01-04T10:00:00Z'"),'1');
    const failedInternal=randomUUID();
    sql("create function reject_internal_item() returns trigger language plpgsql as $$begin raise exception 'INJECTED_INTERNAL_ROLLBACK';end$$;create trigger reject_internal_item before insert on booking_services for each row execute function reject_internal_item();");
    const outboxBeforeRollback=sql('select count(*) from booking_notification_outbox');
    expectFailure(internalCommand(failedInternal,{...complexInput,start_at:'2039-01-03T10:00:00Z'}),/INJECTED_INTERNAL_ROLLBACK/);
    assert.equal(sql(`select count(*) from booking_creation_requests where request_id='${failedInternal}'`),'0');
    assert.equal(sql("select count(*) from bookings where start_at='2039-01-03T10:00:00Z'"),'0');
    assert.equal(sql('select count(*) from booking_notification_outbox'),outboxBeforeRollback);
    sql('drop trigger reject_internal_item on booking_services');
    assert.equal(JSON.parse(sql(internalCommand(failedInternal,{...complexInput,start_at:'2039-01-03T10:00:00Z'}))).confirmed,true);
    }
    {
    // 20261125150000 (R25-10): the client cancels only before the start; the business afterwards.
    const startedBooking=(client=user,status='confirmed')=>{
      const bookingId=randomUUID();fixtureIndex++;
      sql(`insert into bookings(id,biz_id,branch_id,staff_id,service_id,client_id,start_at,end_at,status)
        values('${bookingId}','${biz}','${branch}','${staff}','${service}',${quote(client)},
        now()-interval '${fixtureIndex} minutes',now()+interval '30 minutes','${status}');`);
      return bookingId;
    };
    for(const status of ['confirmed','hold']) {
      const target=startedBooking(user,status);
      const before=sql(`select row_to_json(b) from bookings b where id='${target}';`);
      expectFailure(cancel(target,user),/BOOKING_ALREADY_STARTED/);
      assert.equal(sql(`select row_to_json(b) from bookings b where id='${target}';`),before,'a refused client cancellation changes nothing');
      assert.equal(sql(`select count(*) from booking_notification_outbox where booking_id='${target}' and event_type='cancel';`),'0');
    }
    for(const actor of [owner,manager,worker,branchAdmin,platformAdmin]) {
      const target=startedBooking();sql(cancel(target,actor));
      assert.equal(sql(`select status from bookings where id='${target}';`),'cancelled',`business actor ${actor} cancels after the start`);
    }
    const serviceStarted=startedBooking();sql(cancel(serviceStarted,null,'service_role'));
    assert.equal(sql(`select status from bookings where id='${serviceStarted}';`),'cancelled','trusted calls without a JWT keep cancelling');
    sql(`insert into auth.users(id,email) values('${manager}','manager@example.invalid') on conflict do nothing;`);
    const managerOwn=startedBooking(manager);sql(cancel(managerOwn,manager));
    assert.equal(sql(`select status from bookings where id='${managerOwn}';`),'cancelled','a client who manages the business keeps its rights');
    const already=startedBooking(user,'cancelled');sql(cancel(already,user));
    const paidStarted=startedBooking(user,'paid');
    expectFailure(cancel(paidStarted,user),/BOOKING_FINANCIAL_REVERSAL_REQUIRED/);
    const future=hold();sql(cancel(future,user));
    assert.equal(sql(`select status from bookings where id='${future}';`),'cancelled','the client still cancels before the start');

    // 20261125150100: client reschedule, same staff/branch/services, idempotent receipt.
    const reschedule=(requestId,bookingId,start,actor=user)=>`set role service_role;set request.jwt.claim.sub='${other}';`+
      `select reschedule_booking_request('${requestId}','${bookingId}','${start}'::timestamptz,${actor?quote(actor):'null'});`;
    const book=(start,actor=user,services)=>JSON.parse(sql(command(randomUUID(),{...payload(1),start_at:start,...(services?{services}:{})},false,actor))).booking_id;
    const moved=book('2040-01-01T10:00:00Z');
    const revision=()=>sql(`select notification_revision from bookings where id='${moved}';`);
    const confirms=()=>sql(`select count(*) from booking_notification_outbox where booking_id='${moved}' and event_type='confirm';`);
    const revisionBefore=revision();
    assert.equal(confirms(),'1');
    const moveRequest=randomUUID();
    const first=JSON.parse(sql(reschedule(moveRequest,moved,'2040-01-01T12:00:00Z')));
    assert.equal(first.rescheduled,true);
    assert.equal(first.booking_id,moved);
    assert.equal(sql(`select to_char(start_at at time zone 'UTC','HH24:MI')||'-'||to_char(end_at at time zone 'UTC','HH24:MI')||':'||status from bookings where id='${moved}';`),'12:00-12:30:confirmed');
    assert.equal(Number(revision()),Number(revisionBefore)+1,'the move is a new notification revision');
    assert.equal(confirms(),'2','the new revision has its own confirmation event');
    assert.equal(sql(`select count(*) from booking_notification_outbox where booking_id='${moved}' and event_type='confirm' and booking_revision=${revision()};`),'1');
    // Replay: the same answer, no second move or event.
    const replays=await Promise.all(Array.from({length:4},()=>asyncSql(reschedule(moveRequest,moved,'2040-01-01T12:00:00Z'))));
    replays.forEach(reply=>assert.deepEqual(JSON.parse(reply),first));
    assert.equal(confirms(),'2');
    expectFailure(reschedule(moveRequest,moved,'2040-01-01T13:00:00Z'),/BOOKING_REQUEST_CONFLICT/);
    expectFailure(reschedule(moveRequest,moved,'2040-01-01T12:00:00Z',other),/BOOKING_REQUEST_CONFLICT/);
    expectFailure(reschedule(randomUUID(),moved,'2040-01-01T12:00:00Z'),/RESCHEDULE_SAME_TIME/);
    // Another user, the business's manager and an anonymous actor cannot move the client's booking.
    for(const actor of [other,manager,owner]) expectFailure(reschedule(randomUUID(),moved,'2040-01-01T14:00:00Z',actor),/BOOKING_FORBIDDEN/);
    expectFailure(reschedule(randomUUID(),moved,'2040-01-01T14:00:00Z',null),/BOOKING_AUTH_REQUIRED/);
    expectFailure(reschedule(randomUUID(),randomUUID(),'2040-01-01T14:00:00Z'),/BOOKING_NOT_FOUND/);
    // Overlap with another client's booking is refused and leaves no receipt; adjacency is free.
    book('2040-01-01T15:00:00Z',other);
    const overlapRequest=randomUUID();
    expectFailure(reschedule(overlapRequest,moved,'2040-01-01T15:15:00Z'),/time slot is already booked/);
    expectFailure(reschedule(randomUUID(),moved,'2040-01-01T14:45:00Z'),/time slot is already booked/);
    assert.equal(sql(`select count(*) from booking_creation_requests where request_id='${overlapRequest}';`),'0');
    assert.equal(sql(`select to_char(start_at at time zone 'UTC','HH24:MI') from bookings where id='${moved}';`),'12:00');
    JSON.parse(sql(reschedule(randomUUID(),moved,'2040-01-01T15:30:00Z')));
    // Overlapping its own current time is allowed (the booking does not conflict with itself).
    JSON.parse(sql(reschedule(randomUUID(),moved,'2040-01-01T15:45:00Z')));
    assert.equal(sql(`select to_char(start_at at time zone 'UTC','HH24:MI')||'-'||to_char(end_at at time zone 'UTC','HH24:MI') from bookings where id='${moved}';`),'15:45-16:15');
    // Outside the schedule: the synthetic schedule closes at 20:00 UTC for this probe only.
    sql(`create or replace function schedule_contains_booking(p_staff uuid,p_branch uuid,p_start timestamptz,p_end timestamptz) returns boolean
      language plpgsql stable security definer set search_path=public as $$begin return extract(hour from p_end at time zone 'UTC') < 20 or p_end::time = '20:00'; end$$;`);
    expectFailure(reschedule(randomUUID(),moved,'2040-01-01T19:45:00Z'),/SCHEDULE_OUTSIDE_WORKING_HOURS/);
    sql(`create or replace function schedule_contains_booking(p_staff uuid,p_branch uuid,p_start timestamptz,p_end timestamptz) returns boolean
      language plpgsql stable security definer set search_path=public as $$begin return true; end$$;`);
    expectFailure(reschedule(randomUUID(),moved,new Date(Date.now()-3600000).toISOString()),/SLOT_IN_PAST/);
    // A complex visit keeps its booked duration and composition.
    const complexMoved=book('2040-01-02T10:00:00Z',user,[{service_id:service,duration_min:30},{service_id:service2,duration_min:20}]);
    JSON.parse(sql(reschedule(randomUUID(),complexMoved,'2040-01-02T11:00:00Z')));
    assert.equal(sql(`select (end_at-start_at)||'|'||(select string_agg(service_id::text||':'||duration_min,',' order by order_index) from booking_services s where s.booking_id=b.id) from bookings b where id='${complexMoved}';`),
      `00:50:00|${service}:30,${service2}:20`);
    // A master who no longer performs a service of the visit cannot take the new time.
    sql(`insert into service_staff(service_id,staff_id) values('${service2}','${staff}');`);
    expectFailure(reschedule(randomUUID(),complexMoved,'2040-01-02T12:00:00Z'),/STAFF_DOES_NOT_PERFORM_SERVICE/);
    sql(`delete from service_staff where service_id='${service2}' and staff_id='${staff}';`);
    // State refusals: started, not confirmed, money or benefit attached.
    expectFailure(reschedule(randomUUID(),startedBooking(),'2040-01-03T10:00:00Z'),/BOOKING_ALREADY_STARTED/);
    const held=hold();
    expectFailure(reschedule(randomUUID(),held,'2040-01-03T10:00:00Z'),/BOOKING_STATUS_NOT_RESCHEDULABLE/);
    for(const reason of ['paid','ledger','promotion']) {
      const target=book(`2040-01-0${4+['paid','ledger','promotion'].indexOf(reason)}T10:00:00Z`);
      if(reason==='paid') sql(`update bookings set status='paid' where id='${target}';`);
      if(reason==='ledger') sql(`insert into staff_shift_items values('${target}');`);
      if(reason==='promotion') sql(`update bookings set promotion_applied='{}' where id='${target}';`);
      expectFailure(reschedule(randomUUID(),target,'2040-01-08T10:00:00Z'),/BOOKING_FINANCIAL_REVERSAL_REQUIRED/);
    }
    sql(`update businesses set is_approved=false where id='${biz}';`);
    expectFailure(reschedule(randomUUID(),moved,'2040-01-01T17:00:00Z'),/BUSINESS_NOT_BOOKABLE/);
    sql(`update businesses set is_approved=true where id='${biz}';`);
    // Service-only: no client role may call the command.
    for(const role of ['anon','authenticated']) {
      assert.equal(sql(`select has_function_privilege('${role}','reschedule_booking_request(uuid,uuid,timestamptz,uuid)','execute');`),'f');
      expectFailure(`set role ${role};set request.jwt.claim.sub='${user}';select reschedule_booking_request(gen_random_uuid(),'${moved}',now()+interval '1 day','${user}');`,/permission denied/);
    }
    assert.equal(sql("select has_function_privilege('service_role','reschedule_booking_request(uuid,uuid,timestamptz,uuid)','execute');"),'t');
    }
    sql(source('20261110140000_booking_legacy_surface.sql'));
    for(const role of ['anon','authenticated']) {
      expectFailure(`set role ${role};select * from get_free_slots_service_day('${biz}','${service}','2039-01-01',2147483647,1,'Asia/Bishkek');`,/permission denied/);
    }
    assert.equal(sql(`set role service_role;select count(*) from get_free_slots_service_day('${biz}','${service}','2039-01-01',3,15,'Asia/Bishkek');`),'0');
    // 20261119020000 drops the booking view (booking_receipt_public replaced it) and the old outbox claim.
    // pg_cron is not installed here; besides the drops, that migration only schedules two cleanup jobs.
    sql("create schema cron; create function cron.schedule(text,text,text) returns bigint language sql as 'select 1::bigint';");
    sql(source('20261119020000_dead_functions_and_cleanup_jobs.sql'));
    for(const signature of ['booking_view_public(uuid)','claim_booking_notifications(integer,integer)']) {
      assert.equal(sql(`select to_regprocedure('public.${signature}') is null;`),'t',signature);
    }
    await assertLiveFunctions(sql, { suite: 'test-booking-requests-isolated.cjs', stubs: {
      'public.schedule_contains_booking(uuid,uuid,timestamp with time zone,timestamp with time zone)': {
        reason: 'synthetic schedule: every requested time is inside working hours; the explicit schedule tables are outside this suite',
        skip: ['body'],
      },
    } });
    console.log('PASS isolated PostgreSQL: guest/auth/internal single/complex parallel replay; explicit actor distinct from client/no JWT mutation; namespace/legacy receipt replay; caller/proof/payload binding; competing keys; rollback/outbox; service_staff, past-start and catalogue-duration hold checks; direct RPC and table/column DML denied; private helper ACL; own-client/owner/manager/active staff/branch/platform/service lifecycle; financial cancellation guards; client cancel cut-off at the start (R25-10) with business override; client reschedule receipt replay, overlap, schedule, state and ACL checks; cross-tenant/other-branch/anonymous/role-spoof rejection. Live booking/outbox/authorization SQL, synthetic schedule and records, no external services.');
  } finally {
    // Only this run's UUID-named disposable container is removed.
    if (/^kezek-booking-regression-[0-9a-f-]{36}$/.test(name)) run(['rm', '-f', '-v', name], undefined, true);
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });

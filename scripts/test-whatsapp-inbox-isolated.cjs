// Local-only inbox regressions. Uses production hold/confirm/request/outbox
// SQL in a synthetic minimal schema; schedule availability itself is not tested.
// Never reads .env/connection URLs or sends provider messages.
const { spawnSync, spawn } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const name = 'kezek-whatsapp-inbox-' + randomUUID();
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
const source = filename => readFileSync(path.join(root, 'supabase/migrations', filename), 'utf8');
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
    run(['image', 'inspect', 'postgres:16']);
    run(['run', '-d', '--name', name, '--network', 'none', '--tmpfs', '/var/lib/postgresql/data', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:16']);
    let ready = false;
    for (let i = 0; i < 60; i++) {
      if (run(['exec', name, 'pg_isready', '-U', 'postgres'], undefined, true).status === 0) { ready = true; break; }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    assert(ready, 'disposable Postgres startup');
    sql(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create table auth.users(id uuid primary key, email text, phone text, raw_user_meta_data jsonb default '{}');
      create table profiles(id uuid primary key references auth.users, full_name text, phone text);
      create table businesses(id uuid primary key,owner_id uuid);
      create table branches(id uuid primary key, biz_id uuid references businesses, is_active boolean default true);
      create table staff(id uuid primary key, biz_id uuid references businesses, branch_id uuid references branches, is_active boolean default true,user_id uuid);
      create table roles(id uuid primary key,key text,scope text);
      create table user_roles(user_id uuid,biz_id uuid,role_id uuid);
      create table branch_admins(branch_id uuid,user_id uuid);
      create table user_global_roles(user_id uuid,role_id uuid);
      create table super_admins_legacy(user_id uuid);
      create table staff_schedule_versions(staff_id uuid references staff);
      create table services(id uuid primary key, biz_id uuid references businesses, active boolean default true, duration_min integer);
      create type booking_status as enum ('hold','confirmed','paid','cancelled','completed','no_show');
      create table bookings(id uuid primary key default gen_random_uuid(), biz_id uuid not null references businesses,
        branch_id uuid not null references branches, staff_id uuid not null references staff, service_id uuid not null references services,
        client_id uuid references auth.users, client_name text, client_phone text, client_email text,
        start_at timestamptz not null, end_at timestamptz not null, status booking_status not null, expires_at timestamptz,
        source text default 'public', created_at timestamptz default now(),promotion_applied jsonb,subscription_applied jsonb);
      create table staff_shift_items(booking_id uuid references bookings);
      create table booking_services(booking_id uuid references bookings on delete cascade, service_id uuid references services,
        duration_min integer not null, order_index integer not null);
      create function schedule_contains_booking(uuid,uuid,timestamptz,timestamptz) returns boolean language sql as $$select true$$;
      insert into auth.users(id,email) values('${user}','one@example.invalid'),('${other}','two@example.invalid');
      insert into profiles(id,full_name) values('${user}','Synthetic One'),('${other}','Synthetic Two');
      insert into businesses(id) values('${biz}'); insert into branches(id,biz_id) values('${branch}','${biz}');
      insert into staff(id,biz_id,branch_id) values('${staff}','${biz}','${branch}');
      insert into services(id,biz_id,duration_min) values('${service}','${biz}',30),('${service2}','${biz}',20);
    `);
    sql(source('20261009103000_simple_booking_effective_schedule.sql'));
    sql(source('20261009110000_guest_booking_effective_schedule.sql'));
    sql(source('20261009104000_complex_booking_identity_contacts.sql'));
    const complexSource = source('20260918132000_explicit_schedule_complex_booking_writers.sql');
    const start = complexSource.indexOf('create or replace function public.hold_complex_slot_guest(');
    assert(start >= 0);
    const end = complexSource.indexOf('$$;', start);
    assert(end > start);
    sql(complexSource.slice(start, end + 3));
    sql(source('20260205000003_fix_confirm_booking_idempotent.sql'));
    sql(source('20261110090000_booking_notification_outbox.sql'));
    sql(source('20261110101000_atomic_booking_requests.sql'));
    const finance = source('20261109090100_tenant_finance_rpc_guards.sql');
    const predicateStart = finance.indexOf('create or replace function public.finance_can_manage_business(');
    sql(finance.slice(predicateStart,finance.indexOf('$$;',predicateStart)+3));
    sql(readFileSync(path.join(root,'scripts/fixtures/booking-authority-helpers.sql'),'utf8'));
    expectFailure(source('20261110124000_whatsapp_inbox.sql'),/INBOX_REQUIRES_PROTECTED_BOOKING_COMMANDS/);
    assert.equal(sql("select to_regclass('public.whatsapp_inbox') is null;"),'t','unsafe predecessor fails before schema mutation');
    sql(source('20261110123000_service_only_booking_commands.sql'));

    sql(source('20260218000000_create_whatsapp_messages.sql'));
    sql(source('20261110124000_whatsapp_inbox.sql'));
    const receiver='123456789';
    const incoming=(overrides={})=>({ receiver,message_id:'wamid.'+randomUUID(),sender:'+996555000000',
      provider_timestamp:new Date().toISOString(),message_type:'text',text:'подтвердить',command:'confirm',booking_number:null,payload_hash:'a'.repeat(64),...overrides });
    const receive=(message)=>`set role service_role; select receive_whatsapp_inbox('${receiver}',${quote(JSON.stringify([message]))}::jsonb);`;
    const call=statement=>sql('set role service_role; '+statement);
    const claim=()=>JSON.parse(call(`select row_to_json(i) from claim_whatsapp_inbox('${receiver}',1) i;`));
    const args=event=>`'${event.id}','${event.lease_token}'`;
    const processEvent=event=>JSON.parse(call(`select process_whatsapp_inbox(${args(event)},'${receiver}');`));
    const expireLease=event=>sql(`update whatsapp_inbox set lease_until=clock_timestamp()-interval '1 second' where id='${event.id}';`);
    const reset=()=>sql('truncate whatsapp_inbox; truncate bookings cascade;');
    const booking=(clientId=null,phone='+996555000000',status='hold')=>{
      const bookingId=randomUUID();
      sql(`insert into bookings(id,biz_id,branch_id,staff_id,service_id,client_id,client_phone,start_at,end_at,status,expires_at)
        values('${bookingId}','${biz}','${branch}','${staff}','${service}',${clientId?quote(clientId):'null'},${quote(phone)},
        now()+interval '2 days',now()+interval '2 days 30 minutes','${status}',now()+interval '5 minutes');`);
      return bookingId;
    };
    let message=incoming();
    const receipts=await Promise.all(Array.from({length:12},()=>asyncSql(receive(message))));
    assert.equal(receipts.reduce((sum,value)=>sum+Number(value),0),1,'concurrent receives persist once');
    assert.equal(sql('select count(*) from whatsapp_inbox;'),'1');
    expectFailure(receive({...message,payload_hash:'b'.repeat(64)}),/INBOX_PAYLOAD_CONFLICT/);
    expectFailure(receive({...message,receiver:'987'}),/INBOX_INVALID_INPUT/);
    const beforeBatch=sql('select count(*) from whatsapp_inbox;');
    expectFailure(`set role service_role; select receive_whatsapp_inbox('${receiver}',${quote(JSON.stringify([incoming(),incoming({sender:'invalid'})]))}::jsonb);`,/INBOX_INVALID_INPUT/);
    assert.equal(sql('select count(*) from whatsapp_inbox;'),beforeBatch,'one invalid member rolls back the entire batch');
    for(let n=0;n<11;n++)sql(receive(incoming()));
    const leases=(await Promise.all(Array.from({length:8},()=>asyncSql(`set role service_role; select id from claim_whatsapp_inbox('${receiver}',4);`))))
      .flatMap(value=>value.split('\n').filter(Boolean));
    assert.equal(leases.length,12);assert.equal(new Set(leases).size,12,'SKIP LOCKED disjoint claims');
    assert.equal(call("select count(*) from claim_whatsapp_inbox('987',4);"),'0','receiver-scoped claim');

    reset();let bookingId=booking();message=incoming();sql(receive(message));let event=claim();
    const parallelProcesses=await Promise.all(Array.from({length:8},()=>asyncSql(`set role service_role; select process_whatsapp_inbox(${args(event)},'${receiver}');`)));
    const confirmed=JSON.parse(parallelProcesses[0]);assert.equal(confirmed.outcome,'confirmed');
    parallelProcesses.forEach(result=>assert.deepEqual(JSON.parse(result),confirmed,'one immutable result under concurrent process retries'));
    assert.equal(sql(`select status from bookings where id='${bookingId}';`),'confirmed');
    assert.equal(sql(`select count(*) from booking_notification_outbox where booking_id='${bookingId}' and event_type='confirm';`),'1');
    assert.deepEqual(processEvent(event),confirmed,'lost process receipt replays immutable result, not transition');
    assert.equal(sql(`select count(*) from booking_notification_outbox where booking_id='${bookingId}' and event_type='confirm';`),'1');
    expectFailure(`set role service_role; select process_whatsapp_inbox(${args(event)},'987');`,/INBOX_INVALID_INPUT/);
    call(`select begin_whatsapp_inbox_reply(${args(event)});`);
    expectFailure(`set role service_role; select begin_whatsapp_inbox_reply(${args(event)});`,/INBOX_REPLY_NOT_SENDABLE/);
    expectFailure(`set role service_role; select fail_whatsapp_inbox(${args(event)},'retry','provider_outcome_unknown',0);`,/INBOX_UNSAFE_RETRY/);
    expireLease(event);
    assert.equal(call(`select count(*) from claim_whatsapp_inbox('${receiver}',4);`),'0');
    assert.equal(sql(`select status from whatsapp_inbox where id='${event.id}';`),'ambiguous','uncertain reply never resent');
    expectFailure(`set role service_role; select record_whatsapp_inbox_reply(${args(event)},'late');`,/INBOX_LEASE_LOST/);

    reset();bookingId=booking(user,'+996999999999');
    sql(`update profiles set phone='+996555000000' where id='${user}';`);
    sql(receive(incoming({command:'cancel',text:'отмена'})));event=claim();
    assert.equal(processEvent(event).outcome,'cancelled','registered sender resolved from current profile, not stale booking phone');
    assert.equal(sql(`select status from bookings where id='${bookingId}';`),'cancelled');
    assert.equal(sql(`select count(*) from booking_notification_outbox where booking_id='${bookingId}' and event_type='cancel';`),'1');
    sql('update profiles set phone=null;');

    reset();bookingId=booking(other);sql(receive(incoming({command:'cancel',text:'отмена'})));event=claim();
    assert.equal(processEvent(event).outcome,'no_active_bookings','guest phone cannot take over registered row');
    assert.equal(sql(`select status from bookings where id='${bookingId}';`),'hold');
    reset();bookingId=booking(null,'+996777000000');sql(receive(incoming()));event=claim();
    assert.equal(processEvent(event).outcome,'no_active_bookings','different sender cannot mutate');
    reset();bookingId=booking();sql(receive(incoming({booking_number:999})));event=claim();
    assert.equal(processEvent(event).outcome,'booking_choice_required');assert.equal(sql(`select status from bookings where id='${bookingId}';`),'hold');
    reset();bookingId=booking(null,'+996555000000','paid');sql(receive(incoming({command:'cancel',text:'отмена'})));event=claim();
    assert.equal(processEvent(event).outcome,'paid_requires_review');assert.equal(sql(`select status from bookings where id='${bookingId}';`),'paid');
    reset();bookingId=booking(null,'+996555000000','confirmed');sql(`insert into staff_shift_items(booking_id) values('${bookingId}');`);
    sql(receive(incoming({command:'cancel',text:'отмена'})));event=claim();
    assert.equal(processEvent(event).outcome,'financial_reversal_required');assert.equal(sql(`select status from bookings where id='${bookingId}';`),'confirmed');

    reset();bookingId=booking();sql(receive(incoming()));event=claim();
    // A failure while storing the receipt must roll back the real transition and notification trigger.
    sql(`create function fixture_fail_receipt() returns trigger language plpgsql as $$begin
      if new.command_receipt is not null then raise exception 'synthetic_receipt_failure'; end if; return new; end$$;
      create trigger fixture_receipt before update on whatsapp_inbox for each row execute function fixture_fail_receipt();`);
    expectFailure(`set role service_role; select process_whatsapp_inbox(${args(event)},'${receiver}');`,/synthetic_receipt_failure/);
    assert.equal(sql(`select status from bookings where id='${bookingId}';`),'hold');
    assert.equal(sql(`select count(*) from booking_notification_outbox where booking_id='${bookingId}' and event_type='confirm';`),'0');
    assert.equal(sql(`select count(*) from booking_notification_outbox where booking_id='${bookingId}' and event_type='hold';`),'1','pre-existing hold event remains unchanged');
    sql('drop trigger fixture_receipt on whatsapp_inbox; drop function fixture_fail_receipt();');
    assert.equal(processEvent(event).outcome,'confirmed');
    expireLease(event);const stale=event;event=claim();assert.notEqual(event.lease_token,stale.lease_token);
    expectFailure(`set role service_role; select begin_whatsapp_inbox_reply(${args(stale)});`,/INBOX_LEASE_LOST/);
    assert.equal(processEvent(event).outcome,'confirmed');call(`select begin_whatsapp_inbox_reply(${args(event)});`);
    call(`select fail_whatsapp_inbox(${args(event)},'retry','provider_rate_limited',1);`);
    sql(`update whatsapp_inbox set available_at=clock_timestamp()-interval '1 second' where id='${event.id}';`);
    event=claim();call(`select begin_whatsapp_inbox_reply(${args(event)});`);call(`select record_whatsapp_inbox_reply(${args(event)},'synthetic-provider-id');`);
    assert.equal(sql(`select status from whatsapp_inbox where id='${event.id}';`),'sent');
    sql(`update whatsapp_inbox set completed_at=clock_timestamp()-interval '31 days' where id='${event.id}';`);
    assert.equal(call('select prune_whatsapp_inbox(100);'),'1');
    assert.equal(sql(`select (sender is null and reply_payload is null and command_receipt is null)::text from whatsapp_inbox where id='${event.id}';`),'true');
    const retained=sql(`select message_id from whatsapp_inbox where id='${event.id}';`);
    sql(receive(incoming({message_id:retained,provider_timestamp:sql(`select to_char(provider_timestamp at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') from whatsapp_inbox where id='${event.id}';`)})));
    assert.equal(call(`select count(*) from claim_whatsapp_inbox('${receiver}',4);`),'0','pruned tombstone cannot reopen');

    reset();message=incoming();sql(receive(message));
    for(let attempt=1;attempt<=8;attempt++) {
      event=claim();assert.equal(event.attempts,attempt);
      call(`select fail_whatsapp_inbox(${args(event)},'retry','command_database_failed',0);`);
      sql('update whatsapp_inbox set available_at=clock_timestamp()-interval \'1 second\';');
    }
    assert.equal(sql('select status from whatsapp_inbox;'),'failed');assert.equal(call(`select count(*) from claim_whatsapp_inbox('${receiver}',4);`),'0');
    reset();sql(receive(incoming()));event=claim();sql(`update whatsapp_inbox set attempts=8 where id='${event.id}';`);expireLease(event);
    assert.equal(call(`select count(*) from claim_whatsapp_inbox('${receiver}',4);`),'0');assert.equal(sql('select status from whatsapp_inbox;'),'failed');
    reset();sql(receive(incoming({provider_timestamp:new Date(Date.now()-25*3600000).toISOString()})));
    assert.equal(sql('select status from whatsapp_inbox;'),'expired');
    reset();message=incoming();sql(`insert into whatsapp_messages(whatsapp_message_id,from_phone,message_type,message_timestamp,processed) values(${quote(message.message_id)},'${message.sender}','text',now(),false);`);
    sql(receive(message));assert.equal(sql('select status from whatsapp_inbox;'),'legacy_manual');
    assert.equal(call(`select count(*) from claim_whatsapp_inbox('${receiver}',4);`),'0','legacy processed=false never auto-replayed');
    reset();message=incoming();sql(receive(message));
    sql(`insert into whatsapp_messages(whatsapp_message_id,from_phone,message_type,message_timestamp,processed) values(${quote(message.message_id)},'${message.sender}','text',now(),false);`);
    assert.equal(call(`select count(*) from claim_whatsapp_inbox('${receiver}',4);`),'0','legacy row appearing after receive is quarantined at claim');
    assert.equal(sql('select status from whatsapp_inbox;'),'legacy_manual');
    reset();sql(receive(incoming()));sql("update whatsapp_inbox set created_at=clock_timestamp()-interval '31 days';");
    assert.equal(call('select prune_whatsapp_inbox(100);'),'1','daily retention can prune an abandoned queue while worker disabled');
    assert.equal(sql("select status||':'||(sender is null) from whatsapp_inbox;"),'expired:true');
    reset();sql(receive(incoming({command:'help',text:'помощь'})));
    sql("update whatsapp_inbox set available_at=clock_timestamp()-interval '10 minutes';");
    const health=()=>JSON.parse(call('select whatsapp_inbox_backlog_health();'));
    let counts=health();assert.deepEqual([counts.pending,counts.due,counts.processing,counts.failed,counts.ambiguous],[1,1,0,0,0]);
    assert(counts.oldest_due_age_seconds>=600 && Number.isFinite(counts.oldest_due_age_seconds));
    event=claim();counts=health();assert.deepEqual([counts.pending,counts.due,counts.processing],[0,0,1]);assert.equal(counts.oldest_due_age_seconds,0);
    expireLease(event);counts=health();assert.equal(counts.due,1);assert(counts.oldest_due_age_seconds<30,'expired lease age, not original queue age');
    event=claim();processEvent(event);call(`select begin_whatsapp_inbox_reply(${args(event)});`);expireLease(event);
    counts=health();assert.deepEqual([counts.due,counts.failed,counts.ambiguous],[0,1,1],'uncertain processing is visible before recovery claim');
    sql(receive(incoming({provider_timestamp:new Date(Date.now()-25*3600000).toISOString()})));
    counts=health();assert.equal(counts.failed,2,'expired input needs attention');
    for(const role of ['anon','authenticated']) {
      for(const statement of ['select * from whatsapp_inbox',`select receive_whatsapp_inbox('${receiver}','[]')`,`select claim_whatsapp_inbox('${receiver}',1)`,
        `select process_whatsapp_inbox(${args(event)},'${receiver}')`,`select begin_whatsapp_inbox_reply(${args(event)})`,`select prune_whatsapp_inbox(100)`,'select whatsapp_inbox_backlog_health()'])
        expectFailure(`set role ${role}; ${statement};`,/permission denied/);
    }
    expectFailure("set role service_role; update whatsapp_inbox set status='sent';",/permission denied/);
    console.log('PASS isolated WhatsApp inbox: concurrent receive/claim, receiver/phone ownership, real protected confirm/cancel + transactional outbox and receipt rollback, immutable replay, invalid choice, paid review, lease fencing, ambiguous replies, bounded retries, tombstone retention, legacy quarantine and ACL. No provider calls.');
  } finally {
    if(!/^kezek-whatsapp-inbox-[0-9a-f-]{36}$/.test(name))throw new Error('Invalid disposable container name');
    run(['rm','-f','-v',name],undefined,true);
  }
})().catch(error=>{console.error(error.stack);process.exitCode=1;});

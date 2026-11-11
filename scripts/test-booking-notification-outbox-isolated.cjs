// Local-only regression: existing postgres:16 image, no network/ports/volumes.
// Synthetic minimal predecessor schema. Never reads project env or DB URLs.
const { spawnSync, spawn } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const name = 'kezek-outbox-regression-' + randomUUID();
const run = (args, input, allowError = false) => {
  const result = spawnSync('docker', args, { input, encoding: 'utf8' });
  if (!allowError && result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result;
};
const sql = text => run(['exec', '-i', name, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres'], text).stdout.trim();
const asyncSql = text => new Promise((resolve, reject) => {
  const child = spawn('docker', ['exec', '-i', name, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres']);
  let out = '', err = ''; child.stdout.on('data', chunk => out += chunk); child.stderr.on('data', chunk => err += chunk);
  child.on('error', reject); child.on('exit', code => code === 0 ? resolve(out.trim()) : reject(new Error(err)));
  child.stdin.end(text);
});
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
const migration = path.join(root, 'supabase/migrations/20261110090000_booking_notification_outbox.sql');
const addBooking = () => {
  const id = randomUUID();
  sql(`insert into bookings(id,status) values('${id}','confirmed');`);
  return id;
};
const claim = () => JSON.parse(sql("set role service_role; select row_to_json(e) from claim_booking_notifications(1,90) e;"));
const eventArgs = event => `'${event.id}','${event.lease_token}'`;
const call = statement => sql('set role service_role; ' + statement);
const key = prefix => prefix + ':' + 'a'.repeat(64);
const prepare = (event, deliveries) => call(`select prepare_booking_notification_deliveries(${eventArgs(event)},${quote(JSON.stringify(deliveries))}::jsonb);`);
const begin = (event, deliveryKey) => call(`select begin_booking_notification_delivery(${eventArgs(event)},${quote(deliveryKey)});`);
const receipt = (event, deliveryKey) => call(`select record_booking_notification_delivery(${eventArgs(event)},${quote(deliveryKey)},'synthetic-provider-id');`);
const finish = (event, outcome) => call(`select finish_booking_notification(${eventArgs(event)},'${outcome}');`);
const failure = (statement, pattern) => {
  const result = run(['exec','-i',name,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres'], statement, true);
  assert.notEqual(result.status, 0); assert.match(result.stderr, pattern);
};
const reset = () => sql('truncate booking_notification_outbox cascade;');
const delivery = (channel, suffix = 'a') => ({ key: channel+':'+suffix.repeat(64), channel, payload: { recipient: 'synthetic', text: 'immutable-message' } });

(async () => {
  try {
    run(['image','inspect','postgres:16']);
    run(['run','-d','--name',name,'--network','none','--tmpfs','/var/lib/postgresql/data','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:16']);
    let ready = false;
    for (let i=0;i<60;i++) {
      if (run(['exec',name,'cat','/proc/1/comm'],undefined,true).stdout.trim()==='postgres' &&
        run(['exec',name,'pg_isready','-U','postgres'],undefined,true).status===0) { ready=true; break; }
      await new Promise(resolve=>setTimeout(resolve,250));
    }
    assert(ready);
    sql(`create role anon; create role authenticated; create role service_role bypassrls;
      create table bookings(id uuid primary key,status text,start_at timestamptz default now(),end_at timestamptz default now()+interval '30 minutes',
        staff_id uuid,branch_id uuid,biz_id uuid,service_id uuid);`);
    sql(readFileSync(migration,'utf8'));
    sql(readFileSync(path.join(root,'supabase/migrations/20261110125000_booking_outbox_throughput.sql'),'utf8'));
    const bookingId=addBooking();
    const firstEvent=call(`select enqueue_booking_notification('${bookingId}','confirm');`);
    assert.equal(call(`select enqueue_booking_notification('${bookingId}','confirm');`),firstEvent);
    assert.equal(sql('select count(*) from booking_notification_outbox;'),'1');
    for(let i=0;i<11;i++)addBooking();
    const claims=await Promise.all(Array.from({length:9},()=>asyncSql("set role service_role; select id from claim_booking_notifications(2,90);")));
    const ids=claims.flatMap(value=>value.split('\n').filter(Boolean));
    assert.equal(ids.length,12);assert.equal(new Set(ids).size,12,'SKIP LOCKED gives every event to one worker');
    assert.equal(sql("select count(*) from booking_notification_outbox where attempts=1 and status='processing';"),'12');

    reset(); addBooking(); let event=claim();
    const email=delivery('email'); const telegram=delivery('telegram');
    prepare(event,[email,telegram]);
    prepare(event,[{...email,payload:{text:'changed'}}]);
    assert.equal(sql(`select payload->>'text' from booking_notification_deliveries where event_id='${event.id}' and channel='email';`),'immutable-message');
    failure(`set role service_role; select prepare_booking_notification_deliveries('${event.id}',gen_random_uuid(),'[]');`,/OUTBOX_LEASE_LOST/);
    failure(`set role service_role; select finish_booking_notification(${eventArgs(event)},'sent');`,/OUTBOX_DELIVERIES_PENDING/);
    assert.equal(begin(event,key('email')),'send'); receipt(event,key('email'));
    assert.equal(begin(event,key('email')),'sent');
    assert.equal(begin(event,key('telegram')),'send');
    // Crash before receipt storage: replacement worker never automatically resends Telegram.
    sql(`update booking_notification_outbox set lease_until=now()-interval '1 second' where id='${event.id}';`);
    failure(`set role service_role; select begin_booking_notification_delivery(${eventArgs(event)},${quote(key('telegram'))});`,/OUTBOX_LEASE_LOST/);
    const old=event;event=claim();assert.notEqual(event.lease_token,old.lease_token);
    failure(`set role service_role; select record_booking_notification_delivery(${eventArgs(old)},${quote(key('telegram'))},'late');`,/OUTBOX_LEASE_LOST/);
    assert.equal(begin(event,key('telegram')),'ambiguous');
    assert.equal(begin(event,key('email')),'sent');
    finish(event,'failed');
    assert.equal(sql(`select count(*) from booking_notification_deliveries where event_id='${event.id}' and sent_at is not null;`),'1');

    reset();addBooking();event=claim();prepare(event,[email]);assert.equal(begin(event,key('email')),'send');
    sql(`update booking_notification_outbox set lease_until=now()-interval '1 second' where id='${event.id}';`);
    event=claim();assert.equal(begin(event,key('email')),'send','Resend can replay the same immutable payload/key within its dedup window');
    sql(`update booking_notification_deliveries set first_attempt_at=now()-interval '23 hours' where event_id='${event.id}';`);
    assert.equal(begin(event,key('email')),'ambiguous','No resend after idempotency window safety bound');
    finish(event,'failed');

    reset();const revisedBooking=addBooking();event=claim();prepare(event,[email]);
    sql(`update bookings set status='cancelled' where id='${revisedBooking}';`);
    assert.equal(begin(event,key('email')),'obsolete');finish(event,'obsolete');
    assert.equal(sql(`select count(*) from booking_notification_outbox where booking_id='${revisedBooking}';`),'2');

    reset();addBooking();event=claim();prepare(event,[telegram]);assert.equal(begin(event,key('telegram')),'send');
    call(`select fail_booking_notification_delivery(${eventArgs(event)},${quote(key('telegram'))},'retry','provider_rate_limited');`);
    assert.equal(begin(event,key('telegram')),'send','Known provider rejection permits a retry');receipt(event,key('telegram'));finish(event,'sent');

    reset();addBooking();
    for(let attempt=1;attempt<=8;attempt++) {
      event=claim();assert.equal(event.attempts,attempt);finish(event,'retry');
      sql(`update booking_notification_outbox set available_at=now()-interval '1 second' where id='${event.id}';`);
    }
    assert.equal(sql(`select status from booking_notification_outbox where id='${event.id}';`),'failed');
    assert.equal(call('select count(*) from claim_booking_notifications(2,90);'),'0');

    reset();const retainedBooking=addBooking();event=claim();prepare(event,[email]);assert.equal(begin(event,key('email')),'send');receipt(event,key('email'));finish(event,'sent');
    sql(`update booking_notification_outbox set completed_at=now()-interval '31 days' where id='${event.id}';`);
    assert.equal(call('select prune_booking_notifications(1);'),'1');
    assert.equal(sql('select count(*) from booking_notification_deliveries;'),'0');
    assert.equal(call(`select enqueue_booking_notification('${retainedBooking}','confirm');`),event.id,'Tombstone prevents resend after PII retention');
    assert.equal(call('select prune_booking_notifications(1);'),'0');

    reset();addBooking();event=claim();prepare(event,[email]);finish(event,'retry');
    sql(`update booking_notification_outbox set created_at=now()-interval '31 days',prepared_at=now()-interval '31 days',available_at=now()-interval '1 second' where id='${event.id}';`);
    assert.equal(call('select count(*) from claim_booking_notifications(1,90);'),'0');
    assert.equal(sql(`select last_error_code from booking_notification_outbox where id='${event.id}';`),'event_expired');
    assert.equal(call('select prune_booking_notifications(1);'),'1');
    assert.equal(sql('select count(*) from booking_notification_deliveries;'),'0','Old prepared PII expires even when the event was never delivered');

    reset();addBooking();event=claim();finish(event,'continue');
    assert.equal(sql(`select attempts from booking_notification_outbox where id='${event.id}';`),'0','Budget pagination does not exhaust retries');
    event=claim();sql(`update booking_notification_outbox set lease_until=now()-interval '1 second',attempts=8 where id='${event.id}';`);
    assert.equal(call('select count(*) from claim_booking_notifications(1,90);'),'0');
    assert.equal(sql(`select status from booking_notification_outbox where id='${event.id}';`),'failed','Final-attempt worker crash becomes visible dead letter');

    reset();addBooking();event=claim();prepare(event,[]);
    sql(`update booking_notification_outbox set lease_until=clock_timestamp()+interval '2 seconds' where id='${event.id}';`);
    failure(`set role service_role; begin; select pg_sleep(2.2); select finish_booking_notification(${eventArgs(event)},'sent'); commit;`,/OUTBOX_LEASE_LOST/);

    reset();for(let i=0;i<3;i++)addBooking();
    const batch=JSON.parse(call("select claim_booking_notification_batch(2,90,'{}');"));assert.equal(batch.length,2);
    const firstBatch=batch[0],secondBatch=batch[1];
    prepare(firstBatch,[telegram]);assert.equal(begin(firstBatch,key('telegram')),'send');
    call(`select fail_booking_notification_delivery(${eventArgs(firstBatch)},${quote(key('telegram'))},'ambiguous','provider_outcome_unknown');`);
    finish(firstBatch,'failed');finish(secondBatch,'continue');
    const health=JSON.parse(call('select booking_notification_backlog_health();'));
    assert.deepEqual({...health,oldest_due_age_seconds:0},{pending:2,due:2,processing:0,failed:1,ambiguous:1,oldest_due_age_seconds:0});
    assert(health.oldest_due_age_seconds>=0);
    const nextBatch=JSON.parse(call(`select claim_booking_notification_batch(2,90,array['${firstBatch.id}','${secondBatch.id}']::uuid[]);`));
    assert.equal(nextBatch.length,1);assert(!batch.some(row=>row.id===nextBatch[0].id),'same-run continuation excluded');
    failure("set role service_role; select claim_booking_notification_batch(3,90,'{}');",/INVALID_OUTBOX_CLAIM/);
    failure("set role service_role; select claim_booking_notification_batch(2,90,array[null]::uuid[]);",/INVALID_OUTBOX_CLAIM/);
    failure("set role service_role; select claim_booking_notification_batch(2,90,array_fill(gen_random_uuid(),array[101]));",/INVALID_OUTBOX_CLAIM/);
    reset();addBooking();event=claim();
    const many=Array.from({length:200},(_,i)=>({key:'email:'+i.toString(16).padStart(64,'0'),channel:'email',payload:{text:'synthetic'}}));
    prepare(event,many);
    const snapshot=JSON.parse(call(`select read_booking_notification_deliveries(${eventArgs(event)});`));
    assert.equal(snapshot.length,200,'one scalar JSON value retains all recipients independently of REST row cap');
    assert.equal(new Set(snapshot.map(row=>row.delivery_key)).size,200);
    failure(`set role service_role; select read_booking_notification_deliveries('${event.id}',gen_random_uuid());`,/OUTBOX_LEASE_LOST/);

    reset();sql("insert into bookings(id,status) select gen_random_uuid(),'confirmed' from generate_series(1,100);");
    const benchmarkStart=process.hrtime.bigint();
    call(`do $$ declare seen uuid[]:='{}'; batch jsonb; item jsonb; waves integer:=0; begin
      loop batch:=claim_booking_notification_batch(2,90,seen); exit when jsonb_array_length(batch)=0;
        waves:=waves+1;
        for item in select value from jsonb_array_elements(batch) loop
          seen:=array_append(seen,(item->>'id')::uuid);
          perform prepare_booking_notification_deliveries((item->>'id')::uuid,(item->>'lease_token')::uuid,'[]');
          perform finish_booking_notification((item->>'id')::uuid,(item->>'lease_token')::uuid,'sent');
        end loop;
      end loop;
      if cardinality(seen)<>100 or waves<>50 then raise exception 'SYNTHETIC_BENCHMARK_INCOMPLETE'; end if;
    end $$;`);
    const elapsedMs=Number(process.hrtime.bigint()-benchmarkStart)/1e6;
    assert.equal(sql("select count(*) from booking_notification_outbox where status='sent';"),'100');
    console.log(JSON.stringify({benchmark:'synthetic_outbox_database_waves',events:100,waves:50,elapsedMs,
      providerCalls:0,boundary:'PostgreSQL16 one transaction, empty recipient plans, includes docker/psql overhead; not provider throughput or production capacity'}));

    for(const role of ['anon','authenticated']) {
      for(const statement of ['select * from booking_notification_outbox','select * from booking_notification_deliveries','select claim_booking_notifications(1,90)',`select enqueue_booking_notification('${bookingId}','confirm')`,`select begin_booking_notification_delivery(${eventArgs(event)},${quote(key('email'))})`]) {
        failure(`set role ${role}; ${statement};`,/permission denied/);
      }
      for(const statement of ["select claim_booking_notification_batch(2,90,'{}')",'select booking_notification_backlog_health()',`select read_booking_notification_deliveries(${eventArgs(event)})`]) {
        failure(`set role ${role}; ${statement};`,/permission denied/);
      }
    }
    failure("set role service_role; update booking_notification_deliveries set payload='{}';",/permission denied/);
    failure("set role service_role; update booking_notification_outbox set status='sent';",/permission denied/);
    console.log('PASS isolated outbox PostgreSQL: concurrent claim isolation, immutable preparation, lease fencing, partial receipts, non-idempotent ambiguity, email retry window, revision fencing, finite retries, retained tombstone/PII pruning, ACL. No provider calls.');
  } finally {
    if(!/^kezek-outbox-regression-[0-9a-f-]{36}$/.test(name))throw new Error('Invalid disposable container name');
    run(['rm','-f','-v',name],undefined,true);
  }
})().catch(error=>{console.error(error.message);process.exitCode=1;});

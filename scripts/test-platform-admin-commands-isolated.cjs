// Local-only real platform-role command regressions. No env, remote DB or Auth calls.
const { spawnSync, spawn } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const name = 'kezek-platform-admin-' + randomUUID();
const run = (args, input, allowError = false) => {
  const result = spawnSync('docker', args, { input, encoding: 'utf8', windowsHide: true });
  if (!allowError && result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result;
};
const args = ['exec','-i',name,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres'];
const sql = text => run(args,text).stdout.trim();
const asyncSql = text => new Promise((resolve,reject) => {
  const child=spawn('docker',args,{windowsHide:true});let out='',err='';
  child.stdout.on('data',part=>out+=part);child.stderr.on('data',part=>err+=part);child.on('error',reject);
  child.on('exit',code=>resolve({code,out:out.trim(),err}));child.stdin.end(text);
});
const source=file=>readFileSync(path.join(root,'supabase/migrations',file),'utf8');
const definition=(file,name)=>{const text=source(file),start=text.indexOf('create or replace function public.'+name+'('),end=text.indexOf('$$;',start);assert(start>=0&&end>start);return text.slice(start,end+3);};
const A=randomUUID(),B=randomUUID(),C=randomUUID(),ordinary=randomUUID(),role=randomUUID(),tenantRole=randomUUID(),business=randomUUID();
const command=(actor,target,enabled)=>`set role service_role; select set_platform_admin_role('${actor}','${target}',${enabled});`;
const fail=(statement,pattern)=>{const result=run(args,statement,true);assert.notEqual(result.status,0);assert.match(result.stderr,pattern);};
const reset=()=>sql(`truncate user_global_roles,user_roles,super_admins_legacy; insert into user_global_roles(user_id,role_id) values('${A}','${role}');`);
const eventually=async(predicate)=>{for(let n=0;n<40;n++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,50));}throw new Error('Expected concurrent SQL lock state was not observed');};
(async()=>{
 try{
  run(['image','inspect','postgres:16']);run(['run','-d','--name',name,'--network','none','--tmpfs','/var/lib/postgresql/data','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:16']);
  let ready=false;for(let n=0;n<60;n++){if(run(['exec',name,'cat','/proc/1/comm'],undefined,true).stdout.trim()==='postgres'&&run(['exec',name,'pg_isready','-U','postgres'],undefined,true).status===0){ready=true;break;}await new Promise(resolve=>setTimeout(resolve,250));}assert(ready);
  sql(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table auth.users(id uuid primary key);
    create table roles(id uuid primary key default gen_random_uuid(),key text not null unique,name text not null,scope text not null default 'business' check(scope in('business','platform')));
    create table user_global_roles(user_id uuid not null references auth.users on delete cascade,role_id uuid not null references roles on delete cascade,created_at timestamptz default now(),primary key(user_id,role_id));
    create table user_roles(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,role_id uuid not null references roles,biz_id uuid,
      biz_key uuid generated always as(coalesce(biz_id,'00000000-0000-0000-0000-000000000000'::uuid)) stored,unique(user_id,role_id,biz_key));
    create table super_admins_legacy(user_id uuid primary key references auth.users on delete cascade);
    insert into auth.users values('${A}'),('${B}'),('${C}'),('${ordinary}');
    insert into roles(id,key,name,scope) values('${role}','super_admin','Platform admin','platform'),('${tenantRole}','admin','Business admin','business');`);
  sql(definition('20261110131000_shift_hours_adjustment.sql','finance_is_platform_admin'));
  sql('revoke all on function finance_is_platform_admin(uuid) from public,anon,authenticated,service_role;');
  sql(definition('20261110132000_privileged_maintenance_acl.sql','is_super_admin'));
  sql(source('20261110134000_platform_admin_commands.sql'));
  reset();
  for(const store of ['global','legacy','null-business']){
    sql('truncate user_global_roles,user_roles,super_admins_legacy;');
    sql(store==='global'?`insert into user_global_roles values('${A}','${role}',now());`:store==='legacy'?`insert into super_admins_legacy values('${A}');`:`insert into user_roles(user_id,role_id,biz_id) values('${A}','${role}',null);`);
    assert.equal(sql(`set role authenticated; set request.jwt.claim.sub='${A}'; select is_super_admin();`),'t',store+' current actor recognized');
    assert.equal(sql(`set role authenticated; set request.jwt.claim.sub='${ordinary}'; select is_super_admin();`),'f','other actor never inherits');
    assert.equal(sql(command(A,B,true)),'t');assert.equal(sql(command(A,B,true)),'t');
    assert.equal(sql(`select count(*) from user_global_roles where user_id='${B}';`),'1','canonical grant idempotent');
    assert.deepEqual(JSON.parse(sql(`set role service_role; select read_platform_admin_states('${A}',array['${A}','${B}','${ordinary}']::uuid[]);`)),{[A]:true,[B]:true,[ordinary]:false},store+' target flags share the actual three-store predicate');
  }
  assert.equal(sql(`set role service_role; select read_platform_admin_states('${A}',array[]::uuid[]);`),'{}');
  fail(`set role service_role; select read_platform_admin_states('${ordinary}',array['${A}']::uuid[]);`,/PLATFORM_ADMIN_FORBIDDEN/);
  fail(`set role service_role; select read_platform_admin_states('${A}',array_fill('${B}'::uuid,array[201]));`,/PLATFORM_ADMIN_INVALID_INPUT/);
  fail(`set role service_role; select read_platform_admin_states('${A}',array[null]::uuid[]);`,/PLATFORM_ADMIN_INVALID_INPUT/);
  for(const dbRole of ['anon','authenticated']) fail(`set role ${dbRole}; select read_platform_admin_states('${A}',array['${B}']::uuid[]);`,/permission denied/);
  reset();
  sql(`insert into user_global_roles(user_id,role_id) values('${B}','${role}'); insert into super_admins_legacy values('${B}');
    insert into user_roles(user_id,role_id,biz_id) values('${B}','${role}',null),('${B}','${role}','${business}'),('${B}','${tenantRole}','${business}');`);
  assert.equal(sql(command(A,B,false)),'f');assert.equal(sql(command(A,B,false)),'f');
  assert.equal(sql(`select finance_is_platform_admin('${B}');`),'f');
  assert.equal(sql(`select count(*) from user_roles where user_id='${B}' and biz_id='${business}';`),'2','tenant roles preserved');
  fail(command(B,C,true),/PLATFORM_ADMIN_FORBIDDEN/);fail(command(ordinary,C,true),/PLATFORM_ADMIN_FORBIDDEN/);
  fail(command(A,randomUUID(),true),/PLATFORM_ADMIN_TARGET_NOT_FOUND/);
  fail(command(A,B,'null'),/PLATFORM_ADMIN_INVALID_INPUT/);
  fail(command(A,A,false),/PLATFORM_ADMIN_LAST_ADMIN/);
  for(const dbRole of ['anon','authenticated']) fail(`set role ${dbRole}; set request.jwt.claim.sub='${A}'; select set_platform_admin_role('${A}','${B}',true);`,/permission denied/);
  fail(`set role authenticated; select finance_is_platform_admin('${A}');`,/permission denied/);
  sql(command(A,B,true));
  // Deliberately overlap both commands at the actual shared advisory lock.
  // Cancel only this synthetic holder after observing both waiting sessions;
  // ON_ERROR_STOP closes its aborted transaction and releases the lock.
  const holder=asyncSql("set application_name='platform-role-test-holder'; begin; select pg_advisory_xact_lock(184207,1); select pg_sleep(30); commit;");
  await eventually(()=>sql("select count(*) from pg_locks l join pg_stat_activity a on a.pid=l.pid where a.application_name='platform-role-test-holder' and l.locktype='advisory' and l.granted;")==='1');
  const firstRevoke=asyncSql("set application_name='platform-role-revoke-a';"+command(A,A,false));
  const secondRevoke=asyncSql("set application_name='platform-role-revoke-b';"+command(B,B,false));
  await eventually(()=>sql("select count(*) from pg_stat_activity where application_name in('platform-role-revoke-a','platform-role-revoke-b') and wait_event_type='Lock' and wait_event='advisory';")==='2');
  assert.equal(sql("select pg_cancel_backend(pid) from pg_stat_activity where application_name='platform-role-test-holder';"),'t');
  assert.notEqual((await holder).code,0);
  const races=await Promise.all([firstRevoke,secondRevoke]);
  assert.equal(races.filter(r=>r.code===0&&r.out==='f').length,1,'one self-revoke commits');
  assert.equal(races.filter(r=>r.code!==0&&/PLATFORM_ADMIN_LAST_ADMIN/.test(r.err)).length,1,'last admin remains under concurrent calls');
  assert.equal(sql('select count(*) from user_global_roles;'),'1');
  reset();sql(command(A,B,true));sql(`insert into super_admins_legacy values('${B}'); insert into user_roles(user_id,role_id) values('${B}','${role}');
    create function fixture_fail_revoke() returns trigger language plpgsql as $$begin raise exception 'synthetic_revoke_failure'; end$$;
    create trigger fail_revoke before delete on super_admins_legacy for each row execute function fixture_fail_revoke();`);
  fail(command(A,B,false),/synthetic_revoke_failure/);
  assert.equal(sql(`select count(*) from user_global_roles where user_id='${B}';`),'1');assert.equal(sql(`select count(*) from user_roles where user_id='${B}';`),'1');
  sql('drop trigger fail_revoke on super_admins_legacy; drop function fixture_fail_revoke();');
  assert.equal(sql(command(A,B,false)),'f');
  sql(`insert into super_admins_legacy values('${A}'); update roles set scope='business' where id='${role}';`);
  fail(command(A,C,true),/PLATFORM_ADMIN_ROLE_NOT_CONFIGURED/);
  console.log('PASS isolated platform admin: real three-store predicate, caller binding, service ACL, canonical idempotent grant, atomic all-store revoke/rollback, preserved tenant roles, missing target/config and serialized last-admin guard. No Auth/provider calls.');
 }finally{if(!/^kezek-platform-admin-[0-9a-f-]{36}$/.test(name))throw Error('Invalid container');run(['rm','-f','-v',name],undefined,true);}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});

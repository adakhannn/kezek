// Access-control integration fixture for 20261110132000_privileged_maintenance_acl. The maintenance
// and ownership commands are the prod baseline definitions under the production default grants
// (every API role may execute them). Their bodies never run: this suite tests their EXECUTE
// boundary, not cleanup business logic. Branch and platform predicates run the real migration code
// against synthetic role data. The later migrations that drop retired commands run too, so the
// suite ends on the live functions.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { POSTGRES_IMAGE } = require('./lib/isolated-postgres.cjs');
const { assertLiveFunctions, installLiveFunction, SUPABASE_DEFAULT_PRIVILEGES } = require('./lib/live-schema.cjs');
const container = `kezek-maintenance-acl-${randomUUID()}`;
const migration=file=>fs.readFileSync(path.join(__dirname,'../supabase/migrations',file),'utf8').replace(/\r/g,'');
const baseline=migration('20261009110000_prod_baseline.sql');
// A function as the prod baseline creates it: its only CREATE, up to the ALTER FUNCTION ... OWNER that follows.
const baselineFunction=sig=>{
 const name=sig.slice(0,sig.indexOf('(')),marker=`CREATE OR REPLACE FUNCTION "public"."${name}"(`,start=baseline.indexOf(marker);
 assert.ok(start>=0&&baseline.indexOf(marker,start+1)<0,`${name}: exactly one definition in the prod baseline`);
 return baseline.slice(start,baseline.indexOf(`\nALTER FUNCTION "public"."${name}"(`,start));
};
// Still live, service-only since 20261110132000.
const kept = [
 'cleanup_old_api_metrics(integer)', 'cleanup_old_finance_logs(integer)', 'cleanup_old_funnel_events(integer)',
 'anonymize_old_bookings_pii(integer)', 'anonymize_inactive_profiles_pii(integer)',
 'cleanup_expired_telegram_mobile_auth_attempts(integer)', 'cleanup_expired_whatsapp_otp_codes(integer)',
 'cleanup_telegram_profile_links()', 'finalize_due_account_deletions(integer)', 'purge_expired_holds()',
 'log_finance_operation(uuid,uuid,text,text,text,uuid,date,jsonb,jsonb,jsonb,text,text,inet,text)',
 'log_api_metric(text,text,integer,integer,uuid,uuid,uuid,text,text,integer,integer,jsonb,inet,text)',
];
// Dropped later: purge_user by 20261117190000, the others by 20261119020000.
const dropped = [
 'log_frontend_metric(text,jsonb,timestamptz,uuid,text,text,inet)',
 'force_delete_business_and_downgrade_owner(uuid)', 'exec_grant_owner(uuid,uuid,uuid)', 'clear_business_owner(uuid)', 'purge_user(uuid)',
];
const signatures = [...kept, ...dropped];
const tables = ['roles','user_roles','user_global_roles','super_admins_legacy','branch_admins',
 'api_request_metrics','staff_finance_operation_logs','frontend_metrics'];
// pg_cron stand-in: vanilla PostgreSQL has no pg_cron and this suite runs no jobs, so cron.schedule
// only accepts the job declarations of 20261119020000.
const cron='create schema cron; create function cron.schedule(job_name text,schedule text,command text) returns bigint language sql as $$select 0::bigint$$;';
const docker = (args, input='') => new Promise((resolve,reject) => {
 const child=spawn('docker',args,{windowsHide:true}); let out='',err='';
 child.stdout.on('data',data=>out+=data); child.stderr.on('data',data=>err+=data);
 child.on('error',reject); child.on('close',code=>code===0?resolve(out.trim()):reject(new Error(err||out||`exit ${code}`))); child.stdin.end(input);
});
const sql=input=>docker(['exec','-i',container,'psql','-X','-q','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At'],input);
const caller=(id,body)=>sql(`set role authenticated; set request.jwt.claims='{"sub":"${id}","role":"authenticated"}'; ${body}`);
const ids=Array.from({length:12},()=>randomUUID());
const [owner, manager, stranger, platform, legacy, oldGlobal, target, biz, otherBiz, branch, roleManager, roleSuper]=ids;
let created=false;
(async()=>{
 try {
  await docker(['run','--detach','--rm','--network','none','--tmpfs','/var/lib/postgresql/data','--name',container,'-e','POSTGRES_HOST_AUTH_METHOD=trust',POSTGRES_IMAGE]); created=true;
  let ready=false; for(let i=0;i<120;i++){try{if((await docker(['exec',container,'cat','/proc/1/comm'])).trim()==='postgres'){await sql('select 1');ready=true;break;}}catch{/* starting */}await new Promise(r=>setTimeout(r,500));}
  assert.ok(ready,'PostgreSQL did not start');
  // Functions get the grants the production baseline gave them (PUBLIC and every API role).
  await sql(`create role anon; create role authenticated; create role service_role; create schema auth;
   ${SUPABASE_DEFAULT_PRIVILEGES}
   create function auth.uid() returns uuid language sql stable as $$ select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
  `);
  await sql(`grant usage on schema auth to anon,authenticated,service_role;
   create table roles(id uuid primary key,key text,scope text);
   create table user_roles(user_id uuid,role_id uuid,biz_id uuid);
   create table user_global_roles(user_id uuid,role_id uuid);
   create table super_admins_legacy(user_id uuid);
   create table businesses(id uuid primary key,owner_id uuid);
   create table branches(id uuid primary key,biz_id uuid);
   create table branch_admins(branch_id uuid,user_id uuid,primary key(branch_id,user_id));
   create view user_roles_legacy as select * from user_roles;
   create view user_roles_with_user as select * from user_roles;
   create view current_user_roles as select * from user_roles;
   create table api_request_metrics(id integer); create table staff_finance_operation_logs(id integer); create table frontend_metrics(id integer);
   grant all on all tables in schema public to anon,authenticated,service_role;
   grant insert(user_id),update(user_id),references(user_id) on user_roles to authenticated;
   insert into roles values('${roleManager}','manager','business'),('${roleSuper}','super_admin','platform');
   insert into businesses values('${biz}','${owner}'),('${otherBiz}','${stranger}');
   insert into branches values('${branch}','${biz}');
   insert into user_roles values('${manager}','${roleManager}','${biz}'),('${stranger}','${roleManager}','${otherBiz}'),('${oldGlobal}','${roleSuper}',null);
   insert into user_global_roles values('${platform}','${roleSuper}'); insert into super_admins_legacy values('${legacy}');
  `);
  // The branch predicate's role check, with its live definition and ACL.
  await installLiveFunction(sql,'public.has_role(text,uuid)');
  // Production before the migration, created as the baseline creates them (check_function_bodies off: the tables they clean are not in this fixture).
  await sql(`set check_function_bodies=off;\n${[...signatures,'dev_become_superadmin()'].map(baselineFunction).join('\n')}`);
  for(const sig of [...signatures,'dev_become_superadmin()']) assert.equal(await sql(`select has_function_privilege('anon','public.${sig}','execute')`),'t',`Fixture must reproduce exposed maintenance privilege: ${sig}`);
  await sql(migration('20261110132000_privileged_maintenance_acl.sql'));
  for(const sig of signatures) {
   for(const role of ['anon','authenticated']) assert.equal(await sql(`select has_function_privilege('${role}','public.${sig}','execute')`),'f',`${role}: ${sig}`);
   assert.equal(await sql(`select has_function_privilege('service_role','public.${sig}','execute')`),'t');
  }
  for(const role of ['anon','authenticated','service_role']) assert.equal(await sql(`select has_function_privilege('${role}','public.dev_become_superadmin()','execute')`),'f');
  for(const table of tables) for(const role of ['anon','authenticated']) {
   assert.equal(await sql(`select has_table_privilege('${role}','${table}','INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES') or has_any_column_privilege('${role}','${table}','INSERT,UPDATE,REFERENCES')`),'f',`${role}: ${table}`);
   assert.equal(await sql(`select has_table_privilege('${role}','${table}','SELECT')`),'t','Read grants preserved');
  }
  for(const view of ['user_roles_legacy','user_roles_with_user','current_user_roles']) {
   assert.equal(await sql(`select has_table_privilege('authenticated','${view}','INSERT,UPDATE,DELETE') or has_any_column_privilege('authenticated','${view}','INSERT,UPDATE')`),'f','Updatable view must not bypass table ACL');
  }
  for(const id of [platform,legacy,oldGlobal]) assert.equal(await caller(id,'select is_super_admin()'),'t');
  for(const id of [owner,manager,stranger]) assert.equal(await caller(id,'select is_super_admin()'),'f');
  await sql(`insert into user_roles values('${stranger}','${roleSuper}','${otherBiz}')`);
  assert.equal(await caller(stranger,'select is_super_admin()'),'f','Tenant super_admin is not global');
  for(const id of [owner,manager,platform,legacy,oldGlobal]) {
   await caller(id,`select grant_branch_admin('${branch}','${target}'); select grant_branch_admin('${branch}','${target}');`);
   assert.equal(await sql(`select count(*) from branch_admins where branch_id='${branch}' and user_id='${target}'`),'1');
   await caller(id,`select revoke_branch_admin('${branch}','${target}');`);
  }
  await assert.rejects(caller(stranger,`select grant_branch_admin('${branch}','${target}')`),/BRANCH_ADMIN_FORBIDDEN/);
  await assert.rejects(caller(stranger,`select revoke_branch_admin('${branch}','${target}')`),/BRANCH_ADMIN_FORBIDDEN/);
  await assert.rejects(sql(`set role anon;select grant_branch_admin('${branch}','${target}')`),/permission denied/);
  await assert.rejects(caller(owner,`insert into branch_admins values('${branch}','${target}')`),/permission denied/);
  await assert.rejects(sql(`set role anon;select purge_user('${target}')`),/permission denied/);
  // The retired commands and the dev shortcut are dropped later; the kept ones stay service-only.
  await sql(cron);
  for(const file of ['20261117190000_drop_dead_functions.sql','20261119020000_dead_functions_and_cleanup_jobs.sql']) await sql(migration(file));
  for(const sig of [...dropped,'dev_become_superadmin()']) assert.equal(await sql(`select to_regprocedure('public.${sig}') is null`),'t',`dropped: ${sig}`);
  await assertLiveFunctions(sql, { suite: 'test-privileged-maintenance-isolated.cjs' });
  console.log('PASS maintenance ACL: 17 server-only RPCs (5 dropped since), role/log table and column DML denied, checked cross-tenant branch grants, all three caller-bound global role stores, retired and dropped dev shortcut');
 } finally { if(created) { await docker(['rm','--force',container]); console.log('Removed owned isolated maintenance ACL container'); } }
})().catch(error=>{console.error(error.message);process.exitCode=1;});

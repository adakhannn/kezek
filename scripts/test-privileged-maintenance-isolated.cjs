// Access-control integration fixture. Maintenance bodies are inert because this
// suite tests their EXECUTE boundary, not cleanup business logic. Branch and
// platform predicates run the real migration code against synthetic role data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const container = `kezek-maintenance-acl-${randomUUID()}`;
const signatures = [
 'cleanup_old_api_metrics(integer)', 'cleanup_old_finance_logs(integer)', 'cleanup_old_funnel_events(integer)',
 'anonymize_old_bookings_pii(integer)', 'anonymize_inactive_profiles_pii(integer)',
 'cleanup_expired_telegram_mobile_auth_attempts(integer)', 'cleanup_expired_whatsapp_otp_codes(integer)',
 'cleanup_telegram_profile_links()', 'finalize_due_account_deletions(integer)', 'purge_expired_holds()',
 'log_finance_operation(uuid,uuid,text,text,text,uuid,date,jsonb,jsonb,jsonb,text,text,inet,text)',
 'log_api_metric(text,text,integer,integer,uuid,uuid,uuid,text,text,integer,integer,jsonb,inet,text)',
 'log_frontend_metric(text,jsonb,timestamptz,uuid,text,text,inet)',
 'force_delete_business_and_downgrade_owner(uuid)', 'exec_grant_owner(uuid,uuid,uuid)', 'clear_business_owner(uuid)', 'purge_user(uuid)',
];
const tables = ['roles','user_roles','user_global_roles','super_admins_legacy','branch_admins',
 'api_request_metrics','staff_finance_operation_logs','frontend_metrics'];
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
  await docker(['run','--detach','--rm','--network','none','--tmpfs','/var/lib/postgresql/data','--name',container,'-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:16']); created=true;
  let ready=false; for(let i=0;i<60;i++){try{await sql('select 1');ready=true;break;}catch{await new Promise(r=>setTimeout(r,500));}}
  assert.ok(ready,'PostgreSQL did not start');
  await sql(`create role anon; create role authenticated; create role service_role; create schema auth;
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
   create function public.has_role(p_role_key text,p_biz_id uuid default null) returns boolean language sql stable security definer set search_path=public as $$
    select exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id
     where ur.user_id=auth.uid() and r.key=p_role_key and (p_biz_id is null and ur.biz_id is null or ur.biz_id=p_biz_id)); $$;
   create function public.dev_become_superadmin() returns void language plpgsql as $$begin return; end;$$;
   grant all on all tables in schema public to anon,authenticated,service_role;
   grant insert(user_id),update(user_id),references(user_id) on user_roles to authenticated;
   insert into roles values('${roleManager}','manager','business'),('${roleSuper}','super_admin','platform');
   insert into businesses values('${biz}','${owner}'),('${otherBiz}','${stranger}');
   insert into branches values('${branch}','${biz}');
   insert into user_roles values('${manager}','${roleManager}','${biz}'),('${stranger}','${roleManager}','${otherBiz}'),('${oldGlobal}','${roleSuper}',null);
   insert into user_global_roles values('${platform}','${roleSuper}'); insert into super_admins_legacy values('${legacy}');
  `);
  for(const sig of signatures) await sql(`create function public.${sig} returns integer language sql security definer as $$select 0$$; grant execute on function public.${sig} to anon,authenticated,service_role;`);
  assert.equal(await sql("select has_function_privilege('anon','public.purge_user(uuid)','execute')"),'t','Fixture must reproduce exposed maintenance privilege');
  await sql(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261110132000_privileged_maintenance_acl.sql'),'utf8'));
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
  console.log('PASS maintenance ACL: 17 server-only RPCs, role/log table and column DML denied, checked cross-tenant branch grants, all three caller-bound global role stores, retired dev shortcut');
 } finally { if(created) { await docker(['rm','--force',container]); console.log('Removed owned isolated maintenance ACL container'); } }
})().catch(error=>{console.error(error.message);process.exitCode=1;});

// Real Auth + PostgREST + PostgreSQL, synthetic identities only. No .env files,
// SMTP, remote project or existing containers. All resources are owned/ephemeral.
const { spawnSync, spawn } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { randomUUID, createHmac } = require('node:crypto');
const path = require('node:path');
const assert = require('node:assert/strict');
const name = 'kezek-lifecycle-' + randomUUID();
const db = name + '-db', auth = name + '-auth', rest = name + '-rest';
const secret = 'isolated-lifecycle-only-secret-at-least-32-characters';
const docker = (args, input, allowError = false) => {
  const r = spawnSync('docker', args, { input, encoding: 'utf8', windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
  if (!allowError && r.status !== 0) throw new Error(r.stderr || r.stdout);
  return r;
};
const sqlArgs = ['exec', '-i', db, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres'];
const sql = text => docker(sqlArgs, text).stdout.trim();
const fails = (text, match) => {
  const r = docker(sqlArgs, text, true); assert.notEqual(r.status, 0); assert.match(r.stderr, match);
};
const source = file => readFileSync(path.join(__dirname, '../supabase/migrations', file), 'utf8');
const definition = (file, name) => { const s = source(file), start = s.indexOf('create or replace function public.' + name + '('); assert(start >= 0); return s.slice(start, s.indexOf('$$;', start) + 3); };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const wait = async check => { for (let n = 0; n < 120; n++) { if (await check()) return; await sleep(250); } throw new Error('Owned service not ready'); };
const token = claims => {
  const body = [ { alg: 'HS256', typ: 'JWT' }, { exp: Math.floor(Date.now()/1000)+3600, ...claims } ].map(x => Buffer.from(JSON.stringify(x)).toString('base64url')).join('.');
  return body + '.' + createHmac('sha256', secret).update(body).digest('base64url');
};
const service = token({ role: 'service_role' });
let authUrl, restUrl;
const helper = name + '-http';
const http = async (base, route, method = 'GET', body, jwt = service) => {
  const code = "let s='';process.stdin.on('data',x=>s+=x);process.stdin.on('end',async()=>{try{const p=JSON.parse(s);const r=await fetch(p.url,{method:p.method,headers:{Authorization:'Bearer '+p.jwt,'content-type':'application/json'},body:p.body===undefined?undefined:JSON.stringify(p.body),signal:AbortSignal.timeout(10000)});const t=await r.text();let data=null;try{data=JSON.parse(t)}catch{}process.stdout.write(JSON.stringify({status:r.status,data}));}catch{process.exitCode=1}});";
  return new Promise((resolve,reject)=>{
    const child=spawn('docker',['exec','-i',helper,'node','-e',code],{windowsHide:true});let out='';
    child.stdout.on('data',x=>out+=x);child.stderr.resume();child.on('error',reject);
    child.on('exit',status=>{if(status!==0)return reject(Error('Isolated HTTP request failed'));try{resolve(JSON.parse(out))}catch(error){reject(error)}});
    child.stdin.end(JSON.stringify({url:base+route,method,body,jwt}));
  });
};
const prepare = (actor, target, action, reason = null) => JSON.parse(sql(`set role service_role; select prepare_user_lifecycle('${actor}','${target}','${action}',${reason === null ? 'null' : "'" + reason.replaceAll("'", "''") + "'"});`));
const apply = (target, command, action) => http(authUrl, '/admin/users/' + target, action === 'delete' ? 'DELETE' : 'PUT', action === 'delete' ? {} : { ban_duration: action === 'block' ? '876000h' : 'none', app_metadata: { kezek_lifecycle_command: command.commandId } });
const completed = (actor, target, command) => sql(`set role service_role; select read_user_lifecycle('${actor}','${target}','${command.commandId}');`) === 't';
const created = [];
(async () => {
  try {
    docker(['network', 'create', '--internal', '--label', 'kezek.test=' + name, name]);
    docker(['run','-d','--name',helper,'--label','kezek.test='+name,'--network',name,'node:22-alpine','node','-e','setInterval(()=>{},100000)']); created.push(helper);
    docker(['run', '-d', '--name', db, '--label', 'kezek.test=' + name, '--network', name, '--tmpfs', '/var/lib/postgresql/data', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:16']); created.push(db);
    await wait(() => docker(['exec', db, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'], undefined, true).status === 0);
    sql(`create role anon; create role authenticated; create role service_role bypassrls;
      create role authenticator login noinherit; grant anon,authenticated,service_role to authenticator;
      create schema auth; create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub'$$;
    ` .replace("select nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub'", "select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid"));
    sql(`create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
      grant usage on schema auth to anon,authenticated,service_role;`);
    docker(['run', '-d', '--name', auth, '--label', 'kezek.test=' + name, '--network', name,
      '-e', 'GOTRUE_API_HOST=0.0.0.0', '-e', 'GOTRUE_API_PORT=9999', '-e', 'API_EXTERNAL_URL=http://localhost:9999',
      '-e', 'GOTRUE_SITE_URL=http://localhost', '-e', 'GOTRUE_DB_DRIVER=postgres', '-e', `GOTRUE_DB_DATABASE_URL=postgres://postgres@${db}:5432/postgres?search_path=auth`,
      '-e', 'GOTRUE_JWT_SECRET=' + secret, '-e', 'GOTRUE_JWT_AUD=authenticated', '-e', 'GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated', '-e', 'GOTRUE_JWT_ADMIN_ROLES=service_role',
      '-e', 'GOTRUE_MAILER_AUTOCONFIRM=true', '-e', 'GOTRUE_DISABLE_SIGNUP=true', 'public.ecr.aws/supabase/gotrue:v2.180.0']); created.push(auth);
    authUrl = 'http://' + auth + ':9999';
    await wait(async () => { try { return (await http(authUrl, '/health')).status === 200; } catch { return false; } });
    sql(`create table account_deletion_requests(user_id uuid primary key,status text,scheduled_for timestamptz);
      create table roles(id uuid primary key default gen_random_uuid(),key text unique,name text,scope text);
      create table user_global_roles(user_id uuid references auth.users on delete cascade,role_id uuid references roles,created_at timestamptz default now(),primary key(user_id,role_id));
      create table user_roles(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users on delete cascade,role_id uuid references roles,biz_id uuid,unique(user_id,role_id,biz_id));
      create table super_admins_legacy(user_id uuid primary key references auth.users on delete cascade);
      create table user_suspensions(user_id uuid primary key references auth.users on delete cascade,reason text,created_at timestamptz not null default now(),created_by uuid constraint user_suspensions_created_by_fkey references auth.users);
      create table businesses(id uuid primary key default gen_random_uuid(),owner_id uuid references auth.users on delete set null);
      create table staff(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users on delete set null,is_active boolean default true);
      create table branch_admins(branch_id uuid,user_id uuid,primary key(branch_id,user_id));
      create table profiles(id uuid primary key references auth.users on delete cascade);
      create table bookings(id uuid primary key default gen_random_uuid(),client_id uuid references auth.users on delete set null,amount numeric,status text,start_at timestamptz);
      alter table profiles enable row level security; create policy own_profile on profiles to authenticated using(id=auth.uid());
      grant select on profiles to authenticated;
      create function lifecycle_probe() returns boolean language sql security definer as $$select true$$;
      revoke all on function lifecycle_probe() from public;grant execute on function lifecycle_probe() to authenticated;
      insert into roles(key,name,scope) values('super_admin','Platform','platform'),('staff','Staff','business');`);
    sql(definition('20261110131000_shift_hours_adjustment.sql', 'finance_is_platform_admin'));
    sql(source('20261110134000_platform_admin_commands.sql'));
    const legacy=await http(authUrl,'/admin/users','POST',{email:'legacy@lifecycle.invalid',password:'Synthetic-only-password-319!',email_confirm:true});
    assert.equal(legacy.status,200);
    const legacySession=await http(authUrl,'/token?grant_type=password','POST',{email:'legacy@lifecycle.invalid',password:'Synthetic-only-password-319!'});
    assert.equal(legacySession.status,200);
    sql(`insert into user_suspensions(user_id) values('${legacy.data.id}');`);
    sql(source('20261111090000_user_lifecycle.sql'));
    assert.equal((await http(authUrl,'/user','GET',undefined,legacySession.data.access_token)).status,403,'migration revokes preexisting legacy suspension sessions');
    assert.equal(sql(`select count(*) from auth.refresh_tokens where user_id='${legacy.data.id}'`),'0');
    fails(`insert into auth.sessions(id,user_id) values(gen_random_uuid(),'${legacy.data.id}');`,/USER_SUSPENDED/);
    docker(['run', '-d', '--name', rest, '--label', 'kezek.test=' + name, '--network', name,
      '-e', `PGRST_DB_URI=postgres://authenticator@${db}:5432/postgres`, '-e', 'PGRST_DB_SCHEMAS=public', '-e', 'PGRST_DB_ANON_ROLE=anon', '-e', 'PGRST_JWT_SECRET=' + secret, 'public.ecr.aws/supabase/postgrest:v13.0.7']); created.push(rest);
    restUrl = 'http://' + rest + ':3000';
    await wait(async () => { try { return (await http(restUrl, '/')).status === 200; } catch { return false; } });
    const createUser = async label => {
      const result = await http(authUrl, '/admin/users', 'POST', { email: label + '@lifecycle.invalid', password: 'Synthetic-only-password-319!', email_confirm: true });
      assert.equal(result.status, 200, 'create synthetic identity'); return result.data.id;
    };
    const admin = await createUser('admin'), user = await createUser('target'), other = await createUser('other');
    sql(`insert into user_global_roles select '${admin}',id,now() from roles where key='super_admin';
      insert into profiles values('${user}'); insert into staff(user_id) values('${user}');
      insert into user_roles(user_id,role_id) select '${user}',id from roles where key='staff';
      insert into branch_admins values(gen_random_uuid(),'${user}');
      insert into bookings(client_id,amount) values('${user}',123.45);`);
    const login = () => http(authUrl, '/token?grant_type=password', 'POST', { email: 'target@lifecycle.invalid', password: 'Synthetic-only-password-319!' });
    let session = await login(); assert.equal(session.status, 200); const old = session.data;
    assert.equal((await http(restUrl, '/profiles', 'GET', undefined, old.access_token)).status, 200);
    // No-op unblock must still complete (banned_until is already NULL).
    let c = prepare(admin,user,'unblock'); assert.equal((await apply(user,c,'unblock')).status,200); assert(completed(admin,user,c));
    const preparedHttp=await http(restUrl,'/rpc/prepare_user_lifecycle','POST',{p_actor_id:admin,p_user_id:user,p_action:'block',p_reason:null});
    assert.equal(preparedHttp.status,200);c=preparedHttp.data;const firstBlock = c;
    assert.equal(prepare(admin,user,'block').commandId,c.commandId,'pending retries share command');
    fails(`set role service_role; select prepare_user_lifecycle('${admin}','${user}','unblock');`,/USER_LIFECYCLE_PENDING/);
    fails(`insert into user_global_roles select '${user}',id,now() from roles where key='super_admin';`,/USER_LIFECYCLE_ASSIGNMENT_BLOCKED/);
    sql(`create function fail_session_delete() returns trigger language plpgsql as $$begin raise exception 'injected session failure';end$$;
      create trigger fail_session_delete before delete on auth.sessions for each row execute function fail_session_delete();`);
    assert.equal((await apply(user,c,'block')).status,500);assert(!completed(admin,user,c));
    assert.equal(sql(`select count(*) from user_suspensions where user_id='${user}'`),'0','ban rollback retains active state');
    assert.equal((await http(authUrl,'/user','GET',undefined,old.access_token)).status,200,'failed ban preserves session');
    sql('drop trigger fail_session_delete on auth.sessions;drop function fail_session_delete();');
    const repeated=await Promise.all([apply(user,c,'block'),apply(user,c,'block')]);
    assert(repeated.some(x=>x.status===200));assert(repeated.every(x=>[200,500].includes(x.status)));assert(completed(admin,user,c));
    assert(prepare(admin,user,'block').completed,'completed retry');
    assert.equal(sql(`select count(*) from user_roles where user_id='${user}'`),'1','roles retained');
    assert.equal(sql(`select count(*) from staff where user_id='${user}' and is_active`),'1','staff retained');
    assert.equal(sql(`select count(*) from auth.sessions where user_id='${user}'`),'0');
    assert.equal((await http(authUrl,'/user','GET',undefined,old.access_token)).status,403,'old Auth session rejected');
    assert.equal((await http(restUrl,'/profiles','GET',undefined,old.access_token)).status,403,'old REST JWT rejected');
    assert.equal((await http(restUrl,'/rpc/lifecycle_probe','POST',{},old.access_token)).status,403,'pre-request also protects security-definer RPC');
    assert.equal((await login()).status,400,'new password login blocked');
    assert.equal((await http(authUrl,'/token?grant_type=refresh_token','POST',{refresh_token:old.refresh_token})).status,400,'refresh revoked');
    fails(`insert into auth.sessions(id,user_id) values(gen_random_uuid(),'${user}');`,/USER_SUSPENDED/);
    // RLS is independently enforced (Storage/Realtime do not use pre-request).
    assert.equal(sql(`set role authenticated; set request.jwt.claims='${JSON.stringify({sub:user,session_id:randomUUID()})}';select count(*) from profiles;`),'0');
    c=prepare(admin,user,'unblock'); assert.equal((await apply(user,c,'unblock')).status,200); assert(completed(admin,user,c));
    assert.equal((await http(restUrl,'/profiles','GET',undefined,old.access_token)).status,403,'unblock never resurrects old session');
    session=await login();assert.equal(session.status,200);
    assert.equal((await http(restUrl,'/profiles','GET',undefined,session.data.access_token)).status,200);
    assert.equal((await apply(user,firstBlock,'block')).status,500,'late old ban fenced');
    assert.equal(sql(`select count(*) from user_suspensions where user_id='${user}'`),'0');
    // Each global-role store protects targets and accepts actors.
    for(const store of ['user_global_roles','super_admins_legacy','user_roles']) {
      sql(store==='super_admins_legacy'?`insert into ${store} values('${other}');`:`insert into ${store}(user_id,role_id) select '${other}',id from roles where key='super_admin';`);
      fails(`set role service_role;select prepare_user_lifecycle('${admin}','${other}','delete');`,/USER_LIFECYCLE_PROTECTED/);
      sql(`delete from ${store} where user_id='${other}';`);
    }
    fails(`set role service_role;select prepare_user_lifecycle('${admin}','${admin}','block');`,/USER_LIFECYCLE_SELF/);
    fails(`set role service_role;select prepare_user_lifecycle('${other}','${user}','delete');`,/USER_LIFECYCLE_FORBIDDEN/);
    for(const role of ['anon','authenticated']) fails(`set role ${role};select prepare_user_lifecycle('${admin}','${user}','delete');`,/permission denied/);
    sql(`insert into businesses(owner_id) values('${user}');`);
    fails(`set role service_role;select prepare_user_lifecycle('${admin}','${user}','delete');`,/USER_LIFECYCLE_OWNER/);
    sql(`update businesses set owner_id='${other}' where owner_id='${user}';`);
    // A real FK failure in the Auth transaction must leave EVERY prior row intact.
    sql(`create table deletion_blocker(user_id uuid references auth.users);insert into deletion_blocker values('${user}');`);
    c=prepare(admin,user,'delete');
    fails(`insert into businesses(owner_id) values('${user}');`,/USER_LIFECYCLE_ASSIGNMENT_BLOCKED/);
    fails(`insert into branch_admins values(gen_random_uuid(),'${user}');`,/USER_LIFECYCLE_ASSIGNMENT_BLOCKED/);
    assert.equal((await apply(user,c,'delete')).status,500);assert(!completed(admin,user,c));
    assert.equal(sql(`select count(*) from profiles where id='${user}'`),'1');
    assert.equal(sql(`select count(*) from staff where user_id='${user}' and is_active`),'1');
    assert.equal(sql(`select count(*) from user_roles where user_id='${user}'`),'1');
    assert.equal(sql(`select count(*) from bookings where client_id='${user}' and amount=123.45`),'1');
    sql('drop table deletion_blocker;');
    assert.equal((await apply(user,c,'delete')).status,200); assert(completed(admin,user,c));
    assert(prepare(admin,user,'delete').completed,'delete repeat after missing Auth user');
    assert.equal(sql(`select count(*) from auth.users where id='${user}'`),'0');
    assert.equal(sql('select count(*) from staff where user_id is null and not is_active'),'1');
    assert.equal(sql(`select count(*) from branch_admins where user_id='${user}'`),'0');
    assert.equal(sql('select count(*) from bookings where client_id is null and amount=123.45'),'1');
    assert.equal((await http(authUrl,'/user','GET',undefined,session.data.access_token)).status,403);
    assert.equal((await http(restUrl,'/profiles','GET',undefined,session.data.access_token)).status,403);
    const due=await createUser('due');
    sql(`insert into account_deletion_requests values('${due}','pending',now()-interval '1 day');set role service_role;`);
    sql(`delete from auth.users where id='${due}';`);
    assert.equal(sql(`select count(*) from auth.users where id='${due}'`),'0','due self-deletion compatibility');
    sql(`insert into account_deletion_requests values('${admin}','pending',now()-interval '1 day');`);
    fails(`delete from auth.users where id='${admin}';`,/USER_LIFECYCLE_DELETION_BLOCKED/);
    console.log('PASS ENG-31 real Auth/PostgREST lifecycle, rollback, retained history, revocation, replay, ACL and stale command fencing');
  } finally {
    for (const container of created.reverse()) {
      const i = JSON.parse(docker(['inspect',container]).stdout)[0];
      assert.equal(i.Config.Labels['kezek.test'], name);
      docker(['rm','-f',container]);
    }
    const network = JSON.parse(docker(['network','inspect',name]).stdout)[0];
    assert.equal(network.Labels['kezek.test'],name); docker(['network','rm',name]);
  }
})().catch(error => { console.error(error.message); process.exitCode=1; });

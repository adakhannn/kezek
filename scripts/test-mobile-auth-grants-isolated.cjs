// Local-only regression: existing postgres:16 image, no network/ports/volumes.
// Synthetic minimal predecessor schema. Never reads project env or DB URLs.
const { spawnSync, spawn } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const name = 'kezek-auth-regression-' + randomUUID();
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
const user = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
(async () => {
  try {
    run(['run', '-d', '--name', name, '--network', 'none', '--tmpfs', '/var/lib/postgresql/data', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:16']);
    let ready = false;
    for (let i = 0; i < 60; i++) {
      if (run(['exec', name, 'pg_isready', '-U', 'postgres'], undefined, true).status === 0) { ready = true; break; }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    assert(ready, 'disposable Postgres startup');
    sql("create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); insert into auth.users values ('" + user + "'), ('" + other + "'); create table public.telegram_mobile_auth_attempts(nonce text); create table public.whatsapp_otp_codes(id uuid primary key, otp_hash text, used_at timestamptz, consumed_at timestamptz, status text not null default 'pending' check(status in ('pending','consumed','approved','failed','expired')), expires_at timestamptz not null default now()+interval '5 minutes', failed_attempts integer default 0, locked_until timestamptz);");
    sql(readFileSync(path.join(root, 'supabase/migrations/20261109090000_bound_mobile_session_grants.sql'), 'utf8'));
    sql(readFileSync(path.join(root, 'supabase/migrations/20261109100000_yandex_oauth_state.sql'), 'utf8'));
    sql("insert into mobile_session_grants(code_hash,code_challenge,user_id) values(repeat('a',64),repeat('b',64),'"+user+"');");
    assert.equal(sql("set role service_role; select consume_mobile_session_grant(repeat('a',64),repeat('c',64)) is null;"), 't');
    const grants = await Promise.all(Array.from({length: 12}, () => asyncSql("set role service_role; select consume_mobile_session_grant(repeat('a',64),repeat('b',64));")));
    assert.equal(grants.filter(value => value === user).length, 1, 'exactly one concurrent grant redemption');
    assert.equal(sql("select count(*) from mobile_session_grants where consumed_at is not null;"), '1');
    sql("insert into mobile_session_grants(code_hash,code_challenge,user_id,expires_at) values(repeat('d',64),repeat('b',64),'"+user+"',now());");
    assert.equal(sql("set role service_role; select consume_mobile_session_grant(repeat('d',64),repeat('b',64)) is null;"), 't');
    sql("insert into whatsapp_otp_codes(id,otp_hash,code_challenge) values('"+user+"',repeat('a',64),repeat('b',64));");
    assert.equal(sql("set role service_role; select consume_whatsapp_mobile_otp('"+user+"',repeat('c',64),repeat('b',64));"), 'f');
    const otps = await Promise.all(Array.from({length: 12}, () => asyncSql("set role service_role; select consume_whatsapp_mobile_otp('"+user+"',repeat('a',64),repeat('b',64));")));
    assert.equal(otps.filter(value => value === 't').length, 1, 'exactly one concurrent OTP consumption');
    sql("insert into whatsapp_otp_codes(id,otp_hash,code_challenge) values('"+other+"',repeat('a',64),repeat('b',64));");
    await Promise.all(Array.from({length: 12}, () => asyncSql("set role service_role; select register_whatsapp_mobile_otp_failure('"+other+"');")));
    assert.equal(sql("select failed_attempts||':'||status from whatsapp_otp_codes where id='"+other+"';"), '5:failed');
    assert.equal(sql("set role service_role; select consume_whatsapp_mobile_otp('"+other+"',repeat('a',64),repeat('b',64));"), 'f');
    sql("update whatsapp_otp_codes set status='pending',used_at=null,consumed_at=null,expires_at=now(),failed_attempts=0,locked_until=null where id='"+user+"';");
    assert.equal(sql("set role service_role; select consume_whatsapp_mobile_otp('"+user+"',repeat('a',64),repeat('b',64));"), 'f');
    sql("set role service_role; select create_yandex_oauth_state(repeat('a',64),'link','"+user+"','/profile');");
    assert.equal(sql("set role service_role; select consume_yandex_oauth_state(repeat('a',64),'link','"+other+"') is null;"), 't');
    const oauth = await Promise.all(Array.from({length: 12}, () => asyncSql("set role service_role; select consume_yandex_oauth_state(repeat('a',64),'link','"+user+"');")));
    assert.equal(oauth.filter(Boolean).length, 1, 'exactly one concurrent OAuth state redemption');
    assert.equal(JSON.parse(oauth.find(Boolean)).user_id, user);
    sql("insert into yandex_oauth_states(state_hash,flow,expires_at) values(repeat('e',64),'sign_in',now());");
    assert.equal(sql("set role service_role; select consume_yandex_oauth_state(repeat('e',64),'sign_in',null) is null;"), 't');
    for (const role of ['anon','authenticated']) {
      for (const statement of ["select * from mobile_session_grants", "select consume_mobile_session_grant(repeat('a',64),repeat('b',64))", "select consume_whatsapp_mobile_otp('"+user+"',repeat('a',64),repeat('b',64))", "select register_whatsapp_mobile_otp_failure('"+user+"')", "select consume_yandex_oauth_state(repeat('a',64),'sign_in',null)", "select create_yandex_oauth_state(repeat('f',64),'sign_in',null,'/')"]) {
        const result = run(['exec','-i',name,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres'], 'set role '+role+'; '+statement+';', true);
        assert.notEqual(result.status, 0, role + ' must be denied');
        assert.match(result.stderr, /permission denied/);
      }
    }
    console.log('PASS isolated Postgres: grant/OTP/OAuth parallel one-use, wrong proof, expiry, failed-attempt cap, role denials. No network, ports, volumes or remote migration.');
  } finally {
    // Only this process-created, UUID-named disposable container is removed.
    if (!/^kezek-auth-regression-[0-9a-f-]{36}$/.test(name)) throw new Error('Invalid disposable name');
    run(['rm','-f','-v',name], undefined, true);
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });

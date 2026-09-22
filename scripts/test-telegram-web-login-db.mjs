// Disposable PostgreSQL only. Does not connect to Supabase.
// node scripts/test-telegram-web-login-db.mjs <path-to-pglite-module>
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role;
create table public.profiles(id uuid primary key, telegram_id bigint unique, telegram_verified boolean);`);
await db.exec(await readFile(new URL('../supabase/migrations/20260917130000_telegram_web_login_attempts.sql', import.meta.url),'utf8'));
const uid = '00000000-0000-0000-0000-000000000001';
await db.query('insert into public.profiles values ($1,123,true)',[uid]);
const browser = 'b'.repeat(64), other = 'c'.repeat(64);
let i = 0;
async function create() {
    const hash = (++i).toString(16).padStart(64,'0');
    await db.query('insert into public.telegram_web_login_attempts(token_hash,browser_hash) values ($1,$2)',[hash,browser]);
    return hash;
}
async function step(hash, action, secret = null, telegram = null) {
    return (await db.query('select public.transition_telegram_web_login($1,$2,$3,$4,$5) as result',[hash,action,secret,telegram,'Name'])).rows[0].result;
}
const a = await create();
assert.equal((await step(a,'finish',other,123)).error,'not_found');
assert.equal((await step(a,'approve',null,123)).error,'not_claimed');
assert.equal((await step(a,'claim',null,123)).status,'pending');
assert.equal((await step(a,'claim',null,456)).error,'different_account');
assert.equal((await step(a,'approve',null,456)).error,'different_account');
assert.equal((await step(a,'finish',browser,123)).error,'not_approved');
assert.equal((await step(a,'approve',null,123)).status,'approved');
assert.equal((await step(a,'approve',null,123)).status,'approved');
assert.equal((await step(a,'finish',browser,456)).error,'different_account');
const finishes = await Promise.all([step(a,'finish',browser,123),step(a,'finish',browser,123)]);
assert.equal(finishes.filter(x=>x.user_id === uid).length,1);
assert.equal(finishes.filter(x=>x.error === 'closed').length,1);
const b = await create(); await step(b,'claim',null,123); await step(b,'approve',null,123);
await db.exec('update public.profiles set telegram_verified=false');
assert.equal((await step(b,'finish',browser,123)).error,'not_linked');
await db.exec('update public.profiles set telegram_verified=true');
const c = await create();
assert.equal((await step(c,'cancel',other)).error,'not_found');
assert.equal((await step(c,'cancel',browser)).status,'cancelled');
assert.equal((await step(c,'claim',null,123)).error,'closed');
const d = await create();
await db.query("update public.telegram_web_login_attempts set expires_at=now()-interval '1 second' where token_hash=$1",[d]);
assert.equal((await step(d,'claim',null,123)).error,'expired');
const e = await create(); await step(e,'claim',null,999); await step(e,'approve',null,999);
assert.equal((await step(e,'finish',browser,999)).error,'not_linked');
assert.equal((await db.query('select count(*) as n from public.profiles')).rows[0].n,1);
for (const role of ['anon','authenticated']) {
    assert.equal((await db.query('select has_table_privilege($1,\'public.telegram_web_login_attempts\',\'SELECT\') as allowed',[role])).rows[0].allowed,false);
    assert.equal((await db.query("select has_function_privilege($1,'public.transition_telegram_web_login(text,text,text,bigint,text)','EXECUTE') as allowed",[role])).rows[0].allowed,false);
}
assert.equal((await db.query("select relrowsecurity from pg_class where relname='telegram_web_login_attempts'")).rows[0].relrowsecurity,true);
console.log('PASS: browser binding, consent, identity, expiry, cancellation, single consumption, unlink, no signup, RLS/grants');
await db.close();

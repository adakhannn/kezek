// Run with: node scripts/test-telegram-profile-link-db.mjs <path-to-pglite-module>
// Uses disposable, in-memory PostgreSQL. Never connects to Supabase.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
await db.exec(`
create role anon; create role authenticated; create role service_role;
create schema auth;
create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
create table public.profiles(id uuid primary key references auth.users(id), telegram_id bigint unique,
telegram_username text, telegram_photo_url text, telegram_verified boolean);
`);
await db.exec(await readFile(new URL('../supabase/migrations/20260916120000_telegram_profile_link_attempts.sql', import.meta.url), 'utf8'));
const owner = '00000000-0000-0000-0000-000000000001';
const other = '00000000-0000-0000-0000-000000000002';
await db.query('insert into auth.users(id) values ($1),($2)', [owner,other]);
await db.exec('insert into public.profiles(id) select id from auth.users');
let n = 0;
async function attempt(user = owner) {
    const hash = (++n).toString(16).padStart(64,'0');
    await db.query('insert into public.telegram_profile_link_attempts(token_hash,owner_id) values ($1,$2)',[hash,user]);
    return hash;
}
async function step(hash, action, user = null, tg = null) {
    return (await db.query('select public.transition_telegram_profile_link($1,$2,$3,$4,$5,$6) as result',
        [hash,action,user,tg,'test_user','Test User'])).rows[0].result;
}
const a = await attempt();
assert.equal((await step(a,'finish',other,100)).error,'not_found');
assert.equal((await step(a,'finish',owner,100)).error,'not_claimed');
assert.equal((await step(a,'claim',null,100)).status,'pending');
assert.equal((await step(a,'claim',null,200)).error,'different_account');
assert.equal((await step(a,'approve',null,200)).error,'different_account');
assert.equal((await step(a,'finish',owner,100)).error,'not_approved');
assert.equal((await step(a,'approve',null,100)).status,'approved');
assert.equal((await step(a,'finish',owner,200)).error,'different_account');
assert.equal((await step(a,'finish',owner,100)).status,'consumed');
assert.equal((await step(a,'finish',owner,100)).status,'consumed');
assert.equal((await step(a,'cancel_owner',owner)).error,'closed');
const profile = (await db.query('select telegram_id,telegram_verified from public.profiles where id=$1',[owner])).rows[0];
assert.equal(Number(profile.telegram_id),100); assert.equal(profile.telegram_verified,true);
assert.equal((await db.query('select raw_user_meta_data from auth.users where id=$1',[owner])).rows[0].raw_user_meta_data.telegram_id,100);
const b = await attempt(other);
await step(b,'claim',null,100); await step(b,'approve',null,100);
assert.equal((await step(b,'finish',other,100)).error,'already_linked');
assert.equal((await db.query('select telegram_id from public.profiles where id=$1',[other])).rows[0].telegram_id,null);
const c = await attempt();
await step(c,'claim',null,300); await step(c,'approve',null,300);
assert.equal((await step(c,'finish',owner,300)).error,'already_connected');
const d = await attempt();
await step(d,'claim',null,100); await step(d,'approve',null,100);
await db.query("update public.telegram_profile_link_attempts set expires_at=now()-interval '1 second' where token_hash=$1",[d]);
assert.equal((await step(d,'finish',owner,100)).error,'expired');
const e = await attempt();
assert.equal((await step(e,'cancel_owner',owner)).status,'cancelled');
assert.equal((await step(e,'claim',null,100)).error,'closed');
// A failure after the profile write must roll back both profile and attempt state.
const f = await attempt(other);
await step(f,'claim',null,400); await step(f,'approve',null,400);
await db.exec(`create function public.test_metadata_failure() returns trigger language plpgsql as $$
begin raise exception 'simulated metadata failure'; end $$;
create trigger metadata_failure before update on auth.users for each row execute function public.test_metadata_failure();`);
await assert.rejects(step(f,'finish',other,400));
assert.equal((await db.query('select telegram_id from public.profiles where id=$1',[other])).rows[0].telegram_id,null);
assert.equal((await db.query('select status from public.telegram_profile_link_attempts where token_hash=$1',[f])).rows[0].status,'approved');
await db.exec('drop trigger metadata_failure on auth.users; drop function public.test_metadata_failure()');
// Concurrent attempts for the same Telegram identity cannot both claim ownership.
await db.query('update public.profiles set telegram_id=null where id=$1',[owner]);
const g = await attempt(owner);
await step(g,'claim',null,400); await step(g,'approve',null,400);
const racing = await Promise.all([step(f,'finish',other,400), step(g,'finish',owner,400)]);
assert.equal(racing.filter(r => r.status === 'consumed').length,1);
assert.equal(racing.filter(r => r.error === 'already_linked').length,1);
assert.equal((await db.query("select has_function_privilege('authenticated','public.transition_telegram_profile_link(text,text,uuid,bigint,text,text)','execute') as allowed")).rows[0].allowed,false);
assert.equal((await db.query("select has_table_privilege('anon','public.telegram_profile_link_attempts','select') as allowed")).rows[0].allowed,false);
await db.close();
console.log('PASS: ownership, two-sided approval, account binding, expiry, replay, conflict, atomic metadata, cancellation and database permissions');

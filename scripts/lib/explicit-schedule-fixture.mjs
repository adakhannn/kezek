import { readFile } from 'node:fs/promises';
export const id = n => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
export const biz=id(1), branch=id(2), staff=id(3), owner=id(4), other=id(5), branch2=id(6);

export async function setupScheduleFixture(db) {
await db.exec(`
create role anon; create role authenticated; create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql as $$ select '${owner}'::uuid $$;
create function public.is_super_admin() returns boolean language sql as $$ select false $$;
create type booking_status as enum ('hold','confirmed','paid','cancelled');
create table businesses(id uuid primary key, owner_id uuid, tz text);
create table branches(id uuid primary key,biz_id uuid,is_active boolean);
create table staff(id uuid primary key,biz_id uuid,branch_id uuid,user_id uuid,is_active boolean);
create table staff_branch_assignments(id uuid default gen_random_uuid(),biz_id uuid,staff_id uuid,branch_id uuid,valid_from date,valid_to date);
create table roles(id uuid primary key,key text);
create table user_roles(user_id uuid,biz_id uuid,role_id uuid);
create table staff_time_off(id uuid default gen_random_uuid(),staff_id uuid,biz_id uuid,date_from date,date_to date);
create table staff_schedule_rules(id uuid default gen_random_uuid(),staff_id uuid,biz_id uuid,branch_id uuid,
kind text,date_on date,date_from date,date_to date,day_of_week int,is_active boolean,priority int default 0,
created_at timestamptz default now(),tz text,intervals jsonb,breaks jsonb);
create table working_hours(staff_id uuid,biz_id uuid,day_of_week int,intervals jsonb,breaks jsonb);
create table branch_working_hours(biz_id uuid,branch_id uuid,day_of_week int,intervals jsonb,breaks jsonb);
create table bookings(id uuid default gen_random_uuid(),staff_id uuid,biz_id uuid,branch_id uuid,
start_at timestamptz,end_at timestamptz,status text,expires_at timestamptz,
service_id uuid,client_id uuid,client_name text,client_phone text,client_email text);
create table booking_services(booking_id uuid,service_id uuid,duration_min int,order_index int);
create table services(id uuid,biz_id uuid,branch_id uuid,duration_min int,active boolean);
insert into businesses values('${biz}','${owner}','Asia/Bishkek');
insert into branches values('${branch}','${biz}',true),('${branch2}','${biz}',true);
insert into staff values('${staff}','${biz}','${branch}','${other}',true);
insert into branch_working_hours select '${biz}',b,day,'[{"start":"08:00","end":"20:00"}]'::jsonb,'[]'::jsonb from unnest(array['${branch}'::uuid,'${branch2}'::uuid]) b cross join generate_series(0,6) day;
`);
const rollback = await readFile(new URL('../../supabase/migrations/20260918120000_revert_staff_schedule_inheritance.sql',import.meta.url),'utf8');
await db.exec(rollback.slice(rollback.indexOf('CREATE OR REPLACE FUNCTION'),rollback.indexOf('ALTER FUNCTION')));
await db.exec(await readFile(new URL('../../supabase/migrations/20260918130000_explicit_staff_schedules.sql',import.meta.url),'utf8'));
await db.exec(await readFile(new URL('../../supabase/migrations/20260918131000_explicit_schedule_booking_consumers.sql',import.meta.url),'utf8'));
await db.exec(await readFile(new URL('../../supabase/migrations/20260918132000_explicit_schedule_complex_booking_writers.sql',import.meta.url),'utf8'));
await db.exec(await readFile(new URL('../../supabase/migrations/20260918133000_atomic_staff_home_transfer.sql',import.meta.url),'utf8'));
}

// Synthetic finance contract fixture, not a Supabase/bootstrap baseline. The tables are synthetic
// (plus the archive table predecessors below); the functions are the migration chain (CI-01): the
// predecessors the finance migrations rename or keep come from the prod baseline, the finance
// migrations run whole and in chain order, and the helpers whose later migration also changes
// schema this fixture does not have are installed from supabase/generated (installLiveFunction).
// Every suite on this fixture ends with assertLiveFunctions, so a function that drifts from the
// chain fails the suite instead of being tested in a version production no longer runs.
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const { SUPABASE_DEFAULT_PRIVILEGES, applyMigrationFunctionsWhereExist, applyMigrationWhereObjectsExist, installLiveFunction }=require('./live-schema.cjs');
export const ids = {
 biz:'a0000000-0000-4000-8000-000000000001', otherBiz:'a0000000-0000-4000-8000-000000000002',
 staff:'b0000000-0000-4000-8000-000000000001', otherStaff:'b0000000-0000-4000-8000-000000000002',
 owner:'c0000000-0000-4000-8000-000000000001', otherOwner:'c0000000-0000-4000-8000-000000000002',
 staffUser:'c0000000-0000-4000-8000-000000000003', client:'c0000000-0000-4000-8000-000000000004',
 branch:'d0000000-0000-4000-8000-000000000001', otherBranch:'d0000000-0000-4000-8000-000000000002',
 service:'e0000000-0000-4000-8000-000000000001', otherService:'e0000000-0000-4000-8000-000000000002',
 shift:'f0000000-0000-4000-8000-000000000001', otherShift:'f0000000-0000-4000-8000-000000000002',
 booking:'10000000-0000-4000-8000-000000000001', otherBooking:'10000000-0000-4000-8000-000000000002',
 item:'20000000-0000-4000-8000-000000000001', otherItem:'20000000-0000-4000-8000-000000000002',
 plan:'30000000-0000-4000-8000-000000000001', otherPlan:'30000000-0000-4000-8000-000000000002',
 pack:'40000000-0000-4000-8000-000000000001', otherPack:'40000000-0000-4000-8000-000000000002',
};
export const day='2026-10-12';
export const asActor=(actor=ids.owner,role='service_role') => `set role ${role}; set request.jwt.claim.role='${role}'; set request.jwt.claim.sub='${actor}';`;
const read=async(dir,name)=>(await fs.readFile(new URL(`../../supabase/${dir}/${name}`,import.meta.url),'utf8')).replace(/\r/g,'');
export const migration=name=>read('migrations',name);
function part(text,name,from,to) {
 const start=from===null?0:text.indexOf(from),end=to===null?text.length:text.indexOf(to,start);
 if(start<0||end<=start) throw new Error(`${name}: no part from ${from} to ${to}`);
 return text.slice(start,end);
}
// The statements of a migration from `from` (inclusive) up to `to` (exclusive); null means the edge.
export const migrationPart=async(name,from,to)=>part(await migration(name),name,from,to);
const archiveTables=async(name,to)=>part(await read('migrations_archive',name),name,null,to);
// One function of the prod baseline (pg_dump format), from CREATE to its closing $$.
function baselineFunction(baseline,name) {
 const head=`CREATE OR REPLACE FUNCTION "public"."${name}"(`,start=baseline.indexOf(head);
 if(start<0||baseline.indexOf(head,start+1)>=0) throw new Error(`prod baseline: expected one definition of ${name}`);
 return part(baseline,name,head,'\n$$;')+'\n$$;';
}
// The DROP FUNCTION statements of the migrations that retired functions of this chain. A suite that
// loads an older migration recreating one of them runs them again.
export async function dropRetiredFunctions(sql) {
 const drops=[];
 for(const name of ['20261117190000_drop_dead_functions.sql','20261119020000_dead_functions_and_cleanup_jobs.sql']) drops.push(...(await migration(name)).match(/^drop function if exists [^;\n]+;$/gm));
 await sql(drops.join('\n'));
}
export async function setupFinanceFixture(sql) {
 // The prod-baseline function defaults: the migrations below ran under them in production.
 await sql(`
 create role anon; create role authenticated; create role service_role bypassrls;
 ${SUPABASE_DEFAULT_PRIVILEGES}
 create schema auth;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.role() returns text language sql stable as $$select nullif(current_setting('request.jwt.claim.role',true),'')$$;
 create type public.booking_status as enum('hold','confirmed','paid','cancelled','no_show');
 create table public.businesses(id uuid primary key,owner_id uuid,name text,tz text default 'Asia/Bishkek');
 create table public.branches(id uuid primary key,biz_id uuid references businesses,name text,is_active boolean default true);
 create table public.roles(id uuid primary key default gen_random_uuid(),key text,scope text not null default 'business');
 create table public.user_roles(user_id uuid,role_id uuid,biz_id uuid);
 create table public.user_global_roles(user_id uuid,role_id uuid);
 create table public.super_admins_legacy(user_id uuid);
 create table public.profiles(id uuid primary key);
 create table public.staff(id uuid primary key,biz_id uuid references businesses,branch_id uuid references branches,user_id uuid,
  full_name text,is_active boolean default true,percent_master numeric default 60,percent_salon numeric default 40,hourly_rate numeric);
 -- Catalog prices are integers in production: a range midpoint must not truncate (R25-04).
 create table public.services(id uuid primary key,biz_id uuid,price_from integer,price_to integer);
 create table public.bookings(id uuid primary key,biz_id uuid references businesses,branch_id uuid references branches,
  staff_id uuid references staff,service_id uuid references services,client_id uuid references auth.users,
  status public.booking_status default 'confirmed',start_at timestamptz,end_at timestamptz,expires_at timestamptz,promotion_applied jsonb,subscription_applied jsonb);
 -- The services of a complex booking, the primary one included (the prod columns pricing reads).
 create table public.booking_services(id uuid primary key default gen_random_uuid(),booking_id uuid not null references bookings,
  service_id uuid not null references services,duration_min integer not null default 30,order_index integer not null default 0);
 create table public.staff_shifts(id uuid primary key default gen_random_uuid(),staff_id uuid references staff,biz_id uuid references businesses,
  branch_id uuid references branches,expected_start timestamptz,shift_date date,status text default 'open',opened_at timestamptz,closed_at timestamptz,
  total_amount numeric default 0,consumables_amount numeric default 0,percent_master numeric,percent_salon numeric,
  master_share numeric default 0,salon_share numeric default 0,hours_worked numeric constraint staff_shifts_hours_worked_range check(hours_worked between 0 and 24),
  hourly_rate numeric,guaranteed_amount numeric default 0,topup_amount numeric default 0,late_minutes integer default 0,
  unique(staff_id,shift_date));
 create table public.staff_shift_items(id uuid primary key default gen_random_uuid(),shift_id uuid references staff_shifts,
  client_name text,service_name text,service_amount numeric not null default 0 check(service_amount>=0),
  consumables_amount numeric not null default 0 check(consumables_amount>=0),booking_id uuid references bookings,note text,created_at timestamptz default now());
 `);
 const baseline=await migration('20261009110000_prod_baseline.sql');
 await sql(baselineFunction(baseline,'set_timestamp_updated_at'));
 // 20261110132000 replaced is_super_admin together with ACLs of tables this fixture does not have.
 await installLiveFunction(sql,'public.is_super_admin()');
 // Table predecessors only: shift aggregates, branch promotions, visit packages.
 await sql(await archiveTables('20260212000000_create_shift_aggregates.sql','-- Функция для обновления агрегатов при закрытии смены'));
 await sql(await archiveTables('20260123000000_create_branch_promotions.sql','-- Функция для получения количества посещений клиента в филиале'));
 await sql(await archiveTables('20260305000000_create_visit_packages.sql',null));
 // The promotion helpers and the live pricing function come from 20261119120000 (ENG-123), run whole
 // after the finance migrations below.
 // Functions the finance migrations rename, revoke or keep calling, as production had them.
 await sql(['get_business_finance_stats','get_staff_finance_stats','save_shift_items_atomic','apply_visit_package_to_booking',
  'apply_promotion_to_booking','open_staff_shift_safe','close_staff_shift_safe','initialize_shift_aggregates'].map(name=>baselineFunction(baseline,name)).join('\n'));
 for(const name of ['20261109090100_tenant_finance_rpc_guards.sql','20261109091100_atomic_shift_commands.sql','20261110100000_finance_draft_revision.sql',
  '20261110110000_reporting_completeness.sql','20261110113000_shift_close_backlog.sql','20261110114000_finance_calendar.sql']) await sql(await migration(name));
 // The shared transition helper of 20261110123000 that the attendance command below locks through;
 // the rest of that migration is booking creation and lifecycle.
 await sql(await migrationPart('20261110123000_service_only_booking_commands.sql','create function public._assert_booking_transition_access(','create or replace function public.confirm_booking('));
 for(const name of ['20261110130000_booking_attendance_command.sql','20261110131000_shift_hours_adjustment.sql',
  '20261117190000_drop_dead_functions.sql','20261119000000_visit_package_sale_identity.sql']) await sql(await migration(name));
 await dropRetiredFunctions(sql);
 // Later grant and config migrations, for the functions this fixture builds.
 await applyMigrationWhereObjectsExist(sql,'20261119050000_privilege_parity_with_prod.sql');
 await applyMigrationWhereObjectsExist(sql,'20261119060000_definer_function_hardening.sql');
 await sql(await migration('20261119120000_promotion_visits_exclude_priced_booking.sql'));
 // ARCH-11: the business-day redefinitions of the functions this fixture builds.
 await applyMigrationFunctionsWhereExist(sql,'20261125100000_business_time_zone_days.sql');
 await sql(await migration('20261125110000_reopened_shift_close_cap.sql'));
 // R25-04/R25-17: benefit pricing and revenue reports from every service of the booking.
 for(const name of ['20261125140000_booking_price_all_services.sql','20261125140100_reporting_revenue_all_services.sql']) await sql(await migration(name));
 await sql(`grant usage on schema public,auth to anon,authenticated,service_role;
 grant execute on function auth.uid(),auth.role() to anon,authenticated,service_role;
 grant all on all tables in schema public,auth to service_role;
 grant all on all sequences in schema public,auth to service_role;
 -- Deliberately permissive item grants exercise the trigger boundary independently of external RLS.
 grant select on all tables in schema public to authenticated;
 grant insert,update,delete on public.staff_shift_items,public.staff_shifts to authenticated;
 insert into auth.users values('${ids.owner}'),('${ids.otherOwner}'),('${ids.staffUser}'),('${ids.client}');
 insert into businesses(id,owner_id,name) values('${ids.biz}','${ids.owner}','Synthetic A'),('${ids.otherBiz}','${ids.otherOwner}','Synthetic B');
 insert into branches(id,biz_id,name) values('${ids.branch}','${ids.biz}','A'),('${ids.otherBranch}','${ids.otherBiz}','B');
 insert into staff(id,biz_id,branch_id,user_id,full_name) values('${ids.staff}','${ids.biz}','${ids.branch}','${ids.staffUser}','Synthetic staff A'),('${ids.otherStaff}','${ids.otherBiz}','${ids.otherBranch}','${ids.otherOwner}','Synthetic staff B');
 insert into services values('${ids.service}','${ids.biz}',1000,1000),('${ids.otherService}','${ids.otherBiz}',1000,1000);
 insert into staff_shifts(id,staff_id,biz_id,branch_id,shift_date,opened_at) values
  ('${ids.shift}','${ids.staff}','${ids.biz}','${ids.branch}','${day}','${day} 09:00+06'),
  ('${ids.otherShift}','${ids.otherStaff}','${ids.otherBiz}','${ids.otherBranch}','${day}','${day} 09:00+06');
 insert into bookings(id,biz_id,branch_id,staff_id,service_id,client_id,start_at,end_at) values
  ('${ids.booking}','${ids.biz}','${ids.branch}','${ids.staff}','${ids.service}','${ids.client}','${day} 10:00+06','${day} 11:00+06'),
  ('${ids.otherBooking}','${ids.otherBiz}','${ids.otherBranch}','${ids.otherStaff}','${ids.otherService}','${ids.client}','${day} 10:00+06','${day} 11:00+06');
 insert into visit_package_plans(id,biz_id,name_ru,visit_count,validity_days,discount_type,discount_value) values
  ('${ids.plan}','${ids.biz}','Synthetic A package',3,1000,'percent',50),
  ('${ids.otherPlan}','${ids.otherBiz}','Synthetic B package',99,1000,'percent',100);
 insert into client_visit_packages(id,client_id,plan_id,remaining_visits,valid_until) values
  ('${ids.pack}','${ids.client}','${ids.plan}',3,'2100-12-31'),
  ('${ids.otherPack}','${ids.client}','${ids.otherPlan}',99,'2100-01-01');
 `);
}

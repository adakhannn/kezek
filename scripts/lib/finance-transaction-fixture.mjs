// Synthetic finance contract fixture, not a Supabase/bootstrap baseline.
import fs from 'node:fs/promises';
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
export async function setupFinanceFixture(sql) {
 await sql(`
 create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.role() returns text language sql stable as $$select nullif(current_setting('request.jwt.claim.role',true),'')$$;
 create type public.booking_status as enum('hold','confirmed','paid','cancelled','no_show');
 create table public.businesses(id uuid primary key,owner_id uuid,name text,tz text default 'Asia/Bishkek');
 create table public.branches(id uuid primary key,biz_id uuid references businesses,name text,is_active boolean default true);
 create table public.roles(id uuid primary key default gen_random_uuid(),key text);
 create table public.user_roles(user_id uuid,role_id uuid,biz_id uuid);
 create table public.profiles(id uuid primary key);
 create function public.is_super_admin() returns boolean language sql stable as $$select exists(select 1 from public.user_roles u join public.roles r on r.id=u.role_id where u.user_id=auth.uid() and u.biz_id is null and r.key='super_admin')$$;
 create function public.set_timestamp_updated_at() returns trigger language plpgsql as $$begin new.updated_at=now(); return new; end$$;
 create table public.staff(id uuid primary key,biz_id uuid references businesses,branch_id uuid references branches,user_id uuid,
  full_name text,is_active boolean default true,percent_master numeric default 60,percent_salon numeric default 40,hourly_rate numeric);
 create table public.services(id uuid primary key,biz_id uuid,price_from numeric,price_to numeric);
 create table public.bookings(id uuid primary key,biz_id uuid references businesses,branch_id uuid references branches,
  staff_id uuid references staff,service_id uuid references services,client_id uuid references auth.users,
  status public.booking_status default 'confirmed',start_at timestamptz,end_at timestamptz,promotion_applied jsonb,subscription_applied jsonb);
 create table public.staff_shifts(id uuid primary key default gen_random_uuid(),staff_id uuid references staff,biz_id uuid references businesses,
  branch_id uuid references branches,expected_start timestamptz,shift_date date,status text default 'open',opened_at timestamptz,closed_at timestamptz,
  total_amount numeric default 0,consumables_amount numeric default 0,percent_master numeric,percent_salon numeric,
  master_share numeric default 0,salon_share numeric default 0,hours_worked numeric check(hours_worked between 0 and 24),
  hourly_rate numeric,guaranteed_amount numeric default 0,topup_amount numeric default 0,late_minutes integer default 0,
  unique(staff_id,shift_date));
 create table public.staff_shift_items(id uuid primary key default gen_random_uuid(),shift_id uuid references staff_shifts,
  client_name text,service_name text,service_amount numeric not null default 0 check(service_amount>=0),
  consumables_amount numeric not null default 0 check(consumables_amount>=0),booking_id uuid references bookings,note text,created_at timestamptz default now());
 `);
 const load=async name=>fs.readFile(new URL(`../../supabase/migrations/${name}`,import.meta.url),'utf8');
 await sql(await load('20250102000000_update_booking_status_without_check.sql'));
 await sql(await load('20260125000001_optimize_finance_queries.sql'));
 await sql(await load('20260128000000_fix_nested_aggregate_error.sql'));
 await sql(await load('20260213000001_add_save_shift_items_function.sql'));
 const aggregates=await load('20260212000000_create_shift_aggregates.sql');
 await sql(aggregates.slice(0,aggregates.indexOf('-- Модифицируем функцию')));
 await sql(await load('20260125000000_add_shift_race_condition_protection.sql'));
 await sql(await load('20260312001000_fix_close_staff_shift_safe_v_shift_record.sql'));
 await sql(await load('20260123000000_create_branch_promotions.sql'));
 await sql(await load('20260123000001_add_apply_promotion_function.sql'));
 await sql(await load('20260305000000_create_visit_packages.sql'));
 await sql(await load('20260306000000_visit_package_apply_functions.sql'));
 await sql(await load('20261109090100_tenant_finance_rpc_guards.sql'));
 await sql(await load('20261109091100_atomic_shift_commands.sql'));
 await sql(await load('20261110100000_finance_draft_revision.sql'));
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

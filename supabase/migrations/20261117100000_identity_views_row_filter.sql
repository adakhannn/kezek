-- Owner-rights views over auth.users and role rows were selectable by every signed-in
-- account: GET /rest/v1/auth_users_view returned e-mail, phone and name of all users, and
-- user_roles_with_user / user_roles_legacy listed every owner, manager and super admin.
-- (20260307000000 revoked only anon and left authenticated "for compatibility".)
--
-- A row filter closes the exposure without breaking the existing consumers:
--   * RLS policies on rating_* and finance_settings_audit_log read only the caller's own rows;
--   * members_of_biz and finance_is_platform_admin are SECURITY DEFINER (current_user = owner);
--   * server code reads the views with the service-role key;
--   * /admin/api/users/search reads auth_users_view under a super-admin session.
-- Column lists, owners and grants are unchanged: CREATE OR REPLACE VIEW keeps privileges.
begin;

create or replace view public.auth_users_view as
select u.id,
       u.email,
       u.phone,
       nullif(u.raw_user_meta_data ->> 'full_name', '') as full_name,
       u.created_at,
       exists (select 1 from public.user_suspensions s where s.user_id = u.id) as is_suspended
  from auth.users u
 where u.id = (select auth.uid())
    or current_user in ('postgres', 'service_role', 'supabase_admin')
    or (select public.is_super_admin());

create or replace view public.user_roles_with_user as
select ur.user_id,
       ur.biz_id,
       r.key as role_key,
       r.name as role_name,
       au.email,
       au.phone,
       nullif(au.raw_user_meta_data ->> 'full_name', '') as full_name
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  left join auth.users au on au.id = ur.user_id
 where ur.user_id = (select auth.uid())
    or current_user in ('postgres', 'service_role', 'supabase_admin')
    or (select public.is_super_admin());

create or replace view public.user_roles_legacy as
select ur.user_id,
       ur.biz_id,
       r.key as role
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
 where ur.user_id = (select auth.uid())
    or current_user in ('postgres', 'service_role', 'supabase_admin')
    or (select public.is_super_admin());

commit;

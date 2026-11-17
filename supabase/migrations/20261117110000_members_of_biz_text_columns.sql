-- members_of_biz declares text columns but returned auth.users.email as varchar(255):
-- RETURN QUERY failed with 42804 ("structure of query does not match function result
-- type") on every call. /admin/api/businesses/[id]/members/list only worked through a
-- fallback that read user_roles_with_user with the caller's session; that fallback was
-- removed on 2026-11-17 together with the identity view row filter.
-- Same signature, security, search_path and grants; only the result columns are cast.
create or replace function public.members_of_biz(p_biz_id uuid)
returns table(user_id uuid, email text, phone text, full_name text, roles text[])
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  -- доступ: глобальный супер или владелец/админ конкретного бизнеса
  if not ( public.is_super_admin()
           or public.has_role('owner'::text, p_biz_id)
           or public.has_role('admin'::text, p_biz_id) ) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  return query
  select
    u.user_id,
    u.email::text,
    u.phone::text,
    u.full_name::text,
    array_agg(distinct u.role_key order by u.role_key)::text[] as roles
  from public.user_roles_with_user u
  where u.biz_id = p_biz_id
  group by u.user_id, u.email, u.phone, u.full_name
  order by coalesce(u.full_name, u.email::text, u.phone, u.user_id::text);
end;
$$;

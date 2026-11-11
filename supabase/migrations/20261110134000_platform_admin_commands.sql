-- One checked command updates the effective platform role across all supported stores.
-- It does not cover separate Auth deletion/suspension workflows.
begin;
create function public.set_platform_admin_role(p_actor_id uuid,p_target_user_id uuid,p_enabled boolean)
returns boolean language plpgsql security definer set search_path=pg_catalog,public set lock_timeout='5s' as $$
declare v_role_id uuid; effective boolean;
begin
  if coalesce(nullif(current_setting('role',true),'none'),session_user) not in ('service_role','postgres','supabase_admin') then
    raise exception using errcode='42501',message='PLATFORM_ADMIN_SERVICE_ONLY';
  end if;
  if p_actor_id is null or p_target_user_id is null or p_enabled is null then
    raise exception using errcode='22023',message='PLATFORM_ADMIN_INVALID_INPUT';
  end if;
  -- All grant/revoke commands share this lock, including concurrent self-revocations.
  perform pg_advisory_xact_lock(184207,1);
  perform 1 from auth.users where id in (p_actor_id,p_target_user_id) order by id for update;
  if not exists(select 1 from auth.users where id=p_actor_id) or not public.finance_is_platform_admin(p_actor_id) then
    raise exception using errcode='42501',message='PLATFORM_ADMIN_FORBIDDEN';
  end if;
  if not exists(select 1 from auth.users where id=p_target_user_id) then
    raise exception using errcode='P0002',message='PLATFORM_ADMIN_TARGET_NOT_FOUND';
  end if;
  if not p_enabled and p_actor_id=p_target_user_id and not exists (
    select 1 from (
      select g.user_id from public.user_global_roles g join public.roles r on r.id=g.role_id where r.scope='platform' and r.key='super_admin'
      union select user_id from public.super_admins_legacy
      union select u.user_id from public.user_roles u join public.roles r on r.id=u.role_id where u.biz_id is null and r.key='super_admin'
    ) candidates join auth.users a on a.id=candidates.user_id where a.id<>p_target_user_id
  ) then raise exception using errcode='P0001',message='PLATFORM_ADMIN_LAST_ADMIN'; end if;

  if p_enabled then
    select id into v_role_id from public.roles where key='super_admin' and scope='platform' for share;
    if v_role_id is null then raise exception 'PLATFORM_ADMIN_ROLE_NOT_CONFIGURED'; end if;
    insert into public.user_global_roles(user_id,role_id) values(p_target_user_id,v_role_id)
      on conflict(user_id,role_id) do nothing;
  else
    delete from public.user_global_roles g using public.roles r
      where g.user_id=p_target_user_id and g.role_id=r.id and r.scope='platform' and r.key='super_admin';
    delete from public.user_roles u using public.roles r
      where u.user_id=p_target_user_id and u.role_id=r.id and u.biz_id is null and r.key='super_admin';
    delete from public.super_admins_legacy where user_id=p_target_user_id;
  end if;
  effective:=public.finance_is_platform_admin(p_target_user_id);
  if effective is distinct from p_enabled then raise exception 'PLATFORM_ADMIN_STATE_UNCONFIRMED'; end if;
  return effective;
end;
$$;
revoke all on function public.set_platform_admin_role(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.set_platform_admin_role(uuid,uuid,boolean) to service_role;

-- Bounded, authoritative target flags for administrative lists/details. The
-- caller-session permission check remains separate; this trusted service read
-- rechecks its verified actor and never infers identity from a target argument.
create function public.read_platform_admin_states(p_actor_id uuid,p_target_ids uuid[])
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare result jsonb;
begin
  if coalesce(nullif(current_setting('role',true),'none'),session_user) not in ('service_role','postgres','supabase_admin') then
    raise exception using errcode='42501',message='PLATFORM_ADMIN_SERVICE_ONLY';
  end if;
  if p_actor_id is null or p_target_ids is null or cardinality(p_target_ids)>200 or array_position(p_target_ids,null) is not null then
    raise exception using errcode='22023',message='PLATFORM_ADMIN_INVALID_INPUT';
  end if;
  if not exists(select 1 from auth.users where id=p_actor_id) or not public.finance_is_platform_admin(p_actor_id) then
    raise exception using errcode='42501',message='PLATFORM_ADMIN_FORBIDDEN';
  end if;
  select coalesce(jsonb_object_agg(target::text,public.finance_is_platform_admin(target)),'{}'::jsonb)
    into result from (select distinct unnest(p_target_ids) as target) ids;
  return result;
end;
$$;
revoke all on function public.read_platform_admin_states(uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.read_platform_admin_states(uuid,uuid[]) to service_role;
commit;

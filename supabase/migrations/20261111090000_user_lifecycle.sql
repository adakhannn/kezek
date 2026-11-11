-- ENG-31. Auth owns identity writes; its transaction also commits the lifecycle
-- receipt, suspension and FK cleanup. No destructive application-side prework.
begin;

create table public.user_lifecycle_commands (
  user_id uuid primary key, -- Deliberately survives Auth deletion as a receipt.
  command_id uuid not null unique default gen_random_uuid(),
  actor_id uuid not null,
  action text not null check(action in ('block','unblock','delete')),
  reason text check(length(reason)<=500),
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
alter table public.user_lifecycle_commands enable row level security;
revoke all on public.user_lifecycle_commands from public,anon,authenticated,service_role;

-- Preserve the suspension if its author is later removed.
alter table public.user_suspensions drop constraint user_suspensions_created_by_fkey;
alter table public.user_suspensions add constraint user_suspensions_created_by_fkey
  foreign key(created_by) references auth.users(id) on delete set null;

create function public.prepare_user_lifecycle(p_actor_id uuid,p_user_id uuid,p_action text,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public set lock_timeout='5s' as $$
declare c public.user_lifecycle_commands;
begin
  if coalesce(nullif(current_setting('role',true),'none'),session_user) not in ('service_role','postgres','supabase_admin') then
    raise exception 'USER_LIFECYCLE_SERVICE_ONLY' using errcode='42501';
  end if;
  if p_actor_id is null or p_user_id is null or p_action is null or p_action not in ('block','unblock','delete') or length(p_reason)>500 then
    raise exception 'USER_LIFECYCLE_INVALID_INPUT' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(184207,1);
  if not exists(select 1 from auth.users where id=p_actor_id and coalesce(banned_until,now())<=now())
    or exists(select 1 from public.user_suspensions where user_id=p_actor_id)
    or not public.finance_is_platform_admin(p_actor_id) then
    raise exception 'USER_LIFECYCLE_FORBIDDEN' using errcode='42501';
  end if;
  if p_actor_id=p_user_id then raise exception 'USER_LIFECYCLE_SELF' using errcode='22023'; end if;
  select * into c from public.user_lifecycle_commands where user_id=p_user_id for update;
  if found and c.action=p_action and c.reason is not distinct from p_reason then
    -- Another verified administrator can recover an unfinished command after
    -- its original actor loses access. The operation identity stays unchanged.
    if not c.completed then update public.user_lifecycle_commands set actor_id=p_actor_id where user_id=p_user_id; end if;
    return jsonb_build_object('commandId',c.command_id,'completed',c.completed,'action',c.action);
  end if;
  if c.user_id is not null and not c.completed then raise exception 'USER_LIFECYCLE_PENDING' using errcode='P0001'; end if;
  if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'USER_LIFECYCLE_NOT_FOUND' using errcode='P0002'; end if;
  if public.finance_is_platform_admin(p_user_id) then raise exception 'USER_LIFECYCLE_PROTECTED' using errcode='P0001'; end if;
  if p_action='delete' and exists(select 1 from public.businesses where owner_id=p_user_id) then
    raise exception 'USER_LIFECYCLE_OWNER' using errcode='P0001';
  end if;
  insert into public.user_lifecycle_commands(user_id,actor_id,action,reason)
    values(p_user_id,p_actor_id,p_action,p_reason)
    on conflict(user_id) do update set command_id=gen_random_uuid(),actor_id=excluded.actor_id,
      action=excluded.action,reason=excluded.reason,completed=false,created_at=now(),completed_at=null returning * into c;
  return jsonb_build_object('commandId',c.command_id,'completed',false,'action',c.action);
end;
$$;
revoke all on function public.prepare_user_lifecycle(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.prepare_user_lifecycle(uuid,uuid,text,text) to service_role;

create function public.read_user_lifecycle(p_actor_id uuid,p_user_id uuid,p_command_id uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if coalesce(nullif(current_setting('role',true),'none'),session_user) not in ('service_role','postgres','supabase_admin')
    or not public.finance_is_platform_admin(p_actor_id)
    or not exists(select 1 from auth.users where id=p_actor_id and coalesce(banned_until,now())<=now())
    or exists(select 1 from public.user_suspensions where user_id=p_actor_id) then
    raise exception 'USER_LIFECYCLE_FORBIDDEN' using errcode='42501';
  end if;
  return coalesce((select completed from public.user_lifecycle_commands where user_id=p_user_id and command_id=p_command_id),false);
end;
$$;
revoke all on function public.read_user_lifecycle(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.read_user_lifecycle(uuid,uuid,uuid) to service_role;

create function public.commit_user_lifecycle() returns trigger
language plpgsql security definer set search_path=pg_catalog,public set lock_timeout='5s' as $$
declare c public.user_lifecycle_commands; marker text;
begin
  -- Auth updates app_metadata before banned_until, in the same transaction.
  -- Metadata alone must never complete a command.
  if tg_op='UPDATE' then
    marker:=new.raw_app_meta_data->>'kezek_lifecycle_command';
    if tg_argv[0]='metadata' and marker is not distinct from (old.raw_app_meta_data->>'kezek_lifecycle_command') then return new; end if;
  end if;
  perform pg_advisory_xact_lock(184207,1);
  select * into c from public.user_lifecycle_commands where user_id=old.id for update;
  -- The existing service-only retention command has its own durable, due
  -- self-deletion request. Preserve that path, with blockers rechecked at the
  -- actual Auth DELETE (not just before its earlier anonymization statements).
  if tg_op='DELETE' and (c.user_id is null or c.completed)
    and coalesce(nullif(current_setting('role',true),'none'),session_user) in ('service_role','postgres','supabase_admin') then
    perform 1 from public.account_deletion_requests where user_id=old.id
      and status='pending' and scheduled_for<=now() for update;
    if found then
      if public.finance_is_platform_admin(old.id)
        or exists(select 1 from public.businesses where owner_id=old.id)
        or exists(select 1 from public.staff where user_id=old.id)
        or exists(select 1 from public.user_roles where user_id=old.id)
        or exists(select 1 from public.user_global_roles where user_id=old.id)
        or exists(select 1 from public.branch_admins where user_id=old.id)
        or exists(select 1 from public.bookings where client_id=old.id and status in ('hold','confirmed','paid') and start_at>=now()) then
        raise exception 'USER_LIFECYCLE_DELETION_BLOCKED';
      end if;
      return old;
    end if;
  end if;
  if c.user_id is null or c.completed or (tg_op='DELETE' and c.action<>'delete')
    or (tg_op='UPDATE' and (c.action='delete' or marker is distinct from c.command_id::text)) then
    raise exception 'USER_LIFECYCLE_COMMAND_REQUIRED';
  end if;
  if not exists(select 1 from auth.users where id=c.actor_id and coalesce(banned_until,now())<=now())
    or exists(select 1 from public.user_suspensions where user_id=c.actor_id)
    or not public.finance_is_platform_admin(c.actor_id) then raise exception 'USER_LIFECYCLE_FORBIDDEN'; end if;
  if c.actor_id=old.id or public.finance_is_platform_admin(old.id) then raise exception 'USER_LIFECYCLE_PROTECTED'; end if;
  if tg_op='DELETE' then
    if exists(select 1 from public.businesses where owner_id=old.id) then raise exception 'USER_LIFECYCLE_OWNER'; end if;
    -- FK SET NULL preserves staff, bookings and finance history. No profile or
    -- role is removed unless the Auth DELETE transaction itself succeeds.
    delete from public.branch_admins where user_id=old.id;
    update public.staff set is_active=false where user_id=old.id;
  else
    if tg_argv[0]='metadata' then return new; end if;
    if (c.action='block') is distinct from coalesce(new.banned_until>now(),false) then raise exception 'USER_LIFECYCLE_STATE_MISMATCH'; end if;
    if c.action='block' then
      insert into public.user_suspensions(user_id,reason,created_by) values(old.id,c.reason,c.actor_id)
        on conflict(user_id) do update set reason=excluded.reason,created_by=excluded.created_by,created_at=now();
      -- Auth v2.180 Ban does not revoke sessions. Delete only this user's sessions;
      -- refresh tokens linked to them cascade. This runs inside the ban transaction.
      delete from auth.refresh_tokens where user_id=old.id::text;
      delete from auth.sessions where user_id=old.id;
    else
      delete from public.user_suspensions where user_id=old.id;
    end if;
  end if;
  update public.user_lifecycle_commands set completed=true,completed_at=now() where user_id=old.id;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.commit_user_lifecycle() from public,anon,authenticated,service_role;
create trigger kezek_user_lifecycle_metadata before update of raw_app_meta_data on auth.users
  for each row execute function public.commit_user_lifecycle('metadata');
create trigger kezek_user_lifecycle before update of banned_until or delete on auth.users
  for each row execute function public.commit_user_lifecycle('commit');

-- Serialize role/ownership assignments against lifecycle commands, including
-- writers outside set_platform_admin_role. Existing role/owner rules still run.
create function public.guard_user_lifecycle_assignment() returns trigger
language plpgsql security definer set search_path=pg_catalog,public set lock_timeout='5s' as $$
declare target uuid;
begin
  if tg_table_name='businesses' then target:=new.owner_id; else target:=new.user_id; end if;
  if target is null then return new; end if;
  perform pg_advisory_xact_lock(184207,1);
  if not exists(select 1 from auth.users where id=target)
    or exists(select 1 from public.user_suspensions where user_id=target)
    or exists(select 1 from public.user_lifecycle_commands where user_id=target and not completed) then
    raise exception 'USER_LIFECYCLE_ASSIGNMENT_BLOCKED';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_user_lifecycle_assignment() from public,anon,authenticated,service_role;
create trigger kezek_lifecycle_assignment before insert or update on public.branch_admins for each row execute function public.guard_user_lifecycle_assignment();
create trigger kezek_lifecycle_assignment before insert or update on public.user_roles for each row execute function public.guard_user_lifecycle_assignment();
create trigger kezek_lifecycle_assignment before insert or update on public.user_global_roles for each row execute function public.guard_user_lifecycle_assignment();
create trigger kezek_lifecycle_assignment before insert or update on public.super_admins_legacy for each row execute function public.guard_user_lifecycle_assignment();
create trigger kezek_lifecycle_assignment before insert or update of owner_id on public.businesses for each row execute function public.guard_user_lifecycle_assignment();

-- Close a login/refresh racing a ban after Auth loaded an older user snapshot.
create function public.guard_user_lifecycle_session() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
declare until_time timestamptz;
begin
  select banned_until into until_time from auth.users where id=new.user_id for share;
  if not found or until_time>now() or exists(select 1 from public.user_suspensions where user_id=new.user_id) then
    raise exception 'USER_SUSPENDED' using errcode='42501';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_user_lifecycle_session() from public,anon,authenticated,service_role;
create trigger kezek_lifecycle_session before insert on auth.sessions for each row execute function public.guard_user_lifecycle_session();

-- Legacy suspension rows predate Auth ban/session revocation. Keep their
-- existing business data, revoke live sessions, and let the insert guard deny
-- new sessions until explicit unblock. No guessed reconstruction of lost roles.
delete from auth.refresh_tokens r using public.user_suspensions s where r.user_id=s.user_id::text;
delete from auth.sessions a using public.user_suspensions s where a.user_id=s.user_id;

-- JWTs are stateless: Auth revocation alone does not protect PostgREST/RLS.
create function public.user_lifecycle_access_allowed() returns boolean
language sql stable security definer set search_path=pg_catalog,public as $$
  select auth.uid() is null or exists (
    select 1 from auth.users u where u.id=auth.uid() and coalesce(u.banned_until,now())<=now()
      and not exists(select 1 from public.user_suspensions s where s.user_id=u.id)
      and (not exists(select 1 from public.user_lifecycle_commands c where c.user_id=u.id)
        or exists(select 1 from auth.sessions s where s.user_id=u.id and s.id::text=auth.jwt()->>'session_id'))
  );
$$;
revoke all on function public.user_lifecycle_access_allowed() from public;
grant execute on function public.user_lifecycle_access_allowed() to anon,authenticated,service_role;
create function public.check_user_lifecycle_request() returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if not public.user_lifecycle_access_allowed() then raise exception 'USER_SESSION_REVOKED' using errcode='42501'; end if;
end;
$$;
revoke all on function public.check_user_lifecycle_request() from public;
grant execute on function public.check_user_lifecycle_request() to anon,authenticated,service_role;
-- Refuse to silently replace an operator's existing pre-request hook.
do $$
declare existing text; t record;
begin
  select split_part(setting,'=',2) into existing from pg_roles r,
    unnest(r.rolconfig) setting where r.rolname='authenticator' and setting like 'pgrst.db_pre_request=%';
  if existing is not null and existing<>'' and existing<>'public.check_user_lifecycle_request' then
    raise exception 'Integrate existing PostgREST pre-request hook before applying ENG-31';
  end if;
  if exists(select 1 from pg_db_role_setting d,unnest(d.setconfig) setting
    where d.setrole in (0,(select oid from pg_roles where rolname='authenticator'))
      and d.setdatabase in (0,(select oid from pg_database where datname=current_database()))
      and setting like 'pgrst.db_pre_request=%'
      and split_part(setting,'=',2) not in ('','public.check_user_lifecycle_request')) then
    raise exception 'Integrate database-level PostgREST pre-request hook before applying ENG-31';
  end if;
  alter role authenticator set pgrst.db_pre_request='public.check_user_lifecycle_request';
  for t in select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in ('public','storage') and c.relkind in ('r','p') and c.relrowsecurity
  loop
    execute format('create policy kezek_lifecycle_access on %I.%I as restrictive for all to authenticated using ((select public.user_lifecycle_access_allowed())) with check ((select public.user_lifecycle_access_allowed()))',t.nspname,t.relname);
  end loop;
end;
$$;
notify pgrst,'reload config';
notify pgrst,'reload schema';
commit;

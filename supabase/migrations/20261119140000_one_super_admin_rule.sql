-- One rule for who is a platform super admin (17 Nov review, docs/PROJECT_REVIEW_2026-11-17.md DB-10).
--
-- A super admin can be recorded in three places: user_global_roles (the platform role),
-- super_admins_legacy and user_roles with biz_id null. is_super_admin(), which the policies use,
-- accepts all three. The other checks looked at user_roles only: the trigger that keeps the last super
-- admin (guard_last_super_admin, on user_roles deletes only), the recipients of role-application
-- notifications and the account-deletion blocker in the application. A super admin recorded only in
-- user_global_roles could therefore be removed as the last one, missed the notifications, and the
-- removal of the user_roles row did not end the access is_super_admin still granted.
--
-- private.super_admin_ids() is the same rule as is_super_admin() as a set of accounts (an isolated
-- suite checks that they agree for every store). The last-super-admin guard now protects deletes and
-- updates in all three stores and counts every store; the application reads the recipients and the
-- blocker through super_admin_user_ids(), service role only. is_super_admin() itself is unchanged.

create or replace function private.super_admin_ids()
returns setof uuid
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
    select g.user_id
      from public.user_global_roles g
      join public.roles r on r.id = g.role_id
     where r.scope = 'platform' and r.key = 'super_admin'
    union
    select l.user_id from public.super_admins_legacy l
    union
    select u.user_id
      from public.user_roles u
      join public.roles r on r.id = u.role_id
     where u.biz_id is null and r.key = 'super_admin';
$$;

revoke all on function private.super_admin_ids() from public;

create or replace function public.super_admin_user_ids()
returns uuid[]
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
    select coalesce(array_agg(id order by id), '{}') from private.super_admin_ids() id;
$$;

revoke all on function public.super_admin_user_ids() from public, anon, authenticated;
grant execute on function public.super_admin_user_ids() to service_role;

-- A change that takes the role from an account is refused when no super admin would remain. Rows of
-- the same statement processed earlier are already visible here, so a multi-row delete is counted.
create or replace function private.guard_last_super_admin()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
    v_role uuid;
    v_grants boolean;
    v_keeps boolean;
begin
    select id into v_role from public.roles where key = 'super_admin';
    if tg_table_name = 'user_roles' then
        v_grants := old.role_id = v_role and old.biz_id is null;
    elsif tg_table_name = 'user_global_roles' then
        v_grants := old.role_id = v_role;
    else
        v_grants := true;
    end if;
    v_keeps := false;
    if tg_op = 'UPDATE' then
        if tg_table_name = 'user_roles' then
            v_keeps := new.role_id = v_role and new.biz_id is null and new.user_id = old.user_id;
        elsif tg_table_name = 'user_global_roles' then
            v_keeps := new.role_id = v_role and new.user_id = old.user_id;
        else
            v_keeps := new.user_id = old.user_id;
        end if;
    end if;
    if v_role is not null and coalesce(v_grants, false) and not coalesce(v_keeps, false) and not (
        -- another account keeps the role, or this account keeps it through another store
        exists (select 1 from private.super_admin_ids() s where s <> old.user_id)
        or (tg_table_name <> 'user_roles' and exists (select 1 from public.user_roles u
            where u.user_id = old.user_id and u.role_id = v_role and u.biz_id is null))
        or (tg_table_name <> 'user_global_roles' and exists (select 1 from public.user_global_roles g
            where g.user_id = old.user_id and g.role_id = v_role))
        or (tg_table_name <> 'super_admins_legacy' and exists (select 1 from public.super_admins_legacy l
            where l.user_id = old.user_id))
    ) then
        raise exception using errcode = 'P0001', message = 'Нельзя удалить последнего super_admin';
    end if;
    if tg_op = 'DELETE' then
        return old;
    end if;
    return new;
end;
$$;

-- A trigger function: nobody calls it directly.
revoke all on function private.guard_last_super_admin() from public;

drop trigger if exists trg_guard_last_super_admin on public.user_roles;
drop function if exists public.guard_last_super_admin();

drop trigger if exists guard_last_super_admin on public.user_roles;
create trigger guard_last_super_admin
    before delete or update on public.user_roles
    for each row execute function private.guard_last_super_admin();
drop trigger if exists guard_last_super_admin on public.user_global_roles;
create trigger guard_last_super_admin
    before delete or update on public.user_global_roles
    for each row execute function private.guard_last_super_admin();
drop trigger if exists guard_last_super_admin on public.super_admins_legacy;
create trigger guard_last_super_admin
    before delete or update on public.super_admins_legacy
    for each row execute function private.guard_last_super_admin();

-- Client sessions (anon / authenticated through PostgREST) could write where only the service
-- role or checked commands should. Found by the 17 Nov schema review and confirmed in production
-- with rolled-back probes (docs/PROJECT_REVIEW_2026-11-17.md, DB-01..DB-05):
--   * user_suspensions_srv_all (FOR ALL TO public, USING service role, WITH CHECK true) let
--     anyone, anon included, INSERT a suspension for any user; a suspension blocks every request
--     and the sign-in of that user. The service role bypasses RLS, so the policy served only
--     clients.
--   * auth_users_view, an auto-updatable view over auth.users owned by postgres, kept INSERT,
--     UPDATE and DELETE for anon and authenticated: visitors could create auth users, users could
--     change their e-mail and phone without verification or delete their auth row. Client roles
--     lose write privileges on every project view.
--   * "Staff can update own profile" let staff set their own percent_master, percent_salon,
--     hourly_rate (read by shift close), is_active and biz_id. Client writes to staff now pass
--     staff_guard_client_write(): only managers of the business (finance_can_manage_business)
--     create staff or change the account link, activity, contacts and pay terms; biz_id and the
--     rating fields never change from a client session; clients no longer delete staff (the
--     cascade reaches bookings and finance).
--   * Owners, admins and managers could update any column of businesses (owner_id, is_approved,
--     branch_limit, rating_score, plan) and delete the business. The application writes
--     businesses only with the service role, so clients lose INSERT, UPDATE and DELETE.
--   * grant_role_rpc / revoke_role_rpc let any owner, admin or manager grant or revoke any role,
--     owner and super_admin included. They, assign_business_owner (owner transfer under the
--     caller's RLS) and delete_business_cascade have no callers and are dropped.
--   * cat_remove_slug / cat_replace_slug required is_super_admin(), which is false for the service
--     role the admin routes use, and failed when more than one business had the category
--     (UPDATE ... RETURNING INTO). They now serve the service role only and count with ROW_COUNT.
--   * TRUNCATE (not subject to RLS), REFERENCES, TRIGGER and MAINTAIN are withdrawn from client
--     roles on project tables and views, and from the defaults for new tables.
--   * find_accounts_by_contact() (service role only) finds accounts by a complete, confirmed
--     e-mail or phone, so manager lookups no longer page through every Auth user (API-01).
begin;

drop policy if exists user_suspensions_srv_all on public.user_suspensions;
revoke insert, update, delete on table public.user_suspensions from public, anon, authenticated;

do $$
declare
    v_rel regclass;
    v_kind "char";
begin
    for v_rel, v_kind in
        select c.oid::regclass, c.relkind
          from pg_class c
         where c.relnamespace = 'public'::regnamespace
           and c.relkind in ('r', 'p', 'v', 'm', 'f')
           and pg_get_userbyid(c.relowner) = current_user
    loop
        execute format('revoke truncate, references, trigger on table %s from public, anon, authenticated', v_rel);
        if current_setting('server_version_num')::integer >= 170000 then
            execute format('revoke maintain on table %s from public, anon, authenticated', v_rel);
        end if;
        if v_kind in ('v', 'm') then
            execute format('revoke insert, update, delete on table %s from public, anon, authenticated', v_rel);
        end if;
    end loop;

    execute 'alter default privileges in schema public revoke truncate, references, trigger on tables from anon, authenticated';
    if current_setting('server_version_num')::integer >= 170000 then
        execute 'alter default privileges in schema public revoke maintain on tables from anon, authenticated';
    end if;
end $$;

-- staff
create or replace function public.staff_write_allowed(p_biz_id uuid, p_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
    select coalesce(public.finance_can_manage_business(auth.uid(), p_biz_id), false)
       and (p_branch_id is null or exists (
            select 1 from public.branches b where b.id = p_branch_id and b.biz_id = p_biz_id));
$$;

revoke all on function public.staff_write_allowed(uuid, uuid) from public, anon;
grant execute on function public.staff_write_allowed(uuid, uuid) to authenticated, service_role;

-- SECURITY INVOKER on purpose: current_user is the client role for PostgREST writes and the
-- function owner inside SECURITY DEFINER commands, which stay unrestricted.
create or replace function public.staff_guard_client_write()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
    if current_user not in ('anon', 'authenticated') then
        return new;
    end if;

    if tg_op = 'INSERT' then
        if not public.staff_write_allowed(new.biz_id, new.branch_id) then
            raise exception 'STAFF_WRITE_FORBIDDEN' using errcode = '42501';
        end if;
        new.rating_score := null;
        new.rating_updated_at := null;
        new.last_rating_recalculated_at := null;
        return new;
    end if;

    if new.id is distinct from old.id
       or new.biz_id is distinct from old.biz_id
       or new.created_at is distinct from old.created_at
       or new.rating_score is distinct from old.rating_score
       or new.rating_updated_at is distinct from old.rating_updated_at
       or new.last_rating_recalculated_at is distinct from old.last_rating_recalculated_at then
        raise exception 'STAFF_FIELD_READ_ONLY' using errcode = '42501';
    end if;

    if (new.user_id, new.branch_id, new.is_active, new.email, new.phone,
        new.percent_master, new.percent_salon, new.hourly_rate)
       is distinct from
       (old.user_id, old.branch_id, old.is_active, old.email, old.phone,
        old.percent_master, old.percent_salon, old.hourly_rate)
       and not public.staff_write_allowed(old.biz_id, new.branch_id) then
        raise exception 'STAFF_WRITE_FORBIDDEN' using errcode = '42501';
    end if;

    return new;
end;
$$;

revoke all on function public.staff_guard_client_write() from public, anon, authenticated;

drop trigger if exists staff_guard_client_write on public.staff;
create trigger staff_guard_client_write
    before insert or update on public.staff
    for each row execute function public.staff_guard_client_write();

drop policy if exists "Staff can update own profile" on public.staff;
revoke insert, update, delete on table public.staff from anon;
revoke delete on table public.staff from authenticated;

-- businesses
drop policy if exists "Business owners can update own businesses" on public.businesses;
drop policy if exists "update business by role" on public.businesses;
revoke insert, update, delete on table public.businesses from public, anon, authenticated;

-- roles and dead write helpers
drop function if exists public.grant_role_rpc(uuid, uuid, text);
drop function if exists public.revoke_role_rpc(uuid, uuid, text);
drop function if exists public.assign_business_owner(uuid, uuid);
drop function if exists public.delete_business_cascade(uuid);

-- category slug maintenance (admin routes, service role)
create or replace function public.cat_remove_slug(the_slug text)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
    v_count integer;
begin
    if coalesce(auth.role(), '') <> 'service_role' then
        raise exception 'forbidden' using errcode = 'P0001';
    end if;

    update public.businesses
       set categories = array(
               select x from unnest(coalesce(categories, '{}'::text[])) as t(x) where x <> the_slug)
     where categories @> array[the_slug];
    get diagnostics v_count = row_count;
    return v_count;
end;
$$;

create or replace function public.cat_replace_slug(old_slug text, new_slug text)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
    v_count integer;
begin
    if coalesce(auth.role(), '') <> 'service_role' then
        raise exception 'forbidden' using errcode = 'P0001';
    end if;

    update public.businesses
       set categories = array(
               select case when x = old_slug then new_slug else x end
                 from unnest(coalesce(categories, '{}'::text[])) as t(x))
     where categories @> array[old_slug];
    get diagnostics v_count = row_count;
    return v_count;
end;
$$;

revoke all on function public.cat_remove_slug(text), public.cat_replace_slug(text, text) from public, anon, authenticated;
grant execute on function public.cat_remove_slug(text), public.cat_replace_slug(text, text) to service_role;

-- Exact account lookup by a confirmed contact (GoTrue stores phones as digits without '+').
create or replace function public.find_accounts_by_contact(p_email text default null, p_phone_digits text default null)
returns table (id uuid, email text, phone text, full_name text)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
    select u.id, u.email::text, u.phone::text, nullif(u.raw_user_meta_data ->> 'full_name', '')
      from auth.users u
     where u.deleted_at is null
       and ((nullif(btrim(p_email), '') is not null
             and lower(u.email) = lower(btrim(p_email))
             and u.email_confirmed_at is not null)
         or (nullif(p_phone_digits, '') is not null
             and u.phone in (p_phone_digits, '+' || p_phone_digits)
             and u.phone_confirmed_at is not null))
     order by u.created_at
     limit 5;
$$;

revoke all on function public.find_accounts_by_contact(text, text) from public, anon, authenticated;
grant execute on function public.find_accounts_by_contact(text, text) to service_role;

commit;

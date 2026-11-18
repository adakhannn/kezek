-- The super-admin user directory read one Auth page (17 Nov review,
-- docs/PROJECT_REVIEW_2026-11-17.md ARCH-03): /admin/api/users/list fetched one listUsers page
-- (newest first) and filtered it in JavaScript, so a search found only users of the current page
-- and the total was (page - 1) * perPage + matches on this page; the statistics paged the whole
-- directory over HTTP on every view. Two service-only reads replace both: search over the whole
-- directory (e-mail, phone, name, id; LIKE characters are literal), the status filter, a stable
-- order, the real total, and the counts. Both require a verified platform administrator as actor,
-- like read_platform_admin_states.
begin;

create or replace function public.admin_list_users(
    p_actor_id uuid,
    p_q text default null,
    p_status text default 'all',
    p_limit integer default 50,
    p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
    v_q text := left(nullif(btrim(coalesce(p_q, '')), ''), 200);
    v_status text := coalesce(p_status, 'all');
    v_pattern text;
    v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
    v_offset integer := least(greatest(coalesce(p_offset, 0), 0), 1000000);
    v_result jsonb;
begin
    if coalesce(nullif(current_setting('role', true), 'none'), session_user) not in ('service_role', 'postgres', 'supabase_admin') then
        raise exception using errcode = '42501', message = 'ADMIN_USERS_SERVICE_ONLY';
    end if;
    if p_actor_id is null
       or not exists (select 1 from auth.users where id = p_actor_id)
       or not public.finance_is_platform_admin(p_actor_id) then
        raise exception using errcode = '42501', message = 'ADMIN_USERS_FORBIDDEN';
    end if;
    if v_status not in ('all', 'active', 'blocked') then
        raise exception using errcode = '22023', message = 'ADMIN_USERS_BAD_STATUS';
    end if;
    if v_q is not null then
        -- a literal substring: the backslash is the LIKE escape character
        v_pattern := '%' || replace(replace(replace(v_q, chr(92), chr(92) || chr(92)), '%', chr(92) || '%'), '_', chr(92) || '_') || '%';
    end if;

    with matched as (
        select u.id,
               u.email::text as email,
               u.phone::text as phone,
               u.last_sign_in_at,
               u.created_at,
               coalesce(nullif(btrim(p.full_name), ''), nullif(btrim(u.raw_user_meta_data ->> 'full_name'), '')) as full_name,
               s.user_id is not null as is_blocked,
               s.reason as block_reason
          from auth.users u
          left join public.profiles p on p.id = u.id
          left join lateral (
              select us.user_id, us.reason
                from public.user_suspensions us
               where us.user_id = u.id
               order by us.created_at desc
               limit 1) s on true
         where u.deleted_at is null
           and (v_status = 'all'
                or (v_status = 'blocked' and s.user_id is not null)
                or (v_status = 'active' and s.user_id is null))
           and (v_pattern is null
                or coalesce(u.email::text, '') ilike v_pattern
                or coalesce(u.phone::text, '') ilike v_pattern
                or coalesce(nullif(btrim(p.full_name), ''), u.raw_user_meta_data ->> 'full_name', '') ilike v_pattern
                or u.id::text ilike v_pattern)
    )
    select jsonb_build_object(
        'total', (select count(*) from matched),
        'items', coalesce((
            select jsonb_agg(jsonb_build_object(
                       'id', m.id,
                       'full_name', m.full_name,
                       'email', m.email,
                       'phone', m.phone,
                       'last_sign_in_at', m.last_sign_in_at,
                       'is_blocked', m.is_blocked,
                       'block_reason', m.block_reason)
                   order by m.created_at desc nulls last, m.id desc)
              from (select * from matched
                     order by created_at desc nulls last, id desc
                     limit v_limit offset v_offset) m), '[]'::jsonb))
      into v_result;

    return v_result;
end;
$$;

create or replace function public.admin_user_stats(p_actor_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
    v_result jsonb;
begin
    if coalesce(nullif(current_setting('role', true), 'none'), session_user) not in ('service_role', 'postgres', 'supabase_admin') then
        raise exception using errcode = '42501', message = 'ADMIN_USERS_SERVICE_ONLY';
    end if;
    if p_actor_id is null
       or not exists (select 1 from auth.users where id = p_actor_id)
       or not public.finance_is_platform_admin(p_actor_id) then
        raise exception using errcode = '42501', message = 'ADMIN_USERS_FORBIDDEN';
    end if;

    select jsonb_build_object(
               'total', count(*),
               'active', count(*) filter (where not blocked),
               'blocked', count(*) filter (where blocked),
               'super', count(*) filter (where public.finance_is_platform_admin(id)))
      into v_result
      from (select u.id,
                   exists (select 1 from public.user_suspensions s where s.user_id = u.id) as blocked
              from auth.users u
             where u.deleted_at is null) users;

    return v_result;
end;
$$;

revoke all on function public.admin_list_users(uuid, text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.admin_user_stats(uuid) from public, anon, authenticated;
grant execute on function public.admin_list_users(uuid, text, text, integer, integer) to service_role;
grant execute on function public.admin_user_stats(uuid) to service_role;

commit;

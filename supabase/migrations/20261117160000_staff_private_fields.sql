-- Private staff fields (contacts, auth user and pay terms) for the people entitled to them:
-- the staff member, managers of the staff's business (owner/admin/manager role or
-- businesses.owner_id), platform admins and the service role. The application reads these
-- fields only through this function, so 20261117170000 can drop them from the column
-- privileges of `authenticated`, where any signed-in account could read them for every
-- active staff member of an approved business.
create or replace function public.staff_private_fields(p_staff_id uuid)
returns table(
    id uuid,
    biz_id uuid,
    branch_id uuid,
    full_name text,
    email text,
    phone text,
    user_id uuid,
    avatar_url text,
    is_active boolean,
    percent_master numeric,
    percent_salon numeric,
    hourly_rate numeric,
    rating_score numeric
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
    v_staff public.staff%rowtype;
    v_actor uuid := auth.uid();
    v_allowed boolean;
begin
    select * into v_staff from public.staff s where s.id = p_staff_id;
    if not found then
        return;
    end if;

    -- Every term is a definite boolean: a staff row without a linked account (user_id null)
    -- must not slip through a NULL comparison.
    v_allowed := coalesce(auth.role(), '') = 'service_role'
        or (v_actor is not null and v_staff.user_id is not null and v_staff.user_id = v_actor)
        or coalesce(public.finance_can_manage_business(v_actor, v_staff.biz_id), false);
    if not coalesce(v_allowed, false) then
        raise exception 'STAFF_FORBIDDEN' using errcode = '42501';
    end if;

    return query select
        v_staff.id, v_staff.biz_id, v_staff.branch_id, v_staff.full_name, v_staff.email, v_staff.phone,
        v_staff.user_id, v_staff.avatar_url, v_staff.is_active, v_staff.percent_master,
        v_staff.percent_salon, v_staff.hourly_rate, v_staff.rating_score;
end;
$$;

revoke all on function public.staff_private_fields(uuid) from public, anon;
grant execute on function public.staff_private_fields(uuid) to authenticated, service_role;

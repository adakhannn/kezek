-- A single-service authenticated booking must use the effective work location,
-- not the employee's permanent home branch. Preserve the existing identity,
-- contact, confirmation and privilege contracts. The booking trigger remains
-- responsible for serializing writes with schedule publication and live holds.
begin;

create or replace function public.hold_slot(
    p_biz_id uuid, p_branch_id uuid, p_service_id uuid,
    p_staff_id uuid, p_start timestamptz
)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
    v_client_id uuid;
    v_client_name text;
    v_client_phone text;
    v_client_email text;
    v_service_duration_min int;
    v_end timestamptz;
    v_booking_id uuid;
begin
    v_client_id := auth.uid();
    if v_client_id is null then
        raise exception 'User must be authenticated';
    end if;

    select coalesce(p.full_name, u.raw_user_meta_data->>'full_name', u.email),
           coalesce(p.phone, u.phone), u.email
    into v_client_name, v_client_phone, v_client_email
    from auth.users u left join public.profiles p on p.id = u.id
    where u.id = v_client_id;
    if not found then raise exception 'User not found'; end if;

    if not exists (select 1 from public.profiles where id = v_client_id) then
        insert into public.profiles (id, full_name, phone)
        values (v_client_id, coalesce(v_client_name, 'Пользователь'), v_client_phone)
        on conflict (id) do nothing;
    end if;

    select duration_min into v_service_duration_min
    from public.services
    where id = p_service_id and biz_id = p_biz_id and active = true;
    if not found then raise exception 'service not found or inactive'; end if;

    if not exists (select 1 from public.staff
        where id = p_staff_id and biz_id = p_biz_id and is_active = true)
    then raise exception 'staff not found or inactive'; end if;

    if not exists (select 1 from public.branches
        where id = p_branch_id and biz_id = p_biz_id and is_active = true)
    then raise exception 'branch not found or inactive'; end if;

    v_end := p_start + (v_service_duration_min || ' minutes')::interval;
    if not public.schedule_contains_booking(p_staff_id, p_branch_id, p_start, v_end)
    then raise exception 'SCHEDULE_OUTSIDE_WORKING_HOURS'; end if;

    if exists (select 1 from public.bookings
        where staff_id = p_staff_id and status in ('confirmed', 'paid')
        and tstzrange(start_at, end_at, '[)') && tstzrange(p_start, v_end, '[)'))
    then raise exception 'time slot is already booked'; end if;

    insert into public.bookings (
        biz_id, branch_id, service_id, staff_id, client_id,
        client_name, client_phone, client_email, start_at, end_at, status, expires_at
    ) values (
        p_biz_id, p_branch_id, p_service_id, p_staff_id, v_client_id,
        v_client_name, v_client_phone, v_client_email, p_start, v_end,
        'confirmed'::booking_status, null
    ) returning id into v_booking_id;
    return v_booking_id;
end;
$$;

comment on function public.hold_slot(uuid,uuid,uuid,uuid,timestamptz) is
    'Authenticated single-service booking: current user contacts, effective schedule work location, breaks and absences; confirmed immediately. Existing serialized booking trigger protects conflicts.';

commit;

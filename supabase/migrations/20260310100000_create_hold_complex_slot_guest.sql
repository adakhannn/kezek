-- Гостевой вариант hold_complex_slot: создание бронирования с комплексом услуг без авторизации.
-- Принимает p_services jsonb и контактные данные гостя (client_name, client_phone, client_email).

create or replace function public.hold_complex_slot_guest(
    p_biz_id uuid,
    p_branch_id uuid,
    p_staff_id uuid,
    p_start timestamptz,
    p_services jsonb,
    p_client_name text,
    p_client_phone text,
    p_client_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_booking_id uuid;
    v_expires_at timestamptz;
    v_total_duration_min integer := 0;
    v_item jsonb;
    v_service_id uuid;
    v_duration_min integer;
    v_order_index integer;
    v_index integer := 0;
    v_end timestamptz;
    v_client_name_trimmed text;
    v_client_phone_trimmed text;
    v_client_email_trimmed text;
begin
    if p_client_name is null or trim(p_client_name) = '' then
        raise exception 'client_name is required';
    end if;
    if p_client_phone is null or trim(p_client_phone) = '' then
        raise exception 'client_phone is required';
    end if;

    v_client_name_trimmed := trim(p_client_name);
    v_client_phone_trimmed := trim(p_client_phone);
    v_client_email_trimmed := case when p_client_email is not null then trim(p_client_email) else null end;

    if not exists (
        select 1 from public.branches
        where id = p_branch_id and biz_id = p_biz_id and is_active = true
    ) then
        raise exception 'branch not found or inactive';
    end if;

    if not exists (
        select 1 from public.staff
        where id = p_staff_id and biz_id = p_biz_id and branch_id = p_branch_id and is_active = true
    ) then
        raise exception 'staff not found or inactive';
    end if;

    if p_services is null or jsonb_typeof(p_services) <> 'array' or jsonb_array_length(p_services) = 0 then
        raise exception 'services array must be a non-empty JSON array';
    end if;

    for v_index in 0 .. jsonb_array_length(p_services) - 1 loop
        v_item := p_services->v_index;
        v_service_id := (v_item->>'service_id')::uuid;
        v_duration_min := (v_item->>'duration_min')::integer;
        v_order_index := coalesce((v_item->>'order_index')::integer, v_index);

        if v_service_id is null then
            raise exception 'service_id is required in services[%]', v_index;
        end if;
        if v_duration_min is null or v_duration_min <= 0 then
            raise exception 'duration_min must be positive in services[%]', v_index;
        end if;

        if not exists (
            select 1 from public.services s
            where s.id = v_service_id and s.biz_id = p_biz_id and s.active = true
        ) then
            raise exception 'service not found or inactive: %', v_service_id;
        end if;

        v_total_duration_min := v_total_duration_min + v_duration_min;
    end loop;

    if v_total_duration_min <= 0 then
        raise exception 'total duration must be positive';
    end if;

    v_end := p_start + (v_total_duration_min || ' minutes')::interval;
    v_expires_at := now() + interval '2 minutes';

    if exists (
        select 1 from public.bookings
        where staff_id = p_staff_id
          and status in ('hold', 'confirmed', 'paid')
          and tstzrange(start_at, end_at, '[)') && tstzrange(p_start, v_end, '[)')
    ) then
        raise exception 'time slot is already booked';
    end if;

    insert into public.bookings (
        biz_id, branch_id, service_id, staff_id,
        client_id, client_name, client_phone, client_email,
        start_at, end_at, status, expires_at
    )
    values (
        p_biz_id, p_branch_id, (p_services->0->>'service_id')::uuid, p_staff_id,
        null, v_client_name_trimmed, v_client_phone_trimmed, v_client_email_trimmed,
        p_start, v_end, 'hold'::booking_status, v_expires_at
    )
    returning id into v_booking_id;

    v_index := 0;
    for v_index in 0 .. jsonb_array_length(p_services) - 1 loop
        v_item := p_services->v_index;
        v_service_id := (v_item->>'service_id')::uuid;
        v_duration_min := (v_item->>'duration_min')::integer;
        v_order_index := coalesce((v_item->>'order_index')::integer, v_index);

        insert into public.booking_services (booking_id, service_id, duration_min, order_index)
        values (v_booking_id, v_service_id, v_duration_min, v_order_index);
    end loop;

    return v_booking_id;
end;
$$;

comment on function public.hold_complex_slot_guest is
    'Создаёт гостевую бронь (без авторизации) для комплекса услуг и заполняет booking_services.';

grant execute on function public.hold_complex_slot_guest(uuid, uuid, uuid, timestamptz, jsonb, text, text, text) to anon;
grant execute on function public.hold_complex_slot_guest(uuid, uuid, uuid, timestamptz, jsonb, text, text, text) to authenticated;

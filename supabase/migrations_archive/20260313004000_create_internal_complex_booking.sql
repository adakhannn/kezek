-- create_internal_complex_booking: внутреннее бронирование комплекса услуг из кабинета сотрудника/владельца.
-- Создаёт бронирование сразу в статусе confirmed и заполняет booking_services.
--
-- Параметры:
--   p_biz_id      - бизнес
--   p_branch_id   - филиал
--   p_staff_id    - мастер
--   p_start       - начало визита (timestamptz в TZ бизнеса)
--   p_services    - JSON-массив услуг: [{ service_id: uuid, duration_min: int, order_index?: int }]
--   p_client_id   - (опционально) id клиента, если есть в CRM
--   p_client_name - имя клиента (как вводит сотрудник)
--   p_client_phone- телефон клиента
--   p_client_email- email клиента (опционально)

create or replace function public.create_internal_complex_booking(
    p_biz_id uuid,
    p_branch_id uuid,
    p_staff_id uuid,
    p_start timestamptz,
    p_services jsonb,
    p_client_id uuid default null,
    p_client_name text default null,
    p_client_phone text default null,
    p_client_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_booking_id uuid;
    v_total_duration_min integer := 0;
    v_item jsonb;
    v_service_id uuid;
    v_duration_min integer;
    v_order_index integer;
    v_index integer := 0;
    v_end timestamptz;
    v_caller_id uuid;
begin
    -- Текущий пользователь (для проверки прав)
    v_caller_id := auth.uid();
    if v_caller_id is null then
        raise exception 'User must be authenticated';
    end if;

    -- Проверка, что пользователь имеет отношение к бизнесу:
    -- либо он сотрудник этого бизнеса, либо имеет роль owner/admin/manager.
    if not exists (
        select 1
        from public.staff s
        where s.user_id = v_caller_id
          and s.biz_id = p_biz_id
          and s.is_active = true
    )
    and not exists (
        select 1
        from public.user_roles ur
        join public.roles r on ur.role_id = r.id
        where ur.user_id = v_caller_id
          and ur.biz_id = p_biz_id
          and r.key in ('owner','admin','manager')
    )
    and not public.is_super_admin()
    then
        raise exception 'no permission to create booking for this business';
    end if;

    -- Проверка филиала
    if not exists (
        select 1
        from public.branches b
        where b.id = p_branch_id
          and b.biz_id = p_biz_id
          and b.is_active = true
    ) then
        raise exception 'branch not found or inactive';
    end if;

    -- Проверка мастера
    if not exists (
        select 1
        from public.staff s
        where s.id = p_staff_id
          and s.biz_id = p_biz_id
          and s.branch_id = p_branch_id
          and s.is_active = true
    ) then
        raise exception 'staff not found or inactive';
    end if;

    -- Валидация и суммирование услуг
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

        -- Проверяем, что услуга существует и активна в этом бизнесе
        if not exists (
            select 1
            from public.services s
            where s.id = v_service_id
              and s.biz_id = p_biz_id
              and s.active = true
        ) then
            raise exception 'service not found or inactive: %', v_service_id;
        end if;

        v_total_duration_min := v_total_duration_min + v_duration_min;
    end loop;

    if v_total_duration_min <= 0 then
        raise exception 'total duration must be positive';
    end if;

    v_end := p_start + (v_total_duration_min || ' minutes')::interval;

    -- Проверка пересечений с существующими бронированиями мастера
    if exists (
        select 1
        from public.bookings b
        where b.staff_id = p_staff_id
          and b.status in ('hold','confirmed','paid')
          and tstzrange(b.start_at, b.end_at, '[)') && tstzrange(p_start, v_end, '[)')
    ) then
        raise exception 'time slot is already booked';
    end if;

    -- Создаём бронирование (service_id = первая услуга комплекса)
    insert into public.bookings (
        biz_id,
        branch_id,
        service_id,
        staff_id,
        client_id,
        client_name,
        client_phone,
        client_email,
        start_at,
        end_at,
        status,
        expires_at
    )
    values (
        p_biz_id,
        p_branch_id,
        (p_services->0->>'service_id')::uuid,
        p_staff_id,
        p_client_id,
        p_client_name,
        p_client_phone,
        p_client_email,
        p_start,
        v_end,
        'confirmed'::booking_status,
        null
    )
    returning id into v_booking_id;

    -- Заполняем booking_services
    for v_index in 0 .. jsonb_array_length(p_services) - 1 loop
        v_item := p_services->v_index;
        v_service_id := (v_item->>'service_id')::uuid;
        v_duration_min := (v_item->>'duration_min')::integer;
        v_order_index := coalesce((v_item->>'order_index')::integer, v_index);

        insert into public.booking_services (
            booking_id,
            service_id,
            duration_min,
            order_index
        )
        values (
            v_booking_id,
            v_service_id,
            v_duration_min,
            v_order_index
        );
    end loop;

    return v_booking_id;
end;
$$;

comment on function public.create_internal_complex_booking(
    uuid, uuid, uuid, timestamptz, jsonb, uuid, text, text, text
) is
    'Создаёт внутреннее бронирование с комплексом услуг (несколько услуг за один визит) сразу в статусе confirmed и заполняет booking_services.';

grant execute on function public.create_internal_complex_booking(
    uuid, uuid, uuid, timestamptz, jsonb, uuid, text, text, text
) to authenticated;


-- Исправление функции hold_slot
-- Создаем бронирования сразу со статусом confirmed, без hold

CREATE OR REPLACE FUNCTION public.hold_slot(
    p_biz_id uuid,
    p_branch_id uuid,
    p_service_id uuid,
    p_staff_id uuid,
    p_start timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
    v_client_id uuid;
    v_client_name text;
    v_client_phone text;
    v_client_email text;
    v_service_duration_min int;
    v_end timestamptz;
    v_booking_id uuid;
begin
    -- Получаем client_id из текущей сессии
    v_client_id := auth.uid();
    
    if v_client_id is null then
        raise exception 'User must be authenticated';
    end if;
    
    -- Получаем данные клиента из профиля
    select 
        full_name,
        phone,
        email
    into 
        v_client_name,
        v_client_phone,
        v_client_email
    from public.profiles
    where id = v_client_id;
    
    if not found then
        raise exception 'User profile not found';
    end if;
    
    -- Проверяем, что услуга существует и активна
    select duration_min into v_service_duration_min
    from public.services
    where id = p_service_id
      and biz_id = p_biz_id
      and active = true;
    
    if not found then
        raise exception 'service not found or inactive';
    end if;
    
    -- Проверяем, что мастер существует и активен
    if not exists (
        select 1
        from public.staff
        where id = p_staff_id
          and biz_id = p_biz_id
          and branch_id = p_branch_id
          and is_active = true
    ) then
        raise exception 'staff not found or inactive';
    end if;
    
    -- Проверяем, что филиал существует и активен
    if not exists (
        select 1
        from public.branches
        where id = p_branch_id
          and biz_id = p_biz_id
          and is_active = true
    ) then
        raise exception 'branch not found or inactive';
    end if;
    
    -- Вычисляем время окончания
    v_end := p_start + (v_service_duration_min || ' minutes')::interval;
    
    -- Проверяем пересечения с существующими бронированиями для этого мастера
    -- Учитываем только подтвержденные (confirmed) и оплаченные (paid) бронирования
    if exists (
        select 1
        from public.bookings
        where staff_id = p_staff_id
          and status in ('confirmed', 'paid')
          and tstzrange(start_at, end_at, '[)') && tstzrange(p_start, v_end, '[)')
    ) then
        raise exception 'time slot is already booked';
    end if;
    
    -- Создаем бронирование сразу со статусом confirmed
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
    ) values (
        p_biz_id,
        p_branch_id,
        p_service_id,
        p_staff_id,
        v_client_id,
        v_client_name,
        v_client_phone,
        v_client_email,
        p_start,
        v_end,
        'confirmed'::booking_status,  -- Сразу создаем как confirmed, без hold
        null  -- expires_at не нужен для confirmed
    )
    returning id into v_booking_id;
    
    return v_booking_id;
end;
$$;

COMMENT ON FUNCTION public.hold_slot IS 'Создает бронь для авторизованного пользователя сразу со статусом confirmed. Учитывает только подтвержденные (confirmed) и оплаченные (paid) бронирования при проверке пересечений. Возвращает ID созданной брони.';


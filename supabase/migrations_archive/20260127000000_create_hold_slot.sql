-- Функция для создания бронирования для авторизованных пользователей
-- Создает бронирование с client_id = auth.uid() и заполняет client_name, client_phone, client_email из профиля

create or replace function public.hold_slot(
    p_biz_id uuid,
    p_branch_id uuid,
    p_service_id uuid,
    p_staff_id uuid,
    p_start timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_booking_id uuid;
    v_service_duration_min integer;
    v_end timestamptz;
    v_expires_at timestamptz;
    v_status booking_status := 'hold'::booking_status;
    v_client_id uuid;
    v_client_name text;
    v_client_phone text;
    v_client_email text;
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
    
    -- Время истечения резерва (2 минуты)
    v_expires_at := now() + interval '2 minutes';
    
    -- Проверяем пересечения с существующими бронированиями для этого мастера
    if exists (
        select 1
        from public.bookings
        where staff_id = p_staff_id
          and status in ('hold', 'confirmed', 'paid')
          and tstzrange(start_at, end_at, '[)') && tstzrange(p_start, v_end, '[)')
    ) then
        raise exception 'time slot is already booked';
    end if;
    
    -- Создаем бронирование для авторизованного пользователя
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
        v_status,
        v_expires_at
    )
    returning id into v_booking_id;
    
    return v_booking_id;
end;
$$;

comment on function public.hold_slot is 'Создает бронь для авторизованного пользователя. Использует auth.uid() для получения client_id и данные из профиля. Возвращает ID созданной брони.';

-- Функция для подтверждения бронирования (изменение статуса с 'hold' на 'confirmed')

create or replace function public.confirm_booking(
    p_booking_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_current_status booking_status;
begin
    -- Получаем текущий статус бронирования
    select status into v_current_status
    from public.bookings
    where id = p_booking_id;
    
    if not found then
        raise exception 'Booking not found';
    end if;
    
    -- Проверяем, что статус можно изменить на 'confirmed'
    if v_current_status not in ('hold') then
        raise exception 'Booking status cannot be changed to confirmed. Current status: %', v_current_status;
    end if;
    
    -- Обновляем статус на 'confirmed' и очищаем expires_at
    update public.bookings
    set status = 'confirmed'::booking_status,
        expires_at = null
    where id = p_booking_id;
    
    if not found then
        raise exception 'Failed to update booking status';
    end if;
end;
$$;

comment on function public.confirm_booking(uuid) is 'Подтверждает бронирование, изменяя статус с hold на confirmed и очищая expires_at.';

-- Разрешаем вызов функции
grant execute on function public.confirm_booking(uuid) to authenticated;
grant execute on function public.hold_slot(uuid, uuid, uuid, uuid, timestamptz) to authenticated;


-- Функция для создания гостевой брони без авторизации
-- Создает бронирование с client_id = NULL и заполняет client_name, client_phone, client_email

create or replace function public.hold_slot_guest(
    p_biz_id uuid,
    p_branch_id uuid,
    p_service_id uuid,
    p_staff_id uuid,
    p_start timestamptz,
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
    v_service_duration_min integer;
    v_end timestamptz;
    v_expires_at timestamptz;
    v_client_name_trimmed text;
    v_client_phone_trimmed text;
    v_client_email_trimmed text;
begin
    -- Валидация входных данных
    if p_client_name is null or trim(p_client_name) = '' then
        raise exception 'client_name is required';
    end if;
    
    if p_client_phone is null or trim(p_client_phone) = '' then
        raise exception 'client_phone is required';
    end if;
    
    v_client_name_trimmed := trim(p_client_name);
    v_client_phone_trimmed := trim(p_client_phone);
    v_client_email_trimmed := case when p_client_email is not null then trim(p_client_email) else null end;
    
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
    
    -- Создаем бронирование для гостя (client_id = NULL)
    -- Используем литерал 'hold'::booking_status напрямую, чтобы избежать проблем с типом переменной
    insert into public.bookings (
        biz_id,
        branch_id,
        service_id,
        staff_id,
        client_id,  -- NULL для гостевых броней
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
        null,  -- Гостевая бронь, без client_id
        v_client_name_trimmed,
        v_client_phone_trimmed,
        v_client_email_trimmed,
        p_start,
        v_end,
        'hold'::booking_status,  -- Используем литерал напрямую для избежания проблем с типом
        v_expires_at
    )
    returning id into v_booking_id;
    
    return v_booking_id;
end;
$$;

comment on function public.hold_slot_guest is 'Создает гостевую бронь без авторизации. Возвращает ID созданной брони.';


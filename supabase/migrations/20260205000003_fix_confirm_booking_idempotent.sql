-- Исправление функции confirm_booking
-- Делаем функцию идемпотентной: если статус уже confirmed, просто ничего не делаем

CREATE OR REPLACE FUNCTION public.confirm_booking(
    p_booking_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    
    -- Если статус уже confirmed, просто выходим (идемпотентность)
    if v_current_status = 'confirmed' then
        return;
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

COMMENT ON FUNCTION public.confirm_booking(uuid) IS 'Подтверждает бронирование, изменяя статус с hold на confirmed и очищая expires_at. Идемпотентна: если статус уже confirmed, ничего не делает.';


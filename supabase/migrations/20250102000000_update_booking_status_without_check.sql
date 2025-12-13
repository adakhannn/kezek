-- Функция для обновления статуса брони без проверки назначения сотрудника
-- Используется для отметки посещения (пришел/не пришел) для прошедших броней

CREATE OR REPLACE FUNCTION public.update_booking_status_no_check(
    p_booking_id uuid,
    p_new_status booking_status
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Просто обновляем статус без проверок
    UPDATE bookings
    SET status = p_new_status
    WHERE id = p_booking_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found';
    END IF;
END;
$$;

-- Комментарий к функции
COMMENT ON FUNCTION public.update_booking_status_no_check(uuid, booking_status) IS
'Обновляет статус брони без проверки назначения сотрудника. Используется для отметки посещения прошедших броней.';

-- Разрешаем вызов функции
GRANT EXECUTE ON FUNCTION public.update_booking_status_no_check(uuid, booking_status) TO authenticated;


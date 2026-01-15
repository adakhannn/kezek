-- Скрипт для исправления вчерашней смены: изменение hours_worked с 13.9 на 11.9
-- Использование: замените staff_id и shift_date на нужные значения

-- 1. Сначала проверим, какие смены есть за вчера с hours_worked = 13.9
SELECT 
    ss.id,
    ss.staff_id,
    s.full_name as staff_name,
    ss.shift_date,
    ss.opened_at,
    ss.closed_at,
    ss.hours_worked,
    ss.hourly_rate,
    ss.guaranteed_amount,
    ss.master_share,
    ss.salon_share,
    ss.total_amount
FROM public.staff_shifts ss
JOIN public.staff s ON s.id = ss.staff_id
WHERE ss.shift_date = CURRENT_DATE - INTERVAL '1 day'
  AND ss.hours_worked = 13.9
  AND ss.status = 'closed'
ORDER BY ss.opened_at;

-- 2. Если нужно исправить конкретную смену, используйте этот блок:
-- Замените <STAFF_ID> и <SHIFT_DATE> на нужные значения
DO $$
DECLARE
    v_staff_id UUID;
    v_shift_date DATE;
    v_hourly_rate NUMERIC;
    v_new_hours_worked NUMERIC := 11.9;
    v_new_guaranteed_amount NUMERIC;
    v_old_master_share NUMERIC;
    v_old_guaranteed_amount NUMERIC;
    v_new_master_share NUMERIC;
    v_new_salon_share NUMERIC;
    v_topup_amount NUMERIC;
    v_shift_record RECORD;
BEGIN
    -- УКАЖИТЕ ЗДЕСЬ ID СОТРУДНИКА И ДАТУ СМЕНЫ
    -- Пример: v_staff_id := 'ваш-uuid-сотрудника'::UUID;
    -- v_shift_date := '2026-01-14'::DATE;
    
    -- Или найдите автоматически первую смену за вчера с hours_worked = 13.9
    SELECT ss.id, ss.staff_id, ss.shift_date, ss.hourly_rate, ss.master_share, ss.guaranteed_amount, ss.salon_share
    INTO v_shift_record
    FROM public.staff_shifts ss
    WHERE ss.shift_date = CURRENT_DATE - INTERVAL '1 day'
      AND ss.hours_worked = 13.9
      AND ss.status = 'closed'
    ORDER BY ss.opened_at
    LIMIT 1;
    
    IF v_shift_record IS NULL THEN
        RAISE NOTICE 'Смена с hours_worked = 13.9 за вчера не найдена';
        RETURN;
    END IF;
    
    v_staff_id := v_shift_record.staff_id;
    v_shift_date := v_shift_record.shift_date;
    v_hourly_rate := v_shift_record.hourly_rate;
    v_old_master_share := v_shift_record.master_share;
    v_old_guaranteed_amount := v_shift_record.guaranteed_amount;
    
    -- Если hourly_rate NULL, получаем из таблицы staff
    IF v_hourly_rate IS NULL THEN
        SELECT hourly_rate INTO v_hourly_rate
        FROM public.staff
        WHERE id = v_staff_id;
    END IF;
    
    -- Рассчитываем новую гарантированную сумму
    IF v_hourly_rate IS NOT NULL AND v_hourly_rate > 0 THEN
        v_new_guaranteed_amount := ROUND(v_new_hours_worked * v_hourly_rate * 100) / 100;
    ELSE
        v_new_guaranteed_amount := 0;
    END IF;
    
    -- Рассчитываем новую долю сотрудника
    -- Если гарантированная сумма больше базовой доли, используем её
    IF v_new_guaranteed_amount > v_old_master_share THEN
        v_new_master_share := v_new_guaranteed_amount;
        v_topup_amount := ROUND((v_new_guaranteed_amount - v_old_master_share) * 100) / 100;
    ELSE
        v_new_master_share := v_old_master_share;
        v_topup_amount := 0;
    END IF;
    
    -- Рассчитываем новую долю салона (вычитаем доплату, если была)
    v_new_salon_share := GREATEST(0, v_shift_record.salon_share - v_topup_amount);
    
    -- Обновляем смену
    UPDATE public.staff_shifts
    SET 
        hours_worked = v_new_hours_worked,
        guaranteed_amount = v_new_guaranteed_amount,
        master_share = v_new_master_share,
        salon_share = v_new_salon_share,
        topup_amount = v_topup_amount,
        updated_at = timezone('utc'::text, now())
    WHERE id = v_shift_record.id;
    
    RAISE NOTICE 'Смена обновлена:';
    RAISE NOTICE '  Staff ID: %', v_staff_id;
    RAISE NOTICE '  Дата: %', v_shift_date;
    RAISE NOTICE '  hours_worked: 13.9 → %', v_new_hours_worked;
    RAISE NOTICE '  guaranteed_amount: % → %', v_old_guaranteed_amount, v_new_guaranteed_amount;
    RAISE NOTICE '  master_share: % → %', v_old_master_share, v_new_master_share;
    RAISE NOTICE '  salon_share: % → %', v_shift_record.salon_share, v_new_salon_share;
    RAISE NOTICE '  topup_amount: %', v_topup_amount;
END $$;

-- 3. Проверяем результат
SELECT 
    ss.id,
    s.full_name as staff_name,
    ss.shift_date,
    ss.hours_worked,
    ss.hourly_rate,
    ss.guaranteed_amount,
    ss.master_share,
    ss.salon_share,
    ss.topup_amount,
    ss.total_amount
FROM public.staff_shifts ss
JOIN public.staff s ON s.id = ss.staff_id
WHERE ss.shift_date = CURRENT_DATE - INTERVAL '1 day'
  AND ss.status = 'closed'
ORDER BY ss.opened_at;


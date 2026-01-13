-- Исправление смен от 11.01.2026 и 12.01.2026
-- Устанавливаем 11 часов работы для каждой смены и правильно применяем гарантированную оплату

-- Сначала найдем обе смены
SELECT 
    id,
    staff_id,
    shift_date,
    status,
    opened_at,
    closed_at,
    hours_worked,
    hourly_rate,
    guaranteed_amount,
    master_share,
    salon_share,
    topup_amount,
    total_amount
FROM public.staff_shifts
WHERE shift_date IN ('2026-01-11', '2026-01-12')
  -- Раскомментируйте и укажите ID сотрудника, если нужно исправить только его смены:
  -- AND staff_id = '41a2a539-fa66-4978-ae59-962b9c2bd34d'
ORDER BY shift_date, opened_at DESC;

-- Сначала проверим, есть ли hourly_rate у сотрудников для этих смен
SELECT 
    ss.id,
    ss.shift_date,
    ss.staff_id,
    ss.hourly_rate as shift_hourly_rate,
    s.hourly_rate as staff_hourly_rate,
    ss.master_share,
    ss.total_amount
FROM public.staff_shifts ss
JOIN public.staff s ON s.id = ss.staff_id
WHERE ss.shift_date IN ('2026-01-11', '2026-01-12')
ORDER BY ss.shift_date, ss.opened_at DESC;

-- Исправляем обе смены: устанавливаем 11 часов работы и применяем гарантированную оплату
-- Важно: берем hourly_rate из таблицы staff, если его нет в смене
UPDATE public.staff_shifts ss
SET 
    hours_worked = 11.0,
    -- Закрываем смену через 11 часов после открытия
    closed_at = CASE 
        WHEN ss.opened_at IS NOT NULL THEN 
            (ss.opened_at + INTERVAL '11 hours')::timestamptz
        ELSE ss.closed_at
    END,
    status = 'closed',
    -- Копируем hourly_rate из staff, если его нет в смене
    hourly_rate = COALESCE(ss.hourly_rate, s.hourly_rate),
    -- Пересчитываем guaranteed_amount на основе 11 часов (используем hourly_rate из staff, если нужно)
    guaranteed_amount = CASE 
        WHEN COALESCE(ss.hourly_rate, s.hourly_rate) IS NOT NULL 
        THEN ROUND(11.0 * COALESCE(ss.hourly_rate, s.hourly_rate), 2)
        ELSE ss.guaranteed_amount
    END,
    -- Если гарантированная сумма больше базовой доли, используем её
    master_share = CASE 
        WHEN COALESCE(ss.hourly_rate, s.hourly_rate) IS NOT NULL 
             AND ROUND(11.0 * COALESCE(ss.hourly_rate, s.hourly_rate), 2) > ss.master_share 
        THEN ROUND(11.0 * COALESCE(ss.hourly_rate, s.hourly_rate), 2)
        ELSE ss.master_share
    END,
    -- Скорректированная доля бизнеса (вычитаем доплату за выход, если она была)
    salon_share = CASE 
        WHEN COALESCE(ss.hourly_rate, s.hourly_rate) IS NOT NULL 
             AND ROUND(11.0 * COALESCE(ss.hourly_rate, s.hourly_rate), 2) > ss.master_share 
        THEN GREATEST(0, ss.salon_share - (ROUND(11.0 * COALESCE(ss.hourly_rate, s.hourly_rate), 2) - ss.master_share))
        ELSE ss.salon_share
    END,
    -- Доплата владельца
    topup_amount = CASE 
        WHEN COALESCE(ss.hourly_rate, s.hourly_rate) IS NOT NULL 
             AND ROUND(11.0 * COALESCE(ss.hourly_rate, s.hourly_rate), 2) > ss.master_share 
        THEN ROUND(11.0 * COALESCE(ss.hourly_rate, s.hourly_rate), 2) - ss.master_share
        ELSE 0
    END,
    updated_at = timezone('utc'::text, now())
FROM public.staff s
WHERE ss.staff_id = s.id
  AND ss.shift_date IN ('2026-01-11', '2026-01-12')
  -- Раскомментируйте и укажите конкретный ID смены или ID сотрудника, если нужно исправить только его смены:
  -- AND ss.id = 'SHIFT_ID_HERE'
  -- AND ss.staff_id = '41a2a539-fa66-4978-ae59-962b9c2bd34d'
RETURNING 
    ss.id, 
    ss.shift_date, 
    ss.status, 
    ss.opened_at,
    ss.closed_at,
    ss.hours_worked, 
    ss.hourly_rate, 
    ss.guaranteed_amount, 
    ss.master_share, 
    ss.salon_share, 
    ss.topup_amount,
    ss.total_amount;

-- Проверяем результат
SELECT 
    id,
    shift_date,
    status,
    opened_at,
    closed_at,
    hours_worked,
    hourly_rate,
    guaranteed_amount,
    master_share,
    salon_share,
    topup_amount,
    total_amount,
    -- Проверяем расчет
    CASE 
        WHEN hourly_rate IS NOT NULL THEN ROUND(11.0 * hourly_rate, 2)
        ELSE NULL
    END as calculated_guaranteed_amount
FROM public.staff_shifts
WHERE shift_date IN ('2026-01-11', '2026-01-12')
ORDER BY shift_date, opened_at DESC;


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

-- Исправляем обе смены: устанавливаем 11 часов работы
UPDATE public.staff_shifts
SET 
    hours_worked = 11.0,
    -- Закрываем смену через 11 часов после открытия
    closed_at = CASE 
        WHEN opened_at IS NOT NULL THEN 
            (opened_at + INTERVAL '11 hours')::timestamptz
        ELSE closed_at
    END,
    status = 'closed',
    -- Пересчитываем guaranteed_amount на основе 11 часов
    guaranteed_amount = CASE 
        WHEN hourly_rate IS NOT NULL THEN ROUND(11.0 * hourly_rate, 2)
        ELSE guaranteed_amount
    END,
    -- Если гарантированная сумма больше базовой доли, используем её
    master_share = CASE 
        WHEN hourly_rate IS NOT NULL AND ROUND(11.0 * hourly_rate, 2) > master_share 
        THEN ROUND(11.0 * hourly_rate, 2)
        ELSE master_share
    END,
    -- Скорректированная доля бизнеса (вычитаем доплату за выход, если она была)
    salon_share = CASE 
        WHEN hourly_rate IS NOT NULL AND ROUND(11.0 * hourly_rate, 2) > master_share 
        THEN GREATEST(0, salon_share - (ROUND(11.0 * hourly_rate, 2) - master_share))
        ELSE salon_share
    END,
    -- Доплата владельца
    topup_amount = CASE 
        WHEN hourly_rate IS NOT NULL AND ROUND(11.0 * hourly_rate, 2) > master_share 
        THEN ROUND(11.0 * hourly_rate, 2) - master_share
        ELSE 0
    END,
    updated_at = timezone('utc'::text, now())
WHERE shift_date IN ('2026-01-11', '2026-01-12')
  -- Раскомментируйте и укажите конкретный ID смены или ID сотрудника, если нужно исправить только его смены:
  -- AND id = 'SHIFT_ID_HERE'
  -- AND staff_id = '41a2a539-fa66-4978-ae59-962b9c2bd34d'
RETURNING 
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
    total_amount;

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


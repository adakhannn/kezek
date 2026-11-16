-- Исправление смены от 11.01.2026
-- Устанавливаем 12 часов работы и закрываем смену

-- Сначала найдем смену (замените STAFF_ID на ID сотрудника, если нужно)
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
WHERE shift_date = '2026-01-11'
  -- Раскомментируйте и укажите ID сотрудника, если нужно исправить только его смену:
  -- AND staff_id = '41a2a539-fa66-4978-ae59-962b9c2bd34d'
ORDER BY opened_at DESC
LIMIT 5;

-- Если нужно исправить конкретную смену, замените SHIFT_ID на ID смены из запроса выше
-- Устанавливаем 12 часов работы и закрываем смену

-- Вариант 1: Если смена открыта с 10:06, закрываем её в 22:06 того же дня
-- И правильно применяем гарантированную оплату
UPDATE public.staff_shifts
SET 
    hours_worked = 12.0,
    closed_at = (shift_date::text || 'T22:06:00')::timestamptz,
    status = 'closed',
    -- Пересчитываем guaranteed_amount на основе 12 часов
    guaranteed_amount = CASE 
        WHEN hourly_rate IS NOT NULL THEN ROUND(12.0 * hourly_rate, 2)
        ELSE guaranteed_amount
    END,
    -- Если гарантированная сумма больше базовой доли, используем её
    master_share = CASE 
        WHEN hourly_rate IS NOT NULL AND ROUND(12.0 * hourly_rate, 2) > master_share 
        THEN ROUND(12.0 * hourly_rate, 2)
        ELSE master_share
    END,
    -- Скорректированная доля бизнеса (вычитаем доплату за выход, если она была)
    salon_share = CASE 
        WHEN hourly_rate IS NOT NULL AND ROUND(12.0 * hourly_rate, 2) > master_share 
        THEN GREATEST(0, salon_share - (ROUND(12.0 * hourly_rate, 2) - master_share))
        ELSE salon_share
    END,
    -- Доплата владельца
    topup_amount = CASE 
        WHEN hourly_rate IS NOT NULL AND ROUND(12.0 * hourly_rate, 2) > master_share 
        THEN ROUND(12.0 * hourly_rate, 2) - master_share
        ELSE 0
    END,
    updated_at = timezone('utc'::text, now())
WHERE shift_date = '2026-01-11'
  AND (status = 'open' OR status = 'closed')  -- Можно исправить и открытую, и закрытую смену
  AND opened_at::date = '2026-01-11'
  -- Раскомментируйте и укажите конкретный ID смены или ID сотрудника, если нужно исправить только одну:
  -- AND id = 'SHIFT_ID_HERE'
  -- AND staff_id = '41a2a539-fa66-4978-ae59-962b9c2bd34d'
RETURNING id, shift_date, status, hours_worked, hourly_rate, guaranteed_amount, master_share, salon_share, topup_amount, closed_at;

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
    total_amount
FROM public.staff_shifts
WHERE shift_date = '2026-01-11'
ORDER BY opened_at DESC;


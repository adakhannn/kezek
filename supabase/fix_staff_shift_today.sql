-- Исправление смены сотрудника за сегодня (04.02.2026)
-- ID сотрудника: f0b15767-f06f-4292-bd76-10ad3a72e776
-- Проблемы:
--   - opened_at = 2026-02-03 19:17:44 (неправильно, должно быть 04.02.2026 09:00 Asia/Bishkek = 04.02.2026 03:00 UTC)
--   - hours_worked = 17.62, должно быть 9.92 (с 9:00 до 18:55 = 9ч 55мин)
--   - guaranteed_amount = 1761.91, должно быть 992 (9.92 * 100)
-- 
-- ВАЖНО: Для открытых смен API пересчитывает часы динамически от opened_at до текущего времени,
-- поэтому нужно исправить opened_at, чтобы расчет был правильным

-- Сначала посмотрим текущее состояние смены
SELECT 
    s.id,
    s.shift_date,
    s.status,
    s.opened_at,
    s.closed_at,
    s.hours_worked,
    s.hourly_rate,
    s.guaranteed_amount,
    s.topup_amount,
    s.master_share,
    s.salon_share,
    s.total_amount,
    s.consumables_amount,
    s.percent_master,
    s.percent_salon
FROM public.staff_shifts s
WHERE s.staff_id = 'f0b15767-f06f-4292-bd76-10ad3a72e776'
  AND s.shift_date = CURRENT_DATE
  AND s.status = 'open';

-- Исправляем смену
WITH shift_data AS (
    SELECT 
        s.id,
        s.total_amount,
        s.consumables_amount,
        s.percent_master,
        s.percent_salon,
        -- Устанавливаем правильное количество часов: 9.92 (с 9:00 до 18:55 = 9ч 55мин)
        9.92 as correct_hours_worked,
        -- Правильная ставка (100 сом/час)
        100 as correct_hourly_rate
    FROM public.staff_shifts s
    WHERE s.staff_id = 'f0b15767-f06f-4292-bd76-10ad3a72e776'
      AND s.shift_date = CURRENT_DATE
      AND s.status = 'open'
)
UPDATE public.staff_shifts s
SET 
    -- Исправляем opened_at на правильное время: 04.02.2026 09:00 (Asia/Bishkek)
    -- Конвертируем в UTC: 04.02.2026 09:00 Asia/Bishkek = 04.02.2026 03:00 UTC (UTC+6)
    opened_at = (s.shift_date + INTERVAL '3 hours')::timestamptz,
    hours_worked = sd.correct_hours_worked,
    hourly_rate = sd.correct_hourly_rate,
    guaranteed_amount = ROUND(sd.correct_hours_worked * sd.correct_hourly_rate * 100) / 100,
    -- Рассчитываем базовую долю мастера из total_amount и процентов
    master_share = GREATEST(
        CASE 
            WHEN sd.total_amount > 0 AND sd.percent_master IS NOT NULL AND sd.percent_salon IS NOT NULL THEN
                ROUND((sd.total_amount * sd.percent_master / NULLIF(sd.percent_master + sd.percent_salon, 0)) * 100) / 100
            ELSE 0
        END,
        ROUND(sd.correct_hours_worked * sd.correct_hourly_rate * 100) / 100
    ),
    -- Пересчитываем topup_amount (доплата владельца, если гарантия больше базовой доли)
    topup_amount = GREATEST(
        0,
        ROUND(sd.correct_hours_worked * sd.correct_hourly_rate * 100) / 100 - 
        CASE 
            WHEN sd.total_amount > 0 AND sd.percent_master IS NOT NULL AND sd.percent_salon IS NOT NULL THEN
                ROUND((sd.total_amount * sd.percent_master / NULLIF(sd.percent_master + sd.percent_salon, 0)) * 100) / 100
            ELSE 0
        END
    ),
    -- Пересчитываем salon_share
    salon_share = GREATEST(
        0,
        CASE 
            WHEN sd.total_amount > 0 AND sd.percent_master IS NOT NULL AND sd.percent_salon IS NOT NULL THEN
                ROUND((sd.total_amount * sd.percent_salon / NULLIF(sd.percent_master + sd.percent_salon, 0)) * 100) / 100
            ELSE 0
        END + sd.consumables_amount - 
        GREATEST(
            0,
            ROUND(sd.correct_hours_worked * sd.correct_hourly_rate * 100) / 100 - 
            CASE 
                WHEN sd.total_amount > 0 AND sd.percent_master IS NOT NULL AND sd.percent_salon IS NOT NULL THEN
                    ROUND((sd.total_amount * sd.percent_master / NULLIF(sd.percent_master + sd.percent_salon, 0)) * 100) / 100
                ELSE 0
            END
        )
    ),
    updated_at = timezone('utc'::text, now())
FROM shift_data sd
WHERE s.id = sd.id;

-- Проверяем результат
SELECT 
    s.id,
    s.shift_date,
    s.status,
    s.opened_at,
    s.hours_worked,
    s.hourly_rate,
    s.guaranteed_amount,
    s.topup_amount,
    s.master_share,
    s.salon_share,
    s.total_amount,
    -- Проверяем расчет
    ROUND(s.hours_worked * s.hourly_rate * 100) / 100 as calculated_guaranteed_amount
FROM public.staff_shifts s
WHERE s.staff_id = 'f0b15767-f06f-4292-bd76-10ad3a72e776'
  AND s.shift_date = CURRENT_DATE;


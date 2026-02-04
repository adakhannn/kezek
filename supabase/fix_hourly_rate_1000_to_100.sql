-- Исправление неправильно рассчитанных сумм из-за hourly_rate = 1000 вместо 100
-- Пересчитываем guaranteed_amount, topup_amount, master_share и salon_share

-- Сначала посмотрим, какие смены нужно исправить (раскомментируйте для проверки)
-- SELECT 
--     s.id,
--     s.shift_date,
--     s.status,
--     s.hourly_rate as old_hourly_rate,
--     s.hours_worked,
--     s.guaranteed_amount as old_guaranteed_amount,
--     s.topup_amount as old_topup_amount,
--     s.master_share as old_master_share,
--     s.salon_share as old_salon_share,
--     s.total_amount,
--     st.hourly_rate as current_staff_hourly_rate,
--     -- Предварительный расчет новой гарантированной суммы
--     CASE 
--         WHEN s.hours_worked IS NOT NULL AND s.hours_worked > 0 THEN
--             ROUND(s.hours_worked * COALESCE(st.hourly_rate, 100) * 100) / 100
--         ELSE 0
--     END as new_guaranteed_amount
-- FROM public.staff_shifts s
-- JOIN public.staff st ON st.id = s.staff_id
-- WHERE s.hourly_rate >= 500  -- Смены с неправильной ставкой (>= 500, чтобы поймать 1000)
-- ORDER BY s.shift_date DESC, s.created_at DESC;

-- Обновляем смены, где hourly_rate был неправильным (>= 500)
-- Используем текущий hourly_rate из staff, если он есть, иначе используем 100
WITH corrected_shifts AS (
    SELECT 
        s.id,
        s.total_amount,
        s.consumables_amount,
        s.percent_master,
        s.percent_salon,
        s.hours_worked,
        COALESCE(st.hourly_rate, 100) as correct_hourly_rate,
        -- Рассчитываем базовую долю мастера из total_amount и процентов
        CASE 
            WHEN s.total_amount > 0 AND s.percent_master IS NOT NULL AND s.percent_salon IS NOT NULL THEN
                ROUND((s.total_amount * s.percent_master / NULLIF(s.percent_master + s.percent_salon, 0)) * 100) / 100
            ELSE 0
        END as base_master_share,
        -- Рассчитываем базовую долю салона
        CASE 
            WHEN s.total_amount > 0 AND s.percent_master IS NOT NULL AND s.percent_salon IS NOT NULL THEN
                ROUND((s.total_amount * s.percent_salon / NULLIF(s.percent_master + s.percent_salon, 0)) * 100) / 100
            ELSE 0
        END as base_salon_share,
        -- Рассчитываем новую гарантированную сумму
        CASE
            WHEN s.hours_worked IS NOT NULL AND s.hours_worked > 0 THEN
                ROUND(s.hours_worked * COALESCE(st.hourly_rate, 100) * 100) / 100
            ELSE 0
        END as new_guaranteed_amount
    FROM public.staff_shifts s
    JOIN public.staff st ON st.id = s.staff_id
    WHERE s.hourly_rate >= 500  -- Смены с неправильной ставкой
      AND s.status = 'closed'    -- Только закрытые смены
)
UPDATE public.staff_shifts s
SET 
    hourly_rate = cs.correct_hourly_rate,
    guaranteed_amount = cs.new_guaranteed_amount,
    -- Если гарантированная сумма больше базовой доли, используем гарантию
    master_share = GREATEST(cs.base_master_share, cs.new_guaranteed_amount),
    -- Пересчитываем topup_amount (доплата владельца, если гарантия больше базовой доли)
    topup_amount = GREATEST(0, cs.new_guaranteed_amount - cs.base_master_share),
    -- Пересчитываем salon_share (вычитаем topup_amount из базовой доли салона + расходники)
    salon_share = GREATEST(
        0,
        cs.base_salon_share + cs.consumables_amount - 
        GREATEST(0, cs.new_guaranteed_amount - cs.base_master_share)
    ),
    updated_at = timezone('utc'::text, now())
FROM corrected_shifts cs
WHERE s.id = cs.id;

-- Комментарий: для открытых смен guaranteed_amount пересчитывается динамически в API
-- Поэтому открытые смены не нужно обновлять

-- Проверка результатов (раскомментируйте для проверки)
-- SELECT 
--     s.id,
--     s.shift_date,
--     s.hourly_rate,
--     s.hours_worked,
--     s.guaranteed_amount,
--     s.topup_amount,
--     s.master_share,
--     s.salon_share,
--     s.total_amount
-- FROM public.staff_shifts s
-- WHERE s.hourly_rate < 500  -- Проверяем, что все ставки исправлены
--   AND s.status = 'closed'
--   AND s.shift_date >= '2026-02-01'  -- Укажите нужную дату
-- ORDER BY s.shift_date DESC;


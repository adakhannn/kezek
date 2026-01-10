-- ============================================================================
-- ИСПРАВЛЕНИЕ get_free_slots_service_day_v2 ДЛЯ УЧЕТА ВРЕМЕННЫХ ПЕРЕВОДОВ
-- ============================================================================
-- 
-- ПРОБЛЕМА: Функция не учитывает временные переводы через staff_schedule_rules
-- и возвращает пустой массив слотов для временно переведенных мастеров.
--
-- РЕШЕНИЕ: Обновить функцию, чтобы она проверяла staff_schedule_rules для временных переводов,
-- аналогично функции check_booking_branch_match.
--
-- ИНСТРУКЦИЯ:
-- 1. Выполните первый запрос, чтобы получить текущее определение функции
-- 2. Просмотрите результат и скопируйте структуру функции
-- 3. Выполните второй блок (CREATE OR REPLACE FUNCTION) для обновления функции
--    (возможно, потребуется адаптировать код под вашу текущую реализацию)
--
-- ============================================================================

-- ШАГ 1: Получить текущее определение функции
-- Выполните этот запрос в Supabase SQL Editor, чтобы увидеть текущую реализацию:
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'get_free_slots_service_day_v2' 
  AND pronamespace = 'public'::regnamespace;

-- ШАГ 2: Если функция существует, просмотрите её определение выше и адаптируйте код ниже
-- Если функция не найдена, создайте её с нуля на основе вашей логики

-- ============================================================================
-- ОБНОВЛЕННАЯ ВЕРСИЯ ФУНКЦИИ (требует адаптации под вашу текущую реализацию)
-- ============================================================================

-- ВАЖНО: Этот код является примером и требует адаптации под вашу текущую реализацию функции.
-- Замените логику определения branch_id на использование COALESCE для учета временных переводов.

-- Пример того, как должна выглядеть логика определения филиала мастера на дату:

/*
CREATE OR REPLACE FUNCTION public.get_free_slots_service_day_v2(
    p_biz_id uuid,
    p_service_id uuid,
    p_day date,
    p_per_staff integer DEFAULT 400,
    p_step_min integer DEFAULT 15
)
RETURNS TABLE (
    staff_id uuid,
    branch_id uuid,
    start_at timestamptz,
    end_at timestamptz
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_target_date date := p_day;
BEGIN
    RETURN QUERY
    WITH staff_schedules AS (
        -- Определяем филиал для каждого мастера на указанную дату с учетом временных переводов
        SELECT DISTINCT
            s.id AS staff_id,
            COALESCE(
                -- Проверяем, есть ли временный перевод для мастера на эту дату
                (SELECT ssr.branch_id 
                 FROM staff_schedule_rules ssr
                 WHERE ssr.biz_id = p_biz_id
                   AND ssr.staff_id = s.id
                   AND ssr.kind = 'date'
                   AND ssr.date_on = v_target_date
                   AND ssr.is_active = true
                   AND ssr.branch_id IS NOT NULL
                   LIMIT 1),
                -- Если нет временного перевода, используем основной филиал мастера
                s.branch_id
            ) AS effective_branch_id
        FROM staff s
        INNER JOIN service_staff ss ON ss.staff_id = s.id AND ss.is_active = true
        WHERE s.biz_id = p_biz_id
          AND s.is_active = true
          AND ss.service_id = p_service_id
    ),
    -- Далее ваша логика генерации слотов из расписания и фильтрации занятых броней
    -- Используйте effective_branch_id вместо s.branch_id для фильтрации
    generated_slots AS (
        -- Здесь должна быть ваша логика генерации слотов
        -- Пример структуры (замените на вашу реализацию):
        SELECT 
            sc.staff_id,
            sc.effective_branch_id AS branch_id,
            -- ваша логика генерации start_at и end_at
            -- на основе расписания мастера (working_hours или staff_schedule_rules)
            NULL::timestamptz AS start_at,
            NULL::timestamptz AS end_at
        FROM staff_schedules sc
        -- JOIN с расписанием мастера для генерации временных слотов
        -- Фильтрация занятых броней и т.д.
    )
    SELECT 
        gs.staff_id,
        gs.branch_id,
        gs.start_at,
        gs.end_at
    FROM generated_slots gs
    -- Ваша логика фильтрации и ограничений
    LIMIT p_per_staff;
END;
$$;
*/

-- ============================================================================
-- АЛЬТЕРНАТИВНЫЙ ПОДХОД: Если функция использует JOIN со staff,
-- просто добавьте подзапрос для определения effective_branch_id
-- ============================================================================

-- Если ваша текущая функция использует что-то вроде:
-- FROM staff s WHERE s.branch_id = ...
--
-- Замените на:
-- FROM staff s 
-- WHERE COALESCE(
--     (SELECT ssr.branch_id FROM staff_schedule_rules ssr
--      WHERE ssr.biz_id = p_biz_id
--        AND ssr.staff_id = s.id
--        AND ssr.kind = 'date'
--        AND ssr.date_on = p_day
--        AND ssr.is_active = true
--        AND ssr.branch_id IS NOT NULL
--      LIMIT 1),
--     s.branch_id
-- ) = ... -- ваш фильтр по филиалу

-- ============================================================================
-- ПРОВЕРКА: После обновления функции проверьте, что она работает корректно
-- ============================================================================

-- Выполните тестовый запрос для временно переведенного мастера:
-- SELECT * FROM get_free_slots_service_day_v2(
--     'ваш_biz_id'::uuid,
--     'ваш_service_id'::uuid,
--     '2026-01-10'::date,
--     400,
--     15
-- )
-- WHERE staff_id = 'ваш_staff_id'::uuid;


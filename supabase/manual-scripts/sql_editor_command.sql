-- ============================================================================
-- КОМАНДА ДЛЯ SUPABASE SQL EDITOR
-- Исправление get_free_slots_service_day_v2 для учета временных переводов
-- ============================================================================

-- ШАГ 1: Получить текущее определение функции (выполните это первым)
SELECT pg_get_functiondef(oid) as function_definition
FROM pg_proc 
WHERE proname = 'get_free_slots_service_day_v2' 
  AND pronamespace = 'public'::regnamespace;

-- ============================================================================
-- ШАГ 2: После просмотра результата выше, скопируйте определение функции
-- и адаптируйте код ниже под вашу текущую реализацию
-- ============================================================================

-- КЛЮЧЕВАЯ ИЗМЕНЕНИЕ: Замените использование s.branch_id на определение effective_branch_id
-- с учетом временных переводов через staff_schedule_rules

-- Пример того, как нужно изменить логику в вашей функции:
-- 
-- ВМЕСТО:
--   FROM staff s WHERE s.branch_id = ...
-- 
-- ИСПОЛЬЗУЙТЕ:
--   FROM staff s
--   WHERE COALESCE(
--       (SELECT ssr.branch_id 
--        FROM staff_schedule_rules ssr
--        WHERE ssr.biz_id = p_biz_id
--          AND ssr.staff_id = s.id
--          AND ssr.kind = 'date'
--          AND ssr.date_on = p_day
--          AND ssr.is_active = true
--          AND ssr.branch_id IS NOT NULL
--        LIMIT 1),
--       s.branch_id
--   ) = ... -- ваш фильтр по филиалу

-- ============================================================================
-- ШАГ 3: Если функция использует CTE (WITH), добавьте вычисление effective_branch_id
-- ============================================================================

-- Пример для CTE:
-- 
-- WITH staff_with_branches AS (
--     SELECT 
--         s.id,
--         s.full_name,
--         COALESCE(
--             (SELECT ssr.branch_id 
--              FROM staff_schedule_rules ssr
--              WHERE ssr.biz_id = p_biz_id
--                AND ssr.staff_id = s.id
--                AND ssr.kind = 'date'
--                AND ssr.date_on = p_day
--                AND ssr.is_active = true
--                AND ssr.branch_id IS NOT NULL
--              LIMIT 1),
--             s.branch_id
--         ) AS effective_branch_id
--     FROM staff s
--     WHERE s.biz_id = p_biz_id
--       AND s.is_active = true
-- )
-- -- Далее используйте effective_branch_id вместо s.branch_id

-- ============================================================================
-- ШАГ 4: После обновления функции, проверьте её работу
-- ============================================================================

-- Тест для временно переведенного мастера:
-- SELECT * FROM get_free_slots_service_day_v2(
--     'your_biz_id_here'::uuid,      -- замените на ваш biz_id
--     'your_service_id_here'::uuid,  -- замените на ваш service_id
--     '2026-01-10'::date,            -- дата временного перевода
--     400,
--     15
-- )
-- WHERE staff_id = 'your_staff_id_here'::uuid;  -- замените на ваш staff_id


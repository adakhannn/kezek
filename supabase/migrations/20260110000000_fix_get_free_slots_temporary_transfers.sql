-- Обновление функции get_free_slots_service_day_v2 для учета временных переводов
-- 
-- ПРОБЛЕМА: Функция не учитывает временные переводы через staff_schedule_rules
-- и возвращает пустой массив слотов для временно переведенных мастеров.
--
-- РЕШЕНИЕ: Обновить функцию, чтобы она проверяла staff_schedule_rules для временных переводов,
-- аналогично функции check_booking_branch_match.
--
-- ИНСТРУКЦИЯ:
-- 1. Получить текущее определение функции:
--    SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'get_free_slots_service_day_v2';
--
-- 2. Обновить функцию, добавив проверку staff_schedule_rules для временных переводов:
--    - Если функция использует staff.branch_id для фильтрации, нужно использовать COALESCE
--      для получения branch_id из staff_schedule_rules, если есть временный перевод
--    - Если функция генерирует слоты из расписания, нужно добавить проверку staff_schedule_rules
--      для временных переводов
--
-- 3. Применить обновленную функцию в Supabase SQL Editor

-- Пример логики для определения филиала мастера на указанную дату:
-- 
-- COALESCE(
--     (SELECT ssr.branch_id FROM staff_schedule_rules ssr
--      WHERE ssr.biz_id = p_biz_id
--        AND ssr.staff_id = staff.id
--        AND ssr.kind = 'date'
--        AND ssr.date_on = p_day::date
--        AND ssr.is_active = true
--        AND ssr.branch_id IS NOT NULL
--      LIMIT 1),
--     staff.branch_id
-- ) AS effective_branch_id
--
-- Использовать effective_branch_id вместо staff.branch_id для фильтрации слотов

-- Поскольку точная структура функции неизвестна, эта миграция добавляет комментарий,
-- если функция существует. Функцию нужно обновить вручную в Supabase SQL Editor.

DO $$
BEGIN
    -- Проверяем, существует ли функция, и если да - добавляем комментарий
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'get_free_slots_service_day_v2'
    ) THEN
        COMMENT ON FUNCTION public.get_free_slots_service_day_v2 IS 
'ВАЖНО: Функция требует обновления для учета временных переводов через staff_schedule_rules.
Текущая проблема: функция возвращает пустой массив слотов для временно переведенных мастеров.
Решение: добавить проверку staff_schedule_rules.branch_id для временных переводов на указанную дату.
См. логику в check_booking_branch_match для примера.
См. миграцию 20260110000000_fix_get_free_slots_temporary_transfers.sql для подробных инструкций.';
    END IF;
END $$;


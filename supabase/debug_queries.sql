-- ============================================================================
-- SQL ЗАПРОСЫ ДЛЯ ДИАГНОСТИКИ ПРОБЛЕМЫ СО СЛОТАМИ
-- ============================================================================
-- Выполните эти запросы в Supabase SQL Editor и покажите результаты

-- 1. Проверить, что функция get_free_slots_service_day_v2 обновилась
-- (должна содержать проверку staff_schedule_rules)
SELECT pg_get_functiondef(oid) as function_definition
FROM pg_proc 
WHERE proname = 'get_free_slots_service_day_v2' 
  AND pronamespace = 'public'::regnamespace;

-- 2. Проверить временный перевод в базе данных
SELECT 
  ssr.id,
  ssr.staff_id,
  ssr.branch_id as temp_branch_id,
  ssr.date_on,
  ssr.is_active,
  ssr.intervals,
  s.branch_id as staff_home_branch_id,
  svc.branch_id as service_branch_id,
  svc.name_ru as service_name
FROM staff_schedule_rules ssr
JOIN staff s ON s.id = ssr.staff_id
CROSS JOIN services svc
WHERE ssr.biz_id = (SELECT id FROM businesses WHERE slug = 'manly' LIMIT 1)
  AND ssr.staff_id = '9d87bc31-e7e6-44f7-8b64-0d0481f9443'
  AND ssr.date_on = '2026-01-10'
  AND ssr.is_active = true
  AND svc.name_ru = 'Взрослая стрижка'
  AND svc.biz_id = (SELECT id FROM businesses WHERE slug = 'manly' LIMIT 1);

-- 3. Получить определение функции resolve_staff_day
-- (она используется внутри get_free_slots_service_day_v2 и может быть проблемой)
SELECT pg_get_functiondef(oid) as function_definition
FROM pg_proc 
WHERE proname = 'resolve_staff_day' 
  AND pronamespace = 'public'::regnamespace;

-- 4. Тестовый вызов функции get_free_slots_service_day_v2
SELECT * FROM get_free_slots_service_day_v2(
  (SELECT id FROM businesses WHERE slug = 'manly' LIMIT 1)::uuid,
  (SELECT id FROM services WHERE name_ru = 'Взрослая стрижка' AND biz_id = (SELECT id FROM businesses WHERE slug = 'manly' LIMIT 1) LIMIT 1)::uuid,
  '2026-01-10'::date,
  400,
  15
)
WHERE staff_id = '9d87bc31-e7e6-44f7-8b64-0d0481f9443'::uuid;

-- 5. Проверить, что resolve_staff_day возвращает для этого мастера на эту дату
SELECT * FROM resolve_staff_day(
  '9d87bc31-e7e6-44f7-8b64-0d0481f9443'::uuid,
  '2026-01-10'::date
);


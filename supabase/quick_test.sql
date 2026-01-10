-- ============================================================================
-- БЫСТРЫЙ ТЕСТ: Проверка что функция работает
-- ============================================================================
-- Выполните этот запрос в Supabase SQL Editor

-- Тест 1: Вызов функции с услугой в филиале Manly Временный (где мастер временно переведен)
SELECT 
  staff_id,
  branch_id,
  start_at,
  end_at,
  COUNT(*) OVER() as total_slots
FROM get_free_slots_service_day_v2(
  (SELECT id FROM businesses WHERE slug = 'manly' LIMIT 1)::uuid,
  (SELECT id FROM services 
   WHERE biz_id = (SELECT id FROM businesses WHERE slug = 'manly' LIMIT 1)
     AND name_ru = 'Взрослая стрижка'
     AND branch_id = 'c5bdc423-194c-4038-ab6e-da13e6421505'::uuid  -- Manly Временный
     AND active = true
   LIMIT 1)::uuid,
  '2026-01-10'::date,
  400,
  15
)
WHERE staff_id = (
  SELECT id FROM staff 
  WHERE biz_id = (SELECT id FROM businesses WHERE slug = 'manly' LIMIT 1)
    AND full_name LIKE '%Мастер 1%'
    AND is_active = true
  LIMIT 1
)
ORDER BY start_at
LIMIT 10;



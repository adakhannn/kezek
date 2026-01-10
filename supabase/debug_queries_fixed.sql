-- ============================================================================
-- ИСПРАВЛЕННЫЕ SQL ЗАПРОСЫ ДЛЯ ДИАГНОСТИКИ
-- ============================================================================

-- 2. Проверить временный перевод в базе данных (ИСПРАВЛЕНО)
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
  AND ssr.staff_id = '9d87bc31-e7e6-44f7-8b64-0d0481f9443'::uuid
  AND ssr.date_on = '2026-01-10'::date
  AND ssr.is_active = true
  AND svc.name_ru = 'Взрослая стрижка'
  AND svc.biz_id = (SELECT id FROM businesses WHERE slug = 'manly' LIMIT 1);

-- 4. Тестовый вызов функции get_free_slots_service_day_v2 (ИСПРАВЛЕНО)
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

-- 6. Проверить, есть ли временный перевод в филиал услуги
SELECT 
  ssr.branch_id as temp_branch_id,
  svc.branch_id as service_branch_id,
  ssr.branch_id = svc.branch_id as matches_service_branch
FROM staff_schedule_rules ssr
CROSS JOIN services svc
WHERE ssr.biz_id = (SELECT id FROM businesses WHERE slug = 'manly' LIMIT 1)
  AND ssr.staff_id = '9d87bc31-e7e6-44f7-8b64-0d0481f9443'::uuid
  AND ssr.date_on = '2026-01-10'::date
  AND ssr.is_active = true
  AND ssr.kind = 'date'
  AND svc.name_ru = 'Взрослая стрижка'
  AND svc.biz_id = (SELECT id FROM businesses WHERE slug = 'manly' LIMIT 1);


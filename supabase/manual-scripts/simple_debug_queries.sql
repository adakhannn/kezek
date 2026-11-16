-- ============================================================================
-- ПРОСТЫЕ SQL ЗАПРОСЫ ДЛЯ ПРОВЕРКИ (БЕЗ UUID В WHERE)
-- ============================================================================

-- 1. Найти ID мастера по slug бизнеса
SELECT s.id as staff_id, s.full_name, s.branch_id as home_branch_id
FROM staff s
JOIN businesses b ON b.id = s.biz_id
WHERE b.slug = 'manly'
  AND s.is_active = true
ORDER BY s.full_name;

-- 2. Найти временные переводы для мастера "Мастер 1" на 10 января
SELECT 
  ssr.id,
  ssr.staff_id,
  s.full_name as staff_name,
  ssr.branch_id as temp_branch_id,
  b.name as branch_name,
  ssr.date_on,
  ssr.is_active,
  ssr.intervals
FROM staff_schedule_rules ssr
JOIN staff s ON s.id = ssr.staff_id
JOIN branches b ON b.id = ssr.branch_id
WHERE ssr.biz_id = (SELECT id FROM businesses WHERE slug = 'manly' LIMIT 1)
  AND s.full_name LIKE '%Мастер 1%'
  AND ssr.date_on = '2026-01-10'::date
  AND ssr.is_active = true
  AND ssr.kind = 'date';

-- 3. Найти услугу "Взрослая стрижка" и её филиал
SELECT 
  svc.id as service_id,
  svc.name_ru,
  svc.branch_id as service_branch_id,
  b.name as branch_name
FROM services svc
JOIN branches b ON b.id = svc.branch_id
WHERE svc.biz_id = (SELECT id FROM businesses WHERE slug = 'manly' LIMIT 1)
  AND svc.name_ru = 'Взрослая стрижка'
  AND svc.active = true;

-- 4. Сравнить: временный перевод VS филиал услуги
WITH temp_transfers AS (
  SELECT 
    ssr.staff_id,
    ssr.branch_id as temp_branch_id,
    s.full_name as staff_name
  FROM staff_schedule_rules ssr
  JOIN staff s ON s.id = ssr.staff_id
  WHERE ssr.biz_id = (SELECT id FROM businesses WHERE slug = 'manly' LIMIT 1)
    AND ssr.date_on = '2026-01-10'::date
    AND ssr.is_active = true
    AND ssr.kind = 'date'
    AND ssr.branch_id IS NOT NULL
),
services_info AS (
  SELECT 
    svc.id as service_id,
    svc.name_ru,
    svc.branch_id as service_branch_id,
    b.name as branch_name
  FROM services svc
  JOIN branches b ON b.id = svc.branch_id
  WHERE svc.biz_id = (SELECT id FROM businesses WHERE slug = 'manly' LIMIT 1)
    AND svc.name_ru = 'Взрослая стрижка'
    AND svc.active = true
)
SELECT 
  tt.staff_name,
  tt.temp_branch_id as master_temp_branch_id,
  si.service_branch_id,
  (tt.temp_branch_id = si.service_branch_id) as branches_match,
  si.service_id,
  si.name_ru as service_name
FROM temp_transfers tt
CROSS JOIN services_info si;

-- 5. Что возвращает resolve_staff_day для мастера "Мастер 1" на 10 января
SELECT 
  s.full_name,
  rsd.*
FROM staff s
CROSS JOIN LATERAL resolve_staff_day(s.id, '2026-01-10'::date) rsd
WHERE s.biz_id = (SELECT id FROM businesses WHERE slug = 'manly' LIMIT 1)
  AND s.full_name LIKE '%Мастер 1%'
  AND s.is_active = true;


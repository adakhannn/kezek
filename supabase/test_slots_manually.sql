-- ============================================================================
-- ПОЛНАЯ ДИАГНОСТИКА ПРОБЛЕМЫ СО СЛОТАМИ
-- ============================================================================
-- Выполните эти запросы по очереди в Supabase SQL Editor

-- ШАГ 1: Проверить ID мастера, услуги и филиалов
WITH biz AS (
  SELECT id FROM businesses WHERE slug = 'manly' LIMIT 1
),
staff_info AS (
  SELECT s.id as staff_id, s.full_name, s.branch_id as home_branch_id
  FROM staff s, biz
  WHERE s.biz_id = biz.id
    AND s.full_name LIKE '%Мастер 1%'
    AND s.is_active = true
  LIMIT 1
),
service_info AS (
  SELECT svc.id as service_id, svc.name_ru, svc.branch_id as service_branch_id, svc.duration_min
  FROM services svc, biz
  WHERE svc.biz_id = biz.id
    AND svc.name_ru = 'Взрослая стрижка'
    AND svc.active = true
),
temp_transfer_info AS (
  SELECT ssr.branch_id as temp_branch_id, ssr.intervals, ssr.date_on
  FROM staff_schedule_rules ssr, biz, staff_info
  WHERE ssr.biz_id = biz.id
    AND ssr.staff_id = staff_info.staff_id
    AND ssr.kind = 'date'
    AND ssr.date_on = '2026-01-10'::date
    AND ssr.is_active = true
    AND ssr.branch_id IS NOT NULL
  LIMIT 1
)
SELECT 
  (SELECT id FROM biz) as biz_id,
  (SELECT staff_id FROM staff_info) as staff_id,
  (SELECT full_name FROM staff_info) as staff_name,
  (SELECT home_branch_id FROM staff_info) as home_branch_id,
  (SELECT service_id FROM service_info) as service_id,
  (SELECT name_ru FROM service_info) as service_name,
  (SELECT service_branch_id FROM service_info) as service_branch_id,
  (SELECT temp_branch_id FROM temp_transfer_info) as temp_branch_id,
  (SELECT (SELECT service_branch_id FROM service_info) = (SELECT temp_branch_id FROM temp_transfer_info)) as branches_match,
  (SELECT intervals FROM temp_transfer_info) as schedule_intervals;

-- ШАГ 2: Проверить, что возвращает resolve_staff_day для этого мастера на эту дату
SELECT 
  s.full_name,
  rsd.branch_id,
  rsd.tz,
  rsd.intervals,
  rsd.breaks
FROM staff s
CROSS JOIN LATERAL resolve_staff_day(s.id, '2026-01-10'::date) rsd
WHERE s.biz_id = (SELECT id FROM businesses WHERE slug = 'manly' LIMIT 1)
  AND s.full_name LIKE '%Мастер 1%'
  AND s.is_active = true;

-- ШАГ 3: Тестовый вызов функции get_free_slots_service_day_v2
-- Замените UUID на реальные значения из ШАГ 1
SELECT * FROM get_free_slots_service_day_v2(
  (SELECT id FROM businesses WHERE slug = 'manly' LIMIT 1)::uuid,
  (SELECT id FROM services WHERE name_ru = 'Взрослая стрижка' 
   AND biz_id = (SELECT id FROM businesses WHERE slug = 'manly' LIMIT 1)
   AND branch_id = 'c5bdc423-194c-4038-ab6e-da13e6421505'::uuid  -- филиал Manly Временный
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
);

-- ШАГ 4: Проверить, есть ли брони для этого мастера на эту дату (которые могут занимать слоты)
SELECT 
  bk.id,
  bk.start_at,
  bk.end_at,
  bk.status,
  bk.service_id,
  svc.name_ru as service_name
FROM bookings bk
JOIN services svc ON svc.id = bk.service_id
WHERE bk.biz_id = (SELECT id FROM businesses WHERE slug = 'manly' LIMIT 1)
  AND bk.staff_id = (
    SELECT id FROM staff 
    WHERE biz_id = (SELECT id FROM businesses WHERE slug = 'manly' LIMIT 1)
      AND full_name LIKE '%Мастер 1%'
      AND is_active = true
    LIMIT 1
  )
  AND bk.start_at::date = '2026-01-10'::date
  AND bk.status <> 'cancelled'
ORDER BY bk.start_at;

-- ШАГ 5: Проверить, правильно ли работает функция - сгенерировать слоты вручную
-- Это поможет понять, генерируются ли слоты вообще
WITH 
  -- Интервалы работы мастера
  work_intervals AS (
    SELECT jsonb_array_elements('[{"end":"21:00","start":"09:00"}]'::jsonb) AS j
  ),
  -- Рабочее время (09:00 - 21:00)
  work AS (
    SELECT
      ('2026-01-10'::date::text || ' ' || (j->>'start'))::timestamp AS begin_local,
      ('2026-01-10'::date::text || ' ' || (j->>'end'))::timestamp AS end_local
    FROM work_intervals
  ),
  -- Генерация слотов (15 минут шаг, 30 минут длительность услуги)
  timeline AS (
    SELECT
      generate_series(
        w.begin_local,
        w.end_local - make_interval(mins => 30),  -- длительность услуги
        make_interval(mins => 15)  -- шаг
      ) AS slot_local_start
    FROM work w
    WHERE w.end_local > w.begin_local
  ),
  slots_local AS (
    SELECT
      t.slot_local_start,
      t.slot_local_start + make_interval(mins => 30) AS slot_local_end
    FROM timeline t
  ),
  -- Преобразование в timestamptz
  slots_tz AS (
    SELECT
      (s.slot_local_start AT TIME ZONE 'Asia/Bishkek') AS slot_start,
      (s.slot_local_end AT TIME ZONE 'Asia/Bishkek') AS slot_end
    FROM slots_local s
  )
SELECT 
  COUNT(*) as total_possible_slots,
  MIN(slot_start) as first_slot,
  MAX(slot_end) as last_slot
FROM slots_tz
WHERE slot_start > NOW() + INTERVAL '30 minutes';


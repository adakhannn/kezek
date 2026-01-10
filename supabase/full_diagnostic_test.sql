-- ============================================================================
-- ПОЛНАЯ ДИАГНОСТИКА: Пошаговая проверка логики функции
-- ============================================================================
-- Выполните эти запросы в Supabase SQL Editor по порядку

-- ШАГ 1: Получить все необходимые ID и проверить данные
DO $$
DECLARE
  v_biz_id uuid;
  v_staff_id uuid;
  v_service_id uuid;
  v_service_branch_id uuid;
  v_home_branch_id uuid;
  v_temp_branch_id uuid;
  v_schedule_branch_id uuid;
  v_date date := '2026-01-10'::date;
  v_sched record;
BEGIN
  -- Получаем бизнес
  SELECT id INTO v_biz_id FROM businesses WHERE slug = 'manly' LIMIT 1;
  RAISE NOTICE '1. Бизнес ID: %', v_biz_id;

  -- Получаем мастера
  SELECT id, branch_id INTO v_staff_id, v_home_branch_id 
  FROM staff 
  WHERE biz_id = v_biz_id 
    AND full_name LIKE '%Мастер 1%' 
    AND is_active = true 
  LIMIT 1;
  RAISE NOTICE '2. Мастер ID: %, Домашний филиал: %', v_staff_id, v_home_branch_id;

  -- Получаем услугу в филиале Manly Временный (где мастер временно переведен)
  SELECT id, branch_id INTO v_service_id, v_service_branch_id
  FROM services 
  WHERE biz_id = v_biz_id 
    AND name_ru = 'Взрослая стрижка'
    AND active = true
    AND branch_id = 'c5bdc423-194c-4038-ab6e-da13e6421505'::uuid  -- Manly Временный
  LIMIT 1;
  RAISE NOTICE '3. Услуга ID: %, Филиал услуги: %', v_service_id, v_service_branch_id;

  -- Проверяем временный перевод
  SELECT branch_id INTO v_temp_branch_id
  FROM staff_schedule_rules
  WHERE biz_id = v_biz_id
    AND staff_id = v_staff_id
    AND kind = 'date'
    AND date_on = v_date
    AND is_active = true
    AND branch_id IS NOT NULL
  LIMIT 1;
  RAISE NOTICE '4. Временный филиал: %', v_temp_branch_id;

  -- Что возвращает resolve_staff_day
  SELECT * INTO v_sched FROM resolve_staff_day(v_staff_id, v_date);
  IF FOUND THEN
    v_schedule_branch_id := v_sched.branch_id;
    RAISE NOTICE '5. resolve_staff_day вернул: branch_id=%, intervals=%, breaks=%', 
      v_schedule_branch_id, v_sched.intervals, v_sched.breaks;
  ELSE
    RAISE NOTICE '5. resolve_staff_day НЕ ВЕРНУЛ расписание (NOT FOUND)';
  END IF;

  -- Проверяем совпадения
  RAISE NOTICE '6. Временный филиал = Филиал услуги? %', (v_temp_branch_id = v_service_branch_id);
  RAISE NOTICE '7. Филиал из resolve_staff_day = Филиал услуги? %', (v_schedule_branch_id = v_service_branch_id);

  -- Вызываем функцию напрямую
  RAISE NOTICE '8. Вызываем get_free_slots_service_day_v2...';
END $$;

-- ШАГ 2: Вызов функции с услугой в филиале Manly Временный
SELECT 
  'Услуга в филиале Manly Временный' as test_case,
  COUNT(*) as slots_count,
  MIN(start_at) as first_slot,
  MAX(end_at) as last_slot
FROM get_free_slots_service_day_v2(
  (SELECT id FROM businesses WHERE slug = 'manly' LIMIT 1)::uuid,
  (SELECT id FROM services WHERE name_ru = 'Взрослая стрижка' 
   AND biz_id = (SELECT id FROM businesses WHERE slug = 'manly' LIMIT 1)
   AND branch_id = 'c5bdc423-194c-4038-ab6e-da13e6421505'::uuid  -- Manly Временный
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

-- ШАГ 3: Вызов функции с услугой в филиале Manly Фрунзенская (должно вернуть 0)
SELECT 
  'Услуга в филиале Manly Фрунзенская' as test_case,
  COUNT(*) as slots_count
FROM get_free_slots_service_day_v2(
  (SELECT id FROM businesses WHERE slug = 'manly' LIMIT 1)::uuid,
  (SELECT id FROM services WHERE name_ru = 'Взрослая стрижка' 
   AND biz_id = (SELECT id FROM businesses WHERE slug = 'manly' LIMIT 1)
   AND branch_id = '87e1e9d9-02ff-40d8-a105-5fb7adf88298'::uuid  -- Manly Фрунзенская
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

-- ШАГ 4: Ручная генерация слотов (чтобы проверить, что слоты вообще могут быть сгенерированы)
WITH 
  biz AS (SELECT id, COALESCE(tz, 'Asia/Bishkek') as tz FROM businesses WHERE slug = 'manly' LIMIT 1),
  staff_schedule AS (
    SELECT * FROM resolve_staff_day(
      (SELECT id FROM staff WHERE biz_id = (SELECT id FROM biz) AND full_name LIKE '%Мастер 1%' LIMIT 1),
      '2026-01-10'::date
    )
  ),
  raw_intervals AS (
    SELECT jsonb_array_elements(ss.intervals) AS j
    FROM staff_schedule ss
    WHERE ss.intervals IS NOT NULL
  ),
  work AS (
    SELECT
      ('2026-01-10'::date::text || ' ' || (j->>'start'))::timestamp AS begin_local,
      ('2026-01-10'::date::text || ' ' || (j->>'end'))::timestamp AS end_local
    FROM raw_intervals
  ),
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
  slots_tz AS (
    SELECT
      (s.slot_local_start AT TIME ZONE (SELECT tz FROM biz)) AS slot_start,
      (s.slot_local_end AT TIME ZONE (SELECT tz FROM biz)) AS slot_end
    FROM slots_local s
  )
SELECT 
  'Ручная генерация слотов' as test_case,
  COUNT(*) as total_slots,
  MIN(slot_start) as first_slot,
  MAX(slot_end) as last_slot,
  array_agg(slot_start ORDER BY slot_start LIMIT 5) as first_5_slots
FROM slots_tz
WHERE slot_start > NOW() + INTERVAL '30 minutes';

-- ШАГ 5: Проверить, какие услуги доступны для выбранного филиала на фронтенде
-- (возможно, пользователь выбирает услугу из неправильного филиала)
SELECT 
  svc.id as service_id,
  svc.name_ru as service_name,
  svc.branch_id,
  b.name as branch_name,
  (svc.branch_id = 'c5bdc423-194c-4038-ab6e-da13e6421505'::uuid) as is_temp_branch_service
FROM services svc
JOIN branches b ON b.id = svc.branch_id
WHERE svc.biz_id = (SELECT id FROM businesses WHERE slug = 'manly' LIMIT 1)
  AND svc.name_ru = 'Взрослая стрижка'
  AND svc.active = true
ORDER BY svc.branch_id;


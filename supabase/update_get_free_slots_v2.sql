-- ============================================================================
-- ОБНОВЛЕНИЕ get_free_slots_service_day_v2 ДЛЯ УЧЕТА ВРЕМЕННЫХ ПЕРЕВОДОВ
-- ============================================================================
-- 
-- ПРОБЛЕМА: Функция проверяет v_sched.branch_id <> v_service.branch_id,
-- но не учитывает, что мастер может быть временно переведен в филиал услуги
-- через staff_schedule_rules.
--
-- РЕШЕНИЕ: Обновить проверку филиала, чтобы учитывать временные переводы.
-- Если мастер временно переведен в филиал услуги, разрешить бронирование.
--
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_free_slots_service_day_v2(
    p_biz_id uuid, 
    p_service_id uuid, 
    p_day date, 
    p_per_staff integer DEFAULT 200, 
    p_step_min integer DEFAULT 15
)
RETURNS TABLE(
    staff_id uuid, 
    branch_id uuid, 
    start_at timestamp with time zone, 
    end_at timestamp with time zone
)
LANGUAGE plpgsql
AS $function$
DECLARE
  v_service record;
  v_staff record;
  v_sched record;
  v_dur_min int;
  v_biz_tz text;
  v_effective_branch_id uuid;
BEGIN
  -- 1) сервис и его филиал
  SELECT s.id, s.biz_id, s.branch_id, s.duration_min
  INTO v_service
  FROM public.services s
  WHERE s.id = p_service_id AND s.biz_id = p_biz_id AND s.active;

  IF v_service.id IS NULL THEN
    RAISE EXCEPTION 'SERVICE_NOT_FOUND_OR_INACTIVE';
  END IF;

  v_dur_min := v_service.duration_min;

  -- tz бизнеса
  SELECT b.tz INTO v_biz_tz FROM public.businesses b WHERE b.id = p_biz_id;
  IF v_biz_tz IS NULL THEN v_biz_tz := 'Asia/Bishkek'; END IF;

  -- 2) перебираем активных сотрудников бизнеса
  FOR v_staff IN
    SELECT st.id AS staff_id, st.branch_id AS home_branch_id
    FROM public.staff st
    WHERE st.biz_id = p_biz_id
      AND st.is_active
  LOOP
    -- Сначала проверяем, есть ли временный перевод мастера в филиал услуги на эту дату
    -- Это нужно сделать ДО вызова resolve_staff_day, чтобы знать, что мастер работает в филиале услуги
    SELECT ssr.branch_id INTO v_effective_branch_id
    FROM public.staff_schedule_rules ssr
    WHERE ssr.biz_id = p_biz_id
      AND ssr.staff_id = v_staff.staff_id
      AND ssr.kind = 'date'
      AND ssr.date_on = p_day
      AND ssr.is_active = true
      AND ssr.branch_id IS NOT NULL
      AND ssr.branch_id = v_service.branch_id  -- временно переведен в филиал услуги
    LIMIT 1;

    -- Если нет временного перевода в филиал услуги, проверяем основной филиал мастера
    IF v_effective_branch_id IS NULL THEN
      SELECT st.branch_id INTO v_effective_branch_id
      FROM public.staff st
      WHERE st.id = v_staff.staff_id;
    END IF;

    -- Проверяем филиал: мастер должен работать в филиале услуги
    -- (либо основной филиал, либо временный перевод в филиал услуги)
    IF v_effective_branch_id IS NULL OR v_effective_branch_id <> v_service.branch_id THEN
      CONTINUE;
    END IF;

    -- Теперь получаем расписание на дату (resolve_staff_day уже учитывает временные переводы)
    SELECT * INTO v_sched FROM public.resolve_staff_day(v_staff.staff_id, p_day);
    IF NOT FOUND THEN CONTINUE; END IF;

    -- Проверяем, что в расписании есть интервалы работы
    IF v_sched.intervals IS NULL OR jsonb_array_length(v_sched.intervals) = 0 THEN
      CONTINUE;
    END IF;

    -- Используем branch_id из расписания (resolve_staff_day уже вернул правильный branch_id)
    v_effective_branch_id := v_sched.branch_id;

    -- генерим сетку слотов в локальном времени бизнеса → переводим в timestamptz
    RETURN QUERY
      WITH
        raw_intervals AS (
          SELECT jsonb_array_elements(v_sched.intervals) AS j
        ),
        work AS (
          SELECT
            -- локальный старт/финиш (ts without tz), собранные из p_day + 'HH:MM'
            ( (p_day::text || ' ' || (j->>'start'))::timestamp ) AS begin_local,
            ( (p_day::text || ' ' || (j->>'end'))::timestamp )   AS end_local
          FROM raw_intervals
        ),
        timeline AS (
          SELECT
            generate_series(
              w.begin_local,
              w.end_local - make_interval(mins => v_dur_min),
              make_interval(mins => p_step_min)
            ) AS slot_local_start
          FROM work w
          WHERE w.end_local > w.begin_local
        ),
        slots_local AS (
          SELECT
            t.slot_local_start,
            t.slot_local_start + make_interval(mins => v_dur_min) AS slot_local_end
          FROM timeline t
        ),
        -- убираем перерывы
        breaks_local AS (
          SELECT
            ( (p_day::text || ' ' || (j->>'start'))::timestamp ) AS b_start_local,
            ( (p_day::text || ' ' || (j->>'end'))::timestamp )   AS b_end_local
          FROM jsonb_array_elements(v_sched.breaks) AS j
        ),
        slots_no_breaks AS (
          SELECT s.*
          FROM slots_local s
          WHERE NOT EXISTS (
            SELECT 1
            FROM breaks_local b
            WHERE tstzrange((s.slot_local_start AT TIME ZONE v_biz_tz), (s.slot_local_end AT TIME ZONE v_biz_tz), '[)')
                  && tstzrange((b.b_start_local AT TIME ZONE v_biz_tz), (b.b_end_local AT TIME ZONE v_biz_tz), '[)')
          )
        ),
        slots_tz AS (
          SELECT
            -- приводим «локальное» время бизнеса к timestamptz (UTC)
            (s.slot_local_start AT TIME ZONE v_biz_tz) AS slot_start,
            (s.slot_local_end   AT TIME ZONE v_biz_tz) AS slot_end
          FROM slots_no_breaks s
        ),
        free AS (
          SELECT stz.slot_start, stz.slot_end
          FROM slots_tz stz
          WHERE NOT EXISTS (
            SELECT 1
            FROM public.bookings bk
            WHERE bk.biz_id = p_biz_id
              AND bk.staff_id = v_staff.staff_id
              AND bk.status <> 'cancelled'
              AND tstzrange(bk.start_at, bk.end_at, '[)') && tstzrange(stz.slot_start, stz.slot_end, '[)')
          )
          ORDER BY stz.slot_start
          LIMIT p_per_staff
        )
    SELECT v_staff.staff_id, v_effective_branch_id, f.slot_start, f.slot_end
    FROM free f;
  END LOOP;

  RETURN;
END$function$;


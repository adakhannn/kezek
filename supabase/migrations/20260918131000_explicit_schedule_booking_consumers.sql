-- Align existing booking consumers with the explicit scheduling resolver.
-- Legacy data is retained. Apply together with 20260918130000.
begin;
-- Исправление функции get_free_slots_service_day_v2 для обхода RLS
-- Функция должна видеть ВСЕ бронирования (confirmed, paid) независимо от пользователя
-- чтобы правильно определять свободные слоты для всех пользователей (авторизованных и неавторизованных)

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
SECURITY DEFINER
SET search_path = public
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
    -- Получаем расписание на дату (resolve_staff_day уже учитывает временные переводы)
    SELECT * INTO v_sched FROM public.resolve_staff_day(v_staff.staff_id, p_day);
    IF NOT FOUND THEN CONTINUE; END IF;

    -- Проверяем, что в расписании есть интервалы работы
    IF v_sched.intervals IS NULL OR jsonb_array_length(v_sched.intervals) = 0 THEN
      CONTINUE;
    END IF;

    -- Определяем эффективный филиал мастера на эту дату из расписания
    v_effective_branch_id := v_sched.branch_id;

    -- The canonical resolver already decided the branch. A second lookup must
    -- never resurrect a superseded transfer in a different branch.
    IF v_effective_branch_id IS DISTINCT FROM v_service.branch_id THEN CONTINUE; END IF;

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
              AND (bk.status IN ('confirmed', 'paid') OR (bk.status='hold' AND bk.expires_at>now()))
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

COMMENT ON FUNCTION public.get_free_slots_service_day_v2 IS 'Возвращает свободные слоты для услуги на указанный день. Учитывает только подтвержденные (confirmed) и оплаченные (paid) бронирования. Использует SECURITY DEFINER для обхода RLS и видит все бронирования независимо от пользователя.';



-- Исправление: слоты должны блокироваться только confirmed/paid (как в get_free_slots_service_day_v2).
-- Статус 'hold' не должен блокировать слоты — иначе при выборе нескольких услуг слоты пропадают.

create or replace function public.get_free_slots_complex_day_v1(
    p_biz_id uuid,
    p_branch_id uuid,
    p_staff_id uuid,
    p_day date,
    p_duration_min integer,
    p_step_min integer default 15,
    p_per_staff integer default 200
)
returns table(
    staff_id uuid,
    branch_id uuid,
    start_at timestamp with time zone,
    end_at timestamp with time zone
)
language plpgsql
security definer
set search_path = public
as $function$
declare
    v_staff record;
    v_sched record;
    v_biz_tz text;
    v_effective_branch_id uuid;
begin
    if p_duration_min is null or p_duration_min <= 0 then
        raise exception 'INVALID_DURATION_MIN';
    end if;

    select b.tz into v_biz_tz from public.businesses b where b.id = p_biz_id;
    if v_biz_tz is null then
        v_biz_tz := 'Asia/Bishkek';
    end if;

    for v_staff in
        select st.id as staff_id, st.branch_id as home_branch_id
        from public.staff st
        where st.biz_id = p_biz_id
          and st.is_active
          and (p_staff_id is null or st.id = p_staff_id)
    loop
        select * into v_sched from public.resolve_staff_day(v_staff.staff_id, p_day);
        if not found then continue; end if;
        if v_sched.intervals is null or jsonb_array_length(v_sched.intervals) = 0 then
            continue;
        end if;

        v_effective_branch_id := v_sched.branch_id;
        if p_branch_id is not null and v_effective_branch_id is distinct from p_branch_id then
            continue;
        end if;

        return query
        with
            raw_intervals as (
                select jsonb_array_elements(v_sched.intervals) as j
            ),
            work as (
                select
                    ((p_day::text || ' ' || (j->>'start'))::timestamp) as begin_local,
                    ((p_day::text || ' ' || (j->>'end'))::timestamp)   as end_local
                from raw_intervals
            ),
            timeline as (
                select
                    generate_series(
                        w.begin_local,
                        w.end_local - make_interval(mins => p_duration_min),
                        make_interval(mins => p_step_min)
                    ) as slot_local_start
                from work w
                where w.end_local > w.begin_local
            ),
            slots_local as (
                select
                    t.slot_local_start,
                    t.slot_local_start + make_interval(mins => p_duration_min) as slot_local_end
                from timeline t
            ),
            breaks_local as (
                select
                    ((p_day::text || ' ' || (j->>'start'))::timestamp) as b_start_local,
                    ((p_day::text || ' ' || (j->>'end'))::timestamp)   as b_end_local
                from jsonb_array_elements(coalesce(v_sched.breaks, '[]'::jsonb)) as j
            ),
            slots_no_breaks as (
                select s.*
                from slots_local s
                where not exists (
                    select 1
                    from breaks_local b
                    where tstzrange((s.slot_local_start at time zone v_biz_tz), (s.slot_local_end at time zone v_biz_tz), '[)')
                          && tstzrange((b.b_start_local at time zone v_biz_tz), (b.b_end_local at time zone v_biz_tz), '[)')
                )
            ),
            slots_tz as (
                select
                    (s.slot_local_start at time zone v_biz_tz) as slot_start,
                    (s.slot_local_end   at time zone v_biz_tz) as slot_end
                from slots_no_breaks s
            ),
            free as (
                select stz.slot_start, stz.slot_end
                from slots_tz stz
                where not exists (
                    select 1
                    from public.bookings bk
                    where bk.biz_id = p_biz_id
                      and bk.staff_id = v_staff.staff_id
                      and (bk.status in ('confirmed', 'paid') or (bk.status='hold' and bk.expires_at>now()))
                      and tstzrange(bk.start_at, bk.end_at, '[)') && tstzrange(stz.slot_start, stz.slot_end, '[)')
                )
                order by stz.slot_start
                limit p_per_staff
            )
        select v_staff.staff_id, coalesce(p_branch_id, v_effective_branch_id), f.slot_start, f.slot_end
        from free f;
    end loop;

    return;
end;
$function$;

comment on function public.get_free_slots_complex_day_v1 is 'Свободные слоты для комплекса услуг (суммарная длительность). Блокируют только confirmed/paid бронирования, как get_free_slots_service_day_v2. SECURITY DEFINER для обхода RLS при вызове от anon.';

grant execute on function public.get_free_slots_complex_day_v1(uuid, uuid, uuid, date, integer, integer, integer) to anon;
grant execute on function public.get_free_slots_complex_day_v1(uuid, uuid, uuid, date, integer, integer, integer) to authenticated;


-- Обновление функции проверки соответствия филиала брони и мастера
-- Теперь проверяем не только staff_branch_assignments, но и staff_schedule_rules
-- для поддержки временных переводов между филиалами через расписание

create or replace function public.check_booking_branch_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_date date;
    v_exists_in_assignments boolean;
    v_exists_in_schedule_rules boolean;
begin
    -- Explicit schedules determine the work location, without duplicate assignments.
    if exists(select 1 from public.staff_schedule_versions where staff_id=NEW.staff_id) then
        -- check_explicit_schedule_booking owns validation and locking. Do not
        -- revalidate historical bookings on unrelated financial/status updates.
        return NEW;
    end if;
    -- Дата брони
    v_date := (NEW.start_at)::date;

    -- Проверяем, что в истории назначений есть запись для этого мастера,
    -- филиала и бизнеса, перекрывающая дату брони.
    select exists (
        select 1
        from public.staff_branch_assignments sba
        where sba.staff_id = NEW.staff_id
          and sba.branch_id = NEW.branch_id
          and sba.biz_id = NEW.biz_id
          and sba.valid_from <= v_date
          and (sba.valid_to is null or sba.valid_to >= v_date)
    )
    into v_exists_in_assignments;

    -- Также проверяем временные переводы через staff_schedule_rules
    select exists (
        select 1
        from public.staff_schedule_rules ssr
        where ssr.staff_id = NEW.staff_id
          and ssr.branch_id = NEW.branch_id
          and ssr.biz_id = NEW.biz_id
          and ssr.kind = 'date'
          and ssr.date_on = v_date
          and ssr.is_active = true
    )
    into v_exists_in_schedule_rules;

    -- Если нет ни в assignments, ни в schedule_rules - ошибка
    if not v_exists_in_assignments and not v_exists_in_schedule_rules then
        raise exception
            'Staff % is not assigned to branch % on date %',
            NEW.staff_id, NEW.branch_id, v_date
            using errcode = '22023';
    end if;

    return NEW;
end;
$$;



commit;

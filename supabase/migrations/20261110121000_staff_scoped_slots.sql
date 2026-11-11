-- Staff scope is applied before the canonical resolver; schedule/overlap semantics remain unchanged.
BEGIN;

CREATE OR REPLACE FUNCTION public.get_free_slots_service_day_v2(
    p_biz_id uuid,
    p_service_id uuid,
    p_day date,
    p_per_staff integer,
    p_step_min integer,
    p_staff_id uuid
)
RETURNS TABLE(
    staff_id uuid,
    branch_id uuid,
    start_at timestamp with time zone,
    end_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_service record;
  v_staff record;
  v_sched record;
  v_dur_min int;
  v_biz_tz text;
  v_effective_branch_id uuid;
BEGIN
  -- current_user is the definer; the SET ROLE/session login identifies the invoker.
  IF p_staff_id IS NULL AND coalesce(nullif(current_setting('role',true),'none'),session_user)
    NOT IN ('service_role','postgres','supabase_admin') THEN
    RAISE EXCEPTION 'USE_PAGED_SLOTS';
  END IF;
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

  -- 2) Select the requested staff before resolving any schedules.
  -- Separate UNION branches retain a primary-key lookup even with a generic plan.
  FOR v_staff IN
    SELECT st.id AS staff_id, st.branch_id AS home_branch_id
    FROM public.staff st
    WHERE p_staff_id IS NULL AND st.biz_id = p_biz_id AND st.is_active
    UNION ALL
    SELECT st.id AS staff_id, st.branch_id AS home_branch_id
    FROM public.staff st
    WHERE p_staff_id IS NOT NULL AND st.id = p_staff_id
      AND st.biz_id = p_biz_id AND st.is_active
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

-- Keep the original signature/defaults unambiguous for older SQL/PostgREST clients.
-- New callers include all six named arguments; public callers must select staff.
CREATE OR REPLACE FUNCTION public.get_free_slots_service_day_v2(
    p_biz_id uuid, p_service_id uuid, p_day date,
    p_per_staff integer DEFAULT 200, p_step_min integer DEFAULT 15
) RETURNS TABLE(staff_id uuid, branch_id uuid, start_at timestamptz, end_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT * FROM public.get_free_slots_service_day_v2(
        p_biz_id, p_service_id, p_day, p_per_staff, p_step_min, NULL::uuid
    );
$$;

REVOKE ALL ON FUNCTION public.get_free_slots_service_day_v2(uuid,uuid,date,integer,integer,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_free_slots_service_day_v2(uuid,uuid,date,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_free_slots_service_day_v2(uuid,uuid,date,integer,integer,uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_free_slots_service_day_v2(uuid,uuid,date,integer,integer) TO anon, authenticated, service_role;
COMMENT ON FUNCTION public.get_free_slots_service_day_v2(uuid,uuid,date,integer,integer,uuid)
IS 'Availability for one service/day, optionally scoped to active staff before schedule resolution. NULL staff is reserved for privileged diagnostics; confirmed/paid/live holds block slots.';
COMMENT ON FUNCTION public.get_free_slots_service_day_v2(uuid,uuid,date,integer,integer)
IS 'Compatibility wrapper for all-staff availability; use the six-argument overload when a staff member is selected.';
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
set search_path = public, pg_temp
as $function$
declare
    v_staff record;
    v_sched record;
    v_biz_tz text;
    v_effective_branch_id uuid;
begin
  -- current_user is the definer; the SET ROLE/session login identifies the invoker.
  IF p_staff_id IS NULL AND coalesce(nullif(current_setting('role',true),'none'),session_user)
    NOT IN ('service_role','postgres','supabase_admin') THEN
    RAISE EXCEPTION 'USE_PAGED_SLOTS';
  END IF;
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
REVOKE ALL ON FUNCTION public.get_free_slots_complex_day_v1(uuid,uuid,uuid,date,integer,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_free_slots_complex_day_v1(uuid,uuid,uuid,date,integer,integer,integer) TO anon,authenticated,service_role;

-- Public any-staff browsing is keyset-paged. Scalar JSON is not truncated by
-- PostgREST's table row cap; it contains at most 100 slots and a continuation.
CREATE INDEX IF NOT EXISTS staff_active_biz_id_idx ON public.staff(biz_id,id) WHERE is_active;
CREATE OR REPLACE FUNCTION public.get_free_slots_page_v1(
  p_biz_id uuid, p_branch_id uuid, p_day date, p_service_id uuid,
  p_duration_min integer, p_staff_id uuid, p_cursor jsonb, p_limit integer DEFAULT 100
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_scope text;
  v_after_staff uuid;
  v_after_start timestamptz;
  v_staff record;
  v_slot record;
  v_scanned integer := 0;
  v_slots jsonb := '[]'::jsonb;
  v_next jsonb := null;
BEGIN
  IF p_biz_id IS NULL OR p_branch_id IS NULL OR p_day IS NULL
    OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100
    OR (p_service_id IS NULL AND (p_duration_min IS NULL OR p_duration_min NOT BETWEEN 1 AND 1440))
    OR (p_service_id IS NOT NULL AND p_duration_min IS NOT NULL) THEN
    RAISE EXCEPTION 'INVALID_SLOTS_PAGE_INPUT';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.branches b WHERE b.id=p_branch_id AND b.biz_id=p_biz_id AND b.is_active) THEN
    RAISE EXCEPTION 'BRANCH_NOT_FOUND_OR_INACTIVE';
  END IF;
  IF p_service_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.services s WHERE s.id=p_service_id AND s.biz_id=p_biz_id AND s.branch_id=p_branch_id AND s.active
  ) THEN RAISE EXCEPTION 'SERVICE_NOT_FOUND_OR_INACTIVE'; END IF;
  v_scope := md5(jsonb_build_array(p_biz_id,p_branch_id,p_day,p_service_id,p_duration_min,p_staff_id)::text);
  IF p_cursor IS NOT NULL THEN
    IF jsonb_typeof(p_cursor) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'INVALID_SLOTS_CURSOR'; END IF;
    IF NOT (p_cursor ?& ARRAY['v','scope','staff_id','start_at'])
      OR (SELECT count(*) FROM jsonb_object_keys(p_cursor))<>4
      OR p_cursor->'v' IS DISTINCT FROM '1'::jsonb
      OR p_cursor->>'scope' IS DISTINCT FROM v_scope
      OR jsonb_typeof(p_cursor->'staff_id') IS DISTINCT FROM 'string'
      OR (p_cursor->>'staff_id') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      OR jsonb_typeof(p_cursor->'start_at') NOT IN ('string','null') THEN
      RAISE EXCEPTION 'INVALID_SLOTS_CURSOR';
    END IF;
    v_after_staff := (p_cursor->>'staff_id')::uuid;
    BEGIN
      v_after_start := (p_cursor->>'start_at')::timestamptz;
    EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RAISE EXCEPTION 'INVALID_SLOTS_CURSOR'; END;
    IF (v_after_start IS NOT NULL AND NOT isfinite(v_after_start))
      OR (p_staff_id IS NOT NULL AND p_staff_id<>v_after_staff) THEN RAISE EXCEPTION 'INVALID_SLOTS_CURSOR'; END IF;
  END IF;
  FOR v_staff IN
    SELECT st.id FROM public.staff st
    WHERE st.biz_id=p_biz_id AND st.is_active AND (p_staff_id IS NULL OR st.id=p_staff_id)
      AND (v_after_staff IS NULL OR st.id>v_after_staff OR (st.id=v_after_staff AND v_after_start IS NOT NULL))
    ORDER BY st.id LIMIT 9
  LOOP
    -- Ninth candidate is a cheap lookahead only, never a ninth resolver call.
    IF v_scanned=8 THEN RETURN jsonb_build_object('slots',v_slots,'next_cursor',v_next); END IF;
    v_scanned := v_scanned+1;
    FOR v_slot IN
      SELECT DISTINCT s.staff_id,s.branch_id,s.start_at,s.end_at FROM (
        SELECT a.* FROM public.get_free_slots_service_day_v2(
          p_biz_id,p_service_id,p_day,2147483647,15,v_staff.id
        ) a WHERE p_service_id IS NOT NULL
        UNION ALL
        SELECT a.* FROM public.get_free_slots_complex_day_v1(
          p_biz_id,p_branch_id,v_staff.id,p_day,p_duration_min,15,2147483647
        ) a WHERE p_service_id IS NULL
      ) s
      WHERE s.branch_id=p_branch_id
        AND (v_after_staff IS DISTINCT FROM v_staff.id OR v_after_start IS NULL OR s.start_at>v_after_start)
      ORDER BY s.start_at,s.end_at
      LIMIT p_limit+1
    LOOP
      IF jsonb_array_length(v_slots)=p_limit THEN
        RETURN jsonb_build_object('slots',v_slots,'next_cursor',v_next);
      END IF;
      v_slots := v_slots || jsonb_build_array(to_jsonb(v_slot));
      v_next := jsonb_build_object('v',1,'scope',v_scope,'staff_id',v_staff.id,'start_at',v_slot.start_at);
    END LOOP;
    -- NULL start means this staff was exhausted, including empty schedules.
    v_next := jsonb_build_object('v',1,'scope',v_scope,'staff_id',v_staff.id,'start_at',null);
  END LOOP;
  RETURN jsonb_build_object('slots',v_slots,'next_cursor',null);
END;
$$;
REVOKE ALL ON FUNCTION public.get_free_slots_page_v1(uuid,uuid,date,uuid,integer,uuid,jsonb,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_free_slots_page_v1(uuid,uuid,date,uuid,integer,uuid,jsonb,integer) TO anon,authenticated,service_role;
COMMENT ON FUNCTION public.get_free_slots_page_v1(uuid,uuid,date,uuid,integer,uuid,jsonb,integer)
IS 'At most 100 slots and 8 staff resolver calls per page; staff/start keyset cursor is filter-scoped. Empty pages can have continuation. 15-minute grid; no per-staff truncation before cursor.';
COMMIT;

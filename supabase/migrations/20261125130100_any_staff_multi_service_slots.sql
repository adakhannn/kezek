-- R25-11: "any master" with several services showed slots of masters who do not perform those
-- services; picking one failed in the hold (STAFF_DOES_NOT_PERFORM_SERVICE) with a generic error.
-- get_free_slots_page_v1 gains an optional p_service_ids: when given (multi-service, p_service_id
-- NULL), only masters who perform every listed service are scanned. The old eight-argument call
-- still resolves through the DEFAULT, so this migration and the web deploy can go in either order.
-- Body otherwise as in 20261110121000.

DROP FUNCTION IF EXISTS public.get_free_slots_page_v1(uuid,uuid,date,uuid,integer,uuid,jsonb,integer);

CREATE OR REPLACE FUNCTION public.get_free_slots_page_v1(
  p_biz_id uuid, p_branch_id uuid, p_day date, p_service_id uuid,
  p_duration_min integer, p_staff_id uuid, p_cursor jsonb, p_limit integer DEFAULT 100,
  p_service_ids uuid[] DEFAULT NULL
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
    OR (p_service_id IS NOT NULL AND p_duration_min IS NOT NULL)
    OR (p_service_ids IS NOT NULL AND (p_service_id IS NOT NULL OR cardinality(p_service_ids) NOT BETWEEN 1 AND 20)) THEN
    RAISE EXCEPTION 'INVALID_SLOTS_PAGE_INPUT';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.branches b WHERE b.id=p_branch_id AND b.biz_id=p_biz_id AND b.is_active) THEN
    RAISE EXCEPTION 'BRANCH_NOT_FOUND_OR_INACTIVE';
  END IF;
  IF p_service_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.services s WHERE s.id=p_service_id AND s.biz_id=p_biz_id AND s.branch_id=p_branch_id AND s.active
  ) THEN RAISE EXCEPTION 'SERVICE_NOT_FOUND_OR_INACTIVE'; END IF;
  v_scope := md5(jsonb_build_array(p_biz_id,p_branch_id,p_day,p_service_id,p_duration_min,p_staff_id)::text
    || coalesce(array_to_string(p_service_ids,','),''));
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
      -- R25-11: a multi-service "any master" page lists only masters who perform every service,
      -- the same rule the hold applies (_staff_performs_service).
      AND (p_service_ids IS NULL OR NOT EXISTS(
        SELECT 1 FROM unnest(p_service_ids) sid WHERE NOT public._staff_performs_service(st.id,sid,p_branch_id)))
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
REVOKE ALL ON FUNCTION public.get_free_slots_page_v1(uuid,uuid,date,uuid,integer,uuid,jsonb,integer,uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_free_slots_page_v1(uuid,uuid,date,uuid,integer,uuid,jsonb,integer,uuid[]) TO anon,authenticated,service_role;
COMMENT ON FUNCTION public.get_free_slots_page_v1(uuid,uuid,date,uuid,integer,uuid,jsonb,integer,uuid[])
IS 'At most 100 slots and 8 staff resolver calls per page; staff/start keyset cursor is filter-scoped. p_service_ids (multi-service any-staff) keeps only masters who perform every service. Empty pages can have continuation. 15-minute grid; no per-staff truncation before cursor.';

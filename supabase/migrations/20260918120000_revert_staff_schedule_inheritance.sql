-- Revert only the schedule-inheritance experiment; preserve migration history.
begin;
CREATE OR REPLACE FUNCTION public.resolve_staff_day(p_staff_id uuid, p_date date)
RETURNS TABLE(branch_id uuid, tz text, intervals jsonb, breaks jsonb)
LANGUAGE plpgsql
SECURITY INVOKER
AS $function$
DECLARE
  v_row record;
  v_sched_found boolean := false;
  v_biz uuid;
  v_branch uuid;
  v_tz text;
  v_intervals jsonb := '[]'::jsonb;
  v_breaks jsonb := '[]'::jsonb;
  dow int := EXTRACT(DOW FROM p_date);
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.staff_time_off t
    WHERE t.staff_id = p_staff_id AND p_date BETWEEN t.date_from AND t.date_to
  ) THEN RETURN; END IF;
  SELECT st.biz_id, b.tz INTO v_biz, v_tz
  FROM public.staff st JOIN public.businesses b ON b.id = st.biz_id
  WHERE st.id = p_staff_id;
  IF v_biz IS NULL THEN RETURN; END IF;
  FOR v_row IN
    SELECT * FROM public.staff_schedule_rules r
    WHERE r.staff_id = p_staff_id AND r.is_active AND (
      (r.kind='date' AND r.date_on = p_date)
      OR (r.kind='range' AND p_date BETWEEN r.date_from AND r.date_to)
      OR (r.kind='weekly' AND r.day_of_week = dow)
    )
    ORDER BY CASE r.kind WHEN 'date' THEN 3 WHEN 'range' THEN 2 ELSE 1 END DESC,
      r.priority DESC, r.created_at DESC
  LOOP
    branch_id := v_row.branch_id;
    tz := COALESCE(v_row.tz, v_tz, 'Asia/Bishkek');
    intervals := COALESCE(v_row.intervals, '[]'::jsonb);
    breaks := COALESCE(v_row.breaks, '[]'::jsonb);
    v_sched_found := true;
    RETURN NEXT; RETURN;
  END LOOP;
  IF NOT v_sched_found THEN
    SELECT st.branch_id INTO v_branch FROM public.staff st WHERE st.id = p_staff_id;
    IF v_branch IS NULL THEN RETURN; END IF;
    SELECT wh.intervals, wh.breaks INTO v_intervals, v_breaks
    FROM public.working_hours wh
    WHERE wh.staff_id = p_staff_id AND wh.day_of_week = dow AND wh.biz_id = v_biz
    LIMIT 1;
    IF v_intervals IS NULL THEN RETURN; END IF;
    branch_id := v_branch;
    tz := COALESCE(v_tz, 'Asia/Bishkek');
    intervals := v_intervals;
    breaks := COALESCE(v_breaks, '[]'::jsonb);
    RETURN NEXT; RETURN;
  END IF;
  RETURN;
END
$function$;
ALTER FUNCTION public.resolve_staff_day(uuid, date) RESET ALL;
COMMENT ON FUNCTION public.resolve_staff_day(uuid, date) IS NULL;
DROP POLICY IF EXISTS "Staff can view their home branch working hours" ON public.branch_working_hours;
INSERT INTO supabase_migrations.schema_migrations(version, name)
VALUES ('20260918120000', 'revert_staff_schedule_inheritance')
ON CONFLICT (version) DO NOTHING;
commit;

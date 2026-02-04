-- Исправление ошибки "aggregate function calls cannot be nested" в get_business_finance_stats
-- Проблема: использование агрегатных функций (count, sum) внутри jsonb_agg
-- Решение: разделение на CTE для избежания вложенных агрегатов

CREATE OR REPLACE FUNCTION public.get_business_finance_stats(
    p_biz_id uuid,
    p_date_from date,
    p_date_to date,
    p_branch_id uuid DEFAULT NULL,
    p_include_open boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result jsonb;
    v_today date;
BEGIN
    v_today := current_date;
    
    -- Сначала получаем статистику по каждому сотруднику
    WITH staff_data AS (
        SELECT 
            st.id AS staff_id,
            st.full_name AS staff_name,
            st.is_active,
            st.branch_id,
            COUNT(s.id) AS total_shifts,
            COUNT(*) FILTER (WHERE s.status = 'closed') AS closed_shifts,
            COUNT(*) FILTER (WHERE s.status = 'open') AS open_shifts,
            COALESCE(SUM(s.total_amount) FILTER (WHERE s.status = 'closed'), 0) AS total_amount,
            COALESCE(SUM(s.master_share) FILTER (WHERE s.status = 'closed'), 0) AS total_master,
            COALESCE(SUM(s.salon_share) FILTER (WHERE s.status = 'closed'), 0) AS total_salon,
            COALESCE(SUM(s.consumables_amount) FILTER (WHERE s.status = 'closed'), 0) AS total_consumables,
            COALESCE(SUM(s.late_minutes) FILTER (WHERE s.status = 'closed'), 0) AS total_late_minutes
        FROM public.staff st
        LEFT JOIN public.staff_shifts s ON s.staff_id = st.id
            AND s.biz_id = p_biz_id
            AND s.shift_date >= p_date_from
            AND s.shift_date <= p_date_to
        WHERE st.biz_id = p_biz_id
          AND (p_branch_id IS NULL OR st.branch_id = p_branch_id)
        GROUP BY st.id, st.full_name, st.is_active, st.branch_id
    ),
    staff_stats_json AS (
        SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
                'staff_id', sd.staff_id,
                'staff_name', sd.staff_name,
                'is_active', sd.is_active,
                'branch_id', sd.branch_id,
                'shifts', jsonb_build_object(
                    'total', sd.total_shifts,
                    'closed', sd.closed_shifts,
                    'open', sd.open_shifts
                ),
                'stats', jsonb_build_object(
                    'total_amount', sd.total_amount,
                    'total_master', sd.total_master,
                    'total_salon', sd.total_salon,
                    'total_consumables', sd.total_consumables,
                    'total_late_minutes', sd.total_late_minutes
                )
            )
            ORDER BY sd.staff_name
        ), '[]'::jsonb) AS staff_stats
        FROM staff_data sd
    ),
    total_data AS (
        SELECT 
            COUNT(s.id) AS total_shifts,
            COUNT(*) FILTER (WHERE s.status = 'closed') AS closed_shifts,
            COUNT(*) FILTER (WHERE s.status = 'open') AS open_shifts,
            COALESCE(SUM(s.total_amount) FILTER (WHERE s.status = 'closed'), 0) AS total_amount,
            COALESCE(SUM(s.master_share) FILTER (WHERE s.status = 'closed'), 0) AS total_master,
            COALESCE(SUM(s.salon_share) FILTER (WHERE s.status = 'closed'), 0) AS total_salon,
            COALESCE(SUM(s.consumables_amount) FILTER (WHERE s.status = 'closed'), 0) AS total_consumables,
            COALESCE(SUM(s.late_minutes) FILTER (WHERE s.status = 'closed'), 0) AS total_late_minutes
        FROM public.staff st
        LEFT JOIN public.staff_shifts s ON s.staff_id = st.id
            AND s.biz_id = p_biz_id
            AND s.shift_date >= p_date_from
            AND s.shift_date <= p_date_to
        WHERE st.biz_id = p_biz_id
          AND (p_branch_id IS NULL OR st.branch_id = p_branch_id)
    )
    SELECT jsonb_build_object(
        'staff_stats', ssj.staff_stats,
        'total_stats', jsonb_build_object(
            'total_shifts', td.total_shifts,
            'closed_shifts', td.closed_shifts,
            'open_shifts', td.open_shifts,
            'total_amount', td.total_amount,
            'total_master', td.total_master,
            'total_salon', td.total_salon,
            'total_consumables', td.total_consumables,
            'total_late_minutes', td.total_late_minutes
        )
    )
    INTO v_result
    FROM staff_stats_json ssj
    CROSS JOIN total_data td;
    
    -- Если нужно включить открытые смены, добавляем их расчеты
    IF p_include_open THEN
        -- Для открытых смен нужно считать из позиций
        -- Это делается отдельно, так как требует JOIN с staff_shift_items
        -- Пока оставляем это на стороне API для гибкости
    END IF;
    
    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_business_finance_stats IS 'Получает финансовую статистику по всем сотрудникам бизнеса за период. Исправлена версия без вложенных агрегатных функций.';

-- Предоставляем права на выполнение функции
GRANT EXECUTE ON FUNCTION public.get_business_finance_stats(uuid, date, date, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_business_finance_stats(uuid, date, date, uuid, boolean) TO service_role;


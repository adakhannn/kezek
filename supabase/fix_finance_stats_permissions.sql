-- Скрипт для проверки и исправления прав доступа к функциям финансовой статистики
-- Выполните этот скрипт в Supabase SQL Editor, если функция не работает

-- Проверяем текущее определение функции
SELECT 
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname IN ('get_business_finance_stats', 'get_staff_finance_stats');

-- Пересоздаем функцию с правильными параметрами безопасности
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
    
    -- Получаем статистику по всем сотрудникам
    SELECT jsonb_build_object(
        'staff_stats', COALESCE(jsonb_agg(
            jsonb_build_object(
                'staff_id', st.id,
                'staff_name', st.full_name,
                'is_active', st.is_active,
                'branch_id', st.branch_id,
                'shifts', jsonb_build_object(
                    'total', COUNT(s.id),
                    'closed', COUNT(*) FILTER (WHERE s.status = 'closed'),
                    'open', COUNT(*) FILTER (WHERE s.status = 'open')
                ),
                'stats', jsonb_build_object(
                    'total_amount', COALESCE(SUM(s.total_amount) FILTER (WHERE s.status = 'closed'), 0),
                    'total_master', COALESCE(SUM(s.master_share) FILTER (WHERE s.status = 'closed'), 0),
                    'total_salon', COALESCE(SUM(s.salon_share) FILTER (WHERE s.status = 'closed'), 0),
                    'total_consumables', COALESCE(SUM(s.consumables_amount) FILTER (WHERE s.status = 'closed'), 0),
                    'total_late_minutes', COALESCE(SUM(s.late_minutes) FILTER (WHERE s.status = 'closed'), 0)
                )
            )
            ORDER BY st.full_name
        ), '[]'::jsonb),
        'total_stats', jsonb_build_object(
            'total_shifts', COUNT(s.id),
            'closed_shifts', COUNT(*) FILTER (WHERE s.status = 'closed'),
            'open_shifts', COUNT(*) FILTER (WHERE s.status = 'open'),
            'total_amount', COALESCE(SUM(s.total_amount) FILTER (WHERE s.status = 'closed'), 0),
            'total_master', COALESCE(SUM(s.master_share) FILTER (WHERE s.status = 'closed'), 0),
            'total_salon', COALESCE(SUM(s.salon_share) FILTER (WHERE s.status = 'closed'), 0),
            'total_consumables', COALESCE(SUM(s.consumables_amount) FILTER (WHERE s.status = 'closed'), 0),
            'total_late_minutes', COALESCE(SUM(s.late_minutes) FILTER (WHERE s.status = 'closed'), 0)
        )
    )
    INTO v_result
    FROM public.staff st
    LEFT JOIN public.staff_shifts s ON s.staff_id = st.id
        AND s.biz_id = p_biz_id
        AND s.shift_date >= p_date_from
        AND s.shift_date <= p_date_to
    WHERE st.biz_id = p_biz_id
      AND (p_branch_id IS NULL OR st.branch_id = p_branch_id)
    GROUP BY st.id, st.full_name, st.is_active, st.branch_id;
    
    RETURN v_result;
END;
$$;

-- Предоставляем права на выполнение функции
GRANT EXECUTE ON FUNCTION public.get_business_finance_stats(uuid, date, date, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_business_finance_stats(uuid, date, date, uuid, boolean) TO service_role;

-- Проверяем права доступа
SELECT 
    p.proname as function_name,
    r.rolname as role_name,
    has_function_privilege(r.rolname, p.oid, 'EXECUTE') as can_execute
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
CROSS JOIN pg_roles r
WHERE n.nspname = 'public' 
  AND p.proname = 'get_business_finance_stats'
  AND r.rolname IN ('authenticated', 'service_role', 'anon');


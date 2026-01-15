-- Скрипт для ручного расчета рейтингов
-- Используется для первоначального расчета или пересчета рейтингов

-- 1. Пересчитываем метрики за последние 30 дней для всех активных сотрудников
DO $$
DECLARE
    v_staff_record RECORD;
    v_date DATE;
    v_days_back INTEGER := 30;
BEGIN
    -- Перебираем всех активных сотрудников
    FOR v_staff_record IN 
        SELECT id FROM public.staff WHERE is_active = true
    LOOP
        -- Перебираем последние 30 дней
        FOR i IN 0..v_days_back LOOP
            v_date := CURRENT_DATE - i;
            
            BEGIN
                -- Рассчитываем метрики за день
                PERFORM public.calculate_staff_day_metrics(v_staff_record.id, v_date);
            EXCEPTION WHEN OTHERS THEN
                RAISE WARNING 'Error calculating metrics for staff % on date %: %', 
                    v_staff_record.id, v_date, SQLERRM;
            END;
        END LOOP;
        
        -- Рассчитываем агрегированный рейтинг сотрудника
        BEGIN
            PERFORM public.calculate_staff_rating(v_staff_record.id);
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Error calculating rating for staff %: %', 
                v_staff_record.id, SQLERRM;
        END;
    END LOOP;
END $$;

-- 2. Пересчитываем метрики филиалов за последние 30 дней
DO $$
DECLARE
    v_branch_record RECORD;
    v_date DATE;
    v_days_back INTEGER := 30;
BEGIN
    FOR v_branch_record IN 
        SELECT id FROM public.branches WHERE is_active = true
    LOOP
        FOR i IN 0..v_days_back LOOP
            v_date := CURRENT_DATE - i;
            
            BEGIN
                PERFORM public.calculate_branch_day_metrics(v_branch_record.id, v_date);
            EXCEPTION WHEN OTHERS THEN
                RAISE WARNING 'Error calculating metrics for branch % on date %: %', 
                    v_branch_record.id, v_date, SQLERRM;
            END;
        END LOOP;
        
        BEGIN
            PERFORM public.calculate_branch_rating(v_branch_record.id);
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Error calculating rating for branch %: %', 
                v_branch_record.id, SQLERRM;
        END;
    END LOOP;
END $$;

-- 3. Пересчитываем метрики бизнесов за последние 30 дней
DO $$
DECLARE
    v_biz_record RECORD;
    v_date DATE;
    v_days_back INTEGER := 30;
BEGIN
    FOR v_biz_record IN 
        SELECT id FROM public.businesses WHERE is_approved = true
    LOOP
        FOR i IN 0..v_days_back LOOP
            v_date := CURRENT_DATE - i;
            
            BEGIN
                PERFORM public.calculate_biz_day_metrics(v_biz_record.id, v_date);
            EXCEPTION WHEN OTHERS THEN
                RAISE WARNING 'Error calculating metrics for biz % on date %: %', 
                    v_biz_record.id, v_date, SQLERRM;
            END;
        END LOOP;
        
        BEGIN
            PERFORM public.calculate_biz_rating(v_biz_record.id);
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Error calculating rating for biz %: %', 
                v_biz_record.id, SQLERRM;
        END;
    END LOOP;
END $$;

-- 4. Проверяем результаты
SELECT 
    'Staff ratings' as type,
    COUNT(*) FILTER (WHERE rating_score IS NOT NULL AND rating_score > 0) as with_rating,
    COUNT(*) FILTER (WHERE rating_score IS NULL OR rating_score = 0) as without_rating,
    AVG(rating_score) FILTER (WHERE rating_score > 0) as avg_rating
FROM public.staff
WHERE is_active = true

UNION ALL

SELECT 
    'Branch ratings' as type,
    COUNT(*) FILTER (WHERE rating_score IS NOT NULL AND rating_score > 0) as with_rating,
    COUNT(*) FILTER (WHERE rating_score IS NULL OR rating_score = 0) as without_rating,
    AVG(rating_score) FILTER (WHERE rating_score > 0) as avg_rating
FROM public.branches
WHERE is_active = true

UNION ALL

SELECT 
    'Business ratings' as type,
    COUNT(*) FILTER (WHERE rating_score IS NOT NULL AND rating_score > 0) as with_rating,
    COUNT(*) FILTER (WHERE rating_score IS NULL OR rating_score = 0) as without_rating,
    AVG(rating_score) FILTER (WHERE rating_score > 0) as avg_rating
FROM public.businesses
WHERE is_approved = true;


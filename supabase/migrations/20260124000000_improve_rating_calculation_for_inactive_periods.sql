-- Улучшение расчета рейтингов для периодов без активности
-- Если нет метрик в окне расчета, используем последний известный рейтинг или дефолтный 50.0

-- 1. Улучшенная функция расчета рейтинга сотрудника
create or replace function public.calculate_staff_rating(
    p_staff_id uuid
)
returns numeric
language plpgsql
as $$
declare
    v_config record;
    v_avg_day_score numeric;
    v_rating numeric;
    v_last_rating numeric;
    v_metrics_count integer;
    v_default_rating numeric := 50.0;
begin
    -- Получаем активную конфигурацию
    select * into v_config
    from public.rating_global_config
    where is_active = true
    order by valid_from desc
    limit 1;
    
    if v_config is null then
        return null;
    end if;
    
    -- Рассчитываем средний дневной рейтинг за последние N дней
    -- Считаем только дни с активностью (метрики создаются только при наличии активности)
    select 
        avg(day_score),
        count(*)
    into v_avg_day_score, v_metrics_count
    from public.staff_day_metrics
    where staff_id = p_staff_id
      and metric_date >= current_date - (v_config.window_days || ' days')::interval
      and metric_date < current_date;
    
    -- Если есть метрики в окне - используем среднее
    if v_metrics_count > 0 and v_avg_day_score is not null then
        v_rating := round(v_avg_day_score::numeric, 2);
    else
        -- Если нет метрик в окне, используем последний известный рейтинг
        select rating_score into v_last_rating
        from public.staff
        where id = p_staff_id;
        
        if v_last_rating is not null and v_last_rating > 0 then
            -- Используем последний известный рейтинг (не снижаем его резко)
            v_rating := v_last_rating;
        else
            -- Если вообще нет истории, используем дефолтный рейтинг
            v_rating := v_default_rating;
        end if;
    end if;
    
    -- Обновляем рейтинг в таблице staff
    update public.staff
    set 
        rating_score = v_rating,
        rating_updated_at = timezone('utc'::text, now())
    where id = p_staff_id;
    
    return v_rating;
end;
$$;

comment on function public.calculate_staff_rating is 'Рассчитывает агрегированный рейтинг сотрудника за последние 30 дней. Если нет метрик в окне, использует последний известный рейтинг или дефолтный 50.0.';

-- 2. Улучшенная функция расчета рейтинга филиала
create or replace function public.calculate_branch_rating(
    p_branch_id uuid
)
returns numeric
language plpgsql
as $$
declare
    v_config record;
    v_avg_day_score numeric;
    v_rating numeric;
    v_last_rating numeric;
    v_metrics_count integer;
    v_default_rating numeric := 50.0;
begin
    -- Получаем активную конфигурацию
    select * into v_config
    from public.rating_global_config
    where is_active = true
    order by valid_from desc
    limit 1;
    
    if v_config is null then
        return null;
    end if;
    
    -- Рассчитываем средний дневной рейтинг за последние N дней
    select 
        avg(day_score),
        count(*)
    into v_avg_day_score, v_metrics_count
    from public.branch_day_metrics
    where branch_id = p_branch_id
      and metric_date >= current_date - (v_config.window_days || ' days')::interval
      and metric_date < current_date;
    
    -- Если есть метрики в окне - используем среднее
    if v_metrics_count > 0 and v_avg_day_score is not null then
        v_rating := round(v_avg_day_score::numeric, 2);
    else
        -- Если нет метрик в окне, используем последний известный рейтинг
        select rating_score into v_last_rating
        from public.branches
        where id = p_branch_id;
        
        if v_last_rating is not null and v_last_rating > 0 then
            -- Используем последний известный рейтинг
            v_rating := v_last_rating;
        else
            -- Если вообще нет истории, рассчитываем как средний рейтинг сотрудников или дефолтный
            select coalesce(avg(s.rating_score), v_default_rating) into v_rating
            from public.staff s
            where s.branch_id = p_branch_id 
              and s.is_active = true 
              and s.rating_score is not null 
              and s.rating_score > 0;
            
            if v_rating is null or v_rating = 0 then
                v_rating := v_default_rating;
            end if;
        end if;
    end if;
    
    -- Обновляем рейтинг в таблице branches
    update public.branches
    set 
        rating_score = v_rating,
        rating_updated_at = timezone('utc'::text, now())
    where id = p_branch_id;
    
    return v_rating;
end;
$$;

comment on function public.calculate_branch_rating is 'Рассчитывает агрегированный рейтинг филиала за последние 30 дней. Если нет метрик в окне, использует последний известный рейтинг или средний рейтинг сотрудников или дефолтный 50.0.';

-- 3. Улучшенная функция расчета рейтинга бизнеса
create or replace function public.calculate_biz_rating(
    p_biz_id uuid
)
returns numeric
language plpgsql
as $$
declare
    v_config record;
    v_avg_day_score numeric;
    v_rating numeric;
    v_last_rating numeric;
    v_metrics_count integer;
    v_default_rating numeric := 50.0;
begin
    -- Получаем активную конфигурацию
    select * into v_config
    from public.rating_global_config
    where is_active = true
    order by valid_from desc
    limit 1;
    
    if v_config is null then
        return null;
    end if;
    
    -- Рассчитываем средний дневной рейтинг за последние N дней
    select 
        avg(day_score),
        count(*)
    into v_avg_day_score, v_metrics_count
    from public.biz_day_metrics
    where biz_id = p_biz_id
      and metric_date >= current_date - (v_config.window_days || ' days')::interval
      and metric_date < current_date;
    
    -- Если есть метрики в окне - используем среднее
    if v_metrics_count > 0 and v_avg_day_score is not null then
        v_rating := round(v_avg_day_score::numeric, 2);
    else
        -- Если нет метрик в окне, используем последний известный рейтинг
        select rating_score into v_last_rating
        from public.businesses
        where id = p_biz_id;
        
        if v_last_rating is not null and v_last_rating > 0 then
            -- Используем последний известный рейтинг
            v_rating := v_last_rating;
        else
            -- Если вообще нет истории, рассчитываем как средний рейтинг филиалов или дефолтный
            select coalesce(avg(br.rating_score), v_default_rating) into v_rating
            from public.branches br
            where br.biz_id = p_biz_id 
              and br.is_active = true 
              and br.rating_score is not null 
              and br.rating_score > 0;
            
            if v_rating is null or v_rating = 0 then
                v_rating := v_default_rating;
            end if;
        end if;
    end if;
    
    -- Обновляем рейтинг в таблице businesses
    update public.businesses
    set 
        rating_score = v_rating,
        rating_updated_at = timezone('utc'::text, now())
    where id = p_biz_id;
    
    return v_rating;
end;
$$;

comment on function public.calculate_biz_rating is 'Рассчитывает агрегированный рейтинг бизнеса за последние 30 дней. Если нет метрик в окне, использует последний известный рейтинг или средний рейтинг филиалов или дефолтный 50.0.';


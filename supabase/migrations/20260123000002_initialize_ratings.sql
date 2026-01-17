-- Миграция для инициализации рейтингов: пересчет исторических данных и установка начальных значений

-- Функция для пересчета всех рейтингов за диапазон дат
create or replace function public.recalculate_ratings_for_date_range(p_start_date date, p_end_date date)
returns void
language plpgsql
as $$
declare
    v_current_date date;
    r_staff record;
    r_branch record;
    r_biz record;
begin
    raise notice 'Initializing ratings from % to %', p_start_date, p_end_date;
    
    -- Пересчитываем метрики за каждый день в диапазоне
    v_current_date := p_start_date;
    while v_current_date <= p_end_date loop
        raise notice 'Processing date: %', v_current_date;
        
        -- 1. Пересчитываем ежедневные метрики для всех сотрудников за эту дату
        for r_staff in select id, biz_id, branch_id from public.staff loop
            begin
                perform public.calculate_staff_day_metrics(r_staff.id, v_current_date);
            exception when others then
                raise notice 'Error calculating staff metrics for staff_id=%, date=%: %', r_staff.id, v_current_date, SQLERRM;
            end;
        end loop;

        -- 2. Пересчитываем ежедневные метрики для всех филиалов за эту дату
        for r_branch in select id, biz_id from public.branches loop
            begin
                perform public.calculate_branch_day_metrics(r_branch.id, v_current_date);
            exception when others then
                raise notice 'Error calculating branch metrics for branch_id=%, date=%: %', r_branch.id, v_current_date, SQLERRM;
            end;
        end loop;

        -- 3. Пересчитываем ежедневные метрики для всех бизнесов за эту дату
        for r_biz in select id from public.businesses loop
            begin
                perform public.calculate_biz_day_metrics(r_biz.id, v_current_date);
            exception when others then
                raise notice 'Error calculating biz metrics for biz_id=%, date=%: %', r_biz.id, v_current_date, SQLERRM;
            end;
        end loop;
        
        v_current_date := v_current_date + interval '1 day';
    end loop;
    
    raise notice 'Finished processing date range';
end;
$$;

comment on function public.recalculate_ratings_for_date_range(date, date) is 'Пересчитывает рейтинги за диапазон дат (для инициализации исторических данных)';

-- Функция для полной инициализации рейтингов
create or replace function public.initialize_all_ratings(p_days_back integer default 30)
returns void
language plpgsql
as $$
declare
    v_config public.rating_global_config;
    v_start_date date;
    v_end_date date;
    r_staff record;
    r_branch record;
    r_biz record;
    v_staff_rating numeric;
    v_branch_rating numeric;
    v_biz_rating numeric;
    v_default_rating numeric := 50.0; -- Стартовый рейтинг для новых бизнесов
begin
    raise notice 'Starting rating initialization (last % days)', p_days_back;
    
    -- Получаем активную конфигурацию
    select * into v_config
    from public.rating_global_config
    where is_active = true
    order by valid_from desc
    limit 1;
    
    if v_config is null then
        raise exception 'No active rating configuration found';
    end if;
    
    -- Определяем диапазон дат для пересчета
    v_end_date := timezone('Asia/Bishkek', now())::date - interval '1 day'; -- Вчера
    v_start_date := v_end_date - (p_days_back || ' days')::interval;
    
    raise notice 'Recalculating metrics from % to %', v_start_date, v_end_date;
    
    -- Пересчитываем метрики за весь диапазон
    perform public.recalculate_ratings_for_date_range(v_start_date, v_end_date);
    
    raise notice 'Updating aggregated ratings...';
    
    -- 4. Обновляем агрегированные рейтинги в таблицах staff, branches, businesses
    for r_staff in select id from public.staff loop
        begin
            v_staff_rating := public.calculate_staff_rating(r_staff.id);
            -- Если рейтинг NULL или 0, устанавливаем начальный рейтинг
            if v_staff_rating is null or v_staff_rating = 0 then
                v_staff_rating := v_default_rating;
            end if;
            update public.staff set rating_score = v_staff_rating where id = r_staff.id;
        exception when others then
            raise notice 'Error updating staff rating for staff_id=%: %', r_staff.id, SQLERRM;
            -- Устанавливаем минимальный рейтинг при ошибке
            update public.staff set rating_score = v_default_rating where id = r_staff.id and (rating_score is null or rating_score = 0);
        end;
    end loop;

    for r_branch in select id from public.branches loop
        begin
            v_branch_rating := public.calculate_branch_rating(r_branch.id);
            -- Если рейтинг NULL или 0, рассчитываем как средний рейтинг сотрудников
            if v_branch_rating is null or v_branch_rating = 0 then
                select coalesce(avg(rating_score), v_default_rating) into v_branch_rating
                from public.staff
                where branch_id = r_branch.id and is_active = true;
            end if;
            update public.branches set rating_score = v_branch_rating where id = r_branch.id;
        exception when others then
            raise notice 'Error updating branch rating for branch_id=%: %', r_branch.id, SQLERRM;
            -- Устанавливаем минимальный рейтинг при ошибке
            update public.branches set rating_score = v_default_rating where id = r_branch.id and (rating_score is null or rating_score = 0);
        end;
    end loop;

    for r_biz in select id from public.businesses loop
        begin
            v_biz_rating := public.calculate_biz_rating(r_biz.id);
            -- Если рейтинг NULL или 0, рассчитываем как средний рейтинг филиалов
            if v_biz_rating is null or v_biz_rating = 0 then
                select coalesce(avg(rating_score), v_default_rating) into v_biz_rating
                from public.branches
                where biz_id = r_biz.id and is_active = true;
            end if;
            update public.businesses set rating_score = v_biz_rating where id = r_biz.id;
        exception when others then
            raise notice 'Error updating biz rating for biz_id=%: %', r_biz.id, SQLERRM;
            -- Устанавливаем минимальный рейтинг при ошибке
            update public.businesses set rating_score = v_default_rating where id = r_biz.id and (rating_score is null or rating_score = 0);
        end;
    end loop;
    
    raise notice 'Rating initialization completed';
end;
$$;

comment on function public.initialize_all_ratings(integer) is 'Инициализирует рейтинги для всех бизнесов, филиалов и сотрудников. Пересчитывает метрики за последние N дней и устанавливает начальные рейтинги.';

-- Устанавливаем начальные рейтинги для всех существующих записей (если они NULL или 0)
-- Это обеспечит, что даже без исторических данных у всех будет базовый рейтинг
do $$
declare
    v_default_rating numeric := 50.0;
begin
    -- Обновляем рейтинги сотрудников
    update public.staff
    set rating_score = v_default_rating
    where rating_score is null or rating_score = 0;
    
    -- Обновляем рейтинги филиалов (если NULL, берем средний рейтинг сотрудников или default)
    update public.branches b
    set rating_score = coalesce(
        (select avg(s.rating_score) from public.staff s where s.branch_id = b.id and s.is_active = true and s.rating_score is not null and s.rating_score > 0),
        v_default_rating
    )
    where b.rating_score is null or b.rating_score = 0;
    
    -- Обновляем рейтинги бизнесов (если NULL, берем средний рейтинг филиалов или default)
    update public.businesses biz
    set rating_score = coalesce(
        (select avg(br.rating_score) from public.branches br where br.biz_id = biz.id and br.is_active = true and br.rating_score is not null and br.rating_score > 0),
        v_default_rating
    )
    where biz.rating_score is null or biz.rating_score = 0;
end $$;


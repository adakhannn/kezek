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
        
        -- 1. Пересчитываем ежедневные метрики только для активных сотрудников
        for r_staff in select id, biz_id, branch_id from public.staff where is_active = true loop
            begin
                perform public.calculate_staff_day_metrics(r_staff.id, v_current_date);
            exception when others then
                raise notice 'Error calculating staff metrics for staff_id=%, date=%: %', r_staff.id, v_current_date, SQLERRM;
            end;
        end loop;

        -- 2. Пересчитываем ежедневные метрики только для активных филиалов
        for r_branch in select id, biz_id from public.branches where is_active = true loop
            begin
                perform public.calculate_branch_day_metrics(r_branch.id, v_current_date);
            exception when others then
                raise notice 'Error calculating branch metrics for branch_id=%, date=%: %', r_branch.id, v_current_date, SQLERRM;
            end;
        end loop;

        -- 3. Пересчитываем ежедневные метрики только для одобренных бизнесов
        for r_biz in select id from public.businesses where is_approved = true loop
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
    
    -- 4. Обновляем агрегированные рейтинги только для активных staff, branches и одобренных businesses
    for r_staff in select id from public.staff where is_active = true loop
        begin
            v_staff_rating := public.calculate_staff_rating(r_staff.id);
            -- Если рейтинг не рассчитан (NULL), устанавливаем стартовый
            if v_staff_rating is null then
                v_staff_rating := v_default_rating;
            end if;
            update public.staff set rating_score = v_staff_rating where id = r_staff.id;
        exception when others then
            raise notice 'Error calculating staff rating for staff_id=%: %', r_staff.id, SQLERRM;
            update public.staff set rating_score = v_default_rating where id = r_staff.id and rating_score is null;
        end;
    end loop;

    for r_branch in select id from public.branches where is_active = true loop
        begin
            v_branch_rating := public.calculate_branch_rating(r_branch.id);
            -- Если рейтинг не рассчитан (NULL), берём средний по сотрудникам
            if v_branch_rating is null then
                select coalesce(avg(rating_score), v_default_rating) into v_branch_rating
                from public.staff
                where branch_id = r_branch.id and is_active = true and rating_score is not null;
            end if;
            update public.branches set rating_score = v_branch_rating where id = r_branch.id;
        exception when others then
            raise notice 'Error calculating branch rating for branch_id=%: %', r_branch.id, SQLERRM;
            update public.branches set rating_score = v_default_rating where id = r_branch.id and rating_score is null;
        end;
    end loop;

    for r_biz in select id from public.businesses where is_approved = true loop
        begin
            v_biz_rating := public.calculate_biz_rating(r_biz.id);
            -- Если рейтинг не рассчитан (NULL), берём средний по филиалам
            if v_biz_rating is null then
                select coalesce(avg(rating_score), v_default_rating) into v_biz_rating
                from public.branches
                where biz_id = r_biz.id and is_active = true and rating_score is not null;
            end if;
            update public.businesses set rating_score = v_biz_rating where id = r_biz.id;
        exception when others then
            raise notice 'Error calculating biz rating for biz_id=%: %', r_biz.id, SQLERRM;
            update public.businesses set rating_score = v_default_rating where id = r_biz.id and rating_score is null;
        end;
    end loop;
    
    raise notice 'Rating initialization completed';
end;
$$;

comment on function public.initialize_all_ratings(integer) is 'Инициализирует рейтинги для всех бизнесов, филиалов и сотрудников. Пересчитывает метрики за последние N дней и устанавливает начальные рейтинги.';

-- Функция для очистки "пустых" дней и пересчета метрик за последние N дней
create or replace function public.cleanup_rating_empty_days(p_days_back integer default 60)
returns void
language plpgsql
as $$
declare
    v_start_date date;
    v_end_date date;
begin
    -- Определяем диапазон дат (по умолчанию последние 60 дней, не включая сегодня)
    v_end_date := timezone('Asia/Bishkek', now())::date - interval '1 day';
    v_start_date := v_end_date - (p_days_back || ' days')::interval;

    raise notice 'Cleaning empty rating days from % to %', v_start_date, v_end_date;

    -- 1. Удаляем дневные метрики сотрудников для неактивных дней
    delete from public.staff_day_metrics s
    where s.metric_date >= v_start_date
      and s.metric_date <= v_end_date
      and coalesce(s.clients_count, 0) = 0
      and coalesce(s.reviews_count, 0) = 0
      and coalesce(s.total_shifts, 0) = 0;

    -- 2. Удаляем дневные метрики филиалов, для которых нет ни одной метрики сотрудника в этот день
    delete from public.branch_day_metrics bdm
    where bdm.metric_date >= v_start_date
      and bdm.metric_date <= v_end_date
      and not exists (
          select 1
          from public.staff_day_metrics sdm
          where sdm.branch_id = bdm.branch_id
            and sdm.metric_date = bdm.metric_date
      );

    -- 3. Удаляем дневные метрики бизнесов, для которых нет ни одной метрики филиала в этот день
    delete from public.biz_day_metrics bzm
    where bzm.metric_date >= v_start_date
      and bzm.metric_date <= v_end_date
      and not exists (
          select 1
          from public.branch_day_metrics bdm
          where bdm.biz_id = bzm.biz_id
            and bdm.metric_date = bzm.metric_date
      );

    raise notice 'Recalculating metrics and ratings for cleaned date range';

    -- 4. Пересчитываем метрики и агрегированные рейтинги для очищенного диапазона
    perform public.recalculate_ratings_for_date_range(v_start_date, v_end_date);
end;
$$;

comment on function public.cleanup_rating_empty_days(integer) is 'Удаляет исторические метрики для неактивных дней за последние N дней и пересчитывает рейтинги с учетом нового правила.';

-- Устанавливаем начальные рейтинги для записей без рейтинга (только IS NULL; 0 — валидное значение)
do $$
declare
    v_default_rating numeric := 50.0;
begin
    update public.staff
    set rating_score = v_default_rating
    where rating_score is null;

    update public.branches b
    set rating_score = coalesce(
        (select avg(s.rating_score) from public.staff s where s.branch_id = b.id and s.is_active = true and s.rating_score is not null),
        v_default_rating
    )
    where b.rating_score is null;

    update public.businesses biz
    set rating_score = coalesce(
        (select avg(br.rating_score) from public.branches br where br.biz_id = biz.id and br.is_active = true and br.rating_score is not null),
        v_default_rating
    )
    where biz.rating_score is null;
end $$;


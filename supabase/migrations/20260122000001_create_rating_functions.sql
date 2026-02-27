-- SQL функции для расчета рейтингов

-- 1. Функция расчета дневных метрик сотрудника
create or replace function public.calculate_staff_day_metrics(
    p_staff_id uuid,
    p_metric_date date
)
returns void
language plpgsql
as $$
declare
    v_config record;
    v_reviews_avg numeric;
    v_reviews_count integer;
    v_clients_count integer;
    v_revenue numeric;
    v_returning_count integer;
    v_returning_ratio numeric;
    v_late_minutes integer;
    v_shifts_with_late integer;
    v_total_shifts integer;
    v_biz_id uuid;
    v_branch_id uuid;
    
    -- Компоненты рейтинга
    v_reviews_score numeric;
    v_productivity_score numeric;
    v_loyalty_score numeric;
    v_discipline_score numeric;
    v_day_score numeric;
    
    -- Вспомогательные переменные для расчета дисциплины
    v_late_penalty numeric;
    v_late_ratio numeric;
    v_avg_clients_per_day numeric;
begin
    -- Получаем активную конфигурацию
    select * into v_config
    from public.rating_global_config
    where is_active = true
    order by valid_from desc
    limit 1;
    
    if v_config is null then
        raise exception 'No active rating configuration found';
    end if;
    
    -- Получаем biz_id и branch_id сотрудника
    select biz_id, branch_id into v_biz_id, v_branch_id
    from public.staff
    where id = p_staff_id;
    
    if v_biz_id is null then
        raise exception 'Staff not found or has no business';
    end if;
    
    -- 1. Метрики отзывов (за день)
    select 
        coalesce(avg(r.rating), 0),
        count(*)::integer
    into v_reviews_avg, v_reviews_count
    from public.reviews r
    join public.bookings b on b.id = r.booking_id
    where b.staff_id = p_staff_id
      and b.status in ('confirmed', 'paid')
      and date(b.start_at at time zone 'Asia/Bishkek') = p_metric_date;
    
    -- Нормализуем среднюю оценку в 0-100 (1-5 -> 0-100)
    v_reviews_score := (v_reviews_avg / 5.0) * 100.0;
    
    -- Штраф за отсутствие отзывов (если нет отзывов, но были клиенты)
    -- Буст за большое количество отзывов (если > 5 отзывов за день, небольшой буст)
    if v_reviews_count = 0 then
        v_reviews_score := v_reviews_score * 0.5; -- Штраф 50% если нет отзывов
    elsif v_reviews_count >= 5 then
        v_reviews_score := least(100.0, v_reviews_score * 1.1); -- Буст 10% если много отзывов
    end if;
    
    -- 2. Метрики продуктивности (количество клиентов за день)
    select 
        count(distinct b.client_id)::integer,
        coalesce(sum(ssi.service_amount), 0)
    into v_clients_count, v_revenue
    from public.bookings b
    left join public.staff_shift_items ssi on ssi.booking_id = b.id
    where b.staff_id = p_staff_id
      and b.status in ('confirmed', 'paid')
      and date(b.start_at at time zone 'Asia/Bishkek') = p_metric_date;
    
    -- Нормализуем продуктивность: сравниваем со средним по филиалу за последние 30 дней
    select coalesce(avg(clients_count), 0) into v_avg_clients_per_day
    from public.staff_day_metrics
    where branch_id = v_branch_id
      and metric_date >= p_metric_date - interval '30 days'
      and metric_date < p_metric_date;
    
    if v_avg_clients_per_day > 0 then
        -- Если выше среднего - 100, если ниже - пропорционально
        v_productivity_score := least(100.0, (v_clients_count::numeric / v_avg_clients_per_day) * 100.0);
    else
        -- Если нет данных для сравнения, используем абсолютное значение
        -- 0 клиентов = 0, 10+ клиентов = 100
        v_productivity_score := least(100.0, (v_clients_count::numeric / 10.0) * 100.0);
    end if;
    
    -- 3. Метрики возвращаемости (клиенты, которые вернулись 2+ раза)
    with client_visits as (
        select 
            b.client_id,
            count(*) as visit_count
        from public.bookings b
        where b.staff_id = p_staff_id
          and b.status in ('confirmed', 'paid')
          and date(b.start_at at time zone 'Asia/Bishkek') <= p_metric_date
        group by b.client_id
    )
    select 
        count(*) filter (where visit_count >= 2)::integer,
        case 
            when count(*) > 0 then 
                (count(*) filter (where visit_count >= 2)::numeric / count(*)::numeric) * 100.0
            else 0
        end
    into v_returning_count, v_returning_ratio
    from client_visits
    where client_id in (
        select distinct client_id
        from public.bookings
        where staff_id = p_staff_id
          and status in ('confirmed', 'paid')
          and date(start_at at time zone 'Asia/Bishkek') = p_metric_date
    );
    
    v_loyalty_score := v_returning_ratio; -- Уже в процентах 0-100
    
    -- 4. Метрики дисциплины (опоздания)
    select 
        coalesce(sum(late_minutes), 0)::integer,
        count(*) filter (where late_minutes > 0)::integer,
        count(*)::integer
    into v_late_minutes, v_shifts_with_late, v_total_shifts
    from public.staff_shifts
    where staff_id = p_staff_id
      and shift_date = p_metric_date;

    -- Если за день не было ни смен, ни клиентов, ни отзывов — считаем день неактивным
    -- и не создаем/не обновляем запись в staff_day_metrics
    if v_total_shifts = 0
       and v_clients_count = 0
       and v_reviews_count = 0 then
        return;
    end if;
    
    -- Штраф за опоздания: если есть опоздания, снижаем рейтинг
    -- 0 опозданий = 100, каждые 30 минут опоздания = -10 баллов, максимум -50
    if v_total_shifts > 0 then
        v_late_penalty := least(50.0, (v_late_minutes::numeric / 30.0) * 10.0);
        v_discipline_score := 100.0 - v_late_penalty;
        
        -- Дополнительный штраф за процент смен с опозданием
        if v_shifts_with_late > 0 then
            v_late_ratio := (v_shifts_with_late::numeric / v_total_shifts::numeric) * 100.0;
            v_discipline_score := v_discipline_score - (v_late_ratio * 0.3); -- Дополнительный штраф
        end if;
    else
        v_discipline_score := 100.0; -- Если нет смен, считаем идеально
    end if;
    
    -- Ограничиваем все компоненты в диапазоне 0-100
    v_reviews_score := greatest(0, least(100, v_reviews_score));
    v_productivity_score := greatest(0, least(100, v_productivity_score));
    v_loyalty_score := greatest(0, least(100, v_loyalty_score));
    v_discipline_score := greatest(0, least(100, v_discipline_score));
    
    -- Рассчитываем итоговый дневной рейтинг (взвешенное среднее)
    v_day_score := (
        (v_reviews_score * v_config.staff_reviews_weight) +
        (v_productivity_score * v_config.staff_productivity_weight) +
        (v_loyalty_score * v_config.staff_loyalty_weight) +
        (v_discipline_score * v_config.staff_discipline_weight)
    ) / 100.0;
    
    -- Сохраняем или обновляем дневные метрики
    insert into public.staff_day_metrics (
        staff_id, biz_id, branch_id, metric_date,
        avg_rating, reviews_count,
        clients_count, revenue,
        returning_clients_count, returning_clients_ratio,
        late_minutes, shifts_with_late, total_shifts,
        day_score
    ) values (
        p_staff_id, v_biz_id, v_branch_id, p_metric_date,
        v_reviews_avg, v_reviews_count,
        v_clients_count, v_revenue,
        v_returning_count, v_returning_ratio,
        v_late_minutes, v_shifts_with_late, v_total_shifts,
        v_day_score
    )
    on conflict (staff_id, metric_date) do update set
        avg_rating = excluded.avg_rating,
        reviews_count = excluded.reviews_count,
        clients_count = excluded.clients_count,
        revenue = excluded.revenue,
        returning_clients_count = excluded.returning_clients_count,
        returning_clients_ratio = excluded.returning_clients_ratio,
        late_minutes = excluded.late_minutes,
        shifts_with_late = excluded.shifts_with_late,
        total_shifts = excluded.total_shifts,
        day_score = excluded.day_score,
        updated_at = timezone('utc'::text, now());
end;
$$;

comment on function public.calculate_staff_day_metrics is 'Рассчитывает дневные метрики и рейтинг для сотрудника за указанную дату';

-- 2. Функция расчета агрегированного рейтинга сотрудника (за 30 дней)
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
    select coalesce(avg(day_score), 0) into v_avg_day_score
    from public.staff_day_metrics
    where staff_id = p_staff_id
      and metric_date >= current_date - (v_config.window_days || ' days')::interval
      and metric_date < current_date;
    
    v_rating := round(v_avg_day_score::numeric, 2);
    
    -- Обновляем рейтинг в таблице staff
    update public.staff
    set 
        rating_score = v_rating,
        rating_updated_at = timezone('utc'::text, now())
    where id = p_staff_id;
    
    return v_rating;
end;
$$;

comment on function public.calculate_staff_rating is 'Рассчитывает агрегированный рейтинг сотрудника за последние 30 дней и обновляет его в таблице staff';

-- 3. Функция расчета дневных метрик филиала
create or replace function public.calculate_branch_day_metrics(
    p_branch_id uuid,
    p_metric_date date
)
returns void
language plpgsql
as $$
declare
    v_biz_id uuid;
    v_avg_staff_score numeric;
    v_total_clients integer;
    v_total_revenue numeric;
    v_avg_rating numeric;
    v_total_reviews integer;
    v_day_score numeric;
    v_metrics_count integer;
begin
    -- Получаем biz_id
    select biz_id into v_biz_id
    from public.branches
    where id = p_branch_id;
    
    if v_biz_id is null then
        raise exception 'Branch not found';
    end if;
    
    -- Агрегируем метрики от сотрудников филиала за день
    select 
        coalesce(avg(sdm.day_score), 0),
        coalesce(sum(sdm.clients_count), 0)::integer,
        coalesce(sum(sdm.revenue), 0),
        coalesce(avg(sdm.avg_rating), 0),
        coalesce(sum(sdm.reviews_count), 0)::integer,
        count(*)::integer
    into v_avg_staff_score, v_total_clients, v_total_revenue, v_avg_rating, v_total_reviews, v_metrics_count
    from public.staff_day_metrics sdm
    where sdm.branch_id = p_branch_id
      and sdm.metric_date = p_metric_date;

    -- Если за день нет ни одной метрики сотрудника, не создаем запись для филиала
    if v_metrics_count = 0 then
        return;
    end if;
    
    -- Рейтинг филиала = средний рейтинг сотрудников (можно добавить дополнительные факторы)
    v_day_score := v_avg_staff_score;
    
    -- Сохраняем или обновляем дневные метрики филиала
    insert into public.branch_day_metrics (
        branch_id, biz_id, metric_date,
        avg_staff_score, total_clients_count, total_revenue,
        avg_rating, total_reviews_count,
        day_score
    ) values (
        p_branch_id, v_biz_id, p_metric_date,
        v_avg_staff_score, v_total_clients, v_total_revenue,
        v_avg_rating, v_total_reviews,
        v_day_score
    )
    on conflict (branch_id, metric_date) do update set
        avg_staff_score = excluded.avg_staff_score,
        total_clients_count = excluded.total_clients_count,
        total_revenue = excluded.total_revenue,
        avg_rating = excluded.avg_rating,
        total_reviews_count = excluded.total_reviews_count,
        day_score = excluded.day_score,
        updated_at = timezone('utc'::text, now());
end;
$$;

comment on function public.calculate_branch_day_metrics is 'Рассчитывает дневные метрики и рейтинг для филиала за указанную дату';

-- 4. Функция расчета агрегированного рейтинга филиала
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
    select coalesce(avg(day_score), 0) into v_avg_day_score
    from public.branch_day_metrics
    where branch_id = p_branch_id
      and metric_date >= current_date - (v_config.window_days || ' days')::interval
      and metric_date < current_date;
    
    v_rating := round(v_avg_day_score::numeric, 2);
    
    -- Обновляем рейтинг в таблице branches
    update public.branches
    set 
        rating_score = v_rating,
        rating_updated_at = timezone('utc'::text, now())
    where id = p_branch_id;
    
    return v_rating;
end;
$$;

comment on function public.calculate_branch_rating is 'Рассчитывает агрегированный рейтинг филиала за последние 30 дней и обновляет его в таблице branches';

-- 5. Функция расчета дневных метрик бизнеса
create or replace function public.calculate_biz_day_metrics(
    p_biz_id uuid,
    p_metric_date date
)
returns void
language plpgsql
as $$
declare
    v_avg_branch_score numeric;
    v_total_clients integer;
    v_total_revenue numeric;
    v_avg_rating numeric;
    v_total_reviews integer;
    v_day_score numeric;
    v_metrics_count integer;
begin
    -- Агрегируем метрики от филиалов бизнеса за день
    select 
        coalesce(avg(bdm.day_score), 0),
        coalesce(sum(bdm.total_clients_count), 0)::integer,
        coalesce(sum(bdm.total_revenue), 0),
        coalesce(avg(bdm.avg_rating), 0),
        coalesce(sum(bdm.total_reviews_count), 0)::integer,
        count(*)::integer
    into v_avg_branch_score, v_total_clients, v_total_revenue, v_avg_rating, v_total_reviews, v_metrics_count
    from public.branch_day_metrics bdm
    where bdm.biz_id = p_biz_id
      and bdm.metric_date = p_metric_date;

    -- Если за день нет ни одной метрики филиала, не создаем запись для бизнеса
    if v_metrics_count = 0 then
        return;
    end if;
    
    -- Рейтинг бизнеса = средний рейтинг филиалов
    v_day_score := v_avg_branch_score;
    
    -- Сохраняем или обновляем дневные метрики бизнеса
    insert into public.biz_day_metrics (
        biz_id, metric_date,
        avg_branch_score, total_clients_count, total_revenue,
        avg_rating, total_reviews_count,
        day_score
    ) values (
        p_biz_id, p_metric_date,
        v_avg_branch_score, v_total_clients, v_total_revenue,
        v_avg_rating, v_total_reviews,
        v_day_score
    )
    on conflict (biz_id, metric_date) do update set
        avg_branch_score = excluded.avg_branch_score,
        total_clients_count = excluded.total_clients_count,
        total_revenue = excluded.total_revenue,
        avg_rating = excluded.avg_rating,
        total_reviews_count = excluded.total_reviews_count,
        day_score = excluded.day_score,
        updated_at = timezone('utc'::text, now());
end;
$$;

comment on function public.calculate_biz_day_metrics is 'Рассчитывает дневные метрики и рейтинг для бизнеса за указанную дату';

-- 6. Функция расчета агрегированного рейтинга бизнеса
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
    select coalesce(avg(day_score), 0) into v_avg_day_score
    from public.biz_day_metrics
    where biz_id = p_biz_id
      and metric_date >= current_date - (v_config.window_days || ' days')::interval
      and metric_date < current_date;
    
    v_rating := round(v_avg_day_score::numeric, 2);
    
    -- Обновляем рейтинг в таблице businesses
    update public.businesses
    set 
        rating_score = v_rating,
        rating_updated_at = timezone('utc'::text, now())
    where id = p_biz_id;
    
    return v_rating;
end;
$$;

comment on function public.calculate_biz_rating is 'Рассчитывает агрегированный рейтинг бизнеса за последние 30 дней и обновляет его в таблице businesses';

-- 7. Функция для пересчета всех рейтингов за вчерашний день (для cron job)
create or replace function public.recalculate_ratings_for_date(
    p_date date default current_date - interval '1 day'
)
returns void
language plpgsql
as $$
declare
    v_staff record;
    v_branch record;
    v_biz record;
begin
    -- Пересчитываем метрики для всех активных сотрудников за указанную дату
    for v_staff in 
        select id from public.staff where is_active = true
    loop
        begin
            perform public.calculate_staff_day_metrics(v_staff.id, p_date);
        exception when others then
            raise warning 'Error calculating metrics for staff %: %', v_staff.id, sqlerrm;
        end;
    end loop;
    
    -- Пересчитываем метрики для всех активных филиалов за указанную дату
    for v_branch in 
        select id from public.branches where is_active = true
    loop
        begin
            perform public.calculate_branch_day_metrics(v_branch.id, p_date);
        exception when others then
            raise warning 'Error calculating metrics for branch %: %', v_branch.id, sqlerrm;
        end;
    end loop;
    
    -- Пересчитываем метрики для всех одобренных бизнесов за указанную дату
    for v_biz in 
        select id from public.businesses where is_approved = true
    loop
        begin
            perform public.calculate_biz_day_metrics(v_biz.id, p_date);
        exception when others then
            raise warning 'Error calculating metrics for biz %: %', v_biz.id, sqlerrm;
        end;
    end loop;
    
    -- Пересчитываем агрегированные рейтинги для всех сотрудников
    for v_staff in 
        select id from public.staff where is_active = true
    loop
        begin
            perform public.calculate_staff_rating(v_staff.id);
        exception when others then
            raise warning 'Error calculating rating for staff %: %', v_staff.id, sqlerrm;
        end;
    end loop;
    
    -- Пересчитываем агрегированные рейтинги для всех филиалов
    for v_branch in 
        select id from public.branches where is_active = true
    loop
        begin
            perform public.calculate_branch_rating(v_branch.id);
        exception when others then
            raise warning 'Error calculating rating for branch %: %', v_branch.id, sqlerrm;
        end;
    end loop;
    
    -- Пересчитываем агрегированные рейтинги для всех бизнесов
    for v_biz in 
        select id from public.businesses where is_approved = true
    loop
        begin
            perform public.calculate_biz_rating(v_biz.id);
        exception when others then
            raise warning 'Error calculating rating for biz %: %', v_biz.id, sqlerrm;
        end;
    end loop;
end;
$$;

comment on function public.recalculate_ratings_for_date is 'Пересчитывает все рейтинги за указанную дату (по умолчанию вчера). Используется в cron job.';


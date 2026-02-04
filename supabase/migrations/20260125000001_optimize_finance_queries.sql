-- Оптимизация запросов для финансовых отчётов
-- 
-- Проблемы:
-- 1. Множественные запросы к БД (смены, позиции смен, сотрудники)
-- 2. Агрегация выполняется на клиенте
-- 3. Нет кэширования для часто запрашиваемых данных
--
-- Решения:
-- 1. SQL функция для агрегации финансовых данных по сотруднику за период
-- 2. SQL функция для агрегации финансовых данных по всем сотрудникам бизнеса за период
-- 3. Использование JOIN вместо отдельных запросов

-- Функция для получения финансовой статистики по сотруднику за период
create or replace function public.get_staff_finance_stats(
    p_staff_id uuid,
    p_biz_id uuid,
    p_date_from date,
    p_date_to date,
    p_include_open boolean default true
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_result jsonb;
    v_today date;
    v_open_shift_id uuid;
    v_open_shift_data jsonb;
begin
    v_today := current_date;
    
    -- Получаем закрытые смены за период
    select jsonb_build_object(
        'closed_shifts', coalesce(jsonb_agg(
            jsonb_build_object(
                'id', s.id,
                'shift_date', s.shift_date,
                'status', s.status,
                'opened_at', s.opened_at,
                'closed_at', s.closed_at,
                'total_amount', s.total_amount,
                'consumables_amount', s.consumables_amount,
                'master_share', s.master_share,
                'salon_share', s.salon_share,
                'late_minutes', s.late_minutes,
                'hours_worked', s.hours_worked,
                'hourly_rate', s.hourly_rate,
                'guaranteed_amount', s.guaranteed_amount,
                'topup_amount', s.topup_amount,
                'items_count', (
                    select count(*)
                    from public.staff_shift_items
                    where shift_id = s.id
                )
            )
            order by s.shift_date desc
        ), '[]'::jsonb),
        'closed_stats', jsonb_build_object(
            'count', count(*),
            'total_amount', coalesce(sum(s.total_amount), 0),
            'total_master', coalesce(sum(s.master_share), 0),
            'total_salon', coalesce(sum(s.salon_share), 0),
            'total_consumables', coalesce(sum(s.consumables_amount), 0),
            'total_late_minutes', coalesce(sum(s.late_minutes), 0)
        )
    )
    into v_result
    from public.staff_shifts s
    where s.staff_id = p_staff_id
      and s.biz_id = p_biz_id
      and s.status = 'closed'
      and s.shift_date >= p_date_from
      and s.shift_date <= p_date_to;
    
    -- Если нужно включить открытые смены
    if p_include_open then
        -- Проверяем, есть ли открытая смена на сегодня
        select id
        into v_open_shift_id
        from public.staff_shifts
        where staff_id = p_staff_id
          and biz_id = p_biz_id
          and shift_date = v_today
          and status = 'open'
        limit 1;
        
        if v_open_shift_id is not null then
            -- Получаем данные открытой смены с агрегацией позиций
            select jsonb_build_object(
                'id', s.id,
                'shift_date', s.shift_date,
                'status', s.status,
                'opened_at', s.opened_at,
                'closed_at', s.closed_at,
                'late_minutes', s.late_minutes,
                'hourly_rate', coalesce(s.hourly_rate, st.hourly_rate),
                'percent_master', coalesce(s.percent_master, st.percent_master, 60),
                'percent_salon', coalesce(s.percent_salon, st.percent_salon, 40),
                'items', coalesce(
                    jsonb_agg(
                        jsonb_build_object(
                            'id', si.id,
                            'client_name', si.client_name,
                            'service_name', si.service_name,
                            'service_amount', si.service_amount,
                            'consumables_amount', si.consumables_amount,
                            'note', si.note,
                            'booking_id', si.booking_id
                        )
                        order by si.created_at
                    ) filter (where si.id is not null),
                    '[]'::jsonb
                ),
                'calculated', jsonb_build_object(
                    'total_amount', coalesce(sum(si.service_amount), 0),
                    'total_consumables', coalesce(sum(si.consumables_amount), 0),
                    'items_count', count(si.id)
                )
            )
            into v_open_shift_data
            from public.staff_shifts s
            left join public.staff st on st.id = s.staff_id
            left join public.staff_shift_items si on si.shift_id = s.id
            where s.id = v_open_shift_id
            group by s.id, s.shift_date, s.status, s.opened_at, s.closed_at, 
                     s.late_minutes, s.hourly_rate, s.percent_master, s.percent_salon,
                     st.hourly_rate, st.percent_master, st.percent_salon;
            
            -- Добавляем открытую смену в результат
            v_result := v_result || jsonb_build_object(
                'open_shift', v_open_shift_data,
                'has_open_shift', true
            );
        else
            v_result := v_result || jsonb_build_object(
                'open_shift', null,
                'has_open_shift', false
            );
        end if;
    end if;
    
    return v_result;
end;
$$;

comment on function public.get_staff_finance_stats is 'Получает финансовую статистику по сотруднику за период. Оптимизированная версия с агрегацией на стороне БД.';

-- Предоставляем права на выполнение функции
grant execute on function public.get_staff_finance_stats(uuid, uuid, date, date, boolean) to authenticated;
grant execute on function public.get_staff_finance_stats(uuid, uuid, date, date, boolean) to service_role;

-- Функция для получения финансовой статистики по всем сотрудникам бизнеса за период
create or replace function public.get_business_finance_stats(
    p_biz_id uuid,
    p_date_from date,
    p_date_to date,
    p_branch_id uuid default null,
    p_include_open boolean default true
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_result jsonb;
    v_today date;
begin
    v_today := current_date;
    
    -- Получаем статистику по всем сотрудникам
    select jsonb_build_object(
        'staff_stats', coalesce(jsonb_agg(
            jsonb_build_object(
                'staff_id', st.id,
                'staff_name', st.full_name,
                'is_active', st.is_active,
                'branch_id', st.branch_id,
                'shifts', jsonb_build_object(
                    'total', count(s.id),
                    'closed', count(*) filter (where s.status = 'closed'),
                    'open', count(*) filter (where s.status = 'open')
                ),
                'stats', jsonb_build_object(
                    'total_amount', coalesce(sum(s.total_amount) filter (where s.status = 'closed'), 0),
                    'total_master', coalesce(sum(s.master_share) filter (where s.status = 'closed'), 0),
                    'total_salon', coalesce(sum(s.salon_share) filter (where s.status = 'closed'), 0),
                    'total_consumables', coalesce(sum(s.consumables_amount) filter (where s.status = 'closed'), 0),
                    'total_late_minutes', coalesce(sum(s.late_minutes) filter (where s.status = 'closed'), 0)
                )
            )
            order by st.full_name
        ), '[]'::jsonb),
        'total_stats', jsonb_build_object(
            'total_shifts', count(s.id),
            'closed_shifts', count(*) filter (where s.status = 'closed'),
            'open_shifts', count(*) filter (where s.status = 'open'),
            'total_amount', coalesce(sum(s.total_amount) filter (where s.status = 'closed'), 0),
            'total_master', coalesce(sum(s.master_share) filter (where s.status = 'closed'), 0),
            'total_salon', coalesce(sum(s.salon_share) filter (where s.status = 'closed'), 0),
            'total_consumables', coalesce(sum(s.consumables_amount) filter (where s.status = 'closed'), 0),
            'total_late_minutes', coalesce(sum(s.late_minutes) filter (where s.status = 'closed'), 0)
        )
    )
    into v_result
    from public.staff st
    left join public.staff_shifts s on s.staff_id = st.id
        and s.biz_id = p_biz_id
        and s.shift_date >= p_date_from
        and s.shift_date <= p_date_to
    where st.biz_id = p_biz_id
      and (p_branch_id is null or st.branch_id = p_branch_id)
    group by st.id, st.full_name, st.is_active, st.branch_id;
    
    -- Если нужно включить открытые смены, добавляем их расчеты
    if p_include_open then
        -- Для открытых смен нужно считать из позиций
        -- Это делается отдельно, так как требует JOIN с staff_shift_items
        -- Пока оставляем это на стороне API для гибкости
    end if;
    
    return v_result;
end;
$$;

comment on function public.get_business_finance_stats is 'Получает финансовую статистику по всем сотрудникам бизнеса за период. Оптимизированная версия с агрегацией на стороне БД.';

-- Предоставляем права на выполнение функции
grant execute on function public.get_business_finance_stats(uuid, date, date, uuid, boolean) to authenticated;
grant execute on function public.get_business_finance_stats(uuid, date, date, uuid, boolean) to service_role;

-- Индекс для ускорения запросов по датам смен
create index if not exists staff_shifts_biz_date_status_idx
    on public.staff_shifts (biz_id, shift_date, status)
    where status = 'closed';

comment on index staff_shifts_biz_date_status_idx is 'Ускоряет запросы финансовых отчётов по закрытым сменам';

-- Индекс для ускорения запросов позиций смен
create index if not exists staff_shift_items_shift_id_idx
    on public.staff_shift_items (shift_id);

comment on index staff_shift_items_shift_id_idx is 'Ускоряет JOIN с позициями смен при агрегации финансовых данных';

